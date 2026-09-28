import Razorpay from "razorpay";

let client: Razorpay | null = null;

/**
 * Lazily creates the Razorpay client.
 * Kept lazy so that importing this module never throws at import time —
 * only the actual payment actions fail if the keys are missing.
 */
export function getRazorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay keys missing. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env"
    );
  }

  if (!client) {
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  return client;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  );
}

/** Public key id handed to the browser checkout. */
export function getRazorpayPublicKeyId(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
}
