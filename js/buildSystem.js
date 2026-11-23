import * as THREE from 'three';
import { BUILD_SWATCHES, PALETTE } from './config.js';

const STORAGE_KEY = 'voxel_lego_island_custom_bricks_v2';

export class LegoBuildSystem {
  constructor(scene, world, extraSolidMeshes, legoBrickTex, audio, onSparkle, onCountChange) {
    this.scene = scene;
    this.world = world;
    this.extraSolidMeshes = extraSolidMeshes || [];
    this.legoBrickTex = legoBrickTex;
    this.audio = audio;
    this.onSparkle = onSparkle;
    this.onCountChange = onCountChange;

    this.active = false;
    this.selectedSwatch = BUILD_SWATCHES[0];
    this.selectedPrefab = 'single'; // single | palm | lamp | bounce | pillar
    this.studsVisible = true;

    this.userGroup = new THREE.Group();
    this.scene.add(this.userGroup);

    this.brickMap = new Map(); // "x,y,z" -> { mesh, stud, data }
    this.bounceSet = new Set(); // "x,y,z" for bounce pads!
    this.history = [];          // array of key-arrays (supports multi-block prefab undo!)
    this.pickableMeshes = [];

    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.studGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12);

    this.ghostGroup = new THREE.Group();
    const ghostMat = new THREE.MeshStandardMaterial({
      color: this.selectedSwatch.hex,
      transparent: true,
      opacity: 0.52,
      roughness: 0.3,
      depthWrite: false,
    });
    const ghostBox = new THREE.Mesh(this.boxGeo, ghostMat);
    const ghostStud = new THREE.Mesh(this.studGeo, ghostMat);
    ghostStud.position.y = 0.58;
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.boxGeo),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    this.ghostGroup.add(ghostBox, ghostStud, wire);
    this.ghostGroup.visible = false;
    this.ghostMat = ghostMat;
    this.scene.add(this.ghostGroup);

    this.hoverPlaceCoord = null;
    this.loadInitialBricks();
  }

  setActive(isActive) {
    this.active = isActive;
    if (!isActive) {
      this.ghostGroup.visible = false;
      this.hoverPlaceCoord = null;
    }
  }

  setSwatch(swatch) {
    this.selectedSwatch = swatch;
    this.ghostMat.color.setHex(swatch.hex);
  }

  setPrefab(prefabId) {
    this.selectedPrefab = prefabId;
    if (prefabId === 'bounce') this.ghostMat.color.setHex(PALETTE.bounceRed);
    else if (prefabId === 'palm') this.ghostMat.color.setHex(PALETTE.palmLeaf);
    else if (prefabId === 'lamp') this.ghostMat.color.setHex(PALETTE.gold);
    else if (prefabId === 'pillar') this.ghostMat.color.setHex(PALETTE.marble);
    else this.ghostMat.color.setHex(this.selectedSwatch.hex);
  }

  setStudsVisible(visible) {
    this.studsVisible = visible;
    for (const entry of this.brickMap.values()) {
      entry.stud.visible = visible;
    }
  }

  getCount() {
    return this.brickMap.size;
  }

  isBouncePadAt(gx, gy, gz) {
    return this.bounceSet.has(`${gx},${gy},${gz}`);
  }

  getPickTargets() {
    return [this.world.brickMesh, ...this.extraSolidMeshes, ...this.pickableMeshes];
  }

  updateHover(raycaster) {
    if (!this.active) return;
    const hits = raycaster.intersectObjects(this.getPickTargets(), false);
    if (hits.length === 0) {
      this.ghostGroup.visible = false;
      this.hoverPlaceCoord = null;
      return;
    }

    const hit = hits[0];
    if (!hit.face) return;

    const normal = hit.face.normal.clone();
    if (hit.object !== this.world.brickMesh && !this.extraSolidMeshes.includes(hit.object)) {
      normal.transformDirection(hit.object.matrixWorld);
    }

    const targetPos = hit.point.clone().addScaledVector(normal, 0.5);
    const gx = Math.round(targetPos.x);
    const gy = Math.max(1, Math.floor(targetPos.y));
    const gz = Math.round(targetPos.z);

    if (Math.abs(gx) > 58 || Math.abs(gz) > 58 || gy > 48) {
      this.ghostGroup.visible = false;
      this.hoverPlaceCoord = null;
      return;
    }

    const key = `${gx},${gy},${gz}`;
    if (this.brickMap.has(key) || this.world.solidMap.has(key)) {
      this.ghostGroup.visible = false;
      this.hoverPlaceCoord = null;
      return;
    }

    this.hoverPlaceCoord = { x: gx, y: gy, z: gz };
    this.ghostGroup.position.set(gx, gy + 0.5, gz);
    this.ghostGroup.visible = true;
  }

  buildPrefabList(x, y, z) {
    if (this.selectedPrefab === 'single') {
      return [{ x, y, z, hex: this.selectedSwatch.hex, emissive: !!this.selectedSwatch.emissive, bounce: false }];
    }
    if (this.selectedPrefab === 'bounce') {
      return [{ x, y, z, hex: PALETTE.bounceRed, emissive: true, bounce: true }];
    }
    if (this.selectedPrefab === 'lamp') {
      return [
        { x, y, z, hex: PALETTE.ironDark, emissive: false, bounce: false },
        { x, y: y + 1, z, hex: PALETTE.ironDark, emissive: false, bounce: false },
        { x, y: y + 2, z, hex: 0xffe27a, emissive: true, bounce: false },
      ];
    }
    if (this.selectedPrefab === 'pillar') {
      return [
        { x, y, z, hex: PALETTE.marble, emissive: false, bounce: false },
        { x, y: y + 1, z, hex: PALETTE.marble, emissive: false, bounce: false },
        { x, y: y + 2, z, hex: PALETTE.marble, emissive: false, bounce: false },
        { x, y: y + 3, z, hex: PALETTE.gold, emissive: false, bounce: false },
      ];
    }
    if (this.selectedPrefab === 'palm') {
      return [
        { x, y, z, hex: PALETTE.woodMid, emissive: false, bounce: false },
        { x, y: y + 1, z, hex: PALETTE.woodLight, emissive: false, bounce: false },
        { x, y: y + 2, z, hex: PALETTE.woodMid, emissive: false, bounce: false },
        { x, y: y + 3, z, hex: PALETTE.palmLeaf, emissive: false, bounce: false },
        { x: x + 1, y: y + 3, z, hex: PALETTE.palmLeafTip, emissive: false, bounce: false },
        { x: x - 1, y: y + 3, z, hex: PALETTE.palmLeafTip, emissive: false, bounce: false },
        { x, y: y + 3, z: z + 1, hex: PALETTE.palmLeafTip, emissive: false, bounce: false },
        { x, y: y + 3, z: z - 1, hex: PALETTE.palmLeafTip, emissive: false, bounce: false },
      ];
    }
    return [];
  }

  placeBrickAtHover() {
    if (!this.active || !this.hoverPlaceCoord) return false;
    const { x, y, z } = this.hoverPlaceCoord;
    const items = this.buildPrefabList(x, y, z);
    const addedKeys = [];
    for (const item of items) {
      if (this.addBrick(item.x, item.y, item.z, item.hex, item.emissive, item.bounce, false)) {
        addedKeys.push(`${item.x},${item.y},${item.z}`);
      }
    }
    if (addedKeys.length > 0) {
      this.history.push(addedKeys);
      this.audio.playBrickSnap();
      if (this.onSparkle) {
        this.onSparkle(new THREE.Vector3(x, y + 0.8, z), 12, 4.5, items[0].hex);
      }
      this.saveToStorage();
      return true;
    }
    return false;
  }

  removeBrickByRay(raycaster) {
    if (!this.active || this.pickableMeshes.length === 0) return false;
    const hits = raycaster.intersectObjects(this.pickableMeshes, false);
    if (hits.length === 0) return false;
    const key = hits[0].object.userData.brickKey;
    if (!key) return false;
    const removed = this.removeByKey(key);
    if (removed) {
      this.audio.playBrickRemove();
      this.saveToStorage();
    }
    return removed;
  }

  addBrick(x, y, z, hex, emissive = false, bounce = false, pushHistory = true) {
    const key = `${x},${y},${z}`;
    if (this.brickMap.has(key) || this.world.solidMap.has(key)) return false;

    const mat = new THREE.MeshStandardMaterial({
      map: this.legoBrickTex,
      color: hex,
      emissive: bounce
        ? new THREE.Color(0xff2a55)
        : emissive
          ? new THREE.Color(0xffc94d)
          : new THREE.Color(0x000000),
      emissiveIntensity: bounce ? 0.65 : emissive ? 1.25 : 0.0,
      roughness: emissive ? 0.2 : 0.34,
      metalness: 0.04,
    });

    const mesh = new THREE.Mesh(this.boxGeo, mat);
    mesh.position.set(x, y + 0.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.brickKey = key;

    const stud = new THREE.Mesh(this.studGeo, bounce ? new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.25 }) : mat);
    stud.position.set(x, y + 1.08, z);
    stud.castShadow = true;
    stud.receiveShadow = true;
    stud.visible = this.studsVisible;

    this.userGroup.add(mesh, stud);
    this.pickableMeshes.push(mesh);
    this.brickMap.set(key, { mesh, stud, data: { x, y, z, hex, emissive, bounce } });
    if (bounce) this.bounceSet.add(key);
    if (pushHistory) this.history.push([key]);
    if (this.onCountChange) this.onCountChange(this.brickMap.size);
    return true;
  }

  removeByKey(key) {
    const entry = this.brickMap.get(key);
    if (!entry) return false;
    this.userGroup.remove(entry.mesh, entry.stud);
    entry.mesh.material.dispose();
    this.pickableMeshes = this.pickableMeshes.filter((m) => m !== entry.mesh);
    this.brickMap.delete(key);
    this.bounceSet.delete(key);
    if (this.onCountChange) this.onCountChange(this.brickMap.size);
    return true;
  }

  undo() {
    while (this.history.length > 0) {
      const batch = this.history.pop();
      let any = false;
      batch.forEach((k) => { if (this.removeByKey(k)) any = true; });
      if (any) {
        this.audio.playBrickRemove();
        this.saveToStorage();
        return true;
      }
    }
    return false;
  }

  clearAll() {
    for (const key of Array.from(this.brickMap.keys())) {
      this.removeByKey(key);
    }
    this.history = [];
    this.saveToStorage();
    this.audio.playBrickRemove();
  }

  // Shareable URL encoding (#build=<base64 compact array>)
  getShareUrl() {
    const compact = Array.from(this.brickMap.values()).map(({ data: d }) => [
      d.x, d.y, d.z, d.hex, d.emissive ? 1 : 0, d.bounce ? 1 : 0,
    ]);
    const encoded = btoa(JSON.stringify(compact));
    const url = new URL(window.location.href);
    url.hash = `build=${encoded}`;
    return url.toString();
  }

  saveToStorage() {
    try {
      const list = Array.from(this.brickMap.values()).map((e) => e.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  loadInitialBricks() {
    // 1. Check URL hash share link first!
    if (window.location.hash && window.location.hash.startsWith('#build=')) {
      try {
        const b64 = window.location.hash.slice('#build='.length);
        const arr = JSON.parse(atob(b64));
        if (Array.isArray(arr) && arr.length > 0) {
          arr.forEach(([x, y, z, hex, em, bn]) => {
            if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
              this.addBrick(x, y, z, hex ?? 0xe03c31, !!em, !!bn, true);
            }
          });
          return;
        }
      } catch (_) {}
    }
    // 2. Fallback to localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('voxel_lego_island_custom_bricks_v1');
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      list.forEach((b) => {
        if (typeof b.x === 'number' && typeof b.y === 'number' && typeof b.z === 'number') {
          this.addBrick(b.x, b.y, b.z, b.hex ?? 0xe03c31, !!b.emissive, !!b.bounce, true);
        }
      });
    } catch (_) {}
  }
}
