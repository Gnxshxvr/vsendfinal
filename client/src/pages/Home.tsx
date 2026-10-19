import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Smartphone,
  Laptop,
  Copy,
  Clock,
  CheckCircle2,
  FileText,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateSession } from "@/hooks/use-sessions";
import { motion } from "framer-motion";
import logo from "@/assets/logo.jpg";

export default function Home() {
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().replace(/\s+/g, "");
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setErrorMsg("Please enter a valid 6-digit session code.");
      return;
    }
    setErrorMsg("");
    setLocation(`/session/${cleanCode}`);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(raw);
    if (errorMsg) setErrorMsg("");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white flex items-center justify-center">
              <img src={logo} alt="VSend Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-none text-slate-900">
                VSend
              </span>
              <span className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider">
                Instant D2D Transfer
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/60 text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Zero Login Required</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero & Interactive Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 md:py-16 flex flex-col items-center justify-center w-full">
        <div className="w-full max-w-xl space-y-8">
          {/* Headline */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              Fast, Private Device-to-Device Sharing
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-950">
              Move files & text across devices in seconds.
            </h1>
            <p className="text-base md:text-lg text-slate-600 max-w-lg mx-auto">
              No accounts, no email links, no cables. Create a temporary session, connect your phone or laptop with a 6-digit code or QR, and sync instantly.
            </p>
          </div>

          {/* Action Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/60 p-6 md:p-8 space-y-6">
            {/* Create Session */}
            <div className="space-y-3">
              <Button
                size="lg"
                aria-label="Start a new sharing session"
                className="w-full h-13 text-base font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                onClick={() => createSession.mutate()}
                disabled={createSession.isPending}
              >
                {createSession.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating Session...
                  </>
                ) : (
                  <>
                    Start New Session
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" /> End-to-end transient
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" /> 24h automatic cleanup
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-3 text-xs uppercase font-mono font-semibold text-slate-400">
                Or join existing
              </span>
            </div>

            {/* Join Session */}
            <form onSubmit={handleJoin} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="session-code"
                  className="block text-xs font-semibold text-slate-600 uppercase tracking-wider"
                >
                  Enter 6-digit Session Code
                </label>
                <div className="relative">
                  <Input
                    id="session-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={handleCodeChange}
                    className="h-13 text-center text-3xl font-mono tracking-[0.4em] rounded-xl border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 font-bold placeholder:text-slate-300 placeholder:tracking-widest"
                  />
                </div>
                {errorMsg && (
                  <p className="text-xs text-red-600 font-medium pt-1">{errorMsg}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="w-full h-12 rounded-xl border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 transition-colors"
                disabled={code.length !== 6}
              >
                Join Session
              </Button>
            </form>
          </div>

          {/* Quick 3-Step Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-white/80 border border-slate-200/80 rounded-xl p-4 space-y-1.5 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3 className="font-semibold text-sm text-slate-900">Start Session</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click start to create a temporary room with a unique 6-digit code.
              </p>
            </div>

            <div className="bg-white/80 border border-slate-200/80 rounded-xl p-4 space-y-1.5 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h3 className="font-semibold text-sm text-slate-900">Pair Devices</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Scan the QR code with your phone or enter the code on another laptop.
              </p>
            </div>

            <div className="bg-white/80 border border-slate-200/80 rounded-xl p-4 space-y-1.5 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h3 className="font-semibold text-sm text-slate-900">Sync & Share</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Drop documents, photos, or type in the universal clipboard for instant sync.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/70 bg-white/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VSend &bull; Developer & Student Friendly Device Bridge</span>
          <span className="font-mono text-[11px] text-slate-400">
            Ephemeral data &bull; No accounts required
          </span>
        </div>
      </footer>
    </div>
  );
}
