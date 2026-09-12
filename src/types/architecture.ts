/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-09-03
 * Modified     : 2026-09-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Architecture Governance Typing
 */

export type ArchitectureRole =
  | "CANONICAL"
  | "ADAPTER"
  | "PROJECTION"
  | "CACHE"
  | "SPECIALIZED_UI"
  | "COMPATIBILITY"
  | "VERSIONED_CONTRACT"
  | "MIGRATION"
  | "STAGING"
  | "TEST_ONLY";

export type PreflightStatus =
  | "REUSE_EXISTING"
  | "DUPLICATE_CANDIDATE"
  | "ARCHITECTURE_DECISION_REQUIRED"
  | "CREATE_APPROVED";

export interface SmritiCapabilityMetadata {
  entity: string;
  capability: string;
  role: ArchitectureRole;
  description?: string;
  canonicalOwner?: string;
  decisionId?: string;
}

export interface PreflightResponse {
  status: PreflightStatus;
  entity: string;
  capability: string;
  message: string;
  canonicalOwner?: string;
  canonicalFile?: string;
  decisionId?: string;
  timestamp: string;
}

/**
 * Component and File Capability Registration Annotation.
 * Used by the Architecture AST Scanner to index capabilities.
 */
export function SmritiCapability(metadata: SmritiCapabilityMetadata) {
  return function <T extends { new (...args: any[]): any } | Function>(target: T): T {
    (target as any).__smriti_capability = metadata;
    return target;
  };
}

/**
 * Functional marker for React functional components or hooks.
 */
export function withCapability<T>(component: T, metadata: SmritiCapabilityMetadata): T {
  (component as any).__smriti_capability = metadata;
  return component;
}
