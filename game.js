(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const engine = new BABYLON.Engine(canvas, true, {
    antialias: true,
    preserveDrawingBuffer: false,
    stencil: true
  });
  engine.setHardwareScalingLevel(Math.min(1.45, window.devicePixelRatio || 1));

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.70, 0.82, 0.95, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.004;
  scene.fogColor = new BABYLON.Color3(0.72, 0.82, 0.93);
  scene.collisionsEnabled = true;

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    1.08,
    9,
    new BABYLON.Vector3(0, 1.45, 0),
    scene
  );
  camera.lowerRadiusLimit = 5.8;
  camera.upperRadiusLimit = 12;
  camera.lowerBetaLimit = 0.65;
  camera.upperBetaLimit = 1.30;
  camera.attachControl(canvas, true);
  camera.inputs.attached.pointers.buttons = [2];
  camera.checkCollisions = true;
  camera.collisionRadius = new BABYLON.Vector3(0.55, 0.55, 0.55);

  const sky = new BABYLON.HemisphericLight("sky", new BABYLON.Vector3(0.15, 1, 0.18), scene);
  sky.intensity = 0.72;
  sky.diffuse = new BABYLON.Color3(0.83, 0.89, 1.0);
  sky.groundColor = new BABYLON.Color3(0.28, 0.25, 0.20);

  const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.6, -1, 0.35), scene);
  sun.position = new BABYLON.Vector3(26, 42, -20);
  sun.intensity = 1.35;
  sun.diffuse = new BABYLON.Color3(1.0, 0.95, 0.84);

  const shadows = new BABYLON.ShadowGenerator(2048, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 16;
  shadows.darkness = 0.35;

  function pbr(name, hex, roughness = 0.85, emissive = null) {
    const m = new BABYLON.PBRMaterial(name, scene);
    m.albedoColor = BABYLON.Color3.FromHexString(hex);
    m.roughness = roughness;
    m.metallic = 0;
    if (emissive) m.emissiveColor = BABYLON.Color3.FromHexString(emissive);
    return m;
  }

  const mats = {
    grass: pbr("grass", "#688551", 1),
    grassDark: pbr("grassDark", "#506842", 1),
    grassTall: pbr("grassTall", "#7b9a5a", 1),
    dirt: pbr("dirt", "#8b7456", 1),
    cobble: pbr("cobble", "#7e7a74", 1),
    stone: pbr("stone", "#7f827f", 1),
    stoneDark: pbr("stoneDark", "#656965", 1),
    plaster: pbr("plaster", "#c5b9a4", 0.95),
    wood: pbr("wood", "#6b4a33", 0.96),
    beam: pbr("beam", "#4b3527", 0.95),
    roof: pbr("roof", "#5b453f", 0.95),
    foliageA: pbr("folA", "#547249", 1),
    foliageB: pbr("folB", "#6f8b56", 1),
    foliageC: pbr("folC", "#465f3b", 1),
    leather: pbr("leather", "#5a3c28", 0.92),
    tunic: pbr("tunic", "#466843", 0.86),
    skin: pbr("skin", "#c39375", 0.9),
    hair: pbr("hair", "#5d3d24", 0.88),
    cloakOuter: pbr("cloakOuter", "#6a573f", 0.93),
    cloakInner: pbr("cloakInner", "#1a2244", 0.78, "#0b1024"),
    pendant: pbr("pendant", "#4f8cc6", 0.35, "#2f7ed0"),
    gold: pbr("gold", "#b28a4e", 0.42),
    npc: pbr("npc", "#8a5a49", 0.88),
    water: pbr("water", "#6ea3bf", 0.28, "#3a677d")
  };

  function terrainHeight(x, z) {
    const broad = Math.sin(x * 0.06) * 0.55 + Math.cos(z * 0.055) * 0.45;
    const rolling = Math.sin((x + z) * 0.035) * 0.7 + Math.cos((x - z) * 0.03) * 0.35;
    const flatten = Math.max(0, 1 - Math.hypot(x * 0.08, (z + 4) * 0.08));
    return broad + rolling * (1 - flatten * 0.55);
  }

  const ground = BABYLON.MeshBuilder.CreateGround("terrain", {
    width: 120,
    height: 120,
    subdivisions: 88,
    updatable: true
  }, scene);
  const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], z = positions[i + 2];
    positions[i + 1] = terrainHeight(x, z);
  }
  ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
  ground.convertToFlatShadedMesh();
  ground.material = mats.grass;
  ground.receiveShadows = true;
  ground.checkCollisions = true;

  function place(mesh, x, z, yOff = 0) {
    mesh.position.set(x, terrainHeight(x, z) + yOff, z);
    return mesh;
  }

  function vec2Dist(a, b, x, z) {
    return Math.hypot(x - a, z - b);
  }

  const roadRects = [
    {x: 0, z: 1, w: 5.8, d: 43},
    {x: 14, z: -8, w: 31, d: 4.4},
    {x: -9.5, z: -6, w: 4.2, d: 18}
  ];

  function onRoad(x, z) {
    return roadRects.some(r => Math.abs(x - r.x) < r.w / 2 && Math.abs(z - r.z) < r.d / 2);
  }

  function nearVillage(x, z) {
    return Math.abs(x) < 18 && z > -24 && z < 20;
  }

  function createPatch(x, z, w, d, mat, y = 0.05) {
    const patch = BABYLON.MeshBuilder.CreateBox("patch", {width: w, depth: d, height: 0.08}, scene);
    place(patch, x, z, y);
    patch.material = mat;
    patch.receiveShadows = true;
    return patch;
  }

  // Packed dirt under roads
  createPatch(0, 1, 6.4, 43.5, mats.dirt);
  createPatch(14, -8, 31.5, 4.9, mats.dirt);
  createPatch(-9.5, -6, 4.7, 18.5, mats.dirt);

  function createCobbleStreet(x, z, w, d) {
    const cols = Math.floor(w / 0.92);
    const rows = Math.floor(d / 0.92);
    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        const px = x - w / 2 + 0.45 + ix * (w / cols) + (Math.random() - 0.5) * 0.08;
        const pz = z - d / 2 + 0.45 + iz * (d / rows) + (Math.random() - 0.5) * 0.08;
        const stone = BABYLON.MeshBuilder.CreateBox("cobble", {
          width: 0.7 + Math.random() * 0.15,
          depth: 0.68 + Math.random() * 0.16,
          height: 0.12 + Math.random() * 0.05
        }, scene);
        place(stone, px, pz, 0.06);
        stone.material = Math.random() < 0.35 ? mats.stoneDark : mats.cobble;
        stone.rotation.y = Math.random() * 0.2;
        stone.receiveShadows = true;
      }
    }
  }

  createCobbleStreet(0, 0.5, 5.3, 28.5);
  createCobbleStreet(-0.5, -14.1, 8.8, 7.2);
  createCobbleStreet(14, -8, 18.4, 3.4);

  function createRock(x, z, s = 1) {
    const rock = BABYLON.MeshBuilder.CreatePolyhedron("rock", {type: 1, size: 0.9 * s}, scene);
    place(rock, x, z, 0.45 * s);
    rock.scaling.y = 0.65 + Math.random() * 0.25;
    rock.scaling.x = 0.8 + Math.random() * 0.35;
    rock.scaling.z = 0.8 + Math.random() * 0.35;
    rock.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
    rock.material = Math.random() < 0.5 ? mats.stone : mats.stoneDark;
    rock.checkCollisions = true;
    rock.receiveShadows = true;
    shadows.addShadowCaster(rock);
    return rock;
  }

  [
    [-17, -13, 1.4], [-15, -1, 1.1], [16, 4, 1.3], [19, -16, 1.2],
    [24, -5, 1.5], [8, 20, 1.0], [-24, 11, 1.6], [26, 11, 1.2],
    [31, -12, 1.4], [-27, -20, 1.8], [12, -25, 1.3]
  ].forEach(r => createRock(r[0], r[1], r[2]));

  function createBarrel(x, z) {
    const barrel = BABYLON.MeshBuilder.CreateCylinder("barrel", {height: 0.9, diameter: 0.7, tessellation: 10}, scene);
    place(barrel, x, z, 0.45);
    barrel.material = mats.wood;
    const band1 = BABYLON.MeshBuilder.CreateTorus("band", {thickness: 0.04, diameter: 0.72, tessellation: 12}, scene);
    band1.parent = barrel; band1.rotation.x = Math.PI / 2; band1.position.y = 0.22; band1.material = mats.stoneDark;
    const band2 = band1.clone("band2"); band2.parent = barrel; band2.position.y = -0.22;
    shadows.addShadowCaster(barrel);
  }

  function createCrate(x, z, s = 1) {
    const crate = BABYLON.MeshBuilder.CreateBox("crate", {size: 0.8 * s}, scene);
    place(crate, x, z, 0.4 * s);
    crate.material = mats.wood;
    shadows.addShadowCaster(crate);
  }

  function createLamp(x, z) {
    const pole = BABYLON.MeshBuilder.CreateCylinder("lampPole", {height: 2.6, diameter: 0.14}, scene);
    place(pole, x, z, 1.3);
    pole.material = mats.beam;
    const arm = BABYLON.MeshBuilder.CreateBox("lampArm", {width: 0.7, height: 0.08, depth: 0.08}, scene);
    arm.parent = pole; arm.position.set(0.25, 1.0, 0); arm.material = mats.beam;
    const lantern = BABYLON.MeshBuilder.CreateBox("lantern", {width: 0.22, height: 0.3, depth: 0.22}, scene);
    lantern.parent = pole; lantern.position.set(0.55, 0.8, 0); lantern.material = mats.gold;
    const glow = new BABYLON.PointLight("lampGlow", pole.position.add(new BABYLON.Vector3(0.55, 2.1, 0)), scene);
    glow.diffuse = new BABYLON.Color3(1, 0.84, 0.58); glow.intensity = 0.35; glow.range = 4.5;
    shadows.addShadowCaster(pole);
  }

  function createBuilding(name, x, z, opts = {}) {
    const root = new BABYLON.TransformNode(name, scene);
    root.position.set(x, terrainHeight(x, z), z);
    root.rotation.y = opts.rot || 0;
    const w = opts.w || 4.5, d = opts.d || 3.9, h = opts.h || 2.8;

    const foundation = BABYLON.MeshBuilder.CreateBox(name + "-foundation", {width: w + 0.6, depth: d + 0.6, height: 0.7}, scene);
    foundation.parent = root; foundation.position.y = 0.35; foundation.material = mats.stone; foundation.checkCollisions = true; foundation.receiveShadows = true;

    const body = BABYLON.MeshBuilder.CreateBox(name + "-body", {width: w, depth: d, height: h}, scene);
    body.parent = root; body.position.y = h / 2 + 0.7; body.material = mats.plaster; body.checkCollisions = true; body.receiveShadows = true;

    const roof = BABYLON.MeshBuilder.CreateCylinder(name + "-roof", {height: d + 0.8, diameter: w + 1.0, tessellation: 3}, scene);
    roof.parent = root; roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.position.y = h + 1.5; roof.material = mats.roof;

    const porch = BABYLON.MeshBuilder.CreateBox(name + "-porch", {width: 1.9, depth: 1.15, height: 0.18}, scene);
    porch.parent = root; porch.position.set(0, 0.8, -d / 2 - 0.55); porch.material = mats.wood;

    const door = BABYLON.MeshBuilder.CreateBox(name + "-door", {width: 1.0, height: 1.8, depth: 0.12}, scene);
    door.parent = root; door.position.set(0, 1.62, -d / 2 - 0.02); door.material = mats.beam;

    const postL = BABYLON.MeshBuilder.CreateCylinder(name + "-postL", {height: 1.6, diameter: 0.13}, scene);
    postL.parent = root; postL.position.set(-0.8, 1.5, -d / 2 - 0.55); postL.material = mats.beam;
    const postR = postL.clone(name + "-postR"); postR.parent = root; postR.position.x = 0.8;

    const beamY = [1.45, h + 0.45];
    beamY.forEach(y => {
      const b1 = BABYLON.MeshBuilder.CreateBox(name + "-beam-" + y, {width: w + 0.08, height: 0.16, depth: 0.18}, scene);
      b1.parent = root; b1.position.set(0, y, -d / 2 - 0.01); b1.material = mats.beam;
      const b2 = b1.clone(name + "-beamb-" + y); b2.parent = root; b2.position.z = d / 2 + 0.01;
      const s1 = BABYLON.MeshBuilder.CreateBox(name + "-sidebeam-" + y, {width: 0.18, height: 0.16, depth: d + 0.02}, scene);
      s1.parent = root; s1.position.set(-w / 2 - 0.01, y, 0); s1.material = mats.beam;
      const s2 = s1.clone(name + "-sidebeam2-" + y); s2.parent = root; s2.position.x = w / 2 + 0.01;
    });

    const vxs = [-w / 2 + 0.28, 0, w / 2 - 0.28];
    vxs.forEach(vx => {
      const front = BABYLON.MeshBuilder.CreateBox(name + "-frontV" + vx, {width: 0.14, height: h, depth: 0.18}, scene);
      front.parent = root; front.position.set(vx, h / 2 + 0.7, -d / 2 - 0.01); front.material = mats.beam;
      const back = front.clone(name + "-backV" + vx); back.parent = root; back.position.z = d / 2 + 0.01;
    });

    const windowXs = [-1.25, 1.25].map(v => v * (w / 4.5));
    windowXs.forEach((vx, i) => {
      const win = BABYLON.MeshBuilder.CreateBox(name + "-window" + i, {width: 0.7, height: 0.8, depth: 0.08}, scene);
      win.parent = root; win.position.set(vx, 1.95, -d / 2 - 0.06); win.material = mats.pendant;
      const frame = BABYLON.MeshBuilder.CreateBox(name + "-frame" + i, {width: 0.82, height: 0.92, depth: 0.08}, scene);
      frame.parent = root; frame.position.set(vx, 1.95, -d / 2 - 0.08); frame.material = mats.beam;
    });

    const chimney = BABYLON.MeshBuilder.CreateBox(name + "-chimney", {width: 0.5, depth: 0.5, height: 1.4}, scene);
    chimney.parent = root; chimney.position.set(w * 0.18, h + 2.2, d * 0.1); chimney.material = mats.stoneDark;

    if (opts.guild) {
      const sign = BABYLON.MeshBuilder.CreateBox(name + "-sign", {width: 2.4, height: 0.85, depth: 0.18}, scene);
      sign.parent = root; sign.position.set(0, 2.8, -d / 2 - 1.2); sign.material = mats.wood;
      const star = BABYLON.MeshBuilder.CreatePolyhedron(name + "-star", {type: 2, size: 0.34}, scene);
      star.parent = sign; star.position.z = -0.16; star.material = mats.gold;
      shadows.addShadowCaster(sign); shadows.addShadowCaster(star);
    }

    [foundation, body, roof, porch, door, postL, postR, chimney].forEach(m => shadows.addShadowCaster(m));
    return root;
  }

  createBuilding("guild", 0, -15, {w: 6.1, d: 5.3, h: 3.5, guild: true});
  createBuilding("west-house", -10.5, -5.5, {w: 4.5, d: 4.0, h: 2.7, rot: 0.05});
  createBuilding("east-house", 10.5, -3.5, {w: 4.6, d: 4.1, h: 2.8, rot: -0.08});
  createBuilding("northwest-house", -11.5, -17.5, {w: 3.9, d: 3.5, h: 2.4, rot: -0.03});
  createBuilding("northeast-house", 11.4, -18.3, {w: 3.8, d: 3.4, h: 2.45, rot: 0.07});
  createBuilding("southwest-house", -8.3, 13.4, {w: 3.8, d: 3.4, h: 2.4, rot: 0.1});
  createBuilding("southeast-house", 8.7, 14.1, {w: 3.8, d: 3.5, h: 2.45, rot: -0.08});
  createBuilding("smithy", -2.8, 10.2, {w: 4.4, d: 3.8, h: 2.6, rot: -0.04});

  // Props
  createBarrel(-1.1, -10.7); createBarrel(1.4, -10.5); createCrate(-2.1, -10.2, 0.9);
  createCrate(8.0, -2.0, 1.1); createBarrel(8.8, -1.2);
  createCrate(-7.4, 14.8, 0.95); createBarrel(-6.8, 14.2);
  createLamp(-2.3, -0.5); createLamp(2.4, -0.2); createLamp(11.2, -8.0);

  function createTree(x, z, variant = 0) {
    const root = new BABYLON.TransformNode("tree", scene);
    root.position.set(x, terrainHeight(x, z), z);
    root.rotation.y = Math.random() * Math.PI * 2;
    const trunkH = 2.5 + Math.random() * 1.3 + variant * 0.12;
    const trunk = BABYLON.MeshBuilder.CreateCylinder("trunk", {height: trunkH, diameterTop: 0.28, diameterBottom: 0.45, tessellation: 7}, scene);
    trunk.parent = root; trunk.position.y = trunkH / 2; trunk.material = mats.wood; trunk.checkCollisions = true;
    shadows.addShadowCaster(trunk);

    const foliages = [];
    if (variant % 4 === 0) {
      for (let i = 0; i < 3; i++) {
        const cone = BABYLON.MeshBuilder.CreateCylinder("fol", {height: 2.1 - i * 0.25, diameterTop: 0, diameterBottom: 2.6 - i * 0.3, tessellation: 8}, scene);
        cone.parent = root; cone.position.y = trunkH + 0.7 + i * 0.82; cone.material = [mats.foliageA, mats.foliageB, mats.foliageC][i % 3]; foliages.push(cone);
      }
    } else if (variant % 4 === 1) {
      const sphere1 = BABYLON.MeshBuilder.CreateSphere("fol1", {diameter: 2.7, segments: 8}, scene);
      sphere1.parent = root; sphere1.position.set(0, trunkH + 1.1, 0); sphere1.material = mats.foliageB; foliages.push(sphere1);
      const sphere2 = BABYLON.MeshBuilder.CreateSphere("fol2", {diameter: 2.1, segments: 8}, scene);
      sphere2.parent = root; sphere2.position.set(0.65, trunkH + 1.9, 0.2); sphere2.material = mats.foliageA; foliages.push(sphere2);
      const sphere3 = BABYLON.MeshBuilder.CreateSphere("fol3", {diameter: 1.8, segments: 8}, scene);
      sphere3.parent = root; sphere3.position.set(-0.75, trunkH + 1.7, 0.25); sphere3.material = mats.foliageC; foliages.push(sphere3);
    } else if (variant % 4 === 2) {
      const low = BABYLON.MeshBuilder.CreateCylinder("folA", {height: 1.8, diameterTop: 1.8, diameterBottom: 2.8, tessellation: 8}, scene);
      low.parent = root; low.position.y = trunkH + 0.8; low.material = mats.foliageC; foliages.push(low);
      const top = BABYLON.MeshBuilder.CreateCylinder("folB", {height: 2.0, diameterTop: 0.4, diameterBottom: 2.0, tessellation: 8}, scene);
      top.parent = root; top.position.y = trunkH + 2.0; top.material = mats.foliageA; foliages.push(top);
    } else {
      const sphere = BABYLON.MeshBuilder.CreateSphere("folX", {diameter: 2.4, segments: 8}, scene);
      sphere.parent = root; sphere.position.set(0, trunkH + 1.0, 0); sphere.scaling.set(1.2, 0.9, 1.35); sphere.material = mats.foliageA; foliages.push(sphere);
      const branch = BABYLON.MeshBuilder.CreateCylinder("branch", {height: 1.4, diameter: 0.16, tessellation: 6}, scene);
      branch.parent = root; branch.position.set(0.65, trunkH * 0.75, 0.1); branch.rotation.z = -1.05; branch.material = mats.wood; shadows.addShadowCaster(branch);
      const tuft = BABYLON.MeshBuilder.CreateSphere("tuft", {diameter: 1.4, segments: 7}, scene);
      tuft.parent = root; tuft.position.set(1.1, trunkH + 0.15, 0.15); tuft.material = mats.foliageB; foliages.push(tuft);
    }
    foliages.forEach(f => shadows.addShadowCaster(f));
    return root;
  }

  for (let i = 0; i < 68; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 22 + Math.random() * 34;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (nearVillage(x, z) || onRoad(x, z)) continue;
    createTree(x, z, i % 6);
  }

  // Procedural grass clumps
  const swayers = [];
  const bladeA = BABYLON.MeshBuilder.CreatePlane("bladeA", {width: 0.16, height: 0.7}, scene);
  bladeA.material = mats.grassTall; bladeA.position.y = 0.35;
  const bladeB = bladeA.clone("bladeB"); bladeB.rotation.y = Math.PI / 3;
  const bladeC = bladeA.clone("bladeC"); bladeC.rotation.y = -Math.PI / 3;
  const grassMaster = BABYLON.Mesh.MergeMeshes([bladeA, bladeB, bladeC], true, true, undefined, false, true);
  grassMaster.isVisible = false;

  for (let i = 0; i < 180; i++) {
    const x = (Math.random() - 0.5) * 105;
    const z = (Math.random() - 0.5) * 105;
    if (onRoad(x, z) || nearVillage(x, z) && Math.random() < 0.75) continue;
    const inst = grassMaster.createInstance("g" + i);
    inst.position.set(x, terrainHeight(x, z), z);
    const s = 0.8 + Math.random() * 1.4;
    inst.scaling.set(s, 0.7 + Math.random() * 0.7, s);
    inst.rotation.y = Math.random() * Math.PI;
    swayers.push({mesh: inst, base: inst.rotation.y, phase: Math.random() * Math.PI * 2, amp: 0.08 + Math.random() * 0.04});
  }
  for (let i = 0; i < 90; i++) {
    const x = (Math.random() - 0.5) * 32;
    const z = (Math.random() - 0.5) * 36;
    if (onRoad(x, z)) continue;
    const inst = grassMaster.createInstance("vg" + i);
    inst.position.set(x, terrainHeight(x, z), z);
    const s = 0.55 + Math.random() * 0.6;
    inst.scaling.set(s, 0.45 + Math.random() * 0.25, s);
    inst.rotation.y = Math.random() * Math.PI;
    swayers.push({mesh: inst, base: inst.rotation.y, phase: Math.random() * Math.PI * 2, amp: 0.05});
  }

  // Small stream edge for variety
  const pond = BABYLON.MeshBuilder.CreateGround("pond", {width: 8, height: 5, subdivisions: 4}, scene);
  pond.position.set(-20.5, terrainHeight(-20.5, 18) + 0.05, 18);
  pond.rotation.y = 0.4; pond.material = mats.water;

  function createHumanoid(name, bodyMat, x, z) {
    const root = new BABYLON.TransformNode(name, scene);
    root.position.set(x, terrainHeight(x, z), z);
    const torso = BABYLON.MeshBuilder.CreateCapsule(name + "-torso", {height: 1.58, radius: 0.42, tessellation: 14}, scene);
    torso.parent = root; torso.position.y = 1.44; torso.scaling.z = 0.8; torso.material = bodyMat;
    const head = BABYLON.MeshBuilder.CreateSphere(name + "-head", {diameter: 0.72, segments: 12}, scene);
    head.parent = root; head.position.y = 2.37; head.material = mats.skin;
    const hairMain = BABYLON.MeshBuilder.CreateSphere(name + "-hair", {diameter: 0.80, segments: 10, slice: 0.58}, scene);
    hairMain.parent = root; hairMain.position.set(0, 2.57, -0.03); hairMain.rotation.x = Math.PI; hairMain.material = mats.hair;
    [torso, head, hairMain].forEach(m => shadows.addShadowCaster(m));
    return root;
  }

  function createKota(x, z) {
    const root = new BABYLON.TransformNode("Kota", scene);
    root.position.set(x, terrainHeight(x, z), z);

    const torso = BABYLON.MeshBuilder.CreateCapsule("Kota-torso", {height: 1.58, radius: 0.42, tessellation: 14}, scene);
    torso.parent = root; torso.position.y = 1.43; torso.scaling.z = 0.8; torso.material = mats.tunic;

    const head = BABYLON.MeshBuilder.CreateSphere("Kota-head", {diameter: 0.72, segments: 12}, scene);
    head.parent = root; head.position.y = 2.37; head.material = mats.skin;

    const hairBack = BABYLON.MeshBuilder.CreateSphere("Kota-hair", {diameter: 0.80, segments: 10, slice: 0.56}, scene);
    hairBack.parent = root; hairBack.position.set(0, 2.57, -0.03); hairBack.rotation.x = Math.PI; hairBack.material = mats.hair;
    const forelock1 = BABYLON.MeshBuilder.CreateSphere("Kota-fore1", {diameter: 0.18, segments: 6}, scene);
    forelock1.parent = root; forelock1.position.set(-0.13, 2.38, -0.3); forelock1.material = mats.hair;
    const forelock2 = forelock1.clone("Kota-fore2"); forelock2.parent = root; forelock2.position.set(0.08, 2.34, -0.32);

    const belt = BABYLON.MeshBuilder.CreateTorus("Kota-belt", {thickness: 0.07, diameter: 0.82, tessellation: 18}, scene);
    belt.parent = root; belt.rotation.x = Math.PI / 2; belt.position.y = 1.07; belt.material = mats.leather;

    const strap = BABYLON.MeshBuilder.CreateBox("Kota-strap", {width: 0.12, height: 1.9, depth: 0.14}, scene);
    strap.parent = root; strap.position.set(0.22, 1.55, -0.03); strap.rotation.z = 0.55; strap.material = mats.leather;

    const satchel = BABYLON.MeshBuilder.CreateBox("Kota-satchel", {width: 0.46, height: 0.5, depth: 0.22}, scene);
    satchel.parent = root; satchel.position.set(-0.46, 1.1, 0.22); satchel.rotation.z = 0.22; satchel.material = mats.leather;

    const cloakOuter = BABYLON.MeshBuilder.CreateCylinder("Kota-cloakOuter", {height: 1.62, diameterTop: 0.7, diameterBottom: 1.16, tessellation: 10, arc: 0.64}, scene);
    cloakOuter.parent = root; cloakOuter.position.set(0, 1.36, 0.28); cloakOuter.rotation.y = Math.PI / 2; cloakOuter.material = mats.cloakOuter;
    const cloakInner = BABYLON.MeshBuilder.CreateCylinder("Kota-cloakInner", {height: 1.45, diameterTop: 0.58, diameterBottom: 0.98, tessellation: 10, arc: 0.58}, scene);
    cloakInner.parent = root; cloakInner.position.set(0, 1.39, 0.19); cloakInner.rotation.y = Math.PI / 2; cloakInner.material = mats.cloakInner;

    const pendant = BABYLON.MeshBuilder.CreateSphere("Kota-pendant", {diameter: 0.16, segments: 8}, scene);
    pendant.parent = root; pendant.position.set(0, 1.83, -0.33); pendant.material = mats.pendant;

    const armL = BABYLON.MeshBuilder.CreateCapsule("Kota-armL", {height: 1.0, radius: 0.11, tessellation: 10}, scene);
    armL.parent = root; armL.position.set(-0.54, 1.48, 0); armL.rotation.z = 0.1; armL.material = mats.skin;
    const armR = armL.clone("Kota-armR"); armR.parent = root; armR.position.x = 0.54; armR.rotation.z = -0.1;

    const bracerL = BABYLON.MeshBuilder.CreateCylinder("Kota-bracerL", {height: 0.28, diameterTop: 0.22, diameterBottom: 0.24, tessellation: 10}, scene);
    bracerL.parent = root; bracerL.position.set(-0.56, 1.12, 0); bracerL.rotation.z = 0.1; bracerL.material = mats.leather;
    const bracerR = bracerL.clone("Kota-bracerR"); bracerR.parent = root; bracerR.position.x = 0.56; bracerR.rotation.z = -0.1;

    const fistL = BABYLON.MeshBuilder.CreateSphere("Kota-fistL", {diameter: 0.18, segments: 6}, scene);
    fistL.parent = root; fistL.position.set(-0.59, 0.95, 0); fistL.material = mats.skin;
    const fistR = fistL.clone("Kota-fistR"); fistR.parent = root; fistR.position.x = 0.59;

    const legL = BABYLON.MeshBuilder.CreateCapsule("Kota-legL", {height: 1.1, radius: 0.14, tessellation: 10}, scene);
    legL.parent = root; legL.position.set(-0.16, 0.48, 0); legL.material = mats.leather;
    const legR = legL.clone("Kota-legR"); legR.parent = root; legR.position.x = 0.16;

    const bootL = BABYLON.MeshBuilder.CreateBox("Kota-bootL", {width: 0.28, height: 0.26, depth: 0.58}, scene);
    bootL.parent = root; bootL.position.set(-0.16, 0.08, 0.08); bootL.material = mats.leather;
    const bootR = bootL.clone("Kota-bootR"); bootR.parent = root; bootR.position.x = 0.16;

    [torso, head, hairBack, forelock1, forelock2, belt, strap, satchel, cloakOuter, cloakInner,
      pendant, armL, armR, bracerL, bracerR, fistL, fistR, legL, legR, bootL, bootR].forEach(m => shadows.addShadowCaster(m));

    return {root, fistR, fistL, cloakOuter, pendant};
  }

  const kota = createKota(0, 15);
  const player = kota.root;
  const rowan = createHumanoid("Guild Master Rowan", mats.npc, 0, -10.5);
  rowan.rotation.y = Math.PI;

  let hp = 100;
  let gameStarted = false;
  let dialogueOpen = false;
  let punching = false;
  let rolling = false;
  let moveX = 0, moveY = 0;
  let currentQuest = "rowan";

  const rowanDialogue = [
    ["Guild Master Rowan", "There you are. Late, which is an impressive skill for your first day as a guild runner."],
    ["Kota", "You said you had work."],
    ["Guild Master Rowan", "I do. A blue beacon flared near Bramble Cave before dawn. Take the eastern road and find out why."],
    ["Guild Master Rowan", "You are not armed, so avoid trouble. If trouble refuses to avoid you, your fists will have to negotiate."],
    ["System", "NEW ASSIGNMENT — Follow the eastern road to the Hollow Beacon."]
  ];
  const beaconDialogue = [
    ["Astraea", "At last, the lost child reaches a place the world was meant to forget."],
    ["Kota", "Who are you?"],
    ["Astraea", "Astraea. Witness of time. The Demon Lord erases what he cannot conquer."],
    ["Astraea", "Take the first Star, and let broken things remember their true shape."],
    ["System", "STAR OF ECHOES AWAKENED — The path to Bramble Cave stirs."]
  ];
  let activeDialogue = [];
  let dialogueIndex = 0;

  function beginDialogue(lines) {
    if (dialogueOpen) return;
    dialogueOpen = true;
    activeDialogue = lines;
    dialogueIndex = 0;
    $("dialogue").classList.add("show");
    showDialogueLine();
  }
  function showDialogueLine() {
    $("speaker").textContent = activeDialogue[dialogueIndex][0];
    $("line").textContent = activeDialogue[dialogueIndex][1];
  }
  $("dialogue").addEventListener("pointerdown", () => {
    dialogueIndex++;
    if (dialogueIndex >= activeDialogue.length) {
      dialogueOpen = false;
      $("dialogue").classList.remove("show");
      if (currentQuest === "rowan") {
        currentQuest = "beacon";
        $("quest-text").textContent = "Reach the Hollow Beacon";
        toast("Assignment accepted");
      } else if (currentQuest === "beacon") {
        currentQuest = "return";
        $("quest-text").textContent = "Return to Ashbrook";
        toast("Star System Unlocked");
      }
      return;
    }
    showDialogueLine();
  });

  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 1400);
  }

  function flashButton(id) {
    const b = $(id); b.classList.add("active"); setTimeout(() => b.classList.remove("active"), 120);
  }

  function punch() {
    if (punching || dialogueOpen) return;
    punching = true; flashButton("attack"); navigator.vibrate?.(16);
    const start = performance.now();
    const baseX = kota.fistR.position.x;
    const baseY = kota.fistR.position.y;
    const baseL = kota.fistL.position.x;
    const h = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / 220);
      const a = Math.sin(p * Math.PI);
      kota.fistR.position.z = -a * 0.55;
      kota.fistR.position.y = baseY + a * 0.15;
      kota.fistR.position.x = baseX + a * 0.05;
      kota.fistL.position.z = -a * 0.12;
      kota.fistL.position.x = baseL - a * 0.02;
      if (p >= 1) {
        clearInterval(h);
        kota.fistR.position.set(baseX, baseY, 0);
        kota.fistL.position.set(baseL, kota.fistL.position.y, 0);
        punching = false;
      }
    }, 16);
  }

  function roll() {
    if (rolling || dialogueOpen) return;
    rolling = true; flashButton("roll"); navigator.vibrate?.(20);
    setTimeout(() => rolling = false, 420);
  }
  $("attack").addEventListener("pointerdown", punch);
  $("roll").addEventListener("pointerdown", roll);

  // Touch stick
  const input = {keys: {}};
  addEventListener("keydown", e => input.keys[e.key.toLowerCase()] = true);
  addEventListener("keyup", e => input.keys[e.key.toLowerCase()] = false);

  const stick = $("stick"), knob = $("knob");
  let stickId = null; let center = {x: 0, y: 0};
  function updateStick(e) {
    const touch = [...e.changedTouches].find(t => t.identifier === stickId); if (!touch) return;
    const dx = touch.clientX - center.x, dy = touch.clientY - center.y;
    const len = Math.hypot(dx, dy), max = 39, s = Math.min(1, max / (len || 1));
    const x = dx * s, y = dy * s; knob.style.transform = `translate(${x}px,${y}px)`; moveX = x / max; moveY = y / max;
  }
  stick.addEventListener("touchstart", e => {
    const r = stick.getBoundingClientRect(); center = {x: r.left + r.width / 2, y: r.top + r.height / 2};
    stickId = e.changedTouches[0].identifier; updateStick(e);
  }, {passive: false});
  stick.addEventListener("touchmove", e => {e.preventDefault(); updateStick(e);}, {passive: false});
  function releaseStick() { stickId = null; moveX = 0; moveY = 0; knob.style.transform = "translate(0,0)"; }
  stick.addEventListener("touchend", releaseStick); stick.addEventListener("touchcancel", releaseStick);

  // Controller support
  let padConnected = false;
  const ctrlStatus = $("controller-status");
  function updatePadStatus() {
    ctrlStatus.classList.toggle("show", padConnected);
  }
  addEventListener("gamepadconnected", () => { padConnected = true; updatePadStatus(); });
  addEventListener("gamepaddisconnected", () => { padConnected = false; updatePadStatus(); });
  let lastPadPunch = false, lastPadRoll = false;

  const beaconRoot = new BABYLON.TransformNode("Hollow Beacon", scene);
  beaconRoot.position.set(31, terrainHeight(31, -8), -8);
  for (let i = 0; i < 6; i++) {
    const pillar = BABYLON.MeshBuilder.CreateBox("pillar", {width: 1.2, height: 3.3 + Math.random() * 2.6, depth: 1.2}, scene);
    const ang = i * Math.PI / 3;
    pillar.parent = beaconRoot; pillar.position.set(Math.cos(ang) * 4.2, pillar.getBoundingInfo().boundingBox.extendSize.y, Math.sin(ang) * 4.2);
    pillar.material = i % 2 ? mats.stoneDark : mats.stone; pillar.receiveShadows = true; shadows.addShadowCaster(pillar);
  }
  createCobbleStreet(31, -8, 7.0, 7.0);
  const beacon = BABYLON.MeshBuilder.CreatePolyhedron("starBeacon", {type: 2, size: 1.15}, scene);
  beacon.parent = beaconRoot; beacon.position.y = 3.3; beacon.material = mats.pendant;
  const beaconLight = new BABYLON.PointLight("beaconLight", new BABYLON.Vector3(0, 3.3, 0), scene);
  beaconLight.parent = beaconRoot; beaconLight.diffuse = new BABYLON.Color3(0.32, 0.75, 1); beaconLight.intensity = 20; beaconLight.range = 20;
  const ps = new BABYLON.ParticleSystem("stars", 400, scene);
  ps.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
  ps.emitter = beacon; ps.minEmitBox = new BABYLON.Vector3(-0.15, -0.15, -0.15); ps.maxEmitBox = new BABYLON.Vector3(0.15, 0.15, 0.15);
  ps.color1 = new BABYLON.Color4(0.25, 0.7, 1, 1); ps.color2 = new BABYLON.Color4(0.85, 0.95, 1, 0.7);
  ps.minSize = 0.05; ps.maxSize = 0.18; ps.minLifeTime = 0.7; ps.maxLifeTime = 2.0; ps.emitRate = 90;
  ps.direction1 = new BABYLON.Vector3(-0.5, 0.6, -0.5); ps.direction2 = new BABYLON.Vector3(0.5, 1.4, 0.5); ps.gravity = new BABYLON.Vector3(0, 0.1, 0); ps.start();

  function objectivePos() {
    if (currentQuest === "rowan") return rowan.position;
    if (currentQuest === "beacon") return beaconRoot.position;
    return new BABYLON.Vector3(0, terrainHeight(0, -15), -15);
  }

  $("begin").addEventListener("click", () => {
    $("title-screen").style.display = "none";
    gameStarted = true;
    toast("Welcome to Ashbrook");
    canvas.focus();
  });

  scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() * 0.001;
    sun.direction = new BABYLON.Vector3(-0.58 + Math.sin(t * 0.05) * 0.06, -1, 0.34);
    beacon.rotation.y += engine.getDeltaTime() * 0.0007;
    kota.cloakOuter.rotation.z = Math.sin(t * 2.2) * 0.03;
    kota.pendant.scaling.setAll(1 + Math.sin(t * 3.2) * 0.06);
    swayers.forEach(s => { s.mesh.rotation.y = s.base + Math.sin(t * 1.9 + s.phase) * s.amp; });

    const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (pad) {
      padConnected = true;
      updatePadStatus();
      moveX = Math.abs(pad.axes[0]) > 0.15 ? pad.axes[0] : moveX;
      moveY = Math.abs(pad.axes[1]) > 0.15 ? pad.axes[1] : moveY;
      if (Math.abs(pad.axes[0]) <= 0.15 && Math.abs(pad.axes[1]) <= 0.15 && !stickId) { moveX = 0; moveY = 0; }
      if (Math.abs(pad.axes[2]) > 0.18) camera.alpha += pad.axes[2] * 0.05;
      if (Math.abs(pad.axes[3]) > 0.18) camera.beta = BABYLON.Scalar.Clamp(camera.beta + pad.axes[3] * 0.03, camera.lowerBetaLimit, camera.upperBetaLimit);
      const punchBtn = !!(pad.buttons[0] && pad.buttons[0].pressed);
      const rollBtn = !!(pad.buttons[1] && pad.buttons[1].pressed);
      if (punchBtn && !lastPadPunch) punch();
      if (rollBtn && !lastPadRoll) roll();
      lastPadPunch = punchBtn; lastPadRoll = rollBtn;
    } else if (padConnected) {
      padConnected = false; updatePadStatus();
    }

    if (!gameStarted || dialogueOpen) return;
    const dt = Math.min(0.033, engine.getDeltaTime() / 1000);
    let x = moveX + (input.keys['d'] ? 1 : 0) - (input.keys['a'] ? 1 : 0);
    let y = moveY + (input.keys['s'] ? 1 : 0) - (input.keys['w'] ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }

    if (len > 0.08) {
      const forward = camera.getForwardRay().direction; forward.y = 0; forward.normalize();
      const right = BABYLON.Vector3.Cross(BABYLON.Axis.Y, forward).normalize();
      const dir = right.scale(x).add(forward.scale(-y)).normalize();
      const speed = rolling ? 8.8 : 4.5;
      player.position.addInPlace(dir.scale(speed * dt));
      player.rotation.y = Math.atan2(dir.x, dir.z);
      player.position.y = terrainHeight(player.position.x, player.position.z);
    }

    player.position.x = BABYLON.Scalar.Clamp(player.position.x, -55, 55);
    player.position.z = BABYLON.Scalar.Clamp(player.position.z, -55, 55);

    camera.target = BABYLON.Vector3.Lerp(camera.target, player.position.add(new BABYLON.Vector3(0, 1.4, 0)), 0.12);

    // simple building avoidance boxes
    const blockers = [
      {x:0,z:-15,w:7.2,d:6.4},{x:-10.5,z:-5.5,w:5.2,d:4.8},{x:10.5,z:-3.5,w:5.2,d:4.9},
      {x:-11.5,z:-17.5,w:4.6,d:4.2},{x:11.4,z:-18.3,w:4.6,d:4.2},{x:-8.3,z:13.4,w:4.5,d:4.2},
      {x:8.7,z:14.1,w:4.5,d:4.2},{x:-2.8,z:10.2,w:5.1,d:4.6}
    ];
    blockers.forEach(b => {
      const dx = player.position.x - b.x, dz = player.position.z - b.z;
      if (Math.abs(dx) < b.w / 2 && Math.abs(dz) < b.d / 2) {
        if (Math.abs(dx / b.w) > Math.abs(dz / b.d)) player.position.x = b.x + Math.sign(dx || 1) * b.w / 2;
        else player.position.z = b.z + Math.sign(dz || 1) * b.d / 2;
      }
    });

    const target = objectivePos();
    const delta = target.subtract(player.position);
    const dist = Math.round(Math.hypot(delta.x, delta.z));
    $("objective-distance").textContent = dist + " m";
    const desiredAngle = Math.atan2(delta.x, delta.z) - camera.alpha - Math.PI / 2;
    document.querySelector("#objective-marker .arrow").style.transform = `rotate(${desiredAngle}rad)`;

    const rowanDist = BABYLON.Vector3.Distance(player.position, rowan.position);
    const beaconDist = BABYLON.Vector3.Distance(player.position, beaconRoot.position);
    const nearRowan = currentQuest === "rowan" && rowanDist < 3.2;
    const nearBeacon = currentQuest === "beacon" && beaconDist < 4.0;
    const prompt = $("interaction-prompt");
    prompt.textContent = nearRowan ? "Talk to Rowan" : nearBeacon ? "Touch the Beacon" : "";
    prompt.classList.toggle("show", nearRowan || nearBeacon);
    if (nearRowan && rowanDist < 2.1) beginDialogue(rowanDialogue);
    if (nearBeacon && beaconDist < 2.8) beginDialogue(beaconDialogue);
  });

  engine.runRenderLoop(() => scene.render());
  addEventListener("resize", () => engine.resize());
})();
