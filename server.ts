import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LeaderboardPlayer {
  id: string;
  nickname: string; // Display nickname ONLY (never @handle)
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
  nickname: string; // Display nickname ONLY
  profilePictureUrl: string;
  comment: string;
  timestamp: number;
}

interface StreamSessionRoom {
  streamKey: string;
  tiktokHandle: string;
  hostWebsiteUrl: string;
  isConnected: boolean;
  connectionMode: 'tiktok_direct' | 'stream_key_bridge';
  statusMessage: string;
  players: Map<string, LeaderboardPlayer>;
  claimedWords: Set<string>; // puzzleId:WORD to ensure idempotency
  recentChat: LiveChatEvent[];
  clients: Set<WebSocket>;
  tiktokConn?: TikTokLiveConnection | null;
}

const rooms = new Map<string, StreamSessionRoom>();

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

function generateAvatarFallback(nickname: string): string {
  const encoded = encodeURIComponent(nickname.trim() || 'Player');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encoded}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

function sanitizeNickname(nickname?: string, uniqueId?: string): string {
  // Always prioritize the user's display nickname, stripping any leading @ so @name is never shown
  if (nickname && nickname.trim().length > 0) {
    return nickname.trim().replace(/^@+/, '').slice(0, 50);
  }
  if (uniqueId && uniqueId.trim().length > 0) {
    // Convert a fallback handle into a clean display nickname without @
    return uniqueId
      .trim()
      .replace(/^@+/, '')
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .slice(0, 50);
  }
  return 'TikTok Viewer';
}

function extractProfilePicture(data: any): string {
  if (!data) return '';
  if (typeof data.profilePictureUrl === 'string' && data.profilePictureUrl.startsWith('http')) {
    return data.profilePictureUrl;
  }
  const user = data.user || data;
  if (typeof user.profilePictureUrl === 'string' && user.profilePictureUrl.startsWith('http')) {
    return user.profilePictureUrl;
  }
  const candidates = [
    user?.profilePicture?.urls?.[0],
    user?.profilePicture?.mUrls?.[0],
    user?.avatarThumb?.urls?.[0],
    user?.avatarThumb?.mUrls?.[0],
    user?.avatarMedium?.urls?.[0],
    user?.avatarLarge?.urls?.[0],
  ];
  for (const url of candidates) {
    if (typeof url === 'string' && url.startsWith('http')) {
      return url;
    }
  }
  return '';
}

function getRoomStatePayload(room: StreamSessionRoom) {
  const leaderboard = Array.from(room.players.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.wordsFound !== a.wordsFound) return b.wordsFound - a.wordsFound;
    return b.updatedAt - a.updatedAt;
  });

  return {
    streamKey: room.streamKey,
    tiktokHandle: room.tiktokHandle,
    hostWebsiteUrl: room.hostWebsiteUrl,
    isConnected: room.isConnected,
    connectionMode: room.connectionMode,
    statusMessage: room.statusMessage,
    leaderboard,
    recentChat: room.recentChat.slice(0, 25),
  };
}

function broadcastToRoom(room: StreamSessionRoom, message: object) {
  const payload = JSON.stringify(message);
  for (const client of room.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function handleIncomingChatEvent(
  room: StreamSessionRoom,
  rawUser: {
    playerId?: string;
    nickname?: string;
    uniqueId?: string;
    profilePictureUrl?: string;
  },
  comment: string
) {
  const cleanComment = (comment || '').trim();
  if (!cleanComment) return;

  const nickname = sanitizeNickname(rawUser.nickname, rawUser.uniqueId);
  const playerId = (
    rawUser.playerId ||
    rawUser.uniqueId ||
    nickname.toLowerCase().replace(/[^a-z0-9]/g, '_')
  ).slice(0, 64);

  const profilePictureUrl =
    rawUser.profilePictureUrl && rawUser.profilePictureUrl.startsWith('http')
      ? rawUser.profilePictureUrl
      : generateAvatarFallback(nickname);

  // If player already exists on leaderboard, keep their nickname & avatar fresh
  if (room.players.has(playerId)) {
    const existing = room.players.get(playerId)!;
    existing.nickname = nickname;
    if (rawUser.profilePictureUrl && rawUser.profilePictureUrl.startsWith('http')) {
      existing.profilePictureUrl = rawUser.profilePictureUrl;
    }
  }

  const chatEvent: LiveChatEvent = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    playerId,
    nickname,
    profilePictureUrl,
    comment: cleanComment.slice(0, 160),
    timestamp: Date.now(),
  };

  room.recentChat = [chatEvent, ...room.recentChat.slice(0, 29)];

  broadcastToRoom(room, {
    type: 'tiktok:chat',
    event: chatEvent,
  });
}

async function attachTikTokConnector(room: StreamSessionRoom) {
  if (room.tiktokConn) {
    try {
      room.tiktokConn.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    room.tiktokConn = null;
  }

  const cleanHandle = normalizeHandle(room.tiktokHandle);
  if (!cleanHandle) {
    room.connectionMode = 'stream_key_bridge';
    room.statusMessage = `Connected via Stream Key on ${room.hostWebsiteUrl}`;
    broadcastToRoom(room, {
      type: 'session:state',
      state: getRoomStatePayload(room),
    });
    return;
  }

  try {
    const conn = new TikTokLiveConnection(cleanHandle, {
      processInitialData: false,
    });
    room.tiktokConn = conn;

    conn.on(WebcastEvent.CHAT, (data: any) => {
      const nickname = data?.user?.nickname || data?.nickname;
      const uniqueId = data?.user?.uniqueId || data?.uniqueId || data?.user?.id;
      const profilePictureUrl = extractProfilePicture(data);
      const comment = data?.comment || '';

      handleIncomingChatEvent(
        room,
        {
          playerId: String(data?.user?.id || uniqueId || nickname || 'viewer'),
          nickname,
          uniqueId,
          profilePictureUrl,
        },
        comment
      );
    });

    conn.on(ControlEvent.DISCONNECTED, () => {
      if (room.isConnected) {
        room.connectionMode = 'stream_key_bridge';
        room.statusMessage = `Stream Key active for @${cleanHandle} (${room.hostWebsiteUrl})`;
        broadcastToRoom(room, {
          type: 'session:state',
          state: getRoomStatePayload(room),
        });
      }
    });

    conn.on(ControlEvent.ERROR, () => {
      // Non-fatal: keep stream key bridge active
    });

    const state = await conn.connect();
    room.connectionMode = 'tiktok_direct';
    room.statusMessage = `LIVE connected to @${cleanHandle} (Room ${state.roomId || 'Active'})`;
    broadcastToRoom(room, {
      type: 'session:state',
      state: getRoomStatePayload(room),
    });
  } catch {
    // If creator is not currently broadcasting on TikTok's live servers, keep Stream Key webhook bridge active
    room.connectionMode = 'stream_key_bridge';
    room.statusMessage = `Live Stream Key connected for @${cleanHandle} on ${room.hostWebsiteUrl}`;
    broadcastToRoom(room, {
      type: 'session:state',
      state: getRoomStatePayload(room),
    });
  }
}

function getOrCreateRoom(
  streamKey: string,
  tiktokHandle = '',
  hostWebsiteUrl = ''
): StreamSessionRoom {
  const cleanKey = streamKey.trim();
  let room = rooms.get(cleanKey);
  if (!room) {
    room = {
      streamKey: cleanKey,
      tiktokHandle: normalizeHandle(tiktokHandle),
      hostWebsiteUrl: hostWebsiteUrl.trim(),
      isConnected: true,
      connectionMode: 'stream_key_bridge',
      statusMessage: 'Connecting to TikTok Live session...',
      players: new Map(),
      claimedWords: new Set(),
      recentChat: [],
      clients: new Set(),
      tiktokConn: null,
    };
    rooms.set(cleanKey, room);
  } else {
    if (tiktokHandle.trim()) {
      room.tiktokHandle = normalizeHandle(tiktokHandle);
    }
    if (hostWebsiteUrl.trim()) {
      room.hostWebsiteUrl = hostWebsiteUrl.trim();
    }
    room.isConnected = true;
  }
  return room;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost:3000');
      if (url.pathname === '/ws') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    } catch {
      // Ignore invalid upgrade URLs
    }
  });

  app.use(express.json());

  // Health & session info endpoint
  app.get('/api/tiktok/status', (req, res) => {
    const streamKey = String(req.query.streamKey || '').trim();
    if (!streamKey || !rooms.has(streamKey)) {
      res.json({ isConnected: false });
      return;
    }
    const room = rooms.get(streamKey)!;
    res.json(getRoomStatePayload(room));
  });

  // Connect session via HTTP POST
  app.post('/api/tiktok/connect', async (req, res) => {
    const streamKey = String(req.body?.streamKey || '').trim();
    const tiktokHandle = String(req.body?.tiktokHandle || '').trim();
    const hostWebsiteUrl = String(req.body?.hostWebsiteUrl || '').trim();

    if (!streamKey || !tiktokHandle) {
      res.status(400).json({ error: 'Missing streamKey or tiktokHandle' });
      return;
    }

    const room = getOrCreateRoom(streamKey, tiktokHandle, hostWebsiteUrl);
    attachTikTokConnector(room).catch(() => {});
    res.json(getRoomStatePayload(room));
  });

  // Disconnect session via HTTP POST
  app.post('/api/tiktok/disconnect', (req, res) => {
    const streamKey = String(req.body?.streamKey || '').trim();
    const room = rooms.get(streamKey);
    if (room) {
      room.isConnected = false;
      if (room.tiktokConn) {
        try {
          room.tiktokConn.disconnect();
        } catch {
          // ignore
        }
        room.tiktokConn = null;
      }
      broadcastToRoom(room, { type: 'session:disconnected' });
    }
    res.json({ ok: true });
  });

  // Record a player's found word via HTTP POST
  app.post('/api/tiktok/word-found', (req, res) => {
    const streamKey = String(req.body?.streamKey || '').trim();
    const room = rooms.get(streamKey);
    if (!room) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const puzzleId = String(req.body?.puzzleId || 'board').trim();
    const word = String(req.body?.word || '').trim().toUpperCase();
    if (!word) {
      res.status(400).json({ error: 'Missing word' });
      return;
    }

    const claimKey = `${puzzleId}:${word}`;
    if (!room.claimedWords.has(claimKey)) {
      room.claimedWords.add(claimKey);

      const nickname = sanitizeNickname(req.body?.nickname);
      const playerId = String(
        req.body?.playerId || nickname.toLowerCase().replace(/[^a-z0-9]/g, '_')
      ).slice(0, 64);
      const profilePictureUrl =
        typeof req.body?.profilePictureUrl === 'string' &&
        req.body.profilePictureUrl.startsWith('http')
          ? req.body.profilePictureUrl
          : generateAvatarFallback(nickname);
      const points = Math.max(1, Number(req.body?.points) || 1);
      const isBonus = Boolean(req.body?.isBonus);
      const isFeatured = Boolean(req.body?.isFeatured);

      const existing = room.players.get(playerId);
      if (existing) {
        existing.nickname = nickname;
        if (profilePictureUrl) existing.profilePictureUrl = profilePictureUrl;
        existing.score += points;
        existing.wordsFound += isBonus ? 0 : 1;
        existing.bonusWords += isBonus ? 1 : 0;
        existing.featuredFound = existing.featuredFound || isFeatured;
        existing.lastWord = word;
        existing.lastWordPoints = points;
        existing.updatedAt = Date.now();
      } else {
        room.players.set(playerId, {
          id: playerId,
          nickname,
          profilePictureUrl,
          score: points,
          wordsFound: isBonus ? 0 : 1,
          bonusWords: isBonus ? 1 : 0,
          featuredFound: isFeatured,
          lastWord: word,
          lastWordPoints: points,
          updatedAt: Date.now(),
        });
      }

      broadcastToRoom(room, {
        type: 'session:state',
        state: getRoomStatePayload(room),
      });
    }

    res.json(getRoomStatePayload(room));
  });

  // Reset leaderboard via HTTP POST
  app.post('/api/tiktok/reset', (req, res) => {
    const streamKey = String(req.body?.streamKey || '').trim();
    const room = rooms.get(streamKey);
    if (room) {
      room.players.clear();
      room.claimedWords.clear();
      broadcastToRoom(room, {
        type: 'session:state',
        state: getRoomStatePayload(room),
      });
      res.json(getRoomStatePayload(room));
      return;
    }
    res.json({ ok: true });
  });

  // Webhook endpoint for external TikTok stream bridges / hosted website relays using the provided Stream Key
  app.post('/api/tiktok/event', (req, res) => {
    const headerKey =
      req.headers['x-stream-key'] ||
      req.headers['authorization']?.toString().replace(/^Bearer\s+/i, '');
    const streamKey = String(req.body?.streamKey || headerKey || '').trim();

    if (!streamKey) {
      res.status(400).json({ error: 'Missing streamKey' });
      return;
    }

    const room = rooms.get(streamKey);
    if (!room || !room.isConnected) {
      res.status(404).json({ error: 'No active live session for this streamKey' });
      return;
    }

    const comment = String(req.body?.comment || req.body?.word || req.body?.text || '').trim();
    const nickname = String(
      req.body?.nickname || req.body?.user?.nickname || req.body?.displayName || 'TikTok Player'
    ).trim();
    const profilePictureUrl = String(
      req.body?.profilePictureUrl ||
        req.body?.avatarUrl ||
        req.body?.user?.profilePictureUrl ||
        ''
    ).trim();
    const playerId = String(
      req.body?.playerId || req.body?.user?.userId || req.body?.userId || nickname
    ).trim();

    if (!comment) {
      res.status(400).json({ error: 'Missing comment or word guess' });
      return;
    }

    handleIncomingChatEvent(
      room,
      {
        playerId,
        nickname,
        profilePictureUrl,
      },
      comment
    );

    res.json({ ok: true });
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/ws', 'http://localhost:3000');
    let currentStreamKey = (url.searchParams.get('streamKey') || '').trim();

    if (currentStreamKey && rooms.has(currentStreamKey)) {
      const room = rooms.get(currentStreamKey)!;
      room.clients.add(ws);
      ws.send(
        JSON.stringify({
          type: 'session:state',
          state: getRoomStatePayload(room),
        })
      );
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(String(raw));

        if (msg.type === 'session:connect') {
          const streamKey = String(msg.streamKey || '').trim();
          const tiktokHandle = String(msg.tiktokHandle || '').trim();
          const hostWebsiteUrl = String(msg.hostWebsiteUrl || '').trim();

          if (!streamKey || !tiktokHandle) return;

          if (currentStreamKey && rooms.has(currentStreamKey)) {
            rooms.get(currentStreamKey)!.clients.delete(ws);
          }

          currentStreamKey = streamKey;
          const room = getOrCreateRoom(streamKey, tiktokHandle, hostWebsiteUrl);
          room.clients.add(ws);

          ws.send(
            JSON.stringify({
              type: 'session:state',
              state: getRoomStatePayload(room),
            })
          );

          await attachTikTokConnector(room);
          return;
        }

        if (msg.type === 'session:disconnect') {
          const streamKey = String(msg.streamKey || currentStreamKey || '').trim();
          const room = rooms.get(streamKey);
          if (room) {
            room.isConnected = false;
            if (room.tiktokConn) {
              try {
                room.tiktokConn.disconnect();
              } catch {
                // ignore
              }
              room.tiktokConn = null;
            }
            broadcastToRoom(room, {
              type: 'session:disconnected',
            });
          }
          return;
        }

        if (msg.type === 'player:word_found') {
          const streamKey = String(msg.streamKey || currentStreamKey || '').trim();
          const room = rooms.get(streamKey);
          if (!room) return;

          const puzzleId = String(msg.puzzleId || 'board').trim();
          const word = String(msg.word || '').trim().toUpperCase();
          if (!word) return;

          // Idempotency guard so the same word on the same puzzle board is only credited once
          const claimKey = `${puzzleId}:${word}`;
          if (room.claimedWords.has(claimKey)) {
            return;
          }
          room.claimedWords.add(claimKey);

          const nickname = sanitizeNickname(msg.nickname);
          const playerId = String(
            msg.playerId || nickname.toLowerCase().replace(/[^a-z0-9]/g, '_')
          ).slice(0, 64);
          const profilePictureUrl =
            typeof msg.profilePictureUrl === 'string' && msg.profilePictureUrl.startsWith('http')
              ? msg.profilePictureUrl
              : generateAvatarFallback(nickname);
          const points = Math.max(1, Number(msg.points) || 1);
          const isBonus = Boolean(msg.isBonus);
          const isFeatured = Boolean(msg.isFeatured);

          const existing = room.players.get(playerId);
          if (existing) {
            existing.nickname = nickname;
            if (profilePictureUrl) existing.profilePictureUrl = profilePictureUrl;
            existing.score += points;
            existing.wordsFound += isBonus ? 0 : 1;
            existing.bonusWords += isBonus ? 1 : 0;
            existing.featuredFound = existing.featuredFound || isFeatured;
            existing.lastWord = word;
            existing.lastWordPoints = points;
            existing.updatedAt = Date.now();
          } else {
            room.players.set(playerId, {
              id: playerId,
              nickname,
              profilePictureUrl,
              score: points,
              wordsFound: isBonus ? 0 : 1,
              bonusWords: isBonus ? 1 : 0,
              featuredFound: isFeatured,
              lastWord: word,
              lastWordPoints: points,
              updatedAt: Date.now(),
            });
          }

          broadcastToRoom(room, {
            type: 'session:state',
            state: getRoomStatePayload(room),
          });
          return;
        }

        if (msg.type === 'leaderboard:reset') {
          const streamKey = String(msg.streamKey || currentStreamKey || '').trim();
          const room = rooms.get(streamKey);
          if (!room) return;
          room.players.clear();
          room.claimedWords.clear();
          broadcastToRoom(room, {
            type: 'session:state',
            state: getRoomStatePayload(room),
          });
          return;
        }
      } catch {
        // Ignore malformed socket message
      }
    });

    ws.on('close', () => {
      if (currentStreamKey && rooms.has(currentStreamKey)) {
        rooms.get(currentStreamKey)!.clients.delete(ws);
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
