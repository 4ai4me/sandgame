import * as THREE from 'three';
import { FLAGS, SEDIMENTS } from '../game/content';
import type { FlagDesignId, SedimentId } from '../game/types';

export interface SedimentTextures {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

function hash2d(x: number, y: number, seed: number): number {
  let n = Math.imul(x + seed * 31, 374761393) ^ Math.imul(y + 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((yi % period) + period) % period;
  const y1 = (y0 + 1) % period;
  const a = hash2d(x0, y0, seed);
  const b = hash2d(x1, y0, seed);
  const c = hash2d(x0, y1, seed);
  const d = hash2d(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function createSedimentTextures(
  sedimentId: SedimentId,
  maxAnisotropy: number,
): SedimentTextures {
  const spec = SEDIMENTS.find((s) => s.id === sedimentId) || SEDIMENTS[0];
  const size = 256;
  const seed = [...spec.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 11);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;
  const aImg = actx.createImageData(size, size);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;
  const bImg = bctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fine = hash2d(x, y, seed) - 0.5;
      const med = smoothNoise(x / 8, y / 8, 32, seed + 5) - 0.5;
      const macro = smoothNoise(x / 24, y / 24, 16, seed + 13) - 0.5;

      let lumDelta = fine * 20 + med * 16 + macro * 14;
      let bump = 128 + fine * 55 + med * 45;

      if (sedimentId === 'fine-sand') {
        const ripple = Math.sin((y / size) * Math.PI * 16 + med * 2.2) * 7;
        const sparkle = fine > 0.46 ? 26 : 0;
        lumDelta = fine * 12 + ripple + macro * 10 + sparkle;
        bump = 128 + ripple * 3 + fine * 26;
      } else if (sedimentId === 'gravel') {
        const cellX = (x % 24) - 12;
        const cellY = (y % 24) - 12;
        const jitterX = (hash2d(Math.floor(x / 24), Math.floor(y / 24), seed + 2) - 0.5) * 6;
        const jitterY = (hash2d(Math.floor(x / 24), Math.floor(y / 24), seed + 9) - 0.5) * 6;
        const r = Math.hypot(cellX + jitterX, cellY + jitterY);
        const stoneTint = (hash2d(Math.floor(x / 24), Math.floor(y / 24), seed + 19) - 0.5) * 44;
        lumDelta = r > 9.5 ? -36 : stoneTint + (9.5 - r) * 1.9 + fine * 14;
        bump = r > 9.5 ? 45 : 155 + (9.5 - r) * 8 + fine * 25;
      } else if (sedimentId.includes('clay')) {
        const swirl = Math.sin(x * 0.06 + Math.sin(y * 0.08) * 2) * 10;
        lumDelta = swirl + macro * 18 + fine * 8;
        bump = 128 + swirl * 4 + med * 22;
      } else if (sedimentId === 'loam') {
        const clod = smoothNoise(x / 12, y / 12, 24, seed + 7) - 0.5;
        const speck = fine < -0.45 ? -28 : 0;
        lumDelta = clod * 34 + fine * 18 + speck;
        bump = 128 + clod * 90 + fine * 45;
      } else if (sedimentId === 'wet-sand') {
        const ripple = Math.sin((x * 0.05 + y * 0.07) + med * 2) * 6;
        lumDelta = fine * 14 + med * 12 + ripple;
        bump = 128 + fine * 35 + ripple * 4;
      }

      const i = (x + y * size) * 4;
      aImg.data[i] = Math.max(0, Math.min(255, Math.round(spec.color[0] + lumDelta)));
      aImg.data[i + 1] = Math.max(0, Math.min(255, Math.round(spec.color[1] + lumDelta * 0.96)));
      aImg.data[i + 2] = Math.max(0, Math.min(255, Math.round(spec.color[2] + lumDelta * 0.9)));
      aImg.data[i + 3] = 255;

      const bVal = Math.max(0, Math.min(255, Math.round(bump)));
      bImg.data[i] = bVal;
      bImg.data[i + 1] = bVal;
      bImg.data[i + 2] = bVal;
      bImg.data[i + 3] = 255;
    }
  }

  actx.putImageData(aImg, 0, 0);
  bctx.putImageData(bImg, 0, 0);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function drawLine(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  b: number,
  color: string,
  width = 6,
) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(a, b);
  c.stroke();
}

function drawCircle(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function drawSkull(c: CanvasRenderingContext2D, x: number, y: number, size = 1) {
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  c.fillStyle = '#f8f0dc';
  c.beginPath();
  c.ellipse(0, -6, 30, 28, 0, 0, Math.PI * 2);
  c.fill();
  c.fillRect(-20, 14, 40, 24);
  drawCircle(c, -12, -8, 9.4, '#1b1d26');
  drawCircle(c, 12, -8, 9.4, '#1b1d26');
  c.fillStyle = '#1b1d26';
  c.fillRect(-4, 6, 8, 8);
  for (const a of [-12, 0, 12]) {
    drawLine(c, a, 22, a, 36, '#2d2b2c', 3);
  }
  c.restore();
}

function drawBones(c: CanvasRenderingContext2D) {
  for (const side of [-1, 1]) {
    drawLine(c, 128 - 62, 96 - 50 * side, 128 + 62, 96 + 50 * side, '#f0e7d4', 12);
    for (const p of [
      [66, 96 - 50 * side],
      [190, 96 + 50 * side],
    ]) {
      drawCircle(c, p[0] - 4, p[1], 8, '#f0e7d4');
      drawCircle(c, p[0] + 4, p[1], 8, '#f0e7d4');
    }
  }
}

export function renderFlagCanvas(id: FlagDesignId): HTMLCanvasElement {
  const spec = FLAGS.find((f) => f.id === id) || FLAGS[0];
  const el = document.createElement('canvas');
  el.width = 256;
  el.height = 192;
  const c = el.getContext('2d')!;

  // Woven cloth base + subtle fabric grain
  c.fillStyle = spec.background;
  c.fillRect(0, 0, 256, 192);
  c.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < 192; y += 4) {
    c.fillRect(0, y, 256, 1);
  }
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  c.lineWidth = 4;
  c.strokeRect(4, 4, 248, 184);

  if (id === 'heart') {
    c.strokeStyle = '#1b1d26';
    c.lineWidth = 12;
    c.beginPath();
    c.arc(128, 96, 56, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      drawLine(c, 128 + Math.cos(a) * 58, 96 + Math.sin(a) * 58, 128 + Math.cos(a) * 80, 96 + Math.sin(a) * 80, '#1b1d26', 12);
    }
    drawCircle(c, 108, 78, 8, '#1b1d26');
    drawCircle(c, 148, 78, 8, '#1b1d26');
    c.beginPath();
    c.arc(128, 88, 38, 0.1, Math.PI - 0.1);
    c.stroke();
    drawLine(c, 92, 94, 164, 94, '#1b1d26', 6);
    for (const x of [108, 128, 148]) drawLine(c, x, 96, x, 118, '#1b1d26', 4);
  } else if (id === 'sun') {
    c.strokeStyle = spec.accent;
    c.lineWidth = 18;
    c.beginPath();
    c.arc(128, 96, 40, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      drawLine(
        c,
        128 + Math.cos(a) * 58,
        96 + Math.sin(a) * 58,
        128 + Math.cos(a + 0.14) * 76,
        96 + Math.sin(a + 0.14) * 76,
        spec.accent,
        10,
      );
    }
  } else {
    drawBones(c);
    if (id === 'blackbeard') {
      drawSkull(c, 84, 102, 0.8);
      drawSkull(c, 172, 102, 0.8);
      drawSkull(c, 128, 70, 0.95);
    } else {
      drawSkull(c, 128, 92, 1.22);
    }

    if (id === 'strawhat') {
      c.fillStyle = '#ebbf55';
      c.beginPath();
      c.ellipse(128, 52, 44, 28, 0, Math.PI, Math.PI * 2);
      c.fill();
      c.fillRect(84, 44, 88, 14);
      c.fillStyle = '#c44636';
      c.fillRect(84, 52, 88, 10);
      c.fillStyle = '#ebbf55';
      c.fillRect(60, 62, 136, 10);
    } else if (id === 'redhair') {
      for (const x of [136, 150, 164]) {
        drawLine(c, x, 52, x - 18, 116, '#c74748', 8);
      }
    } else if (id === 'whitebeard') {
      c.strokeStyle = '#f5ecd5';
      c.lineWidth = 16;
      c.beginPath();
      c.moveTo(54, 92);
      c.bezierCurveTo(74, 152, 182, 152, 202, 92);
      c.stroke();
    } else if (id === 'roger') {
      c.fillStyle = '#a74440';
      c.beginPath();
      c.moveTo(70, 54);
      c.lineTo(86, 26);
      c.lineTo(170, 26);
      c.lineTo(190, 54);
      c.closePath();
      c.fill();
      drawLine(c, 66, 56, 192, 56, '#e4bd66', 8);
      drawSkull(c, 128, 36, 0.32);
      c.strokeStyle = '#413125';
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(70, 108);
      c.bezierCurveTo(98, 124, 110, 94, 128, 110);
      c.bezierCurveTo(146, 94, 160, 124, 186, 108);
      c.stroke();
    } else if (id === 'buggy') {
      drawCircle(c, 68, 72, 18, '#5492c7');
      drawCircle(c, 188, 72, 18, '#5492c7');
      drawCircle(c, 128, 98, 14, '#db4940');
      c.fillStyle = '#d54e45';
      c.fillRect(80, 38, 96, 14);
      for (let x = 84; x < 178; x += 20) {
        c.fillRect(x, 18, 10, 20);
      }
    }
  }
  return el;
}

export function createFlagTexture(id: FlagDesignId, maxAnisotropy: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(renderFlagCanvas(id));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(15, 22, 18, 0.52)');
  grad.addColorStop(0.55, 'rgba(15, 22, 18, 0.22)');
  grad.addColorStop(1, 'rgba(15, 22, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
