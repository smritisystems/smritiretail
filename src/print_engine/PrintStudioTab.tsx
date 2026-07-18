/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { SmritiScrollArea } from "../components/SmritiScrollArea.tsx";
import { Printer, Settings, LayoutTemplate, FileText, Search, Play, Download, ScanBarcode, Clock, Tag } from "lucide-react";
import { usePrintEngine } from "./print_store.tsx";
import { useLayoutEngine } from "../layout_engine/layout_store.tsx";
import { StandardInvoiceA4 } from "./templates/StandardInvoiceA4.tsx";
import { ThermalReceipt80mm } from "./templates/ThermalReceipt80mm.tsx";
import { GoodsReceiptNoteA4 } from "./templates/GoodsReceiptNoteA4.tsx";
import { BarcodeLabel } from "./templates/BarcodeLabel.tsx";

const MOCK_DATA = {
  invoiceNo: "INV-2023-0891",
  date: "2023-10-25",
  companyName: "SMRITI Enterprise Co.",
  customerName: "Acme Corp Ltd.",
  items: [
    { name: "Wireless Keyboard", qty: 2, rate: 45.00 },
    { name: "Optical Mouse", qty: 5, rate: 15.50 },
    { name: "USB-C Hub", qty: 1, rate: 25.00 }
  ],
  subtotal: 192.50,
  tax: 17.32,
  total: 209.82,
  cashier: "John D.",
  paymentMethod: "CARD",
  paid: 209.82
};

const BARCODE_DEMO_DATA = {
  invoiceNo: "LABEL-DEMO-001",
  date: "2026-07-18",
  companyName: "SMRITI Demo Co.",
  customerName: "Demo Retail",
  items: [
    { name: "Demo Barcode Item", qty: 1, rate: 125.00, barcode: "8901234567890" }
  ],
  subtotal: 125.00,
  tax: 0.00,
  total: 125.00,
  cashier: "Demo User",
  paymentMethod: "CASH",
  paid: 125.00
};

export const PrintStudioTab: React.FC = () => {
  const { print, registerTemplate, templates } = usePrintEngine();
  const { addToRecentlyUsed } = useLayoutEngine();
  const [activeTemplate, setActiveTemplate] = useState<string>("standard-a4");

  useEffect(() => {
    // Register default templates if not already present
    registerTemplate({
      id: "standard-a4",
      name: "Standard Tax Invoice",
      format: "A4",
      component: StandardInvoiceA4
    });
    registerTemplate({
      id: "grn-a4",
      name: "Goods Receipt Note (GRN)",
      format: "A4",
      component: GoodsReceiptNoteA4
    });
    registerTemplate({
      id: "thermal-80",
      name: "Retail Receipt 80mm",
      format: "Thermal80mm",
      component: ThermalReceipt80mm
    });
    registerTemplate({
      id: "label-50x25",
      name: "Product Barcode Label (50x25mm)",
      format: "Label",
      component: BarcodeLabel
    });
  }, [registerTemplate]);

  const handlePrint = () => {
    print({
      templateId: activeTemplate,
      data: selectedTemplate?.id === "label-50x25" ? BARCODE_DEMO_DATA : MOCK_DATA
    });
  };

  const selectedTemplate = templates.find(t => t.id === activeTemplate);
  const PreviewComponent = selectedTemplate?.component || (() => <div>No template selected</div>);
  const previewData = selectedTemplate?.id === "label-50x25" ? BARCODE_DEMO_DATA : MOCK_DATA;

  return (
    <div className="flex h-full bg-theme-base font-sans overflow-hidden text-theme-body">
      {/* Sidebar */}
      <div className="w-72 border-r border-theme-divider bg-theme-surface-1 flex flex-col z-10">
        <div className="p-4 border-b border-theme-divider flex items-center gap-3 bg-theme-surface-2">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
            <Printer size={18} />
          </div>
          <div>
            <h2 className="font-bold font-display text-theme-primary">Print Studio</h2>
            <p className="text-[10px] text-theme-muted uppercase tracking-wider font-mono">Template Engine</p>
          </div>
        </div>

        <div className="p-4 border-b border-theme-divider">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-theme-muted" size={14} />
            <input 
              type="text" 
              placeholder="Search templates..."
              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        
        <SmritiScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono px-2 py-1.5 mt-2">A4 Documents</div>
            {templates.filter(t => t.format === 'A4').map(template => (
              <button
                key={template.id}
                onClick={() => setActiveTemplate(template.id)}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                  activeTemplate === template.id 
                    ? "bg-blue-500/10 text-blue-400 font-semibold" 
                    : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary"
                }`}
              >
                <FileText size={16} />
                <span className="text-sm truncate">{template.name}</span>
              </button>
            ))}

            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono px-2 py-1.5 mt-4">Thermal & POS</div>
            {templates.filter(t => t.format === 'Thermal80mm' || t.format === 'Label').map(template => (
              <button
                key={template.id}
                onClick={() => setActiveTemplate(template.id)}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                  activeTemplate === template.id 
                    ? "bg-blue-500/10 text-blue-400 font-semibold" 
                    : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary"
                }`}
              >
                <LayoutTemplate size={16} />
                <span className="text-sm truncate">{template.name}</span>
              </button>
            ))}
          </div>
        </SmritiScrollArea>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col bg-theme-surface-2 relative">
        {/* Toolbar */}
        <div className="h-14 border-b border-theme-divider bg-theme-surface-1 flex justify-between items-center px-6 shrink-0 z-10 shadow-sm">
          <div className="flex gap-2">
            <span className="px-2.5 py-1 text-xs font-bold font-mono tracking-wider uppercase bg-theme-surface-3 rounded border border-theme-divider text-theme-muted">
              {selectedTemplate?.format} FORMAT
            </span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => addToRecentlyUsed("print-history")}
              className="flex items-center gap-2 px-4 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider text-theme-primary rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Clock size={14} className="text-theme-muted" /> View Spool Logs
            </button>
            <button 
              onClick={() => setActiveTemplate("label-50x25")}
              className="flex items-center gap-2 px-4 py-1.5 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Tag size={14} /> Show Barcode Demo
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Printer size={14} /> Print Document
            </button>
          </div>
        </div>

        {/* Canvas Background */}
        <div className="flex-1 overflow-auto bg-theme-surface-3 relative p-8">
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'radial-gradient(var(--color-theme-divider) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            opacity: 0.5
          }}></div>
          
          <div className="relative flex justify-center pb-20 pt-10">
            {/* The Print Preview Container */}
            <div className="shadow-2xl ring-1 ring-black/5 bg-white transition-all transform origin-top"
                 style={
                   selectedTemplate?.format === 'A4' ? { width: '210mm', minHeight: '297mm' } :
                   selectedTemplate?.format === 'Thermal80mm' ? { width: '80mm', minHeight: '150mm' } :
                   selectedTemplate?.format === 'Label' ? { width: '50mm', height: '25mm' } :
                   { width: '100%', height: '100%' }
                 }>
              {/* Isolated preview wrapper so theme colors don't bleed into print components easily */}
              <div className="text-black bg-white w-full h-full">
                <PreviewComponent data={MOCK_DATA} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
