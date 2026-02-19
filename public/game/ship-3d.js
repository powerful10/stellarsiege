(function ship3dBootstrap() {
  const CDN_THREE = "https://unpkg.com/three@0.160.1/build/three.min.js";

  const paletteMap = {
    scout: { body: 0x1de2c4, accent: 0x0ea5e9 },
    striker: { body: 0x60a5fa, accent: 0x93c5fd },
    tank: { body: 0xf59e0b, accent: 0xfde68a },
    sniper: { body: 0xf97316, accent: 0xfb923c },
    bomber: { body: 0xf43f5e, accent: 0xfb7185 },
    interceptor: { body: 0x22d3ee, accent: 0x67e8f9 },
    drone_carrier: { body: 0x8b5cf6, accent: 0xc4b5fd },
    stealth: { body: 0x64748b, accent: 0xe2e8f0 },
    warden: { body: 0x84cc16, accent: 0xbef264 },
    valkyrie: { body: 0xfb923c, accent: 0xfdba74 },
    nova_revenant: { body: 0xe879f9, accent: 0xf0abfc },
  };

  const enemyShipMap = {
    drone: "scout",
    fighter: "striker",
    sniper: "sniper",
    rammer: "tank",
    boss: "nova_revenant",
    duelist: "valkyrie",
    pvp: "stealth",
  };

  let threePromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-src="${src}"]`);
      if (existing) {
        if (existing.getAttribute("data-loaded") === "1") resolve();
        else existing.addEventListener("load", () => resolve(), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      script.setAttribute("data-src", src);
      script.onload = () => {
        script.setAttribute("data-loaded", "1");
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function ensureThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threePromise) {
      threePromise = loadScript(CDN_THREE).then(() => window.THREE);
    }
    return threePromise;
  }

  function createMaterial(THREE, color, emissive = 0x000000, opacity = 1) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.35,
      roughness: 0.45,
      emissive,
      emissiveIntensity: emissive ? 1.2 : 0,
      transparent: opacity < 1,
      opacity,
    });
  }

  function addBasicHullParts(THREE, group, shipId, tier, bodyMat, accentMat, emissiveMat) {
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.2, 6), bodyMat);
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 1.2;
    group.add(nose);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 2.1, 8), bodyMat);
    body.rotation.z = -Math.PI / 2;
    body.position.x = -0.1;
    group.add(body);

    const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.1), accentMat);
    wingL.position.set(-0.2, 0.22, 0.7);
    group.add(wingL);
    const wingR = wingL.clone();
    wingR.position.z = -0.7;
    group.add(wingR);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), emissiveMat);
    cockpit.position.set(0.55, 0.28, 0);
    group.add(cockpit);

    if (shipId === "tank") {
      const armor = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 1.55), bodyMat);
      armor.position.set(-0.3, -0.08, 0);
      group.add(armor);
    } else if (shipId === "sniper") {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.1), emissiveMat);
      rail.position.set(0.8, 0.16, 0);
      group.add(rail);
    } else if (shipId === "bomber") {
      const bombRack = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 8), accentMat);
      bombRack.rotation.x = Math.PI / 2;
      bombRack.position.set(-0.55, -0.24, 0);
      group.add(bombRack);
    } else if (shipId === "interceptor") {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.5), accentMat);
      blade.position.set(0.2, 0.1, 0);
      group.add(blade);
    } else if (shipId === "drone_carrier") {
      const bay = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 1.7), bodyMat);
      bay.position.set(-0.35, -0.1, 0);
      group.add(bay);
      const podL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), emissiveMat);
      podL.position.set(-0.7, -0.08, 0.56);
      group.add(podL);
      const podR = podL.clone();
      podR.position.z = -0.56;
      group.add(podR);
    } else if (shipId === "stealth") {
      group.rotation.y = 0.16;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.05), accentMat);
      fin.position.set(-0.55, 0.3, 0);
      group.add(fin);
    } else if (shipId === "warden") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 10, 20), accentMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-0.25, 0, 0);
      group.add(ring);
    } else if (shipId === "valkyrie") {
      const spear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 6), emissiveMat);
      spear.rotation.z = -Math.PI / 2;
      spear.position.set(1.95, 0.02, 0);
      group.add(spear);
    } else if (shipId === "nova_revenant") {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.09, 8, 24), emissiveMat);
      halo.rotation.y = Math.PI / 2;
      halo.position.set(-0.2, 0, 0);
      group.add(halo);
    }

    if (tier >= 2) {
      const extraWingL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.9), emissiveMat);
      extraWingL.position.set(-0.9, 0.15, 0.85);
      group.add(extraWingL);
      const extraWingR = extraWingL.clone();
      extraWingR.position.z = -0.85;
      group.add(extraWingR);
    }
    if (tier >= 3) {
      const microL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.36, 7), emissiveMat);
      microL.rotation.z = -Math.PI / 2;
      microL.position.set(-1.26, -0.2, 0.45);
      group.add(microL);
      const microR = microL.clone();
      microR.position.z = -0.45;
      group.add(microR);
    }
  }

  function createThruster(THREE, tier, emissiveColor) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.2 + tier * 0.02, 0.45 + tier * 0.06, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: emissiveColor,
        emissiveIntensity: 1.8 + tier * 0.6,
        transparent: true,
        opacity: 0.85,
      })
    );
    core.rotation.z = Math.PI / 2;
    group.add(core);
    return group;
  }

  function createShipMesh(THREE, shipId, tier, opts = {}) {
    const palette = paletteMap[shipId] || paletteMap.scout;
    const silhouette = Boolean(opts.silhouette);
    const bodyColor = silhouette ? 0x171b2a : palette.body;
    const accentColor = silhouette ? 0x21273a : palette.accent;
    const emissiveColor = silhouette ? 0x000000 : palette.accent;
    const opacity = silhouette ? 0.82 : 1;

    const bodyMat = createMaterial(THREE, bodyColor, 0x000000, opacity);
    const accentMat = createMaterial(THREE, accentColor, silhouette ? 0x000000 : palette.accent, opacity);
    const emissiveMat = createMaterial(THREE, silhouette ? 0x2c3449 : 0xffffff, emissiveColor, opacity);

    const ship = new THREE.Group();
    addBasicHullParts(THREE, ship, shipId, tier, bodyMat, accentMat, emissiveMat);

    const thruster = createThruster(THREE, tier, emissiveColor || palette.accent);
    thruster.position.set(-1.35, -0.02, 0);
    ship.add(thruster);
    ship.userData.thruster = thruster;
    ship.userData.tier = tier;
    return ship;
  }

  const hangar = {
    renderer: null,
    scene: null,
    camera: null,
    root: null,
    ship: null,
    frame: 0,
    ready: false,
  };

  const game = {
    renderer: null,
    scene: null,
    camera: null,
    layer: null,
    ship: null,
    shield: null,
    enemyMeshes: new Map(),
    droneMeshes: new Map(),
    width: 0,
    height: 0,
    ready: false,
  };

  function hangarResize() {
    if (!hangar.renderer || !hangar.root || !hangar.camera) return;
    const rect = hangar.root.getBoundingClientRect();
    const w = Math.max(8, Math.floor(rect.width));
    const h = Math.max(8, Math.floor(rect.height));
    hangar.renderer.setSize(w, h, false);
    hangar.camera.aspect = w / h;
    hangar.camera.updateProjectionMatrix();
  }

  function hangarAnimate() {
    if (!hangar.renderer || !hangar.scene || !hangar.camera) return;
    hangar.frame = requestAnimationFrame(hangarAnimate);
    if (hangar.ship) {
      hangar.ship.rotation.y += 0.01;
      const bob = Math.sin(Date.now() * 0.002) * 0.04;
      hangar.ship.position.y = bob;
      if (hangar.ship.userData.thruster) {
        const th = hangar.ship.userData.thruster;
        th.scale.x = 1 + Math.sin(Date.now() * 0.012) * 0.12;
        th.scale.y = 1 + Math.sin(Date.now() * 0.011) * 0.08;
      }
    }
    hangar.renderer.render(hangar.scene, hangar.camera);
  }

  async function ensureHangar(rootEl) {
    if (!rootEl) return false;
    const THREE = await ensureThree();
    if (!THREE) return false;
    if (hangar.ready && hangar.root === rootEl) {
      hangarResize();
      return true;
    }
    hangar.root = rootEl;
    hangar.scene = new THREE.Scene();
    hangar.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    hangar.camera.position.set(0.7, 1.25, 4.1);
    hangar.camera.lookAt(0, 0, 0);

    hangar.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    hangar.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rootEl.innerHTML = "";
    rootEl.appendChild(hangar.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    hangar.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 4, 3);
    hangar.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.65);
    rim.position.set(-3, 1, -4);
    hangar.scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.75, 38),
      new THREE.MeshStandardMaterial({
        color: 0x16203c,
        emissive: 0x12254e,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.82,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.82;
    hangar.scene.add(floor);
    hangar.ready = true;
    hangarResize();
    if (!hangar.frame) hangarAnimate();
    return true;
  }

  function setHangarShip(shipId, tier, locked) {
    if (!hangar.ready || !window.THREE) return;
    const THREE = window.THREE;
    if (hangar.ship) hangar.scene.remove(hangar.ship);
    hangar.ship = createShipMesh(THREE, shipId, tier, { silhouette: locked });
    hangar.ship.scale.setScalar(0.9);
    hangar.scene.add(hangar.ship);
  }

  async function ensureGame(rootEl, width, height) {
    const THREE = await ensureThree();
    if (!THREE || !rootEl) return false;
    if (!game.layer) {
      const layer = document.createElement("div");
      layer.className = "ship3d-layer";
      rootEl.appendChild(layer);
      game.layer = layer;
    }
    if (!game.renderer) {
      game.scene = new THREE.Scene();
      game.camera = new THREE.OrthographicCamera(0, width, height, 0, -200, 200);
      game.camera.position.set(0, 0, 20);
      game.camera.lookAt(0, 0, 0);
      game.enemyMeshes.clear();
      game.droneMeshes.clear();

      game.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
      game.layer.innerHTML = "";
      game.layer.appendChild(game.renderer.domElement);

      const ambient = new THREE.AmbientLight(0xffffff, 0.9);
      game.scene.add(ambient);
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(3, 8, 4);
      game.scene.add(key);

      game.shield = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 18, 18),
        new THREE.MeshBasicMaterial({
          color: 0x40f3ff,
          transparent: true,
          opacity: 0,
          wireframe: true,
        })
      );
      game.scene.add(game.shield);
      game.ready = true;
    }
    resizeGame(width, height);
    return true;
  }

  function resizeGame(width, height) {
    if (!game.renderer || !game.camera) return;
    game.width = width;
    game.height = height;
    game.renderer.setSize(width, height, false);
    game.camera.left = 0;
    game.camera.right = width;
    game.camera.top = 0;
    game.camera.bottom = height;
    game.camera.updateProjectionMatrix();
  }

  function meshScaleForSize(size, fallback = 18) {
    const s = Math.max(8, Number(size || fallback));
    return s * 0.58;
  }

  function clearMeshMap(meshMap) {
    meshMap.forEach((entry) => {
      if (entry && entry.mesh && game.scene) game.scene.remove(entry.mesh);
    });
    meshMap.clear();
  }

  function resetGameScene() {
    clearMeshMap(game.enemyMeshes);
    clearMeshMap(game.droneMeshes);
    if (game.ship && game.scene) {
      game.scene.remove(game.ship);
      game.ship = null;
    }
    if (game.shield && game.shield.material) {
      game.shield.material.opacity = 0;
    }
  }

  function enemyTier(type, elite) {
    if (type === "boss") return 3;
    if (type === "duelist" || type === "pvp") return 2;
    return elite ? 2 : 1;
  }

  function ensureEnemyMesh(id, type, elite) {
    if (!game.ready || !window.THREE) return null;
    const key = String(id || "");
    if (!key) return null;
    const shipId = enemyShipMap[type] || "striker";
    const tier = enemyTier(type, elite);
    const existing = game.enemyMeshes.get(key);
    if (existing && existing.shipId === shipId && existing.tier === tier) return existing.mesh;
    if (existing && existing.mesh && game.scene) game.scene.remove(existing.mesh);
    const mesh = createShipMesh(window.THREE, shipId, tier, { silhouette: false });
    game.scene.add(mesh);
    game.enemyMeshes.set(key, { mesh, shipId, tier });
    return mesh;
  }

  function ensureDroneMesh(id) {
    if (!game.ready || !window.THREE) return null;
    const key = String(id || "");
    if (!key) return null;
    const existing = game.droneMeshes.get(key);
    if (existing && existing.mesh) return existing.mesh;
    const mesh = createShipMesh(window.THREE, "drone_carrier", 1, { silhouette: false });
    game.scene.add(mesh);
    game.droneMeshes.set(key, { mesh });
    return mesh;
  }

  function syncGameEntities(payload = {}) {
    if (!game.ready) return;
    const enemies = Array.isArray(payload.enemies) ? payload.enemies : [];
    const drones = Array.isArray(payload.drones) ? payload.drones : [];

    const enemySeen = new Set();
    enemies.forEach((e) => {
      const id = String(e && e.id ? e.id : "");
      if (!id) return;
      enemySeen.add(id);
      const mesh = ensureEnemyMesh(id, String(e.type || "fighter"), Boolean(e.elite));
      if (!mesh) return;
      mesh.position.set(Number(e.x || 0), Number(e.y || 0), 0);
      mesh.rotation.y = Math.PI;
      mesh.rotation.z = Number(e.angle || 0);
      const scale = meshScaleForSize(e.size, 18);
      mesh.scale.setScalar(scale);
      if (mesh.userData && mesh.userData.thruster) {
        const pulse = 1 + Math.sin(Date.now() * 0.02 + scale) * 0.1;
        mesh.userData.thruster.scale.set(1, pulse, 1);
      }
    });
    game.enemyMeshes.forEach((entry, id) => {
      if (enemySeen.has(id)) return;
      if (entry && entry.mesh && game.scene) game.scene.remove(entry.mesh);
      game.enemyMeshes.delete(id);
    });

    const droneSeen = new Set();
    drones.forEach((d) => {
      const id = String(d && d.id ? d.id : "");
      if (!id) return;
      droneSeen.add(id);
      const mesh = ensureDroneMesh(id);
      if (!mesh) return;
      mesh.position.set(Number(d.x || 0), Number(d.y || 0), 0);
      mesh.rotation.y = Math.PI;
      mesh.rotation.z = Number(d.angle || 0);
      mesh.scale.setScalar(7.4);
    });
    game.droneMeshes.forEach((entry, id) => {
      if (droneSeen.has(id)) return;
      if (entry && entry.mesh && game.scene) game.scene.remove(entry.mesh);
      game.droneMeshes.delete(id);
    });
  }

  function setGameShip(shipId, tier) {
    if (!game.ready || !window.THREE) return;
    if (game.ship) game.scene.remove(game.ship);
    game.ship = createShipMesh(window.THREE, shipId, tier, { silhouette: false });
    game.ship.scale.setScalar(12);
    game.scene.add(game.ship);
  }

  function updateGamePlayer(data) {
    if (!game.ready || !game.ship || !game.renderer) return;
    const tier = Number(data.tier || 1);
    const thrusterLevel = Math.max(0, Number(data.thrusterLevel || 0));
    const shieldLevel = Math.max(0, Number(data.shieldLevel || 0));
    const weaponLevel = Math.max(0, Number(data.weaponLevel || 0));
    const shooting = Boolean(data.shooting);
    const enginePulse = 1 + Math.sin(Date.now() * 0.02) * (0.08 + thrusterLevel * 0.01);

    game.ship.position.set(data.x || 0, data.y || 0, 0);
    game.ship.rotation.y = Math.PI;
    game.ship.rotation.z = (data.angle || 0);
    game.ship.scale.setScalar(11.2 + tier * 0.5);
    if (game.ship.userData.thruster) {
      game.ship.userData.thruster.scale.set(
        1 + thrusterLevel * 0.02,
        enginePulse,
        1 + thrusterLevel * 0.02
      );
    }

    if (game.shield) {
      const shieldRatio = Math.max(0, Math.min(1, Number(data.shieldRatio || 0)));
      game.shield.position.copy(game.ship.position);
      game.shield.scale.setScalar(15 + tier * 0.6);
      game.shield.material.opacity = shieldRatio > 0.06 ? 0.1 + shieldRatio * 0.24 + shieldLevel * 0.005 : 0;
    }

    // Weapon upgrade: subtle muzzle flash while firing.
    if (shooting) {
      if (!game.ship.userData.flash) {
        const flash = new window.THREE.Mesh(
          new window.THREE.SphereGeometry(0.15, 8, 8),
          new window.THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
        );
        flash.position.set(1.95, 0, 0);
        game.ship.add(flash);
        game.ship.userData.flash = flash;
      }
      game.ship.userData.flash.scale.setScalar(1 + Math.sin(Date.now() * 0.05) * 0.5 + weaponLevel * 0.02);
      game.ship.userData.flash.material.opacity = 0.7;
    } else if (game.ship.userData.flash) {
      game.ship.userData.flash.material.opacity = 0;
    }

    game.renderer.render(game.scene, game.camera);
  }

  function playUnlockEffect() {
    if (!hangar.ship) return;
    hangar.ship.scale.setScalar(0.4);
    const t0 = performance.now();
    const step = () => {
      if (!hangar.ship) return;
      const t = Math.min(1, (performance.now() - t0) / 450);
      const s = 0.4 + (1.05 - 0.4) * t;
      hangar.ship.scale.setScalar(s);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  window.ship3D = {
    async ensureHangar(rootEl) {
      return ensureHangar(rootEl);
    },
    setHangarShip(shipId, tier, locked) {
      setHangarShip(shipId, tier, locked);
    },
    playUnlockEffect,
    async ensureGame(rootEl, width, height) {
      return ensureGame(rootEl, width, height);
    },
    setGameShip(shipId, tier) {
      setGameShip(shipId, tier);
    },
    updateGamePlayer(data) {
      updateGamePlayer(data);
    },
    syncGameEntities(payload) {
      syncGameEntities(payload);
    },
    resetGameScene() {
      resetGameScene();
    },
    resizeGame(width, height) {
      resizeGame(width, height);
      hangarResize();
    },
    isReady() {
      return Boolean(window.THREE);
    },
  };
})();
