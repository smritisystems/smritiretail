/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : PurchaseOperationsStudio (Unified Enterprise Purchase Studio)
 * Description  : Single unified Studio interface matching the exact layout for Purchase Order,
 *                Purchase Invoice, Goods Receipt Note (GRN), and Purchase Return.
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 4.0.0
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
} from "lucide-react";
import { Product } from "../../types.js";
import { PrintingService, PrintDocument } from "../../core/printing/index.js";
import { UniversalAttributeEngine } from "../../core/metadata/index.js";

export type PurchaseDocumentType = "PO" | "PINV" | "GRN" | "RETURN";

export interface PurchaseItemRow {
  id: string;
  itemCode: string;
  itemName: string;
  hsn: string;
  uom: string;
  qty: number;
  rate: number;
  discountPercent: number;
  gstRate: number; // STRE resolved
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
      id: "SUPP-00012",
      name: "ABC Footwear Pvt. Ltd.",
      code: "SUPP-00012",
      gstin: "27ABCDE1234F1Z5",
      contactPerson: "Rohit Sharma",
      mobile: "9876543210",
      email: "abcfootwear@gmail.com",
      address: "Shop No. 12, Market Road, Andheri (E), Mumbai - 400069, Maharashtra, India",
      paymentTerms: "30 Days",
    };
  }, [supplierId, suppliers]);

  // Operational Dates & Details
  const [docDate, setDocDate] = useState<string>(initialData?.date || "2025-05-31");
  const [expectedDelivery, setExpectedDelivery] = useState<string>(initialData?.expectedDelivery || "2025-05-15");
  const [warehouse, setWarehouse] = useState<string>(initialData?.warehouse || "Main Warehouse");
  const [poNumber, setPoNumber] = useState<string>(initialData?.orderNo || "PO-2506-00045");
  const [billNo, setBillNo] = useState<string>(initialData?.billNo || "PINV-2506-00115");
  const [grnNo, setGrnNo] = useState<string>(initialData?.grnNo || "GRN-2505-00221");
  const [financialYear, setFinancialYear] = useState<string>("2025-26");
  const [currency, setCurrency] = useState<string>("INR - Indian Rupee");
  const [priceList, setPriceList] = useState<string>("Standard Buying");
  const [amountPaid, setAmountPaid] = useState<number>(initialData?.amountPaid ?? 266656.0);

  // Bottom Tabs
  const [activeBottomTab, setActiveBottomTab] = useState<"attachments" | "notes" | "payment" | "history" | "activities">("attachments");
  const [notesText, setNotesText] = useState<string>(initialData?.notes || "");

  // Line Items Grid
  const [items, setItems] = useState<PurchaseItemRow[]>(
    initialData?.items
      ? initialData.items
      : [
          {
            id: "1",
            itemCode: "SHO-1001",
            itemName: "Sports Shoes (Black)",
            hsn: "64041190",
            uom: "Pair",
            qty: 120,
            rate: 1250.0,
            discountPercent: 2.0,
            gstRate: 18,
            taxType: "IGST",
          },
          {
            id: "2",
            itemCode: "SHO-1002",
            itemName: "Casual Shoes (Brown)",
            hsn: "64041990",
            uom: "Pair",
            qty: 80,
            rate: 950.0,
            discountPercent: 1.0,
            gstRate: 18,
            taxType: "IGST",
          },
          {
            id: "3",
            itemCode: "ACC-3001",
            itemName: "Shoe Laces",
            hsn: "56090000",
            uom: "Pcs",
            qty: 500,
            rate: 15.0,
            discountPercent: 0.0,
            gstRate: 18,
            taxType: "IGST",
          },
        ]
  );

  // Item Picker Search
  const [itemSearchQuery, setItemSearchQuery] = useState<string>("");
  const [showItemPickerModal, setShowItemPickerModal] = useState<boolean>(false);

  // Add Item to Grid Handler
  const handleAddItem = (prod?: Product) => {
    const newItem: PurchaseItemRow = prod
      ? {
          id: String(Date.now()),
          itemCode: prod.code || prod.sku || `ITEM-${items.length + 1}`,
          itemName: prod.name,
          hsn: (prod as any).hsn || "64041190",
          uom: (prod as any).unit || (prod as any).uom || "Pcs",
          qty: 1,
          rate: prod.costPrice || prod.price || 100,
          discountPercent: 0,
          gstRate: (prod as any).taxRate || 18,
          taxType: "IGST",
        }
      : {
          id: String(Date.now()),
          itemCode: `ITEM-100${items.length + 1}`,
          itemName: "New Raw Material Item",
          hsn: "64041190",
          uom: "Pair",
          qty: 10,
          rate: 500,
          discountPercent: 0,
          gstRate: 18,
          taxType: "IGST",
        };
    setItems((prev) => [...prev, newItem]);
    setShowItemPickerModal(false);
    if (onNotification) onNotification("Item Added", `Added ${newItem.itemName} to purchase list`, "success");
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

  const handleDeleteAllItems = () => {
    if (window.confirm("Are you sure you want to clear all purchase items?")) {
      setItems([]);
    }
  };

  // Financial Summary Computations (STRE Auto Tax Resolution)
  const totals = useMemo(() => {
    let basicAmount = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let taxAmount = 0;

    items.forEach((item) => {
      const gross = item.qty * item.rate;
      const disc = (gross * (item.discountPercent || 0)) / 100;
      const taxable = gross - disc;
      const tax = (taxable * (item.gstRate || 0)) / 100;

      basicAmount += gross;
      discountAmount += disc;
      taxableAmount += taxable;
      taxAmount += tax;
    });

    const rawGrandTotal = taxableAmount + taxAmount;
    const roundedGrandTotal = Math.round(rawGrandTotal);
    const roundOff = Number((roundedGrandTotal - rawGrandTotal).toFixed(2));
    const balanceDue = Math.max(0, roundedGrandTotal - amountPaid);

    return {
      basicAmount,
      discountAmount,
      taxableAmount,
      taxAmount,
      roundOff,
      grandTotal: roundedGrandTotal,
      balanceDue,
      totalQty: items.reduce((acc, i) => acc + (i.qty || 0), 0),
    };
  }, [items, amountPaid]);

  // Document Title & Labels by Mode
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
      content: `^XA^FO50,50^A0N,40,40^FD${docTitle.toUpperCase()}^FS^FO50,100^A0N,30,30^FDSupplier: ${activeSupplier.name}^FS^FO50,140^A0N,25,25^FDDoc No: ${poNumber}^FS^FO50,180^A0N,30,30^FDGrand Total: INR ${totals.grandTotal}^FS^XZ`,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    const res = await PrintingService.printDocument(printDoc, {
      printerName: "Standard Spooler Printer",
      driverId: "zpl",
      providerId: "qz_tray",
    });

    if (res.success) {
      if (onNotification) onNotification("Print Sent", `Dispatched ${docTitle} to printer via SUPP`, "success");
    } else {
      window.print();
    }
  };

  // Keyboard Shortcuts Listener (F2, F3, F9, F10, Ctrl+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowItemPickerModal(true);
      } else if (e.key === "F3") {
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
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-4 space-y-4">
      {/* ================= HEADER TOOLBAR ================= */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left Title & Breadcrumb */}
        <div className="flex items-center space-x-3">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
              <span>Purchase</span>
              <span>/</span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as PurchaseDocumentType)}
                className="bg-transparent font-bold text-slate-600 focus:outline-none cursor-pointer"
              >
                <option value="PO">Purchase Order</option>
                <option value="PINV">Purchase Invoice</option>
                <option value="GRN">Goods Receipt Note (GRN)</option>
                <option value="RETURN">Purchase Return</option>
              </select>
            </div>
            <div className="flex items-center space-x-3 mt-0.5">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{docTitle}</h1>
              {/* Status Badge */}
              <span
                className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider ${
                  status === "POSTED"
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : status === "SUBMITTED"
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-amber-100 text-amber-700 border border-amber-300"
                }`}
              >
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
        </div>

        {/* Right Quick Actions */}
        <div className="flex items-center space-x-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search (F2)"
              onClick={() => setShowItemPickerModal(true)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 w-44"
            />
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => {
              setStatus("DRAFT");
              if (onNotification) onNotification("Draft Saved", `${docTitle} draft saved`, "success");
            }}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer shadow-2xs"
          >
            Save Draft (F9)
          </button>
          <button
            onClick={() => {
              setStatus("POSTED");
              if (onNotification) onNotification("Posted", `${docTitle} submitted & posted successfully!`, "success");
            }}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
          >
            {docType === "PINV" ? "Post (F10)" : "Submit (F10)"}
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center cursor-pointer"
            title="Print Document (Ctrl+P)"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print (Ctrl+P)
          </button>
        </div>
      </div>

      {/* ================= MAIN SPLIT CONTENT LAYOUT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ================= LEFT COLUMN (70% WIDTH) ================= */}
        <div className="lg:col-span-8 space-y-4">
          {/* ----- SUPPLIER INFORMATION CARD ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
                <Building2 className="w-4 h-4" />
                <span>Supplier Information</span>
              </div>
              <button
                onClick={() => setShowNewSupplierModal(true)}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[11px] font-bold flex items-center cursor-pointer border border-blue-200"
              >
                <Plus className="w-3 h-3 mr-1" />
                New
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              {/* Supplier Select */}
              <div className="md:col-span-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="SUPP-00012">ABC Footwear Pvt. Ltd.</option>
                </select>
              </div>

              {/* Supplier Code */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Supplier Code</label>
                <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700">
                  {activeSupplier.code}
                </div>
              </div>

              {/* GSTIN */}
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">GSTIN</label>
                <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700">
                  {activeSupplier.gstin}
                </div>
              </div>

              {/* Contact Person */}
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Contact Person</label>
                <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 truncate">
                  {activeSupplier.contactPerson}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs pt-1 border-t border-slate-50">
              {/* Address & Email */}
              <div className="md:col-span-5 space-y-1">
                <div className="text-[11px] font-medium text-slate-600 truncate">{activeSupplier.email}</div>
                <div className="text-[11px] font-normal text-slate-500 line-clamp-2">{activeSupplier.address}</div>
              </div>

              {/* Payment Terms */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Terms</label>
                <div className="text-xs font-semibold text-slate-800">{activeSupplier.paymentTerms}</div>
              </div>

              {/* Expected Delivery / Posting Date */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  {docType === "PINV" ? "Bill Date *" : "Expected Delivery"}
                </label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700"
                />
              </div>

              {/* Warehouse */}
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  <option value="Main Warehouse">Main Warehouse</option>
                  <option value="Central Store">Central Store</option>
                  <option value="Showroom Inventory">Showroom Inventory</option>
                </select>
              </div>
            </div>
          </div>

          {/* ----- ITEMS DATA TABLE CARD ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide">
                <ShoppingCart className="w-4 h-4" />
                <span>Items</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleAddItem()}
                  className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold flex items-center cursor-pointer border border-blue-200"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Item (F3)
                </button>
                <button
                  onClick={handleDeleteAllItems}
                  className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold flex items-center cursor-pointer border border-red-200"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete All
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 font-extrabold">Item Code</th>
                    <th className="py-2.5 px-3 font-extrabold">Item Name</th>
                    <th className="py-2.5 px-3">HSN</th>
                    <th className="py-2.5 px-3">UOM</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right">Discount %</th>
                    {docType === "PINV" && <th className="py-2.5 px-3 text-right">Taxable (₹)</th>}
                    <th className="py-2.5 px-3 text-center">Tax (Auto STRE)</th>
                    <th className="py-2.5 px-3 text-right font-extrabold">Amount (₹)</th>
                    <th className="py-2.5 px-3 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((item, idx) => {
                    const gross = item.qty * item.rate;
                    const disc = (gross * (item.discountPercent || 0)) / 100;
                    const taxable = gross - disc;
                    const tax = (taxable * (item.gstRate || 0)) / 100;
                    const lineTotal = taxable + tax;

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{item.itemCode}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{item.itemName}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{item.hsn}</td>
                        <td className="py-2 px-3 text-slate-600">{item.uom}</td>

                        {/* Inline Editable Qty */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleUpdateItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                            className="w-16 bg-white border border-slate-300 rounded-md px-1.5 py-0.5 text-right font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Inline Editable Rate */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => handleUpdateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                            className="w-20 bg-white border border-slate-300 rounded-md px-1.5 py-0.5 text-right font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Inline Editable Discount */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={item.discountPercent}
                            onChange={(e) =>
                              handleUpdateItem(item.id, "discountPercent", parseFloat(e.target.value) || 0)
                            }
                            className="w-14 bg-white border border-slate-300 rounded-md px-1.5 py-0.5 text-right font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        {docType === "PINV" && (
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                            {taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        )}

                        {/* STRE Auto Tax Badge */}
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold uppercase">
                            {item.gstRate}% {item.taxType || "IGST"}
                          </span>
                        </td>

                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 hover:bg-red-50 text-red-500 rounded-md cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Grid Footer Summary Row */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 border border-slate-200 rounded-lg">
              <div>Total Items: <span className="text-blue-700">{items.length}</span></div>
              <div>Total Qty: <span className="text-blue-700">{totals.totalQty}</span></div>
            </div>
          </div>

          {/* ----- BOTTOM TABS CARD ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center space-x-4 border-b border-slate-200 pb-2">
              <button
                onClick={() => setActiveBottomTab("attachments")}
                className={`text-xs font-bold pb-1 flex items-center space-x-1 cursor-pointer ${
                  activeBottomTab === "attachments"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Attachments (2)</span>
              </button>
              <button
                onClick={() => setActiveBottomTab("notes")}
                className={`text-xs font-bold pb-1 flex items-center space-x-1 cursor-pointer ${
                  activeBottomTab === "notes"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Notes</span>
              </button>
              <button
                onClick={() => setActiveBottomTab("payment")}
                className={`text-xs font-bold pb-1 flex items-center space-x-1 cursor-pointer ${
                  activeBottomTab === "payment"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Payment</span>
              </button>
              <button
                onClick={() => setActiveBottomTab("history")}
                className={`text-xs font-bold pb-1 flex items-center space-x-1 cursor-pointer ${
                  activeBottomTab === "history"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </button>
            </div>

            <div className="text-xs text-slate-600">
              {activeBottomTab === "notes" ? (
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Enter purchase terms, conditions, or vendor instructions..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:border-blue-500 h-20"
                />
              ) : activeBottomTab === "attachments" ? (
                <div className="flex items-center space-x-3">
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Vendor_Invoice_INV-9901.pdf</span>
                  </div>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>Lorry_Receipt_LR-8821.pdf</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 italic">No additional payment audit records.</div>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (30% WIDTH) ================= */}
        <div className="lg:col-span-4 space-y-4">
          {/* ----- DOCUMENT DETAILS CARD ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide border-b border-slate-100 pb-2">
              <FileText className="w-4 h-4" />
              <span>Document Details</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Document Number */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">{docType === "PINV" ? "Bill No." : "PO No."}</span>
                <span className="font-mono font-extrabold text-slate-900">
                  {docType === "PINV" ? billNo : poNumber}
                </span>
              </div>

              {/* Reference Numbers for Invoice */}
              {docType === "PINV" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">PO Ref:</span>
                    <span className="font-mono font-bold text-blue-700 cursor-pointer">{poNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">GRN Ref:</span>
                    <span className="font-mono font-bold text-blue-700 cursor-pointer">{grnNo}</span>
                  </div>
                </>
              )}

              {/* Date */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">{docType === "PINV" ? "Posting Date *" : "PO Date *"}</span>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-800"
                />
              </div>

              {/* Financial Year */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Financial Year</span>
                <span className="font-semibold text-slate-800">{financialYear}</span>
              </div>

              {/* Currency */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Currency</span>
                <span className="font-semibold text-slate-800">{currency}</span>
              </div>

              {/* Price List */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Buying Price List</span>
                <span className="font-semibold text-slate-800">{priceList}</span>
              </div>
            </div>
          </div>

          {/* ----- ORDER / INVOICE SUMMARY CARD ----- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wide border-b border-slate-100 pb-2">
              <Receipt className="w-4 h-4" />
              <span>{docType === "PINV" ? "Invoice Summary" : "Order Summary"}</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Total Basic Amount</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹ {totals.basicAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Total Discount</span>
                <span className="font-mono font-bold text-red-600">
                  - {totals.discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-700 font-semibold pt-1 border-t border-slate-100">
                <span>Taxable Amount</span>
                <span className="font-mono font-extrabold text-slate-900">
                  ₹ {totals.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* STRE Resolved Tax Breakdown */}
              <div className="flex items-center justify-between text-slate-600">
                <span>IGST @18%</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹ {totals.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <span>Round Off</span>
                <span className="font-mono font-medium text-slate-700">₹ {totals.roundOff}</span>
              </div>

              {/* Prominent Large Green Grand Total */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-sm font-extrabold text-slate-900">Grand Total</span>
                <span className="text-xl font-black text-emerald-600 font-mono tracking-tight">
                  ₹ {totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Amount Paid & Balance Due for Purchase Invoice */}
              {docType === "PINV" && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Amount Paid</span>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                      className="w-28 bg-slate-50 border border-slate-300 rounded-md px-2 py-0.5 text-right font-mono font-bold text-slate-800"
                    />
                  </div>

                  {/* Highlighted Mint Box for Balance Due */}
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-bold">
                    <span className="text-xs">Balance Due</span>
                    <span className="text-base font-extrabold font-mono text-emerald-700">
                      ₹ {totals.balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
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

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={itemSearchQuery}
                onChange={(e) => setItemSearchQuery(e.target.value)}
                placeholder="Search item code, name, HSN..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
              {products
                .filter(
                  (p) =>
                    !itemSearchQuery ||
                    p.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
                    (p.code || "").toLowerCase().includes(itemSearchQuery.toLowerCase())
                )
                .slice(0, 8)
                .map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => handleAddItem(prod)}
                    className="py-2 px-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between rounded-lg transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{prod.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{prod.code || prod.sku || "ART-100"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-blue-700">₹ {prod.costPrice || prod.price || 100}</div>
                      <span className="text-[9px] font-bold text-emerald-600">Stock: {prod.stock || 50}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= NEW SUPPLIER MODAL ================= */}
      {showNewSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Create New Vendor / Supplier</span>
              </h3>
              <button onClick={() => setShowNewSupplierModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Supplier Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Footwear Pvt. Ltd."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mobile</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Market Road, Mumbai, Maharashtra"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowNewSupplierModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNewSupplierModal(false);
                  if (onNotification) onNotification("Supplier Created", "New vendor added successfully", "success");
                }}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
