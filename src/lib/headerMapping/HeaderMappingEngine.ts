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

import {
  ConfidenceLevel,
  MappingContext,
  ColumnMappingResult,
  HeaderMappingEngineResult,
  SmritiFieldDefinition,
  SavedMappingProfile
} from "./types";
import { normalizeHeader, calculateSimilarity, calculateSemanticSimilarity } from "./HeaderNormalizer";
import { SMRITI_ITEM_MASTER_FIELDS, AMBIGUOUS_HEADER_RULES } from "./HeaderAliasRegistry";

const PROFILES_STORAGE_KEY = "smriti_header_mapping_profiles";

export class HeaderMappingEngine {
  private fields: SmritiFieldDefinition[];

  constructor(fields: SmritiFieldDefinition[] = SMRITI_ITEM_MASTER_FIELDS) {
    this.fields = fields;
  }

  /**
   * Main header mapping execution pipeline.
   */
  public mapHeaders(
    sourceHeaders: string[],
    context: MappingContext = 'ITEM_MASTER',
    activeProfile?: SavedMappingProfile
  ): HeaderMappingEngineResult {
    const results: ColumnMappingResult[] = [];
    const usedFieldKeys = new Set<string>();

    sourceHeaders.forEach((rawHeader, sourceIndex) => {
      const normalizedSource = normalizeHeader(rawHeader);

      // 1. Check active saved profile override first
      if (activeProfile && activeProfile.mappings[normalizedSource]) {
        const targetKey = activeProfile.mappings[normalizedSource];
        const field = this.fields.find(f => f.key === targetKey);
        if (field) {
          usedFieldKeys.add(field.key);
          results.push({
            sourceHeader: rawHeader,
            sourceIndex,
            mappedFieldKey: field.key,
            mappedFieldLabel: field.label,
            confidence: 'EXACT',
            confidenceScore: 100,
            isAmbiguous: false,
            isOverridden: true
          });
          return;
        }
      }

      // 2. Check for Ambiguous Headers
      const ambiguousRule = AMBIGUOUS_HEADER_RULES.find(r => r.normalizedTrigger === normalizedSource);
      if (ambiguousRule && ambiguousRule.candidateKeys.length > 1) {
        const candidates = ambiguousRule.candidateKeys.map(k => {
          const f = this.fields.find(field => field.key === k);
          return { key: k, label: f ? f.label : k, score: 80 };
        });

        results.push({
          sourceHeader: rawHeader,
          sourceIndex,
          mappedFieldKey: null,
          mappedFieldLabel: null,
          confidence: 'AMBIGUOUS',
          confidenceScore: 50,
          isAmbiguous: true,
          ambiguousCandidates: candidates
        });
        return;
      }

      // 3. Exact Field Key or Field Label Match
      const exactMatch = this.fields.find(f => 
        f.key.toLowerCase() === normalizedSource ||
        normalizeHeader(f.label) === normalizedSource
      );

      if (exactMatch && !usedFieldKeys.has(exactMatch.key)) {
        usedFieldKeys.add(exactMatch.key);
        results.push({
          sourceHeader: rawHeader,
          sourceIndex,
          mappedFieldKey: exactMatch.key,
          mappedFieldLabel: exactMatch.label,
          confidence: 'EXACT',
          confidenceScore: 100,
          isAmbiguous: false,
          additionalTargets: exactMatch.additionalTargets || []
        });
        return;
      }

      // 4. Known Alias Registry Match
      let aliasMatchField: SmritiFieldDefinition | null = null;
      for (const field of this.fields) {
        for (const alias of field.aliases) {
          const normalizedAlias = normalizeHeader(alias);
          if (normalizedSource === normalizedAlias) {
            aliasMatchField = field;
            break;
          }
        }
        if (aliasMatchField) break;
      }

      if (aliasMatchField && !usedFieldKeys.has(aliasMatchField.key)) {
        usedFieldKeys.add(aliasMatchField.key);
        results.push({
          sourceHeader: rawHeader,
          sourceIndex,
          mappedFieldKey: aliasMatchField.key,
          mappedFieldLabel: aliasMatchField.label,
          confidence: 'HIGH',
          confidenceScore: 90,
          isAmbiguous: false,
          additionalTargets: aliasMatchField.additionalTargets || []
        });
        return;
      }

      // 5. Semantic Fuzzy / Typo Matcher (Levenshtein + Token Overlap)
      let bestFuzzyField: SmritiFieldDefinition | null = null;
      let highestSimilarity = 0;

      for (const field of this.fields) {
        if (usedFieldKeys.has(field.key)) continue;

        const labelSim = calculateSemanticSimilarity(normalizedSource, field.label);
        if (labelSim > highestSimilarity) {
          highestSimilarity = labelSim;
          bestFuzzyField = field;
        }

        for (const alias of field.aliases) {
          const aliasSim = calculateSemanticSimilarity(normalizedSource, alias);
          if (aliasSim > highestSimilarity) {
            highestSimilarity = aliasSim;
            bestFuzzyField = field;
          }
        }
      }

      if (bestFuzzyField && highestSimilarity >= 60) {
        let confidence: ConfidenceLevel = 'LOW';
        if (highestSimilarity >= 90) {
          confidence = 'HIGH'; // Auto Map (Spec #4)
        } else if (highestSimilarity >= 80) {
          confidence = 'MEDIUM'; // Review Required (Spec #4)
        }

        usedFieldKeys.add(bestFuzzyField.key);
        results.push({
          sourceHeader: rawHeader,
          sourceIndex,
          mappedFieldKey: bestFuzzyField.key,
          mappedFieldLabel: bestFuzzyField.label,
          confidence,
          confidenceScore: highestSimilarity,
          isAmbiguous: false,
          additionalTargets: bestFuzzyField.additionalTargets || []
        });
        return;
      }

      // 6. Unmapped Fallback
      results.push({
        sourceHeader: rawHeader,
        sourceIndex,
        mappedFieldKey: null,
        mappedFieldLabel: null,
        confidence: 'UNMAPPED',
        confidenceScore: 0,
        isAmbiguous: false
      });
    });

    // Check missing required fields
    const missingRequiredFields = this.fields
      .filter(f => f.required && !usedFieldKeys.has(f.key))
      .map(f => ({ key: f.key, label: f.label }));

    const exactCount = results.filter(r => r.confidence === 'EXACT').length;
    const highCount = results.filter(r => r.confidence === 'HIGH').length;
    const mediumCount = results.filter(r => r.confidence === 'MEDIUM').length;
    const lowCount = results.filter(r => r.confidence === 'LOW').length;
    const ambiguousCount = results.filter(r => r.confidence === 'AMBIGUOUS').length;
    const unmappedCount = results.filter(r => r.confidence === 'UNMAPPED').length;

    const isValid = missingRequiredFields.length === 0 && ambiguousCount === 0;

    return {
      columns: results,
      exactCount,
      highCount,
      mediumCount,
      lowCount,
      ambiguousCount,
      unmappedCount,
      missingRequiredFields,
      isValid
    };
  }

  // Profile Persistence Methods
  private inMemoryProfiles: SavedMappingProfile[] = [];

  public getSavedProfiles(): SavedMappingProfile[] {
    try {
      if (typeof localStorage === "undefined") {
        return this.inMemoryProfiles;
      }
      const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.inMemoryProfiles;
    }
  }

  public saveProfile(name: string, columns: ColumnMappingResult[]): SavedMappingProfile {
    const profiles = this.getSavedProfiles();
    const mappings: Record<string, string> = {};

    columns.forEach(col => {
      if (col.mappedFieldKey) {
        mappings[normalizeHeader(col.sourceHeader)] = col.mappedFieldKey;
      }
    });

    const newProfile: SavedMappingProfile = {
      id: `profile_${Date.now()}`,
      name: name.trim() || `Profile ${profiles.length + 1}`,
      createdAt: new Date().toISOString(),
      mappings
    };

    profiles.push(newProfile);
    this.inMemoryProfiles = profiles;

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
      }
    } catch {}

    return newProfile;
  }

  public deleteProfile(id: string): void {
    const profiles = this.getSavedProfiles().filter(p => p.id !== id);
    this.inMemoryProfiles = profiles;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
      }
    } catch {}
  }
  
  public clearProfiles(): void {
    this.inMemoryProfiles = [];
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(PROFILES_STORAGE_KEY);
      }
    } catch {}
  }

  public isKnownHeader(rawHeader: string): boolean {
    if (!rawHeader) return false;
    const norm = normalizeHeader(rawHeader);
    if (!norm) return false;
    return this.fields.some(f => 
      f.key.toLowerCase() === norm ||
      normalizeHeader(f.key) === norm ||
      normalizeHeader(f.label) === norm ||
      (f.aliases || []).some(alias => normalizeHeader(alias) === norm)
    );
  }

  public detectHeaderRow(matrix: string[][]): { headerRowIndex: number; headers: string[]; sampleRows: string[][] } {
    let maxMatches = -1;
    let bestRowIdx = 0;

    const limit = Math.min(matrix.length, 10);
    for (let r = 0; r < limit; r++) {
      const row = matrix[r];
      if (!row || row.length < 2) continue;
      let matches = 0;
      row.forEach(cell => {
        if (cell && this.isKnownHeader(cell)) {
          matches++;
        }
      });

      if (matches > maxMatches) {
        maxMatches = matches;
        bestRowIdx = r;
      }
    }

    const finalHeaderIdx = maxMatches >= 1 ? bestRowIdx : 0;
    const headers = matrix[finalHeaderIdx] || [];
    const sampleRows = matrix.slice(finalHeaderIdx + 1, finalHeaderIdx + 4);

    return {
      headerRowIndex: finalHeaderIdx,
      headers,
      sampleRows
    };
  }
}

export const defaultHeaderMappingEngine = new HeaderMappingEngine();
