import * as THREE from 'three';
import { WATER_LEVEL, smoothstep } from './config.js';

const KEYFRAMES = [
  { t: 0.0,  top: 0x060b1a, hor: 0x111f3d, fog: 0x0f1c36, sunC: 0x9bbcff, sunI: 0.45, hemiS: 0x1b2d54, hemiG: 0x0b1220, hemiI: 0.42, deep: 0x061530, shallow: 0x0d3654, cloud: 0x263554, glow: 0.15 },
  { t: 5.0,  top: 0x132045, hor: 0x3b355c, fog: 0x302c4f, sunC: 0xffa670, sunI: 0.55, hemiS: 0x4b4675, hemiG: 0x1c2033, hemiI: 0.46, deep: 0x091d3b, shallow: 0x154763, cloud: 0x5c4f6e, glow: 0.40 },
  { t: 6.4,  top: 0x3866a8, hor: 0xffa06b, fog: 0xf2a57c, sunC: 0xffb366, sunI: 1.45, hemiS: 0xffc699, hemiG: 0x4f463d, hemiI: 0.65, deep: 0x144175, shallow: 0x2ea5b8, cloud: 0xffd1b3, glow: 0.95 },
  { t: 9.0,  top: 0x2a7de0, hor: 0x9cd8fa, fog: 0xa2daf7, sunC: 0xfff5de, sunI: 2.05, hemiS: 0x9bd7ff, hemiG: 0x4d6b47, hemiI: 0.78, deep: 0x0e5599, shallow: 0x28cbd6, cloud: 0xffffff, glow: 0.55 },
  { t: 13.0, top: 0x1f72db, hor: 0x96d7fc, fog: 0x9bd8fa, sunC: 0xfffaf0, sunI: 2.25, hemiS: 0xa8dfff, hemiG: 0x55754e, hemiI: 0.84, deep: 0x0b5096, shallow: 0x26d1de, cloud: 0xffffff, glow: 0.48 },
  { t: 16.5, top: 0x2f6cc2, hor: 0xf7be86, fog: 0xe6b58a, sunC: 0xffcf87, sunI: 1.80, hemiS: 0xffd7a8, hemiG: 0x5c5240, hemiI: 0.72, deep: 0x134882, shallow: 0x2db2bd, cloud: 0xffe4c4, glow: 0.85 },
  { t: 18.0, top: 0x28366e, hor: 0xff754f, fog: 0xd97360, sunC: 0xff8147, sunI: 1.20, hemiS: 0xf08c73, hemiG: 0x362a33, hemiI: 0.58, deep: 0x132b57, shallow: 0x2b6e82, cloud: 0xff9f80, glow: 1.00 },
  { t: 19.6, top: 0x0c1633, hor: 0x262e57, fog: 0x1e2647, sunC: 0xa8c5ff, sunI: 0.48, hemiS: 0x2a3966, hemiG: 0x121829, hemiI: 0.44, deep: 0x081a38, shallow: 0x113d5c, cloud: 0x364266, glow: 0.25 },
  { t: 24.0, top: 0x060b1a, hor: 0x111f3d, fog: 0x0f1c36, sunC: 0x9bbcff, sunI: 0.45, hemiS: 0x1b2d54, hemiG: 0x0b1220, hemiI: 0.42, deep: 0x061530, shallow: 0x0d3654, cloud: 0x263554, glow: 0.15 },
];

function createCoastDistanceTexture(landFootprint) {
  const size = 128;
  const half = size / 2;
  const data = new Uint8Array(size * size * 4);
  const landPts = [];
  for (const k of landFootprint) {
    const [lx, lz] = k.split(',').map(Number);
    landPts.push([lx, lz]);
  }
  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const wx = ix - half;
      const wz = iz - half;
      let minD = 9999;
      for (let j = 0; j < landPts.length; j++) {
        const dx = wx - landPts[j][0];
        const dz = wz - landPts[j][1];
        const d2 = dx * dx + dz * dz;
        if (d2 < minD) minD = d2;
      }
      const val = Math.round(Math.max(0, Math.min(1, Math.sqrt(minD) / 14.0)) * 255);
      const idx = (iz * size + ix) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createAtmosphere(scene, world, entities, onLightning) {
  // -------------------------------------------------------------------------
  // 1. CUSTOM COASTLINE OCEAN SHADER
  // -------------------------------------------------------------------------
  const coastTex = createCoastDistanceTexture(world.landFootprint);
  const oceanUniforms = {
    uTime: { value: 0 },
    uWaveAmp: { value: 1.0 },
    uCoastMap: { value: coastTex },
    uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() },
    uSunColor: { value: new THREE.Color(0xfff3d4) },
    uDeepColor: { value: new THREE.Color(0x0b4b8a) },
    uShallowColor: { value: new THREE.Color(0x28c7d4) },
    uSkyColor: { value: new THREE.Color(0x7ac3f7) },
    uFogColor: { value: new THREE.Color(0x9bd2f5) },
    uNightFactor: { value: 0.0 },
  };

  const oceanGeo = new THREE.PlaneGeometry(460, 460, 160, 160);
  oceanGeo.rotateX(-Math.PI / 2);

  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    transparent: true,
    vertexShader: `
      uniform float uTime;
      uniform float uWaveAmp;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      float waveHeight(vec2 p, float t) {
        float w1 = sin(p.x * 0.24 + t * 1.15) * cos(p.y * 0.18 + t * 0.9) * 0.16 * uWaveAmp;
        float w2 = sin(p.x * 0.52 - p.y * 0.41 + t * 1.65) * 0.06 * uWaveAmp;
        return w1 + w2;
      }

      void main() {
        vec3 pos = position;
        float h = waveHeight(pos.xz, uTime);
        pos.y += h;
        float eps = 0.28;
        float hx = waveHeight(pos.xz + vec2(eps, 0.0), uTime);
        float hz = waveHeight(pos.xz + vec2(0.0, eps), uTime);
        vNormal = normalize(vec3(h - hx, eps, h - hz));
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uCoastMap;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uSkyColor;
      uniform vec3 uFogColor;
      uniform float uNightFactor;

      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void main() {
        vec2 coastUV = (vWorldPos.xz + 64.0) / 128.0;
        float coastDist = 1.0;
        if (coastUV.x >= 0.0 && coastUV.x <= 1.0 && coastUV.y >= 0.0 && coastUV.y <= 1.0) {
          coastDist = texture2D(uCoastMap, coastUV).r;
        }

        float shallowMask = 1.0 - smoothstep(0.04, 0.48, coastDist);
        vec3 waterCol = mix(uDeepColor, uShallowColor, shallowMask);

        vec2 cell = abs(fract(vWorldPos.xz * 0.5) - 0.5);
        float subtleFacet = smoothstep(0.46, 0.5, max(cell.x, cell.y)) * 0.028 * (1.0 - smoothstep(20.0, 55.0, length(vWorldPos.xz)));
        waterCol += vec3(subtleFacet);

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormal);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.6);
        waterCol = mix(waterCol, uSkyColor, fresnel * 0.52);

        vec3 H = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(N, H), 0.0), 76.0);
        float specBroad = pow(max(dot(N, H), 0.0), 14.0);
        waterCol += uSunColor * (spec * 1.15 + specBroad * 0.16);

        float waveOsc = sin(coastDist * 48.0 - uTime * 2.5) * 0.5 + 0.5;
        float innerFoam = 1.0 - smoothstep(0.04, 0.115, coastDist);
        float rippleFoam = smoothstep(0.76, 0.94, waveOsc) * (1.0 - smoothstep(0.08, 0.22, coastDist));
        float foam = clamp(innerFoam * 0.85 + rippleFoam * 0.55, 0.0, 1.0);
        vec3 foamCol = mix(vec3(0.95, 0.98, 1.0), vec3(0.55, 0.68, 0.86), uNightFactor * 0.72);
        waterCol = mix(waterCol, foamCol, foam * 0.78);

        float camDist = length(cameraPosition - vWorldPos);
        float fogAmt = 1.0 - exp(-pow(camDist * 0.0052, 2.0));
        waterCol = mix(waterCol, uFogColor, clamp(fogAmt, 0.0, 1.0));

        float alpha = mix(0.94, 0.72, shallowMask * (1.0 - foam));
        gl_FragColor = vec4(waterCol, alpha);
      }
    `,
  });

  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.y = WATER_LEVEL;
  scene.add(oceanMesh);

  // -------------------------------------------------------------------------
  // 2. SKY DOME, VOXEL SUN & MOON, STARS
  // -------------------------------------------------------------------------
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x2a76d4) },
    uHorizonColor: { value: new THREE.Color(0x9bd6fa) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() },
    uSunGlowColor: { value: new THREE.Color(0xffe0a3) },
    uSunGlowStrength: { value: 0.6 },
  };

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(210, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunGlowColor;
        uniform float uSunGlowStrength;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.58));
          float sunDot = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          col += uSunGlowColor * pow(sunDot, 10.0) * 0.36 * uSunGlowStrength;
          col += uSunGlowColor * pow(sunDot, 64.0) * 0.62 * uSunGlowStrength;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  scene.add(skyDome);

  const voxelSun = new THREE.Mesh(new THREE.BoxGeometry(5.5, 5.5, 5.5), new THREE.MeshBasicMaterial({ color: 0xffe484 }));
  scene.add(voxelSun);
  const voxelMoon = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.2, 4.2), new THREE.MeshBasicMaterial({ color: 0xdbe9ff }));
  scene.add(voxelMoon);

  const starCount = 720;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.05 + Math.random() * 0.95);
    const r = 165 + Math.random() * 25;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.0, depthWrite: false });
  scene.add(new THREE.Points(starGeo, starMat));

  // -------------------------------------------------------------------------
  // 3. 3D FLOWING AURORA BOREALIS CURTAINS (Nighttime Magic!)
  // -------------------------------------------------------------------------
  const auroraUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.0 },
  };
  const auroraMat = new THREE.ShaderMaterial({
    uniforms: auroraUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(uv.x * 9.0 + uTime * 0.65) * 6.5 + cos(uv.x * 16.0 - uTime * 0.45) * 2.8;
        p.y += sin(uv.x * 6.0 - uTime * 0.5) * 2.4;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float bands = sin(vUv.x * 26.0 + uTime * 1.1) * 0.5 + 0.5;
        float shimmer = sin(vUv.x * 52.0 - uTime * 2.2) * 0.5 + 0.5;
        float vertFade = sin(vUv.y * 3.14159);
        float horizFade = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));

        vec3 greenC = vec3(0.15, 0.96, 0.68);
        vec3 cyanC = vec3(0.20, 0.72, 1.0);
        vec3 purpleC = vec3(0.68, 0.28, 0.98);
        vec3 col = mix(greenC, cyanC, smoothstep(0.25, 0.7, vUv.y));
        col = mix(col, purpleC, smoothstep(0.6, 1.0, vUv.y));

        float alpha = vertFade * horizFade * (0.45 + 0.4 * bands + 0.25 * shimmer) * uOpacity * 0.58;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const auroraGroup = new THREE.Group();
  const ribbon1 = new THREE.Mesh(new THREE.PlaneGeometry(170, 26, 64, 8), auroraMat);
  ribbon1.position.set(0, 62, -92);
  const ribbon2 = new THREE.Mesh(new THREE.PlaneGeometry(140, 22, 56, 8), auroraMat);
  ribbon2.position.set(-22, 68, -72);
  ribbon2.rotation.y = 0.42;
  auroraGroup.add(ribbon1, ribbon2);
  scene.add(auroraGroup);

  // -------------------------------------------------------------------------
  // 4. SHOOTING STARS (Meteors streaking across night sky)
  // -------------------------------------------------------------------------
  const meteorGeo = new THREE.BoxGeometry(0.32, 0.32, 5.2);
  const meteorMat = new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.9 });
  const meteor = new THREE.Mesh(meteorGeo, meteorMat);
  meteor.visible = false;
  scene.add(meteor);

  const meteorState = {
    active: false,
    timer: 3.5,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0,
  };

  // -------------------------------------------------------------------------
  // 5. DYNAMIC WEATHER PARTICLES (Voxel Rain & Fluffy Voxel Snow)
  // -------------------------------------------------------------------------
  const dummy = new THREE.Object3D();
  const weatherCount = 320;

  const rainMat = new THREE.MeshBasicMaterial({ color: 0xaad8ff, transparent: true, opacity: 0.62 });
  const rainMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1.05, 0.08), rainMat, weatherCount);
  rainMesh.visible = false;
  rainMesh.frustumCulled = false;
  scene.add(rainMesh);

  const snowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const snowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), snowMat, weatherCount);
  snowMesh.visible = false;
  snowMesh.frustumCulled = false;
  scene.add(snowMesh);

  const weatherDrops = [];
  for (let i = 0; i < weatherCount; i++) {
    weatherDrops.push({
      x: (Math.random() - 0.5) * 66,
      y: Math.random() * 36,
      z: (Math.random() - 0.5) * 66,
      speed: 0.8 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // -------------------------------------------------------------------------
  // 6. SCENE LIGHTING (Sun/Moon + Village/Pier/Campfire/Lighthouse + Lightning)
  // -------------------------------------------------------------------------
  const hemiLight = new THREE.HemisphereLight(0x9bd6ff, 0x456045, 0.72);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff6e5, 2.1);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -56;
  sunLight.shadow.camera.right = 56;
  sunLight.shadow.camera.top = 56;
  sunLight.shadow.camera.bottom = -56;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.bias = -0.0007;
  sunLight.shadow.normalBias = 0.045;
  scene.add(sunLight);

  const villageLight = new THREE.PointLight(0xffb554, 0, 22, 1.5);
  villageLight.position.set(2.5, 5.2, 4.0);
  scene.add(villageLight);

  const pierLight = new THREE.PointLight(0xffc96b, 0, 14, 1.6);
  pierLight.position.set(2.5, 4.0, 13.8);
  scene.add(pierLight);

  const campfireLight = new THREE.PointLight(0xff7728, 0, 13, 1.6);
  campfireLight.position.set(world.firePos.x, world.firePos.y + 1.2, world.firePos.z);
  scene.add(campfireLight);

  const lighthouseGlow = new THREE.PointLight(0xffe89e, 0, 18, 1.4);
  lighthouseGlow.position.set(world.lhPos.x, 12.6, world.lhPos.z);
  scene.add(lighthouseGlow);

  const cA = new THREE.Color();
  const cB = new THREE.Color();
  const stormTint = new THREE.Color(0x28364a);
  const snowTint = new THREE.Color(0xc9dceb);

  function lerpHex(hexA, hexB, f, target) {
    cA.setHex(hexA);
    cB.setHex(hexB);
    target.copy(cA).lerp(cB, f);
  }

  let lightningTimer = 5.0;
  let lightningFlash = 0;

  function update(dt, elapsed, { timeOfDay, weather, auroraEnabled, volcanoMode }) {
    const hour = ((timeOfDay % 24) + 24) % 24;
    let k0 = KEYFRAMES[0];
    let k1 = KEYFRAMES[1];
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (hour >= KEYFRAMES[i].t && hour <= KEYFRAMES[i + 1].t) {
        k0 = KEYFRAMES[i];
        k1 = KEYFRAMES[i + 1];
        break;
      }
    }
    const f = smoothstep(0, 1, (hour - k0.t) / Math.max(0.0001, k1.t - k0.t));

    lerpHex(k0.top, k1.top, f, skyUniforms.uTopColor.value);
    lerpHex(k0.hor, k1.hor, f, skyUniforms.uHorizonColor.value);
    lerpHex(k0.fog, k1.fog, f, scene.fog.color);
    lerpHex(k0.deep, k1.deep, f, oceanUniforms.uDeepColor.value);
    lerpHex(k0.shallow, k1.shallow, f, oceanUniforms.uShallowColor.value);
    lerpHex(k0.cloud, k1.cloud, f, entities.cloudMat.color);
    lerpHex(k0.sunC, k1.sunC, f, sunLight.color);
    lerpHex(k0.hemiS, k1.hemiS, f, hemiLight.color);
    lerpHex(k0.hemiG, k1.hemiG, f, hemiLight.groundColor);

    let sunInt = THREE.MathUtils.lerp(k0.sunI, k1.sunI, f);
    let hemiInt = THREE.MathUtils.lerp(k0.hemiI, k1.hemiI, f);
    let glowStr = THREE.MathUtils.lerp(k0.glow, k1.glow, f);

    // Weather mood tinting
    if (weather === 'rain' || weather === 'storm') {
      const amt = weather === 'storm' ? 0.68 : 0.42;
      skyUniforms.uTopColor.value.lerp(stormTint, amt);
      skyUniforms.uHorizonColor.value.lerp(stormTint, amt * 0.9);
      scene.fog.color.lerp(stormTint, amt * 0.85);
      entities.cloudMat.color.lerp(stormTint, amt * 0.8);
      sunInt *= weather === 'storm' ? 0.45 : 0.68;
      glowStr *= 0.25;
    } else if (weather === 'snow') {
      skyUniforms.uHorizonColor.value.lerp(snowTint, 0.35);
      scene.fog.color.lerp(snowTint, 0.35);
    }

    // Storm lightning bolts!
    if (weather === 'storm') {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningTimer = 4.5 + Math.random() * 6.5;
        lightningFlash = 1.0;
        if (onLightning) onLightning();
      }
    }
    if (lightningFlash > 0) {
      lightningFlash = Math.max(0, lightningFlash - dt * 4.5);
      sunInt += lightningFlash * 3.8;
      skyUniforms.uTopColor.value.lerp(new THREE.Color(0xd6e8ff), lightningFlash * 0.65);
    }

    oceanUniforms.uTime.value = elapsed;
    oceanUniforms.uWaveAmp.value = weather === 'storm' ? 1.85 : weather === 'rain' ? 1.3 : 1.0;
    oceanUniforms.uFogColor.value.copy(scene.fog.color);
    oceanUniforms.uSkyColor.value.copy(skyUniforms.uHorizonColor.value).lerp(skyUniforms.uTopColor.value, 0.35);

    sunLight.intensity = sunInt;
    hemiLight.intensity = hemiInt;
    skyUniforms.uSunGlowColor.value.copy(sunLight.color);
    skyUniforms.uSunGlowStrength.value = glowStr;

    const sunAngle = ((hour - 6.0) / 24.0) * Math.PI * 2.0;
    const sunDir = new THREE.Vector3(
      Math.cos(sunAngle) * 0.92,
      Math.sin(sunAngle),
      Math.cos(sunAngle) * 0.38 - 0.32
    ).normalize();
    const moonDir = sunDir.clone().negate();

    voxelSun.position.copy(sunDir).multiplyScalar(142);
    voxelSun.lookAt(0, 0, 0);
    voxelSun.visible = sunDir.y > -0.14 && weather !== 'storm';

    voxelMoon.position.copy(moonDir).multiplyScalar(138);
    voxelMoon.lookAt(0, 0, 0);
    voxelMoon.visible = moonDir.y > -0.14 && weather !== 'storm';

    const nightFactor = 1.0 - smoothstep(-0.08, 0.16, sunDir.y);
    oceanUniforms.uNightFactor.value = nightFactor;

    const activeDir = sunDir.y >= -0.02 ? sunDir : moonDir;
    sunLight.position.copy(activeDir).multiplyScalar(55);
    skyUniforms.uSunDir.value.copy(sunDir);
    oceanUniforms.uSunDir.value.copy(activeDir);
    oceanUniforms.uSunColor.value.copy(sunLight.color);

    // Stars & Aurora Borealis at night
    const clearSkyFactor = weather === 'storm' ? 0.15 : weather === 'rain' ? 0.35 : 1.0;
    starMat.opacity = smoothstep(0.3, 0.86, nightFactor) * clearSkyFactor * (0.85 + 0.15 * Math.sin(elapsed * 2.1));

    auroraUniforms.uTime.value = elapsed;
    const auroraVis = auroraEnabled ? smoothstep(0.38, 0.85, nightFactor) * clearSkyFactor : 0.0;
    auroraUniforms.uOpacity.value = auroraVis;
    auroraGroup.visible = auroraVis > 0.01;

    // Shooting star meteors at night
    if (auroraEnabled && nightFactor > 0.55 && weather !== 'storm') {
      if (!meteorState.active) {
        meteorState.timer -= dt;
        if (meteorState.timer <= 0) {
          meteorState.active = true;
          meteorState.life = 0;
          meteorState.timer = 4.5 + Math.random() * 6.0;
          const sx = (Math.random() - 0.5) * 140;
          const sy = 55 + Math.random() * 35;
          const sz = -70 - Math.random() * 55;
          meteorState.pos.set(sx, sy, sz);
          meteorState.vel.set(35 + Math.random() * 25, -20 - Math.random() * 14, 15);
          meteor.position.copy(meteorState.pos);
          meteor.lookAt(meteorState.pos.clone().add(meteorState.vel));
          meteor.visible = true;
        }
      } else {
        meteorState.life += dt;
        meteorState.pos.addScaledVector(meteorState.vel, dt);
        meteor.position.copy(meteorState.pos);
        meteorMat.opacity = Math.max(0, 1.0 - meteorState.life / 1.15);
        if (meteorState.life >= 1.15) {
          meteorState.active = false;
          meteor.visible = false;
        }
      }
    } else {
      meteor.visible = false;
      meteorState.active = false;
    }

    // Nighttime lights & Volcano crater glow
    const lampOn = Math.max(smoothstep(0.22, 0.72, nightFactor), weather === 'storm' ? 0.75 : 0);
    world.windowMat.emissiveIntensity = lampOn * 1.6;
    world.lanternMat.emissiveIntensity = 0.18 + lampOn * 2.15;
    villageLight.intensity = lampOn * 10.5;
    pierLight.intensity = lampOn * 6.5;
    entities.boatLantern.intensity = lampOn * 5.2;
    lighthouseGlow.intensity = lampOn * 11.5;
    entities.beamMat.uniforms.uOpacity.value = lampOn;

    const flicker = 0.85 + Math.sin(elapsed * 11.3) * 0.12 + Math.cos(elapsed * 19.7) * 0.08;
    campfireLight.intensity = (1.5 + lampOn * 10.0) * flicker;

    if (volcanoMode) {
      const pulse = 0.8 + Math.sin(elapsed * 6.2) * 0.2;
      world.volcanoLight.intensity = (10 + lampOn * 18) * pulse;
      world.lavaPoolMat.color.setHex(pulse > 0.85 ? 0xff8c24 : 0xff4d14);
    } else {
      world.volcanoLight.intensity = 0;
    }

    // Weather particles update
    const isRain = weather === 'rain' || weather === 'storm';
    const isSnow = weather === 'snow';
    rainMesh.visible = isRain;
    snowMesh.visible = isSnow;

    if (isRain) {
      const spd = weather === 'storm' ? 38 : 26;
      const slant = weather === 'storm' ? 0.24 : 0.1;
      for (let i = 0; i < weatherCount; i++) {
        const d = weatherDrops[i];
        d.y -= spd * d.speed * dt;
        d.x += slant * spd * dt;
        if (d.y < 1.2) {
          d.y = 32 + Math.random() * 8;
          d.x = (Math.random() - 0.5) * 66;
          d.z = (Math.random() - 0.5) * 66;
        }
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(0, 0, slant);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        rainMesh.setMatrixAt(i, dummy.matrix);
      }
      rainMesh.instanceMatrix.needsUpdate = true;
    } else if (isSnow) {
      for (let i = 0; i < weatherCount; i++) {
        const d = weatherDrops[i];
        d.y -= 3.6 * d.speed * dt;
        d.x += Math.sin(elapsed * 1.4 + d.phase) * 1.4 * dt;
        d.z += Math.cos(elapsed * 1.1 + d.phase) * 1.0 * dt;
        if (d.y < 1.2) {
          d.y = 30 + Math.random() * 8;
          d.x = (Math.random() - 0.5) * 66;
          d.z = (Math.random() - 0.5) * 66;
        }
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(elapsed + d.phase, elapsed * 0.7, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        snowMesh.setMatrixAt(i, dummy.matrix);
      }
      snowMesh.instanceMatrix.needsUpdate = true;
    }

    return nightFactor;
  }

  return {
    oceanMesh,
    update,
  };
}
