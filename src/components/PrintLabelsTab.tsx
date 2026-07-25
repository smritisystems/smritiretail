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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.36.0 (SMRITI Tag Printing & Dedicated Print Labels Studio)
 * * Created    : 2026-07-25
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useMemo } from "react";
import { 
  Printer, Tag, FileText, Settings, Play, CheckCircle2, 
  RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Sliders, Database, Usb, Wifi, Cpu, FileCode, Check, Eye, Folder, RefreshCw, X
} from "lucide-react";
import { 
  UniversalLabelItem, QuantitySource, PrinterProfile, 
  getStoredPrinterProfiles, renderSLPEPRNScript, MASTER_PRN_SCRIPTS 
} from "../services/universalLabelPrinterService.ts";
import { PrinterConfigurationModal } from "./PrinterConfigurationModal.tsx";
import { BarcodeLabel } from "../print_engine/templates/BarcodeLabel.tsx";
import { Product } from "../types.ts";

export interface PrintLabelsTabProps {
  products?: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
  currentUser?: any;
}

export type SelectionOptionMode = 
  | "manual" 
  | "purchase_pt" 
  | "transactions" 
  | "purchase_order" 
  | "masters" 
  | "direct_scan";

export type OutputPortSelection = 
  | "com1" 
  | "com2" 
  | "com3" 
  | "parallel" 
  | "usb" 
  | "tcpip";

export const PrintLabelsTab: React.FC<PrintLabelsTabProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser
}) => {
  // Master Sample Tag Printing Inventory Items
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

  // Master Items Queue & Active Item Index
  const [items, setItems] = useState<UniversalLabelItem[]>(initialItems);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);

  // Top Section: Template Script File & Multi-Track Roll Configuration
  const [scriptFileName, setScriptFileName] = useState<string>("C:\\smriti9\\templates\\pesh.txt");
  const [labelsPerRow, setLabelsPerRow] = useState<number>(1);

  // Left Panel: Output Destination & Port Settings
  const [outputToPort, setOutputToPort] = useState<boolean>(true);
  const [outputToFile, setOutputToFile] = useState<boolean>(false);
  const [fileOutputPath, setFileOutputPath] = useState<string>("C:\\smriti9\\output\\tags.prn");
  const [selectedPort, setSelectedPort] = useState<OutputPortSelection>("usb");

  // Left Panel: Data Selection Option Mode
  const [optionMode, setOptionMode] = useState<SelectionOptionMode>("manual");
  const [piFileName, setPiFileName] = useState<string>("GRN-2026-0891.pt");

  // Left Panel: Labels to Print Strategy
  const [labelsStrategy, setLabelsStrategy] = useState<"specified" | "stock">("specified");

  // Hardware Printer Configurations
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>(() => getStoredPrinterProfiles());
  const [activePrinter, setActivePrinter] = useState<PrinterProfile>(() => {
    const defaultPrn = getStoredPrinterProfiles().find(p => p.isDefault);
    return defaultPrn || getStoredPrinterProfiles()[0];
  });
  const [showPrinterConfigModal, setShowPrinterConfigModal] = useState<boolean>(false);

  // Sync items state when products prop updates
  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Sync printer profiles from storage on mount
  React.useEffect(() => {
    const freshProfiles = getStoredPrinterProfiles();
    setPrinterProfiles(freshProfiles);
    const defaultPrn = freshProfiles.find(p => p.isDefault) || freshProfiles[0];
    if (defaultPrn) setActivePrinter(defaultPrn);
  }, []);

  // Selection Criteria Range Boundaries (From - To)
  const [criteria, setCriteria] = useState({
    stockNoFrom: "000006",
    stockNoTo: "000008",
    productFrom: "ALL",
    productTo: "ALL",
    brandFrom: "ALL",
    brandTo: "ALL",
    styleFrom: "ALL",
    styleTo: "ALL",
    shadeFrom: "ALL",
    shadeTo: "ALL",
    sizeFrom: "ALL",
    sizeTo: "ALL",
  });

  // Extract Dropdown Options
  const productsList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.product || i.category).filter(Boolean)))], [items]);
  const brandsList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.brand).filter(Boolean)))], [items]);
  const stylesList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.style).filter(Boolean)))], [items]);
  const shadesList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.shade || i.color).filter(Boolean)))], [items]);
  const sizesList = useMemo(() => ["ALL", ...Array.from(new Set(items.map(i => i.size).filter(Boolean)))], [items]);

  // Filtered Queue based on Selection Criteria
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
    if (labelsStrategy === "stock") return currentStockTotal;
    return filteredQueue.reduce((acc, i) => acc + (i.label_copies || 1), 0);
  }, [filteredQueue, labelsStrategy, currentStockTotal]);

  // Evaluated PRN Code Preview
  const evaluatedPRNPayload = useMemo(() => {
    if (!activeSelectedItem) return "; Select item to evaluate tag script";
    const templateScript = MASTER_PRN_SCRIPTS[0].prnScript;
    return renderSLPEPRNScript(templateScript, activeSelectedItem, activeSelectedItem.label_copies || 1, currentUser?.name || "System Manager");
  }, [activeSelectedItem, currentUser]);

  // Navigation Handlers
  const handleFirst = () => setActiveItemIndex(0);
  const handlePrev = () => setActiveItemIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setActiveItemIndex(prev => Math.min(filteredQueue.length - 1, prev + 1));
  const handleLast = () => setActiveItemIndex(Math.max(0, filteredQueue.length - 1));

  // Action Handlers
  const handlePrintSelected = () => {
    if (!activeSelectedItem) {
      if (onNotification) onNotification("Empty Selection", "No item selected in the tag printing queue.", "error");
      return;
    }
    const targetQty = labelsStrategy === "stock" ? (activeSelectedItem.stock_qty || 1) : (activeSelectedItem.label_copies || 1);
    const printerName = activePrinter?.name || "Default Barcode Printer";
    if (onNotification) {
      onNotification("Print Dispatched", `Dispatched ${targetQty} labels for ${activeSelectedItem.name} to ${printerName} [${selectedPort.toUpperCase()}]`, "success");
    }
  };

  const handlePrintAll = () => {
    if (filteredQueue.length === 0) {
      if (onNotification) onNotification("Queue Empty", "No records matched the selection criteria.", "error");
      return;
    }
    const printerName = activePrinter?.name || "Default Barcode Printer";
    if (onNotification) {
      onNotification("Batch Dispatched", `Dispatched ${labelsToPrintTotal} total labels (${filteredQueue.length} records) to ${printerName}`, "success");
    }
  };

  const handleClear = () => {
    setCriteria({
      stockNoFrom: "",
      stockNoTo: "",
      productFrom: "ALL",
      productTo: "ALL",
      brandFrom: "ALL",
      brandTo: "ALL",
      styleFrom: "ALL",
      styleTo: "ALL",
      shadeFrom: "ALL",
      shadeTo: "ALL",
      sizeFrom: "ALL",
      sizeTo: "ALL",
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
              Print Labels — Enterprise Tag Printing Studio
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 font-mono">Shoper 9 Spec</span>
            </h1>
            <p className="text-[11px] text-slate-400">Multi-Track Barcode & Garment Tag Printing (COM 1-3, LPT1 Parallel, Direct USB, TCP/IP Network)</p>
          </div>
        </div>

        {/* Top Control Settings: Script File & No. of Labels Per Row */}
        <div className="flex flex-wrap items-center gap-3 bg-[#0a0c14] border border-slate-800 p-2 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Script File Name:</span>
            <input 
              type="text" 
              value={scriptFileName} 
              onChange={e => setScriptFileName(e.target.value)} 
              className="bg-[#141726] border border-slate-700 rounded-lg px-2.5 py-1 text-amber-300 w-56 text-xs font-mono outline-none" 
            />
            <button className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded border border-slate-700">
              <Folder size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Labels Per Row:</span>
            <select 
              value={labelsPerRow} 
              onChange={e => setLabelsPerRow(parseInt(e.target.value))} 
              className="bg-[#141726] border border-slate-700 rounded-lg px-2 py-1 text-amber-300 text-xs font-bold outline-none"
            >
              <option value={1}>1 Tag Across</option>
              <option value={2}>2 Tags Across</option>
              <option value={3}>3 Tags Across</option>
              <option value={4}>4 Tags Across</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Workstation Layout Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        
        {/* ── Left Column: Output Ports, Options & Quantity Strategy (Col Span 4) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Output To & Port Settings Card */}
          <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                <Printer size={15} className="text-amber-400" />
                Output To & Destination Ports
              </span>

              <button 
                onClick={() => setShowPrinterConfigModal(true)} 
                className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40"
              >
                <Settings size={11} />
                <span>Config Hardware</span>
              </button>
            </div>

            {/* Checkboxes: Port vs File */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 font-bold">
                <input type="checkbox" checked={outputToPort} onChange={e => setOutputToPort(e.target.checked)} className="accent-amber-500" />
                <span>Port Output</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 font-bold">
                <input type="checkbox" checked={outputToFile} onChange={e => setOutputToFile(e.target.checked)} className="accent-amber-500" />
                <span>File Export</span>
              </label>
            </div>

            {outputToFile && (
              <div className="flex items-center gap-2 pt-1">
                <input type="text" value={fileOutputPath} onChange={e => setFileOutputPath(e.target.value)} className="w-full bg-[#0a0c14] border border-slate-800 rounded-lg px-2 py-1 text-emerald-300 text-[11px]" />
                <button className="p-1 bg-slate-800 rounded text-slate-300"><Folder size={13} /></button>
              </div>
            )}

            {/* Port Settings Radio Matrix */}
            <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Select Active Hardware Port</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "usb" ? "bg-emerald-950/50 border-emerald-500/60 text-emerald-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
                  <input type="radio" name="port_setting" checked={selectedPort === "usb"} onChange={() => setSelectedPort("usb")} className="accent-emerald-500" />
                  <span className="flex items-center gap-1"><Usb size={12} /> Direct USB</span>
                </label>

                <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "tcpip" ? "bg-indigo-950/50 border-indigo-500/60 text-indigo-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
                  <input type="radio" name="port_setting" checked={selectedPort === "tcpip"} onChange={() => setSelectedPort("tcpip")} className="accent-indigo-500" />
                  <span className="flex items-center gap-1"><Wifi size={12} /> TCP/IP Net</span>
                </label>

                <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "parallel" ? "bg-amber-950/50 border-amber-500/60 text-amber-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
                  <input type="radio" name="port_setting" checked={selectedPort === "parallel"} onChange={() => setSelectedPort("parallel")} className="accent-amber-500" />
                  <span>Parallel LPT1</span>
                </label>

                <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "com1" ? "bg-purple-950/50 border-purple-500/60 text-purple-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
                  <input type="radio" name="port_setting" checked={selectedPort === "com1"} onChange={() => setSelectedPort("com1")} className="accent-purple-500" />
                  <span>COM 1 Port</span>
                </label>

                <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "com2" ? "bg-purple-950/50 border-purple-500/60 text-purple-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
                  <input type="radio" name="port_setting" checked={selectedPort === "com2"} onChange={() => setSelectedPort("com2")} className="accent-purple-500" />
                  <span>COM 2 Port</span>
                </label>

                <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "com3" ? "bg-purple-950/50 border-purple-500/60 text-purple-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
                  <input type="radio" name="port_setting" checked={selectedPort === "com3"} onChange={() => setSelectedPort("com3")} className="accent-purple-500" />
                  <span>COM 3 Port</span>
                </label>
              </div>
            </div>
          </div>

          {/* Option Mode (Data Source Selection) Card */}
          <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
            <span className="text-xs font-bold text-white uppercase block border-b border-slate-800 pb-2">
              Source Selection Criteria Option
            </span>

            <div className="space-y-1.5 text-xs font-mono">
              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-800/40">
                <input type="radio" name="opt_mode" checked={optionMode === "manual"} onChange={() => setOptionMode("manual")} className="accent-amber-500" />
                <span className="font-bold text-amber-300">Manual Selection</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-800/40">
                <input type="radio" name="opt_mode" checked={optionMode === "purchase_pt"} onChange={() => setOptionMode("purchase_pt")} className="accent-amber-500" />
                <span>Against Purchase (PT File / GRN)</span>
              </label>

              {optionMode === "purchase_pt" && (
                <div className="pl-6 pt-1 flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">PT File:</span>
                  <input type="text" value={piFileName} onChange={e => setPiFileName(e.target.value)} className="bg-[#0a0c14] border border-slate-800 rounded px-2 py-0.5 text-indigo-300 text-xs flex-1" />
                  <button className="p-1 bg-slate-800 rounded"><Folder size={12} /></button>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-800/40">
                <input type="radio" name="opt_mode" checked={optionMode === "transactions"} onChange={() => setOptionMode("transactions")} className="accent-amber-500" />
                <span>Against Transactions (Invoice/Transfer)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-800/40">
                <input type="radio" name="opt_mode" checked={optionMode === "purchase_order"} onChange={() => setOptionMode("purchase_order")} className="accent-amber-500" />
                <span>Against Purchase Order</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-800/40">
                <input type="radio" name="opt_mode" checked={optionMode === "masters"} onChange={() => setOptionMode("masters")} className="accent-amber-500" />
                <span>Against Item Masters</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-800/40">
                <input type="radio" name="opt_mode" checked={optionMode === "direct_scan"} onChange={() => setOptionMode("direct_scan")} className="accent-amber-500" />
                <span>Against Direct Barcode Scan</span>
              </label>
            </div>
          </div>

          {/* Labels to Print Strategy & Metrics Card */}
          <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
            <span className="text-xs font-bold text-white uppercase block border-b border-slate-800 pb-2">
              Labels To Print Strategy
            </span>

            <div className="flex items-center gap-6 text-xs font-bold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="labels_strat" checked={labelsStrategy === "specified"} onChange={() => setLabelsStrategy("specified")} className="accent-amber-500" />
                <span>Specified Quantity</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="labels_strat" checked={labelsStrategy === "stock"} onChange={() => setLabelsStrategy("stock")} className="accent-amber-500" />
                <span>Present Stock</span>
              </label>
            </div>

            <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[9px] text-slate-500 uppercase block font-bold">Total Records</span>
                <span className="text-sm font-bold text-amber-300">{totalRecords}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase block font-bold">Current Stock</span>
                <span className="text-sm font-bold text-indigo-300">{currentStockTotal}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase block font-bold">Labels To Print</span>
                <span className="text-sm font-bold text-emerald-400">{labelsToPrintTotal}</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── Right Column: Selection Criteria (From-To) & Item Inspection (Col Span 8) */}
        <div className="lg:col-span-8 space-y-4 flex flex-col">
          
          {/* Selection Criteria Range Boundaries (From - To) Table Card */}
          <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white uppercase flex items-center gap-2">
                <Sliders size={16} className="text-amber-400" />
                Selection Criteria Range Boundaries
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Filters active queue range from minimum to maximum</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-800 text-xs font-mono">
                <thead className="bg-[#0a0c14] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-2 border border-slate-800">Criteria Field</th>
                    <th className="p-2 border border-slate-800 text-center w-1/3">From Value</th>
                    <th className="p-2 border border-slate-800 text-center w-1/3">To Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {/* Stock No Range */}
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2 border border-slate-800 font-bold text-amber-300">Stock No. / SKU</td>
                    <td className="p-2 border border-slate-800">
                      <input type="text" value={criteria.stockNoFrom} onChange={e => setCriteria({ ...criteria, stockNoFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center font-bold text-amber-300 outline-none" />
                    </td>
                    <td className="p-2 border border-slate-800">
                      <input type="text" value={criteria.stockNoTo} onChange={e => setCriteria({ ...criteria, stockNoTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center font-bold text-amber-300 outline-none" />
                    </td>
                  </tr>

                  {/* Product / Category Range */}
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2 border border-slate-800 font-bold">Product / Category</td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.productFrom} onChange={e => setCriteria({ ...criteria, productFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {productsList.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.productTo} onChange={e => setCriteria({ ...criteria, productTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {productsList.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                  </tr>

                  {/* Brand Range */}
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2 border border-slate-800 font-bold">Brand</td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.brandFrom} onChange={e => setCriteria({ ...criteria, brandFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {brandsList.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.brandTo} onChange={e => setCriteria({ ...criteria, brandTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {brandsList.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </td>
                  </tr>

                  {/* Style Range */}
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2 border border-slate-800 font-bold">Style Code</td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.styleFrom} onChange={e => setCriteria({ ...criteria, styleFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.styleTo} onChange={e => setCriteria({ ...criteria, styleTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>

                  {/* Shade / Color Range */}
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2 border border-slate-800 font-bold">Shade / Color</td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.shadeFrom} onChange={e => setCriteria({ ...criteria, shadeFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {shadesList.map(sh => <option key={sh} value={sh}>{sh}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.shadeTo} onChange={e => setCriteria({ ...criteria, shadeTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {shadesList.map(sh => <option key={sh} value={sh}>{sh}</option>)}
                      </select>
                    </td>
                  </tr>

                  {/* Size Range */}
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2 border border-slate-800 font-bold">Size</td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.sizeFrom} onChange={e => setCriteria({ ...criteria, sizeFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {sizesList.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border border-slate-800">
                      <select value={criteria.sizeTo} onChange={e => setCriteria({ ...criteria, sizeTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                        {sizesList.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Item Inspection & Live Preview Card */}
          <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl flex-1 flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white uppercase flex items-center gap-2">
                <Eye size={16} className="text-indigo-400" />
                Selected Item Detail & Live 2D Tag Inspector
              </span>

              {filteredQueue.length > 0 && (
                <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-950/40 px-2.5 py-0.5 rounded border border-amber-500/30">
                  Item {activeItemIndex + 1} of {filteredQueue.length}
                </span>
              )}
            </div>

            {activeSelectedItem ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {/* Item Details Form View */}
                <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3 space-y-2 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-2 border-b border-slate-800 pb-2">
                    <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Stock No:</span><span className="text-amber-300 font-bold">{activeSelectedItem.stock_no || activeSelectedItem.item_code}</span></div>
                    <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Barcode:</span><span className="text-indigo-300 font-bold">{activeSelectedItem.barcode}</span></div>
                  </div>

                  <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Product Name:</span><span className="text-white font-bold truncate block">{activeSelectedItem.name}</span></div>

                  <div className="grid grid-cols-2 gap-2 border-t border-b border-slate-800 py-1.5">
                    <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Brand:</span><span className="text-slate-200">{activeSelectedItem.brand || "SMRITI"}</span></div>
                    <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Style:</span><span className="text-slate-200">{activeSelectedItem.style || "STYLE-01"}</span></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-b border-slate-800 pb-1.5">
                    <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Shade:</span><span className="text-slate-200">{activeSelectedItem.shade || activeSelectedItem.color || "Standard"}</span></div>
                    <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Size:</span><span className="text-slate-200">{activeSelectedItem.size || "34"}</span></div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <div><span className="text-[9px] text-slate-500 block uppercase font-bold">MRP:</span><span className="text-slate-400 line-through">₹{activeSelectedItem.mrp}</span></div>
                    <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Selling Price:</span><span className="text-emerald-400 font-bold text-sm">₹{activeSelectedItem.price}</span></div>
                  </div>
                </div>

                {/* Visual 2D Tag Preview & RAW PRN */}
                <div className="space-y-3 flex flex-col">
                  <div className="bg-[#08090e] border border-slate-800 rounded-xl p-3 flex items-center justify-center min-h-[130px]">
                    <div className="max-w-[220px] w-full">
                      <BarcodeLabel data={{ items: [{ name: activeSelectedItem.name, rate: activeSelectedItem.price || 0, barcode: activeSelectedItem.barcode }] }} />
                    </div>
                  </div>

                  <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-2.5 space-y-1 font-mono text-[10px]">
                    <span className="text-slate-400 font-bold uppercase block flex items-center gap-1">
                      <FileCode size={12} className="text-amber-400" />
                      Evaluated RAW Script Code ({activePrinter?.protocol || "ZPL"})
                    </span>
                    <pre className="text-amber-300 max-h-20 overflow-x-auto bg-black/60 p-2 rounded">
                      {evaluatedPRNPayload}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                No record matched selection criteria.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ── Bottom Control Action Bar ──────────────────────────────────────────── */}
      <div className="bg-[#141726] border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        {/* Navigation Controls: |< < > >| */}
        <div className="flex items-center gap-1 font-mono">
          <button onClick={handleFirst} disabled={filteredQueue.length === 0 || activeItemIndex === 0} className="px-3 py-2 bg-[#0a0c14] border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl font-bold disabled:opacity-30 text-xs flex items-center gap-1">
            <ChevronsLeft size={16} /> First
          </button>

          <button onClick={handlePrev} disabled={filteredQueue.length === 0 || activeItemIndex === 0} className="px-3 py-2 bg-[#0a0c14] border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl font-bold disabled:opacity-30 text-xs flex items-center gap-1">
            <ChevronLeft size={16} /> Previous
          </button>

          <span className="px-3 py-2 bg-[#0a0c14] border border-amber-500/30 text-amber-300 font-bold text-xs rounded-xl">
            {filteredQueue.length > 0 ? `${activeItemIndex + 1} / ${filteredQueue.length}` : "0 / 0"}
          </span>

          <button onClick={handleNext} disabled={filteredQueue.length === 0 || activeItemIndex >= filteredQueue.length - 1} className="px-3 py-2 bg-[#0a0c14] border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl font-bold disabled:opacity-30 text-xs flex items-center gap-1">
            Next <ChevronRight size={16} />
          </button>

          <button onClick={handleLast} disabled={filteredQueue.length === 0 || activeItemIndex >= filteredQueue.length - 1} className="px-3 py-2 bg-[#0a0c14] border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl font-bold disabled:opacity-30 text-xs flex items-center gap-1">
            Last <ChevronsRight size={16} />
          </button>
        </div>

        {/* Primary Action Buttons: OK, Print Selected, Print All, Clear */}
        <div className="flex items-center gap-3 font-mono">
          <button 
            onClick={handleClear} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 shadow-md"
          >
            <RotateCcw size={14} /> Clear Criteria
          </button>

          <button 
            onClick={handlePrintSelected} 
            disabled={!activeSelectedItem} 
            className="px-5 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg flex items-center gap-1.5 disabled:opacity-40"
          >
            <Printer size={15} /> Print Selected Tag
          </button>

          <button 
            onClick={handlePrintAll} 
            disabled={filteredQueue.length === 0} 
            className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-xl flex items-center gap-2 disabled:opacity-40"
          >
            <Play size={15} /> Print All ({labelsToPrintTotal} Tags)
          </button>
        </div>
      </div>

      {/* ── Hardware Printer Setup Modal ──────────────────────────────────────── */}
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
