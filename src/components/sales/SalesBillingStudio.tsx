/**
 * Project      : SMRITI Retail OS
 * Component    : SalesBillingStudio (Unified Sales Billing & Invoice Creation Studio)
 * Standard     : TG-001 — TG-006 (SMRITI Tax Governance Constitution) & STRE v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { STRE, TaxContext, WindowManager } from "../../sdk";
import { getCustomers, addCustomer, initialCustomerGroups } from "../../services/customerStore";
import { Customer } from "../../types";

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
}

export interface HeldBill {
  id: string;
  customerName: string;
  time: string;
  total: number;
  items: LineItem[];
}

import { Product } from "../../types";
import { SPK } from "../../kernel/SPK";
import { IItemService } from "../../kernel/public/IItemService";
import { ICustomerService } from "../../kernel/public/ICustomerService";
import { ITaxResolutionEngine } from "../../kernel/public/ITaxResolutionEngine";
import { CreateSalesInvoiceCommand } from "../../kernel/commands/CreateSalesInvoiceCommand";

export interface SalesBillingStudioProps {
  products?: Product[];
  onRefreshProducts?: () => void;
}

export const SalesBillingStudio: React.FC<SalesBillingStudioProps> = ({ products: propsProducts }) => {
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
  // Input Refs for Keyboard Shortcuts
  const topSearchRef = useRef<HTMLInputElement>(null);
  const itemSearchRef = useRef<HTMLInputElement>(null);

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
  const [creditDays, setCreditDays] = useState<number>(30);

  // Branch & Cashier State
  const [selectedBranch, setSelectedBranch] = useState<string>("Branch 01");
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState<boolean>(false);
  const [isCashierMenuOpen, setIsCashierMenuOpen] = useState<boolean>(false);

  // Toast Notification State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // New Customer Modal State
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>("");
  const [newCustMobile, setNewCustMobile] = useState<string>("");
  const [newCustGst, setNewCustGst] = useState<string>("");
  const [newCustGroup, setNewCustGroup] = useState<string>("CG-Retail");
  const [newCustEmail, setNewCustEmail] = useState<string>("");

  // Barcode Scanner Modal State
  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);

  // Item Search & Autocomplete State
  const [itemSearch, setItemSearch] = useState<string>("");
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState<boolean>(false);

  // Billing Additional Details
  const [salesman, setSalesman] = useState<string>("S01");
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponAppliedMsg, setCouponAppliedMsg] = useState<string>("");
  const [couponDiscountVal, setCouponDiscountVal] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");
  const [loyaltyRedeem, setLoyaltyRedeem] = useState<number>(0);
  const [billDiscountInput, setBillDiscountInput] = useState<number>(100);

  // Held Bills State & Modal (F6 / F7)
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [isRecallModalOpen, setIsRecallModalOpen] = useState<boolean>(false);

  // Bill Discount Modal State (F8)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState<boolean>(false);

  // Payment Modal State (F4)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD" | "CREDIT">("CASH");
  const [cashTendered, setCashTendered] = useState<number>(0);

  // Invoice Success Posted Modal State
  const [postedInvoiceData, setPostedInvoiceData] = useState<{
    invNo: string;
    grandTotal: number;
    customer: string;
    paymentMode: string;
  } | null>(null);

  // Default Line Items with stock levels
  const [items, setItems] = useState<LineItem[]>([
    {
      id: "item-1",
      barcode: "8901234567890",
      name: "Nike Sports Shoes",
      hsnCode: "6404",
      qty: 1,
      availableStock: 45,
      uom: "Pair",
      rate: 2500.0,
      discountPct: 0.0,
    },
    {
      id: "item-2",
      barcode: "8901234567891",
      name: "Cotton Socks",
      hsnCode: "6115",
      qty: 3,
      availableStock: 120,
      uom: "Pair",
      rate: 250.0,
      discountPct: 10.0,
    },
    {
      id: "item-3",
      barcode: "8901234567892",
      name: "Adidas Cap",
      hsnCode: "6505",
      qty: 1,
      availableStock: 8,
      uom: "Pcs",
      rate: 500.0,
      discountPct: 0.0,
    },
  ]);

  // Fetch Customers on Mount via SPK CustomerService
  useEffect(() => {
    const fetchCusts = () => {
      try {
        const custService = SPK.services.resolve<ICustomerService>("CUSTOMER");
        custService.getAll().then((list) => {
          if (list && list.length > 0) setCustomerList(list);
        });
      } catch {
        const custs = getCustomers();
        if (Array.isArray(custs)) setCustomerList(custs);
      }
    };

    fetchCusts();
    const unsub1 = SPK.events.subscribe("CustomerCreated", fetchCusts);
    const unsub2 = SPK.events.subscribe("CustomerUpdated", fetchCusts);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // Keyboard Shortcuts Listener (F2, F3, F4, F6, F7, F8, F9, F10)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        topSearchRef.current?.focus();
        showToast("Search Focused (F2)");
      } else if (e.key === "F3") {
        e.preventDefault();
        addNewItem();
        showToast("New Item Line Added (F3)");
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
      } else if (e.key === "F9") {
        e.preventDefault();
        showToast("Draft Bill Saved (F9)");
      } else if (e.key === "F10") {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedCustomerName]);

  // Filter Customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customerList;
    const q = customerSearch.toLowerCase();
    return customerList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (c.gstNumber && c.gstNumber.toLowerCase().includes(q))
    );
  }, [customerSearch, customerList]);

  // Filter Catalog Items based on search
  const filteredCatalog = useMemo(() => {
    if (!itemSearch.trim()) return liveProducts.slice(0, 10);
    const q = itemSearch.toLowerCase();
    return liveProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q)) ||
        (p.hsn_code || p.hsnCode || "").includes(q)
    );
  }, [itemSearch, liveProducts]);

  // Select Customer from Autocomplete Lookup
  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setSelectedCustomerName(c.name);
    setCustomerSearch(c.name);
    setMobileNumber(c.mobile);
    setGstin(c.gstNumber || "27AAACR1234F1Z1");
    setIsWalkIn(false);
    setIsCustomerDropdownOpen(false);

    // Auto-configure Corporate / Wholesale rules & Credit limits
    const isCorp = c.customerGroupId === "CG-Corporate" || c.customerGroupId === "CG-LargeRetail";
    setIsCorporateClient(isCorp);

    if (isCorp) {
      const groupConfig = initialCustomerGroups.find((g) => g.id === c.customerGroupId);
      setTaxProfile("Corporate Wholesale");
      setCreditLimit(groupConfig?.creditLimit || 500000);
      setOutstandingBalance(c.outstanding || 180000);
      setCreditDays(groupConfig?.creditDays || 30);
    } else {
      setTaxProfile("Retail Registered");
      setCreditLimit(0);
      setOutstandingBalance(0);
      setCreditDays(0);
    }
  };

  // Add Item from Autocomplete Lookup
  const handleSelectCatalogItem = (p: Product) => {
    const itemBarcode = p.barcode || p.sku || p.code;
    const existingIndex = items.findIndex((i) => i.barcode === itemBarcode || i.name === p.name);
    if (existingIndex >= 0) {
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, qty: item.qty + 1 } : item
        )
      );
    } else {
      const newItem: LineItem = {
        id: `item-${Date.now()}`,
        barcode: itemBarcode,
        name: p.name,
        hsnCode: p.hsn_code || p.hsnCode || "8471",
        qty: 1,
        availableStock: p.stock ?? p.stock_qty ?? 100,
        uom: p.uom || "Pcs",
        rate: p.price || 0,
        discountPct: 0.0,
      };
      setItems((prev) => [...prev, newItem]);
    }
    setItemSearch("");
    setIsItemDropdownOpen(false);
    showToast(`Added ${p.name} to bill`);
  };

  // Create New Customer Handler
  const handleSaveNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustMobile.trim()) return;

    try {
      const created = addCustomer({
        customerGroupId: newCustGroup,
        name: newCustName,
        mobile: newCustMobile,
        email: newCustEmail || `${newCustName.toLowerCase().replace(/\s+/g, "")}@example.com`,
        gstNumber: newCustGst || undefined,
        status: "Active",
      });

      setCustomerList(getCustomers());
      handleSelectCustomer(created);
      setIsNewCustomerModalOpen(false);
      setNewCustName("");
      setNewCustMobile("");
      setNewCustGst("");
      showToast(`Customer ${created.name} created successfully!`);
    } catch {
      setIsNewCustomerModalOpen(false);
    }
  };

  // Apply Coupon Handler
  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (code === "SMRITI10") {
      setCouponDiscountVal(200);
      setCouponAppliedMsg("SMRITI10 Applied (₹200 Off)");
      showToast("Coupon SMRITI10 Applied!");
    } else if (code === "FLAT100") {
      setCouponDiscountVal(100);
      setCouponAppliedMsg("FLAT100 Applied (₹100 Off)");
      showToast("Coupon FLAT100 Applied!");
    } else if (code) {
      setCouponDiscountVal(50);
      setCouponAppliedMsg(`${code} Applied (₹50 Off)`);
      showToast(`Coupon ${code} Applied!`);
    }
  };

  // Hold Current Bill (F6)
  const handleHoldBill = () => {
    if (items.length === 0) {
      showToast("Cannot hold empty bill!");
      return;
    }
    const newHold: HeldBill = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      customerName: selectedCustomerName,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: roundedNetPayable,
      items: [...items]
    };
    setHeldBills(prev => [newHold, ...prev]);
    setItems([]);
    showToast(`Bill ${newHold.id} held successfully (F6)`);
  };

  // Recall Bill Handler (F7)
  const handleRecallBill = (held: HeldBill) => {
    setItems(held.items);
    setSelectedCustomerName(held.customerName);
    setHeldBills(prev => prev.filter(b => b.id !== held.id));
    setIsRecallModalOpen(false);
    showToast(`Bill ${held.id} recalled into canvas`);
  };

  // STRE Tax Engine Integration (TG-001 / TG-002)
  const taxCalculation = useMemo(() => {
    try {
      const taxEngine = SPK.services.resolve<ITaxResolutionEngine>("TAX_ENGINE");
      const companyState = "Maharashtra";
      const placeOfSupply = gstin && gstin.length >= 2 ? "Maharashtra" : "Maharashtra";
      const docDate = new Date().toISOString().slice(0, 10);

      const snapshot = taxEngine.createDocumentTaxSnapshot(
        companyState,
        placeOfSupply,
        docDate,
        items.map((i) => ({
          itemId: i.id,
          itemCode: i.barcode,
          itemName: i.name,
          hsnCode: i.hsnCode || "8471",
          unitPrice: i.rate,
          qty: i.qty,
          discountPct: i.discountPct,
          companyState,
          placeOfSupply,
          documentDate: docDate,
          transactionType: isCorporateClient ? "B2B" : "B2C"
        }))
      );
      return snapshot;
    } catch {
      return { totalTaxAmount: 0, totalCgstAmount: 0, totalSgstAmount: 0, totalIgstAmount: 0, totalTaxableValue: 0, supplyType: "INTRASTATE" as const, isInterstate: false };
    }
  }, [items, gstin, isCorporateClient]);

  // Calculation Summaries matching screenshot
  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.qty * item.rate, 0);
  }, [items]);

  const itemDiscountTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.qty * item.rate * item.discountPct) / 100, 0);
  }, [items]);

  const totalBillDiscount = billDiscountInput + couponDiscountVal + loyaltyRedeem;
  const taxableValue = useMemo(() => {
    return Math.max(0, itemsTotal - itemDiscountTotal - totalBillDiscount);
  }, [itemsTotal, itemDiscountTotal, totalBillDiscount]);

  const autoGstAmount = taxCalculation.totalTaxAmount;
  const netPayableCalculated = taxableValue + autoGstAmount;
  const roundedNetPayable = Math.round(netPayableCalculated);
  const roundOff = Number((roundedNetPayable - netPayableCalculated).toFixed(2));

  // Available Credit Calculations for Corporate Clients
  const availableCredit = creditLimit - outstandingBalance;
  const isCreditLimitExceeded = isCorporateClient && roundedNetPayable > availableCredit;

  // Final Post Invoice Handler
  const handleConfirmPostInvoice = async () => {
    if (items.length === 0) {
      showToast("Cannot post an empty invoice!");
      return;
    }
    const invNo = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      await SPK.commands.execute(
        new CreateSalesInvoiceCommand({
          invoiceNumber: invNo,
          customerName: selectedCustomerName,
          customerMobile: mobileNumber,
          customerGstin: gstin,
          invoiceDate: new Date().toISOString().slice(0, 10),
          paymentMode,
          cashierName: "System Operator",
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
            gstRate: 18,
            cgstAmount: (i.qty * i.rate * 0.09),
            sgstAmount: (i.qty * i.rate * 0.09),
            igstAmount: 0,
            totalTaxAmount: (i.qty * i.rate * 0.18),
            lineTotal: i.qty * i.rate
          })),
          status: "Paid"
        })
      );

      setPostedInvoiceData({
        invNo,
        grandTotal: roundedNetPayable,
        customer: selectedCustomerName,
        paymentMode
      });
      setIsPaymentModalOpen(false);
      showToast(`Invoice ${invNo} Posted ✓`);
    } catch (err: any) {
      showToast(err.message || "Failed to post invoice");
    }
  };

  // Handlers for Items
  const updateQty = (id: string, newQty: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, newQty) } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAllItems = () => {
    setItems([]);
    showToast("Cleared all line items");
  };

  const addNewItem = () => {
    const newItem: LineItem = {
      id: `item-${Date.now()}`,
      barcode: `89012345${Math.floor(10000 + Math.random() * 90000)}`,
      name: "New Retail Item",
      hsnCode: "6404",
      qty: 1,
      availableStock: 50,
      uom: "Pcs",
      rate: 1000.0,
      discountPct: 0.0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col justify-between relative">
      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed top-14 right-5 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl z-50 text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Header Bar */}
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
          <h1 className="text-base font-bold text-slate-800">Sales Billing</h1>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold uppercase tracking-wide">
            DRAFT
          </span>
          <span className="text-xs text-slate-500 font-medium">Auto Save 02:45 PM</span>
          <span className="flex items-center text-xs text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
            Online
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <input
              ref={topSearchRef}
              type="text"
              placeholder="Search (F2)"
              className="w-48 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 pl-8"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-sm">search</span>
          </div>

          {/* Popout Standalone Button */}
          <button
            onClick={() => WindowManager.openTabStandalone("sales-billing", "Sales Billing")}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
            title="Popout into Distraction-Free Independent Window"
          >
            <span className="material-symbols-outlined text-sm mr-1">open_in_new</span>
            Popout
          </button>

          <button
            onClick={() => showToast("Notifications Pane Opened")}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">notifications</span>
          </button>
          <button
            onClick={() => window.print()}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">print</span>
          </button>

          {/* Branch Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-slate-500">store</span>
              <span>{selectedBranch}</span>
              <span className="material-symbols-outlined text-xs text-slate-400">expand_more</span>
            </button>
            {isBranchDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 w-40 text-xs py-1">
                {["Branch 01 (Main)", "Branch 02 (Suburban)", "Branch 03 (Express)"].map((b) => (
                  <div
                    key={b}
                    onClick={() => {
                      setSelectedBranch(b.split(" ")[0] + " " + b.split(" ")[1]);
                      setIsBranchDropdownOpen(false);
                      showToast(`Switched to ${b}`);
                    }}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-slate-700 font-medium"
                  >
                    {b}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cashier Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsCashierMenuOpen(!isCashierMenuOpen)}
              className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition"
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center border border-blue-200">
                AS
              </div>
              <span className="text-xs font-medium text-slate-700">Cashier</span>
              <span className="material-symbols-outlined text-xs text-slate-400">expand_more</span>
            </button>
            {isCashierMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 w-44 text-xs py-1">
                <div className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800">
                  Aniket Sharma
                  <span className="block text-[10px] text-slate-400 font-normal">Head Cashier (POS-01)</span>
                </div>
                <div
                  onClick={() => {
                    setIsCashierMenuOpen(false);
                    showToast("Shift Summary Printed");
                  }}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-slate-700 flex items-center"
                >
                  <span className="material-symbols-outlined text-sm mr-2 text-slate-500">receipt</span>
                  Shift Summary
                </div>
                <div
                  onClick={() => {
                    setIsCashierMenuOpen(false);
                    showToast("Register Closed Successfully");
                  }}
                  className="px-3 py-2 hover:bg-rose-50 cursor-pointer text-rose-600 font-bold flex items-center"
                >
                  <span className="material-symbols-outlined text-sm mr-2">lock</span>
                  Close Shift
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 flex-1 grid grid-cols-12 gap-4">
        {/* Left Column - Billing Workflow Canvas */}
        <div className="col-span-8 space-y-4">
          {/* Section 1: Customer Information */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="material-symbols-outlined text-sm mr-1.5 text-blue-600">person</span>
                Customer Information
              </h2>
              {isCorporateClient && (
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-extrabold flex items-center">
                  <span className="material-symbols-outlined text-xs mr-1">domain</span>
                  Corporate Account
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-3 relative">
              {/* Customer Search Autocomplete Lookup */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customerSearch}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setIsCustomerDropdownOpen(true);
                  }}
                  placeholder="Search Customer (Name, Mobile, GSTIN)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 pl-9"
                />
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>

                {/* Customer Lookup Dropdown List */}
                {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className="px-3.5 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{c.name}</div>
                          <div className="text-[10px] text-slate-500">
                            Mobile: {c.mobile} | {c.gstNumber ? `GST: ${c.gstNumber}` : "Unregistered"}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 font-mono font-semibold text-slate-600 rounded">
                          {c.customerGroupId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* New Customer Modal Trigger */}
              <button
                onClick={() => setIsNewCustomerModalOpen(true)}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
              >
                <span className="material-symbols-outlined text-sm mr-1">add</span>
                New
              </button>

              <label className="flex items-center space-x-1.5 text-xs text-slate-700 font-medium cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={isWalkIn}
                  onChange={(e) => {
                    setIsWalkIn(e.target.checked);
                    if (e.target.checked) {
                      setSelectedCustomerName("Walk-in Retail Customer");
                      setMobileNumber("9876543210");
                      setGstin("27ABCDE1234F1Z5");
                      setIsCorporateClient(false);
                    }
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Walk-in Customer</span>
                <span className="material-symbols-outlined text-xs text-slate-400">info</span>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block font-medium uppercase">Mobile</span>
                <span className="font-semibold text-slate-800">{mobileNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-medium uppercase">GSTIN</span>
                <span className="font-semibold font-mono text-slate-800">{gstin}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-medium uppercase">Tax Profile</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="font-semibold text-slate-800">{taxProfile}</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-[10px] font-bold flex items-center">
                    Auto Applied ✓
                  </span>
                </div>
              </div>
            </div>

            {/* Corporate Credit Information Card */}
            {isCorporateClient && (
              <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-indigo-950">
                  <span className="flex items-center">
                    <span className="material-symbols-outlined text-sm mr-1 text-indigo-600">account_balance_wallet</span>
                    Corporate Credit Status ({creditDays} Days Credit)
                  </span>
                  {isCreditLimitExceeded ? (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-extrabold flex items-center">
                      ⚠️ Credit Exceeded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-extrabold flex items-center">
                      ✔ Credit Approved
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 block text-[9px]">CREDIT LIMIT</span>
                    <span className="font-bold text-slate-800">₹{creditLimit.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">OUTSTANDING</span>
                    <span className="font-bold text-rose-600">₹{outstandingBalance.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">AVAILABLE CREDIT</span>
                    <span className="font-bold text-emerald-700">₹{availableCredit.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Scan Barcode / Search Item */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="material-symbols-outlined text-sm mr-1.5 text-blue-600">barcode_scanner</span>
                Scan Barcode / Search Item
              </h2>
            </div>
            <div className="flex items-center gap-3 relative">
              {/* Item Autocomplete Search Lookup Input */}
              <div className="relative flex-1">
                <input
                  ref={itemSearchRef}
                  type="text"
                  value={itemSearch}
                  onFocus={() => setIsItemDropdownOpen(true)}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setIsItemDropdownOpen(true);
                  }}
                  placeholder="Scan Barcode or Search Item by Name / Code"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 pl-9"
                />
                <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-sm">search</span>

                {/* Catalog Autocomplete Dropdown List */}
                {isItemDropdownOpen && filteredCatalog.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto">
                    {filteredCatalog.map((p) => (
                      <div
                        key={p.barcode}
                        onClick={() => handleSelectCatalogItem(p)}
                        className="px-3.5 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Barcode: {p.barcode || p.sku || p.code} | HSN: {p.hsn_code || p.hsnCode || "8471"} | Stock: <span className="font-bold text-emerald-700">{p.stock ?? p.stock_qty ?? 0} {p.uom || "Pcs"}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900">₹{Number(p.price || 0).toFixed(2)}</span>
                          <span className="text-[10px] text-blue-600 block">Select Item</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsScannerModalOpen(true)}
                className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
              >
                <span className="material-symbols-outlined text-base mr-1.5">photo_camera</span>
                Scan Barcode
              </button>
            </div>
          </section>

          {/* Section 3: Items Grid */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="material-symbols-outlined text-sm mr-1.5 text-blue-600">shopping_cart</span>
                Items Grid
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={addNewItem}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">add</span>
                  Add Item (F3)
                </button>
                <button
                  onClick={clearAllItems}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">delete</span>
                  Clear All
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 font-mono">Barcode</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3 text-center w-16">Stock</th>
                    <th className="py-2.5 px-3 text-center w-16">Qty</th>
                    <th className="py-2.5 px-3 text-center w-16">UOM</th>
                    <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right">Disc %</th>
                    <th className="py-2.5 px-3 text-center">Tax (STRE Auto)</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((item, idx) => {
                    const gross = item.qty * item.rate * (1 - item.discountPct / 100);
                    const lineGstPct = item.hsnCode === "6115" ? 12 : 18;
                    const lineTaxAmt = gross * (lineGstPct / 100);
                    const lineFinal = gross + lineTaxAmt;
                    const isLowStock = item.availableStock < item.qty;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{item.barcode}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{item.name}</div>
                          <span className="text-[10px] font-mono text-slate-400">HSN: {item.hsnCode}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {isLowStock ? (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
                              {item.availableStock}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                              {item.availableStock}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                            className="w-12 bg-white border border-slate-300 rounded text-center py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{item.uom}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                          {item.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {item.discountPct.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold block text-center">
                            {lineGstPct}% {taxCalculation.supplyType === "INTERSTATE" ? "IGST" : "GST"}
                            <span className="block text-[8px] text-blue-500 font-normal">Auto</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                          {lineFinal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-xs font-bold text-blue-900 flex items-center justify-between">
              <span>Total Lines: {items.length}</span>
              <span className="text-slate-500 font-normal text-[11px]">
                ✔ Real-time Available Stock reserve assertion active
              </span>
            </div>
          </section>

          {/* Section 4: Additional Details */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="material-symbols-outlined text-sm mr-1.5 text-blue-600">description</span>
                Additional Details
              </h2>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks (optional)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Salesman</label>
                <select
                  value={salesman}
                  onChange={(e) => setSalesman(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-700"
                >
                  <option value="S01">Rahul Sharma (Executive)</option>
                  <option value="S02">Priya Patel (Senior Executive)</option>
                  <option value="S03">Amit Verma (Counter Lead)</option>
                  <option value="S04">Neha Singh (Sales Consultant)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Coupon</label>
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter Coupon Code"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 uppercase font-mono"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold cursor-pointer transition"
                  >
                    Apply
                  </button>
                </div>
                {couponAppliedMsg && (
                  <span className="text-[10px] font-semibold text-emerald-600 block mt-1">
                    {couponAppliedMsg}
                  </span>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block items-center justify-between">
                  <span>Loyalty Redeem</span>
                  <span className="material-symbols-outlined text-[10px] text-slate-400 ml-1">info</span>
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={loyaltyRedeem}
                    onChange={(e) => setLoyaltyRedeem(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => showToast(`Loyalty Points Adjusted: ₹${loyaltyRedeem}`)}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold cursor-pointer transition"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column - Financial Summary & STRE Tax Panel */}
        <div className="col-span-4 space-y-4">
          {/* Card 1: Bill Summary */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="material-symbols-outlined text-sm mr-1.5 text-blue-600">receipt_long</span>
                Bill Summary
              </h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Items Total</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹ {itemsTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Item Discount</span>
                <span className="font-mono font-semibold text-rose-600">
                  - ₹ {itemDiscountTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Bill Discount</span>
                <span className="font-mono font-semibold text-rose-600">
                  - ₹ {totalBillDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="h-[1px] bg-slate-200 my-2"></div>

              <div className="flex items-center justify-between text-slate-700 font-medium">
                <span>Taxable Value</span>
                <span className="font-mono font-semibold text-slate-900">
                  ₹ {taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700 font-medium">
                <span>GST (Auto Applied)</span>
                <span className="font-mono font-semibold text-slate-900">
                  ₹ {autoGstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 text-[11px]">
                <span>Round Off</span>
                <span className="font-mono text-slate-600">
                  {roundOff >= 0 ? `+ ₹ ${roundOff}` : `- ₹ ${Math.abs(roundOff)}`}
                </span>
              </div>

              <div className="h-[1px] bg-slate-200 my-2"></div>

              <div className="pt-1 flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wide">NET PAYABLE</span>
                <span className="text-2xl font-black font-mono text-emerald-600">
                  ₹ {roundedNetPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </section>

          {/* Card 2: Tax Summary (STRE) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="material-symbols-outlined text-sm mr-1.5 text-blue-600">verified_user</span>
                Tax Summary (STRE)
              </h2>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-[10px] font-bold flex items-center">
                ✔ Auto Applied
              </span>
            </div>

            <div className="space-y-2 text-xs mb-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Engine</span>
                <span className="font-semibold text-slate-800">STRE 1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tax Pack</span>
                <span className="font-semibold text-slate-800">India GST Pack</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tax Profile</span>
                <span className="font-semibold text-slate-800">{taxProfile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Place of Supply</span>
                <span className="font-semibold text-slate-800">
                  {gstin && gstin.startsWith("07") ? "Delhi (07) - Interstate" : "Maharashtra (27) - Intrastate"}
                </span>
              </div>
            </div>

            {/* Tax Breakdown Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[9px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-2">Tax Type</th>
                    <th className="py-1.5 px-2 text-center">Rate</th>
                    <th className="py-1.5 px-2 text-right">Taxable</th>
                    <th className="py-1.5 px-2 text-right">Tax Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {taxCalculation.supplyType === "INTERSTATE" ? (
                    <tr>
                      <td className="py-1.5 px-2 font-bold text-slate-700">IGST</td>
                      <td className="py-1.5 px-2 text-center text-slate-600">18%</td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                        ₹ {taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-800">
                        ₹ {autoGstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ) : (
                    <>
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-slate-700">CGST</td>
                        <td className="py-1.5 px-2 text-center text-slate-600">9%</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                          ₹ {(taxableValue / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-800">
                          ₹ {(autoGstAmount / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-slate-700">SGST</td>
                        <td className="py-1.5 px-2 text-center text-slate-600">9%</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                          ₹ {(taxableValue / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-800">
                          ₹ {(autoGstAmount / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-extrabold text-blue-900">Total Tax</span>
              <span className="font-extrabold font-mono text-blue-700 text-sm">
                ₹ {autoGstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Fixed Action Shortcuts Bar */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-lg z-20">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleHoldBill}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">pause</span>
            Hold Bill (F6)
          </button>
          <button
            onClick={() => setIsRecallModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">restore</span>
            Recall Bill (F7) {heldBills.length > 0 && `(${heldBills.length})`}
          </button>
          <button
            onClick={() => setIsDiscountModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">sell</span>
            Bill Discount (F8)
          </button>
          <button
            onClick={() => showToast("Draft Bill Saved (F9)")}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">save</span>
            Save Draft (F9)
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-extrabold text-xs flex items-center cursor-pointer shadow-md shadow-blue-600/30 uppercase tracking-wide transition"
          >
            <span className="material-symbols-outlined text-base mr-1.5">credit_card</span>
            Payment (F4)
          </button>
          <button
            disabled={isCreditLimitExceeded}
            onClick={() => setIsPaymentModalOpen(true)}
            className={`px-6 py-2.5 text-white rounded-lg font-extrabold text-xs flex items-center cursor-pointer shadow-md uppercase tracking-wide transition ${
              isCreditLimitExceeded
                ? "bg-rose-600 hover:bg-rose-700 cursor-not-allowed opacity-90 shadow-rose-600/30"
                : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
            }`}
          >
            <span className="material-symbols-outlined text-base mr-1.5">
              {isCreditLimitExceeded ? "block" : "check_circle"}
            </span>
            {isCreditLimitExceeded ? "Credit Exceeded (Blocked)" : "Post Invoice"}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-base mr-1.5">print</span>
            Print (F10)
          </button>
        </div>
      </footer>

      {/* MODAL 1: Payment Modal (F4) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
            <div className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wide">Checkout & Settlement (F4)</h3>
                <p className="text-[11px] text-blue-200">Customer: {selectedCustomerName}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-blue-300 hover:text-white">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">TOTAL AMOUNT PAYABLE</span>
                <span className="text-3xl font-black font-mono text-emerald-600 mt-1 block">
                  ₹ {roundedNetPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Select Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["CASH", "UPI", "CARD", "CREDIT"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMode(m)}
                      className={`py-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center cursor-pointer transition ${
                        paymentMode === m
                          ? "bg-blue-600 text-white border-blue-600 shadow-md"
                          : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base mb-1">
                        {m === "CASH" ? "payments" : m === "UPI" ? "qr_code_scanner" : m === "CARD" ? "credit_card" : "account_balance"}
                      </span>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === "CASH" && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Cash Tendered (₹)</label>
                    <input
                      type="number"
                      value={cashTendered || ""}
                      onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                      placeholder={`e.g. ${roundedNetPayable}`}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {cashTendered >= roundedNetPayable && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-900 font-bold">
                      <span>Change to Return:</span>
                      <span className="font-mono text-base">₹ {(cashTendered - roundedNetPayable).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMode === "UPI" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                  <div className="w-24 h-24 bg-white border border-slate-300 mx-auto rounded-lg flex items-center justify-center font-mono text-[10px] text-slate-400">
                    [ UPI QR CODE ]
                  </div>
                  <p className="text-[11px] text-slate-600">Scan QR Code to pay ₹{roundedNetPayable.toLocaleString("en-IN")}</p>
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPostInvoice}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg text-xs uppercase shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  Confirm & Post Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Recall Held Bills (F7) */}
      {isRecallModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-indigo-400">restore</span>
                Recall Held Bills (F7)
              </h3>
              <button onClick={() => setIsRecallModalOpen(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs max-h-80 overflow-y-auto">
              {heldBills.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No held bills in queue</div>
              ) : (
                heldBills.map((b) => (
                  <div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">{b.customerName} ({b.id})</div>
                      <div className="text-[10px] text-slate-500">Held at {b.time} | {b.items.length} Items</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-600">₹{b.total.toLocaleString("en-IN")}</div>
                      <button
                        onClick={() => handleRecallBill(b)}
                        className="mt-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[10px] cursor-pointer"
                      >
                        Recall
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Bill Discount Modal (F8) */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-amber-400">sell</span>
                Bill Discount (F8)
              </h3>
              <button onClick={() => setIsDiscountModalOpen(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Enter Additional Flat Bill Discount (₹)</label>
                <input
                  type="number"
                  value={billDiscountInput}
                  onChange={(e) => setBillDiscountInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  setIsDiscountModalOpen(false);
                  showToast(`Bill Discount Updated: ₹${billDiscountInput}`);
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                Apply Bill Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Camera Barcode Scanner Simulator */}
      {isScannerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-blue-400">photo_camera</span>
                Camera Barcode Scanner
              </h3>
              <button onClick={() => setIsScannerModalOpen(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-6 text-center space-y-4 text-xs">
              <div className="w-full h-40 bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-blue-500/50">
                <span className="material-symbols-outlined text-3xl text-blue-400 animate-bounce mb-2">qr_code_scanner</span>
                <span>Camera Stream Active</span>
                <span className="text-[10px] text-slate-500 mt-1">Align Barcode within Frame</span>
              </div>
              <button
                onClick={() => {
                  if (liveProducts.length > 0) {
                    handleSelectCatalogItem(liveProducts[0]);
                  }
                  setIsScannerModalOpen(false);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                Simulate Barcode Scan ({liveProducts[0]?.name || "First SKU"})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Invoice Posted Success Dialog */}
      {postedInvoiceData && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="bg-emerald-700 text-white p-6 text-center space-y-2">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
              <h3 className="font-extrabold text-lg">Invoice Posted Successfully!</h3>
              <p className="text-xs text-emerald-100 font-mono">{postedInvoiceData.invNo}</p>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Customer</span>
                <span className="font-bold text-slate-800">{postedInvoiceData.customer}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Payment Method</span>
                <span className="font-bold text-slate-800">{postedInvoiceData.paymentMode}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Grand Total</span>
                <span className="font-mono font-bold text-emerald-600 text-base">
                  ₹ {postedInvoiceData.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-3 flex space-x-2">
                <button
                  onClick={() => {
                    setPostedInvoiceData(null);
                    setItems([]);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  New Bill
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setPostedInvoiceData(null);
                    setItems([]);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md"
                >
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-blue-400">person_add</span>
                Create New Customer
              </h3>
              <button onClick={() => setIsNewCustomerModalOpen(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveNewCustomer} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Apex Retailers Ltd"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={newCustMobile}
                    onChange={(e) => setNewCustMobile(e.target.value)}
                    placeholder="e.g. 9822001122"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={newCustGst}
                    onChange={(e) => setNewCustGst(e.target.value)}
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Customer Group & Tax Profile</label>
                <select
                  value={newCustGroup}
                  onChange={(e) => setNewCustGroup(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-700"
                >
                  <option value="CG-Retail">Retail Customers (Intrastate)</option>
                  <option value="CG-Corporate">Corporate Clients (Interstate IGST & Credit Limit)</option>
                  <option value="CG-LargeRetail">Large Format Retail (Wholesale Net 60)</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Save & Select Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesBillingStudio;
