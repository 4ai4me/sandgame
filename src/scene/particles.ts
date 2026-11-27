import * as THREE from 'three';
import type { CollapseMove, EnvironmentSnapshot } from '../game/types';

interface GrainParticle {
  active: boolean;
  kind: 'harvest' | 'collapse' | 'burst';
  age: number;
  life: number;
  sx: number;
  sy: number;
  sz: number;
  tx: number;
  ty: number;
  tz: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  spin: number;
}

const MAX_GRAINS = 260;
const WEATHER_COUNT = 160;

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class ParticleSystem {
  public readonly group = new THREE.Group();
  private readonly grainMesh: THREE.InstancedMesh;
  private readonly grainMat: THREE.MeshStandardMaterial;
  private readonly grains: GrainParticle[] = [];
  private grainCursor = 0;

  private readonly weatherMesh: THREE.InstancedMesh;
  private readonly weatherMat: THREE.MeshBasicMaterial;
  private readonly weatherOffsets: Float32Array;

  constructor() {
    const geo = new THREE.DodecahedronGeometry(0.22, 0);
    this.grainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.02,
    });
    this.grainMesh = new THREE.InstancedMesh(geo, this.grainMat, MAX_GRAINS);
    this.grainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grainMesh.frustumCulled = false;

    for (let i = 0; i < MAX_GRAINS; i++) {
      this.grains.push({
        active: false,
        kind: 'harvest',
        age: 0,
        life: 0.6,
        sx: 0,
        sy: 0,
        sz: 0,
        tx: 0,
        ty: 0,
        tz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0,
        spin: 0,
      });
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.grainMesh.setMatrixAt(i, _dummy.matrix);
      this.grainMesh.setColorAt(i, _color.set('#dfbe83'));
    }
    this.grainMesh.instanceMatrix.needsUpdate = true;
    if (this.grainMesh.instanceColor) this.grainMesh.instanceColor.needsUpdate = true;
    this.group.add(this.grainMesh);

    const wGeo = new THREE.BoxGeometry(0.08, 0.75, 0.08);
    this.weatherMat = new THREE.MeshBasicMaterial({
      color: '#dcebf7',
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.weatherMesh = new THREE.InstancedMesh(wGeo, this.weatherMat, WEATHER_COUNT);
    this.weatherMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.weatherMesh.frustumCulled = false;
    this.weatherMesh.visible = false;

    this.weatherOffsets = new Float32Array(WEATHER_COUNT * 3);
    for (let i = 0; i < WEATHER_COUNT; i++) {
      this.weatherOffsets[i * 3] = (Math.random() - 0.5) * 46;
      this.weatherOffsets[i * 3 + 1] = Math.random() * 28;
      this.weatherOffsets[i * 3 + 2] = (Math.random() - 0.5) * 46;
    }
    this.group.add(this.weatherMesh);
  }

  private allocGrain(): { index: number; item: GrainParticle } {
    const idx = this.grainCursor;
    this.grainCursor = (this.grainCursor + 1) % MAX_GRAINS;
    return { index: idx, item: this.grains[idx] };
  }

  public spawnHarvest(
    from: [number, number, number],
    player: 0 | 1,
    count: number,
    sedimentRgb: [number, number, number],
    pileFactor: number,
  ): void {
    const n = Math.min(10, Math.max(2, Math.ceil(count)));
    const binX = (player === 0 ? -13.2 : 13.2) * pileFactor;
    const binZ = 12.2 * pileFactor;
    const binY = 1.1 * pileFactor;

    for (let i = 0; i < n; i++) {
      const { index, item } = this.allocGrain();
      item.active = true;
      item.kind = 'harvest';
      item.age = -i * 0.015;
      item.life = 0.52 + Math.random() * 0.22;
      item.sx = (from[0] - 12.5 + (Math.random() - 0.5) * 0.7) * pileFactor;
      item.sy = (from[1] + 0.25) * pileFactor;
      item.sz = (from[2] - 12.5 + (Math.random() - 0.5) * 0.7) * pileFactor;
      item.tx = binX + (Math.random() - 0.5) * 1.4;
      item.ty = binY;
      item.tz = binZ + (Math.random() - 0.5) * 1.1;
      item.scale = (0.7 + Math.random() * 0.65) * Math.min(1.4, pileFactor);
      item.spin = (Math.random() - 0.5) * 9;

      const jitter = 0.88 + Math.random() * 0.24;
      _color.setRGB(
        Math.min(1, (sedimentRgb[0] / 255) * jitter),
        Math.min(1, (sedimentRgb[1] / 255) * jitter),
        Math.min(1, (sedimentRgb[2] / 255) * jitter),
        THREE.SRGBColorSpace,
      );
      this.grainMesh.setColorAt(index, _color);
    }
    if (this.grainMesh.instanceColor) this.grainMesh.instanceColor.needsUpdate = true;
  }

  public spawnCollapse(
    moves: CollapseMove[],
    sedimentRgb: [number, number, number],
    pileFactor: number,
  ): void {
    if (!moves.length) return;
    const stride = Math.max(1, Math.floor(moves.length / 64));
    for (let i = 0; i < moves.length; i += stride) {
      const mv = moves[i];
      const { index, item } = this.allocGrain();
      item.active = true;
      item.kind = 'collapse';
      item.age = 0;
      item.life = 0.34 + Math.random() * 0.22;
      item.sx = (mv.from[0] + 0.5 - 12.5) * pileFactor;
      item.sy = (mv.from[1] + 0.5) * pileFactor;
      item.sz = (mv.from[2] + 0.5 - 12.5) * pileFactor;
      item.tx = (mv.to[0] + 0.5 - 12.5) * pileFactor;
      item.ty = (mv.to[1] + 0.5) * pileFactor;
      item.tz = (mv.to[2] + 0.5 - 12.5) * pileFactor;
      item.scale = (0.95 + Math.random() * 0.45) * Math.min(1.4, pileFactor);
      item.spin = (Math.random() - 0.5) * 8;

      const jitter = 0.86 + Math.random() * 0.22;
      _color.setRGB(
        Math.min(1, (sedimentRgb[0] / 255) * jitter),
        Math.min(1, (sedimentRgb[1] / 255) * jitter),
        Math.min(1, (sedimentRgb[2] / 255) * jitter),
        THREE.SRGBColorSpace,
      );
      this.grainMesh.setColorAt(index, _color);
    }
    if (this.grainMesh.instanceColor) this.grainMesh.instanceColor.needsUpdate = true;
  }

  public spawnImpactBurst(
    origin: [number, number, number],
    sedimentRgb: [number, number, number],
    pileFactor: number,
  ): void {
    for (let i = 0; i < 24; i++) {
      const { index, item } = this.allocGrain();
      const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 3.5 + Math.random() * 5.5;
      item.active = true;
      item.kind = 'burst';
      item.age = 0;
      item.life = 0.55 + Math.random() * 0.35;
      item.sx = (origin[0] - 12.5) * pileFactor;
      item.sy = Math.max(0.4, origin[1] * pileFactor);
      item.sz = (origin[2] - 12.5) * pileFactor;
      item.vx = Math.cos(angle) * spd;
      item.vy = 4 + Math.random() * 5;
      item.vz = Math.sin(angle) * spd;
      item.scale = (0.8 + Math.random() * 0.7) * Math.min(1.4, pileFactor);
      item.spin = (Math.random() - 0.5) * 12;

      const jitter = 0.85 + Math.random() * 0.28;
      _color.setRGB(
        Math.min(1, (sedimentRgb[0] / 255) * jitter),
        Math.min(1, (sedimentRgb[1] / 255) * jitter),
        Math.min(1, (sedimentRgb[2] / 255) * jitter),
        THREE.SRGBColorSpace,
      );
      this.grainMesh.setColorAt(index, _color);
    }
    if (this.grainMesh.instanceColor) this.grainMesh.instanceColor.needsUpdate = true;
  }

  public clearGrains(): void {
    for (let i = 0; i < MAX_GRAINS; i++) {
      this.grains[i].active = false;
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.grainMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.grainMesh.instanceMatrix.needsUpdate = true;
  }

  public update(dt: number, elapsed: number, env: EnvironmentSnapshot, reducedMotion: boolean): void {
    let anyChanged = false;
    for (let i = 0; i < MAX_GRAINS; i++) {
      const p = this.grains[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age < 0) continue;
      const t = p.age / p.life;
      if (t >= 1) {
        p.active = false;
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.grainMesh.setMatrixAt(i, _dummy.matrix);
        anyChanged = true;
        continue;
      }

      if (p.kind === 'harvest') {
        const arc = Math.sin(t * Math.PI) * 5.6;
        const ease = t * (2 - t);
        _dummy.position.set(
          p.sx + (p.tx - p.sx) * ease,
          p.sy + (p.ty - p.sy) * ease + arc,
          p.sz + (p.tz - p.sz) * ease,
        );
        _dummy.rotation.set(p.age * p.spin, p.age * p.spin * 0.7, 0);
        _dummy.scale.setScalar(p.scale * (1 - t * 0.45));
      } else if (p.kind === 'collapse') {
        const drop = t * t;
        _dummy.position.set(
          p.sx + (p.tx - p.sx) * t,
          p.sy + (p.ty - p.sy) * drop,
          p.sz + (p.tz - p.sz) * t,
        );
        _dummy.rotation.set(p.age * p.spin, 0, p.age * p.spin);
        _dummy.scale.setScalar(p.scale * (1 - t * 0.35));
      } else {
        const gravity = -16;
        _dummy.position.set(
          p.sx + p.vx * p.age,
          Math.max(0.15, p.sy + p.vy * p.age + 0.5 * gravity * p.age * p.age),
          p.sz + p.vz * p.age,
        );
        _dummy.rotation.set(p.age * p.spin, p.age * p.spin, 0);
        _dummy.scale.setScalar(p.scale * (1 - t));
      }

      _dummy.updateMatrix();
      this.grainMesh.setMatrixAt(i, _dummy.matrix);
      anyChanged = true;
    }
    if (anyChanged) this.grainMesh.instanceMatrix.needsUpdate = true;

    // 3D weather particles (rain / snow / wind sand wisps)
    const showWeather = !reducedMotion && env.weather !== 'clear';
    this.weatherMesh.visible = showWeather;
    if (!showWeather) return;

    const wx = Math.cos(env.windDirection);
    const wz = Math.sin(env.windDirection);

    if (env.weather === 'rain') {
      this.weatherMat.color.set('#cde6f7');
      this.weatherMat.opacity = 0.58;
    } else if (env.weather === 'snow') {
      this.weatherMat.color.set('#ffffff');
      this.weatherMat.opacity = 0.85;
    } else {
      this.weatherMat.color.set('#f2ddb2');
      this.weatherMat.opacity = 0.42;
    }

    for (let i = 0; i < WEATHER_COUNT; i++) {
      const ox = this.weatherOffsets[i * 3];
      const oy = this.weatherOffsets[i * 3 + 1];
      const oz = this.weatherOffsets[i * 3 + 2];

      if (env.weather === 'rain') {
        const y = ((oy - elapsed * 24) % 28 + 28) % 28;
        const x = ((ox + elapsed * wx * 6 + 23) % 46 + 46) % 46 - 23;
        const z = ((oz + elapsed * wz * 6 + 23) % 46 + 46) % 46 - 23;
        _dummy.position.set(x, y, z);
        _dummy.rotation.set(wz * 0.22, 0, -wx * 0.22);
        _dummy.scale.set(0.6, 1.8, 0.6);
      } else if (env.weather === 'snow') {
        const y = ((oy - elapsed * 3.4) % 28 + 28) % 28;
        const sway = Math.sin(elapsed * 1.8 + i) * 1.1;
        const x = ((ox + sway + elapsed * wx * 2.2 + 23) % 46 + 46) % 46 - 23;
        const z = ((oz + elapsed * wz * 2.2 + 23) % 46 + 46) % 46 - 23;
        _dummy.position.set(x, y, z);
        _dummy.rotation.set(elapsed + i, elapsed * 0.7, 0);
        _dummy.scale.set(2.4, 0.32, 2.4);
      } else {
        // Wind sand wisps skimming horizontally
        const x = ((ox + elapsed * wx * 18 + 23) % 46 + 46) % 46 - 23;
        const z = ((oz + elapsed * wz * 18 + 23) % 46 + 46) % 46 - 23;
        const y = 1 + ((oy + Math.sin(elapsed * 3 + i) * 1.2) % 12 + 12) % 12;
        _dummy.position.set(x, y, z);
        _dummy.rotation.set(0, -env.windDirection, Math.PI / 2);
        _dummy.scale.set(0.45, 2.6, 0.45);
      }
      _dummy.updateMatrix();
      this.weatherMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.weatherMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.grainMesh.geometry.dispose();
    this.grainMat.dispose();
    this.weatherMesh.geometry.dispose();
    this.weatherMat.dispose();
  }
}
