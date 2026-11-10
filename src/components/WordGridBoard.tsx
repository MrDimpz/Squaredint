import React, { useRef, useState, useEffect, useCallback } from 'react';
import { areCellsAdjacent } from '../utils/puzzleGenerator';
import { soundEngine } from '../utils/sound';

interface WordGridBoardProps {
  grid: string[];
  size: number;
  activePath: number[];
  onPathChange: (newPath: number[]) => void;
  onSubmitPath: (path: number[]) => void;
  remainingStartsPerCell: number[];
  remainingUsesPerCell: number[];
  showStartBadges: boolean;
  hintedPath: number[] | null;
  hintedCells: Set<number>;
  rotationSteps: number; // Monotonically increasing 90-deg steps (0, 1, 2, 3, 4...)
  boardDarkMode: boolean; // Toggles the game board & tiles between Dark and Light board themes
  shakeTrigger: number;
}

export const WordGridBoard: React.FC<WordGridBoardProps> = ({
  grid,
  size,
  activePath,
  onPathChange,
  onSubmitPath,
  remainingStartsPerCell,
  remainingUsesPerCell,
  showStartBadges,
  hintedPath,
  hintedCells,
  rotationSteps,
  boardDarkMode,
  shakeTrigger,
}) => {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isDraggingRef = useRef<boolean>(false);
  const [pointerLocalPos, setPointerLocalPos] = useState<{ x: number; y: number } | null>(null);
  const [boardPx, setBoardPx] = useState<number>(360);

  const rotationAngle = rotationSteps * 90;

  // Measure unrotated local board width/height for SVG coordinate system
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const updateSize = () => {
      if (el.clientWidth > 0) {
        setBoardPx(el.clientWidth);
      }
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [size]);

  // Compute center (x, y) in local board coordinates for a given cell index
  const getCellLocalCenter = useCallback(
    (index: number, totalPx: number) => {
      const padding = 12; // p-3 = 12px
      const gap = size === 5 ? 8 : 10;
      const innerSpan = totalPx - padding * 2;
      const cellSize = (innerSpan - gap * (size - 1)) / size;

      const row = Math.floor(index / size);
      const col = index % size;

      const x = padding + col * (cellSize + gap) + cellSize / 2;
      const y = padding + row * (cellSize + gap) + cellSize / 2;
      return { x, y, cellSize };
    },
    [size]
  );

  // Convert screen (clientX, clientY) into local board coordinates (accounting for current rotationAngle)
  const screenToLocalCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = boardRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;

      // Inverse rotate by -rotationAngle around center
      const rad = (-rotationAngle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const localDx = dx * cos - dy * sin;
      const localDy = dx * sin + dy * cos;

      const half = el.clientWidth / 2;
      return {
        x: Math.max(0, Math.min(el.clientWidth, half + localDx)),
        y: Math.max(0, Math.min(el.clientHeight, half + localDy)),
      };
    },
    [rotationAngle]
  );

  // Hit-test pointer coordinates against circular tile zones using live DOM tile rects
  const getCellFromClientCoords = useCallback(
    (clientX: number, clientY: number, isInitialTouch: boolean): number | null => {
      const totalCells = size * size;
      let closestIdx: number | null = null;
      let closestDist = Infinity;

      for (let i = 0; i < totalCells; i++) {
        const tileEl = tileRefs.current[i];
        if (!tileEl) continue;
        const rect = tileEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(clientX - cx, clientY - cy);

        // Initial touch uses generous 54% radius; mid-swipe uses 41% radius so diagonal channels are wide open
        const hitRadius = isInitialTouch ? rect.width * 0.54 : rect.width * 0.41;
        if (dist <= hitRadius && dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      return closestIdx;
    },
    [size]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();

    const el = boardRef.current;
    if (el) {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure on synthetic events
      }
    }

    const hitIdx = getCellFromClientCoords(e.clientX, e.clientY, true);
    if (hitIdx === null) return;

    isDraggingRef.current = true;
    setPointerLocalPos(screenToLocalCoords(e.clientX, e.clientY));

    // Start fresh swipe path on pointer down
    onPathChange([hitIdx]);
    soundEngine.playTileSelect(0);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();

    setPointerLocalPos(screenToLocalCoords(e.clientX, e.clientY));

    const hitIdx = getCellFromClientCoords(e.clientX, e.clientY, false);
    if (hitIdx === null || activePath.length === 0) return;

    const lastIdx = activePath[activePath.length - 1];
    if (hitIdx === lastIdx) return;

    // Check if user dragged backward to the previous tile (undo last step)
    if (activePath.length >= 2 && hitIdx === activePath[activePath.length - 2]) {
      const shortened = activePath.slice(0, -1);
      onPathChange(shortened);
      soundEngine.playBacktrack();
      return;
    }

    // Check if user dragged onto an earlier tile in the chain (truncate back to that tile)
    const existingPos = activePath.indexOf(hitIdx);
    if (existingPos !== -1 && existingPos < activePath.length - 1) {
      const truncated = activePath.slice(0, existingPos + 1);
      onPathChange(truncated);
      soundEngine.playBacktrack();
      return;
    }

    // Otherwise, if adjacent to the last tile and not yet visited, add it!
    if (!activePath.includes(hitIdx) && areCellsAdjacent(lastIdx, hitIdx, size)) {
      const nextPath = [...activePath, hitIdx];
      onPathChange(nextPath);
      soundEngine.playTileSelect(nextPath.length - 1);
    }
  };

  const finishSwipe = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setPointerLocalPos(null);

    if (activePath.length >= 2) {
      onSubmitPath(activePath);
    } else {
      // Single tap clears after brief visual feedback
      setTimeout(() => {
        onPathChange([]);
      }, 140);
    }
  }, [activePath, onSubmitPath, onPathChange]);

  useEffect(() => {
    const handleGlobalUp = () => {
      if (isDraggingRef.current) {
        finishSwipe();
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [finishSwipe]);

  const pathToRender = activePath.length > 0 ? activePath : hintedPath || [];
  const isHintLine = activePath.length === 0 && Boolean(hintedPath && hintedPath.length > 0);

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Shake wrapper */}
      <div
        key={shakeTrigger}
        className={shakeTrigger > 0 ? 'animate-shake' : ''}
      >
        {/* 5px Gold Outer Border + 5px White Ceramic Ring */}
        <div
          style={{
            transform: `rotate(${rotationAngle}deg)`,
            transition: 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
          }}
          className="relative p-[5px] rounded-[28px] border-[5px] border-[#D4A437] bg-gradient-to-b from-[#FFFFFF] via-[#F2F4F8] to-[#DCE0E8] shadow-[0_18px_45px_rgba(0,0,0,0.55)]"
        >
          {/* Inner Game Board Recess Well (responds to boardDarkMode toggle) */}
          <div
            ref={boardRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishSwipe}
            style={{
              touchAction: 'none',
            }}
            className={`relative p-3 rounded-[20px] transition-colors duration-200 cursor-pointer ${
              boardDarkMode
                ? 'bg-gradient-to-br from-[#12031F] via-[#19052B] to-[#0B0114] shadow-[inset_0_6px_20px_rgba(0,0,0,0.9)]'
                : 'bg-gradient-to-br from-[#350954] via-[#460F6D] to-[#280540] shadow-[inset_0_6px_18px_rgba(0,0,0,0.7)]'
            } ${
              size === 3
                ? 'w-[290px] h-[290px] sm:w-[346px] sm:h-[346px]'
                : size === 5
                  ? 'w-[320px] h-[320px] sm:w-[404px] sm:h-[404px]'
                  : 'w-[310px] h-[310px] sm:w-[384px] sm:h-[384px]'
            }`}
          >
            {/* SVG Path Connection Overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              viewBox={`0 0 ${boardPx} ${boardPx}`}
            >
              <defs>
                <linearGradient id="goldSwipeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FDE047" />
                  <stop offset="50%" stopColor="#F6C915" />
                  <stop offset="100%" stopColor="#D99B26" />
                </linearGradient>
                <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F6C915" floodOpacity="0.55" />
                </filter>
              </defs>

              {/* Rubber-band line from last active tile to live finger/cursor position */}
              {activePath.length > 0 && pointerLocalPos && (
                <line
                  x1={getCellLocalCenter(activePath[activePath.length - 1], boardPx).x}
                  y1={getCellLocalCenter(activePath[activePath.length - 1], boardPx).y}
                  x2={pointerLocalPos.x}
                  y2={pointerLocalPos.y}
                  stroke="#F6C915"
                  strokeWidth={size === 5 ? 6 : 8}
                  strokeLinecap="round"
                  strokeOpacity={0.38}
                  strokeDasharray="2 8"
                />
              )}

              {/* Main connected polyline between selected tiles */}
              {pathToRender.length >= 2 && (
                <polyline
                  fill="none"
                  stroke={isHintLine ? '#A855F7' : 'url(#goldSwipeGrad)'}
                  strokeWidth={size === 5 ? 9 : 11}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={isHintLine ? 0.75 : 0.92}
                  strokeDasharray={isHintLine ? '8 6' : undefined}
                  filter="url(#goldGlow)"
                  points={pathToRender
                    .map((idx) => {
                      const c = getCellLocalCenter(idx, boardPx);
                      return `${c.x},${c.y}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Node dots on connected path */}
              {pathToRender.map((idx, step) => {
                const c = getCellLocalCenter(idx, boardPx);
                return (
                  <circle
                    key={`node-${idx}-${step}`}
                    cx={c.x}
                    cy={c.y}
                    r={step === 0 ? 6 : 4.5}
                    fill={step === 0 ? '#FFFBEB' : '#1F0933'}
                    stroke="#F6C915"
                    strokeWidth={2.5}
                  />
                );
              })}
            </svg>

            {/* Grid Cells */}
            <div
              className="grid w-full h-full"
              style={{
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
                gap: size === 5 ? '8px' : '10px',
              }}
            >
              {grid.map((letter, idx) => {
                const stepIndex = activePath.indexOf(idx);
                const isSelected = stepIndex !== -1;
                const isFirstSelected = stepIndex === 0;
                const isLastSelected = stepIndex === activePath.length - 1 && activePath.length > 0;
                const isHintedCell = hintedCells.has(idx) || (hintedPath && hintedPath[0] === idx);

                const remainingStarts = remainingStartsPerCell[idx] ?? 0;
                const remainingUses = remainingUsesPerCell[idx] ?? 1;
                const isDepleted = remainingUses === 0;

                return (
                  <div
                    key={idx}
                    ref={(el) => {
                      tileRefs.current[idx] = el;
                    }}
                    data-cell-index={idx}
                    title={
                      isDepleted
                        ? 'All required words using this tile have been found'
                        : `${remainingStarts} remaining words start here · ${remainingUses} remaining words pass through this tile (bottom pips)`
                    }
                    className={`relative rounded-xl select-none transition-all duration-150 ${
                      isSelected
                        ? 'z-10 scale-[1.04] bg-gradient-to-br from-[#FFE566] via-[#F6C915] to-[#D49B27] text-[#1D0830] shadow-[0_0_18px_rgba(246,201,21,0.55),inset_0_1px_2px_rgba(255,255,255,0.9)] border-2 border-[#FFFBEB]'
                        : isDepleted
                          ? boardDarkMode
                            ? 'bg-[#0C0216]/80 text-[#583E70]/40 border border-[#2D1147]/35 shadow-inner'
                            : 'bg-[#24063A]/65 text-[#8A6FA0]/45 border border-[#58287F]/30 shadow-inner'
                          : isHintedCell
                            ? boardDarkMode
                              ? 'bg-gradient-to-br from-[#351454] to-[#230B3A] text-[#FDE047] border-2 border-[#F6C915] shadow-[0_0_15px_rgba(246,201,21,0.55)]'
                              : 'bg-gradient-to-br from-[#FAFBFD] to-[#E6E8F0] text-[#1E1B24] border-2 border-[#F6C915] shadow-[0_0_15px_rgba(246,201,21,0.55)]'
                            : boardDarkMode
                              ? 'bg-gradient-to-br from-[#2E1149] via-[#230B3A] to-[#170628] text-[#F5F3F7] border border-[#6E359E]/55 shadow-[0_4px_10px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.12)] hover:brightness-110'
                              : 'bg-gradient-to-br from-[#FFFFFF] via-[#F4F5F8] to-[#DFE3EC] text-[#1D1924] border border-white/85 shadow-[0_4px_10px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:brightness-105'
                    }`}
                  >
                    {/* Inner Upright Content Wrapper — Counter-rotates smoothly with zero flash or reset */}
                    <div
                      style={{
                        transform: `rotate(${-rotationAngle}deg)`,
                        transition: 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                      }}
                      className="w-full h-full flex items-center justify-center relative"
                    >
                      {/* Step order badge when selected (top-left) */}
                      {isSelected && (
                        <span className="absolute top-1 left-1.5 text-[10px] font-mono font-bold tabular-nums leading-none text-[#1D0830]/85">
                          {stepIndex + 1}
                        </span>
                      )}

                      {/* Remaining words starting on this tile (top-right, Squaredle style) */}
                      {showStartBadges && !isDepleted && remainingStarts > 0 && (
                        <span
                          className={`absolute top-1 right-1.5 text-[11px] font-mono font-bold tabular-nums leading-none ${
                            isSelected
                              ? 'text-[#1D0830]'
                              : boardDarkMode
                                ? 'text-[#F6C915]'
                                : 'text-[#5A188A]'
                          }`}
                        >
                          {remainingStarts}
                        </span>
                      )}

                      {/* Hinted starting star indicator */}
                      {isHintedCell && !isSelected && (
                        <span className="absolute bottom-1 left-1.5 text-[10px] font-mono font-bold text-[#F6C915]">
                          ★
                        </span>
                      )}

                      {/* Remaining usage pips bar at bottom of tile */}
                      {!isDepleted && !isSelected && remainingUses > 0 && (
                        <div className="absolute bottom-1 inset-x-3 flex items-center justify-center gap-0.5 opacity-55">
                          {Array.from({ length: Math.min(remainingUses, 5) }).map((_, dotIdx) => (
                            <span
                              key={dotIdx}
                              className={`w-1 h-1 rounded-full ${
                                boardDarkMode ? 'bg-[#E6BE5A]' : 'bg-[#4A1268]'
                              }`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Main Tile Letter — Increased by 50% */}
                      <span
                        className={`font-display font-extrabold tracking-tight leading-none ${
                          size === 3
                            ? 'text-[2.75rem] sm:text-[3.35rem]'
                            : size === 5
                              ? 'text-[1.85rem] sm:text-[2.25rem]'
                              : 'text-[2.25rem] sm:text-[2.8rem]'
                        } ${isFirstSelected || isLastSelected ? 'scale-105' : ''}`}
                      >
                        {letter}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
