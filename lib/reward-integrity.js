import crypto from "node:crypto";

const OFFER_ALLOWLIST = Object.freeze([
  "hangar_credits_420",
  "hangar_crystals_2_credits_120",
  "run_continue",
  "daily_double",
]);

const OFFER_SET = new Set(OFFER_ALLOWLIST);
const usedTokens = new Map();
const actorState = new Map();

const DEV_SECRET = crypto.randomBytes(32).toString("hex");
let warnedMissingSecret = false;

function nowMs() {
  return Date.now();
}

function dailyKey(ts = nowMs()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cleanup(now = nowMs()) {
  for (const [jti, exp] of usedTokens.entries()) {
    if (!Number.isFinite(Number(exp)) || Number(exp) <= now) {
      usedTokens.delete(jti);
    }
  }

  const today = dailyKey(now);
  for (const [key, value] of actorState.entries()) {
    if (!value || typeof value !== "object") {
      actorState.delete(key);
      continue;
    }

    if (String(value.dailyKey || "") !== today) {
      actorState.set(key, {
        dailyKey: today,
        dailyCount: 0,
        lastClaimAt: Number(value.lastClaimAt || 0),
      });
    }
  }
}

function rewardSecret() {
  const envSecret = String(process.env.REWARD_TOKEN_SECRET || "").trim();
  if (envSecret) return envSecret;

  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    // eslint-disable-next-line no-console
    console.warn("[rewards] REWARD_TOKEN_SECRET is missing; using random in-memory dev secret.");
  }
  return DEV_SECRET;
}

function toBase64Url(value) {
  return Buffer.from(String(value), "utf8").toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(String(value), "base64url").toString("utf8");
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function signPart(part) {
  return crypto.createHmac("sha256", rewardSecret()).update(String(part || "")).digest("base64url");
}

function parseIp(req) {
  const forwarded = req && req.headers ? req.headers["x-forwarded-for"] : "";
  if (Array.isArray(forwarded) && forwarded.length) {
    return String(forwarded[0] || "").split(",")[0].trim();
  }
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  const remote = req && req.socket ? req.socket.remoteAddress : "";
  return String(remote || "unknown").trim();
}

function parseToken(token) {
  try {
    const raw = String(token || "").trim();
    const parts = raw.split(".");
    if (parts.length !== 2) return { ok: false, error: "invalid_token" };

    const [payloadPart, sigPart] = parts;
    if (!payloadPart || !sigPart) return { ok: false, error: "invalid_token" };

    const expectedSig = signPart(payloadPart);
    if (expectedSig !== sigPart) return { ok: false, error: "invalid_token" };

    const payloadText = fromBase64Url(payloadPart);
    const payload = JSON.parse(payloadText);
    if (!payload || typeof payload !== "object") return { ok: false, error: "invalid_token" };

    const exp = Number(payload.exp || 0);
    if (!Number.isFinite(exp) || exp <= nowMs()) return { ok: false, error: "expired" };

    return { ok: true, payload };
  } catch {
    return { ok: false, error: "invalid_token" };
  }
}

function nextActorState(actorKey, now = nowMs()) {
  const key = String(actorKey || "");
  const today = dailyKey(now);
  const current = actorState.get(key) || {
    dailyKey: today,
    dailyCount: 0,
    lastClaimAt: 0,
  };

  if (String(current.dailyKey || "") !== today) {
    current.dailyKey = today;
    current.dailyCount = 0;
  }

  if (!Number.isFinite(Number(current.lastClaimAt))) current.lastClaimAt = 0;
  if (!Number.isFinite(Number(current.dailyCount))) current.dailyCount = 0;

  return {
    dailyKey: String(current.dailyKey || today),
    dailyCount: Math.max(0, Math.floor(Number(current.dailyCount || 0))),
    lastClaimAt: Math.max(0, Math.floor(Number(current.lastClaimAt || 0))),
  };
}

export function sanitizeOffer(offerId) {
  const normalized = String(offerId || "").trim().toLowerCase();
  if (!OFFER_SET.has(normalized)) return "";
  return normalized;
}

export function actorKeyFromRequest(req) {
  const ip = parseIp(req);
  const ua = String((req && req.headers && req.headers["user-agent"]) || "").trim();
  const stable = `${ip}|${ua}`;
  return `actor:${hashText(stable)}`;
}

export function issueRewardToken({ actorKey, offerId, minAwayMs = 0, ttlMs = 180_000 }) {
  cleanup();

  const safeOffer = sanitizeOffer(offerId);
  if (!safeOffer) {
    return { ok: false, error: "offer_not_allowed" };
  }

  const now = nowMs();
  const tokenTtlMs = Math.max(15_000, Math.floor(Number(ttlMs || 180_000)));
  const expiresAt = now + tokenTtlMs;
  const jti = crypto.randomBytes(16).toString("hex");
  const actorKeyHash = hashText(String(actorKey || ""));

  const payload = {
    jti,
    offerId: safeOffer,
    actorKeyHash,
    minAwayMs: Math.max(0, Math.floor(Number(minAwayMs || 0))),
    exp: expiresAt,
  };

  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signature = signPart(payloadPart);
  const token = `${payloadPart}.${signature}`;

  return {
    ok: true,
    token,
    offerId: safeOffer,
    expiresAt,
    minAwayMs: payload.minAwayMs,
  };
}

export function consumeRewardToken({
  actorKey,
  token,
  awayMs,
  minAwayMs = 0,
  cooldownMs = 90_000,
  dailyCap = 15,
}) {
  cleanup();

  const parsed = parseToken(token);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error || "invalid_token" };
  }

  const payload = parsed.payload;
  const safeOffer = sanitizeOffer(payload.offerId);
  if (!safeOffer) {
    return { ok: false, error: "offer_not_allowed" };
  }

  const actorHash = hashText(String(actorKey || ""));
  if (String(payload.actorKeyHash || "") !== actorHash) {
    return { ok: false, error: "invalid_token" };
  }

  const jti = String(payload.jti || "").trim();
  if (!jti) {
    return { ok: false, error: "invalid_token" };
  }
  if (usedTokens.has(jti)) {
    return { ok: false, error: "already_used" };
  }

  const away = Math.max(0, Math.floor(Number(awayMs || 0)));
  const requiredAway = Math.max(0, Math.floor(Number(minAwayMs || payload.minAwayMs || 0)));
  if (away < requiredAway) {
    return { ok: false, error: "short_watch" };
  }

  const now = nowMs();
  const state = nextActorState(actorKey, now);

  const safeDailyCap = Math.max(1, Math.floor(Number(dailyCap || 15)));
  if (state.dailyCount >= safeDailyCap) {
    return { ok: false, error: "daily_cap" };
  }

  const safeCooldownMs = Math.max(0, Math.floor(Number(cooldownMs || 90_000)));
  if (state.lastClaimAt && now - state.lastClaimAt < safeCooldownMs) {
    return {
      ok: false,
      error: "cooldown",
      retryAfterMs: Math.max(0, safeCooldownMs - (now - state.lastClaimAt)),
    };
  }

  usedTokens.set(jti, Number(payload.exp || now + 180_000));
  const next = {
    dailyKey: state.dailyKey,
    dailyCount: state.dailyCount + 1,
    lastClaimAt: now,
  };
  actorState.set(String(actorKey || ""), next);

  return {
    ok: true,
    offerId: safeOffer,
    consumedAt: now,
    actor: {
      dailyCount: next.dailyCount,
      dailyKey: next.dailyKey,
      lastClaimAt: next.lastClaimAt,
    },
  };
}
