import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useSession, useLeaveSession } from "@/hooks/use-sessions";
import { useSessionFiles, useUploadFile } from "@/hooks/use-files";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWebRTC, P2PReceivedFile } from "@/hooks/use-webrtc";
import { ClipboardPanel } from "@/components/ClipboardPanel";
import { FileTransferPanel, DisplayFile } from "@/components/FileTransferPanel";
import { SessionInfo } from "@/components/SessionInfo";
import {
  Loader2,
  ArrowLeft,
  QrCode,
  ClipboardList,
  UploadCloud,
  LogOut,
  Users,
  Zap,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.jpg";

export default function Session() {
  const params = useParams();
  const code = (params.code || "").trim();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeMobileTab, setActiveMobileTab] = useState("clipboard");

  // Local state for direct P2P files and clipboard updates
  const [p2pFiles, setP2pFiles] = useState<DisplayFile[]>([]);
  const [p2pClipboard, setP2pClipboard] = useState<string | null>(null);

  const { data: session, isLoading, error } = useSession(code);
  const { data: serverFiles = [] } = useSessionFiles(code);
  const uploadFile = useUploadFile();
  const leaveSession = useLeaveSession();

  // Forward declaration for signaling bridge
  const signalingHandlerRef = { current: (msg: any) => {} };

  const {
    isConnected: isWsConnected,
    deviceCount,
    sendClipboard: sendWsClipboard,
    sendSignalingMessage,
    lastClipboard: wsLastClipboard,
    error: wsError,
  } = useWebSocket(code, {
    onSignalingMessage: (msg) => {
      signalingHandlerRef.current(msg);
    },
  });

  const {
    status: webrtcStatus,
    isDirectP2P,
    handleSignalingMessage,
    sendDirectText,
    sendDirectFile,
    p2pTransferProgress,
    transferringFileName,
  } = useWebRTC({
    code,
    sendSignalingMessage,
    onClipboardReceived: (content) => {
      setP2pClipboard(content);
    },
    onFileReceived: (file) => {
      setP2pFiles((prev) => [file, ...prev]);
    },
  });

  signalingHandlerRef.current = handleSignalingMessage;

  // Active clipboard text is either latest P2P or latest WebSocket message
  const activeClipboard = p2pClipboard !== null ? p2pClipboard : wsLastClipboard;

  // Unified clipboard send: tries direct P2P DataChannel first, also pushes via WebSocket
  const handleSendClipboard = useCallback(
    (content: string) => {
      if (isDirectP2P) {
        sendDirectText(content);
      }
      sendWsClipboard(content);
    },
    [isDirectP2P, sendDirectText, sendWsClipboard]
  );

  // Unified file send: transfers peer-to-peer via DataChannel if connected; else uses server upload
  const handleUploadFile = useCallback(
    async (file: File) => {
      if (isDirectP2P) {
        const success = await sendDirectFile(file);
        if (success) {
          // Add sent file to local view
          const localSentFile: DisplayFile = {
            id: Date.now(),
            sessionId: session?.id || 1,
            filename: file.name,
            originalName: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            cloudinaryUrl: null,
            cloudinaryPublicId: null,
            resourceType: null,
            uploadedAt: new Date(),
            isP2P: true,
          };
          setP2pFiles((prev) => [localSentFile, ...prev]);
        }
      } else {
        uploadFile.mutate({ code, file });
      }
    },
    [isDirectP2P, sendDirectFile, uploadFile, code, session]
  );

  // Combine server files and direct P2P files without duplicates
  const allFiles = useMemo<DisplayFile[]>(() => {
    const combined: DisplayFile[] = [...p2pFiles];
    for (const sf of serverFiles) {
      if (!combined.some((f) => f.id === sf.id)) {
        combined.push(sf);
      }
    }
    return combined;
  }, [p2pFiles, serverFiles]);

  // Handle fatal session errors (session not found or expired)
  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Session Expired or Not Found",
        description: "The requested session code does not exist or has expired.",
      });
      setLocation("/");
    }
  }, [error, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
        <p className="text-xs font-mono font-medium text-slate-500">
          Connecting to session {code}...
        </p>
      </div>
    );
  }

  if (!session) return null;

  const handleLeave = () => {
    if (
      confirm(
        "Are you sure you want to end this session? All files and clipboard data will be cleared."
      )
    ) {
      leaveSession.mutate(code);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              className="rounded-xl hover:bg-slate-100 text-slate-600 h-9 w-9 cursor-pointer"
              title="Return to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0">
                <img src={logo} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-slate-900">
                    Session
                  </span>
                  <span className="font-mono font-bold text-sm text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100/60">
                    {code}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {isDirectP2P ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-600" />
                        P2P Direct
                      </span>
                    </>
                  ) : webrtcStatus === "connecting" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-indigo-700 font-medium">Negotiating WebRTC...</span>
                    </>
                  ) : isWsConnected ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <Server className="w-3 h-3 text-slate-400" />
                        Server Relay
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-amber-600 font-medium">Reconnecting...</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Header Stats & Leave Action */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isDirectP2P && (
              <div className="hidden md:flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                <Zap className="w-3 h-3 text-emerald-600" />
                <span>WebRTC DataChannel Active</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 border border-slate-200/60 px-3 py-1.5 rounded-full font-mono">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {deviceCount} {deviceCount === 1 ? "device" : "devices"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLeave}
              className="h-8 text-xs font-medium rounded-xl border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Leave Session</span>
              <span className="sm:hidden">Leave</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 flex flex-col">
        {/* Mobile View: Tabs Navigation */}
        <div className="lg:hidden flex-1 flex flex-col">
          <Tabs
            value={activeMobileTab}
            onValueChange={setActiveMobileTab}
            className="flex-1 flex flex-col space-y-4"
          >
            <TabsList className="grid grid-cols-3 bg-slate-200/70 p-1 rounded-xl h-11">
              <TabsTrigger
                value="clipboard"
                className="text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Clipboard</span>
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className="text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Files ({allFiles.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="info"
                className="text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Pair / QR</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="clipboard" className="flex-1 mt-0 min-h-[450px]">
              <ClipboardPanel
                initialContent={activeClipboard}
                onSend={handleSendClipboard}
                isConnected={isWsConnected || isDirectP2P}
                isDirectP2P={isDirectP2P}
              />
            </TabsContent>

            <TabsContent value="files" className="flex-1 mt-0 min-h-[450px]">
              <FileTransferPanel
                files={allFiles}
                onUpload={handleUploadFile}
                isUploading={uploadFile.isPending}
                isDirectP2P={isDirectP2P}
                p2pTransferProgress={p2pTransferProgress}
                transferringFileName={transferringFileName}
              />
            </TabsContent>

            <TabsContent value="info" className="flex-1 mt-0">
              <SessionInfo
                code={code}
                expiresAt={session.expiresAt}
                deviceCount={deviceCount}
                onLeave={handleLeave}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop View: 3-Column Responsive Grid */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-6 h-[calc(100vh-8.5rem)] min-h-[580px]">
          {/* Left Column: QR, Code, Device Info */}
          <div className="lg:col-span-3 h-full">
            <SessionInfo
              code={code}
              expiresAt={session.expiresAt}
              deviceCount={deviceCount}
              onLeave={handleLeave}
            />
          </div>

          {/* Middle Column: Universal Clipboard */}
          <div className="lg:col-span-5 h-full">
            <ClipboardPanel
              initialContent={activeClipboard}
              onSend={handleSendClipboard}
              isConnected={isWsConnected || isDirectP2P}
              isDirectP2P={isDirectP2P}
            />
          </div>

          {/* Right Column: File Transfer */}
          <div className="lg:col-span-4 h-full">
            <FileTransferPanel
              files={allFiles}
              onUpload={handleUploadFile}
              isUploading={uploadFile.isPending}
              isDirectP2P={isDirectP2P}
              p2pTransferProgress={p2pTransferProgress}
              transferringFileName={transferringFileName}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
