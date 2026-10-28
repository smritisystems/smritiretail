/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.82.0
 * Created      : 2026-09-25
 * Modified     : 2026-10-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "PO_SIZEWISE_ENTRY")
 */

/**
 * PoSizewiseTab — Sizewise Purchase Order Entry UX
 *
 * A dedicated "Sizewise" layout for Purchase Order generation where every
 * line item captures size-wise order quantities (e.g. S / M / L / XL / XXL)
 * in a horizontally-spread matrix grid.
 *
 * Key features:
 *  • Configurable size columns (default: S, M, L, XL, XXL)
 *  • Per-row: Item Code, Product Description (Brand / Style / Shade),
 *    size-qty cells, Rate, Stock On Hand, Tax %, Net Value, Delivery Date, Actions
 *  • Footer totals row (per-size + grand total)
 *  • Bottom: Size-wise Summary panel + Item Summary panel + Remarks
 *  • PO header: Type, Prefix, Number, Date, Supplier, Delivery Date, Lead Time
 *  • Three sub-tabs: Items | Delivery & Tax | Other Details
 *  • Toolbar: Scan/F2 search, Add Item, Import from Excel, Copy Previous PO,
 *    Delete Row, Price List selector, Item Finder
 *  • Action footer: Cancel | Save Draft | Save & Confirm
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { PurchBrowseDlg } from "./PurchBrowseDlg.tsx";
import { POPrintPreviewModal, resolveFootwearAttributes } from "./POPrintPreviewModal.tsx";
import { useF2Screen, useF2Dispatcher } from "../../context/F2DispatcherContext.tsx";
import type { LookupResult } from "../../context/F2DispatcherContext.tsx";
import type { Product } from "../../types.ts";
import type {
  PurchaseOrderHeader,
  PurchaseOrderLineItem,
  PurchaseOrderSizePivotRow,
} from "./types.ts";
import { GlobalGridImportModal } from "../gridInput/GlobalGridImportModal.tsx";
import { GRID_PROFILES } from "../../services/gridInput/gridProfiles.ts";
import type { ParsedGridRow, GridImportMode } from "../../services/gridInput/types.ts";
import { SupplierSelect } from "../common/SupplierSelect.tsx";
import imageNotAvailablePlaceholder from "../../../myImages/image_not_available_placeholder.png";
import { CommercialDeliveryDrawer, CommercialDeliveryData, DEFAULT_BUSINESS_TERMS } from "./CommercialDeliveryDrawer.tsx";
import {
  buildArticleCatalogIndex,
  getAvailableArticles,
  getAvailableColorsForArticle,
  getAvailableSizesForArticleAndColor,
  getArticleSummaryFromIndex,
  resolveVariantFromIndex,
  resolveByBarcodeOrSkuFromIndex,
} from "./articleFiltering.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SIZEWISE_SIZES = ["S", "M", "L", "XL", "XXL"];

export const SIZE_SCALE_PRESETS: Record<string, { label: string; category: string; sizes: string[] }> = {
  APPAREL_ALPHA: {
    label: "Apparel (S - XXL)",
    category: "Apparel",
    sizes: ["S", "M", "L", "XL", "XXL"],
  },
  FOOTWEAR_EU: {
    label: "Footwear EU (36 - 44)",
    category: "Footwear",
    sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
  },
  FOOTWEAR_UK: {
    label: "Footwear UK (6 - 11)",
    category: "Footwear",
    sizes: ["6", "7", "8", "9", "10", "11"],
  },
};

/** Footwear statutory GST rate: 5% for purchase/sale rate <= 2500, 18% for > 2500 */
export const getFootwearGstRate = (rate: number): number => (rate <= 2500 ? 5 : 18);

const PRICE_LIST_OPTIONS = [
  "Default Purchase Price",
  "Last Purchase Price",
  "Standard Cost",
  "Weighted Average",
];
const UNITS_LIST = ["Pair", "Pcs", "Box", "Set", "Mtr", "Kg", "Dzn"];
const LEAD_TIME_OPTIONS = [3, 7, 10, 15, 30];
// Phase 1: blank rows removed — grid starts empty; empty state shown instead

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SizewisePOHeader {
  documentType: string;
  prefix: string;
  orderNumber: string;
  orderDate: string;
  supplierId: string;
  supplierName: string;
  deliveryDate: string;
  leadTimeDays: number;
  // Delivery & Tax
  deliveryLocation: string;
  warehouseId?: string;
  commonTaxPercent: number;
  freightAmount: number;
  otherCharges: number;
  // Other Details
  paymentTerms: string;
  freightCharges: string;
  deliveryTerms?: string;
  currency: string;
  buyer: string;
  department: string;
  supplierReference: string;
  specialInstructions: string;
  remarks: string;
  internalNotes: string;
  priceList: string;
  businessTerms?: string;
}

export interface SizewisePOLine {
  id: string;
  sNo: number;
  itemCode: string;
  articleNo?: string;
  barcode?: string;
  product: string;
  brand: string;
  style: string;
  shade: string;
  unit: string;
  sizeQuantities: Record<string, number>; // e.g. { S: 20, M: 30, L: 30, XL: 20, XXL: 0 }
  totalQty: number;
  rate: number;
  stockOnHand: number;
  taxPercent: number;
  netValue: number; // totalQty * rate
  deliveryDate: string;
  originalProduct?: Product;
  imageUrl?: string;
  heelType?: string;
  upperMaterial?: string;
  outsoleMaterial?: string;
}

/**
 * Grouped presentation model representing a single aggregated row per unique
 * Article No. + Color/Shade combination for live Purchase Studio grids.
 */
export interface GroupedSizewiseDisplayRow {
  id?: string;
  groupKey: string;
  sNo: number;
  articleNo: string;
  style: string;
  shade: string;
  itemCode: string;
  barcode?: string;
  product: string;
  brand: string;
  unit: string;
  rate: number;
  taxPercent: number;
  deliveryDate: string;
  stockOnHand: number;
  imageUrl?: string;
  originalProduct?: Product;
  sizeQuantities: Record<string, number>;
  totalQty: number;
  netValue: number;
  sizeToLineIndex: Record<string, number>;
  memberLineIndices: number[];
  primaryLineIndex: number;
  heelType?: string;
  upperMaterial?: string;
  outsoleMaterial?: string;
}

/**
 * Pure function: Groups canonical SizewisePOLine items by Article + Color
 * while strictly preserving underlying variant records and mapping size cells
 * back to their origin lines.
 */
export function buildGroupedSizewiseLines(
  lines: SizewisePOLine[] = [],
  sizes: string[] = [],
  defaultTaxPercent: number = 18
): GroupedSizewiseDisplayRow[] {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const groupMap = new Map<string, GroupedSizewiseDisplayRow>();

  lines.forEach((line, idx) => {
    const art = (line.articleNo || line.style || "").trim() || (line.itemCode || "").trim();
    const col = (line.shade || "").trim();

    // Blank or unconfigured rows keep their individual identity so they remain individually editable
    const isBlank = !art && !col && !line.itemCode?.trim() && (!line.totalQty || line.totalQty === 0);
    const groupKey = isBlank ? `__blank_${line.id || idx}` : `${art.toUpperCase()}:::${col.toUpperCase()}`;

    const fwAttrs = resolveFootwearAttributes(line);
    const resolvedHeel = line.heelType || (fwAttrs.heels !== "—" ? fwAttrs.heels : undefined);
    const resolvedUpper = line.upperMaterial || (fwAttrs.upperMaterial !== "—" ? fwAttrs.upperMaterial : undefined);
    const resolvedOutsole = line.outsoleMaterial || (fwAttrs.outsole !== "—" ? fwAttrs.outsole : undefined);

    if (!groupMap.has(groupKey)) {
      const initialSizeQtys: Record<string, number> = {};
      const sizeToLineIndex: Record<string, number> = {};
      sizes.forEach(sz => {
        const q = Number(line.sizeQuantities?.[sz]) || 0;
        initialSizeQtys[sz] = q;
        sizeToLineIndex[sz] = idx;
      });

      groupMap.set(groupKey, {
        id: line.id || groupKey,
        groupKey,
        sNo: groupMap.size + 1,
        articleNo: art || line.articleNo || line.itemCode || "",
        style: art || line.style || line.articleNo || line.itemCode || "",
        shade: col || line.shade || "",
        itemCode: line.itemCode || "",
        barcode: line.barcode || "",
        product: line.product || "",
        brand: line.brand || "",
        unit: line.unit || "Pair",
        rate: line.rate || 0,
        taxPercent: line.taxPercent !== undefined ? line.taxPercent : defaultTaxPercent,
        deliveryDate: line.deliveryDate || "",
        stockOnHand: Number(line.stockOnHand || 0),
        imageUrl: line.imageUrl || "",
        originalProduct: line.originalProduct,
        heelType: resolvedHeel,
        upperMaterial: resolvedUpper,
        outsoleMaterial: resolvedOutsole,
        sizeQuantities: initialSizeQtys,
        totalQty: 0,
        netValue: 0,
        sizeToLineIndex,
        memberLineIndices: [idx],
        primaryLineIndex: idx,
      });
    } else {
      const existing = groupMap.get(groupKey)!;
      existing.memberLineIndices.push(idx);

      sizes.forEach(sz => {
        const q = Number(line.sizeQuantities?.[sz]) || 0;
        if (q > 0) {
          existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + q;
          existing.sizeToLineIndex[sz] = idx;
        } else if (existing.sizeToLineIndex[sz] === undefined) {
          existing.sizeToLineIndex[sz] = idx;
        }
      });

      existing.stockOnHand = Math.max(existing.stockOnHand, Number(line.stockOnHand || 0));
      if (!existing.imageUrl && line.imageUrl) existing.imageUrl = line.imageUrl;
      if (!existing.brand && line.brand) existing.brand = line.brand;
      if (!existing.unit && line.unit) existing.unit = line.unit;
      if ((!existing.rate || existing.rate === 0) && line.rate) existing.rate = line.rate;
      if (!existing.barcode && line.barcode) existing.barcode = line.barcode;
      if (!existing.product && line.product) existing.product = line.product;
      if (!existing.originalProduct && line.originalProduct) existing.originalProduct = line.originalProduct;
      if (!existing.heelType && resolvedHeel) existing.heelType = resolvedHeel;
      if (!existing.upperMaterial && resolvedUpper) existing.upperMaterial = resolvedUpper;
      if (!existing.outsoleMaterial && resolvedOutsole) existing.outsoleMaterial = resolvedOutsole;
    }
  });

  const result = Array.from(groupMap.values());
  result.forEach((group, idx) => {
    group.sNo = idx + 1;
    const tQty = sizes.reduce((sum, sz) => sum + (group.sizeQuantities[sz] || 0), 0);
    group.totalQty = tQty;
    group.netValue = tQty * (group.rate || 0);
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const addDaysToDate = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildBlankLine = (
  idx: number,
  sizes: string[],
  deliveryDate: string,
  taxPercent: number,
  imageUrl?: string
): SizewisePOLine => ({
  id: `sw-line-${idx + 1}`,
  sNo: idx + 1,
  itemCode: "",
  articleNo: "",
  barcode: "",
  product: "",
  brand: "",
  style: "",
  shade: "",
  unit: "Pcs",
  sizeQuantities: sizes.reduce<Record<string, number>>((acc, sz) => { acc[sz] = 0; return acc; }, {}),
  totalQty: 0,
  rate: 0,
  stockOnHand: 0,
  taxPercent,
  netValue: 0,
  deliveryDate,
  imageUrl: imageUrl || "",
});

export const SHADE_COLOR_MAP: Record<string, string> = {
  tan: "#78350f",
  brown: "#451a03",
  black: "#1c1917",
  camel: "#d97706",
  navy: "#1e3a8a",
  blue: "#2563eb",
  olive: "#3f6212",
  green: "#15803d",
  "l-green": "#86efac",
  "l-blue": "#93c5fd",
  cream: "#fef3c7",
  cherry: "#881337",
  burgundy: "#701a75",
  maroon: "#831843",
  red: "#dc2626",
  white: "#f8fafc",
  grey: "#64748b",
  gray: "#64748b",
  charcoal: "#334155",
  beige: "#d4d4d8",
  khaki: "#a1a1aa",
  yellow: "#eab308",
  mustard: "#ca8a04",
  orange: "#ea580c",
  pink: "#ec4899",
  gold: "#eab308",
  silver: "#94a3b8",
};

export const COLOR_SWATCHES = [
  { name: "Cream", hex: "#fef3c7" },
  { name: "Tan", hex: "#78350f" },
  { name: "Brown", hex: "#451a03" },
  { name: "Black", hex: "#1c1917" },
  { name: "Camel", hex: "#d97706" },
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Olive", hex: "#3f6212" },
  { name: "Cherry", hex: "#881337" },
  { name: "White", hex: "#f1f5f9" },
];

export const COMMON_RETAIL_COLORS = [
  "BLACK",
  "CREAM",
  "WHITE",
  "BROWN",
  "TAN",
  "BEIGE",
  "NAVY",
  "BLUE",
  "RED",
  "MAROON",
  "GREEN",
  "OLIVE",
  "L-GREEN",
  "L-BLUE",
  "GREY",
  "GRAY",
  "YELLOW",
  "ORANGE",
  "PINK",
  "PURPLE",
  "GOLD",
  "SILVER",
  "CAMEL",
  "KHAKI",
  "CHARCOAL",
  "MULTI",
];

export function extractArticleAndColor(
  code: string = "",
  name: string = "",
  explicitStyle?: string,
  explicitColor?: string
): { article: string; color: string } {
  let article = (explicitStyle || "").trim();
  let color = (explicitColor || "").trim();

  if (article && color) {
    return { article, color };
  }

  const cleanCode = code.trim();
  if (cleanCode) {
    const upperCode = cleanCode.toUpperCase();
    for (const c of COMMON_RETAIL_COLORS) {
      const escapedC = c.replace("-", "\\-");
      const regex = new RegExp(`^(.*?)-(${escapedC})(?:-([A-Za-z0-9]+))?$`, "i");
      const match = upperCode.match(regex);
      if (match) {
        if (!article) article = match[1];
        if (!color) color = match[2];
        return { article, color };
      }
    }

    const parts = cleanCode.split("-");
    if (parts.length >= 3) {
      const last = parts[parts.length - 1];
      const secondLast = parts[parts.length - 2];
      if (/^(\d{1,3}|[X|S|M|L]+)$/i.test(last)) {
        if (!color) color = secondLast;
        if (!article) article = parts.slice(0, parts.length - 2).join("-");
        return { article, color };
      }
    }
  }

  if (!color && name) {
    const upperName = name.toUpperCase();
    for (const c of COMMON_RETAIL_COLORS) {
      if (upperName.includes(c)) {
        color = c;
        break;
      }
    }
  }

  if (!article) {
    const strippedCode = cleanCode.replace(/-([A-Za-z0-9]+)$/, "");
    article = strippedCode || cleanCode || (name ? name.split(",")[0].trim() : "Article");
  }

  return { article, color: color || "Standard" };
}

export function getShadeHex(shade?: string): string {
  if (!shade) return "#94a3b8";
  const lower = shade.trim().toLowerCase();
  for (const [key, hex] of Object.entries(SHADE_COLOR_MAP)) {
    if (lower.includes(key)) return hex;
  }
  return "#94a3b8";
}

/**
 * resolveLineImage — Resolves the product image URL according to footwear hierarchy:
 * 1. Line-level explicit imageUrl
 * 2. Article + Color composite key (`${articleNo}::${color.toLowerCase()}`)
 * 3. Article-level fallback (`articleNo`)
 * 4. ItemCode-level fallback (`itemCode`)
 */
export function resolveLineImage(
  line: {
    imageUrl?: string;
    articleNo?: string;
    shade?: string;
    itemCode?: string;
    [key: string]: any;
  },
  articleImageMap: Record<string, string>
): string {
  if (line.imageUrl) return line.imageUrl;
  const article = (line.articleNo || "").trim();
  const shade = (line.shade || "").trim().toLowerCase();
  if (article && shade && articleImageMap[`${article}::${shade}`]) {
    return articleImageMap[`${article}::${shade}`];
  }
  if (article && articleImageMap[article]) {
    return articleImageMap[article];
  }
  if (line.itemCode && articleImageMap[line.itemCode]) {
    return articleImageMap[line.itemCode];
  }
  return "";
}

export interface FilenameMatchResult {
  lineIndex: number;
  articleNo: string;
  shade: string;
  confidence: "exact_composite" | "article_only" | "color_only" | "none";
}

export interface BatchUploadItem {
  id: string;
  file: File;
  previewUrl: string;
  lineIndex: number;
  articleNo: string;
  shade: string;
  confidence: "exact_composite" | "article_only" | "color_only" | "none";
  status: "ready" | "optimizing" | "uploaded" | "failed";
  serverUrl?: string;
  error?: string;
}

export interface BatchUploadState {
  isOpen: boolean;
  isDragging: boolean;
  items: BatchUploadItem[];
  isProcessing: boolean;
  progressPercent: number;
}

/**
 * Normalizes a string for heuristic comparison by stripping punctuation, extra spaces,
 * and converting to lower case.
 */
export function normalizeFilenameSegment(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * matchImageFilenameToLines — Pure heuristic matching engine for wholesale retail sample photos.
 * Analyzes raw image filenames against PO line items to detect Article Number and Shade / Colorway.
 *
 * Matching Strategy:
 * 1. Exact Composite: Filename contains both articleNo/itemCode AND shade (e.g. "FW-NK-9921_Tan.jpg")
 * 2. Article-Only: Filename matches articleNo or itemCode (e.g. "OXF-990.png" or "FW-OXFORD-01.jpg")
 * 3. Color-Only: Filename contains unique shade in lines (e.g. "Cherry Red Sample.png")
 * 4. Fallback: Confidence "none" with default to first valid line (index 0)
 */
export function matchImageFilenameToLines(
  filename: string,
  lines: Array<{ articleNo?: string; itemCode?: string; shade?: string }>
): FilenameMatchResult {
  if (!lines || lines.length === 0) {
    return {
      lineIndex: -1,
      articleNo: "",
      shade: "",
      confidence: "none",
    };
  }

  // Strip extension
  const baseName = filename.replace(/\.[^/.]+$/, "");
  const normalizedFile = normalizeFilenameSegment(baseName);
  const rawLower = baseName.toLowerCase();

  // Pass 1: Exact Composite Match (Article/ItemCode + Shade)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const art = (l.articleNo || "").trim();
    const code = (l.itemCode || "").trim();
    const shd = (l.shade || "").trim();
    if ((!art && !code) || !shd) continue;

    const normArt = art ? normalizeFilenameSegment(art) : "";
    const normCode = code ? normalizeFilenameSegment(code) : "";
    const normShd = normalizeFilenameSegment(shd);

    const artMatch = (normArt && (normalizedFile.includes(normArt) || rawLower.includes(art.toLowerCase()))) ||
                     (normCode && (normalizedFile.includes(normCode) || rawLower.includes(code.toLowerCase())));
    const shdMatch = normShd && (normalizedFile.includes(normShd) || rawLower.includes(shd.toLowerCase()));

    if (artMatch && shdMatch) {
      return {
        lineIndex: i,
        articleNo: l.articleNo || l.itemCode || "",
        shade: l.shade || "",
        confidence: "exact_composite",
      };
    }
  }

  // Pass 2: Article-Only / ItemCode-Only Match
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const art = (l.articleNo || "").trim();
    const code = (l.itemCode || "").trim();
    if ((!art || art.length < 2) && (!code || code.length < 2)) continue;

    const normArt = art.length >= 2 ? normalizeFilenameSegment(art) : "";
    const normCode = code.length >= 2 ? normalizeFilenameSegment(code) : "";
    const artMatch = (normArt && (normalizedFile.includes(normArt) || rawLower.includes(art.toLowerCase()))) ||
                     (normCode && (normalizedFile.includes(normCode) || rawLower.includes(code.toLowerCase())));

    if (artMatch) {
      return {
        lineIndex: i,
        articleNo: l.articleNo || l.itemCode || "",
        shade: l.shade || "",
        confidence: "article_only",
      };
    }
  }

  // Pass 3: Color-Only Match (if shade is non-trivial and unique or prominent)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const shd = (l.shade || "").trim();
    if (!shd || shd.length < 3) continue;

    const normShd = normalizeFilenameSegment(shd);
    const shdMatch = normShd && (normalizedFile.includes(normShd) || rawLower.includes(shd.toLowerCase()));

    if (shdMatch) {
      return {
        lineIndex: i,
        articleNo: l.articleNo || l.itemCode || "",
        shade: l.shade || "",
        confidence: "color_only",
      };
    }
  }

  // Fallback: None
  const defaultIdx = Math.max(0, lines.findIndex(l => Boolean(l.articleNo || l.itemCode)));
  const targetLine = lines[defaultIdx] || lines[0];

  return {
    lineIndex: defaultIdx >= 0 ? defaultIdx : 0,
    articleNo: targetLine?.articleNo || targetLine?.itemCode || "",
    shade: targetLine?.shade || "",
    confidence: "none",
  };
}

/**
 * recommendSizeAssortment — Pure mathematical helper for retail size ratio curves.
 * Guarantees integer distribution where sum(result.values()) === totalTargetQty.
 * Supports:
 *  - "bell": Standard Gaussian / normal distribution centered at mid sizes
 *  - "core": Heavy emphasis on central core sizes (40%-60% of size run)
 *  - "uniform": Even distribution across all sizes
 */
export function recommendSizeAssortment(
  sizes: string[],
  totalTargetQty: number,
  curveType: "bell" | "core" | "uniform" = "bell"
): Record<string, number> {
  const safeSizes = Array.isArray(sizes) ? sizes : [];
  if (safeSizes.length === 0 || !Number.isFinite(totalTargetQty) || totalTargetQty <= 0) {
    return safeSizes.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
  }

  const n = safeSizes.length;
  let rawWeights: number[] = [];

  if (curveType === "uniform") {
    rawWeights = safeSizes.map(() => 1);
  } else if (curveType === "core") {
    const midStart = Math.floor(n * 0.25);
    const midEnd = Math.ceil(n * 0.75);
    rawWeights = safeSizes.map((_, i) => (i >= midStart && i < midEnd ? 3 : 1));
  } else {
    // Default: Bell curve (Gaussian)
    const mean = (n - 1) / 2;
    const sigma = Math.max(0.8, (n - 1) / 3.5);
    rawWeights = safeSizes.map((_, i) => {
      const diff = i - mean;
      return Math.exp(-(diff * diff) / (2 * sigma * sigma));
    });
  }

  const weightSum = rawWeights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) {
    return safeSizes.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
  }

  const roundedTarget = Math.round(totalTargetQty);
  const fractions: { index: number; remainder: number }[] = [];
  let allocatedSum = 0;
  const allocations: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const exact = (rawWeights[i] / weightSum) * roundedTarget;
    const floorVal = Math.floor(exact);
    allocations[i] = floorVal;
    allocatedSum += floorVal;
    fractions.push({ index: i, remainder: exact - floorVal });
  }

  let remainder = roundedTarget - allocatedSum;
  fractions.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remainder; i++) {
    allocations[fractions[i % n].index] += 1;
  }

  const result: Record<string, number> = {};
  safeSizes.forEach((s, i) => {
    result[s] = allocations[i];
  });
  return result;
}

/**
 * getSimplifiedRatioString — Computes a human-readable retail ratio curve string (e.g. "2 : 2 : 3 : 4 : 5 : 4 : 3 : 2 : 2")
 * from discrete per-size quantity totals.
 */
export function getSimplifiedRatioString(sizes: string[], perSizeTotals: Record<string, number>): string {
  const safeSizes = Array.isArray(sizes) ? sizes : [];
  if (safeSizes.length === 0) return "—";
  const qtys = safeSizes.map(sz => perSizeTotals[sz] || 0);
  const total = qtys.reduce((a, b) => a + b, 0);
  if (total === 0) return "—";

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const nonZeros = qtys.filter(q => q > 0);
  if (nonZeros.length === 0) return "—";

  const overallGcd = nonZeros.reduce((acc, val) => gcd(acc, val), nonZeros[0]);
  if (overallGcd > 1) {
    return qtys.map(q => Math.round(q / overallGcd)).join(" : ");
  }

  const minPos = Math.min(...nonZeros);
  if (minPos > 1 && total > 24) {
    const approx = qtys.map(q => q === 0 ? 0 : Math.max(1, Math.round(q / minPos)));
    return approx.join(" : ");
  }

  return qtys.join(" : ");
}

export interface SizewiseSummaryTotals {
  perSizeTotals: Record<string, number>;
  grandTotalQty: number;
  grossValue: number;
  totalTax: number;
  netOrderValue: number;
  totalItems: number;
  sizePercents: Record<string, string>;
}

export function calculateSizewiseSummaryTotals(
  lines: SizewisePOLine[] = [],
  sizes: string[] = [],
  freightAmount: number = 0,
  otherCharges: number = 0
): SizewiseSummaryTotals {
  const safeLines = Array.isArray(lines) ? lines : [];
  const safeSizes = Array.isArray(sizes) ? sizes : [];
  const safeFreight = Number.isFinite(freightAmount) ? Math.max(0, freightAmount) : 0;
  const safeOther = Number.isFinite(otherCharges) ? Math.max(0, otherCharges) : 0;

  const activeLines = safeLines.filter(
    l => Boolean(l && l.itemCode && Number.isFinite(l.totalQty) && l.totalQty > 0)
  );

  const perSizeTotals = safeSizes.reduce<Record<string, number>>((acc, sz) => {
    acc[sz] = activeLines.reduce((s, l) => {
      const q = l.sizeQuantities?.[sz];
      return s + (Number.isFinite(q) ? Math.max(0, q) : 0);
    }, 0);
    return acc;
  }, {});

  const grandTotalQty = activeLines.reduce((s, l) => s + (Number.isFinite(l.totalQty) ? l.totalQty : 0), 0);
  const grossValue = activeLines.reduce((s, l) => s + (Number.isFinite(l.netValue) ? l.netValue : 0), 0);
  const totalTax = activeLines.reduce((s, l) => {
    const nv = Number.isFinite(l.netValue) ? l.netValue : 0;
    const tp = Number.isFinite(l.taxPercent) ? l.taxPercent : 0;
    return s + (nv * tp) / 100;
  }, 0);

  const rawNet = grossValue + totalTax + safeFreight + safeOther;
  const netOrderValue = Number.isFinite(rawNet) ? rawNet : 0;
  const totalItems = activeLines.length;

  const sizePercents = safeSizes.reduce<Record<string, string>>((acc, sz) => {
    const qty = perSizeTotals[sz] || 0;
    acc[sz] =
      grandTotalQty > 0 && Number.isFinite(qty)
        ? ((qty / grandTotalQty) * 100).toFixed(2) + "%"
        : "0.00%";
    return acc;
  }, {});

  return {
    perSizeTotals,
    grandTotalQty,
    grossValue,
    totalTax,
    netOrderValue,
    totalItems,
    sizePercents,
  };
}

/**
 * mapParsedGridRowsToSizewiseLines — Maps parsed grid rows (from Excel clipboard, CSV, PDT)
 * into authoritative SizewisePOLine items.
 *
 * If explicit size columns (e.g. "6", "7", "S", "M") exist in rawValues, their values are preserved.
 * Otherwise, the total quantity is distributed across sizes using the retail Gaussian bell curve.
 */
export function mapParsedGridRowsToSizewiseLines(
  rows: ParsedGridRow[],
  sizes: string[],
  defaultDeliveryDate: string,
  commonTaxPercent: number,
  startIndex: number = 0
): SizewisePOLine[] {
  return rows.map((r, i) => {
    const resolved = r.resolvedProduct;
    const itemCode =
      resolved?.sku ||
      (resolved as any)?.model_code ||
      resolved?.itemId ||
      r.mappedValues?.itemCode ||
      r.mappedValues?.productId ||
      (r.identifierType !== "BARCODE" ? r.identifier : "") ||
      (r as any).productId ||
      (r as any).barcode ||
      r.identifier ||
      `ITEM-${startIndex + i + 1}`;
    const barcode =
      (r as any).barcode ||
      (r.identifierType === "BARCODE" ? r.identifier : "") ||
      resolved?.barcode ||
      "";
    const product =
      resolved?.name ||
      r.mappedValues?.productName ||
      r.mappedValues?.product ||
      (r as any).productName ||
      "Imported Article";
    const brand = (resolved as any)?.brand || r.mappedValues?.brand || "";
    const style = (resolved as any)?.style || r.mappedValues?.style || "";
    const shade = (resolved as any)?.shade || (resolved as any)?.color || r.mappedValues?.shade || "";
    const rate = Number(
      (r as any).unitCost ||
        r.costPrice ||
        r.rate ||
        r.mappedValues?.costPrice ||
        r.mappedValues?.rate ||
        (resolved as any)?.costPrice ||
        (resolved as any)?.purchase_price ||
        0
    );

    // Check if rawValues or mappedValues contain explicit size column definitions
    let hasExplicitSizes = false;
    const explicitQtys: Record<string, number> = {};
    for (const sz of sizes) {
      const rawVal =
        r.rawValues?.[sz] ??
        r.rawValues?.[sz.toLowerCase()] ??
        r.rawValues?.[sz.toUpperCase()];
      if (rawVal !== undefined && rawVal !== "") {
        const parsed = parseInt(String(rawVal).trim(), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          explicitQtys[sz] = parsed;
          hasExplicitSizes = true;
        }
      }
    }

    let finalSizeQtys: Record<string, number>;
    let totalQty: number;

    if (hasExplicitSizes) {
      finalSizeQtys = sizes.reduce<Record<string, number>>((acc, sz) => {
        acc[sz] = explicitQtys[sz] || 0;
        return acc;
      }, {});
      const explicitSum = sizes.reduce((sum, sz) => sum + (finalSizeQtys[sz] || 0), 0);
      totalQty = explicitSum > 0 ? explicitSum : (r.quantity && r.quantity > 0 ? r.quantity : 1);
      if (explicitSum === 0) {
        finalSizeQtys = recommendSizeAssortment(sizes, totalQty, "bell");
      }
    } else {
      totalQty = r.quantity && r.quantity > 0 ? r.quantity : 1;
      finalSizeQtys = recommendSizeAssortment(sizes, totalQty, "bell");
    }

    return {
      id: `sw-imp-${Date.now()}-${startIndex + i + 1}`,
      sNo: startIndex + i + 1,
      itemCode,
      barcode,
      product,
      brand,
      style,
      shade,
      unit: r.uom || (resolved as any)?.uom || "Pcs",
      sizeQuantities: finalSizeQtys,
      totalQty,
      rate,
      stockOnHand: 0,
      taxPercent: r.taxRate || commonTaxPercent,
      netValue: Number((totalQty * rate).toFixed(2)),
      deliveryDate: defaultDeliveryDate,
    };
  });
}

/**
 * mergeSizewisePOLines — Combines existing SizewisePOLine rows with newly imported rows
 * according to GridImportMode (APPEND, MERGE, REPLACE).
 */
export function mergeSizewisePOLines(
  existing: SizewisePOLine[],
  incoming: SizewisePOLine[],
  mode: GridImportMode,
  sizes: string[]
): SizewisePOLine[] {
  if (mode === "REPLACE") {
    return incoming.map((l, i) => ({ ...l, sNo: i + 1 }));
  }

  const filledExisting = existing.filter((l) => l.itemCode);

  if (mode === "MERGE") {
    const copy = [...filledExisting];
    for (const inc of incoming) {
      const matchIndex = copy.findIndex(
        (c) =>
          (inc.barcode && c.barcode && c.barcode === inc.barcode) ||
          (inc.itemCode && c.itemCode === inc.itemCode)
      );
      if (matchIndex >= 0) {
        const target = copy[matchIndex];
        const newSizeQtys: Record<string, number> = {};
        for (const sz of sizes) {
          newSizeQtys[sz] = (target.sizeQuantities[sz] || 0) + (inc.sizeQuantities[sz] || 0);
        }
        const newTotalQty = sizes.reduce((sum, sz) => sum + (newSizeQtys[sz] || 0), 0);
        const effectiveRate = inc.rate > 0 ? inc.rate : target.rate;
        copy[matchIndex] = {
          ...target,
          sizeQuantities: newSizeQtys,
          totalQty: newTotalQty,
          rate: effectiveRate,
          netValue: Number((newTotalQty * effectiveRate).toFixed(2)),
        };
      } else {
        copy.push(inc);
      }
    }
    return copy.map((l, i) => ({ ...l, sNo: i + 1 }));
  }

  // mode === "APPEND"
  return [...filledExisting, ...incoming].map((l, i) => ({ ...l, sNo: i + 1 }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PoSizewiseTabProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNotification?: (
    title: string,
    message: string,
    type?: "success" | "error" | "info" | "warning"
  ) => void;
  onClose?: () => void;
  onNavigateTab?: (tab: string) => void;
  /** Optional: list of size column labels (default: S, M, L, XL, XXL) */
  sizes?: string[];
  orderToEdit?: string | null;
  onClearOrderToEdit?: () => void;
  initialLines?: SizewisePOLine[];
  initialHeader?: SizewisePOHeader;
  onLinesChange?: (lines: SizewisePOLine[]) => void;
  onHeaderChange?: (header: SizewisePOHeader) => void;
  onSizesChange?: (sizes: string[]) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// PoSizewiseTab
// ─────────────────────────────────────────────────────────────────────────────

export const PoSizewiseTab: React.FC<PoSizewiseTabProps> = ({
  products: initialProducts = [],
  currentUser,
  onNotification,
  onClose,
  onNavigateTab,
  sizes: propSizes,
  orderToEdit,
  onClearOrderToEdit,
  initialLines,
  initialHeader,
  onLinesChange,
  onHeaderChange,
  onSizesChange,
}) => {
  const today = new Date().toISOString().split("T")[0];
  const defaultDelivery = addDaysToDate(today, 7);

  // Detect initial scale
  const detectInitialScale = (): string => {
    if (propSizes && propSizes.length > 0) {
      if (propSizes.some(s => ["36", "37", "38", "39", "40", "41", "42", "43", "44"].includes(s))) {
        return "FOOTWEAR_EU";
      }
      if (propSizes.some(s => ["6", "7", "8", "9", "10", "11"].includes(s))) {
        return "FOOTWEAR_UK";
      }
    }
    if (initialLines && initialLines.length > 0) {
      const allKeys = initialLines.flatMap(l => Object.keys(l.sizeQuantities || {}));
      if (allKeys.some(s => ["36", "37", "38", "39", "40", "41", "42", "43", "44"].includes(s))) {
        return "FOOTWEAR_EU";
      }
      if (allKeys.some(s => ["6", "7", "8", "9", "10", "11"].includes(s))) {
        return "FOOTWEAR_UK";
      }
    }
    return "APPAREL_ALPHA";
  };

  const [selectedScaleKey, setSelectedScaleKey] = useState<string>(detectInitialScale);
  const [sizes, setSizes] = useState<string[]>(() => {
    if (propSizes && propSizes.length > 0) return propSizes;
    const detected = detectInitialScale();
    return SIZE_SCALE_PRESETS[detected]?.sizes || DEFAULT_SIZEWISE_SIZES;
  });

  // ── State ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"items" | "visual" | "delivery" | "other">("items");
  // Grid Display Mode: Article & Color (Default / Recommended for fashion/footwear) vs Code & Desc
  const [gridDisplayMode, setGridDisplayMode] = useState<"article_color" | "item_code_desc">("article_color");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const articleCatalogIndex = useMemo(() => buildArticleCatalogIndex(products), [products]);
  const [suppliersList, setSuppliersList] = useState<
    { id: string; name: string; code?: string; gstin?: string; gst_number?: string; address?: string; mobile?: string; phone?: string; email?: string; city?: string; state?: string; pincode?: string; payment_terms?: string; payment_terms_days?: number; freight_terms?: string; currency?: string; buyer?: string; department?: string; special_instructions?: string; business_terms?: string; commercial_terms?: any }[]
  >([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [availableWarehouses, setAvailableWarehouses] = useState<Array<{ id: string; code: string; name: string; is_central_godown?: boolean }>>([]);
  const [saving, setSaving] = useState(false);
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [toolbarSearch, setToolbarSearch] = useState("");
  const [savedOrderNo, setSavedOrderNo] = useState<string | null>(null);
  const [duplicateOrderNo, setDuplicateOrderNo] = useState<string | null>(null);
  const [suggestedOrderNo, setSuggestedOrderNo] = useState<string | null>(null);

  // ── Recall & Edit Mode State ─────────────────────────────────────────────
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderNo, setEditingOrderNo] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [showRecallModal, setShowRecallModal] = useState<boolean>(false);
  const [recallSearchQuery, setRecallSearchQuery] = useState<string>("");
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState<boolean>(false);
  const [showCommercialDrawer, setShowCommercialDrawer] = useState<boolean>(false);
  const [supplierCommercialDefaults, setSupplierCommercialDefaults] = useState<Partial<CommercialDeliveryData> | undefined>(undefined);

  const toolbarSearchRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [header, setHeader] = useState<SizewisePOHeader>(() => {
    const base: SizewisePOHeader = {
      documentType: "Purchase Order",
      prefix: "PO",
      orderNumber: "001",
      orderDate: today,
      supplierId: "",
      supplierName: "",
      deliveryDate: defaultDelivery,
      leadTimeDays: 7,
      deliveryLocation: "Main Store (MAIN)",
      commonTaxPercent: 18,
      freightAmount: 0,
      otherCharges: 0,
      paymentTerms: "120 Days",
      businessTerms: DEFAULT_BUSINESS_TERMS,
      freightCharges: "Paid by Supplier",
      deliveryTerms: "Door Delivery",
      currency: "INR - Indian Rupee",
      buyer: currentUser?.name ? `${currentUser.name} (${currentUser.role || "MANAGER"})` : "manager (MANAGER)",
      department: "General Purchase",
      supplierReference: "",
      specialInstructions: "",
      remarks: "",
      internalNotes: "",
      priceList: "Default Purchase Price",
    };
    return initialHeader ? { ...base, ...initialHeader } : base;
  });

  // Phase 1: start with initialLines if provided, or an empty grid
  const [lines, setLines] = useState<SizewisePOLine[]>(() => {
    return initialLines && initialLines.length > 0 ? initialLines : [];
  });

  // Derived presentation model: Groups canonical lines by Article + Color for live display
  const groupedDisplayLines = useMemo(
    () => buildGroupedSizewiseLines(lines, sizes, header.commonTaxPercent),
    [lines, sizes, header.commonTaxPercent]
  );

  // Sync state back to parent
  const onLinesChangeRef = useRef(onLinesChange);
  useEffect(() => {
    onLinesChangeRef.current = onLinesChange;
  }, [onLinesChange]);

  useEffect(() => {
    onLinesChangeRef.current?.(lines);
  }, [lines]);

  const onHeaderChangeRef = useRef(onHeaderChange);
  useEffect(() => {
    onHeaderChangeRef.current = onHeaderChange;
  }, [onHeaderChange]);

  useEffect(() => {
    onHeaderChangeRef.current?.(header);
  }, [header]);

  const onSizesChangeRef = useRef(onSizesChange);
  useEffect(() => {
    onSizesChangeRef.current = onSizesChange;
  }, [onSizesChange]);

  useEffect(() => {
    onSizesChangeRef.current?.(sizes);
  }, [sizes]);

  // ── Phase 2 States: Print Preview, More Actions Popover, Governed Modal ──
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Global Grid Import & Paste States
  const [isGlobalImportOpen, setIsGlobalImportOpen] = useState(false);
  const [initialImportText, setInitialImportText] = useState<string | undefined>(undefined);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "danger" | "warning" | "primary";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    variant: "primary",
    onConfirm: () => {},
  });

  // ── Phase 3 States: Images & Articles Visual Lookbook + Recommendation Engine ──
  const [visualViewMode, setVisualViewMode] = useState<"card" | "table">("card");
  const [articleImageMap, setArticleImageMap] = useState<Record<string, string>>({
    "CH-19": "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500&auto=format&fit=crop&q=60",
    "SH-22": "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop&q=60",
    "SN-10": "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=500&auto=format&fit=crop&q=60",
    "FM-05": "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=500&auto=format&fit=crop&q=60",
  });
  const [imageModalState, setImageModalState] = useState<{
    isOpen: boolean;
    rowIndex: number | null;
    itemCode: string;
    articleNo: string;
    color: string;
    currentImage: string;
    scope: "articleColor" | "article" | "itemCode" | "rowOnly";
    isUploading?: boolean;
    isOptimized?: boolean;
    uploadError?: string | null;
  }>({
    isOpen: false,
    rowIndex: null,
    itemCode: "",
    articleNo: "",
    color: "",
    currentImage: "",
    scope: "articleColor",
    isUploading: false,
    isOptimized: false,
    uploadError: null,
  });
  const [zoomLightboxUrl, setZoomLightboxUrl] = useState<string | null>(null);
  const [visualSearch, setVisualSearch] = useState<string>("");
  const [batchRecommendOpen, setBatchRecommendOpen] = useState(false);
  const [cardAssortmentOpen, setCardAssortmentOpen] = useState<number | null>(null);
  const [batchUploadState, setBatchUploadState] = useState<BatchUploadState>({
    isOpen: false,
    isDragging: false,
    items: [],
    isProcessing: false,
    progressPercent: 0,
  });
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreActions(false);
      }
    };
    if (showMoreActions) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMoreActions]);

  // ── Data load ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      try {
        const prodRes = await apiFetchV1("/inventory/?page=1&page_size=5000&sort=created_at&order=desc");
        const list = Array.isArray(prodRes) ? prodRes : prodRes?.items || [];
        if (list.length > 0) {
          setProducts(
            list.map((p: any) => ({
              id: p.id,
              code: p.code,
              name: p.name,
              price: parseFloat(p.price || 0),
              costPrice: p.cost_price ? parseFloat(p.cost_price) : 0,
              mrp: p.mrp ? parseFloat(p.mrp) : parseFloat(p.price || 0),
              barcode: p.barcode,
              brand: p.brand,
              styleCode: p.style_code,
              color: p.color,
              size: p.size,
              stock: Number(p.stock || 0),
              category: p.category,
              attributes: p.attributes || p.attributes_json || {},
              primaryImageUrl: p.primary_image_url || p.primaryImageUrl || p.image_url,
              galleryImages: p.gallery_images || p.galleryImages,
              heel_type: p.heel_type || p.heelType,
              upper_material: p.upper_material || p.upperMaterial,
              outsole_material: p.outsole_material || p.outsoleMaterial,
              department: p.department,
              article: p.article || p.article_no,
              article_no: p.article_no || p.article,
            }))
          );
        }
      } catch {
        // inventory load is non-fatal
      }

      const supRes = await apiFetchV1("/purchase/suppliers/");
      const supList = Array.isArray(supRes) ? supRes : supRes?.items || [];
      const suppliers = supList.length > 0
        ? supList.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.vendor_code || s.code,
            gstin: s.gstin || s.gst_number || s.tax_id || "",
            gst_number: s.gst_number || s.gstin || "",
            address: s.address || "",
            mobile: s.mobile || s.phone || "",
            phone: s.mobile || s.phone || "",
            email: s.email || "",
            city: s.city || "",
            state: s.state || "",
            pincode: s.pincode || "",
            payment_terms: s.payment_terms || (s.payment_terms_days ? `${s.payment_terms_days} Days` : "120 Days"),
            payment_terms_days: s.payment_terms_days ?? 120,
            freight_terms: s.freight_terms || "Paid by Supplier",
            delivery_terms: s.delivery_terms || ((s.freight_terms || "").toLowerCase().includes("buyer") || (s.freight_terms || "").toLowerCase().includes("to-pay") ? "Ex-Factory" : "Door Delivery"),
            currency: s.currency || "INR - Indian Rupee",
            buyer: s.buyer || undefined,
            department: s.department || undefined,
            special_instructions: s.special_instructions || "",
            business_terms: s.business_terms || s.special_instructions || "",
            commercial_terms: s.commercial_terms || undefined,
          }))
        : [];
      setSuppliersList(suppliers);

      if (!header.supplierId && suppliers.length > 0) {
        const firstSup = suppliers[0];
        setHeader(h => ({
          ...h,
          supplierId: firstSup.id,
          supplierName: firstSup.name,
          paymentTerms: firstSup.payment_terms || "120 Days",
          freightCharges: firstSup.freight_terms || h.freightCharges,
          deliveryTerms: firstSup.delivery_terms || h.deliveryTerms,
          currency: firstSup.currency || h.currency,
          buyer: firstSup.buyer || h.buyer,
          department: firstSup.department || h.department,
          specialInstructions: firstSup.special_instructions || h.specialInstructions,
          businessTerms: firstSup.business_terms || firstSup.special_instructions || h.businessTerms || DEFAULT_BUSINESS_TERMS,
        }));
      }

      // Fetch active warehouses for delivery location selection
      try {
        const whRes: any = await apiFetchV1("/wms/warehouses");
        const whList = Array.isArray(whRes) ? whRes : whRes?.items || [];
        if (whList.length > 0) {
          const activeWhs = whList.filter((w: any) => w.is_active !== false);
          setAvailableWarehouses(activeWhs);
          setHeader(current => {
            if (!current.warehouseId && activeWhs.length > 0) {
              const central = activeWhs.find((w: any) => w.is_central_godown) || activeWhs[0];
              return {
                ...current,
                warehouseId: central.id,
                deliveryLocation: `${central.code} - ${central.name}`,
              };
            }
            return current;
          });
        }
      } catch (err) {
        console.warn("[PoSizewiseTab] Failed to load warehouses:", err);
      }

      // Fetch next PO number
      try {
        const nextRes: any = await apiFetchV1(
          `/purchase/orders/next-number?prefix=${encodeURIComponent(header.prefix || "PO")}`
        );
        if (nextRes?.suggested_order_no) {
          const sug = String(nextRes.suggested_order_no);
          if (sug.includes("-")) {
            const lastDash = sug.lastIndexOf("-");
            const pfx = sug.slice(0, lastDash);
            const num = sug.slice(lastDash + 1);
            setHeader(h => ({ ...h, prefix: pfx || h.prefix, orderNumber: num }));
          } else {
            setHeader(h => ({ ...h, orderNumber: sug }));
          }
        } else if (nextRes?.next_number) {
          setHeader(h => ({ ...h, orderNumber: String(nextRes.next_number) }));
        }
      } catch {
        // sequence fetch is non-fatal
      }
    } catch (err) {
      onNotification?.("Load Error", "Failed to load supplier list.", "error");
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  // ── Recall & Load PO for Editing in Sizewise Mode ───────────────────────
  const fetchRecentOrders = useCallback(async () => {
    try {
      setRecentOrdersLoading(true);
      const res = await apiFetchV1("/purchase/orders/?page=1&page_size=8&sort=created_at&order=desc");
      const list = Array.isArray(res) ? res : res?.items || [];
      setRecentOrders(list);
    } catch {
      setRecentOrders([]);
    } finally {
      setRecentOrdersLoading(false);
    }
  }, []);

  const loadPOForEditing = useCallback(
    async (orderIdentifier: string) => {
      if (!orderIdentifier || !orderIdentifier.trim()) return;
      try {
        setSaving(true);
        const cleanId = orderIdentifier.trim();
        const fullPo = await apiFetchV1(`/purchase/orders/${cleanId}`);
        if (!fullPo || (!fullPo.id && !fullPo.order_no)) {
          onNotification?.("PO Not Found", `Could not find purchase order '${cleanId}'.`, "error");
          return;
        }

        setEditingOrderId(fullPo.id || null);
        const rawNo = fullPo.order_no || cleanId;
        setEditingOrderNo(rawNo);
        setEditingStatus((fullPo.status || "DRAFT").toUpperCase());

        // Parse prefix and number
        const lastDash = rawNo.lastIndexOf("-");
        if (lastDash > 0) {
          setHeader(h => ({
            ...h,
            prefix: rawNo.substring(0, lastDash),
            orderNumber: rawNo.substring(lastDash + 1),
            orderDate: fullPo.order_date || h.orderDate,
            deliveryDate: fullPo.delivery_date || h.deliveryDate,
          }));
        } else {
          setHeader(h => ({
            ...h,
            orderNumber: rawNo,
            orderDate: fullPo.order_date || h.orderDate,
            deliveryDate: fullPo.delivery_date || h.deliveryDate,
          }));
        }

        // Restore frozen Commercial Terms snapshot from saved PO
        const commSnap = fullPo.commercial_terms || fullPo.rule_snapshots?.commercial_terms;
        let restoredPayment = commSnap?.payment_terms;
        let restoredFreight = commSnap?.freight_terms;
        let restoredCurrency = commSnap?.currency;
        let restoredBuyer = commSnap?.buyer;
        let restoredDepartment = commSnap?.department;
        let restoredInstructions = commSnap?.special_instructions;
        let restoredRef = commSnap?.supplier_reference;
        let restoredBusinessTerms = commSnap?.business_terms;

        // Fallback: parse from notes string if legacy PO without structured snapshot
        if (!commSnap && fullPo.notes) {
          const parts = String(fullPo.notes).split("|");
          for (const part of parts) {
            const idx = part.indexOf(":");
            if (idx > -1) {
              const k = part.substring(0, idx).trim().toLowerCase();
              const v = part.substring(idx + 1).trim();
              if (k.includes("payment")) restoredPayment = v;
              else if (k.includes("freight")) restoredFreight = v;
              else if (k.includes("currency")) restoredCurrency = v;
              else if (k.includes("buyer")) restoredBuyer = v;
              else if (k.includes("dept") || k.includes("department")) restoredDepartment = v;
              else if (k.includes("instruction")) restoredInstructions = v;
              else if (k.includes("ref")) restoredRef = v;
              else if (k.includes("business") || k.includes("terms")) restoredBusinessTerms = v;
            }
          }
        }

        // Supplier match (restoring frozen commercial terms snapshot)
        if (fullPo.supplier_id || fullPo.supplier) {
          const found = suppliersList.find(
            s => s.id === fullPo.supplier_id || s.name === fullPo.supplier_name || s.name === fullPo.supplier
          );
          if (found) {
            setHeader(h => ({
              ...h,
              supplierId: found.id,
              supplierName: found.name,
              paymentTerms: restoredPayment ?? h.paymentTerms ?? "120 Days",
              freightCharges: restoredFreight ?? h.freightCharges,
              currency: restoredCurrency ?? h.currency,
              buyer: restoredBuyer ?? h.buyer,
              department: restoredDepartment ?? h.department,
              specialInstructions: restoredInstructions ?? h.specialInstructions,
              supplierReference: restoredRef ?? h.supplierReference,
              businessTerms: restoredBusinessTerms ?? h.businessTerms ?? DEFAULT_BUSINESS_TERMS,
            }));
          } else if (fullPo.supplier_id) {
            setHeader(h => ({
              ...h,
              supplierId: fullPo.supplier_id,
              supplierName: fullPo.supplier_name || "Supplier",
              paymentTerms: restoredPayment ?? h.paymentTerms ?? "120 Days",
              freightCharges: restoredFreight ?? h.freightCharges,
              currency: restoredCurrency ?? h.currency,
              buyer: restoredBuyer ?? h.buyer,
              department: restoredDepartment ?? h.department,
              specialInstructions: restoredInstructions ?? h.specialInstructions,
              supplierReference: restoredRef ?? h.supplierReference,
              businessTerms: restoredBusinessTerms ?? h.businessTerms ?? DEFAULT_BUSINESS_TERMS,
            }));
          }
        } else if (restoredPayment || restoredFreight || restoredCurrency || restoredBuyer || restoredDepartment || restoredInstructions || restoredRef || restoredBusinessTerms) {
          setHeader(h => ({
            ...h,
            paymentTerms: restoredPayment ?? h.paymentTerms ?? "120 Days",
            freightCharges: restoredFreight ?? h.freightCharges,
            currency: restoredCurrency ?? h.currency,
            buyer: restoredBuyer ?? h.buyer,
            department: restoredDepartment ?? h.department,
            specialInstructions: restoredInstructions ?? h.specialInstructions,
            supplierReference: restoredRef ?? h.supplierReference,
            businessTerms: restoredBusinessTerms ?? h.businessTerms ?? DEFAULT_BUSINESS_TERMS,
          }));
        }

        // Parse items and detect scale
        const poItems = fullPo.items || [];
        let detectedScale = selectedScaleKey;
        const hasEuSizes = poItems.some((it: any) => {
          const code = it.code || it.item_code || "";
          return /-(3[6-9]|4[0-5])$/.test(code) || (it.size_quantities && Object.keys(it.size_quantities).some(k => ["36","37","38","39","40","41","42","43","44"].includes(k)));
        });
        if (hasEuSizes) {
          detectedScale = "FOOTWEAR_EU";
          setSelectedScaleKey("FOOTWEAR_EU");
          setSizes(SIZE_SCALE_PRESETS["FOOTWEAR_EU"].sizes);
        }

        const activeSizes = SIZE_SCALE_PRESETS[detectedScale]?.sizes || sizes;

        const groupedPoMap = new Map<string, SizewisePOLine>();
        poItems.forEach((item: any, idx: number) => {
          const rawCode = item.code || item.item_code || item.itemCode || item.sku || `ITEM-${idx + 1}`;
          const rawName = item.name || item.product_name || item.product || item.item_name || "Purchased Product";
          const extracted = extractArticleAndColor(
            rawCode,
            rawName,
            item.style || item.style_code,
            item.shade || item.color
          );
          const art = extracted.article || rawCode;
          const col = extracted.color || item.shade || "";
          const groupKey = `${art.toUpperCase()}:::${col.toUpperCase()}`;

          const sizeQtys: Record<string, number> = {};
          activeSizes.forEach(sz => {
            sizeQtys[sz] = item.sizeQuantities?.[sz] || item.size_quantities?.[sz] || 0;
          });
          let totalQty = activeSizes.reduce((sum, sz) => sum + (sizeQtys[sz] || 0), 0);
          const itemQty = Number(item.quantity || item.qty || 0);
          if (totalQty === 0 && itemQty > 0) {
            const codeStr = item.code || item.item_code || "";
            const szMatch = codeStr.match(/-([A-Za-z0-9]+)$/);
            const matchedSz = szMatch ? szMatch[1].toUpperCase() : null;
            if (matchedSz && activeSizes.includes(matchedSz)) {
              sizeQtys[matchedSz] = itemQty;
              totalQty = itemQty;
            } else {
              const midSz = activeSizes[Math.floor(activeSizes.length / 2)] || activeSizes[0];
              sizeQtys[midSz] = itemQty;
              totalQty = itemQty;
            }
          }
          const rate = parseFloat(item.rate || item.cost_price || item.unit_price || 0);

          // Lookup matching product in catalog index
          const matchedProduct = products.find(
            p => p.id === item.product_id || p.code === rawCode || (item.barcode && p.barcode === item.barcode)
          );
          const matchedVariant = art ? resolveVariantFromIndex(articleCatalogIndex, art, col, "") : undefined;
          const origProduct = matchedProduct || matchedVariant?.originalProduct;
          const fwAttrs = resolveFootwearAttributes(origProduct || item);

          if (!groupedPoMap.has(groupKey)) {
            groupedPoMap.set(groupKey, {
              id: `sw-line-${groupedPoMap.size + 1}`,
              sNo: groupedPoMap.size + 1,
              itemCode: rawCode,
              articleNo: art,
              barcode: item.barcode || origProduct?.barcode || "",
              product: rawName,
              brand: item.brand || origProduct?.brand || "",
              style: art,
              shade: col,
              unit: item.unit || item.uom || "Pair",
              sizeQuantities: sizeQtys,
              totalQty,
              rate,
              stockOnHand: Number(item.stock || item.stockOnHand || origProduct?.stock || 0),
              taxPercent: Number(item.gst_rate || item.tax_percent || item.taxPercent || header.commonTaxPercent),
              netValue: totalQty * rate,
              deliveryDate: item.delivery_date || header.deliveryDate,
              originalProduct: origProduct,
              imageUrl: item.imageUrl || origProduct?.primaryImageUrl,
              heelType: fwAttrs.heels !== "—" ? fwAttrs.heels : undefined,
              upperMaterial: fwAttrs.upperMaterial !== "—" ? fwAttrs.upperMaterial : undefined,
              outsoleMaterial: fwAttrs.outsole !== "—" ? fwAttrs.outsole : undefined,
            });
          } else {
            const existing = groupedPoMap.get(groupKey)!;
            activeSizes.forEach(sz => {
              if (sizeQtys[sz]) {
                existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + sizeQtys[sz];
              }
            });
            existing.totalQty = activeSizes.reduce((sum, sz) => sum + (existing.sizeQuantities[sz] || 0), 0);
            existing.netValue = existing.totalQty * existing.rate;
            if (!existing.barcode && (item.barcode || origProduct?.barcode)) {
              existing.barcode = item.barcode || origProduct?.barcode;
            }
            if (!existing.originalProduct && origProduct) existing.originalProduct = origProduct;
            if (!existing.heelType && fwAttrs.heels !== "—") existing.heelType = fwAttrs.heels;
            if (!existing.upperMaterial && fwAttrs.upperMaterial !== "—") existing.upperMaterial = fwAttrs.upperMaterial;
            if (!existing.outsoleMaterial && fwAttrs.outsole !== "—") existing.outsoleMaterial = fwAttrs.outsole;
            if (!existing.imageUrl && (item.imageUrl || origProduct?.primaryImageUrl)) {
              existing.imageUrl = item.imageUrl || origProduct?.primaryImageUrl;
            }
          }
        });

        const newLines: SizewisePOLine[] = Array.from(groupedPoMap.values()).map((l, i) => ({
          ...l,
          sNo: i + 1,
          id: `sw-line-${i + 1}`,
        }));

        if (newLines.length > 0) {
          setLines(newLines);
        }
        setShowRecallModal(false);
        onNotification?.(
          "PO Loaded",
          `Loaded Purchase Order ${fullPo.order_no} (${fullPo.status || "DRAFT"}) into Sizewise Matrix.`,
          "success"
        );
      } catch (err: any) {
        onNotification?.("Load Failed", `Could not recall PO: ${err.message || "Unknown error"}`, "error");
      } finally {
        setSaving(false);
      }
    },
    [selectedScaleKey, sizes, suppliersList, header.commonTaxPercent, header.deliveryDate, onNotification]
  );

  useEffect(() => {
    if (orderToEdit) {
      loadPOForEditing(orderToEdit);
    }
  }, [orderToEdit, loadPOForEditing]);

  const handleNewPO = useCallback(async () => {
    setEditingOrderId(null);
    setEditingOrderNo(null);
    setEditingStatus(null);
    onClearOrderToEdit?.();
    setLines([buildBlankLine(0, sizes, header.deliveryDate, header.commonTaxPercent)]);
    try {
      const nextRes: any = await apiFetchV1(
        `/purchase/orders/next-number?prefix=${encodeURIComponent(header.prefix || "PO")}`
      );
      if (nextRes?.suggested_order_no) {
        const sug = String(nextRes.suggested_order_no);
        if (sug.includes("-")) {
          const lastDash = sug.lastIndexOf("-");
          const pfx = sug.slice(0, lastDash);
          const num = sug.slice(lastDash + 1);
          setHeader(h => ({ ...h, prefix: pfx || h.prefix, orderNumber: num }));
        } else {
          setHeader(h => ({ ...h, orderNumber: sug }));
        }
      } else if (nextRes?.next_number) {
        setHeader(h => ({ ...h, orderNumber: String(nextRes.next_number) }));
      }
    } catch {
      // non-fatal
    }
    onNotification?.("New PO", "Workspace cleared. Ready for new purchase order.", "info");
  }, [header.deliveryDate, header.commonTaxPercent, header.prefix, sizes, onClearOrderToEdit, onNotification]);

  const selectedSupplier = useMemo(
    () => suppliersList.find(s => s.id === header.supplierId) || null,
    [suppliersList, header.supplierId]
  );

  // ── Line helpers ──────────────────────────────────────────────────────
  const updateLine = useCallback(
    (idx: number, patch: Partial<SizewisePOLine>) => {
      setLines(prev =>
        prev.map((line, i) => {
          if (i !== idx) return line;
          const merged = { ...line, ...patch };
          const totalQty = sizes.reduce((s, sz) => s + (merged.sizeQuantities[sz] || 0), 0);
          const netValue = totalQty * (merged.rate || 0);
          return { ...merged, totalQty, netValue };
        })
      );
    },
    [sizes]
  );

  const handleArticleChange = useCallback((idx: number, val: string) => {
    const art = val.trim();
    const summary = getArticleSummaryFromIndex(articleCatalogIndex, art);
    if (summary) {
      const availableColors = getAvailableColorsForArticle(articleCatalogIndex, summary.article);
      const currColor = (lines[idx]?.shade || "").toUpperCase();
      const keepColor = availableColors.map(c => c.toUpperCase()).includes(currColor);
      const newShade = keepColor ? currColor : (availableColors.length === 1 ? availableColors[0] : "");
      const matchedVariant = newShade ? resolveVariantFromIndex(articleCatalogIndex, summary.article, newShade, "") : undefined;
      const fwAttrs = resolveFootwearAttributes(matchedVariant?.originalProduct || (summary as any));

      updateLine(idx, {
        articleNo: summary.article,
        style: summary.article,
        itemCode: lines[idx]?.itemCode || summary.article,
        brand: summary.brand || lines[idx]?.brand,
        product: summary.name || lines[idx]?.product,
        rate: summary.costPrice || lines[idx]?.rate,
        taxPercent: summary.gstPercentage !== undefined ? summary.gstPercentage : lines[idx]?.taxPercent,
        imageUrl: summary.imageUrl || lines[idx]?.imageUrl,
        shade: newShade,
        originalProduct: matchedVariant?.originalProduct || lines[idx]?.originalProduct,
        heelType: fwAttrs.heels !== "—" ? fwAttrs.heels : lines[idx]?.heelType,
        upperMaterial: fwAttrs.upperMaterial !== "—" ? fwAttrs.upperMaterial : lines[idx]?.upperMaterial,
        outsoleMaterial: fwAttrs.outsole !== "—" ? fwAttrs.outsole : lines[idx]?.outsoleMaterial,
      });
    } else {
      updateLine(idx, {
        articleNo: val,
        style: val,
        itemCode: lines[idx]?.itemCode || val,
      });
    }
  }, [articleCatalogIndex, lines, updateLine]);

  const handleColorChange = useCallback((idx: number, val: string) => {
    const shadeVal = val.toUpperCase();
    const art = lines[idx]?.articleNo || lines[idx]?.style;
    const variant = art ? resolveVariantFromIndex(articleCatalogIndex, art, shadeVal, "") : undefined;
    const fwAttrs = resolveFootwearAttributes(variant?.originalProduct);
    updateLine(idx, {
      shade: shadeVal,
      ...(variant ? {
        rate: variant.costPrice || lines[idx]?.rate,
        taxPercent: variant.gstPercentage !== undefined ? variant.gstPercentage : lines[idx]?.taxPercent,
        imageUrl: variant.imageUrl || lines[idx]?.imageUrl,
        originalProduct: variant.originalProduct || lines[idx]?.originalProduct,
        heelType: fwAttrs.heels !== "—" ? fwAttrs.heels : lines[idx]?.heelType,
        upperMaterial: fwAttrs.upperMaterial !== "—" ? fwAttrs.upperMaterial : lines[idx]?.upperMaterial,
        outsoleMaterial: fwAttrs.outsole !== "—" ? fwAttrs.outsole : lines[idx]?.outsoleMaterial,
      } : {}),
    });
  }, [articleCatalogIndex, lines, updateLine]);

  // ── Grouped Grid Cell Modification Handlers (Non-destructive to variant identities) ──
  const handleGroupSizeQtyChange = useCallback(
    (group: GroupedSizewiseDisplayRow, sz: string, qty: number) => {
      const targetIdx = group.sizeToLineIndex[sz] !== undefined ? group.sizeToLineIndex[sz] : group.primaryLineIndex;
      setLines(prev =>
        prev.map((line, i) => {
          if (i === targetIdx) {
            const sizeQuantities = { ...line.sizeQuantities, [sz]: qty };
            const totalQty = sizes.reduce((s, s2) => s + (sizeQuantities[s2] || 0), 0);
            const netValue = totalQty * (line.rate || 0);
            return { ...line, sizeQuantities, totalQty, netValue };
          }
          // Zero out from other members of the same group to maintain single source of truth for that size
          if (group.memberLineIndices.includes(i) && line.sizeQuantities?.[sz]) {
            const sizeQuantities = { ...line.sizeQuantities, [sz]: 0 };
            const totalQty = sizes.reduce((s, s2) => s + (sizeQuantities[s2] || 0), 0);
            const netValue = totalQty * (line.rate || 0);
            return { ...line, sizeQuantities, totalQty, netValue };
          }
          return line;
        })
      );
    },
    [sizes]
  );

  const handleGroupRateChange = useCallback(
    (group: GroupedSizewiseDisplayRow, newRate: number) => {
      setLines(prev =>
        prev.map((line, i) => {
          if (group.memberLineIndices.includes(i)) {
            const netValue = line.totalQty * newRate;
            return { ...line, rate: newRate, netValue };
          }
          return line;
        })
      );
    },
    []
  );

  const handleGroupTaxChange = useCallback(
    (group: GroupedSizewiseDisplayRow, newTax: number) => {
      setLines(prev =>
        prev.map((line, i) => {
          if (group.memberLineIndices.includes(i)) {
            return { ...line, taxPercent: newTax };
          }
          return line;
        })
      );
    },
    []
  );

  const handleGroupDeliveryDateChange = useCallback(
    (group: GroupedSizewiseDisplayRow, newDate: string) => {
      setLines(prev =>
        prev.map((line, i) => {
          if (group.memberLineIndices.includes(i)) {
            return { ...line, deliveryDate: newDate };
          }
          return line;
        })
      );
    },
    []
  );

  const handleGroupArticleChange = useCallback(
    (group: GroupedSizewiseDisplayRow, newArticle: string) => {
      handleArticleChange(group.primaryLineIndex, newArticle);
      if (group.memberLineIndices.length > 1) {
        setLines(prev =>
          prev.map((line, i) => {
            if (group.memberLineIndices.includes(i) && i !== group.primaryLineIndex) {
              return { ...line, articleNo: newArticle, style: newArticle };
            }
            return line;
          })
        );
      }
    },
    [handleArticleChange]
  );

  const handleGroupColorChange = useCallback(
    (group: GroupedSizewiseDisplayRow, newColor: string) => {
      handleColorChange(group.primaryLineIndex, newColor);
      if (group.memberLineIndices.length > 1) {
        setLines(prev =>
          prev.map((line, i) => {
            if (group.memberLineIndices.includes(i) && i !== group.primaryLineIndex) {
              return { ...line, shade: newColor.toUpperCase() };
            }
            return line;
          })
        );
      }
    },
    [handleColorChange]
  );

  const handleGroupDelete = useCallback(
    (group: GroupedSizewiseDisplayRow) => {
      setLines(prev =>
        prev
          .filter((_, i) => !group.memberLineIndices.includes(i))
          .map((l, i) => ({ ...l, sNo: i + 1, id: `sw-line-${i + 1}` }))
      );
    },
    []
  );

  const handleApplyRecommendationToGroup = useCallback(
    (group: GroupedSizewiseDisplayRow, curve: "bell" | "core" | "uniform") => {
      const targetQty = group.totalQty > 0 ? group.totalQty : 12;
      const newQtys = recommendSizeAssortment(sizes, targetQty, curve);
      setLines(prev => {
        const next = [...prev];
        sizes.forEach(sz => {
          const targetIdx = group.sizeToLineIndex[sz] !== undefined ? group.sizeToLineIndex[sz] : group.primaryLineIndex;
          if (next[targetIdx]) {
            next[targetIdx] = {
              ...next[targetIdx],
              sizeQuantities: {
                ...next[targetIdx].sizeQuantities,
                [sz]: newQtys[sz] || 0,
              },
            };
          }
          group.memberLineIndices.forEach(idx => {
            if (idx !== targetIdx && next[idx]?.sizeQuantities?.[sz]) {
              next[idx] = {
                ...next[idx],
                sizeQuantities: {
                  ...next[idx].sizeQuantities,
                  [sz]: 0,
                },
              };
            }
          });
        });
        group.memberLineIndices.forEach(idx => {
          if (next[idx]) {
            const tQty = sizes.reduce((s, sz) => s + (next[idx].sizeQuantities[sz] || 0), 0);
            next[idx] = {
              ...next[idx],
              totalQty: tQty,
              netValue: tQty * (next[idx].rate || 0),
            };
          }
        });
        return next;
      });
      onNotification?.(
        "Assortment Applied",
        `Applied ${curve.toUpperCase()} curve to ${group.articleNo || group.style || "article"} (${group.shade || "Standard"}).`,
        "info"
      );
    },
    [sizes, onNotification]
  );

  const updateSizeQty = useCallback(
    (lineIdx: number, sz: string, qty: number) => {
      setLines(prev =>
        prev.map((line, i) => {
          if (i !== lineIdx) return line;
          const sizeQuantities = { ...line.sizeQuantities, [sz]: qty };
          const totalQty = sizes.reduce((s, s2) => s + (sizeQuantities[s2] || 0), 0);
          const netValue = totalQty * (line.rate || 0);
          return { ...line, sizeQuantities, totalQty, netValue };
        })
      );
    },
    [sizes]
  );

  const addBlankRow = useCallback(() => {
    setLines(prev => [
      ...prev,
      buildBlankLine(prev.length, sizes, header.deliveryDate, header.commonTaxPercent),
    ]);
  }, [sizes, header.deliveryDate, header.commonTaxPercent]);

  const deleteRow = useCallback((idx: number) => {
    setLines(prev =>
      prev
        .filter((_, i) => i !== idx)
        .map((l, i) => ({ ...l, sNo: i + 1, id: `sw-line-${i + 1}` }))
    );
  }, []);

  const handleScaleChange = useCallback((newScaleKey: string) => {
    setSelectedScaleKey(newScaleKey);
    const newSizes = SIZE_SCALE_PRESETS[newScaleKey]?.sizes || DEFAULT_SIZEWISE_SIZES;
    setSizes(newSizes);
    setLines(prev =>
      prev.map(line => {
        const newSizeQuantities: Record<string, number> = {};
        newSizes.forEach(sz => {
          newSizeQuantities[sz] = line.sizeQuantities[sz] || 0;
        });
        const totalQty = newSizes.reduce((s, sz) => s + (newSizeQuantities[sz] || 0), 0);
        const netValue = totalQty * (line.rate || 0);
        return {
          ...line,
          sizeQuantities: newSizeQuantities,
          totalQty,
          netValue,
        };
      })
    );
  }, []);

  const populateProductToLine = useCallback(
    (product: Product, rowIdx: number) => {
      const isFootwear =
        product.category?.toLowerCase() === "footwear" ||
        product.unit?.toLowerCase() === "pair" ||
        /shoe|sneaker|slip-on|sandal|boot|footwear|heel|loafer/i.test(product.name || "") ||
        /shoe|sneaker|boot|footwear/i.test(product.category || "");

      const rate = product.costPrice || product.price || 0;
      const taxPercent = isFootwear ? getFootwearGstRate(rate) : (product.gstPercentage ?? product.taxRate ?? header.commonTaxPercent ?? 18);
      const unit = isFootwear ? "Pair" : (product.unit || "Pcs");

      let currentSizes = sizes;
      if (isFootwear && selectedScaleKey === "APPAREL_ALPHA") {
        const fwSizes = SIZE_SCALE_PRESETS.FOOTWEAR_EU.sizes;
        setSelectedScaleKey("FOOTWEAR_EU");
        setSizes(fwSizes);
        currentSizes = fwSizes;
      }

      const itemCode = product.code || product.id;
      const extracted = extractArticleAndColor(
        itemCode,
        product.name,
        product.styleCode || (product as any).style,
        product.color || (product as any).shade
      );
      const articleNo = (product as any).articleNo || (product as any).article_no || extracted.article || itemCode;
      const imageUrl = (product as any).primaryImageUrl || (product as any).imageUrl || articleImageMap[articleNo] || articleImageMap[itemCode] || "";

      setLines(prev =>
        prev.map((line, i) => {
          const baseLine =
            i === rowIdx
              ? {
                  ...line,
                  itemCode,
                  articleNo,
                  barcode: product.barcode || "",
                  product: product.name,
                  brand: product.brand || "",
                  style: product.styleCode || extracted.article || "",
                  shade: product.color || extracted.color || "",
                  unit,
                  rate,
                  taxPercent,
                  stockOnHand: product.stock || 0,
                  originalProduct: product,
                  imageUrl: imageUrl || line.imageUrl || "",
                }
              : line;

          const sizeQuantities: Record<string, number> = {};
          currentSizes.forEach(sz => {
            sizeQuantities[sz] = baseLine.sizeQuantities[sz] || 0;
          });
          const totalQty = currentSizes.reduce((s, sz) => s + (sizeQuantities[sz] || 0), 0);
          const netValue = totalQty * (baseLine.rate || 0);
          return {
            ...baseLine,
            sizeQuantities,
            totalQty,
            netValue,
          };
        })
      );
    },
    [sizes, selectedScaleKey, header.commonTaxPercent, articleImageMap]
  );

  // ── Phase 3 Handlers: Image Binding & Assortment Curves ────────────────────
  const openImageModal = useCallback((rowIdx: number) => {
    const line = lines[rowIdx];
    if (!line) return;
    const itemCode = line.itemCode || "";
    const articleNo = line.articleNo || line.itemCode || "";
    const color = line.shade || "";
    const currentImage = resolveLineImage(line, articleImageMap);
    setImageModalState({
      isOpen: true,
      rowIndex: rowIdx,
      itemCode,
      articleNo,
      color,
      currentImage,
      scope: color ? "articleColor" : "article",
      isUploading: false,
      isOptimized: Boolean(currentImage && (currentImage.includes("/images/spif-") || currentImage.endsWith(".webp"))),
      uploadError: null,
    });
  }, [lines, articleImageMap]);

  const handleApplyImage = useCallback((newUrl: string, scope: "articleColor" | "article" | "itemCode" | "rowOnly") => {
    const { rowIndex, itemCode, articleNo, color } = imageModalState;
    if (!newUrl.trim()) return;

    const trimmedColor = (color || "").trim().toLowerCase();

    if (scope === "articleColor" && articleNo && trimmedColor) {
      const compositeKey = `${articleNo}::${trimmedColor}`;
      setArticleImageMap(prev => ({ ...prev, [compositeKey]: newUrl }));
      setLines(prev => prev.map(l => {
        const lArt = (l.articleNo || l.itemCode || "").trim();
        const lColor = (l.shade || "").trim().toLowerCase();
        return (lArt === articleNo && lColor === trimmedColor) ? { ...l, imageUrl: newUrl } : l;
      }));
    } else if (scope === "article" && articleNo) {
      setArticleImageMap(prev => ({ ...prev, [articleNo]: newUrl }));
      setLines(prev => prev.map(l => (l.articleNo === articleNo || l.itemCode === articleNo) ? { ...l, imageUrl: newUrl } : l));
    } else if (scope === "itemCode" && itemCode) {
      setArticleImageMap(prev => ({ ...prev, [itemCode]: newUrl }));
      setLines(prev => prev.map(l => l.itemCode === itemCode ? { ...l, imageUrl: newUrl } : l));
    } else if (rowIndex !== null) {
      setLines(prev => prev.map((l, i) => i === rowIndex ? { ...l, imageUrl: newUrl } : l));
    }
    setImageModalState(s => ({ ...s, isOpen: false }));
    onNotification?.(
      "Image Updated",
      `Product image attached (${scope === "articleColor" ? `Article: ${articleNo} / Color: ${color}` : scope}).`,
      "success"
    );
  }, [imageModalState, onNotification]);

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setImageModalState(s => ({
          ...s,
          currentImage: dataUrl,
          isUploading: true,
          uploadError: null,
          isOptimized: false,
        }));

        try {
          const res = await apiFetchV1("/inventory/upload-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_data: dataUrl }),
          });

          if (res && res.url) {
            setImageModalState(s => ({
              ...s,
              currentImage: res.url,
              isUploading: false,
              isOptimized: true,
              uploadError: null,
            }));
            onNotification?.(
              "Image Uploaded & Converted to WebP",
              `Server optimized into ${res.filename} via SPIF.`,
              "success"
            );
          } else {
            setImageModalState(s => ({
              ...s,
              isUploading: false,
              isOptimized: false,
            }));
          }
        } catch (err) {
          console.warn("Server image upload failed, falling back to local data URL:", err);
          setImageModalState(s => ({
            ...s,
            isUploading: false,
            uploadError: "Saved locally (offline or server upload unavailable)",
          }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Phase 5: Batch Upload & Filename Matching Handlers ─────────────────
  const handleProcessBatchFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArray.length === 0) {
      onNotification?.("No Images", "Please drop or select valid image files (JPG, PNG, WebP).", "warning");
      return;
    }

    const newItems: BatchUploadItem[] = fileArray.map((file, idx) => {
      const match = matchImageFilenameToLines(file.name, lines);
      return {
        id: `batch-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        lineIndex: match.lineIndex,
        articleNo: match.articleNo,
        shade: match.shade,
        confidence: match.confidence,
        status: "ready",
      };
    });

    setBatchUploadState(prev => ({
      ...prev,
      isOpen: true,
      items: [...prev.items, ...newItems],
    }));
  }, [lines, onNotification]);

  const handleUpdateBatchItemLine = useCallback((itemId: string, lineIdx: number) => {
    const targetLine = lines[lineIdx];
    if (!targetLine) return;
    setBatchUploadState(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === itemId ? {
        ...item,
        lineIndex: lineIdx,
        articleNo: targetLine.articleNo || targetLine.itemCode || "",
        shade: targetLine.shade || "",
        confidence: "exact_composite",
      } : item),
    }));
  }, [lines]);

  const handleRemoveBatchItem = useCallback((itemId: string) => {
    setBatchUploadState(prev => ({
      ...prev,
      items: prev.items.filter(item => {
        if (item.id === itemId) {
          URL.revokeObjectURL(item.previewUrl);
          return false;
        }
        return true;
      }),
    }));
  }, []);

  const handleExecuteBatchUpload = useCallback(async () => {
    const pendingItems = batchUploadState.items.filter(i => i.status !== "uploaded");
    if (pendingItems.length === 0) {
      setBatchUploadState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    setBatchUploadState(prev => ({ ...prev, isProcessing: true, progressPercent: 0 }));

    let completedCount = 0;
    const totalCount = pendingItems.length;

    const queue = [...pendingItems];
    const updatedLineMap: Record<number, string> = {};
    const newArticleMapEntries: Record<string, string> = {};

    const processItem = async (item: BatchUploadItem) => {
      setBatchUploadState(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === item.id ? { ...i, status: "optimizing" } : i),
      }));

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("File read error"));
          reader.readAsDataURL(item.file);
        });

        let finalUrl = dataUrl;
        try {
          const res = await apiFetchV1("/inventory/upload-image", {
            method: "POST",
            body: JSON.stringify({
              image_data: dataUrl,
              filename: item.file.name,
            }),
          });
          if (res?.url) {
            finalUrl = res.url;
          }
        } catch (serverErr) {
          console.warn(`Server upload failed for ${item.file.name}, using local data URL:`, serverErr);
        }

        if (item.lineIndex >= 0 && item.lineIndex < lines.length) {
          updatedLineMap[item.lineIndex] = finalUrl;
        }
        if (item.articleNo) {
          if (item.shade) {
            newArticleMapEntries[`${item.articleNo}::${item.shade.toLowerCase()}`] = finalUrl;
          }
          newArticleMapEntries[item.articleNo] = finalUrl;
        }

        setBatchUploadState(prev => ({
          ...prev,
          items: prev.items.map(i => i.id === item.id ? { ...i, status: "uploaded", serverUrl: finalUrl } : i),
        }));
      } catch (err: any) {
        setBatchUploadState(prev => ({
          ...prev,
          items: prev.items.map(i => i.id === item.id ? { ...i, status: "failed", error: err?.message || "Upload failed" } : i),
        }));
      } finally {
        completedCount++;
        setBatchUploadState(prev => ({
          ...prev,
          progressPercent: Math.round((completedCount / totalCount) * 100),
        }));
      }
    };

    const poolSize = Math.min(3, queue.length);
    const workers = Array.from({ length: poolSize }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) await processItem(next);
      }
    });

    await Promise.all(workers);

    if (Object.keys(updatedLineMap).length > 0) {
      setLines(prev => prev.map((line, idx) => {
        if (updatedLineMap[idx]) {
          return { ...line, imageUrl: updatedLineMap[idx] };
        }
        return line;
      }));
    }

    if (Object.keys(newArticleMapEntries).length > 0) {
      setArticleImageMap(prev => ({ ...prev, ...newArticleMapEntries }));
    }

    onNotification?.(
      "Batch Image Upload Complete",
      `Successfully processed ${completedCount} images with SPIF WebP compression and bound to PO items.`,
      "success"
    );

    setBatchUploadState(prev => ({
      ...prev,
      isProcessing: false,
      isOpen: false,
    }));
  }, [batchUploadState.items, lines, onNotification]);

  const handleApplyRecommendationToRow = useCallback((rowIdx: number, curve: "bell" | "core" | "uniform") => {
    const line = lines[rowIdx];
    if (!line) return;
    const targetQty = line.totalQty > 0 ? line.totalQty : 12;
    const newQtys = recommendSizeAssortment(sizes, targetQty, curve);
    const totalQty = sizes.reduce((s, sz) => s + (newQtys[sz] || 0), 0);
    const netValue = totalQty * (line.rate || 0);

    setLines(prev => prev.map((l, i) => i === rowIdx ? {
      ...l,
      sizeQuantities: newQtys,
      totalQty,
      netValue,
    } : l));
    setCardAssortmentOpen(null);
    onNotification?.(
      "Assortment Curve Applied",
      `Distributed ${totalQty} units across ${sizes.length} sizes using ${curve.toUpperCase()} curve.`,
      "info"
    );
  }, [lines, sizes, onNotification]);

  const handleApplyBatchRecommendation = useCallback((curve: "bell" | "core" | "uniform") => {
    setLines(prev => {
      const next = [...prev];
      groupedDisplayLines.forEach(group => {
        if (!group.itemCode) return;
        const targetQty = group.totalQty > 0 ? group.totalQty : 12;
        const newQtys = recommendSizeAssortment(sizes, targetQty, curve);
        sizes.forEach(sz => {
          const targetIdx = group.sizeToLineIndex[sz] !== undefined ? group.sizeToLineIndex[sz] : group.primaryLineIndex;
          if (next[targetIdx]) {
            next[targetIdx] = {
              ...next[targetIdx],
              sizeQuantities: {
                ...next[targetIdx].sizeQuantities,
                [sz]: newQtys[sz] || 0,
              },
            };
          }
          group.memberLineIndices.forEach(idx => {
            if (idx !== targetIdx && next[idx]?.sizeQuantities?.[sz]) {
              next[idx] = {
                ...next[idx],
                sizeQuantities: {
                  ...next[idx].sizeQuantities,
                  [sz]: 0,
                },
              };
            }
          });
        });
        group.memberLineIndices.forEach(idx => {
          if (next[idx]) {
            const tQty = sizes.reduce((s, sz) => s + (next[idx].sizeQuantities[sz] || 0), 0);
            next[idx] = {
              ...next[idx],
              totalQty: tQty,
              netValue: tQty * (next[idx].rate || 0),
            };
          }
        });
      });
      return next;
    });
    setBatchRecommendOpen(false);
    onNotification?.(
      "Batch Assortment Applied",
      `Applied ${curve.toUpperCase()} curve across all line items.`,
      "success"
    );
  }, [groupedDisplayLines, sizes, onNotification]);

  // Barcode/search lookup
  const handleBarcodeSearch = (query: string) => {
    if (!query.trim()) return;
    const q = query.trim().toLowerCase();
    const resolvedVariant = resolveByBarcodeOrSkuFromIndex(articleCatalogIndex, query.trim());
    const found = resolvedVariant?.originalProduct || products.find(
      p =>
        (p.barcode && p.barcode.toLowerCase() === q) ||
        (p.code && p.code.toLowerCase() === q) ||
        (p.name && p.name.toLowerCase().includes(q))
    );
    if (found) {
      let targetIdx = lines.findIndex(l => !l.itemCode && l.totalQty === 0);
      if (targetIdx === -1) {
        targetIdx = lines.length;
        addBlankRow();
      }
      setActiveRowIndex(targetIdx);
      populateProductToLine(found, targetIdx);
      setToolbarSearch("");
    } else {
      onNotification?.("Not Found", `No item matching "${query}". Press F2 to browse.`, "warning");
    }
  };

  const handleSelectProduct = useCallback(
    (product: Product) => {
      // Ensure there is at least one row to populate into
      setLines(prev => {
        if (prev.length === 0) {
          return [buildBlankLine(0, sizes, header.deliveryDate, header.commonTaxPercent)];
        }
        return prev;
      });
      populateProductToLine(product, activeRowIndex);
      setShowBrowseModal(false);
    },
    [activeRowIndex, populateProductToLine, sizes, header.deliveryDate, header.commonTaxPercent]
  );

  // ── Phase 1: F2 via useF2Screen ───────────────────────────────────────
  // Per F2 architecture rule: screens register context; they do NOT add
  // window.addEventListener for F2. The platform dispatcher handles the key.
  const f2Adapter = useCallback(
    (result: LookupResult) => {
      // Map the F2 universal lookup result → Product shape and populate
      const rec = result.record as any;
      const mappedProduct: Product = {
        id:         rec.id || rec.variant_id || result.id,
        code:       rec.code || rec.stock_no || rec.article_no || result.returnValue,
        name:       rec.name || rec.product_name || result.displayValue,
        price:      parseFloat(rec.price || rec.sale_price || 0),
        costPrice:  parseFloat(rec.cost_price || 0),
        mrp:        parseFloat(rec.mrp || rec.price || 0),
        barcode:    rec.barcode || "",
        brand:      rec.brand || "",
        styleCode:  rec.style_code || rec.style || "",
        color:      rec.color || rec.shade || "",
        size:       rec.size || "",
        stock:      Number(rec.stock || rec.stock_on_hand || 0),
        category:   rec.category || "",
      };
      // Ensure a row exists to populate
      setLines(prev => {
        if (prev.length === 0) {
          return [buildBlankLine(0, sizes, header.deliveryDate, header.commonTaxPercent)];
        }
        return prev;
      });
      populateProductToLine(mappedProduct, activeRowIndex);
    },
    [activeRowIndex, populateProductToLine, sizes, header.deliveryDate, header.commonTaxPercent]
  );

  useF2Screen({
    screenId: "po_sizewise",
    defaultEntity: "variant",
    adapter: f2Adapter,
  });

  // Dispatcher reference — used by the F2/Scan button to programmatically
  // trigger the platform lookup (same path as keyboard F2)
  const f2Dispatcher = useF2Dispatcher();

  // ── Phase 2: Governed Row Deletion ────────────────────────────────────
  const requestDeleteRow = useCallback((idx: number) => {
    const line = lines[idx];
    if (!line) return;
    if (!line.itemCode && line.totalQty === 0) {
      deleteRow(idx);
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: `Delete Row #${idx + 1}`,
      message: `Are you sure you want to remove row #${idx + 1} (${line.product || line.itemCode}) with total ${line.totalQty} unit(s)?`,
      confirmLabel: "Delete Row",
      variant: "danger",
      onConfirm: () => deleteRow(idx),
    });
  }, [lines, deleteRow]);

  // ── Phase 2: Governed Scale Change Confirmation ───────────────────────
  const handleScaleSelectChange = useCallback((newScaleKey: string) => {
    if (newScaleKey === selectedScaleKey) return;
    const populatedCount = lines.filter(l => Boolean(l.itemCode && l.totalQty > 0)).length;
    if (populatedCount === 0) {
      handleScaleChange(newScaleKey);
      return;
    }
    const newPreset = SIZE_SCALE_PRESETS[newScaleKey];
    setConfirmModal({
      isOpen: true,
      title: "Change Size Scale Preset?",
      message: `You currently have ${populatedCount} active item(s) in this Purchase Order. Switching to "${newPreset?.label || newScaleKey}" will adjust size columns to (${newPreset?.sizes.join(", ")}). Quantities for sizes outside this range will be cleared. Do you wish to proceed?`,
      confirmLabel: "Switch Scale & Re-map",
      variant: "warning",
      onConfirm: () => handleScaleChange(newScaleKey),
    });
  }, [selectedScaleKey, lines, handleScaleChange]);

  // ── Phase 2: Governed Clear All Rows ──────────────────────────────────
  const requestClearAllLines = useCallback(() => {
    if (lines.length === 0) return;
    setShowMoreActions(false);
    setConfirmModal({
      isOpen: true,
      title: "Clear All Lines?",
      message: "This will remove all items and size quantities from the current Purchase Order.",
      confirmLabel: "Clear All",
      variant: "danger",
      onConfirm: () => {
        setLines([]);
        setActiveRowIndex(0);
      },
    });
  }, [lines.length]);

  // ── Phase 2: Export Matrix CSV ─────────────────────────────────────────
  const handleExportMatrixCSV = useCallback(() => {
    setShowMoreActions(false);
    if (lines.length === 0) {
      onNotification?.("No Data", "No line items to export.", "info");
      return;
    }
    const headers = ["#", "Item Code", "Product", "Brand", "Style", "Shade", ...sizes, "Total Qty", "Rate", "Tax %", "Net Value"];
    const csvRows = [headers.join(",")];
    lines.forEach((l, i) => {
      const row = [
        i + 1,
        `"${l.itemCode}"`,
        `"${(l.product || "").replace(/"/g, '""')}"`,
        `"${l.brand || ""}"`,
        `"${l.style || ""}"`,
        `"${l.shade || ""}"`,
        ...sizes.map(sz => l.sizeQuantities[sz] || 0),
        l.totalQty,
        l.rate,
        l.taxPercent,
        l.netValue,
      ];
      csvRows.push(row.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PO_${header.prefix}_${header.orderNumber}_matrix.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotification?.("Exported", "Matrix exported to CSV successfully.", "success");
  }, [lines, sizes, header.prefix, header.orderNumber, onNotification]);

  // ── Phase 2: Real Copy Previous PO ─────────────────────────────────────
  const executeCopyPreviousPO = useCallback(async () => {
    setShowMoreActions(false);
    try {
      setSaving(true);
      const res = await apiFetchV1("/purchase/orders/?page=1&page_size=1&sort=created_at&order=desc");
      const list = Array.isArray(res) ? res : res?.items || [];
      const prevOrderSummary = list[0];
      if (!prevOrderSummary) {
        onNotification?.("No History", "No previous purchase orders found to copy.", "info");
        return;
      }
      const fullPo = await apiFetchV1(`/purchase/orders/${prevOrderSummary.id || prevOrderSummary.order_no}`);
      const poItems = fullPo?.items || prevOrderSummary?.items || [];
      if (!poItems || poItems.length === 0) {
        onNotification?.("No Items", `Previous PO (${prevOrderSummary.order_no}) has no line items.`, "warning");
        return;
      }

      if (!header.supplierId && (fullPo.supplier_id || fullPo.supplier)) {
        const found = suppliersList.find(
          s => s.id === fullPo.supplier_id || s.name === fullPo.supplier_name || s.name === fullPo.supplier
        );
        if (found) {
          setHeader(h => ({ ...h, supplierId: found.id, supplierName: found.name }));
        }
      }

      const groupedPoMap = new Map<string, SizewisePOLine>();
      poItems.forEach((item: any, idx: number) => {
        const rawCode = item.code || item.item_code || item.itemCode || item.sku || `ITEM-${idx + 1}`;
        const rawName = item.name || item.product_name || item.product || item.item_name || "Purchased Product";
        const extracted = extractArticleAndColor(
          rawCode,
          rawName,
          item.style || item.style_code,
          item.shade || item.color
        );
        const art = extracted.article || rawCode;
        const col = extracted.color || item.shade || "";
        const groupKey = `${art.toUpperCase()}:::${col.toUpperCase()}`;

        const sizeQtys: Record<string, number> = {};
        sizes.forEach(sz => {
          sizeQtys[sz] = item.sizeQuantities?.[sz] || item.size_quantities?.[sz] || 0;
        });
        let totalQty = sizes.reduce((sum, sz) => sum + (sizeQtys[sz] || 0), 0);
        const itemQty = Number(item.quantity || item.qty || 0);
        if (totalQty === 0 && itemQty > 0) {
          const codeStr = item.code || item.item_code || "";
          const szMatch = codeStr.match(/-([A-Za-z0-9]+)$/);
          const matchedSz = szMatch ? szMatch[1].toUpperCase() : null;
          if (matchedSz && sizes.includes(matchedSz)) {
            sizeQtys[matchedSz] = itemQty;
            totalQty = itemQty;
          } else {
            const midSz = sizes[Math.floor(sizes.length / 2)] || sizes[0];
            sizeQtys[midSz] = itemQty;
            totalQty = itemQty;
          }
        }
        const rate = parseFloat(item.rate || item.unit_price || item.price || 0);

        // Lookup matching product in catalog index
        const matchedProduct = products.find(
          p => p.id === item.product_id || p.code === rawCode || (item.barcode && p.barcode === item.barcode)
        );
        const matchedVariant = art ? resolveVariantFromIndex(articleCatalogIndex, art, col, "") : undefined;
        const origProduct = matchedProduct || matchedVariant?.originalProduct;
        const fwAttrs = resolveFootwearAttributes(origProduct || item);

        if (!groupedPoMap.has(groupKey)) {
          groupedPoMap.set(groupKey, {
            id: `sw-line-${groupedPoMap.size + 1}`,
            sNo: groupedPoMap.size + 1,
            itemCode: rawCode,
            articleNo: art,
            barcode: item.barcode || origProduct?.barcode || "",
            product: rawName,
            brand: item.brand || origProduct?.brand || "",
            style: art,
            shade: col,
            unit: item.unit || item.uom || "Pair",
            sizeQuantities: sizeQtys,
            totalQty,
            rate,
            stockOnHand: Number(item.stock || item.stockOnHand || origProduct?.stock || 0),
            taxPercent: Number(item.tax_percent || item.taxPercent || header.commonTaxPercent),
            netValue: totalQty * rate,
            deliveryDate: item.delivery_date || header.deliveryDate,
            originalProduct: origProduct,
            imageUrl: item.imageUrl || origProduct?.primaryImageUrl,
            heelType: fwAttrs.heels !== "—" ? fwAttrs.heels : undefined,
            upperMaterial: fwAttrs.upperMaterial !== "—" ? fwAttrs.upperMaterial : undefined,
            outsoleMaterial: fwAttrs.outsole !== "—" ? fwAttrs.outsole : undefined,
          });
        } else {
          const existing = groupedPoMap.get(groupKey)!;
          sizes.forEach(sz => {
            if (sizeQtys[sz]) {
              existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + sizeQtys[sz];
            }
          });
          existing.totalQty = sizes.reduce((sum, sz) => sum + (existing.sizeQuantities[sz] || 0), 0);
          existing.netValue = existing.totalQty * existing.rate;
          if (!existing.barcode && (item.barcode || origProduct?.barcode)) {
            existing.barcode = item.barcode || origProduct?.barcode;
          }
          if (!existing.originalProduct && origProduct) existing.originalProduct = origProduct;
          if (!existing.heelType && fwAttrs.heels !== "—") existing.heelType = fwAttrs.heels;
          if (!existing.upperMaterial && fwAttrs.upperMaterial !== "—") existing.upperMaterial = fwAttrs.upperMaterial;
          if (!existing.outsoleMaterial && fwAttrs.outsole !== "—") existing.outsoleMaterial = fwAttrs.outsole;
          if (!existing.imageUrl && (item.imageUrl || origProduct?.primaryImageUrl)) {
            existing.imageUrl = item.imageUrl || origProduct?.primaryImageUrl;
          }
        }
      });

      const newLines: SizewisePOLine[] = Array.from(groupedPoMap.values()).map((l, i) => ({
        ...l,
        sNo: i + 1,
        id: `sw-line-${i + 1}`,
      }));

      setLines(newLines);
      onNotification?.("PO Copied", `Successfully loaded ${newLines.length} item(s) from PO ${prevOrderSummary.order_no || fullPo.order_no}.`, "success");
    } catch (err: any) {
      onNotification?.("Error", `Failed to copy previous PO: ${err.message || "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  }, [sizes, header.supplierId, header.commonTaxPercent, header.deliveryDate, suppliersList, onNotification]);

  const requestCopyPreviousPO = useCallback(() => {
    setShowMoreActions(false);
    const populatedCount = lines.filter(l => Boolean(l.itemCode || l.totalQty > 0)).length;
    if (populatedCount === 0) {
      executeCopyPreviousPO();
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Copy Previous Purchase Order?",
      message: `Loading items from the previous Purchase Order will replace the ${populatedCount} item(s) currently in this workspace. Do you wish to continue?`,
      confirmLabel: "Replace & Copy",
      variant: "warning",
      onConfirm: () => executeCopyPreviousPO(),
    });
  }, [lines, executeCopyPreviousPO]);

  // ── Phase 2: Statutory Print Data Mapping ──────────────────────────────
  const printHeader: PurchaseOrderHeader = useMemo(() => ({
    documentType: (header.documentType as any) || "Purchase Order",
    prefix: header.prefix,
    orderNumber: header.orderNumber,
    orderDate: header.orderDate,
    supplierId: header.supplierId,
    supplierName: header.supplierName || selectedSupplier?.name || "Selected Supplier",
    billTo: "Main Store",
    deliveryDate: header.deliveryDate,
    leadTimeDays: header.leadTimeDays,
    deliveryLocation: header.deliveryLocation,
    commonTaxPercent: header.commonTaxPercent || 5,
    paymentTerms: header.paymentTerms || selectedSupplier?.payment_terms || "120 Days",
    freightCharges: header.freightCharges,
    specialInstructions: header.specialInstructions,
    supplierReference: header.supplierReference,
    currency: header.currency,
    buyer: header.buyer,
    department: header.department,
    freightAmount: header.freightAmount,
    otherCharges: header.otherCharges,
    businessTerms: header.businessTerms ?? DEFAULT_BUSINESS_TERMS,
  }), [header, selectedSupplier]);

  const printLineItems: PurchaseOrderLineItem[] = useMemo(() => {
    return lines.filter(l => Boolean((l.itemCode || l.articleNo) && l.totalQty > 0)).flatMap((l, idx) => {
      const activeSizes = Object.entries(l.sizeQuantities).filter(([_, qty]) => qty > 0);
      if (activeSizes.length === 0) {
        return [{
          id: `${l.id}-1`,
          sNo: idx + 1,
          stockNo: l.itemCode,
          barcode: l.barcode,
          product: l.product,
          brand: l.brand,
          style: l.style,
          shade: l.shade,
          size: "",
          fibre: "",
          colourBase: l.shade,
          styling: l.style,
          rate: l.rate,
          orderQty: l.totalQty,
          freeQty: 0,
          unit: l.unit,
          discountPercent: 0,
          discountAmount: 0,
          value: l.totalQty * l.rate,
          stockOnHand: l.stockOnHand,
          taxPercent: l.taxPercent,
          taxAmount: (l.totalQty * l.rate * l.taxPercent) / 100,
          addOnPercent: 0,
          addOnAmount: 0,
          totalValue: l.netValue + ((l.totalQty * l.rate * l.taxPercent) / 100),
          deliveryDate: l.deliveryDate,
          originalProduct: l.originalProduct,
          imageUrl: l.imageUrl || resolveLineImage(l, articleImageMap),
          photoUrl: l.imageUrl || resolveLineImage(l, articleImageMap),
          heelType: (l as any).heelType || (l as any).heel_type || l.originalProduct?.attributes?.heel_type || (l.originalProduct as any)?.heel_type,
          upperMaterial: (l as any).upperMaterial || (l as any).upper_material || l.originalProduct?.attributes?.upper_material || (l.originalProduct as any)?.upper_material,
          outsoleMaterial: (l as any).outsoleMaterial || (l as any).outsole_material || l.originalProduct?.attributes?.outsole_material || (l.originalProduct as any)?.outsole_material,
        }];
      }
      return activeSizes.map(([sz, qty]) => ({
        id: `${l.id}-${sz}`,
        sNo: idx + 1,
        stockNo: l.itemCode,
        barcode: l.barcode,
        product: l.product,
        brand: l.brand,
        style: l.style,
        shade: l.shade,
        size: sz,
        fibre: "",
        colourBase: l.shade,
        styling: l.style,
        rate: l.rate,
        orderQty: qty,
        freeQty: 0,
        unit: l.unit,
        discountPercent: 0,
        discountAmount: 0,
        value: qty * l.rate,
        stockOnHand: l.stockOnHand,
        taxPercent: l.taxPercent,
        taxAmount: (qty * l.rate * l.taxPercent) / 100,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: qty * l.rate * (1 + l.taxPercent / 100),
        deliveryDate: l.deliveryDate,
        originalProduct: l.originalProduct,
        imageUrl: l.imageUrl || resolveLineImage(l, articleImageMap),
        photoUrl: l.imageUrl || resolveLineImage(l, articleImageMap),
        heelType: (l as any).heelType || (l as any).heel_type || l.originalProduct?.attributes?.heel_type || (l.originalProduct as any)?.heel_type,
        upperMaterial: (l as any).upperMaterial || (l as any).upper_material || l.originalProduct?.attributes?.upper_material || (l.originalProduct as any)?.upper_material,
        outsoleMaterial: (l as any).outsoleMaterial || (l as any).outsole_material || l.originalProduct?.attributes?.outsole_material || (l.originalProduct as any)?.outsole_material,
      }));
    });
  }, [lines, articleImageMap]);

  const printSizePivotRows: PurchaseOrderSizePivotRow[] = useMemo(() => {
    return groupedDisplayLines.filter(g => Boolean((g.itemCode || g.articleNo) && g.totalQty > 0)).map(g => ({
      id: g.groupKey,
      sNo: g.sNo,
      articleNo: g.articleNo || g.itemCode,
      product: g.product,
      brand: g.brand,
      style: g.style,
      color: g.shade,
      sizeQuantities: g.sizeQuantities,
      totalQty: g.totalQty,
      gstPercent: g.taxPercent,
      rate: g.rate,
      totalValue: g.netValue,
      taxAmount: (g.totalQty * g.rate * g.taxPercent) / 100,
      imageUrl: g.imageUrl || resolveLineImage({ articleNo: g.articleNo, itemCode: g.itemCode, shade: g.shade }, articleImageMap),
      photoUrl: g.imageUrl || resolveLineImage({ articleNo: g.articleNo, itemCode: g.itemCode, shade: g.shade }, articleImageMap),
      originalProduct: g.originalProduct,
      heelType: (g as any).heelType || (g as any).heel_type || g.originalProduct?.attributes?.heel_type || (g.originalProduct as any)?.heel_type,
      upperMaterial: (g as any).upperMaterial || (g as any).upper_material || g.originalProduct?.attributes?.upper_material || (g.originalProduct as any)?.upper_material,
      outsoleMaterial: (g as any).outsoleMaterial || (g as any).outsole_material || g.originalProduct?.attributes?.outsole_material || (g.originalProduct as any)?.outsole_material,
    }));
  }, [groupedDisplayLines, articleImageMap]);

  // ── Import via Global Grid Input & Resolution Standard ──────────────────
  const handleGlobalGridImportCommit = (
    committedRows: ParsedGridRow[],
    mode: GridImportMode
  ) => {
    const incomingLines = mapParsedGridRowsToSizewiseLines(
      committedRows,
      sizes,
      header.deliveryDate,
      header.commonTaxPercent,
      mode === "REPLACE" ? 0 : lines.filter((l) => l.itemCode).length
    );

    const updatedLines = mergeSizewisePOLines(lines, incomingLines, mode, sizes);
    setLines(updatedLines);
    setIsGlobalImportOpen(false);
    setInitialImportText(undefined);
    onNotification?.(
      "Import Successful",
      `Processed ${committedRows.length} item(s) into Purchase Order (${mode} mode).`,
      "success"
    );
  };

  // Legacy file picker adapter: route file text directly to GlobalGridImportModal
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setInitialImportText(text);
        setIsGlobalImportOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Intercept table clipboard paste (Ctrl+V) for multi-line or delimited text
  const handleTableContainerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === "input" || targetTag === "textarea") {
      return;
    }
    const pastedText = e.clipboardData?.getData("text/plain");
    if (!pastedText) return;

    const isMultiLine = pastedText.includes("\n") || pastedText.includes("\r");
    const isDelimited =
      pastedText.includes("\t") ||
      pastedText.includes(",") ||
      pastedText.includes("~") ||
      pastedText.includes("|");

    if (isMultiLine || isDelimited) {
      e.preventDefault();
      setInitialImportText(pastedText);
      setIsGlobalImportOpen(true);
    }
  };

  // ── Save PO ───────────────────────────────────────────────────────────
  const handleSavePO = async (mode: "draft" | "confirm") => {
    const activeLines = lines.filter(l => (l.itemCode || l.articleNo || l.style) && l.totalQty > 0);
    if (!header.supplierId) {
      onNotification?.("Supplier Required", "Please select a supplier.", "error");
      return;
    }
    if (activeLines.length === 0) {
      onNotification?.("No Items", "Add at least one line item with valid article/code and size quantities.", "error");
      return;
    }

    // Comprehensive validations
    for (const l of activeLines) {
      const art = (l.articleNo || l.style || "").trim();
      const code = (l.itemCode || "").trim();
      if (!art && !code) {
        onNotification?.("Validation Error", `Row #${l.sNo}: Article / Item Code is required.`, "error");
        return;
      }
      if (l.totalQty <= 0) {
        onNotification?.("Validation Error", `Row #${l.sNo}: Order quantity must be greater than zero.`, "error");
        return;
      }
      if (l.rate < 0) {
        onNotification?.("Validation Error", `Row #${l.sNo}: Unit rate cannot be negative.`, "error");
        return;
      }
      if (l.taxPercent < 0 || l.taxPercent > 28) {
        onNotification?.("Validation Error", `Row #${l.sNo}: Tax % must be between 0% and 28%.`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      const rawPrefix = (header.prefix || "PO").trim();
      const rawNum = (header.orderNumber || "1").trim();
      const orderNo = (rawNum.startsWith(rawPrefix) || rawNum.includes("/"))
        ? rawNum
        : `${rawPrefix}-${rawNum}`;
      const commercialTerms = {
        payment_terms: header.paymentTerms,
        freight_terms: header.freightCharges,
        delivery_terms: header.deliveryTerms || ((header.freightCharges || "").toLowerCase().includes("buyer") || (header.freightCharges || "").toLowerCase().includes("to-pay") ? "Ex-Factory" : "Door Delivery"),
        currency: header.currency,
        buyer: header.buyer,
        department: header.department,
        special_instructions: header.specialInstructions,
        supplier_reference: header.supplierReference,
        business_terms: header.businessTerms,
        delivery_location: header.deliveryLocation,
        warehouse_id: header.warehouseId,
      };
      const payload = {
        order_no: orderNo,
        order_date: header.orderDate,
        supplier_id: header.supplierId,
        warehouse_id: header.warehouseId || undefined,
        delivery_date: header.deliveryDate,
        status: mode === "confirm" ? "confirmed" : "draft",
        commercial_terms: commercialTerms,
        rule_snapshots: {
          commercial_terms: commercialTerms,
        },
        notes: [
          header.specialInstructions && `Instructions: ${header.specialInstructions}`,
          header.paymentTerms && `Payment: ${header.paymentTerms}`,
          header.freightCharges && `Freight: ${header.freightCharges}`,
          (header.deliveryTerms || commercialTerms.delivery_terms) && `Delivery: ${header.deliveryTerms || commercialTerms.delivery_terms}`,
          header.currency && `Currency: ${header.currency}`,
          header.buyer && `Buyer: ${header.buyer}`,
          header.department && `Department: ${header.department}`,
          header.supplierReference && `Ref: ${header.supplierReference}`,
          header.remarks && `Remarks: ${header.remarks}`,
          header.internalNotes && `Internal: ${header.internalNotes}`,
        ]
          .filter(Boolean)
          .join(" | "),
        items: activeLines.map(l => {
          const art = (l.articleNo || l.style || "").trim();
          const col = (l.shade || "").trim();
          const effectiveCode = (l.itemCode || "").trim() || (col ? `${art}-${col}` : art);
          const effectiveName = (l.product || "").trim() || (col ? `${art} ${col}` : art);
          return {
            product_id: l.originalProduct?.id || undefined,
            variant_id: (l.originalProduct as any)?.item_variant_id || (l.originalProduct as any)?.variant_id || undefined,
            item_id: (l.originalProduct as any)?.item_id || undefined,
            code: effectiveCode,
            name: effectiveName,
            product_ref: effectiveCode,
            product_name: effectiveName,
            quantity: l.totalQty,
            cost_price: l.rate,
            rate: l.rate,
            gst_rate: l.taxPercent,
            tax_percent: l.taxPercent,
            total_value: l.netValue,
            size_quantities: l.sizeQuantities,
            delivery_date: l.deliveryDate,
            unit: l.unit,
          };
        }),
      };

      let res: any;
      if (editingOrderId) {
        res = await apiFetchV1(`/purchase/orders/${editingOrderId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetchV1("/purchase/orders/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      if (mode === "confirm") {
        const orderId = editingOrderId || res?.id;
        if (!orderId) {
          throw new Error("PO was saved, but the server did not return an ID for submission.");
        }
        try {
          await apiFetchV1(`/purchase/orders/${orderId}/submit`, { method: "POST" });
          await apiFetchV1(`/purchase/orders/${orderId}/confirm`, {
            method: "POST",
            body: JSON.stringify({ notes: "Confirmed from Sizewise Matrix Studio" }),
          });
        } catch (confirmError: unknown) {
          const message = confirmError instanceof Error ? confirmError.message : "Submission or confirmation failed.";
          onNotification?.(
            "Confirmation Failed",
            `PO ${res?.order_no || orderNo} was saved, but the submit/confirm workflow did not complete: ${message}`,
            "error"
          );
          return;
        }
      }

      if (res?.id || res?.order_no) {
        setSavedOrderNo(res.order_no || orderNo);
        onNotification?.(
          mode === "confirm" ? "PO Confirmed" : (editingOrderId ? "Draft Updated" : "Draft Saved"),
          `Purchase Order ${res.order_no || orderNo} ${mode === "confirm" ? "confirmed" : (editingOrderId ? "updated" : "saved as draft")} successfully.`,
          "success"
        );
      }
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes("already exists")) {
        const rawPrefix = (header.prefix || "PO").trim();
        const rawNum = (header.orderNumber || "1").trim();
        const attemptedNo = (rawNum.startsWith(rawPrefix) || rawNum.includes("/"))
          ? rawNum
          : `${rawPrefix}-${rawNum}`;
        setDuplicateOrderNo(attemptedNo);
        const sug =
          err?.detail?.suggested_number ||
          err?.body?.detail?.suggested_number ||
          err?.body?.suggested_number ||
          err?.detail?.suggested_order_no ||
          err?.body?.suggested_order_no ||
          null;
        setSuggestedOrderNo(sug);
        onNotification?.("Duplicate PO Number", `PO ${attemptedNo} already exists.${sug ? ` Suggested: ${sug}` : ""}`, "error");
      } else {
        onNotification?.("Save Failed", err?.message || "Failed to save purchase order.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Computed totals ───────────────────────────────────────────────────
  const { perSizeTotals, grandTotalQty, grossValue, totalTax, netOrderValue, totalItems, sizePercents } =
    useMemo(
      () => calculateSizewiseSummaryTotals(groupedDisplayLines as any, sizes, header.freightAmount, header.otherCharges),
      [groupedDisplayLines, sizes, header.freightAmount, header.otherCharges]
    );

  const activeLineCount = useMemo(() => groupedDisplayLines.filter(g => (g.itemCode || g.articleNo) && g.totalQty > 0).length, [groupedDisplayLines]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSavePO("draft");
      }
      if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        setShowCommercialDrawer(prev => !prev);
      }
      if (e.key === "F4") {
        e.preventDefault();
        updateLine(activeRowIndex, {
          itemCode: "",
          product: "",
          sizeQuantities: sizes.reduce<Record<string, number>>((a, s) => { a[s] = 0; return a; }, {}),
          totalQty: 0,
          netValue: 0,
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeRowIndex, sizes]);

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-sans" role="main">

      {/* ── 1. PO Header Bar ──────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3 shrink-0">
        {/* Edit Mode Notification Banner */}
        {editingOrderNo && (
          <div className="mb-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3.5 py-1.5 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-base">edit_note</span>
              <span>Editing Purchase Order:</span>
              <strong className="font-mono bg-indigo-100 dark:bg-indigo-900/80 text-indigo-900 dark:text-indigo-200 px-2 py-0.5 rounded font-bold">{editingOrderNo}</strong>
              <span className="text-slate-400">· Status:</span>
              <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">{editingStatus || "DRAFT"}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingOrderId(null);
                setEditingOrderNo(null);
                setEditingStatus(null);
                onClearOrderToEdit?.();
                onNotification?.("Exited Edit Mode", "Switched back to new PO workspace.", "info");
              }}
              className="text-xs text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">close</span> Exit Edit Mode (New PO)
            </button>
          </div>
        )}

        {/* Title row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-white text-[18px]">shopping_cart</span>
              </div>
              <div>
                <h1 className="font-extrabold text-slate-800 dark:text-slate-100 text-base leading-none">Purchase Order</h1>
                {/* Phase 1: composite read-only document identity — no editable Prefix/Number */}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 font-bold tracking-wide">
                  {header.prefix}-{header.orderNumber}
                  <span className="font-normal text-slate-400 ml-1">· {header.orderDate}</span>
                </p>
              </div>
            </div>
            {editingStatus ? (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                editingStatus === "CONFIRMED"
                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
                  : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${editingStatus === "CONFIRMED" ? "bg-emerald-500" : "bg-amber-500"}`} />
                {editingStatus}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Draft
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[12px]">straighten</span>
              Sizewise
            </span>
          </div>
          {/* Phase 1: header quick actions — Save removed (footer is single save path) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="sw-new-po-btn"
              onClick={handleNewPO}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg transition text-xs shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-blue-500">add</span> New
            </button>
            <button
              type="button"
              id="sw-open-po-btn"
              onClick={() => { setShowRecallModal(true); fetchRecentOrders(); }}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg transition text-xs shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-500">folder_open</span> Open
            </button>
            <button type="button" id="sw-print-po-btn" onClick={() => setShowPrintPreview(true)} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg transition text-xs shadow-2xs cursor-pointer">
              <span className="material-symbols-outlined text-[16px] text-slate-500">print</span> Print
            </button>
            <button type="button" className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded-lg transition text-xs shadow-2xs">
              <span className="material-symbols-outlined text-[16px]">more_vert</span>
            </button>
          </div>
        </div>

        {/* Document meta fields */}
        <div className="flex items-end flex-wrap gap-3">
          {/* Type */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Type</label>
            <select
              value={header.documentType}
              onChange={e => setHeader(h => ({ ...h, documentType: e.target.value }))}
              className="border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 h-7 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 font-medium text-xs min-w-[140px]"
            >
              <option>Purchase Order</option>
              <option>Indent</option>
            </select>
          </div>
          {/* Phase 1: Document identity — composite read-only badge, Prefix+Number fields removed */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">PO Number</label>
            <div
              id="sw-po-order-number-badge"
              title="Document number is assigned automatically. Contact your administrator to change the series."
              className="inline-flex items-center gap-1.5 h-7 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-xs text-slate-700 dark:text-slate-200 select-all cursor-default"
            >
              <span className="material-symbols-outlined text-[13px] text-slate-400">tag</span>
              {header.prefix}-{header.orderNumber}
            </div>
          </div>
          {/* Date */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Date</label>
            <input
              type="date"
              value={header.orderDate}
              onChange={e => {
                const orderDate = e.target.value;
                setHeader(h => ({
                  ...h,
                  orderDate,
                  deliveryDate: addDaysToDate(orderDate, h.leadTimeDays),
                }));
              }}
              className="border border-slate-300 dark:border-slate-700 rounded-lg px-2 h-7 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono outline-none focus:border-indigo-500 text-xs"
            />
          </div>
          {/* Supplier — Proportionate max-w-md (448px) on desktop per Decision D */}
          <div className="flex-1 min-w-[240px] max-w-md">
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">
              Supplier / Vendor <span className="text-rose-500">*</span>
            </label>
            <SupplierSelect
              id="sw-supplier-select"
              suppliers={suppliersList}
              value={header.supplierId}
              disabled={suppliersLoading}
              compact={true}
              placeholder={suppliersLoading ? "Loading suppliers..." : "Select or search vendor..."}
              onChange={(supplierId, sel) => {
                const defaults: Partial<CommercialDeliveryData> = {
                  paymentTerms: sel?.payment_terms || (sel?.payment_terms_days ? `${sel.payment_terms_days} Days` : undefined),
                  freightCharges: sel?.freight_terms,
                  deliveryTerms: sel?.delivery_terms || (sel?.freight_terms ? ((sel.freight_terms.toLowerCase().includes("buyer") || sel.freight_terms.toLowerCase().includes("to-pay")) ? "Ex-Factory" : "Door Delivery") : undefined),
                  currency: sel?.currency,
                  buyer: sel?.buyer,
                  department: sel?.department,
                  specialInstructions: sel?.special_instructions !== undefined ? sel.special_instructions : undefined,
                  businessTerms: (sel as any)?.business_terms || sel?.special_instructions || undefined,
                };
                setSupplierCommercialDefaults(defaults);
                setHeader(h => ({
                  ...h,
                  supplierId,
                  supplierName: sel?.name || sel?.company_name || "",
                  paymentTerms: defaults.paymentTerms || h.paymentTerms,
                  freightCharges: defaults.freightCharges || h.freightCharges,
                  deliveryTerms: defaults.deliveryTerms || h.deliveryTerms,
                  currency: defaults.currency || h.currency,
                  buyer: defaults.buyer || h.buyer,
                  department: defaults.department || h.department,
                  specialInstructions: defaults.specialInstructions !== undefined ? defaults.specialInstructions : h.specialInstructions,
                  businessTerms: defaults.businessTerms !== undefined ? defaults.businessTerms : h.businessTerms,
                }));
              }}
            />
          </div>
          {/* Delivery Date */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Delivery Date</label>
            <input
              type="date"
              value={header.deliveryDate}
              onChange={e => setHeader(h => ({ ...h, deliveryDate: e.target.value }))}
              className="border border-slate-300 dark:border-slate-700 rounded-lg px-2 h-7 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono outline-none focus:border-indigo-500 text-xs"
            />
          </div>
          {/* Lead Time */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Lead Time</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="1"
                list="sw-lead-time-opts"
                value={header.leadTimeDays}
                onChange={e => {
                  const leadTimeDays = Math.max(0, parseInt(e.target.value, 10) || 0);
                  setHeader(h => ({ ...h, leadTimeDays, deliveryDate: addDaysToDate(h.orderDate, leadTimeDays) }));
                }}
                className="border border-slate-300 dark:border-slate-700 rounded-lg px-2 h-7 w-14 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold font-mono outline-none focus:border-indigo-500 text-xs"
              />
              <datalist id="sw-lead-time-opts">
                {LEAD_TIME_OPTIONS.map(d => <option key={d} value={d} />)}
              </datalist>
              <span className="text-slate-500 font-medium">Days</span>
            </div>
          </div>
          {/* Commercial Terms & Delivery Details Drawer Trigger (Decision B) */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Commercial</label>
            <button
              type="button"
              id="sw-open-commercial-drawer-btn"
              onClick={() => setShowCommercialDrawer(prev => !prev)}
              className="flex items-center gap-1.5 h-7 px-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg transition text-xs shadow-2xs cursor-pointer"
              title="Open Commercial & Delivery terms drawer (Alt+C)"
            >
              <span className="material-symbols-outlined text-[15px] text-indigo-600">receipt_long</span>
              <span>Terms & Delivery</span>
              <kbd className="text-[9px] font-mono px-1 py-0.2 bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 rounded font-bold">Alt+C</kbd>
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <nav className="flex items-center gap-6 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {[
            { id: "items", label: `1. Items (${lines.filter(l => Boolean(l.itemCode)).length})`, icon: "list_alt" },
            { id: "visual", label: `2. Images & Articles (${lines.filter(l => Boolean(l.itemCode)).length})`, icon: "photo_library", isNew: true },
            { id: "delivery", label: "3. Delivery & Tax", icon: "local_shipping" },
            { id: "other", label: "4. Other Details", icon: "description" },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              id={`sw-subtab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 pb-1.5 font-semibold transition-all relative ${
                activeTab === tab.id
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
              {tab.label}
              {tab.isNew && (
                <span className="ml-1 text-[9px] bg-rose-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-2xs">
                  NEW
                </span>
              )}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* ── 2. ITEMS TAB ─────────────────────────────────────────────────── */}
      {activeTab === "items" && (
        <div className="flex flex-col flex-1 min-h-0">

          {/* ── Toolbar (7-Action Budget) ── */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0">
            {/* 1. Scan / Search Barcode (F2) */}
            <div className="relative flex items-center min-w-[240px]">
              <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[15px]">barcode_scanner</span>
              <input
                ref={toolbarSearchRef}
                type="text"
                value={toolbarSearch}
                onChange={e => setToolbarSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); handleBarcodeSearch(toolbarSearch); }
                }}
                placeholder="Scan Barcode / Search Item (F2)"
                className="w-full pl-8 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs outline-none focus:border-indigo-500 shadow-2xs"
              />
              {toolbarSearch && (
                <button type="button" onClick={() => setToolbarSearch("")} className="absolute right-2 text-slate-400 hover:text-slate-600 text-sm">×</button>
              )}
            </div>

            {/* 2. Add Item */}
            <button
              type="button"
              onClick={addBlankRow}
              className="flex items-center gap-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px] text-indigo-500">add</span>
              Add Item
            </button>

            {/* 3. Global Grid Import */}
            <button
              type="button"
              onClick={() => {
                setInitialImportText(undefined);
                setIsGlobalImportOpen(true);
              }}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs cursor-pointer"
              title="Universal Grid Import (Excel Paste, CSV, PDT, Barcode Scanner)"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-600">table_view</span>
              Global Import
            </button>
            <input ref={excelInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleExcelImport} className="hidden" />

            {/* 4. Size Scale Selector */}
            <div className="flex items-center gap-1.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg">
              <span className="material-symbols-outlined text-[15px] text-indigo-600">straighten</span>
              <span className="text-slate-600 dark:text-slate-300 font-bold text-xs whitespace-nowrap">Size Scale:</span>
              <select
                id="sw-size-scale-select"
                value={selectedScaleKey}
                onChange={e => handleScaleSelectChange(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-0.5 text-xs font-bold text-indigo-900 dark:text-indigo-200 outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                {Object.entries(SIZE_SCALE_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Price List */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium whitespace-nowrap text-xs">Price List:</span>
              <select
                value={header.priceList}
                onChange={e => setHeader(h => ({ ...h, priceList: e.target.value }))}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 shadow-2xs"
              >
                {PRICE_LIST_OPTIONS.map(pl => (
                  <option key={pl} value={pl}>{pl}</option>
                ))}
              </select>
            </div>

            {/* 6. Delete Row */}
            <button
              type="button"
              disabled={lines.length === 0}
              onClick={() => requestDeleteRow(activeRowIndex)}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-300 dark:border-slate-600 hover:border-rose-300 dark:hover:border-rose-800 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-800 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200 disabled:hover:border-slate-300 dark:disabled:hover:border-slate-600"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              Delete Row
            </button>

            {/* 6b. Recommend Ratio Assortment */}
            <div className="relative">
              <button
                type="button"
                id="sw-toolbar-recommend-btn"
                disabled={lines.length === 0}
                onClick={() => setBatchRecommendOpen(!batchRecommendOpen)}
                className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs disabled:opacity-40"
                title="Recommend Size Assortment Curves"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-600">auto_fix_high</span>
                Recommend Ratio
                <span className="material-symbols-outlined text-[14px]">expand_more</span>
              </button>

              {batchRecommendOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Curve Distribution
                  </div>
                  <button
                    type="button"
                    id="sw-recommend-curve-bell-btn"
                    onClick={() => handleApplyBatchRecommendation("bell")}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 font-medium transition cursor-pointer"
                  >
                    <span>🔔 Bell Curve (Standard Retail)</span>
                  </button>
                  <button
                    type="button"
                    id="sw-recommend-curve-core-btn"
                    onClick={() => handleApplyBatchRecommendation("core")}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 font-medium transition cursor-pointer"
                  >
                    <span>🎯 Core Sizes (Mid-heavy)</span>
                  </button>
                  <button
                    type="button"
                    id="sw-recommend-curve-uniform-btn"
                    onClick={() => handleApplyBatchRecommendation("uniform")}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 font-medium transition cursor-pointer"
                  >
                    <span>⚖️ Uniform (Equal per size)</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* View Mode Toggle: Article & Color vs Code & Desc */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                id="sw-grid-mode-article-color-btn"
                onClick={() => setGridDisplayMode("article_color")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  gridDisplayMode === "article_color"
                    ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs border border-indigo-100 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                title="Fashion & Footwear Mode: Show Article/Style and Color/Shade alongside Sizes"
              >
                <span className="material-symbols-outlined text-[14px]">palette</span>
                <span>Article &amp; Color</span>
                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1 py-0.2 rounded font-extrabold uppercase tracking-wide">
                  Recommended
                </span>
              </button>
              <button
                type="button"
                id="sw-grid-mode-code-desc-btn"
                onClick={() => setGridDisplayMode("item_code_desc")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  gridDisplayMode === "item_code_desc"
                    ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs border border-indigo-100 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                title="Standard SKU Mode: Show Item Code and Product Description"
              >
                <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                <span>Code &amp; Desc</span>
              </button>
            </div>

            {/* 7. More Actions Popover (Overflow Menu) */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                id="sw-toolbar-more-btn"
                onClick={() => setShowMoreActions(prev => !prev)}
                className="flex items-center gap-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-2.5 py-1.5 rounded-lg text-xs transition shadow-2xs"
                title="More Actions"
              >
                <span className="material-symbols-outlined text-[16px] text-slate-500">more_vert</span>
                <span>Actions</span>
              </button>

              {showMoreActions && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={requestCopyPreviousPO}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-2 font-medium transition"
                  >
                    <span className="material-symbols-outlined text-[16px] text-blue-500">content_copy</span>
                    Copy Previous PO
                  </button>
                  <button
                    type="button"
                    onClick={handleExportMatrixCSV}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-2 font-medium transition"
                  >
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">download</span>
                    Export Matrix to CSV
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={requestClearAllLines}
                    className="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 font-medium transition"
                  >
                    <span className="material-symbols-outlined text-[16px] text-rose-500">clear_all</span>
                    Clear All Rows
                  </button>
                </div>
              )}
            </div>

            {/* Item Finder */}
            <button
              type="button"
              onClick={() => setShowBrowseModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">manage_search</span>
              Item Finder
            </button>
          </div>

          {/* ── Grid / Empty State ── */}
          <div
            className="flex-1 overflow-auto relative focus:outline-none"
            tabIndex={0}
            onPaste={handleTableContainerPaste}
          >

            {/* Phase 1: Empty state — shown when no items have been added */}
            {lines.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center select-none">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-indigo-400 text-[36px]">inventory_2</span>
                </div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">No items added yet</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-5 max-w-xs">
                  Scan a barcode, search for an item, or paste from Excel (Ctrl+V) to start adding products.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={addBlankRow}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add Item
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInitialImportText(undefined);
                      setIsGlobalImportOpen(true);
                    }}
                    className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-lg text-xs transition shadow-sm cursor-pointer"
                    title="Universal Grid Import (Excel Paste, CSV, PDT, Barcode Scanner)"
                  >
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">table_view</span>
                    Global Import
                  </button>
                  <button
                    type="button"
                    id="sw-empty-f2-btn"
                    onClick={() => {
                      // Use the platform F2 dispatcher — same path as keyboard F2.
                      // This ensures F2-button and F2-key share one code path.
                      setActiveRowIndex(0);
                      f2Dispatcher.openLookup("variant", f2Adapter);
                    }}
                    className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-lg text-xs transition shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px] text-indigo-500">manage_search</span>
                    F2 / Scan
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-500 dark:text-slate-400 font-mono text-[10px]">F2</kbd>
                  Press F2 on keyboard to open item search
                </p>
              </div>
            )}

            {/* Grid table — always rendered so rows can be added; hidden via CSS when empty */}
            <table
              className={`w-full border-collapse text-xs min-w-[1100px] ${lines.length === 0 ? "hidden" : ""}`}
              id="sw-items-grid"
            >
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-300 dark:border-slate-700">
                <tr>
                  <th className="p-2 w-8 text-center border-r border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">#</th>
                  {gridDisplayMode === "article_color" ? (
                    <>
                      <th className="p-2 min-w-[120px] border-r border-slate-200 dark:border-slate-700">
                        Article / Style
                        <div className="text-[9px] text-slate-400 font-normal normal-case tracking-normal mt-0.5">Style / Model / SKU</div>
                      </th>
                      <th className="p-2 min-w-[150px] border-r border-slate-200 dark:border-slate-700">
                        Color / Shade
                        <div className="text-[9px] text-slate-400 font-normal normal-case tracking-normal mt-0.5">Colorway / Finish / UOM</div>
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="p-2 min-w-[100px] border-r border-slate-200 dark:border-slate-700">Item Code</th>
                      <th className="p-2 min-w-[180px] border-r border-slate-200 dark:border-slate-700">
                        Product Description
                        <div className="text-[9px] text-slate-400 font-normal normal-case tracking-normal mt-0.5">Brand / Style / Shade</div>
                      </th>
                    </>
                  )}
                  {/* Size columns group header */}
                  <th
                    colSpan={sizes.length + 1}
                    className="p-1 text-center border-r border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                  >
                    Size-wise Order Quantity
                  </th>
                  <th className="p-2 min-w-[80px] text-right border-r border-slate-200 dark:border-slate-700">Rate (₹)</th>
                  <th className="p-2 min-w-[70px] text-right border-r border-slate-200 dark:border-slate-700">Stock On Hand</th>
                  <th className="p-2 min-w-[55px] text-right border-r border-slate-200 dark:border-slate-700">Tax %</th>
                  <th className="p-2 min-w-[90px] text-right border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-800 dark:text-slate-100">Net Value (₹)</th>
                  <th className="p-2 min-w-[110px] text-center border-r border-slate-200 dark:border-slate-700">Delivery Date</th>
                  <th className="p-2 min-w-[95px] text-center">Action</th>
                </tr>
                {/* Size sub-headers */}
                <tr className="bg-indigo-50 dark:bg-indigo-950/40 border-b border-slate-200 dark:border-slate-700">
                  {/* spacers for fixed left cols */}
                  <td className="border-r border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700" />
                  <td className="border-r border-slate-200 dark:border-slate-700" />
                  <td className="border-r border-slate-200 dark:border-slate-700" />
                  {/* size labels */}
                  {sizes.map(sz => (
                    <th key={sz} className="p-1.5 text-center font-bold font-mono text-indigo-800 dark:text-indigo-300 border-r border-slate-200 dark:border-slate-700 w-14 text-[11px]">
                      {sz}
                    </th>
                  ))}
                  <th className="p-1.5 text-center font-bold text-indigo-800 dark:text-indigo-300 border-r border-slate-200 dark:border-slate-700 text-[11px] bg-indigo-100 dark:bg-indigo-900/60">
                    Total
                  </th>
                  {/* spacers for right cols */}
                  <td className="border-r border-slate-200 dark:border-slate-700" />
                  <td className="border-r border-slate-200 dark:border-slate-700" />
                  <td className="border-r border-slate-200 dark:border-slate-700" />
                  <td className="border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80" />
                  <td className="border-r border-slate-200 dark:border-slate-700" />
                  <td />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {groupedDisplayLines.map((group, idx) => {
                  const hasItem = !!(group.itemCode || group.articleNo || group.style);
                  const isActive = group.memberLineIndices.includes(activeRowIndex);
                  return (
                    <tr
                      key={group.groupKey}
                      onClick={() => setActiveRowIndex(group.primaryLineIndex)}
                      className={`transition-colors cursor-pointer ${
                        isActive
                          ? "bg-indigo-50/70 dark:bg-indigo-950/50"
                          : hasItem
                          ? "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40 opacity-75 hover:opacity-100"
                      }`}
                    >
                      {/* # */}
                      <td className="p-2 text-center text-slate-400 dark:text-slate-500 font-mono font-medium border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px]">
                        {group.sNo}
                      </td>

                      {gridDisplayMode === "article_color" ? (
                        <>
                          {/* Col 2: Article / Style */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title={group.imageUrl ? "Click to change/preview image" : "Attach image to article"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openImageModal(group.primaryLineIndex);
                                }}
                                className="w-7 h-7 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-indigo-500 flex items-center justify-center shrink-0 overflow-hidden group/thumb transition shadow-2xs cursor-pointer"
                              >
                                {group.imageUrl ? (
                                  <img
                                    src={group.imageUrl}
                                    alt={group.articleNo || group.itemCode}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = imageNotAvailablePlaceholder;
                                      e.currentTarget.onerror = null;
                                    }}
                                  />
                                ) : (
                                  <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover/thumb:text-indigo-600">
                                    add_photo_alternate
                                  </span>
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  id={`sw-article-${idx}`}
                                  list="sw-articles-datalist"
                                  value={group.articleNo || group.style || group.itemCode}
                                  placeholder="Article (e.g. SH-03)"
                                  onFocus={() => setActiveRowIndex(group.primaryLineIndex)}
                                  onChange={e => handleGroupArticleChange(group, e.target.value)}
                                  className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 rounded px-1.5 h-6 font-mono font-bold text-xs outline-none"
                                />
                                <div className="px-1 text-[9px] text-slate-400 font-mono truncate">
                                  {group.itemCode && group.itemCode !== (group.articleNo || group.style)
                                    ? group.itemCode
                                    : (group.brand ? `${group.brand}` : "Article / SKU")}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 3: Color / Shade */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 px-1">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                                style={{ backgroundColor: getShadeHex(group.shade) }}
                                title={group.shade ? `Color: ${group.shade}` : "Select color"}
                              />
                              <input
                                type="text"
                                id={`sw-shade-${idx}`}
                                list={`sw-colors-list-${idx}`}
                                value={group.shade || ""}
                                placeholder="Color (e.g. CREAM)"
                                onFocus={() => setActiveRowIndex(group.primaryLineIndex)}
                                onChange={e => handleGroupColorChange(group, e.target.value)}
                                className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 rounded px-1.5 h-6 font-semibold text-xs outline-none uppercase"
                              />
                              <datalist id={`sw-colors-list-${idx}`}>
                                {getAvailableColorsForArticle(articleCatalogIndex, group.articleNo || group.style).map(col => (
                                  <option key={col} value={col} />
                                ))}
                              </datalist>
                              {group.unit && (
                                <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold uppercase text-[9px] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 px-1 py-0.5 rounded shrink-0">
                                  {group.unit}
                                </span>
                              )}
                            </div>
                            <div className="px-2 text-[10px] text-slate-400 leading-tight truncate">
                              {group.product || `${group.articleNo || group.style || "Item"} - ${group.shade || "Standard"}`}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Col 2: Item Code */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title={group.imageUrl ? "Click to change/preview image" : "Attach image to article"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openImageModal(group.primaryLineIndex);
                                }}
                                className="w-7 h-7 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-indigo-500 flex items-center justify-center shrink-0 overflow-hidden group/thumb transition shadow-2xs cursor-pointer"
                              >
                                {group.imageUrl ? (
                                  <img
                                    src={group.imageUrl}
                                    alt={group.itemCode}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = imageNotAvailablePlaceholder;
                                      e.currentTarget.onerror = null;
                                    }}
                                  />
                                ) : (
                                  <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover/thumb:text-indigo-600">
                                    add_photo_alternate
                                  </span>
                                )}
                              </button>
                              <input
                                type="text"
                                id={`sw-itemcode-${idx}`}
                                list="sw-articles-datalist"
                                value={group.itemCode}
                                placeholder="F2 / Scan"
                                onFocus={() => setActiveRowIndex(group.primaryLineIndex)}
                                onChange={e => handleGroupArticleChange(group, e.target.value)}
                                className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 rounded px-1.5 h-7 font-mono font-bold text-xs outline-none"
                              />
                            </div>
                          </td>

                          {/* Col 3: Product Description */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <input
                              type="text"
                              value={group.product}
                              placeholder="Product name"
                              onFocus={() => setActiveRowIndex(group.primaryLineIndex)}
                              onChange={e => {
                                const newProd = e.target.value;
                                setLines(prev =>
                                  prev.map((l, i) => group.memberLineIndices.includes(i) ? { ...l, product: newProd } : l)
                                );
                              }}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 rounded px-2 h-6 font-medium text-xs outline-none"
                            />
                            <div className="px-2 text-[10px] text-slate-400 leading-tight truncate flex items-center justify-between">
                              <span className="truncate flex items-center gap-1.5">
                                {group.shade && (
                                  <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-1 py-0.2 rounded text-[9px]">
                                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: getShadeHex(group.shade) }} />
                                    {group.shade}
                                  </span>
                                )}
                                {[group.brand, group.style].filter(Boolean).join(" / ") || (!group.shade && <span className="italic">Brand / Style</span>)}
                              </span>
                              {group.unit && (
                                <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold uppercase text-[9px] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 px-1.5 py-0.5 rounded ml-1 shrink-0">
                                  {group.unit}
                                </span>
                              )}
                            </div>
                          </td>
                        </>
                      )}

                      {/* Size qty cells */}
                      {sizes.map(sz => {
                        const art = group.articleNo || group.style;
                        const availableSizes = art && group.shade
                          ? getAvailableSizesForArticleAndColor(articleCatalogIndex, art, group.shade)
                          : [];
                        const isSizeAvailable = !art || !group.shade || availableSizes.length === 0 || availableSizes.includes(sz);

                        return (
                          <td key={sz} className="p-0 border-r border-slate-100 dark:border-slate-800 text-center w-14">
                            <input
                              type="number"
                              min="0"
                              id={`sw-qty-${idx}-${sz}`}
                              value={group.sizeQuantities[sz] || ""}
                              placeholder={isSizeAvailable ? "–" : "✕"}
                              disabled={!isSizeAvailable}
                              title={!isSizeAvailable ? `Size ${sz} not available for ${art} in ${group.shade}` : undefined}
                              onFocus={() => setActiveRowIndex(group.primaryLineIndex)}
                              onChange={e => handleGroupSizeQtyChange(group, sz, parseInt(e.target.value, 10) || 0)}
                              className={`w-full border-none text-center h-8 font-mono font-bold text-xs outline-none ${
                                !isSizeAvailable
                                  ? "bg-slate-100/70 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed select-none"
                                  : (group.sizeQuantities[sz] || 0) > 0
                                  ? "bg-transparent text-indigo-700 dark:text-indigo-300 focus:bg-indigo-50 dark:focus:bg-indigo-950/50"
                                  : "bg-transparent text-slate-300 dark:text-slate-600 focus:bg-indigo-50 dark:focus:bg-indigo-950/50"
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* Total Qty */}
                      <td className="p-2 text-center font-mono font-extrabold text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/40 border-r border-slate-100 dark:border-slate-800 text-sm">
                        {group.totalQty || "–"}
                      </td>

                      {/* Rate */}
                      <td className="p-1 border-r border-slate-100 text-right">
                        <input
                          type="number"
                          id={`sw-rate-${idx}`}
                          min="0"
                          value={group.rate || ""}
                          placeholder="0.00"
                          onFocus={() => setActiveRowIndex(group.primaryLineIndex)}
                          onChange={e => handleGroupRateChange(group, parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 rounded px-2 h-7 font-mono font-bold text-xs text-right outline-none"
                        />
                      </td>

                      {/* Stock On Hand */}
                      <td className="p-2 text-right font-mono text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 text-[11px]">
                        {group.stockOnHand > 0 ? group.stockOnHand.toLocaleString("en-IN") : "–"}
                      </td>

                      {/* Tax % */}
                      <td className="p-1 border-r border-slate-100 text-right">
                        <input
                          type="number"
                          min="0"
                          value={group.taxPercent ?? 18}
                          onFocus={() => setActiveRowIndex(group.primaryLineIndex)}
                          onChange={e => handleGroupTaxChange(group, parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-none text-right px-1 h-6 font-mono text-xs text-slate-800 dark:text-slate-100 outline-none"
                        />
                      </td>

                      {/* Net Value */}
                      <td className="p-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/40 border-r border-slate-100 dark:border-slate-800">
                        {group.netValue > 0
                          ? group.netValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : "–"}
                      </td>

                      {/* Delivery Date */}
                      <td className="p-1 border-r border-slate-100 text-center">
                        <input
                          type="date"
                          value={group.deliveryDate}
                          onFocus={() => setActiveRowIndex(group.primaryLineIndex)}
                          onChange={e => handleGroupDeliveryDateChange(group, e.target.value)}
                          className="w-full bg-transparent border-none text-center h-6 font-mono text-[10px] text-slate-800 dark:text-slate-100 outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/40 rounded"
                        />
                      </td>

                      {/* Phase 1: Action — only show for populated rows */}
                      <td className="p-1.5 text-center">
                        {hasItem ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              id={`sw-row-recommend-${idx}`}
                              title="Apply Recommended Size Ratio (Bell Curve) to this row"
                              onClick={e => {
                                e.stopPropagation();
                                handleApplyRecommendationToGroup(group, "bell");
                              }}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-lg transition cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[12px] text-amber-600">auto_fix_high</span>
                              Ratio
                            </button>
                            <button
                              type="button"
                              title="Change item"
                              onClick={e => { e.stopPropagation(); setActiveRowIndex(group.primaryLineIndex); setShowBrowseModal(true); }}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[13px]">visibility</span>
                              View
                            </button>
                            <button
                              type="button"
                              title="Delete row"
                              onClick={e => { e.stopPropagation(); handleGroupDelete(group); }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        ) : (
                          // Empty row — no actions shown
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Footer totals row */}
                <tr className="bg-indigo-100/70 dark:bg-indigo-950/70 border-t-2 border-indigo-300 dark:border-indigo-700 font-bold">
                  <td className="p-2 text-center text-slate-500 dark:text-slate-400 border-r border-indigo-200 dark:border-indigo-800" />
                  <td className="p-2 border-r border-indigo-200 dark:border-indigo-800">
                    <button
                      type="button"
                      onClick={addBlankRow}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold text-xs"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      Add Item
                    </button>
                  </td>
                  <td className="p-2 text-right font-bold text-slate-700 dark:text-slate-200 border-r border-indigo-200 dark:border-indigo-800">
                    Total Qty
                  </td>
                  {sizes.map(sz => (
                    <td key={sz} className="p-2 text-center font-mono font-extrabold text-indigo-800 dark:text-indigo-300 border-r border-indigo-200 dark:border-indigo-800 text-sm">
                      {perSizeTotals[sz] || 0}
                    </td>
                  ))}
                  {/* Grand Total */}
                  <td className="p-2 text-center font-mono font-extrabold text-indigo-900 dark:text-indigo-200 bg-indigo-200 dark:bg-indigo-900 border-r border-indigo-300 dark:border-indigo-700 text-base">
                    {grandTotalQty}
                  </td>
                  <td colSpan={5} className="p-2 text-right text-indigo-700 dark:text-indigo-300 border-r border-indigo-200 dark:border-indigo-800 text-xs pr-3">
                    Net Order Value:&nbsp;
                    <span className="text-indigo-900 dark:text-indigo-200 font-extrabold text-base">
                      ₹{netOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Bottom panels ── */}
          <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-5 py-4 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">

              {/* Panel 1: Size-wise Summary */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">bar_chart</span>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
                    Size-wise Summary (All Items)
                  </h3>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400 font-semibold">
                      <td className="py-1">Size</td>
                      {sizes.map(sz => (
                        <td key={sz} className="py-1 text-center font-mono font-bold text-indigo-700">{sz}</td>
                      ))}
                      <td className="py-1 text-center font-bold text-slate-700 dark:text-slate-200">Total</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-1.5 text-slate-500 dark:text-slate-400 font-medium">Total Qty</td>
                      {sizes.map(sz => (
                        <td key={sz} className="py-1.5 text-center font-mono font-bold text-slate-800 dark:text-slate-100">
                          {perSizeTotals[sz] || 0}
                        </td>
                      ))}
                      <td className="py-1.5 text-center font-mono font-extrabold text-indigo-700 dark:text-indigo-300 text-sm">
                        {grandTotalQty}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-1.5 text-slate-500 dark:text-slate-400 font-medium align-top">% of Total</td>
                      {sizes.map(sz => {
                        const pctNum = parseFloat(sizePercents[sz]) || 0;
                        return (
                          <td key={sz} className="py-1.5 text-center font-mono text-slate-600 text-[11px] align-top">
                            <div>{sizePercents[sz]}</div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mt-1 overflow-hidden" title={`${sz}: ${sizePercents[sz]}`}>
                              <div
                                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, pctNum)}%` }}
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-1.5 text-center font-mono font-bold text-slate-700 dark:text-slate-200 align-top">
                        <div>100%</div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div className="bg-slate-400 dark:bg-slate-500 h-full rounded-full w-full" />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Visual Ratio Presets & Assortment Curves */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-indigo-500">tune</span>
                      Assortment Ratio Presets
                    </span>
                    <span className="font-mono text-[10px] text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 px-1.5 py-0.5 rounded">
                      Live Ratio: {grandTotalQty > 0 ? getSimplifiedRatioString(sizes, perSizeTotals) : "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      id="sw-footer-ratio-bell-btn"
                      onClick={() => handleApplyBatchRecommendation("bell")}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-700/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-700 rounded-md text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Apply Gaussian Bell curve (peaking in central core sizes) to all active lines"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span>Bell Curve (Standard)</span>
                    </button>
                    <button
                      type="button"
                      id="sw-footer-ratio-core-btn"
                      onClick={() => handleApplyBatchRecommendation("core")}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-700/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-700 rounded-md text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Apply Core Sizes curve (heavier emphasis on 40-60% size range) to all active lines"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Core Sizes Focus</span>
                    </button>
                    <button
                      type="button"
                      id="sw-footer-ratio-uniform-btn"
                      onClick={() => handleApplyBatchRecommendation("uniform")}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-700/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-700 rounded-md text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Apply Uniform Flat curve (equal distribution across all sizes) to all active lines"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <span>Even Run (Flat)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel 2: Item Summary */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">calculate</span>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">Item Summary</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Total Items", value: totalItems.toString() },
                    { label: "Total Order Qty", value: grandTotalQty.toString() },
                    {
                      label: "Gross Value (₹)",
                      value: grossValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    },
                    {
                      label: "Total Tax (₹)",
                      value: totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-mono font-bold text-slate-800">{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 bg-yellow-50/80 dark:bg-amber-950/40 border border-transparent dark:border-amber-800/60 px-2 py-1.5 rounded-lg">
                    <span className="font-bold text-slate-800 dark:text-slate-100">Net PO Value (₹)</span>
                    <span className="font-extrabold text-indigo-700 dark:text-indigo-300 text-base font-mono">
                      ₹{netOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel 3: Remarks */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">edit_note</span>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">Remarks</h3>
                </div>
                <textarea
                  rows={3}
                  value={header.remarks}
                  onChange={e => setHeader(h => ({ ...h, remarks: e.target.value }))}
                  placeholder="Add remarks for supplier (e.g. Regular Purchase for Q1 stock)"
                  className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 text-xs resize-none"
                />
                <div className="mt-2">
                  <label className="block text-[10px] text-slate-400 font-medium mb-1">Internal Notes (Not Printed)</label>
                  <textarea
                    rows={2}
                    value={header.internalNotes}
                    onChange={e => setHeader(h => ({ ...h, internalNotes: e.target.value }))}
                    placeholder="Internal notes visible only to staff"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 outline-none focus:border-indigo-500 text-xs resize-none italic"
                  />
                </div>
              </div>
            </div>

            {/* Attach Documents footer row */}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 font-medium transition"
                onClick={() => onNotification?.("Attachments", "Use the Attachments tab to upload documents.", "info")}
              >
                <span className="material-symbols-outlined text-[16px]">attach_file</span>
                Attach Documents (0)
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                {activeLineCount} item{activeLineCount !== 1 ? "s" : ""} · {grandTotalQty} units ·
                Mode: Sizewise
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. IMAGES & ARTICLES TAB (VISUAL LOOKBOOK & RECOMMENDATION) ──── */}
      {activeTab === "visual" && (
        <div
          id="sw-visual-lookbook-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!batchUploadState.isDragging) {
              setBatchUploadState(prev => ({ ...prev, isDragging: true }));
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setBatchUploadState(prev => ({ ...prev, isDragging: false }));
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setBatchUploadState(prev => ({ ...prev, isDragging: false }));
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
              handleProcessBatchFiles(e.dataTransfer.files);
            }
          }}
          className="relative flex flex-col flex-1 min-h-0 bg-slate-50/50 dark:bg-slate-900/50"
        >
          {/* Frosted Drag-and-Drop Overlay */}
          {batchUploadState.isDragging && (
            <div className="absolute inset-0 z-50 bg-indigo-900/50 backdrop-blur-xs border-4 border-dashed border-indigo-400 flex flex-col items-center justify-center p-6 text-white pointer-events-none animate-in fade-in duration-150">
              <div className="p-4 bg-white/20 rounded-2xl mb-3 shadow-lg">
                <span className="material-symbols-outlined text-[48px] text-white">cloud_upload</span>
              </div>
              <h3 className="text-xl font-black tracking-wide">Drop Article Photos Here</h3>
              <p className="text-xs text-indigo-100 max-w-md text-center mt-1">
                Batch auto-match filenames to Article # and Colorway with instant SPIF WebP compression
              </p>
            </div>
          )}
          {/* Visual Tab Header & View Toggles */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-[18px]">photo_library</span>
                <span>Product Images & Articles</span>
                <span className="text-[10px] text-slate-400 font-normal normal-case">
                  Visual lookbook and size-wise assortment of all items in this Purchase Order
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  id="sw-visual-view-card-btn"
                  onClick={() => setVisualViewMode("card")}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md font-bold transition ${
                    visualViewMode === "card"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">grid_view</span>
                  Card View
                </button>
                <button
                  type="button"
                  id="sw-visual-view-table-btn"
                  onClick={() => setVisualViewMode("table")}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md font-bold transition ${
                    visualViewMode === "table"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">table_rows</span>
                  Table View
                </button>
              </div>
            </div>
          </div>

          {/* Action Strip */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0">
            {/* Search Bar */}
            <div className="relative flex items-center min-w-[240px]">
              <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[15px]">search</span>
              <input
                type="text"
                value={visualSearch}
                onChange={e => setVisualSearch(e.target.value)}
                placeholder="Search Item (F2) / Scan Barcode"
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs outline-none focus:border-indigo-500 shadow-2xs"
              />
              {visualSearch && (
                <button type="button" onClick={() => setVisualSearch("")} className="absolute right-2 text-slate-400 hover:text-slate-600 text-sm">×</button>
              )}
            </div>

            {/* Add Item */}
            <button
              type="button"
              onClick={addBlankRow}
              className="flex items-center gap-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px] text-indigo-500">add</span>
              Add Item
            </button>

            {/* Global Grid Import */}
            <button
              type="button"
              onClick={() => {
                setInitialImportText(undefined);
                setIsGlobalImportOpen(true);
              }}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs cursor-pointer"
              title="Universal Grid Import (Excel Paste, CSV, PDT, Barcode Scanner)"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-600">table_view</span>
              Global Import
            </button>

            {/* Add / Bind Multiple Images */}
            <input
              ref={batchFileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleProcessBatchFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
            <button
              type="button"
              id="sw-batch-upload-btn"
              onClick={() => {
                if (batchUploadState.items.length > 0) {
                  setBatchUploadState(prev => ({ ...prev, isOpen: true }));
                } else {
                  batchFileInputRef.current?.click();
                }
              }}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
              title="Upload multiple sample photos with automatic filename matching"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-600">add_photo_alternate</span>
              Add Multiple Images
              {batchUploadState.items.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">
                  {batchUploadState.items.length}
                </span>
              )}
            </button>

            {/* Bulk Recommend Assortment */}
            <div className="relative">
              <button
                type="button"
                id="sw-bulk-recommend-btn"
                onClick={() => setBatchRecommendOpen(!batchRecommendOpen)}
                className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-500">auto_fix_high</span>
                Bulk Recommend
                <span className="material-symbols-outlined text-[14px]">expand_more</span>
              </button>

              {batchRecommendOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Select Curve Distribution
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyBatchRecommendation("bell")}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 font-medium transition"
                  >
                    <span>🔔 Bell Curve (Standard Retail)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyBatchRecommendation("core")}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 font-medium transition"
                  >
                    <span>🎯 Core Sizes (Mid-heavy)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyBatchRecommendation("uniform")}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 font-medium transition"
                  >
                    <span>⚖️ Uniform (Equal per size)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Visual Items Area */}
          <div className="flex-1 overflow-auto p-4">
            {lines.filter(l => Boolean(l.itemCode)).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center select-none bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-indigo-500 text-[36px]">photo_library</span>
                </div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">No visual items in this Purchase Order</h3>
                <p className="text-xs text-slate-400 mb-5 max-w-sm">
                  Add product items and attach article photos to view them in the visual lookbook and apply size ratios.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addBlankRow}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add Item
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRowIndex(0);
                      f2Dispatcher.openLookup("variant", f2Adapter);
                    }}
                    className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-lg text-xs transition shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px] text-indigo-500">manage_search</span>
                    F2 / Scan
                  </button>
                </div>
              </div>
            ) : visualViewMode === "card" ? (
              /* ── Card View ── */
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {groupedDisplayLines.map((group, groupIdx) => {
                  if (!group.itemCode) return null;
                  if (
                    visualSearch &&
                    !group.product.toLowerCase().includes(visualSearch.toLowerCase()) &&
                    !group.itemCode.toLowerCase().includes(visualSearch.toLowerCase()) &&
                    !(group.articleNo && group.articleNo.toLowerCase().includes(visualSearch.toLowerCase())) &&
                    !(group.shade && group.shade.toLowerCase().includes(visualSearch.toLowerCase())) &&
                    !(group.barcode && group.barcode.toLowerCase().includes(visualSearch.toLowerCase()))
                  ) {
                    return null;
                  }

                  const imgUrl = resolveLineImage(group, articleImageMap);

                  return (
                    <div
                      key={group.groupKey || group.id || groupIdx}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-md transition overflow-hidden flex flex-col justify-between"
                    >
                      {/* Card Content Top */}
                      <div className="p-4">
                        {/* Header Specs */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <div className="text-[10px] text-slate-400 font-mono">Item Code</div>
                            <div className="font-mono font-black text-indigo-900 dark:text-indigo-300 text-sm">{group.itemCode}</div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-0.5 leading-tight">{group.product}</h4>
                            
                            {/* Color & Specification Pills */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block border border-amber-400 shadow-2xs shrink-0"
                                  style={{ backgroundColor: getShadeHex(group.shade) }}
                                />
                                <span>Color:</span>
                                <span className="font-extrabold uppercase">{group.shade || "Standard"}</span>
                              </span>
                              {group.brand && (
                                <span className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 font-medium">
                                  Brand: {group.brand}
                                </span>
                              )}
                              {group.style && (
                                <span className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 font-medium">
                                  Style: {group.style}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold uppercase text-[9px] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 px-2 py-0.5 rounded">
                              {group.unit || "PAIR"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleGroupDelete(group)}
                              title="Delete Item"
                              className="text-slate-400 hover:text-rose-600 transition p-1"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Card Body: Image Column (Left) + Size Matrix Column (Right) */}
                        <div className="flex flex-col md:flex-row gap-4">
                          {/* Left Column: Image & Article Badge & Color Swatches */}
                          <div className="w-full md:w-44 shrink-0 flex flex-col items-center">
                            <div
                              onClick={() => imgUrl ? setZoomLightboxUrl(imgUrl) : openImageModal(group.primaryLineIndex)}
                              className="w-full h-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 relative group cursor-pointer overflow-hidden flex items-center justify-center shadow-inner"
                            >
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt={group.product}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                />
                              ) : (
                                <div className="text-center p-3">
                                  <span className="material-symbols-outlined text-slate-300 text-[36px]">add_a_photo</span>
                                  <p className="text-[10px] text-slate-400 mt-1 font-medium">Add Article Image</p>
                                </div>
                              )}

                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImageModal(group.primaryLineIndex);
                                  }}
                                  className="bg-white/90 hover:bg-white text-slate-900 rounded-lg p-1.5 shadow-sm text-[11px] font-bold flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                                  Change
                                </button>
                                {imgUrl && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setZoomLightboxUrl(imgUrl);
                                    }}
                                    className="bg-white/90 hover:bg-white text-slate-900 rounded-lg p-1.5 shadow-sm text-[11px] font-bold"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">zoom_in</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Article & Color Badges */}
                            <div className="mt-2 w-full flex flex-col gap-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="py-0.5 px-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 truncate max-w-[90px]" title={group.articleNo || group.itemCode}>
                                  Art: {group.articleNo || group.itemCode}
                                </span>
                                <span className="py-0.5 px-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-[10px] font-bold text-amber-900 dark:text-amber-200 truncate flex items-center gap-1 max-w-[90px]" title={group.shade || "Standard"}>
                                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: getShadeHex(group.shade) }} />
                                  {group.shade || "Std"}
                                </span>
                              </div>

                              {/* Quick Color Input / Selector */}
                              <div className="flex items-center gap-1 px-0.5">
                                <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">Color:</span>
                                <input
                                  type="text"
                                  value={group.shade || ""}
                                  placeholder="e.g. Tan, Black"
                                  onChange={e => handleGroupColorChange(group, e.target.value)}
                                  className="w-full py-0.5 px-1.5 text-[10px] font-bold border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 text-center"
                                  title="Directly edit Color / Shade"
                                />
                              </div>

                              {/* Swatches Row */}
                              <div className="flex items-center justify-center gap-1 pt-0.5">
                                {COLOR_SWATCHES.map((sw, swIdx) => (
                                  <button
                                    key={swIdx}
                                    type="button"
                                    title={`Set Color to ${sw.name}`}
                                    onClick={() => handleGroupColorChange(group, sw.name)}
                                    className={`w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs hover:scale-125 transition ${
                                      (group.shade || "").toLowerCase() === sw.name.toLowerCase() ? "ring-2 ring-indigo-600 ring-offset-1 scale-110" : ""
                                    }`}
                                    style={{ backgroundColor: sw.hex }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Size Matrix Table & Financials */}
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            {/* Embedded Size Matrix Table */}
                            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                              <table className="w-full text-xs text-center border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-[10px]">
                                    <th className="py-1 px-1.5 text-left border-r border-slate-200 dark:border-slate-700 w-12">Size</th>
                                    {sizes.map(sz => (
                                      <th key={sz} className="py-1 px-1 border-r border-slate-200 dark:border-slate-700 font-mono text-indigo-900 dark:text-indigo-300">
                                        {sz}
                                      </th>
                                    ))}
                                    <th className="py-1 px-1.5 font-bold text-slate-700 dark:text-slate-200 bg-indigo-50/50 dark:bg-indigo-950/40">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="py-1 px-1.5 text-left font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 text-[10px]">
                                      Qty
                                    </td>
                                    {sizes.map(sz => (
                                      <td key={sz} className="p-0.5 border-r border-slate-200 dark:border-slate-700">
                                        <input
                                          type="number"
                                          min="0"
                                          value={group.sizeQuantities[sz] ?? 0}
                                          onChange={e => {
                                            const v = Math.max(0, parseInt(e.target.value) || 0);
                                            handleGroupSizeQtyChange(group, sz, v);
                                          }}
                                          className="w-9 h-6 text-center font-mono font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:border-indigo-500 focus:bg-indigo-50/20 dark:focus:bg-indigo-950/30"
                                        />
                                      </td>
                                    ))}
                                    <td className="py-1 px-1.5 font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/40">
                                      {group.totalQty}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* "Or Recommend" Assortment Button & Financials */}
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setCardAssortmentOpen(cardAssortmentOpen === groupIdx ? null : groupIdx)}
                                  className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-2xs"
                                >
                                  <span className="material-symbols-outlined text-[14px] text-amber-600">auto_fix_high</span>
                                  Recommend Ratio
                                  <span className="material-symbols-outlined text-[13px]">expand_more</span>
                                </button>

                                {cardAssortmentOpen === groupIdx && (
                                  <div className="absolute left-0 bottom-full mb-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                      type="button"
                                      onClick={() => handleApplyRecommendationToGroup(group, "bell")}
                                      className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 font-medium"
                                    >
                                      <span>🔔 Bell Curve (Gaussian)</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApplyRecommendationToGroup(group, "core")}
                                      className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 font-medium"
                                    >
                                      <span>🎯 Core Sizes (Mid-heavy)</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApplyRecommendationToGroup(group, "uniform")}
                                      className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 font-medium"
                                    >
                                      <span>⚖️ Uniform (Equal per size)</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="text-right">
                                <div className="text-[10px] text-slate-400">
                                  Rate: <span className="font-mono text-slate-700 font-bold">₹{group.rate.toFixed(2)}</span>
                                </div>
                                <div className="text-xs font-mono font-black text-indigo-950 dark:text-indigo-200">
                                  Net Value: ₹{group.netValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Table View ── */
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                      <th className="p-2 text-center w-8">#</th>
                      <th className="p-2 text-center w-12">Photo</th>
                      <th className="p-2">Item Code</th>
                      <th className="p-2">Article No</th>
                      <th className="p-2 w-28">Color / Shade</th>
                      <th className="p-2">Product Description</th>
                      {sizes.map(sz => (
                        <th key={sz} className="p-2 text-center font-mono text-indigo-900 w-12">
                          {sz}
                        </th>
                      ))}
                      <th className="p-2 text-center font-bold bg-indigo-50/50 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-200 w-16">Total Qty</th>
                      <th className="p-2 text-right w-20">Rate (₹)</th>
                      <th className="p-2 text-right w-24">Net Value (₹)</th>
                      <th className="p-2 text-center w-12">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {groupedDisplayLines.map((group, idx) => {
                      if (!group.itemCode) return null;
                      const imgUrl = resolveLineImage(group, articleImageMap);
                      return (
                        <tr key={group.groupKey || group.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/50 transition">
                          <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => openImageModal(group.primaryLineIndex)}
                              className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto overflow-hidden hover:border-indigo-500 shadow-2xs"
                            >
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt={group.itemCode}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = imageNotAvailablePlaceholder;
                                    e.currentTarget.onerror = null;
                                  }}
                                />
                              ) : (
                                <span className="material-symbols-outlined text-slate-400 text-[18px]">add_photo_alternate</span>
                              )}
                            </button>
                          </td>
                          <td className="p-2 font-mono font-bold text-indigo-900 dark:text-indigo-300">{group.itemCode}</td>
                          <td className="p-2 font-mono font-semibold text-slate-700 dark:text-slate-300">{group.articleNo || group.itemCode}</td>
                          <td className="p-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-3 h-3 rounded-full inline-block border border-slate-300 shadow-2xs shrink-0"
                                style={{ backgroundColor: getShadeHex(group.shade) }}
                              />
                              <input
                                type="text"
                                value={group.shade || ""}
                                placeholder="Color"
                                onChange={e => handleGroupColorChange(group, e.target.value)}
                                className="w-20 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900"
                                title="Edit Color"
                              />
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="font-bold text-slate-800 dark:text-slate-100">{group.product}</div>
                            <div className="text-[10px] text-slate-400">{[group.brand, group.style, group.shade].filter(Boolean).join(" / ")}</div>
                          </td>
                          {sizes.map(sz => (
                            <td key={sz} className="p-1 text-center">
                              <input
                                type="number"
                                min="0"
                                value={group.sizeQuantities[sz] ?? 0}
                                onChange={e => {
                                  const v = Math.max(0, parseInt(e.target.value) || 0);
                                  handleGroupSizeQtyChange(group, sz, v);
                                }}
                                className="w-10 h-6 text-center font-mono font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:border-indigo-500"
                              />
                            </td>
                          ))}
                          <td className="p-2 text-center font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/40">
                            {group.totalQty}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-700 dark:text-slate-200">
                            {group.rate.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono font-black text-indigo-950 dark:text-indigo-200">
                            ₹{group.netValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleGroupDelete(group)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Summary Bar for Visual View */}
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-indigo-600">bar_chart</span>
                All Items Summary (Images View)
              </span>
              <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
              <span>Total Items: <strong className="text-slate-800 dark:text-slate-100">{totalItems}</strong></span>
              <span>Total Qty: <strong className="text-slate-800 dark:text-slate-100 font-mono">{grandTotalQty}</strong></span>
              <span>Gross: <strong className="text-slate-800 dark:text-slate-100 font-mono">₹{grossValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
              <span>Tax: <strong className="text-slate-800 dark:text-slate-100 font-mono">₹{totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
              <span>Net PO Value: <strong className="text-indigo-700 dark:text-indigo-300 font-black text-sm font-mono">₹{netOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSavePO("draft")}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-transparent dark:border-slate-700 text-xs font-bold rounded-lg transition"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSavePO("confirm")}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Save & Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. DELIVERY & TAX TAB ─────────────────────────────────────────── */}
      {activeTab === "delivery" && (
        <section className="px-6 py-5 max-w-2xl space-y-4 text-xs overflow-y-auto flex-1">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-2">Delivery Details</h3>
            <div>
              <label className="block font-medium text-slate-500 mb-1">Delivery Location / Warehouse</label>
              {availableWarehouses.length > 0 ? (
                <select
                  value={header.warehouseId || ""}
                  onChange={e => {
                    const selId = e.target.value;
                    const wh = availableWarehouses.find(w => w.id === selId);
                    setHeader(h => ({
                      ...h,
                      warehouseId: selId,
                      deliveryLocation: wh ? `${wh.code} - ${wh.name}` : selId,
                    }));
                  }}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 font-medium"
                >
                  {availableWarehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      [{w.code}] {w.name} {w.is_central_godown ? "⭐" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={header.deliveryLocation}
                  onChange={e => setHeader(h => ({ ...h, deliveryLocation: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-500 mb-1">Common Tax %</label>
                <input
                  type="number"
                  min="0"
                  value={header.commonTaxPercent}
                  onChange={e => {
                    const v = parseFloat(e.target.value) || 0;
                    setHeader(h => ({ ...h, commonTaxPercent: v }));
                    setLines(prev => prev.map(l => ({ ...l, taxPercent: v })));
                  }}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Freight Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={header.freightAmount}
                  onChange={e => setHeader(h => ({ ...h, freightAmount: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-500 mb-1">Other Charges (₹)</label>
              <input
                type="number"
                min="0"
                value={header.otherCharges}
                onChange={e => setHeader(h => ({ ...h, otherCharges: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono font-bold outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── 4. OTHER DETAILS TAB ──────────────────────────────────────────── */}
      {activeTab === "other" && (
        <section className="px-6 py-5 max-w-2xl space-y-4 text-xs overflow-y-auto flex-1">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-2">Commercial Terms</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-500 mb-1">Payment Terms</label>
                <select
                  id="sw-payment-terms-select"
                  value={header.paymentTerms}
                  onChange={e => setHeader(h => ({ ...h, paymentTerms: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium outline-none focus:border-indigo-500"
                >
                  <option>Immediate</option>
                  <option>15 Days</option>
                  <option>30 Days</option>
                  <option>45 Days</option>
                  <option>60 Days</option>
                  <option>90 Days</option>
                  <option>120 Days</option>
                  <option>Cash on Delivery</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Freight Terms</label>
                <input
                  id="sw-freight-terms-input"
                  type="text"
                  value={header.freightCharges}
                  onChange={e => setHeader(h => ({ ...h, freightCharges: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Currency</label>
                <select
                  id="sw-currency-select"
                  value={header.currency}
                  onChange={e => setHeader(h => ({ ...h, currency: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium outline-none focus:border-indigo-500"
                >
                  <option value="INR - Indian Rupee">INR - Indian Rupee</option>
                  <option value="USD - US Dollar">USD - Dollar</option>
                  <option value="EUR - Euro">EUR - Euro</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Supplier Reference</label>
                <input
                  id="sw-supplier-ref-input"
                  type="text"
                  value={header.supplierReference}
                  onChange={e => setHeader(h => ({ ...h, supplierReference: e.target.value }))}
                  placeholder="Supplier PO / Quotation No."
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Buyer</label>
                <input
                  id="sw-buyer-input"
                  type="text"
                  value={header.buyer}
                  onChange={e => setHeader(h => ({ ...h, buyer: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Department</label>
                <input
                  id="sw-department-input"
                  type="text"
                  value={header.department}
                  onChange={e => setHeader(h => ({ ...h, department: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-500 mb-1">Special Instructions</label>
              <textarea
                id="sw-special-instructions-input"
                rows={3}
                value={header.specialInstructions}
                onChange={e => setHeader(h => ({ ...h, specialInstructions: e.target.value }))}
                placeholder="Add special instructions for the supplier…"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── 409 Duplicate Banner ────────────────────────────────────────── */}
      {duplicateOrderNo && (
        <aside className="mx-5 mb-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-4 py-2 rounded-xl flex items-center gap-3 text-xs shrink-0">
          <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
          <span className="text-amber-900 dark:text-amber-200 font-medium">
            Purchase Order <strong>{duplicateOrderNo}</strong> already exists.
          </span>
          {suggestedOrderNo && (
            <button
              type="button"
              onClick={() => {
                if (suggestedOrderNo.includes("/")) {
                  setHeader(h => ({ ...h, orderNumber: suggestedOrderNo }));
                } else if (suggestedOrderNo.includes("-")) {
                  const lastDash = suggestedOrderNo.lastIndexOf("-");
                  const pfx = suggestedOrderNo.slice(0, lastDash);
                  const num = suggestedOrderNo.slice(lastDash + 1);
                  setHeader(h => ({ ...h, prefix: pfx || h.prefix, orderNumber: num }));
                } else {
                  setHeader(h => ({ ...h, orderNumber: suggestedOrderNo }));
                }
                setDuplicateOrderNo(null);
                setSuggestedOrderNo(null);
              }}
              className="ml-2 bg-blue-600 text-white font-bold px-3 py-1 rounded text-xs hover:bg-blue-700 transition"
            >
              Use {suggestedOrderNo}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setDuplicateOrderNo(null); setSuggestedOrderNo(null); }}
            className="ml-auto text-amber-700 hover:text-amber-900 font-bold text-sm"
          >
            ×
          </button>
        </aside>
      )}

      {/* ── Post-save Modal ─────────────────────────────────────────────── */}
      {savedOrderNo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-[480px] max-w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">check_circle</span>
              </div>
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Purchase Order Saved</h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{savedOrderNo} committed successfully.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { icon: "add_circle", label: "Create Another", color: "blue", action: () => { setSavedOrderNo(null); setLines([]); } },
                { icon: "local_shipping", label: "Receive GRN", color: "emerald", action: () => { setSavedOrderNo(null); onNavigateTab?.("grn-studio"); } },
                { icon: "print", label: "Print PO", color: "amber", action: () => { setSavedOrderNo(null); setShowPrintPreview(true); } },
              ].map(btn => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={btn.action}
                  className={`flex flex-col items-center justify-center gap-1.5 bg-${btn.color}-50 hover:bg-${btn.color}-100 border border-${btn.color}-200 rounded-xl py-3 px-2 font-bold text-xs text-${btn.color}-700 transition`}
                >
                  <span className="material-symbols-outlined text-[22px]">{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              id="sw-post-save-dismiss-btn"
              onClick={() => setSavedOrderNo(null)}
              className="text-xs text-slate-400 hover:text-slate-600 underline self-center cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Action Footer ───────────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-lg sticky bottom-0 z-20 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-1.5 font-bold transition shadow-2xs"
          >
            Cancel
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-mono">
            {selectedSupplier ? selectedSupplier.name : "No supplier"} ·
            {activeLineCount} item{activeLineCount !== 1 ? "s" : ""} ·
            {grandTotalQty} units
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="sw-save-draft-btn"
            disabled={saving}
            onClick={() => handleSavePO("draft")}
            className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-1.5 font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : (editingOrderId ? "Update Draft" : "Save Draft")}
          </button>
          <button
            type="button"
            id="sw-save-confirm-btn"
            disabled={saving}
            onClick={() => handleSavePO("confirm")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-1.5 font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {editingOrderId ? "Update & Confirm" : "Save & Confirm"}
          </button>
        </div>
      </footer>

      {/* ── Product Browse Modal ─────────────────────────────────────────── */}
      <PurchBrowseDlg
        products={products}
        isOpen={showBrowseModal}
        onClose={() => setShowBrowseModal(false)}
        onSelectProduct={handleSelectProduct}
        vendorId={header.supplierId || undefined}
        transactionDate={header.orderDate || undefined}
      />

      {/* ── Phase 2: Statutory Print Preview Modal ───────────────────────── */}
      <POPrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        header={printHeader}
        lineItems={printLineItems}
        sizePivotRows={printSizePivotRows}
        activeTab="pivot"
        vendor={selectedSupplier}
      />

      {/* ── Phase 2: In-App Confirmation Modal (Replaces window.confirm) ── */}
      {confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    confirmModal.variant === "danger"
                      ? "bg-rose-100 text-rose-600"
                      : confirmModal.variant === "warning"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-indigo-100 text-indigo-600"
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {confirmModal.variant === "danger" ? "warning" : confirmModal.variant === "warning" ? "priority_high" : "help"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 id="confirm-dialog-title" className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {confirmModal.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/60 px-6 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-2xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const cb = confirmModal.onConfirm;
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  cb();
                }}
                className={`px-4 py-1.5 rounded-lg text-white text-xs font-semibold shadow-xs transition ${
                  confirmModal.variant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : confirmModal.variant === "warning"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {confirmModal.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 3: Product Image Binding Modal ── */}
      {imageModalState.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-modal-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-[20px]">add_photo_alternate</span>
                <h3 id="image-modal-title" className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Attach Product Image
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setImageModalState(s => ({ ...s, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Product Reference */}
              <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-indigo-400 font-mono">Article No</div>
                  <div className="font-mono font-black text-indigo-950 dark:text-indigo-200 text-sm">
                    {imageModalState.articleNo || imageModalState.itemCode}
                  </div>
                </div>
                {imageModalState.color && (
                  <div className="text-center">
                    <div className="text-[10px] text-indigo-400 font-mono">Color / Shade</div>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100/70 border border-amber-200 text-xs font-bold text-amber-900">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: getShadeHex(imageModalState.color) }} />
                      {imageModalState.color}
                    </div>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-[10px] text-indigo-400 font-mono">Item Code</div>
                  <div className="font-mono font-bold text-slate-700 dark:text-slate-300">{imageModalState.itemCode}</div>
                </div>
              </div>

              {/* Preview Thumbnail */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-44 h-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden relative shadow-inner">
                  {imageModalState.currentImage ? (
                    <img
                      src={imageModalState.currentImage}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = imageNotAvailablePlaceholder;
                        e.currentTarget.onerror = null;
                      }}
                    />
                  ) : (
                    <img
                      src={imageNotAvailablePlaceholder}
                      alt="No Image Available"
                      className="w-full h-full object-contain p-2"
                    />
                  )}
                  {imageModalState.isUploading && (
                    <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-white backdrop-blur-[1px]">
                      <span className="material-symbols-outlined animate-spin text-[26px]">progress_activity</span>
                      <span className="text-[10px] font-bold mt-1 tracking-wide">Optimizing WebP...</span>
                    </div>
                  )}
                </div>

                {/* Status Badges */}
                {imageModalState.isOptimized && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md py-0.5 px-2 font-medium">
                    <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                    <span>Persisted Server WebP</span>
                  </div>
                )}
                {imageModalState.uploadError && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md py-0.5 px-2 font-medium">
                    <span className="material-symbols-outlined text-[13px] text-amber-600">info</span>
                    <span>{imageModalState.uploadError}</span>
                  </div>
                )}
              </div>

              {/* Upload Local File or Paste URL */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Image Source
                </label>
                <div className="flex items-center gap-2">
                  <label className={`flex-1 cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-300 dark:border-slate-600 border-dashed rounded-lg bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition text-xs ${imageModalState.isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <span className="material-symbols-outlined text-[16px] text-indigo-600">upload_file</span>
                    <span>Upload & Optimize Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                      disabled={imageModalState.isUploading}
                    />
                  </label>
                  {imageModalState.currentImage && (
                    <button
                      type="button"
                      onClick={() => setImageModalState(s => ({ ...s, currentImage: "", isOptimized: false }))}
                      className="px-2.5 py-2 border border-slate-200 hover:bg-rose-50 text-rose-600 rounded-lg transition"
                      title="Clear photo"
                      disabled={imageModalState.isUploading}
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  )}
                </div>

                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 font-medium block mb-1">Or paste remote Image URL:</span>
                  <input
                    type="url"
                    value={imageModalState.currentImage}
                    onChange={e => setImageModalState(s => ({ ...s, currentImage: e.target.value, isOptimized: false }))}
                    placeholder="https://example.com/shoe-photo.jpg"
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs outline-none focus:border-indigo-500 font-mono"
                    disabled={imageModalState.isUploading}
                  />
                </div>
              </div>

              {/* Propagation Scope Options */}
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Apply Image Scope:</div>
                {imageModalState.color && (
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="imageScope"
                      checked={imageModalState.scope === "articleColor"}
                      onChange={() => setImageModalState(s => ({ ...s, scope: "articleColor" }))}
                      className="text-indigo-600"
                    />
                    <span>
                      <strong>Article "{imageModalState.articleNo || imageModalState.itemCode}" + Color "{imageModalState.color}"</strong> (Recommended for footwear colorways)
                    </span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="imageScope"
                    checked={imageModalState.scope === "article"}
                    onChange={() => setImageModalState(s => ({ ...s, scope: "article" }))}
                    className="text-indigo-600"
                  />
                  <span>
                    All items with Article "{imageModalState.articleNo || imageModalState.itemCode}"
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="imageScope"
                    checked={imageModalState.scope === "itemCode"}
                    onChange={() => setImageModalState(s => ({ ...s, scope: "itemCode" }))}
                    className="text-indigo-600"
                  />
                  <span>This Item Code only ({imageModalState.itemCode})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="imageScope"
                    checked={imageModalState.scope === "rowOnly"}
                    onChange={() => setImageModalState(s => ({ ...s, scope: "rowOnly" }))}
                    className="text-indigo-600"
                  />
                  <span>This line item only</span>
                </label>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setImageModalState(s => ({ ...s, isOpen: false }))}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-2xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApplyImage(imageModalState.currentImage, imageModalState.scope)}
                disabled={imageModalState.isUploading}
                className={`px-4 py-1.5 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 text-xs font-bold shadow-xs transition flex items-center gap-1.5 ${imageModalState.isUploading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {imageModalState.isUploading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                    <span>Optimizing...</span>
                  </>
                ) : (
                  <span>Save & Apply Image</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 3: Zoom Lightbox Modal ── */}
      {zoomLightboxUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoomLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-white/10 rounded-2xl p-2 border border-white/20 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <img
              src={zoomLightboxUrl}
              alt="High-Res Zoom"
              className="max-w-full max-h-[80vh] object-contain rounded-xl mx-auto"
            />
            <button
              type="button"
              onClick={() => setZoomLightboxUrl(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white rounded-full p-1.5 transition"
              title="Close (Esc)"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 5: Multi-Image Batch Upload & Auto-Binding Modal ── */}
      {batchUploadState.isOpen && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            id="sw-batch-upload-modal-dialog"
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <span className="material-symbols-outlined text-[24px]">collections</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Batch Photo Upload & Auto-Binding
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {batchUploadState.items.length} image{batchUploadState.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Filenames are automatically analyzed to bind Article # and Colorway to PO line items.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="sw-batch-modal-close-btn"
                disabled={batchUploadState.isProcessing}
                onClick={() => setBatchUploadState(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* In-Modal Additional Files Dropstrip */}
            <div className="bg-indigo-50/50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-800 px-6 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium">
                <span className="material-symbols-outlined text-indigo-600 text-[18px]">info</span>
                <span>Review line item bindings below before optimizing & persisting to SPIF WebP.</span>
              </div>
              <button
                type="button"
                onClick={() => batchFileInputRef.current?.click()}
                disabled={batchUploadState.isProcessing}
                className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                Add More Images
              </button>
            </div>

            {/* Items Table / List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-[200px] max-h-[50vh]">
              {batchUploadState.items.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">image_search</span>
                  <p className="text-xs">No images in batch queue. Drag & drop files or click Add More Images.</p>
                </div>
              ) : (
                batchUploadState.items.map((item) => {
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-300 transition shadow-2xs"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 shrink-0">
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* File Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={item.file.name}>
                            {item.file.name}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {(item.file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>

                        {/* Match Confidence Tag */}
                        <div className="flex items-center gap-2 mt-1">
                          {item.confidence === "exact_composite" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <span className="material-symbols-outlined text-[12px]">verified</span>
                              Exact Article + Color
                            </span>
                          )}
                          {item.confidence === "article_only" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              <span className="material-symbols-outlined text-[12px]">search</span>
                              Article Matched
                            </span>
                          )}
                          {item.confidence === "color_only" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <span className="material-symbols-outlined text-[12px]">palette</span>
                              Color Matched
                            </span>
                          )}
                          {item.confidence === "none" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                              <span className="material-symbols-outlined text-[12px]">edit</span>
                              Manual Target
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Target PO Line Selector */}
                      <div className="w-64 shrink-0">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Target PO Line
                        </label>
                        <select
                          disabled={batchUploadState.isProcessing || item.status === "uploaded"}
                          value={item.lineIndex}
                          onChange={e => handleUpdateBatchItemLine(item.id, Number(e.target.value))}
                          className="w-full text-xs font-semibold px-2 py-1.5 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                        >
                          {groupedDisplayLines.map((g, gIdx) => {
                            const desc = g.product || g.style || `Item ${gIdx + 1}`;
                            const art = g.articleNo || g.itemCode || "No Article";
                            const col = g.shade ? ` (${g.shade})` : "";
                            return (
                              <option key={g.groupKey || g.id || gIdx} value={g.primaryLineIndex}>
                                #{gIdx + 1}: {art}{col} — {desc.slice(0, 20)}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Status Indicator */}
                      <div className="w-28 text-center shrink-0">
                        {item.status === "ready" && (
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-md">
                            Ready
                          </span>
                        )}
                        {item.status === "optimizing" && (
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-md flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined animate-spin text-[14px]">refresh</span>
                            SPIF WebP...
                          </span>
                        )}
                        {item.status === "uploaded" && (
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Optimized
                          </span>
                        )}
                        {item.status === "failed" && (
                          <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-md" title={item.error}>
                            Failed
                          </span>
                        )}
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        disabled={batchUploadState.isProcessing}
                        onClick={() => handleRemoveBatchItem(item.id)}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-30"
                        title="Remove from batch"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Processing Progress Bar */}
            {batchUploadState.isProcessing && (
              <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-2">
                <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined animate-spin text-indigo-600 text-[14px]">sync</span>
                    Optimizing images with SPIF & saving to server WebP storage...
                  </span>
                  <span>{batchUploadState.progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-200"
                    style={{ width: `${batchUploadState.progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-3.5 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {batchUploadState.items.filter(i => i.status === "uploaded").length} of {batchUploadState.items.length} uploaded
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="sw-batch-modal-cancel-btn"
                  disabled={batchUploadState.isProcessing}
                  onClick={() => setBatchUploadState(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  id="sw-batch-upload-confirm-btn"
                  disabled={batchUploadState.isProcessing || batchUploadState.items.length === 0}
                  onClick={handleExecuteBatchUpload}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                  <span>Upload & Auto-Bind All ({batchUploadState.items.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SMRITI Global Grid Input & Import Standard Modal ───────────────── */}
      <GlobalGridImportModal
        isOpen={isGlobalImportOpen}
        onClose={() => {
          setIsGlobalImportOpen(false);
          setInitialImportText(undefined);
        }}
        profile={GRID_PROFILES.PURCHASE}
        title="Purchase Order Sizewise Items Import & Resolution"
        initialRawText={initialImportText}
        existingRowCount={lines.filter((l) => l.itemCode).length}
        onCommit={handleGlobalGridImportCommit}
      />

      {/* ── Recall PO Modal ──────────────────────────────────────────────── */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400 text-lg">history_edu</span>
                <h3 className="font-bold text-sm">Recall Purchase Order for Editing</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRecallModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enter PO Number or Identity Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="sw-recall-order-input"
                    value={recallSearchQuery}
                    onChange={e => setRecallSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && recallSearchQuery.trim()) {
                        loadPOForEditing(recallSearchQuery.trim());
                      }
                    }}
                    placeholder="e.g. PO-2026-0001 or PO-001"
                    className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    id="sw-recall-submit-btn"
                    disabled={!recallSearchQuery.trim() || saving}
                    onClick={() => loadPOForEditing(recallSearchQuery.trim())}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    Recall
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Recent Purchase Orders
                  </span>
                  <button
                    type="button"
                    onClick={fetchRecentOrders}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">refresh</span> Refresh
                  </button>
                </div>

                {recentOrdersLoading ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading recent orders…</div>
                ) : recentOrders.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    No recent purchase orders found.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg max-h-56 overflow-y-auto">
                    {recentOrders.map((ord: any) => (
                      <div
                        key={ord.id || ord.order_no}
                        onClick={() => loadPOForEditing(ord.order_no || ord.id)}
                        className="px-3.5 py-2 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 cursor-pointer transition flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-mono font-bold text-xs text-indigo-600 group-hover:text-indigo-800">
                            {ord.order_no}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            {ord.supplier_name || ord.supplier_id || "Supplier"}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            (ord.status || "").toUpperCase() === "CONFIRMED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {ord.status || "DRAFT"}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            ₹{Number(ord.total_amount || ord.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-5 py-3 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span>Recalling a PO populates its items and size quantities into the matrix.</span>
              <button
                type="button"
                onClick={() => setShowRecallModal(false)}
                className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Common Colors Datalist for Fast Autocomplete ──────────────────── */}
      <datalist id="sw-common-colors-list">
        {COMMON_RETAIL_COLORS.map(col => (
          <option key={col} value={col} />
        ))}
      </datalist>

      {/* ── Indexed Articles Datalist for Fast Autocomplete ────────────────── */}
      <datalist id="sw-articles-datalist">
        {articleCatalogIndex.articles.map(art => (
          <option key={art} value={art} />
        ))}
      </datalist>

      {/* ── Commercial & Delivery Slide-Over Drawer (Decision B) ─────────── */}
      <CommercialDeliveryDrawer
        isOpen={showCommercialDrawer}
        onClose={() => setShowCommercialDrawer(false)}
        data={{
          paymentTerms: header.paymentTerms || "120 Days",
          freightCharges: header.freightCharges,
          deliveryTerms: header.deliveryTerms || ((header.freightCharges || "").toLowerCase().includes("buyer") || (header.freightCharges || "").toLowerCase().includes("to-pay") ? "Ex-Factory" : "Door Delivery"),
          freightAmount: header.freightAmount,
          currency: header.currency,
          buyer: header.buyer,
          department: header.department,
          specialInstructions: header.specialInstructions,
          supplierReference: header.supplierReference,
          deliveryDate: header.deliveryDate,
          deliveryLocation: header.deliveryLocation,
          warehouseId: header.warehouseId,
          leadTimeDays: header.leadTimeDays,
          otherCharges: header.otherCharges,
          remarks: header.remarks,
          internalNotes: header.internalNotes,
          priceList: header.priceList,
          businessTerms: header.businessTerms ?? DEFAULT_BUSINESS_TERMS,
        }}
        onChange={(updated) => setHeader(h => ({ ...h, ...updated }))}
        supplierName={header.supplierName}
        supplierCode={suppliersList.find(s => s.id === header.supplierId)?.code}
        supplierCommercialDefaults={supplierCommercialDefaults}
        onResetToDefaults={() => {
          if (supplierCommercialDefaults) {
            setHeader(h => ({
              ...h,
              paymentTerms: supplierCommercialDefaults.paymentTerms || h.paymentTerms,
              freightCharges: supplierCommercialDefaults.freightCharges || h.freightCharges,
              deliveryTerms: supplierCommercialDefaults.deliveryTerms || h.deliveryTerms,
              currency: supplierCommercialDefaults.currency || h.currency,
              buyer: supplierCommercialDefaults.buyer || h.buyer,
              department: supplierCommercialDefaults.department || h.department,
              specialInstructions: supplierCommercialDefaults.specialInstructions !== undefined ? supplierCommercialDefaults.specialInstructions : h.specialInstructions,
            }));
          }
        }}
      />
    </div>
  );
};

export default PoSizewiseTab;
