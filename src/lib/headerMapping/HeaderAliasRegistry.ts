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
      "article code", "article no", "article number", "article", "style article code", "style/article code"
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
    description: "EAN / UPC scanner barcode",
    additionalTargets: [
      { target: "sku", targetLabel: "SKU", condition: "sku_mode === 'BARCODE'", transform: "identity" }
    ]
  },
  {
    key: "brand",
    label: "BRAND",
    required: false,
    aliases: ["brand", "brand name", "manufacturer", "make", "label"],
    description: "Manufacturer or brand name"
  },
  {
    key: "imageName",
    label: "IMAGE NAME",
    required: false,
    aliases: [
      "image", "image name", "image_name", "photo", "photo name", "picture",
      "image file", "img", "filename", "product image", "sku image"
    ],
    description: "Product image filename (e.g. shoe-01.jpg)"
  },
  {
    key: "category",
    label: "CATEGORY",
    required: true,
    aliases: [
      "category", "category name", "product category", "item category",
      "group", "department", "merchandise category"
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
    required: false,
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
      "tax percentage", "tax", "product tax", "product tax %"
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
    required: false,
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
  },
  {
    key: "gender",
    label: "GENDER",
    required: false,
    aliases: ["gender", "gender classification", "target gender", "section"],
    description: "Target demographic / gender"
  },
  {
    key: "vendorCode",
    label: "VENDOR CODE",
    required: false,
    aliases: ["vendor code", "vendor id", "vendor no", "vendor number"],
    description: "Supplier / Vendor identifier"
  },
  {
    key: "purchaseClass",
    label: "PURCHASE CLASS",
    required: false,
    aliases: ["purchase class", "purchase classification", "sourcing class"],
    description: "Purchase classification (e.g. SIS, Outright, Consignment)"
  },
  {
    key: "heels",
    label: "HEELS",
    required: false,
    aliases: ["heels", "heel type", "heel height"],
    description: "Footwear heel structure"
  },
  {
    key: "upperMaterial",
    label: "UPPER MATERIAL",
    required: false,
    aliases: ["upper material", "upper", "shoe upper"],
    description: "Footwear upper material"
  },
  {
    key: "outsole",
    label: "OUTSOLE",
    required: false,
    aliases: ["outsole", "sole", "sole material", "bottom sole"],
    description: "Shoe bottom outsole material"
  },
  {
    key: "imageUrl",
    label: "IMAGE LINK",
    required: false,
    aliases: ["image link", "image url", "image", "image_link", "image_url", "photo", "picture"],
    description: "Primary product image URL or code"
  },
  // Generic Attribute Slots A1..A9
  { key: "a1", label: "ATTRIBUTE 1 (A1)", required: false, aliases: ["a1", "attr 1", "attribute 1", "attribute1", "heels", "heel type"], description: "Dynamic Attribute slot 1" },
  { key: "a2", label: "ATTRIBUTE 2 (A2)", required: false, aliases: ["a2", "attr 2", "attribute 2", "attribute2", "upper", "upper material", "shoe upper"], description: "Dynamic Attribute slot 2" },
  { key: "a3", label: "ATTRIBUTE 3 (A3)", required: false, aliases: ["a3", "attr 3", "attribute 3", "attribute3", "outsole", "sole", "sole material"], description: "Dynamic Attribute slot 3" },
  { key: "a4", label: "ATTRIBUTE 4 (A4)", required: false, aliases: ["a4", "attr 4", "attribute 4", "attribute4", "gender", "target gender", "section"], description: "Dynamic Attribute slot 4" },
  { key: "a5", label: "ATTRIBUTE 5 (A5)", required: false, aliases: ["a5", "attr 5", "attribute 5", "attribute5", "vendor code", "vendor id", "supplier code"], description: "Dynamic Attribute slot 5" },
  { key: "a6", label: "ATTRIBUTE 6 (A6)", required: false, aliases: ["a6", "attr 6", "attribute 6", "attribute6", "purchase class", "purchase classification"], description: "Dynamic Attribute slot 6" },
  { key: "a7", label: "ATTRIBUTE 7 (A7)", required: false, aliases: ["a7", "attr 7", "attribute 7", "attribute7", "department", "dept", "division"], description: "Dynamic Attribute slot 7" },
  { key: "a8", label: "ATTRIBUTE 8 (A8)", required: false, aliases: ["a8", "attr 8", "attribute 8", "attribute8", "merchandise category", "merchandise cat", "mc category"], description: "Dynamic Attribute slot 8" },
  { key: "a9", label: "ATTRIBUTE 9 (A9)", required: false, aliases: ["a9", "attr 9", "attribute 9", "attribute9", "season", "fit", "pattern", "occasion"], description: "Dynamic Attribute slot 9" }
];

const CUSTOM_ALIASES_STORAGE_KEY = "smriti_header_custom_aliases";
const REMOVED_ALIASES_STORAGE_KEY = "smriti_header_removed_aliases";
let inMemoryCustomAliases: Record<string, string[]> = {};
let inMemoryRemovedAliases: Record<string, string[]> = {};

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

export function getRemovedAliases(): Record<string, string[]> {
  try {
    if (typeof localStorage === "undefined") {
      return inMemoryRemovedAliases;
    }
    const raw = localStorage.getItem(REMOVED_ALIASES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return inMemoryRemovedAliases;
  }
}

export function addCustomAlias(fieldKey: string, alias: string): void {
  if (!fieldKey || !alias.trim()) return;
  const normalizedNewAlias = normalizeHeader(alias);
  const rawTrimmed = alias.trim();

  // 1. Remove from blacklist if previously deleted
  const removedMap = getRemovedAliases();
  if (removedMap[fieldKey]) {
    removedMap[fieldKey] = removedMap[fieldKey].filter(a => a !== normalizedNewAlias && a !== rawTrimmed.toLowerCase());
    inMemoryRemovedAliases = removedMap;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(REMOVED_ALIASES_STORAGE_KEY, JSON.stringify(removedMap));
      }
    } catch {}
  }

  // 2. Add to custom aliases
  const currentMap = getCustomAliases();
  const existing = currentMap[fieldKey] || [];
  if (!existing.includes(rawTrimmed)) {
    currentMap[fieldKey] = [...existing, rawTrimmed];
    inMemoryCustomAliases = currentMap;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CUSTOM_ALIASES_STORAGE_KEY, JSON.stringify(currentMap));
      }
    } catch {}
  }
}

export function removeCustomAlias(fieldKey: string, alias: string): void {
  if (!fieldKey || !alias) return;
  const norm = normalizeHeader(alias);
  const raw = alias.trim().toLowerCase();

  // 1. Remove from custom aliases if present
  const currentMap = getCustomAliases();
  const existing = currentMap[fieldKey] || [];
  currentMap[fieldKey] = existing.filter(a => a.trim().toLowerCase() !== raw && normalizeHeader(a) !== norm);
  inMemoryCustomAliases = currentMap;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CUSTOM_ALIASES_STORAGE_KEY, JSON.stringify(currentMap));
    }
  } catch {}

  // 2. Add to removed aliases blacklist so default/built-in aliases are also suppressed
  const removedMap = getRemovedAliases();
  const existingRemoved = removedMap[fieldKey] || [];
  if (!existingRemoved.includes(norm) || !existingRemoved.includes(raw)) {
    removedMap[fieldKey] = Array.from(new Set([...existingRemoved, norm, raw]));
    inMemoryRemovedAliases = removedMap;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(REMOVED_ALIASES_STORAGE_KEY, JSON.stringify(removedMap));
      }
    } catch {}
  }
}

export function clearCustomAliases(): void {
  inMemoryCustomAliases = {};
  inMemoryRemovedAliases = {};
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(CUSTOM_ALIASES_STORAGE_KEY);
      localStorage.removeItem(REMOVED_ALIASES_STORAGE_KEY);
    }
  } catch {}
}

const CUSTOM_LABELS_STORAGE_KEY = "smriti_header_custom_labels";
let inMemoryCustomLabels: Record<string, string> = {};

export function getCustomFieldLabels(): Record<string, string> {
  try {
    if (typeof localStorage === "undefined") return inMemoryCustomLabels;
    const raw = localStorage.getItem(CUSTOM_LABELS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return inMemoryCustomLabels;
  }
}

export function setCustomFieldLabel(fieldKey: string, customLabel: string): void {
  if (!fieldKey) return;
  const currentMap = getCustomFieldLabels();
  if (customLabel.trim()) {
    currentMap[fieldKey] = customLabel.trim();
  } else {
    delete currentMap[fieldKey];
  }
  inMemoryCustomLabels = currentMap;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CUSTOM_LABELS_STORAGE_KEY, JSON.stringify(currentMap));
    }
  } catch {}
}

export function getSmritiItemMasterFields(customAttrs: { key: string; label: string; aliases?: string[] }[] = []): SmritiFieldDefinition[] {
  const customAliasMap = getCustomAliases();
  const removedAliasMap = getRemovedAliases();

  const baseFieldsWithCustomAliases = SMRITI_ITEM_MASTER_FIELDS.map(f => {
    const extraAliases = customAliasMap[f.key] || [];
    const removedForField = (removedAliasMap[f.key] || []).map(r => r.toLowerCase().trim());
    const combined = Array.from(new Set([...f.aliases, ...extraAliases]));
    const filtered = combined.filter(a => !removedForField.includes(a.toLowerCase().trim()) && !removedForField.includes(normalizeHeader(a)));
    return {
      ...f,
      aliases: filtered
    };
  });

  const dynamicFields: SmritiFieldDefinition[] = customAttrs.map(attr => {
    const key = attr.key.startsWith("attr_") ? attr.key : `attr_${attr.key}`;
    const extraAliases = customAliasMap[key] || [];
    const removedForField = (removedAliasMap[key] || []).map(r => r.toLowerCase().trim());
    const combined = Array.from(new Set([attr.label, attr.key, ...(attr.aliases || []), ...extraAliases]));
    const filtered = combined.filter(a => !removedForField.includes(a.toLowerCase().trim()) && !removedForField.includes(normalizeHeader(a)));
    return {
      key,
      label: attr.label.toUpperCase(),
      required: false,
      aliases: filtered,
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
