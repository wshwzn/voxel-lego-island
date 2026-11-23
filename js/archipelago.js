import * as THREE from 'three';
import { PALETTE, hash2, fbm } from './config.js';

export function buildArchipelago(scene, world, legoBrickTex) {
  const localBricks = [];
  const localStuds = [];
  const glowCrystals = [];
  const keyOf = (x, y, z) => `${x},${y},${z}`;
  const localMap = new Map();

  function addBlock(x, y, z, color, stud = true, addFootprint = true) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iz = Math.round(z);
    const k = keyOf(ix, iy, iz);
    const entry = { x: ix, y: iy, z: iz, color, stud };
    localMap.set(k, entry);
    world.solidMap.set(k, entry);
    if (addFootprint && iy >= 1 && iy <= 4) {
      world.landFootprint.add(`${ix},${iz}`);
    }
  }

  function addGlowCrystal(x, y, z, color, scaleY = 1.4) {
    glowCrystals.push({ x, y, z, color, scaleY });
  }

  // Helper to spawn extra Golden Treasure Chests registered into world.chests
  const chestWoodMat = new THREE.MeshStandardMaterial({ color: 0x8b4a1f, roughness: 0.45 });
  const chestGoldMat = new THREE.MeshStandardMaterial({
    color: PALETTE.gold,
    emissive: new THREE.Color(0xffaa00),
    emissiveIntensity: 0.5,
    roughness: 0.22,
    metalness: 0.48,
  });

  function addExtraChest(name, x, y, z, rotY = 0) {
    const idx = world.chests.length;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.46, 0.62), chestWoodMat);
    base.position.y = 0.23;
    base.castShadow = true;
    base.userData.chestIndex = idx;
    g.add(base);

    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.66), chestGoldMat);
    clasp.position.y = 0.44;
    clasp.userData.chestIndex = idx;
    g.add(clasp);

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.46, -0.31);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.22, 0.64), chestWoodMat);
    lid.position.set(0, 0.11, 0.31);
    lid.userData.chestIndex = idx;
    const lidTrim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.66), chestGoldMat);
    lidTrim.position.set(0, 0.14, 0.31);
    lidTrim.userData.chestIndex = idx;
    lidPivot.add(lid, lidTrim);
    g.add(lidPivot);

    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), chestGoldMat);
    beacon.position.y = 1.3;
    beacon.userData.chestIndex = idx;
    g.add(beacon);

    scene.add(g);
    world.chestHitMeshes.push(base, clasp, lid, lidTrim, beacon);
    world.chests.push({
      id: idx,
      name,
      group: g,
      lidPivot,
      beacon,
      opened: false,
      openProgress: 0,
      worldPos: new THREE.Vector3(x, y + 0.5, z),
    });
  }

  // =========================================================================
  // 1. 🏴‍☠️ PIRATE SKULL COVE ISLAND (Center: x = 34, z = 24)
  // =========================================================================
  const px = 34;
  const pz = 24;
  for (let dx = -11; dx <= 11; dx++) {
    for (let dz = -11; dz <= 11; dz++) {
      const dist = Math.hypot(dx / 9.8, dz / 9.2) + (fbm((px + dx) * 0.2, (pz + dz) * 0.2) - 0.5) * 0.32;
      if (dist > 1.0) continue;
      let h = 0;
      if (dist < 0.9) h = 1; // Golden beach
      if (dist < 0.68) h = 2; // Dark cliff terrace
      if (dist < 0.42 && dz < 2) h = 4 + Math.round((0.42 - dist) * 7);

      // Flat cove beach in front (south-west) for stranded Pirate Ship
      if (dx >= -7 && dx <= -1 && dz >= 2 && dz <= 7) h = Math.min(h, 1);

      for (let y = 0; y <= h; y++) {
        let col = PALETTE.sandWarm;
        if (y === 1 && h === 1) col = PALETTE.sandLight;
        else if (y >= 2) col = y >= 5 ? PALETTE.cliffDark : PALETTE.cliffMid;
        addBlock(px + dx, y, pz + dz, col, y === h);
      }
    }
  }

  // Dramatic LEGO Skull Rock Face on the crest (x = 34..38, z = 20..22, y = 4..10)
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = 0; dy <= 5; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        // Carve two deep eye sockets on front face (dz = 1)
        const isEye = dz === 1 && dy === 3 && (dx === -1 || dx === 1);
        const isNose = dz === 1 && dy === 2 && dx === 0;
        const isCorner = (dy === 5 && Math.abs(dx) === 2) || (dy === 0 && Math.abs(dx) === 2);
        if (isEye || isNose || isCorner) continue;
        const isTeeth = dz === 1 && dy === 0 && Math.abs(dx) <= 1;
        const col = isTeeth ? PALETTE.wallCream : dy >= 4 ? PALETTE.cliffLight : PALETTE.cliffDark;
        addBlock(px + 2 + dx, 4 + dy, pz - 3 + dz, col, dy === 5);
      }
    }
  }
  // Glowing Emerald Crystal Eyes inside the Skull!
  addGlowCrystal(px + 1, 7.5, pz - 2, PALETTE.crystalEmerald, 0.85);
  addGlowCrystal(px + 3, 7.5, pz - 2, PALETTE.crystalEmerald, 0.85);

  // Glowing Pirate Treasure Crystals around the rock arch
  addGlowCrystal(px + 6, 3.2, pz + 1, PALETTE.crystalPurple, 1.5);
  addGlowCrystal(px + 5, 3.0, pz + 3, PALETTE.crystalCyan, 1.2);
  addGlowCrystal(px - 2, 3.2, pz - 4, PALETTE.crystalPurple, 1.4);

  // Stranded Dark-Wood LEGO Pirate Galleon at (px - 5, z = pz + 5)
  const gx = px - 5;
  const gz = pz + 5;
  for (let lz = -3; lz <= 3; lz++) {
    const hw = Math.abs(lz) === 3 ? 0 : Math.abs(lz) === 2 ? 1 : 1;
    for (let lx = -hw; lx <= hw; lx++) {
      addBlock(gx + lx, 2, gz + lz, PALETTE.pirateHull, false);
      if (Math.abs(lx) === hw || Math.abs(lz) >= 2) {
        addBlock(gx + lx, 3, gz + lz, lz === -3 ? PALETTE.gold : PALETTE.woodDark, true);
      }
    }
  }
  // Raised stern poop deck & mast
  for (let lx = -1; lx <= 1; lx++) {
    addBlock(gx + lx, 4, gz - 2, PALETTE.pirateHull, true);
  }
  addGlowCrystal(gx, 5.2, gz - 2, PALETTE.gold, 0.65); // Stern gold lantern
  for (let y = 3; y <= 9; y++) {
    addBlock(gx, y, gz, PALETTE.woodMid, false);
  }
  // Black & White Pirate Skull Sail!
  for (let sy = 5; sy <= 8; sy++) {
    for (let sx = -2; sx <= 2; sx++) {
      const isCross = (sy === 6 || sy === 7) && sx === 0;
      const isSkullDot = sy === 7 && Math.abs(sx) === 1;
      const col = isCross || isSkullDot ? PALETTE.sailWhite : PALETTE.pirateBlack;
      addBlock(gx + sx, sy, gz + 1, col, sy === 8);
    }
  }
  // Pirate flag at top of mast
  addBlock(gx + 1, 9, gz, PALETTE.roofRed, true);

  // Pirate Island Palm Trees
  const addQuickPalm = (tx, tz, baseH = 2) => {
    addBlock(tx, baseH, tz, PALETTE.woodMid, false);
    addBlock(tx, baseH + 1, tz, PALETTE.woodLight, false);
    addBlock(tx, baseH + 2, tz, PALETTE.woodMid, false);
    addBlock(tx, baseH + 3, tz, PALETTE.palmLeaf, true);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oz]) => {
      addBlock(tx + ox, baseH + 3, tz + oz, PALETTE.palmLeaf, true);
      addBlock(tx + ox * 2, baseH + 2, tz + oz * 2, PALETTE.palmLeafTip, true);
    });
  };
  addQuickPalm(px + 6, pz + 4, 2);
  addQuickPalm(px - 6, pz - 1, 2);

  addExtraChest('海盗王骷髅宝库', px + 2, 3.0, pz + 1, 0.3);

  const pirateGlowLight = new THREE.PointLight(0x26f7a0, 0, 22, 1.5);
  pirateGlowLight.position.set(px + 2, 7.5, pz - 1);
  scene.add(pirateGlowLight);

  // =========================================================================
  // 2. 🎢 LEGO ROLLER COASTER PARK ISLAND (Center: x = -34, z = -24)
  // =========================================================================
  const cx = -34;
  const cz = -24;
  for (let dx = -12; dx <= 12; dx++) {
    for (let dz = -11; dz <= 11; dz++) {
      const dist = Math.hypot(dx / 11.2, dz / 10.2) + (fbm((cx + dx) * 0.18, (cz + dz) * 0.18) - 0.5) * 0.25;
      if (dist > 1.0) continue;
      let h = 0;
      if (dist < 0.88) h = 1;
      if (dist < 0.72) h = 2;
      if (dist < 0.42 && dx < -1 && dz < -1) h = 4; // Coaster hillock
      for (let y = 0; y <= h; y++) {
        let col = y === 0 ? PALETTE.sandWet : y === 1 ? (h === 1 ? PALETTE.sandLight : PALETTE.dirt) : PALETTE.grassBright;
        if (y === 2 && (dx + dz) % 2 === 0 && dist < 0.65) col = PALETTE.grassMeadow;
        addBlock(cx + dx, y, cz + dz, col, y === h);
      }
    }
  }

  // Coaster Station Platform & Rainbow Entrance Arch
  for (let sx = -3; sx <= 3; sx++) {
    for (let sz = 3; sz <= 6; sz++) {
      addBlock(cx + sx, 3, cz + sz, (sx + sz) % 2 === 0 ? PALETTE.cobble : PALETTE.wallCream, true);
    }
  }
  const archCols = [PALETTE.roofRed, PALETTE.autumnGold, PALETTE.grassBright, PALETTE.roofBlue, PALETTE.crystalPurple];
  for (let y = 4; y <= 7; y++) {
    addBlock(cx - 2, y, cz + 6, PALETTE.roofRed, false);
    addBlock(cx + 2, y, cz + 6, PALETTE.roofBlue, false);
  }
  for (let i = -2; i <= 2; i++) {
    addBlock(cx + i, 8, cz + 6, archCols[i + 2], true);
  }

  addExtraChest('过山车乐园黄金券宝箱', cx + 4, 3.0, cz + 4, -0.5);

  // Build 3D Smooth Catmull-Rom Roller Coaster Track!
  const coasterPts = [
    new THREE.Vector3(cx - 4, 4.2, cz + 4.5),    // Station exit
    new THREE.Vector3(cx - 9, 5.2, cz + 2.5),    // Turn to lift hill
    new THREE.Vector3(cx - 10, 12.2, cz - 4.0),  // Steep Lift Hill Climb
    new THREE.Vector3(cx - 6, 16.4, cz - 9.5),   // Summit Peak!
    new THREE.Vector3(cx + 2, 13.5, cz - 10.2),  // Crest drop
    new THREE.Vector3(cx + 10, 5.4, cz - 5.8),   // Thrilling Steep Plunge!
    new THREE.Vector3(cx + 12.5, 4.4, cz + 2.0), // Sweeping Ocean Curve
    new THREE.Vector3(cx + 7.5, 9.6, cz + 6.5),  // Airtime Camelback Hill!
    new THREE.Vector3(cx + 1.5, 4.6, cz + 4.8),  // Station Brake Run
  ];
  const coasterCurve = new THREE.CatmullRomCurve3(coasterPts, true, 'catmullrom', 0.45);

  const coasterGroup = new THREE.Group();
  const trackSamples = 140;
  const railGeoL = [];
  const railGeoR = [];
  const tieDummy = new THREE.Object3D();
  const tieMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.45, 0.18, 0.34),
    new THREE.MeshStandardMaterial({ color: PALETTE.roofRed, roughness: 0.35 }),
    trackSamples
  );
  tieMesh.castShadow = true;

  const pillarList = [];
  const upVec = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < trackSamples; i++) {
    const u = i / trackSamples;
    const p = coasterCurve.getPointAt(u);
    const tangent = coasterCurve.getTangentAt(u).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, upVec).normalize();

    railGeoL.push(p.clone().addScaledVector(right, -0.52));
    railGeoR.push(p.clone().addScaledVector(right, 0.52));

    tieDummy.position.copy(p).add(new THREE.Vector3(0, -0.1, 0));
    const lookM = new THREE.Matrix4().lookAt(p, p.clone().add(tangent), upVec);
    tieDummy.quaternion.setFromRotationMatrix(lookM);
    tieDummy.scale.set(1, 1, 1);
    tieDummy.updateMatrix();
    tieMesh.setMatrixAt(i, tieDummy.matrix);

    if (i % 7 === 0) {
      pillarList.push(p.clone());
    }
  }
  tieMesh.instanceMatrix.needsUpdate = true;
  coasterGroup.add(tieMesh);

  // Dual shiny silver rails
  const railMat = new THREE.MeshStandardMaterial({ color: 0xe6eef8, metalness: 0.65, roughness: 0.22 });
  const curveL = new THREE.CatmullRomCurve3(railGeoL, true);
  const curveR = new THREE.CatmullRomCurve3(railGeoR, true);
  coasterGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(curveL, 140, 0.1, 6, true), railMat),
    new THREE.Mesh(new THREE.TubeGeometry(curveR, 140, 0.1, 6, true), railMat)
  );

  // Vertical support pillars down to island/sea
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf4c430, roughness: 0.4 });
  pillarList.forEach((p) => {
    const h = Math.max(1, p.y - 0.5);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.45, h, 0.45), pillarMat);
    col.position.set(p.x, 0.5 + h / 2, p.z);
    col.castShadow = true;
    coasterGroup.add(col);
  });

  // Animated 3-Car LEGO Coaster Train!
  const carColors = [0xe63946, 0xffbe0b, 0x3a86ff];
  const coasterCars = carColors.map((cHex, idx) => {
    const car = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.62, 1.65),
      new THREE.MeshStandardMaterial({ map: legoBrickTex, color: cHex, roughness: 0.3 })
    );
    body.position.y = 0.48;
    body.castShadow = true;
    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(1.22, 0.24, 1.75),
      new THREE.MeshStandardMaterial({ color: 0x222630, roughness: 0.4 })
    );
    bumper.position.y = 0.2;

    // Cute LEGO rider head in each car
    const riderHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: PALETTE.legoYellow, roughness: 0.3 })
    );
    riderHead.position.set(0, 1.02, -0.1);
    const headlight = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfff5b0 })
    );
    headlight.position.set(0, 0.46, 0.85);
    car.add(body, bumper, riderHead, idx === 0 ? headlight : new THREE.Object3D());
    coasterGroup.add(car);
    return car;
  });

  scene.add(coasterGroup);

  // =========================================================================
  // 3. ☁️ FLOATING SKY TEMPLE (Center: x = 0, y = 34, z = -36)
  // =========================================================================
  const sx = 0;
  const sy = 34;
  const sz = -36;

  // Tapered floating stone & cloud underside + Marble temple platform
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 6.2) continue;
      const isTrim = d > 5.0;
      addBlock(sx + dx, sy, sz + dz, isTrim ? PALETTE.gold : PALETTE.marble, true, false);
      if (d < 5.0) addBlock(sx + dx, sy - 1, sz + dz, PALETTE.marbleTrim, false, false);
      if (d < 3.6) addBlock(sx + dx, sy - 2, sz + dz, PALETTE.cliffLight, false, false);
      if (d < 2.2) addBlock(sx + dx, sy - 3, sz + dz, PALETTE.cliffMid, false, false);
      if (d < 1.1) addBlock(sx + dx, sy - 4, sz + dz, PALETTE.cliffDark, false, false);
    }
  }
  // 6 Marble Temple Columns with Gold Capitals
  const colSpots = [[-4, -3], [4, -3], [-4, 3], [4, 3], [0, -5], [0, 5]];
  colSpots.forEach(([ox, oz]) => {
    for (let y = 1; y <= 5; y++) {
      addBlock(sx + ox, sy + y, sz + oz, y === 5 ? PALETTE.gold : PALETTE.marble, y === 5, false);
    }
  });
  // Central Golden Pedestal
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      addBlock(sx + dx, sy + 1, sz + dz, (dx === 0 && dz === 0) ? PALETTE.gold : PALETTE.marbleTrim, true, false);
    }
  }

  // Giant Hovering Rotating Cyan Sky Crystal + Golden Rune Ring
  const skyCrystalGroup = new THREE.Group();
  skyCrystalGroup.position.set(sx, sy + 4.8, sz);
  const skyCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.55, 0),
    new THREE.MeshStandardMaterial({
      color: PALETTE.crystalCyan,
      emissive: new THREE.Color(0x00d9ff),
      emissiveIntensity: 1.2,
      roughness: 0.12,
      metalness: 0.2,
    })
  );
  const runeRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.5, 0.14, 8, 28),
    new THREE.MeshStandardMaterial({
      color: PALETTE.gold,
      emissive: new THREE.Color(0xffb703),
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.6,
    })
  );
  runeRing.rotation.x = Math.PI * 0.35;
  const skyLight = new THREE.PointLight(0x38f2ff, 8, 24, 1.4);
  skyCrystalGroup.add(skyCrystal, runeRing, skyLight);
  scene.add(skyCrystalGroup);

  addExtraChest('浮空天空神殿圣匣', sx, sy + 1.0, sz + 3, Math.PI);

  // =========================================================================
  // 4. COMPILE ARCHIPELAGO INSTANCED BRICKS, STUDS & GLOW CRYSTALS
  // =========================================================================
  for (const v of localMap.values()) {
    localBricks.push(v);
    if (v.stud && !localMap.has(keyOf(v.x, v.y + 1, v.z))) {
      localStuds.push(v);
    }
  }

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const brickGeo = new THREE.BoxGeometry(1, 1, 1);
  const studGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12);

  const archBrickMat = new THREE.MeshStandardMaterial({ map: legoBrickTex, roughness: 0.36, metalness: 0.04 });
  const archBrickMesh = new THREE.InstancedMesh(brickGeo, archBrickMat, localBricks.length);
  archBrickMesh.castShadow = true;
  archBrickMesh.receiveShadow = true;

  localBricks.forEach((v, i) => {
    dummy.position.set(v.x, v.y + 0.5, v.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    archBrickMesh.setMatrixAt(i, dummy.matrix);
    tmpColor.setHex(v.color);
    const jitter = (hash2(v.x * 13.1 + v.y, v.z * 17.7) - 0.5) * 0.03;
    tmpColor.offsetHSL(0, 0, jitter);
    archBrickMesh.setColorAt(i, tmpColor);
  });
  archBrickMesh.instanceMatrix.needsUpdate = true;
  archBrickMesh.instanceColor.needsUpdate = true;
  scene.add(archBrickMesh);

  const archStudMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.05 });
  const archStudMesh = new THREE.InstancedMesh(studGeo, archStudMat, localStuds.length);
  archStudMesh.castShadow = true;
  archStudMesh.receiveShadow = true;

  localStuds.forEach((v, i) => {
    dummy.position.set(v.x, v.y + 1.08, v.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    archStudMesh.setMatrixAt(i, dummy.matrix);
    tmpColor.setHex(v.color);
    archStudMesh.setColorAt(i, tmpColor);
  });
  archStudMesh.instanceMatrix.needsUpdate = true;
  archStudMesh.instanceColor.needsUpdate = true;
  scene.add(archStudMesh);

  // Glowing crystal clusters
  glowCrystals.forEach((c) => {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({
        color: c.color,
        emissive: new THREE.Color(c.color),
        emissiveIntensity: 1.3,
        roughness: 0.15,
      })
    );
    m.position.set(c.x, c.y, c.z);
    m.scale.set(0.85, c.scaleY, 0.85);
    scene.add(m);
  });

  // Update total brick counts in world
  world.baseBrickCount += localBricks.length;
  world.baseStudCount += localStuds.length;

  // =========================================================================
  // 5. ANIMATION & ROLLER COASTER RIDE UPDATE
  // =========================================================================
  let coasterU = 0;

  function update(dt, elapsed, { nightFactor, rideCoaster, camera, controls }) {
    // Sky Temple floating crystal & rune ring
    skyCrystal.rotation.y = elapsed * 1.1;
    skyCrystal.position.y = Math.sin(elapsed * 1.8) * 0.4;
    runeRing.rotation.z = elapsed * 0.75;
    runeRing.rotation.y = elapsed * 0.45;
    pirateGlowLight.intensity = 3.5 + nightFactor * 9.5;

    // Coaster physics-feeling speed (slower up lift hill, fast plunging down!)
    const headPt = coasterCurve.getPointAt(coasterU);
    const heightRatio = Math.max(0, (17.0 - headPt.y) / 13.0); // 0 at peak, 1 at bottom
    const speed = 0.045 + heightRatio * 0.095;
    coasterU = (coasterU + speed * dt) % 1.0;

    coasterCars.forEach((car, idx) => {
      const u = (coasterU - idx * 0.017 + 1.0) % 1.0;
      const p = coasterCurve.getPointAt(u);
      const t = coasterCurve.getTangentAt(u).normalize();
      car.position.copy(p);
      const lookPos = p.clone().add(t);
      car.lookAt(lookPos);
    });

    // Rideable First-Person Front-Seat Roller Coaster Camera!
    if (rideCoaster) {
      const frontP = coasterCurve.getPointAt(coasterU);
      const frontT = coasterCurve.getTangentAt(coasterU).normalize();
      const lookAheadU = (coasterU + 0.032) % 1.0;
      const lookTarget = coasterCurve.getPointAt(lookAheadU).add(new THREE.Vector3(0, 1.0, 0));
      camera.position.copy(frontP).add(new THREE.Vector3(0, 1.48, 0)).addScaledVector(frontT, 0.2);
      camera.lookAt(lookTarget);
      controls.target.copy(lookTarget);
    }
  }

  return {
    archBrickMesh,
    archStudMesh,
    update,
  };
}
