(function featureFlagsBootstrap() {
  const DEFAULTS = Object.freeze({
    redesign_phase0: true,
    redesign_phase1: true,
    ship_abilities_v1: true,
    economy_tree_v1: true,
    ads_safe_rewards_v1: true,
    server_reward_claim_v1: true,
    guest_progress_requires_auth_v1: true,
    diagnostics_v1: false,
  });

  function parseBoolean(value) {
    const text = String(value == null ? "" : value).trim().toLowerCase();
    if (!text) return null;
    if (text === "1" || text === "true" || text === "yes" || text === "on") return true;
    if (text === "0" || text === "false" || text === "no" || text === "off") return false;
    return null;
  }

  function fromQuery(base) {
    const out = { ...base };
    try {
      const params = new URLSearchParams(window.location.search || "");
      Object.keys(base).forEach((key) => {
        const raw = params.get(`ff_${key}`);
        const parsed = parseBoolean(raw);
        if (parsed == null) return;
        out[key] = parsed;
      });
    } catch {
      // ignore malformed URL state
    }
    return out;
  }

  function fromStorage(base) {
    const out = { ...base };
    try {
      const raw = localStorage.getItem("stellar_feature_flags_v1");
      if (!raw) return out;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return out;
      Object.keys(base).forEach((key) => {
        const bool = parseBoolean(parsed[key]);
        if (bool == null) return;
        out[key] = bool;
      });
    } catch {
      // ignore storage errors
    }
    return out;
  }

  const merged = fromStorage(fromQuery({ ...DEFAULTS, ...(window.STELLAR_FLAGS || {}) }));

  window.STELLAR_FLAGS = merged;
  window.StellarFlags = {
    all() {
      return { ...merged };
    },
    isEnabled(name, fallback = false) {
      if (Object.prototype.hasOwnProperty.call(merged, name)) return Boolean(merged[name]);
      return Boolean(fallback);
    },
  };
})();
