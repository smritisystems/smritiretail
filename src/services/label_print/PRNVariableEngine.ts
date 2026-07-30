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

export const TATTLY_THREADS_ZPL_SCRIPT = `<xpml><page quantity='0' pitch='50.7 mm'></xpml>^XA
^SZ2^JMA
^MCY^PMN
^PW804
^JZY
^LH0,0^LRN
^XZ
<xpml></page></xpml><xpml><page quantity='1' pitch='50.7 mm'></xpml>^XA
^FO346,305
^BY2^BCN,66,N,N^FD{barcode}^FS
^FT390,385
^CI0
^AAN,27,15^FD{barcode}^FS
^FT772,357
^A0B,34,46^FDTATTLY THREADS^FS
^FT355,271
^ADN,18,10^FD81,Umerkhadi,Mumbai,400003^FS
^FT355,289
^ADN,18,10^FDcare@tattlythreads.com^FS
^FO627,62
^GB70,67,67^FS
^FT627,116
^A0N,65,72^FR^FD{size}^FS
^FT405,111
^A0N,37,49^FD{color}^FS
^FO416,15
^GB284,47,47^FS
^FT416,54
^A0N,45,44^FR^FD{style}     ^FS
^FO332,13
^GB367,117,3^FS
^FO334,57
^GB337,0,3^FS
^FT490,199
^A0N,17,23^FD |(Incl of all taxes)^FS
^FT488,175
^A0N,42,56^FD{mrp}/-^FS
^FT408,170
^A0N,28,38^FDMRP:^FS
^FT355,199
^A0N,17,23^FDMFG.Dt.:{pkd_date}^FS
^FT355,215
^ABN,11,7^FDNET CONTENTS:1 Pair Footwear^FS
^FT340,41
^A0N,17,23^FDArt.No.^FS
^FT340,103
^A0N,17,23^FDColor:^FS
^FO34,112
^BY1^BCN,30,N,N^FD{barcode}^FS
^FT26,165
^A0N,25,34^FD{barcode}^FS
^FO37,47
^GB70,67,67^FS
^FT37,101
^A0N,65,72^FR^FD{size}^FS
^FT116,63
^A0N,28,38^FD{color}^FS
^FT37,34
^A0N,28,27^FD{style}^FS
^FT17,146
^ABB,11,7^FDTATTLY THREADS^FS
^FT116,84
^A0N,20,27^FDMRP:{mrp}/-^FS
^FT116,101
^A0N,17,23^FD(Incl of all taxes)^FS
^FO33,338
^BY1^BCN,30,N,N^FD{barcode}^FS
^FT26,394
^A0N,25,34^FD{barcode}^FS
^FO33,274
^GB70,67,67^FS
^FT33,328
^A0N,65,72^FR^FD{size}^FS
^FT116,289
^A0N,28,38^FD{color}^FS
^FT33,260
^A0N,28,27^FD{style}^FS
^FT16,372
^ABB,11,7^FDTATTLY THREADS^FS
^FT116,310
^A0N,20,27^FDMRP:{mrp}/-^FS
^FT116,327
^A0N,17,23^FD(Incl of all taxes)^FS
^FO731,0
^GB0,405,3^FS
^FO324,236
^GB407,0,3^FS
^FT355,261
^A0N,20,27^FDMKTD.By:Tattly Threads^FS
^PQ{copies},0,1,Y
^XZ
<xpml></page></xpml><xpml><end/></xpml>`;

export const DEFAULT_PRN_TEMPLATES: PRNTemplate[] = [
  {
    id: "zpl-tattly-threads-footwear",
    name: "Tattly Threads Dual Barcode Tag (ZPL)",
    language: "ZPL",
    widthMm: 100,
    heightMm: 50.7,
    gapMm: 3,
    isDefault: true,
    content: TATTLY_THREADS_ZPL_SCRIPT,
  },
  {
    id: "tspl-standard-50x25",
    name: "Standard Retail 50x25mm (TSPL)",
    language: "TSPL",
    widthMm: 50,
    heightMm: 25,
    gapMm: 2,
    isDefault: false,
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
    name: "Standard Zebra Single Label (ZPL)",
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
  static renderTemplate(template: PRNTemplate | string, item: Product | any, copies: number = 1): string {
    let script = typeof template === "string" ? template : template.content;

    const priceFormatted = Number(item.price || item.mrp || 0).toFixed(2);
    const mrpFormatted = Number(item.mrp || item.price || 0).toFixed(2);
    const barcodeVal = String(item.barcode || item.itemCode || item.code || "8901234567890");
    const sizeVal = String(item.size || item.sizeMm || "8");
    const colorVal = String(item.color || "BLACK");
    const styleVal = String(item.style || item.styleCode || item.itemCode || "SHO-1001");
    const pkdDateVal = String(item.pkd_date || item.mfgDate || "05/2025");

    const variableMap: Record<string, string> = {
      "{barcode}": barcodeVal,
      "{size}": sizeVal,
      "{color}": colorVal,
      "{style}": styleVal,
      "{mrp}": mrpFormatted,
      "{pkd_date}": pkdDateVal,

      "\${item.name}": String(item.name || item.itemName || "Item"),
      "\${item.code}": String(item.code || item.itemCode || ""),
      "\${item.barcode}": barcodeVal,
      "\${item.price}": priceFormatted,
      "\${item.mrp}": mrpFormatted,
      "\${item.color}": colorVal,
      "\${item.size}": sizeVal,
      "\${item.hsn}": String(item.hsnCode || item.hsn || "6404"),
      "\${copies}": Math.max(1, copies).toString(),
    };

    for (const [key, val] of Object.entries(variableMap)) {
      script = script.replaceAll(key, val);
    }

    return script;
  }
}
