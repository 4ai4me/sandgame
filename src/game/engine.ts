import { FLAGS, POLE_MATERIALS, SEDIMENTS, STAGES, TOOLS } from './content';
import type {
  CollapseMove,
  CreateOptions,
  EnvironmentConfig,
  EnvironmentSnapshot,
  FlagPlan,
  MatchResult,
  MatchState,
  SedimentSpec,
  SettleResult,
  SupportInfo,
  ToolId,
} from './types';

export const N = 25;
export const H = 17;
export const SIZE = N * N * H;
export const VERSION = 3;
export const PHYSICS = 'sand-voxel-3' as const;

export const index = (x: number, y: number, z: number): number => x + N * (z + N * y);

export const inside = (x: number, y: number, z: number): boolean =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  Number.isInteger(z) &&
  x >= 0 &&
  x < N &&
  y >= 0 &&
  y < H &&
  z >= 0 &&
  z < N;

export const get = (g: Uint8Array, x: number, y: number, z: number): number =>
  inside(x, y, z) ? g[index(x, y, z)] : 0;

export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return h >>> 0;
}

export function rng(seed: string): () => number {
  let s = hash(seed);
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const valid = (x: unknown, a: number, b: number): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= a && x <= b;

export function seconds(value: string | number, unit: string | number = 1): number {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    String(value).trim() === '' ||
    ![1, 60, 3600].includes(Number(unit))
  ) {
    throw new Error('시간과 단위를 확인하세요.');
  }
  const result = Number(value) * Number(unit);
  if (!valid(result, 0, 86400) || Math.abs(result - Math.round(result)) > 1e-7) {
    throw new Error('시간은 0~24시간 범위에서 정수 초로 환산되어야 합니다. 0은 무제한입니다.');
  }
  return Math.round(result);
}

export const is3 = (s: MatchState): boolean => s.physics === PHYSICS;

export const material = (s: MatchState): SedimentSpec =>
  SEDIMENTS.find((m) => m.id === s.sediment) || SEDIMENTS[0];

export const factor = (s: MatchState): number => Math.cbrt((s.pilePercent || 100) / 100);

export const amount = (s: MatchState, i: number): number =>
  s.grid[i] ? (is3(s) ? s.fill[i] : 10) : 0;

export const mass = (s: MatchState): number => {
  let total = 0;
  for (let i = 0; i < SIZE; i++) {
    if (s.grid[i]) total += amount(s, i);
  }
  return total / 10;
};

export const unitMass = (s: MatchState): number =>
  Math.round(70000 * ((s.pilePercent || 100) / 100) * (s.materialPhysics === false ? 1 : material(s).density));

export const grams = (s: MatchState, score: number): number => score / (is3(s) ? 1e6 : 10);

export const harvestGrams = (s: MatchState, n: number): number =>
  is3(s) ? (Math.round(n * 10) * unitMass(s)) / 1e6 : n * 0.7;

export function formatGrams(g: number): string {
  if (g >= 100) return g.toFixed(1);
  if (g >= 10) return g.toFixed(2).replace(/0$/, '');
  if (g >= 0.1 || g === 0) return g.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return g.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export function checkEnvironment(e: EnvironmentConfig): void {
  if (
    !e ||
    !valid(e.elapsed, 0, 1e9) ||
    !['cycle', 'day', 'night'].includes(e.time) ||
    !['cycle', 'spring', 'summer', 'autumn', 'winter'].includes(e.season) ||
    !['auto', 'clear', 'rain', 'snow', 'wind'].includes(e.weather)
  ) {
    throw new Error('시간·계절·날씨 설정이 올바르지 않습니다.');
  }
}

export function environment(s: MatchState): EnvironmentSnapshot {
  const e = s.environment || { elapsed: 0, time: 'day', season: 'summer', weather: 'clear' };
  const t = e.elapsed;
  const season =
    e.season === 'cycle'
      ? (['spring', 'summer', 'autumn', 'winter'] as const)[Math.floor(t / 180) % 4]
      : e.season;
  const weather =
    e.weather === 'auto'
      ? Math.floor(t / 60) % 3 === 1
        ? season === 'winter'
          ? 'snow'
          : 'rain'
        : Math.floor(t / 60) % 3 === 2
          ? 'wind'
          : 'clear'
      : e.weather;
  const daylight =
    e.time === 'cycle' ? 0.5 + 0.5 * Math.cos((t * Math.PI) / 60) : e.time === 'night' ? 0 : 1;
  const wetness =
    weather === 'rain'
      ? Math.min(1, ((e.weather === 'auto' ? t % 60 : t) + 15) / 60)
      : material(s).id.startsWith('wet')
        ? 0.6
        : 0;
  const wind = weather === 'wind' ? 1 : weather === 'rain' ? 0.48 : weather === 'snow' ? 0.25 : 0.12;
  const windDirection =
    (hash(`${s.seed}|wind`) / 4294967296) * Math.PI * 2 + Math.sin(t / 37) * 0.65;
  const windStrength = wind * (0.82 + 0.18 * Math.sin(t * 1.3));
  return { season, weather, daylight, wetness, wind, windDirection, windStrength };
}

export function properties(s: MatchState) {
  if (s.materialPhysics === false) {
    return { ...SEDIMENTS[0], bridge: 2, repose: 2, stress: 0, shake: 0 };
  }
  const m = material(s);
  const e = environment(s);
  const saturated = e.wetness > 0.8 && ['silt', 'clay', 'wet-clay', 'loam'].includes(m.id);
  const shake = s.stage === 'ocean-ship' ? 0.65 : s.stage === 'river-boat' ? 0.3 : 0;
  return {
    ...m,
    bridge: Math.max(
      0,
      Math.min(5, Math.floor(m.cohesion + m.wetGain * e.wetness - (saturated ? 2 : 0) + (e.weather === 'snow' ? 0.6 : 0))),
    ),
    repose: Math.max(1, m.friction - (saturated ? 1 : 0)),
    stress: e.wind * m.erosion + shake / (m.friction + 1),
    shake,
  };
}

export function cloneState(s: MatchState): MatchState {
  return {
    ...s,
    grid: Uint8Array.from(s.grid),
    fill: Uint8Array.from(s.fill),
    scores: [s.scores[0], s.scores[1]],
    turns: [s.turns[0], s.turns[1]],
    flag: { ...s.flag },
    environment: { ...s.environment },
    result: s.result ? { ...s.result } : null,
    history: s.history.map((h) => ({ ...h })),
  };
}

export function create(
  seed = 'SAND-0909',
  duration = 600,
  turnDuration = 45,
  options: CreateOptions = {},
): MatchState {
  if (
    typeof seed !== 'string' ||
    !seed.trim() ||
    seed.length > 32 ||
    !Number.isInteger(duration) ||
    !valid(duration, 0, 86400) ||
    !Number.isInteger(turnDuration) ||
    !valid(turnDuration, 0, 86400)
  ) {
    throw new Error('경기 설정이 올바르지 않습니다.');
  }
  const variant = options.variant ?? seed;
  if (typeof variant !== 'string' || !variant.length || variant.length > 80) {
    throw new Error('새 경기 번호가 올바르지 않습니다.');
  }
  if (options.stage && options.stage !== 'random' && !STAGES.some((st) => st.id === options.stage)) {
    throw new Error('알 수 없는 장소입니다.');
  }
  const percent = options.pilePercent ?? 100;
  const sediment = options.sediment ?? 'sand';
  if (options.materialPhysics !== undefined && typeof options.materialPhysics !== 'boolean') {
    throw new Error('재질 물리 설정이 올바르지 않습니다.');
  }
  if (!Number.isInteger(percent) || !valid(percent, 50, 1700) || !SEDIMENTS.some((m) => m.id === sediment)) {
    throw new Error('더미 규모는 50~1700의 정수, 재질은 목록에서 선택하세요.');
  }
  const env: EnvironmentConfig = {
    elapsed: 0,
    time: options.time ?? 'cycle',
    season: options.season ?? 'cycle',
    weather: options.weather ?? 'auto',
  };
  checkEnvironment(env);

  const random = rng(seed);
  const g = new Uint8Array(SIZE);
  const moundHeight = 11 + Math.floor(random() * 2);
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const r = Math.hypot(x - 12, z - 12);
      const top = Math.max(0, Math.floor(moundHeight * Math.pow(Math.max(0, 1 - r / 12), 0.8)));
      for (let y = 0; y < top; y++) {
        g[index(x, y, z)] = 1;
      }
    }
  }

  const roll = rng(`${seed}|${variant}`);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(roll() * arr.length)];
  const stage =
    options.stage && options.stage !== 'random' ? options.stage : pick(STAGES).id;
  const poleMat = pick(POLE_MATERIALS);
  const flagPool = FLAGS.filter((f) => f.id !== options.previousDesign);
  const design = pick(flagPool.length ? flagPool : FLAGS).id;
  const diameter = 0.08 + roll() * 0.14;
  const poleColors = [poleMat.color, '#926748', '#bf9159', '#adb7c2', '#647961', '#c7684b'];

  const s: MatchState = {
    version: VERSION,
    physics: PHYSICS,
    seed: seed.trim(),
    variant,
    stage,
    grid: g,
    fill: Uint8Array.from(g, (v) => v * 10),
    scores: [0, 0],
    turns: [0, 0],
    player: 0,
    turn: 1,
    remaining: duration,
    turnRemaining: turnDuration,
    duration,
    turnDuration,
    flag: {
      root: 0,
      x: 12.5,
      z: 12.5,
      length: 10,
      embed: 4,
      angle: 0,
      initialAngle: 0,
      initialDirection: 0,
      direction: 0,
      diameter,
      material: poleMat.id,
      color: pick(poleColors),
      density: poleMat.density,
      grip: poleMat.grip,
      design,
      drop: 0,
      initialSupport: 1,
    },
    expired: false,
    result: null,
    history: [],
    pilePercent: percent,
    sediment,
    materialPhysics: options.materialPhysics ?? true,
    turnStarted: false,
    pileHeight: moundHeight,
    environment: env,
    playMode: options.playMode ?? 'tabletop',
    aiDifficulty: options.aiDifficulty ?? 'normal',
  };

  settle(s, { initial: true });

  let height = 0;
  let peakX = 12;
  let peakZ = 12;
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        if (
          get(s.grid, x, y, z) &&
          (y + 1 > height ||
            (y + 1 === height && Math.hypot(x - 12, z - 12) < Math.hypot(peakX - 12, peakZ - 12)))
        ) {
          height = y + 1;
          peakX = x;
          peakZ = z;
        }
      }
    }
  }

  const burialRoll = rng(`${seed}|${s.variant}|burial`);
  const embed = height * (burialRoll() < 0.18 ? 1 : 1 / 7 + (6 / 7) * burialRoll() * burialRoll());
  const angle = burialRoll() * 0.18;
  const direction = burialRoll() * Math.PI * 2;
  const f = s.flag;
  Object.assign(f, {
    root: Math.max(0, height - embed * Math.cos(angle)),
    x: peakX + 0.5 - Math.cos(direction) * Math.sin(angle) * embed,
    z: peakZ + 0.5 - Math.sin(direction) * Math.sin(angle) * embed,
    embed,
    length: embed + 4 + burialRoll() * 5,
    angle,
    initialAngle: angle,
    initialDirection: direction,
    direction,
    drop: 0,
  });

  if (embed === height) {
    f.root = 0;
    f.initialAngle = f.angle = 0;
    f.x = peakX + 0.5;
    f.z = peakZ + 0.5;
  }

  f.initialSupport = support(s).count;
  s.pileHeight = height;

  if (!f.initialSupport || flagPlan(s).fall) {
    throw new Error('안정적인 매립 위치를 만들지 못했습니다.');
  }
  return s;
}

export function support(s: MatchState): SupportInfo {
  const f = s.flag;
  if (!is3(s)) {
    const cx = Math.floor(f.x ?? 12.5);
    const cz = Math.floor(f.z ?? 12.5);
    let count = 0;
    let sx = 0;
    let sz = 0;
    for (let y = Math.max(0, Math.floor(f.root) - 2); y < Math.min(H, Math.floor(f.root) + 3); y++) {
      for (let z = cz - 2; z <= cz + 2; z++) {
        for (let x = cx - 2; x <= cx + 2; x++) {
          if (get(s.grid, x, y, z)) {
            count++;
            sx += x - cx;
            sz += z - cz;
          }
        }
      }
    }
    return { count, ratio: Math.min(1, count / (f.initialSupport || count || 1)), sx, sz, contacts: count > 0 ? 1 : 0 };
  }

  let count = 0;
  let sx = 0;
  let sz = 0;
  let contacts = 0;
  const direction = f.initialDirection;
  for (let t = 0.1; t < f.embed; t += 0.4) {
    const cx = f.x + Math.cos(direction) * Math.sin(f.initialAngle) * t;
    const cz = f.z + Math.sin(direction) * Math.sin(f.initialAngle) * t;
    const cy = f.root + Math.cos(f.initialAngle) * t;
    let section = 0;
    for (let z = Math.floor(cz) - 1; z <= Math.floor(cz) + 1; z++) {
      for (let x = Math.floor(cx) - 1; x <= Math.floor(cx) + 1; x++) {
        const y = Math.floor(cy);
        if (!inside(x, y, z)) continue;
        const weight = amount(s, index(x, y, z)) / 10;
        section += weight;
        sx += (x + 0.5 - cx) * weight;
        sz += (z + 0.5 - cz) * weight;
      }
    }
    count += section;
    if (section > 1) contacts++;
  }
  return { count, ratio: Math.min(1, count / (f.initialSupport || count || 1)), sx, sz, contacts };
}

export function carve(
  s: MatchState,
  point: [number, number, number],
  dir: [number, number, number],
  tool: ToolId,
  remaining: number,
): number {
  if (
    !TOOLS[tool] ||
    !Array.isArray(point) ||
    !Array.isArray(dir) ||
    point.length !== 3 ||
    dir.length !== 3 ||
    ![...point, ...dir].every(Number.isFinite) ||
    Math.hypot(...dir) < 0.001 ||
    !valid(remaining, 0, SIZE)
  ) {
    throw new Error('잘못된 채굴 입력입니다.');
  }

  const length = Math.hypot(...dir);
  const ndir: [number, number, number] = [dir[0] / length, dir[1] / length, dir[2] / length];
  const t = TOOLS[tool];
  const hits: { i: number; d: number }[] = [];
  const bound = t.radius + t.depth;

  for (let y = Math.max(0, Math.floor(point[1] - bound)); y < Math.min(H, point[1] + bound + 1); y++) {
    for (let z = Math.max(0, Math.floor(point[2] - bound)); z < Math.min(N, point[2] + bound + 1); z++) {
      for (let x = Math.max(0, Math.floor(point[0] - bound)); x < Math.min(N, point[0] + bound + 1); x++) {
        if (!get(s.grid, x, y, z)) continue;
        const dx = x + 0.5 - point[0];
        const dy = y + 0.5 - point[1];
        const dz = z + 0.5 - point[2];
        const along = dx * ndir[0] + dy * ndir[1] + dz * ndir[2];
        const radial = dx * dx + dy * dy + dz * dz - along * along;
        if (along >= -0.8 && along <= t.depth && radial < (t.radius + 0.25) ** 2) {
          hits.push({ i: index(x, y, z), d: along + Math.sqrt(Math.max(0, radial)) });
        }
      }
    }
  }

  if (!hits.length) {
    const [fx, fy, fz] = point.map(Math.floor);
    if (get(s.grid, fx, fy, fz)) hits.push({ i: index(fx, fy, fz), d: 0 });
  }
  hits.sort((a, b) => a.d - b.d || a.i - b.i);

  if (!is3(s)) {
    const limit = tool === 'needle' ? 1 : tool === 'toothpick' ? 3 : Math.floor(remaining);
    const taken = hits.slice(0, limit);
    for (const v of taken) {
      s.grid[v.i] = 0;
      s.fill[v.i] = 0;
    }
    return taken.length;
  }

  let budget = Math.round(
    Math.min(remaining, tool === 'needle' ? 0.1 : tool === 'toothpick' ? 0.2 : remaining) * 10,
  );
  let taken = 0;
  for (const hit of hits) {
    if (!budget) break;
    const n = Math.min(amount(s, hit.i), budget);
    s.fill[hit.i] -= n;
    if (!s.fill[hit.i]) s.grid[hit.i] = 0;
    taken += n;
    budget -= n;
  }
  return taken / 10;
}

export function settle(
  s: MatchState,
  opts: { initial?: boolean; disturbance?: boolean } = {},
): SettleResult {
  const { initial = false, disturbance = false } = opts;
  const p = is3(s) ? properties(s) : { bridge: 2, repose: 2, stress: 0 };
  const g = s.grid;
  let moved = 0;
  let passes = 0;
  const moves: CollapseMove[] = [];

  const move = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
    const a = index(ax, ay, az);
    const b = index(bx, by, bz);
    const fVal = s.fill[a];
    g[b] = 1;
    s.fill[b] = fVal;
    g[a] = 0;
    s.fill[a] = 0;
    moved++;
    if (!initial && moves.length < 300) {
      moves.push({ from: [ax, ay, az], to: [bx, by, bz], fill: fVal });
    }
  };

  for (let pass = 0; pass < H; pass++) {
    let changed = 0;
    for (let y = 1; y < H; y++) {
      const dist = new Int8Array(N * N).fill(-1);
      const queue: [number, number][] = [];
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) {
          if (get(g, x, y, z) && get(g, x, y - 1, z)) {
            dist[x + N * z] = 0;
            queue.push([x, z]);
          }
        }
      }
      for (let q = 0; q < queue.length; q++) {
        const [x, z] = queue[q];
        const d = dist[x + N * z];
        if (d >= p.bridge) continue;
        const neighbors: [number, number][] = [
          [x - 1, z],
          [x + 1, z],
          [x, z - 1],
          [x, z + 1],
        ];
        for (const [nx, nz] of neighbors) {
          if (nx >= 0 && nx < N && nz >= 0 && nz < N && dist[nx + N * nz] < 0 && get(g, nx, y, nz)) {
            dist[nx + N * nz] = d + 1;
            queue.push([nx, nz]);
          }
        }
      }
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) {
          if (get(g, x, y, z) && dist[x + N * z] < 0 && !get(g, x, y - 1, z)) {
            move(x, y, z, x, y - 1, z);
            changed++;
          }
        }
      }
    }
    passes++;
    if (!changed) break;
  }

  if (is3(s)) {
    const tops = new Int8Array(N * N);
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        let y = H - 1;
        while (y >= 0 && !get(g, x, y, z)) y--;
        tops[x + N * z] = y;
      }
    }
    for (let sweep = 0; sweep < (initial ? H : 2); sweep++) {
      let changes = 0;
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) {
          const y = tops[x + N * z];
          if (y < 1) continue;
          const exposed =
            !get(g, x - 1, y, z) ||
            !get(g, x + 1, y, z) ||
            !get(g, x, y, z - 1) ||
            !get(g, x, y, z + 1);
          const kick =
            disturbance &&
            exposed &&
            (hash(`${s.seed}|${Math.floor(s.environment.elapsed / 2)}|${x},${z}`) % 1000) / 1000 <
              p.stress * 0.13;
          const limit = p.repose + Math.floor(p.bridge / 2) - (kick ? 1 : 0);
          let dest: [number, number, number] | null = null;
          const dirs: [number, number][] = [
            [x - 1, z],
            [x + 1, z],
            [x, z - 1],
            [x, z + 1],
          ];
          for (const [nx, nz] of dirs) {
            if (nx >= 0 && nx < N && nz >= 0 && nz < N) {
              const ty = tops[nx + N * nz];
              if (y - ty > Math.max(1, limit) && (!dest || ty < dest[2])) {
                dest = [nx, nz, ty];
              }
            }
          }
          if (dest) {
            const [nx, nz, ty] = dest;
            move(x, y, z, nx, ty + 1, nz);
            tops[nx + N * nz] = ty + 1;
            let ny = y - 1;
            while (ny >= 0 && !get(g, x, ny, z)) ny--;
            tops[x + N * z] = ny;
            changes++;
          }
        }
      }
      if (!changes) break;
    }
  }

  return { moved, passes, moves };
}

export function flagPlan(s: MatchState): FlagPlan {
  const p = support(s);
  const f = s.flag;
  if (!is3(s)) {
    let rootContact = 0;
    for (let t = 0; t < f.embed; t += 0.35) {
      const direction = f.initialDirection ?? f.direction;
      const x = f.x + Math.cos(direction) * Math.sin(f.initialAngle) * t;
      const z = f.z + Math.sin(direction) * Math.sin(f.initialAngle) * t;
      const y = f.root + Math.cos(f.initialAngle) * t;
      rootContact += get(s.grid, Math.floor(x), Math.floor(y), Math.floor(z));
    }
    const leverage = (f.length - f.embed) / Math.max(1, f.embed);
    const threshold = Math.min(
      0.55,
      0.14 + f.density * 0.045 + leverage * 0.022 + f.initialAngle * 0.18 - f.diameter * 0.07 - f.grip * 0.035,
    );
    const fall = p.ratio < threshold || rootContact < 1;
    const direction = Math.hypot(p.sx, p.sz) > 0 ? Math.atan2(-p.sz, -p.sx) : f.direction;
    return {
      fall,
      direction,
      angle: fall ? Math.PI / 2 : (f.initialAngle || 0) + Math.max(0, (1 - p.ratio) * 0.48),
      support: p.ratio,
      rootContact,
    };
  }

  const m = properties(s);
  const leverage = (f.length - f.embed) / Math.max(1, f.embed);
  const threshold = Math.min(0.4, 0.1 + f.density * 0.025 + leverage * 0.015 + m.stress * 0.04 - m.bridge * 0.012);
  const fall = p.ratio < threshold || p.contacts < 1;
  return {
    fall,
    direction: fall && Math.hypot(p.sx, p.sz) > 0.01 ? Math.atan2(-p.sz, -p.sx) : f.initialDirection,
    angle: fall ? Math.PI / 2 : f.initialAngle + Math.max(0, (1 - p.ratio) * 0.12),
    support: p.ratio,
    rootContact: p.contacts,
  };
}

export function flagContact(s: MatchState, angle: number, direction: number): boolean {
  const f = s.flag;
  if (angle < f.initialAngle + 0.2) return false;
  for (let t = f.embed + 0.1; t <= f.length; t += 0.12) {
    const x = f.x + Math.cos(direction) * Math.sin(angle) * t;
    const z = f.z + Math.sin(direction) * Math.sin(angle) * t;
    const y = f.root - (f.drop || 0) + Math.cos(angle) * t;
    if (y <= 0.1 || get(s.grid, Math.floor(x), Math.floor(y), Math.floor(z))) return true;
  }
  return false;
}

export const weightResult = (s: MatchState): MatchResult => ({
  winner: s.scores[0] === s.scores[1] ? null : s.scores[0] > s.scores[1] ? 0 : 1,
  reason: 'weight',
});

export function endTurn(s: MatchState, harvest: number, ko = false, tool?: ToolId): MatchResult | null {
  if (s.result) return s.result;
  const actor = s.player;
  const units = Math.round(harvest * 10);
  if (!valid(harvest, 0, SIZE) || Math.abs(harvest * 10 - units) > 1e-6) {
    throw new Error('수확량이 올바르지 않습니다.');
  }
  const score = is3(s) ? units * unitMass(s) : Math.round(harvest) * 7;
  const maxScore = is3(s) ? SIZE * 10 * unitMass(s) : SIZE * 7;
  if (!Number.isSafeInteger(score) || s.scores[0] + s.scores[1] + score > maxScore) {
    throw new Error('수확 질량을 초과했습니다.');
  }

  s.scores[actor] += score;
  s.turns[actor]++;
  s.history.push({ turn: s.turn, player: actor, grams: score, ko, tool });
  s.history = s.history.slice(-30);

  if (ko) {
    s.result = { winner: (1 - actor) as 0 | 1, reason: 'ko', actor };
  } else if ((s.expired || (s.duration > 0 && s.remaining <= 0)) && s.turns[0] === s.turns[1]) {
    s.result = weightResult(s);
  } else {
    s.player = (1 - actor) as 0 | 1;
    s.turn++;
    s.turnRemaining = s.turnDuration;
    s.turnStarted = false;
  }
  return s.result;
}

export function encode(s: MatchState): string {
  return JSON.stringify({
    ...s,
    grid: Array.from(s.grid),
    fill: Array.from(s.fill),
  });
}

export function decode(raw: string): MatchState {
  if (typeof raw !== 'string' || raw.length > 300000) {
    throw new Error('저장 크기가 올바르지 않습니다.');
  }
  const s = JSON.parse(raw);
  if (!s || ![1, 2, VERSION].includes(s.version)) {
    throw new Error('지원하지 않는 저장 버전입니다.');
  }
  if (!Array.isArray(s.grid) || s.grid.length !== SIZE || s.grid.some((v: unknown) => v !== 0 && v !== 1)) {
    throw new Error('저장된 지형 데이터가 손상되었습니다.');
  }
  if (
    typeof s.seed !== 'string' ||
    !s.seed.trim() ||
    s.seed.length > 32 ||
    ![0, 1].includes(s.player) ||
    !Number.isSafeInteger(s.turn) ||
    s.turn < 1 ||
    !Array.isArray(s.turns) ||
    s.turns.length !== 2 ||
    s.turns.some((v: unknown) => !Number.isSafeInteger(v) || (v as number) < 0) ||
    s.turns[0] < s.turns[1] ||
    s.turns[0] > s.turns[1] + 1 ||
    !valid(s.duration, 0, 86400) ||
    !valid(s.remaining, 0, s.duration) ||
    !valid(s.turnDuration, 0, 86400) ||
    !valid(s.turnRemaining, 0, s.turnDuration) ||
    typeof s.expired !== 'boolean'
  ) {
    throw new Error('저장된 경기 기본 정보가 손상되었습니다.');
  }

  // Upgrade v1/v2 legacy saves gracefully without mutating legacy physics
  if (s.version === 1 || s.version === 2) {
    if (!['sand-voxel-1', 'sand-voxel-2'].includes(s.physics)) {
      throw new Error('저장 버전과 물리 규칙이 일치하지 않습니다.');
    }
    const grid = Uint8Array.from(s.grid);
    const flag = {
      x: 12.5,
      z: 12.5,
      initialAngle: 0,
      initialDirection: 0,
      diameter: 0.14,
      material: 'twig',
      color: '#795239',
      density: 0.55,
      grip: 1.2,
      design: 'strawhat',
      drop: 0,
      ...s.flag,
    };
    return {
      ...s,
      grid,
      fill: Uint8Array.from(grid, (v) => v * 10),
      variant: s.variant || s.seed,
      stage: STAGES.some((st) => st.id === s.stage) ? s.stage : 'beach',
      flag,
      pilePercent: 100,
      sediment: 'sand',
      materialPhysics: true,
      turnStarted: false,
      pileHeight: 12,
      environment: { elapsed: 0, time: 'day', season: 'summer', weather: 'clear' },
      playMode: 'local',
      aiDifficulty: 'normal',
    };
  }

  if (
    s.physics !== PHYSICS ||
    !Array.isArray(s.fill) ||
    s.fill.length !== SIZE ||
    s.fill.some((v: unknown, i: number) => !Number.isInteger(v) || (v as number) < 0 || (v as number) > 10 || Boolean(v) !== Boolean(s.grid[i])) ||
    !Number.isInteger(s.pilePercent) ||
    !valid(s.pilePercent, 50, 1700) ||
    !SEDIMENTS.some((m) => m.id === s.sediment) ||
    !valid(s.pileHeight, 1, H)
  ) {
    throw new Error('재질 또는 부분 질량 저장이 손상되었습니다.');
  }

  checkEnvironment(s.environment);

  if (
    !Array.isArray(s.scores) ||
    s.scores.length !== 2 ||
    s.scores.some((v: unknown) => !Number.isSafeInteger(v) || (v as number) < 0) ||
    !s.flag ||
    !valid(s.flag.initialSupport, 0.01, 2000) ||
    !valid(s.flag.root, 0, H - 1) ||
    !STAGES.some((st) => st.id === s.stage) ||
    !FLAGS.some((fl) => fl.id === s.flag.design) ||
    !POLE_MATERIALS.some((pm) => pm.id === s.flag.material)
  ) {
    throw new Error('저장된 점수 또는 깃발 상태가 손상되었습니다.');
  }

  return {
    ...s,
    grid: Uint8Array.from(s.grid),
    fill: Uint8Array.from(s.fill),
    playMode: ['tabletop', 'local', 'ai'].includes(s.playMode) ? s.playMode : 'tabletop',
    aiDifficulty: ['easy', 'normal', 'hard'].includes(s.aiDifficulty) ? s.aiDifficulty : 'normal',
  };
}
