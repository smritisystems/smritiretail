import { container } from "../bootstrap/di.js";
/**
 * @file src/routes/system.ts
 * @description Central system configurations, metadata, layout preferences, audit logs, and tally sync queue endpoints.
 * @module src/routes/system
 *
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.18.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import express from "express";
import fs from "fs";
import path from "path";
import { tallyExportQueue, auditLogs, profiles, ledgerEntries, purchaseOrders, salesOrders, quotations, salesInvoices, salesReturns } from "../state/store.js";
import { logAudit } from "../lib/helpers.js";
import { WorkflowEngine } from "../services/workflowEngine.js";
import { pool } from "../db/pool.js";

const router = express.Router();

// Universal Workflow Transition Endpoint
router.post("/api/workflow/:docType/:id/:action", async (req, res) => {
  const { docType, id, action } = req.params;
  const userRole = (req.headers["x-user-role"] as string) || "Manager";
  const userName = (req.headers["x-user-name"] as string) || "Manager Dev";

  let collection: any[] = [];
  if (docType === "PurchaseOrder") collection = purchaseOrders;
  else if (docType === "SalesOrder") collection = salesOrders;
  else if (docType === "Quotation") collection = quotations;
  else if (docType === "SalesInvoice") collection = salesInvoices;
  else if (docType === "SalesReturn") collection = salesReturns;
  else return res.status(400).json({ error: "Invalid document type" });

  const index = collection.findIndex(doc => doc.id === id);
  if (index === -1) return res.status(404).json({ error: "Document not found" });

  const doc = collection[index];
  
  if (!WorkflowEngine.canTransition(docType as any, doc.status, action, userRole)) {
    return res.status(403).json({ error: "Invalid workflow transition or insufficient permissions." });
  }

  const nextStatus = WorkflowEngine.getNextStatus(docType as any, action);
  doc.status = nextStatus;
  doc.workflowUpdatedAt = new Date().toISOString();
  doc.workflowUpdatedBy = userName;

  await container.state.saveDb();
  res.json({ success: true, status: nextStatus, document: doc });
});


let layoutPreferences = {
  position: "left",
  collapsed: false,
  iconOnly: false,
  sidebarWidth: 260,
  lastWorkspace: "dashboard",
  collapsedGroups: [] as string[],
  favorites: ["pos", "sales"] as string[]
};

// Tally Sync API
router.get("/api/tally/sync-queue", async (req, res) => {
  res.json(tallyExportQueue);
});

// Audit Logs API
router.get("/api/system/audit-logs", async (req, res) => {
  res.json(auditLogs);
});

router.post("/api/system/audit-logs", async (req, res) => {
  try {
    const { actionType, tableName, recordId, oldValue, newValue, reason } = req.body;
    const operator = (req.headers["x-user-name"] as string) || "Report User Dev";
    
    await container.audits.log({
      operator,
      actionType: actionType || "VIEW",
      tableName: tableName || "report",
      recordId: recordId || "none",
      oldValue: oldValue || "None",
      newValue: newValue || "None",
      reason: reason || "Viewed report details"
    });

    logAudit(
      "SYSTEM",
      operator,
      tableName || "report",
      actionType || "VIEW",
      recordId || "none",
      reason || "Viewed report details",
      oldValue || "None",
      newValue || "None"
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Audit Logs Endpoint] Error recording UI audit log:", err);
    res.status(500).json({ error: "Failed to record audit log" });
  }
});

// Metadata API
router.get("/api/metadata", async (req, res) => {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const config = JSON.parse(fs.readFileSync('smriti-config.json', 'utf8'));

    const metadata = {
      app: {
        ...config.app,
        version: pkg.version,
        releaseDate: "2026-07-01",
        buildDate: new Date().toISOString().split('T')[0],
        platformVersion: "Node.js / React 18 / Tailwind v4",
        databaseVersion: "CloudSQL (PostgreSQL 15)",
        apiVersion: "v2.1"
      },
      author: config.author,
      modules: [
        { id: "M01", name: "Core System", version: "v2.1", owner: "Platform Team", description: "Central operating system layout and auth." },
        { id: "M02", name: "Inventory", version: "v1.8", owner: "Supply Chain Team", description: "SKUs, Barcodes, Categories." },
        { id: "M03", name: "Purchasing", version: "v1.9", owner: "Supply Chain Team", description: "PO, GRN, Supplier Management." }
      ]
    };
    res.json(metadata);
  } catch (error) {
    console.error("Error reading system config:", error);
    res.status(500).json({ error: "Failed to load system metadata" });
  }
});

// Changelog API
router.get("/api/changelog", async (req, res) => {
  try {
    const changelogPath = path.resolve("CHANGELOG.md");
    if (fs.existsSync(changelogPath)) {
      const content = fs.readFileSync(changelogPath, "utf8");
      res.header("Content-Type", "text/plain");
      res.send(content);
    } else {
      res.status(404).json({ error: "Changelog file not found" });
    }
  } catch (error) {
    console.error("Error reading CHANGELOG.md:", error);
    res.status(500).json({ error: "Failed to load changelog" });
  }
});

// Layout Engine Preferences API
router.get("/api/layout/preferences", async (req, res) => {
  res.json(layoutPreferences);
});

router.post("/api/layout/preferences", async (req, res) => {
  const prefs = req.body;
  layoutPreferences = {
    position: prefs.position || "left",
    collapsed: typeof prefs.collapsed === "boolean" ? prefs.collapsed : false,
    iconOnly: typeof prefs.iconOnly === "boolean" ? prefs.iconOnly : (typeof prefs.icon_only === "boolean" ? prefs.icon_only : false),
    sidebarWidth: typeof prefs.sidebarWidth === "number" ? prefs.sidebarWidth : (typeof prefs.sidebar_width === "number" ? prefs.sidebar_width : 260),
    lastWorkspace: prefs.lastWorkspace || prefs.last_workspace || "dashboard",
    collapsedGroups: Array.isArray(prefs.collapsedGroups) ? prefs.collapsedGroups : (Array.isArray(prefs.collapsed_groups) ? prefs.collapsed_groups : []),
    favorites: Array.isArray(prefs.favorites) ? prefs.favorites : ["pos", "sales"]
  };
  res.json({ success: true, prefs: layoutPreferences });
});

// Dynamic Company Setup Provisioning Engine
router.post("/api/company/setup", async (req, res) => {
  const { businessInfo, orgStructure, operations, accounting, inventory, pos } = req.body;
  
  logAudit(
    "SYSTEM",
    "Setup wizard",
    "Organization",
    "COMPANY_PROVISION",
    "SMRITI",
    businessInfo?.name || "SMRITI Retail Company",
    null,
    businessInfo
  );

  if (orgStructure && orgStructure.stores) {
    for (const store of orgStructure.stores) {
      if (operations?.modules?.pos !== false) {
        const nextProfileId = "prof-" + (profiles.length + 1);
        profiles.push({
          id: nextProfileId,
          name: `${store.name} Counter A`,
          cashier: "John Cashier",
          warehouse: `${store.name} WH`,
          branch: store.name || "HQ Store",
          isLocked: false,
          isArchived: false
        });
      }

      if (store.code) {
        const storeCode = store.code.toUpperCase();
        const fy = businessInfo?.financialYear || "2026-2027";
        const companyCode = businessInfo?.gstin ? businessInfo.gstin.slice(2, 12) : "SMRITI_IND";

        const ser1Id = `SER-SI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await pool.query(
          `INSERT INTO document_series (
            id, uuid, name, document_type, module, prefix, suffix, 
            running_length, reset_rule, current_number, last_reset_key, 
            financial_year, company_code, mode, description, is_active, is_deleted, created_at, modified_at
          ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, $7, $8, $9, null, $10, $11, $12, $13, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            ser1Id,
            `${store.name} Sales Invoice`,
            "Retail Invoice",
            "Sales",
            `${storeCode}/INV/{FY}/`,
            "",
            6,
            "Financial Year",
            0,
            fy,
            companyCode,
            "Auto",
            `Invoice series for ${store.name} outlet`
          ]
        );

        const ser2Id = `SER-PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await pool.query(
          `INSERT INTO document_series (
            id, uuid, name, document_type, module, prefix, suffix, 
            running_length, reset_rule, current_number, last_reset_key, 
            financial_year, company_code, mode, description, is_active, is_deleted, created_at, modified_at
          ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, $7, $8, $9, null, $10, $11, $12, $13, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            ser2Id,
            `${store.name} PO`,
            "Purchase Order",
            "Purchase",
            `${storeCode}/PO/{FY}/`,
            "",
            5,
            "Financial Year",
            0,
            fy,
            companyCode,
            "Auto",
            `Purchase order series for ${store.name} procurement`
          ]
        );
      }
    }
  }

  // Provision default print templates & terms clauses
  const companyCode = businessInfo?.gstin ? businessInfo.gstin.slice(2, 12) : "SMRITI_IND";

  await pool.query(
    `INSERT INTO terms_clauses (
      id, uuid, code, title, category, content, status, language, is_active, is_deleted, created_at, modified_at, created_by, updated_by, version
    ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, 'Approved', 'English', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'System', 'System', 1)
     ON CONFLICT (id) DO NOTHING`,
    [
      "CL-GEN-DEFAULT",
      "DEFAULT-SALES-TERMS",
      "Standard Payment Terms",
      "General",
      "All invoices are subject to 100% payment upon delivery or checkout. Thank you for your business!"
    ]
  );

  await pool.query(
    `INSERT INTO terms_defaults (
      id, uuid, level, ref_id, clause_ids, is_active, is_deleted, created_at, modified_at, created_by, updated_by, version
    ) VALUES ($1, uuid_generate_v4()::varchar, 'Company', $2, $3, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'System', 'System', 1)
     ON CONFLICT (id) DO NOTHING`,
    ["DF-COMPANY-DEFAULT", companyCode, '["CL-GEN-DEFAULT"]']
  );

  await pool.query(
    `INSERT INTO print_templates (
      id, uuid, title, label_size, printer_language, printer_family, version, is_active, is_default_size, raw_prn, field_mappings, is_deleted, created_at, modified_at
    ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, 1, true, true, $6, '[]', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [
      "t-default-50x25",
      "Standard 50x25 Thermal Label",
      "50x25",
      "ZPL",
      "Zebra",
      "^XA\\n^FO50,50^A0N,30,30^FD{item_name}^FS\\n^FO50,100^BY2\\n^BCN,60,Y,N,N\\n^FD{barcode}^FS\\n^FO50,180^A0N,25,25^FDMRP: Rs. {mrp}^FS\\n^XZ"
    ]
  );

  await pool.query(
    `INSERT INTO print_profiles (
      id, uuid, name, template_id, printer_ip, printer_port, dpi, copies, label_size, is_default, is_active, is_deleted, created_at, modified_at, version
    ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, 9100, 203, 1, $5, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
     ON CONFLICT (id) DO NOTHING`,
    [
      "p-default",
      "Standard Label Printer Profile",
      "t-default-50x25",
      "192.168.1.150",
      "50x25"
    ]
  );

  if (accounting?.createLedgers !== false) {
    ledgerEntries.push({
      id: "L-SET-" + Date.now() + "1",
      date: new Date().toISOString(),
      account: "Capital Account",
      type: "Credit",
      amount: 1000000,
      referenceId: "SETUP",
      referenceType: "Capital",
      description: "Opening business capital introduced during SMRITI setup wizard",
      balance: 1000000
    });
    if (accounting?.bankName) {
      ledgerEntries.push({
        id: "L-SET-" + Date.now() + "2",
        date: new Date().toISOString(),
        account: `${accounting.bankName} Account`,
        type: "Debit",
        amount: 800000,
        referenceId: "SETUP",
        referenceType: "Capital",
        description: `Opening bank deposit in Account ${accounting.accountNo || "N/A"}`,
        balance: 800000
      });
      ledgerEntries.push({
        id: "L-SET-" + Date.now() + "3",
        date: new Date().toISOString(),
        account: "Cash Account",
        type: "Debit",
        amount: 200000,
        referenceId: "SETUP",
        referenceType: "Capital",
        description: "Cash-in-hand setup balance",
        balance: 200000
      });
    } else {
      ledgerEntries.push({
        id: "L-SET-" + Date.now() + "2",
        date: new Date().toISOString(),
        account: "Cash Account",
        type: "Debit",
        amount: 1000000,
        referenceId: "SETUP",
        referenceType: "Capital",
        description: "Cash-in-hand setup balance",
        balance: 1000000
      });
    }
  }

  await container.state.saveDb();

  res.json({
    success: true,
    message: "Company setup and operational assets provisioned successfully on SMRITI Event Engine.",
    companyCode: businessInfo?.gstin ? businessInfo.gstin.slice(2, 12) : "SMRITI_IND"
  });
});

// 501 Not Implemented stubs for unmigrated/placeholder features to prevent unexplained 404s
router.get("/api/ufe/fields", (req, res) => {
  res.status(501).json({
    status: "Not Implemented",
    message: "Universal Field Engine (UFE) fields API is currently not implemented on the SMRITI backend.",
    code: "SMRITI-501-UFE"
  });
});

router.get("/api/formulas", (req, res) => {
  res.status(501).json({
    status: "Not Implemented",
    message: "Formula Registry formulas API is currently not implemented on the SMRITI backend.",
    code: "SMRITI-501-FORMULA"
  });
});

router.get("/api/psv/parties", (req, res) => {
  res.status(501).json({
    status: "Not Implemented",
    message: "Partner SKU Verification (PSV) parties API is currently not implemented on the SMRITI backend.",
    code: "SMRITI-501-PSV"
  });
});

export default router;
