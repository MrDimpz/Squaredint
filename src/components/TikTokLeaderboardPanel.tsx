import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  Radio,
  Sparkles,
  RotateCcw,
  Settings,
  Send,
  Crown,
  MessageSquare,
  Flame,
  Lightbulb,
  RotateCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Wand2,
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

export interface LiveFeedItem {
  id: string;
  type: 'chat';
  uniqueId: string;
  nickname: string; // Player nickname ONLY (never @name)
  profilePictureUrl: string;
  timestamp: number;
  comment: string;
  matchedWord?: string;
  matchedPoints?: number;
  isCommand?: boolean;
}

interface TikTokLeaderboardPanelProps {
  tiktokUsername: string;
  isConnected: boolean;
  leaderboard: LeaderboardPlayer[];
  liveFeed: LiveFeedItem[];
  foundWordsCount: number;
  totalRequiredWords: number;
  bonusWordsCount: number;
  sampleUnfoundWord?: string;
  isSimulatorOpen: boolean;
  onToggleSimulator: () => void;
  onOpenConnectSettings: () => void;
  onResetLeaderboard: () => void;
  onSimulateChat: (data: { uniqueId: string; nickname: string; comment: string; profilePictureUrl: string }) => void;
}

const SAMPLE_PERSONAS = [
  {
    uniqueId: 'luna_stars',
    nickname: 'Luna Starlight',
    profilePictureUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=LunaStarlight&backgroundColor=ffdfbf',
  },
  {
    uniqueId: 'marcus_v',
    nickname: 'Marcus Vance',
    profilePictureUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=MarcusVance&backgroundColor=b6e3f4',
  },
  {
    uniqueId: 'chloe_b',
    nickname: 'Chloe Blossom',
    profilePictureUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=ChloeBlossom&backgroundColor=ffd5dc',
  },
  {
    uniqueId: 'kai_h',
    nickname: 'Kai Horizon',
    profilePictureUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=KaiHorizon&backgroundColor=c0aede',
  },
];

const NICKNAME_COLORS = [
  'text-[#38BDF8]', // Sky cyan
  'text-[#F472B6]', // Pink
  'text-[#FBBF24]', // Amber
  'text-[#34D399]', // Mint
  'text-[#A78BFA]', // Soft violet
  'text-[#FB923C]', // Bright orange
  'text-[#2DD4BF]', // Teal
  'text-[#F87171]', // Coral
  'text-[#C084FC]', // Purple
];

function getNicknameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return NICKNAME_COLORS[Math.abs(hash) % NICKNAME_COLORS.length];
}

function getFallbackAvatar(nickname: string): string {
  const clean = nickname.replace(/^@+/, '') || 'Player';
  const encoded = encodeURIComponent(clean);
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encoded}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return 'just now';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export const TikTokLeaderboardPanel: React.FC<TikTokLeaderboardPanelProps> = ({
  tiktokUsername,
  isConnected,
  leaderboard,
  liveFeed,
  foundWordsCount,
  totalRequiredWords,
  bonusWordsCount,
  sampleUnfoundWord,
  isSimulatorOpen,
  onToggleSimulator,
  onOpenConnectSettings,
  onResetLeaderboard,
  onSimulateChat,
}) => {
  // Mobile tab state: 'scoreboard' | 'chat'
  const [mobileTab, setMobileTab] = useState<'scoreboard' | 'chat'>('scoreboard');

  // Selected persona for simulator & quick chat
  const [selectedPersonaIdx, setSelectedPersonaIdx] = useState(0);
  const activePersona = SAMPLE_PERSONAS[selectedPersonaIdx] || SAMPLE_PERSONAS[0];

  // Quick chat input
  const [chatInput, setChatInput] = useState('');

  // Auto-scroll chat feed to newest event at bottom
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollPausedRef = useRef(false);

  // Filter to actual chat comments only (ignoring any likes, gifts, or telemetry)
  const chatMessages = liveFeed.filter((item) => item && item.type === 'chat' && item.comment?.trim());

  useEffect(() => {
    if (!isAutoScrollPausedRef.current && chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendChat = (commentText?: string) => {
    const text = (commentText ?? chatInput).trim();
    const finalWord = (text || sampleUnfoundWord || 'SPACE').toUpperCase();

    onSimulateChat({
      uniqueId: activePersona.uniqueId,
      nickname: activePersona.nickname,
      comment: finalWord,
      profilePictureUrl: activePersona.profilePictureUrl,
    });

    if (!commentText) {
      setChatInput('');
    }
    // Cycle persona for lively multi-user feel
    setSelectedPersonaIdx((prev) => (prev + 1) % SAMPLE_PERSONAS.length);
  };

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-[#210738]/90 border border-[#D4C5E2] dark:border-[#E6BE5A]/30 rounded-2xl overflow-hidden shadow-[0_14px_34px_rgba(33,7,56,0.12)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)] transition-colors">
      {/* Top Header Strip */}
      <div className="shrink-0 flex items-center justify-between px-3.5 sm:px-4 py-2 border-b border-[#E5DCEF] dark:border-white/10 bg-[#F7F4FA] dark:bg-[#1A052C]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] uppercase tracking-wider shrink-0 border ${
              isConnected
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                : 'bg-amber-500/20 border-amber-400/50 text-amber-300'
            }`}
          >
            <Radio className={`w-3 h-3 ${isConnected ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
            <span>{isConnected ? 'LIVE' : 'SIMULATOR'}</span>
          </span>

          <button
            type="button"
            onClick={onOpenConnectSettings}
            className="flex items-center gap-1 text-xs font-bold text-[#F6C915] hover:underline truncate cursor-pointer"
            title="Stream Settings"
          >
            <span>@{tiktokUsername.replace(/^@+/, '') || 'Offline Stream'}</span>
          </button>

          <span aria-hidden="true" className="text-[#8E79A6] hidden sm:inline">·</span>

          <span className="font-mono tabular-nums text-xs font-bold text-[#9A6B00] dark:text-[#F6C915] shrink-0">
            {foundWordsCount}/{totalRequiredWords} Words Uncovered
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mobile Tab Switcher (< md) */}
          <div className="flex md:hidden items-center p-0.5 bg-black/30 rounded-lg border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setMobileTab('scoreboard')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                mobileTab === 'scoreboard' ? 'bg-[#F6C915] text-[#1D0830]' : 'text-[#D6CBE2]'
              }`}
            >
              Scores ({leaderboard.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('chat')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                mobileTab === 'chat' ? 'bg-[#F6C915] text-[#1D0830]' : 'text-[#D6CBE2]'
              }`}
            >
              Chat ({chatMessages.length})
            </button>
          </div>

          {/* Toggle Built-in Offline Test Simulator Button */}
          <button
            type="button"
            onClick={onToggleSimulator}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              isSimulatorOpen
                ? 'bg-[#F6C915] text-[#1D0830] border-[#F6C915] shadow-xs'
                : 'bg-[#EDE6F5] dark:bg-white/8 text-[#4A1575] dark:text-[#D6CBE2] border-white/10 hover:bg-[#E1D5EE] dark:hover:bg-white/15'
            }`}
            title="Toggle Built-in Offline Test Simulator"
          >
            <Wand2 className="w-3 h-3" />
            <span className="hidden sm:inline">Chat Test</span>
            {isSimulatorOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

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
            className="p-1 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10 text-[#D6CBE2] hover:text-white transition-colors cursor-pointer"
            title="TikTok Stream Connection Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Built-in Collapsible Offline Chat Simulator Drawer */}
      {isSimulatorOpen && (
        <div className="shrink-0 p-3 bg-gradient-to-r from-[#2F0B52] to-[#1F0537] border-b border-[#F6C915]/30 space-y-2.5 animate-pop text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-[#F6C915]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Offline Chat Simulator (Test word guesses & commands directly)</span>
            </div>
            <span className="text-[10px] font-mono text-[#D6CBE2]">Chat Only</span>
          </div>

          {/* Persona selector */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            <span className="text-[#B9A8CC] text-[11px] shrink-0 font-medium">Chat As:</span>
            {SAMPLE_PERSONAS.map((p, idx) => (
              <button
                key={p.uniqueId}
                type="button"
                onClick={() => setSelectedPersonaIdx(idx)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] shrink-0 transition-colors cursor-pointer ${
                  selectedPersonaIdx === idx
                    ? 'bg-[#F6C915]/20 border-[#F6C915] text-[#F6C915] font-semibold'
                    : 'bg-white/5 border-white/10 text-[#D6CBE2] hover:bg-white/10'
                }`}
              >
                <img src={p.profilePictureUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                <span>{p.nickname}</span>
              </button>
            ))}
          </div>

          {/* Action Row: Quick Word Triggers */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-white/10">
            <span className="text-[11px] text-[#B9A8CC]">Quick Test:</span>
            {sampleUnfoundWord && (
              <button
                type="button"
                onClick={() => handleSendChat(sampleUnfoundWord)}
                className="px-2.5 py-1 rounded-md bg-[#F6C915] text-[#1D0830] font-mono font-bold text-[11px] shadow-xs hover:brightness-105 cursor-pointer"
                title={`Send next unfound word: ${sampleUnfoundWord}`}
              >
                Guess "{sampleUnfoundWord}"
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSendChat('!rotate')}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 border border-white/15 text-[#D6CBE2] font-mono text-[11px] cursor-pointer"
            >
              <RotateCw className="w-2.5 h-2.5 text-[#F6C915]" />
              <span>!rotate</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendChat('!hint')}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 border border-white/15 text-[#D6CBE2] font-mono text-[11px] cursor-pointer"
            >
              <Lightbulb className="w-2.5 h-2.5 text-[#F6C915]" />
              <span>!hint</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendChat('HELLO STREAM')}
              className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 border border-white/15 text-[#D6CBE2] text-[11px] cursor-pointer"
            >
              "HELLO STREAM"
            </button>
          </div>
        </div>
      )}

      {/* Main Split Grid: 50% Scoreboard (Left) + 50% Live TikTok Chat (Right) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E5DCEF] dark:divide-white/10 overflow-hidden">
        
        {/* ========================================================================= */}
        {/* COLUMN 1: SCOREBOARD / LEADERBOARD (Half Width)                            */}
        {/* ========================================================================= */}
        <div
          className={`flex flex-col h-full min-h-0 bg-transparent ${
            mobileTab === 'chat' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sub-Header */}
          <div className="shrink-0 flex items-center justify-between px-3.5 py-2 border-b border-[#E5DCEF] dark:border-white/10 bg-[#F4EFF9] dark:bg-[#1A052C]/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E0A33] dark:text-[#F5F3F7]">
              <Trophy className="w-3.5 h-3.5 text-[#F6C915]" />
              <span>Player Scoreboard</span>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#F6C915]/15 text-[#9A6B00] dark:text-[#F6C915]">
              {leaderboard.length} {leaderboard.length === 1 ? 'Player' : 'Players'}
            </span>
          </div>

          {/* Player Leaderboard List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {leaderboard.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2.5 my-auto">
                <div className="w-10 h-10 rounded-2xl bg-[#F6C915]/15 border border-[#F6C915]/40 flex items-center justify-center text-[#F6C915]">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="space-y-1 max-w-[220px]">
                  <h4 className="font-display font-bold text-sm text-[#1E0A33] dark:text-[#F5F3F7]">
                    No Points Scored Yet!
                  </h4>
                  <p className="text-[11px] text-[#6E5687] dark:text-[#B9A8CC] leading-relaxed">
                    Viewers typing valid words in your live chat will appear and rank here.
                  </p>
                </div>
              </div>
            ) : (
              leaderboard.map((player, index) => {
                const rank = index + 1;
                const isFirst = rank === 1;
                const isSecond = rank === 2;
                const isThird = rank === 3;
                const displayNickname = player.nickname.replace(/^@+/, '') || 'Player';

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border transition-all animate-pop ${
                      isFirst
                        ? 'bg-gradient-to-r from-[#4A1475] via-[#380D5A] to-[#2B0846] border-[#F6C915] shadow-[0_4px_14px_rgba(246,201,21,0.2)]'
                        : isSecond
                          ? 'bg-[#2E0B4D]/90 border-slate-300/40'
                          : isThird
                            ? 'bg-[#290944]/90 border-amber-600/45'
                            : 'bg-[#F6F3FA] dark:bg-black/30 border-[#E6DFEE] dark:border-white/10'
                    }`}
                  >
                    {/* Left: Rank Badge + Avatar + Display Nickname (Never @name) */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-md font-mono font-bold text-[11px] flex items-center justify-center shrink-0 ${
                          isFirst
                            ? 'bg-[#F6C915] text-[#1D0830]'
                            : isSecond
                              ? 'bg-slate-200 text-slate-900'
                              : isThird
                                ? 'bg-amber-600 text-white'
                                : 'bg-white/10 text-[#B9A8CC]'
                        }`}
                      >
                        {isFirst ? <Crown className="w-3 h-3 fill-current" /> : `#${rank}`}
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
                          className={`w-8 h-8 rounded-full object-cover border-2 ${
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
                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#F6C915] text-[#1D0830] flex items-center justify-center shadow"
                          >
                            <Sparkles className="w-2 h-2 fill-current" />
                          </span>
                        )}
                      </div>

                      {/* Nickname & Words Count */}
                      <div className="min-w-0">
                        <div className="font-display font-bold text-xs sm:text-sm text-[#1E0A33] dark:text-[#F5F3F7] truncate">
                          {displayNickname}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#6E5687] dark:text-[#B9A8CC] font-mono">
                          <span>{player.wordsFound}w</span>
                          {player.bonusWords > 0 && <span>+{player.bonusWords}b</span>}
                          {player.lastWord && (
                            <span className="px-1 py-0.2 rounded bg-[#F6C915]/15 text-[#F6C915] font-semibold truncate max-w-[70px]">
                              {player.lastWord}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Score */}
                    <div className="text-right shrink-0">
                      <div className="font-mono font-extrabold text-sm sm:text-base text-[#9A6B00] dark:text-[#F6C915] tabular-nums">
                        {player.score} pts
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Helper */}
          <div className="shrink-0 px-3.5 py-1.5 bg-black/20 border-t border-[#E5DCEF] dark:border-white/5 text-[10px] font-mono text-[#8E79A6] flex items-center justify-between">
            <span>Points awarded for 4+ letter words</span>
            <span className="text-[#F6C915] font-bold">★ +5 Missing Piece</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: AUTHENTIC LIVE TIKTOK CHAT FEED (Half Width, No Black Bars)    */}
        {/* ========================================================================= */}
        <div
          className={`flex flex-col h-full min-h-0 bg-[#0F021A]/60 ${
            mobileTab === 'scoreboard' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sub-Header */}
          <div className="shrink-0 flex items-center justify-between px-3.5 py-2 border-b border-[#E5DCEF] dark:border-white/10 bg-[#F4EFF9] dark:bg-[#1A052C]/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E0A33] dark:text-[#F5F3F7]">
              <MessageSquare className="w-3.5 h-3.5 text-[#F6C915]" />
              <span>Live Stream Chat</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{chatMessages.length} Messages</span>
            </div>
          </div>

          {/* Scrollable Live Chat Feed (Clean Authentic Stream Chat Layout) */}
          <div
            ref={chatScrollContainerRef}
            onScroll={(e) => {
              const target = e.currentTarget;
              const isNearBottom =
                target.scrollHeight - target.scrollTop - target.clientHeight < 60;
              isAutoScrollPausedRef.current = !isNearBottom;
            }}
            className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 font-sans"
          >
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2.5 my-auto">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#D6CBE2]">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="space-y-1 max-w-[240px]">
                  <h4 className="font-display font-bold text-sm text-[#1E0A33] dark:text-[#F5F3F7]">
                    Waiting for Chat Messages
                  </h4>
                  <p className="text-[11px] text-[#6E5687] dark:text-[#B9A8CC] leading-relaxed">
                    Viewer comments will appear here as they chat on TikTok LIVE.
                  </p>
                </div>
              </div>
            ) : (
              chatMessages.map((item) => {
                const cleanNick = item.nickname.replace(/^@+/, '') || 'Viewer';
                const colorClass = getNicknameColor(cleanNick);

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 py-1 px-2 rounded-lg hover:bg-white/5 transition-colors group text-[13px] leading-relaxed"
                  >
                    {/* Compact Viewer Avatar */}
                    <img
                      src={item.profilePictureUrl || getFallbackAvatar(cleanNick)}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = getFallbackAvatar(cleanNick);
                        if (target.src !== fallback) {
                          target.src = fallback;
                        }
                      }}
                      className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5 border border-white/20"
                    />

                    {/* Chat Content (Streamlined, No Heavy Black Boxes) */}
                    <div className="flex-1 min-w-0">
                      <span className={`font-display font-bold text-xs ${colorClass} mr-1.5 inline-block select-none`}>
                        {cleanNick}:
                      </span>

                      <span className="text-[#F1F5F9] font-normal break-words selection:bg-[#F6C915] selection:text-[#1F0933]">
                        {item.comment}
                      </span>

                      {/* Inline Word Discovery Badge */}
                      {item.matchedWord && (
                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 font-mono text-[11px] font-bold align-middle shadow-xs animate-pulse">
                          <Flame className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>Found "{item.matchedWord}" (+{item.matchedPoints} pts)</span>
                        </span>
                      )}

                      {/* Inline Command Execution Badge */}
                      {item.isCommand && (
                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-500/25 border border-purple-400/40 text-purple-300 font-mono text-[10px] align-middle">
                          <Sparkles className="w-2.5 h-2.5 text-purple-300 shrink-0" />
                          <span>cmd</span>
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] text-[#8E79A6] font-mono shrink-0 pt-0.5 opacity-60">
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Chat Input Bar */}
          <div className="shrink-0 border-t border-[#E5DCEF] dark:border-white/10 bg-[#F3ECF9] dark:bg-[#170428]/95 p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedPersonaIdx((prev) => (prev + 1) % SAMPLE_PERSONAS.length)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-[11px] text-[#F5F3F7] shrink-0 cursor-pointer"
                title="Cycle persona"
              >
                <img
                  src={activePersona.profilePictureUrl}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
                <span className="font-medium max-w-[65px] truncate">
                  {activePersona.nickname.split(' ')[0]}
                </span>
              </button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="flex-1 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    sampleUnfoundWord
                      ? `Type chat comment or word (e.g. ${sampleUnfoundWord})...`
                      : 'Type chat comment or command...'
                  }
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                />

                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#F6C915] hover:brightness-105 text-[#1D0830] font-display font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Send className="w-3 h-3" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
