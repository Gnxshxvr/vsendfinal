import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

const API_BASE = import.meta.env.VITE_API_URL || "";
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function useSessionFiles(code: string) {
  return useQuery({
    queryKey: [api.files.list.path, code],
    queryFn: async () => {
      if (!code) return [];
      const url = `${API_BASE}${buildUrl(api.files.list.path, { code })}`;
      const res = await fetch(url);
      if (res.status === 404) return [];
      if (!res.ok) throw new Error("Failed to fetch files");
      return api.files.list.responses[200].parse(await res.json());
    },
    enabled: !!code,
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, file }: { code: string; file: File }) => {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(
          `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB, exceeding the 25MB limit.`
        );
      }

      const formData = new FormData();
      formData.append("file", file);

      const url = `${API_BASE}${buildUrl(api.files.upload.path, { code })}`;
      const res = await fetch(url, {
        method: api.files.upload.method,
        body: formData,
      });

      if (!res.ok) {
        let msg = "Failed to upload file";
        try {
          const err = await res.json();
          msg = err.message || msg;
        } catch {}
        throw new Error(msg);
      }

      return api.files.upload.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [api.files.list.path, variables.code],
      });
    },
  });
}

export function getDownloadUrl(fileId: number) {
  return `${API_BASE}${buildUrl(api.files.download.path, { fileId })}`;
}

export function getPreviewUrl(fileId: number) {
  return `${API_BASE}${buildUrl(api.files.preview.path, { fileId })}`;
}
