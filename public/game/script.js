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

function must(id) {
  const el = $(id);
  if (!el) throw new Error(`Missing element #${id} (check index.html)`);
  return el;
}

lockMobileZoom();
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
const guestSyncBannerEl = must("guestSyncBanner");
const guestSyncSignInBtn = must("guestSyncSignInBtn");
const guestSyncCloseBtn = must("guestSyncCloseBtn");
const menuFullscreenBtn = must("menuFullscreenBtn");
const infoBtn = must("infoBtn");

// Hangar UI
const pilotPillEl = must("pilotPill");
const backFromHangarBtn = must("backFromHangarBtn");
const statsBoxEl = must("statsBox");
const shipPickerEl = must("shipPicker");
const upgradeListEl = must("upgradeList");
const shipModelEl = must("shipModel");
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

// Leaderboard UI
const backFromLeaderboardBtn = must("backFromLeaderboardBtn");
const backFromCampaignBtn = must("backFromCampaignBtn");
const tabLocalBtn = must("tabLocal");
const tabGlobalBtn = must("tabGlobal");
const leaderboardListEl = must("leaderboardList");
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
const copyLinkBtn = must("copyLinkBtn");
const challengeFriendBtn = must("challengeFriendBtn");
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
const sideFullscreenBtn = must("sideFullscreenBtn");
const sideInfoBtn = must("sideInfoBtn");
const menuResetBtn = must("menuResetBtn");

// Top-right auth UI
const topSignInBtn = must("topSignInBtn");
const topAccountBtn = must("topAccountBtn");
const topAvatarImg = must("topAvatarImg");
const topAvatarFallback = must("topAvatarFallback");
const topSignOutBtn = must("topSignOutBtn");
const topCreditsEl = must("topCredits");
const topCrystalsEl = must("topCrystals");
if (PORTAL_MODE) {
  topSignInBtn.classList.add("hidden");
  topAccountBtn.classList.add("hidden");
  topSignOutBtn.classList.add("hidden");
}

// Touch controls
const touchShootBtn = must("touchShoot");
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

// Daily reward UI
const dailyRewardSummaryEl = must("dailyRewardSummary");
const dailyRewardLadderEl = must("dailyRewardLadder");
const dailyClaimBtn = must("dailyClaimBtn");
const dailyDoubleBtn = must("dailyDoubleBtn");
const dailyCloseBtn = must("dailyCloseBtn");

// Boot loading UI
const bootLoaderEl = must("bootLoader");
const bootLoaderTextEl = must("bootLoaderText");
const bootLoaderFillEl = must("bootLoaderFill");
const bootStartBtn = must("bootStartBtn");
if (PORTAL_MODE) {
  tabGlobalBtn.classList.add("hidden");
}

// Canvas
const uiEl = must("ui");
const gameRootEl = document.getElementById("gameRoot") || uiEl.parentElement || document.body;
const canvas = must("game");
const ctx = canvas.getContext("2d");

let WORLD = { width: 960, height: 600 };

const BOOT = {
  complete: false,
  started: false,
  progress: 0,
};

const SESSION = {
  rewardedAdsClaimed: 0,
  creditsEarned: 0,
  startedAt: Date.now(),
  dailyRewardPromptedAt: "",
};

let forcedPreviewTier = null;
let unlockFxTimer = null;
let currentGameShipKey = "";
let game3DReady = false;

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
  RUN: "run",
  PICK: "pick",
  OVER: "over",
};

let state = STATE.MENU;
let activeMode = MODE.SURVIVAL;
let activeCampaignMissionId = null;
let paused = false;
let hangarAuthWaitScheduled = false;
let routeBooting = true;

function setPaused(next) {
  paused = next;
}

function needsLandscape() {
  return Boolean(window.matchMedia && window.matchMedia("(orientation: portrait)").matches);
}

function updateRotateOverlay() {
  const showHint = BOOT.started && needsLandscape() && state !== STATE.PICK && state !== STATE.OVER;
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
  if (next === STATE.ONLINE) return PORTAL_MODE ? "/game/index.html" : "/game/onlinematch";
  if (next === STATE.ACCOUNT) return PORTAL_MODE ? "/game/index.html" : "/game/account";
  if (next === STATE.RUN || next === STATE.PICK || next === STATE.OVER) return routeForRunState();
  return null;
}

function buildModeSearch() {
  const parts = [];
  if (PORTAL_MODE) parts.push("portal=1");
  if (DEV_MODE) parts.push("dev=1");
  return parts.length ? `?${parts.join("&")}` : "";
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
  const label = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
  if (menuFullscreenBtn) menuFullscreenBtn.textContent = label;
  if (sideFullscreenBtn) sideFullscreenBtn.textContent = label;
}

function updateFullscreenButtonVisibility() {
  const showButtons = shouldUseTouchControls();
  menuFullscreenBtn.classList.toggle("hidden", !showButtons);
  sideFullscreenBtn.classList.toggle("hidden", !showButtons);
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
  document.body.setAttribute("data-state", next);
  document.body.classList.toggle("hangar-open", next === STATE.HANGAR);

  menuEl.classList.toggle("hidden", next !== STATE.MENU);
  hangarEl.classList.toggle("hidden", next !== STATE.HANGAR);
  leaderboardEl.classList.toggle("hidden", next !== STATE.LEADERBOARD);
  campaignEl.classList.toggle("hidden", next !== STATE.CAMPAIGN);
  onlineEl.classList.toggle("hidden", next !== STATE.ONLINE);
  accountEl.classList.toggle("hidden", next !== STATE.ACCOUNT);
  upgradePickEl.classList.toggle("hidden", next !== STATE.PICK);
  gameoverEl.classList.toggle("hidden", next !== STATE.OVER);
  hudEl.classList.toggle("hidden", next !== STATE.RUN);

  // Auto-pause on any overlay
  setPaused(next !== STATE.RUN);
  if (next !== STATE.RUN && next !== STATE.PICK) {
    game3DReady = false;
    currentGameShipKey = "";
    if (window.ship3D && typeof window.ship3D.resetGameScene === "function") {
      window.ship3D.resetGameScene();
    }
  }
  updateTouchControlsVisibility();
  updateRotateOverlay();
  updateGuestSyncBanner();
  if (next === STATE.MENU) {
    claimReadyMissions();
    renderMissionBoard();
    maybeOpenDailyRewardPopup(false);
  }
  if (!routeBooting) syncRouteWithState(next);
}

function setTopAuthUi({ signedIn, displayName, photoUrl }) {
  if (PORTAL_MODE) {
    topSignInBtn.classList.add("hidden");
    topAccountBtn.classList.add("hidden");
    topSignOutBtn.classList.add("hidden");
    return;
  }
  topSignInBtn.classList.toggle("hidden", signedIn);
  topAccountBtn.classList.toggle("hidden", !signedIn);
  topSignOutBtn.classList.toggle("hidden", !signedIn);

  if (!signedIn) {
    topAvatarImg.classList.add("hidden");
    topAvatarFallback.classList.remove("hidden");
    topAvatarFallback.textContent = "P";
    topAccountBtn.title = "Sign in";
    return;
  }

  const initial = String(displayName || SAVE.profile.name || "P").trim().slice(0, 1).toUpperCase() || "P";
  topAvatarFallback.textContent = initial;
  topAccountBtn.title = displayName || SAVE.profile.name || "Account";

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
    return localStorage.getItem(GUEST_SYNC_BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissGuestSyncBanner() {
  try {
    localStorage.setItem(GUEST_SYNC_BANNER_KEY, "1");
  } catch {
    // ignore localStorage failure
  }
  guestSyncBannerEl.classList.add("hidden");
}

function updateGuestSyncBanner() {
  if (PORTAL_MODE) {
    guestSyncBannerEl.classList.add("hidden");
    return;
  }
  cloudInit();
  const shouldShow = state === STATE.MENU && CLOUD.enabled && !isAuthed() && !isGuestSyncBannerDismissed();
  guestSyncBannerEl.classList.toggle("hidden", !shouldShow);
}

function renderAccountPanel() {
  cloudInit();

  if (!CLOUD.enabled) {
    accountBoxEl.innerHTML = `<div class="fine">${withDevDetails("Cloud sync is currently unavailable.", CLOUD.devStatus)}</div>`;
    accountSyncBtn.disabled = true;
    accountSignOutBtn.disabled = true;
    return;
  }

  if (!CLOUD.user) {
    accountBoxEl.innerHTML = `<div class="fine">You are in guest mode. Sign in to sync progress across devices.</div>`;
    accountSyncBtn.disabled = true;
    accountSignOutBtn.disabled = true;
    return;
  }

  const u = CLOUD.user;
  const ownedShips = SHIPS.filter((s) => ensureShipState(s.id).owned).length;
  const totalShips = SHIPS.length;

  const grid = (items) =>
    `<div class="accountGrid">${items
      .map(
        (it) => `
        <div class="accountItem">
          <div class="accountLabel">${it.label}</div>
          <div class="accountValue">${it.value}</div>
        </div>`
      )
      .join("")}</div>`;

  const items = [
    { label: "Name", value: `${(u.displayName || SAVE.profile.name || "Pilot").slice(0, 40)}` },
    { label: "Email", value: `${(u.email || "<small>(not available)</small>")}` },
    { label: "UID", value: `${String(u.uid || "").slice(0, 10)}<small>вЂ¦</small>` },
    { label: "Level", value: `${levelFromXp(SAVE.profile.xp)}` },
    { label: "Credits", value: `${SAVE.profile.credits}` },
    { label: "Crystals", value: `${SAVE.profile.crystals}` },
    { label: "Ships", value: `${ownedShips}/${totalShips} owned` },
    { label: "Games", value: `${SAVE.profile.gamesPlayed || 0} total` },
    { label: "Online W/L", value: `${SAVE.profile.onlineWins || 0}/${SAVE.profile.onlineLosses || 0}` },
    { label: "Best Score", value: `${SAVE.profile.bestScore}` },
    { label: "Best Survival Kills", value: `${Math.max(0, Number(SAVE.profile.bestSurvivalKills || 0))}` },
  ];

  accountBoxEl.innerHTML = grid(items);
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
resizeCanvas();

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  shooting: false,
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
};

function worldFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WORLD.width;
  const y = ((event.clientY - rect.top) / rect.height) * WORLD.height;
  return { x: clamp(x, 0, WORLD.width), y: clamp(y, 0, WORLD.height) };
}

window.addEventListener("keydown", (event) => {
  if (shouldIgnoreFullscreenHotkey(event.target)) return;
  if (event.code in keyMap) {
    const action = keyMap[event.code];
    if (action === "shoot") input.shooting = true;
    else input[action] = true;
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
const GUEST_SYNC_BANNER_KEY = "stellar_sync_banner_dismissed_v1";
const CLOUD_SYNC_CHOICE_PREFIX = "stellar_sync_choice_uid_";

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
      gamesPlayed: 0,
      gamesSurvival: 0,
      gamesCampaign: 0,
      onlineGames: 0,
      onlineWins: 0,
      onlineLosses: 0,
      totalKills: 0,
      totalRunSeconds: 0,
      adRewardsDay: "",
      adRewardsClaimed: 0,
      adRewardLastAt: 0,
      adIntegrityLastAt: 0,
      dailyClaimTimestamp: 0,
      dailyStreakDay: 0,
      missionDayKey: "",
      missionWeekKey: "",
      updatedAt: 0,
    },
    ships: {},
    missions: {
      daily: [],
      weekly: [],
    },
    leaderboard: [],
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile || {}) },
      ships: { ...base.ships, ...(parsed.ships || {}) },
      missions: { ...base.missions, ...(parsed.missions || {}) },
      leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : base.leaderboard,
    };
  } catch {
    return defaultSave();
  }
}

function saveNow() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
  } catch {
    // ignore
  }
}

const SAVE = loadSave();

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
    priceCredits: 6400,
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
    priceCredits: 9800,
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
    priceCredits: 16800,
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
    priceCredits: 23500,
    priceCrystals: 70,
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
    name: "Interceptor",
    rarity: "Earned",
    priceCredits: 36000,
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
    name: "Drone Carrier",
    rarity: "Rare",
    priceCredits: 52000,
    priceCrystals: 135,
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
    priceCredits: 79000,
    priceCrystals: 190,
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
    priceCredits: 125000,
    priceCrystals: 260,
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
    priceCrystals: 480,
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
    priceCredits: 250000,
    priceCrystals: 900,
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

function shipById(id) {
  return SHIPS.find((s) => s.id === id) || SHIPS[0];
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
  if (!Number.isFinite(Number(SAVE.profile.crystalsShadow))) SAVE.profile.crystalsShadow = SAVE.profile.crystals || 0;
  const statKeys = [
    "gamesPlayed",
    "gamesSurvival",
    "gamesCampaign",
    "onlineGames",
    "onlineWins",
    "onlineLosses",
    "totalKills",
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
  if (!SAVE.missions || typeof SAVE.missions !== "object") SAVE.missions = { daily: [], weekly: [] };
  if (!Array.isArray(SAVE.missions.daily)) SAVE.missions.daily = [];
  if (!Array.isArray(SAVE.missions.weekly)) SAVE.missions.weekly = [];
  saveNow();
}

migrateSave();

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
  { id: "daily_kills_200", title: "Defeat 200 enemies", type: "kills", target: 200, rewardCredits: 1250, rewardCrystals: 1 },
  { id: "daily_wave_15", title: "Reach wave 15", type: "wave", target: 15, rewardCredits: 1500, rewardCrystals: 2 },
];

const WEEKLY_MISSION_POOL = [
  { id: "weekly_kills_1200", title: "Defeat 1200 enemies", type: "kills", target: 1200, rewardCredits: 8500, rewardCrystals: 12 },
  { id: "weekly_survive_45m", title: "Survive 45 minutes total", type: "run_seconds", target: 2700, rewardCredits: 7000, rewardCrystals: 8 },
  { id: "weekly_wave_25", title: "Reach wave 25", type: "wave", target: 25, rewardCredits: 9500, rewardCrystals: 15 },
];

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
    const dailyDefs = seededPick(DAILY_MISSION_POOL, 2, `${today}:daily`);
    SAVE.missions.daily = dailyDefs.map((def) => cloneMission(def, today));
  }

  if (SAVE.profile.missionWeekKey !== week || !Array.isArray(SAVE.missions.weekly) || SAVE.missions.weekly.length === 0) {
    SAVE.profile.missionWeekKey = week;
    const weeklyDefs = seededPick(WEEKLY_MISSION_POOL, 2, `${week}:weekly`);
    SAVE.missions.weekly = weeklyDefs.map((def) => cloneMission(def, week));
  }
}

function missionProgressLabel(m) {
  const cur = Math.min(m.target, Math.floor(m.progress || 0));
  return `${cur}/${m.target}`;
}

function renderMissionBoard() {
  if (!missionBoardEl) return;
  ensureMissionSet();
  const sections = [];
  const dailyRows = (SAVE.missions.daily || []).map((m) => {
    const done = (m.progress || 0) >= m.target;
    const reward = `+${m.rewardCredits} credits${m.rewardCrystals ? `, +${m.rewardCrystals} crystals` : ""}`;
    return `<div class="missionBoard__row"><strong>${m.title}</strong><span>${missionProgressLabel(m)} · ${done ? (m.claimed ? "Claimed" : "Ready to claim") : "In progress"}</span><span>${reward}</span></div>`;
  }).join("");
  sections.push(`<div class="missionBoard__title">Daily Missions</div>${dailyRows}`);

  const weeklyRows = (SAVE.missions.weekly || []).map((m) => {
    const done = (m.progress || 0) >= m.target;
    const reward = `+${m.rewardCredits} credits${m.rewardCrystals ? `, +${m.rewardCrystals} crystals` : ""}`;
    return `<div class="missionBoard__row"><strong>${m.title}</strong><span>${missionProgressLabel(m)} · ${done ? (m.claimed ? "Claimed" : "Ready to claim") : "In progress"}</span><span>${reward}</span></div>`;
  }).join("");
  sections.push(`<div class="missionBoard__title">Weekly Missions</div>${weeklyRows}`);
  missionBoardEl.innerHTML = sections.join("");
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
    showToast(`Mission rewards: +${gainedCredits} credits${gainedCrystals ? `, +${gainedCrystals} crystals` : ""}`);
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
      <strong>Day ${reward.day}</strong>
      <span>+${reward.credits} credits${reward.crystals ? `, +${reward.crystals} crystals` : ""}</span>
    </div>`;
  }).join("");
  dailyRewardLadderEl.innerHTML = ladderRows;
  if (st.claimable) {
    dailyRewardSummaryEl.textContent = st.reset
      ? "Daily streak reset. Claim Day 1 now."
      : `Daily streak day ${st.streakDay}. Claim your reward now.`;
  } else {
    dailyRewardSummaryEl.textContent = "Reward already claimed today. Come back tomorrow.";
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
  const credits = Math.floor(reward.credits * mult);
  const crystals = Math.floor(reward.crystals * mult);
  SAVE.profile.credits += credits;
  SAVE.profile.crystals += crystals;
  SAVE.profile.crystalsShadow = Math.max(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
  SAVE.profile.dailyClaimTimestamp = nowMs();
  SAVE.profile.dailyStreakDay = st.streakDay;
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  updateTopBar();
  showToast(`Daily reward claimed: +${credits} credits${crystals ? `, +${crystals} crystals` : ""}`);
  dailyRewardEl.classList.add("hidden");
  return true;
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
  return {
    pilotLevel,
    shipId: ship.id,
    shipName: ship.name,
    speed: (ship.base.speed + u.thrusters * 18) * eliteMult,
    bulletSpeed: (ship.base.bulletSpeed + u.bulletSpeed * 34) * eliteMult,
    damage: (ship.base.damage + u.damage * 0.35 + levelBonus) * eliteMult,
    fireRate: Math.max(0.05, ship.base.fireRate * Math.pow(0.92, u.fireRate) / eliteMult),
    shieldMax: Math.floor((ship.base.shieldMax + u.shieldMax * 18) * eliteMult),
    shieldRegen: (ship.base.shieldRegen + u.shieldRegen * 0.95) * eliteMult,
    hullMax: Math.floor((ship.base.hullMax + u.hullMax * 16) * eliteMult),
    pierce: ship.base.pierce + u.pierce,
    droneCount: ship.base.droneCount + u.drone,
  };
}

const PERM_UPGRADES = [
  {
    key: "damage",
    name: "Laser Damage",
    desc: "Bullets deal more damage.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(360 * Math.pow(1.42, lvl)),
  },
  {
    key: "fireRate",
    name: "Fire Rate",
    desc: "Shoot faster.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(410 * Math.pow(1.4, lvl)),
  },
  {
    key: "bulletSpeed",
    name: "Bullet Speed",
    desc: "Faster bullets hit more reliably.",
    currency: "credits",
    max: 8,
    cost: (lvl) => Math.floor(300 * Math.pow(1.38, lvl)),
  },
  {
    key: "shieldMax",
    name: "Shield Capacity",
    desc: "More shield HP.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(350 * Math.pow(1.4, lvl)),
  },
  {
    key: "shieldRegen",
    name: "Shield Regen",
    desc: "Shield regenerates faster.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(360 * Math.pow(1.38, lvl)),
  },
  {
    key: "hullMax",
    name: "Hull Plating",
    desc: "More hull HP.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(340 * Math.pow(1.41, lvl)),
  },
  {
    key: "thrusters",
    name: "Thrusters",
    desc: "Move faster.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(300 * Math.pow(1.38, lvl)),
  },
  {
    key: "pierce",
    name: "Piercing Core",
    desc: "Bullets pierce more targets.",
    currency: "crystals",
    max: 3,
    cost: (lvl) => Math.floor(95 * Math.pow(1.75, lvl)),
  },
  {
    key: "drone",
    name: "Drone Bay",
    desc: "Add an auto-firing drone.",
    currency: "crystals",
    max: 3,
    cost: (lvl) => Math.floor(120 * Math.pow(1.82, lvl)),
  },
  {
    key: "elite",
    name: "Elite Core",
    desc: "High-end tuning: moderate boost to core stats.",
    currency: "crystals",
    max: 5,
    cost: (lvl) => Math.floor(170 * Math.pow(1.9, lvl)),
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

function progressionRequiresAuth() {
  return false;
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

function buildRunSharePayload(score, wave) {
  const safeScore = Math.max(0, Math.floor(Number(score || 0)));
  const safeWave = Math.max(1, Math.floor(Number(wave || 1)));
  const link =
    `https://stellarsiege.vercel.app/?ref=share&utm_source=share&utm_campaign=runshare` +
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

playSurvivalBtn.addEventListener("click", () => startRun(MODE.SURVIVAL));
playCampaignBtn.addEventListener("click", () => {
  renderCampaignMissions();
  setState(STATE.CAMPAIGN);
});
hangarBtn.addEventListener("click", async () => {
  await waitForAuthRestore();
  renderHangar();
  setState(STATE.HANGAR);
});
leaderboardBtn.addEventListener("click", () => {
  renderLeaderboard("local");
  setState(STATE.LEADERBOARD);
});
onlineBtn.addEventListener("click", () => {
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

infoBtn.addEventListener("click", () => {
  infoOverlayEl.classList.remove("hidden");
});

backFromHangarBtn.addEventListener("click", () => setState(STATE.MENU));
backFromLeaderboardBtn.addEventListener("click", () => setState(STATE.MENU));
backFromCampaignBtn.addEventListener("click", () => setState(STATE.MENU));
backFromOnlineBtn.addEventListener("click", () => setState(STATE.MENU));

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

infoBtn.addEventListener("click", () => {
  renderInfoShips();
});

sideInfoBtn.addEventListener("click", () => {
  renderInfoShips();
});

sideInfoBtn.addEventListener("click", () => {
  infoOverlayEl.classList.remove("hidden");
});

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
  if (spend <= 0) return;
  SAVE.profile.crystals -= spend;
  SAVE.profile.credits += spend * 200;
  // Never allow the client to "create" crystals. Shadow follows spending.
  SAVE.profile.crystalsShadow = Math.min(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
  saveNow();
  if (isAuthed()) cloudPush().catch(() => {});
  renderHangar();
  updateTopBar();
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

copyLinkBtn.addEventListener("click", async () => {
  const payload = buildRunSharePayload(finalScoreEl.textContent, finalWaveEl.textContent);
  const ok = await copyText(payload.link);
  showToast(ok ? "Link copied." : "Clipboard unavailable.");
});

challengeFriendBtn.addEventListener("click", async () => {
  const res = await shareRunScore(finalScoreEl.textContent, finalWaveEl.textContent, "native");
  if (res.ok) {
    showToast(res.method === "webshare" ? "Challenge sent." : "Challenge copied.");
  } else {
    showToast("Unable to challenge right now.");
  }
});

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

menuHangarBtn.addEventListener("click", async () => {
  setMenuOpen(false);
  await waitForAuthRestore();
  renderHangar();
  setState(STATE.HANGAR);
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

dailyCloseBtn.addEventListener("click", () => {
  dailyRewardEl.classList.add("hidden");
});

dailyClaimBtn.addEventListener("click", () => {
  grantDailyReward(1);
});

dailyDoubleBtn.addEventListener("click", async () => {
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
    const completed = await requestRewardedAdCompletion("daily_double", (remaining) => {
      dailyDoubleBtn.textContent = `Ad: ${remaining}s`;
    });
    if (!completed) {
      showToast("No ad available, try later.");
      return;
    }
    if (!consumeAdRewardSlot()) {
      showToast("Rewarded ad unavailable. Try later.");
      return;
    }
    grantDailyReward(2);
  } catch {
    showToast("No ad available, try later.");
  } finally {
    dailyDoubleBtn.textContent = "Double Reward (Watch Ad)";
    renderDailyRewardPopup();
  }
});

tierT1Btn.addEventListener("click", () => {
  forcedPreviewTier = 1;
  if (state === STATE.HANGAR) renderHangar();
});

tierT2Btn.addEventListener("click", () => {
  forcedPreviewTier = 2;
  if (state === STATE.HANGAR) renderHangar();
});

tierT3Btn.addEventListener("click", () => {
  forcedPreviewTier = 3;
  if (state === STATE.HANGAR) renderHangar();
});

// -----------------------------
// Game + UI implementation
// -----------------------------

pilotPillEl.addEventListener("click", async () => {
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

  setBtn(hangarAdCreditsBtn, "Watch Ad → +350 Credits");
  setBtn(hangarAdCrystalsBtn, "Watch Ad → +2 Crystals");
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

function renderHangar() {
  cloudInit();
  if (!unlockFxTimer) unlockFxEl.classList.add("hidden");

  const authed = isAuthed();
  const payReady = PAYMENTS_ENABLED && isHosted();
  const selectedShip = shipById(SAVE.profile.selectedShipId);
  const selectedState = ensureShipState(selectedShip.id);
  storeCardEl.classList.toggle("hidden", PORTAL_MODE || !PAYMENTS_ENABLED);
  hangarAuthWaitScheduled = false;

  buy100Btn.disabled = PORTAL_MODE || !payReady || !authed;
  buy550Btn.disabled = PORTAL_MODE || !payReady || !authed;
  buyCredits10kBtn.disabled = PORTAL_MODE || !payReady || !authed;
  buyCredits65kBtn.disabled = PORTAL_MODE || !payReady || !authed;
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
    buy100Btn.title = "Sign in to purchase.";
    buy550Btn.title = "Sign in to purchase.";
    buyCredits10kBtn.title = "Sign in to purchase.";
    buyCredits65kBtn.title = "Sign in to purchase.";
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
        SAVE.profile.selectedShipId = s.id;
        SAVE.profile.updatedAt = nowMs();
        saveNow();
        renderHangar();
        return;
      }

      // First tap on locked ship previews silhouette/stats. Second tap can purchase.
      if (SAVE.profile.selectedShipId !== s.id) {
        SAVE.profile.selectedShipId = s.id;
        SAVE.profile.updatedAt = nowMs();
        saveNow();
        renderHangar();
        return;
      }

      // Locked ship: offer purchase using local wallet progression.
      const costText = s.priceCrystals ? `${s.priceCrystals} crystals` : `${s.priceCredits} credits`;
      const ok = confirm(`Buy ${s.name} for ${costText}?`);
      if (!ok) return;

      if (s.priceCrystals) {
        if (SAVE.profile.crystals < s.priceCrystals) {
          alert("Not enough crystals. Buy a crystal pack first.");
          return;
        }
        SAVE.profile.crystals -= s.priceCrystals;
      } else {
        if (SAVE.profile.credits < s.priceCredits) {
          alert("Not enough credits. Play Survival/Campaign to earn credits.");
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
      renderHangar();
      updateTopBar();
    });
    shipPickerEl.appendChild(btn);
  });

  const tier = previewVisualTierForShip(selectedShip.id);
  void renderShipPreview(selectedShip.id, tier, !selectedState.owned);

  // Stats preview for current ship
  const base = computePermanentStats(selectedShip.id);
  const statRows = [
    ["Pilot", `${SAVE.profile.name} (Lvl ${base.pilotLevel})`],
    ["Ship", `${base.shipName} (${selectedShip.rarity})`],
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
    btn.textContent = lvl >= def.max ? "Max" : `Buy ${cost} ${def.currency}`;
    btn.disabled = !canBuy;
    btn.addEventListener("click", () => {
      if (lvl >= def.max) return;
      if (def.currency === "credits") {
        if (SAVE.profile.credits < cost) return;
        SAVE.profile.credits -= cost;
      } else {
        if (SAVE.profile.crystals < cost) return;
        SAVE.profile.crystals -= cost;
      }
      selectedState.upgrades[def.key] = lvl + 1;
      SAVE.profile.updatedAt = nowMs();
      saveNow();
      updateTopBar();
      cloudPush().catch(() => {});
      renderHangar();
    });

    row.appendChild(left);
    row.appendChild(btn);
    upgradeListEl.appendChild(row);
  });

  renderHangarRewardedActions();
}

function renderLeaderboard(which) {
  if (which === "global") {
    renderGlobalLeaderboard();
    return;
  }

  const rows = (SAVE.leaderboard || []).slice(0, 10);
  if (rows.length === 0) {
    leaderboardListEl.innerHTML = `<div class="fine">No runs yet. Play Survival and come back.</div>`;
    return;
  }

  leaderboardListEl.innerHTML = rows
    .map((e, i) => {
      const mode = e.mode === MODE.CAMPAIGN ? "C" : e.mode === MODE.DUEL ? "D" : "S";
      return `
        <div class="lbRow">
          <div class="lbRank">#${i + 1}</div>
          <div>
            <div class="lbName">${e.name} <span style="opacity:.6">(${mode})</span></div>
            <div style="opacity:.7; font-size:12px">Wave ${e.wave} В· ${e.date}</div>
          </div>
          <div class="lbScore">${e.score}</div>
        </div>
      `;
    })
    .join("");
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
    if (window.firebase.auth && window.firebase.auth.Auth && window.firebase.auth.Auth.Persistence) {
      CLOUD.auth
        .setPersistence(window.firebase.auth.Auth.Persistence.LOCAL)
        .catch(() => {});
    }
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
  const provider = new window.firebase.auth.GoogleAuthProvider();
  await CLOUD.auth.signInWithPopup(provider);
}

async function cloudSignOut() {
  if (!CLOUD.enabled || !CLOUD.auth) return;
  await CLOUD.auth.signOut();
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
    gamesPlayed: Number(SAVE.profile.gamesPlayed || 0),
    gamesSurvival: Number(SAVE.profile.gamesSurvival || 0),
    gamesCampaign: Number(SAVE.profile.gamesCampaign || 0),
    onlineGames: Number(SAVE.profile.onlineGames || 0),
    onlineWins: Number(SAVE.profile.onlineWins || 0),
    onlineLosses: Number(SAVE.profile.onlineLosses || 0),
    adRewardsDay: String(SAVE.profile.adRewardsDay || ""),
    adRewardsClaimed: Number(SAVE.profile.adRewardsClaimed || 0),
    adRewardLastAt: Number(SAVE.profile.adRewardLastAt || 0),
    updatedAt: nowMs(),
  };
  return {
    profile,
    ships: SAVE.ships,
    version: 2,
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
  const localUpdated = Number(SAVE.profile.updatedAt || 0);
  const remoteUpdated = Number(remote.profile && remote.profile.updatedAt ? remote.profile.updatedAt : 0);

  const remoteCrystals = Number(remote.profile && Number.isFinite(Number(remote.profile.crystals)) ? remote.profile.crystals : 0);
  const useRemote = preferRemote || (!preferLocal && remoteUpdated > localUpdated);

  if (useRemote) {
    SAVE.profile = { ...SAVE.profile, ...(remote.profile || {}) };
    SAVE.profile.crystals = remoteCrystals;
    SAVE.profile.crystalsShadow = remoteCrystals;
    SAVE.ships = mergeShips(preferRemote ? {} : SAVE.ships, remote.ships);
    migrateSave();
    saveNow();
    return;
  }

  // Local is newer or explicitly chosen: push local progress, but never increase crystals from the client.
  SAVE.ships = mergeShips(SAVE.ships, remote.ships);
  migrateSave();
  saveNow();
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
        return `
          <div class="lbRow">
            <div class="lbRank">#${i + 1}</div>
            <div>
              <div class="lbName">${name} <span style="opacity:.65">@${username}</span></div>
              <div style="opacity:.72; font-size:12px">W ${wins} · L ${losses} · Online ${onlineGames} · Games ${gamesPlayed} · XP ${xp}</div>
            </div>
            <div class="lbScore">${points} pts</div>
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
  if (CLOUD.user) {
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
  } else {
    if (trackedAuthUid) trackEvent("logout", { method: "google" });
    trackedAuthUid = null;
    CLOUD.usernameReady = false;
  }
  updateAuthUi();
}

function updateAuthUi() {
  authStatusEl.textContent = cloudUserLabel();
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
    onlineBtn.textContent = "Online Duel (Coming Soon)";
    menuOnlineBtn.textContent = "Online (Coming Soon)";
  } else {
    onlineBtn.textContent = "Online Duel (Beta)";
    menuOnlineBtn.textContent = "Online";
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
    .join(" В· ");
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
        <span style="opacity:.65">В·</span>
        <span>Reward ~${500 + m.id * 120} credits</span>
        <span style="opacity:.65">В·</span>
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

  return parts.join(" В· ");
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
    onlineHintEl.textContent = `Room ${ONLINE_SESSION.roomCode} В· ${who} В· ${status}`;

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
    onlineHintEl.textContent = "Waiting for host to start the duelвЂ¦";
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
};

const PLAYER_BOUND_PAD = 6;

const AD_REWARDS = {
  survival: { seconds: 20, credits: 260, crystals: 0, xp: 90 },
  campaign: { seconds: 35, credits: 380, crystals: 1, xp: 140 },
  duel: { seconds: 45, credits: 520, crystals: 1, xp: 180 },
  hangar_credits: { seconds: 20, credits: 350, crystals: 0, xp: 0 },
  hangar_crystals: { seconds: 20, credits: 0, crystals: 2, xp: 0 },
};

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
  const now = nowMs();
  const lastIntegrity = Number(SAVE.profile.adIntegrityLastAt || 0);
  if (lastIntegrity && now + 30000 < lastIntegrity) {
    return true;
  }
  SAVE.profile.adIntegrityLastAt = now;
  return false;
}

function adRewardStatus() {
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
  const sec = Math.max(1, Math.ceil(waitMs / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function consumeAdRewardSlot() {
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
    if (completed) {
      console.info("rewarded_completed", { placement: modeKey });
      trackEvent("rewarded_completed", { placement: modeKey });
    } else {
      console.info("rewarded_failed", { placement: modeKey, reason: (result && result.reason) || "not_completed" });
      trackEvent("rewarded_failed", { placement: modeKey, reason: (result && result.reason) || "not_completed" });
    }
    return completed;
  }

  console.info("rewarded_failed", { placement: modeKey, reason: "provider_unavailable" });
  trackEvent("rewarded_failed", { placement: modeKey, reason: "provider_unavailable" });
  return false;
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
  run.kills = 0;
  run.runUpgrades = {};
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

  entities.bullets = [];
  entities.enemies = [];
  entities.pickups = [];
  entities.beacons = [];
  entities.particles = [];
  entities.drones = [];

  const base = computePermanentStats();

  player.x = WORLD.width / 2;
  player.y = WORLD.height / 2;
  player.vx = 0;
  player.vy = 0;
  player.fireTimer = 0;
  player.angle = 0;
  player.alive = true;
  player.hitCooldown = 0;
  player.shieldMax = base.shieldMax;
  player.shield = player.shieldMax;
  player.shieldRegen = base.shieldRegen;
  player.hullMax = base.hullMax;
  player.hull = player.hullMax;

  applyStats();
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
  const eliteChance = typeKey === "boss" || typeKey === "pvp" || typeKey === "duelist" ? 0 : Math.min(0.22, Math.max(0, (wave - 7) * 0.01));
  const elite = Math.random() < eliteChance;
  const hpMult = elite ? 1.6 : 1;
  const speedMult = elite ? 1.12 : 1;
  const maxHp = type.hp(wave);
  entities.enemies.push({
    id: Math.random().toString(16).slice(2),
    type: typeKey,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: maxHp * hpMult,
    maxHp: maxHp * hpMult,
    speed: type.speed(wave) * speedMult,
    size: type.size + (elite ? 3 : 0),
    color: elite ? "#ffdb6e" : type.color,
    elite,
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

function spawnBullet({ x, y, vx, vy, team, damage, pierce }) {
  entities.bullets.push({
    x,
    y,
    vx,
    vy,
    life: 1.4,
    team,
    damage,
    pierce,
    r: team === "player" ? 4 : 3,
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

function takeDamage(amount) {
  run.shake = Math.min(14, run.shake + 3.5);
  let remaining = amount;
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
    endRun("dead");
  }
}

function killEnemy(enemy) {
  const type = ENEMY_TYPES[enemy.type];
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

  if (enemy.type !== "pvp") {
    const dropChance = enemy.type === "boss" ? 1 : 0.12 + Math.min(0.18, run.wave * 0.01);
    if (Math.random() < dropChance) spawnPickup(enemy.x, enemy.y);
  }

  if (enemy.type === "boss") {
    run.bossAlive = false;
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

  // Medium-hard economy pacing with subtle anti-farming multiplier.
  const baseCredits = Math.floor(run.score * 0.08) + run.wave * 9;
  const baseXp = Math.floor(run.score * 0.1) + run.wave * 8;
  let crystals = 0;
  if (run.mode === MODE.SURVIVAL) {
    if (run.wave >= 10 && Math.random() < 0.02) crystals += 1;
    if (run.wave >= 20 && Math.random() < 0.02) crystals += 1;
  }
  if (reason === "duel_win") crystals += 1;

  let credits = Math.floor(baseCredits * farmMult);
  let xp = Math.floor(baseXp * (0.95 + farmMult * 0.05));
  let unlockNextMission = false;
  if (run.mode === MODE.CAMPAIGN && run.campaign.completed) {
    credits += 320 + run.campaign.missionId * 95;
    xp += 140 + run.campaign.missionId * 36;
    crystals += 1;
    unlockNextMission = true;
  }
  if (reason === "duel_win") {
    credits += 260;
    xp += 140;
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
    SAVE.profile.gamesPlayed = Number(SAVE.profile.gamesPlayed || 0) + 1;
    SAVE.profile.totalKills = Number(SAVE.profile.totalKills || 0) + Number(run.kills || 0);
    SAVE.profile.totalRunSeconds = Number(SAVE.profile.totalRunSeconds || 0) + runSeconds;
    if (run.mode === MODE.SURVIVAL) SAVE.profile.gamesSurvival = Number(SAVE.profile.gamesSurvival || 0) + 1;
    if (run.mode === MODE.CAMPAIGN) SAVE.profile.gamesCampaign = Number(SAVE.profile.gamesCampaign || 0) + 1;
    if (run.mode === MODE.DUEL && run.duel && run.duel.kind === "online") {
      SAVE.profile.onlineGames = Number(SAVE.profile.onlineGames || 0) + 1;
      if (reason === "duel_win") SAVE.profile.onlineWins = Number(SAVE.profile.onlineWins || 0) + 1;
      if (reason === "duel_loss") SAVE.profile.onlineLosses = Number(SAVE.profile.onlineLosses || 0) + 1;
    }

    SAVE.leaderboard.unshift(entry);
    SAVE.leaderboard = SAVE.leaderboard.sort((a, b) => b.score - a.score).slice(0, 15);
    SESSION.creditsEarned += credits;
    SAVE.profile.updatedAt = nowMs();
    saveNow();
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

async function tryRewardedPlacement({ placement, cfg, buttonEl, textEl, markClaimed = false }) {
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

  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = "Starting Ad...";
  }

  const completed = await requestRewardedAdCompletion(placement, (remaining) => {
    if (buttonEl) buttonEl.textContent = `Ad: ${remaining}s`;
  });
  if (!completed) {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = "Watch Ad";
    }
    if (textEl) textEl.textContent = "No ad available, try later.";
    showToast("No ad available, try later.");
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

  const granted = grantAdReward(cfg);
  if (!granted) return false;
  if (markClaimed) run.adRewardClaimed = true;
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = "Reward Granted";
  }
  if (textEl) {
    const next = adRewardStatus();
    textEl.textContent = `Reward granted. ${next.remaining}/${ADS.dailyCap} remaining today.`;
  }
  return true;
}

function renderAdReward(reason) {
  if (!adRewardBoxEl || !adRewardBtn || !adRewardTextEl) return;
  const modeKey = run.mode === MODE.SURVIVAL ? "survival" : run.mode === MODE.CAMPAIGN ? "campaign" : "duel";
  const cfg = AD_REWARDS[modeKey];
  const status = adRewardStatus();

  adRewardBoxEl.classList.remove("hidden");
  adRewardBtn.onclick = null;
  adRewardBtn.disabled = true;
  adRewardBtn.textContent = "Watch Ad";
  adRewardTextEl.textContent = `Watch an optional ad for +${cfg.credits} credits, +${cfg.crystals} crystals, +${cfg.xp} xp.`;

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

function grantAdReward(cfg) {
  if (!cfg) return false;
  SAVE.profile.credits += cfg.credits;
  SAVE.profile.crystals += cfg.crystals;
  SAVE.profile.crystalsShadow = Math.max(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
  SAVE.profile.xp += cfg.xp;
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  updateTopBar();
  renderMissionBoard();
  if (CLOUD.enabled && CLOUD.user) cloudPush().catch(() => {});
  return true;
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
  if (!BOOT.started) return;
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
      const hp = opp ? `${Math.max(0, Math.ceil(opp.hp))}/${Math.ceil(opp.maxHp)}` : "вЂ”";
      objectiveEl.textContent = `Win: reduce opponent HP to 0 (${hp})`;
    } else {
      const duelist = entities.enemies.find((e) => e.type === "duelist");
      const hp = duelist ? `${Math.max(0, Math.ceil(duelist.hp))}/${Math.ceil(duelist.maxHp)}` : "вЂ”";
      objectiveEl.textContent = `Win: reduce duelist HP to 0 (${hp})`;
    }
  } else {
    const nextBoss = run.bossAlive ? "Boss fight!" : `Next boss: W${Math.ceil(run.wave / 4) * 4}`;
    objectiveEl.textContent = `Survive В· ${nextBoss}`;
  }

  const shieldPct = player.shieldMax > 0 ? player.shield / player.shieldMax : 0;
  const hullPct = player.hullMax > 0 ? player.hull / player.hullMax : 0;
  shieldBarEl.style.width = `${Math.floor(clamp(shieldPct, 0, 1) * 100)}%`;
  hullBarEl.style.width = `${Math.floor(clamp(hullPct, 0, 1) * 100)}%`;
}

function updatePlayer(dt) {
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

  const dx = input.mouseX - player.x;
  const dy = input.mouseY - player.y;
  player.angle = Math.atan2(dy, dx);

  if (player.alive) {
    player.shield = Math.min(player.shieldMax, player.shield + player.shieldRegen * dt);
  }

  player.hitCooldown = Math.max(0, (player.hitCooldown || 0) - dt);

  player.fireTimer -= dt;
  if (input.shooting && player.fireTimer <= 0 && player.alive) {
    player.fireTimer = player.fireRate;
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    const baseX = player.x + dirX * 22;
    const baseY = player.y + dirY * 22;

    // Simple spread upgrade (runUpgrades.spread)
    const spreadLevel = run.runUpgrades.spread || 0;
    const shots = 1 + spreadLevel * 2;
    const spread = 0.14;

    if (run.mode === MODE.CAMPAIGN) run.campaign.shotsFired += shots;

    for (let i = 0; i < shots; i += 1) {
      const t = shots === 1 ? 0 : (i / (shots - 1)) * 2 - 1;
      const a = player.angle + t * spread;
      const b = {
        x: baseX,
        y: baseY,
        vx: Math.cos(a) * player.bulletSpeed,
        vy: Math.sin(a) * player.bulletSpeed,
        team: "player",
        damage: player.damage,
        pierce: player.pierce,
      };
      spawnBullet(b);
      onlineDuelMaybeSendBullet(b);
    }

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
  if (run.mode === MODE.DUEL) {
    // Duel: the duelist is spawned at start; no extra spawns.
  } else if (run.mode === MODE.CAMPAIGN) {
    const mission = getCampaignMission(run.campaign.missionId);

    // Spawn regular enemies
    const ramp = Math.floor(run.time / 28);
    const desired = (mission.spawns.desired || 5) + ramp;
    const nonBossCount = entities.enemies.filter((e) => e.type !== "boss").length;
    if (!run.bossAlive && nonBossCount < desired) {
      const pool = mission.spawns.pool || ["drone"];
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
    const desired = 4 + Math.floor(run.wave * 0.8);
    if (!run.bossAlive && entities.enemies.length < desired) {
      const roll = Math.random();
      let type = "drone";
      if (run.wave >= 3 && roll > 0.63) type = "fighter";
      if (run.wave >= 6 && roll > 0.8) type = "sniper";
      if (run.wave >= 9 && roll > 0.88) type = "rammer";
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

    if (e.type === "rammer" && dist < 280) {
      tx = dx / dist;
      ty = dy / dist;
      e.speed += 28 * dt;
    }

    e.vx += (tx * e.speed - e.vx) * 4.5 * dt;
    e.vy += (ty * e.speed - e.vy) * 4.5 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // Shooting
    if (type.shoot) {
      e.fire -= dt;
      const fireRate = type.fireRate ? type.fireRate(run.wave) : 1.1;
      if (e.fire <= 0 && dist < 520) {
        e.fire = fireRate;
        const bx = (dx / dist) * type.bulletSpeed;
        const by = (dy / dist) * type.bulletSpeed;
        const dmgScale = run.mode === MODE.DUEL ? 1 : 1 + Math.min(1.2, run.wave * 0.03);
        spawnBullet({
          x: e.x,
          y: e.y,
          vx: bx,
          vy: by,
          team: "enemy",
          damage: (type.damage || 10) * dmgScale,
          pierce: 0,
        });
      }

      if (e.type === "boss" && Math.random() < dt * 0.8) {
        const a0 = Math.atan2(dy, dx);
        const dmgScale = run.mode === MODE.DUEL ? 1 : 1 + Math.min(1.2, run.wave * 0.03);
        for (let k = -1; k <= 1; k += 1) {
          const a = a0 + k * 0.22;
          spawnBullet({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 240,
            vy: Math.sin(a) * 240,
            team: "enemy",
            damage: 12 * dmgScale,
            pierce: 0,
          });
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
      if (e.type === "boss") base = 28;
      if (e.type === "duelist") base = 16;
      if (e.type === "pvp") base = 16;

      const scaler = run.mode === MODE.DUEL ? 1 : 1 + Math.min(1.2, run.wave * 0.04);
      const eliteHitMult = e.elite ? 1.25 : 1;
      const dmg = Math.round(base * scaler * eliteHitMult);

      // Knock the player away a bit so we don't "stick" inside hitboxes.
      const kx = dx / dist;
      const ky = dy / dist;
      const bound = player.radius + PLAYER_BOUND_PAD;
      player.x = clamp(player.x + kx * 22, bound, WORLD.width - bound);
      player.y = clamp(player.y + ky * 22, bound, WORLD.height - bound);

      takeDamage(dmg);
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
          e.hp -= b.damage;
          run.score += 6;
          run.combo = Math.min(10, run.combo + 1);
          run.comboTimer = 1.2;

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
}

function updateWorld(dt) {
  run.time += dt;
  run.comboTimer -= dt;
  if (run.comboTimer <= 0) run.combo = 1;
  run.score += dt * 10 * run.combo;
  run.shake = Math.max(0, run.shake - dt * 10);

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
  updateEnemies(dt);
  updatePickups(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateWorld(dt);
  updateHud();
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

function drawDrones() {
  if (game3DReady) return;
  entities.drones.forEach((d) => {
    drawShip(d.x, d.y, 0, "rgba(64,243,255,0.6)", "rgba(255,255,255,0.55)", 0.55);
  });
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
  drawCampaignObjects();
  drawPickups();
  drawEnemies();
  drawBullets();
  drawParticles();
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
  const dt = Math.min(0.033, (ts - lastTime) / 1000);
  lastTime = ts;

  if (state === STATE.RUN || state === STATE.PICK) {
    if (!paused) update(dt);
  }

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
    bootLoaderTextEl.textContent = "Initialization issue detected. You can still start.";
    bootStartBtn.disabled = false;
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

  // Hull (pseudoвЂ‘3D with gradient)
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
}
if (sideFullscreenBtn) {
  sideFullscreenBtn.addEventListener("click", () => toggleFullscreen(document.documentElement));
}

document.addEventListener("fullscreenchange", () => {
  setFullscreenButtonLabel();
});

if (!fullscreenKeybound) {
  fullscreenKeybound = true;
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
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
    await waitForAuthRestore();
    renderHangar();
    setState(STATE.HANGAR);
    return;
  }

  if (path === "/game/leaderboard") {
    renderLeaderboard("local");
    setState(STATE.LEADERBOARD);
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

function updateBootProgress(value, label) {
  BOOT.progress = clamp(value, 0, 100);
  bootLoaderFillEl.style.width = `${BOOT.progress}%`;
  if (label) bootLoaderTextEl.textContent = label;
}

async function prepareBoot() {
  try {
    bootStartBtn.disabled = false;
    updateBootProgress(22, "Loading interface...");
    await delay(90);
    updateBootProgress(56, "Calibrating controls...");
    await delay(90);
    updateBootProgress(82, "Linking mission data...");
    await delay(90);
    updateBootProgress(100, "Ready. Tap Start Mission");
    BOOT.complete = true;
  } catch (err) {
    console.error("[BOOT] prepare failed", err);
    updateBootProgress(100, "Ready. Tap Start Mission");
    bootStartBtn.disabled = false;
    BOOT.complete = true;
  }
}

async function beginPlayFromBoot() {
  if (BOOT.started) return;
  BOOT.started = true;
  bootStartBtn.disabled = true;
  bootLoaderTextEl.textContent = "Launching...";
  await runInitialRoute();
  bootLoaderEl.classList.add("bootLoader--done");
  setTimeout(() => {
    bootLoaderEl.classList.add("hidden");
    maybeOpenDailyRewardPopup(false);
  }, 260);
}

bootStartBtn.addEventListener("click", () => {
  beginPlayFromBoot().catch(() => {
    bootLoaderTextEl.textContent = "Start failed. Refresh and try again.";
    bootStartBtn.disabled = false;
    BOOT.started = false;
  });
});

// Fail-safe: never leave the player stuck on the loader.
setTimeout(() => {
  if (BOOT.complete) return;
  updateBootProgress(100, "Ready. Tap Start Mission");
  bootStartBtn.disabled = false;
  BOOT.complete = true;
}, 1200);

void prepareBoot();

requestAnimationFrame(gameLoop);


