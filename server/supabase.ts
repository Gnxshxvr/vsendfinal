import { createClient } from "@supabase/supabase-js";

// Check if Supabase is properly configured via environment variables
export const isSupabaseConfigured = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const supabaseAdmin = isSupabaseConfigured
  ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

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

export async function createSession(): Promise<SessionData> {
  if (!supabaseAdmin) {
    throw new Error("Supabase is not configured");
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
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
    throw new Error(`Failed to create session in Supabase: ${error.message}`);
  }

  return data as SessionData;
}

export async function getSessionByCode(code: string): Promise<SessionData | null> {
  if (!supabaseAdmin) return null;

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
  if (!supabaseAdmin) {
    throw new Error("Supabase is not configured");
  }

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
    throw new Error(`Failed to save file to Supabase: ${error.message}`);
  }

  return data as FileData;
}

export async function getFiles(sessionId: number): Promise<FileData[]> {
  if (!supabaseAdmin) return [];

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
  if (!supabaseAdmin) return null;

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
