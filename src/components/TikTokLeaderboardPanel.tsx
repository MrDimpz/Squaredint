import React, { useState } from 'react';
import {
  Trophy,
  Radio,
  Sparkles,
  RotateCcw,
  Settings,
  Send,
  Crown,
  MessageSquare,
} from 'lucide-react';

export interface LeaderboardPlayer {
  id: string;
  nickname: string; // Player nickname ONLY (never @name)
  profilePictureUrl: string;
  score: number;
  wordsFound: number;
  bonusWords: number;
  featuredFound: boolean;
  lastWord?: string;
  lastWordPoints?: number;
  updatedAt: number;
}

export interface LiveChatEvent {
  id: string;
  playerId: string;
  nickname: string; // Player nickname ONLY (never @name)
  profilePictureUrl: string;
  comment: string;
  timestamp: number;
}

interface TikTokLeaderboardPanelProps {
  tiktokHandle: string;
  leaderboard: LeaderboardPlayer[];
  recentChat: LiveChatEvent[];
  foundWordsCount: number;
  totalRequiredWords: number;
  bonusWordsCount: number;
  sampleUnfoundWord?: string;
  onOpenConnectSettings: () => void;
  onResetLeaderboard: () => void;
  onSendTestViewerWord: (nickname: string, profilePictureUrl: string, comment: string) => Promise<void>;
}

const QUICK_VIEWERS = [
  {
    nickname: 'Luna Starlight',
    profilePictureUrl:
      'https://api.dicebear.com/9.x/avataaars/svg?seed=LunaStarlight&backgroundColor=ffdfbf',
  },
  {
    nickname: 'Marcus Vance',
    profilePictureUrl:
      'https://api.dicebear.com/9.x/avataaars/svg?seed=MarcusVance&backgroundColor=b6e3f4',
  },
  {
    nickname: 'Chloe Blossom',
    profilePictureUrl:
      'https://api.dicebear.com/9.x/avataaars/svg?seed=ChloeBlossom&backgroundColor=ffd5dc',
  },
  {
    nickname: 'Kai Horizon',
    profilePictureUrl:
      'https://api.dicebear.com/9.x/avataaars/svg?seed=KaiHorizon&backgroundColor=c0aede',
  },
];

function getFallbackAvatar(nickname: string): string {
  const encoded = encodeURIComponent(nickname || 'Player');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encoded}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export const TikTokLeaderboardPanel: React.FC<TikTokLeaderboardPanelProps> = ({
  tiktokHandle,
  leaderboard,
  recentChat,
  foundWordsCount,
  totalRequiredWords,
  bonusWordsCount,
  sampleUnfoundWord,
  onOpenConnectSettings,
  onResetLeaderboard,
  onSendTestViewerWord,
}) => {
  const [selectedViewerIdx, setSelectedViewerIdx] = useState(0);
  const [chatGuess, setChatGuess] = useState('');
  const [sending, setSending] = useState(false);

  const handleQuickSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const viewer = QUICK_VIEWERS[selectedViewerIdx] || QUICK_VIEWERS[0];
    const wordToSend = (chatGuess.trim() || sampleUnfoundWord || 'SPACE').toUpperCase();
    setSending(true);
    try {
      await onSendTestViewerWord(viewer.nickname, viewer.profilePictureUrl, wordToSend);
      setChatGuess('');
      setSelectedViewerIdx((prev) => (prev + 1) % QUICK_VIEWERS.length);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-[#210738]/90 border border-[#D4C5E2] dark:border-[#E6BE5A]/30 rounded-2xl overflow-hidden shadow-[0_14px_34px_rgba(33,7,56,0.12)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)] transition-colors">
      {/* Top Header Strip */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5DCEF] dark:border-white/10 bg-[#F7F4FA] dark:bg-[#1A052C]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/50 text-rose-300 font-mono font-bold text-[11px] uppercase tracking-wider shrink-0">
            <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
            <span>LIVE</span>
          </span>
          <span className="font-display font-bold text-sm text-[#1E0A33] dark:text-[#F5F3F7] truncate">
            Player Leaderboard
          </span>
          <span aria-hidden="true" className="text-[#8E79A6]">·</span>
          <span className="font-mono tabular-nums text-xs font-bold text-[#9A6B00] dark:text-[#F6C915] shrink-0">
            {foundWordsCount}/{totalRequiredWords} Words
          </span>
          {bonusWordsCount > 0 && (
            <span className="hidden sm:inline font-mono tabular-nums text-xs text-[#7C3AED] dark:text-[#E6BE5A] shrink-0">
              (+{bonusWordsCount} Bonus)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {leaderboard.length > 0 && (
            <button
              type="button"
              onClick={onResetLeaderboard}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EDE6F5] dark:bg-white/8 hover:bg-[#E1D5EE] dark:hover:bg-white/15 text-[11px] font-medium text-[#3E1F5E] dark:text-[#D6CBE2] transition-colors cursor-pointer"
              title="Reset Live Leaderboard scores"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenConnectSettings}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F6C915]/20 hover:bg-[#F6C915]/30 border border-[#F6C915]/50 text-[11px] font-semibold text-[#F6C915] transition-colors cursor-pointer"
            title="TikTok LIVE Stream Settings"
          >
            <Settings className="w-3 h-3" />
            <span>@{tiktokHandle.replace(/^@+/, '')}</span>
          </button>
        </div>
      </div>

      {/* Main Leaderboard Rankings List (Player Nickname + Profile Picture) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
        {leaderboard.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F6C915]/15 border border-[#F6C915]/40 flex items-center justify-center text-[#F6C915]">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h3 className="font-display font-bold text-base text-[#1E0A33] dark:text-[#F5F3F7]">
                Waiting for First Word Claim!
              </h3>
              <p className="text-xs text-[#6E5687] dark:text-[#B9A8CC] leading-relaxed">
                Viewers in your TikTok LIVE chat can type any 4+ letter word on the grid to claim points and appear on the leaderboard with their profile picture and nickname.
              </p>
            </div>
          </div>
        ) : (
          leaderboard.map((player, index) => {
            const rank = index + 1;
            const isFirst = rank === 1;
            const isSecond = rank === 2;
            const isThird = rank === 3;
            const displayNickname = player.nickname.replace(/^@+/, '');

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all animate-pop ${
                  isFirst
                    ? 'bg-gradient-to-r from-[#4A1475] via-[#380D5A] to-[#2B0846] border-[#F6C915] shadow-[0_6px_18px_rgba(246,201,21,0.18)]'
                    : isSecond
                      ? 'bg-[#2E0B4D]/90 border-[#E2E8F0]/40'
                      : isThird
                        ? 'bg-[#290944]/90 border-[#D97706]/45'
                        : 'bg-[#F6F3FA] dark:bg-black/30 border-[#E6DFEE] dark:border-white/10'
                }`}
              >
                {/* Left: Rank + Profile Picture + Player Nickname (Never @name) */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                      isFirst
                        ? 'bg-[#F6C915] text-[#1D0830]'
                        : isSecond
                          ? 'bg-slate-200 text-slate-900'
                          : isThird
                            ? 'bg-amber-600 text-white'
                            : 'bg-white/10 text-[#B9A8CC]'
                    }`}
                  >
                    {isFirst ? <Crown className="w-3.5 h-3.5 fill-current" /> : `#${rank}`}
                  </div>

                  {/* Player Profile Picture */}
                  <div className="relative shrink-0">
                    <img
                      src={player.profilePictureUrl || getFallbackAvatar(displayNickname)}
                      alt={displayNickname}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = getFallbackAvatar(displayNickname);
                        if (target.src !== fallback) {
                          target.src = fallback;
                        }
                      }}
                      className={`w-10 h-10 rounded-full object-cover border-2 ${
                        isFirst
                          ? 'border-[#F6C915]'
                          : isSecond
                            ? 'border-slate-300'
                            : isThird
                              ? 'border-amber-500'
                              : 'border-[#E6BE5A]/40'
                      }`}
                    />
                    {player.featuredFound && (
                      <span
                        title="Uncovered the ★ Missing Piece!"
                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#F6C915] text-[#1D0830] flex items-center justify-center shadow"
                      >
                        <Sparkles className="w-2.5 h-2.5 fill-current" />
                      </span>
                    )}
                  </div>

                  {/* Player Nickname & Word Stats */}
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-[#1E0A33] dark:text-[#F5F3F7] truncate">
                      {displayNickname}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#6E5687] dark:text-[#B9A8CC] font-mono">
                      <span>
                        {player.wordsFound} {player.wordsFound === 1 ? 'word' : 'words'}
                      </span>
                      {player.bonusWords > 0 && <span>+{player.bonusWords} bonus</span>}
                      {player.lastWord && (
                        <span className="px-1.5 py-0.2 rounded bg-[#F6C915]/15 text-[#F6C915] font-semibold">
                          {player.lastWord}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Player Total Score */}
                <div className="text-right shrink-0">
                  <div className="font-mono font-extrabold text-base text-[#9A6B00] dark:text-[#F6C915] tabular-nums">
                    {player.score} pts
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Live Chat Activity & Quick Streamer Test Input */}
      <div className="border-t border-[#E5DCEF] dark:border-white/10 bg-[#F3ECF9] dark:bg-[#170428]/95 px-4 py-2.5 space-y-2">
        {/* Recent Chat Stream Ticker (Nicknames + Avatars only) */}
        {recentChat.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            <MessageSquare className="w-3.5 h-3.5 text-[#F6C915] shrink-0" />
            {recentChat.slice(0, 4).map((evt) => {
              const cleanNick = evt.nickname.replace(/^@+/, '');
              return (
                <div
                  key={evt.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/35 border border-white/10 text-[11px] shrink-0"
                >
                  <img
                    src={evt.profilePictureUrl || getFallbackAvatar(cleanNick)}
                    alt={cleanNick}
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span className="font-semibold text-[#E6BE5A]">{cleanNick}:</span>
                  <span className="font-mono text-white">{evt.comment}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Streamer Test Chat Bar */}
        <form onSubmit={handleQuickSend} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedViewerIdx((prev) => (prev + 1) % QUICK_VIEWERS.length)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-[11px] text-[#F5F3F7] shrink-0 cursor-pointer"
            title="Click to cycle test viewer profile"
          >
            <img
              src={QUICK_VIEWERS[selectedViewerIdx].profilePictureUrl}
              alt={QUICK_VIEWERS[selectedViewerIdx].nickname}
              className="w-4 h-4 rounded-full object-cover"
            />
            <span className="font-medium max-w-[90px] truncate">
              {QUICK_VIEWERS[selectedViewerIdx].nickname}
            </span>
          </button>

          <input
            type="text"
            value={chatGuess}
            onChange={(e) => setChatGuess(e.target.value)}
            placeholder={
              sampleUnfoundWord
                ? `Test chat guess (or press Send for "${sampleUnfoundWord}")...`
                : 'Type a viewer chat word guess...'
            }
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
          />

          <button
            type="submit"
            disabled={sending}
            className="px-3 py-1.5 rounded-lg bg-[#F6C915] hover:brightness-105 text-[#1D0830] font-display font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
