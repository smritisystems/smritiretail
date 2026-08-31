/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.110.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Customer Loyalty Tier Upgrade Engine
 *
 * Manages automated tier transitions for loyalty program members:
 *   Tiers           : BRONZE → SILVER → GOLD → PLATINUM
 *   Evaluation      : `evaluateTier()` checks cumulative spend/points
 *                     in the rolling evaluation window (months) and
 *                     proposes an upgrade, downgrade, or no change.
 *   Upgrade         : Immediate on crossing a threshold.
 *   Downgrade       : Subject to a cooldown period (months); engine
 *                     blocks downgrade if cooldown has not elapsed.
 *   Anniversary     : On membership anniversary, award bonus points.
 *   Audit Trail     : Every tier change is logged immutably.
 */

export type LoyaltyTier    = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
export type TierChangeType = "UPGRADE" | "DOWNGRADE" | "NO_CHANGE" | "ANNIVERSARY_REWARD";

export interface TierConfig {
  tier:            LoyaltyTier;
  minSpend:        number;    // Minimum cumulative spend (₹) in evaluation window
  minPoints:       number;    // Minimum cumulative points in evaluation window
  anniversaryBonus: number;   // Points awarded on membership anniversary
}

export interface LoyaltyTierPolicy {
  evaluationWindowMonths: number;   // Rolling window for spend/points calculation
  downgradeCooldownMonths: number;  // Months to wait before a downgrade takes effect
  tiers: TierConfig[];
}

export const DEFAULT_TIER_POLICY: LoyaltyTierPolicy = {
  evaluationWindowMonths: 12,
  downgradeCooldownMonths: 3,
  tiers: [
    { tier: "BRONZE",   minSpend:       0, minPoints:      0, anniversaryBonus:  100 },
    { tier: "SILVER",   minSpend:   15000, minPoints:   1500, anniversaryBonus:  300 },
    { tier: "GOLD",     minSpend:   50000, minPoints:   5000, anniversaryBonus:  750 },
    { tier: "PLATINUM", minSpend:  150000, minPoints:  15000, anniversaryBonus: 2000 },
  ],
};

export interface TierAuditEntry {
  auditId:    string;
  type:       TierChangeType;
  fromTier:   LoyaltyTier;
  toTier:     LoyaltyTier;
  reason:     string;
  pointsDelta?: number;
  performedAt: string;
}

export interface LoyaltyMember {
  memberId:         string;
  memberNo:         string;
  name:             string;
  currentTier:      LoyaltyTier;
  currentPoints:    number;
  lifetimePoints:   number;
  lifetimeSpend:    number;
  windowSpend:      number;      // Spend in current evaluation window
  windowPoints:     number;      // Points in current evaluation window
  joinDate:         string;
  lastTierChangeAt: string;
  lastEvaluatedAt:  string;
  anniversaryDue:   boolean;
  auditTrail:       TierAuditEntry[];
  updatedAt:        string;
}

export interface TierEvaluation {
  memberId:      string;
  name:          string;
  currentTier:   LoyaltyTier;
  proposedTier:  LoyaltyTier;
  changeType:    TierChangeType;
  windowSpend:   number;
  windowPoints:  number;
  reason:        string;
  downgradeLocked: boolean;     // True if downgrade proposed but cooldown not elapsed
  evaluatedAt:   string;
}

export class LoyaltyTierEngine {
  private static auditId = () => `LTAD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  private static TIER_RANK: Record<LoyaltyTier, number> = {
    BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4,
  };

  /** Resolve highest tier earned by window spend + points */
  public static resolveTier(
    windowSpend: number,
    windowPoints: number,
    policy: LoyaltyTierPolicy = DEFAULT_TIER_POLICY
  ): LoyaltyTier {
    const earned = policy.tiers
      .filter((t) => windowSpend >= t.minSpend && windowPoints >= t.minPoints)
      .sort((a, b) => this.TIER_RANK[b.tier] - this.TIER_RANK[a.tier]);
    return earned[0]?.tier ?? "BRONZE";
  }

  public static createMember(params: {
    memberId:    string;
    memberNo:    string;
    name:        string;
    joinDate:    string;
    initialTier?: LoyaltyTier;
  }): LoyaltyMember {
    const now = new Date().toISOString();
    return {
      memberId:        params.memberId,
      memberNo:        params.memberNo,
      name:            params.name,
      currentTier:     params.initialTier ?? "BRONZE",
      currentPoints:   0,
      lifetimePoints:  0,
      lifetimeSpend:   0,
      windowSpend:     0,
      windowPoints:    0,
      joinDate:        params.joinDate,
      lastTierChangeAt: params.joinDate,
      lastEvaluatedAt:  now,
      anniversaryDue:   false,
      auditTrail:       [],
      updatedAt:        now,
    };
  }

  /** Accrue spend and points; does not evaluate tier */
  public static accrue(
    member: LoyaltyMember,
    spend: number,
    points: number
  ): LoyaltyMember {
    const now = new Date().toISOString();
    return {
      ...member,
      currentPoints:  member.currentPoints + points,
      lifetimePoints: member.lifetimePoints + points,
      lifetimeSpend:  Math.round((member.lifetimeSpend + spend) * 100) / 100,
      windowSpend:    Math.round((member.windowSpend + spend) * 100) / 100,
      windowPoints:   member.windowPoints + points,
      updatedAt:      now,
    };
  }

  /** Evaluate and apply tier change */
  public static evaluateTier(
    member: LoyaltyMember,
    asOf: Date = new Date(),
    policy: LoyaltyTierPolicy = DEFAULT_TIER_POLICY
  ): { member: LoyaltyMember; evaluation: TierEvaluation } {
    const now        = asOf.toISOString();
    const proposedTier = this.resolveTier(member.windowSpend, member.windowPoints, policy);
    const currentRank  = this.TIER_RANK[member.currentTier];
    const proposedRank = this.TIER_RANK[proposedTier];

    let changeType:     TierChangeType = "NO_CHANGE";
    let reason          = `Spend ₹${member.windowSpend}, Points ${member.windowPoints} — tier unchanged`;
    let downgradeLocked = false;

    if (proposedRank > currentRank) {
      changeType = "UPGRADE";
      reason     = `Spend ₹${member.windowSpend} / Points ${member.windowPoints} qualify for ${proposedTier}`;
    } else if (proposedRank < currentRank) {
      // Check downgrade cooldown
      const lastChangeMs  = new Date(member.lastTierChangeAt).getTime();
      const asOfMs        = asOf.getTime();
      const monthsElapsed = (asOfMs - lastChangeMs) / (30 * 86400000);
      if (monthsElapsed < policy.downgradeCooldownMonths) {
        downgradeLocked = true;
        changeType      = "NO_CHANGE";
        reason          = `Downgrade to ${proposedTier} blocked — cooldown (${policy.downgradeCooldownMonths}mo) has not elapsed (${Math.floor(monthsElapsed)}mo since last change)`;
      } else {
        changeType = "DOWNGRADE";
        reason     = `Spend ₹${member.windowSpend} / Points ${member.windowPoints} qualify for ${proposedTier} only (cooldown elapsed)`;
      }
    }

    const evaluation: TierEvaluation = {
      memberId: member.memberId,
      name:     member.name,
      currentTier:  member.currentTier,
      proposedTier,
      changeType,
      windowSpend:  member.windowSpend,
      windowPoints: member.windowPoints,
      reason,
      downgradeLocked,
      evaluatedAt: now,
    };

    if (changeType === "NO_CHANGE") {
      return { member: { ...member, lastEvaluatedAt: now, updatedAt: now }, evaluation };
    }

    const entry: TierAuditEntry = {
      auditId:     this.auditId(),
      type:        changeType,
      fromTier:    member.currentTier,
      toTier:      proposedTier,
      reason,
      performedAt: now,
    };

    const updated: LoyaltyMember = {
      ...member,
      currentTier:      proposedTier,
      lastTierChangeAt: now,
      lastEvaluatedAt:  now,
      updatedAt:        now,
      auditTrail:       [...member.auditTrail, entry],
    };

    return { member: updated, evaluation };
  }

  /** Award anniversary bonus if membership anniversary falls in the window */
  public static checkAnniversary(
    member: LoyaltyMember,
    asOf: Date = new Date(),
    policy: LoyaltyTierPolicy = DEFAULT_TIER_POLICY
  ): LoyaltyMember {
    const joinDate  = new Date(member.joinDate);
    const thisYear  = asOf.getFullYear();
    const anniversary = new Date(thisYear, joinDate.getMonth(), joinDate.getDate());

    // Fire if today is the anniversary date (date-level match)
    const isAnniversary =
      asOf.getDate()     === anniversary.getDate()    &&
      asOf.getMonth()    === anniversary.getMonth()   &&
      asOf.getFullYear() !== joinDate.getFullYear();   // Not first year

    if (!isAnniversary) return member;

    const tierCfg   = policy.tiers.find((t) => t.tier === member.currentTier);
    const bonus     = tierCfg?.anniversaryBonus ?? 100;
    const now       = asOf.toISOString();
    const yearsAsMember = thisYear - joinDate.getFullYear();

    const entry: TierAuditEntry = {
      auditId:      this.auditId(),
      type:         "ANNIVERSARY_REWARD",
      fromTier:     member.currentTier,
      toTier:       member.currentTier,
      reason:       `${yearsAsMember}-year anniversary bonus — ${bonus} points awarded`,
      pointsDelta:  bonus,
      performedAt:  now,
    };

    return {
      ...member,
      currentPoints:  member.currentPoints + bonus,
      lifetimePoints: member.lifetimePoints + bonus,
      windowPoints:   member.windowPoints + bonus,
      anniversaryDue: false,
      updatedAt:      now,
      auditTrail:     [...member.auditTrail, entry],
    };
  }

  /** Batch evaluate all members — returns summaries of changes */
  public static evaluateBatch(
    members: LoyaltyMember[],
    asOf: Date = new Date(),
    policy: LoyaltyTierPolicy = DEFAULT_TIER_POLICY
  ): { members: LoyaltyMember[]; evaluations: TierEvaluation[] } {
    const results = members.map((m) => this.evaluateTier(m, asOf, policy));
    return {
      members:     results.map((r) => r.member),
      evaluations: results.map((r) => r.evaluation),
    };
  }

  /** Tier summary across all members */
  public static tierSummary(members: LoyaltyMember[]): Record<LoyaltyTier, number> {
    const counts: Record<LoyaltyTier, number> = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
    members.forEach((m) => counts[m.currentTier]++);
    return counts;
  }
}

export default LoyaltyTierEngine;
