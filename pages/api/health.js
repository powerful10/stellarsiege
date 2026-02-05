export default function handler(req, res) {
  const lemonSqueezy = Boolean(
    (process.env.LEMON_API_KEY || "").trim() && (process.env.LEMON_STORE_ID || "").trim()
  );
  const firebaseAdmin = Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim() ||
      (process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "").trim()
  );

  res.status(200).json({ ok: true, lemonSqueezy, firebaseAdmin });
}
