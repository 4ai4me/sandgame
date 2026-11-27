export type ToolId = 'broom' | 'finger' | 'needle' | 'toothpick' | 'hand' | 'bothhands';

export type StageId =
  | 'beach'
  | 'playground'
  | 'ssireum'
  | 'ocean-ship'
  | 'river-boat'
  | 'desert'
  | 'garden'
  | 'school'
  | 'village'
  | 'quarry'
  | 'forest'
  | 'ruins';

export type SedimentId =
  | 'sand'
  | 'fine-sand'
  | 'wet-sand'
  | 'gravel'
  | 'silt'
  | 'loam'
  | 'clay'
  | 'wet-clay';

export type FlagDesignId =
  | 'strawhat'
  | 'heart'
  | 'redhair'
  | 'whitebeard'
  | 'blackbeard'
  | 'roger'
  | 'buggy'
  | 'sun';

export type PoleMaterialId = 'twig' | 'chopstick' | 'steel' | 'cue' | 'bamboo' | 'plastic';

export type TimeMode = 'cycle' | 'day' | 'night';
export type SeasonMode = 'cycle' | 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherMode = 'auto' | 'clear' | 'rain' | 'snow' | 'wind';
export type ResolvedSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type ResolvedWeather = 'clear' | 'rain' | 'snow' | 'wind';

export type PlayMode = 'tabletop' | 'local' | 'ai';
export type AiDifficulty = 'easy' | 'normal' | 'hard';
export type AppScreen = 'title' | 'playing' | 'paused' | 'gameover';
export type GamePhase = 'observe' | 'dig' | 'settle' | 'ai-thinking' | 'ai-dig';

export interface ToolSpec {
  id: ToolId;
  radius: number;
  depth: number;
  batch: number;
  interval: number;
  label: string;
  shortRole: string;
  hint: string;
  keyHint: string;
}

export interface StageSpec {
  id: StageId;
  name: string;
  tag: string;
  sky: string;
  haze: string;
  ground: string;
  sand: [number, number, number];
  track: string;
  water?: string;
  motion?: number;
  ambient?: 'ocean' | 'breeze' | 'calm';
}

export interface TrackSpec {
  id: string;
  name: string;
  bpm: number;
  root: number;
  voice: OscillatorType;
  bass: number[];
  notes: (number | null)[];
  drum?: number;
}

export interface FlagSpec {
  id: FlagDesignId;
  name: string;
  background: string;
  accent: string;
}

export interface PoleMaterialSpec {
  id: PoleMaterialId;
  name: string;
  color: string;
  density: number;
  grip: number;
  roughness: number;
  metalness: number;
}

export interface SedimentSpec {
  id: SedimentId;
  name: string;
  color: [number, number, number];
  density: number;
  cohesion: number;
  friction: number;
  erosion: number;
  wetGain: number;
  roughness: number;
  bumpScale: number;
}

export interface FlagState {
  root: number;
  x: number;
  z: number;
  length: number;
  embed: number;
  angle: number;
  initialAngle: number;
  initialDirection: number;
  direction: number;
  diameter: number;
  material: PoleMaterialId;
  color: string;
  density: number;
  grip: number;
  design: FlagDesignId;
  drop: number;
  initialSupport: number;
}

export interface EnvironmentConfig {
  elapsed: number;
  time: TimeMode;
  season: SeasonMode;
  weather: WeatherMode;
}

export interface EnvironmentSnapshot {
  season: ResolvedSeason;
  weather: ResolvedWeather;
  daylight: number;
  wetness: number;
  wind: number;
  windDirection: number;
  windStrength: number;
}

export interface TurnHistoryEntry {
  turn: number;
  player: 0 | 1;
  grams: number;
  ko: boolean;
  tool?: ToolId;
}

export interface MatchResult {
  winner: 0 | 1 | null;
  reason: 'ko' | 'weight' | 'environment';
  actor?: 0 | 1;
}

export interface MatchState {
  version: number;
  physics: 'sand-voxel-1' | 'sand-voxel-2' | 'sand-voxel-3';
  seed: string;
  variant: string;
  stage: StageId;
  grid: Uint8Array;
  fill: Uint8Array;
  scores: [number, number];
  turns: [number, number];
  player: 0 | 1;
  turn: number;
  remaining: number;
  turnRemaining: number;
  duration: number;
  turnDuration: number;
  flag: FlagState;
  expired: boolean;
  result: MatchResult | null;
  history: TurnHistoryEntry[];
  pilePercent: number;
  sediment: SedimentId;
  materialPhysics: boolean;
  turnStarted: boolean;
  pileHeight: number;
  environment: EnvironmentConfig;
  playMode: PlayMode;
  aiDifficulty: AiDifficulty;
}

export interface CreateOptions {
  variant?: string;
  stage?: StageId | 'random';
  previousDesign?: FlagDesignId;
  pilePercent?: number;
  sediment?: SedimentId | 'random';
  materialPhysics?: boolean;
  time?: TimeMode | 'random';
  season?: SeasonMode | 'random';
  weather?: WeatherMode | 'random';
  playMode?: PlayMode;
  aiDifficulty?: AiDifficulty;
}

export interface SupportInfo {
  count: number;
  ratio: number;
  sx: number;
  sz: number;
  contacts: number;
}

export interface FlagPlan {
  fall: boolean;
  direction: number;
  angle: number;
  support: number;
  rootContact: number;
}

export interface CollapseMove {
  from: [number, number, number];
  to: [number, number, number];
  fill: number;
}

export interface SettleResult {
  moved: number;
  passes: number;
  moves: CollapseMove[];
}

export interface CarveHit {
  point: [number, number, number];
  dir: [number, number, number];
  taken: number;
  cells: [number, number, number][];
}

export interface AiMovePlan {
  tool: ToolId;
  point: [number, number, number];
  dir: [number, number, number];
  pulses: number;
  expectedGrams: number;
  predictedRisk: number;
}
