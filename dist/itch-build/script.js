/*
  Stellar Siege - Roguelite Arena

  Your clicks weren't working because `script.js` was missing from the folder,
  so the browser never loaded any handlers.

  This file is the whole game (client-only).
*/

console.log("[Stellar Siege] boot");

const $ = (id) => document.getElementById(id);
const QUERY = new URLSearchParams(window.location.search);
const PORTAL_MODE = QUERY.get("portal") === "1";
const DEV_MODE = QUERY.get("dev") === "1";
const PAYMENTS_ENABLED =
  String(window.NEXT_PUBLIC_PAYMENTS_ENABLED == null ? "" : window.NEXT_PUBLIC_PAYMENTS_ENABLED)
    .trim()
    .toLowerCase() === "true";

const FLAGS = window.StellarFlags || { isEnabled: () => false };
const LOG = window.StellarLogger || {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
const STORAGE = window.StellarStorage || null;
const ECONOMY = window.StellarEconomy || null;
const SCREEN_STATE = window.StellarScreenState || null;
const REWARD_STATE = window.StellarRewardState || null;
const REDESIGN_ENABLED = FLAGS.isEnabled("redesign_phase0", true);

if (DEV_MODE) document.body.classList.add("dev-mode");

function isTouchDevice() {
  return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
}

function shouldUseTouchControls() {
  const hasFinePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (hasFinePointer) return false;
  if (!isTouchDevice()) return false;
  return true;
}

function lockMobileZoom() {
  if (!isTouchDevice()) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute(
    "content",
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
  );

  const prevent = (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  };
  document.addEventListener("touchmove", prevent, { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });
}

function clearExistingServiceWorkers() {
  if (!("serviceWorker" in navigator) || typeof navigator.serviceWorker.getRegistrations !== "function") return;
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {});
      });
    })
    .catch(() => {});
}

const ADS = {
  provider:
    typeof window.ADS_CONFIG === "object" && window.ADS_CONFIG
      ? String(window.ADS_CONFIG.provider || "none").toLowerCase()
      : "none",
  sessionCap: Math.max(
    1,
    Math.floor(
      Number(
        typeof window.ADS_CONFIG === "object" && window.ADS_CONFIG
          ? window.ADS_CONFIG.sessionRewardCap
          : 5
      ) || 5
    )
  ),
  dailyCap: Math.max(
    1,
    Math.floor(
      Number(
        typeof window.ADS_CONFIG === "object" && window.ADS_CONFIG
          ? window.ADS_CONFIG.dailyRewardCap
          : 20
      ) || 20
    )
  ),
  cooldownMs: Math.max(
    0,
    Math.floor(
      Number(
        typeof window.ADS_CONFIG === "object" && window.ADS_CONFIG
          ? window.ADS_CONFIG.cooldownSeconds
          : 60
      ) || 60
    ) * 1000
  ),
  unlimitedRewards:
    typeof window.ADS_CONFIG === "object" &&
    window.ADS_CONFIG &&
    Boolean(window.ADS_CONFIG.unlimitedRewards),
  mockEnabled:
    typeof window.ADS_CONFIG === "object" &&
    window.ADS_CONFIG &&
    Boolean(window.ADS_CONFIG.mockEnabled),
  mockSeconds: Math.max(
    3,
    Math.floor(
      Number(
        typeof window.ADS_CONFIG === "object" && window.ADS_CONFIG
          ? window.ADS_CONFIG.mockSeconds
          : 12
      ) || 12
    )
  ),
};
const ADS_DISABLED = false;

const AUTH_RUNTIME = {
  signedIn: false,
  resolved: false,
};

const AD_CONSENT_KEY = "stellar_ad_consent_v1";
const AD_CONSENT = Object.freeze({
  GRANTED: "granted",
  LIMITED: "limited",
});
const AD_PROFILE_KEY = "stellar_ad_profile_v1";
const AD_PROFILE = Object.freeze({
  SAFE: "safe",
  STANDARD: "standard",
});
const ADS_DEFAULT_PROVIDER =
  typeof window.ADS_CONFIG === "object" && window.ADS_CONFIG
    ? String(window.ADS_CONFIG.defaultProvider || window.ADS_CONFIG.provider || "none").toLowerCase()
    : ADS.provider;

function getAdProfileChoice() {
  try {
    const raw = String(localStorage.getItem(AD_PROFILE_KEY) || "").trim().toLowerCase();
    if (raw === AD_PROFILE.SAFE || raw === AD_PROFILE.STANDARD) return raw;
  } catch {
    // ignore localStorage errors
  }
  return "";
}

function setAdProfileChoice(profile) {
  if (profile !== AD_PROFILE.SAFE && profile !== AD_PROFILE.STANDARD) return;
  try {
    localStorage.setItem(AD_PROFILE_KEY, profile);
  } catch {
    // ignore localStorage errors
  }
}

function getAdConsentChoice() {
  try {
    const raw = String(localStorage.getItem(AD_CONSENT_KEY) || "").trim().toLowerCase();
    if (raw === AD_CONSENT.GRANTED || raw === AD_CONSENT.LIMITED) return raw;
  } catch {
    // ignore localStorage errors
  }
  return "";
}

function setAdConsentChoice(choice) {
  if (choice !== AD_CONSENT.GRANTED && choice !== AD_CONSENT.LIMITED) return;
  try {
    localStorage.setItem(AD_CONSENT_KEY, choice);
  } catch {
    // ignore localStorage errors
  }
  applyAdConsentRuntime();
}

function applyAdConsentRuntime() {
  const consent = getAdConsentChoice();
  window.__stellarAdConsent = consent || AD_CONSENT.LIMITED;
  if (window.adsbygoogle) {
    window.adsbygoogle.requestNonPersonalizedAds = consent === AD_CONSENT.GRANTED ? 0 : 1;
  }
}

function applyAdProfileRuntime(profile) {
  const cfg =
    typeof window.ADS_CONFIG === "object" && window.ADS_CONFIG
      ? window.ADS_CONFIG
      : {};

  if (ADS_DISABLED) {
    ADS.provider = "none";
    cfg.provider = "none";
    cfg.defaultProvider = "none";
    cfg.monetagDirectLinkUrl = "";
    setAdConsentChoice(AD_CONSENT.LIMITED);
    return;
  }

  const selected = profile === AD_PROFILE.SAFE || profile === AD_PROFILE.STANDARD ? profile : "";

  if (selected === AD_PROFILE.STANDARD) {
    ADS.provider = ADS_DEFAULT_PROVIDER || "none";
    cfg.provider = ADS.provider;
  } else {
    ADS.provider = "none";
    cfg.provider = "none";
    if (selected === AD_PROFILE.SAFE) setAdConsentChoice(AD_CONSENT.LIMITED);
  }

  const consent = getAdConsentChoice();
  if (consent !== AD_CONSENT.GRANTED && consent !== AD_CONSENT.LIMITED) {
    setAdConsentChoice(AD_CONSENT.LIMITED);
  } else {
    applyAdConsentRuntime();
  }
}

const ANALYTICS = {
  measurementId:
    typeof window.GA_MEASUREMENT_ID === "string" ? window.GA_MEASUREMENT_ID.trim() : "",
  initialized: false,
};

function initAnalytics() {
  if (ANALYTICS.initialized) return;
  ANALYTICS.initialized = true;
  if (!ANALYTICS.measurementId) return;

  const existing = document.querySelector("script[data-ga='stellar']");
  if (!existing) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ANALYTICS.measurementId)}`;
    script.setAttribute("data-ga", "stellar");
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", ANALYTICS.measurementId, {
    anonymize_ip: true,
    send_page_view: true,
  });
}

function trackEvent(name, params = {}) {
  if (!window.gtag) return;
  try {
    window.gtag("event", name, params);
  } catch {
    // ignore analytics runtime errors
  }
}

window.addEventListener("error", (event) => {
  LOG.error("runtime_error", {
    message: event && event.message ? String(event.message) : "unknown",
    file: event && event.filename ? String(event.filename) : "",
    line: event && Number.isFinite(event.lineno) ? Number(event.lineno) : 0,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event && event.reason ? event.reason : null;
  LOG.error("unhandled_rejection", {
    reason: reason && reason.message ? String(reason.message) : String(reason || "unknown"),
  });
});

function must(id) {
  const el = $(id);
  if (!el) throw new Error(`Missing element #${id} (check index.html)`);
  return el;
}

lockMobileZoom();
clearExistingServiceWorkers();
applyAdConsentRuntime();
if (PORTAL_MODE) document.body.classList.add("portal-mode");

// HUD
const hudEl = must("hud");
const scoreEl = must("score");
const waveEl = must("wave");
const comboEl = must("combo");
const levelEl = must("level");
const creditsEl = must("credits");
const crystalsEl = must("crystals");
const shieldBarEl = must("shieldBar");
const hullBarEl = must("hullBar");
const objectiveEl = must("objective");

// Overlays
const menuEl = must("menu");
const hangarEl = must("hangar");
const leaderboardEl = must("leaderboard");
const campaignEl = must("campaign");
const onlineEl = must("online");
const settingsEl = must("settings");
const upgradePickEl = must("upgradePick");
const gameoverEl = must("gameover");
const rotateOverlayEl = must("rotateOverlay");
const dailyRewardEl = must("dailyReward");

// Menu buttons
const playSurvivalBtn = must("playSurvivalBtn");
const playCampaignBtn = must("playCampaignBtn");
const hangarBtn = must("hangarBtn");
const leaderboardBtn = must("leaderboardBtn");
const onlineBtn = must("onlineBtn");
const settingsBtn = must("settingsBtn");
const guestSyncBannerEl = must("guestSyncBanner");
const guestSyncSignInBtn = must("guestSyncSignInBtn");
const guestSyncCloseBtn = must("guestSyncCloseBtn");
const guestSyncBannerTextEl = $("guestSyncBannerText");
const menuFullscreenBtn = $("menuFullscreenBtn");
const infoBtn = must("infoBtn");
const menuControlsHintEl = $("menuControlsHint");
const menuSubtitlePillEl = $("menuSubtitlePill");
const menuMissionTipEl = $("menuMissionTip");
const menuPrivacyLinkEl = $("menuPrivacyLink");
const menuTermsLinkEl = $("menuTermsLink");

// Hangar UI
const pilotPillEl = must("pilotPill");
const backFromHangarBtn = must("backFromHangarBtn");
const hangarHomeBtn = $("hangarHomeBtn");
const statsBoxEl = must("statsBox");
const shipPickerEl = must("shipPicker");
const upgradeListEl = must("upgradeList");
const shipModelEl = must("shipModel");
const tierPickerEl = must("tierPicker");
const tierT1Btn = must("tierT1Btn");
const tierT2Btn = must("tierT2Btn");
const tierT3Btn = must("tierT3Btn");
const unlockFxEl = must("unlockFx");
const buy100Btn = must("buy100");
const buy550Btn = must("buy550");
const buyCredits10kBtn = must("buyCredits10k");
const buyCredits65kBtn = must("buyCredits65k");
const convertBtn = must("convertBtn");
const hangarAdCreditsBtn = must("hangarAdCreditsBtn");
const hangarAdCrystalsBtn = must("hangarAdCrystalsBtn");
const storeCardEl = must("storeCard");
const upgradeTreeEl = $("upgradeTree");
const achievementPanelEl = $("achievementPanel");

// Leaderboard UI
const backFromLeaderboardBtn = must("backFromLeaderboardBtn");
const backFromCampaignBtn = must("backFromCampaignBtn");
const tabLocalBtn = must("tabLocal");
const tabGlobalBtn = must("tabGlobal");
const leaderboardListEl = must("leaderboardList");
const leaderboardMetaEl = $("leaderboardMeta");
const missionListEl = must("missionList");

// Online UI
const backFromOnlineBtn = must("backFromOnlineBtn");
const authStatusEl = must("authStatus");
const googleSignInBtn = must("googleSignInBtn");
const signOutBtn = must("signOutBtn");
const roomCodeEl = must("roomCode");
const createRoomBtn = must("createRoomBtn");
const joinRoomBtn = must("joinRoomBtn");
const startDuelBtn = must("startDuelBtn");
const onlineHintEl = must("onlineHint");

// Upgrade pick UI
const pickListEl = must("pickList");

// Game over UI
const finalScoreEl = must("finalScore");
const finalWaveEl = must("finalWave");
const finalKillsEl = must("finalKills");
const finalBestKillsEl = must("finalBestKills");
const finalRewardsEl = must("finalRewards");
const gameoverTitleEl = must("gameoverTitle");
const gameoverSubEl = must("gameoverSub");
const restartBtn = must("restartBtn");
const toMenuBtn = must("toMenuBtn");
const shareScoreBtn = must("shareScoreBtn");
const copyLinkBtn = $("copyLinkBtn");
const challengeFriendBtn = $("challengeFriendBtn");
const newRecordBadgeEl = must("newRecordBadge");
const fsHintEl = must("fsHint");
const adRewardBoxEl = must("adRewardBox");
const adRewardTextEl = must("adRewardText");
const adRewardBtn = must("adRewardBtn");
const infoOverlayEl = must("infoOverlay");
const infoCloseBtn = must("infoCloseBtn");
const infoFullscreenBtn = must("infoFullscreenBtn");
const landscapeHintEl = must("landscapeHint");
const toastEl = must("toast");

// Hamburger menu
const menuBtn = must("menuBtn");
const sideMenuEl = must("sideMenu");
const menuResumeBtn = must("menuResumeBtn");
const menuHomeBtn = must("menuHomeBtn");
const menuRestartBtn = must("menuRestartBtn");
const menuCampaignBtn = must("menuCampaignBtn");
const menuHangarBtn = must("menuHangarBtn");
const menuLeaderboardBtn = must("menuLeaderboardBtn");
const menuOnlineBtn = must("menuOnlineBtn");
const menuSettingsBtn = must("menuSettingsBtn");
const sideFullscreenBtn = $("sideFullscreenBtn");
const sideInfoBtn = must("sideInfoBtn");
const menuResetBtn = must("menuResetBtn");
const tapAssistToggle = $("tapAssistToggle");
const stickyLockToggle = $("stickyLockToggle");
const aimAssistStrengthEl = $("aimAssistStrength");
const aimAssistStrengthValueEl = $("aimAssistStrengthValue");
const sideAimAssistTitleEl = $("sideAimAssistTitle");
const sideTapAssistLabelEl = $("sideTapAssistLabel");
const sideStickyLockLabelEl = $("sideStickyLockLabel");
const sideAimStrengthLabelEl = $("sideAimStrengthLabel");
const sideProgressTipEl = $("sideProgressTip");

// Top-right auth UI
const topSignInBtn = must("topSignInBtn");
const topAccountBtn = must("topAccountBtn");
const topAvatarImg = must("topAvatarImg");
const topAvatarFallback = must("topAvatarFallback");
const topSignOutBtn = must("topSignOutBtn");
const topCreditsEl = must("topCredits");
const topCrystalsEl = must("topCrystals");
const topAuthBadgeEl = $("topAuthBadge");
if (PORTAL_MODE) {
  topSignInBtn.classList.add("hidden");
  topAccountBtn.classList.add("hidden");
  topSignOutBtn.classList.add("hidden");
}

// Touch controls
const touchShootBtn = must("touchShoot");
const touchAutoLockBtn = $("touchAutoLockBtn");
const touchAbilityBtn = $("touchAbilityBtn");
const touchPauseBtn = $("touchPauseBtn");
const joystickBaseEl = must("joyBase");
const joystickStickEl = must("joyStick");
const touchControlsEl = document.querySelector(".touchControls");

// Account overlay
const accountEl = must("account");
const closeAccountBtn = must("closeAccountBtn");
const accountBoxEl = must("accountBox");
const accountSyncBtn = must("accountSyncBtn");
const accountToOnlineBtn = must("accountToOnlineBtn");
const accountSignOutBtn = must("accountSignOutBtn");
const missionBoardEl = must("missionBoard");
const missionRerollBtn = $("missionRerollBtn");

// Settings overlay
const backFromSettingsBtn = must("backFromSettingsBtn");
const settingsTitleEl = must("settingsTitle");
const settingsAudioTitleEl = must("settingsAudioTitle");
const settingsMusicEnabledEl = must("settingsMusicEnabled");
const settingsMusicEnabledLabelEl = must("settingsMusicEnabledLabel");
const settingsMusicVolumeEl = must("settingsMusicVolume");
const settingsMusicVolumeLabelEl = must("settingsMusicVolumeLabel");
const settingsMusicVolumeValueEl = must("settingsMusicVolumeValue");
const settingsShootSfxEl = must("settingsShootSfx");
const settingsShootSfxLabelEl = must("settingsShootSfxLabel");
const settingsDestroySfxEl = must("settingsDestroySfx");
const settingsDestroySfxLabelEl = must("settingsDestroySfxLabel");
const settingsHapticsEl = must("settingsHaptics");
const settingsHapticsLabelEl = must("settingsHapticsLabel");
const settingsDamageNumbersEl = $("settingsDamageNumbers");
const settingsDamageNumbersLabelEl = $("settingsDamageNumbersLabel");
const settingsAdaptiveDifficultyEl = $("settingsAdaptiveDifficulty");
const settingsAdaptiveDifficultyLabelEl = $("settingsAdaptiveDifficultyLabel");
const settingsFpsLimitEl = $("settingsFpsLimit");
const settingsFpsLimitLabelEl = $("settingsFpsLimitLabel");
const settingsFullscreenRowEl = must("settingsFullscreenRow");
const settingsFullscreenToggleEl = must("settingsFullscreenToggle");
const settingsFullscreenLabelEl = must("settingsFullscreenLabel");
const settingsNextTrackBtn = must("settingsNextTrackBtn");
const settingsTrackNameEl = must("settingsTrackName");
const settingsAdTitleEl = must("settingsAdTitle");
const settingsAdHintEl = must("settingsAdHint");
const settingsAdCurrentEl = must("settingsAdCurrent");
const settingsConsentAcceptBtn = must("settingsConsentAcceptBtn");
const settingsConsentLimitedBtn = must("settingsConsentLimitedBtn");
const settingsLanguageTitleEl = must("settingsLanguageTitle");
const settingsLanguageLabelEl = must("settingsLanguageLabel");
const settingsLanguageHintEl = must("settingsLanguageHint");
const settingsLanguageEl = must("settingsLanguage");

// Daily reward UI
const dailyRewardTitleEl = must("dailyRewardTitle");
const dailyRewardSummaryEl = must("dailyRewardSummary");
const dailyRewardLadderEl = must("dailyRewardLadder");
const dailyClaimBtn = must("dailyClaimBtn");
const dailyDoubleBtn = must("dailyDoubleBtn");
const dailyCloseBtn = must("dailyCloseBtn");
const tutorialOverlayEl = $("tutorialOverlay");
const tutorialTitleEl = $("tutorialTitle");
const tutorialBodyEl = $("tutorialBody");
const tutorialNextBtn = $("tutorialNextBtn");
const tutorialSkipBtn = $("tutorialSkipBtn");
const pauseOverlayEl = $("pauseOverlay");
const pauseResumeBtn = $("pauseResumeBtn");
const pauseMenuBtn = $("pauseMenuBtn");
const abilityLabelEl = $("abilityLabel");
const abilityCooldownEl = $("abilityCooldown");
const diagnosticsPanelEl = $("diagnosticsPanel");
const consentBannerEl = $("consentBanner");
const consentAcceptBtn = $("consentAcceptBtn");
const consentLimitedBtn = $("consentLimitedBtn");
const adProfileGateEl = $("adProfileGate");
const adProfileSafeBtn = $("adProfileSafeBtn");
const adProfileStandardBtn = $("adProfileStandardBtn");

if (PORTAL_MODE) {
  tabGlobalBtn.classList.add("hidden");
}

// Canvas
const uiEl = must("ui");
const gameRootEl = document.getElementById("gameRoot") || uiEl.parentElement || document.body;
const canvas = must("game");
const ctx = canvas.getContext("2d");

let WORLD = { width: 960, height: 600 };

const SESSION = {
  rewardedAdsClaimed: 0,
  creditsEarned: 0,
  startedAt: Date.now(),
  dailyRewardPromptedAt: "",
  tutorialStep: 0,
  rewardClaimsThisSession: 0,
  frameSamples: [],
  fps: 0,
  guestPlayMs: 0,
  nextGuestReminderAtMs: 30 * 60 * 1000,
};

const GUEST_REMINDER_INTERVAL_MS = 30 * 60 * 1000;
const GUEST_REMINDER_DURATION_MS = 3000;

let forcedPreviewTier = null;
let unlockFxTimer = null;
let currentGameShipKey = "";
let game3DReady = false;
const SIMPLE_HANGAR_MODE = true;

function tierFromIndex(idx) {
  return Math.max(1, Math.min(3, Math.floor(Number(idx || 1))));
}

const MODE = {
  SURVIVAL: "survival",
  CAMPAIGN: "campaign",
  DUEL: "duel",
};

const STATE = {
  MENU: "menu",
  HANGAR: "hangar",
  LEADERBOARD: "leaderboard",
  CAMPAIGN: "campaign",
  ONLINE: "online",
  ACCOUNT: "account",
  SETTINGS: "settings",
  RUN: "run",
  PICK: "pick",
  OVER: "over",
};

const LANGUAGE_OPTIONS = Object.freeze([
  { code: "en", label: "English" },
  { code: "uz", label: "Uzbek (O'zbek)" },
  { code: "ru", label: "Russian (Русский)" },
  { code: "tr", label: "Turkish (Türkçe)" },
  { code: "es", label: "Spanish (Español)" },
  { code: "fr", label: "French (Français)" },
  { code: "de", label: "German (Deutsch)" },
  { code: "pt", label: "Portuguese (Português)" },
  { code: "ar", label: "Arabic (العربية)" },
  { code: "hi", label: "Hindi (हिन्दी)" },
  { code: "id", label: "Indonesian (Bahasa Indonesia)" },
  { code: "ja", label: "Japanese (日本語)" },
  { code: "ko", label: "Korean (한국어)" },
  { code: "zh", label: "Chinese (简体中文)" },
]);

const SUPPORTED_LANGUAGE_CODES = Object.freeze(LANGUAGE_OPTIONS.map((it) => it.code));

function normalizeLanguageCode(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "en";
  if (SUPPORTED_LANGUAGE_CODES.includes(value)) return value;
  const short = value.split("-")[0];
  return SUPPORTED_LANGUAGE_CODES.includes(short) ? short : "en";
}

function detectInitialLanguage() {
  const list = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || "en"];
  for (let i = 0; i < list.length; i += 1) {
    const value = String(list[i] || "").trim().toLowerCase();
    if (!value) continue;
    if (SUPPORTED_LANGUAGE_CODES.includes(value)) return value;
    const short = value.split("-")[0];
    if (SUPPORTED_LANGUAGE_CODES.includes(short)) return short;
  }
  return "en";
}

let state = STATE.MENU;
let activeMode = MODE.SURVIVAL;
let activeCampaignMissionId = null;
let paused = false;
let hangarAuthWaitScheduled = false;
let routeBooting = true;

function setPaused(next) {
  paused = next;
}

function togglePauseOverlay(forceOpen = null) {
  if (!pauseOverlayEl || !run.active || state !== STATE.RUN) return;
  const shouldOpen = forceOpen == null ? pauseOverlayEl.classList.contains("hidden") : Boolean(forceOpen);
  pauseOverlayEl.classList.toggle("hidden", !shouldOpen);
  setPaused(shouldOpen);
}

function needsLandscape() {
  return Boolean(window.matchMedia && window.matchMedia("(orientation: portrait)").matches);
}

function updateRotateOverlay() {
  const showHint = needsLandscape() && state !== STATE.PICK && state !== STATE.OVER;
  rotateOverlayEl.classList.add("hidden");
  landscapeHintEl.classList.toggle("hidden", !showHint);
  return true;
}

let pendingStart = null;
let rotateReadyAt = 0;

function updateTouchControlsVisibility() {
  if (!touchControlsEl) return;
  const show =
    shouldUseTouchControls() &&
    state === STATE.RUN &&
    (activeMode === MODE.SURVIVAL || activeMode === MODE.CAMPAIGN || activeMode === MODE.DUEL);
  touchControlsEl.classList.toggle("touchControls--active", show);
  touchControlsEl.classList.toggle("hidden", !show);
  if (!show && touchAutoLockBtn) touchAutoLockBtn.classList.add("hidden");
  if (touchAbilityBtn) touchAbilityBtn.classList.toggle("hidden", !show);
  if (touchPauseBtn) touchPauseBtn.classList.toggle("hidden", !show);
  updateAutoLockButtonUi();
  applyPhoneHangarPolicy();
}

function isPhoneHangarDisabled() {
  return false;
}

function applyPhoneHangarPolicy() {
  document.body.classList.remove("phone-no-hangar");

  if (hangarBtn) {
    hangarBtn.classList.remove("hidden");
    hangarBtn.disabled = false;
    hangarBtn.title = "";
  }
  if (menuHangarBtn) {
    menuHangarBtn.classList.remove("hidden");
    menuHangarBtn.disabled = false;
    menuHangarBtn.title = "";
  }
}

function normalizePath(pathname) {
  const raw = String(pathname || "/");
  if (raw === "/") return "/";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function routeCampaignLevel(pathname) {
  const match =
    pathname.match(/^\/game\/campaign\/start\/level(\d+)$/i) ||
    pathname.match(/^\/game\/campaign\/start\/(\d+)$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
}

function routeForRunState() {
  if (activeMode === MODE.SURVIVAL) return "/game/survival/start";
  if (activeMode === MODE.CAMPAIGN) {
    const missionId = Math.max(
      1,
      Math.floor(
        Number(activeCampaignMissionId || (run.campaign && run.campaign.missionId) || SAVE.profile.campaignUnlocked || 1)
      )
    );
    return `/game/campaign/start/level${missionId}`;
  }
  if (activeMode === MODE.DUEL) return "/game/onlinematch/start";
  return "/game/index.html";
}

function routeForUiState(next) {
  if (next === STATE.MENU) return "/game/index.html";
  if (next === STATE.HANGAR) return "/game/hangar";
  if (next === STATE.LEADERBOARD) return "/game/leaderboard";
  if (next === STATE.CAMPAIGN) return "/game/campaign";
  if (next === STATE.ONLINE) return "/game/onlinematch";
  if (next === STATE.ACCOUNT) return "/game/account";
  if (next === STATE.SETTINGS) return "/game/settings";
  if (next === STATE.RUN || next === STATE.PICK || next === STATE.OVER) return routeForRunState();
  return null;
}

function buildModeSearch() {
  const parts = [];
  if (PORTAL_MODE) parts.push("portal=1");
  if (DEV_MODE) parts.push("dev=1");
  return parts.length ? `?${parts.join("&")}` : "";
}

function openHangarRoute() {
  setState(STATE.HANGAR);
  renderHangar();
}

function syncRouteWithState(next) {
  try {
    const target = routeForUiState(next);
    if (!target) return;
    const current = normalizePath(window.location.pathname);
    const currentSearch = window.location.search || "";
    const nextSearch = buildModeSearch();
    if (current === target && currentSearch === nextSearch) return;
    window.history.replaceState({}, document.title, `${target}${nextSearch}`);
  } catch {
    // ignore history errors
  }
}

function setupFullscreenToggle({ element }) {
  let lastToggleAt = 0;

  const canToggle = () => {
    const now = Date.now();
    if (now - lastToggleAt < 900) return false;
    lastToggleAt = now;
    return true;
  };

  return () => {
    void canToggle;
  };
}

async function toggleFullscreen(element) {
  try {
    if (!document.fullscreenElement) {
      if (element.requestFullscreen) await element.requestFullscreen();
      document.body.classList.add("fullscreen-mode");
      if (screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock("landscape");
        } catch {
          // ignore
        }
      }
    } else {
      await document.exitFullscreen();
      document.body.classList.remove("fullscreen-mode");
    }
  } catch {
    // ignore fullscreen errors
  }
}

let fullscreenCleanup = null;
let fullscreenKeybound = false;

function shouldIgnoreFullscreenHotkey(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

function setFullscreenButtonLabel() {
  const label = document.fullscreenElement ? `Exit ${t("menu.fullscreen")}` : t("menu.fullscreen");
  if (menuFullscreenBtn) menuFullscreenBtn.textContent = label;
  if (sideFullscreenBtn) sideFullscreenBtn.textContent = label;
}

function updateFullscreenButtonVisibility() {
  // Fullscreen controls live in Settings for touch devices; hide legacy menu/side buttons.
  if (menuFullscreenBtn) menuFullscreenBtn.classList.add("hidden");
  if (sideFullscreenBtn) sideFullscreenBtn.classList.add("hidden");
  if (state === STATE.SETTINGS) applySettingsUi();
}

let fsHintTimer = null;
function showFullscreenHint() {
  if (!fsHintEl) return;
  if (document.fullscreenElement) return;
  fsHintEl.classList.remove("hidden");
  if (fsHintTimer) clearTimeout(fsHintTimer);
  fsHintTimer = setTimeout(() => {
    fsHintEl.classList.add("hidden");
  }, 3000);
}

function setState(next) {
  state = next;
  if (REDESIGN_ENABLED && SCREEN_STATE && typeof SCREEN_STATE.apply === "function") {
    SCREEN_STATE.apply({
      nextState: next,
      stateMap: STATE,
      refs: {
        menu: menuEl,
        hangar: hangarEl,
        leaderboard: leaderboardEl,
        campaign: campaignEl,
        online: onlineEl,
        account: accountEl,
        settings: settingsEl,
        upgradePick: upgradePickEl,
        gameover: gameoverEl,
        hud: hudEl,
      },
      body: document.body,
    });
  } else {
    document.body.setAttribute("data-state", next);
    document.body.classList.toggle("hangar-open", next === STATE.HANGAR);

    menuEl.classList.toggle("hidden", next !== STATE.MENU);
    hangarEl.classList.toggle("hidden", next !== STATE.HANGAR);
    leaderboardEl.classList.toggle("hidden", next !== STATE.LEADERBOARD);
    campaignEl.classList.toggle("hidden", next !== STATE.CAMPAIGN);
    onlineEl.classList.toggle("hidden", next !== STATE.ONLINE);
    accountEl.classList.toggle("hidden", next !== STATE.ACCOUNT);
    settingsEl.classList.toggle("hidden", next !== STATE.SETTINGS);
    upgradePickEl.classList.toggle("hidden", next !== STATE.PICK);
    gameoverEl.classList.toggle("hidden", next !== STATE.OVER);
    hudEl.classList.toggle("hidden", next !== STATE.RUN);
  }

  // Auto-pause on any overlay
  setPaused(next !== STATE.RUN);
  if (next !== STATE.RUN && next !== STATE.PICK) {
    game3DReady = false;
    currentGameShipKey = "";
    if (window.ship3D && typeof window.ship3D.resetGameScene === "function") {
      window.ship3D.resetGameScene();
    }
  }
  if (pauseOverlayEl && next !== STATE.RUN) pauseOverlayEl.classList.add("hidden");
  updateTouchControlsVisibility();
  updateRotateOverlay();
  updateGuestSyncBanner();
  updateConsentBannerVisibility();
  if (next === STATE.MENU) {
    claimReadyMissions();
    renderMissionBoard();
    maybeOpenDailyRewardPopup(false);
    openTutorialIfNeeded(false);
  }
  if (next === STATE.SETTINGS) {
    applySettingsUi();
  }
  syncAudioForState(next);
  if (!routeBooting) syncRouteWithState(next);
}

function authPersistUntilMs() {
  try {
    const raw = localStorage.getItem(AUTH_PERSIST_UNTIL_KEY);
    const value = Number(raw || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function rememberAuthWindow(days = AUTH_PERSIST_DAYS) {
  const ttlMs = Math.max(1, Math.floor(Number(days || AUTH_PERSIST_DAYS))) * 24 * 60 * 60 * 1000;
  const until = Date.now() + ttlMs;
  try {
    localStorage.setItem(AUTH_PERSIST_UNTIL_KEY, String(until));
  } catch {
    // ignore localStorage failure
  }
  return until;
}

function clearAuthRememberWindow() {
  try {
    localStorage.removeItem(AUTH_PERSIST_UNTIL_KEY);
  } catch {
    // ignore localStorage failure
  }
}

function authRememberHint() {
  const untilMs = authPersistUntilMs();
  if (!untilMs) return `Saved for at least ${AUTH_PERSIST_DAYS} days`;
  const date = new Date(untilMs);
  return `Saved on this device until ${date.toLocaleDateString()}`;
}

function setTopAuthUi({ signedIn, displayName, photoUrl }) {
  if (PORTAL_MODE) {
    topSignInBtn.classList.add("hidden");
    topAccountBtn.classList.add("hidden");
    topSignOutBtn.classList.add("hidden");
    if (topAuthBadgeEl) topAuthBadgeEl.classList.add("hidden");
    return;
  }
  if (topAuthBadgeEl) topAuthBadgeEl.classList.remove("hidden");
  topSignInBtn.classList.toggle("hidden", signedIn);
  topAccountBtn.classList.toggle("hidden", !signedIn);
  topSignOutBtn.classList.toggle("hidden", !signedIn);

  if (!signedIn) {
    topAvatarImg.classList.add("hidden");
    topAvatarFallback.classList.remove("hidden");
    topAvatarFallback.textContent = "P";
    topAccountBtn.title = t("auth.sign_in");
    if (topAuthBadgeEl) {
      topAuthBadgeEl.textContent = "Guest";
      topAuthBadgeEl.classList.remove("is-signed");
      topAuthBadgeEl.title = "Guest session is temporary. Sign in to keep records.";
    }
    return;
  }

  const initial = String(displayName || SAVE.profile.name || "P").trim().slice(0, 1).toUpperCase() || "P";
  topAvatarFallback.textContent = initial;
  topAccountBtn.title = displayName || SAVE.profile.name || t("auth.account");
  if (topAuthBadgeEl) {
    topAuthBadgeEl.textContent = "Signed In";
    topAuthBadgeEl.classList.add("is-signed");
    topAuthBadgeEl.title = authRememberHint();
  }

  if (photoUrl) {
    topAvatarImg.src = photoUrl;
    topAvatarImg.classList.remove("hidden");
    topAvatarFallback.classList.add("hidden");
  } else {
    topAvatarImg.classList.add("hidden");
    topAvatarFallback.classList.remove("hidden");
  }
}

function isGuestSyncBannerDismissed() {
  try {
    return sessionStorage.getItem(GUEST_SYNC_BANNER_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissGuestSyncBanner() {
  try {
    sessionStorage.setItem(GUEST_SYNC_BANNER_SESSION_KEY, "1");
  } catch {
    // ignore sessionStorage failure
  }
  guestSyncBannerEl.classList.add("hidden");
}

function updateConsentBannerVisibility() {
  if (!consentBannerEl) return;
  consentBannerEl.classList.add("hidden");
}

function updateGuestSyncBanner() {
  guestSyncBannerEl.classList.add("hidden");
}

function setAdProfileGateVisible(visible) {
  if (!adProfileGateEl) return;
  adProfileGateEl.classList.toggle("hidden", !visible);
  document.body.classList.toggle("ad-profile-gated", visible);
}

function renderAccountPanel() {
  cloudInit();

  if (!CLOUD.enabled) {
    accountBoxEl.innerHTML = `<div class="fine">${withDevDetails(t("account.cloud_unavailable"), CLOUD.devStatus)}</div>`;
    accountSyncBtn.disabled = true;
    accountSignOutBtn.disabled = true;
    return;
  }

  if (!CLOUD.user) {
    accountBoxEl.innerHTML = `
      <div class="accountSection">
        <h3>Guest Session</h3>
        <div class="fine">${t("account.guest_mode")}</div>
      </div>
      <div class="accountSection">
        <h3>How Saving Works</h3>
        <div class="fine">Guest records are temporary and reset when this page reloads.</div>
        <div class="fine">Sign in with Google to keep your ships, currency, and leaderboard progress for at least ${AUTH_PERSIST_DAYS} days on this device.</div>
      </div>
    `;
    accountSyncBtn.disabled = true;
    accountSignOutBtn.disabled = true;
    return;
  }

  const safe = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const fmtPct = (value) => `${Math.max(0, Number(value || 0) * 100).toFixed(1)}%`;
  const u = CLOUD.user;
  const ownedShips = SHIPS.filter((s) => ensureShipState(s.id).owned).length;
  const totalShips = SHIPS.length;
  const startedAt = Number(SAVE.profile.startedAt || 0);
  const cloudCreatedAt = u && u.metadata && u.metadata.creationTime ? new Date(u.metadata.creationTime).getTime() : 0;
  const accountStartedAt = startedAt > 0 ? startedAt : cloudCreatedAt;
  const onlineGames = Number(SAVE.profile.onlineGames || 0);
  const onlineWins = Number(SAVE.profile.onlineWins || 0);
  const onlineLosses = Number(SAVE.profile.onlineLosses || 0);
  const onlineWinRate = onlineGames > 0 ? onlineWins / onlineGames : 0;
  const lifetimeGames = Number(SAVE.profile.gamesPlayed || 0);
  const totalWins = Number(SAVE.profile.totalWins || 0);
  const totalLosses = Number(SAVE.profile.totalLosses || 0);
  const lifeWinRate = lifetimeGames > 0 ? totalWins / lifetimeGames : 0;
  const shotsFired = Number(SAVE.profile.totalShotsFired || 0);
  const kills = Number(SAVE.profile.totalKills || 0);
  const killPerShot = shotsFired > 0 ? kills / shotsFired : 0;
  const missionsWon = Number(SAVE.profile.campaignWins || 0);
  const ledgerBefore = {
    claims: Number(SAVE.profile.totalAdsClaimed || 0),
    credits: Number(SAVE.profile.adRewardCreditsTotal || 0),
    crystals: Number(SAVE.profile.adRewardCrystalsTotal || 0),
    xp: Number(SAVE.profile.adRewardXpTotal || 0),
  };
  const adLedger = reconcileAdRewardLedgerIntegrity();
  const ledgerChanged =
    ledgerBefore.claims !== Number(SAVE.profile.totalAdsClaimed || 0) ||
    ledgerBefore.credits !== Number(SAVE.profile.adRewardCreditsTotal || 0) ||
    ledgerBefore.crystals !== Number(SAVE.profile.adRewardCrystalsTotal || 0) ||
    ledgerBefore.xp !== Number(SAVE.profile.adRewardXpTotal || 0);
  if (ledgerChanged) saveNow();
  const adHistory = adLedger.history || [];
  const adTotals = {
    claims: Number(adLedger.claims || 0),
    credits: Number(adLedger.credits || 0),
    crystals: Number(adLedger.crystals || 0),
    xp: Number(adLedger.xp || 0),
  };
  const adBaselineClaims = Number(adLedger.baselineClaims || 0);
  const adClaimTotal = Number(adLedger.totalClaims || 0);
  const adLedgerAligned =
    Number(SAVE.profile.totalAdsClaimed || 0) === adClaimTotal &&
    Number(SAVE.profile.adRewardCreditsTotal || 0) === adTotals.credits &&
    Number(SAVE.profile.adRewardCrystalsTotal || 0) === adTotals.crystals &&
    Number(SAVE.profile.adRewardXpTotal || 0) === adTotals.xp;

  const grid = (items) =>
    `<div class="accountGrid">${items
      .map(
        (it) => `
        <div class="accountItem">
          <div class="accountLabel">${safe(it.label)}</div>
          <div class="accountValue">${it.value}</div>
        </div>`
      )
      .join("")}</div>`;

  const section = (title, items) => `
    <section class="accountSection">
      <h3>${safe(title)}</h3>
      ${grid(items)}
    </section>
  `;

  const identitySection = section("Identity", [
    { label: "Pilot", value: safe((u.displayName || SAVE.profile.name || "Pilot").slice(0, 40)) },
    { label: "Email", value: safe(u.email || "(not available)") },
    { label: "UID", value: `${safe(String(u.uid || "").slice(0, 10))}<small>...</small>` },
    { label: "Local Bubble", value: safe(SAVE.profile.localBubbleName || "Assigning...") },
    { label: "Signed In", value: safe(authRememberHint()) },
    { label: "Account Started", value: safe(formatDateTime(accountStartedAt)) },
    { label: "Last Save Sync", value: safe(formatDateTime(SAVE.profile.updatedAt || 0)) },
  ]);

  const progressionSection = section("Progression", [
    { label: "Level", value: formatInt(levelFromXp(SAVE.profile.xp)) },
    { label: "XP", value: formatInt(SAVE.profile.xp) },
    { label: "Title", value: safe(String(SAVE.profile.selectedTitle || "Cadet")) },
    { label: "Ships Owned", value: `${formatInt(ownedShips)}/${formatInt(totalShips)}` },
    { label: "Campaign Unlocked", value: `Mission ${formatInt(SAVE.profile.campaignUnlocked || 1)}` },
    { label: "Campaign Wins", value: formatInt(missionsWon) },
    { label: "Best Score", value: formatInt(SAVE.profile.bestScore || 0) },
    { label: "Best Wave", value: formatInt(SAVE.profile.bestWave || 1) },
    { label: "Best Survival Kills", value: formatInt(SAVE.profile.bestSurvivalKills || 0) },
  ]);

  const combatSection = section("Combat Record", [
    { label: "Games Played", value: formatInt(lifetimeGames) },
    { label: "Wins / Losses", value: `${formatInt(totalWins)} / ${formatInt(totalLosses)}` },
    { label: "Win Rate", value: fmtPct(lifeWinRate) },
    { label: "Survival Runs", value: formatInt(SAVE.profile.gamesSurvival || 0) },
    { label: "Campaign Runs", value: formatInt(SAVE.profile.gamesCampaign || 0) },
    { label: "Online W/L", value: `${formatInt(onlineWins)} / ${formatInt(onlineLosses)}` },
    { label: "Online Win Rate", value: fmtPct(onlineWinRate) },
    { label: "Total Kills", value: formatInt(kills) },
    { label: "Boss Kills", value: formatInt(SAVE.profile.bossKills || 0) },
    { label: "Shots Fired", value: formatInt(shotsFired) },
    { label: "Kill Per Shot", value: killPerShot > 0 ? killPerShot.toFixed(3) : "0.000" },
    { label: "Total Deaths", value: formatInt(SAVE.profile.totalDeaths || 0) },
    { label: "Play Time", value: safe(formatDurationShort(SAVE.profile.totalRunSeconds || 0)) },
  ]);

  const economySection = section("Economy", [
    { label: "Credits", value: formatInt(SAVE.profile.credits || 0) },
    { label: "Crystals", value: formatInt(SAVE.profile.crystals || 0) },
    { label: "Credits Earned", value: formatInt(SAVE.profile.totalCreditsEarned || 0) },
    { label: "Crystals Earned", value: formatInt(SAVE.profile.totalCrystalsEarned || 0) },
    { label: "XP Earned", value: formatInt(SAVE.profile.totalXpEarned || 0) },
    { label: "Rewarded Claims", value: formatInt(adClaimTotal) },
  ]);
  const adHistoryRows = adHistory.slice(0, 20).map((entry) => {
    const rewardParts = [];
    if (entry.credits > 0) rewardParts.push(`+${formatInt(entry.credits)} credits`);
    if (entry.crystals > 0) rewardParts.push(`+${formatInt(entry.crystals)} crystals`);
    if (entry.xp > 0) rewardParts.push(`+${formatInt(entry.xp)} xp`);
    const rewardText = rewardParts.join(" · ") || "No reward";
    return `
      <div class="adHistoryRow">
        <div class="adHistoryRow__top">
          <strong>${safe(entry.placement || "unknown")}</strong>
          <span>${safe(formatDateTime(entry.at || 0))}</span>
        </div>
        <div class="adHistoryRow__reward">${safe(rewardText)}</div>
      </div>
    `;
  });
  const adHistorySection = `
    <section class="accountSection">
      <h3>Ad Reward History</h3>
      ${grid([
        { label: "History Claims", value: formatInt(adTotals.claims) },
        { label: "Legacy Claims", value: formatInt(adBaselineClaims) },
        { label: "History Credits", value: formatInt(adTotals.credits) },
        { label: "History Crystals", value: formatInt(adTotals.crystals) },
        { label: "History XP", value: formatInt(adTotals.xp) },
        { label: "Ledger Integrity", value: adLedgerAligned ? "OK" : "Mismatch detected" },
      ])}
      <div class="adHistoryList">
        ${adHistoryRows.length ? adHistoryRows.join("") : `<div class="fine">No ad rewards claimed yet.</div>`}
      </div>
    </section>
  `;

  accountBoxEl.innerHTML = identitySection + progressionSection + combatSection + economySection + adHistorySection;
  accountSyncBtn.disabled = false;
  accountSignOutBtn.disabled = false;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  uiEl.style.width = `${rect.width}px`;
  uiEl.style.height = `${rect.height}px`;
  WORLD = { width: rect.width, height: rect.height };
  if (window.ship3D && typeof window.ship3D.resizeGame === "function") {
    window.ship3D.resizeGame(rect.width, rect.height);
  }
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("resize", updateFullscreenButtonVisibility);
window.addEventListener("resize", updateRotateOverlay);
window.addEventListener("resize", applyPhoneHangarPolicy);
resizeCanvas();

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const AIM_TARGETING =
  window.AimTargeting && typeof window.AimTargeting.selectTargetFromTap === "function"
    ? window.AimTargeting
    : {
        selectTargetFromTap(tapPoint, enemies, radius) {
          if (!tapPoint || !Array.isArray(enemies)) return null;
          const r = Math.max(8, Number(radius) || 0);
          let best = null;
          let bestDist = Infinity;
          enemies.forEach((enemy) => {
            if (!enemy || Number(enemy.hp || 0) <= 0) return;
            const dx = Number(enemy.x || 0) - Number(tapPoint.x || 0);
            const dy = Number(enemy.y || 0) - Number(tapPoint.y || 0);
            const dist = Math.hypot(dx, dy);
            if (dist <= r && dist < bestDist) {
              best = enemy;
              bestDist = dist;
            }
          });
          return best;
        },
        updateAimTowardsTarget(currentAim, targetPos, smoothing) {
          if (!currentAim || !targetPos) return Number(currentAim && currentAim.angle) || 0;
          const desired = Math.atan2(
            Number(targetPos.y || 0) - Number(currentAim.y || 0),
            Number(targetPos.x || 0) - Number(currentAim.x || 0)
          );
          const alpha = clamp(Number(smoothing) || 0, 0, 1);
          let delta = desired - Number(currentAim.angle || 0);
          while (delta > Math.PI) delta -= TAU;
          while (delta < -Math.PI) delta += TAU;
          return Number(currentAim.angle || 0) + delta * alpha;
        },
        findNextTarget(enemies, playerPos, aimDir, coneAngle, maxRange) {
          if (!Array.isArray(enemies) || !playerPos || !aimDir) return null;
          const range = Math.max(24, Number(maxRange) || 0);
          const halfCone = Math.max(0.01, Number(coneAngle) || 0) * 0.5;
          let best = null;
          let bestDist = Infinity;
          enemies.forEach((enemy) => {
            if (!enemy || Number(enemy.hp || 0) <= 0) return;
            const dx = Number(enemy.x || 0) - Number(playerPos.x || 0);
            const dy = Number(enemy.y || 0) - Number(playerPos.y || 0);
            const dist = Math.hypot(dx, dy);
            if (!dist || dist > range) return;
            const nx = dx / dist;
            const ny = dy / dist;
            const dot = clamp(nx * Number(aimDir.x || 0) + ny * Number(aimDir.y || 0), -1, 1);
            if (Math.acos(dot) > halfCone) return;
            if (dist < bestDist) {
              best = enemy;
              bestDist = dist;
            }
          });
          return best;
        },
      };

const AIM_TUNING = {
  tapAssistScaleMin: 0.04,
  tapAssistScaleMax: 0.06,
  stickyDurationPve: 5.2,
  stickyDurationPvp: 2.4,
  maxRangePve: 620,
  maxRangePvp: 560,
  autoDuration: 11,
  autoCooldown: 16,
  autoConeAngle: 1.9,
  smoothingMin: 0.16,
  smoothingMax: 0.56,
  autoDamagePenalty: 0.95,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  shooting: false,
  ability: false,
  mouseX: WORLD.width / 2,
  mouseY: WORLD.height / 2,
  pointerDown: false,
};

const keyMap = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "shoot",
  KeyE: "ability",
};

function worldFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WORLD.width;
  const y = ((event.clientY - rect.top) / rect.height) * WORLD.height;
  return { x: clamp(x, 0, WORLD.width), y: clamp(y, 0, WORLD.height) };
}

function aimStrengthNorm() {
  return clamp(Number(SAVE.profile.aimAssistStrength || 0) / 100, 0, 1);
}

function tapAssistEnabled() {
  return Boolean(SAVE.profile.aimTapAssistEnabled);
}

function stickyLockEnabled() {
  return Boolean(SAVE.profile.aimStickyLockEnabled);
}

function applyAimAssistSettingsUI() {
  if (!tapAssistToggle || !stickyLockToggle || !aimAssistStrengthEl || !aimAssistStrengthValueEl) return;
  tapAssistToggle.checked = tapAssistEnabled();
  stickyLockToggle.checked = stickyLockEnabled();
  const val = clamp(Math.floor(Number(SAVE.profile.aimAssistStrength || 0)), 0, 100);
  aimAssistStrengthEl.value = String(val);
  aimAssistStrengthValueEl.textContent = `${val}%`;
}

function aimTapRadius() {
  const scale = lerp(AIM_TUNING.tapAssistScaleMin, AIM_TUNING.tapAssistScaleMax, aimStrengthNorm());
  const base = Math.min(WORLD.width, WORLD.height);
  return clamp(base * scale, 22, 96);
}

function stickyDurationForMode() {
  if (run.mode === MODE.SURVIVAL || run.mode === MODE.CAMPAIGN) return AIM_TUNING.stickyDurationPve;
  return AIM_TUNING.stickyDurationPvp;
}

function stickyMaxRangeForMode() {
  if (run.mode === MODE.SURVIVAL || run.mode === MODE.CAMPAIGN) return AIM_TUNING.maxRangePve;
  return AIM_TUNING.maxRangePvp;
}

function isOnlinePvpMode() {
  return Boolean(run.mode === MODE.DUEL && run.duel && run.duel.kind === "online");
}

function isAutoRelockMode() {
  return run.mode === MODE.SURVIVAL || run.mode === MODE.CAMPAIGN;
}

function validAimEnemies() {
  return entities.enemies.filter(
    (enemy) =>
      enemy &&
      Number(enemy.hp || 0) > 0 &&
      Number.isFinite(Number(enemy.x)) &&
      Number.isFinite(Number(enemy.y))
  );
}

function findAimTargetById(id) {
  if (!id) return null;
  return entities.enemies.find((enemy) => enemy && enemy.id === id && Number(enemy.hp || 0) > 0) || null;
}

function clearAimTarget() {
  if (!run || !run.aim) return;
  run.aim.targetId = "";
  run.aim.lockUntil = 0;
}

function setAimTarget(enemy, { markSelected = true, refreshSticky = true } = {}) {
  if (!enemy || !run || !run.aim) return false;
  run.aim.targetId = String(enemy.id || "");
  if (refreshSticky) run.aim.lockUntil = run.time + stickyDurationForMode();
  if (markSelected) run.aim.selectedOnce = true;
  return true;
}

function selectAimTargetFromTap(worldPoint) {
  if (!run.active || state !== STATE.RUN) return false;
  if (!tapAssistEnabled()) return false;
  const target = AIM_TARGETING.selectTargetFromTap(worldPoint, validAimEnemies(), aimTapRadius());
  if (!target) return false;
  setAimTarget(target, { markSelected: true, refreshSticky: true });
  input.mouseX = Number(target.x || worldPoint.x);
  input.mouseY = Number(target.y || worldPoint.y);
  return true;
}

function smoothAimFactor(dt) {
  const base = lerp(AIM_TUNING.smoothingMin, AIM_TUNING.smoothingMax, aimStrengthNorm());
  const frameScale = clamp((Number(dt) || 0) * 60, 0, 1.2);
  return clamp(base * frameScale, 0.02, 0.95);
}

function isAutoRelockActive() {
  return Boolean(isAutoRelockMode() && run.aim.selectedOnce && run.time < run.aim.autoActiveUntil);
}

function triggerAutoRelock() {
  if (!run.active || state !== STATE.RUN) return;
  if (!isAutoRelockMode() || isOnlinePvpMode()) return;
  if (!stickyLockEnabled()) {
    showToast("Enable Sticky Lock first.");
    return;
  }
  if (!run.aim.selectedOnce) {
    showToast("Tap an enemy once to arm Auto Lock.");
    return;
  }
  if (run.time < run.aim.autoCooldownUntil) {
    const left = Math.max(1, Math.ceil(run.aim.autoCooldownUntil - run.time));
    showToast(`Auto Lock cooldown: ${left}s`);
    return;
  }
  run.aim.autoActiveUntil = run.time + AIM_TUNING.autoDuration;
  run.aim.autoCooldownUntil = run.time + AIM_TUNING.autoCooldown;
  showToast("Auto Lock online.");
}

function updateAutoLockButtonUi() {
  if (!touchAutoLockBtn) return;
  const show = shouldUseTouchControls() && state === STATE.RUN && isAutoRelockMode() && !isOnlinePvpMode();
  touchAutoLockBtn.classList.toggle("hidden", !show);
  if (!show) return;

  const activeRemaining = Math.max(0, run.aim.autoActiveUntil - run.time);
  const cooldownRemaining = Math.max(0, run.aim.autoCooldownUntil - run.time);
  const isActive = activeRemaining > 0;
  const isCoolingDown = !isActive && cooldownRemaining > 0;

  touchAutoLockBtn.classList.toggle("is-ready", !isActive && !isCoolingDown);
  touchAutoLockBtn.classList.toggle("is-active", isActive);

  if (isActive) {
    touchAutoLockBtn.disabled = true;
    touchAutoLockBtn.textContent = `AUTO\n${Math.ceil(activeRemaining)}s`;
    const pct = clamp((activeRemaining / AIM_TUNING.autoDuration) * 100, 0, 100);
    touchAutoLockBtn.style.setProperty("--assist-progress", String(pct));
    return;
  }

  if (isCoolingDown) {
    touchAutoLockBtn.disabled = true;
    touchAutoLockBtn.textContent = `CD\n${Math.ceil(cooldownRemaining)}s`;
    const pct = clamp((cooldownRemaining / AIM_TUNING.autoCooldown) * 100, 0, 100);
    touchAutoLockBtn.style.setProperty("--assist-progress", String(pct));
    return;
  }

  touchAutoLockBtn.disabled = false;
  touchAutoLockBtn.textContent = "AUTO LOCK";
  touchAutoLockBtn.style.setProperty("--assist-progress", "0");
}

window.addEventListener("keydown", (event) => {
  if (shouldIgnoreFullscreenHotkey(event.target)) return;
  if (event.code in keyMap) {
    const action = keyMap[event.code];
    if (action === "shoot") input.shooting = true;
    else if (action === "ability") {
      input.ability = true;
      if (run.active && state === STATE.RUN) triggerShipAbility();
    } else {
      input[action] = true;
    }
    event.preventDefault();
  }

  if (event.code === "Escape" && state === STATE.RUN && run.active) {
    togglePauseOverlay();
    event.preventDefault();
  }

  if (state === STATE.MENU && event.code === "Enter") {
    startRun(MODE.SURVIVAL);
  }
  if (state === STATE.OVER && event.code === "Enter") {
    restartActiveRun();
  }
});

window.addEventListener("keyup", (event) => {
  if (shouldIgnoreFullscreenHotkey(event.target)) return;
  if (event.code in keyMap) {
    const action = keyMap[event.code];
    if (action === "shoot") input.shooting = false;
    else if (action === "ability") input.ability = false;
    else input[action] = false;
    event.preventDefault();
  }
});

canvas.addEventListener("mousemove", (event) => {
  const p = worldFromEvent(event);
  input.mouseX = p.x;
  input.mouseY = p.y;
});

canvas.addEventListener("mousedown", (event) => {
  input.pointerDown = true;
  input.shooting = true;
  const p = worldFromEvent(event);
  input.mouseX = p.x;
  input.mouseY = p.y;
  selectAimTargetFromTap(p);
});

canvas.addEventListener("mouseup", () => {
  input.pointerDown = false;
  input.shooting = false;
});

function bindTouchBtn(el, onDown, onUp) {
  const down = (e) => {
    e.preventDefault();
    onDown();
  };
  const up = (e) => {
    e.preventDefault();
    onUp();
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", up);
}

bindTouchBtn(touchShootBtn, () => (input.shooting = true), () => (input.shooting = false));
if (touchAbilityBtn) {
  bindTouchBtn(
    touchAbilityBtn,
    () => {
      input.ability = true;
      triggerShipAbility();
    },
    () => {
      input.ability = false;
    }
  );
}
if (touchPauseBtn) {
  touchPauseBtn.addEventListener(
    "pointerdown",
    (event) => {
      event.preventDefault();
      togglePauseOverlay();
    },
    { passive: false }
  );
}
if (touchAutoLockBtn) {
  touchAutoLockBtn.addEventListener(
    "pointerdown",
    (event) => {
      event.preventDefault();
      triggerAutoRelock();
      updateAutoLockButtonUi();
    },
    { passive: false }
  );
}

function setupJoystick() {
  if (!joystickBaseEl || !joystickStickEl) return;
  let activeId = null;
  let center = { x: 0, y: 0 };
  let radius = 1;
  const dead = 0.2;

  const resetInput = () => {
    input.up = false;
    input.down = false;
    input.left = false;
    input.right = false;
  };

  const updateStick = (dx, dy) => {
    const max = radius * 0.45;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = len > max;
    const fx = clamped ? (dx / len) * max : dx;
    const fy = clamped ? (dy / len) * max : dy;
    joystickStickEl.style.transform = `translate(${fx}px, ${fy}px)`;

    const nx = fx / max;
    const ny = fy / max;
    input.left = nx < -dead;
    input.right = nx > dead;
    input.up = ny < -dead;
    input.down = ny > dead;
  };

  const onDown = (e) => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    joystickBaseEl.setPointerCapture(activeId);
    const rect = joystickBaseEl.getBoundingClientRect();
    center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    radius = rect.width / 2;
    updateStick(e.clientX - center.x, e.clientY - center.y);
  };

  const onMove = (e) => {
    if (activeId !== e.pointerId) return;
    updateStick(e.clientX - center.x, e.clientY - center.y);
  };

  const onUp = (e) => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    resetInput();
    joystickStickEl.style.transform = "translate(0, 0)";
  };

  joystickBaseEl.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

setupJoystick();

canvas.addEventListener(
  "touchstart",
  (event) => {
    if (!event.changedTouches || event.changedTouches.length === 0) return;
    input.pointerDown = true;
    input.shooting = true;
    const t = event.changedTouches[0];
    const p = worldFromEvent(t);
    input.mouseX = p.x;
    input.mouseY = p.y;
    selectAimTargetFromTap(p);
    event.preventDefault();
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (event) => {
    if (!event.changedTouches || event.changedTouches.length === 0) return;
    const t = event.changedTouches[0];
    const p = worldFromEvent(t);
    input.mouseX = p.x;
    input.mouseY = p.y;
    event.preventDefault();
  },
  { passive: false }
);

canvas.addEventListener("touchend", () => {
  input.pointerDown = false;
  input.shooting = false;
});

// -----------------------------
// Persistent save (local demo)
// -----------------------------

const SAVE_KEY = "stellar_siege_save_v5";
const GUEST_SYNC_BANNER_SESSION_KEY = "stellar_sync_banner_dismissed_session_v1";
const CLOUD_SYNC_CHOICE_PREFIX = "stellar_sync_choice_uid_";
const AUTH_PERSIST_UNTIL_KEY = "stellar_auth_persist_until_v1";
const AUTH_PERSIST_DAYS = 7;
const AD_REWARD_HISTORY_LIMIT = 120;

function defaultSave() {
  return {
    profile: {
      name: `Pilot-${Math.floor(1000 + Math.random() * 9000)}`,
      xp: 0,
      credits: 0,
      crystals: 0,
      // Last known cloud crystal balance (used to prevent client-side "free crystal" increases).
      crystalsShadow: 0,
      bestScore: 0,
      bestWave: 1,
      bestSurvivalKills: null,
      campaignUnlocked: 1,
      selectedShipId: "scout",
      startedAt: nowMs(),
      localBubbleId: "",
      localBubbleName: "",
      gamesPlayed: 0,
      gamesSurvival: 0,
      gamesCampaign: 0,
      onlineGames: 0,
      onlineWins: 0,
      onlineLosses: 0,
      campaignWins: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDeaths: 0,
      totalKills: 0,
      totalShotsFired: 0,
      totalCreditsEarned: 0,
      totalCrystalsEarned: 0,
      totalXpEarned: 0,
      totalAdsClaimed: 0,
      adRewardClaimsBaseline: 0,
      adRewardCreditsTotal: 0,
      adRewardCrystalsTotal: 0,
      adRewardXpTotal: 0,
      adRewardHistory: [],
      bossKills: 0,
      totalRunSeconds: 0,
      adRewardsDay: "",
      adRewardsClaimed: 0,
      adRewardLastAt: 0,
      adIntegrityLastAt: 0,
      adServerClaimsDay: "",
      adServerClaims: 0,
      dailyClaimTimestamp: 0,
      dailyStreakDay: 0,
      missionDayKey: "",
      missionWeekKey: "",
      missionRerollDay: "",
      missionRerollUsed: false,
      aimTapAssistEnabled: shouldUseTouchControls(),
      aimStickyLockEnabled: shouldUseTouchControls(),
      aimAssistStrength: shouldUseTouchControls() ? 78 : 40,
      damageNumbersEnabled: true,
      adaptiveDifficultyEnabled: true,
      fpsLimit: 0,
      language: detectInitialLanguage(),
      musicEnabled: true,
      musicVolume: 46,
      shootSfxEnabled: true,
      destroySfxEnabled: true,
      hapticsEnabled: true,
      tutorialDone: false,
      selectedTitle: "Cadet",
      unlockedTitles: ["Cadet"],
      achievementUnlocks: {},
      abilityUses: {},
      updatedAt: 0,
    },
    ships: {},
    missions: {
      daily: [],
      weekly: [],
    },
    economy: {
      tree: {},
    },
    leaderboard: [],
  };
}

function loadSave() {
  try {
    const parsed = STORAGE ? STORAGE.loadJSON(SAVE_KEY, null) : JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!parsed) return defaultSave();
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile || {}) },
      ships: { ...base.ships, ...(parsed.ships || {}) },
      missions: { ...base.missions, ...(parsed.missions || {}) },
      economy: { ...base.economy, ...(parsed.economy || {}) },
      leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : base.leaderboard,
    };
  } catch {
    return defaultSave();
  }
}

function saveNow() {
  if (progressionRequiresAuth() && !AUTH_RUNTIME.signedIn) return;
  if (STORAGE) {
    STORAGE.saveJSON(SAVE_KEY, SAVE);
    return;
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
  } catch {
    // ignore
  }
}

const SAVE = loadSave();

function removePersistedSaveSnapshot() {
  if (STORAGE && typeof STORAGE.remove === "function") {
    STORAGE.remove(SAVE_KEY);
    return;
  }
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore localStorage failure
  }
}

function resetGuestSessionProgress() {
  const preserved = {
    language: SAVE.profile.language,
    musicEnabled: SAVE.profile.musicEnabled,
    musicVolume: SAVE.profile.musicVolume,
    shootSfxEnabled: SAVE.profile.shootSfxEnabled,
    destroySfxEnabled: SAVE.profile.destroySfxEnabled,
    hapticsEnabled: SAVE.profile.hapticsEnabled,
    damageNumbersEnabled: SAVE.profile.damageNumbersEnabled,
    adaptiveDifficultyEnabled: SAVE.profile.adaptiveDifficultyEnabled,
    fpsLimit: SAVE.profile.fpsLimit,
    aimTapAssistEnabled: SAVE.profile.aimTapAssistEnabled,
    aimStickyLockEnabled: SAVE.profile.aimStickyLockEnabled,
    aimAssistStrength: SAVE.profile.aimAssistStrength,
  };
  const fresh = defaultSave();
  fresh.profile = {
    ...fresh.profile,
    ...preserved,
  };
  Object.keys(SAVE).forEach((key) => delete SAVE[key]);
  Object.assign(SAVE, fresh);
  migrateSave();
  applyAimAssistSettingsUI();
  applySettingsUi();
  applyLanguageToUi();
  applyAudioMix();
  updateTopBar();
}

const SHIPS = [
  {
    id: "scout",
    name: "Scout",
    rarity: "Free",
    priceCredits: 0,
    priceCrystals: 0,
    base: {
      speed: 290,
      bulletSpeed: 560,
      damage: 1.0,
      fireRate: 0.145,
      shieldMax: 95,
      shieldRegen: 3.2,
      hullMax: 95,
      pierce: 0,
      droneCount: 0,
    },
  },
  {
    id: "striker",
    name: "Striker",
    rarity: "Common",
    priceCredits: 4200,
    priceCrystals: 0,
    base: {
      speed: 304,
      bulletSpeed: 610,
      damage: 1.1,
      fireRate: 0.138,
      shieldMax: 100,
      shieldRegen: 3.4,
      hullMax: 102,
      pierce: 0,
      droneCount: 0,
    },
  },
  {
    id: "tank",
    name: "Tank",
    rarity: "Common",
    priceCredits: 6800,
    priceCrystals: 0,
    base: {
      speed: 262,
      bulletSpeed: 560,
      damage: 1.2,
      fireRate: 0.152,
      shieldMax: 148,
      shieldRegen: 4.2,
      hullMax: 152,
      pierce: 0,
      droneCount: 0,
    },
  },
  {
    id: "sniper",
    name: "Sniper",
    rarity: "Earned",
    priceCredits: 13200,
    priceCrystals: 0,
    base: {
      speed: 286,
      bulletSpeed: 720,
      damage: 1.34,
      fireRate: 0.165,
      shieldMax: 92,
      shieldRegen: 2.9,
      hullMax: 98,
      pierce: 2,
      droneCount: 0,
    },
  },
  {
    id: "bomber",
    name: "Bomber",
    rarity: "Earned",
    priceCredits: 19500,
    priceCrystals: 55,
    base: {
      speed: 272,
      bulletSpeed: 590,
      damage: 1.48,
      fireRate: 0.176,
      shieldMax: 116,
      shieldRegen: 3.1,
      hullMax: 124,
      pierce: 1,
      droneCount: 0,
    },
  },
  {
    id: "interceptor",
    name: "Ranger",
    rarity: "Earned",
    priceCredits: 28500,
    priceCrystals: 0,
    base: {
      speed: 340,
      bulletSpeed: 650,
      damage: 1.12,
      fireRate: 0.118,
      shieldMax: 98,
      shieldRegen: 3.1,
      hullMax: 102,
      pierce: 0,
      droneCount: 0,
    },
  },
  {
    id: "drone_carrier",
    name: "Astra",
    rarity: "Rare",
    priceCredits: 41000,
    priceCrystals: 110,
    base: {
      speed: 282,
      bulletSpeed: 610,
      damage: 1.15,
      fireRate: 0.144,
      shieldMax: 118,
      shieldRegen: 3.8,
      hullMax: 126,
      pierce: 1,
      droneCount: 1,
    },
  },
  {
    id: "stealth",
    name: "Stealth",
    rarity: "Rare",
    priceCredits: 62000,
    priceCrystals: 165,
    base: {
      speed: 326,
      bulletSpeed: 680,
      damage: 1.28,
      fireRate: 0.128,
      shieldMax: 108,
      shieldRegen: 3.3,
      hullMax: 106,
      pierce: 1,
      droneCount: 0,
    },
  },
  {
    id: "warden",
    name: "Warden",
    rarity: "Epic",
    priceCredits: 98000,
    priceCrystals: 220,
    base: {
      speed: 296,
      bulletSpeed: 660,
      damage: 1.45,
      fireRate: 0.12,
      shieldMax: 156,
      shieldRegen: 4.6,
      hullMax: 162,
      pierce: 1,
      droneCount: 0,
    },
  },
  {
    id: "valkyrie",
    name: "Valkyrie",
    rarity: "Legendary",
    priceCredits: 0,
    priceCrystals: 390,
    base: {
      speed: 334,
      bulletSpeed: 730,
      damage: 1.58,
      fireRate: 0.108,
      shieldMax: 145,
      shieldRegen: 4.4,
      hullMax: 148,
      pierce: 2,
      droneCount: 1,
    },
  },
  {
    id: "nova_revenant",
    name: "Nova Revenant",
    rarity: "Mythic",
    priceCredits: 190000,
    priceCrystals: 760,
    base: {
      speed: 332,
      bulletSpeed: 760,
      damage: 1.72,
      fireRate: 0.102,
      shieldMax: 168,
      shieldRegen: 4.8,
      hullMax: 172,
      pierce: 2,
      droneCount: 2,
    },
  },
];

const SHIP_STYLES = {
  scout: { main: "#1de2c4", accent: "#0ea5e9" },
  striker: { main: "#60a5fa", accent: "#93c5fd" },
  tank: { main: "#f59e0b", accent: "#fde68a" },
  sniper: { main: "#f97316", accent: "#fb923c" },
  bomber: { main: "#f43f5e", accent: "#fb7185" },
  interceptor: { main: "#22d3ee", accent: "#67e8f9" },
  drone_carrier: { main: "#8b5cf6", accent: "#c4b5fd" },
  stealth: { main: "#64748b", accent: "#e2e8f0" },
  warden: { main: "#84cc16", accent: "#bef264" },
  valkyrie: { main: "#fb923c", accent: "#fdba74" },
  nova_revenant: { main: "#e879f9", accent: "#f0abfc" },
};

const ACCOUNT_TREE_NODES = [
  {
    key: "offense_core",
    branch: "Offense",
    name: "Ballistic Doctrine",
    desc: "Flat damage increase for all ships.",
    max: 5,
    cost(rank) {
      return 1400 + rank * 1100;
    },
  },
  {
    key: "offense_crit",
    branch: "Offense",
    name: "Critical Matrix",
    desc: "Small chance to deal heavy hit damage.",
    max: 5,
    cost(rank) {
      return 2200 + rank * 1400;
    },
  },
  {
    key: "offense_cadence",
    branch: "Offense",
    name: "Rapid Relay",
    desc: "Global fire-rate bonus.",
    max: 5,
    cost(rank) {
      return 2000 + rank * 1300;
    },
  },
  {
    key: "defense_shield",
    branch: "Defense",
    name: "Shield Mesh",
    desc: "Raise max shield.",
    max: 5,
    cost(rank) {
      return 1500 + rank * 1200;
    },
  },
  {
    key: "defense_hull",
    branch: "Defense",
    name: "Hull Plating",
    desc: "Raise max hull.",
    max: 5,
    cost(rank) {
      return 1500 + rank * 1200;
    },
  },
  {
    key: "defense_regen",
    branch: "Defense",
    name: "Recovery Lattice",
    desc: "Improve shield regeneration.",
    max: 5,
    cost(rank) {
      return 1900 + rank * 1300;
    },
  },
  {
    key: "utility_speed",
    branch: "Utility",
    name: "Impulse Control",
    desc: "Increase ship speed.",
    max: 5,
    cost(rank) {
      return 1350 + rank * 1050;
    },
  },
  {
    key: "utility_loot",
    branch: "Utility",
    name: "Salvage Protocol",
    desc: "Extra credits from runs.",
    max: 5,
    cost(rank) {
      return 1800 + rank * 1250;
    },
  },
  {
    key: "utility_cooldown",
    branch: "Utility",
    name: "Ability Reactor",
    desc: "Reduce ship ability cooldowns.",
    max: 5,
    cost(rank) {
      return 2400 + rank * 1400;
    },
  },
];

function defaultAccountTree() {
  const tree = {};
  ACCOUNT_TREE_NODES.forEach((node) => {
    tree[node.key] = 0;
  });
  return tree;
}

function ensureAccountTreeState() {
  if (!SAVE.economy || typeof SAVE.economy !== "object") SAVE.economy = { tree: defaultAccountTree() };
  if (!SAVE.economy.tree || typeof SAVE.economy.tree !== "object") SAVE.economy.tree = defaultAccountTree();
  const base = defaultAccountTree();
  SAVE.economy.tree = { ...base, ...SAVE.economy.tree };
  return SAVE.economy.tree;
}

function accountTreeRank(key) {
  const tree = ensureAccountTreeState();
  return Math.max(0, Math.floor(Number(tree[key] || 0)));
}

function accountTreeTotalRanks() {
  const tree = ensureAccountTreeState();
  return Object.values(tree).reduce((sum, rank) => sum + Math.max(0, Math.floor(Number(rank || 0))), 0);
}

function accountTreeBonuses() {
  return {
    damage: accountTreeRank("offense_core") * 0.09,
    critChance: accountTreeRank("offense_crit") * 0.02,
    fireRateMult: 1 - accountTreeRank("offense_cadence") * 0.03,
    shield: accountTreeRank("defense_shield") * 10,
    hull: accountTreeRank("defense_hull") * 10,
    regen: accountTreeRank("defense_regen") * 0.4,
    speed: accountTreeRank("utility_speed") * 8,
    creditsMult: 1 + accountTreeRank("utility_loot") * 0.035,
    abilityCooldownMult: 1 - accountTreeRank("utility_cooldown") * 0.04,
  };
}

const ACHIEVEMENTS = [
  { id: "survivor_1", name: "First Contact", desc: "Finish one Survival run." },
  { id: "survivor_10", name: "Wave Rider", desc: "Reach wave 10 in Survival." },
  { id: "survivor_20", name: "No Retreat", desc: "Reach wave 20 in Survival." },
  { id: "survivor_35", name: "Deep Void", desc: "Reach wave 35 in Survival." },
  { id: "kills_500", name: "Scrap Engineer", desc: "Defeat 500 enemies total." },
  { id: "kills_2000", name: "Warpath", desc: "Defeat 2,000 enemies total." },
  { id: "credits_50k", name: "Treasurer", desc: "Earn 50,000 credits lifetime." },
  { id: "campaign_3", name: "Mission Runner", desc: "Unlock campaign mission 3." },
  { id: "campaign_6", name: "Frontier Officer", desc: "Unlock campaign mission 6." },
  { id: "campaign_12", name: "Campaign Legend", desc: "Unlock campaign mission 12." },
  { id: "duel_win_1", name: "First Duel Win", desc: "Win one online duel." },
  { id: "duel_win_25", name: "Arena Veteran", desc: "Win 25 online duels." },
  { id: "ability_10", name: "Power Trigger", desc: "Use ship abilities 10 times." },
  { id: "ability_100", name: "Ability Master", desc: "Use ship abilities 100 times." },
  { id: "daily_7", name: "Habit Formed", desc: "Reach daily streak day 7." },
  { id: "ships_5", name: "Collector I", desc: "Own 5 ships." },
  { id: "ships_10", name: "Collector II", desc: "Own 10 ships." },
  { id: "tree_10", name: "Commander Path", desc: "Buy 10 command tree upgrades." },
  { id: "tree_25", name: "Fleet Architect", desc: "Buy 25 command tree upgrades." },
  { id: "boss_15", name: "Boss Breaker", desc: "Defeat 15 bosses." },
];

const ACHIEVEMENT_TITLES = {
  survivor_20: "Vanguard",
  campaign_12: "Commander",
  duel_win_25: "Duelist",
  ability_100: "Arcanist",
  tree_25: "Strategist",
};

function shipById(id) {
  return SHIPS.find((s) => s.id === id) || SHIPS[0];
}

const SHIP_ABILITIES = {
  scout: {
    key: "dash",
    name: "Dash",
    cooldown: 12,
    description: "Quick burst with brief invulnerability.",
  },
  striker: {
    key: "overdrive",
    name: "Overdrive",
    cooldown: 22,
    description: "Fire-rate boost for 6s.",
  },
  interceptor: {
    key: "rail_shot",
    name: "Rail Shot",
    cooldown: 16,
    description: "Piercing high-damage shot.",
  },
  drone_carrier: {
    key: "drone_swarm",
    name: "Drone Swarm",
    cooldown: 30,
    description: "Summon helper drones for 12s.",
  },
  warden: {
    key: "fortress",
    name: "Fortress",
    cooldown: 28,
    description: "Temporary shield wall + knockback aura.",
  },
  valkyrie: {
    key: "heal_pulse",
    name: "Heal Pulse",
    cooldown: 32,
    maxUses: 3,
    description: "Restore hull and shield (limited uses).",
  },
};

function abilityForShip(shipId) {
  return SHIP_ABILITIES[shipId] || {
    key: "overdrive",
    name: "Overdrive",
    cooldown: 24,
    description: "Temporary combat boost.",
  };
}

function shipSvg(shipId, tier) {
  const palettes = {
    scout: ["#1de2c4", "#6ee7b7", "#0ea5e9"],
    striker: ["#60a5fa", "#93c5fd", "#38bdf8"],
    tank: ["#f59e0b", "#fde68a", "#f97316"],
    sniper: ["#f97316", "#fb923c", "#fdba74"],
    bomber: ["#f43f5e", "#fb7185", "#e11d48"],
    interceptor: ["#22d3ee", "#67e8f9", "#0891b2"],
    drone_carrier: ["#8b5cf6", "#c4b5fd", "#6d28d9"],
    stealth: ["#64748b", "#e2e8f0", "#334155"],
    warden: ["#84cc16", "#bef264", "#65a30d"],
    valkyrie: ["#fb923c", "#fdba74", "#ea580c"],
    nova_revenant: ["#e879f9", "#f0abfc", "#a21caf"],
  };
  const colors = palettes[shipId] || ["#1de2c4", "#6ee7b7", "#0ea5e9"];
  const c1 = colors[0];
  const c2 = colors[1];
  const c3 = colors[2];
  const wing = tier === 0 ? 26 : tier === 1 ? 32 : 38;
  const fin = tier === 2 ? 8 : tier === 1 ? 6 : 4;
  return `
    <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c3}"/>
        </linearGradient>
      </defs>
      <polygon points="60,8 92,38 60,70 28,38" fill="url(#g)" opacity="0.95"/>
      <polygon points="60,16 ${60+wing},40 60,64 ${60-wing},40" fill="${c2}" opacity="0.8"/>
      <polygon points="60,20 ${60+fin},36 60,60 ${60-fin},36" fill="#0b0f1f" opacity="0.55"/>
      <circle cx="60" cy="40" r="${6 + tier * 1.5}" fill="#fff" opacity="0.9"/>
    </svg>
  `;
}

function upgradeTier(upgrades) {
  const totalMax = PERM_UPGRADES.reduce((sum, u) => sum + u.max, 0);
  const total = PERM_UPGRADES.reduce((sum, u) => sum + (upgrades[u.key] || 0), 0);
  const ratio = totalMax ? total / totalMax : 0;
  if (ratio >= 0.66) return 2;
  if (ratio >= 0.33) return 1;
  return 0;
}

function maxUpgrades() {
  const out = {};
  PERM_UPGRADES.forEach((u) => (out[u.key] = u.max));
  return out;
}

function statBars(stats) {
  const cap = {
    speed: 380,
    damage: 2.0,
    fireRate: 0.08,
    shieldMax: 180,
    hullMax: 180,
  };
  return [
    { label: "Speed", value: Math.min(1, stats.speed / cap.speed) },
    { label: "Damage", value: Math.min(1, stats.damage / cap.damage) },
    { label: "Fire Rate", value: Math.min(1, cap.fireRate / stats.fireRate) },
    { label: "Shield", value: Math.min(1, stats.shieldMax / cap.shieldMax) },
    { label: "Hull", value: Math.min(1, stats.hullMax / cap.hullMax) },
  ];
}

function defaultShipUpgrades() {
  return {
    damage: 0,
    fireRate: 0,
    bulletSpeed: 0,
    shieldMax: 0,
    shieldRegen: 0,
    hullMax: 0,
    thrusters: 0,
    pierce: 0,
    drone: 0,
    elite: 0, // crystal-only multiplier
  };
}

function ensureShipState(shipId) {
  if (!SAVE.ships) SAVE.ships = {};
  if (!SAVE.ships[shipId]) {
    SAVE.ships[shipId] = { owned: false, upgrades: defaultShipUpgrades() };
  } else {
    SAVE.ships[shipId].upgrades = { ...defaultShipUpgrades(), ...(SAVE.ships[shipId].upgrades || {}) };
    if (typeof SAVE.ships[shipId].owned !== "boolean") SAVE.ships[shipId].owned = false;
  }
  return SAVE.ships[shipId];
}

function sanitizeAdRewardHistoryEntry(entry, index = 0) {
  if (!entry || typeof entry !== "object") return null;
  const atRaw = Number(entry.at || entry.timestamp || 0);
  const at = Number.isFinite(atRaw) && atRaw > 0 ? Math.floor(atRaw) : 0;
  const credits = Math.max(0, Math.floor(Number(entry.credits || 0)));
  const crystals = Math.max(0, Math.floor(Number(entry.crystals || 0)));
  const xp = Math.max(0, Math.floor(Number(entry.xp || 0)));
  if (credits <= 0 && crystals <= 0 && xp <= 0) return null;
  const placement = String(entry.placement || "unknown").trim().slice(0, 64) || "unknown";
  const idRaw = String(entry.id || "").trim();
  const id = (idRaw || `ad_${at || Date.now()}_${index}_${credits}_${crystals}_${xp}`).slice(0, 80);
  return {
    id,
    at,
    placement,
    credits,
    crystals,
    xp,
  };
}

function normalizeAdRewardHistoryList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  list.forEach((entry, index) => {
    const clean = sanitizeAdRewardHistoryEntry(entry, index);
    if (!clean) return;
    const key = clean.id || `${clean.at}_${clean.placement}_${clean.credits}_${clean.crystals}_${clean.xp}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  });
  out.sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
  if (out.length > AD_REWARD_HISTORY_LIMIT) out.length = AD_REWARD_HISTORY_LIMIT;
  return out;
}

function adRewardHistoryTotals(list) {
  const history = Array.isArray(list) ? list : [];
  return history.reduce(
    (acc, entry) => {
      acc.claims += 1;
      acc.credits += Math.max(0, Math.floor(Number(entry.credits || 0)));
      acc.crystals += Math.max(0, Math.floor(Number(entry.crystals || 0)));
      acc.xp += Math.max(0, Math.floor(Number(entry.xp || 0)));
      return acc;
    },
    { claims: 0, credits: 0, crystals: 0, xp: 0 }
  );
}

function mergeAdRewardHistoryLists(localList, remoteList) {
  const local = normalizeAdRewardHistoryList(localList || []);
  const remote = normalizeAdRewardHistoryList(remoteList || []);
  return normalizeAdRewardHistoryList([...local, ...remote]);
}

function reconcileAdRewardLedgerIntegrity() {
  const profile = SAVE.profile || {};
  const currentClaims = Math.max(0, Math.floor(Number(profile.totalAdsClaimed || 0)));
  let baseline = Math.max(0, Math.floor(Number(profile.adRewardClaimsBaseline || 0)));
  const normalized = normalizeAdRewardHistoryList(profile.adRewardHistory || []);
  const totals = adRewardHistoryTotals(normalized);

  // Preserve historical claim count from pre-ledger builds.
  if (baseline <= 0 && normalized.length === 0 && currentClaims > 0) baseline = currentClaims;
  if (baseline + totals.claims < currentClaims) baseline = currentClaims - totals.claims;

  profile.adRewardHistory = normalized;
  profile.adRewardClaimsBaseline = baseline;
  profile.adRewardCreditsTotal = totals.credits;
  profile.adRewardCrystalsTotal = totals.crystals;
  profile.adRewardXpTotal = totals.xp;
  profile.totalAdsClaimed = baseline + totals.claims;
  SAVE.profile = profile;

  return {
    ...totals,
    baselineClaims: baseline,
    totalClaims: baseline + totals.claims,
    history: normalized,
  };
}

function appendAdRewardHistoryEntry({ placement, credits, crystals, xp }) {
  const entry = sanitizeAdRewardHistoryEntry(
    {
      id: `ad_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      at: Date.now(),
      placement,
      credits,
      crystals,
      xp,
    },
    0
  );
  if (!entry) return null;
  const profile = SAVE.profile || {};
  const merged = normalizeAdRewardHistoryList([entry, ...(Array.isArray(profile.adRewardHistory) ? profile.adRewardHistory : [])]);
  profile.adRewardHistory = merged;
  SAVE.profile = profile;
  reconcileAdRewardLedgerIntegrity();
  return entry;
}

function migrateSave() {
  // Older versions used `SAVE.upgrades` globally. Move them onto the Scout ship.
  if (SAVE.upgrades && typeof SAVE.upgrades === "object") {
    ensureShipState("scout");
    SAVE.ships.scout.upgrades = { ...defaultShipUpgrades(), ...SAVE.upgrades };
    delete SAVE.upgrades;
  }

  ensureShipState("scout");
  SAVE.ships.scout.owned = true;

  // Make sure every ship has a state object (owned or not).
  SHIPS.forEach((s) => ensureShipState(s.id));

  // Fix selected ship
  const legacyShipMap = {
    ranger: "interceptor",
    astra: "drone_carrier",
  };
  const selected = SAVE.profile && SAVE.profile.selectedShipId ? SAVE.profile.selectedShipId : "scout";
  const mapped = legacyShipMap[selected] || selected;
  const exists = SHIPS.some((s) => s.id === mapped);
  SAVE.profile.selectedShipId = exists ? mapped : "scout";

  if (!SAVE.profile.updatedAt) SAVE.profile.updatedAt = 0;
  if (!Number.isFinite(Number(SAVE.profile.startedAt)) || Number(SAVE.profile.startedAt) <= 0) {
    SAVE.profile.startedAt = nowMs();
  }
  if (typeof SAVE.profile.localBubbleId !== "string") SAVE.profile.localBubbleId = "";
  if (typeof SAVE.profile.localBubbleName !== "string") SAVE.profile.localBubbleName = "";
  if (!Number.isFinite(Number(SAVE.profile.crystalsShadow))) SAVE.profile.crystalsShadow = SAVE.profile.crystals || 0;
  const statKeys = [
    "gamesPlayed",
    "gamesSurvival",
    "gamesCampaign",
    "onlineGames",
    "onlineWins",
    "onlineLosses",
    "campaignWins",
    "totalWins",
    "totalLosses",
    "totalDeaths",
    "totalKills",
    "totalShotsFired",
    "totalCreditsEarned",
    "totalCrystalsEarned",
    "totalXpEarned",
    "totalAdsClaimed",
    "adRewardClaimsBaseline",
    "adRewardCreditsTotal",
    "adRewardCrystalsTotal",
    "adRewardXpTotal",
    "bossKills",
    "totalRunSeconds",
    "adRewardsClaimed",
  ];
  statKeys.forEach((key) => {
    const value = Number(SAVE.profile[key] || 0);
    SAVE.profile[key] = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  });
  if (!Number.isFinite(Number(SAVE.profile.adRewardLastAt))) SAVE.profile.adRewardLastAt = 0;
  if (!Number.isFinite(Number(SAVE.profile.adIntegrityLastAt))) SAVE.profile.adIntegrityLastAt = 0;
  if (typeof SAVE.profile.adRewardsDay !== "string") SAVE.profile.adRewardsDay = "";
  if (SAVE.profile.bestSurvivalKills == null || SAVE.profile.bestSurvivalKills === "") {
    SAVE.profile.bestSurvivalKills = null;
  } else {
    const bestKills = Number(SAVE.profile.bestSurvivalKills);
    SAVE.profile.bestSurvivalKills = Number.isFinite(bestKills) && bestKills >= 0 ? Math.floor(bestKills) : null;
  }
  if (!Number.isFinite(Number(SAVE.profile.dailyClaimTimestamp))) SAVE.profile.dailyClaimTimestamp = 0;
  if (!Number.isFinite(Number(SAVE.profile.dailyStreakDay))) SAVE.profile.dailyStreakDay = 0;
  if (typeof SAVE.profile.missionDayKey !== "string") SAVE.profile.missionDayKey = "";
  if (typeof SAVE.profile.missionWeekKey !== "string") SAVE.profile.missionWeekKey = "";
  if (typeof SAVE.profile.missionRerollDay !== "string") SAVE.profile.missionRerollDay = "";
  if (typeof SAVE.profile.missionRerollUsed !== "boolean") SAVE.profile.missionRerollUsed = false;
  if (typeof SAVE.profile.aimTapAssistEnabled !== "boolean") SAVE.profile.aimTapAssistEnabled = shouldUseTouchControls();
  if (typeof SAVE.profile.aimStickyLockEnabled !== "boolean") SAVE.profile.aimStickyLockEnabled = shouldUseTouchControls();
  if (!Number.isFinite(Number(SAVE.profile.aimAssistStrength))) {
    SAVE.profile.aimAssistStrength = shouldUseTouchControls() ? 78 : 40;
  }
  SAVE.profile.aimAssistStrength = clamp(Math.floor(Number(SAVE.profile.aimAssistStrength || 0)), 0, 100);
  if (typeof SAVE.profile.damageNumbersEnabled !== "boolean") SAVE.profile.damageNumbersEnabled = true;
  if (typeof SAVE.profile.adaptiveDifficultyEnabled !== "boolean") SAVE.profile.adaptiveDifficultyEnabled = true;
  if (!Number.isFinite(Number(SAVE.profile.fpsLimit))) SAVE.profile.fpsLimit = 0;
  SAVE.profile.fpsLimit = Math.max(0, Math.min(60, Math.floor(Number(SAVE.profile.fpsLimit || 0))));
  SAVE.profile.language = normalizeLanguageCode(SAVE.profile.language || detectInitialLanguage());
  if (typeof SAVE.profile.musicEnabled !== "boolean") SAVE.profile.musicEnabled = true;
  if (!Number.isFinite(Number(SAVE.profile.musicVolume))) SAVE.profile.musicVolume = 46;
  SAVE.profile.musicVolume = clamp(Math.floor(Number(SAVE.profile.musicVolume || 0)), 0, 100);
  if (typeof SAVE.profile.shootSfxEnabled !== "boolean") SAVE.profile.shootSfxEnabled = true;
  if (typeof SAVE.profile.destroySfxEnabled !== "boolean") SAVE.profile.destroySfxEnabled = true;
  if (typeof SAVE.profile.hapticsEnabled !== "boolean") SAVE.profile.hapticsEnabled = true;
  if (typeof SAVE.profile.tutorialDone !== "boolean") SAVE.profile.tutorialDone = false;
  if (typeof SAVE.profile.selectedTitle !== "string") SAVE.profile.selectedTitle = "Cadet";
  if (!Array.isArray(SAVE.profile.unlockedTitles) || SAVE.profile.unlockedTitles.length === 0) {
    SAVE.profile.unlockedTitles = ["Cadet"];
  } else if (!SAVE.profile.unlockedTitles.includes("Cadet")) {
    SAVE.profile.unlockedTitles.unshift("Cadet");
  }
  if (!SAVE.profile.achievementUnlocks || typeof SAVE.profile.achievementUnlocks !== "object") {
    SAVE.profile.achievementUnlocks = {};
  }
  if (!SAVE.profile.abilityUses || typeof SAVE.profile.abilityUses !== "object") {
    SAVE.profile.abilityUses = {};
  }
  if (typeof SAVE.profile.adServerClaimsDay !== "string") SAVE.profile.adServerClaimsDay = "";
  if (!Number.isFinite(Number(SAVE.profile.adServerClaims))) SAVE.profile.adServerClaims = 0;
  if (!Array.isArray(SAVE.profile.adRewardHistory)) SAVE.profile.adRewardHistory = [];
  reconcileAdRewardLedgerIntegrity();
  if (!SAVE.missions || typeof SAVE.missions !== "object") SAVE.missions = { daily: [], weekly: [] };
  if (!Array.isArray(SAVE.missions.daily)) SAVE.missions.daily = [];
  if (!Array.isArray(SAVE.missions.weekly)) SAVE.missions.weekly = [];
  ensureAccountTreeState();
  saveNow();
}

migrateSave();
applyAimAssistSettingsUI();

const I18N_MESSAGES = {
  en: {
    "menu.play_survival": "Play Now (Survival)",
    "menu.continue_campaign": "Continue Campaign",
    "menu.hangar": "Hangar & Upgrades",
    "menu.online_beta": "Online Duel (Beta)",
    "menu.online_coming": "Online Duel (Coming Soon)",
    "menu.leaderboard": "Leaderboard",
    "menu.game_info": "Game Info",
    "menu.settings": "Settings",
    "menu.fullscreen": "Fullscreen",
    "menu.controls_hint": "WASD / Arrows to move - Mouse to aim - Click or Space to shoot",
    "settings.title": "Settings",
    "settings.back": "Back",
    "settings.audio_title": "Audio & Feedback",
    "settings.music_enabled": "Menu Music",
    "settings.music_volume": "Music Loudness",
    "settings.shoot_sfx": "Shooting Sound",
    "settings.destroy_sfx": "Ship Destroyed Sound",
    "settings.haptics": "Haptic Feedback",
    "settings.fullscreen": "Fullscreen",
    "settings.next_track": "Next Menu Track",
    "settings.track_current": "Current track: {{name}}",
    "settings.language_title": "Language",
    "settings.language_label": "Select Language",
    "settings.language_hint": "English, Uzbek, Russian, and Turkish are fully localized. Other languages may be partial.",
    "settings.ads_title": "Ad Privacy",
    "settings.ads_hint": "Choose your ad setting. You can continue with personalized or non-personalized ads.",
    "settings.ads_personalized": "Personalized Ads",
    "settings.ads_nonpersonalized": "Non-personalized Ads",
    "settings.ads_current": "Current:",
    "brand.subtitle": "Roguelite Arena",
    "auth.sign_in": "Sign in",
    "auth.sign_out": "Sign out",
    "auth.account": "Account",
    "menu.sync_banner": "Sign in to sync progress + submit global leaderboard.",
    "menu.sync_dismiss": "Dismiss sync banner",
    "menu.tip_collect": "Tip: Collect upgrade orbs mid-run. Spend Credits/Crystals in the Hangar.",
    "menu.tip_progress_local": "Tip: Progress saves locally on this device.",
    "menu.privacy": "Privacy",
    "menu.terms": "Terms",
    "missions.daily": "Daily Missions",
    "missions.weekly": "Weekly Missions",
    "missions.status.claimed": "Claimed",
    "missions.status.ready": "Ready to claim",
    "missions.status.progress": "In progress",
    "missions.toast_rewards": "Mission rewards:",
    "missions.unit.credits": "credits",
    "missions.unit.crystals": "crystals",
    "missions.title.daily_survive_5m": "Survive 5 minutes",
    "missions.title.daily_kills_200": "Defeat 200 enemies",
    "missions.title.daily_wave_15": "Reach wave 15",
    "missions.title.weekly_kills_1200": "Defeat 1200 enemies",
    "missions.title.weekly_survive_45m": "Survive 45 minutes total",
    "missions.title.weekly_wave_25": "Reach wave 25",
    "account.cloud_unavailable": "Cloud sync is currently unavailable.",
    "account.guest_mode": "You are in guest mode. Sign in to sync progress across devices.",
    "daily.title": "Daily Reward",
    "daily.claim": "Claim Reward",
    "daily.double": "Double Reward (Watch Ad)",
    "daily.later": "Later",
    "daily.day": "Day {{day}}",
    "daily.summary_reset": "Daily streak reset. Claim Day 1 now.",
    "daily.summary_claim": "Daily streak day {{day}}. Claim your reward now.",
    "daily.summary_done": "Reward already claimed today. Come back tomorrow.",
    "daily.toast_claimed": "Daily reward claimed:",
  },
  uz: {
    "menu.play_survival": "Hozir O'ynash (Yashab Qolish)",
    "menu.continue_campaign": "Kampaniyani Davom Ettirish",
    "menu.hangar": "Angar va Yangilanishlar",
    "menu.online_beta": "Onlayn Duel (Beta)",
    "menu.online_coming": "Onlayn Duel (Tez kunda)",
    "menu.leaderboard": "Reyting",
    "menu.game_info": "O'yin Ma'lumoti",
    "menu.settings": "Sozlamalar",
    "menu.fullscreen": "To'liq Ekran",
    "menu.controls_hint": "Harakat: WASD/Yo'naltirgich - Nishon: Sichqoncha - O'q uzish: Bosish yoki Space",
    "settings.title": "Sozlamalar",
    "settings.back": "Orqaga",
    "settings.audio_title": "Ovoz va Teskari Aloqa",
    "settings.music_enabled": "Menyu Musiqasi",
    "settings.music_volume": "Musiqa Balandligi",
    "settings.shoot_sfx": "Otish Ovozi",
    "settings.destroy_sfx": "Kema Portlash Ovozi",
    "settings.haptics": "Haptik Teskari Aloqa",
    "settings.fullscreen": "To'liq Ekran",
    "settings.next_track": "Keyingi Trek",
    "settings.track_current": "Joriy trek: {{name}}",
    "settings.language_title": "Til",
    "settings.language_label": "Tilni Tanlang",
    "settings.language_hint": "Ingliz, o'zbek, rus va turk tillari to'liq tarjima qilingan. Boshqa tillar qisman bo'lishi mumkin.",
    "settings.ads_title": "Reklama Maxfiyligi",
    "settings.ads_hint": "Reklama sozlamasini tanlang. Shaxsiylashtirilgan yoki shaxsiylashtirilmagan reklamalarni davom ettirishingiz mumkin.",
    "settings.ads_personalized": "Shaxsiylashtirilgan Reklamalar",
    "settings.ads_nonpersonalized": "Shaxsiylashtirilmagan Reklamalar",
    "settings.ads_current": "Joriy:",
    "brand.subtitle": "Roguelite Arena",
    "auth.sign_in": "Kirish",
    "auth.sign_out": "Chiqish",
    "auth.account": "Hisob",
    "menu.sync_banner": "Jarayonni sinxronlash va global reytingga yuborish uchun tizimga kiring.",
    "menu.sync_dismiss": "Sinxron bannerini yopish",
    "menu.tip_collect": "Maslahat: Yugurish paytida yangilanish orbalarini to'plang. Kredit/Kristallarni Angarda sarflang.",
    "menu.tip_progress_local": "Maslahat: Jarayon shu qurilmada mahalliy saqlanadi.",
    "menu.privacy": "Maxfiylik",
    "menu.terms": "Shartlar",
    "missions.daily": "Kundalik Vazifalar",
    "missions.weekly": "Haftalik Vazifalar",
    "missions.status.claimed": "Olindi",
    "missions.status.ready": "Olishga tayyor",
    "missions.status.progress": "Jarayonda",
    "missions.toast_rewards": "Vazifa mukofotlari:",
    "missions.unit.credits": "kredit",
    "missions.unit.crystals": "kristall",
    "missions.title.daily_survive_5m": "5 daqiqa omon qoling",
    "missions.title.daily_kills_200": "200 ta dushmanni yo'q qiling",
    "missions.title.daily_wave_15": "15-to'lqinga yeting",
    "missions.title.weekly_kills_1200": "1200 ta dushmanni yo'q qiling",
    "missions.title.weekly_survive_45m": "Jami 45 daqiqa omon qoling",
    "missions.title.weekly_wave_25": "25-to'lqinga yeting",
    "account.cloud_unavailable": "Bulut sinxroni hozircha mavjud emas.",
    "account.guest_mode": "Siz mehmon rejimidasiz. Jarayonni qurilmalar o'rtasida sinxronlash uchun kiring.",
    "daily.title": "Kunlik Mukofot",
    "daily.claim": "Mukofotni Oling",
    "daily.double": "Mukofotni Ikki Barobar Qilish (Reklama Ko'rish)",
    "daily.later": "Keyinroq",
    "daily.day": "Kun {{day}}",
    "daily.summary_reset": "Kunlik seriya tiklandi. Endi 1-kun mukofotini oling.",
    "daily.summary_claim": "Kunlik seriyaning {{day}}-kuni. Mukofotingizni hozir oling.",
    "daily.summary_done": "Bugungi mukofot allaqachon olindi. Ertaga qayting.",
    "daily.toast_claimed": "Kunlik mukofot olindi:",
  },
  ru: {
    "menu.play_survival": "Играть (Выживание)",
    "menu.continue_campaign": "Продолжить Кампанию",
    "menu.hangar": "Ангар и Улучшения",
    "menu.online_beta": "Онлайн Дуэль (Бета)",
    "menu.online_coming": "Онлайн Дуэль (Скоро)",
    "menu.leaderboard": "Таблица Лидеров",
    "menu.game_info": "Информация об Игре",
    "menu.settings": "Настройки",
    "menu.fullscreen": "Полный Экран",
    "menu.controls_hint": "WASD / Стрелки - движение, мышь - прицел, клик или Space - стрельба",
    "settings.title": "Настройки",
    "settings.back": "Назад",
    "settings.audio_title": "Звук и Отдача",
    "settings.music_enabled": "Музыка в Меню",
    "settings.music_volume": "Громкость Музыки",
    "settings.shoot_sfx": "Звук Выстрела",
    "settings.destroy_sfx": "Звук Уничтожения Корабля",
    "settings.haptics": "Виброотклик",
    "settings.fullscreen": "Полный Экран",
    "settings.next_track": "Следующий Трек",
    "settings.track_current": "Текущий трек: {{name}}",
    "settings.language_title": "Язык",
    "settings.language_label": "Выбор Языка",
    "settings.language_hint": "Английский, узбекский, русский и турецкий переведены полностью. Остальные языки могут быть частичными.",
    "settings.ads_title": "Конфиденциальность Рекламы",
    "settings.ads_hint": "Выберите рекламные настройки. Можно использовать персонализированную или неперсонализированную рекламу.",
    "settings.ads_personalized": "Персонализированная Реклама",
    "settings.ads_nonpersonalized": "Неперсонализированная Реклама",
    "settings.ads_current": "Текущая:",
    "brand.subtitle": "Рогулайт Арена",
    "auth.sign_in": "Войти",
    "auth.sign_out": "Выйти",
    "auth.account": "Аккаунт",
    "menu.sync_banner": "Войдите, чтобы синхронизировать прогресс и отправлять результаты в глобальный рейтинг.",
    "menu.sync_dismiss": "Закрыть баннер синхронизации",
    "menu.tip_collect": "Совет: Во время забега собирайте сферы улучшений. Тратьте Кредиты/Кристаллы в Ангаре.",
    "menu.tip_progress_local": "Совет: Прогресс сохраняется локально на этом устройстве.",
    "menu.privacy": "Конфиденциальность",
    "menu.terms": "Условия",
    "missions.daily": "Ежедневные задания",
    "missions.weekly": "Еженедельные задания",
    "missions.status.claimed": "Получено",
    "missions.status.ready": "Готово к получению",
    "missions.status.progress": "В процессе",
    "missions.toast_rewards": "Награды за задания:",
    "missions.unit.credits": "кредитов",
    "missions.unit.crystals": "кристаллов",
    "missions.title.daily_survive_5m": "Выжить 5 минут",
    "missions.title.daily_kills_200": "Уничтожить 200 врагов",
    "missions.title.daily_wave_15": "Дойти до волны 15",
    "missions.title.weekly_kills_1200": "Уничтожить 1200 врагов",
    "missions.title.weekly_survive_45m": "Выжить в сумме 45 минут",
    "missions.title.weekly_wave_25": "Дойти до волны 25",
    "account.cloud_unavailable": "Облачная синхронизация сейчас недоступна.",
    "account.guest_mode": "Вы в гостевом режиме. Войдите, чтобы синхронизировать прогресс между устройствами.",
    "daily.title": "Ежедневная Награда",
    "daily.claim": "Получить Награду",
    "daily.double": "Удвоить Награду (Смотреть рекламу)",
    "daily.later": "Позже",
    "daily.day": "День {{day}}",
    "daily.summary_reset": "Серия сброшена. Заберите награду за 1-й день.",
    "daily.summary_claim": "День серии {{day}}. Заберите награду сейчас.",
    "daily.summary_done": "Награда за сегодня уже получена. Возвращайтесь завтра.",
    "daily.toast_claimed": "Ежедневная награда получена:",
  },
  tr: {
    "menu.play_survival": "Hemen Oyna (Hayatta Kalma)",
    "menu.continue_campaign": "Seferi Sürdür",
    "menu.hangar": "Hangar ve Yükseltmeler",
    "menu.online_beta": "Online Düello (Beta)",
    "menu.online_coming": "Online Düello (Yakında)",
    "menu.leaderboard": "Liderlik Tablosu",
    "menu.game_info": "Oyun Bilgisi",
    "menu.settings": "Ayarlar",
    "menu.fullscreen": "Tam Ekran",
    "menu.controls_hint": "WASD / Oklar ile hareket - Fare ile nişan - Tıkla veya Space ile ateş et",
    "settings.title": "Ayarlar",
    "settings.back": "Geri",
    "settings.audio_title": "Ses ve Geri Bildirim",
    "settings.music_enabled": "Menü Müziği",
    "settings.music_volume": "Müzik Seviyesi",
    "settings.shoot_sfx": "Ateş Etme Sesi",
    "settings.destroy_sfx": "Gemi Patlama Sesi",
    "settings.haptics": "Titreşim Geri Bildirimi",
    "settings.fullscreen": "Tam Ekran",
    "settings.next_track": "Sonraki Parça",
    "settings.track_current": "Geçerli parça: {{name}}",
    "settings.language_title": "Dil",
    "settings.language_label": "Dil Seçimi",
    "settings.language_hint": "İngilizce, Özbekçe, Rusça ve Türkçe tamamen yerelleştirildi. Diğer diller kısmi olabilir.",
    "settings.ads_title": "Reklam Gizliliği",
    "settings.ads_hint": "Reklam tercihini seç. Kişiselleştirilmiş veya kişiselleştirilmemiş reklamlarla devam edebilirsin.",
    "settings.ads_personalized": "Kişiselleştirilmiş Reklamlar",
    "settings.ads_nonpersonalized": "Kişiselleştirilmemiş Reklamlar",
    "settings.ads_current": "Geçerli:",
    "brand.subtitle": "Roguelite Arena",
    "auth.sign_in": "Giriş Yap",
    "auth.sign_out": "Çıkış Yap",
    "auth.account": "Hesap",
    "menu.sync_banner": "İlerlemeyi senkronize etmek ve global sıralamaya göndermek için giriş yap.",
    "menu.sync_dismiss": "Senkron afişini kapat",
    "menu.tip_collect": "İpucu: Koşu sırasında yükseltme kürelerini topla. Kredileri/Kristalleri Hangarda harca.",
    "menu.tip_progress_local": "İpucu: İlerleme bu cihazda yerel olarak kaydedilir.",
    "menu.privacy": "Gizlilik",
    "menu.terms": "Şartlar",
    "missions.daily": "Günlük Görevler",
    "missions.weekly": "Haftalık Görevler",
    "missions.status.claimed": "Alındı",
    "missions.status.ready": "Almaya hazır",
    "missions.status.progress": "Devam ediyor",
    "missions.toast_rewards": "Görev ödülleri:",
    "missions.unit.credits": "kredi",
    "missions.unit.crystals": "kristal",
    "missions.title.daily_survive_5m": "5 dakika hayatta kal",
    "missions.title.daily_kills_200": "200 düşmanı yok et",
    "missions.title.daily_wave_15": "15. dalgaya ulaş",
    "missions.title.weekly_kills_1200": "1200 düşmanı yok et",
    "missions.title.weekly_survive_45m": "Toplam 45 dakika hayatta kal",
    "missions.title.weekly_wave_25": "25. dalgaya ulaş",
    "account.cloud_unavailable": "Bulut senkronu şu anda kullanılamıyor.",
    "account.guest_mode": "Misafir modundasın. İlerlemeyi cihazlar arasında senkronize etmek için giriş yap.",
    "daily.title": "Günlük Ödül",
    "daily.claim": "Ödülü Al",
    "daily.double": "Ödülü İkiye Katla (Reklam İzle)",
    "daily.later": "Sonra",
    "daily.day": "Gün {{day}}",
    "daily.summary_reset": "Günlük seri sıfırlandı. Şimdi 1. gün ödülünü al.",
    "daily.summary_claim": "Günlük seri günü {{day}}. Ödülünü şimdi al.",
    "daily.summary_done": "Bugünün ödülü zaten alındı. Yarın tekrar gel.",
    "daily.toast_claimed": "Günlük ödül alındı:",
  },
};

I18N_MESSAGES.es = {
  "menu.play_survival": "Jugar Ahora (Supervivencia)",
  "menu.continue_campaign": "Continuar Campaña",
  "menu.hangar": "Hangar y Mejoras",
  "menu.online_beta": "Duelo Online (Beta)",
  "menu.online_coming": "Duelo Online (Próximamente)",
  "menu.leaderboard": "Clasificación",
  "menu.game_info": "Información del Juego",
  "menu.settings": "Ajustes",
  "menu.fullscreen": "Pantalla Completa",
  "menu.controls_hint": "WASD / Flechas para moverse - Ratón para apuntar - Clic o Espacio para disparar",
  "settings.title": "Ajustes",
  "settings.back": "Volver",
  "settings.audio_title": "Audio y Respuesta",
  "settings.music_enabled": "Música del Menú",
  "settings.music_volume": "Volumen de Música",
  "settings.shoot_sfx": "Sonido de Disparo",
  "settings.destroy_sfx": "Sonido al Destruir Nave",
  "settings.haptics": "Respuesta Háptica",
  "settings.fullscreen": "Pantalla Completa",
  "settings.next_track": "Siguiente Pista",
  "settings.track_current": "Pista actual: {{name}}",
  "settings.language_title": "Idioma",
  "settings.language_label": "Seleccionar Idioma",
  "settings.language_hint": "El texto principal de menú y ajustes está localizado. Más textos del juego se pueden ampliar luego.",
};

I18N_MESSAGES.fr = {
  "menu.play_survival": "Jouer (Survie)",
  "menu.continue_campaign": "Continuer la Campagne",
  "menu.hangar": "Hangar et Améliorations",
  "menu.online_beta": "Duel en Ligne (Bêta)",
  "menu.online_coming": "Duel en Ligne (Bientôt)",
  "menu.leaderboard": "Classement",
  "menu.game_info": "Infos du Jeu",
  "menu.settings": "Paramètres",
  "menu.fullscreen": "Plein Écran",
  "menu.controls_hint": "WASD / Flèches pour bouger - Souris pour viser - Clic ou Espace pour tirer",
  "settings.title": "Paramètres",
  "settings.back": "Retour",
  "settings.audio_title": "Audio et Retour",
  "settings.music_enabled": "Musique du Menu",
  "settings.music_volume": "Volume de la Musique",
  "settings.shoot_sfx": "Son des Tirs",
  "settings.destroy_sfx": "Son de Destruction du Vaisseau",
  "settings.haptics": "Retour Haptique",
  "settings.fullscreen": "Plein Écran",
  "settings.next_track": "Piste Suivante",
  "settings.track_current": "Piste actuelle : {{name}}",
  "settings.language_title": "Langue",
  "settings.language_label": "Choisir la Langue",
  "settings.language_hint": "Le texte principal menu/paramètres est localisé. Les autres textes du jeu peuvent être ajoutés ensuite.",
};

I18N_MESSAGES.de = {
  "menu.play_survival": "Jetzt Spielen (Überleben)",
  "menu.continue_campaign": "Kampagne Fortsetzen",
  "menu.hangar": "Hangar und Upgrades",
  "menu.online_beta": "Online-Duell (Beta)",
  "menu.online_coming": "Online-Duell (Bald)",
  "menu.leaderboard": "Bestenliste",
  "menu.game_info": "Spielinfo",
  "menu.settings": "Einstellungen",
  "menu.fullscreen": "Vollbild",
  "menu.controls_hint": "WASD / Pfeile zum Bewegen - Maus zum Zielen - Klick oder Leertaste zum Schießen",
  "settings.title": "Einstellungen",
  "settings.back": "Zurück",
  "settings.audio_title": "Audio und Feedback",
  "settings.music_enabled": "Menümusik",
  "settings.music_volume": "Musiklautstärke",
  "settings.shoot_sfx": "Schuss-Sound",
  "settings.destroy_sfx": "Zerstörungs-Sound",
  "settings.haptics": "Haptisches Feedback",
  "settings.fullscreen": "Vollbild",
  "settings.next_track": "Nächster Track",
  "settings.track_current": "Aktueller Track: {{name}}",
  "settings.language_title": "Sprache",
  "settings.language_label": "Sprache Wählen",
  "settings.language_hint": "Wichtige Menü- und Einstellungstexte sind lokalisiert. Weitere Spieltexte können später ergänzt werden.",
};

function localizeTemplate(template, vars = {}) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(vars[key] ?? ""));
}

function t(key, vars = {}) {
  const lang = normalizeLanguageCode(SAVE && SAVE.profile ? SAVE.profile.language : "en");
  const dict = I18N_MESSAGES[lang] || I18N_MESSAGES.en;
  const fallback = I18N_MESSAGES.en[key] || key;
  return localizeTemplate(dict[key] || fallback, vars);
}

function adConsentChoiceLabel(choice = getAdConsentChoice()) {
  if (choice === AD_CONSENT.GRANTED) return t("settings.ads_personalized");
  return t("settings.ads_nonpersonalized");
}

function renderAdConsentSettings() {
  if (!settingsAdCurrentEl) return;
  settingsAdCurrentEl.textContent = `${t("settings.ads_current")} ${adConsentChoiceLabel()}`;
}

function menuMusicEnabled() {
  return Boolean(SAVE.profile.musicEnabled);
}

function menuMusicVolume() {
  return clamp(Number(SAVE.profile.musicVolume || 0) / 100, 0, 1);
}

function shootingSfxEnabled() {
  return Boolean(SAVE.profile.shootSfxEnabled);
}

function destroySfxEnabled() {
  return Boolean(SAVE.profile.destroySfxEnabled);
}

function hapticsEnabled() {
  return Boolean(SAVE.profile.hapticsEnabled);
}

function ensureLanguageOptions() {
  if (!settingsLanguageEl) return;
  if (settingsLanguageEl.options.length === LANGUAGE_OPTIONS.length) return;
  settingsLanguageEl.innerHTML = "";
  LANGUAGE_OPTIONS.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.code;
    option.textContent = item.label;
    settingsLanguageEl.appendChild(option);
  });
}

function applyLanguageToUi() {
  const lang = normalizeLanguageCode(SAVE.profile.language || "en");
  document.documentElement.lang = lang;

  playSurvivalBtn.textContent = t("menu.play_survival");
  playCampaignBtn.textContent = t("menu.continue_campaign");
  hangarBtn.textContent = t("menu.hangar");
  leaderboardBtn.textContent = t("menu.leaderboard");
  onlineBtn.textContent = t("menu.online_beta");
  menuOnlineBtn.textContent = t("menu.online_beta");
  settingsBtn.textContent = t("menu.settings");
  infoBtn.textContent = t("menu.game_info");
  if (menuControlsHintEl) menuControlsHintEl.textContent = t("menu.controls_hint");
  if (menuSubtitlePillEl) menuSubtitlePillEl.textContent = t("brand.subtitle");
  if (guestSyncBannerTextEl) {
    guestSyncBannerTextEl.textContent = progressionRequiresAuth()
      ? "Guest mode: records reset on reload. Sign in to save progress and join global leaderboard."
      : t("menu.sync_banner");
  }
  if (menuMissionTipEl) menuMissionTipEl.textContent = t("menu.tip_collect");
  if (menuPrivacyLinkEl) menuPrivacyLinkEl.textContent = t("menu.privacy");
  if (menuTermsLinkEl) menuTermsLinkEl.textContent = t("menu.terms");
  if (sideProgressTipEl) {
    sideProgressTipEl.textContent = progressionRequiresAuth()
      ? "Tip: Guest runs are temporary. Sign in to keep your records."
      : t("menu.tip_progress_local");
  }
  menuSettingsBtn.textContent = t("menu.settings");
  topSignInBtn.textContent = t("auth.sign_in");
  topSignOutBtn.textContent = t("auth.sign_out");
  guestSyncSignInBtn.textContent = t("auth.sign_in");
  guestSyncCloseBtn.setAttribute("aria-label", t("menu.sync_dismiss"));

  settingsTitleEl.textContent = t("settings.title");
  backFromSettingsBtn.textContent = t("settings.back");
  settingsAudioTitleEl.textContent = t("settings.audio_title");
  settingsMusicEnabledLabelEl.textContent = t("settings.music_enabled");
  settingsMusicVolumeLabelEl.textContent = t("settings.music_volume");
  settingsShootSfxLabelEl.textContent = t("settings.shoot_sfx");
  settingsDestroySfxLabelEl.textContent = t("settings.destroy_sfx");
  settingsHapticsLabelEl.textContent = t("settings.haptics");
  if (settingsDamageNumbersLabelEl) settingsDamageNumbersLabelEl.textContent = "Damage Numbers";
  if (settingsAdaptiveDifficultyLabelEl) settingsAdaptiveDifficultyLabelEl.textContent = "Adaptive Difficulty";
  if (settingsFpsLimitLabelEl) settingsFpsLimitLabelEl.textContent = "Mobile FPS Limit";
  settingsFullscreenLabelEl.textContent = t("settings.fullscreen");
  settingsNextTrackBtn.textContent = t("settings.next_track");
  settingsAdTitleEl.textContent = t("settings.ads_title");
  settingsAdHintEl.textContent = t("settings.ads_hint");
  settingsConsentAcceptBtn.textContent = t("settings.ads_personalized");
  settingsConsentLimitedBtn.textContent = t("settings.ads_nonpersonalized");
  settingsLanguageTitleEl.textContent = t("settings.language_title");
  settingsLanguageLabelEl.textContent = t("settings.language_label");
  settingsLanguageHintEl.textContent = t("settings.language_hint");
  dailyRewardTitleEl.textContent = t("daily.title");
  dailyClaimBtn.textContent = t("daily.claim");
  dailyDoubleBtn.textContent = t("daily.double");
  dailyCloseBtn.textContent = t("daily.later");
  updateSettingsTrackLabel();
  renderAdConsentSettings();
  setFullscreenButtonLabel();
  renderMissionBoard();
}

function applySettingsUi() {
  ensureLanguageOptions();
  settingsMusicEnabledEl.checked = menuMusicEnabled();
  const volume = clamp(Math.floor(Number(SAVE.profile.musicVolume || 0)), 0, 100);
  settingsMusicVolumeEl.value = String(volume);
  settingsMusicVolumeValueEl.textContent = `${volume}%`;
  settingsShootSfxEl.checked = shootingSfxEnabled();
  settingsDestroySfxEl.checked = destroySfxEnabled();
  settingsHapticsEl.checked = hapticsEnabled();
  if (settingsDamageNumbersEl) settingsDamageNumbersEl.checked = Boolean(SAVE.profile.damageNumbersEnabled);
  if (settingsAdaptiveDifficultyEl) settingsAdaptiveDifficultyEl.checked = Boolean(SAVE.profile.adaptiveDifficultyEnabled);
  if (settingsFpsLimitEl) settingsFpsLimitEl.value = String(Math.floor(Number(SAVE.profile.fpsLimit || 0)));
  const showMobileFullscreen = shouldUseTouchControls();
  settingsFullscreenRowEl.classList.toggle("hidden", !showMobileFullscreen);
  settingsFullscreenToggleEl.checked = Boolean(document.fullscreenElement);
  settingsFullscreenToggleEl.disabled = !showMobileFullscreen;
  settingsLanguageEl.value = normalizeLanguageCode(SAVE.profile.language || "en");
  updateSettingsTrackLabel();
  renderAdConsentSettings();
}

const MENU_MUSIC_TRACKS = Object.freeze([
  {
    name: "Event Horizon",
    tempo: 84,
    lead: [72, -1, 74, 76, -1, 74, 71, -1, 72, -1, 74, 76, -1, 79, 76, -1],
    bass: [45, -1, 45, -1, 43, -1, 43, -1, 40, -1, 40, -1, 43, -1, 45, -1],
    chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [55, 59, 62]],
    arp: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 0, 2, 3, 2],
    drone: 33,
  },
  {
    name: "Deep Orbit",
    tempo: 90,
    lead: [74, -1, 77, -1, 79, -1, 77, -1, 74, -1, 72, -1, 74, -1, 71, -1],
    bass: [47, -1, 47, -1, 45, -1, 45, -1, 42, -1, 42, -1, 45, -1, 47, -1],
    chords: [[59, 62, 66], [57, 60, 64], [54, 57, 61], [57, 60, 64]],
    arp: [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 0, 3, 2, 1],
    drone: 35,
  },
  {
    name: "Ion Cathedral",
    tempo: 78,
    lead: [69, -1, 71, 72, -1, 71, 69, -1, 67, -1, 69, 71, -1, 72, 74, -1],
    bass: [40, -1, 40, -1, 43, -1, 43, -1, 45, -1, 45, -1, 43, -1, 40, -1],
    chords: [[52, 55, 59], [55, 59, 62], [57, 60, 64], [55, 59, 62]],
    arp: [0, 1, 2, 3, 0, 1, 2, 1, 0, 1, 2, 3, 0, 2, 1, 0],
    drone: 31,
  },
  {
    name: "Cold Nebula",
    tempo: 96,
    lead: [76, -1, 79, 81, -1, 79, 76, 74, -1, 76, 77, -1, 79, 81, 79, -1],
    bass: [45, -1, 45, -1, 47, -1, 47, -1, 43, -1, 43, -1, 40, -1, 40, -1],
    chords: [[57, 60, 64], [59, 62, 66], [55, 59, 62], [52, 55, 59]],
    arp: [0, 1, 3, 2, 0, 1, 2, 3, 0, 2, 1, 3, 0, 1, 3, 2],
    drone: 33,
  },
  {
    name: "Solar Winds",
    tempo: 88,
    lead: [71, -1, 72, 74, -1, 76, 74, -1, 72, -1, 71, 69, -1, 71, 74, -1],
    bass: [43, -1, 43, -1, 40, -1, 40, -1, 45, -1, 45, -1, 47, -1, 47, -1],
    chords: [[55, 59, 62], [52, 55, 59], [57, 60, 64], [59, 62, 66]],
    arp: [0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 1, 2, 1],
    drone: 34,
  },
]);

const AUDIO = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  unlocked: false,
  menuTimer: null,
  trackOrder: [],
  trackPos: 0,
  currentTrackIndex: 0,
  step: 0,
};

function currentMenuTrack() {
  return MENU_MUSIC_TRACKS[AUDIO.currentTrackIndex] || MENU_MUSIC_TRACKS[0];
}

function updateSettingsTrackLabel() {
  settingsTrackNameEl.textContent = t("settings.track_current", { name: currentMenuTrack().name });
}

function ensureAudioGraph() {
  if (AUDIO.ctx) return AUDIO.ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  const ctx = new AudioCtx();
  const masterGain = ctx.createGain();
  const musicGain = ctx.createGain();
  const sfxGain = ctx.createGain();

  masterGain.gain.value = 1;
  musicGain.gain.value = 0;
  sfxGain.gain.value = 0.9;

  musicGain.connect(masterGain);
  sfxGain.connect(masterGain);
  masterGain.connect(ctx.destination);

  AUDIO.ctx = ctx;
  AUDIO.masterGain = masterGain;
  AUDIO.musicGain = musicGain;
  AUDIO.sfxGain = sfxGain;
  return ctx;
}

function applyAudioMix() {
  const ctx = ensureAudioGraph();
  if (!ctx || !AUDIO.musicGain || !AUDIO.sfxGain) return;
  const now = ctx.currentTime;
  const targetMusic = menuMusicEnabled() ? menuMusicVolume() * 0.32 : 0;
  AUDIO.musicGain.gain.cancelScheduledValues(now);
  AUDIO.sfxGain.gain.cancelScheduledValues(now);
  AUDIO.musicGain.gain.setTargetAtTime(targetMusic, now, 0.08);
  AUDIO.sfxGain.gain.setTargetAtTime(0.9, now, 0.08);
}

function midiToHz(note) {
  return 440 * Math.pow(2, (Number(note) - 69) / 12);
}

function playSynthNote(note, {
  duration = 0.2,
  gain = 0.15,
  type = "triangle",
  bus = "music",
  delay = 0,
  detune = 0,
  attack = 0.015,
  filterType = "",
  filterHz = 0,
  filterQ = 0.7,
} = {}) {
  if (!AUDIO.unlocked) return;
  if (note == null || note < 0) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;
  const out = bus === "sfx" ? AUDIO.sfxGain : AUDIO.musicGain;
  if (!out) return;

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  let filter = null;
  const start = ctx.currentTime + Math.max(0, Number(delay) || 0);
  const end = start + Math.max(0.03, Number(duration) || 0.2);

  osc.type = type;
  osc.frequency.setValueAtTime(midiToHz(note), start);
  osc.detune.setValueAtTime(Number(detune) || 0, start);
  if (filterType && Number(filterHz) > 0) {
    filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Number(filterHz), start);
    filter.Q.setValueAtTime(Math.max(0.0001, Number(filterQ) || 0.7), start);
  }
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + Math.max(0.002, Number(attack) || 0.015));
  env.gain.exponentialRampToValueAtTime(0.0001, end);

  if (filter) {
    osc.connect(filter);
    filter.connect(env);
  } else {
    osc.connect(env);
  }
  env.connect(out);
  osc.start(start);
  osc.stop(end + 0.015);
  osc.onended = () => {
    try {
      osc.disconnect();
      if (filter) filter.disconnect();
      env.disconnect();
    } catch {
      // ignore audio cleanup errors
    }
  };
}

function maybeVibrate(pattern) {
  if (!hapticsEnabled()) return;
  if (!navigator || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore vibration errors
  }
}

function playShootSfx() {
  if (!shootingSfxEnabled()) return;
  const jitter = Math.floor(Math.random() * 3);
  playSynthNote(88 + jitter, { duration: 0.06, gain: 0.14, type: "square", bus: "sfx" });
  playSynthNote(76 + jitter, { duration: 0.04, gain: 0.08, type: "triangle", bus: "sfx" });
}

function playDestroySfx() {
  if (!destroySfxEnabled()) return;
  playSynthNote(52, { duration: 0.24, gain: 0.22, type: "sawtooth", bus: "sfx", delay: 0.0 });
  playSynthNote(45, { duration: 0.3, gain: 0.2, type: "sawtooth", bus: "sfx", delay: 0.05 });
  playSynthNote(38, { duration: 0.38, gain: 0.16, type: "triangle", bus: "sfx", delay: 0.1 });
}

function refillTrackOrder() {
  const order = MENU_MUSIC_TRACKS.map((_, idx) => idx);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  AUDIO.trackOrder = order;
  AUDIO.trackPos = 0;
}

function pickNextMenuTrack() {
  if (!AUDIO.trackOrder.length || AUDIO.trackPos >= AUDIO.trackOrder.length) refillTrackOrder();
  AUDIO.currentTrackIndex = AUDIO.trackOrder[AUDIO.trackPos];
  AUDIO.trackPos += 1;
  AUDIO.step = 0;
  updateSettingsTrackLabel();
  return currentMenuTrack();
}

function playMenuTrackStep(track, step) {
  const idx = step % 16;
  const lead = track.lead[idx];
  const bass = track.bass[idx];
  const chord = track.chords[Math.floor(idx / 4) % track.chords.length] || [];
  const arpPattern = Array.isArray(track.arp) ? track.arp : [];
  const beatDur = Math.max(0.14, 60 / Math.max(40, Number(track.tempo || 84)));

  playSynthNote(lead, {
    duration: beatDur * 0.82,
    gain: 0.085,
    type: "triangle",
    bus: "music",
    filterType: "lowpass",
    filterHz: 3200,
  });
  playSynthNote(lead, {
    duration: beatDur * 0.9,
    gain: 0.05,
    type: "sine",
    bus: "music",
    detune: -7,
    filterType: "lowpass",
    filterHz: 2400,
  });
  playSynthNote(bass, {
    duration: beatDur * 0.95,
    gain: 0.105,
    type: "sawtooth",
    bus: "music",
    filterType: "lowpass",
    filterHz: 580,
    filterQ: 1.2,
  });

  if (idx % 8 === 0) {
    chord.forEach((note, n) => {
      playSynthNote(note, {
        duration: beatDur * 6.2,
        gain: 0.042,
        attack: 0.09,
        type: "sine",
        bus: "music",
        detune: n === 1 ? -6 : n === 2 ? 6 : 0,
        delay: n * 0.012,
        filterType: "lowpass",
        filterHz: 1900,
      });
    });
  }

  if (idx % 2 === 1 && chord.length) {
    const arpIndex = Number(arpPattern[idx % arpPattern.length] || idx) % chord.length;
    const arpNote = chord[arpIndex] + (idx % 4 === 3 ? 12 : 0);
    playSynthNote(arpNote, {
      duration: beatDur * 0.42,
      gain: 0.045,
      type: "square",
      bus: "music",
      filterType: "highpass",
      filterHz: 520,
      filterQ: 0.9,
    });
  }

  if (idx === 0 && Number(track.drone) > 0) {
    playSynthNote(track.drone, {
      duration: beatDur * 13.5,
      gain: 0.046,
      attack: 0.2,
      type: "triangle",
      bus: "music",
      filterType: "lowpass",
      filterHz: 360,
      filterQ: 1.1,
    });
  }
}

function stopMenuMusic() {
  if (AUDIO.menuTimer) {
    clearTimeout(AUDIO.menuTimer);
    AUDIO.menuTimer = null;
  }
  if (AUDIO.ctx && AUDIO.musicGain) {
    AUDIO.musicGain.gain.setTargetAtTime(0, AUDIO.ctx.currentTime, 0.08);
  }
}

function canPlayMenuMusic(nextState = state) {
  if (!menuMusicEnabled()) return false;
  return nextState !== STATE.RUN && nextState !== STATE.PICK;
}

function menuMusicTick() {
  if (!AUDIO.unlocked || !canPlayMenuMusic(state)) {
    stopMenuMusic();
    return;
  }

  const track = currentMenuTrack();
  playMenuTrackStep(track, AUDIO.step);
  AUDIO.step += 1;
  if (AUDIO.step >= 16) {
    pickNextMenuTrack();
  }

  const ms = Math.max(130, Math.floor((60 / track.tempo) * 1000));
  AUDIO.menuTimer = setTimeout(menuMusicTick, ms);
}

function startMenuMusic() {
  if (!AUDIO.unlocked || !canPlayMenuMusic(state)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  applyAudioMix();
  if (!AUDIO.menuTimer) {
    AUDIO.step = 0;
    menuMusicTick();
  }
}

function syncAudioForState(nextState = state) {
  if (canPlayMenuMusic(nextState)) {
    startMenuMusic();
  } else {
    stopMenuMusic();
  }
}

function skipMenuTrack() {
  pickNextMenuTrack();
  stopMenuMusic();
  syncAudioForState(state);
}

function unlockAudioIfNeeded() {
  if (AUDIO.unlocked) {
    const ctx = ensureAudioGraph();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    return;
  }
  AUDIO.unlocked = true;
  const ctx = ensureAudioGraph();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  applyAudioMix();
  syncAudioForState(state);
}

function initializeSettingsSystem() {
  ensureLanguageOptions();
  applySettingsUi();
  applyLanguageToUi();
  pickNextMenuTrack();
}

window.addEventListener("pointerdown", unlockAudioIfNeeded, { passive: true });
window.addEventListener("keydown", unlockAudioIfNeeded);

const DAILY_REWARD_LADDER = [
  { day: 1, credits: 500, crystals: 0 },
  { day: 2, credits: 700, crystals: 0 },
  { day: 3, credits: 900, crystals: 0 },
  { day: 4, credits: 1200, crystals: 0 },
  { day: 5, credits: 1500, crystals: 0 },
  { day: 6, credits: 2000, crystals: 0 },
  { day: 7, credits: 2500, crystals: 50 },
];

const DAILY_MISSION_POOL = [
  { id: "daily_survive_5m", title: "Survive 5 minutes", type: "run_seconds", target: 300, rewardCredits: 900, rewardCrystals: 0 },
  { id: "daily_survive_8m", title: "Survive 8 minutes", type: "run_seconds", target: 480, rewardCredits: 1300, rewardCrystals: 1 },
  { id: "daily_kills_160", title: "Defeat 160 enemies", type: "kills", target: 160, rewardCredits: 1200, rewardCrystals: 1 },
  { id: "daily_kills_260", title: "Defeat 260 enemies", type: "kills", target: 260, rewardCredits: 1800, rewardCrystals: 2 },
  { id: "daily_wave_12", title: "Reach wave 12", type: "wave", target: 12, rewardCredits: 1350, rewardCrystals: 1 },
  { id: "daily_wave_18", title: "Reach wave 18", type: "wave", target: 18, rewardCredits: 2100, rewardCrystals: 2 },
];

const WEEKLY_MISSION_POOL = [
  { id: "weekly_kills_900", title: "Defeat 900 enemies", type: "kills", target: 900, rewardCredits: 7200, rewardCrystals: 9 },
  { id: "weekly_kills_1500", title: "Defeat 1500 enemies", type: "kills", target: 1500, rewardCredits: 10500, rewardCrystals: 14 },
  { id: "weekly_survive_40m", title: "Survive 40 minutes total", type: "run_seconds", target: 2400, rewardCredits: 7600, rewardCrystals: 9 },
  { id: "weekly_survive_60m", title: "Survive 60 minutes total", type: "run_seconds", target: 3600, rewardCredits: 11200, rewardCrystals: 14 },
  { id: "weekly_wave_22", title: "Reach wave 22", type: "wave", target: 22, rewardCredits: 7800, rewardCrystals: 10 },
  { id: "weekly_wave_30", title: "Reach wave 30", type: "wave", target: 30, rewardCredits: 11800, rewardCrystals: 16 },
];

const MISSION_REROLL_COST = 750;

initializeSettingsSystem();

function localDayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localWeekKey(ts = Date.now()) {
  const d = new Date(ts);
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function formatInt(value) {
  return Math.max(0, Math.floor(Number(value || 0))).toLocaleString();
}

function formatDateTime(value) {
  const ts = Number(value || 0);
  if (!Number.isFinite(ts) || ts <= 0) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

function formatDurationShort(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function seededPick(pool, count, seedText) {
  const list = pool.slice();
  let seed = 0;
  for (let i = 0; i < seedText.length; i += 1) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  const out = [];
  while (out.length < count && list.length > 0) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const idx = seed % list.length;
    out.push(list.splice(idx, 1)[0]);
  }
  return out;
}

function cloneMission(def, periodKey) {
  return {
    key: `${periodKey}:${def.id}`,
    id: def.id,
    title: def.title,
    type: def.type,
    target: def.target,
    progress: 0,
    rewardCredits: def.rewardCredits,
    rewardCrystals: def.rewardCrystals,
    claimed: false,
  };
}

function ensureMissionSet() {
  const today = localDayKey();
  const week = localWeekKey();

  if (SAVE.profile.missionDayKey !== today || !Array.isArray(SAVE.missions.daily) || SAVE.missions.daily.length === 0) {
    SAVE.profile.missionDayKey = today;
    SAVE.profile.missionRerollDay = today;
    SAVE.profile.missionRerollUsed = false;
    const dailyDefs = seededPick(DAILY_MISSION_POOL, 2, `${today}:daily`);
    SAVE.missions.daily = dailyDefs.map((def) => cloneMission(def, today));
  }

  if (SAVE.profile.missionWeekKey !== week || !Array.isArray(SAVE.missions.weekly) || SAVE.missions.weekly.length === 0) {
    SAVE.profile.missionWeekKey = week;
    const weeklyDefs = seededPick(WEEKLY_MISSION_POOL, 2, `${week}:weekly`);
    SAVE.missions.weekly = weeklyDefs.map((def) => cloneMission(def, week));
  }
}

function canMissionRerollToday() {
  const today = localDayKey();
  if (SAVE.profile.missionRerollDay !== today) {
    SAVE.profile.missionRerollDay = today;
    SAVE.profile.missionRerollUsed = false;
  }
  return !SAVE.profile.missionRerollUsed;
}

function rerollOneDailyMission() {
  ensureMissionSet();
  if (!canMissionRerollToday()) {
    showToast("Daily reroll already used.");
    return false;
  }
  if (Number(SAVE.profile.credits || 0) < MISSION_REROLL_COST) {
    showToast(`Need ${MISSION_REROLL_COST} credits to reroll.`);
    return false;
  }
  const list = SAVE.missions.daily || [];
  if (!list.length) {
    showToast("No daily mission to reroll.");
    return false;
  }

  const idx = list.findIndex((m) => !(m && m.claimed));
  const targetIdx = idx >= 0 ? idx : 0;
  const inUse = new Set(list.map((m) => String(m.id || "")));
  const pool = DAILY_MISSION_POOL.filter((def) => !inUse.has(def.id));
  if (!pool.length) {
    showToast("No alternative daily mission available.");
    return false;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const replacement = cloneMission(pick, SAVE.profile.missionDayKey || localDayKey());
  list[targetIdx] = replacement;
  SAVE.profile.credits -= MISSION_REROLL_COST;
  SAVE.profile.missionRerollUsed = true;
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  updateTopBar();
  renderMissionBoard();
  showToast(`Daily mission rerolled: ${replacement.title}`);
  return true;
}

function missionProgressLabel(m) {
  const cur = Math.min(m.target, Math.floor(m.progress || 0));
  return `${cur}/${m.target}`;
}

function missionTitleLabel(m) {
  if (!m || !m.id) return String((m && m.title) || "");
  const key = `missions.title.${m.id}`;
  const label = t(key);
  return label === key ? String(m.title || m.id) : label;
}

function formatMissionReward(credits, crystals) {
  const creditPart = `+${Math.max(0, Math.floor(Number(credits || 0)))} ${t("missions.unit.credits")}`;
  const crystalValue = Math.max(0, Math.floor(Number(crystals || 0)));
  if (!crystalValue) return creditPart;
  return `${creditPart}, +${crystalValue} ${t("missions.unit.crystals")}`;
}

function renderMissionBoard() {
  if (!missionBoardEl) return;
  ensureMissionSet();
  const sections = [];
  const dailyRows = (SAVE.missions.daily || []).map((m) => {
    const done = (m.progress || 0) >= m.target;
    const reward = formatMissionReward(m.rewardCredits, m.rewardCrystals);
    const status = done
      ? (m.claimed ? t("missions.status.claimed") : t("missions.status.ready"))
      : t("missions.status.progress");
    return `<div class="missionBoard__row"><strong>${missionTitleLabel(m)}</strong><span>${missionProgressLabel(m)} · ${status}</span><span>${reward}</span></div>`;
  }).join("");
  sections.push(`<div class="missionBoard__title">${t("missions.daily")}</div>${dailyRows}`);

  const weeklyRows = (SAVE.missions.weekly || []).map((m) => {
    const done = (m.progress || 0) >= m.target;
    const reward = formatMissionReward(m.rewardCredits, m.rewardCrystals);
    const status = done
      ? (m.claimed ? t("missions.status.claimed") : t("missions.status.ready"))
      : t("missions.status.progress");
    return `<div class="missionBoard__row"><strong>${missionTitleLabel(m)}</strong><span>${missionProgressLabel(m)} · ${status}</span><span>${reward}</span></div>`;
  }).join("");
  sections.push(`<div class="missionBoard__title">${t("missions.weekly")}</div>${weeklyRows}`);
  missionBoardEl.innerHTML = sections.join("");

  if (missionRerollBtn) {
    const can = canMissionRerollToday();
    missionRerollBtn.disabled = !can;
    missionRerollBtn.textContent = can
      ? `Reroll Daily Mission (${MISSION_REROLL_COST} Credits)`
      : "Daily Reroll Used";
  }
}

function claimReadyMissions() {
  ensureMissionSet();
  let gainedCredits = 0;
  let gainedCrystals = 0;
  const all = [...(SAVE.missions.daily || []), ...(SAVE.missions.weekly || [])];
  all.forEach((m) => {
    if (m.claimed) return;
    if ((m.progress || 0) < m.target) return;
    m.claimed = true;
    gainedCredits += Number(m.rewardCredits || 0);
    gainedCrystals += Number(m.rewardCrystals || 0);
  });
  if (gainedCredits > 0 || gainedCrystals > 0) {
    SAVE.profile.credits += gainedCredits;
    SAVE.profile.crystals += gainedCrystals;
    SAVE.profile.crystalsShadow = Math.max(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    updateTopBar();
    showToast(`${t("missions.toast_rewards")} ${formatMissionReward(gainedCredits, gainedCrystals)}`);
  }
  renderMissionBoard();
}

function applyMissionProgress(summary) {
  ensureMissionSet();
  const updateOne = (m) => {
    if (!m || m.claimed) return;
    if (m.type === "kills") m.progress = Math.min(m.target, (m.progress || 0) + (summary.kills || 0));
    if (m.type === "run_seconds") m.progress = Math.min(m.target, (m.progress || 0) + (summary.seconds || 0));
    if (m.type === "wave") m.progress = Math.max(m.progress || 0, summary.wave || 0);
  };
  (SAVE.missions.daily || []).forEach(updateOne);
  (SAVE.missions.weekly || []).forEach(updateOne);
}

function dailyRewardState() {
  const now = nowMs();
  const today = localDayKey(now);
  const lastClaim = Number(SAVE.profile.dailyClaimTimestamp || 0);
  if (!lastClaim) {
    return { claimable: true, today, streakDay: 1, alreadyClaimed: false, reset: true };
  }
  const lastDay = localDayKey(lastClaim);
  if (lastDay === today) {
    const existing = Math.max(1, Number(SAVE.profile.dailyStreakDay || 1));
    return { claimable: false, today, streakDay: existing, alreadyClaimed: true, reset: false };
  }
  const elapsed = now - lastClaim;
  if (elapsed > 24 * 60 * 60 * 1000) {
    return { claimable: true, today, streakDay: 1, alreadyClaimed: false, reset: true };
  }
  const nextDay = ((Math.max(1, Number(SAVE.profile.dailyStreakDay || 1))) % 7) + 1;
  return { claimable: true, today, streakDay: nextDay, alreadyClaimed: false, reset: false };
}

function renderDailyRewardPopup() {
  const st = dailyRewardState();
  const canDouble = hasRewardedAdapter();
  const ladderRows = DAILY_REWARD_LADDER.map((reward) => {
    const isCurrent = reward.day === st.streakDay;
    const isClaimed = reward.day < st.streakDay && !st.reset;
    return `<div class="dailyLadder__item ${isCurrent ? "is-current" : ""} ${isClaimed ? "is-claimed" : ""}">
      <strong>${t("daily.day", { day: reward.day })}</strong>
      <span>${formatMissionReward(reward.credits, reward.crystals)}</span>
    </div>`;
  }).join("");
  dailyRewardLadderEl.innerHTML = ladderRows;
  if (st.claimable) {
    dailyRewardSummaryEl.textContent = st.reset
      ? t("daily.summary_reset")
      : t("daily.summary_claim", { day: st.streakDay });
  } else {
    dailyRewardSummaryEl.textContent = t("daily.summary_done");
  }
  dailyClaimBtn.disabled = !st.claimable;
  dailyDoubleBtn.classList.toggle("hidden", !canDouble);
  dailyDoubleBtn.disabled = !st.claimable || !canDouble;
}

function maybeOpenDailyRewardPopup(force = false) {
  const st = dailyRewardState();
  if (!st.claimable && !force) return;
  const today = localDayKey();
  if (!force && SESSION.dailyRewardPromptedAt === today) return;
  SESSION.dailyRewardPromptedAt = today;
  renderDailyRewardPopup();
  dailyRewardEl.classList.remove("hidden");
}

function grantDailyReward(mult = 1) {
  const st = dailyRewardState();
  if (!st.claimable) return false;
  const reward = DAILY_REWARD_LADDER.find((d) => d.day === st.streakDay) || DAILY_REWARD_LADDER[0];
  const streakBonus = 1 + Math.min(0.3, (Math.max(1, st.streakDay) - 1) * 0.04);
  const credits = Math.floor(reward.credits * mult * streakBonus);
  const crystals = Math.floor(reward.crystals * mult * streakBonus);
  SAVE.profile.credits += credits;
  SAVE.profile.crystals += crystals;
  SAVE.profile.crystalsShadow = Math.max(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
  SAVE.profile.dailyClaimTimestamp = nowMs();
  SAVE.profile.dailyStreakDay = st.streakDay;
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  updateTopBar();
  evaluateAchievements("daily_reward");
  showToast(`${t("daily.toast_claimed")} ${formatMissionReward(credits, crystals)}`);
  dailyRewardEl.classList.add("hidden");
  return true;
}

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Stellar Siege",
    body: "Move with WASD or touch joystick. Aim with mouse/tap direction and fire continuously.",
  },
  {
    title: "Use Ship Abilities",
    body: "Press E (or ABILITY on mobile). Every ship has a unique active power with cooldown.",
  },
  {
    title: "Progress Smartly",
    body: "Spend credits in Hangar upgrades and Command Tree. Daily missions and streaks accelerate growth.",
  },
];

function setTutorialStep(index) {
  if (!tutorialOverlayEl || !tutorialTitleEl || !tutorialBodyEl || !tutorialNextBtn) return;
  const safe = clamp(Math.floor(Number(index || 0)), 0, TUTORIAL_STEPS.length - 1);
  SESSION.tutorialStep = safe;
  const step = TUTORIAL_STEPS[safe];
  tutorialTitleEl.textContent = step.title;
  tutorialBodyEl.textContent = step.body;
  tutorialNextBtn.textContent = safe >= TUTORIAL_STEPS.length - 1 ? "Start Playing" : "Next";
}

function openTutorialIfNeeded(force = false) {
  if (!tutorialOverlayEl) return;
  if (!force && SAVE.profile.tutorialDone) return;
  setTutorialStep(0);
  tutorialOverlayEl.classList.remove("hidden");
}

function closeTutorial(markDone = true) {
  if (!tutorialOverlayEl) return;
  tutorialOverlayEl.classList.add("hidden");
  if (markDone) {
    SAVE.profile.tutorialDone = true;
    SAVE.profile.updatedAt = nowMs();
    saveNow();
  }
}

function xpForLevel(level) {
  const l = Math.max(1, level);
  return Math.floor(120 * l * l + 220 * (l - 1));
}

function levelFromXp(xp) {
  let lvl = 1;
  while (xp >= xpForLevel(lvl + 1)) lvl += 1;
  return lvl;
}

function computePermanentStats(shipId, upgradesOverride = null, xpOverride = null) {
  const ship = shipById(shipId || SAVE.profile.selectedShipId);
  const u = upgradesOverride || ensureShipState(ship.id).upgrades;
  const pilotLevel = levelFromXp(xpOverride != null ? xpOverride : SAVE.profile.xp);
  const levelBonus = Math.floor((pilotLevel - 1) / 4) * 0.15;
  const eliteMult = 1 + u.elite * 0.04;
  const treeBonus = accountTreeBonuses();
  const baseDamage = (ship.base.damage + u.damage * 0.35 + levelBonus + treeBonus.damage) * eliteMult;
  const fireRateRaw = ship.base.fireRate * Math.pow(0.92, u.fireRate) * Math.max(0.68, treeBonus.fireRateMult);
  const fireRate = Math.max(0.05, fireRateRaw / eliteMult);
  return {
    pilotLevel,
    shipId: ship.id,
    shipName: ship.name,
    speed: (ship.base.speed + u.thrusters * 18 + treeBonus.speed) * eliteMult,
    bulletSpeed: (ship.base.bulletSpeed + u.bulletSpeed * 34) * eliteMult,
    damage: baseDamage,
    critChance: treeBonus.critChance,
    fireRate,
    shieldMax: Math.floor((ship.base.shieldMax + u.shieldMax * 18 + treeBonus.shield) * eliteMult),
    shieldRegen: (ship.base.shieldRegen + u.shieldRegen * 0.95 + treeBonus.regen) * eliteMult,
    hullMax: Math.floor((ship.base.hullMax + u.hullMax * 16 + treeBonus.hull) * eliteMult),
    pierce: ship.base.pierce + u.pierce,
    droneCount: ship.base.droneCount + u.drone,
    creditBonusMult: treeBonus.creditsMult,
    abilityCooldownMult: treeBonus.abilityCooldownMult,
  };
}

const PERM_UPGRADES = [
  {
    key: "damage",
    name: "Laser Damage",
    desc: "Bullets deal more damage.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(280 * Math.pow(1.36, lvl)),
  },
  {
    key: "fireRate",
    name: "Fire Rate",
    desc: "Shoot faster.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(320 * Math.pow(1.35, lvl)),
  },
  {
    key: "bulletSpeed",
    name: "Bullet Speed",
    desc: "Faster bullets hit more reliably.",
    currency: "credits",
    max: 8,
    cost: (lvl) => Math.floor(240 * Math.pow(1.34, lvl)),
  },
  {
    key: "shieldMax",
    name: "Shield Capacity",
    desc: "More shield HP.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(300 * Math.pow(1.35, lvl)),
  },
  {
    key: "shieldRegen",
    name: "Shield Regen",
    desc: "Shield regenerates faster.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(300 * Math.pow(1.34, lvl)),
  },
  {
    key: "hullMax",
    name: "Hull Plating",
    desc: "More hull HP.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(280 * Math.pow(1.35, lvl)),
  },
  {
    key: "thrusters",
    name: "Thrusters",
    desc: "Move faster.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(240 * Math.pow(1.34, lvl)),
  },
  {
    key: "pierce",
    name: "Piercing Core",
    desc: "Bullets pierce more targets.",
    currency: "crystals",
    max: 3,
    cost: (lvl) => Math.floor(70 * Math.pow(1.62, lvl)),
  },
  {
    key: "drone",
    name: "Drone Bay",
    desc: "Add an auto-firing drone.",
    currency: "crystals",
    max: 3,
    cost: (lvl) => Math.floor(90 * Math.pow(1.68, lvl)),
  },
  {
    key: "elite",
    name: "Elite Core",
    desc: "High-end tuning: moderate boost to core stats.",
    currency: "crystals",
    max: 5,
    cost: (lvl) => Math.floor(130 * Math.pow(1.72, lvl)),
  },
];

function updateTopBar() {
  levelEl.textContent = levelFromXp(SAVE.profile.xp);
  creditsEl.textContent = SAVE.profile.credits;
  crystalsEl.textContent = SAVE.profile.crystals;
  pilotPillEl.textContent = SAVE.profile.name;
  topCreditsEl.textContent = SAVE.profile.credits;
  topCrystalsEl.textContent = SAVE.profile.crystals;
}

function isAuthed() {
  return Boolean(CLOUD.enabled && CLOUD.user);
}

function signedInNow() {
  const sdkCurrentUser =
    window.firebase &&
    typeof window.firebase.auth === "function" &&
    window.firebase.auth() &&
    window.firebase.auth().currentUser
      ? window.firebase.auth().currentUser
      : null;
  if (!CLOUD.user && sdkCurrentUser) CLOUD.user = sdkCurrentUser;
  AUTH_RUNTIME.signedIn = Boolean(CLOUD.user);
  return AUTH_RUNTIME.signedIn;
}

function progressionRequiresAuth() {
  return FLAGS.isEnabled("guest_progress_requires_auth_v1", true);
}

function withDevDetails(message, detail = "") {
  const base = String(message || "");
  if (!DEV_MODE) return base;
  const d = String(detail || "").trim();
  if (!d) return base;
  return `${base} (${d})`;
}

function setOnlineHint(message, devDetail = "") {
  onlineHintEl.textContent = withDevDetails(message, devDetail);
}

function showToast(message, durationMs = 2200) {
  if (!toastEl) return;
  toastEl.textContent = String(message || "");
  toastEl.classList.remove("hidden");
  toastEl.classList.add("toast--show");
  if (showToast.timer) clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastEl.classList.remove("toast--show");
    toastEl.classList.add("hidden");
  }, durationMs);
}

function updateGuestSignInReminder(elapsedMs) {
  if (PORTAL_MODE) return;
  if (signedInNow()) return;
  if (!(state === STATE.RUN || state === STATE.PICK)) return;
  if (paused) return;
  SESSION.guestPlayMs += Math.max(0, Number(elapsedMs || 0));
  if (SESSION.guestPlayMs < SESSION.nextGuestReminderAtMs) return;
  showToast("Tip: Sign in to save your progress and join global leaderboard.", GUEST_REMINDER_DURATION_MS);
  SESSION.nextGuestReminderAtMs += GUEST_REMINDER_INTERVAL_MS;
}

function buildRunSharePayload(score, wave) {
  const safeScore = Math.max(0, Math.floor(Number(score || 0)));
  const safeWave = Math.max(1, Math.floor(Number(wave || 1)));
  const origin = (() => {
    try {
      return window.location.origin || "https://stellarsiege.site";
    } catch {
      return "https://stellarsiege.site";
    }
  })();
  const link =
    `${origin}/?ref=share&utm_source=share&utm_campaign=runshare` +
    `&score=${encodeURIComponent(safeScore)}&wave=${encodeURIComponent(safeWave)}`;
  const text = `I scored ${safeScore} at wave ${safeWave}. Beat my run in Stellar Siege`;
  return { link, text };
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(String(text));
      return true;
    }
  } catch {
    // ignore clipboard errors
  }
  try {
    const tmp = document.createElement("textarea");
    tmp.value = String(text);
    tmp.setAttribute("readonly", "readonly");
    tmp.style.position = "absolute";
    tmp.style.left = "-9999px";
    document.body.appendChild(tmp);
    tmp.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(tmp);
    return ok;
  } catch {
    return false;
  }
}

async function shareRunScore(score, wave, preferred = "native") {
  const payload = buildRunSharePayload(score, wave);
  const canNative = typeof navigator.share === "function";
  if (preferred === "native" && canNative) {
    try {
      await navigator.share({
        title: "Stellar Siege",
        text: payload.text,
        url: payload.link,
      });
      return { ok: true, method: "webshare" };
    } catch {
      // fallback below
    }
  }
  const copied = await copyText(`${payload.text}\n${payload.link}`);
  return copied ? { ok: true, method: "clipboard" } : { ok: false, method: "none" };
}

// -----------------------------
// UI wiring (now your clicks work)
// -----------------------------

playSurvivalBtn.addEventListener("click", () => {
  trackEvent("menu_click", { target: "survival" });
  startRun(MODE.SURVIVAL);
});
playCampaignBtn.addEventListener("click", () => {
  trackEvent("menu_click", { target: "campaign" });
  renderCampaignMissions();
  setState(STATE.CAMPAIGN);
});
hangarBtn.addEventListener("click", () => {
  trackEvent("menu_click", { target: "hangar" });
  openHangarRoute();
});
leaderboardBtn.addEventListener("click", () => {
  trackEvent("menu_click", { target: "leaderboard" });
  renderLeaderboard("local");
  setState(STATE.LEADERBOARD);
});
onlineBtn.addEventListener("click", () => {
  trackEvent("menu_click", { target: "online" });
  if (PORTAL_MODE) {
    showToast("Online mode is disabled in portal build.");
    return;
  }
  cloudInit();
  if (!CLOUD.enabled || !CLOUD.rtdb) {
    showToast("Online duel is coming soon.");
    return;
  }
  onlineInit();
  setState(STATE.ONLINE);
});

function openSettingsOverlay() {
  applySettingsUi();
  setState(STATE.SETTINGS);
}

settingsBtn.addEventListener("click", () => {
  trackEvent("menu_click", { target: "settings" });
  openSettingsOverlay();
});

function openInfoOverlay() {
  renderInfoShips();
  infoOverlayEl.classList.remove("hidden");
}

infoBtn.addEventListener("click", openInfoOverlay);

function exitHangarToHome(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  setMenuOpen(false);
  setState(STATE.MENU);
}

backFromHangarBtn.addEventListener("click", exitHangarToHome);
backFromHangarBtn.addEventListener("pointerup", exitHangarToHome);
backFromHangarBtn.addEventListener("touchend", exitHangarToHome, { passive: false });
if (hangarHomeBtn) {
  hangarHomeBtn.addEventListener("click", exitHangarToHome);
  hangarHomeBtn.addEventListener("pointerup", exitHangarToHome);
  hangarHomeBtn.addEventListener("touchend", exitHangarToHome, { passive: false });
}
backFromLeaderboardBtn.addEventListener("click", () => setState(STATE.MENU));
backFromCampaignBtn.addEventListener("click", () => setState(STATE.MENU));
backFromOnlineBtn.addEventListener("click", () => setState(STATE.MENU));
backFromSettingsBtn.addEventListener("click", () => setState(STATE.MENU));

infoCloseBtn.addEventListener("click", () => {
  infoOverlayEl.classList.add("hidden");
});

infoFullscreenBtn.addEventListener("click", () => {
  toggleFullscreen(document.documentElement);
});

function renderInfoShips() {
  const container = infoOverlayEl.querySelector(".infoShips");
  if (!container) return;
  container.innerHTML = "";
  const maxU = maxUpgrades();
  SHIPS.forEach((s) => {
    const stats = computePermanentStats(s.id, maxU, 999999);
    const bars = statBars(stats)
      .map(
        (b) => `
        <div class="statBarRow">
          <span>${b.label}</span>
          <div class="statBar"><div class="statBar__fill" style="width:${Math.round(b.value * 100)}%"></div></div>
        </div>`
      )
      .join("");
    const card = document.createElement("div");
    card.className = "shipCard";
    card.innerHTML = `
      <div class="shipCard__header">
        <strong>${s.name}</strong>
        <span class="pill">${s.rarity}</span>
      </div>
      <div class="shipCard__art">${shipSvg(s.id, 2)}</div>
      <div class="statBars">${bars}</div>
    `;
    container.appendChild(card);
  });
}

sideInfoBtn.addEventListener("click", openInfoOverlay);

tabLocalBtn.addEventListener("click", () => {
  tabLocalBtn.classList.add("tab--active");
  tabGlobalBtn.classList.remove("tab--active");
  renderLeaderboard("local");
});

tabGlobalBtn.addEventListener("click", () => {
  tabGlobalBtn.classList.add("tab--active");
  tabLocalBtn.classList.remove("tab--active");
  renderLeaderboard("global");
});

leaderboardListEl.addEventListener("click", (event) => {
  const btn = event.target && event.target.closest ? event.target.closest(".lbChallengeBtn") : null;
  if (!btn) return;
  const targetName = decodeURIComponent(String(btn.getAttribute("data-lb-name") || ""));
  const targetUser = decodeURIComponent(String(btn.getAttribute("data-lb-user") || ""));
  sendLeaderboardChallenge(targetName, targetUser).catch(() => {
    showToast("Unable to prepare duel request.");
  });
});

buy100Btn.addEventListener("click", () => {
  startCrystalPurchase("crystals_100").catch((err) => {
    console.warn("[PAY] failed", err);
    alert(`Purchase failed: ${err && err.message ? err.message : "unknown error"}`);
  });
});

buy550Btn.addEventListener("click", () => {
  startCrystalPurchase("crystals_550").catch((err) => {
    console.warn("[PAY] failed", err);
    alert(`Purchase failed: ${err && err.message ? err.message : "unknown error"}`);
  });
});

buyCredits10kBtn.addEventListener("click", () => {
  startCrystalPurchase("credits_10000").catch((err) => {
    console.warn("[PAY] failed", err);
    alert(`Purchase failed: ${err && err.message ? err.message : "unknown error"}`);
  });
});

buyCredits65kBtn.addEventListener("click", () => {
  startCrystalPurchase("credits_65000").catch((err) => {
    console.warn("[PAY] failed", err);
    alert(`Purchase failed: ${err && err.message ? err.message : "unknown error"}`);
  });
});

convertBtn.addEventListener("click", () => {
  const spend = Math.min(50, SAVE.profile.crystals);
  if (spend <= 0) {
    showToast("Need crystals to convert.");
    return;
  }
  SAVE.profile.crystals -= spend;
  SAVE.profile.credits += spend * 200;
  // Never allow the client to "create" crystals. Shadow follows spending.
  SAVE.profile.crystalsShadow = Math.min(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
  saveNow();
  if (isAuthed()) cloudPush().catch(() => {});
  renderHangar();
  updateTopBar();
  showToast(`Converted ${spend} crystals into ${spend * 200} credits.`);
});

restartBtn.addEventListener("click", () => restartActiveRun());
toMenuBtn.addEventListener("click", () => {
  onlineLeaveRoom();
  setState(STATE.MENU);
});

shareScoreBtn.addEventListener("click", async () => {
  const res = await shareRunScore(finalScoreEl.textContent, finalWaveEl.textContent, "native");
  if (res.ok) {
    showToast(res.method === "webshare" ? "Shared." : "Share text copied.");
  } else {
    showToast("Share unavailable right now.");
  }
});

if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", async () => {
    const payload = buildRunSharePayload(finalScoreEl.textContent, finalWaveEl.textContent);
    const ok = await copyText(payload.link);
    showToast(ok ? "Link copied." : "Clipboard unavailable.");
  });
}

if (challengeFriendBtn) {
  challengeFriendBtn.addEventListener("click", async () => {
    const res = await shareRunScore(finalScoreEl.textContent, finalWaveEl.textContent, "native");
    if (res.ok) {
      showToast(res.method === "webshare" ? "Challenge sent." : "Challenge copied.");
    } else {
      showToast("Unable to challenge right now.");
    }
  });
}

function setMenuOpen(open) {
  sideMenuEl.classList.toggle("hidden", !open);
}

menuBtn.addEventListener("click", () => {
  const open = sideMenuEl.classList.contains("hidden");
  setMenuOpen(open);
});

menuResumeBtn.addEventListener("click", () => {
  setMenuOpen(false);
  if (state === STATE.RUN) setPaused(false);
});

menuHomeBtn.addEventListener("click", () => {
  setMenuOpen(false);
  onlineLeaveRoom();
  setState(STATE.MENU);
});

menuRestartBtn.addEventListener("click", () => {
  setMenuOpen(false);
  if (state === STATE.RUN || state === STATE.OVER) restartActiveRun();
});

menuCampaignBtn.addEventListener("click", () => {
  setMenuOpen(false);
  renderCampaignMissions();
  setState(STATE.CAMPAIGN);
});

menuHangarBtn.addEventListener("click", () => {
  setMenuOpen(false);
  openHangarRoute();
});

menuLeaderboardBtn.addEventListener("click", () => {
  setMenuOpen(false);
  renderLeaderboard("local");
  setState(STATE.LEADERBOARD);
});

menuOnlineBtn.addEventListener("click", () => {
  setMenuOpen(false);
  if (PORTAL_MODE) {
    showToast("Online mode is disabled in portal build.");
    return;
  }
  cloudInit();
  if (!CLOUD.enabled || !CLOUD.rtdb) {
    showToast("Online duel is coming soon.");
    return;
  }
  onlineInit();
  setState(STATE.ONLINE);
});

menuSettingsBtn.addEventListener("click", () => {
  setMenuOpen(false);
  openSettingsOverlay();
});

menuResetBtn.addEventListener("click", () => {
  setMenuOpen(false);
  const ok = confirm("Reset ALL local progress (ships, upgrades, leaderboard)? This cannot be undone.");
  if (!ok) return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
  window.location.reload();
});

if (tapAssistToggle) {
  tapAssistToggle.addEventListener("change", () => {
    SAVE.profile.aimTapAssistEnabled = Boolean(tapAssistToggle.checked);
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    applyAimAssistSettingsUI();
  });
}

if (stickyLockToggle) {
  stickyLockToggle.addEventListener("change", () => {
    SAVE.profile.aimStickyLockEnabled = Boolean(stickyLockToggle.checked);
    if (!SAVE.profile.aimStickyLockEnabled) clearAimTarget();
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    applyAimAssistSettingsUI();
    updateAutoLockButtonUi();
  });
}

if (aimAssistStrengthEl) {
  aimAssistStrengthEl.addEventListener("input", () => {
    SAVE.profile.aimAssistStrength = clamp(Math.floor(Number(aimAssistStrengthEl.value || 0)), 0, 100);
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    applyAimAssistSettingsUI();
  });
}

settingsMusicEnabledEl.addEventListener("change", () => {
  SAVE.profile.musicEnabled = Boolean(settingsMusicEnabledEl.checked);
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  applyAudioMix();
  syncAudioForState(state);
  applySettingsUi();
});

settingsMusicVolumeEl.addEventListener("input", () => {
  SAVE.profile.musicVolume = clamp(Math.floor(Number(settingsMusicVolumeEl.value || 0)), 0, 100);
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  applyAudioMix();
  applySettingsUi();
});

settingsShootSfxEl.addEventListener("change", () => {
  SAVE.profile.shootSfxEnabled = Boolean(settingsShootSfxEl.checked);
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  applySettingsUi();
});

settingsDestroySfxEl.addEventListener("change", () => {
  SAVE.profile.destroySfxEnabled = Boolean(settingsDestroySfxEl.checked);
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  applySettingsUi();
});

settingsHapticsEl.addEventListener("change", () => {
  SAVE.profile.hapticsEnabled = Boolean(settingsHapticsEl.checked);
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  applySettingsUi();
});

if (settingsDamageNumbersEl) {
  settingsDamageNumbersEl.addEventListener("change", () => {
    SAVE.profile.damageNumbersEnabled = Boolean(settingsDamageNumbersEl.checked);
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    applySettingsUi();
  });
}

if (settingsAdaptiveDifficultyEl) {
  settingsAdaptiveDifficultyEl.addEventListener("change", () => {
    SAVE.profile.adaptiveDifficultyEnabled = Boolean(settingsAdaptiveDifficultyEl.checked);
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    applySettingsUi();
  });
}

if (settingsFpsLimitEl) {
  settingsFpsLimitEl.addEventListener("change", () => {
    SAVE.profile.fpsLimit = Math.max(0, Math.min(60, Math.floor(Number(settingsFpsLimitEl.value || 0))));
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    applySettingsUi();
  });
}

settingsFullscreenToggleEl.addEventListener("change", () => {
  if (!shouldUseTouchControls()) {
    settingsFullscreenToggleEl.checked = Boolean(document.fullscreenElement);
    return;
  }
  const wantsFullscreen = Boolean(settingsFullscreenToggleEl.checked);
  const isFullscreen = Boolean(document.fullscreenElement);
  if (wantsFullscreen === isFullscreen) return;
  toggleFullscreen(document.documentElement).finally(() => {
    settingsFullscreenToggleEl.checked = Boolean(document.fullscreenElement);
  });
});

settingsNextTrackBtn.addEventListener("click", () => {
  unlockAudioIfNeeded();
  skipMenuTrack();
});

settingsLanguageEl.addEventListener("change", () => {
  SAVE.profile.language = normalizeLanguageCode(settingsLanguageEl.value || "en");
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  applyLanguageToUi();
  applySettingsUi();
  if (typeof updateAuthUi === "function") updateAuthUi();
});

settingsConsentAcceptBtn.addEventListener("click", () => {
  setAdConsentChoice(AD_CONSENT.GRANTED);
  renderAdConsentSettings();
  showToast("Ad preference saved.");
});

settingsConsentLimitedBtn.addEventListener("click", () => {
  setAdConsentChoice(AD_CONSENT.LIMITED);
  renderAdConsentSettings();
  showToast("Non-personalized ads selected.");
});

// Online buttons (real online requires Firebase / server config)
googleSignInBtn.addEventListener("click", () => onlineSignIn());
signOutBtn.addEventListener("click", () => onlineSignOut());
createRoomBtn.addEventListener("click", () => onlineCreateRoom());
joinRoomBtn.addEventListener("click", () => onlineJoinRoom(roomCodeEl.value));
startDuelBtn.addEventListener("click", () => onlineStartDuel());
roomCodeEl.addEventListener("input", () => {
  roomCodeEl.value = String(roomCodeEl.value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
});

// Top-right auth + account panel
topSignInBtn.addEventListener("click", () => {
  if (PORTAL_MODE) {
    showToast("Sign-in is disabled in portal build.");
    return;
  }
  onlineInit();
  setState(STATE.ONLINE);
});
topSignOutBtn.addEventListener("click", () => onlineSignOut());
topAccountBtn.addEventListener("click", () => {
  renderAccountPanel();
  setState(STATE.ACCOUNT);
});
guestSyncSignInBtn.addEventListener("click", () => {
  if (PORTAL_MODE) return;
  dismissGuestSyncBanner();
  cloudInit();
  if (!CLOUD.enabled) {
    showToast("Sign-in sync is unavailable right now.");
    return;
  }
  onlineInit();
  setState(STATE.ONLINE);
});
guestSyncCloseBtn.addEventListener("click", () => {
  dismissGuestSyncBanner();
});
closeAccountBtn.addEventListener("click", () => setState(STATE.MENU));
accountToOnlineBtn.addEventListener("click", () => {
  if (PORTAL_MODE) {
    showToast("Online mode is disabled in portal build.");
    return;
  }
  cloudInit();
  if (!CLOUD.enabled || !CLOUD.rtdb) {
    showToast("Online duel is coming soon.");
    return;
  }
  onlineInit();
  setState(STATE.ONLINE);
});
accountSignOutBtn.addEventListener("click", () => onlineSignOut());
accountSyncBtn.addEventListener("click", () => {
  cloudInit();
  if (!CLOUD.enabled || !CLOUD.user) return;
  cloudPullMerge()
    .then(() => {
      saveNow();
      updateTopBar();
      renderHangar();
      renderAccountPanel();
    })
    .catch(() => {});
});

if (consentAcceptBtn) {
  consentAcceptBtn.addEventListener("click", () => {
    setAdConsentChoice(AD_CONSENT.GRANTED);
    updateConsentBannerVisibility();
    showToast("Ad preference saved.");
  });
}

if (consentLimitedBtn) {
  consentLimitedBtn.addEventListener("click", () => {
    setAdConsentChoice(AD_CONSENT.LIMITED);
    updateConsentBannerVisibility();
    showToast("Non-personalized ads selected.");
  });
}

if (adProfileSafeBtn) {
  adProfileSafeBtn.addEventListener("click", () => {
    setAdProfileChoice(AD_PROFILE.SAFE);
    applyAdProfileRuntime(AD_PROFILE.SAFE);
    setAdProfileGateVisible(false);
    startAppBoot();
  });
}

if (adProfileStandardBtn) {
  adProfileStandardBtn.addEventListener("click", () => {
    setAdProfileChoice(AD_PROFILE.STANDARD);
    applyAdProfileRuntime(AD_PROFILE.STANDARD);
    setAdProfileGateVisible(false);
    startAppBoot();
  });
}

dailyCloseBtn.addEventListener("click", () => {
  dailyRewardEl.classList.add("hidden");
});

if (pauseResumeBtn) {
  pauseResumeBtn.addEventListener("click", () => {
    togglePauseOverlay(false);
  });
}

if (pauseMenuBtn) {
  pauseMenuBtn.addEventListener("click", () => {
    if (pauseOverlayEl) pauseOverlayEl.classList.add("hidden");
    run.active = false;
    setState(STATE.MENU);
  });
}

if (tutorialSkipBtn) {
  tutorialSkipBtn.addEventListener("click", () => closeTutorial(true));
}

if (tutorialNextBtn) {
  tutorialNextBtn.addEventListener("click", () => {
    const next = SESSION.tutorialStep + 1;
    if (next >= TUTORIAL_STEPS.length) {
      closeTutorial(true);
      return;
    }
    setTutorialStep(next);
  });
}

dailyClaimBtn.addEventListener("click", () => {
  grantDailyReward(1);
});

dailyDoubleBtn.addEventListener("click", async () => {
  if (ADS_DISABLED) return;
  const st = dailyRewardState();
  if (!st.claimable) return;
  const status = adRewardStatus();
  if (status.remaining <= 0) {
    showToast(`Daily rewarded cap reached (${ADS.dailyCap}/${ADS.dailyCap}).`);
    renderDailyRewardPopup();
    return;
  }
  if (status.sessionRemaining <= 0) {
    showToast(`Session rewarded cap reached (${ADS.sessionCap}/${ADS.sessionCap}).`);
    renderDailyRewardPopup();
    return;
  }
  if (status.waitMs > 0) {
    showToast(`Next rewarded ad in ${formatCooldown(status.waitMs)}.`);
    renderDailyRewardPopup();
    return;
  }
  if (adIntegrityBlocked()) {
    showToast("No ad available, try later.");
    renderDailyRewardPopup();
    return;
  }
  const provider = getRewardedProvider();
  if (!provider || !provider.isAvailable()) {
    showToast("No ad available, try later.");
    renderDailyRewardPopup();
    return;
  }
  dailyDoubleBtn.disabled = true;
  dailyDoubleBtn.textContent = "Starting Ad...";
  try {
    const adResult = await requestRewardedAdCompletion("daily_double", (remaining) => {
      dailyDoubleBtn.textContent = `Ad: ${remaining}s`;
    });
    if (!adResult || !adResult.completed) {
      const reason = String((adResult && adResult.reason) || "");
      if (reason === "returned_too_fast" || reason === "no_background_transition" || reason === "short_watch") {
        showToast(`Ad too short. Watch at least ${Math.ceil(AD_CONTINUE_MIN_AWAY_MS / 1000)}s.`);
      } else if (reason === "popup_blocked" || reason === "open_not_detected") {
        showToast("Allow popups for this site.");
      } else {
        showToast("Ad not completed. Try again.");
      }
      return;
    }
    if (!consumeAdRewardSlot()) {
      showToast("Rewarded ad unavailable. Try later.");
      return;
    }
    SAVE.profile.totalAdsClaimed = Number(SAVE.profile.totalAdsClaimed || 0) + 1;
    grantDailyReward(2);
  } catch {
    showToast("No ad available, try later.");
  } finally {
    dailyDoubleBtn.textContent = "Double Reward (Watch Ad)";
    renderDailyRewardPopup();
  }
});

if (missionRerollBtn) {
  missionRerollBtn.addEventListener("click", () => {
    rerollOneDailyMission();
  });
}

tierT1Btn.addEventListener("click", () => {
  if (SIMPLE_HANGAR_MODE) return;
  forcedPreviewTier = 1;
  if (state === STATE.HANGAR) renderHangar();
});

tierT2Btn.addEventListener("click", () => {
  if (SIMPLE_HANGAR_MODE) return;
  forcedPreviewTier = 2;
  if (state === STATE.HANGAR) renderHangar();
});

tierT3Btn.addEventListener("click", () => {
  if (SIMPLE_HANGAR_MODE) return;
  forcedPreviewTier = 3;
  if (state === STATE.HANGAR) renderHangar();
});

// -----------------------------
// Game + UI implementation
// -----------------------------

pilotPillEl.addEventListener("click", async () => {
  const titles = Array.isArray(SAVE.profile.unlockedTitles) ? SAVE.profile.unlockedTitles.slice() : ["Cadet"];
  if (titles.length > 1) {
    const changeTitle = confirm("OK = Change title, Cancel = Change username");
    if (changeTitle) {
      const raw = prompt(`Choose title:\n${titles.join(", ")}`, SAVE.profile.selectedTitle || titles[0]);
      if (!raw) return;
      const nextTitle = titles.find((title) => title.toLowerCase() === String(raw).trim().toLowerCase());
      if (!nextTitle) {
        showToast("Title not unlocked.");
        return;
      }
      SAVE.profile.selectedTitle = nextTitle;
      SAVE.profile.updatedAt = nowMs();
      saveNow();
      renderHangar();
      updateTopBar();
      return;
    }
  }
  const next = prompt("Username (3-20 chars, letters/numbers/_):", SAVE.profile.name);
  if (!next) return;
  const cleaned = cleanUsernameInput(next);
  if (!isValidUsername(cleaned)) {
    alert("Username must be 3-20 characters and use only letters, numbers, or underscore.");
    return;
  }

  cloudInit();
  if (isAuthed()) {
    const claim = await claimUniqueUsername(cleaned);
    if (!claim.ok) {
      if (claim.code === "taken") alert("That username is already taken.");
      else alert("Could not update username right now.");
      return;
    }
  } else {
    SAVE.profile.name = cleaned;
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    updateTopBar();
  }
  renderHangar();
});

function gameplayVisualTierForShip(shipId) {
  return tierFromIndex(upgradeTier(ensureShipState(shipId).upgrades) + 1);
}

function previewVisualTierForShip(shipId) {
  const baseTier = gameplayVisualTierForShip(shipId);
  return tierFromIndex(forcedPreviewTier || baseTier);
}

function setTierPickerState(tier) {
  const t = tierFromIndex(tier);
  tierT1Btn.classList.toggle("tierPicker__active", t === 1);
  tierT2Btn.classList.toggle("tierPicker__active", t === 2);
  tierT3Btn.classList.toggle("tierPicker__active", t === 3);
}

async function renderShipPreview(shipId, tier, locked = false) {
  const t = tierFromIndex(tier);
  setTierPickerState(t);
  if (SIMPLE_HANGAR_MODE) {
    shipModelEl.innerHTML = shipSvg(shipId, t - 1);
    return;
  }
  if (!window.ship3D || typeof window.ship3D.ensureHangar !== "function") {
    shipModelEl.innerHTML = shipSvg(shipId, t - 1);
    return;
  }
  try {
    const ok = await window.ship3D.ensureHangar(shipModelEl);
    if (!ok) {
      shipModelEl.innerHTML = shipSvg(shipId, t - 1);
      return;
    }
    window.ship3D.setHangarShip(shipId, t, locked);
  } catch {
    shipModelEl.innerHTML = shipSvg(shipId, t - 1);
  }
}

async function ensureGame3DShip() {
  if (!window.ship3D || typeof window.ship3D.ensureGame !== "function") {
    game3DReady = false;
    return false;
  }
  try {
    const ok = await window.ship3D.ensureGame(gameRootEl, WORLD.width, WORLD.height);
    if (!ok) {
      game3DReady = false;
      return false;
    }
    const shipId = SAVE.profile.selectedShipId;
    const tier = gameplayVisualTierForShip(shipId);
    const key = `${shipId}:${tier}`;
    if (key !== currentGameShipKey) {
      window.ship3D.setGameShip(shipId, tier);
      currentGameShipKey = key;
    }
    game3DReady = true;
    return true;
  } catch {
    game3DReady = false;
    return false;
  }
}

function updateGame3DFrame() {
  if (!game3DReady || !window.ship3D || typeof window.ship3D.updateGamePlayer !== "function") return;
  const selectedState = ensureShipState(SAVE.profile.selectedShipId);
  const tier = gameplayVisualTierForShip(SAVE.profile.selectedShipId);
  const shieldRatio = player.shieldMax > 0 ? player.shield / player.shieldMax : 0;
  if (typeof window.ship3D.syncGameEntities === "function") {
    const enemies = entities.enemies.map((e) => ({
      id: e.id,
      type: e.type,
      x: e.x,
      y: e.y,
      angle: Math.atan2(player.y - e.y, player.x - e.x),
      size: e.size,
      elite: Boolean(e.elite),
      hp: e.hp,
      maxHp: e.maxHp,
    }));
    const drones = entities.drones.map((d, idx) => ({
      id: `d${idx}`,
      x: d.x,
      y: d.y,
      angle: d.angle || 0,
    }));
    window.ship3D.syncGameEntities({ enemies, drones });
  }
  window.ship3D.updateGamePlayer({
    x: player.x,
    y: player.y,
    angle: player.angle,
    tier,
    thrusterLevel: selectedState.upgrades.thrusters || 0,
    shieldLevel: (selectedState.upgrades.shieldMax || 0) + (selectedState.upgrades.hullMax || 0),
    weaponLevel: (selectedState.upgrades.damage || 0) + (selectedState.upgrades.fireRate || 0),
    shooting: Boolean(input.shooting),
    shieldRatio,
  });
}

function renderHangarRewardedActions() {
  if (ADS_DISABLED) {
    hangarAdCreditsBtn.classList.add("hidden");
    hangarAdCrystalsBtn.classList.add("hidden");
    hangarAdCreditsBtn.disabled = true;
    hangarAdCrystalsBtn.disabled = true;
    hangarAdCreditsBtn.onclick = null;
    hangarAdCrystalsBtn.onclick = null;
    return;
  }

  hangarAdCreditsBtn.classList.remove("hidden");
  hangarAdCrystalsBtn.classList.remove("hidden");

  const providerReady = hasRewardedAdapter();
  const status = adRewardStatus();
  const lockReason =
    !providerReady
      ? "Rewarded ads unavailable."
      : status.remaining <= 0
      ? `Daily cap reached (${ADS.dailyCap}/${ADS.dailyCap}).`
      : status.sessionRemaining <= 0
      ? `Session cap reached (${ADS.sessionCap}/${ADS.sessionCap}).`
      : status.waitMs > 0
      ? `Cooldown: ${formatCooldown(status.waitMs)}`
      : "";

  const setBtn = (btn, label) => {
    btn.textContent = label;
    btn.disabled = Boolean(lockReason);
    btn.title = lockReason;
    btn.onclick = null;
  };

  setBtn(hangarAdCreditsBtn, "Watch Ad → +420 Credits");
  setBtn(hangarAdCrystalsBtn, "Watch Ad → +2 Crystals (+120 Credits)");
  if (lockReason) {
    return;
  }

  console.info("rewarded_shown", { placement: "hangar" });
  trackEvent("rewarded_shown", { placement: "hangar" });

  hangarAdCreditsBtn.onclick = async () => {
    await tryRewardedPlacement({
      placement: "hangar_credits",
      cfg: AD_REWARDS.hangar_credits,
      buttonEl: hangarAdCreditsBtn,
      textEl: null,
    });
    renderHangarRewardedActions();
  };

  hangarAdCrystalsBtn.onclick = async () => {
    await tryRewardedPlacement({
      placement: "hangar_crystals",
      cfg: AD_REWARDS.hangar_crystals,
      buttonEl: hangarAdCrystalsBtn,
      textEl: null,
    });
    renderHangarRewardedActions();
  };
}

function achievementUnlocked(id) {
  return Boolean(SAVE.profile.achievementUnlocks && SAVE.profile.achievementUnlocks[id]);
}

function unlockAchievement(id) {
  if (!id) return false;
  if (!SAVE.profile.achievementUnlocks || typeof SAVE.profile.achievementUnlocks !== "object") {
    SAVE.profile.achievementUnlocks = {};
  }
  if (SAVE.profile.achievementUnlocks[id]) return false;
  SAVE.profile.achievementUnlocks[id] = nowMs();
  const title = ACHIEVEMENT_TITLES[id];
  if (title) {
    if (!Array.isArray(SAVE.profile.unlockedTitles)) SAVE.profile.unlockedTitles = ["Cadet"];
    if (!SAVE.profile.unlockedTitles.includes(title)) SAVE.profile.unlockedTitles.push(title);
  }
  saveNow();
  showToast(`Achievement unlocked: ${(ACHIEVEMENTS.find((a) => a.id === id) || { name: id }).name}`);
  return true;
}

function evaluateAchievements(lastReason = "") {
  const ownedShips = SHIPS.filter((s) => ensureShipState(s.id).owned).length;
  const totalAbilityUses = Object.values(SAVE.profile.abilityUses || {}).reduce(
    (sum, v) => sum + Math.max(0, Math.floor(Number(v || 0))),
    0
  );
  const bossKills = Number(SAVE.profile.bossKills || 0);
  const checks = {
    survivor_1: Number(SAVE.profile.gamesSurvival || 0) >= 1,
    survivor_10: Number(SAVE.profile.bestWave || 1) >= 10,
    survivor_20: Number(SAVE.profile.bestWave || 1) >= 20,
    survivor_35: Number(SAVE.profile.bestWave || 1) >= 35,
    kills_500: Number(SAVE.profile.totalKills || 0) >= 500,
    kills_2000: Number(SAVE.profile.totalKills || 0) >= 2000,
    credits_50k: Number(SESSION.creditsEarned || 0) >= 50000 || Number(SAVE.profile.totalCreditsEarned || 0) >= 50000,
    campaign_3: Number(SAVE.profile.campaignUnlocked || 1) >= 3,
    campaign_6: Number(SAVE.profile.campaignUnlocked || 1) >= 6,
    campaign_12: Number(SAVE.profile.campaignUnlocked || 1) >= 12,
    duel_win_1: Number(SAVE.profile.onlineWins || 0) >= 1,
    duel_win_25: Number(SAVE.profile.onlineWins || 0) >= 25,
    ability_10: totalAbilityUses >= 10,
    ability_100: totalAbilityUses >= 100,
    daily_7: Number(SAVE.profile.dailyStreakDay || 0) >= 7,
    ships_5: ownedShips >= 5,
    ships_10: ownedShips >= 10,
    tree_10: accountTreeTotalRanks() >= 10,
    tree_25: accountTreeTotalRanks() >= 25,
    boss_15: bossKills >= 15,
  };

  let changed = false;
  ACHIEVEMENTS.forEach((achievement) => {
    if (!checks[achievement.id]) return;
    changed = unlockAchievement(achievement.id) || changed;
  });
  if (changed) {
    SAVE.profile.updatedAt = nowMs();
    saveNow();
  }
  if (lastReason) LOG.debug("achievements_evaluated", { reason: lastReason, changed });
}

function renderAchievementPanel() {
  if (!achievementPanelEl) return;
  const rows = ACHIEVEMENTS.map((item) => {
    const unlocked = achievementUnlocked(item.id);
    const unlockedAt = unlocked ? Number(SAVE.profile.achievementUnlocks[item.id] || 0) : 0;
    const date = unlockedAt ? new Date(unlockedAt).toLocaleDateString() : "";
    return `<div class="achievementRow ${unlocked ? "is-unlocked" : ""}">
      <strong>${item.name}</strong>
      <div>${item.desc}</div>
      <div style="opacity:.7">${unlocked ? `Unlocked ${date}` : "Locked"}</div>
    </div>`;
  }).join("");
  achievementPanelEl.innerHTML = rows;
}

function buyAccountTreeNode(nodeKey) {
  const tree = ensureAccountTreeState();
  const node = ACCOUNT_TREE_NODES.find((item) => item.key === nodeKey);
  if (!node) return false;
  const current = Math.max(0, Math.floor(Number(tree[node.key] || 0)));
  if (current >= node.max) return false;
  const cost = Math.max(0, Math.floor(Number(node.cost(current) || 0)));
  if (Number(SAVE.profile.credits || 0) < cost) {
    showToast(`Need ${cost} credits.`);
    return false;
  }
  SAVE.profile.credits -= cost;
  tree[node.key] = current + 1;
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  updateTopBar();
  evaluateAchievements("account_tree_buy");
  return true;
}

function renderAccountTree() {
  if (!upgradeTreeEl) return;
  const tree = ensureAccountTreeState();
  upgradeTreeEl.innerHTML = ACCOUNT_TREE_NODES.map((node) => {
    const rank = Math.max(0, Math.floor(Number(tree[node.key] || 0)));
    const maxed = rank >= node.max;
    const cost = Math.max(0, Math.floor(Number(node.cost(rank) || 0)));
    return `<div class="treeNode" data-tree-node="${node.key}">
      <strong>${node.branch}: ${node.name}</strong>
      <div class="treeNode__meta">${node.desc}</div>
      <div class="treeNode__row">
        <span>Rank ${rank}/${node.max}</span>
        <button class="btn" data-tree-buy="${node.key}" ${maxed ? "disabled" : ""}>
          ${maxed ? "Maxed" : `Upgrade (${cost})`}
        </button>
      </div>
    </div>`;
  }).join("");

  upgradeTreeEl.querySelectorAll("[data-tree-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = String(btn.getAttribute("data-tree-buy") || "");
      if (!key) return;
      const bought = buyAccountTreeNode(key);
      if (!bought) return;
      showToast("Command tree upgraded.");
      renderAccountTree();
      renderHangar();
    });
  });
}

function renderHangar() {
  if (isPhoneHangarDisabled()) return;
  cloudInit();
  if (!unlockFxTimer) unlockFxEl.classList.add("hidden");

  const authed = isAuthed();
  const selectedShip = shipById(SAVE.profile.selectedShipId);
  const selectedState = ensureShipState(selectedShip.id);
  const activeTitle = String(SAVE.profile.selectedTitle || "Cadet");
  pilotPillEl.textContent = `${SAVE.profile.name} · ${activeTitle}`;
  storeCardEl.classList.toggle("hidden", PORTAL_MODE || !PAYMENTS_ENABLED);
  hangarAuthWaitScheduled = false;

  const storeHardDisabled = PORTAL_MODE || !PAYMENTS_ENABLED;
  buy100Btn.disabled = storeHardDisabled;
  buy550Btn.disabled = storeHardDisabled;
  buyCredits10kBtn.disabled = storeHardDisabled;
  buyCredits65kBtn.disabled = storeHardDisabled;
  convertBtn.disabled = false;
  if (!PAYMENTS_ENABLED) {
    buy100Btn.title = "Store coming soon.";
    buy550Btn.title = "Store coming soon.";
    buyCredits10kBtn.title = "Store coming soon.";
    buyCredits65kBtn.title = "Store coming soon.";
  } else if (!isHosted()) {
    buy100Btn.title = "Store requires a hosted build.";
    buy550Btn.title = "Store requires a hosted build.";
    buyCredits10kBtn.title = "Store requires a hosted build.";
    buyCredits65kBtn.title = "Store requires a hosted build.";
  } else if (!authed) {
    buy100Btn.title = "Tap to sign in, then purchase.";
    buy550Btn.title = "Tap to sign in, then purchase.";
    buyCredits10kBtn.title = "Tap to sign in, then purchase.";
    buyCredits65kBtn.title = "Tap to sign in, then purchase.";
  } else {
    buy100Btn.title = "";
    buy550Btn.title = "";
    buyCredits10kBtn.title = "";
    buyCredits65kBtn.title = "";
  }

  // Ship picker
  shipPickerEl.innerHTML = "";
  SHIPS.forEach((s) => {
    const st = ensureShipState(s.id);
    const btn = document.createElement("button");
    btn.className = "shipBtn";
    if (s.id === selectedShip.id) btn.classList.add("shipBtn--active");
    if (!st.owned) btn.classList.add("shipBtn--locked");
    btn.textContent = st.owned
      ? s.name
      : `${s.name} · ${s.priceCrystals ? `${s.priceCrystals}C` : `${s.priceCredits} cr`}`;
    btn.title = st.owned ? `${s.name} (${s.rarity})` : `${s.name} (Locked - ${s.priceCrystals ? s.priceCrystals + " crystals" : s.priceCredits + " credits"})`;
    btn.addEventListener("click", () => {
      // Allow selecting owned ships freely.
      if (st.owned) {
        if (SAVE.profile.selectedShipId === s.id) return;
        SAVE.profile.selectedShipId = s.id;
        SAVE.profile.updatedAt = nowMs();
        saveNow();
        showToast(`${s.name} selected.`);
        renderHangar();
        return;
      }

      // Locked ship: select for preview and offer purchase immediately.
      if (SAVE.profile.selectedShipId !== s.id) {
        SAVE.profile.selectedShipId = s.id;
        SAVE.profile.updatedAt = nowMs();
        saveNow();
      }

      const costText = s.priceCrystals ? `${s.priceCrystals} crystals` : `${s.priceCredits} credits`;
      const ok = confirm(`Unlock ${s.name} for ${costText}?`);
      if (!ok) {
        renderHangar();
        return;
      }

      if (s.priceCrystals) {
        if (SAVE.profile.crystals < s.priceCrystals) {
          showToast(`Need ${s.priceCrystals} crystals.`);
          return;
        }
        SAVE.profile.crystals -= s.priceCrystals;
      } else {
        if (SAVE.profile.credits < s.priceCredits) {
          showToast(`Need ${s.priceCredits} credits.`);
          return;
        }
        SAVE.profile.credits -= s.priceCredits;
      }

      st.owned = true;
      SAVE.profile.selectedShipId = s.id;
      SAVE.profile.updatedAt = nowMs();
      saveNow();
      if (CLOUD.enabled && CLOUD.user) cloudPush().catch(() => {});
      unlockFxEl.classList.remove("hidden");
      unlockFxEl.textContent = `${s.name} Unlocked!`;
      if (unlockFxTimer) clearTimeout(unlockFxTimer);
      unlockFxTimer = setTimeout(() => {
        unlockFxEl.classList.add("hidden");
        unlockFxTimer = null;
      }, 1800);
      if (window.ship3D && typeof window.ship3D.playUnlockEffect === "function") {
        window.ship3D.playUnlockEffect();
      }
      showToast(`${s.name} unlocked.`);
      evaluateAchievements("ship_unlock");
      renderHangar();
      updateTopBar();
    });
    shipPickerEl.appendChild(btn);
  });

  tierPickerEl.classList.toggle("hidden", SIMPLE_HANGAR_MODE);
  const tier = SIMPLE_HANGAR_MODE
    ? gameplayVisualTierForShip(selectedShip.id)
    : previewVisualTierForShip(selectedShip.id);
  void renderShipPreview(selectedShip.id, tier, !selectedState.owned);

  // Stats preview for current ship
  const base = computePermanentStats(selectedShip.id);
  const ability = abilityForShip(selectedShip.id);
  const statRows = [
    ["Pilot", `${SAVE.profile.name} (Lvl ${base.pilotLevel})`],
    ["Title", `${SAVE.profile.selectedTitle || "Cadet"}`],
    ["Ship", `${base.shipName} (${selectedShip.rarity})`],
    ["Ability", `${ability.name} · CD ${ability.cooldown}s`],
    ["Damage", base.damage.toFixed(2)],
    ["Fire Rate", `${(1 / base.fireRate).toFixed(1)} shots/s`],
    ["Bullet Speed", Math.floor(base.bulletSpeed)],
    ["Speed", Math.floor(base.speed)],
    ["Shield", base.shieldMax],
    ["Shield Regen", `${base.shieldRegen.toFixed(1)}/s`],
    ["Hull", base.hullMax],
    ["Pierce", base.pierce],
    ["Drones", base.droneCount],
    ["Elite", `${selectedState.upgrades.elite}/5`],
  ];

  const bars = statBars(base)
    .map(
      (b) => `
      <div class="statBarRow">
        <span>${b.label}</span>
        <div class="statBar"><div class="statBar__fill" style="width:${Math.round(b.value * 100)}%"></div></div>
      </div>`
    )
    .join("");

  statsBoxEl.innerHTML =
    statRows.map((r) => `<div class="statRow"><span>${r[0]}</span><span>${r[1]}</span></div>`).join("") +
    `<div class="statBars">${bars}</div>`;

  // Upgrades (guest/local first)
  upgradeListEl.innerHTML = "";
  renderAccountTree();
  renderAchievementPanel();

  if (!selectedState.owned) {
    upgradeListEl.innerHTML = `<div class="fine">This ship is locked. Buy it to upgrade.</div>`;
    renderHangarRewardedActions();
    return;
  }

  PERM_UPGRADES.forEach((def) => {
    const lvl = selectedState.upgrades[def.key] || 0;
    const cost = def.cost(lvl);
    const canBuy =
      lvl < def.max &&
      (def.currency === "credits" ? SAVE.profile.credits >= cost : SAVE.profile.crystals >= cost);

    const row = document.createElement("div");
    row.className = "upgRow";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="upgName">${def.name} <span style="opacity:.7">(Lv ${lvl}/${def.max})</span></div>
      <div class="upgDesc">${def.desc}</div>
    `;

    const btn = document.createElement("button");
    btn.className = "btn";
    if (lvl >= def.max) {
      btn.textContent = "Max";
      btn.disabled = true;
    } else if (canBuy) {
      btn.textContent = `Buy ${cost} ${def.currency}`;
      btn.disabled = false;
    } else {
      btn.textContent = `Need ${cost} ${def.currency}`;
      btn.disabled = false;
    }
    btn.addEventListener("click", () => {
      if (lvl >= def.max) return;
      if (def.currency === "credits") {
        if (SAVE.profile.credits < cost) {
          showToast(`Need ${cost} credits.`);
          return;
        }
        SAVE.profile.credits -= cost;
      } else {
        if (SAVE.profile.crystals < cost) {
          showToast(`Need ${cost} crystals.`);
          return;
        }
        SAVE.profile.crystals -= cost;
      }
      selectedState.upgrades[def.key] = lvl + 1;
      SAVE.profile.updatedAt = nowMs();
      saveNow();
      updateTopBar();
      cloudPush().catch(() => {});
      showToast(`${def.name} upgraded to Lv ${lvl + 1}.`);
      renderHangar();
    });

    row.appendChild(left);
    row.appendChild(btn);
    upgradeListEl.appendChild(row);
  });

  renderHangarRewardedActions();
  renderAccountTree();
  renderAchievementPanel();
}

async function renderLeaderboard(which) {
  if (which === "global") {
    renderLeaderboardMeta("global");
    renderGlobalLeaderboard();
    return;
  }

  renderLeaderboardMeta("local");
  cloudInit();

  if (CLOUD.enabled && CLOUD.user && CLOUD.firestore) {
    const bubble = ensureLocalBubbleProfile();
    const bubbleId = String((bubble && bubble.id) || SAVE.profile.localBubbleId || "");
    if (bubbleId) {
      leaderboardListEl.innerHTML = `<div class="fine">Loading local bubble leaderboard...</div>`;
      try {
        const snap = await CLOUD.firestore
          .collection("leaderboard_players")
          .where("bubbleId", "==", bubbleId)
          .limit(120)
          .get();
        const rows = snap.docs
          .map((d) => d.data() || {})
          .filter((d) => Number(d.gamesPlayed || 0) > 0)
          .sort(leaderboardRankComparator)
          .slice(0, 25);

        renderLeaderboardMeta("local", `Your bubble: ${(bubble && bubble.name) || SAVE.profile.localBubbleName || "Local Squad"}.`);
        if (rows.length === 0) {
          leaderboardListEl.innerHTML = `<div class="fine">No rivals in your local bubble yet. Play online duels to seed it.</div>`;
          return;
        }
        leaderboardListEl.innerHTML = rows
          .map((e, i) => {
            const wins = Number(e.onlineWins || 0);
            const losses = Number(e.onlineLosses || 0);
            const points = Number(e.points || wins * 3);
            const name = String(e.name || "Pilot").slice(0, 40);
            const username = String(e.username || e.name || "pilot").slice(0, 20);
            return `
              <div class="lbRow">
                <div class="lbRank">#${i + 1}</div>
                <div>
                  <div class="lbName">${name} <span style="opacity:.65">@${username}</span></div>
                  <div style="opacity:.72; font-size:12px">W ${wins} · L ${losses} · Bubble ${safeBubbleName(e.bubbleName || SAVE.profile.localBubbleName)}</div>
                </div>
                <div class="lbRow__right">
                  <div class="lbScore">${points} pts</div>
                  <button class="lbChallengeBtn" data-lb-name="${encodeURIComponent(name)}" data-lb-user="${encodeURIComponent(username)}">Request Duel</button>
                </div>
              </div>
            `;
          })
          .join("");
        return;
      } catch (err) {
        console.warn("[CLOUD] local bubble leaderboard failed", err);
      }
    }
  }

  const rows = (SAVE.leaderboard || []).slice(0, 10);
  if (rows.length === 0) {
    leaderboardListEl.innerHTML = `<div class="fine">No runs yet. Play Survival and come back.</div>`;
    return;
  }

  leaderboardListEl.innerHTML = rows
    .map((e, i) => {
      const mode = e.mode === MODE.CAMPAIGN ? "C" : e.mode === MODE.DUEL ? "D" : "S";
      const name = String(e.name || "Pilot").slice(0, 40);
      return `
        <div class="lbRow">
          <div class="lbRank">#${i + 1}</div>
          <div>
            <div class="lbName">${name} <span style="opacity:.6">(${mode})</span></div>
            <div style="opacity:.7; font-size:12px">Wave ${e.wave} - ${e.date}</div>
          </div>
          <div class="lbRow__right">
            <div class="lbScore">${e.score}</div>
            <button class="lbChallengeBtn" data-lb-name="${encodeURIComponent(name)}" data-lb-user="">Request Duel</button>
          </div>
        </div>
      `;
    })
    .join("");
}

const LOCAL_BUBBLES = Object.freeze([
  { id: "orion", name: "Orion Wing" },
  { id: "lyra", name: "Lyra Arc" },
  { id: "perseus", name: "Perseus Cell" },
  { id: "phoenix", name: "Phoenix Relay" },
  { id: "zenith", name: "Zenith Cluster" },
  { id: "draco", name: "Draco Line" },
]);

function hashSeed(text) {
  const value = String(text || "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickLocalBubble(uid) {
  const idx = hashSeed(uid) % LOCAL_BUBBLES.length;
  return LOCAL_BUBBLES[idx] || LOCAL_BUBBLES[0];
}

function ensureLocalBubbleProfile() {
  if (!CLOUD.user || !String(CLOUD.user.uid || "").trim()) return null;
  const bubble = pickLocalBubble(CLOUD.user.uid);
  if (SAVE.profile.localBubbleId !== bubble.id || SAVE.profile.localBubbleName !== bubble.name) {
    SAVE.profile.localBubbleId = bubble.id;
    SAVE.profile.localBubbleName = bubble.name;
    SAVE.profile.updatedAt = nowMs();
    saveNow();
  }
  return bubble;
}

function renderLeaderboardMeta(which, extra = "") {
  if (!leaderboardMetaEl) return;
  if (which === "global") {
    leaderboardMetaEl.textContent = "Global ladder: all players across every local bubble.";
    return;
  }
  const suffix = extra ? ` ${extra}` : "";
  leaderboardMetaEl.textContent = `Local bubble ladder: compete with your social squad.${suffix}`;
}

function safeBubbleName(value) {
  return String(value || "Local Squad")
    .slice(0, 36)
    .replace(/[<>&]/g, "");
}

async function sendLeaderboardChallenge(targetNameRaw, targetUserRaw) {
  const targetName = String(targetNameRaw || "Pilot").trim().slice(0, 40) || "Pilot";
  const targetUser = String(targetUserRaw || "").trim().slice(0, 20);
  const roomCode = randomRoomCode(6);
  const origin = window.location.origin || "";
  const inviteUrl = `${origin}/game/onlinematch?room=${encodeURIComponent(roomCode)}`;
  const label = targetUser ? `${targetName} (@${targetUser})` : targetName;
  const message = `Duel request in Stellar Siege for ${label}.\nRoom Code: ${roomCode}\n${inviteUrl}`;

  let sent = false;
  try {
    if (navigator.share) {
      await navigator.share({
        title: "Stellar Siege Duel Request",
        text: message,
      });
      sent = true;
    }
  } catch {
    // fallback to clipboard
  }
  if (!sent) {
    sent = await copyText(message);
  }

  roomCodeEl.value = roomCode;
  setState(STATE.ONLINE);
  setOnlineHint(`Challenge prepared for ${targetName}. Press Create to open room ${roomCode}.`);
  showToast(sent ? "Duel request ready. Share sent/copied." : "Duel request prepared.");
}

// -----------------------------
// Firebase Auth + Cloud (optional)
// -----------------------------

const CLOUD = {
  ready: false,
  enabled: false,
  authResolved: false,
  authReadyPromise: null,
  authReadyResolve: null,
  persistenceReadyPromise: null,
  persistenceReady: false,
  usernameReady: false,
  user: null,
  auth: null,
  firestore: null,
  rtdb: null,
  status: "Offline",
  devStatus: "",
};

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
let usernameEnsureInFlight = null;
let trackedAuthUid = null;

function markAuthResolved() {
  if (CLOUD.authResolved) return;
  CLOUD.authResolved = true;
  if (typeof CLOUD.authReadyResolve === "function") {
    CLOUD.authReadyResolve();
  }
}

async function waitForAuthRestore(timeoutMs = 3000) {
  cloudInit();
  if (!CLOUD.enabled) return;
  if (CLOUD.authResolved) return;
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([CLOUD.authReadyPromise, timeout]);
}

// -----------------------------
// Payments (Lemon Squeezy backend) - optional
// -----------------------------

const PAY = {
  apiBase: "",
};

function paymentsApiBase() {
  const raw = typeof window.PAYMENTS_API_BASE === "string" ? window.PAYMENTS_API_BASE : "";
  return raw.trim();
}

async function startCrystalPurchase(packId) {
  const apiBase = paymentsApiBase();
  if (!PAYMENTS_ENABLED) {
    showToast("Store coming soon.");
    return;
  }

  if (!isHosted()) {
    alert(withDevDetails("Store is unavailable in this build.", "Requires http(s) hosting."));
    return;
  }

  cloudInit();
  if (!CLOUD.enabled || !CLOUD.user) {
    setOnlineHint("Sign in to continue to checkout.", CLOUD.devStatus);
    setState(STATE.ONLINE);
    return;
  }

  const idToken = await CLOUD.user.getIdToken();
  const res = await fetch(`${apiBase}/api/lemonsqueezy/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ packId }),
  });

  if (!res.ok) {
    let message = "Store is unavailable right now.";
    try {
      const data = await res.json();
      if (DEV_MODE && data && data.error) message = `${message} (${String(data.error)})`;
      if (DEV_MODE && res.status === 501) message = `${message} (Checkout provider is not connected.)`;
    } catch {
      if (DEV_MODE) {
        const text = await res.text();
        if (text) message = `${message} (${text})`;
      }
    }
    throw new Error(message);
  }

  const data = await res.json();
  if (!data || !data.url) throw new Error("Checkout failed: missing URL");
  window.location.href = data.url;
}

function isHosted() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function hasFirebaseConfig() {
  return typeof window.FIREBASE_CONFIG === "object" && window.FIREBASE_CONFIG && Object.keys(window.FIREBASE_CONFIG).length > 0;
}

function cloudEnsurePersistence() {
  if (!CLOUD.auth) return Promise.resolve(false);
  if (CLOUD.persistenceReadyPromise) return CLOUD.persistenceReadyPromise;
  if (!(window.firebase && window.firebase.auth && window.firebase.auth.Auth && window.firebase.auth.Auth.Persistence)) {
    CLOUD.persistenceReady = false;
    return Promise.resolve(false);
  }
  const persistence = window.firebase.auth.Auth.Persistence;
  CLOUD.persistenceReadyPromise = CLOUD.auth
    .setPersistence(persistence.LOCAL)
    .then(() => {
      CLOUD.persistenceReady = true;
      return true;
    })
    .catch((err) => {
      LOG.warn("auth_persistence_local_failed", { message: String((err && err.message) || "") });
      return CLOUD.auth.setPersistence(persistence.SESSION).then(() => {
        CLOUD.persistenceReady = false;
        return false;
      });
    })
    .catch(() => {
      CLOUD.persistenceReady = false;
      return false;
    });
  return CLOUD.persistenceReadyPromise;
}

function cloudInit() {
  if (CLOUD.ready) return;
  CLOUD.ready = true;
  CLOUD.authResolved = false;
  CLOUD.authReadyPromise = new Promise((resolve) => {
    CLOUD.authReadyResolve = resolve;
  });

  const hasSdk = typeof window.firebase !== "undefined";
  const hasConfig = hasFirebaseConfig();
  if (PORTAL_MODE) {
    CLOUD.enabled = false;
    CLOUD.usernameReady = false;
    CLOUD.status = "Portal mode enabled. Playing local guest mode.";
    CLOUD.devStatus = "portal mode";
    markAuthResolved();
    updateAuthUi();
    return;
  }
  if (!hasSdk || !hasConfig) {
    CLOUD.enabled = false;
    CLOUD.usernameReady = false;
    CLOUD.status = "Online duel is coming soon.";
    CLOUD.devStatus = "Firebase SDK/config missing";
    markAuthResolved();
    updateAuthUi();
    return;
  }
  if (!isHosted()) {
    CLOUD.enabled = false;
    CLOUD.usernameReady = false;
    CLOUD.status = "Online duel is unavailable in this build.";
    CLOUD.devStatus = "Not hosted over http(s)";
    markAuthResolved();
    updateAuthUi();
    return;
  }

  try {
    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      window.firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    CLOUD.auth = window.firebase.auth();
    cloudEnsurePersistence().catch(() => {});
    CLOUD.firestore = window.firebase.firestore();
    CLOUD.rtdb = window.firebase.database ? window.firebase.database() : null;
    CLOUD.enabled = true;
    CLOUD.status = "Online services ready.";
    CLOUD.devStatus = "";
    updateAuthUi();

    CLOUD.auth.onAuthStateChanged(async (user) => {
      CLOUD.user = user || null;
      markAuthResolved();
      await cloudOnAuthChanged();
    });
  } catch (err) {
    console.warn("[CLOUD] init failed", err);
    CLOUD.enabled = false;
    CLOUD.usernameReady = false;
    CLOUD.status = "Online duel is unavailable right now.";
    CLOUD.devStatus = String((err && err.message) || "Firebase init failed");
    markAuthResolved();
    updateAuthUi();
  }
}

function cloudUserLabel() {
  if (!CLOUD.enabled) return CLOUD.status;
  if (!CLOUD.user) return "Signed out";
  return CLOUD.user.displayName || CLOUD.user.email || "Signed in";
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanUsernameInput(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 20);
}

function isValidUsername(value) {
  return USERNAME_RE.test(String(value || ""));
}

function suggestUsername(base) {
  let candidate = cleanUsernameInput(base);
  if (!candidate) candidate = `pilot${Math.floor(100 + Math.random() * 900)}`;
  if (candidate.length < 3) candidate = `${candidate}${Math.floor(100 + Math.random() * 900)}`;
  return candidate.slice(0, 20);
}

async function claimUniqueUsername(usernameRaw) {
  if (!CLOUD.enabled || !CLOUD.user || !CLOUD.firestore) return { ok: false, code: "offline" };
  const username = cleanUsernameInput(usernameRaw);
  if (!isValidUsername(username)) return { ok: false, code: "invalid" };
  const normalized = normalizeUsername(username);
  const uid = CLOUD.user.uid;
  const userRef = cloudDocRef();
  const usernamesRef = CLOUD.firestore.collection("usernames").doc(normalized);

  try {
    await CLOUD.firestore.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() || {} : {};
      const prevNorm =
        userData &&
        userData.profile &&
        typeof userData.profile.usernameNormalized === "string"
          ? userData.profile.usernameNormalized
          : "";

      const existingSnap = await tx.get(usernamesRef);
      if (existingSnap.exists) {
        const existing = existingSnap.data() || {};
        if (String(existing.uid || "") !== uid) {
          throw new Error("taken");
        }
      }

      if (prevNorm && prevNorm !== normalized) {
        const prevRef = CLOUD.firestore.collection("usernames").doc(prevNorm);
        const prevSnap = await tx.get(prevRef);
        if (prevSnap.exists) {
          const prev = prevSnap.data() || {};
          if (String(prev.uid || "") === uid) tx.delete(prevRef);
        }
      }

      tx.set(
        usernamesRef,
        {
          uid,
          username,
          updatedAt: nowMs(),
        },
        { merge: true }
      );

      const profile = (userData && userData.profile) || {};
      tx.set(
        userRef,
        {
          profile: {
            ...profile,
            name: username,
            usernameNormalized: normalized,
            updatedAt: nowMs(),
          },
        },
        { merge: true }
      );
    });

    SAVE.profile.name = username;
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    updateTopBar();
    CLOUD.usernameReady = true;
    return { ok: true, username };
  } catch (err) {
    if (String(err && err.message || "").toLowerCase().includes("taken")) {
      return { ok: false, code: "taken" };
    }
    return { ok: false, code: "unknown" };
  }
}

async function ensureUniqueUsernameForAccount(interactive = false) {
  if (!CLOUD.enabled || !CLOUD.user || !CLOUD.firestore) return false;
  if (usernameEnsureInFlight) return usernameEnsureInFlight;

  usernameEnsureInFlight = (async () => {
    const userRef = cloudDocRef();
    let remoteName = "";
    let remoteNorm = "";
    const uid = CLOUD.user.uid;
    try {
      const snap = await userRef.get();
      if (snap.exists) {
        const data = snap.data() || {};
        const profile = data.profile || {};
        if (typeof profile.name === "string") remoteName = cleanUsernameInput(profile.name);
        if (typeof profile.usernameNormalized === "string") remoteNorm = normalizeUsername(profile.usernameNormalized);
      }
    } catch {
      // ignore fetch failure and fallback to local candidate
    }

    const remoteLooksValid =
      isValidUsername(remoteName) && remoteNorm && remoteNorm === normalizeUsername(remoteName);
    if (remoteLooksValid) {
      try {
        const unameSnap = await CLOUD.firestore.collection("usernames").doc(remoteNorm).get();
        const unameData = unameSnap.exists ? unameSnap.data() || {} : {};
        if (String(unameData.uid || "") === uid) {
          SAVE.profile.name = remoteName;
          SAVE.profile.updatedAt = nowMs();
          saveNow();
          updateTopBar();
          CLOUD.usernameReady = true;
          return true;
        }
      } catch {
        // fallback to claim/prompt flow
      }
    }

    let candidate = suggestUsername(remoteName || SAVE.profile.name || (CLOUD.user && CLOUD.user.displayName) || "pilot");
    if (!interactive) {
      const auto = await claimUniqueUsername(candidate);
      if (auto.ok) return true;
      CLOUD.usernameReady = false;
      return false;
    }

    while (true) {
      const value = prompt(
        "Choose a unique username (3-20 chars, letters/numbers/_ only). This name appears in leaderboard.",
        candidate
      );
      if (value == null) {
        CLOUD.usernameReady = false;
        return false;
      }
      candidate = cleanUsernameInput(value);
      if (!isValidUsername(candidate)) {
        alert("Username must be 3-20 characters and use only letters, numbers, or underscore.");
        continue;
      }

      const result = await claimUniqueUsername(candidate);
      if (result.ok) return true;
      if (result.code === "taken") {
        alert("That username is already taken. Please choose another.");
      } else {
        alert("Could not save username right now. Please try again.");
      }
    }
  })()
    .finally(() => {
      usernameEnsureInFlight = null;
    });

  return usernameEnsureInFlight;
}

async function cloudSignInGoogle() {
  cloudInit();
  if (!CLOUD.enabled || !CLOUD.auth) return;
  // Keep popup call directly in click flow (avoids popup blockers).
  cloudEnsurePersistence().catch(() => {});
  const provider = new window.firebase.auth.GoogleAuthProvider();
  await CLOUD.auth.signInWithPopup(provider);
  rememberAuthWindow(AUTH_PERSIST_DAYS);
}

async function cloudSignOut() {
  if (!CLOUD.enabled || !CLOUD.auth) return;
  await CLOUD.auth.signOut();
  clearAuthRememberWindow();
}

function cloudDocRef() {
  if (!CLOUD.enabled || !CLOUD.firestore || !CLOUD.user) return null;
  return CLOUD.firestore.collection("users").doc(CLOUD.user.uid);
}

function nowMs() {
  return Date.now();
}

function computeLocalSnapshot() {
  // Only put fields in cloud that we intentionally support. Avoid leaking local-only fields.
  reconcileAdRewardLedgerIntegrity();
  const profile = {
    name: SAVE.profile.name,
    xp: Number(SAVE.profile.xp || 0),
    credits: Number(SAVE.profile.credits || 0),
    crystals: Number(SAVE.profile.crystals || 0),
    bestScore: Number(SAVE.profile.bestScore || 0),
    bestWave: Number(SAVE.profile.bestWave || 1),
    bestSurvivalKills:
      SAVE.profile.bestSurvivalKills == null ? null : Number(Math.max(0, SAVE.profile.bestSurvivalKills || 0)),
    campaignUnlocked: Number(SAVE.profile.campaignUnlocked || 1),
    selectedShipId: SAVE.profile.selectedShipId || "scout",
    startedAt: Number(SAVE.profile.startedAt || 0),
    localBubbleId: String(SAVE.profile.localBubbleId || ""),
    localBubbleName: String(SAVE.profile.localBubbleName || ""),
    gamesPlayed: Number(SAVE.profile.gamesPlayed || 0),
    gamesSurvival: Number(SAVE.profile.gamesSurvival || 0),
    gamesCampaign: Number(SAVE.profile.gamesCampaign || 0),
    onlineGames: Number(SAVE.profile.onlineGames || 0),
    onlineWins: Number(SAVE.profile.onlineWins || 0),
    onlineLosses: Number(SAVE.profile.onlineLosses || 0),
    campaignWins: Number(SAVE.profile.campaignWins || 0),
    totalWins: Number(SAVE.profile.totalWins || 0),
    totalLosses: Number(SAVE.profile.totalLosses || 0),
    totalDeaths: Number(SAVE.profile.totalDeaths || 0),
    totalKills: Number(SAVE.profile.totalKills || 0),
    totalShotsFired: Number(SAVE.profile.totalShotsFired || 0),
    totalCreditsEarned: Number(SAVE.profile.totalCreditsEarned || 0),
    totalCrystalsEarned: Number(SAVE.profile.totalCrystalsEarned || 0),
    totalXpEarned: Number(SAVE.profile.totalXpEarned || 0),
    totalAdsClaimed: Number(SAVE.profile.totalAdsClaimed || 0),
    adRewardClaimsBaseline: Number(SAVE.profile.adRewardClaimsBaseline || 0),
    adRewardCreditsTotal: Number(SAVE.profile.adRewardCreditsTotal || 0),
    adRewardCrystalsTotal: Number(SAVE.profile.adRewardCrystalsTotal || 0),
    adRewardXpTotal: Number(SAVE.profile.adRewardXpTotal || 0),
    adRewardHistory: normalizeAdRewardHistoryList(SAVE.profile.adRewardHistory || []),
    bossKills: Number(SAVE.profile.bossKills || 0),
    totalRunSeconds: Number(SAVE.profile.totalRunSeconds || 0),
    aimTapAssistEnabled: Boolean(SAVE.profile.aimTapAssistEnabled),
    aimStickyLockEnabled: Boolean(SAVE.profile.aimStickyLockEnabled),
    aimAssistStrength: clamp(Math.floor(Number(SAVE.profile.aimAssistStrength || 0)), 0, 100),
    adRewardsDay: String(SAVE.profile.adRewardsDay || ""),
    adRewardsClaimed: Number(SAVE.profile.adRewardsClaimed || 0),
    adRewardLastAt: Number(SAVE.profile.adRewardLastAt || 0),
    damageNumbersEnabled: Boolean(SAVE.profile.damageNumbersEnabled),
    adaptiveDifficultyEnabled: Boolean(SAVE.profile.adaptiveDifficultyEnabled),
    fpsLimit: Number(SAVE.profile.fpsLimit || 0),
    selectedTitle: String(SAVE.profile.selectedTitle || "Cadet"),
    unlockedTitles: Array.isArray(SAVE.profile.unlockedTitles) ? SAVE.profile.unlockedTitles : ["Cadet"],
    achievementUnlocks: SAVE.profile.achievementUnlocks || {},
    abilityUses: SAVE.profile.abilityUses || {},
    updatedAt: nowMs(),
  };
  return {
    profile,
    ships: SAVE.ships,
    economy: {
      tree: ensureAccountTreeState(),
    },
    version: 3,
  };
}

function mergeShips(localShips, remoteShips) {
  const out = { ...(localShips || {}) };
  const remote = remoteShips && typeof remoteShips === "object" ? remoteShips : {};
  for (const shipId of Object.keys(remote)) {
    const r = remote[shipId] || {};
    const l = out[shipId] || {};
    const mergedUpgrades = { ...defaultShipUpgrades(), ...(l.upgrades || {}) };
    const ru = r.upgrades && typeof r.upgrades === "object" ? r.upgrades : {};
    for (const k of Object.keys(ru)) {
      mergedUpgrades[k] = Math.max(Number(mergedUpgrades[k] || 0), Number(ru[k] || 0));
    }
    out[shipId] = {
      owned: Boolean(l.owned || r.owned),
      upgrades: mergedUpgrades,
    };
  }
  return out;
}

function mergeAccountTree(localTree, remoteTree) {
  const base = defaultAccountTree();
  const out = { ...base, ...(localTree || {}) };
  const remote = remoteTree && typeof remoteTree === "object" ? remoteTree : {};
  Object.keys(base).forEach((key) => {
    out[key] = Math.max(0, Math.floor(Number(out[key] || 0)), Math.floor(Number(remote[key] || 0)));
  });
  return out;
}

async function cloudPullMerge(options = {}) {
  const ref = cloudDocRef();
  if (!ref) return;
  const strategy = String(options.strategy || "auto");
  const preferRemote = strategy === "cloud";
  const preferLocal = strategy === "local";
  const snap = await ref.get();
  if (!snap.exists) {
    // First-time cloud profile: seed with local progress so sync can start.
    await ref.set(computeLocalSnapshot(), { merge: true });
    return;
  }

  const remote = snap.data() || {};
  const remoteProfile = remote.profile && typeof remote.profile === "object" ? remote.profile : {};
  const localAdHistory = Array.isArray(SAVE.profile.adRewardHistory) ? SAVE.profile.adRewardHistory : [];
  const localAdClaimsBaseline = Math.max(0, Math.floor(Number(SAVE.profile.adRewardClaimsBaseline || 0)));
  const localUpdated = Number(SAVE.profile.updatedAt || 0);
  const remoteUpdated = Number(remoteProfile.updatedAt ? remoteProfile.updatedAt : 0);

  const remoteCrystals = Number(Number.isFinite(Number(remoteProfile.crystals)) ? remoteProfile.crystals : 0);
  const useRemote = preferRemote || (!preferLocal && remoteUpdated > localUpdated);

  if (useRemote) {
    SAVE.profile = { ...SAVE.profile, ...remoteProfile };
    SAVE.profile.crystals = remoteCrystals;
    SAVE.profile.crystalsShadow = remoteCrystals;
    SAVE.profile.adRewardHistory = mergeAdRewardHistoryLists(localAdHistory, SAVE.profile.adRewardHistory || []);
    SAVE.profile.adRewardClaimsBaseline = Math.max(
      localAdClaimsBaseline,
      Math.max(0, Math.floor(Number(SAVE.profile.adRewardClaimsBaseline || 0)))
    );
    reconcileAdRewardLedgerIntegrity();
    SAVE.ships = mergeShips(preferRemote ? {} : SAVE.ships, remote.ships);
    SAVE.economy = SAVE.economy || { tree: defaultAccountTree() };
    SAVE.economy.tree = mergeAccountTree(preferRemote ? {} : SAVE.economy.tree, remote.economy && remote.economy.tree);
    migrateSave();
    saveNow();
    applyAimAssistSettingsUI();
    applySettingsUi();
    applyLanguageToUi();
    applyAudioMix();
    return;
  }

  // Local is newer or explicitly chosen: push local progress, but never increase crystals from the client.
  SAVE.ships = mergeShips(SAVE.ships, remote.ships);
  SAVE.economy = SAVE.economy || { tree: defaultAccountTree() };
  SAVE.economy.tree = mergeAccountTree(SAVE.economy.tree, remote.economy && remote.economy.tree);
  SAVE.profile.adRewardHistory = mergeAdRewardHistoryLists(SAVE.profile.adRewardHistory || [], remoteProfile.adRewardHistory || []);
  SAVE.profile.adRewardClaimsBaseline = Math.max(
    Math.max(0, Math.floor(Number(SAVE.profile.adRewardClaimsBaseline || 0))),
    Math.max(0, Math.floor(Number(remoteProfile.adRewardClaimsBaseline || 0)))
  );
  reconcileAdRewardLedgerIntegrity();
  migrateSave();
  saveNow();
  applyAimAssistSettingsUI();
  applySettingsUi();
  applyLanguageToUi();
  applyAudioMix();
  await cloudPush();
}

async function cloudPush() {
  const ref = cloudDocRef();
  if (!ref) return;
  // Clamp crystals so the client can't grant itself purchased currency.
  const clamped = computeLocalSnapshot();
  const shadow = Number.isFinite(Number(SAVE.profile.crystalsShadow)) ? Number(SAVE.profile.crystalsShadow) : 0;
  clamped.profile.crystals = Math.min(clamped.profile.crystals, shadow);
  await ref.set(clamped, { merge: true });
}

function leaderboardRankComparator(a, b) {
  if ((b.onlineWins || 0) !== (a.onlineWins || 0)) return (b.onlineWins || 0) - (a.onlineWins || 0);
  if ((a.onlineLosses || 0) !== (b.onlineLosses || 0)) return (a.onlineLosses || 0) - (b.onlineLosses || 0);
  if ((b.xp || 0) !== (a.xp || 0)) return (b.xp || 0) - (a.xp || 0);
  if ((b.onlineGames || 0) !== (a.onlineGames || 0)) return (b.onlineGames || 0) - (a.onlineGames || 0);
  if ((b.bestScore || 0) !== (a.bestScore || 0)) return (b.bestScore || 0) - (a.bestScore || 0);
  return String(a.username || a.name || "").localeCompare(String(b.username || b.name || ""));
}

async function cloudUpdatePlayerRanking(entry, reason) {
  if (!CLOUD.enabled || !CLOUD.firestore || !CLOUD.user) return;
  if (!CLOUD.usernameReady) {
    const ok = await ensureUniqueUsernameForAccount(false);
    if (!ok) return;
  }
  const uid = CLOUD.user.uid;
  const isOnlineDuel = run.mode === MODE.DUEL && run.duel && run.duel.kind === "online";
  const ref = CLOUD.firestore.collection("leaderboard_players").doc(uid);
  const mode = run.mode;
  const bubble = ensureLocalBubbleProfile() || pickLocalBubble(uid);

  await CLOUD.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() || {} : {};

    const gamesPlayed = Number(prev.gamesPlayed || 0) + 1;
    const gamesSurvival = Number(prev.gamesSurvival || 0) + (mode === MODE.SURVIVAL ? 1 : 0);
    const gamesCampaign = Number(prev.gamesCampaign || 0) + (mode === MODE.CAMPAIGN ? 1 : 0);
    const onlineGames = Number(prev.onlineGames || 0) + (isOnlineDuel ? 1 : 0);
    const onlineWins = Number(prev.onlineWins || 0) + (isOnlineDuel && reason === "duel_win" ? 1 : 0);
    const onlineLosses = Number(prev.onlineLosses || 0) + (isOnlineDuel && reason === "duel_loss" ? 1 : 0);
    const points = onlineWins * 3;
    const winRate = onlineGames > 0 ? onlineWins / onlineGames : 0;

    tx.set(
      ref,
      {
        uid,
        name: String(CLOUD.user.displayName || "Pilot").slice(0, 40),
        username: (SAVE.profile.name || "pilot").slice(0, 20),
        bubbleId: String((bubble && bubble.id) || ""),
        bubbleName: safeBubbleName((bubble && bubble.name) || ""),
        gamesPlayed,
        gamesSurvival,
        gamesCampaign,
        onlineGames,
        onlineWins,
        onlineLosses,
        points,
        winRate,
        xp: Number(SAVE.profile.xp || 0),
        bestScore: Math.max(Number(prev.bestScore || 0), Number(entry.score || 0), Number(SAVE.profile.bestScore || 0)),
        bestWave: Math.max(Number(prev.bestWave || 1), Number(entry.wave || 1), Number(SAVE.profile.bestWave || 1)),
        updatedAt: nowMs(),
      },
      { merge: true }
    );
  });
}

async function renderGlobalLeaderboard() {
  cloudInit();

  if (!CLOUD.enabled) {
    leaderboardListEl.innerHTML = `<div class="fine">${withDevDetails("Global leaderboard is unavailable right now.", CLOUD.devStatus)}</div>`;
    return;
  }
  if (!CLOUD.user) {
    leaderboardListEl.innerHTML = `<div class="fine">Sign in to submit and view global rankings.</div>`;
    return;
  }

  leaderboardListEl.innerHTML = `<div class="fine">Loading global leaderboard...</div>`;
  try {
    const q = await CLOUD.firestore
      .collection("leaderboard_players")
      .orderBy("onlineWins", "desc")
      .limit(120)
      .get();
    const rows = q.docs
      .map((d) => d.data() || {})
      .filter((d) => Number(d.gamesPlayed || 0) > 0)
      .sort(leaderboardRankComparator)
      .slice(0, 25);
    if (rows.length === 0) {
      leaderboardListEl.innerHTML = `<div class="fine">No ranked players yet. Finish matches to appear here.</div>`;
      return;
    }
    leaderboardListEl.innerHTML = rows
      .map((e, i) => {
        const wins = Number(e.onlineWins || 0);
        const losses = Number(e.onlineLosses || 0);
        const onlineGames = Number(e.onlineGames || 0);
        const gamesPlayed = Number(e.gamesPlayed || 0);
        const xp = Number(e.xp || 0);
        const points = Number(e.points || wins * 3);
        const name = String(e.name || "Pilot").slice(0, 40);
        const username = String(e.username || e.name || "pilot").slice(0, 20);
        const bubbleName = safeBubbleName(e.bubbleName || "Local Squad");
        return `
          <div class="lbRow">
            <div class="lbRank">#${i + 1}</div>
            <div>
              <div class="lbName">${name} <span style="opacity:.65">@${username}</span></div>
              <div style="opacity:.72; font-size:12px">W ${wins} · L ${losses} · Online ${onlineGames} · Games ${gamesPlayed} · XP ${xp} · ${bubbleName}</div>
            </div>
            <div class="lbRow__right">
              <div class="lbScore">${points} pts</div>
              <button class="lbChallengeBtn" data-lb-name="${encodeURIComponent(name)}" data-lb-user="${encodeURIComponent(username)}">Request Duel</button>
            </div>
          </div>
        `;
      })
      .join("");
    leaderboardListEl.innerHTML =
      `<div class="fine" style="margin-bottom:8px">Ranking order: Wins desc, Losses asc, XP desc, Online games desc, Best score desc.</div>` +
      leaderboardListEl.innerHTML;
  } catch (err) {
    console.warn("[CLOUD] leaderboard load failed", err);
    leaderboardListEl.innerHTML = `<div class="fine">Failed to load global leaderboard.</div>`;
  }
}

function cloudSyncChoiceKey(uid) {
  return `${CLOUD_SYNC_CHOICE_PREFIX}${uid}`;
}

function readCloudSyncChoice(uid) {
  try {
    const v = localStorage.getItem(cloudSyncChoiceKey(uid));
    return v === "local" || v === "cloud" ? v : "";
  } catch {
    return "";
  }
}

function writeCloudSyncChoice(uid, choice) {
  try {
    localStorage.setItem(cloudSyncChoiceKey(uid), choice);
  } catch {
    // ignore localStorage failure
  }
}

function hasMeaningfulLocalProgress() {
  if (Number(SAVE.profile.gamesPlayed || 0) > 0) return true;
  if (Number(SAVE.profile.xp || 0) > 0) return true;
  if (Number(SAVE.profile.credits || 0) > 0) return true;
  if (Number(SAVE.profile.crystals || 0) > 0) return true;
  if (Number(SAVE.profile.campaignUnlocked || 1) > 1) return true;
  if (Number(SAVE.profile.bestScore || 0) > 0) return true;
  if (Number(SAVE.profile.bestWave || 1) > 1) return true;
  if (Number(SAVE.profile.bestSurvivalKills || 0) > 0) return true;
  for (const s of SHIPS) {
    const st = ensureShipState(s.id);
    if (s.id !== "scout" && st.owned) return true;
    const upgradeTotal = Object.values(st.upgrades || {}).reduce((acc, n) => acc + Number(n || 0), 0);
    if (upgradeTotal > 0) return true;
  }
  return false;
}

async function chooseCloudSyncStrategyOnSignIn() {
  if (!CLOUD.user) return "auto";
  const uid = String(CLOUD.user.uid || "");
  if (!uid) return "auto";
  const saved = readCloudSyncChoice(uid);
  if (saved) return saved;

  if (!hasMeaningfulLocalProgress()) {
    writeCloudSyncChoice(uid, "cloud");
    return "cloud";
  }

  const keepLocal = window.confirm(
    "Choose sync option:\nOK = Keep Local Progress (upload local -> cloud)\nCancel = Use Cloud Progress (replace local)"
  );
  const choice = keepLocal ? "local" : "cloud";
  writeCloudSyncChoice(uid, choice);
  return choice;
}

async function cloudOnAuthChanged() {
  AUTH_RUNTIME.signedIn = Boolean(CLOUD.user);
  AUTH_RUNTIME.resolved = true;
  if (CLOUD.user) {
    rememberAuthWindow(AUTH_PERSIST_DAYS);
    SESSION.guestPlayMs = 0;
    SESSION.nextGuestReminderAtMs = GUEST_REMINDER_INTERVAL_MS;
    ensureLocalBubbleProfile();
    guestSyncBannerEl.classList.add("hidden");
    if (trackedAuthUid !== CLOUD.user.uid) {
      trackEvent("login", { method: "google" });
      trackedAuthUid = CLOUD.user.uid;
    }
    // Auto-sync + set pilot name from Google if local is default
    if (SAVE.profile.name && SAVE.profile.name.startsWith("Pilot-") && CLOUD.user.displayName) {
      SAVE.profile.name = CLOUD.user.displayName.slice(0, 18);
      saveNow();
    }
    try {
      const syncStrategy = await chooseCloudSyncStrategyOnSignIn();
      await cloudPullMerge({ strategy: syncStrategy });
    } catch (err) {
      console.warn("[CLOUD] pull/merge failed", err);
    }
    try {
      await ensureUniqueUsernameForAccount(true);
    } catch (err) {
      console.warn("[CLOUD] username setup failed", err);
    }
    updateTopBar();
    renderHangar();
    if (state === STATE.ACCOUNT) renderAccountPanel();
  } else {
    if (trackedAuthUid) trackEvent("logout", { method: "google" });
    trackedAuthUid = null;
    CLOUD.usernameReady = false;
    if (progressionRequiresAuth()) {
      clearAuthRememberWindow();
      removePersistedSaveSnapshot();
      resetGuestSessionProgress();
    }
    SESSION.guestPlayMs = 0;
    SESSION.nextGuestReminderAtMs = GUEST_REMINDER_INTERVAL_MS;
    if (state === STATE.ACCOUNT) renderAccountPanel();
  }
  updateAuthUi();
}

function updateAuthUi() {
  signedInNow();
  const userLabel = cloudUserLabel();
  authStatusEl.textContent = CLOUD.user ? `${userLabel} · ${authRememberHint()}` : userLabel;
  googleSignInBtn.disabled = PORTAL_MODE || !CLOUD.enabled;
  signOutBtn.disabled = PORTAL_MODE || !CLOUD.enabled || !CLOUD.user;

  const onlineConfigured = Boolean(CLOUD.enabled && CLOUD.rtdb);
  const canOnline = Boolean(onlineConfigured && CLOUD.user && CLOUD.usernameReady);
  createRoomBtn.disabled = !canOnline;
  joinRoomBtn.disabled = !canOnline;
  startDuelBtn.disabled = false;

  const showOnlineEntry = !PORTAL_MODE && onlineConfigured;
  onlineBtn.classList.toggle("hidden", !showOnlineEntry);
  menuOnlineBtn.classList.toggle("hidden", !showOnlineEntry);
  if (!showOnlineEntry) {
    onlineBtn.textContent = t("menu.online_coming");
    menuOnlineBtn.textContent = t("menu.online_coming");
  } else {
    onlineBtn.textContent = t("menu.online_beta");
    menuOnlineBtn.textContent = t("menu.online_beta");
  }

  if (PORTAL_MODE) {
    setOnlineHint("Portal mode: local single-player only.");
    setTopAuthUi({ signedIn: false });
    updateGuestSyncBanner();
    return;
  }
  if (!CLOUD.enabled) {
    setOnlineHint(CLOUD.status, CLOUD.devStatus);
    topSignInBtn.disabled = false;
    topSignInBtn.title = "";
    setTopAuthUi({ signedIn: false });
    updateGuestSyncBanner();
    return;
  }
  if (!CLOUD.user) {
    setOnlineHint("Sign in to sync progress and play online duel.");
    topSignInBtn.disabled = false;
    topSignInBtn.title = "";
    setTopAuthUi({ signedIn: false });
    updateGuestSyncBanner();
    return;
  }
  if (!CLOUD.rtdb) {
    setOnlineHint("Online duel is unavailable right now.", "Realtime Database missing");
    topSignInBtn.disabled = false;
    topSignInBtn.title = "";
    setTopAuthUi({ signedIn: true, displayName: CLOUD.user.displayName, photoUrl: CLOUD.user.photoURL });
    updateGuestSyncBanner();
    return;
  }
  if (!CLOUD.usernameReady) {
    setOnlineHint("Choose a username to enter online rooms.");
    topSignInBtn.disabled = false;
    topSignInBtn.title = "";
    setTopAuthUi({ signedIn: true, displayName: CLOUD.user.displayName, photoUrl: CLOUD.user.photoURL });
    updateGuestSyncBanner();
    return;
  }
  setOnlineHint("Signed in. Create or join a room to start an online duel.");
  topSignInBtn.disabled = false;
  topSignInBtn.title = "";
  setTopAuthUi({ signedIn: true, displayName: CLOUD.user.displayName, photoUrl: CLOUD.user.photoURL });
  updateGuestSyncBanner();
}

const CAMPAIGN_MISSIONS = [
  {
    id: 1,
    name: "Boot Sequence",
    desc: "Warm-up. Get a feel for drifting and tracking targets.",
    objectives: [
      { type: "survive", seconds: 25 },
      { type: "kill", enemy: "drone", count: 18 },
    ],
    spawns: { pool: ["drone"], desired: 5, bossCount: 0 },
  },
  {
    id: 2,
    name: "Fighter Screen",
    desc: "Enemy fighters slip in behind the drones. Don't let them box you in.",
    objectives: [{ type: "kill", enemy: "fighter", count: 10 }],
    spawns: { pool: ["fighter", "drone"], desired: 6, bossCount: 0 },
  },
  {
    id: 3,
    name: "Counter-Sniper",
    desc: "Long-range threats are online. Break their spacing and finish fast.",
    objectives: [{ type: "kill", enemy: "sniper", count: 6 }],
    spawns: { pool: ["sniper", "drone"], desired: 6, bossCount: 0 },
  },
  {
    id: 4,
    name: "Carrier Hunt",
    desc: "A carrier jumps in. Clear the screen and bring it down.",
    objectives: [{ type: "boss", count: 1 }],
    spawns: { pool: ["fighter", "drone"], desired: 6, bossCount: 1, bossAt: 18, bossEvery: 22 },
  },
  {
    id: 5,
    name: "Rammer Drill",
    desc: "Heavy rammers charge straight through fire. Keep moving.",
    objectives: [{ type: "kill", enemy: "rammer", count: 8 }],
    spawns: { pool: ["rammer", "fighter"], desired: 7, bossCount: 0 },
  },
  {
    id: 6,
    name: "Gauntlet",
    desc: "Everything at once. Survive and drop a carrier.",
    objectives: [
      { type: "survive", seconds: 60 },
      { type: "boss", count: 1 },
    ],
    spawns: { pool: ["drone", "fighter", "sniper", "rammer"], desired: 7, bossCount: 1, bossAt: 35, bossEvery: 30 },
  },
  {
    id: 7,
    name: "Double Carrier",
    desc: "Two carriers, one cockpit. Good luck.",
    objectives: [{ type: "boss", count: 2 }],
    spawns: { pool: ["fighter", "sniper", "rammer"], desired: 8, bossCount: 2, bossAt: 22, bossEvery: 26 },
  },
  {
    id: 8,
    name: "Signal Relay",
    desc: "Collect navigation beacons while drones harass you.",
    objectives: [{ type: "collect", count: 6 }],
    spawns: { pool: ["drone", "fighter"], desired: 6, bossCount: 0 },
  },
  {
    id: 9,
    name: "Zone Control",
    desc: "Hold a moving zone. You win by positioning, not by damage.",
    objectives: [{ type: "zone", seconds: 25, r: 120 }],
    spawns: { pool: ["drone"], desired: 4, bossCount: 0 },
  },
  {
    id: 10,
    name: "Dead Silent",
    desc: "No shooting allowed. Hold the zone and evade.",
    objectives: [
      { type: "no_shoot", seconds: 22 },
      { type: "zone", seconds: 22, r: 130 },
    ],
    spawns: { pool: ["drone", "fighter"], desired: 6, bossCount: 0 },
  },
  {
    id: 11,
    name: "Hull Integrity",
    desc: "Survive without taking hull damage (shields are allowed).",
    objectives: [{ type: "no_hull_hit", seconds: 30 }],
    spawns: { pool: ["sniper", "fighter"], desired: 6, bossCount: 0 },
  },
  {
    id: 12,
    name: "Final Trial",
    desc: "A brutal mixed test: beacons, zone, and a carrier.",
    objectives: [
      { type: "collect", count: 5 },
      { type: "zone", seconds: 20, r: 115 },
      { type: "boss", count: 1 },
    ],
    spawns: { pool: ["drone", "fighter", "sniper", "rammer"], desired: 8, bossCount: 1, bossAt: 35, bossEvery: 30 },
  },
];

function getCampaignMission(id) {
  return CAMPAIGN_MISSIONS.find((m) => m.id === id) || CAMPAIGN_MISSIONS[0];
}

function setupCampaignMission(missionId) {
  const mission = getCampaignMission(missionId);
  entities.beacons = [];
  run.campaign.beaconsCollected = 0;
  run.campaign.beaconsTotal = 0;
  run.campaign.zoneTime = 0;
  run.campaign.zoneSeconds = 0;
  run.campaign.zone = null;
  run.campaign.hullHit = false;
  run.campaign.shotsFired = 0;

  // Beacons (collectibles that require movement/positioning, not just shooting).
  const collectObj = mission.objectives.find((o) => o.type === "collect");
  if (collectObj) {
    const count = Math.max(1, Number(collectObj.count || 1));
    run.campaign.beaconsTotal = count;
    for (let i = 0; i < count; i += 1) {
      entities.beacons.push({
        id: `b${i}`,
        x: rand(80, WORLD.width - 80),
        y: rand(110, WORLD.height - 80),
        t: rand(0, TAU),
      });
    }
  }

  // Zone control (hold a moving zone for a duration).
  const zoneObj = mission.objectives.find((o) => o.type === "zone");
  if (zoneObj) {
    const seconds = Math.max(5, Number(zoneObj.seconds || 10));
    run.campaign.zoneSeconds = seconds;
    run.campaign.zone = {
      x: rand(200, WORLD.width - 200),
      y: rand(160, WORLD.height - 160),
      r: Number(zoneObj.r || 115),
      tx: rand(200, WORLD.width - 200),
      ty: rand(160, WORLD.height - 160),
      shiftAt: 3 + Math.random() * 3,
    };
  }
}

function missionSummary(mission) {
  return mission.objectives
    .map((o) => {
      if (o.type === "survive") return `Survive ${o.seconds}s`;
      if (o.type === "kill") return `Kill ${o.count} ${o.enemy}${o.count === 1 ? "" : "s"}`;
      if (o.type === "boss") return `Defeat ${o.count} carrier${o.count === 1 ? "" : "s"}`;
      if (o.type === "collect") return `Collect ${o.count} beacons`;
      if (o.type === "zone") return `Hold zone ${o.seconds}s`;
      if (o.type === "no_hull_hit") return `No hull hits (${o.seconds}s)`;
      if (o.type === "no_shoot") return `No shooting (${o.seconds}s)`;
      return "Objective";
    })
    .join(" - ");
}

function renderCampaignMissions() {
  const unlocked = Math.max(1, SAVE.profile.campaignUnlocked || 1);
  missionListEl.innerHTML = "";

  CAMPAIGN_MISSIONS.forEach((m) => {
    const isUnlocked = m.id <= unlocked;
    const isCompleted = m.id < unlocked;

    const row = document.createElement("div");
    row.className = "missionRow";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="missionTitle">Mission ${m.id}: ${m.name}</div>
      <div class="missionDesc">${m.desc}</div>
      <div class="missionBadge">
        <span>${missionSummary(m)}</span>
        <span style="opacity:.65">-</span>
        <span>Reward ~${500 + m.id * 120} credits</span>
        <span style="opacity:.65">-</span>
        <span>${isCompleted ? "Completed" : isUnlocked ? "Unlocked" : "Locked"}</span>
      </div>
    `;

    const btn = document.createElement("button");
    btn.className = isUnlocked ? "btn" : "btnGhost";
    btn.textContent = isUnlocked ? (isCompleted ? "Replay" : "Start") : "Locked";
    btn.disabled = !isUnlocked;
    btn.addEventListener("click", () => {
      startRun(MODE.CAMPAIGN, { missionId: m.id });
    });

    row.appendChild(left);
    row.appendChild(btn);
    missionListEl.appendChild(row);
  });
}

function campaignObjectiveStatusText() {
  const mission = getCampaignMission(run.campaign.missionId);
  const parts = mission.objectives.map((o) => {
    if (o.type === "survive") {
      const cur = Math.min(o.seconds, Math.floor(run.time));
      return cur >= o.seconds ? `Survive ${o.seconds}s (DONE)` : `Survive ${o.seconds}s (${cur}/${o.seconds})`;
    }
    if (o.type === "kill") {
      const cur = run.campaign.killsByType[o.enemy] || 0;
      return cur >= o.count ? `Kill ${o.count} ${o.enemy}s (DONE)` : `Kill ${o.count} ${o.enemy}s (${cur}/${o.count})`;
    }
    if (o.type === "boss") {
      const cur = run.campaign.bossesKilled || 0;
      return cur >= o.count ? `Defeat ${o.count} carrier(s) (DONE)` : `Defeat ${o.count} carrier(s) (${cur}/${o.count})`;
    }
    if (o.type === "collect") {
      const cur = run.campaign.beaconsCollected || 0;
      return cur >= o.count ? `Collect ${o.count} beacons (DONE)` : `Collect ${o.count} beacons (${cur}/${o.count})`;
    }
    if (o.type === "zone") {
      const cur = Math.min(o.seconds, Math.floor(run.campaign.zoneTime || 0));
      return cur >= o.seconds ? `Hold zone ${o.seconds}s (DONE)` : `Hold zone ${o.seconds}s (${cur}/${o.seconds})`;
    }
    if (o.type === "no_hull_hit") {
      const cur = Math.min(o.seconds, Math.floor(run.time));
      const ok = !run.campaign.hullHit;
      return cur >= o.seconds && ok
        ? `No hull hits (${o.seconds}s) (DONE)`
        : `No hull hits (${o.seconds}s) (${cur}/${o.seconds})${ok ? "" : " (FAILED)"}`;
    }
    if (o.type === "no_shoot") {
      const cur = Math.min(o.seconds, Math.floor(run.time));
      const ok = (run.campaign.shotsFired || 0) === 0;
      return cur >= o.seconds && ok
        ? `No shooting (${o.seconds}s) (DONE)`
        : `No shooting (${o.seconds}s) (${cur}/${o.seconds})${ok ? "" : " (FAILED)"}`;
    }
    return "Objective";
  });

  return parts.join(" - ");
}

function isCampaignObjectiveComplete(obj) {
  if (obj.type === "survive") return run.time >= obj.seconds;
  if (obj.type === "kill") return (run.campaign.killsByType[obj.enemy] || 0) >= obj.count;
  if (obj.type === "boss") return (run.campaign.bossesKilled || 0) >= obj.count;
  if (obj.type === "collect") return (run.campaign.beaconsCollected || 0) >= obj.count;
  if (obj.type === "zone") return (run.campaign.zoneTime || 0) >= obj.seconds;
  if (obj.type === "no_hull_hit") return run.time >= obj.seconds && !run.campaign.hullHit;
  if (obj.type === "no_shoot") return run.time >= obj.seconds && (run.campaign.shotsFired || 0) === 0;
  return false;
}

function checkCampaignMissionComplete() {
  if (run.mode !== MODE.CAMPAIGN) return;
  if (!run.active) return;
  if (run.campaign.completed) return;
  const mission = getCampaignMission(run.campaign.missionId);
  const ok = mission.objectives.every((o) => isCampaignObjectiveComplete(o));
  if (!ok) return;
  run.campaign.completed = true;
  endRun("campaign_complete");
}

function onlineInit() {
  cloudInit();
  updateAuthUi();
}

async function onlineSignIn() {
  try {
    await cloudSignInGoogle();
  } catch (err) {
    console.warn("[AUTH] sign-in failed", err);
    const code = String((err && err.code) || "");
    let message = "Google sign-in failed. Try again.";
    if (code.includes("popup-blocked")) {
      message = "Popup blocked. Allow popups for this site and try again.";
    } else if (code.includes("popup-closed-by-user")) {
      message = "Sign-in popup was closed before completion.";
    } else if (code.includes("unauthorized-domain")) {
      const host = window.location.hostname || "current host";
      message = `Firebase Auth does not allow ${host}. Add it in Firebase Authorized domains.`;
    } else if (code.includes("operation-not-allowed")) {
      message = "Google sign-in is disabled in Firebase Auth settings.";
    }
    showToast(message, 3200);
  }
}

async function onlineSignOut() {
  try {
    await cloudSignOut();
  } catch (err) {
    console.warn("[AUTH] sign-out failed", err);
  }
}

const ONLINE_SESSION = {
  roomCode: "",
  role: "", // "host" or "guest"
  opponentRole: "",
  roomRef: null,
  playersRef: null,
  eventsRef: null,
  cleanup: [],
  lastEventKey: null,
  ignoreEventsBefore: 0,
  opponentState: null,
};

function onlinePlayerLabel(playerData, fallback = "Pilot") {
  const fromName = playerData && typeof playerData.name === "string" ? playerData.name.trim() : "";
  if (fromName) return fromName.slice(0, 20);
  return String(fallback || "Pilot").slice(0, 20);
}

function onlineSelfIdentity() {
  const cloudName = CLOUD.user && CLOUD.user.displayName;
  return {
    name: String(SAVE.profile.name || cloudName || "Pilot").slice(0, 20),
  };
}

function onlineEnabled() {
  return Boolean(CLOUD.enabled && CLOUD.user && CLOUD.rtdb);
}

function randomRoomCode(len = 6) {
  const alphabet = "BCEFGHIJKLMNPQRTUVXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function onlineRoomPath(code) {
  return `rooms/${String(code || "").toUpperCase().trim()}`;
}

function onlineLeaveRoom() {
  ONLINE_SESSION.cleanup.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
  ONLINE_SESSION.cleanup = [];
  ONLINE_SESSION.roomRef = null;
  ONLINE_SESSION.playersRef = null;
  ONLINE_SESSION.eventsRef = null;
  ONLINE_SESSION.roomCode = "";
  ONLINE_SESSION.role = "";
  ONLINE_SESSION.opponentRole = "";
  ONLINE_SESSION.lastEventKey = null;
  ONLINE_SESSION.ignoreEventsBefore = 0;
  ONLINE_SESSION.opponentState = null;
}

async function onlineCreateRoom() {
  cloudInit();
  if (!onlineEnabled()) {
    setOnlineHint(
      !CLOUD.enabled ? "Online duel is unavailable right now." : "Sign in to create a room.",
      CLOUD.devStatus
    );
    return;
  }

  const usernameOk = await ensureUniqueUsernameForAccount(true);
  if (!usernameOk) {
    onlineHintEl.textContent = "You need a unique username before creating a room.";
    return;
  }

  const code = randomRoomCode(6);
  const uid = CLOUD.user.uid;
  const shipId = SAVE.profile.selectedShipId || "scout";
  const identity = onlineSelfIdentity();

  onlineLeaveRoom();

  const ref = CLOUD.rtdb.ref(onlineRoomPath(code));
  await ref.set({
    code,
    status: "waiting",
    createdAt: nowMs(),
    seed: Math.floor(Math.random() * 1e9),
    hostUid: uid,
    guestUid: null,
    players: {
      host: {
        uid,
        name: identity.name,
        shipId,
        joinedAt: nowMs(),
      },
    },
  });

  ONLINE_SESSION.roomCode = code;
  ONLINE_SESSION.role = "host";
  ONLINE_SESSION.opponentRole = "guest";
  ONLINE_SESSION.roomRef = ref;
  ONLINE_SESSION.playersRef = ref.child("players");
  ONLINE_SESSION.eventsRef = ref.child("events");

  roomCodeEl.value = code;
  onlineAttachRoomListeners();
  onlineHintEl.textContent = `Room created: ${code}. Share the code, then press Start Duel.`;
}

async function onlineJoinRoom(codeRaw) {
  cloudInit();
  if (!onlineEnabled()) {
    setOnlineHint(
      !CLOUD.enabled ? "Online duel is unavailable right now." : "Sign in to join a room.",
      CLOUD.devStatus
    );
    return;
  }

  const usernameOk = await ensureUniqueUsernameForAccount(true);
  if (!usernameOk) {
    onlineHintEl.textContent = "You need a unique username before joining a room.";
    return;
  }

  const code = String(codeRaw || "").toUpperCase().trim();
  if (!code) {
    onlineHintEl.textContent = "Enter a room code.";
    return;
  }

  onlineLeaveRoom();

  const ref = CLOUD.rtdb.ref(onlineRoomPath(code));
  const snap = await ref.get();
  if (!snap.exists()) {
    onlineHintEl.textContent = "Room not found.";
    return;
  }

  const data = snap.val() || {};
  const uid = CLOUD.user.uid;
  const shipId = SAVE.profile.selectedShipId || "scout";
  const identity = onlineSelfIdentity();

  if (data.hostUid === uid) {
    ONLINE_SESSION.role = "host";
    ONLINE_SESSION.opponentRole = "guest";
  } else {
    ONLINE_SESSION.role = "guest";
    ONLINE_SESSION.opponentRole = "host";
  }

  // Try to claim guest slot if needed.
  if (ONLINE_SESSION.role === "guest") {
    if (data.guestUid && data.guestUid !== uid) {
      onlineHintEl.textContent = "Room is full.";
      return;
    }
    await ref.child("guestUid").set(uid);
    await ref.child("players/guest").set({
      uid,
      name: identity.name,
      shipId,
      joinedAt: nowMs(),
    });
  } else {
    // Re-join as host: ensure host player entry exists.
    await ref.child("players/host").update({
      uid,
      name: identity.name,
      shipId,
    });
  }

  ONLINE_SESSION.roomCode = code;
  ONLINE_SESSION.roomRef = ref;
  ONLINE_SESSION.playersRef = ref.child("players");
  ONLINE_SESSION.eventsRef = ref.child("events");

  onlineAttachRoomListeners();
  onlineHintEl.textContent = `Joined room ${code}. Waiting for host to start.`;
}

function onlineAttachRoomListeners() {
  if (!ONLINE_SESSION.roomRef) return;

  const roomRef = ONLINE_SESSION.roomRef;
  ONLINE_SESSION.ignoreEventsBefore = nowMs();

  const onRoomValue = (snap) => {
    const v = snap.val() || {};
    const players = (v && v.players) || {};
    const hostReady = Boolean(v.players && v.players.host && v.players.host.uid);
    const guestReady = Boolean(v.players && v.players.guest && v.players.guest.uid);
    const status = v.status || "waiting";
    const who = hostReady && guestReady ? "2/2 players" : hostReady ? "1/2 players" : "0/2 players";
    onlineHintEl.textContent = `Room ${ONLINE_SESSION.roomCode} - ${who} - ${status}`;

    if (run.active && run.mode === MODE.DUEL && run.duel.kind === "online") {
      run.duel.localLabel = onlinePlayerLabel(players[ONLINE_SESSION.role], "You");
      run.duel.opponentLabel = onlinePlayerLabel(players[ONLINE_SESSION.opponentRole], "Opponent");
      onlineApplyRemoteMatchResult(v);
    }

    if (status === "playing" && state !== STATE.RUN) {
      // Auto-start match when room flips to playing.
      startOnlineDuelFromRoom(v);
    }
  };

  roomRef.on("value", onRoomValue);
  ONLINE_SESSION.cleanup.push(() => roomRef.off("value", onRoomValue));

  // Listen for opponent state updates.
  const oppRef = roomRef.child(`players/${ONLINE_SESSION.opponentRole}/state`);
  const onOppState = (snap) => {
    ONLINE_SESSION.opponentState = snap.val() || null;
  };
  oppRef.on("value", onOppState);
  ONLINE_SESSION.cleanup.push(() => oppRef.off("value", onOppState));

  // Listen for bullet events.
  const eventsRef = roomRef.child("events");
  const onEvent = (snap) => {
    const ev = snap.val() || {};
    if (!ev || ev.type !== "bullet") return;
    if (ev.from === ONLINE_SESSION.role) return;
    if (Number(ev.ts || 0) < (ONLINE_SESSION.ignoreEventsBefore || 0)) return;
    const nx = Number(ev.nx);
    const ny = Number(ev.ny);
    const nvx = Number(ev.nvx);
    const nvy = Number(ev.nvy);
    const x = Number.isFinite(nx) ? nx * WORLD.width : Number(ev.x);
    const y = Number.isFinite(ny) ? ny * WORLD.height : Number(ev.y);
    const vx = Number.isFinite(nvx) ? nvx * WORLD.width : Number(ev.vx);
    const vy = Number.isFinite(nvy) ? nvy * WORLD.height : Number(ev.vy);
    // Spawn remote bullet locally.
    spawnBullet({
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      vx: Number.isFinite(vx) ? vx : 0,
      vy: Number.isFinite(vy) ? vy : 0,
      team: "enemy",
      damage: ev.damage,
      pierce: 0,
    });
  };
  const q = eventsRef.limitToLast(50);
  q.on("child_added", onEvent);
  ONLINE_SESSION.cleanup.push(() => q.off("child_added", onEvent));
}

async function onlineStartDuel() {
  cloudInit();
  if (!onlineEnabled()) {
    // Fallback: practice duel (offline AI)
    onlineHintEl.textContent = "Online not ready. Starting a practice duel vs AI.";
    startRun(MODE.DUEL, { duelKind: "ai" });
    return;
  }

  if (!ONLINE_SESSION.roomRef) {
    onlineHintEl.textContent = "Create or join a room first.";
    return;
  }

  const snap = await ONLINE_SESSION.roomRef.once("value");
  const v = snap.val() || {};
  const hostReady = Boolean(v.players && v.players.host && v.players.host.uid);
  const guestReady = Boolean(v.players && v.players.guest && v.players.guest.uid);
  if (!hostReady || !guestReady) {
    onlineHintEl.textContent = "Need 2 players in the room before starting.";
    return;
  }

  if (ONLINE_SESSION.role !== "host") {
    onlineHintEl.textContent = "Waiting for host to start the duel...";
    return;
  }

  await ONLINE_SESSION.roomRef.update({
    status: "playing",
    startedAt: nowMs(),
  });
}

function startOnlineDuelFromRoom(room) {
  // Defensive: only start if we have an attached session.
  if (!ONLINE_SESSION.roomRef || !ONLINE_SESSION.roomCode) return;
  if (!run.active || run.mode !== MODE.DUEL || run.duel.kind !== "online") {
    setMenuOpen(false);
    startRun(MODE.DUEL, { duelKind: "online" });
  }

  const local = room && room.players && room.players[ONLINE_SESSION.role] ? room.players[ONLINE_SESSION.role] : null;
  const opp = room && room.players && room.players[ONLINE_SESSION.opponentRole] ? room.players[ONLINE_SESSION.opponentRole] : null;
  run.duel.localLabel = onlinePlayerLabel(local, "You");
  run.duel.opponentLabel = onlinePlayerLabel(opp, "Opponent");

  // Keep enemy visually distinct from local ship.
  const enemy = entities.enemies.find((e) => e.type === "pvp");
  if (enemy) {
    enemy.color = "#ff8f5a";
  }
}

function isOnlineDuelActive() {
  return run.active && run.mode === MODE.DUEL && run.duel && run.duel.kind === "online" && Boolean(ONLINE_SESSION.roomRef);
}

function onlineApplyRemoteMatchResult(room) {
  if (!isOnlineDuelActive()) return;
  if (state !== STATE.RUN) return;
  if (!run.duel || run.duel.remoteEndApplied) return;

  const results = (room && room.results) || {};
  const localResult = results[ONLINE_SESSION.role] || null;
  const opponentResult = results[ONLINE_SESSION.opponentRole] || null;
  const localOutcome = localResult && localResult.outcome ? String(localResult.outcome) : "";
  const oppOutcome = opponentResult && opponentResult.outcome ? String(opponentResult.outcome) : "";

  if (localOutcome === "loss" || oppOutcome === "win") {
    run.duel.remoteEndApplied = true;
    // Reuse local death flow so the losing ship explodes before defeat screen.
    takeDamage(Math.max(1, player.shield + player.hull + 9999));
    return;
  }

  if (localOutcome === "win" || oppOutcome === "loss") {
    run.duel.remoteEndApplied = true;
    endRun("duel_win");
  }
}

function onlineDuelMaybeSendBullet(b) {
  if (!isOnlineDuelActive()) return;
  if (!ONLINE_SESSION.eventsRef) return;
  // Keep payload small and deterministic-ish.
  ONLINE_SESSION.eventsRef.push({
    type: "bullet",
    from: ONLINE_SESSION.role,
    x: Math.round(b.x * 100) / 100,
    y: Math.round(b.y * 100) / 100,
    vx: Math.round(b.vx * 100) / 100,
    vy: Math.round(b.vy * 100) / 100,
    nx: Math.round((b.x / Math.max(1, WORLD.width)) * 10000) / 10000,
    ny: Math.round((b.y / Math.max(1, WORLD.height)) * 10000) / 10000,
    nvx: Math.round((b.vx / Math.max(1, WORLD.width)) * 10000) / 10000,
    nvy: Math.round((b.vy / Math.max(1, WORLD.height)) * 10000) / 10000,
    ww: Math.round(WORLD.width),
    wh: Math.round(WORLD.height),
    damage: Math.round(Number(b.damage || 0) * 100) / 100,
    ts: nowMs(),
  });
}

function onlineDuelMaybeSendState() {
  if (!isOnlineDuelActive()) return;
  if (!ONLINE_SESSION.roomRef || !ONLINE_SESSION.role) return;
  const now = nowMs();
  if (now - (run.duel.lastSendAt || 0) < 70) return; // ~14Hz
  run.duel.lastSendAt = now;

  ONLINE_SESSION.roomRef.child(`players/${ONLINE_SESSION.role}/state`).set({
    x: Math.round(player.x * 100) / 100,
    y: Math.round(player.y * 100) / 100,
    nx: Math.round((player.x / Math.max(1, WORLD.width)) * 10000) / 10000,
    ny: Math.round((player.y / Math.max(1, WORLD.height)) * 10000) / 10000,
    ww: Math.round(WORLD.width),
    wh: Math.round(WORLD.height),
    a: Math.round(player.angle * 1000) / 1000,
    alive: Boolean(player.alive),
    ts: now,
  });
}

function onlineDuelApplyOpponentState(dt) {
  if (!isOnlineDuelActive()) return;
  const st = ONLINE_SESSION.opponentState;
  if (!st) return;
  const enemy = entities.enemies.find((e) => e.type === "pvp");
  if (!enemy) return;

  // Smooth remote motion to hide jitter.
  const nx = Number(st.nx);
  const ny = Number(st.ny);
  const tx = Number.isFinite(nx) ? nx * WORLD.width : Number(st.x);
  const ty = Number.isFinite(ny) ? ny * WORLD.height : Number(st.y);
  if (Number.isFinite(tx)) enemy.x = lerp(enemy.x, tx, clamp(dt * 10, 0, 1));
  if (Number.isFinite(ty)) enemy.y = lerp(enemy.y, ty, clamp(dt * 10, 0, 1));
}

function onlineDuelReportEnd(reason) {
  if (!(run.mode === MODE.DUEL && run.duel && run.duel.kind === "online" && ONLINE_SESSION.roomRef && ONLINE_SESSION.role))
    return;

  const outcome = reason === "duel_win" ? "win" : "loss";
  ONLINE_SESSION.roomRef.child(`results/${ONLINE_SESSION.role}`).set({
    uid: CLOUD.user ? CLOUD.user.uid : null,
    name: SAVE.profile.name,
    outcome,
    score: Math.floor(run.score),
    ts: nowMs(),
  });

  if (ONLINE_SESSION.role === "host") {
    ONLINE_SESSION.roomRef.update({ status: "ended", endedAt: nowMs() }).catch(() => {});
  }
}

// -----------------------------
// Gameplay
// -----------------------------

const stars = Array.from({ length: 180 }, () => ({
  x: Math.random() * WORLD.width,
  y: Math.random() * WORLD.height,
  z: Math.random() * 1 + 0.25,
  tw: Math.random() * TAU,
}));

const entities = {
  bullets: [],
  enemies: [],
  pickups: [],
  beacons: [],
  particles: [],
  drones: [],
  mines: [],
  damageTexts: [],
};

const run = {
  active: false,
  mode: MODE.SURVIVAL,
  time: 0,
  score: 0,
  wave: 1,
  waveRemaining: 10,
  bossAlive: false,
  combo: 1,
  comboTimer: 0,
  shake: 0,
  hitFlash: 0,
  kills: 0,
  runUpgrades: {},
  duel: {
    kind: "ai", // "ai" | "online"
    roomCode: "",
    role: "",
    opponentRole: "",
    localLabel: "",
    opponentLabel: "",
    remoteEndApplied: false,
    lastSendAt: 0,
  },
  campaign: {
    missionId: 1,
    completed: false,
    killsByType: {},
    bossesKilled: 0,
    pickupsCollected: 0,
    beaconsCollected: 0,
    beaconsTotal: 0,
    zoneTime: 0,
    zoneSeconds: 0,
    zone: null, // {x,y,r}
    hullHit: false,
    shotsFired: 0,
  },
  aim: {
    targetId: "",
    lockUntil: 0,
    selectedOnce: false,
    autoActiveUntil: 0,
    autoCooldownUntil: 0,
  },
  ability: {
    key: "",
    name: "",
    cooldown: 0,
    cooldownUntil: 0,
    activeUntil: 0,
    uses: 0,
    maxUses: 0,
    description: "",
  },
  canAdContinue: false,
  continueUsed: false,
  reviveShield: 0,
};

const player = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  vx: 0,
  vy: 0,
  angle: 0,
  speed: 280,
  radius: 18,
  fireRate: 0.14,
  fireTimer: 0,
  bulletSpeed: 560,
  damage: 1,
  pierce: 0,
  shield: 100,
  shieldMax: 100,
  shieldRegen: 3,
  hull: 100,
  hullMax: 100,
  alive: true,
  hitCooldown: 0,
  invulnerableUntil: 0,
  damageTakenMult: 1,
  critChance: 0,
};

const PLAYER_BOUND_PAD = 6;

const AD_REWARDS = {
  survival: { seconds: 20, credits: 320, crystals: 0, xp: 80 },
  campaign: { seconds: 35, credits: 440, crystals: 0, xp: 120 },
  duel: { seconds: 45, credits: 560, crystals: 0, xp: 140 },
  hangar_credits: { seconds: 20, credits: 420, crystals: 0, xp: 0 },
  hangar_crystals: { seconds: 22, credits: 120, crystals: 2, xp: 0 },
};

const AD_CONTINUE_MIN_AWAY_MS = 10000;
const AD_CONTINUE_COOLDOWN_MS = 90000;
const AD_SERVER_DAY_CAP = 15;

function adRewardDayKey() {
  return localDayKey();
}

function ensureAdRewardDay() {
  const today = adRewardDayKey();
  if (SAVE.profile.adRewardsDay !== today) {
    SAVE.profile.adRewardsDay = today;
    SAVE.profile.adRewardsClaimed = 0;
  }
}

function ensureAdServerDay() {
  const today = localDayKey();
  if (SAVE.profile.adServerClaimsDay !== today) {
    SAVE.profile.adServerClaimsDay = today;
    SAVE.profile.adServerClaims = 0;
  }
}

function getRewardedProvider() {
  if (window.rewardedAdProvider && typeof window.rewardedAdProvider.isAvailable === "function") {
    return window.rewardedAdProvider;
  }
  return {
    isAvailable: () => Boolean(ADS.mockEnabled),
    showRewardedAd: async () => {
      if (!ADS.mockEnabled) return { completed: false, reason: "unavailable" };
      await runMockRewardedAd();
      return { completed: true, reason: "mock_completed" };
    },
  };
}

function adIntegrityBlocked() {
  if (REWARD_STATE && typeof REWARD_STATE.integrityClockBlocked === "function") {
    return REWARD_STATE.integrityClockBlocked(SAVE.profile, nowMs);
  }
  const now = nowMs();
  const lastIntegrity = Number(SAVE.profile.adIntegrityLastAt || 0);
  if (lastIntegrity && now + 30000 < lastIntegrity) {
    return true;
  }
  SAVE.profile.adIntegrityLastAt = now;
  return false;
}

function adRewardsUnlimited() {
  if (ADS.unlimitedRewards) {
    LOG.warn("ads_unlimited_disabled", { configured: true });
  }
  return false;
}

function adRewardStatus() {
  if (REWARD_STATE && typeof REWARD_STATE.status === "function") {
    return REWARD_STATE.status({
      profile: SAVE.profile,
      session: SESSION,
      caps: {
        dailyCap: ADS.dailyCap,
        sessionCap: ADS.sessionCap,
        cooldownMs: ADS.cooldownMs,
      },
      nowMs,
      dayKey: adRewardDayKey,
      onDayReset: () => {
        SAVE.profile.adRewardsClaimed = 0;
        SAVE.profile.adServerClaims = 0;
      },
    });
  }
  ensureAdRewardDay();
  const claimed = Math.max(0, Math.floor(Number(SAVE.profile.adRewardsClaimed || 0)));
  const sessionClaimed = Math.max(0, Math.floor(Number(SESSION.rewardedAdsClaimed || 0)));
  const remaining = Math.max(0, ADS.dailyCap - claimed);
  const sessionRemaining = Math.max(0, ADS.sessionCap - sessionClaimed);
  const cooldownUntil = Number(SAVE.profile.adRewardLastAt || 0) + ADS.cooldownMs;
  const waitMs = Math.max(0, cooldownUntil - Date.now());
  return { claimed, remaining, waitMs, sessionClaimed, sessionRemaining };
}

function formatCooldown(waitMs) {
  if (REWARD_STATE && typeof REWARD_STATE.formatCooldown === "function") {
    return REWARD_STATE.formatCooldown(waitMs);
  }
  const sec = Math.max(1, Math.ceil(waitMs / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function consumeAdRewardSlot() {
  const unlimited = adRewardsUnlimited();
  if (REWARD_STATE && typeof REWARD_STATE.consume === "function") {
    const result = REWARD_STATE.consume({
      profile: SAVE.profile,
      session: SESSION,
      caps: {
        dailyCap: ADS.dailyCap,
        sessionCap: ADS.sessionCap,
        cooldownMs: ADS.cooldownMs,
      },
      nowMs,
      dayKey: adRewardDayKey,
      unlimited,
    });
    if (!result.ok) return false;
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    return true;
  }
  if (unlimited) {
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    return true;
  }
  const status = adRewardStatus();
  if (status.remaining <= 0 || status.waitMs > 0 || status.sessionRemaining <= 0) return false;
  SAVE.profile.adRewardsClaimed = status.claimed + 1;
  SAVE.profile.adRewardLastAt = nowMs();
  SESSION.rewardedAdsClaimed = status.sessionClaimed + 1;
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  return true;
}

function hasRewardedAdapter() {
  const provider = getRewardedProvider();
  return Boolean(provider && provider.isAvailable && provider.isAvailable());
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMockRewardedAd(onTick) {
  let remaining = ADS.mockSeconds;
  while (remaining > 0) {
    if (typeof onTick === "function") onTick(remaining);
    await delay(1000);
    remaining -= 1;
  }
}

async function requestRewardedAdCompletion(modeKey, onTick) {
  const provider = getRewardedProvider();
  if (provider && provider.isAvailable()) {
    console.info("rewarded_requested", { placement: modeKey });
    trackEvent("rewarded_requested", { placement: modeKey });
    const result = await provider.showRewardedAd({ placement: modeKey, onTick });
    const completed = Boolean(result && result.completed);
    const reason = (result && result.reason) || (completed ? "completed" : "not_completed");
    if (completed) {
      console.info("rewarded_completed", { placement: modeKey });
      trackEvent("rewarded_completed", { placement: modeKey });
    } else {
      console.info("rewarded_failed", { placement: modeKey, reason });
      trackEvent("rewarded_failed", { placement: modeKey, reason });
    }
    return {
      completed,
      reason,
      awayMs: Math.max(0, Math.floor(Number(result && result.awayMs || 0))),
    };
  }

  console.info("rewarded_failed", { placement: modeKey, reason: "provider_unavailable" });
  trackEvent("rewarded_failed", { placement: modeKey, reason: "provider_unavailable" });
  return { completed: false, reason: "provider_unavailable", awayMs: 0 };
}

async function authBearerToken() {
  try {
    cloudInit();
    if (!CLOUD.enabled || !CLOUD.user) return "";
    return await CLOUD.user.getIdToken();
  } catch {
    return "";
  }
}

async function requestRewardClaimToken(placement, rewardCfg) {
  if (!FLAGS.isEnabled("server_reward_claim_v1", true)) return { ok: false, reason: "feature_disabled" };
  try {
    const idToken = await authBearerToken();
    const headers = {
      "Content-Type": "application/json",
    };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;

    const res = await fetch(`${paymentsApiBase()}/api/rewards/token`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        placement,
        reward: {
          credits: Math.max(0, Math.floor(Number(rewardCfg && rewardCfg.credits || 0))),
          crystals: Math.max(0, Math.floor(Number(rewardCfg && rewardCfg.crystals || 0))),
          xp: Math.max(0, Math.floor(Number(rewardCfg && rewardCfg.xp || 0))),
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, reason: `token_http_${res.status}`, detail: errText };
    }
    const data = await res.json();
    if (!data || !data.token) return { ok: false, reason: "token_missing" };
    return { ok: true, token: data.token, ttlMs: Number(data.ttlMs || 0), guest: Boolean(data.guest) };
  } catch (err) {
    return { ok: false, reason: String((err && err.message) || "token_failed") };
  }
}

async function claimRewardServer(token, placement, rewardCfg, awayMs) {
  if (!FLAGS.isEnabled("server_reward_claim_v1", true)) return { ok: false, reason: "feature_disabled" };
  if (!token) return { ok: false, reason: "token_required" };
  try {
    const idToken = await authBearerToken();
    const headers = {
      "Content-Type": "application/json",
    };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;

    const res = await fetch(`${paymentsApiBase()}/api/rewards/claim`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        token,
        placement,
        awayMs: Math.max(0, Math.floor(Number(awayMs || 0))),
        reward: {
          credits: Math.max(0, Math.floor(Number(rewardCfg && rewardCfg.credits || 0))),
          crystals: Math.max(0, Math.floor(Number(rewardCfg && rewardCfg.crystals || 0))),
          xp: Math.max(0, Math.floor(Number(rewardCfg && rewardCfg.xp || 0))),
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        reason: (data && data.error) || `claim_http_${res.status}`,
        status: res.status,
      };
    }
    return { ok: true, data: data || {} };
  } catch (err) {
    return { ok: false, reason: String((err && err.message) || "claim_failed") };
  }
}

const ENEMY_TYPES = {
  drone: {
    hp: (wave) => 2 + Math.floor(wave * 0.15),
    speed: (wave) => 120 + wave * 5,
    size: 14,
    color: "#ef476f",
    score: 16,
    shoot: false,
  },
  fighter: {
    hp: (wave) => 4 + Math.floor(wave * 0.22),
    speed: (wave) => 95 + wave * 4,
    size: 18,
    color: "#ff6b6b",
    score: 22,
    shoot: true,
    fireRate: (wave) => Math.max(0.75, 1.25 - wave * 0.02),
    bulletSpeed: 260,
    damage: 10,
  },
  sniper: {
    hp: (wave) => 6 + Math.floor(wave * 0.25),
    speed: (wave) => 70 + wave * 2,
    size: 16,
    color: "#f77f00",
    score: 32,
    shoot: true,
    fireRate: (wave) => Math.max(1.1, 1.8 - wave * 0.02),
    bulletSpeed: 340,
    damage: 14,
  },
  rammer: {
    hp: (wave) => 10 + Math.floor(wave * 0.35),
    speed: (wave) => 145 + wave * 4,
    size: 22,
    color: "#ffd166",
    score: 38,
    shoot: false,
  },
  lancer: {
    hp: (wave) => 7 + Math.floor(wave * 0.25),
    speed: (wave) => 170 + wave * 4.5,
    size: 16,
    color: "#8de7ff",
    score: 42,
    shoot: false,
  },
  bulwark: {
    hp: (wave) => 20 + Math.floor(wave * 0.52),
    speed: (wave) => 82 + wave * 2.4,
    size: 26,
    color: "#ffb86c",
    score: 52,
    shoot: false,
  },
  leech: {
    hp: (wave) => 12 + Math.floor(wave * 0.32),
    speed: (wave) => 110 + wave * 3.2,
    size: 20,
    color: "#d576ff",
    score: 48,
    shoot: true,
    fireRate: (wave) => Math.max(0.85, 1.4 - wave * 0.018),
    bulletSpeed: 290,
    damage: 11,
  },
  boss: {
    hp: (wave) => 60 + wave * 10,
    speed: (wave) => 50 + wave * 1,
    size: 46,
    color: "#7bdff2",
    score: 250,
    shoot: true,
    fireRate: () => 0.7,
    bulletSpeed: 300,
    damage: 14,
  },
  duelist: {
    hp: () => 130,
    speed: () => 120,
    size: 22,
    color: "#ff7ad9",
    score: 350,
    shoot: true,
    fireRate: () => 0.55,
    bulletSpeed: 300,
    damage: 12,
  },
  // PvP opponent (online duel). Movement + shooting are driven by realtime state/events.
  pvp: {
    hp: () => 160,
    speed: () => 0,
    size: 22,
    color: "#40f3ff",
    score: 500,
    shoot: false,
  },
};

function applyStats() {
  const base = computePermanentStats();
  const u = run.runUpgrades;

  const multDamage = 1 + (u.overcharge || 0) * 0.18;
  const multFire = Math.pow(0.92, u.rapid || 0);
  const extraPierce = u.pierce ? u.pierce : 0;

  player.speed = base.speed * (1 + (u.thrusters || 0) * 0.06);
  player.bulletSpeed = base.bulletSpeed * (1 + (u.ballistics || 0) * 0.08);
  player.damage = base.damage * multDamage;
  player.fireRate = Math.max(0.05, base.fireRate * multFire);
  player.pierce = base.pierce + extraPierce;
  player.critChance = clamp(Number(base.critChance || 0), 0, 0.35);

  const shieldBoost = 1 + (u.shield || 0) * 0.18;
  player.shieldMax = Math.floor(base.shieldMax * shieldBoost);
  player.hullMax = Math.floor(base.hullMax * (1 + (u.hull || 0) * 0.15));
  player.shieldRegen = base.shieldRegen * (1 + (u.regen || 0) * 0.22);

  player.shield = clamp(player.shield, 0, player.shieldMax);
  player.hull = clamp(player.hull, 0, player.hullMax);

  // Drones (permanent + run)
  const droneCount = base.droneCount + (u.drone || 0);
  while (entities.drones.length < droneCount) {
    entities.drones.push({
      x: player.x,
      y: player.y,
      angle: Math.random() * TAU,
      fire: 0,
    });
  }
  if (entities.drones.length > droneCount) {
    entities.drones.length = droneCount;
  }
}

function resetRun(mode) {
  run.active = false;
  run.mode = mode;
  run.time = 0;
  run.score = 0;
  run.wave = 1;
  run.waveRemaining = 10;
  run.bossAlive = false;
  run.combo = 1;
  run.comboTimer = 0;
  run.shake = 0;
  run.hitFlash = 0;
  run.kills = 0;
  run.runUpgrades = {};
  run.canAdContinue = mode !== MODE.DUEL;
  run.continueUsed = false;
  run.reviveShield = 0;
  run.duel = {
    kind: "ai",
    roomCode: "",
    role: "",
    opponentRole: "",
    localLabel: "",
    opponentLabel: "",
    remoteEndApplied: false,
    lastSendAt: 0,
  };
  run.campaign = {
    missionId: SAVE.profile.campaignUnlocked,
    completed: false,
    killsByType: {},
    bossesKilled: 0,
    pickupsCollected: 0,
    beaconsCollected: 0,
    beaconsTotal: 0,
    zoneTime: 0,
    zoneSeconds: 0,
    zone: null,
    hullHit: false,
    shotsFired: 0,
  };
  run.aim = {
    targetId: "",
    lockUntil: 0,
    selectedOnce: false,
    autoActiveUntil: 0,
    autoCooldownUntil: 0,
  };
  run.ability = {
    key: "",
    name: "",
    cooldown: 0,
    cooldownUntil: 0,
    activeUntil: 0,
    uses: 0,
    maxUses: 0,
    description: "",
  };

  entities.bullets = [];
  entities.enemies = [];
  entities.pickups = [];
  entities.beacons = [];
  entities.particles = [];
  entities.drones = [];
  entities.mines = [];
  entities.damageTexts = [];

  const base = computePermanentStats();

  player.x = WORLD.width / 2;
  player.y = WORLD.height / 2;
  player.vx = 0;
  player.vy = 0;
  player.fireTimer = 0;
  player.angle = 0;
  player.alive = true;
  player.hitCooldown = 0;
  player.invulnerableUntil = 0;
  player.damageTakenMult = 1;
  player.shieldMax = base.shieldMax;
  player.shield = player.shieldMax;
  player.shieldRegen = base.shieldRegen;
  player.hullMax = base.hullMax;
  player.hull = player.hullMax;
  player.critChance = Number(base.critChance || 0);

  applyStats();
  configureRunAbility();
}

function adaptiveDifficultyScalar() {
  if (!SAVE.profile.adaptiveDifficultyEnabled) return 1;
  if (!run.active) return 1;
  const hpRatio = ((player.shield + player.hull) / Math.max(1, player.shieldMax + player.hullMax)) || 0;
  if (run.time < 45) return 0.92;
  if (hpRatio > 0.82) return 1.08;
  if (hpRatio < 0.42) return 0.9;
  return 1;
}

function spawnEnemy(typeKey) {
  const type = ENEMY_TYPES[typeKey];
  if (!type) return;

  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (edge === 0) {
    x = rand(0, WORLD.width);
    y = -40;
  } else if (edge === 1) {
    x = WORLD.width + 40;
    y = rand(0, WORLD.height);
  } else if (edge === 2) {
    x = rand(0, WORLD.width);
    y = WORLD.height + 40;
  } else {
    x = -40;
    y = rand(0, WORLD.height);
  }

  const wave = run.wave;
  const adaptive = adaptiveDifficultyScalar();
  const eliteChance =
    typeKey === "boss" || typeKey === "pvp" || typeKey === "duelist"
      ? 0
      : Math.min(0.28, Math.max(0, (wave - 6) * 0.011));
  const elite = Math.random() < eliteChance;
  const modifiers = [];
  if (elite) {
    const pool = ["fast", "armored", "volatile", "leech"];
    const count = wave >= 24 ? 2 : 1;
    for (let i = 0; i < count && pool.length; i += 1) {
      const idx = Math.floor(Math.random() * pool.length);
      modifiers.push(pool.splice(idx, 1)[0]);
    }
  }
  let hpMult = elite ? 1.38 : 1;
  let speedMult = elite ? 1.08 : 1;
  if (modifiers.includes("fast")) speedMult *= 1.24;
  if (modifiers.includes("armored")) hpMult *= 1.34;
  if (modifiers.includes("leech")) hpMult *= 1.1;
  const maxHp = type.hp(wave) * adaptive;
  const bossVariant =
    typeKey === "boss"
      ? wave % 8 < 4
        ? "sentinel"
        : "carrier"
      : "";
  entities.enemies.push({
    id: Math.random().toString(16).slice(2),
    type: typeKey,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: maxHp * hpMult,
    maxHp: maxHp * hpMult,
    speed: type.speed(wave) * speedMult * adaptive,
    size: type.size + (elite ? 3 : 0),
    color: elite ? "#ffdb6e" : type.color,
    elite,
    modifiers,
    bossVariant,
    phaseIndex: 1,
    nextSpecialAt: 0,
    fire: rand(0, 0.7),
    orbit: rand(-1, 1),
    phase: rand(0, TAU),
  });
}

function spawnPvpEnemyAt(x, y) {
  const type = ENEMY_TYPES.pvp;
  const maxHp = type.hp(run.wave);
  entities.enemies.push({
    id: "pvp",
    type: "pvp",
    x,
    y,
    vx: 0,
    vy: 0,
    hp: maxHp,
    maxHp,
    speed: 0,
    size: type.size,
    color: type.color,
    fire: 0,
    orbit: 0,
  });
}

function spawnPickup(x, y) {
  entities.pickups.push({
    x,
    y,
    vx: rand(-60, 60),
    vy: rand(-60, 60),
    life: 7,
    t: rand(0, TAU),
  });
}

function spawnBullet({ x, y, vx, vy, team, damage, pierce, life = 1.4, radius = null, kind = "normal", sourceId = "" }) {
  entities.bullets.push({
    x,
    y,
    vx,
    vy,
    life: Number(life || 1.4),
    team,
    damage,
    pierce,
    kind,
    sourceId,
    r: Number.isFinite(Number(radius)) ? Number(radius) : team === "player" ? 4 : 3,
  });
}

function burst(x, y, color, count = 18, power = 1) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * TAU;
    const sp = rand(70, 260) * power;
    entities.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rand(0.4, 1.0),
      color,
      size: rand(2, 5) * power,
    });
  }
}

function spawnDamageText(x, y, value, color = "#ffffff") {
  if (!SAVE.profile.damageNumbersEnabled) return;
  entities.damageTexts.push({
    x,
    y,
    value: Math.max(0, Math.floor(Number(value || 0))),
    color,
    life: 0.72,
    vy: -36 - Math.random() * 18,
  });
}

function playAbilitySfx() {
  const ctx = ensureAudioGraph();
  if (!ctx || !AUDIO.sfxGain) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(280, t0);
  osc.frequency.exponentialRampToValueAtTime(760, t0 + 0.14);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.22 * (destroySfxEnabled() ? 1 : 0.7), t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  osc.connect(gain);
  gain.connect(AUDIO.sfxGain);
  osc.start(t0);
  osc.stop(t0 + 0.2);
}

function canUseAbility() {
  if (!run.active || state !== STATE.RUN || !player.alive) return false;
  if (!run.ability || !run.ability.key) return false;
  if (run.time < Number(run.ability.cooldownUntil || 0)) return false;
  if (Number(run.ability.maxUses || 0) > 0 && Number(run.ability.uses || 0) >= Number(run.ability.maxUses || 0)) {
    return false;
  }
  return true;
}

function triggerShipAbility() {
  if (!canUseAbility()) return false;
  const key = run.ability.key;
  const bonus = accountTreeBonuses();
  const cooldown = Math.max(5, Number(run.ability.cooldown || 10) * Math.max(0.58, bonus.abilityCooldownMult || 1));
  run.ability.cooldownUntil = run.time + cooldown;
  run.ability.uses = Number(run.ability.uses || 0) + 1;
  SAVE.profile.abilityUses[key] = Number(SAVE.profile.abilityUses[key] || 0) + 1;

  if (key === "dash") {
    const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const useAngle = Math.abs(ax) + Math.abs(ay) > 0 ? Math.atan2(ay, ax) : player.angle;
    const dist = 170;
    const bound = player.radius + PLAYER_BOUND_PAD;
    player.x = clamp(player.x + Math.cos(useAngle) * dist, bound, WORLD.width - bound);
    player.y = clamp(player.y + Math.sin(useAngle) * dist, bound, WORLD.height - bound);
    player.invulnerableUntil = run.time + 0.4;
    run.shake = Math.min(18, run.shake + 4.4);
    burst(player.x, player.y, "#76f1ff", 24, 1.1);
  } else if (key === "overdrive") {
    run.ability.activeUntil = run.time + 6;
    burst(player.x, player.y, "#ffd07f", 20, 1.15);
  } else if (key === "rail_shot") {
    const speed = player.bulletSpeed * 1.35;
    spawnBullet({
      x: player.x + Math.cos(player.angle) * 24,
      y: player.y + Math.sin(player.angle) * 24,
      vx: Math.cos(player.angle) * speed,
      vy: Math.sin(player.angle) * speed,
      team: "player",
      damage: player.damage * 6.4,
      pierce: 6 + player.pierce,
      life: 2.2,
      radius: 5.5,
    });
    burst(player.x, player.y, "#ffd1ff", 18, 1.05);
  } else if (key === "drone_swarm") {
    run.ability.activeUntil = run.time + 12;
    for (let i = 0; i < 2; i += 1) {
      entities.drones.push({
        x: player.x,
        y: player.y,
        angle: Math.random() * TAU,
        fire: Math.random() * 0.4,
        temporaryUntil: run.time + 12,
      });
    }
    burst(player.x, player.y, "#8f8dff", 16, 1.08);
  } else if (key === "fortress") {
    run.ability.activeUntil = run.time + 5.5;
    player.shield = Math.min(player.shieldMax, player.shield + player.shieldMax * 0.35);
    burst(player.x, player.y, "#9cff6d", 20, 1.2);
  } else if (key === "heal_pulse") {
    player.hull = Math.min(player.hullMax, player.hull + Math.max(16, player.hullMax * 0.18));
    player.shield = Math.min(player.shieldMax, player.shield + Math.max(12, player.shieldMax * 0.22));
    burst(player.x, player.y, "#74ffcb", 22, 1.12);
  } else {
    run.ability.activeUntil = run.time + 4.5;
  }

  SAVE.profile.updatedAt = nowMs();
  saveNow();
  evaluateAchievements("ability_use");
  playAbilitySfx();
  updateAbilityHud();
  return true;
}

function updateAbilityHud() {
  if (!abilityLabelEl || !abilityCooldownEl) return;
  if (!run.active) {
    abilityLabelEl.textContent = "--";
    abilityCooldownEl.textContent = "Ready";
    if (touchAbilityBtn) {
      touchAbilityBtn.textContent = "ABILITY";
      touchAbilityBtn.disabled = true;
    }
    return;
  }
  abilityLabelEl.textContent = run.ability.name || "--";
  if (Number(run.ability.maxUses || 0) > 0) {
    const left = Math.max(0, Number(run.ability.maxUses) - Number(run.ability.uses || 0));
    if (left <= 0) {
      abilityCooldownEl.textContent = "No Uses";
      if (touchAbilityBtn) {
        touchAbilityBtn.textContent = "NO USES";
        touchAbilityBtn.disabled = true;
      }
      return;
    }
  }
  const wait = Math.max(0, Number(run.ability.cooldownUntil || 0) - run.time);
  if (wait <= 0) {
    abilityCooldownEl.textContent = "Ready";
    if (touchAbilityBtn) {
      touchAbilityBtn.textContent = run.ability.name ? `${run.ability.name}`.toUpperCase().slice(0, 10) : "ABILITY";
      touchAbilityBtn.disabled = false;
    }
    return;
  }
  abilityCooldownEl.textContent = `${Math.ceil(wait)}s`;
  if (touchAbilityBtn) {
    touchAbilityBtn.textContent = `${Math.ceil(wait)}s`;
    touchAbilityBtn.disabled = true;
  }
}

function configureRunAbility() {
  const shipId = SAVE.profile.selectedShipId || "scout";
  const ability = abilityForShip(shipId);
  run.ability = {
    key: ability.key,
    name: ability.name,
    cooldown: Number(ability.cooldown || 12),
    cooldownUntil: 0,
    activeUntil: 0,
    uses: 0,
    maxUses: Number(ability.maxUses || 0),
    description: ability.description || "",
  };
  updateAbilityHud();
}

function takeDamage(amount) {
  if (run.time < Number(player.invulnerableUntil || 0)) return;
  run.shake = Math.min(14, run.shake + 3.5);
  run.hitFlash = Math.min(1, run.hitFlash + 0.78);
  maybeVibrate(14);
  let incoming = Math.max(0, Number(amount || 0));
  if (run.ability && run.ability.key === "fortress" && run.time < Number(run.ability.activeUntil || 0)) {
    incoming *= 0.64;
  }
  incoming *= Math.max(0.1, Number(player.damageTakenMult || 1));
  let remaining = incoming;
  spawnDamageText(player.x + rand(-6, 6), player.y - 28, Math.round(incoming), "#ffbcc6");
  if (player.shield > 0) {
    const s = Math.min(player.shield, remaining);
    player.shield -= s;
    remaining -= s;
  }
  if (remaining > 0) {
    player.hull -= remaining;
    if (run.mode === MODE.CAMPAIGN) run.campaign.hullHit = true;
  }

  burst(player.x, player.y, "#ff5d7d", 16, 1.05);

  if (player.hull <= 0) {
    player.hull = 0;
    player.alive = false;
    burst(player.x, player.y, "#ffffff", 60, 1.4);
    playDestroySfx();
    maybeVibrate([28, 30, 56]);
    endRun("dead");
  }
}

function killEnemy(enemy) {
  const type = ENEMY_TYPES[enemy.type];
  if (!type) return;
  run.score += type.score;
  if (enemy.type !== "pvp") run.kills += 1;

  if (run.mode === MODE.SURVIVAL) {
    run.waveRemaining -= 1;
  }

  if (run.mode === MODE.CAMPAIGN) {
    const key = enemy.type;
    run.campaign.killsByType[key] = (run.campaign.killsByType[key] || 0) + 1;
    if (enemy.type === "boss") {
      run.campaign.bossesKilled += 1;
    }
  }
  burst(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 80 : 26, enemy.type === "boss" ? 1.4 : 1);
  if (enemy.modifiers && enemy.modifiers.includes("volatile")) {
    burst(enemy.x, enemy.y, "#ff8e72", 34, 1.25);
    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < 110 && player.alive) {
      const splash = Math.round(14 + Math.max(0, 90 - dist) * 0.09);
      takeDamage(splash);
    }
  }

  if (enemy.type !== "pvp") {
    const dropChance = enemy.type === "boss" ? 1 : 0.12 + Math.min(0.18, run.wave * 0.01);
    if (Math.random() < dropChance) spawnPickup(enemy.x, enemy.y);
  }

  if (enemy.type === "boss") {
    run.bossAlive = false;
    SAVE.profile.bossKills = Number(SAVE.profile.bossKills || 0) + 1;
  }

  if (enemy.type === "duelist" || enemy.type === "pvp") {
    endRun("duel_win");
    return;
  }

  if (run.mode === MODE.SURVIVAL) {
    if (run.waveRemaining <= 0 && !run.bossAlive) {
      run.wave += 1;
      run.waveRemaining = 12 + Math.floor(run.wave * 2.7);
      run.score += 50;
      if (run.wave % 4 === 0) {
        run.bossAlive = true;
        spawnEnemy("boss");
      }
    }
  }

  entities.enemies = entities.enemies.filter((e) => e.id !== enemy.id);
}

function sessionCreditMultiplier() {
  if (ECONOMY && typeof ECONOMY.sessionCreditMultiplier === "function") {
    return ECONOMY.sessionCreditMultiplier(SESSION.startedAt, Date.now());
  }
  const mins = (Date.now() - SESSION.startedAt) / 60000;
  if (mins <= 30) return 1;
  const over = mins - 30;
  return clamp(1 - over * 0.0025, 0.78, 1);
}

function endRun(reason) {
  if (reason === "dead" && run.mode === MODE.DUEL) reason = "duel_loss";
  run.active = false;
  player.alive = false;
  onlineDuelReportEnd(reason);

  const keepRewards = true;
  const runSeconds = Math.max(1, Math.floor(run.time));
  const farmMult = sessionCreditMultiplier();
  const baseRewards = ECONOMY && typeof ECONOMY.calculateRunRewards === "function"
    ? ECONOMY.calculateRunRewards({
        mode: run.mode,
        score: run.score,
        wave: run.wave,
        farmMult,
        reason,
        campaignCompleted: Boolean(run.mode === MODE.CAMPAIGN && run.campaign.completed),
        campaignMissionId: run.campaign && run.campaign.missionId ? run.campaign.missionId : 1,
      })
    : {
        credits: Math.floor((Math.floor(run.score * 0.08) + run.wave * 9) * farmMult),
        xp: Math.floor((Math.floor(run.score * 0.1) + run.wave * 8) * (0.95 + farmMult * 0.05)),
        crystals: 0,
      };
  let crystals = Math.max(0, Math.floor(Number(baseRewards.crystals || 0)));
  if (run.mode === MODE.SURVIVAL) {
    if (run.wave >= 10 && Math.random() < 0.03) crystals += 1;
    if (run.wave >= 20 && Math.random() < 0.03) crystals += 1;
  }

  const permanentStats = computePermanentStats();
  const creditMult = Math.max(1, Number(permanentStats.creditBonusMult || 1));
  let credits = Math.floor(Number(baseRewards.credits || 0) * creditMult);
  let xp = Math.floor(Number(baseRewards.xp || 0));
  let unlockNextMission = false;
  if (run.mode === MODE.CAMPAIGN && run.campaign.completed) {
    credits += 220 + run.campaign.missionId * 75;
    xp += 90 + run.campaign.missionId * 32;
    unlockNextMission = true;
  }

  const entry = {
    name: SAVE.profile.name,
    score: Math.floor(run.score),
    wave: run.wave,
    mode: run.mode,
    date: localDayKey(),
  };

  const prevBestScore = Number(SAVE.profile.bestScore || 0);
  const prevBestWave = Number(SAVE.profile.bestWave || 1);
  if (entry.score > prevBestScore) SAVE.profile.bestScore = entry.score;
  if (entry.wave > prevBestWave) SAVE.profile.bestWave = entry.wave;

  const currentRunKills = Math.max(0, Math.floor(run.kills || 0));
  const hadBestKillsBefore =
    SAVE.profile.bestSurvivalKills != null && Number.isFinite(Number(SAVE.profile.bestSurvivalKills));
  const prevBestKills = hadBestKillsBefore ? Math.max(0, Math.floor(Number(SAVE.profile.bestSurvivalKills || 0))) : 0;
  let newRecord = false;
  if (run.mode === MODE.SURVIVAL) {
    if (!hadBestKillsBefore) {
      SAVE.profile.bestSurvivalKills = currentRunKills;
    } else if (currentRunKills > 0 && currentRunKills > prevBestKills) {
      SAVE.profile.bestSurvivalKills = currentRunKills;
      newRecord = true;
    }
  }
  const bestKillsForUi = Math.max(0, Math.floor(Number(SAVE.profile.bestSurvivalKills || 0)));

  applyMissionProgress({ kills: run.kills || 0, seconds: runSeconds, wave: entry.wave });
  claimReadyMissions();

  if (keepRewards) {
    if (unlockNextMission) {
      SAVE.profile.campaignUnlocked = Math.max(SAVE.profile.campaignUnlocked, run.campaign.missionId + 1);
    }
    SAVE.profile.credits += credits;
    SAVE.profile.crystals += crystals;
    SAVE.profile.crystalsShadow = Math.max(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
    SAVE.profile.xp += xp;
    SAVE.profile.totalCrystalsEarned = Number(SAVE.profile.totalCrystalsEarned || 0) + Number(crystals || 0);
    SAVE.profile.totalXpEarned = Number(SAVE.profile.totalXpEarned || 0) + Number(xp || 0);
    SAVE.profile.gamesPlayed = Number(SAVE.profile.gamesPlayed || 0) + 1;
    SAVE.profile.totalKills = Number(SAVE.profile.totalKills || 0) + Number(run.kills || 0);
    SAVE.profile.totalCreditsEarned = Number(SAVE.profile.totalCreditsEarned || 0) + Number(credits || 0);
    SAVE.profile.totalRunSeconds = Number(SAVE.profile.totalRunSeconds || 0) + runSeconds;
    if (run.mode === MODE.SURVIVAL) SAVE.profile.gamesSurvival = Number(SAVE.profile.gamesSurvival || 0) + 1;
    if (run.mode === MODE.CAMPAIGN) {
      SAVE.profile.gamesCampaign = Number(SAVE.profile.gamesCampaign || 0) + 1;
      if (reason === "campaign_complete") SAVE.profile.campaignWins = Number(SAVE.profile.campaignWins || 0) + 1;
    }
    if (run.mode === MODE.DUEL && run.duel && run.duel.kind === "online") {
      SAVE.profile.onlineGames = Number(SAVE.profile.onlineGames || 0) + 1;
      if (reason === "duel_win") SAVE.profile.onlineWins = Number(SAVE.profile.onlineWins || 0) + 1;
      if (reason === "duel_loss") SAVE.profile.onlineLosses = Number(SAVE.profile.onlineLosses || 0) + 1;
    }
    const isWin = reason === "campaign_complete" || reason === "duel_win";
    if (isWin) {
      SAVE.profile.totalWins = Number(SAVE.profile.totalWins || 0) + 1;
    } else {
      SAVE.profile.totalLosses = Number(SAVE.profile.totalLosses || 0) + 1;
      if (reason === "dead" || reason === "duel_loss") {
        SAVE.profile.totalDeaths = Number(SAVE.profile.totalDeaths || 0) + 1;
      }
    }

    SAVE.leaderboard.unshift(entry);
    SAVE.leaderboard = SAVE.leaderboard.sort((a, b) => b.score - a.score).slice(0, 15);
    SESSION.creditsEarned += credits;
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    evaluateAchievements("run_end");
    updateTopBar();

    if (CLOUD.enabled && CLOUD.user) {
      cloudPush().catch((err) => console.warn("[CLOUD] save failed", err));
      cloudUpdatePlayerRanking(entry, reason).catch((err) => console.warn("[CLOUD] ranking update failed", err));
    }
  }

  finalScoreEl.textContent = entry.score;
  finalWaveEl.textContent = entry.wave;
  finalKillsEl.textContent = currentRunKills;
  finalBestKillsEl.textContent = bestKillsForUi;
  finalRewardsEl.textContent = keepRewards
    ? `${credits} credits, ${crystals} crystals, ${xp} xp`
    : `${credits} credits, ${crystals} crystals, ${xp} xp`;

  newRecordBadgeEl.classList.toggle("hidden", !newRecord);

  gameoverSubEl.textContent = "";
  if (reason === "campaign_complete") {
    const nextId = (run.campaign && run.campaign.missionId ? run.campaign.missionId : 1) + 1;
    gameoverTitleEl.textContent = "You Win!";
    gameoverSubEl.textContent = `Mission complete. Next mission unlocked: M${nextId}`;
  } else if (reason === "duel_win") {
    gameoverTitleEl.textContent = "Victory!";
    gameoverSubEl.textContent = "Opponent hull reached 0.";
  } else if (reason === "duel_loss") {
    gameoverTitleEl.textContent = "You Lost";
    gameoverSubEl.textContent = "Opponent destroyed your ship first.";
  } else {
    gameoverTitleEl.textContent = "Signal Lost";
  }

  trackEvent("match_end", {
    mode: run.mode,
    reason,
    score: Number(entry.score || 0),
    wave: Number(entry.wave || 0),
    kills: Number(currentRunKills || 0),
    rewards_saved: keepRewards ? 1 : 0,
    farm_multiplier: Number(farmMult.toFixed(3)),
  });

  saveNow();
  setState(STATE.OVER);
  renderAdReward(reason);
}

async function tryRewardedPlacement({ placement, cfg, buttonEl, textEl, markClaimed = false, onGranted = null }) {
  if (ADS_DISABLED) return false;
  const status = adRewardStatus();
  if (status.remaining <= 0) {
    console.info("rewarded_dailycap_blocked", { placement, cap: ADS.dailyCap });
    trackEvent("rewarded_dailycap_blocked", { placement, cap: ADS.dailyCap });
    if (textEl) textEl.textContent = `Daily reward limit reached (${ADS.dailyCap}/${ADS.dailyCap}).`;
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Daily Cap";
    }
    return false;
  }
  if (status.sessionRemaining <= 0) {
    if (textEl) textEl.textContent = `Session cap reached (${ADS.sessionCap}/${ADS.sessionCap}).`;
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Session Cap";
    }
    return false;
  }
  if (status.waitMs > 0) {
    console.info("rewarded_cooldown_blocked", { placement, wait_ms: status.waitMs });
    trackEvent("rewarded_cooldown_blocked", { placement, wait_ms: status.waitMs });
    if (textEl) textEl.textContent = `Next reward available in ${formatCooldown(status.waitMs)}.`;
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Cooldown";
    }
    return false;
  }
  if (adIntegrityBlocked()) {
    if (textEl) textEl.textContent = "Rewarded ads are temporarily blocked due to clock mismatch.";
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Blocked";
    }
    return false;
  }

  const tokenResult = await requestRewardClaimToken(placement, cfg);
  if (!tokenResult.ok) {
    LOG.warn("reward_claim_token_failed", { placement, reason: tokenResult.reason });
  }

  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = "Starting Ad...";
  }

  const adStartedAt = Date.now();
  const adResult = await requestRewardedAdCompletion(placement, (remaining) => {
    if (buttonEl) buttonEl.textContent = `Ad: ${remaining}s`;
  });
  const awayMs = Math.max(0, Math.floor(Number((adResult && adResult.awayMs) || (Date.now() - adStartedAt))));
  const minAwaySec = Math.ceil(AD_CONTINUE_MIN_AWAY_MS / 1000);
  if (!adResult || !adResult.completed) {
    const reason = String((adResult && adResult.reason) || "");
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = "Watch Ad";
    }
    if (reason === "returned_too_fast" || reason === "no_background_transition" || reason === "short_watch") {
      if (textEl) textEl.textContent = `Stay on ad page for at least ${minAwaySec}s, then come back.`;
      showToast(`Ad too short. Watch at least ${minAwaySec}s.`);
      return false;
    }
    if (reason === "popup_blocked" || reason === "open_not_detected") {
      if (textEl) textEl.textContent = "Ad popup was blocked. Allow popups and try again.";
      showToast("Allow popups for this site.");
      return false;
    }
    if (textEl) textEl.textContent = "Ad not completed. Try again.";
    showToast("Ad not completed. Try again.");
    return false;
  }
  if (awayMs < AD_CONTINUE_MIN_AWAY_MS) {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = "Watch Ad";
    }
    if (textEl) textEl.textContent = `Stay on ad page for at least ${minAwaySec}s, then come back.`;
    showToast(`Ad too short. Watch at least ${minAwaySec}s.`);
    return false;
  }

  if (!consumeAdRewardSlot()) {
    if (textEl) textEl.textContent = "Reward slot unavailable. Try again later.";
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Unavailable";
    }
    return false;
  }

  let rewardCfg = { ...(cfg || {}) };
  if (tokenResult.ok && tokenResult.token) {
    ensureAdServerDay();
    const claimResult = await claimRewardServer(tokenResult.token, placement, cfg, awayMs);
    if (!claimResult.ok) {
      LOG.warn("reward_claim_server_failed", { placement, reason: claimResult.reason, status: claimResult.status || 0 });
      if (claimResult.status === 429 || claimResult.status === 403) {
        if (textEl) textEl.textContent = "Reward blocked by integrity checks.";
        if (buttonEl) {
          buttonEl.disabled = true;
          buttonEl.textContent = "Blocked";
        }
        return false;
      }
    } else if (claimResult.data && claimResult.data.reward) {
      rewardCfg = {
        ...rewardCfg,
        ...claimResult.data.reward,
      };
      SAVE.profile.adServerClaims = Number(SAVE.profile.adServerClaims || 0) + 1;
    }
  }

  const rewardCredits = Math.max(0, Math.floor(Number(rewardCfg && rewardCfg.credits || 0)));
  const rewardCrystals = Math.max(0, Math.floor(Number(rewardCfg && rewardCfg.crystals || 0)));
  const rewardXp = Math.max(0, Math.floor(Number(rewardCfg && rewardCfg.xp || 0)));
  const hasRewardPayload = rewardCredits > 0 || rewardCrystals > 0 || rewardXp > 0;
  const granted = hasRewardPayload
    ? grantAdReward({ credits: rewardCredits, crystals: rewardCrystals, xp: rewardXp }, placement)
    : { ok: true, summary: "continue granted" };
  if (!granted || !granted.ok) return false;
  if (typeof onGranted === "function") {
    const ok = await onGranted();
    if (ok === false) return false;
  }
  if (markClaimed) run.adRewardClaimed = true;
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = "Reward Granted";
  }
  if (textEl) {
    const next = adRewardStatus();
    textEl.textContent = hasRewardPayload
      ? `Reward granted: ${granted.summary}. ${next.remaining}/${ADS.dailyCap} remaining today.`
      : `Continue granted. ${next.remaining}/${ADS.dailyCap} remaining today.`;
  }
  if (hasRewardPayload) showToast(`Reward granted: ${granted.summary}`);
  return true;
}

function renderAdReward(reason) {
  if (!adRewardBoxEl || !adRewardBtn || !adRewardTextEl) return;
  if (ADS_DISABLED) {
    adRewardBoxEl.classList.add("hidden");
    return;
  }
  const modeKey = run.mode === MODE.SURVIVAL ? "survival" : run.mode === MODE.CAMPAIGN ? "campaign" : "duel";
  const cfg = AD_REWARDS[modeKey];
  const status = adRewardStatus();
  const canContinue =
    reason === "dead" &&
    run.mode !== MODE.DUEL &&
    Boolean(run.canAdContinue) &&
    !Boolean(run.continueUsed) &&
    hasRewardedAdapter();

  adRewardBoxEl.classList.remove("hidden");
  adRewardBtn.onclick = null;
  adRewardBtn.disabled = true;
  adRewardBtn.textContent = "Watch Ad";
  adRewardTextEl.textContent = `Watch an optional ad for +${cfg.credits} credits, +${cfg.crystals} crystals, +${cfg.xp} xp.`;

  if (canContinue) {
    adRewardBtn.disabled = false;
    adRewardBtn.textContent = "Watch Ad → Continue";
    adRewardTextEl.textContent = "Watch a rewarded ad to continue this run once.";
    adRewardBtn.onclick = async () => {
      const ok = await tryRewardedPlacement({
        placement: `${modeKey}_continue`,
        cfg: { credits: 0, crystals: 0, xp: 0 },
        buttonEl: adRewardBtn,
        textEl: adRewardTextEl,
        markClaimed: false,
        onGranted: () => reviveRunAfterAd(),
      });
      if (!ok) return;
    };
    return;
  }

  if (run.adRewardClaimed) {
    adRewardBtn.disabled = true;
    adRewardBtn.textContent = "Claimed";
    return;
  }
  if (!hasRewardedAdapter()) {
    adRewardTextEl.textContent = "Rewarded ads are currently unavailable.";
    return;
  }
  if (status.remaining <= 0) {
    adRewardTextEl.textContent = `Daily reward limit reached (${ADS.dailyCap}/${ADS.dailyCap}). Try again tomorrow.`;
    return;
  }
  if (status.sessionRemaining <= 0) {
    adRewardTextEl.textContent = `Session cap reached (${ADS.sessionCap}/${ADS.sessionCap}).`;
    return;
  }
  if (status.waitMs > 0) {
    adRewardTextEl.textContent = `Next reward available in ${formatCooldown(status.waitMs)}.`;
    adRewardBtn.textContent = "Cooldown";
    return;
  }

  adRewardBtn.disabled = false;
  adRewardBtn.textContent = "Watch Ad";
  adRewardTextEl.textContent =
    `Watch an optional ad for +${cfg.credits} credits, +${cfg.crystals} crystals, +${cfg.xp} xp.` +
    ` ${status.remaining}/${ADS.dailyCap} daily, ${status.sessionRemaining}/${ADS.sessionCap} session left.`;
  console.info("rewarded_shown", { placement: modeKey, reason });
  trackEvent("rewarded_shown", { placement: modeKey, reason });

  adRewardBtn.onclick = async () => {
    const ok = await tryRewardedPlacement({
      placement: modeKey,
      cfg,
      buttonEl: adRewardBtn,
      textEl: adRewardTextEl,
      markClaimed: true,
    });
    if (!ok) return;
  };
}

function reviveRunAfterAd() {
  if (run.continueUsed) return false;
  run.continueUsed = true;
  run.active = true;
  player.alive = true;
  player.hull = Math.max(player.hull, Math.floor(player.hullMax * 0.45));
  player.shield = Math.max(player.shield, Math.floor(player.shieldMax * 0.38));
  player.invulnerableUntil = run.time + 1.5;
  run.hitFlash = 0;
  if (pauseOverlayEl) pauseOverlayEl.classList.add("hidden");
  showToast("Run continued.");
  setState(STATE.RUN);
  return true;
}

function grantAdReward(cfg, placement = "unknown") {
  if (!cfg) return { ok: false, credits: 0, crystals: 0, xp: 0, summary: "no reward" };
  const credits = Math.max(0, Math.floor(Number(cfg.credits || 0)));
  const crystals = Math.max(0, Math.floor(Number(cfg.crystals || 0)));
  const xp = Math.max(0, Math.floor(Number(cfg.xp || 0)));
  if (credits <= 0 && crystals <= 0 && xp <= 0) {
    return { ok: false, credits, crystals, xp, summary: "no reward" };
  }
  SAVE.profile.credits += credits;
  SAVE.profile.crystals += crystals;
  SAVE.profile.crystalsShadow = Math.max(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
  SAVE.profile.xp += xp;
  SAVE.profile.totalCreditsEarned = Number(SAVE.profile.totalCreditsEarned || 0) + credits;
  SAVE.profile.totalCrystalsEarned = Number(SAVE.profile.totalCrystalsEarned || 0) + crystals;
  SAVE.profile.totalXpEarned = Number(SAVE.profile.totalXpEarned || 0) + xp;
  appendAdRewardHistoryEntry({ placement, credits, crystals, xp });
  reconcileAdRewardLedgerIntegrity();
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  updateTopBar();
  renderMissionBoard();
  evaluateAchievements("ad_reward");
  if (CLOUD.enabled && CLOUD.user) cloudPush().catch(() => {});
  const parts = [];
  if (credits > 0) parts.push(`+${credits} credits`);
  if (crystals > 0) parts.push(`+${crystals} crystals`);
  if (xp > 0) parts.push(`+${xp} xp`);
  return {
    ok: true,
    credits,
    crystals,
    xp,
    summary: parts.join(", "),
  };
}

function restartActiveRun() {
  if (activeMode === MODE.CAMPAIGN) {
    startRun(MODE.CAMPAIGN, { missionId: activeCampaignMissionId || SAVE.profile.campaignUnlocked });
    return;
  }
  startRun(activeMode);
}

function maybeStartPendingAfterRotate() {
  if (!pendingStart) return;
  const { mode, options } = pendingStart;
  pendingStart = null;
  startRun(mode, options);
}

function guardStartRun(mode, options) {
  void mode;
  void options;
  return true;
}

function startRun(mode, options = {}) {
  if (!guardStartRun(mode, options)) return;
  showFullscreenHint();
  activeMode = mode;
  run.adRewardClaimed = false;
  trackEvent("match_start", {
    mode,
    mission_id: Number.isFinite(Number(options.missionId)) ? Number(options.missionId) : null,
  });

  // If a user selected a locked ship, fall back to Scout.
  const selected = shipById(SAVE.profile.selectedShipId);
  const selectedState = ensureShipState(selected.id);
  if (!selectedState.owned) {
    SAVE.profile.selectedShipId = "scout";
    SAVE.profile.updatedAt = nowMs();
    saveNow();
  }

  resetRun(mode);
  run.active = true;

  if (mode === MODE.DUEL) {
    run.mode = MODE.DUEL;
    run.wave = 1;
    run.waveRemaining = 1;
    const kind = options.duelKind === "online" ? "online" : "ai";
    run.duel.kind = kind;
    if (kind === "online") {
      run.duel.roomCode = ONLINE_SESSION.roomCode || "";
      run.duel.role = ONLINE_SESSION.role || "";
      run.duel.opponentRole = ONLINE_SESSION.opponentRole || "";
      run.duel.localLabel = onlineSelfIdentity().name || "You";
      run.duel.opponentLabel = "Opponent";
      // Spawn opponent near the top of the arena. We'll update its position from RTDB each frame.
      spawnPvpEnemyAt(WORLD.width / 2, 90);
    } else {
      spawnEnemy("duelist");
    }
  } else if (mode === MODE.CAMPAIGN) {
    const missionId = Number.isFinite(options.missionId) ? options.missionId : (SAVE.profile.campaignUnlocked || 1);
    activeCampaignMissionId = missionId;
    run.campaign.missionId = missionId;

    // Use wave as an internal difficulty scaler for enemy HP/speed.
    run.wave = Math.max(1, missionId * 2);
    run.waveRemaining = 999999;

    setupCampaignMission(missionId);
  } else {
    activeCampaignMissionId = null;
  }

  updateTopBar();
  updateHud();
  setState(STATE.RUN);
  updateTouchControlsVisibility();
  void ensureGame3DShip();
}

// Update
function updateHud() {
  scoreEl.textContent = Math.floor(run.score);
  if (run.mode === MODE.CAMPAIGN) {
    waveEl.textContent = `M${run.campaign.missionId}`;
  } else if (run.mode === MODE.DUEL) {
    waveEl.textContent = "DUEL";
  } else {
    waveEl.textContent = run.wave;
  }
  comboEl.textContent = `x${run.combo}`;

  if (run.mode === MODE.CAMPAIGN) {
    objectiveEl.textContent = campaignObjectiveStatusText();
  } else if (run.mode === MODE.DUEL) {
    if (run.duel && run.duel.kind === "online") {
      const opp = entities.enemies.find((e) => e.type === "pvp");
      const hp = opp ? `${Math.max(0, Math.ceil(opp.hp))}/${Math.ceil(opp.maxHp)}` : "-";
      objectiveEl.textContent = `Win: reduce opponent HP to 0 (${hp})`;
    } else {
      const duelist = entities.enemies.find((e) => e.type === "duelist");
      const hp = duelist ? `${Math.max(0, Math.ceil(duelist.hp))}/${Math.ceil(duelist.maxHp)}` : "-";
      objectiveEl.textContent = `Win: reduce duelist HP to 0 (${hp})`;
    }
  } else {
    let nextBoss = `Next boss: W${Math.ceil(run.wave / 4) * 4}`;
    if (run.bossAlive) {
      const boss = entities.enemies.find((enemy) => enemy.type === "boss");
      if (boss) {
        const label = boss.bossVariant === "carrier" ? "Carrier Boss" : "Sentinel Boss";
        nextBoss = `${label} · Phase ${boss.phaseIndex || 1}`;
      } else {
        nextBoss = "Boss fight!";
      }
    }
    objectiveEl.textContent = `Survive - ${nextBoss}`;
  }

  const shieldPct = player.shieldMax > 0 ? player.shield / player.shieldMax : 0;
  const hullPct = player.hullMax > 0 ? player.hull / player.hullMax : 0;
  shieldBarEl.style.width = `${Math.floor(clamp(shieldPct, 0, 1) * 100)}%`;
  hullBarEl.style.width = `${Math.floor(clamp(hullPct, 0, 1) * 100)}%`;
  updateAbilityHud();
}

function updatePlayer(dt) {
  const overdriveActive = run.ability && run.ability.key === "overdrive" && run.time < Number(run.ability.activeUntil || 0);
  const fireRateNow = Math.max(0.04, player.fireRate * (overdriveActive ? 0.64 : 1));
  const abilityDamageMult = overdriveActive ? 1.2 : 1;

  const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const targetVx = ax * player.speed;
  const targetVy = ay * player.speed;
  player.vx += (targetVx - player.vx) * 9 * dt;
  player.vy += (targetVy - player.vy) * 9 * dt;

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const bound = player.radius + PLAYER_BOUND_PAD;
  player.x = clamp(player.x, bound, WORLD.width - bound);
  player.y = clamp(player.y, bound, WORLD.height - bound);

  let stickyTarget = null;
  if (stickyLockEnabled()) {
    stickyTarget = findAimTargetById(run.aim.targetId);
    if (stickyTarget) {
      const dist = Math.hypot(Number(stickyTarget.x || 0) - player.x, Number(stickyTarget.y || 0) - player.y);
      const outOfRange = dist > stickyMaxRangeForMode();
      const expired = run.time > run.aim.lockUntil;
      if (outOfRange || expired) {
        stickyTarget = null;
        clearAimTarget();
      }
    } else if (run.aim.targetId) {
      clearAimTarget();
    }

    if (!stickyTarget && isAutoRelockActive()) {
      const aimDir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
      const next = AIM_TARGETING.findNextTarget(
        validAimEnemies(),
        { x: player.x, y: player.y },
        aimDir,
        AIM_TUNING.autoConeAngle,
        stickyMaxRangeForMode()
      );
      if (next && setAimTarget(next, { markSelected: false, refreshSticky: true })) {
        stickyTarget = next;
      }
    }
  } else if (run.aim.targetId) {
    clearAimTarget();
  }

  if (stickyTarget && stickyLockEnabled()) {
    input.mouseX = Number(stickyTarget.x || input.mouseX);
    input.mouseY = Number(stickyTarget.y || input.mouseY);
    player.angle = AIM_TARGETING.updateAimTowardsTarget(
      { x: player.x, y: player.y, angle: player.angle },
      { x: input.mouseX, y: input.mouseY },
      smoothAimFactor(dt)
    );
  } else {
    const dx = input.mouseX - player.x;
    const dy = input.mouseY - player.y;
    player.angle = Math.atan2(dy, dx);
  }

  if (player.alive) {
    player.shield = Math.min(player.shieldMax, player.shield + player.shieldRegen * dt);
  }

  player.hitCooldown = Math.max(0, (player.hitCooldown || 0) - dt);

  player.fireTimer -= dt;
  if (input.shooting && player.fireTimer <= 0 && player.alive) {
    player.fireTimer = fireRateNow;
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    const baseX = player.x + dirX * 22;
    const baseY = player.y + dirY * 22;

    // Simple spread upgrade (runUpgrades.spread)
    const spreadLevel = run.runUpgrades.spread || 0;
    const shots = 1 + spreadLevel * 2;
    const spread = 0.14;
    const assistDamageMult = isAutoRelockActive() ? AIM_TUNING.autoDamagePenalty : 1;

    SAVE.profile.totalShotsFired = Number(SAVE.profile.totalShotsFired || 0) + shots;
    if (run.mode === MODE.CAMPAIGN) run.campaign.shotsFired += shots;

    for (let i = 0; i < shots; i += 1) {
      const t = shots === 1 ? 0 : (i / (shots - 1)) * 2 - 1;
      const a = player.angle + t * spread;
      const crit = Math.random() < Math.max(0, Number(player.critChance || 0));
      const b = {
        x: baseX,
        y: baseY,
        vx: Math.cos(a) * player.bulletSpeed,
        vy: Math.sin(a) * player.bulletSpeed,
        team: "player",
        damage: player.damage * assistDamageMult * abilityDamageMult * (crit ? 1.65 : 1),
        pierce: player.pierce,
        kind: crit ? "crit" : "normal",
      };
      spawnBullet(b);
      onlineDuelMaybeSendBullet(b);
    }

    playShootSfx();
    run.shake = Math.min(10, run.shake + 0.35);
  }
}

function updateDrones(dt) {
  const drones = entities.drones;
  if (drones.length === 0) return;

  drones.forEach((d, idx) => {
    const orbit = idx / drones.length;
    d.angle += dt * (1.2 + idx * 0.1);
    const r = 42;
    d.x = lerp(d.x, player.x + Math.cos(d.angle + orbit * TAU) * r, 8 * dt);
    d.y = lerp(d.y, player.y + Math.sin(d.angle + orbit * TAU) * r, 8 * dt);

    d.fire -= dt;
    const target = entities.enemies[0];
    if (target && d.fire <= 0) {
      d.fire = Math.max(0.18, player.fireRate * 1.35);
      const dx = target.x - d.x;
      const dy = target.y - d.y;
      const len = Math.hypot(dx, dy) || 1;
      spawnBullet({
        x: d.x,
        y: d.y,
        vx: (dx / len) * (player.bulletSpeed * 0.85),
        vy: (dy / len) * (player.bulletSpeed * 0.85),
        team: "player",
        damage: player.damage * 0.55,
        pierce: 0,
      });
      onlineDuelMaybeSendBullet({
        x: d.x,
        y: d.y,
        vx: (dx / len) * (player.bulletSpeed * 0.85),
        vy: (dy / len) * (player.bulletSpeed * 0.85),
        team: "player",
        damage: player.damage * 0.55,
        pierce: 0,
      });
    }
  });
}

function updateEnemies(dt) {
  const adaptive = adaptiveDifficultyScalar();
  if (run.mode === MODE.DUEL) {
    // Duel: the duelist is spawned at start; no extra spawns.
  } else if (run.mode === MODE.CAMPAIGN) {
    const mission = getCampaignMission(run.campaign.missionId);

    // Spawn regular enemies
    const ramp = Math.floor(run.time / 36);
    const desired = Math.max(3, Math.floor((mission.spawns.desired || 4) * adaptive) + ramp);
    const nonBossCount = entities.enemies.filter((e) => e.type !== "boss").length;
    if (!run.bossAlive && nonBossCount < desired) {
      const basePool = mission.spawns.pool || ["drone"];
      const pool = run.time > 120 ? [...basePool, "lancer", "leech"] : basePool;
      spawnEnemy(pool[Math.floor(Math.random() * pool.length)]);
    }

    // Spawn boss(es) if the mission requires them
    const bossCount = mission.spawns.bossCount || 0;
    const bossAt = mission.spawns.bossAt || 9999;
    const bossEvery = mission.spawns.bossEvery || 30;
    if (bossCount > 0 && !run.bossAlive && run.campaign.bossesKilled < bossCount) {
      const threshold = bossAt + run.campaign.bossesKilled * bossEvery;
      if (run.time >= threshold) {
        run.bossAlive = true;
        spawnEnemy("boss");
      }
    }
  } else {
    // Survival spawner
    const desired = Math.max(3, Math.floor((run.wave < 6 ? 2.6 : 3.2) + run.wave * (run.wave < 10 ? 0.55 : 0.72) * adaptive));
    if (!run.bossAlive && entities.enemies.length < desired) {
      const roll = Math.random();
      let type = "drone";
      if (run.wave >= 3 && roll > 0.58) type = "fighter";
      if (run.wave >= 6 && roll > 0.75) type = "sniper";
      if (run.wave >= 8 && roll > 0.84) type = "rammer";
      if (run.wave >= 10 && roll > 0.88) type = "lancer";
      if (run.wave >= 13 && roll > 0.91) type = "bulwark";
      if (run.wave >= 16 && roll > 0.93) type = "leech";
      spawnEnemy(type);
    }
  }

  entities.enemies.forEach((e) => {
    if (e.type === "pvp") {
      // Online duel opponent is driven by realtime state.
      return;
    }
    const type = ENEMY_TYPES[e.type];
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    let tx = dx / dist;
    let ty = dy / dist;

    if (type.shoot && e.type !== "boss" && e.type !== "duelist") {
      const desiredDist = 200;
      const push = (dist - desiredDist) * 0.006;
      const strafe = e.elite ? 0.95 : 0.6;
      tx = (dx / dist) * push + (-dy / dist) * e.orbit * strafe;
      ty = (dy / dist) * push + (dx / dist) * e.orbit * strafe;
      if (e.elite) {
        tx += Math.sin(run.time * 2 + e.phase) * 0.16;
        ty += Math.cos(run.time * 1.7 + e.phase) * 0.16;
      }
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
    }

    if (e.type === "lancer") {
      e.chargeAt = Number(e.chargeAt || 0) - dt;
      if (dist < 320 && e.chargeAt <= 0) {
        e.chargeAt = 2.3 + Math.random() * 1.2;
        const dash = 240 + run.wave * 3;
        e.vx = (dx / dist) * dash;
        e.vy = (dy / dist) * dash;
        burst(e.x, e.y, "#b4f7ff", 10, 0.8);
      }
    }

    if (e.type === "bulwark") {
      tx *= 0.55;
      ty *= 0.55;
    }

    if (e.type === "rammer" && dist < 280) {
      tx = dx / dist;
      ty = dy / dist;
      e.speed += 28 * dt;
    }

    if (Array.isArray(e.modifiers) && e.modifiers.includes("leech")) {
      tx += Math.sin(run.time * 2.7 + e.phase) * 0.08;
      ty += Math.cos(run.time * 2.1 + e.phase) * 0.08;
    }

    e.vx += (tx * e.speed - e.vx) * 4.5 * dt;
    e.vy += (ty * e.speed - e.vy) * 4.5 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    if (e.type === "boss") {
      const hpRatio = e.maxHp > 0 ? e.hp / e.maxHp : 0;
      const phaseIndex = hpRatio > 0.66 ? 1 : hpRatio > 0.33 ? 2 : 3;
      if (phaseIndex !== e.phaseIndex) {
        e.phaseIndex = phaseIndex;
        burst(e.x, e.y, "#9ae9ff", 28, 1.1);
      }
      if (e.bossVariant === "carrier" && Math.random() < dt * (0.38 + phaseIndex * 0.16)) {
        entities.mines.push({
          x: e.x + rand(-30, 30),
          y: e.y + rand(-20, 20),
          life: 8 + phaseIndex,
          r: 16 + phaseIndex * 2,
          pulse: Math.random() * TAU,
        });
      }
    }

    // Shooting
    if (type.shoot) {
      e.fire -= dt;
      const phaseFactor = e.type === "boss" ? Math.max(0.7, 1 - (e.phaseIndex - 1) * 0.14) : 1;
      const fireRate = (type.fireRate ? type.fireRate(run.wave) : 1.1) * phaseFactor;
      if (e.fire <= 0 && dist < 520) {
        e.fire = fireRate;
        const bx = (dx / dist) * type.bulletSpeed;
        const by = (dy / dist) * type.bulletSpeed;
        const dmgScale = run.mode === MODE.DUEL ? 1 : 1 + Math.min(1.05, run.wave * 0.026 * adaptive);
        spawnBullet({
          x: e.x,
          y: e.y,
          vx: bx,
          vy: by,
          team: "enemy",
          damage: (type.damage || 10) * dmgScale,
          pierce: 0,
          sourceId: e.id,
        });
      }

      if (e.type === "boss" && Math.random() < dt * (0.48 + e.phaseIndex * 0.22)) {
        const a0 = Math.atan2(dy, dx);
        const dmgScale = run.mode === MODE.DUEL ? 1 : 1 + Math.min(1.05, run.wave * 0.025 * adaptive);
        if (e.bossVariant === "carrier") {
          const rays = e.phaseIndex >= 3 ? 8 : 6;
          for (let i = 0; i < rays; i += 1) {
            const a = a0 + (i / rays) * TAU;
            spawnBullet({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * (220 + e.phaseIndex * 18),
              vy: Math.sin(a) * (220 + e.phaseIndex * 18),
              team: "enemy",
              damage: (9 + e.phaseIndex * 1.7) * dmgScale,
              pierce: 0,
              sourceId: e.id,
            });
          }
        } else {
          const spread = e.phaseIndex >= 3 ? 0.34 : 0.22;
          for (let k = -1; k <= 1; k += 1) {
            const a = a0 + k * spread;
            spawnBullet({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * (235 + e.phaseIndex * 12),
              vy: Math.sin(a) * (235 + e.phaseIndex * 12),
              team: "enemy",
              damage: (11 + e.phaseIndex * 2.2) * dmgScale,
              pierce: 0,
              sourceId: e.id,
            });
          }
        }
      }
    }
  });

  // Contact damage: any enemy that reaches you can hurt you (even non-shooters).
  // This makes drones/rammers dangerous and prevents "free score" farming.
  if (player.alive) {
    for (const e of entities.enemies) {
      if (e.hp <= 0) continue;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const hitDist = player.radius + e.size * 0.85;
      if (dist > hitDist) continue;
      if ((player.hitCooldown || 0) > 0) continue;

      // Base contact damage by enemy type, scaled by difficulty.
      let base = 12;
      if (e.type === "drone") base = 10;
      if (e.type === "fighter") base = 12;
      if (e.type === "sniper") base = 13;
      if (e.type === "rammer") base = 18;
      if (e.type === "lancer") base = 16;
      if (e.type === "bulwark") base = 20;
      if (e.type === "leech") base = 14;
      if (e.type === "boss") base = 28;
      if (e.type === "duelist") base = 16;
      if (e.type === "pvp") base = 16;

      const scaler = run.mode === MODE.DUEL ? 1 : 1 + Math.min(1.05, run.wave * 0.034 * adaptive);
      const eliteHitMult = e.elite ? 1.25 : 1;
      const modifierMult = Array.isArray(e.modifiers) && e.modifiers.includes("fast") ? 1.06 : 1;
      const dmg = Math.round(base * scaler * eliteHitMult * modifierMult);

      // Knock the player away a bit so we don't "stick" inside hitboxes.
      const kx = dx / dist;
      const ky = dy / dist;
      const bound = player.radius + PLAYER_BOUND_PAD;
      player.x = clamp(player.x + kx * 22, bound, WORLD.width - bound);
      player.y = clamp(player.y + ky * 22, bound, WORLD.height - bound);

      takeDamage(dmg);
      if (Array.isArray(e.modifiers) && e.modifiers.includes("leech")) {
        e.hp = Math.min(e.maxHp, e.hp + Math.max(3, dmg * 0.28));
      }
      player.hitCooldown = 0.35;

      // Rammers self-destruct on impact (kamikaze).
      if (e.type === "rammer") {
        e.hp = 0;
        killEnemy(e);
      }

      // Only one contact hit per frame.
      break;
    }
  }
}

function updatePickups(dt) {
  entities.pickups.forEach((p) => {
    p.t += dt * 5;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
  });
  entities.pickups = entities.pickups.filter((p) => p.life > 0);

  for (const p of entities.pickups) {
    const dx = p.x - player.x;
    const dy = p.y - player.y;
    if (Math.hypot(dx, dy) < 28) {
      p.life = 0;
      openUpgradePick();
      break;
    }
  }
}

function updateBullets(dt) {
  entities.bullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  });

  for (const b of entities.bullets) {
    if (b.life <= 0) continue;

    if (b.team === "player") {
      for (const e of entities.enemies) {
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (Math.hypot(dx, dy) < e.size + 6) {
          const armored = Array.isArray(e.modifiers) && e.modifiers.includes("armored");
          const finalDamage = b.damage * (armored ? 0.72 : 1);
          e.hp -= finalDamage;
          run.score += 6;
          run.combo = Math.min(10, run.combo + 1);
          run.comboTimer = 1.2;
          spawnDamageText(e.x + rand(-5, 5), e.y - e.size, Math.round(finalDamage), b.kind === "crit" ? "#ffd980" : "#d9f7ff");

          burst(b.x, b.y, e.color, 10);
          b.pierce -= 1;
          if (b.pierce < 0) b.life = 0;

          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
    } else if (b.team === "enemy") {
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      if (Math.hypot(dx, dy) < player.radius + 10 && player.alive) {
        takeDamage(b.damage);
        if (b.sourceId) {
          const source = entities.enemies.find((enemy) => enemy.id === b.sourceId);
          if (source && Array.isArray(source.modifiers) && source.modifiers.includes("leech")) {
            source.hp = Math.min(source.maxHp, source.hp + Math.max(2, b.damage * 0.2));
          }
        }
        b.life = 0;
      }
    }
  }

  entities.bullets = entities.bullets.filter(
    (b) => b.life > 0 && b.x > -80 && b.x < WORLD.width + 80 && b.y > -80 && b.y < WORLD.height + 80
  );
}

function updateParticles(dt) {
  entities.particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
  });
  entities.particles = entities.particles.filter((p) => p.life > 0);

  entities.damageTexts.forEach((d) => {
    d.y += Number(d.vy || -24) * dt;
    d.life -= dt;
  });
  entities.damageTexts = entities.damageTexts.filter((d) => Number(d.life || 0) > 0);
}

function updateWorld(dt) {
  run.time += dt;
  run.comboTimer -= dt;
  if (run.comboTimer <= 0) run.combo = 1;
  run.score += dt * 10 * run.combo;
  run.shake = Math.max(0, run.shake - dt * 10);
  run.hitFlash = Math.max(0, run.hitFlash - dt * 3.5);

  updateCampaignSpecials(dt);
  checkCampaignMissionComplete();
}

function updateCampaignSpecials(dt) {
  if (run.mode !== MODE.CAMPAIGN) return;

  // Beacon collection
  for (const b of entities.beacons) b.t += dt * 2.2;
  for (let i = entities.beacons.length - 1; i >= 0; i -= 1) {
    const b = entities.beacons[i];
    const dx = b.x - player.x;
    const dy = b.y - player.y;
    if (Math.hypot(dx, dy) < 26) {
      entities.beacons.splice(i, 1);
      run.campaign.beaconsCollected += 1;
      burst(b.x, b.y, "#44ffd7", 18, 1.05);
    }
  }

  // Zone control
  const z = run.campaign.zone;
  if (z) {
    z.shiftAt -= dt;
    if (z.shiftAt <= 0) {
      z.shiftAt = 3 + Math.random() * 3.5;
      z.tx = rand(200, WORLD.width - 200);
      z.ty = rand(160, WORLD.height - 160);
    }
    z.x = lerp(z.x, z.tx, clamp(dt * 0.55, 0, 1));
    z.y = lerp(z.y, z.ty, clamp(dt * 0.55, 0, 1));

    const inside = Math.hypot(player.x - z.x, player.y - z.y) <= z.r;
    if (inside) run.campaign.zoneTime += dt;
  }
}

function update(dt) {
  if (state === STATE.PICK) dt = 0;

  updatePlayer(dt);
  onlineDuelMaybeSendState();
  onlineDuelApplyOpponentState(dt);
  updateDrones(dt);
  updateAbilityEffects(dt);
  updateEnemies(dt);
  updateMines(dt);
  updatePickups(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateWorld(dt);
  updateHud();
  updateAutoLockButtonUi();
}

// Upgrades (in-run picks)
const RUN_UPGRADES = [
  { key: "overcharge", name: "Overcharge", desc: "+18% damage per level.", max: 6 },
  { key: "rapid", name: "Rapid Capacitors", desc: "Shoot faster per level.", max: 6 },
  { key: "spread", name: "Tri-Shot", desc: "Adds extra bullets per shot.", max: 3 },
  { key: "shield", name: "Shield Amplifier", desc: "+18% shield per level.", max: 5 },
  { key: "regen", name: "Nano Regen", desc: "Shield regen faster.", max: 5 },
  { key: "hull", name: "Hull Weave", desc: "+15% hull max per level.", max: 5 },
  { key: "ballistics", name: "Ballistics", desc: "Bullets fly faster.", max: 5 },
  { key: "pierce", name: "Piercing", desc: "Bullets pierce +1.", max: 2 },
  { key: "drone", name: "Drone Buddy", desc: "Add a drone.", max: 2 },
  { key: "thrusters", name: "Turbo Thrusters", desc: "Move faster.", max: 4 },
];

function randomPickOptions(count = 3) {
  const pool = RUN_UPGRADES.filter((u) => (run.runUpgrades[u.key] || 0) < u.max);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    if (pool.length === 0) break;
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function openUpgradePick() {
  const options = randomPickOptions(3);
  if (options.length === 0) return;

  pickListEl.innerHTML = "";
  options.forEach((opt) => {
    const nextLevel = (run.runUpgrades[opt.key] || 0) + 1;
    const card = document.createElement("div");
    card.className = "pickCard";
    card.innerHTML = `
      <h3>${opt.name} <span style="opacity:.7">(Lv ${nextLevel}/${opt.max})</span></h3>
      <p>${opt.desc}</p>
      <button class="btn">Take</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      run.runUpgrades[opt.key] = nextLevel;
      applyStats();
      setState(STATE.RUN);
  updateTouchControlsVisibility();
    });
    pickListEl.appendChild(card);
  });

  setState(STATE.PICK);
}

// Render
function beginFrame() {
  ctx.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
}

function drawBackground(dt) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  g.addColorStop(0, "#2d2b6f");
  g.addColorStop(0.45, "#171c45");
  g.addColorStop(1, "#0b0f1f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Stars
  stars.forEach((s) => {
    s.tw += dt * (0.8 + s.z);
    s.y += s.z * 26 * dt;
    if (s.y > WORLD.height + 10) {
      s.y = -10;
      s.x = Math.random() * WORLD.width;
    }
    const a = 0.25 + Math.sin(s.tw) * 0.2 + s.z * 0.35;
    ctx.fillStyle = `rgba(255,255,255,${clamp(a, 0.15, 0.95)})`;
    ctx.fillRect(s.x, s.y, 2 * s.z, 2 * s.z);
  });
}

function drawShip(x, y, angle, main, accent, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(64, 243, 255, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 26, 12, 0, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.lineTo(-18, -18);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-18, 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(6, -10);
  ctx.lineTo(-10, -24);
  ctx.lineTo(-8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, 10);
  ctx.lineTo(-10, 24);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(6, 0, 6, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawEnemies() {
  entities.enemies.forEach((e) => {
    if (!game3DReady) {
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      drawShip(e.x, e.y, angle, e.color, "rgba(255,255,255,0.5)", e.type === "boss" ? 1.5 : 1);
    }

    if (e.elite) {
      ctx.strokeStyle = "rgba(255, 219, 110, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size + 6, 0, TAU);
      ctx.stroke();
    }

    if (Array.isArray(e.modifiers) && e.modifiers.length) {
      const ringColor = e.modifiers.includes("volatile")
        ? "rgba(255, 148, 118, 0.85)"
        : e.modifiers.includes("armored")
        ? "rgba(166, 208, 255, 0.85)"
        : e.modifiers.includes("leech")
        ? "rgba(220, 150, 255, 0.85)"
        : "rgba(160, 255, 201, 0.82)";
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size + 10, 0, TAU);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(e.x - 26, e.y + e.size + 8, 52, 6);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(e.x - 26, e.y + e.size + 8, 52 * (e.hp / e.maxHp), 6);
  });
}

function drawPickups() {
  entities.pickups.forEach((p) => {
    const pulse = 1 + Math.sin(p.t) * 0.12;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(pulse, pulse);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255, 230, 140, 0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(64, 243, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.stroke();
    ctx.restore();
  });
}

function drawCampaignObjects() {
  if (run.mode !== MODE.CAMPAIGN) return;

  // Zone (draw first, under everything)
  const z = run.campaign.zone;
  if (z) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(68, 255, 215, 0.08)";
    ctx.strokeStyle = "rgba(68, 255, 215, 0.28)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Beacons
  entities.beacons.forEach((b) => {
    const pulse = 1 + Math.sin(b.t) * 0.15;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(pulse, pulse);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255, 209, 102, 0.95)";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(64, 243, 255, 0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.restore();
  });
}

function drawBullets() {
  const selectedState = ensureShipState(SAVE.profile.selectedShipId);
  const weaponPower = Number(selectedState.upgrades.damage || 0) + Number(selectedState.upgrades.fireRate || 0);
  const weaponTier = weaponPower >= 12 ? 3 : weaponPower >= 6 ? 2 : 1;
  ctx.globalCompositeOperation = "lighter";
  entities.bullets.forEach((b) => {
    const alpha = clamp(b.life / 1.4, 0, 1);
    ctx.fillStyle =
      b.team === "player"
        ? weaponTier === 3
          ? `rgba(255, 122, 217, ${0.75 * alpha})`
          : weaponTier === 2
          ? `rgba(115, 255, 244, ${0.7 * alpha})`
          : `rgba(64, 243, 255, ${0.65 * alpha})`
        : `rgba(255, 93, 125, ${0.7 * alpha})`;
    ctx.beginPath();
    const outer = b.team === "player" ? b.r + 2 + (weaponTier - 1) * 0.6 : b.r + 2;
    ctx.arc(b.x, b.y, outer, 0, TAU);
    ctx.fill();
    ctx.fillStyle = b.team === "player" ? `rgba(255,255,255, ${0.55 * alpha})` : `rgba(255,255,255, ${0.3 * alpha})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
  });
  ctx.globalCompositeOperation = "source-over";
}

function drawParticles() {
  ctx.globalCompositeOperation = "lighter";
  entities.particles.forEach((p) => {
    ctx.fillStyle = `rgba(255,255,255,${clamp(p.life, 0, 1)})`;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  });
  ctx.globalCompositeOperation = "source-over";
}

function drawDamageTexts() {
  if (!SAVE.profile.damageNumbersEnabled) return;
  ctx.save();
  ctx.font = "700 13px 'Orbitron', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  entities.damageTexts.forEach((d) => {
    const alpha = clamp(Number(d.life || 0) / 0.72, 0, 1);
    ctx.fillStyle = `rgba(9, 16, 35, ${alpha * 0.8})`;
    ctx.fillText(String(d.value || 0), d.x + 1, d.y + 1);
    ctx.fillStyle = d.color || `rgba(255,255,255,${alpha})`;
    ctx.fillText(String(d.value || 0), d.x, d.y);
  });
  ctx.restore();
}

function drawDrones() {
  if (game3DReady) return;
  entities.drones.forEach((d) => {
    drawShip(d.x, d.y, 0, "rgba(64,243,255,0.6)", "rgba(255,255,255,0.55)", 0.55);
  });
}

function drawMines() {
  entities.mines.forEach((mine) => {
    const pulse = 1 + Math.sin(Number(mine.pulse || 0)) * 0.12;
    ctx.save();
    ctx.translate(mine.x, mine.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "rgba(255, 143, 117, 0.32)";
    ctx.beginPath();
    ctx.arc(0, 0, mine.r || 16, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 196, 172, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, (mine.r || 16) * 0.55, 0, TAU);
    ctx.stroke();
    ctx.restore();
  });
}

function updateAbilityEffects(dt) {
  if (!run.active || !run.ability) return;

  if (run.ability.key === "fortress" && run.time < Number(run.ability.activeUntil || 0)) {
    const auraRadius = 120;
    entities.enemies.forEach((enemy) => {
      if (!enemy || Number(enemy.hp || 0) <= 0) return;
      if (enemy.type === "pvp") return;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > auraRadius) return;
      enemy.vx += (dx / dist) * dt * 260;
      enemy.vy += (dy / dist) * dt * 260;
      enemy.hp -= dt * 3.2;
      if (enemy.hp <= 0) killEnemy(enemy);
    });
  }

  if (run.ability.key === "drone_swarm") {
    entities.drones = entities.drones.filter((drone) => {
      if (!Number.isFinite(Number(drone.temporaryUntil))) return true;
      return Number(drone.temporaryUntil) > run.time;
    });
  }
}

function updateMines(dt) {
  if (!entities.mines.length) return;
  entities.mines.forEach((mine) => {
    mine.life -= dt;
    mine.pulse = Number(mine.pulse || 0) + dt * 6;
  });
  for (const mine of entities.mines) {
    const dist = Math.hypot(player.x - mine.x, player.y - mine.y);
    if (dist < (mine.r || 18) + player.radius && player.alive) {
      burst(mine.x, mine.y, "#ff8f75", 30, 1.15);
      takeDamage(16);
      mine.life = 0;
    }
  }
  entities.mines = entities.mines.filter((mine) => Number(mine.life || 0) > 0);
}

function drawPlayerShip() {
  if (run.active && game3DReady) return;
  drawFancyPlayerShip();
}

function drawOnlineDuelLabels() {
  if (!(run.active && run.mode === MODE.DUEL && run.duel && run.duel.kind === "online")) return;
  const enemy = entities.enemies.find((e) => e.type === "pvp");
  if (!enemy) return;

  const drawLabel = (x, y, text, bg, fg) => {
    if (!text) return;
    ctx.save();
    ctx.font = "700 12px 'Segoe UI', sans-serif";
    const label = String(text).slice(0, 20);
    const width = Math.ceil(ctx.measureText(label).width) + 14;
    const boxX = x - width / 2;
    const boxY = y - 38;
    ctx.fillStyle = bg;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, width, 20);
    ctx.strokeRect(boxX, boxY, width, 20);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, boxY + 10);
    ctx.restore();
  };

  drawLabel(player.x, player.y, `YOU: ${run.duel.localLabel || "Pilot"}`, "rgba(38,95,255,0.38)", "#dbeafe");
  drawLabel(enemy.x, enemy.y, `OPP: ${run.duel.opponentLabel || "Opponent"}`, "rgba(255,114,61,0.34)", "#fff7ed");
}

function render(dt) {
  beginFrame();

  ctx.save();
  if (run.active && run.shake > 0) {
    const s = run.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawBackground(dt);
  if (run.hitFlash > 0.01) {
    ctx.fillStyle = `rgba(255, 83, 102, ${Math.min(0.24, run.hitFlash * 0.28)})`;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
  drawCampaignObjects();
  drawPickups();
  drawMines();
  drawEnemies();
  drawBullets();
  drawParticles();
  drawDamageTexts();
  drawDrones();
  drawPlayerShip();
  updateGame3DFrame();
  drawOnlineDuelLabels();

  ctx.restore();
}

// Main loop
let lastTime = 0;
function gameLoop(ts) {
  if (!lastTime) lastTime = ts;
  const elapsedMs = ts - lastTime;
  const fpsLimit = shouldUseTouchControls() ? Math.max(0, Math.floor(Number(SAVE.profile.fpsLimit || 0))) : 0;
  const minFrameMs = fpsLimit > 0 ? 1000 / fpsLimit : 0;
  if (minFrameMs > 0 && elapsedMs < minFrameMs) {
    requestAnimationFrame(gameLoop);
    return;
  }
  const dt = Math.min(0.033, elapsedMs / 1000);
  lastTime = ts;

  const fps = dt > 0 ? 1 / dt : 0;
  SESSION.frameSamples.push(fps);
  if (SESSION.frameSamples.length > 24) SESSION.frameSamples.shift();
  SESSION.fps = SESSION.frameSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, SESSION.frameSamples.length);
  if (diagnosticsPanelEl) {
    const showDiag = DEV_MODE || FLAGS.isEnabled("diagnostics_v1", false);
    diagnosticsPanelEl.classList.toggle("hidden", !showDiag);
    if (showDiag) {
      diagnosticsPanelEl.innerHTML = [
        `FPS: ${Math.round(SESSION.fps || 0)}`,
        `Entities: E${entities.enemies.length} B${entities.bullets.length} P${entities.particles.length}`,
        `Mode: ${run.active ? run.mode : "menu"}`
      ].join("<br>");
    }
  }

  if (state === STATE.RUN || state === STATE.PICK) {
    if (!paused) update(dt);
  }
  updateGuestSignInReminder(elapsedMs);

  maybeStartPendingAfterRotate();
  render(dt);
  requestAnimationFrame(gameLoop);
}

// Initial UI state + background animation
let appInitialized = false;

function initializeAppState() {
  if (appInitialized) return;
  appInitialized = true;
  try {
    initAnalytics();
    cloudInit();
    updateTopBar();
    ensureMissionSet();
    renderMissionBoard();
    setState(STATE.MENU);
    updateHud();
    updateRotateOverlay();
    updateTouchControlsVisibility();
    if (!fullscreenCleanup) fullscreenCleanup = setupFullscreenToggle({ element: document.documentElement });
    setFullscreenButtonLabel();
    updateFullscreenButtonVisibility();
  } catch (err) {
    console.error("[BOOT] initializeAppState failed", err);
    showToast("Initialization issue detected. Refresh and try again.");
  }
}

if (menuFullscreenBtn) {
  menuFullscreenBtn.addEventListener("click", () => toggleFullscreen(document.documentElement));
}

function drawFancyPlayerShip() {
  if (!player.alive) return;
  const selected = shipById(SAVE.profile.selectedShipId);
  const style = SHIP_STYLES[selected.id] || { main: "#1de2c4", accent: "#0ea5e9" };
  const tier = upgradeTier(ensureShipState(selected.id).upgrades);

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  // Glow
  ctx.fillStyle = "rgba(64,243,255,0.16)";
  ctx.beginPath();
  ctx.arc(0, 0, 26 + tier * 2, 0, TAU);
  ctx.fill();

  // Hull (pseudo-3D with gradient)
  const grad = ctx.createLinearGradient(-18, -8, 18, 12);
  grad.addColorStop(0, style.main);
  grad.addColorStop(1, "#0b142c");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(22 + tier * 2, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();

  // Wings
  ctx.fillStyle = style.accent;
  ctx.beginPath();
  ctx.moveTo(2, -14 - tier);
  ctx.lineTo(-16 - tier, -20 - tier);
  ctx.lineTo(-8 - tier, -6);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(2, 14 + tier);
  ctx.lineTo(-16 - tier, 20 + tier);
  ctx.lineTo(-8 - tier, 6);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(6, 0, 4 + tier, 0, TAU);
  ctx.fill();

  // Extra fins for higher tiers
  if (tier >= 1) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(-6, -3, 10, 1.6);
    ctx.fillRect(-6, 1.4, 10, 1.6);
  }
  if (tier >= 2) {
    ctx.fillStyle = "rgba(255,122,217,0.6)";
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-26, -6);
    ctx.lineTo(-26, 6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  // Shield ring
  const s = clamp(player.shield / player.shieldMax, 0, 1);
  if (s > 0.01) {
    ctx.strokeStyle = `rgba(64,243,255, ${0.3 + 0.4 * s})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 28, 0, TAU);
    ctx.stroke();
  }

  if (run.ability && run.time < Number(run.ability.activeUntil || 0)) {
    let aura = "rgba(255, 209, 102, 0.45)";
    if (run.ability.key === "fortress") aura = "rgba(142, 255, 125, 0.44)";
    if (run.ability.key === "drone_swarm") aura = "rgba(167, 130, 255, 0.44)";
    if (run.ability.key === "overdrive") aura = "rgba(255, 174, 87, 0.44)";
    ctx.strokeStyle = aura;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 36, 0, TAU);
    ctx.stroke();
  }

  if (run.time < Number(player.invulnerableUntil || 0)) {
    ctx.strokeStyle = "rgba(126, 243, 255, 0.82)";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 34, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
if (sideFullscreenBtn) {
  sideFullscreenBtn.addEventListener("click", () => toggleFullscreen(document.documentElement));
}

document.addEventListener("fullscreenchange", () => {
  setFullscreenButtonLabel();
  if (settingsFullscreenToggleEl) settingsFullscreenToggleEl.checked = Boolean(document.fullscreenElement);
  if (state === STATE.SETTINGS) applySettingsUi();
});

if (!fullscreenKeybound) {
  fullscreenKeybound = true;
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (shouldUseTouchControls()) return;
    if (shouldIgnoreFullscreenHotkey(e.target)) return;
    if (String(e.key || "").toLowerCase() !== "f") return;
    e.preventDefault();
    toggleFullscreen(document.documentElement);
  });
}

// Handle return from checkout redirect (server redirects to /?purchase=success or cancel)
try {
  const params = new URLSearchParams(window.location.search);
  const purchase = params.get("purchase");
  if (purchase === "success") {
    // Remove query to avoid repeating on refresh.
    window.history.replaceState({}, document.title, window.location.pathname);
    cloudInit();
    if (CLOUD.enabled && CLOUD.user) {
      cloudPullMerge()
        .then(() => {
          saveNow();
          updateTopBar();
          renderHangar();
          setOnlineHint("Purchase complete. Rewards synced.");
        })
        .catch(() => {
          setOnlineHint("Purchase complete. Reopen Online to sync rewards.");
        });
    } else {
      setOnlineHint("Purchase complete. Sign in to sync rewards.");
    }
  } else if (purchase === "cancel") {
    window.history.replaceState({}, document.title, window.location.pathname);
    setOnlineHint("Purchase canceled.");
  }
} catch {
  // ignore
}

async function applyInitialRouteIntent() {
  const path = normalizePath(window.location.pathname);
  const levelFromRoute = routeCampaignLevel(path);

  if (path === "/game/survival/start") {
    startRun(MODE.SURVIVAL);
    return;
  }

  if (path === "/game/campaign") {
    renderCampaignMissions();
    setState(STATE.CAMPAIGN);
    return;
  }

  if (path === "/game/campaign/start" || levelFromRoute) {
    const missionId = levelFromRoute || Math.max(1, Number(SAVE.profile.campaignUnlocked || 1));
    startRun(MODE.CAMPAIGN, { missionId });
    return;
  }

  if (path === "/game/onlinematch" || path === "/game/onlinematch/start") {
    if (PORTAL_MODE) {
      setState(STATE.MENU);
      return;
    }
    onlineInit();
    setState(STATE.ONLINE);
    return;
  }

  if (path === "/game/hangar") {
    openHangarRoute();
    return;
  }

  if (path === "/game/leaderboard") {
    renderLeaderboard("local");
    setState(STATE.LEADERBOARD);
    return;
  }

  if (path === "/game/settings") {
    applySettingsUi();
    setState(STATE.SETTINGS);
    return;
  }

  if (path === "/game/account") {
    if (PORTAL_MODE) {
      setState(STATE.MENU);
      return;
    }
    renderAccountPanel();
    setState(STATE.ACCOUNT);
  }
}

async function runInitialRoute() {
  initializeAppState();
  try {
    await applyInitialRouteIntent();
  } catch (err) {
    console.error("[BOOT] route intent failed", err);
    setState(STATE.MENU);
  } finally {
    routeBooting = false;
    syncRouteWithState(state);
  }
}

let appBootStarted = false;
let gameLoopStarted = false;

function startGameLoop() {
  if (gameLoopStarted) return;
  gameLoopStarted = true;
  requestAnimationFrame(gameLoop);
}

function startAppBoot() {
  if (appBootStarted) return;
  appBootStarted = true;
  void runInitialRoute();
  startGameLoop();
}

function bootWithAdProfile() {
  if (ADS_DISABLED) {
    applyAdProfileRuntime(AD_PROFILE.SAFE);
    setAdProfileGateVisible(false);
    startAppBoot();
    return;
  }

  const effective = AD_PROFILE.STANDARD;
  setAdProfileChoice(effective);
  applyAdProfileRuntime(effective);
  setAdProfileGateVisible(false);
  startAppBoot();
}

bootWithAdProfile();


