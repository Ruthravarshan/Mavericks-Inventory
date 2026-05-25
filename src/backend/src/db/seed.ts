import "dotenv/config";
import { db } from "./index.js";
import { users, stocks, anomalies, stockLedger } from "./schema/index.js";
import { hashPassword } from "../lib/auth.js";
import logger from "../lib/logger.js";

async function seed() {
  logger.info("Starting database seed...");

  // ─── Users ─────────────────────────────────────────────────────────────────

  const passwordAdmin = await hashPassword("Admin@123!");
  const passwordExec = await hashPassword("Exec@123!");
  const passwordManager = await hashPassword("Manager@123!");
  const passwordL2 = await hashPassword("L2Auth@123!");

  const [admin] = await db
    .insert(users)
    .values({
      employeeId: "EMP-ADMIN-001",
      fullName: "System Administrator",
      email: "admin@mavericks.com",
      passwordHash: passwordAdmin,
      role: "admin",
      department: "IT",
      location: "Head Office",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  const [exec] = await db
    .insert(users)
    .values({
      employeeId: "EMP-EXEC-001",
      fullName: "Executive User",
      email: "exec@mavericks.com",
      passwordHash: passwordExec,
      role: "executive",
      department: "Operations",
      location: "Branch A",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  const [manager] = await db
    .insert(users)
    .values({
      employeeId: "EMP-MGR-001",
      fullName: "Inventory Manager",
      email: "manager@mavericks.com",
      passwordHash: passwordManager,
      role: "manager",
      department: "Inventory",
      location: "Head Office",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  const [l2Auth] = await db
    .insert(users)
    .values({
      employeeId: "EMP-L2-001",
      fullName: "L2 Authority",
      email: "l2@mavericks.com",
      passwordHash: passwordL2,
      role: "management_authority",
      department: "Management",
      location: "Head Office",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  const adminId = admin?.id ?? 1;
  const execId = exec?.id ?? 2;

  logger.info("Users seeded");

  // ─── Stocks ─────────────────────────────────────────────────────────────────

  const stockItems = [
    {
      stockCode: "LAP-001",
      stockName: "Laptop 15 inch - Dell Inspiron",
      category: "Electronics",
      subCategory: "Computers",
      unitOfMeasure: "Units",
      openingQuantity: 50,
      minStockLevel: 10,
      location: "Warehouse A",
      description: "Dell Inspiron 15 3000 series, 8GB RAM, 256GB SSD",
      assetTagPrefix: "LAP",
      status: "active" as const,
      healthScore: 85,
    },
    {
      stockCode: "MON-001",
      stockName: "Monitor 24 inch - LG",
      category: "Electronics",
      subCategory: "Displays",
      unitOfMeasure: "Units",
      openingQuantity: 30,
      minStockLevel: 5,
      location: "Warehouse A",
      description: "LG 24-inch Full HD IPS Monitor",
      assetTagPrefix: "MON",
      status: "active" as const,
      healthScore: 85,
    },
    {
      stockCode: "SRV-001",
      stockName: "Server - Dell PowerEdge R740",
      category: "Server",
      subCategory: "Rack Servers",
      unitOfMeasure: "Units",
      openingQuantity: 8,
      minStockLevel: 2,
      location: "Data Centre",
      description: "Dell PowerEdge R740 2U Rack Server",
      assetTagPrefix: "SRV",
      status: "active" as const,
      healthScore: 85,
    },
    {
      stockCode: "PRN-001",
      stockName: "Printer - HP LaserJet",
      category: "Office Equipment",
      subCategory: "Printers",
      unitOfMeasure: "Units",
      openingQuantity: 15,
      minStockLevel: 3,
      location: "Warehouse B",
      description: "HP LaserJet Pro M404dn Mono Laser Printer",
      assetTagPrefix: "PRN",
      status: "active" as const,
      healthScore: 85,
    },
    {
      stockCode: "NET-001",
      stockName: "Network Switch - Cisco 48-port",
      category: "Networking",
      subCategory: "Switches",
      unitOfMeasure: "Units",
      openingQuantity: 12,
      minStockLevel: 4,
      location: "Network Room",
      description: "Cisco Catalyst 2960-X 48-port Gigabit Switch",
      assetTagPrefix: "NSW",
      status: "active" as const,
      healthScore: 60,
    },
    {
      stockCode: "KB-001",
      stockName: "Keyboard - Mechanical USB",
      category: "Peripherals",
      subCategory: "Input Devices",
      unitOfMeasure: "Units",
      openingQuantity: 3,
      minStockLevel: 10,
      location: "Warehouse A",
      description: "Mechanical USB keyboard with backlight",
      assetTagPrefix: "KB",
      status: "active" as const,
      healthScore: 25,
    },
    {
      stockCode: "MSE-001",
      stockName: "Mouse - Logitech MX Master",
      category: "Peripherals",
      subCategory: "Input Devices",
      unitOfMeasure: "Units",
      openingQuantity: 40,
      minStockLevel: 8,
      location: "Warehouse A",
      description: "Logitech MX Master 3 Wireless Mouse",
      assetTagPrefix: "MSE",
      status: "active" as const,
      healthScore: 85,
    },
    {
      stockCode: "UPS-001",
      stockName: "UPS - APC 1500VA",
      category: "Power",
      subCategory: "UPS",
      unitOfMeasure: "Units",
      openingQuantity: 20,
      minStockLevel: 5,
      location: "Warehouse B",
      description: "APC Back-UPS 1500VA 230V",
      assetTagPrefix: "UPS",
      status: "active" as const,
      healthScore: 85,
    },
    {
      stockCode: "CAB-001",
      stockName: "CAT6 Network Cable - 5m",
      category: "Cables",
      subCategory: "Network Cables",
      unitOfMeasure: "Pieces",
      openingQuantity: 200,
      minStockLevel: 50,
      location: "Warehouse C",
      description: "CAT6 UTP Network Patch Cable 5 metre",
      assetTagPrefix: "CAB",
      status: "active" as const,
      healthScore: 85,
    },
    {
      stockCode: "HDD-001",
      stockName: "Hard Drive - Seagate 2TB",
      category: "Storage",
      subCategory: "Hard Drives",
      unitOfMeasure: "Units",
      openingQuantity: 0,
      minStockLevel: 10,
      location: "Warehouse A",
      description: "Seagate Barracuda 2TB 3.5 inch HDD",
      assetTagPrefix: "HDD",
      status: "active" as const,
      healthScore: 25,
    },
  ];

  const insertedStocks = [];

  for (const stockData of stockItems) {
    const [stock] = await db
      .insert(stocks)
      .values({
        ...stockData,
        createdBy: adminId,
      })
      .onConflictDoNothing()
      .returning();

    if (stock) {
      insertedStocks.push(stock);
      // Opening ledger entry
      await db
        .insert(stockLedger)
        .values({
          stockId: stock.id,
          movementType: "opening",
          quantity: stock.openingQuantity,
          runningBalance: stock.openingQuantity,
          performedBy: "System Seed",
          performedAt: new Date(),
          source: "seed",
          remarks: "Initial stock balance from seed data",
        })
        .onConflictDoNothing();
    }
  }

  logger.info(`${insertedStocks.length} stock items seeded`);

  // ─── Anomalies ──────────────────────────────────────────────────────────────

  const stockMap = new Map(insertedStocks.map((s) => [s.stockCode, s.id]));

  const sampleAnomalies = [
    {
      stockId: stockMap.get("KB-001") ?? null,
      anomalyType: "low_stock",
      severity: "critical" as const,
      description: "Keyboard stock (KB-001) has fallen below minimum level. Available: 3, Minimum: 10",
      explanation: "Keyboard stock is critically low at 3 units against a minimum threshold of 10 units. This will impact new employee onboarding and replacements.",
      recommendedAction: "Raise an urgent purchase order for at least 15 units of mechanical keyboards.",
      status: "active" as const,
    },
    {
      stockId: stockMap.get("HDD-001") ?? null,
      anomalyType: "zero_stock",
      severity: "critical" as const,
      description: "Hard Drive HDD-001 has zero available stock. Cannot fulfil pending requests.",
      explanation: "All hard drives have been depleted. Any pending or new distribution requests for this item will be blocked.",
      recommendedAction: "Place an emergency procurement order for at least 20 units immediately.",
      status: "active" as const,
    },
    {
      stockId: stockMap.get("NET-001") ?? null,
      anomalyType: "velocity_anomaly",
      severity: "warning" as const,
      description: "Network Switch NET-001 depletion rate is higher than normal. 4 units issued in last 7 days.",
      explanation: "The consumption rate for network switches has increased significantly. Historical average was 1 per month, but 4 have been issued this week.",
      recommendedAction: "Investigate the cause of increased network equipment demand and plan procurement accordingly.",
      status: "acknowledged" as const,
      acknowledgedBy: "Inventory Manager",
      acknowledgedAt: new Date(),
    },
    {
      stockId: null,
      anomalyType: "frequency_anomaly",
      severity: "warning" as const,
      description: "Recipient EMP-042 has made 5 requests in the last 30 days across multiple stock categories.",
      explanation: "An unusual pattern of frequent requests from the same employee has been detected. While each individual request may be legitimate, the frequency warrants review.",
      recommendedAction: "Review the employee's request history and verify all distributions are for legitimate business purposes.",
      status: "active" as const,
    },
    {
      stockId: stockMap.get("SRV-001") ?? null,
      anomalyType: "volume_anomaly",
      severity: "warning" as const,
      description: "A distribution request for Server SRV-001 requested 5 units — 2.5x the average request quantity.",
      explanation: "A single transaction requested 5 server units, which is significantly above the historical average of 2 units per request for this item category.",
      recommendedAction: "Require L2 approval and detailed justification before processing this request.",
      status: "active" as const,
    },
  ];

  for (const anomalyData of sampleAnomalies) {
    await db.insert(anomalies).values({
      ...anomalyData,
      detectedAt: new Date(),
    }).onConflictDoNothing();
  }

  logger.info("Sample anomalies seeded");

  logger.info("✓ Database seed complete");
  logger.info("");
  logger.info("Test credentials:");
  logger.info("  Admin:   admin@mavericks.com / Admin@123!");
  logger.info("  Exec:    exec@mavericks.com  / Exec@123!");
  logger.info("  Manager: manager@mavericks.com / Manager@123!");
  logger.info("  L2 Auth: l2@mavericks.com / L2Auth@123!");

  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
