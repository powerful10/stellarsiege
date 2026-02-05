import crypto from "node:crypto";
import admin from "firebase-admin";

import { getLemonConfig, initFirebaseAdmin, setCors } from "../../../lib/server";

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

function headerValue(value) {
  if (Array.isArray(value)) return value[0];
  return value || "";
}

function verifySignature(rawBody, signature, secret) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const sig = String(signature || "");

  if (!sig || sig.length !== expected.length) return false;

  const expectedBuf = Buffer.from(expected, "utf8");
  const sigBuf = Buffer.from(sig, "utf8");
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { webhookSecret } = getLemonConfig();
  if (!webhookSecret) {
    res.status(501).send("Missing LEMON_WEBHOOK_SECRET");
    return;
  }

  const sig = headerValue(req.headers["x-signature"]);
  if (!sig) {
    res.status(400).send("Missing X-Signature header");
    return;
  }

  const rawBody = await readRawBody(req);

  if (!verifySignature(rawBody, sig, webhookSecret)) {
    res.status(400).send("Webhook signature verification failed.");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).send("Invalid JSON payload.");
    return;
  }

  const eventName =
    headerValue(req.headers["x-event-name"]) || (payload && payload.meta ? payload.meta.event_name : "");

  if (eventName === "order_created") {
    try {
      initFirebaseAdmin();

      const custom = (payload && payload.meta && payload.meta.custom_data) || {};
      const uid = custom && custom.uid ? custom.uid : null;
      const crystals = Number(custom && custom.crystals ? custom.crystals : 0);

      const status =
        payload && payload.data && payload.data.attributes ? payload.data.attributes.status : null;
      if (status && status !== "paid") {
        res.status(200).json({ received: true });
        return;
      }

      if (uid && Number.isFinite(crystals) && crystals > 0) {
        const db = admin.firestore();
        const ref = db.collection("users").doc(uid);

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const data = snap.exists ? snap.data() : {};
          const profile = (data && data.profile) || {};
          const current = Number(profile.crystals || 0);
          const next = current + crystals;

          tx.set(
            ref,
            {
              profile: {
                ...profile,
                crystals: next,
                updatedAt: Date.now(),
              },
              ships: (data && data.ships) || {},
              version: 2,
            },
            { merge: true }
          );
        });
      }
    } catch (err) {
      // Don't fail the webhook (Lemon Squeezy will retry). Log for debugging.
      // eslint-disable-next-line no-console
      console.error("[webhook] fulfill failed", err);
    }
  }

  res.status(200).json({ received: true });
}
