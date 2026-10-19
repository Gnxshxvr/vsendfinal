import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";

const app = express();

app.use(cors({ origin: true, credentials: true }));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));

// Normalize req.url so routes match whether Vercel rewrite preserves /api prefix or strips it
app.use((req, _res, next) => {
  if (!req.url.startsWith("/api") && !req.url.startsWith("/_")) {
    req.url = `/api${req.url}`;
  }
  next();
});

let isReady = false;
let readyPromise: Promise<void> | null = null;

async function bootstrap() {
  if (isReady) return;
  if (!readyPromise) {
    readyPromise = (async () => {
      const httpServer = createServer(app);
      await registerRoutes(httpServer, app);

      // Error handler
      app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        console.error("Vercel Serverless Function Error:", err);
        if (res.headersSent) {
          return next(err);
        }
        return res.status(status).json({ message });
      });

      isReady = true;
    })();
  }
  await readyPromise;
}

export default async function handler(req: Request, res: Response) {
  await bootstrap();
  return app(req, res);
}
