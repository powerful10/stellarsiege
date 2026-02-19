import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

const STORAGE_KEYS = {
  credits: "credits",
  crystals: "crystals",
  ownedShips: "ownedShips",
  selectedShip: "selectedShip",
  upgrades: "upgrades",
};

const LEGACY_SAVE_KEY = "stellar_siege_save_v5";

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
  { key: "damage", label: "Damage", baseCost: 500, growth: 1.45, max: 20 },
  { key: "fireRate", label: "Fire Rate", baseCost: 550, growth: 1.45, max: 20 },
  { key: "armor", label: "Armor", baseCost: 620, growth: 1.48, max: 20 },
];

const EMPTY_LEVELS = Object.freeze({
  damage: 0,
  fireRate: 0,
  armor: 0,
});

function clampInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function safeParse(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function isObj(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function makeUpgradeMap() {
  const out = {};
  SHIPS.forEach((ship) => {
    out[ship.id] = { ...EMPTY_LEVELS };
  });
  return out;
}

function normalizeOwnedShips(input) {
  const owned = new Set(["scout"]);
  if (Array.isArray(input)) {
    input.forEach((id) => {
      const key = String(id || "");
      if (SHIP_LOOKUP[key]) owned.add(key);
    });
  }
  return Array.from(owned);
}

function normalizeLevelSet(input) {
  if (!isObj(input)) return { ...EMPTY_LEVELS };
  return {
    damage: clampInt(input.damage, 0),
    fireRate: clampInt(input.fireRate, 0),
    armor: clampInt(input.armor, 0),
  };
}

function readLegacySave() {
  try {
    const raw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isObj(parsed)) return null;

    const profile = isObj(parsed.profile) ? parsed.profile : {};
    const ships = isObj(parsed.ships) ? parsed.ships : {};
    const ownedShips = normalizeOwnedShips(
      Object.keys(ships).filter((id) => isObj(ships[id]) && ships[id].owned === true)
    );
    const selectedCandidate = String(profile.selectedShipId || "scout");
    const selectedShip = ownedShips.includes(selectedCandidate) ? selectedCandidate : ownedShips[0];

    const upgrades = makeUpgradeMap();
    SHIPS.forEach((ship) => {
      const shipState = isObj(ships[ship.id]) ? ships[ship.id] : {};
      const legacyLevels = isObj(shipState.upgrades) ? shipState.upgrades : {};
      upgrades[ship.id] = {
        damage: clampInt(legacyLevels.damage, 0),
        fireRate: clampInt(legacyLevels.fireRate, 0),
        armor: Math.max(clampInt(legacyLevels.hullMax, 0), clampInt(legacyLevels.shieldMax, 0)),
      };
    });

    return {
      credits: clampInt(profile.credits, 0),
      crystals: clampInt(profile.crystals, 0),
      ownedShips,
      selectedShip,
      upgrades,
    };
  } catch {
    return null;
  }
}

function defaultState() {
  return {
    credits: 0,
    crystals: 0,
    ownedShips: ["scout"],
    selectedShip: "scout",
    upgrades: makeUpgradeMap(),
  };
}

function loadState() {
  const fallback = defaultState();
  if (typeof window === "undefined") return fallback;

  const legacy = readLegacySave() || fallback;

  let rawCredits = null;
  let rawCrystals = null;
  let rawOwned = null;
  let rawSelected = null;
  let rawUpgrades = null;

  try {
    rawCredits = localStorage.getItem(STORAGE_KEYS.credits);
    rawCrystals = localStorage.getItem(STORAGE_KEYS.crystals);
    rawOwned = localStorage.getItem(STORAGE_KEYS.ownedShips);
    rawSelected = localStorage.getItem(STORAGE_KEYS.selectedShip);
    rawUpgrades = localStorage.getItem(STORAGE_KEYS.upgrades);
  } catch {
    return legacy;
  }

  const credits = rawCredits == null ? legacy.credits : clampInt(rawCredits, legacy.credits);
  const crystals = rawCrystals == null ? legacy.crystals : clampInt(rawCrystals, legacy.crystals);
  const ownedShips = normalizeOwnedShips(rawOwned == null ? legacy.ownedShips : safeParse(rawOwned, legacy.ownedShips));
  const selectedCandidate = rawSelected == null ? legacy.selectedShip : String(rawSelected || "scout");
  const selectedShip = ownedShips.includes(selectedCandidate) ? selectedCandidate : ownedShips[0];

  const incoming = rawUpgrades == null ? legacy.upgrades : safeParse(rawUpgrades, legacy.upgrades);
  const upgrades = makeUpgradeMap();
  SHIPS.forEach((ship) => {
    const levels = isObj(incoming) ? incoming[ship.id] : null;
    upgrades[ship.id] = normalizeLevelSet(levels);
  });

  return { credits, crystals, ownedShips, selectedShip, upgrades };
}

function persistState(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.credits, String(clampInt(state.credits, 0)));
    localStorage.setItem(STORAGE_KEYS.crystals, String(clampInt(state.crystals, 0)));
    localStorage.setItem(STORAGE_KEYS.ownedShips, JSON.stringify(normalizeOwnedShips(state.ownedShips)));
    localStorage.setItem(STORAGE_KEYS.selectedShip, String(state.selectedShip || "scout"));
    localStorage.setItem(STORAGE_KEYS.upgrades, JSON.stringify(state.upgrades || {}));
  } catch {
    // ignore localStorage errors
  }
}

function syncLegacySave(state) {
  try {
    const parsed = safeParse(localStorage.getItem(LEGACY_SAVE_KEY), {});
    const profile = isObj(parsed.profile) ? { ...parsed.profile } : {};
    const ships = isObj(parsed.ships) ? { ...parsed.ships } : {};

    profile.credits = clampInt(state.credits, 0);
    profile.crystals = clampInt(state.crystals, 0);
    profile.selectedShipId = state.selectedShip;
    profile.updatedAt = Date.now();

    SHIPS.forEach((ship) => {
      const prev = isObj(ships[ship.id]) ? { ...ships[ship.id] } : {};
      const prevUpgrades = isObj(prev.upgrades) ? { ...prev.upgrades } : {};
      const lv = normalizeLevelSet(state.upgrades[ship.id]);
      ships[ship.id] = {
        ...prev,
        owned: state.ownedShips.includes(ship.id),
        upgrades: {
          ...prevUpgrades,
          damage: lv.damage,
          fireRate: lv.fireRate,
          hullMax: lv.armor,
          shieldMax: lv.armor,
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
    // ignore legacy sync errors
  }
}

function formatNum(value) {
  return clampInt(value, 0).toLocaleString("en-US");
}

function shipCostText(ship) {
  if (!ship.priceCredits && !ship.priceCrystals) return "Free";
  const out = [];
  if (ship.priceCredits) out.push(`${formatNum(ship.priceCredits)} credits`);
  if (ship.priceCrystals) out.push(`${formatNum(ship.priceCrystals)} crystals`);
  return out.join(" + ");
}

function upgradeCost(def, level) {
  return Math.floor(def.baseCost * Math.pow(def.growth, level));
}

export default function HangarPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [credits, setCredits] = useState(0);
  const [crystals, setCrystals] = useState(0);
  const [ownedShips, setOwnedShips] = useState(["scout"]);
  const [selectedShip, setSelectedShip] = useState("scout");
  const [upgrades, setUpgrades] = useState(makeUpgradeMap);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const state = loadState();
    setCredits(state.credits);
    setCrystals(state.crystals);
    setOwnedShips(state.ownedShips);
    setSelectedShip(state.selectedShip);
    setUpgrades(state.upgrades);
    setReady(true);
  }, []);

  const snapshot = useMemo(
    () => ({ credits, crystals, ownedShips, selectedShip, upgrades }),
    [credits, crystals, ownedShips, selectedShip, upgrades]
  );

  useEffect(() => {
    if (!ready) return;
    persistState(snapshot);
    syncLegacySave(snapshot);
  }, [ready, snapshot]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = useCallback((text) => {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 1800);
  }, []);

  const selected = SHIP_LOOKUP[selectedShip] || SHIPS[0];
  const selectedOwned = ownedShips.includes(selected.id);
  const selectedLevels = normalizeLevelSet(upgrades[selected.id]);

  const goBack = useCallback(() => {
    router.push("/").catch(() => {
      window.location.assign("/");
    });
  }, [router]);

  const onShipAction = useCallback(
    (ship) => {
      const owned = ownedShips.includes(ship.id);
      if (owned) {
        if (selectedShip === ship.id) return;
        setSelectedShip(ship.id);
        showToast(`${ship.name} selected.`);
        return;
      }

      if (credits < ship.priceCredits || crystals < ship.priceCrystals) {
        showToast(`Need ${shipCostText(ship)}.`);
        return;
      }

      setCredits((v) => v - ship.priceCredits);
      setCrystals((v) => v - ship.priceCrystals);
      setOwnedShips((v) => normalizeOwnedShips([...v, ship.id]));
      setSelectedShip(ship.id);
      showToast(`${ship.name} unlocked.`);
    },
    [credits, crystals, ownedShips, selectedShip, showToast]
  );

  const onUpgrade = useCallback(
    (def) => {
      if (!selectedOwned) {
        showToast("Unlock this ship first.");
        return;
      }

      const current = normalizeLevelSet(upgrades[selected.id])[def.key];
      if (current >= def.max) {
        showToast(`${def.label} already max.`);
        return;
      }

      const cost = upgradeCost(def, current);
      if (credits < cost) {
        showToast(`Need ${formatNum(cost)} credits.`);
        return;
      }

      setCredits((v) => v - cost);
      setUpgrades((prev) => {
        const next = { ...prev };
        const lv = normalizeLevelSet(next[selected.id]);
        next[selected.id] = { ...lv, [def.key]: lv[def.key] + 1 };
        return next;
      });
      showToast(`${def.label} upgraded.`);
    },
    [credits, selected.id, selectedOwned, showToast, upgrades]
  );

  return (
    <>
      <Head>
        <title>Stellar Siege Hangar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="hangarPage">
        <header className="topBar">
          <button className="backBtn" type="button" onClick={goBack}>
            Back
          </button>
          <div className="wallet">
            <div className="walletCard">
              <span>Credits</span>
              <strong>{formatNum(credits)}</strong>
            </div>
            <div className="walletCard">
              <span>Crystals</span>
              <strong>{formatNum(crystals)}</strong>
            </div>
          </div>
        </header>

        <section className="section">
          <h1>Hangar</h1>
          <p>Guest mode is active. Progress saves locally on this device.</p>
        </section>

        <section className="section">
          <h2>Ships</h2>
          <div className="shipList">
            {SHIPS.map((ship) => {
              const owned = ownedShips.includes(ship.id);
              const active = selectedShip === ship.id;
              const costLabel = shipCostText(ship);
              return (
                <article key={ship.id} className={`shipCard${active ? " shipCardActive" : ""}`}>
                  <div className="shipTop">
                    <div>
                      <h3>{ship.name}</h3>
                      <p>{ship.role}</p>
                    </div>
                    <span className={`statePill ${owned ? "stateOwned" : "stateLocked"}`}>
                      {owned ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                  <div className="shipCost">{owned ? "Ready" : `Cost: ${costLabel}`}</div>
                  <button
                    className="actionBtn"
                    type="button"
                    onClick={() => onShipAction(ship)}
                    disabled={owned && active}
                  >
                    {owned ? (active ? "Selected" : "Select") : "Unlock"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section">
          <h2>Upgrades</h2>
          <p>
            Current ship: <strong>{selected.name}</strong>
          </p>
          {!selectedOwned ? <p className="warn">Unlock this ship to upgrade it.</p> : null}

          <div className="upgradeList">
            {UPGRADE_DEFS.map((def) => {
              const level = selectedLevels[def.key];
              const maxed = level >= def.max;
              const cost = upgradeCost(def, level);
              return (
                <article key={def.key} className="upgradeRow">
                  <div>
                    <h3>{def.label}</h3>
                    <p>
                      Level {level}/{def.max}
                    </p>
                  </div>
                  <button
                    className="actionBtn"
                    type="button"
                    onClick={() => onUpgrade(def)}
                    disabled={!selectedOwned || maxed}
                  >
                    {maxed ? "Maxed" : `Upgrade ${formatNum(cost)} credits`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <div className={`toast${toast ? " toastOn" : ""}`} role="status" aria-live="polite">
          {toast}
        </div>
      </main>

      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          background: #061125;
          color: #e8f0ff;
          font-family: "Segoe UI", Tahoma, sans-serif;
        }
      `}</style>

      <style jsx>{`
        .hangarPage {
          min-height: 100vh;
          padding: 10px 12px 80px;
          background:
            radial-gradient(circle at 12% 0%, rgba(59, 130, 246, 0.22), transparent 42%),
            radial-gradient(circle at 88% 12%, rgba(20, 184, 166, 0.18), transparent 34%),
            #061125;
        }
        .topBar {
          position: sticky;
          top: 0;
          z-index: 10;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
          padding: 8px;
          border-radius: 14px;
          border: 1px solid rgba(148, 185, 255, 0.34);
          background: rgba(8, 19, 45, 0.92);
          backdrop-filter: blur(8px);
        }
        .backBtn {
          min-height: 52px;
          min-width: 100px;
          border: 1px solid rgba(132, 189, 255, 0.55);
          border-radius: 12px;
          background: rgba(20, 54, 112, 0.95);
          color: #f3f8ff;
          font-size: 16px;
          font-weight: 800;
        }
        .wallet {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .walletCard {
          border: 1px solid rgba(137, 177, 255, 0.26);
          border-radius: 10px;
          padding: 6px 8px;
          background: rgba(9, 26, 60, 0.8);
          text-align: right;
        }
        .walletCard span {
          display: block;
          font-size: 11px;
          opacity: 0.8;
          text-transform: uppercase;
        }
        .walletCard strong {
          font-size: 16px;
        }
        .section {
          margin-bottom: 10px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(130, 165, 231, 0.26);
          background: rgba(9, 19, 46, 0.88);
        }
        h1,
        h2,
        h3,
        p {
          margin: 0;
        }
        h1 {
          font-size: 26px;
          margin-bottom: 4px;
        }
        h2 {
          font-size: 22px;
          margin-bottom: 8px;
        }
        .shipList,
        .upgradeList {
          display: grid;
          gap: 10px;
          margin-top: 8px;
        }
        .shipCard,
        .upgradeRow {
          border: 1px solid rgba(120, 162, 234, 0.34);
          border-radius: 12px;
          padding: 10px;
          background: rgba(8, 25, 58, 0.86);
          display: grid;
          gap: 8px;
        }
        .shipCardActive {
          border-color: rgba(74, 255, 225, 0.75);
          box-shadow: 0 0 0 1px rgba(74, 255, 225, 0.28);
        }
        .shipTop {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        .shipTop h3,
        .upgradeRow h3 {
          font-size: 18px;
        }
        .shipTop p,
        .upgradeRow p {
          opacity: 0.8;
          font-size: 13px;
        }
        .shipCost {
          font-size: 13px;
          opacity: 0.9;
        }
        .statePill {
          align-self: start;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .stateOwned {
          color: #8affd5;
          border-color: rgba(129, 255, 220, 0.5);
        }
        .stateLocked {
          color: #ffc4cb;
          border-color: rgba(255, 153, 166, 0.5);
        }
        .actionBtn {
          min-height: 52px;
          border: 1px solid rgba(102, 173, 255, 0.52);
          border-radius: 12px;
          background: linear-gradient(135deg, #2f7ef8, #2dd4bf);
          color: #05213f;
          font-size: 16px;
          font-weight: 800;
        }
        .actionBtn:disabled {
          opacity: 0.56;
        }
        .warn {
          color: #ffd8a8;
          margin-top: 8px;
        }
        .toast {
          position: fixed;
          left: 50%;
          bottom: 14px;
          transform: translateX(-50%) translateY(8px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 120ms ease, transform 120ms ease;
          max-width: calc(100vw - 20px);
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(131, 186, 255, 0.42);
          background: rgba(7, 18, 42, 0.96);
          font-size: 14px;
          text-align: center;
          z-index: 30;
        }
        .toastOn {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        @media (min-width: 980px) {
          .hangarPage {
            padding: 14px 20px 100px;
          }
          .section {
            padding: 14px;
          }
          .shipList {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .upgradeRow {
            grid-template-columns: 1fr 260px;
            align-items: center;
          }
        }
      `}</style>
    </>
  );
}
