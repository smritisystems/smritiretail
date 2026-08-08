/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Metadata Platform (SMP-M)
 * Component    : UniversalAttributeEngine (UAME Core Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { AttributeDefinition } from "./AttributeDefinition.js";
import { IndustryPackManager, IndustryType } from "../industry-packs/IndustryPackManager.js";
import { globalMetadataCache } from "../caching/MetadataCache.js";

export interface CanonicalAttributeMeta {
  canonicalKey: string;
  aliases: string[];
  productField?: string;
  masterLookupType?: string;
  isVariantDimension: boolean;
  defaultDisplayLabel: string;
  industryLabels?: Partial<Record<IndustryType | "footwear", string>>;
}

export const CANONICAL_ATTRIBUTES: Record<string, CanonicalAttributeMeta> = {
  BRAND: {
    canonicalKey: "BRAND",
    aliases: ["BRAND", "BRAND NAME", "BRAND_NAME", "MANUFACTURER", "LABEL", "BRAND NAMES"],
    productField: "brand",
    masterLookupType: "product_brand",
    isVariantDimension: false,
    defaultDisplayLabel: "Brand Name",
    industryLabels: {
      apparel: "Brand",
      jewellery: "Designer / Brand",
      medical: "Manufacturer",
      electronics: "Brand Name",
      fmcg: "Brand",
      general: "Brand Name",
    },
  },
  STYLE_CODE: {
    canonicalKey: "STYLE_CODE",
    aliases: [
      "STYLE_CODE",
      "STYLE",
      "STYLE CODE",
      "PRODUCT STYLE CODE",
      "STYLECODE",
      "ARTICLE",
      "ARTICLE CODE",
      "STYLE/ARTICLE CODE",
      "STYLE/ARTICLE",
      "MODEL",
      "MODEL NUMBER",
      "MODEL NO",
      "MODEL CODE",
      "DESIGN CODE",
      "PRODUCT CODE",
      "ITEM CODE",
    ],
    productField: "style_code",
    isVariantDimension: false,
    defaultDisplayLabel: "Product Style Code",
    industryLabels: {
      apparel: "Style Code",
      footwear: "Article Code",
      jewellery: "Design / Style No",
      medical: "Item Code",
      electronics: "Model Number",
      fmcg: "Item Code",
      general: "Product Style Code",
    },
  },
  COLOR: {
    canonicalKey: "COLOR",
    aliases: ["COLOR", "COLOUR", "SHADE", "COLOR NAME", "COLOR CODE"],
    productField: "color",
    isVariantDimension: true,
    defaultDisplayLabel: "Color",
    industryLabels: {
      apparel: "Color",
      jewellery: "Plating / Color",
      medical: "Color",
      electronics: "Color Finish",
      fmcg: "Variant / Color",
      general: "Color",
    },
  },
  SIZE: {
    canonicalKey: "SIZE",
    aliases: ["SIZE", "SIZE CODE", "SIZE SCALE", "DIMENSION"],
    productField: "size",
    isVariantDimension: true,
    defaultDisplayLabel: "Size",
    industryLabels: {
      apparel: "Size",
      jewellery: "Net Weight / Size",
      medical: "Dosage / Size",
      electronics: "Capacity / Size",
      fmcg: "Pack Size",
      general: "Size",
    },
  },
  MRP: {
    canonicalKey: "MRP",
    aliases: ["MRP", "MAX RETAIL PRICE", "MRP PRICE", "PLATE RATE OR MRP"],
    productField: "mrp",
    isVariantDimension: false,
    defaultDisplayLabel: "MRP",
  },
  COST_PRICE: {
    canonicalKey: "COST_PRICE",
    aliases: ["COST_PRICE", "COST PRICE", "BUY COST", "BUYING PRICE", "COST", "PURCHASE PRICE"],
    productField: "cost_price",
    isVariantDimension: false,
    defaultDisplayLabel: "Buy Cost",
  },
  SELLING_PRICE: {
    canonicalKey: "SELLING_PRICE",
    aliases: ["SELLING_PRICE", "SELLING PRICE", "PRICE", "PLATE RATE"],
    productField: "price",
    isVariantDimension: false,
    defaultDisplayLabel: "Selling Price",
  },
  GST_RATE: {
    canonicalKey: "GST_RATE",
    aliases: ["GST_RATE", "GST %", "GST PERCENTAGE", "PRODUCT TAX", "TAX PERCENTAGE", "GST", "PRODUCT TAX %"],
    productField: "gst_percentage",
    isVariantDimension: false,
    defaultDisplayLabel: "GST %",
  },
  STOCK: {
    canonicalKey: "STOCK",
    aliases: ["STOCK", "INITIAL STOCK", "QTY", "QUANTITY"],
    productField: "stock",
    isVariantDimension: false,
    defaultDisplayLabel: "Stock",
  },
  HSN_CODE: {
    canonicalKey: "HSN_CODE",
    aliases: ["HSN_CODE", "HSN CODE", "HSN", "HSN/SAC", "HSNCODE"],
    productField: "hsn_code",
    masterLookupType: "hsn_master",
    isVariantDimension: false,
    defaultDisplayLabel: "HSN Code",
  },
  BARCODE: {
    canonicalKey: "BARCODE",
    aliases: ["BARCODE", "BARCODE NO", "BARCODE NUMBER", "UPC", "EAN"],
    productField: "barcode",
    isVariantDimension: false,
    defaultDisplayLabel: "Barcode",
  },
  ITEM_NAME: {
    canonicalKey: "ITEM_NAME",
    aliases: ["ITEM_NAME", "ITEM NAME", "DESCRIPTION", "ITEM DESCRIPTION", "PRODUCT NAME", "PRODUCT DESCRIPTION", "NAME"],
    productField: "name",
    isVariantDimension: false,
    defaultDisplayLabel: "Item Name",
  },
};

export class UniversalAttributeEngine {
  private static dynamicDefinitions: Map<string, AttributeDefinition> = new Map();
  private static labelOverrides: Map<string, string> = new Map();

  /**
   * Resolves raw label or attribute key to Canonical Key
   */
  static resolveCanonicalKey(labelOrKey: string): string {
    if (!labelOrKey) return "";
    const clean = labelOrKey.toUpperCase().trim().replace(/_/g, " ");
    for (const [key, meta] of Object.entries(CANONICAL_ATTRIBUTES)) {
      if (meta.aliases.some(alias => alias.toUpperCase() === clean || alias.toUpperCase().replace(/_/g, " ") === clean)) {
        return meta.canonicalKey;
      }
    }
    return labelOrKey.toUpperCase().replace(/\s+/g, "_");
  }

  /**
   * Gets canonical metadata for a canonical key
   */
  static getCanonicalMetadata(canonicalKey: string): CanonicalAttributeMeta | undefined {
    return CANONICAL_ATTRIBUTES[canonicalKey];
  }

  /**
   * Resolves Business Model Display Label for a Canonical Key
   */
  static getDisplayLabel(canonicalKey: string, industry?: IndustryType | "footwear"): string {
    const meta = CANONICAL_ATTRIBUTES[canonicalKey];
    if (!meta) return canonicalKey;
    const currentIndustry = industry || IndustryPackManager.getActiveIndustry();
    if (meta.industryLabels && meta.industryLabels[currentIndustry]) {
      return meta.industryLabels[currentIndustry];
    }
    return meta.defaultDisplayLabel;
  }

  /**
   * Initializes or refreshes attribute definitions from active Industry Pack
   */
  static getAttributes(industry?: IndustryType): AttributeDefinition[] {
    const currentIndustry = industry || IndustryPackManager.getActiveIndustry();
    const cacheKey = `attrs_${currentIndustry}`;
    const cached = globalMetadataCache.get(cacheKey);
    if (cached) return cached;

    const basePack = IndustryPackManager.getActivePack();
    const result = basePack.map((def) => {
      const overrideLabel = this.labelOverrides.get(def.attributeCode);
      const dynamicDef = this.dynamicDefinitions.get(def.attributeCode);
      const merged = { ...def, ...(dynamicDef || {}) };
      if (overrideLabel) {
        merged.displayLabel = overrideLabel;
      }
      return merged;
    });

    globalMetadataCache.set(cacheKey, result);
    return result;
  }

  /**
   * Gets filterable attributes for dynamic Range Filters
   */
  static getFilterableAttributes(industry?: IndustryType): AttributeDefinition[] {
    return this.getAttributes(industry).filter((attr) => attr.behavior.filterable && attr.behavior.visible);
  }

  /**
   * Gets printable attributes for ZPL / PRN label resolution
   */
  static getPrintableAttributes(industry?: IndustryType): AttributeDefinition[] {
    return this.getAttributes(industry).filter((attr) => attr.behavior.printable && attr.behavior.visible);
  }

  /**
   * Renames a display label with ZERO code changes (UA-005)
   */
  static setCustomDisplayLabel(attributeCode: string, newLabel: string): void {
    this.labelOverrides.set(attributeCode, newLabel);
    globalMetadataCache.clear();
  }

  /**
   * Registers a custom user attribute at runtime (UA-006)
   */
  static registerCustomAttribute(definition: AttributeDefinition): void {
    this.dynamicDefinitions.set(definition.attributeCode, definition);
    globalMetadataCache.clear();
  }

  /**
   * Resolves attribute values from an item dictionary
   */
  static resolveValues(item: any, industry?: IndustryType): Record<string, string> {
    const attributes = this.getAttributes(industry);
    const resolved: Record<string, string> = {};

    for (const attr of attributes) {
      const code = attr.attributeCode;
      let val = item[code] || item[attr.internalName] || (item.attributes && item.attributes[code]);
      if (val === undefined || val === null) {
        val = attr.defaultValue || "-";
      }
      resolved[code] = String(val);
      resolved[attr.displayLabel] = String(val);
    }

    return resolved;
  }

  /**
   * Deduplicates column registry ensuring new Set(canonicalKeys).size === columns.length.
   * If multiple raw headers or columns resolve to the same canonical key, it keeps only 1
   * with the active industry pack display label.
   */
  static resolveDeduplicatedColumns<T extends { canonicalKey?: string; label?: string }>(
    rawColumns: T[],
    industry?: IndustryType | "footwear"
  ): T[] {
    const seenCanonicalKeys = new Set<string>();
    const deduplicated: T[] = [];

    for (const col of rawColumns) {
      const rawKey = col.canonicalKey || col.label || "";
      const canonicalKey = this.resolveCanonicalKey(rawKey);

      if (canonicalKey) {
        if (seenCanonicalKeys.has(canonicalKey)) {
          // Skip duplicate column mapping to same canonical key
          continue;
        }
        seenCanonicalKeys.add(canonicalKey);
        const resolvedLabel = this.getDisplayLabel(canonicalKey, industry);
        deduplicated.push({
          ...col,
          canonicalKey,
          label: resolvedLabel,
        });
      } else {
        deduplicated.push(col);
      }
    }

    return deduplicated;
  }

  /**
   * Validates Excel/CSV import headers for duplicate canonical column mappings.
   * If two headers in the same file map to the same canonical key (e.g. Brand and Brand Name),
   * returns a deterministic DUPLICATE_CANONICAL_COLUMN error.
   */
  static validateDuplicateCanonicalHeaders(headers: string[]): {
    valid: boolean;
    duplicateError?: string;
    duplicates?: Array<{ header1: string; header2: string; canonicalKey: string }>;
  } {
    const seen = new Map<string, string>(); // canonicalKey -> firstHeader
    const duplicates: Array<{ header1: string; header2: string; canonicalKey: string }> = [];

    for (const rawHeader of headers) {
      if (!rawHeader || !rawHeader.trim()) continue;
      const canonicalKey = this.resolveCanonicalKey(rawHeader);
      if (!canonicalKey) continue;

      if (seen.has(canonicalKey)) {
        const firstHeader = seen.get(canonicalKey)!;
        duplicates.push({
          header1: firstHeader,
          header2: rawHeader,
          canonicalKey,
        });
      } else {
        seen.set(canonicalKey, rawHeader);
      }
    }

    if (duplicates.length > 0) {
      const dup = duplicates[0];
      return {
        valid: false,
        duplicateError: `DUPLICATE_CANONICAL_COLUMN: Header '${dup.header2}' and '${dup.header1}' both map to canonical attribute ${dup.canonicalKey}. Please keep only one column.`,
        duplicates,
      };
    }

    return { valid: true };
  }
}

