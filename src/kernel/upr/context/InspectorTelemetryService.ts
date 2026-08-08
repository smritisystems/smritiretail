/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Inspector Telemetry Service
 * Standard     : UCIF-001 through UCIF-005 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * KND-001: Pure service — no React, no DOM rendering.
 *
 * Tracks:
 *   - Most used inspectors (entityType + variant)
 *   - Average open duration per entity
 *   - Most drilled fields (Context Graph usage)
 *   - AI insight invocations
 *   - Action usage per entity
 *   - Resolver performance (confidence + which resolver won)
 *
 * Storage: localStorage (key: "ucif_telemetry_v1")
 * Flush: Available for backend push via flushToBackend()
 */

const STORAGE_KEY = "ucif_telemetry_v1";

export interface TelemetryEntry {
  entityType: string;
  variant: string;
  openCount: number;
  totalDurationMs: number;
  resolver: string;
  avgConfidence: number;
  confidenceSamples: number;
}

export interface DrillEntry {
  fromEntity: string;
  fromField: string;
  toEntity: string;
  count: number;
}

export interface ActionEntry {
  entityType: string;
  actionId: string;
  count: number;
}

export interface AIInsightEntry {
  entityType: string;
  skillId: string;
  count: number;
}

interface TelemetryStore {
  inspectors: Record<string, TelemetryEntry>;
  drills: DrillEntry[];
  actions: ActionEntry[];
  aiInsights: AIInsightEntry[];
}

class InspectorTelemetryServiceClass {
  private static instance: InspectorTelemetryServiceClass | null = null;
  private store: TelemetryStore = { inspectors: {}, drills: [], actions: [], aiInsights: [] };
  private openTimers: Map<string, number> = new Map(); // entityType+variant → start ms

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): InspectorTelemetryServiceClass {
    if (!InspectorTelemetryServiceClass.instance) {
      InspectorTelemetryServiceClass.instance = new InspectorTelemetryServiceClass();
    }
    return InspectorTelemetryServiceClass.instance;
  }

  // ── Core Tracking ──────────────────────────────────────────────────────────

  public trackResolve(entityType: string, resolver: string, confidence: number): void {
    const key = entityType.toLowerCase();
    const entry = this.store.inspectors[key] || this.emptyEntry(entityType, "compact");
    entry.resolver = resolver;
    entry.avgConfidence = (entry.avgConfidence * entry.confidenceSamples + confidence) / (entry.confidenceSamples + 1);
    entry.confidenceSamples += 1;
    this.store.inspectors[key] = entry;
    this.persist();
  }

  public trackOpen(entityType: string, variant: string): void {
    const key = `${entityType.toLowerCase()}_${variant}`;
    const entry = this.store.inspectors[key] || this.emptyEntry(entityType, variant);
    entry.openCount += 1;
    this.store.inspectors[key] = entry;
    this.openTimers.set(key, performance.now());
    this.persist();
  }

  public trackClose(entityType: string, variant: string): void {
    const key = `${entityType.toLowerCase()}_${variant}`;
    const startTime = this.openTimers.get(key);
    if (startTime !== undefined) {
      const duration = Math.round(performance.now() - startTime);
      const entry = this.store.inspectors[key] || this.emptyEntry(entityType, variant);
      entry.totalDurationMs += duration;
      this.store.inspectors[key] = entry;
      this.openTimers.delete(key);
      this.persist();
    }
  }

  public trackDrill(fromEntity: string, fromField: string, toEntity: string): void {
    const existing = this.store.drills.find(
      (d) => d.fromEntity === fromEntity && d.fromField === fromField && d.toEntity === toEntity
    );
    if (existing) {
      existing.count += 1;
    } else {
      this.store.drills.push({ fromEntity, fromField, toEntity, count: 1 });
    }
    this.persist();
  }

  public trackAction(entityType: string, actionId: string): void {
    const existing = this.store.actions.find(
      (a) => a.entityType === entityType && a.actionId === actionId
    );
    if (existing) {
      existing.count += 1;
    } else {
      this.store.actions.push({ entityType, actionId, count: 1 });
    }
    this.persist();
  }

  public trackAIInsightUsed(entityType: string, skillId: string): void {
    const existing = this.store.aiInsights.find(
      (a) => a.entityType === entityType && a.skillId === skillId
    );
    if (existing) {
      existing.count += 1;
    } else {
      this.store.aiInsights.push({ entityType, skillId, count: 1 });
    }
    this.persist();
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  public getMostUsedInspectors(limit = 10): { entityType: string; variant: string; count: number }[] {
    return Object.values(this.store.inspectors)
      .sort((a, b) => b.openCount - a.openCount)
      .slice(0, limit)
      .map((e) => ({ entityType: e.entityType, variant: e.variant, count: e.openCount }));
  }

  public getAverageOpenDuration(entityType?: string): number {
    const entries = Object.values(this.store.inspectors).filter(
      (e) => !entityType || e.entityType === entityType
    );
    if (entries.length === 0) return 0;
    const totalMs = entries.reduce((sum, e) => sum + e.totalDurationMs, 0);
    const totalOpens = entries.reduce((sum, e) => sum + e.openCount, 0);
    return totalOpens > 0 ? Math.round(totalMs / totalOpens) : 0;
  }

  public getMostDrilledFields(limit = 10): DrillEntry[] {
    return [...this.store.drills].sort((a, b) => b.count - a.count).slice(0, limit);
  }

  public getAIInsightUsage(): AIInsightEntry[] {
    return [...this.store.aiInsights].sort((a, b) => b.count - a.count);
  }

  public flushToBackend(): TelemetryStore {
    return JSON.parse(JSON.stringify(this.store));
  }

  public reset(): void {
    this.store = { inspectors: {}, drills: [], actions: [], aiInsights: [] };
    this.persist();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private emptyEntry(entityType: string, variant: string): TelemetryEntry {
    return {
      entityType: entityType.toLowerCase(),
      variant,
      openCount: 0,
      totalDurationMs: 0,
      resolver: "",
      avgConfidence: 0,
      confidenceSamples: 0,
    };
  }

  private persist(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch {
      // Storage quota exceeded — silently ignore
    }
  }

  private loadFromStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.store = JSON.parse(raw);
      }
    } catch {
      this.store = { inspectors: {}, drills: [], actions: [], aiInsights: [] };
    }
  }
}

export const InspectorTelemetryService = InspectorTelemetryServiceClass.getInstance();
export { InspectorTelemetryServiceClass };
