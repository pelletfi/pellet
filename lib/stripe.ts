import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Throw at import time in server contexts so we fail loudly rather than
  // silently misbehave on a checkout request.
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";
