# Security Specification — The Missing Piece High Scores

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched under `/highscores/{scoreId}` are strictly denied (`allow read, write: if false;`).
2. **Identity & Ownership**: A `HighScore` document at `/highscores/{scoreId}` can only be created, read, updated, or deleted by the authenticated owner (`request.auth != null && data.userId == request.auth.uid`).
3. **Path ID Hardening**: `scoreId` must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters (`isValidId(scoreId)`).
4. **Strict Key & Type Enforcement**: `HighScore` documents must contain only the exact 11 required keys (`userId`, `displayName`, `puzzleId`, `mode`, `score`, `wordsFound`, `totalWords`, `bonusWordsCount`, `foundFeatured`, `createdAt`, `updatedAt`). Shadow fields are rejected.
5. **Monotonic High Score & Immutable Fields**: During updates, `userId`, `puzzleId`, `mode`, `totalWords`, and `createdAt` are immutable, `updatedAt == request.time`, and `incoming().score >= existing().score`.
6. **PII Isolation**: No email addresses, phone numbers, or sensitive PII are stored in `/highscores/{scoreId}`.
7. **Secure List Queries**: `allow list` enforces `resource.data.userId == request.auth.uid` so clients cannot scrape other users' documents without filtering by their own UID.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/highscores/user1_daily-4x4-2026-11-09` -> `PERMISSION_DENIED`.
2. **Identity Spoofing on Create**: `auth.uid = "attacker"`, payload `userId: "victim"` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Create**: Payload includes `"isAdmin": true` -> `PERMISSION_DENIED`.
4. **Oversized ID Poisoning**: `scoreId` of 500 characters or containing spaces/slashes -> `PERMISSION_DENIED`.
5. **Oversized DisplayName String**: `displayName` with 500 characters (`> 60`) -> `PERMISSION_DENIED`.
6. **Invalid Mode Enum**: `mode: "hacked-10x10"` -> `PERMISSION_DENIED`.
7. **Negative or Excessive Score**: `score: -50` or `score: 9999999` -> `PERMISSION_DENIED`.
8. **Forged Client Timestamp on Create**: `createdAt` not matching `request.time` -> `PERMISSION_DENIED`.
9. **Immutable Field Mutation on Update**: Updating `userId`, `puzzleId`, or `createdAt` -> `PERMISSION_DENIED`.
10. **Score Downgrade Attack on Update**: Updating `score` to a value lower than `existing().score` -> `PERMISSION_DENIED`.
11. **Value Poisoning on Update**: Updating `score` to a string `"100"` instead of an integer -> `PERMISSION_DENIED`.
12. **Unauthorized List Scraping**: Listing `/highscores` without filtering `resource.data.userId == request.auth.uid` -> `PERMISSION_DENIED`.
