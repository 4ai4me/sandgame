import * as THREE from 'three';

interface ConfettiPiece {
  active: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  scale: number;
  swayPhase: number;
}

const MAX_CONFETTI = 220;
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

function createVictoryBannerTexture(
  winner: 0 | 1 | null,
  isAiWinner: boolean,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  const bgTop = winner === 0 ? '#1b5e47' : winner === 1 ? '#b84b30' : '#9c782c';
  const bgBot = winner === 0 ? '#113c2d' : winner === 1 ? '#7d2f1c' : '#634a16';
  const accent = '#f6d469';

  const grad = ctx.createLinearGradient(0, 0, 0, 192);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 192);

  // Diagonal celebratory satin sheen bands
  ctx.fillStyle = 'rgba(255, 248, 224, 0.08)';
  ctx.beginPath();
  ctx.moveTo(0, 150);
  ctx.lineTo(256, 40);
  ctx.lineTo(256, 85);
  ctx.lineTo(0, 192);
  ctx.closePath();
  ctx.fill();

  // Ornate golden double frame
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 240, 176);
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 224, 160);

  // Golden crown emblem at top center
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(92, 92);
  ctx.lineTo(84, 52);
  ctx.lineTo(108, 70);
  ctx.lineTo(128, 40);
  ctx.lineTo(148, 70);
  ctx.lineTo(172, 52);
  ctx.lineTo(164, 92);
  ctx.closePath();
  ctx.fill();

  // Crown base jewels
  ctx.fillStyle = '#fff9e6';
  for (const cx of [104, 128, 152]) {
    ctx.beginPath();
    ctx.arc(cx, 82, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Winner heraldry label
  const label =
    winner === null ? 'DRAW' : winner === 0 ? 'P1 WIN!' : isAiWinner ? 'AI WIN!' : 'P2 WIN!';
  ctx.fillStyle = '#fffaf0';
  ctx.font = '800 36px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 6;
  ctx.fillText(label, 128, 134);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Dramatic 3D victory celebration rendered inside SandViewport:
 * - Rising golden victory pedestal + fluted flagpole + rippling winner heraldry cloth
 * - Ground golden triumph shockwave ring + warm hero celebration spotlight
 * - Zero-GC pooled InstancedMesh confetti & golden spark fountain
 */
export class VictoryCelebration {
  public readonly group = new THREE.Group();

  private readonly maxAnisotropy: number;
  private readonly pedestalGroup = new THREE.Group();
  private readonly flagpoleGroup = new THREE.Group();
  private readonly clothGeo: THREE.PlaneGeometry;
  private readonly clothBasePos: Float32Array;
  private readonly clothMat: THREE.MeshStandardMaterial;
  private clothTex: THREE.CanvasTexture | null = null;
  private readonly shockwaveRing: THREE.Mesh;
  private readonly shockwaveMat: THREE.MeshBasicMaterial;
  private readonly heroLight: THREE.PointLight;
  private readonly plinthAccentMat: THREE.MeshStandardMaterial;

  private readonly confettiMesh: THREE.InstancedMesh;
  private readonly confettiMat: THREE.MeshStandardMaterial;
  private readonly confetti: ConfettiPiece[] = [];
  private confettiCursor = 0;

  private active = false;
  private winner: 0 | 1 | null = null;
  private age = 0;
  private nextBurstAt = 0;
  private anchorX = 0;
  private anchorZ = 12.2;
  private pileFactor = 1;

  constructor(maxAnisotropy: number) {
    this.maxAnisotropy = maxAnisotropy;
    this.group.visible = false;

    const goldMat = new THREE.MeshStandardMaterial({
      color: '#ecc256',
      roughness: 0.28,
      metalness: 0.72,
    });
    const darkGoldMat = new THREE.MeshStandardMaterial({
      color: '#b4872c',
      roughness: 0.36,
      metalness: 0.65,
    });
    this.plinthAccentMat = new THREE.MeshStandardMaterial({
      color: '#236951',
      roughness: 0.42,
      metalness: 0.18,
    });

    // 1. Octagonal Victory Pedestal anchored at winner's camp
    const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, 0.7, 8), darkGoldMat);
    basePlinth.position.y = 0.35;
    basePlinth.castShadow = true;
    basePlinth.receiveShadow = true;
    this.pedestalGroup.add(basePlinth);

    const teamRing = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.45, 0.36, 8), this.plinthAccentMat);
    teamRing.position.y = 0.85;
    teamRing.castShadow = true;
    this.pedestalGroup.add(teamRing);

    const crownCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.92, 0.65, 12), goldMat);
    crownCollar.position.y = 1.25;
    crownCollar.castShadow = true;
    this.pedestalGroup.add(crownCollar);

    this.group.add(this.pedestalGroup);

    // 2. Rising Grand Victory Flagpole + Cloth Banner
    const poleHeight = 14.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, poleHeight, 12), goldMat);
    pole.position.y = poleHeight * 0.5;
    pole.castShadow = true;
    this.flagpoleGroup.add(pole);

    // Ornate rings + golden star finial at the apex
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 16), goldMat);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = poleHeight - 0.15;
    this.flagpoleGroup.add(topRing);

    const finialOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), goldMat);
    finialOrb.position.y = poleHeight + 0.65;
    finialOrb.castShadow = true;
    this.flagpoleGroup.add(finialOrb);

    // Crossbar yardarm so banner reads heroically from any angle
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 6.4, 8), darkGoldMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(3.2, poleHeight - 0.55, 0);
    this.flagpoleGroup.add(bar);

    // Rippling 3D banner cloth (14x6 grid)
    this.clothGeo = new THREE.PlaneGeometry(6.2, 4.4, 14, 6);
    this.clothGeo.translate(3.15, -2.2, 0);
    this.clothBasePos = new Float32Array(this.clothGeo.attributes.position.array);
    this.clothMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });
    const clothMesh = new THREE.Mesh(this.clothGeo, this.clothMat);
    clothMesh.position.set(0.18, poleHeight - 0.58, 0);
    clothMesh.castShadow = true;
    this.flagpoleGroup.add(clothMesh);

    this.pedestalGroup.add(this.flagpoleGroup);

    // 3. Expanding Ground Golden Triumph Shockwave Ring
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: '#ffe388',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.shockwaveRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.3, 36), this.shockwaveMat);
    this.shockwaveRing.rotation.x = -Math.PI / 2;
    this.shockwaveRing.position.y = 0.12;
    this.group.add(this.shockwaveRing);

    // 4. Warm Hero Celebration Spotlight / PointLight
    this.heroLight = new THREE.PointLight('#ffd87a', 0, 38, 1.5);
    this.heroLight.position.set(0, 12, 0);
    this.pedestalGroup.add(this.heroLight);

    // 5. Pooled InstancedMesh 3D Confetti & Golden Spark Fountain
    const confettiGeo = new THREE.BoxGeometry(0.46, 0.26, 0.05);
    this.confettiMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.28,
    });
    this.confettiMesh = new THREE.InstancedMesh(confettiGeo, this.confettiMat, MAX_CONFETTI);
    this.confettiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confettiMesh.frustumCulled = false;

    for (let i = 0; i < MAX_CONFETTI; i++) {
      this.confetti.push({
        active: false,
        age: 0,
        life: 2.5,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        vrx: 0,
        vry: 0,
        vrz: 0,
        scale: 1,
        swayPhase: 0,
      });
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.confettiMesh.setMatrixAt(i, _dummy.matrix);
      this.confettiMesh.setColorAt(i, _color.set('#f5cf64'));
    }
    this.confettiMesh.instanceMatrix.needsUpdate = true;
    if (this.confettiMesh.instanceColor) this.confettiMesh.instanceColor.needsUpdate = true;
    this.group.add(this.confettiMesh);
  }

  public getAnchorPosition(): { x: number; z: number } {
    return { x: this.anchorX, z: this.anchorZ };
  }

  public isActive(): boolean {
    return this.active;
  }

  public trigger(winner: 0 | 1 | null, isAiWinner: boolean, pileFactor: number): void {
    this.active = true;
    this.winner = winner;
    this.age = 0;
    this.nextBurstAt = 0.65;
    this.pileFactor = Math.max(0.85, Math.min(1.55, pileFactor));

    // Place right beside the winning player's harvest bin (or front-center on draw)
    const f = Math.max(0.8, pileFactor);
    if (winner === 0) {
      this.anchorX = -13.2 * f;
      this.anchorZ = 12.2 * f;
      this.plinthAccentMat.color.set('#226d54');
      this.heroLight.color.set('#a8ffd9');
    } else if (winner === 1) {
      this.anchorX = 13.2 * f;
      this.anchorZ = 12.2 * f;
      this.plinthAccentMat.color.set('#c45435');
      this.heroLight.color.set('#ffbfa0');
    } else {
      this.anchorX = 0;
      this.anchorZ = 13.6 * f;
      this.plinthAccentMat.color.set('#c5942f');
      this.heroLight.color.set('#ffe28a');
    }

    this.pedestalGroup.position.set(this.anchorX, 0, this.anchorZ);
    this.pedestalGroup.scale.setScalar(this.pileFactor);
    // Angle flag toward center-front viewer
    this.pedestalGroup.rotation.y = winner === 0 ? -0.35 : winner === 1 ? -Math.PI + 0.35 : -0.2;

    this.shockwaveRing.position.set(this.anchorX, 0.14, this.anchorZ);
    this.shockwaveRing.scale.setScalar(0.2);

    if (this.clothTex) this.clothTex.dispose();
    this.clothTex = createVictoryBannerTexture(winner, isAiWinner, this.maxAnisotropy);
    this.clothMat.map = this.clothTex;
    this.clothMat.needsUpdate = true;

    this.flagpoleGroup.position.y = -15;
    this.group.visible = true;

    // Launch massive opening confetti fountain burst!
    this.spawnConfettiVolley(130, 1.0);
  }

  public clear(): void {
    this.active = false;
    this.age = 0;
    this.group.visible = false;
    this.heroLight.intensity = 0;
    this.shockwaveMat.opacity = 0;
    for (let i = 0; i < MAX_CONFETTI; i++) {
      this.confetti[i].active = false;
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.confettiMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.confettiMesh.instanceMatrix.needsUpdate = true;
  }

  private spawnConfettiVolley(count: number, power: number): void {
    const palette =
      this.winner === 0
        ? ['#22a072', '#4fd4a0', '#f6d258', '#fff8e2', '#f28b50']
        : this.winner === 1
          ? ['#e05d3e', '#ff8c66', '#f6d258', '#fff8e2', '#4fd4a0']
          : ['#f6d258', '#ffe999', '#fff8e2', '#4fd4a0', '#e05d3e'];

    for (let i = 0; i < count; i++) {
      const idx = this.confettiCursor;
      this.confettiCursor = (this.confettiCursor + 1) % MAX_CONFETTI;
      const p = this.confetti[idx];

      const angle = Math.random() * Math.PI * 2;
      const radialSpeed = (2.2 + Math.random() * 7.8) * power;
      const upSpeed = (12.5 + Math.random() * 11.5) * power;

      p.active = true;
      p.age = 0;
      p.life = 2.4 + Math.random() * 1.9;
      p.x = this.anchorX + (Math.random() - 0.5) * 2.2;
      p.y = 1.4 + Math.random() * 2.4;
      p.z = this.anchorZ + (Math.random() - 0.5) * 2.2;
      p.vx = Math.cos(angle) * radialSpeed;
      p.vy = upSpeed;
      p.vz = Math.sin(angle) * radialSpeed;
      p.rx = Math.random() * Math.PI * 2;
      p.ry = Math.random() * Math.PI * 2;
      p.rz = Math.random() * Math.PI * 2;
      p.vrx = (Math.random() - 0.5) * 11;
      p.vry = (Math.random() - 0.5) * 11;
      p.vrz = (Math.random() - 0.5) * 9;
      p.scale = (0.85 + Math.random() * 0.85) * Math.min(1.4, this.pileFactor);
      p.swayPhase = Math.random() * Math.PI * 2;

      const hex = palette[Math.floor(Math.random() * palette.length)];
      _color.set(hex);
      this.confettiMesh.setColorAt(idx, _color);
    }
    if (this.confettiMesh.instanceColor) this.confettiMesh.instanceColor.needsUpdate = true;
  }

  public update(dt: number, elapsed: number, reducedMotion: boolean): void {
    if (!this.active) return;

    this.age += dt;

    // 1. Dramatic spring-overshoot rise of the grand victory flagpole
    if (reducedMotion) {
      this.flagpoleGroup.position.y = 1.0;
      this.pedestalGroup.scale.setScalar(this.pileFactor);
      this.heroLight.intensity = 22;
      this.shockwaveMat.opacity = 0;
    } else {
      const riseT = Math.min(1, this.age / 0.85);
      // Cubic back-out spring overshoot
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const spring = 1 + c3 * Math.pow(riseT - 1, 3) + c1 * Math.pow(riseT - 1, 2);
      this.flagpoleGroup.position.y = -14.5 + 15.5 * spring;

      // Pedestal subtle triumphant squash/pop on arrival
      const pop = 1 + Math.sin(Math.min(1, this.age / 0.5) * Math.PI) * 0.14;
      this.pedestalGroup.scale.set(
        this.pileFactor * pop,
        this.pileFactor * (1 + (pop - 1) * 0.4),
        this.pileFactor * pop,
      );

      // Pulsing golden triumph shockwave ring (repeats gently every 2.2s)
      const waveCycle = (this.age % 2.2) / 1.15;
      if (waveCycle < 1) {
        const easeOut = 1 - Math.pow(1 - waveCycle, 3);
        this.shockwaveRing.scale.setScalar((0.7 + easeOut * 4.4) * this.pileFactor);
        this.shockwaveMat.opacity = (1 - waveCycle) * 0.72;
      } else {
        this.shockwaveMat.opacity = 0;
      }

      // Warm rhythmic celebration spotlight glow
      this.heroLight.intensity = 20 + Math.sin(elapsed * 4.2) * 6;
    }

    // 2. Real-time festive cloth ripple on the victory banner
    const pos = this.clothGeo.attributes.position as THREE.BufferAttribute;
    const waveSpeed = reducedMotion ? 0 : 7.5;
    for (let i = 0; i < pos.count; i++) {
      const bx = this.clothBasePos[i * 3];
      const by = this.clothBasePos[i * 3 + 1];
      const u = Math.max(0, bx / 6.2);
      const z = reducedMotion
        ? 0
        : Math.sin(u * 5.2 - elapsed * waveSpeed) * 0.42 * u +
          Math.cos(by * 1.1 + elapsed * 4.5) * 0.12 * u;
      pos.setXYZ(i, bx, by, z);
    }
    pos.needsUpdate = true;
    this.clothGeo.computeVertexNormals();

    // 3. Continuous celebratory confetti fountains
    if (!reducedMotion && this.age >= this.nextBurstAt) {
      this.nextBurstAt = this.age + 0.72;
      this.spawnConfettiVolley(36, 0.92);
    }

    // 4. Advance confetti physics
    let changed = false;
    for (let i = 0; i < MAX_CONFETTI; i++) {
      const p = this.confetti[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.confettiMesh.setMatrixAt(i, _dummy.matrix);
        changed = true;
        continue;
      }

      // Air drag + gentle gravity + flutter sway
      const drag = Math.exp(-1.45 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = Math.max(-4.8, p.vy - 15.5 * dt);

      const flutter = Math.sin(elapsed * 5.2 + p.swayPhase) * 1.4;
      p.x += (p.vx + flutter) * dt;
      p.y += p.vy * dt;
      p.z += (p.vz + Math.cos(elapsed * 4.1 + p.swayPhase) * 1.1) * dt;

      if (p.y <= 0.12) {
        p.y = 0.12;
        p.vx *= 0.75;
        p.vz *= 0.75;
        p.vy = 0;
      } else {
        p.rx += p.vrx * dt;
        p.ry += p.vry * dt;
        p.rz += p.vrz * dt;
      }

      const fade = p.age > p.life * 0.78 ? 1 - (p.age - p.life * 0.78) / (p.life * 0.22) : 1;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.rx, p.ry, p.rz);
      _dummy.scale.setScalar(Math.max(0.001, p.scale * fade));
      _dummy.updateMatrix();
      this.confettiMesh.setMatrixAt(i, _dummy.matrix);
      changed = true;
    }
    if (changed) this.confettiMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    if (this.clothTex) {
      this.clothTex.dispose();
      this.clothTex = null;
    }
    this.clothGeo.dispose();
    this.clothMat.dispose();
    this.shockwaveRing.geometry.dispose();
    this.shockwaveMat.dispose();
    this.confettiMesh.geometry.dispose();
    this.confettiMat.dispose();
    this.pedestalGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.geometry !== this.clothGeo) m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => {
            if (mat !== this.clothMat) mat.dispose();
          });
        } else if (m.material !== this.clothMat) {
          m.material.dispose();
        }
      }
    });
  }
}
