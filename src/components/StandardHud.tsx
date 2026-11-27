import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  History,
  Pause,
  RotateCcw,
  RotateCw,
  Scissors,
  Settings,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TOOL_ORDER, TOOLS } from '../game/content';
import { formatGrams } from '../game/engine';
import type { AiDifficulty, GamePhase, PlayMode, ToolId } from '../game/types';
import { ToolIconSvg } from './GameIcons';

interface StandardHudProps {
  playMode: PlayMode;
  aiDifficulty: AiDifficulty;
  activePlayer: 0 | 1;
  phase: GamePhase;
  round: number;
  scoresGrams: [number, number];
  harvestGrams: number;
  supportRatio: number;
  matchClockText: string;
  turnClockText: string;
  stageName: string;
  sedimentName: string;
  environmentSummary: string;
  selectedTool: ToolId;
  cut: boolean;
  muted: boolean;
  onSelectTool: (tool: ToolId) => void;
  onRotate: (dYaw: number) => void;
  onZoom: (mult: number) => void;
  onResetView: () => void;
  onToggleCut: () => void;
  onToggleMute: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onPause: () => void;
}

export const StandardHud: React.FC<StandardHudProps> = ({
  playMode,
  aiDifficulty,
  activePlayer,
  phase,
  round,
  scoresGrams,
  harvestGrams,
  supportRatio,
  matchClockText,
  turnClockText,
  stageName,
  sedimentName,
  environmentSummary,
  selectedTool,
  cut,
  muted,
  onSelectTool,
  onRotate,
  onZoom,
  onResetView,
  onToggleCut,
  onToggleMute,
  onOpenHistory,
  onOpenSettings,
  onPause,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const p2Name =
    playMode === 'ai'
      ? `AI (${aiDifficulty === 'hard' ? '고수' : aiDifficulty === 'easy' ? '쉬움' : '보통'})`
      : '플레이어 2';

  const isPlayerLocked = phase !== 'observe' || (playMode === 'ai' && activePlayer === 1);
  const riskColor = supportRatio > 0.65 ? '#2f8564' : supportRatio > 0.38 ? '#d68a32' : '#c94a38';
  const riskLabel = supportRatio > 0.65 ? '안정' : supportRatio > 0.38 ? '주의' : '위험';

  const turnBanner =
    phase === 'ai-thinking' || phase === 'ai-dig'
      ? `${p2Name} 채굴 중`
      : phase === 'settle'
        ? '모래 가라앉는 중'
        : phase === 'dig'
          ? `플레이어 ${activePlayer + 1} 채굴 중 · +${formatGrams(harvestGrams)}g`
          : activePlayer === 0
            ? '플레이어 1 차례'
            : `${p2Name} 차례`;

  return (
    <div
      data-testid="standard-hud"
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4"
    >
      {/* TOP PERIMETER CLUSTER: Compact Scoreboard + Utility Icons */}
      <div className="flex items-start justify-between gap-2">
        {/* Left/Center Unified Score & Match Readout */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 sm:gap-3 rounded-2xl bg-[#fbf8ef]/94 border border-[#d6cdb8] px-3 py-2 shadow-[0_8px_24px_rgba(14,32,27,0.2)]">
          {/* P1 Score */}
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border ${
              activePlayer === 0
                ? 'bg-[#e3f0ea] border-[#2c755d]'
                : 'bg-transparent border-transparent opacity-70'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-[#24634e] text-[#fbf8ef] text-[11px] font-bold flex items-center justify-center">
              1
            </span>
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold text-[#475d54]">플레이어 1</span>
              <span className="font-mono-num text-base sm:text-lg font-bold text-[#17302a]">
                {formatGrams(scoresGrams[0])}
                <small className="text-[11px] font-medium text-[#5e6e65] ml-0.5">g</small>
              </span>
            </div>
          </div>

          {/* Match Clock & Round */}
          <div className="text-center px-1.5 border-x border-[#e1dac8] leading-tight">
            <div className="text-[10px] font-semibold text-[#5a6c63]">
              R{String(round).padStart(2, '0')} · {turnBanner}
            </div>
            <div className="font-mono-num text-sm font-bold text-[#1b332d] mt-0.5">
              {matchClockText}
              <span className="text-[11px] font-normal text-[#67776f] ml-1.5">{turnClockText}</span>
            </div>
            <div className="hidden md:block text-[10px] text-[#6d7b73] mt-0.5">
              {stageName} · {sedimentName} · {environmentSummary}
            </div>
          </div>

          {/* P2 / AI Score */}
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border ${
              activePlayer === 1
                ? 'bg-[#f8e6df] border-[#c96244]'
                : 'bg-transparent border-transparent opacity-70'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-[#bd593d] text-[#fbf8ef] text-[11px] font-bold flex items-center justify-center">
              {playMode === 'ai' ? 'AI' : '2'}
            </span>
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold text-[#6f4437]">{p2Name}</span>
              <span className="font-mono-num text-base sm:text-lg font-bold text-[#2b1f1a]">
                {formatGrams(scoresGrams[1])}
                <small className="text-[11px] font-medium text-[#7c5d52] ml-0.5">g</small>
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right Compact Utility Icon Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            aria-label="단면 보기 전환"
            aria-pressed={cut}
            title="단면 보기"
            disabled={phase !== 'observe'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleCut();
            }}
            className={`h-10 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-45 ${
              cut
                ? 'bg-[#1d3832] border-[#1d3832] text-[#fbf8ef]'
                : 'bg-[#fbf8ef]/94 border-[#d6cdb8] text-[#223b34] hover:bg-[#efe9d9]'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span className="hidden sm:inline whitespace-nowrap">단면</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="턴 기록 및 깃발 정보 열기"
            title="기록 · 깃발 정보"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenHistory();
            }}
            className="w-10 h-10 rounded-xl bg-[#fbf8ef]/94 border border-[#d6cdb8] text-[#223b34] flex items-center justify-center shadow-sm hover:bg-[#efe9d9]"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? '소리 켜기' : '음소거'}
            title={muted ? '소리 켜기' : '음소거'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-10 h-10 rounded-xl bg-[#fbf8ef]/94 border border-[#d6cdb8] text-[#223b34] flex items-center justify-center shadow-sm hover:bg-[#efe9d9]"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="경기 설정 열기"
            title="경기 설정"
            disabled={phase !== 'observe'}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSettings();
            }}
            className="w-10 h-10 rounded-xl bg-[#fbf8ef]/94 border border-[#d6cdb8] text-[#223b34] flex items-center justify-center shadow-sm hover:bg-[#efe9d9] disabled:opacity-45"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="일시정지"
            title="일시정지 (Esc)"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="w-10 h-10 rounded-xl bg-[#fbf8ef]/94 border border-[#d6cdb8] text-[#223b34] flex items-center justify-center shadow-sm hover:bg-[#efe9d9]"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BOTTOM UNIFIED COLLAPSIBLE CONTROL DOCK */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          tabIndex={-1}
          aria-label={dockCollapsed ? '도구 패널 펼치기' : '도구 패널 접기'}
          onClick={(e) => {
            e.currentTarget.blur();
            setDockCollapsed((v) => !v);
          }}
          className="pointer-events-auto mb-1.5 px-3 py-1 rounded-t-lg rounded-b-md bg-[#fbf8ef]/92 border border-[#d6cdb8] text-[11px] font-semibold text-[#314a42] flex items-center gap-1 hover:bg-[#efe9d9]"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? '도구 펼치기' : '도구 접기'}</span>
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-[760px] rounded-2xl bg-[#fbf8ef]/95 border border-[#d6cdb8] shadow-[0_12px_36px_rgba(14,32,27,0.24)] px-3 py-2.5">
            {/* Stability Gauge + Active Tool Hint */}
            <div className="flex items-center justify-between gap-3 mb-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-[#233d35] whitespace-nowrap">
                  깃발 지지 {Math.round(supportRatio * 100)}% ({riskLabel})
                </span>
                <div className="w-24 sm:w-32 h-2 rounded-full bg-[#e3dccb] overflow-hidden shrink-0">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${Math.round(supportRatio * 100)}%`, backgroundColor: riskColor }}
                  />
                </div>
              </div>
              <span className="hidden sm:inline text-[11px] text-[#5e7067] truncate">
                {TOOLS[selectedTool].hint}
              </span>
            </div>

            {/* 6 Tools + Compact Camera Controls */}
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-6 gap-1.5 flex-1">
                {TOOL_ORDER.map((tid) => {
                  const spec = TOOLS[tid];
                  const active = selectedTool === tid;
                  return (
                    <button
                      key={tid}
                      type="button"
                      disabled={isPlayerLocked}
                      tabIndex={-1}
                      aria-label={`${spec.label} 도구 (${spec.shortRole})`}
                      aria-pressed={active}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onSelectTool(tid);
                      }}
                      className={`relative flex flex-col items-center justify-center min-h-[54px] px-1 py-1.5 rounded-xl border transition-colors ${
                        active
                          ? 'bg-[#dfefe8] border-[#24634e] text-[#173f32] font-bold'
                          : 'bg-[#fffdf7] border-[#ddd6c4] text-[#354c43] hover:bg-[#f2ecdd]'
                      } disabled:opacity-50`}
                    >
                      <span className="hidden sm:block absolute top-1 right-1.5 text-[9px] font-mono-num text-[#7b8980]">
                        {spec.keyHint}
                      </span>
                      <ToolIconSvg tool={tid} className="w-6 h-6" />
                      <span className="text-[11px] leading-tight mt-0.5 whitespace-nowrap">
                        {spec.label}
                      </span>
                      <span className="hidden md:block text-[9px] text-[#66776e] truncate max-w-full">
                        {spec.shortRole}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-[#e0d8c6] shrink-0">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="시점 왼쪽 회전"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onRotate(-0.42);
                  }}
                  className="w-9 h-10 rounded-xl bg-[#fffdf7] border border-[#ddd6c4] text-[#28423a] flex items-center justify-center hover:bg-[#efe9d9]"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="시점 오른쪽 회전"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onRotate(0.42);
                  }}
                  className="w-9 h-10 rounded-xl bg-[#fffdf7] border border-[#ddd6c4] text-[#28423a] flex items-center justify-center hover:bg-[#efe9d9]"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="확대"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onZoom(0.84);
                  }}
                  className="w-9 h-10 rounded-xl bg-[#fffdf7] border border-[#ddd6c4] text-[#28423a] flex items-center justify-center hover:bg-[#efe9d9]"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="축소"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onZoom(1.18);
                  }}
                  className="w-9 h-10 rounded-xl bg-[#fffdf7] border border-[#ddd6c4] text-[#28423a] flex items-center justify-center hover:bg-[#efe9d9]"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="시점 초기화"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onResetView();
                  }}
                  className="px-2.5 h-10 rounded-xl bg-[#fffdf7] border border-[#ddd6c4] text-[11px] font-semibold text-[#28423a] hover:bg-[#efe9d9] whitespace-nowrap"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
