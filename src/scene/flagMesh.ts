import * as THREE from 'three';
import { POLE_MATERIALS } from '../game/content';
import type { EnvironmentSnapshot, FlagDesignId, FlagState } from '../game/types';
import { createFlagTexture } from './textures';

const _axis = new THREE.Vector3();
const _wind = new THREE.Vector3();
const _side = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

export class FlagAssembly {
  public readonly group = new THREE.Group();
  private readonly polePivot = new THREE.Group();
  private shaftMesh: THREE.Mesh;
  private finialMesh: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private collarMesh: THREE.Mesh;
  private clothMesh: THREE.Mesh;
  private clothGeo: THREE.PlaneGeometry;
  private clothMat: THREE.MeshStandardMaterial;
  private poleMat: THREE.MeshStandardMaterial;
  private accentMat: THREE.MeshStandardMaterial;
  private currentDesign: FlagDesignId | null = null;
  private currentTexture: THREE.CanvasTexture | null = null;
  private readonly maxAnisotropy: number;

  private readonly segX = 14;
  private readonly segY = 6;
  private readonly clothW = 3.5;
  private readonly clothH = 2.45;

  constructor(maxAnisotropy: number) {
    this.maxAnisotropy = maxAnisotropy;

    this.poleMat = new THREE.MeshStandardMaterial({
      color: '#8c6142',
      roughness: 0.72,
      metalness: 0.08,
    });
    this.accentMat = new THREE.MeshStandardMaterial({
      color: '#d9b563',
      roughness: 0.34,
      metalness: 0.75,
    });

    // Multi-part pole: tapered shaft + decorative brass finial + upper tie ring + lower sleeve collar
    const shaftGeo = new THREE.CylinderGeometry(0.85, 1.05, 1, 14);
    shaftGeo.translate(0, 0.5, 0);
    this.shaftMesh = new THREE.Mesh(shaftGeo, this.poleMat);
    this.shaftMesh.castShadow = true;
    this.shaftMesh.receiveShadow = true;
    this.polePivot.add(this.shaftMesh);

    const finialGeo = new THREE.SphereGeometry(0.18, 12, 10);
    this.finialMesh = new THREE.Mesh(finialGeo, this.accentMat);
    this.finialMesh.castShadow = true;
    this.polePivot.add(this.finialMesh);

    const ringGeo = new THREE.TorusGeometry(0.16, 0.045, 8, 16);
    ringGeo.rotateX(Math.PI / 2);
    this.ringMesh = new THREE.Mesh(ringGeo, this.accentMat);
    this.polePivot.add(this.ringMesh);

    const collarGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.22, 12);
    this.collarMesh = new THREE.Mesh(collarGeo, this.accentMat);
    this.polePivot.add(this.collarMesh);

    this.group.add(this.polePivot);

    // Subdivided cloth mesh positioned in world/pile coordinates dynamically
    this.clothGeo = new THREE.PlaneGeometry(this.clothW, this.clothH, this.segX, this.segY);
    this.clothMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    this.clothMesh = new THREE.Mesh(this.clothGeo, this.clothMat);
    this.clothMesh.castShadow = true;
    this.clothMesh.receiveShadow = true;
    this.clothMesh.frustumCulled = false;
    this.group.add(this.clothMesh);
  }

  public syncSpec(flag: FlagState): void {
    const spec = POLE_MATERIALS.find((m) => m.id === flag.material) || POLE_MATERIALS[0];
    this.poleMat.color.set(flag.color);
    this.poleMat.roughness = spec.roughness;
    this.poleMat.metalness = spec.metalness;

    const r = Math.max(0.06, flag.diameter * 0.62);
    this.shaftMesh.scale.set(r, flag.length, r);
    this.finialMesh.position.set(0, flag.length + 0.12, 0);
    this.finialMesh.scale.setScalar(Math.max(0.7, r * 7));
    this.ringMesh.position.set(0, flag.length - 0.12, 0);
    this.ringMesh.scale.setScalar(Math.max(0.7, r * 6.5));
    this.collarMesh.position.set(0, Math.max(0.2, flag.length - this.clothH - 0.12), 0);
    this.collarMesh.scale.set(Math.max(0.7, r * 6.5), 1, Math.max(0.7, r * 6.5));

    if (this.currentDesign !== flag.design) {
      this.currentDesign = flag.design;
      this.currentTexture?.dispose();
      this.currentTexture = createFlagTexture(flag.design, this.maxAnisotropy);
      this.clothMat.map = this.currentTexture;
      this.clothMat.needsUpdate = true;
    }
  }

  public update(
    flag: FlagState,
    env: EnvironmentSnapshot,
    seconds: number,
    supportRatio: number,
    reducedMotion: boolean,
  ): void {
    // Subtle tension tremble when support ratio gets dangerously low
    const danger = Math.max(0, 0.45 - supportRatio) / 0.45;
    const tremble = !reducedMotion && danger > 0 && flag.angle < 1.2
      ? Math.sin(seconds * 26) * danger * 0.025
      : 0;

    const angle = flag.angle + tremble;
    const dir = flag.direction;
    const baseX = flag.x - 12.5;
    const baseY = flag.root - (flag.drop || 0);
    const baseZ = flag.z - 12.5;

    _axis.set(Math.cos(dir) * Math.sin(angle), Math.cos(angle), Math.sin(dir) * Math.sin(angle)).normalize();
    _quat.setFromUnitVectors(_up, _axis);
    this.polePivot.position.set(baseX, baseY, baseZ);
    this.polePivot.quaternion.copy(_quat);

    // Compute wind-aligned cloth frame anchored along the top of the pole
    _wind.set(Math.cos(env.windDirection), 0, Math.sin(env.windDirection));
    const dot = _wind.dot(_axis);
    _side.copy(_wind).addScaledVector(_axis, -dot);
    if (_side.lengthSq() < 0.0025) {
      _side.set(-Math.sin(dir), 0, Math.cos(dir));
    }
    _side.normalize();
    _normal.crossVectors(_axis, _side).normalize();

    const strength = env.windStrength;
    const posAttr = this.clothGeo.attributes.position as THREE.BufferAttribute;
    const cols = this.segX + 1;
    const rows = this.segY + 1;

    for (let row = 0; row < rows; row++) {
      const v = row / this.segY; // 0 = top of flag, 1 = bottom of flag
      for (let col = 0; col < cols; col++) {
        const u = col / this.segX; // 0 = attached to pole, 1 = flying tip
        const idx = row * cols + col;
        const wave = reducedMotion
          ? 0
          : u * (0.04 + strength * 0.52) * Math.sin(seconds * (2.4 + strength * 7.2) - u * 6.8 + v * 1.9 + angle * 2);
        const ripple = reducedMotion
          ? 0
          : u * u * (0.02 + strength * 0.14) * Math.cos(seconds * (4.5 + strength * 9) - u * 11.5 - v * 3);
        const spread = this.clothW * u * (0.52 + 0.48 * strength);
        const sag = u * u * (0.72 * (1 - strength * 0.85) + Math.sin(angle) * 0.25);
        const alongPole = flag.length - 0.1 - v * this.clothH;

        const px = baseX + _axis.x * alongPole + _side.x * spread + _normal.x * (wave + ripple);
        const py = baseY + _axis.y * alongPole + _side.y * spread + _normal.y * (wave + ripple) - sag;
        const pz = baseZ + _axis.z * alongPole + _side.z * spread + _normal.z * (wave + ripple);
        posAttr.setXYZ(idx, px, py, pz);
      }
    }
    posAttr.needsUpdate = true;
    this.clothGeo.computeVertexNormals();
  }

  public dispose(): void {
    this.shaftMesh.geometry.dispose();
    this.finialMesh.geometry.dispose();
    this.ringMesh.geometry.dispose();
    this.collarMesh.geometry.dispose();
    this.clothGeo.dispose();
    this.poleMat.dispose();
    this.accentMat.dispose();
    this.clothMat.dispose();
    this.currentTexture?.dispose();
  }
}
