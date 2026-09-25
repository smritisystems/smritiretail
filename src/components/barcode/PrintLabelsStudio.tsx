/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.45.0
 * Created      : 2026-09-26
 * Modified     : 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
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
  Tag, Layers, AlertTriangle, Circle,
} from 'lucide-react';
import { apiFetchV1 } from '../../lib/apiFetchV1.ts';

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
  { key: 'PURCHASE',      label: 'Purchase',      sub: '',               Icon: ShoppingCart },
  { key: 'GRN',           label: 'GRN',           sub: '',               Icon: Truck },
  { key: 'SALES',         label: 'Sales',         sub: '',               Icon: BarChart2 },
  { key: 'STOCK_TRANSFER',label: 'Stock Transfer', sub: '',              Icon: ArrowLeftRight },
];

const EMPTY_FILTERS: AdvancedFilters = {
  itemCodeFrom: '', itemCodeTo: '', product: 'All', category: 'All',
  brand: 'All', style: 'All', shade: 'All', size: 'All',
  barcodeFrom: '', barcodeTo: '', warehouse: 'All', supplier: 'All',
};

const fmtINR = (n: number) =>
  '\u20b9' + n.toLocaleString('en-IN', { minimumFractionDigits: 0 });

const PAGE_SIZE = 25;

// ── Props ───────────────────────────────────────────────────────────────────

export interface PrintLabelsStudioProps {
  currentUser?: { role: string; name: string; username?: string } | null;
  onNotification?: (title: string, msg: string, type: 'success' | 'error' | 'info') => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const PrintLabelsStudio: React.FC<PrintLabelsStudioProps> = ({
  currentUser, onNotification,
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
  // Print Setup
  const [templateId, setTemplateId]     = useState('retail-50x25');
  const [labelsPerItem, setLabelsPerItem] = useState(1);
  const [printerName, setPrinterName]   = useState('Zebra ZD421 (USB)');
  const [printerReady, setPrinterReady] = useState(true);
  // Printing
  const [printing, setPrinting]         = useState(false);
  // Preview selected row
  const [previewRow, setPreviewRow]     = useState<StudioRow | null>(null);
  // Brands/styles/shades/sizes for quick-filter dropdowns
  const [brands, setBrands]             = useState<string[]>([]);
  const [styles, setStyles]             = useState<string[]>([]);
  const [shades, setShades]             = useState<string[]>([]);
  const [sizes, setSizes]               = useState<string[]>([]);

  const selectedTemplate = LABEL_TEMPLATES.find(t => t.id === templateId) ?? LABEL_TEMPLATES[0];
  const selectedRows     = rows.filter(r => r.selected);
  const totalLabels      = selectedRows.reduce((s, r) => s + r.printQty, 0);
  const totalPages       = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  // ── Fetch items ─────────────────────────────────────────────────────────
  const fetchItems = useCallback(async (q: string, pg: number) => {
    setSearching(true);
    try {
      const params = new URLSearchParams({
        search: q, limit: String(PAGE_SIZE), offset: String((pg - 1) * PAGE_SIZE),
        ...(qkBrand !== 'All' && { brand: qkBrand }),
        ...(qkStyle !== 'All' && { style: qkStyle }),
        ...(qkShade !== 'All' && { shade: qkShade }),
        ...(qkSize  !== 'All' && { size: qkSize }),
      });
      const res = await apiFetchV1<any>('/products?' + params.toString());
      const list = Array.isArray(res) ? res : (res?.items ?? []);
      const total = Array.isArray(res) ? res.length : (res?.total ?? res?.count ?? list.length);
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
      setRows(mapped);
      setTotalRows(total);
      // Derive quick-filter options
      if (pg === 1) {
        setBrands([...new Set(mapped.map(r => r.brand).filter(Boolean))]);
        setStyles([...new Set(mapped.map(r => r.style).filter(Boolean))]);
        setShades([...new Set(mapped.map(r => r.shade).filter(Boolean))]);
        setSizes([...new Set(mapped.map(r => r.size).filter(Boolean))]);
      }
      if (mapped.length > 0 && !previewRow) setPreviewRow(mapped[0]);
    } catch (e) {
      setRows([]); setTotalRows(0);
    } finally { setSearching(false); }
  }, [qkBrand, qkStyle, qkShade, qkSize, previewRow]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchItems(search, 1), 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, qkBrand, qkStyle, qkShade, qkSize]);

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

  // ── Printer health check ───────────────────────────────────────────────
  const checkPrinter = useCallback(async () => {
    try {
      const res = await apiFetchV1<any>('/barcode/printer-settings');
      setPrinterName(res?.name ?? res?.printerName ?? 'Zebra ZD421 (USB)');
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
      onNotification?.('Print Job Sent', totalLabels + ' labels dispatched to ' + printerName + '.', 'success');
    } catch (e: any) {
      onNotification?.('Print Failed', e?.message ?? 'Printer error', 'error');
    } finally { setPrinting(false); }
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
        <option value='All'>{label} \u25be</option>
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
          <button type='button' className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'><Tag size={13} /> Template Library</button>
          <button type='button' className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'><Settings size={13} /> Settings</button>
          <button type='button' className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded-lg hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'><HelpCircle size={13} /> Help</button>
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
                  {LABEL_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                    <option>Zebra ZD421 (USB)</option><option>Zebra ZT411 (Network)</option><option>Brother QL-820NWB</option><option>System Default</option>
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
              <button type='button' className='text-[11px] text-[#00288e] font-bold hover:underline flex items-center gap-1'><Tag size={10} /> Change Template</button>
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
                    {/* SVG barcode placeholder */}
                    <div className='my-1.5 w-full flex justify-center'>
                      {previewRow.barcode
                        ? <svg viewBox='0 0 120 28' className='w-full max-w-[120px]' xmlns='http://www.w3.org/2000/svg'>
                            {Array.from({ length: 40 }, (_, i) => (
                              <rect key={i} x={i * 3} y={0} width={i % 3 === 0 ? 2 : 1} height={24} fill='#000' />
                            ))}
                            <text x='60' y='27' textAnchor='middle' fontSize='5' fontFamily='monospace' fill='#000'>{previewRow.barcode}</text>
                          </svg>
                        : <div className='text-[10px] text-[#94a3b8]'>No barcode</div>}
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
                  <span className='font-bold text-[#0f172a] dark:text-[#f8fafc] text-[11px]'>{printerName.length > 16 ? printerName.slice(0, 16) + '\u2026' : printerName}</span>
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
              className='w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-sm border-2 border-[#c4c5d5] dark:border-[#444653] text-[#475569] hover:bg-[#f1f5f9] transition'
            >
              <Eye size={15} /> Preview Labels
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PrintLabelsStudio;
