import React, { useState, useEffect } from 'react';
import {
  Radio,
  AtSign,
  X,
  Unplug,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface TikTokConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  tiktokUsername: string;
  tiktokError: string | null;
  roomId?: string;
  onConnect: (username: string) => void;
  onDisconnect: () => void;
  onOpenSimulator?: () => void;
}

export const TikTokConnectModal: React.FC<TikTokConnectModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  tiktokUsername,
  tiktokError,
  roomId,
  onConnect,
  onDisconnect,
  onOpenSimulator,
}) => {
  const [usernameInput, setUsernameInput] = useState(tiktokUsername.replace(/^@+/, ''));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setUsernameInput(tiktokUsername.replace(/^@+/, ''));
  }, [tiktokUsername]);

  useEffect(() => {
    if (isConnected || tiktokError) {
      setIsSubmitting(false);
    }
  }, [isConnected, tiktokError]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameInput.trim().replace(/^@+/, '');
    if (!clean) return;
    setIsSubmitting(true);
    onConnect(clean);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-gradient-to-b from-[#2B0948] to-[#170329] border-2 border-[#D4A437] p-6 text-[#F5F3F7] shadow-[0_24px_60px_rgba(0,0,0,0.85)] space-y-5 animate-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                isConnected
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-[#F6C915]/15 border-[#F6C915]/50 text-[#F6C915]'
              }`}
            >
              <Radio className={`w-5 h-5 ${isConnected ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-lg text-[#F6C915]">
                TikTok LIVE Interactive
              </h2>
              <p className="text-xs text-[#D6CBE2]">
                Connect your TikTok stream for live chat word finding
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-[#D6CBE2] hover:text-white cursor-pointer transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Connection Banner */}
        {isConnected ? (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-400/50">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Stream Connected</span>
              </div>
              <div className="font-display font-bold text-sm text-white truncate mt-0.5">
                @{tiktokUsername.replace(/^@+/, '')}
              </div>
              {roomId && (
                <div className="text-[11px] text-emerald-200/80 font-mono truncate">
                  Room ID: {roomId}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-semibold text-rose-200 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              <Unplug className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#E6BE5A] mb-1.5">
                Host TikTok Username (@)
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-[#F6C915] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.replace(/^@+/, ''))}
                  placeholder="tiktok_username"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/45 border border-white/15 text-xs font-mono text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                />
              </div>
              <p className="text-[11px] text-[#B9A8CC] mt-1.5">
                No passwords or login required. Enter the username of the account that is currently streaming on TikTok LIVE.
              </p>
            </div>

            {tiktokError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-400/40 text-xs text-rose-200 flex items-start gap-2 animate-pop">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{tiktokError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !usernameInput.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-b from-[#FFE566] via-[#F6C915] to-[#D49B27] text-[#1D0830] font-display font-extrabold text-sm tracking-wide shadow-[0_8px_24px_rgba(246,201,21,0.35)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Radio className="w-4 h-4" />
              <span>{isSubmitting ? 'Connecting to TikTok...' : 'Connect to Live Stream'}</span>
            </button>
          </form>
        )}

        {/* Offline Test Simulator Callout */}
        <div className="p-3 rounded-xl bg-[#170329]/90 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F6C915] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Not Live Right Now?</span>
            </span>
            {onOpenSimulator && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSimulator();
                }}
                className="text-[11px] text-[#E6BE5A] underline hover:text-[#F6C915] cursor-pointer"
              >
                Open Simulator
              </button>
            )}
          </div>
          <p className="text-[11px] text-[#B9A8CC] leading-relaxed">
            Use the built-in <strong>Offline Chat Test</strong> on the right side of the game screen to test viewer chat guesses and commands instantly without needing an active live stream.
          </p>
        </div>

        {/* Helper Note */}
        <div className="flex items-center gap-2 text-[11px] text-[#8E79A6] font-mono">
          <HelpCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Viewers comment 4+ letter words to find words and rank on the board.</span>
        </div>
      </div>
    </div>
  );
};
