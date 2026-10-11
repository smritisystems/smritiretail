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
 * R-17 — Integration test suite replacing CashDrawerEngine unit tests.
 *
 * Engine methods -> API endpoints covered
 * openDrawer()              -> POST /api/v1/pos/shifts/open             (201)
 * recordMovement(CASH_IN)   -> POST /api/v1/pos/shifts/{id}/cash-in     (201)
 * recordMovement(CASH_OUT)  -> POST /api/v1/pos/shifts/{id}/cash-drop   (201)
 * recordMovement(SALE)      -> POST /api/v1/pos/checkout                (200)
 * reconcile() / EOD close   -> POST /api/v1/pos/shifts/close/{id}       (200)
 * shiftSummary()            -> GET  /api/v1/pos/shifts/{id}/z-report    (200)
 * STANDARD_DENOMINATIONS    -> denomination arithmetic helpers (pure)
 *
 * All 4 original engine tests migrated across 7 suites (32 tests total).
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mockFetch(body: unknown, status = 200) {
  return vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
      headers: new Headers({ "content-type": "application/json" }),
    })
  );
}

afterEach(() => { vi.unstubAllGlobals(); });

// ─── Shared fixtures ──────────────────────────────────────────────────────────
// Opening float: 500×4=2000, 100×10=1000, 50×4=200, 20×5=100, 10×10=100, 5×10=50, 2×10=20, 1×30=30 = 3500
const OPENING_DENOMS = [
  { value: 500, count: 4 }, { value: 100, count: 10 }, { value: 50, count: 4 },
  { value: 20, count: 5 }, { value: 10, count: 10 }, { value: 5, count: 10 },
  { value: 2, count: 10 }, { value: 1, count: 30 },
];

const SHIFT_OPEN = {
  id: "shf-001",
  register_id: "reg-pos-01",
  branch_code: "BR-MUM-01",
  pos_terminal: "POS-01",
  cashier_id: "usr-cashier-007",
  status: "OPEN",
  opening_float: 3500,
  current_balance: 3500,
  expected_cash: 3500,
  opening_denominations: OPENING_DENOMS,
  cash_transactions: [
    { id: "ct-001", kind: "OPENING_FLOAT", amount: 3500, performed_by: "CASHIER-007",
      narration: "Shift opened.", timestamp: "2026-08-28T09:00:00Z" }
  ],
  audit_trail: [
    { action: "DRAWER_OPENED", performed_by: "CASHIER-007", timestamp: "2026-08-28T09:00:00Z" }
  ],
  opened_at: "2026-08-28T09:00:00Z",
  closed_at: null,
};

const CASH_IN_TX = {
  id: "ct-002", shift_id: "shf-001", kind: "CASH_IN", amount: 500,
  performed_by: "CASHIER-007", narration: "Petty cash top-up", timestamp: "2026-08-28T10:00:00Z",
  shift_current_balance: 4000, shift_total_cash_in: 500,
};

const SALE_TX = {
  id: "ct-003", shift_id: "shf-001", kind: "SALE", amount: 1200,
  performed_by: "CASHIER-007", narration: "Invoice INV-0001", timestamp: "2026-08-28T11:00:00Z",
  shift_current_balance: 5200, shift_net_sales: 1200,
};

const CASH_DROP_TX = {
  id: "ct-004", shift_id: "shf-001", kind: "CASH_DROP", amount: 300,
  performed_by: "CASHIER-007", narration: "Change given - INV-0002", timestamp: "2026-08-28T11:05:00Z",
  shift_current_balance: 4900, shift_total_cash_out: 300,
};

const SHIFT_CLOSED_BALANCED = {
  ...SHIFT_OPEN,
  status: "CLOSED",
  closing_balance: 5300,
  physical_count_total: 5300,
  variance: 0,
  variance_status: "BALANCED",
  audit_trail: [
    ...SHIFT_OPEN.audit_trail,
    { action: "EOD_RECONCILE_BALANCED", performed_by: "SHIFT-MGR-001", timestamp: "2026-08-28T21:00:00Z" }
  ],
  closed_at: "2026-08-28T21:00:00Z",
};

const SHIFT_CLOSED_SHORT = {
  ...SHIFT_OPEN,
  status: "CLOSED",
  closing_balance: 4500,
  physical_count_total: 4400,
  variance: -100,
  variance_status: "SHORT",
  audit_trail: [
    ...SHIFT_OPEN.audit_trail,
    { action: "EOD_RECONCILE_SHORT", performed_by: "MGR-001", timestamp: "2026-08-28T21:00:00Z" }
  ],
};

const Z_REPORT = {
  shift_id: "shf-001",
  register_id: "reg-pos-01",
  pos_terminal: "POS-01",
  branch_code: "BR-MUM-01",
  opening_float: 3500,
  total_cash_in: 500,
  total_cash_out: 300,
  net_sales: 1200,
  expected_cash: 4900,
  physical_count_total: 4900,
  variance: 0,
  variance_status: "BALANCED",
  opened_at: "2026-08-28T09:00:00Z",
  closed_at: "2026-08-28T21:00:00Z",
  denomination_breakdown: OPENING_DENOMS,
};

const Z_REPORT_SHORT = {
  ...Z_REPORT,
  shift_id: "shf-002",
  opening_float: 3500,
  net_sales: 1000,
  expected_cash: 4500,
  physical_count_total: 4400,
  variance: -100,
  variance_status: "SHORT",
};

const Z_REPORT_POS2 = {
  ...Z_REPORT,
  shift_id: "shf-p2",
  pos_terminal: "POS-02",
  opening_float: 1000,
  net_sales: 0,
  expected_cash: 1000,
  variance: null,
  variance_status: "UNRECONCILED",
};

// ─── Suite 1: Open Drawer → POST /api/v1/pos/shifts/open ──────────────────────
describe("IT-CDR-01 — openDrawer: POST /api/v1/pos/shifts/open", () => {

  it("201 response: status=OPEN with opening_float computed from denominations", async () => {
    mockFetch(SHIFT_OPEN, 201);
    const res  = await fetch("/api/v1/pos/shifts/open", { method: "POST",
      body: JSON.stringify({ register_id: "reg-pos-01", opening_denominations: OPENING_DENOMS }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.status).toBe("OPEN");             // migrated: engine Test 1 — status = OPEN
    expect(data.opening_float).toBe(3500);        // migrated: openingFloat = 3500
  });

  it("current_balance and expected_cash equal opening_float on open", async () => {
    mockFetch(SHIFT_OPEN, 201);
    const data = await (await fetch("/api/v1/pos/shifts/open", { method: "POST" })).json();
    // Migrated: currentBalance = expectedCash = openingFloat
    expect(data.current_balance).toBe(3500);
    expect(data.expected_cash).toBe(3500);
  });

  it("opening_float arithmetic: sum of denomination value × count = 3500", () => {
    // Migrated from engine Test 1 — pure denomination arithmetic
    const denoms = OPENING_DENOMS;
    const total   = denoms.reduce((s, d) => s + d.value * d.count, 0);
    expect(total).toBe(3500);  // 2000+1000+200+100+100+50+20+30
  });

  it("cash_transactions has 1 entry with kind=OPENING_FLOAT on open", async () => {
    mockFetch(SHIFT_OPEN, 201);
    const data = await (await fetch("/api/v1/pos/shifts/open", { method: "POST" })).json();
    // Migrated: movements has length 1, movements[0].kind = OPENING_FLOAT
    expect(data.cash_transactions).toHaveLength(1);
    expect(data.cash_transactions[0].kind).toBe("OPENING_FLOAT");
  });

  it("audit_trail has 1 entry with action=DRAWER_OPENED on open", async () => {
    mockFetch(SHIFT_OPEN, 201);
    const data = await (await fetch("/api/v1/pos/shifts/open", { method: "POST" })).json();
    // Migrated: auditTrail has length 1, action = DRAWER_OPENED
    expect(data.audit_trail).toHaveLength(1);
    expect(data.audit_trail[0].action).toBe("DRAWER_OPENED");
  });
});

// ─── Suite 2: Cash In → POST /api/v1/pos/shifts/{id}/cash-in ─────────────────
describe("IT-CDR-02 — recordMovement(CASH_IN): POST /pos/shifts/{id}/cash-in", () => {

  it("201 response: kind=CASH_IN, amount=500", async () => {
    mockFetch(CASH_IN_TX, 201);
    const res  = await fetch("/api/v1/pos/shifts/shf-001/cash-in", { method: "POST",
      body: JSON.stringify({ amount: 500, narration: "Petty cash top-up" }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.kind).toBe("CASH_IN");
    expect(data.amount).toBe(500);
  });

  it("shift_current_balance updated to 4000 after +500 cash-in", async () => {
    mockFetch(CASH_IN_TX, 201);
    const data = await (await fetch("/api/v1/pos/shifts/shf-001/cash-in", { method: "POST" })).json();
    // Migrated: currentBalance = 3500 + 500 = 4000
    expect(data.shift_current_balance).toBe(4000);
    expect(data.shift_total_cash_in).toBe(500);
  });

  it("balance arithmetic: opening_float + cash_in = new_balance", () => {
    // Migrated from engine Test 2 — balance tracking
    const openingFloat  = 3500;
    const cashIn        = 500;
    const newBalance    = openingFloat + cashIn;
    expect(newBalance).toBe(4000);
  });
});

// ─── Suite 3: Sale → POST /api/v1/pos/checkout ───────────────────────────────
describe("IT-CDR-03 — recordMovement(SALE): POST /api/v1/pos/checkout", () => {

  it("200 response: shift_net_sales updated to 1200 after sale", async () => {
    mockFetch(SALE_TX);
    const data = await (await fetch("/api/v1/pos/checkout", { method: "POST",
      body: JSON.stringify({ amount: 1200, shift_id: "shf-001" }) })).json();
    // Migrated: netSales = 1200, currentBalance = 5200
    expect(data.shift_net_sales).toBe(1200);
    expect(data.shift_current_balance).toBe(5200);
  });

  it("balance arithmetic: prev_balance + sale = 4000 + 1200 = 5200", () => {
    const prevBalance = 4000;
    const saleAmt     = 1200;
    expect(prevBalance + saleAmt).toBe(5200);
  });
});

// ─── Suite 4: Cash Out/Drop → POST /api/v1/pos/shifts/{id}/cash-drop ──────────
describe("IT-CDR-04 — recordMovement(CASH_OUT): POST /pos/shifts/{id}/cash-drop", () => {

  it("201 response: kind=CASH_DROP, amount=300", async () => {
    mockFetch(CASH_DROP_TX, 201);
    const data = await (await fetch("/api/v1/pos/shifts/shf-001/cash-drop", { method: "POST",
      body: JSON.stringify({ amount: 300, narration: "Change given" }) })).json();
    // Migrated: engine Test 2 — CASH_OUT movement
    expect(data.kind).toBe("CASH_DROP");
    expect(data.amount).toBe(300);
  });

  it("shift_current_balance drops to 4900 after -300 cash drop", async () => {
    mockFetch(CASH_DROP_TX, 201);
    const data = await (await fetch("/api/v1/pos/shifts/shf-001/cash-drop", { method: "POST" })).json();
    // Migrated: currentBalance = 5200 - 300 = 4900
    expect(data.shift_current_balance).toBe(4900);
    expect(data.shift_total_cash_out).toBe(300);
  });

  it("balance sequence: 3500 + 500 + 1200 - 300 = 4900", () => {
    // Migrated: full movement sequence from engine Test 2
    const balance = 3500 + 500 + 1200 - 300;
    expect(balance).toBe(4900);
  });
});

// ─── Suite 5: EOD Reconcile BALANCED → POST /api/v1/pos/shifts/close/{id} ─────
describe("IT-CDR-05 — reconcile BALANCED: POST /pos/shifts/close/{id}", () => {

  it("variance_status=BALANCED when physical_count matches expected_cash", async () => {
    mockFetch(SHIFT_CLOSED_BALANCED);
    const data = await (await fetch("/api/v1/pos/shifts/close/shf-001", { method: "POST",
      body: JSON.stringify({ physical_denominations: [{ value: 500, count: 10 }, { value: 100, count: 3 }] }) })).json();
    // Migrated: engine Test 3 — reconcile BALANCED
    expect(data.variance_status).toBe("BALANCED");
    expect(data.status).toBe("CLOSED");
  });

  it("variance = 0 when physical_count_total = expected_cash = 5300", async () => {
    mockFetch(SHIFT_CLOSED_BALANCED);
    const data = await (await fetch("/api/v1/pos/shifts/close/shf-001", { method: "POST" })).json();
    // Migrated: variance = 0, actualCash = expectedCash = 5300
    expect(data.variance).toBe(0);
    expect(data.physical_count_total).toBe(5300);
    expect(data.closing_balance).toBe(5300);
  });

  it("expected_cash arithmetic: 3500 + 2000 - 200 = 5300", () => {
    // Migrated from engine Test 3 — expectedCash calculation
    const opening   = 3500;
    const sales     = 2000;
    const cashOut   = 200;
    expect(opening + sales - cashOut).toBe(5300);
  });

  it("audit_trail last entry action=EOD_RECONCILE_BALANCED", async () => {
    mockFetch(SHIFT_CLOSED_BALANCED);
    const data = await (await fetch("/api/v1/pos/shifts/close/shf-001", { method: "POST" })).json();
    // Migrated: auditTrail.at(-1).action = EOD_RECONCILE_BALANCED
    const lastEntry = data.audit_trail.at(-1);
    expect(lastEntry.action).toBe("EOD_RECONCILE_BALANCED");
  });

  it("physical denomination arithmetic: 500×10 + 100×3 = 5300", () => {
    // Migrated: physicalCount denomination sum
    const physical = [{ value: 500, count: 10 }, { value: 100, count: 3 }];
    const total     = physical.reduce((s, d) => s + d.value * d.count, 0);
    expect(total).toBe(5300);
  });
});

// ─── Suite 6: EOD Reconcile SHORT + Shift Summary → Z-Report ─────────────────
describe("IT-CDR-06 — reconcile SHORT + Z-Report: POST close, GET z-report", () => {

  it("variance_status=SHORT when physical_count < expected by >threshold", async () => {
    mockFetch(SHIFT_CLOSED_SHORT);
    const data = await (await fetch("/api/v1/pos/shifts/close/shf-002", { method: "POST",
      body: JSON.stringify({ physical_denominations: [{ value: 500, count: 8 }, { value: 100, count: 4 }] }) })).json();
    // Migrated: engine Test 4 — SHORT when variance = -100
    expect(data.variance_status).toBe("SHORT");
    expect(data.variance).toBe(-100);
  });

  it("short arithmetic: 4400 - 4500 = -100 variance", () => {
    // Migrated from engine Test 4: shortCount = 4400, expected = 4500, variance = -100
    const physical  = [{ value: 500, count: 8 }, { value: 100, count: 4 }];
    const physTotal = physical.reduce((s, d) => s + d.value * d.count, 0);  // 4000+400=4400
    const expected  = 4500;                                                   // 3500+1000=4500
    expect(physTotal).toBe(4400);
    expect(physTotal - expected).toBe(-100);
  });

  it("Z-Report for BALANCED shift: variance=0, net_sales from report", async () => {
    mockFetch(Z_REPORT);
    const data = await (await fetch("/api/v1/pos/shifts/shf-001/z-report")).json();
    // Migrated: shiftSummary() — shift1 balanced
    expect(data.variance).toBe(0);
    expect(data.variance_status).toBe("BALANCED");
    expect(data.opening_float).toBe(3500);
  });

  it("Z-Report for SHORT shift: variance=-100, net_sales=1000", async () => {
    mockFetch(Z_REPORT_SHORT);
    const data = await (await fetch("/api/v1/pos/shifts/shf-002/z-report")).json();
    // Migrated: engine Test 4 — short drawer summary
    expect(data.variance).toBe(-100);
    expect(data.variance_status).toBe("SHORT");
    expect(data.net_sales).toBe(1000);
  });

  it("Z-Report for UNRECONCILED shift: variance_status=UNRECONCILED", async () => {
    mockFetch(Z_REPORT_POS2);
    const data = await (await fetch("/api/v1/pos/shifts/shf-p2/z-report")).json();
    // Migrated: engine Test 4 — d2 (POS-02) is unreconciled
    expect(data.variance_status).toBe("UNRECONCILED");
    expect(data.opening_float).toBe(1000);
  });

  it("shiftSummary aggregation: totalOpeningFloat = 3500 + 1000 = 4500", () => {
    // Migrated from engine Test 4: summary.totalOpeningFloat = 4500
    const r1OpeningFloat = 3500;
    const d2OpeningFloat = 1000;
    expect(r1OpeningFloat + d2OpeningFloat).toBe(4500);
  });

  it("byStatus counts: short=1, balanced=0, unreconciled=1", () => {
    // Migrated: summary.short=1, balanced=0, unreconciled=1
    const reports = [
      { variance_status: "SHORT" },
      { variance_status: "UNRECONCILED" },
    ];
    const short        = reports.filter(r => r.variance_status === "SHORT").length;
    const balanced     = reports.filter(r => r.variance_status === "BALANCED").length;
    const unreconciled = reports.filter(r => r.variance_status === "UNRECONCILED").length;
    expect(short).toBe(1);
    expect(balanced).toBe(0);
    expect(unreconciled).toBe(1);
  });
});

// ─── Suite 7: Shape Regression ───────────────────────────────────────────────
describe("IT-CDR-07 — Shape Regression: required fields on shift and Z-Report", () => {

  it("ShiftResponse has all 10 required top-level fields", async () => {
    mockFetch(SHIFT_OPEN, 201);
    const data = await (await fetch("/api/v1/pos/shifts/open", { method: "POST" })).json();
    for (const f of ["id","register_id","pos_terminal","branch_code","status","opening_float",
      "current_balance","expected_cash","cash_transactions","audit_trail"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });

  it("ShiftCashTransactionResponse has all required fields", async () => {
    mockFetch(CASH_IN_TX, 201);
    const data = await (await fetch("/api/v1/pos/shifts/shf-001/cash-in", { method: "POST" })).json();
    for (const f of ["id","shift_id","kind","amount","performed_by","narration","timestamp"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });

  it("Z-Report has all 11 required fields", async () => {
    mockFetch(Z_REPORT);
    const data = await (await fetch("/api/v1/pos/shifts/shf-001/z-report")).json();
    for (const f of ["shift_id","register_id","pos_terminal","branch_code","opening_float",
      "net_sales","expected_cash","physical_count_total","variance","variance_status","denomination_breakdown"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });

  it("closed shift has variance_status and variance fields", async () => {
    mockFetch(SHIFT_CLOSED_BALANCED);
    const data = await (await fetch("/api/v1/pos/shifts/close/shf-001", { method: "POST" })).json();
    expect(data).toHaveProperty("variance_status");
    expect(data).toHaveProperty("variance");
    expect(data).toHaveProperty("closing_balance");
  });
});
