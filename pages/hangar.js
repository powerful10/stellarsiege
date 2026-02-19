import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

const STORAGE_KEYS = {
  credits: "credits",
  crystals: "crystals",
  ownedShips: "ownedShips",
  selectedShip: "selectedShip",
  shipUpgrades: "shipUpgrades",
};

const LEGACY_SAVE_KEY = "stellar_siege_save_v5";
const HOME_ROUTE = "/game/index.html";

const SHIPS = [
  { id: "scout", name: "Scout", role: "Starter", priceCredits: 0, priceCrystals: 0 },
  { id: "striker", name: "Striker", role: "Balanced", priceCredits: 6400, priceCrystals: 0 },
  { id: "tank", name: "Tank", role: "Armor", priceCredits: 9800, priceCrystals: 0 },
  { id: "sniper", name: "Sniper", role: "Precision", priceCredits: 16800, priceCrystals: 0 },
  { id: "bomber", name: "Bomber", role: "Burst", priceCredits: 23500, priceCrystals: 70 },
  { id: "interceptor", name: "Interceptor", role: "Speed", priceCredits: 36000, priceCrystals: 0 },
  { id: "drone_carrier", name: "Drone Carrier", role: "Control", priceCredits: 52000, priceCrystals: 135 },
  { id: "stealth", name: "Stealth", role: "Advanced", priceCredits: 79000, priceCrystals: 190 },
  { id: "warden", name: "Warden", role: "Epic", priceCredits: 125000, priceCrystals: 260 },
  { id: "valkyrie", name: "Valkyrie", role: "Legendary", priceCredits: 0, priceCrystals: 480 },
  { id: "nova_revenant", name: "Nova Revenant", role: "Mythic", priceCredits: 250000, priceCrystals: 900 },
];

const SHIP_LOOKUP = SHIPS.reduce((acc, ship) => {
  acc[ship.id] = ship;
  return acc;
}, {});

const UPGRADE_DEFS = [
  { key: "damage", label: "Damage", baseCost: 450, growth: 1.48, maxLevel: 20 },
  { key: "fireRate", label: "Fire Rate", baseCost: 520, growth: 1.5, maxLevel: 20 },
  { key: "armor", label: "Armor", baseCost: 600, growth: 1.52, maxLevel: 20 },
];

const UPGRADE_LOOKUP = UPGRADE_DEFS.reduce((acc, upgrade) => {
  acc[upgrade.key] = upgrade;
  return acc;
}, {});

const EMPTY_UPGRADES = Object.freeze({
  damage: 0,
  fireRate: 0,
  armor: 0,
});

function buildDefaultShipUpgrades() {
  const out = {};
  SHIPS.forEach((ship) => {
    out[ship.id] = { ...EMPTY_UPGRADES };
  });
  return out;
}

function clampInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function parseJson(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOwnedShips(input) {
  const next = [];
  const push = (id) => {
    if (!SHIP_LOOKUP[id]) return;
    if (next.includes(id)) return;
    next.push(id);
  };
  push("scout");
  if (Array.isArray(input)) {
    input.forEach((id) => push(String(id || "")));
  }
  if (!next.length) next.push("scout");
  return next;
}

function normalizeUpgradeRecord(value) {
  if (!isObject(value)) return { ...EMPTY_UPGRADES };
  return {
    damage: clampInt(value.damage, 0),
    fireRate: clampInt(value.fireRate, 0),
    armor: clampInt(value.armor, 0),
  };
}

function buildDefaultState() {
  return {
    credits: 0,
    crystals: 0,
    ownedShips: ["scout"],
    selectedShip: "scout",
    shipUpgrades: buildDefaultShipUpgrades(),
  };
}

function readLegacyState() {
  try {
    const raw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return null;

    const profile = isObject(parsed.profile) ? parsed.profile : {};
    const ships = isObject(parsed.ships) ? parsed.ships : {};

    const ownedShips = normalizeOwnedShips(
      Object.keys(ships).filter((shipId) => isObject(ships[shipId]) && ships[shipId].owned === true)
    );

    const selectedCandidate = String(profile.selectedShipId || "scout");
    const selectedShip = ownedShips.includes(selectedCandidate) ? selectedCandidate : ownedShips[0];

    const shipUpgrades = buildDefaultShipUpgrades();
    Object.keys(shipUpgrades).forEach((shipId) => {
      const shipState = isObject(ships[shipId]) ? ships[shipId] : {};
      const upgrades = isObject(shipState.upgrades) ? shipState.upgrades : {};
      shipUpgrades[shipId] = {
        damage: clampInt(upgrades.damage, 0),
        fireRate: clampInt(upgrades.fireRate, 0),
        armor: Math.max(clampInt(upgrades.hullMax, 0), clampInt(upgrades.shieldMax, 0)),
      };
    });

    return {
      credits: clampInt(profile.credits, 0),
      crystals: clampInt(profile.crystals, 0),
      ownedShips,
      selectedShip,
      shipUpgrades,
    };
  } catch {
    return null;
  }
}

function loadHangarState() {
  const fallback = buildDefaultState();
  if (typeof window === "undefined") return fallback;

  let rawCredits = null;
  let rawCrystals = null;
  let rawOwnedShips = null;
  let rawSelectedShip = null;
  let rawShipUpgrades = null;
  try {
    rawCredits = localStorage.getItem(STORAGE_KEYS.credits);
    rawCrystals = localStorage.getItem(STORAGE_KEYS.crystals);
    rawOwnedShips = localStorage.getItem(STORAGE_KEYS.ownedShips);
    rawSelectedShip = localStorage.getItem(STORAGE_KEYS.selectedShip);
    rawShipUpgrades = localStorage.getItem(STORAGE_KEYS.shipUpgrades);
  } catch {
    return fallback;
  }
  const hasHangarState =
    rawCredits != null ||
    rawCrystals != null ||
    rawOwnedShips != null ||
    rawSelectedShip != null ||
    rawShipUpgrades != null;

  const seed = hasHangarState ? fallback : readLegacyState() || fallback;
  const credits = rawCredits == null ? seed.credits : clampInt(rawCredits, seed.credits);
  const crystals = rawCrystals == null ? seed.crystals : clampInt(rawCrystals, seed.crystals);

  const ownedShipsInput = rawOwnedShips == null ? seed.ownedShips : parseJson(rawOwnedShips, seed.ownedShips);
  const ownedShips = normalizeOwnedShips(ownedShipsInput);

  const selectedCandidate = rawSelectedShip == null ? seed.selectedShip : String(rawSelectedShip || "");
  const selectedShip = ownedShips.includes(selectedCandidate) ? selectedCandidate : ownedShips[0];

  const shipUpgradesInput =
    rawShipUpgrades == null ? seed.shipUpgrades : parseJson(rawShipUpgrades, seed.shipUpgrades);
  const shipUpgrades = buildDefaultShipUpgrades();
  SHIPS.forEach((ship) => {
    const shipRecord = isObject(shipUpgradesInput) ? shipUpgradesInput[ship.id] : null;
    shipUpgrades[ship.id] = normalizeUpgradeRecord(shipRecord);
  });

  return {
    credits,
    crystals,
    ownedShips,
    selectedShip,
    shipUpgrades,
  };
}

function persistHangarState(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.credits, String(clampInt(state.credits, 0)));
    localStorage.setItem(STORAGE_KEYS.crystals, String(clampInt(state.crystals, 0)));
    localStorage.setItem(STORAGE_KEYS.ownedShips, JSON.stringify(normalizeOwnedShips(state.ownedShips)));
    localStorage.setItem(STORAGE_KEYS.selectedShip, String(state.selectedShip || "scout"));
    localStorage.setItem(STORAGE_KEYS.shipUpgrades, JSON.stringify(state.shipUpgrades || {}));
  } catch {
    // Ignore storage errors; keep UI usable even in private mode / quota issues.
  }
}

function syncLegacySave(state) {
  try {
    const raw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return;

    const profile = isObject(parsed.profile) ? { ...parsed.profile } : {};
    profile.credits = clampInt(state.credits, 0);
    profile.crystals = clampInt(state.crystals, 0);
    profile.selectedShipId = state.selectedShip;
    profile.updatedAt = Date.now();

    const ships = isObject(parsed.ships) ? { ...parsed.ships } : {};
    SHIPS.forEach((ship) => {
      const shipState = isObject(ships[ship.id]) ? { ...ships[ship.id] } : {};
      const previousUpgrades = isObject(shipState.upgrades) ? { ...shipState.upgrades } : {};
      const upgrades = normalizeUpgradeRecord(state.shipUpgrades[ship.id]);
      ships[ship.id] = {
        ...shipState,
        owned: state.ownedShips.includes(ship.id),
        upgrades: {
          ...previousUpgrades,
          damage: upgrades.damage,
          fireRate: upgrades.fireRate,
          hullMax: upgrades.armor,
          shieldMax: upgrades.armor,
        },
      };
    });

    localStorage.setItem(
      LEGACY_SAVE_KEY,
      JSON.stringify({
        ...parsed,
        profile,
        ships,
      })
    );
  } catch {
    // Ignore legacy sync errors.
  }
}

function formatCount(value) {
  return clampInt(value, 0).toLocaleString("en-US");
}

function buildShipCostText(ship) {
  if (!ship.priceCredits && !ship.priceCrystals) return "Free unlock";
  const chunks = [];
  if (ship.priceCredits > 0) chunks.push(`${formatCount(ship.priceCredits)} credits`);
  if (ship.priceCrystals > 0) chunks.push(`${formatCount(ship.priceCrystals)} crystals`);
  return chunks.join(" + ");
}

function upgradeCost(upgrade, level) {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.growth, level));
}

export default function HangarPage() {
  const router = useRouter();
  const toastTimerRef = useRef(null);

  const [hydrated, setHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [credits, setCredits] = useState(0);
  const [crystals, setCrystals] = useState(0);
  const [ownedShips, setOwnedShips] = useState(["scout"]);
  const [selectedShip, setSelectedShip] = useState("scout");
  const [shipUpgrades, setShipUpgrades] = useState(buildDefaultShipUpgrades);

  useEffect(() => {
    const initial = loadHangarState();
    setCredits(initial.credits);
    setCrystals(initial.crystals);
    setOwnedShips(initial.ownedShips);
    setSelectedShip(initial.selectedShip);
    setShipUpgrades(initial.shipUpgrades);
    setHydrated(true);
  }, []);

  const snapshot = useMemo(
    () => ({
      credits,
      crystals,
      ownedShips,
      selectedShip,
      shipUpgrades,
    }),
    [credits, crystals, ownedShips, selectedShip, shipUpgrades]
  );

  useEffect(() => {
    if (!hydrated) return;
    persistHangarState(snapshot);
    syncLegacySave(snapshot);
  }, [hydrated, snapshot]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((text) => {
    setToastMessage(text);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
    }, 2200);
  }, []);

  const selectedShipData = useMemo(() => SHIP_LOOKUP[selectedShip] || SHIPS[0], [selectedShip]);
  const selectedIsOwned = ownedShips.includes(selectedShipData.id);
  const selectedUpgrades = normalizeUpgradeRecord(shipUpgrades[selectedShipData.id]);

  const handleBack = useCallback(() => {
    let target = HOME_ROUTE;
    try {
      const params = new URLSearchParams(window.location.search);
      const query = [];
      if (params.get("portal") === "1") query.push("portal=1");
      if (params.get("dev") === "1") query.push("dev=1");
      if (query.length) target = `${HOME_ROUTE}?${query.join("&")}`;
    } catch {
      // Keep default route if query parsing fails.
    }

    router.push(target).catch(() => {
      window.location.assign(target);
    });
  }, [router]);

  const handleShipAction = useCallback(
    (ship) => {
      const isOwned = ownedShips.includes(ship.id);
      if (isOwned) {
        if (selectedShip !== ship.id) {
          setSelectedShip(ship.id);
          showToast(`${ship.name} selected.`);
        }
        return;
      }

      if (credits < ship.priceCredits || crystals < ship.priceCrystals) {
        showToast("Not enough resources to unlock this ship.");
        return;
      }

      setCredits((value) => value - ship.priceCredits);
      setCrystals((value) => value - ship.priceCrystals);
      setOwnedShips((value) => normalizeOwnedShips([...value, ship.id]));
      setSelectedShip(ship.id);
      showToast(`${ship.name} unlocked.`);
    },
    [credits, crystals, ownedShips, selectedShip, showToast]
  );

  const handleUpgrade = useCallback(
    (upgradeKey) => {
      const upgradeDef = UPGRADE_LOOKUP[upgradeKey];
      if (!upgradeDef) return;

      if (!selectedIsOwned) {
        showToast("Unlock the ship before upgrading.");
        return;
      }

      const current = normalizeUpgradeRecord(shipUpgrades[selectedShipData.id])[upgradeDef.key];
      if (current >= upgradeDef.maxLevel) {
        showToast(`${upgradeDef.label} is already max level.`);
        return;
      }

      const cost = upgradeCost(upgradeDef, current);
      if (credits < cost) {
        showToast("Not enough credits for this upgrade.");
        return;
      }

      setCredits((value) => value - cost);
      setShipUpgrades((previous) => {
        const next = { ...previous };
        const shipLevels = normalizeUpgradeRecord(next[selectedShipData.id]);
        next[selectedShipData.id] = {
          ...shipLevels,
          [upgradeDef.key]: shipLevels[upgradeDef.key] + 1,
        };
        return next;
      });
      showToast(`${upgradeDef.label} upgraded to level ${current + 1}.`);
    },
    [credits, selectedIsOwned, selectedShipData.id, shipUpgrades, showToast]
  );

  return (
    <>
      <Head>
        <title>Stellar Siege Hangar</title>
        <meta
          name="description"
          content="Manage ships and upgrades in the Stellar Siege Hangar. Guest mode is fully supported with local save."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://stellarsiege.vercel.app/hangar" />
      </Head>

      <main className="hangarPage">
        <header className="topBar">
          <button type="button" className="backButton" onClick={handleBack}>
            Back
          </button>
          <div className="wallet" aria-label="Wallet">
            <div className="walletItem">
              <span className="walletLabel">Credits</span>
              <strong>{formatCount(credits)}</strong>
            </div>
            <div className="walletItem">
              <span className="walletLabel">Crystals</span>
              <strong>{formatCount(crystals)}</strong>
            </div>
          </div>
        </header>

        <section className="contentGrid">
          <article className="panel">
            <h1>Hangar</h1>
            <p className="panelLead">Guest mode active. Progress saves locally on this device.</p>
            <div id="hangarPreviewStage" className="previewStage" aria-label="Ship preview placeholder">
              <div className="previewCore">
                <div className="previewLabel">3D Preview Slot</div>
                <div className="previewShipName">{selectedShipData.name}</div>
                <div className="previewShipRole">{selectedShipData.role}</div>
                <div className="previewHint">Three.js preview container is ready for future integration.</div>
              </div>
            </div>
          </article>

          <article className="panel">
            <h2>Ships</h2>
            <div className="shipList" role="list">
              {SHIPS.map((ship) => {
                const isOwned = ownedShips.includes(ship.id);
                const isSelected = selectedShip === ship.id;
                return (
                  <div
                    key={ship.id}
                    role="listitem"
                    className={`shipCard${isSelected ? " shipCardSelected" : ""}${isOwned ? "" : " shipCardLocked"}`}
                  >
                    <div className="shipRow">
                      <div>
                        <div className="shipName">{ship.name}</div>
                        <div className="shipRole">{ship.role}</div>
                      </div>
                      <span className={`shipState ${isOwned ? "shipStateUnlocked" : "shipStateLocked"}`}>
                        {isOwned ? "Unlocked" : "Locked"}
                      </span>
                    </div>
                    <div className="shipCost">{isOwned ? "Ready for battle" : `Unlock: ${buildShipCostText(ship)}`}</div>
                    <button
                      type="button"
                      className="primaryAction"
                      onClick={() => handleShipAction(ship)}
                      disabled={isSelected && isOwned}
                    >
                      {isOwned ? (isSelected ? "Selected" : "Select") : "Unlock"}
                    </button>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel">
            <h2>Upgrades</h2>
            <div className="upgradeHeader">
              <span>Selected ship:</span>
              <strong>{selectedShipData.name}</strong>
            </div>
            {!selectedIsOwned ? <p className="warning">Unlock this ship before upgrading.</p> : null}
            <div className="upgradeList">
              {UPGRADE_DEFS.map((upgradeDef) => {
                const level = selectedUpgrades[upgradeDef.key];
                const cost = upgradeCost(upgradeDef, level);
                const isMaxed = level >= upgradeDef.maxLevel;
                const disabled = !selectedIsOwned || isMaxed || credits < cost;
                return (
                  <div key={upgradeDef.key} className="upgradeRow">
                    <div>
                      <div className="upgradeName">{upgradeDef.label}</div>
                      <div className="upgradeMeta">
                        Level {level}/{upgradeDef.maxLevel}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="primaryAction"
                      onClick={() => handleUpgrade(upgradeDef.key)}
                      disabled={disabled}
                    >
                      {isMaxed ? "Maxed" : `Upgrade - ${formatCount(cost)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <div className={`toast${toastMessage ? " toastVisible" : ""}`} role="status" aria-live="polite">
          {toastMessage}
        </div>
      </main>

      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          background: #050d21;
          color: #e8ecff;
          font-family: "Segoe UI", Tahoma, sans-serif;
        }
      `}</style>

      <style jsx>{`
        .hangarPage {
          min-height: 100vh;
          padding: 12px 12px 92px;
          background:
            radial-gradient(circle at 14% 0%, rgba(64, 170, 255, 0.2), transparent 45%),
            radial-gradient(circle at 88% 12%, rgba(0, 245, 200, 0.15), transparent 36%),
            #050d21;
          color: #e8ecff;
        }
        .topBar {
          position: sticky;
          top: 0;
          z-index: 8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
          padding: 10px;
          border: 1px solid rgba(118, 153, 255, 0.35);
          border-radius: 14px;
          background: rgba(7, 17, 40, 0.92);
          backdrop-filter: blur(8px);
        }
        .backButton {
          min-height: 48px;
          padding: 0 18px;
          border-radius: 12px;
          border: 1px solid rgba(142, 193, 255, 0.65);
          background: rgba(24, 49, 102, 0.9);
          color: #eaf1ff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
        }
        .wallet {
          display: flex;
          align-items: stretch;
          justify-content: flex-end;
          gap: 6px;
          flex: 1;
        }
        .walletItem {
          min-width: 112px;
          border: 1px solid rgba(118, 153, 255, 0.25);
          border-radius: 10px;
          padding: 6px 8px;
          text-align: right;
          background: rgba(12, 24, 58, 0.78);
        }
        .walletLabel {
          display: block;
          font-size: 11px;
          color: #8eb5ff;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .contentGrid {
          display: grid;
          gap: 12px;
        }
        .panel {
          border: 1px solid rgba(122, 153, 255, 0.26);
          border-radius: 14px;
          padding: 14px;
          background: rgba(7, 17, 40, 0.84);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        h1,
        h2 {
          margin: 0 0 10px;
          line-height: 1.25;
        }
        h1 {
          font-size: 24px;
        }
        h2 {
          font-size: 20px;
        }
        .panelLead {
          margin: 0 0 10px;
          color: #acc7ff;
          font-size: 14px;
        }
        .previewStage {
          min-height: 220px;
          border-radius: 12px;
          border: 1px dashed rgba(121, 177, 255, 0.45);
          background:
            linear-gradient(145deg, rgba(12, 31, 67, 0.95), rgba(6, 16, 35, 0.95)),
            radial-gradient(circle at center, rgba(58, 133, 255, 0.2), transparent 54%);
          display: grid;
          place-items: center;
          text-align: center;
        }
        .previewCore {
          padding: 12px;
          display: grid;
          gap: 4px;
        }
        .previewLabel {
          font-size: 12px;
          color: #99b9ff;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .previewShipName {
          font-size: 22px;
          font-weight: 800;
        }
        .previewShipRole {
          font-size: 15px;
          color: #89e0ff;
        }
        .previewHint {
          margin-top: 8px;
          font-size: 13px;
          color: #a4b7df;
        }
        .shipList {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: min(46vh, 480px);
          overflow-y: auto;
          padding-right: 4px;
        }
        .shipCard {
          border: 1px solid rgba(124, 181, 255, 0.3);
          border-radius: 12px;
          padding: 12px;
          background: rgba(11, 25, 56, 0.82);
          display: grid;
          gap: 8px;
        }
        .shipCardSelected {
          border-color: rgba(91, 244, 208, 0.92);
          box-shadow: 0 0 0 1px rgba(91, 244, 208, 0.45);
        }
        .shipCardLocked {
          opacity: 0.92;
        }
        .shipRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .shipName {
          font-size: 18px;
          font-weight: 700;
        }
        .shipRole {
          font-size: 13px;
          color: #8eb2ef;
        }
        .shipState {
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          border: 1px solid rgba(163, 194, 255, 0.5);
          white-space: nowrap;
        }
        .shipStateUnlocked {
          color: #78ffd8;
          border-color: rgba(106, 255, 212, 0.64);
        }
        .shipStateLocked {
          color: #ffb4ba;
          border-color: rgba(255, 144, 158, 0.64);
        }
        .shipCost {
          font-size: 13px;
          color: #bfd0f1;
        }
        .primaryAction {
          width: 100%;
          min-height: 48px;
          border-radius: 12px;
          border: 1px solid rgba(121, 167, 255, 0.55);
          background: linear-gradient(135deg, #2677f6, #2fd9d7);
          color: #06203e;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .primaryAction:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .upgradeHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
          color: #b7cbf8;
          font-size: 14px;
        }
        .warning {
          margin: 0 0 10px;
          color: #ffd89c;
          font-size: 14px;
        }
        .upgradeList {
          display: grid;
          gap: 10px;
        }
        .upgradeRow {
          display: grid;
          gap: 8px;
          border: 1px solid rgba(111, 151, 228, 0.35);
          border-radius: 12px;
          padding: 10px;
          background: rgba(8, 20, 44, 0.75);
        }
        .upgradeName {
          font-size: 16px;
          font-weight: 700;
        }
        .upgradeMeta {
          margin-top: 2px;
          font-size: 13px;
          color: #9fb9ea;
        }
        .toast {
          position: fixed;
          left: 50%;
          bottom: 14px;
          transform: translateX(-50%) translateY(10px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 120ms ease, transform 120ms ease;
          max-width: calc(100vw - 24px);
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(154, 185, 255, 0.42);
          background: rgba(4, 13, 29, 0.95);
          color: #e7eeff;
          font-size: 14px;
          text-align: center;
          z-index: 16;
        }
        .toastVisible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        @media (min-width: 980px) {
          .hangarPage {
            padding: 18px 26px 90px;
          }
          .contentGrid {
            grid-template-columns: minmax(280px, 1.1fr) minmax(320px, 1fr) minmax(320px, 1fr);
            align-items: start;
          }
          .panel {
            min-height: 620px;
          }
          .shipList {
            max-height: 500px;
          }
          .upgradeRow {
            grid-template-columns: 1fr 210px;
            align-items: center;
          }
        }
      `}</style>
    </>
  );
}
