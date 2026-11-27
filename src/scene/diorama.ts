import * as THREE from 'three';
import { STAGES } from '../game/content';
import type { StageId } from '../game/types';
import { createContactShadowTexture } from './textures';

export interface DioramaController {
  group: THREE.Group;
  waterMesh: THREE.Mesh | null;
  binFillP0: THREE.Mesh;
  binFillP1: THREE.Mesh;
  setStage: (stageId: StageId, pileFactor: number) => void;
  updateHarvestBins: (grams0: number, grams1: number, sedimentRgb: [number, number, number]) => void;
  updateWater: (elapsed: number) => void;
  dispose: () => void;
}

function makeMat(color: string, roughness = 0.82, metalness = 0.04): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createPalmTree(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const trunkMat = makeMat('#876242', 0.9);
  const leafMat = makeMat('#4f8f59', 0.72);
  const cocoMat = makeMat('#5a3d28', 0.85);

  // Curved segmented palm trunk
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45 - i * 0.04, 0.52 - i * 0.04, 1.55, 8),
      trunkMat,
    );
    seg.position.set(i * 0.16, 0.75 + i * 1.4, i * 0.06);
    seg.rotation.z = -0.09;
    seg.castShadow = true;
    seg.receiveShadow = true;
    g.add(seg);
  }
  const topX = 0.9;
  const topY = 8.9;
  const topZ = 0.32;

  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const frond = new THREE.Group();
    frond.position.set(topX, topY, topZ);
    frond.rotation.y = ang;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 1.3), leafMat);
    blade.position.set(2.1, -0.35, 0);
    blade.rotation.z = -0.32;
    blade.castShadow = true;
    frond.add(blade);
    g.add(frond);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), cocoMat);
    coco.position.set(topX + Math.cos(a) * 0.42, topY - 0.55, topZ + Math.sin(a) * 0.42);
    g.add(coco);
  }
  return g;
}

function createPineTree(x: number, z: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 3.2, 8), makeMat('#755137', 0.92));
  trunk.position.y = 1.6;
  trunk.castShadow = true;
  g.add(trunk);

  const foliageColors = ['#4d7452', '#5b835b', '#6b9467'];
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(3.1 - i * 0.65, 3.6 - i * 0.4, 9),
      makeMat(foliageColors[i], 0.85),
    );
    cone.position.y = 4.2 + i * 2.1;
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);
  }
  return g;
}

function createBeachUmbrella(x: number, z: number, color: string): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 5.4, 8), makeMat('#8d6e4c', 0.72));
  pole.position.y = 2.7;
  pole.castShadow = true;
  g.add(pole);

  const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.7, 1.35, 10), makeMat(color, 0.76));
  canopy.position.y = 5.4;
  canopy.castShadow = true;
  g.add(canopy);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), makeMat('#f2e6c9', 0.45));
  finial.position.y = 6.15;
  g.add(finial);

  const towel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 3.2), makeMat('#faf0d2', 0.92));
  towel.position.set(0.6, 0.08, 2.2);
  towel.receiveShadow = true;
  g.add(towel);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.62, 0.14, 0.6), makeMat(color, 0.9));
  stripe.position.set(0.6, 0.09, 2.2);
  g.add(stripe);
  return g;
}

function createRockCluster(x: number, z: number, size = 3): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const mat1 = makeMat('#8a918b', 0.92);
  const mat2 = makeMat('#a2a9a0', 0.86);
  const main = new THREE.Mesh(new THREE.DodecahedronGeometry(size * 0.65, 0), mat1);
  main.scale.set(1.2, 0.75, 1.0);
  main.position.y = size * 0.38;
  main.castShadow = true;
  main.receiveShadow = true;
  g.add(main);

  const sub = new THREE.Mesh(new THREE.DodecahedronGeometry(size * 0.42, 0), mat2);
  sub.position.set(size * 0.55, size * 0.25, size * 0.3);
  sub.castShadow = true;
  g.add(sub);
  return g;
}

function createBench(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const wood = makeMat('#a97f54', 0.78);
  const iron = makeMat('#4d5350', 0.4, 0.72);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.42, 2.2), wood);
  seat.position.set(0, 1.35, 0);
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.95, 0.32), wood);
  back.position.set(0, 2.35, -0.95);
  back.rotation.x = -0.15;
  back.castShadow = true;
  g.add(back);
  for (const lx of [-2.5, 2.5]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.35, 1.8), iron);
    leg.position.set(lx, 0.68, 0);
    g.add(leg);
  }
  return g;
}

function createBarrel(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.05, 2.8, 12), makeMat('#9b7048', 0.82));
  body.position.y = 1.4;
  body.castShadow = true;
  g.add(body);
  const hoopMat = makeMat('#4e575a', 0.35, 0.78);
  for (const hy of [0.65, 2.15]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.08, 6, 14), hoopMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = hy;
    g.add(hoop);
  }
  return g;
}

function createHarvestBin(x: number, z: number, accentColor: string): { bin: THREE.Group; fill: THREE.Mesh } {
  const bin = new THREE.Group();
  bin.position.set(x, 0, z);

  const wallMat = makeMat(accentColor, 0.58, 0.08);
  const trimMat = makeMat('#f5eedc', 0.5, 0.05);

  const base = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.25, 2.9), wallMat);
  base.position.y = 0.125;
  base.receiveShadow = true;
  bin.add(base);

  const walls: [number, number, number, number, number][] = [
    [-1.8, 0.85, 0, 0.22, 2.9],
    [1.8, 0.85, 0, 0.22, 2.9],
    [0, 0.85, -1.35, 3.8, 0.22],
    [0, 0.85, 1.35, 3.8, 0.22],
  ];
  for (const [wx, wy, wz, ww, wd] of walls) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(ww, 1.35, wd), wallMat);
    w.position.set(wx, wy, wz);
    w.castShadow = true;
    w.receiveShadow = true;
    bin.add(w);
  }

  const rim = new THREE.Mesh(new THREE.BoxGeometry(3.96, 0.14, 3.06), trimMat);
  rim.position.y = 1.54;
  // Hollow visual feel via 4 trim rails instead of covering interior
  rim.visible = false;
  for (const [wx, wz, ww, wd] of [
    [-1.8, 0, 0.3, 3.04],
    [1.8, 0, 0.3, 3.04],
    [0, -1.35, 3.9, 0.3],
    [0, 1.35, 3.9, 0.3],
  ] as [number, number, number, number][]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.14, wd), trimMat);
    r.position.set(wx, 1.56, wz);
    bin.add(r);
  }

  const fillGeo = new THREE.BoxGeometry(3.32, 1.18, 2.42);
  fillGeo.translate(0, 0.59, 0);
  const fillMat = makeMat('#dfbc7e', 0.88);
  const fill = new THREE.Mesh(fillGeo, fillMat);
  fill.position.set(0, 0.26, 0);
  fill.scale.y = 0.01;
  fill.visible = false;
  fill.receiveShadow = true;
  bin.add(fill);

  return { bin, fill };
}

export function createDiorama(): DioramaController {
  const group = new THREE.Group();
  const stageRoot = new THREE.Group();
  group.add(stageRoot);

  // Soft contact shadow directly under the sand pile
  const contactTex = createContactShadowTexture();
  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(15.5, 32),
    new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  group.add(contactShadow);

  // Player 1 & Player 2 physical harvest bins flanking the front corners of the sand mound
  const p0Bin = createHarvestBin(-13.2, 12.2, '#2d765d');
  const p1Bin = createHarvestBin(13.2, 12.2, '#c55f42');
  group.add(p0Bin.bin, p1Bin.bin);

  let waterMesh: THREE.Mesh | null = null;
  let waterBaseY = -0.35;

  function clearStage() {
    while (stageRoot.children.length > 0) {
      const child = stageRoot.children[0];
      stageRoot.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
    }
    waterMesh = null;
  }

  function setStage(stageId: StageId, pileFactor: number) {
    clearStage();
    const spec = STAGES.find((s) => s.id === stageId) || STAGES[0];
    const f = Math.max(0.8, pileFactor);

    contactShadow.scale.setScalar(f);
    p0Bin.bin.position.set(-13.2 * f, 0, 12.2 * f);
    p1Bin.bin.position.set(13.2 * f, 0, 12.2 * f);
    p0Bin.bin.scale.setScalar(Math.min(1.4, f));
    p1Bin.bin.scale.setScalar(Math.min(1.4, f));

    // Wide extended outdoor ground disc (seamless fade into horizon fog)
    const groundRadius = 155;
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(groundRadius, groundRadius, 1.4, 48),
      makeMat(spec.ground, 0.92),
    );
    ground.position.y = -0.72;
    ground.receiveShadow = true;
    stageRoot.add(ground);

    // Sculpted sand court pedestal slightly above base terrain (no Z-fighting)
    const court = new THREE.Mesh(
      new THREE.CylinderGeometry(16.2 * f, 17.5 * f, 0.24, 36),
      makeMat('#d8c498', 0.9),
    );
    court.position.y = -0.12;
    court.receiveShadow = true;
    stageRoot.add(court);

    const place = (obj: THREE.Object3D, x: number, y: number, z: number) => {
      obj.position.set(x * f, y, z * f);
      stageRoot.add(obj);
    };

    const addWater = (color: string, y: number, width: number, depth: number, offsetZ: number) => {
      const geo = new THREE.PlaneGeometry(width, depth, 24, 16);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.22,
        metalness: 0.14,
        transparent: true,
        opacity: 0.88,
      });
      waterMesh = new THREE.Mesh(geo, mat);
      waterBaseY = y;
      waterMesh.position.set(0, y, offsetZ * f);
      waterMesh.receiveShadow = true;
      stageRoot.add(waterMesh);
    };

    const colors = ['#d77352', '#e9c86b', '#5d98a3', '#8ca96b'];

    switch (stageId) {
      case 'beach': {
        addWater(spec.water || '#3d99b5', -0.08, 280, 120, -76);
        // Shore foam strip
        for (let i = -3; i <= 3; i++) {
          const foam = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.7), makeMat('#e9f5f0', 0.6));
          place(foam, i * 14, -0.02, -19 - (Math.abs(i) % 2) * 1.6);
        }
        stageRoot.add(createPalmTree(-23 * f, -11 * f));
        stageRoot.add(createPalmTree(23 * f, -16 * f));
        stageRoot.add(createBeachUmbrella(-22 * f, 10 * f, '#e09a4e'));
        stageRoot.add(createBeachUmbrella(21 * f, -6 * f, '#4b8fa8'));
        stageRoot.add(createRockCluster(-29 * f, -20 * f, 3.6));
        stageRoot.add(createRockCluster(30 * f, 14 * f, 3.2));
        break;
      }

      case 'playground': {
        // Wooden perimeter fence in back
        const fenceMat = makeMat('#c49c6e', 0.84);
        for (let x = -28; x <= 28; x += 5) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.65, 3.2, 0.65), fenceMat);
          place(post, x, 1.6, -24);
        }
        for (const ry of [1.1, 2.3]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(58 * f, 0.35, 0.35), fenceMat);
          rail.position.set(0, ry, -24 * f);
          stageRoot.add(rail);
        }
        stageRoot.add(createPineTree(25 * f, -18 * f, 1.1));
        stageRoot.add(createBench(-24 * f, 12 * f));

        // Swing set
        const swing = new THREE.Group();
        const frameMat = makeMat('#c26148', 0.55, 0.25);
        for (const sx of [-4, 4]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 9.5, 8), frameMat);
          p.position.set(sx, 4.75, 0);
          p.castShadow = true;
          swing.add(p);
        }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9.2, 8), makeMat('#ebb854', 0.45, 0.2));
        bar.rotation.z = Math.PI / 2;
        bar.position.y = 9.4;
        swing.add(bar);
        for (const sx of [-1.6, 1.6]) {
          const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 1.1), makeMat('#4d8eab', 0.5));
          seat.position.set(sx, 2.6, 0);
          swing.add(seat);
          for (const rx of [-0.7, 0.7]) {
            const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.8, 6), makeMat('#5e6668', 0.3, 0.8));
            chain.position.set(sx + rx, 6.0, 0);
            swing.add(chain);
          }
        }
        place(swing, -20, 0, -14);

        // Slide tower
        const slide = new THREE.Group();
        const tower = new THREE.Mesh(new THREE.BoxGeometry(4.8, 5.8, 4.8), makeMat('#d7ae62', 0.8));
        tower.position.y = 2.9;
        tower.castShadow = true;
        slide.add(tower);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.4, 4), makeMat('#5b8da3', 0.65));
        roof.position.y = 7.0;
        roof.rotation.y = Math.PI / 4;
        slide.add(roof);
        const chute = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 9.5), makeMat('#df7354', 0.4));
        chute.position.set(0, 2.7, 6.0);
        chute.rotation.x = 0.55;
        chute.castShadow = true;
        slide.add(chute);
        place(slide, 20, 0, -14);
        break;
      }

      case 'ssireum': {
        // Traditional sand wrestling ring border + tiered bleachers + festive lanterns
        const ring = new THREE.Mesh(new THREE.TorusGeometry(16.6 * f, 0.6, 10, 48), makeMat('#d2b07a', 0.9));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.28;
        stageRoot.add(ring);

        for (let row = 0; row < 3; row++) {
          const tier = new THREE.Mesh(new THREE.BoxGeometry(56 * f, 1.8, 3.2), makeMat('#8d7f6c', 0.88));
          tier.position.set(0, row * 1.8 + 0.9, (-29 + row * 3.4) * f);
          tier.castShadow = true;
          tier.receiveShadow = true;
          stageRoot.add(tier);
          for (let x = -22; x <= 22; x += 5) {
            const body = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.45, 0.9, 4, 8),
              makeMat(colors[Math.abs(x + row) % colors.length], 0.8),
            );
            place(body, x, row * 1.8 + 2.55, -29 + row * 3.4);
          }
        }
        // Overhead awning posts & festive flags
        for (const px of [-24, 24]) {
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 12.5, 10), makeMat('#7d5742', 0.8));
          place(pillar, px, 6.25, -18);
        }
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(52 * f, 0.7, 4.5), makeMat('#c86848', 0.72));
        canopy.position.set(0, 12.5, -18 * f);
        stageRoot.add(canopy);
        break;
      }

      case 'ocean-ship':
      case 'river-boat': {
        addWater(spec.water || '#2f82a3', -1.25, 320, 320, 0);
        // Wooden ship hull & planked deck
        const hull = new THREE.Mesh(new THREE.BoxGeometry(38 * f, 2.4, 52 * f), makeMat('#654d3c', 0.85));
        hull.position.set(0, -1.35, 0);
        hull.receiveShadow = true;
        stageRoot.add(hull);

        const deck = new THREE.Mesh(new THREE.BoxGeometry(36.5 * f, 0.35, 50 * f), makeMat('#b88e5b', 0.78));
        deck.position.set(0, -0.18, 0);
        deck.receiveShadow = true;
        stageRoot.add(deck);

        // Side railings
        for (const rx of [-18, 18]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 49 * f), makeMat('#d9b67d', 0.75));
          rail.position.set(rx * f, 2.9, 0);
          stageRoot.add(rail);
          for (let z = -22; z <= 22; z += 6) {
            const st = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.9, 0.45), makeMat('#7c6044', 0.84));
            place(st, rx, 1.45, z);
          }
        }

        // Wheelhouse cabin
        const cabin = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(12, 5.2, 7.2), makeMat('#e9dbb3', 0.82));
        body.position.y = 2.6;
        body.castShadow = true;
        cabin.add(body);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.65, 8.2), makeMat('#486874', 0.6));
        roof.position.y = 5.5;
        cabin.add(roof);
        const win = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.7, 0.3), makeMat('#6c9eab', 0.18, 0.35));
        win.position.set(0, 3.2, 3.6);
        cabin.add(win);
        place(cabin, 0, 0, -21);

        stageRoot.add(createBarrel(-14.5 * f, 18 * f));
        stageRoot.add(createBarrel(14 * f, -17 * f));

        if (stageId === 'ocean-ship') {
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 19, 10), makeMat('#8d6440', 0.82));
          place(mast, 10, 9.5, -19);
          const sail = new THREE.Mesh(new THREE.BoxGeometry(8.5, 8.2, 0.25), makeMat('#f7eed6', 0.88));
          place(sail, 10, 12.5, -18.2);
        } else {
          // Lush riverbanks on both sides
          for (const bx of [-38, 38]) {
            const bank = new THREE.Mesh(new THREE.BoxGeometry(24, 2.2, 160), makeMat('#769664', 0.92));
            bank.position.set(bx * f, -0.5, 0);
            stageRoot.add(bank);
            for (let z = -34; z <= 34; z += 18) {
              stageRoot.add(createPineTree((bx + (bx < 0 ? 4 : -4)) * f, z * f, 1.15));
            }
          }
        }
        break;
      }

      case 'desert': {
        // Stepped sandstone pyramid
        const pyr = new THREE.Group();
        for (let i = 0; i < 7; i++) {
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(19 - i * 2.3, 1.8, 19 - i * 2.3),
            makeMat('#cea16a', 0.9),
          );
          step.position.y = 0.9 + i * 1.8;
          step.castShadow = true;
          step.receiveShadow = true;
          pyr.add(step);
        }
        place(pyr, -23, 0, -22);

        // Oasis lagoon + palm
        addWater('#4f9c98', -0.04, 18 * f, 13 * f, 17);
        if (waterMesh) (waterMesh as THREE.Mesh).position.x = 22 * f;
        stageRoot.add(createPalmTree(26 * f, 14 * f));

        // Desert cacti
        const cactusMat = makeMat('#668750', 0.82);
        for (const [cx, cz] of [
          [23, -17],
          [-24, 15],
        ]) {
          const c = new THREE.Group();
          const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 6.2, 6, 10), cactusMat);
          stem.position.y = 3.8;
          stem.castShadow = true;
          c.add(stem);
          const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.4, 6, 8), cactusMat);
          arm.position.set(-1.5, 4.6, 0);
          arm.rotation.z = 0.7;
          c.add(arm);
          place(c, cx, 0, cz);
        }
        break;
      }

      case 'garden': {
        for (const gz of [-23, 21]) {
          for (let gx = -22; gx <= 22; gx += 11) {
            const bed = new THREE.Group();
            const frame = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.6, 3.8), makeMat('#9c7958', 0.84));
            frame.position.y = 0.8;
            frame.castShadow = true;
            bed.add(frame);
            const soil = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.3, 3.1), makeMat('#5f513d', 0.95));
            soil.position.y = 1.65;
            bed.add(soil);
            for (let j = -1; j <= 1; j++) {
              const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), makeMat('#5d8e58', 0.85));
              bush.position.set(j * 1.9, 2.3, 0);
              bed.add(bush);
              const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), makeMat(colors[(j + 4) % 4], 0.6));
              bloom.position.set(j * 1.9, 3.1, 0);
              bed.add(bloom);
            }
            place(bed, gx, 0, gz);
          }
        }
        stageRoot.add(createPineTree(25 * f, -12 * f, 1.2));
        stageRoot.add(createBench(-24 * f, -10 * f));
        break;
      }

      case 'school': {
        // Track lines
        for (let i = 0; i < 3; i++) {
          const line = new THREE.Mesh(
            new THREE.RingGeometry((22 + i * 2.2) * f, (22.4 + i * 2.2) * f, 48),
            makeMat('#f3ead6', 0.9),
          );
          line.rotation.x = -Math.PI / 2;
          line.position.y = 0.03;
          stageRoot.add(line);
        }
        // School building
        const bld = new THREE.Group();
        const walls = new THREE.Mesh(new THREE.BoxGeometry(44, 11.5, 7), makeMat('#dacaa7', 0.86));
        walls.position.y = 5.75;
        walls.castShadow = true;
        bld.add(walls);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(45.2, 0.9, 7.8), makeMat('#966e67', 0.78));
        roof.position.y = 11.8;
        bld.add(roof);
        const winMat = makeMat('#81b2ba', 0.22, 0.35);
        for (let wx = -18; wx <= 18; wx += 5) {
          for (const wy of [3.2, 7.6]) {
            const w = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.6, 0.25), winMat);
            w.position.set(wx, wy, 3.55);
            bld.add(w);
          }
        }
        place(bld, 0, 0, -28);
        stageRoot.add(createBench(21 * f, 10 * f));
        break;
      }

      case 'village': {
        // Tiled-roof countryside house + terracotta jars + bench
        const house = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(19, 7.5, 10), makeMat('#d2ba98', 0.88));
        body.position.y = 3.75;
        body.castShadow = true;
        house.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(14.5, 4.2, 4), makeMat('#5b6a6c', 0.78));
        roof.position.y = 9.5;
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(1.2, 1, 0.8);
        roof.castShadow = true;
        house.add(roof);
        const door = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5.2, 0.25), makeMat('#76553b', 0.8));
        door.position.set(0, 2.6, 5.05);
        house.add(door);
        place(house, -16, 0, -24);

        // Traditional earthenware jars (Jangdokdae)
        for (const [jx, jz] of [
          [22, 11],
          [19, 15],
          [23, 16],
        ]) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 2.8, 12), makeMat('#6e4e3d', 0.42, 0.12));
          place(jar, jx, 1.4, jz);
        }
        stageRoot.add(createBench(16 * f, -16 * f));
        stageRoot.add(createPineTree(-25 * f, 15 * f, 1.15));
        break;
      }

      case 'quarry': {
        for (let i = -3; i <= 3; i++) {
          stageRoot.add(createRockCluster((i * 8) * f, (-24 + Math.abs(i % 2) * 3) * f, 4.2 + (Math.abs(i) % 3)));
        }
        stageRoot.add(createRockCluster(-24 * f, 13 * f, 4.8));
        stageRoot.add(createRockCluster(23 * f, 16 * f, 3.8));

        // Composite dump truck
        const truck = new THREE.Group();
        const bed = new THREE.Mesh(new THREE.BoxGeometry(8.5, 3.2, 4.8), makeMat('#dfa945', 0.55, 0.25));
        bed.position.set(-1.5, 2.8, 0);
        bed.castShadow = true;
        truck.add(bed);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.8, 4.4), makeMat('#e9be58', 0.45, 0.25));
        cab.position.set(4.3, 3.2, 0);
        cab.castShadow = true;
        truck.add(cab);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 4.5), makeMat('#4b6d7c', 0.18, 0.4));
        glass.position.set(4.9, 3.8, 0);
        truck.add(glass);
        const wheelMat = makeMat('#31373a', 0.88);
        for (const wx of [-3.8, 3.8]) {
          for (const wz of [-2.4, 2.4]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.9, 14), wheelMat);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(wx, 1.25, wz);
            truck.add(wheel);
          }
        }
        place(truck, 20, 0, -13);
        break;
      }

      case 'forest': {
        for (const [tx, tz, sc] of [
          [-25, -18, 1.2],
          [-15, -26, 1.35],
          [8, -27, 1.25],
          [26, -19, 1.15],
          [-27, 11, 1.1],
          [27, 13, 1.2],
        ]) {
          stageRoot.add(createPineTree(tx * f, tz * f, sc));
        }
        // A-frame camp tent
        const tent = new THREE.Mesh(new THREE.ConeGeometry(5.6, 4.8, 3), makeMat('#cc8e50', 0.86));
        tent.rotation.y = Math.PI / 6;
        place(tent, 20, 2.4, -7);
        // Firewood logs
        for (const lx of [-23, -20]) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 6.2, 10), makeMat('#77573c', 0.9));
          log.rotation.x = Math.PI / 2;
          place(log, lx, 0.68, 13);
        }
        stageRoot.add(createRockCluster(-17 * f, 18 * f, 2.4));
        break;
      }

      case 'ruins': {
        const stoneMat = makeMat('#b8b097', 0.9);
        const capMat = makeMat('#cdc4a8', 0.84);
        for (const [px, pz] of [
          [-22, -20],
          [-12, -20],
          [14, -22],
          [24, -22],
        ]) {
          const col = new THREE.Group();
          const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.2, 3.8), capMat);
          plinth.position.y = 0.6;
          col.add(plinth);
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 10.5, 12), stoneMat);
          shaft.position.y = 6.4;
          shaft.castShadow = true;
          col.add(shaft);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.2, 3.8), capMat);
          cap.position.y = 12.2;
          col.add(cap);
          place(col, px, 0, pz);
        }
        const lintelL = new THREE.Mesh(new THREE.BoxGeometry(15 * f, 1.6, 3.8), stoneMat);
        lintelL.position.set(-17 * f, 13.5, -20 * f);
        lintelL.castShadow = true;
        stageRoot.add(lintelL);

        const lintelR = new THREE.Mesh(new THREE.BoxGeometry(15 * f, 1.6, 3.8), stoneMat);
        lintelR.position.set(19 * f, 13.5, -22 * f);
        lintelR.castShadow = true;
        stageRoot.add(lintelR);

        stageRoot.add(createRockCluster(-24 * f, 14 * f, 4.2));
        stageRoot.add(createRockCluster(21 * f, 16 * f, 3.6));
        break;
      }
    }
  }

  function updateHarvestBins(grams0: number, grams1: number, sedimentRgb: [number, number, number]) {
    const col = `rgb(${sedimentRgb[0]},${sedimentRgb[1]},${sedimentRgb[2]})`;
    const ratio0 = Math.min(1, grams0 / 260);
    const ratio1 = Math.min(1, grams1 / 260);
    (p0Bin.fill.material as THREE.MeshStandardMaterial).color.set(col);
    (p1Bin.fill.material as THREE.MeshStandardMaterial).color.set(col);
    p0Bin.fill.visible = ratio0 > 0.002;
    p1Bin.fill.visible = ratio1 > 0.002;
    p0Bin.fill.scale.y = Math.max(0.05, ratio0);
    p1Bin.fill.scale.y = Math.max(0.05, ratio1);
  }

  function updateWater(elapsed: number) {
    if (!waterMesh) return;
    waterMesh.position.y = waterBaseY + Math.sin(elapsed * 1.45) * 0.14;
  }

  function dispose() {
    clearStage();
    contactShadow.geometry.dispose();
    (contactShadow.material as THREE.Material).dispose();
    contactTex.dispose();
    for (const bin of [p0Bin.bin, p1Bin.bin]) {
      bin.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
    }
  }

  return {
    group,
    get waterMesh() {
      return waterMesh;
    },
    binFillP0: p0Bin.fill,
    binFillP1: p1Bin.fill,
    setStage,
    updateHarvestBins,
    updateWater,
    dispose,
  };
}
