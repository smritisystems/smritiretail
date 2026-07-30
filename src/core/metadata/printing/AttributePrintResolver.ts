/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Metadata Platform (SMP-M)
 * Component    : AttributePrintResolver (Universal Label & Barcode Print Engine - ULBE)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { UniversalAttributeEngine } from "../attributes/UniversalAttributeEngine.js";

export class AttributePrintResolver {
  /**
   * Resolves dynamic template variables against item attributes and metadata definitions
   */
  static resolvePrintScript(templateScript: string, item: any, copies: number = 1): string {
    let script = templateScript;

    // Direct metadata resolution via UAME
    const attrValues = UniversalAttributeEngine.resolveValues(item);
    const attributes = UniversalAttributeEngine.getAttributes();

    const priceFormatted = Number(item.price || item.mrp || 0).toFixed(2);
    const mrpFormatted = Number(item.mrp || item.price || 0).toFixed(2);
    const barcodeVal = String(item.barcode || item.itemCode || item.code || "8901234567890");
    const pkdDateVal = String(item.pkd_date || item.mfgDate || "05/2025");

    // Standard Direct Placeholders
    const standardMap: Record<string, string> = {
      "{barcode}": barcodeVal,
      "{mrp}": mrpFormatted,
      "{pkd_date}": pkdDateVal,
      "{copies}": Math.max(1, copies).toString(),
      "\\${copies}": Math.max(1, copies).toString(),
    };

    for (const [key, val] of Object.entries(standardMap)) {
      script = script.replaceAll(key, val);
    }

    // Dynamic Attribute Interpolation for {{Attribute.xxx}}, {attributeCode}, and ${item.xxx}
    for (const attr of attributes) {
      const code = attr.attributeCode;
      const val = attrValues[code] || item[code] || "-";

      script = script.replaceAll(`{{Attribute.${code}}}`, val);
      script = script.replaceAll(`{{Attribute.${attr.internalName}}}`, val);
      script = script.replaceAll(`{${code}}`, val);
      script = script.replaceAll(`\${item.${code}}`, val);
    }

    return script;
  }
}
