import React from 'react';
import { SEDIMENTS, STAGES } from '../game/content';
import type { AiDifficulty, PlayMode, SedimentId, StageId } from '../game/types';
import { TitleCrestSvg } from './GameIcons';

interface TitleOverlayProps {
  playMode: PlayMode;
  aiDifficulty: AiDifficulty;
  stage: StageId | 'random';
  sediment: SedimentId | 'random';
  hasSavedMatch: boolean;
  onChangeMode: (mode: PlayMode) => void;
  onChangeAiDifficulty: (diff: AiDifficulty) => void;
  onChangeStage: (stage: StageId | 'random') => void;
  onChangeSediment: (sediment: SedimentId | 'random') => void;
  onStartNew: () => void;
  onContinueSaved: () => void;
}

const MODE_OPTIONS: { id: PlayMode; label: string; desc: string }[] = [
  { id: 'tabletop', label: '마주보기 2P', desc: '폰·패드 1대 상하 컨트롤' },
  { id: 'local', label: '로컬 2P', desc: '교대 플레이 기본 화면' },
  { id: 'ai', label: '1P vs AI', desc: '혼자 즐기는 전략 대전' },
];

const DIFF_OPTIONS: { id: AiDifficulty; label: string }[] = [
  { id: 'easy', label: '쉬움' },
  { id: 'normal', label: '보통' },
  { id: 'hard', label: '고수' },
];

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  playMode,
  aiDifficulty,
  stage,
  sediment,
  hasSavedMatch,
  onChangeMode,
  onChangeAiDifficulty,
  onChangeStage,
  onChangeSediment,
  onStartNew,
  onContinueSaved,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-5 sm:p-8 lg:p-11">
      {/* Asymmetric Left Title & Match Launcher over Calm Negative Space */}
      <div className="pointer-events-auto w-full max-w-[390px] rounded-2xl bg-[#fbf8ef]/95 border border-[#d6cdb8] shadow-[0_24px_64px_rgba(14,32,27,0.32)] p-5 sm:p-6">
        <div className="flex items-center gap-3.5 mb-5">
          <TitleCrestSvg className="w-12 h-12 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#1a332d] leading-tight">
              모래 뺏기
            </h1>
            <p className="text-xs font-medium text-[#5f7268] mt-0.5">
              Sand Digger 3D · 깃발을 지켜라
            </p>
          </div>
        </div>

        {/* Mode Segmented Selector */}
        <div className="mb-4">
          <span className="block text-xs font-semibold text-[#485d54] mb-2">플레이 방식</span>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#ebe4d3]">
            {MODE_OPTIONS.map((opt) => {
              const active = playMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeMode(opt.id)}
                  aria-pressed={active}
                  className={`px-2 py-2.5 rounded-lg text-center transition-colors ${
                    active
                      ? 'bg-[#1d3832] text-[#fbf8ef] font-bold shadow-sm'
                      : 'text-[#395047] hover:bg-[#f6f1e4] font-medium'
                  }`}
                >
                  <span className="block text-xs whitespace-nowrap">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[#60736a] mt-1.5">
            {MODE_OPTIONS.find((m) => m.id === playMode)?.desc}
          </p>
        </div>

        {/* AI Difficulty when AI mode is selected */}
        {playMode === 'ai' && (
          <div className="mb-4">
            <span className="block text-xs font-semibold text-[#485d54] mb-1.5">AI 난이도</span>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#ebe4d3]">
              {DIFF_OPTIONS.map((d) => {
                const active = aiDifficulty === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onChangeAiDifficulty(d.id)}
                    aria-pressed={active}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#c25d40] text-[#fffaf2]'
                        : 'text-[#395047] hover:bg-[#f6f1e4]'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Stage & Sediment Pickers */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <label className="block">
            <span className="block text-[11px] font-semibold text-[#4d6259] mb-1">배경 장소</span>
            <select
              aria-label="배경 장소 선택"
              value={stage}
              onChange={(e) => onChangeStage(e.target.value as StageId | 'random')}
              className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-2.5 py-2 text-xs font-medium text-[#1e352f] focus:outline-none focus:border-[#2c6e58]"
            >
              <option value="random">랜덤 (12곳)</option>
              {STAGES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-[#4d6259] mb-1">모래 재질</span>
            <select
              aria-label="모래 재질 선택"
              value={sediment}
              onChange={(e) => onChangeSediment(e.target.value as SedimentId | 'random')}
              className="w-full rounded-lg bg-[#fffdf7] border border-[#cfc6b0] px-2.5 py-2 text-xs font-medium text-[#1e352f] focus:outline-none focus:border-[#2c6e58]"
            >
              <option value="random">랜덤 (8종)</option>
              {SEDIMENTS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Primary Start CTA */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-start="true"
            onClick={onStartNew}
            className="w-full py-3.5 px-4 rounded-xl bg-[#255c4a] hover:bg-[#1e4d3e] active:scale-[0.99] text-[#fbf8ef] font-display font-bold text-base tracking-tight transition-all shadow-[0_6px_18px_rgba(25,74,58,0.3)]"
          >
            경기 시작
          </button>
          {hasSavedMatch && (
            <button
              type="button"
              onClick={onContinueSaved}
              className="w-full py-2.5 px-4 rounded-xl bg-[#efe9da] hover:bg-[#e5ddc9] text-[#223d35] font-semibold text-xs transition-colors"
            >
              저장된 경기 이어하기
            </button>
          )}
        </div>
      </div>

      {/* Flat Borderless Single-Line Control Hint in Safe Bottom Margin */}
      <div className="text-center text-xs font-semibold text-[#1a332d] drop-shadow-[0_1px_2px_rgba(255,252,242,0.95)]">
        좌클릭·한 손가락: 채굴 · 우클릭·두 손가락: 3D 회전 · 1~6: 도구 선택 · Enter: 시작
      </div>
    </div>
  );
};
