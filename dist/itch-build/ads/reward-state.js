(function rewardStateBootstrap() {
  function toInt(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.floor(n);
  }

  function ensureDay(profile, dayKey, resetFn) {
    if (!profile) return;
    const today = dayKey();
    if (profile.adRewardsDay !== today) {
      profile.adRewardsDay = today;
      profile.adRewardsClaimed = 0;
      if (typeof resetFn === "function") resetFn();
    }
  }

  function status({ profile, session, caps, nowMs, dayKey, onDayReset }) {
    ensureDay(profile, dayKey, onDayReset);

    const claimed = Math.max(0, toInt(profile && profile.adRewardsClaimed, 0));
    const sessionClaimed = Math.max(0, toInt(session && session.rewardedAdsClaimed, 0));
    const remaining = Math.max(0, toInt(caps.dailyCap, 0) - claimed);
    const sessionRemaining = Math.max(0, toInt(caps.sessionCap, 0) - sessionClaimed);
    const cooldownUntil = toInt(profile && profile.adRewardLastAt, 0) + Math.max(0, toInt(caps.cooldownMs, 0));
    const waitMs = Math.max(0, cooldownUntil - toInt(nowMs(), 0));

    return {
      claimed,
      remaining,
      waitMs,
      sessionClaimed,
      sessionRemaining,
    };
  }

  function consume({ profile, session, caps, nowMs, dayKey, unlimited, onConsumed }) {
    if (unlimited) {
      if (typeof onConsumed === "function") onConsumed({ consumed: false, unlimited: true });
      return { ok: true, unlimited: true };
    }

    const s = status({ profile, session, caps, nowMs, dayKey });
    if (s.remaining <= 0 || s.waitMs > 0 || s.sessionRemaining <= 0) {
      return { ok: false, status: s };
    }

    profile.adRewardsClaimed = s.claimed + 1;
    profile.adRewardLastAt = toInt(nowMs(), 0);
    session.rewardedAdsClaimed = s.sessionClaimed + 1;

    if (typeof onConsumed === "function") {
      onConsumed({ consumed: true, status: s });
    }

    return { ok: true, status: s };
  }

  function formatCooldown(waitMs) {
    const sec = Math.max(1, Math.ceil(Number(waitMs || 0) / 1000));
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }

  function integrityClockBlocked(profile, nowMs) {
    const now = toInt(nowMs(), 0);
    const lastIntegrity = toInt(profile && profile.adIntegrityLastAt, 0);
    if (lastIntegrity && now + 30000 < lastIntegrity) {
      return true;
    }
    if (profile) profile.adIntegrityLastAt = now;
    return false;
  }

  window.StellarRewardState = {
    status,
    consume,
    formatCooldown,
    integrityClockBlocked,
  };
})();
