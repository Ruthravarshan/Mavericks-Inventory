import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

// Ensures the lookup tables exist and are seeded with defaults.
// Safe to call multiple times — uses INSERT ... ON CONFLICT DO NOTHING.
async function ensureConfigTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      location_type TEXT NOT NULL DEFAULT 'warehouse',
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS units_of_measure (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      abbreviation TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS role_nav_visibility (
      role TEXT NOT NULL,
      nav_key TEXT NOT NULL,
      hidden BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (role, nav_key)
    );
  `);

  // Seed categories
  const defaultCategories = [
    "Laptop", "Desktop", "Monitor", "Mobile Phone", "Peripherals",
    "Networking", "Server", "Storage", "Software License",
    "Access Card", "ID Card", "Power Equipment", "Cables", "Other IT Equipment",
  ];
  for (let i = 0; i < defaultCategories.length; i++) {
    await pool.query(
      `INSERT INTO stock_categories (name, display_order) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      [defaultCategories[i], i]
    );
  }

  // Seed locations
  const defaultLocations = [
    { name: "Warehouse A", type: "warehouse" },
    { name: "Warehouse B", type: "warehouse" },
    { name: "Store Room 1", type: "store_room" },
    { name: "Store Room 2", type: "store_room" },
    { name: "Head Office", type: "office" },
    { name: "Branch Office", type: "office" },
    { name: "Main Store", type: "store_room" },
  ];
  for (let i = 0; i < defaultLocations.length; i++) {
    await pool.query(
      `INSERT INTO locations (name, location_type, display_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [defaultLocations[i].name, defaultLocations[i].type, i]
    );
  }

  // Seed units of measure
  const defaultUOM = [
    { name: "Units", abbreviation: "pcs" },
    { name: "Pieces", abbreviation: "pcs" },
    { name: "Boxes", abbreviation: "box" },
    { name: "Kg", abbreviation: "kg" },
    { name: "Liters", abbreviation: "L" },
    { name: "Meters", abbreviation: "m" },
    { name: "Sets", abbreviation: "set" },
    { name: "Packs", abbreviation: "pk" },
    { name: "Rolls", abbreviation: "roll" },
    { name: "Sheets", abbreviation: "sht" },
  ];
  for (let i = 0; i < defaultUOM.length; i++) {
    await pool.query(
      `INSERT INTO units_of_measure (name, abbreviation, display_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [defaultUOM[i].name, defaultUOM[i].abbreviation, i]
    );
  }
}

// Initialize tables once at module load
ensureConfigTables().catch(() => {
  // Non-fatal — fallback values are handled on the frontend
});

// ─── GET /config/categories ───────────────────────────────────────────────────
router.get("/categories", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<{ id: number; name: string }>(
      `SELECT id, name FROM stock_categories ORDER BY display_order, name`
    );
    res.json({ items: result.rows.map((r) => r.name) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /config/categories ──────────────────────────────────────────────────
router.post("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "name is required" });
      return;
    }
    const maxOrder = await pool.query<{ max: number }>(`SELECT COALESCE(MAX(display_order), -1) AS max FROM stock_categories`);
    await pool.query(
      `INSERT INTO stock_categories (name, display_order) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      [name.trim(), (maxOrder.rows[0].max ?? -1) + 1]
    );
    const result = await pool.query<{ name: string }>(`SELECT name FROM stock_categories ORDER BY display_order, name`);
    res.json({ items: result.rows.map((r) => r.name) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /config/categories/:name ─────────────────────────────────────────
router.delete("/categories/:name", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query(`DELETE FROM stock_categories WHERE name = $1`, [req.params.name]);
    const result = await pool.query<{ name: string }>(`SELECT name FROM stock_categories ORDER BY display_order, name`);
    res.json({ items: result.rows.map((r) => r.name) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /config/locations ────────────────────────────────────────────────────
router.get("/locations", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<{ id: number; name: string; location_type: string }>(
      `SELECT id, name, location_type FROM locations ORDER BY display_order, name`
    );
    res.json({ items: result.rows.map((r) => ({ name: r.name, type: r.location_type })) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /config/locations ───────────────────────────────────────────────────
router.post("/locations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, location_type = "warehouse" } = req.body as { name?: string; location_type?: string };
    if (!name?.trim()) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "name is required" });
      return;
    }
    const maxOrder = await pool.query<{ max: number }>(`SELECT COALESCE(MAX(display_order), -1) AS max FROM locations`);
    await pool.query(
      `INSERT INTO locations (name, location_type, display_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [name.trim(), location_type, (maxOrder.rows[0].max ?? -1) + 1]
    );
    const result = await pool.query<{ name: string; location_type: string }>(`SELECT name, location_type FROM locations ORDER BY display_order, name`);
    res.json({ items: result.rows.map((r) => ({ name: r.name, type: r.location_type })) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /config/locations/:name ──────────────────────────────────────────
router.delete("/locations/:name", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query(`DELETE FROM locations WHERE name = $1`, [req.params.name]);
    const result = await pool.query<{ name: string; location_type: string }>(`SELECT name, location_type FROM locations ORDER BY display_order, name`);
    res.json({ items: result.rows.map((r) => ({ name: r.name, type: r.location_type })) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /config/uom ──────────────────────────────────────────────────────────
router.get("/uom", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<{ name: string; abbreviation: string | null }>(
      `SELECT name, abbreviation FROM units_of_measure ORDER BY display_order, name`
    );
    res.json({ items: result.rows.map((r) => r.name) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /config/uom ─────────────────────────────────────────────────────────
router.post("/uom", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, abbreviation } = req.body as { name?: string; abbreviation?: string };
    if (!name?.trim()) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "name is required" });
      return;
    }
    const maxOrder = await pool.query<{ max: number }>(`SELECT COALESCE(MAX(display_order), -1) AS max FROM units_of_measure`);
    await pool.query(
      `INSERT INTO units_of_measure (name, abbreviation, display_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [name.trim(), abbreviation ?? null, (maxOrder.rows[0].max ?? -1) + 1]
    );
    const result = await pool.query<{ name: string }>(`SELECT name FROM units_of_measure ORDER BY display_order, name`);
    res.json({ items: result.rows.map((r) => r.name) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /config/uom/:name ─────────────────────────────────────────────────
router.delete("/uom/:name", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query(`DELETE FROM units_of_measure WHERE name = $1`, [req.params.name]);
    const result = await pool.query<{ name: string }>(`SELECT name FROM units_of_measure ORDER BY display_order, name`);
    res.json({ items: result.rows.map((r) => r.name) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /config/nav-visibility ───────────────────────────────────────────────
// Returns the map of hidden sidebar nav keys per role:
//   { items: { manager: ["/ledger", ...], user: [...] } }
// Available to any authenticated user — the sidebar reads its own role's list.
router.get("/nav-visibility", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<{ role: string; nav_key: string }>(
      `SELECT role, nav_key FROM role_nav_visibility WHERE hidden = TRUE`
    );
    const items: Record<string, string[]> = {};
    for (const row of result.rows) {
      (items[row.role] ??= []).push(row.nav_key);
    }
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /config/nav-visibility ───────────────────────────────────────────────
// Admin-only. Replaces the full set of hidden nav keys for a single role.
//   body: { role: string, hidden: string[] }
router.put(
  "/nav-visibility",
  requireRole("admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { role, hidden } = req.body as { role?: string; hidden?: unknown };
      if (!role || typeof role !== "string") {
        res.status(400).json({ error_code: "VALIDATION_ERROR", message: "role is required" });
        return;
      }
      const hiddenKeys = Array.isArray(hidden)
        ? [...new Set(hidden.filter((h): h is string => typeof h === "string" && h.length > 0))]
        : [];

      await client.query("BEGIN");
      await client.query(`DELETE FROM role_nav_visibility WHERE role = $1`, [role]);
      for (const navKey of hiddenKeys) {
        await client.query(
          `INSERT INTO role_nav_visibility (role, nav_key, hidden, updated_at)
           VALUES ($1, $2, TRUE, NOW())
           ON CONFLICT (role, nav_key) DO UPDATE SET hidden = TRUE, updated_at = NOW()`,
          [role, navKey]
        );
      }
      await client.query("COMMIT");

      const result = await pool.query<{ role: string; nav_key: string }>(
        `SELECT role, nav_key FROM role_nav_visibility WHERE hidden = TRUE`
      );
      const items: Record<string, string[]> = {};
      for (const row of result.rows) {
        (items[row.role] ??= []).push(row.nav_key);
      }
      res.json({ items });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  }
);

export default router;
