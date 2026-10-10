/*
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.49
 * Created      : 2026-10-10
 * Modified     : 2026-10-10
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Module       : Protocol-Agnostic Barcode Layout Registry & Multi-Protocol Client Engine
 */

export type ElementType =
  | "text"
  | "inverted_box"
  | "box"
  | "line"
  | "barcode_128"
  | "qr_code"
  | "image";

export interface LabelElement {
  id: string;
  type: ElementType;
  xMm: number;
  yMm: number;
  widthMm?: number;
  heightMm?: number;
  strokeWidthMm?: number;
  fontSizePt?: number;
  fontWeight?: "normal" | "bold" | "900";
  fontFamily?: string;
  rotationDeg?: 0 | 90 | 180 | 270;
  fieldBinding?: string;
  textBinding?: string;
  staticText?: string;
  showHri?: boolean;
  fillColor?: string;
  strokeColor?: string;
}

export interface UnifiedLabelTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  defaultDpi: number;
  description?: string;
  elements: LabelElement[];
}

export interface LabelItemData {
  code?: string;
  barcode?: string;
  name?: string;
  brand?: string;
  style?: string;
  color?: string;
  size?: string;
  mrp?: number;
  price?: number;
  qty?: number;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  mfgDate?: string;
  netContents?: string;
  [key: string]: any;
}

function resolveValue(binding?: string, item?: LabelItemData, defaultValue = ""): string {
  if (!binding || !item) return defaultValue;
  const cleanKey = binding.replace(/^item\./, "").trim();
  const val = (item as any)[cleanKey];
  if (val !== undefined && val !== null) {
    if (typeof val === "number") {
      return Number.isInteger(val) ? String(val) : val.toFixed(2);
    }
    return String(val);
  }
  return defaultValue;
}

function escapeXml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTemplateToSvg(
  template: UnifiedLabelTemplate,
  item?: LabelItemData,
  previewScale = 1.0
): string {
  const fallbackItem: LabelItemData = {
    code: "000006",
    barcode: "890100000006",
    name: "Tattly Threads Footwear",
    brand: "TATTLY THREADS",
    style: "CH-30-K",
    color: "BLACK",
    size: "37",
    mrp: 1199,
    price: 1199,
    companyName: "Tattly Threads",
    companyAddress: "81,Umerkhadi,Mumbai,400003",
    companyEmail: "care@tattlythreads.com",
    mfgDate: "10/26",
    netContents: "NET CONTENTS:1 Pair Footwear",
  };

  const activeItem = item || fallbackItem;
  const wMm = template.widthMm;
  const hMm = template.heightMm;
  const viewW = Math.round(wMm * 8.0);
  const viewH = Math.round(hMm * 8.0);

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wMm}mm" height="${hMm}mm" viewBox="0 0 ${viewW} ${viewH}">`,
    `  <rect width="${viewW}" height="${viewH}" fill="#ffffff" stroke="#d1d5db" stroke-width="1"/>`,
  ];

  template.elements.forEach((el) => {
    const x = Math.round(el.xMm * 8.0);
    const y = Math.round(el.yMm * 8.0);
    const w = Math.round((el.widthMm || 10.0) * 8.0);
    const h = Math.round((el.heightMm || 5.0) * 8.0);
    const strokeW = Math.max(1, Math.round((el.strokeWidthMm || 0.3) * 8.0));

    if (el.type === "text") {
      const rawVal = el.staticText || resolveValue(el.fieldBinding, activeItem);
      const val = escapeXml(rawVal);
      const fSize = Math.round((el.fontSizePt || 10.0) * 1.33);
      const fWeight = el.fontWeight || "normal";
      const rot = el.rotationDeg || 0;
      const transformAttr = rot !== 0 ? ` transform="rotate(${rot} ${x},${y})"` : "";
      lines.push(
        `  <text x="${x}" y="${y}" font-family="${el.fontFamily || "Arial"}, sans-serif" font-size="${fSize}" font-weight="${fWeight}" fill="${el.fillColor || "#000000"}"${transformAttr}>${val}</text>`
      );
    } else if (el.type === "inverted_box") {
      const rawVal = el.staticText || resolveValue(el.textBinding || el.fieldBinding, activeItem);
      const val = escapeXml(rawVal);
      const fSize = Math.round((el.fontSizePt || 16.0) * 1.33);
      lines.push(`  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000000" rx="3"/>`);
      lines.push(
        `  <text x="${x + Math.round(w / 2)}" y="${y + h - 6}" font-family="Arial, sans-serif" font-size="${fSize}" font-weight="900" fill="#ffffff" text-anchor="middle">${val}</text>`
      );
    } else if (el.type === "box") {
      lines.push(
        `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${el.strokeColor || "#000000"}" stroke-width="${strokeW}"/>`
      );
    } else if (el.type === "line") {
      if ((el.heightMm || 0) > (el.widthMm || 0)) {
        lines.push(
          `  <line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${el.strokeColor || "#000000"}" stroke-width="${strokeW}"/>`
        );
      } else {
        lines.push(
          `  <line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${el.strokeColor || "#000000"}" stroke-width="${strokeW}"/>`
        );
      }
    } else if (el.type === "barcode_128") {
      const rawVal = resolveValue(el.fieldBinding, activeItem, activeItem.barcode || activeItem.code || "890100000001");
      const val = escapeXml(rawVal);
      lines.push(`  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#111827"/>`);
      if (el.showHri) {
        lines.push(
          `  <text x="${x + Math.round(w / 2)}" y="${y + h + 14}" font-family="monospace" font-size="12" font-weight="bold" fill="#000000" text-anchor="middle">${val}</text>`
        );
      }
    }
  });

  lines.push("</svg>");
  return lines.join("\n");
}

export const BUILTIN_LABEL_TEMPLATES: UnifiedLabelTemplate[] = [
  {
    id: "tattly-threads-footwear-100x50.7",
    name: "Tattly Threads Footwear — 100x50.7mm",
    widthMm: 100.0,
    heightMm: 50.7,
    defaultDpi: 203,
    description: "Standard 3-Part Footwear Box Tag with Upper Counter Stub and Lower Audit Stub",
    elements: [
      { id: "div_vert", type: "line", xMm: 31.2, yMm: 0.0, widthMm: 0.0, heightMm: 50.7, strokeWidthMm: 0.3, strokeColor: "#9ca3af" },
      { id: "div_horiz_stub", type: "line", xMm: 0.0, yMm: 25.3, widthMm: 31.2, heightMm: 0.0, strokeWidthMm: 0.3, strokeColor: "#9ca3af" },

      // Stub 1 (Upper Counter Stub)
      { id: "s1_brand", type: "text", xMm: 2.1, yMm: 18.2, fontSizePt: 8, fontWeight: "bold", rotationDeg: 270, fieldBinding: "item.brand" },
      { id: "s1_art_no", type: "text", xMm: 4.6, yMm: 4.2, fontSizePt: 10, fontWeight: "bold", fieldBinding: "item.style" },
      { id: "s1_size_box", type: "inverted_box", xMm: 4.6, yMm: 5.9, widthMm: 7.0, heightMm: 6.7, fontSizePt: 18, textBinding: "item.size" },
      { id: "s1_color", type: "text", xMm: 14.5, yMm: 7.9, fontSizePt: 10, fontWeight: "bold", fieldBinding: "item.color" },
      { id: "s1_mrp", type: "text", xMm: 14.5, yMm: 10.5, fontSizePt: 9, fontWeight: "bold", fieldBinding: "item.mrp" },
      { id: "s1_tax", type: "text", xMm: 14.5, yMm: 12.6, fontSizePt: 6, staticText: "(Incl of all taxes)" },
      { id: "s1_barcode", type: "barcode_128", xMm: 4.2, yMm: 14.0, widthMm: 22.5, heightMm: 3.2, showHri: true, fieldBinding: "item.barcode" },

      // Stub 2 (Lower Audit Stub)
      { id: "s2_brand", type: "text", xMm: 2.0, yMm: 46.5, fontSizePt: 8, fontWeight: "bold", rotationDeg: 270, fieldBinding: "item.brand" },
      { id: "s2_art_no", type: "text", xMm: 4.1, yMm: 32.5, fontSizePt: 10, fontWeight: "bold", fieldBinding: "item.style" },
      { id: "s2_size_box", type: "inverted_box", xMm: 4.1, yMm: 34.2, widthMm: 7.0, heightMm: 6.7, fontSizePt: 18, textBinding: "item.size" },
      { id: "s2_color", type: "text", xMm: 14.5, yMm: 36.1, fontSizePt: 10, fontWeight: "bold", fieldBinding: "item.color" },
      { id: "s2_mrp", type: "text", xMm: 14.5, yMm: 38.7, fontSizePt: 9, fontWeight: "bold", fieldBinding: "item.mrp" },
      { id: "s2_tax", type: "text", xMm: 14.5, yMm: 40.8, fontSizePt: 6, staticText: "(Incl of all taxes)" },
      { id: "s2_barcode", type: "barcode_128", xMm: 4.1, yMm: 42.2, widthMm: 22.5, heightMm: 3.2, showHri: true, fieldBinding: "item.barcode" },

      // Main Shoe Box Label
      { id: "m_header_box", type: "box", xMm: 41.5, yMm: 1.6, widthMm: 45.9, heightMm: 14.6, strokeWidthMm: 0.4 },
      { id: "m_header_div", type: "line", xMm: 41.7, yMm: 7.1, widthMm: 42.1, heightMm: 0.0, strokeWidthMm: 0.4 },
      { id: "m_lbl_art", type: "text", xMm: 42.5, yMm: 5.1, fontSizePt: 8, fontWeight: "bold", staticText: "Art.No." },
      { id: "m_art_box", type: "inverted_box", xMm: 52.0, yMm: 1.9, widthMm: 35.5, heightMm: 5.0, fontSizePt: 14, textBinding: "item.style" },
      { id: "m_lbl_col", type: "text", xMm: 42.5, yMm: 12.9, fontSizePt: 8, fontWeight: "bold", staticText: "Color:" },
      { id: "m_color", type: "text", xMm: 50.6, yMm: 12.9, fontSizePt: 12, fontWeight: "bold", fieldBinding: "item.color" },
      { id: "m_size_box", type: "inverted_box", xMm: 78.4, yMm: 7.7, widthMm: 8.7, heightMm: 8.3, fontSizePt: 20, textBinding: "item.size" },

      // Pricing & Metrology
      { id: "m_lbl_mrp", type: "text", xMm: 44.4, yMm: 21.2, fontSizePt: 10, fontWeight: "bold", staticText: "MRP:" },
      { id: "m_price", type: "text", xMm: 51.2, yMm: 21.9, fontSizePt: 16, fontWeight: "900", fieldBinding: "item.mrp" },
      { id: "m_taxes", type: "text", xMm: 61.2, yMm: 21.5, fontSizePt: 7, staticText: "|(Incl of all taxes)" },
      { id: "m_mfg", type: "text", xMm: 44.4, yMm: 24.9, fontSizePt: 7, staticText: "MFG.Dt.:10/26" },
      { id: "m_contents", type: "text", xMm: 44.4, yMm: 26.9, fontSizePt: 6, staticText: "NET CONTENTS:1 Pair Footwear" },
      { id: "m_div_legal", type: "line", xMm: 40.5, yMm: 29.5, widthMm: 50.9, heightMm: 0.0, strokeWidthMm: 0.4 },
      { id: "m_mktd", type: "text", xMm: 44.4, yMm: 32.6, fontSizePt: 8, fontWeight: "bold", fieldBinding: "item.companyName" },
      { id: "m_addr", type: "text", xMm: 44.4, yMm: 34.8, fontSizePt: 6, fieldBinding: "item.companyAddress" },
      { id: "m_email", type: "text", xMm: 44.4, yMm: 36.7, fontSizePt: 6, fieldBinding: "item.companyEmail" },
      { id: "m_barcode", type: "barcode_128", xMm: 43.2, yMm: 38.1, widthMm: 45.0, heightMm: 8.2, showHri: true, fieldBinding: "item.barcode" },
      { id: "m_div_brand", type: "line", xMm: 91.4, yMm: 0.0, widthMm: 0.0, heightMm: 50.7, strokeWidthMm: 0.4 },
      { id: "m_brand_rot", type: "text", xMm: 96.5, yMm: 44.6, fontSizePt: 14, fontWeight: "bold", rotationDeg: 270, fieldBinding: "item.brand" },
    ],
  },
  {
    id: "retail-50x25",
    name: "Retail Sticker — 50x25mm",
    widthMm: 50.0,
    heightMm: 25.0,
    defaultDpi: 203,
    description: "Standard 50mm x 25mm 1-up retail roll sticker",
    elements: [
      { id: "r_brand", type: "text", xMm: 3.0, yMm: 4.0, fontSizePt: 8, fontWeight: "bold", fieldBinding: "item.brand" },
      { id: "r_price", type: "text", xMm: 35.0, yMm: 4.0, fontSizePt: 9, fontWeight: "bold", fieldBinding: "item.mrp" },
      { id: "r_name", type: "text", xMm: 3.0, yMm: 7.5, fontSizePt: 7, fieldBinding: "item.name" },
      { id: "r_barcode", type: "barcode_128", xMm: 3.0, yMm: 9.5, widthMm: 44.0, heightMm: 9.0, showHri: true, fieldBinding: "item.barcode" },
      { id: "r_attr", type: "text", xMm: 3.0, yMm: 23.0, fontSizePt: 6, fieldBinding: "item.color" },
      { id: "r_size", type: "text", xMm: 35.0, yMm: 23.0, fontSizePt: 6, fieldBinding: "item.size" },
    ],
  },
];

export function getLabelTemplate(id: string): UnifiedLabelTemplate | undefined {
  if (id === "lay-footwear-100x50-3stub" || id === "tattly-footwear-100x50.7") {
    id = "tattly-threads-footwear-100x50.7";
  }
  return BUILTIN_LABEL_TEMPLATES.find((t) => t.id === id);
}
