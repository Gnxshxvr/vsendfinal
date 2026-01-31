import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client with anon key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ndbercohymnqzwcdrllg.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYmVyY29oeW1ucXp3Y2RybGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MzU2MjIsImV4cCI6MjA4NTQxMTYyMn0.3RH5f0I29X1t3sdejFPjeNbE_rwCnwZGaVW5LYOEkOg";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Clipboard sync with Supabase Realtime
export function subscribeToClipboard(
  sessionCode: string,
  onClipboardUpdate: (content: string) => void,
  onFileUploaded: (file: { id: number; original_name: string }) => void
) {
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
  return supabase.channel(`session:${sessionCode}`).send({
    type: "broadcast",
    event: "clipboard_update",
    payload: { content, timestamp: Date.now() },
  });
}

export function sendFileUploaded(sessionCode: string, file: { id: number; original_name: string }) {
  return supabase.channel(`session:${sessionCode}`).send({
    type: "broadcast",
    event: "file_uploaded",
    payload: { file },
  });
}
