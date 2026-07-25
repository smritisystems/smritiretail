/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (SMRITI Print Labels Enterprise Studio Master Orchestrator)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Printer, Tag, Sliders, GitMerge, QrCode, History, 
  Folder, Layers, AlertTriangle, CheckCircle2, Play, RefreshCw, X
} from "lucide-react";
import { 
  UniversalLabelItem, PrinterProfile, 
  getStoredPrinterProfiles, renderSLPEPRNScript, MASTER_PRN_SCRIPTS 
} from "../services/universalLabelPrinterService.ts";
import { PrinterConfigurationModal } from "./PrinterConfigurationModal.tsx";
import { Product } from "../types.ts";

// Import Modular Sub-Components
import { PrinterConfigurationPanel, OutputPortSelection } from "./print_labels/PrinterConfigurationPanel.tsx";
import { SourceSelectionPanel, SelectionOptionMode } from "./print_labels/SourceSelectionPanel.tsx";
import { TransactionFilterPanel, TransactionFilterState } from "./print_labels/TransactionFilterPanel.tsx";
import { RangeSelectionPanel, SelectionCriteriaState } from "./print_labels/RangeSelectionPanel.tsx";
import { QuantityStrategyPanel, LabelQuantityStrategy } from "./print_labels/QuantityStrategyPanel.tsx";
import { SelectedItemPreview } from "./print_labels/SelectedItemPreview.tsx";
import { OutputPanel, OutputOptionsState } from "./print_labels/OutputPanel.tsx";
import { ActionToolbar } from "./print_labels/ActionToolbar.tsx";
import { CalibrationPanel } from "./print_labels/CalibrationPanel.tsx";
import { PRNMappingPanel } from "./print_labels/PRNMappingPanel.tsx";
import { ScanPrintPanel } from "./print_labels/ScanPrintPanel.tsx";
import { PrintHistoryPanel } from "./print_labels/PrintHistoryPanel.tsx";

// Import Enterprise Services
import { PrinterDriverFactory } from "../services/print_labels/printerDriverInterface.ts";
import { resolvePRNMappingForRule } from "../services/print_labels/prnMappingService.ts";
import { validateLabelQueuePreflight, LabelPreflightReport } from "../services/print_labels/labelValidationService.ts";
import { addJobToPrintQueue } from "../services/print_labels/printQueueService.ts";
import { logPrintAuditRecord } from "../services/print_labels/printAuditService.ts";

export interface PrintLabelsTabProps {
  products?: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
  currentUser?: any;
}

export type ActiveTabMode = "workstation" | "calibration" | "prn_mapping" | "scan_print" | "history";

export const PrintLabelsTab: React.FC<PrintLabelsTabProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser
}) => {
  // Master Tab State
  const [activeStudioTab, setActiveStudioTab] = useState<ActiveTabMode>("workstation");

  // Sample Tag Inventory Queue
  const initialItems: UniversalLabelItem[] = useMemo(() => {
    if (products.length > 0) {
      return products.map((p, index) => ({
        id: p.id,
        item_code: p.code || p.sku || `00000${index + 1}`,
        stock_no: p.code || p.sku || `00000${index + 1}`,
        barcode: p.barcode || `890123456000${index + 1}`,
        sku: p.sku || p.code || `SKU-00${index + 1}`,
        name: p.name,
        product: p.category || "Shirt",
        category: p.category || "Shirt",
        brand: p.brand || "Beanstalk",
        style: (p as any).style || p.code || "BeeLine",
        shade: (p as any).color || (p as any).shade || "Ecru",
        color: (p as any).color || (p as any).shade || "Ecru",
        size: (p as any).size || "34",
        price: p.price || 1299,
        mrp: p.mrp || p.price || 1999,
        stock_qty: p.stock ?? (p as any).stock_qty ?? 15,
        received_qty: p.stock ?? (p as any).stock_qty ?? 15,
        label_copies: 1
      }));
    }

    return [
      { id: "lbl-101", stock_no: "000006", item_code: "000006", barcode: "8901234560006", sku: "SHT-BEAN-06", name: "Premium Casual Cotton Shirt (Ecru)", product: "Shirt", category: "Shirt", brand: "Beanstalk", style: "BeeLine", shade: "Ecru", size: "34", price: 1499, mrp: 2999, stock_qty: 24, received_qty: 24, label_copies: 1 },
      { id: "lbl-102", stock_no: "000007", item_code: "000007", barcode: "8901234560007", sku: "SHT-BEAN-07", name: "Premium Casual Cotton Shirt (Blue)", product: "Shirt", category: "Shirt", brand: "Beanstalk", style: "BeeLine", shade: "Blue", size: "36", price: 1499, mrp: 2999, stock_qty: 18, received_qty: 18, label_copies: 1 },
      { id: "lbl-103", stock_no: "000008", item_code: "000008", barcode: "8901234560008", sku: "SHT-BEAN-08", name: "Premium Formal Oxford Shirt (White)", product: "Shirt", category: "Shirt", brand: "Beanstalk", style: "BeeLine", shade: "White", size: "38", price: 1799, mrp: 3499, stock_qty: 30, received_qty: 30, label_copies: 1 },
      { id: "lbl-104", stock_no: "000009", item_code: "000009", barcode: "8901234560009", sku: "TRO-ROY-09", name: "Executive Slim Fit Trouser (Black)", product: "Trouser", category: "Trouser", brand: "Royal Smriti", style: "ExecFit", shade: "Black", size: "32", price: 2499, mrp: 4999, stock_qty: 12, received_qty: 12, label_copies: 1 },
      { id: "lbl-105", stock_no: "000010", item_code: "000010", barcode: "8901234560010", sku: "DEN-AIT-10", name: "Regular Fit Denim Jeans (Indigo)", product: "Jeans", category: "Jeans", brand: "AITDL Craft", style: "DenimX", shade: "Indigo", size: "34", price: 2999, mrp: 5999, stock_qty: 15, received_qty: 15, label_copies: 1 },
    ];
  }, [products]);

  const [items, setItems] = useState<UniversalLabelItem[]>(initialItems);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);

  // Top Section: Template Script File & Multi-Track Roll Configuration
  const [scriptFileName, setScriptFileName] = useState<string>("C:\\smriti9\\templates\\tattly_threads_default.prn");
  const [labelsPerRow, setLabelsPerRow] = useState<number>(1);

  // Left Panel States
  const [selectedPort, setSelectedPort] = useState<OutputPortSelection>("usb");
  const [outputToPort, setOutputToPort] = useState<boolean>(true);
  const [outputToFile, setOutputToFile] = useState<boolean>(false);
  const [fileOutputPath, setFileOutputPath] = useState<string>("C:\\smriti9\\output\\tags.prn");

  const [optionMode, setOptionMode] = useState<SelectionOptionMode>("manual");
  const [ptFileName, setPtFileName] = useState<string>("GRN-2026-0891.pt");

  // Contextual Transaction Filters State
  const [txFilters, setTxFilters] = useState<TransactionFilterState>({
    docNoFrom: "", docNoTo: "", supplierCustomer: "", dateFrom: "", dateTo: "", warehouse: "", salesman: ""
  });

  // 18-Field Selection Criteria Range Boundaries State
  const [criteria, setCriteria] = useState<SelectionCriteriaState>({
    stockNoFrom: "000006", stockNoTo: "000008",
    barcodeFrom: "", barcodeTo: "",
    productFrom: "ALL", productTo: "ALL",
    brandFrom: "ALL", brandTo: "ALL",
    categoryFrom: "ALL", categoryTo: "ALL",
    subCategoryFrom: "ALL", subCategoryTo: "ALL",
    departmentFrom: "ALL", departmentTo: "ALL",
    sectionFrom: "ALL", sectionTo: "ALL",
    styleFrom: "ALL", styleTo: "ALL",
    shadeFrom: "ALL", shadeTo: "ALL",
    colorFrom: "ALL", colorTo: "ALL",
    sizeFrom: "ALL", sizeTo: "ALL",
    batchFrom: "", batchTo: "",
    serialFrom: "", serialTo: "",
    supplierFrom: "", supplierTo: "",
    warehouseFrom: "", warehouseTo: "",
    locationFrom: "", locationTo: "",
    hsnFrom: "", hsnTo: ""
  });

  // Quantity Strategy State
  const [quantityStrategy, setQuantityStrategy] = useState<LabelQuantityStrategy>("specified");
  const [copiesMultiplier, setCopiesMultiplier] = useState<number>(1);

  // Output Checkboxes State
  const [outputOptions, setOutputOptions] = useState<OutputOptionsState>({
    doPrint: true, doPreview: true, doExportPDF: false, doSavePRN: false, doSaveZPL: false, doSaveEPL: false, doSaveTSPL: false
  });

  // Hardware Printer Configurations
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>(() => getStoredPrinterProfiles());
  const [activePrinter, setActivePrinter] = useState<PrinterProfile>(() => {
    const defaultPrn = getStoredPrinterProfiles().find(p => p.isDefault);
    return defaultPrn || getStoredPrinterProfiles()[0];
  });
  const [showPrinterConfigModal, setShowPrinterConfigModal] = useState<boolean>(false);

  // Pre-Dispatch Batch Summary Modal State
  const [showPreDispatchModal, setShowPreDispatchModal] = useState<boolean>(false);

  // Sync items when initialItems prop updates
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Dropdown Extraction Lists
  const productsList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.product || i.category).filter(Boolean)))], [items]);
  const brandsList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.brand).filter(Boolean)))], [items]);
  const stylesList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.style).filter(Boolean)))], [items]);
  const shadesList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.shade || i.color).filter(Boolean)))], [items]);
  const sizesList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.size).filter(Boolean)))], [items]);

  // Filtered Queue based on Selection Criteria Range Boundaries
  const filteredQueue = useMemo(() => {
    return items.filter(item => {
      const stock = item.stock_no || item.item_code;
      if (criteria.stockNoFrom && stock < criteria.stockNoFrom) return false;
      if (criteria.stockNoTo && stock > criteria.stockNoTo) return false;

      const prod = item.product || item.category || "";
      if (criteria.productFrom !== "ALL" && prod < criteria.productFrom) return false;
      if (criteria.productTo !== "ALL" && prod > criteria.productTo) return false;

      const br = item.brand || "";
      if (criteria.brandFrom !== "ALL" && br < criteria.brandFrom) return false;
      if (criteria.brandTo !== "ALL" && br > criteria.brandTo) return false;

      const st = item.style || "";
      if (criteria.styleFrom !== "ALL" && st < criteria.styleFrom) return false;
      if (criteria.styleTo !== "ALL" && st > criteria.styleTo) return false;

      const sh = item.shade || item.color || "";
      if (criteria.shadeFrom !== "ALL" && sh < criteria.shadeFrom) return false;
      if (criteria.shadeTo !== "ALL" && sh > criteria.shadeTo) return false;

      const sz = item.size || "";
      if (criteria.sizeFrom !== "ALL" && sz < criteria.sizeFrom) return false;
      if (criteria.sizeTo !== "ALL" && sz > criteria.sizeTo) return false;

      return true;
    });
  }, [items, criteria]);

  // Selected Active Item in Criteria Filter
  const activeSelectedItem = useMemo(() => {
    if (filteredQueue.length === 0) return null;
    const idx = Math.min(activeItemIndex, filteredQueue.length - 1);
    return filteredQueue[idx] || filteredQueue[0];
  }, [filteredQueue, activeItemIndex]);

  // Metrics Computations
  const totalRecords = filteredQueue.length;
  const currentStockTotal = useMemo(() => filteredQueue.reduce((acc, i) => acc + (i.stock_qty || 0), 0), [filteredQueue]);
  const labelsToPrintTotal = useMemo(() => {
    if (quantityStrategy === "stock_qty" || quantityStrategy === "available_stock") return currentStockTotal * copiesMultiplier;
    if (quantityStrategy === "one_per_item") return totalRecords * copiesMultiplier;
    return filteredQueue.reduce((acc, i) => acc + ((i.label_copies || 1) * copiesMultiplier), 0);
  }, [filteredQueue, quantityStrategy, currentStockTotal, totalRecords, copiesMultiplier]);

  // Evaluated PRN Code & 9-Tier Rule Resolver Preview
  const evaluatedPRNPayload = useMemo(() => {
    if (!activeSelectedItem) return "; Select item to evaluate tag script";
    const resolved = resolvePRNMappingForRule(activeSelectedItem);
    const driver = PrinterDriverFactory.getDriver(activePrinter?.protocol || resolved.rule.protocol);
    const result = driver.render({
      profile: activePrinter || { id: "p1", name: "Default", brand: "Zebra", protocol: "ZPL", connectionType: "USB", isDefault: true, dpi: 203 },
      item: activeSelectedItem,
      copies: activeSelectedItem.label_copies || 1,
      userName: currentUser?.name || "System Clerk"
    });
    return result.rawPayload;
  }, [activeSelectedItem, activePrinter, currentUser]);

  // Pre-Flight Readiness Report
  const preflightReport: LabelPreflightReport = useMemo(() => {
    return validateLabelQueuePreflight(filteredQueue, activePrinter, quantityStrategy);
  }, [filteredQueue, activePrinter, quantityStrategy]);

  // Action Handlers
  const handlePrintSelected = () => {
    if (!activeSelectedItem) {
      if (onNotification) onNotification("Empty Selection", "No item selected in tag queue.", "error");
      return;
    }

    const driver = PrinterDriverFactory.getDriver(activePrinter?.protocol || "ZPL");
    const result = driver.render({
      profile: activePrinter,
      item: activeSelectedItem,
      copies: copiesMultiplier,
      userName: currentUser?.name || "System Clerk"
    });

    const printerName = activePrinter?.name || "Default Printer";
    addJobToPrintQueue(`Single Tag Print: ${activeSelectedItem.name}`, printerName, selectedPort, "AutoPRN", 1, copiesMultiplier, result.rawPayload, currentUser?.name);
    logPrintAuditRecord({
      whoPrinted: currentUser?.name || "System Clerk",
      printerName,
      templateName: "Garment_Hangtag.prn",
      clientIp: "127.0.0.1",
      machineId: "WS-WORKSTATION-01",
      itemCount: 1,
      totalLabels: copiesMultiplier,
      durationSec: 1,
      status: "SUCCESS"
    });

    if (onNotification) {
      onNotification("Print Dispatched", `Dispatched ${copiesMultiplier} labels for ${activeSelectedItem.name} to ${printerName} [${selectedPort.toUpperCase()}]`, "success");
    }
  };

  const handlePrintAllClick = () => {
    if (filteredQueue.length === 0) {
      if (onNotification) onNotification("Queue Empty", "No records matched selection criteria.", "error");
      return;
    }
    setShowPreDispatchModal(true);
  };

  const handleConfirmBatchPrint = () => {
    const printerName = activePrinter?.name || "Default Printer";
    addJobToPrintQueue(`Batch Job: ${filteredQueue.length} items`, printerName, selectedPort, "Garment_Tag.prn", filteredQueue.length, labelsToPrintTotal, evaluatedPRNPayload, currentUser?.name);
    logPrintAuditRecord({
      whoPrinted: currentUser?.name || "System Clerk",
      printerName,
      templateName: "Garment_Tag.prn",
      clientIp: "127.0.0.1",
      machineId: "WS-WORKSTATION-01",
      itemCount: filteredQueue.length,
      totalLabels: labelsToPrintTotal,
      durationSec: Math.ceil(labelsToPrintTotal * 0.25),
      status: "SUCCESS"
    });

    setShowPreDispatchModal(false);
    if (onNotification) {
      onNotification("Batch Print Dispatched", `Dispatched ${labelsToPrintTotal} total labels (${filteredQueue.length} records) to ${printerName}`, "success");
    }
  };

  const handleClear = () => {
    setCriteria({
      stockNoFrom: "", stockNoTo: "", barcodeFrom: "", barcodeTo: "", productFrom: "ALL", productTo: "ALL",
      brandFrom: "ALL", brandTo: "ALL", categoryFrom: "ALL", categoryTo: "ALL", subCategoryFrom: "ALL", subCategoryTo: "ALL",
      departmentFrom: "ALL", departmentTo: "ALL", sectionFrom: "ALL", sectionTo: "ALL", styleFrom: "ALL", styleTo: "ALL",
      shadeFrom: "ALL", shadeTo: "ALL", colorFrom: "ALL", colorTo: "ALL", sizeFrom: "ALL", sizeTo: "ALL",
      batchFrom: "", batchTo: "", serialFrom: "", serialTo: "", supplierFrom: "", supplierTo: "",
      warehouseFrom: "", warehouseTo: "", locationFrom: "", locationTo: "", hsnFrom: "", hsnTo: ""
    });
    setActiveItemIndex(0);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f18] text-slate-200 font-mono text-xs p-4 space-y-4 overflow-y-auto">
      
      {/* ── Studio Header Bar ──────────────────────────────────────────────────── */}
      <div className="bg-[#141726] border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Tag size={22} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white font-display flex items-center gap-2">
              Print Labels — SMRITI Barcode Studio v3.37.0
              <span className="text-[10px] bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 font-mono">10/10 Enterprise Ready</span>
            </h1>
            <p className="text-[11px] text-slate-400">Multi-Format Barcode Tag Printing (ZPL, TSPL, EPL, CPCL, PRN, PDF • 9-Tier Rule Engine)</p>
          </div>
        </div>

        {/* Top Studio Workstation Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-[#0a0c14] border border-slate-800 p-1.5 rounded-xl text-xs font-bold">
          <button onClick={() => setActiveStudioTab("workstation")} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${activeStudioTab === "workstation" ? "bg-amber-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}>
            <Printer size={13} /> Workstation
          </button>
          <button onClick={() => setActiveStudioTab("calibration")} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${activeStudioTab === "calibration" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}>
            <Sliders size={13} /> Calibration
          </button>
          <button onClick={() => setActiveStudioTab("prn_mapping")} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${activeStudioTab === "prn_mapping" ? "bg-purple-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}>
            <GitMerge size={13} /> PRN Rules
          </button>
          <button onClick={() => setActiveStudioTab("scan_print")} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${activeStudioTab === "scan_print" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}>
            <QrCode size={13} /> Scan & Print
          </button>
          <button onClick={() => setActiveStudioTab("history")} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${activeStudioTab === "history" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}>
            <History size={13} /> Audit Ledger
          </button>
        </div>
      </div>

      {/* Pre-Flight Readiness Warning Ribbon */}
      <div className="bg-[#141726] border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-bold uppercase text-[10px]">Pre-Flight Status:</span>
          <span className="bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/40 font-bold">{preflightReport.readyItemsCount} Items Ready</span>
          {preflightReport.warningsCount > 0 && <span className="bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded border border-amber-800/40 font-bold flex items-center gap-1"><AlertTriangle size={11} /> {preflightReport.warningsCount} Warnings</span>}
          {preflightReport.errorsCount > 0 && <span className="bg-red-950/60 text-red-300 px-2 py-0.5 rounded border border-red-800/40 font-bold">{preflightReport.errorsCount} Errors</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Template Script:</span>
          <input type="text" value={scriptFileName} onChange={e => setScriptFileName(e.target.value)} className="bg-[#0a0c14] border border-slate-800 rounded px-2 py-0.5 text-amber-300 text-[11px] w-48" />
        </div>
      </div>

      {/* ── Tab Views ───────────────────────────────────────────────────────────── */}
      {activeStudioTab === "workstation" && (
        <div className="space-y-4 flex-1">
          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
            {/* Left Column (Col Span 4) */}
            <div className="lg:col-span-4 space-y-4">
              <PrinterConfigurationPanel
                selectedPort={selectedPort}
                onPortChange={setSelectedPort}
                outputToPort={outputToPort}
                onOutputToPortChange={setOutputToPort}
                outputToFile={outputToFile}
                onOutputToFileChange={setOutputToFile}
                fileOutputPath={fileOutputPath}
                onFilePathChange={setFileOutputPath}
                activePrinter={activePrinter}
                printerProfiles={printerProfiles}
                onOpenConfigModal={() => setShowPrinterConfigModal(true)}
              />

              <SourceSelectionPanel
                optionMode={optionMode}
                onOptionModeChange={setOptionMode}
                ptFileName={ptFileName}
                onPtFileNameChange={setPtFileName}
              />

              <QuantityStrategyPanel
                strategy={quantityStrategy}
                onStrategyChange={setQuantityStrategy}
                copiesMultiplier={copiesMultiplier}
                onCopiesMultiplierChange={setCopiesMultiplier}
                totalRecords={totalRecords}
                currentStockTotal={currentStockTotal}
                labelsToPrintTotal={labelsToPrintTotal}
              />

              <OutputPanel
                options={outputOptions}
                onOptionsChange={setOutputOptions}
              />
            </div>

            {/* Right Column (Col Span 8) */}
            <div className="lg:col-span-8 space-y-4 flex flex-col">
              <TransactionFilterPanel
                optionMode={optionMode}
                filters={txFilters}
                onFilterChange={setTxFilters}
              />

              <RangeSelectionPanel
                criteria={criteria}
                onCriteriaChange={setCriteria}
                productsList={productsList}
                brandsList={brandsList}
                stylesList={stylesList}
                shadesList={shadesList}
                sizesList={sizesList}
              />

              <SelectedItemPreview
                item={activeSelectedItem}
                activePrinter={activePrinter}
                evaluatedPRNPayload={evaluatedPRNPayload}
                itemIndex={activeItemIndex}
                totalItems={filteredQueue.length}
              />
            </div>
          </div>

          {/* Action Toolbar */}
          <ActionToolbar
            onFirst={() => setActiveItemIndex(0)}
            onPrev={() => setActiveItemIndex(prev => Math.max(0, prev - 1))}
            onNext={() => setActiveItemIndex(prev => Math.min(filteredQueue.length - 1, prev + 1))}
            onLast={() => setActiveItemIndex(Math.max(0, filteredQueue.length - 1))}
            activeIndex={activeItemIndex}
            totalFiltered={filteredQueue.length}
            onClearCriteria={handleClear}
            onPrintSelected={handlePrintSelected}
            onPrintAll={handlePrintAllClick}
            labelsToPrintTotal={labelsToPrintTotal}
            hasSelectedItem={!!activeSelectedItem}
          />
        </div>
      )}

      {activeStudioTab === "calibration" && <CalibrationPanel />}
      {activeStudioTab === "prn_mapping" && <PRNMappingPanel />}
      {activeStudioTab === "scan_print" && <ScanPrintPanel items={items} activePrinter={activePrinter} onNotification={onNotification} />}
      {activeStudioTab === "history" && <PrintHistoryPanel onNotification={onNotification} />}

      {/* ── Pre-Dispatch Batch Summary Modal ───────────────────────────────────── */}
      {showPreDispatchModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141726] border border-amber-500/40 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <Play size={16} className="text-amber-400" />
                Batch Print Pre-Dispatch Summary
              </h3>
              <button onClick={() => setShowPreDispatchModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>

            <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex justify-between"><span className="text-slate-400">Target Printer:</span><span className="text-amber-300 font-bold">{activePrinter?.name || "Zebra ZD421 USB"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Hardware Interface:</span><span className="text-emerald-400 font-bold">{selectedPort.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Active Template:</span><span className="text-indigo-300 font-bold">Garment_Tag.prn ({activePrinter?.protocol || "ZPL"})</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Records Filtered:</span><span className="text-white font-bold">{filteredQueue.length} items</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Total Labels To Print:</span><span className="text-emerald-400 font-bold text-sm">{labelsToPrintTotal} Labels</span></div>
              <div className="flex justify-between border-t border-slate-800 pt-2"><span className="text-slate-400">Estimated Print Duration:</span><span className="text-amber-300 font-bold">~{Math.ceil(labelsToPrintTotal * 0.25)} seconds</span></div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowPreDispatchModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl">Cancel</button>
              <button onClick={handleConfirmBatchPrint} className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 text-white font-bold rounded-xl shadow-xl flex items-center gap-1.5">
                <Play size={14} /> Dispatch Batch Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hardware Printer Setup Modal */}
      <PrinterConfigurationModal 
        isOpen={showPrinterConfigModal}
        onClose={() => setShowPrinterConfigModal(false)}
        onPrinterProfileChanged={(updatedList, newSelectedId) => {
          setPrinterProfiles(updatedList);
          if (newSelectedId) {
            const target = updatedList.find(p => p.id === newSelectedId);
            if (target) setActivePrinter(target);
          }
        }}
      />
    </div>
  );
};

export default PrintLabelsTab;
