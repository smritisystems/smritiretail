/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.46.2
 * Created      : 2026-09-26
 * Modified     : 2026-10-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Print Labels Studio - SMRITI Barcode Label Wizard
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  Printer, Settings, HelpCircle, Search, Filter, ChevronDown, ChevronUp,
  CheckSquare, Square, Trash2, RefreshCcw, Eye, Package, ShoppingCart,
  Truck, BarChart2, ArrowLeftRight, MoreHorizontal, Zap, X,
  Tag, Layers, AlertTriangle, Circle, Download,
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

  const escapeXml = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

          {/* ── STEP 3 : Print Setup ── */}
          <section className='bg-white dark:bg-[#1e232a] rounded-2xl border border-[#e2e8f0] dark:border-[#334155] p-4 shadow-sm'>
            <div className='flex items-center gap-2 mb-4'>
              <span className='flex items-center justify-center w-6 h-6 rounded-full bg-[#00288e] text-white text-xs font-bold shrink-0'>3</span>
              <span className='font-bold text-sm'>Print Setup</span>
              <span className='text-[11px] text-[#64748b]'>(Choose template, quantity and printer)</span>
            </div>
            <div className='flex items-end gap-5 flex-wrap'>
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
              {/* Printer */}
              <div className='flex-1 min-w-[200px]'>
                <label className='flex items-center gap-1.5 text-[10px] font-bold text-[#64748b] uppercase mb-1.5'><Printer size={10} /> Printer</label>
                <div className='flex items-center gap-2'>
                  <select value={printerName} onChange={e => setPrinterName(e.target.value)} className='flex-1 px-2.5 py-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none focus:border-[#00288e] font-semibold'>
                    {printers.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <div className={'flex items-center gap-1 text-[11px] font-bold shrink-0 ' + (printerReady ? 'text-[#16a34a]' : 'text-[#dc2626]')}>
                    <Circle size={8} className={printerReady ? 'fill-[#16a34a]' : 'fill-[#dc2626]'} />
                    {printerReady ? 'Ready' : 'Offline'}
                  </div>
                </div>
              </div>
              <button type='button' onClick={handleTestPrint} className='flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#475569] border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a] shrink-0'><Printer size={13} /> Test Print</button>
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
    </div>
  );
};

export default PrintLabelsStudio;

