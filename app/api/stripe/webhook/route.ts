import { NextResponse } from "next/server";
import crypto from "node:crypto";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Stripe sends a signature header; we verify with the webhook signing secret
// configured in the dashboard when the webhook endpoint was created.
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function generateApiKey(): string {
  // 48 hex chars (192 bits), prefixed so keys are recognizable and greppable.
  return `pellet_${crypto.randomBytes(24).toString("hex")}`;
}

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });

  const rawBody = await req.text(); // raw string required for signature verification

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "verify failed";
    return NextResponse.json({ error: `invalid signature: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        const email = session.customer_details?.email ?? session.customer_email ?? null;

        if (!customerId || !subscriptionId || !email) {
          // Should be impossible for a successful subscription checkout, but
          // defend anyway rather than silently dropping.
          return NextResponse.json(
            { error: "missing customer/subscription/email on session" },
            { status: 400 },
          );
        }

        const apiKey = generateApiKey();
        await db.execute(sql`
          INSERT INTO pellet_pro_subscribers
            (email, stripe_customer_id, stripe_subscription_id, api_key, status, created_at)
          VALUES (${email}, ${customerId}, ${subscriptionId}, ${apiKey}, 'active', NOW())
          ON CONFLICT (stripe_customer_id) DO UPDATE SET
            stripe_subscription_id = EXCLUDED.stripe_subscription_id,
            status = 'active',
            cancelled_at = NULL
        `);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;
        await db.execute(sql`
          UPDATE pellet_pro_subscribers
          SET status = 'cancelled', cancelled_at = NOW()
          WHERE stripe_customer_id = ${customerId}
        `);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        await db.execute(sql`
          UPDATE pellet_pro_subscribers
          SET status = 'past_due'
          WHERE stripe_customer_id = ${customerId}
        `);
        break;
      }

      default:
        // Ignore events we don't care about — Stripe sends many.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
