/**
 * Project      : SMRITI Retail OS v7.0
 * Module       : Duplicate Detection Engine (Master Data Quality Guardrail)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import { Product } from "../types.js";

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  score: number; // 0 to 100
  product?: Product;
  reason?: string;
}

export interface BarcodeUniquenessResult {
  isUnique: boolean;
  conflict?: {
    product: Product;
    matchedBarcode: string;
    location: "Primary" | "Secondary" | "Barcode Map";
  };
}

/**
 * Normalizes text for comparison (lowercasing, trimming, removing non-alphanumeric chars)
 */
function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates similarity percentage between two strings (0-100)
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeString(s1);
  const norm2 = normalizeString(s2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    return Math.round((minLen / maxLen) * 95);
  }

  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.max(0, Math.round(similarity));
}

/**
 * Detects potential duplicate items by name/SKU similarity
 */
export function findPotentialDuplicates(
  name: string,
  products: Product[],
  currentId?: string,
  thresholdPercent = 75
): DuplicateCheckResult[] {
  if (!name || name.trim().length < 3) return [];

  const results: DuplicateCheckResult[] = [];

  for (const prod of products) {
    if (currentId && prod.id === currentId) continue;

    const similarity = calculateSimilarity(name, prod.name);
    if (similarity >= thresholdPercent) {
      results.push({
        hasDuplicate: true,
        score: similarity,
        product: prod,
        reason: `Similar title (${similarity}% match with "${prod.name}" [SKU: ${prod.sku || prod.code}])`,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Enforces strict barcode uniqueness across primary, secondary, and barcode mapping arrays
 */
export function validateBarcodeUniqueness(
  barcode: string,
  products: Product[],
  currentId?: string
): BarcodeUniquenessResult {
  if (!barcode || !barcode.trim()) {
    return { isUnique: true };
  }

  const cleanBarcode = barcode.trim().toLowerCase();

  for (const prod of products) {
    if (currentId && prod.id === currentId) continue;

    // Check primary barcode
    if (prod.barcode && prod.barcode.trim().toLowerCase() === cleanBarcode) {
      return {
        isUnique: false,
        conflict: {
          product: prod,
          matchedBarcode: prod.barcode,
          location: "Primary",
        },
      };
    }

    // Check secondary barcodes
    if (prod.secondaryBarcodes && Array.isArray(prod.secondaryBarcodes)) {
      if (prod.secondaryBarcodes.some((b) => b && b.trim().toLowerCase() === cleanBarcode)) {
        return {
          isUnique: false,
          conflict: {
            product: prod,
            matchedBarcode: barcode,
            location: "Secondary",
          },
        };
      }
    }

    // Check barcodes mapping object list
    if (prod.barcodes && Array.isArray(prod.barcodes)) {
      if (prod.barcodes.some((b) => b && b.value && b.value.trim().toLowerCase() === cleanBarcode)) {
        return {
          isUnique: false,
          conflict: {
            product: prod,
            matchedBarcode: barcode,
            location: "Barcode Map",
          },
        };
      }
    }
  }

  return { isUnique: true };
}
