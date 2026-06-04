import "dotenv/config";
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import { queryRouter } from "./routes/query.js";
import { healthRouter } from "./routes/health.js";

const app = express();
const PORT = process.env.PORT ?? 9090;

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(pinoHttp());
app.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true }));

app.use("/health", healthRouter);
app.use("/query", queryRouter);

app.listen(PORT, () => {
  console.log(`[agent] listening on :${PORT}`);
});
