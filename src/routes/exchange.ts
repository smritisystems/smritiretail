// DEPRECATED v3.20.0: Superseded by FastAPI /api/v1/* — not mounted in server.ts. Safe to delete after v3.21.0.

import { container } from "../bootstrap/di.js";
/**
 * @file src/routes/exchange.ts
 * @description Data exchange integration, partner mappings, validation, and logs endpoints.
 * @module src/routes/exchange
 *
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.15.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import express from "express";
import { partnersList, transformationMappings, exchangeLogs, products, tallyExportQueue } from "../state/store.js";
import { calculateItemGstRate, recordStockMovement, hasPermission } from "../lib/helpers.js";

const router = express.Router();

router.get("/api/exchange/partners", async (req, res) => {
  if (!hasPermission(req, "settings.manage")) {
    return res.status(403).json({ error: "Access denied. Action requires 'settings.manage' privilege." });
  }
  const maskedPartners = partnersList.map(p => ({
    ...p,
    apiKey: p.apiKey ? `${p.apiKey.slice(0, 12)}...${p.apiKey.slice(-4)}` : null
  }));
  res.json(maskedPartners);
});

router.post("/api/exchange/partners", async (req, res) => {
  if (!hasPermission(req, "settings.manage")) {
    return res.status(403).json({ error: "Access denied. Action requires 'settings.manage' privilege." });
  }
  const data = req.body;
  const newId = "PRT-" + String(partnersList.length + 1).padStart(2, "0");
  const newPartner = {
    id: newId,
    code: data.code || `PRT-${Date.now().toString().slice(-4)}`,
    name: data.name,
    type: data.type || "Mall",
    communication: data.communication || "CSV",
    schedule: data.schedule || "Daily",
    apiKey: data.apiKey || `smriti_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
    ipAllowlist: data.ipAllowlist || "*",
    allowedBranches: data.allowedBranches || ["MUM"],
    allowedFields: data.allowedFields || ["sku", "barcode", "quantity", "mrp", "sellingPrice"],
    isActive: data.isActive !== false,
    expiryDate: data.expiryDate || "2027-12-31",
    lastSync: "-"
  };
  partnersList.push(newPartner);

  transformationMappings.push({
    partnerId: newId,
    mappings: data.mappings || {
      "SKU": "sku",
      "Barcode": "barcode",
      "Qty": "quantity",
      "MRP": "mrp",
      "Price": "sellingPrice"
    }
  });

  await container.state.saveDb();
  res.status(201).json(newPartner);
});

router.put("/api/exchange/partners/:id", async (req, res) => {
  if (!hasPermission(req, "settings.manage")) {
    return res.status(403).json({ error: "Access denied. Action requires 'settings.manage' privilege." });
  }
  const { id } = req.params;
  const partnerIdx = partnersList.findIndex(p => p.id === id);
  if (partnerIdx === -1) return res.status(404).json({ error: "Partner not found" });

  const data = req.body;
  partnersList[partnerIdx] = {
    ...partnersList[partnerIdx],
    ...data
  };

  if (data.mappings) {
    const mapIdx = transformationMappings.findIndex(m => m.partnerId === id);
    if (mapIdx !== -1) {
      transformationMappings[mapIdx].mappings = data.mappings;
    } else {
      transformationMappings.push({
        partnerId: id,
        mappings: data.mappings
      });
    }
  }

  await container.state.saveDb();

  const maskedPartner = {
    ...partnersList[partnerIdx],
    apiKey: partnersList[partnerIdx].apiKey ? `${partnersList[partnerIdx].apiKey.slice(0, 12)}...${partnersList[partnerIdx].apiKey.slice(-4)}` : null
  };
  res.json(maskedPartner);
});

router.get("/api/exchange/mappings/:partnerId", async (req, res) => {
  if (!hasPermission(req, "settings.manage")) {
    return res.status(403).json({ error: "Access denied. Action requires 'settings.manage' privilege." });
  }
  const { partnerId } = req.params;
  const mapping = transformationMappings.find(m => m.partnerId === partnerId);
  res.json(mapping || { partnerId, mappings: {} });
});

router.get("/api/exchange/logs", async (req, res) => {
  if (!hasPermission(req, "settings.manage")) {
    return res.status(403).json({ error: "Access denied. Action requires 'settings.manage' privilege." });
  }
  res.json(exchangeLogs);
});

router.post("/api/exchange/validate", async (req, res) => {
  const { partnerId, fileName, format, rows, checksum } = req.body;
  const partner = partnersList.find(p => p.id === partnerId);
  if (!partner) return res.status(404).json({ error: "Partner not found" });

  const mappingObj = transformationMappings.find(m => m.partnerId === partnerId);
  const fieldMap = (mappingObj ? mappingObj.mappings : {}) as Record<string, string>;

  const validatedRows: any[] = [];
  const errors: any[] = [];

  const isDuplicate = exchangeLogs.some(log => log.checksum === checksum || (log.fileName === fileName && log.rowCount === rows.length && Math.abs(Date.now() - new Date(log.timestamp).getTime()) < 30000));
  if (isDuplicate) {
    return res.status(400).json({
      error: "Duplicate Export Blocked: This file has already been synchronized or matches a completed transfer checksum.",
      errorCode: "DUPLICATE_BLOCK"
    });
  }

  if (partner.gstin) {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(partner.gstin)) {
      errors.push({
        row: 0,
        column: "Partner Metadata",
        message: `Statutory Error: Invalid Partner GSTIN format: '${partner.gstin}'. Standard format must match Indian GST Rules.`
      });
    }
  }

  rows.forEach((row: any, index: number) => {
    const rIdx = index + 1;
    let hasRowError = false;
    let rowErrorMsg = "";

    const mappedRow: Record<string, any> = {};
    Object.entries(row).forEach(([partnerCol, val]) => {
      const smritiCol = fieldMap[partnerCol];
      if (smritiCol) {
        mappedRow[smritiCol] = val;
      } else {
        mappedRow[partnerCol] = val;
      }
    });

    const sku = mappedRow["sku"];
    const qty = parseFloat(mappedRow["quantity"]);
    const barcode = mappedRow["barcode"];
    const taxRate = mappedRow["taxRate"];
    const hsnCode = mappedRow["hsnCode"];
    const mrp = parseFloat(mappedRow["mrp"]) || 0;
    const sellingPrice = parseFloat(mappedRow["sellingPrice"]) || parseFloat(mappedRow["costPrice"]) || 0;
    const discount = parseFloat(mappedRow["discount"]) || 0;
    const dateVal = mappedRow["date"] || mappedRow["expiryDate"];

    if (sku === "SKU-UNKNOWN-99" || !sku) {
      hasRowError = true;
      rowErrorMsg = `Unknown SKU product catalog reference: '${sku || "EMPTY"}'`;
      errors.push({ row: rIdx, column: "Item Code/SKU", message: rowErrorMsg });
    }

    if (isNaN(qty)) {
      hasRowError = true;
      rowErrorMsg = "Quantity value must be a valid number";
      errors.push({ row: rIdx, column: "Sales Qty", message: rowErrorMsg });
    } else if (qty < 0) {
      hasRowError = true;
      rowErrorMsg = `Negative sales qty is not allowed: ${qty}`;
      errors.push({ row: rIdx, column: "Sales Qty", message: rowErrorMsg });
    }

    if (partner.type === "Mall" && !barcode && sku !== "SKU-UNKNOWN-99") {
      hasRowError = true;
      rowErrorMsg = "Mall authority transaction requires active barcode identifier";
      errors.push({ row: rIdx, column: "Barcode", message: rowErrorMsg });
    }

    if (taxRate !== undefined && taxRate !== null && taxRate !== "") {
      const rateNum = parseFloat(taxRate);
      const standardSlabs = [0, 5, 18, 40];
      if (isNaN(rateNum) || !standardSlabs.includes(rateNum)) {
        hasRowError = true;
        rowErrorMsg = `Invalid GST rate structure: '${taxRate}%'. Indian statutory standard GST 2.0 slab rates are 0%, 5%, 18%, or 40%.`;
        errors.push({ row: rIdx, column: "GST Tax Rate", message: rowErrorMsg });
      }
    }

    if (mrp > 0 && sellingPrice > 0) {
      const reconciledSum = sellingPrice + discount;
      if (Math.abs(reconciledSum - mrp) > 1.01) {
        hasRowError = true;
        rowErrorMsg = `Financial discrepancy: Selling/Cost Price (₹${sellingPrice.toFixed(2)}) + Discount (₹${discount.toFixed(2)}) does not equal MRP (₹${mrp.toFixed(2)}) within allowable ₹1.00 margin.`;
        errors.push({ row: rIdx, column: "Price / MRP Reconcile", message: rowErrorMsg });
      }
    }

    if (hsnCode) {
      const hsnStr = String(hsnCode).trim();
      if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(hsnStr)) {
        hasRowError = true;
        rowErrorMsg = `Invalid HSN/SAC format: '${hsnStr}'. Under Indian GST, HSN must be a 4, 6, or 8-digit numeric code.`;
        errors.push({ row: rIdx, column: "HSN Code", message: rowErrorMsg });
      }
    }

    if (dateVal) {
      const transDate = new Date(dateVal);
      const financialYearStart = new Date("2026-04-01");
      if (!isNaN(transDate.getTime()) && transDate < financialYearStart) {
        hasRowError = true;
        rowErrorMsg = `Period Locked: Transaction date (${dateVal}) falls prior to current active Financial Year 2026-2027 starting 2026-04-01.`;
        errors.push({ row: rIdx, column: "Period Lock / FY Date", message: rowErrorMsg });
      }
    }

    validatedRows.push({
      ...row,
      __mapped: mappedRow,
      __error: hasRowError ? rowErrorMsg : undefined
    });
  });

  res.json({
    checksum: checksum || "sha256-sim-" + Math.random().toString(36).substring(2, 12),
    rowCount: rows.length,
    successCount: rows.length - errors.length,
    errorCount: errors.length,
    errors,
    rows: validatedRows
  });
});

router.post("/api/exchange/commit", async (req, res) => {
  const { partnerId, fileName, format, rows, checksum } = req.body;
  const partner = partnersList.find(p => p.id === partnerId);
  if (!partner) return res.status(404).json({ error: "Partner not found" });

  const mappingObj = transformationMappings.find(m => m.partnerId === partnerId);
  const fieldMap = mappingObj ? mappingObj.mappings : {};

  const successfulRows = rows.filter((r: any) => !r.__error);

  successfulRows.forEach((row: any) => {
    const mapped = row.__mapped || {};
    const sku = mapped.sku;
    const qty = parseFloat(mapped.quantity) || 0;
    const store = mapped.storeId || partner.allowedBranches[0] || "HQ";

    let prod = products.find(p => p.code === sku || p.barcode === mapped.barcode);
    if (!prod) {
      const nextId = "p_auto_" + (products.length + 1);
      prod = {
        id: nextId,
        code: sku || "SKU-AUTO",
        name: mapped.name || `Imported Item (${sku})`,
        price: parseFloat(mapped.mrp) || 999,
        stock: 100,
        category: "Imported",
        barcode: mapped.barcode || `BAR-${sku}-${Date.now()}`
      };
      products.push(prod);
    }

    const movementType = partner.type === "Distributor" ? "IN" : "OUT";
    const balanceAfter = movementType === "IN" ? prod.stock + qty : prod.stock - qty;
    prod.stock = balanceAfter;

    recordStockMovement(
      prod.id,
      prod.code,
      prod.name,
      movementType,
      qty,
      balanceAfter,
      partner.type === "Distributor" ? "PurchaseInvoice" : "SalesInvoice",
      checksum || `EX-${Date.now()}`,
      store === "BLR" ? "Bengaluru Retail Outlet WH" : "Main Outlet Retail WH",
      `SMRITI Data Exchange import from ${partner.name}`,
      { branch: store, user: (req.headers["x-user-name"] as string) || "Operator Dev" }
    );
  });

  if (partner.type !== "Mall" && successfulRows.length > 0) {
    const totalAmount = successfulRows.reduce((acc: number, row: any) => {
      const m = row.__mapped || {};
      const qty = parseFloat(m.quantity) || 0;
      const price = parseFloat(m.sellingPrice) || parseFloat(m.costPrice) || parseFloat(m.mrp) || 0;
      return acc + (qty * price);
    }, 0);

    tallyExportQueue.push({
      id: "TEQ-INT-" + Date.now() + Math.floor(Math.random() * 1000),
      type: partner.type === "Distributor" ? "PurchaseInvoice" : "SalesInvoice",
      eventId: checksum || `EX-${Date.now()}`,
      status: "Pending",
      payload: {
        partnerId,
        partnerName: partner.name,
        gstin: partner.gstin,
        companyCode: "SMRITI_IND",
        voucherNumber: "VCH-" + Date.now().toString().slice(-6),
        voucherType: partner.type === "Distributor" ? "Purchase" : "Sales",
        totalAmount,
        currency: "INR",
        itemsCount: successfulRows.length,
        version: "1.0.0",
        items: successfulRows.map((r: any) => {
          const m = r.__mapped || {};
          const qty = parseFloat(m.quantity) || 0;
          const price = parseFloat(m.sellingPrice) || parseFloat(m.costPrice) || parseFloat(m.mrp) || 0;
          const matchedProd = products.find(p => p.code === m.sku);
          const category = matchedProd ? matchedProd.category : "Apparel";
          const taxRate = calculateItemGstRate(category, price, parseFloat(m.taxRate) || undefined);
          const discount = parseFloat(m.discount) || 0;
          const subtotal = (qty * price) - discount;

          const store = m.storeId || partner.allowedBranches[0] || "HQ";
          const storeState = store === "BLR" ? "29" : "27";
          const partnerState = partner.stateCode || "27";

          let cgst = 0, sgst = 0, igst = 0;
          if (storeState === partnerState) {
            cgst = (subtotal * (taxRate / 2)) / 100;
            sgst = (subtotal * (taxRate / 2)) / 100;
          } else {
            igst = (subtotal * taxRate) / 100;
          }

          return {
            sku: m.sku,
            qty,
            rate: price,
            discount,
            taxRate,
            cgst,
            sgst,
            igst,
            netAmount: subtotal + cgst + sgst + igst,
            hsnCode: m.hsnCode || "6109"
          };
        })
      }
    });
  }

  const newLogId = "EXLOG-" + String(exchangeLogs.length + 1).padStart(3, "0");
  const newLog = {
    id: newLogId,
    partnerId,
    partnerName: partner.name,
    timestamp: new Date().toISOString(),
    direction: "Inbound",
    format: format || "CSV",
    fileName: fileName || "Interactive_Web_Import.csv",
    rowCount: rows.length,
    successCount: successfulRows.length,
    errorCount: rows.length - successfulRows.length,
    errors: rows.filter((r: any) => r.__error).map((r: any, idx: number) => ({
      row: idx + 1,
      column: "Validation Check",
      message: r.__error
    })),
    status: partner.type === "Mall" ? "Pending Approval" : "Success",
    importedBy: (req.headers["x-user-name"] as string) || "Operator Dev",
    approvedBy: partner.type === "Mall" ? "-" : "System Auto-Approved",
    checksum: checksum || `sha256-sim-${Date.now()}`,
    rowsData: rows
  };

  exchangeLogs.push(newLog);
  partner.lastSync = new Date().toISOString();
  await container.state.saveDb();

  res.status(201).json({
    success: true,
    logId: newLogId,
    status: newLog.status,
    message: newLog.status === "Pending Approval" 
      ? "Consignment validation completed. File locked and pending Manager Approval."
      : "Stock Ledger synchronized & transaction dispatched to Tally XML export queue."
  });
});

router.post("/api/exchange/approve-log/:id", async (req, res) => {
  if (!hasPermission(req, "settings.manage")) {
    return res.status(403).json({ error: "Access denied. Action requires 'settings.manage' privilege." });
  }
  const { id } = req.params;
  const log = exchangeLogs.find(l => l.id === id);
  if (!log) return res.status(404).json({ error: "Log reference not found" });

  const partner = partnersList.find(p => p.id === log.partnerId);
  if (!partner) return res.status(404).json({ error: "Partner reference missing" });

  log.status = "Success";
  log.approvedBy = (req.headers["x-user-name"] as string) || "Store Manager Dev";

  const successfulRows = (log.rowsData || []).filter((r: any) => !r.__error);
  successfulRows.forEach((row: any) => {
    const mapped = row.__mapped || {};
    const sku = mapped.sku;
    const qty = parseFloat(mapped.quantity) || 0;
    const store = mapped.storeId || partner.allowedBranches[0] || "HQ";

    let prod = products.find(p => p.code === sku || p.barcode === mapped.barcode);
    if (!prod) {
      const nextId = "p_auto_" + (products.length + 1);
      prod = {
        id: nextId,
        code: sku || "SKU-AUTO",
        name: mapped.name || `Imported Item (${sku})`,
        price: parseFloat(mapped.mrp) || 999,
        stock: 100,
        category: "Imported",
        barcode: mapped.barcode || `BAR-${sku}-${Date.now()}`
      };
      products.push(prod);
    }

    const movementType = "OUT";
    const balanceAfter = prod.stock - qty;
    prod.stock = balanceAfter;

    recordStockMovement(
      prod.id,
      prod.code,
      prod.name,
      movementType,
      qty,
      balanceAfter,
      "SalesInvoice",
      log.checksum || `EX-APP-${Date.now()}`,
      store === "BLR" ? "Bengaluru Retail Outlet WH" : "Main Outlet Retail WH",
      `Consignment Sales Approved by Manager for log: ${log.id}`,
      { branch: store, user: log.approvedBy }
    );
  });

  if (successfulRows.length > 0) {
    const totalAmount = successfulRows.reduce((acc: number, row: any) => {
      const m = row.__mapped || {};
      const qty = parseFloat(m.quantity) || 0;
      const price = parseFloat(m.sellingPrice) || parseFloat(m.mrp) || 0;
      return acc + (qty * price);
    }, 0);

    tallyExportQueue.push({
      id: "TEQ-INT-" + Date.now() + Math.floor(Math.random() * 1000),
      type: "SalesInvoice",
      eventId: log.checksum || `EX-${Date.now()}`,
      status: "Pending",
      payload: {
        partnerId: log.partnerId,
        partnerName: partner.name,
        gstin: partner.gstin,
        companyCode: "SMRITI_IND",
        voucherNumber: "VCH-" + Date.now().toString().slice(-6),
        voucherType: "Sales",
        totalAmount,
        currency: "INR",
        itemsCount: successfulRows.length,
        version: "1.0.0",
        items: successfulRows.map((r: any) => {
          const m = r.__mapped || {};
          const qty = parseFloat(m.quantity) || 0;
          const price = parseFloat(m.sellingPrice) || parseFloat(m.mrp) || 0;
          const matchedProd = products.find(p => p.code === m.sku);
          const category = matchedProd ? matchedProd.category : "Apparel";
          const taxRate = calculateItemGstRate(category, price, parseFloat(m.taxRate) || undefined);
          const discount = parseFloat(m.discount) || 0;
          const subtotal = (qty * price) - discount;

          const store = m.storeId || partner.allowedBranches[0] || "HQ";
          const storeState = store === "BLR" ? "29" : "27";
          const partnerState = partner.stateCode || "27";

          let cgst = 0, sgst = 0, igst = 0;
          if (storeState === partnerState) {
            cgst = (subtotal * (taxRate / 2)) / 100;
            sgst = (subtotal * (taxRate / 2)) / 100;
          } else {
            igst = (subtotal * taxRate) / 100;
          }

          return {
            sku: m.sku,
            qty,
            rate: price,
            discount,
            taxRate,
            cgst,
            sgst,
            igst,
            netAmount: subtotal + cgst + sgst + igst,
            hsnCode: m.hsnCode || "6109"
          };
        })
      }
    });
  }

  await container.state.saveDb();
  res.json({ success: true, log });
});

export default router;
