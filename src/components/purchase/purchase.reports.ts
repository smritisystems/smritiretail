/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Studio — Report Registry Definitions (URR-001)
 * Standard     : URR Standard v1.0 — Metadata-Driven Reports Only
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0  (Sprint 5 Wave 2)
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (URR-001):
 *   All report definitions MUST be declared in ReportRegistry (SPK.reports).
 *   No handcrafted report tables or custom data-fetch loops in UI components.
 *
 * REPORTS DECLARED HERE:
 *   rep.purchase_order_register   — Purchase Order Register
 *   rep.purchase_grn_register     — Goods Receipt (GRN) Register
 *   rep.supplier_ledger           — Supplier Ledger & Payables
 *   rep.purchase_return_register  — Purchase Return Register
 *   rep.purchase_gst_input_credit — GST Input Tax Credit Report
 */

import { ReportRegistry } from "../../kernel/upr/reports/ReportRegistry.js";

export function registerPurchaseReports(): void {

  // ── 1. Purchase Order Register ────────────────────────────────────────────
  ReportRegistry.registerReport({
    id:          "rep.purchase_order_register",
    name:        "Purchase Order Register",
    description: "Complete register of all purchase orders with status, supplier, and value",
    category:    "purchase",
    entityId:    "purchase_order",
    permissionId: "purchase.order.read",
    exportFormats: ["excel", "pdf", "csv", "json"],
    parameters: [
      { id: "startDate",   label: "From Date",   type: "date",   required: true },
      { id: "endDate",     label: "To Date",     type: "date",   required: true },
      { id: "supplierId",  label: "Supplier",    type: "select", required: false },
      { id: "status",      label: "PO Status",   type: "select", required: false, defaultValue: "all" },
    ],
    columns: [
      { id: "poNumber",       label: "PO Number",         dataType: "string",   width: 140 },
      { id: "orderDate",      label: "Order Date",        dataType: "date",     width: 120 },
      { id: "supplierName",   label: "Supplier",          dataType: "string",   width: 220 },
      { id: "status",         label: "Status",            dataType: "string",   width: 110 },
      { id: "totalAmount",    label: "Gross Amount (₹)",  dataType: "currency", align: "right" },
      { id: "totalTaxAmount", label: "GST Amount (₹)",    dataType: "currency", align: "right" },
      { id: "netPayable",     label: "Net Payable (₹)",   dataType: "currency", align: "right" },
    ],
  });

  // ── 2. Goods Receipt (GRN) Register ───────────────────────────────────────
  ReportRegistry.registerReport({
    id:          "rep.purchase_grn_register",
    name:        "Goods Receipt (GRN) Register",
    description: "All goods receipt notes posted against purchase orders with item-level detail",
    category:    "purchase",
    entityId:    "goods_receipt",
    permissionId: "purchase.grn.read",
    exportFormats: ["excel", "pdf", "csv", "json"],
    parameters: [
      { id: "startDate",  label: "From Date", type: "date",   required: true },
      { id: "endDate",    label: "To Date",   type: "date",   required: true },
      { id: "supplierId", label: "Supplier",  type: "select", required: false },
    ],
    columns: [
      { id: "grnNumber",    label: "GRN Number",      dataType: "string",   width: 140 },
      { id: "grnDate",      label: "GRN Date",         dataType: "date",     width: 120 },
      { id: "poNumber",     label: "PO Number",        dataType: "string",   width: 140 },
      { id: "supplierName", label: "Supplier",         dataType: "string",   width: 200 },
      { id: "itemCode",     label: "Item Code",        dataType: "string",   width: 120 },
      { id: "itemName",     label: "Item Description", dataType: "string",   width: 220 },
      { id: "receivedQty",  label: "Received Qty",     dataType: "number",   align: "right" },
      { id: "unitCost",     label: "Unit Cost (₹)",    dataType: "currency", align: "right" },
      { id: "lineValue",    label: "Line Value (₹)",   dataType: "currency", align: "right" },
    ],
  });

  // ── 3. Supplier Ledger & Payables ─────────────────────────────────────────
  ReportRegistry.registerReport({
    id:          "rep.supplier_ledger",
    name:        "Supplier Ledger & Payables",
    description: "Supplier-wise outstanding payable, credit days, and transaction history",
    category:    "purchase",
    entityId:    "supplier_bill",
    permissionId: "purchase.bill.read",
    exportFormats: ["excel", "pdf", "csv", "json"],
    parameters: [
      { id: "startDate",  label: "From Date", type: "date",   required: true },
      { id: "endDate",    label: "To Date",   type: "date",   required: true },
      { id: "supplierId", label: "Supplier",  type: "select", required: false },
    ],
    columns: [
      { id: "supplierCode",  label: "Supplier Code",      dataType: "string",   width: 120 },
      { id: "supplierName",  label: "Supplier Name",      dataType: "string",   width: 220 },
      { id: "billNumber",    label: "Bill / Invoice No",  dataType: "string",   width: 160 },
      { id: "billDate",      label: "Bill Date",          dataType: "date",     width: 120 },
      { id: "dueDate",       label: "Due Date",           dataType: "date",     width: 120 },
      { id: "billAmount",    label: "Bill Amount (₹)",    dataType: "currency", align: "right" },
      { id: "paidAmount",    label: "Paid (₹)",           dataType: "currency", align: "right" },
      { id: "outstanding",   label: "Outstanding (₹)",    dataType: "currency", align: "right" },
      { id: "overdueDays",   label: "Overdue Days",       dataType: "number",   align: "right" },
    ],
  });

  // ── 4. Purchase Return Register ───────────────────────────────────────────
  ReportRegistry.registerReport({
    id:          "rep.purchase_return_register",
    name:        "Purchase Return Register",
    description: "All supplier returns with debit note status and stock reversal details",
    category:    "purchase",
    entityId:    "purchase_return",
    permissionId: "purchase.return.read",
    exportFormats: ["excel", "pdf", "csv", "json"],
    parameters: [
      { id: "startDate",  label: "From Date", type: "date",   required: true },
      { id: "endDate",    label: "To Date",   type: "date",   required: true },
      { id: "supplierId", label: "Supplier",  type: "select", required: false },
    ],
    columns: [
      { id: "returnNumber",  label: "Return No",          dataType: "string",   width: 140 },
      { id: "returnDate",    label: "Return Date",        dataType: "date",     width: 120 },
      { id: "supplierName",  label: "Supplier",           dataType: "string",   width: 200 },
      { id: "poNumber",      label: "Original PO",        dataType: "string",   width: 140 },
      { id: "itemName",      label: "Item",               dataType: "string",   width: 200 },
      { id: "returnQty",     label: "Return Qty",         dataType: "number",   align: "right" },
      { id: "returnValue",   label: "Return Value (₹)",   dataType: "currency", align: "right" },
      { id: "debitNoteNo",   label: "Debit Note No",      dataType: "string",   width: 140 },
    ],
  });

  // ── 5. GST Input Tax Credit Report ───────────────────────────────────────
  ReportRegistry.registerReport({
    id:          "rep.purchase_gst_input_credit",
    name:        "GST Input Tax Credit Report",
    description: "Input tax credit (ITC) available from supplier bills — CGST, SGST, IGST breakdown",
    category:    "purchase",
    entityId:    "supplier_bill",
    permissionId: "purchase.bill.read",
    exportFormats: ["excel", "pdf", "csv", "json"],
    parameters: [
      { id: "startDate",   label: "From Date",    type: "date",   required: true },
      { id: "endDate",     label: "To Date",      type: "date",   required: true },
      { id: "supplierId",  label: "Supplier",     type: "select", required: false },
      { id: "gstRateId",   label: "GST Rate",     type: "select", required: false },
    ],
    columns: [
      { id: "billNumber",   label: "Bill No",        dataType: "string",   width: 150 },
      { id: "billDate",     label: "Bill Date",      dataType: "date",     width: 120 },
      { id: "supplierName", label: "Supplier",       dataType: "string",   width: 200 },
      { id: "gstin",        label: "GSTIN",          dataType: "string",   width: 160 },
      { id: "taxableValue", label: "Taxable (₹)",    dataType: "currency", align: "right" },
      { id: "cgst",         label: "CGST (₹)",       dataType: "currency", align: "right" },
      { id: "sgst",         label: "SGST (₹)",       dataType: "currency", align: "right" },
      { id: "igst",         label: "IGST (₹)",       dataType: "currency", align: "right" },
      { id: "totalItc",     label: "Total ITC (₹)",  dataType: "currency", align: "right" },
    ],
  });
}
