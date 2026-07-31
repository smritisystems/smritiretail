/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : SalesBillingStudio (Unified Sales Billing & Invoice Creation Studio — ADR-012 Standard v3.0)
 * Standard     : ADR-012 (SMRITI_PROCUREMENT_STUDIO_ENTERPRISE_STANDARD_v1.0), TG-001—TG-006 & STRE v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 3.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
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
  Check,
  User,
  CreditCard,
  Percent,
  PauseCircle,
  PlayCircle,
  Maximize2,
  ExternalLink,
  ShieldAlert,
  Clock,
  DollarSign
} from "lucide-react";
import { STRE, TaxContext, WindowManager } from "../../sdk/index.js";
import { getCustomers, addCustomer, initialCustomerGroups } from "../../services/customerStore.js";
import { Customer, Product } from "../../types.js";
import { SPK } from "../../kernel/SPK.js";
import { IItemService } from "../../kernel/public/IItemService.js";
import { ICustomerService } from "../../kernel/public/ICustomerService.js";
import { CreateSalesInvoiceCommand } from "../../kernel/commands/CreateSalesInvoiceCommand.js";

export interface LineItem {
  id: string;
  barcode: string;
  name: string;
  hsnCode: string;
  qty: number;
  availableStock: number;
  uom: string;
  rate: number;
  discountPct: number;
  gstRate?: number;
  color?: string;
  size?: string;
}

export interface HeldBill {
  id: string;
  customerName: string;
  time: string;
  total: number;
  items: LineItem[];
}

export interface SalesBillingStudioProps {
  products?: Product[];
  onRefreshProducts?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { name: string; role?: string } | null;
}

export const SalesBillingStudio: React.FC<SalesBillingStudioProps> = ({ products: propsProducts, onNotification, currentUser }) => {
  const [liveProducts, setLiveProducts] = useState<Product[]>(propsProducts || []);

  useEffect(() => {
    if (propsProducts && propsProducts.length > 0) {
      setLiveProducts(propsProducts);
    } else {
      try {
        const itemService = SPK.services.resolve<IItemService>("ITEM");
        itemService.getAll().then((prods) => {
          if (prods && prods.length > 0) setLiveProducts(prods);
        });
      } catch (e) {
        console.warn("[SalesBillingStudio] SPK ItemService non-initialized", e);
      }
    }
  }, [propsProducts]);

  // Subscribe to real-time Item Master events
  useEffect(() => {
    const unsubCreated = SPK.events.subscribe("ItemCreated", () => {
      try {
        const itemService = SPK.services.resolve<IItemService>("ITEM");
        itemService.getAll().then((prods) => setLiveProducts(prods));
      } catch { /* ignore */ }
    });
    const unsubUpdated = SPK.events.subscribe("ItemUpdated", () => {
      try {
        const itemService = SPK.services.resolve<IItemService>("ITEM");
        itemService.getAll().then((prods) => setLiveProducts(prods));
      } catch { /* ignore */ }
    });
    return () => {
      unsubCreated();
      unsubUpdated();
    };
  }, []);

  // Customer Store & Lookup State
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const [isWalkIn, setIsWalkIn] = useState<boolean>(true);

  // Active Customer Detail Cards
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("Walk-in Retail Customer");
  const [mobileNumber, setMobileNumber] = useState<string>("9876543210");
  const [gstin, setGstin] = useState<string>("27ABCDE1234F1Z5");
  const [taxProfile, setTaxProfile] = useState<string>("Retail Registered");

  // Corporate Customer Credit Attributes
  const [isCorporateClient, setIsCorporateClient] = useState<boolean>(false);
  const [creditLimit, setCreditLimit] = useState<number>(500000);
  const [outstandingBalance, setOutstandingBalance] = useState<number>(180000);

  // Branch & Cashier State
  const [selectedBranch, setSelectedBranch] = useState<string>("Branch 01");
  const [invoiceNo] = useState<string>(`INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [docDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "CARD" | "UPI" | "CREDIT">("CASH");

  // Toast Notification Helper
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    if (onNotification) {
      onNotification("Sales Billing", msg, type);
    }
  };

  // Modals UI States
  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState<boolean>(false);
  const [isRecallModalOpen, setIsRecallModalOpen] = useState<boolean>(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [showAddItemsMenu, setShowAddItemsMenu] = useState<boolean>(false);

  // Additional Details
  const [salesman, setSalesman] = useState<string>("S01 - Rahul Sharma");
  const [remarks, setRemarks] = useState<string>("");
  const [billDiscountInput, setBillDiscountInput] = useState<number>(0);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState<number>(0);

  // Line Items State
  const [items, setItems] = useState<LineItem[]>([
    {
      id: "1",
      barcode: "8901234567890",
      name: "Cotton Polo T-Shirt Premium (Black / M)",
      hsnCode: "6109",
      qty: 2,
      availableStock: 45,
      uom: "Pcs",
      rate: 850.0,
      discountPct: 0.0,
      gstRate: 12,
      color: "Black",
      size: "M",
    },
    {
      id: "2",
      barcode: "8901234567891",
      name: "Oxford Leather Shoe (Brown / 42)",
      hsnCode: "6403",
      qty: 1,
      availableStock: 12,
      uom: "Pair",
      rate: 2450.0,
      discountPct: 5.0,
      gstRate: 18,
      color: "Brown",
      size: "42",
    },
  ]);

  // Held Bills State (F6 / F7)
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);

  // Item Selection Handlers
  const handleAddItem = (prod?: Product) => {
    const newItem: LineItem = prod
      ? {
          id: `item-${Date.now()}`,
          barcode: prod.code || prod.sku || `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          name: prod.name,
          hsnCode: prod.hsnCode || "6109",
          qty: 1,
          availableStock: prod.stock || 50,
          uom: prod.unit || "Pcs",
          rate: prod.price || 500,
          discountPct: 0,
          gstRate: prod.gstPercentage || 12,
        }
      : {
          id: `item-${Date.now()}`,
          barcode: `89012345${Math.floor(10000 + Math.random() * 90000)}`,
          name: "Retail Fashion Apparel Item",
          hsnCode: "6109",
          qty: 1,
          availableStock: 30,
          uom: "Pcs",
          rate: 950.0,
          discountPct: 0.0,
          gstRate: 12,
        };

    setItems((prev) => [...prev, newItem]);
    setIsScannerModalOpen(false);
    setShowAddItemsMenu(false);
    showToast(`Added ${newItem.name} to invoice`);
  };

  const updateQty = (id: string, newQty: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, newQty) } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAllItems = () => {
    setItems([]);
    showToast("Cleared line items");
  };

  // Hold & Recall Bill Handlers
  const handleHoldBill = () => {
    if (items.length === 0) {
      showToast("Cannot hold an empty bill", "error");
      return;
    }
    const newHeldBill: HeldBill = {
      id: `HOLD-${Date.now()}`,
      customerName: selectedCustomerName,
      time: new Date().toLocaleTimeString(),
      total: roundedNetPayable,
      items: [...items],
    };
    setHeldBills((prev) => [...prev, newHeldBill]);
    setItems([]);
    showToast(`Bill held successfully (${newHeldBill.id})`);
  };

  const handleRecallBill = (bill: HeldBill) => {
    setItems(bill.items);
    setSelectedCustomerName(bill.customerName);
    setHeldBills((prev) => prev.filter((b) => b.id !== bill.id));
    setIsRecallModalOpen(false);
    showToast(`Recalled held bill ${bill.id}`);
  };

  // Financial Calculations & STRE Integration
  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.qty * item.rate, 0);
  }, [items]);

  const itemDiscountTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.qty * item.rate * item.discountPct) / 100, 0);
  }, [items]);

  const totalBillDiscount = billDiscountInput + loyaltyRedeem;
  const taxableValue = useMemo(() => {
    return Math.max(0, itemsTotal - itemDiscountTotal - totalBillDiscount);
  }, [itemsTotal, itemDiscountTotal, totalBillDiscount]);

  // STRE Tax Resolution Engine Computation
  const taxCalculation = useMemo(() => {
    const taxCtx: TaxContext = {
      companyState: "27-Maharashtra",
      customerState: "27-Maharashtra",
      customerGroupTaxProfile: "Retail Registered",
      documentDate: docDate || new Date().toISOString().split("T")[0],
      placeOfSupply: "27-Maharashtra",
      pricingPolicy: "EXCLUSIVE",
      currency: "INR",
      items: items.map((i) => ({
        itemId: i.id,
        itemCode: i.barcode,
        itemName: i.name,
        hsnCode: i.hsnCode,
        quantity: i.qty,
        unitPrice: (i.rate * (100 - i.discountPct)) / 100,
      })),
    };
    return STRE.calculateTaxes(taxCtx);
  }, [items, docDate]);

  const autoGstAmount = taxCalculation.totalTaxAmount;
  const netPayableCalculated = taxableValue + autoGstAmount;
  const roundedNetPayable = Math.round(netPayableCalculated);
  const roundOff = Number((roundedNetPayable - netPayableCalculated).toFixed(2));

  const amountInWords = useMemo(() => {
    return `INR ${roundedNetPayable.toLocaleString("en-IN")} Only`;
  }, [roundedNetPayable]);

  // Final Invoice Submission
  const handleConfirmPostInvoice = async () => {
    if (items.length === 0) {
      showToast("Cannot post an empty invoice!", "error");
      return;
    }

    try {
      await SPK.commands.execute(
        new CreateSalesInvoiceCommand({
          invoiceNumber: invoiceNo,
          customerName: selectedCustomerName,
          customerMobile: mobileNumber,
          customerGstin: gstin,
          invoiceDate: docDate,
          paymentMode,
          cashierName: currentUser?.name || "System Cashier",
          itemsTotal,
          discountTotal: itemDiscountTotal + totalBillDiscount,
          taxableTotal: taxableValue,
          cgstTotal: taxCalculation.totalCgstAmount,
          sgstTotal: taxCalculation.totalSgstAmount,
          igstTotal: taxCalculation.totalIgstAmount,
          taxTotal: taxCalculation.totalTaxAmount,
          netPayable: roundedNetPayable,
          roundedAmount: roundedNetPayable,
          taxSnapshot: taxCalculation as any,
          lines: items.map((i, idx) => ({
            id: `invl-${idx}`,
            itemId: i.id,
            itemCode: i.barcode,
            itemName: i.name,
            hsnCode: i.hsnCode,
            qty: i.qty,
            uom: i.uom,
            rate: i.rate,
            discountPct: i.discountPct,
            discountAmount: (i.qty * i.rate * i.discountPct) / 100,
            taxableValue: i.qty * i.rate * (1 - i.discountPct / 100),
            gstRate: i.gstRate || 12,
            cgstAmount: i.qty * i.rate * 0.06,
            sgstAmount: i.qty * i.rate * 0.06,
            igstAmount: 0,
            totalTaxAmount: i.qty * i.rate * 0.12,
            lineTotal: i.qty * i.rate,
          })),
          status: "Paid",
        })
      );

      setIsPaymentModalOpen(false);
      setItems([]);
      showToast(`Invoice ${invoiceNo} Posted & Printed ✓`);
    } catch (err: any) {
      showToast(err.message || "Failed to post invoice", "error");
    }
  };

  // Keyboard Shortcuts (F2, F4, F6, F7, F8, F10, Ctrl+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setIsScannerModalOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        setIsPaymentModalOpen(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        handleHoldBill();
      } else if (e.key === "F7") {
        e.preventDefault();
        setIsRecallModalOpen(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        setIsDiscountModalOpen(true);
      } else if (e.key === "F10") {
        e.preventDefault();
        setIsPaymentModalOpen(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, roundedNetPayable]);

  return (
    <div className="w-full bg-slate-100 font-sans text-slate-800 p-2.5 sm:p-3 space-y-3">
      {/* ================= SINGLE HORIZONTAL TOOLBAR (55px HERO COMPRESSION) ================= */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        {/* Left Title & Branch Badge */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SALES /</span>
          <h1 className="text-base font-extrabold text-slate-900 tracking-tight">Sales Billing Studio</h1>
          <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
            DRAFT
          </span>
          <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
            <Building2 className="w-2.5 h-2.5 mr-0.5" />
            <span>{selectedBranch}</span>
          </span>
          <span className="flex items-center text-[10px] text-emerald-600 font-bold ml-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
            Online
          </span>
        </div>

        {/* Right Actions & SWMF Pop-Out Button */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Items (F2)"
              onClick={() => setIsScannerModalOpen(true)}
              className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 w-40"
            />
          </div>

          <button
            onClick={handleHoldBill}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-700 cursor-pointer shadow-2xs flex items-center"
          >
            <PauseCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Hold (F6)
          </button>

          <button
            onClick={() => setIsRecallModalOpen(true)}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-700 cursor-pointer shadow-2xs flex items-center relative"
          >
            <PlayCircle className="w-3.5 h-3.5 mr-1 text-indigo-600" />
            Recall (F7)
            {heldBills.length > 0 && (
              <span className="ml-1 bg-indigo-600 text-white font-mono text-[9px] px-1 rounded-full font-bold">
                {heldBills.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsDiscountModalOpen(true)}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-700 cursor-pointer shadow-2xs flex items-center"
          >
            <Percent className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Discount (F8)
          </button>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow-xs cursor-pointer flex items-center"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1" />
            Pay (F4)
          </button>

          <button
            onClick={() => WindowManager.openTabStandalone("sales", "SMRITI Sales Billing Studio")}
            className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-md cursor-pointer"
            title="Pop-out Standalone Window (SWMF)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
          </button>

          <div className="pl-2 border-l border-slate-200 text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Invoice No.</span>
            <span className="font-mono font-extrabold text-blue-600 text-xs">{invoiceNo}</span>
          </div>
        </div>
      </div>

      {/* ================= 2-COLUMN MASTER FORM (CUSTOMER INFO + INVOICE DETAILS) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ----- CUSTOMER INFORMATION (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <User className="w-3.5 h-3.5" />
              <span>Customer Details</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => {
                  setIsWalkIn(true);
                  setSelectedCustomerName("Walk-in Retail Customer");
                  setMobileNumber("9876543210");
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isWalkIn ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Walk-in
              </button>
              <button
                onClick={() => setIsWalkIn(false)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  !isWalkIn ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Registered
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Customer Name *</label>
              <input
                type="text"
                value={selectedCustomerName}
                onChange={(e) => setSelectedCustomerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Mobile Number</label>
              <input
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">GSTIN / TAX ID</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* ----- INVOICE DETAILS (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5" />
              <span>Billing Parameters</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Invoice Date</span>
              <span className="font-bold text-slate-800 text-xs">{docDate}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Salesman ID</span>
              <input
                type="text"
                value={salesman}
                onChange={(e) => setSalesman(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 font-semibold w-full"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Tax Governance</span>
              <span className="font-semibold text-emerald-600 text-xs font-mono">TG-001 (Intrastate)</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Price List</span>
              <span className="font-semibold text-slate-800 text-xs">Retail MRP</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= LINE ITEMS DATA TABLE CARD (SUPG COMPACT) ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <ShoppingCart className="w-4 h-4" />
              <span>Items ({items.length})</span>
            </div>
          </div>

          {/* Actions Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => handleAddItem()}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center cursor-pointer text-[11px] rounded-lg shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Line Item (F7)
            </button>
            <button
              onClick={() => setIsScannerModalOpen(true)}
              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]"
            >
              <Scan className="w-3.5 h-3.5 mr-1 text-indigo-600" />
              Scan Barcode
            </button>
            <button
              onClick={clearAllItems}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear All
            </button>
          </div>
        </div>

        {/* SUPG Dense Data Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg smriti-custom-scroll">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-1.5 px-2 w-8 text-center">#</th>
                <th className="py-1.5 px-2">Barcode / SKU *</th>
                <th className="py-1.5 px-2">Item Description *</th>
                <th className="py-1.5 px-2">HSN/SAC</th>
                <th className="py-1.5 px-2">UOM</th>
                <th className="py-1.5 px-2 text-right">Qty *</th>
                <th className="py-1.5 px-2 text-right">MRP Rate (INR) *</th>
                <th className="py-1.5 px-2 text-right">Discount %</th>
                <th className="py-1.5 px-2 text-right font-extrabold">Line Total (INR) *</th>
                <th className="py-1.5 px-2 text-center w-8">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
              {items.map((item, idx) => {
                const lineGross = item.qty * item.rate;
                const lineDisc = (lineGross * item.discountPct) / 100;
                const lineNet = lineGross - lineDisc;

                return (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-1 px-2 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-1 px-2 font-mono font-bold text-slate-800">{item.barcode}</td>
                    <td className="py-1 px-2 font-semibold text-slate-900">{item.name}</td>
                    <td className="py-1 px-2 text-slate-500 font-mono">{item.hsnCode}</td>
                    <td className="py-1 px-2 text-slate-600">{item.uom}</td>

                    <td className="py-1 px-2 text-right">
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                        className="w-14 bg-white border border-slate-300 rounded px-1 py-0.5 text-right font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="py-1 px-2 text-right font-mono font-semibold text-slate-800">
                      ₹ {item.rate.toFixed(2)}
                    </td>

                    <td className="py-1 px-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discountPct}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setItems((prev) =>
                            prev.map((i) => (i.id === item.id ? { ...i, discountPct: val } : i))
                          );
                        }}
                        className="w-12 bg-white border border-slate-300 rounded px-1 py-0.5 text-right font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">
                      ₹ {lineNet.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-1 px-2 text-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= BOTTOM SPLIT SECTION (TAX BREAKDOWN + RIGHT DOCKED SUMMARY CARD) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ----- LEFT SIDE: TAX BREAKDOWN & NOTES (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-xs font-bold text-slate-700 uppercase">
            <span>STRE GST TAX BREAKDOWN</span>
            <span className="text-[10px] text-emerald-600 font-mono">TG-001 Intrastate</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                  <th className="py-1.5 px-2.5">Tax Component</th>
                  <th className="py-1.5 px-2.5 text-right">Taxable Amount (INR)</th>
                  <th className="py-1.5 px-2.5 text-right">Tax Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                <tr>
                  <td className="py-1.5 px-2.5 font-bold text-slate-700">CGST (Central Tax)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono">₹ {taxableValue.toFixed(2)}</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">
                    ₹ {taxCalculation.totalCgstAmount.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2.5 font-bold text-slate-700">SGST (State Tax)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono">₹ {taxableValue.toFixed(2)}</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">
                    ₹ {taxCalculation.totalSgstAmount.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2.5 font-bold text-slate-700">IGST (Integrated Tax)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono">₹ 0.00</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">
                    ₹ {taxCalculation.totalIgstAmount.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ----- RIGHT DOCKED SUMMARY CARD (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Receipt className="w-3.5 h-3.5" />
              <span>BILL SUMMARY</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Items Total</span>
              <span className="font-mono font-bold text-slate-800">₹ {itemsTotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Item Discounts</span>
              <span className="font-mono font-bold text-slate-800">₹ {itemDiscountTotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Bill Level Discount</span>
              <span className="font-mono font-bold text-slate-800">₹ {totalBillDiscount.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Total GST Taxes</span>
              <span className="font-mono font-bold text-slate-800">₹ {autoGstAmount.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Round Off</span>
              <span className="font-mono font-bold text-slate-800">{roundOff.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs font-extrabold text-slate-900">Net Payable</span>
              <span className="text-lg font-black text-emerald-600 font-mono tracking-tight">
                ₹ {roundedNetPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="pt-1.5 border-t border-slate-100 text-[10px]">
              <span className="font-bold text-slate-500 block uppercase">Amount in Words</span>
              <span className="font-semibold text-slate-800 italic">{amountInWords}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ITEM SEARCH / SCANNER MODAL (F2) ================= */}
      {isScannerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-4 space-y-3 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-xs flex items-center space-x-2">
                <Scan className="w-3.5 h-3.5 text-blue-600" />
                <span>Scan Barcode / Search Item (F2)</span>
              </h3>
              <button onClick={() => setIsScannerModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto smriti-custom-scroll">
              {liveProducts.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleAddItem(prod)}
                  className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{prod.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">SKU: {prod.code || prod.sku} | HSN: {prod.hsnCode || "6109"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-blue-600 text-xs">₹ {prod.price}</div>
                    <div className="text-[10px] text-slate-400">Stock: {prod.stock || 50}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= RECALL HELD BILLS MODAL (F7) ================= */}
      {isRecallModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-4 space-y-3 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-xs flex items-center space-x-2">
                <PlayCircle className="w-3.5 h-3.5 text-indigo-600" />
                <span>Recall Held Bills (F7)</span>
              </h3>
              <button onClick={() => setIsRecallModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto smriti-custom-scroll">
              {heldBills.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs italic">No held bills found.</div>
              ) : (
                heldBills.map((bill) => (
                  <div
                    key={bill.id}
                    onClick={() => handleRecallBill(bill)}
                    className="p-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-800 text-xs">{bill.customerName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Time: {bill.time} | Items: {bill.items.length}</div>
                    </div>
                    <div className="font-extrabold text-indigo-600 text-xs">₹ {bill.total}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= BILL PAYMENT MODAL (F4 / F10) ================= */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Post Invoice & Collect Payment</h3>
                  <p className="text-xs text-slate-500">Invoice #{invoiceNo}</p>
                </div>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Net Payable Grand Total</span>
              <div className="text-2xl font-black text-emerald-600 font-mono">
                ₹ {roundedNetPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 block">Select Payment Mode:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMode("CASH")}
                  className={`p-2.5 border rounded-xl font-bold flex items-center justify-center cursor-pointer ${
                    paymentMode === "CASH" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  CASH
                </button>
                <button
                  onClick={() => setPaymentMode("CARD")}
                  className={`p-2.5 border rounded-xl font-bold flex items-center justify-center cursor-pointer ${
                    paymentMode === "CARD" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  CARD / POS
                </button>
                <button
                  onClick={() => setPaymentMode("UPI")}
                  className={`p-2.5 border rounded-xl font-bold flex items-center justify-center cursor-pointer ${
                    paymentMode === "UPI" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  UPI / QR
                </button>
                <button
                  onClick={() => setPaymentMode("CREDIT")}
                  className={`p-2.5 border rounded-xl font-bold flex items-center justify-center cursor-pointer ${
                    paymentMode === "CREDIT" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  CREDIT LEDGER
                </button>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-bold">
                Cancel
              </button>
              <button onClick={handleConfirmPostInvoice} className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center shadow-md">
                <Check className="w-4 h-4 mr-1" />
                Post Invoice & Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
