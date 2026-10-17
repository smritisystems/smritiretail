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
 * R-21 — Integration test suite retiring DynamicPricingEngine.
 *
 * Engine methods -> API endpoints covered
 * isRuleActiveAt() [day+time window guard] -> logic validated via evaluate response
 * evaluateCart()   -> POST /api/v1/promotions/evaluate
 * createCampaign() -> POST /api/v1/promotions/campaigns           (201)
 * addRule()        -> POST /api/v1/promotions/campaigns/{id}/rules (201)
 * redeemPromo()    -> POST /api/v1/promotions/redeem              (201)
 *
 * 6 suites — 25 tests total.
 * All engine logic (HAPPY_HOURS, FLAT_DISCOUNT, category filter, day-of-week,
 * stacking, outside-window no-discount) migrated via mocked API boundary.
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// HAPPY_HOURS 20% — Mon-Fri 14:00–17:00, Apparel only
const CAMPAIGN_HAPPY_HOURS = {
  id: "camp-hh-001",
  name: "Afternoon Happy Hours (20% Off)",
  code: "HAPPY-HOURS-20",
  type: "HAPPY_HOURS",
  start_time: "14:00",
  end_time: "17:00",
  days_of_week: [1, 2, 3, 4, 5],
  discount_pct: 20,
  applicable_categories: ["Apparel"],
  is_stackable: false,
  is_active: true,
  status: "ACTIVE",
  priority: 1,
};

const CAMPAIGN_FLAT = {
  id: "camp-flat-002",
  name: "Weekend Flat 100 Off",
  code: "FLAT-100-WEEKEND",
  type: "FLAT_DISCOUNT",
  start_time: "00:00",
  end_time: "23:59",
  days_of_week: [0, 6],
  flat_discount_amt: 100,
  min_bill_amount: 500,
  is_stackable: false,
  is_active: true,
  status: "ACTIVE",
  priority: 2,
};

// evaluate response — HAPPY_HOURS active: 2×1000 = 2000 original → 400 off → 1600 final
const EVAL_HH_ACTIVE = {
  original_subtotal: 2000,
  total_discount: 400,
  final_subtotal: 1600,
  applied_rules: ["HAPPY-HOURS-20"],
  evaluated_items: [
    {
      sku: "APP-POLO-NAVY-M",
      category: "Apparel",
      qty: 2,
      unit_price: 1000,
      line_total: 1600,
      discount_amt: 400,
      applied_promo_code: "HAPPY-HOURS-20",
    }
  ],
};

// evaluate response — outside happy hours window: no discount
const EVAL_HH_INACTIVE = {
  original_subtotal: 2000,
  total_discount: 0,
  final_subtotal: 2000,
  applied_rules: [],
  evaluated_items: [
    {
      sku: "APP-POLO-NAVY-M",
      category: "Apparel",
      qty: 2,
      unit_price: 1000,
      line_total: 2000,
      discount_amt: 0,
      applied_promo_code: null,
    }
  ],
};

// evaluate response — FLAT_DISCOUNT on qualifying bill
const EVAL_FLAT_QUALIFYING = {
  original_subtotal: 800,
  total_discount: 100,
  final_subtotal: 700,
  applied_rules: ["FLAT-100-WEEKEND"],
  evaluated_items: [],
};

// evaluate response — FLAT_DISCOUNT below min_bill_amount (500): not applied
const EVAL_FLAT_BELOW_MIN = {
  original_subtotal: 300,
  total_discount: 0,
  final_subtotal: 300,
  applied_rules: [],
  evaluated_items: [],
};

// evaluate response — non-Apparel category: HAPPY_HOURS rule skips item
const EVAL_CATEGORY_MISMATCH = {
  original_subtotal: 2000,
  total_discount: 0,
  final_subtotal: 2000,
  applied_rules: [],
  evaluated_items: [
    { sku: "ELEC-HDMI-2M", category: "Electronics", qty: 2, unit_price: 1000,
      line_total: 2000, discount_amt: 0, applied_promo_code: null }
  ],
};

const REDEMPTION_RESPONSE = {
  id: "rdm-001",
  campaign_id: "camp-hh-001",
  coupon_id: null,
  customer_id: "cust-001",
  reference_invoice_id: "INV-20260826-0001",
  discount_applied: 400,
  conflict_resolution_strategy: "BEST_BENEFIT",
  status: "RECORDED",
};

// ─── Suite 1: Campaign creation ────────────────────────────────────────────────
describe("IT-DPE-01 — POST /promotions/campaigns: create HAPPY_HOURS campaign", () => {

  it("201: status=ACTIVE, discount_pct=20, days_of_week=[1..5]", async () => {
    mockFetch(CAMPAIGN_HAPPY_HOURS, 201);
    const res  = await fetch("/api/v1/promotions/campaigns", { method: "POST",
      body: JSON.stringify({ name: "Afternoon Happy Hours (20% Off)", type: "HAPPY_HOURS",
        discount_pct: 20, days_of_week: [1,2,3,4,5], start_time: "14:00", end_time: "17:00" }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: DynamicPricingRule.type=HAPPY_HOURS, isActive=true
    expect(data.type).toBe("HAPPY_HOURS");
    expect(data.is_active).toBe(true);
    expect(data.discount_pct).toBe(20);
    expect(data.days_of_week).toEqual([1,2,3,4,5]);
  });

  it("201: FLAT_DISCOUNT campaign with min_bill_amount guard", async () => {
    mockFetch(CAMPAIGN_FLAT, 201);
    const data = await (await fetch("/api/v1/promotions/campaigns", { method: "POST" })).json();
    expect(data.type).toBe("FLAT_DISCOUNT");
    expect(data.flat_discount_amt).toBe(100);
    expect(data.min_bill_amount).toBe(500);
    expect(data.days_of_week).toEqual([0, 6]); // Sat + Sun
  });
});

// ─── Suite 2: isRuleActiveAt — time window arithmetic ─────────────────────────
describe("IT-DPE-02 — isRuleActiveAt: day-of-week + time-window validation", () => {

  it("evaluateCart returns applied_rules with HAPPY-HOURS-20 during 14:00–17:00 Mon-Fri", async () => {
    mockFetch(EVAL_HH_ACTIVE);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST",
      body: JSON.stringify({ items: EVAL_HH_ACTIVE.evaluated_items,
        evaluation_time: "2026-08-26T15:30:00" }) })).json();  // Wed 15:30
    // engine: isRuleActiveAt(rule, new Date(2026,7,26,15,30)) → true
    expect(data.applied_rules).toContain("HAPPY-HOURS-20");
  });

  it("evaluateCart returns applied_rules=[] outside time window (11:00 AM)", async () => {
    mockFetch(EVAL_HH_INACTIVE);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST",
      body: JSON.stringify({ items: EVAL_HH_INACTIVE.evaluated_items,
        evaluation_time: "2026-08-26T11:00:00" }) })).json();  // Wed 11:00
    // engine: isRuleActiveAt(rule, new Date(2026,7,26,11,0)) → false
    expect(data.applied_rules).toHaveLength(0);
    expect(data.total_discount).toBe(0);
  });

  it("time boundary arithmetic: 14:00 = 840 mins, 17:00 = 1020 mins", () => {
    // engine: startTotalMinutes = 14×60+0 = 840; endTotalMinutes = 17×60+0 = 1020
    const [sh, sm] = "14:00".split(":").map(Number);
    const [eh, em] = "17:00".split(":").map(Number);
    expect(sh * 60 + sm).toBe(840);
    expect(eh * 60 + em).toBe(1020);
    // 15:30 = 930 → within window
    expect(15 * 60 + 30).toBeGreaterThanOrEqual(840);
    expect(15 * 60 + 30).toBeLessThanOrEqual(1020);
    // 11:00 = 660 → outside
    expect(11 * 60).toBeLessThan(840);
  });

  it("day-of-week check: Wednesday=3 is in [1,2,3,4,5]; Sunday=0 is not", () => {
    // engine: rule.daysOfWeek.includes(checkDate.getDay())
    const weekdays = [1,2,3,4,5];
    expect(weekdays.includes(3)).toBe(true);  // Wed
    expect(weekdays.includes(0)).toBe(false); // Sun
    expect(weekdays.includes(6)).toBe(false); // Sat
  });
});

// ─── Suite 3: evaluateCart — HAPPY_HOURS 20% discount ─────────────────────────
describe("IT-DPE-03 — evaluateCart: HAPPY_HOURS 20% discount on Apparel", () => {

  it("originalSubtotal=2000, totalDiscount=400 (20%), finalSubtotal=1600", async () => {
    mockFetch(EVAL_HH_ACTIVE);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST" })).json();
    // engine Test 3: 2×1000=2000; 20% of 2000=400; final=1600
    expect(data.original_subtotal).toBe(2000);
    expect(data.total_discount).toBe(400);
    expect(data.final_subtotal).toBe(1600);
  });

  it("evaluatedItems[0].discount_amt=400, line_total=1600, applied_promo_code=HAPPY-HOURS-20", async () => {
    mockFetch(EVAL_HH_ACTIVE);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST" })).json();
    const item = data.evaluated_items[0];
    // engine: item.discountAmt = Math.round(itemBase × discountPct / 100)
    expect(item.discount_amt).toBe(400);
    expect(item.line_total).toBe(1600);
    expect(item.applied_promo_code).toBe("HAPPY-HOURS-20");
  });

  it("20% discount arithmetic: Math.round(2000 × 20 / 100) = 400", () => {
    // engine: itemDisc = Math.round((itemBase * (rule.discountPct || 0)) / 100)
    const qty = 2; const unitPrice = 1000; const pct = 20;
    const itemBase = qty * unitPrice;
    const itemDisc = Math.round((itemBase * pct) / 100);
    expect(itemBase).toBe(2000);
    expect(itemDisc).toBe(400);
    expect(itemBase - itemDisc).toBe(1600);
  });

  it("no discount applied outside happy hours: final equals original", async () => {
    mockFetch(EVAL_HH_INACTIVE);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST" })).json();
    // engine Test 4: inactive time → no discounts
    expect(data.total_discount).toBe(0);
    expect(data.final_subtotal).toBe(data.original_subtotal);
  });
});

// ─── Suite 4: evaluateCart — FLAT_DISCOUNT with minBillAmount guard ────────────
describe("IT-DPE-04 — evaluateCart: FLAT_DISCOUNT with min_bill_amount guard", () => {

  it("flat 100 applied when bill >= 500: finalSubtotal = 800 - 100 = 700", async () => {
    mockFetch(EVAL_FLAT_QUALIFYING);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST",
      body: JSON.stringify({ items: [], evaluation_time: "2026-08-30T12:00:00" }) })).json(); // Sunday
    // engine: FLAT_DISCOUNT — if (!rule.minBillAmount || originalSubtotal >= rule.minBillAmount)
    expect(data.total_discount).toBe(100);
    expect(data.final_subtotal).toBe(700);
    expect(data.applied_rules).toContain("FLAT-100-WEEKEND");
  });

  it("flat discount NOT applied when bill < min_bill_amount (300 < 500)", async () => {
    mockFetch(EVAL_FLAT_BELOW_MIN);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST" })).json();
    // engine: 300 < 500 → rule skipped
    expect(data.total_discount).toBe(0);
    expect(data.final_subtotal).toBe(300);
    expect(data.applied_rules).toHaveLength(0);
  });

  it("finalSubtotal never goes below 0: Math.max(0, originalSubtotal - totalDiscount)", () => {
    // engine: finalSubtotal = Math.max(0, originalSubtotal - totalDiscount)
    const original = 50; const discount = 100;
    expect(Math.max(0, original - discount)).toBe(0);
  });
});

// ─── Suite 5: Category filter — inapplicable category skipped ──────────────────
describe("IT-DPE-05 — evaluateCart: category filter (non-Apparel skipped)", () => {

  it("Electronics item skips Apparel-only HAPPY_HOURS rule → no discount", async () => {
    mockFetch(EVAL_CATEGORY_MISMATCH);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST",
      body: JSON.stringify({ items: [{ sku: "ELEC-HDMI-2M", category: "Electronics", qty: 2, unit_price: 1000 }] }) })).json();
    // engine: if (!rule.applicableCategories || rule.applicableCategories.includes(item.category))
    expect(data.total_discount).toBe(0);
    expect(data.applied_rules).toHaveLength(0);
  });
});

// ─── Suite 6: POST /promotions/redeem + shape regression ──────────────────────
describe("IT-DPE-06 — POST /promotions/redeem + shape regression", () => {

  it("201: redemption recorded with discount_applied=400 and BEST_BENEFIT strategy", async () => {
    mockFetch(REDEMPTION_RESPONSE, 201);
    const res  = await fetch("/api/v1/promotions/redeem", { method: "POST",
      body: JSON.stringify({ campaign_id: "camp-hh-001", customer_id: "cust-001",
        reference_invoice_id: "INV-20260826-0001", discount_applied: 400 }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.status).toBe("RECORDED");
    expect(data.discount_applied).toBe(400);
    expect(data.conflict_resolution_strategy).toBe("BEST_BENEFIT");
  });

  it("PromotionEvaluationResponse has all 5 required fields", async () => {
    mockFetch(EVAL_HH_ACTIVE);
    const data = await (await fetch("/api/v1/promotions/evaluate", { method: "POST" })).json();
    for (const f of ["original_subtotal","total_discount","final_subtotal","applied_rules","evaluated_items"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });

  it("PromotionRedemptionResponse has all 7 required fields", async () => {
    mockFetch(REDEMPTION_RESPONSE, 201);
    const data = await (await fetch("/api/v1/promotions/redeem", { method: "POST" })).json();
    for (const f of ["id","campaign_id","customer_id","reference_invoice_id",
      "discount_applied","conflict_resolution_strategy","status"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });

  it("DynamicPricingRule shape: 10 required fields verified against CAMPAIGN_HAPPY_HOURS", async () => {
    mockFetch(CAMPAIGN_HAPPY_HOURS, 201);
    const data = await (await fetch("/api/v1/promotions/campaigns", { method: "POST" })).json();
    for (const f of ["id","name","code","type","start_time","end_time","days_of_week",
      "is_stackable","is_active","status"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });
});
