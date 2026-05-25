import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import rateLimit from "express-rate-limit";
import logger from "./lib/logger.js";
import router from "./routes/index.js";

const app = express();

// ─── Trust proxy ──────────────────────────────────────────────────────────────
app.set("trust proxy", 1);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  })
);

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Pino HTTP logging ────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    redact: ["req.headers.authorization", "req.body.password"],
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  })
);

// ─── Rate limiting ────────────────────────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error_code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests, please try again later",
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error_code: "UPLOAD_RATE_LIMIT",
    message: "Upload rate limit exceeded, please wait before uploading again",
  },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error_code: "AI_RATE_LIMIT",
    message: "AI query rate limit exceeded",
  },
});

app.use(generalLimiter);
app.use("/api/v1/upload", uploadLimiter);
app.use("/api/v1/insights", aiLimiter);

// ─── Health endpoint (no auth, no versioning) ─────────────────────────────────
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/v1", router);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error_code: "NOT_FOUND",
    message: "The requested endpoint does not exist",
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const error = err as Error & { status?: number; code?: string };

  logger.error(
    {
      err: error,
      url: req.url,
      method: req.method,
    },
    "Unhandled error"
  );

  // Multer errors
  if (error.message?.includes("Only Excel files")) {
    res.status(400).json({
      error_code: "INVALID_FILE_TYPE",
      message: error.message,
    });
    return;
  }

  // Postgres unique violation
  if (error.code === "23505") {
    res.status(409).json({
      error_code: "DUPLICATE_ENTRY",
      message: "A record with this value already exists",
    });
    return;
  }

  // Postgres foreign key violation
  if (error.code === "23503") {
    res.status(400).json({
      error_code: "FOREIGN_KEY_VIOLATION",
      message: "Referenced record does not exist",
    });
    return;
  }

  const status = error.status ?? 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : error.message ?? "An unexpected error occurred";

  res.status(status).json({
    error_code: "INTERNAL_SERVER_ERROR",
    message,
    ...(process.env.NODE_ENV !== "production" && {
      stack: error.stack,
    }),
  });
});

export default app;
