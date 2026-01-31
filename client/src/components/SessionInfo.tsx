import { QRCodeSVG } from "qrcode.react";
import { Copy, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface SessionInfoProps {
  code: string;
}

export function SessionInfo({ code }: SessionInfoProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const sessionUrl = `${window.location.protocol}//${window.location.host}/session/${code}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(sessionUrl);
    setCopied(true);
    toast({ title: "Link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6 bg-white border-0 shadow-xl shadow-indigo-500/10 rounded-2xl">
      <div className="flex flex-col items-center text-center space-y-6">
        <div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Session Code</h2>
          <div className="text-5xl font-mono font-bold tracking-widest text-primary tabular-nums">
            {code}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-inner border border-border/50">
          <QRCodeSVG 
            value={sessionUrl} 
            size={160} 
            level="H" 
            includeMargin={true}
            className="w-full h-auto"
          />
        </div>

        <div className="space-y-3 w-full">
          <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
            Scan with your phone camera to join instantly
          </p>
          
          <Button 
            variant="outline" 
            className="w-full rounded-xl border-border/60 hover:bg-secondary/50 text-xs"
            onClick={copyUrl}
          >
            <Copy className="w-3.5 h-3.5 mr-2" />
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full pt-4 border-t border-dashed">
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
             <Monitor className="w-4 h-4 text-primary" />
             <span>Host</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
             <Smartphone className="w-4 h-4 text-indigo-500" />
             <span>Client</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
