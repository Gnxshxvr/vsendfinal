import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useSessionFiles(code: string) {
  return useQuery({
    queryKey: [api.files.list.path, code],
    queryFn: async () => {
      if (!code) return [];
      const url = buildUrl(api.files.list.path, { code });
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
      const formData = new FormData();
      formData.append("file", file);

      const url = buildUrl(api.files.upload.path, { code });
      const res = await fetch(url, {
        method: api.files.upload.method,
        body: formData, // Browser sets Content-Type to multipart/form-data automatically
      });

      if (!res.ok) throw new Error("Failed to upload file");
      return api.files.upload.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.files.list.path, variables.code] });
    },
  });
}

export function getDownloadUrl(fileId: number) {
  return buildUrl(api.files.download.path, { fileId });
}
