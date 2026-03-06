import admin from "firebase-admin";

import { requestOrigin, requireFirebaseAuth, setCors } from "../../../lib/server";
import { normalizeReferralCode, randomReferralCode, REFERRAL_SHIP_ID, REFERRAL_TARGET } from "../../../lib/referrals";

const CODE_CREATE_ATTEMPTS = 24;

async function ensureReferralCode(db, uid) {
  const codeOwnerRef = db.collection("referral_codes").doc(uid);
  const now = Date.now();

  for (let attempt = 0; attempt < CODE_CREATE_ATTEMPTS; attempt += 1) {
    let selected = "";
    try {
      await db.runTransaction(async (tx) => {
        const ownerSnap = await tx.get(codeOwnerRef);
        const ownerData = ownerSnap.exists ? ownerSnap.data() || {} : {};
        const existing = normalizeReferralCode(ownerData.code || "");

        if (existing) {
          const codeMapRef = db.collection("referral_code_map").doc(existing);
          const codeMapSnap = await tx.get(codeMapRef);
          const codeMapOwner = codeMapSnap.exists ? String((codeMapSnap.data() || {}).uid || "").trim() : "";
          if (!codeMapOwner || codeMapOwner === uid) {
            tx.set(
              codeMapRef,
              {
                uid,
                code: existing,
                updatedAt: now,
                createdAt: Number(ownerData.createdAt || now),
              },
              { merge: true }
            );
            tx.set(
              codeOwnerRef,
              {
                uid,
                code: existing,
                createdAt: Number(ownerData.createdAt || now),
                updatedAt: now,
              },
              { merge: true }
            );
            selected = existing;
            return;
          }
        }

        const generated = randomReferralCode();
        const codeMapRef = db.collection("referral_code_map").doc(generated);
        const codeMapSnap = await tx.get(codeMapRef);
        if (codeMapSnap.exists) throw new Error("collision");

        tx.set(
          codeMapRef,
          {
            uid,
            code: generated,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
        tx.set(
          codeOwnerRef,
          {
            uid,
            code: generated,
            createdAt: Number(ownerData.createdAt || now),
            updatedAt: now,
          },
          { merge: true }
        );
        selected = generated;
      });

      if (selected) return selected;
    } catch (error) {
      const message = String(error && error.message ? error.message : "");
      if (message === "collision") continue;
      throw error;
    }
  }

  throw new Error("code_generation_busy");
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const auth = await requireFirebaseAuth(req, res);
  if (!auth) return;

  let db = null;
  try {
    db = admin.firestore();
  } catch {
    res.status(501).json({ ok: false, error: "firebase_admin_not_configured" });
    return;
  }

  try {
    const uid = String(auth.uid || "").trim();
    if (!uid) {
      res.status(401).json({ ok: false, error: "invalid_auth_uid" });
      return;
    }

    const code = await ensureReferralCode(db, uid);
    const [statsSnap, userSnap] = await Promise.all([
      db.collection("referral_stats").doc(uid).get(),
      db.collection("users").doc(uid).get(),
    ]);

    const stats = statsSnap.exists ? statsSnap.data() || {} : {};
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const ships = userData && userData.ships && typeof userData.ships === "object" ? userData.ships : {};
    const rewardShip = ships[REFERRAL_SHIP_ID] && typeof ships[REFERRAL_SHIP_ID] === "object" ? ships[REFERRAL_SHIP_ID] : {};

    const referredCount = Math.max(0, Math.floor(Number(stats.referredCount || 0)));
    const target = Math.max(1, Math.floor(Number(stats.target || REFERRAL_TARGET)));
    const rewardUnlocked = Boolean(stats.rewardUnlockedAt || rewardShip.owned);
    const origin = requestOrigin(req);
    const inviteUrl = `${origin}/game?ref=${encodeURIComponent(code)}`;

    res.status(200).json({
      ok: true,
      code,
      inviteUrl,
      referredCount,
      target,
      rewardUnlocked,
      rewardShipId: REFERRAL_SHIP_ID,
    });
  } catch (error) {
    const message = String(error && error.message ? error.message : "referral_status_failed");
    const status = message === "code_generation_busy" ? 503 : 500;
    res.status(status).json({ ok: false, error: message || "referral_status_failed" });
  }
}
