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
      (process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "").trim() ||
      (
        (process.env.FIREBASE_PROJECT_ID || "").trim() &&
        (process.env.FIREBASE_CLIENT_EMAIL || "").trim() &&
        (process.env.FIREBASE_PRIVATE_KEY || "").trim()
      )
  );
}

function normalizeServiceAccount(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const creds = { ...raw };
  const projectId = String(creds.project_id || creds.projectId || "").trim();
  const clientEmail = String(creds.client_email || creds.clientEmail || "").trim();
  const privateKeyRaw = String(creds.private_key || creds.privateKey || "").trim();
  const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, "\n") : "";

  if (projectId) {
    creds.project_id = projectId;
    creds.projectId = projectId;
  }
  if (clientEmail) {
    creds.client_email = clientEmail;
    creds.clientEmail = clientEmail;
  }
  if (privateKey) {
    creds.private_key = privateKey;
    creds.privateKey = privateKey;
  }

  return creds;
}

function fromInlineJson() {
  const inlineRaw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!inlineRaw) return null;

  const candidates = [inlineRaw];
  if (
    (inlineRaw.startsWith('"') && inlineRaw.endsWith('"')) ||
    (inlineRaw.startsWith("'") && inlineRaw.endsWith("'"))
  ) {
    candidates.push(inlineRaw.slice(1, -1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return normalizeServiceAccount(parsed);
      if (typeof parsed === "string") {
        const nested = JSON.parse(parsed);
        if (nested && typeof nested === "object") return normalizeServiceAccount(nested);
      }
    } catch {
      // continue
    }
  }

  return null;
}

function fromSplitEnv() {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKeyRaw = String(process.env.FIREBASE_PRIVATE_KEY || "").trim();
  if (!projectId || !clientEmail || !privateKeyRaw) return null;

  return normalizeServiceAccount({
    project_id: projectId,
    projectId,
    client_email: clientEmail,
    clientEmail,
    private_key: privateKeyRaw,
    privateKey: privateKeyRaw,
  });
}

export function initFirebaseAdmin() {
  if (admin.apps && admin.apps.length > 0) return;

  let creds = fromInlineJson();
  if (!creds) creds = fromSplitEnv();
  if (!creds) {
    const file = (process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "").trim();
    if (file) {
      const full = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      const raw = fs.readFileSync(full, "utf8");
      creds = normalizeServiceAccount(JSON.parse(raw));
    }
  }

  if (!creds) {
    throw new Error(
      "Missing Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_JSON, split FIREBASE_* vars, or FIREBASE_SERVICE_ACCOUNT_FILE)."
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
  const match = String(auth).match(/^Bearer\s+(.+)$/i);
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
