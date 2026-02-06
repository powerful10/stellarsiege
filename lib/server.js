import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

export function getLemonConfig() {
  const apiKey = (process.env.LEMON_API_KEY || "").trim();
  const storeId = (process.env.LEMON_STORE_ID || "").trim();
  const webhookSecret = (process.env.LEMON_WEBHOOK_SECRET || "").trim();
  const testMode = /^(1|true|yes)$/i.test((process.env.LEMON_TEST_MODE || "").trim());
  return { apiKey, storeId, webhookSecret, testMode };
}

export function hasLemonSqueezy() {
  const { apiKey, storeId } = getLemonConfig();
  return Boolean(apiKey && storeId);
}

export function hasFirebaseAdminConfig() {
  return Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim() ||
      (process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "").trim()
  );
}

export function initFirebaseAdmin() {
  if (admin.apps && admin.apps.length > 0) return;

  let creds = null;

  const jsonInline = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (jsonInline) {
    creds = JSON.parse(jsonInline);
  } else {
    const file = (process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "").trim();
    if (file) {
      const full = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      const raw = fs.readFileSync(full, "utf8");
      creds = JSON.parse(raw);
    }
  }

  if (!creds) {
    throw new Error(
      "Missing Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_FILE)."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(creds),
  });
}

export async function requireFirebaseAuth(req, res) {
  try {
    initFirebaseAdmin();
  } catch {
    res.status(501).json({ error: "Firebase Admin not configured on server." });
    return null;
  }

  const auth = req.headers.authorization || "";
  const match = String(auth).match(/^Bearer\\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Missing Authorization: Bearer <idToken>" });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded;
  } catch {
    res.status(401).json({ error: "Invalid auth token" });
    return null;
  }
}

export function requestOrigin(req) {
  const xfProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(xfProto) ? xfProto[0] : xfProto || "http";
  const xfHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(xfHost) ? xfHost[0] : xfHost || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

export function priceForPack(packId) {
  if (packId === "crystals_100") return { name: "100 Crystals", amount: 99, currency: "usd", crystals: 100 };
  if (packId === "crystals_550") return { name: "550 Crystals", amount: 499, currency: "usd", crystals: 550 };
  if (packId === "credits_10000") return { name: "10,000 Credits", amount: 99, currency: "usd", credits: 10000 };
  if (packId === "credits_65000") return { name: "65,000 Credits", amount: 499, currency: "usd", credits: 65000 };
  throw new Error("Unknown packId");
}

export function lemonVariantForPack(packId) {
  if (packId === "crystals_100") return (process.env.LEMON_VARIANT_CRYSTALS_100 || "").trim();
  if (packId === "crystals_550") return (process.env.LEMON_VARIANT_CRYSTALS_550 || "").trim();
  if (packId === "credits_10000") return (process.env.LEMON_VARIANT_CREDITS_10000 || "").trim();
  if (packId === "credits_65000") return (process.env.LEMON_VARIANT_CREDITS_65000 || "").trim();
  throw new Error("Unknown packId");
}

export function setCors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGIN || "").trim();
  if (!allowed) return;

  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Signature, X-Event-Name");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(200).end();
  }
}
