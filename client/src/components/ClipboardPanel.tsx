import { useState, useEffect, useRef } from "react";
import {
  Copy,
  Check,
  Send,
  Trash2,
  ClipboardList,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface ClipboardPanelProps {
  initialContent: string | null;
  onSend: (content: string) => void;
  isConnected: boolean;
  isDirectP2P?: boolean;
}

export function ClipboardPanel({
  initialContent,
  onSend,
  isConnected,
  isDirectP2P = false,
}: ClipboardPanelProps) {
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "idle">("idle");
  const lastSentRef = useRef<string>("");
  const isIncomingUpdateRef = useRef(false);
  const { toast } = useToast();

  // Sync incoming content from remote device
  useEffect(() => {
    if (initialContent !== null && initialContent !== content) {
      isIncomingUpdateRef.current = true;
      setContent(initialContent);
      lastSentRef.current = initialContent;
      setSyncStatus("synced");
    }
  }, [initialContent]);

  // Debounced auto-sync to avoid flooding
  useEffect(() => {
    if (isIncomingUpdateRef.current) {
      isIncomingUpdateRef.current = false;
      return;
    }

    if (content === lastSentRef.current) {
      return;
    }

    if (!isConnected) {
      return;
    }

    setSyncStatus("syncing");
    const timer = setTimeout(() => {
      onSend(content);
      lastSentRef.current = content;
      setSyncStatus("synced");
    }, 400);

    return () => clearTimeout(timer);
  }, [content, isConnected, onSend]);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast({
        title: "Copied to Clipboard",
        description: "Clipboard text copied successfully.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Unable to copy to device clipboard.",
      });
    }
  };

  const handleManualSend = () => {
    if (!isConnected) {
      toast({
        variant: "destructive",
        title: "Offline",
        description: "Cannot send while disconnected from session.",
      });
      return;
    }
    onSend(content);
    lastSentRef.current = content;
    setSyncStatus("synced");
    toast({
      title: "Pushed to Devices",
      description: "Clipboard content sent to all connected peers.",
      duration: 1500,
    });
  };

  const handleClear = () => {
    setContent("");
    if (isConnected) {
      onSend("");
      lastSentRef.current = "";
      setSyncStatus("synced");
    }
  };

  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content ? content.split("\n").length : 0;

  return (
    <Card className="h-full border border-slate-200/90 shadow-sm flex flex-col overflow-hidden bg-white rounded-2xl">
      {/* Header */}
      <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100/80">
              <ClipboardList className="w-4 h-4" />
            </span>
            <span>Universal Clipboard</span>
          </CardTitle>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!content}
              className="h-8 px-2.5 text-xs font-medium rounded-lg border-slate-300 hover:bg-slate-100 cursor-pointer text-slate-700"
              title="Copy to local clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  <span>Copy</span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={!content}
              className="h-8 px-2 text-xs font-medium rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
              title="Clear clipboard"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Editor Body */}
      <CardContent className="flex-1 p-0 flex flex-col relative min-h-[220px]">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type, paste code, notes, or links here to sync in real time..."
          className="flex-1 w-full resize-none border-0 focus-visible:ring-0 p-5 text-sm md:text-base leading-relaxed bg-transparent font-mono text-slate-800 placeholder:text-slate-400 placeholder:font-sans"
          aria-label="Universal clipboard text editor"
        />

        {/* Footer info & manual sync action */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>{charCount} chars</span>
            <span>&bull;</span>
            <span>{wordCount} words</span>
            {lineCount > 1 && (
              <>
                <span>&bull;</span>
                <span>{lineCount} lines</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isConnected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                <WifiOff className="w-3 h-3 text-amber-600" />
                Connecting...
              </span>
            ) : syncStatus === "syncing" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                Syncing...
              </span>
            ) : isDirectP2P ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                <Check className="w-3 h-3 text-emerald-600" />
                ⚡ P2P Direct
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                <Check className="w-3 h-3 text-blue-600" />
                Relay Synced
              </span>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSend}
              disabled={!isConnected || !content}
              className="h-7 px-2 text-[11px] font-medium rounded-md border-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              <Send className="w-3 h-3 mr-1" />
              Push
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
