/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Component    : SCS-DXP-001 Unified Document & Print Studio
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 3.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Compliance Declaration
 * SCS Standard : SCS-DXP-001 (Universal Document Experience Platform v1.0 — FROZEN)
 * Principle    : Single Platform Document Studio — All Document Types (Invoices, Receipts,
 *                POs, GRNs, Barcode & Shelf Labels) are rendered & managed through DocumentService.
 */

import React, { useState, useEffect } from "react";
import { SmritiScrollArea } from "../components/SmritiScrollArea.tsx";
import { Printer, FileText, Search, Clock, Tag, FileSpreadsheet, Send, Download, CheckCircle2 } from "lucide-react";
import { usePrintEngine } from "./print_store.tsx";
import { useLayoutEngine } from "../layout_engine/layout_store.tsx";
import { StandardInvoiceA4 } from "./templates/StandardInvoiceA4.tsx";
import { ThermalReceipt80mm } from "./templates/ThermalReceipt80mm.tsx";
import { GoodsReceiptNoteA4 } from "./templates/GoodsReceiptNoteA4.tsx";
import { BarcodeLabel } from "./templates/BarcodeLabel.tsx";
import { UniversalLabelPrintingStudio } from "../components/label_print/UniversalLabelPrintingStudio.tsx";
import { products as storeProducts } from "../state/store.ts";
import { DocumentService } from "../dop/core/DocumentService.ts";
import { DxpDocumentType, DxpOutputChannel } from "../dop/models/DxpTypes.ts";

const MOCK_DATA = {
  invoiceNo: "INV-2026-0891",
  date: "2026-08-06",
  companyName: "SMRITI Enterprise Co.",
  customerName: "Acme Retail Corp",
  items: [
    { name: "Wireless Keyboard", qty: 2, rate: 1450.0 },
    { name: "Optical Mouse", qty: 5, rate: 450.0 },
    { name: "USB-C Multi-Hub", qty: 1, rate: 2250.0 },
  ],
  subtotal: 7400.0,
  tax: 1332.0,
  total: 8732.0,
  cashier: "Jawahar M.",
  paymentMethod: "UPI",
  paid: 8732.0,
};

const BARCODE_DEMO_DATA = {
  invoiceNo: "LABEL-DEMO-001",
  date: "2026-08-06",
  companyName: "SMRITI Retail OS",
  customerName: "Demo Store",
  items: [{ name: "Smriti Running Shoe (Black - UK8)", qty: 1, rate: 1299.0, barcode: "8901234567890" }],
  subtotal: 1299.0,
  tax: 0.0,
  total: 1299.0,
  cashier: "Demo Cashier",
  paymentMethod: "CASH",
  paid: 1299.0,
};

export const PrintStudioTab: React.FC = () => {
  const { print, registerTemplate, templates } = usePrintEngine();
  const { addToRecentlyUsed } = useLayoutEngine();
  const [activeTemplate, setActiveTemplate] = useState<string>("standard-a4");
  const [selectedChannel, setSelectedChannel] = useState<DxpOutputChannel>("PRINT");
  const [outputStatus, setOutputStatus] = useState<string | null>(null);

  useEffect(() => {
    // Register standard SCS-DXP-001 document templates
    registerTemplate({
      id: "standard-a4",
      name: "Standard Tax Invoice (A4)",
      format: "A4",
      component: StandardInvoiceA4,
    });
    registerTemplate({
      id: "grn-a4",
      name: "Goods Receipt Note (GRN)",
      format: "A4",
      component: GoodsReceiptNoteA4,
    });
    registerTemplate({
      id: "thermal-80",
      name: "Retail Receipt (80mm Thermal)",
      format: "Thermal80mm",
      component: ThermalReceipt80mm,
    });
    registerTemplate({
      id: "label-50x25",
      name: "Product Barcode & Price Label (50x25mm)",
      format: "Label",
      component: BarcodeLabel,
    });
  }, [registerTemplate]);

  const selectedTemplate = templates.find((t) => t.id === activeTemplate);
  const PreviewComponent = selectedTemplate?.component || (() => <div>Select a document template</div>);
  const previewData = activeTemplate === "label-50x25" ? BARCODE_DEMO_DATA : MOCK_DATA;

  const handleOutputExecute = async (channel: DxpOutputChannel) => {
    let docType: DxpDocumentType = "INVOICE";
    if (activeTemplate === "grn-a4") docType = "GRN";
    else if (activeTemplate === "thermal-80") docType = "RECEIPT";
    else if (activeTemplate === "label-50x25") docType = "BARCODE_LABEL";

    try {
      const res = await DocumentService.execute({
        documentType: docType,
        referenceId: previewData.invoiceNo,
        channel: channel,
        data: previewData,
      });

      setOutputStatus(`Document delivered via ${res.channel} channel (State: ${res.lifecycleState})`);
      setTimeout(() => setOutputStatus(null), 4000);
    } catch (err: any) {
      setOutputStatus(`Output error: ${err.message || "Failed to dispatch"}`);
    }
  };

  const handlePrint = () => {
    print({
      templateId: activeTemplate,
      data: previewData,
    });
    handleOutputExecute("PRINT");
  };

  if (activeTemplate === "universal-label-studio") {
    return (
      <div className="h-full flex flex-col bg-theme-base font-sans">
        <div className="h-12 border-b border-theme-divider bg-theme-surface-1 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTemplate("standard-a4")}
              className="text-xs font-semibold text-blue-500 hover:underline cursor-pointer"
            >
              ← Back to Document Studio
            </button>
            <span className="text-theme-divider">|</span>
            <span className="text-xs font-bold text-theme-primary">Universal Label & Sticker Studio (SLPS)</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <UniversalLabelPrintingStudio products={storeProducts} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-theme-base font-sans overflow-hidden text-theme-body">
      {/* Sidebar */}
      <div className="w-72 border-r border-theme-divider bg-theme-surface-1 flex flex-col z-10">
        <div className="p-4 border-b border-theme-divider flex items-center gap-3 bg-theme-surface-2">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
            <Printer size={18} />
          </div>
          <div>
            <h2 className="font-bold font-display text-theme-primary">Document Studio</h2>
            <p className="text-[10px] text-theme-muted uppercase tracking-wider font-mono">SCS-DXP-001 Platform Service</p>
          </div>
        </div>

        <div className="p-4 border-b border-theme-divider">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-theme-muted" size={14} />
            <input
              type="text"
              placeholder="Search document templates..."
              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <SmritiScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono px-2 py-1.5 mt-2">
              A4 / A5 Business Documents
            </div>
            {templates
              .filter((t) => t.format === "A4")
              .map((template) => (
                <button
                  key={template.id}
                  onClick={() => setActiveTemplate(template.id)}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                    activeTemplate === template.id
                      ? "bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20"
                      : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary"
                  }`}
                >
                  <FileText size={16} />
                  <span className="text-sm truncate">{template.name}</span>
                </button>
              ))}

            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono px-2 py-1.5 mt-4">
              Thermal POS Receipts
            </div>
            {templates
              .filter((t) => t.format === "Thermal80mm")
              .map((template) => (
                <button
                  key={template.id}
                  onClick={() => setActiveTemplate(template.id)}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                    activeTemplate === template.id
                      ? "bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20"
                      : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary"
                  }`}
                >
                  <FileSpreadsheet size={16} />
                  <span className="text-sm truncate">{template.name}</span>
                </button>
              ))}

            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono px-2 py-1.5 mt-4">
              Barcode & Shelf Labels
            </div>
            {templates
              .filter((t) => t.format === "Label")
              .map((template) => (
                <button
                  key={template.id}
                  onClick={() => setActiveTemplate(template.id)}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                    activeTemplate === template.id
                      ? "bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20"
                      : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary"
                  }`}
                >
                  <Tag size={16} />
                  <span className="text-sm truncate">{template.name}</span>
                </button>
              ))}

            <button
              onClick={() => setActiveTemplate("universal-label-studio")}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors mt-2 ${
                activeTemplate === "universal-label-studio"
                  ? "bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20"
                  : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary"
              }`}
            >
              <Tag size={16} className="text-blue-400" />
              <span className="text-sm truncate font-semibold text-blue-400">Launch Universal Label Designer</span>
            </button>
          </div>
        </SmritiScrollArea>
      </div>

      {/* Main Preview & Controls */}
      <div className="flex-1 flex flex-col bg-theme-surface-2 relative">
        {/* Toolbar */}
        <div className="h-14 border-b border-theme-divider bg-theme-surface-1 flex justify-between items-center px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-bold font-mono tracking-wider uppercase bg-theme-surface-3 rounded border border-theme-divider text-theme-muted">
              {selectedTemplate?.format || "A4"} FORMAT
            </span>
            {outputStatus && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">
                <CheckCircle2 size={13} /> {outputStatus}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => addToRecentlyUsed("print-history")}
              className="flex items-center gap-2 px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider text-theme-primary rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Clock size={14} className="text-theme-muted" /> View Spool Logs
            </button>

            <button
              onClick={() => handleOutputExecute("PDF")}
              className="flex items-center gap-2 px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Download size={14} /> PDF
            </button>

            <button
              onClick={() => handleOutputExecute("EMAIL")}
              className="flex items-center gap-2 px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Send size={14} /> Email
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Printer size={14} /> Print Document
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto bg-theme-surface-3 relative p-8">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(var(--color-theme-divider) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              opacity: 0.5,
            }}
          ></div>

          <div className="relative flex justify-center pb-20 pt-6">
            <div
              className="shadow-2xl ring-1 ring-black/5 bg-white transition-all transform origin-top"
              style={
                selectedTemplate?.format === "A4"
                  ? { width: "210mm", minHeight: "297mm" }
                  : selectedTemplate?.format === "Thermal80mm"
                  ? { width: "80mm", minHeight: "150mm" }
                  : selectedTemplate?.format === "Label"
                  ? { width: "80mm", height: "40mm" }
                  : { width: "100%", height: "100%" }
              }
            >
              <div className="text-black bg-white w-full h-full p-4">
                <PreviewComponent data={previewData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
