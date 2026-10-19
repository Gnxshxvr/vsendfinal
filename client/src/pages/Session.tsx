import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useSession, useLeaveSession } from "@/hooks/use-sessions";
import { useSessionFiles, useUploadFile } from "@/hooks/use-files";
import { useWebSocket } from "@/hooks/use-websocket";
import { ClipboardPanel } from "@/components/ClipboardPanel";
import { FileTransferPanel } from "@/components/FileTransferPanel";
import { SessionInfo } from "@/components/SessionInfo";
import {
  Loader2,
  ArrowLeft,
  QrCode,
  ClipboardList,
  UploadCloud,
  LogOut,
  Users,
  CheckCircle2,
  Clock,
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

  const { data: session, isLoading, error } = useSession(code);
  const { data: files = [] } = useSessionFiles(code);
  const uploadFile = useUploadFile();
  const leaveSession = useLeaveSession();

  const {
    isConnected,
    deviceCount,
    sendClipboard,
    lastClipboard,
    error: wsError,
  } = useWebSocket(code);

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
    if (confirm("Are you sure you want to end this session? All files and clipboard data will be cleared.")) {
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
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isConnected
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        : "bg-amber-500 animate-pulse"
                    }`}
                  />
                  <span className="text-slate-500 font-medium">
                    {isConnected ? "Connected" : "Reconnecting..."}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Header Stats & Leave Action */}
          <div className="flex items-center gap-2 sm:gap-3">
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
                <span>Files ({files.length})</span>
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
                initialContent={lastClipboard}
                onSend={sendClipboard}
                isConnected={isConnected}
              />
            </TabsContent>

            <TabsContent value="files" className="flex-1 mt-0 min-h-[450px]">
              <FileTransferPanel
                files={files}
                onUpload={(file) => uploadFile.mutate({ code, file })}
                isUploading={uploadFile.isPending}
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
              initialContent={lastClipboard}
              onSend={sendClipboard}
              isConnected={isConnected}
            />
          </div>

          {/* Right Column: File Transfer */}
          <div className="lg:col-span-4 h-full">
            <FileTransferPanel
              files={files}
              onUpload={(file) => uploadFile.mutate({ code, file })}
              isUploading={uploadFile.isPending}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
