import React, { useEffect, useRef, useState } from 'react';
import { Shuffle, X } from 'lucide-react';
import { FLAGS, POLE_MATERIALS, SEDIMENTS, STAGES, TOOLS, TRACKS } from '../game/content';
import { factor, formatGrams, grams, seconds } from '../game/engine';
import type {
  AiDifficulty,
  MatchState,
  PlayMode,
  SeasonMode,
  SedimentId,
  StageId,
  TimeMode,
  WeatherMode,
} from '../game/types';
import { renderFlagCanvas } from '../scene/textures';

interface PauseModalProps {
  playMode: PlayMode;
  onResume: () => void;
  onSwitchPlayMode: (mode: PlayMode) => void;
  onOpenSettings: () => void;
  onRestartSameHill: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  playMode,
  onResume,
  onSwitchPlayMode,
  onOpenSettings,
  onRestartSameHill,
  onReturnTitle,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f211c]/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="일시정지"
        className="w-full max-w-sm rounded-2xl bg-[#fbf8ef] border border-[#d6cdb8] shadow-2xl p-6"
      >
        <h2 className="font-display text-2xl font-bold text-[#1a332d] mb-1">일시정지</h2>
        <p className="text-xs text-[#61736a] mb-5">경기 시계가 잠시 멈춰 있습니다.</p>

        {/* Quick Play Mode Switcher */}
        <div className="mb-5">
          <span className="block text-xs font-semibold text-[#475d54] mb-1.5">플레이 모드 전환</span>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#ebe4d3]">
            {(
              [
                ['tabletop', '마주보기 2P'],
                ['local', '로컬 2P'],
                ['ai', '1P vs AI'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onSwitchPlayMode(id)}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                  playMode === id
                    ? 'bg-[#1d3832] text-[#fbf8ef]'
                    : 'text-[#395047] hover:bg-[#f6f1e4]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 rounded-xl bg-[#255c4a] hover:bg-[#1e4d3e] text-[#fbf8ef] font-bold text-sm"
          >
            경기 계속하기
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-2.5 rounded-xl bg-[#efe9da] hover:bg-[#e5ddc9] text-[#223d35] font-semibold text-sm"
          >
            새 경기 설정
          </button>
          <button
            type="button"
            onClick={onRestartSameHill}
            className="w-full py-2.5 rounded-xl bg-[#efe9da] hover:bg-[#e5ddc9] text-[#223d35] font-semibold text-sm"
          >
            같은 언덕 · 새 깃발로 재시작
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2 rounded-xl text-[#5a6c63] hover:text-[#1b332d] font-medium text-xs mt-1"
          >
            타이틀 화면으로
          </button>
        </div>
      </div>
    </div>
  );
};

export interface SetupFormValues {
  seed: string;
  duration: number;
  turnDuration: number;
  stage: StageId | 'random';
  sediment: SedimentId | 'random';
  pilePercent: number;
  materialPhysics: boolean;
  time: TimeMode | 'random';
  season: SeasonMode | 'random';
  weather: WeatherMode | 'random';
  playMode: PlayMode;
  aiDifficulty: AiDifficulty;
}

interface SetupModalProps {
  state: MatchState;
  onSubmit: (values: SetupFormValues) => void;
  onClose: () => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({ state, onSubmit, onClose }) => {
  const [seed, setSeed] = useState(state.seed);
  const [durationVal, setDurationVal] = useState(String(state.duration));
  const [durationUnit, setDurationUnit] = useState('1');
  const [turnVal, setTurnVal] = useState(String(state.turnDuration));
  const [turnUnit, setTurnUnit] = useState('1');
  const [stage, setStage] = useState<StageId | 'random'>(state.stage);
  const [sediment, setSediment] = useState<SedimentId | 'random'>(state.sediment);
  const [pilePercent, setPilePercent] = useState(String(state.pilePercent));
  const [materialPhysics, setMaterialPhysics] = useState(state.materialPhysics !== false);
  const [time, setTime] = useState<TimeMode | 'random'>(state.environment.time);
  const [season, setSeason] = useState<SeasonMode | 'random'>(state.environment.season);
  const [weather, setWeather] = useState<WeatherMode | 'random'>(state.environment.weather);
  const [playMode, setPlayMode] = useState<PlayMode>(state.playMode);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>(state.aiDifficulty);
  const [error, setError] = useState('');

  const handleRandomSeed = () => {
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    setSeed(`SAND-${rand}`);
  };

  const handleRandomizeAll = () => {
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    setSeed(`SAND-${rand}`);
    setStage(pick(STAGES).id);
    setSediment(pick(SEDIMENTS).id);
    // Fun balanced scale range (70% ~ 220% in 10% increments)
    const randPercent = 70 + Math.floor(Math.random() * 16) * 10;
    setPilePercent(String(randPercent));
    setTime(pick(['cycle', 'day', 'night'] as const));
    setSeason(pick(['cycle', 'spring', 'summer', 'autumn', 'winter'] as const));
    setWeather(pick(['auto', 'clear', 'rain', 'snow', 'wind'] as const));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const cleanSeed = seed.trim();
      if (!cleanSeed || cleanSeed.length > 32) {
        throw new Error('시드는 1~32자 사이로 입력하세요.');
      }
      const durationSec = seconds(durationVal, durationUnit);
      const turnSec = seconds(turnVal, turnUnit);
      const pct = Number(pilePercent);
      if (!Number.isInteger(pct) || pct < 50 || pct > 1700) {
        throw new Error('더미 규모는 50~1700 사이의 정수로 입력하세요.');
      }
      onSubmit({
        seed: cleanSeed,
        duration: durationSec,
        turnDuration: turnSec,
        stage,
        sediment,
        pilePercent: pct,
        materialPhysics,
        time,
        season,
        weather,
        playMode,
        aiDifficulty,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정을 확인해 주세요.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f211c]/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="새 경기 설정"
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#fbf8ef] border border-[#d6cdb8] shadow-2xl p-5 sm:p-6"
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="font-display text-xl font-bold text-[#1a332d]">새 경기 설정</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="setup-randomize-btn"
              onClick={handleRandomizeAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e4f1eb] hover:bg-[#d4e8de] border border-[#b2d3c4] text-xs font-bold text-[#194a3a] transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>전체 랜덤</span>
            </button>
            <button
              type="button"
              aria-label="설정 닫기"
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#556860] hover:bg-[#ebe4d3]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Play Mode & AI Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-[#475d54] mb-1">플레이 방식</span>
              <select
                value={playMode}
                onChange={(e) => setPlayMode(e.target.value as PlayMode)}
                className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-3 py-2 text-sm text-[#1e352f]"
              >
                <option value="tabletop">마주보기 2P (테이블탑)</option>
                <option value="local">로컬 2P (기본)</option>
                <option value="ai">1P vs AI 대전</option>
              </select>
            </label>
            {playMode === 'ai' && (
              <label className="block">
                <span className="block text-xs font-semibold text-[#475d54] mb-1">AI 난이도</span>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value as AiDifficulty)}
                  className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-3 py-2 text-sm text-[#1e352f]"
                >
                  <option value="easy">쉬움</option>
                  <option value="normal">보통</option>
                  <option value="hard">고수</option>
                </select>
              </label>
            )}
          </div>

          {/* Stage & Sediment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-[#475d54] mb-1">배경 장소 (12곳)</span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as StageId | 'random')}
                className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-3 py-2 text-sm text-[#1e352f]"
              >
                <option value="random">랜덤</option>
                {STAGES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-[#475d54] mb-1">모래·흙 재질 (8종)</span>
              <select
                aria-label="모래·흙 재질"
                value={sediment}
                onChange={(e) => setSediment(e.target.value as SedimentId | 'random')}
                className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-3 py-2 text-sm text-[#1e352f]"
              >
                <option value="random">랜덤 (8종)</option>
                {SEDIMENTS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (밀도 {m.density}x)
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Pile Scale & Material Physics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <label className="block">
              <span className="block text-xs font-semibold text-[#475d54] mb-1">
                더미 규모 (50~1700%)
              </span>
              <input
                type="number"
                min={50}
                max={1700}
                step={10}
                value={pilePercent}
                onChange={(e) => setPilePercent(e.target.value)}
                className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-3 py-2 text-sm font-mono-num text-[#1e352f]"
              />
            </label>
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#efe9da] text-xs font-semibold text-[#233d35]">
              <input
                type="checkbox"
                checked={materialPhysics}
                onChange={(e) => setMaterialPhysics(e.target.checked)}
                className="w-4 h-4 accent-[#255c4a]"
              />
              <span>재질·날씨 물리 반영</span>
            </label>
          </div>

          {/* Environment: Time / Season / Weather */}
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="block text-[11px] font-semibold text-[#475d54] mb-1">낮과 밤</span>
              <select
                aria-label="낮과 밤"
                value={time}
                onChange={(e) => setTime(e.target.value as TimeMode | 'random')}
                className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-2 py-2 text-xs text-[#1e352f]"
              >
                <option value="random">랜덤</option>
                <option value="cycle">2분 순환</option>
                <option value="day">낮 고정</option>
                <option value="night">밤 고정</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-[#475d54] mb-1">계절</span>
              <select
                aria-label="계절"
                value={season}
                onChange={(e) => setSeason(e.target.value as SeasonMode | 'random')}
                className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-2 py-2 text-xs text-[#1e352f]"
              >
                <option value="random">랜덤</option>
                <option value="cycle">3분 순환</option>
                <option value="spring">봄</option>
                <option value="summer">여름</option>
                <option value="autumn">가을</option>
                <option value="winter">겨울</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-[#475d54] mb-1">날씨</span>
              <select
                aria-label="날씨"
                value={weather}
                onChange={(e) => setWeather(e.target.value as WeatherMode | 'random')}
                className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-2 py-2 text-xs text-[#1e352f]"
              >
                <option value="random">랜덤</option>
                <option value="auto">자동 변화</option>
                <option value="clear">맑음</option>
                <option value="rain">비</option>
                <option value="snow">눈</option>
                <option value="wind">강풍</option>
              </select>
            </label>
          </div>

          {/* Match Duration & Turn Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-xs font-semibold text-[#475d54] mb-1">전체 경기 시간 (0=무제한)</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="전체 경기 시간"
                  value={durationVal}
                  onChange={(e) => setDurationVal(e.target.value)}
                  className="w-3/5 rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-2.5 py-2 text-sm font-mono-num"
                />
                <select
                  aria-label="전체 시간 단위"
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value)}
                  className="w-2/5 rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-1.5 py-2 text-xs"
                >
                  <option value="1">초</option>
                  <option value="60">분</option>
                  <option value="3600">시간</option>
                </select>
              </div>
            </div>
            <div>
              <span className="block text-xs font-semibold text-[#475d54] mb-1">턴 제한시간 (0=무제한)</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="턴 제한시간"
                  value={turnVal}
                  onChange={(e) => setTurnVal(e.target.value)}
                  className="w-3/5 rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-2.5 py-2 text-sm font-mono-num"
                />
                <select
                  aria-label="턴 시간 단위"
                  value={turnUnit}
                  onChange={(e) => setTurnUnit(e.target.value)}
                  className="w-2/5 rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-1.5 py-2 text-xs"
                >
                  <option value="1">초</option>
                  <option value="60">분</option>
                  <option value="3600">시간</option>
                </select>
              </div>
            </div>
          </div>

          {/* Seed Input */}
          <div>
            <span className="block text-xs font-semibold text-[#475d54] mb-1">모래 언덕 시드</span>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={32}
                aria-label="모래 언덕 시드"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="flex-1 rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-3 py-2 text-sm font-mono-num"
              />
              <button
                type="button"
                onClick={handleRandomSeed}
                className="px-3 py-2 rounded-lg bg-[#ebe4d3] hover:bg-[#e1d7c0] text-xs font-semibold text-[#233d35] whitespace-nowrap"
              >
                새 시드
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-semibold text-[#b83f28]">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-[#255c4a] hover:bg-[#1e4d3e] text-[#fbf8ef] font-bold text-sm"
            >
              새 경기 시작
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-[#efe9da] hover:bg-[#e5ddc9] text-[#223d35] font-semibold text-sm"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ResultModalProps {
  state: MatchState;
  onReplaySameHill: () => void;
  onOpenSettings: () => void;
  onReturnTitle: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  state,
  onReplaySameHill,
  onOpenSettings,
  onReturnTitle,
}) => {
  const [minimized, setMinimized] = useState(false);
  const res = state.result;
  if (!res) return null;

  const p2Label = state.playMode === 'ai' ? 'AI' : '플레이어 2';
  const title =
    res.winner === null
      ? '무승부'
      : res.winner === 0
        ? '플레이어 1 승리'
        : `${p2Label} 승리`;

  const reasonText =
    res.reason === 'environment'
      ? '환경 변화로 깃발이 쓰러져 무승부로 종료되었습니다.'
      : res.reason === 'ko'
        ? `${res.actor === 0 ? '플레이어 1' : p2Label}의 차례에 깃발이 쓰러졌습니다.`
        : '시간이 종료되어 총 수확 무게로 승패를 가렸습니다.';

  // Dock card on opposite side of the winner's 3D victory flagpole so the celebration shines unobstructed!
  const alignClass =
    res.winner === 1
      ? 'items-end sm:items-center justify-center sm:justify-start'
      : 'items-end sm:items-center justify-center sm:justify-end';

  if (minimized) {
    return (
      <div className="fixed inset-x-0 bottom-5 z-40 pointer-events-none flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-[#fbf8ef]/95 border border-[#d6cdb8] shadow-xl px-4 py-2.5">
          <span className="font-display font-bold text-sm text-[#19322c]">{title}</span>
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="px-3 py-1.5 rounded-lg bg-[#255c4a] hover:bg-[#1e4d3e] text-[#fbf8ef] text-xs font-bold"
          >
            결과 카드 열기
          </button>
          <button
            type="button"
            data-start="true"
            onClick={onReplaySameHill}
            className="px-3 py-1.5 rounded-lg bg-[#efe9da] hover:bg-[#e5ddc9] text-[#223d35] text-xs font-semibold"
          >
            재경기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-40 pointer-events-none flex p-4 sm:p-8 lg:p-12 ${alignClass}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="경기 결과"
        className="pointer-events-auto w-full max-w-[390px] rounded-2xl bg-[#fbf8ef]/95 border border-[#d6cdb8] shadow-[0_24px_64px_rgba(14,32,27,0.34)] p-5 sm:p-6 text-center"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-[#6b7b72] tracking-wider">MATCH COMPLETE</span>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="text-[11px] font-semibold text-[#255c4a] hover:underline"
          >
            3D 연출 크게 보기
          </button>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#19322c] mb-1.5 text-left">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-[#586b62] mb-4 text-left">{reasonText}</p>

        {/* Mastery Stat Tiles */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div
            className={`rounded-xl border p-3 ${
              res.winner === 0
                ? 'bg-[#dcf0e6] border-[#256b52] ring-2 ring-[#256b52]/25'
                : 'bg-[#e4f1eb]/75 border-[#b9d7ca]'
            }`}
          >
            <span className="block text-xs font-semibold text-[#2a5c4a]">플레이어 1</span>
            <strong className="block font-mono-num text-xl sm:text-2xl font-bold text-[#15352a] mt-0.5">
              {formatGrams(grams(state, state.scores[0]))}
              <small className="text-xs font-medium ml-0.5">g</small>
            </strong>
            <span className="block text-[11px] text-[#4c6e60] mt-0.5">{state.turns[0]}턴</span>
          </div>
          <div
            className={`rounded-xl border p-3 ${
              res.winner === 1
                ? 'bg-[#fae1d7] border-[#c25233] ring-2 ring-[#c25233]/25'
                : 'bg-[#f7e7e0]/75 border-[#e3c0b3]'
            }`}
          >
            <span className="block text-xs font-semibold text-[#8c3f29]">{p2Label}</span>
            <strong className="block font-mono-num text-xl sm:text-2xl font-bold text-[#3f1c12] mt-0.5">
              {formatGrams(grams(state, state.scores[1]))}
              <small className="text-xs font-medium ml-0.5">g</small>
            </strong>
            <span className="block text-[11px] text-[#7e4e3f] mt-0.5">{state.turns[1]}턴</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-start="true"
            onClick={onReplaySameHill}
            className="w-full py-3 rounded-xl bg-[#255c4a] hover:bg-[#1e4d3e] text-[#fbf8ef] font-bold text-sm"
          >
            같은 언덕 · 새 깃발로 재경기
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-2.5 rounded-xl bg-[#efe9da] hover:bg-[#e5ddc9] text-[#223d35] font-semibold text-sm"
          >
            새로운 경기 설정
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-1.5 rounded-xl text-[#5a6c63] hover:text-[#1b332d] font-medium text-xs"
          >
            타이틀 화면으로
          </button>
        </div>
      </div>
    </div>
  );
};

interface HistoryModalProps {
  state: MatchState;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  volume: number;
  shipMotion: boolean;
  onChangeMusic: (v: boolean) => void;
  onChangeSfx: (v: boolean) => void;
  onChangeVolume: (v: number) => void;
  onChangeShipMotion: (v: boolean) => void;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  state,
  musicEnabled,
  sfxEnabled,
  volume,
  shipMotion,
  onChangeMusic,
  onChangeSfx,
  onChangeVolume,
  onChangeShipMotion,
  onClose,
}) => {
  const flagCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const f = state.flag;
  const flagSpec = FLAGS.find((fl) => fl.id === f.design) || FLAGS[0];
  const poleSpec = POLE_MATERIALS.find((pm) => pm.id === f.material) || POLE_MATERIALS[0];
  const stageSpec = STAGES.find((st) => st.id === state.stage) || STAGES[0];
  const trackSpec = TRACKS.find((tr) => tr.id === stageSpec.track) || TRACKS[0];
  const pFactor = factor(state);

  useEffect(() => {
    const canvas = flagCanvasRef.current;
    if (!canvas) return;
    const src = renderFlagCanvas(f.design);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    }
  }, [f.design]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f211c]/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="경기 정보 및 턴 기록"
        className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl bg-[#fbf8ef] border border-[#d6cdb8] shadow-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-[#1a332d]">깃발 정보 · 턴 기록 · 소리</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#556860] hover:bg-[#ebe4d3]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Flag Card */}
        <div className="flex items-center gap-3.5 pb-4 mb-4 border-b border-[#e2dac7]">
          <canvas
            ref={flagCanvasRef}
            width={128}
            height={96}
            className="w-20 h-[60px] rounded-lg border border-[#cfc6b0] shrink-0"
          />
          <div className="min-w-0 text-xs text-[#4b5f56] space-y-0.5">
            <div className="text-sm font-bold text-[#1a332d]">{flagSpec.name}</div>
            <div>
              {poleSpec.name} · 길이 {(f.length * pFactor).toFixed(1)}cm · 굵기 {(f.diameter * 10 * pFactor).toFixed(1)}mm
            </div>
            <div>
              매립 깊이 {(f.embed * pFactor).toFixed(1)}cm · 초기 각도 {(f.initialAngle * (180 / Math.PI)).toFixed(1)}°
            </div>
            <div className="font-mono-num text-[11px] text-[#708077]">SEED: {state.seed}</div>
          </div>
        </div>

        {/* Audio & Motion Preferences */}
        <div className="pb-4 mb-4 border-b border-[#e2dac7] space-y-2.5 text-xs text-[#314a42]">
          <div className="flex items-center justify-between">
            <span className="font-semibold">배경음악 · {trackSpec.name}</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={musicEnabled}
                  onChange={(e) => onChangeMusic(e.target.checked)}
                  className="accent-[#255c4a]"
                />
                <span>BGM</span>
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={sfxEnabled}
                  onChange={(e) => onChangeSfx(e.target.checked)}
                  className="accent-[#255c4a]"
                />
                <span>효과음</span>
              </label>
            </div>
          </div>
          <label className="flex items-center gap-3">
            <span className="whitespace-nowrap font-semibold">음량</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
              className="flex-1 accent-[#255c4a]"
            />
            <span className="font-mono-num w-8 text-right">{Math.round(volume * 100)}%</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shipMotion}
              onChange={(e) => onChangeShipMotion(e.target.checked)}
              className="accent-[#255c4a]"
            />
            <span>배 위 스테이지 흔들림 연출</span>
          </label>
        </div>

        {/* Turn History (Previously hidden data now surfaced!) */}
        <div>
          <h3 className="text-xs font-bold text-[#445950] mb-2">
            최근 턴 기록 ({state.history.length}턴)
          </h3>
          {state.history.length === 0 ? (
            <p className="text-xs text-[#75847b] py-4 text-center">아직 진행된 턴이 없습니다.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {[...state.history].reverse().map((entry) => (
                <div
                  key={`${entry.turn}-${entry.player}`}
                  className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-[#f3ede0]"
                >
                  <span className="font-semibold text-[#233d35]">
                    #{entry.turn} · {entry.player === 0 ? '플레이어 1' : state.playMode === 'ai' ? 'AI' : '플레이어 2'}
                    {entry.tool ? ` (${TOOLS[entry.tool].label})` : ''}
                  </span>
                  <span className="font-mono-num font-bold text-[#1c3930]">
                    {entry.ko ? '깃발 붕괴 (KO)' : `+${formatGrams(grams(state, entry.grams))} g`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
