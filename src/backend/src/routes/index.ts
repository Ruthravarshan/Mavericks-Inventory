import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import stocksRouter from "./stocks.js";
import distributionsRouter from "./distributions.js";
import approvalsRouter from "./approvals.js";
import dashboardRouter from "./dashboard.js";
import anomaliesRouter from "./anomalies.js";
import insightsRouter from "./insights.js";
import notificationsRouter from "./notifications.js";
import adminRouter from "./admin.js";
import uploadRouter from "./upload.js";
import ledgerRouter from "./ledger.js";
import auditLogRouter from "./audit-log.js";
import reportsRouter from "./reports.js";
import assetsRouter from "./assets.js";
import myAssetsRouter from "./my-assets.js";
import requestsRouter from "./requests.js";
import assetAuditRouter from "./asset-audit.js";
import employeesRouter from "./employees.js";
import reconciliationRouter from "./reconciliation.js";
import legalHoldsRouter from "./legal-holds.js";
import configRouter from "./config.js";
import auditMobileRouter from "./audit-mobile.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// Public routes (no auth)
router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/audit-mobile", auditMobileRouter); // Token-based auth, no JWT required

// Protected routes (all require authentication)
router.use("/stocks", authMiddleware, stocksRouter);
router.use("/distributions", authMiddleware, distributionsRouter);
router.use("/approvals", authMiddleware, approvalsRouter);
router.use("/dashboard", authMiddleware, dashboardRouter);
router.use("/anomalies", authMiddleware, anomaliesRouter);
router.use("/insights", authMiddleware, insightsRouter);
router.use("/notifications", authMiddleware, notificationsRouter);
router.use("/admin", authMiddleware, adminRouter);
router.use("/upload", authMiddleware, uploadRouter);
router.use("/ledger", authMiddleware, ledgerRouter);
router.use("/audit-log", authMiddleware, auditLogRouter);
router.use("/reports", authMiddleware, reportsRouter);
router.use("/assets", authMiddleware, assetsRouter);
router.use("/my-assets", authMiddleware, myAssetsRouter);
router.use("/requests", authMiddleware, requestsRouter);
router.use("/asset-audit", authMiddleware, assetAuditRouter);
router.use("/employees", authMiddleware, employeesRouter);
router.use("/reconciliation", authMiddleware, reconciliationRouter);
router.use("/legal-holds", authMiddleware, legalHoldsRouter);
router.use("/config", authMiddleware, configRouter);

export default router;
