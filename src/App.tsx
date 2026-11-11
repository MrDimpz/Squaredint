/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  RotateCw,
  Lightbulb,
  Volume2,
  VolumeX,
  Pause,
  Hash,
  Sparkles,
  CornerDownLeft,
  Delete,
  BookOpen,
  Grid,
  Compass,
  Sun,
  Moon,
  Trophy,
  Radio,
} from 'lucide-react';
import {
  GameModeId,
  PuzzleBoard,
  generatePuzzle,
  findPathsForInput,
} from './utils/puzzleGenerator';
import {
  fetchWordDefinition,
  WordDefinition,
  getPlayerRank,
  calculateWordScore,
} from './utils/dictionary';
import { soundEngine } from './utils/sound';
import { WordGridBoard } from './components/WordGridBoard';
import { WordListPanel } from './components/WordListPanel';
import { TitleScreen, PauseOrVictoryModal } from './components/GameModals';
import { DateCalendarDropdown } from './components/DateCalendarDropdown';
import { TikTokConnectModal } from './components/TikTokConnectModal';
import { AuthHighScoresModal } from './components/AuthHighScoresModal';
import {
  TikTokLeaderboardPanel,
  LeaderboardPlayer,
  LiveFeedItem,
  GameAnswerItem,
} from './components/TikTokLeaderboardPanel';
import {
  auth,
  onAuthStateChanged,
  User,
  HighScoreRecord,
  subscribeToUserHighScores,
  saveHighScoreToFirestore,
} from './utils/firebase';
import { getSafeAvatarUrl, handleAvatarError } from './utils/avatar';
import { io, Socket } from 'socket.io-client';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY';

interface FeedbackToast {
  id: number;
  text: string;
  subtext?: string;
  avatarUrl?: string;
  tone: 'gold' | 'emerald' | 'purple' | 'error' | 'neutral';
}

interface SavedPuzzleProgress {
  foundWords: string[];
  bonusWords: string[];
  score: number;
  revealedPrefixes: [string, number][];
}

function getLocalTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function App() {
  const todayDateStr = useMemo(() => getLocalTodayString(), []);
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [mode, setMode] = useState<GameModeId>('daily-4x4');
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayDateStr);

  // TikTok Live Socket & Interactive State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [tiktokUsername, setTiktokUsername] = useState<string>(() => {
    try {
      return localStorage.getItem('missing_piece_tiktok_username') || '';
    } catch {
      return '';
    }
  });
  const [tiktokError, setTiktokError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [gameAnswers, setGameAnswers] = useState<GameAnswerItem[]>([]);
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  // Firebase Authentication & High Scores State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [highScores, setHighScores] = useState<HighScoreRecord[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setCurrentUser(usr);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      setHighScores([]);
      return;
    }
    const unsubscribe = subscribeToUserHighScores(currentUser.uid, (scores) => {
      setHighScores(scores);
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Board Dark / Light mode toggle state (affects the game board and tiles rather than the whole page)
  const [boardDarkMode, setBoardDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('missing_piece_board_dark');
    return saved === 'true';
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('missing_piece_board_dark', String(boardDarkMode));
  }, [boardDarkMode]);

  // Generate deterministic puzzle board for selected date (100% tile coverage guaranteed)
  const basePuzzle: PuzzleBoard = useMemo(() => {
    return generatePuzzle(mode, selectedDateStr);
  }, [mode, selectedDateStr]);

  // Monotonically increasing 90-deg rotation steps (0, 1, 2, 3, 4...) — never resets, so zero flash/jiggle!
  const [rotationSteps, setRotationSteps] = useState<number>(0);

  // Player progress state
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [bonusWords, setBonusWords] = useState<string[]>([]);
  const [score, setScore] = useState<number>(0);
  const [revealedPrefixes, setRevealedPrefixes] = useState<Map<string, number>>(new Map());
  const [showAllFirstLetters, setShowAllFirstLetters] = useState<boolean>(false);
  const [showStartBadges, setShowStartBadges] = useState<boolean>(true);

  // Active interaction state
  const [activePath, setActivePath] = useState<number[]>([]);
  const [hintedPath, setHintedPath] = useState<number[] | null>(null);
  const [hintedCells, setHintedCells] = useState<Set<number>>(new Set());
  const [shakeTrigger, setShakeTrigger] = useState<number>(0);
  const [toast, setToast] = useState<FeedbackToast | null>(null);
  const [muted, setMuted] = useState<boolean>(soundEngine.muted);
  const [mobileTab, setMobileTab] = useState<'board' | 'words'>('board');

  // Dictionary API definition inspector state
  const [inspectedWord, setInspectedWord] = useState<string | null>(null);
  const [selectedWordDef, setSelectedWordDef] = useState<WordDefinition | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState<boolean>(false);

  const grid = basePuzzle.grid;
  const requiredWords = basePuzzle.requiredWords;

  // Load saved progress whenever basePuzzle changes
  useEffect(() => {
    setRotationSteps(0);
    setActivePath([]);
    setHintedPath(null);
    setHintedCells(new Set());
    setInspectedWord(null);
    setSelectedWordDef(null);

    const storageKey = `missing_piece_save_${basePuzzle.id}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: SavedPuzzleProgress = JSON.parse(raw);
        setFoundWords(new Set(parsed.foundWords || []));
        setBonusWords(parsed.bonusWords || []);
        setScore(parsed.score || 0);
        setRevealedPrefixes(new Map(parsed.revealedPrefixes || []));
        return;
      }
    } catch {
      // Ignore storage error
    }

    setFoundWords(new Set());
    setBonusWords([]);
    setScore(0);
    setRevealedPrefixes(new Map());
  }, [basePuzzle]);

  // Persist progress to localStorage
  useEffect(() => {
    if (foundWords.size === 0 && bonusWords.length === 0 && revealedPrefixes.size === 0) return;
    const storageKey = `missing_piece_save_${basePuzzle.id}`;
    const payload: SavedPuzzleProgress = {
      foundWords: Array.from(foundWords),
      bonusWords,
      score,
      revealedPrefixes: Array.from(revealedPrefixes.entries()),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }, [foundWords, bonusWords, score, revealedPrefixes, basePuzzle.id]);

  const showToast = useCallback(
    (
      text: string,
      tone: FeedbackToast['tone'] = 'neutral',
      subtext?: string,
      avatarUrl?: string
    ) => {
      setToast({ id: Date.now(), text, tone, subtext, avatarUrl });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  // Compute remaining word starts and total uses per cell for Squaredle-style tile depletion
  const { remainingStartsPerCell, remainingUsesPerCell } = useMemo(() => {
    const totalCells = basePuzzle.size * basePuzzle.size;
    const starts = new Array(totalCells).fill(0);
    const uses = new Array(totalCells).fill(0);

    for (const [word, entry] of requiredWords.entries()) {
      if (!foundWords.has(word)) {
        const startCell = entry.path[0];
        if (startCell !== undefined) {
          starts[startCell]++;
        }
        for (const cellIdx of entry.path) {
          uses[cellIdx]++;
        }
      }
    }
    return { remainingStartsPerCell: starts, remainingUsesPerCell: uses };
  }, [requiredWords, foundWords, basePuzzle.size]);

  // Sample unfound word for quick testing when live connected
  const sampleUnfoundWord = useMemo(() => {
    for (const word of requiredWords.keys()) {
      if (!foundWords.has(word)) return word;
    }
    return undefined;
  }, [requiredWords, foundWords]);

  // Smoothly revolve the board 90 degrees clockwise using monotonic rotationSteps
  const handleRotateBoard = useCallback(() => {
    soundEngine.playRotate();
    setRotationSteps((prev) => prev + 1);
  }, []);

  // Multi-tier Hint action: reveals prefix of an unfound word & highlights its starting path on the board
  const handleUseHint = useCallback(() => {
    const unfoundEntries = Array.from(requiredWords.values()).filter(
      (e) => !foundWords.has(e.word)
    );
    if (unfoundEntries.length === 0) return;

    const targetEntry =
      unfoundEntries.find((e) => (revealedPrefixes.get(e.word) || 0) > 0) ||
      unfoundEntries[0];

    const currentReveal = revealedPrefixes.get(targetEntry.word) || 0;
    const nextReveal = Math.min(targetEntry.word.length - 1, currentReveal + 2);

    setRevealedPrefixes((prev) => {
      const next = new Map(prev);
      next.set(targetEntry.word, nextReveal);
      return next;
    });

    const slicePath = targetEntry.path.slice(0, Math.max(2, nextReveal));
    setHintedPath(slicePath);
    setHintedCells((prev) => {
      const next = new Set(prev);
      next.add(targetEntry.path[0]);
      return next;
    });

    soundEngine.playTileSelect(2);
    showToast(
      `Hint: Starts with "${targetEntry.word.slice(0, nextReveal)}..."`,
      'gold',
      `${targetEntry.word.length}-letter word highlighted on grid`
    );

    setTimeout(() => {
      setHintedPath(null);
    }, 3000);
  }, [requiredWords, foundWords, revealedPrefixes, showToast]);

  // Inspect a word in the live Dictionary API
  const handleInspectWord = useCallback(
    async (word: string, pathOnBoard?: number[]) => {
      const upper = word.toUpperCase();
      setInspectedWord(upper);
      if (pathOnBoard && pathOnBoard.length > 0) {
        setHintedPath(pathOnBoard);
        setTimeout(() => setHintedPath(null), 2200);
      }
      setIsLoadingDef(true);
      const def = await fetchWordDefinition(upper);
      setSelectedWordDef(def);
      setIsLoadingDef(false);
    },
    []
  );

  // Keep latest puzzle & word refs for WebSocket event handler
  // Keep latest puzzle & word refs for socket event handlers
  const puzzleStateRef = useRef({
    basePuzzle,
    grid,
    requiredWords,
    foundWords,
    bonusWords,
    score,
    handleRotateBoard,
    handleUseHint,
    showToast,
  });

  useEffect(() => {
    puzzleStateRef.current = {
      basePuzzle,
      grid,
      requiredWords,
      foundWords,
      bonusWords,
      score,
      handleRotateBoard,
      handleUseHint,
      showToast,
    };
  }, [
    basePuzzle,
    grid,
    requiredWords,
    foundWords,
    bonusWords,
    score,
    handleRotateBoard,
    handleUseHint,
    showToast,
  ]);

  // Handle incoming chat messages from TikTok LIVE or simulator
  const handleIncomingChatMessage = useCallback(
    async (data: { uniqueId: string; nickname: string; comment: string; profilePictureUrl: string }) => {
      const {
        basePuzzle: curPuzzle,
        grid: curGrid,
        requiredWords: curRequired,
        foundWords: curFound,
        bonusWords: curBonus,
        handleRotateBoard: rotateFn,
        handleUseHint: hintFn,
        showToast: toastFn,
      } = puzzleStateRef.current;

      const uniqueId = (data.uniqueId || 'viewer').replace(/^@+/, '');
      const cleanNick = (data.nickname || uniqueId).replace(/^@+/, '') || 'Player';
      const rawComment = (data.comment || '').trim();
      if (!rawComment) return;
      const lowerComment = rawComment.toLowerCase();
      const pfp = getSafeAvatarUrl(data.profilePictureUrl, uniqueId || cleanNick);

      // Support chat commands !rotate and !hint
      if (lowerComment === '!rotate' || lowerComment === 'rotate') {
        rotateFn();
        toastFn(`${cleanNick} rotated the board!`, 'purple', '90° Clockwise', pfp);
        setLiveFeed((prev) => [
          ...prev.slice(-99),
          {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: 'chat',
            uniqueId,
            nickname: cleanNick,
            profilePictureUrl: pfp,
            comment: rawComment,
            isCommand: true,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (lowerComment === '!hint' || lowerComment === 'hint') {
        hintFn();
        setLiveFeed((prev) => [
          ...prev.slice(-99),
          {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: 'chat',
            uniqueId,
            nickname: cleanNick,
            profilePictureUrl: pfp,
            comment: rawComment,
            isCommand: true,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // Check candidate words (4+ letters)
      const candidateWords = rawComment.toUpperCase().match(/[A-Z]{4,15}/g);
      let matchedWord: string | undefined;
      let matchedPoints: number | undefined;

      if (candidateWords && candidateWords.length > 0) {
        for (const candidate of candidateWords) {
          // 1. Required Word on current board
          if (curRequired.has(candidate)) {
            if (curFound.has(candidate)) {
              continue;
            }

            const entry = curRequired.get(candidate)!;
            matchedWord = candidate;
            matchedPoints = entry.points;

            setFoundWords((prev) => {
              if (prev.has(candidate)) return prev;
              const next = new Set(prev);
              next.add(candidate);
              if (next.size === curRequired.size) {
                setTimeout(() => {
                  soundEngine.playVictory();
                  setGameState('VICTORY');
                }, 650);
              }
              return next;
            });

            setScore((prev) => prev + entry.points);
            setHintedPath(entry.path);
            setTimeout(() => setHintedPath(null), 2200);

            if (entry.isFeatured) {
              soundEngine.playWordFound(candidate.length, true);
              toastFn(
                `★ ${cleanNick} found ${candidate}!`,
                'gold',
                `+${entry.points} pts (Missing Piece Bonus)`,
                pfp
              );
            } else {
              soundEngine.playWordFound(candidate.length, false);
              toastFn(
                `${cleanNick} found ${candidate}!`,
                candidate.length >= 6 ? 'gold' : 'emerald',
                `+${entry.points} ${entry.points === 1 ? 'pt' : 'pts'}`,
                pfp
              );
            }

            // Update individual game answers feed
            const gameAnswerItem: GameAnswerItem = {
              id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              uniqueId,
              nickname: cleanNick,
              profilePictureUrl: pfp,
              word: candidate,
              points: entry.points,
              timestamp: Date.now(),
              isBonus: false,
            };
            setGameAnswers((prev) => [gameAnswerItem, ...prev].slice(0, 50));

            // Update player on leaderboard (nickname only, never @name)
            setLeaderboard((prev) => {
              const existingIdx = prev.findIndex((p) => p.id === uniqueId);
              const newAnswer = { word: candidate, points: entry.points, timestamp: Date.now() };
              let updated: LeaderboardPlayer[];
              if (existingIdx >= 0) {
                const ex = prev[existingIdx];
                const newPlayer: LeaderboardPlayer = {
                  ...ex,
                  nickname: cleanNick,
                  profilePictureUrl: pfp || ex.profilePictureUrl,
                  score: ex.score + entry.points,
                  wordsFound: ex.wordsFound + 1,
                  featuredFound: ex.featuredFound || Boolean(entry.isFeatured),
                  lastWord: candidate,
                  lastWordPoints: entry.points,
                  answers: [newAnswer, ...(ex.answers || [])].slice(0, 10),
                  updatedAt: Date.now(),
                };
                updated = [...prev];
                updated[existingIdx] = newPlayer;
              } else {
                const newPlayer: LeaderboardPlayer = {
                  id: uniqueId,
                  nickname: cleanNick,
                  profilePictureUrl: pfp,
                  score: entry.points,
                  wordsFound: 1,
                  bonusWords: 0,
                  featuredFound: Boolean(entry.isFeatured),
                  lastWord: candidate,
                  lastWordPoints: entry.points,
                  answers: [newAnswer],
                  updatedAt: Date.now(),
                };
                updated = [newPlayer, ...prev];
              }
              return updated.sort((a, b) => b.score - a.score || b.wordsFound - a.wordsFound);
            });

            break;
          }

          // 2. Bonus Word traceable on grid
          if (!curBonus.includes(candidate)) {
            const matchingPaths = findPathsForInput(curGrid, curPuzzle.size, candidate);
            if (matchingPaths.length > 0) {
              const def = await fetchWordDefinition(candidate);
              if (def) {
                const bonusPts = calculateWordScore(candidate);
                matchedWord = candidate;
                matchedPoints = bonusPts;
                soundEngine.playBonusWord();
                setBonusWords((prev) => (prev.includes(candidate) ? prev : [candidate, ...prev]));
                setScore((prev) => prev + bonusPts);
                setHintedPath(matchingPaths[0]);
                setTimeout(() => setHintedPath(null), 2000);
                toastFn(
                  `${cleanNick} found bonus ${candidate}!`,
                  'purple',
                  `+${bonusPts} ${bonusPts === 1 ? 'Bonus pt' : 'Bonus pts'}`,
                  pfp
                );

                const gameAnswerItem: GameAnswerItem = {
                  id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  uniqueId,
                  nickname: cleanNick,
                  profilePictureUrl: pfp,
                  word: candidate,
                  points: bonusPts,
                  timestamp: Date.now(),
                  isBonus: true,
                };
                setGameAnswers((prev) => [gameAnswerItem, ...prev].slice(0, 50));

                setLeaderboard((prev) => {
                  const existingIdx = prev.findIndex((p) => p.id === uniqueId);
                  const newAnswer = { word: candidate, points: bonusPts, timestamp: Date.now(), isBonus: true };
                  let updated: LeaderboardPlayer[];
                  if (existingIdx >= 0) {
                    const ex = prev[existingIdx];
                    const newPlayer: LeaderboardPlayer = {
                      ...ex,
                      nickname: cleanNick,
                      profilePictureUrl: pfp || ex.profilePictureUrl,
                      score: ex.score + bonusPts,
                      bonusWords: ex.bonusWords + 1,
                      lastWord: candidate,
                      lastWordPoints: bonusPts,
                      answers: [newAnswer, ...(ex.answers || [])].slice(0, 10),
                      updatedAt: Date.now(),
                    };
                    updated = [...prev];
                    updated[existingIdx] = newPlayer;
                  } else {
                    const newPlayer: LeaderboardPlayer = {
                      id: uniqueId,
                      nickname: cleanNick,
                      profilePictureUrl: pfp,
                      score: bonusPts,
                      wordsFound: 0,
                      bonusWords: 1,
                      featuredFound: false,
                      lastWord: candidate,
                      lastWordPoints: bonusPts,
                      answers: [newAnswer],
                      updatedAt: Date.now(),
                    };
                    updated = [newPlayer, ...prev];
                  }
                  return updated.sort((a, b) => b.score - a.score || b.wordsFound - a.wordsFound);
                });
                break;
              }
            }
          }
        }
      }

      setLiveFeed((prev) => [
        ...prev.slice(-99),
        {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'chat',
          uniqueId,
          nickname: cleanNick,
          profilePictureUrl: pfp,
          comment: rawComment,
          matchedWord,
          matchedPoints,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  // Connect to persistent Socket.IO server (chat events only)
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('tiktok-connected', ({ username, roomId: rId }: { username: string; roomId?: string }) => {
      setIsLiveConnected(true);
      setTiktokUsername(username);
      setRoomId(rId || '');
      setTiktokError(null);
      try {
        localStorage.setItem('missing_piece_tiktok_username', username);
      } catch {
        // ignore
      }
      showToast(
        `TikTok LIVE Connected: @${username}`,
        'emerald',
        'Leaderboard Active · Viewer chat guesses will register live'
      );
    });

    newSocket.on('tiktok-status', (status: { connected: boolean; username: string; roomId: string }) => {
      if (status) {
        setIsLiveConnected(Boolean(status.connected));
        if (status.username) setTiktokUsername(status.username);
        if (status.roomId) setRoomId(status.roomId);
      }
    });

    newSocket.on('tiktok-error', (msg: string) => {
      setTiktokError(msg || 'Failed to connect to TikTok Live');
      setIsLiveConnected(false);
      showToast(msg || 'TikTok Live error', 'error');
    });

    newSocket.on('tiktok-disconnected', () => {
      setIsLiveConnected(false);
      setRoomId('');
      showToast('Disconnected from TikTok LIVE', 'neutral');
    });

    // Actual chat messages only (likes & gifts ignored)
    newSocket.on('chat-message', (data: any) => {
      handleIncomingChatMessage(data);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [handleIncomingChatMessage, showToast]);

  const handleConnectTikTok = useCallback(
    (username: string, isTestMode?: boolean) => {
      const clean = username.trim().replace(/^@+/, '') || 'test_streamer';
      setTiktokUsername(clean);
      setTiktokError(null);
      try {
        localStorage.setItem('missing_piece_tiktok_username', clean);
      } catch {
        // ignore
      }

      if (isTestMode) {
        setIsLiveConnected(true);
        setRoomId('TEST_SIMULATION_ROOM');
        showToast(
          `Test Mode Active: Connected as @${clean}`,
          'gold',
          'Leaderboard & Chat Feed active for manual testing!'
        );
      } else {
        socket?.emit('connect-tiktok', clean);
        showToast(`Connecting @${clean} to TikTok LIVE...`, 'neutral');
      }

      setIsConnectModalOpen(false);
      if (gameState === 'TITLE_MENU') {
        setGameState('PLAYING');
      }
    },
    [socket, gameState, showToast]
  );

  const handleReconnectTikTok = useCallback(
    (username: string, isTestMode?: boolean) => {
      const clean = username.trim().replace(/^@+/, '') || tiktokUsername || 'streamer';
      setTiktokUsername(clean);
      setTiktokError(null);

      if (isTestMode) {
        setIsLiveConnected(true);
        setRoomId('TEST_SIMULATION_ROOM');
        showToast(
          `Test Mode Reconnected: @${clean}`,
          'gold',
          'Leaderboard & Chat Feed refreshed for testing!'
        );
      } else {
        socket?.emit('connect-tiktok', clean);
        showToast(`Reconnecting @${clean} to TikTok LIVE...`, 'neutral');
      }

      setIsConnectModalOpen(false);
      if (gameState === 'TITLE_MENU') {
        setGameState('PLAYING');
      }
    },
    [socket, tiktokUsername, gameState, showToast]
  );

  const handleDisconnectTikTok = useCallback(() => {
    socket?.emit('disconnect-tiktok');
    setIsLiveConnected(false);
    setRoomId('');
    showToast('Disconnected from TikTok LIVE', 'neutral');
  }, [socket, showToast]);

  const handleResetLeaderboard = useCallback(() => {
    setLeaderboard([]);
    setGameAnswers([]);
    setLiveFeed([]);
    showToast('Leaderboard scores reset', 'neutral');
  }, [showToast]);

  const handleSimulateChat = useCallback(
    (data: { uniqueId: string; nickname: string; comment: string; profilePictureUrl: string }) => {
      socket?.emit('chat-message', data);
    },
    [socket]
  );

  // Submit a traced or typed path directly on the board
  const handleSubmitPath = useCallback(
    async (path: number[]) => {
      if (path.length === 0) return;
      const word = path.map((idx) => grid[idx]).join('');
      setActivePath([]);
      setHintedPath(null);

      if (word.length < 4) {
        soundEngine.playInvalid();
        setShakeTrigger((prev) => prev + 1);
        showToast('Words must be at least 4 letters', 'error');
        return;
      }

      // 1. Check if it's in the Required Words list
      if (requiredWords.has(word)) {
        if (foundWords.has(word)) {
          soundEngine.playAlreadyFound();
          showToast(`${word} already found`, 'neutral');
          return;
        }

        const entry = requiredWords.get(word)!;
        const nextFound = new Set(foundWords);
        nextFound.add(word);
        setFoundWords(nextFound);

        const nextScore = score + entry.points;
        setScore(nextScore);

        if (entry.isFeatured) {
          soundEngine.playWordFound(word.length, true);
          showToast(
            `★ MISSING PIECE FOUND: ${word}!`,
            'gold',
            `+${entry.points} pts (Featured Bonus)`
          );
        } else {
          soundEngine.playWordFound(word.length, false);
          showToast(
            `${word}`,
            word.length >= 6 ? 'gold' : 'emerald',
            `+${entry.points} ${entry.points === 1 ? 'pt' : 'pts'}`
          );
        }

        // Automatically fetch live definition for the newly discovered word
        handleInspectWord(word);

        if (currentUser) {
          saveHighScoreToFirestore({
            user: currentUser,
            puzzleId: basePuzzle.id,
            mode,
            score: nextScore,
            wordsFound: nextFound.size,
            totalWords: requiredWords.size,
            bonusWordsCount: bonusWords.length,
            foundFeatured: Boolean(nextFound.has(basePuzzle.featuredWord)),
          });
        }

        // Check if 100% of required words are now uncovered
        if (nextFound.size === requiredWords.size) {
          setTimeout(() => {
            soundEngine.playVictory();
            setGameState('VICTORY');
          }, 650);
        }
        return;
      }

      // 2. Check if already in Bonus Words
      if (bonusWords.includes(word)) {
        soundEngine.playAlreadyFound();
        showToast(`Bonus word ${word} already recorded`, 'neutral');
        return;
      }

      // 3. Query fast Dictionary API to verify if it's a valid English Bonus Word
      const def = await fetchWordDefinition(word);
      if (def) {
        const bonusPts = calculateWordScore(word);
        soundEngine.playBonusWord();
        setBonusWords((prev) => [word, ...prev]);
        setScore((prev) => prev + bonusPts);
        setInspectedWord(word);
        setSelectedWordDef(def);
        showToast(
          `Bonus Word: ${word}`,
          'purple',
          `+${bonusPts} ${bonusPts === 1 ? 'Bonus pt' : 'Bonus pts'} · Dictionary Verified`
        );
      } else {
        soundEngine.playInvalid();
        setShakeTrigger((prev) => prev + 1);
        showToast(`${word} is not in the puzzle lexicon`, 'error');
      }
    },
    [grid, requiredWords, foundWords, bonusWords, score, showToast, handleInspectWord]
  );

  // Step to previous usable date when clicking "Prev Day" in modal
  const handleStepPreviousDate = useCallback(() => {
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const prevDate = new Date(y, m - 1, d - 1);
    const ny = prevDate.getFullYear();
    const nm = String(prevDate.getMonth() + 1).padStart(2, '0');
    const nd = String(prevDate.getDate()).padStart(2, '0');
    const candidate = `${ny}-${nm}-${nd}`;
    if (candidate >= '2024-01-01') {
      setSelectedDateStr(candidate);
    }
  }, [selectedDateStr]);

  // Keyboard controls for Title Screen & Active Play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isConnectModalOpen) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (gameState === 'TITLE_MENU') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setGameState('PLAYING');
        }
        return;
      }

      if (gameState === 'PAUSED' || gameState === 'VICTORY') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setGameState('PLAYING');
        }
        return;
      }

      if (gameState !== 'PLAYING') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (activePath.length > 0) {
          setActivePath([]);
        } else {
          setGameState('PAUSED');
        }
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        handleRotateBoard();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (activePath.length >= 2) {
          handleSubmitPath(activePath);
        }
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (activePath.length > 0) {
          const shortened = activePath.slice(0, -1);
          setActivePath(shortened);
          soundEngine.playBacktrack();
        }
        return;
      }

      // Letter typing A-Z
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        const typedChar = e.key.toUpperCase();
        const currentTypedWord = activePath.map((idx) => grid[idx]).join('') + typedChar;
        const matchingPaths = findPathsForInput(grid, basePuzzle.size, currentTypedWord);

        if (matchingPaths.length > 0) {
          setActivePath(matchingPaths[0]);
          soundEngine.playTileSelect(matchingPaths[0].length - 1);
        } else {
          soundEngine.playInvalid();
          setShakeTrigger((prev) => prev + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isConnectModalOpen,
    gameState,
    activePath,
    grid,
    basePuzzle.size,
    handleRotateBoard,
    handleSubmitPath,
  ]);

  // Clear active path on window blur
  useEffect(() => {
    const handleBlur = () => setActivePath([]);
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  const currentTracedWord = activePath.map((idx) => grid[idx]).join('');
  const progressPct =
    requiredWords.size > 0
      ? Math.round((foundWords.size / requiredWords.size) * 100)
      : 0;
  const rankInfo = getPlayerRank(progressPct);
  const foundFeatured = foundWords.has(basePuzzle.featuredWord);

  return (
    <div className="relative w-screen h-screen overflow-hidden border-[5px] border-[#D4A437] bg-[radial-gradient(circle_at_50%_15%,#44106B_0%,#210536_58%,#11021D_100%)] text-[#F5F3F7] font-sans flex flex-col select-none">
      {/* Title Screen Overlay */}
      {gameState === 'TITLE_MENU' && (
        <TitleScreen
          selectedMode={mode}
          onSelectMode={(m) => setMode(m)}
          onStartGame={() => setGameState('PLAYING')}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          isLiveConnected={isLiveConnected}
          connectedHandle={tiktokUsername}
          dailyNumber={basePuzzle.puzzleNumber}
          dateLabel={basePuzzle.dateLabel}
        />
      )}

      {/* Pause or Victory Modal */}
      {(gameState === 'PAUSED' || gameState === 'VICTORY') && (
        <PauseOrVictoryModal
          type={gameState}
          puzzle={basePuzzle}
          score={score}
          foundCount={foundWords.size}
          totalRequired={requiredWords.size}
          bonusCount={bonusWords.length}
          foundFeatured={foundFeatured}
          leaderboard={leaderboard}
          onResume={() => setGameState('PLAYING')}
          onNewSeededBoard={() => {
            handleStepPreviousDate();
            setGameState('PLAYING');
          }}
          onSwitchMode={(newMode) => {
            setMode(newMode);
            setGameState('PLAYING');
          }}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          isLiveConnected={isLiveConnected}
          onReturnTitle={() => setGameState('TITLE_MENU')}
        />
      )}

      {/* TikTok LIVE Stream Connect Modal */}
      <TikTokConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        isConnected={isLiveConnected}
        tiktokUsername={tiktokUsername}
        tiktokError={tiktokError}
        roomId={roomId}
        onConnect={handleConnectTikTok}
        onReconnect={handleReconnectTikTok}
        onDisconnect={handleDisconnectTikTok}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onSimulateChat={handleSimulateChat}
        sampleUnfoundWord={sampleUnfoundWord}
      />

      {/* Firebase Account & High Scores Modal */}
      <AuthHighScoresModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        user={currentUser}
        highScores={highScores}
        currentScore={score}
        currentPuzzleTitle={`Daily Puzzle #${basePuzzle.puzzleNumber}`}
      />

      {/* Perimeter Game HUD Header */}
      <header className="shrink-0 flex flex-col px-3 sm:px-6 py-2 bg-[#170428]/90 border-b border-[#E6BE5A]/20">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Emblem + Title + Calendar Date Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setGameState('TITLE_MENU')}
              className="flex items-center gap-2.5 group cursor-pointer text-left shrink-0"
              title="Return to Title Screen"
            >
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="The Missing Piece Emblem"
                referrerPolicy="no-referrer"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-contain drop-shadow group-hover:scale-105 transition-transform shrink-0"
              />
              <div className="hidden lg:block min-w-0">
                <div className="font-display font-extrabold text-sm sm:text-base tracking-tight text-[#F6C915] truncate">
                  THE MISSING PIECE
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#D6CBE2] font-mono tabular-nums">
                  <span>{basePuzzle.title}</span>
                  <span aria-hidden="true">·</span>
                  <span>#{basePuzzle.puzzleNumber}</span>
                </div>
              </div>
            </button>

            {/* Dropdown Calendar Menu blocking out unusable future dates */}
            <DateCalendarDropdown
              selectedDateStr={selectedDateStr}
              todayDateStr={todayDateStr}
              currentMode={mode}
              onSelectDate={(dateStr) => setSelectedDateStr(dateStr)}
            />
          </div>

          {/* Center (Desktop/Tablet md+): Rank Progress & Score Cluster */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                <span className="font-semibold text-[#E6BE5A]">
                  {rankInfo.current.name}
                </span>
                <span className="text-[#8E79A6]" aria-hidden="true">·</span>
                <span className="font-mono font-bold text-[#F6C915] tabular-nums">
                  {score} pts
                </span>
                <span className="text-[#8E79A6]" aria-hidden="true">·</span>
                <span className="font-mono text-[#F5F3F7] tabular-nums">
                  {foundWords.size}/{requiredWords.size} ({progressPct}%)
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-36 lg:w-44 h-1.5 bg-black/40 rounded-full overflow-hidden mt-1 border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-[#D49B27] via-[#F6C915] to-[#FFE566] transition-all duration-300"
                  style={{ width: `${Math.max(3, progressPct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right: Mode Switcher, TikTok Connect Button, Board Dark Mode Toggle, Audio Mute & Menu */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Mode Quick Switch on Desktop */}
            <div className="hidden xl:flex items-center gap-1 p-1 bg-black/30 rounded-lg border border-white/10 mr-1">
              {(
                [
                  { id: 'express-3x3', label: '3×3' },
                  { id: 'daily-4x4', label: '4×4' },
                  { id: 'royal-5x5', label: '5×5' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
                    mode === m.id
                      ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                      : 'text-[#D6CBE2] hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* TikTok Stream Connect Button */}
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isLiveConnected
                  ? 'bg-rose-950/80 border-rose-400/60 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.3)]'
                  : 'bg-white/10 hover:bg-white/15 border-[#E6BE5A]/40 text-[#F6C915]'
              }`}
              title={
                isLiveConnected
                  ? `Connected to TikTok LIVE as @${tiktokUsername.replace(/^@+/, '')}`
                  : 'Connect your TikTok LIVE stream or start Test Mode'
              }
            >
              <Radio
                className={`w-4 h-4 ${
                  isLiveConnected ? 'text-rose-400 animate-pulse' : 'text-[#F6C915]'
                }`}
              />
              <span>
                {isLiveConnected
                  ? `LIVE · @${tiktokUsername.replace(/^@+/, '')}`
                  : 'Connect'}
              </span>
            </button>

            {/* Player Account / High Scores Button */}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                currentUser
                  ? 'bg-purple-950/80 border-purple-400/60 text-purple-200'
                  : 'bg-white/8 hover:bg-white/15 border-white/10 text-[#D6CBE2] hover:text-white'
              }`}
              title={
                currentUser
                  ? `Account: ${currentUser.displayName || currentUser.email}`
                  : 'Sign In / Account High Scores'
              }
            >
              {currentUser?.photoURL ? (
                <img
                  src={getSafeAvatarUrl(currentUser.photoURL, currentUser.displayName || 'User')}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(e) => handleAvatarError(e, currentUser.displayName || 'User')}
                  className="w-4 h-4 rounded-full object-cover border border-[#F6C915]"
                />
              ) : (
                <Trophy className="w-4 h-4 text-[#F6C915]" />
              )}
              <span className="hidden sm:inline">
                {currentUser ? (currentUser.displayName || 'Account') : 'Account'}
              </span>
            </button>

            {/* Board Dark / Light Mode Toggle Button */}
            <button
              type="button"
              onClick={() => setBoardDarkMode((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                boardDarkMode
                  ? 'bg-[#2E1149] border-[#F6C915]/60 text-[#F6C915]'
                  : 'bg-white/8 hover:bg-white/15 border-white/10 text-[#D6CBE2] hover:text-white'
              }`}
              title={boardDarkMode ? 'Switch Board to Light Tiles' : 'Switch Board to Dark Tiles'}
              aria-label={boardDarkMode ? 'Switch Board to Light Tiles' : 'Switch Board to Dark Tiles'}
            >
              {boardDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden lg:inline">{boardDarkMode ? 'Light Board' : 'Dark Board'}</span>
            </button>

            {/* Audio Mute Toggle */}
            <button
              type="button"
              onClick={() => setMuted(soundEngine.toggleMute())}
              className="p-1.5 sm:p-2 rounded-lg bg-white/8 hover:bg-white/15 text-[#D6CBE2] hover:text-white transition-colors cursor-pointer shrink-0"
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setGameState('PAUSED')}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F5F3F7] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Pause className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </div>

        {/* Mobile/Compact Sub-Row (< md): Score, Progress Bar & Words Counter */}
        <div className="flex md:hidden items-center justify-between gap-2.5 pt-1.5 mt-1.5 border-t border-white/10 text-[11px] whitespace-nowrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-semibold text-[#E6BE5A]">{rankInfo.current.name}</span>
            <span className="text-[#8E79A6]" aria-hidden="true">·</span>
            <span className="font-mono font-bold text-[#F6C915] tabular-nums">{score} pts</span>
          </div>

          <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10 max-w-40">
            <div
              className="h-full bg-gradient-to-r from-[#D49B27] via-[#F6C915] to-[#FFE566] transition-all duration-300"
              style={{ width: `${Math.max(4, progressPct)}%` }}
            />
          </div>

          <span className="font-mono text-[#F5F3F7] tabular-nums shrink-0">
            {foundWords.size}/{requiredWords.size} ({progressPct}%)
          </span>
        </div>
      </header>

      {/* Mobile Segmented Switcher (Board vs Lexicon / Live Leaderboard) */}
      <div className="flex lg:hidden items-center justify-between px-4 py-2 bg-[#1D0631] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1 p-1 bg-black/30 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => setMobileTab('board')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              mobileTab === 'board'
                ? 'bg-[#F6C915] text-[#1D0830]'
                : 'text-[#D6CBE2]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Puzzle Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('words')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              mobileTab === 'words'
                ? 'bg-[#F6C915] text-[#1D0830]'
                : 'text-[#D6CBE2]'
            }`}
          >
            {isLiveConnected ? (
              <>
                <Trophy className="w-3.5 h-3.5" />
                <span>Leaderboard ({leaderboard.length})</span>
              </>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5" />
                <span>Words ({foundWords.size}/{requiredWords.size})</span>
              </>
            )}
          </button>
        </div>

        {/* Mobile Mode Switcher */}
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'express-3x3', label: '3×3' },
              { id: 'daily-4x4', label: '4×4' },
              { id: 'royal-5x5', label: '5×5' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-2 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                mode === m.id
                  ? 'bg-[#E6BE5A] text-[#1D0830]'
                  : 'bg-white/5 text-[#D6CBE2]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Playfield Split Layout */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-3 sm:px-6 py-2.5 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch overflow-hidden">
        {/* Left/Center Column: Active Word Readout + Tactile Grid + Action Bar */}
        <section
          className={`${
            isLiveConnected ? 'lg:col-span-5 xl:col-span-5' : 'lg:col-span-6 xl:col-span-6'
          } flex flex-col items-center justify-between min-h-0 ${
            mobileTab === 'words' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Live Word Sequence Banner & Feedback Toast */}
          <div className="w-full max-w-[390px] h-14 flex flex-col items-center justify-center relative">
            {currentTracedWord.length > 0 ? (
              <div className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#2B0846] border-2 border-[#F6C915] shadow-[0_8px_22px_rgba(246,201,21,0.28)] animate-pop">
                <span className="font-display font-extrabold text-xl sm:text-2xl tracking-widest text-[#F6C915]">
                  {currentTracedWord}
                </span>
                {currentTracedWord.length >= 4 && (
                  <span className="text-xs font-mono font-bold text-[#E6BE5A] tabular-nums">
                    +{calculateWordScore(currentTracedWord, currentTracedWord === basePuzzle.featuredWord)} pts
                  </span>
                )}
              </div>
            ) : toast ? (
              <div
                key={toast.id}
                className={`flex items-center gap-2.5 px-4 py-1.5 rounded-xl border text-center animate-pop ${
                  toast.tone === 'gold'
                    ? 'bg-gradient-to-r from-[#4B1272] via-[#5E198E] to-[#4B1272] border-[#F6C915] text-[#FDE047]'
                    : toast.tone === 'emerald'
                      ? 'bg-[#133A2E]/95 border-emerald-400/50 text-emerald-200'
                      : toast.tone === 'purple'
                        ? 'bg-[#360E5A]/95 border-[#E6BE5A]/50 text-[#F5F3F7]'
                        : toast.tone === 'error'
                          ? 'bg-[#451222]/95 border-rose-400/50 text-rose-200'
                          : 'bg-white/10 border-white/20 text-[#D6CBE2]'
                }`}
              >
                {toast.avatarUrl && (
                  <img
                    src={toast.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(e) => handleAvatarError(e, toast.text)}
                    className="w-7 h-7 rounded-full object-cover border border-[#F6C915] shrink-0"
                  />
                )}
                <div className="flex flex-col items-center justify-center">
                  <span className="font-display font-bold text-sm tracking-wide">
                    {toast.text}
                  </span>
                  {toast.subtext && (
                    <span className="text-[11px] font-mono opacity-90">{toast.subtext}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#C4B4D6]">
                <Sparkles className="w-3.5 h-3.5 text-[#F6C915]" />
                <span>
                  {isLiveConnected
                    ? 'TikTok LIVE Interactive: Viewers type 4+ letter words in chat!'
                    : 'Swipe adjacent letters or type to form 4+ letter words'}
                </span>
              </div>
            )}
          </div>

          {/* Words Found / Required Counter Indicator */}
          <div className="w-full max-w-[390px] px-1 py-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-[#E6BE5A]">
                Words Found
              </span>
              <span className="font-mono font-extrabold text-sm sm:text-base text-[#F6C915] bg-[#3B115A] px-2.5 py-0.5 rounded-lg border border-[#F6C915]/30 shadow-xs tabular-nums">
                {foundWords.size} / {requiredWords.size}
              </span>
              {bonusWords.length > 0 && (
                <span className="text-[11px] font-mono font-semibold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  +{bonusWords.length} bonus
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#D6CBE2] tabular-nums">
                {Math.min(100, Math.round((foundWords.size / Math.max(requiredWords.size, 1)) * 100))}%
              </span>
              <div className="w-20 sm:w-24 h-2 bg-[#260C3B] rounded-full overflow-hidden border border-[#52217D]">
                <div
                  className="h-full bg-gradient-to-r from-[#E6BE5A] to-[#F6C915] transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(100, (foundWords.size / Math.max(requiredWords.size, 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Squaredle/Squares Board */}
          <div className="my-auto py-1">
            <WordGridBoard
              grid={grid}
              size={basePuzzle.size}
              activePath={activePath}
              onPathChange={setActivePath}
              onSubmitPath={handleSubmitPath}
              remainingStartsPerCell={remainingStartsPerCell}
              remainingUsesPerCell={remainingUsesPerCell}
              showStartBadges={showStartBadges}
              hintedPath={hintedPath}
              hintedCells={hintedCells}
              rotationSteps={rotationSteps}
              boardDarkMode={boardDarkMode}
              shakeTrigger={shakeTrigger}
            />
          </div>

          {/* Bottom Tactile Control Bar */}
          <div className="w-full max-w-[404px] space-y-2.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleRotateBoard}
                className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-[#F5F3F7] transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                title="Revolve Board 90° (Spacebar)"
              >
                <RotateCw className="w-4 h-4 text-[#F6C915]" />
                <span>Revolve 90°</span>
              </button>

              <button
                type="button"
                onClick={handleUseHint}
                className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-b from-[#491274] to-[#320A52] hover:brightness-110 border border-[#E6BE5A]/55 text-xs font-semibold text-[#FDE047] transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                title="Reveal starting letters and path direction for an unfound word"
              >
                <Lightbulb className="w-4 h-4 text-[#F6C915]" />
                <span>Reveal Hint</span>
              </button>

              <button
                type="button"
                onClick={() => setShowStartBadges((prev) => !prev)}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  showStartBadges
                    ? 'bg-[#F6C915]/20 border-[#F6C915]/60 text-[#F6C915]'
                    : 'bg-white/8 border-white/15 text-[#D6CBE2]'
                }`}
                title="Toggle corner numbers showing how many remaining words start on each tile"
              >
                <Hash className="w-4 h-4" />
                <span>Starts</span>
              </button>

              {activePath.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActivePath((prev) => prev.slice(0, -1))}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#F5F3F7] cursor-pointer"
                    title="Undo last letter (Backspace)"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmitPath(activePath)}
                    className="px-3.5 py-2.5 rounded-xl bg-[#F6C915] text-[#1D0830] font-bold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    title="Submit Word (Enter)"
                  >
                    <CornerDownLeft className="w-4 h-4" />
                    <span>Enter</span>
                  </button>
                </>
              )}
            </div>

            {/* Featured Missing Piece Status Strip */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#19042B]/80 border border-[#E6BE5A]/25 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-[#E6BE5A]">
                <Compass className="w-3.5 h-3.5 text-[#F6C915]" />
                <span>★ Missing Piece Bonus Word:</span>
              </div>
              <span className="font-mono font-bold tracking-widest text-[#F6C915]">
                {foundFeatured
                  ? basePuzzle.featuredWord
                  : basePuzzle.featuredWord
                      .split('')
                      .map((ch, idx) =>
                        idx < (revealedPrefixes.get(basePuzzle.featuredWord) || 1) ? ch : '·'
                      )
                      .join(' ')}
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Replaces Words Found Board with Live Player Leaderboard & Live Chat Feed when TikTok LIVE is connected */}
        <section
          className={`${
            isLiveConnected ? 'lg:col-span-7 xl:col-span-7' : 'lg:col-span-6 xl:col-span-6'
          } h-full min-h-0 overflow-hidden flex flex-col ${
            mobileTab === 'board' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {isLiveConnected ? (
            <TikTokLeaderboardPanel
              tiktokUsername={tiktokUsername}
              isConnected={isLiveConnected}
              leaderboard={leaderboard}
              gameAnswers={gameAnswers}
              liveFeed={liveFeed}
              foundWordsCount={foundWords.size}
              totalRequiredWords={requiredWords.size}
              bonusWordsCount={bonusWords.length}
              sampleUnfoundWord={sampleUnfoundWord}
              isSimulatorOpen={isSimulatorOpen}
              onToggleSimulator={() => setIsSimulatorOpen((prev) => !prev)}
              onOpenConnectSettings={() => setIsConnectModalOpen(true)}
              onResetLeaderboard={handleResetLeaderboard}
              onSimulateChat={handleSimulateChat}
            />
          ) : (
            <WordListPanel
              requiredWords={requiredWords}
              foundWords={foundWords}
              bonusWords={bonusWords}
              revealedPrefixes={revealedPrefixes}
              showAllFirstLetters={showAllFirstLetters}
              onToggleFirstLetters={() => setShowAllFirstLetters((prev) => !prev)}
              onInspectWord={handleInspectWord}
              selectedWordDef={selectedWordDef}
              isLoadingDef={isLoadingDef}
              inspectedWord={inspectedWord}
            />
          )}
        </section>
      </main>
    </div>
  );
}
