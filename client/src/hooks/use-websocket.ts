import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";

type WebSocketOptions = {
  onSignalingMessage?: (message: any) => void;
};

type WebSocketHook = {
  isConnected: boolean;
  deviceCount: number;
  sendClipboard: (content: string) => void;
  sendSignalingMessage: (message: any) => void;
  lastClipboard: string | null;
  error: string | null;
};

export function useWebSocket(code: string, options?: WebSocketOptions): WebSocketHook {
  const [isConnected, setIsConnected] = useState(false);
  const [deviceCount, setDeviceCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [lastClipboard, setLastClipboard] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (!code || isUnmountedRef.current) return;

    // Determine WebSocket URL dynamically from current window host
    let wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/ws`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setError(null);
        // Join the session room
        ws.send(JSON.stringify({ type: WS_EVENTS.JOIN, code }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case WS_EVENTS.JOINED:
              setIsConnected(true);
              if (typeof message.count === "number") {
                setDeviceCount(message.count);
              }
              break;

            case WS_EVENTS.PRESENCE:
              if (typeof message.count === "number") {
                setDeviceCount(message.count);
              }
              break;

            case WS_EVENTS.PEER_JOINED:
              if (typeof message.count === "number") {
                setDeviceCount(message.count);
              }
              optionsRef.current?.onSignalingMessage?.(message);
              break;

            case WS_EVENTS.WEBRTC_OFFER:
            case WS_EVENTS.WEBRTC_ANSWER:
            case WS_EVENTS.WEBRTC_ICE_CANDIDATE:
              optionsRef.current?.onSignalingMessage?.(message);
              break;

            case WS_EVENTS.CLIPBOARD_UPDATE:
              if (typeof message.content === "string") {
                setLastClipboard(message.content);
                toast({
                  title: "Clipboard Synced",
                  description: "Text received from connected device.",
                  duration: 2500,
                });
              }
              break;

            case WS_EVENTS.FILE_UPLOADED:
              toast({
                title: "New File Received",
                description: message.file?.originalName
                  ? `"${message.file.originalName}" is ready to download.`
                  : "A new file was shared.",
                duration: 3000,
              });
              // Instantly refresh files list in cache
              queryClient.invalidateQueries({
                queryKey: [api.files.list.path, code],
              });
              break;

            case WS_EVENTS.ERROR:
              setError(message.message || "Session error");
              toast({
                variant: "destructive",
                title: "Session Error",
                description: message.message,
              });
              break;
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = (e) => {
        console.warn("WebSocket encounter:", e);
        setError("WebSocket connection failed");
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection after 3 seconds if component is still active
        if (!isUnmountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error("WebSocket initialization error:", err);
      setIsConnected(false);
      setError("Failed to initialize WebSocket");
    }
  }, [code, toast, queryClient]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendClipboard = useCallback((content: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: WS_EVENTS.CLIPBOARD_UPDATE,
          content,
        })
      );
    }
  }, []);

  const sendSignalingMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    isConnected,
    deviceCount,
    sendClipboard,
    sendSignalingMessage,
    lastClipboard,
    error,
  };
}
