/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Global Search Engine (GSE)
 * Standard     : SXP Constitution v1.0 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Federated search across Products, Customers, Actions, and Workspaces.
 * CommandPaletteModal (Ctrl+K) is the primary consumer.
 * New search sources register via registerSource() — no engine modification needed.
 */

import { WorkspaceRegistry } from "./WorkspaceRegistry.js";
import { WorkspaceActionRegistry } from "./WorkspaceActionRegistry.js";
import { WorkspaceNavigationEngine } from "./WorkspaceNavigationEngine.js";
import { adaptiveWorkspaceStore } from "./adaptive_workspace_store.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchResultType = "product" | "customer" | "action" | "workspace" | "document" | "custom";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  icon?: string;
  /** On selection — navigate, execute, or custom handler */
  onSelect(): void;
}

export interface SearchSource {
  id: string;
  label: string;
  /** Called on every query — return results within 150ms (SXP perf budget) */
  search(query: string): Promise<SearchResult[]>;
}

// ── Built-in Sources ──────────────────────────────────────────────────────────

const workspaceSource: SearchSource = {
  id: "workspaces",
  label: "Workspaces",
  async search(query) {
    const q = query.toLowerCase();
    return WorkspaceRegistry.getAll()
      .filter((w) => w.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map((w) => ({
        id: `ws:${w.id}`,
        type: "workspace" as const,
        title: w.title,
        subtitle: w.domainId,
        icon: w.icon,
        onSelect: () => WorkspaceNavigationEngine.navigate(w.id),
      }));
  },
};

const actionSource: SearchSource = {
  id: "actions",
  label: "Actions",
  async search(query) {
    const q = query.toLowerCase();
    const mode = adaptiveWorkspaceStore.getMode();
    return WorkspaceActionRegistry.getVisible(mode)
      .filter((a) => a.label.toLowerCase().includes(q) || a.id.includes(q))
      .slice(0, 5)
      .map((a) => ({
        id: `action:${a.id}`,
        type: "action" as const,
        title: a.label,
        subtitle: a.shortcut ? `Shortcut: ${a.shortcut}` : "Action",
        icon: a.icon,
        onSelect: () => {
          WorkspaceActionRegistry.execute(a.id, {
            tenantId: "default",
            userId: "search_user",
            workspaceId: "global_search",
            mode,
          });
        },
      }));
  },
};

// ── Engine ────────────────────────────────────────────────────────────────────

class GlobalSearchEngineService {
  private readonly sources: Map<string, SearchSource> = new Map([
    ["workspaces", workspaceSource],
    ["actions", actionSource],
  ]);

  /** Register an additional search source (called by studio manifests or plugins) */
  public registerSource(source: SearchSource): void {
    this.sources.set(source.id, source);
  }

  /**
   * Execute federated search across all registered sources.
   * Returns results within SXP performance budget (< 150ms).
   */
  public async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const q = query.trim();

    const resultSets = await Promise.allSettled(
      Array.from(this.sources.values()).map((source) =>
        source.search(q).then((results) => results)
      )
    );

    const combined: SearchResult[] = [];
    resultSets.forEach((r) => {
      if (r.status === "fulfilled") {
        combined.push(...r.value);
      }
    });

    // Sort: actions first, then workspaces, then others
    const typeOrder: Record<SearchResultType, number> = {
      action: 0,
      workspace: 1,
      product: 2,
      customer: 3,
      document: 4,
      custom: 5,
    };
    return combined.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));
  }

  public getSources(): string[] {
    return Array.from(this.sources.keys());
  }

  /** Remove a previously registered search source */
  public unregisterSource(id: string): void {
    this.sources.delete(id);
  }
}

export const GlobalSearchEngine = new GlobalSearchEngineService();
