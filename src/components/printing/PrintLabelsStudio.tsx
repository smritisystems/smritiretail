/**
 * Project      : SMRITI Retail OS
 * Component    : PrintLabelsStudio (Dedicated Single Page Barcode & Label Printing Studio)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 3.29.0
 * License      : Proprietary Commercial Software
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { WindowManager } from "../../sdk";
import { getCustomers } from "../../services/customerStore";

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

export const PrintLabelsStudio: React.FC = () => {
  // Source Selection
  const [selectedSource, setSelectedSource] = useState<SourceType>("manual");

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
  const [printItems, setPrintItems] = useState<PrintItemRow[]>([
    {
      id: "row-1",
      selected: true,
      barcode: "8901234567890",
      itemCode: "SHO-1001",
      itemName: "Nike Sports Shoes",
      uom: "Pair",
      batchSerial: "-",
      qty: 50,
      printQty: 50,
      labelTemplate: "Default Label",
      sizeMm: "50 x 25",
      mrp: 2500.0,
      hsn: "6404",
      taxRate: "18% IGST",
      brand: "Nike",
    },
    {
      id: "row-2",
      selected: true,
      barcode: "8901234567891",
      itemCode: "SOC-2001",
      itemName: "Cotton Socks",
      uom: "Pair",
      batchSerial: "-",
      qty: 100,
      printQty: 100,
      labelTemplate: "Default Label",
      sizeMm: "50 x 25",
      mrp: 250.0,
      hsn: "6115",
      taxRate: "12% GST",
      brand: "Adidas",
    },
    {
      id: "row-3",
      selected: true,
      barcode: "BAT-001",
      itemCode: "BAT-001",
      itemName: "Batch Item",
      uom: "Pcs",
      batchSerial: "BATCH-2025-05",
      qty: 200,
      printQty: 200,
      labelTemplate: "Batch Label",
      sizeMm: "40 x 20",
      mrp: 1200.0,
      hsn: "6109",
      brand: "Puma",
    },
    {
      id: "row-4",
      selected: true,
      barcode: "SRL-000123",
      itemCode: "SERIAL-001",
      itemName: "Serial Item",
      uom: "Pcs",
      batchSerial: "SRL-000123",
      qty: 1,
      printQty: 1,
      labelTemplate: "Serial Label",
      sizeMm: "40 x 20",
      mrp: 3500.0,
      hsn: "6403",
      brand: "Formal",
    },
  ]);

  // Preview Index
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);

  // Print Settings State
  const [printer, setPrinter] = useState<string>("Zebra ZD420 (USB)");
  const [labelSize, setLabelSize] = useState<string>("50 x 25 mm");
  const [labelsPerRow, setLabelsPerRow] = useState<number>(3);
  const [copies, setCopies] = useState<number>(1);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showHsn, setShowHsn] = useState<boolean>(true);
  const [showTax, setShowTax] = useState<boolean>(true);
  const [showBatchSerial, setShowBatchSerial] = useState<boolean>(false);
  const [showBrand, setShowBrand] = useState<boolean>(false);
  const [printDirection, setPrintDirection] = useState<string>("Left to Right");
  const [printQuality, setPrintQuality] = useState<string>("High (300 DPI)");

  // Toast Notification
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        showToast("Refreshing Live Barcode Label Preview (F5)");
      } else if (e.key === "F10") {
        e.preventDefault();
        window.print();
      } else if (e.key === "Escape") {
        e.preventDefault();
        showToast("Close Print Labels Studio (ESC)");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Total Summaries
  const totalItems = printItems.length;
  const totalPrintQty = useMemo(() => {
    return printItems.reduce((acc, item) => acc + (item.selected ? item.printQty : 0), 0);
  }, [printItems]);

  const activeItem = printItems[activePreviewIndex] || printItems[0];

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
          <div className="relative">
            <input
              type="text"
              placeholder="Search (F2)"
              className="w-48 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 pl-8"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-sm">search</span>
          </div>
          <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-lg">notifications</span>
          </button>
          <button onClick={() => window.print()} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-lg">print</span>
          </button>
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
          {/* Section 1: Select Source (13 Icon Buttons) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center mb-3">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                1
              </span>
              Select Source
            </h2>
            <div className="flex flex-wrap gap-2">
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
                  onClick={() => {
                    setSelectedSource(src.id as SourceType);
                    showToast(`Source selected: ${src.label}`);
                  }}
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
          </section>

          {/* Section 2: Transaction / Context Filters */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center mb-3">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                2
              </span>
              Transaction / Context Filters <span className="text-slate-400 font-normal ml-2 text-[11px]">(Required for selected source)</span>
            </h2>
            <div className="grid grid-cols-7 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Doc No. From</label>
                <input
                  type="text"
                  value={docFrom}
                  onChange={(e) => setDocFrom(e.target.value)}
                  placeholder="From Document No..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Doc No. To</label>
                <input
                  type="text"
                  value={docTo}
                  onChange={(e) => setDocTo(e.target.value)}
                  placeholder="To Document No..."
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
          </section>

          {/* Section 3: Range / Boundary Filters (From -> To Grid) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  3
                </span>
                Range / Boundary Filters (From → To)
              </h2>
              <button
                onClick={resetFilters}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
              >
                <span className="material-symbols-outlined text-xs mr-1">restart_alt</span>
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
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
          </section>

          {/* Section 4: Items to Print Grid */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
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
                  onClick={() => showToast("Excel import initiated")}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">upload_file</span>
                  Import (Excel)
                </button>
                <button
                  onClick={() => {
                    const sel = printItems.filter((i) => i.selected);
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
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={printItems.length > 0 && printItems.every((i) => i.selected)}
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
                  {printItems.map((row, idx) => (
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
                              showToast(`Editing row ${idx + 1}`);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRow(row.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
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

        {/* Right Column (4 cols): Label Preview & Print Settings */}
        <div className="col-span-4 space-y-4">
          {/* Section 5: Label Preview Card */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center mb-3">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                5
              </span>
              Label Preview
            </h2>

            <div className="mb-3">
              <select className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-semibold text-slate-700">
                <option>Default Label (50 x 25 mm)</option>
                <option>Apparel Hangtag (75 x 50 mm)</option>
                <option>Jewelry Tag (38 x 12 mm)</option>
              </select>
            </div>

            {/* Visual SVG Barcode Label Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center shadow-inner relative min-h-[220px]">
              {activeItem ? (
                <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-md w-full max-w-[260px] text-center space-y-2">
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">{activeItem.itemName}</h3>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Item Code : {activeItem.itemCode} | HSN : {activeItem.hsn}
                  </div>

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
                  {printItems.length > 0 ? activePreviewIndex + 1 : 0} / {printItems.length}
                </span>
                <button
                  onClick={() => setActivePreviewIndex((prev) => Math.min(printItems.length - 1, prev + 1))}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            </div>
          </section>

          {/* Section 6: Print Settings */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                6
              </span>
              Print Settings
            </h2>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Printer</label>
              <div className="flex items-center space-x-1.5">
                <select
                  value={printer}
                  onChange={(e) => setPrinter(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
                >
                  <option>Zebra ZD420 (USB)</option>
                  <option>TSC TE200 (USB/LAN)</option>
                  <option>Godex EZ120</option>
                  <option>TVS LP 46 Neo</option>
                </select>
                <button className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg">
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
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-300 rounded-lg text-xs"
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
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-300 rounded-lg text-xs"
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
          </section>
        </div>
      </main>

      {/* Bottom Fixed Toolbar */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-lg z-20">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => showToast("Preview Mode Active (F5)")}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">visibility</span>
            Preview (F5)
          </button>
          <button
            onClick={() => window.print()}
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
    </div>
  );
};

export default PrintLabelsStudio;
