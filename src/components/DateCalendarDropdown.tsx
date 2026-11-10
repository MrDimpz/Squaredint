import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Lock, CheckCircle2 } from 'lucide-react';
import { GameModeId } from '../utils/puzzleGenerator';

interface DateCalendarDropdownProps {
  selectedDateStr: string; // YYYY-MM-DD
  todayDateStr: string;    // YYYY-MM-DD
  minDateStr?: string;     // YYYY-MM-DD (default: 2024-01-01)
  currentMode: GameModeId;
  onSelectDate: (dateStr: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseYearMonthDay(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

function formatYMD(year: number, monthZeroIndexed: number, day: number): string {
  const m = String(monthZeroIndexed + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export const DateCalendarDropdown: React.FC<DateCalendarDropdownProps> = ({
  selectedDateStr,
  todayDateStr,
  minDateStr = '2024-01-01',
  currentMode,
  onSelectDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedParts = useMemo(() => parseYearMonthDay(selectedDateStr), [selectedDateStr]);
  const todayParts = useMemo(() => parseYearMonthDay(todayDateStr), [todayDateStr]);
  const minParts = useMemo(() => parseYearMonthDay(minDateStr), [minDateStr]);

  const [viewYear, setViewYear] = useState<number>(selectedParts.year);
  const [viewMonth, setViewMonth] = useState<number>(selectedParts.month);

  // Sync calendar month view when selectedDateStr changes externally
  useEffect(() => {
    setViewYear(selectedParts.year);
    setViewMonth(selectedParts.month);
  }, [selectedParts.year, selectedParts.month]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Check if previous or next month navigation is allowed
  const canGoPrevMonth =
    viewYear > minParts.year || (viewYear === minParts.year && viewMonth > minParts.month);
  const canGoNextMonth =
    viewYear < todayParts.year || (viewYear === todayParts.year && viewMonth < todayParts.month);

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNextMonth) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build calendar cells for current viewYear / viewMonth
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{
      day: number | null;
      dateStr: string;
      isUsable: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasSavedProgress: boolean;
    }> = [];

    // Leading empty slots
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        day: null,
        dateStr: `empty-prev-${i}`,
        isUsable: false,
        isToday: false,
        isSelected: false,
        hasSavedProgress: false,
      });
    }

    // Actual days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatYMD(viewYear, viewMonth, day);
      const isFuture = dateStr > todayDateStr;
      const isBeforeEpoch = dateStr < minDateStr;
      const isUsable = !isFuture && !isBeforeEpoch;

      let hasSavedProgress = false;
      if (isUsable && typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`missing_piece_save_${currentMode}-${dateStr}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.foundWords) && parsed.foundWords.length > 0) {
              hasSavedProgress = true;
            }
          }
        } catch {
          // Ignore storage error
        }
      }

      cells.push({
        day,
        dateStr,
        isUsable,
        isToday: dateStr === todayDateStr,
        isSelected: dateStr === selectedDateStr,
        hasSavedProgress,
      });
    }

    return cells;
  }, [viewYear, viewMonth, todayDateStr, minDateStr, selectedDateStr, currentMode]);

  const formattedTriggerLabel = useMemo(() => {
    if (selectedDateStr === todayDateStr) {
      return `Today (${MONTH_NAMES[selectedParts.month].slice(0, 3)} ${selectedParts.day})`;
    }
    return `${MONTH_NAMES[selectedParts.month].slice(0, 3)} ${selectedParts.day}, ${selectedParts.year}`;
  }, [selectedDateStr, todayDateStr, selectedParts]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          isOpen
            ? 'bg-[#F6C915] text-[#1D0830] border-[#D4A437] font-bold shadow-sm'
            : 'bg-white/10 hover:bg-white/15 text-[#F5F3F7] border-white/15'
        }`}
        title="Select Daily Puzzle Date"
      >
        <Calendar className="w-3.5 h-3.5 shrink-0 text-[#F6C915]" />
        <span className="tabular-nums">{formattedTriggerLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Calendar Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-gradient-to-b from-[#2B0948] to-[#18032B] border border-[#E6BE5A]/45 p-4 text-[#F5F3F7] shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 animate-pop">
          {/* Month / Year Navigation Bar */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canGoPrevMonth}
              className={`p-1.5 rounded-lg transition-colors ${
                canGoPrevMonth
                  ? 'hover:bg-white/10 text-[#F5F3F7] cursor-pointer'
                  : 'opacity-25 cursor-not-allowed text-[#8A759E]'
              }`}
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="font-display font-bold text-sm text-[#F6C915] tracking-wide">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={!canGoNextMonth}
              className={`p-1.5 rounded-lg transition-colors ${
                canGoNextMonth
                  ? 'hover:bg-white/10 text-[#F5F3F7] cursor-pointer'
                  : 'opacity-25 cursor-not-allowed text-[#8A759E]'
              }`}
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="text-[11px] font-mono font-semibold text-[#6E5687] dark:text-[#B9A8CC] py-1"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell) => {
              if (cell.day === null) {
                return <div key={cell.dateStr} className="h-9" />;
              }

              if (!cell.isUsable) {
                // Blocked out unusable date (future dates or pre-launch dates)
                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    disabled
                    title="Future puzzle locked until this date arrives"
                    className="relative h-9 rounded-lg flex flex-col items-center justify-center bg-[#F4F1F8] dark:bg-black/35 border border-[#E6DFEE] dark:border-white/5 text-[#9B8AB0]/55 dark:text-[#6E5A82]/45 cursor-not-allowed select-none"
                  >
                    <span className="text-xs font-mono tabular-nums line-through">
                      {cell.day}
                    </span>
                    <Lock className="w-2.5 h-2.5 opacity-45 mt-0.5" />
                  </button>
                );
              }

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => {
                    onSelectDate(cell.dateStr);
                    setIsOpen(false);
                  }}
                  className={`relative h-9 rounded-lg flex flex-col items-center justify-center font-mono text-xs tabular-nums transition-all cursor-pointer ${
                    cell.isSelected
                      ? 'bg-gradient-to-b from-[#FFE566] to-[#E5B012] text-[#1D0830] font-bold shadow-[0_0_12px_rgba(246,201,21,0.5)]'
                      : cell.isToday
                        ? 'bg-[#F3ECF9] dark:bg-[#46126E] text-[#3B0B5E] dark:text-[#F6C915] font-bold border border-[#D4A437] dark:border-[#F6C915]/70 hover:bg-[#E7DBF3] dark:hover:bg-[#571787]'
                        : 'bg-[#F6F3FA] dark:bg-white/8 text-[#1E0A33] dark:text-[#F5F3F7] hover:bg-[#E8DDF2] dark:hover:bg-white/18'
                  }`}
                >
                  <span>{cell.day}</span>
                  {cell.hasSavedProgress && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        cell.isSelected ? 'bg-[#1D0830]' : 'bg-emerald-500 dark:bg-emerald-400'
                      }`}
                      title="Played"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Legend & Quick Jump to Today */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#E5DCEF] dark:border-white/10 text-[11px] text-[#5B4373] dark:text-[#C8B8DA]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Played</span>
              </span>
              <span className="flex items-center gap-1 text-[#8A759E]">
                <Lock className="w-3 h-3" />
                <span>Locked</span>
              </span>
            </div>

            {selectedDateStr !== todayDateStr && (
              <button
                type="button"
                onClick={() => {
                  onSelectDate(todayDateStr);
                  setIsOpen(false);
                }}
                className="font-semibold text-[#9A6B00] dark:text-[#F6C915] hover:underline cursor-pointer"
              >
                Jump to Today
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
