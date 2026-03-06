import admin from "firebase-admin";

import { requireFirebaseAuth, setCors } from "../../../lib/server";
import { normalizeReferralCode, REFERRAL_SHIP_ID, REFERRAL_TARGET } from "../../../lib/referrals";

function asCount(value) {
  return Math.max(0, Math.floor(Number(value || 0)));
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
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

  const code = normalizeReferralCode(req.body && req.body.code ? req.body.code : "");
  if (!code) {
    res.status(400).json({ ok: false, error: "missing_code" });
    return;
  }

  const referredUid = String(auth.uid || "").trim();
  if (!referredUid) {
    res.status(401).json({ ok: false, error: "invalid_auth_uid" });
    return;
  }

  const now = Date.now();
  const codeMapRef = db.collection("referral_code_map").doc(code);
  const claimRef = db.collection("referral_claims").doc(referredUid);
  const meUserRef = db.collection("users").doc(referredUid);

  let responsePayload = {
    ok: true,
    applied: false,
    code,
    ownerUid: "",
    referredCount: 0,
    target: REFERRAL_TARGET,
    rewardUnlocked: false,
  };

  try {
    await db.runTransaction(async (tx) => {
      const codeMapSnap = await tx.get(codeMapRef);
      if (!codeMapSnap.exists) throw new Error("invalid_code");

      const codeMap = codeMapSnap.data() || {};
      const ownerUid = String(codeMap.uid || "").trim();
      if (!ownerUid) throw new Error("invalid_code");
      if (ownerUid === referredUid) throw new Error("self_referral_not_allowed");

      const ownerStatsRef = db.collection("referral_stats").doc(ownerUid);
      const ownerUserRef = db.collection("users").doc(ownerUid);

      const existingClaimSnap = await tx.get(claimRef);
      if (existingClaimSnap.exists) {
        const existingClaim = existingClaimSnap.data() || {};
        const existingOwnerUid = String(existingClaim.ownerUid || "").trim();
        if (existingOwnerUid === ownerUid) {
          const existingStatsSnap = await tx.get(ownerStatsRef);
          const existingStats = existingStatsSnap.exists ? existingStatsSnap.data() || {} : {};
          responsePayload = {
            ok: true,
            applied: false,
            code,
            ownerUid,
            referredCount: asCount(existingStats.referredCount),
            target: Math.max(1, asCount(existingStats.target || REFERRAL_TARGET)),
            rewardUnlocked: Boolean(existingStats.rewardUnlockedAt),
            status: "already_counted_for_owner",
          };
          return;
        }
        throw new Error("already_has_referrer");
      }

      const statsSnap = await tx.get(ownerStatsRef);
      const stats = statsSnap.exists ? statsSnap.data() || {} : {};
      const before = asCount(stats.referredCount);
      const after = before + 1;
      const target = Math.max(1, asCount(stats.target || REFERRAL_TARGET));
      const rewardAlreadyUnlocked = Boolean(stats.rewardUnlockedAt);
      const rewardUnlocked = rewardAlreadyUnlocked || after >= target;

      tx.set(
        claimRef,
        {
          referredUid,
          ownerUid,
          code,
          createdAt: now,
        },
        { merge: false }
      );

      tx.set(
        ownerStatsRef,
        {
          uid: ownerUid,
          referredCount: after,
          target,
          rewardShipId: REFERRAL_SHIP_ID,
          updatedAt: now,
          ...(rewardUnlocked && !rewardAlreadyUnlocked ? { rewardUnlockedAt: now } : {}),
        },
        { merge: true }
      );

      tx.set(
        meUserRef,
        {
          profile: {
            referredByUid: ownerUid,
            referredByCode: code,
            referredAt: now,
          },
          updatedAt: now,
        },
        { merge: true }
      );

      if (rewardUnlocked && !rewardAlreadyUnlocked) {
        tx.set(
          ownerUserRef,
          {
            ships: {
              [REFERRAL_SHIP_ID]: {
                owned: true,
              },
            },
            profile: {
              referralRewardUnlockedAt: now,
            },
            updatedAt: now,
          },
          { merge: true }
        );
      }

      responsePayload = {
        ok: true,
        applied: true,
        code,
        ownerUid,
        referredCount: after,
        target,
        rewardUnlocked,
      };
    });

    res.status(200).json(responsePayload);
  } catch (error) {
    const message = String(error && error.message ? error.message : "referral_claim_failed");
    if (message === "invalid_code") {
      res.status(404).json({ ok: false, error: message });
      return;
    }
    if (message === "self_referral_not_allowed") {
      res.status(400).json({ ok: false, error: message });
      return;
    }
    if (message === "already_has_referrer") {
      res.status(409).json({ ok: false, error: message });
      return;
    }
    res.status(500).json({ ok: false, error: message || "referral_claim_failed" });
  }
}
