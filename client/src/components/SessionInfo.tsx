import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Users, Clock, LogOut, Share2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface SessionInfoProps {
  code: string;
  expiresAt?: string | Date;
  deviceCount?: number;
  onLeave?: () => void;
}

export function SessionInfo({
  code,
  expiresAt,
  deviceCount = 1,
  onLeave,
}: SessionInfoProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const sessionUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/session/${code}`
    : `/session/${code}`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(sessionUrl);
      setCopiedLink(true);
      toast({
        title: "Join Link Copied",
        description: "Send this URL to your second device or scan the QR code.",
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Please copy the URL from your address bar.",
      });
    }
  };

  const copyCodeOnly = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast({
        title: "Code Copied",
        description: `Session code ${code} copied to clipboard.`,
      });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Please copy the code manually.",
      });
    }
  };

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  return (
    <Card className="p-5 md:p-6 bg-white border border-slate-200/90 shadow-sm rounded-2xl flex flex-col justify-between h-full">
      <div className="space-y-6">
        {/* Session Code Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Session Code
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-[11px] font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl md:text-5xl font-mono font-extrabold tracking-widest text-slate-950 tabular-nums">
              {code}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={copyCodeOnly}
              className="h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Copy session code"
            >
              {copiedCode ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm inline-block">
            <QRCodeSVG
              value={sessionUrl}
              size={156}
              level="M"
              includeMargin={false}
              className="rounded-sm"
            />
          </div>
          <p className="text-[12px] text-slate-500 mt-2 text-center max-w-[210px] leading-snug">
            Scan with your phone camera to pair instantly
          </p>
        </div>

        {/* Share / Copy URL Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl border-slate-300 hover:bg-slate-50 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer text-slate-700"
            onClick={copyUrl}
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Copy Join Link</span>
              </>
            )}
          </Button>

          {isLocalhost && (
            <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 text-[11px] text-amber-800 leading-relaxed flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
              <span>
                To scan from another device on your local Wi-Fi, open this page using your machine's LAN IP (e.g. <code className="font-mono font-semibold">192.168.x.x:5000</code>).
              </span>
            </div>
          )}
        </div>

        {/* Status Badges */}
        <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Connected Devices
            </span>
            <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
              {deviceCount} {deviceCount === 1 ? "device" : "devices"}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Expires
            </span>
            <span className="font-mono text-slate-700 text-[11px]">
              24 hours from creation
            </span>
          </div>
        </div>
      </div>

      {/* Leave / Close Session */}
      {onLeave && (
        <div className="pt-4 border-t border-slate-100 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-medium cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            End & Clean Up Session
          </Button>
        </div>
      )}
    </Card>
  );
}
