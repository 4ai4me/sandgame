import * as THREE from 'three';
import { amount, get, H, index, inside, N } from '../game/engine';
import type { MatchState } from '../game/types';

interface FaceDef {
  n: [number, number, number];
  // Counter-clockwise vertices as viewed from outside along normal n
  v: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  uAxis: [number, number, number];
  vAxis: [number, number, number];
}

const FACES: FaceDef[] = [
  // +Y (top)
  {
    n: [0, 1, 0],
    v: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 0, 1],
  },
  // -Y (bottom)
  {
    n: [0, -1, 0],
    v: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 0, 1],
  },
  // +X
  {
    n: [1, 0, 0],
    v: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uAxis: [0, 0, 1],
    vAxis: [0, 1, 0],
  },
  // -X
  {
    n: [-1, 0, 0],
    v: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uAxis: [0, 0, 1],
    vAxis: [0, 1, 0],
  },
  // +Z
  {
    n: [0, 0, 1],
    v: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
  },
  // -Z
  {
    n: [0, 0, -1],
    v: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
  },
];

function isSolid(state: MatchState, x: number, y: number, z: number, cut: boolean): number {
  if (cut && x >= 13) return 0;
  return get(state.grid, x, y, z) ? 1 : 0;
}

/**
 * Computes baked per-vertex Ambient Occlusion (0.52..1.0) so tunnels,
 * overhangs, and sculpted cavities show lush natural sand shadows.
 */
function vertexAO(
  state: MatchState,
  x: number,
  y: number,
  z: number,
  n: [number, number, number],
  vx: number,
  vy: number,
  vz: number,
  cut: boolean,
): number {
  const sx = vx === 0 ? -1 : 1;
  const sy = vy === 0 ? -1 : 1;
  const sz = vz === 0 ? -1 : 1;

  let side1 = 0;
  let side2 = 0;
  let corner = 0;

  if (n[1] !== 0) {
    const ny = y + n[1];
    side1 = isSolid(state, x + sx, ny, z, cut);
    side2 = isSolid(state, x, ny, z + sz, cut);
    corner = isSolid(state, x + sx, ny, z + sz, cut);
  } else if (n[0] !== 0) {
    const nx = x + n[0];
    side1 = isSolid(state, nx, y + sy, z, cut);
    side2 = isSolid(state, nx, y, z + sz, cut);
    corner = isSolid(state, nx, y + sy, z + sz, cut);
  } else {
    const nz = z + n[2];
    side1 = isSolid(state, x + sx, y, nz, cut);
    side2 = isSolid(state, x, y + sy, nz, cut);
    corner = isSolid(state, x + sx, y + sy, nz, cut);
  }

  const occ = side1 && side2 ? 3 : side1 + side2 + corner;
  // Softly darken ground-contact layer as well
  const groundOcc = y === 0 && vy === 0 ? 0.08 : 0;
  return Math.max(0.48, 1.0 - occ * 0.145 - groundOcc);
}

/**
 * Builds a single merged BufferGeometry for the entire 25x17x25 sand mound
 * centered horizontally around (0, y, 0) in local pile space (x - 12.5, y, z - 12.5).
 * Uses world-space UV mapping (zero per-voxel tile seam) + baked Vertex AO + subtle grain variation.
 */
export function buildPileGeometry(state: MatchState, cut: boolean): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let vertCount = 0;
  const uvScale = 0.24;

  for (let y = 0; y < H; y++) {
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        if (!get(state.grid, x, y, z) || (cut && x >= 13)) continue;
        const level = amount(state, index(x, y, z)) / 10;

        // Per-voxel organic warm/cool micro-tint (0.93..1.05) + subtle height gradient
        const grainHash = ((x * 37 + y * 19 + z * 53) & 31) / 31;
        const heightLight = 0.91 + (y / H) * 0.14;
        const baseTint = (0.95 + grainHash * 0.09) * heightLight;

        for (let fi = 0; fi < FACES.length; fi++) {
          const f = FACES[fi];
          const [nx, ny, nz] = f.n;
          const neighborLevel =
            inside(x + nx, y + ny, z + nz) && !(cut && x + nx >= 13)
              ? amount(state, index(x + nx, y + ny, z + nz)) / 10
              : 0;

          if (neighborLevel >= level && !(ny === 1 && level < 1)) continue;

          // Subtle cross-section highlight on the cut plane (x===12, +X face)
          const isCutFace = cut && x === 12 && nx === 1;

          const aos: [number, number, number, number] = [1, 1, 1, 1];
          for (let vi = 0; vi < 4; vi++) {
            const [vx, vy, vz] = f.v[vi];
            const px = x + vx - 12.5;
            const py = y + vy * level;
            const pz = z + vz - 12.5;

            positions.push(px, py, pz);
            normals.push(nx, ny, nz);

            // Continuous world-space UV mapping so texture flows smoothly across voxels
            const u = (px * f.uAxis[0] + py * f.uAxis[1] + pz * f.uAxis[2]) * uvScale;
            const v = (px * f.vAxis[0] + py * f.vAxis[1] + pz * f.vAxis[2]) * uvScale;
            uvs.push(u, v);

            const ao = vertexAO(state, x, y, z, f.n, vx, vy, vz, cut);
            aos[vi] = ao;

            const shade = baseTint * ao;
            if (isCutFace) {
              // Slightly warmer, clearer interior cross-section tint
              colors.push(Math.min(1, shade * 1.02), shade * 0.93, shade * 0.84);
            } else {
              colors.push(Math.min(1, shade), Math.min(1, shade), Math.min(1, shade * 0.98));
            }
          }

          // Flip quad diagonal based on AO to prevent anisotropy artifacts
          if (aos[0] + aos[2] > aos[1] + aos[3]) {
            indices.push(vertCount, vertCount + 1, vertCount + 2, vertCount, vertCount + 2, vertCount + 3);
          } else {
            indices.push(vertCount + 1, vertCount + 2, vertCount + 3, vertCount + 1, vertCount + 3, vertCount);
          }
          vertCount += 4;
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}
