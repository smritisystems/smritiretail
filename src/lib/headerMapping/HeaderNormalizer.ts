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
 */

/**
 * Normalizes a column header string for comparison.
 * - Trims leading/trailing whitespace
 * - Converts to lower case
 * - Replaces hyphens, underscores, and dots with spaces
 * - Removes non-alphanumeric characters except spaces
 * - Collapses multiple whitespace into a single space
 */
export function normalizeHeader(header: string): string {
  if (!header) return "";
  return header
    .trim()
    .toLowerCase()
    .replace(/[-_./\\]/g, " ")
    .replace(/[^a-z0-9\s%]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculates Levenshtein Distance similarity between two normalized strings (0.0 to 1.0)
 */
export function calculateSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  return Math.max(0, 1 - distance / maxLen);
}

export function calculateSimilarityScore(s1: string, s2: string): number {
  return Math.round(calculateSimilarity(s1, s2) * 100);
}

export function calculateTokenSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeHeader(s1);
  const norm2 = normalizeHeader(s2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;

  const tokens1 = norm1.split(" ").filter(Boolean);
  const tokens2 = norm2.split(" ").filter(Boolean);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  let matchedScoreSum = 0;
  tokens1.forEach(t1 => {
    let maxT2Score = 0;
    tokens2.forEach(t2 => {
      const score = Math.round(calculateSimilarity(t1, t2) * 100);
      if (score > maxT2Score) maxT2Score = score;
    });
    matchedScoreSum += maxT2Score;
  });

  const avgTokenScore = matchedScoreSum / tokens1.length;
  return Math.round(avgTokenScore);
}

export function calculateSemanticSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeHeader(s1);
  const norm2 = normalizeHeader(s2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;

  const levScore = calculateSimilarityScore(norm1, norm2);
  const tokenScore = calculateTokenSimilarity(norm1, norm2);
  return Math.max(levScore, tokenScore, Math.round(levScore * 0.4 + tokenScore * 0.6));
}
