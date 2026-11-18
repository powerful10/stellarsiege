(function ship3dBootstrap() {
  const LOCAL_THREE = "three.min.js";
  const LOCAL_GLTF = "GLTFLoader.js";
  const CDN_THREE = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  const CDN_GLTF = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";

  const paletteMap = {
    scout: { body: 0x1de2c4, accent: 0x0ea5e9, glow: 0x38bdf8 },
    striker: { body: 0x60a5fa, accent: 0x93c5fd, glow: 0x60a5fa },
    tank: { body: 0xf59e0b, accent: 0xfde68a, glow: 0xfbbf24 },
    sniper: { body: 0xf97316, accent: 0xfb923c, glow: 0xf97316 },
    bomber: { body: 0xf43f5e, accent: 0xfb7185, glow: 0xf43f5e },
    interceptor: { body: 0x22d3ee, accent: 0x67e8f9, glow: 0x22d3ee },
    drone_carrier: { body: 0x8b5cf6, accent: 0xc4b5fd, glow: 0xa855f7 },
    stealth: { body: 0x475569, accent: 0x94a3b8, glow: 0x38bdf8 },
    warden: { body: 0x84cc16, accent: 0xbef264, glow: 0xa3e635 },
    valkyrie: { body: 0xfb923c, accent: 0xfdba74, glow: 0xf59e0b },
    nova_revenant: { body: 0xe879f9, accent: 0xf0abfc, glow: 0xd946ef },
    starforged_envoy: { body: 0x38bdf8, accent: 0xec4899, glow: 0x06b6d4 },
  };

  const modelFileMap = {
    scout: "scout",
    striker: "striker",
    tank: "warden",
    sniper: "ranger",
    bomber: "striker",
    interceptor: "ranger",
    drone_carrier: "astra",
    stealth: "scout",
    warden: "warden",
    valkyrie: "valkyrie",
    nova_revenant: "astra",
    starforged_envoy: "astra",
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
  const glbCache = new Map();

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-src="${src}"]`);
      if (existing) {
        if (existing.getAttribute("data-loaded") === "1") return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
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
    if (window.THREE) {
      if (window.THREE.GLTFLoader) return Promise.resolve(window.THREE);
      return loadScript(LOCAL_GLTF).catch(() => loadScript(CDN_GLTF)).then(() => window.THREE).catch(() => window.THREE);
    }
    if (!threePromise) {
      threePromise = loadScript(LOCAL_THREE)
        .catch(() => loadScript(CDN_THREE))
        .then(() => loadScript(LOCAL_GLTF).catch(() => loadScript(CDN_GLTF)))
        .then(() => window.THREE)
        .catch(() => window.THREE);
    }
    return threePromise;
  }

  function createMaterial(THREE, color, emissive = 0x000000, opacity = 1) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.55,
      roughness: 0.35,
      emissive,
      emissiveIntensity: emissive ? 1.5 : 0,
      transparent: opacity < 1,
      opacity,
    });
  }

  function getModelPath(shipId, tier) {
    const base = modelFileMap[shipId] || "scout";
    const t = Math.max(1, Math.min(3, Math.floor(Number(tier || 1))));
    return `models/${base}_t${t}.glb`;
  }

  function loadGLBModel(THREE, shipId, tier) {
    const path = getModelPath(shipId, tier);
    if (glbCache.has(path)) return glbCache.get(path);

    if (!THREE.GLTFLoader) return Promise.resolve(null);

    const loader = new THREE.GLTFLoader();
    const p = new Promise((resolve) => {
      loader.load(
        path,
        (gltf) => {
          const root = gltf.scene || gltf.scenes[0];
          root.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.metalness = 0.6;
                child.material.roughness = 0.3;
                if (child.material.emissive) {
                  child.material.emissiveIntensity = 2.0;
                }
              }
            }
          });
          resolve(root);
        },
        undefined,
        () => resolve(null)
      );
    });
    glbCache.set(path, p);
    return p;
  }

  function addBasicHullParts(THREE, group, shipId, tier, bodyMat, accentMat, emissiveMat) {
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.68, 2.3, 6), bodyMat);
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 1.25;
    group.add(nose);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.78, 2.2, 8), bodyMat);
    body.rotation.z = -Math.PI / 2;
    body.position.x = -0.1;
    group.add(body);

    const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.2), accentMat);
    wingL.position.set(-0.2, 0.22, 0.75);
    group.add(wingL);
    const wingR = wingL.clone();
    wingR.position.z = -0.75;
    group.add(wingR);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), emissiveMat);
    cockpit.position.set(0.6, 0.3, 0);
    group.add(cockpit);

    if (shipId === "tank") {
      const armor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.7), bodyMat);
      armor.position.set(-0.3, -0.08, 0);
      group.add(armor);
    } else if (shipId === "sniper") {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.12), emissiveMat);
      rail.position.set(1.1, 0.18, 0);
      group.add(rail);
    } else if (shipId === "valkyrie") {
      const spear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 6), emissiveMat);
      spear.rotation.z = -Math.PI / 2;
      spear.position.set(2.1, 0.02, 0);
      group.add(spear);
    }

    if (tier >= 2) {
      const extraWingL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 1.0), emissiveMat);
      extraWingL.position.set(-0.95, 0.16, 0.95);
      group.add(extraWingL);
      const extraWingR = extraWingL.clone();
      extraWingR.position.z = -0.95;
      group.add(extraWingR);
    }
  }

  function createThruster(THREE, tier, emissiveColor) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.24 + tier * 0.03, 0.6 + tier * 0.08, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: emissiveColor,
        emissiveIntensity: 2.4 + tier * 0.5,
        transparent: true,
        opacity: 0.9,
      })
    );
    core.rotation.z = Math.PI / 2;
    group.add(core);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.42, 16),
      new THREE.MeshBasicMaterial({
        color: emissiveColor,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      })
    );
    halo.rotation.y = Math.PI / 2;
    halo.position.x = -0.15;
    group.add(halo);

    return group;
  }

  function createShipMesh(THREE, shipId, tier, opts = {}) {
    const palette = paletteMap[shipId] || paletteMap.scout;
    const silhouette = Boolean(opts.silhouette);
    const bodyColor = silhouette ? 0x171b2a : palette.body;
    const accentColor = silhouette ? 0x21273a : palette.accent;
    const emissiveColor = silhouette ? 0x000000 : (palette.glow || palette.accent);
    const opacity = silhouette ? 0.82 : 1;

    const bodyMat = createMaterial(THREE, bodyColor, 0x000000, opacity);
    const accentMat = createMaterial(THREE, accentColor, silhouette ? 0x000000 : palette.accent, opacity);
    const emissiveMat = createMaterial(THREE, silhouette ? 0x2c3449 : 0xffffff, emissiveColor, opacity);

    const ship = new THREE.Group();
    addBasicHullParts(THREE, ship, shipId, tier, bodyMat, accentMat, emissiveMat);

    const thruster = createThruster(THREE, tier, emissiveColor);
    thruster.position.set(-1.25, 0, 0);
    ship.add(thruster);
    ship.userData.thruster = thruster;

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
      hangar.ship.rotation.y += 0.012;
      const bob = Math.sin(Date.now() * 0.0022) * 0.05;
      hangar.ship.position.y = bob;
      if (hangar.ship.userData.thruster) {
        const th = hangar.ship.userData.thruster;
        th.scale.x = 1 + Math.sin(Date.now() * 0.015) * 0.15;
        th.scale.y = 1 + Math.sin(Date.now() * 0.012) * 0.1;
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
    hangar.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    hangar.camera.position.set(1.2, 1.4, 4.2);
    hangar.camera.lookAt(0, 0, 0);

    hangar.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    hangar.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rootEl.innerHTML = "";
    rootEl.appendChild(hangar.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    hangar.scene.add(ambient);
    const key = new THREE.DirectionalLight(0x7dd3fc, 1.4);
    key.position.set(4, 5, 4);
    hangar.scene.add(key);
    const rim = new THREE.DirectionalLight(0xa855f7, 0.9);
    rim.position.set(-4, 2, -3);
    hangar.scene.add(rim);

    // Glowing holographic hangar bay pad
    const floor = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.85, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.85;
    hangar.scene.add(floor);

    hangar.ready = true;
    hangarResize();
    if (!hangar.frame) hangarAnimate();
    return true;
  }

  async function setHangarShip(shipId, tier, locked) {
    if (!hangar.ready || !window.THREE) return;
    const THREE = window.THREE;
    if (hangar.ship) hangar.scene.remove(hangar.ship);

    const placeholder = createShipMesh(THREE, shipId, tier, { silhouette: locked });
    placeholder.scale.setScalar(0.9);
    hangar.ship = placeholder;
    hangar.scene.add(hangar.ship);

    if (!locked) {
      const gltf = await loadGLBModel(THREE, shipId, tier);
      if (gltf && hangar.ship === placeholder) {
        hangar.scene.remove(placeholder);
        const group = new THREE.Group();
        const cloned = gltf.clone(true);
        const box = new THREE.Box3().setFromObject(cloned);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        cloned.scale.setScalar(2.4 / maxDim);
        cloned.rotation.y = -Math.PI / 2;
        group.add(cloned);

        const palette = paletteMap[shipId] || paletteMap.scout;
        const thruster = createThruster(THREE, tier, palette.glow || 0x38bdf8);
        thruster.position.set(-1.3, 0, 0);
        group.add(thruster);
        group.userData.thruster = thruster;

        group.scale.setScalar(0.9);
        hangar.ship = group;
        hangar.scene.add(hangar.ship);
      }
    }
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
      game.camera = new THREE.OrthographicCamera(0, width, height, 0, -300, 300);
      game.camera.position.set(0, 0, 50);
      game.camera.lookAt(0, 0, 0);
      game.enemyMeshes.clear();
      game.droneMeshes.clear();

      game.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      game.layer.innerHTML = "";
      game.layer.appendChild(game.renderer.domElement);

      const ambient = new THREE.AmbientLight(0xffffff, 1.2);
      game.scene.add(ambient);
      const key = new THREE.DirectionalLight(0xffffff, 1.3);
      key.position.set(3, 8, 12);
      game.scene.add(key);

      game.shield = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 20, 20),
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
    return s * 0.65;
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
        const pulse = 1 + Math.sin(Date.now() * 0.02 + scale) * 0.12;
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
      mesh.rotation.z = Number(d.angle || 0);
      mesh.scale.setScalar(9.5);
    });
    game.droneMeshes.forEach((entry, id) => {
      if (droneSeen.has(id)) return;
      if (entry && entry.mesh && game.scene) game.scene.remove(entry.mesh);
      game.droneMeshes.delete(id);
    });
  }

  async function setGameShip(shipId, tier) {
    if (!game.ready || !window.THREE) return;
    const THREE = window.THREE;
    if (game.ship) game.scene.remove(game.ship);

    const placeholder = createShipMesh(THREE, shipId, tier, { silhouette: false });
    placeholder.scale.setScalar(12);
    game.ship = placeholder;
    game.scene.add(game.ship);

    const gltf = await loadGLBModel(THREE, shipId, tier);
    if (gltf && game.ship === placeholder) {
      game.scene.remove(placeholder);
      const group = new THREE.Group();
      const cloned = gltf.clone(true);
      const box = new THREE.Box3().setFromObject(cloned);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      cloned.scale.setScalar(2.4 / maxDim);
      cloned.rotation.y = -Math.PI / 2;
      group.add(cloned);

      const palette = paletteMap[shipId] || paletteMap.scout;
      const thruster = createThruster(THREE, tier, palette.glow || 0x38bdf8);
      thruster.position.set(-1.4, 0, 0);
      group.add(thruster);
      group.userData.thruster = thruster;

      group.scale.setScalar(12);
      game.ship = group;
      game.scene.add(game.ship);
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function updateGamePlayer(data) {
    if (!game.ready || !game.ship || !game.renderer) return;
    const tier = Number(data.tier || 1);
    const thrusterLevel = Math.max(0, Number(data.thrusterLevel || 0));
    const shieldLevel = Math.max(0, Number(data.shieldLevel || 0));
    const weaponLevel = Math.max(0, Number(data.weaponLevel || 0));
    const shooting = Boolean(data.shooting);
    const enginePulse = 1 + Math.sin(Date.now() * 0.025) * (0.12 + thrusterLevel * 0.02);

    const targetAngle = Number(data.angle || 0);
    let diff = targetAngle - (game.ship.userData.prevAngle || targetAngle);
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    game.ship.userData.prevAngle = targetAngle;

    // Real 3D banking / roll into turns
    const rollTarget = clamp(-diff * 7.5, -0.62, 0.62);
    game.ship.userData.roll = lerp(game.ship.userData.roll || 0, rollTarget, 0.2);

    // Pitch based on movement speed
    const vx = Number(data.vx || 0);
    const vy = Number(data.vy || 0);
    const speed = Math.hypot(vx, vy);
    const pitchTarget = clamp((speed / 380) * 0.24, 0, 0.3);
    game.ship.userData.pitch = lerp(game.ship.userData.pitch || 0, pitchTarget, 0.16);

    game.ship.position.set(data.x || 0, data.y || 0, 0);
    game.ship.rotation.z = targetAngle;
    game.ship.rotation.x = game.ship.userData.roll; // 3D BANKING ROLL!
    game.ship.rotation.y = Math.PI - game.ship.userData.pitch; // 3D PITCH!
    game.ship.scale.setScalar(11.8 + tier * 0.6);

    if (game.ship.userData.thruster) {
      game.ship.userData.thruster.scale.set(
        1 + thrusterLevel * 0.03,
        enginePulse * (speed > 30 ? 1.4 : 0.7),
        1 + thrusterLevel * 0.03
      );
    }

    if (game.shield) {
      const shieldRatio = Math.max(0, Math.min(1, Number(data.shieldRatio || 0)));
      game.shield.position.copy(game.ship.position);
      game.shield.scale.setScalar(16 + tier * 0.7);
      game.shield.material.opacity = shieldRatio > 0.05 ? 0.12 + shieldRatio * 0.28 + shieldLevel * 0.005 : 0;
      game.shield.rotation.z += 0.02;
    }

    if (shooting) {
      if (!game.ship.userData.flash) {
        const flash = new window.THREE.Mesh(
          new window.THREE.SphereGeometry(0.2, 8, 8),
          new window.THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
        );
        flash.position.set(2.1, 0, 0);
        game.ship.add(flash);
        game.ship.userData.flash = flash;
      }
      game.ship.userData.flash.scale.setScalar(1.2 + Math.sin(Date.now() * 0.06) * 0.6 + weaponLevel * 0.03);
      game.ship.userData.flash.material.opacity = 0.85;
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
      const s = 0.4 + (1.1 - 0.4) * t;
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
