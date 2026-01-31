import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useSession } from "@/hooks/use-sessions";
import { useSessionFiles, useUploadFile } from "@/hooks/use-files";
import { useWebSocket } from "@/hooks/use-websocket";
import { ClipboardPanel } from "@/components/ClipboardPanel";
import { FileTransferPanel } from "@/components/FileTransferPanel";
import { SessionInfo } from "@/components/SessionInfo";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Session() {
  const params = useParams();
  const code = params.code || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: session, isLoading, error } = useSession(code);
  const { data: files = [] } = useSessionFiles(code);
  const uploadFile = useUploadFile();
  const { isConnected, sendClipboard, lastClipboard, error: wsError } = useWebSocket(code);

  // Handle errors
  useEffect(() => {
    if (error || wsError) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Could not connect to session. It may have expired.",
      });
      setLocation("/");
    }
  }, [error, wsError, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-none">Session {code}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-yellow-500"}`} />
                <span className="text-xs text-muted-foreground font-medium">
                  {isConnected ? "Connected" : "Connecting..."}
                </span>
              </div>
            </div>
          </div>
          
          <div className="hidden md:block text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
            Expires in 24h
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
          
          {/* Left Column: QR & Info */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 h-full flex flex-col gap-6"
          >
            <SessionInfo code={code} />
          </motion.div>

          {/* Middle Column: Clipboard */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-5 h-full"
          >
            <ClipboardPanel 
              initialContent={lastClipboard} 
              onSend={sendClipboard}
              isConnected={isConnected}
            />
          </motion.div>

          {/* Right Column: Files */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-4 h-full"
          >
            <FileTransferPanel 
              files={files} 
              onUpload={(file) => uploadFile.mutate({ code, file })}
              isUploading={uploadFile.isPending}
            />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
