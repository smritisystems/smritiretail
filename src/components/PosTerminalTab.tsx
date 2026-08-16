/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.28.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : POS Billing Terminal (Fiori Horizon Inspired Light Theme)
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { Product, POSProfile, Shift, Bill } from "../types";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { AdvancedBillingEngine } from "./AdvancedBillingEngine.tsx";
import { getCustomers } from "../services/customerStore.ts";
import { 
  ShoppingCart, 
  Search, 
  Barcode, 
  User, 
  CreditCard, 
  Lock, 
  Unlock, 
  Trash2, 
  Plus, 
  Minus, 
  RefreshCw, 
  FileText, 
  Zap, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  PauseCircle,
  PlayCircle
} from "lucide-react";

interface PosTerminalTabProps {
  products: Product[];
  profiles: POSProfile[];
  shifts: Shift[];
  onRefreshData: () => void;
  onNotification: (title: string, msg: string, type: "success" | "error") => void;
}

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

  // POS State
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
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
      return [...prev, { product, quantity: 1 }];
    });
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

  // Keyboard Shortcuts for POS operations register
  useEffect(() => {
    if (!activeShift) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc -> Void / Clear Cart
      if (e.key === "Escape") {
        e.preventDefault();
        setCart([]);
        onNotification("Cart Cleared", "Active shopping cart was cleared.", "success");
      }
      
      // F2 -> Hold Bill
      if (e.key === "F2") {
        e.preventDefault();
        handleHoldBill();
      }

      // F3 -> Show Advanced Billing
      if (e.key === "F3") {
        e.preventDefault();
        if (cart.length > 0) {
          setShowAdvancedBilling(true);
        }
      }

      // F12 -> Trigger Standard Checkout
      if (e.key === "F12") {
        e.preventDefault();
        if (cart.length > 0) {
          handleCheckout();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeShift, cart, customerName, handleHoldBill]);

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
          items: cart,
          total: totalCartValue,
          customerName
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
      <div className="bg-theme-surface-1 p-4 rounded-xl border border-theme-border shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-theme-primary/10 text-theme-primary flex items-center justify-center shrink-0">
              <CreditCard size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-theme-body tracking-tight">POS Billing & Quick Checkout</h3>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">
                  Terminal Online
                </span>
              </div>
              <p className="text-xs text-theme-muted font-mono mt-0.5">POS &gt; Lane Terminal &gt; Quick Billing</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Terminal Profile Selector */}
            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-theme-muted uppercase font-mono">Terminal:</label>
              <select
                value={activeProfileId}
                onChange={(e) => setActiveProfileId(e.target.value)}
                className="bg-theme-surface-2 border border-theme-border text-theme-body text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-theme-primary cursor-pointer"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.cashier})</option>
                ))}
              </select>
            </div>

            {/* Shift Open / Closed Indicator */}
            {activeShift ? (
              <div className="flex items-center space-x-3 bg-emerald-50/60 border border-emerald-200 px-3.5 py-1.5 rounded-lg">
                <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-bold font-mono">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full animate-ping"></span>
                  <span>SHIFT OPEN (#{activeShift.id})</span>
                </div>
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  Close Register
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 bg-rose-50/60 border border-rose-200 px-3.5 py-1.5 rounded-lg">
                <span className="text-xs text-rose-700 font-bold font-mono uppercase">REGISTER LOCKED</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="bg-theme-surface-1 border border-theme-border text-theme-body text-xs rounded-lg px-2.5 py-1 w-24 font-mono text-right"
                    placeholder="Opening ₹"
                  />
                  <button
                    onClick={handleOpenShift}
                    className="bg-theme-primary hover:bg-theme-primary-hover text-white text-[10px] font-bold uppercase px-3 py-1 rounded-md transition-all cursor-pointer"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Area: Product list (Col span 7) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Search & Category Filter Toolbar */}
            <div className="bg-theme-surface-1 p-3 border border-theme-border rounded-xl shadow-xs space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Lookup Name, Item Code, or Scan Barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim().length > 2) {
                      const exact = products.find(
                        p => p.barcode === searchQuery.trim() ||
                          (p.barcodes && p.barcodes.some(b => b.value === searchQuery.trim()))
                      ) || filteredProducts[0];
                      if (exact) { addToCart(exact); setSearchQuery(""); }
                    }
                  }}
                  className="w-full bg-theme-surface-2 border border-theme-border text-theme-body text-xs pl-9 pr-8 py-2 rounded-lg focus:outline-none focus:border-theme-primary font-medium"
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                <Barcode size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              </div>

              <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all shrink-0 cursor-pointer ${
                      selectedCategory === cat 
                        ? "bg-theme-selection text-theme-primary font-bold border-theme-primary/30 shadow-xs" 
                        : "bg-theme-surface-2 border-theme-border text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products grid */}
            <SmritiScrollArea maxHeight={460} fadeColorClass="from-[#16213e]">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pr-1">
                {filteredProducts.map(prod => (
                  <div
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    className="bg-theme-surface-1 border border-theme-border rounded-xl p-3.5 cursor-pointer hover:border-theme-primary group transition-all flex flex-col justify-between shadow-xs hover:shadow-md"
                  >
                    <div>
                      <div className="flex justify-between text-[10px] text-theme-muted font-mono">
                        <span>{prod.code}</span>
                        <span>{prod.barcode}</span>
                      </div>
                      <h4 className="mt-1 font-bold text-xs text-theme-body group-hover:text-theme-primary transition-colors line-clamp-2">
                        {prod.name}
                      </h4>
                      
                      {/* Attributes */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {prod.color && (
                          <span className="text-[9px] bg-theme-surface-2 text-theme-muted px-1.5 py-0.2 rounded border border-theme-border font-mono">
                            {prod.color}
                          </span>
                        )}
                        {prod.size && (
                          <span className="text-[9px] bg-theme-surface-2 text-theme-muted px-1.5 py-0.2 rounded border border-theme-border font-mono">
                            Size: {prod.size}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-theme-divider pt-2">
                      <span className="text-emerald-700 font-bold text-sm font-mono">₹{prod.price}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        prod.stock < 10 
                          ? "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse" 
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}>
                        {prod.stock} PCS
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SmritiScrollArea>

            {/* Temporary Holds List */}
            {heldBills.length > 0 && (
              <div className="bg-theme-surface-1 p-3.5 rounded-xl border border-theme-border space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-theme-body uppercase font-mono tracking-wider">Temporary Hold Slots</h4>
                  <span className="text-[10px] text-theme-muted font-mono">{heldBills.length} Slots</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {heldBills.map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleRecallBill(b)}
                      className="text-xs bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 font-mono cursor-pointer shadow-xs"
                    >
                      <PlayCircle size={13} className="text-amber-700" />
                      <span>Recall {b.id} (₹{b.total})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Area: Cashier Desk (Col span 5) */}
          <div className="lg:col-span-5 bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs flex flex-col justify-between min-h-[500px] space-y-4">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-theme-divider">
                <div className="flex items-center space-x-2">
                  <ShoppingCart size={16} className="text-theme-primary" />
                  <h4 className="font-bold text-xs text-theme-body uppercase font-mono tracking-wider">
                    Active Cart ({cart.reduce((a, b) => a + b.quantity, 0)} Items)
                  </h4>
                </div>
                <button
                  onClick={handleHoldBill}
                  disabled={cart.length === 0}
                  className="text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center space-x-1 disabled:opacity-40 cursor-pointer"
                >
                  <PauseCircle size={14} />
                  <span>Hold Slot (F2)</span>
                </button>
              </div>

              {/* Cart List */}
              <SmritiScrollArea maxHeight={200} fadeColorClass="from-[#16213e]">
                <div className="space-y-2 pt-2 pr-1">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-theme-muted text-xs space-y-1">
                      <ShoppingCart size={28} className="mx-auto text-theme-muted/50 mb-2" />
                      <p className="font-medium text-theme-body">Cart is empty</p>
                      <p className="text-[11px]">Scan barcode or tap catalog items to checkout</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.product.id} className="flex justify-between items-center bg-theme-surface-2 p-2.5 rounded-lg border border-theme-border text-xs">
                        <div className="flex-1 min-w-0 pr-2">
                          <h5 className="font-bold text-theme-body truncate text-[11px]">{item.product.name}</h5>
                          <p className="text-[10px] text-theme-muted font-mono">₹{item.product.price} / unit</p>
                        </div>
                        <div className="flex items-center space-x-2.5 shrink-0">
                          <div className="flex items-center bg-theme-surface-1 rounded-md border border-theme-border">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="text-theme-body hover:bg-theme-surface-hover px-2 py-0.5 font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-theme-body text-xs font-mono font-bold px-2 py-0.5">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="text-theme-body hover:bg-theme-surface-hover px-2 py-0.5 font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-emerald-700 font-bold font-mono text-xs w-16 text-right">
                            ₹{(item.product.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SmritiScrollArea>
            </div>

            {/* Customer & Checkout Controls */}
            <div className="pt-3 border-t border-theme-divider space-y-3">
              
              {/* Customer Autocomplete Input */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-theme-muted font-mono uppercase text-[10px] shrink-0">Customer / Loyalty:</span>
                <input
                  type="text"
                  list="smriti-customer-datalist"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="flex-1 bg-theme-surface-2 border border-theme-border text-theme-body text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-theme-primary"
                />
                <datalist id="smriti-customer-datalist">
                  {getCustomers().map(c => (
                    <option key={c.id} value={c.name}>{c.mobile ? `${c.name} - ${c.mobile}` : c.name}</option>
                  ))}
                </datalist>
              </div>

              {/* Total Display Breakdown */}
              {(() => {
                const totalTax = cart.reduce((sum, item) => {
                  const rate = (item.product.gstPercentage ?? 18) / 100;
                  return sum + (item.product.price * item.quantity * rate);
                }, 0);
                const effectiveRate = totalCartValue > 0
                  ? ((totalTax / totalCartValue) * 100).toFixed(1)
                  : "18.0";
                return (
                  <div className="bg-theme-surface-2 p-3.5 rounded-xl border border-theme-border space-y-1.5 text-xs">
                    <div className="flex justify-between text-theme-muted">
                      <span>Subtotal (Excl. Tax):</span>
                      <span className="font-mono">₹{(totalCartValue - totalTax).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-theme-muted">
                      <span>GST (avg {effectiveRate}%):</span>
                      <span className="font-mono">₹{totalTax.toFixed(2)}</span>
                    </div>
                    
                    {/* Dark Navy Grand Total Banner */}
                    <div className="bg-[#1E293B] text-white p-3 rounded-lg flex justify-between items-center mt-2 shadow-xs">
                      <span className="font-bold uppercase tracking-wider font-mono text-xs">Grand Total</span>
                      <span className="text-lg font-bold font-mono">₹{totalCartValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Cash Tendered Calculator */}
              {cart.length > 0 && (
                <div className="bg-theme-surface-2 p-2.5 rounded-xl border border-theme-border flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-1.5 text-theme-muted font-medium">
                    <DollarSign size={13} />
                    <span>Cash Tendered:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="₹ Received"
                      className="bg-theme-surface-1 border border-theme-border text-theme-body text-xs rounded-lg px-2.5 py-1 w-28 text-right font-mono font-bold focus:outline-none focus:border-theme-primary"
                    />
                    {changeDue > 0 && (
                      <span className="text-xs text-emerald-700 font-mono font-bold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                        Change: ₹{Math.round(changeDue)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Hotkey Indicators */}
              <div className="grid grid-cols-4 gap-1 text-[9px] text-theme-muted font-mono text-center">
                <span className="bg-theme-surface-2 py-1 rounded border border-theme-border">[Esc] Void</span>
                <span className="bg-theme-surface-2 py-1 rounded border border-theme-border">[F2] Hold</span>
                <span className="bg-theme-surface-2 py-1 rounded border border-theme-border">[F3] Adv Inv</span>
                <span className="bg-theme-surface-2 py-1 rounded border border-theme-border">[F12] Quick Pay</span>
              </div>

              {/* Checkout Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="w-full bg-[#1E293B] hover:bg-slate-800 text-white font-bold uppercase py-2.5 rounded-xl border border-[#334155] transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs shadow-xs"
                >
                  <Zap size={14} />
                  <span>Standard Checkout (F12)</span>
                </button>

                <button
                  onClick={() => setShowAdvancedBilling(true)}
                  disabled={cart.length === 0}
                  className="w-full bg-theme-primary hover:bg-theme-primary-hover text-white font-bold uppercase py-3 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md text-xs"
                >
                  <FileText size={14} />
                  <span>Advanced GST Invoicing (F3)</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      ) : (
        <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-12 text-center max-w-lg mx-auto mt-8 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Lock size={32} />
          </div>
          <h3 className="text-lg font-bold text-theme-body mb-2">Cash Lane Register Locked</h3>
          <p className="text-xs text-theme-muted leading-relaxed mb-6">
            An active opening balance float cash must be declared to unlock POS billing layouts. Enter your starting drawer cashier float cash in the header control bar above and click <strong>Open Shift</strong> to proceed.
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
                <span className="font-bold text-theme-body">₹{activeShift.openingBalance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-theme-muted">Sales Registered (Value):</span>
                <span className="font-bold text-[#22c55e]">+₹{activeShift.salesValue}</span>
              </div>
              <div className="flex justify-between border-t border-theme-divider pt-2 mt-2">
                <span className="text-theme-body font-semibold">Expected Closing Drawer Value:</span>
                <span className="font-bold text-theme-body">₹{activeShift.openingBalance + activeShift.salesValue}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-muted uppercase font-display mb-2">Declared Physical Cash:</label>
              <input
                type="number"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                className="bg-theme-surface-3 border border-theme-divider text-theme-body text-sm rounded px-3 py-2 w-full focus:outline-none"
                placeholder="₹ Amount in drawer"
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
