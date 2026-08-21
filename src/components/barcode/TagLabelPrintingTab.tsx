/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.2.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Product } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  LabelPrintRow,
  LabelPrintSettings,
  SelectionCriteriaRange,
  PortType,
  LabelSourceOption,
  LabelQuantityMode
} from "./types.ts";
import { EditQuantityDetailsModal } from "./EditQuantityDetailsModal.tsx";
import { BarcodeScriptGenerationView } from "./BarcodeScriptGenerationView.tsx";
import { BarcodePrinterSelectModal } from "./BarcodePrinterSelectModal.tsx";
import { PurchaseProductBrowseModal } from "../purchase/PurchaseProductBrowseModal.tsx";
import { ThermalBarcodeSvg } from "./ThermalBarcodeSvg.tsx";
import { 
  Printer, 
  Search, 
  FileText, 
  Edit3, 
  Code, 
  Sliders, 
  Layers, 
  Check, 
  RotateCcw, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FolderOpen,
  Sparkles,
  Download,
  Copy,
  Eye,
  Info
} from "lucide-react";

interface TagLabelPrintingTabProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  onClose?: () => void;
}

export const TagLabelPrintingTab: React.FC<TagLabelPrintingTabProps> = ({
  products: initialProducts = [],
  currentUser,
  onNotification,
  onClose
}) => {
  const [activeView, setActiveView] = useState<"printing" | "designer">("printing");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [gridRows, setGridRows] = useState<LabelPrintRow[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number>(0);
  const [uniformBatchQty, setUniformBatchQty] = useState<number>(1);

  // Settings
  const [settings, setSettings] = useState<LabelPrintSettings>({
    scriptFileName: "C:\\SMRITI\\Barcode\\BarcodeScript_Honeywell_IH2.blf",
    labelsPerRow: 1,
    outputToPort: true,
    outputToFile: false,
    portSetting: "USB",
    sourceOption: "Manual Selection",
    piPdtFileName: "",
    quantityMode: "Specified Quantity",
    targetPrinterName: "IMPACT by Honeywell IH-2 (300 dpi) - DPL"
  });

  // Selection Criteria Ranges
  const [criteria, setCriteria] = useState<SelectionCriteriaRange>({
    stockNoFrom: "",
    stockNoTo: "",
    brandFrom: "",
    brandTo: "",
    productFrom: "",
    productTo: "",
    colourFrom: "",
    colourTo: "",
    styleFrom: "",
    styleTo: "",
    sizeFrom: "",
    sizeTo: ""
  });

  // Modals state
  const [isEditQtyModalOpen, setIsEditQtyModalOpen] = useState<boolean>(false);
  const [isPrinterSelectModalOpen, setIsPrinterSelectModalOpen] = useState<boolean>(false);
  const [isF2BrowseModalOpen, setIsF2BrowseModalOpen] = useState<boolean>(false);
  const [f2BrowseTarget, setF2BrowseTarget] = useState<"stockNoFrom" | "stockNoTo">("stockNoFrom");
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [isSinglePrintMode, setIsSinglePrintMode] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch products from backend if empty
  useEffect(() => {
    if (products.length === 0) {
      loadProducts();
    } else {
      populateGrid(products);
    }
  }, [initialProducts]);

  const loadProducts = async () => {
    try {
      const res = await apiFetchV1("/products");
      const list = Array.isArray(res) ? res : res?.items || [];
      if (list.length > 0) {
        setProducts(list);
        populateGrid(list);
      }
    } catch {
      // Fallback to sample items
      const sampleList: Product[] = [
        { id: "1", code: "000006", name: "Shirt", category: "Apparel", brand: "Beanstalk", color: "Ecru", styleCode: "BeeLine", size: "34", mrp: 1299, price: 999, stock: 12, barcode: "890100000006" },
        { id: "2", code: "000007", name: "Shirt", category: "Apparel", brand: "Beanstalk", color: "Ecru", styleCode: "BeeLine", size: "36", mrp: 1299, price: 999, stock: 15, barcode: "890100000007" },
        { id: "3", code: "000008", name: "Shirt", category: "Apparel", brand: "Beanstalk", color: "Ecru", styleCode: "BeeLine", size: "38", mrp: 1299, price: 999, stock: 8, barcode: "890100000008" },
        { id: "4", code: "000010", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "32", mrp: 1899, price: 1499, stock: 24, barcode: "890100000010" },
        { id: "5", code: "000011", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "34", mrp: 1899, price: 1499, stock: 18, barcode: "890100000011" },
        { id: "6", code: "000012", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "36", mrp: 1899, price: 1499, stock: 6, barcode: "890100000012" }
      ];
      setProducts(sampleList);
      populateGrid(sampleList);
    }
  };

  const populateGrid = (itemsList: Product[]) => {
    const rows: LabelPrintRow[] = itemsList.map((p, idx) => ({
      id: p.id || `row-${idx}`,
      sNo: idx + 1,
      stockNo: p.code || String(idx + 1).padStart(6, "0"),
      barcode: p.barcode || p.code || "",
      brand: p.brand || "SMRITI",
      product: p.name || p.category || "Item",
      colour: p.color || "-",
      style: p.styleCode || "-",
      size: p.size || "-",
      mrp: p.mrp || p.price || 0,
      sellingPrice: p.price || 0,
      currentStock: p.stock ?? 0,
      labelCount: 1,
      originalProduct: p
    }));
    setGridRows(rows);
  };

  // Distinct options for dropdown lists
  const uniqueBrands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products]);
  const uniqueProducts = useMemo(() => Array.from(new Set(products.map(p => p.name || p.category).filter(Boolean))), [products]);
  const uniqueColours = useMemo(() => Array.from(new Set(products.map(p => p.color).filter(Boolean))), [products]);
  const uniqueStyles = useMemo(() => Array.from(new Set(products.map(p => p.styleCode).filter(Boolean))), [products]);
  const uniqueSizes = useMemo(() => Array.from(new Set(products.map(p => p.size).filter(Boolean))), [products]);

  // Filtered rows matching selection criteria
  const filteredRows = useMemo(() => {
    return gridRows.filter(row => {
      if (criteria.stockNoFrom && row.stockNo < criteria.stockNoFrom) return false;
      if (criteria.stockNoTo && row.stockNo > criteria.stockNoTo) return false;
      if (criteria.brandFrom && row.brand < criteria.brandFrom) return false;
      if (criteria.brandTo && row.brand > criteria.brandTo) return false;
      if (criteria.productFrom && row.product < criteria.productFrom) return false;
      if (criteria.productTo && row.product > criteria.productTo) return false;
      if (criteria.colourFrom && row.colour < criteria.colourFrom) return false;
      if (criteria.colourTo && row.colour > criteria.colourTo) return false;
      if (criteria.styleFrom && row.style < criteria.styleFrom) return false;
      if (criteria.styleTo && row.style > criteria.styleTo) return false;
      if (criteria.sizeFrom && row.size < criteria.sizeFrom) return false;
      if (criteria.sizeTo && row.size > criteria.sizeTo) return false;
      return true;
    });
  }, [gridRows, criteria]);

  // Selected item for preview inspector
  const currentSelectedItem: LabelPrintRow | undefined = filteredRows[selectedPreviewIndex] || filteredRows[0];

  // Active list of items to print based on single vs batch mode
  const activePrintItems = useMemo(() => {
    if (isSinglePrintMode && currentSelectedItem) {
      return [{ ...currentSelectedItem, labelCount: Math.max(1, currentSelectedItem.labelCount) }];
    }
    return filteredRows.filter(r => r.labelCount > 0);
  }, [isSinglePrintMode, currentSelectedItem, filteredRows]);

  // Total labels in active print queue
  const activePrintTotalLabels = useMemo(() => {
    return activePrintItems.reduce((sum, r) => sum + r.labelCount, 0);
  }, [activePrintItems]);

  // Present Stock mode synchronization
  useEffect(() => {
    if (settings.quantityMode === "Present Stock") {
      setGridRows(prev => prev.map(r => ({ ...r, labelCount: Math.max(0, r.currentStock) })));
    }
  }, [settings.quantityMode]);

  // Summary counts
  const totalRecords = filteredRows.length;
  const currentStockSum = useMemo(() => filteredRows.reduce((sum, r) => sum + r.currentStock, 0), [filteredRows]);
  const labelsToPrintSum = useMemo(() => filteredRows.reduce((sum, r) => sum + r.labelCount, 0), [filteredRows]);

  // Apply batch uniform quantity
  const handleBatchQtyChange = (qty: number) => {
    const valid = isNaN(qty) ? 0 : Math.max(0, qty);
    setUniformBatchQty(valid);
    setGridRows(prev => prev.map(r => {
      const isMatched = filteredRows.some(fr => fr.id === r.id);
      return isMatched ? { ...r, labelCount: valid } : r;
    }));
  };

  const handleOpenF2Browse = (target: "stockNoFrom" | "stockNoTo") => {
    setF2BrowseTarget(target);
    setIsF2BrowseModalOpen(true);
  };

  const handleSelectF2Product = (prod: Product) => {
    if (f2BrowseTarget === "stockNoFrom") {
      setCriteria(prev => ({ ...prev, stockNoFrom: prod.code || "" }));
    } else {
      setCriteria(prev => ({ ...prev, stockNoTo: prod.code || "" }));
    }
    setIsF2BrowseModalOpen(false);
  };

  // OK Button Click Handler
  const handleOkButtonClick = () => {
    setSelectedPreviewIndex(0);
    if (settings.scriptFileName.toLowerCase().endsWith(".blf")) {
      setIsPrinterSelectModalOpen(true);
    } else {
      onNotification?.("Criteria Applied", `Loaded ${filteredRows.length} item(s) in preview.`, "success");
    }
  };

  // Clear button handler
  const handleClearAll = () => {
    setCriteria({
      stockNoFrom: "",
      stockNoTo: "",
      brandFrom: "",
      brandTo: "",
      productFrom: "",
      productTo: "",
      colourFrom: "",
      colourTo: "",
      styleFrom: "",
      styleTo: "",
      sizeFrom: "",
      sizeTo: ""
    });
    setSelectedPreviewIndex(0);
    setUniformBatchQty(1);
    setGridRows(prev => prev.map(r => ({ ...r, labelCount: 1 })));
    onNotification?.("Session Cleared", "Reset selection criteria and label quantities.", "success");
  };

  // Print Single Item Trigger
  const handlePrintSingle = () => {
    if (!currentSelectedItem || currentSelectedItem.labelCount === 0) {
      alert("Selected item has quantity 0. Please specify at least 1 label to print.");
      return;
    }
    setIsSinglePrintMode(true);
    setShowDispatchModal(true);
  };

  // Print All Items Trigger
  const handlePrintAll = () => {
    const validCount = filteredRows.filter(r => r.labelCount > 0);
    if (validCount.length === 0) {
      alert("No items in criteria have label quantity greater than 0 to print.");
      return;
    }
    setIsSinglePrintMode(false);
    setShowDispatchModal(true);
  };

  // Trigger Browser Print for Formatted Labels
  const handleBrowserPrint = () => {
    setShowDispatchModal(false);
    setTimeout(() => {
      window.print();
      onNotification?.("Print Dispatched", `Sent ${activePrintTotalLabels} label(s) to Windows print queue.`, "success");
    }, 150);
  };

  // Generate Raw DPL / PRN Script for Honeywell IH-2
  const generateRawDplScript = () => {
    let script = "\x02L\nD11\n"; // DPL Label format start
    activePrintItems.forEach(item => {
      for (let i = 0; i < item.labelCount; i++) {
        script += `191100000200020${item.brand}\n`;
        script += `191100000500020${item.product} - ${item.style}\n`;
        script += `191100000800020Shade: ${item.colour}  Size: ${item.size}\n`;
        script += `1e4202001100020${item.barcode || item.stockNo}\n`;
        script += `191100001500020MRP: Rs. ${item.mrp}  SP: Rs. ${item.sellingPrice}\n`;
        script += "E\n"; // Print single label
      }
    });
    return script;
  };

  const handleDownloadDplScript = () => {
    const content = generateRawDplScript();
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Honeywell_IH2_Labels_${Date.now()}.prn`;
    a.click();
    URL.revokeObjectURL(a);
    onNotification?.("File Downloaded", "Downloaded raw PRN script for Honeywell IH-2.", "success");
  };

  const handleCopyDplScript = () => {
    navigator.clipboard.writeText(generateRawDplScript());
    onNotification?.("Copied", "Copied raw DPL script commands to clipboard.", "success");
  };

  // Global F2 Keyboard Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setIsEditQtyModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (activeView === "designer") {
    return (
      <BarcodeScriptGenerationView
        onBackToPrinting={() => setActiveView("printing")}
        onNotification={onNotification}
      />
    );
  }

  return (
    <div className="bg-[#fbf8fb] text-[#1b1b1e] font-sans h-full flex flex-col antialiased select-none overflow-hidden">
      
      {/* 
        Printable Barcode Container (Visible ONLY during window.print())
        Formats each label cleanly as 50mm x 25mm thermal roll stickers
      */}
      <div id="smriti-barcode-printable-area" className="hidden print:block bg-white text-black font-sans">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            #smriti-barcode-printable-area, #smriti-barcode-printable-area * { visibility: visible !important; }
            #smriti-barcode-printable-area {
              display: block !important;
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 50mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            .thermal-label-page {
              width: 50mm !important;
              height: 25mm !important;
              max-height: 25mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              padding: 1.5mm 2mm !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              overflow: hidden !important;
              border: none !important;
            }
            @page {
              size: 50mm 25mm;
              margin: 0;
            }
          }
        `}} />
        
        {activePrintItems.map(item => {
          const copies = Array.from({ length: Math.max(1, item.labelCount) });
          return copies.map((_, copyIdx) => (
            <div key={`${item.id}-copy-${copyIdx}`} className="thermal-label-page text-black bg-white">
              {/* Brand & Price Header */}
              <div className="flex justify-between items-center border-b border-black/30 pb-0.5 leading-none">
                <span className="font-extrabold text-[9px] uppercase tracking-wide truncate max-w-[28mm]">
                  {item.brand || "SMRITI RETAIL"}
                </span>
                <span className="font-mono font-bold text-[10px]">
                  ₹{item.sellingPrice || item.mrp}
                </span>
              </div>

              {/* Product & Style Details */}
              <div className="text-[8px] font-semibold truncate leading-tight my-0.5">
                <span>{item.product}</span>
                <span className="text-[7.5px] text-gray-700 ml-1">({item.style})</span>
              </div>

              {/* Barcode Graphic */}
              <div className="w-full flex justify-center py-0.5">
                <ThermalBarcodeSvg
                  value={item.barcode || item.stockNo}
                  widthMm={44}
                  heightMm={10}
                  showText={true}
                />
              </div>

              {/* Footer Attributes: Shade, Size & MRP */}
              <div className="flex justify-between items-center text-[7.5px] font-mono leading-none border-t border-black/30 pt-0.5">
                <span>{item.colour} / S:{item.size}</span>
                <span className="font-semibold text-[7px] text-gray-600">MRP: ₹{item.mrp}</span>
              </div>
            </div>
          ));
        })}
      </div>

      {/* Top Application Bar */}
      <header className="h-12 border-b border-[#c5c6ce] bg-[#efedf0] flex justify-between items-center px-4 shrink-0 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[#041632] font-bold text-sm">
            <Printer size={18} className="text-[#3e5f90]" />
            <span>Tag &amp; Barcode Label Printing</span>
            <span className="text-[10px] bg-[#d7e2ff] text-[#041632] px-2 py-0.5 rounded font-mono font-bold ml-2">
              SMRITI Professional Terminal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPrinterSelectModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-[#eae7ea] text-[#041632] border border-[#c5c6ce] rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <Printer size={14} className="text-[#3e5f90]" />
            <span className="truncate max-w-[200px]">{settings.targetPrinterName || "Printer Config"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("designer")}
            className="px-3 py-1.5 bg-[#eae7ea] hover:bg-[#dbd9dc] text-[#041632] border border-[#c5c6ce] rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <Code size={14} className="text-[#3e5f90]" />
            <span>Script Generation / Designer</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame (12-Column Industrial Grid) */}
      <main className="flex-1 p-4 overflow-y-auto bg-[#fbf8fb] print:hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Left Column (4 cols): Parameters, Option & Quantities */}
          <div className="lg:col-span-4 flex flex-col gap-3.5">
            
            {/* 1. Label Printing Parameters Card */}
            <section className="bg-white border border-[#c5c6ce] rounded-lg p-3.5 shadow-xs space-y-3">
              <h2 className="text-xs font-bold text-[#041632] uppercase tracking-wider border-b border-[#c5c6ce] pb-1.5 flex items-center gap-1.5">
                <Sliders size={14} className="text-[#3e5f90]" />
                Label Printing Parameters
              </h2>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#44474d] block">Script File Name</label>
                <div className="flex">
                  <input
                    type="text"
                    value={settings.scriptFileName}
                    onChange={e => setSettings({ ...settings, scriptFileName: e.target.value })}
                    className="flex-1 border border-[#75777e] rounded-l px-2 py-1 text-xs font-mono bg-white outline-none focus:border-[#3e5f90]"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#efedf0] border-y border-r border-[#75777e] text-[#1b1b1e] px-2.5 rounded-r hover:bg-[#eae7ea] text-xs font-bold"
                  >
                    ...
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".t,.blf,.prn,.zpl,.tspl,.txt"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setSettings({ ...settings, scriptFileName: file.name });
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="text-[11px] font-semibold text-[#44474d] block mb-1">Labels Per Row</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={settings.labelsPerRow}
                    onChange={e => setSettings({ ...settings, labelsPerRow: parseInt(e.target.value) || 1 })}
                    className="w-full text-center border border-[#75777e] rounded py-1 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#44474d] block mb-1">Target Port</label>
                  <select
                    value={settings.portSetting}
                    onChange={e => setSettings({ ...settings, portSetting: e.target.value as any })}
                    className="w-full border border-[#75777e] rounded p-1 text-xs font-semibold bg-white"
                  >
                    <option value="USB">USB Direct</option>
                    <option value="COM 1">COM 1</option>
                    <option value="COM 2">COM 2</option>
                    <option value="Network TCP/IP">Network TCP/IP</option>
                    <option value="QZ Tray Thermal">QZ Tray</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.outputToPort}
                    onChange={e => setSettings({ ...settings, outputToPort: e.target.checked })}
                    className="text-[#3e5f90]"
                  />
                  <span>Output to Port</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.outputToFile}
                    onChange={e => setSettings({ ...settings, outputToFile: e.target.checked })}
                    className="text-[#3e5f90]"
                  />
                  <span>Output to File</span>
                </label>
              </div>
            </section>

            {/* 2. Label Source Option Card */}
            <section className="bg-white border border-[#c5c6ce] rounded-lg p-3.5 shadow-xs space-y-2 text-xs">
              <h2 className="text-xs font-bold text-[#041632] uppercase tracking-wider border-b border-[#c5c6ce] pb-1.5 flex items-center gap-1.5">
                <Layers size={14} className="text-[#3e5f90]" />
                Option / Source
              </h2>

              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
                {(
                  [
                    "Manual Selection",
                    "Against Masters",
                    "Against Direct Scan",
                    "Against Purchase (PT File)",
                    "Against Transactions",
                    "Against Purchase Order",
                    "Against PDT File"
                  ] as LabelSourceOption[]
                ).map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="sourceOption"
                      checked={settings.sourceOption === opt}
                      onChange={() => setSettings({ ...settings, sourceOption: opt })}
                      className="text-[#3e5f90]"
                    />
                    <span className="text-[11px] truncate">{opt}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* 3. Labels to Print Summary Card */}
            <section className="bg-white border border-[#c5c6ce] rounded-lg p-3.5 shadow-xs space-y-3 text-xs">
              <h2 className="text-xs font-bold text-[#041632] uppercase tracking-wider border-b border-[#c5c6ce] pb-1.5 flex items-center gap-1.5">
                <FileText size={14} className="text-[#3e5f90]" />
                Print Quantities
              </h2>

              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="qtyMode"
                    checked={settings.quantityMode === "Specified Quantity"}
                    onChange={() => setSettings({ ...settings, quantityMode: "Specified Quantity" })}
                    className="text-[#3e5f90]"
                  />
                  <span>Specified Quantity</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium" title="Present Stock option (available at store branch)">
                  <input
                    type="radio"
                    name="qtyMode"
                    checked={settings.quantityMode === "Present Stock"}
                    onChange={() => setSettings({ ...settings, quantityMode: "Present Stock" })}
                    className="text-[#3e5f90]"
                  />
                  <span>Present Stock</span>
                </label>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[#44474d] text-xs">Total Records:</span>
                  <input
                    type="text"
                    readOnly
                    value={totalRecords}
                    className="w-24 text-right bg-[#efedf0] border border-[#c5c6ce] rounded px-2 py-0.5 font-mono font-bold"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#44474d] text-xs">Current Stock:</span>
                  <input
                    type="text"
                    readOnly
                    value={currentStockSum}
                    className="w-24 text-right bg-[#efedf0] border border-[#c5c6ce] rounded px-2 py-0.5 font-mono font-bold"
                  />
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-[#c5c6ce]">
                  <div className="flex items-center gap-1">
                    <span className="text-[#041632] font-bold text-xs">Labels to Print:</span>
                    <button
                      type="button"
                      onClick={() => setIsEditQtyModalOpen(true)}
                      title="Edit Quantity Details per item (F2)"
                      className="p-0.5 text-[#3e5f90] hover:bg-[#d7e2ff] rounded"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={uniformBatchQty}
                      onChange={e => handleBatchQtyChange(parseInt(e.target.value) || 0)}
                      title="Batch quantity (press F2 for detailed per-item editing)"
                      className="w-24 text-right bg-[#d7e2ff] text-[#041632] border-2 border-[#3e5f90] rounded px-2 py-1 font-mono font-bold text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* Right Column (8 cols): Criteria Range & Selected Item Preview */}
          <div className="lg:col-span-8 flex flex-col gap-3.5">
            
            {/* Selection Criteria Range Card */}
            <section className="bg-white border border-[#c5c6ce] rounded-lg p-4 shadow-xs text-xs space-y-2.5 flex-1">
              <div className="grid grid-cols-[110px_1fr_1fr] gap-3 pb-1 border-b border-[#c5c6ce] text-[#041632] font-bold text-xs items-center">
                <span>Selection Criteria</span>
                <span className="text-center text-[10px] uppercase tracking-wider text-[#44474d]">From</span>
                <span className="text-center text-[10px] uppercase tracking-wider text-[#44474d]">To</span>
              </div>

              {/* Row 1: Stock No with F2 Browse */}
              <div className="grid grid-cols-[110px_1fr_1fr] gap-3 items-center">
                <div className="flex items-center justify-between pr-2">
                  <label className="font-bold text-[#041632]">Stock No.</label>
                  <span className="text-[9px] bg-[#efedf0] px-1 rounded font-mono text-[#44474d]">F2</span>
                </div>
                <div className="flex">
                  <input
                    type="text"
                    value={criteria.stockNoFrom}
                    onChange={e => setCriteria({ ...criteria, stockNoFrom: e.target.value })}
                    placeholder="From SKU..."
                    className="w-full border border-[#75777e] rounded-l px-2 py-1 font-mono bg-[#fbf8fb] focus:bg-white text-xs outline-none focus:border-[#3e5f90]"
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenF2Browse("stockNoFrom")}
                    title="Browse Product Masters (F2)"
                    className="bg-[#efedf0] border-y border-r border-[#75777e] px-2 rounded-r hover:bg-[#eae7ea] font-mono text-[11px] font-bold"
                  >
                    F2
                  </button>
                </div>
                <div className="flex">
                  <input
                    type="text"
                    value={criteria.stockNoTo}
                    onChange={e => setCriteria({ ...criteria, stockNoTo: e.target.value })}
                    placeholder="To SKU..."
                    className="w-full border border-[#75777e] rounded-l px-2 py-1 font-mono bg-[#fbf8fb] focus:bg-white text-xs outline-none focus:border-[#3e5f90]"
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenF2Browse("stockNoTo")}
                    title="Browse Product Masters (F2)"
                    className="bg-[#efedf0] border-y border-r border-[#75777e] px-2 rounded-r hover:bg-[#eae7ea] font-mono text-[11px] font-bold"
                  >
                    F2
                  </button>
                </div>
              </div>

              {/* Row 2: Product */}
              <div className="grid grid-cols-[110px_1fr_1fr] gap-3 items-center">
                <label className="font-semibold text-[#44474d]">Product</label>
                <select
                  value={criteria.productFrom}
                  onChange={e => setCriteria({ ...criteria, productFrom: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Products)</option>
                  {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={criteria.productTo}
                  onChange={e => setCriteria({ ...criteria, productTo: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Products)</option>
                  {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Row 3: Brand */}
              <div className="grid grid-cols-[110px_1fr_1fr] gap-3 items-center">
                <label className="font-semibold text-[#44474d]">Brand</label>
                <select
                  value={criteria.brandFrom}
                  onChange={e => setCriteria({ ...criteria, brandFrom: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Brands)</option>
                  {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select
                  value={criteria.brandTo}
                  onChange={e => setCriteria({ ...criteria, brandTo: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Brands)</option>
                  {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* Row 4: Style */}
              <div className="grid grid-cols-[110px_1fr_1fr] gap-3 items-center">
                <label className="font-semibold text-[#44474d]">Style</label>
                <select
                  value={criteria.styleFrom}
                  onChange={e => setCriteria({ ...criteria, styleFrom: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Styles)</option>
                  {uniqueStyles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={criteria.styleTo}
                  onChange={e => setCriteria({ ...criteria, styleTo: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Styles)</option>
                  {uniqueStyles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Row 5: Shade */}
              <div className="grid grid-cols-[110px_1fr_1fr] gap-3 items-center">
                <label className="font-semibold text-[#44474d]">Shade / Colour</label>
                <select
                  value={criteria.colourFrom}
                  onChange={e => setCriteria({ ...criteria, colourFrom: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Shades)</option>
                  {uniqueColours.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={criteria.colourTo}
                  onChange={e => setCriteria({ ...criteria, colourTo: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Shades)</option>
                  {uniqueColours.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Row 6: Size */}
              <div className="grid grid-cols-[110px_1fr_1fr] gap-3 items-center">
                <label className="font-semibold text-[#44474d]">Size</label>
                <select
                  value={criteria.sizeFrom}
                  onChange={e => setCriteria({ ...criteria, sizeFrom: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Sizes)</option>
                  {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={criteria.sizeTo}
                  onChange={e => setCriteria({ ...criteria, sizeTo: e.target.value })}
                  className="border border-[#75777e] rounded p-1 bg-white"
                >
                  <option value="">(All Sizes)</option>
                  {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </section>

            {/* Selected Item Preview Card */}
            <section className="bg-white border border-[#c5c6ce] rounded-lg p-4 shadow-xs text-xs space-y-3">
              <div className="flex justify-between items-center border-b border-[#c5c6ce] pb-2">
                <h2 className="text-xs font-bold text-[#041632] uppercase tracking-wider flex items-center gap-1.5">
                  <Eye size={14} className="text-[#3e5f90]" />
                  Selected Item Preview
                </h2>
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#44474d]">
                  <span>Item {filteredRows.length > 0 ? selectedPreviewIndex + 1 : 0} of {filteredRows.length}</span>
                </div>
              </div>

              {currentSelectedItem ? (
                <div className="grid grid-cols-[110px_1fr] gap-y-2 gap-x-3 items-center">
                  <label className="text-[10px] font-bold uppercase text-[#44474d]">Stock No.</label>
                  <div className="p-1.5 px-3 bg-[#efedf0] rounded font-mono font-bold text-xs text-[#041632]">
                    {currentSelectedItem.stockNo} {currentSelectedItem.barcode ? `• Barcode: ${currentSelectedItem.barcode}` : ""}
                  </div>

                  <label className="text-[10px] font-bold uppercase text-[#44474d]">Product</label>
                  <div className="p-1.5 px-3 bg-[#efedf0] rounded font-semibold text-xs text-[#041632]">
                    {currentSelectedItem.product}
                  </div>

                  <label className="text-[10px] font-bold uppercase text-[#44474d]">Brand</label>
                  <div className="p-1.5 px-3 bg-[#efedf0] rounded font-semibold text-xs text-[#041632]">
                    {currentSelectedItem.brand}
                  </div>

                  <label className="text-[10px] font-bold uppercase text-[#44474d]">Style</label>
                  <div className="p-1.5 px-3 bg-[#efedf0] rounded font-semibold text-xs text-[#041632]">
                    {currentSelectedItem.style}
                  </div>

                  <label className="text-[10px] font-bold uppercase text-[#44474d]">Shade &amp; Size</label>
                  <div className="flex gap-3">
                    <div className="p-1.5 px-3 bg-[#efedf0] rounded font-semibold text-xs text-[#041632] flex-1">
                      {currentSelectedItem.colour}
                    </div>
                    <div className="p-1.5 px-3 bg-[#efedf0] rounded font-mono font-bold text-xs text-[#041632] w-24 text-center">
                      Size: {currentSelectedItem.size}
                    </div>
                    <div className="p-1.5 px-3 bg-[#d7e2ff] border border-[#8393b5] rounded font-mono font-bold text-xs text-[#041632] w-28 text-center">
                      # Lbls: {currentSelectedItem.labelCount}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-[#75777e] italic">
                  No items match the specified selection criteria.
                </div>
              )}
            </section>

          </div>

        </div>

        {/* Sticky Action Bar */}
        <div className="sticky bottom-0 bg-white border border-[#c5c6ce] rounded-lg p-3 mt-4 flex flex-wrap justify-between items-center shadow-lg gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOkButtonClick}
              className="bg-[#041632] hover:bg-[#1b2b48] text-white px-6 py-2 rounded text-xs font-bold transition shadow-sm"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setIsEditQtyModalOpen(true)}
              className="bg-[#eae7ea] hover:bg-[#dbd9dc] text-[#041632] border border-[#c5c6ce] px-4 py-2 rounded text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Edit3 size={14} className="text-[#3e5f90]" />
              <span>Edit Qty (F2)</span>
            </button>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={selectedPreviewIndex <= 0}
              onClick={() => setSelectedPreviewIndex(0)}
              className="p-1.5 bg-[#efedf0] hover:bg-[#eae7ea] border border-[#c5c6ce] rounded disabled:opacity-30 transition"
              title="First Item"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              disabled={selectedPreviewIndex <= 0}
              onClick={() => setSelectedPreviewIndex(p => Math.max(0, p - 1))}
              className="p-1.5 bg-[#efedf0] hover:bg-[#eae7ea] border border-[#c5c6ce] rounded disabled:opacity-30 transition"
              title="Previous Item"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-mono text-xs font-bold px-3 py-1 bg-[#efedf0] border border-[#c5c6ce] rounded">
              {filteredRows.length > 0 ? selectedPreviewIndex + 1 : 0} / {filteredRows.length}
            </span>
            <button
              type="button"
              disabled={selectedPreviewIndex >= filteredRows.length - 1}
              onClick={() => setSelectedPreviewIndex(p => Math.min(filteredRows.length - 1, p + 1))}
              className="p-1.5 bg-[#efedf0] hover:bg-[#eae7ea] border border-[#c5c6ce] rounded disabled:opacity-30 transition"
              title="Next Item"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              disabled={selectedPreviewIndex >= filteredRows.length - 1}
              onClick={() => setSelectedPreviewIndex(filteredRows.length - 1)}
              className="p-1.5 bg-[#efedf0] hover:bg-[#eae7ea] border border-[#c5c6ce] rounded disabled:opacity-30 transition"
              title="Last Item"
            >
              <ChevronsRight size={16} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintSingle}
              className="px-4 py-2 border border-[#75777e] hover:bg-[#eae7ea] text-[#041632] rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <Printer size={14} className="text-[#3e5f90]" />
              Print Single ({currentSelectedItem?.labelCount || 1})
            </button>
            <button
              type="button"
              onClick={handlePrintAll}
              className="px-5 py-2 bg-[#3e5f90] hover:bg-[#315384] text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer size={14} />
              Print All ({labelsToPrintSum})
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-4 py-2 border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6] rounded text-xs font-semibold flex items-center gap-1 transition"
            >
              <RotateCcw size={14} />
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#c5c6ce] hover:bg-[#eae7ea] text-[#1b1b1e] rounded text-xs font-semibold flex items-center gap-1 transition"
            >
              <LogOut size={14} />
              Exit
            </button>
          </div>
        </div>
      </main>

      {/* Footer Hotkey & Status Bar */}
      <footer className="bg-[#efedf0] border-t border-[#c5c6ce] h-8 flex justify-between items-center px-4 shrink-0 text-xs text-[#44474d] font-mono text-[11px] print:hidden">
        <div className="flex items-center gap-4">
          <span><strong className="text-[#041632]">F2</strong> Browse Stock / Edit Quantity</span>
          <span>•</span>
          <span>Target: <strong className="text-[#041632]">{settings.targetPrinterName}</strong></span>
          <span>•</span>
          <span>Port: <strong className="text-[#041632]">{settings.portSetting}</strong></span>
        </div>
        <div>
          <span>{totalRecords} items matched ({labelsToPrintSum} labels in queue)</span>
        </div>
      </footer>

      {/* Edit Quantity Details Modal */}
      <EditQuantityDetailsModal
        isOpen={isEditQtyModalOpen}
        rows={filteredRows}
        onClose={() => setIsEditQtyModalOpen(false)}
        onSave={(updatedRows) => {
          setGridRows(prev => prev.map(r => {
            const found = updatedRows.find(ur => ur.id === r.id);
            return found ? { ...r, labelCount: found.labelCount } : r;
          }));
          onNotification?.("Quantities Updated", "Updated label print counts per item.", "success");
        }}
      />

      {/* Barcode Printer Select Modal */}
      <BarcodePrinterSelectModal
        isOpen={isPrinterSelectModalOpen}
        currentPort={settings.portSetting}
        scriptFileName={settings.scriptFileName}
        onClose={() => setIsPrinterSelectModalOpen(false)}
        onConfirm={(cfg) => {
          setSettings(prev => ({
            ...prev,
            portSetting: cfg.portType,
            targetPrinterName: cfg.printerName
          }));
          onNotification?.("Printer Configured", `Target set to ${cfg.printerName} (${cfg.portType})`, "success");
        }}
      />

      {/* F2 Product Browse Modal */}
      <PurchaseProductBrowseModal
        products={products}
        isOpen={isF2BrowseModalOpen}
        onClose={() => setIsF2BrowseModalOpen(false)}
        onSelectProduct={handleSelectF2Product}
      />

      {/* Visual Thermal Label Print Preview & Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 print:hidden font-sans">
          <div className="bg-[#fbf8fb] text-[#1b1b1e] rounded-xl border border-[#c5c6ce] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-3.5 bg-[#041632] text-white flex justify-between items-center">
              <span className="font-bold text-sm flex items-center gap-2">
                <Printer size={16} />
                Thermal Barcode Print Dispatch &amp; Live Preview
              </span>
              <button type="button" onClick={() => setShowDispatchModal(false)} className="text-white hover:opacity-80">
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs bg-white overflow-y-auto">
              
              {/* Target Printer Banner */}
              <div className="bg-[#efedf0] p-3.5 rounded-lg border border-[#c5c6ce] flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-[#041632] flex items-center gap-1.5">
                    <Printer size={15} className="text-[#3e5f90]" />
                    <span>{settings.targetPrinterName}</span>
                  </div>
                  <div className="text-[11px] text-[#44474d] mt-0.5">
                    Format: 50mm x 25mm Thermal Roll • Port: {settings.portSetting}
                  </div>
                </div>
                <div className="bg-[#041632] text-white px-3.5 py-1.5 rounded-lg font-mono font-bold text-sm shadow-xs">
                  {activePrintTotalLabels} {activePrintTotalLabels === 1 ? "Label" : "Labels"}
                </div>
              </div>

              {/* Live Thermal Label Sticker Preview */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#041632] uppercase tracking-wider text-[10px]">
                    Live Thermal Sticker Preview (Exact 50mm x 25mm Aspect Ratio)
                  </span>
                  <span className="text-[10px] font-mono text-[#75777e]">300 DPI Rendering</span>
                </div>
                
                {activePrintItems.length > 0 && (
                  <div className="flex items-center justify-center p-4 bg-[#f5f3f6] border border-[#c5c6ce] rounded-lg">
                    {/* Simulated 50mm x 25mm physical thermal label sticker */}
                    <div className="w-[60mm] h-[30mm] bg-white text-black p-2 rounded shadow-md border border-gray-300 flex flex-col justify-between select-none">
                      <div className="flex justify-between items-center border-b border-black/30 pb-0.5 leading-none">
                        <span className="font-extrabold text-[9px] uppercase tracking-wide truncate max-w-[34mm]">
                          {activePrintItems[0].brand || "SMRITI RETAIL"}
                        </span>
                        <span className="font-mono font-bold text-[10px]">
                          ₹{activePrintItems[0].sellingPrice || activePrintItems[0].mrp}
                        </span>
                      </div>

                      <div className="text-[8px] font-semibold truncate leading-tight my-0.5">
                        <span>{activePrintItems[0].product}</span>
                        <span className="text-[7.5px] text-gray-700 ml-1">({activePrintItems[0].style})</span>
                      </div>

                      <div className="w-full flex justify-center py-0.5">
                        <ThermalBarcodeSvg
                          value={activePrintItems[0].barcode || activePrintItems[0].stockNo}
                          widthMm={50}
                          heightMm={10}
                          showText={true}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[7.5px] font-mono leading-none border-t border-black/30 pt-0.5">
                        <span>{activePrintItems[0].colour} / S:{activePrintItems[0].size}</span>
                        <span className="font-semibold text-[7px] text-gray-600">MRP: ₹{activePrintItems[0].mrp}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Print Manifest Items */}
              <div className="max-h-36 overflow-y-auto border border-[#c5c6ce] rounded-lg bg-[#fbf8fb] p-2.5 space-y-1">
                <span className="font-bold text-[#44474d] text-[11px] block">Batch Items in Print Queue:</span>
                {activePrintItems.map(r => (
                  <div key={r.id} className="flex justify-between items-center py-1 border-b border-[#c5c6ce]/30 font-mono text-[11px]">
                    <span>{r.stockNo} - {r.product} ({r.colour}/{r.size})</span>
                    <span className="font-bold text-[#041632] bg-[#d7e2ff] px-2 py-0.5 rounded">
                      {r.labelCount} {r.labelCount === 1 ? "label" : "labels"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Instructions Tip */}
              <div className="bg-[#e9edff] border border-[#8393b5]/40 rounded-lg p-3 flex items-start gap-2.5 text-[#041632]">
                <Info size={16} className="text-[#3e5f90] shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Printing to Honeywell IH-2 (300 dpi):</strong> When clicking <strong>"Print from Browser"</strong>, make sure to select <strong>"IMPACT by Honeywell IH-2 (300 dpi) - DPL"</strong> in the browser printer destination and verify that "Pause Printing" is unchecked in Windows.
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="px-6 py-3.5 border-t border-[#c5c6ce] bg-[#efedf0] flex flex-wrap justify-between items-center gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDplScript}
                  title="Download raw PRN/DPL script file"
                  className="px-3 py-1.5 bg-white border border-[#c5c6ce] hover:bg-[#eae7ea] rounded text-xs font-semibold flex items-center gap-1.5 text-[#041632]"
                >
                  <Download size={13} />
                  <span>Download PRN</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyDplScript}
                  title="Copy raw DPL commands"
                  className="px-3 py-1.5 bg-white border border-[#c5c6ce] hover:bg-[#eae7ea] rounded text-xs font-semibold flex items-center gap-1.5 text-[#041632]"
                >
                  <Copy size={13} />
                  <span>Copy DPL</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-1.5 border border-[#75777e] rounded text-[#041632] font-semibold hover:bg-[#eae7ea]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="px-6 py-1.5 bg-[#041632] text-white rounded font-bold hover:bg-[#1b2b48] transition shadow flex items-center gap-1.5 text-xs"
                >
                  <Printer size={14} />
                  Print from Browser ({activePrintTotalLabels})
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default TagLabelPrintingTab;
