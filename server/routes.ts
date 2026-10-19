import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import os from "os";
import { isCloudinaryConfigured, uploadToCloudinary } from "./cloudinary";

// Ensure uploads directory exists (use os.tmpdir() on serverless platforms like Vercel where process.cwd() is read-only)
const uploadDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "vsend-uploads")
  : path.resolve(process.cwd(), "uploads");

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn("Notice: Upload directory could not be created:", err);
}

// Simple in-memory rate limiter to protect against abuse
function createRateLimiter(maxRequests: number, windowMs: number) {
  const ipMap = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = ipMap.get(ip);

    if (!entry || now > entry.resetAt) {
      ipMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return res.status(429).json({
        message: "Too many requests. Please slow down and try again.",
      });
    }

    entry.count++;
    next();
  };
}

// Multer storage with randomized safe filenames
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const randomHash = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${randomHash}${ext}`);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max file size
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const sessionLimiter = createRateLimiter(25, 60 * 1000); // 25 sessions/min
  const uploadLimiter = createRateLimiter(35, 60 * 1000); // 35 uploads/min

  // WebSocket Server for Clipboard and Realtime Sync
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Map session ID to set of connected WebSockets
  const sessionClients = new Map<number, Set<WebSocket>>();

  function broadcastToSession(
    sessionId: number,
    message: unknown,
    excludeWs?: WebSocket
  ) {
    const clients = sessionClients.get(sessionId);
    if (!clients) return;

    const payload = JSON.stringify(message);
    clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  function broadcastPresence(sessionId: number) {
    const clients = sessionClients.get(sessionId);
    const count = clients ? clients.size : 0;
    broadcastToSession(sessionId, {
      type: WS_EVENTS.PRESENCE,
      count,
    });
  }

  wss.on("connection", (ws: WebSocket & { sessionId?: number; isAlive?: boolean }) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === WS_EVENTS.JOIN) {
          const code = String(message.code || "").trim();
          const session = await storage.getSessionByCode(code);

          if (!session) {
            ws.send(
              JSON.stringify({
                type: WS_EVENTS.ERROR,
                message: "Session not found or expired",
              })
            );
            return;
          }

          ws.sessionId = session.id;

          if (!sessionClients.has(session.id)) {
            sessionClients.set(session.id, new Set());
          }
          sessionClients.get(session.id)!.add(ws);

          const count = sessionClients.get(session.id)!.size;

          ws.send(
            JSON.stringify({
              type: WS_EVENTS.JOINED,
              sessionId: session.id,
              code: session.code,
              count,
            })
          );

          broadcastPresence(session.id);

          // If there are existing peers in the room, tell them a peer joined so they can initiate WebRTC offer
          if (count > 1) {
            broadcastToSession(
              session.id,
              {
                type: WS_EVENTS.PEER_JOINED,
                sessionId: session.id,
                code: session.code,
                count,
              },
              ws // Exclude newly joined socket so the earlier peer initiates
            );
          }
        } else if (
          message.type === WS_EVENTS.CLIPBOARD_UPDATE &&
          ws.sessionId
        ) {
          const content = typeof message.content === "string" ? message.content : "";
          broadcastToSession(
            ws.sessionId,
            {
              type: WS_EVENTS.CLIPBOARD_UPDATE,
              content,
              timestamp: Date.now(),
            },
            ws // Exclude sender to prevent echo
          );
        } else if (
          (message.type === WS_EVENTS.WEBRTC_OFFER ||
            message.type === WS_EVENTS.WEBRTC_ANSWER ||
            message.type === WS_EVENTS.WEBRTC_ICE_CANDIDATE) &&
          ws.sessionId
        ) {
          // Forward WebRTC signaling message to all other peers in the room
          broadcastToSession(ws.sessionId, message, ws);
        }
      } catch (err) {
        console.error("WebSocket message handling error:", err);
      }
    });

    ws.on("close", () => {
      if (ws.sessionId && sessionClients.has(ws.sessionId)) {
        const room = sessionClients.get(ws.sessionId)!;
        room.delete(ws);
        if (room.size === 0) {
          sessionClients.delete(ws.sessionId);
        } else {
          broadcastPresence(ws.sessionId);
        }
      }
    });
  });

  // Keep-alive heartbeat interval for active sockets
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  // --- API Routes ---

  // Create new session
  app.post(api.sessions.create.path, sessionLimiter, async (_req, res) => {
    try {
      const session = await storage.createSession();
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  // Join / verify existing session
  app.get(api.sessions.join.path, async (req, res) => {
    try {
      const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
      if (!code) {
        return res.status(400).json({ message: "Session code required" });
      }

      const session = await storage.getSessionByCode(code.trim());
      if (!session) {
        return res.status(404).json({ message: "Session not found or expired" });
      }

      res.json(session);
    } catch (error) {
      console.error("Error joining session:", error);
      res.status(500).json({ message: "Failed to join session" });
    }
  });

  // Leave / end session
  app.post(api.sessions.leave.path, async (req, res) => {
    try {
      const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
      if (!code) {
        return res.status(400).json({ message: "Session code required" });
      }

      const session = await storage.getSessionByCode(code.trim());
      if (session) {
        // Notify any remaining sockets in the session
        broadcastToSession(session.id, {
          type: WS_EVENTS.ERROR,
          message: "Session was terminated by user.",
        });

        // Close sockets in room
        const clients = sessionClients.get(session.id);
        if (clients) {
          clients.forEach((ws) => ws.close(1000, "Session ended"));
          sessionClients.delete(session.id);
        }

        await storage.deleteSession(code.trim());
      }

      res.json({ success: true, message: "Session closed successfully" });
    } catch (error) {
      console.error("Error ending session:", error);
      res.status(500).json({ message: "Failed to end session" });
    }
  });

  // File upload
  app.post(
    api.files.upload.path,
    uploadLimiter,
    upload.single("file"),
    async (req, res) => {
      const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
      if (!code || !req.file) {
        return res.status(400).json({ message: "Invalid session code or file" });
      }

      const session = await storage.getSessionByCode(code.trim());
      if (!session) {
        // Remove uploaded file if session was invalid
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ message: "Session not found or expired" });
      }

      try {
        let cloudinaryUrl: string | undefined;
        let cloudinaryPublicId: string | undefined;
        let resourceType: string | undefined;

        // Attempt Cloudinary upload if configured
        if (isCloudinaryConfigured) {
          try {
            const fileBuffer = fs.readFileSync(req.file.path);
            const cloudResult = await uploadToCloudinary(
              fileBuffer,
              req.file.originalname,
              req.file.mimetype
            );
            cloudinaryUrl = cloudResult.secure_url;
            cloudinaryPublicId = cloudResult.public_id;
            resourceType = cloudResult.resource_type;

            // Remove local temp file since Cloudinary has it
            fs.unlinkSync(req.file.path);
          } catch (cloudErr) {
            console.warn(
              "Cloudinary upload failed; falling back to local file storage:",
              cloudErr
            );
            // Fallback: keep local file in uploads/
          }
        }

        const safeOriginalName = path.basename(req.file.originalname) || "file";

        const savedFile = await storage.saveFile({
          sessionId: session.id,
          filename: req.file.filename,
          originalName: safeOriginalName,
          mimeType: req.file.mimetype || "application/octet-stream",
          size: req.file.size,
          cloudinaryUrl: cloudinaryUrl || null,
          cloudinaryPublicId: cloudinaryPublicId || null,
          resourceType: resourceType || null,
        });

        // Broadcast to all clients in session
        broadcastToSession(session.id, {
          type: WS_EVENTS.FILE_UPLOADED,
          file: savedFile,
        });

        res.status(201).json(savedFile);
      } catch (error) {
        console.error("Error saving file:", error);
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: "Failed to upload file" });
      }
    }
  );

  // List files for session
  app.get(api.files.list.path, async (req, res) => {
    try {
      const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
      if (!code) {
        return res.status(400).json({ message: "Session code required" });
      }

      const session = await storage.getSessionByCode(code.trim());
      if (!session) {
        return res.status(404).json({ message: "Session not found or expired" });
      }

      const fileList = await storage.getFiles(session.id);
      res.json(fileList);
    } catch (error) {
      console.error("Error listing files:", error);
      res.status(500).json({ message: "Failed to list files" });
    }
  });

  // Download file
  app.get(api.files.download.path, async (req, res) => {
    try {
      const fileIdParam = Array.isArray(req.params.fileId)
        ? req.params.fileId[0]
        : req.params.fileId;
      const fileId = parseInt(fileIdParam, 10);

      if (isNaN(fileId)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }

      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // If stored on Cloudinary, redirect to download URL
      if (file.cloudinaryUrl) {
        return res.redirect(file.cloudinaryUrl);
      }

      // Local file download with path traversal check
      const safeFilename = path.basename(file.filename);
      const filePath = path.resolve(uploadDir, safeFilename);

      if (!filePath.startsWith(uploadDir) || !fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File data not found on disk" });
      }

      res.download(filePath, file.originalName);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Preview file (inline content stream)
  app.get(api.files.preview.path, async (req, res) => {
    try {
      const fileIdParam = Array.isArray(req.params.fileId)
        ? req.params.fileId[0]
        : req.params.fileId;
      const fileId = parseInt(fileIdParam, 10);

      if (isNaN(fileId)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }

      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      if (file.cloudinaryUrl) {
        return res.redirect(file.cloudinaryUrl);
      }

      const safeFilename = path.basename(file.filename);
      const filePath = path.resolve(uploadDir, safeFilename);

      if (!filePath.startsWith(uploadDir) || !fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File data not found on disk" });
      }

      // Serve inline with correct content-type
      res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(file.originalName)}"`
      );

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error previewing file:", error);
      res.status(500).json({ message: "Failed to preview file" });
    }
  });

  // WebRTC ICE / STUN / TURN Configuration
  app.get("/api/webrtc-config", (_req, res) => {
    // High-availability public Google & Cloudflare STUN servers by default
    let iceServers: any[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ];

    // Support configurable ICE_SERVERS or TURN_SERVER in environment variables
    if (process.env.ICE_SERVERS) {
      try {
        iceServers = JSON.parse(process.env.ICE_SERVERS);
      } catch (err) {
        console.warn("Invalid ICE_SERVERS JSON configuration:", err);
      }
    } else if (process.env.TURN_SERVER_URL) {
      iceServers.push({
        urls: process.env.TURN_SERVER_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      });
    }

    res.json({ iceServers });
  });

  return httpServer;
}
