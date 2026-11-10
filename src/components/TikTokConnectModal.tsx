import React, { useState } from 'react';
import {
  Radio,
  KeyRound,
  Globe,
  AtSign,
  Copy,
  Check,
  RefreshCw,
  X,
  Unplug,
  Sparkles,
  CheckCircle2,
  Send,
  AlertCircle,
} from 'lucide-react';

export interface TikTokConnectionConfig {
  tiktokHandle: string;
  streamKey: string;
  hostWebsiteUrl: string;
}

interface TikTokConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  connectionMode: 'tiktok_direct' | 'stream_key_bridge';
  statusMessage: string;
  config: TikTokConnectionConfig;
  onConnect: (newConfig: TikTokConnectionConfig) => void;
  onDisconnect: () => void;
  onRegenerateKey: () => string;
  onSendTestWebhook: (nickname: string, profilePictureUrl: string, comment: string) => Promise<void>;
  sampleUnfoundWord?: string;
}

const SAMPLE_VIEWERS = [
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

export const TikTokConnectModal: React.FC<TikTokConnectModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  connectionMode,
  statusMessage,
  config,
  onConnect,
  onDisconnect,
  onRegenerateKey,
  onSendTestWebhook,
  sampleUnfoundWord,
}) => {
  const [handleInput, setHandleInput] = useState(config.tiktokHandle.replace(/^@+/, ''));
  const [streamKeyInput, setStreamKeyInput] = useState(config.streamKey);
  const [websiteInput, setWebsiteInput] = useState(config.hostWebsiteUrl);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'key' | 'webhook' | null>(null);

  // Quick test viewer state when connected
  const [testNickname, setTestNickname] = useState(SAMPLE_VIEWERS[0].nickname);
  const [testAvatar, setTestAvatar] = useState(SAMPLE_VIEWERS[0].profilePictureUrl);
  const [testComment, setTestComment] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  if (!isOpen) return null;

  const cleanHostUrl = (websiteInput.trim() || window.location.origin).replace(/\/+$/, '');
  const webhookEndpoint = `${cleanHostUrl}/api/tiktok/event`;

  const handleCopy = (text: string, field: 'key' | 'webhook') => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }).catch(() => {});
  };

  const handleSubmitConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanHandle = handleInput.trim().replace(/^@+/, '');
    const cleanKey = streamKeyInput.trim();
    const cleanWebsite = websiteInput.trim().replace(/\/+$/, '');

    if (!cleanHandle) {
      setErrorMsg('Please enter your TikTok @ handle to connect your stream.');
      return;
    }
    if (!cleanKey || cleanKey.length < 6) {
      setErrorMsg('Please provide a valid Stream Key (at least 6 characters).');
      return;
    }
    if (!cleanWebsite || !/^https?:\/\//i.test(cleanWebsite)) {
      setErrorMsg('Please enter a valid Hosted Website URL starting with https:// or http://');
      return;
    }

    onConnect({
      tiktokHandle: cleanHandle,
      streamKey: cleanKey,
      hostWebsiteUrl: cleanWebsite,
    });
  };

  const handleTriggerTestEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const wordToSend = (testComment.trim() || sampleUnfoundWord || 'SPACE').toUpperCase();
    setSendingTest(true);
    try {
      await onSendTestWebhook(
        testNickname.trim() || 'Luna Starlight',
        testAvatar.trim(),
        wordToSend
      );
      setTestComment('');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#2B0948] to-[#170329] border-2 border-[#D4A437] p-6 text-[#F5F3F7] shadow-[0_24px_60px_rgba(0,0,0,0.85)] space-y-5 max-h-[92vh] overflow-y-auto custom-scrollbar animate-pop">
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
                TikTok LIVE Stream Connect
              </h2>
              <p className="text-xs text-[#D6CBE2]">
                Link your @ handle, stream key, and hosted website for interactive chat play
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-[#D6CBE2] hover:text-white cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Connection Banner */}
        {isConnected && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-400/50">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {connectionMode === 'tiktok_direct'
                    ? 'Direct TikTok LIVE Connected'
                    : 'Stream Key & Hosted Webhook Active'}
                </span>
              </div>
              <div className="font-display font-bold text-sm text-white truncate mt-0.5">
                @{config.tiktokHandle.replace(/^@+/, '')}
              </div>
              <div className="text-[11px] text-emerald-200/80 font-mono truncate">
                {statusMessage}
              </div>
            </div>

            <button
              type="button"
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-semibold text-rose-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Unplug className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        )}

        {/* Streamer Configuration Form */}
        <form onSubmit={handleSubmitConnect} className="space-y-3.5">
          {/* 1. TikTok @ Handle */}
          <div>
            <label className="block text-xs font-semibold text-[#E6BE5A] mb-1">
              1. Streamer TikTok Handle (@)
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-[#F6C915] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value.replace(/^@+/, ''))}
                placeholder="your_tiktok_handle"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/45 border border-white/15 text-xs font-mono text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
              />
            </div>
            <p className="text-[11px] text-[#B9A8CC] mt-1">
              Enter your TikTok username without the @ symbol. Viewers typing words in your LIVE chat will claim words on the board.
            </p>
          </div>

          {/* 2. Provided Stream Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#E6BE5A]">
                2. Provided Stream Key
              </label>
              <button
                type="button"
                onClick={() => {
                  const fresh = onRegenerateKey();
                  setStreamKeyInput(fresh);
                }}
                className="flex items-center gap-1 text-[11px] text-[#F6C915] hover:underline cursor-pointer"
                title="Generate a fresh Stream Key"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Generate New Key</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-[#F6C915] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={streamKeyInput}
                  onChange={(e) => setStreamKeyInput(e.target.value)}
                  placeholder="ttk_live_..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/45 border border-white/15 text-xs font-mono text-[#FDE047] placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                />
              </div>
              <button
                type="button"
                onClick={() => handleCopy(streamKeyInput, 'key')}
                className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-[#F5F3F7] flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Copy Stream Key"
              >
                {copiedField === 'key' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-[#B9A8CC] mt-1">
              Use the provided stream key above or paste your own key to authenticate your live stream room.
            </p>
          </div>

          {/* 3. Website It Will Be Hosted On */}
          <div>
            <label className="block text-xs font-semibold text-[#E6BE5A] mb-1">
              3. Hosted Website URL
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-[#F6C915] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                required
                value={websiteInput}
                onChange={(e) => setWebsiteInput(e.target.value)}
                placeholder="https://your-hosted-game-domain.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/45 border border-white/15 text-xs font-mono text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
              />
            </div>
            <p className="text-[11px] text-[#B9A8CC] mt-1">
              The website URL where this game is hosted. Paired with your Stream Key for webhook & relay events.
            </p>
          </div>

          {/* Combined Hosted Endpoint Summary */}
          <div className="p-3 rounded-xl bg-[#160327]/90 border border-[#E6BE5A]/25 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#D6CBE2]">
              <span className="font-semibold text-[#F6C915]">
                Combined Stream Webhook Endpoint
              </span>
              <button
                type="button"
                onClick={() => handleCopy(webhookEndpoint, 'webhook')}
                className="flex items-center gap-1 text-[#F6C915] hover:underline cursor-pointer"
              >
                {copiedField === 'webhook' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Endpoint</span>
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-[11px] text-[#C8B8DA] truncate bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
              POST {webhookEndpoint} (Header: x-stream-key: {streamKeyInput || '...'})
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-400/40 text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-b from-[#FFE566] via-[#F6C915] to-[#D49B27] text-[#1D0830] font-display font-extrabold text-sm tracking-wide shadow-[0_8px_24px_rgba(246,201,21,0.35)] hover:brightness-105 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Radio className="w-4 h-4" />
            <span>{isConnected ? 'Update & Reconnect Stream' : 'Connect TikTok LIVE Stream'}</span>
          </button>
        </form>

        {/* Live Test Sender (When Connected) */}
        {isConnected && (
          <div className="pt-3 border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F6C915] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Test Viewer Chat Event (Verify Leaderboard & Board)</span>
              </span>
            </div>

            {/* Quick Viewer Preset Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {SAMPLE_VIEWERS.map((v) => (
                <button
                  key={v.nickname}
                  type="button"
                  onClick={() => {
                    setTestNickname(v.nickname);
                    setTestAvatar(v.profilePictureUrl);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                    testNickname === v.nickname
                      ? 'bg-[#F6C915]/20 border-[#F6C915] text-[#F6C915] font-semibold'
                      : 'bg-white/5 border-white/10 text-[#D6CBE2] hover:bg-white/10'
                  }`}
                >
                  <img
                    src={v.profilePictureUrl}
                    alt={v.nickname}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span>{v.nickname}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleTriggerTestEvent} className="flex items-center gap-2">
              <input
                type="text"
                value={testComment}
                onChange={(e) => setTestComment(e.target.value)}
                placeholder={
                  sampleUnfoundWord
                    ? `Type word (e.g. ${sampleUnfoundWord})...`
                    : 'Type a word guess...'
                }
                className="flex-1 px-3 py-2 rounded-xl bg-black/45 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
              />
              <button
                type="submit"
                disabled={sendingTest}
                className="px-3.5 py-2 rounded-xl bg-[#F6C915] text-[#1D0830] font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Word</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
