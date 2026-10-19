import { useQuery, useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function useCreateSession() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}${api.sessions.create.path}`, {
        method: api.sessions.create.method,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        let msg = "Failed to create session";
        try {
          const error = await res.json();
          msg = error.message || msg;
        } catch {}
        throw new Error(msg);
      }
      return api.sessions.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      setLocation(`/session/${data.code}`);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Session Creation Failed",
        description: error.message,
      });
    },
  });
}

export function useSession(code: string) {
  return useQuery({
    queryKey: [api.sessions.join.path, code],
    queryFn: async () => {
      if (!code) throw new Error("Code required");
      const url = `${API_BASE}${buildUrl(api.sessions.join.path, { code })}`;
      const res = await fetch(url);

      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch session");

      return api.sessions.join.responses[200].parse(await res.json());
    },
    enabled: !!code && code.length === 6,
    retry: false,
  });
}

export function useLeaveSession() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (code: string) => {
      const url = `${API_BASE}${buildUrl(api.sessions.leave.path, { code })}`;
      const res = await fetch(url, {
        method: api.sessions.leave.method,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to close session");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Session Closed",
        description: "You have left the session and temporary resources were cleared.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      setLocation("/");
    },
  });
}
