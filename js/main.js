import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  BUILD_SWATCHES,
  BUILD_PREFABS,
  CAMERA_PRESETS,
  FISH_CATALOG,
  createLegoBrickTexture,
  showToast,
} from './config.js';
import { SoundEngine } from './audio.js';
import { buildIslandWorld } from './worldBuilder.js';
import { buildArchipelago } from './archipelago.js';
import { createLivingEntities } from './livingEntities.js';
import { createAtmosphere } from './atmosphere.js';
import { LegoBuildSystem } from './buildSystem.js';
import { PlayerController } from './playerController.js';
import { FlightSystem, CannonMiniGame, FishingMiniGame } from './minigames.js';

// =========================================================================
// 1. RENDERER, SCENE, CAMERA & ORBIT CONTROLS
// =========================================================================
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9bd2f5, 0.0029);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.5, 540);
camera.position.set(...CAMERA_PRESETS.overview.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.482;
controls.minPolarAngle = 0.12;
controls.minDistance = 4.2;
controls.maxDistance = 135;
controls.target.set(...CAMERA_PRESETS.overview.target);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.36;

// =========================================================================
// 2. CORE WORLD + ARCHIPELAGO + AUDIO + PARTICLE BURSTS
// =========================================================================
const audio = new SoundEngine();
const legoBrickTex = createLegoBrickTexture();
const world = buildIslandWorld(scene, legoBrickTex);
const archipelago = buildArchipelago(scene, world, legoBrickTex);

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();
const particleGeo = new THREE.BoxGeometry(1, 1, 1);

const burstMax = 420;
const burstMesh = new THREE.InstancedMesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), burstMax);
burstMesh.frustumCulled = false;
const burstParticles = [];
for (let i = 0; i < burstMax; i++) {
  burstParticles.push({
    active: false,
    pos: new THREE.Vector3(0, -100, 0),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
    size: 0.24,
    color: new THREE.Color(0xffffff),
    gravity: 9.8,
  });
  dummy.position.set(0, -100, 0);
  dummy.scale.set(0.001, 0.001, 0.001);
  dummy.updateMatrix();
  burstMesh.setMatrixAt(i, dummy.matrix);
  burstMesh.setColorAt(i, tmpColor.setHex(0xffffff));
}
burstMesh.instanceMatrix.needsUpdate = true;
burstMesh.instanceColor.needsUpdate = true;
scene.add(burstMesh);

const fireworkFlash = new THREE.PointLight(0xffaa55, 0, 48);
scene.add(fireworkFlash);

const FIREWORK_COLORS = [0xff5e7e, 0xffd166, 0x4cc9f0, 0x72efdd, 0xb388ff, 0xff9f43, 0x69f0ae];
let burstCursor = 0;

function spawnBurst(origin, count = 42, speed = 8.5, { isFirework = false, singleColor = null, gravity = 9.8 } = {}) {
  const c1 = singleColor ?? FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
  const c2 = singleColor ?? FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
  for (let i = 0; i < count; i++) {
    const p = burstParticles[burstCursor];
    burstCursor = (burstCursor + 1) % burstMax;
    p.active = true;
    p.pos.copy(origin);
    const theta = Math.random() * Math.PI * 2;
    const phi = isFirework ? Math.acos(2 * Math.random() - 1) : Math.random() * Math.PI * 0.42;
    const spd = speed * (0.45 + Math.random() * 0.65);
    p.vel.set(
      Math.sin(phi) * Math.cos(theta) * spd,
      Math.cos(phi) * spd + (isFirework ? 2.0 : 3.8),
      Math.sin(phi) * Math.sin(theta) * spd
    );
    p.life = 0;
    p.maxLife = isFirework ? 1.15 + Math.random() * 0.7 : 0.65 + Math.random() * 0.4;
    p.size = isFirework ? 0.24 + Math.random() * 0.16 : 0.17 + Math.random() * 0.12;
    p.color.setHex(i % 2 === 0 ? c1 : c2);
    p.gravity = gravity;
  }
  if (isFirework) {
    fireworkFlash.position.copy(origin);
    fireworkFlash.color.setHex(c1);
    fireworkFlash.intensity = 18;
    audio.playFireworkBoom();
  }
}

function launchSkyFirework() {
  const rx = (Math.random() - 0.5) * 40;
  const rz = (Math.random() - 0.5) * 32;
  const ry = 18 + Math.random() * 12;
  spawnBurst(new THREE.Vector3(rx, ry, rz), 54, 10.5, { isFirework: true });
}

function onWaterSplash(pos, count, speed) {
  spawnBurst(pos, count, speed, { singleColor: 0xdff6ff, gravity: 11.5 });
}

function triggerScreenFlash(opacity = 0.55) {
  const flash = document.getElementById('screen-flash');
  flash.style.opacity = String(opacity);
  setTimeout(() => { flash.style.opacity = '0'; }, 90);
}

// Living Entities + Expanded Archipelago Atmosphere
const entities = createLivingEntities(scene, world, legoBrickTex, onWaterSplash);
const atmosphere = createAtmosphere(scene, world, entities, () => {
  triggerScreenFlash(0.32);
  audio.playThunder();
});

// Brick Counter + Super LEGO Workshop Builder
const statBricks = document.getElementById('stat-bricks');
const statBuilt = document.getElementById('stat-built');

function updateBrickCounters(userCount) {
  statBricks.textContent = `🧱 ${(world.baseBrickCount + userCount).toLocaleString()} 块`;
  statBuilt.textContent = `已拼 ${userCount} 块`;
}

const buildSystem = new LegoBuildSystem(
  scene,
  world,
  [archipelago.archBrickMesh],
  legoBrickTex,
  audio,
  (pos, cnt, spd, col) => spawnBurst(pos, cnt, spd, { singleColor: col }),
  updateBrickCounters
);
updateBrickCounters(buildSystem.getCount());

// Treasure Hunt (8 Legendary Archipelago Chests!)
let foundChests = 0;
const statChests = document.getElementById('stat-chests');
const totalChests = world.chests.length;
statChests.textContent = `💎 宝箱 0/${totalChests}`;

function openTreasureChest(chest) {
  if (!chest || chest.opened) return;
  chest.opened = true;
  foundChests++;
  statChests.textContent = `💎 宝箱 ${foundChests}/${totalChests}`;
  audio.playTreasureFanfare();
  spawnBurst(chest.worldPos, 48, 8.2, { singleColor: 0xffd23f });
  if (foundChests === totalChests) {
    showToast(`🏆 传奇达成！全部 ${totalChests} 个群岛秘宝已集齐，盛大烟花庆典开启！`);
    for (let i = 0; i < 7; i++) setTimeout(launchSkyFirework, i * 300);
  } else {
    showToast(`💎 发现「${chest.name}」！（${foundChests}/${totalChests}）`);
  }
}

// Player Walk Controller
const player = new PlayerController(scene, world, buildSystem, audio, onWaterSplash, openTreasureChest);

// Mini-Games: Flight + Sky Rings, Harbor Cannon, Pier Fishing
const statRings = document.getElementById('stat-rings');
const flightSystem = new FlightSystem(
  scene,
  entities.seaplane,
  audio,
  (pos, cnt, spd, isFw) => spawnBurst(pos, cnt, spd, { isFirework: isFw }),
  () => {
    showToast('🏆 王牌飞行员！全部 10 个群岛飞环挑战通关！');
    for (let i = 0; i < 6; i++) setTimeout(launchSkyFirework, i * 280);
  }
);

const statCannonScore = document.getElementById('stat-cannon-score');
const cannonGame = new CannonMiniGame(
  scene,
  legoBrickTex,
  audio,
  (pos, cnt, spd, col) => spawnBurst(pos, cnt, spd, { singleColor: col }),
  (score) => { statCannonScore.textContent = `🎯 击沉 ${score} 艘`; }
);

const statFishDex = document.getElementById('stat-fishdex');
const fishStatusEl = document.getElementById('fish-status');
const btnFishAction = document.getElementById('btn-fish-action');
const fishDexRow = document.getElementById('fish-dex-row');

function renderFishDex(caughtSet) {
  statFishDex.textContent = `🐟 图鉴 ${caughtSet.size}/${FISH_CATALOG.length}`;
  fishDexRow.innerHTML = '';
  FISH_CATALOG.forEach((f) => {
    const caught = caughtSet.has(f.id);
    const badge = document.createElement('span');
    badge.className = `fish-badge${caught ? ' caught' : ''}`;
    badge.textContent = caught ? `${f.icon} ${f.name}` : `❓ ${f.rarity}`;
    badge.title = caught ? `${f.name}（${f.rarity}）` : '尚未钓获';
    fishDexRow.appendChild(badge);
  });
}

const fishingGame = new FishingMiniGame(
  audio,
  (pos, cnt, spd, col) => spawnBurst(pos, cnt, spd, { singleColor: col }),
  ({ state, statusText, btnText, caughtSet }) => {
    fishStatusEl.textContent = statusText;
    btnFishAction.textContent = btnText;
    btnFishAction.classList.toggle('biting-pulse', state === 'biting');
    renderFishDex(caughtSet);
  }
);
renderFishDex(fishingGame.caughtSet);

// =========================================================================
// 3. CONTINUOUS PARTICLES (Waterfall, Chimney Smoke, Campfire, Volcano Lava)
// =========================================================================
const waterfallCount = 56;
const waterfallMesh = new THREE.InstancedMesh(
  particleGeo,
  new THREE.MeshStandardMaterial({ color: 0xbef4ff, roughness: 0.2, transparent: true, opacity: 0.88 }),
  waterfallCount
);
const waterfallData = Array.from({ length: waterfallCount }, () => ({
  t: Math.random(),
  xOff: (Math.random() - 0.5) * 0.82,
  zOff: (Math.random() - 0.5) * 0.35,
  speed: 0.42 + Math.random() * 0.25,
  size: 0.22 + Math.random() * 0.22,
}));
scene.add(waterfallMesh);

const smokeCount = 28;
const smokeMesh = new THREE.InstancedMesh(
  particleGeo,
  new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 1.0, transparent: true, opacity: 0.62 }),
  smokeCount
);
const smokeData = Array.from({ length: smokeCount }, (_, i) => ({
  origin: world.chimneyPositions[i % world.chimneyPositions.length],
  t: Math.random(),
  speed: 0.14 + Math.random() * 0.07,
  driftX: 0.6 + Math.random() * 0.6,
  driftZ: -0.3 + Math.random() * 0.6,
}));
scene.add(smokeMesh);

const fireCount = 26;
const fireMesh = new THREE.InstancedMesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), fireCount);
const fireData = Array.from({ length: fireCount }, () => ({
  t: Math.random(),
  speed: 0.75 + Math.random() * 0.65,
  angle: Math.random() * Math.PI * 2,
  rad: Math.random() * 0.34,
}));
scene.add(fireMesh);

const lavaCount = 46;
const lavaMesh = new THREE.InstancedMesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), lavaCount);
lavaMesh.visible = false;
const lavaData = Array.from({ length: lavaCount }, () => ({
  t: Math.random(),
  speed: 0.38 + Math.random() * 0.32,
  vx: (Math.random() - 0.5) * 5.2,
  vz: (Math.random() - 0.5) * 5.2,
  vy: 7.5 + Math.random() * 5.5,
  size: 0.28 + Math.random() * 0.24,
}));
scene.add(lavaMesh);

// =========================================================================
// 4. STATE, MODE SWITCHING & CAMERA FLY-TO
// =========================================================================
let timeOfDay = 10.2;
let isPlayingTime = true;
let weather = 'clear';
let volcanoMode = false;
let auroraEnabled = true;
let appMode = 'explore'; // explore | walk | sail | flight | coaster | cannon | fish | build
let snowAccumulation = 0;
let lastAppliedSnow = 0;

const keys = { forward: false, backward: false, left: false, right: false, sprint: false };

let camAnim = null;
function flyToPreset(name) {
  if (appMode !== 'explore' && appMode !== 'build') setAppMode('explore');
  const p = CAMERA_PRESETS[name];
  if (!p) return;
  camAnim = {
    startPos: camera.position.clone(),
    endPos: new THREE.Vector3(...p.pos),
    startTarget: controls.target.clone(),
    endTarget: new THREE.Vector3(...p.target),
    progress: 0,
    duration: 1.05,
  };
  document.querySelectorAll('#camera-presets .chip-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cam === name);
  });
}

controls.addEventListener('start', () => { camAnim = null; });

const modeBars = {
  walk: document.getElementById('walk-bar'),
  sail: document.getElementById('sail-bar'),
  flight: document.getElementById('flight-bar'),
  coaster: document.getElementById('coaster-bar'),
  cannon: document.getElementById('cannon-bar'),
  fish: document.getElementById('fish-bar'),
  build: document.getElementById('build-bar'),
};
const statSpeed = document.getElementById('stat-speed');
const statWalkState = document.getElementById('stat-walk-state');
const btnWalkView = document.getElementById('btn-walk-view');

function syncWalkViewButton() {
  btnWalkView.textContent = player.firstPerson ? '🎥 第三人称' : '👁️ 第一人称';
}

function setAppMode(nextMode) {
  const prevMode = appMode;
  appMode = nextMode;

  document.querySelectorAll('.mode-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === nextMode);
  });

  // Cleanly exit previous mode
  if (prevMode === 'walk') player.exit(controls);
  if (prevMode === 'flight') flightSystem.exit();
  if (prevMode === 'cannon') cannonGame.exit(controls);
  if (prevMode === 'coaster') controls.enabled = true;

  buildSystem.setActive(nextMode === 'build');
  Object.entries(modeBars).forEach(([k, el]) => el.classList.toggle('hidden', k !== nextMode));
  container.classList.toggle('build-cursor', nextMode === 'build' || nextMode === 'cannon');

  if (nextMode !== 'explore') {
    controls.autoRotate = false;
    document.getElementById('btn-rotate').classList.remove('active');
    camAnim = null;
  }

  if (nextMode === 'walk') {
    player.enter(camera, controls);
    syncWalkViewButton();
    showToast('🚶 已进入漫步模式！WASD 移动，Space 跳跃，V 切换第一人称');
  } else if (nextMode === 'sail') {
    showToast('⛵ 航海模式：WASD 掌舵，可开往海盗骷髅岛和过山车岛！');
  } else if (nextMode === 'flight') {
    flightSystem.enter();
    showToast('✈️ 水上飞机已起飞！穿过天空中的 10 个金色飞环挑战群岛吧！');
  } else if (nextMode === 'coaster') {
    controls.enabled = false;
    showToast('🎢 系好安全带！乐高过山车第一人称发车啦！');
  } else if (nextMode === 'cannon') {
    cannonGame.enter(camera, controls);
    showToast('💥 乐高大炮就位！移动鼠标瞄准海盗靶船，左键开炮轰碎它们！');
  } else if (nextMode === 'fish') {
    camAnim = {
      startPos: camera.position.clone(),
      endPos: new THREE.Vector3(7.5, 6.2, 20.5),
      startTarget: controls.target.clone(),
      endTarget: new THREE.Vector3(2.8, 1.8, 15.6),
      progress: 0,
      duration: 0.85,
    };
    showToast('🎣 来到木头码头啦！点击抛竿或按 Space 开始钓鱼');
  } else if (nextMode === 'build') {
    showToast('🧱 乐高工坊：可选预制件（含红色弹跳蹦床！）并一键生成分享链接');
  }
}

// Populate Build Prefabs & Swatches
const prefabContainer = document.getElementById('build-prefabs');
BUILD_PREFABS.forEach((pf, idx) => {
  const btn = document.createElement('button');
  btn.className = `chip-btn${idx === 0 ? ' active' : ''}`;
  btn.textContent = pf.label;
  btn.addEventListener('click', () => {
    buildSystem.setPrefab(pf.id);
    prefabContainer.querySelectorAll('.chip-btn').forEach((el) => el.classList.remove('active'));
    btn.classList.add('active');
  });
  prefabContainer.appendChild(btn);
});

const swatchContainer = document.getElementById('build-swatches');
BUILD_SWATCHES.forEach((sw, idx) => {
  const btn = document.createElement('button');
  btn.className = `brick-swatch${idx === 0 ? ' active' : ''}${sw.emissive ? ' glow-swatch' : ''}`;
  btn.style.background = sw.css;
  btn.title = sw.name;
  btn.addEventListener('click', () => {
    buildSystem.setSwatch(sw);
    buildSystem.setPrefab('single');
    prefabContainer.querySelectorAll('.chip-btn').forEach((el, i) => el.classList.toggle('active', i === 0));
    swatchContainer.querySelectorAll('.brick-swatch').forEach((el) => el.classList.remove('active'));
    btn.classList.add('active');
  });
  swatchContainer.appendChild(btn);
});

// =========================================================================
// 5. POINTER & KEYBOARD INTERACTIONS
// =========================================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = { x: 0, y: 0, button: 0 };
let isDraggingFP = false;
let lastDragPos = { x: 0, y: 0 };

function updatePointer(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

renderer.domElement.addEventListener('pointermove', (e) => {
  if (appMode === 'walk' && player.firstPerson && isDraggingFP) {
    player.rotateFirstPerson(e.clientX - lastDragPos.x, e.clientY - lastDragPos.y);
    lastDragPos = { x: e.clientX, y: e.clientY };
    return;
  }
  if (appMode === 'build') {
    updatePointer(e);
    buildSystem.updateHover(raycaster);
  } else if (appMode === 'cannon') {
    updatePointer(e);
    cannonGame.aimAtPointer(raycaster);
  }
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, button: e.button };
  if (appMode === 'walk' && player.firstPerson && e.button === 0) {
    isDraggingFP = true;
    lastDragPos = { x: e.clientX, y: e.clientY };
  }
  if (appMode === 'cannon' && e.button === 0) {
    updatePointer(e);
    cannonGame.aimAtPointer(raycaster);
    cannonGame.fire();
  }
});

window.addEventListener('pointerup', () => { isDraggingFP = false; });

renderer.domElement.addEventListener('contextmenu', (e) => {
  if (appMode === 'build') e.preventDefault();
});

renderer.domElement.addEventListener('pointerup', (e) => {
  const moveDist = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
  if (moveDist > 6 || appMode === 'cannon') return;
  updatePointer(e);

  if (appMode === 'build') {
    if (e.button === 0) {
      buildSystem.updateHover(raycaster);
      buildSystem.placeBrickAtHover();
    } else if (e.button === 2) {
      buildSystem.removeBrickByRay(raycaster);
    }
    return;
  }

  if (e.button !== 0) return;

  // Click Hidden Treasure Chests across ALL islands!
  const chestHits = raycaster.intersectObjects(world.chestHitMeshes, false);
  if (chestHits.length > 0) {
    const idx = chestHits[0].object.userData.chestIndex;
    const chest = world.chests[idx];
    if (chest && !chest.opened) {
      openTreasureChest(chest);
      return;
    }
  }

  const hits = raycaster.intersectObjects([world.brickMesh, archipelago.archBrickMesh, atmosphere.oceanMesh], false);
  if (hits.length > 0) {
    const pt = hits[0].point.clone();
    pt.y += 0.55;
    const isWater = hits[0].object === atmosphere.oceanMesh;
    spawnBurst(pt, 24, 5.8, isWater ? { singleColor: 0xbff4ff } : {});
    if (!isWater) audio.playBrickSnap();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.backward = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.sprint = true;

  if (e.code === 'Space') {
    if (appMode === 'walk') { e.preventDefault(); player.jump(); }
    else if (appMode === 'sail') { e.preventDefault(); triggerBoatHorn(); }
    else if (appMode === 'flight') { e.preventDefault(); flightSystem.fireSmokeSalute(); }
    else if (appMode === 'fish') { e.preventDefault(); fishingGame.castOrReel(); }
    else if (appMode === 'cannon') { e.preventDefault(); cannonGame.fire(); }
  }
  if (e.code === 'KeyV' && appMode === 'walk') {
    const fp = player.togglePerspective(camera, controls);
    syncWalkViewButton();
    showToast(fp ? '👁️ 第一人称视角（按住左键拖拽环顾四周）' : '🎥 第三人称追尾视角');
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && appMode === 'build') {
    e.preventDefault();
    buildSystem.undo();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.backward = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.sprint = false;
});

function triggerBoatHorn() {
  audio.playBoatHorn();
  spawnBurst(entities.sailboat.position.clone().add(new THREE.Vector3(0, 6.2, 0)), 36, 7.8, { isFirework: true });
}

// =========================================================================
// 6. POSTCARD SNAPSHOT & UI EVENT BINDINGS
// =========================================================================
function capturePostcard() {
  triggerScreenFlash(0.65);
  audio.playBrickSnap();
  renderer.render(scene, camera);

  const src = renderer.domElement;
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(src, 0, 0);

  const pad = Math.round(out.width * 0.025);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(3, Math.round(out.width * 0.004));
  ctx.strokeRect(pad, pad, out.width - pad * 2, out.height - pad * 2);

  const fontSize = Math.max(18, Math.round(out.width * 0.018));
  ctx.font = `700 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = 'rgba(15, 22, 36, 0.65)';
  const label = `🏝️ 乐高群岛大冒险 2.0 · ${document.getElementById('clock-label').textContent}`;
  const tw = ctx.measureText(label).width;
  const bx = out.width - pad - tw - 28;
  const by = out.height - pad - fontSize - 24;
  ctx.fillRect(bx, by, tw + 24, fontSize + 18);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, bx + 12, by + fontSize + 2);

  const link = document.createElement('a');
  link.download = `voxel-lego-archipelago-${Date.now()}.png`;
  link.href = out.toDataURL('image/png');
  link.click();
  showToast('📸 高清群岛明信片已保存到下载目录！');
}

const timeSlider = document.getElementById('time-slider');
const clockLabel = document.getElementById('clock-label');
const btnPlay = document.getElementById('btn-play');
const btnAudio = document.getElementById('btn-audio');
const btnVolcano = document.getElementById('btn-volcano');
const btnAurora = document.getElementById('btn-aurora');
const btnStuds = document.getElementById('btn-studs');
const btnRotate = document.getElementById('btn-rotate');
const btnZen = document.getElementById('btn-zen');
const hud = document.getElementById('hud');

btnAurora.classList.add('aurora-active');

document.querySelectorAll('.mode-tab').forEach((btn) => {
  btn.addEventListener('click', () => setAppMode(btn.dataset.mode));
});

btnPlay.addEventListener('click', () => {
  isPlayingTime = !isPlayingTime;
  btnPlay.textContent = isPlayingTime ? '⏸' : '▶';
});

timeSlider.addEventListener('input', (e) => {
  timeOfDay = parseFloat(e.target.value);
  isPlayingTime = false;
  btnPlay.textContent = '▶';
});

document.querySelectorAll('[data-time]').forEach((btn) => {
  btn.addEventListener('click', () => {
    timeOfDay = parseFloat(btn.dataset.time);
    timeSlider.value = timeOfDay.toFixed(2);
  });
});

document.querySelectorAll('#weather-presets .chip-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    weather = btn.dataset.weather;
    document.querySelectorAll('#weather-presets .chip-btn').forEach((b) => b.classList.toggle('active', b === btn));
    const names = { clear: '☀️ 群岛放晴啦', rain: '🌧️ 下起细雨了', storm: '⛈️ 雷暴来袭！注意闪电', snow: '❄️ 飘起体素雪花，海岛正在染白…' };
    showToast(names[weather]);
  });
});

document.querySelectorAll('#camera-presets .chip-btn').forEach((btn) => {
  btn.addEventListener('click', () => flyToPreset(btn.dataset.cam));
});

btnAudio.addEventListener('click', () => {
  const on = audio.toggle();
  btnAudio.innerHTML = on ? '🔊 <span class="label">音效</span>' : '🔇 <span class="label">音效</span>';
  btnAudio.classList.toggle('active', on);
  if (on) showToast('🔊 已开启海浪、大炮、钓鱼与乐高实时合成音效');
});

btnVolcano.addEventListener('click', () => {
  volcanoMode = !volcanoMode;
  lavaMesh.visible = volcanoMode;
  btnVolcano.classList.toggle('volcano-active', volcanoMode);
  world.updateSurfaceTheme(volcanoMode, snowAccumulation);
  showToast(volcanoMode ? '🌋 活火山苏醒！熔岩正在喷发（夜晚更震撼）' : '🏔️ 已恢复宁静的雪顶山峰');
});

btnAurora.addEventListener('click', () => {
  auroraEnabled = !auroraEnabled;
  btnAurora.classList.toggle('active', auroraEnabled);
  btnAurora.classList.toggle('aurora-active', auroraEnabled);
  showToast(auroraEnabled ? '🌌 夜空极光与流星雨已开启' : '🌌 已关闭极光与流星雨');
});

document.getElementById('btn-firework').addEventListener('click', () => {
  launchSkyFirework();
  setTimeout(launchSkyFirework, 260);
});

document.getElementById('btn-photo').addEventListener('click', capturePostcard);

btnStuds.addEventListener('click', () => {
  const next = !world.studMesh.visible;
  world.studMesh.visible = next;
  archipelago.archStudMesh.visible = next;
  buildSystem.setStudsVisible(next);
  btnStuds.classList.toggle('active', next);
});

btnRotate.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  btnRotate.classList.toggle('active', controls.autoRotate);
});

btnZen.addEventListener('click', () => {
  const isZen = hud.classList.toggle('zen');
  btnZen.classList.toggle('active', isZen);
});

// Contextual Bar Buttons
btnWalkView.addEventListener('click', () => {
  if (appMode !== 'walk') return;
  const fp = player.togglePerspective(camera, controls);
  syncWalkViewButton();
  showToast(fp ? '👁️ 第一人称视角（左键拖拽环顾四周）' : '🎥 第三人称追尾视角');
});

document.getElementById('btn-walk-exit').addEventListener('click', () => { setAppMode('explore'); flyToPreset('overview'); });
document.getElementById('btn-walk-respawn').addEventListener('click', () => {
  player.pos.set(2.5, 3.0, 5.2);
  player.visualY = 3.0;
  player.velY = 0;
  if (appMode === 'walk') player.enter(camera, controls);
  showToast('🏠 已回到港口小镇广场');
});

document.querySelectorAll('#walk-outfits [data-outfit]').forEach((btn) => {
  btn.addEventListener('click', () => {
    player.setOutfit(btn.dataset.outfit);
    document.querySelectorAll('#walk-outfits [data-outfit]').forEach((b) => b.classList.toggle('active', b === btn));
  });
});

document.getElementById('btn-sail-horn').addEventListener('click', triggerBoatHorn);
document.getElementById('btn-sail-exit').addEventListener('click', () => { setAppMode('explore'); flyToPreset('overview'); });

document.getElementById('btn-flight-reset').addEventListener('click', () => {
  flightSystem.resetRings();
  statRings.textContent = '⭕ 飞环 0/10';
  showToast('🔄 10 个金色飞环已重置！');
});
document.getElementById('btn-flight-exit').addEventListener('click', () => { setAppMode('explore'); flyToPreset('overview'); });
document.getElementById('btn-coaster-exit').addEventListener('click', () => { setAppMode('explore'); flyToPreset('coaster'); });
document.getElementById('btn-cannon-exit').addEventListener('click', () => { setAppMode('explore'); flyToPreset('overview'); });
btnFishAction.addEventListener('click', () => fishingGame.castOrReel());
document.getElementById('btn-fish-exit').addEventListener('click', () => { setAppMode('explore'); flyToPreset('overview'); });

document.getElementById('btn-build-undo').addEventListener('click', () => buildSystem.undo());
document.getElementById('btn-build-clear').addEventListener('click', () => {
  if (buildSystem.getCount() > 0) {
    buildSystem.clearAll();
    showToast('🗑️ 已清空所有自建乐高积木');
  }
});
document.getElementById('btn-build-share').addEventListener('click', async () => {
  if (buildSystem.getCount() === 0) {
    showToast('🧱 先在岛上拼几块乐高积木，再生成分享链接吧！');
    return;
  }
  const url = buildSystem.getShareUrl();
  window.history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    showToast('🔗 专属海岛分享链接已复制到剪贴板！发给朋友即可参观');
  } catch (_) {
    showToast('🔗 分享链接已更新到浏览器地址栏，直接复制即可分享！');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function formatClock(t) {
  const wrapped = ((t % 24) + 24) % 24;
  const hrs = Math.floor(wrapped);
  const mins = Math.floor((wrapped - hrs) * 60);
  const hh = String(hrs).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  let icon = '☀️', tag = '正午';
  if (wrapped < 5.2 || wrapped >= 20.0) { icon = '🌙'; tag = '星空'; }
  else if (wrapped < 7.5) { icon = '🌅'; tag = '黎明'; }
  else if (wrapped < 11.2) { icon = '🌤️'; tag = '上午'; }
  else if (wrapped < 15.8) { icon = '☀️'; tag = '正午'; }
  else if (wrapped < 18.8) { icon = '🌇'; tag = '黄昏'; }
  else { icon = '🌆'; tag = '暮色'; }
  return `${icon} ${hh}:${mm} ${tag}`;
}

// =========================================================================
// 7. MAIN 60FPS ANIMATION LOOP
// =========================================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (isPlayingTime) {
    timeOfDay = (timeOfDay + dt * 0.32) % 24;
    timeSlider.value = timeOfDay.toFixed(2);
  }
  clockLabel.textContent = formatClock(timeOfDay);

  const targetSnow = weather === 'snow' ? 1.0 : 0.0;
  snowAccumulation += (targetSnow - snowAccumulation) * Math.min(1, dt * 0.65);
  if (Math.abs(snowAccumulation - lastAppliedSnow) > 0.025) {
    lastAppliedSnow = snowAccumulation;
    world.updateSurfaceTheme(volcanoMode, snowAccumulation);
  }

  const nightFactor = atmosphere.update(dt, elapsed, { timeOfDay, weather, auroraEnabled, volcanoMode });
  audio.updateAmbient(dt, weather, nightFactor);

  entities.update(dt, elapsed, {
    nightFactor,
    weather,
    sailMode: appMode === 'sail',
    flightMode: appMode === 'flight',
    keys,
  });

  archipelago.update(dt, elapsed, {
    nightFactor,
    rideCoaster: appMode === 'coaster',
    camera,
    controls,
  });

  flightSystem.update(dt, elapsed, {
    keys,
    camera,
    controls,
    onRingCountChange: (c, total) => { statRings.textContent = `⭕ 飞环 ${c}/${total}`; },
  });

  cannonGame.update(dt, elapsed);
  fishingGame.update(dt);

  if (appMode === 'walk') {
    player.update(dt, elapsed, { keys, camera, controls, nightFactor });
    statWalkState.textContent = player.swimming
      ? '🏊 海中畅游'
      : `🥾 海拔 ${Math.max(0, Math.round(player.pos.y - 1))}m`;
  }

  if (appMode === 'sail') {
    const b = entities.boatState;
    const chaseDist = 12.0;
    const desiredCam = new THREE.Vector3(
      b.x - Math.sin(b.heading) * chaseDist,
      7.0,
      b.z - Math.cos(b.heading) * chaseDist
    );
    const desiredTarget = new THREE.Vector3(b.x, 2.5, b.z);
    camera.position.lerp(desiredCam, Math.min(1, dt * 4.2));
    controls.target.lerp(desiredTarget, Math.min(1, dt * 6.0));
    statSpeed.textContent = `航速 ${(Math.abs(b.speed) * 1.4).toFixed(1)} 节`;
  }

  // Waterfall cascade foam
  for (let i = 0; i < waterfallCount; i++) {
    const w = waterfallData[i];
    w.t = (w.t + dt * w.speed) % 1.0;
    const wy = 7.4 - w.t * 5.45;
    const wz = -3.55 + w.t * 0.95 + Math.sin(w.t * Math.PI) * 0.24 + w.zOff * 0.35;
    const wx = 7.5 + w.xOff * 1.95;
    const sc = w.t > 0.82 ? w.size * (1.2 + (w.t - 0.82) * 5.2) : w.size * 1.15;
    dummy.position.set(wx, wy, wz);
    dummy.scale.set(sc, sc * (w.t > 0.82 ? 0.55 : 1.55), sc);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    waterfallMesh.setMatrixAt(i, dummy.matrix);
  }
  waterfallMesh.instanceMatrix.needsUpdate = true;

  // Chimney smoke
  for (let i = 0; i < smokeCount; i++) {
    const s = smokeData[i];
    s.t = (s.t + dt * s.speed) % 1.0;
    const sx = s.origin.x + s.t * s.driftX + Math.sin(elapsed * 1.5 + i) * 0.14;
    const sy = s.origin.y + s.t * 4.4;
    const sz = s.origin.z + s.t * s.driftZ;
    const sc = Math.sin(s.t * Math.PI) * 0.48;
    dummy.position.set(sx, sy, sz);
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.set(s.t * 2, s.t * 1.5, 0);
    dummy.updateMatrix();
    smokeMesh.setMatrixAt(i, dummy.matrix);
  }
  smokeMesh.instanceMatrix.needsUpdate = true;

  // Campfire flames
  for (let i = 0; i < fireCount; i++) {
    const f = fireData[i];
    f.t = (f.t + dt * f.speed) % 1.0;
    const fx = world.firePos.x + Math.cos(f.angle + elapsed * 2.0) * f.rad * (1.0 - f.t * 0.65);
    const fy = world.firePos.y + 0.15 + f.t * 1.65;
    const fz = world.firePos.z + Math.sin(f.angle + elapsed * 2.0) * f.rad * (1.0 - f.t * 0.65);
    const sc = (1.0 - f.t) * 0.34 + 0.04;
    dummy.position.set(fx, fy, fz);
    dummy.scale.set(sc, sc * 1.2, sc);
    dummy.rotation.set(0, f.t * 3, 0);
    dummy.updateMatrix();
    fireMesh.setMatrixAt(i, dummy.matrix);
    tmpColor.setHex(f.t < 0.35 ? 0xfff176 : f.t < 0.72 ? 0xff8f2b : 0xe53935);
    fireMesh.setColorAt(i, tmpColor);
  }
  fireMesh.instanceMatrix.needsUpdate = true;
  fireMesh.instanceColor.needsUpdate = true;

  // Volcano eruption lava bombs
  if (volcanoMode) {
    for (let i = 0; i < lavaCount; i++) {
      const l = lavaData[i];
      l.t = (l.t + dt * l.speed) % 1.0;
      const tSec = l.t * 1.7;
      const lx = 7.2 + l.vx * tSec;
      const ly = 11.2 + l.vy * tSec - 4.9 * tSec * tSec;
      const lz = -6.8 + l.vz * tSec;
      const sc = l.size * (1.0 - l.t * 0.55);
      dummy.position.set(lx, Math.max(2, ly), lz);
      dummy.scale.set(sc, sc, sc);
      dummy.rotation.set(l.t * 6, l.t * 4, 0);
      dummy.updateMatrix();
      lavaMesh.setMatrixAt(i, dummy.matrix);
      tmpColor.setHex(l.t < 0.25 ? 0xfff066 : l.t < 0.6 ? 0xff5a1f : 0x3b2d30);
      lavaMesh.setColorAt(i, tmpColor);
    }
    lavaMesh.instanceMatrix.needsUpdate = true;
    lavaMesh.instanceColor.needsUpdate = true;
  }

  // Burst particles
  let burstDirty = false;
  for (let i = 0; i < burstMax; i++) {
    const p = burstParticles[i];
    if (!p.active) continue;
    burstDirty = true;
    p.life += dt;
    if (p.life >= p.maxLife) {
      p.active = false;
      dummy.position.set(0, -100, 0);
      dummy.scale.set(0.001, 0.001, 0.001);
      dummy.updateMatrix();
      burstMesh.setMatrixAt(i, dummy.matrix);
      continue;
    }
    p.vel.y -= p.gravity * dt;
    p.vel.multiplyScalar(1 - dt * 0.72);
    p.pos.addScaledVector(p.vel, dt);
    const k = 1.0 - p.life / p.maxLife;
    const s = p.size * k;
    dummy.position.copy(p.pos);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(p.life * 5, p.life * 4, 0);
    dummy.updateMatrix();
    burstMesh.setMatrixAt(i, dummy.matrix);
    burstMesh.setColorAt(i, p.color);
  }
  if (burstDirty) {
    burstMesh.instanceMatrix.needsUpdate = true;
    burstMesh.instanceColor.needsUpdate = true;
  }
  if (fireworkFlash.intensity > 0.05) {
    fireworkFlash.intensity *= Math.pow(0.04, dt);
  } else {
    fireworkFlash.intensity = 0;
  }

  // Smooth Camera Preset Fly-to
  if (camAnim) {
    camAnim.progress += dt / camAnim.duration;
    const t = Math.min(1, camAnim.progress);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(camAnim.startPos, camAnim.endPos, ease);
    controls.target.lerpVectors(camAnim.startTarget, camAnim.endTarget, ease);
    if (t >= 1) camAnim = null;
  }

  const disableOrbit =
    (appMode === 'walk' && player.firstPerson) ||
    appMode === 'coaster' ||
    appMode === 'cannon';
  if (!disableOrbit) {
    controls.update();
  }
  renderer.render(scene, camera);
}

animate();
requestAnimationFrame(() => {
  document.getElementById('loader').classList.add('hidden');
});
