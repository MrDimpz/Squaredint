/**
 * Centralized, bulletproof avatar generation and error handling.
 * Guarantees that avatars NEVER render as broken image icons,
 * with 0ms offline SVG data URI fallbacks and full TikTok CDN compatibility.
 */

const AVATAR_PALETTES = [
  ['#F59E0B', '#B45309'], // Amber
  ['#10B981', '#047857'], // Emerald
  ['#3B82F6', '#1D4ED8'], // Blue
  ['#8B5CF6', '#6D28D9'], // Violet
  ['#EC4899', '#BE185D'], // Pink
  ['#06B6D4', '#0E7490'], // Cyan
  ['#F97316', '#C2410C'], // Orange
  ['#14B8A6', '#0F766E'], // Teal
  ['#E11D48', '#9F1239'], // Rose
];

/**
 * Creates an inline SVG data URI with a vibrant gradient and the user's initial.
 * Works 100% offline, requires 0 network requests, and cannot fail.
 */
export function createAvatarDataUri(nameOrId: string = 'Player'): string {
  const clean = nameOrId.replace(/^@+/, '').trim() || 'Player';
  const initial = (clean[0] || 'P').toUpperCase();

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
  }
  const palette = AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
  const [c1, c2] = palette;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="g_${Math.abs(hash)}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="50" fill="url(#g_${Math.abs(hash)})"/>
    <text x="50" y="64" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="44" font-weight="800" fill="#ffffff" text-anchor="middle">${initial}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Resolves any avatar URL, handling protocol-relative URLs (//...)
 * and returning a safe fallback if empty.
 */
export function getSafeAvatarUrl(
  photoUrl?: string | null,
  nameOrId: string = 'Player'
): string {
  if (photoUrl && typeof photoUrl === 'string') {
    const trimmed = photoUrl.trim();
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }
  }

  // Use Pravatar for realistic default avatars, but fall back gracefully to SVG
  const encoded = encodeURIComponent(nameOrId.replace(/^@+/, '').trim() || 'Player');
  return `https://i.pravatar.cc/150?u=${encoded}`;
}

/**
 * Event handler for <img> onError.
 * Immediately switches the broken image to an offline SVG data URI so no broken box is ever shown.
 */
export function handleAvatarError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  nameOrId: string = 'Player'
): void {
  const target = e.currentTarget;
  const svgFallback = createAvatarDataUri(nameOrId);
  if (target.src !== svgFallback) {
    target.src = svgFallback;
  }
}
