/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Universal Layout Registry (UFR-005)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UFR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface BreakpointConfig {
  mobile: number;  // Grid column span for mobile screens (<640px)
  tablet: number;  // Grid column span for tablet screens (<1024px)
  desktop: number; // Grid column span for desktop screens (>=1024px)
}

export interface LayoutDefinition {
  id: string;               // Layout identifier (e.g. "standard-12-col", "compact-grid", "master-detail")
  name: string;
  description?: string;
  totalColumns: number;     // Total grid columns (e.g. 12)
  defaultDensity: "compact" | "comfortable" | "spacious";
  stylePattern: "fiori-object-page" | "list-report" | "card-grid" | "form-sections";
  breakpoints: BreakpointConfig;
}

export class LayoutRegistryService {
  private layouts: Map<string, Readonly<LayoutDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultLayouts();
  }

  private seedDefaultLayouts() {
    const defaults: LayoutDefinition[] = [
      {
        id: "standard-12-col",
        name: "Standard 12-Column Responsive Layout",
        totalColumns: 12,
        defaultDensity: "comfortable",
        stylePattern: "form-sections",
        breakpoints: {
          mobile: 12,
          tablet: 12,
          desktop: 12
        }
      },
      {
        id: "compact-grid",
        name: "Compact High-Density Form Layout",
        totalColumns: 12,
        defaultDensity: "compact",
        stylePattern: "fiori-object-page",
        breakpoints: {
          mobile: 12,
          tablet: 4,
          desktop: 3
        }
      },
      {
        id: "two-column-equal",
        name: "Equal Two-Column Layout",
        totalColumns: 12,
        defaultDensity: "comfortable",
        stylePattern: "form-sections",
        breakpoints: {
          mobile: 12,
          tablet: 6,
          desktop: 6
        }
      }
    ];

    defaults.forEach((l) => this.registerLayout(l));
  }

  public registerLayout(layout: LayoutDefinition): void {
    const payload = Object.freeze({ ...layout, id: layout.id.toLowerCase() });
    this.layouts.set(payload.id, payload);
    this.emitChange();
  }

  public getLayout(id: string): Readonly<LayoutDefinition> | undefined {
    if (!id) return undefined;
    return this.layouts.get(id.toLowerCase());
  }

  public getLayouts(): ReadonlyArray<Readonly<LayoutDefinition>> {
    return Array.from(this.layouts.values());
  }

  public resolveGridClass(span: number = 12, layoutId: string = "standard-12-col"): string {
    const layout = this.getLayout(layoutId) || this.getLayout("standard-12-col")!;
    const desktopSpan = Math.min(12, Math.max(1, span));
    const tabletSpan = Math.min(12, Math.max(1, Math.ceil(span * (layout.breakpoints.tablet / 12))));

    return `col-span-12 md:col-span-${tabletSpan} lg:col-span-${desktopSpan}`;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.layouts.clear();
    this.seedDefaultLayouts();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const LayoutRegistry = new LayoutRegistryService();
