/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Policy Registry (USR-003)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & USR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export type PolicyEffect = "allow" | "deny";

export interface PolicyCondition {
  attribute: string;      // e.g. "tenantId", "storeId", "department", "amount"
  operator: "equals" | "not_equals" | "in" | "less_than" | "greater_than";
  value: any;
}

export interface PolicyDefinition {
  id: string;             // Policy key (e.g. "policy.sales.amount_limit", "policy.store.isolation")
  name: string;
  description?: string;
  effect: PolicyEffect;
  permissionId: string;   // Associated permission
  conditions: PolicyCondition[];
  priority?: number;      // Rule evaluation order
}

export interface SecurityEvaluationContext {
  userId: string;
  roleId: string;
  tenantId?: string;
  storeId?: string;
  department?: string;
  attributes?: Record<string, any>;
}

export class PolicyRegistryService {
  private policies: Map<string, Readonly<PolicyDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultPolicies();
  }

  private seedDefaultPolicies() {
    const defaults: PolicyDefinition[] = [
      {
        id: "policy.pos.discount_limit",
        name: "POS Max Line Discount 20%",
        effect: "allow",
        permissionId: "sales.pos.discount",
        conditions: [
          { attribute: "discountPercent", operator: "less_than", value: 20 }
        ],
        priority: 10
      },
      {
        id: "policy.store.isolation",
        name: "Store Location Isolation Policy",
        effect: "allow",
        permissionId: "inventory.item.read",
        conditions: [
          { attribute: "storeId", operator: "equals", value: "activeStoreId" }
        ],
        priority: 5
      }
    ];

    defaults.forEach((p) => this.registerPolicy(p));
  }

  public registerPolicy(policy: PolicyDefinition): void {
    const payload = Object.freeze({ ...policy, id: policy.id.toLowerCase() });
    this.policies.set(payload.id, payload);
    this.emitChange();
  }

  public getPolicy(id: string): Readonly<PolicyDefinition> | undefined {
    if (!id) return undefined;
    return this.policies.get(id.toLowerCase());
  }

  public getPolicies(): ReadonlyArray<Readonly<PolicyDefinition>> {
    return Array.from(this.policies.values());
  }

  public evaluatePolicy(policyId: string, context: SecurityEvaluationContext, attrValues: Record<string, any> = {}): boolean {
    const policy = this.getPolicy(policyId);
    if (!policy) return true; // Default permissive if policy not found

    const allAttrs: Record<string, any> = { ...context, ...context.attributes, ...attrValues };

    for (const cond of policy.conditions) {
      const actualVal = allAttrs[cond.attribute];

      if (cond.operator === "equals" && actualVal !== cond.value) {
        return policy.effect === "deny";
      }
      if (cond.operator === "less_than" && Number(actualVal) >= Number(cond.value)) {
        return policy.effect === "deny";
      }
      if (cond.operator === "greater_than" && Number(actualVal) <= Number(cond.value)) {
        return policy.effect === "deny";
      }
      if (cond.operator === "in" && Array.isArray(cond.value) && !cond.value.includes(actualVal)) {
        return policy.effect === "deny";
      }
    }

    return policy.effect === "allow";
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.policies.clear();
    this.seedDefaultPolicies();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const PolicyRegistry = new PolicyRegistryService();
