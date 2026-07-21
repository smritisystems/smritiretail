/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { Product, POSProfile, Shift, Bill } from "../types";
import { useTerminalShortcuts } from "./terminal/KeyboardEngine";
import { SMRITIGrid } from "./terminal/SMRITIGrid";
import { StandardDocumentToolbar } from "./terminal/StandardDocumentToolbar";
import { RightDrawerHost } from "./terminal/RightDrawerHost";
import { UniversalSearchModal } from "./terminal/UniversalSearchModal";
import { HardwareAdapterRegistry } from "../hardware/HardwareAdapterRegistry";

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

  // POS Cart State
  const [cart, setCart] = useState<{ product: Product; quantity: number; salespersonId?: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [customerName, setCustomerName] = useState("Walk-In Customer");
  const [cashTendered, setCashTendered] = useState("");
  const [closingBalance, setClosingBalance] = useState("");

  // Drawer & Search Modal State
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Restore held bills from sessionStorage
  const [heldBills, setHeldBills] = useState<Bill[]>(() => {
    try {
      const saved = sessionStorage.getItem("smriti_held_bills");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    if (profiles.length > 0) {
      if (!activeProfileId) {
        setActiveProfileId(profiles[0].id);
      }
    } else if (!activeProfileId) {
      setActiveProfileId("pos-profile-1");
    }
  }, [profiles, activeProfileId]);

  useEffect(() => {
    sessionStorage.setItem("smriti_held_bills", JSON.stringify(heldBills));
  }, [heldBills]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (activeProfileId) {
      const openShift = shifts.find(s => s.profileId === activeProfileId && s.status === "Open");
      setActiveShift(openShift || null);
    } else {
      setActiveShift(null);
    }
  }, [activeProfileId, shifts]);

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

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const totalCartValue = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

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

  useTerminalShortcuts({
    "ESC": () => {
      setCart([]);
      setActiveDrawerId(null);
      onNotification("Cart Cleared", "Active shopping cart was cleared.", "success");
    },
    "F2": () => {
      handleHoldBill();
    },
    "F12": () => {
      if (cart.length > 0) {
        handleCheckout();
      }
    }
  });

  const handleOpenShift = async () => {
    if (!activeProfileId || !openingBalance) return;
    try {
      await apiFetchV1("/pos/shifts/open", {
        method: "POST",
        body: JSON.stringify({ profileId: activeProfileId, openingBalance })
      });
      HardwareAdapterRegistry.openCashDrawer();
      onNotification("Shift Opened", "Drawer register successfully opened and validated.", "success");
      onRefreshData();
    } catch (e: any) {
      console.error(e);
      onNotification("Error", e.message || "Failed to open shift.", "error");
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift || !closingBalance) return;
    try {
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

  const handleCheckout = async () => {
    if (cart.length === 0 || !activeShift) return;
    try {
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
      HardwareAdapterRegistry.openCashDrawer();
      HardwareAdapterRegistry.printReceipt(`POS BILL TOTAL: ₹${totalCartValue}`);
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

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 font-sans select-none overflow-hidden">
      {/* Standardized Terminal Toolbar */}
      <StandardDocumentToolbar
        onNew={() => setCart([])}
        onHold={handleHoldBill}
        onRecall={heldBills.length > 0 ? () => handleRecallBill(heldBills[heldBills.length - 1]) : undefined}
        onSearchClick={() => setIsSearchOpen(true)}
        onToggleDrawer={(id) => setActiveDrawerId(prev => prev === id ? null : id)}
        activeDrawerId={activeDrawerId}
        canCheckout={cart.length > 0 && !!activeShift}
        onCheckout={handleCheckout}
      />

      {/* Main Terminal Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left 70-80% Main Grid Viewport */}
        <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          {/* Header Control Row: Terminal Selector + Barcode Input */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1e293b] p-3 rounded-lg border border-slate-700">
            <div className="flex items-center space-x-3">
              <label className="text-xs font-semibold text-slate-400 uppercase font-display">Active Terminal:</label>
              <select
                value={activeProfileId}
                onChange={(e) => setActiveProfileId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none font-mono"
              >
                {profiles.length > 0 ? (
                  profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.cashier})</option>
                  ))
                ) : (
                  <option value="pos-profile-1">Lane 01 (POS-MAIN)</option>
                )}
              </select>
            </div>

            {/* Quick Barcode Scanner Input */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Scan Barcode or Type SKU... (Enter to Add)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim().length > 0) {
                      const exact = products.find(
                        p => p.barcode === searchQuery.trim() || p.code === searchQuery.trim()
                      );
                      if (exact) {
                        addToCart(exact);
                        setSearchQuery("");
                      } else {
                        onNotification("Item Not Found", `No product matches barcode '${searchQuery}'`, "error");
                      }
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white text-xs px-3 py-1.5 pl-8 rounded focus:outline-none focus:border-blue-500 font-mono"
                />
                <span className="material-symbols-outlined text-slate-500 text-sm absolute left-2.5 top-2">qr_code_scanner</span>
              </div>
            </div>

            {/* Shift Control */}
            {activeShift ? (
              <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1 rounded border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs text-emerald-400 font-mono font-bold">REGISTER OPEN</span>
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 bg-rose-950/40 border border-rose-900 px-3 py-1 rounded">
                <span className="text-xs text-rose-400 font-mono font-bold uppercase">REGISTER CLOSED</span>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white text-xs px-2 py-1 w-20 rounded font-mono"
                />
                <button
                  onClick={handleOpenShift}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase px-2 py-1 rounded transition-colors"
                >
                  Open Shift
                </button>
              </div>
            )}
          </div>

          {/* SMRITIGrid Main Viewport */}
          <div className="flex-1 overflow-hidden">
            <SMRITIGrid
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              onUpdateSalesperson={updateLineSalesperson}
              salespersons={SALESPERSONS}
              salespersonMode={salespersonMode}
            />
          </div>
        </div>

        {/* Right Billing Summary Sidebar (20-30% Viewport) */}
        <div className="w-80 bg-[#1e293b] border-l border-slate-700 p-5 flex flex-col justify-between shrink-0 font-sans">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display border-b border-slate-700 pb-2">
              Billing Summary & Payment
            </h3>

            <div className="space-y-2 font-mono text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Items Count:</span>
                <span className="font-bold text-white">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{totalCartValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>GST Tax (Included):</span>
                <span>₹{(totalCartValue * 0.18 / 1.18).toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <div className="text-slate-400 text-[10px] font-mono uppercase">Grand Total (Payable)</div>
              <div className="text-3xl font-extrabold text-emerald-400 font-display mt-1">
                ₹{totalCartValue.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-slate-700">
            <button
              disabled={cart.length === 0 || !activeShift}
              onClick={handleCheckout}
              className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center justify-center space-x-2 transition-all ${
                cart.length > 0 && activeShift
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 cursor-pointer"
                  : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
              }`}
            >
              <span className="material-symbols-outlined text-lg">payments</span>
              <span>Complete Payment (F12)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Universal Search Modal (Ctrl+K) */}
      <UniversalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={products}
        onSelectProduct={addToCart}
      />

      {/* Right Drawer Host */}
      <RightDrawerHost
        activeDrawerId={activeDrawerId}
        onSave={() => setActiveDrawerId(null)}
        onClose={() => setActiveDrawerId(null)}
      />
    </div>
  );
};
