import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { supabase, subscribeToClipboard, sendClipboardUpdate } from "@/lib/supabase";

type WebSocketHook = {
  isConnected: boolean;
  sendClipboard: (content: string) => void;
  lastClipboard: string | null;
  error: string | null;
};

export function useWebSocket(code: string): WebSocketHook {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastClipboard, setLastClipboard] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!code) return;

    // Subscribe to Supabase Realtime channel
    const channel = subscribeToClipboard(
      code,
      // Clipboard update callback
      (content: string) => {
        setLastClipboard(content);
        toast({
          title: "Clipboard Updated",
          description: "New content received from remote device.",
          duration: 2000,
        });
      },
      // File uploaded callback
      (file: { id: number; original_name: string }) => {
        toast({
          title: "File Received",
          description: `New file available: ${file.original_name}`,
        });
        // Refresh file list
        queryClient.invalidateQueries({ queryKey: [api.files.list.path, code] });
      }
    );

    channelRef.current = channel;

    // Set connected after a short delay (Supabase connects immediately)
    setIsConnected(true);
    setError(null);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [code, toast, queryClient]);

  const sendClipboard = useCallback((content: string) => {
    sendClipboardUpdate(code, content);
  }, [code]);

  return { isConnected, sendClipboard, lastClipboard, error };
}
