/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-25
 * Modified     : 2026-07-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type SkuMode = "manual" | "hybrid" | "auto";

export type SkuFormatPattern = 
  | "STYLE_COLOR_SIZE"          // StyleCode + Color + Size (Default e.g. STL101-RED-XL)
  | "STYLE_SIZE_COLOR"          // StyleCode + Size + Color (e.g. STL101-XL-RED)
  | "CAT_STYLE_COLOR_SIZE"      // Category + Style + Color + Size (e.g. APP-STL101-RED-XL)
  | "BRAND_STYLE_COLOR_SIZE"    // Brand + Style + Color + Size (e.g. NIK-STL101-RED-XL)
  | "CUSTOM";                   // Custom user token pattern format

export interface SkuGeneratorParams {
  mode: SkuMode;
  manualSku?: string;
  hybridPrefix?: string;
  formatPattern?: SkuFormatPattern;
  customTemplate?: string;
  styleCode?: string;
  color?: string;
  size?: string;
  category?: string;
  brand?: string;
  sequence?: number | string;
}

export const PRESET_SKU_TEMPLATES = [
  { id: "STYLE_COLOR_SIZE", label: "Style Code + Color + Size", formula: "{style}-{color}-{size}" },
  { id: "STYLE_SIZE_COLOR", label: "Style Code + Size + Color", formula: "{style}-{size}-{color}" },
  { id: "CAT_STYLE_COLOR_SIZE", label: "Category + Style Code + Color + Size", formula: "{category}-{style}-{color}-{size}" },
  { id: "BRAND_STYLE_COLOR_SIZE", label: "Brand + Style Code + Color + Size", formula: "{brand}-{style}-{color}-{size}" },
  { id: "CUSTOM", label: "Custom Configured Format...", formula: "{style}-{color}-{size}" },
];

/**
 * Sanitizes an attribute string for SKU codes (uppercase, alphanumeric + hyphens).
 */
export function sanitizeSkuToken(val?: string, maxLen: number = 20): string {
  if (!val) return "";
  return val.trim().toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, maxLen);
}

/**
 * Core SKU Generation Engine supporting Manual, Hybrid, and Auto modes.
 */
export function generateSkuCode(params: SkuGeneratorParams): string {
  const {
    mode,
    manualSku = "",
    hybridPrefix = "",
    formatPattern = "STYLE_COLOR_SIZE",
    customTemplate = "{style}-{color}-{size}",
    styleCode = "",
    color = "",
    size = "",
    category = "",
    brand = "",
    sequence = "",
  } = params;

  // 1. Manual Mode: return raw manual value
  if (mode === "manual") {
    return manualSku.trim().toUpperCase();
  }

  // Sanitize individual component tokens
  const tokenStyle = sanitizeSkuToken(styleCode, 15) || "STL";
  const tokenColor = sanitizeSkuToken(color, 10);
  const tokenSize = sanitizeSkuToken(size, 8);
  const tokenCategory = sanitizeSkuToken(category, 6);
  const tokenBrand = sanitizeSkuToken(brand, 6);
  const tokenSeq = sequence ? String(sequence).padStart(4, "0") : "";

  // 2. Auto Mode: format based on selected pattern formula
  let baseSku = "";

  if (formatPattern === "CUSTOM" && customTemplate) {
    baseSku = customTemplate
      .replace(/{style}/gi, tokenStyle)
      .replace(/{color}/gi, tokenColor)
      .replace(/{size}/gi, tokenSize)
      .replace(/{category}/gi, tokenCategory)
      .replace(/{brand}/gi, tokenBrand)
      .replace(/{seq}/gi, tokenSeq);
    
    // Clean up orphan trailing or double hyphens
    baseSku = baseSku.replace(/-+/g, "-").replace(/^-|-$/g, "");
  } else {
    // Standard Presets
    switch (formatPattern) {
      case "STYLE_SIZE_COLOR": {
        const parts = [tokenStyle, tokenSize, tokenColor].filter(Boolean);
        baseSku = parts.join("-");
        break;
      }
      case "CAT_STYLE_COLOR_SIZE": {
        const parts = [tokenCategory, tokenStyle, tokenColor, tokenSize].filter(Boolean);
        baseSku = parts.join("-");
        break;
      }
      case "BRAND_STYLE_COLOR_SIZE": {
        const parts = [tokenBrand, tokenStyle, tokenColor, tokenSize].filter(Boolean);
        baseSku = parts.join("-");
        break;
      }
      case "STYLE_COLOR_SIZE":
      default: {
        const parts = [tokenStyle, tokenColor, tokenSize].filter(Boolean);
        baseSku = parts.join("-");
        break;
      }
    }
  }

  // 3. Hybrid Mode: Prefix + Auto-Generated attributes
  if (mode === "hybrid") {
    const cleanPrefix = sanitizeSkuToken(hybridPrefix, 20);
    if (!cleanPrefix) {
      return baseSku;
    }
    const attrParts = [tokenColor, tokenSize].filter(Boolean);
    return attrParts.length > 0 ? `${cleanPrefix}-${attrParts.join("-")}` : cleanPrefix;
  }

  return baseSku;
}
