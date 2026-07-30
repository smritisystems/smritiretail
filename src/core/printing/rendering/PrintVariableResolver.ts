/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : PrintVariableResolver (Integrated with SMP-M Metadata Platform — Rule SUPP-008)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { UniversalAttributeEngine } from "../../metadata/attributes/UniversalAttributeEngine.js";
import { PrintDocument } from "../models/PrintDocument.js";

export class PrintVariableResolver {
  /**
   * Resolves template variables using SMRITI Metadata Platform (SMP-M) attribute definitions
   */
  static resolveDocument(document: PrintDocument, activeItem: any = {}): string {
    let script = document.content;

    // 1. Resolve metadata attributes via SMP-M
    const attrValues = UniversalAttributeEngine.resolveValues(activeItem);
    const attributes = UniversalAttributeEngine.getAttributes();

    const barcodeVal = String(activeItem.barcode || activeItem.itemCode || activeItem.code || "8901234567890");
    const mrpFormatted = Number(activeItem.mrp || activeItem.price || 0).toFixed(2);
    const pkdDateVal = String(activeItem.pkd_date || activeItem.mfgDate || "05/2025");

    const directMap: Record<string, string> = {
      "{barcode}": barcodeVal,
      "{mrp}": mrpFormatted,
      "{pkd_date}": pkdDateVal,
    };

    for (const [k, v] of Object.entries(directMap)) {
      script = script.replaceAll(k, v);
    }

    // 2. Resolve {{Attribute.xxx}} and {attributeCode} placeholders from SMP-M
    for (const attr of attributes) {
      const code = attr.attributeCode;
      const val = attrValues[code] || activeItem[code] || "-";

      script = script.replaceAll(`{{Attribute.${code}}}`, val);
      script = script.replaceAll(`{{Attribute.${attr.internalName}}}`, val);
      script = script.replaceAll(`{${code}}`, val);
      script = script.replaceAll(`\${item.${code}}`, val);
    }

    return script;
  }
}
