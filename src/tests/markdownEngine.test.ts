/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.106.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import MarkdownEngine, { MARKDOWN_CONFIG } from "../utils/markdownEngine";

describe("MarkdownEngine — Markdown & Clearance Planning Engine", () => {
  const DEADLINE = "2026-09-30";
  const CREATED  = "2026-08-01";

  function makePlan() {
    return MarkdownEngine.createPlan({
      planName: "End-of-Season Clearance Aug-Sep 2026",
      branchCode: "BR-MUM-01",
      season: "CLEARANCE-AUG2026",
      targetSellThroughPct: 80,
      deadline: DEADLINE,
      skus: [
        { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m", basePrice: 120, openingStock: 200 },
        { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",   basePrice: 250, openingStock: 100 },
      ],
      steps: [
        { activateOn: "2026-08-15", discountPct: 10 },
        { activateOn: "2026-09-01", discountPct: 20 },
        { activateOn: "2026-09-15", discountPct: 35 },
      ],
      trigger: "SCHEDULED",
    });
  }

  // ─── Test 1: Plan creation & effective prices on step apply ──────────────
  it("creates plan with correct openingStock and computes effective prices when step applied", () => {
    let plan = makePlan();
    expect(plan.status).toBe("DRAFT");
    expect(plan.skuLines).toHaveLength(2);
    expect(plan.steps).toHaveLength(3);
    expect(plan.targetSellThroughPct).toBe(80);
    expect(plan.currentAvgSellThrough).toBe(0);

    // Apply step 1 (10% discount)
    plan = MarkdownEngine.activate(plan, "MGR-01");
    plan = MarkdownEngine.applyStep(plan, 1);

    // FAB-COTTON-WHT: 120 × (1-0.10) = 108
    expect(plan.skuLines[0].currentEffectivePrice).toBe(108);
    // FAB-DENIM-BLU: 250 × (1-0.10) = 225
    expect(plan.skuLines[1].currentEffectivePrice).toBe(225);
    expect(plan.steps[0].isActive).toBe(true);
    expect(plan.steps[1].isActive).toBe(false);
    expect(plan.skuLines[0].currentMarkdownStep).toBe(1);
  });

  // ─── Test 2: Sell-through recording & auto-completion at target ───────────
  it("records sell-through, computes sellThroughPct, marks COMPLETED when target hit", () => {
    let plan = makePlan();
    plan = MarkdownEngine.activate(plan, "MGR-01");
    plan = MarkdownEngine.applyStep(plan, 1);

    // Sell 160 of 200 (80%) Cotton and 80 of 100 (80%) Denim
    plan = MarkdownEngine.recordSellThrough(plan, [
      { sku: "FAB-COTTON-WHT", unitsSold: 160, currentStock: 40 },
      { sku: "FAB-DENIM-BLU",  unitsSold: 80,  currentStock: 20 },
    ]);

    // Cotton: 160/200 = 80%, Denim: 80/100 = 80%, avg = 80%
    expect(plan.skuLines[0].sellThroughPct).toBe(80);
    expect(plan.skuLines[1].sellThroughPct).toBe(80);
    expect(plan.currentAvgSellThrough).toBe(80);
    expect(plan.sellThroughGap).toBe(0);
    expect(plan.status).toBe("COMPLETED"); // Hit target → auto-complete
  });

  // ─── Test 3: Auto-trigger recommendation at 60% time / below 50% ST ──────
  it("fires auto-trigger when 60%+ time elapsed and sell-through < threshold", () => {
    let plan = makePlan();
    plan     = MarkdownEngine.activate(plan, "MGR-01");
    plan     = MarkdownEngine.applyStep(plan, 1);

    // Only 20% sell-through (below 50% threshold)
    plan = MarkdownEngine.recordSellThrough(plan, [
      { sku: "FAB-COTTON-WHT", unitsSold: 40, currentStock: 160 },
      { sku: "FAB-DENIM-BLU",  unitsSold: 20, currentStock: 80  },
    ]);
    expect(plan.currentAvgSellThrough).toBe(20);

    // Set asOf to 65% of campaign duration (createdAt=Aug01, deadline=Sep30 → ~60 days, 65% = ~day 39 = ~Sep 09)
    const campaignMs = new Date(DEADLINE).getTime() - new Date(CREATED).getTime();
    const asOf65Pct  = new Date(new Date(CREATED).getTime() + campaignMs * 0.65);

    // Override createdAt to match our CREATED date for the test
    plan = { ...plan, createdAt: CREATED + "T00:00:00.000Z" };
    plan = MarkdownEngine.checkAutoTrigger(plan, asOf65Pct);

    expect(plan.autoTriggerFired).toBe(true);
    expect(plan.nextRecommendedStep).toBe(2);  // Step 1 is active → recommend step 2
    expect(MARKDOWN_CONFIG.autoTriggerCheckPct).toBe(60);
    expect(MARKDOWN_CONFIG.autoTriggerThreshold).toBe(50);
  });

  // ─── Test 4: Sell-through report generation ───────────────────────────────
  it("generates sell-through report with correct time elapsed %, on-track flag, and recommendation", () => {
    let plan = makePlan();
    plan     = MarkdownEngine.activate(plan, "MGR-01");

    // 40% sell-through, behind pace
    plan = MarkdownEngine.recordSellThrough(plan, [
      { sku: "FAB-COTTON-WHT", unitsSold: 80, currentStock: 120 },
      { sku: "FAB-DENIM-BLU",  unitsSold: 40, currentStock: 60  },
    ]);
    plan = { ...plan, createdAt: CREATED + "T00:00:00.000Z", nextRecommendedStep: 2, autoTriggerFired: true };

    // At Aug 15 = 14 days of 60 elapsed ≈ 23.3% time → pace threshold = 80 × 0.233 = 18.7% → 40 ≥ 18.7 → onTrack=true
    const mid = new Date("2026-08-15T00:00:00.000Z");
    const report = MarkdownEngine.generateReport(plan, mid);

    expect(report.currentAvgSellThrough).toBe(40);
    expect(report.targetSellThrough).toBe(80);
    expect(report.sellThroughGap).toBe(40);
    expect(report.planName).toBe("End-of-Season Clearance Aug-Sep 2026");
    expect(report.skuLines).toHaveLength(2);
    // 40% sell-through at ~23% of campaign time → ahead of pace → onTrack=true
    expect(report.onTrack).toBe(true);
    // Report has recommendation because nextRecommendedStep is set
    expect(report.recommendation).toBeDefined();
    expect(report.recommendation).toContain("Step 2");
  });
});
