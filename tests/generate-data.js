/**
 * generate-data.js
 * Creates test Excel files for bulk upload testing.
 * Run: node generate-data.js
 */
import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");

try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// ─── Stocks Upload Test File ───────────────────────────────────────────────────

const stockRows = [
  // Valid rows
  { stock_code: "TEST-LAP-001", stock_name: "Test Laptop 13 inch", category: "Electronics", sub_category: "Computers", unit_of_measure: "Units", opening_quantity: 25, min_stock_level: 5, location: "Warehouse A", description: "Test laptop for bulk upload" },
  { stock_code: "TEST-MON-002", stock_name: "Test Monitor 27 inch", category: "Electronics", sub_category: "Displays", unit_of_measure: "Units", opening_quantity: 15, min_stock_level: 3, location: "Warehouse A", description: "Test monitor for bulk upload" },
  { stock_code: "TEST-KB-003",  stock_name: "Test Keyboard Wireless", category: "Peripherals", sub_category: "Input Devices", unit_of_measure: "Units", opening_quantity: 30, min_stock_level: 10, location: "Warehouse B", description: "Test keyboard for bulk upload" },
  { stock_code: "TEST-MSE-004", stock_name: "Test Mouse Optical",    category: "Peripherals", sub_category: "Input Devices", unit_of_measure: "Units", opening_quantity: 45, min_stock_level: 10, location: "Warehouse B", description: "Test mouse for bulk upload" },
  { stock_code: "TEST-CAB-005", stock_name: "Test HDMI Cable 2m",    category: "Cables",      sub_category: "Video Cables",   unit_of_measure: "Pieces", opening_quantity: 100, min_stock_level: 20, location: "Warehouse C", description: "HDMI 2.0 cable test" },
  { stock_code: "TEST-UPS-006", stock_name: "Test UPS 650VA",        category: "Power",       sub_category: "UPS",            unit_of_measure: "Units", opening_quantity: 8, min_stock_level: 2, location: "Data Centre", description: "UPS test item" },
  // Row with intentional data issues (AI self-healing should fix)
  { stock_code: "test-net-007", stock_name: "TEST SWITCH 24PORT",    category: "networking",  sub_category: "Switches",       unit_of_measure: "units", opening_quantity: "10", min_stock_level: "2", location: "Network Room", description: "Switch with case issues" },
  { stock_code: "TEST-HDD-008", stock_name: "Test Hard Drive 1TB",   category: "Storage",     sub_category: "Hard Drives",    unit_of_measure: "Units", opening_quantity: 20, min_stock_level: 5, location: "Warehouse A", description: "HDD test" },
  // Row with missing required field (will fail)
  { stock_code: "", stock_name: "Invalid Row No Code", category: "Electronics", sub_category: "", unit_of_measure: "Units", opening_quantity: 5, min_stock_level: 1, location: "", description: "This row has no stock code" },
  // Another valid row
  { stock_code: "TEST-PRN-009", stock_name: "Test Inkjet Printer",   category: "Office Equipment", sub_category: "Printers", unit_of_measure: "Units", opening_quantity: 12, min_stock_level: 3, location: "Warehouse B", description: "Inkjet printer for testing" },
];

const wsStocks = XLSX.utils.json_to_sheet(stockRows, {
  header: ["stock_code", "stock_name", "category", "sub_category", "unit_of_measure", "opening_quantity", "min_stock_level", "location", "description"],
});
const wbStocks = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbStocks, wsStocks, "Stocks");
const stocksBuf = XLSX.write(wbStocks, { type: "buffer", bookType: "xlsx" });
writeFileSync(join(DATA_DIR, "test-stocks-upload.xlsx"), stocksBuf);
console.log("✓ Generated: data/test-stocks-upload.xlsx  (10 rows: 8 valid, 1 auto-correct, 1 error)");

// ─── Stocks Upload — Clean File (all valid) ────────────────────────────────────

const cleanStockRows = [
  { stock_code: "CLEAN-001", stock_name: "Clean Test Item A", category: "Electronics", sub_category: "General", unit_of_measure: "Units", opening_quantity: 20, min_stock_level: 5, location: "Warehouse A", description: "Clean test stock 1" },
  { stock_code: "CLEAN-002", stock_name: "Clean Test Item B", category: "Stationery", sub_category: "Pens", unit_of_measure: "Pieces", opening_quantity: 500, min_stock_level: 100, location: "Store Room 1", description: "Clean test stock 2" },
  { stock_code: "CLEAN-003", stock_name: "Clean Test Item C", category: "Safety Equipment", sub_category: "PPE", unit_of_measure: "Sets", opening_quantity: 50, min_stock_level: 15, location: "Warehouse B", description: "Clean test stock 3" },
];
const wsClean = XLSX.utils.json_to_sheet(cleanStockRows, { header: Object.keys(cleanStockRows[0]) });
const wbClean = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbClean, wsClean, "Stocks");
const cleanBuf = XLSX.write(wbClean, { type: "buffer", bookType: "xlsx" });
writeFileSync(join(DATA_DIR, "test-stocks-clean.xlsx"), cleanBuf);
console.log("✓ Generated: data/test-stocks-clean.xlsx   (3 rows: all valid, no errors expected)");

// ─── Distributions Upload Test File ───────────────────────────────────────────
// These use stock codes from the seed data (LAP-001, MON-001, etc.)

const distRows = [
  // Valid rows referencing seeded stocks
  { stock_code: "LAP-001", qty_requested: 2, distribution_date: new Date().toISOString().slice(0, 10), recipient_type: "employee", recipient_id: "EMP-TEST-001", recipient_name: "Test Employee One", location: "Head Office", purpose: "New employee onboarding" },
  { stock_code: "MON-001", qty_requested: 1, distribution_date: new Date().toISOString().slice(0, 10), recipient_type: "employee", recipient_id: "EMP-TEST-002", recipient_name: "Test Employee Two", location: "Branch A", purpose: "Workstation setup" },
  { stock_code: "KB-001",  qty_requested: 3, distribution_date: new Date().toISOString().slice(0, 10), recipient_type: "project", recipient_id: "PROJ-2024-001", recipient_name: "Project Alpha Team", location: "Head Office", purpose: "Project equipment" },
  { stock_code: "MSE-001", qty_requested: 5, distribution_date: new Date().toISOString().slice(0, 10), recipient_type: "employee", recipient_id: "EMP-TEST-003", recipient_name: "Test Employee Three", location: "Warehouse A", purpose: "Replacement request" },
  { stock_code: "CAB-001", qty_requested: 10, distribution_date: new Date().toISOString().slice(0, 10), recipient_type: "project", recipient_id: "PROJ-2024-002", recipient_name: "Network Upgrade Project", location: "Network Room", purpose: "Infrastructure upgrade" },
  // Row with auto-correctable issues
  { stock_code: "lap-001", qty_requested: "1", distribution_date: new Date().toISOString().slice(0, 10), recipient_type: "Employee", recipient_id: "EMP-TEST-004", recipient_name: "Test Employee Four", location: "Branch A", purpose: "Replacement" },
  // Row with invalid stock code (will fail)
  { stock_code: "NONEXISTENT-999", qty_requested: 1, distribution_date: new Date().toISOString().slice(0, 10), recipient_type: "employee", recipient_id: "EMP-TEST-005", recipient_name: "Test Employee Five", location: "Head Office", purpose: "Test" },
];

const wsDists = XLSX.utils.json_to_sheet(distRows, {
  header: ["stock_code", "qty_requested", "distribution_date", "recipient_type", "recipient_id", "recipient_name", "location", "purpose"],
});
const wbDists = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbDists, wsDists, "Distributions");
const distsBuf = XLSX.write(wbDists, { type: "buffer", bookType: "xlsx" });
writeFileSync(join(DATA_DIR, "test-distributions-upload.xlsx"), distsBuf);
console.log("✓ Generated: data/test-distributions-upload.xlsx  (7 rows: 5 valid, 1 auto-correct, 1 error)");

// ─── Large stress test file ───────────────────────────────────────────────────

const categories = ["Electronics", "Stationery", "Furniture", "Safety Equipment", "Peripherals", "Cables", "Storage", "Power", "Networking", "Office Equipment"];
const locations = ["Warehouse A", "Warehouse B", "Warehouse C", "Data Centre", "Store Room 1", "Head Office"];
const uoms = ["Units", "Pieces", "Sets", "Boxes", "Kg"];

const largeStockRows = Array.from({ length: 50 }, (_, i) => ({
  stock_code: `STRESS-${String(i + 1).padStart(3, "0")}`,
  stock_name: `Stress Test Item ${i + 1} - ${categories[i % categories.length]}`,
  category: categories[i % categories.length],
  sub_category: "General",
  unit_of_measure: uoms[i % uoms.length],
  opening_quantity: Math.floor(Math.random() * 100) + 10,
  min_stock_level: Math.floor(Math.random() * 10) + 1,
  location: locations[i % locations.length],
  description: `Stress test item ${i + 1} for performance testing`,
}));

const wsLarge = XLSX.utils.json_to_sheet(largeStockRows, { header: Object.keys(largeStockRows[0]) });
const wbLarge = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbLarge, wsLarge, "Stocks");
const largeBuf = XLSX.write(wbLarge, { type: "buffer", bookType: "xlsx" });
writeFileSync(join(DATA_DIR, "test-stocks-large.xlsx"), largeBuf);
console.log("✓ Generated: data/test-stocks-large.xlsx   (50 rows: stress test)");

console.log("\nAll test data files generated in tests/data/");
console.log("Run 'npm test' to execute the API tests.");
