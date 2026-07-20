/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 2.1.3
 * Created      : 2026-07-10
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { Product, POSProfile, Shift, Bill } from "../types";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { AdvancedBillingEngine } from "./AdvancedBillingEngine.tsx";
import { getCustomers } from "../services/customerStore.ts";
import { useTerminalShortcuts } from "./terminal/KeyboardEngine";

interface PosTerminalTabProps {
  products: Product[];
  profiles: POSProfile[];
  shifts: Shift[];
  onRefreshData: () => void;
  onNotification: (title: string, msg: string, type: "success" | "error") => void;
}

const SALESPERSONS = [
  { id: "emp-101", name: "Rajesh Kumar", code: "EMP101" },
  { id: "emp-102", name: "Anjali Sharma", code: "EMP102" },
  { id: "emp-103", name: "Amit Patel", code: "EMP103" },
  { id: "emp-104", name: "Pooja Roy", code: "EMP104" }
];

export const PosTerminalTab: React.FC<PosTerminalTabProps> = ({
  products,
  profiles,
  shifts,
  onRefreshData,
  onNotification
}) => {
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [openingBalance, setOpeningBalance] = useState("5000");
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  // Salesperson & Commission Engine State
  const [salespersonMode, setSalespersonMode] = useState<"single" | "line">("single");
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>("emp-101");

  // POS State
  const [cart, setCart] = useState<{ product: Product; quantity: number; salespersonId?: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [customerName, setCustomerName] = useState("Walk-In Customer");
  const [cashTendered, setCashTendered] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  // Restore held bills from sessionStorage on mount
  const [heldBills, setHeldBills] = useState<Bill[]>(() => {
    try {
      const saved = sessionStorage.getItem("smriti_held_bills");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showAdvancedBilling, setShowAdvancedBilling] = useState(false);

  // Set initial active profile
  useEffect(() => {
    if (profiles.length > 0 && !activeProfileId) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles]);

  // Persist held bills to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem("smriti_held_bills", JSON.stringify(heldBills));
  }, [heldBills]);

  // Debounce search query (150ms)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  // Find active open shift for active profile
  useEffect(() => {
    if (activeProfileId) {
      const openShift = shifts.find(s => s.profileId === activeProfileId && s.status === "Open");
      setActiveShift(openShift || null);
    } else {
      setActiveShift(null);
    }
  }, [activeProfileId, shifts]);

  // Categories
  const categories = ["All", ...Array.from(new Set(products.map(p => p.category)))];

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      onNotification("OutOfStock", `Stock exhausted for item ${product.code}`, "error");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          onNotification("LimitExceeded", "Cannot exceed on-hand warehouse stock limit", "error");
          return prev;
        }
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1, salespersonId: selectedSalespersonId }];
    });
  };

  const updateLineSalesperson = (productId: string, salespersonId: string) => {
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, salespersonId } : item));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
      return;
    }
    if (quantity > product.stock) {
      onNotification("StockCap", `Only ${product.stock} units available in Main warehouse`, "error");
      return;
    }
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };

  const totalCartValue = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Hold / Recall Bills â€” useCallback declared BEFORE keyboard useEffect to avoid forward-reference
  const handleHoldBill = useCallback(() => {
    setCart(prev => {
      if (prev.length === 0) return prev;
      const total = prev.reduce((s, i) => s + i.product.price * i.quantity, 0);
      const newHold: Bill = {
        id: `HOLD-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        items: [...prev],
        total,
        customerName
      };
      setHeldBills(h => [...h, newHold]);
      onNotification("Bill Held", `Bill logged under temporary slot: ${newHold.id}`, "success");
      return [];
    });
  }, [customerName, onNotification]);

  const handleRecallBill = useCallback((held: Bill) => {
    setCart(held.items);
    setCustomerName(held.customerName || "Walk-In Customer");
    setHeldBills(prev => prev.filter(b => b.id !== held.id));
    onNotification("Bill Recalled", `Slot ${held.id} loaded back to terminal`, "success");
  }, [onNotification]);

  // Keyboard Shortcuts for POS operations register via KeyboardEngine hook
  useTerminalShortcuts({
    "ESC": () => {
      setCart([]);
      onNotification("Cart Cleared", "Active shopping cart was cleared.", "success");
    },
    "F2": () => {
      handleHoldBill();
    },
    "F3": () => {
      if (cart.length > 0) {
        setShowAdvancedBilling(true);
      }
    },
    "F12": () => {
      if (cart.length > 0) {
        handleCheckout();
      }
    }
  });

  // Memoized product filter with debounced search
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return products.filter(p => {
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.barcodes && p.barcodes.some(b => b.value.toLowerCase().includes(q)));
      const matchesCat = selectedCategory === "All" || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, debouncedSearch, selectedCategory]);

  // Open Shift
  const handleOpenShift = async () => {
    if (!activeProfileId || !openingBalance) return;
    try {
      // Migrated: POST /api/pos/shifts/open (Express) → POST /api/v1/pos/shifts/open (FastAPI)
      await apiFetchV1("/pos/shifts/open", {
        method: "POST",
        body: JSON.stringify({ profileId: activeProfileId, openingBalance })
      });
      onNotification("Shift Opened", "Drawer register successfully opened and validated.", "success");
      onRefreshData();
    } catch (e: any) {
      console.error(e);
      onNotification("Error", e.message || "Failed to open shift.", "error");
    }
  };

  // Close Shift
  const handleCloseShift = async () => {
    if (!activeShift || !closingBalance) return;
    try {
      // Migrated: POST /api/pos/shifts/close/{id} (Express) → POST /api/v1/pos/shifts/close/{id} (FastAPI)
      await apiFetchV1(`/pos/shifts/close/${activeShift.id}`, {
        method: "POST",
        body: JSON.stringify({ closingBalance })
      });
      onNotification("Shift Closed", "Shift transactions archived and registered in core audits.", "success");
      setShowCloseModal(false);
      setClosingBalance("");
      onRefreshData();
    } catch (e: any) {
      console.error(e);
      onNotification("Error", e.message || "Failed to close shift.", "error");
    }
  };

  // Checkout Bill
  const handleCheckout = async () => {
    if (cart.length === 0 || !activeShift) return;
    try {
      // Migrated: POST /api/pos/checkout (Express) → POST /api/v1/pos/checkout (FastAPI)
      await apiFetchV1("/pos/checkout", {
        method: "POST",
        body: JSON.stringify({
          shiftId: activeShift.id,
          items: cart.map(item => ({
            ...item,
            salespersonId: item.salespersonId || selectedSalespersonId
          })),
          total: totalCartValue,
          customerName,
          salespersonId: selectedSalespersonId
        })
      });
      onNotification("Success", "Bill successfully paid, printed to lane queue, and recorded.", "success");
      setCart([]);
      setCustomerName("Walk-In Customer");
      setCashTendered("");
      onRefreshData();
    } catch (e: any) {
      console.error(e);
      onNotification("Error", e.message || "Checkout failed.", "error");
    }
  };

  // Tender change calculation
  const tenderCash = parseFloat(cashTendered || "0");
  const changeDue = tenderCash > totalCartValue ? tenderCash - totalCartValue : 0;

  return (
    <div className="space-y-6">
      
      {/* Shift Register Control Bar */}
      <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="material-symbols-outlined text-blue-500 text-3xl">point_of_sale</span>
            <div>
              <h3 className="font-display font-semibold text-lg text-theme-body">Billing Workspace</h3>
              <p className="text-xs text-theme-muted">Operational Terminal Configuration Layer</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Profile Selector */}
            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-theme-muted uppercase font-display">Active Terminal:</label>
              <select
                value={activeProfileId}
                onChange={(e) => setActiveProfileId(e.target.value)}
                className="bg-theme-surface-3 border border-theme-divider text-theme-body text-xs rounded px-2.5 py-1.5 focus:outline-none"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.cashier})</option>
                ))}
              </select>
            </div>

            {/* Salesperson & Commission Config */}
            <div className="flex items-center space-x-2 border-l border-theme-divider pl-4">
              <label className="text-xs font-semibold text-theme-muted uppercase font-display">Salesperson:</label>
              {salespersonMode === "single" ? (
                <select
                  value={selectedSalespersonId}
                  onChange={(e) => setSelectedSalespersonId(e.target.value)}
                  className="bg-theme-surface-3 border border-theme-divider text-theme-body text-xs rounded px-2.5 py-1.5 focus:outline-none"
                >
                  {SALESPERSONS.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-amber-400 font-mono font-semibold bg-amber-950 bg-opacity-30 border border-amber-900 border-opacity-40 px-2 py-1 rounded">
                  Line-Level Assigned
                </span>
              )}
              
              <button
                onClick={() => setSalespersonMode(prev => prev === "single" ? "line" : "single")}
                className="bg-theme-surface-3 border border-theme-divider hover:bg-theme-surface-2 text-theme-body text-[10px] font-bold uppercase px-2 py-1.5 rounded transition-all ml-1"
                title="Toggle single salesperson vs line-level salesperson tracking"
              >
                Mode: {salespersonMode.toUpperCase()}
              </button>
            </div>

            {/* Shift Indicators */}
            {activeShift ? (
              <div className="flex items-center space-x-3 bg-theme-surface-3 px-4 py-1.5 rounded border border-theme-divider">
                <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold font-mono">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                  <span>SHIFT OPEN (ID: {activeShift.id})</span>
                </div>
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold uppercase px-3 py-1 rounded transition-colors"
                >
                  Close Register
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 bg-theme-surface-3 px-4 py-1.5 rounded border border-rose-900 border-opacity-50">
                <span className="text-xs text-rose-400 font-semibold font-mono uppercase">LANE REGISTER CLOSED</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="bg-theme-surface-1 border border-theme-divider text-theme-body text-xs rounded px-2 py-1 w-24"
                    placeholder="Opening Balance"
                  />
                  <button
                    onClick={handleOpenShift}
                    className="bg-[#2563EB] hover:bg-opacity-95 text-theme-body text-[10px] font-bold uppercase px-3 py-1.5 rounded transition-all"
                  >
                    Open Shift
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeShift ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Area: Product list (Col span 7) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Lookup Name, Item Code, or Scan Barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Barcode scanner auto-add: Enter key with a non-empty search that matches exactly
                  if (e.key === "Enter" && searchQuery.trim().length > 2) {
                    const exact = products.find(
                      p => p.barcode === searchQuery.trim() ||
                        (p.barcodes && p.barcodes.some(b => b.value === searchQuery.trim()))
                    ) || filteredProducts[0];
                    if (exact) { addToCart(exact); setSearchQuery(""); }
                  }
                }}
                className="flex-1 bg-theme-surface-1 border border-theme-divider text-theme-body text-xs px-3 py-2 rounded focus:outline-none focus:border-[#2563EB]"
              />
              <div className="flex gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs px-3 py-2 rounded font-semibold border transition-all ${
                      selectedCategory === cat 
                        ? "bg-[#2563EB] border-[#2563EB] text-theme-body" 
                        : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:border-[#2563EB]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products grid */}
            <SmritiScrollArea maxHeight={460} fadeColorClass="from-[#16213e]">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pr-1">
                {filteredProducts.map(prod => (
                  <div
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    className="bg-theme-surface-1 border border-theme-divider rounded-lg p-4 cursor-pointer hover:border-[#2563EB] group transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between text-[10px] text-theme-muted font-mono">
                        <span>{prod.code}</span>
                        <span>{prod.barcode}</span>
                      </div>
                      <h4 className="mt-1 font-semibold text-sm text-theme-body group-hover:text-[#2563EB] transition-colors">{prod.name}</h4>
                      
                      {/* Attributes */}
                      <div className="mt-2 flex gap-1.5">
                        {prod.color && (
                          <span className="text-[10px] bg-theme-surface-3 text-theme-muted px-1.5 py-0.5 rounded border border-theme-divider">
                            Color: {prod.color}
                          </span>
                        )}
                        {prod.size && (
                          <span className="text-[10px] bg-theme-surface-3 text-theme-muted px-1.5 py-0.5 rounded border border-theme-divider">
                            Size: {prod.size}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-theme-divider pt-2">
                      <span className="text-emerald-400 font-bold text-sm">â‚¹{prod.price}</span>
                      <span className={`text-[10px] font-bold uppercase ${prod.stock < 10 ? "text-rose-500 animate-pulse" : "text-emerald-500"}`}>
                        {prod.stock} units
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SmritiScrollArea>

            {/* Holds list */}
            {heldBills.length > 0 && (
              <div className="bg-theme-surface-1 p-4 rounded-xl border border-theme-divider">
                <h4 className="text-xs font-semibold text-theme-muted uppercase font-display mb-3">Temporary Hold Slots</h4>
                <div className="flex flex-wrap gap-2">
                  {heldBills.map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleRecallBill(b)}
                      className="text-xs bg-theme-surface-3 border border-amber-500 border-opacity-40 text-amber-500 hover:bg-[#2563EB] hover:text-theme-body hover:border-[#2563EB] px-3 py-1.5 rounded transition-all flex items-center space-x-1"
                    >
                      <span className="material-symbols-outlined text-sm">folder_open</span>
                      <span>Recall {b.id} (â‚¹{b.total})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Area: Cashier Desk (Col span 5) */}
          <div className="lg:col-span-5 bg-theme-surface-1 border border-theme-divider rounded-xl p-5 flex flex-col justify-between min-h-[500px]">
            <div>
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-theme-divider">
                <h4 className="font-display font-semibold text-sm text-theme-body">Active Cart</h4>
                <button
                  onClick={handleHoldBill}
                  disabled={cart.length === 0}
                  className="text-xs text-amber-500 hover:text-amber-400 font-semibold flex items-center space-x-1 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-sm">pause_circle</span>
                  <span>Hold Slot</span>
                </button>
              </div>

              {/* Cart List */}
              <SmritiScrollArea maxHeight={180} fadeColorClass="from-[#16213e]">
                <div className="space-y-3 pr-1">
                  {cart.length === 0 ? (
                    <div className="py-8 text-center text-theme-muted text-xs">
                      <span className="material-symbols-outlined text-3xl block mb-2 opacity-50">shopping_cart</span>
                      Cart is empty. Tap items to checkout.
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.product.id} className="flex justify-between items-center bg-theme-surface-3 p-3 rounded-lg border border-theme-divider">
                        <div className="flex-1 min-w-0 pr-3">
                          <h5 className="font-semibold text-theme-body text-xs truncate">{item.product.name}</h5>
                          <p className="text-[10px] text-theme-muted font-mono">â‚¹{item.product.price} / unit</p>
                          {salespersonMode === "line" && (
                            <div className="mt-1 flex items-center space-x-1">
                              <span className="text-[9px] text-theme-muted font-semibold uppercase">Staff:</span>
                              <select
                                value={item.salespersonId || selectedSalespersonId}
                                onChange={(e) => updateLineSalesperson(item.product.id, e.target.value)}
                                className="bg-theme-surface-1 border border-theme-divider text-theme-body text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
                              >
                                {SALESPERSONS.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="flex items-center bg-theme-surface-1 rounded border border-theme-divider">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="text-theme-body hover:bg-theme-surface-3 px-2 py-0.5"
                            >
                              -
                            </button>
                            <span className="text-theme-body text-xs font-mono font-bold px-3">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="text-theme-body hover:bg-theme-surface-3 px-2 py-0.5"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-emerald-400 font-bold text-xs w-16 text-right">
                            â‚¹{item.product.price * item.quantity}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SmritiScrollArea>
            </div>

            {/* Customer & Checkout controls */}
            <div className="mt-4 pt-4 border-t border-theme-divider space-y-4">
              
              {/* Customer autocomplete input */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-theme-muted uppercase font-display shrink-0">Loyalty Account:</span>
                <input
                  type="text"
                  list="smriti-customer-datalist"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="flex-1 bg-theme-surface-3 border border-theme-divider text-theme-body text-xs rounded px-2 py-1 w-full"
                />
                <datalist id="smriti-customer-datalist">
                  {getCustomers().map(c => (
                    <option key={c.id} value={c.name}>{c.mobile ? `${c.name} â€” ${c.mobile}` : c.name}</option>
                  ))}
                </datalist>
              </div>

              {/* Total display â€” per-product GST rates */}
              {(() => {
                const totalTax = cart.reduce((sum, item) => {
                  const rate = (item.product.gstPercentage ?? 18) / 100;
                  return sum + (item.product.price * item.quantity * rate);
                }, 0);
                const effectiveRate = totalCartValue > 0
                  ? ((totalTax / totalCartValue) * 100).toFixed(1)
                  : "18.0";
                return (
                  <div className="bg-theme-surface-3 p-4 rounded-lg border border-theme-divider space-y-1.5">
                    <div className="flex justify-between text-xs text-theme-muted">
                      <span>Subtotal (Excl. Tax):</span>
                      <span>â‚¹{(totalCartValue - totalTax).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-theme-muted">
                      <span>GST (avg {effectiveRate}% on items):</span>
                      <span>â‚¹{totalTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-theme-body border-t border-theme-divider pt-1.5 mt-1.5">
                      <span>Grand Total:</span>
                      <span className="text-emerald-400">â‚¹{totalCartValue}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Cash tendered calculator */}
              {cart.length > 0 && (
                <div className="bg-theme-surface-3 bg-opacity-50 p-3 rounded-lg border border-theme-divider flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="material-symbols-outlined text-xs text-theme-muted">calculate</span>
                    <span className="text-[11px] text-theme-muted">Cash Tendered:</span>
                  </div>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder="â‚¹ Received"
                    className="bg-theme-surface-1 border border-theme-divider text-theme-body text-xs rounded px-2.5 py-1 w-24 text-right focus:outline-none"
                  />
                  {changeDue > 0 && (
                    <div className="text-xs text-[#22c55e] font-mono font-bold">
                      Change: â‚¹{Math.round(changeDue)}
                    </div>
                  )}
                </div>
              )}

              {/* Hotkey Indicator */}
              <div className="grid grid-cols-4 gap-1 text-[10px] text-theme-muted font-mono px-1 text-center mb-1">
                <span className="bg-theme-surface-3 py-0.5 rounded border border-theme-divider">[Esc] Void</span>
                <span className="bg-theme-surface-3 py-0.5 rounded border border-theme-divider">[F2] Hold</span>
                <span className="bg-theme-surface-3 py-0.5 rounded border border-theme-divider">[F3] Adv Invoice</span>
                <span className="bg-theme-surface-3 py-0.5 rounded border border-theme-divider">[F12] Quick Pay</span>
              </div>

              {/* Submit checkout button */}
              <div className="space-y-2">
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="w-full bg-[#1e293b] hover:bg-slate-800 text-theme-body font-bold uppercase py-2.5 rounded-lg border border-[#334155] transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
                >
                  <span className="material-symbols-outlined text-base">payments</span>
                  <span>Standard Checkout (F12)</span>
                </button>

                <button
                  onClick={() => setShowAdvancedBilling(true)}
                  disabled={cart.length === 0}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold uppercase py-3.5 rounded-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-blue-950/20 text-xs"
                >
                  <span className="material-symbols-outlined text-base">receipt_long</span>
                  <span>Advanced GST Invoicing</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      ) : (
        <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-12 text-center max-w-lg mx-auto mt-12">
          <span className="material-symbols-outlined text-6xl text-rose-500 animate-pulse block mb-4">lock</span>
          <h3 className="text-xl font-bold font-display text-theme-body mb-2">Cash Lane Register Locked</h3>
          <p className="text-xs text-theme-muted leading-relaxed mb-6">
            An active opening balance must be declared to unlock POS layouts. Enter your starting drawer cashier float cash in the header above and trigger <strong>Open Shift</strong> to proceed.
          </p>
        </div>
      )}

      {/* Close Register Dialog Modal */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-70" onClick={() => setShowCloseModal(false)}></div>
          <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 max-w-md w-full relative z-10 space-y-4">
            <h4 className="font-display font-semibold text-lg text-theme-body">Declare Drawer Close Float Balance</h4>
            <p className="text-xs text-theme-muted">
              Input your total drawer cash to close Shift Register <span className="font-mono text-theme-body text-xs font-bold">#{activeShift.id}</span>. SMRITI will audit discrepancies in closing ledger logs.
            </p>
            
            <div className="bg-theme-surface-3 p-4 rounded border border-theme-divider space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-theme-muted">Opening Float Cash:</span>
                <span className="font-bold text-theme-body">â‚¹{activeShift.openingBalance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-theme-muted">Sales Registered (Value):</span>
                <span className="font-bold text-[#22c55e]">+â‚¹{activeShift.salesValue}</span>
              </div>
              <div className="flex justify-between border-t border-theme-divider pt-2 mt-2">
                <span className="text-theme-body font-semibold">Expected Closing Drawer Value:</span>
                <span className="font-bold text-theme-body">â‚¹{activeShift.openingBalance + activeShift.salesValue}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-muted uppercase font-display mb-2">Declared Physical Cash:</label>
              <input
                type="number"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                className="bg-theme-surface-3 border border-theme-divider text-theme-body text-sm rounded px-3 py-2 w-full focus:outline-none"
                placeholder="â‚¹ Amount in drawer"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowCloseModal(false)}
                className="bg-theme-surface-3 text-theme-muted hover:text-theme-body px-4 py-2 rounded text-xs font-semibold transition-colors"
              >
                Abort
              </button>
              <button
                onClick={handleCloseShift}
                disabled={!closingBalance}
                className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded text-xs font-semibold transition-colors disabled:opacity-40"
              >
                Archive & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdvancedBilling && (
        <AdvancedBillingEngine
          cart={cart}
          onClearCart={() => setCart([])}
          activeShift={activeShift}
          activeProfile={profiles.find(p => p.id === activeProfileId) || null}
          onCheckoutSuccess={(bill) => {
            onRefreshData();
          }}
          onNotification={onNotification}
          onClose={() => setShowAdvancedBilling(false)}
        />
      )}

    </div>
  );
};
