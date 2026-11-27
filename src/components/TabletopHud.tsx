import React from 'react';
import { Pause, RotateCcw, RotateCw, Scissors, Settings, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { TOOL_ORDER, TOOLS } from '../game/content';
import { formatGrams } from '../game/engine';
import type { GamePhase, ToolId } from '../game/types';
import { ToolIconSvg } from './GameIcons';

interface TabletopHudProps {
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
  toolP0: ToolId;
  toolP1: ToolId;
  cut: boolean;
  autoFlip: boolean;
  muted: boolean;
  onSelectTool: (player: 0 | 1, tool: ToolId) => void;
  onRotate: (dYaw: number) => void;
  onToggleCut: () => void;
  onToggleAutoFlip: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onPause: () => void;
}

interface PlayerEdgeDockProps {
  player: 0 | 1;
  inverted: boolean;
  isActiveTurn: boolean;
  phase: GamePhase;
  scoreGrams: number;
  harvestGrams: number;
  supportRatio: number;
  turnClockText: string;
  matchClockText: string;
  round: number;
  selectedTool: ToolId;
  cut: boolean;
  onSelectTool: (tool: ToolId) => void;
  onRotate: (dYaw: number) => void;
  onToggleCut: () => void;
}

const PlayerEdgeDock: React.FC<PlayerEdgeDockProps> = ({
  player,
  inverted,
  isActiveTurn,
  phase,
  scoreGrams,
  harvestGrams,
  supportRatio,
  turnClockText,
  matchClockText,
  round,
  selectedTool,
  cut,
  onSelectTool,
  onRotate,
  onToggleCut,
}) => {
  const locked = !isActiveTurn || phase !== 'observe';
  const accentBg = player === 0 ? 'bg-[#24634e]' : 'bg-[#bd593d]';
  const accentBorder = player === 0 ? 'border-[#2c755d]' : 'border-[#c96244]';
  const accentSoft = player === 0 ? 'bg-[#dfefe8] text-[#1a4a3a]' : 'bg-[#f6e3dc] text-[#7a311d]';
  const riskColor = supportRatio > 0.65 ? '#2f8564' : supportRatio > 0.38 ? '#d68a32' : '#c94a38';

  const statusText = !isActiveTurn
    ? '상대 차례 대기'
    : phase === 'dig'
      ? `채굴 중 · +${formatGrams(harvestGrams)}g`
      : phase === 'settle'
        ? '모래 안정화 중'
        : '내 차례 · 터치해 채굴';

  return (
    <div
      data-testid={`tabletop-dock-p${player}`}
      className={`pointer-events-auto w-full max-w-[680px] mx-auto transition-opacity duration-200 ${
        inverted ? 'rotate-180' : ''
      } ${isActiveTurn ? 'opacity-100' : 'opacity-65'}`}
    >
      <div
        className={`rounded-2xl border-2 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-[0_8px_28px_rgba(12,26,22,0.28)] overflow-hidden ${
          isActiveTurn
            ? `bg-[#fbf8ef]/95 ${accentBorder}`
            : 'bg-[#ebe6d9]/90 border-[#cdc6b5]'
        }`}
      >
        {/* Compact Status & Score Row */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-[#fbf8ef] shrink-0 ${accentBg}`}
            >
              {player + 1}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#1b332d] truncate">
                <span className="shrink-0">P{player + 1}</span>
                <span className="text-[#88948a]" aria-hidden="true">·</span>
                <span className={`truncate ${isActiveTurn ? 'text-[#215946]' : 'text-[#6c7970]'}`}>
                  {statusText}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#66756d] font-mono-num">
                <span>R{String(round).padStart(2, '0')}</span>
                <span aria-hidden="true">·</span>
                <span>{matchClockText}</span>
                <span aria-hidden="true">·</span>
                <span>지지 {Math.round(supportRatio * 100)}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Compact Flag Stability Bar */}
            <div className="hidden sm:flex flex-col items-end gap-0.5 w-20">
              <span className="text-[10px] font-semibold text-[#5a6b62] font-mono-num">
                {turnClockText}
              </span>
              <div className="w-full h-1.5 rounded-full bg-[#ded8c8] overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${Math.round(supportRatio * 100)}%`, backgroundColor: riskColor }}
                />
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono-num text-base sm:text-xl font-bold text-[#182e29] leading-none">
                {formatGrams(scoreGrams)}
              </span>
              <span className="text-[11px] font-semibold text-[#64736b] ml-0.5">g</span>
            </div>
          </div>
        </div>

        {/* Interactive Tool & View Row (Guaranteed fit inside 390px phone viewport) */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <div className="grid grid-cols-6 gap-0.5 sm:gap-1 flex-1 min-w-0">
            {TOOL_ORDER.map((tid) => {
              const spec = TOOLS[tid];
              const selected = selectedTool === tid;
              return (
                <button
                  key={tid}
                  type="button"
                  disabled={locked}
                  tabIndex={-1}
                  aria-label={`플레이어 ${player + 1} ${spec.label} 도구 선택`}
                  aria-pressed={selected}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectTool(tid);
                  }}
                  className={`min-w-0 flex flex-col items-center justify-center min-h-[40px] sm:min-h-[42px] px-0.5 sm:px-1 py-1 rounded-lg sm:rounded-xl border transition-colors ${
                    selected
                      ? `${accentSoft} ${accentBorder} font-bold`
                      : 'bg-[#fffdf7] border-[#ddd6c4] text-[#354c43] hover:bg-[#f2ecdd]'
                  } disabled:opacity-60`}
                >
                  <ToolIconSvg tool={tid} className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="text-[9px] sm:text-[10px] leading-tight mt-0.5 truncate max-w-full">
                    {spec.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* One-Thumb Camera Rotate & Cross-Section Controls for this Side */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 pl-1 border-l border-[#ddd5c2]">
            <button
              type="button"
              disabled={!isActiveTurn || phase === 'dig'}
              tabIndex={-1}
              aria-label={`플레이어 ${player + 1} 왼쪽 회전`}
              onClick={(e) => {
                e.currentTarget.blur();
                onRotate(inverted ? 0.45 : -0.45);
              }}
              className="w-7 sm:w-9 h-[40px] sm:h-[42px] flex items-center justify-center rounded-lg sm:rounded-xl bg-[#fffdf7] border border-[#ddd6c4] text-[#28423a] hover:bg-[#efe9d9] disabled:opacity-45"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              disabled={!isActiveTurn || phase === 'dig'}
              tabIndex={-1}
              aria-label={`플레이어 ${player + 1} 오른쪽 회전`}
              onClick={(e) => {
                e.currentTarget.blur();
                onRotate(inverted ? -0.45 : 0.45);
              }}
              className="w-7 sm:w-9 h-[40px] sm:h-[42px] flex items-center justify-center rounded-lg sm:rounded-xl bg-[#fffdf7] border border-[#ddd6c4] text-[#28423a] hover:bg-[#efe9d9] disabled:opacity-45"
            >
              <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              disabled={!isActiveTurn || phase !== 'observe'}
              tabIndex={-1}
              aria-label={`플레이어 ${player + 1} 단면 보기 전환`}
              aria-pressed={cut}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleCut();
              }}
              className={`w-7 sm:w-9 h-[40px] sm:h-[42px] flex items-center justify-center rounded-lg sm:rounded-xl border transition-colors disabled:opacity-45 ${
                cut
                  ? 'bg-[#1d3832] border-[#1d3832] text-[#fbf8ef]'
                  : 'bg-[#fffdf7] border-[#ddd6c4] text-[#28423a] hover:bg-[#efe9d9]'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TabletopHud: React.FC<TabletopHudProps> = ({
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
  toolP0,
  toolP1,
  cut,
  autoFlip,
  muted,
  onSelectTool,
  onRotate,
  onToggleCut,
  onToggleAutoFlip,
  onToggleMute,
  onOpenSettings,
  onPause,
}) => {
  return (
    <div
      data-testid="tabletop-hud"
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between px-2 py-2 sm:px-4 sm:py-3"
    >
      {/* TOP EDGE: Player 2 Inverted 180deg Controls */}
      <PlayerEdgeDock
        player={1}
        inverted={true}
        isActiveTurn={activePlayer === 1}
        phase={phase}
        scoreGrams={scoresGrams[1]}
        harvestGrams={harvestGrams}
        supportRatio={supportRatio}
        turnClockText={turnClockText}
        matchClockText={matchClockText}
        round={round}
        selectedTool={toolP1}
        cut={cut}
        onSelectTool={(t) => onSelectTool(1, t)}
        onRotate={onRotate}
        onToggleCut={onToggleCut}
      />

      {/* MID-RIGHT COMPACT SHARED UTILITY STRIP (Never blocks center 3D mound) */}
      <div className="pointer-events-none flex items-center justify-between px-1">
        <div className="hidden sm:block text-xs font-semibold text-[#1b332d]/90 drop-shadow-[0_1px_2px_rgba(255,252,242,0.9)]">
          {stageName} · {sedimentName} · 마주보기 2P
        </div>
        <div className="pointer-events-auto ml-auto flex flex-col gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            aria-label={autoFlip ? '턴 교대 시 3D 화면 자동 회전 끄기' : '턴 교대 시 3D 화면 자동 회전 켜기'}
            aria-pressed={autoFlip}
            title="턴마다 3D 화면 180° 자동 회전"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleAutoFlip();
            }}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-sm transition-colors ${
              autoFlip
                ? 'bg-[#1d3832] border-[#e4c274] text-[#f7e1a0]'
                : 'bg-[#fbf8ef]/92 border-[#cfc6b0] text-[#264038]'
            }`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? '소리 켜기' : '음소거'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-10 h-10 rounded-xl bg-[#fbf8ef]/92 border border-[#cfc6b0] text-[#264038] flex items-center justify-center shadow-sm hover:bg-[#efe9d9]"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="경기 설정 열기"
            disabled={phase !== 'observe'}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSettings();
            }}
            className="w-10 h-10 rounded-xl bg-[#fbf8ef]/92 border border-[#cfc6b0] text-[#264038] flex items-center justify-center shadow-sm hover:bg-[#efe9d9] disabled:opacity-45"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="일시정지"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="w-10 h-10 rounded-xl bg-[#fbf8ef]/92 border border-[#cfc6b0] text-[#264038] flex items-center justify-center shadow-sm hover:bg-[#efe9d9]"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BOTTOM EDGE: Player 1 Upright Controls */}
      <PlayerEdgeDock
        player={0}
        inverted={false}
        isActiveTurn={activePlayer === 0}
        phase={phase}
        scoreGrams={scoresGrams[0]}
        harvestGrams={harvestGrams}
        supportRatio={supportRatio}
        turnClockText={turnClockText}
        matchClockText={matchClockText}
        round={round}
        selectedTool={toolP0}
        cut={cut}
        onSelectTool={(t) => onSelectTool(0, t)}
        onRotate={onRotate}
        onToggleCut={onToggleCut}
      />
    </div>
  );
};
