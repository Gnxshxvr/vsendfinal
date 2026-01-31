
import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// We use these types for consistency, even if storage is in-memory
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // 6-digit code
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(), // Link to session
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  cloudinaryUrl: text("cloudinary_url").notNull(),
  cloudinaryPublicId: text("cloudinary_public_id").notNull(),
  resourceType: text("resource_type").notNull(), // "image", "video", "raw"
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, uploadedAt: true });

// Explicit Types
export type Session = typeof sessions.$inferSelect;
export type FileMetadata = typeof files.$inferSelect;

export type CreateSessionResponse = {
  code: string;
  sessionId: number;
  expiresAt: string;
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
  CLIPBOARD_UPDATE: "clipboard_update",
  FILE_UPLOADED: "file_uploaded",
  ERROR: "error",
} as const;
