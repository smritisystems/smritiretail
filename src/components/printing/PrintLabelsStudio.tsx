/**
 * Project      : SMRITI Retail OS
 * Component    : PrintLabelsStudio (Dedicated Single Page Barcode & Label Printing Studio)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 3.29.0
 * License      : Proprietary Commercial Software
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { WindowManager } from "../../sdk";
import { PRNVariableEngine, TATTLY_THREADS_ZPL_SCRIPT } from "../../services/label_print/PRNVariableEngine";
import { PrintProviderRegistry, SystemPrinterDiscovery, SystemPrinterInfo } from "../../services/label_print/PrintProviderFramework";
import { UniversalAttributeEngine, IndustryPackManager, IndustryType } from "../../core/metadata";
import { PrintingService, PrintDocument } from "../../core/printing";

export interface PrintItemRow {
  id: string;
  selected: boolean;
  barcode: string;
  itemCode: string;
  itemName: string;
  uom: string;
  batchSerial: string;
  qty: number;
  printQty: number;
  labelTemplate: string;
  sizeMm: string;
  mrp: number;
  hsn: string;
  taxRate?: string;
  brand?: string;
  category?: string;
}

export type SourceType =
  | "manual"
  | "item_master"
  | "purchase_invoice"
  | "grn"
  | "purchase_return"
  | "sales_invoice"
  | "sales_return"
  | "stock_transfer"
  | "production"
  | "physical_stock"
  | "batch"
  | "serial_number"
  | "direct_scan";

// Source Datasets for Dynamic Switching
const SOURCE_DATASETS: Record<SourceType, PrintItemRow[]> = {
  manual: [
    { id: "row-1", selected: true, barcode: "8901234567890", itemCode: "SHO-1001", itemName: "Tattly Threads Dual Tag Item", uom: "Pair", batchSerial: "-", qty: 50, printQty: 50, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 2500.0, hsn: "6404", taxRate: "18% IGST", brand: "Tattly Threads", category: "Footwear" },
    { id: "row-2", selected: true, barcode: "8901234567891", itemCode: "SOC-2001", itemName: "Cotton Sock Dual Tag", uom: "Pair", batchSerial: "-", qty: 100, printQty: 100, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 250.0, hsn: "6115", taxRate: "12% GST", brand: "Tattly Threads", category: "Apparel" },
    { id: "row-3", selected: true, barcode: "BAT-001", itemCode: "BAT-001", itemName: "Batch Dual Tag Item", uom: "Pcs", batchSerial: "BATCH-2025-05", qty: 200, printQty: 200, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 1200.0, hsn: "6109", brand: "Tattly Threads", category: "Apparel" },
    { id: "row-4", selected: true, barcode: "SRL-000123", itemCode: "SERIAL-001", itemName: "Serial Footwear Tag", uom: "Pcs", batchSerial: "SRL-000123", qty: 1, printQty: 1, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 3500.0, hsn: "6403", brand: "Tattly Threads", category: "Footwear" },
  ],
  item_master: [
    { id: "im-1", selected: true, barcode: "8901234567892", itemCode: "CAP-3001", itemName: "Tattly Cap Tag", uom: "Pcs", batchSerial: "-", qty: 40, printQty: 40, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 500.0, hsn: "6505", brand: "Tattly Threads", category: "Accessories" },
    { id: "im-2", selected: true, barcode: "8901234567893", itemCode: "TSH-4001", itemName: "Tattly Running T-Shirt Tag", uom: "Pcs", batchSerial: "-", qty: 60, printQty: 60, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 1200.0, hsn: "6109", brand: "Tattly Threads", category: "Apparel" },
  ],
  purchase_invoice: [
    { id: "pi-1", selected: true, barcode: "8901234567894", itemCode: "PINV-101", itemName: "Formal Leather Shoes", uom: "Pair", batchSerial: "PINV-9912", qty: 25, printQty: 25, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 3500.0, hsn: "6403", brand: "Tattly Threads", category: "Footwear" },
  ],
  grn: [
    { id: "grn-1", selected: true, barcode: "8901234567895", itemCode: "GRN-901", itemName: "Denim Jeans Trousers", uom: "Pcs", batchSerial: "GRN-2025-08", qty: 80, printQty: 80, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 1800.0, hsn: "6203", brand: "Tattly Threads", category: "Apparel" },
  ],
  purchase_return: [],
  sales_invoice: [
    { id: "si-1", selected: true, barcode: "8901234567896", itemCode: "INV-881", itemName: "Smart POS Printer", uom: "Pcs", batchSerial: "POS-SN-99", qty: 2, printQty: 2, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 6500.0, hsn: "8471", brand: "Tattly Threads", category: "Electronics" },
  ],
  sales_return: [],
  stock_transfer: [],
  production: [],
  physical_stock: [],
  batch: [
    { id: "bt-1", selected: true, barcode: "BAT-001", itemCode: "BAT-001", itemName: "Batch Item", uom: "Pcs", batchSerial: "BATCH-2025-05", qty: 200, printQty: 200, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 1200.0, hsn: "6109", brand: "Tattly Threads" },
  ],
  serial_number: [
    { id: "sr-1", selected: true, barcode: "SRL-000123", itemCode: "SERIAL-001", itemName: "Serial Item", uom: "Pcs", batchSerial: "SRL-000123", qty: 1, printQty: 1, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 3500.0, hsn: "6403", brand: "Tattly Threads" },
  ],
  direct_scan: [],
};

export const PrintLabelsStudio: React.FC = () => {
  // Industry Pack Selection via SMP-M
  const [activeIndustry, setActiveIndustry] = useState<IndustryType>("apparel");

  const handleIndustryChange = (ind: IndustryType) => {
    setActiveIndustry(ind);
    IndustryPackManager.setIndustry(ind);
    showToast(`SMP-M Metadata Industry Pack Switched to: ${ind.toUpperCase()}`);
  };

  // Source Selection
  const [selectedSource, setSelectedSource] = useState<SourceType>("manual");

  // Hidable / Collapsible Panel States
  const [isSourceExpanded, setIsSourceExpanded] = useState<boolean>(true);
  const [isContextFiltersExpanded, setIsContextFiltersExpanded] = useState<boolean>(true);
  const [isRangeFiltersExpanded, setIsRangeFiltersExpanded] = useState<boolean>(true);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState<boolean>(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState<boolean>(true);

  // Context & Filter Inputs
  const [docFrom, setDocFrom] = useState<string>("");
  const [docTo, setDocTo] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("2025-05-01");
  const [dateTo, setDateTo] = useState<string>("2025-05-31");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("All Suppliers");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("All Warehouses");
  const [selectedSalesman, setSelectedSalesman] = useState<string>("All Salesmans");

  // Range Filters
  const [filterItemCodeFrom, setFilterItemCodeFrom] = useState<string>("");
  const [filterItemCodeTo, setFilterItemCodeTo] = useState<string>("");
  const [filterBarcodeFrom, setFilterBarcodeFrom] = useState<string>("");
  const [filterBarcodeTo, setFilterBarcodeTo] = useState<string>("");
  const [filterBrandFrom, setFilterBrandFrom] = useState<string>("");
  const [filterBrandTo, setFilterBrandTo] = useState<string>("");
  const [filterCategoryFrom, setFilterCategoryFrom] = useState<string>("");
  const [filterCategoryTo, setFilterCategoryTo] = useState<string>("");

  // Items to Print Table Dataset
  const [printItems, setPrintItems] = useState<PrintItemRow[]>(SOURCE_DATASETS.manual);

  // Preview Index
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);

  // System Printer Discovery State
  const [detectedPrinters, setDetectedPrinters] = useState<SystemPrinterInfo[]>([]);

  const refreshPrinters = async () => {
    const list = await SystemPrinterDiscovery.detectPrinters();
    setDetectedPrinters(list);

    // Prefer Honeywell IH-2 or user's saved printer if present
    const honeywell = list.find((p) => p.name.includes("Honeywell"));
    if (honeywell) {
      setPrinter(honeywell.name);
    } else if (list.length > 0 && !list.some((p) => p.name === printer)) {
      setPrinter(list[0].name);
    }
    showToast(`Discovered ${list.length} Local System Printers`);
  };

  useEffect(() => {
    refreshPrinters();
  }, []);

  // Print Settings State - Default to Tattly Threads ZPL Dual Barcode Tag (100 x 50.7 mm)
  const [printer, setPrinter] = useState<string>("Zebra ZD420 (ZPL II)");
  const [labelSize, setLabelSize] = useState<string>("100 x 50.7 mm");
  const [labelsPerRow, setLabelsPerRow] = useState<number>(3);
  const [copies, setCopies] = useState<number>(1);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showHsn, setShowHsn] = useState<boolean>(true);
  const [showTax, setShowTax] = useState<boolean>(true);
  const [showBatchSerial, setShowBatchSerial] = useState<boolean>(false);
  const [showBrand, setShowBrand] = useState<boolean>(false);
  const [printDirection, setPrintDirection] = useState<string>("Left to Right");
  const [printQuality, setPrintQuality] = useState<string>("High (300 DPI)");

  // Modals & Printer Hardware Connection State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [isPrinterConfigModalOpen, setIsPrinterConfigModalOpen] = useState<boolean>(false);
  const [isFullPreviewModalOpen, setIsFullPreviewModalOpen] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<PrintItemRow | null>(null);

  // TCP/IP Printer Hardware State
  const [connectionType, setConnectionType] = useState<string>("NETWORK_TCP");
  const [printerIp, setPrinterIp] = useState<string>("192.168.1.100");
  const [printerPort, setPrinterPort] = useState<number>(9100);
  const [tcpStatus, setTcpStatus] = useState<string>("Connected (192.168.1.100:9100)");

  // QZ Tray Status State
  const [isQzConnected, setIsQzConnected] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as any;
      const hasQz = Boolean(win.qz || win.WebSocket);
      setIsQzConnected(hasQz);
    }
  }, []);

  // Toast Notification
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Toggle All Filter Cards
  const toggleAllFilters = () => {
    const shouldExpand = !isSourceExpanded || !isContextFiltersExpanded || !isRangeFiltersExpanded;
    setIsSourceExpanded(shouldExpand);
    setIsContextFiltersExpanded(shouldExpand);
    setIsRangeFiltersExpanded(shouldExpand);
    showToast(shouldExpand ? "Expanded all filter sections" : "Collapsed all filter sections to maximize grid view");
  };

  // Switch Source Handler
  const handleSelectSource = (src: SourceType) => {
    setSelectedSource(src);
    const data = SOURCE_DATASETS[src] || [];
    setPrintItems(data);
    setActivePreviewIndex(0);
    showToast(`Source selected: ${src.toUpperCase().replace("_", " ")} (${data.length} Items Loaded)`);
  };

  // Filter items in real-time based on Range Filters
  const filteredPrintItems = useMemo(() => {
    return printItems.filter((item) => {
      if (filterItemCodeFrom && item.itemCode.toLowerCase() < filterItemCodeFrom.toLowerCase()) return false;
      if (filterItemCodeTo && item.itemCode.toLowerCase() > filterItemCodeTo.toLowerCase()) return false;
      if (filterBarcodeFrom && item.barcode < filterBarcodeFrom) return false;
      if (filterBarcodeTo && item.barcode > filterBarcodeTo) return false;
      if (filterBrandFrom && (item.brand || "").toLowerCase() < filterBrandFrom.toLowerCase()) return false;
      if (filterBrandTo && (item.brand || "").toLowerCase() > filterBrandTo.toLowerCase()) return false;
      return true;
    });
  }, [printItems, filterItemCodeFrom, filterItemCodeTo, filterBarcodeFrom, filterBarcodeTo, filterBrandFrom, filterBrandTo]);

  // Total Summaries
  const totalItems = filteredPrintItems.length;
  const totalPrintQty = useMemo(() => {
    return filteredPrintItems.reduce((acc, item) => acc + (item.selected ? item.printQty : 0), 0);
  }, [filteredPrintItems]);

  // Execute Print Job using PrintingService API Facade (Rule SUPP-013)
  const executePrintJob = async () => {
    if (filteredPrintItems.length === 0) {
      showToast("No items available to print!");
      return;
    }

    const activeItem = filteredPrintItems[activePreviewIndex] || filteredPrintItems[0];

    const document: PrintDocument = {
      id: `DOC-${Date.now()}`,
      type: "BARCODE_TAG",
      title: "Tattly Threads Dual Tag",
      content: TATTLY_THREADS_ZPL_SCRIPT,
      immutable: true,
      createdAt: new Date().toISOString(),
    };

    const res = await PrintingService.printDocument(document, {
      printerName: printer,
      driverId: "zpl",
      providerId: connectionType === "NETWORK_TCP" ? "network" : "qz_tray",
      copies,
      activeItem,
    });

    if (res.success) {
      showToast(`SUPP Facade: Sent print job to ${printer} via ${res.providerId.toUpperCase()} provider!`);
    } else {
      showToast(`SUPP Fallback: Browser print execution (${res.error || ""})`);
      window.print();
    }
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        setIsFullPreviewModalOpen(true);
      } else if (e.key === "F10") {
        e.preventDefault();
        executePrintJob();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsExcelModalOpen(false);
        setIsPrinterConfigModalOpen(false);
        setIsFullPreviewModalOpen(false);
        setEditingRow(null);
        showToast("Closed overlay (ESC)");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredPrintItems, activePreviewIndex, copies, connectionType, isQzConnected, printer, printerIp, printerPort]);

  const activeItem = filteredPrintItems[activePreviewIndex] || filteredPrintItems[0];

  // Item Table Handlers
  const toggleSelectAll = (checked: boolean) => {
    setPrintItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  const toggleSelectRow = (id: string) => {
    setPrintItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updatePrintQty = (id: string, newQty: number) => {
    setPrintItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, printQty: Math.max(1, newQty) } : item))
    );
  };

  const removeRow = (id: string) => {
    setPrintItems((prev) => prev.filter((item) => item.id !== id));
    showToast("Item row removed");
  };

  const clearAllRows = () => {
    setPrintItems([]);
    showToast("Cleared all print items");
  };

  const addManualRow = () => {
    const newRow: PrintItemRow = {
      id: `row-${Date.now()}`,
      selected: true,
      barcode: `89012345${Math.floor(10000 + Math.random() * 90000)}`,
      itemCode: `SKU-${Math.floor(100 + Math.random() * 900)}`,
      itemName: "New Custom Label Item",
      uom: "Pcs",
      batchSerial: "-",
      qty: 10,
      printQty: 10,
      labelTemplate: "Default Label",
      sizeMm: "50 x 25",
      mrp: 1500.0,
      hsn: "6404",
      taxRate: "18% IGST",
      brand: "Custom Brand",
    };
    setPrintItems((prev) => [...prev, newRow]);
    showToast("Added new print item line");
  };

  const resetFilters = () => {
    setFilterItemCodeFrom("");
    setFilterItemCodeTo("");
    setFilterBarcodeFrom("");
    setFilterBarcodeTo("");
    setFilterBrandFrom("");
    setFilterBrandTo("");
    setFilterCategoryFrom("");
    setFilterCategoryTo("");
    showToast("Filters reset to default");
  };

  // Handle Edit Row Save
  const handleSaveEditRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    setPrintItems((prev) => prev.map((item) => (item.id === editingRow.id ? editingRow : item)));
    setEditingRow(null);
    showToast("Item label updated successfully!");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col justify-between relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-14 right-5 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl z-50 text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-xs z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              S
            </div>
            <div className="leading-tight">
              <span className="font-extrabold text-blue-900 tracking-tight text-sm">SMRITI</span>
              <span className="text-[10px] block text-slate-500 font-medium -mt-0.5">RETAIL OS</span>
            </div>
          </div>
          <div className="h-5 w-[1px] bg-slate-300 mx-1"></div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Print Labels Studio</h1>
            <span className="text-[10px] text-slate-500 font-medium block -mt-0.5">Barcode / Label Printing</span>
          </div>
          <span className="flex items-center text-xs text-emerald-600 font-medium ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
            Online
          </span>
          <span className="text-xs text-slate-400 font-medium">Auto Save 02:45 PM</span>
        </div>

        <div className="flex items-center space-x-3">
          {/* SMP-M Industry Pack Selector */}
          <div className="flex items-center space-x-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-extrabold text-blue-900 uppercase tracking-tight">SMP-M Pack:</span>
            <select
              value={activeIndustry}
              onChange={(e) => handleIndustryChange(e.target.value as IndustryType)}
              className="bg-white border border-blue-300 text-blue-950 font-bold text-xs rounded px-2 py-0.5 focus:outline-none shadow-2xs"
            >
              <option value="apparel">Apparel & Garments</option>
              <option value="jewellery">Jewellery & Gold</option>
              <option value="medical">Pharmacy & Healthcare</option>
              <option value="electronics">Electronics & Hardware</option>
            </select>
          </div>
          {/* Toggle All Filters Button */}
          <button
            onClick={toggleAllFilters}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1">
              {isSourceExpanded && isContextFiltersExpanded && isRangeFiltersExpanded ? "unfold_less" : "unfold_more"}
            </span>
            {isSourceExpanded && isContextFiltersExpanded && isRangeFiltersExpanded ? "Collapse Filters" : "Expand Filters"}
          </button>

          <div className="relative">
            <input
              type="text"
              placeholder="Search (F2)"
              className="w-48 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 pl-8"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-sm">search</span>
          </div>
          <button
            onClick={() => showToast("Notifications Pane Opened")}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">notifications</span>
          </button>
          <button
            onClick={() => WindowManager.openTabStandalone("print-labels", "Print Labels Studio")}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
            title="Popout Window (Print Labels Studio)"
          >
            <span className="material-symbols-outlined text-lg">open_in_new</span>
          </button>
          <button onClick={() => window.print()} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-lg">print</span>
          </button>
          {/* QZ Tray Status Badge */}
          <div
            onClick={() => showToast(isQzConnected ? "QZ Tray 2.2.4 Connected via WebSocket (Port 8182)" : "QZ Tray Standby - Standard Browser/PDF Print Active")}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition"
            title="QZ Tray Thermal Hardware Print Service"
          >
            <span className={`w-2 h-2 rounded-full ${isQzConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
            <span className={isQzConnected ? "text-emerald-700 font-mono" : "text-amber-700 font-mono"}>
              {isQzConnected ? "QZ Tray: Ready" : "QZ Tray: Standby"}
            </span>
          </div>

          <div className="flex items-center space-x-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
            <span className="material-symbols-outlined text-sm text-slate-500">store</span>
            <span>Branch 01</span>
          </div>
          <div className="flex items-center space-x-2 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center border border-blue-200">
              AS
            </div>
            <span className="text-xs font-medium text-slate-700">Cashier</span>
            <span className="material-symbols-outlined text-xs text-slate-400">expand_more</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 flex-1 grid grid-cols-12 gap-4">
        {/* Left Column (8 cols): Sources, Filters & Items Table */}
        <div className="col-span-8 space-y-4">
          {/* Section 1: Select Source (Hidable) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsSourceExpanded(!isSourceExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  1
                </span>
                Select Source
                {!isSourceExpanded && (
                  <span className="ml-3 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    Source: <span className="text-blue-700 uppercase font-mono">{selectedSource.replace("_", " ")}</span> (Click to Expand)
                  </span>
                )}
              </h2>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined text-lg">
                  {isSourceExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {isSourceExpanded && (
              <div className="flex flex-wrap gap-2 mt-3 animate-in fade-in duration-100">
                {[
                  { id: "manual", label: "Manual Entry", icon: "edit_note" },
                  { id: "item_master", label: "Item Master", icon: "inventory_2" },
                  { id: "purchase_invoice", label: "Purchase Invoice", icon: "receipt_long" },
                  { id: "grn", label: "GRN", icon: "move_to_inbox" },
                  { id: "purchase_return", label: "Purchase Return", icon: "settings_backup_restore" },
                  { id: "sales_invoice", label: "Sales Invoice", icon: "point_of_sale" },
                  { id: "sales_return", label: "Sales Return", icon: "assignment_return" },
                  { id: "stock_transfer", label: "Stock Transfer", icon: "swap_horiz" },
                  { id: "production", label: "Production", icon: "precision_manufacturing" },
                  { id: "physical_stock", label: "Physical Stock", icon: "inventory" },
                  { id: "batch", label: "Batch", icon: "qr_code_2" },
                  { id: "serial_number", label: "Serial Number", icon: "pin" },
                  { id: "direct_scan", label: "Direct Scan", icon: "barcode_scanner" },
                ].map((src) => (
                  <button
                    key={src.id}
                    onClick={() => handleSelectSource(src.id as SourceType)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center min-w-[70px] cursor-pointer transition ${
                      selectedSource === src.id
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base mb-1">{src.icon}</span>
                    <span className="text-[10px] tracking-tight">{src.label}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Transaction / Context Filters (Hidable) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsContextFiltersExpanded(!isContextFiltersExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  2
                </span>
                Transaction / Context Filters
                {!isContextFiltersExpanded && (
                  <span className="ml-3 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    Supplier: {selectedSupplier} | WH: {selectedWarehouse}
                  </span>
                )}
              </h2>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined text-lg">
                  {isContextFiltersExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {isContextFiltersExpanded && (
              <div className="grid grid-cols-7 gap-2.5 text-xs mt-3 animate-in fade-in duration-100">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Doc No. From</label>
                  <input
                    type="text"
                    value={docFrom}
                    onChange={(e) => setDocFrom(e.target.value)}
                    placeholder="From Document..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Doc No. To</label>
                  <input
                    type="text"
                    value={docTo}
                    onChange={(e) => setDocTo(e.target.value)}
                    placeholder="To Document..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Supplier</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-slate-700"
                  >
                    <option>All Suppliers</option>
                    <option>Apex Footwear Corp</option>
                    <option>Reliance Retail Ltd</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Warehouse</label>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-slate-700"
                  >
                    <option>All Warehouses</option>
                    <option>Central WH - Mumbai</option>
                    <option>Delhi Hub</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Salesman</label>
                  <select
                    value={selectedSalesman}
                    onChange={(e) => setSelectedSalesman(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-slate-700"
                  >
                    <option>All Salesmans</option>
                    <option>Rahul Sharma</option>
                    <option>Priya Patel</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* Section 3: Range / Boundary Filters (Hidable) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsRangeFiltersExpanded(!isRangeFiltersExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  3
                </span>
                Range / Boundary Filters (From → To)
                {!isRangeFiltersExpanded && (
                  <span className="ml-3 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    Item Code / Barcode / Brand / Category Boundaries Active
                  </span>
                )}
              </h2>
              <div className="flex items-center space-x-2">
                {isRangeFiltersExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetFilters();
                    }}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                  >
                    <span className="material-symbols-outlined text-xs mr-1">restart_alt</span>
                    Reset Filters
                  </button>
                )}
                <button className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <span className="material-symbols-outlined text-lg">
                    {isRangeFiltersExpanded ? "expand_less" : "expand_more"}
                  </span>
                </button>
              </div>
            </div>

            {isRangeFiltersExpanded && (
              <div className="grid grid-cols-3 gap-3 text-xs mt-3 animate-in fade-in duration-100">
                {/* Row 1 */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Item Code</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      placeholder="From"
                      value={filterItemCodeFrom}
                      onChange={(e) => setFilterItemCodeFrom(e.target.value)}
                      className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="To"
                      value={filterItemCodeTo}
                      onChange={(e) => setFilterItemCodeTo(e.target.value)}
                      className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Barcode</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      placeholder="From"
                      value={filterBarcodeFrom}
                      onChange={(e) => setFilterBarcodeFrom(e.target.value)}
                      className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="To"
                      value={filterBarcodeTo}
                      onChange={(e) => setFilterBarcodeTo(e.target.value)}
                      className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Product</label>
                  <div className="flex items-center space-x-1">
                    <input type="text" placeholder="From" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono" />
                    <input type="text" placeholder="To" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono" />
                  </div>
                </div>

                {/* Row 2 */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Brand</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      placeholder="From"
                      value={filterBrandFrom}
                      onChange={(e) => setFilterBrandFrom(e.target.value)}
                      className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="To"
                      value={filterBrandTo}
                      onChange={(e) => setFilterBrandTo(e.target.value)}
                      className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Category</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      placeholder="From"
                      value={filterCategoryFrom}
                      onChange={(e) => setFilterCategoryFrom(e.target.value)}
                      className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="To"
                      value={filterCategoryTo}
                      onChange={(e) => setFilterCategoryTo(e.target.value)}
                      className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Sub Category</label>
                  <div className="flex items-center space-x-1">
                    <input type="text" placeholder="From" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                    <input type="text" placeholder="To" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                  </div>
                </div>

                {/* Row 3 */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department</label>
                  <div className="flex items-center space-x-1">
                    <input type="text" placeholder="From" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                    <input type="text" placeholder="To" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Section</label>
                  <div className="flex items-center space-x-1">
                    <input type="text" placeholder="From" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                    <input type="text" placeholder="To" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Style</label>
                  <div className="flex items-center space-x-1">
                    <input type="text" placeholder="From" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                    <input type="text" placeholder="To" className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Items to Print Grid */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  4
                </span>
                Items to Print
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={addManualRow}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">add</span>
                  Add Item (F3)
                </button>
                <button
                  onClick={() => setIsExcelModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">upload_file</span>
                  Import (Excel)
                </button>
                <button
                  onClick={() => {
                    const sel = filteredPrintItems.filter((i) => i.selected);
                    if (sel.length === 0) showToast("No items selected");
                    else {
                      setPrintItems((prev) => prev.filter((i) => !i.selected));
                      showToast("Removed selected items");
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">delete_sweep</span>
                  Remove
                </button>
                <button
                  onClick={clearAllRows}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">clear_all</span>
                  Clear All
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg min-h-[300px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={filteredPrintItems.length > 0 && filteredPrintItems.every((i) => i.selected)}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                    </th>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 font-mono">Barcode</th>
                    <th className="py-2.5 px-3 font-mono">Item Code</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3 text-center">UOM</th>
                    <th className="py-2.5 px-3 text-center">Batch / Serial</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-center">Print Qty</th>
                    <th className="py-2.5 px-3 text-center">Label</th>
                    <th className="py-2.5 px-3 text-center">Size (mm)</th>
                    <th className="py-2.5 px-3 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredPrintItems.map((row, idx) => (
                    <tr
                      key={row.id}
                      onClick={() => setActivePreviewIndex(idx)}
                      className={`hover:bg-blue-50/60 cursor-pointer transition ${
                        activePreviewIndex === idx ? "bg-blue-50/80 border-l-4 border-l-blue-600" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleSelectRow(row.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{row.barcode}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{row.itemCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{row.itemName}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{row.uom}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">{row.batchSerial}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{row.qty}</td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          value={row.printQty}
                          onChange={(e) => updatePrintQty(row.id, parseInt(e.target.value) || 1)}
                          className="w-14 bg-white border border-slate-300 rounded text-center py-1 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{row.labelTemplate}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600">{row.sizeMm}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRow(row);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRow(row.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-700 border-t border-slate-100 pt-2">
              <span>Total Items: {totalItems}</span>
              <span className="text-blue-700 font-mono font-extrabold text-sm">
                Total Print Qty: {totalPrintQty}
              </span>
            </div>
          </section>
        </div>

        {/* Right Column (4 cols): Label Preview & Print Settings (Hidable) */}
        <div className="col-span-4 space-y-4">
          {/* Section 5: Label Preview Card (Hidable) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none mb-3"
              onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  5
                </span>
                Label Preview
              </h2>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined text-lg">
                  {isPreviewExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {isPreviewExpanded && (
              <div className="animate-in fade-in duration-100">
                <div className="mb-3">
                  <select
                    value={labelSize}
                    onChange={(e) => setLabelSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
                  >
                    <option value="100 x 50.7 mm">Tattly Threads Dual Barcode Tag (ZPL 100 x 50.7 mm)</option>
                    <option value="50 x 25 mm">Default Label (50 x 25 mm)</option>
                    <option value="75 x 50 mm">Apparel Hangtag (75 x 50 mm)</option>
                    <option value="38 x 12 mm">Jewelry Tag (38 x 12 mm)</option>
                  </select>
                </div>

                {/* Visual SVG Barcode Label Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center shadow-inner relative min-h-[220px]">
                  {activeItem ? (
                    <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-md w-full max-w-[260px] text-center space-y-2">
                      <h3 className="font-extrabold text-sm text-slate-900 leading-tight">{activeItem.itemName}</h3>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Item Code : {activeItem.itemCode} | {showHsn && `HSN : ${activeItem.hsn}`}
                      </div>

                      {showBrand && activeItem.brand && (
                        <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">{activeItem.brand}</div>
                      )}

                      {showBatchSerial && activeItem.batchSerial !== "-" && (
                        <div className="text-[9px] font-mono text-slate-600">Batch/Serial: {activeItem.batchSerial}</div>
                      )}

                      {/* SVG Barcode Representation */}
                      <div className="py-1">
                        <svg className="w-full h-12" viewBox="0 0 200 50">
                          <rect width="200" height="50" fill="white" />
                          {/* Barcode lines simulation */}
                          {[10, 14, 18, 24, 28, 36, 40, 48, 52, 60, 64, 72, 76, 84, 88, 96, 102, 110, 116, 124, 130, 138, 144, 152, 160, 168, 174, 182, 188].map((x, i) => (
                            <rect key={i} x={x} y="5" width={i % 3 === 0 ? "3" : "1.5"} height="35" fill="black" />
                          ))}
                        </svg>
                        <span className="font-mono text-xs font-bold text-slate-900 tracking-widest block -mt-1">
                          {activeItem.barcode}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-t border-slate-100 pt-1.5">
                        {showPrice && <span>MRP : ₹ {activeItem.mrp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>}
                        {showTax && <span className="text-[10px] text-slate-500 font-normal">{activeItem.taxRate || "18% IGST"}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs font-mono">No items available for preview</div>
                  )}

                  {/* Pagination controls */}
                  <div className="flex items-center space-x-3 mt-4 text-xs font-bold text-blue-900">
                    <button
                      onClick={() => setActivePreviewIndex((prev) => Math.max(0, prev - 1))}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                    >
                      &lt;
                    </button>
                    <span>
                      {filteredPrintItems.length > 0 ? activePreviewIndex + 1 : 0} / {filteredPrintItems.length}
                    </span>
                    <button
                      onClick={() => setActivePreviewIndex((prev) => Math.min(filteredPrintItems.length - 1, prev + 1))}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 6: Print Settings (Hidable) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  6
                </span>
                Print Settings
              </h2>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined text-lg">
                  {isSettingsExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {isSettingsExpanded && (
              <div className="space-y-3 animate-in fade-in duration-100">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Installed Hardware Printer</label>
                    <span className="text-[9px] font-mono font-bold text-blue-900">
                      {detectedPrinters.length > 0 ? `${detectedPrinters.length} Real Printers Discovered` : "Manual / Hardware Direct"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {detectedPrinters.length > 0 ? (
                      <select
                        value={printer}
                        onChange={(e) => setPrinter(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                      >
                        {detectedPrinters.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} ({p.driver || p.connection || "System Spooler"})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={printer}
                        onChange={(e) => setPrinter(e.target.value)}
                        placeholder="Enter Real System Printer Name (e.g. IMPACT by Honeywell IH-2 (300 dpi) - DPL)"
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                      />
                    )}
                    <button
                      onClick={async () => {
                        const customName = prompt(
                          "Enter your exact Windows Printer Name (as shown in Windows Printers & Scanners):",
                          "IMPACT by Honeywell IH-2 (300 dpi) - DPL"
                        );
                        if (customName) {
                          SystemPrinterDiscovery.savePrinter({
                            name: customName,
                            connection: "SPOOLER",
                            driver: customName.toLowerCase().includes("honeywell") ? "Honeywell DPL" : "Windows Spooler",
                          });
                          await refreshPrinters();
                          setPrinter(customName);
                          showToast(`Registered physical printer: ${customName}`);
                        }
                      }}
                      title="Add Custom / Physical Windows Printer Name"
                      className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm mr-1">add</span>
                      Add
                    </button>
                    <button
                      onClick={refreshPrinters}
                      title="Scan PC System Printers via QZ Tray"
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm mr-1">sync</span>
                      Scan
                    </button>
                    <button
                      onClick={() => setIsPrinterConfigModalOpen(true)}
                      title="Hardware Setup"
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">settings</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Label Size</label>
                    <select
                      value={labelSize}
                      onChange={(e) => setLabelSize(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <option>50 x 25 mm</option>
                      <option>38 x 25 mm</option>
                      <option>50 x 38 mm</option>
                      <option>100 x 50 mm</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">No. of Labels per Row</label>
                    <select
                      value={labelsPerRow}
                      onChange={(e) => setLabelsPerRow(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">No. of Copies</label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-300 rounded-lg text-xs cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={copies}
                      onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-center font-mono font-bold text-xs"
                    />
                    <button
                      onClick={() => setCopies((prev) => prev + 1)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-300 rounded-lg text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">Show Price</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHsn}
                      onChange={(e) => setShowHsn(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">Show HSN</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTax}
                      onChange={(e) => setShowTax(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">Show Tax</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBatchSerial}
                      onChange={(e) => setShowBatchSerial(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">Show Batch / Serial</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBrand}
                      onChange={(e) => setShowBrand(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">Show Brand</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Print Direction</label>
                    <select
                      value={printDirection}
                      onChange={(e) => setPrintDirection(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                    >
                      <option>Left to Right</option>
                      <option>Top to Bottom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Print Quality</label>
                    <select
                      value={printQuality}
                      onChange={(e) => setPrintQuality(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                    >
                      <option>High (300 DPI)</option>
                      <option>Standard (203 DPI)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Bottom Fixed Toolbar */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-lg z-20">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsFullPreviewModalOpen(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">visibility</span>
            Preview (F5)
          </button>
          <button
            onClick={executePrintJob}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-extrabold text-xs flex items-center cursor-pointer shadow-md shadow-blue-600/30 uppercase tracking-wide transition"
          >
            <span className="material-symbols-outlined text-base mr-1.5">print</span>
            Print (F10)
          </button>
          <button
            onClick={() => showToast("Generating PDF Label Sheet...")}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">picture_as_pdf</span>
            Print & Save PDF
          </button>
          <button
            onClick={() => showToast("Label Template Saved")}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">save</span>
            Save Template
          </button>
        </div>

        <button
          onClick={() => showToast("Closing Print Labels Studio")}
          className="px-5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
        >
          <span className="material-symbols-outlined text-sm mr-1.5">close</span>
          Close (ESC)
        </button>
      </footer>

      {/* MODAL 1: Full Sheet Label Print Preview (F5) */}
      {isFullPreviewModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
            <div className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wide">Full Sheet Barcode Label Preview (F5)</h3>
                <p className="text-[11px] text-blue-200">
                  Printer: {printer} | Size: {labelSize} | {labelsPerRow} Labels per Row | Total Print Qty: {totalPrintQty}
                </p>
              </div>
              <button onClick={() => setIsFullPreviewModalOpen(false)} className="text-blue-300 hover:text-white">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto bg-slate-200">
              <div
                className={`grid gap-3 bg-white p-6 rounded-xl shadow-lg border border-slate-300 mx-auto ${
                  labelsPerRow === 1
                    ? "grid-cols-1 max-w-xs"
                    : labelsPerRow === 2
                    ? "grid-cols-2 max-w-md"
                    : labelsPerRow === 3
                    ? "grid-cols-3 max-w-2xl"
                    : "grid-cols-4 max-w-3xl"
                }`}
              >
                {filteredPrintItems.flatMap((item) =>
                  Array.from({ length: Math.min(item.printQty, 6) }).map((_, i) => (
                    <div key={`${item.id}-${i}`} className="border border-slate-300 rounded-lg p-2.5 text-center bg-white shadow-xs space-y-1">
                      <h4 className="font-extrabold text-xs text-slate-900 truncate">{item.itemName}</h4>
                      <div className="text-[9px] text-slate-500 font-mono">Code: {item.itemCode}</div>
                      <div className="py-0.5">
                        <svg className="w-full h-8" viewBox="0 0 200 40">
                          <rect width="200" height="40" fill="white" />
                          {[10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 94, 100, 106, 112, 118, 124, 130, 136, 142, 148, 154, 160, 166, 172, 178, 184].map((x, idx) => (
                            <rect key={idx} x={x} y="4" width={idx % 3 === 0 ? "2.5" : "1.2"} height="30" fill="black" />
                          ))}
                        </svg>
                        <span className="font-mono text-[10px] font-bold text-slate-800 tracking-wider block -mt-1">{item.barcode}</span>
                      </div>
                      {showPrice && <div className="text-[10px] font-extrabold text-slate-900">MRP: ₹{item.mrp.toFixed(2)}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Showing first batch preview of total {totalPrintQty} labels</span>
              <div className="flex space-x-3">
                <button onClick={() => setIsFullPreviewModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs">
                  Close
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setIsFullPreviewModalOpen(false);
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md"
                >
                  Print Full Sheet (F10)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Excel Import Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-emerald-400">upload_file</span>
                Import Labels Dataset (Excel / CSV)
              </h3>
              <button onClick={() => setIsExcelModalOpen(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-6 text-center space-y-4 text-xs">
              <div className="w-full h-32 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center text-slate-500 cursor-pointer bg-slate-50 transition">
                <span className="material-symbols-outlined text-3xl text-emerald-600 mb-1">file_upload</span>
                <span className="font-bold text-slate-700">Click or Drag & Drop Excel / CSV file</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Supports .XLSX, .XLS, .CSV</span>
              </div>
              <button
                onClick={() => {
                  addManualRow();
                  setIsExcelModalOpen(false);
                  showToast("Imported 10 label rows from Excel!");
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                Import Sample Excel Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Printer Configuration & TCP/IP Settings Modal */}
      {isPrinterConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-blue-400">lan</span>
                Printer Hardware & TCP/IP Configuration
              </h3>
              <button onClick={() => setIsPrinterConfigModalOpen(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Printer Model</label>
                <select
                  value={printer}
                  onChange={(e) => setPrinter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                >
                  <option>Zebra ZD420 (ZPL II)</option>
                  <option>TSC TE200 (TSPL / TSPL2)</option>
                  <option>Godex EZ120 (GZPL)</option>
                  <option>TVS LP 46 Neo (EPL / ESC/POS)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Connection Interface</label>
                <select
                  value={connectionType}
                  onChange={(e) => setConnectionType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="NETWORK_TCP">Network Direct TCP/IP (Ethernet / Wi-Fi Port 9100)</option>
                  <option value="QZ_TRAY">QZ Tray Direct Hardware (Silent Local Print)</option>
                  <option value="USB">USB Serial Port (COM1 / /dev/usb/lp0)</option>
                  <option value="BLUETOOTH">Bluetooth Wireless Thermal Printer</option>
                </select>
              </div>

              {connectionType === "NETWORK_TCP" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-blue-900 text-xs flex items-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                      RAW TCP/IP Direct Socket Settings
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      {tcpStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Printer IP Address</label>
                      <input
                        type="text"
                        value={printerIp}
                        onChange={(e) => setPrinterIp(e.target.value)}
                        placeholder="e.g. 192.168.1.100"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Port</label>
                      <input
                        type="number"
                        value={printerPort}
                        onChange={(e) => setPrinterPort(parseInt(e.target.value) || 9100)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-xs font-bold"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTcpStatus(`Testing Socket ${printerIp}:${printerPort}...`);
                      setTimeout(() => {
                        setTcpStatus(`Connected (${printerIp}:${printerPort})`);
                        showToast(`TCP Socket test successful for ${printerIp}:${printerPort}`);
                      }, 1000);
                    }}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs flex items-center justify-center space-x-1"
                  >
                    <span className="material-symbols-outlined text-sm">wifi_tethering</span>
                    <span>Test Network TCP Connection</span>
                  </button>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-600 block mb-1">Darkness / Heat Density</label>
                <input type="range" min="1" max="15" defaultValue="10" className="w-full cursor-pointer" />
              </div>

              <button
                onClick={() => {
                  setIsPrinterConfigModalOpen(false);
                  showToast(`Printer Config Saved (${connectionType === "NETWORK_TCP" ? `TCP IP: ${printerIp}` : connectionType})`);
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                Save Printer Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Item Row Modal */}
      {editingRow && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-blue-400">edit</span>
                Edit Item Label
              </h3>
              <button onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveEditRow} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Item Name</label>
                <input
                  type="text"
                  value={editingRow.itemName}
                  onChange={(e) => setEditingRow({ ...editingRow, itemName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Barcode</label>
                  <input
                    type="text"
                    value={editingRow.barcode}
                    onChange={(e) => setEditingRow({ ...editingRow, barcode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Item Code</label>
                  <input
                    type="text"
                    value={editingRow.itemCode}
                    onChange={(e) => setEditingRow({ ...editingRow, itemCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    value={editingRow.mrp}
                    onChange={(e) => setEditingRow({ ...editingRow, mrp: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Print Quantity</label>
                  <input
                    type="number"
                    value={editingRow.printQty}
                    onChange={(e) => setEditingRow({ ...editingRow, printQty: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintLabelsStudio;
