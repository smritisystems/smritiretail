/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : PurchaseOperationsStudio (Unified Enterprise Purchase Studio — Multi-Mode Selection & Variant Matrix v6.0)
 * Description  : Enterprise Procurement Studio supporting multi-mode item entry (+ Add Items dropdown),
 *                Fashion / Apparel Variant Matrix Entry (Color × Size Grid), Pivot View Modes,
 *                and metadata-driven SPK.entities integration.
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 6.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  Trash2,
  Printer,
  Download,
  FileText,
  Building2,
  ShoppingCart,
  Receipt,
  Truck,
  ChevronDown,
  Paperclip,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Scan,
  Upload,
  Settings,
  Grid,
  Layers,
  Sparkles,
  Tag,
  Package,
  X,
  Check
} from "lucide-react";
import { Product } from "../../types.js";
import { PrintingService, PrintDocument } from "../../core/printing/index.js";

export type PurchaseDocumentType = "PO" | "PINV" | "GRN" | "RETURN";
export type AddItemMode =
  | "CODE"
  | "BARCODE"
  | "ARTICLE"
  | "STYLE"
  | "MODEL"
  | "MATRIX"
  | "BRAND"
  | "CATEGORY"
  | "CATALOG"
  | "EXCEL";

export type PivotViewMode = "STANDARD" | "SIZE" | "COLOR" | "ARTICLE" | "STYLE";

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
  articleCode?: string;
  color?: string;
  size?: string;
  style?: string;
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
  industryPack?: "Apparel" | "Footwear" | "Jewellery" | "Electronics" | "Grocery" | "Pharmacy";
  onBack?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const PurchaseOperationsStudio: React.FC<PurchaseOperationsStudioProps> = ({
  initialDocumentType = "PO",
  initialData,
  suppliers = [],
  products = [],
  currentUser,
  industryPack = "Apparel",
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

  // Active Supplier Details
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
  const [poNumber] = useState<string>(initialData?.poNumber || "PO-2506-00045");
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

  // UI Multi-Mode States
  const [showAddItemsMenu, setShowAddItemsMenu] = useState<boolean>(false);
  const [showVariantMatrixModal, setShowVariantMatrixModal] = useState<boolean>(false);
  const [showItemPickerModal, setShowItemPickerModal] = useState<boolean>(false);
  const [pivotViewMode, setPivotViewMode] = useState<PivotViewMode>("STANDARD");

  // Bottom Tabs State
  const [activeBottomTab, setActiveBottomTab] = useState<"taxes" | "shipping" | "terms" | "attachments" | "notes">("taxes");
  const [notesText, setNotesText] = useState<string>(initialData?.notes || "");

  // Item List State
  const [items, setItems] = useState<PurchaseItemRow[]>(
    initialData?.items || [
      {
        id: "1",
        itemCode: "TS-1001-BLK-M",
        itemName: "Polo T-Shirt (Black / M)",
        hsn: "6109",
        warehouse: "Main Warehouse",
        uom: "Pcs",
        qty: 15,
        rate: 850.00,
        discountPercent: 0,
        gstRate: 12,
        taxType: "CGST_SGST",
        articleCode: "TS-1001",
        color: "Black",
        size: "M",
        style: "Polo T-Shirt",
      },
      {
        id: "2",
        itemCode: "TS-1001-BLU-L",
        itemName: "Polo T-Shirt (Blue / L)",
        hsn: "6109",
        warehouse: "Main Warehouse",
        uom: "Pcs",
        qty: 20,
        rate: 850.00,
        discountPercent: 0,
        gstRate: 12,
        taxType: "CGST_SGST",
        articleCode: "TS-1001",
        color: "Blue",
        size: "L",
        style: "Polo T-Shirt",
      },
      {
        id: "3",
        itemCode: "SH-205-BRN-42",
        itemName: "Oxford Leather Shoe (Brown / 42)",
        hsn: "6403",
        warehouse: "Main Warehouse",
        uom: "Pair",
        qty: 10,
        rate: 2450.00,
        discountPercent: 0,
        gstRate: 18,
        taxType: "IGST",
        articleCode: "SH-205",
        color: "Brown",
        size: "42",
        style: "Oxford Leather",
      },
    ]
  );

  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});

  // Variant Matrix Modal State (Color × Size Grid)
  const [selectedArticle, setSelectedArticle] = useState({
    articleCode: "TS-1001",
    articleName: "Cotton Polo T-Shirt Premium",
    style: "Polo Fit",
    hsn: "6109",
    uom: "Pcs",
    baseRate: 850,
  });

  const availableColors = ["Black", "Blue", "White", "Red", "Navy"];
  const availableSizes = ["XS", "S", "M", "L", "XL", "XXL"];

  // 2D Matrix Qty Map: [color_size] -> quantity
  const [matrixQtyMap, setMatrixQtyMap] = useState<Record<string, number>>({
    "Black_S": 10,
    "Black_M": 15,
    "Black_L": 20,
    "Blue_S": 5,
    "Blue_M": 10,
    "Blue_L": 15,
    "White_M": 10,
    "White_L": 10,
  });

  const handleMatrixQtyChange = (color: string, size: string, val: number) => {
    const key = `${color}_${size}`;
    setMatrixQtyMap((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  // Generate Individual Purchase Line Items from Variant Matrix
  const handleGenerateMatrixLines = () => {
    const newLines: PurchaseItemRow[] = [];
    let totalAddedQty = 0;

    availableColors.forEach((color) => {
      availableSizes.forEach((size) => {
        const key = `${color}_${size}`;
        const qty = matrixQtyMap[key] || 0;
        if (qty > 0) {
          totalAddedQty += qty;
          const colorCode = color.substring(0, 3).toUpperCase();
          const itemCode = `${selectedArticle.articleCode}-${colorCode}-${size}`;
          newLines.push({
            id: String(Date.now() + Math.random()),
            itemCode: itemCode,
            itemName: `${selectedArticle.articleName} (${color} / ${size})`,
            hsn: selectedArticle.hsn,
            warehouse: warehouse,
            uom: selectedArticle.uom,
            qty: qty,
            rate: selectedArticle.baseRate,
            discountPercent: 0,
            gstRate: 12,
            taxType: "CGST_SGST",
            articleCode: selectedArticle.articleCode,
            color: color,
            size: size,
            style: selectedArticle.style,
          });
        }
      });
    });

    if (newLines.length === 0) {
      if (onNotification) onNotification("Empty Matrix", "Enter quantities in color/size matrix before generating lines", "error");
      return;
    }

    setItems((prev) => [...prev, ...newLines]);
    setShowVariantMatrixModal(false);
    if (onNotification)
      onNotification(
        "Variant Lines Generated",
        `Created ${newLines.length} variant purchase lines (${totalAddedQty} pcs) from Article ${selectedArticle.articleCode}`,
        "success"
      );
  };

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

  // Add Item Handler
  const handleAddItem = (prod?: Product, mode: AddItemMode = "CODE") => {
    if (mode === "MATRIX") {
      setShowVariantMatrixModal(true);
      setShowAddItemsMenu(false);
      return;
    }

    const newItem: PurchaseItemRow = prod
      ? {
          id: String(Date.now()),
          itemCode: prod.code || prod.sku || `ITEM-${items.length + 1}`,
          itemName: prod.name,
          hsn: prod.hsnCode || "6404",
          warehouse: warehouse,
          uom: prod.unit || "Pcs",
          qty: 1,
          rate: prod.price || 500,
          discountPercent: 0,
          gstRate: prod.gstPercentage || 18,
          taxType: "CGST_SGST",
          articleCode: prod.code || "ART-100",
        }
      : {
          id: String(Date.now()),
          itemCode: `ART-10${items.length + 1}-BLK-L`,
          itemName: `Fashion Apparel Specification ${items.length + 1}`,
          hsn: "6109",
          warehouse: warehouse,
          uom: "Pcs",
          qty: 12,
          rate: 750,
          discountPercent: 0,
          gstRate: 12,
          taxType: "CGST_SGST",
          articleCode: `ART-10${items.length + 1}`,
          color: "Black",
          size: "L",
          style: "Polo Fit",
        };

    setItems((prev) => [...prev, newItem]);
    setShowItemPickerModal(false);
    setShowAddItemsMenu(false);
    if (onNotification) onNotification("Item Added", `Added ${newItem.itemName} to purchase order`, "success");
  };

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

  const amountInWords = useMemo(() => {
    const num = totals.netPayable;
    return `INR ${num.toLocaleString("en-IN")} Only`;
  }, [totals.netPayable]);

  const docTitle = useMemo(() => {
    switch (docType) {
      case "PO":
        return "Purchase Order";
      case "PINV":
        return "Purchase Invoice";
      case "GRN":
        return "Goods Receipt Note";
      case "RETURN":
        return "Purchase Return";
    }
  }, [docType]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowItemPickerModal(true);
      } else if (e.key === "F7") {
        e.preventDefault();
        setShowVariantMatrixModal(true);
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
    <div className="w-full bg-slate-100 font-sans text-slate-800 p-2.5 sm:p-3 space-y-3">
      {/* ================= SINGLE HORIZONTAL TOOLBAR ================= */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        {/* Left Title & Industry Badge */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PURCHASE /</span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as PurchaseDocumentType)}
            className="bg-transparent font-bold text-slate-700 text-xs focus:outline-none cursor-pointer"
          >
            <option value="PO">Purchase Order</option>
            <option value="PINV">Purchase Invoice</option>
            <option value="GRN">Goods Receipt Note</option>
            <option value="RETURN">Purchase Return</option>
          </select>
          <h1 className="text-base font-extrabold text-slate-900 tracking-tight ml-1">{docTitle}</h1>
          <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
            {status}
          </span>
          <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1">
            <Sparkles className="w-2.5 h-2.5 mr-0.5 text-indigo-600" />
            <span>INDUSTRY: {industryPack}</span>
          </span>
        </div>

        {/* Right Actions & PO Number */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search (F2)"
              onClick={() => setShowItemPickerModal(true)}
              className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 w-36"
            />
          </div>
          <button
            onClick={() => {
              setStatus("DRAFT");
              if (onNotification) onNotification("Draft Saved", `${docTitle} draft saved`, "success");
            }}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-700 cursor-pointer shadow-2xs"
          >
            Save Draft (F9)
          </button>
          <button
            onClick={() => {
              setStatus("POSTED");
              if (onNotification) onNotification("Submitted", `${docTitle} submitted & posted!`, "success");
            }}
            className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow-xs cursor-pointer"
          >
            Submit (F10)
          </button>
          <button
            onClick={handlePrint}
            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-md font-bold flex items-center cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print
          </button>
          <div className="pl-2 border-l border-slate-200 text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">PO No.</span>
            <span className="font-mono font-extrabold text-blue-600 text-xs">{poNumber}</span>
          </div>
        </div>
      </div>

      {/* ================= 2-COLUMN MASTER FORM (SUPPLIER INFO + DOCUMENT DETAILS) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ----- SUPPLIER INFORMATION (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Building2 className="w-3.5 h-3.5" />
              <span>Supplier Information</span>
            </div>
            <button className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold flex items-center border border-blue-200">
              <Plus className="w-3 h-3 mr-0.5" />
              New
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="SUPP-A90F98">Demo Supplier from UI</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Supplier Code</label>
              <input type="text" readOnly value={activeSupplier.code} className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-slate-700" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">GSTIN</label>
              <input type="text" defaultValue={activeSupplier.gstin} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Contact Person</label>
              <input type="text" defaultValue={activeSupplier.contactPerson} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Expected Delivery</label>
              <input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Warehouse *</label>
              <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800">
                <option value="Main Warehouse">Main Warehouse</option>
                <option value="Central Store">Central Store</option>
              </select>
            </div>
          </div>
        </div>

        {/* ----- DOCUMENT DETAILS (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5" />
              <span>Document Details</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Financial Year</span>
              <span className="font-bold text-slate-800 text-xs">{financialYear}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Payment Terms</span>
              <div className="flex items-center space-x-1">
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px]">30 Days</span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">60 Days</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Currency</span>
              <span className="font-semibold text-slate-800 text-xs">{currency}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Buying Price List</span>
              <span className="font-semibold text-slate-800 text-xs">{priceList}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ITEMS DATA TABLE CARD (WITH MULTI-MODE + VARIANT MATRIX ENTRY) ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <ShoppingCart className="w-4 h-4" />
              <span>Items ({items.length})</span>
            </div>

            {/* Pivot View Selector */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-bold border border-slate-200">
              <span className="text-slate-400 px-1.5 uppercase text-[9px]">View:</span>
              <select
                value={pivotViewMode}
                onChange={(e) => setPivotViewMode(e.target.value as PivotViewMode)}
                className="bg-transparent font-extrabold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="STANDARD">Standard Grid</option>
                <option value="SIZE">Pivot by Size</option>
                <option value="COLOR">Pivot by Color</option>
                <option value="ARTICLE">Pivot by Article</option>
                <option value="STYLE">Pivot by Style</option>
              </select>
            </div>
          </div>

          {/* Action Toolbar with Multi-Mode + Add Items Dropdown */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Split Button: + Add Items Dropdown */}
            <div className="relative inline-block">
              <div className="flex items-center shadow-xs rounded-lg overflow-hidden border border-blue-700">
                <button
                  onClick={() => setShowVariantMatrixModal(true)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center cursor-pointer text-[11px]"
                  title="Open Apparel / Footwear Variant Matrix Entry (F7)"
                >
                  <Grid className="w-3.5 h-3.5 mr-1" />
                  + Add Items (Variant Matrix)
                </button>
                <button
                  onClick={() => setShowAddItemsMenu(!showAddItemsMenu)}
                  className="px-1.5 py-1 bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center cursor-pointer border-l border-blue-500"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Multi-Mode Dropdown Menu */}
              {showAddItemsMenu && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1 text-xs space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 tracking-wider border-b border-slate-100">
                    Selection Entry Mode
                  </div>
                  <button
                    onClick={() => handleAddItem(undefined, "MATRIX")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 rounded-lg flex items-center justify-between text-blue-700 font-bold"
                  >
                    <span className="flex items-center"><Grid className="w-3.5 h-3.5 mr-2 text-indigo-600" />By Variant Matrix (Color × Size)</span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1 rounded font-mono">RECOMMENDED</span>
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "ARTICLE")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold"
                  >
                    <Tag className="w-3.5 h-3.5 mr-2 text-slate-500" />By Article Code
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "BARCODE")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold"
                  >
                    <Scan className="w-3.5 h-3.5 mr-2 text-slate-500" />By Barcode / SKU
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "STYLE")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold"
                  >
                    <Package className="w-3.5 h-3.5 mr-2 text-slate-500" />By Style / Model
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "BRAND")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold"
                  >
                    <Building2 className="w-3.5 h-3.5 mr-2 text-slate-500" />By Brand / Category
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "EXCEL")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold border-t border-slate-100"
                  >
                    <Upload className="w-3.5 h-3.5 mr-2 text-emerald-600" />Bulk Excel Import
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowItemPickerModal(true)}
              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]"
            >
              <Scan className="w-3 h-3 mr-1 text-indigo-600" />
              Scan Barcode
            </button>
            <button
              onClick={handleDeleteSelectedItems}
              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete Row
            </button>
            <button className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]">
              <Upload className="w-3 h-3 mr-1 text-slate-500" />
              Import
            </button>
            <button className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]">
              <Download className="w-3 h-3 mr-1 text-slate-500" />
              Export
            </button>
          </div>
        </div>

        {/* Data Table with Article & Color/Size Variant Columns */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg smriti-custom-scroll">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-1.5 px-2 w-8 text-center">
                  <input type="checkbox" onChange={handleSelectAll} className="rounded border-slate-300" />
                </th>
                <th className="py-1.5 px-2 w-8 text-center">#</th>
                <th className="py-1.5 px-2">Article / SKU *</th>
                <th className="py-1.5 px-2">Item Description *</th>
                <th className="py-1.5 px-2">Color / Size</th>
                <th className="py-1.5 px-2">Warehouse *</th>
                <th className="py-1.5 px-2">UOM</th>
                <th className="py-1.5 px-2 text-right">Qty *</th>
                <th className="py-1.5 px-2 text-right">Rate (INR) *</th>
                <th className="py-1.5 px-2 text-right">Discount %</th>
                <th className="py-1.5 px-2 text-right font-extrabold">Amount (INR) *</th>
                <th className="py-1.5 px-2 text-center w-8">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
              {items.map((item, idx) => {
                const gross = item.qty * item.rate;
                const disc = (gross * (item.discountPercent || 0)) / 100;
                const lineTotal = gross - disc;

                return (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-1 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!selectedItemIds[item.id]}
                        onChange={() => handleSelectItem(item.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="py-1 px-2 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-1 px-2 font-mono font-bold text-slate-800">
                      <div className="flex items-center space-x-1">
                        <span>{item.itemCode}</span>
                        <Search className="w-3 h-3 text-slate-400 cursor-pointer" onClick={() => setShowItemPickerModal(true)} />
                      </div>
                    </td>
                    <td className="py-1 px-2 font-semibold text-slate-900">{item.itemName}</td>

                    {/* Color / Size Badge */}
                    <td className="py-1 px-2">
                      {item.color || item.size ? (
                        <div className="flex items-center space-x-1 text-[10px]">
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-mono font-bold">{item.color || "BLK"}</span>
                          <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded font-mono font-bold border border-indigo-200">{item.size || "M"}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Standard</span>
                      )}
                    </td>

                    <td className="py-1 px-2">
                      <select
                        value={item.warehouse}
                        onChange={(e) => handleUpdateItem(item.id, "warehouse", e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded px-1 py-0.5 text-[11px] text-slate-700"
                      >
                        <option value="Main Warehouse">Main Warehouse</option>
                        <option value="Central Store">Central Store</option>
                      </select>
                    </td>
                    <td className="py-1 px-2 text-slate-600">{item.uom}</td>

                    <td className="py-1 px-2 text-right">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => handleUpdateItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                        className="w-16 bg-white border border-slate-300 rounded px-1 py-0.5 text-right font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="py-1 px-2 text-right">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => handleUpdateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                        className="w-16 bg-white border border-slate-300 rounded px-1 py-0.5 text-right font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="py-1 px-2 text-right">
                      <input
                        type="number"
                        value={item.discountPercent}
                        onChange={(e) => handleUpdateItem(item.id, "discountPercent", parseFloat(e.target.value) || 0)}
                        className="w-12 bg-white border border-slate-300 rounded px-1 py-0.5 text-right font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">
                      {lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-1 px-2 text-center">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg">
          <div className="flex items-center space-x-2 text-slate-600">
            <button className="p-0.5 border border-slate-300 rounded bg-white"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button className="px-2 py-0.2 bg-blue-600 text-white rounded font-bold text-[11px]">1</button>
            <button className="px-2 py-0.2 bg-white border border-slate-300 rounded text-[11px]">2</button>
            <button className="p-0.5 border border-slate-300 rounded bg-white"><ChevronRight className="w-3.5 h-3.5" /></button>
            <span className="text-slate-400 text-[11px] ml-2">Rows per page</span>
            <select className="bg-white border border-slate-300 rounded px-1 py-0.2 text-slate-700 text-[11px]">
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="flex items-center space-x-5 text-slate-700 text-[11px]">
            <div>
              <span className="text-slate-400 uppercase text-[9px] block">Total Qty</span>
              <span className="font-mono text-xs text-slate-900">{totals.totalQty.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase text-[9px] block">Total Discount</span>
              <span className="font-mono text-xs text-slate-900">{totals.totalDiscount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase text-[9px] block">Taxes (INR)</span>
              <span className="font-mono text-xs text-slate-900">{totals.totalTaxes.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pl-3 border-l border-slate-200">
              <span className="text-slate-400 uppercase text-[9px] block">Grand Total (INR)</span>
              <span className="font-mono text-sm font-black text-emerald-600">{totals.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM SPLIT SECTION (TAXES BREAKDOWN + RIGHT DOCKED SUMMARY CARD) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ----- LEFT SIDE: TABS (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex flex-wrap items-center space-x-3 border-b border-slate-200 pb-1.5 text-xs font-bold">
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
              onClick={() => setActiveBottomTab("notes")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "notes" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              NOTES
            </button>
          </div>

          <div className="text-xs">
            {activeBottomTab === "taxes" && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                      <th className="py-1.5 px-2.5">Tax Type</th>
                      <th className="py-1.5 px-2.5 text-right">Tax Rate %</th>
                      <th className="py-1.5 px-2.5 text-right">Taxable Amount (INR)</th>
                      <th className="py-1.5 px-2.5 text-right">Tax Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-slate-700">CGST</td>
                      <td className="py-1.5 px-2.5 text-right">6.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono">29,750.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">{totals.cgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-slate-700">SGST</td>
                      <td className="py-1.5 px-2.5 text-right">6.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono">29,750.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">{totals.sgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-slate-700">IGST</td>
                      <td className="py-1.5 px-2.5 text-right">18.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono">24,500.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">{totals.igstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
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
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium focus:outline-none focus:border-blue-500 h-20"
              />
            )}

            {(activeBottomTab === "shipping" || activeBottomTab === "terms") && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs">
                Standard ERP sourcing terms apply. Goods to be delivered to Main Warehouse within expected date.
              </div>
            )}
          </div>
        </div>

        {/* ----- RIGHT DOCKED SUMMARY CARD (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Receipt className="w-3.5 h-3.5" />
              <span>SUMMARY</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
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

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs font-extrabold text-slate-900">Net Payable</span>
              <span className="text-lg font-black text-emerald-600 font-mono tracking-tight">
                {totals.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="pt-1.5 border-t border-slate-100 text-[10px]">
              <span className="font-bold text-slate-500 block uppercase">Amount in Words</span>
              <span className="font-semibold text-slate-800 italic">{amountInWords}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= FASHION / FOOTWEAR VARIANT MATRIX ENTRY MODAL ================= */}
      {showVariantMatrixModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Grid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                    <span>Fashion & Apparel Variant Matrix Entry</span>
                    <span className="px-2 py-0.2 bg-indigo-100 text-indigo-800 text-[9px] font-mono rounded-full font-bold">SPK.entities</span>
                  </h3>
                  <p className="text-xs text-slate-500">Enter quantities across Color × Size matrix to generate purchase order lines instantly.</p>
                </div>
              </div>
              <button onClick={() => setShowVariantMatrixModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Article Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Article Code</span>
                <input
                  type="text"
                  value={selectedArticle.articleCode}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, articleCode: e.target.value })}
                  className="font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 w-full text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Article Description</span>
                <input
                  type="text"
                  value={selectedArticle.articleName}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, articleName: e.target.value })}
                  className="font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 w-full text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Style / Fit</span>
                <span className="font-semibold text-slate-700 block mt-1">{selectedArticle.style}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Base Buying Rate (₹)</span>
                <input
                  type="number"
                  value={selectedArticle.baseRate}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, baseRate: parseFloat(e.target.value) || 0 })}
                  className="font-mono font-bold text-blue-700 bg-white border border-slate-300 rounded px-2 py-1 w-full text-xs"
                />
              </div>
            </div>

            {/* 2D Matrix Grid Table (Colors × Sizes) */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl smriti-custom-scroll">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase">
                    <th className="py-2.5 px-3 text-left bg-slate-200 w-28">Color \ Size</th>
                    {availableSizes.map((sz) => (
                      <th key={sz} className="py-2.5 px-3 w-16 text-center font-mono">{sz}</th>
                    ))}
                    <th className="py-2.5 px-3 text-right bg-slate-200 w-20 font-bold">Total Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {availableColors.map((color) => {
                    let colorRowTotal = 0;
                    return (
                      <tr key={color} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-left font-bold text-slate-800 bg-slate-50 flex items-center space-x-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                            style={{
                              backgroundColor:
                                color === "Black" ? "#000" : color === "Blue" ? "#2563EB" : color === "Red" ? "#DC2626" : color === "Navy" ? "#1E3A8A" : "#FFF",
                            }}
                          ></span>
                          <span>{color}</span>
                        </td>
                        {availableSizes.map((size) => {
                          const key = `${color}_${size}`;
                          const qty = matrixQtyMap[key] || 0;
                          colorRowTotal += qty;
                          return (
                            <td key={size} className="py-1.5 px-2">
                              <input
                                type="number"
                                min="0"
                                value={qty || ""}
                                placeholder="0"
                                onChange={(e) => handleMatrixQtyChange(color, size, parseInt(e.target.value) || 0)}
                                className={`w-14 text-center border rounded py-1 text-xs font-mono font-bold focus:outline-none focus:border-blue-500 ${
                                  qty > 0 ? "bg-blue-50 border-blue-400 text-blue-800" : "bg-white border-slate-200 text-slate-400"
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-800 bg-slate-50">
                          {colorRowTotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-600 font-semibold">
                Total Matrix Items: <span className="font-mono font-bold text-blue-700">{Object.values(matrixQtyMap).reduce((a, b) => a + (b || 0), 0)} Pcs</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowVariantMatrixModal(false)}
                  className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateMatrixLines}
                  className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center shadow-md"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Generate Purchase Lines
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= ITEM PICKER MODAL (F2) ================= */}
      {showItemPickerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-4 space-y-3 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-xs flex items-center space-x-2">
                <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
                <span>Select Purchase Item (F2)</span>
              </h3>
              <button onClick={() => setShowItemPickerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto smriti-custom-scroll">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleAddItem(prod)}
                  className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{prod.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Code: {prod.code || prod.sku} | HSN: {prod.hsnCode || "6109"}</div>
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
