import { NextResponse } from "next/server";
import { stripe, STRIPE_PRICE_ID } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST { email }  →  { url: "https://checkout.stripe.com/..." }
// Creates a Stripe Checkout session in subscription mode for the Pellet Pro plan.
// Frontend redirects to `url`. On success/cancel, Stripe sends the user back to
// our /pro/success or /pricing pages.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "valid email required" }, { status: 400 });
    }
    if (!STRIPE_PRICE_ID) {
      return NextResponse.json({ error: "Stripe price not configured" }, { status: 500 });
    }

    const origin = new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: email,
      success_url: `${origin}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { pellet_signup_email: email },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
