import { Router, Request, Response } from "express";
import { pool } from "../db/index.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        server: "running",
      },
    });
  } catch {
    res.status(503).json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: "disconnected",
        server: "running",
      },
    });
  }
});

export default router;
