(function economyBootstrap() {
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function sessionCreditMultiplier(startedAtMs, nowMs) {
    const started = Number(startedAtMs || 0);
    const now = Number(nowMs || Date.now());
    const mins = (now - started) / 60000;
    if (mins <= 30) return 1;
    const over = mins - 30;
    return clamp(1 - over * 0.0025, 0.78, 1);
  }

  function calculateRunRewards(ctx) {
    const mode = String(ctx.mode || "survival");
    const score = Math.max(0, Math.floor(Number(ctx.score || 0)));
    const wave = Math.max(1, Math.floor(Number(ctx.wave || 1)));
    const farmMult = Number(ctx.farmMult || 1);
    const reason = String(ctx.reason || "");

    const baseCredits = Math.floor(score * 0.095) + wave * 11;
    const baseXp = Math.floor(score * 0.11) + wave * 9;

    let credits = Math.floor(baseCredits * farmMult);
    let xp = Math.floor(baseXp * (0.95 + farmMult * 0.05));
    let crystals = 0;

    if (mode === "campaign" && ctx.campaignCompleted) {
      const missionId = Math.max(1, Math.floor(Number(ctx.campaignMissionId || 1)));
      credits += 420 + missionId * 120;
      xp += 180 + missionId * 42;
      crystals += 1;
    }

    if (reason === "duel_win") {
      credits += 320;
      xp += 180;
      crystals += 1;
    }

    return {
      credits: Math.max(0, Math.floor(credits)),
      xp: Math.max(0, Math.floor(xp)),
      crystals: Math.max(0, Math.floor(crystals)),
    };
  }

  window.StellarEconomy = {
    sessionCreditMultiplier,
    calculateRunRewards,
  };
})();
