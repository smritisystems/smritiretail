/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Context Resolver Chain (Phase 1)
 *                "What field does the cursor point to?"
 * Standard     : UCIF-001 through UCIF-005 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * KND-001: Pure service — no React, no DOM rendering.
 *
 * Resolver priority order (lower number = tried first):
 *   1. DOMFieldResolver    — reads activeElement id/name
 *   2. GridCellResolver    — active grid cell from SmritiSpreadsheetStudio
 *   3. TableRowResolver    — selected row from SEEFDataTable context
 *   4. TreeNodeResolver    — tree node selection
 *   5. SelectionResolver   — selected cards/items
 *   6. BarcodeResolver     — scanned barcode text → field context
 *   7. WorkspaceResolver   — fallback: active workspace domain
 *
 * Adding a new resolver (e.g., camera, OCR, voice):
 *   ContextResolverChain.registerResolver(new MyCameraResolver());
 *   No other change needed — chain picks it up automatically.
 */

import type { FieldContext, IContextResolver } from "./InspectorSchema.js";

// ── Built-in Resolvers ────────────────────────────────────────────────────────

/** Priority 1 — reads focused DOM element id/name */
class DOMFieldResolver implements IContextResolver {
  name = "DOMFieldResolver";
  priority = 1;

  async resolve(activeElement?: HTMLElement): Promise<FieldContext | null> {
    const el = activeElement ?? (typeof document !== "undefined" ? document.activeElement as HTMLElement : null);
    if (!el) return null;

    const fieldId =
      el.getAttribute("id") ||
      el.getAttribute("name") ||
      el.getAttribute("data-field-id");

    if (!fieldId) return null;

    const rawValue =
      (el as HTMLInputElement).value ||
      el.getAttribute("data-value") ||
      el.textContent?.trim() ||
      undefined;

    const formId = el.closest("form")?.id || el.getAttribute("data-form-id") || undefined;

    return {
      fieldId,
      formId: formId ?? undefined,
      rawValue: rawValue ?? undefined,
      sourceElement: el,
    };
  }
}

/** Priority 2 — SpreadsheetStudio grid cell context */
class GridCellResolver implements IContextResolver {
  name = "GridCellResolver";
  priority = 2;

  async resolve(activeElement?: HTMLElement): Promise<FieldContext | null> {
    const el = activeElement ?? (typeof document !== "undefined" ? document.activeElement as HTMLElement : null);
    if (!el) return null;

    // SpreadsheetStudio cells carry data-grid-field and data-grid-form
    const gridField = el.closest("[data-grid-field]")?.getAttribute("data-grid-field");
    const gridForm = el.closest("[data-grid-form]")?.getAttribute("data-grid-form");
    const gridValue = el.closest("[data-grid-value]")?.getAttribute("data-grid-value");

    if (!gridField) return null;

    return {
      fieldId: gridField,
      formId: gridForm ?? undefined,
      rawValue: gridValue ?? undefined,
      sourceElement: el,
    };
  }
}

/** Priority 3 — SEEFDataTable selected row */
class TableRowResolver implements IContextResolver {
  name = "TableRowResolver";
  priority = 3;

  async resolve(activeElement?: HTMLElement): Promise<FieldContext | null> {
    const el = activeElement ?? (typeof document !== "undefined" ? document.activeElement as HTMLElement : null);
    if (!el) return null;

    const row = el.closest("[data-table-entity-type]");
    if (!row) return null;

    const entityType = row.getAttribute("data-table-entity-type");
    const entityId = row.getAttribute("data-table-entity-id");

    if (!entityType) return null;

    return {
      fieldId: entityType,   // Use entity type as pseudo-fieldId
      rawValue: entityId ?? undefined,
      sourceElement: el,
    };
  }
}

/** Priority 4 — Tree node selection */
class TreeNodeResolver implements IContextResolver {
  name = "TreeNodeResolver";
  priority = 4;

  async resolve(activeElement?: HTMLElement): Promise<FieldContext | null> {
    const el = activeElement ?? (typeof document !== "undefined" ? document.activeElement as HTMLElement : null);
    if (!el) return null;

    const node = el.closest("[data-tree-entity-type]");
    if (!node) return null;

    return {
      fieldId: node.getAttribute("data-tree-entity-type") || "",
      rawValue: node.getAttribute("data-tree-entity-id") ?? undefined,
      sourceElement: el,
    };
  }
}

/** Priority 5 — Selected cards (card view) */
class SelectionResolver implements IContextResolver {
  name = "SelectionResolver";
  priority = 5;

  async resolve(activeElement?: HTMLElement): Promise<FieldContext | null> {
    const el = activeElement ?? (typeof document !== "undefined" ? document.activeElement as HTMLElement : null);
    if (!el) return null;

    const card = el.closest("[data-card-entity-type]");
    if (!card) return null;

    return {
      fieldId: card.getAttribute("data-card-entity-type") || "",
      rawValue: card.getAttribute("data-card-entity-id") ?? undefined,
      sourceElement: el,
    };
  }
}

/** Priority 6 — Barcode scanner text field */
class BarcodeResolver implements IContextResolver {
  name = "BarcodeResolver";
  priority = 6;

  async resolve(activeElement?: HTMLElement): Promise<FieldContext | null> {
    const el = activeElement ?? (typeof document !== "undefined" ? document.activeElement as HTMLElement : null);
    if (!el) return null;

    const isBarcodeField =
      el.getAttribute("data-barcode-field") === "true" ||
      el.getAttribute("data-field-type") === "barcode";

    if (!isBarcodeField) return null;

    const rawValue = (el as HTMLInputElement).value;
    if (!rawValue) return null;

    return {
      fieldId: "barcode",
      rawValue,
      sourceElement: el,
    };
  }
}

/** Priority 7 — Fallback: active workspace domain context */
class WorkspaceResolver implements IContextResolver {
  name = "WorkspaceResolver";
  priority = 7;

  async resolve(_activeElement?: HTMLElement): Promise<FieldContext | null> {
    if (typeof document === "undefined") return null;

    // Read active domain from workspace shell attributes
    const workspaceEl = document.querySelector("[data-active-domain]");
    const domain = workspaceEl?.getAttribute("data-active-domain");
    if (!domain) return null;

    return {
      fieldId: domain,
      rawValue: undefined,
      sourceElement: workspaceEl as HTMLElement | undefined ?? undefined,
    };
  }
}

// ── Resolver Chain Service ────────────────────────────────────────────────────

class ContextResolverChainService {
  private static instance: ContextResolverChainService | null = null;

  private resolvers: IContextResolver[] = [
    new DOMFieldResolver(),
    new GridCellResolver(),
    new TableRowResolver(),
    new TreeNodeResolver(),
    new SelectionResolver(),
    new BarcodeResolver(),
    new WorkspaceResolver(),
  ];

  private constructor() {
    // Sort by priority ascending (lower = higher priority)
    this.resolvers.sort((a, b) => a.priority - b.priority);
  }

  public static getInstance(): ContextResolverChainService {
    if (!ContextResolverChainService.instance) {
      ContextResolverChainService.instance = new ContextResolverChainService();
    }
    return ContextResolverChainService.instance;
  }

  /**
   * Try each resolver in priority order.
   * Returns the first non-null result.
   * Async — supports camera, OCR, AI vision, voice resolvers in future.
   */
  public async resolve(activeElement?: HTMLElement): Promise<FieldContext | null> {
    const el = activeElement ?? (typeof document !== "undefined" ? document.activeElement as HTMLElement : undefined);

    for (const resolver of this.resolvers) {
      try {
        const result = await resolver.resolve(el);
        if (result && result.fieldId) {
          return result;
        }
      } catch (err) {
        console.warn(`[UCIF ContextResolver] ${resolver.name} failed:`, err);
      }
    }
    return null;
  }

  /** Register a custom resolver (plugins: camera, OCR, AI vision, voice) */
  public registerResolver(resolver: IContextResolver): void {
    this.resolvers = [...this.resolvers, resolver].sort((a, b) => a.priority - b.priority);
  }

  public unregisterResolver(name: string): void {
    this.resolvers = this.resolvers.filter((r) => r.name !== name);
  }

  public getRegisteredResolvers(): string[] {
    return this.resolvers.map((r) => r.name);
  }
}

export const ContextResolverChain = ContextResolverChainService.getInstance();
export { ContextResolverChainService };
