import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useLocation } from "wouter";

export function useCreateSession() {
  const [, setLocation] = useLocation();
  
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.sessions.create.path, {
        method: api.sessions.create.method,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to create session");
      return api.sessions.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      // Navigate to the session page
      setLocation(`/session/${data.code}`);
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
