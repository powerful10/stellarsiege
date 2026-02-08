(function rewardedAdapterBootstrap() {
  const cfg = (window.ADS_CONFIG && typeof window.ADS_CONFIG === "object") ? window.ADS_CONFIG : {};
  const provider = String(cfg.provider || "none").toLowerCase();
  if (provider !== "admanager") return;

  const adUnitPath = String(cfg.adUnitPath || "").trim();
  if (!adUnitPath) {
    // eslint-disable-next-line no-console
    console.warn("[ADS] Missing ADS_CONFIG.adUnitPath for admanager provider.");
    return;
  }

  function ensureGptLoaded() {
    if (window.googletag && window.googletag.apiReady) return Promise.resolve();
    if (window.__stellarGptLoading) return window.__stellarGptLoading;

    window.googletag = window.googletag || { cmd: [] };
    window.__stellarGptLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load GPT"));
      document.head.appendChild(script);
    });

    return window.__stellarGptLoading;
  }

  async function showRewardedAd({ placement } = {}) {
    await ensureGptLoaded();
    window.googletag = window.googletag || { cmd: [] };

    return new Promise((resolve) => {
      window.googletag.cmd.push(() => {
        const pubads = window.googletag.pubads();
        let granted = false;
        let done = false;

        const finish = (payload) => {
          if (done) return;
          done = true;
          try {
            if (slot) window.googletag.destroySlots([slot]);
          } catch {
            // ignore slot cleanup errors
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

        const slot = window.googletag.defineOutOfPageSlot(
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

  window.stellarAds = window.stellarAds || {};
  window.stellarAds.showRewardedAd = showRewardedAd;

  // eslint-disable-next-line no-console
  console.log("[ADS] Rewarded adapter ready", { provider, adUnitPath });
})();
