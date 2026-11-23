import * as THREE from 'three';
import { PALETTE, WATER_LEVEL } from './config.js';

function createMiniLegoGroup(voxels, legoBrickTex) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: legoBrickTex, roughness: 0.35, metalness: 0.04 });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(geo, mat, voxels.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  voxels.forEach((v, i) => {
    dummy.position.set(v.x, v.y, v.z);
    dummy.scale.set(v.sx ?? 1, v.sy ?? 1, v.sz ?? 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, col.setHex(v.c));
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.instanceColor.needsUpdate = true;
  group.add(inst);
  return group;
}

function createLegoMinifig({ shirtCol, pantsCol, hatCol = null, sitting = false }) {
  const g = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);

  const legMat = new THREE.MeshStandardMaterial({ color: pantsCol, roughness: 0.4 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: shirtCol, roughness: 0.35 });
  const headMat = new THREE.MeshStandardMaterial({ color: PALETTE.legoYellow, roughness: 0.32 });

  const leftLeg = new THREE.Mesh(box, legMat);
  leftLeg.scale.set(0.18, 0.38, 0.2);
  const rightLeg = new THREE.Mesh(box, legMat);
  rightLeg.scale.set(0.18, 0.38, 0.2);

  if (sitting) {
    leftLeg.position.set(-0.11, 0.14, 0.16);
    leftLeg.rotation.x = -Math.PI * 0.45;
    rightLeg.position.set(0.11, 0.14, 0.16);
    rightLeg.rotation.x = -Math.PI * 0.45;
  } else {
    leftLeg.position.set(-0.11, 0.19, 0);
    rightLeg.position.set(0.11, 0.19, 0);
  }
  leftLeg.castShadow = true;
  rightLeg.castShadow = true;

  const torso = new THREE.Mesh(box, torsoMat);
  torso.scale.set(0.42, 0.44, 0.24);
  torso.position.y = sitting ? 0.42 : 0.6;
  torso.castShadow = true;

  const leftArm = new THREE.Mesh(box, torsoMat);
  leftArm.scale.set(0.13, 0.36, 0.15);
  leftArm.position.set(-0.28, sitting ? 0.42 : 0.6, 0);
  const rightArm = new THREE.Mesh(box, torsoMat);
  rightArm.scale.set(0.13, 0.36, 0.15);
  rightArm.position.set(0.28, sitting ? 0.42 : 0.6, 0);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10), headMat);
  head.position.y = sitting ? 0.8 : 0.98;
  head.castShadow = true;

  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 8), headMat);
  stud.position.y = sitting ? 0.98 : 1.16;

  g.add(leftLeg, rightLeg, torso, leftArm, rightArm, head, stud);

  if (hatCol !== null) {
    const hatMat = new THREE.MeshStandardMaterial({ color: hatCol, roughness: 0.35 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 10), hatMat);
    brim.position.y = (sitting ? 0.92 : 1.1) + 0.02;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.14, 10), hatMat);
    crown.position.y = (sitting ? 0.92 : 1.1) + 0.1;
    g.add(brim, crown);
  }

  return { group: g, leftLeg, rightLeg, leftArm, rightArm };
}

export function createLivingEntities(scene, world, legoBrickTex, onWaterSplash) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  // -------------------------------------------------------------------------
  // 1. ROTATING WINDMILL SAILS
  // -------------------------------------------------------------------------
  const wmVoxels = [{ x: 0, y: 0, z: 0, sx: 0.7, sy: 0.7, sz: 0.9, c: PALETTE.woodDark }];
  for (let i = 1; i <= 4; i++) {
    wmVoxels.push({ x: 0, y: i * 0.85, z: 0.25, sx: 0.28, sy: 0.85, sz: 0.22, c: PALETTE.woodDark });
    wmVoxels.push({ x: 0, y: -i * 0.85, z: 0.25, sx: 0.28, sy: 0.85, sz: 0.22, c: PALETTE.woodDark });
    wmVoxels.push({ x: i * 0.85, y: 0, z: 0.25, sx: 0.85, sy: 0.28, sz: 0.22, c: PALETTE.woodDark });
    wmVoxels.push({ x: -i * 0.85, y: 0, z: 0.25, sx: 0.85, sy: 0.28, sz: 0.22, c: PALETTE.woodDark });
    if (i >= 2) {
      wmVoxels.push({ x: 0.42, y: i * 0.85, z: 0.22, sx: 0.65, sy: 0.72, sz: 0.12, c: PALETTE.sailWhite });
      wmVoxels.push({ x: -0.42, y: -i * 0.85, z: 0.22, sx: 0.65, sy: 0.72, sz: 0.12, c: PALETTE.sailWhite });
      wmVoxels.push({ x: i * 0.85, y: -0.42, z: 0.22, sx: 0.72, sy: 0.65, sz: 0.12, c: PALETTE.sailWhite });
      wmVoxels.push({ x: -i * 0.85, y: 0.42, z: 0.22, sx: 0.72, sy: 0.65, sz: 0.12, c: PALETTE.sailWhite });
    }
  }
  const windmillSails = createMiniLegoGroup(wmVoxels, legoBrickTex);
  windmillSails.position.set(world.wmPos.x, 9.2, world.wmPos.z + 1.55);
  scene.add(windmillSails);

  // -------------------------------------------------------------------------
  // 2. LIGHTHOUSE VOLUMETRIC ROTATING BEAM
  // -------------------------------------------------------------------------
  const lighthouseBeamGroup = new THREE.Group();
  lighthouseBeamGroup.position.set(world.lhPos.x, 12.45, world.lhPos.z);

  const beamGeo = new THREE.ConeGeometry(4.2, 26, 20, 1, true);
  beamGeo.translate(0, -13, 0);
  beamGeo.rotateX(Math.PI / 2);

  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0.0 },
      uColor: { value: new THREE.Color(0xffe69c) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        float distFade = pow(vUv.y, 1.7);
        float edgeFade = pow(abs(dot(vNormalView, vViewDir)), 1.4);
        gl_FragColor = vec4(uColor, distFade * edgeFade * uOpacity * 0.44);
      }
    `,
  });
  const beam1 = new THREE.Mesh(beamGeo, beamMat);
  const beam2 = new THREE.Mesh(beamGeo, beamMat);
  beam2.rotation.y = Math.PI;
  lighthouseBeamGroup.add(beam1, beam2);
  scene.add(lighthouseBeamGroup);

  // -------------------------------------------------------------------------
  // 3. SAILBOAT (Auto-cruise OR Player-Steerable WASD) + DOCKED SKIFF
  // -------------------------------------------------------------------------
  const boatVoxels = [];
  for (let z = -2; z <= 2; z++) {
    const w = Math.abs(z) === 2 ? 0 : 1;
    for (let x = -w; x <= w; x++) {
      boatVoxels.push({ x: x * 0.65, y: 0, z: z * 0.65, sx: 0.65, sy: 0.55, sz: 0.65, c: PALETTE.hullBlue });
      boatVoxels.push({ x: x * 0.65, y: 0.45, z: z * 0.65, sx: 0.68, sy: 0.35, sz: 0.68, c: PALETTE.sailWhite });
    }
  }
  for (let y = 1; y <= 5; y++) {
    boatVoxels.push({ x: 0, y: y * 0.62, z: 0, sx: 0.24, sy: 0.65, sz: 0.24, c: PALETTE.woodDark });
  }
  [
    { y: 1.4, w: 3, c: PALETTE.sailWhite },
    { y: 2.0, w: 3, c: PALETTE.sailRed },
    { y: 2.6, w: 2, c: PALETTE.sailWhite },
    { y: 3.15, w: 1, c: PALETTE.sailRed },
  ].forEach((r) => {
    for (let i = 0; i < r.w; i++) {
      boatVoxels.push({ x: 0.18, y: r.y, z: 0.35 + i * 0.52, sx: 0.18, sy: 0.56, sz: 0.52, c: r.c });
    }
  });

  const sailboat = createMiniLegoGroup(boatVoxels, legoBrickTex);
  const captain = createLegoMinifig({ shirtCol: 0x2c66b8, pantsCol: 0x1d2d44, hatCol: 0xf9fafb, sitting: false });
  captain.group.position.set(0, 0.65, -0.85);
  captain.group.scale.setScalar(0.85);
  sailboat.add(captain.group);

  const boatLantern = new THREE.PointLight(0xffcb69, 0, 8);
  boatLantern.position.set(0, 1.4, -0.8);
  sailboat.add(boatLantern);
  sailboat.position.set(21.5, WATER_LEVEL + 0.06, 0);
  scene.add(sailboat);

  const boatState = {
    x: 21.5,
    z: 0,
    heading: Math.PI,
    speed: 0,
    autoAngle: 0,
    wakeTimer: 0,
  };

  // Docked fishing boat
  const fishingBoat = createMiniLegoGroup([
    { x: 0, y: 0, z: -0.7, sx: 0.7, sy: 0.42, sz: 0.7, c: PALETTE.woodMid },
    { x: 0, y: 0, z: 0, sx: 1.15, sy: 0.42, sz: 0.85, c: PALETTE.roofRed },
    { x: 0, y: 0, z: 0.7, sx: 0.7, sy: 0.42, sz: 0.7, c: PALETTE.woodMid },
    { x: 0, y: 0.32, z: 0, sx: 0.9, sy: 0.22, sz: 0.3, c: PALETTE.woodLight },
  ], legoBrickTex);
  fishingBoat.position.set(5.6, WATER_LEVEL, 12.2);
  fishingBoat.rotation.y = 0.28;
  scene.add(fishingBoat);

  // -------------------------------------------------------------------------
  // 4. LEGO MINIFIGURES (Walkers, Pier Fisherman, Beach Campers)
  // -------------------------------------------------------------------------
  const walkers = [
    {
      fig: createLegoMinifig({ shirtCol: 0xe63946, pantsCol: 0x2b4c7e, hatCol: 0xf4a261 }),
      p0: new THREE.Vector3(-1.5, 3.0, 4.3),
      p1: new THREE.Vector3(6.2, 3.0, 4.3),
      speed: 0.16,
      phase: 0.1,
    },
    {
      fig: createLegoMinifig({ shirtCol: 0x2a9d8f, pantsCol: 0x3d405b, hatCol: null }),
      p0: new THREE.Vector3(2.4, 3.0, 3.5),
      p1: new THREE.Vector3(2.4, 3.0, 5.4),
      speed: 0.24,
      phase: 1.8,
    },
    {
      fig: createLegoMinifig({ shirtCol: 0xf4a261, pantsCol: 0x264653, hatCol: 0xe76f51 }),
      p0: new THREE.Vector3(-10.5, 3.0, 3.0),
      p1: new THREE.Vector3(-7.4, 3.0, 3.0),
      speed: 0.18,
      phase: 3.1,
      bridgeArch: true,
    },
  ];
  walkers.forEach((w) => scene.add(w.fig.group));

  // Fisherman sitting at the end of wooden pier
  const fisherman = createLegoMinifig({ shirtCol: 0x457b9d, pantsCol: 0x1d3557, hatCol: 0xe9c46a, sitting: true });
  fisherman.group.position.set(2.5, 2.02, 14.2);
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.2), new THREE.MeshStandardMaterial({ color: 0x8d5524 }));
  rod.position.set(0.32, 0.72, 1.0);
  rod.rotation.x = -0.32;
  const bobber = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0xe63946 }));
  bobber.position.set(0.32, -0.65, 2.2);
  fisherman.group.add(rod, bobber);
  scene.add(fisherman.group);

  // Two campers waving around the beach campfire
  const camper1 = createLegoMinifig({ shirtCol: 0xe76f51, pantsCol: 0x354f52, sitting: true });
  camper1.group.position.set(-5.8, 3.0, 6.7);
  camper1.group.rotation.y = Math.PI * 0.42;
  scene.add(camper1.group);

  const camper2 = createLegoMinifig({ shirtCol: 0x9b5de5, pantsCol: 0x2b2d42, hatCol: 0xffd166, sitting: true });
  camper2.group.position.set(-5.8, 3.0, 7.3);
  camper2.group.rotation.y = Math.PI * 0.56;
  scene.add(camper2.group);

  // -------------------------------------------------------------------------
  // 5. LEAPING VOXEL DOLPHINS & UNDERWATER SEA TURTLE / TROPICAL FISH
  // -------------------------------------------------------------------------
  function createVoxelDolphin() {
    return createMiniLegoGroup([
      { x: 0, y: 0, z: 0.75, sx: 0.32, sy: 0.25, sz: 0.45, c: 0x7398b8 }, // snout
      { x: 0, y: 0.06, z: 0.2, sx: 0.56, sy: 0.48, sz: 0.85, c: 0x5c85a8 }, // torso
      { x: 0, y: -0.14, z: 0.2, sx: 0.46, sy: 0.18, sz: 0.72, c: 0xd9e8f5 }, // belly
      { x: 0, y: 0.42, z: 0.05, sx: 0.14, sy: 0.36, sz: 0.32, c: 0x4b7091 }, // dorsal fin
      { x: 0, y: 0.02, z: -0.55, sx: 0.38, sy: 0.32, sz: 0.72, c: 0x5c85a8 }, // tail stock
      { x: 0, y: 0.02, z: -1.05, sx: 0.85, sy: 0.12, sz: 0.32, c: 0x4b7091 }, // tail fluke
    ], legoBrickTex);
  }

  const dolphins = [
    { mesh: createVoxelDolphin(), orbitR: 17.5, baseAngle: 0.55, period: 7.2, phase: 0, splashedOut: false, splashedIn: false },
    { mesh: createVoxelDolphin(), orbitR: 18.8, baseAngle: 0.72, period: 7.2, phase: 0.55, splashedOut: false, splashedIn: false },
  ];
  dolphins.forEach((d) => scene.add(d.mesh));

  // Underwater green sea turtle
  const turtle = createMiniLegoGroup([
    { x: 0, y: 0.1, z: 0, sx: 0.85, sy: 0.32, sz: 1.0, c: 0x2d7a47 }, // shell
    { x: 0, y: 0.25, z: 0, sx: 0.55, sy: 0.14, sz: 0.68, c: 0x3fa35b }, // shell top
    { x: 0, y: 0.08, z: 0.66, sx: 0.34, sy: 0.26, sz: 0.36, c: 0x62bd68 }, // head
    { x: -0.58, y: 0.04, z: 0.22, sx: 0.42, sy: 0.1, sz: 0.26, c: 0x52ad5a },
    { x: 0.58, y: 0.04, z: 0.22, sx: 0.42, sy: 0.1, sz: 0.26, c: 0x52ad5a },
    { x: -0.46, y: 0.04, z: -0.4, sx: 0.28, sy: 0.1, sz: 0.22, c: 0x52ad5a },
    { x: 0.46, y: 0.04, z: -0.4, sx: 0.28, sy: 0.1, sz: 0.22, c: 0x52ad5a },
  ], legoBrickTex);
  scene.add(turtle);

  // Tropical Fish school in shallow turquoise bay
  const fishColors = [0xffb703, 0xfb8500, 0x00e5ff, 0xff4d6d];
  const fishGroup = [];
  for (let i = 0; i < 8; i++) {
    const fMat = new THREE.MeshStandardMaterial({ color: fishColors[i % fishColors.length], roughness: 0.3 });
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.42), fMat);
    scene.add(f);
    fishGroup.push({ mesh: f, offset: i * 0.78, rad: 2.2 + (i % 3) * 0.85, depth: 0.8 + (i % 2) * 0.18 });
  }

  // -------------------------------------------------------------------------
  // 6. DRIFTING COLORFUL HOT AIR BALLOON (with glowing night burner!)
  // -------------------------------------------------------------------------
  const balloonVoxels = [];
  const stripeColors = [0xe63946, 0xffbe0b, 0x3a86ff, 0xff006e, 0x06d6a0];
  const layers = [
    { y: 2.0, r: 1 },
    { y: 2.8, r: 2 },
    { y: 3.6, r: 2.5 },
    { y: 4.4, r: 2.5 },
    { y: 5.2, r: 2 },
    { y: 6.0, r: 1.2 },
  ];
  layers.forEach((l) => {
    const ri = Math.ceil(l.r);
    for (let dx = -ri; dx <= ri; dx++) {
      for (let dz = -ri; dz <= ri; dz++) {
        const d = Math.hypot(dx, dz);
        if (d <= l.r + 0.15 && d >= Math.max(0, l.r - 1.15)) {
          const angleIdx = Math.abs(Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * 10)) % stripeColors.length;
          balloonVoxels.push({ x: dx * 0.72, y: l.y, z: dz * 0.72, sx: 0.74, sy: 0.82, sz: 0.74, c: stripeColors[angleIdx] });
        }
      }
    }
  });
  // Wicker basket + ropes
  balloonVoxels.push({ x: 0, y: 0, z: 0, sx: 1.15, sy: 0.9, sz: 1.15, c: PALETTE.woodMid });
  [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].forEach(([rx, rz]) => {
    balloonVoxels.push({ x: rx, y: 1.0, z: rz, sx: 0.1, sy: 1.4, sz: 0.1, c: PALETTE.woodDark });
  });

  const hotAirBalloon = createMiniLegoGroup(balloonVoxels, legoBrickTex);
  const burnerFlame = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.55, 0.45),
    new THREE.MeshBasicMaterial({ color: 0xffb703 })
  );
  burnerFlame.position.set(0, 1.55, 0);
  const balloonGlow = new THREE.PointLight(0xffa630, 0, 14, 1.5);
  balloonGlow.position.set(0, 2.2, 0);
  hotAirBalloon.add(burnerFlame, balloonGlow);
  hotAirBalloon.scale.setScalar(0.88);
  scene.add(hotAirBalloon);

  // -------------------------------------------------------------------------
  // 7. VINTAGE RED & CREAM VOXEL SEAPLANE (Biplane with Spinning Propeller)
  // -------------------------------------------------------------------------
  const seaplane = createMiniLegoGroup([
    // Fuselage
    { x: 0, y: 0, z: 0, sx: 0.72, sy: 0.72, sz: 2.8, c: PALETTE.lighthouseRed },
    { x: 0, y: 0.15, z: -0.2, sx: 0.56, sy: 0.45, sz: 0.75, c: 0x72c8f7 }, // cockpit glass
    // Upper & lower wings
    { x: 0, y: 0.62, z: 0.4, sx: 4.4, sy: 0.18, sz: 0.95, c: PALETTE.wallCream },
    { x: 0, y: -0.1, z: 0.4, sx: 3.6, sy: 0.18, sz: 0.85, c: PALETTE.lighthouseRed },
    // Tail fin & stabilizer
    { x: 0, y: 0.45, z: -1.3, sx: 0.18, sy: 0.8, sz: 0.6, c: PALETTE.wallCream },
    { x: 0, y: 0.1, z: -1.3, sx: 1.5, sy: 0.15, sz: 0.55, c: PALETTE.lighthouseRed },
    // Twin floats underneath
    { x: -0.65, y: -0.7, z: 0.35, sx: 0.32, sy: 0.28, sz: 1.9, c: PALETTE.wallCream },
    { x: 0.65, y: -0.7, z: 0.35, sx: 0.32, sy: 0.28, sz: 1.9, c: PALETTE.wallCream },
  ], legoBrickTex);
  const propeller = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.16, 0.1),
    new THREE.MeshStandardMaterial({ color: PALETTE.ironDark })
  );
  propeller.position.set(0, 0, 1.5);
  seaplane.add(propeller);
  seaplane.scale.setScalar(0.75);
  scene.add(seaplane);

  // -------------------------------------------------------------------------
  // 8. FLUFFY DRIFTING CLOUDS & GLIDING SEAGULLS
  // -------------------------------------------------------------------------
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
  });

  function createVoxelCloud(cx, cy, cz, scale = 1) {
    const g = new THREE.Group();
    [
      [0, 0, 0, 3.2, 1.1, 2.2],
      [1.1, 0.55, 0.1, 1.8, 0.9, 1.6],
      [-1.0, 0.45, -0.2, 1.7, 0.85, 1.5],
      [0.1, 0.75, 0.0, 1.5, 0.7, 1.4],
    ].forEach(([x, y, z, sx, sy, sz]) => {
      const m = new THREE.Mesh(boxGeo, cloudMat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      g.add(m);
    });
    g.position.set(cx, cy, cz);
    g.scale.setScalar(scale);
    scene.add(g);
    clouds.push({ mesh: g, speed: 0.45 + Math.random() * 0.45, baseY: cy, phase: Math.random() * Math.PI * 2 });
  }

  createVoxelCloud(-18, 19.5, -14, 1.15);
  createVoxelCloud(12, 21.0, -18, 1.35);
  createVoxelCloud(-25, 18.0, 10, 0.95);
  createVoxelCloud(22, 20.0, 8, 1.1);
  createVoxelCloud(-2, 23.0, 22, 1.2);
  createVoxelCloud(4, 18.5, -28, 1.0);

  const birds = [];
  const birdMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  for (let i = 0; i < 6; i++) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(boxGeo, birdMat);
    body.scale.set(0.18, 0.14, 0.45);
    const wingL = new THREE.Mesh(boxGeo, birdMat);
    wingL.scale.set(0.42, 0.08, 0.22);
    wingL.position.set(-0.24, 0.04, 0);
    const wingR = new THREE.Mesh(boxGeo, birdMat);
    wingR.scale.set(0.42, 0.08, 0.22);
    wingR.position.set(0.24, 0.04, 0);
    bird.add(body, wingL, wingR);
    scene.add(bird);
    birds.push({
      group: bird,
      wingL,
      wingR,
      radius: 9 + i * 2.4,
      speed: 0.28 + (i % 3) * 0.07,
      angle: i * 1.15,
      height: 13.5 + (i % 4) * 1.8,
      flapSpeed: 5.5 + i * 0.7,
    });
  }

  // -------------------------------------------------------------------------
  // UPDATE LOOP FOR ALL LIVING ENTITIES
  // -------------------------------------------------------------------------
  function update(dt, elapsed, { nightFactor, weather, sailMode, keys }) {
    const windMul = weather === 'storm' ? 2.4 : weather === 'rain' ? 1.5 : 1.0;

    // Windmill & Lighthouse beam
    windmillSails.rotation.z -= dt * 1.15 * windMul;
    lighthouseBeamGroup.rotation.y += dt * 0.72;

    // Sailboat (either player-steered or auto-cruising)
    if (sailMode) {
      const accel = (keys.forward ? 1 : 0) - (keys.backward ? 0.65 : 0);
      const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
      boatState.speed += (accel * 9.5 - boatState.speed) * Math.min(1, dt * 2.4);
      boatState.heading += steer * dt * 1.65 * (0.45 + Math.abs(boatState.speed) * 0.09);

      const nx = boatState.x + Math.sin(boatState.heading) * boatState.speed * dt;
      const nz = boatState.z + Math.cos(boatState.heading) * boatState.speed * dt;

      // Gentle island collision safety bounce
      const gx = Math.round(nx);
      const gz = Math.round(nz);
      let blocked = false;
      for (let dx = -1; dx <= 1 && !blocked; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (world.landFootprint.has(`${gx + dx},${gz + dz}`)) blocked = true;
        }
      }
      if (!blocked && Math.hypot(nx, nz) < 62) {
        boatState.x = nx;
        boatState.z = nz;
      } else {
        boatState.speed *= -0.35;
      }
      sailboat.position.set(boatState.x, WATER_LEVEL + 0.06 + Math.sin(elapsed * 2.8) * 0.09, boatState.z);
      sailboat.rotation.y = boatState.heading;
      sailboat.rotation.z = -steer * 0.14 + Math.sin(elapsed * 2.1) * 0.05;
      sailboat.rotation.x = Math.cos(elapsed * 1.6) * 0.04;
    } else {
      boatState.autoAngle += dt * 0.14;
      const orbitR = 21.5;
      boatState.x = Math.cos(boatState.autoAngle) * orbitR;
      boatState.z = Math.sin(boatState.autoAngle) * orbitR;
      boatState.heading = -boatState.autoAngle;
      boatState.speed = 3.0;
      sailboat.position.set(boatState.x, WATER_LEVEL + 0.06 + Math.sin(elapsed * 2.4) * 0.09, boatState.z);
      sailboat.rotation.y = boatState.heading;
      sailboat.rotation.z = Math.sin(elapsed * 1.9) * 0.06;
      sailboat.rotation.x = Math.cos(elapsed * 1.5) * 0.04;
    }

    // Sailboat water wake splashes
    boatState.wakeTimer -= dt;
    if (boatState.wakeTimer <= 0 && Math.abs(boatState.speed) > 1.2) {
      boatState.wakeTimer = sailMode ? 0.14 : 0.35;
      if (onWaterSplash) {
        onWaterSplash(new THREE.Vector3(boatState.x, WATER_LEVEL + 0.12, boatState.z), 4, 2.2);
      }
    }

    // Docked skiff gentle bob
    fishingBoat.position.y = WATER_LEVEL + 0.02 + Math.sin(elapsed * 2.1 + 1.2) * 0.07;
    fishingBoat.rotation.z = Math.sin(elapsed * 1.7) * 0.05;

    // Walking LEGO Minifigures
    walkers.forEach((w) => {
      const cycle = (elapsed * w.speed + w.phase) % 2;
      const forward = cycle < 1;
      const t = forward ? cycle : 2 - cycle;
      w.fig.group.position.lerpVectors(w.p0, w.p1, t);
      if (w.bridgeArch) {
        w.fig.group.position.y = 3.0 + Math.sin(t * Math.PI) * 1.02;
      }
      const target = forward ? w.p1 : w.p0;
      w.fig.group.lookAt(target.x, w.fig.group.position.y, target.z);
      const stride = Math.sin(elapsed * 7.5 + w.phase) * 0.52;
      w.fig.leftLeg.rotation.x = stride;
      w.fig.rightLeg.rotation.x = -stride;
      w.fig.leftArm.rotation.x = -stride * 0.7;
      w.fig.rightArm.rotation.x = stride * 0.7;
    });

    // Fisherman & campers lively idle
    bobber.position.y = -0.65 + Math.sin(elapsed * 3.8) * 0.07;
    camper1.rightArm.rotation.x = -0.7 + Math.sin(elapsed * 4.2) * 0.35;
    camper2.leftArm.rotation.x = -0.7 + Math.cos(elapsed * 3.6) * 0.35;

    // Leaping Dolphins
    dolphins.forEach((d) => {
      const u = ((elapsed + d.phase) % d.period) / d.period; // 0..1
      const jumpWindow = 0.28;
      if (u < jumpWindow) {
        d.mesh.visible = true;
        const jt = u / jumpWindow; // 0..1 across jump arc
        const angle = d.baseAngle + jt * 0.24 + Math.floor((elapsed + d.phase) / d.period) * 0.55;
        const x = Math.cos(angle) * d.orbitR;
        const z = Math.sin(angle) * d.orbitR;
        const y = WATER_LEVEL - 0.65 + Math.sin(jt * Math.PI) * 3.25;
        d.mesh.position.set(x, y, z);
        d.mesh.rotation.y = -angle;
        d.mesh.rotation.x = -(Math.cos(jt * Math.PI) * 0.85);

        if (jt > 0.08 && !d.splashedOut) {
          d.splashedOut = true;
          if (onWaterSplash) onWaterSplash(new THREE.Vector3(x, WATER_LEVEL + 0.15, z), 12, 4.4);
        }
        if (jt > 0.88 && !d.splashedIn) {
          d.splashedIn = true;
          if (onWaterSplash) onWaterSplash(new THREE.Vector3(x, WATER_LEVEL + 0.15, z), 14, 4.8);
        }
      } else {
        d.mesh.visible = false;
        d.splashedOut = false;
        d.splashedIn = false;
      }
    });

    // Underwater Sea Turtle & Tropical Fish
    const tAngle = elapsed * 0.26;
    turtle.position.set(9.5 + Math.cos(tAngle) * 3.8, 0.78 + Math.sin(elapsed * 1.4) * 0.08, 10.5 + Math.sin(tAngle) * 2.8);
    turtle.rotation.y = -tAngle;

    fishGroup.forEach((f) => {
      const a = elapsed * 0.75 + f.offset;
      const fx = -1.5 + Math.cos(a) * f.rad;
      const fz = 11.2 + Math.sin(a * 1.3) * (f.rad * 0.75);
      f.mesh.position.set(fx, f.depth, fz);
      f.mesh.rotation.y = -a;
    });

    // Hot Air Balloon figure-8 flight
    const bT = elapsed * 0.12;
    const balX = Math.sin(bT) * 14.5;
    const balZ = Math.sin(bT * 2) * 8.5 - 2.0;
    const balY = 14.8 + Math.sin(elapsed * 0.8) * 0.85;
    hotAirBalloon.position.set(balX, balY, balZ);
    hotAirBalloon.rotation.y = elapsed * 0.18;
    const burnerFlicker = 0.75 + Math.sin(elapsed * 12) * 0.25;
    burnerFlame.scale.set(0.85, 0.7 + burnerFlicker * 0.5, 0.85);
    balloonGlow.intensity = (1.8 + nightFactor * 9.5) * burnerFlicker;

    // Seaplane scenic circle
    const pAngle = -elapsed * 0.34;
    const pRad = 28;
    seaplane.position.set(Math.cos(pAngle) * pRad, 22.5 + Math.sin(elapsed * 0.9) * 1.1, Math.sin(pAngle) * pRad);
    seaplane.rotation.y = -pAngle + Math.PI;
    seaplane.rotation.z = -0.22;
    propeller.rotation.z += dt * 28;

    // Clouds & Seagulls
    for (const c of clouds) {
      c.mesh.position.x += c.speed * windMul * dt;
      c.mesh.position.y = c.baseY + Math.sin(elapsed * 0.6 + c.phase) * 0.35;
      if (c.mesh.position.x > 46) c.mesh.position.x = -46;
    }

    for (const b of birds) {
      b.angle += b.speed * dt;
      const x = Math.cos(b.angle) * b.radius;
      const z = Math.sin(b.angle) * b.radius;
      b.group.position.set(x, b.height + Math.sin(elapsed * 1.5 + b.angle) * 0.6, z);
      b.group.rotation.y = -b.angle;
      const flap = Math.sin(elapsed * b.flapSpeed) * 0.48;
      b.wingL.rotation.z = flap;
      b.wingR.rotation.z = -flap;
    }

    // Treasure chests bobbing beacons & lid animation
    world.chests.forEach((ch) => {
      if (!ch.opened) {
        ch.beacon.rotation.y = elapsed * 2.2 + ch.id;
        ch.beacon.position.y = 1.25 + Math.sin(elapsed * 3.0 + ch.id) * 0.16;
      } else if (ch.openProgress < 1) {
        ch.openProgress = Math.min(1, ch.openProgress + dt * 3.2);
        ch.lidPivot.rotation.x = -ch.openProgress * 1.65;
        ch.beacon.visible = false;
      }
    });
  }

  return {
    sailboat,
    boatState,
    boatLantern,
    hotAirBalloon,
    beamMat,
    cloudMat,
    update,
  };
}
