import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions table
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // 6-digit session code
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Files table
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(), // Link to session
  filename: text("filename").notNull().default(""), // Storage filename on disk
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  cloudinaryUrl: text("cloudinary_url"),
  cloudinaryPublicId: text("cloudinary_public_id"),
  resourceType: text("resource_type"), // "image", "video", "raw"
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, uploadedAt: true });

// Explicit Types
export type Session = typeof sessions.$inferSelect;
export type FileMetadata = typeof files.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertFile = Omit<FileMetadata, "id" | "uploadedAt">;

export type CreateSessionResponse = {
  id: number;
  code: string;
  createdAt?: string | Date | null;
  expiresAt: string | Date;
};

export type SessionResponse = Session;

export type ClipboardMessage = {
  type: "clipboard";
  content: string;
  timestamp: number;
};

// WebSocket Events
export const WS_EVENTS = {
  JOIN: "join",
  JOINED: "joined",
  CLIPBOARD_UPDATE: "clipboard_update",
  FILE_UPLOADED: "file_uploaded",
  PRESENCE: "presence",
  ERROR: "error",
} as const;
