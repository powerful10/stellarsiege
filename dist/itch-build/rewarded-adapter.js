(function rewardedAdapterBootstrap() {
  const cfg = (window.ADS_CONFIG && typeof window.ADS_CONFIG === "object") ? window.ADS_CONFIG : {};
  const providerName = String(cfg.provider || "none").toLowerCase();
  const AD_CONSENT_KEY = "stellar_ad_consent_v1";

  function adConsentChoice() {
    const runtime = String(window.__stellarAdConsent || "").trim().toLowerCase();
    if (runtime === "granted" || runtime === "limited") return runtime;
    try {
      const local = String(localStorage.getItem(AD_CONSENT_KEY) || "").trim().toLowerCase();
      if (local === "granted" || local === "limited") return local;
    } catch {
      // ignore localStorage errors
    }
    return "limited";
  }

  class RewardedAdProvider {
    isAvailable() {
      return false;
    }
    async showRewardedAd() {
      return { completed: false, reason: "not_implemented" };
    }
  }

  class StubRewardedAdProvider extends RewardedAdProvider {
    isAvailable() {
      return false;
    }
    async showRewardedAd() {
      return { completed: false, reason: "stub" };
    }
  }

  class AdManagerRewardedAdProvider extends RewardedAdProvider {
    constructor(config) {
      super();
      this.config = config || {};
      this.loadingPromise = null;
    }

    isAvailable() {
      return Boolean(String(this.config.adUnitPath || "").trim());
    }

    ensureGptLoaded() {
      if (window.googletag && window.googletag.apiReady) return Promise.resolve();
      if (this.loadingPromise) return this.loadingPromise;

      window.googletag = window.googletag || { cmd: [] };
      this.loadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.async = true;
        script.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load GPT"));
        document.head.appendChild(script);
      });
      return this.loadingPromise;
    }

    async showRewardedAd() {
      const adUnitPath = String(this.config.adUnitPath || "").trim();
      if (!adUnitPath) return { completed: false, reason: "missing_ad_unit" };
      await this.ensureGptLoaded();
      window.googletag = window.googletag || { cmd: [] };

      return new Promise((resolve) => {
        window.googletag.cmd.push(() => {
          const pubads = window.googletag.pubads();
          let granted = false;
          let done = false;
          let slot;

          const finish = (payload) => {
            if (done) return;
            done = true;
            try {
              if (slot) window.googletag.destroySlots([slot]);
            } catch {
              // ignore cleanup errors
            }
            try {
              pubads.removeEventListener("rewardedSlotReady", onReady);
              pubads.removeEventListener("rewardedSlotGranted", onGranted);
              pubads.removeEventListener("rewardedSlotClosed", onClosed);
              pubads.removeEventListener("slotRenderEnded", onRenderEnded);
            } catch {
              // ignore listener cleanup errors
            }
            resolve(payload);
          };

          const onReady = (event) => {
            if (event.slot !== slot) return;
            try {
              event.makeRewardedVisible();
            } catch {
              finish({ completed: false, reason: "display_failed" });
            }
          };

          const onGranted = (event) => {
            if (event.slot !== slot) return;
            granted = true;
          };

          const onClosed = (event) => {
            if (event.slot !== slot) return;
            finish({ completed: granted, reason: granted ? "completed" : "closed" });
          };

          const onRenderEnded = (event) => {
            if (event.slot !== slot) return;
            if (event.isEmpty) finish({ completed: false, reason: "no_fill" });
          };

          pubads.addEventListener("rewardedSlotReady", onReady);
          pubads.addEventListener("rewardedSlotGranted", onGranted);
          pubads.addEventListener("rewardedSlotClosed", onClosed);
          pubads.addEventListener("slotRenderEnded", onRenderEnded);

          slot = window.googletag.defineOutOfPageSlot(
            adUnitPath,
            window.googletag.enums.OutOfPageFormat.REWARDED
          );

          if (!slot) {
            finish({ completed: false, reason: "slot_unavailable" });
            return;
          }

          slot.addService(pubads);
          try {
            pubads.setRequestNonPersonalizedAds(adConsentChoice() === "granted" ? 0 : 1);
          } catch {
            // ignore consent API issues
          }
          window.googletag.enableServices();
          window.googletag.display(slot);
        });
      });
    }
  }

  class MonetagRewardedAdProvider extends RewardedAdProvider {
    constructor(config) {
      super();
      this.config = config || {};
      this.monetagReady = false;
      this.monetagLoading = null;
    }

    getShowFnName() {
      return String(this.config.monetagShowFn || "show_9660275");
    }

    isAvailable() {
      const fnName = this.getShowFnName();
      return typeof window[fnName] === "function";
    }

    async ensureScript() {
      if (this.isAvailable()) return true;
      if (!this.config.monetagScriptUrl) return false;
      if (this.monetagLoading) return this.monetagLoading;
      this.monetagLoading = new Promise((resolve) => {
        const script = document.createElement("script");
        script.async = true;
        script.src = String(this.config.monetagScriptUrl);
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
      return this.monetagLoading;
    }

    async showRewardedAd() {
      await this.ensureScript();
      const fnName = this.getShowFnName();
      const showFn = window[fnName];
      if (typeof showFn !== "function") {
        return { completed: false, reason: "monetag_not_ready" };
      }

      try {
        const result = await showFn();
        if (result === true) return { completed: true, reason: "completed" };
        if (result && typeof result === "object") {
          const status = String(result.status || result.state || result.event || "").toLowerCase();
          const completed =
            status === "completed" ||
            status === "rewarded" ||
            status === "granted" ||
            Boolean(result.completed);
          return { completed, reason: completed ? "completed" : status || "closed" };
        }
        return { completed: false, reason: "closed" };
      } catch (err) {
        return { completed: false, reason: String((err && err.message) || "failed") };
      }
    }
  }

  class MonetagDirectLinkAdProvider extends RewardedAdProvider {
    constructor(config) {
      super();
      this.config = config || {};
    }

    getLinkUrl() {
      return String(this.config.monetagDirectLinkUrl || this.config.directLinkUrl || "").trim();
    }

    getLinkTarget() {
      const target = String(this.config.monetagDirectLinkTarget || this.config.directLinkTarget || "_blank").trim();
      return target || "_blank";
    }

    getMinAwayMs() {
      const sec = Number(this.config.directLinkMinAwaySeconds || this.config.monetagDirectLinkMinAwaySeconds || 10);
      if (!Number.isFinite(sec)) return 10000;
      return Math.max(5000, Math.floor(sec * 1000));
    }

    getMaxWaitMs() {
      const sec = Number(this.config.directLinkMaxWaitSeconds || this.config.monetagDirectLinkMaxWaitSeconds || 180);
      if (!Number.isFinite(sec)) return 180000;
      return Math.max(30000, Math.floor(sec * 1000));
    }

    isAvailable() {
      return Boolean(this.getLinkUrl());
    }

    async showRewardedAd() {
      const rawUrl = this.getLinkUrl();
      if (!rawUrl) return { completed: false, reason: "missing_direct_link" };

      let directUrl = "";
      try {
        directUrl = new URL(rawUrl, window.location.href).toString();
      } catch {
        return { completed: false, reason: "invalid_direct_link" };
      }

      const target = this.getLinkTarget();
      if (target !== "_blank") return { completed: false, reason: "unsupported_target" };

      const minAwayMs = this.getMinAwayMs();
      const maxWaitMs = this.getMaxWaitMs();
      const openedAt = Date.now();
      let popup = null;
      try {
        popup = window.open(directUrl, "_blank");
      } catch (err) {
        return { completed: false, reason: String((err && err.message) || "open_failed") };
      }

      return new Promise((resolve) => {
        let done = false;
        let hiddenSeen = Boolean(document.hidden);
        let closePoll = null;
        const openDetectionTimeout = setTimeout(() => {
          if (hiddenSeen) return;
          if (!popup) finish(false, "open_not_detected");
        }, 2500);
        const timeout = setTimeout(() => finish(false, "timeout"), maxWaitMs);

        const cleanup = () => {
          clearTimeout(openDetectionTimeout);
          clearTimeout(timeout);
          if (closePoll) clearInterval(closePoll);
          window.removeEventListener("focus", onFocus, true);
          document.removeEventListener("visibilitychange", onVisibility, true);
        };

        const finish = (completed, reason) => {
          if (done) return;
          done = true;
          cleanup();
          resolve({ completed, reason, awayMs: Date.now() - openedAt });
        };

        const evaluateReturn = (reason) => {
          const awayMs = Date.now() - openedAt;
          if (awayMs < minAwayMs) {
            finish(false, "returned_too_fast");
            return;
          }
          if (!hiddenSeen) {
            finish(false, "no_background_transition");
            return;
          }
          finish(true, reason || "completed");
        };

        const onVisibility = () => {
          if (document.hidden) {
            hiddenSeen = true;
            return;
          }
          evaluateReturn("completed");
        };

        const onFocus = () => {
          evaluateReturn("completed");
        };

        if (popup) {
          closePoll = setInterval(() => {
            if (popup.closed) {
              evaluateReturn("popup_closed");
            }
          }, 500);
        }

        window.addEventListener("focus", onFocus, true);
        document.addEventListener("visibilitychange", onVisibility, true);
      });
    }
  }

  class VignetteClickAdProvider extends RewardedAdProvider {
    constructor(config) {
      super();
      this.config = config || {};
      this.loadingPromise = null;
    }

    getZoneId() {
      return String(this.config.vignetteZoneId || "10661017").trim();
    }

    getScriptSrc() {
      return String(this.config.vignetteScriptSrc || "https://gizokraijaw.net/vignette.min.js").trim();
    }

    getMinAwayMs() {
      const sec = Number(this.config.vignetteMinAwaySeconds || 10);
      if (!Number.isFinite(sec)) return 10000;
      return Math.max(5000, Math.floor(sec * 1000));
    }

    getMaxWaitMs() {
      const sec = Number(this.config.vignetteMaxWaitSeconds || 180);
      if (!Number.isFinite(sec)) return 180000;
      return Math.max(30000, Math.floor(sec * 1000));
    }

    isAvailable() {
      return Boolean(this.getZoneId() && this.getScriptSrc());
    }

    ensureScriptInjected() {
      const zone = this.getZoneId();
      const src = this.getScriptSrc();
      if (!zone || !src) return Promise.resolve(false);
      if (this.loadingPromise) return this.loadingPromise;

      this.loadingPromise = new Promise((resolve) => {
        try {
          const parent = [document.documentElement, document.body].filter(Boolean).pop();
          if (!parent) {
            resolve(false);
            return;
          }
          const script = parent.appendChild(document.createElement("script"));
          script.dataset.zone = zone;
          script.src = src;
          script.async = true;
          script.setAttribute("data-stellar-vignette", "1");
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });

      return this.loadingPromise;
    }

    triggerVignette() {
      const fnName = String(this.config.vignetteShowFn || "").trim();
      if (fnName && typeof window[fnName] === "function") {
        try {
          window[fnName]();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    async showRewardedAd() {
      if (!this.isAvailable()) return { completed: false, reason: "vignette_config_missing" };

      // Trigger from the rewarded button click context.
      const triggeredViaFn = this.triggerVignette();
      const injected = await this.ensureScriptInjected();
      if (!triggeredViaFn && !injected) {
        return { completed: false, reason: "vignette_load_failed" };
      }

      const minAwayMs = this.getMinAwayMs();
      const maxWaitMs = this.getMaxWaitMs();
      const startedAt = Date.now();

      return new Promise((resolve) => {
        let done = false;
        let hiddenSeen = Boolean(document.hidden);
        const fallbackGrant = setTimeout(() => {
          const awayMs = Date.now() - startedAt;
          if (awayMs < minAwayMs) return;
          // Vignette providers don't always background the tab. If enough time passed
          // after click, treat it as completed to avoid dropping legitimate rewards.
          finish(true, hiddenSeen ? "completed" : "timer_fallback");
        }, minAwayMs + 150);
        const timeout = setTimeout(() => {
          if (hiddenSeen) {
            finish(false, "short_watch");
          } else {
            finish(false, "no_background_transition");
          }
        }, maxWaitMs);

        const cleanup = () => {
          clearTimeout(fallbackGrant);
          clearTimeout(timeout);
          window.removeEventListener("focus", onFocus, true);
          document.removeEventListener("visibilitychange", onVisibility, true);
        };

        const finish = (completed, reason) => {
          if (done) return;
          done = true;
          cleanup();
          resolve({
            completed,
            reason,
            awayMs: Math.max(0, Date.now() - startedAt),
          });
        };

        const evaluate = (reason) => {
          const awayMs = Date.now() - startedAt;
          if (awayMs < minAwayMs) {
            finish(false, "short_watch");
            return;
          }
          if (!hiddenSeen) {
            finish(false, "no_background_transition");
            return;
          }
          finish(true, reason || "completed");
        };

        const onVisibility = () => {
          if (document.hidden) {
            hiddenSeen = true;
            return;
          }
          evaluate("completed");
        };

        const onFocus = () => {
          if (!hiddenSeen) return;
          evaluate("completed");
        };

        window.addEventListener("focus", onFocus, true);
        document.addEventListener("visibilitychange", onVisibility, true);
      });
    }
  }

  function createProvider() {
    if (providerName === "admanager") {
      return new AdManagerRewardedAdProvider(cfg);
    }
    if (providerName === "monetag") {
      return new MonetagRewardedAdProvider(cfg);
    }
    if (providerName === "monetag_direct" || providerName === "direct_link") {
      return new MonetagDirectLinkAdProvider(cfg);
    }
    if (providerName === "vignette_click") {
      return new VignetteClickAdProvider(cfg);
    }
    return new StubRewardedAdProvider();
  }

  const provider = createProvider();

  window.RewardedAdProvider = RewardedAdProvider;
  window.rewardedAdProvider = provider;
  window.stellarAds = window.stellarAds || {};
  window.stellarAds.showRewardedAd = async (args) => {
    const result = await provider.showRewardedAd(args);
    return { completed: Boolean(result && result.completed), reason: result && result.reason ? result.reason : "" };
  };

  // eslint-disable-next-line no-console
  console.log("[ADS] Rewarded provider initialized", { provider: providerName });
})();
