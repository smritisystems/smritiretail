/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — UCIFKernel (Root Service)
 * Standard     : UCIF-001 through UCIF-005 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * KND-001: Pure service — no React, no DOM rendering.
 *
 * Single root for all UCIF subsystems.
 * Exposed as SPK.ucif.* on SMRITIPlatformKernel.
 *
 * Public API surface (SPK.ucif.*):
 *   inspect()               full pipeline: resolve → disambiguate → open panel
 *   preview()               hover preview variant
 *   resolveField()          Phase 1: cursor → FieldContext
 *   resolveEntity()         Phase 2: FieldContext → EntityContext[]
 *   registerInspector()     seed InspectorConfig
 *   registerInspectorSection() inject a plugin section (VS Code pattern)
 *   registerDataProvider()  add REST/mock/custom data provider
 *   registerContextResolver() add Phase 1 resolver (barcode, camera, voice…)
 *   registerEntityResolver() add Phase 2 resolver
 *   onLifecycle()           subscribe to lifecycle events
 *   getHistory()            recent resolved contexts
 *   pin() / favorite()
 *   getTelemetry()          analytics service handle
 */

import type {
  InspectorConfig,
  InspectorSectionDef,
  InspectorVariant,
  InspectorLifecycleEvent,
  LifecycleSubscriber,
  FieldContext,
  EntityContext,
  ResolvedContext,
  IInspectorDataProvider,
  IContextResolver,
  IEntityResolver,
} from "./InspectorSchema.js";

import { InspectorRegistry } from "./InspectorRegistry.js";
import { InspectorDataService } from "./InspectorDataProvider.js";
import { InspectorLifecycleManager } from "./InspectorLifecycleManager.js";
import { InspectorTelemetryService } from "./InspectorTelemetryService.js";
import { ContextResolverChain } from "./ContextResolverChain.js";
import { EntityResolverChain } from "./EntityResolverChain.js";

// Re-export for consumers that import from UCIFKernel directly
export type {
  InspectorConfig, InspectorSectionDef, InspectorVariant,
  InspectorLifecycleEvent, LifecycleSubscriber,
  FieldContext, EntityContext, ResolvedContext,
  IInspectorDataProvider, IContextResolver, IEntityResolver,
};

const DEFAULT_CONFIDENCE_THRESHOLD = 60;
const MAX_HISTORY = 50;

class UCIFKernelService {
  private static instance: UCIFKernelService | null = null;

  // Subsystem references
  public readonly registry = InspectorRegistry;
  public readonly dataService = InspectorDataService;
  public readonly lifecycle = InspectorLifecycleManager;
  public readonly telemetry = InspectorTelemetryService;
  public readonly contextResolvers = ContextResolverChain;
  public readonly entityResolvers = EntityResolverChain;

  // State
  private history: ResolvedContext[] = [];
  private pinned: ResolvedContext[] = [];
  private favorites: ResolvedContext[] = [];
  private breadcrumbStack: ResolvedContext[] = [];

  /** External panel opener — injected by DrillDownProvider bridge */
  private _openPanelFn: ((ctx: ResolvedContext) => void) | null = null;
  private _showDisambiguationFn: ((candidates: ResolvedContext[]) => void) | null = null;
  private _showConfirmationFn: ((ctx: ResolvedContext, onConfirm: () => void) => void) | null = null;

  private constructor() {}

  public static getInstance(): UCIFKernelService {
    if (!UCIFKernelService.instance) {
      UCIFKernelService.instance = new UCIFKernelService();
    }
    return UCIFKernelService.instance;
  }

  // ── Panel Bridge (injected by React layer at startup) ──────────────────────

  /**
   * Called once by AdaptiveWorkspaceLayout to wire the React panel opener.
   * UCIFKernel itself stays kernel-independent (KND-001).
   */
  public injectPanelOpener(fn: (ctx: ResolvedContext) => void): void {
    this._openPanelFn = fn;
  }

  public injectDisambiguationUI(fn: (candidates: ResolvedContext[]) => void): void {
    this._showDisambiguationFn = fn;
  }

  public injectConfirmationUI(fn: (ctx: ResolvedContext, onConfirm: () => void) => void): void {
    this._showConfirmationFn = fn;
  }

  // ── Primary API ────────────────────────────────────────────────────────────

  /**
   * Full UCIF pipeline:
   *   Phase 1: resolveField (cursor → field)
   *   Phase 2: resolveEntity (field → entity[])
   *   Then: open panel / show disambiguation / show confirmation
   */
  public async inspect(variant: InspectorVariant = "compact"): Promise<ResolvedContext[] | null> {
    this.lifecycle.emit("BeforeResolve", {});

    const fieldCtx = await this.resolveField();
    if (!fieldCtx) {
      console.info("[UCIF] No field context resolved — ContextResolverChain returned null.");
      return null;
    }

    const entityCandidates = await this.resolveEntity(fieldCtx);
    if (entityCandidates.length === 0) {
      console.info("[UCIF] No entity resolved for field:", fieldCtx.fieldId);
      return null;
    }

    // Map EntityContext[] → ResolvedContext[]
    const resolved: ResolvedContext[] = entityCandidates.map((ec) => ({
      ...ec,
      title: ec.entityType.charAt(0).toUpperCase() + ec.entityType.slice(1),
      sourceField: fieldCtx.fieldId,
      variant,
    }));

    this.lifecycle.emit("Resolved", {
      entityType: resolved[0].entityType,
      entityId: resolved[0].entityId,
      confidence: resolved[0].confidence,
      resolvedBy: resolved[0].resolvedBy,
      variant,
    });

    this.telemetry.trackResolve(resolved[0].entityType, resolved[0].resolvedBy, resolved[0].confidence);

    const config = this.registry.resolveConfig(resolved[0].entityType, variant);
    const threshold = config?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

    if (resolved.length === 1) {
      const ctx = resolved[0];
      if (ctx.confidence >= threshold) {
        this._doOpenPanel(ctx);
      } else {
        // Low confidence — ask user to confirm
        this._showConfirmationFn?.(ctx, () => this._doOpenPanel(ctx));
      }
    } else {
      // Multiple candidates — disambiguation picker
      this._showDisambiguationFn?.(resolved);
    }

    return resolved;
  }

  /** Preview variant (hover) — fast, minimal */
  public async preview(el?: HTMLElement): Promise<ResolvedContext | null> {
    const fieldCtx = await this.resolveField(el);
    if (!fieldCtx) return null;

    const candidates = await this.resolveEntity(fieldCtx);
    if (candidates.length === 0) return null;

    const best = candidates[0];
    if (best.confidence < DEFAULT_CONFIDENCE_THRESHOLD) return null;

    const resolved: ResolvedContext = {
      ...best,
      title: best.entityType.charAt(0).toUpperCase() + best.entityType.slice(1),
      sourceField: fieldCtx.fieldId,
      variant: "preview",
    };

    return resolved;
  }

  // ── Two-Phase Resolution ───────────────────────────────────────────────────

  /** Phase 1: cursor/selection → FieldContext */
  public async resolveField(el?: HTMLElement): Promise<FieldContext | null> {
    return ContextResolverChain.resolve(el);
  }

  /** Phase 2: FieldContext → EntityContext[] (sorted by confidence desc) */
  public async resolveEntity(fieldCtx: FieldContext): Promise<EntityContext[]> {
    return EntityResolverChain.resolve(fieldCtx);
  }

  // ── Registry Delegation ────────────────────────────────────────────────────

  public registerInspector(config: InspectorConfig): void {
    this.registry.registerConfig(config);
  }

  public registerInspectorSection(entityType: string, section: InspectorSectionDef): void {
    this.registry.registerSection(entityType, section);
  }

  public registerDataProvider(provider: IInspectorDataProvider): void {
    this.dataService.registerProvider(provider);
  }

  public registerContextResolver(resolver: IContextResolver): void {
    this.contextResolvers.registerResolver(resolver);
  }

  public registerEntityResolver(resolver: IEntityResolver): void {
    this.entityResolvers.registerResolver(resolver);
  }

  // ── Lifecycle Delegation ───────────────────────────────────────────────────

  public onLifecycle(
    event: InspectorLifecycleEvent | "*",
    handler: LifecycleSubscriber
  ): () => void {
    return this.lifecycle.on(event, handler);
  }

  // ── State ──────────────────────────────────────────────────────────────────

  public getHistory(): ResolvedContext[] {
    return [...this.history];
  }

  public getPinned(): ResolvedContext[] {
    return [...this.pinned];
  }

  public getFavorites(): ResolvedContext[] {
    return [...this.favorites];
  }

  public pin(context: ResolvedContext): void {
    const key = `${context.entityType}_${context.entityId}`;
    this.pinned = this.pinned.filter((p) => `${p.entityType}_${p.entityId}` !== key);
    this.pinned.unshift(context);
    this.lifecycle.emit("Pinned", { entityType: context.entityType, entityId: context.entityId });
  }

  public unpin(entityType: string, entityId: string): void {
    const key = `${entityType}_${entityId}`;
    this.pinned = this.pinned.filter((p) => `${p.entityType}_${p.entityId}` !== key);
  }

  public favorite(context: ResolvedContext): void {
    const key = `${context.entityType}_${context.entityId}`;
    this.favorites = this.favorites.filter((f) => `${f.entityType}_${f.entityId}` !== key);
    this.favorites.unshift(context);
    this.lifecycle.emit("Favorited", { entityType: context.entityType, entityId: context.entityId });
  }

  public getTelemetry(): typeof InspectorTelemetryService {
    return InspectorTelemetryService;
  }

  // ── Refresh API (UCIF v1.1) ────────────────────────────────────────────────

  /**
   * Invalidate cache and trigger re-fetch for an entity inspector.
   * Emits "Loaded" lifecycle event when fresh data arrives.
   */
  public async refresh(entityType: string, entityId: string): Promise<void> {
    this.dataService.invalidateCache(entityType, entityId);
    this.lifecycle.emit("Loaded", { entityType, entityId, data: { refreshed: true } });
  }

  // ── Breadcrumb Context Graph Stack (UCIF v1.1) ──────────────────────────────

  public pushBreadcrumb(context: ResolvedContext): void {
    const existingIdx = this.breadcrumbStack.findIndex(
      (b) => b.entityType === context.entityType && b.entityId === context.entityId
    );
    if (existingIdx >= 0) {
      this.breadcrumbStack = this.breadcrumbStack.slice(0, existingIdx + 1);
    } else {
      this.breadcrumbStack.push(context);
    }
  }

  public popBreadcrumb(): ResolvedContext | undefined {
    return this.breadcrumbStack.pop();
  }

  public getBreadcrumbs(): ResolvedContext[] {
    return [...this.breadcrumbStack];
  }

  public clearBreadcrumbs(): void {
    this.breadcrumbStack = [];
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _doOpenPanel(ctx: ResolvedContext): void {
    this.lifecycle.emit("BeforeLoad", { entityType: ctx.entityType, entityId: ctx.entityId, variant: ctx.variant });
    this._openPanelFn?.(ctx);
    this._addToHistory(ctx);
    this.telemetry.trackOpen(ctx.entityType, ctx.variant ?? "compact");
  }

  private _addToHistory(ctx: ResolvedContext): void {
    const key = `${ctx.entityType}_${ctx.entityId}`;
    this.history = this.history.filter((h) => `${h.entityType}_${h.entityId}` !== key);
    this.history.unshift(ctx);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }
  }
}

export const UCIFKernel = UCIFKernelService.getInstance();
export { UCIFKernelService };
