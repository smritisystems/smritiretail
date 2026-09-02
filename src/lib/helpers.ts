/**
 * @file src/lib/helpers.ts
 * @description Common utility and helper functions for SMRITI Retail OS.
 * @module src/lib/helpers
 *
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import crypto from "crypto";
import { roles, auditLogs, stockLedger } from "../state/store.js";
import { pool } from "../db/pool.js";
import { apiFetchV1 } from "./apiFetchV1.js";

// ==========================================
// SECURE PASSWORD HASHING (HREP COMPLIANT)
// ==========================================

/**
 * Hashes a plaintext password using PBKDF2 with a random salt.
 * Returns format: pbkdf2$sha512$<iterations>$<salt>$<hash>
 */
export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const iterations = 600000;
  const hash = crypto.pbkdf2Sync(password, actualSalt, iterations, 64, "sha512").toString("hex");
  return `pbkdf2$sha512$${iterations}$${actualSalt}$${hash}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash.
 * Supports legacy plaintext passwords for seamless migration.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith("pbkdf2$")) {
    // Legacy plaintext verification fallback
    return password === storedHash;
  }
  const parts = storedHash.split("$");
  if (parts.length !== 5) {
    return false;
  }
  const [, , iterStr, salt, hash] = parts;
  const iterations = parseInt(iterStr, 10);
  const calculated = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return calculated === hash;
}

// ==========================================
// DYNAMIC GST 2.0 PRICE-TIER TAX ENGINE
// ==========================================

export function calculateItemGstRate(category: string, price: number, defaultRate?: number): number {
  const cat = (category || "").trim().toLowerCase();
  if (cat === "apparel" || cat === "footwear" || cat === "clothing") {
    // Under GST 2.0 (effective 22 Sept 2025): ≤₹2,500 -> 5% GST, >₹2,500 -> 18% GST.
    return price <= 2500 ? 5 : 18;
  }
  if (defaultRate !== undefined && [0, 5, 18, 40].includes(defaultRate)) {
    return defaultRate;
  }
  if (cat === "accessories") {
    return 18;
  }
  if (cat === "luxury" || cat === "sin" || cat === "luxury goods") {
    return 40;
  }
  return (defaultRate !== undefined && [0, 5, 18, 40].includes(defaultRate)) ? defaultRate : 18;
}

export type SafeFallbackResult = {
  allowed: boolean;
  message: string;
  suggestions?: string[];
};

export function buildSafeFallback(input: string | null | undefined): SafeFallbackResult {
  const raw = typeof input === "string" ? input.trim() : "";

  if (!raw) {
    return {
      allowed: false,
      message: "I can help with safe alternatives and compliant guidance instead.",
      suggestions: [
        "Ask for a general explanation",
        "Ask for a high-level design",
        "Ask for a safe example that avoids restricted behavior"
      ]
    };
  }

  const normalized = raw.toLowerCase();
  const blockedSignals = [
    "bypass restriction",
    "bypass policy",
    "bypass policies",
    "bypass safeguards",
    "policy controls",
    "circumvent policy",
    "ignore safety rules",
    "disable protections",
    "remove moderation",
    "override controls",
    "override policy"
  ];

  const hits = blockedSignals.filter((signal) => normalized.includes(signal));

  if (hits.length > 0) {
    return {
      allowed: false,
      message: "I can’t assist with requests that try to bypass safeguards or override policy controls. I can help with a compliant alternative instead.",
      suggestions: [
        "Explain the underlying goal in a safe way",
        "Give a compliant design pattern",
        "Provide a neutral version that preserves the intent without violating the rules"
      ]
    };
  }

  return {
    allowed: true,
    message: "I can help with a compliant version of this request.",
    suggestions: [
      "Break the problem into smaller safe steps",
      "Explain the trade-offs clearly",
      "Show a minimal implementation that meets the requirement without violating safeguards"
    ]
  };
}

// ==========================================
// UNIVERSAL DOCUMENT SERIES ENGINE
// ==========================================

export async function allocateVoucherNumber(docType: string, context?: { branch?: string; fy?: string; user?: string; date?: string; authHeader?: string }): Promise<string> {
  try {
    const dbRes = await pool.query(
      `SELECT id FROM document_series 
       WHERE document_type = $1 AND is_deleted = false AND is_active = true 
       LIMIT 1`,
      [docType]
    );

    if (dbRes.rows.length === 0) {
      return docType.substring(0, 3).toUpperCase() + "-" + Date.now();
    }
    const seriesId = dbRes.rows[0].id;

    const payload = {
      branch: context?.branch || "HQ",
      fy: context?.fy || "26-27"
    };

    const data = await apiFetchV1(`/numbering/series/${seriesId}/allocate`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "X-Internal-Service-Key": (typeof process !== "undefined" && process.env?.INTERNAL_SERVICE_KEY) || "",
        ...(context?.authHeader ? { "Authorization": context.authHeader } : {}),
      }
    });

    return data.documentNo;
  } catch (err) {
    console.error("[SMRITI] Failed to allocate voucher number via python-core:", err);
    return docType.substring(0, 3).toUpperCase() + "-" + Date.now();
  }
}

// Device Type Parser Helper
export function parseDeviceType(userAgent: string): "desktop" | "mobile" | "tablet" {
  const ua = (userAgent || "").toLowerCase();
  if (ua.includes("tablet") || ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile"))) {
    return "tablet";
  }
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android") || ua.includes("windows phone")) {
    return "mobile";
  }
  return "desktop";
}

// Reusable Permission Helper
export function hasPermission(req: any, permission: string): boolean {
  const roleName = req?.headers?.["x-user-role"] as string;
  if (!roleName || roleName === "Guest") return false;

  const roleObj = roles.find(r => r.name === roleName);
  if (!roleObj) return false;

  return roleObj.permissions.includes(permission);
}

// Reusable Role Authorization Middleware (Allow-List based)
export const requireRole = (...allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    const role = (req?.headers?.["x-user-role"] as string) || "Guest";
    if (allowedRoles.includes(role)) {
      return next();
    }
    return res.status(403).json({
      error: `Access Denied: Role '${role}' is not authorized to perform this operation.`
    });
  };
};

export function logAudit(userId: any, userName: any, module: any, action: any, targetId: any, targetName: any, oldValue: any, newValue: any) {
  auditLogs.push({
    id: "AUD-" + Date.now().toString() + Math.floor(Math.random()*1000),
    timestamp: new Date().toISOString(),
    userId,
    userName,
    module,
    action,
    targetId,
    targetName,
    oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
    newValue: newValue ? JSON.stringify(newValue) : undefined,
    ipAddress: "127.0.0.1"
  });
}

export async function recordStockMovement(productId: any, productCode: any, productName: any, movementType: any, quantity: any, balanceAfter: any, refDocType: any, refDocId: any, warehouse: any, notes: any, extraArgs: any = {}) {
  const eventId = "STK-" + Date.now().toString() + Math.floor(Math.random()*1000);
  
  const entry = {
    id: eventId,
    timestamp: new Date().toISOString(),
    productId,
    productCode,
    productName,
    movementType, // IN, OUT, ADJUSTMENT, TRANSFER
    quantityIn: movementType === "IN" ? quantity : (movementType === "ADJUSTMENT" && quantity > 0 ? quantity : 0),
    quantityOut: movementType === "OUT" ? Math.abs(quantity) : (movementType === "ADJUSTMENT" && quantity < 0 ? Math.abs(quantity) : 0),
    balanceAfter,
    referenceDocType: refDocType,
    referenceDocId: refDocId,
    warehouse: warehouse || "Main Outlet Retail WH",
    bin: extraArgs.bin || "Default",
    batch: extraArgs.batch || "-",
    serial: extraArgs.serial || "-",
    unitCost: extraArgs.unitCost || 0,
    reason: extraArgs.reason || notes || "-",
    user: extraArgs.user || "System",
    device: extraArgs.device || "POS Terminal 1",
    branch: extraArgs.branch || "HQ",
    sourceModule: extraArgs.sourceModule || refDocType || "System",
    approval: extraArgs.approval || "Auto-Approved",
    remarks: notes || ""
  };
  
  stockLedger.push(entry);

  // Dispatch stock movement to FastAPI backend
  try {
    const smPayload = {
      product_id: productId,
      product_name: productName,
      sku: productCode,
      quantity: quantity,
      movement_type: movementType,
      reference_doc_type: refDocType || null,
      reference_doc_id: refDocId || null,
      warehouse: entry.warehouse,
      bin: entry.bin,
      batch: entry.batch,
      serial: entry.serial,
      unit_cost: entry.unitCost,
      remarks: entry.remarks || entry.reason,
      user: entry.user,
      device: entry.device,
      branch: entry.branch,
      source_module: entry.sourceModule,
      approval: entry.approval,
      id: eventId,
      company_id: extraArgs.company_id || extraArgs.companyId || null,
      branch_id: extraArgs.branch_id || extraArgs.branchId || null,
    };
    await apiFetchV1(`/inventory/stock-movements`, {
      method: "POST",
      body: JSON.stringify(smPayload),
      headers: {
        "X-Internal-Service-Key": (typeof process !== "undefined" && process.env?.INTERNAL_SERVICE_KEY) || "",
      }
    });
  } catch (err) {
    console.error("[SMRITI] Failed to dispatch stock movement to python-core:", err);
  }
}

// Helper to resolve placeholders
export function resolveTermsText(content: string, variables: Record<string, string>): string {
  if (!content) return "";
  let text = content;
  const defaults = {
    InvoiceNo: "INV-TEMP-999",
    CustomerName: "Walk-In Customer",
    SupplierName: "Standard Supplier",
    DueDate: "Immediate",
    Amount: "0.00",
    Date: new Date().toLocaleDateString("en-IN"),
    Store: "HQ Store",
    Branch: "HQ",
    Year: new Date().getFullYear().toString(),
    ...variables
  };

  Object.entries(defaults).forEach(([key, val]) => {
    const regex = new RegExp(`{${key}}`, "g");
    text = text.replace(regex, val);
  });
  return text;
}
