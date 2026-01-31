import { useState, useEffect } from "react";
import { Copy, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface ClipboardPanelProps {
  initialContent: string | null;
  onSend: (content: string) => void;
  isConnected: boolean;
}

export function ClipboardPanel({ initialContent, onSend, isConnected }: ClipboardPanelProps) {
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  // Sync incoming content
  useEffect(() => {
    if (initialContent !== null) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setContent(newValue);
    // Debounce is handled by the user pressing send or we could debounce here
    // For this app, let's auto-send with debounce to make it feel "instant"
  };
  
  // Debounce send effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== initialContent && isConnected) {
        onSend(content);
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timer);
  }, [content, isConnected, onSend, initialContent]);

  return (
    <Card className="h-full border-0 shadow-lg shadow-black/5 flex flex-col overflow-hidden bg-white/50 backdrop-blur-sm">
      <CardHeader className="border-b border-border/50 bg-white/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <span className="bg-primary/10 text-primary p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
            </span>
            Universal Clipboard
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!content}
              className="text-xs font-medium"
            >
              {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative">
        <Textarea
          value={content}
          onChange={handleChange}
          placeholder="Type or paste here to sync instantly..."
          className="h-full w-full resize-none border-0 focus-visible:ring-0 p-6 text-base leading-relaxed bg-transparent"
        />
        <div className="absolute bottom-4 right-4">
           {!isConnected && (
             <span className="text-xs text-muted-foreground bg-secondary/80 px-2 py-1 rounded-md">
               Connecting...
             </span>
           )}
           {isConnected && (
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }}
               className="text-xs text-green-600 bg-green-100/50 px-2 py-1 rounded-md flex items-center gap-1"
             >
               <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
               Synced
             </motion.div>
           )}
        </div>
      </CardContent>
    </Card>
  );
}
