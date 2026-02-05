import admin from "firebase-admin";
import { getStripe, initFirebaseAdmin, setCors } from "../../../lib/server";

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

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(501).send("Stripe not configured");
    return;
  }

  const secret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    res.status(501).send("Missing STRIPE_WEBHOOK_SECRET");
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).send("Missing Stripe-Signature header");
    return;
  }

  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch {
    res.status(400).send("Webhook signature verification failed.");
    return;
  }

  if (event.type === "checkout.session.completed") {
    try {
      initFirebaseAdmin();
      const session = event.data.object;
      const uid = session && session.metadata ? session.metadata.uid : null;
      const crystals = Number(session && session.metadata ? session.metadata.crystals : 0);

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
      // Don't fail the webhook (Stripe will retry). Log for debugging.
      // eslint-disable-next-line no-console
      console.error("[webhook] fulfill failed", err);
    }
  }

  res.status(200).json({ received: true });
}
