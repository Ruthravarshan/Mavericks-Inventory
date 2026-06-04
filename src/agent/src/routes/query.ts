import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { runInventoryQuery } from "../lib/inventory-query.js";

export const queryRouter = Router();

const QueryBody = z.object({
  query: z.string().min(1).max(500),
  context: z.record(z.unknown()).optional(),
});

queryRouter.post("/", async (req: Request, res: Response) => {
  const parsed = QueryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await runInventoryQuery(parsed.data.query, parsed.data.context);
    res.json(result);
  } catch (err) {
    console.error("[query] error:", err);
    res.status(500).json({ error: "Agent query failed" });
  }
});
