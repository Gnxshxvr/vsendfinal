import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export function useCreateSession() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.sessions.create.path, {
        method: api.sessions.create.method,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create session");
      }
      return api.sessions.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      setLocation(`/session/${data.code}`);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
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
      const url = buildUrl(api.sessions.join.path, { code });
      const res = await fetch(url);
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch session");
      
      return api.sessions.join.responses[200].parse(await res.json());
    },
    enabled: !!code && code.length === 6,
    retry: false,
  });
}
