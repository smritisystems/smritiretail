/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Discovery & Command Platform (UDCP / SPK.udcp)
 *                UDCPSchema — Complete Type Contracts & Governance Interfaces
 * Standard     : UDCP-001 through UDCP-007 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 */

// ── Result Types & Execution Strategies ──────────────────────────────────────

/** Strongly-typed discovery result categories (Refinement #5) */
export type DiscoveryResultType =
  | "entity"
  | "navigation"
  | "action"
  | "report"
  | "document"
  | "ai"
  | "workspace"
  | "plugin"
  | "workflow"
  | "setting";

/** Execution strategy for discovered items (Refinement #7) */
export type ExecutionStrategy =
  | "navigate"
  | "inspect"
  | "dialog"
  | "download"
  | "workflow"
  | "api"
  | "plugin";

/** Provider health state (Refinement #3) */
export type ProviderHealth = "Healthy" | "Slow" | "Offline" | "Disabled" | "Unauthorized";

// ── Context & Decorators ──────────────────────────────────────────────────────

/** Context-aware search payload (Refinement #4) */
export interface DiscoveryContext {
  workspace?: string;
  domainId?: string;
  companyId?: string;
  branchId?: string;
  role?: string;
  mode?: "SIMPLE" | "HYBRID" | "ADVANCED";
  offline?: boolean;
  industry?: string;              // e.g. "jewellery", "pharmacy", "restaurant"
}

/** Result badge decorator (Refinement #5) */
export interface ResultDecorator {
  label: string;
  icon?: string;
  type?: "warning" | "info" | "success" | "accent" | "neutral";
}

// ── Universal Discovery Result Contract ────────────────────────────────────────

/**
 * Universal Discovery Result Contract returned by every DiscoveryProvider.
 * UDCP-002: Standardized result format across all providers.
 */
export interface DiscoveryResult {
  /** Unique result identifier */
  id: string;
  /** Categorized result type */
  type: DiscoveryResultType;
  /** Primary display title */
  title: string;
  /** Secondary detail / description */
  subtitle?: string;
  /** Lucide icon name or emoji symbol */
  icon?: string;
  /** Primary badge label */
  badge?: string;
  /** Result decorators (Low Stock, Pinned, AI Recommended) */
  decorators?: ResultDecorator[];
  /** Target entity type (if applicable e.g. "product", "customer") */
  entityType?: string;
  /** Target entity ID (if applicable e.g. "CUST-001") */
  entityId?: string;
  /** Calculated relevance score (0–100) */
  score: number;
  /** Provider ID that produced this result */
  provider: string;
  /** Required RBAC permission scope */
  permission?: string;
  /** Execution strategy */
  executionStrategy?: ExecutionStrategy;

  /** Action handles */
  actions?: Array<{ label: string; icon: string; workspaceActionId: string }>;
  /** Direct execution callback */
  execute?: () => void | Promise<void>;
  /** Direct workspace navigation callback */
  navigate?: () => void;
  /** Direct UCIF inspection callback */
  inspect?: () => void;
}

// ── Discovery Session ─────────────────────────────────────────────────────────

/** Discovery Session tracking (Refinement #2) */
export interface DiscoverySession {
  id: string;
  startedAt: string;
  query: string;
  resultsCount: number;
  selectedResultId?: string;
  executedStrategy?: ExecutionStrategy;
  durationMs: number;
}

// ── Discovery Provider Contract ───────────────────────────────────────────────

/**
 * Interface that every UDCP Discovery Provider must implement.
 * UDCP-006: Providers discover; they never execute business logic.
 * UDCP-007: Deterministic and side-effect free.
 */
export interface IDiscoveryProvider {
  id: string;
  name: string;
  priority: number;               // Lower number = higher priority
  mode: "online" | "offline" | "hybrid";
  health(): ProviderHealth;
  search(query: string, context?: DiscoveryContext): Promise<DiscoveryResult[]>;
}

// ── Vocabulary Provider Contract ──────────────────────────────────────────────

/**
 * Industry Vocabulary Pack Provider (Refinement #8).
 * Enables Industry Packs (Pharmacy, Jewellery, Restaurant) to register domain terms.
 */
export interface VocabularyProvider {
  industry: string;
  /** Maps synonym -> canonical term (e.g. "PCM" -> "Paracetamol", "22KT" -> "Gold") */
  synonyms: Record<string, string>;
}

// ── UDCP Event Payload ────────────────────────────────────────────────────────

export type UDCPEventType =
  | "SearchStarted"
  | "SearchCompleted"
  | "ResultExecuted"
  | "ResultInspected"
  | "ProviderRegistered"
  | "ProviderFailed";

export interface UDCPEventPayload {
  event: UDCPEventType;
  query?: string;
  sessionId?: string;
  resultsCount?: number;
  durationMs?: number;
  resultId?: string;
  providerId?: string;
  timestamp: string;
}

export type UDCPEventSubscriber = (payload: UDCPEventPayload) => void;
