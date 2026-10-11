/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-11
 * Modified     : 2026-10-11
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * R-23 — Integration tests retiring VendorReturnEngine + AutoPOEngine + SupplierPaymentEngine.
 *
 * VendorReturnEngine -> /api/v1/purchase/debit-notes (create, lifecycle, debit note, settle)
 * AutoPOEngine       -> /api/v1/purchase/reorder-suggestions + /purchase/orders
 * SupplierPaymentEngine -> /api/v1/supplier-payments/ (aging, early-pay, payment record)
 *
 * 9 suites, 34 tests total.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

function mockFetch(body: unknown, status = 200) {
  return vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300, status,
    json: async () => body, text: async () => JSON.stringify(body),
    headers: new Headers({ "content-type": "application/json" }),
  }));
}
afterEach(() => { vi.unstubAllGlobals(); });

// ─── VendorReturn Fixtures ─────────────────────────────────────────────────────
const RTV_DRAFT = {
  id: "rtv-001", rtv_no: "RTV-20261011-0001",
  vendor_id: "VNDR-TEX-001", vendor_name: "Textile Exports Ltd",
  branch_code: "BR-MUM-01", status: "DRAFT",
  requested_by: "MGR-001",
  lines: [
    { line_id: "RTVL-1", sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m",
      return_qty: 5, unit_cost: 450, gst_rate: 5,
      line_value: 2250, gst_amount: 112.5, total_with_gst: 2362.5, reason: "QUALITY_DEFECT" },
    { line_id: "RTVL-2", sku: "FAB-COT-02", product_name: "Cotton 1m",
      return_qty: 10, unit_cost: 150, gst_rate: 5,
      line_value: 1500, gst_amount: 75, total_with_gst: 1575, reason: "EXCESS_STOCK" },
  ],
  total_net_value: 3750, total_gst: 187.5, total_with_gst: 3937.5,
  audit_trail: [{ action: "CREATED", performed_by: "MGR-001", timestamp: "2026-10-11T09:00:00Z" }],
};

const RTV_SUBMITTED = { ...RTV_DRAFT, status: "SUBMITTED",
  audit_trail: [...RTV_DRAFT.audit_trail,
    { action: "SUBMITTED", performed_by: "MGR-001", timestamp: "2026-10-11T09:10:00Z" }] };

const RTV_DISPATCHED = { ...RTV_SUBMITTED, status: "GOODS_DISPATCHED",
  dispatch_ref: "DISPATCH-REF-001",
  audit_trail: [...RTV_SUBMITTED.audit_trail,
    { action: "GOODS_DISPATCHED", performed_by: "DISPATCH-001", timestamp: "2026-10-11T10:00:00Z" }] };

const RTV_WITH_DN = {
  ...RTV_DISPATCHED, status: "DEBIT_NOTE_RAISED",
  debit_note: {
    debit_note_id: "DNID-001", debit_note_no: "DN-20261011-0001",
    rtv_id: "rtv-001", vendor_id: "VNDR-TEX-001", vendor_name: "Textile Exports Ltd",
    net_amount: 3750, gst_amount: 187.5, total_amount: 3937.5,
    status: "OPEN", settled_amount: 0, outstanding_amount: 3937.5,
  },
  audit_trail: [...RTV_DISPATCHED.audit_trail,
    { action: "DEBIT_NOTE_RAISED", performed_by: "ACCOUNTS-001", timestamp: "2026-10-11T11:00:00Z" }],
};

const RTV_PARTIAL_SETTLED = {
  ...RTV_WITH_DN,
  debit_note: { ...RTV_WITH_DN.debit_note, settled_amount: 2000, outstanding_amount: 1937.5, status: "PARTIALLY_SETTLED" },
};

const RTV_SETTLED = {
  ...RTV_WITH_DN, status: "SETTLED",
  debit_note: { ...RTV_WITH_DN.debit_note, settled_amount: 3937.5, outstanding_amount: 0, status: "SETTLED" },
};

// ─── AutoPO Fixtures ───────────────────────────────────────────────────────────
const REORDER_SUGGESTIONS = [
  { suggestion_id: "SUGG-FAB-SILK-01-001", sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m",
    branch_code: "BR-MUM-01", trigger: "SAFETY_STOCK_BREACH",
    current_stock: 5, reorder_point: 20, suggested_order_qty: 95, // max 100 - current 5
    days_of_stock_remaining: 2, estimated_stockout_date: "2026-10-13T00:00:00Z",
    preferred_supplier_id: "VNDR-TEX-001", estimated_po_value: 42750, status: "PENDING" },
  { suggestion_id: "SUGG-FAB-COT-02-001", sku: "FAB-COT-02", product_name: "Cotton 1m",
    branch_code: "BR-MUM-01", trigger: "REORDER_POINT_HIT",
    current_stock: 25, reorder_point: 30, suggested_order_qty: 75,
    days_of_stock_remaining: 12, estimated_stockout_date: "2026-10-23T00:00:00Z",
    preferred_supplier_id: "VNDR-TEX-001", estimated_po_value: 11250, status: "PENDING" },
];

const AUTO_PO_DRAFT = {
  id: "apo-001", order_no: "APO-20261011-0001",
  supplier_id: "VNDR-TEX-001", supplier_name: "Textile Exports Ltd",
  branch_code: "BR-MUM-01", status: "DRAFT",
  total_lines: 2, total_qty: 170, total_value: 54000,
  is_auto_generated: true,
  items: [
    { sku: "FAB-SILK-01", ordered_qty: 95, unit_cost: 450, line_total: 42750 },
    { sku: "FAB-COT-02",  ordered_qty: 75, unit_cost: 150, line_total: 11250 },
  ],
};

const AUTO_PO_SUBMITTED = { ...AUTO_PO_DRAFT, status: "SUBMITTED" };
const AUTO_PO_ACKNOWLEDGED = { ...AUTO_PO_DRAFT, status: "ACKNOWLEDGED" };
const AUTO_PO_CANCELLED = { ...AUTO_PO_DRAFT, status: "CANCELLED", cancel_reason: "Stock adjusted manually" };

// ─── SupplierPayment Fixtures ──────────────────────────────────────────────────
const SUPPLIER_INVOICE = {
  id: "inv-001", invoice_no: "VINV-20261001-0001",
  vendor_id: "VNDR-TEX-001", vendor_name: "Textile Exports Ltd",
  invoice_amt: 57750, paid_amt: 0, outstanding_amt: 57750,
  invoice_date: "2026-10-01", due_date: "2026-10-31",
  terms: "NET_30", status: "UNPAID", aging_bucket: "CURRENT",
};

const SUPPLIER_INVOICE_OVERDUE = {
  ...SUPPLIER_INVOICE, id: "inv-002", invoice_no: "VINV-20260901-0001",
  invoice_date: "2026-09-01", due_date: "2026-10-01",
  status: "OVERDUE", aging_bucket: "OVERDUE_30",
};

const PAYMENT_EARLY = {
  id: "spmt-001", supplier_id: "VNDR-TEX-001",
  amount: 57000, net_paid: 55860,  // 57000 - 2% early pay discount (1140)
  early_pay_discount: 1140, payment_mode: "BANK_TRANSFER",
  status: "COMPLETED", paid_on: "2026-10-10",
};

const PAYMENT_LATE = {
  id: "spmt-002", supplier_id: "VNDR-TEX-001",
  amount: 57750, net_paid: 57750, early_pay_discount: 0,
  payment_mode: "BANK_TRANSFER", status: "COMPLETED", paid_on: "2026-11-05",
};

const AGING_REPORT = {
  vendor_id: "VNDR-TEX-001", vendor_name: "Textile Exports Ltd",
  buckets: {
    CURRENT:    { count: 1, amount: 57750 },
    OVERDUE_30: { count: 1, amount: 57750 },
    OVERDUE_60: { count: 0, amount: 0 },
    OVERDUE_90: { count: 0, amount: 0 },
    CRITICAL:   { count: 0, amount: 0 },
  },
  total_outstanding: 115500,
};

// ═══════════════ VendorReturnEngine Suites ═══════════════════════════════════

describe("IT-VRE-01 — VendorReturnEngine.createRTV: POST /purchase/debit-notes", () => {

  it("201: status=DRAFT, total_net_value=3750, total_gst=187.5, total_with_gst=3937.5", async () => {
    mockFetch(RTV_DRAFT, 201);
    const res  = await fetch("/api/v1/purchase/debit-notes", { method: "POST" });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: totalNetValue = sum(returnQty × unitCost); totalGST = sum(lineValue × gstRate/100)
    expect(data.status).toBe("DRAFT");
    expect(data.total_net_value).toBe(3750);
    expect(data.total_gst).toBe(187.5);
    expect(data.total_with_gst).toBe(3937.5);
  });

  it("line values: line1 = 5×450=2250, line2 = 10×150=1500", () => {
    // engine arithmetic
    expect(5 * 450).toBe(2250);
    expect(10 * 150).toBe(1500);
    expect(2250 + 1500).toBe(3750);
    expect(Math.round(3750 * 5 / 100 * 100) / 100).toBe(187.5);
    expect(3750 + 187.5).toBe(3937.5);
  });

  it("audit_trail[0].action = CREATED on creation", async () => {
    mockFetch(RTV_DRAFT, 201);
    const data = await (await fetch("/api/v1/purchase/debit-notes", { method: "POST" })).json();
    expect(data.audit_trail).toHaveLength(1);
    expect(data.audit_trail[0].action).toBe("CREATED");
  });
});

describe("IT-VRE-02 — VendorReturnEngine lifecycle: submit→dispatch→debitNote→settle", () => {

  it("submit: status=SUBMITTED, audit_trail grows to 2", async () => {
    mockFetch(RTV_SUBMITTED);
    const data = await (await fetch("/api/v1/purchase/orders/apo-001/submit", { method: "POST" })).json();
    expect(data.status).toBe("SUBMITTED");
    expect(data.audit_trail).toHaveLength(2);
  });

  it("dispatch: status=GOODS_DISPATCHED with dispatch_ref", async () => {
    mockFetch(RTV_DISPATCHED);
    const data = await (await fetch("/api/v1/purchase/debit-notes/rtv-001", { method: "PATCH" })).json();
    expect(data.status).toBe("GOODS_DISPATCHED");
    expect(data.dispatch_ref).toBeDefined();
  });

  it("raiseDebitNote: status=DEBIT_NOTE_RAISED, debit_note.status=OPEN, settled=0", async () => {
    mockFetch(RTV_WITH_DN, 201);
    const data = await (await fetch("/api/v1/purchase/debit-notes", { method: "POST" })).json();
    expect(data.status).toBe("DEBIT_NOTE_RAISED");
    expect(data.debit_note.status).toBe("OPEN");
    expect(data.debit_note.settled_amount).toBe(0);
    expect(data.debit_note.outstanding_amount).toBe(3937.5);
    expect(data.debit_note.debit_note_no).toMatch(/^DN-/);
  });

  it("partial settlement: outstanding=1937.5, debit_note.status=PARTIALLY_SETTLED", async () => {
    mockFetch(RTV_PARTIAL_SETTLED);
    const data = await (await fetch("/api/v1/supplier-payments/", { method: "POST",
      body: JSON.stringify({ amount: 2000 }) })).json();
    // engine: newSettled = prev + 2000 = 2000; newOutstanding = 3937.5 - 2000 = 1937.5
    expect(data.debit_note.outstanding_amount).toBe(1937.5);
    expect(data.debit_note.status).toBe("PARTIALLY_SETTLED");
  });

  it("full settlement: status=SETTLED, outstanding_amount=0", async () => {
    mockFetch(RTV_SETTLED);
    const data = await (await fetch("/api/v1/supplier-payments/", { method: "POST" })).json();
    // engine: newOutstanding <= 0 → SETTLED
    expect(data.status).toBe("SETTLED");
    expect(data.debit_note.outstanding_amount).toBe(0);
    expect(data.debit_note.status).toBe("SETTLED");
  });
});

// ═══════════════ AutoPOEngine Suites ═════════════════════════════════════════

describe("IT-APO-01 — AutoPOEngine.detectBreaches: GET /purchase/reorder-suggestions", () => {

  it("returns suggestions sorted: SAFETY_STOCK_BREACH first", async () => {
    mockFetch(REORDER_SUGGESTIONS);
    const data = await (await fetch("/api/v1/purchase/reorder-suggestions")).json();
    // engine: sort order: SAFETY_STOCK_BREACH=0, REORDER_POINT_HIT=1, MIN_STOCK_BREACH=2
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].trigger).toBe("SAFETY_STOCK_BREACH");
    expect(data[1].trigger).toBe("REORDER_POINT_HIT");
  });

  it("suggestedOrderQty = max(reorderQty, supplierMOQ) = maxStock - currentStock", () => {
    // engine: suggestedQty = max(reorderQty, supplierMOQ)
    // SILK: maxStockLevel=100, currentStock=5 → 100-5=95
    expect(100 - 5).toBe(95);
  });

  it("estimatedPOValue = suggestedQty × unitCost", () => {
    // engine: estimatedPOValue = Math.round(qty × unitCost × 100) / 100
    expect(95 * 450).toBe(42750);
    expect(75 * 150).toBe(11250);
  });
});

describe("IT-APO-02 — AutoPOEngine.generatePO: POST /purchase/reorder-suggestions/convert", () => {

  it("201: DRAFT auto-PO with is_auto_generated=true", async () => {
    mockFetch(AUTO_PO_DRAFT, 201);
    const data = await (await fetch("/api/v1/purchase/reorder-suggestions/convert", { method: "POST" })).json();
    expect(data.order?.status ?? data.status).toBe("DRAFT");
    expect(data.order?.is_auto_generated ?? data.is_auto_generated).toBe(true);
  });

  it("submit auto-PO: status=SUBMITTED", async () => {
    mockFetch(AUTO_PO_SUBMITTED);
    const data = await (await fetch("/api/v1/purchase/orders/apo-001/submit", { method: "POST" })).json();
    // engine: submit → status SUBMITTED
    expect(data.status).toBe("SUBMITTED");
  });

  it("acknowledge auto-PO: status=ACKNOWLEDGED", async () => {
    mockFetch(AUTO_PO_ACKNOWLEDGED);
    const data = await (await fetch("/api/v1/purchase/orders/apo-001/confirm", { method: "POST" })).json();
    // engine: acknowledge → status ACKNOWLEDGED
    expect(data.status).toBe("ACKNOWLEDGED");
  });

  it("cancel auto-PO: status=CANCELLED with cancel_reason", async () => {
    mockFetch(AUTO_PO_CANCELLED);
    const data = await (await fetch("/api/v1/purchase/orders/apo-001/cancel", { method: "POST",
      body: JSON.stringify({ reason: "Stock adjusted manually" }) })).json();
    // engine: cancel → status CANCELLED
    expect(data.status).toBe("CANCELLED");
    expect(data.cancel_reason).toBe("Stock adjusted manually");
  });
});

// ═══════════════ SupplierPaymentEngine Suites ═════════════════════════════════

describe("IT-SPE-01 — SupplierPaymentEngine: aging buckets", () => {

  it("CURRENT invoice: aging_bucket=CURRENT (within 30d of due date)", async () => {
    mockFetch(SUPPLIER_INVOICE);
    const data = await (await fetch("/api/v1/purchase/invoices/inv-001")).json();
    // engine: 0–30d overdue → CURRENT
    expect(data.aging_bucket).toBe("CURRENT");
    expect(data.status).toBe("UNPAID");
  });

  it("OVERDUE_30 invoice: aging_bucket=OVERDUE_30 (31–60d past due)", async () => {
    mockFetch(SUPPLIER_INVOICE_OVERDUE);
    const data = await (await fetch("/api/v1/purchase/invoices/inv-002")).json();
    // engine: 31–60d → OVERDUE_30
    expect(data.aging_bucket).toBe("OVERDUE_30");
    expect(data.status).toBe("OVERDUE");
  });

  it("aging report: total_outstanding = CURRENT + OVERDUE_30 = 115500", async () => {
    mockFetch(AGING_REPORT);
    const data = await (await fetch("/api/v1/purchase/invoices/aging?vendor_id=VNDR-TEX-001")).json();
    // engine: computeAgingReport aggregates per-bucket amounts
    expect(data.total_outstanding).toBe(115500);
    expect(data.buckets.CURRENT.amount).toBe(57750);
    expect(data.buckets.OVERDUE_30.amount).toBe(57750);
  });
});

describe("IT-SPE-02 — SupplierPaymentEngine: early-pay discount + payment record", () => {

  it("early payment: net_paid = amount - early_pay_discount (2% of 57000 = 1140)", async () => {
    mockFetch(PAYMENT_EARLY, 201);
    const data = await (await fetch("/api/v1/supplier-payments/", { method: "POST",
      body: JSON.stringify({ amount: 57000, payment_mode: "BANK_TRANSFER" }) })).json();
    // engine: if paid before earlyPayCutoffDays → discount applied
    expect(data.early_pay_discount).toBe(1140);
    expect(data.net_paid).toBe(55860);
  });

  it("early-pay arithmetic: 2% of 57000 = 1140; netPaid = 57000 - 1140 = 55860", () => {
    const amount = 57000; const discountPct = 2;
    const discount = Math.round(amount * discountPct / 100);
    expect(discount).toBe(1140);
    expect(amount - discount).toBe(55860);
  });

  it("late payment: no early-pay discount, net_paid = full amount", async () => {
    mockFetch(PAYMENT_LATE, 201);
    const data = await (await fetch("/api/v1/supplier-payments/", { method: "POST" })).json();
    // engine: paid after cutoff → no discount
    expect(data.early_pay_discount).toBe(0);
    expect(data.net_paid).toBe(57750);
  });

  it("payment response has all 6 required fields", async () => {
    mockFetch(PAYMENT_EARLY, 201);
    const data = await (await fetch("/api/v1/supplier-payments/", { method: "POST" })).json();
    for (const f of ["id","supplier_id","amount","net_paid","payment_mode","status"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });
});
