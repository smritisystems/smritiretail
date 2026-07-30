/**
 * Project      : SMRITI Business OS
 * Component    : PRNVariableEngine (Rule SLP-003)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Platform Services
 */

import { Product } from "../../types.js";

export interface PRNTemplate {
  id: string;
  name: string;
  language: "TSPL" | "ZPL" | "EPL";
  widthMm: number;
  heightMm: number;
  gapMm: number;
  content: string;
  isDefault?: boolean;
}

export const DEFAULT_PRN_TEMPLATES: PRNTemplate[] = [
  {
    id: "tspl-standard-50x25",
    name: "Standard Retail 50x25mm (TSPL)",
    language: "TSPL",
    widthMm: 50,
    heightMm: 25,
    gapMm: 2,
    isDefault: true,
    content: `SIZE \${widthMm} mm, \${heightMm} mm
GAP \${gapMm} mm, 0 mm
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET PEEL OFF
SET CUTTER OFF
CLS
TEXT 20,15,"3",0,1,1,"\${item.name}"
TEXT 20,40,"2",0,1,1,"SKU: \${item.code} | MRP: \${item.mrp}"
BARCODE 20,65,"128",40,1,0,2,2,"\${item.barcode}"
TEXT 20,115,"3",0,1,1,"OUR PRICE: \${item.price}"
PRINT \${copies},1`,
  },
  {
    id: "zpl-zebra-400x200",
    name: "Zebra Barcode Label (ZPL)",
    language: "ZPL",
    widthMm: 50,
    heightMm: 25,
    gapMm: 2,
    isDefault: false,
    content: `^XA
^PW400
^LL200
^FO20,15^A0N,22,22^FD\${item.name}^FS
^FO20,42^A0N,18,18^FDSKU:\${item.code} MRP:\${item.mrp}^FS
^FO20,68^BY2,3,38^BCN,38,Y,N,N^FD\${item.barcode}^FS
^FO20,122^A0N,22,22^FDPRICE: \${item.price}^FS
^PQ\${copies}
^XZ`,
  },
];

export class PRNVariableEngine {
  /**
   * Resolves dynamic template variables against item properties
   */
  static renderTemplate(template: PRNTemplate, item: Product, copies: number = 1): string {
    let script = template.content;

    const priceFormatted = `₹${Number(item.price || item.mrp || 0).toFixed(2)}`;
    const mrpFormatted = `₹${Number(item.mrp || item.price || 0).toFixed(2)}`;
    const nameSanitized = (item.name || "Item").slice(0, 24).replace(/["'\^\~]/g, "");
    const codeSanitized = (item.code || "").slice(0, 16).replace(/["'\^\~]/g, "");
    const barcodeSanitized = (item.barcode || item.code || "123456789").replace(/["'\^\~]/g, "");

    const variableMap: Record<string, string> = {
      "\${item.name}": nameSanitized,
      "\${item.code}": codeSanitized,
      "\${item.barcode}": barcodeSanitized,
      "\${item.price}": priceFormatted,
      "\${item.mrp}": mrpFormatted,
      "\${item.color}": item.color || "N/A",
      "\${item.size}": item.size || "OS",
      "\${item.hsn}": item.hsnCode || (item as any).hsn || "620520",
      "\${widthMm}": template.widthMm.toString(),
      "\${heightMm}": template.heightMm.toString(),
      "\${gapMm}": template.gapMm.toString(),
      "\${copies}": Math.max(1, copies).toString(),
    };

    for (const [key, val] of Object.entries(variableMap)) {
      script = script.replaceAll(key, val);
    }

    return script;
  }
}
