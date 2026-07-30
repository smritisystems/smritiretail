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
  uom: string;
  rate: number;
  discountPct: number;
}

// Product catalog for item search lookup
const CATALOG_PRODUCTS = [
  { barcode: "8901234567890", name: "Nike Sports Shoes", hsn: "6404", rate: 2500.0, uom: "Pair" },
  { barcode: "8901234567891", name: "Cotton Socks", hsn: "6115", rate: 250.0, uom: "Pair" },
  { barcode: "8901234567892", name: "Adidas Cap", hsn: "6505", rate: 500.0, uom: "Pcs" },
  { barcode: "8901234567893", name: "Puma Running T-Shirt", hsn: "6109", rate: 1200.0, uom: "Pcs" },
  { barcode: "8901234567894", name: "Formal Leather Shoes", hsn: "6403", rate: 3500.0, uom: "Pair" },
  { barcode: "8901234567895", name: "Denim Jeans Trousers", hsn: "6203", rate: 1800.0, uom: "Pcs" },
  { barcode: "8901234567896", name: "Smart POS Printer", hsn: "8471", rate: 6500.0, uom: "Pcs" },
];

export const SalesBillingStudio: React.FC = () => {
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

  // New Customer Modal State
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>("");
  const [newCustMobile, setNewCustMobile] = useState<string>("");
  const [newCustGst, setNewCustGst] = useState<string>("");
  const [newCustGroup, setNewCustGroup] = useState<string>("CG-Retail");
  const [newCustEmail, setNewCustEmail] = useState<string>("");

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

  // Default Line Items
  const [items, setItems] = useState<LineItem[]>([
    {
      id: "item-1",
      barcode: "8901234567890",
      name: "Nike Sports Shoes",
      hsnCode: "6404",
      qty: 1,
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
      uom: "Pcs",
      rate: 500.0,
      discountPct: 0.0,
    },
  ]);

  // Fetch Customers on Mount
  useEffect(() => {
    try {
      const custs = getCustomers();
      if (Array.isArray(custs)) setCustomerList(custs);
    } catch {
      // Fallback
    }
  }, []);

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
    if (!itemSearch.trim()) return [];
    const q = itemSearch.toLowerCase();
    return CATALOG_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.hsn.includes(q)
    );
  }, [itemSearch]);

  // Select Customer from Autocomplete Lookup
  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setSelectedCustomerName(c.name);
    setCustomerSearch(c.name);
    setMobileNumber(c.mobile);
    setGstin(c.gstNumber || "27ABCDE1234F1Z5");
    setIsWalkIn(false);
    setIsCustomerDropdownOpen(false);

    // Auto-set Tax Profile based on customer group
    if (c.customerGroupId === "CG-Corporate") {
      setTaxProfile("Corporate Wholesale");
    } else if (c.customerGroupId === "CG-LargeRetail") {
      setTaxProfile("Large Format Retail");
    } else {
      setTaxProfile("Retail Registered");
    }
  };

  // Add Item from Autocomplete Lookup
  const handleSelectCatalogItem = (p: typeof CATALOG_PRODUCTS[0]) => {
    const existingIndex = items.findIndex((i) => i.barcode === p.barcode);
    if (existingIndex >= 0) {
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, qty: item.qty + 1 } : item
        )
      );
    } else {
      const newItem: LineItem = {
        id: `item-${Date.now()}`,
        barcode: p.barcode,
        name: p.name,
        hsnCode: p.hsn,
        qty: 1,
        uom: p.uom,
        rate: p.rate,
        discountPct: 0.0,
      };
      setItems((prev) => [...prev, newItem]);
    }
    setItemSearch("");
    setIsItemDropdownOpen(false);
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
    } else if (code === "FLAT100") {
      setCouponDiscountVal(100);
      setCouponAppliedMsg("FLAT100 Applied (₹100 Off)");
    } else if (code) {
      setCouponDiscountVal(50);
      setCouponAppliedMsg(`${code} Applied (₹50 Off)`);
    }
  };

  // STRE Tax Engine Integration (TG-001 / TG-002)
  const taxCalculation = useMemo(() => {
    const taxCtx: TaxContext = {
      companyState: "27",
      customerState: gstin ? gstin.substring(0, 2) : "27",
      customerGstin: gstin,
      customerGroupTaxProfile: taxProfile,
      documentDate: new Date().toISOString().split("T")[0],
      placeOfSupply: "27",
      pricingPolicy: "EXCLUSIVE",
      currency: "INR",
      items: items.map((i) => ({
        itemId: i.id,
        itemCode: i.barcode,
        itemName: i.name,
        hsnCode: i.hsnCode,
        quantity: i.qty,
        unitPrice: i.rate * (1 - i.discountPct / 100),
      })),
    };

    return STRE.calculate(taxCtx);
  }, [items, gstin, taxProfile]);

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

  // Handlers for Items
  const updateQty = (id: string, newQty: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, newQty) } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAllItems = () => {
    setItems([]);
  };

  const addNewItem = () => {
    const newItem: LineItem = {
      id: `item-${Date.now()}`,
      barcode: `89012345${Math.floor(10000 + Math.random() * 90000)}`,
      name: "New Retail Item",
      hsnCode: "6404",
      qty: 1,
      uom: "Pcs",
      rate: 1000.0,
      discountPct: 0.0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col justify-between relative">
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

          <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-lg">notifications</span>
          </button>
          <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer">
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
        {/* Left Column - Billing Workflow Canvas */}
        <div className="col-span-8 space-y-4">
          {/* Section 1: Customer Information */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="material-symbols-outlined text-sm mr-1.5 text-blue-600">person</span>
                Customer Information
              </h2>
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
                  <span className="material-symbols-outlined text-xs text-slate-400 cursor-pointer">expand_more</span>
                </div>
              </div>
            </div>
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
                            Barcode: {p.barcode} | HSN: {p.hsn}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900">₹{p.rate.toFixed(2)}</span>
                          <span className="text-[10px] text-blue-600 block">Select Item</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition">
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
                Items
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
                    <th className="py-2.5 px-3 text-center w-16">Qty</th>
                    <th className="py-2.5 px-3 text-center w-16">UOM</th>
                    <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right">Disc %</th>
                    <th className="py-2.5 px-3 text-center">Tax (Auto)</th>
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

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{item.barcode}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{item.name}</div>
                          <span className="text-[10px] font-mono text-slate-400">HSN: {item.hsnCode}</span>
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
                            {lineGstPct}% IGST
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

            <div className="mt-2 text-xs font-bold text-blue-900">Total Items: {items.length}</div>
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
                  <button className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold cursor-pointer transition">
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
                <span className="font-semibold text-slate-800">Maharashtra (27)</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                <span className="text-slate-400">HSN Summary</span>
                <a href="#hsn-details" className="text-blue-600 font-bold hover:underline text-[10px]">
                  View Details &gt;
                </a>
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
                  <tr>
                    <td className="py-1.5 px-2 font-bold text-slate-700">CGST</td>
                    <td className="py-1.5 px-2 text-center text-slate-600">9%</td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-700">₹ 2,950.00</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-800">₹ 265.50</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 font-bold text-slate-700">SGST</td>
                    <td className="py-1.5 px-2 text-center text-slate-600">9%</td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-700">₹ 2,950.00</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-800">₹ 265.50</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 font-bold text-slate-700">IGST</td>
                    <td className="py-1.5 px-2 text-center text-slate-600">18%</td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-700">₹ 590.00</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-800">₹ 106.20</td>
                  </tr>
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
          <button className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer">
            <span className="material-symbols-outlined text-sm mr-1.5">pause</span>
            Hold Bill (F6)
          </button>
          <button className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer">
            <span className="material-symbols-outlined text-sm mr-1.5">restore</span>
            Recall Bill (F7)
          </button>
          <button className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer">
            <span className="material-symbols-outlined text-sm mr-1.5">sell</span>
            Bill Discount (F8)
          </button>
          <button className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer">
            <span className="material-symbols-outlined text-sm mr-1.5">save</span>
            Save Draft (F9)
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-extrabold text-xs flex items-center cursor-pointer shadow-md shadow-blue-600/30 uppercase tracking-wide">
            <span className="material-symbols-outlined text-base mr-1.5">credit_card</span>
            Payment (F4)
          </button>
          <button className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-extrabold text-xs flex items-center cursor-pointer shadow-md shadow-emerald-600/30 uppercase tracking-wide">
            <span className="material-symbols-outlined text-base mr-1.5">check_circle</span>
            Post Invoice
          </button>
          <button className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center cursor-pointer">
            <span className="material-symbols-outlined text-base mr-1.5">print</span>
            Print (F10)
          </button>
        </div>
      </footer>

      {/* New Customer Modal */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-blue-400">person_add</span>
                Create New Customer
              </h3>
              <button
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
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
                  <option value="CG-Corporate">Corporate Clients (Interstate IGST)</option>
                  <option value="CG-LargeRetail">Large Format Retail (Wholesale)</option>
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
