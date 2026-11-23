import * as THREE from 'three';
import { PALETTE, WATER_LEVEL, FISH_CATALOG, showToast } from './config.js';

// =========================================================================
// 1. ✈️ FLIGHT CONTROLLER + 10 GOLDEN SKY RINGS CHALLENGE
// =========================================================================
export class FlightSystem {
  constructor(scene, seaplane, audio, onSparkle, onAllRingsComplete) {
    this.scene = scene;
    this.seaplane = seaplane;
    this.audio = audio;
    this.onSparkle = onSparkle;
    this.onAllRingsComplete = onAllRingsComplete;

    this.active = false;
    this.pos = new THREE.Vector3(0, 22, 26);
    this.yaw = Math.PI; // facing north toward island
    this.pitch = 0;
    this.roll = 0;
    this.speed = 18;
    this.clearedCount = 0;

    // 10 scenic golden Sky Rings weaving around ALL islands & Floating Sky Temple
    const ringCoords = [
      [0, 19, 14, 0],
      [-14, 18, 3, 0.5],     // Above Lighthouse
      [-26, 20, -14, 0.8],   // Approach Coaster Island
      [-34, 22, -24, 1.3],   // Over Roller Coaster Peak
      [-18, 28, -32, 1.5],   // Climb toward Sky Temple
      [0, 38, -36, 1.5],     // Right over Floating Sky Temple!
      [18, 26, -20, 0.6],    // Swoop past Volcano / Mountain
      [26, 17, 6, 0.2],      // Approach Pirate Island
      [34, 16, 24, 0.9],     // Over Pirate Skull Cove!
      [16, 16, 26, 1.4],     // Victory return to Harbor
    ];

    this.ringsGroup = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(3.6, 0.28, 10, 28);
    this.rings = ringCoords.map(([x, y, z, rotY], i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: PALETTE.gold,
        emissive: new THREE.Color(0xffb703),
        emissiveIntensity: 0.75,
        roughness: 0.22,
        metalness: 0.5,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      this.ringsGroup.add(mesh);
      return { id: i, mesh, mat, cleared: false, baseY: y };
    });
    this.ringsGroup.visible = false;
    this.scene.add(this.ringsGroup);
  }

  enter() {
    this.active = true;
    this.ringsGroup.visible = true;
    this.pos.copy(this.seaplane.position);
    if (this.pos.y < 10) this.pos.y = 20;
    this.yaw = Math.atan2(-this.pos.x, -this.pos.z);
    this.pitch = 0;
    this.roll = 0;
    this.speed = 18;
  }

  exit() {
    this.active = false;
    this.ringsGroup.visible = false;
  }

  resetRings() {
    this.clearedCount = 0;
    this.rings.forEach((r) => {
      r.cleared = false;
      r.mat.color.setHex(PALETTE.gold);
      r.mat.emissive.setHex(0xffb703);
      r.mesh.scale.setScalar(1);
    });
  }

  fireSmokeSalute() {
    if (!this.active) return;
    this.audio.playFireworkBoom();
    this.onSparkle(this.pos.clone(), 42, 9.5, true);
  }

  update(dt, elapsed, { keys, camera, controls, onRingCountChange }) {
    // Animate rings gently
    if (this.ringsGroup.visible) {
      this.rings.forEach((r) => {
        r.mesh.position.y = r.baseY + Math.sin(elapsed * 2.0 + r.id) * 0.45;
      });
    }

    if (!this.active) return;

    const turnInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    const pitchInput = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
    const targetSpeed = keys.sprint ? 31 : 19;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 3.5);

    this.yaw += turnInput * dt * 1.45;
    const targetPitch = pitchInput * 0.58;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 4.5);
    const targetRoll = -turnInput * 0.52;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 5.0);

    const fwd = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();

    this.pos.addScaledVector(fwd, this.speed * dt);
    // Keep safely above ocean waves & within archipelago skybox
    this.pos.y = Math.max(WATER_LEVEL + 2.2, Math.min(64, this.pos.y));
    const horizDist = Math.hypot(this.pos.x, this.pos.z);
    if (horizDist > 92) {
      this.pos.x *= 92 / horizDist;
      this.pos.z *= 92 / horizDist;
    }

    this.seaplane.position.copy(this.pos);
    this.seaplane.rotation.order = 'YXZ';
    this.seaplane.rotation.set(-this.pitch, this.yaw, this.roll);

    // Check Sky Ring collisions
    for (const r of this.rings) {
      if (!r.cleared && this.pos.distanceTo(r.mesh.position) < 4.5) {
        r.cleared = true;
        r.mat.color.setHex(0x26f7a0);
        r.mat.emissive.setHex(0x00e68a);
        r.mesh.scale.setScalar(1.18);
        this.clearedCount++;
        this.speed = 32; // Speed boost!
        this.audio.playRingChime(this.clearedCount);
        this.onSparkle(r.mesh.position.clone(), 34, 8.0, false);
        if (onRingCountChange) onRingCountChange(this.clearedCount, this.rings.length);
        if (this.clearedCount === this.rings.length && this.onAllRingsComplete) {
          this.onAllRingsComplete();
        }
      }
    }

    // Smooth cinematic third-person flight chase camera
    const behind = fwd.clone().multiplyScalar(-12.5);
    const desiredCam = this.pos.clone().add(behind).add(new THREE.Vector3(0, 3.6, 0));
    desiredCam.y = Math.max(WATER_LEVEL + 1.5, desiredCam.y);
    const lookTarget = this.pos.clone().addScaledVector(fwd, 9.0);
    camera.position.lerp(desiredCam, Math.min(1, dt * 6.5));
    controls.target.lerp(lookTarget, Math.min(1, dt * 9.0));
  }
}

// =========================================================================
// 2. 💥 LEGO HARBOR CANNON & SHATTERING TARGET PIRATE BARGES
// =========================================================================
export class CannonMiniGame {
  constructor(scene, legoBrickTex, audio, onBlastFX, onScoreChange) {
    this.scene = scene;
    this.legoBrickTex = legoBrickTex;
    this.audio = audio;
    this.onBlastFX = onBlastFX;
    this.onScoreChange = onScoreChange;

    this.active = false;
    this.score = 0;
    this.aimYaw = 0;
    this.aimPitch = 0.24;
    this.recoil = 0;

    // Build chunky LEGO Cannon right at the open tip of the wooden Harbor Pier (x=2.5, y=2.0, z=13.2)
    this.origin = new THREE.Vector3(2.5, 2.55, 13.2);
    this.cannonBase = new THREE.Group();
    this.cannonBase.position.set(2.5, 2.0, 13.2);

    const woodMat = new THREE.MeshStandardMaterial({ map: legoBrickTex, color: PALETTE.woodDark, roughness: 0.45 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a303a, metalness: 0.65, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.7, roughness: 0.25 });

    const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.5), woodMat);
    carriage.position.y = 0.35;
    carriage.castShadow = true;
    this.cannonBase.add(carriage);

    this.barrelPivot = new THREE.Group();
    this.barrelPivot.position.set(0, 0.78, 0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.1, 12), ironMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.55;
    barrel.castShadow = true;
    const muzzleRing = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.18, 12), goldMat);
    muzzleRing.rotation.x = Math.PI / 2;
    muzzleRing.position.z = 1.52;
    this.barrelPivot.add(barrel, muzzleRing);
    this.cannonBase.add(this.barrelPivot);
    scene.add(this.cannonBase);

    // Target aim ring floating on the water (visible in Cannon Mode)
    this.aimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.25, 24),
      new THREE.MeshBasicMaterial({ color: 0xff5252, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.aimRing.rotation.x = -Math.PI / 2;
    this.aimRing.position.set(2.5, WATER_LEVEL + 0.18, 26);
    this.aimRing.visible = false;
    scene.add(this.aimRing);

    // Active cannonballs
    this.balls = [];
    this.ballGeo = new THREE.SphereGeometry(0.32, 10, 10);
    this.ballMat = new THREE.MeshStandardMaterial({ color: 0x1b1e24, metalness: 0.6, roughness: 0.3 });

    // Physical shattering LEGO debris pieces!
    this.debris = [];
    this.debrisGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);

    // 3 Drifting Target Pirate Barges in the southern bay
    this.targets = [];
    this.spawnTargets();
  }

  spawnTargets() {
    const lanes = [
      { z: 22, xMin: -10, xMax: 16, speed: 3.6, dir: 1 },
      { z: 29, xMin: -14, xMax: 20, speed: 4.8, dir: -1 },
      { z: 36, xMin: -10, xMax: 18, speed: 5.5, dir: 1 },
    ];
    lanes.forEach((lane, i) => {
      const barge = new THREE.Group();
      const hullMat = new THREE.MeshStandardMaterial({ map: this.legoBrickTex, color: PALETTE.pirateHull, roughness: 0.4 });
      const redMat = new THREE.MeshStandardMaterial({ map: this.legoBrickTex, color: PALETTE.roofRed, roughness: 0.35 });
      const whiteMat = new THREE.MeshStandardMaterial({ map: this.legoBrickTex, color: PALETTE.sailWhite, roughness: 0.35 });

      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 1.5), hullMat);
      hull.position.y = 0.25;
      hull.castShadow = true;
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.8, 0.24), hullMat);
      mast.position.y = 1.6;
      const targetBoard = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 0.24), whiteMat);
      targetBoard.position.set(0, 1.9, 0);
      const bullseye = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.3), redMat);
      bullseye.position.set(0, 1.9, 0);
      barge.add(hull, mast, targetBoard, bullseye);

      const startX = lane.xMin + (i + 0.5) * 7;
      barge.position.set(startX, WATER_LEVEL + 0.08, lane.z);
      barge.visible = false;
      this.scene.add(barge);

      this.targets.push({
        group: barge,
        lane,
        x: startX,
        dir: lane.dir,
        alive: true,
        respawnTimer: 0,
      });
    });
  }

  enter(camera, controls) {
    this.active = true;
    this.aimRing.visible = true;
    this.targets.forEach((t) => { t.group.visible = t.alive; });
    controls.enabled = false;
    camera.position.set(2.5, 5.8, 8.8);
    camera.lookAt(2.5, 2.2, 28);
  }

  exit(controls) {
    this.active = false;
    this.aimRing.visible = false;
    this.targets.forEach((t) => { t.group.visible = false; });
    controls.enabled = true;
  }

  aimAtPointer(raycaster) {
    if (!this.active) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_LEVEL);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    // Clamp aim to open southern bay in front of the pier cannon
    hit.z = Math.max(16, Math.min(46, hit.z));
    hit.x = Math.max(-20, Math.min(24, hit.x));
    this.aimRing.position.set(hit.x, WATER_LEVEL + 0.2, hit.z);

    const dx = hit.x - this.origin.x;
    const dz = hit.z - this.origin.z;
    const dist = Math.hypot(dx, dz);
    this.aimYaw = Math.atan2(dx, dz);
    this.aimPitch = Math.max(0.08, Math.min(0.68, dist * 0.0145));
    this.cannonBase.rotation.y = this.aimYaw;
    this.barrelPivot.rotation.x = -this.aimPitch;
  }

  fire() {
    if (!this.active) return;
    this.recoil = 0.45;
    this.audio.playCannonBlast();

    const dir = new THREE.Vector3(
      Math.sin(this.aimYaw) * Math.cos(this.aimPitch),
      Math.sin(this.aimPitch) + 0.14,
      Math.cos(this.aimYaw) * Math.cos(this.aimPitch)
    ).normalize();

    const startPos = this.origin.clone().addScaledVector(dir, 1.7);
    const mesh = new THREE.Mesh(this.ballGeo, this.ballMat);
    mesh.position.copy(startPos);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Muzzle flash smoke
    this.onBlastFX(startPos, 16, 4.5, 0xffb703);

    const dist = Math.hypot(this.aimRing.position.x - this.origin.x, this.aimRing.position.z - this.origin.z);
    const launchSpeed = Math.max(18, Math.min(36, 14 + dist * 0.62));
    this.balls.push({ mesh, pos: startPos, vel: dir.multiplyScalar(launchSpeed), life: 0 });
  }

  shatterTarget(target) {
    target.alive = false;
    target.group.visible = false;
    target.respawnTimer = 3.2;
    this.score++;
    this.audio.playLegoSmash();
    const pos = target.group.position.clone().add(new THREE.Vector3(0, 1.0, 0));
    this.onBlastFX(pos, 32, 9.0, 0xff6b35);
    if (this.onScoreChange) this.onScoreChange(this.score);

    // Spawn 22 physical spinning LEGO brick debris pieces!
    const brickCols = [PALETTE.pirateHull, PALETTE.roofRed, PALETTE.sailWhite, PALETTE.gold, PALETTE.woodMid];
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(
        this.debrisGeo,
        new THREE.MeshStandardMaterial({
          map: this.legoBrickTex,
          color: brickCols[i % brickCols.length],
          roughness: 0.35,
        })
      );
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 2.0, Math.random() * 1.4, (Math.random() - 0.5) * 1.2));
      this.scene.add(m);
      this.debris.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 14, 5 + Math.random() * 9, (Math.random() - 0.5) * 14),
        rotVel: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9),
        life: 0,
      });
    }
  }

  update(dt, elapsed) {
    // Recoil spring
    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - dt * 2.6);
      this.barrelPivot.position.z = -this.recoil;
    }

    // Move drifting target barges
    this.targets.forEach((t) => {
      if (!t.alive) {
        t.respawnTimer -= dt;
        if (t.respawnTimer <= 0) {
          t.alive = true;
          t.x = t.dir > 0 ? t.lane.xMin : t.lane.xMax;
          t.group.visible = this.active;
        }
        return;
      }
      t.x += t.lane.speed * t.dir * dt;
      if (t.x > t.lane.xMax) t.dir = -1;
      if (t.x < t.lane.xMin) t.dir = 1;
      t.group.position.set(t.x, WATER_LEVEL + 0.08 + Math.sin(elapsed * 2.5 + t.lane.z) * 0.1, t.lane.z);
      t.group.rotation.z = Math.sin(elapsed * 2.0 + t.lane.z) * 0.06;
    });

    // Simulate cannonballs
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.life += dt;
      b.vel.y -= 18.0 * dt;
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);

      let hitSomething = false;
      for (const t of this.targets) {
        if (t.alive && b.pos.distanceTo(t.group.position.clone().add(new THREE.Vector3(0, 1.2, 0))) < 2.6) {
          this.shatterTarget(t);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething || b.pos.y <= WATER_LEVEL || b.life > 4.5) {
        if (!hitSomething && b.pos.y <= WATER_LEVEL) {
          this.onBlastFX(new THREE.Vector3(b.pos.x, WATER_LEVEL + 0.15, b.pos.z), 16, 5.2, 0xdff6ff);
        }
        this.scene.remove(b.mesh);
        this.balls.splice(i, 1);
      }
    }

    // Simulate shattering LEGO brick debris
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life += dt;
      d.vel.y -= 18.0 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;
      if (d.mesh.position.y < WATER_LEVEL - 0.15) {
        d.mesh.position.y = WATER_LEVEL - 0.15;
        d.vel.y *= -0.32;
        d.vel.x *= 0.72;
        d.vel.z *= 0.72;
      }
      if (d.life > 2.8) {
        d.mesh.scale.setScalar(Math.max(0.01, 1 - (d.life - 2.8) * 1.6));
      }
      if (d.life > 3.4) {
        this.scene.remove(d.mesh);
        d.mesh.material.dispose();
        this.debris.splice(i, 1);
      }
    }
  }
}

// =========================================================================
// 3. 🎣 HARBOR PIER FISHING MINI-GAME & 8-SPECIES OCEAN ENCYCLOPEDIA
// =========================================================================
const FISH_STORAGE_KEY = 'voxel_lego_island_fish_dex_v1';

export class FishingMiniGame {
  constructor(audio, onCatchSplash, onStateUI) {
    this.audio = audio;
    this.onCatchSplash = onCatchSplash;
    this.onStateUI = onStateUI;

    this.state = 'idle'; // idle | waiting | biting
    this.timer = 0;
    this.caughtSet = new Set();
    this.loadDex();
  }

  loadDex() {
    try {
      const raw = localStorage.getItem(FISH_STORAGE_KEY);
      if (raw) JSON.parse(raw).forEach((id) => this.caughtSet.add(id));
    } catch (_) {}
  }

  saveDex() {
    try {
      localStorage.setItem(FISH_STORAGE_KEY, JSON.stringify(Array.from(this.caughtSet)));
    } catch (_) {}
  }

  castOrReel() {
    if (this.state === 'idle') {
      this.state = 'waiting';
      this.timer = 1.6 + Math.random() * 2.4;
      this.audio.playFootstep(true);
      this.onCatchSplash(new THREE.Vector3(2.8, WATER_LEVEL + 0.12, 16.4), 10, 3.4, 0xdff6ff);
      this.emitUI('🎣 已抛竿，静候鱼儿上钩…', '收竿');
    } else if (this.state === 'waiting') {
      this.state = 'idle';
      this.emitUI('😅 提竿太早啦！再试一次吧', '🎣 抛竿');
    } else if (this.state === 'biting') {
      // Caught a treasure!
      const fish = this.pickRandomFish();
      const isNew = !this.caughtSet.has(fish.id);
      this.caughtSet.add(fish.id);
      this.saveDex();
      this.state = 'idle';
      this.audio.playTreasureFanfare();
      this.onCatchSplash(new THREE.Vector3(2.8, WATER_LEVEL + 0.35, 16.4), 28, 7.2, fish.color);
      showToast(`${fish.icon} 钓到【${fish.rarity}】${fish.name}！${isNew ? '✨ 图鉴新收录' : ''}`);
      this.emitUI(`🎉 收获 ${fish.icon} ${fish.name}（${fish.rarity}）`, '🎣 再钓一次');
    }
  }

  pickRandomFish() {
    const total = FISH_CATALOG.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * total;
    for (const f of FISH_CATALOG) {
      r -= f.weight;
      if (r <= 0) return f;
    }
    return FISH_CATALOG[0];
  }

  emitUI(statusText, btnText) {
    if (this.onStateUI) {
      this.onStateUI({
        state: this.state,
        statusText,
        btnText,
        caughtSet: this.caughtSet,
      });
    }
  }

  update(dt) {
    if (this.state === 'waiting') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'biting';
        this.timer = 2.3;
        this.audio.playFishBite();
        this.onCatchSplash(new THREE.Vector3(2.8, WATER_LEVEL + 0.15, 16.4), 16, 4.5, 0x64ffda);
        this.emitUI('⚡ 咬钩啦！！快点击收杆或按 Space！', '🔥 立即收杆！');
      }
    } else if (this.state === 'biting') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.emitUI('💨 哎呀鱼儿溜走了…再抛一竿！', '🎣 抛竿');
      }
    }
  }
}
