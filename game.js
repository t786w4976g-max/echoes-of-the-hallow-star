(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const engine = new BABYLON.Engine(canvas, true, {
    antialias: true,
    preserveDrawingBuffer: false,
    stencil: true
  });

  engine.setHardwareScalingLevel(Math.min(1.45, window.devicePixelRatio || 1));

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.025, 0.04, 0.075, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.009;
  scene.fogColor = new BABYLON.Color3(0.075, 0.11, 0.18);
  scene.collisionsEnabled = true;

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    1.08,
    9,
    new BABYLON.Vector3(0, 1.4, 0),
    scene
  );
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 11;
  camera.lowerBetaLimit = 0.72;
  camera.upperBetaLimit = 1.35;
  camera.attachControl(canvas, true);
  camera.inputs.attached.pointers.buttons = [2];

  const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(-0.3, 1, 0.2), scene);
  ambient.intensity = 0.68;
  ambient.diffuse = new BABYLON.Color3(0.58, 0.67, 0.88);
  ambient.groundColor = new BABYLON.Color3(0.14, 0.11, 0.17);

  const moon = new BABYLON.DirectionalLight("moon", new BABYLON.Vector3(-0.45, -1, 0.25), scene);
  moon.position = new BABYLON.Vector3(18, 30, -18);
  moon.intensity = 1.15;

  const shadows = new BABYLON.ShadowGenerator(1024, moon);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 20;

  function pbr(name, hex, roughness = 0.85, emissive = null) {
    const material = new BABYLON.PBRMaterial(name, scene);
    material.albedoColor = BABYLON.Color3.FromHexString(hex);
    material.roughness = roughness;
    material.metallic = 0;
    if (emissive) material.emissiveColor = BABYLON.Color3.FromHexString(emissive);
    return material;
  }

  const mats = {
    grass: pbr("grass", "#294235", 1),
    path: pbr("path", "#6c5b43", 1),
    stone: pbr("stone", "#59606d", 1),
    wood: pbr("wood", "#543728", 0.95),
    roof: pbr("roof", "#392c35", 0.92),
    plaster: pbr("plaster", "#b2a891", 0.95),
    tunic: pbr("tunic", "#315e41", 0.82),
    skin: pbr("skin", "#bd8a6d", 0.9),
    dark: pbr("dark", "#151925", 0.75),
    gold: pbr("gold", "#a77a35", 0.45),
    glow: pbr("glow", "#4e91c6", 0.35, "#2b82d1"),
    npc: pbr("npc", "#6c3f38", 0.85),
    leather: pbr("leather", "#4a2f23", 0.88),
    cloakOuter: pbr("cloakOuter", "#514838", 0.92),
    cloakInner: pbr("cloakInner", "#151a36", 0.72, "#080d22"),
    hairBrown: pbr("hairBrown", "#4a2b1d", 0.86),
    boot: pbr("boot", "#3b271e", 0.92)
  };

  function terrainHeight(x, z) {
    return Math.sin(x * 0.09) * 0.45 + Math.cos(z * 0.08) * 0.38 + Math.sin((x + z) * 0.035) * 0.7;
  }

  const ground = BABYLON.MeshBuilder.CreateGround("terrain", {
    width: 110,
    height: 110,
    subdivisions: 64,
    updatable: true
  }, scene);

  const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] = terrainHeight(positions[i], positions[i + 2]);
  }
  ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
  ground.convertToFlatShadedMesh();
  ground.material = mats.grass;
  ground.receiveShadows = true;
  ground.checkCollisions = true;

  function place(mesh, x, z, yOffset = 0) {
    mesh.position.set(x, terrainHeight(x, z) + yOffset, z);
    return mesh;
  }

  function createPath(x, z, width, depth, rotation = 0) {
    const path = BABYLON.MeshBuilder.CreateBox("path", { width, height: 0.08, depth }, scene);
    place(path, x, z, 0.05);
    path.rotation.y = rotation;
    path.material = mats.path;
    path.receiveShadows = true;
    return path;
  }

  createPath(0, 5, 5, 42, 0);
  createPath(-8, -4, 4, 23, Math.PI / 2);
  createPath(9, -10, 4, 18, Math.PI / 2);

  function createHouse(name, x, z, scale = 1, guild = false) {
    const root = new BABYLON.TransformNode(name, scene);
    root.position.set(x, terrainHeight(x, z), z);

    const body = BABYLON.MeshBuilder.CreateBox(name + "-body", {
      width: (guild ? 5.8 : 4.2) * scale,
      height: (guild ? 3.6 : 2.9) * scale,
      depth: (guild ? 5.2 : 3.8) * scale
    }, scene);
    body.parent = root;
    body.position.y = body.getBoundingInfo().boundingBox.extendSize.y;
    body.material = mats.plaster;
    body.checkCollisions = true;
    body.receiveShadows = true;

    const roof = BABYLON.MeshBuilder.CreateCylinder(name + "-roof", {
      height: (guild ? 6.2 : 4.8) * scale,
      diameter: (guild ? 5.8 : 4.6) * scale,
      tessellation: 3
    }, scene);
    roof.parent = root;
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = (guild ? 4.35 : 3.45) * scale;
    roof.material = mats.roof;

    const door = BABYLON.MeshBuilder.CreateBox(name + "-door", {
      width: 1.05 * scale,
      height: 1.9 * scale,
      depth: 0.12 * scale
    }, scene);
    door.parent = root;
    door.position.set(0, 1.0 * scale, -(guild ? 2.66 : 1.96) * scale);
    door.material = mats.wood;

    [body, roof, door].forEach(m => shadows.addShadowCaster(m));

    if (guild) {
      const sign = BABYLON.MeshBuilder.CreateBox("guild-sign", {
        width: 2.5,
        height: 0.9,
        depth: 0.18
      }, scene);
      sign.parent = root;
      sign.position.set(0, 3.05, -2.82);
      sign.material = mats.wood;

      const star = BABYLON.MeshBuilder.CreatePolyhedron("guild-star", { type: 2, size: 0.35 }, scene);
      star.parent = sign;
      star.position.z = -0.15;
      star.material = mats.gold;
      shadows.addShadowCaster(sign);
      shadows.addShadowCaster(star);
    }

    return root;
  }

  createHouse("guild", 0, -15, 1.05, true);
  createHouse("house-west", -10, -6);
  createHouse("house-east", 10, -4);
  createHouse("house-northwest", -11, -17, 0.9);
  createHouse("house-northeast", 11, -18, 0.9);
  createHouse("house-southwest", -8, 13, 0.85);
  createHouse("house-southeast", 9, 14, 0.85);

  for (let i = 0; i < 62; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 20 + Math.random() * 31;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const trunk = BABYLON.MeshBuilder.CreateCylinder("tree-trunk", {
      height: 2.4 + Math.random() * 1.1,
      diameter: 0.42,
      tessellation: 7
    }, scene);
    place(trunk, x, z, 1.3);
    trunk.material = mats.wood;
    trunk.checkCollisions = true;

    const crown = BABYLON.MeshBuilder.CreateCylinder("tree-crown", {
      height: 3.8 + Math.random() * 1.4,
      diameterTop: 0,
      diameterBottom: 2.7 + Math.random(),
      tessellation: 8
    }, scene);
    crown.position.set(x, trunk.position.y + 2.8, z);
    crown.material = mats.grass;

    shadows.addShadowCaster(trunk);
    shadows.addShadowCaster(crown);
  }

  function createHumanoid(name, material, x, z) {
    const root = new BABYLON.TransformNode(name, scene);
    root.position.set(x, terrainHeight(x, z), z);

    const body = BABYLON.MeshBuilder.CreateCapsule(name + "-body", {
      height: 2.05,
      radius: 0.43,
      tessellation: 12
    }, scene);
    body.parent = root;
    body.position.y = 1.15;
    body.material = material;

    const head = BABYLON.MeshBuilder.CreateSphere(name + "-head", {
      diameter: 0.72,
      segments: 12
    }, scene);
    head.parent = root;
    head.position.y = 2.35;
    head.material = mats.skin;

    const hair = BABYLON.MeshBuilder.CreateSphere(name + "-hair", {
      diameter: 0.77,
      segments: 10,
      slice: 0.58
    }, scene);
    hair.parent = root;
    hair.position.set(0, 2.55, -0.03);
    hair.rotation.x = Math.PI;
    hair.material = mats.dark;

    [body, head, hair].forEach(m => shadows.addShadowCaster(m));
    return root;
  }

  function createKota(x, z) {
    const root = new BABYLON.TransformNode("Kota", scene);
    root.position.set(x, terrainHeight(x, z), z);

    // Torso and tunic
    const torso = BABYLON.MeshBuilder.CreateCapsule("Kota-torso", {
      height: 1.55,
      radius: 0.42,
      tessellation: 14
    }, scene);
    torso.parent = root;
    torso.position.y = 1.45;
    torso.scaling.z = 0.8;
    torso.material = mats.tunic;

    // Belt
    const belt = BABYLON.MeshBuilder.CreateTorus("Kota-belt", {
      diameter: 0.86,
      thickness: 0.10,
      tessellation: 20
    }, scene);
    belt.parent = root;
    belt.position.y = 1.18;
    belt.rotation.x = Math.PI / 2;
    belt.material = mats.leather;

    // Head
    const head = BABYLON.MeshBuilder.CreateSphere("Kota-head", { diameter: 0.72, segments: 16 }, scene);
    head.parent = root;
    head.position.y = 2.45;
    head.scaling.z = 0.92;
    head.material = mats.skin;

    // Tousled hair: cap plus clustered spikes
    const hairCap = BABYLON.MeshBuilder.CreateSphere("Kota-hair-cap", { diameter: 0.78, segments: 14, slice: 0.62 }, scene);
    hairCap.parent = root;
    hairCap.position.set(0, 2.65, -0.02);
    hairCap.rotation.x = Math.PI;
    hairCap.material = mats.hairBrown;

    for (let i = 0; i < 9; i++) {
      const spike = BABYLON.MeshBuilder.CreateCylinder("Kota-hair-spike", {
        height: 0.34 + (i % 3) * 0.035,
        diameterTop: 0,
        diameterBottom: 0.16,
        tessellation: 7
      }, scene);
      spike.parent = root;
      const a = (i / 9) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.25, 2.82 + Math.sin(i * 2.2) * 0.05, Math.sin(a) * 0.22);
      spike.rotation.z = Math.cos(a) * 0.55;
      spike.rotation.x = Math.sin(a) * 0.55;
      spike.material = mats.hairBrown;
      shadows.addShadowCaster(spike);
    }

    // Arms and fists. These nodes are animated for the punch.
    const leftShoulder = new BABYLON.TransformNode("Kota-left-shoulder", scene);
    leftShoulder.parent = root;
    leftShoulder.position.set(-0.48, 1.82, 0);
    const rightShoulder = new BABYLON.TransformNode("Kota-right-shoulder", scene);
    rightShoulder.parent = root;
    rightShoulder.position.set(0.48, 1.82, 0);

    function makeArm(side, shoulder) {
      const upper = BABYLON.MeshBuilder.CreateCapsule(`Kota-${side}-upper-arm`, { height: 0.82, radius: 0.15, tessellation: 10 }, scene);
      upper.parent = shoulder;
      upper.position.y = -0.34;
      upper.rotation.z = side === "left" ? -0.08 : 0.08;
      upper.material = mats.tunic;

      const forearm = BABYLON.MeshBuilder.CreateCapsule(`Kota-${side}-forearm`, { height: 0.72, radius: 0.14, tessellation: 10 }, scene);
      forearm.parent = shoulder;
      forearm.position.y = -0.92;
      forearm.material = mats.leather;

      const fist = BABYLON.MeshBuilder.CreateSphere(`Kota-${side}-fist`, { diameter: 0.31, segments: 10 }, scene);
      fist.parent = shoulder;
      fist.position.y = -1.32;
      fist.scaling.z = 0.85;
      fist.material = mats.skin;
      [upper, forearm, fist].forEach(m => shadows.addShadowCaster(m));
      return { shoulder, upper, forearm, fist };
    }

    const leftArm = makeArm("left", leftShoulder);
    const rightArm = makeArm("right", rightShoulder);

    // Legs and boots
    for (const side of [-1, 1]) {
      const leg = BABYLON.MeshBuilder.CreateCapsule("Kota-leg", { height: 1.2, radius: 0.18, tessellation: 10 }, scene);
      leg.parent = root;
      leg.position.set(side * 0.22, 0.55, 0);
      leg.material = mats.dark;

      const boot = BABYLON.MeshBuilder.CreateBox("Kota-boot", { width: 0.34, height: 0.52, depth: 0.48 }, scene);
      boot.parent = root;
      boot.position.set(side * 0.22, 0.20, -0.08);
      boot.material = mats.boot;
      [leg, boot].forEach(m => shadows.addShadowCaster(m));
    }

    // Cloak: outer shoulders and visible starry inner panel
    const cloakOuter = BABYLON.MeshBuilder.CreateCylinder("Kota-cloak-outer", {
      height: 1.8,
      diameterTop: 0.78,
      diameterBottom: 1.28,
      tessellation: 14,
      arc: 0.62,
      enclose: true
    }, scene);
    cloakOuter.parent = root;
    cloakOuter.position.set(0, 1.58, 0.27);
    cloakOuter.rotation.y = Math.PI / 2;
    cloakOuter.material = mats.cloakOuter;

    const cloakInner = BABYLON.MeshBuilder.CreatePlane("Kota-cloak-inner", { width: 1.05, height: 1.55 }, scene);
    cloakInner.parent = root;
    cloakInner.position.set(0, 1.48, 0.63);
    cloakInner.rotation.y = Math.PI;
    cloakInner.material = mats.cloakInner;

    // Star pendant
    const pendant = BABYLON.MeshBuilder.CreatePolyhedron("Kota-star-pendant", { type: 2, size: 0.17 }, scene);
    pendant.parent = root;
    pendant.position.set(0, 1.95, -0.43);
    pendant.material = mats.glow;

    // Cross-body strap and satchel
    const strap = BABYLON.MeshBuilder.CreateBox("Kota-strap", { width: 0.09, height: 1.35, depth: 0.05 }, scene);
    strap.parent = root;
    strap.position.set(0, 1.55, -0.42);
    strap.rotation.z = -0.52;
    strap.material = mats.leather;

    const satchel = BABYLON.MeshBuilder.CreateBox("Kota-satchel", { width: 0.58, height: 0.45, depth: 0.22 }, scene);
    satchel.parent = root;
    satchel.position.set(0.48, 1.08, 0.22);
    satchel.material = mats.leather;

    [torso, belt, head, hairCap, cloakOuter, cloakInner, pendant, strap, satchel].forEach(m => shadows.addShadowCaster(m));

    return { root, leftArm, rightArm, cloakOuter, cloakInner, pendant };
  }

  const kota = createKota(0, 13);
  const player = kota.root;
  const rowan = createHumanoid("Guild Master Rowan", mats.npc, 0, -10.2);
  rowan.rotation.y = Math.PI;

  const objective = rowan;
  let currentQuest = "rowan";
  let hp = 100;
  let gameStarted = false;
  let dialogueOpen = false;
  let attacking = false;
  let rolling = false;
  let moveX = 0;
  let moveY = 0;
  let gamepadAttackHeld = false;
  let gamepadRollHeld = false;

  const input = { keys: {} };
  addEventListener("keydown", e => input.keys[e.key.toLowerCase()] = true);
  addEventListener("keyup", e => input.keys[e.key.toLowerCase()] = false);

  const stick = document.getElementById("stick");
  const knob = document.getElementById("knob");
  let stickId = null;
  let stickCenter = { x: 0, y: 0 };

  function updateStick(event) {
    const touch = [...event.changedTouches].find(t => t.identifier === stickId);
    if (!touch) return;
    const dx = touch.clientX - stickCenter.x;
    const dy = touch.clientY - stickCenter.y;
    const length = Math.hypot(dx, dy);
    const max = 39;
    const scale = Math.min(1, max / (length || 1));
    const x = dx * scale;
    const y = dy * scale;
    knob.style.transform = `translate(${x}px,${y}px)`;
    moveX = x / max;
    moveY = y / max;
  }

  stick.addEventListener("touchstart", event => {
    const rect = stick.getBoundingClientRect();
    stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    stickId = event.changedTouches[0].identifier;
    updateStick(event);
  }, { passive: false });

  stick.addEventListener("touchmove", event => {
    event.preventDefault();
    updateStick(event);
  }, { passive: false });

  function releaseStick() {
    stickId = null;
    moveX = 0;
    moveY = 0;
    knob.style.transform = "translate(0,0)";
  }

  stick.addEventListener("touchend", releaseStick);
  stick.addEventListener("touchcancel", releaseStick);

  function toast(message) {
    const element = document.getElementById("toast");
    element.textContent = message;
    element.classList.add("show");
    setTimeout(() => element.classList.remove("show"), 1400);
  }

  function punch() {
    if (attacking || dialogueOpen) return;
    attacking = true;

    const button = document.getElementById("attack");
    button.classList.add("active");
    const start = performance.now();
    const duration = 300;

    const timer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / duration);
      const thrust = Math.sin(progress * Math.PI);
      const windup = Math.sin(Math.min(progress * 1.8, 1) * Math.PI) * 0.18;

      kota.rightArm.shoulder.rotation.x = -thrust * 1.55;
      kota.rightArm.shoulder.rotation.z = -windup;
      kota.rightArm.shoulder.position.z = -thrust * 0.38;
      kota.leftArm.shoulder.rotation.x = thrust * 0.18;
      player.rotation.y += thrust * 0.002;

      if (progress >= 1) {
        clearInterval(timer);
        kota.rightArm.shoulder.rotation.set(0, 0, 0);
        kota.rightArm.shoulder.position.set(0.48, 1.82, 0);
        kota.leftArm.shoulder.rotation.set(0, 0, 0);
        attacking = false;
        button.classList.remove("active");
      }
    }, 16);

    navigator.vibrate?.(18);
  }

  function roll() {
    if (rolling || dialogueOpen) return;
    rolling = true;
    const button = document.getElementById("roll");
    button.classList.add("active");
    setTimeout(() => { rolling = false; button.classList.remove("active"); }, 430);
  }

  document.getElementById("attack").addEventListener("pointerdown", punch);
  document.getElementById("roll").addEventListener("pointerdown", roll);

  const rowanDialogue = [
    ["Guild Master Rowan", "There you are. Eighteen years old today, and already late for your first assignment."],
    ["Kota", "What is the assignment?"],
    ["Guild Master Rowan", "A blue light appeared near Bramble Cave before dawn. The wildlife fled the valley, and two scouts have not returned."],
    ["Guild Master Rowan", "Take the eastern road and investigate. Do not enter the lower ruins alone."],
    ["System", "NEW ASSIGNMENT — Follow the eastern road to the Hollow Beacon."]
  ];

  const beaconDialogue = [
    ["Astraea", "At last, the lost child reaches a place erased from mortal memory."],
    ["Kota", "Who are you?"],
    ["Astraea", "I am Astraea, keeper of the hour between moments. Vaelgor is devouring Zandria's history."],
    ["Astraea", "Take the first Star. Let what has been broken remember what it was."],
    ["System", "STAR OF ECHOES AWAKENED."]
  ];

  let activeDialogue = [];
  let dialogueIndex = 0;

  function beginDialogue(lines) {
    dialogueOpen = true;
    activeDialogue = lines;
    dialogueIndex = 0;
    document.getElementById("dialogue").classList.add("show");
    showDialogueLine();
  }

  function showDialogueLine() {
    document.getElementById("speaker").textContent = activeDialogue[dialogueIndex][0];
    document.getElementById("line").textContent = activeDialogue[dialogueIndex][1];
  }

  document.getElementById("dialogue").addEventListener("pointerdown", () => {
    dialogueIndex++;
    if (dialogueIndex >= activeDialogue.length) {
      dialogueOpen = false;
      document.getElementById("dialogue").classList.remove("show");

      if (currentQuest === "rowan") {
        currentQuest = "beacon";
        document.getElementById("quest-text").textContent = "Reach the Hollow Beacon";
        toast("Assignment accepted");
      } else if (currentQuest === "beacon") {
        currentQuest = "return";
        document.getElementById("quest-text").textContent = "Return to Ashbrook";
        toast("Star System Unlocked");
      }
      return;
    }
    showDialogueLine();
  });

  const beaconRoot = new BABYLON.TransformNode("Hollow Beacon", scene);
  beaconRoot.position.set(30, terrainHeight(30, -8), -8);

  for (let i = 0; i < 6; i++) {
    const pillar = BABYLON.MeshBuilder.CreateBox("ruin-pillar", {
      width: 1.2,
      height: 3.2 + Math.random() * 2.6,
      depth: 1.2
    }, scene);
    const angle = i * Math.PI / 3;
    pillar.parent = beaconRoot;
    pillar.position.set(Math.cos(angle) * 4, pillar.getBoundingInfo().boundingBox.extendSize.y, Math.sin(angle) * 4);
    pillar.material = mats.stone;
    pillar.receiveShadows = true;
    shadows.addShadowCaster(pillar);
  }

  const beacon = BABYLON.MeshBuilder.CreatePolyhedron("star-beacon", { type: 2, size: 1.15 }, scene);
  beacon.parent = beaconRoot;
  beacon.position.y = 3.25;
  beacon.material = mats.glow;

  const beaconLight = new BABYLON.PointLight("beacon-light", new BABYLON.Vector3(0, 3.25, 0), scene);
  beaconLight.parent = beaconRoot;
  beaconLight.diffuse = new BABYLON.Color3(0.25, 0.65, 1);
  beaconLight.intensity = 18;
  beaconLight.range = 20;

  const particles = new BABYLON.ParticleSystem("star-dust", 450, scene);
  particles.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
  particles.emitter = beacon;
  particles.minEmitBox = new BABYLON.Vector3(-0.2, -0.2, -0.2);
  particles.maxEmitBox = new BABYLON.Vector3(0.2, 0.2, 0.2);
  particles.color1 = new BABYLON.Color4(0.2, 0.65, 1, 1);
  particles.color2 = new BABYLON.Color4(0.8, 0.9, 1, 0.7);
  particles.minSize = 0.05;
  particles.maxSize = 0.18;
  particles.minLifeTime = 0.8;
  particles.maxLifeTime = 2.4;
  particles.emitRate = 95;
  particles.direction1 = new BABYLON.Vector3(-0.5, 0.6, -0.5);
  particles.direction2 = new BABYLON.Vector3(0.5, 1.6, 0.5);
  particles.gravity = new BABYLON.Vector3(0, 0.15, 0);
  particles.start();

  function getObjective() {
    if (currentQuest === "rowan") return rowan.position;
    if (currentQuest === "beacon") return beaconRoot.position;
    return new BABYLON.Vector3(0, terrainHeight(0, -15), -15);
  }

  function readGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    const status = document.getElementById("controller-status");

    if (!pad) {
      status.classList.remove("show");
      return { x: 0, y: 0, cameraX: 0, cameraY: 0 };
    }

    status.classList.add("show");
    const deadzone = value => Math.abs(value) < 0.16 ? 0 : value;
    const attackPressed = !!pad.buttons[0]?.pressed;
    const rollPressed = !!pad.buttons[1]?.pressed;

    if (attackPressed && !gamepadAttackHeld) punch();
    if (rollPressed && !gamepadRollHeld) roll();
    gamepadAttackHeld = attackPressed;
    gamepadRollHeld = rollPressed;

    return {
      x: deadzone(pad.axes[0] || 0),
      y: deadzone(pad.axes[1] || 0),
      cameraX: deadzone(pad.axes[2] || 0),
      cameraY: deadzone(pad.axes[3] || 0)
    };
  }

  scene.onBeforeRenderObservable.add(() => {
    if (!gameStarted || dialogueOpen) return;

    const dt = Math.min(0.033, engine.getDeltaTime() / 1000);
    const gamepad = readGamepad();
    let x = moveX + gamepad.x + (input.keys["d"] ? 1 : 0) - (input.keys["a"] ? 1 : 0);
    let y = moveY + gamepad.y + (input.keys["s"] ? 1 : 0) - (input.keys["w"] ? 1 : 0);
    camera.alpha += gamepad.cameraX * dt * 2.2;
    camera.beta = BABYLON.Scalar.Clamp(camera.beta + gamepad.cameraY * dt * 1.5, camera.lowerBetaLimit, camera.upperBetaLimit);
    const inputLength = Math.hypot(x, y);

    if (inputLength > 1) {
      x /= inputLength;
      y /= inputLength;
    }

    if (inputLength > 0.08) {
      const forward = camera.getForwardRay().direction;
      forward.y = 0;
      forward.normalize();
      const right = BABYLON.Vector3.Cross(BABYLON.Axis.Y, forward).normalize();
      const direction = right.scale(x).add(forward.scale(-y)).normalize();
      const speed = rolling ? 10 : 4.8;

      player.position.addInPlace(direction.scale(speed * dt));
      player.rotation.y = Math.atan2(direction.x, direction.z);
      player.position.y = terrainHeight(player.position.x, player.position.z);

      if (!attacking) {
        const swing = Math.sin(performance.now() * 0.009) * Math.min(inputLength, 1) * 0.32;
        kota.leftArm.shoulder.rotation.x = swing;
        kota.rightArm.shoulder.rotation.x = -swing;
      }
    } else if (!attacking) {
      kota.leftArm.shoulder.rotation.x *= 0.82;
      kota.rightArm.shoulder.rotation.x *= 0.82;
    }

    kota.cloakOuter.rotation.z = Math.sin(performance.now() * 0.0022) * 0.025;
    kota.pendant.rotation.y += dt * 0.8;

    player.position.x = BABYLON.Scalar.Clamp(player.position.x, -52, 52);
    player.position.z = BABYLON.Scalar.Clamp(player.position.z, -52, 52);

    camera.target = BABYLON.Vector3.Lerp(
      camera.target,
      player.position.add(new BABYLON.Vector3(0, 1.45, 0)),
      0.1
    );

    beacon.rotation.y += dt * 0.65;

    const target = getObjective();
    const delta = target.subtract(player.position);
    const distance = Math.round(Math.hypot(delta.x, delta.z));
    document.getElementById("objective-distance").textContent = distance + " m";

    const desiredAngle = Math.atan2(delta.x, delta.z) - camera.alpha - Math.PI / 2;
    document.querySelector("#objective-marker .arrow").style.transform = `rotate(${desiredAngle}rad)`;

    const prompt = document.getElementById("interaction-prompt");
    const rowanDistance = BABYLON.Vector3.Distance(player.position, rowan.position);
    const beaconDistance = BABYLON.Vector3.Distance(player.position, beaconRoot.position);

    const nearRowan = currentQuest === "rowan" && rowanDistance < 3.2;
    const nearBeacon = currentQuest === "beacon" && beaconDistance < 4.1;

    prompt.textContent = nearRowan ? "Talk to Rowan" : nearBeacon ? "Touch the Beacon" : "";
    prompt.classList.toggle("show", nearRowan || nearBeacon);

    if (nearRowan && rowanDistance < 2.1) beginDialogue(rowanDialogue);
    if (nearBeacon && beaconDistance < 2.8) beginDialogue(beaconDialogue);
  });

  document.getElementById("begin").addEventListener("click", () => {
    document.getElementById("title-screen").style.display = "none";
    gameStarted = true;
    canvas.focus();
    toast("Welcome to Ashbrook");
  });

  engine.runRenderLoop(() => scene.render());
  addEventListener("resize", () => engine.resize());
})();
