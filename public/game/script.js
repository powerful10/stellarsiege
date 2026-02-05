/*
  Stellar Siege - Roguelite Arena

  Your clicks weren't working because `script.js` was missing from the folder,
  so the browser never loaded any handlers.

  This file is the whole game (client-only).
*/

console.log("[Stellar Siege] boot");

const $ = (id) => document.getElementById(id);

function isTouchDevice() {
  return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
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

function must(id) {
  const el = $(id);
  if (!el) throw new Error(`Missing element #${id} (check index.html)`);
  return el;
}

lockMobileZoom();

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

// Menu buttons
const playSurvivalBtn = must("playSurvivalBtn");
const playCampaignBtn = must("playCampaignBtn");
const hangarBtn = must("hangarBtn");
const leaderboardBtn = must("leaderboardBtn");
const onlineBtn = must("onlineBtn");
const menuFullscreenBtn = must("menuFullscreenBtn");
const infoBtn = must("infoBtn");

// Hangar UI
const pilotPillEl = must("pilotPill");
const backFromHangarBtn = must("backFromHangarBtn");
const statsBoxEl = must("statsBox");
const shipPickerEl = must("shipPicker");
const upgradeListEl = must("upgradeList");
const shipModelEl = must("shipModel");
const shipModelFallbackEl = must("shipModelFallback");
const buy100Btn = must("buy100");
const buy550Btn = must("buy550");
const convertBtn = must("convertBtn");

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
const finalRewardsEl = must("finalRewards");
const gameoverTitleEl = must("gameoverTitle");
const gameoverSubEl = must("gameoverSub");
const restartBtn = must("restartBtn");
const toMenuBtn = must("toMenuBtn");
const fsHintEl = must("fsHint");
const adRewardBoxEl = must("adRewardBox");
const adRewardTextEl = must("adRewardText");
const adRewardBtn = must("adRewardBtn");
const infoOverlayEl = must("infoOverlay");
const infoCloseBtn = must("infoCloseBtn");
const infoFullscreenBtn = must("infoFullscreenBtn");

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

// Canvas
const uiEl = must("ui");
const gameRootEl = document.getElementById("gameRoot") || uiEl.parentElement || document.body;
const canvas = must("game");
const ctx = canvas.getContext("2d");

let WORLD = { width: 960, height: 600 };

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

function setPaused(next) {
  paused = next;
}

function needsLandscape() {
  return window.matchMedia && window.matchMedia("(orientation: portrait)").matches;
}

function updateRotateOverlay() {
  const shouldBlock = (state === STATE.RUN || pendingStart) && needsLandscape();
  if (shouldBlock) {
    rotateReadyAt = 0;
  }
  rotateOverlayEl.classList.toggle("hidden", !shouldBlock);
  if (shouldBlock) setPaused(true);
  return !shouldBlock;
}

let pendingStart = null;
let rotateReadyAt = 0;

function updateTouchControlsVisibility() {
  if (!touchControlsEl) return;
  const show = state === STATE.RUN && (activeMode === MODE.SURVIVAL || activeMode === MODE.CAMPAIGN || activeMode === MODE.DUEL);
  touchControlsEl.classList.toggle("touchControls--active", show);
  touchControlsEl.classList.toggle("hidden", !show);
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
  updateTouchControlsVisibility();
  updateRotateOverlay();
}

function setTopAuthUi({ signedIn, displayName, photoUrl }) {
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

function renderAccountPanel() {
  cloudInit();

  if (!CLOUD.enabled) {
    accountBoxEl.innerHTML = `<div class="fine">Account features require Firebase config + hosting over http(s).</div>`;
    accountSyncBtn.disabled = true;
    accountSignOutBtn.disabled = true;
    return;
  }

  if (!CLOUD.user) {
    accountBoxEl.innerHTML = `<div class="fine">You are not signed in. Use “Sign in with Google”.</div>`;
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
    { label: "UID", value: `${String(u.uid || "").slice(0, 10)}<small>…</small>` },
    { label: "Level", value: `${levelFromXp(SAVE.profile.xp)}` },
    { label: "Credits", value: `${SAVE.profile.credits}` },
    { label: "Crystals", value: `${SAVE.profile.crystals}` },
    { label: "Ships", value: `${ownedShips}/${totalShips} owned` },
    { label: "Best Score", value: `${SAVE.profile.bestScore}` },
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
}

window.addEventListener("resize", resizeCanvas);
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

const SAVE_KEY = "stellar_siege_save_v4";

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
      campaignUnlocked: 1,
      selectedShipId: "scout",
      updatedAt: 0,
    },
    ships: {},
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
    rarity: "Free",
    priceCredits: 6500,
    priceCrystals: 0,
    base: {
      speed: 300,
      bulletSpeed: 590,
      damage: 1.08,
      fireRate: 0.14,
      shieldMax: 100,
      shieldRegen: 3.4,
      hullMax: 105,
      pierce: 0,
      droneCount: 0,
    },
  },
  {
    id: "ranger",
    name: "Ranger",
    rarity: "Earned",
    priceCredits: 22000,
    priceCrystals: 0,
    base: {
      speed: 305,
      bulletSpeed: 620,
      damage: 1.16,
      fireRate: 0.132,
      shieldMax: 112,
      shieldRegen: 3.6,
      hullMax: 118,
      pierce: 1,
      droneCount: 0,
    },
  },
  {
    id: "astra",
    name: "Astra",
    rarity: "Earned",
    priceCredits: 0,
    priceCrystals: 120,
    base: {
      speed: 315,
      bulletSpeed: 640,
      damage: 1.22,
      fireRate: 0.122,
      shieldMax: 108,
      shieldRegen: 3.5,
      hullMax: 112,
      pierce: 1,
      droneCount: 1,
    },
  },
  {
    id: "warden",
    name: "Warden",
    rarity: "Premium",
    priceCredits: 0,
    priceCrystals: 320,
    base: {
      speed: 292,
      bulletSpeed: 640,
      damage: 1.32,
      fireRate: 0.122,
      shieldMax: 132,
      shieldRegen: 4.2,
      hullMax: 132,
      pierce: 1,
      droneCount: 0,
    },
  },
  {
    id: "valkyrie",
    name: "Valkyrie",
    rarity: "Premium",
    priceCredits: 0,
    priceCrystals: 650,
    base: {
      speed: 325,
      bulletSpeed: 700,
      damage: 1.48,
      fireRate: 0.108,
      shieldMax: 140,
      shieldRegen: 4.4,
      hullMax: 140,
      pierce: 2,
      droneCount: 2,
    },
  },
];

const SHIP_STYLES = {
  scout: { main: "#1de2c4", accent: "#0ea5e9" },
  striker: { main: "#60a5fa", accent: "#93c5fd" },
  ranger: { main: "#34d399", accent: "#a7f3d0" },
  astra: { main: "#f472b6", accent: "#fbcfe8" },
  warden: { main: "#f59e0b", accent: "#fde68a" },
  valkyrie: { main: "#f97316", accent: "#fed7aa" },
};

function shipById(id) {
  return SHIPS.find((s) => s.id === id) || SHIPS[0];
}

const SHIP_MODELS = {
  scout: ["models/scout_t1.glb", "models/scout_t2.glb", "models/scout_t3.glb"],
  striker: ["models/striker_t1.glb", "models/striker_t2.glb", "models/striker_t3.glb"],
  ranger: ["models/ranger_t1.glb", "models/ranger_t2.glb", "models/ranger_t3.glb"],
  astra: ["models/astra_t1.glb", "models/astra_t2.glb", "models/astra_t3.glb"],
  warden: ["models/warden_t1.glb", "models/warden_t2.glb", "models/warden_t3.glb"],
  valkyrie: ["models/valkyrie_t1.glb", "models/valkyrie_t2.glb", "models/valkyrie_t3.glb"],
};

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
  const selected = SAVE.profile && SAVE.profile.selectedShipId ? SAVE.profile.selectedShipId : "scout";
  const exists = SHIPS.some((s) => s.id === selected);
  SAVE.profile.selectedShipId = exists ? selected : "scout";

  if (!SAVE.profile.updatedAt) SAVE.profile.updatedAt = 0;
  if (!Number.isFinite(Number(SAVE.profile.crystalsShadow))) SAVE.profile.crystalsShadow = SAVE.profile.crystals || 0;
  saveNow();
}

migrateSave();

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
  const eliteMult = 1 + u.elite * 0.06;
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
    cost: (lvl) => Math.floor(260 * Math.pow(1.38, lvl)),
  },
  {
    key: "fireRate",
    name: "Fire Rate",
    desc: "Shoot faster.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(300 * Math.pow(1.36, lvl)),
  },
  {
    key: "bulletSpeed",
    name: "Bullet Speed",
    desc: "Faster bullets hit more reliably.",
    currency: "credits",
    max: 8,
    cost: (lvl) => Math.floor(210 * Math.pow(1.35, lvl)),
  },
  {
    key: "shieldMax",
    name: "Shield Capacity",
    desc: "More shield HP.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(250 * Math.pow(1.37, lvl)),
  },
  {
    key: "shieldRegen",
    name: "Shield Regen",
    desc: "Shield regenerates faster.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(270 * Math.pow(1.35, lvl)),
  },
  {
    key: "hullMax",
    name: "Hull Plating",
    desc: "More hull HP.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(250 * Math.pow(1.37, lvl)),
  },
  {
    key: "thrusters",
    name: "Thrusters",
    desc: "Move faster.",
    currency: "credits",
    max: 10,
    cost: (lvl) => Math.floor(220 * Math.pow(1.34, lvl)),
  },
  {
    key: "pierce",
    name: "Piercing Core",
    desc: "Bullets pierce more targets.",
    currency: "crystals",
    max: 3,
    cost: (lvl) => Math.floor(80 * Math.pow(1.65, lvl)),
  },
  {
    key: "drone",
    name: "Drone Bay",
    desc: "Add an auto-firing drone.",
    currency: "crystals",
    max: 3,
    cost: (lvl) => Math.floor(95 * Math.pow(1.7, lvl)),
  },
  {
    key: "elite",
    name: "Elite Core",
    desc: "Crystal boost: increases most stats (pay-to-win).",
    currency: "crystals",
    max: 5,
    cost: (lvl) => Math.floor(140 * Math.pow(1.85, lvl)),
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

// If Firebase is configured and we're hosted, we treat progression/purchases as account-based.
// This keeps the "real" economy tied to a Google account (and lets you monetize safely).
function progressionRequiresAuth() {
  return isHosted() && hasFirebaseConfig();
}

// -----------------------------
// UI wiring (now your clicks work)
// -----------------------------

playSurvivalBtn.addEventListener("click", () => startRun(MODE.SURVIVAL));
playCampaignBtn.addEventListener("click", () => {
  renderCampaignMissions();
  setState(STATE.CAMPAIGN);
});
hangarBtn.addEventListener("click", () => {
  renderHangar();
  setState(STATE.HANGAR);
});
leaderboardBtn.addEventListener("click", () => {
  renderLeaderboard("local");
  setState(STATE.LEADERBOARD);
});
onlineBtn.addEventListener("click", () => {
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
    const modelList = SHIP_MODELS[s.id] || [];
    const modelPath = modelList[2] || modelList[0] || "";
    const card = document.createElement("div");
    card.className = "shipCard";
    card.innerHTML = `
      <div class="shipCard__header">
        <strong>${s.name}</strong>
        <span class="pill">${s.rarity}</span>
      </div>
      <model-viewer src="${modelPath}" camera-controls auto-rotate interaction-prompt="none" shadow-intensity="0.6"></model-viewer>
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

convertBtn.addEventListener("click", () => {
  cloudInit();
  if (progressionRequiresAuth() && !isAuthed()) {
    alert("Please sign in with Google before converting. (Account-based progression.)");
    setState(STATE.ONLINE);
    return;
  }

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

// Top-right auth + account panel
topSignInBtn.addEventListener("click", () => {
  onlineInit();
  setState(STATE.ONLINE);
});
topSignOutBtn.addEventListener("click", () => onlineSignOut());
topAccountBtn.addEventListener("click", () => {
  renderAccountPanel();
  setState(STATE.ACCOUNT);
});
closeAccountBtn.addEventListener("click", () => setState(STATE.MENU));
accountToOnlineBtn.addEventListener("click", () => {
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

// -----------------------------
// Game + UI implementation
// -----------------------------

pilotPillEl.addEventListener("click", () => {
  const next = prompt("Pilot name:", SAVE.profile.name);
  if (!next) return;
  SAVE.profile.name = next.slice(0, 18);
  saveNow();
  updateTopBar();
  renderHangar();
});

function renderHangar() {
  cloudInit();

  const authed = isAuthed();
  const payReady = isHosted(); // same-origin backend supported when PAYMENTS_API_BASE is empty
  const selectedShip = shipById(SAVE.profile.selectedShipId);
  const selectedState = ensureShipState(selectedShip.id);

  // Store gating: real money purchase requires hosting + backend + account.
  // Conversion is allowed only when signed in (or in local dev without Firebase).
  buy100Btn.disabled = !payReady || !authed;
  buy550Btn.disabled = !payReady || !authed;
  convertBtn.disabled = progressionRequiresAuth() ? !authed : false;

  // Ship picker
  shipPickerEl.innerHTML = "";
  SHIPS.forEach((s) => {
    const st = ensureShipState(s.id);
    const btn = document.createElement("button");
    btn.className = "shipBtn";
    if (s.id === selectedShip.id) btn.classList.add("shipBtn--active");
    if (!st.owned) btn.classList.add("shipBtn--locked");
    btn.textContent = s.name;
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

      // Locked ship: offer purchase if signed in.
      const costText = s.priceCrystals ? `${s.priceCrystals} crystals` : `${s.priceCredits} credits`;
      const ok = confirm(`Buy ${s.name} for ${costText}?`);
      if (!ok) return;

      if (!authed) {
        alert("Please sign in with Google first (Online -> Sign in). Purchases are account-based.");
        setState(STATE.ONLINE);
        return;
      }

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
      renderHangar();
      updateTopBar();
    });
    shipPickerEl.appendChild(btn);
  });

  // Ship model preview (tiered by upgrades)
  const tier = upgradeTier(selectedState.upgrades);
  const modelList = SHIP_MODELS[selectedShip.id] || [];
  const modelPath = modelList[tier];
  if (shipModelEl && shipModelFallbackEl) {
    if (modelPath) {
      shipModelEl.src = modelPath;
      shipModelEl.classList.remove("hidden");
      shipModelFallbackEl.classList.add("hidden");
    } else {
      shipModelEl.classList.add("hidden");
      shipModelFallbackEl.classList.remove("hidden");
    }
  }

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

  // Upgrades (account-based)
  upgradeListEl.innerHTML = "";

  if (!selectedState.owned) {
    upgradeListEl.innerHTML = `<div class="fine">This ship is locked. Buy it to upgrade.</div>`;
    return;
  }

  if (!authed) {
    upgradeListEl.innerHTML =
      `<div class="fine">Sign in with Google to upgrade ships and keep purchases synced across devices.</div>`;
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
            <div style="opacity:.7; font-size:12px">Wave ${e.wave} · ${e.date}</div>
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
  user: null,
  auth: null,
  firestore: null,
  rtdb: null,
  status: "Offline",
};

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

  if (!isHosted()) {
    alert("Purchases require hosting on http:// or https:// (not file://). Start the server and open http://localhost.");
    return;
  }

  cloudInit();
  if (!CLOUD.enabled || !CLOUD.user) {
    onlineHintEl.textContent = "Please sign in with Google before purchasing.";
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
    const text = await res.text();
    throw new Error(`Checkout failed: ${text}`);
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

  const hasSdk = typeof window.firebase !== "undefined";
  const hasConfig = hasFirebaseConfig();
  if (!hasSdk || !hasConfig) {
    CLOUD.enabled = false;
    CLOUD.status = "Offline (no Firebase config)";
    updateAuthUi();
    return;
  }
  if (!isHosted()) {
    CLOUD.enabled = false;
    CLOUD.status = "Offline (open via http://, not file://)";
    updateAuthUi();
    return;
  }

  try {
    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      window.firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    CLOUD.auth = window.firebase.auth();
    CLOUD.firestore = window.firebase.firestore();
    CLOUD.rtdb = window.firebase.database ? window.firebase.database() : null;
    CLOUD.enabled = true;
    CLOUD.status = "Ready";
    updateAuthUi();

    CLOUD.auth.onAuthStateChanged(async (user) => {
      CLOUD.user = user || null;
      await cloudOnAuthChanged();
    });
  } catch (err) {
    console.warn("[CLOUD] init failed", err);
    CLOUD.enabled = false;
    CLOUD.status = "Offline (Firebase init failed)";
    updateAuthUi();
  }
}

function cloudUserLabel() {
  if (!CLOUD.enabled) return CLOUD.status;
  if (!CLOUD.user) return "Signed out";
  return CLOUD.user.displayName || CLOUD.user.email || "Signed in";
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
    campaignUnlocked: Number(SAVE.profile.campaignUnlocked || 1),
    selectedShipId: SAVE.profile.selectedShipId || "scout",
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

async function cloudPullMerge() {
  const ref = cloudDocRef();
  if (!ref) return;
  const snap = await ref.once("value");
  if (!snap.exists) {
    // First-time user: seed cloud
    await ref.set(computeLocalSnapshot(), { merge: true });
    return;
  }

  const remote = snap.data() || {};
  const localUpdated = Number(SAVE.profile.updatedAt || 0);
  const remoteUpdated = Number(remote.profile && remote.profile.updatedAt ? remote.profile.updatedAt : 0);

  // Crystals are treated as cloud-authoritative (purchases are fulfilled server-side via Lemon Squeezy webhook).
  const remoteCrystals = Number(remote.profile && Number.isFinite(Number(remote.profile.crystals)) ? remote.profile.crystals : 0);
  SAVE.profile.crystals = remoteCrystals;
  SAVE.profile.crystalsShadow = remoteCrystals;

  // Prefer whichever is newer.
  if (remoteUpdated > localUpdated) {
    SAVE.profile = { ...SAVE.profile, ...(remote.profile || {}) };
    // Keep crystals authoritative even when merging remote -> local.
    SAVE.profile.crystals = remoteCrystals;
    SAVE.profile.crystalsShadow = remoteCrystals;
    SAVE.ships = mergeShips(SAVE.ships, remote.ships);
    migrateSave();
    saveNow();
    return;
  }

  // Local is newer: push local progress, but never increase crystals from the client.
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

async function cloudSubmitLeaderboard(entry) {
  if (!CLOUD.enabled || !CLOUD.firestore || !CLOUD.user) return;
  // Keep per-mode boards to simplify indexing/rules
  const col = CLOUD.firestore.collection("leaderboard_survival");
  await col.add({
    uid: CLOUD.user.uid,
    name: CLOUD.user.displayName || SAVE.profile.name,
    score: entry.score,
    wave: entry.wave,
    date: entry.date,
    createdAt: nowMs(),
  });
}

async function renderGlobalLeaderboard() {
  cloudInit();

  if (!CLOUD.enabled) {
    leaderboardListEl.innerHTML = `<div class="fine">Global leaderboard requires Firebase config + hosting over http(s).</div>`;
    return;
  }
  if (!CLOUD.user) {
    leaderboardListEl.innerHTML = `<div class="fine">Sign in with Google to see global rankings.</div>`;
    return;
  }

  leaderboardListEl.innerHTML = `<div class="fine">Loading global leaderboard…</div>`;
  try {
    const q = await CLOUD.firestore
      .collection("leaderboard_survival")
      .orderBy("score", "desc")
      .limit(10)
      .get();
    const rows = q.docs.map((d) => d.data());
    if (rows.length === 0) {
      leaderboardListEl.innerHTML = `<div class="fine">No global scores yet. Play Survival and finish a run.</div>`;
      return;
    }
    leaderboardListEl.innerHTML = rows
      .map((e, i) => {
        return `
          <div class="lbRow">
            <div class="lbRank">#${i + 1}</div>
            <div>
              <div class="lbName">${e.name || "Pilot"} <span style="opacity:.6">(S)</span></div>
              <div style="opacity:.7; font-size:12px">Wave ${e.wave || 1}</div>
            </div>
            <div class="lbScore">${e.score || 0}</div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.warn("[CLOUD] leaderboard load failed", err);
    leaderboardListEl.innerHTML = `<div class="fine">Failed to load global leaderboard.</div>`;
  }
}

async function cloudOnAuthChanged() {
  updateAuthUi();
  if (CLOUD.user) {
    // Auto-sync + set pilot name from Google if local is default
    if (SAVE.profile.name && SAVE.profile.name.startsWith("Pilot-") && CLOUD.user.displayName) {
      SAVE.profile.name = CLOUD.user.displayName.slice(0, 18);
      saveNow();
    }
    await cloudPullMerge();
    updateTopBar();
    renderHangar();
  }
}

function updateAuthUi() {
  authStatusEl.textContent = cloudUserLabel();
  googleSignInBtn.disabled = !CLOUD.enabled;
  signOutBtn.disabled = !CLOUD.enabled || !CLOUD.user;

  const canOnline = Boolean(CLOUD.enabled && CLOUD.user && CLOUD.rtdb);
  createRoomBtn.disabled = !canOnline;
  joinRoomBtn.disabled = !canOnline;
  startDuelBtn.disabled = false; // starts online if room is ready, otherwise practice duel

  if (!CLOUD.enabled) {
    onlineHintEl.textContent = CLOUD.status;
    topSignInBtn.disabled = false;
    topSignInBtn.title = "Sign-in requires Firebase config + hosting over http(s). Click to see Online setup.";
    setTopAuthUi({ signedIn: false });
    return;
  }
  if (!CLOUD.user) {
    onlineHintEl.textContent = "Sign in to enable cloud saves, store purchases, and online duels.";
    topSignInBtn.disabled = false;
    topSignInBtn.title = "";
    setTopAuthUi({ signedIn: false });
    return;
  }
  if (!CLOUD.rtdb) {
    onlineHintEl.textContent = "Realtime Database not available. Enable RTDB in Firebase + add databaseURL to FIREBASE_CONFIG.";
    topSignInBtn.disabled = false;
    topSignInBtn.title = "";
    setTopAuthUi({ signedIn: true, displayName: CLOUD.user.displayName, photoUrl: CLOUD.user.photoURL });
    return;
  }
  onlineHintEl.textContent = "Signed in. Create or join a room to play a real online duel.";
  topSignInBtn.disabled = false;
  topSignInBtn.title = "";
  setTopAuthUi({ signedIn: true, displayName: CLOUD.user.displayName, photoUrl: CLOUD.user.photoURL });
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
    .join(" · ");
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
        <span style="opacity:.65">·</span>
        <span>Reward ~${500 + m.id * 120} credits</span>
        <span style="opacity:.65">·</span>
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

  return parts.join(" · ");
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

function onlineEnabled() {
  return Boolean(CLOUD.enabled && CLOUD.user && CLOUD.rtdb);
}

function randomRoomCode(len = 6) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
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
    onlineHintEl.textContent = !CLOUD.enabled
      ? "Online requires Firebase config + hosting over http(s)."
      : "Sign in with Google to create a room.";
    return;
  }

  const code = randomRoomCode(6);
  const uid = CLOUD.user.uid;
  const shipId = SAVE.profile.selectedShipId || "scout";

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
        name: SAVE.profile.name,
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
    onlineHintEl.textContent = !CLOUD.enabled
      ? "Online requires Firebase config + hosting over http(s)."
      : "Sign in with Google to join a room.";
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
      name: SAVE.profile.name,
      shipId,
      joinedAt: nowMs(),
    });
  } else {
    // Re-join as host: ensure host player entry exists.
    await ref.child("players/host").update({ uid, name: SAVE.profile.name, shipId });
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
    const hostReady = Boolean(v.players && v.players.host && v.players.host.uid);
    const guestReady = Boolean(v.players && v.players.guest && v.players.guest.uid);
    const status = v.status || "waiting";
    const who = hostReady && guestReady ? "2/2 players" : hostReady ? "1/2 players" : "0/2 players";
    onlineHintEl.textContent = `Room ${ONLINE_SESSION.roomCode} · ${who} · ${status}`;

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
    // Spawn remote bullet locally.
    spawnBullet({
      x: ev.x,
      y: ev.y,
      vx: ev.vx,
      vy: ev.vy,
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
    onlineHintEl.textContent = "Waiting for host to start the duel…";
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

  // Best-effort: refresh opponent ship color based on their selected ship.
  const opp = room && room.players && room.players[ONLINE_SESSION.opponentRole] ? room.players[ONLINE_SESSION.opponentRole] : null;
  const enemy = entities.enemies.find((e) => e.type === "pvp");
  if (enemy && opp && opp.shipId) {
    const ship = shipById(opp.shipId);
    enemy.color = ship && ship.rarity === "Premium" ? "#ff7ad9" : "#40f3ff";
  }
}

function isOnlineDuelActive() {
  return run.active && run.mode === MODE.DUEL && run.duel && run.duel.kind === "online" && Boolean(ONLINE_SESSION.roomRef);
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
  const tx = Number(st.x);
  const ty = Number(st.y);
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
  runUpgrades: {},
  duel: {
    kind: "ai", // "ai" | "online"
    roomCode: "",
    role: "",
    opponentRole: "",
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
  survival: { seconds: 20, credits: 150, crystals: 0, xp: 120 },
  campaign: { seconds: 40, credits: 350, crystals: 1, xp: 260 },
  duel: { seconds: 60, credits: 700, crystals: 2, xp: 420 },
};

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
  run.runUpgrades = {};
  run.duel = {
    kind: "ai",
    roomCode: "",
    role: "",
    opponentRole: "",
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
  const maxHp = type.hp(wave);
  entities.enemies.push({
    id: Math.random().toString(16).slice(2),
    type: typeKey,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: maxHp,
    maxHp,
    speed: type.speed(wave),
    size: type.size,
    color: type.color,
    fire: rand(0, 0.7),
    orbit: rand(-1, 1),
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
      run.waveRemaining = 10 + Math.floor(run.wave * 2.2);
      run.score += 50;
      if (run.wave % 5 === 0) {
        run.bossAlive = true;
        spawnEnemy("boss");
      }
    }
  }

  entities.enemies = entities.enemies.filter((e) => e.id !== enemy.id);
}

function endRun(reason) {
  run.active = false;
  player.alive = false;
  onlineDuelReportEnd(reason);

  const keepRewards = !progressionRequiresAuth() || isAuthed();

  // Economy: credits are grindable, crystals are rare (mostly purchases + a small earnable trickle).
  const baseCredits = Math.floor(run.score * 0.12) + run.wave * 16;
  const baseXp = Math.floor(run.score * 0.16) + run.wave * 14;
  let crystals = 0;
  if (Math.random() < 0.06) crystals = 1;
  if (run.wave >= 12 && Math.random() < 0.08) crystals += 1;
  if (reason === "duel_win") crystals += 1;

  let credits = baseCredits;
  let xp = baseXp;
  let unlockNextMission = false;
  if (run.mode === MODE.CAMPAIGN && run.campaign.completed) {
    credits += 380 + run.campaign.missionId * 90;
    xp += 140 + run.campaign.missionId * 30;
    crystals += 1; // campaign completion always gives a small crystal reward
    unlockNextMission = true;
  }

  const entry = {
    name: SAVE.profile.name,
    score: Math.floor(run.score),
    wave: run.wave,
    mode: run.mode,
    date: new Date().toISOString().slice(0, 10),
  };

  if (keepRewards) {
    if (unlockNextMission) {
      SAVE.profile.campaignUnlocked = Math.max(SAVE.profile.campaignUnlocked, run.campaign.missionId + 1);
    }
    SAVE.profile.credits += credits;
    SAVE.profile.crystals += crystals;
    // Shadow must never be below the actual balance after spending/earning.
    SAVE.profile.crystalsShadow = Math.max(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
    SAVE.profile.xp += xp;

    if (run.score > SAVE.profile.bestScore) SAVE.profile.bestScore = Math.floor(run.score);
    if (run.wave > SAVE.profile.bestWave) SAVE.profile.bestWave = run.wave;

    SAVE.leaderboard.unshift(entry);
    SAVE.leaderboard = SAVE.leaderboard.sort((a, b) => b.score - a.score).slice(0, 15);

    // Mark local profile updated (used for cloud conflict resolution)
    SAVE.profile.updatedAt = nowMs();
    saveNow();
    updateTopBar();

    // Optional: cloud sync
    if (CLOUD.enabled && CLOUD.user) {
      cloudPush().catch((err) => console.warn("[CLOUD] save failed", err));
      if (run.mode === MODE.SURVIVAL) {
        cloudSubmitLeaderboard(entry).catch((err) => console.warn("[CLOUD] leaderboard submit failed", err));
      }
    }
  }

  finalScoreEl.textContent = entry.score;
  finalWaveEl.textContent = entry.wave;
  finalRewardsEl.textContent = keepRewards
    ? `${credits} credits, ${crystals} crystals, ${xp} xp`
    : `${credits} credits, ${crystals} crystals, ${xp} xp (not saved - sign in to keep rewards)`;

  // Gameover header + win messaging.
  gameoverSubEl.textContent = "";
  if (reason === "campaign_complete") {
    const nextId = (run.campaign && run.campaign.missionId ? run.campaign.missionId : 1) + 1;
    gameoverTitleEl.textContent = "You Win!";
    if (keepRewards) {
      gameoverSubEl.textContent = `Mission complete. Next mission unlocked: M${nextId}`;
    } else {
      gameoverSubEl.textContent = "Mission complete. Sign in to unlock the next mission and keep rewards.";
    }
  } else if (reason === "duel_win") {
    gameoverTitleEl.textContent = "Victory!";
    gameoverSubEl.textContent = "Duel won.";
  } else if (reason === "dead") {
    gameoverTitleEl.textContent = "Signal Lost";
  } else {
    gameoverTitleEl.textContent = "Signal Lost";
  }

  setState(STATE.OVER);
  renderAdReward(reason);
}

function renderAdReward(reason) {
  if (!adRewardBoxEl || !adRewardBtn || !adRewardTextEl) return;
  const modeKey = run.mode === MODE.SURVIVAL ? "survival" : run.mode === MODE.CAMPAIGN ? "campaign" : "duel";
  const cfg = AD_REWARDS[modeKey];
  adRewardBoxEl.classList.remove("hidden");
  adRewardBtn.disabled = false;
  adRewardBtn.textContent = "Watch Ad";
  adRewardTextEl.textContent = `Watch a ${cfg.seconds}s ad for +${cfg.credits} credits, +${cfg.crystals} crystals, +${cfg.xp} xp.`;

  if (run.adRewardClaimed) {
    adRewardBtn.disabled = true;
    adRewardBtn.textContent = "Claimed";
    return;
  }

  adRewardBtn.onclick = () => {
    if (run.adRewardClaimed) return;
    run.adRewardClaimed = true;
    let remaining = cfg.seconds;
    adRewardBtn.disabled = true;
    adRewardBtn.textContent = `Ad: ${remaining}s`;
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        grantAdReward(cfg);
        adRewardBtn.textContent = "Reward Granted";
      } else {
        adRewardBtn.textContent = `Ad: ${remaining}s`;
      }
    }, 1000);
  };
}

function grantAdReward(cfg) {
  if (!cfg) return;
  const keepRewards = !progressionRequiresAuth() || isAuthed();
  if (!keepRewards) {
    adRewardTextEl.textContent = "Sign in to keep ad rewards.";
    return;
  }
  SAVE.profile.credits += cfg.credits;
  SAVE.profile.crystals += cfg.crystals;
  SAVE.profile.crystalsShadow = Math.max(SAVE.profile.crystalsShadow || 0, SAVE.profile.crystals);
  SAVE.profile.xp += cfg.xp;
  SAVE.profile.updatedAt = nowMs();
  saveNow();
  updateTopBar();
  if (CLOUD.enabled && CLOUD.user) cloudPush().catch(() => {});
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
  if (needsLandscape()) {
    rotateReadyAt = 0;
    return;
  }
  if (!rotateReadyAt) rotateReadyAt = Date.now() + 3000;
  if (Date.now() >= rotateReadyAt) {
    const { mode, options } = pendingStart;
    pendingStart = null;
    rotateReadyAt = 0;
    rotateOverlayEl.classList.add("hidden");
    setPaused(false);
    startRun(mode, options);
  }
}

function guardStartRun(mode, options) {
  if (needsLandscape()) {
    pendingStart = { mode, options };
    updateRotateOverlay();
    return false;
  }
  return true;
}

function startRun(mode, options = {}) {
  if (!guardStartRun(mode, options)) return;
  showFullscreenHint();
  activeMode = mode;
  run.adRewardClaimed = false;

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
      const hp = opp ? `${Math.max(0, Math.ceil(opp.hp))}/${Math.ceil(opp.maxHp)}` : "—";
      objectiveEl.textContent = `Defeat opponent (${hp})`;
    } else {
      const duelist = entities.enemies.find((e) => e.type === "duelist");
      const hp = duelist ? `${Math.max(0, Math.ceil(duelist.hp))}/${Math.ceil(duelist.maxHp)}` : "—";
      objectiveEl.textContent = `Defeat duelist (${hp})`;
    }
  } else {
    const nextBoss = run.bossAlive ? "Boss fight!" : `Next boss: W${Math.ceil(run.wave / 5) * 5}`;
    objectiveEl.textContent = `Survive · ${nextBoss}`;
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
    const ramp = Math.floor(run.time / 35);
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
    const desired = 3 + Math.floor(run.wave * 0.6);
    if (!run.bossAlive && entities.enemies.length < desired) {
      const roll = Math.random();
      let type = "drone";
      if (run.wave >= 4 && roll > 0.7) type = "fighter";
      if (run.wave >= 7 && roll > 0.85) type = "sniper";
      if (run.wave >= 10 && roll > 0.9) type = "rammer";
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
      tx = (dx / dist) * push + (-dy / dist) * e.orbit * 0.6;
      ty = (dy / dist) * push + (dx / dist) * e.orbit * 0.6;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
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
      const dmg = Math.round(base * scaler);

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
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    drawShip(e.x, e.y, angle, e.color, "rgba(255,255,255,0.5)", e.type === "boss" ? 1.5 : 1);

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
  ctx.globalCompositeOperation = "lighter";
  entities.bullets.forEach((b) => {
    const alpha = clamp(b.life / 1.4, 0, 1);
    ctx.fillStyle =
      b.team === "player"
        ? `rgba(64, 243, 255, ${0.65 * alpha})`
        : `rgba(255, 93, 125, ${0.7 * alpha})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 2, 0, TAU);
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
  entities.drones.forEach((d) => {
    drawShip(d.x, d.y, 0, "rgba(64,243,255,0.6)", "rgba(255,255,255,0.55)", 0.55);
  });
}

function drawPlayerShip() {
  drawFancyPlayerShip();
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
updateTopBar();
setState(STATE.MENU);
updateHud();
updateRotateOverlay();
updateTouchControlsVisibility();
if (!fullscreenCleanup) fullscreenCleanup = setupFullscreenToggle({ element: document.documentElement });
setFullscreenButtonLabel();

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

  // Hull (pseudo‑3D with gradient)
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
          onlineHintEl.textContent = "Purchase complete. Crystals added to your cloud profile.";
        })
        .catch(() => {
          onlineHintEl.textContent = "Purchase complete. Please open Online -> sign in to sync crystals.";
        });
    } else {
      onlineHintEl.textContent = "Purchase complete. Please sign in to sync crystals to your account.";
    }
  } else if (purchase === "cancel") {
    window.history.replaceState({}, document.title, window.location.pathname);
    onlineHintEl.textContent = "Purchase canceled.";
  }
} catch {
  // ignore
}

requestAnimationFrame(gameLoop);
