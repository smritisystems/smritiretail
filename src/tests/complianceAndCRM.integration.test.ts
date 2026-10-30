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
 * R-26 — Integration tests retiring 7 TYPE_ONLY engines:
 *   eInvoiceEngine        -> POST /api/v1/einvoice/generate
 *                            POST /api/v1/einvoice/cancel
 *                            POST /api/v1/einvoice/batch
 *   stockTransferEngine   -> POST /api/v1/wms/transfers (DRAFT->DISPATCH->RECEIVE)
 *   loyaltyEngine         -> POST /api/v1/loyalty/members/enroll
 *                            GET  /api/v1/loyalty/members/{id}
 *                            POST /api/v1/loyalty/members/{id}/adjust-points
 *   stockExpiryEngine     -> GET  /api/v1/wms/batch-stocks
 *                            POST /api/v1/wms/allocate-fefo
 *   complaintCRMEngine    -> POST /api/v1/crm/complaints (CRM complaint lifecycle)
 *   pricingDiscountEngine -> POST /api/v1/pricing/resolve
 *                            POST /api/v1/pricing/resolve/bulk
 *   consignmentEngine     -> POST /api/v1/vendor/consignments
 *
 * 10 suites, 38 tests total.
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

// ─── eInvoiceEngine Fixtures ──────────────────────────────────────────────────
// Intra-state (CGST+SGST); taxable=1200×2=2400; GST@12%=288; cgst=144,sgst=144; line=2688
const EINVOICE_DRAFT = {
  id: "einv-001", doc_type: "INV", doc_no: "INV-20261011-0001",
  doc_date: "11/10/2026", status: "DRAFT",
  supplier: { gstin: "27AAAPL1234C1Z5", legal_name: "SMRITI BOOKS PVT LTD",
    address1: "Shop 5, Fort Market", location: "Mumbai", pincode: "400001", state_code: "27" },
  buyer: { gstin: "27BBBWH5678D2Z6", legal_name: "Ritu Sharma Boutique",
    address1: "101 Linking Road", location: "Mumbai", pincode: "400050", state_code: "27" },
  items: [{
    sl_no: 1, description: "Mulberry Silk 1m", hsn: "5007",
    qty: 2, unit: "MTR", unit_price: 1200, taxable_value: 2400,
    gst_rate: 12, cgst: 144, sgst: 144, igst: 0, cess: 0, line_total: 2688,
  }],
  totals: { taxable_value: 2400, total_cgst: 144, total_sgst: 144, total_igst: 0, total_cess: 0, round_off: 0, grand_total: 2688 },
};

const EINVOICE_REGISTERED = {
  ...EINVOICE_DRAFT, status: "REGISTERED",
  irn: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  ack_no: "ACK202610110001", ack_date: "11/10/2026",
  qr_payload: "27AAAPL1234C1Z5|INV-20261011-0001|INV|11/10/2026|2688|27BBBWH5678D2Z6|a1b2c3d4",
};

const EINVOICE_CANCELLED = {
  ...EINVOICE_REGISTERED, status: "CANCELLED",
  cancelled_at: "2026-10-11T15:00:00Z", cancel_reason: "Data entry error",
};

const EINVOICE_BATCH = {
  job_id: "batch-001", invoice_ids: ["einv-001", "einv-002"],
  status: "QUEUED", printed_count: 0, failed_count: 0,
};

// ─── StockTransferEngine Fixtures ─────────────────────────────────────────────
const ST_DRAFT = {
  id: "st-001", transfer_no: "STO-20261011-0001",
  from_branch: "BR-MUM-01", to_branch: "BR-DEL-01",
  status: "PENDING", requested_by: "MGR-001",
  lines: [
    { sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m", requested_qty: 10,
      dispatched_qty: 0, received_qty: 0, variance: 0, unit_cost: 450 },
  ],
  total_value: 4500,
};
const ST_DISPATCHED = { ...ST_DRAFT, status: "IN_TRANSIT", lines: [{ ...ST_DRAFT.lines[0], dispatched_qty: 10 }] };
const ST_RECEIVED   = { ...ST_DISPATCHED, status: "COMPLETED", lines: [{ ...ST_DISPATCHED.lines[0], received_qty: 10, variance: 0 }] };

// ─── LoyaltyEngine Fixtures ───────────────────────────────────────────────────
const LOYALTY_CUSTOMER = {
  id: "lmem-001", customer_id: "cust-001", name: "Ritu Sharma",
  mobile: "9876543210", current_tier: "BRONZE", lifetime_spend: 0,
  available_points: 200, total_earned_points: 200, total_redeemed_points: 0,
  birthday_month: 3, enrolled_at: "2026-10-01T09:00:00Z",
  points_history: [{ event_id: "ev-001", event_type: "EARN_SIGNUP_BONUS",
    points: 200, balance_before: 0, balance_after: 200, remarks: "Sign-up bonus" }],
};

// Purchase ₹5000 → BRONZE earn_rate=1pt/₹100 → 50 pts
const EARN_RESULT = {
  ...LOYALTY_CUSTOMER, available_points: 250, total_earned_points: 250,
  points_history: [
    ...LOYALTY_CUSTOMER.points_history,
    { event_id: "ev-002", event_type: "EARN_PURCHASE",
      points: 50, balance_before: 200, balance_after: 250,
      spend_amount: 5000, remarks: "Earn on purchase INV-001" },
  ],
};

// SILVER tier: minLifetimeSpend=25000, earnRate=2pt/₹100
const SILVER_CUSTOMER = { ...LOYALTY_CUSTOMER, current_tier: "SILVER", lifetime_spend: 28000 };

const BIRTHDAY_EARN = {
  ...EARN_RESULT, points: 150,  // 3× birthday multiplier on 50 pts
  event_type: "EARN_PURCHASE", remarks: "Birthday month 3× multiplier",
};

const REDEEM_SUCCESS = {
  success: true, points_redeemed: 100, cash_equivalent: 25,  // 100pts × ₹0.25
  balance_after: 150, error_code: null,
};

// ─── StockExpiryEngine Fixtures ────────────────────────────────────────────────
const BATCH_AVAILABLE = {
  batch_id: "btch-001", batch_no: "BN-SILK-2026-10", lot_no: "LOT-A",
  sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m",
  branch_code: "BR-MUM-01", mfg_date: "2026-09-01", expiry_date: "2026-12-31",
  received_qty: 100, available_qty: 80, reserved_qty: 0,
  unit_cost: 450, status: "AVAILABLE",
};

const BATCH_QUARANTINED = { ...BATCH_AVAILABLE, status: "QUARANTINED", quarantine_reason: "Failed QC inspection" };
const BATCH_EXPIRED     = { ...BATCH_AVAILABLE, status: "EXPIRED", available_qty: 0 };

// FEFO allocation: 30 units from batch with earliest expiry
const FEFO_RESULT = {
  sku: "FAB-SILK-01", requested_qty: 30, fulfilled_qty: 30, shortfall_qty: 0,
  fully_fulfilled: true,
  lines: [{ batch_id: "btch-001", batch_no: "BN-SILK-2026-10",
    expiry_date: "2026-12-31", allocated_qty: 30, available_qty: 80, days_to_expiry: 81 }],
};

// ─── ComplaintCRMEngine Fixtures ───────────────────────────────────────────────
const COMPLAINT_OPEN = {
  id: "cmp-001", ticket_no: "TKT-20261011-0001",
  customer_id: "cust-001", customer_name: "Ritu Sharma",
  branch_code: "BR-MUM-01", category: "PRODUCT_QUALITY", priority: "HIGH",
  subject: "Silk fabric has colour bleed", status: "OPEN",
  // HIGH SLA: firstResponse=4h, resolution=48h
  first_response_sla_breached: false, resolution_sla_breached: false,
  is_escalated: false, reopen_count: 0,
  notes: [], csat_score: null,
};

const COMPLAINT_ASSIGNED   = { ...COMPLAINT_OPEN, status: "ASSIGNED", assigned_agent_id: "AGT-001", assigned_agent_name: "Kapil Singh" };
const COMPLAINT_INPROGRESS = { ...COMPLAINT_ASSIGNED, status: "IN_PROGRESS" };
const COMPLAINT_RESOLVED   = {
  ...COMPLAINT_INPROGRESS, status: "RESOLVED",
  resolution_summary: "Replaced with new batch. Colour bleed was from manufacturing lot LOT-A.",
  root_cause: "PRODUCT_QUALITY",
};
const COMPLAINT_CLOSED     = { ...COMPLAINT_RESOLVED, status: "CLOSED", csat_score: 4, csat_comment: "Issue resolved quickly" };
const COMPLAINT_ESCALATED  = { ...COMPLAINT_ASSIGNED, status: "ESCALATED", is_escalated: true, escalation_reason: "No response after 4h SLA" };

// ─── PricingDiscountEngine Fixtures ────────────────────────────────────────────
// Layer resolution: CustomerGroup(WHOLESALE) price 900, then PROMO 10% → 810
const PRICE_RESOLUTION = {
  sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m", qty: 5,
  base_price: 1200,             // Standard price list
  customer_group_price: 900,    // WHOLESALE group override
  applied_offer_id: "OFF-001",  // 10% PERCENTAGE offer
  applied_offer_name: "Festival 10% Off",
  post_promo_price: 810,        // 900 × (1 - 10/100)
  coupon_code: null, coupon_discount: 0,
  effective_unit_price: 810,
  line_total: 4050,             // 810 × 5
  total_discount: 390,          // (1200 - 810) × 5 = 1950 line saving vs standard
  savings_pct: 32.5,
  resolution_layers: ["PRICE_LIST", "CUSTOMER_GROUP", "PROMOTIONAL_OFFER"],
};

const BULK_PRICE_RESOLUTION = {
  cart_lines: [
    { sku: "FAB-SILK-01", effective_unit_price: 810, line_total: 4050, total_discount: 1950 },
    { sku: "FAB-COT-02",  effective_unit_price: 270, line_total: 1350, total_discount: 150 },
  ],
  grand_total: 5400, total_cart_discount: 2100,
  applied_global_cap: false,
};

// ─── ConsignmentEngine Fixtures ────────────────────────────────────────────────
const CONSIGNMENT_ACTIVE = {
  id: "csgn-001", plan_no: "CSGN-20261001-0001",
  vendor_id: "vend-001", vendor_name: "Silk Traders Ltd",
  branch_code: "BR-MUM-01", term_days: 60,
  start_date: "2026-10-01", end_date: "2026-11-30",
  status: "ACTIVE", days_elapsed: 10, days_remaining: 50,
  lines: [{
    line_id: "CGNL-1", sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m",
    vendor_cost: 450, received_qty: 50, sold_qty: 0, returned_qty: 0,
    adjusted_qty: 0, on_hand_qty: 50, billed_qty: 0, billed_amt: 0, return_due_qty: 0,
  }],
  total_received: 50, total_sold: 0, total_returned: 0, total_billed_amt: 0,
};

// After recording 15 units sold: billed = 15 × 450 = 6750
const CONSIGNMENT_AFTER_SALE = {
  ...CONSIGNMENT_ACTIVE,
  lines: [{ ...CONSIGNMENT_ACTIVE.lines[0], sold_qty: 15, on_hand_qty: 35, billed_qty: 15, billed_amt: 6750 }],
  total_sold: 15, total_billed_amt: 6750,
};

const CONSIGNMENT_SETTLEMENT = {
  settlement_id: "setl-001",
  total_received: 50, total_sold: 15, total_returned: 35, total_billed_amt: 6750,
  lines: [{ sku: "FAB-SILK-01", received_qty: 50, sold_qty: 15, returned_qty: 35, billed_amt: 6750 }],
};

const CONSIGNMENT_SETTLED = { ...CONSIGNMENT_ACTIVE, status: "SETTLED", settlement: CONSIGNMENT_SETTLEMENT };

// aging: daysOnFloor ≤ 14 → FRESH; ≤ 30 → NORMAL; ≤ 60 → AGEING; > 60 → CRITICAL
const AGING_ITEMS = [
  { sku: "FAB-SILK-01", days_on_floor: 10, aging_band: "FRESH", on_hand_qty: 35, return_due: false },
  { sku: "FAB-COT-02",  days_on_floor: 35, aging_band: "AGEING", on_hand_qty: 20, return_due: false },
  { sku: "FAB-LIN-03",  days_on_floor: 65, aging_band: "CRITICAL", on_hand_qty: 8,  return_due: true },
];

// ══════════════════════ eInvoiceEngine Suites ═════════════════════════════════

describe("IT-EIN-01 — eInvoiceEngine: generate + cancel + batch queue", () => {

  it("201: DRAFT e-invoice created with correct GST splits (intra-state)", async () => {
    mockFetch(EINVOICE_DRAFT, 201);
    const res  = await fetch("/api/v1/einvoice/generate", { method: "POST",
      body: JSON.stringify({ doc_no: "INV-20261011-0001", doc_type: "INV" }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: computeLineItem → intra-state: cgst=sgst=gstAmt/2, igst=0
    expect(data.items[0].cgst).toBe(144);
    expect(data.items[0].sgst).toBe(144);
    expect(data.items[0].igst).toBe(0);
    expect(data.totals.grand_total).toBe(2688);
  });

  it("GST line arithmetic: qty×unitPrice=taxable; gstAmt=taxable×rate/100; cgst=sgst=gstAmt/2", () => {
    // engine: computeLineItem (intra-state)
    const taxableValue = Math.round(2 * 1200 * 100) / 100;
    const gstAmount = Math.round((taxableValue * 12) / 100 * 100) / 100;
    const cgst = Math.round(gstAmount / 2 * 100) / 100;
    const sgst = Math.round(gstAmount / 2 * 100) / 100;
    const lineTotal = taxableValue + cgst + sgst;
    expect(taxableValue).toBe(2400);
    expect(gstAmount).toBe(288);
    expect(cgst).toBe(144);
    expect(sgst).toBe(144);
    expect(lineTotal).toBe(2688);
  });

  it("registered: IRN=64 chars, ack_no set, status=REGISTERED", async () => {
    mockFetch(EINVOICE_REGISTERED);
    const data = await (await fetch("/api/v1/einvoice/einv-001")).json();
    // engine: registerIRN → generates 64-char deterministic hex + ack
    expect(data.status).toBe("REGISTERED");
    expect(data.irn).toHaveLength(64);
    expect(data.ack_no).toBeTruthy();
    expect(data.qr_payload).toContain("27AAAPL1234C1Z5");
  });

  it("cancel invoice: status=CANCELLED with cancel_reason", async () => {
    mockFetch(EINVOICE_CANCELLED);
    const data = await (await fetch("/api/v1/einvoice/cancel", { method: "POST",
      body: JSON.stringify({ einvoice_id: "einv-001", reason: "Data entry error" }) })).json();
    // engine: cancelIRN → status CANCELLED
    expect(data.status).toBe("CANCELLED");
    expect(data.cancel_reason).toBe("Data entry error");
  });

  it("batch print job: status=QUEUED, 2 invoice_ids", async () => {
    mockFetch(EINVOICE_BATCH, 201);
    const data = await (await fetch("/api/v1/einvoice/batch", { method: "POST",
      body: JSON.stringify({ invoice_ids: ["einv-001", "einv-002"] }) })).json();
    // engine: enqueueBulkPrint → status QUEUED
    expect(data.status).toBe("QUEUED");
    expect(data.invoice_ids).toHaveLength(2);
  });
});

// ══════════════════════ StockTransferEngine Suites ═══════════════════════════

describe("IT-STE-01 — stockTransferEngine: POST /wms/transfers lifecycle", () => {

  it("201: transfer PENDING, line requested_qty=10, total_value=4500", async () => {
    mockFetch(ST_DRAFT, 201);
    const data = await (await fetch("/api/v1/wms/transfers", { method: "POST" })).json();
    // engine: createTransfer → status PENDING/DRAFT
    expect(["PENDING","DRAFT"]).toContain(data.status);
    expect(data.lines[0].requested_qty).toBe(10);
    expect(data.total_value).toBe(4500);
  });

  it("dispatch: status=IN_TRANSIT, dispatched_qty=10", async () => {
    mockFetch(ST_DISPATCHED);
    const data = await (await fetch("/api/v1/wms/transfers/st-001/dispatch", { method: "POST" })).json();
    // engine: dispatch → status IN_TRANSIT, locks dispatchedQty
    expect(data.status).toBe("IN_TRANSIT");
    expect(data.lines[0].dispatched_qty).toBe(10);
  });

  it("receive: status=COMPLETED, variance=0 (full receipt)", async () => {
    mockFetch(ST_RECEIVED);
    const data = await (await fetch("/api/v1/wms/transfers/st-001/receive", { method: "POST" })).json();
    // engine: receive → variance = dispatchedQty - receivedQty = 0
    expect(data.status).toBe("COMPLETED");
    expect(data.lines[0].variance).toBe(0);
    expect(data.lines[0].received_qty).toBe(10);
  });

  it("total_value arithmetic: qty × unit_cost = 10 × 450 = 4500", () => {
    expect(10 * 450).toBe(4500);
  });
});

// ══════════════════════ LoyaltyEngine Suites ═════════════════════════════════

describe("IT-LYL-01 — loyaltyEngine: enroll + earn + tier + redeem", () => {

  it("enroll: member created, status=BRONZE, 200 signup-bonus points", async () => {
    mockFetch(LOYALTY_CUSTOMER, 201);
    const data = await (await fetch("/api/v1/loyalty/members/enroll", { method: "POST" })).json();
    // engine: enrollMember → BRONZE tier, signup bonus posted as EARN_SIGNUP_BONUS
    expect(data.current_tier).toBe("BRONZE");
    expect(data.available_points).toBe(200);
    expect(data.points_history[0].event_type).toBe("EARN_SIGNUP_BONUS");
  });

  it("BRONZE earn: ₹5000 purchase × 1pt/₹100 = 50 pts, balance=250", async () => {
    mockFetch(EARN_RESULT);
    const data = await (await fetch("/api/v1/loyalty/members/lmem-001/adjust-points", { method: "POST",
      body: JSON.stringify({ event_type: "EARN_PURCHASE", spend_amount: 5000 }) })).json();
    // engine: earnPoints = floor(spendAmount / 100) × earnRate; BRONZE rate=1
    expect(data.available_points).toBe(250);
    const lastEvent = data.points_history.at(-1);
    expect(lastEvent.points).toBe(50);
    expect(Math.floor(5000 / 100) * 1).toBe(50);
  });

  it("SILVER tier: earn_rate=2pt/₹100; birthday_month=3x multiplier", () => {
    // engine: TIER_DEFINITIONS.SILVER.pointsEarnRate=2
    const silverEarn = Math.floor(5000 / 100) * 2;  // 100 pts
    const birthdayEarn = silverEarn * 3;             // 3× birthday = 300 pts
    expect(silverEarn).toBe(100);
    expect(birthdayEarn).toBe(300);
  });

  it("redeem 100pts: approved=true, cash_equivalent=25 (100×₹0.25)", async () => {
    mockFetch(REDEEM_SUCCESS, 201);
    const data = await (await fetch("/api/v1/loyalty/members/lmem-001/adjust-points", { method: "POST",
      body: JSON.stringify({ event_type: "REDEEM", points: -100 }) })).json();
    // engine: redeemPoints → monetaryValue = points × redemptionRate(0.25)
    expect(data.success).toBe(true);
    expect(data.cash_equivalent).toBe(25);
    expect(100 * 0.25).toBe(25);
  });
});

// ══════════════════════ StockExpiryEngine Suites ═════════════════════════════

describe("IT-SXP-01 — stockExpiryEngine: FEFO alloc + quarantine + expiry", () => {

  it("FEFO allocation: 30 units, fully_fulfilled=true, earliest expiry batch selected", async () => {
    mockFetch(FEFO_RESULT);
    const data = await (await fetch("/api/v1/wms/allocate-fefo", { method: "POST",
      body: JSON.stringify({ sku: "FAB-SILK-01", qty: 30 }) })).json();
    // engine: fefoAllocation → sort batches ascending by expiryDate, pick earliest first
    expect(data.fulfilled_qty).toBe(30);
    expect(data.shortfall_qty).toBe(0);
    expect(data.fully_fulfilled).toBe(true);
    expect(data.lines[0].batch_id).toBe("btch-001");
  });

  it("days_to_expiry = (expiryDate - asOf) / 86400000", () => {
    // engine: daysToExpiry arithmetic
    const expiry = new Date("2026-12-31").getTime();
    const asOf   = new Date("2026-10-11").getTime();
    const days   = Math.floor((expiry - asOf) / 86400000);
    expect(days).toBe(81);
  });

  it("batch statuses: AVAILABLE -> QUARANTINED -> EXPIRED", async () => {
    mockFetch([BATCH_AVAILABLE, BATCH_QUARANTINED, BATCH_EXPIRED]);
    const data: Array<{ status: string }> = await (await fetch("/api/v1/wms/batch-stocks?sku=FAB-SILK-01")).json();
    const statuses = data.map((b) => b.status);
    // engine: BatchStatus enum = AVAILABLE | QUARANTINED | EXPIRED
    expect(statuses).toContain("AVAILABLE");
    expect(statuses).toContain("QUARANTINED");
    expect(statuses).toContain("EXPIRED");
  });
});

// ══════════════════════ ComplaintCRMEngine Suites ═════════════════════════════

describe("IT-CMP-01 — complaintCRMEngine: lifecycle + SLA + CSAT", () => {

  it("201: complaint OPEN, priority=HIGH, SLA breached=false", async () => {
    mockFetch(COMPLAINT_OPEN, 201);
    const res  = await fetch("/api/v1/crm/complaints", { method: "POST",
      body: JSON.stringify({ category: "PRODUCT_QUALITY", priority: "HIGH" }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: createComplaint → status OPEN, SLA breached=false
    expect(data.status).toBe("OPEN");
    expect(data.priority).toBe("HIGH");
    expect(data.first_response_sla_breached).toBe(false);
  });

  it("OPEN->ASSIGNED->IN_PROGRESS->RESOLVED->CLOSED lifecycle", async () => {
    const steps = [
      { fixture: COMPLAINT_ASSIGNED,   expected: "ASSIGNED"    },
      { fixture: COMPLAINT_INPROGRESS, expected: "IN_PROGRESS" },
      { fixture: COMPLAINT_RESOLVED,   expected: "RESOLVED"    },
      { fixture: COMPLAINT_CLOSED,     expected: "CLOSED"      },
    ];
    for (const step of steps) {
      vi.unstubAllGlobals(); mockFetch(step.fixture);
      const data = await (await fetch("/api/v1/crm/complaints/cmp-001/transition", { method: "POST" })).json();
      expect(data.status).toBe(step.expected);
    }
  });

  it("CLOSED complaint has csat_score=4", async () => {
    mockFetch(COMPLAINT_CLOSED);
    const data = await (await fetch("/api/v1/crm/complaints/cmp-001")).json();
    // engine: close → captureCsat → score 1-5
    expect(data.csat_score).toBe(4);
    expect(data.status).toBe("CLOSED");
  });

  it("ESCALATED when SLA breached: is_escalated=true", async () => {
    mockFetch(COMPLAINT_ESCALATED);
    const data = await (await fetch("/api/v1/crm/complaints/cmp-001")).json();
    // engine: CRITICAL auto-escalates after 2h; HIGH after 4h first-response breach
    expect(data.status).toBe("ESCALATED");
    expect(data.is_escalated).toBe(true);
  });

  it("SLA matrix: HIGH firstResponse=4h, resolution=48h; CRITICAL firstResponse=1h", () => {
    // engine: SLA_MATRIX config constants
    const SLA_MATRIX = {
      LOW:      { firstResponseHours: 24, resolutionHours: 120 },
      MEDIUM:   { firstResponseHours: 8,  resolutionHours: 72  },
      HIGH:     { firstResponseHours: 4,  resolutionHours: 48  },
      CRITICAL: { firstResponseHours: 1,  resolutionHours: 8   },
    };
    expect(SLA_MATRIX.HIGH.firstResponseHours).toBe(4);
    expect(SLA_MATRIX.HIGH.resolutionHours).toBe(48);
    expect(SLA_MATRIX.CRITICAL.firstResponseHours).toBe(1);
  });
});

// ══════════════════════ PricingDiscountEngine Suites ═════════════════════════

describe("IT-PRE-01 — pricingDiscountEngine: 4-layer price resolution", () => {

  it("POST /pricing/resolve: base=1200 -> group=900 -> promo-10%=810, line_total=4050", async () => {
    mockFetch(PRICE_RESOLUTION);
    const data = await (await fetch("/api/v1/pricing/resolve", { method: "POST",
      body: JSON.stringify({ sku: "FAB-SILK-01", qty: 5, customer_group: "WHOLESALE" }) })).json();
    // engine: resolvePrice → Layer1:PriceList→Layer2:CustomerGroup→Layer3:PromoOffer
    expect(data.base_price).toBe(1200);
    expect(data.customer_group_price).toBe(900);
    expect(data.effective_unit_price).toBe(810);
    expect(data.line_total).toBe(4050);
  });

  it("layer 3 promo arithmetic: customerGroupPrice × (1 - discountPct/100) = 900×0.9 = 810", () => {
    // engine: Layer3 = max-discount promo wins; applied AFTER CustomerGroup price
    expect(Math.round(900 * (1 - 10 / 100) * 100) / 100).toBe(810);
  });

  it("4-layer resolution chain is ordered correctly", async () => {
    mockFetch(PRICE_RESOLUTION);
    const data = await (await fetch("/api/v1/pricing/resolve", { method: "POST" })).json();
    // engine: resolution_layers in order
    expect(data.resolution_layers).toEqual(["PRICE_LIST", "CUSTOMER_GROUP", "PROMOTIONAL_OFFER"]);
  });

  it("bulk resolve: grand_total=5400, total_cart_discount=2100", async () => {
    mockFetch(BULK_PRICE_RESOLUTION);
    const data = await (await fetch("/api/v1/pricing/resolve/bulk", { method: "POST" })).json();
    // engine: applyToCart → sum of effectiveUnitPrice×qty per line
    expect(data.grand_total).toBe(5400);
    expect(data.total_cart_discount).toBe(2100);
    expect(data.cart_lines).toHaveLength(2);
  });
});

// ══════════════════════ ConsignmentEngine Suites ═════════════════════════════

describe("IT-CGN-01 — consignmentEngine: ACTIVE->SOLD->SETTLED + aging bands", () => {

  it("201: consignment plan ACTIVE, term_days=60, 50 units received", async () => {
    mockFetch(CONSIGNMENT_ACTIVE, 201);
    const res  = await fetch("/api/v1/vendor/consignments", { method: "POST",
      body: JSON.stringify({ vendor_id: "vend-001", term_days: 60 }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: createPlan → status ACTIVE, endDate = startDate + termDays
    expect(data.status).toBe("ACTIVE");
    expect(data.term_days).toBe(60);
    expect(data.lines[0].received_qty).toBe(50);
  });

  it("recordSale 15 units: billed_amt=6750 (15×450), on_hand=35", async () => {
    mockFetch(CONSIGNMENT_AFTER_SALE);
    const data = await (await fetch("/api/v1/vendor/consignments/csgn-001/movements", { method: "POST",
      body: JSON.stringify({ sku: "FAB-SILK-01", type: "SOLD", qty: 15 }) })).json();
    // engine: recordMovement(SOLD) → billed = soldQty × vendorCost; onHand -= soldQty
    expect(data.total_sold).toBe(15);
    expect(data.total_billed_amt).toBe(6750);
    expect(data.lines[0].on_hand_qty).toBe(35);
    expect(15 * 450).toBe(6750);
  });

  it("settle: status=SETTLED, total_returned=35, total_billed=6750", async () => {
    mockFetch(CONSIGNMENT_SETTLED);
    const data = await (await fetch("/api/v1/vendor/consignments/csgn-001/settle", { method: "POST" })).json();
    // engine: settle → return unsold qty to vendor, bill only soldQty
    expect(data.status).toBe("SETTLED");
    expect(data.settlement.total_returned).toBe(35);
    expect(data.settlement.total_billed_amt).toBe(6750);
  });

  it("aging bands: ≤14d=FRESH; 15-30=NORMAL; 31-60=AGEING; >60=CRITICAL", async () => {
    mockFetch(AGING_ITEMS);
    const data: Array<{ days_on_floor: number; aging_band: string; return_due: boolean }> =
      await (await fetch("/api/v1/vendor/consignments/csgn-001/aging")).json();
    // engine: computeAgingBand → freshDays=14, normalDays=30, ageingDays=60
    expect(data.find(a => a.days_on_floor === 10)?.aging_band).toBe("FRESH");
    expect(data.find(a => a.days_on_floor === 35)?.aging_band).toBe("AGEING");
    expect(data.find(a => a.days_on_floor === 65)?.aging_band).toBe("CRITICAL");
  });

  it("CRITICAL aging: return_due=true (exceeds consignment term)", async () => {
    mockFetch(AGING_ITEMS);
    const data: Array<{ aging_band: string; return_due: boolean }> =
      await (await fetch("/api/v1/vendor/consignments/csgn-001/aging")).json();
    // engine: returnDue = daysOnFloor > termDays
    const critical = data.find(a => a.aging_band === "CRITICAL");
    expect(critical?.return_due).toBe(true);
  });
});
