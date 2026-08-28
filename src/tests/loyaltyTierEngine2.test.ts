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

import { describe, it, expect } from "vitest";
import LoyaltyTierEngine, { DEFAULT_TIER_POLICY, LoyaltyMember } from "../utils/loyaltyTierEngine";

describe("LoyaltyTierEngine — Customer Loyalty Tier Upgrade Engine", () => {

  function makeMember(joinDate: string, tier: LoyaltyMember["currentTier"] = "BRONZE"): LoyaltyMember {
    return LoyaltyTierEngine.createMember({
      memberId: "MBR-001", memberNo: "LYL-0001",
      name: "Priya Sharma", joinDate, initialTier: tier,
    });
  }

  // ─── Test 1: Upgrade BRONZE → GOLD on spend/points threshold ──────────────
  it("upgrades BRONZE → GOLD when windowSpend and windowPoints cross GOLD threshold", () => {
    let member = makeMember("2024-01-15");
    // GOLD requires: minSpend=50000, minPoints=5000
    member = LoyaltyTierEngine.accrue(member, 55000, 5500);
    expect(member.windowSpend).toBe(55000);
    expect(member.windowPoints).toBe(5500);

    const { member: updated, evaluation } = LoyaltyTierEngine.evaluateTier(member, new Date("2026-08-28"));
    expect(evaluation.changeType).toBe("UPGRADE");
    expect(evaluation.proposedTier).toBe("GOLD");
    expect(updated.currentTier).toBe("GOLD");
    expect(updated.auditTrail).toHaveLength(1);
    expect(updated.auditTrail[0].type).toBe("UPGRADE");
    expect(updated.auditTrail[0].fromTier).toBe("BRONZE");
    expect(updated.auditTrail[0].toTier).toBe("GOLD");
  });

  // ─── Test 2: Downgrade blocked by cooldown ────────────────────────────────
  it("blocks downgrade when cooldown (3 months) has not elapsed since last tier change", () => {
    // Member just upgraded to GOLD (lastTierChangeAt = today - 1 month)
    let member = makeMember("2023-05-10", "GOLD");
    // lastTierChangeAt set to 1 month ago — within 3-month cooldown
    const oneMonthAgo = new Date("2026-07-28").toISOString();
    member = { ...member, lastTierChangeAt: oneMonthAgo };
    // Low spend (BRONZE level) — would normally downgrade
    member = LoyaltyTierEngine.accrue(member, 5000, 500);

    const asOf = new Date("2026-08-28");
    const { member: updated, evaluation } = LoyaltyTierEngine.evaluateTier(member, asOf);

    expect(evaluation.changeType).toBe("NO_CHANGE");
    expect(evaluation.downgradeLocked).toBe(true);
    expect(updated.currentTier).toBe("GOLD");    // Still GOLD — downgrade blocked
    expect(evaluation.reason).toContain("cooldown");
  });

  // ─── Test 3: Downgrade allowed after cooldown ─────────────────────────────
  it("allows downgrade when cooldown has elapsed (> 3 months since last tier change)", () => {
    let member = makeMember("2022-03-01", "GOLD");
    // lastTierChangeAt = 6 months ago — cooldown (3mo) has elapsed
    const sixMonthsAgo = new Date("2026-02-28").toISOString();
    member = { ...member, lastTierChangeAt: sixMonthsAgo };
    // Low spend (BRONZE level)
    member = LoyaltyTierEngine.accrue(member, 3000, 200);

    const asOf = new Date("2026-08-28");
    const { member: updated, evaluation } = LoyaltyTierEngine.evaluateTier(member, asOf);

    expect(evaluation.changeType).toBe("DOWNGRADE");
    expect(evaluation.proposedTier).toBe("BRONZE");
    expect(updated.currentTier).toBe("BRONZE");
    expect(evaluation.downgradeLocked).toBe(false);
    expect(updated.auditTrail).toHaveLength(1);
    expect(updated.auditTrail[0].type).toBe("DOWNGRADE");
  });

  // ─── Test 4: Anniversary bonus + batch evaluation + tier summary ──────────
  it("awards anniversary bonus on exact anniversary date and batch evaluation works", () => {
    // Member joined 2024-08-28 → anniversary is 2026-08-28
    // lastTierChangeAt = 1 month ago → downgrade cooldown (3mo) NOT elapsed → stays SILVER
    let m1 = makeMember("2024-08-28", "SILVER"); // SILVER anniversaryBonus = 300
    m1 = { ...m1, lastTierChangeAt: new Date("2026-07-28").toISOString() };
    // windowSpend=0/windowPoints=0 → would be BRONZE but cooldown blocks downgrade

    let m2 = makeMember("2023-01-10", "GOLD");
    // Accrue enough for m2 to stay GOLD (≥50000 spend, ≥5000 points)
    m2 = LoyaltyTierEngine.accrue(m2, 60000, 6000);

    // Anniversary check for m1 on exactly 2026-08-28
    const anniversary = new Date("2026-08-28T00:00:00.000Z");
    m1 = LoyaltyTierEngine.checkAnniversary(m1, anniversary);
    expect(m1.currentPoints).toBe(300);
    expect(m1.lifetimePoints).toBe(300);
    expect(m1.auditTrail).toHaveLength(1);
    expect(m1.auditTrail[0].type).toBe("ANNIVERSARY_REWARD");
    expect(m1.auditTrail[0].pointsDelta).toBe(300);

    // Batch evaluation — m1 downgrade blocked by cooldown → stays SILVER; m2 stays GOLD
    const { members, evaluations } = LoyaltyTierEngine.evaluateBatch([m1, m2], anniversary);
    expect(members).toHaveLength(2);
    expect(evaluations[0].downgradeLocked).toBe(true);   // m1 downgrade blocked
    expect(evaluations[1].proposedTier).toBe("GOLD");    // m2 stays GOLD

    // Tier summary
    const summary = LoyaltyTierEngine.tierSummary(members);
    expect(summary.SILVER).toBe(1);
    expect(summary.GOLD).toBe(1);
    expect(summary.BRONZE).toBe(0);
    expect(summary.PLATINUM).toBe(0);
  });
});
