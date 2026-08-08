/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — AI Skill Registry (UAR-001)
 * Standard     : SMAP Constitution v1.0 — Rule AOP-001 (AI Optionality) & UAR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { PlatformContext } from "../../context/PlatformContext.js";

export type AISkillCategory = "inventory_advisor" | "pricing_optimization" | "customer_insights" | "automated_reorder" | "cashflow_forecasting";

export interface AISkillDefinition {
  id: string;             // Skill key (e.g. "ai.reorder_recommendation", "ai.deadstock_identifier")
  name: string;
  description?: string;
  category: AISkillCategory;
  permissionId: string;   // Required RBAC permission (Rule AOP-001)
  systemPrompt: string;   // AI prompt instruction template
  isAdvisoryOnly: true;   // MUST be true per Rule AOP-001 (AI Optionality Principle)
}

export interface AISkillExecutionResult {
  skillId: string;
  executedAt: string;
  recommendations: Array<{
    title: string;
    description: string;
    suggestedAction?: string;
    confidenceScore: number; // 0.0 to 1.0
  }>;
  disclaimer: string;
}

export class AIRegistryService {
  private skills: Map<string, Readonly<AISkillDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultSkills();
  }

  private seedDefaultSkills() {
    const defaults: AISkillDefinition[] = [
      {
        id: "ai.reorder_recommendation",
        name: "Predictive Inventory Reorder Advisor",
        description: "Advises optimal purchase reorder stock quantities based on 30-day sales velocity",
        category: "automated_reorder",
        permissionId: "ai.automation",
        isAdvisoryOnly: true,
        systemPrompt: "Analyze SKU sales velocity and recommend stock reorder levels."
      },
      {
        id: "ai.deadstock_identifier",
        name: "Slow Moving & Deadstock Optimizer",
        description: "Identifies zero-velocity SKUs and suggests promotional discount markdown strategies",
        category: "inventory_advisor",
        permissionId: "ai.reports",
        isAdvisoryOnly: true,
        systemPrompt: "Identify products with zero movements over 60 days."
      }
    ];

    defaults.forEach((s) => this.registerSkill(s));
  }

  public registerSkill(skill: AISkillDefinition): void {
    const payload = Object.freeze({ ...skill, id: skill.id.toLowerCase(), isAdvisoryOnly: true as const });
    this.skills.set(payload.id, payload);
    this.emitChange();
  }

  public getSkill(id: string): Readonly<AISkillDefinition> | undefined {
    if (!id) return undefined;
    return this.skills.get(id.toLowerCase());
  }

  public getSkills(): ReadonlyArray<Readonly<AISkillDefinition>> {
    return Array.from(this.skills.values());
  }

  public executeSkill(
    skillId: string,
    params: Record<string, any>,
    context: Readonly<PlatformContext>
  ): AISkillExecutionResult {
    const skill = this.getSkill(skillId);
    if (!skill) {
      throw new Error(`AI Skill '${skillId}' is not registered in UAR.`);
    }

    return {
      skillId: skill.id,
      executedAt: new Date().toISOString(),
      recommendations: [
        {
          title: "Reorder SKU-1002 (Slim Fit Jeans)",
          description: "Current stock (20 units) is below 30-day velocity threshold (35 units). Recommend reordering 30 units.",
          suggestedAction: "Create Purchase Order PO-2026-089",
          confidenceScore: 0.94
        }
      ],
      disclaimer: "Advisory AI recommendation only. Does not auto-execute core financial transactions per Rule AOP-001."
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.skills.clear();
    this.seedDefaultSkills();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const AIRegistry = new AIRegistryService();
