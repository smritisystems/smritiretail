/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.89.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type FittingRoomStatus = "VACANT" | "OCCUPIED" | "TRIAL_IN_PROGRESS" | "NEEDS_ATTENTION" | "CLEANING";

export interface RFIDGarmentTag {
  rfidTag: string;
  sku: string;
  productName: string;
  category: string;
  size: string;
  color: string;
  mrp: number;
  sellingPrice: number;
  imageUrl?: string;
}

export interface FittingRoomSession {
  sessionId: string;
  roomId: string;
  startedAt: string;
  endedAt?: string;
  customerId?: string;
  garments: FittingRoomGarmentEvent[];
  status: FittingRoomStatus;
  crossSellsGenerated: CrossSellRecommendation[];
  associateId?: string;
}

export interface FittingRoomGarmentEvent {
  eventId: string;
  rfidTag: string;
  sku: string;
  productName: string;
  action: "BROUGHT_IN" | "TAKEN_OUT" | "PURCHASED";
  timestamp: string;
  trialDurationMs?: number;
}

export interface CrossSellRecommendation {
  recommendationId: string;
  basedOnSku: string;
  basedOnProductName: string;
  recommendedSku: string;
  recommendedProductName: string;
  recommendedCategory: string;
  recommendedPrice: number;
  reason: string;
  affinity: number;             // 0.0–1.0 affinity score
}

export interface FittingRoomAnalytics {
  totalSessions: number;
  totalGarmentsTrialled: number;
  totalGarmentsPurchased: number;
  conversionRate: number;        // % of tried garments that were purchased
  avgTrialDurationMs: number;
  topTrialledSkus: { sku: string; productName: string; trialCount: number; purchaseCount: number; }[];
  abandonedGarments: { sku: string; productName: string; avgTrialMs: number; }[];
}

/** Cross-sell affinity catalog: category → complementary categories & affinities */
const CROSS_SELL_AFFINITY: Record<string, { category: string; affinity: number; reason: string }[]> = {
  "Apparel": [
    { category: "Accessories", affinity: 0.92, reason: "Customers who try apparel frequently pair with accessories" },
    { category: "Footwear", affinity: 0.85, reason: "Complete the look — footwear recommendation" },
    { category: "Innerwear", affinity: 0.60, reason: "Complement apparel with matching innerwear" },
  ],
  "Footwear": [
    { category: "Socks", affinity: 0.95, reason: "Essential accessory pairing with footwear" },
    { category: "Accessories", affinity: 0.72, reason: "Belt or bag recommendation to match footwear" },
    { category: "Apparel", affinity: 0.65, reason: "Outfit completion recommendation" },
  ],
  "Denim": [
    { category: "Tops", affinity: 0.90, reason: "Classic denim & top pairing" },
    { category: "Footwear", affinity: 0.80, reason: "Footwear recommendation for denim styling" },
    { category: "Belts", affinity: 0.75, reason: "Denim typically pairs with a matching belt" },
  ],
  "Formals": [
    { category: "Ties", affinity: 0.93, reason: "Formal shirt & tie pairing" },
    { category: "Formal Shoes", affinity: 0.89, reason: "Match formal outfit with formal shoes" },
    { category: "Cufflinks", affinity: 0.70, reason: "Accessory recommendation for formal shirts" },
  ],
};

export class FittingRoomEngine {
  /** Open a new fitting room session when garments are scanned in */
  public static openSession(params: {
    roomId: string;
    garmentTags: RFIDGarmentTag[];
    customerId?: string;
    associateId?: string;
  }): FittingRoomSession {
    const now = new Date().toISOString();
    const garmentEvents: FittingRoomGarmentEvent[] = params.garmentTags.map((tag) => ({
      eventId: `EVT-${tag.rfidTag}-${Date.now()}`,
      rfidTag: tag.rfidTag,
      sku: tag.sku,
      productName: tag.productName,
      action: "BROUGHT_IN",
      timestamp: now,
    }));

    const crossSells = this.generateCrossSells(params.garmentTags);

    return {
      sessionId: `SESSION-${params.roomId}-${Date.now()}`,
      roomId: params.roomId,
      startedAt: now,
      customerId: params.customerId,
      garments: garmentEvents,
      status: "TRIAL_IN_PROGRESS",
      crossSellsGenerated: crossSells,
      associateId: params.associateId,
    };
  }

  /** Record garment removal from fitting room */
  public static recordGarmentOut(session: FittingRoomSession, rfidTag: string, purchased: boolean = false): FittingRoomSession {
    const inEvent = session.garments.find((e) => e.rfidTag === rfidTag && e.action === "BROUGHT_IN");
    const trialDurationMs = inEvent ? new Date().getTime() - new Date(inEvent.timestamp).getTime() : undefined;

    const outEvent: FittingRoomGarmentEvent = {
      eventId: `EVT-${rfidTag}-OUT-${Date.now()}`,
      rfidTag,
      sku: inEvent?.sku ?? rfidTag,
      productName: inEvent?.productName ?? "Unknown",
      action: purchased ? "PURCHASED" : "TAKEN_OUT",
      timestamp: new Date().toISOString(),
      trialDurationMs,
    };

    const allOut = session.garments
      .filter((e) => e.action === "BROUGHT_IN")
      .every((e) => [...session.garments, outEvent].some((o) => o.rfidTag === e.rfidTag && o.action !== "BROUGHT_IN"));

    return {
      ...session,
      garments: [...session.garments, outEvent],
      status: allOut ? "VACANT" : "TRIAL_IN_PROGRESS",
    };
  }

  /** Generate AI-style cross-sell recommendations from garments brought into the room */
  public static generateCrossSells(garmentTags: RFIDGarmentTag[]): CrossSellRecommendation[] {
    const recommendations: CrossSellRecommendation[] = [];
    const seen = new Set<string>();

    for (const tag of garmentTags) {
      const affinities = CROSS_SELL_AFFINITY[tag.category] ?? [];
      for (const affinity of affinities) {
        const key = `${tag.sku}-${affinity.category}`;
        if (!seen.has(key) && affinity.affinity > 0.7) {
          seen.add(key);
          recommendations.push({
            recommendationId: `REC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            basedOnSku: tag.sku,
            basedOnProductName: tag.productName,
            recommendedSku: `CROSS-${affinity.category.toUpperCase().replace(" ", "-")}-001`,
            recommendedProductName: `Recommended ${affinity.category} Item`,
            recommendedCategory: affinity.category,
            recommendedPrice: Math.round(tag.sellingPrice * 0.6 / 100) * 100,
            reason: affinity.reason,
            affinity: affinity.affinity,
          });
        }
      }
    }

    return recommendations.sort((a, b) => b.affinity - a.affinity).slice(0, 5);
  }

  /** Compute analytics across sessions */
  public static computeAnalytics(sessions: FittingRoomSession[]): FittingRoomAnalytics {
    const skuTrials: Record<string, { trialCount: number; purchaseCount: number; totalTrialMs: number; productName: string }> = {};
    let totalGarmentsTrialled = 0;
    let totalGarmentsPurchased = 0;
    let totalTrialMs = 0;
    let trialEventCount = 0;

    for (const session of sessions) {
      for (const evt of session.garments) {
        if (evt.action === "BROUGHT_IN") {
          totalGarmentsTrialled++;
          if (!skuTrials[evt.sku]) skuTrials[evt.sku] = { trialCount: 0, purchaseCount: 0, totalTrialMs: 0, productName: evt.productName };
          skuTrials[evt.sku].trialCount++;
        }
        if (evt.action === "PURCHASED") {
          totalGarmentsPurchased++;
          if (skuTrials[evt.sku]) skuTrials[evt.sku].purchaseCount++;
        }
        if (evt.action === "TAKEN_OUT" && evt.trialDurationMs) {
          totalTrialMs += evt.trialDurationMs;
          trialEventCount++;
          if (skuTrials[evt.sku]) skuTrials[evt.sku].totalTrialMs += evt.trialDurationMs;
        }
      }
    }

    const avgTrialDurationMs = trialEventCount > 0 ? Math.round(totalTrialMs / trialEventCount) : 0;
    const conversionRate = totalGarmentsTrialled > 0 ? Math.round((totalGarmentsPurchased / totalGarmentsTrialled) * 10000) / 100 : 0;

    const topTrialledSkus = Object.entries(skuTrials)
      .sort(([, a], [, b]) => b.trialCount - a.trialCount)
      .slice(0, 5)
      .map(([sku, data]) => ({ sku, productName: data.productName, trialCount: data.trialCount, purchaseCount: data.purchaseCount }));

    const abandonedGarments = Object.entries(skuTrials)
      .filter(([, data]) => data.purchaseCount === 0 && data.trialCount > 0)
      .sort(([, a], [, b]) => b.trialCount - a.trialCount)
      .slice(0, 5)
      .map(([sku, data]) => ({ sku, productName: data.productName, avgTrialMs: data.totalTrialMs > 0 ? Math.round(data.totalTrialMs / data.trialCount) : 0 }));

    return { totalSessions: sessions.length, totalGarmentsTrialled, totalGarmentsPurchased, conversionRate, avgTrialDurationMs, topTrialledSkus, abandonedGarments };
  }
}

export default FittingRoomEngine;
