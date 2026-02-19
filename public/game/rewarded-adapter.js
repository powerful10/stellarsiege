(function rewardedAdapterBootstrap() {
  const cfg = (window.ADS_CONFIG && typeof window.ADS_CONFIG === "object") ? window.ADS_CONFIG : {};
  const providerName = String(cfg.provider || "none").toLowerCase();

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

  function createProvider() {
    if (providerName === "admanager") {
      return new AdManagerRewardedAdProvider(cfg);
    }
    if (providerName === "monetag") {
      return new MonetagRewardedAdProvider(cfg);
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
