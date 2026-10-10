/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.50.0
 * Created      : 2026-10-10
 * Modified     : 2026-10-10
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: PRN & Thermal Script Template Token Interpolation Engine
 */

export interface PrnItemData {
  stockNo?: string;
  barcode?: string;
  product?: string;
  brand?: string;
  style?: string;
  colour?: string;
  size?: string;
  mrp?: number;
  sellingPrice?: number;
  labelCount?: number;
}

/**
 * Built-in Master Templates for common thermal label layouts
 */
export const BUILTIN_PRN_TEMPLATES: Record<string, string> = {
  "Tattly Threads Footwear — 100x50.7mm": `<xpml><page quantity='0' pitch='50.7 mm'></xpml>^XA
^SZ2^JMA
^MCY^PMN
^PW804
^JZY
^LH0,0^LRN
^XZ
<xpml></page></xpml><xpml><page quantity='1' pitch='50.7 mm'></xpml>^XA
^FO346,305
^BY2^BCN,66,N,N^FD{barcode}^FS
^FT390,399
^CI0
^AAN,27,15^FD{barcode}^FS
^FT772,357
^A0B,34,46^FD{brand}^FS
^FT355,271
^ADN,18,10^FD81,Umerkhadi,Mumbai,400003^FS
^FT355,289
^ADN,18,10^FDcare@tattlythreads.com^FS
^FO627,62
^GB70,67,67^FS
^FT627,116
^A0N,65,72^FR^FD{size}^FS
^FT405,111
^A0N,37,49^FD{colour}^FS
^FO416,15
^GB284,47,47^FS
^FT416,54
^A0N,45,44^FR^FD{style_code}     ^FS
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
^A0N,28,38^FD{colour}^FS
^FT37,34
^A0N,28,27^FD{style_code}^FS
^FT17,146
^ABB,11,7^FD{brand}^FS
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
^A0N,28,38^FD{colour}^FS
^FT33,260
^A0N,28,27^FD{style_code}^FS
^FT16,372
^ABB,11,7^FD{brand}^FS
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
^PQ1,0,1,Y
^XZ
<xpml></page></xpml><xpml><end/></xpml>`,

  "Retail 50x25mm Standard": `^XA
^PW400
^LL200
^FO20,15^A0N,22,22^FD{brand}^FS
^FO20,40^A0N,18,18^FD{product}^FS
^FO20,62^A0N,16,16^FDArt: {style_code}  Sz: {size}^FS
^FO20,85^BY2^BCN,50,Y,N,N^FD{barcode}^FS
^FO20,155^A0N,22,22^FDMRP: Rs. {mrp}/-^FS
^XZ`,

  "ModernLabelDesign_TE244.blf": `<xpml><page quantity='0' pitch='50.7 mm'></xpml>^XA
^SZ2^JMA
^MCY^PMN
^PW804
^JZY
^LH0,0^LRN
^XZ
<xpml></page></xpml><xpml><page quantity='1' pitch='50.7 mm'></xpml>^XA
^FO346,305
^BY2^BCN,66,N,N^FD{barcode}^FS
^FT390,399
^CI0
^AAN,27,15^FD{barcode}^FS
^FT772,357
^A0B,34,46^FD{brand}^FS
^FT355,271
^ADN,18,10^FD81,Umerkhadi,Mumbai,400003^FS
^FT355,289
^ADN,18,10^FDcare@tattlythreads.com^FS
^FO627,62
^GB70,67,67^FS
^FT627,116
^A0N,65,72^FR^FD{size}^FS
^FT405,111
^A0N,37,49^FD{colour}^FS
^FO416,15
^GB284,47,47^FS
^FT416,54
^A0N,45,44^FR^FD{style_code}     ^FS
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
^A0N,28,38^FD{colour}^FS
^FT37,34
^A0N,28,27^FD{style_code}^FS
^FT17,146
^ABB,11,7^FD{brand}^FS
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
^A0N,28,38^FD{colour}^FS
^FT33,260
^A0N,28,27^FD{style_code}^FS
^FT16,372
^ABB,11,7^FD{brand}^FS
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
^PQ1,0,1,Y
^XZ
<xpml></page></xpml><xpml><end/></xpml>`,

  "Honeywell_IH2_DualStub.prn": `\x02L
D11
191100000200020{brand}
191100000500020{product} - {style_code}
191100000800020Shade: {colour}  Size: {size}
1e4202001100020{barcode}
191100001500020MRP: Rs. {mrp}  SP: Rs. {selling_price}
E`
};

/**
 * Detects protocol of a given raw script text
 */
export function detectPrnProtocol(scriptText: string): "ZPL" | "DPL" | "TSPL" {
  if (!scriptText) return "ZPL";
  if (scriptText.includes("^XA") || scriptText.includes("^XZ")) return "ZPL";
  if (scriptText.includes("\x02L") || scriptText.includes("D11") || scriptText.trim().startsWith("1911")) return "DPL";
  if (scriptText.includes("SIZE ") || scriptText.includes("GAP ") || scriptText.includes("CLS")) return "TSPL";
  return "ZPL";
}

/**
 * Interpolates a single label's item data into a template PRN/ZPL/DPL script
 */
export function interpolatePrnScript(templateText: string, item: PrnItemData): string {
  if (!templateText) return "";

  const barcode = item.barcode || item.stockNo || "890100000000";
  const style = item.style && item.style !== "-" ? item.style : (item.stockNo || "CH-30-K");
  const brand = (item.brand || "TATTLY THREADS").toUpperCase();
  const product = item.product || "Footwear Item";
  const colour = (item.colour && item.colour !== "-" ? item.colour : "BLACK").toUpperCase();
  const size = item.size && item.size !== "-" ? item.size : "37";
  const mrp = String(item.mrp ?? 1199);
  const sp = String(item.sellingPrice ?? item.mrp ?? 1199);
  const pkd = "10/26";

  let out = templateText;

  // 1. Bracket style tokens: {barcode}, {style_code}, {style}, {colour}, {color}, {size}, {mrp}, etc.
  out = out
    .replace(/\{barcode\}/gi, barcode)
    .replace(/\{style_code\}/gi, style)
    .replace(/\{style\}/gi, style)
    .replace(/\{art_no\}/gi, style)
    .replace(/\{artno\}/gi, style)
    .replace(/\{brand\}/gi, brand)
    .replace(/\{product\}/gi, product)
    .replace(/\{name\}/gi, product)
    .replace(/\{colour\}/gi, colour)
    .replace(/\{color\}/gi, colour)
    .replace(/\{shade\}/gi, colour)
    .replace(/\{size\}/gi, size)
    .replace(/\{mrp\}/gi, mrp)
    .replace(/\{price\}/gi, sp)
    .replace(/\{selling_price\}/gi, sp)
    .replace(/\{sp\}/gi, sp)
    .replace(/\{pkd_date\}/gi, pkd)
    .replace(/\{mfg_date\}/gi, pkd)
    .replace(/\{net_contents\}/gi, "1 Pair Footwear")
    .replace(/\{company_name\}/gi, "Tattly Threads");

  // 2. Hash style tokens: #BARCODE#, #STYLE#, #ARTNO#, #COLOR#, #SIZE#, #MRP#, etc.
  out = out
    .replace(/#BARCODE#/gi, barcode)
    .replace(/#CODE#/gi, item.stockNo || barcode)
    .replace(/#STYLE_CODE#/gi, style)
    .replace(/#STYLE#/gi, style)
    .replace(/#ARTNO#/gi, style)
    .replace(/#BRAND#/gi, brand)
    .replace(/#PRODUCT#/gi, product)
    .replace(/#NAME#/gi, product)
    .replace(/#COLOUR#/gi, colour)
    .replace(/#COLOR#/gi, colour)
    .replace(/#SHADE#/gi, colour)
    .replace(/#SIZE#/gi, size)
    .replace(/#MRP#/gi, mrp)
    .replace(/#PRICE#/gi, sp)
    .replace(/#SP#/gi, sp)
    .replace(/#PKD_DATE#/gi, pkd)
    .replace(/#MFG_DATE#/gi, pkd);

  // 3. Fallback for static sample templates (e.g. ModernLabelDesign_TE244.blf with hardcoded samples)
  const hadTokens = /\{[a-z_]+\}|#[a-z_]+#/i.test(templateText);
  if (!hadTokens) {
    out = out
      .replace(/890100000006/g, barcode)
      .replace(/CH-30-K/g, style)
      .replace(/1199\/-/g, `${mrp}/-`);
  }

  return out;
}

/**
 * Compiles a batch of items repeating each for item.labelCount
 */
export function compilePrnBatch(templateText: string, items: PrnItemData[]): string {
  let stream = "";
  items.forEach(item => {
    const count = Math.max(1, item.labelCount ?? 1);
    for (let i = 0; i < count; i++) {
      stream += interpolatePrnScript(templateText, item) + "\n";
    }
  });
  return stream;
}
