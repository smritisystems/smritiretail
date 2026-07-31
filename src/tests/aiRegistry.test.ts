/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal AI Skill Registry (UAR Phase 8 Core) Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule AOP-001 & UAR Standard v1.0 Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { createPlatformContext } from "../kernel/context/PlatformContext.js";
import { AIRegistry, type AISkillDefinition } from "../kernel/upr/ai/AIRegistry.js";

describe("Universal AI Skill Registry (UAR Phase 8 Core & Rule AOP-001)", () => {
  beforeEach(() => {
    AIRegistry.clear();
  });

  it("should seed default AI skills (ai.reorder_recommendation, ai.deadstock_identifier)", () => {
    const skills = SPK.ai.getSkills();
    expect(skills.length).toBeGreaterThanOrEqual(2);

    const reorderSkill = SPK.ai.getSkill("ai.reorder_recommendation");
    expect(reorderSkill).toBeDefined();
    expect(reorderSkill?.isAdvisoryOnly).toBe(true);
    expect(reorderSkill?.category).toBe("automated_reorder");
  });

  it("should execute AI skill advisory recommendation with AOP-001 disclaimer", () => {
    const context = createPlatformContext();
    const result = SPK.ai.executeSkill("ai.reorder_recommendation", {}, context);

    expect(result.skillId).toBe("ai.reorder_recommendation");
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(result.recommendations[0].confidenceScore).toBe(0.94);
    expect(result.disclaimer).toContain("Advisory AI recommendation only");
  });

  it("should support dynamic registration of plugin AI skills with mandatory isAdvisoryOnly flag", () => {
    const customSkill: AISkillDefinition = {
      id: "ai.jewellery_making_charge_optimizer",
      name: "Gold Making Charge Competitive Optimizer",
      category: "pricing_optimization",
      permissionId: "ai.configuration",
      isAdvisoryOnly: true,
      systemPrompt: "Analyze local city market rates and recommend making charge per gram."
    };

    SPK.ai.registerSkill(customSkill);

    const registered = SPK.ai.getSkill("ai.jewellery_making_charge_optimizer");
    expect(registered).toBeDefined();
    expect(registered?.isAdvisoryOnly).toBe(true);
  });
});
