import { TOOLS } from './content';
import {
  carve,
  cloneState,
  flagPlan,
  get,
  H,
  harvestGrams,
  N,
  rng,
  settle,
  support,
} from './engine';
import type { AiDifficulty, AiMovePlan, MatchState, ToolId } from './types';

function collectSurfaceVoxels(s: MatchState): [number, number, number][] {
  const surface: [number, number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        if (!get(s.grid, x, y, z)) continue;
        const exposed =
          !get(s.grid, x, y + 1, z) ||
          !get(s.grid, x - 1, y, z) ||
          !get(s.grid, x + 1, y, z) ||
          !get(s.grid, x, y, z - 1) ||
          !get(s.grid, x, y, z + 1);
        if (exposed) surface.push([x, y, z]);
      }
    }
  }
  return surface;
}

/**
 * Deterministic AI opponent that evaluates real candidate dig actions via fast state cloning.
 * - easy: picks safer outer moves with occasional small/imperfect picks
 * - normal: balances solid harvest weight against flag stability margin
 * - hard: aggressively maximizes harvest while keeping flag right above collapse threshold
 */
export function chooseAiMove(
  state: MatchState,
  difficulty: AiDifficulty = state.aiDifficulty || 'normal',
): AiMovePlan | null {
  const surface = collectSurfaceVoxels(state);
  if (!surface.length) return null;

  const rand = rng(`${state.seed}|ai|${state.turn}|${state.scores[0]}|${state.scores[1]}`);
  const curSupport = support(state).ratio;

  // Candidate tools scaled to current flag stability
  const toolPool: ToolId[] =
    curSupport > 0.72
      ? difficulty === 'easy'
        ? ['broom', 'hand', 'finger']
        : ['bothhands', 'hand', 'broom']
      : curSupport > 0.45
        ? ['hand', 'broom', 'finger']
        : ['finger', 'toothpick', 'needle'];

  const sampleCount = difficulty === 'hard' ? 28 : difficulty === 'normal' ? 18 : 12;
  const f = state.flag;

  // Sort surface by distance from flag axis to stratify outer & mid-mound candidates
  const candidates: [number, number, number][] = [];
  for (let i = 0; i < Math.min(sampleCount, surface.length); i++) {
    const idx = Math.floor(rand() * surface.length);
    candidates.push(surface[idx]);
  }
  // Always include a few outermost safe points so AI rarely self-destructs unnecessarily
  const sortedByDist = [...surface].sort(
    (a, b) =>
      Math.hypot(b[0] + 0.5 - f.x, b[2] + 0.5 - f.z) -
      Math.hypot(a[0] + 0.5 - f.x, a[2] + 0.5 - f.z),
  );
  for (let i = 0; i < Math.min(6, sortedByDist.length); i++) {
    candidates.push(sortedByDist[i]);
  }

  let best: { plan: AiMovePlan; utility: number } | null = null;
  let fallbackSafe: { plan: AiMovePlan; utility: number } | null = null;

  for (const cell of candidates) {
    const tool = toolPool[Math.floor(rand() * toolPool.length)];
    const point: [number, number, number] = [cell[0] + 0.5, cell[1] + 0.85, cell[2] + 0.5];
    // Aim inward & downward toward mound core
    const dx = 12.5 - point[0];
    const dz = 12.5 - point[2];
    const len = Math.hypot(dx, -4.5, dz) || 1;
    const dir: [number, number, number] = [dx / len, -4.5 / len, dz / len];

    const pulses =
      tool === 'needle' || tool === 'toothpick'
        ? 2 + Math.floor(rand() * 3)
        : difficulty === 'hard'
          ? 2 + Math.floor(rand() * 2)
          : 1 + Math.floor(rand() * 2);

    const sim = cloneState(state);
    let totalTaken = 0;
    for (let p = 0; p < pulses; p++) {
      totalTaken += carve(sim, point, dir, tool, TOOLS[tool].batch);
    }
    if (totalTaken <= 0) continue;

    settle(sim);
    const planAfter = flagPlan(sim);
    const g = harvestGrams(state, totalTaken);
    const risk = 1 - planAfter.support;

    const movePlan: AiMovePlan = {
      tool,
      point,
      dir,
      pulses,
      expectedGrams: g,
      predictedRisk: risk,
    };

    if (planAfter.fall) {
      // Easy AI occasionally makes risky mistakes when support is already very low
      const allowMistake = difficulty === 'easy' && curSupport < 0.38 && rand() < 0.14;
      const utility = allowMistake ? g * 0.2 : -10000 + g;
      if (!fallbackSafe || utility > fallbackSafe.utility) {
        fallbackSafe = { plan: movePlan, utility };
      }
      continue;
    }

    const safetyBonus =
      difficulty === 'hard'
        ? planAfter.support * 12
        : difficulty === 'normal'
          ? planAfter.support * 24
          : planAfter.support * 35;

    const noise = (rand() - 0.5) * (difficulty === 'easy' ? 18 : difficulty === 'normal' ? 7 : 1.5);
    const utility = g * (difficulty === 'hard' ? 2.4 : 1.4) + safetyBonus + noise;

    if (!best || utility > best.utility) {
      best = { plan: movePlan, utility };
    }
  }

  return best?.plan ?? fallbackSafe?.plan ?? null;
}
