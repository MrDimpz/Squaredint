import React from 'react';
import { BookOpen, Sparkles, Eye } from 'lucide-react';
import { FoundWordEntry } from '../utils/puzzleGenerator';
import { WordDefinition } from '../utils/dictionary';

interface WordListPanelProps {
  requiredWords: Map<string, FoundWordEntry>;
  foundWords: Set<string>;
  bonusWords: string[];
  revealedPrefixes: Map<string, number>; // word -> number of starting letters revealed
  showAllFirstLetters: boolean;
  onToggleFirstLetters: () => void;
  onInspectWord: (word: string, path?: number[]) => void;
  selectedWordDef: WordDefinition | null;
  isLoadingDef: boolean;
  inspectedWord: string | null;
}

export const WordListPanel: React.FC<WordListPanelProps> = ({
  requiredWords,
  foundWords,
  bonusWords,
  revealedPrefixes,
  showAllFirstLetters,
  onToggleFirstLetters,
  onInspectWord,
  selectedWordDef,
  isLoadingDef,
  inspectedWord,
}) => {
  // Group required words by length
  const groupedByLength = React.useMemo(() => {
    const groups = new Map<number, FoundWordEntry[]>();
    for (const entry of requiredWords.values()) {
      const len = entry.word.length;
      if (!groups.has(len)) {
        groups.set(len, []);
      }
      groups.get(len)!.push(entry);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [requiredWords]);

  const formatUnfoundMask = (word: string): string => {
    const revealedCount = Math.max(
      showAllFirstLetters ? 1 : 0,
      revealedPrefixes.get(word) || 0
    );
    return word
      .split('')
      .map((ch, idx) => (idx < revealedCount ? ch : '·'))
      .join(' ');
  };

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-[#210738]/90 border border-[#D4C5E2] dark:border-[#E6BE5A]/25 rounded-2xl overflow-hidden shadow-[0_14px_34px_rgba(33,7,56,0.12)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)] transition-colors">
      {/* Top Header Strip */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5DCEF] dark:border-white/10 bg-[#F7F4FA] dark:bg-[#1A052C]">
        <div className="flex items-center gap-2 text-xs text-[#5B4373] dark:text-[#D6CBE2] font-medium">
          <span className="font-display font-bold text-sm text-[#1E0A33] dark:text-[#F5F3F7]">
            Puzzle Lexicon
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums font-bold text-[#9A6B00] dark:text-[#F6C915]">
            {foundWords.size}/{requiredWords.size} Found
          </span>
          {bonusWords.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#7C3AED] dark:text-[#E6BE5A]">
                +{bonusWords.length} Bonus
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleFirstLetters}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            showAllFirstLetters
              ? 'bg-[#F6C915] text-[#1D0830] font-semibold shadow-sm'
              : 'bg-[#EDE6F5] dark:bg-white/8 text-[#3E1F5E] dark:text-[#D6CBE2] hover:bg-[#E1D5EE] dark:hover:bg-white/15'
          }`}
          title="Toggle showing the first letter of all remaining words"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{showAllFirstLetters ? '1st Letters On' : 'Peek 1st Letters'}</span>
        </button>
      </div>

      {/* Live Dictionary API Definition Card (when a found word is clicked) */}
      {(inspectedWord || isLoadingDef) && (
        <div className="px-4 py-3 bg-[#F3ECF9] dark:bg-[#2D0B4A] border-b border-[#D4A437]/40 dark:border-[#F6C915]/30 animate-pop">
          {isLoadingDef ? (
            <div className="flex items-center gap-2 text-xs text-[#4A266A] dark:text-[#D6CBE2] py-1">
              <BookOpen className="w-3.5 h-3.5 text-[#B88200] dark:text-[#F6C915] animate-pulse" />
              <span>Looking up dictionary definition for {inspectedWord}...</span>
            </div>
          ) : selectedWordDef ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-display font-bold text-sm text-[#3B0B5E] dark:text-[#F6C915] tracking-wide">
                    {selectedWordDef.word}
                  </span>
                  {selectedWordDef.phonetic && (
                    <span className="font-mono text-[#6E5687] dark:text-[#B7A6C8]">
                      {selectedWordDef.phonetic}
                    </span>
                  )}
                  <span aria-hidden="true" className="text-[#8E79A6]">·</span>
                  <span className="italic font-medium text-[#9A6B00] dark:text-[#E6BE5A]">
                    {selectedWordDef.partOfSpeech}
                  </span>
                </div>
                <span className="text-[11px] text-[#6E5687] dark:text-[#9E8BB5] font-mono">
                  {selectedWordDef.source === 'dictionaryapi'
                    ? 'Dictionary API'
                    : selectedWordDef.source === 'datamuse'
                      ? 'Lexical API'
                      : 'Core Lexicon'}
                </span>
              </div>
              <p className="text-xs text-[#230E38] dark:text-[#F3EFF7] leading-relaxed">
                {selectedWordDef.definition}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Scrollable Word Groups by Length */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {groupedByLength.map(([length, entries]) => {
          const foundInGroup = entries.filter((e) => foundWords.has(e.word)).length;
          const allGroupFound = foundInGroup === entries.length;

          return (
            <div key={length} className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#E5DCEF] dark:border-white/10 pb-1">
                <div className="flex items-center gap-2 text-xs font-medium text-[#5B4373] dark:text-[#D6CBE2]">
                  <span className="font-display font-bold text-[#1E0A33] dark:text-[#F5F3F7]">
                    {length}-Letter Words
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-[#9A6B00] dark:text-[#E6BE5A]">
                    +{entries[0]?.points ?? 1} pts each
                  </span>
                </div>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    allGroupFound
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-[#6E5687] dark:text-[#A996BD]'
                  }`}
                >
                  {foundInGroup}/{entries.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {entries.map((entry) => {
                  const isFound = foundWords.has(entry.word);
                  const isInspected = inspectedWord === entry.word;

                  return (
                    <button
                      key={entry.word}
                      type="button"
                      onClick={() => {
                        if (isFound) {
                          onInspectWord(entry.word, entry.path);
                        }
                      }}
                      disabled={!isFound}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all ${
                        isFound
                          ? isInspected
                            ? 'bg-[#F6C915] text-[#1D0830] font-semibold shadow-sm cursor-pointer'
                            : entry.isFeatured
                              ? 'bg-gradient-to-r from-[#50157A] to-[#3A0C5C] text-[#FDE047] border border-[#F6C915]/60 hover:border-[#F6C915] cursor-pointer'
                              : 'bg-[#EDE6F5] dark:bg-white/10 text-[#1E0A33] dark:text-[#F5F3F7] hover:bg-[#DFD3EE] dark:hover:bg-white/15 cursor-pointer font-medium'
                          : entry.isFeatured
                            ? 'bg-[#FBF6E6] dark:bg-[#2E0A4B]/70 text-[#8F6400] dark:text-[#E6BE5A]/80 border border-dashed border-[#D4A437]/60 dark:border-[#E6BE5A]/40 cursor-default'
                            : 'bg-[#F6F3FA] dark:bg-black/25 text-[#8A759E] border border-[#E6DFEE] dark:border-white/5 cursor-default'
                      }`}
                    >
                      <span className="font-mono text-xs tracking-wider truncate">
                        {isFound ? entry.word : formatUnfoundMask(entry.word)}
                      </span>

                      {isFound ? (
                        <span
                          className={`text-[10px] font-mono font-bold tabular-nums shrink-0 ml-1 ${
                            isInspected
                              ? 'text-[#1D0830]'
                              : entry.isFeatured
                                ? 'text-[#F6C915]'
                                : 'text-[#8F6400] dark:text-[#F6C915]'
                          }`}
                        >
                          +{entry.points}
                        </span>
                      ) : entry.isFeatured ? (
                        <Sparkles className="w-3 h-3 text-[#B88200] dark:text-[#F6C915] shrink-0 ml-1" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Bonus Words Section */}
        <div className="pt-2 border-t border-[#E5DCEF] dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5B4373] dark:text-[#D6CBE2]">
            <span>Bonus Dictionary Words (+1 pt each)</span>
            <span className="font-mono font-bold tabular-nums text-[#9A6B00] dark:text-[#F6C915]">
              {bonusWords.length}
            </span>
          </div>
          {bonusWords.length === 0 ? (
            <p className="text-xs text-[#735C8A] dark:text-[#937FA8]">
              Swipe any valid 4+ letter English word not on the required list to earn bonus points and view its live dictionary entry.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bonusWords.map((bWord) => (
                <button
                  key={bWord}
                  type="button"
                  onClick={() => onInspectWord(bWord)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    inspectedWord === bWord
                      ? 'bg-[#F6C915] text-[#1D0830] font-bold'
                      : 'bg-[#EDE6F5] dark:bg-white/8 text-[#4A1575] dark:text-[#E6BE5A] hover:bg-[#DFD3EE] dark:hover:bg-white/15'
                  }`}
                >
                  {bWord}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
