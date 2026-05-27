import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { createHash } from "crypto";
import { db } from "../db/index.js";
import {
  uploadJobs,
  stocks,
  distributions,
  stockLedger,
  activity,
} from "../db/schema/index.js";
import { eq, desc, and } from "drizzle-orm";
import { uploadFile } from "../lib/azure-blob.js";
import { selfHealExcelRows } from "../lib/azure-openai.js";
import logger from "../lib/logger.js";

type UploadJobRow = typeof uploadJobs.$inferSelect;

function toUploadJobResponse(job: UploadJobRow) {
  let errors: { row: number; field: string; error: string; value: string }[] = [];
  if (job.errorReportJson) {
    try {
      const raw = JSON.parse(job.errorReportJson) as { rowNumber?: number; row?: number; field?: string; errorType?: string; message?: string; value?: string }[];
      errors = raw.map((e) => ({
        row: e.rowNumber ?? e.row ?? 0,
        field: e.field ?? "",
        error: e.message ?? e.errorType ?? "Unknown error",
        value: String(e.value ?? ""),
      }));
    } catch { /* ignore parse errors */ }
  }

  return {
    id: String(job.id),
    job_type: job.uploadType === "stock_master" ? "stocks" : "distributions",
    filename: job.fileName,
    status: job.status as "queued" | "processing" | "completed" | "failed",
    total_rows: job.rowsTotal ?? 0,
    saved_rows: job.rowsValid ?? 0,
    corrected_rows: job.rowsCorrected ?? 0,
    failed_rows: job.rowsFailed ?? 0,
    corrections: [] as { row: number; field: string; original_value: string; corrected_value: string; reason: string }[],
    errors,
    uploaded_by: String(job.uploadedBy),
    uploaded_at: (job.createdAt ?? new Date()).toISOString(),
    completed_at: job.completedAt?.toISOString() ?? null,
  };
}

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx, .xls) are allowed"));
    }
  },
});

async function processStockUpload(jobId: number, buffer: Buffer, userId: number, userName: string) {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    await db.update(uploadJobs).set({
      status: "processing",
      rowsTotal: rawRows.length,
    }).where(eq(uploadJobs.id, jobId));

    const { correctedRows, errors } = await selfHealExcelRows(rawRows, "stock_master");

    let rowsValid = 0;
    let rowsCorrected = 0;
    let rowsFailed = errors.length;

    const errorRowNumbers = new Set(errors.map((e) => e.rowNumber));

    for (let i = 0; i < correctedRows.length; i++) {
      const rowNumber = i + 2;
      if (errorRowNumbers.has(rowNumber)) continue;

      const row = correctedRows[i];
      const isCorr = JSON.stringify(row) !== JSON.stringify(rawRows[i]);

      try {
        const openingQty = Number(row["opening_quantity"] ?? row["Opening Quantity"] ?? 0);
        const minLevel = Number(row["min_stock_level"] ?? row["Min Stock Level"] ?? 0);

        let healthScore = 100;
        if (minLevel > 0) {
          if (openingQty >= minLevel * 1.5) healthScore = 85;
          else if (openingQty >= minLevel) healthScore = 60;
          else healthScore = 25;
        }

        await db.insert(stocks).values({
          stockCode: String(row["stock_code"] ?? row["Stock Code"] ?? "").toUpperCase(),
          stockName: String(row["stock_name"] ?? row["Stock Name"] ?? ""),
          category: String(row["category"] ?? row["Category"] ?? ""),
          subCategory: row["sub_category"] != null ? String(row["sub_category"]) : undefined,
          unitOfMeasure: String(row["unit_of_measure"] ?? row["Unit of Measure"] ?? "Units"),
          openingQuantity: openingQty,
          availableQuantity: openingQty,
          minStockLevel: minLevel,
          location: row["location"] != null ? String(row["location"]) : undefined,
          description: row["description"] != null ? String(row["description"]) : undefined,
          status: "draft",
          healthScore,
          createdBy: userId,
        }).onConflictDoNothing();

        rowsValid++;
        if (isCorr) rowsCorrected++;

        // Ledger opening entry
        const [inserted] = await db
          .select({ id: stocks.id })
          .from(stocks)
          .where(eq(stocks.stockCode, String(row["stock_code"] ?? "").toUpperCase()))
          .limit(1);

        if (inserted) {
          await db.insert(stockLedger).values({
            stockId: inserted.id,
            movementType: "opening",
            quantity: openingQty,
            runningBalance: openingQty,
            uploadJobId: jobId,
            performedBy: userName,
            performedAt: new Date(),
            source: "bulk_upload",
            remarks: `Imported via upload job ${jobId}`,
          }).onConflictDoNothing();
        }
      } catch {
        rowsFailed++;
      }
    }

    // Build error report
    const errorReport = JSON.stringify(errors);

    await db.update(uploadJobs).set({
      status: "completed",
      rowsValid,
      rowsCorrected,
      rowsFailed,
      errorReportJson: errorReport,
      completedAt: new Date(),
    }).where(eq(uploadJobs.id, jobId));

    logger.info({ jobId, rowsValid, rowsFailed }, "Stock upload job completed");
  } catch (err) {
    logger.error({ err, jobId }, "Stock upload job failed");
    await db.update(uploadJobs).set({
      status: "failed",
      completedAt: new Date(),
    }).where(eq(uploadJobs.id, jobId));
  }
}

async function processDistributionUpload(jobId: number, buffer: Buffer, userId: number, userName: string) {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    await db.update(uploadJobs).set({
      status: "processing",
      rowsTotal: rawRows.length,
    }).where(eq(uploadJobs.id, jobId));

    const { correctedRows, errors } = await selfHealExcelRows(rawRows, "distribution");

    let rowsValid = 0;
    let rowsCorrected = 0;
    let rowsFailed = errors.length;

    const errorRowNumbers = new Set(errors.map((e) => e.rowNumber));

    for (let i = 0; i < correctedRows.length; i++) {
      const rowNumber = i + 2;
      if (errorRowNumbers.has(rowNumber)) continue;

      const row = correctedRows[i];
      const isCorr = JSON.stringify(row) !== JSON.stringify(rawRows[i]);

      try {
        const stockCode = String(row["stock_code"] ?? row["Stock Code"] ?? "").toUpperCase();
        const [stockRow] = await db
          .select({ id: stocks.id })
          .from(stocks)
          .where(eq(stocks.stockCode, stockCode))
          .limit(1);

        if (!stockRow) {
          rowsFailed++;
          errors.push({
            rowNumber,
            field: "stock_code",
            errorType: "STOCK_NOT_FOUND",
            message: `Stock code "${stockCode}" not found in system`,
          });
          continue;
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
        const txnCode = `TXN-${dateStr}-${rand}`;

        await db.insert(distributions).values({
          transactionCode: txnCode,
          stockId: stockRow.id,
          qtyRequested: Number(row["qty_requested"] ?? row["Qty Requested"] ?? 0),
          distributionDate: String(row["distribution_date"] ?? row["Distribution Date"] ?? new Date().toISOString().slice(0, 10)),
          recipientType: (row["recipient_type"] ?? "employee") as "employee" | "project",
          recipientId: String(row["recipient_id"] ?? row["Recipient ID"] ?? ""),
          recipientName: String(row["recipient_name"] ?? row["Recipient Name"] ?? ""),
          location: row["location"] != null ? String(row["location"]) : undefined,
          purpose: row["purpose"] != null ? String(row["purpose"]) : undefined,
          status: "draft",
          createdBy: userId,
        }).onConflictDoNothing();

        rowsValid++;
        if (isCorr) rowsCorrected++;
      } catch {
        rowsFailed++;
      }
    }

    const errorReport = JSON.stringify(errors);

    await db.update(uploadJobs).set({
      status: "completed",
      rowsValid,
      rowsCorrected,
      rowsFailed,
      errorReportJson: errorReport,
      completedAt: new Date(),
    }).where(eq(uploadJobs.id, jobId));

    logger.info({ jobId, rowsValid, rowsFailed }, "Distribution upload job completed");
  } catch (err) {
    logger.error({ err, jobId }, "Distribution upload job failed");
    await db.update(uploadJobs).set({
      status: "failed",
      completedAt: new Date(),
    }).where(eq(uploadJobs.id, jobId));
  }
}

// ─── POST /upload/stocks ──────────────────────────────────────────────────────

router.post("/stocks", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error_code: "NO_FILE", message: "Excel file is required" });
      return;
    }

    const fileHash = createHash("sha256").update(req.file.buffer).digest("hex");
    const fileUrl = await uploadFile(req.file.buffer, req.file.originalname, undefined);

    const [job] = await db.insert(uploadJobs).values({
      uploadedBy: req.user!.id,
      fileName: req.file.originalname,
      fileUrl,
      fileHash,
      uploadType: "stock_master",
      status: "queued",
    }).returning();

    await db.insert(activity).values({
      eventType: "upload_started",
      description: `Stock master upload started: ${req.file.originalname}`,
      actor: req.user!.email,
      entityType: "upload_job",
      entityId: job.id,
      ipAddress: req.ip,
    });

    // Process in background (don't await)
    setImmediate(() => {
      processStockUpload(job.id, req.file!.buffer, req.user!.id, req.user!.name).catch(
        (err) => logger.error({ err }, "Background stock upload failed")
      );
    });

    res.status(202).json(toUploadJobResponse(job));
  } catch (err) {
    next(err);
  }
});

// ─── GET /upload/jobs — history list ─────────────────────────────────────────

router.get("/jobs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const typeFilter = req.query.type as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(50, Math.max(1, Number(req.query.page_size ?? 20)));
    const offset = (page - 1) * page_size;

    // Map frontend type names to DB uploadType values
    const uploadTypeMap: Record<string, string> = {
      stocks: "stock_master",
      distributions: "distribution",
    };

    const conditions = [];
    if (typeFilter && uploadTypeMap[typeFilter]) {
      conditions.push(eq(uploadJobs.uploadType, uploadTypeMap[typeFilter] as "stock_master" | "distribution"));
    }

    const rows = await db
      .select()
      .from(uploadJobs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(uploadJobs.createdAt))
      .limit(page_size)
      .offset(offset);

    res.json(rows.map(toUploadJobResponse));
  } catch (err) {
    next(err);
  }
});

// ─── GET /upload/jobs/:jobId — single job status ──────────────────────────────

router.get("/jobs/:jobId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = Number(req.params.jobId);
    if (isNaN(jobId)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid job ID" });
      return;
    }

    const [job] = await db
      .select()
      .from(uploadJobs)
      .where(eq(uploadJobs.id, jobId))
      .limit(1);

    if (!job) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Upload job not found" });
      return;
    }

    res.json(toUploadJobResponse(job));
  } catch (err) {
    next(err);
  }
});

// ─── GET /upload/:jobId/status ────────────────────────────────────────────────

router.get("/:jobId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = Number(req.params.jobId);
    if (isNaN(jobId)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid job ID" });
      return;
    }

    const [job] = await db
      .select()
      .from(uploadJobs)
      .where(eq(uploadJobs.id, jobId))
      .limit(1);

    if (!job) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Upload job not found" });
      return;
    }

    res.json(toUploadJobResponse(job));
  } catch (err) {
    next(err);
  }
});

// ─── GET /upload/:jobId/error-report ─────────────────────────────────────────

router.get("/:jobId/error-report", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = Number(req.params.jobId);
    if (isNaN(jobId)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid job ID" });
      return;
    }

    const [job] = await db
      .select()
      .from(uploadJobs)
      .where(eq(uploadJobs.id, jobId))
      .limit(1);

    if (!job) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Upload job not found" });
      return;
    }

    if (!job.errorReportJson) {
      res.json({ errors: [] });
      return;
    }

    const errors = JSON.parse(job.errorReportJson);

    // Return as Excel if requested
    if (req.query.format === "xlsx") {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(errors);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Errors");
      const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="error-report-${jobId}.xlsx"`);
      res.send(xlsxBuffer);
      return;
    }

    res.json({ jobId, errors });
  } catch (err) {
    next(err);
  }
});

// ─── POST /upload/distributions ───────────────────────────────────────────────

router.post("/distributions", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error_code: "NO_FILE", message: "Excel file is required" });
      return;
    }

    const fileHash = createHash("sha256").update(req.file.buffer).digest("hex");
    const fileUrl = await uploadFile(req.file.buffer, req.file.originalname, undefined);

    const [job] = await db.insert(uploadJobs).values({
      uploadedBy: req.user!.id,
      fileName: req.file.originalname,
      fileUrl,
      fileHash,
      uploadType: "distribution",
      status: "queued",
    }).returning();

    setImmediate(() => {
      processDistributionUpload(job.id, req.file!.buffer, req.user!.id, req.user!.name).catch(
        (err) => logger.error({ err }, "Background distribution upload failed")
      );
    });

    res.status(202).json(toUploadJobResponse(job));
  } catch (err) {
    next(err);
  }
});

// ─── GET /upload/templates/:type — plural alias used by frontend ──────────────

router.get("/templates/:type", async (req: Request, res: Response, next: NextFunction) => {
  const type = req.params.type as "stocks" | "distributions";
  if (type !== "stocks" && type !== "distributions") {
    res.status(404).json({ error_code: "NOT_FOUND", message: "Template type not found" });
    return;
  }
  // Delegate to the singular handler by mutating params and calling next middleware
  // Actually just inline a redirect to the singular path:
  try {
    const XLSX = await import("xlsx");
    const isStocks = type === "stocks";
    const headers = isStocks
      ? ["stock_code", "stock_name", "category", "sub_category", "unit_of_measure", "opening_quantity", "min_stock_level", "location", "description"]
      : ["stock_code", "qty_requested", "distribution_date", "recipient_type", "recipient_id", "recipient_name", "location", "purpose"];
    const sampleRow = isStocks
      ? { stock_code: "STK-001", stock_name: "Laptop 15 inch", category: "Electronics", sub_category: "Computers", unit_of_measure: "Units", opening_quantity: 50, min_stock_level: 10, location: "Warehouse A", description: "Dell Inspiron 15" }
      : { stock_code: "STK-001", qty_requested: 5, distribution_date: new Date().toISOString().slice(0, 10), recipient_type: "employee", recipient_id: "EMP-001", recipient_name: "John Doe", location: "Office A", purpose: "Office use" };
    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isStocks ? "Stocks" : "Distributions");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-upload-template.xlsx"`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

// ─── GET /upload/template/stocks ─────────────────────────────────────────────

router.get("/template/stocks", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const XLSX = await import("xlsx");
    const headers = [
      "stock_code",
      "stock_name",
      "category",
      "sub_category",
      "unit_of_measure",
      "opening_quantity",
      "min_stock_level",
      "location",
      "description",
      "asset_tag_prefix",
    ];

    const sampleRow = {
      stock_code: "STK-001",
      stock_name: "Laptop 15 inch",
      category: "Electronics",
      sub_category: "Computers",
      unit_of_measure: "Units",
      opening_quantity: 50,
      min_stock_level: 10,
      location: "Warehouse A",
      description: "Dell Inspiron 15",
      asset_tag_prefix: "LAP",
    };

    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stocks");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="stock-upload-template.xlsx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

// ─── GET /upload/template/distributions ──────────────────────────────────────

router.get("/template/distributions", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const XLSX = await import("xlsx");
    const headers = [
      "stock_code",
      "qty_requested",
      "distribution_date",
      "recipient_type",
      "recipient_id",
      "recipient_name",
      "location",
      "purpose",
    ];

    const sampleRow = {
      stock_code: "STK-001",
      qty_requested: 5,
      distribution_date: new Date().toISOString().slice(0, 10),
      recipient_type: "employee",
      recipient_id: "EMP-001",
      recipient_name: "John Doe",
      location: "Office A",
      purpose: "Office use",
    };

    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Distributions");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="distribution-upload-template.xlsx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

export default router;
