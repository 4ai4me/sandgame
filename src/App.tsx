import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HistoryModal, PauseModal, ResultModal, SetupModal, type SetupFormValues } from './components/GameModals';
import { StandardHud } from './components/StandardHud';
import { TabletopHud } from './components/TabletopHud';
import { TitleOverlay } from './components/TitleOverlay';
import { chooseAiMove } from './game/ai';
import { SandAudioEngine } from './game/audio';
import { STAGES, TOOL_ORDER, TOOLS } from './game/content';
import {
  carve,
  create,
  decode,
  encode,
  endTurn,
  environment,
  flagContact,
  flagPlan,
  formatGrams,
  grams,
  harvestGrams,
  material,
  settle,
  support,
  weightResult,
} from './game/engine';
import type {
  AiDifficulty,
  AiMovePlan,
  AppScreen,
  FlagPlan,
  GamePhase,
  MatchState,
  PlayMode,
  SedimentId,
  StageId,
  ToolId,
} from './game/types';
import { SandViewport, type SandViewportHandle } from './scene/SandViewport';

const SAVE_KEY = 'sand-digger.save.v3';
const BACKUP_KEY = 'sand-digger.save.v3.backup';
const LEGACY_KEYS = ['sand-digger.save.v2', 'sand-digger.save.v1'];

function randomSeed(): string {
  return `SAND-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function formatClock(sec: number, unlimited: boolean): string {
  if (unlimited) return '무제한';
  const clamped = Math.max(0, Math.ceil(sec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function loadSavedMatch(): { state: MatchState | null; corrupt: boolean } {
  if (typeof window === 'undefined') return { state: null, corrupt: false };
  const keys = [SAVE_KEY, BACKUP_KEY, ...LEGACY_KEYS];
  let sawCorrupt = false;
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const decoded = decode(raw);
      return { state: decoded, corrupt: false };
    } catch {
      sawCorrupt = true;
    }
  }
  return { state: null, corrupt: sawCorrupt };
}

function persistMatch(s: MatchState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const serialized = encode(s);
    const existing = window.localStorage.getItem(SAVE_KEY);
    if (existing) {
      try {
        // Keep last verified save in backup slot before replacing primary
        decode(existing);
        window.localStorage.setItem(BACKUP_KEY, existing);
      } catch {
        // Do not overwrite backup with corrupt payload
      }
    }
    window.localStorage.setItem(SAVE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

const SEASON_KO: Record<string, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
};

const WEATHER_KO: Record<string, string> = {
  clear: '맑음',
  rain: '비',
  snow: '눈',
  wind: '강풍',
};

interface HudSnapshot {
  activePlayer: 0 | 1;
  playMode: PlayMode;
  aiDifficulty: AiDifficulty;
  round: number;
  scoresGrams: [number, number];
  harvestGrams: number;
  supportRatio: number;
  matchClockText: string;
  turnClockText: string;
  stageName: string;
  sedimentName: string;
  environmentSummary: string;
}

function buildHudSnapshot(s: MatchState, curHarvestGrams: number): HudSnapshot {
  const stageSpec = STAGES.find((st) => st.id === s.stage) || STAGES[0];
  const matSpec = material(s);
  const env = environment(s);
  const dayText = env.daylight > 0.55 ? '낮' : env.daylight > 0.32 ? '노을' : '밤';

  return {
    activePlayer: s.player,
    playMode: s.playMode,
    aiDifficulty: s.aiDifficulty,
    round: Math.floor((s.turn - 1) / 2) + 1,
    scoresGrams: [grams(s, s.scores[0]), grams(s, s.scores[1])],
    harvestGrams: curHarvestGrams,
    supportRatio: support(s).ratio,
    matchClockText: formatClock(s.remaining, s.duration === 0),
    turnClockText: s.turnDuration > 0 ? `${Math.max(0, Math.ceil(s.turnRemaining))}초` : '턴 무제한',
    stageName: stageSpec.name,
    sedimentName: matSpec.name,
    environmentSummary: `${SEASON_KO[env.season] || '여름'} · ${dayText} · ${WEATHER_KO[env.weather] || '맑음'}`,
  };
}

interface SettleAnim {
  start: number;
  duration: number;
  fromAngle: number;
  fromDir: number;
  fromDrop: number;
  plan: FlagPlan;
  hit: boolean;
  envFall: boolean;
}

interface AiTurnState {
  stage: 'thinking' | 'digging';
  startedAt: number;
  plan: AiMovePlan | null;
  pulsesDone: number;
  nextPulseAt: number;
}

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  // Saved match check (read-only on boot so corrupt data is never silently overwritten)
  const initialSavedRef = useRef<{ state: MatchState | null; corrupt: boolean } | null>(null);
  if (initialSavedRef.current === null) {
    initialSavedRef.current = loadSavedMatch();
  }

  // Title launcher defaults — Tabletop 2P featured as default per user brief!
  const [titleMode, setTitleMode] = useState<PlayMode>('tabletop');
  const [titleAiDiff, setTitleAiDiff] = useState<AiDifficulty>('normal');
  const [titleStage, setTitleStage] = useState<StageId | 'random'>('beach');
  const [titleSediment, setTitleSediment] = useState<SedimentId | 'random'>('sand');
  const [hasSavedMatch, setHasSavedMatch] = useState<boolean>(
    Boolean(initialSavedRef.current.state && !initialSavedRef.current.state.result),
  );

  // Core mutable simulation state for 60Hz Three.js loop
  const stateRef = useRef<MatchState>(
    create(randomSeed(), 0, 0, {
      stage: 'beach',
      sediment: 'sand',
      playMode: 'tabletop',
      aiDifficulty: 'normal',
    }),
  );

  const viewportRef = useRef<SandViewportHandle | null>(null);
  const audioRef = useRef<SandAudioEngine>(new SandAudioEngine());

  // React UI state
  const [screen, setScreen] = useState<AppScreen>(initialAutostart ? 'playing' : 'title');
  const [phase, setPhase] = useState<GamePhase>('observe');
  const [activeModal, setActiveModal] = useState<'none' | 'setup' | 'history'>('none');
  const [toolP0, setToolP0] = useState<ToolId>('finger');
  const [toolP1, setToolP1] = useState<ToolId>('finger');
  const [cut, setCut] = useState(false);
  const [autoFlipTabletop, setAutoFlipTabletop] = useState(true);
  const [shipMotion, setShipMotion] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [volume, setVolume] = useState(0.32);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [hud, setHud] = useState<HudSnapshot>(() => buildHudSnapshot(stateRef.current, 0));

  // Mutable refs for 60Hz tick & callbacks without stale closures
  const screenRef = useRef<AppScreen>(screen);
  screenRef.current = screen;
  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;
  const modalRef = useRef(activeModal);
  modalRef.current = activeModal;
  const toolP0Ref = useRef(toolP0);
  toolP0Ref.current = toolP0;
  const toolP1Ref = useRef(toolP1);
  toolP1Ref.current = toolP1;

  const checkpointRef = useRef<string | null>(null);
  const harvestRef = useRef<number>(0);
  const harvestGramsRef = useRef<number>(0);
  const digToolRef = useRef<ToolId>('finger');
  const settleAnimRef = useRef<SettleAnim | null>(null);
  const aiTurnRef = useRef<AiTurnState | null>(null);
  const lastHudSyncRef = useRef<number>(0);
  const lastDisturbBucketRef = useRef<number>(0);
  const toastTimerRef = useRef<number>(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  const syncHudNow = useCallback(() => {
    setHud(buildHudSnapshot(stateRef.current, harvestGramsRef.current));
  }, []);

  const syncTrack = useCallback((s: MatchState) => {
    const st = STAGES.find((x) => x.id === s.stage) || STAGES[0];
    audioRef.current.setTrack(st.track);
  }, []);

  // Mirror screen state to body[data-state]
  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  // Warn once if a corrupt save existed on disk
  useEffect(() => {
    if (initialSavedRef.current?.corrupt && !initialSavedRef.current.state) {
      showToast('이전 저장 파일이 손상되어 새 언덕으로 준비했습니다.');
    }
    syncTrack(stateRef.current);
  }, [showToast, syncTrack]);

  // Auto-save on page hide
  useEffect(() => {
    const onHide = () => {
      if (screenRef.current === 'playing' && !stateRef.current.result) {
        persistMatch(stateRef.current);
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  // Complete a turn after settle/fall animation finishes
  const completeTurn = useCallback(
    (ko: boolean, envFall = false) => {
      const s = stateRef.current;
      const harvest = harvestRef.current;
      const usedTool = digToolRef.current;

      harvestRef.current = 0;
      harvestGramsRef.current = 0;
      checkpointRef.current = null;
      settleAnimRef.current = null;
      aiTurnRef.current = null;
      viewportRef.current?.setAiToolState(null);

      if (envFall) {
        s.result = { winner: null, reason: 'environment', actor: s.player };
      } else {
        try {
          endTurn(s, harvest, ko, usedTool);
        } catch (err) {
          showToast(err instanceof Error ? err.message : '턴 처리 중 오류가 발생했습니다.');
        }
      }

      if (s.result) {
        phaseRef.current = 'observe';
        setPhase('observe');
        setScreen('gameover');
        setHasSavedMatch(false);
        audioRef.current.playVictory();
      } else {
        phaseRef.current = 'observe';
        setPhase('observe');
        audioRef.current.playTurnSwitch();
        persistMatch(s);
        setHasSavedMatch(true);
      }
      viewportRef.current?.rebuildPile();
      syncHudNow();
    },
    [showToast, syncHudNow],
  );

  // Execute one carve pulse (shared by player hold and AI turn)
  const runCarvePulse = useCallback(
    (point: [number, number, number], dir: [number, number, number], tool: ToolId) => {
      const s = stateRef.current;
      const spec = TOOLS[tool];
      const taken = carve(s, point, dir, tool, spec.batch);
      if (taken > 0) {
        harvestRef.current = Number((harvestRef.current + taken).toFixed(4));
        harvestGramsRef.current = harvestGrams(s, harvestRef.current);
        if (!s.turnStarted && harvestGramsRef.current >= 0.001) {
          s.turnStarted = true;
        }
        viewportRef.current?.spawnHarvest(point, s.player, Math.max(4, Math.min(18, Math.round(taken * 12))));
        audioRef.current.playDig(s.sediment, tool);
        viewportRef.current?.rebuildPile();
        syncHudNow();
      }
      return taken;
    },
    [syncHudNow],
  );

  // Commit current dig -> run settle physics & flag sway/fall
  const finishDig = useCallback(() => {
    const s = stateRef.current;
    if (phaseRef.current !== 'dig' && phaseRef.current !== 'ai-dig') return;

    if (harvestRef.current <= 0) {
      checkpointRef.current = null;
      phaseRef.current = 'observe';
      setPhase('observe');
      if (s.turnDuration > 0 && s.turnRemaining <= 0) {
        completeTurn(false);
      } else {
        syncHudNow();
      }
      return;
    }

    const settled = settle(s);
    if (settled.moved > 0) {
      viewportRef.current?.spawnCollapse(settled.moves);
      viewportRef.current?.rebuildPile();
      if (settled.moved >= 3) {
        audioRef.current.playCollapse(settled.moved);
        viewportRef.current?.addTrauma(Math.min(0.65, 0.14 + settled.moved * 0.012));
      }
    }

    const plan = flagPlan(s);
    if (!plan.fall && plan.support < 0.45) {
      audioRef.current.playDangerCreak();
    }

    settleAnimRef.current = {
      start: performance.now(),
      duration: plan.fall ? 1600 : 720,
      fromAngle: s.flag.angle,
      fromDir: s.flag.direction,
      fromDrop: s.flag.drop || 0,
      plan,
      hit: false,
      envFall: false,
    };
    phaseRef.current = 'settle';
    setPhase('settle');
    syncHudNow();
  }, [completeTurn, syncHudNow]);

  // SandViewport pointer callbacks
  const handleUserInteract = useCallback(() => {
    audioRef.current.unlock();
  }, []);

  const handleDigStart = useCallback(
    (point: [number, number, number], dir: [number, number, number]) => {
      const s = stateRef.current;
      if (screenRef.current !== 'playing' || modalRef.current !== 'none') return;
      if (phaseRef.current !== 'observe' || s.result) return;
      if (s.playMode === 'ai' && s.player === 1) return;

      const activeTool = s.player === 0 ? toolP0Ref.current : toolP1Ref.current;
      checkpointRef.current = encode(s);
      harvestRef.current = 0;
      harvestGramsRef.current = 0;
      digToolRef.current = activeTool;
      phaseRef.current = 'dig';
      setPhase('dig');

      if (point[1] >= 0) {
        runCarvePulse(point, dir, activeTool);
      }
    },
    [runCarvePulse],
  );

  const handleDigPulse = useCallback(
    (point: [number, number, number], dir: [number, number, number]) => {
      if (phaseRef.current !== 'dig') return;
      runCarvePulse(point, dir, digToolRef.current);
    },
    [runCarvePulse],
  );

  const handleDigEnd = useCallback(() => {
    if (phaseRef.current !== 'dig') return;
    finishDig();
  }, [finishDig]);

  const handleDigCancel = useCallback(
    (reason: string) => {
      if (phaseRef.current !== 'dig') return;
      if (checkpointRef.current) {
        try {
          stateRef.current = decode(checkpointRef.current);
        } catch {
          // Keep current state if checkpoint somehow failed
        }
      }
      checkpointRef.current = null;
      harvestRef.current = 0;
      harvestGramsRef.current = 0;
      phaseRef.current = 'observe';
      setPhase('observe');
      viewportRef.current?.clearParticles();
      viewportRef.current?.rebuildPile();
      showToast(reason);
      syncHudNow();
    },
    [showToast, syncHudNow],
  );

  // Per-frame simulation tick driven by SandViewport's single RAF/afterDraw loop
  const handleTickFrame = useCallback(
    (dt: number, now: number) => {
      const s = stateRef.current;
      const isActivePlay = screenRef.current === 'playing' && modalRef.current === 'none';

      audioRef.current.tick(isActivePlay && !s.result);

      if (!isActivePlay || s.result) return;

      // Advance dynamic world clock (day/night/seasons/weather)
      s.environment.elapsed += dt;

      // Match timer countdown
      if (s.duration > 0) {
        s.remaining = Math.max(0, s.remaining - dt);
        if (s.remaining <= 0) {
          s.expired = true;
          if (s.turns[0] === s.turns[1] && phaseRef.current === 'observe' && !s.turnStarted) {
            s.result = weightResult(s);
            setScreen('gameover');
            setHasSavedMatch(false);
            audioRef.current.playVictory();
            syncHudNow();
            return;
          }
        }
      }

      // Turn timer countdown
      if (s.turnDuration > 0 && (phaseRef.current === 'observe' || phaseRef.current === 'dig')) {
        s.turnRemaining = Math.max(0, s.turnRemaining - dt);
        if (s.turnRemaining <= 0) {
          if (phaseRef.current === 'dig') {
            finishDig();
          } else if (!(s.playMode === 'ai' && s.player === 1)) {
            showToast('턴 제한시간이 지나 0g으로 다음 차례로 넘어갑니다.');
            completeTurn(false);
            return;
          }
        }
      }

      // 1) Settle / Flag Fall Animation
      if (phaseRef.current === 'settle' && settleAnimRef.current) {
        const anim = settleAnimRef.current;
        const t = Math.min(1, (now - anim.start) / anim.duration);
        const f = s.flag;

        if (anim.plan.fall) {
          const ease = t * t;
          f.direction = anim.fromDir + (anim.plan.direction - anim.fromDir) * Math.min(1, t * 1.4);
          f.angle = anim.fromAngle + (Math.PI / 2 - anim.fromAngle) * ease;
          f.drop = anim.fromDrop + (f.root + 0.18 - anim.fromDrop) * Math.max(0, (t - 0.15) / 0.85);

          if (!anim.hit && (flagContact(s, f.angle, f.direction) || t >= 0.98)) {
            anim.hit = true;
            const impactX = f.x + Math.cos(f.direction) * Math.sin(f.angle) * (f.length * 0.55);
            const impactZ = f.z + Math.sin(f.direction) * Math.sin(f.angle) * (f.length * 0.55);
            const impactY = Math.max(0.4, f.root - (f.drop || 0) + Math.cos(f.angle) * (f.length * 0.55));
            viewportRef.current?.spawnImpact([impactX, impactY, impactZ]);
            viewportRef.current?.addTrauma(0.92);
            audioRef.current.playFlagFall();
            completeTurn(true, anim.envFall);
            return;
          }
        } else {
          const smooth = 1 - (1 - t) * (1 - t);
          const wobble = Math.sin(t * Math.PI * 3) * (1 - t) * 0.045;
          f.direction = anim.fromDir + (anim.plan.direction - anim.fromDir) * smooth;
          f.angle = Math.max(0, anim.fromAngle + (anim.plan.angle - anim.fromAngle) * smooth + wobble);
          if (t >= 1) {
            f.angle = anim.plan.angle;
            f.direction = anim.plan.direction;
            completeTurn(false);
            return;
          }
        }
      }

      // 2) AI Opponent Orchestration
      if (s.playMode === 'ai' && s.player === 1) {
        if (phaseRef.current === 'observe') {
          aiTurnRef.current = {
            stage: 'thinking',
            startedAt: now,
            plan: null,
            pulsesDone: 0,
            nextPulseAt: now + 520,
          };
          phaseRef.current = 'ai-thinking';
          setPhase('ai-thinking');
          syncHudNow();
        } else if (phaseRef.current === 'ai-thinking' && aiTurnRef.current) {
          if (now >= aiTurnRef.current.nextPulseAt) {
            const plan = chooseAiMove(s, s.aiDifficulty);
            if (!plan) {
              completeTurn(false);
              return;
            }
            aiTurnRef.current = {
              stage: 'digging',
              startedAt: now,
              plan,
              pulsesDone: 0,
              nextPulseAt: now,
            };
            setToolP1(plan.tool);
            digToolRef.current = plan.tool;
            harvestRef.current = 0;
            harvestGramsRef.current = 0;
            phaseRef.current = 'ai-dig';
            setPhase('ai-dig');
            syncHudNow();
          }
        } else if (phaseRef.current === 'ai-dig' && aiTurnRef.current?.plan) {
          const ai = aiTurnRef.current;
          const plan = ai.plan;
          if (!plan) return;
          const interval = Math.max(170, TOOLS[plan.tool].interval);
          const pulseProgress = Math.min(1, Math.max(0, 1 - (ai.nextPulseAt - now) / interval));
          viewportRef.current?.setAiToolState({
            active: true,
            tool: plan.tool,
            point: plan.point,
            phase: pulseProgress,
          });

          if (now >= ai.nextPulseAt) {
            runCarvePulse(plan.point, plan.dir, plan.tool);
            ai.pulsesDone++;
            ai.nextPulseAt = now + interval;
            if (ai.pulsesDone >= plan.pulses) {
              viewportRef.current?.setAiToolState(null);
              finishDig();
              return;
            }
          }
        }
      }

      // 3) Periodic environmental disturbance (rain/wind/wet erosion)
      if (phaseRef.current === 'observe' && s.materialPhysics !== false) {
        const bucket = Math.floor(s.environment.elapsed / 2);
        if (bucket > lastDisturbBucketRef.current) {
          lastDisturbBucketRef.current = bucket;
          const disturbed = settle(s, { disturbance: true });
          if (disturbed.moved > 0) {
            viewportRef.current?.spawnCollapse(disturbed.moves);
            viewportRef.current?.rebuildPile();
            audioRef.current.playCollapse(disturbed.moved);
            const plan = flagPlan(s);
            if (plan.fall) {
              settleAnimRef.current = {
                start: now,
                duration: 1550,
                fromAngle: s.flag.angle,
                fromDir: s.flag.direction,
                fromDrop: s.flag.drop || 0,
                plan,
                hit: false,
                envFall: true,
              };
              phaseRef.current = 'settle';
              setPhase('settle');
              syncHudNow();
              return;
            }
          }
        }
      }

      // 4) Throttled HUD refresh (~4Hz for clocks & environment summary)
      if (now - lastHudSyncRef.current > 250) {
        lastHudSyncRef.current = now;
        syncHudNow();
      }
    },
    [completeTurn, finishDig, runCarvePulse, showToast, syncHudNow],
  );

  // Match lifecycle actions
  const startMatchWith = useCallback(
    (nextState: MatchState) => {
      audioRef.current.unlock();
      stateRef.current = nextState;
      harvestRef.current = 0;
      harvestGramsRef.current = 0;
      checkpointRef.current = null;
      settleAnimRef.current = null;
      aiTurnRef.current = null;
      lastDisturbBucketRef.current = 0;
      setCut(false);
      phaseRef.current = 'observe';
      setPhase('observe');
      setActiveModal('none');
      setScreen('playing');
      syncTrack(nextState);
      viewportRef.current?.clearParticles();
      viewportRef.current?.setAiToolState(null);
      viewportRef.current?.syncScene();
      viewportRef.current?.resetView();
      persistMatch(nextState);
      setHasSavedMatch(true);
      syncHudNow();
    },
    [syncHudNow, syncTrack],
  );

  const handleTitleStartNew = useCallback(() => {
    const next = create(randomSeed(), 0, 0, {
      stage: titleStage,
      sediment: titleSediment,
      playMode: titleMode,
      aiDifficulty: titleAiDiff,
    });
    startMatchWith(next);
  }, [startMatchWith, titleAiDiff, titleMode, titleSediment, titleStage]);

  const handleTitleContinue = useCallback(() => {
    const loaded = loadSavedMatch();
    if (!loaded.state) {
      showToast('불러올 수 있는 저장 경기가 없습니다.');
      setHasSavedMatch(false);
      return;
    }
    startMatchWith(loaded.state);
  }, [showToast, startMatchWith]);

  const handleTitleStagePreview = useCallback(
    (st: StageId | 'random') => {
      setTitleStage(st);
      if (screenRef.current === 'title') {
        const previewStage: StageId = st === 'random' ? 'beach' : st;
        const preview = create(stateRef.current.seed, 0, 0, {
          stage: previewStage,
          sediment: titleSediment,
          playMode: titleMode,
          aiDifficulty: titleAiDiff,
        });
        stateRef.current = preview;
        syncTrack(preview);
        viewportRef.current?.syncScene();
      }
    },
    [syncTrack, titleAiDiff, titleMode, titleSediment],
  );

  const handleTitleSedimentPreview = useCallback(
    (sed: SedimentId | 'random') => {
      setTitleSediment(sed);
      if (screenRef.current === 'title') {
        const preview = create(stateRef.current.seed, 0, 0, {
          stage: titleStage === 'random' ? 'beach' : titleStage,
          sediment: sed,
          playMode: titleMode,
          aiDifficulty: titleAiDiff,
        });
        stateRef.current = preview;
        viewportRef.current?.syncScene();
      }
    },
    [titleAiDiff, titleMode, titleStage],
  );

  const handleSetupSubmit = useCallback(
    (values: SetupFormValues) => {
      const next = create(values.seed, values.duration, values.turnDuration, {
        stage: values.stage,
        sediment: values.sediment,
        pilePercent: values.pilePercent,
        materialPhysics: values.materialPhysics,
        time: values.time,
        season: values.season,
        weather: values.weather,
        playMode: values.playMode,
        aiDifficulty: values.aiDifficulty,
      });
      setTitleMode(values.playMode);
      setTitleAiDiff(values.aiDifficulty);
      setTitleStage(values.stage);
      setTitleSediment(values.sediment);
      startMatchWith(next);
    },
    [startMatchWith],
  );

  const handleRestartSameHill = useCallback(() => {
    const cur = stateRef.current;
    const next = create(cur.seed, cur.duration, cur.turnDuration, {
      variant: randomSeed(),
      previousDesign: cur.flag.design,
      stage: cur.stage,
      sediment: cur.sediment,
      pilePercent: cur.pilePercent,
      materialPhysics: cur.materialPhysics,
      time: cur.environment.time,
      season: cur.environment.season,
      weather: cur.environment.weather,
      playMode: cur.playMode,
      aiDifficulty: cur.aiDifficulty,
    });
    startMatchWith(next);
  }, [startMatchWith]);

  const handleSwitchPlayMode = useCallback(
    (nextMode: PlayMode) => {
      stateRef.current.playMode = nextMode;
      setTitleMode(nextMode);
      persistMatch(stateRef.current);
      syncHudNow();
      showToast(
        nextMode === 'tabletop'
          ? '마주보기 2P 모드로 전환했습니다.'
          : nextMode === 'ai'
            ? '1P vs AI 모드로 전환했습니다.'
            : '로컬 2P 모드로 전환했습니다.',
      );
    },
    [showToast, syncHudNow],
  );

  const handleToggleMute = useCallback(() => {
    audioRef.current.unlock();
    setMuted((prev) => {
      const next = !prev;
      audioRef.current.setVolume(next ? 0 : volume);
      return next;
    });
  }, [volume]);

  const handleSelectToolForPlayer = useCallback((player: 0 | 1, tool: ToolId) => {
    audioRef.current.unlock();
    if (player === 0) setToolP0(tool);
    else setToolP1(tool);
  }, []);

  // Global keyboard shortcuts (Title Enter/Space, Pause Esc/P, Tool 1-6, Mute M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (screenRef.current === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleTitleStartNew();
        return;
      }

      if (e.key === 'Escape') {
        if (modalRef.current !== 'none') {
          setActiveModal('none');
          return;
        }
        if (screenRef.current === 'playing') {
          setScreen('paused');
        } else if (screenRef.current === 'paused') {
          setScreen('playing');
        }
        return;
      }

      if ((e.key === 'p' || e.key === 'P') && modalRef.current === 'none') {
        if (screenRef.current === 'playing') setScreen('paused');
        else if (screenRef.current === 'paused') setScreen('playing');
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
        return;
      }

      if (
        screenRef.current === 'playing' &&
        modalRef.current === 'none' &&
        phaseRef.current === 'observe'
      ) {
        const s = stateRef.current;
        if (s.playMode === 'ai' && s.player === 1) return;
        const digit = Number(e.key);
        if (digit >= 1 && digit <= 6) {
          const tool = TOOL_ORDER[digit - 1];
          handleSelectToolForPlayer(s.player, tool);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectToolForPlayer, handleTitleStartNew, handleToggleMute]);

  const activeTool = hud.activePlayer === 0 ? toolP0 : toolP1;

  return (
    <main className="relative w-full h-dvh overflow-hidden select-none bg-[#162a26]">
      {/* Persistent Three.js 3D Viewport */}
      <SandViewport
        stateRef={stateRef}
        screen={screen}
        phase={phase}
        tool={activeTool}
        cut={cut}
        shipMotion={shipMotion}
        autoFlipTabletop={autoFlipTabletop}
        onDigStart={handleDigStart}
        onDigPulse={handleDigPulse}
        onDigEnd={handleDigEnd}
        onDigCancel={handleDigCancel}
        onUserInteract={handleUserInteract}
        onTickFrame={handleTickFrame}
        controllerRef={viewportRef}
      />

      {/* Screen 1: Title Overlay */}
      {screen === 'title' && (
        <TitleOverlay
          playMode={titleMode}
          aiDifficulty={titleAiDiff}
          stage={titleStage}
          sediment={titleSediment}
          hasSavedMatch={hasSavedMatch}
          onChangeMode={setTitleMode}
          onChangeAiDifficulty={setTitleAiDiff}
          onChangeStage={handleTitleStagePreview}
          onChangeSediment={handleTitleSedimentPreview}
          onStartNew={handleTitleStartNew}
          onContinueSaved={handleTitleContinue}
        />
      )}

      {/* Screen 2: In-Game HUD (Tabletop Face-to-Face OR Standard Local/AI) */}
      {screen === 'playing' &&
        (hud.playMode === 'tabletop' ? (
          <TabletopHud
            activePlayer={hud.activePlayer}
            phase={phase}
            round={hud.round}
            scoresGrams={hud.scoresGrams}
            harvestGrams={hud.harvestGrams}
            supportRatio={hud.supportRatio}
            matchClockText={hud.matchClockText}
            turnClockText={hud.turnClockText}
            stageName={hud.stageName}
            sedimentName={hud.sedimentName}
            toolP0={toolP0}
            toolP1={toolP1}
            cut={cut}
            autoFlip={autoFlipTabletop}
            muted={muted}
            onSelectTool={handleSelectToolForPlayer}
            onRotate={(dy) => viewportRef.current?.rotateBy(dy, 0)}
            onToggleCut={() => setCut((v) => !v)}
            onToggleAutoFlip={() => {
              setAutoFlipTabletop((v) => {
                const next = !v;
                showToast(next ? '턴마다 3D 화면 180° 자동 회전 켜짐' : '3D 화면 각도 고정됨');
                return next;
              });
            }}
            onToggleMute={handleToggleMute}
            onOpenSettings={() => setActiveModal('setup')}
            onPause={() => setScreen('paused')}
          />
        ) : (
          <StandardHud
            playMode={hud.playMode}
            aiDifficulty={hud.aiDifficulty}
            activePlayer={hud.activePlayer}
            phase={phase}
            round={hud.round}
            scoresGrams={hud.scoresGrams}
            harvestGrams={hud.harvestGrams}
            supportRatio={hud.supportRatio}
            matchClockText={hud.matchClockText}
            turnClockText={hud.turnClockText}
            stageName={hud.stageName}
            sedimentName={hud.sedimentName}
            environmentSummary={hud.environmentSummary}
            selectedTool={activeTool}
            cut={cut}
            muted={muted}
            onSelectTool={(t) => handleSelectToolForPlayer(hud.activePlayer, t)}
            onRotate={(dy) => viewportRef.current?.rotateBy(dy, 0)}
            onZoom={(m) => viewportRef.current?.zoomBy(m)}
            onResetView={() => viewportRef.current?.resetView()}
            onToggleCut={() => setCut((v) => !v)}
            onToggleMute={handleToggleMute}
            onOpenHistory={() => setActiveModal('history')}
            onOpenSettings={() => setActiveModal('setup')}
            onPause={() => setScreen('paused')}
          />
        ))}

      {/* Screen 3: Pause Overlay */}
      {screen === 'paused' && activeModal === 'none' && (
        <PauseModal
          playMode={hud.playMode}
          onResume={() => setScreen('playing')}
          onSwitchPlayMode={handleSwitchPlayMode}
          onOpenSettings={() => setActiveModal('setup')}
          onRestartSameHill={handleRestartSameHill}
          onReturnTitle={() => {
            setActiveModal('none');
            setScreen('title');
          }}
        />
      )}

      {/* Screen 4: Result / Game Over Overlay */}
      {screen === 'gameover' && activeModal === 'none' && (
        <ResultModal
          state={stateRef.current}
          onReplaySameHill={handleRestartSameHill}
          onOpenSettings={() => setActiveModal('setup')}
          onReturnTitle={() => {
            setActiveModal('none');
            setScreen('title');
          }}
        />
      )}

      {/* Modal: Setup / New Match */}
      {activeModal === 'setup' && (
        <SetupModal
          state={stateRef.current}
          onSubmit={handleSetupSubmit}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Modal: Flag Info, Audio Preferences, Turn History */}
      {activeModal === 'history' && (
        <HistoryModal
          state={stateRef.current}
          musicEnabled={musicEnabled}
          sfxEnabled={sfxEnabled}
          volume={volume}
          shipMotion={shipMotion}
          onChangeMusic={(v) => {
            audioRef.current.unlock();
            setMusicEnabled(v);
            audioRef.current.setMusic(v);
          }}
          onChangeSfx={(v) => {
            audioRef.current.unlock();
            setSfxEnabled(v);
            audioRef.current.setSfx(v);
          }}
          onChangeVolume={(v) => {
            audioRef.current.unlock();
            setVolume(v);
            setMuted(v === 0);
            audioRef.current.setVolume(v);
          }}
          onChangeShipMotion={setShipMotion}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Minimal Floating Toast (Only on warnings/mode switches, auto-dismissed) */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none px-4 py-2 rounded-xl bg-[#162b25]/92 border border-[#e4c274]/40 text-[#fbf8ef] text-xs font-semibold shadow-xl text-center max-w-[85vw]"
        >
          {toast}
        </div>
      )}

      {/* Hidden accessible score readout for quick screen-reader updates */}
      <div className="sr-only" aria-live="polite">
        플레이어 1 {formatGrams(hud.scoresGrams[0])}g, 플레이어 2 {formatGrams(hud.scoresGrams[1])}g
      </div>
    </main>
  );
}
