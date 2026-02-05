export default function handler(req, res) {
  const stripe = Boolean((process.env.STRIPE_SECRET_KEY || "").trim());
  const firebaseAdmin = Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim() ||
      (process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "").trim()
  );

  res.status(200).json({ ok: true, stripe, firebaseAdmin });
}

