import * as THREE from 'three';
import { PALETTE, hash2, fbm, smoothstep } from './config.js';

export function buildIslandWorld(scene, legoBrickTex) {
  const solidMap = new Map();
  const windowBlocks = [];
  const lanternBlocks = [];
  const waterVoxelBlocks = [];
  const landFootprint = new Set();
  const terrainHeight = new Map();

  const keyOf = (x, y, z) => `${x},${y},${z}`;

  function setVoxel(x, y, z, color, stud = true, meta = null) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iz = Math.round(z);
    solidMap.set(keyOf(ix, iy, iz), { x: ix, y: iy, z: iz, color, stud, meta });
  }

  function deleteVoxel(x, y, z) {
    solidMap.delete(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  function hasVoxel(x, y, z) {
    return solidMap.has(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  function addWindowVoxel(x, y, z) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iz = Math.round(z);
    solidMap.delete(keyOf(ix, iy, iz));
    windowBlocks.push({ x: ix, y: iy, z: iz });
  }

  function addLanternVoxel(x, y, z, color = 0xffd27a) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iz = Math.round(z);
    solidMap.delete(keyOf(ix, iy, iz));
    lanternBlocks.push({ x: ix, y: iy, z: iz, color });
  }

  // -------------------------------------------------------------------------
  // 1. TERRAIN HEIGHTMAP
  // -------------------------------------------------------------------------
  const GRID_MIN = -22;
  const GRID_MAX = 22;

  function computeTerrainHeight(x, z) {
    const dxMain = (x - 1.5) / 13.8;
    const dzMain = (z + 0.5) / 12.6;
    const distMain = Math.hypot(dxMain, dzMain);
    const coastNoise = (fbm(x * 0.14 + 3.2, z * 0.14 - 2.1) - 0.5) * 0.38;
    const mainMask = 1.0 - (distMain + coastNoise);

    const distBay = Math.hypot((x - 2.2) / 5.2, (z - 10.6) / 4.2);
    const bayCarve = Math.max(0, 1.0 - distBay) * 0.72;

    const distIslet = Math.hypot((x + 14.0) / 4.3, (z - 3.0) / 4.2);
    const isletNoise = (fbm(x * 0.25, z * 0.25) - 0.5) * 0.22;
    const isletMask = 1.0 - (distIslet + isletNoise);

    const distReef = Math.hypot((x - 13.5) / 3.0, (z - 8.5) / 2.6);
    const reefMask = 1.0 - distReef;

    let h = -1;
    if (isletMask > 0.02) {
      if (isletMask > 0.34) h = 2;
      else if (isletMask > 0.14) h = 1;
      else h = 0;
    }

    const effMain = mainMask - bayCarve;
    if (effMain > -0.05) {
      let mh = 0;
      if (effMain > 0.07) mh = 1;
      if (effMain > 0.22) mh = 2;
      if (effMain > 0.44) mh = 3;

      // Northeast Mountain Peak centered at (7.2, -6.8)
      const distMtn = Math.hypot((x - 7.2) / 6.8, (z + 6.8) / 6.3);
      if (distMtn < 1.0) {
        const ridge = Math.pow(1.0 - distMtn, 1.45) * 9.8 + (fbm(x * 0.28, z * 0.28) - 0.4) * 2.2;
        mh = Math.max(mh, Math.round(2 + ridge));
      }

      // Windmill Hillock centered at (-5, -6)
      const distHill = Math.hypot((x + 5.0) / 4.6, (z + 6.0) / 4.4);
      if (distHill < 1.0 && effMain > 0.16) {
        const bump = Math.round(smoothstep(1.0, 0.2, distHill) * 2.4);
        mh = Math.max(mh, 2 + bump);
      }
      h = Math.max(h, mh);
    }

    if (reefMask > 0.18) h = Math.max(h, 0);

    // Landmark flat pads
    if (Math.hypot(x + 14, z - 3) <= 2.3) h = 2;
    if (x >= -7 && x <= -3 && z >= -8 && z <= -4) h = 4;
    if (x >= -3 && x <= 8 && z >= 1 && z <= 5) h = 2;
    if (x >= -2 && x <= 2 && z >= -5 && z <= -1) h = 3;
    if (x >= -6 && x <= -2 && z >= 6 && z <= 8) h = 1;
    if (x >= 1 && x <= 9 && z >= 6 && z <= 7) h = 1;
    if (x >= -10 && x <= -8 && z >= 1 && z <= 5) h = Math.min(h, 0);

    // Crystal Mountain Lagoon & Dramatic Waterfall Cliff
    if (x >= 7 && x <= 10 && z >= -3 && z <= -1) h = 1;
    if (x >= 11 && x <= 13 && z >= -2 && z <= -1) h = Math.min(h, 1);
    if (x >= 7 && x <= 9 && z === -5) h = Math.max(h, 8);
    if (x >= 7 && x <= 8 && z === -4) h = 7;
    if (x === 9 && z === -4) h = Math.max(h, 6);

    return h;
  }

  for (let x = GRID_MIN; x <= GRID_MAX; x++) {
    for (let z = GRID_MIN; z <= GRID_MAX; z++) {
      const h = computeTerrainHeight(x, z);
      if (h < 0) continue;
      terrainHeight.set(`${x},${z}`, h);
      if (h >= 1) landFootprint.add(`${x},${z}`);

      for (let y = 0; y <= h; y++) {
        let color = PALETTE.dirt;
        let meta = 'terrain';
        const n = hash2(x * 1.7 + y * 3.1, z * 2.3 - y);

        if (y === 0) {
          color = n > 0.5 ? PALETTE.sandWet : PALETTE.sandWarm;
        } else if (y === 1) {
          if (h === 1) {
            color = n > 0.45 ? PALETTE.sandLight : PALETTE.sandWarm;
          } else {
            color = h >= 5 ? PALETTE.cliffDark : PALETTE.dirt;
          }
        } else if (y === h) {
          if (h >= 9) {
            color = n > 0.35 ? PALETTE.snow : PALETTE.snowShade;
            meta = 'peakSnow';
          } else if (h >= 6) {
            color = n > 0.5 ? PALETTE.cliffLight : PALETTE.cliffMid;
            meta = 'peakRock';
          } else {
            color = n > 0.66 ? PALETTE.grassBright : n > 0.33 ? PALETTE.grassLush : PALETTE.grassMeadow;
            meta = 'grassTop';
          }
        } else {
          if (y >= 5 || h >= 6) {
            color = n > 0.55 ? PALETTE.cliffMid : n > 0.25 ? PALETTE.cliffLight : PALETTE.cliffDark;
            if (y >= 7 && Math.hypot(x - 7.2, z + 6.8) < 4.5) meta = 'peakRock';
          } else {
            color = PALETTE.dirt;
          }
        }

        setVoxel(x, y, z, color, y === h, meta);
      }
    }
  }

  // Underwater coral reef
  const coralSpots = [
    [-12, 7], [-11, 8], [-9, 9], [10, 8], [12, 7], [13, 8], [14, 9],
    [-17, 1], [-16, 6], [13, 2], [12, -3], [1, 13], [-5, 11],
  ];
  coralSpots.forEach(([cx, cz], idx) => {
    if (!landFootprint.has(`${cx},${cz}`)) {
      const cCol = idx % 3 === 0 ? PALETTE.coralPink : idx % 3 === 1 ? PALETTE.coralOrange : PALETTE.coralPurple;
      setVoxel(cx, 0, cz, cCol, true, 'coral');
    }
  });

  // -------------------------------------------------------------------------
  // 2. CRYSTAL LAGOON & WATERFALL CASCADE
  // -------------------------------------------------------------------------
  for (let x = 7; x <= 10; x++) {
    for (let z = -3; z <= -1; z++) {
      setVoxel(x, 1, z, PALETTE.sandWarm, false);
      waterVoxelBlocks.push({ x, y: 1.78, z, scaleY: 0.62 });
    }
  }
  for (let x = 7; x <= 8; x++) {
    setVoxel(x, 6, -4, PALETTE.cliffDark, false, 'peakRock');
    deleteVoxel(x, 7, -4);
    waterVoxelBlocks.push({ x, y: 7.0, z: -4, scaleY: 0.72 });
    for (let y = 2; y <= 6; y++) {
      waterVoxelBlocks.push({ x, y: y + 0.5, z: -3.25, scaleY: 1.02 });
    }
  }
  for (let x = 11; x <= 13; x++) {
    for (let z = -2; z <= -1; z++) {
      const h = terrainHeight.get(`${x},${z}`) ?? 1;
      if (h >= 1) {
        for (let y = 2; y <= h; y++) deleteVoxel(x, y, z);
        setVoxel(x, 1, z, PALETTE.sandWet, false);
        waterVoxelBlocks.push({ x, y: 1.62, z, scaleY: 0.42 });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. HARBOR VILLAGE, COTTAGES, PIER, BRIDGE, LIGHTHOUSE & WINDMILL
  // -------------------------------------------------------------------------
  for (let x = -2; x <= 7; x++) {
    for (let z = 3; z <= 5; z++) {
      setVoxel(x, 2, z, (x + z) % 2 === 0 ? PALETTE.cobble : PALETTE.cobbleAlt, true, 'cobble');
    }
  }
  setVoxel(2, 2, 6, PALETTE.cobble, true);
  setVoxel(3, 2, 6, PALETTE.cobbleAlt, true);
  setVoxel(2, 1, 7, PALETTE.woodLight, true);
  setVoxel(3, 1, 7, PALETTE.woodLight, true);

  function buildCottage(bx, by, bz, width, depth, wallCol, roofCol, roofDarkCol) {
    const wallH = 3;
    for (let dx = 0; dx < width; dx++) {
      for (let dz = 0; dz < depth; dz++) {
        for (let dy = 0; dy < wallH; dy++) {
          const isEdge = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (!isEdge) continue;
          const isCorner = (dx === 0 || dx === width - 1) && (dz === 0 || dz === depth - 1);
          setVoxel(bx + dx, by + dy, bz + dz, isCorner ? PALETTE.wallStone : wallCol, false);
        }
      }
    }

    const midX = bx + Math.floor(width / 2);
    const midZ = bz + Math.floor(depth / 2);
    setVoxel(midX, by, bz + depth - 1, PALETTE.woodDark, false);
    setVoxel(midX, by + 1, bz + depth - 1, PALETTE.woodMid, false);
    if (width >= 4) {
      addWindowVoxel(bx + 1, by + 1, bz + depth - 1);
      addWindowVoxel(bx + width - 2, by + 1, bz + depth - 1);
    }
    addWindowVoxel(bx, by + 1, midZ);
    addWindowVoxel(bx + width - 1, by + 1, midZ);
    addWindowVoxel(midX, by + 1, bz);

    const roofBaseY = by + wallH;
    for (let layer = 0; layer <= Math.ceil(depth / 2); layer++) {
      const zStart = bz - 1 + layer;
      const zEnd = bz + depth - layer;
      if (zStart > zEnd) break;
      for (let x = bx - 1; x <= bx + width; x++) {
        for (let z = zStart; z <= zEnd; z++) {
          const isEave = z === zStart || z === zEnd || x === bx - 1 || x === bx + width;
          const col = layer % 2 === 0 ? roofCol : roofDarkCol;
          setVoxel(x, roofBaseY + layer, z, isEave ? roofDarkCol : col, true, 'roofTop');
        }
      }
    }

    const cx = bx + width - 1;
    const cz = bz;
    setVoxel(cx, roofBaseY + 1, cz, PALETTE.chimney, false);
    setVoxel(cx, roofBaseY + 2, cz, PALETTE.chimney, false);
    setVoxel(cx, roofBaseY + 3, cz, PALETTE.cliffDark, true);
    return new THREE.Vector3(cx, roofBaseY + 4.1, cz);
  }

  const chimneyPositions = [
    buildCottage(-2, 3, 0, 4, 3, PALETTE.wallCream, PALETTE.roofRed, PALETTE.roofRedDark),
    buildCottage(4, 3, 1, 4, 3, PALETTE.wallWarm, PALETTE.roofBlue, PALETTE.roofBlueDark),
    buildCottage(-2, 4, -5, 4, 3, PALETTE.wallCream, PALETTE.roofOchre, PALETTE.roofOchreDark),
  ];

  // Harbor Pier
  for (let z = 8; z <= 14; z++) {
    const plankCol = z % 2 === 0 ? PALETTE.woodLight : PALETTE.woodMid;
    setVoxel(2, 1, z, plankCol, true);
    setVoxel(3, 1, z, plankCol, true);
    if (z === 9 || z === 12 || z === 14) {
      setVoxel(1, 0, z, PALETTE.woodDark, false);
      setVoxel(1, 1, z, PALETTE.woodDark, true);
      setVoxel(4, 0, z, PALETTE.woodDark, false);
      setVoxel(4, 1, z, PALETTE.woodDark, true);
    }
  }
  setVoxel(1, 2, 14, PALETTE.ironDark, false);
  addLanternVoxel(1, 3, 14);
  setVoxel(4, 2, 14, PALETTE.ironDark, false);
  addLanternVoxel(4, 3, 14);

  [[1, 3, 5], [5, 3, 5], [-3, 3, 4]].forEach(([lx, ly, lz]) => {
    setVoxel(lx, ly, lz, PALETTE.ironDark, false);
    setVoxel(lx, ly + 1, lz, PALETTE.ironDark, false);
    addLanternVoxel(lx, ly + 2, lz);
  });

  // Arched Wooden Bridge
  for (let x = -11; x <= -7; x++) {
    const arch = x === -9 ? 3 : 2;
    for (let z = 2; z <= 4; z++) {
      setVoxel(x, arch, z, x % 2 === 0 ? PALETTE.woodLight : PALETTE.woodMid, true);
    }
    if (x === -11 || x === -9 || x === -7) {
      setVoxel(x, arch + 1, 2, PALETTE.woodDark, true);
      setVoxel(x, arch + 1, 4, PALETTE.woodDark, true);
    }
  }
  addLanternVoxel(-9, 5, 2);

  // Striped Lighthouse (-14, 3)
  const lhX = -14;
  const lhZ = 3;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      setVoxel(lhX + dx, 3, lhZ + dz, PALETTE.cliffLight, true);
    }
  }
  for (let y = 4; y <= 10; y++) {
    const col = Math.floor((y - 4) / 2) % 2 === 0 ? PALETTE.lighthouseRed : PALETTE.lighthouseWhite;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (y >= 6 && Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
        setVoxel(lhX + dx, y, lhZ + dz, col, false);
      }
    }
  }
  setVoxel(lhX + 1, 4, lhZ, PALETTE.woodDark, false);
  addWindowVoxel(lhX, 7, lhZ + 1);
  addWindowVoxel(lhX + 1, 9, lhZ);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      setVoxel(lhX + dx, 11, lhZ + dz, PALETTE.ironDark, true);
    }
  }
  addLanternVoxel(lhX, 12, lhZ, 0xfff0b0);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
      setVoxel(lhX + dx, 13, lhZ + dz, PALETTE.lighthouseRed, true, 'roofTop');
    }
  }
  setVoxel(lhX, 14, lhZ, PALETTE.lighthouseRed, true, 'roofTop');

  // Windmill Tower (-5, -6)
  const wmX = -5;
  const wmZ = -6;
  for (let y = 5; y <= 10; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (y >= 8 && Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
        const col = y === 5 ? PALETTE.cliffLight : y === 10 ? PALETTE.roofRed : PALETTE.wallCream;
        setVoxel(wmX + dx, y, wmZ + dz, col, y === 10, y === 10 ? 'roofTop' : null);
      }
    }
  }
  setVoxel(wmX, 11, wmZ, PALETTE.roofRedDark, true, 'roofTop');
  setVoxel(wmX, 5, wmZ + 1, PALETTE.woodDark, false);
  addWindowVoxel(wmX, 7, wmZ + 1);
  addWindowVoxel(wmX - 1, 8, wmZ);

  // Campfire & Beach Umbrella
  const firePos = { x: -4, y: 2, z: 7 };
  setVoxel(firePos.x - 1, firePos.y, firePos.z, PALETTE.woodDark, true);
  setVoxel(firePos.x + 1, firePos.y, firePos.z, PALETTE.woodDark, true);
  setVoxel(firePos.x, firePos.y, firePos.z - 1, PALETTE.cliffMid, false);
  setVoxel(firePos.x, firePos.y, firePos.z + 1, PALETTE.cliffMid, false);
  setVoxel(firePos.x - 2, firePos.y, firePos.z - 1, PALETTE.woodMid, true);
  setVoxel(firePos.x - 2, firePos.y, firePos.z, PALETTE.woodMid, true);

  setVoxel(7, 2, 7, PALETTE.woodLight, false);
  setVoxel(7, 3, 7, PALETTE.woodLight, false);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      setVoxel(7 + dx, 4, 7 + dz, (dx + dz) % 2 === 0 ? PALETTE.umbrellaBlue : PALETTE.umbrellaWhite, true);
    }
  }
  setVoxel(7, 5, 7, PALETTE.umbrellaBlue, true);
  setVoxel(8, 1, 7, PALETTE.roofRed, true);

  // Trees & Flowers
  function buildPineTree(tx, tz, height = 5, golden = false) {
    const groundH = terrainHeight.get(`${tx},${tz}`);
    if (groundH === undefined || groundH < 2) return;
    const by = groundH + 1;
    setVoxel(tx, by, tz, PALETTE.woodDark, false);
    setVoxel(tx, by + 1, tz, PALETTE.woodDark, false);

    const leafDark = golden ? 0xd9822b : PALETTE.pineDark;
    const leafMid = golden ? PALETTE.autumnGold : PALETTE.pineMid;
    const leafLight = golden ? 0xffc857 : PALETTE.pineLight;

    for (let layer = 0; layer < height - 1; layer++) {
      const ly = by + 1 + layer;
      const radius = layer < height - 2 ? 1 : 0;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (layer === 1 && Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
          if (layer === 2 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          if (dx === 0 && dz === 0 && layer === 0) continue;
          const col = layer === 0 ? leafDark : layer === height - 2 ? leafLight : leafMid;
          setVoxel(tx + dx, ly, tz + dz, col, true, 'treeLeaf');
        }
      }
    }
    setVoxel(tx, by + height, tz, leafLight, true, 'treeLeaf');
  }

  function buildPalmTree(tx, tz, leanX = 1, leanZ = 0) {
    const groundH = terrainHeight.get(`${tx},${tz}`);
    if (groundH === undefined || groundH < 1) return;
    const by = groundH + 1;
    setVoxel(tx, by, tz, PALETTE.woodMid, false);
    setVoxel(tx, by + 1, tz, PALETTE.woodLight, false);
    setVoxel(tx + leanX, by + 2, tz + leanZ, PALETTE.woodMid, false);
    setVoxel(tx + leanX, by + 3, tz + leanZ, PALETTE.woodLight, false);

    const cx = tx + leanX;
    const cy = by + 4;
    const cz = tz + leanZ;
    setVoxel(cx, cy, cz, PALETTE.palmLeaf, true, 'treeLeaf');
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
      setVoxel(cx + dx, cy, cz + dz, PALETTE.palmLeaf, true, 'treeLeaf');
      setVoxel(cx + dx * 2, cy - 1, cz + dz * 2, PALETTE.palmLeafTip, true, 'treeLeaf');
    });
  }

  [
    [1, -7, 5, false], [-1, -9, 6, false], [3, -10, 5, false],
    [-8, -3, 5, false], [-9, -6, 4, true], [10, -7, 5, false],
    [10, 3, 5, true], [-4, -1, 4, false], [3, -6, 5, false], [-15, 5, 4, false],
  ].forEach(([x, z, h, g]) => buildPineTree(x, z, h, g));

  buildPalmTree(-7, 6, -1, 1);
  buildPalmTree(9, 6, 1, 1);
  buildPalmTree(-12, 1, 1, -1);

  const flowerColors = [PALETTE.flowerRed, PALETTE.flowerYellow, PALETTE.flowerPink];
  for (let x = -15; x <= 12; x++) {
    for (let z = -10; z <= 8; z++) {
      const h = terrainHeight.get(`${x},${z}`);
      if ((h === 2 || h === 3 || h === 4) && hash2(x * 7.3, z * 11.9) > 0.91 && !hasVoxel(x, h + 1, z)) {
        if (x >= -2 && x <= 7 && z >= 3 && z <= 5) continue;
        const fCol = flowerColors[Math.floor(hash2(x * 3.1, z * 5.7) * 3)];
        solidMap.set(keyOf(x, h + 1, z), { x, y: h + 1, z, color: fCol, stud: false, isFlower: true });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. COMPILE INSTANCED MESHES (Bricks, Studs, Flowers, Windows, Lanterns, Lagoon)
  // -------------------------------------------------------------------------
  const brickList = [];
  const studList = [];
  const flowerList = [];
  const brickBaseColors = [];
  const studBaseColors = [];

  for (const v of solidMap.values()) {
    if (v.isFlower) {
      flowerList.push(v);
      continue;
    }
    brickList.push(v);
    if (v.stud && !solidMap.has(keyOf(v.x, v.y + 1, v.z))) {
      studList.push(v);
    }
  }

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  const brickGeo = new THREE.BoxGeometry(1, 1, 1);
  const brickMat = new THREE.MeshStandardMaterial({
    map: legoBrickTex,
    roughness: 0.36,
    metalness: 0.04,
  });

  const brickMesh = new THREE.InstancedMesh(brickGeo, brickMat, brickList.length);
  brickMesh.castShadow = true;
  brickMesh.receiveShadow = true;

  brickList.forEach((v, i) => {
    dummy.position.set(v.x, v.y + 0.5, v.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    brickMesh.setMatrixAt(i, dummy.matrix);
    const c = new THREE.Color(v.color);
    const jitter = (hash2(v.x * 13.1 + v.y, v.z * 17.7) - 0.5) * 0.035;
    c.offsetHSL(0, 0, jitter);
    brickBaseColors.push(c);
    brickMesh.setColorAt(i, c);
  });
  brickMesh.instanceMatrix.needsUpdate = true;
  brickMesh.instanceColor.needsUpdate = true;
  scene.add(brickMesh);

  const studGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12);
  const studMat = new THREE.MeshStandardMaterial({ roughness: 0.30, metalness: 0.05 });
  const studMesh = new THREE.InstancedMesh(studGeo, studMat, studList.length);
  studMesh.castShadow = true;
  studMesh.receiveShadow = true;

  studList.forEach((v, i) => {
    dummy.position.set(v.x, v.y + 1.08, v.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    studMesh.setMatrixAt(i, dummy.matrix);
    const c = new THREE.Color(v.color);
    const jitter = (hash2(v.x * 13.1 + v.y, v.z * 17.7) - 0.5) * 0.035;
    c.offsetHSL(0, 0, jitter + 0.015);
    studBaseColors.push(c);
    studMesh.setColorAt(i, c);
  });
  studMesh.instanceMatrix.needsUpdate = true;
  studMesh.instanceColor.needsUpdate = true;
  scene.add(studMesh);

  const flowerGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.24, 6);
  const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.02 });
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, Math.max(1, flowerList.length));
  flowerMesh.castShadow = true;
  flowerList.forEach((v, i) => {
    dummy.position.set(v.x, v.y + 0.12, v.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    flowerMesh.setMatrixAt(i, dummy.matrix);
    flowerMesh.setColorAt(i, tmpColor.setHex(v.color));
  });
  flowerMesh.instanceMatrix.needsUpdate = true;
  if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
  if (flowerList.length > 0) scene.add(flowerMesh);

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x7cb8e0,
    emissive: new THREE.Color(0xffb44c),
    emissiveIntensity: 0.0,
    roughness: 0.18,
    metalness: 0.1,
  });
  const windowMesh = new THREE.InstancedMesh(brickGeo, windowMat, Math.max(1, windowBlocks.length));
  windowBlocks.forEach((v, i) => {
    dummy.position.set(v.x, v.y + 0.5, v.z);
    dummy.scale.set(1.01, 1.01, 1.01);
    dummy.updateMatrix();
    windowMesh.setMatrixAt(i, dummy.matrix);
  });
  windowMesh.instanceMatrix.needsUpdate = true;
  scene.add(windowMesh);

  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xfff5d6,
    emissive: new THREE.Color(0xffcc66),
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });
  const lanternMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.68, 0.78, 0.68), lanternMat, Math.max(1, lanternBlocks.length));
  lanternBlocks.forEach((v, i) => {
    dummy.position.set(v.x, v.y + 0.45, v.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lanternMesh.setMatrixAt(i, dummy.matrix);
  });
  lanternMesh.instanceMatrix.needsUpdate = true;
  scene.add(lanternMesh);

  const pondMat = new THREE.MeshPhysicalMaterial({
    color: 0x3ce0f7,
    emissive: new THREE.Color(0x0c4c63),
    emissiveIntensity: 0.28,
    roughness: 0.10,
    metalness: 0.04,
    transparent: true,
    opacity: 0.86,
  });
  const pondMesh = new THREE.InstancedMesh(brickGeo, pondMat, Math.max(1, waterVoxelBlocks.length));
  waterVoxelBlocks.forEach((v, i) => {
    dummy.position.set(v.x, v.y, v.z);
    dummy.scale.set(1, v.scaleY, 1);
    dummy.updateMatrix();
    pondMesh.setMatrixAt(i, dummy.matrix);
  });
  pondMesh.instanceMatrix.needsUpdate = true;
  scene.add(pondMesh);

  // -------------------------------------------------------------------------
  // 5. VOLCANO CRATER GLOW MESH & LIGHT (Toggled by Volcano Mode)
  // -------------------------------------------------------------------------
  const volcanoGroup = new THREE.Group();
  const lavaPoolMat = new THREE.MeshBasicMaterial({ color: 0xff621a });
  const lavaPool = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 2.4), lavaPoolMat);
  lavaPool.position.set(7.2, 10.6, -6.8);
  volcanoGroup.add(lavaPool);

  const volcanoLight = new THREE.PointLight(0xff4f14, 0, 34, 1.4);
  volcanoLight.position.set(7.2, 13.0, -6.8);
  volcanoGroup.add(volcanoLight);
  volcanoGroup.visible = false;
  scene.add(volcanoGroup);

  // Dynamic surface theme updater (Volcano Obsidian/Magma + Winter Snow Frost)
  const snowColor = new THREE.Color(0xf1f6ff);
  const obsidianColor = new THREE.Color(0x282730);
  const ashColor = new THREE.Color(0x3f393e);
  const magmaColor = new THREE.Color(0xff5a1f);

  function updateSurfaceTheme(volcanoMode, snowAmount) {
    volcanoGroup.visible = volcanoMode;
    const targetC = new THREE.Color();

    for (let i = 0; i < brickList.length; i++) {
      const v = brickList[i];
      targetC.copy(brickBaseColors[i]);

      if (volcanoMode && (v.meta === 'peakSnow' || v.meta === 'peakRock')) {
        if (v.meta === 'peakSnow') {
          const isCrater = Math.hypot(v.x - 7.2, v.z + 6.8) < 2.2;
          targetC.copy(isCrater ? magmaColor : obsidianColor);
        } else {
          targetC.lerp(ashColor, 0.72);
        }
      } else if (snowAmount > 0.01 && (v.meta === 'grassTop' || v.meta === 'roofTop' || v.meta === 'treeLeaf')) {
        const blend = v.meta === 'treeLeaf' ? snowAmount * 0.55 : snowAmount * 0.85;
        targetC.lerp(snowColor, blend);
      }
      brickMesh.setColorAt(i, targetC);
    }
    brickMesh.instanceColor.needsUpdate = true;

    for (let i = 0; i < studList.length; i++) {
      const v = studList[i];
      targetC.copy(studBaseColors[i]);
      if (volcanoMode && (v.meta === 'peakSnow' || v.meta === 'peakRock')) {
        if (v.meta === 'peakSnow') {
          const isCrater = Math.hypot(v.x - 7.2, v.z + 6.8) < 2.2;
          targetC.copy(isCrater ? magmaColor : obsidianColor);
        } else {
          targetC.lerp(ashColor, 0.72);
        }
      } else if (snowAmount > 0.01 && (v.meta === 'grassTop' || v.meta === 'roofTop' || v.meta === 'treeLeaf')) {
        const blend = v.meta === 'treeLeaf' ? snowAmount * 0.55 : snowAmount * 0.85;
        targetC.lerp(snowColor, blend);
      }
      studMesh.setColorAt(i, targetC);
    }
    studMesh.instanceColor.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // 6. 5 HIDDEN INTERACTIVE GOLDEN LEGO TREASURE CHESTS
  // -------------------------------------------------------------------------
  const chestSpecs = [
    { name: '海滩营火秘宝', x: -6, z: 8, rotY: 0.4 },
    { name: '灯塔守望者宝匣', x: -16, z: 3, rotY: -1.2 },
    { name: '瀑布泄湖秘藏', x: 9, z: -4, rotY: 0.2 },
    { name: '风车高地金币箱', x: -7, z: -7, rotY: 0.8 },
    { name: '雪山之巅传奇宝箱', x: 5, z: -7, rotY: 0.5 },
  ];

  const chests = [];
  const chestHitMeshes = [];
  const chestWoodMat = new THREE.MeshStandardMaterial({ color: 0x8b4a1f, roughness: 0.45 });
  const chestGoldMat = new THREE.MeshStandardMaterial({
    color: PALETTE.gold,
    emissive: new THREE.Color(0xffaa00),
    emissiveIntensity: 0.45,
    roughness: 0.22,
    metalness: 0.45,
  });

  chestSpecs.forEach((spec, idx) => {
    const gh = terrainHeight.get(`${spec.x},${spec.z}`) ?? 2;
    const g = new THREE.Group();
    g.position.set(spec.x, gh + 1.0, spec.z);
    g.rotation.y = spec.rotY;

    // Base box
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.46, 0.62), chestWoodMat);
    base.position.y = 0.23;
    base.castShadow = true;
    base.userData.chestIndex = idx;
    g.add(base);

    // Gold clasp & trim
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.66), chestGoldMat);
    clasp.position.y = 0.44;
    clasp.userData.chestIndex = idx;
    g.add(clasp);

    // Hinged lid
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.46, -0.31);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.22, 0.64), chestWoodMat);
    lid.position.set(0, 0.11, 0.31);
    lid.castShadow = true;
    lid.userData.chestIndex = idx;
    const lidTrim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.66), chestGoldMat);
    lidTrim.position.set(0, 0.14, 0.31);
    lidTrim.userData.chestIndex = idx;
    lidPivot.add(lid, lidTrim);
    g.add(lidPivot);

    // Sparkling golden beacon diamond floating above unopened chest
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), chestGoldMat);
    beacon.position.y = 1.25;
    beacon.userData.chestIndex = idx;
    g.add(beacon);

    scene.add(g);
    chestHitMeshes.push(base, clasp, lid, lidTrim, beacon);
    chests.push({
      id: idx,
      name: spec.name,
      group: g,
      lidPivot,
      beacon,
      opened: false,
      openProgress: 0,
      worldPos: new THREE.Vector3(spec.x, gh + 1.5, spec.z),
    });
  });

  return {
    solidMap,
    terrainHeight,
    landFootprint,
    chimneyPositions,
    firePos,
    lhPos: { x: lhX, z: lhZ },
    wmPos: { x: wmX, z: wmZ },
    brickGeo,
    brickMesh,
    studMesh,
    windowMat,
    lanternMat,
    pondMat,
    volcanoLight,
    lavaPoolMat,
    chests,
    chestHitMeshes,
    baseBrickCount: brickList.length + windowBlocks.length + lanternBlocks.length,
    baseStudCount: studList.length,
    updateSurfaceTheme,
  };
}
