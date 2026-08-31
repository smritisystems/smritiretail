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

/**
 * Markdown & Clearance Planning Engine
 *
 * Manages SKU-level markdown schedules and clearance campaigns:
 *   Markdown Plan   : DRAFT → ACTIVE → PAUSED → COMPLETED / CANCELLED
 *
 *   Sell-Through    : Target sell-through% by deadline; engine computes
 *                     current sell-through and gap.
 *
 *   Auto-Trigger    : If current sell-through < target threshold at
 *                     MARKDOWN_CONFIG.autoTriggerCheckPct of time elapsed,
 *                     engine recommends the next markdown step.
 *
 *   Steps           : Progressive price reduction steps with activation
 *                     dates and effective discount %.
 */

export type MarkdownStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type MarkdownTrigger = "MANUAL" | "AUTO_THRESHOLD" | "SCHEDULED";

export interface MarkdownStep {
  stepNo: number;
  activateOn: string;         // ISO date
  discountPct: number;
  effectivePrice: number;     // basePrice × (1 - discountPct/100)
  isActive: boolean;
  activatedAt?: string;
}

export interface MarkdownSKULine {
  sku: string;
  productName: string;
  basePrice: number;
  openingStock: number;       // Stock at plan creation
  currentStock: number;       // Updated on each sell-through report
  unitsSold: number;
  sellThroughPct: number;     // unitsSold / openingStock × 100
  currentMarkdownStep: number;
  currentEffectivePrice: number;
}

export interface MarkdownPlan {
  planId: string;
  planName: string;
  branchCode: string;
  season: string;             // e.g. "SS2026", "MONSOON2026", "CLEARANCE-AUG2026"
  targetSellThroughPct: number;
  deadline: string;           // ISO date by which target must be hit
  skuLines: MarkdownSKULine[];
  steps: MarkdownStep[];
  status: MarkdownStatus;
  trigger: MarkdownTrigger;
  currentAvgSellThrough: number;
  sellThroughGap: number;     // targetSellThroughPct - currentAvgSellThrough
  nextRecommendedStep?: number;
  autoTriggerFired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SellThroughReport {
  planId: string;
  planName: string;
  branchCode: string;
  asOfDate: string;
  daysElapsed: number;
  daysTotal: number;
  timeElapsedPct: number;
  currentAvgSellThrough: number;
  targetSellThrough: number;
  sellThroughGap: number;
  onTrack: boolean;
  skuLines: Array<{ sku: string; productName: string; sellThroughPct: number; currentEffectivePrice: number; currentStep: number }>;
  recommendation?: string;
}

export const MARKDOWN_CONFIG = {
  autoTriggerCheckPct:  60,    // Check auto-trigger when 60% of campaign duration has elapsed
  autoTriggerThreshold: 50,    // Fire next step if sell-through < 50% at the check point
};

export class MarkdownEngine {
  private static planCounter = 1;

  public static createPlan(params: {
    planName: string;
    branchCode: string;
    season: string;
    targetSellThroughPct: number;
    deadline: string;
    skus: Array<{ sku: string; productName: string; basePrice: number; openingStock: number }>;
    steps: Array<{ activateOn: string; discountPct: number }>;
    trigger?: MarkdownTrigger;
  }): MarkdownPlan {
    const now = new Date().toISOString();

    const steps: MarkdownStep[] = params.steps.map((s, i) => ({
      stepNo: i + 1,
      activateOn: s.activateOn,
      discountPct: s.discountPct,
      effectivePrice: 0,  // Will be set per SKU
      isActive: false,
    }));

    const skuLines: MarkdownSKULine[] = params.skus.map((s) => ({
      sku: s.sku,
      productName: s.productName,
      basePrice: s.basePrice,
      openingStock: s.openingStock,
      currentStock: s.openingStock,
      unitsSold: 0,
      sellThroughPct: 0,
      currentMarkdownStep: 0,
      currentEffectivePrice: s.basePrice,
    }));

    return {
      planId: `MKDPLN-${this.planCounter++}-${Date.now()}`,
      planName: params.planName,
      branchCode: params.branchCode,
      season: params.season,
      targetSellThroughPct: params.targetSellThroughPct,
      deadline: params.deadline,
      skuLines,
      steps,
      status: "DRAFT",
      trigger: params.trigger ?? "MANUAL",
      currentAvgSellThrough: 0,
      sellThroughGap: params.targetSellThroughPct,
      autoTriggerFired: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  public static activate(plan: MarkdownPlan, activatedBy: string): MarkdownPlan {
    return { ...plan, status: "ACTIVE", updatedAt: new Date().toISOString() };
  }

  public static pause(plan: MarkdownPlan): MarkdownPlan {
    return { ...plan, status: "PAUSED", updatedAt: new Date().toISOString() };
  }

  public static cancel(plan: MarkdownPlan): MarkdownPlan {
    return { ...plan, status: "CANCELLED", updatedAt: new Date().toISOString() };
  }

  /** Apply a markdown step — updates all SKU line effective prices */
  public static applyStep(plan: MarkdownPlan, stepNo: number): MarkdownPlan {
    const now = new Date().toISOString();
    const steps = plan.steps.map((s) => ({
      ...s,
      isActive: s.stepNo === stepNo,
      activatedAt: s.stepNo === stepNo ? now : s.activatedAt,
    }));

    const step = steps.find((s) => s.stepNo === stepNo);
    if (!step) return plan;

    const skuLines = plan.skuLines.map((l) => {
      const effectivePrice = Math.round(l.basePrice * (1 - step.discountPct / 100) * 100) / 100;
      return { ...l, currentMarkdownStep: stepNo, currentEffectivePrice: effectivePrice };
    });

    return { ...plan, steps, skuLines, updatedAt: now };
  }

  /** Record sell-through update for a set of SKUs */
  public static recordSellThrough(
    plan: MarkdownPlan,
    updates: Array<{ sku: string; unitsSold: number; currentStock: number }>
  ): MarkdownPlan {
    const skuLines = plan.skuLines.map((l) => {
      const update = updates.find((u) => u.sku === l.sku);
      if (!update) return l;
      const unitsSold     = update.unitsSold;
      const currentStock  = update.currentStock;
      const sellThroughPct = l.openingStock > 0
        ? Math.round((unitsSold / l.openingStock) * 10000) / 100
        : 0;
      return { ...l, unitsSold, currentStock, sellThroughPct };
    });

    const currentAvgSellThrough = skuLines.length > 0
      ? Math.round((skuLines.reduce((s, l) => s + l.sellThroughPct, 0) / skuLines.length) * 100) / 100
      : 0;
    const sellThroughGap = Math.round((plan.targetSellThroughPct - currentAvgSellThrough) * 100) / 100;
    const isComplete     = currentAvgSellThrough >= plan.targetSellThroughPct;
    const status: MarkdownStatus = isComplete ? "COMPLETED" : plan.status;

    return { ...plan, skuLines, currentAvgSellThrough, sellThroughGap, status, updatedAt: new Date().toISOString() };
  }

  /** Check auto-trigger: if time elapsed ≥ 60% and sell-through < 50%, recommend next step */
  public static checkAutoTrigger(plan: MarkdownPlan, asOf: Date): MarkdownPlan {
    if (plan.status !== "ACTIVE") return plan;

    const createdMs   = new Date(plan.createdAt).getTime();
    const deadlineMs  = new Date(plan.deadline).getTime();
    const asOfMs      = asOf.getTime();
    const totalMs     = deadlineMs - createdMs;
    const elapsedMs   = asOfMs - createdMs;
    const elapsedPct  = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0;

    if (elapsedPct < MARKDOWN_CONFIG.autoTriggerCheckPct) return plan;
    if (plan.currentAvgSellThrough >= MARKDOWN_CONFIG.autoTriggerThreshold) return plan;
    if (plan.autoTriggerFired) return plan;

    const currentStep = plan.skuLines[0]?.currentMarkdownStep ?? 0;
    const nextStep    = plan.steps.find((s) => s.stepNo > currentStep);
    if (!nextStep) return plan;

    return { ...plan, autoTriggerFired: true, nextRecommendedStep: nextStep.stepNo, updatedAt: new Date().toISOString() };
  }

  /** Generate sell-through report as of a date */
  public static generateReport(plan: MarkdownPlan, asOf: Date): SellThroughReport {
    const createdMs  = new Date(plan.createdAt).getTime();
    const deadlineMs = new Date(plan.deadline).getTime();
    const asOfMs     = asOf.getTime();
    const daysTotal   = Math.ceil((deadlineMs - createdMs) / 86400000);
    const daysElapsed = Math.max(0, Math.ceil((asOfMs - createdMs) / 86400000));
    const timeElapsedPct = daysTotal > 0 ? Math.round((daysElapsed / daysTotal) * 10000) / 100 : 0;

    const onTrack = plan.currentAvgSellThrough >= (plan.targetSellThroughPct * (timeElapsedPct / 100));

    let recommendation: string | undefined;
    if (plan.nextRecommendedStep) {
      recommendation = `Apply Markdown Step ${plan.nextRecommendedStep} — sell-through ${plan.currentAvgSellThrough}% below target at ${timeElapsedPct}% of campaign duration.`;
    } else if (!onTrack) {
      recommendation = `Sell-through ${plan.currentAvgSellThrough}% is behind pace — consider activating next markdown step.`;
    }

    return {
      planId: plan.planId,
      planName: plan.planName,
      branchCode: plan.branchCode,
      asOfDate: asOf.toISOString(),
      daysElapsed, daysTotal, timeElapsedPct,
      currentAvgSellThrough: plan.currentAvgSellThrough,
      targetSellThrough:     plan.targetSellThroughPct,
      sellThroughGap:        plan.sellThroughGap,
      onTrack,
      skuLines: plan.skuLines.map((l) => ({ sku: l.sku, productName: l.productName, sellThroughPct: l.sellThroughPct, currentEffectivePrice: l.currentEffectivePrice, currentStep: l.currentMarkdownStep })),
      recommendation,
    };
  }
}

export default MarkdownEngine;
