/**
 * Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
 * Module       : POS Billing Cockpit Studio (Flagship POS Workspace & Hotkey Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.5.0
 * Classification: Flagship High-Speed Retail POS Workspace
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
import { Search, ShoppingBag, CreditCard, User, PauseCircle, PlayCircle, Trash2, Printer, Zap, CheckCircle2 } from "lucide-react";
import { SEDSStatusBadge } from "../design-system/components/SEDSStatusBadge";
import { VariantPivotMatrix } from "./common/VariantPivotMatrix";
import { TransactionEngine, TransactionStepProgress, TransactionResult } from "../kernel/transaction/TransactionEngine";
import { TransactionSuccessModal } from "./pos/TransactionSuccessModal";

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

  // Salesperson & Commission Engine State
  const [salespersons, setSalespersons] = useState<Array<{ id: string; name: string; code: string }>>([
    { id: "usr-default", name: "Counter Staff", code: "EMP001" }
  ]);
  const [salespersonMode, setSalespersonMode] = useState<"single" | "line">("single");
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>("usr-default");

  useEffect(() => {
    async function loadSalespersons() {
      try {
        const data = await apiFetchV1("/users/");
        const usersList = Array.isArray(data) ? data : data?.users || data?.items || [];
        if (usersList.length > 0) {
          const mapped = usersList.map((u: any, idx: number) => ({
            id: u.id || `usr-${idx}`,
            name: u.name || u.full_name || u.username || "Staff",
            code: u.employee_code || u.code || `EMP${100 + idx}`
          }));
          setSalespersons(mapped);
          setSelectedSalespersonId(mapped[0].id);
        }
      } catch (err) {
        // Fallback staff default
      }
    }
    loadSalespersons();
  }, []);

  // POS Cart State
  const [cart, setCart] = useState<{ product: Product; quantity: number; salespersonId?: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [customerName, setCustomerName] = useState("Walk-In Customer (Cash)");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD" | "CREDIT">("CASH");
  const [cashTendered, setCashTendered] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [showVariantMatrix, setShowVariantMatrix] = useState(false);

  // Search input ref for instant F1 focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Restore held bills from sessionStorage
  const [heldBills, setHeldBills] = useState<Bill[]>(() => {
    try {
      const saved = sessionStorage.getItem("smriti_held_bills");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (profiles.length > 0 && !activeProfileId) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles, activeProfileId]);

  useEffect(() => {
    sessionStorage.setItem("smriti_held_bills", JSON.stringify(heldBills));
  }, [heldBills]);

  // Instant Add to Cart (Direct Barcode Match or Click)
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      onNotification("Out of Stock", `Zero inventory for SKU ${product.code}`, "error");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, salespersonId: selectedSalespersonId }];
    });
  };

  // Barcode Auto-Scan Execution (<100ms Target)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const matched = products.find(
      (p) =>
        p.barcode?.toLowerCase() === searchQuery.trim().toLowerCase() ||
        p.code?.toLowerCase() === searchQuery.trim().toLowerCase()
    );

    if (matched) {
      addToCart(matched);
      setSearchQuery("");
      onNotification("Item Added", `Scanned ${matched.name}`, "success");
    } else {
      onNotification("Scan Alert", `No item matching barcode '${searchQuery}'`, "error");
    }
  };

  // Filter products by category or search term
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory = selectedCategory === "All" || p.category === selectedCategory;
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxAmount = (subtotal - discountAmount) * 0.18; // Standard 18% GST estimate
  const grandTotal = subtotal - discountAmount + taxAmount;
  const changeDue = Math.max(0, (parseFloat(cashTendered) || 0) - grandTotal);

  const handleHoldBill = useCallback(() => {
    setCart((prev) => {
      if (prev.length === 0) return prev;
      const total = prev.reduce((s, i) => s + i.product.price * i.quantity, 0);
      const newHold: Bill = {
        id: `HOLD-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        items: [...prev],
        total,
        customerName
      };
      setHeldBills((h) => [...h, newHold]);
      onNotification("Bill Held", `Bill logged under temporary slot: ${newHold.id}`, "success");
      return [];
    });
  }, [customerName, onNotification]);

  const handleRecallBill = useCallback((held: Bill) => {
    setCart(held.items);
    setCustomerName(held.customerName || "Walk-In Customer (Cash)");
    setHeldBills((prev) => prev.filter((b) => b.id !== held.id));
    onNotification("Bill Recalled", `Slot ${held.id} loaded back to terminal`, "success");
  }, [onNotification]);

  // Terminal Hotkey Registration (SCS-UIX Lookup Rule-001 & Universal Keyboard Standard)
  useTerminalShortcuts({
    "F2": () => { searchInputRef.current?.focus(); },
    "F3": () => { setIsCheckoutModalOpen(false); },
    "F4": () => { setIsCheckoutModalOpen(true); },
    "F6": () => { handleHoldBill(); },
    "F12": () => {
      if (cart.length > 0) {
        setIsCheckoutModalOpen(true);
      }
    },
    "ESC": () => {
      setCart([]);
      setIsCheckoutModalOpen(false);
      onNotification("Cart Cleared", "Active checkout cart cleared", "success");
    }
  });

  // Transaction Reliability Engine State (IPS-002)
  const [isPosting, setIsPosting] = useState(false);
  const [postingProgress, setPostingProgress] = useState<TransactionStepProgress | null>(null);
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const handleCheckoutComplete = async () => {
    setIsCheckoutModalOpen(false);
    setIsPosting(true);
    setIsSuccessModalOpen(true);

    try {
      HardwareAdapterRegistry.openCashDrawer();

      const payload = {
        invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: customerName.split(" (")[0] || "Walk-In Customer",
        customerMobile: "9876543210",
        paymentMode: paymentMode,
        itemsTotal: subtotal,
        discountTotal: discountAmount,
        netPayable: grandTotal,
        lines: cart.map((item, idx) => ({
          id: `line_${idx + 1}`,
          itemId: item.product.id,
          itemCode: item.product.code,
          itemName: item.product.name,
          hsnCode: (item.product as any).hsn || (item.product as any).hsnCode || "9999",
          qty: item.quantity,
          uom: "NOS",
          rate: item.product.price,
          discountPct: 0,
          discountAmount: 0,
          taxableValue: (item.product.price * item.quantity) / 1.18,
          gstRate: 18,
          cgstAmount: (item.product.price * item.quantity * 0.09) / 1.18,
          sgstAmount: (item.product.price * item.quantity * 0.09) / 1.18,
          igstAmount: 0,
          totalTaxAmount: (item.product.price * item.quantity * 0.18) / 1.18,
          lineTotal: item.product.price * item.quantity
        }))
      };

      const result = await TransactionEngine.processCheckout(payload, (progress) => {
        setPostingProgress(progress);
      });

      setIsPosting(false);
      setTransactionResult(result);

      if (result.success) {
        setCart([]);
        setCashTendered("");
        onNotification("Invoice Posted Successfully", `Invoice ${result.invoiceNo} committed to stock and ledger ✓`, "success");
      } else {
        onNotification("Transaction Draft Saved", result.error || "Saved to local draft recovery", "error");
      }
    } catch (err: any) {
      setIsPosting(false);
      onNotification("Checkout Error", err?.message || "Failed to process payment", "error");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--sds-color-background)] text-[var(--sds-color-text-main)] font-[var(--sds-font-family)] overflow-hidden">
      {/* Top Cockpit Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-3 bg-[var(--sds-color-surface)] border-b border-[var(--sds-color-border)] gap-2 shadow-xs">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-[var(--sds-color-primary)]" />
          <h1 className="text-lg font-bold tracking-tight">POS Billing Cockpit Studio</h1>
          <SEDSStatusBadge status="Active">Terminal #01 (ONLINE)</SEDSStatusBadge>
        </div>

        {/* Customer & Sales Executive Selectors (IPS-001 Universal Person Master Integration) */}
        <div className="flex items-center gap-3 text-xs font-sans">
          <div className="flex items-center gap-1.5 bg-[var(--sds-color-background)] px-2.5 py-1.5 rounded-lg border border-[var(--sds-color-border)]">
            <User className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] uppercase font-bold text-[var(--sds-color-text-muted)]">Customer:</span>
            <select
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="bg-transparent font-semibold text-xs text-[var(--sds-color-text-main)] focus:outline-none cursor-pointer"
            >
              <option value="Walk-In Customer (Cash)">Walk-In Customer (Cash)</option>
              <option value="Jawahar Mallah (VIP)">Jawahar Mallah (VIP)</option>
              <option value="Anand Patel (Retail)">Anand Patel (Retail)</option>
              <option value="Sneha Rao (Corporate)">Sneha Rao (Corporate)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--sds-color-background)] px-2.5 py-1.5 rounded-lg border border-[var(--sds-color-border)]">
            <User className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] uppercase font-bold text-[var(--sds-color-text-muted)]">Salesperson:</span>
            <select
              value={selectedSalespersonId}
              onChange={(e) => setSelectedSalespersonId(e.target.value)}
              className="bg-transparent font-semibold text-xs text-[var(--sds-color-text-main)] focus:outline-none cursor-pointer"
            >
              {salespersons.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} ({sp.code})
                </option>
              ))}
            </select>
          </div>

          {/* Speed Budget KPI Badges */}
          <div className="hidden lg:flex items-center gap-2 font-mono">
            <div className="px-2.5 py-1 rounded bg-[var(--sds-color-background)] border border-[var(--sds-color-border-subtle)] text-[var(--sds-color-text-secondary)]">
              Scan Speed: <span className="font-bold text-green-600">&lt;100ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Body: Cart Grid & Item Search */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left 7 Columns: Search Bar & Catalog Picklist */}
        <div className="md:col-span-7 flex flex-col gap-4 overflow-hidden">
          {/* Barcode Search Form */}
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--sds-color-text-muted)]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode or press [F1] to search items..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-[var(--sds-color-surface)] border border-[var(--sds-color-border)] rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-[var(--sds-color-primary)]"
              />
            </div>
            <button type="submit" aria-label="Scan barcode or search item" className="px-4 py-2.5 bg-[var(--sds-color-primary)] text-white text-xs font-bold rounded-lg hover:bg-[var(--sds-color-primary-hover)]">
              Scan
            </button>
          </form>

          {/* Catalog Grid */}
          <div className="flex-1 bg-[var(--sds-color-surface)] border border-[var(--sds-color-border)] rounded-xl p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className="p-3 bg-[var(--sds-color-background)] border border-[var(--sds-color-border-subtle)] rounded-lg hover:border-[var(--sds-color-primary)] cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-bold line-clamp-1">{p.name}</div>
                  <div className="text-[11px] font-mono text-[var(--sds-color-text-secondary)] mt-0.5">{p.code}</div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--sds-color-border-subtle)]">
                  <span className="text-xs font-mono font-bold text-emerald-600">₹{p.price.toFixed(2)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">Stock: {p.stock}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Columns: Billing Cart & Multi-Tender Totals */}
        <div className="md:col-span-5 flex flex-col bg-[var(--sds-color-surface)] border border-[var(--sds-color-border)] rounded-xl p-4 overflow-hidden">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--sds-color-border)]">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[var(--sds-color-primary)]" />
              <h2 className="text-sm font-bold">Active Cart ({cart.length} Items)</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowVariantMatrix((visible) => !visible)} aria-label={showVariantMatrix ? "Switch to cart grid view" : "Switch to color and size pivot view"} className="rounded border border-[var(--sds-color-border)] px-2 py-1 text-[10px] font-bold text-[var(--sds-color-primary)]">
                {showVariantMatrix ? "Cart Grid" : "Color x Size"}
              </button>
              <button onClick={() => setCart([])} aria-label="Clear all items from active cart" className="text-xs text-red-600 hover:underline flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Clear [ESC]
              </button>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {showVariantMatrix ? (
              <VariantPivotMatrix
                compact
                items={cart.map((item) => ({
                  id: item.product.id,
                  label: item.product.name,
                  color: item.product.color,
                  size: item.product.size,
                  quantity: item.quantity,
                  unitValue: item.product.price,
                }))}
              />
            ) : cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--sds-color-text-muted)] font-mono">
                Cart is empty. Scan barcode or click items on the left to add.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="p-2.5 bg-[var(--sds-color-background)] rounded-lg border border-[var(--sds-color-border-subtle)] flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold">{item.product.name}</div>
                    <div className="font-mono text-[10px] text-[var(--sds-color-text-secondary)]">₹{item.product.price.toFixed(2)} x {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-3 font-mono font-bold">
                    <span>₹{(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Checkout Bar */}
          <div className="pt-3 border-t border-[var(--sds-color-border)] space-y-2 text-xs">
            <div className="flex justify-between font-mono">
              <span className="text-[var(--sds-color-text-secondary)]">Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-mono text-emerald-600">
              <span>Discount ({discountPercent}%) [F6]</span>
              <span>-₹{discountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-mono font-bold text-base pt-1 border-t border-[var(--sds-color-border-subtle)] text-[var(--sds-color-primary)]">
              <span>Grand Total</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={() => setIsCheckoutModalOpen(true)}
              disabled={cart.length === 0}
              className="w-full py-3 bg-[var(--sds-color-primary)] text-white text-sm font-bold rounded-lg hover:bg-[var(--sds-color-primary-hover)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <CreditCard className="w-4 h-4" /> Pay & Print Receipt [F12]
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Keyboard Hotkey Toolbar */}
      <div className="px-6 py-2 bg-[var(--sds-color-surface)] border-t border-[var(--sds-color-border)] flex items-center justify-between text-[11px] font-mono text-[var(--sds-color-text-secondary)]">
        <div className="flex items-center gap-4">
          <span><kbd className="px-1.5 py-0.5 bg-[var(--sds-color-background)] border rounded text-black font-bold">F1</kbd> Search</span>
          <span><kbd className="px-1.5 py-0.5 bg-[var(--sds-color-background)] border rounded text-black font-bold">F2</kbd> Hold Bill</span>
          <span><kbd className="px-1.5 py-0.5 bg-[var(--sds-color-background)] border rounded text-black font-bold">F4</kbd> Pay</span>
          <span><kbd className="px-1.5 py-0.5 bg-[var(--sds-color-background)] border rounded text-black font-bold">F6</kbd> Discount</span>
          <span><kbd className="px-1.5 py-0.5 bg-[var(--sds-color-background)] border rounded text-black font-bold">F12</kbd> Complete</span>
          <span><kbd className="px-1.5 py-0.5 bg-[var(--sds-color-background)] border rounded text-black font-bold">ESC</kbd> Clear</span>
        </div>
        <div>SMRITI POS Cockpit Engine v5.5</div>
      </div>

      {/* Checkout Modal Dialog */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--sds-color-surface)] border border-[var(--sds-color-border)] rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Complete Payment & Checkout
            </h3>

            <div className="p-3 bg-[var(--sds-color-background)] rounded-lg space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span>Total Amount Payable:</span>
                <span className="font-bold text-sm text-[var(--sds-color-primary)]">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Tender Payment Mode</label>
              <div className="grid grid-cols-4 gap-2">
                {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMode(m)}
                    className={`py-2 rounded text-xs font-bold border ${
                      paymentMode === m
                        ? 'bg-[var(--sds-color-primary)] text-white border-[var(--sds-color-primary)]'
                        : 'bg-[var(--sds-color-background)] border-[var(--sds-color-border)]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {paymentMode === 'CASH' && (
              <div>
                <label className="block text-xs font-bold mb-1">Cash Tendered ₹</label>
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full p-2.5 text-sm font-mono bg-[var(--sds-color-background)] border border-[var(--sds-color-border)] rounded-lg font-bold"
                />
                {parseFloat(cashTendered) >= grandTotal && (
                  <div className="mt-2 text-xs font-mono font-bold text-emerald-600">
                    Change Due: ₹{changeDue.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="flex-1 py-2.5 border border-[var(--sds-color-border)] rounded-lg text-xs font-bold hover:bg-[var(--sds-color-background)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckoutComplete}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
              >
                Confirm & Print Thermal Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Success & Stepped Posting Modal (IPS-002) */}
      <TransactionSuccessModal
        isOpen={isSuccessModalOpen}
        isPosting={isPosting}
        progress={postingProgress}
        result={transactionResult}
        onClose={() => setIsSuccessModalOpen(false)}
        onNewBill={() => {
          setIsSuccessModalOpen(false);
          setCart([]);
          searchInputRef.current?.focus();
        }}
        onPrint={() => {
          window.print();
        }}
        onViewInvoiceList={(invNo) => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("smriti_navigate_sales_invoice", { detail: { invoiceNo: invNo } }));
          }
        }}
      />
    </div>
  );
};
