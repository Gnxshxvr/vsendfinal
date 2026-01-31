
import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session Routes
  app.post(api.sessions.create.path, async (req, res) => {
    const session = await storage.createSession();
    res.status(201).json(session);
  });

  app.get(api.sessions.join.path, async (req, res) => {
    const code = req.params.code;
    const session = await storage.getSessionByCode(code);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found or expired" });
    }
    
    res.json(session);
  });

  // File Routes
  app.post(api.files.upload.path, upload.single("file"), async (req, res) => {
    const code = req.params.code;
    const session = await storage.getSessionByCode(code);
    
    if (!session || !req.file) {
      return res.status(400).json({ message: "Invalid session or file" });
    }

    const file = await storage.saveFile({
      id: 0, // Assigned by storage
      sessionId: session.id,
      filename: req.file.filename, // Multer filename
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    });

    // Notify connected clients in this session
    broadcastToSession(session.id, {
      type: WS_EVENTS.FILE_UPLOADED,
      file,
    });

    res.status(201).json(file);
  });

  app.get(api.files.list.path, async (req, res) => {
    const code = req.params.code;
    const session = await storage.getSessionByCode(code);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const files = await storage.getFiles(session.id);
    res.json(files);
  });

  app.get(api.files.download.path, async (req, res) => {
    const fileId = parseInt(req.params.fileId);
    const file = await storage.getFile(fileId);
    
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    const filePath = path.join(uploadDir, file.filename);
    res.download(filePath, file.originalName);
  });

  // WebSocket Server for Clipboard Sync
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  
  // Map session ID to set of connected sockets
  const sessionClients = new Map<number, Set<WebSocket>>();

  wss.on("connection", (ws) => {
    let currentSessionId: number | null = null;

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "join") {
          const session = await storage.getSessionByCode(message.code);
          if (session) {
            currentSessionId = session.id;
            if (!sessionClients.has(session.id)) {
              sessionClients.set(session.id, new Set());
            }
            sessionClients.get(session.id)!.add(ws);
            
            ws.send(JSON.stringify({ type: "joined", sessionId: session.id }));
          } else {
            ws.send(JSON.stringify({ type: "error", message: "Invalid code" }));
          }
        } else if (message.type === WS_EVENTS.CLIPBOARD_UPDATE && currentSessionId) {
          // Broadcast to all other clients in this session
          broadcastToSession(currentSessionId, {
            type: WS_EVENTS.CLIPBOARD_UPDATE,
            content: message.content,
            timestamp: Date.now()
          }, ws); // Exclude sender
        }
      } catch (err) {
        console.error("WebSocket error:", err);
      }
    });

    ws.on("close", () => {
      if (currentSessionId && sessionClients.has(currentSessionId)) {
        sessionClients.get(currentSessionId)!.delete(ws);
        if (sessionClients.get(currentSessionId)!.size === 0) {
          sessionClients.delete(currentSessionId);
        }
      }
    });
  });

  function broadcastToSession(sessionId: number, message: any, excludeWs?: WebSocket) {
    const clients = sessionClients.get(sessionId);
    if (clients) {
      clients.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  return httpServer;
}
