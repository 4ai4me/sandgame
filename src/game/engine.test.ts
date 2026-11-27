import test from 'node:test';
import assert from 'node:assert/strict';
import {
  amount,
  carve,
  create,
  decode,
  encode,
  endTurn,
  environment,
  flagContact,
  flagPlan,
  get,
  grams,
  harvestGrams,
  index,
  mass,
  properties,
  seconds,
  settle,
  support,
} from './engine';
import { TOOLS } from './content';
import { chooseAiMove } from './ai';

test('deterministic terrain & stable initial flag across 50 seeds', () => {
  const a = create('SAND-TEST-1', 600, 45, { variant: 'v1' });
  const b = create('SAND-TEST-1', 600, 45, { variant: 'v1' });
  assert.deepEqual(a.grid, b.grid);
  assert.equal(a.flag.embed, b.flag.embed);
  assert.equal(a.flag.design, b.flag.design);

  let sumRatio = 0;
  let floorBurials = 0;
  for (let i = 0; i < 50; i++) {
    const s = create(`SEED-${i}`, 600, 45, { variant: `var-${i}` });
    const plan = flagPlan(s);
    assert.equal(plan.fall, false, `seed ${i} should start stable`);
    assert.ok(s.flag.embed >= s.pileHeight / 7 - 1e-6);
    sumRatio += s.flag.embed / s.pileHeight;
    if (s.flag.root === 0) floorBurials++;
  }
  assert.ok(sumRatio / 50 > 0.35, 'mean burial ratio should be deep');
  assert.ok(floorBurials > 0, 'some flags should reach floor');
});

test('partial mining mass conservation: 10 needle clicks exhaust 1 grain', () => {
  const s = create('PARTIAL-1', 600, 45, { variant: 'p1', sediment: 'sand' });
  // Find a top exposed voxel away from the flag
  let tx = 6;
  let tz = 12;
  let ty = 0;
  for (let y = 16; y >= 0; y--) {
    if (get(s.grid, tx, y, tz)) {
      ty = y;
      break;
    }
  }
  const idx = index(tx, ty, tz);
  assert.equal(amount(s, idx), 10);

  const initialMass = mass(s);
  let totalHarvest = 0;
  for (let i = 0; i < 10; i++) {
    const taken = carve(s, [tx + 0.5, ty + 0.9, tz + 0.5], [0, -1, 0], 'needle', TOOLS.needle.batch);
    assert.equal(taken, 0.1);
    totalHarvest = Math.round((totalHarvest + taken) * 10) / 10;
  }
  assert.equal(totalHarvest, 1);
  assert.equal(amount(s, idx), 0);
  assert.ok(Math.abs(mass(s) - (initialMass - 1)) < 1e-6);
});

test('settle preserves total mass and records collapse moves', () => {
  const s = create('COLLAPSE-1', 600, 45, { variant: 'c1', sediment: 'gravel' });
  // Carve a wide cavity at the base so gravel above collapses
  const taken = carve(s, [12.5, 1.5, 12.5], [0, 0, -1], 'bothhands', TOOLS.bothhands.batch);
  assert.ok(taken > 0);
  const massBeforeSettle = mass(s);
  const result = settle(s);
  assert.ok(result.moved > 0, 'gravel ceiling should collapse');
  assert.ok(result.moves.length > 0, 'collapse moves should be recorded for 3D animation');
  assert.ok(Math.abs(mass(s) - massBeforeSettle) < 1e-6, 'settle must preserve exact mass');
});

test('material physics off neutralizes sediment differences', () => {
  const clayOn = create('MAT-1', 600, 45, { sediment: 'clay', materialPhysics: true });
  const gravelOn = create('MAT-1', 600, 45, { sediment: 'gravel', materialPhysics: true });
  assert.ok(properties(clayOn).bridge > properties(gravelOn).bridge);
  assert.ok(harvestGrams(gravelOn, 1) > harvestGrams(clayOn, 1) * 0.9);

  const clayOff = create('MAT-1', 600, 45, { sediment: 'clay', materialPhysics: false });
  const gravelOff = create('MAT-1', 600, 45, { sediment: 'gravel', materialPhysics: false });
  assert.equal(properties(clayOff).bridge, properties(gravelOff).bridge);
  assert.equal(harvestGrams(clayOff, 1), harvestGrams(gravelOff, 1));
});

test('flag loses support when surrounding shaft is cleared and detects floor contact', () => {
  const s = create('KO-TEST', 600, 45, { variant: 'ko1' });
  for (let i = 0; i < s.grid.length; i++) {
    s.grid[i] = 0;
    s.fill[i] = 0;
  }
  const sup = support(s);
  assert.equal(sup.count, 0);
  const plan = flagPlan(s);
  assert.equal(plan.fall, true);
  s.flag.drop = s.flag.root + 0.1;
  assert.equal(flagContact(s, Math.PI / 2, plan.direction), true);
});

test('scoring, turns, KO, and save roundtrip validation', () => {
  const s = create('SCORE-1', 600, 45, { variant: 's1', playMode: 'tabletop' });
  const res1 = endTurn(s, 3.5, false, 'hand');
  assert.equal(res1, null);
  assert.equal(s.player, 1);
  assert.equal(s.turn, 2);
  assert.ok(grams(s, s.scores[0]) > 2.4);
  assert.equal(s.history.length, 1);

  const encoded = encode(s);
  const restored = decode(encoded);
  assert.deepEqual(restored.grid, s.grid);
  assert.deepEqual(restored.fill, s.fill);
  assert.deepEqual(restored.scores, s.scores);
  assert.equal(restored.playMode, 'tabletop');

  // KO blames current actor (player 1) -> player 0 wins
  const koRes = endTurn(restored, 1.0, true, 'bothhands');
  assert.deepEqual(koRes, { winner: 0, reason: 'ko', actor: 1 });

  // Corrupt save throws
  assert.throws(() => decode('{"version":99}'));
  assert.throws(() => seconds('abc', 1));
  assert.equal(seconds('2.5', 60), 150);
});

test('environment cycles deterministically', () => {
  const s = create('ENV-1', 600, 45, { time: 'cycle', season: 'cycle', weather: 'auto' });
  const e0 = environment(s);
  assert.equal(e0.season, 'spring');
  assert.equal(e0.weather, 'clear');
  s.environment.elapsed = 70;
  const e1 = environment(s);
  assert.equal(e1.weather, 'rain');
  assert.ok(e1.wetness > 0);
});

test('AI chooses valid deterministic moves across difficulties', () => {
  for (const diff of ['easy', 'normal', 'hard'] as const) {
    const s = create('AI-SEED', 600, 45, { playMode: 'ai', aiDifficulty: diff });
    const plan = chooseAiMove(s, diff);
    assert.ok(plan, `AI (${diff}) should find a valid move`);
    assert.ok(plan.pulses >= 1);
    assert.ok(plan.expectedGrams > 0);
    const taken = carve(s, plan.point, plan.dir, plan.tool, TOOLS[plan.tool].batch);
    assert.ok(taken > 0, `AI (${diff}) target point must carve real sand`);
  }
});

test('random setup options resolve deterministically and roundtrip via encode/decode', () => {
  const a = create('RAND-SETUP-1', 600, 45, {
    stage: 'random',
    sediment: 'random',
    time: 'random',
    season: 'random',
    weather: 'random',
  });
  const b = create('RAND-SETUP-1', 600, 45, {
    stage: 'random',
    sediment: 'random',
    time: 'random',
    season: 'random',
    weather: 'random',
  });
  assert.equal(a.stage, b.stage);
  assert.equal(a.sediment, b.sediment);
  assert.deepEqual(a.environment, b.environment);
  assert.notEqual(a.sediment as string, 'random');
  assert.notEqual(a.environment.time as string, 'random');
  assert.notEqual(a.environment.season as string, 'random');
  assert.notEqual(a.environment.weather as string, 'random');

  const restored = decode(encode(a));
  assert.equal(restored.stage, a.stage);
  assert.equal(restored.sediment, a.sediment);
  assert.deepEqual(restored.environment, a.environment);
});

