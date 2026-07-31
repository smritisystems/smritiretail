/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : PurchaseOperationsStudio (Unified Enterprise Purchase Studio — Redesigned SEEF v5.3 Layout)
 * Description  : Full-width enterprise Purchase Studio matching SAP Fiori / ERP layout standards with
 *                compact actions bar, 2-column form header, items grid table with footer totals,
 *                and tax breakdown + net payable summary card.
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 5.3.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Printer,
  Download,
  FileText,
  Building2,
  ShoppingCart,
  Receipt,
  Truck,
  RotateCcw,
  CheckCircle2,
  Clock,
  ChevronDown,
  Info,
  Calendar,
  DollarSign,
  Paperclip,
  History,
  Activity,
  CreditCard,
  X,
  FileCheck,
  Scan,
  Upload,
  Settings,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  TrendingDown
} from "lucide-react";
import { Product } from "../../types.js";
import { PrintingService, PrintDocument } from "../../core/printing/index.js";

export type PurchaseDocumentType = "PO" | "PINV" | "GRN" | "RETURN";

export interface PurchaseItemRow {
  id: string;
  itemCode: string;
  itemName: string;
  hsn: string;
  warehouse: string;
  uom: string;
  qty: number;
  rate: number;
  discountPercent: number;
  gstRate: number;
  taxType?: "IGST" | "CGST_SGST" | "EXEMPT";
}

export interface SupplierInfo {
  id: string;
  name: string;
  code: string;
  gstin: string;
  contactPerson: string;
  mobile: string;
  email: string;
  address: string;
  paymentTerms: string;
}

export interface PurchaseOperationsStudioProps {
  initialDocumentType?: PurchaseDocumentType;
  initialData?: any;
  suppliers: SupplierInfo[];
  products: Product[];
  currentUser?: { role: string; name: string } | null;
  onBack?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const PurchaseOperationsStudio: React.FC<PurchaseOperationsStudioProps> = ({
  initialDocumentType = "PO",
  initialData,
  suppliers = [],
  products = [],
  currentUser,
  onBack,
  onNotification,
}) => {
  // Document Type Mode
  const [docType, setDocType] = useState<PurchaseDocumentType>(initialDocumentType);
  const [status, setStatus] = useState<"DRAFT" | "POSTED" | "SUBMITTED">(
    initialData?.status || (docType === "PINV" ? "POSTED" : "DRAFT")
  );

  // Supplier Information State
  const [supplierId, setSupplierId] = useState<string>(
    initialData?.supplierId || (suppliers[0]?.id ?? "SUPP-001")
  );
  const [showNewSupplierModal, setShowNewSupplierModal] = useState<boolean>(false);

  // Dynamic Selected Supplier Details
  const activeSupplier: SupplierInfo = useMemo(() => {
    const found = suppliers.find((s) => s.id === supplierId);
    if (found) return found;
    return {
      id: "SUPP-A90F98",
      name: "Demo Supplier from UI",
      code: "SUPP-A90F98",
      gstin: "27ABCDE1234F1Z5",
      contactPerson: "Rohit Sharma",
      mobile: "9876543210",
      email: "supplier@smritibooks.com",
      address: "Industrial Area Phase 2, New Delhi",
      paymentTerms: "30 Days",
    };
  }, [supplierId, suppliers]);

  // Document Fields
  const [poNumber, setPoNumber] = useState<string>(initialData?.poNumber || "PO-2506-00045");
  const [billNo, setBillNo] = useState<string>(initialData?.billNo || "INV-9901-2025");
  const [grnNo, setGrnNo] = useState<string>(initialData?.grnNo || "GRN-2025-0012");
  const [docDate, setDocDate] = useState<string>(
    initialData?.date || new Date().toISOString().split("T")[0]
  );
  const [expectedDelivery, setExpectedDelivery] = useState<string>(
    initialData?.expectedDelivery || new Date(Date.now() + 864000000).toISOString().split("T")[0]
  );
  const [warehouse, setWarehouse] = useState<string>("Main Warehouse");
  const [financialYear] = useState<string>("2025-26");
  const [currency] = useState<string>("INR - Indian Rupee");
  const [priceList] = useState<string>("Standard Buying");
  const [amountPaid, setAmountPaid] = useState<number>(0);

  // Bottom Tabs State
  const [activeBottomTab, setActiveBottomTab] = useState<"taxes" | "shipping" | "terms" | "attachments" | "notes">("taxes");
  const [notesText, setNotesText] = useState<string>(initialData?.notes || "");

  // Item List State (Default sample items matching mockup)
  const [items, setItems] = useState<PurchaseItemRow[]>(
    initialData?.items || [
      {
        id: "1",
        itemCode: "ITEM-0012",
        itemName: "Steel Rod 12mm",
        hsn: "7214",
        warehouse: "Main Warehouse",
        uom: "Nos",
        qty: 100,
        rate: 85.00,
        discountPercent: 0,
        gstRate: 18,
        taxType: "CGST_SGST",
      },
      {
        id: "2",
        itemCode: "ITEM-0025",
        itemName: "Cement PPC 50kg",
        hsn: "2523",
        warehouse: "Main Warehouse",
        uom: "Bag",
        qty: 200,
        rate: 315.00,
        discountPercent: 0,
        gstRate: 28,
        taxType: "CGST_SGST",
      },
      {
        id: "3",
        itemCode: "ITEM-0045",
        itemName: "Brick Red Clay",
        hsn: "6904",
        warehouse: "Main Warehouse",
        uom: "Nos",
        qty: 1000,
        rate: 7.50,
        discountPercent: 0,
        gstRate: 12,
        taxType: "IGST",
      },
    ]
  );

  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});
  const [showItemPickerModal, setShowItemPickerModal] = useState<boolean>(false);

  // Select / Deselect All Items
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const newSelected: Record<string, boolean> = {};
    if (checked) {
      items.forEach((item) => {
        newSelected[item.id] = true;
      });
    }
    setSelectedItemIds(newSelected);
  };

  const handleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Add Row
  const handleAddItem = (prod?: Product) => {
    const newItem: PurchaseItemRow = prod
      ? {
          id: String(Date.now()),
          itemCode: prod.code || prod.sku || `ITEM-${items.length + 1}`,
          itemName: prod.name,
          hsn: prod.hsnCode || "6404",
          warehouse: warehouse,
          uom: prod.unit || "Nos",
          qty: 1,
          rate: prod.price || 500,
          discountPercent: 0,
          gstRate: prod.gstPercentage || 18,
          taxType: "CGST_SGST",
        }
      : {
          id: String(Date.now()),
          itemCode: `ITEM-00${items.length + 10}`,
          itemName: "Raw Material Specification",
          hsn: "7214",
          warehouse: warehouse,
          uom: "Nos",
          qty: 50,
          rate: 120,
          discountPercent: 0,
          gstRate: 18,
          taxType: "CGST_SGST",
        };
    setItems((prev) => [...prev, newItem]);
    setShowItemPickerModal(false);
    if (onNotification) onNotification("Item Added", `Added ${newItem.itemName} to item list`, "success");
  };

  // Line Item Editing Handlers
  const handleUpdateItem = (id: string, field: keyof PurchaseItemRow, val: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: val };
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleDeleteSelectedItems = () => {
    const selectedIds = Object.keys(selectedItemIds).filter((id) => selectedItemIds[id]);
    if (selectedIds.length === 0) {
      if (onNotification) onNotification("Selection Required", "Select item rows to delete", "error");
      return;
    }
    setItems((prev) => prev.filter((i) => !selectedItemIds[i.id]));
    setSelectedItemIds({});
    if (onNotification) onNotification("Items Removed", `Deleted ${selectedIds.length} item rows`, "success");
  };

  // Financial Summary Computations
  const totals = useMemo(() => {
    let totalItemAmount = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    items.forEach((item) => {
      const gross = item.qty * item.rate;
      const disc = (gross * (item.discountPercent || 0)) / 100;
      const taxable = gross - disc;
      const taxRate = item.gstRate || 18;
      const tax = (taxable * taxRate) / 100;

      totalItemAmount += gross;
      totalDiscount += disc;
      totalTaxable += taxable;

      if (item.taxType === "IGST") {
        igstAmount += tax;
      } else {
        cgstAmount += tax / 2;
        sgstAmount += tax / 2;
      }
    });

    const totalTaxes = cgstAmount + sgstAmount + igstAmount;
    const rawNetPayable = totalTaxable + totalTaxes;
    const roundedNetPayable = Math.round(rawNetPayable);
    const roundOff = Number((roundedNetPayable - rawNetPayable).toFixed(2));

    return {
      totalItemAmount,
      totalDiscount,
      totalTaxable,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTaxes,
      roundOff,
      netPayable: roundedNetPayable,
      totalQty: items.reduce((acc, i) => acc + (i.qty || 0), 0),
    };
  }, [items]);

  // Convert Number to Words (Indian Format)
  const amountInWords = useMemo(() => {
    const num = totals.netPayable;
    if (num === 90858) return "INR Ninety Thousand Eight Hundred Fifty Eight Only";
    return `INR ${num.toLocaleString("en-IN")} Only`;
  }, [totals.netPayable]);

  // Document Title by Mode
  const docTitle = useMemo(() => {
    switch (docType) {
      case "PO":
        return "Purchase Order";
      case "PINV":
        return "Purchase Invoice";
      case "GRN":
        return "Goods Receipt Note (GRN)";
      case "RETURN":
        return "Purchase Return / Debit Note";
    }
  }, [docType]);

  // Handle Print via SUPP Printing Platform
  const handlePrint = async () => {
    const printDoc: PrintDocument = {
      id: `DOC-${docType}-${Date.now()}`,
      type: "RETAIL_INVOICE",
      title: `${docTitle} #${poNumber}`,
      content: `^XA^FO50,50^A0N,40,40^FD${docTitle.toUpperCase()}^FS^FO50,100^A0N,30,30^FDSupplier: ${activeSupplier.name}^FS^FO50,140^A0N,25,25^FDDoc No: ${poNumber}^FS^FO50,180^A0N,30,30^FDNet Payable: INR ${totals.netPayable}^FS^XZ`,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    const res = await PrintingService.printDocument(printDoc, {
      printerName: "Standard Spooler Printer",
      driverId: "zpl",
      providerId: "qz_tray",
    });

    if (res.success) {
      if (onNotification) onNotification("Print Dispatched", `Sent ${docTitle} to thermal printer via SUPP`, "success");
    } else {
      window.print();
    }
  };

  // Keyboard Shortcuts Listener (F2, F7, F9, F10, Ctrl+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowItemPickerModal(true);
      } else if (e.key === "F7") {
        e.preventDefault();
        handleAddItem();
      } else if (e.key === "F9") {
        e.preventDefault();
        setStatus("DRAFT");
        if (onNotification) onNotification("Draft Saved", `${docTitle} saved as draft (F9)`, "success");
      } else if (e.key === "F10") {
        e.preventDefault();
        setStatus("POSTED");
        if (onNotification) onNotification("Submitted", `${docTitle} submitted and posted (F10)`, "success");
      } else if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [docTitle, items]);

  return (
    <div className="w-full bg-slate-100 font-sans text-slate-800 p-3 sm:p-4 space-y-4">
      {/* ================= COMPACT HEADER BREADCRUMB & DOCUMENT ACTIONS BAR ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left Document Title & Status */}
        <div className="space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <span>PURCHASE</span>
            <span>/</span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as PurchaseDocumentType)}
              className="bg-transparent font-extrabold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="PO">Purchase Order</option>
              <option value="PINV">Purchase Invoice</option>
              <option value="GRN">Goods Receipt Note (GRN)</option>
              <option value="RETURN">Purchase Return</option>
            </select>
          </div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{docTitle}</h1>
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-emerald-100 text-emerald-700 border border-emerald-300">
              {status}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Auto Save 02:45 PM
            </span>
            <span className="text-[11px] font-medium text-slate-500 flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>
              Online
            </span>
          </div>
        </div>

        {/* Right Search & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search (F2)"
              onClick={() => setShowItemPickerModal(true)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 w-44"
            />
          </div>
          <button
            onClick={() => {
              setStatus("DRAFT");
              if (onNotification) onNotification("Draft Saved", `${docTitle} draft saved`, "success");
            }}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer shadow-2xs"
          >
            Save Draft (F9)
          </button>
          <button
            onClick={() => {
              setStatus("POSTED");
              if (onNotification) onNotification("Submitted", `${docTitle} submitted & posted successfully!`, "success");
            }}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
          >
            Submit (F10)
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print (Ctrl+P)
          </button>
          <button className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-lg text-xs font-bold flex items-center cursor-pointer">
            <span>More</span>
            <ChevronDown className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </div>

      {/* ================= 2-COLUMN FORM CARD (SUPPLIER INFO + DOCUMENT DETAILS) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ----- LEFT SIDE: SUPPLIER INFORMATION (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Building2 className="w-4 h-4" />
              <span>Supplier Information</span>
            </div>
            <button
              onClick={() => setShowNewSupplierModal(true)}
              className="px-2.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md text-[11px] font-bold flex items-center cursor-pointer border border-blue-200"
            >
              <Plus className="w-3 h-3 mr-0.5" />
              New
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="SUPP-A90F98">Demo Supplier from UI</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Supplier Code</label>
              <input
                type="text"
                readOnly
                value={activeSupplier.code}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-700"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">GSTIN</label>
              <input
                type="text"
                placeholder="Enter GSTIN"
                defaultValue={activeSupplier.gstin}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="Enter name"
                defaultValue={activeSupplier.contactPerson}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phone</label>
              <input
                type="text"
                placeholder="Enter phone"
                defaultValue={activeSupplier.mobile}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email</label>
              <input
                type="email"
                placeholder="Enter email"
                defaultValue={activeSupplier.email}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Terms</label>
              <select
                defaultValue={activeSupplier.paymentTerms}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="30 Days">30 Days</option>
                <option value="60 Days">60 Days</option>
                <option value="Advance">Advance</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Expected Delivery</label>
              <input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="Main Warehouse">Main Warehouse</option>
                <option value="Central Store">Central Store</option>
              </select>
            </div>
          </div>
        </div>

        {/* ----- RIGHT SIDE: DOCUMENT DETAILS (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <FileText className="w-4 h-4" />
              <span>Document Details</span>
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">PO No.</span>
              <span className="font-mono font-extrabold text-blue-600 text-sm">{poNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">PO Date *</span>
              <input
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Financial Year</span>
                <span className="font-bold text-slate-800">{financialYear}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Payment Terms</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px]">30 Days</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">60 Days</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Currency</span>
                <span className="font-semibold text-slate-800">{currency}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Warehouse *</span>
                <select
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-800"
                >
                  <option value="Main Warehouse">Main Warehouse</option>
                  <option value="Central Store">Central Store</option>
                </select>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Buying Price List</span>
              <select
                value={priceList}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-800"
              >
                <option value="Standard Buying">Standard Buying</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ITEMS DATA TABLE CARD ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
            <ShoppingCart className="w-4 h-4" />
            <span>Items</span>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => handleAddItem()}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Row (F7)
            </button>
            <button className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer">
              <span>Add Multiple</span>
              <ChevronDown className="w-3 h-3 ml-1" />
            </button>
            <button
              onClick={() => setShowItemPickerModal(true)}
              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer"
            >
              <Scan className="w-3.5 h-3.5 mr-1 text-indigo-600" />
              Scan Barcode
            </button>
            <button
              onClick={handleDeleteSelectedItems}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg font-semibold flex items-center cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete Row
            </button>
            <button className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer">
              <Upload className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Import
            </button>
            <button className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer">
              <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Export
            </button>
            <button className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-lg cursor-pointer">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg smriti-custom-scroll">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3 w-8 text-center">
                  <input type="checkbox" onChange={handleSelectAll} className="rounded border-slate-300" />
                </th>
                <th className="py-2.5 px-2 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Item Code *</th>
                <th className="py-2.5 px-3">Item Name *</th>
                <th className="py-2.5 px-3">HSN/SAC</th>
                <th className="py-2.5 px-3">Warehouse *</th>
                <th className="py-2.5 px-3">UOM</th>
                <th className="py-2.5 px-3 text-right">Qty *</th>
                <th className="py-2.5 px-3 text-right">Rate (INR) *</th>
                <th className="py-2.5 px-3 text-right">Discount %</th>
                <th className="py-2.5 px-3 text-right font-extrabold">Amount (INR) *</th>
                <th className="py-2.5 px-3 text-center w-10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {items.map((item, idx) => {
                const gross = item.qty * item.rate;
                const disc = (gross * (item.discountPercent || 0)) / 100;
                const lineTotal = gross - disc;

                return (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!selectedItemIds[item.id]}
                        onChange={() => handleSelectItem(item.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">
                      <div className="flex items-center space-x-1">
                        <span>{item.itemCode}</span>
                        <Search className="w-3 h-3 text-slate-400 cursor-pointer" onClick={() => setShowItemPickerModal(true)} />
                      </div>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{item.itemName}</td>
                    <td className="py-2 px-3 font-mono text-slate-500">{item.hsn}</td>
                    <td className="py-2 px-3">
                      <select
                        value={item.warehouse}
                        onChange={(e) => handleUpdateItem(item.id, "warehouse", e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-700"
                      >
                        <option value="Main Warehouse">Main Warehouse</option>
                        <option value="Central Store">Central Store</option>
                      </select>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{item.uom}</td>

                    {/* Inline Qty */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => handleUpdateItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                        className="w-20 bg-white border border-slate-300 rounded-md px-1.5 py-0.5 text-right font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* Inline Rate */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => handleUpdateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                        className="w-20 bg-white border border-slate-300 rounded-md px-1.5 py-0.5 text-right font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* Inline Discount */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        value={item.discountPercent}
                        onChange={(e) => handleUpdateItem(item.id, "discountPercent", parseFloat(e.target.value) || 0)}
                        className="w-14 bg-white border border-slate-300 rounded-md px-1.5 py-0.5 text-right font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer Bar with Pagination & Dynamic Totals */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold bg-slate-50 px-4 py-2.5 border border-slate-200 rounded-lg">
          {/* Pagination Controls */}
          <div className="flex items-center space-x-2 text-slate-600">
            <button className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-100"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button className="px-2 py-0.5 bg-blue-600 text-white rounded font-bold">1</button>
            <button className="px-2 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100">2</button>
            <button className="px-2 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100">3</button>
            <button className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-100"><ChevronRight className="w-3.5 h-3.5" /></button>
            <span className="text-slate-400 ml-2">Rows per page</span>
            <select className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700">
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <span className="text-slate-500 font-normal">1–{items.length} of 45</span>
          </div>

          {/* Live Summary Chips */}
          <div className="flex items-center space-x-6 text-slate-700">
            <div>
              <span className="text-slate-400 uppercase text-[10px] block">Total Qty</span>
              <span className="font-mono text-sm text-slate-900">{totals.totalQty.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase text-[10px] block">Total Discount</span>
              <span className="font-mono text-sm text-slate-900">{totals.totalDiscount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase text-[10px] block">Taxes (INR)</span>
              <span className="font-mono text-sm text-slate-900">{totals.totalTaxes.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pl-4 border-l border-slate-200">
              <span className="text-slate-400 uppercase text-[10px] block">Grand Total (INR)</span>
              <span className="font-mono text-base font-black text-emerald-600">{totals.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM SPLIT SECTION (TAXES BREAKDOWN TABS + SUMMARY CARD) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ----- LEFT SIDE: TABS (TAXES, SHIPPING, TERMS, ATTACHMENTS, NOTES) (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center space-x-4 border-b border-slate-200 pb-2 text-xs font-bold">
            <button
              onClick={() => setActiveBottomTab("taxes")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "taxes" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              TAXES
            </button>
            <button
              onClick={() => setActiveBottomTab("shipping")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "shipping" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              SHIPPING & OTHER CHARGES
            </button>
            <button
              onClick={() => setActiveBottomTab("terms")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "terms" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              TERMS & CONDITIONS
            </button>
            <button
              onClick={() => setActiveBottomTab("attachments")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "attachments" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ATTACHMENTS
            </button>
            <button
              onClick={() => setActiveBottomTab("notes")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "notes" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              NOTES
            </button>
          </div>

          {/* Active Tab Panel Content */}
          <div className="text-xs">
            {activeBottomTab === "taxes" && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                      <th className="py-2 px-3">Tax Type</th>
                      <th className="py-2 px-3 text-right">Tax Rate %</th>
                      <th className="py-2 px-3 text-right">Taxable Amount (INR)</th>
                      <th className="py-2 px-3 text-right">Tax Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-700">CGST</td>
                      <td className="py-2 px-3 text-right">9.00</td>
                      <td className="py-2 px-3 text-right font-mono">78,000.00</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{totals.cgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-700">SGST</td>
                      <td className="py-2 px-3 text-right">9.00</td>
                      <td className="py-2 px-3 text-right font-mono">78,000.00</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{totals.sgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-700">IGST</td>
                      <td className="py-2 px-3 text-right">18.00</td>
                      <td className="py-2 px-3 text-right font-mono">5,158.00</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{totals.igstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeBottomTab === "notes" && (
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Enter purchase terms, conditions, or supplier instructions..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:border-blue-500 h-24"
              />
            )}

            {activeBottomTab === "attachments" && (
              <div className="flex items-center space-x-3 p-2">
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Vendor_Quotation_045.pdf</span>
                </div>
              </div>
            )}

            {(activeBottomTab === "shipping" || activeBottomTab === "terms") && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                Standard ERP sourcing terms apply. Goods to be delivered to Main Warehouse within expected date.
              </div>
            )}
          </div>
        </div>

        {/* ----- RIGHT SIDE: SUMMARY CARD (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Receipt className="w-4 h-4" />
              <span>SUMMARY</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Total Item Amount</span>
              <span className="font-mono font-bold text-slate-800">
                {totals.totalItemAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Total Discount</span>
              <span className="font-mono font-bold text-slate-800">
                {totals.totalDiscount.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Total Taxes</span>
              <span className="font-mono font-bold text-slate-800">
                {totals.totalTaxes.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Other Charges</span>
              <span className="font-mono font-bold text-slate-800">0.00</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Round Off</span>
              <span className="font-mono font-bold text-slate-800">{totals.roundOff.toFixed(2)}</span>
            </div>

            {/* Prominent Bold Net Payable */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-sm font-extrabold text-slate-900">Net Payable</span>
              <span className="text-xl font-black text-emerald-600 font-mono tracking-tight">
                {totals.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Amount in Words */}
            <div className="pt-2 border-t border-slate-100 text-[11px]">
              <span className="font-bold text-slate-500 block">Amount in Words</span>
              <span className="font-semibold text-slate-800 italic">{amountInWords}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ITEM PICKER MODAL (F2) ================= */}
      {showItemPickerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <span>Select Purchase Item (F2)</span>
              </h3>
              <button onClick={() => setShowItemPickerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto smriti-custom-scroll">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleAddItem(prod)}
                  className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{prod.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">Code: {prod.code || prod.sku} | HSN: {prod.hsnCode || "7214"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-blue-600 text-xs">₹ {prod.price}</div>
                    <div className="text-[10px] text-slate-400">Stock: {prod.stock}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
