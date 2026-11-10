import React, { useState } from 'react';
import { Play, RotateCcw, Share2, Award, Check, Radio } from 'lucide-react';
import { GameModeId, PuzzleBoard } from '../utils/puzzleGenerator';

interface TitleScreenProps {
  selectedMode: GameModeId;
  onSelectMode: (mode: GameModeId) => void;
  onStartGame: () => void;
  onOpenConnectModal: () => void;
  isLiveConnected?: boolean;
  connectedHandle?: string;
  dailyNumber: number;
  dateLabel: string;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedMode,
  onSelectMode,
  onStartGame,
  onOpenConnectModal,
  isLiveConnected,
  connectedHandle,
  dailyNumber,
  dateLabel,
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-between p-6 sm:p-10 bg-[radial-gradient(circle_at_50%_28%,#4B1276_0%,#24073B_55%,#12031F_100%)] text-[#F5F3F7] overflow-y-auto border-[5px] border-[#D4A437]">
      {/* Top Quiet Metadata Line + TikTok Connect Trigger */}
      <div className="w-full max-w-4xl flex items-center justify-between gap-4 text-xs text-[#D6CBE2] font-mono tabular-nums tracking-wide">
        <div className="flex items-center gap-2">
          <span>Daily Puzzle #{dailyNumber}</span>
          <span aria-hidden="true">·</span>
          <span>{dateLabel}</span>
        </div>

        <button
          type="button"
          onClick={onOpenConnectModal}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-sans font-semibold transition-colors cursor-pointer ${
            isLiveConnected
              ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300'
              : 'bg-white/10 hover:bg-white/15 border-[#E6BE5A]/40 text-[#F6C915]'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isLiveConnected ? 'text-emerald-400 animate-pulse' : ''}`} />
          <span>
            {isLiveConnected && connectedHandle
              ? `LIVE · @${connectedHandle.replace(/^@+/, '')}`
              : 'Connect'}
          </span>
        </button>
      </div>

      {/* Centerpiece Emblem + Bespoke SVG Lockup */}
      <div className="flex flex-col items-center text-center max-w-xl my-auto py-4 space-y-6">
        {/* Uploaded Emblem Showcase */}
        <div className="relative group">
          <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-[#F6C915]/30 via-[#A855F7]/20 to-transparent blur-xl pointer-events-none" />
          {!imgError ? (
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece — Find Your Space Emblem"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="relative w-40 h-40 sm:w-48 sm:h-48 object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.65)] transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-b from-[#F4F5F8] to-[#CFD3DC] p-4 flex items-center justify-center shadow-2xl border-4 border-[#F6C915]">
              <div className="w-full h-full rounded-full bg-[#3B0B5E] flex items-center justify-center text-[#F6C915] font-display font-extrabold text-3xl">
                ★
              </div>
            </div>
          )}
        </div>

        {/* Bespoke Inline SVG Title Lockup */}
        <div className="space-y-2">
          <svg
            viewBox="0 0 520 76"
            className="w-full max-w-[440px] h-auto mx-auto overflow-visible"
            role="img"
            aria-label="The Missing Piece — Squaredle Edition"
          >
            <defs>
              <linearGradient id="titleGold" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFF3B0" />
                <stop offset="45%" stopColor="#F6C915" />
                <stop offset="100%" stopColor="#C98F1E" />
              </linearGradient>
            </defs>
            <text
              x="260"
              y="44"
              textAnchor="middle"
              fill="url(#titleGold)"
              className="font-display font-extrabold"
              style={{
                fontSize: '42px',
                letterSpacing: '0.05em',
                filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))',
              }}
            >
              THE MISSING PIECE
            </text>
            <text
              x="260"
              y="68"
              textAnchor="middle"
              fill="#E5DEEE"
              className="font-sans font-semibold"
              style={{
                fontSize: '13px',
                letterSpacing: '0.28em',
              }}
            >
              FIND YOUR SPACE · WORD GRID PUZZLE
            </text>
          </svg>

          <p className="text-sm text-[#D6CBE2] max-w-md mx-auto leading-relaxed">
            Connect adjacent letters horizontally, vertically, or diagonally to uncover every hidden word. Tiles dim automatically once all their words are found.
          </p>
        </div>

        {/* Mode Selector Segmented Bar */}
        <div className="flex items-center gap-1.5 p-1.5 bg-[#19042B]/90 border border-[#E6BE5A]/30 rounded-xl shadow-inner">
          {(
            [
              { id: 'express-3x3', label: 'Express 3×3' },
              { id: 'daily-4x4', label: 'Daily 4×4' },
              { id: 'royal-5x5', label: 'Royal 5×5' },
            ] as const
          ).map((m) => {
            const active = selectedMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMode(m.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-gradient-to-b from-[#FFE055] to-[#E5B012] text-[#1D0830] shadow-md'
                    : 'text-[#D6CBE2] hover:text-white hover:bg-white/5'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Primary Start CTA */}
        <button
          type="button"
          onClick={onStartGame}
          className="flex items-center justify-center gap-3 px-9 py-3.5 rounded-xl bg-gradient-to-b from-[#FFE566] via-[#F6C915] to-[#D49B27] text-[#1D0830] font-display font-extrabold text-base tracking-wide shadow-[0_10px_28px_rgba(246,201,21,0.4),inset_0_2px_1px_rgba(255,255,255,0.8)] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Play Today’s Board</span>
        </button>
      </div>

      {/* Single Flat Control-Hint Line */}
      <div className="text-xs text-[#B9A8CC] font-mono text-center tracking-wide">
        Swipe / Drag Letters · Type on Keyboard · Space Revolve Board · Enter Submit · Esc Pause
      </div>
    </div>
  );
};

interface PauseOrVictoryModalProps {
  type: 'PAUSED' | 'VICTORY';
  puzzle: PuzzleBoard;
  score: number;
  foundCount: number;
  totalRequired: number;
  bonusCount: number;
  foundFeatured: boolean;
  onResume: () => void;
  onNewSeededBoard: () => void;
  onSwitchMode: (mode: GameModeId) => void;
  onOpenConnectModal: () => void;
  isLiveConnected?: boolean;
  onReturnTitle: () => void;
}

export const PauseOrVictoryModal: React.FC<PauseOrVictoryModalProps> = ({
  type,
  puzzle,
  score,
  foundCount,
  totalRequired,
  bonusCount,
  foundFeatured,
  onResume,
  onNewSeededBoard,
  onSwitchMode,
  onOpenConnectModal,
  isLiveConnected,
  onReturnTitle,
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const pct = totalRequired > 0 ? Math.round((foundCount / totalRequired) * 100) : 0;
    const text = [
      `🧩 The Missing Piece — ${puzzle.title} #${puzzle.puzzleNumber}`,
      `Score: ${score} pts · Words: ${foundCount}/${totalRequired} (${pct}%)`,
      `Bonus Words: +${bonusCount} · ★ Missing Piece: ${foundFeatured ? 'Found!' : 'Hidden'}`,
      `🟪🟨⬜ Find Your Space`,
    ].join('\n');

    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-md rounded-2xl bg-gradient-to-b from-[#2B0948] to-[#1A042D] border-2 border-[#D4A437] p-6 text-[#F5F3F7] shadow-[0_24px_60px_rgba(0,0,0,0.75)] space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar animate-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div>
            <h2 className="font-display font-extrabold text-xl text-[#F6C915]">
              {type === 'VICTORY' ? 'Puzzle Complete — Space Found!' : 'Game Menu & Guide'}
            </h2>
            <p className="text-xs text-[#D6CBE2] mt-0.5">
              {puzzle.title} · #{puzzle.puzzleNumber} · {puzzle.dateLabel}
            </p>
          </div>
          <Award className="w-7 h-7 text-[#F6C915] shrink-0" />
        </div>

        {/* Tabular Stats Summary */}
        <div className="grid grid-cols-3 gap-3 text-center bg-[#150324]/80 p-3 rounded-xl border border-white/10">
          <div>
            <div className="text-[11px] text-[#B9A8CC]">Total Score</div>
            <div className="font-mono font-bold text-lg text-[#F6C915] tabular-nums">
              {score} pts
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#B9A8CC]">Words Found</div>
            <div className="font-mono font-bold text-lg text-[#F5F3F7] tabular-nums">
              {foundCount}/{totalRequired}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#B9A8CC]">Bonus Words</div>
            <div className="font-mono font-bold text-lg text-[#E6BE5A] tabular-nums">
              +{bonusCount}
            </div>
          </div>
        </div>

        {/* Tile Indicators Guide (What Pips & Corner Badges Mean) */}
        <div className="p-3.5 rounded-xl bg-[#1F0535]/90 border border-white/10 space-y-1.5 text-xs">
          <div className="font-semibold text-[#F6C915]">What Tile Indicators Mean</div>
          <div className="text-[#D6CBE2] leading-relaxed space-y-1">
            <p>
              <span className="font-mono font-bold text-[#F5F3F7]">Bottom Pips (• • •):</span> Each pip represents a remaining unfound required word that passes through that letter tile (up to 5+ pips). When all pips are cleared, the tile dims out!
            </p>
            <p>
              <span className="font-mono font-bold text-[#F5F3F7]">Top-Right Number:</span> Shows how many remaining unfound words <em>start</em> on that tile.
            </p>
          </div>
        </div>

        {/* Scoring Breakdown */}
        <div className="space-y-1 text-xs text-[#D6CBE2]">
          <div className="font-semibold text-[#F5F3F7]">Length Scoring System</div>
          <div className="font-mono text-[11px] text-[#C8B8DA] leading-relaxed">
            4L = 1 pt · 5L = 2 pts · 6L = 4 pts · 7L = 7 pts · 8+L = 11+ pts · ★ Featured = +5 Bonus pts
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-[#F5F3F7]">Switch Grid Size</div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'express-3x3', label: '3×3 Express' },
                { id: 'daily-4x4', label: '4×4 Daily' },
                { id: 'royal-5x5', label: '5×5 Royal' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSwitchMode(m.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  puzzle.mode === m.id
                    ? 'bg-[#F6C915] text-[#1D0830]'
                    : 'bg-white/10 text-[#D6CBE2] hover:bg-white/15'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onResume}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-b from-[#FFE566] to-[#E5B012] text-[#1D0830] font-display font-bold text-sm hover:brightness-105 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{type === 'VICTORY' ? 'Inspect Board' : 'Resume'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenConnectModal}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isLiveConnected
                ? 'bg-emerald-950/80 border border-emerald-400/50 text-emerald-300'
                : 'bg-white/10 hover:bg-white/15 text-[#F6C915]'
            }`}
          >
            <Radio className={`w-4 h-4 ${isLiveConnected ? 'text-emerald-400 animate-pulse' : ''}`} />
            <span>{isLiveConnected ? 'Live Settings' : 'Connect'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F5F3F7] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>

          <button
            type="button"
            onClick={onNewSeededBoard}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#E6BE5A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Play previous daily puzzle board"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Prev Day</span>
          </button>
        </div>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onReturnTitle}
            className="text-xs text-[#B9A8CC] hover:text-white underline cursor-pointer"
          >
            Return to Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};
