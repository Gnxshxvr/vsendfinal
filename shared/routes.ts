
import { z } from "zod";
import { insertSessionSchema, insertFileSchema, sessions, files } from "./schema";

export const errorSchemas = {
  notFound: z.object({ message: z.string() }),
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  sessions: {
    create: {
      method: "POST" as const,
      path: "/api/sessions",
      input: z.object({}), // No input needed, server generates code
      responses: {
        201: z.custom<typeof sessions.$inferSelect>(),
      },
    },
    join: {
      method: "GET" as const,
      path: "/api/sessions/:code",
      responses: {
        200: z.custom<typeof sessions.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  files: {
    upload: {
      method: "POST" as const,
      path: "/api/files/:code",
      // Input is multipart/form-data, handled by multer/express
      responses: {
        201: z.custom<typeof files.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/files/:code",
      responses: {
        200: z.array(z.custom<typeof files.$inferSelect>()),
        404: errorSchemas.notFound,
      },
    },
    download: {
      method: "GET" as const,
      path: "/api/download/:fileId",
      responses: {
        200: z.any(), // File stream
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
