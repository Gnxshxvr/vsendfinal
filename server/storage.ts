import { Session, FileMetadata, InsertFile, sessions, files } from "@shared/schema";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { db, isDbAvailable } from "./db";
import { eq, and, gt, lt } from "drizzle-orm";
import { deleteFromCloudinary } from "./cloudinary";

export interface IStorage {
  createSession(ttlHours?: number): Promise<Session>;
  getSessionByCode(code: string): Promise<Session | undefined>;
  deleteSession(code: string): Promise<boolean>;
  saveFile(file: InsertFile): Promise<FileMetadata>;
  getFiles(sessionId: number): Promise<FileMetadata[]>;
  getFile(fileId: number): Promise<FileMetadata | undefined>;
  deleteFile(fileId: number): Promise<boolean>;
  cleanupExpired(): Promise<{ sessionsDeleted: number; filesDeleted: number }>;
}

const uploadDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "vsend-uploads")
  : path.join(process.cwd(), "uploads");

// Helper to safely delete local disk file
function removeLocalFile(filename: string) {
  if (!filename) return;
  try {
    const fullPath = path.join(uploadDir, path.basename(filename));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`Failed to delete local file ${filename}:`, err);
  }
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private sessionFiles: Map<number, FileMetadata[]>;
  private files: Map<number, FileMetadata>;
  private currentSessionId: number;
  private currentFileId: number;

  constructor() {
    this.sessions = new Map();
    this.sessionFiles = new Map();
    this.files = new Map();
    this.currentSessionId = 1;
    this.currentFileId = 1;
  }

  async createSession(ttlHours: number = 24): Promise<Session> {
    const id = this.currentSessionId++;
    
    // Generate secure 6-digit numeric code with high entropy and collision retry
    let code = "";
    let attempts = 0;
    do {
      code = crypto.randomInt(100000, 1000000).toString();
      attempts++;
    } while (this.sessions.has(code) && attempts < 20);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    const session: Session = {
      id,
      code,
      createdAt: now,
      expiresAt,
    };

    this.sessions.set(code, session);
    return session;
  }

  async getSessionByCode(code: string): Promise<Session | undefined> {
    const session = this.sessions.get(code);
    if (!session) return undefined;

    // Check expiration
    if (new Date() > new Date(session.expiresAt)) {
      await this.deleteSession(code);
      return undefined;
    }

    return session;
  }

  async deleteSession(code: string): Promise<boolean> {
    const session = this.sessions.get(code);
    if (!session) return false;

    // Remove associated files
    const sessionFileList = this.sessionFiles.get(session.id) || [];
    for (const file of sessionFileList) {
      if (file.filename) {
        removeLocalFile(file.filename);
      }
      if (file.cloudinaryPublicId) {
        await deleteFromCloudinary(file.cloudinaryPublicId, file.resourceType || "raw");
      }
      this.files.delete(file.id);
    }

    this.sessionFiles.delete(session.id);
    this.sessions.delete(code);
    return true;
  }

  async saveFile(file: InsertFile): Promise<FileMetadata> {
    const id = this.currentFileId++;
    const newFile: FileMetadata = {
      ...file,
      id,
      filename: file.filename || "",
      cloudinaryUrl: file.cloudinaryUrl || null,
      cloudinaryPublicId: file.cloudinaryPublicId || null,
      resourceType: file.resourceType || null,
      uploadedAt: new Date(),
    };

    this.files.set(id, newFile);

    const currentFiles = this.sessionFiles.get(file.sessionId) || [];
    this.sessionFiles.set(file.sessionId, [newFile, ...currentFiles]);

    return newFile;
  }

  async getFiles(sessionId: number): Promise<FileMetadata[]> {
    return this.sessionFiles.get(sessionId) || [];
  }

  async getFile(fileId: number): Promise<FileMetadata | undefined> {
    return this.files.get(fileId);
  }

  async deleteFile(fileId: number): Promise<boolean> {
    const file = this.files.get(fileId);
    if (!file) return false;

    if (file.filename) {
      removeLocalFile(file.filename);
    }
    if (file.cloudinaryPublicId) {
      await deleteFromCloudinary(file.cloudinaryPublicId, file.resourceType || "raw");
    }

    this.files.delete(fileId);

    const sessionFiles = this.sessionFiles.get(file.sessionId) || [];
    this.sessionFiles.set(
      file.sessionId,
      sessionFiles.filter((f) => f.id !== fileId)
    );

    return true;
  }

  async cleanupExpired(): Promise<{ sessionsDeleted: number; filesDeleted: number }> {
    const now = new Date();
    let sessionsDeleted = 0;
    let filesDeleted = 0;

    for (const [code, session] of Array.from(this.sessions.entries())) {
      if (now > new Date(session.expiresAt)) {
        const files = this.sessionFiles.get(session.id) || [];
        filesDeleted += files.length;
        await this.deleteSession(code);
        sessionsDeleted++;
      }
    }

    return { sessionsDeleted, filesDeleted };
  }
}

export class PgStorage implements IStorage {
  async createSession(ttlHours: number = 24): Promise<Session> {
    if (!db) throw new Error("Database not initialized");

    let code = "";
    let attempts = 0;
    do {
      code = crypto.randomInt(100000, 1000000).toString();
      const existing = await db.select().from(sessions).where(eq(sessions.code, code)).limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 20);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    const [session] = await db
      .insert(sessions)
      .values({
        code,
        expiresAt,
      })
      .returning();

    return session;
  }

  async getSessionByCode(code: string): Promise<Session | undefined> {
    if (!db) throw new Error("Database not initialized");

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.code, code), gt(sessions.expiresAt, new Date())))
      .limit(1);

    return session;
  }

  async deleteSession(code: string): Promise<boolean> {
    if (!db) return false;

    const [session] = await db.select().from(sessions).where(eq(sessions.code, code)).limit(1);
    if (!session) return false;

    const sessionFiles = await db.select().from(files).where(eq(files.sessionId, session.id));
    for (const file of sessionFiles) {
      if (file.filename) removeLocalFile(file.filename);
      if (file.cloudinaryPublicId) {
        await deleteFromCloudinary(file.cloudinaryPublicId, file.resourceType || "raw");
      }
    }

    await db.delete(files).where(eq(files.sessionId, session.id));
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return true;
  }

  async saveFile(fileData: InsertFile): Promise<FileMetadata> {
    if (!db) throw new Error("Database not initialized");

    const [file] = await db
      .insert(files)
      .values({
        sessionId: fileData.sessionId,
        filename: fileData.filename || "",
        originalName: fileData.originalName,
        mimeType: fileData.mimeType,
        size: fileData.size,
        cloudinaryUrl: fileData.cloudinaryUrl || null,
        cloudinaryPublicId: fileData.cloudinaryPublicId || null,
        resourceType: fileData.resourceType || null,
      })
      .returning();

    return file;
  }

  async getFiles(sessionId: number): Promise<FileMetadata[]> {
    if (!db) return [];
    return await db.select().from(files).where(eq(files.sessionId, sessionId));
  }

  async getFile(fileId: number): Promise<FileMetadata | undefined> {
    if (!db) return undefined;
    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    return file;
  }

  async deleteFile(fileId: number): Promise<boolean> {
    if (!db) return false;
    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) return false;

    if (file.filename) removeLocalFile(file.filename);
    if (file.cloudinaryPublicId) {
      await deleteFromCloudinary(file.cloudinaryPublicId, file.resourceType || "raw");
    }

    await db.delete(files).where(eq(files.id, fileId));
    return true;
  }

  async cleanupExpired(): Promise<{ sessionsDeleted: number; filesDeleted: number }> {
    if (!db) return { sessionsDeleted: 0, filesDeleted: 0 };

    const expiredSessions = await db
      .select()
      .from(sessions)
      .where(lt(sessions.expiresAt, new Date()));

    let filesDeleted = 0;
    for (const s of expiredSessions) {
      const sFiles = await db.select().from(files).where(eq(files.sessionId, s.id));
      for (const f of sFiles) {
        if (f.filename) removeLocalFile(f.filename);
        if (f.cloudinaryPublicId) {
          await deleteFromCloudinary(f.cloudinaryPublicId, f.resourceType || "raw");
        }
      }
      filesDeleted += sFiles.length;
      await db.delete(files).where(eq(files.sessionId, s.id));
      await db.delete(sessions).where(eq(sessions.id, s.id));
    }

    return { sessionsDeleted: expiredSessions.length, filesDeleted };
  }
}

// Select active storage provider: PgStorage if DB is configured, MemStorage otherwise
export const storage: IStorage = isDbAvailable ? new PgStorage() : new MemStorage();

// Start periodic cleanup interval every 15 minutes
setInterval(async () => {
  try {
    const result = await storage.cleanupExpired();
    if (result.sessionsDeleted > 0 || result.filesDeleted > 0) {
      console.log(
        `[cleanup] Expired sessions cleaned: ${result.sessionsDeleted}, files removed: ${result.filesDeleted}`
      );
    }
  } catch (err) {
    console.error("[cleanup] Error running periodic cleanup:", err);
  }
}, 15 * 60 * 1000);
