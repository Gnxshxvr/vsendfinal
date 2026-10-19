import { useEffect, useState, useCallback, useRef } from "react";
import { WS_EVENTS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export type WebRTCStatus = "disconnected" | "connecting" | "connected" | "failed";

export type P2PReceivedFile = {
  id: number;
  sessionId: number;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  cloudinaryUrl: string | null;
  cloudinaryPublicId: string | null;
  resourceType: string | null;
  blobUrl: string;
  isP2P: true;
  uploadedAt: Date;
};

interface UseWebRTCOptions {
  code: string;
  sendSignalingMessage: (message: any) => void;
  onClipboardReceived?: (content: string) => void;
  onFileReceived?: (file: P2PReceivedFile) => void;
}

const CHUNK_SIZE = 16384; // 16 KB standard WebRTC DataChannel chunk size

export function useWebRTC({
  code,
  sendSignalingMessage,
  onClipboardReceived,
  onFileReceived,
}: UseWebRTCOptions) {
  const [status, setStatus] = useState<WebRTCStatus>("disconnected");
  const [p2pTransferProgress, setP2pTransferProgress] = useState<number | null>(null);
  const [transferringFileName, setTransferringFileName] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ]);

  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const incomingFileRef = useRef<{
    id: number;
    name: string;
    size: number;
    mimeType: string;
    chunks: ArrayBuffer[];
    receivedBytes: number;
  } | null>(null);

  const { toast } = useToast();

  // 1. Fetch dynamic STUN / TURN configuration from server
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/webrtc-config");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
            iceServersRef.current = data.iceServers;
          }
        }
      } catch (err) {
        console.warn("Using default STUN servers. Failed to fetch /api/webrtc-config:", err);
      }
    }
    loadConfig();
  }, []);

  // Setup DataChannel event handlers
  const setupDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dc.binaryType = "arraybuffer";
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("connected");
        toast({
          title: "Direct P2P Connected",
          description: "Devices connected via WebRTC DataChannel for high-speed cross-network sharing.",
          duration: 3500,
        });
      };

      dc.onclose = () => {
        setStatus("disconnected");
        dcRef.current = null;
      };

      dc.onerror = (err) => {
        console.warn("WebRTC DataChannel error:", err);
      };

      dc.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "clipboard") {
              onClipboardReceived?.(msg.content);
              toast({
                title: "Clipboard Synced (P2P)",
                description: "Text received directly via WebRTC DataChannel.",
                duration: 2000,
              });
            } else if (msg.type === "file_start") {
              incomingFileRef.current = {
                id: Date.now(),
                name: msg.name,
                size: msg.size,
                mimeType: msg.mimeType,
                chunks: [],
                receivedBytes: 0,
              };
              setTransferringFileName(msg.name);
              setP2pTransferProgress(0);
            } else if (msg.type === "file_end") {
              const fileData = incomingFileRef.current;
              if (fileData) {
                const blob = new Blob(fileData.chunks, {
                  type: fileData.mimeType || "application/octet-stream",
                });
                const blobUrl = URL.createObjectURL(blob);

                const receivedP2PFile: P2PReceivedFile = {
                  id: fileData.id,
                  sessionId: 0,
                  filename: fileData.name,
                  originalName: fileData.name,
                  size: fileData.size,
                  mimeType: fileData.mimeType,
                  cloudinaryUrl: null,
                  cloudinaryPublicId: null,
                  resourceType: null,
                  blobUrl,
                  isP2P: true,
                  uploadedAt: new Date(),
                };

                onFileReceived?.(receivedP2PFile);

                toast({
                  title: "File Received (Direct P2P)",
                  description: `"${fileData.name}" received via WebRTC.`,
                  duration: 3500,
                });
              }
              incomingFileRef.current = null;
              setP2pTransferProgress(null);
              setTransferringFileName(null);
            }
          } catch (e) {
            console.error("Failed to parse DataChannel JSON message:", e);
          }
        } else if (event.data instanceof ArrayBuffer) {
          const fileData = incomingFileRef.current;
          if (fileData) {
            fileData.chunks.push(event.data);
            fileData.receivedBytes += event.data.byteLength;
            const progress = Math.min(
              100,
              Math.round((fileData.receivedBytes / fileData.size) * 100)
            );
            setP2pTransferProgress(progress);
          }
        }
      };
    },
    [onClipboardReceived, onFileReceived, toast]
  );

  // Initialize RTCPeerConnection
  const getOrCreatePeerConnection = useCallback(() => {
    if (pcRef.current && pcRef.current.signalingState !== "closed") {
      return pcRef.current;
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
    });
    pcRef.current = pc;
    candidateQueueRef.current = [];

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage({
          type: WS_EVENTS.WEBRTC_ICE_CANDIDATE,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          // Connection established (DataChannel onopen will set status to connected)
          break;
        case "connecting":
          setStatus("connecting");
          break;
        case "disconnected":
        case "closed":
          setStatus("disconnected");
          break;
        case "failed":
          console.warn("WebRTC connection failed (symmetric NAT / firewall). Falling back to server relay.");
          setStatus("failed");
          break;
      }
    };

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    return pc;
  }, [sendSignalingMessage, setupDataChannel]);

  // Process any ICE candidates that arrived before remoteDescription was set
  const drainCandidateQueue = useCallback(async (pc: RTCPeerConnection) => {
    while (candidateQueueRef.current.length > 0) {
      const candidateInit = candidateQueueRef.current.shift()!;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (err) {
        console.warn("Error adding queued ICE candidate:", err);
      }
    }
  }, []);

  // Handle incoming signaling messages from WebSocket
  const handleSignalingMessage = useCallback(
    async (message: any) => {
      try {
        if (message.type === WS_EVENTS.PEER_JOINED) {
          // Existing peer initiates WebRTC negotiation
          setStatus("connecting");
          const pc = getOrCreatePeerConnection();

          // Create DataChannel as initiator
          const dc = pc.createDataChannel("vsend-datachannel", {
            ordered: true,
          });
          setupDataChannel(dc);

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          sendSignalingMessage({
            type: WS_EVENTS.WEBRTC_OFFER,
            sdp: offer,
          });
        } else if (message.type === WS_EVENTS.WEBRTC_OFFER) {
          setStatus("connecting");
          const pc = getOrCreatePeerConnection();

          await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
          await drainCandidateQueue(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendSignalingMessage({
            type: WS_EVENTS.WEBRTC_ANSWER,
            sdp: answer,
          });
        } else if (message.type === WS_EVENTS.WEBRTC_ANSWER) {
          const pc = pcRef.current;
          if (pc && pc.signalingState !== "closed") {
            await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
            await drainCandidateQueue(pc);
          }
        } else if (message.type === WS_EVENTS.WEBRTC_ICE_CANDIDATE) {
          const pc = pcRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
          } else {
            // Queue until remoteDescription is set
            candidateQueueRef.current.push(message.candidate);
          }
        }
      } catch (err) {
        console.error("Error processing WebRTC signaling message:", err);
      }
    },
    [getOrCreatePeerConnection, setupDataChannel, sendSignalingMessage, drainCandidateQueue]
  );

  // Send clipboard text directly via DataChannel
  const sendDirectText = useCallback((content: string): boolean => {
    if (dcRef.current && dcRef.current.readyState === "open") {
      dcRef.current.send(
        JSON.stringify({
          type: "clipboard",
          content,
          timestamp: Date.now(),
        })
      );
      return true;
    }
    return false;
  }, []);

  // Send file directly via DataChannel with backpressure and chunking
  const sendDirectFile = useCallback(
    async (file: File, onProgress?: (pct: number) => void): Promise<boolean> => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") {
        return false;
      }

      setTransferringFileName(file.name);
      setP2pTransferProgress(0);

      try {
        // Send file metadata header
        dc.send(
          JSON.stringify({
            type: "file_start",
            name: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
          })
        );

        let offset = 0;
        dc.bufferedAmountLowThreshold = 65536; // 64 KB threshold for backpressure

        while (offset < file.size) {
          // Backpressure handling: wait if bufferedAmount is high
          if (dc.bufferedAmount > 512 * 1024) {
            await new Promise<void>((resolve) => {
              const onLow = () => {
                dc.removeEventListener("bufferedamountlow", onLow);
                resolve();
              };
              dc.addEventListener("bufferedamountlow", onLow);
            });
          }

          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const chunk = await slice.arrayBuffer();
          dc.send(chunk);
          offset += chunk.byteLength;

          const progress = Math.min(100, Math.round((offset / file.size) * 100));
          setP2pTransferProgress(progress);
          onProgress?.(progress);
        }

        // Send completion notice
        dc.send(
          JSON.stringify({
            type: "file_end",
            name: file.name,
          })
        );

        toast({
          title: "Direct P2P Sent",
          description: `"${file.name}" sent directly to peer via WebRTC.`,
          duration: 3000,
        });

        return true;
      } catch (err) {
        console.error("Failed to send file via WebRTC DataChannel:", err);
        return false;
      } finally {
        setP2pTransferProgress(null);
        setTransferringFileName(null);
      }
    },
    [toast]
  );

  // Cleanup on unmount or session change
  useEffect(() => {
    return () => {
      if (dcRef.current) {
        dcRef.current.close();
        dcRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setStatus("disconnected");
    };
  }, [code]);

  return {
    status,
    isDirectP2P: status === "connected",
    handleSignalingMessage,
    sendDirectText,
    sendDirectFile,
    p2pTransferProgress,
    transferringFileName,
  };
}
