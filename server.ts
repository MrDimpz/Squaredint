import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export WebcastPushConnection alias for compatibility
export const WebcastPushConnection = TikTokLiveConnection;
export type WebcastPushConnection = TikTokLiveConnection;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let tiktokConn: TikTokLiveConnection | null = null;
let currentConnectedUsername: string | null = null;
let currentRoomId: string | null = null;

function extractProfilePicture(data: any): string {
  if (!data) return "";
  if (typeof data.profilePictureUrl === "string" && data.profilePictureUrl.startsWith("http")) {
    return data.profilePictureUrl;
  }
  const user = data.user || data;
  if (typeof user.profilePictureUrl === "string" && user.profilePictureUrl.startsWith("http")) {
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
    if (typeof url === "string" && url.startsWith("http")) {
      return url;
    }
  }
  return "";
}

io.on("connection", (socket) => {
  // Send current live stream status to newly connected client
  socket.emit("tiktok-status", {
    connected: Boolean(tiktokConn && currentConnectedUsername),
    username: currentConnectedUsername || "",
    roomId: currentRoomId || ""
  });

  // 1. Connection Request from UI
  socket.on("connect-tiktok", (username: string) => {
    // Teardown any existing stream connection first
    if (tiktokConn) {
      try {
        tiktokConn.disconnect();
      } catch (e) {
        // ignore
      }
      tiktokConn = null;
      currentConnectedUsername = null;
      currentRoomId = null;
    }

    if (!username || !username.trim()) {
      socket.emit("tiktok-error", "Username is required");
      return;
    }

    // Clean username (remove leading @ if provided)
    const cleanUsername = username.trim().startsWith("@")
      ? username.trim().substring(1)
      : username.trim();

    // Instantiate TikTok Webcast connection
    try {
      tiktokConn = new TikTokLiveConnection(cleanUsername, {
        processInitialData: false
      });
      const activeConn = tiktokConn;

      activeConn.connect()
        .then((state) => {
          if (tiktokConn !== activeConn) return;
          currentConnectedUsername = cleanUsername;
          currentRoomId = state.roomId || "active";

          socket.emit("tiktok-connected", { username: cleanUsername, roomId: state.roomId });
          io.emit("tiktok-status", { connected: true, username: cleanUsername, roomId: state.roomId });
        })
        .catch((err) => {
          if (tiktokConn === activeConn) {
            tiktokConn = null;
            currentConnectedUsername = null;
            currentRoomId = null;
          }
          socket.emit("tiktok-error", err?.message || "Failed to connect to TikTok Live");
          io.emit("tiktok-status", { connected: false, username: "", roomId: "" });
        });

      // 2. Stream event listener forwarded to all clients (actual chat only, ignoring likes & gifts)
      activeConn.on(WebcastEvent.CHAT, (data: any) => {
        const uniqueId = data?.user?.uniqueId || data?.uniqueId || "viewer";
        const nickname = data?.user?.nickname || data?.nickname || uniqueId;
        const comment = String(data?.comment || data?.content || "").trim();
        if (!comment) return;
        const profilePictureUrl = extractProfilePicture(data);

        console.log(`[TikTok Chat] ${nickname}: "${comment}"`);
        io.emit("chat-message", {
          uniqueId,
          nickname,
          comment,
          profilePictureUrl
        });
      });

      activeConn.on(ControlEvent.DISCONNECTED, () => {
        if (tiktokConn === activeConn) {
          tiktokConn = null;
          currentConnectedUsername = null;
          currentRoomId = null;
        }
        io.emit("tiktok-disconnected");
        io.emit("tiktok-status", { connected: false, username: "", roomId: "" });
      });

      activeConn.on(ControlEvent.ERROR, (err: any) => {
        console.warn("TikTok connection warning:", err?.info || err);
      });
    } catch (err: any) {
      socket.emit("tiktok-error", err?.message || "Could not initialize connection");
    }
  });

  // 3. Manual Disconnect Request
  socket.on("disconnect-tiktok", () => {
    if (tiktokConn) {
      try {
        tiktokConn.disconnect();
      } catch (e) {
        // ignore
      }
      tiktokConn = null;
      currentConnectedUsername = null;
      currentRoomId = null;
    }
    io.emit("tiktok-disconnected");
    io.emit("tiktok-status", { connected: false, username: "", roomId: "" });
  });

  // 4. Testing & Simulation Passthrough (Allows sending simulated chat from test controls)
  socket.on("chat-message", (data) => io.emit("chat-message", data));
});

// REST webhook endpoint for external relay tools / OBS scripts
app.post("/api/tiktok/event", (req, res) => {
  const { comment, nickname, uniqueId, profilePictureUrl } = req.body || {};
  const cleanComment = String(comment || req.body?.word || req.body?.text || "").trim();
  if (cleanComment) {
    io.emit("chat-message", {
      uniqueId: uniqueId || nickname || "viewer",
      nickname: nickname || "TikTok Player",
      comment: cleanComment,
      profilePictureUrl: profilePictureUrl || ""
    });
    res.json({ ok: true, type: "chat" });
    return;
  }

  res.status(400).json({ error: "Missing chat comment" });
});

app.get("/api/tiktok/status", (_req, res) => {
  res.json({
    connected: Boolean(tiktokConn && currentConnectedUsername),
    username: currentConnectedUsername || "",
    roomId: currentRoomId || ""
  });
});

// Mount Vite middleware in development or serve static build in production
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupViteOrStatic();
