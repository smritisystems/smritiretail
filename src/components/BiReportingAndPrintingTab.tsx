/**
 * Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
 * Component    : BI Reporting, Barcode & Invoice Printing Engine Framework (Phase A8)
 * Specification: SDS v1.0, SUXG Governance & WNG-002 Pattern Standard
 * Scope        : Sales/Purchase Registers, Stock Ledger, GST Reports, Thermal Receipts & Barcode Label Printing
 */

import React, { useState } from 'react';
import { SEDSTable } from '../design-system/components/SEDSTable';
import { SEDSButton } from '../design-system/components/SEDSButton';
import { SEDSStatusBadge } from '../design-system/components/SEDSStatusBadge';
import { BarChart3, Printer, FileText, QrCode, Sliders, Download, CheckCircle2 } from 'lucide-react';
import { PivotBuilder } from '../analytics/pivot/PivotBuilder.tsx';
import { MyWork } from '../workflow/inbox/MyWork.tsx';

export type ReportCategory = 'sales' | 'purchase' | 'stock' | 'gst' | 'labels' | 'thermal';

export const BiReportingAndPrintingTab: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('sales');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  // Mock Sales Register Report Dataset
  const salesReportData = [
    { id: '1', date: '2026-07-28', invoiceNo: 'INV-2026-0001', customer: 'Walk-In Customer (Cash)', taxable: '₹2,499.00', gst: '₹449.82', net: '₹2,948.82', status: 'Posted' },
    { id: '2', date: '2026-07-28', invoiceNo: 'INV-2026-0002', customer: 'Delhi Corporate Client Ltd', taxable: '₹38,813.56', gst: '₹6,986.44', net: '₹45,800.00', status: 'Posted' }
  ];

  const salesReportColumns = [
    { key: 'date', title: 'Date', header: 'Date', width: '110px' },
    { key: 'invoiceNo', title: 'Invoice Number', header: 'Invoice Number', width: '150px' },
    { key: 'customer', title: 'Customer Account', header: 'Customer Account', width: '220px' },
    { key: 'taxable', title: 'Taxable Amount', header: 'Taxable Amount', width: '130px' },
    { key: 'gst', title: 'GST (18%)', header: 'GST (18%)', width: '110px' },
    { key: 'net', title: 'Net Amount Payable', header: 'Net Amount Payable', width: '150px' }
  ];

  // Mock Barcode Print Jobs Dataset
  const labelPrintJobs = [
    { id: 'lbl-101', sku: 'SKU-DELHI-001', name: 'Cotton Silk Kurta', barcode: '8901234567890', format: '50x25mm Dual Sticky', qty: '100 Labels', status: 'Ready' },
    { id: 'lbl-102', sku: 'SKU-DELHI-002', name: 'Pharma Paracetamol 500mg', barcode: '8909876543210', format: '38x25mm Single Sticky', qty: '500 Labels', status: 'Ready' }
  ];

  const labelPrintColumns = [
    { key: 'sku', title: 'SKU Code', header: 'SKU Code', width: '140px' },
    { key: 'name', title: 'Item Description', header: 'Item Description', width: '220px' },
    { key: 'barcode', title: 'GS1 Barcode Value', header: 'GS1 Barcode Value', width: '160px' },
    { key: 'format', title: 'Label Format', header: 'Label Format', width: '180px' },
    { key: 'qty', title: 'Print Quantity', header: 'Print Quantity', width: '120px' },
    { key: 'status', title: 'Job Status', header: 'Job Status', width: '100px' }
  ];

  const categoryNav = [
    { id: 'sales' as const, label: 'Sales Register', icon: FileText },
    { id: 'purchase' as const, label: 'Purchase Register', icon: FileText },
    { id: 'stock' as const, label: 'Stock Ledger', icon: BarChart3 },
    { id: 'gst' as const, label: 'GSTR-1 & GST Reports', icon: FileText },
    { id: 'labels' as const, label: 'Barcode Label Hub', icon: QrCode },
    { id: 'thermal' as const, label: 'Thermal Invoice Engine', icon: Printer }
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--sds-color-background)] text-[var(--sds-color-text-main)] font-[var(--sds-font-family)] overflow-hidden">
      {/* Top BI & Printing Framework Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-[var(--sds-color-surface)] border-b border-[var(--sds-color-border)] shadow-xs">
        <div className="flex items-center gap-3">
          <Printer className="w-5 h-5 text-[var(--sds-color-primary)]" />
          <h1 className="text-lg font-bold tracking-tight">BI Reporting & Universal Printing Engine</h1>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {categoryNav.map((item) => {
            const Icon = item.icon;
            const active = activeCategory === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveCategory(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-[var(--sds-color-primary)] text-white shadow-xs'
                    : 'bg-[var(--sds-color-background)] border border-[var(--sds-color-border-subtle)] text-[var(--sds-color-text-secondary)] hover:text-[var(--sds-color-text-main)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Body: Report DataGrid or Print Studio Canvas */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* SUPAE v3.1 Universal Pivot Builder */}
        <PivotBuilder />

        {/* SUWINE v2.1 Universal My Work Studio */}
        <MyWork />

        {/* KPI Analytics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--sds-color-surface)] p-4 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <div className="text-xs text-[var(--sds-color-text-secondary)]">Total Monthly Sales</div>
            <div className="text-xl font-bold font-mono mt-1 text-emerald-600">₹48,748.82</div>
          </div>
          <div className="bg-[var(--sds-color-surface)] p-4 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <div className="text-xs text-[var(--sds-color-text-secondary)]">Output GST Collected</div>
            <div className="text-xl font-bold font-mono mt-1 text-blue-600">₹7,436.26</div>
          </div>
          <div className="bg-[var(--sds-color-surface)] p-4 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <div className="text-xs text-[var(--sds-color-text-secondary)]">Pending Label Print Jobs</div>
            <div className="text-xl font-bold font-mono mt-1">600 Labels</div>
          </div>
          <div className="bg-[var(--sds-color-surface)] p-4 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <div className="text-xs text-[var(--sds-color-text-secondary)]">Active Printer Driver</div>
            <div className="text-xl font-bold mt-1 text-[var(--sds-color-primary)]">TSC TTP-244 Pro</div>
          </div>
        </div>

        {/* Data Register Table or Barcode Canvas */}
        <div className="bg-[var(--sds-color-surface)] p-5 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold capitalize">{activeCategory} Engine Workspace</h3>
              <p className="text-xs text-[var(--sds-color-text-secondary)] mt-0.5">
                {activeCategory === 'labels' || activeCategory === 'thermal'
                  ? 'Configure printer drivers, PRN templates, and print physical barcodes/receipts'
                  : 'Enterprise data register with multi-column sorting, date filtering, and PDF/Excel exports'}
              </p>
            </div>
            <div className="flex gap-2">
              <SEDSButton variant="secondary" onClick={() => alert('Exporting report to Excel...')}>
                <Download className="w-4 h-4" /> Export Excel
              </SEDSButton>
              <SEDSButton variant="primary" onClick={() => setIsPrintPreviewOpen(true)}>
                <Printer className="w-4 h-4" /> Print Studio Preview
              </SEDSButton>
            </div>
          </div>

          <SEDSTable
            rowKey={(row: any) => row.id}
            columns={(activeCategory === 'labels' ? labelPrintColumns : salesReportColumns) as any}
            data={(activeCategory === 'labels' ? labelPrintJobs : salesReportData) as any}
          />
        </div>
      </div>

      {/* Interactive Print Preview Modal */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--sds-color-surface)] border border-[var(--sds-color-border)] rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--sds-color-border)] pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> SMRITI Universal Print Engine
              </h3>
              <button onClick={() => setIsPrintPreviewOpen(false)} className="text-xs text-[var(--sds-color-text-secondary)] hover:text-black font-bold">
                ✕ Close
              </button>
            </div>

            {/* Thermal Receipt Preview Box */}
            <div className="p-4 bg-white text-black font-mono text-xs border border-gray-300 rounded shadow-inner space-y-2">
              <div className="text-center font-bold text-sm">SMRITI RETAIL STORE</div>
              <div className="text-center text-[10px]">Connaught Place, New Delhi</div>
              <div className="border-b border-dashed border-gray-400 my-2"></div>
              <div className="flex justify-between">
                <span>INV-2026-0001</span>
                <span>28/07/2026</span>
              </div>
              <div className="border-b border-dashed border-gray-400 my-2"></div>
              <div className="flex justify-between">
                <span>1. Cotton Silk Kurta</span>
                <span>₹2,499.00</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t border-gray-400">
                <span>TOTAL PAYABLE</span>
                <span>₹2,948.82</span>
              </div>
              <div className="text-center text-[10px] pt-2">*** Thank You For Shopping ***</div>
            </div>

            <div className="flex gap-2">
              <SEDSButton variant="secondary" onClick={() => setIsPrintPreviewOpen(false)} className="flex-1">
                Cancel
              </SEDSButton>
              <SEDSButton variant="primary" onClick={() => { alert('Sent to thermal printer!'); setIsPrintPreviewOpen(false); }} className="flex-1">
                Print Physical Receipt
              </SEDSButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
