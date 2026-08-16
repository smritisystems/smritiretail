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

import { SmritiFieldDefinition, MappingContext } from "./types";
import { normalizeHeader } from "./HeaderNormalizer";

export const SMRITI_ITEM_MASTER_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "code",
    label: "SKU CODE",
    required: true,
    aliases: [
      "sku", "sku code", "item code", "item no", "item number", "item id",
      "product code", "product no", "product number", "style code", "style no",
      "article code", "article no", "article number", "article"
    ],
    description: "Unique SKU or product style code identifier"
  },
  {
    key: "name",
    label: "ITEM NAME",
    required: true,
    aliases: [
      "item", "item name", "item description", "product", "product name",
      "product description", "description"
    ],
    description: "Item title or product display description"
  },
  {
    key: "barcode",
    label: "BARCODE",
    required: true,
    aliases: [
      "barcode", "barcode no", "barcode number", "barcode code", "ean",
      "ean code", "ean13", "ean 13", "upc", "upc code"
    ],
    description: "EAN / UPC scanner barcode"
  },
  {
    key: "brand",
    label: "BRAND",
    required: false,
    aliases: ["brand", "brand name", "manufacturer", "make", "label"],
    description: "Manufacturer or brand name"
  },
  {
    key: "category",
    label: "CATEGORY",
    required: true,
    aliases: [
      "category", "category name", "product category", "item category",
      "group", "department"
    ],
    description: "Primary merchandise category"
  },
  {
    key: "subCategory",
    label: "SUB CATEGORY",
    required: false,
    aliases: [
      "sub category", "subcategory", "sub-category", "sub category name",
      "product subcategory", "segment"
    ],
    description: "Sub-category classification"
  },
  {
    key: "size",
    label: "SIZE",
    required: false,
    aliases: ["size", "size name", "item size", "product size"],
    description: "Apparel or footwear size"
  },
  {
    key: "colour",
    label: "COLOUR",
    required: false,
    aliases: ["color", "colour", "color name", "colour name", "shade"],
    description: "Item color or shade"
  },
  {
    key: "hsnCode",
    label: "HSN CODE",
    required: true,
    aliases: [
      "hsn", "hsn code", "hsn no", "hsn number", "hsn sac", "hsn/sac"
    ],
    description: "GST HSN/SAC classification code"
  },
  {
    key: "gstPercentage",
    label: "GST %",
    required: true,
    aliases: [
      "gst", "gst %", "gst rate", "gst percentage", "tax rate", "tax %",
      "tax percentage", "tax"
    ],
    description: "GST percentage rate"
  },
  {
    key: "mrp",
    label: "MRP",
    required: false,
    aliases: [
      "mrp", "maximum retail price", "retail price", "mrp price",
      "plate rate or mrp"
    ],
    description: "Maximum Retail Price"
  },
  {
    key: "price",
    label: "SELLING PRICE",
    required: true,
    aliases: [
      "selling price", "sale price", "sales price", "selling rate",
      "sale rate", "sp", "plate rate"
    ],
    description: "Active selling price"
  },
  {
    key: "costPrice",
    label: "BUY COST",
    required: false,
    aliases: [
      "buy cost", "purchase cost", "cost price", "cost", "buying price",
      "purchase rate"
    ],
    description: "Purchase buy cost"
  },
  {
    key: "uom",
    label: "UOM",
    required: false,
    aliases: [
      "uom", "unit", "unit of measure", "unit of measurement", "measurement unit"
    ],
    description: "Unit of measure (e.g. Pcs, Kg, Pair)"
  },
  {
    key: "stock",
    label: "STOCK",
    required: false,
    aliases: [
      "stock", "opening stock", "opening qty", "opening quantity",
      "quantity", "qty"
    ],
    description: "Opening inventory stock quantity"
  }
];

const CUSTOM_ALIASES_STORAGE_KEY = "smriti_header_custom_aliases";
let inMemoryCustomAliases: Record<string, string[]> = {};

export function getCustomAliases(): Record<string, string[]> {
  try {
    if (typeof localStorage === "undefined") {
      return inMemoryCustomAliases;
    }
    const raw = localStorage.getItem(CUSTOM_ALIASES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return inMemoryCustomAliases;
  }
}

export function addCustomAlias(fieldKey: string, alias: string): void {
  if (!fieldKey || !alias.trim()) return;
  const normalizedNewAlias = normalizeHeader(alias);
  const currentMap = getCustomAliases();
  const existing = currentMap[fieldKey] || [];
  if (!existing.includes(normalizedNewAlias)) {
    currentMap[fieldKey] = [...existing, normalizedNewAlias];
    inMemoryCustomAliases = currentMap;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CUSTOM_ALIASES_STORAGE_KEY, JSON.stringify(currentMap));
      }
    } catch {}
  }
}

export function removeCustomAlias(fieldKey: string, alias: string): void {
  const currentMap = getCustomAliases();
  const existing = currentMap[fieldKey] || [];
  const filtered = existing.filter(a => a !== normalizeHeader(alias));
  currentMap[fieldKey] = filtered;
  inMemoryCustomAliases = currentMap;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CUSTOM_ALIASES_STORAGE_KEY, JSON.stringify(currentMap));
    }
  } catch {}
}

export function clearCustomAliases(): void {
  inMemoryCustomAliases = {};
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(CUSTOM_ALIASES_STORAGE_KEY);
    }
  } catch {}
}

export function getSmritiItemMasterFields(customAttrs: { key: string; label: string; aliases?: string[] }[] = []): SmritiFieldDefinition[] {
  const customAliasMap = getCustomAliases();

  const baseFieldsWithCustomAliases = SMRITI_ITEM_MASTER_FIELDS.map(f => {
    const extraAliases = customAliasMap[f.key] || [];
    if (extraAliases.length === 0) return f;
    return {
      ...f,
      aliases: Array.from(new Set([...f.aliases, ...extraAliases]))
    };
  });

  const dynamicFields: SmritiFieldDefinition[] = customAttrs.map(attr => {
    const key = attr.key.startsWith("attr_") ? attr.key : `attr_${attr.key}`;
    const extraAliases = customAliasMap[key] || [];
    return {
      key,
      label: attr.label.toUpperCase(),
      required: false,
      aliases: Array.from(new Set([attr.label, attr.key, ...(attr.aliases || []), ...extraAliases])),
      description: `Dynamic Item Attribute: ${attr.label}`
    };
  });

  return [...baseFieldsWithCustomAliases, ...dynamicFields];
}

export interface AmbiguousRule {
  normalizedTrigger: string;
  candidateKeys: string[];
  contextDefaults?: Record<MappingContext, string>;
}

export const AMBIGUOUS_HEADER_RULES: AmbiguousRule[] = [
  {
    normalizedTrigger: "price",
    candidateKeys: ["price", "mrp", "costPrice"],
    contextDefaults: {
      ITEM_MASTER: "price",
      PURCHASE_ORDER: "costPrice",
      GRN: "costPrice",
      SALES_INVOICE: "price"
    }
  },
  {
    normalizedTrigger: "rate",
    candidateKeys: ["price", "costPrice", "mrp"],
    contextDefaults: {
      ITEM_MASTER: "price",
      PURCHASE_ORDER: "costPrice",
      GRN: "costPrice",
      SALES_INVOICE: "price"
    }
  },
  {
    normalizedTrigger: "qty",
    candidateKeys: ["stock"],
    contextDefaults: {
      ITEM_MASTER: "stock",
      PURCHASE_ORDER: "stock",
      GRN: "stock",
      SALES_INVOICE: "stock"
    }
  }
];
