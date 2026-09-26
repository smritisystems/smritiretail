/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.44.5
 * Created      : 2026-09-26
 * Modified     : 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Credit Billing Terminal - SMRITI Credit Sale Engine
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Plus, Trash2, Search,
  Scan, ChevronDown, Maximize2, Minimize2, FileText, Printer,
  Eye, RotateCcw, User, MapPin, Phone, Building2, ShieldCheck,
  CreditCard, Banknote, RefreshCcw, Package, Star, Clock,
  MoreHorizontal, Save, Send, ChevronRight, X,
} from 'lucide-react';
import { apiFetchV1 } from '../../lib/apiFetchV1.ts';
import { Customer, Product } from '../../types.ts';

// ---- Types ------------------------------------------------------------------

type BillingMode = 'CREDIT' | 'CASH' | 'EXCHANGE' | 'QUOTATION' | 'HOLD';
type DocStatus   = 'DRAFT'  | 'SUBMITTED';
type SidebarTab  = 'CUSTOMER' | 'CREDIT' | 'DELIVERY' | 'OTHER';

interface CreditLineItem {
  id: string; sNo: number; itemCode: string; itemDescription: string;
  rate: number; qty: number; unit: string; discPercent: number;
  discAmt: number; amount: number;
  productId?: string; hsnCode?: string; gstRate?: number; taxAmt?: number;
  stock?: number; mrp?: number; purchaseRate?: number; lastSaleRate?: number;
}

interface CreditBillingHeader {
  customer: Customer | null;
  priceLevel: string; warehouse: string; salesman: string;
  invoiceDate: string; dueDate: string;
}

interface CreditCustomerInfo {
  creditLimit: number; totalOutstanding: number;
  currentInvoiceAmount: number; availableCredit: number;
}

export interface SmritiCreditBillingTerminalProps {
  currentUser?: { role: string; name: string; username?: string; terminalId?: string } | null;
  onNotification?: (title: string, msg: string, type: 'success' | 'error' | 'info') => void;
  onBack?: () => void;
}

// ---- Helpers ----------------------------------------------------------------

const fmtINR = (n: number) =>
  '\u20b9' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayStr = () =>
  new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const dueDateStr = (days = 30) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const GRID_ROWS = 10;

// ---- Component --------------------------------------------------------------

export const SmritiCreditBillingTerminal: React.FC<SmritiCreditBillingTerminalProps> = ({
  currentUser, onNotification, onBack,
}) => {
  const [mode, setMode]           = useState<BillingMode>('CREDIT');
  const [docStatus, setDocStatus] = useState<DocStatus>('DRAFT');
  const [fullscreen, setFullscreen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('CUSTOMER');
  const [submitting, setSubmitting] = useState(false);

  const [header, setHeader] = useState<CreditBillingHeader>({
    customer: null, priceLevel: 'Retail', warehouse: 'Main Store',
    salesman: currentUser?.name ?? '-- Select --',
    invoiceDate: todayStr(), dueDate: dueDateStr(30),
  });

  const [custSearch, setCustSearch]   = useState('');
  const [custDropOpen, setCustDropOpen] = useState(false);
  const [custLoading, setCustLoading] = useState(false);
  const [custOptions, setCustOptions] = useState<Customer[]>([]);
  const custDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [creditInfo, setCreditInfo] = useState<CreditCustomerInfo>({
    creditLimit: 0, totalOutstanding: 0, currentInvoiceAmount: 0, availableCredit: 0,
  });

  const [items, setItems]           = useState<CreditLineItem[]>([]);
  const [selectedRow, setSelectedRow] = useState<number>(-1);
  const [scanInput, setScanInput]   = useState('');
  const [scanning, setScanning]     = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const [remarks, setRemarks]     = useState('');
  const [refNo, setRefNo]         = useState('');
  const [transport, setTransport] = useState('');

  // ---- Totals ---------------------------------------------------------------
  const totalItemCount    = items.length;
  const totalQty          = items.reduce((s, i) => s + i.qty, 0);
  const totalAmount       = items.reduce((s, i) => s + i.amount, 0);
  const itemDiscountTotal = items.reduce((s, i) => s + i.discAmt, 0);
  const billDiscount      = 0;
  const freightCharges    = 0;
  const otherCharges      = 0;
  const subtotal          = totalAmount - itemDiscountTotal + freightCharges + otherCharges;
  const totalTax          = items.reduce((s, i) => s + (i.taxAmt ?? 0), 0);
  const netAmount         = subtotal + totalTax;
  const selectedItem      = selectedRow >= 0 && selectedRow < items.length ? items[selectedRow] : null;

  // ---- Credit sync ----------------------------------------------------------
  useEffect(() => {
    const c = header.customer;
    if (!c) { setCreditInfo({ creditLimit: 0, totalOutstanding: 0, currentInvoiceAmount: 0, availableCredit: 0 }); return; }
    const limit = c.creditLimit ?? 0; const outstanding = c.outstanding ?? 0;
    setCreditInfo({ creditLimit: limit, totalOutstanding: outstanding, currentInvoiceAmount: netAmount, availableCredit: Math.max(0, limit - outstanding - netAmount) });
  }, [header.customer, netAmount]);

  // ---- Customer search ------------------------------------------------------
  const handleCustInput = useCallback((val: string) => {
    setCustSearch(val);
    if (custDebounce.current) clearTimeout(custDebounce.current);
    if (!val.trim()) { setCustOptions([]); setCustDropOpen(false); return; }
    custDebounce.current = setTimeout(async () => {
      setCustLoading(true);
      try {
        const res = await apiFetchV1<any>('/crm/customers?search=' + encodeURIComponent(val) + '&limit=8');
        const list: Customer[] = Array.isArray(res) ? res : (res?.items ?? []);
        setCustOptions(list); setCustDropOpen(list.length > 0);
      } catch { setCustOptions([]); } finally { setCustLoading(false); }
    }, 280);
  }, []);

  const selectCustomer = (c: Customer) => {
    setHeader(h => ({ ...h, customer: c }));
    setCustSearch((c.code ?? c.id) + ' - ' + c.name);
    setCustDropOpen(false);
  };

  // ---- Scan -----------------------------------------------------------------
  const handleScanSubmit = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return; setScanning(true);
    try {
      const res = await apiFetchV1<any>('/item-barcodes?barcode=' + encodeURIComponent(barcode.trim()) + '&limit=1');
      const product: Product | null = Array.isArray(res) ? (res[0] ?? null) : (res?.items?.[0] ?? null);
      if (!product) { onNotification?.('Item Not Found', 'No item for: ' + barcode, 'error'); return; }
      addItem(product); setScanInput('');
    } catch { onNotification?.('Scan Error', 'Failed to resolve barcode.', 'error'); }
    finally { setScanning(false); scanRef.current?.focus(); }
  }, [onNotification]);

  const addItem = (product: Product, qty = 1) => {
    const rate = product.price ?? 0;
    const gstRate = product.gstPercentage ?? 0;
    const amount = rate * qty;
    const taxAmt = (amount * gstRate) / 100;
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === product.id);
      if (idx >= 0) {
        return prev.map((it, i) => {
          if (i !== idx) return it;
          const nq = it.qty + qty; const na = it.rate * nq;
          const nd = (it.discPercent / 100) * na;
          return { ...it, qty: nq, amount: na, discAmt: nd, taxAmt: ((na - nd) * (it.gstRate ?? 0)) / 100 };
        });
      }
      return [...prev, {
        id: 'cl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        sNo: prev.length + 1, itemCode: product.code, itemDescription: product.name,
        rate, qty, unit: product.unit ?? product.uom ?? 'Nos',
        discPercent: 0, discAmt: 0, amount, productId: product.id,
        hsnCode: product.hsnCode, gstRate, taxAmt, stock: product.stock,
        mrp: product.mrp, purchaseRate: product.costPrice, lastSaleRate: product.price,
      }];
    });
  };

  const updateQty = (idx: number, qty: number) =>
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const a = it.rate * qty; const d = (it.discPercent / 100) * a;
      return { ...it, qty, amount: a, discAmt: d, taxAmt: ((a - d) * (it.gstRate ?? 0)) / 100 };
    }));

  const updateDisc = (idx: number, pct: number) =>
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const d = (pct / 100) * it.amount;
      return { ...it, discPercent: pct, discAmt: d, taxAmt: ((it.amount - d) * (it.gstRate ?? 0)) / 100 };
    }));

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sNo: i + 1 })));
    setSelectedRow(r => r >= idx ? Math.max(-1, r - 1) : r);
  };

  // ---- Keyboard shortcuts ---------------------------------------------------
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F4') { e.preventDefault(); handleSaveDraft(); }
      if (e.key === 'F6') { e.preventDefault(); void handleSubmit(); }
      if (e.key === 'F7') { e.preventDefault(); setMode('CREDIT'); }
      if (e.key === 'F8') { e.preventDefault(); setMode('HOLD'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ---- Actions --------------------------------------------------------------
  const [submittedInvoiceId, setSubmittedInvoiceId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!header.customer) { onNotification?.('Customer Required', 'Select a customer before submitting.', 'error'); return; }
    if (items.length === 0) { onNotification?.('Empty Invoice', 'Add at least one item.', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        paymentMode: 'CREDIT',
        customerId: header.customer.id,
        customerName: header.customer.name,
        customerGstin: header.customer.gstNumber ?? header.customer.gstin ?? null,
        date: new Date().toISOString().slice(0, 10),
        grandTotal: netAmount,
        taxTotal: totalTax,
        discountAmount: itemDiscountTotal,
        netAmount: netAmount,
        taxableValue: subtotal,
        remarks: remarks || null,
        poReference: refNo || null,
        salespersonName: header.salesman !== '-- Select --' ? header.salesman : null,
        status: 'Submitted',
        items: items.map(it => ({
          productId: it.productId ?? null,
          code: it.itemCode,
          name: it.itemDescription,
          price: it.rate,
          quantity: it.qty,
          discPct: it.discPercent,
          taxAmount: it.taxAmt ?? 0,
          totalAmount: Math.max(0, it.amount - it.discAmt + (it.taxAmt ?? 0)),
          hsnCode: it.hsnCode ?? null,
          gstRate: it.gstRate ?? 0,
          lineNo: it.sNo,
          mrp: it.mrp ?? null,
        })),
      };
      const res = await apiFetchV1<any>('/sales/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSubmittedInvoiceId(res?.id ?? null);
      setDocStatus('SUBMITTED');
      onNotification?.('Invoice Submitted', `Credit invoice ${res?.invoice_no ?? ''} posted to stock, ledger & accounting.`, 'success');
    } catch (e: any) {
      onNotification?.('Submit Failed', e?.message ?? 'Error', 'error');
    } finally { setSubmitting(false); }
  };

  const handleSaveDraft = () => {
    setDocStatus('DRAFT');
    onNotification?.('Draft Saved', 'Invoice saved as draft. No financial impact.', 'info');
  };

  const handleClearAll = () => {
    setItems([]); setSelectedRow(-1);
    setHeader(h => ({ ...h, customer: null }));
    setCustSearch(''); setRemarks(''); setRefNo(''); setTransport('');
    setDocStatus('DRAFT');
  };

  // ---- Mode button ----------------------------------------------------------
  const modeCls = (m: BillingMode) =>
    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ' +
    (mode === m
      ? 'bg-[#00288e] text-white border-[#00288e] shadow'
      : 'bg-white dark:bg-[#1e232a] text-[#475569] dark:text-[#94a3b8] border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f1f5f9]');


  // ---- Render ---------------------------------------------------------------
  return (
    <div className={'flex flex-col h-full bg-[#f1f5f9] dark:bg-[#0f172a] text-[#0f172a] dark:text-[#f8fafc] font-sans overflow-hidden' + (fullscreen ? ' fixed inset-0 z-50' : '')}>

      {/* MODE BAR */}
      <div className='bg-white dark:bg-[#1e232a] border-b border-[#e2e8f0] dark:border-[#334155] px-4 py-2 flex items-center gap-2 shrink-0 shadow-sm flex-wrap'>
        <button type='button' onClick={onBack} className='p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] transition shrink-0'><ArrowLeft size={16} /></button>
        <div className='flex items-center gap-2 border-r border-[#e2e8f0] dark:border-[#334155] pr-3 mr-1 shrink-0'>
          <h1 className='text-sm font-bold'>Credit Billing</h1>
          <span className='text-[10px] px-2 py-0.5 rounded-full bg-[#dbeafe] text-[#1d4ed8] dark:bg-[#1e40af]/40 dark:text-[#93c5fd] font-bold'>Credit Sale</span>
        </div>
        <button type='button' className={modeCls('CASH')} onClick={() => setMode('CASH')}><Banknote size={12} /> Cash <kbd className='text-[9px] px-1 rounded font-mono bg-[#e2e8f0] dark:bg-[#334155]'>F6</kbd></button>
        <button type='button' className={modeCls('CREDIT')} onClick={() => setMode('CREDIT')}><CreditCard size={12} /> Credit <kbd className='text-[9px] px-1 rounded font-mono bg-[#e2e8f0] dark:bg-[#334155]'>F7</kbd></button>
        <button type='button' className={modeCls('EXCHANGE')} onClick={() => setMode('EXCHANGE')}><RotateCcw size={12} /> Exchange</button>
        <button type='button' className={modeCls('QUOTATION')} onClick={() => setMode('QUOTATION')}><FileText size={12} /> Quotation</button>
        <button type='button' className={modeCls('HOLD')} onClick={() => setMode('HOLD')}><X size={12} /> Hold <kbd className='text-[9px] px-1 rounded font-mono bg-[#e2e8f0] dark:bg-[#334155]'>F8</kbd></button>
        <div className='flex-1' />
        <button type='button' className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#475569] border border-[#c4c5d5] rounded-lg hover:bg-[#f1f5f9] transition bg-white shrink-0'><Plus size={12} /> New <kbd className='text-[9px] font-mono opacity-60'>F2</kbd></button>
        <button type='button' className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#475569] border border-[#c4c5d5] rounded-lg hover:bg-[#f1f5f9] transition bg-white shrink-0'><FileText size={12} /> Open <kbd className='text-[9px] font-mono opacity-60'>F3</kbd></button>
        <button type='button' onClick={() => setFullscreen(f => !f)} className='p-1.5 text-[#64748b] hover:bg-[#f1f5f9] border border-[#c4c5d5] rounded-lg transition shrink-0'>{fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
      </div>

      {/* BODY */}
      <div className='flex flex-1 overflow-hidden'>

        {/* LEFT */}
        <div className='flex flex-col flex-1 overflow-hidden min-w-0'>

          {/* Header fields */}
          <div className='bg-white dark:bg-[#1e232a] border-b border-[#e2e8f0] px-4 py-2.5 flex flex-wrap gap-3 items-end shrink-0'>
            {/* Customer */}
            <div className='relative min-w-[220px] flex-1 max-w-xs'>
              <span className='block text-[10px] font-bold text-[#ef4444] uppercase mb-0.5'>Customer *</span>
              <div className='flex gap-1'>
                <div className='relative flex-1'>
                  <User size={12} className='absolute left-2 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none' />
                  <input type='text' value={custSearch} onChange={e => handleCustInput(e.target.value)} onFocus={() => custOptions.length > 0 && setCustDropOpen(true)} onBlur={() => setTimeout(() => setCustDropOpen(false), 200)} placeholder='Search customer...' className='w-full pl-7 pr-2 py-1.5 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none focus:border-[#00288e] font-semibold' />
                  {custDropOpen && (
                    <div className='absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e232a] border border-[#e2e8f0] dark:border-[#334155] rounded-xl shadow-2xl overflow-hidden'>
                      {custLoading ? <div className='px-3 py-2 text-[11px] text-[#64748b]'>Searching...</div> : custOptions.map(c => (
                        <button key={c.id} type='button' onMouseDown={() => selectCustomer(c)} className='w-full text-left px-3 py-2 text-xs hover:bg-[#f1f5f9] dark:hover:bg-[#334155] flex flex-col border-b border-[#f1f5f9] dark:border-[#334155] last:border-0'>
                          <span className='font-bold text-[#0f172a] dark:text-[#f8fafc]'>{(c.code ?? c.id) + ' - ' + c.name}</span>
                          <span className='text-[#64748b] text-[10px]'>{c.mobile}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type='button' className='px-2 py-1.5 bg-[#00288e] text-white rounded-lg hover:bg-[#1e40af] transition shrink-0'><Plus size={12} /></button>
              </div>
              {header.customer && <div className='text-[10px] text-[#64748b] mt-0.5'>Credit Limit: {fmtINR(header.customer.creditLimit ?? 0)} &middot; Available: {fmtINR(creditInfo.availableCredit)}</div>}
            </div>

            {/* Price Level */}
            <div className='min-w-[110px]'>
              <span className='block text-[10px] font-bold text-[#64748b] uppercase mb-0.5'>Price Level</span>
              <select value={header.priceLevel} onChange={e => setHeader(h => ({ ...h, priceLevel: e.target.value }))} className='w-full py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none'>
                <option>Retail</option><option>Wholesale</option><option>Corporate</option>
              </select>
            </div>

            {/* Warehouse */}
            <div className='min-w-[120px]'>
              <span className='block text-[10px] font-bold text-[#64748b] uppercase mb-0.5'>Warehouse</span>
              <select value={header.warehouse} onChange={e => setHeader(h => ({ ...h, warehouse: e.target.value }))} className='w-full py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none'>
                <option>Main Store</option><option>Warehouse 2</option>
              </select>
            </div>

            {/* Salesman */}
            <div className='min-w-[130px]'>
              <span className='block text-[10px] font-bold text-[#64748b] uppercase mb-0.5'>Salesman</span>
              <select value={header.salesman} onChange={e => setHeader(h => ({ ...h, salesman: e.target.value }))} className='w-full py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none'>
                <option value='-- Select --'>-- Select --</option>
                <option>{currentUser?.name ?? 'Jawahar'}</option>
              </select>
            </div>

            {/* Invoice Date */}
            <div className='min-w-[115px]'>
              <span className='block text-[10px] font-bold text-[#64748b] uppercase mb-0.5'>Invoice Date</span>
              <div className='flex items-center gap-1.5 py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a]'><Clock size={10} className='text-[#64748b] shrink-0' /><span className='font-mono'>{header.invoiceDate}</span></div>
            </div>

            {/* Due Date */}
            <div className='min-w-[148px]'>
              <span className='block text-[10px] font-bold text-[#64748b] uppercase mb-0.5'>Due Date</span>
              <div className='flex items-center gap-1.5 py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a]'><Clock size={10} className='text-[#64748b] shrink-0' /><span className='font-mono'>{header.dueDate}</span><span className='text-[#64748b] ml-1 text-[10px]'>(30 Days)</span></div>
            </div>
          </div>

          {/* Scan bar */}
          <div className='bg-[#f8fafc] dark:bg-[#131b2e] border-b border-[#e2e8f0] dark:border-[#334155] px-4 py-2 flex items-center gap-2 shrink-0 flex-wrap'>
            <div className='relative min-w-[260px] flex-1 max-w-sm'>
              <Scan size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none' />
              <input ref={scanRef} id='creditBillingScan' type='text' value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && void handleScanSubmit(scanInput)} placeholder='Scan Barcode or Search Item (F2)...' className='w-full pl-9 pr-8 py-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#0f172a] outline-none focus:border-[#00288e] focus:ring-2 focus:ring-[#00288e]/20' />
              <button type='button' onClick={() => void handleScanSubmit(scanInput)} className='absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#00288e] hover:bg-[#dde1ff] transition'>{scanning ? <RefreshCcw size={13} className='animate-spin' /> : <Search size={13} />}</button>
            </div>
            <button type='button' className='flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 bg-[#00288e] text-white hover:bg-[#1e40af] shadow-sm'><Plus size={12} /> + Add Item</button>
            <button type='button' className='flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 bg-white dark:bg-[#1e232a] text-[#475569] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f1f5f9]'><Package size={12} /> Item Master</button>
            <button type='button' className='flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 bg-white dark:bg-[#1e232a] text-[#475569] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f1f5f9]'><RefreshCcw size={12} /> Recent Items</button>
            <button type='button' className='flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 bg-white dark:bg-[#1e232a] text-[#475569] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f1f5f9]'><Star size={12} /> Favorites</button>
            <button type='button' className='flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 bg-white dark:bg-[#1e232a] text-[#475569] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f1f5f9]'><MoreHorizontal size={12} /> More</button>
          </div>

          {/* Items Grid */}
          <div className='flex-1 overflow-auto'>
            <table className='w-full text-xs border-collapse'>
              <thead className='sticky top-0 bg-[#f1f5f9] dark:bg-[#131b2e] z-10'>
                <tr className='border-b border-[#e2e8f0] dark:border-[#334155]'>
                  {['#','Item Code','Item Description','Rate','Qty','Unit','Disc %','Disc Amt','Amount',''].map((h, i) => (
                    <th key={i} className={'px-2 py-2 font-bold text-[#475569] dark:text-[#94a3b8] whitespace-nowrap ' + (i >= 3 && i <= 8 ? 'text-right' : i === 5 ? 'text-center' : 'text-left') + (i === 9 ? ' w-8' : '')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(GRID_ROWS, items.length + 3) }).map((_, idx) => {
                  const item = items[idx]; const isFilled = !!item; const isSel = idx === selectedRow;
                  return (
                    <tr key={idx} onClick={() => isFilled && setSelectedRow(idx)}
                      className={'border-b border-[#e2e8f0]/60 dark:border-[#334155]/60 cursor-pointer transition-colors ' + (isSel ? 'bg-[#dde1ff] dark:bg-[#1e40af]/20' : isFilled ? 'hover:bg-[#f8fafc] dark:hover:bg-[#1e232a]/60' : 'bg-white dark:bg-transparent')}>
                      <td className='px-2 py-1.5 text-[#94a3b8] w-8'>{isFilled ? item.sNo : ''}</td>
                      <td className='px-2 py-1.5 font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] whitespace-nowrap'>{item?.itemCode ?? ''}</td>
                      <td className='px-2 py-1.5 max-w-[180px]'><span className='truncate block'>{item?.itemDescription ?? ''}</span></td>
                      <td className='px-2 py-1.5 text-right font-mono'>{isFilled ? item.rate.toFixed(2) : ''}</td>
                      <td className='px-2 py-1.5 text-right'>{isFilled ? <input type='number' min='1' value={item.qty} onChange={e => updateQty(idx, Math.max(1, Number(e.target.value)))} onClick={e => e.stopPropagation()} className='w-14 text-right border border-[#c4c5d5] dark:border-[#444653] rounded px-1 py-0.5 bg-white dark:bg-[#0f172a] font-bold outline-none focus:border-[#00288e]' /> : ''}</td>
                      <td className='px-2 py-1.5 text-center text-[#64748b]'>{item?.unit ?? ''}</td>
                      <td className='px-2 py-1.5 text-right'>{isFilled ? <input type='number' min='0' max='100' step='0.01' value={item.discPercent} onChange={e => updateDisc(idx, Number(e.target.value))} onClick={e => e.stopPropagation()} className='w-14 text-right border border-[#c4c5d5] dark:border-[#444653] rounded px-1 py-0.5 bg-white dark:bg-[#0f172a] outline-none focus:border-[#00288e]' /> : ''}</td>
                      <td className='px-2 py-1.5 text-right font-mono text-[#dc2626]'>{isFilled ? item.discAmt.toFixed(2) : ''}</td>
                      <td className='px-2 py-1.5 text-right font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]'>{isFilled ? item.amount.toFixed(2) : ''}</td>
                      <td className='px-2 py-1.5 text-center'>{isFilled && <button type='button' onClick={e => { e.stopPropagation(); removeItem(idx); }} className='p-0.5 text-[#94a3b8] hover:text-[#dc2626] transition'><Trash2 size={12} /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Selected Item Detail */}
          {selectedItem && (
            <div className='bg-[#f8fafc] dark:bg-[#131b2e] border-t border-[#e2e8f0] dark:border-[#334155] px-4 py-2.5 shrink-0'>
              <div className='text-[10px] font-bold uppercase text-[#64748b] mb-1.5'>Item Details (Selected)</div>
              <div className='flex items-center gap-4 flex-wrap'>
                <div className='w-10 h-10 rounded-xl bg-[#e2e8f0] dark:bg-[#334155] flex items-center justify-center shrink-0'><Package size={18} className='text-[#475569]' /></div>
                <div className='mr-2'><div className='font-bold text-xs'>{selectedItem.itemCode}</div><div className='text-[11px] text-[#64748b]'>{selectedItem.itemDescription}</div></div>
                {([
                  ['Stock', selectedItem.stock !== undefined ? selectedItem.stock + ' ' + selectedItem.unit : '-'],
                  ['MRP', selectedItem.mrp !== undefined ? fmtINR(selectedItem.mrp) : '-'],
                  ['Purchase Rate', selectedItem.purchaseRate !== undefined ? fmtINR(selectedItem.purchaseRate) : '-'],
                  ['Last Sale Rate', selectedItem.lastSaleRate !== undefined ? fmtINR(selectedItem.lastSaleRate) : '-'],
                  ['HSN/SAC', selectedItem.hsnCode ?? '-'],
                  ['Tax', selectedItem.gstRate !== undefined ? 'GST ' + selectedItem.gstRate + '%' : '-'],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} className='text-center min-w-[80px]'>
                    <div className='text-[9px] font-bold uppercase text-[#64748b]'>{label}</div>
                    <div className='text-xs font-bold mt-0.5'>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remarks / Ref / Transport */}
          <div className='bg-white dark:bg-[#1e232a] border-t border-[#e2e8f0] dark:border-[#334155] px-4 py-2.5 shrink-0 grid grid-cols-3 gap-3'>
            <div><label className='block text-[10px] font-bold text-[#64748b] uppercase mb-1'>Remarks</label><input type='text' value={remarks} onChange={e => setRemarks(e.target.value)} placeholder='Add remarks...' className='w-full px-2 py-1.5 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none focus:border-[#00288e]' /></div>
            <div><label className='block text-[10px] font-bold text-[#64748b] uppercase mb-1'>Reference No.</label><input type='text' value={refNo} onChange={e => setRefNo(e.target.value)} placeholder='PO / Ref No.' className='w-full px-2 py-1.5 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none focus:border-[#00288e]' /></div>
            <div><label className='block text-[10px] font-bold text-[#64748b] uppercase mb-1'>Transport</label><select value={transport} onChange={e => setTransport(e.target.value)} className='w-full px-2 py-1.5 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none'><option value=''>-- Select --</option><option>Self Transport</option><option>Courier</option><option>Road Freight</option></select></div>
          </div>

          {/* Action Buttons */}
          <div className='bg-white dark:bg-[#1e232a] border-t border-[#e2e8f0] dark:border-[#334155] px-4 py-2.5 shrink-0 flex items-center gap-2 flex-wrap'>
            <button id='creditBillingClearAll' type='button' onClick={handleClearAll} className='flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#dc2626] border border-[#fca5a5] rounded-xl hover:bg-[#fef2f2] transition'><Trash2 size={13} /> Clear All</button>
            <button id='creditBillingSaveDraft' type='button' onClick={handleSaveDraft} className='flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#475569] border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'><Save size={13} /> Save as Draft <kbd className='text-[9px] font-mono opacity-60'>F4</kbd></button>
            <button id='creditBillingPreview' type='button' className='flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#475569] border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'><Eye size={13} /> Preview <kbd className='text-[9px] font-mono opacity-60'>F5</kbd></button>
            <button id='creditBillingPrint' type='button' className='flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#475569] border border-[#c4c5d5] dark:border-[#444653] rounded-xl hover:bg-[#f1f5f9] transition bg-white dark:bg-[#1e232a]'><Printer size={13} /> Print <kbd className='text-[9px] font-mono opacity-60'>F9</kbd> <ChevronDown size={11} /></button>
            <div className='flex-1' />
            <button id='creditBillingSubmit' type='button' disabled={submitting} onClick={() => void handleSubmit()} className='flex items-center gap-2 px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white text-xs font-bold rounded-2xl shadow-lg transition'>{submitting ? <RefreshCcw size={14} className='animate-spin' /> : <CheckCircle2 size={14} />} Submit Invoice <kbd className='text-[9px] font-mono opacity-70'>F6</kbd><ChevronDown size={12} /></button>
          </div>

          {/* Draft / Submitted Banner */}
          <div className='bg-white dark:bg-[#1e232a] border-t border-[#e2e8f0] dark:border-[#334155] px-4 py-2 shrink-0 grid grid-cols-2 gap-3'>
            <div className={'flex items-start gap-2.5 p-3 rounded-xl border ' + (docStatus === 'DRAFT' ? 'bg-[#fffbeb] border-[#fbbf24]/50' : 'bg-[#f8fafc] dark:bg-[#131b2e] border-[#e2e8f0] dark:border-[#334155] opacity-50')}>
              <FileText size={18} className='text-[#d97706] shrink-0 mt-0.5' />
              <div>
                <div className='flex items-center gap-1.5 mb-1'><span className='text-xs font-bold'>Draft Mode</span><span className='text-[9px] px-1.5 py-0.5 bg-[#fbbf24] text-white rounded font-bold'>DRAFT</span></div>
                <p className='text-[10px] text-[#64748b] mb-1'>Save as Draft. No stock, no ledger and no accounting impact.</p>
                {['Can be edited anytime','Visible only to creator','No financial posting','No stock movement'].map(t => <div key={t} className='flex items-center gap-1 text-[10px] text-[#d97706]'><CheckCircle2 size={9} /> {t}</div>)}
              </div>
            </div>
            <div className={'flex items-start gap-2.5 p-3 rounded-xl border ' + (docStatus === 'SUBMITTED' ? 'bg-[#f0fdf4] border-[#16a34a]/50' : 'bg-[#f8fafc] dark:bg-[#131b2e] border-[#e2e8f0] dark:border-[#334155] opacity-50')}>
              <Send size={18} className='text-[#16a34a] shrink-0 mt-0.5' />
              <div>
                <div className='flex items-center gap-1.5 mb-1'><span className='text-xs font-bold'>Submitted (Posted)</span><span className='text-[9px] px-1.5 py-0.5 bg-[#16a34a] text-white rounded font-bold'>SUBMITTED</span></div>
                <p className='text-[10px] text-[#64748b] mb-1'>Submit to post to stock, ledger and accounting.</p>
                {['Stock updated','Customer account updated','GST entries created','Cancel/amend to edit'].map(t => <div key={t} className='flex items-center gap-1 text-[10px] text-[#16a34a]'><CheckCircle2 size={9} /> {t}</div>)}
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className='bg-[#0f172a] text-[#94a3b8] px-4 py-1.5 shrink-0 flex items-center gap-4 text-[10px] font-mono flex-wrap'>
            <div className='flex items-center gap-1.5'><span className='w-2 h-2 rounded-full bg-[#16a34a] animate-pulse' /> Ready</div>
            <span className='text-[#334155]'>|</span><span>Terminal: {currentUser?.terminalId ?? 'POS-01'}</span>
            <span className='text-[#334155]'>|</span><span>User: {currentUser?.name ?? 'Jawahar'}</span>
            <span className='text-[#334155]'>|</span><span>Session: {new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <div className='flex-1' />
            {(['F2 Search','F4 Draft','F5 Preview','F6 Submit','F7 Credit','F8 Hold','F9 Print','Esc Cancel']).map(s => { const [k, ...rest] = s.split(' '); return <span key={k}><span className='text-[#60a5fa]'>{k}</span> {rest.join(' ')}</span>; })}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className='w-72 xl:w-80 shrink-0 bg-white dark:bg-[#1e232a] border-l border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-hidden'>
          {/* Tabs */}
          <div className='flex border-b border-[#e2e8f0] dark:border-[#334155] shrink-0'>
            {(['CUSTOMER','CREDIT','DELIVERY','OTHER'] as SidebarTab[]).map(tab => (
              <button key={tab} type='button' onClick={() => setSidebarTab(tab)} className={'flex-1 py-2 text-[9.5px] font-bold border-b-2 transition-colors ' + (sidebarTab === tab ? 'border-[#00288e] text-[#00288e] dark:text-[#a8b8ff]' : 'border-transparent text-[#64748b] hover:text-[#0f172a]')}>
                {tab === 'CUSTOMER' ? 'Customer' : tab === 'CREDIT' ? 'Credit Info' : tab === 'DELIVERY' ? 'Delivery' : 'Other'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className='flex-1 overflow-y-auto p-3 space-y-3'>
            {sidebarTab === 'CUSTOMER' && (
              header.customer ? (
                <div className='bg-[#f8fafc] dark:bg-[#0f172a] rounded-xl p-3 border border-[#e2e8f0] dark:border-[#334155]'>
                  <div className='flex items-start justify-between mb-2'>
                    <div className='flex items-center gap-2'>
                      <div className='w-9 h-9 rounded-full bg-[#dde1ff] dark:bg-[#1e40af]/40 flex items-center justify-center text-[#00288e] font-bold text-sm'>{header.customer.name.charAt(0).toUpperCase()}</div>
                      <div><div className='font-bold text-xs'>{header.customer.code ?? header.customer.id}</div><div className='text-[11px] font-semibold text-[#475569]'>{header.customer.name}</div></div>
                    </div>
                    <button type='button' className='text-[10px] text-[#00288e] font-bold px-2 py-1 rounded-lg border border-[#c4c5d5] hover:bg-[#dde1ff] transition'>Edit</button>
                  </div>
                  {header.customer.mobile && <div className='flex items-center gap-1.5 text-[11px] text-[#475569] mb-1'><Phone size={10} /> {header.customer.mobile}</div>}
                  {header.customer.billingAddressLine1 && <div className='flex items-center gap-1.5 text-[11px] text-[#475569] mb-1'><MapPin size={10} /> {[header.customer.billingAddressLine1, header.customer.billingCity].filter(Boolean).join(', ')}</div>}
                  {(header.customer.gstNumber ?? header.customer.gstin) && <div className='flex items-center gap-1.5 text-[11px] text-[#475569] mb-1'><ShieldCheck size={10} /> {header.customer.gstNumber ?? header.customer.gstin}</div>}
                  {header.customer.customerType && <div className='flex items-center gap-1.5 text-[11px] text-[#00288e]'><Building2 size={10} /> {header.customer.customerType}</div>}
                </div>
              ) : (
                <div className='bg-[#f8fafc] dark:bg-[#0f172a] rounded-xl p-5 border border-dashed border-[#c4c5d5] dark:border-[#334155] text-center text-[11px] text-[#64748b]'><User size={28} className='mx-auto mb-2 text-[#c4c5d5]' />No customer selected.</div>
              )
            )}

            {sidebarTab === 'CREDIT' && (
              <div>
                <div className='flex items-center justify-between mb-2'><span className='text-[10px] font-bold uppercase text-[#475569]'>Credit Information</span><button type='button' className='text-[10px] text-[#00288e] font-bold hover:underline'>View Statement</button></div>
                <div className='bg-[#f8fafc] dark:bg-[#0f172a] rounded-xl border border-[#e2e8f0] dark:border-[#334155] p-3 space-y-2'>
                  {([
                    ['Credit Limit', fmtINR(creditInfo.creditLimit), false],
                    ['Total Outstanding', fmtINR(creditInfo.totalOutstanding), true],
                    ['Current Invoice', fmtINR(creditInfo.currentInvoiceAmount), true],
                  ] as [string, string, boolean][]).map(([label, val, red]) => (
                    <div key={label} className='flex justify-between items-center border-b border-[#f1f5f9] dark:border-[#334155] pb-1.5 last:border-0 last:pb-0'>
                      <span className='text-xs text-[#64748b]'>{label}</span>
                      <span className={'text-xs font-bold font-mono ' + (red ? 'text-[#dc2626]' : 'text-[#0f172a] dark:text-[#f8fafc]')}>{val}</span>
                    </div>
                  ))}
                  <div className='flex justify-between items-center pt-1 border-t border-[#e2e8f0] dark:border-[#334155]'>
                    <span className='text-xs font-bold'>Available Credit</span>
                    <span className='text-sm font-extrabold font-mono text-[#16a34a]'>{fmtINR(creditInfo.availableCredit)}</span>
                  </div>
                </div>
                {creditInfo.creditLimit > 0 && creditInfo.availableCredit < creditInfo.currentInvoiceAmount && (
                  <div className='flex items-start gap-2 p-2.5 bg-[#fef2f2] border border-[#fca5a5] rounded-xl mt-3'><AlertTriangle size={14} className='text-[#dc2626] shrink-0 mt-0.5' /><span className='text-[10px] text-[#dc2626] font-semibold leading-snug'>Credit limit may be exceeded. Manager approval may be required.</span></div>
                )}
              </div>
            )}

            {(sidebarTab === 'DELIVERY' || sidebarTab === 'OTHER') && (
              <div className='text-center py-10 text-[11px] text-[#64748b]'><ChevronRight size={28} className='mx-auto mb-2 text-[#c4c5d5]' />{sidebarTab === 'DELIVERY' ? 'Delivery details will appear here.' : 'Additional details will appear here.'}</div>
            )}

            {/* Invoice Summary - always shown */}
            <div className='border-t border-[#e2e8f0] dark:border-[#334155] pt-3 mt-1'>
              <div className='text-[10px] font-bold uppercase text-[#475569] mb-2'>Invoice Summary</div>
              <div className='space-y-1.5'>
                {([
                  ['Items / Total Qty', totalItemCount + ' / ' + totalQty, false],
                  ['Total Amount', fmtINR(totalAmount), false],
                  ['Item Discount (-)', fmtINR(itemDiscountTotal), true],
                  ['Bill Discount (-)', fmtINR(billDiscount), true],
                  ['Freight Charges (+)', fmtINR(freightCharges), false],
                  ['Other Charges (+)', fmtINR(otherCharges), false],
                ] as [string, string, boolean][]).map(([label, val, red]) => (
                  <div key={label} className='flex justify-between items-center text-xs'>
                    <span className='text-[#64748b]'>{label}</span>
                    <span className={'font-mono font-semibold ' + (red ? 'text-[#dc2626]' : 'text-[#0f172a] dark:text-[#f8fafc]')}>{val}</span>
                  </div>
                ))}
                <div className='flex justify-between items-center text-xs border-t border-[#e2e8f0] dark:border-[#334155] pt-1.5'><span className='text-[#64748b]'>Subtotal</span><span className='font-mono font-bold'>{fmtINR(subtotal)}</span></div>
                <div className='flex justify-between items-center text-xs'><span className='text-[#64748b]'>Total Tax (GST)</span><span className='font-mono font-semibold'>{fmtINR(totalTax)}</span></div>
                <div className='flex justify-between items-center bg-[#dde1ff] dark:bg-[#1e40af]/20 p-3 rounded-xl mt-2'>
                  <div className='text-[9px] font-bold text-[#00288e] dark:text-[#a8b8ff] uppercase'>Net Amount (Credit)</div>
                  <span className='text-base font-extrabold font-mono text-[#00288e] dark:text-[#a8b8ff]'>{fmtINR(netAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmritiCreditBillingTerminal;
