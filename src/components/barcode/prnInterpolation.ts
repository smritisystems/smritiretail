/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.72.8
 * Created      : 2026-10-10
 * Modified     : 2026-10-13
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
  vendorCode?: string;
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

// Aliases ensuring Tattly Threads Footwear PRN is universal default
BUILTIN_PRN_TEMPLATES["TattlyThreads.prn"] = BUILTIN_PRN_TEMPLATES["Tattly Threads Footwear — 100x50.7mm"];
BUILTIN_PRN_TEMPLATES["lay-footwear-100x50-3stub"] = BUILTIN_PRN_TEMPLATES["Tattly Threads Footwear — 100x50.7mm"];
BUILTIN_PRN_TEMPLATES["default"] = BUILTIN_PRN_TEMPLATES["Tattly Threads Footwear — 100x50.7mm"];

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
 * Formats Article / Style code for barcode label printing by combining base style
 * with vendor code per client governance:
 * Example: style "CH-01" and vendor "A" -> "CH-01-A-" (single-letter vendor retains trailing dash)
 * In-house vendor "TT" (or multi-letter vendor): "CH-501" and vendor "TT" -> "CH-501-TT" (no trailing dash)
 */
export function formatStyleForBarcodeLabel(rawStyle?: string, vendorCode?: string): string {
  if (!rawStyle || rawStyle === "-") return "CH-30-K";
  let style = rawStyle.trim().replace(/^[,"'\s]+/, "").trim();
  let vendor = (vendorCode || "").trim().toUpperCase();

  // Normalize legacy vendor prefixes (e.g., V-00A -> A)
  if (vendor.startsWith("V-00") && vendor.length > 4) {
    vendor = vendor.substring(4);
  }

  if (vendor) {
    // In-house vendor "TT" or multi-letter vendor codes do not have a trailing hyphen
    if (vendor === "TT" || vendor.length > 1) {
      if (style.toUpperCase().endsWith(`-${vendor}-`)) {
        return style.slice(0, -1);
      }
      if (style.toUpperCase().endsWith(`-${vendor}`)) {
        return style;
      }
      return `${style}-${vendor}`;
    }

    // Single-letter vendors (A through N, V, etc.) retain trailing delimiter
    if (style.toUpperCase().endsWith(`-${vendor}-`)) {
      return style;
    }
    if (style.toUpperCase().endsWith(`-${vendor}`)) {
      return `${style}-`;
    }
    return `${style}-${vendor}-`;
  }

  return style;
}

/**
 * Interpolates a single label's item data into a template PRN/ZPL/DPL script
 */
export function interpolatePrnScript(templateText: string, item: PrnItemData): string {
  const activeTemplate = templateText || BUILTIN_PRN_TEMPLATES["Tattly Threads Footwear — 100x50.7mm"];
  if (!activeTemplate) return "";

  const barcode = item.barcode || item.stockNo || "890100000000";
  const rawStyle = item.style && item.style !== "-" ? item.style : (item.stockNo || "CH-30-K");
  const style = formatStyleForBarcodeLabel(rawStyle, item.vendorCode);
  const vendor = (item.vendorCode || "").toUpperCase();
  const brand = (item.brand || "TATTLY THREADS").toUpperCase();
  const product = item.product || "Footwear Item";
  const colour = (item.colour && item.colour !== "-" ? item.colour : "BLACK").toUpperCase();
  const size = item.size && item.size !== "-" ? item.size : "37";
  const mrp = String(item.mrp ?? 1199);
  const sp = String(item.sellingPrice ?? item.mrp ?? 1199);
  const pkd = "10/26";

  let out = activeTemplate;

  // 1. Bracket style tokens: {barcode}, {style_code}, {style}, {colour}, {color}, {size}, {mrp}, etc.
  out = out
    .replace(/\{barcode\}/gi, barcode)
    .replace(/\{style_code\}/gi, style)
    .replace(/\{style\}/gi, style)
    .replace(/\{art_no\}/gi, style)
    .replace(/\{artno\}/gi, style)
    .replace(/\{vendor_code\}/gi, vendor)
    .replace(/\{vendor\}/gi, vendor)
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
    .replace(/#VENDOR_CODE#/gi, vendor)
    .replace(/#VENDOR#/gi, vendor)
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
  const hadTokens = /\{[a-z_]+\}|#[a-z_]+#/i.test(activeTemplate);
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
  const activeTemplate = templateText || BUILTIN_PRN_TEMPLATES["Tattly Threads Footwear — 100x50.7mm"];
  let stream = "";
  items.forEach(item => {
    const count = Math.max(1, item.labelCount ?? 1);
    for (let i = 0; i < count; i++) {
      stream += interpolatePrnScript(activeTemplate, item) + "\n";
    }
  });
  return stream;
}

/**
 * Formats a Date object into human-readable, chronologically sortable timestamp:
 * YYYYMMDD-HHmmss (e.g. "20261013-120530")
 */
export function formatPrnTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

/**
 * Sanitizes a string token for safe file names across Windows, POSIX, and FAT32/USB filesystems.
 */
export function sanitizeFilenameToken(token?: string, fallback: string = ""): string {
  if (!token) return fallback;
  const clean = token
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || fallback;
}

/**
 * Generates canonical SMRITI PRN download filename:
 * SMRITI-[Style]-[VendorCode]-[Timestamp].[ext]
 *
 * Pattern:
 *   SMRITI-{Style}-{VendorCode}-{YYYYMMDD-HHmmss}.{ext}
 *
 * Behavior:
 *   - Single product or uniform batch: "SMRITI-CH-30-K-TATTLY-20261013-120530.prn"
 *   - Multi-style batch: "SMRITI-CH-30-K+2MORE-TATTLY-20261013-120530.prn"
 *   - Empty/fallback: "SMRITI-CH-30-K-TATTLY-20261013-120530.prn"
 */
export function generatePrnDownloadFilename(
  items?: PrnItemData[] | PrnItemData,
  extension: "prn" | "zpl" | "dpl" | "txt" = "prn",
  options?: {
    prefix?: string;
    fallbackStyle?: string;
    fallbackVendor?: string;
    date?: Date;
  }
): string {
  const prefix = sanitizeFilenameToken(options?.prefix, "SMRITI");
  const timeStamp = formatPrnTimestamp(options?.date || new Date());
  const ext = extension.toLowerCase().replace(/^\./, "");

  const itemList: PrnItemData[] = Array.isArray(items) ? items : items ? [items] : [];

  if (itemList.length === 0) {
    const style = sanitizeFilenameToken(options?.fallbackStyle, "CH-30-K");
    const vendor = sanitizeFilenameToken(options?.fallbackVendor, "TATTLY");
    return `${prefix}-${style}-${vendor}-${timeStamp}.${ext}`;
  }

  // Extract unique styles and vendor codes
  const styles = Array.from(
    new Set(
      itemList
        .map(i => sanitizeFilenameToken(i.style || i.stockNo))
        .filter(Boolean)
    )
  );

  const vendors = Array.from(
    new Set(
      itemList
        .map(i => sanitizeFilenameToken(i.vendorCode || i.brand))
        .filter(Boolean)
    )
  );

  let stylePart = "ITEM";
  if (styles.length === 1) {
    stylePart = styles[0];
  } else if (styles.length > 1) {
    stylePart = `${styles[0]}+${styles.length - 1}MORE`;
  } else {
    stylePart = sanitizeFilenameToken(options?.fallbackStyle, "CH-30-K");
  }

  let vendorPart = "TATTLY";
  if (vendors.length === 1) {
    vendorPart = vendors[0];
  } else if (vendors.length > 1) {
    vendorPart = `${vendors[0]}+${vendors.length - 1}VND`;
  } else {
    vendorPart = sanitizeFilenameToken(options?.fallbackVendor, "TATTLY");
  }

  return `${prefix}-${stylePart}-${vendorPart}-${timeStamp}.${ext}`;
}

