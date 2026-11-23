import * as THREE from 'three';
import { PALETTE, WATER_LEVEL } from './config.js';

export const OUTFITS = {
  explorer: {
    label: '🧭 探险家',
    shirt: 0x2a9d8f,
    pants: 0x5c4738,
    hat: 0xb5651d,
    pack: 0xe76f51,
    visor: false,
  },
  pirate: {
    label: '🏴‍☠️ 海盗船长',
    shirt: 0xc92a2a,
    pants: 0x212529,
    hat: 0x1a1d24,
    pack: 0xd4a017,
    visor: false,
  },
  astronaut: {
    label: '👨‍🚀 宇航员',
    shirt: 0xf4f6fa,
    pants: 0xe2e8f0,
    hat: 0xf8fafc,
    pack: 0x4cc9f0,
    visor: true,
  },
};

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export class PlayerController {
  constructor(scene, world, buildSystem, audio, onWaterSplash, onTreasurePickup) {
    this.scene = scene;
    this.world = world;
    this.buildSystem = buildSystem;
    this.audio = audio;
    this.onWaterSplash = onWaterSplash;
    this.onTreasurePickup = onTreasurePickup;

    this.active = false;
    this.firstPerson = false;
    this.outfitKey = 'explorer';

    // Spawn on open harbor plaza entrance with clear view of cottages, pier & bridge
    this.pos = new THREE.Vector3(2.5, 3.0, 5.2);
    this.visualY = 3.0;
    this.velY = 0;
    this.yaw = 0;
    this.grounded = true;
    this.coyoteTimer = 0;
    this.swimming = false;
    this.stepTimer = 0;
    this.splashTimer = 0;

    // First-person look angles (drag mouse to look around)
    this.fpYaw = Math.PI;
    this.fpPitch = -0.06;

    this.buildCharacterMesh();
    this.group.visible = false;
    this.scene.add(this.group);
  }

  buildCharacterMesh() {
    this.group = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const o = OUTFITS[this.outfitKey];

    this.mats = {
      shirt: new THREE.MeshStandardMaterial({ color: o.shirt, roughness: 0.35 }),
      pants: new THREE.MeshStandardMaterial({ color: o.pants, roughness: 0.4 }),
      hat: new THREE.MeshStandardMaterial({ color: o.hat, roughness: 0.32 }),
      pack: new THREE.MeshStandardMaterial({ color: o.pack, roughness: 0.38 }),
      head: new THREE.MeshStandardMaterial({ color: PALETTE.legoYellow, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.4 }),
      visor: new THREE.MeshStandardMaterial({ color: 0x2ec4f1, roughness: 0.12, metalness: 0.35 }),
      lantern: new THREE.MeshStandardMaterial({
        color: 0xfff5cc,
        emissive: new THREE.Color(0xffc947),
        emissiveIntensity: 0.25,
        roughness: 0.2,
      }),
    };

    // Body pivot so we can tilt forward while swimming
    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    // Legs (pivoted at hip)
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.12, 0.42, 0);
    const lLeg = new THREE.Mesh(box, this.mats.pants);
    lLeg.scale.set(0.2, 0.42, 0.22);
    lLeg.position.y = -0.21;
    lLeg.castShadow = true;
    this.leftLegPivot.add(lLeg);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.12, 0.42, 0);
    const rLeg = new THREE.Mesh(box, this.mats.pants);
    rLeg.scale.set(0.2, 0.42, 0.22);
    rLeg.position.y = -0.21;
    rLeg.castShadow = true;
    this.rightLegPivot.add(rLeg);

    // Torso
    this.torso = new THREE.Mesh(box, this.mats.shirt);
    this.torso.scale.set(0.46, 0.48, 0.26);
    this.torso.position.y = 0.66;
    this.torso.castShadow = true;

    // Backpack
    this.backpack = new THREE.Mesh(box, this.mats.pack);
    this.backpack.scale.set(0.36, 0.38, 0.16);
    this.backpack.position.set(0, 0.67, -0.2);
    this.backpack.castShadow = true;

    // Arms (pivoted at shoulder)
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.3, 0.84, 0);
    const lArm = new THREE.Mesh(box, this.mats.shirt);
    lArm.scale.set(0.14, 0.38, 0.16);
    lArm.position.y = -0.17;
    lArm.castShadow = true;
    const lHand = new THREE.Mesh(box, this.mats.head);
    lHand.scale.set(0.13, 0.12, 0.13);
    lHand.position.y = -0.38;
    this.leftArmPivot.add(lArm, lHand);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.3, 0.84, 0);
    const rArm = new THREE.Mesh(box, this.mats.shirt);
    rArm.scale.set(0.14, 0.38, 0.16);
    rArm.position.y = -0.17;
    rArm.castShadow = true;
    const rHand = new THREE.Mesh(box, this.mats.head);
    rHand.scale.set(0.13, 0.12, 0.13);
    rHand.position.y = -0.38;

    // Handheld Mini LEGO Lantern (auto-glows at dusk/night!)
    this.handLantern = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), this.mats.lantern);
    this.handLantern.position.set(0, -0.46, 0.14);
    this.lanternLight = new THREE.PointLight(0xffcb66, 0, 12, 1.5);
    this.lanternLight.position.set(0, -0.42, 0.22);
    this.rightArmPivot.add(rArm, rHand, this.handLantern, this.lanternLight);

    // Classic Yellow LEGO Head + Cute Eyes & Smile
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 12), this.mats.head);
    head.position.y = 1.07;
    head.castShadow = true;
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), this.mats.head);
    stud.position.y = 1.26;

    const eyeL = new THREE.Mesh(box, this.mats.dark);
    eyeL.scale.set(0.05, 0.06, 0.04);
    eyeL.position.set(-0.065, 1.1, 0.165);
    const eyeR = new THREE.Mesh(box, this.mats.dark);
    eyeR.scale.set(0.05, 0.06, 0.04);
    eyeR.position.set(0.065, 1.1, 0.165);
    const smile = new THREE.Mesh(box, this.mats.dark);
    smile.scale.set(0.12, 0.03, 0.04);
    smile.position.set(0, 1.01, 0.165);

    // Hat / Helmet
    this.hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), this.mats.hat);
    this.hatBrim.position.y = 1.22;
    this.hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.16, 12), this.mats.hat);
    this.hatCrown.position.y = 1.31;

    this.helmetVisor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.18), this.mats.visor);
    this.helmetVisor.position.set(0, 1.09, 0.12);
    this.helmetVisor.visible = false;

    this.bodyPivot.add(
      this.leftLegPivot,
      this.rightLegPivot,
      this.torso,
      this.backpack,
      this.leftArmPivot,
      this.rightArmPivot,
      head,
      stud,
      eyeL,
      eyeR,
      smile,
      this.hatBrim,
      this.hatCrown,
      this.helmetVisor
    );
  }

  setOutfit(key) {
    const o = OUTFITS[key];
    if (!o) return;
    this.outfitKey = key;
    this.mats.shirt.color.setHex(o.shirt);
    this.mats.pants.color.setHex(o.pants);
    this.mats.hat.color.setHex(o.hat);
    this.mats.pack.color.setHex(o.pack);
    this.hatBrim.visible = !o.visor;
    this.helmetVisor.visible = o.visor;
    this.audio.playBrickSnap();
  }

  enter(camera, controls) {
    this.active = true;
    this.firstPerson = false;
    this.group.visible = true;
    this.velY = 0;

    // Ensure valid spawn surface (harbor plaza)
    const ground = this.getGroundHeightAt(this.pos.x, this.pos.z, this.pos.y + 3.0);
    if (ground > 0) {
      this.pos.y = ground;
    } else {
      this.pos.set(2.5, 3.0, 4.5);
    }
    this.visualY = this.pos.y;
    this.group.position.set(this.pos.x, this.visualY, this.pos.z);

    // Frame wide scenic over-the-shoulder third-person camera behind explorer
    controls.enabled = true;
    controls.target.set(this.pos.x, this.pos.y + 1.35, this.pos.z);
    camera.position.set(this.pos.x + 4.8, this.pos.y + 6.4, this.pos.z + 9.8);
  }

  exit(controls) {
    this.active = false;
    this.firstPerson = false;
    this.group.visible = false;
    controls.enabled = true;
  }

  togglePerspective(camera, controls) {
    if (!this.active) return false;
    this.firstPerson = !this.firstPerson;
    this.group.visible = !this.firstPerson;

    if (this.firstPerson) {
      // Align FP view with current camera look direction
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      this.fpYaw = Math.atan2(dir.x, dir.z);
      this.fpPitch = Math.max(-0.85, Math.min(0.85, Math.asin(dir.y)));
      controls.enabled = false;
    } else {
      controls.enabled = true;
      controls.target.set(this.pos.x, this.pos.y + 1.35, this.pos.z);
      const backX = -Math.sin(this.fpYaw) * 7.5;
      const backZ = -Math.cos(this.fpYaw) * 7.5;
      camera.position.set(this.pos.x + backX, this.pos.y + 4.8, this.pos.z + backZ);
    }
    return this.firstPerson;
  }

  rotateFirstPerson(dx, dy) {
    if (!this.active || !this.firstPerson) return;
    this.fpYaw -= dx * 0.0045;
    this.fpPitch = Math.max(-1.15, Math.min(1.05, this.fpPitch - dy * 0.004));
  }

  jump() {
    if (!this.active) return;
    if (this.swimming) {
      // Hop upward out of water to climb onto beach/pier!
      this.velY = 8.0;
      this.swimming = false;
      this.grounded = false;
      this.audio.playJump();
      if (this.onWaterSplash) {
        this.onWaterSplash(new THREE.Vector3(this.pos.x, WATER_LEVEL + 0.1, this.pos.z), 10, 3.8);
      }
      return;
    }
    if (this.grounded || this.coyoteTimer > 0) {
      this.velY = 8.8;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.audio.playJump();
    }
  }

  isSolidVoxel(gx, gy, gz) {
    const key = `${gx},${gy},${gz}`;
    const base = this.world.solidMap.get(key);
    if (base && !base.isFlower) return true;
    if (this.buildSystem.brickMap.has(key)) return true;
    return false;
  }

  // Find highest walkable surface at (x, z) reachable from maxReachY
  getGroundHeightAt(x, z, maxReachY) {
    const gx = Math.round(x);
    const gz = Math.round(z);
    const topScan = Math.min(24, Math.floor(maxReachY));
    for (let gy = topScan; gy >= 0; gy--) {
      if (this.isSolidVoxel(gx, gy, gz)) {
        // Make sure there's space for the minifigure above this brick
        if (!this.isSolidVoxel(gx, gy + 1, gz)) {
          return gy + 1.0;
        }
      }
    }
    return -10;
  }

  isWallBlocked(x, z, footY) {
    // Check a small circle around player center so we don't clip corners
    const radius = 0.24;
    const headCheckY = Math.floor(footY + 1.08);
    const offsets = [
      [radius, 0], [-radius, 0], [0, radius], [0, -radius],
    ];
    for (const [ox, oz] of offsets) {
      const gx = Math.round(x + ox);
      const gz = Math.round(z + oz);
      if (this.isSolidVoxel(gx, headCheckY, gz)) {
        return true;
      }
    }
    return false;
  }

  update(dt, elapsed, { keys, camera, controls, nightFactor }) {
    if (!this.active) return;

    const prevX = this.pos.x;
    const prevY = this.visualY;
    const prevZ = this.pos.z;

    // 1. Determine camera-relative movement vector
    const fwd = new THREE.Vector3();
    if (this.firstPerson) {
      fwd.set(Math.sin(this.fpYaw), 0, Math.cos(this.fpYaw)).normalize();
    } else {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 0.0001) fwd.set(0, 0, -1);
      fwd.normalize();
    }
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

    const moveDir = new THREE.Vector3();
    if (keys.forward) moveDir.add(fwd);
    if (keys.backward) moveDir.sub(fwd);
    if (keys.right) moveDir.add(right);
    if (keys.left) moveDir.sub(right);

    const isMoving = moveDir.lengthSq() > 0.001;
    if (isMoving) moveDir.normalize();

    const baseSpeed = this.swimming ? 3.8 : keys.sprint ? 7.6 : 5.1;
    const stepX = moveDir.x * baseSpeed * dt;
    const stepZ = moveDir.z * baseSpeed * dt;

    // 2. Horizontal Movement with Wall Sliding + 1-Block Auto Step-Up
    const tryMoveAxis = (nx, nz) => {
      if (Math.hypot(nx, nz) > 36) return false;
      if (this.isWallBlocked(nx, nz, this.pos.y)) return false;
      // Allow climbing up to 1.05 blocks smoothly
      const nextGround = this.getGroundHeightAt(nx, nz, this.pos.y + 1.05);
      // Prevent walking into a cliff taller than 1 block above current feet
      const higherCheck = this.getGroundHeightAt(nx, nz, this.pos.y + 2.5);
      if (higherCheck > this.pos.y + 1.08 && nextGround < this.pos.y - 0.5) {
        return false;
      }
      return true;
    };

    if (tryMoveAxis(this.pos.x + stepX, this.pos.z)) {
      this.pos.x += stepX;
    }
    if (tryMoveAxis(this.pos.x, this.pos.z + stepZ)) {
      this.pos.z += stepZ;
    }

    // Rotate character smoothly toward movement direction
    if (isMoving) {
      const targetYaw = Math.atan2(moveDir.x, moveDir.z);
      this.yaw = lerpAngle(this.yaw, targetYaw, Math.min(1, dt * 13));
    }

    // 3. Vertical Physics (Gravity, Ground Snap, Swimming)
    const groundY = this.getGroundHeightAt(this.pos.x, this.pos.z, this.pos.y + 1.05);
    const swimSurface = WATER_LEVEL - 0.34;

    if (groundY >= WATER_LEVEL - 0.2) {
      // On solid dry land / bridge / pier / custom bricks
      this.swimming = false;
      if (this.grounded && this.velY <= 0 && groundY >= this.pos.y - 0.55 && groundY <= this.pos.y + 1.05) {
        // Smooth auto step-up or step-down on LEGO steps
        this.pos.y = groundY;
        this.velY = 0;
        this.coyoteTimer = 0.13;
      } else {
        this.velY -= 22.0 * dt;
        this.pos.y += this.velY * dt;
        if (this.pos.y <= groundY) {
          this.pos.y = groundY;
          this.velY = 0;
          this.grounded = true;
          this.coyoteTimer = 0.13;
        } else {
          this.grounded = false;
          this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
        }
      }
    } else {
      // Over water (ocean or crystal lagoon)
      this.velY -= 18.0 * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= swimSurface) {
        if (!this.swimming && this.velY < -3.0 && this.onWaterSplash) {
          this.onWaterSplash(new THREE.Vector3(this.pos.x, WATER_LEVEL + 0.1, this.pos.z), 12, 4.0);
        }
        this.pos.y = swimSurface;
        this.velY = 0;
        this.swimming = true;
        this.grounded = false;
      }
    }

    // Smooth visual Y interpolation so 1-block LEGO step-ups look buttery smooth
    this.visualY += (this.pos.y - this.visualY) * Math.min(1, dt * 18);
    this.group.position.set(this.pos.x, this.visualY, this.pos.z);
    this.group.rotation.y = this.yaw;

    // 4. Character Limb Animations & Footsteps / Water Splashes
    if (this.swimming) {
      this.bodyPivot.rotation.x = THREE.MathUtils.lerp(this.bodyPivot.rotation.x, 0.72, Math.min(1, dt * 8));
      this.bodyPivot.position.y = Math.sin(elapsed * 3.5) * 0.06;
      const stroke = Math.sin(elapsed * (isMoving ? 8.5 : 3.2)) * 0.65;
      this.leftLegPivot.rotation.x = stroke;
      this.rightLegPivot.rotation.x = -stroke;
      this.leftArmPivot.rotation.x = -1.2 + stroke * 0.6;
      this.rightArmPivot.rotation.x = -1.2 - stroke * 0.6;

      if (isMoving) {
        this.splashTimer -= dt;
        if (this.splashTimer <= 0) {
          this.splashTimer = 0.24;
          this.audio.playFootstep(true);
          if (this.onWaterSplash) {
            this.onWaterSplash(new THREE.Vector3(this.pos.x, WATER_LEVEL + 0.08, this.pos.z), 5, 2.4);
          }
        }
      }
    } else {
      this.bodyPivot.rotation.x = THREE.MathUtils.lerp(this.bodyPivot.rotation.x, 0, Math.min(1, dt * 12));
      if (!this.grounded) {
        // Joyful LEGO jump pose
        this.leftLegPivot.rotation.x = -0.35;
        this.rightLegPivot.rotation.x = 0.4;
        this.leftArmPivot.rotation.x = -2.1;
        this.rightArmPivot.rotation.x = -1.8;
        this.bodyPivot.position.y = 0;
      } else if (isMoving) {
        const freq = keys.sprint ? 14.5 : 10.5;
        const swing = Math.sin(elapsed * freq) * 0.72;
        this.leftLegPivot.rotation.x = swing;
        this.rightLegPivot.rotation.x = -swing;
        this.leftArmPivot.rotation.x = -swing * 0.85;
        // Keep right arm slightly forward if lantern is glowing at night
        this.rightArmPivot.rotation.x = nightFactor > 0.3 ? -0.65 + swing * 0.25 : swing * 0.85;
        this.bodyPivot.position.y = Math.abs(Math.sin(elapsed * freq)) * 0.09;

        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = keys.sprint ? 0.22 : 0.31;
          this.audio.playFootstep(false);
        }
      } else {
        this.leftLegPivot.rotation.x *= Math.pow(0.01, dt);
        this.rightLegPivot.rotation.x *= Math.pow(0.01, dt);
        this.leftArmPivot.rotation.x *= Math.pow(0.01, dt);
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
          this.rightArmPivot.rotation.x,
          nightFactor > 0.3 ? -0.75 : 0,
          Math.min(1, dt * 8)
        );
        this.bodyPivot.position.y = Math.sin(elapsed * 2.5) * 0.025;
      }
    }

    // 5. Nighttime Handheld Lantern Glow
    const lamp = Math.max(0, (nightFactor - 0.18) / 0.65);
    this.mats.lantern.emissiveIntensity = 0.2 + lamp * 2.4;
    this.lanternLight.intensity = lamp * 8.5;

    // 6. Auto-Collect Nearby Hidden Treasure Chests!
    if (this.onTreasurePickup) {
      for (const chest of this.world.chests) {
        if (!chest.opened && this.pos.distanceTo(chest.worldPos) < 1.85) {
          this.onTreasurePickup(chest);
        }
      }
    }

    // 7. Camera Tracking (Third-Person Delta Follow OR First-Person Eye View)
    if (this.firstPerson) {
      const eyeY = this.visualY + 1.08 + (this.swimming ? -0.15 : 0);
      camera.position.set(this.pos.x, eyeY, this.pos.z);
      const lookDir = new THREE.Vector3(
        Math.sin(this.fpYaw) * Math.cos(this.fpPitch),
        Math.sin(this.fpPitch),
        Math.cos(this.fpYaw) * Math.cos(this.fpPitch)
      );
      camera.lookAt(this.pos.x + lookDir.x, eyeY + lookDir.y, this.pos.z + lookDir.z);
    } else {
      const dx = this.pos.x - prevX;
      const dy = this.visualY - prevY;
      const dz = this.pos.z - prevZ;
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
      controls.target.set(this.pos.x, this.visualY + 1.25, this.pos.z);
    }
  }
}
