/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type ConfidenceLevel = 'EXACT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIGUOUS' | 'UNMAPPED';

export type MappingContext = 'ITEM_MASTER' | 'PURCHASE_ORDER' | 'GRN' | 'SALES_INVOICE';

export interface ConditionalTarget {
  target: string;
  targetLabel?: string;
  condition?: string;
  transform?: 'identity' | 'uppercase' | 'trim' | 'number';
}

export interface MappingTarget {
  target: string;
  targetLabel?: string;
  note?: string;
}

export const REUSE_WARNING_THRESHOLDS = {
  TIER_2_BADGE: 2,
  TIER_3_WARNING: 3,
  TIER_4_CONFIRM: 4,
} as const;

export interface SmritiFieldDefinition {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  description?: string;
  additionalTargets?: ConditionalTarget[];
}

export interface ColumnMappingResult {
  sourceHeader: string;
  sourceIndex: number;
  mappedFieldKey: string | null; // Primary target or targets[0]?.target for backward compatibility
  mappedFieldLabel: string | null;
  targets?: MappingTarget[];     // 1:many multi-target list
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0 to 100
  isAmbiguous: boolean;
  ambiguousCandidates?: { key: string; label: string; score: number }[];
  isOverridden?: boolean;
  additionalTargets?: ConditionalTarget[];
  reuseReason?: string;          // Optional reason note
}

export interface HeaderMappingEngineResult {
  columns: ColumnMappingResult[];
  exactCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  ambiguousCount: number;
  unmappedCount: number;
  missingRequiredFields: { key: string; label: string }[];
  isValid: boolean;
}

export interface SavedMappingProfile {
  id: string;
  name: string;
  createdAt: string;
  mappings: Record<string, string>; // Normalized Source Header -> Smriti Field Key
}

