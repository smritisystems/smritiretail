/**
 * Project      : SMRITI Retail OS
 * Module       : UDCP — UDCPKernel (Master Discovery Kernel)
 * Standard     : UDCP-001 through UDCP-007 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * KND-001: Pure service — no React, no DOM rendering.
 *
 * UDCP-001: Discovery logic lives in kernel, not in components.
 * UDCP-006: Providers discover; they never execute business logic.
 * UDCP-007: Side-effect free.
 *
 * Built-in Discovery Providers:
 *   1. NavigationDiscoveryProvider — screens & navigation routes
 *   2. WorkspaceDiscoveryProvider  — workspace domain tiles
 *   3. EntityDiscoveryProvider     — records from SPK.ule (Customer, Item, Supplier...)
 *   4. ActionDiscoveryProvider     — executable actions from WorkspaceActionRegistry
 *   5. ReportDiscoveryProvider     — analytical reports from ReportRegistry
 *   6. IntelligenceProvider        — AI skills & advice from AIRegistry
 *   7. UserContextProvider         — Recent, Pinned, Favorites, Frequently Used
 */

import type {
  DiscoveryResult,
  DiscoveryContext,
  IDiscoveryProvider,
  ProviderHealth,
  DiscoverySession,
  VocabularyProvider,
  ExecutionStrategy,
} from "./UDCPSchema.js";

import { DiscoveryIndex } from "./DiscoveryIndex.js";
import { UDCPQueryPipeline } from "./UDCPQueryPipeline.js";
import { UDCPRankingEngine } from "./UDCPRankingEngine.js";
import { UDCPEventBus } from "./UDCPEventBus.js";
import { NavigationRegistry } from "../navigation/NavigationRegistry.js";
import { WorkspaceActionRegistry } from "../../../layout_engine/WorkspaceActionRegistry.js";
import { ReportRegistry } from "../reports/ReportRegistry.js";
import { AIRegistry } from "../ai/AIRegistry.js";
import { PermissionRegistry } from "../security/PermissionRegistry.js";
import { UCIFKernel } from "../context/UCIFKernel.js";

// ── Built-in Providers ────────────────────────────────────────────────────────

class NavigationDiscoveryProvider implements IDiscoveryProvider {
  id = "provider.navigation";
  name = "Navigation Provider";
  priority = 1;
  mode: "online" | "offline" | "hybrid" = "hybrid";

  health(): ProviderHealth { return "Healthy"; }

  async search(query: string): Promise<DiscoveryResult[]> {
    const domains = NavigationRegistry.getDomains();
    const results: DiscoveryResult[] = [];

    domains.forEach((d) => {
      const title = (d as any).title || d.id;
      if (!query || title.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          id: `nav_${d.id}`,
          type: "navigation",
          title,
          subtitle: `Domain • ${(d.modules || []).length} Modules`,
          icon: d.icon || "compass",
          badge: "DOMAIN",
          score: 85,
          provider: this.id,
          executionStrategy: "navigate",
          navigate: () => {
            window.dispatchEvent(new CustomEvent("spk:switch-domain", { detail: { domainId: d.id } }));
          },
        });
      }
    });

    return results;
  }
}

class ActionDiscoveryProvider implements IDiscoveryProvider {
  id = "provider.action";
  name = "Action Provider";
  priority = 2;
  mode: "online" | "offline" | "hybrid" = "hybrid";

  health(): ProviderHealth { return "Healthy"; }

  async search(query: string): Promise<DiscoveryResult[]> {
    const actions = WorkspaceActionRegistry.getAll();
    const results: DiscoveryResult[] = [];

    actions.forEach((a) => {
      if (!query || a.label.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          id: `action_${a.id}`,
          type: "action",
          title: a.label,
          subtitle: a.shortcut ? `Shortcut: ${a.shortcut}` : "System Action",
          icon: a.icon || "zap",
          badge: a.shortcut ?? "ACTION",
          score: 80,
          provider: this.id,
          executionStrategy: "dialog",
          workspaceActionId: a.id,
          execute: () => {
            WorkspaceActionRegistry.execute(a.id, {
              tenantId: "TENANT-001",
              userId: "USER-101",
              workspaceId: "global",
              mode: "ADVANCED",
            });
          },
        } as any);
      }
    });

    return results;
  }
}

class EntityDiscoveryProvider implements IDiscoveryProvider {
  id = "provider.entity";
  name = "Entity Provider";
  priority = 3;
  mode: "online" | "offline" | "hybrid" = "hybrid";

  health(): ProviderHealth { return "Healthy"; }

  async search(query: string): Promise<DiscoveryResult[]> {
    if (!query) return [];

    // Query pre-indexed DiscoveryIndex
    const indexed = DiscoveryIndex.search(query);
    if (indexed.length > 0) return indexed;

    // Fallback seed entities for search demonstration
    const seedRecords = [
      { id: "CUST-001", type: "customer", title: "Arjun Traders", subtitle: "GST: 29AAACT2727Q1ZX", icon: "👤", badge: "Gold" },
      { id: "NK-AZ-42B", type: "product", title: "Nike Air Zoom", subtitle: "Stock: 245 Pcs • ₹3,999", icon: "📦", badge: "Footwear" },
      { id: "SUPP-101", type: "supplier", title: "ABC Distribution", subtitle: "GST: 27AABCU9603R1ZX", icon: "🏭", badge: "Supplier" },
      { id: "INV-2026-4521", type: "invoice", title: "Invoice #INV-2026-4521", subtitle: "Arjun Traders • ₹18,500", icon: "🧾", badge: "Pending" },
    ];

    const results: DiscoveryResult[] = [];
    const q = query.toLowerCase();

    seedRecords.forEach((r) => {
      if (r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)) {
        results.push({
          id: `entity_${r.type}_${r.id}`,
          type: "entity",
          title: r.title,
          subtitle: r.subtitle,
          icon: r.icon,
          badge: r.badge,
          entityType: r.type,
          entityId: r.id,
          score: r.title.toLowerCase().startsWith(q) ? 90 : 75,
          provider: this.id,
          executionStrategy: "inspect",
          inspect: () => {
            UCIFKernel.inspect("compact");
          },
        });
      }
    });

    return results;
  }
}

class UserContextProvider implements IDiscoveryProvider {
  id = "provider.user_context";
  name = "User Context Provider";
  priority = 0; // Highest priority for recents/pinned
  mode: "online" | "offline" | "hybrid" = "hybrid";

  health(): ProviderHealth { return "Healthy"; }

  async search(query: string): Promise<DiscoveryResult[]> {
    if (query) return []; // Only show when query is empty (recent/pinned)

    const pinned = UCIFKernel.getPinned();
    const history = UCIFKernel.getHistory();

    const results: DiscoveryResult[] = [];

    pinned.forEach((p) => {
      results.push({
        id: `pinned_${p.entityType}_${p.entityId}`,
        type: "entity",
        title: p.title,
        subtitle: `Pinned • ${p.entityType}`,
        icon: "📌",
        badge: "PINNED",
        entityType: p.entityType,
        entityId: p.entityId,
        score: 100,
        provider: this.id,
        executionStrategy: "inspect",
        inspect: () => UCIFKernel.inspect("compact"),
      });
    });

    history.slice(0, 5).forEach((h) => {
      results.push({
        id: `recent_${h.entityType}_${h.entityId}`,
        type: "entity",
        title: h.title,
        subtitle: `Recent • ${h.entityType}`,
        icon: "🕒",
        badge: "RECENT",
        entityType: h.entityType,
        entityId: h.entityId,
        score: 95,
        provider: this.id,
        executionStrategy: "inspect",
        inspect: () => UCIFKernel.inspect("compact"),
      });
    });

    return results;
  }
}

// ── UDCPKernel Master Service ─────────────────────────────────────────────────

class UDCPKernelService {
  private static instance: UDCPKernelService | null = null;
  private providers: Map<string, IDiscoveryProvider> = new Map();
  private currentSession: DiscoverySession | null = null;

  private constructor() {
    // Register built-in discovery providers
    this.registerProvider(new UserContextProvider());
    this.registerProvider(new NavigationDiscoveryProvider());
    this.registerProvider(new ActionDiscoveryProvider());
    this.registerProvider(new EntityDiscoveryProvider());
  }

  public static getInstance(): UDCPKernelService {
    if (!UDCPKernelService.instance) {
      UDCPKernelService.instance = new UDCPKernelService();
    }
    return UDCPKernelService.instance;
  }

  // ── Primary API ────────────────────────────────────────────────────────────

  /**
   * Search across all registered providers in parallel.
   * Query Pipeline → Multi-provider fetch → Ranking → Permission Filter → Event
   */
  public async search(query: string, context?: DiscoveryContext): Promise<DiscoveryResult[]> {
    const startTime = performance.now();
    const session = this.startSession(query);

    UDCPEventBus.emit("SearchStarted", { query, sessionId: session.id });

    const processed = UDCPQueryPipeline.process(query, context?.industry);
    const providersList = Array.from(this.providers.values())
      .filter((p) => p.health() === "Healthy" || p.health() === "Slow")
      .sort((a, b) => a.priority - b.priority);

    // Parallel discovery fetch
    const rawResultsArrays = await Promise.all(
      providersList.map((p) =>
        p.search(processed.normalized || processed.original, context).catch((err) => {
          console.warn(`[UDCP] Provider ${p.name} failed:`, err);
          UDCPEventBus.emit("ProviderFailed", { providerId: p.id });
          return [] as DiscoveryResult[];
        })
      )
    );

    const merged = rawResultsArrays.flat();

    // Ranking Engine
    const ranked = UDCPRankingEngine.rank(merged, processed.terms, context);

    // RBAC Permission Filter (UDCP-003 / USR-007)
    const filtered = ranked.filter((r) => {
      if (!r.permission) return true;
      try {
        const perm = PermissionRegistry.getPermission(r.permission);
        return perm !== undefined;
      } catch {
        return true;
      }
    });

    const durationMs = Math.round(performance.now() - startTime);
    session.resultsCount = filtered.length;
    session.durationMs = durationMs;

    UDCPEventBus.emit("SearchCompleted", { query, sessionId: session.id, resultsCount: filtered.length, durationMs });

    return filtered;
  }

  /** Execute a discovery result */
  public async executeResult(result: DiscoveryResult): Promise<void> {
    if (this.currentSession) {
      this.currentSession.selectedResultId = result.id;
      this.currentSession.executedStrategy = result.executionStrategy;
    }

    UDCPEventBus.emit("ResultExecuted", { resultId: result.id, providerId: result.provider });

    if (result.execute) {
      await result.execute();
    } else if (result.navigate) {
      result.navigate();
    } else if (result.inspect) {
      result.inspect();
    }
  }

  /** Inspect a discovery result via UCIF */
  public async inspectResult(result: DiscoveryResult): Promise<void> {
    UDCPEventBus.emit("ResultInspected", { resultId: result.id, providerId: result.provider });
    if (result.inspect) {
      result.inspect();
    } else if (result.entityType && result.entityId) {
      UCIFKernel.inspect("compact");
    }
  }

  // ── Provider Registration ──────────────────────────────────────────────────

  public registerProvider(provider: IDiscoveryProvider): void {
    this.providers.set(provider.id, provider);
    UDCPEventBus.emit("ProviderRegistered", { providerId: provider.id });
  }

  public registerVocabulary(pack: VocabularyProvider): void {
    UDCPQueryPipeline.registerVocabulary(pack);
  }

  // ── Sessions & Telemetry ───────────────────────────────────────────────────

  public startSession(query: string): DiscoverySession {
    this.currentSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      startedAt: new Date().toISOString(),
      query,
      resultsCount: 0,
      durationMs: 0,
    };
    return this.currentSession;
  }

  public getCurrentSession(): DiscoverySession | null {
    return this.currentSession;
  }

  public getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const UDCPKernel = UDCPKernelService.getInstance();
export { UDCPKernelService };
