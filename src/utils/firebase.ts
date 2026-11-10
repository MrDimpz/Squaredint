import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { GameModeId } from './puzzleGenerator';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Validate connection to Firestore on boot as required
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Blueprint validation constants synced verbatim with firebase-blueprint.json
export const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_PUZZLE_ID_LENGTH = 64;
export const MAX_DISPLAY_NAME_LENGTH = 60;
export const ALLOWED_MODES: GameModeId[] = ['express-3x3', 'daily-4x4', 'royal-5x5'];

export interface HighScoreRecord {
  id: string;
  userId: string;
  displayName: string;
  puzzleId: string;
  mode: GameModeId;
  score: number;
  wordsFound: number;
  totalWords: number;
  bonusWordsCount: number;
  foundFeatured: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

const googleProvider = new GoogleAuthProvider();

export async function signInWithGooglePopup(): Promise<User> {
  const res = await signInWithPopup(auth, googleProvider);
  return res.user;
}

export async function loginWithEmailPassword(email: string, password: string): Promise<User> {
  const res = await signInWithEmailAndPassword(auth, email.trim(), password);
  return res.user;
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) || 'Puzzle Seeker';
  await updateProfile(res.user, { displayName: cleanName });
  return res.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };

/**
 * Sanitizes and records a player's high score to Firestore `/highscores/{scoreId}`
 */
export async function saveHighScoreToFirestore(params: {
  user: User;
  puzzleId: string;
  mode: GameModeId;
  score: number;
  wordsFound: number;
  totalWords: number;
  bonusWordsCount: number;
  foundFeatured: boolean;
}): Promise<void> {
  const { user, puzzleId, mode, score, wordsFound, totalWords, bonusWordsCount, foundFeatured } =
    params;

  if (!user?.uid || score <= 0) return;

  // Enforce blueprint regex and length limits before database mutation
  const safeUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  const safePuzzleId = puzzleId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_PUZZLE_ID_LENGTH);
  const scoreId = `${safeUid}_${safePuzzleId}`.slice(0, MAX_ID_LENGTH);

  if (!ID_REGEX.test(safeUid) || !ID_REGEX.test(safePuzzleId) || !ID_REGEX.test(scoreId)) {
    return;
  }
  if (!ALLOWED_MODES.includes(mode)) {
    return;
  }

  const rawName =
    user.displayName ||
    (user.email ? user.email.split('@')[0] : 'Puzzle Seeker');
  const safeDisplayName = rawName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) || 'Puzzle Seeker';

  const safeScore = Math.max(0, Math.min(100000, Math.floor(score)));
  const safeTotalWords = Math.max(1, Math.min(500, Math.floor(totalWords)));
  const safeWordsFound = Math.max(0, Math.min(safeTotalWords, Math.floor(wordsFound)));
  const safeBonusCount = Math.max(0, Math.min(500, Math.floor(bonusWordsCount)));

  const docPath = `highscores/${scoreId}`;
  const docRef = doc(db, 'highscores', scoreId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        userId: user.uid,
        displayName: safeDisplayName,
        puzzleId: safePuzzleId,
        mode,
        score: safeScore,
        wordsFound: safeWordsFound,
        totalWords: safeTotalWords,
        bonusWordsCount: safeBonusCount,
        foundFeatured: Boolean(foundFeatured),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data();
      const existingScore = typeof existingData.score === 'number' ? existingData.score : 0;
      const existingWords = typeof existingData.wordsFound === 'number' ? existingData.wordsFound : 0;

      // Only update if score is >= existingScore and something improved
      if (
        safeScore >= existingScore &&
        (safeScore > existingScore ||
          safeWordsFound > existingWords ||
          safeBonusCount > (existingData.bonusWordsCount || 0) ||
          (foundFeatured && !existingData.foundFeatured))
      ) {
        await updateDoc(docRef, {
          displayName: safeDisplayName,
          score: safeScore,
          wordsFound: safeWordsFound,
          bonusWordsCount: safeBonusCount,
          foundFeatured: Boolean(foundFeatured || existingData.foundFeatured),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Subscribes to the signed-in user's high scores in real time
 */
export function subscribeToUserHighScores(
  userId: string,
  onData: (scores: HighScoreRecord[]) => void
): () => void {
  const colRef = collection(db, 'highscores');
  const q = query(colRef, where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: HighScoreRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          userId: d.userId,
          displayName: d.displayName,
          puzzleId: d.puzzleId,
          mode: d.mode as GameModeId,
          score: d.score,
          wordsFound: d.wordsFound,
          totalWords: d.totalWords,
          bonusWordsCount: d.bonusWordsCount,
          foundFeatured: Boolean(d.foundFeatured),
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
      });
      items.sort((a, b) => b.score - a.score);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'highscores');
    }
  );
}

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
