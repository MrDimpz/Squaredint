import { CORE_DICTIONARY, CORE_PREFIXES, calculateWordScore } from './dictionary';

export type GameModeId = 'express-3x3' | 'daily-4x4' | 'royal-5x5';

export interface FoundWordEntry {
  word: string;
  path: number[];
  points: number;
  isFeatured: boolean;
  foundAt?: number;
}

export interface PuzzleBoard {
  id: string;
  mode: GameModeId;
  title: string;
  dateLabel: string;
  puzzleNumber: number;
  size: number;
  grid: string[]; // flat array of length size * size
  requiredWords: Map<string, FoundWordEntry>; // word -> metadata + canonical path
  featuredWord: string; // The "Missing Piece" star word embedded in the grid
  maxScore: number;
}

// Deterministic Mulberry32 PRNG for daily & seeded puzzle generation
function createSeededRandom(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const t = (h ^= h >>> 16) >>> 0;
    return t / 4294967296;
  };
}

// Curated 7- and 8-letter anchor words to snake through the board
const FEATURED_SEED_WORDS_4X4 = [
  'SPARKLE', 'MISSING', 'STARLIGHT', 'HARMONY', 'CRYSTAL', 'KINGDOM', 'PHANTOM',
  'TRIUMPH', 'FORTUNE', 'JOURNEY', 'MYSTERY', 'BALANCE', 'CAPTAIN', 'LANTERN',
  'COMPASS', 'WHISPER', 'THUNDER', 'GARDENS', 'MORNING', 'DIAMOND', 'HORIZON',
  'STORAGE', 'PICTURE', 'CHAPTER', 'PROMISE', 'MONSTER', 'CLIMATE', 'PLASTIC',
  'SPECIAL', 'SECTION', 'CENTRAL', 'SILENCE', 'RESPECT', 'PROTECT', 'MEASURE',
];

const FEATURED_SEED_WORDS_3X3 = [
  'SPACE', 'SPARK', 'CROWN', 'PIECE', 'SMART', 'CHARM', 'LIGHT',
  'STONE', 'BRAVE', 'DREAM', 'HEART', 'FLAME', 'QUEST', 'PRIZE', 'MAGIC',
];

const FEATURED_SEED_WORDS_5X5 = [
  'STARLIGHT', 'DISCOVERY', 'ARCHITECT', 'SIGNATURE', 'TREASURES', 'ADVENTURE',
  'CRAFTWORK', 'BLUEPRINT', 'NIGHTFALL', 'GOLDENROD', 'WONDERFUL', 'MASTERING',
];

// High-utility letters (no orphan Q/Z/X/J in random fill so every tile easily connects into words)
const FRIENDLY_LETTERS = 'EEEEEEEEEEEEAAAAAAAAAIIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGGBBCCMMPPFFHHVVWWYYK';
const REPAIR_CANDIDATE_LETTERS = ['E', 'S', 'A', 'R', 'T', 'O', 'I', 'N', 'L', 'D', 'C', 'P', 'M', 'G', 'B', 'H'];

/**
 * Returns adjacent cell indices (8-directional: orthogonal + diagonal)
 */
export function getNeighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const neighbors: number[] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        neighbors.push(nr * size + nc);
      }
    }
  }
  return neighbors;
}

/**
 * Checks if two cell indices are adjacent (including diagonals) on a board of `size`
 */
export function areCellsAdjacent(idxA: number, idxB: number, size: number): boolean {
  if (idxA === idxB) return false;
  const rA = Math.floor(idxA / size);
  const cA = idxA % size;
  const rB = Math.floor(idxB / size);
  const cB = idxB % size;
  return Math.abs(rA - rB) <= 1 && Math.abs(cA - cB) <= 1;
}

/**
 * Rotates a flat grid index 90 degrees clockwise or counter-clockwise
 */
export function rotateIndex(index: number, size: number, clockwise: boolean): number {
  const r = Math.floor(index / size);
  const c = index % size;
  if (clockwise) {
    return c * size + (size - 1 - r);
  } else {
    return (size - 1 - c) * size + r;
  }
}

/**
 *Rotates a flat grid index by `steps` (0, 1, 2, 3) 90-degree clockwise increments
 */
export function rotateIndexBySteps(index: number, size: number, steps: number): number {
  const norm = ((steps % 4) + 4) % 4;
  let current = index;
  for (let s = 0; s < norm; s++) {
    current = rotateIndex(current, size, true);
  }
  return current;
}

/**
 * Counts how many distinct cells (out of size*size) are covered by at least one word in `wordMap`
 */
function getCoveredCellsSet(wordMap: Map<string, number[]>): Set<number> {
  const covered = new Set<number>();
  for (const path of wordMap.values()) {
    for (const idx of path) {
      covered.add(idx);
    }
  }
  return covered;
}

/**
 * Solves a grid using Depth-First Search + Prefix Set pruning to find all valid words,
 * preserving full cell coverage when capping word count.
 */
export function solveBoardGrid(
  grid: string[],
  size: number,
  maxWordsCap: number = 65
): Map<string, number[]> {
  const foundPaths = new Map<string, number[]>();
  const totalCells = size * size;
  const visited = new Array(totalCells).fill(false);

  function dfs(cellIdx: number, currentWord: string, currentPath: number[]) {
    if (currentWord.length >= 4 && CORE_DICTIONARY.has(currentWord)) {
      if (!foundPaths.has(currentWord)) {
        foundPaths.set(currentWord, [...currentPath]);
      }
    }

    if (currentWord.length >= 9) return;
    if (!CORE_PREFIXES.has(currentWord)) return;

    const neighbors = getNeighbors(cellIdx, size);
    for (const nextIdx of neighbors) {
      if (!visited[nextIdx]) {
        visited[nextIdx] = true;
        currentPath.push(nextIdx);
        dfs(nextIdx, currentWord + grid[nextIdx], currentPath);
        currentPath.pop();
        visited[nextIdx] = false;
      }
    }
  }

  for (let i = 0; i < totalCells; i++) {
    visited[i] = true;
    dfs(i, grid[i], [i]);
    visited[i] = false;
  }

  // If the board has more words than maxWordsCap, trim while guaranteeing every covered cell stays covered!
  if (foundPaths.size > maxWordsCap) {
    const entries = Array.from(foundPaths.entries());
    entries.sort((a, b) => {
      if (b[0].length !== a[0].length) return b[0].length - a[0].length;
      return a[0].localeCompare(b[0]);
    });

    const trimmed = new Map<string, number[]>();
    const coveredCells = new Set<number>();

    // Pass 1: Greedily pick words that cover not-yet-covered cells so NO active tile becomes depleted at start
    for (const [word, path] of entries) {
      const addsNewCell = path.some((cellIdx) => !coveredCells.has(cellIdx));
      if (addsNewCell) {
        trimmed.set(word, path);
        path.forEach((cellIdx) => coveredCells.add(cellIdx));
      }
      if (coveredCells.size === totalCells) break;
    }

    // Pass 2: Fill remaining slots up to maxWordsCap with longest + balanced 4-letter words
    const remainingSlots = maxWordsCap - trimmed.size;
    if (remainingSlots > 0) {
      const unusedEntries = entries.filter(([w]) => !trimmed.has(w));
      const longWords = unusedEntries.filter(([w]) => w.length >= 5).slice(0, Math.ceil(remainingSlots * 0.6));
      const shortWords = unusedEntries.filter(([w]) => w.length === 4).slice(0, remainingSlots - longWords.length);
      for (const [w, p] of [...longWords, ...shortWords]) {
        trimmed.set(w, p);
      }
    }

    return trimmed;
  }

  return foundPaths;
}

/**
 * Finds all valid contiguous paths on the current grid that match a typed string prefix or full word
 */
export function findPathsForInput(grid: string[], size: number, input: string): number[][] {
  const target = input.toUpperCase().replace(/[^A-Z]/g, '');
  if (!target) return [];

  const results: number[][] = [];
  const total = size * size;

  function search(idx: number, pos: number, path: number[]) {
    if (pos === target.length) {
      results.push([...path]);
      return;
    }
    for (const n of getNeighbors(idx, size)) {
      if (!path.includes(n) && grid[n] === target[pos]) {
        path.push(n);
        search(n, pos + 1, path);
        path.pop();
      }
    }
  }

  for (let i = 0; i < total; i++) {
    if (grid[i] === target[0]) {
      search(i, 1, [i]);
    }
  }

  return results;
}

/**
 * Embeds a featured word along a self-avoiding walk on the grid
 */
function embedWordOnGrid(
  word: string,
  size: number,
  rng: () => number
): { grid: (string | null)[]; path: number[] } | null {
  const totalCells = size * size;
  const startCell = Math.floor(rng() * totalCells);
  const grid: (string | null)[] = new Array(totalCells).fill(null);

  function walk(idx: number, charPos: number, path: number[]): number[] | null {
    if (charPos === word.length) return path;

    const neighbors = getNeighbors(idx, size).filter((n) => !path.includes(n));
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }

    for (const next of neighbors) {
      const res = walk(next, charPos + 1, [...path, next]);
      if (res) return res;
    }
    return null;
  }

  const finalPath = walk(startCell, 1, [startCell]);
  if (!finalPath) return null;

  for (let i = 0; i < finalPath.length; i++) {
    grid[finalPath[i]] = word[i];
  }
  return { grid, path: finalPath };
}

/**
 * Repairs any unused cells on a board by testing high-connectivity letters until all cells participate in words
 */
function ensureFullTileCoverage(
  grid: string[],
  size: number,
  protectedIndices: Set<number>,
  maxCap: number
): { grid: string[]; solved: Map<string, number[]> } {
  const workingGrid = [...grid];
  let solved = solveBoardGrid(workingGrid, size, maxCap);
  let covered = getCoveredCellsSet(solved);
  const totalCells = size * size;

  if (covered.size === totalCells) {
    return { grid: workingGrid, solved };
  }

  // Up to 3 passes to repair any uncovered cell
  for (let pass = 0; pass < 3 && covered.size < totalCells; pass++) {
    for (let cellIdx = 0; cellIdx < totalCells; cellIdx++) {
      if (covered.has(cellIdx) || protectedIndices.has(cellIdx)) continue;

      let bestLetter = workingGrid[cellIdx];
      let bestCoverageCount = covered.size;
      let bestSolvedMap = solved;

      for (const candidateChar of REPAIR_CANDIDATE_LETTERS) {
        workingGrid[cellIdx] = candidateChar;
        const testSolved = solveBoardGrid(workingGrid, size, maxCap);
        const testCovered = getCoveredCellsSet(testSolved);

        if (
          testCovered.has(cellIdx) &&
          (testCovered.size > bestCoverageCount ||
            (testCovered.size === bestCoverageCount && testSolved.size > bestSolvedMap.size))
        ) {
          bestLetter = candidateChar;
          bestCoverageCount = testCovered.size;
          bestSolvedMap = testSolved;
          if (bestCoverageCount === totalCells) break;
        }
      }

      workingGrid[cellIdx] = bestLetter;
      solved = bestSolvedMap;
      covered = getCoveredCellsSet(solved);
    }
  }

  return { grid: workingGrid, solved };
}

/**
 * Generates a complete, deterministic daily or custom puzzle board where all tiles are active at the start
 */
export function generatePuzzle(
  mode: GameModeId = 'daily-4x4',
  dateSeed?: string
): PuzzleBoard {
  const todayStr = dateSeed || new Date().toISOString().slice(0, 10);
  const size = mode === 'express-3x3' ? 3 : mode === 'royal-5x5' ? 5 : 4;
  const totalCells = size * size;
  const maxCap = mode === 'express-3x3' ? 24 : mode === 'royal-5x5' ? 62 : 45;
  const minRequired = mode === 'express-3x3' ? 12 : mode === 'royal-5x5' ? 32 : 24;

  // Compute daily puzzle number since epoch 2024-01-01
  const epoch = new Date('2024-01-01T00:00:00Z').getTime();
  const current = new Date(todayStr + 'T00:00:00Z').getTime() || Date.now();
  const puzzleNumber = Math.max(1, Math.floor((current - epoch) / (1000 * 60 * 60 * 24)));

  const seedKey = `${mode}::${todayStr}::v3`;
  const rng = createSeededRandom(seedKey);

  const seedPool =
    mode === 'express-3x3'
      ? FEATURED_SEED_WORDS_3X3
      : mode === 'royal-5x5'
        ? FEATURED_SEED_WORDS_5X5
        : FEATURED_SEED_WORDS_4X4;

  let bestGrid: string[] = [];
  let bestSolved = new Map<string, number[]>();
  let bestCoveredCount = -1;
  let chosenFeatured = seedPool[Math.floor(rng() * seedPool.length)];
  let chosenFeaturedPath: number[] = [];

  for (let attempt = 0; attempt < 24; attempt++) {
    const candidateWord = seedPool[Math.floor(rng() * seedPool.length)];
    const embedded = embedWordOnGrid(candidateWord, size, rng);
    const rawGrid: string[] = new Array(totalCells).fill('E');
    const protectedIndices = new Set<number>();

    if (embedded) {
      for (let i = 0; i < totalCells; i++) {
        if (embedded.grid[i]) {
          rawGrid[i] = embedded.grid[i]!;
          protectedIndices.add(i);
        } else {
          rawGrid[i] = FRIENDLY_LETTERS[Math.floor(rng() * FRIENDLY_LETTERS.length)];
        }
      }
    } else {
      for (let i = 0; i < totalCells; i++) {
        rawGrid[i] = FRIENDLY_LETTERS[Math.floor(rng() * FRIENDLY_LETTERS.length)];
      }
    }

    // Repair any unused tiles so all tiles are used at the start of the game
    const { grid, solved } = ensureFullTileCoverage(rawGrid, size, protectedIndices, maxCap);
    if (embedded) {
      solved.set(candidateWord, embedded.path);
    }

    const coveredCount = getCoveredCellsSet(solved).size;

    const isBetter =
      coveredCount > bestCoveredCount ||
      (coveredCount === bestCoveredCount && solved.size > bestSolved.size);

    if (isBetter) {
      bestGrid = grid;
      bestSolved = solved;
      bestCoveredCount = coveredCount;
      chosenFeatured = candidateWord;
      chosenFeaturedPath = embedded?.path || [];
    }

    // Stop early once we have 100% tile coverage AND plenty of words
    if (coveredCount === totalCells && solved.size >= minRequired) {
      break;
    }
  }

  // Pick the longest word in bestSolved as the official Featured "Missing Piece" Word
  let longestWord = chosenFeatured;
  for (const [w] of bestSolved) {
    if (w.length > longestWord.length) {
      longestWord = w;
    }
  }
  if (!bestSolved.has(longestWord) && chosenFeaturedPath.length > 0) {
    bestSolved.set(longestWord, chosenFeaturedPath);
  }

  // Build sorted requiredWords map
  const sortedWords = Array.from(bestSolved.keys()).sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });

  const requiredWords = new Map<string, FoundWordEntry>();
  let maxScore = 0;

  for (const word of sortedWords) {
    const isFeatured = word === longestWord;
    const pts = calculateWordScore(word, isFeatured);
    maxScore += pts;
    requiredWords.set(word, {
      word,
      path: bestSolved.get(word)!,
      points: pts,
      isFeatured,
    });
  }

  const modeTitles: Record<GameModeId, string> = {
    'express-3x3': 'Express 3×3 Grid',
    'daily-4x4': 'Daily 4×4 Squaredle',
    'royal-5x5': 'Royal 5×5 Master',
  };

  return {
    id: `${mode}-${todayStr}`,
    mode,
    title: modeTitles[mode],
    dateLabel: todayStr,
    puzzleNumber,
    size,
    grid: bestGrid,
    requiredWords,
    featuredWord: longestWord,
    maxScore,
  };
}
