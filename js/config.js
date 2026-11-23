import * as THREE from 'three';

export const WATER_LEVEL = 1.32;
export const WORLD_HALF_EXTENT = 64;

export const PALETTE = {
  sandLight: 0xf4dc9c,
  sandWarm: 0xe8c97a,
  sandWet: 0xc9aa63,
  grassBright: 0x5bbd4b,
  grassLush: 0x45a342,
  grassMeadow: 0x6ac754,
  grassDark: 0x36853c,
  dirt: 0x8b5e3c,
  cliffLight: 0x8d959e,
  cliffMid: 0x6f7782,
  cliffDark: 0x545b66,
  obsidian: 0x262630,
  volcanoAsh: 0x3a363c,
  lavaBright: 0xff621a,
  lavaYellow: 0xffc83b,
  snow: 0xf4f8ff,
  snowShade: 0xdce7f5,
  marble: 0xf3f5fa,
  marbleTrim: 0xd8e0ee,
  woodLight: 0xc68b53,
  woodMid: 0x9c6638,
  woodDark: 0x6d4525,
  pirateHull: 0x3b261d,
  pirateBlack: 0x1e222b,
  crystalCyan: 0x38f2ff,
  crystalPurple: 0xb968ff,
  crystalEmerald: 0x26f7a0,
  cobble: 0xb0b5ba,
  cobbleAlt: 0x99a0a8,
  wallCream: 0xf7eed8,
  wallWarm: 0xf2e0be,
  wallStone: 0xd6d9de,
  roofRed: 0xd9453b,
  roofRedDark: 0xb5322b,
  roofBlue: 0x3674c9,
  roofBlueDark: 0x285aa0,
  roofOchre: 0xe89c2e,
  roofOchreDark: 0xc97f1d,
  lighthouseRed: 0xe03c31,
  lighthouseWhite: 0xf7f8fa,
  ironDark: 0x2b313a,
  pineDark: 0x26693a,
  pineMid: 0x2f7d44,
  pineLight: 0x3d944e,
  palmLeaf: 0x57b846,
  palmLeafTip: 0x73cc52,
  autumnGold: 0xf0a630,
  flowerRed: 0xf25260,
  flowerYellow: 0xffd23f,
  flowerPink: 0xf78fb3,
  coralPink: 0xff6b8b,
  coralOrange: 0xff944d,
  coralPurple: 0xa66cff,
  waterPond: 0x4ad5e8,
  umbrellaBlue: 0x2f8ef0,
  umbrellaWhite: 0xf9fafb,
  chimney: 0x7e6d68,
  sailWhite: 0xf9f9f6,
  sailRed: 0xe54842,
  hullBlue: 0x2c66b8,
  legoYellow: 0xffd500,
  gold: 0xffc436,
  goldDark: 0xc98a18,
  bounceRed: 0xff3b5c,
};

export const BUILD_SWATCHES = [
  { name: '经典红', hex: 0xe03c31, css: '#e03c31' },
  { name: '阳光黄', hex: 0xffcc29, css: '#ffcc29' },
  { name: '海洋蓝', hex: 0x2d7dd2, css: '#2d7dd2' },
  { name: '森系绿', hex: 0x45a846, css: '#45a846' },
  { name: '奶油白', hex: 0xf7f5ee, css: '#f7f5ee' },
  { name: '城堡灰', hex: 0x8f98a3, css: '#8f98a3' },
  { name: '原木棕', hex: 0xa86b3a, css: '#a86b3a' },
  { name: '樱花粉', hex: 0xff7aa2, css: '#ff7aa2' },
  { name: '薰衣草', hex: 0x9b72f2, css: '#9b72f2' },
  { name: '碧水青', hex: 0x38d6e8, css: '#38d6e8' },
  { name: '暗曜黑', hex: 0x2d333d, css: '#2d333d' },
  { name: '发光金灯', hex: 0xffda6b, css: '#ffda6b', emissive: true },
];

export const BUILD_PREFABS = [
  { id: 'single', label: '🧱 单块积木' },
  { id: 'palm', label: '🌴 棕榈树' },
  { id: 'lamp', label: '🏮 发光路灯' },
  { id: 'bounce', label: '🔺 弹跳蹦床' },
  { id: 'pillar', label: '🏛️ 大理石柱' },
];

export const FISH_CATALOG = [
  { id: 'clownfish', icon: '🐠', name: '热带小丑鱼', rarity: '普通', weight: 28, color: 0xff8c42 },
  { id: 'puffer', icon: '🐡', name: '鼓气河豚', rarity: '普通', weight: 22, color: 0xffd166 },
  { id: 'crab', icon: '🦀', name: '乐高红螃蟹', rarity: '稀有', weight: 16, color: 0xe63946 },
  { id: 'jelly', icon: '🪼', name: '荧光深海水母', rarity: '稀有', weight: 12, color: 0x64ffda },
  { id: 'turtle', icon: '🐢', name: '碧玉小海龟', rarity: '史诗', weight: 9, color: 0x38b000 },
  { id: 'bottle', icon: '🍾', name: '海盗漂流瓶', rarity: '史诗', weight: 6, color: 0x4cc9f0 },
  { id: 'shark', icon: '🦈', name: '迷你体素鲨鱼', rarity: '传说', weight: 4, color: 0x5c85a8 },
  { id: 'crown', icon: '👑', name: '失落海王金冠', rarity: '神话', weight: 3, color: 0xffc436 },
];

export const CAMERA_PRESETS = {
  overview:   { pos: [34, 28, 42],   target: [0, 4.0, 0] },
  village:    { pos: [4.5, 9.5, 19], target: [2.2, 3.5, 2.5] },
  lighthouse: { pos: [-26, 13, 16],  target: [-13.5, 7.2, 3.0] },
  waterfall:  { pos: [22, 16, 4.5],  target: [8.2, 4.2, -2.5] },
  pirate:     { pos: [54, 18, 44],   target: [34, 4.5, 24] },
  coaster:    { pos: [-56, 22, -4],  target: [-34, 7.0, -24] },
  skytemple:  { pos: [18, 44, -18],  target: [0, 34, -36] },
};

export function hash2(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm(x, z) {
  return (
    valueNoise(x, z) * 0.6 +
    valueNoise(x * 2.1 + 13.7, z * 2.1 - 7.3) * 0.28 +
    valueNoise(x * 4.3 - 5.1, z * 4.3 + 9.2) * 0.12
  );
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function createLegoBrickTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(255,255,255,0.08)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, size - 10, size - 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3300);
}
