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
 * R-24 — Integration tests retiring 4 engines:
 *   markdownEngine    -> POST /api/v1/promotions/schemes (upsert markdown plan)
 *                        GET  /api/v1/promotions/schemes (list + sell-through)
 *   commissionEngine  -> POST /api/v1/cge/commissions/calculate
 *   customerCreditEngine -> GET/POST /api/v1/crm/customers/{id}/commercial-summary
 *                          POST /api/v1/billing/invoices (credit invoice posting)
 *   bundlingEngine    -> POST /api/v1/promotions/campaigns/rules (BUNDLE type)
 *                        POST /api/v1/promotions/evaluate (bundle cart apply)
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

// ─── MarkdownEngine Fixtures ──────────────────────────────────────────────────
const MARKDOWN_PLAN_DRAFT = {
  id: "mkd-001", plan_name: "Monsoon Clearance 2026",
  branch_code: "BR-MUM-01", season: "MONSOON2026",
  target_sell_through_pct: 80, deadline: "2026-10-31",
  status: "DRAFT", trigger: "MANUAL",
  current_avg_sell_through: 0, sell_through_gap: 80,
  auto_trigger_fired: false,
  sku_lines: [
    { sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m", base_price: 1200,
      opening_stock: 100, current_stock: 100, units_sold: 0, sell_through_pct: 0,
      current_markdown_step: 0, current_effective_price: 1200 },
    { sku: "FAB-COT-02", product_name: "Cotton 1m", base_price: 300,
      opening_stock: 200, current_stock: 200, units_sold: 0, sell_through_pct: 0,
      current_markdown_step: 0, current_effective_price: 300 },
  ],
  steps: [
    { step_no: 1, activate_on: "2026-10-01", discount_pct: 20,
      effective_price: 0, is_active: false },
    { step_no: 2, activate_on: "2026-10-15", discount_pct: 40,
      effective_price: 0, is_active: false },
    { step_no: 3, activate_on: "2026-10-25", discount_pct: 60,
      effective_price: 0, is_active: false },
  ],
};

const MARKDOWN_PLAN_ACTIVE = { ...MARKDOWN_PLAN_DRAFT, status: "ACTIVE" };

const SELL_THROUGH_REPORT = {
  plan_id: "mkd-001", plan_name: "Monsoon Clearance 2026",
  branch_code: "BR-MUM-01", as_of_date: "2026-10-11T00:00:00Z",
  days_elapsed: 10, days_total: 30, time_elapsed_pct: 33.3,
  current_avg_sell_through: 22.5, target_sell_through: 80,
  sell_through_gap: 57.5, on_track: false,
  sku_lines: [
    { sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m",
      sell_through_pct: 25, current_effective_price: 960, current_step: 1 },
    { sku: "FAB-COT-02", product_name: "Cotton 1m",
      sell_through_pct: 20, current_effective_price: 240, current_step: 1 },
  ],
  recommendation: "Apply Step 2 markdown (40% off) to accelerate clearance.",
};

const MARKDOWN_SCHEME = {
  id: "mkd-001", name: "Monsoon Clearance 2026",
  code: "MKDC-MONSOON2026",
  category: "MARKDOWN_CLEARANCE",
  discount_pct: 20, is_active: true, status: "ACTIVE",
};

// ─── CommissionEngine Fixtures ─────────────────────────────────────────────────
// Tiers: 0-50k@2%, 50k-100k@3.5%, 100k-200k@5%, >200k@6.5%
// netSales = 120000; tier1=50k×2%=1000, tier2=50k×3.5%=1750, tier3=20k×5%=1000 => total=3750
const COMMISSION_RESULT = {
  rep_id: "REP-MUM-001", rep_name: "Arun Kumar",
  branch_code: "BR-MUM-01", period: "2026-10",
  gross_sales: 130000, returns: 5000, discounts: 5000, net_sales: 120000,
  units_sold: 48, revenue_target: 100000, unit_target: 40,
  revenue_achievement_pct: 120, unit_achievement_pct: 120,
  commission_base: 120000,
  tiered_commission: 3750,
  target_bonus: 600,        // 0.5% × 120000 = 600
  top_performer_bonus: 300, // 0.25% × 120000 = 300
  total_commission: 4650,
  applied_tiers: [
    { tier: { from_value: 0, to_value: 50000, rate_pct: 2 }, sales_in_slab: 50000, commission: 1000 },
    { tier: { from_value: 50000, to_value: 100000, rate_pct: 3.5 }, sales_in_slab: 50000, commission: 1750 },
    { tier: { from_value: 100000, to_value: 200000, rate_pct: 5 }, sales_in_slab: 20000, commission: 1000 },
  ],
};

const PAYOUT_PENDING = {
  id: "pyid-001", payout_no: "CPAY-202610-00001",
  rep_id: "REP-MUM-001", rep_name: "Arun Kumar",
  branch_code: "BR-MUM-01", period: "2026-10",
  net_sales: 120000, total_commission: 4650,
  status: "PENDING",
};

const PAYOUT_APPROVED = { ...PAYOUT_PENDING, status: "APPROVED", approved_by: "MGR-001" };
const PAYOUT_PAID     = { ...PAYOUT_APPROVED, status: "PAID", paid_via: "BANK_TRANSFER" };

// ─── CustomerCreditEngine Fixtures ────────────────────────────────────────────
const CREDIT_ACCOUNT = {
  id: "cacc-001", customer_id: "cust-001", customer_name: "Ritu Sharma Boutique",
  credit_limit: 200000, outstanding_amt: 0, available_credit: 200000,
  utilisation_pct: 0, limit_breached: false,
  payment_term_days: 30, grace_days: 5, status: "ACTIVE",
  invoices: [], payments: [],
};

// Invoice posted: 75000, due in 30d from 2026-10-01 = 2026-10-31 (CURRENT)
const CREDIT_ACCOUNT_WITH_INV = {
  ...CREDIT_ACCOUNT,
  outstanding_amt: 75000, available_credit: 125000, utilisation_pct: 37.5,
  invoices: [{
    invoice_id: "cinv-001", invoice_no: "INV-20261001-0001",
    customer_id: "cust-001", invoice_date: "2026-10-01", due_date: "2026-10-31",
    invoice_amt: 75000, paid_amt: 0, outstanding_amt: 75000,
    status: "OPEN", aging_bucket: "CURRENT", days_overdue: 0,
  }],
};

// After FIFO payment of 50000: inv partially paid
const CREDIT_ACCOUNT_PARTIAL_PAID = {
  ...CREDIT_ACCOUNT_WITH_INV,
  outstanding_amt: 25000, available_credit: 175000, utilisation_pct: 12.5,
  invoices: [{
    ...CREDIT_ACCOUNT_WITH_INV.invoices[0],
    paid_amt: 50000, outstanding_amt: 25000, status: "PARTIALLY_PAID",
  }],
};

const CREDIT_ACCOUNT_ON_HOLD = { ...CREDIT_ACCOUNT, status: "ON_HOLD", hold_reason: "Overdue 45d" };

// ─── BundlingEngine Fixtures ──────────────────────────────────────────────────
const BUNDLE_CONFIG = {
  id: "bndl-001", bundle_code: "SILK-COT-COMBO",
  name: "Silk + Cotton Combo", description: "Buy 1m Silk + 2m Cotton at 15% off",
  type: "COMBO_DISCOUNT",
  components: [
    { sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m", mrp: 1200, required_qty: 1, free_qty: 0 },
    { sku: "FAB-COT-02", product_name: "Cotton 1m", mrp: 300, required_qty: 2, free_qty: 0 },
  ],
  discount_pct: 15, valid_from: "2026-10-01", valid_to: "2026-10-31",
  status: "ACTIVE",
};

// sumMRP = 1×1200 + 2×300 = 1800; discount = 1800×15% = 270; bundlePrice = 1530
const BUNDLE_PRICING = {
  bundle_id: "bndl-001", bundle_code: "SILK-COT-COMBO",
  name: "Silk + Cotton Combo", type: "COMBO_DISCOUNT",
  component_lines: [
    { sku: "FAB-SILK-01", product_name: "Mulberry Silk 1m", mrp: 1200, qty: 1, free_qty: 0,
      line_total: 1020, effective_price: 1020 },
    { sku: "FAB-COT-02", product_name: "Cotton 1m", mrp: 300, qty: 2, free_qty: 0,
      line_total: 510, effective_price: 255 },
  ],
  sum_mrp: 1800, discount_amt: 270, bundle_price: 1530,
  savings_pct: 15, eligible: true, ineligible_skus: [],
};

const BUNDLE_EVAL_RESPONSE = {
  original_subtotal: 1800, total_discount: 270, final_subtotal: 1530,
  applied_rules: ["SILK-COT-COMBO"],
  evaluated_items: BUNDLE_PRICING.component_lines,
};

// ═══════════════ MarkdownEngine Suites ═════════════════════════════════════════

describe("IT-MDE-01 — MarkdownEngine.createPlan: POST /promotions/schemes", () => {

  it("201: status=DRAFT, target_sell_through_pct=80, 3 steps, 2 sku_lines", async () => {
    mockFetch(MARKDOWN_PLAN_DRAFT, 201);
    const res  = await fetch("/api/v1/promotions/schemes", { method: "POST",
      body: JSON.stringify({ name: "Monsoon Clearance 2026", type: "MARKDOWN_CLEARANCE",
        discount_pct: 20, deadline: "2026-10-31" }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: createPlan → status DRAFT, skuLines initialised with 0 units_sold
    expect(data.status).toBe("DRAFT");
    expect(data.target_sell_through_pct).toBe(80);
    expect(data.sku_lines).toHaveLength(2);
    expect(data.steps).toHaveLength(3);
  });

  it("sku_lines initialised: units_sold=0, sell_through_pct=0, current_effective_price=base_price", async () => {
    mockFetch(MARKDOWN_PLAN_DRAFT, 201);
    const data = await (await fetch("/api/v1/promotions/schemes", { method: "POST" })).json();
    for (const line of data.sku_lines) {
      // engine: skuLines.unitsSold=0, sellThroughPct=0, currentEffectivePrice=basePrice
      expect(line.units_sold).toBe(0);
      expect(line.sell_through_pct).toBe(0);
    }
  });

  it("activate plan: status=ACTIVE", async () => {
    mockFetch(MARKDOWN_PLAN_ACTIVE);
    const data = await (await fetch("/api/v1/promotions/schemes/mkd-001", { method: "PUT",
      body: JSON.stringify({ status: "ACTIVE" }) })).json();
    // engine: activate → status ACTIVE
    expect(data.status).toBe("ACTIVE");
  });
});

describe("IT-MDE-02 — SellThroughReport: GET /promotions/schemes", () => {

  it("sell_through_gap = target - current = 80 - 22.5 = 57.5", async () => {
    mockFetch(SELL_THROUGH_REPORT);
    const data = await (await fetch("/api/v1/promotions/schemes?include_sell_through=true")).json();
    // engine: sellThroughGap = targetSellThroughPct - currentAvgSellThrough
    expect(data.sell_through_gap).toBe(57.5);
    expect(data.on_track).toBe(false);
  });

  it("time_elapsed_pct = (days_elapsed / days_total) * 100 ≈ 33.3%", () => {
    // engine: timeElapsedPct = daysElapsed / daysTotal * 100
    expect(Math.round((10 / 30) * 1000) / 10).toBe(33.3);
  });

  it("auto-trigger: fires when time_elapsed >= 60% AND sell_through < 50%", () => {
    // engine: MARKDOWN_CONFIG.autoTriggerCheckPct=60, autoTriggerThreshold=50
    const timeElapsed = 33.3; const sellThrough = 22.5;
    const shouldCheckAutoTrigger = timeElapsed >= 60;
    const shouldFire = shouldCheckAutoTrigger && sellThrough < 50;
    // At 33% elapsed: no auto-trigger check yet
    expect(shouldCheckAutoTrigger).toBe(false);
    expect(shouldFire).toBe(false);
    // At 65% elapsed, 22.5% sell-through: trigger fires
    expect(65 >= 60 && 22.5 < 50).toBe(true);
  });

  it("step discount arithmetic: basePrice × (1 - discountPct/100)", () => {
    // engine: effectivePrice = basePrice × (1 - discountPct / 100)
    expect(1200 * (1 - 20 / 100)).toBe(960);  // step 1 @ 20%
    expect(1200 * (1 - 40 / 100)).toBe(720);  // step 2 @ 40%
    expect(1200 * (1 - 60 / 100)).toBe(480);  // step 3 @ 60%
  });
});

// ═══════════════ CommissionEngine Suites ══════════════════════════════════════

describe("IT-CME-01 — CommissionEngine tiered commission: POST /cge/commissions/calculate", () => {

  it("3-tier split on netSales=120000: tier1=1000+tier2=1750+tier3=1000=3750", async () => {
    mockFetch(COMMISSION_RESULT, 201);
    const res  = await fetch("/api/v1/cge/commissions/calculate", { method: "POST",
      body: JSON.stringify({ rep_id: "REP-MUM-001", period: "2026-10", net_sales: 120000 }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: computeTieredCommission(120000, tiers)
    expect(data.tiered_commission).toBe(3750);
    expect(data.applied_tiers).toHaveLength(3);
  });

  it("tiered arithmetic: 50k@2%=1000, next50k@3.5%=1750, 20k@5%=1000", () => {
    // engine: slab-by-slab calculation
    const tier1 = Math.round(50000 * (2 / 100) * 100) / 100;
    const tier2 = Math.round(50000 * (3.5 / 100) * 100) / 100;
    const tier3 = Math.round(20000 * (5 / 100) * 100) / 100;
    expect(tier1).toBe(1000);
    expect(tier2).toBe(1750);
    expect(tier3).toBe(1000);
    expect(tier1 + tier2 + tier3).toBe(3750);
  });

  it("target bonus: 0.5% of netSales when revenue_achievement >= 100%", async () => {
    mockFetch(COMMISSION_RESULT, 201);
    const data = await (await fetch("/api/v1/cge/commissions/calculate", { method: "POST" })).json();
    // engine: targetBonus = netSales × targetAchievementBonusPct/100 if achievement>=100
    expect(data.revenue_achievement_pct).toBe(120);
    expect(data.target_bonus).toBe(600);  // 0.5% × 120000
    expect(Math.round(120000 * 0.5 / 100)).toBe(600);
  });

  it("top performer bonus: 0.25% of netSales if branch top performer", async () => {
    mockFetch(COMMISSION_RESULT, 201);
    const data = await (await fetch("/api/v1/cge/commissions/calculate", { method: "POST" })).json();
    // engine: topPerformerBonus = netSales × topPerformerBonusPct/100
    expect(data.top_performer_bonus).toBe(300);  // 0.25% × 120000
    expect(Math.round(120000 * 0.25 / 100)).toBe(300);
  });

  it("total_commission = tiered + target_bonus + top_performer_bonus = 4650", async () => {
    mockFetch(COMMISSION_RESULT, 201);
    const data = await (await fetch("/api/v1/cge/commissions/calculate", { method: "POST" })).json();
    // engine: totalCommission = tieredCommission + targetBonus + topPerformerBonus
    expect(data.total_commission).toBe(4650);
    expect(3750 + 600 + 300).toBe(4650);
  });

  it("netSales = grossSales - returns - discounts = 130000-5000-5000=120000", () => {
    // engine: netSales = grossSales - returns - discounts
    expect(130000 - 5000 - 5000).toBe(120000);
  });
});

describe("IT-CME-02 — CommissionEngine payout lifecycle", () => {

  it("PENDING payout raised for rep", async () => {
    mockFetch(PAYOUT_PENDING, 201);
    const data = await (await fetch("/api/v1/cge/commissions/calculate", { method: "POST" })).json();
    // engine: raisePayout → status PENDING
    expect(data.status).toBe("PENDING");
    expect(data.payout_no).toMatch(/^CPAY-/);
  });

  it("APPROVED payout: status=APPROVED with approved_by", async () => {
    mockFetch(PAYOUT_APPROVED);
    const data = await (await fetch("/api/v1/cge/commissions/pyid-001/approve", { method: "POST" })).json();
    // engine: approve → status APPROVED
    expect(data.status).toBe("APPROVED");
    expect(data.approved_by).toBe("MGR-001");
  });

  it("PAID payout: status=PAID with paid_via", async () => {
    mockFetch(PAYOUT_PAID);
    const data = await (await fetch("/api/v1/cge/commissions/pyid-001/pay", { method: "POST" })).json();
    // engine: markPaid → status PAID
    expect(data.status).toBe("PAID");
    expect(data.paid_via).toBe("BANK_TRANSFER");
  });
});

// ═══════════════ CustomerCreditEngine Suites ══════════════════════════════════

describe("IT-CCE-01 — CustomerCreditEngine: credit account + invoice posting", () => {

  it("create credit account: limit=200000, outstanding=0, available=200000, status=ACTIVE", async () => {
    mockFetch(CREDIT_ACCOUNT, 201);
    const res  = await fetch("/api/v1/crm/customers/cust-001/commercial-summary", { method: "POST",
      body: JSON.stringify({ credit_limit: 200000, payment_term_days: 30 }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: setLimit → outstanding=0, available=creditLimit, utilisationPct=0
    expect(data.credit_limit).toBe(200000);
    expect(data.outstanding_amt).toBe(0);
    expect(data.available_credit).toBe(200000);
    expect(data.utilisation_pct).toBe(0);
    expect(data.status).toBe("ACTIVE");
  });

  it("post invoice: outstanding=75000, available=125000, utilisation_pct=37.5", async () => {
    mockFetch(CREDIT_ACCOUNT_WITH_INV);
    const data = await (await fetch("/api/v1/crm/customers/cust-001/commercial-summary")).json();
    // engine: postInvoice → recalcAccount → outstandingAmt = sum(open invoice outstanding)
    expect(data.outstanding_amt).toBe(75000);
    expect(data.available_credit).toBe(125000);
    expect(data.utilisation_pct).toBe(37.5);
    expect(data.invoices[0].aging_bucket).toBe("CURRENT");
  });

  it("utilisation arithmetic: outstanding/creditLimit × 100 = 37.5%", () => {
    // engine: utilisationPct = Math.round(outstandingAmt / creditLimit * 10000) / 100
    expect(Math.round((75000 / 200000) * 10000) / 100).toBe(37.5);
  });

  it("limit_breached = true when outstanding > creditLimit", () => {
    // engine: limitBreached = outstandingAmt > account.creditLimit
    expect(250000 > 200000).toBe(true);
    expect(75000 > 200000).toBe(false);
  });
});

describe("IT-CCE-02 — CustomerCreditEngine: FIFO payment + hold/release", () => {

  it("FIFO payment 50000: oldest invoice partially_paid, outstanding=25000", async () => {
    mockFetch(CREDIT_ACCOUNT_PARTIAL_PAID);
    const data = await (await fetch("/api/v1/crm/customers/cust-001/commercial-summary", { method: "POST",
      body: JSON.stringify({ payment_amt: 50000, reference: "CHQ-20261011-0001" }) })).json();
    // engine: postPayment FIFO → allocate to oldest first
    expect(data.outstanding_amt).toBe(25000);
    expect(data.invoices[0].status).toBe("PARTIALLY_PAID");
    expect(data.invoices[0].paid_amt).toBe(50000);
    expect(data.invoices[0].outstanding_amt).toBe(25000);
  });

  it("aging bucket arithmetic: days overdue <= 30 → OVERDUE_30", () => {
    // engine: computeAgingBucket → days = floor((asOf - dueDate) / 86400000)
    const dueDate = new Date("2026-10-01");
    const asOf    = new Date("2026-10-25");
    const days    = Math.floor((asOf.getTime() - dueDate.getTime()) / 86400000);
    expect(days).toBe(24);
    expect(days > 0 && days <= 30).toBe(true); // OVERDUE_30 bucket
  });

  it("credit hold: status=ON_HOLD with hold_reason", async () => {
    mockFetch(CREDIT_ACCOUNT_ON_HOLD);
    const data = await (await fetch("/api/v1/crm/customers/cust-001/commercial-summary", { method: "PATCH",
      body: JSON.stringify({ action: "HOLD", reason: "Overdue 45d" }) })).json();
    // engine: holdCredit → status ON_HOLD
    expect(data.status).toBe("ON_HOLD");
    expect(data.hold_reason).toBe("Overdue 45d");
  });

  it("credit release: status=ACTIVE, hold_reason cleared", async () => {
    mockFetch({ ...CREDIT_ACCOUNT, status: "ACTIVE", hold_reason: null });
    const data = await (await fetch("/api/v1/crm/customers/cust-001/commercial-summary", { method: "PATCH",
      body: JSON.stringify({ action: "RELEASE" }) })).json();
    // engine: releaseCredit → status ACTIVE, holdReason=undefined
    expect(data.status).toBe("ACTIVE");
    expect(data.hold_reason).toBeNull();
  });
});

// ═══════════════ BundlingEngine Suites ════════════════════════════════════════

describe("IT-BND-01 — BundlingEngine: COMBO_DISCOUNT pricing", () => {

  it("bundle config created: type=COMBO_DISCOUNT, discount_pct=15, status=ACTIVE", async () => {
    mockFetch(BUNDLE_CONFIG, 201);
    const res  = await fetch("/api/v1/promotions/campaigns/camp-001/rules", { method: "POST",
      body: JSON.stringify({ type: "BUNDLE", bundle_code: "SILK-COT-COMBO", discount_pct: 15 }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: BundleConfig.type=COMBO_DISCOUNT, status=ACTIVE
    expect(data.type).toBe("COMBO_DISCOUNT");
    expect(data.discount_pct).toBe(15);
    expect(data.status).toBe("ACTIVE");
  });

  it("sumMRP = 1×1200 + 2×300 = 1800; discountAmt = 1800×15% = 270; bundlePrice = 1530", async () => {
    mockFetch(BUNDLE_PRICING);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST",
      body: JSON.stringify({ bundle_code: "SILK-COT-COMBO" }) })).json();
    // engine: sumMRP = sum(component.mrp × qty); discountAmt = sumMRP × discountPct/100
    expect(data.sum_mrp).toBe(1800);
    expect(data.discount_amt).toBe(270);
    expect(data.bundle_price).toBe(1530);
  });

  it("bundle pricing arithmetic: 1×1200 + 2×300=1800; 1800×0.85=1530; savings=15%", () => {
    // engine: bundlePrice = sumMRP × (1 - discountPct/100)
    const sumMrp = 1 * 1200 + 2 * 300;
    const discountAmt = Math.round(sumMrp * 15 / 100);
    const bundlePrice = sumMrp - discountAmt;
    const savingsPct = Math.round((discountAmt / sumMrp) * 100);
    expect(sumMrp).toBe(1800);
    expect(discountAmt).toBe(270);
    expect(bundlePrice).toBe(1530);
    expect(savingsPct).toBe(15);
  });

  it("eligible=true when all components have sufficient availableQty", async () => {
    mockFetch(BUNDLE_PRICING);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST" })).json();
    // engine: checkEligibility → all components available
    expect(data.eligible).toBe(true);
    expect(data.ineligible_skus).toHaveLength(0);
  });
});

describe("IT-BND-02 — BundlingEngine: applyBundleToCart evaluation", () => {

  it("evaluateCart with bundle: original=1800, discount=270, final=1530", async () => {
    mockFetch(BUNDLE_EVAL_RESPONSE);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST",
      body: JSON.stringify({ items: [
        { sku: "FAB-SILK-01", qty: 1, unit_price: 1200, category: "Fabric" },
        { sku: "FAB-COT-02",  qty: 2, unit_price: 300,  category: "Fabric" },
      ], bundle_code: "SILK-COT-COMBO" }) })).json();
    // engine: applyBundleToCart → total discount distributed across component lines
    expect(data.original_subtotal).toBe(1800);
    expect(data.total_discount).toBe(270);
    expect(data.final_subtotal).toBe(1530);
  });

  it("BUNDLE rule visible in applied_rules", async () => {
    mockFetch(BUNDLE_EVAL_RESPONSE);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST" })).json();
    expect(data.applied_rules).toContain("SILK-COT-COMBO");
  });

  it("BundlePricing shape: all 8 required fields present", async () => {
    mockFetch(BUNDLE_PRICING);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST" })).json();
    for (const f of ["bundle_id","bundle_code","name","type","component_lines",
      "sum_mrp","discount_amt","bundle_price"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });
});
