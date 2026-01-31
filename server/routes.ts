import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadToCloudinary, deleteFromCloudinary } from "./cloudinary";
import { createSession, getSessionByCode, saveFile, getFiles, getFile, supabase } from "./supabase";

// Ensure uploads directory exists for temp storage
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
    try {
      const session = await createSession();
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.get(api.sessions.join.path, async (req, res) => {
    const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const session = await getSessionByCode(code);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found or expired" });
    }
    
    res.json(session);
  });

  // File Routes with Cloudinary + Supabase
  app.post(api.files.upload.path, upload.single("file"), async (req, res) => {
    const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const session = await getSessionByCode(code);
    
    if (!session || !req.file) {
      return res.status(400).json({ message: "Invalid session or file" });
    }

    try {
      // Read file buffer and upload to Cloudinary
      const fileBuffer = fs.readFileSync(req.file.path);
      const cloudinaryResult = await uploadToCloudinary(
        fileBuffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Save file metadata to Supabase
      const file = await saveFile({
        sessionId: session.id,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        cloudinaryUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        resourceType: cloudinaryResult.resource_type,
      });

      // Clean up temp file
      fs.unlinkSync(req.file.path);

      // Broadcast to all clients in this session via Supabase Realtime
      await supabase.channel(`session:${session.code}`).send({
        type: "broadcast",
        event: "file_uploaded",
        payload: { file: { id: file.id, original_name: file.original_name } },
      });

      res.status(201).json(file);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get(api.files.list.path, async (req, res) => {
    const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const session = await getSessionByCode(code);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const files = await getFiles(session.id);
    res.json(files);
  });

  // Download redirect to Cloudinary URL
  app.get(api.files.download.path, async (req, res) => {
    const fileId = Array.isArray(req.params.fileId) ? parseInt(req.params.fileId[0]) : parseInt(req.params.fileId);
    const file = await getFile(fileId);
    
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Redirect to Cloudinary URL for download
    res.redirect(file.cloudinary_url);
  });

  return httpServer;
}
