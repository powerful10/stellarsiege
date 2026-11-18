// Optional: Firebase config for Google sign-in, cloud saves, global leaderboard, and online duels.
//
// 1) Create a Firebase project
// 2) Add a Web App
// 3) Enable Authentication -> Sign-in method -> Google
// 4) Enable Realtime Database (for online rooms/duels)
// 5) Copy the config object here:
//
// window.FIREBASE_CONFIG = {
//   apiKey: "...",
//   authDomain: "...",
//   databaseURL: "...", // Realtime Database URL
//   projectId: "...",
//   storageBucket: "...",
//   messagingSenderId: "...",
//   appId: "...",
// };
//
// IMPORTANT: For Google sign-in you must run this game on http://localhost (or HTTPS hosting).
// Opening index.html via file:// will not work with OAuth popups.

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAHzFAigw7IS__GSdoHlqPelxcO1BFnk5A",
  authDomain: "stellar-siege.firebaseapp.com",
  databaseURL: "https://stellar-siege-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "stellar-siege",
  storageBucket: "stellar-siege.firebasestorage.app",
  messagingSenderId: "1058826698690",
  appId: "1:1058826698690:web:a8483d043092ceaa28a05b",
};

// Optional: payments backend (Lemon Squeezy) base URL (same-origin if empty).
// When you deploy the backend, set e.g.:
// window.PAYMENTS_API_BASE = "https://yourdomain.com";
// Enable store UI only when checkout backend is ready:
// window.NEXT_PUBLIC_PAYMENTS_ENABLED = true;
if (typeof window.NEXT_PUBLIC_PAYMENTS_ENABLED !== "boolean") {
  window.NEXT_PUBLIC_PAYMENTS_ENABLED = true;
}
if (typeof window.PAYMENTS_API_BASE !== "string") {
  window.PAYMENTS_API_BASE = "";
}

// Optional: GA4 measurement ID (for event analytics / funnel tracking).
// Example: window.GA_MEASUREMENT_ID = "G-XXXXXXXXXX";
if (typeof window.GA_MEASUREMENT_ID !== "string" || !window.GA_MEASUREMENT_ID.trim()) {
  window.GA_MEASUREMENT_ID = "G-WLS8XZTGMP";
}

// Optional: rewarded ad config.
// provider:
// - "none" => disables rewarded ad claiming
// - "admanager" => Google Ad Manager GPT rewarded ad
// - "monetag" => Monetag rewarded SDK flow (configure monetagShowFn + monetagScriptUrl if needed)
// - "monetag_direct" => Monetag direct-link flow (opens URL and grants reward)
//
// mockEnabled should be false in production.
const rewardedAdUnitPath =
  typeof window.AD_MANAGER_REWARDED_UNIT_PATH === "string"
    ? window.AD_MANAGER_REWARDED_UNIT_PATH.trim()
    : "";
const vignetteZoneId = "12192845";
const vignetteScriptSrc = "https://n6wxm.com/vignette.min.js";
const baseRewardedProvider = "monetag_direct";
const existingAdsConfig = typeof window.ADS_CONFIG === "object" && window.ADS_CONFIG ? window.ADS_CONFIG : {};
const rewardedUrl =
  typeof window.REWARDED_AD_URL === "string" && window.REWARDED_AD_URL.trim()
    ? window.REWARDED_AD_URL.trim()
    : String(existingAdsConfig.rewardedUrl || existingAdsConfig.monetagDirectLinkUrl || "https://uplcm.com/4/12193075").trim();

window.ADS_CONFIG = {
  provider: baseRewardedProvider,
  defaultProvider: baseRewardedProvider,
  rewardedUrl,
  minAwaySeconds: 0,
  sessionRewardCap: 6,
  dailyRewardCap: 15,
  cooldownSeconds: 90,
  unlimitedRewards: false,

  // Ad Manager configuration:
  adUnitPath: rewardedAdUnitPath,

  // Monetag SDK configuration placeholders:
  monetagShowFn: "YOUR_MONETAG_REWARDED_FUNCTION_NAME",
  monetagScriptUrl: "YOUR_MONETAG_SCRIPT_URL",
  // Vignette click configuration:
  vignetteShowFn: "stellarShowVignetteAd",
  vignetteZoneId,
  vignetteScriptSrc,
  vignetteMinAwaySeconds: 10,
  vignetteOpenDetectSeconds: 15,
  vignetteMaxWaitSeconds: 180,

  // Dev-only fallback simulator:
  mockEnabled: false,
  mockSeconds: 12,
  ...existingAdsConfig,
};

if (typeof window.TELEGRAM_REWARD_BOT_URL !== "string") {
  window.TELEGRAM_REWARD_BOT_URL = "https://t.me/StellarSiegeRewardSystem_Bot";
}

