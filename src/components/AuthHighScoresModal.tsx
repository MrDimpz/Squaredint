import React, { useState } from 'react';
import {
  Trophy,
  LogIn,
  LogOut,
  Mail,
  Lock,
  User as UserIcon,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  User,
  HighScoreRecord,
  signInWithGooglePopup,
  loginWithEmailPassword,
  registerWithEmailPassword,
  resetUserPassword,
  logoutUser,
  FIREBASE_PROJECT_ID,
  MAX_DISPLAY_NAME_LENGTH,
} from '../utils/firebase';
import { getSafeAvatarUrl, handleAvatarError } from '../utils/avatar';

interface AuthHighScoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  highScores: HighScoreRecord[];
  currentScore: number;
  currentPuzzleTitle: string;
}

export const AuthHighScoresModal: React.FC<AuthHighScoresModalProps> = ({
  isOpen,
  onClose,
  user,
  highScores,
  currentScore,
  currentPuzzleTitle,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [needsConsoleEnable, setNeedsConsoleEnable] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setNeedsConsoleEnable(false);
    setSubmitting(true);
    try {
      await signInWithGooglePopup();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed before completing.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsConsoleEnable(false);

    if (!email.trim() || password.length < 6) {
      setErrorMsg('Please enter a valid email and a password of at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (authTab === 'register') {
        await registerWithEmailPassword(
          email,
          password,
          displayName.slice(0, MAX_DISPLAY_NAME_LENGTH) || 'Puzzle Seeker'
        );
      } else {
        await loginWithEmailPassword(email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setNeedsConsoleEnable(true);
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in your Firebase Console.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMsg('Invalid email or password. Please check your credentials or create an account.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('This email is already registered. Switch to Sign In instead.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsConsoleEnable(false);

    if (!email.trim()) {
      setErrorMsg('Please enter your email address to receive the password reset link.');
      return;
    }

    setSubmitting(true);
    try {
      await resetUserPassword(email);
      setSuccessMsg(
        `Password reset email sent to ${email.trim()}! Please check your inbox and spam folder.`
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        setErrorMsg('No account found with this email address.');
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Please enter a valid email address.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('Too many reset requests. Please wait a few minutes before trying again.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to send password reset email.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const bestOverallScore = highScores.length > 0 ? highScores[0].score : currentScore;
  const totalBoardsRecorded = highScores.length;
  const featuredFoundCount = highScores.filter((h) => h.foundFeatured).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#2B0948] to-[#170329] border-2 border-[#D4A437] p-6 text-[#F5F3F7] shadow-[0_24px_60px_rgba(0,0,0,0.85)] space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar animate-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-[#F6C915] shrink-0" />
            <div>
              <h2 className="font-display font-extrabold text-lg text-[#F6C915]">
                High Scores & Player Account
              </h2>
              <p className="text-xs text-[#D6CBE2]">
                Sync your scores across devices with Google or Email
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

        {/* Authenticated View vs Sign-In View */}
        {user ? (
          <div className="space-y-4">
            {/* Signed-in Profile Strip */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#1E0533] border border-[#E6BE5A]/35">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={getSafeAvatarUrl(user.photoURL, user.displayName || user.email || 'User')}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(e) => handleAvatarError(e, user.displayName || user.email || 'User')}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#F6C915] shadow-md shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Cloud Sync Active</span>
                  </div>
                  <div className="font-display font-bold text-sm text-[#F5F3F7] truncate mt-0.5">
                    {user.displayName || user.email || 'Puzzle Seeker'}
                  </div>
                  {user.email && (
                    <div className="text-[11px] text-[#B9A8CC] font-mono truncate">
                      {user.email}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => logoutUser()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F5F3F7] cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-3 gap-2.5 text-center bg-[#140223]/90 p-3 rounded-xl border border-white/10">
              <div>
                <div className="text-[11px] text-[#B9A8CC]">Personal Best</div>
                <div className="font-mono font-bold text-base text-[#F6C915] tabular-nums">
                  {bestOverallScore} pts
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#B9A8CC]">Boards Saved</div>
                <div className="font-mono font-bold text-base text-[#F5F3F7] tabular-nums">
                  {totalBoardsRecorded}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#B9A8CC]">★ Missing Pieces</div>
                <div className="font-mono font-bold text-base text-[#E6BE5A] tabular-nums">
                  {featuredFoundCount}
                </div>
              </div>
            </div>

            {/* Recorded High Scores List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#D6CBE2]">
                <span className="font-semibold text-[#F5F3F7]">
                  Your Recorded High Scores
                </span>
                <span className="font-mono text-[11px] text-[#B9A8CC]">
                  Sorted by Score
                </span>
              </div>

              {highScores.length === 0 ? (
                <div className="p-4 rounded-xl bg-black/25 border border-white/10 text-center text-xs text-[#B9A8CC]">
                  Uncover your first 4+ letter word on <span className="text-[#F6C915] font-semibold">{currentPuzzleTitle}</span> to automatically record your high score!
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                  {highScores.map((rec, idx) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/8 border border-white/10 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-[#F6C915] tabular-nums w-5">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#F5F3F7] truncate flex items-center gap-1.5">
                            <span>{rec.puzzleId}</span>
                            {rec.foundFeatured && (
                              <span title="Found the ★ Missing Piece word!" className="inline-flex shrink-0">
                                <Sparkles className="w-3.5 h-3.5 text-[#F6C915]" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#B9A8CC] font-mono tabular-nums">
                            Words: {rec.wordsFound}/{rec.totalWords} · Bonus: +{rec.bonusWordsCount}
                          </div>
                        </div>
                      </div>

                      <div className="font-mono font-bold text-sm text-[#F6C915] tabular-nums shrink-0 ml-2">
                        {rec.score} pts
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* One-Click Google Login */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-white text-[#1D0830] font-display font-bold text-sm shadow-md hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-4 h-4 text-[#4B1276]" />
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-3 text-xs text-[#9E8BB5]">
              <div className="flex-1 h-px bg-white/10" />
              <span>or use Email & Password</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Login / Register Segmented Switch */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-black/35 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-[#F6C915] text-[#1D0830]'
                    : 'text-[#D6CBE2] hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-[#F6C915] text-[#1D0830]'
                    : 'text-[#D6CBE2] hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Forgot Password Mode View */}
            {authTab === 'forgot_password' ? (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-400/30 text-xs text-[#D6CBE2] space-y-1">
                  <h4 className="font-bold text-[#F6C915]">Reset Your Password</h4>
                  <p className="text-[11px] leading-relaxed">
                    Enter the email address associated with your account. We will send you an official Firebase password reset link.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-[#D6CBE2] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9E8BB5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seeker@example.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                    />
                  </div>
                </div>

                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-400/40 text-xs text-emerald-200 flex items-start gap-2 animate-pop">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-400/40 text-xs text-rose-200 flex items-start gap-2 animate-pop">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#FFE566] to-[#E5B012] text-[#1D0830] font-display font-bold text-xs tracking-wide hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Sending Link...' : 'Send Password Reset Email'}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-[#E6BE5A] underline hover:text-[#F6C915] cursor-pointer"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              /* Email / Password Form */
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {authTab === 'register' && (
                  <div>
                    <label className="block text-xs text-[#D6CBE2] mb-1">
                      Player Display Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#9E8BB5] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={MAX_DISPLAY_NAME_LENGTH}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Puzzle Seeker"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-[#D6CBE2] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9E8BB5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seeker@example.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-[#D6CBE2]">
                      Password (min. 6 characters)
                    </label>
                    {authTab === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab('forgot_password');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] text-[#F6C915] underline hover:text-white cursor-pointer font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#9E8BB5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                    />
                  </div>
                </div>

                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-400/40 text-xs text-emerald-200 flex items-start gap-2 animate-pop">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-400/40 text-xs text-rose-200 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                    {needsConsoleEnable && (
                      <div className="pl-6 text-[11px] text-rose-100/90 space-y-1">
                        <p>
                          To use Email/Password authentication, enable the Email/Password provider in your Firebase Console:
                        </p>
                        <a
                          href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-[#F6C915] underline font-semibold"
                        >
                          Open Firebase Auth Providers Console →
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#FFE566] to-[#E5B012] text-[#1D0830] font-display font-bold text-xs tracking-wide hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
                >
                  {submitting
                    ? 'Please wait...'
                    : authTab === 'register'
                      ? 'Create Account & Sync Scores'
                      : 'Sign In with Email'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
