import * as THREE from 'three';
import { TOOLS } from '../game/content';
import type { ToolId } from '../game/types';

function makeWoodMat(color: string, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
}

function makeSkinMat(color = '#eab990') {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02 });
}

function makeMetalMat(color = '#d3dee8') {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.92 });
}

function buildBroom(): THREE.Group {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.6, 10), makeWoodMat('#7a5438'));
  handle.position.set(0, 2.5, 0);
  g.add(handle);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.32, 10), makeWoodMat('#b85c42', 0.55));
  collar.position.set(0, 0.85, 0);
  g.add(collar);

  const bristles = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.42), makeWoodMat('#dfba71', 0.9));
  bristles.position.set(0, 0.35, 0);
  g.add(bristles);

  const band = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.12, 0.46), makeWoodMat('#a1513a', 0.6));
  band.position.set(0, 0.55, 0);
  g.add(band);

  g.rotation.z = -0.35;
  return g;
}

function buildFinger(): THREE.Group {
  const g = new THREE.Group();
  const skin = makeSkinMat();
  const nail = new THREE.MeshStandardMaterial({ color: '#fae2cc', roughness: 0.3, metalness: 0.05 });

  const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.65, 6, 10), skin);
  tip.position.set(0, 0.55, 0);
  g.add(tip);

  const knuckle = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 6, 10), skin);
  knuckle.position.set(0.25, 1.35, 0);
  knuckle.rotation.z = -0.35;
  g.add(knuckle);

  const nailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.1), nail);
  nailMesh.position.set(-0.18, 0.28, 0);
  nailMesh.rotation.z = 0.2;
  g.add(nailMesh);

  const palm = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.9, 0.55), skin);
  palm.position.set(0.65, 2.05, 0);
  palm.rotation.z = -0.45;
  g.add(palm);

  return g;
}

function buildNeedle(): THREE.Group {
  const g = new THREE.Group();
  const metal = makeMetalMat('#dce7ef');
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 2.6, 10), metal);
  shaft.rotation.x = Math.PI;
  shaft.position.set(0, 1.3, 0);
  g.add(shaft);

  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 12), makeMetalMat('#8ea2b3'));
  eye.position.set(0, 2.7, 0);
  g.add(eye);

  g.rotation.z = -0.25;
  return g;
}

function buildToothpick(): THREE.Group {
  const g = new THREE.Group();
  const wood = makeWoodMat('#e8c684', 0.65);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.3, 10), wood);
  tip.rotation.x = Math.PI;
  tip.position.set(0, 0.65, 0);
  g.add(tip);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.1, 10), wood);
  body.position.set(0, 2.35, 0);
  g.add(body);

  const groove = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 10), makeWoodMat('#b58d52'));
  groove.rotation.x = Math.PI / 2;
  groove.position.set(0, 3.1, 0);
  g.add(groove);

  g.rotation.z = -0.28;
  return g;
}

function buildHand(): THREE.Group {
  const g = new THREE.Group();
  const skin = makeSkinMat();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.25), skin);
  palm.position.set(0, 0.85, 0);
  palm.rotation.x = 0.42;
  g.add(palm);

  for (let i = -1.5; i <= 1.5; i += 1) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.72, 6, 8), skin);
    f.position.set(i * 0.34, 0.35, 0.55);
    f.rotation.x = 0.85;
    g.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 6, 8), skin);
  thumb.position.set(-0.82, 0.6, 0.25);
  thumb.rotation.set(0.5, 0, -0.55);
  g.add(thumb);
  return g;
}

function buildBothHands(): THREE.Group {
  const g = new THREE.Group();
  const left = buildHand();
  left.position.set(-1.05, 0, 0);
  left.rotation.y = 0.45;
  const right = buildHand();
  right.position.set(1.05, 0, 0);
  right.scale.x = -1;
  right.rotation.y = -0.45;
  g.add(left, right);
  return g;
}

export class Tool3DVisual {
  public readonly group = new THREE.Group();
  private readonly reticle: THREE.Mesh;
  private readonly innerDot: THREE.Mesh;
  private readonly models: Record<ToolId, THREE.Group>;
  private activeTool: ToolId = 'finger';

  constructor() {
    const ringGeo = new THREE.RingGeometry(0.82, 1.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#fff6d6',
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.reticle = new THREE.Mesh(ringGeo, ringMat);
    this.reticle.renderOrder = 20;

    const dotGeo = new THREE.CircleGeometry(0.14, 16);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: '#32c48d',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.innerDot = new THREE.Mesh(dotGeo, dotMat);
    this.innerDot.renderOrder = 21;

    this.group.add(this.reticle, this.innerDot);

    this.models = {
      broom: buildBroom(),
      finger: buildFinger(),
      needle: buildNeedle(),
      toothpick: buildToothpick(),
      hand: buildHand(),
      bothhands: buildBothHands(),
    };

    for (const [id, mesh] of Object.entries(this.models)) {
      mesh.visible = false;
      mesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
        }
      });
      mesh.name = `tool-${id}`;
      this.group.add(mesh);
    }

    this.group.visible = false;
  }

  public update(params: {
    visible: boolean;
    digging: boolean;
    tool: ToolId;
    player: 0 | 1;
    point: [number, number, number] | null;
    digPhase: number;
    pileFactor: number;
    reducedMotion: boolean;
  }): void {
    const { visible, digging, tool, player, point, digPhase, pileFactor, reducedMotion } = params;
    if (!visible || !point) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    const x = (point[0] - 12.5) * pileFactor;
    const y = point[1] * pileFactor + 0.08;
    const z = (point[2] - 12.5) * pileFactor;
    this.group.position.set(x, y, z);

    const spec = TOOLS[tool];
    const r = Math.max(0.45, spec.radius * pileFactor);
    this.reticle.scale.setScalar(r);
    (this.innerDot.material as THREE.MeshBasicMaterial).color.set(player === 0 ? '#2fa07c' : '#df6c48');

    if (this.activeTool !== tool) {
      this.models[this.activeTool].visible = false;
      this.activeTool = tool;
    }

    const model = this.models[tool];
    model.visible = digging;
    if (digging) {
      const p = reducedMotion ? 0 : Math.sin(digPhase * Math.PI * 2);
      const dip = reducedMotion ? 0 : Math.sin(digPhase * Math.PI);
      model.scale.setScalar(Math.max(0.75, pileFactor * 0.9));
      if (tool === 'broom') {
        model.position.set(p * 1.15, 0.2 - dip * 0.25, 0);
        model.rotation.set(0, 0, -0.35 + p * 0.35);
      } else if (tool === 'bothhands') {
        model.position.set(0, 0.45 - dip * 0.48, 0);
        model.rotation.set(dip * 0.25, 0, 0);
      } else if (tool === 'needle' || tool === 'toothpick') {
        model.position.set(0, 0.3 - dip * 0.45, 0);
        model.rotation.set(0, 0, -0.25);
      } else {
        model.position.set(-dip * 0.35, 0.35 - dip * 0.42, 0);
        model.rotation.set(dip * 0.35, 0, -0.2);
      }
    }
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    });
  }
}
