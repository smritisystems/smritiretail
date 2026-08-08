/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Enterprise Item Query & Range Filter Builder (ADR-IQB-001)
 * Standard     : UFR-001 / SCS-WIN-001 — Server-Side Query Builder Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.1.0 (High-Speed Indexed Query Execution)
 */

import { Product } from "../types.js";

export interface ItemRangeFilterCriteria {
  searchTerm?: string;
  stockNoFrom?: string;
  stockNoTo?: string;
  productFrom?: string;
  productTo?: string;
  brandFrom?: string;
  brandTo?: string;
  styleFrom?: string;
  styleTo?: string;
  shadeFrom?: string;
  shadeTo?: string;
  sizeFrom?: string;
  sizeTo?: string;
  mrpMin?: number;
  mrpMax?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedItemResult {
  items: Product[];
  totalMatching: number;
  limit: number;
  offset: number;
  executionTimeMs: number;
}

export class ItemQueryBuilder {
  /**
   * Build URL Query String parameters for FastAPI / Database REST endpoints
   */
  public static buildQueryParams(criteria: ItemRangeFilterCriteria): string {
    const params = new URLSearchParams();

    if (criteria.searchTerm?.trim()) params.set("search", criteria.searchTerm.trim());
    if (criteria.stockNoFrom?.trim()) params.set("stock_from", criteria.stockNoFrom.trim());
    if (criteria.stockNoTo?.trim()) params.set("stock_to", criteria.stockNoTo.trim());
    if (criteria.productFrom && criteria.productFrom !== "ALL") params.set("category_from", criteria.productFrom);
    if (criteria.productTo && criteria.productTo !== "ALL") params.set("category_to", criteria.productTo);
    if (criteria.brandFrom && criteria.brandFrom !== "ALL") params.set("brand_from", criteria.brandFrom);
    if (criteria.brandTo && criteria.brandTo !== "ALL") params.set("brand_to", criteria.brandTo);
    if (criteria.styleFrom && criteria.styleFrom !== "ALL") params.set("style_from", criteria.styleFrom);
    if (criteria.styleTo && criteria.styleTo !== "ALL") params.set("style_to", criteria.styleTo);
    if (criteria.shadeFrom && criteria.shadeFrom !== "ALL") params.set("shade_from", criteria.shadeFrom);
    if (criteria.shadeTo && criteria.shadeTo !== "ALL") params.set("shade_to", criteria.shadeTo);
    if (criteria.sizeFrom && criteria.sizeFrom !== "ALL") params.set("size_from", criteria.sizeFrom);
    if (criteria.sizeTo && criteria.sizeTo !== "ALL") params.set("size_to", criteria.sizeTo);
    if (criteria.mrpMin !== undefined) params.set("mrp_min", String(criteria.mrpMin));
    if (criteria.mrpMax !== undefined) params.set("mrp_max", String(criteria.mrpMax));

    params.set("limit", String(criteria.limit || 100));
    params.set("offset", String(criteria.offset || 0));

    return params.toString();
  }

  /**
   * High-Speed Range Filter Execution Engine with early-exit predicate optimization
   */
  public static executeQuery(sourceItems: Product[], criteria: ItemRangeFilterCriteria): PaginatedItemResult {
    const startTime = performance.now();

    // Pre-normalize filter criteria outside loop for O(1) loop checks
    const q = criteria.searchTerm?.trim().toLowerCase();
    const stockFromNum = criteria.stockNoFrom?.trim() ? parseInt(criteria.stockNoFrom.replace(/\D/g, ""), 10) || 0 : null;
    const stockToNum = criteria.stockNoTo?.trim() ? parseInt(criteria.stockNoTo.replace(/\D/g, ""), 10) || Number.MAX_SAFE_INTEGER : null;
    
    const catFromLower = criteria.productFrom && criteria.productFrom !== "ALL" ? criteria.productFrom.toLowerCase() : null;
    const catToLower = criteria.productTo && criteria.productTo !== "ALL" ? criteria.productTo.toLowerCase() : null;

    const brandFromLower = criteria.brandFrom && criteria.brandFrom !== "ALL" ? criteria.brandFrom.toLowerCase() : null;
    const brandToLower = criteria.brandTo && criteria.brandTo !== "ALL" ? criteria.brandTo.toLowerCase() : null;

    const styleFromLower = criteria.styleFrom && criteria.styleFrom !== "ALL" ? criteria.styleFrom.toLowerCase() : null;
    const styleToLower = criteria.styleTo && criteria.styleTo !== "ALL" ? criteria.styleTo.toLowerCase() : null;

    const shadeFromLower = criteria.shadeFrom && criteria.shadeFrom !== "ALL" ? criteria.shadeFrom.toLowerCase() : null;
    const shadeToLower = criteria.shadeTo && criteria.shadeTo !== "ALL" ? criteria.shadeTo.toLowerCase() : null;

    const sizeFromLower = criteria.sizeFrom && criteria.sizeFrom !== "ALL" ? criteria.sizeFrom.toLowerCase() : null;
    const sizeToLower = criteria.sizeTo && criteria.sizeTo !== "ALL" ? criteria.sizeTo.toLowerCase() : null;

    const filtered: Product[] = [];
    const len = sourceItems.length;

    for (let i = 0; i < len; i++) {
      const p = sourceItems[i];

      // 1. Stock No Range check (Numeric fast exit)
      if (stockFromNum !== null || stockToNum !== null) {
        const codeVal = p.code || p.id;
        const stockNum = parseInt(codeVal.replace(/\D/g, ""), 10) || 0;
        if (stockFromNum !== null && stockNum < stockFromNum) continue;
        if (stockToNum !== null && stockNum > stockToNum) continue;
      }

      // 2. MRP Price check
      const price = p.mrp || p.price || 0;
      if (criteria.mrpMin !== undefined && price < criteria.mrpMin) continue;
      if (criteria.mrpMax !== undefined && price > criteria.mrpMax) continue;

      // 3. Category Range check
      if (catFromLower || catToLower) {
        const catVal = (p.category || "").toLowerCase();
        if (catFromLower && catVal < catFromLower) continue;
        if (catToLower && catVal > catToLower) continue;
      }

      // 4. Brand Range check
      if (brandFromLower || brandToLower) {
        const brandVal = (p.brand || "").toLowerCase();
        if (brandFromLower && brandVal < brandFromLower) continue;
        if (brandToLower && brandVal > brandToLower) continue;
      }

      // 5. Style Range check
      if (styleFromLower || styleToLower) {
        const styleVal = (p.styleCode || (p as any).articleNo || p.code || "").toLowerCase();
        if (styleFromLower && styleVal < styleFromLower) continue;
        if (styleToLower && styleVal > styleToLower) continue;
      }

      // 6. Shade / Color Range check
      if (shadeFromLower || shadeToLower) {
        const colorVal = (p.color || "").toLowerCase();
        if (shadeFromLower && colorVal < shadeFromLower) continue;
        if (shadeToLower && colorVal > shadeToLower) continue;
      }

      // 7. Size Range check
      if (sizeFromLower || sizeToLower) {
        const sizeVal = (p.size || "").toLowerCase();
        if (sizeFromLower && sizeVal < sizeFromLower) continue;
        if (sizeToLower && sizeVal > sizeToLower) continue;
      }

      // 8. Search Term keyword match
      if (q) {
        const matches =
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          ((p as any).articleNo && (p as any).articleNo.toLowerCase().includes(q));

        if (!matches) continue;
      }

      filtered.push(p);
    }

    const limit = criteria.limit || 100;
    const offset = criteria.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      items: paginated,
      totalMatching: filtered.length,
      limit,
      offset,
      executionTimeMs: performance.now() - startTime,
    };
  }
}
