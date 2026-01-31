import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { WS_EVENTS } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

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
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!code) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      // Join the session room
      ws.send(JSON.stringify({ type: WS_EVENTS.JOIN, code }));
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setError("Connection error");
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case WS_EVENTS.CLIPBOARD_UPDATE:
            setLastClipboard(message.content);
            toast({
              title: "Clipboard Updated",
              description: "New content received from remote device.",
              duration: 2000,
            });
            break;
            
          case WS_EVENTS.FILE_UPLOADED:
            toast({
              title: "File Received",
              description: `New file available: ${message.filename}`,
            });
            // Refresh file list
            queryClient.invalidateQueries({ queryKey: [api.files.list.path, code] });
            break;
            
          case WS_EVENTS.ERROR:
            toast({
              variant: "destructive",
              title: "Error",
              description: message.message,
            });
            break;
        }
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [code, toast, queryClient]);

  const sendClipboard = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: WS_EVENTS.CLIPBOARD_UPDATE,
        content
      }));
    }
  }, []);

  return { isConnected, sendClipboard, lastClipboard, error };
}
