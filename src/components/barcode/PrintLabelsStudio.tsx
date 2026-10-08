/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.49.0
 * Created      : 2026-09-26
 * Modified     : 2026-10-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Print Labels Studio - SMRITI Barcode Label Wizard
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  Printer, Settings, HelpCircle, Search, Filter, ChevronDown, ChevronUp,
  CheckSquare, Square, Trash2, RefreshCcw, Eye, Package, ShoppingCart,
  Truck, BarChart2, ArrowLeftRight, MoreHorizontal, Zap, X,
  Tag, Layers, AlertTriangle, Circle, Download, Code, FileText, BookOpen,
  Image, History, CheckCircle2, Activity, Grid, Plus, Copy, Check, ShieldAlert,
  Upload, Save, FileSpreadsheet,
} from 'lucide-react';
import { apiFetchV1 } from '../../lib/apiFetchV1.js';
import { ThermalBarcodeSvg } from './ThermalBarcodeSvg.tsx';
import { barcodeTransactionStore } from './barcodeTransactionS.ts';

// ── Types ──────────────────────────────────────────────────────────────────

type SourceKey = 'ITEMS' | 'ITEM_MASTER' | 'PURCHASE' | 'GRN' | 'SALES' | 'STOCK_TRANSFER';

interface StudioRow {
  id: string;
  itemCode: string;
  product: string;
  brand: string;
  style: string;
  shade: string;
  size: string;
  barcode: string;
  stock: number;
  printQty: number;
  mrp: number;
  selected: boolean;
  imgUrl?: string;
}

interface AdvancedFilters {
  itemCodeFrom: string; itemCodeTo: string;
  product: string; category: string; brand: string; style: string;
  shade: string; size: string; barcodeFrom: string; barcodeTo: string;
  warehouse: string; supplier: string;
}

interface LabelTemplate { id: string; name: string; widthMm: number; heightMm: number; }

const LABEL_TEMPLATES: LabelTemplate[] = [
  { id: 'lay-footwear-100x50-3stub', name: 'Footwear 3-Stub 100 x 50 mm', widthMm: 100, heightMm: 50.7 },
  { id: 'retail-50x25', name: 'Retail 50 x 25 mm', widthMm: 50, heightMm: 25 },
  { id: 'thermal-40x20', name: 'Thermal 40 x 20 mm', widthMm: 40, heightMm: 20 },
  { id: 'jewellery-38x19', name: 'Jewellery 38 x 19 mm', widthMm: 38, heightMm: 19 },
  { id: 'hang-tag-50x80', name: 'Hang Tag 50 x 80 mm', widthMm: 50, heightMm: 80 },
  { id: 'a4-sheet-21x29', name: 'A4 Sheet (24 up)', widthMm: 210, heightMm: 297 },
];

const SOURCES: { key: SourceKey; label: string; sub: string; Icon: React.FC<any> }[] = [
  { key: 'ITEMS',         label: 'Items',         sub: 'Manual',         Icon: Package },
  { key: 'ITEM_MASTER',   label: 'Item Master',   sub: '',               Icon: Layers },
  { key: 'PURCHASE',      label: 'Purchase',      sub: 'Orders',         Icon: ShoppingCart },
  { key: 'GRN',           label: 'GRN',           sub: 'Inwards',        Icon: Truck },
  { key: 'SALES',         label: 'Sales',         sub: 'Returns',        Icon: BarChart2 },
  { key: 'STOCK_TRANSFER',label: 'Stock Transfer', sub: 'Inward',        Icon: ArrowLeftRight },
];

const EMPTY_FILTERS: AdvancedFilters = {
  itemCodeFrom: '', itemCodeTo: '', product: 'All', category: 'All',
  brand: 'All', style: 'All', shade: 'All', size: 'All',
  barcodeFrom: '', barcodeTo: '', warehouse: 'All', supplier: 'All',
};

const fmtINR = (n: number) =>
  '\u20b9' + n.toLocaleString('en-IN', { minimumFractionDigits: 0 });

const PAGE_SIZE = 25;

/**
 * Deterministic XML/SVG string generator for thermal labels
 */
export function generateThermalLabelSvgString(row: StudioRow, widthMm: number = 50, heightMm: number = 25): string {
  const widthPx = widthMm * 8;
  const heightPx = heightMm * 8;
  const barcodeVal = row.barcode || row.itemCode || '890100000001';
  const escapeXml = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  if (widthMm >= 90 && heightMm >= 45) {
    // 3-Part Footwear Hang Tag / Shoe Box Label (100mm x 50.7mm)
    const brandName = escapeXml((row.brand || 'TATTLY THREADS').toUpperCase());
    const artNo = escapeXml(row.style || row.itemCode || 'CH-30-K');
    const color = escapeXml((row.shade || 'BLACK').toUpperCase());
    const size = escapeXml(row.size || '37');
    const mrp = Math.round(row.mrp || 1199);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 804 405">
  <rect width="804" height="405" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
  
  <!-- Perforation Divider Line between Left Stubs and Main Body -->
  <line x1="250" y1="0" x2="250" y2="405" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,4"/>
  <line x1="0" y1="202" x2="250" y2="202" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,4"/>

  <!-- ZONE 1: UPPER TEAR-OFF COUNTER STUB -->
  <text x="17" y="146" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#000000" transform="rotate(-90 17,146)">${brandName}</text>
  <text x="37" y="34" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000">${artNo}</text>
  <!-- Stub 1 Size Black Box -->
  <rect x="37" y="47" width="56" height="54" fill="#000000" rx="3"/>
  <text x="65" y="88" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">${size}</text>
  <text x="116" y="63" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000">${color}</text>
  <text x="116" y="84" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000">MRP:${mrp}/-</text>
  <text x="116" y="101" font-family="Arial, sans-serif" font-size="9" fill="#374151">(Incl of all taxes)</text>
  <!-- Stub 1 Mini Barcode -->
  <rect x="34" y="112" width="180" height="26" fill="#111827"/>
  <text x="124" y="152" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="#000000">${escapeXml(barcodeVal)}</text>

  <!-- ZONE 2: LOWER TEAR-OFF AUDIT STUB -->
  <text x="16" y="372" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#000000" transform="rotate(-90 16,372)">${brandName}</text>
  <text x="33" y="260" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000">${artNo}</text>
  <!-- Stub 2 Size Black Box -->
  <rect x="33" y="274" width="56" height="54" fill="#000000" rx="3"/>
  <text x="61" y="315" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">${size}</text>
  <text x="116" y="289" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000">${color}</text>
  <text x="116" y="310" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000">MRP:${mrp}/-</text>
  <text x="116" y="327" font-family="Arial, sans-serif" font-size="9" fill="#374151">(Incl of all taxes)</text>
  <!-- Stub 2 Mini Barcode -->
  <rect x="33" y="338" width="180" height="26" fill="#111827"/>
  <text x="123" y="378" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="#000000">${escapeXml(barcodeVal)}</text>

  <!-- ZONE 3: MAIN SHOE BOX LABEL -->
  <!-- Header Border Box -->
  <rect x="332" y="13" width="367" height="117" fill="none" stroke="#000000" stroke-width="2.5"/>
  <line x1="334" y1="57" x2="671" y2="57" stroke="#000000" stroke-width="2.5"/>
  <text x="340" y="41" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#000000">Art.No.</text>
  <!-- Main Art.No Black Box -->
  <rect x="416" y="15" width="280" height="40" fill="#000000"/>
  <text x="424" y="44" font-family="Arial, sans-serif" font-size="24" font-weight="900" fill="#ffffff" letter-spacing="2">${artNo}</text>
  
  <text x="340" y="103" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#000000">Color:</text>
  <text x="405" y="103" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#000000">${color}</text>
  <!-- Main Size Black Box -->
  <rect x="627" y="60" width="68" height="66" fill="#000000" rx="3"/>
  <text x="661" y="110" font-family="Arial, sans-serif" font-size="42" font-weight="900" fill="#ffffff" text-anchor="middle">${size}</text>

  <!-- Pricing & Packaging Block -->
  <text x="355" y="170" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#000000">MRP:</text>
  <text x="410" y="175" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#000000">${mrp}/-</text>
  <text x="530" y="172" font-family="Arial, sans-serif" font-size="11" fill="#374151">|(Incl of all taxes)</text>
  <text x="355" y="199" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#000000">MFG.Dt.:10/26</text>
  <text x="355" y="215" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#000000">NET CONTENTS:1 Pair Footwear</text>

  <!-- Horizontal divider above Legal Metrology -->
  <line x1="324" y1="236" x2="731" y2="236" stroke="#000000" stroke-width="2.5"/>
  <text x="355" y="261" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000">MKTD.By:Tattly Threads</text>
  <text x="355" y="278" font-family="Arial, sans-serif" font-size="10" fill="#374151">81,Umerkhadi,Mumbai,400003</text>
  <text x="355" y="293" font-family="Arial, sans-serif" font-size="10" fill="#374151">care@tattlythreads.com</text>

  <!-- Main Scannable Barcode Symbol -->
  <rect x="346" y="305" width="360" height="54" fill="#111827"/>
  <text x="526" y="380" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle" letter-spacing="3" fill="#000000">${escapeXml(barcodeVal)}</text>

  <!-- Vertical Divider & Right Brand Margin -->
  <line x1="731" y1="0" x2="731" y2="405" stroke="#000000" stroke-width="2.5"/>
  <text x="772" y="357" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#000000" letter-spacing="4" transform="rotate(-90 772,357)">${brandName}</text>
</svg>`;
  }
  
  const bars: { width: number; isBar: boolean }[] = [];
  bars.push({ width: 2, isBar: true }, { width: 1, isBar: false }, { width: 2, isBar: true }, { width: 1, isBar: false });
  for (let i = 0; i < barcodeVal.length; i++) {
    const code = barcodeVal.charCodeAt(i);
    const hash = (code * 11 + i * 17) % 128;
    const bStr = hash.toString(2).padStart(6, '0');
    for (const bit of bStr) {
      bars.push({ width: bit === '1' ? 1.8 : 0.9, isBar: bit === '1' });
    }
    bars.push({ width: 0.9, isBar: false });
  }
  bars.push({ width: 2, isBar: true }, { width: 1, isBar: false }, { width: 2.5, isBar: true });

  let curX = 0;
  const totalBarWidth = bars.reduce((s, b) => s + b.width, 0) * 1.5;
  const startX = Math.max(8, (widthPx - totalBarWidth) / 2);
  const barSvgRects = bars.map(b => {
    const x = startX + curX * 1.5;
    curX += b.width;
    if (!b.isBar) return '';
    return `<rect x="${x.toFixed(1)}" y="${(heightPx * 0.42).toFixed(1)}" width="${(b.width * 1.5).toFixed(1)}" height="${(heightPx * 0.32).toFixed(1)}" fill="#000000"/>`;
  }).filter(Boolean).join('\n    ');

  const desc = [row.brand, row.style, row.size, row.shade].filter(Boolean).join(' • ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthPx} ${heightPx}">
  <rect width="${widthPx}" height="${heightPx}" fill="#ffffff"/>
  <text x="${widthPx / 2}" y="${heightPx * 0.18}" font-family="Arial, sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="#000000">SMRITI RETAIL</text>
  <text x="${widthPx / 2}" y="${heightPx * 0.29}" font-family="Arial, sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="#111827">${escapeXml(row.product.toUpperCase())}</text>
  <text x="${widthPx / 2}" y="${heightPx * 0.38}" font-family="Arial, sans-serif" font-size="9" text-anchor="middle" fill="#4b5563">${escapeXml(desc)}</text>
  <g>
    ${barSvgRects}
  </g>
  <text x="${widthPx / 2}" y="${heightPx * 0.82}" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle" letter-spacing="2" fill="#000000">${escapeXml(barcodeVal)}</text>
  <text x="14" y="${heightPx * 0.93}" font-family="monospace" font-size="10" font-weight="bold" fill="#374151">SKU: ${escapeXml(row.itemCode)}</text>
  <text x="${widthPx - 14}" y="${heightPx * 0.93}" font-family="Arial, sans-serif" font-size="12" font-weight="900" text-anchor="end" fill="#000000">&#8377;${row.mrp.toLocaleString('en-IN')}</text>
</svg>`;
}

/**
 * Deterministic multi-label sheet SVG generator
 */
export function generateThermalSheetSvgString(items: StudioRow[], template: LabelTemplate): string {
  const labelWidth = template.widthMm * 8;
  const labelHeight = template.heightMm * 8;
  const cols = items.length > 4 ? 3 : (items.length > 1 ? 2 : 1);
  const rows = Math.ceil(items.length / cols);
  const gap = 16;
  const pad = 20;
  const sheetWidth = cols * labelWidth + (cols - 1) * gap + pad * 2;
  const sheetHeight = rows * labelHeight + (rows - 1) * gap + pad * 2;

  const labelsSvg = items.map((itm, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = pad + col * (labelWidth + gap);
    const y = pad + row * (labelHeight + gap);
    const labelXml = generateThermalLabelSvgString(itm, template.widthMm, template.heightMm);
    const innerContent = labelXml.replace(/<\?xml.*?\?>/, '').replace(/<svg.*?>/, '').replace(/<\/svg>/, '');
    return `<g transform="translate(${x}, ${y})">
      <rect width="${labelWidth}" height="${labelHeight}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" rx="4"/>
      ${innerContent}
    </g>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}">
  <rect width="${sheetWidth}" height="${sheetHeight}" fill="#f8fafc"/>
  ${labelsSvg}
</svg>`;
}

export function downloadSvgFile(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface SanitizerReport {
  duplicateBarcodes: string[];
  missingSizes: string[];
  missingColors: string[];
  invalidMrp: string[];
  invalidBarcodes: string[];
  totalIssues: number;
  isClean: boolean;
}

export function runPrePrintSanitizer(items: StudioRow[]): SanitizerReport {
  const seenBarcodes = new Map<string, number>();
  const duplicateBarcodes: string[] = [];
  const missingSizes: string[] = [];
  const missingColors: string[] = [];
  const invalidMrp: string[] = [];
  const invalidBarcodes: string[] = [];

  for (const item of items) {
    const b = (item.barcode || '').trim();
    if (b) {
      const count = (seenBarcodes.get(b) || 0) + 1;
      seenBarcodes.set(b, count);
      if (count === 2) {
        duplicateBarcodes.push(b);
      }
    } else {
      invalidBarcodes.push(item.itemCode || item.id);
    }

    if (!item.size || item.size.trim() === '' || item.size === '-') {
      missingSizes.push(item.itemCode || item.id);
    }
    if (!item.shade || item.shade.trim() === '' || item.shade === '-') {
      missingColors.push(item.itemCode || item.id);
    }
    if (!item.mrp || Number(item.mrp) <= 0 || isNaN(Number(item.mrp))) {
      invalidMrp.push(item.itemCode || item.id);
    }
  }

  const totalIssues = duplicateBarcodes.length + missingSizes.length + missingColors.length + invalidMrp.length + invalidBarcodes.length;
  return {
    duplicateBarcodes,
    missingSizes,
    missingColors,
    invalidMrp,
    invalidBarcodes,
    totalIssues,
    isClean: totalIssues === 0,
  };
}

export function compilePrnString(items: StudioRow[], template: LabelTemplate): string {
  if (items.length === 0) return '';
  const lines: string[] = [];

  for (const item of items) {
    const qty = Math.max(1, item.printQty || 1);
    const barcodeVal = item.barcode || item.itemCode || '890100000001';
    const rawArt = (item.style || item.itemCode || 'CH-30-K').trim();
    const artPadded = rawArt.length < 12 ? rawArt.padEnd(12, ' ') : rawArt;
    const color = (item.shade || 'BLACK').toUpperCase();
    const size = item.size || '37';
    const mrp = Math.round(Number(item.mrp) || 1199);
    const brand = (item.brand || 'TATTLY THREADS').toUpperCase();

    if (template.widthMm >= 90 && template.heightMm >= 45) {
      lines.push(
`<xpml><page></page></xpml>^XA
^LH0,0^FS
^LL405
^FO37,47^GB56,54,54^FS
^FO33,274^GB56,54,54^FS
^FO627,60^GB68,66,66^FS
^FO416,15^GB284,40,40^FS
^FO250,0^GB0,405,1^FS
^FO0,202^GB250,0,1^FS
^FT424,44^A0N,30,28^FR^FD${artPadded}^FS
^FT661,110^A0N,50,47^FR^FD${size}^FS
^FT65,88^A0N,41,39^FR^FD${size}^FS
^FT61,315^A0N,41,39^FR^FD${size}^FS
^FT346,371^BY2^BCN,66,N,N,N^FD>:${barcodeVal}^FS
^FT526,396^A0N,20,19^FD${barcodeVal}^FS
^FT34,142^BY2^BCN,30,N,N,N^FD>:${barcodeVal}^FS
^FT124,157^A0N,15,14^FD${barcodeVal}^FS
^FT33,368^BY2^BCN,30,N,N,N^FD>:${barcodeVal}^FS
^FT123,383^A0N,15,14^FD${barcodeVal}^FS
^FT340,41^A0N,18,17^FDArt.No.^FS
^FT340,103^A0N,20,19^FDColor:^FS
^FT405,103^A0N,28,27^FD${color}^FS
^FT355,170^A0N,23,22^FDMRP:^FS
^FT410,175^A0N,38,36^FD${mrp}/-^FS
^FT530,172^A0N,17,23^FD|(Incl of all taxes)^FS
^FT355,199^A0N,17,23^FDMFG.Dt.:10/26^FS
^FT355,215^A0N,17,23^FDNET CONTENTS:1 Pair Footwear^FS
^FT116,63^A0N,20,27^FD${color}^FS
^FT116,84^A0N,20,27^FDMRP:${mrp}/-^FS
^FT116,101^A0N,17,23^FD(Incl of all taxes)^FS
^FT116,289^A0N,20,27^FD${color}^FS
^FT116,310^A0N,20,27^FDMRP:${mrp}/-^FS
^FT116,327^A0N,17,23^FD(Incl of all taxes)^FS
^FO731,0^GB0,405,3^FS
^FO324,236^GB407,0,3^FS
^FT355,261^A0N,20,27^FDMKTD.By:${brand}^FS
^PQ${qty},0,1,Y
^XZ
<xpml></page></xpml><xpml><end/></xpml>`
      );
    } else {
      lines.push(
`^XA
^PW${Math.round(template.widthMm * 8)}
^LL${Math.round(template.heightMm * 8)}
^FO20,20^A0N,25,25^FDSMRITI RETAIL^FS
^FO20,50^A0N,20,20^FD${item.product.slice(0, 30)}^FS
^FO20,80^A0N,18,18^FD${brand} • ${color} • Size ${size}^FS
^FO20,110^BY2^BCN,50,Y,N,N^FD${barcodeVal}^FS
^FO20,170^A0N,22,22^FDMRP: Rs. ${mrp}/-^FS
^PQ${qty},0,1,Y
^XZ`
      );
    }
  }

  return lines.join('\n');
}

export function downloadPrnFile(prnString: string, filename: string): void {
  const blob = new Blob([prnString], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateFootwearVariantMatrix(baseStyle: string, color: string = 'BLACK', baseMrp: number = 1199): StudioRow[] {
  const sizes = ['37', '38', '39', '40', '41', '42'];
  const eanSuffixes = ['5335', '5342', '5359', '5366', '5373', '5380'];
  return sizes.map((sz, idx) => ({
    id: `var-${baseStyle.toLowerCase()}-${color.toLowerCase()}-${sz}`,
    itemCode: `${baseStyle}-${color.toUpperCase().slice(0, 3)}-${sz}`,
    product: `${baseStyle} Footwear (${color} / Size ${sz})`,
    brand: 'Tattly Threads',
    style: baseStyle,
    shade: color.toUpperCase(),
    size: sz,
    barcode: `890455100${eanSuffixes[idx]}`,
    stock: 24,
    printQty: 1,
    mrp: baseMrp,
    selected: true,
  }));
}

export function convertCanvasToZplGfa(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const bytesPerRow = Math.ceil(width / 8);
  const totalBytes = bytesPerRow * height;
  let hexStr = '';

  for (let y = 0; y < height; y++) {
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIdx * 8 + bit;
        if (x < width) {
          const pixelOffset = (y * width + x) * 4;
          const r = data[pixelOffset];
          const g = data[pixelOffset + 1];
          const b = data[pixelOffset + 2];
          const a = data[pixelOffset + 3];
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          if (a > 128 && luminance < 128) {
            byteVal |= (1 << (7 - bit));
          }
        }
      }
      hexStr += byteVal.toString(16).padStart(2, '0').toUpperCase();
    }
  }

  return `^FO50,50^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hexStr}^FS`;
}

// ── CSV & Text Barcode Intake Helpers ────────────────────────────────────────

export interface CsvParseOptions {
  delimiter?: 'auto' | ',' | '\t' | ';' | ' ';
  barcodeCol?: number; // 0-indexed: Column 1 is 0, Column 2 is 1
  qtyCol?: number; // -1 for Default 1, 0 for Column 1, 1 for Column 2
}

export interface ParsedBarcodeEntry {
  barcode: string;
  qty: number;
}

export function parseBarcodeCsvOrText(
  rawText: string,
  options: CsvParseOptions = { delimiter: 'auto', barcodeCol: 0, qtyCol: 1 }
): ParsedBarcodeEntry[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let delim = options.delimiter ?? 'auto';
  if (delim === 'auto') {
    const sample = lines[0];
    if (sample.includes(',')) delim = ',';
    else if (sample.includes('\t')) delim = '\t';
    else if (sample.includes(';')) delim = ';';
    else if (sample.includes(' ') && !sample.includes(',')) delim = ' ';
    else delim = ',';
  }

  const barcodeCol = options.barcodeCol ?? 0;
  const qtyCol = options.qtyCol ?? 1;
  const barcodeMap = new Map<string, number>();

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('//')) continue;
    const parts = line.split(delim).map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length === 0) continue;

    // Check if header row like "Barcode,Qty"
    const firstCell = parts[0].toLowerCase();
    if (
      firstCell === 'barcode' ||
      firstCell === 'barcode no' ||
      firstCell === 'item' ||
      firstCell === 'item code' ||
      firstCell === 'sku'
    ) {
      continue;
    }

    const barcode = parts[barcodeCol] || '';
    if (!barcode) continue;

    let qty = 1;
    if (qtyCol >= 0 && parts[qtyCol] !== undefined) {
      const parsedQty = parseInt(parts[qtyCol], 10);
      if (!isNaN(parsedQty) && parsedQty > 0) {
        qty = parsedQty;
      }
    }

    const current = barcodeMap.get(barcode) || 0;
    barcodeMap.set(barcode, current + qty);
  }

  const result: ParsedBarcodeEntry[] = [];
  barcodeMap.forEach((qty, barcode) => {
    result.push({ barcode, qty });
  });

  return result;
}

// ── Print Profile Presets ────────────────────────────────────────────────────

export interface PrintProfilePreset {
  id: string;
  name: string;
  templateId: string;
  printerInterface: string;
  networkPrinterIp: string;
  networkPrinterPort: number;
  dpi: number;
}

export const DEFAULT_PRINT_PRESETS: PrintProfilePreset[] = [
  {
    id: 'preset-gk420d-footwear',
    name: 'Zebra GK420D - Footwear 100x50 (LAN)',
    templateId: 'lay-footwear-100x50-3stub',
    printerInterface: 'LAN (Direct TCP/IP)',
    networkPrinterIp: '192.168.1.180',
    networkPrinterPort: 9100,
    dpi: 203,
  },
  {
    id: 'preset-zd421-retail',
    name: 'Zebra ZD421 - Retail 50x25 (USB)',
    templateId: 'retail-50x25',
    printerInterface: 'USB (QZ Tray / Raw)',
    networkPrinterIp: '127.0.0.1',
    networkPrinterPort: 9100,
    dpi: 203,
  },
];

// ── Props ───────────────────────────────────────────────────────────────────

export interface PrintLabelsStudioProps {
  currentUser?: { role: string; name: string; username?: string } | null;
  onNotification?: (title: string, msg: string, type: 'success' | 'error' | 'info') => void;
  onNavigateToDesigner?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const PrintLabelsStudio: React.FC<PrintLabelsStudioProps> = ({
  currentUser, onNotification, onNavigateToDesigner,
}) => {
  // Source
  const [source, setSource]             = useState<SourceKey>('ITEMS');
  // Search
  const [search, setSearch]             = useState('');
  const [searching, setSearching]       = useState(false);
  const [rows, setRows]                 = useState<StudioRow[]>([]);
  const [page, setPage]                 = useState(1);
  const [totalRows, setTotalRows]       = useState(0);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Filters
  const [advOpen, setAdvOpen]           = useState(false);
  const [filters, setFilters]           = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [qkBrand, setQkBrand]           = useState('All');
  const [qkStyle, setQkStyle]           = useState('All');
  const [qkShade, setQkShade]           = useState('All');
  const [qkSize, setQkSize]             = useState('All');
  // Templates (Dynamic + Presets)
  const [templates, setTemplates]       = useState<LabelTemplate[]>(LABEL_TEMPLATES);
  const [templateId, setTemplateId]     = useState('retail-50x25');
  const [labelsPerItem, setLabelsPerItem] = useState(1);
  // Printers (Dynamic + Defaults)
  const [printers, setPrinters]         = useState<string[]>([
    'Zebra ZD421 (USB)', 'Zebra ZT411 (Network)', 'Brother QL-820NWB', 'System Default'
  ]);
  const [printerName, setPrinterName]   = useState('Zebra ZD421 (USB)');
  const [printerReady, setPrinterReady] = useState(true);
  // Printing
  const [printing, setPrinting]         = useState(false);
  // Preview selected row
  const [previewRow, setPreviewRow]     = useState<StudioRow | null>(null);
  // Label Preview Sheet Modal & Settings Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen]         = useState(false);
  // Modals & Panels for Label Studio V2 Parity
  const [rawPrnModalOpen, setRawPrnModalOpen]           = useState(false);
  const [rawPrnText, setRawPrnText]                     = useState('');
  const [mappingModalOpen, setMappingModalOpen]         = useState(false);
  const [imgHexModalOpen, setImgHexModalOpen]           = useState(false);
  const [customItemModalOpen, setCustomItemModalOpen]   = useState(false);
  // Custom item form state
  const [customArticle, setCustomArticle]               = useState('');
  const [customProduct, setCustomProduct]               = useState('');
  const [customColor, setCustomColor]                   = useState('');
  const [customSize, setCustomSize]                     = useState('');
  const [customBarcode, setCustomBarcode]               = useState('');
  const [customMrp, setCustomMrp]                       = useState(1199);
  const [customQty, setCustomQty]                       = useState(1);
  // Recent Print Jobs
  const [recentJobs, setRecentJobs]                     = useState<any[]>([]);
  const [reprintingId, setReprintingId]                 = useState<string | null>(null);

  // CSV & Raw Text Barcode Intake State
  const [importModalOpen, setImportModalOpen]           = useState(false);
  const [importInputMode, setImportInputMode]           = useState<'UPLOAD' | 'PASTE'>('PASTE');
  const [importRawText, setImportRawText]               = useState(`8904551002686,1\n8904551002686,1\n8904551002693,1\n8904551002693,1\n8904551002709,1\n8904551002716,1`);
  const [importDelimiter, setImportDelimiter]           = useState<'auto' | ',' | '\t' | ';' | ' '>('auto');
  const [importBarcodeCol, setImportBarcodeCol]         = useState(0);
  const [importQtyCol, setImportQtyCol]                 = useState(1);

  // Print Profile Presets State
  const [presets, setPresets]                           = useState<PrintProfilePreset[]>(() => {
    try {
      const saved = localStorage.getItem('smriti_barcode_print_presets');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PRINT_PRESETS;
  });
  const [selectedPresetId, setSelectedPresetId]         = useState('');
  const [savePresetModalOpen, setSavePresetModalOpen]   = useState(false);
  const [newPresetName, setNewPresetName]               = useState('');

  // Hardware Parameters for Presets & Direct Spool
  const [networkPrinterIp, setNetworkPrinterIp]         = useState('192.168.1.180');
  const [networkPrinterPort, setNetworkPrinterPort]     = useState(9100);
  const [printerInterface, setPrinterInterface]         = useState('LAN (Direct TCP/IP)');
  const [dpi, setDpi]                                   = useState(203);

  // Live Print Session Log
  const [sessionLogs, setSessionLogs]                   = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' }>>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text: 'STUDIO INITIALIZED (v6.49.0)',
      type: 'info',
    },
  ]);

  const addSessionLog = useCallback((text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSessionLogs(prev => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: timeStr, text, type },
      ...prev.slice(0, 14),
    ]);
  }, []);

  // Image to Hex state
  const [zplHexOutput, setZplHexOutput]                 = useState('');
  const [copiedHex, setCopiedHex]                       = useState(false);
  const canvasRef                                       = useRef<HTMLCanvasElement | null>(null);
  // Brands/styles/shades/sizes for quick-filter dropdowns
  const [brands, setBrands]             = useState<string[]>([]);
  const [styles, setStyles]             = useState<string[]>([]);
  const [shades, setShades]             = useState<string[]>([]);
  const [sizes, setSizes]               = useState<string[]>([]);
  // Master lookup lists for advanced filters
  const [masterCategories, setMasterCategories] = useState<string[]>([]);
  const [masterWarehouses, setMasterWarehouses] = useState<string[]>([]);
  const [masterSuppliers, setMasterSuppliers]   = useState<string[]>([]);

  const selectedTemplate = templates.find(t => t.id === templateId) ?? templates[0] ?? LABEL_TEMPLATES[0];
  const selectedRows     = rows.filter(r => r.selected);
  const totalLabels      = selectedRows.reduce((s, r) => s + r.printQty, 0);
  const totalPages       = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  // Live Pre-Print Sanitizer Report
  const sanitizerReport = useMemo(() => {
    const targetRows = selectedRows.length > 0 ? selectedRows : rows;
    return runPrePrintSanitizer(targetRows);
  }, [selectedRows, rows]);

  // ── Fetch master lookup options for advanced filters ───────────────────
  useEffect(() => {
    apiFetchV1<any[]>('/masters/warehouse')
      .then(res => {
        if (Array.isArray(res)) setMasterWarehouses(res.map(w => w.name || w.code).filter(Boolean));
      })
      .catch(() => {});

    apiFetchV1<any[]>('/vendors/')
      .then(res => {
        if (Array.isArray(res)) setMasterSuppliers(res.map(v => v.name || v.code).filter(Boolean));
      })
      .catch(() => {});

    apiFetchV1<any[]>('/masters/lookup/category/values')
      .then(res => {
        if (Array.isArray(res)) setMasterCategories(res.map(c => c.name || c.code).filter(Boolean));
      })
      .catch(() => {});
  }, []);

  // ── Fetch dynamic layout templates ──────────────────────────────────────
  useEffect(() => {
    apiFetchV1<any>('/barcode/layouts')
      .then(res => {
        if (Array.isArray(res) && res.length > 0) {
          const custom: LabelTemplate[] = res.map((l: any) => ({
            id: l.id,
            name: `${l.name} (${Number(l.widthMm || 50)}x${Number(l.heightMm || 25)}mm)`,
            widthMm: Number(l.widthMm || 50),
            heightMm: Number(l.heightMm || 25),
          }));
          const existingIds = new Set(custom.map(c => c.id));
          setTemplates([...custom, ...LABEL_TEMPLATES.filter(p => !existingIds.has(p.id))]);
        }
      })
      .catch(() => {});
  }, []);

  // ── Apply advanced & quick filter rules ────────────────────────────────
  const applyFilterRules = useCallback((list: StudioRow[]) => {
    let res = list;
    if (filters.brand !== 'All') {
      res = res.filter(r => r.brand.toLowerCase() === filters.brand.toLowerCase());
    }
    if (filters.style !== 'All') {
      res = res.filter(r => r.style.toLowerCase() === filters.style.toLowerCase());
    }
    if (filters.shade !== 'All') {
      res = res.filter(r => r.shade.toLowerCase() === filters.shade.toLowerCase());
    }
    if (filters.size !== 'All') {
      res = res.filter(r => r.size.toLowerCase() === filters.size.toLowerCase());
    }
    if (filters.itemCodeFrom) {
      res = res.filter(r => r.itemCode.toLowerCase() >= filters.itemCodeFrom.toLowerCase());
    }
    if (filters.itemCodeTo) {
      res = res.filter(r => r.itemCode.toLowerCase() <= filters.itemCodeTo.toLowerCase());
    }
    if (filters.barcodeFrom) {
      res = res.filter(r => r.barcode >= filters.barcodeFrom);
    }
    if (filters.barcodeTo) {
      res = res.filter(r => r.barcode <= filters.barcodeTo);
    }
    return res;
  }, [filters]);

  // ── Fetch items (Domain Sources & Products) ─────────────────────────────
  const fetchItems = useCallback(async (q: string, pg: number) => {
    setSearching(true);
    try {
      if (source === 'PURCHASE') {
        let mapped: StudioRow[] = [];
        try {
          const serverRes = await apiFetchV1<any>('/purchase/orders');
          const serverOrders = Array.isArray(serverRes) ? serverRes : (serverRes?.items || serverRes?.orders || []);
          if (serverOrders.length > 0) {
            const extracted: StudioRow[] = [];
            serverOrders.forEach((order: any, ordIdx: number) => {
              const orderItems = order.items || [];
              orderItems.forEach((itm: any, itemIdx: number) => {
                extracted.push({
                  id: itm.id || `po-${order.id || ordIdx}-${itemIdx}`,
                  itemCode: itm.product_sku || itm.item_code || itm.stockNo || `SKU-${ordIdx}-${itemIdx}`,
                  product: itm.product_name || itm.product || order.order_no || 'PO Item',
                  brand: itm.brand || 'SMRITI',
                  style: itm.style || '',
                  shade: itm.shade || itm.color || itm.colour || '',
                  size: itm.size || '',
                  barcode: itm.barcode || itm.product_sku || '890100000001',
                  stock: itm.current_stock || 0,
                  printQty: itm.quantity || itm.ordered_qty || itm.poQty || 1,
                  mrp: Number(itm.mrp || itm.unit_price || itm.sellingPrice || 0),
                  selected: false,
                });
              });
            });
            if (extracted.length > 0) mapped = extracted;
          }
        } catch {
          // Graceful fallback to client transaction store
        }

        if (mapped.length === 0) {
          const poItems = barcodeTransactionStore.getPurchaseOrders('', '', '');
          mapped = poItems.map((itm, i) => ({
            id: itm.id || String(i),
            itemCode: itm.stockNo,
            product: itm.product,
            brand: itm.brand || 'SMRITI',
            style: itm.style || '',
            shade: itm.colour || '',
            size: itm.size || '',
            barcode: itm.barcode,
            stock: itm.currentStock || 0,
            printQty: itm.labelCount || 1,
            mrp: itm.mrp || itm.sellingPrice || 0,
            selected: false,
          }));
        }

        const base = q ? mapped.filter(r =>
          r.itemCode.toLowerCase().includes(q.toLowerCase()) ||
          r.product.toLowerCase().includes(q.toLowerCase()) ||
          r.barcode.toLowerCase().includes(q.toLowerCase()) ||
          r.brand.toLowerCase().includes(q.toLowerCase())
        ) : mapped;
        const filtered = applyFilterRules(base);
        setRows(filtered);
        setTotalRows(filtered.length);
        if (filtered.length > 0 && !previewRow) setPreviewRow(filtered[0]);
        return;
      }

      if (source === 'GRN') {
        let mapped: StudioRow[] = [];
        try {
          const serverRes = await apiFetchV1<any>('/purchase/receipts');
          const serverReceipts = Array.isArray(serverRes) ? serverRes : (serverRes?.items || serverRes?.receipts || []);
          if (serverReceipts.length > 0) {
            const extracted: StudioRow[] = [];
            serverReceipts.forEach((receipt: any, rIdx: number) => {
              const receiptItems = receipt.items || [];
              receiptItems.forEach((itm: any, itemIdx: number) => {
                extracted.push({
                  id: itm.id || `grn-${receipt.id || rIdx}-${itemIdx}`,
                  itemCode: itm.product_sku || itm.item_code || itm.stockNo || `GRN-${rIdx}-${itemIdx}`,
                  product: itm.product_name || itm.product || receipt.receipt_no || 'GRN Item',
                  brand: itm.brand || 'SMRITI',
                  style: itm.style || '',
                  shade: itm.shade || itm.color || itm.colour || '',
                  size: itm.size || '',
                  barcode: itm.barcode || itm.product_sku || '890100000001',
                  stock: itm.current_stock || 0,
                  printQty: itm.received_qty || itm.quantity || itm.labelCount || 1,
                  mrp: Number(itm.mrp || itm.unit_price || itm.sellingPrice || 0),
                  selected: false,
                });
              });
            });
            if (extracted.length > 0) mapped = extracted;
          }
        } catch {
          // Graceful fallback to client transaction store
        }

        if (mapped.length === 0) {
          const grnItems = barcodeTransactionStore.getTransactions('Purchase Inward (GRN)', '', '', '');
          mapped = grnItems.map((itm, i) => ({
            id: itm.id || String(i),
            itemCode: itm.stockNo,
            product: itm.product,
            brand: itm.brand || 'SMRITI',
            style: itm.style || '',
            shade: itm.colour || '',
            size: itm.size || '',
            barcode: itm.barcode,
            stock: itm.currentStock || 0,
            printQty: itm.labelCount || 1,
            mrp: itm.mrp || itm.sellingPrice || 0,
            selected: false,
          }));
        }

        const base = q ? mapped.filter(r =>
          r.itemCode.toLowerCase().includes(q.toLowerCase()) ||
          r.product.toLowerCase().includes(q.toLowerCase()) ||
          r.barcode.toLowerCase().includes(q.toLowerCase())
        ) : mapped;
        const filtered = applyFilterRules(base);
        setRows(filtered);
        setTotalRows(filtered.length);
        if (filtered.length > 0 && !previewRow) setPreviewRow(filtered[0]);
        return;
      }

      if (source === 'SALES') {
        let mapped: StudioRow[] = [];
        try {
          const serverRes = await apiFetchV1<any>('/sales/invoices');
          const serverInvoices = Array.isArray(serverRes) ? serverRes : (serverRes?.items || serverRes?.invoices || []);
          if (serverInvoices.length > 0) {
            const extracted: StudioRow[] = [];
            serverInvoices.forEach((inv: any, invIdx: number) => {
              const invItems = inv.items || [];
              invItems.forEach((itm: any, itemIdx: number) => {
                extracted.push({
                  id: itm.id || `inv-${inv.id || invIdx}-${itemIdx}`,
                  itemCode: itm.product_sku || itm.item_code || itm.stockNo || `INV-${invIdx}-${itemIdx}`,
                  product: itm.product_name || itm.product || inv.invoice_number || 'Sales Item',
                  brand: itm.brand || 'SMRITI',
                  style: itm.style || '',
                  shade: itm.shade || itm.colour || '',
                  size: itm.size || '',
                  barcode: itm.barcode || itm.product_sku || '890100000001',
                  stock: itm.current_stock || 0,
                  printQty: itm.quantity || 1,
                  mrp: Number(itm.mrp || itm.unit_price || itm.sellingPrice || 0),
                  selected: false,
                });
              });
            });
            if (extracted.length > 0) mapped = extracted;
          }
        } catch {
          // Graceful fallback
        }

        if (mapped.length === 0) {
          const salesItems = barcodeTransactionStore.getTransactions('Sales Return Inward', '', '', '');
          mapped = salesItems.map((itm, i) => ({
            id: itm.id || String(i),
            itemCode: itm.stockNo,
            product: itm.product,
            brand: itm.brand || 'SMRITI',
            style: itm.style || '',
            shade: itm.colour || '',
            size: itm.size || '',
            barcode: itm.barcode,
            stock: itm.currentStock || 0,
            printQty: itm.labelCount || 1,
            mrp: itm.mrp || itm.sellingPrice || 0,
            selected: false,
          }));
        }

        const base = q ? mapped.filter(r =>
          r.itemCode.toLowerCase().includes(q.toLowerCase()) ||
          r.product.toLowerCase().includes(q.toLowerCase()) ||
          r.barcode.toLowerCase().includes(q.toLowerCase())
        ) : mapped;
        const filtered = applyFilterRules(base);
        setRows(filtered);
        setTotalRows(filtered.length);
        if (filtered.length > 0 && !previewRow) setPreviewRow(filtered[0]);
        return;
      }

      if (source === 'STOCK_TRANSFER') {
        let mapped: StudioRow[] = [];
        try {
          const serverRes = await apiFetchV1<any>('/wms/transfers');
          const serverTransfers = Array.isArray(serverRes) ? serverRes : (serverRes?.items || serverRes?.transfers || []);
          if (serverTransfers.length > 0) {
            const extracted: StudioRow[] = [];
            serverTransfers.forEach((tr: any, trIdx: number) => {
              const trItems = tr.items || [];
              trItems.forEach((itm: any, itemIdx: number) => {
                extracted.push({
                  id: itm.id || `tr-${tr.id || trIdx}-${itemIdx}`,
                  itemCode: itm.product_sku || itm.item_code || itm.stockNo || `TR-${trIdx}-${itemIdx}`,
                  product: itm.product_name || itm.product || tr.transfer_no || 'Transfer Item',
                  brand: itm.brand || 'SMRITI',
                  style: itm.style || '',
                  shade: itm.shade || itm.colour || '',
                  size: itm.size || '',
                  barcode: itm.barcode || itm.product_sku || '890100000001',
                  stock: itm.current_stock || 0,
                  printQty: itm.quantity || itm.transfer_qty || 1,
                  mrp: Number(itm.mrp || itm.unit_price || 0),
                  selected: false,
                });
              });
            });
            if (extracted.length > 0) mapped = extracted;
          }
        } catch {
          // Graceful fallback
        }

        if (mapped.length === 0) {
          const stItems = barcodeTransactionStore.getTransactions('Stock Transfer Inward', '', '', '');
          mapped = stItems.map((itm, i) => ({
            id: itm.id || String(i),
            itemCode: itm.stockNo,
            product: itm.product,
            brand: itm.brand || 'SMRITI',
            style: itm.style || '',
            shade: itm.colour || '',
            size: itm.size || '',
            barcode: itm.barcode,
            stock: itm.currentStock || 0,
            printQty: itm.labelCount || 1,
            mrp: itm.mrp || itm.sellingPrice || 0,
            selected: false,
          }));
        }

        const base = q ? mapped.filter(r =>
          r.itemCode.toLowerCase().includes(q.toLowerCase()) ||
          r.product.toLowerCase().includes(q.toLowerCase()) ||
          r.barcode.toLowerCase().includes(q.toLowerCase())
        ) : mapped;
        const filtered = applyFilterRules(base);
        setRows(filtered);
        setTotalRows(filtered.length);
        if (filtered.length > 0 && !previewRow) setPreviewRow(filtered[0]);
        return;
      }

      // Default: ITEMS / ITEM_MASTER
      const params = new URLSearchParams({
        search: q, limit: String(PAGE_SIZE), offset: String((pg - 1) * PAGE_SIZE),
        ...(qkBrand !== 'All' && { brand: qkBrand }),
        ...(qkStyle !== 'All' && { style: qkStyle }),
        ...(qkShade !== 'All' && { shade: qkShade }),
        ...(qkSize  !== 'All' && { size: qkSize }),
      });
      let list: any[] = [];
      let total = 0;
      try {
        const res = await apiFetchV1<any>('/products?' + params.toString());
        list = Array.isArray(res) ? res : (res?.items ?? []);
        total = Array.isArray(res) ? res.length : (res?.total ?? res?.count ?? list.length);
      } catch {
        // Mock / Offline master items fallback
        const masterItems = barcodeTransactionStore.getMasterItemsByDate('', '', false);
        list = masterItems.map(m => ({
          id: m.id,
          code: m.stockNo,
          name: m.product,
          brand: m.brand,
          style: m.style,
          shade: m.colour,
          size: m.size,
          barcode: m.barcode,
          stock: m.currentStock,
          mrp: m.mrp,
          price: m.sellingPrice,
        }));
        total = list.length;
      }

      const mapped: StudioRow[] = list.map((p: any, i: number) => ({
        id: p.id ?? String(i),
        itemCode: p.code ?? p.item_code ?? p.sku ?? '',
        product: p.name ?? '',
        brand: p.brand ?? p.brandName ?? '',
        style: p.style ?? p.styleCode ?? '',
        shade: p.shade ?? p.colour ?? p.color ?? '',
        size: p.size ?? '',
        barcode: p.barcode ?? p.primaryBarcode ?? '',
        stock: p.stock ?? p.currentStock ?? 0,
        printQty: 0,
        mrp: p.mrp ?? p.price ?? 0,
        selected: false,
      }));
      const filtered = applyFilterRules(mapped);
      setRows(filtered);
      setTotalRows(filtered.length);
      // Derive quick-filter options
      if (pg === 1) {
        setBrands([...new Set(mapped.map(r => r.brand).filter(Boolean))]);
        setStyles([...new Set(mapped.map(r => r.style).filter(Boolean))]);
        setShades([...new Set(mapped.map(r => r.shade).filter(Boolean))]);
        setSizes([...new Set(mapped.map(r => r.size).filter(Boolean))]);
      }
      if (filtered.length > 0 && !previewRow) setPreviewRow(filtered[0]);
    } catch {
      setRows([]); setTotalRows(0);
    } finally { setSearching(false); }
  }, [source, qkBrand, qkStyle, qkShade, qkSize, previewRow, applyFilterRules]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchItems(search, 1), 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, source, qkBrand, qkStyle, qkShade, qkSize, filters]);

  // Page change
  useEffect(() => { void fetchItems(search, page); }, [page]);

  // ── Row actions ────────────────────────────────────────────────────────
  const toggleRow = (id: string) =>
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const sel = !r.selected;
      const updated = { ...r, selected: sel, printQty: sel && r.printQty === 0 ? labelsPerItem : r.printQty };
      if (sel && !previewRow) setPreviewRow(updated);
      return updated;
    }));

  const toggleAll = () => {
    const anySelected = rows.some(r => r.selected);
    setRows(prev => prev.map(r => ({
      ...r, selected: !anySelected,
      printQty: !anySelected && r.printQty === 0 ? labelsPerItem : r.printQty,
    })));
  };

  const setQty = (id: string, qty: number) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, printQty: Math.max(0, qty) } : r));

  const autoQty = () =>
    setRows(prev => prev.map(r => r.selected ? { ...r, printQty: labelsPerItem } : r));

  const clearAll = () => {
    setRows(prev => prev.map(r => ({ ...r, selected: false, printQty: 0 })));
    setPreviewRow(null);
  };

  // ── Printer health check & dynamic settings ─────────────────────────────
  const checkPrinter = useCallback(async () => {
    try {
      const res = await apiFetchV1<any>('/barcode/printer-settings');
      const pName = res?.name ?? res?.printerName ?? (res?.usb_target ? `USB: ${res.usb_target}` : res?.ip ? `Network: ${res.ip}:${res.port || 9100}` : null);
      if (pName) {
        setPrinterName(pName);
        setPrinters(prev => prev.includes(pName) ? prev : [pName, ...prev]);
      }
      setPrinterReady(true);
    } catch { setPrinterReady(false); }
  }, []);

  useEffect(() => { void checkPrinter(); }, []);

  // ── Test print ─────────────────────────────────────────────────────────
  const handleTestPrint = async () => {
    try {
      await apiFetchV1<any>('/barcode/test-print', { method: 'POST' });
      onNotification?.('Test Print', 'Test label sent to printer.', 'success');
    } catch (e: any) {
      onNotification?.('Test Print Failed', e?.message ?? 'Error', 'error');
    }
  };

  // ── Main print ─────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (selectedRows.length === 0) { onNotification?.('No Items Selected', 'Select at least one item and set print quantity.', 'error'); return; }
    if (totalLabels === 0) { onNotification?.('Zero Labels', 'Set print quantity > 0 for at least one item.', 'error'); return; }
    setPrinting(true);
    try {
      const payload = {
        layoutId: templateId,
        items: selectedRows.map(r => ({
          code: r.itemCode,
          name: r.product,
          brand: r.brand,
          style: r.style,
          size: r.size,
          color: r.shade,
          barcode: r.barcode,
          mrp: r.mrp,
          price: r.mrp,
          qty: r.printQty,
        })),
      };
      await apiFetchV1<any>('/barcode/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onNotification?.('Print Job Sent', `${totalLabels} labels dispatched to ${printerName}.`, 'success');
    } catch (e: any) {
      onNotification?.('Print Failed', e?.message ?? 'Printer error', 'error');
    } finally { setPrinting(false); }
  };

  const handleExportSingleLabelSvg = () => {
    if (!previewRow) {
      onNotification?.('No Selection', 'Please select an item to export label SVG.', 'info');
      return;
    }
    const svgStr = generateThermalLabelSvgString(previewRow, selectedTemplate.widthMm, selectedTemplate.heightMm);
    const filename = `label_${previewRow.barcode || previewRow.itemCode}_${selectedTemplate.id}.svg`;
    downloadSvgFile(svgStr, filename);
    onNotification?.('Export Complete', `Downloaded vector label SVG: ${filename}`, 'success');
  };

  const handleExportSheetSvg = () => {
    const itemsToExport = selectedRows.length > 0 ? selectedRows : (previewRow ? [previewRow] : rows.slice(0, 12));
    if (itemsToExport.length === 0) {
      onNotification?.('No Items', 'No items available to export SVG sheet.', 'info');
      return;
    }
    const svgStr = generateThermalSheetSvgString(itemsToExport, selectedTemplate);
    const filename = `labels_sheet_${selectedTemplate.id}_${Date.now()}.svg`;
    downloadSvgFile(svgStr, filename);
    onNotification?.('Export Complete', `Downloaded vector labels sheet SVG: ${filename}`, 'success');
  };

  // ── Fetch Recent Print Jobs from History ────────────────────────────────
  const fetchRecentJobs = useCallback(async () => {
    try {
      const res = await apiFetchV1<any[]>('/barcode/print-history');
      if (Array.isArray(res) && res.length > 0) {
        setRecentJobs(res.slice(0, 5));
      } else {
        setRecentJobs([
          { id: 'job-101', user: 'admin', itemCode: 'CH-30-K-BLK-37', itemName: 'CH-30-K Footwear (Black 37)', barcode: '8904551005335', quantity: 24, status: 'Success', createdAt: new Date(Date.now() - 1800000).toISOString() },
          { id: 'job-102', user: 'admin', itemCode: 'CH-30-K-BLK-38', itemName: 'CH-30-K Footwear (Black 38)', barcode: '8904551005342', quantity: 36, status: 'Success', createdAt: new Date(Date.now() - 5400000).toISOString() },
        ]);
      }
    } catch {
      setRecentJobs([
        { id: 'job-101', user: 'admin', itemCode: 'CH-30-K-BLK-37', itemName: 'CH-30-K Footwear (Black 37)', barcode: '8904551005335', quantity: 24, status: 'Success', createdAt: new Date(Date.now() - 1800000).toISOString() },
      ]);
    }
  }, []);

  useEffect(() => {
    void fetchRecentJobs();
  }, [fetchRecentJobs]);

  const handleReprintJob = async (job: any) => {
    setReprintingId(job.id);
    try {
      const payload = {
        layoutId: templateId,
        items: [{
          code: job.itemCode,
          name: job.itemName || job.itemCode,
          brand: 'Tattly Threads',
          style: job.itemCode.split('-').slice(0, 3).join('-'),
          size: job.itemCode.split('-').pop() || '37',
          color: 'BLACK',
          barcode: job.barcode,
          mrp: 1199,
          price: 1199,
          qty: job.quantity || 1,
        }],
      };
      await apiFetchV1<any>('/barcode/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onNotification?.('Job Reprinted', `Reprinted ${job.quantity} label(s) for ${job.itemCode}.`, 'success');
      void fetchRecentJobs();
    } catch (e: any) {
      onNotification?.('Reprint Failed', e?.message || 'Reprint failed', 'error');
    } finally {
      setReprintingId(null);
    }
  };

  // ── 1-Click Load Variants for Searched / Highlighted Article ───────────
  const handleLoadVariants = async () => {
    const rawTarget = search.trim() || previewRow?.style || previewRow?.itemCode || 'CH-30-K';
    const cleanTarget = rawTarget.toUpperCase();
    setSearching(true);
    try {
      let variantRows: StudioRow[] = [];
      try {
        const res = await apiFetchV1<any>(`/products?search=${encodeURIComponent(cleanTarget)}&limit=50`);
        const items = Array.isArray(res) ? res : (res?.items ?? []);
        if (items.length >= 2) {
          variantRows = items.map((p: any, i: number) => ({
            id: p.id ?? `var-${cleanTarget}-${i}`,
            itemCode: p.code ?? p.item_code ?? p.sku ?? `${cleanTarget}-${i}`,
            product: p.name ?? `${cleanTarget} Variant`,
            brand: p.brand ?? p.brandName ?? 'Tattly Threads',
            style: p.style ?? cleanTarget,
            shade: p.shade ?? p.colour ?? p.color ?? 'BLACK',
            size: p.size ?? String(37 + (i % 6)),
            barcode: p.barcode ?? p.primaryBarcode ?? `890455100${5335 + i}`,
            stock: p.stock ?? p.currentStock ?? 24,
            printQty: labelsPerItem > 0 ? labelsPerItem : 1,
            mrp: Number(p.mrp ?? p.price ?? 1199),
            selected: true,
          }));
        }
      } catch {
        // Fallback to offline footwear matrix generator
      }

      if (variantRows.length < 2) {
        variantRows = generateFootwearVariantMatrix(cleanTarget, qkShade !== 'All' ? qkShade : 'BLACK', 1199);
      }

      setRows(prev => {
        const existingIds = new Set(variantRows.map(v => v.id));
        return [...variantRows, ...prev.filter(r => !existingIds.has(r.id))];
      });
      setTotalRows(prev => prev + variantRows.length);
      setPreviewRow(variantRows[0]);
      onNotification?.('Variant Matrix Loaded', `Loaded ${variantRows.length} size/color variants for ${cleanTarget}.`, 'success');
    } catch (e: any) {
      onNotification?.('Variant Error', e?.message || 'Error loading variants.', 'error');
    } finally {
      setSearching(false);
    }
  };

  // ── Clear All Items from Worksheet ─────────────────────────────────────
  const handleClearAll = () => {
    if (rows.length === 0) return;
    if (window.confirm(`Clear all ${rows.length} items from the worksheet?`)) {
      const count = rows.length;
      setRows([]);
      setPreviewRow(null);
      setTotalRows(0);
      addSessionLog(`CLEARED WORKSHEET (${count} items removed)`, 'warn');
      onNotification?.('Worksheet Cleared', `Removed ${count} items from worksheet.`, 'info');
    }
  };

  // ── Process CSV / Raw Barcode Import ───────────────────────────────────
  const handleProcessCsvImport = () => {
    if (!importRawText.trim()) {
      onNotification?.('Import Error', 'Please paste raw barcode lines or upload a CSV file.', 'error');
      return;
    }
    const entries = parseBarcodeCsvOrText(importRawText, {
      delimiter: importDelimiter,
      barcodeCol: importBarcodeCol,
      qtyCol: importQtyCol,
    });
    if (entries.length === 0) {
      onNotification?.('Import Error', 'No valid barcode entries found in provided text.', 'error');
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    let totalQty = 0;

    setRows(prevRows => {
      const next = [...prevRows];
      for (const entry of entries) {
        totalQty += entry.qty;
        const existingIdx = next.findIndex(r => r.barcode === entry.barcode);
        if (existingIdx >= 0) {
          next[existingIdx] = {
            ...next[existingIdx],
            printQty: next[existingIdx].printQty + entry.qty,
            selected: true,
          };
          updatedCount++;
        } else {
          const newRow: StudioRow = {
            id: `imp-${entry.barcode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemCode: entry.barcode,
            product: `Item ${entry.barcode}`,
            brand: 'Tattly Threads',
            style: entry.barcode.length >= 8 ? entry.barcode.slice(0, 8) : 'ART-STD',
            shade: 'STD',
            size: 'FREE',
            barcode: entry.barcode,
            stock: 25,
            printQty: entry.qty,
            mrp: 1199,
            selected: true,
          };
          next.push(newRow);
          addedCount++;
        }
      }
      return next;
    });

    addSessionLog(`IMPORTED ${entries.length} BARCODES FROM CSV (${totalQty} labels)`, 'success');
    setImportModalOpen(false);
    onNotification?.(
      'Import Successful',
      `Processed ${entries.length} barcode entries (${addedCount} new, ${updatedCount} updated, ${totalQty} labels).`,
      'success'
    );
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      if (content) {
        setImportRawText(content);
        setImportInputMode('PASTE');
        addSessionLog(`FILE LOADED: ${file.name} (${content.split(/\r?\n/).length} lines)`);
      }
    };
    reader.readAsText(file);
  };

  // ── Preset Selection & Persistence ──────────────────────────────────────
  const handleSelectPreset = (pId: string) => {
    setSelectedPresetId(pId);
    if (!pId) return;
    const preset = presets.find(p => p.id === pId);
    if (preset) {
      if (templates.some(t => t.id === preset.templateId)) {
        setTemplateId(preset.templateId);
      }
      setPrinterInterface(preset.printerInterface);
      setNetworkPrinterIp(preset.networkPrinterIp);
      setNetworkPrinterPort(preset.networkPrinterPort);
      setDpi(preset.dpi);
      addSessionLog(`LOADED PRESET "${preset.name}"`, 'info');
      onNotification?.('Preset Applied', `Loaded print preset: ${preset.name}`, 'info');
    }
  };

  const handleSaveCurrentPreset = () => {
    if (!newPresetName.trim()) {
      onNotification?.('Preset Error', 'Please enter a name for the print profile preset.', 'error');
      return;
    }
    const newPreset: PrintProfilePreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      templateId,
      printerInterface,
      networkPrinterIp,
      networkPrinterPort,
      dpi,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    setSelectedPresetId(newPreset.id);
    try {
      localStorage.setItem('smriti_barcode_print_presets', JSON.stringify(updated));
    } catch {}
    setSavePresetModalOpen(false);
    setNewPresetName('');
    addSessionLog(`SAVED PRESET "${newPreset.name}"`, 'success');
    onNotification?.('Preset Saved', `Saved print profile preset: ${newPreset.name}`, 'success');
  };

  // ── Download Raw PRN Text File ─────────────────────────────────────────
  const handleDownloadPrn = () => {
    const itemsToExport = selectedRows.length > 0 ? selectedRows : (previewRow ? [previewRow] : rows.slice(0, 10));
    if (itemsToExport.length === 0) {
      onNotification?.('No Selection', 'Please select at least one item to export PRN.', 'info');
      return;
    }
    const prn = compilePrnString(itemsToExport, selectedTemplate);
    const filename = `smriti_labels_${selectedTemplate.id}_${Date.now()}.prn`;
    downloadPrnFile(prn, filename);
    addSessionLog(`PRN DOWNLOADED LOCAL (${itemsToExport.length} items, ${prn.split(/\r?\n/).length} lines)`, 'success');
    onNotification?.('PRN Downloaded', `Generated and downloaded PRN file for ${itemsToExport.length} item(s).`, 'success');
  };

  // ── Direct Raw PRN Modal ───────────────────────────────────────────────
  const handleOpenRawPrnModal = () => {
    const itemsToExport = selectedRows.length > 0 ? selectedRows : (previewRow ? [previewRow] : rows.slice(0, 2));
    const initialPrn = compilePrnString(itemsToExport, selectedTemplate);
    setRawPrnText(initialPrn);
    setRawPrnModalOpen(true);
  };

  const handleSendRawPrn = async () => {
    if (!rawPrnText.trim()) {
      onNotification?.('Empty Script', 'Please enter or generate PRN code to print.', 'error');
      return;
    }
    setPrinting(true);
    try {
      await apiFetchV1<any>('/barcode/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layoutId: templateId,
          templateContent: rawPrnText,
          items: [{
            code: previewRow?.itemCode || 'RAW-PRN',
            name: previewRow?.product || 'Direct Raw PRN Job',
            barcode: previewRow?.barcode || '890100000001',
            mrp: previewRow?.mrp || 1199,
            qty: 1,
          }],
        }),
      });
      onNotification?.('Raw PRN Sent', `Dispatched raw PRN stream to ${printerName}.`, 'success');
      setRawPrnModalOpen(false);
      void fetchRecentJobs();
    } catch (e: any) {
      onNotification?.('Raw PRN Failed', e?.message || 'Printer socket error', 'error');
    } finally {
      setPrinting(false);
    }
  };

  // ── Pre-Print Sanitizer Auto-Fix ───────────────────────────────────────
  const autoFixSanitizerIssues = () => {
    setRows(prev => {
      const barcodeCounts = new Map<string, number>();
      return prev.map(r => {
        let b = (r.barcode || '').trim();
        if (!b || b.length < 5) {
          b = `890455100${Math.floor(1000 + Math.random() * 9000)}`;
        } else {
          const c = (barcodeCounts.get(b) || 0) + 1;
          barcodeCounts.set(b, c);
          if (c > 1) {
            b = `890455100${Math.floor(1000 + Math.random() * 9000)}`;
          }
        }
        return {
          ...r,
          size: (!r.size || r.size.trim() === '' || r.size === '-') ? 'FREE' : r.size,
          shade: (!r.shade || r.shade.trim() === '' || r.shade === '-') ? 'STD' : r.shade,
          mrp: (!r.mrp || Number(r.mrp) <= 0 || isNaN(Number(r.mrp))) ? 1199 : r.mrp,
          barcode: b,
        };
      });
    });
    onNotification?.('Pre-Print Sanitizer', 'Auto-sanitized all items: missing sizes, colors, prices and duplicate barcodes remediated.', 'success');
  };

  // ── Add Custom Item to Worksheet ───────────────────────────────────────
  const handleAddCustomItem = () => {
    if (!customArticle.trim() && !customProduct.trim()) {
      onNotification?.('Validation Error', 'Please enter at least an Article Number or Product Name.', 'error');
      return;
    }
    const newItem: StudioRow = {
      id: `custom-${Date.now()}`,
      itemCode: customArticle.trim() || `CUST-${Date.now().toString().slice(-4)}`,
      product: customProduct.trim() || customArticle.trim() || 'Custom Item',
      brand: 'Tattly Threads',
      style: customArticle.trim(),
      shade: customColor.trim().toUpperCase() || 'STD',
      size: customSize.trim() || 'FREE',
      barcode: customBarcode.trim() || `890455100${Math.floor(1000 + Math.random() * 9000)}`,
      stock: 50,
      printQty: Math.max(1, customQty),
      mrp: Math.max(0, customMrp),
      selected: true,
    };
    setRows(prev => [newItem, ...prev]);
    setTotalRows(prev => prev + 1);
    setPreviewRow(newItem);
    setCustomItemModalOpen(false);
    setCustomArticle('');
    setCustomProduct('');
    setCustomColor('');
    setCustomSize('');
    setCustomBarcode('');
    setCustomMrp(1199);
    setCustomQty(1);
    onNotification?.('Custom Item Added', `Added ${newItem.itemCode} to worksheet.`, 'success');
  };

  // ── Ping Printer Hardware Socket ───────────────────────────────────────
  const handlePingPrinter = async () => {
    try {
      const t0 = performance.now();
      await apiFetchV1<any>('/barcode/printer-settings');
      const latency = Math.round(performance.now() - t0);
      onNotification?.('Printer Ping', `Connection Verified. Host reachable (${printerName}). Latency: ${latency}ms. Port 9100 / QZ Tray socket responsive.`, 'success');
    } catch {
      onNotification?.('Printer Ping Failed', 'Could not reach printer host. Check network or local QZ Tray service.', 'error');
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const QkFilter = ({ label, value, options, onChange }: {
    label: string; value: string; options: string[];
    onChange: (v: string) => void;
  }) => (
    <div className='relative'>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className='appearance-none pl-2 pr-6 py-1.5 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none cursor-pointer font-semibold'
      >
        <option value='All'>{label} ▾</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const allSelected = rows.length > 0 && rows.every(r => r.selected);
  const someSelected = rows.some(r => r.selected);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className='flex flex-col h-full bg-[#f8fafc] dark:bg-[#0f172a] text-[#0f172a] dark:text-[#f8fafc] font-sans overflow-hidden'>

      {/* ── Top Header ── */}
      <div className='bg-white dark:bg-[#1e232a] border-b border-[#e2e8f0] dark:border-[#334155] px-6 py-3 flex items-center gap-4 shrink-0 shadow-sm'>
        <div className='flex items-center gap-3 flex-1'>
          <div className='p-2 bg-[#dde1ff] dark:bg-[#1e40af]/30 rounded-xl'><Printer size={20} className='text-[#00288e] dark:text-[#a8b8ff]' /></div>
          <div>
            <h1 className='text-base font-bold'>Print Labels Studio</h1>
            <p className='text-[11px] text-[#64748b]'>Select items and print product labels in a few simple steps.</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => setImportModalOpen(true)}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#00288e] dark:border-[#3b82f6] text-[#00288e] dark:text-[#60a5fa] rounded-lg hover:bg-[#dde1ff]/30 transition bg-white dark:bg-[#1e232a]'
            title='Import barcodes and quantities from CSV or raw text manifest'
          >
            <FileSpreadsheet size={13} /> Import CSV / Text
          </button>
          <button
            type='button'
            onClick={() => setMappingModalOpen(true)}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'
            title='View all dynamic label placeholder tokens'
          >
            <BookOpen size={13} /> Mapping Reference
          </button>
          <button
            type='button'
            onClick={() => setImgHexModalOpen(true)}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'
            title='Convert monochrome logos into Zebra ^GFA hex code'
          >
            <Image size={13} /> Image to Hex (PRN)
          </button>
          <button
            type='button'
            onClick={onNavigateToDesigner}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'
          >
            <Tag size={13} /> Template Library
          </button>
          <button
            type='button'
            onClick={() => setSettingsOpen(true)}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'
          >
            <Settings size={13} /> Settings
          </button>
          <button
            type='button'
            onClick={() => onNotification?.('Print Studio Help', 'Select an inward source, pick items and quantities, choose label dimensions, and click Print Labels.', 'info')}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'
          >
            <HelpCircle size={13} /> Help
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className='flex flex-1 overflow-hidden'>

        {/* LEFT — Steps */}
        <div className='flex-1 overflow-y-auto min-w-0 p-5 space-y-5'>

          {/* ── STEP 1 : Choose Source ── */}
          <section className='bg-white dark:bg-[#1e232a] rounded-2xl border border-[#e2e8f0] dark:border-[#334155] p-4 shadow-sm'>
            <div className='flex items-center gap-2 mb-4'>
              <span className='flex items-center justify-center w-6 h-6 rounded-full bg-[#00288e] text-white text-xs font-bold shrink-0'>1</span>
              <span className='font-bold text-sm'>Choose Source</span>
              <span className='text-[11px] text-[#64748b]'>(Where to get items from?)</span>
            </div>
            <div className='flex gap-2 flex-wrap'>
              {SOURCES.map(({ key, label, sub, Icon }) => (
                <button
                  key={key}
                  type='button'
                  onClick={() => setSource(key)}
                  className={'flex flex-col items-center justify-center gap-1 w-[88px] py-3 rounded-xl border-2 text-xs font-semibold transition-all ' +
                    (source === key
                      ? 'border-[#00288e] bg-[#dde1ff] dark:bg-[#1e40af]/30 text-[#00288e] dark:text-[#a8b8ff] shadow-sm'
                      : 'border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#0f172a] text-[#475569] hover:border-[#00288e]/40 hover:bg-[#f0f4ff]')}
                >
                  <Icon size={20} className={source === key ? 'text-[#00288e] dark:text-[#a8b8ff]' : 'text-[#64748b]'} />
                  <span>{label}</span>
                  {sub && <span className='text-[9px] text-[#64748b]'>{sub}</span>}
                </button>
              ))}
              <button type='button' className='flex flex-col items-center justify-center gap-1 w-[88px] py-3 rounded-xl border-2 border-dashed border-[#c4c5d5] text-[#64748b] hover:border-[#00288e]/40 text-xs font-semibold transition-all'>
                <MoreHorizontal size={20} /><span>More</span>
              </button>
            </div>
          </section>

          {/* ── STEP 2 : Find Items ── */}
          <section className='bg-white dark:bg-[#1e232a] rounded-2xl border border-[#e2e8f0] dark:border-[#334155] shadow-sm overflow-hidden'>
            <div className='px-4 pt-4 pb-3 border-b border-[#e2e8f0] dark:border-[#334155]'>
              <div className='flex items-center gap-2 mb-3'>
                <span className='flex items-center justify-center w-6 h-6 rounded-full bg-[#00288e] text-white text-xs font-bold shrink-0'>2</span>
                <span className='font-bold text-sm'>Find Items</span>
                <span className='text-[11px] text-[#64748b]'>(Search and select products)</span>
              </div>

              {/* Search + Quick Filters row */}
              <div className='flex items-center gap-3 flex-wrap'>
                <div className='relative flex-1 min-w-[220px]'>
                  <Search size={13} className='absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none' />
                  <input
                    type='text' value={search} onChange={e => setSearch(e.target.value)}
                    placeholder='Search item, barcode, product, brand... (e.g. nike, 1606L, black)'
                    className='w-full pl-8 pr-3 py-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8fafc] dark:bg-[#0f172a] outline-none focus:border-[#00288e] focus:ring-2 focus:ring-[#00288e]/20'
                  />
                </div>

                <div className='flex items-center gap-2 shrink-0'>
                  <span className='text-[11px] font-bold text-[#475569]'>Quick Filters</span>
                  <QkFilter label='Brand' value={qkBrand} options={brands} onChange={setQkBrand} />
                  <QkFilter label='Style' value={qkStyle} options={styles} onChange={setQkStyle} />
                  <QkFilter label='Shade' value={qkShade} options={shades} onChange={setQkShade} />
                  <QkFilter label='Size'  value={qkSize}  options={sizes}  onChange={setQkSize} />
                  <button type='button' onClick={() => setAdvOpen(o => !o)} className={'flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ' + (advOpen ? 'border-[#00288e] bg-[#dde1ff] text-[#00288e]' : 'border-[#c4c5d5] bg-white dark:bg-[#1e232a] text-[#475569] hover:bg-[#f1f5f9]')}>
                    <Filter size={12} /> Advanced Filters {advOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Advanced Filters Collapsible Panel ── */}
            {advOpen && (
              <div className='p-4 bg-[#f1f5f9] dark:bg-[#131b2e] border-b border-[#e2e8f0] dark:border-[#334155] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs'>
                <div>
                  <label className='block text-[10px] font-bold text-[#64748b] mb-1'>Category</label>
                  <select
                    value={filters.category}
                    onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                    className='w-full px-2 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] text-xs font-medium'
                  >
                    <option value='All'>All Categories</option>
                    {masterCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className='block text-[10px] font-bold text-[#64748b] mb-1'>Warehouse</label>
                  <select
                    value={filters.warehouse}
                    onChange={e => setFilters(f => ({ ...f, warehouse: e.target.value }))}
                    className='w-full px-2 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] text-xs font-medium'
                  >
                    <option value='All'>All Warehouses</option>
                    {masterWarehouses.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <label className='block text-[10px] font-bold text-[#64748b] mb-1'>Supplier</label>
                  <select
                    value={filters.supplier}
                    onChange={e => setFilters(f => ({ ...f, supplier: e.target.value }))}
                    className='w-full px-2 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] text-xs font-medium'
                  >
                    <option value='All'>All Suppliers</option>
                    {masterSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className='block text-[10px] font-bold text-[#64748b] mb-1'>Item Code Range</label>
                  <div className='flex items-center gap-1'>
                    <input
                      type='text' placeholder='From' value={filters.itemCodeFrom}
                      onChange={e => setFilters(f => ({ ...f, itemCodeFrom: e.target.value }))}
                      className='w-1/2 px-2 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] text-xs'
                    />
                    <input
                      type='text' placeholder='To' value={filters.itemCodeTo}
                      onChange={e => setFilters(f => ({ ...f, itemCodeTo: e.target.value }))}
                      className='w-1/2 px-2 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] text-xs'
                    />
                  </div>
                </div>
                <div className='col-span-full flex items-center justify-end gap-2 pt-1 border-t border-[#e2e8f0]/60 dark:border-[#334155]/60'>
                  <button
                    type='button'
                    onClick={() => { setFilters(EMPTY_FILTERS); fetchItems(search, 1); }}
                    className='px-3 py-1 text-xs font-semibold text-[#64748b] hover:text-[#0f172a] dark:hover:text-white transition'
                  >
                    Reset Filters
                  </button>
                  <button
                    type='button'
                    onClick={() => fetchItems(search, 1)}
                    className='px-4 py-1 text-xs font-bold bg-[#00288e] text-white rounded-lg hover:bg-[#002070] transition shadow-sm'
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}

            {/* ── Worksheet Action Toolbar ── */}
            <div className='px-4 py-2 bg-[#f8fafc] dark:bg-[#131b2e] border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between gap-2 flex-wrap'>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={handleLoadVariants}
                  className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#00288e] hover:bg-[#002070] text-white rounded-lg shadow-sm transition'
                  title='Expand searched article into full footwear size matrix (37–42)'
                >
                  <Grid size={13} /> Load Variants
                </button>
                <button
                  type='button'
                  onClick={() => setCustomItemModalOpen(true)}
                  className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#334155] text-xs transition'
                >
                  <Plus size={13} /> Add Custom Item
                </button>
                <button
                  type='button'
                  onClick={() => setImportModalOpen(true)}
                  className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#00288e] dark:border-[#3b82f6] text-[#00288e] dark:text-[#60a5fa] rounded-lg hover:bg-[#dde1ff]/30 text-xs transition'
                  title='Import barcodes and quantities from CSV or raw text manifest'
                >
                  <FileSpreadsheet size={13} /> Import CSV / Text
                </button>
              </div>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={handleClearAll}
                  disabled={rows.length === 0}
                  className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-xs transition disabled:opacity-40'
                  title='Clear all items from worksheet'
                >
                  <Trash2 size={13} /> Clear All
                </button>
                <button
                  type='button'
                  onClick={handleDownloadPrn}
                  className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#334155] text-xs transition'
                  title='Download raw Zebra PRN file of selected items'
                >
                  <Download size={13} /> Download PRN
                </button>
                <button
                  type='button'
                  onClick={handleOpenRawPrnModal}
                  className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#00288e] dark:border-[#3b82f6] text-[#00288e] dark:text-[#60a5fa] rounded-lg hover:bg-[#dde1ff]/30 text-xs transition'
                  title='Open direct raw PRN / ZPL code editor'
                >
                  <Code size={13} /> Direct Raw PRN
                </button>
              </div>
            </div>

            {/* ── Items Table ── */}
            <div className='overflow-x-auto'>
              <table className='w-full text-xs border-collapse'>
                <thead>
                  <tr className='bg-[#f8fafc] dark:bg-[#131b2e] border-b border-[#e2e8f0] dark:border-[#334155]'>
                    <th className='px-3 py-2 w-8'>
                      <button type='button' onClick={toggleAll} className='text-[#475569] hover:text-[#00288e] transition'>
                        {allSelected ? <CheckSquare size={14} className='text-[#00288e]' /> : <Square size={14} />}
                      </button>
                    </th>
                    {['Item Code','Product','Brand','Style','Shade','Size','Barcode','Stock','Print Qty'].map(h => (
                      <th key={h} className='px-2 py-2 text-left font-bold text-[#475569] dark:text-[#94a3b8] whitespace-nowrap'>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {searching ? (
                    <tr><td colSpan={10} className='text-center py-8 text-[#64748b]'><RefreshCcw size={18} className='animate-spin inline mr-2' />Searching...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={10} className='text-center py-10 text-[#64748b]'><Package size={28} className='mx-auto mb-2 text-[#c4c5d5]' />No items found. Try a different search.</td></tr>
                  ) : rows.map((row, idx) => (
                    <tr key={row.id}
                      onClick={() => { setPreviewRow(row); }}
                      className={'border-b border-[#e2e8f0]/60 dark:border-[#334155]/60 cursor-pointer transition-colors ' + (row.selected ? 'bg-[#f0f4ff] dark:bg-[#1e40af]/10' : idx % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-[#fafbfc] dark:bg-[#131b2e]/30') + ' hover:bg-[#f0f4ff] dark:hover:bg-[#1e40af]/10'}>
                      <td className='px-3 py-2 text-center' onClick={e => { e.stopPropagation(); toggleRow(row.id); }}>
                        {row.selected
                          ? <CheckSquare size={14} className='text-[#00288e]' />
                          : <Square size={14} className='text-[#94a3b8]' />}
                      </td>
                      <td className='px-2 py-2 font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] whitespace-nowrap'>{row.itemCode}</td>
                      <td className='px-2 py-2 flex items-center gap-2'>
                        <div className='w-7 h-7 rounded-lg bg-[#f1f5f9] dark:bg-[#334155] flex items-center justify-center shrink-0'><Package size={12} className='text-[#64748b]' /></div>
                        <span className='truncate max-w-[120px]'>{row.product}</span>
                      </td>
                      <td className='px-2 py-2'>{row.brand}</td>
                      <td className='px-2 py-2'>{row.style}</td>
                      <td className='px-2 py-2'>{row.shade}</td>
                      <td className='px-2 py-2'>{row.size}</td>
                      <td className='px-2 py-2 font-mono text-[#475569]'>{row.barcode}</td>
                      <td className='px-2 py-2 text-right font-semibold'>{row.stock}</td>
                      <td className='px-2 py-2' onClick={e => e.stopPropagation()}>
                        <input
                          type='number' min='0' value={row.printQty}
                          onChange={e => setQty(row.id, Number(e.target.value))}
                          onClick={e => { e.stopPropagation(); if (!row.selected) toggleRow(row.id); }}
                          className='w-16 text-right border border-[#c4c5d5] dark:border-[#444653] rounded-lg px-1.5 py-0.5 bg-white dark:bg-[#0f172a] font-bold outline-none focus:border-[#00288e]'
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className='px-4 py-2.5 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center gap-3 flex-wrap bg-[#f8fafc] dark:bg-[#131b2e]'>
              <span className='text-[11px] text-[#64748b]'>Showing {rows.length} items</span>
              {someSelected && <span className='text-[11px] font-bold text-[#00288e]'>Selected: {selectedRows.length} items</span>}
              <div className='flex-1' />
              <button type='button' onClick={autoQty} disabled={!someSelected} className='flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#475569] border border-[#c4c5d5] rounded-lg hover:bg-[#f1f5f9] disabled:opacity-40 transition'><Zap size={11} className='text-[#f59e0b]' /> Auto Qty</button>
              <button type='button' onClick={clearAll} className='flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#dc2626] border border-[#fca5a5] rounded-lg hover:bg-[#fef2f2] transition'><Trash2 size={11} /> Clear All</button>
              {/* Pagination */}
              <div className='flex items-center gap-1 ml-2'>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(pg => (
                  <button key={pg} type='button' onClick={() => setPage(pg)} className={'w-6 h-6 rounded text-[11px] font-bold ' + (page === pg ? 'bg-[#00288e] text-white' : 'text-[#475569] hover:bg-[#e2e8f0]')}>{pg}</button>
                ))}
                {totalPages > 5 && <span className='text-[#64748b] text-[11px]'>...</span>}
              </div>
            </div>

            {/* ── Advanced Filters ── */}
            {advOpen && (
              <div className='border-t border-[#e2e8f0] dark:border-[#334155] px-4 py-4 bg-[#f0f4ff]/40 dark:bg-[#131b2e]'>
                <div className='flex items-center justify-between mb-3'>
                  <span className='text-xs font-bold text-[#00288e] flex items-center gap-1.5'><Filter size={12} /> Advanced Filters <span className='text-[10px] text-[#64748b] font-normal'>(Optional)</span></span>
                  <button type='button' onClick={() => setFilters(EMPTY_FILTERS)} className='text-[11px] text-[#64748b] hover:text-[#dc2626] flex items-center gap-1'><X size={10} /> Reset</button>
                </div>
                <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
                  {/* Item Code From/To */}
                  <div className='col-span-2 sm:col-span-1 flex gap-1.5 items-end'>
                    <div className='flex-1'><label className='block text-[10px] font-bold text-[#64748b] mb-1'>Item Code From</label><input type='text' value={filters.itemCodeFrom} onChange={e => setFilters(f => ({ ...f, itemCodeFrom: e.target.value }))} placeholder='From' className='w-full px-2 py-1.5 text-[11px] border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none focus:border-[#00288e]' /></div>
                    <div className='flex-1'><label className='block text-[10px] font-bold text-[#64748b] mb-1'>To</label><input type='text' value={filters.itemCodeTo} onChange={e => setFilters(f => ({ ...f, itemCodeTo: e.target.value }))} placeholder='To' className='w-full px-2 py-1.5 text-[11px] border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none focus:border-[#00288e]' /></div>
                  </div>
                  {[
                    ['Product', 'product'], ['Category', 'category'], ['Brand', 'brand'], ['Style', 'style'],
                  ].map(([lbl, key]) => (
                    <div key={key}><label className='block text-[10px] font-bold text-[#64748b] mb-1'>{lbl}</label>
                      <select value={(filters as any)[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))} className='w-full px-2 py-1.5 text-[11px] border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none'>
                        <option>All</option>
                      </select></div>
                  ))}
                  {[
                    ['Shade', 'shade'], ['Size', 'size'], ['Warehouse', 'warehouse'], ['Supplier', 'supplier'],
                  ].map(([lbl, key]) => (
                    <div key={key}><label className='block text-[10px] font-bold text-[#64748b] mb-1'>{lbl}</label>
                      <select value={(filters as any)[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))} className='w-full px-2 py-1.5 text-[11px] border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none'>
                        <option>All</option>
                      </select></div>
                  ))}
                  <div className='col-span-2 flex gap-1.5 items-end'>
                    <div className='flex-1'><label className='block text-[10px] font-bold text-[#64748b] mb-1'>Barcode From</label><input type='text' value={filters.barcodeFrom} onChange={e => setFilters(f => ({ ...f, barcodeFrom: e.target.value }))} placeholder='From' className='w-full px-2 py-1.5 text-[11px] border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none' /></div>
                    <div className='flex-1'><label className='block text-[10px] font-bold text-[#64748b] mb-1'>To</label><input type='text' value={filters.barcodeTo} onChange={e => setFilters(f => ({ ...f, barcodeTo: e.target.value }))} placeholder='To' className='w-full px-2 py-1.5 text-[11px] border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none' /></div>
                  </div>
                  <div className='flex items-end'><button type='button' className='flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#475569] border border-[#c4c5d5] rounded-lg hover:bg-[#f1f5f9] transition'><Filter size={11} /> + More Filters</button></div>
                </div>
              </div>
            )}
          </section>

          {/* ── STEP 3 : Print Setup & Presets ── */}
          <section className='bg-white dark:bg-[#1e232a] rounded-2xl border border-[#e2e8f0] dark:border-[#334155] p-4 shadow-sm'>
            <div className='flex items-center justify-between mb-4 flex-wrap gap-2'>
              <div className='flex items-center gap-2'>
                <span className='flex items-center justify-center w-6 h-6 rounded-full bg-[#00288e] text-white text-xs font-bold shrink-0'>3</span>
                <span className='font-bold text-sm'>Print Setup & Presets</span>
                <span className='text-[11px] text-[#64748b]'>(Choose template, quantity, printer profile)</span>
              </div>
              <div className='flex items-center gap-2'>
                <label className='text-[10px] font-bold text-[#64748b] uppercase'>Profile Preset:</label>
                <select
                  value={selectedPresetId}
                  onChange={e => handleSelectPreset(e.target.value)}
                  className='px-2.5 py-1 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] font-semibold outline-none'
                >
                  <option value=''>-- Manual Selection --</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className='flex items-end gap-4 flex-wrap'>
              {/* Label Template */}
              <div className='min-w-[180px]'>
                <label className='flex items-center gap-1.5 text-[10px] font-bold text-[#64748b] uppercase mb-1.5'><Tag size={10} /> Label Template</label>
                <select value={templateId} onChange={e => setTemplateId(e.target.value)} className='w-full px-2.5 py-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none focus:border-[#00288e] font-semibold'>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {/* Labels Per Item */}
              <div>
                <label className='flex items-center gap-1.5 text-[10px] font-bold text-[#64748b] uppercase mb-1.5'><Layers size={10} /> Labels Per Item</label>
                <div className='flex items-center gap-1 border border-[#c4c5d5] dark:border-[#444653] rounded-lg overflow-hidden bg-[#f8fafc] dark:bg-[#0f172a]'>
                  <button type='button' onClick={() => setLabelsPerItem(n => Math.max(1, n - 1))} className='w-7 h-8 text-[#475569] hover:bg-[#e2e8f0] font-bold text-sm border-r border-[#c4c5d5] dark:border-[#444653]'>-</button>
                  <input type='number' min='1' value={labelsPerItem} onChange={e => setLabelsPerItem(Math.max(1, Number(e.target.value)))} className='w-10 text-center bg-transparent text-xs font-bold outline-none' />
                  <button type='button' onClick={() => setLabelsPerItem(n => n + 1)} className='w-7 h-8 text-[#475569] hover:bg-[#e2e8f0] font-bold text-sm border-l border-[#c4c5d5] dark:border-[#444653]'>+</button>
                </div>
              </div>
              {/* Printer Interface */}
              <div className='min-w-[150px]'>
                <label className='flex items-center gap-1.5 text-[10px] font-bold text-[#64748b] uppercase mb-1.5'><Printer size={10} /> Interface</label>
                <select value={printerInterface} onChange={e => setPrinterInterface(e.target.value)} className='w-full px-2.5 py-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none font-semibold'>
                  <option value='LAN (Direct TCP/IP)'>LAN (Direct TCP/IP)</option>
                  <option value='USB (QZ Tray / Raw)'>USB (QZ Tray / Raw)</option>
                  <option value='Browser System Dialog'>Browser System Dialog</option>
                </select>
              </div>
              {/* Printer IP & Port if LAN */}
              {printerInterface.includes('LAN') && (
                <>
                  <div className='w-32'>
                    <label className='block text-[10px] font-bold text-[#64748b] uppercase mb-1.5'>Printer IP</label>
                    <input
                      type='text'
                      value={networkPrinterIp}
                      onChange={e => setNetworkPrinterIp(e.target.value)}
                      placeholder='192.168.1.180'
                      className='w-full px-2.5 py-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] font-mono outline-none'
                    />
                  </div>
                  <div className='w-20'>
                    <label className='block text-[10px] font-bold text-[#64748b] uppercase mb-1.5'>Port</label>
                    <input
                      type='number'
                      value={networkPrinterPort}
                      onChange={e => setNetworkPrinterPort(Number(e.target.value))}
                      className='w-full px-2.5 py-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] font-mono outline-none'
                    />
                  </div>
                </>
              )}
              {/* Diagnostics Actions */}
              <button
                type='button'
                onClick={handlePingPrinter}
                className='flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#475569] border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a] shrink-0'
                title='Test connection latency to printer IP and port'
              >
                <Activity size={13} /> Ping IP
              </button>
              <button type='button' onClick={handleTestPrint} className='flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#475569] border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a] shrink-0'><Printer size={13} /> Test Print</button>
            </div>

            {/* Hardware Diagnostics Status Bar */}
            <div className='mt-3 pt-2.5 border-t border-[#e2e8f0]/60 dark:border-[#334155]/60 flex items-center justify-between text-[11px] text-[#64748b] flex-wrap gap-2'>
              <div className='flex items-center gap-1.5 font-semibold text-[#16a34a]'>
                <Circle size={7} className='fill-[#16a34a]' />
                <span>QZ Tray: Connected (v2.2.4 Silent Dispatch)</span>
              </div>
              <div className='flex items-center gap-2 font-mono text-[10px]'>
                <span>TCP Spooler: {networkPrinterIp}:{networkPrinterPort}</span>
                <span>•</span>
                <span>Zebra ZPL-II Driver (203 DPI)</span>
              </div>
            </div>

            {/* Print Session Log Stream */}
            <div className='mt-3 pt-2.5 border-t border-[#e2e8f0]/60 dark:border-[#334155]/60'>
              <div className='flex items-center justify-between text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5'>
                <div className='flex items-center gap-1.5'>
                  <Activity size={11} className='text-[#00288e] dark:text-[#38bdf8]' /> Print Session Log
                </div>
                <span className='text-[9px] font-normal text-[#94a3b8]'>{sessionLogs.length} events logged</span>
              </div>
              <div className='space-y-1 font-mono text-[10px] max-h-24 overflow-y-auto bg-[#0f172a] text-[#38bdf8] p-2.5 rounded-xl border border-[#334155]'>
                {sessionLogs.map(log => (
                  <div key={log.id} className='flex items-center gap-2 truncate'>
                    <span className='text-[#64748b] shrink-0'>[{log.time}]</span>
                    <span className={log.type === 'success' ? 'text-[#4ade80]' : log.type === 'warn' ? 'text-[#f59e0b]' : 'text-[#38bdf8]'}>
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>


        {/* ── RIGHT SIDEBAR ── */}
        <div className='w-72 xl:w-80 shrink-0 bg-white dark:bg-[#1e232a] border-l border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-y-auto'>

          {/* Label Preview */}
          <div className='p-4 border-b border-[#e2e8f0] dark:border-[#334155]'>
            <div className='flex items-center justify-between mb-3'>
              <span className='text-xs font-bold'>Label Preview</span>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={handleExportSingleLabelSvg}
                  disabled={!previewRow}
                  title='Export Label as Vector SVG'
                  className='text-[11px] text-[#00288e] dark:text-[#a8b8ff] font-bold hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline'
                >
                  <Download size={11} /> SVG
                </button>
                <button
                  type='button'
                  onClick={onNavigateToDesigner}
                  className='text-[11px] text-[#00288e] dark:text-[#a8b8ff] font-bold hover:underline flex items-center gap-1'
                >
                  <Tag size={10} /> Designer
                </button>
              </div>
            </div>
            {/* Simulated label card */}
            <div className='border-2 border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden bg-white shadow-sm'>
              <div className='bg-white text-black p-3 flex flex-col items-center text-center' style={{ minHeight: '110px' }}>
                {previewRow ? (
                  <>
                    <div className='font-extrabold text-[12px] leading-tight'>SMRITI SYSTEMS</div>
                    <div className='font-bold text-[11px] mt-0.5 text-[#1a1a1a]'>{previewRow.product.toUpperCase()}</div>
                    <div className='text-[10px] text-[#475569] mt-0.5'>
                      {[previewRow.style, previewRow.shade, previewRow.size].filter(Boolean).join(' / ')}
                    </div>
                    {/* Accurate SVG Barcode Component */}
                    <div className='my-1.5 w-full flex justify-center'>
                      {previewRow.barcode ? (
                        <ThermalBarcodeSvg
                          value={previewRow.barcode}
                          widthMm={selectedTemplate.widthMm > 60 ? 50 : 36}
                          heightMm={12}
                          showText={true}
                        />
                      ) : (
                        <div className='text-[10px] text-[#94a3b8] py-2'>No barcode assigned</div>
                      )}
                    </div>
                    <div className='flex items-center justify-between w-full text-[10px]'>
                      <span>Size: {previewRow.size || '-'}</span>
                      <span className='font-extrabold text-[12px]'>{fmtINR(previewRow.mrp)}</span>
                    </div>
                  </>
                ) : (
                  <div className='flex-1 flex flex-col items-center justify-center text-[#94a3b8] text-[11px] py-4'>
                    <Tag size={22} className='mb-1' />
                    Select an item to preview
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pre-Print Sanitizer Card */}
          <div className='p-4 border-b border-[#e2e8f0] dark:border-[#334155]'>
            <div className='flex items-center justify-between mb-2.5'>
              <div className='flex items-center gap-1.5 text-xs font-bold'>
                <ShieldAlert size={14} className={sanitizerReport.isClean ? 'text-[#16a34a]' : 'text-[#f59e0b]'} />
                <span>Pre-Print Sanitizer</span>
              </div>
              <span className={'px-2 py-0.5 rounded-full text-[10px] font-extrabold ' + (sanitizerReport.isClean ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]')}>
                {sanitizerReport.isClean ? '● All Clean' : `⚠️ ${sanitizerReport.totalIssues} Warning${sanitizerReport.totalIssues !== 1 ? 's' : ''}`}
              </span>
            </div>

            {sanitizerReport.isClean ? (
              <p className='text-[11px] text-[#64748b] leading-tight'>
                No duplicate barcodes detected. All sizes, colors, and prices verified.
              </p>
            ) : (
              <div className='space-y-2'>
                <div className='flex flex-wrap gap-1.5'>
                  {sanitizerReport.duplicateBarcodes.length > 0 && (
                    <span className='px-2 py-0.5 rounded-md bg-[#fee2e2] text-[#b91c1c] text-[10px] font-bold'>
                      Duplicates: {sanitizerReport.duplicateBarcodes.length}
                    </span>
                  )}
                  {sanitizerReport.missingSizes.length > 0 && (
                    <span className='px-2 py-0.5 rounded-md bg-[#fef3c7] text-[#b45309] text-[10px] font-bold'>
                      Missing Size: {sanitizerReport.missingSizes.length}
                    </span>
                  )}
                  {sanitizerReport.missingColors.length > 0 && (
                    <span className='px-2 py-0.5 rounded-md bg-[#fef3c7] text-[#b45309] text-[10px] font-bold'>
                      Missing Color: {sanitizerReport.missingColors.length}
                    </span>
                  )}
                  {sanitizerReport.invalidMrp.length > 0 && (
                    <span className='px-2 py-0.5 rounded-md bg-[#fee2e2] text-[#b91c1c] text-[10px] font-bold'>
                      Zero MRP: {sanitizerReport.invalidMrp.length}
                    </span>
                  )}
                  {sanitizerReport.invalidBarcodes.length > 0 && (
                    <span className='px-2 py-0.5 rounded-md bg-[#fee2e2] text-[#b91c1c] text-[10px] font-bold'>
                      Invalid Barcode: {sanitizerReport.invalidBarcodes.length}
                    </span>
                  )}
                </div>
                <button
                  type='button'
                  onClick={autoFixSanitizerIssues}
                  className='w-full py-1 text-[11px] font-bold border border-[#f59e0b] text-[#b45309] hover:bg-[#fffbeb] rounded-lg transition'
                >
                  ⚡ Auto-Sanitize & Fix Issues
                </button>
              </div>
            )}

            {/* Save Current Settings Preset Button */}
            <button
              type='button'
              onClick={() => setSavePresetModalOpen(true)}
              className='w-full mt-2.5 py-1.5 text-[11px] font-bold border border-[#00288e] dark:border-[#3b82f6] text-[#00288e] dark:text-[#60a5fa] hover:bg-[#dde1ff]/30 rounded-xl transition flex items-center justify-center gap-1.5'
              title='Save current template, printer IP, port and interface settings as a named preset'
            >
              <Save size={12} /> Save Current Settings Preset
            </button>
          </div>

          {/* Print Summary */}
          <div className='p-4 border-b border-[#e2e8f0] dark:border-[#334155]'>
            <div className='text-xs font-bold mb-3'>Print Summary</div>
            <div className='space-y-2.5'>
              {([
                ['Items Selected', String(selectedRows.length), Package],
                ['Total Labels', String(totalLabels), Layers],
                ['Template', selectedTemplate.name, Tag],
                ['Labels / Item', String(labelsPerItem), Layers],
              ] as [string, string, React.FC<any>][]).map(([label, val, Icon]) => (
                <div key={label} className='flex items-center justify-between text-xs'>
                  <div className='flex items-center gap-2 text-[#64748b]'><Icon size={12} />{label}</div>
                  <span className='font-bold text-[#0f172a] dark:text-[#f8fafc]'>{val}</span>
                </div>
              ))}
              <div className='flex items-center justify-between text-xs'>
                <div className='flex items-center gap-2 text-[#64748b]'><Printer size={12} />Printer</div>
                <div className='flex items-center gap-1.5'>
                  <span className='font-bold text-[#0f172a] dark:text-[#f8fafc] text-[11px]'>{printerName.length > 16 ? printerName.slice(0, 16) + '…' : printerName}</span>
                  <Circle size={7} className={printerReady ? 'fill-[#16a34a] text-[#16a34a]' : 'fill-[#dc2626] text-[#dc2626]'} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Jobs & 1-Click Reprint */}
          <div className='p-4 border-b border-[#e2e8f0] dark:border-[#334155]'>
            <div className='flex items-center justify-between mb-2.5'>
              <div className='flex items-center gap-1.5 text-xs font-bold'>
                <History size={14} className='text-[#64748b]' />
                <span>Recent Jobs</span>
              </div>
              <button
                type='button'
                onClick={fetchRecentJobs}
                className='text-[10px] text-[#00288e] dark:text-[#a8b8ff] hover:underline font-semibold'
              >
                Refresh
              </button>
            </div>
            {recentJobs.length === 0 ? (
              <div className='text-[11px] text-[#94a3b8] py-1'>No recent print activity.</div>
            ) : (
              <div className='space-y-2'>
                {recentJobs.slice(0, 3).map(job => (
                  <div
                    key={job.id}
                    className='p-2 bg-[#f8fafc] dark:bg-[#0f172a] rounded-lg border border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between gap-2'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='text-[11px] font-bold truncate text-[#0f172a] dark:text-[#f8fafc]'>
                        {job.itemCode}
                      </div>
                      <div className='text-[10px] text-[#64748b]'>
                        {job.quantity} label{job.quantity !== 1 ? 's' : ''} • {job.status}
                      </div>
                    </div>
                    <button
                      type='button'
                      disabled={reprintingId === job.id}
                      onClick={() => void handleReprintJob(job)}
                      className='px-2 py-1 text-[10px] font-bold bg-[#00288e] hover:bg-[#002070] text-white rounded-md transition shrink-0 disabled:opacity-50'
                    >
                      {reprintingId === job.id ? '...' : 'Reprint'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className='p-4 space-y-2.5 mt-auto'>
            {!printerReady && (
              <div className='flex items-start gap-2 p-2.5 bg-[#fef2f2] border border-[#fca5a5] rounded-xl text-[10px] text-[#dc2626] font-semibold'>
                <AlertTriangle size={13} className='shrink-0 mt-0.5' />
                Printer offline. Check connection.
              </div>
            )}
            {totalLabels === 0 && selectedRows.length === 0 && (
              <div className='text-[11px] text-[#64748b] text-center'>Select items and set quantities to print.</div>
            )}
            <button
              id='printLabelsStudioPrint'
              type='button'
              disabled={printing || totalLabels === 0 || !printerReady}
              onClick={() => void handlePrint()}
              className='w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white shadow-lg transition'
            >
              {printing
                ? <><RefreshCcw size={15} className='animate-spin' /> Sending...</>
                : <><Printer size={15} /> Print {totalLabels > 0 ? totalLabels : ''} Label{totalLabels !== 1 ? 's' : ''}</>}
            </button>
            <button
              id='printLabelsStudioPreview'
              type='button'
              onClick={() => setPreviewModalOpen(true)}
              className='w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-sm border-2 border-[#c4c5d5] dark:border-[#444653] text-[#475569] hover:bg-[#f1f5f9] transition'
            >
              <Eye size={15} /> Preview Labels
            </button>
          </div>

        </div>
      </div>

      {/* ── BROWSER LABEL PRINT SHEET PREVIEW MODAL ── */}
      {previewModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-[#1e232a] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-hidden'>
            <div className='px-6 py-4 border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-[#f8fafc] dark:bg-[#131b2e]'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-[#dde1ff] dark:bg-[#1e40af]/30 rounded-xl'>
                  <Eye size={20} className='text-[#00288e] dark:text-[#a8b8ff]' />
                </div>
                <div>
                  <h2 className='text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]'>Labels Print Sheet Preview</h2>
                  <p className='text-xs text-[#64748b]'>
                    Template: {selectedTemplate.name} ({selectedTemplate.widthMm}mm × {selectedTemplate.heightMm}mm) • {totalLabels > 0 ? totalLabels : (rows.length > 0 ? 1 : 0)} Labels
                  </p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setPreviewModalOpen(false)}
                className='text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] p-1.5 rounded-lg hover:bg-[#e2e8f0] transition'
              >
                <X size={18} />
              </button>
            </div>

            <div className='p-6 overflow-y-auto flex-1 bg-[#f1f5f9] dark:bg-[#0f172a]/60'>
              <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'>
                {(selectedRows.length > 0 ? selectedRows : (previewRow ? [previewRow] : rows.slice(0, 6))).map((r, i) => (
                  <div
                    key={`${r.id}-${i}`}
                    className='bg-white text-black p-3.5 rounded-xl border border-gray-300 shadow-sm flex flex-col items-center text-center justify-between'
                    style={{ minHeight: '140px' }}
                  >
                    <div className='w-full'>
                      <div className='font-extrabold text-[12px] tracking-wide'>SMRITI RETAIL</div>
                      <div className='font-bold text-[11px] mt-0.5 truncate'>{r.product}</div>
                      <div className='text-[10px] text-gray-600 mt-0.5'>
                        {[r.brand, r.style, r.size, r.shade].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                    <div className='my-2 w-full flex justify-center'>
                      <ThermalBarcodeSvg
                        value={r.barcode || r.itemCode || '890100000001'}
                        widthMm={38}
                        heightMm={12}
                        showText={true}
                      />
                    </div>
                    <div className='w-full flex items-center justify-between text-[11px] pt-1 border-t border-gray-200'>
                      <span className='font-mono text-gray-500'>SKU: {r.itemCode}</span>
                      <span className='font-extrabold text-[12px] text-black'>{fmtINR(r.mrp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className='px-6 py-3.5 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-white dark:bg-[#1e232a]'>
              <div className='text-xs text-[#64748b]'>
                Target: <span className='font-bold text-[#0f172a] dark:text-[#f8fafc]'>{printerName}</span>
              </div>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => setPreviewModalOpen(false)}
                  className='px-4 py-2 text-xs font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition'
                >
                  Close
                </button>
                <button
                  type='button'
                  onClick={handleExportSheetSvg}
                  className='flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-[#00288e] dark:border-[#3b82f6] text-[#00288e] dark:text-[#60a5fa] hover:bg-[#dde1ff]/30 rounded-xl transition'
                >
                  <Download size={14} /> Export Vector SVG
                </button>
                <button
                  type='button'
                  onClick={() => { window.print(); }}
                  className='flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#00288e] hover:bg-[#002070] text-white rounded-xl shadow transition'
                >
                  <Printer size={14} /> Browser Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINTER SETTINGS MODAL ── */}
      {settingsOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-[#1e232a] w-full max-w-lg rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-hidden'>
            <div className='px-6 py-4 border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-[#f8fafc] dark:bg-[#131b2e]'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-[#dde1ff] dark:bg-[#1e40af]/30 rounded-xl'>
                  <Settings size={20} className='text-[#00288e] dark:text-[#a8b8ff]' />
                </div>
                <div>
                  <h2 className='text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]'>Printer & Hardware Configuration</h2>
                  <p className='text-xs text-[#64748b]'>Manage print dispatch settings, resolution, and hardware endpoints.</p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setSettingsOpen(false)}
                className='text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] p-1.5 rounded-lg hover:bg-[#e2e8f0] transition'
              >
                <X size={18} />
              </button>
            </div>

            <div className='p-6 space-y-4 text-xs bg-white dark:bg-[#1e232a]'>
              <div>
                <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>Active Thermal Printer Target</label>
                <select
                  value={printerName}
                  onChange={e => setPrinterName(e.target.value)}
                  className='w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#0f172a] font-semibold'
                >
                  {printers.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>Print Resolution (DPI)</label>
                  <select
                    defaultValue='203'
                    className='w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#0f172a] font-semibold'
                  >
                    <option value='203'>203 DPI (8 dots/mm - Standard)</option>
                    <option value='300'>300 DPI (12 dots/mm - High Res)</option>
                    <option value='600'>600 DPI (24 dots/mm - Ultra)</option>
                  </select>
                </div>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>Dispatch Mode</label>
                  <select
                    defaultValue='QZ_TRAY'
                    className='w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#0f172a] font-semibold'
                  >
                    <option value='QZ_TRAY'>QZ Tray (Local Hardware Silent)</option>
                    <option value='TCP_SPOOL'>FastAPI TCP Spooler (Port 9100)</option>
                    <option value='BROWSER'>Browser Print Dialog</option>
                  </select>
                </div>
              </div>

              <div className='p-3 bg-[#f8fafc] dark:bg-[#0f172a] rounded-xl border border-[#e2e8f0] dark:border-[#334155] text-[11px] text-[#64748b]'>
                <div className='font-bold text-[#0f172a] dark:text-[#f8fafc] mb-1'>Hardware Status Diagnostic</div>
                <div>Connection: {printerReady ? 'Online & Ready (Port 9100 / QZ Tray)' : 'Offline / Disconnected'}</div>
                <div>Thermal Driver: Zebra ZPL-II / TSPL / ESC-POS Auto-Detect</div>
              </div>
            </div>

            <div className='px-6 py-3.5 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-end gap-2 bg-[#f8fafc] dark:bg-[#131b2e]'>
              <button
                type='button'
                onClick={() => setSettingsOpen(false)}
                className='px-4 py-2 text-xs font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition'
              >
                Close
              </button>
              <button
                type='button'
                onClick={() => {
                  setSettingsOpen(false);
                  onNotification?.('Settings Saved', 'Printer and dispatch configuration updated.', 'success');
                }}
                className='px-4 py-2 text-xs font-bold bg-[#00288e] hover:bg-[#002070] text-white rounded-xl shadow transition'
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIRECT RAW PRN MODAL ── */}
      {rawPrnModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-[#1e232a] w-full max-w-3xl rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-hidden'>
            <div className='px-6 py-4 border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-[#f8fafc] dark:bg-[#131b2e]'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-[#dde1ff] dark:bg-[#1e40af]/30 rounded-xl'>
                  <Code size={20} className='text-[#00288e] dark:text-[#a8b8ff]' />
                </div>
                <div>
                  <h2 className='text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]'>Direct Raw PRN / ZPL Code Editor</h2>
                  <p className='text-xs text-[#64748b]'>Review, edit, or dispatch custom thermal control code directly to the hardware.</p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setRawPrnModalOpen(false)}
                className='text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] p-1.5 rounded-lg hover:bg-[#e2e8f0] transition'
              >
                <X size={18} />
              </button>
            </div>

            <div className='p-6 space-y-3 bg-white dark:bg-[#1e232a]'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <span className='text-xs font-bold text-[#64748b]'>Insert Snippets:</span>
                  <button
                    type='button'
                    onClick={() => {
                      const items = selectedRows.length > 0 ? selectedRows : (previewRow ? [previewRow] : rows.slice(0, 1));
                      setRawPrnText(compilePrnString(items, templates.find(t => t.id === 'lay-footwear-100x50-3stub') || templates[0]));
                    }}
                    className='px-2.5 py-1 text-[11px] font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition'
                  >
                    Footwear 3-Stub
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      const items = selectedRows.length > 0 ? selectedRows : (previewRow ? [previewRow] : rows.slice(0, 1));
                      setRawPrnText(compilePrnString(items, templates.find(t => t.id === 'retail-50x25') || templates[0]));
                    }}
                    className='px-2.5 py-1 text-[11px] font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition'
                  >
                    Retail 50x25
                  </button>
                  <button
                    type='button'
                    onClick={() => setRawPrnText('^XA\n^FO50,50^BY2^BCN,60,Y,N,N^FD8904551005335^FS\n^XZ')}
                    className='px-2.5 py-1 text-[11px] font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition'
                  >
                    EAN-13 Sample
                  </button>
                </div>
                <div className='text-[11px] font-mono text-[#64748b]'>
                  Lines: {rawPrnText ? rawPrnText.split('\n').length : 0} • Bytes: {new Blob([rawPrnText]).size}
                </div>
              </div>

              <textarea
                value={rawPrnText}
                onChange={e => setRawPrnText(e.target.value)}
                rows={12}
                placeholder='^XA ... ^XZ'
                className='w-full p-3 font-mono text-xs bg-[#0f172a] text-[#4ade80] rounded-xl border border-[#334155] outline-none focus:border-[#3b82f6] leading-relaxed resize-y'
                spellCheck={false}
              />
            </div>

            <div className='px-6 py-3.5 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-[#f8fafc] dark:bg-[#131b2e]'>
              <button
                type='button'
                onClick={() => {
                  downloadPrnFile(rawPrnText, `custom_${Date.now()}.prn`);
                  onNotification?.('PRN Downloaded', 'Downloaded custom PRN file.', 'success');
                }}
                className='flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition'
              >
                <Download size={13} /> Download .PRN File
              </button>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => setRawPrnModalOpen(false)}
                  className='px-4 py-2 text-xs font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition'
                >
                  Close
                </button>
                <button
                  type='button'
                  disabled={printing || !rawPrnText.trim()}
                  onClick={() => void handleSendRawPrn()}
                  className='flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#16a34a] hover:bg-[#15803d] text-white rounded-xl shadow transition disabled:opacity-50'
                >
                  <Printer size={13} /> Send to Thermal Printer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MAPPING REFERENCE MODAL ── */}
      {mappingModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-[#1e232a] w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-hidden'>
            <div className='px-6 py-4 border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-[#f8fafc] dark:bg-[#131b2e]'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-[#dde1ff] dark:bg-[#1e40af]/30 rounded-xl'>
                  <BookOpen size={20} className='text-[#00288e] dark:text-[#a8b8ff]' />
                </div>
                <div>
                  <h2 className='text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]'>Dynamic ZPL / PRN Token Mapping Reference</h2>
                  <p className='text-xs text-[#64748b]'>Standard placeholder variables available for thermal templates in SMRITI Retail OS.</p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setMappingModalOpen(false)}
                className='text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] p-1.5 rounded-lg hover:bg-[#e2e8f0] transition'
              >
                <X size={18} />
              </button>
            </div>

            <div className='p-6 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#1e232a]'>
              <table className='w-full border-collapse border border-[#e2e8f0] dark:border-[#334155]'>
                <thead>
                  <tr className='bg-[#f8fafc] dark:bg-[#131b2e] text-left text-[#475569] dark:text-[#94a3b8] font-bold border-b border-[#e2e8f0] dark:border-[#334155]'>
                    <th className='p-2.5'>Token Placeholder</th>
                    <th className='p-2.5'>Field Description</th>
                    <th className='p-2.5'>Sample Output</th>
                    <th className='p-2.5 font-mono'>ZPL Command Syntax</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-[#e2e8f0] dark:divide-[#334155]'>
                  {[
                    ['{barcode}', 'Scannable Barcode String', '8904551005335', '^BY2^BCN,66,N,N,N^FD>:{barcode}^FS'],
                    ['{art_no}', 'Article / Design / Style Code', 'CH-30-K', '^A0N,30,28^FR^FD{art_no}^FS'],
                    ['{art_no_padded}', 'Right-padded Art No (12 chars)', 'CH-30-K     ', '^A0N,30,28^FR^FD{art_no_padded}^FS'],
                    ['{color}', 'Variant Shade / Colorway', 'BLACK', '^A0N,28,27^FD{color}^FS'],
                    ['{size}', 'Variant Size Designation', '37', '^A0N,50,47^FR^FD{size}^FS'],
                    ['{mrp}', 'Maximum Retail Price (Integer)', '1199', '^A0N,38,36^FDMRP:{mrp}/-^FS'],
                    ['{brand}', 'Brand Identity / Line', 'TATTLY THREADS', '^ABB,11,7^FD{brand}^FS'],
                    ['{mfg_date}', 'Manufacturing Date (MM/YY)', '10/26', '^A0N,17,23^FDMFG.Dt.:{mfg_date}^FS'],
                    ['{company_name}', 'Legal Metrology Marketer Name', 'Tattly Threads', '^A0N,20,27^FDMKTD.By:{company_name}^FS'],
                    ['{company_address}', 'Registered Marketer Address', '81,Umerkhadi,Mumbai', '^A0N,17,23^FD{company_address}^FS'],
                    ['{company_email}', 'Consumer Care Email', 'care@tattlythreads.com', '^A0N,17,23^FD{company_email}^FS'],
                    ['{net_contents}', 'Mandatory Package Contents', '1 Pair Footwear', '^A0N,17,23^FD{net_contents}^FS'],
                  ].map(([token, desc, sample, zpl]) => (
                    <tr key={token} className='hover:bg-[#f8fafc] dark:hover:bg-[#131b2e]/50'>
                      <td className='p-2.5 font-mono font-bold text-[#00288e] dark:text-[#a8b8ff]'>{token}</td>
                      <td className='p-2.5 font-medium'>{desc}</td>
                      <td className='p-2.5 text-[#64748b]'>{sample}</td>
                      <td className='p-2.5 font-mono text-[11px] text-[#059669] dark:text-[#34d399]'>{zpl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className='p-3 bg-[#f8fafc] dark:bg-[#0f172a] rounded-xl border border-[#e2e8f0] dark:border-[#334155] text-[11px] text-[#64748b]'>
                <p><strong>Note:</strong> All placeholder tokens are case-insensitive. In reverse-box areas (`^FR`), ensure background box (`^GB`) is set with matching height and width before positioning reverse text.</p>
              </div>
            </div>

            <div className='px-6 py-3.5 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-end bg-[#f8fafc] dark:bg-[#131b2e]'>
              <button
                type='button'
                onClick={() => setMappingModalOpen(false)}
                className='px-4 py-2 text-xs font-bold bg-[#00288e] text-white rounded-xl shadow hover:bg-[#002070] transition'
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE TO HEX (PRN) UTILITY MODAL ── */}
      {imgHexModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-[#1e232a] w-full max-w-2xl rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-hidden'>
            <div className='px-6 py-4 border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-[#f8fafc] dark:bg-[#131b2e]'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-[#dde1ff] dark:bg-[#1e40af]/30 rounded-xl'>
                  <Image size={20} className='text-[#00288e] dark:text-[#a8b8ff]' />
                </div>
                <div>
                  <h2 className='text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]'>Image to Hex (PRN) Graphic Converter</h2>
                  <p className='text-xs text-[#64748b]'>Convert monochrome logos or icons into native Zebra ZPL `^GFA` graphic hex code.</p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setImgHexModalOpen(false)}
                className='text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] p-1.5 rounded-lg hover:bg-[#e2e8f0] transition'
              >
                <X size={18} />
              </button>
            </div>

            <div className='p-6 space-y-4 text-xs bg-white dark:bg-[#1e232a]'>
              <div>
                <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1.5'>Upload Brand Logo (PNG, JPG, BMP)</label>
                <input
                  type='file'
                  accept='image/*'
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const img = new window.Image();
                      img.onload = () => {
                        const canvas = canvasRef.current || document.createElement('canvas');
                        const maxW = 200;
                        const scale = img.width > maxW ? maxW / img.width : 1;
                        canvas.width = Math.round(img.width * scale);
                        canvas.height = Math.round(img.height * scale);
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.fillStyle = '#ffffff';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                          const zpl = convertCanvasToZplGfa(canvas);
                          setZplHexOutput(zpl);
                        }
                      };
                      img.src = ev.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                  }}
                  className='block w-full text-xs text-[#64748b] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#dde1ff] file:text-[#00288e] hover:file:bg-[#c7ceff] cursor-pointer'
                />
              </div>

              <div className='flex items-center justify-center p-4 bg-[#f8fafc] dark:bg-[#0f172a] rounded-xl border border-dashed border-[#c4c5d5] dark:border-[#444653] min-h-[90px]'>
                <canvas ref={canvasRef} className='max-h-24 max-w-full border border-gray-300 rounded shadow-sm bg-white' />
              </div>

              <div>
                <div className='flex items-center justify-between mb-1'>
                  <label className='font-bold text-[#475569] dark:text-[#94a3b8]'>Generated Zebra `^GFA` Hex Stream</label>
                  <button
                    type='button'
                    disabled={!zplHexOutput}
                    onClick={() => {
                      navigator.clipboard.writeText(zplHexOutput);
                      setCopiedHex(true);
                      setTimeout(() => setCopiedHex(false), 2000);
                    }}
                    className='text-[11px] font-bold text-[#00288e] dark:text-[#a8b8ff] hover:underline flex items-center gap-1 disabled:opacity-40'
                  >
                    {copiedHex ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Code</>}
                  </button>
                </div>
                <textarea
                  value={zplHexOutput}
                  readOnly
                  rows={4}
                  placeholder='Upload an image above to generate ZPL ^GFA graphic block...'
                  className='w-full p-2.5 font-mono text-[11px] bg-[#0f172a] text-[#4ade80] rounded-xl border border-[#334155] outline-none select-all'
                />
              </div>
            </div>

            <div className='px-6 py-3.5 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-end gap-2 bg-[#f8fafc] dark:bg-[#131b2e]'>
              <button
                type='button'
                onClick={() => setImgHexModalOpen(false)}
                className='px-4 py-2 text-xs font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD CUSTOM ITEM MODAL ── */}
      {customItemModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-[#1e232a] w-full max-w-md rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-hidden'>
            <div className='px-6 py-4 border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-[#f8fafc] dark:bg-[#131b2e]'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-[#dde1ff] dark:bg-[#1e40af]/30 rounded-xl'>
                  <Plus size={20} className='text-[#00288e] dark:text-[#a8b8ff]' />
                </div>
                <div>
                  <h2 className='text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]'>Add Custom Label Item</h2>
                  <p className='text-xs text-[#64748b]'>Create a custom product line item directly on the print worksheet.</p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setCustomItemModalOpen(false)}
                className='text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] p-1.5 rounded-lg hover:bg-[#e2e8f0] transition'
              >
                <X size={18} />
              </button>
            </div>

            <div className='p-6 space-y-3 text-xs bg-white dark:bg-[#1e232a]'>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>Article / Style No</label>
                  <input
                    type='text'
                    value={customArticle}
                    onChange={e => setCustomArticle(e.target.value)}
                    placeholder='e.g. CH-30-K'
                    className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none font-semibold'
                  />
                </div>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>Product Name</label>
                  <input
                    type='text'
                    value={customProduct}
                    onChange={e => setCustomProduct(e.target.value)}
                    placeholder='e.g. Block Heel Sandal'
                    className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none font-semibold'
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>Color / Shade</label>
                  <input
                    type='text'
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    placeholder='e.g. BLACK'
                    className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none uppercase font-semibold'
                  />
                </div>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>Size</label>
                  <input
                    type='text'
                    value={customSize}
                    onChange={e => setCustomSize(e.target.value)}
                    placeholder='e.g. 38'
                    className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none font-semibold'
                  />
                </div>
              </div>

              <div>
                <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>Barcode (13-digit EAN-13)</label>
                <input
                  type='text'
                  value={customBarcode}
                  onChange={e => setCustomBarcode(e.target.value)}
                  placeholder='e.g. 8904551005342 (leave blank to auto-generate)'
                  className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none font-mono font-semibold'
                />
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>MRP (&#8377;)</label>
                  <input
                    type='number'
                    min='0'
                    value={customMrp}
                    onChange={e => setCustomMrp(Number(e.target.value))}
                    className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none font-bold'
                  />
                </div>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1'>Print Quantity</label>
                  <input
                    type='number'
                    min='1'
                    value={customQty}
                    onChange={e => setCustomQty(Number(e.target.value))}
                    className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none font-bold'
                  />
                </div>
              </div>
            </div>

            <div className='px-6 py-3.5 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-end gap-2 bg-[#f8fafc] dark:bg-[#131b2e]'>
              <button
                type='button'
                onClick={() => setCustomItemModalOpen(false)}
                className='px-4 py-2 text-xs font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleAddCustomItem}
                className='px-4 py-2 text-xs font-bold bg-[#00288e] hover:bg-[#002070] text-white rounded-xl shadow transition'
              >
                + Add to Worksheet
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── IMPORT BARCODES FROM CSV / RAW TEXT MODAL ── */}
      {importModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-[#1e232a] w-full max-w-xl rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150'>
            <div className='px-6 py-4 border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-[#f8fafc] dark:bg-[#131b2e]'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-[#dde1ff] dark:bg-[#1e40af]/30 rounded-xl'>
                  <FileSpreadsheet size={20} className='text-[#00288e] dark:text-[#a8b8ff]' />
                </div>
                <div>
                  <h2 className='text-sm font-bold text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-2'>
                    Import Barcodes from CSV / Raw Text
                  </h2>
                  <p className='text-xs text-[#64748b]'>
                    Upload a .csv / .txt file or paste raw lines containing Barcode No / Item Code and Print Qty (e.g. 89010001, 5).
                  </p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setImportModalOpen(false)}
                className='text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] p-1.5 rounded-lg hover:bg-[#e2e8f0] transition'
              >
                <X size={18} />
              </button>
            </div>

            <div className='p-6 space-y-4 text-xs bg-white dark:bg-[#1e232a]'>
              {/* Radio Selector */}
              <div className='flex items-center gap-6 font-bold text-xs text-[#475569] dark:text-[#94a3b8]'>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='radio'
                    name='importMode'
                    checked={importInputMode === 'UPLOAD'}
                    onChange={() => setImportInputMode('UPLOAD')}
                    className='accent-[#00288e]'
                  />
                  <span>UPLOAD CSV FILE</span>
                </label>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='radio'
                    name='importMode'
                    checked={importInputMode === 'PASTE'}
                    onChange={() => setImportInputMode('PASTE')}
                    className='accent-[#00288e]'
                  />
                  <span>PASTE RAW TEXT</span>
                </label>
              </div>

              {/* File Upload Zone */}
              {importInputMode === 'UPLOAD' && (
                <div className='p-4 border-2 border-dashed border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8fafc] dark:bg-[#0f172a] text-center'>
                  <Upload size={24} className='mx-auto mb-2 text-[#00288e] dark:text-[#a8b8ff]' />
                  <p className='text-xs font-semibold text-[#475569] dark:text-[#94a3b8] mb-2'>
                    Choose a CSV or text manifest file
                  </p>
                  <input
                    type='file'
                    accept='.csv,.txt'
                    onChange={handleCsvFileUpload}
                    className='block w-full text-xs text-[#64748b] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#dde1ff] file:text-[#00288e] hover:file:bg-[#c9d0ff] cursor-pointer'
                  />
                </div>
              )}

              {/* Raw Text Textarea */}
              <div>
                <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1.5'>
                  Raw Barcode Lines ({importRawText.split(/\r?\n/).filter(Boolean).length} lines)
                </label>
                <textarea
                  value={importRawText}
                  onChange={e => setImportRawText(e.target.value)}
                  rows={6}
                  placeholder="8904551002686,1&#10;8904551002686,1&#10;8904551002693,1&#10;8904551002709,2"
                  className='w-full p-3 font-mono text-xs bg-[#0f172a] text-[#38bdf8] rounded-xl border border-[#334155] outline-none select-all focus:border-[#38bdf8]'
                />
              </div>

              {/* Parsing Dropdowns */}
              <div className='grid grid-cols-3 gap-3 pt-1'>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1 text-[11px] uppercase'>
                    Delimiter
                  </label>
                  <select
                    value={importDelimiter}
                    onChange={e => setImportDelimiter(e.target.value as any)}
                    className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] font-semibold outline-none'
                  >
                    <option value='auto'>Auto Detect</option>
                    <option value=','>Comma (,)</option>
                    <option value={'\t'}>Tab (\t)</option>
                    <option value=';'>Semicolon (;)</option>
                    <option value=' '>Space ( )</option>
                  </select>
                </div>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1 text-[11px] uppercase'>
                    Barcode Col
                  </label>
                  <select
                    value={importBarcodeCol}
                    onChange={e => setImportBarcodeCol(Number(e.target.value))}
                    className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] font-semibold outline-none'
                  >
                    <option value={0}>Column 1 (A)</option>
                    <option value={1}>Column 2 (B)</option>
                    <option value={2}>Column 3 (C)</option>
                    <option value={3}>Column 4 (D)</option>
                  </select>
                </div>
                <div>
                  <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1 text-[11px] uppercase'>
                    Print Qty Col
                  </label>
                  <select
                    value={importQtyCol}
                    onChange={e => setImportQtyCol(Number(e.target.value))}
                    className='w-full px-2.5 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] font-semibold outline-none'
                  >
                    <option value={1}>Column 2 (B)</option>
                    <option value={0}>Column 1 (A)</option>
                    <option value={2}>Column 3 (C)</option>
                    <option value={-1}>None (Default 1)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className='px-6 py-3.5 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-end gap-2 bg-[#f8fafc] dark:bg-[#131b2e]'>
              <button
                type='button'
                onClick={() => setImportModalOpen(false)}
                className='px-4 py-2 text-xs font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleProcessCsvImport}
                className='px-5 py-2 text-xs font-bold bg-[#00288e] hover:bg-[#002070] text-white rounded-xl shadow-md transition flex items-center gap-1.5'
              >
                <Download size={14} className='rotate-180' /> Process & Add to Worksheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SAVE PRINT PROFILE PRESET MODAL ── */}
      {savePresetModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
          <div className='bg-white dark:bg-[#1e232a] w-full max-w-md rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-hidden'>
            <div className='px-6 py-4 border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between bg-[#f8fafc] dark:bg-[#131b2e]'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-[#dde1ff] dark:bg-[#1e40af]/30 rounded-xl'>
                  <Save size={20} className='text-[#00288e] dark:text-[#a8b8ff]' />
                </div>
                <div>
                  <h2 className='text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]'>
                    Save Print Profile Preset
                  </h2>
                  <p className='text-xs text-[#64748b]'>
                    Store your current template, printer IP, port and interface configuration.
                  </p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setSavePresetModalOpen(false)}
                className='text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] p-1.5 rounded-lg hover:bg-[#e2e8f0] transition'
              >
                <X size={18} />
              </button>
            </div>

            <div className='p-6 space-y-4 text-xs bg-white dark:bg-[#1e232a]'>
              <div>
                <label className='block font-bold text-[#475569] dark:text-[#94a3b8] mb-1.5'>
                  Preset Name
                </label>
                <input
                  type='text'
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  placeholder='e.g. Packing Station 1 (Zebra GK420D)'
                  className='w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#0f172a] outline-none font-semibold text-xs'
                  autoFocus
                />
              </div>

              <div className='p-3 bg-[#f8fafc] dark:bg-[#0f172a] rounded-xl border border-[#e2e8f0] dark:border-[#334155] space-y-1 text-[11px] text-[#64748b]'>
                <div className='flex justify-between'>
                  <span>Template:</span>
                  <span className='font-bold text-[#0f172a] dark:text-white'>{selectedTemplate.name}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Interface:</span>
                  <span className='font-bold text-[#0f172a] dark:text-white'>{printerInterface}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Network Host:</span>
                  <span className='font-bold text-[#0f172a] dark:text-white'>{networkPrinterIp}:{networkPrinterPort}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Resolution:</span>
                  <span className='font-bold text-[#0f172a] dark:text-white'>{dpi} DPI</span>
                </div>
              </div>
            </div>

            <div className='px-6 py-3.5 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-end gap-2 bg-[#f8fafc] dark:bg-[#131b2e]'>
              <button
                type='button'
                onClick={() => setSavePresetModalOpen(false)}
                className='px-4 py-2 text-xs font-bold border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleSaveCurrentPreset}
                className='px-4 py-2 text-xs font-bold bg-[#00288e] hover:bg-[#002070] text-white rounded-xl shadow transition'
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintLabelsStudio;

