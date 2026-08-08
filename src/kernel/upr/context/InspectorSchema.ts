/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Context Intelligence Framework (UCIF v1.0)
 *                InspectorSchema — Complete Type Contracts
 * Standard     : UCIF-001 through UCIF-005 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 */

// ── Variant & Lifecycle ───────────────────────────────────────────────────────

/** Inspector presentation variants */
export type InspectorVariant = "preview" | "compact" | "full" | string;

/** Inspector lifecycle event names — 8 stages */
export type InspectorLifecycleEvent =
  | "BeforeResolve"
  | "Resolved"
  | "BeforeLoad"
  | "Loaded"
  | "BeforeRender"
  | "Rendered"
  | "Pinned"
  | "Favorited"
  | "Closed";

// ── Capabilities ─────────────────────────────────────────────────────────────

/**
 * Capability flags per entity.
 * UniversalInspectorRenderer checks these before rendering optional sections.
 * No capability = that section is hidden — no hardcoded conditional logic.
 */
export interface InspectorCapabilities {
  /** Show AI Insight section (advisory only — AOP-001) */
  ai: boolean;
  /** Show activity timeline section */
  timeline: boolean;
  /** Show document attachments section */
  attachments: boolean;
  /** Show audit log section */
  audit: boolean;
  /** Show stock levels section (items only) */
  stock: boolean;
  /** Show pricing/margins section */
  pricing: boolean;
  /** Show workflow status section */
  workflow: boolean;
  /** Enable Context Graph — drillable values in inspector */
  relations: boolean;
}

// ── Field & Section Definitions ───────────────────────────────────────────────

/**
 * A single field displayed in an inspector section.
 * If drillable === true, the rendered value becomes a DrillableLink (Context Graph).
 */
export interface InspectorFieldDef {
  /** Key mapping to entity data (from DataProvider response) */
  key: string;
  /** Human-readable label */
  label: string;
  /** Value formatting hint for UniversalInspectorRenderer */
  format?: "currency" | "date" | "phone" | "badge" | "progress_bar" | "image" | "link" | "text";
  /** Optional Lucide icon name shown beside label */
  icon?: string;
  /** Render this field prominently (bold/large text) */
  highlight?: boolean;
  /** Wraps rendered value in DrillableLink — enables Context Graph navigation */
  drillable?: boolean;
  /** Entity type to inspect when this drillable value is clicked */
  drillEntityType?: string;
  /** Field name in the data object that holds the target entity ID */
  drillEntityIdField?: string;
  /** Data masking strategy for sensitive fields (UCIF v1.1) */
  maskStrategy?: "none" | "partial" | "hidden" | "role_based";
  /** Required permission scope for this specific field */
  permission?: string;
}

/**
 * A collapsible section within an inspector.
 * Supports progressive loading via dataKey and capability gating.
 */
export interface InspectorSectionDef {
  /** Unique section identifier */
  id: string;
  /** Section heading */
  title: string;
  /** Optional Lucide icon name */
  icon?: string;
  /** Fields to render in this section */
  fields: InspectorFieldDef[];
  /** Whether section is collapsible by user */
  collapsible?: boolean;
  /** Hide section unless entity has this capability enabled */
  requiresCapability?: keyof InspectorCapabilities;
  /** DataProvider fetch key — enables progressive loading */
  dataKey?: string;
  /** Set by registerInspectorSection() — identifies the injecting plugin */
  pluginId?: string;
  /** RBAC permission required to view this section (UCIF v1.1) */
  permission?: string;
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * A quick action declared in metadata.
 * Rendered automatically by UniversalInspectorRenderer.
 * Delegates execution to WorkspaceActionRegistry — no hardcoded callbacks.
 */
export interface InspectorActionDef {
  /** Unique action ID */
  id: string;
  /** Display label */
  label: string;
  /** Lucide icon name */
  icon: string;
  /** Delegates to WorkspaceActionRegistry.execute(workspaceActionId) */
  workspaceActionId: string;
  /** Only show in specific variant(s) */
  variant?: InspectorVariant | InspectorVariant[];
  /** Only show if entity has this capability */
  requiresCapability?: keyof InspectorCapabilities;
}

// ── InspectorConfig ───────────────────────────────────────────────────────────

/**
 * Complete metadata definition for a single entity+variant inspector.
 * Lives in InspectorRegistry — never in EntityRegistry.
 * Supports multiple configs per entity (one per variant).
 *
 * UCIF-002: No component may hardcode fields — everything comes from this config.
 */
export interface InspectorConfig {
  /** Target entity type (e.g., "product", "customer", "supplier") */
  entityType: string;
  /** Presentation variant */
  variant: InspectorVariant;
  /**
   * Semver version string.
   * InspectorRegistry uses this for plugin compatibility checks.
   * e.g., "1.0.0" — plugins declare range ">=1.0.0 <2.0.0"
   */
  version: string;
  /** Feature flags — renderer gates optional sections on these */
  capabilities: InspectorCapabilities;
  /** Show entity image in header */
  showImage?: boolean;
  /** Data key for image URL in entity data */
  imageField?: string;
  /** Data key for the primary title */
  titleField: string;
  /** Data key for the subtitle / secondary info */
  subtitleField?: string;
  /** Data key for the status badge */
  badgeField?: string;
  /** Inspector sections — rendered in order */
  sections: InspectorSectionDef[];
  /** Metadata-declared quick actions — rendered automatically */
  actions: InspectorActionDef[];
  /** AI skill ID — executed if capabilities.ai === true (advisory only — AOP-001) */
  aiSkillId?: string;
  /**
   * Which DataProvider to use.
   * Defaults to "cache_rest" (cache-first, then REST).
   */
  dataProviderId?: string;
  /** Confidence threshold — below this value the resolver shows confirmation prompt */
  confidenceThreshold?: number;
  /** RBAC permission required to open this inspector (UCIF v1.1) */
  permission?: string;
}

// ── DataProvider State Contract ───────────────────────────────────────────────

/**
 * Standardized response state wrapper returned by InspectorDataProvider.
 * UCIF-001: UI components consume this state structure directly.
 */
export interface DataProviderState<T = Record<string, any>> {
  data: T;
  loading: boolean;
  error: string | null;
  cached: boolean;
  offline: boolean;
  lastUpdated: string;
}

// ── Two-Phase Resolution Types ────────────────────────────────────────────────

/**
 * Phase 1 output — what field does the cursor point to?
 * Produced by ContextResolverChain.
 */
export interface FieldContext {
  /** The HTML id / name attribute or logical field identifier */
  fieldId: string;
  /** Form ID if resolvable from FormRegistry */
  formId?: string;
  /** Current raw value of the field (if any) */
  rawValue?: string;
  /** Source DOM element — available in browser context only */
  sourceElement?: HTMLElement;
}

/**
 * Phase 2 output — what entity does this field reference?
 * Produced by EntityResolverChain.
 */
export interface EntityContext {
  entityType: string;
  entityId: string;
  /** 0–100. Below threshold → confirmation prompt. */
  confidence: number;
  /** Which resolver produced this result */
  resolvedBy: string;
}

/**
 * Fully resolved inspection context — combines Phase 1 + Phase 2.
 */
export interface ResolvedContext extends EntityContext {
  /** Display title for the inspector header */
  title: string;
  /** Which form field triggered the inspection */
  sourceField?: string;
  /** Inspector variant to open */
  variant?: InspectorVariant;
  /** Context Graph navigation stack (UCIF v1.1) */
  breadcrumbs?: ResolvedContext[];
}

/**
 * A single candidate in a multi-context disambiguation scenario.
 * e.g., Invoice line may yield: Product + Invoice + Warehouse.
 */
export interface ResolvedContextCandidate {
  context: ResolvedContext;
  /** Display label for the disambiguation picker */
  label: string;
  /** Entity icon name (Lucide) */
  icon: string;
}

// ── Lifecycle Payload ─────────────────────────────────────────────────────────

export interface InspectorLifecyclePayload {
  event: InspectorLifecycleEvent;
  entityType?: string;
  entityId?: string;
  variant?: InspectorVariant;
  confidence?: number;
  resolvedBy?: string;
  timestamp: string;
  /** Arbitrary metadata from the emitting subsystem */
  data?: Record<string, any>;
}

export type LifecycleSubscriber = (payload: InspectorLifecyclePayload) => void;

// ── DataProvider Interface ────────────────────────────────────────────────────

/**
 * Contract every InspectorDataProvider must implement.
 * UCIF-001: No component calls apiFetch() directly — all data comes through this.
 */
export interface IInspectorDataProvider {
  id: string;
  /** Return true if this provider can serve data for the given entity type */
  canProvide(entityType: string): boolean;
  /**
   * Fetch entity data progressively.
   * For each section that finishes loading, call onSectionLoaded(sectionKey, data).
   * This enables progressive rendering — header appears instantly.
   */
  fetch(
    entityType: string,
    entityId: string,
    onSectionLoaded: (sectionKey: string, data: Record<string, any>) => void
  ): Promise<void>;
}

// ── Resolver Interfaces ───────────────────────────────────────────────────────

/** Phase 1 resolver — cursor/selection → FieldContext */
export interface IContextResolver {
  name: string;
  /** Lower number = higher priority */
  priority: number;
  resolve(activeElement?: HTMLElement): Promise<FieldContext | null>;
}

/** Phase 2 resolver — FieldContext → EntityContext[] */
export interface IEntityResolver {
  name: string;
  /** Base confidence score for results from this resolver */
  confidence: number;
  resolve(fieldCtx: FieldContext): Promise<EntityContext[]>;
}
