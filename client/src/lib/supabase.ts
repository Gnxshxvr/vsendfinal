import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client with anon key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isClientSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isClientSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Clipboard sync with Supabase Realtime (optional fallback if Supabase is configured)
export function subscribeToClipboard(
  sessionCode: string,
  onClipboardUpdate: (content: string) => void,
  onFileUploaded: (file: { id: number; original_name: string }) => void
) {
  if (!supabase) return null;

  const channel = supabase
    .channel(`session:${sessionCode}`)
    .on(
      "broadcast",
      { event: "clipboard_update" },
      ({ payload }) => {
        onClipboardUpdate(payload.content);
      }
    )
    .on(
      "broadcast",
      { event: "file_uploaded" },
      ({ payload }) => {
        onFileUploaded(payload.file);
      }
    )
    .subscribe();

  return channel;
}

export function sendClipboardUpdate(sessionCode: string, content: string) {
  if (!supabase) return Promise.resolve(null);
  return supabase.channel(`session:${sessionCode}`).send({
    type: "broadcast",
    event: "clipboard_update",
    payload: { content, timestamp: Date.now() },
  });
}

export function sendFileUploaded(sessionCode: string, file: { id: number; original_name: string }) {
  if (!supabase) return Promise.resolve(null);
  return supabase.channel(`session:${sessionCode}`).send({
    type: "broadcast",
    event: "file_uploaded",
    payload: { file },
  });
}
