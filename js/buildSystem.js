import * as THREE from 'three';
import { BUILD_SWATCHES } from './config.js';

const STORAGE_KEY = 'voxel_lego_island_custom_bricks_v1';

export class LegoBuildSystem {
  constructor(scene, world, legoBrickTex, audio, onSparkle, onCountChange) {
    this.scene = scene;
    this.world = world;
    this.legoBrickTex = legoBrickTex;
    this.audio = audio;
    this.onSparkle = onSparkle;
    this.onCountChange = onCountChange;

    this.active = false;
    this.selectedSwatch = BUILD_SWATCHES[0];
    this.studsVisible = true;

    this.userGroup = new THREE.Group();
    this.scene.add(this.userGroup);

    this.brickMap = new Map(); // "x,y,z" -> { mesh, stud, data }
    this.history = [];         // stack of keys for Undo
    this.pickableMeshes = [];

    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.studGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12);

    // Ghost Hover Preview Brick + Stud
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
    this.loadFromStorage();
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

  setStudsVisible(visible) {
    this.studsVisible = visible;
    for (const entry of this.brickMap.values()) {
      entry.stud.visible = visible;
    }
  }

  getCount() {
    return this.brickMap.size;
  }

  getPickTargets() {
    return [this.world.brickMesh, ...this.pickableMeshes];
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

    // World-space face normal
    const normal = hit.face.normal.clone();
    if (hit.object !== this.world.brickMesh) {
      normal.transformDirection(hit.object.matrixWorld);
    }

    const targetPos = hit.point.clone().addScaledVector(normal, 0.5);
    const gx = Math.round(targetPos.x);
    const gy = Math.max(1, Math.floor(targetPos.y));
    const gz = Math.round(targetPos.z);

    if (Math.abs(gx) > 22 || Math.abs(gz) > 22 || gy > 22) {
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

  placeBrickAtHover() {
    if (!this.active || !this.hoverPlaceCoord) return false;
    const { x, y, z } = this.hoverPlaceCoord;
    const ok = this.addBrick(x, y, z, this.selectedSwatch.hex, !!this.selectedSwatch.emissive, true);
    if (ok) {
      this.audio.playBrickSnap();
      if (this.onSparkle) {
        this.onSparkle(new THREE.Vector3(x, y + 0.8, z), 10, 4.2, this.selectedSwatch.hex);
      }
      this.saveToStorage();
    }
    return ok;
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

  addBrick(x, y, z, hex, emissive = false, pushHistory = true) {
    const key = `${x},${y},${z}`;
    if (this.brickMap.has(key)) return false;

    const mat = new THREE.MeshStandardMaterial({
      map: this.legoBrickTex,
      color: hex,
      emissive: emissive ? new THREE.Color(0xffc94d) : new THREE.Color(0x000000),
      emissiveIntensity: emissive ? 1.25 : 0.0,
      roughness: emissive ? 0.2 : 0.34,
      metalness: 0.04,
    });

    const mesh = new THREE.Mesh(this.boxGeo, mat);
    mesh.position.set(x, y + 0.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.brickKey = key;

    const stud = new THREE.Mesh(this.studGeo, mat);
    stud.position.set(x, y + 1.08, z);
    stud.castShadow = true;
    stud.receiveShadow = true;
    stud.visible = this.studsVisible;

    this.userGroup.add(mesh, stud);
    this.pickableMeshes.push(mesh);
    this.brickMap.set(key, { mesh, stud, data: { x, y, z, hex, emissive } });
    if (pushHistory) this.history.push(key);
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
    this.history = this.history.filter((k) => k !== key);
    if (this.onCountChange) this.onCountChange(this.brickMap.size);
    return true;
  }

  undo() {
    while (this.history.length > 0) {
      const lastKey = this.history.pop();
      if (this.removeByKey(lastKey)) {
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

  saveToStorage() {
    try {
      const list = Array.from(this.brickMap.values()).map((e) => e.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_) {
      // Ignore storage quota / privacy mode errors
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      list.forEach((b) => {
        if (typeof b.x === 'number' && typeof b.y === 'number' && typeof b.z === 'number') {
          this.addBrick(b.x, b.y, b.z, b.hex ?? 0xe03c31, !!b.emissive, true);
        }
      });
    } catch (_) {
      // Ignore parse errors
    }
  }
}
