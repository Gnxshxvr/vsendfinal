import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Zap, Shield, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateSession } from "@/hooks/use-sessions";
import { motion } from "framer-motion";

export default function Home() {
  const [code, setCode] = useState("");
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      setLocation(`/session/${code}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full z-10 space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-1 rounded-3xl bg-white shadow-xl shadow-black/5 mb-4 overflow-hidden border-4 border-white">
            <img src="/src/assets/logo.jpg" alt="VSend Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            VSend
          </h1>
          <p className="text-lg text-muted-foreground max-w-sm mx-auto">
            The instant bridge between your devices. No login, no hassle.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-8 shadow-2xl shadow-indigo-500/10 space-y-8">
          
          {/* Create Section */}
          <div className="space-y-4">
            <Button
              size="lg"
              className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
              onClick={() => createSession.mutate()}
              disabled={createSession.isPending}
            >
              {createSession.isPending ? "Creating..." : "Start New Session"}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Starts a session and generates a secure 6-digit code
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white/50 backdrop-blur px-2 text-muted-foreground font-medium">
                Or join existing
              </span>
            </div>
          </div>

          {/* Join Section */}
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter 6-digit code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="h-14 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border-2 focus:ring-4 focus:ring-primary/10 transition-all uppercase placeholder:tracking-normal placeholder:text-base placeholder:font-sans"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="w-full h-12 rounded-xl border-2 hover:bg-secondary/50 font-semibold"
              disabled={code.length !== 6}
            >
              Join Session
            </Button>
          </form>
        </div>

        {/* Features Tagline */}
        <div className="flex justify-center">
          <div className="bg-white/60 px-6 py-3 rounded-2xl flex items-center text-center gap-3 border border-white/40 shadow-sm">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Labs Made Easy</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
