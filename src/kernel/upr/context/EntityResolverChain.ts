/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Entity Resolver Chain (Phase 2)
 *                "Given this field, what entity does it reference?"
 * Standard     : UCIF-001 through UCIF-005 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * KND-001: Pure service — no React, no DOM rendering.
 *
 * Resolver confidence scores:
 *   FormRegistryResolver    100 — reads FormRegistry → field.lookupDomain
 *   FieldIdHeuristicResolver 70 — matches "customer_id", "supplier_code" patterns
 *   DOMAttributeResolver     60 — reads data-entity-type attribute (last resort)
 *   WorkspaceDomainResolver  40 — maps workspace domain to entity type (fallback)
 *
 * Returns EntityContext[] (multiple candidates possible).
 * Example: Invoice line may resolve [product:95, invoice:40].
 * UCIFKernel handles disambiguation when N > 1.
 *
 * Why separated from Phase 1:
 *   Adding a new entity type  = new IEntityResolver only
 *   Adding a new input surface = new IContextResolver only
 *   Neither affects the other phase.
 */

import type { FieldContext, EntityContext, IEntityResolver } from "./InspectorSchema.js";
import { FormRegistry } from "../forms/FormRegistry.js";

// ── Built-in Entity Resolvers ─────────────────────────────────────────────────

/**
 * FormRegistryResolver — confidence: 100
 * PRIMARY resolver. Reads FormRegistry metadata → field.lookupDomain.
 * This is the metadata-first approach: no HTML attributes needed.
 */
class FormRegistryResolver implements IEntityResolver {
  name = "FormRegistryResolver";
  confidence = 100;

  async resolve(fieldCtx: FieldContext): Promise<EntityContext[]> {
    const results: EntityContext[] = [];
    const forms = FormRegistry.getForms();

    for (const form of forms) {
      for (const section of form.sections || []) {
        for (const field of section.fields || []) {
          if (field.id === fieldCtx.fieldId && (field as any).lookupDomain) {
            results.push({
              entityType: (field as any).lookupDomain as string,
              entityId: fieldCtx.rawValue || "",
              confidence: this.confidence,
              resolvedBy: this.name,
            });
          }
        }
      }
    }

    return results;
  }
}

/**
 * FieldIdHeuristicResolver — confidence: 70
 * Matches common field ID naming patterns.
 * e.g., "customer_id" → "customer", "supplier_code" → "supplier"
 */
class FieldIdHeuristicResolver implements IEntityResolver {
  name = "FieldIdHeuristicResolver";
  confidence = 70;

  /** Map of fieldId pattern → entityType */
  private patterns: Array<{ pattern: RegExp; entityType: string }> = [
    { pattern: /^customer/i, entityType: "customer" },
    { pattern: /^supplier/i, entityType: "supplier" },
    { pattern: /^(product|item|sku|article)/i, entityType: "product" },
    { pattern: /^(invoice|inv)/i, entityType: "invoice" },
    { pattern: /^warehouse/i, entityType: "warehouse" },
    { pattern: /^batch/i, entityType: "batch" },
    { pattern: /^serial/i, entityType: "serial" },
    { pattern: /^(salesperson|salesman|employee)/i, entityType: "salesperson" },
    { pattern: /^(payment|receipt)/i, entityType: "payment" },
    { pattern: /^(purchase|po|grn)/i, entityType: "purchase_order" },
    { pattern: /^barcode/i, entityType: "product" },
  ];

  async resolve(fieldCtx: FieldContext): Promise<EntityContext[]> {
    for (const { pattern, entityType } of this.patterns) {
      if (pattern.test(fieldCtx.fieldId)) {
        return [{
          entityType,
          entityId: fieldCtx.rawValue || "",
          confidence: this.confidence,
          resolvedBy: this.name,
        }];
      }
    }
    return [];
  }

  /** Plugins can register additional patterns */
  public registerPattern(pattern: RegExp, entityType: string): void {
    this.patterns.unshift({ pattern, entityType });
  }
}

/**
 * DOMAttributeResolver — confidence: 60
 * Reads data-entity-type from the focused element or its container.
 * Last DOM-based resort — metadata is always preferred.
 */
class DOMAttributeResolver implements IEntityResolver {
  name = "DOMAttributeResolver";
  confidence = 60;

  async resolve(fieldCtx: FieldContext): Promise<EntityContext[]> {
    const el = fieldCtx.sourceElement;
    if (!el || typeof el.closest !== "function") return [];

    const entityType =
      el.getAttribute("data-entity-type") ||
      el.closest("[data-entity-type]")?.getAttribute("data-entity-type");

    if (!entityType) return [];

    return [{
      entityType,
      entityId: fieldCtx.rawValue || "",
      confidence: this.confidence,
      resolvedBy: this.name,
    }];
  }
}

/**
 * WorkspaceDomainResolver — confidence: 40
 * FALLBACK. Maps the active workspace domain to a primary entity type.
 * e.g., "purchase" workspace → "purchase_order" entity.
 */
class WorkspaceDomainResolver implements IEntityResolver {
  name = "WorkspaceDomainResolver";
  confidence = 40;

  private domainToEntity: Record<string, string> = {
    customer: "customer",
    customers: "customer",
    supplier: "supplier",
    suppliers: "supplier",
    product: "product",
    products: "product",
    inventory: "product",
    sales: "invoice",
    purchase: "purchase_order",
    pos: "invoice",
    warehouse: "warehouse",
    accounting: "ledger",
  };

  async resolve(fieldCtx: FieldContext): Promise<EntityContext[]> {
    // fieldId from WorkspaceResolver is the domain name
    const entityType = this.domainToEntity[fieldCtx.fieldId.toLowerCase()];
    if (!entityType) return [];

    return [{
      entityType,
      entityId: fieldCtx.rawValue || "",
      confidence: this.confidence,
      resolvedBy: this.name,
    }];
  }

  public registerDomainMapping(domain: string, entityType: string): void {
    this.domainToEntity[domain.toLowerCase()] = entityType;
  }
}

// ── Entity Resolver Chain Service ─────────────────────────────────────────────

// Shared heuristic instance so plugins can call registerPattern()
export const fieldIdHeuristicResolver = new FieldIdHeuristicResolver();
export const workspaceDomainResolver = new WorkspaceDomainResolver();

class EntityResolverChainService {
  private static instance: EntityResolverChainService | null = null;

  private resolvers: IEntityResolver[] = [
    new FormRegistryResolver(),     // confidence: 100
    fieldIdHeuristicResolver,       // confidence:  70
    new DOMAttributeResolver(),     // confidence:  60
    workspaceDomainResolver,        // confidence:  40
  ];

  private constructor() {}

  public static getInstance(): EntityResolverChainService {
    if (!EntityResolverChainService.instance) {
      EntityResolverChainService.instance = new EntityResolverChainService();
    }
    return EntityResolverChainService.instance;
  }

  /**
   * Resolve entity candidates from a field context.
   * Tries ALL resolvers and merges unique results.
   * Deduplicates by entityType (keeps highest confidence).
   */
  public async resolve(fieldCtx: FieldContext): Promise<EntityContext[]> {
    const all: EntityContext[] = [];

    for (const resolver of this.resolvers) {
      try {
        const results = await resolver.resolve(fieldCtx);
        all.push(...results);
      } catch (err) {
        console.warn(`[UCIF EntityResolver] ${resolver.name} failed:`, err);
      }
    }

    // Deduplicate by entityType — keep highest confidence per type
    const byType = new Map<string, EntityContext>();
    for (const ctx of all) {
      const existing = byType.get(ctx.entityType);
      if (!existing || ctx.confidence > existing.confidence) {
        byType.set(ctx.entityType, ctx);
      }
    }

    // Sort by confidence descending
    return Array.from(byType.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /** Register a custom entity resolver (plugins) */
  public registerResolver(resolver: IEntityResolver): void {
    this.resolvers.push(resolver);
    // Sort by confidence descending for prioritized resolution
    this.resolvers.sort((a, b) => b.confidence - a.confidence);
  }

  public getRegisteredResolvers(): string[] {
    return this.resolvers.map((r) => r.name);
  }
}

export const EntityResolverChain = EntityResolverChainService.getInstance();
export { EntityResolverChainService };
