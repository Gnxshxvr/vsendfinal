import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key
const supabaseUrl = process.env.SUPABASE_URL || "https://ndbercohymnqzwcdrllg.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYmVyY29oeW1ucXp3Y2RybGxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgzNTYyMiwiZXhwIjoyMDg1NDExNjIyfQ.M0J_2_92xOZa0DaQeg5FdEAwguX9sqDfG3cXgYu11kE";

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database helper functions using Supabase directly
import { sessions, files } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { db } from "./db";

export interface SessionData {
  id: number;
  code: string;
  created_at: Date;
  expires_at: Date;
}

export interface FileData {
  id: number;
  session_id: number;
  original_name: string;
  mime_type: string;
  size: number;
  cloudinary_url: string;
  cloudinary_public_id: string;
  resource_type: string;
  uploaded_at: Date;
}

// Session operations
export async function createSession(): Promise<SessionData> {
  // Generate 6-digit code
  let code: string;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (false); // Simplified - in production check for duplicates

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .insert({
      code,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data as SessionData;
}

export async function getSessionByCode(code: string): Promise<SessionData | null> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("code", code)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return data as SessionData;
}

export async function saveFile(fileData: {
  sessionId: number;
  originalName: string;
  mimeType: string;
  size: number;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  resourceType: string;
}): Promise<FileData> {
  const { data, error } = await supabaseAdmin
    .from("files")
    .insert({
      session_id: fileData.sessionId,
      original_name: fileData.originalName,
      mime_type: fileData.mimeType,
      size: fileData.size,
      cloudinary_url: fileData.cloudinaryUrl,
      cloudinary_public_id: fileData.cloudinaryPublicId,
      resource_type: fileData.resourceType,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save file: ${error.message}`);
  }

  return data as FileData;
}

export async function getFiles(sessionId: number): Promise<FileData[]> {
  const { data, error } = await supabaseAdmin
    .from("files")
    .select("*")
    .eq("session_id", sessionId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return [];
  }

  return data as FileData[];
}

export async function getFile(fileId: number): Promise<FileData | null> {
  const { data, error } = await supabaseAdmin
    .from("files")
    .select("*")
    .eq("id", fileId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as FileData;
}

export { supabaseAdmin as supabase };
