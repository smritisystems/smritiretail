/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.30.0
 * * Created    : 2026-09-14
 * * Modified   : 2026-09-14
 * * Copyright  : © SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Tag, Percent, Sparkles, X, Check, RotateCcw, AlertCircle, FileText, CheckCircle2, Layers } from "lucide-react";
import {
  SmritiSalesPromotionService,
  SmritiDefinedSalesPromotion
} from "../../services/smritiSalesPromotionService";
import { SmritiDefineSalesPromotionsModal } from "./SmritiDefineSalesPromotionsModal";

export interface SmritiActivePromoScheme {
  id: string;
  code: string;
  name: string;
  type: "PERCENT" | "FLAT" | "B2G1" | "TIERED";
  discountValue: number;
  minBillValue?: number;
  maxDiscount?: number;
  description: string;
  isItemLevel: boolean;
}

export interface SmritiBillLevelPromoState {
  code: string;
  description: string;
  discountPct: number;
  discountAmt: number;
  calculatedOn?: number;
  priceOffs?: number;
  maxAllowed?: number;
  applyBillLevelFirst?: boolean;
  reason: string;
  remarks: string;
}

export const SMRITI_DEFAULT_ITEM_PROMOS: SmritiActivePromoScheme[] = [
  {
    id: "promo-ild",
    code: "ILD",
    name: "Standard Item Discount",
    type: "PERCENT",
    discountValue: 10,
    description: "Standard item level line discount as configured in catalog",
    isItemLevel: true
  },
  {
    id: "promo-b2g1",
    code: "B2G1",
    name: "Buy 2 Get 1 Free",
    type: "B2G1",
    discountValue: 100,
    description: "Cheapest third item gets 100% discount across apparel categories",
    isItemLevel: true
  },
  {
    id: "promo-eoss",
    code: "EOSS20",
    name: "End of Season 20% Off",
    type: "PERCENT",
    discountValue: 20,
    description: "Flat 20% promotional discount on selected fresh arrivals",
    isItemLevel: true
  },
  {
    id: "promo-flat100",
    code: "FLAT100",
    name: "Flat ₹100 Off per piece",
    type: "FLAT",
    discountValue: 100,
    description: "Instant ₹100 markdown per eligible unit",
    isItemLevel: true
  }
];

export const SMRITI_DEFAULT_BILL_PROMOS: SmritiActivePromoScheme[] = [
  {
    id: "bill-none",
    code: "NONE",
    name: "No Bill Level Discount",
    type: "FLAT",
    discountValue: 0,
    description: "No bill-level promotional markdown applied",
    isItemLevel: false
  },
  {
    id: "bill-fest500",
    code: "FEST500",
    name: "Festival Privilege ₹500 Off",
    type: "FLAT",
    discountValue: 500,
    minBillValue: 3000,
    maxDiscount: 500,
    description: "Flat ₹500 discount on billing cart values exceeding ₹3,000",
    isItemLevel: false
  },
  {
    id: "bill-corp10",
    code: "CORP10",
    name: "Corporate Member 10% Off",
    type: "PERCENT",
    discountValue: 10,
    maxDiscount: 2000,
    description: "10% privilege discount for registered corporate customer accounts",
    isItemLevel: false
  },
  {
    id: "bill-clear15",
    code: "CLEAR15",
    name: "Stock Clearance 15% Off",
    type: "PERCENT",
    discountValue: 15,
    maxDiscount: 3000,
    description: "15% bill markdown for end-of-quarter stock clearance",
    isItemLevel: false
  }
];

export const SMRITI_DISCOUNT_REASONS = [
  "Festival Discount",
  "Stock Clearance Discount",
  "Generally Allowed Discount",
  "Management Discretion",
  "Loyalty Privilege Concession",
  "Damaged / Display Piece Concession"
];

interface SmritiF6PromotionalDiscountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: any[];
  subtotal: number;
  priceOffs?: number;
  activeMode?: "AUTO" | "MANUAL";
  billLevelPromo: SmritiBillLevelPromoState;
  onApplyPromos: (updatedItems: any[], billPromo: SmritiBillLevelPromoState) => void;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info") => void;
}

export const SmritiF6PromotionalDiscountsModal: React.FC<SmritiF6PromotionalDiscountsModalProps> = ({
  isOpen,
  onClose,
  items,
  subtotal,
  priceOffs = 0,
  activeMode = "MANUAL",
  billLevelPromo: initialBillPromo,
  onApplyPromos,
  onNotification
}) => {
  const [activeTab, setActiveTab] = useState<"ITEM_LEVEL" | "BILL_LEVEL">("ITEM_LEVEL");
  const [selectedItemPromoId, setSelectedItemPromoId] = useState<string>("promo-ild");
  const [showDefinePromosModal, setShowDefinePromosModal] = useState<boolean>(false);

  // Dynamic lists from Define Sales Promotions catalogue
  const [itemPromos, setItemPromos] = useState<SmritiActivePromoScheme[]>(SMRITI_DEFAULT_ITEM_PROMOS);
  const [billPromos, setBillPromos] = useState<SmritiActivePromoScheme[]>(SMRITI_DEFAULT_BILL_PROMOS);

  // Local state for modified item lines
  const [draftItems, setDraftItems] = useState<any[]>(items);

  // Local state for bill-level promo
  const [billPromo, setBillPromo] = useState<SmritiBillLevelPromoState>({
    ...initialBillPromo,
    calculatedOn: initialBillPromo.calculatedOn ?? subtotal,
    priceOffs: initialBillPromo.priceOffs ?? priceOffs
  });

  // Reload promotional schemes from "Define Sales Promotions" repository
  const reloadDefinedPromotions = () => {
    try {
      const rawItems = SmritiSalesPromotionService.getActivePromotionsByLevel("ITEM_LEVEL");
      const mappedItems: SmritiActivePromoScheme[] = rawItems.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        type: p.category === "ITEM_OFFER_B2G1" ? "B2G1" : p.category === "ITEM_DISCOUNT_FLAT" ? "FLAT" : "PERCENT",
        discountValue: p.discountValue,
        description: p.description,
        isItemLevel: true
      }));
      if (mappedItems.length > 0) {
        setItemPromos(mappedItems);
        if (!mappedItems.some(i => i.id === selectedItemPromoId)) {
          setSelectedItemPromoId(mappedItems[0].id);
        }
      }

      const rawBills = SmritiSalesPromotionService.getActivePromotionsByLevel("BILL_LEVEL");
      const mappedBills: SmritiActivePromoScheme[] = rawBills.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        type: p.category === "BILL_DISCOUNT_FLAT" ? "FLAT" : "PERCENT",
        discountValue: p.discountValue,
        minBillValue: p.minBillValue,
        maxDiscount: p.maxDiscount,
        description: p.description,
        isItemLevel: false
      }));
      if (mappedBills.length > 0) {
        setBillPromos(mappedBills);
      }
    } catch {
      setItemPromos(SMRITI_DEFAULT_ITEM_PROMOS);
      setBillPromos(SMRITI_DEFAULT_BILL_PROMOS);
    }
  };

  // Sync draft state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      reloadDefinedPromotions();
      setDraftItems(items);
      setBillPromo({
        ...initialBillPromo,
        calculatedOn: initialBillPromo.calculatedOn ?? subtotal,
        priceOffs: initialBillPromo.priceOffs ?? priceOffs
      });
      setActiveTab("ITEM_LEVEL");
    }
  }, [isOpen, items, initialBillPromo, subtotal, priceOffs]);

  // F6 toggle listener and Alt+P Define Promos trigger
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F6") {
        e.preventDefault();
        setActiveTab(prev => (prev === "ITEM_LEVEL" ? "BILL_LEVEL" : "ITEM_LEVEL"));
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.altKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setShowDefinePromosModal(true);
      } else if ((e.ctrlKey || e.altKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleCommit();
      } else if ((e.ctrlKey || e.altKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        handleResetToDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, draftItems, billPromo]);

  if (!isOpen) return null;

  // Selected promo scheme definition
  const currentItemPromo = itemPromos.find(p => p.id === selectedItemPromoId) || itemPromos[0] || SMRITI_DEFAULT_ITEM_PROMOS[0];
  const currentBillScheme = billPromos.find(p => p.code === billPromo.code) || billPromos[0] || SMRITI_DEFAULT_BILL_PROMOS[0];

  // Base for bill discount calculation
  const calcBase = typeof billPromo.calculatedOn === "number" && billPromo.calculatedOn >= 0
    ? billPromo.calculatedOn
    : subtotal;

  // Apply selected item promo across all items or selected items
  const handleApplyItemPromoToDraft = (promo: SmritiActivePromoScheme) => {
    setSelectedItemPromoId(promo.id);
    if (activeMode === "AUTO") return;

    setDraftItems(prev => prev.map(it => {
      const rate = Number(it.rate || it.unitPrice || 0);
      const qty = Number(it.qty || 1);
      const gross = rate * qty;
      let newDiscPct = 0;
      let newDiscAmt = 0;

      if (promo.type === "PERCENT") {
        newDiscPct = promo.discountValue;
        newDiscAmt = (gross * newDiscPct) / 100;
      } else if (promo.type === "FLAT") {
        newDiscAmt = Math.min(gross, promo.discountValue * qty);
        newDiscPct = gross > 0 ? (newDiscAmt / gross) * 100 : 0;
      } else if (promo.type === "B2G1") {
        newDiscPct = qty >= 3 ? 33.33 : 0;
        newDiscAmt = qty >= 3 ? rate : 0;
      }

      const total = Math.max(0, gross - newDiscAmt);
      return {
        ...it,
        discCode: promo.code,
        discPercent: Math.round(newDiscPct * 100) / 100,
        discAmt: Math.round(newDiscAmt * 100) / 100,
        total: Math.round(total * 100) / 100
      };
    }));
  };

  // Reset to default system suggestion
  const handleResetToDefault = () => {
    setDraftItems(items);
    setBillPromo({
      code: "NONE",
      description: "No bill discount applied",
      discountPct: 0,
      discountAmt: 0,
      calculatedOn: subtotal,
      priceOffs,
      maxAllowed: undefined,
      applyBillLevelFirst: false,
      reason: "Generally Allowed Discount",
      remarks: ""
    });
    onNotification?.("Promos Reset", "Reverted to default catalog discounts [Alt+D].", "info");
  };

  // Handle Bill Level Promo Code Selection
  const handleBillPromoSelect = (scheme: SmritiActivePromoScheme) => {
    let amt = 0;
    let pct = 0;
    if (scheme.type === "PERCENT") {
      pct = scheme.discountValue;
      amt = Math.min(scheme.maxDiscount || Infinity, (calcBase * pct) / 100);
    } else if (scheme.type === "FLAT") {
      amt = Math.min(scheme.maxDiscount || scheme.discountValue, scheme.discountValue);
      pct = calcBase > 0 ? (amt / calcBase) * 100 : 0;
    }

    setBillPromo(prev => ({
      ...prev,
      code: scheme.code,
      description: scheme.name,
      maxAllowed: scheme.maxDiscount,
      discountPct: Math.round(pct * 100) / 100,
      discountAmt: Math.round(amt * 100) / 100
    }));
  };

  // Handle Change to Calculated On base
  const handleCalculatedOnBaseChange = (newBase: number) => {
    const validBase = Math.max(0, newBase);
    const updatedAmt = Math.min(validBase, (validBase * billPromo.discountPct) / 100);
    setBillPromo(prev => ({
      ...prev,
      calculatedOn: validBase,
      discountAmt: Math.round(updatedAmt * 100) / 100
    }));
  };

  // Final Commit
  const handleCommit = () => {
    onApplyPromos(draftItems, billPromo);
    onNotification?.("Promotions Applied", "Updated promotional discounts committed to billing canvas.", "success");
    onClose();
  };

  const totalDraftItemDiscount = draftItems.reduce((acc, it) => acc + Number(it.discAmt || 0), 0);
  const netPayablePreview = Math.max(0, subtotal - billPromo.discountAmt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-surface text-on-surface w-full max-w-4xl max-h-[88vh] rounded-xl border border-outline-variant shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header Ribbon */}
        <div className="bg-surface-container-low px-5 py-3 border-b border-outline-variant flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded text-primary">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">Sales Promo &amp; Discount Schemes</h2>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-variant font-bold text-on-surface-variant">
                  F6
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  activeMode === "AUTO" ? "bg-secondary-fixed/50 text-secondary" : "bg-primary-fixed/50 text-primary"
                }`}>
                  {activeMode} Mode
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Press <kbd className="font-mono font-bold bg-surface-variant px-1 rounded">F6</kbd> to toggle between Item Level and Bill Level tabs.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDefinePromosModal(true)}
              className="h-7 px-2.5 bg-surface-variant hover:bg-surface-container-high text-primary border border-outline-variant text-[11px] font-bold rounded flex items-center gap-1.5 transition cursor-pointer"
              title="Define / Manage Sales Promotions [Alt+P]"
            >
              <Layers size={13} />
              <span>Define Sales Promotions</span>
              <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-primary/10 text-primary">Alt+P</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Selector Strip */}
        <div className="bg-surface-container-lowest border-b border-outline-variant px-5 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("ITEM_LEVEL")}
            className={`py-2.5 px-4 font-title-sm text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "ITEM_LEVEL"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Tag size={14} />
            <span>Item Level Promotional Details</span>
            <span className="font-mono text-[10px] text-on-surface-variant">({draftItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("BILL_LEVEL")}
            className={`py-2.5 px-4 font-title-sm text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "BILL_LEVEL"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Percent size={14} />
            <span>Bill Level Promotional Details</span>
            {billPromo.discountAmt > 0 && (
              <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.2 rounded font-bold">
                -₹{billPromo.discountAmt.toFixed(2)}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Item Level Promotional Details */}
        {activeTab === "ITEM_LEVEL" && (
          <div className="flex-1 flex overflow-hidden p-4 gap-4">
            {/* Left Pane: Active Promo Schemes */}
            <div className="w-1/3 bg-surface-container-low border border-outline-variant rounded-lg flex flex-col overflow-hidden">
              <div className="px-3 py-2 bg-surface-container border-b border-outline-variant font-bold text-xs text-on-surface-variant">
                Active Promotional Schemes
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-outline-variant/50">
                {itemPromos.map(promo => {
                  const isSelected = selectedItemPromoId === promo.id;
                  return (
                    <div
                      key={promo.id}
                      onClick={() => handleApplyItemPromoToDraft(promo)}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected ? "bg-primary-container/40 font-semibold" : "hover:bg-surface-container"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-primary">{promo.code}</span>
                        {isSelected && <CheckCircle2 size={14} className="text-primary" />}
                      </div>
                      <div className="text-xs font-medium text-on-surface mt-0.5">{promo.name}</div>
                      <div className="text-[10px] text-on-surface-variant line-clamp-2 mt-1">{promo.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Pane: Applied Items & Details */}
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col overflow-hidden">
              <div className="px-3 py-2 bg-surface-container border-b border-outline-variant flex items-center justify-between text-xs">
                <span className="font-bold text-on-surface">Items Eligible under {currentItemPromo.code}</span>
                <span className="text-[11px] text-on-surface-variant">
                  Total Item Discounts: <strong className="text-secondary font-mono">₹{totalDraftItemDiscount.toFixed(2)}</strong>
                </span>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-surface-container-low text-[10px] font-bold uppercase tracking-wider text-on-surface-variant sticky top-0 border-b border-outline-variant">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">S.No</th>
                      <th className="px-3 py-2 w-28">Stock No</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 w-14 text-right">Qty</th>
                      <th className="px-3 py-2 w-20 text-right">Rate</th>
                      <th className="px-3 py-2 w-20 text-center">Disc Code</th>
                      <th className="px-3 py-2 w-16 text-right">Disc %</th>
                      <th className="px-3 py-2 w-20 text-right">Disc ₹</th>
                      <th className="px-3 py-2 w-24 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40 font-code-md text-[11px]">
                    {draftItems.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-surface-container-low">
                        <td className="px-3 py-2 text-center text-on-surface-variant">{idx + 1}</td>
                        <td className="px-3 py-2 font-bold text-primary">{it.stockNo || it.sku}</td>
                        <td className="px-3 py-2 font-sans font-medium truncate max-w-xs">{it.itemDescription || it.name}</td>
                        <td className="px-3 py-2 text-right">{it.qty}</td>
                        <td className="px-3 py-2 text-right">{Number(it.rate || it.unitPrice || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-surface-variant text-[10px] font-bold">
                            {it.discCode || "ILD"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{it.discPercent || it.discountPct || 0}%</td>
                        <td className="px-3 py-2 text-right text-secondary font-semibold">
                          ₹{Number(it.discAmt || it.discountAmt || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-primary">
                          ₹{Number(it.total || it.lineTotal || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Bill Level Promotional Details */}
        {activeTab === "BILL_LEVEL" && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Left Column: Scheme Selection & Calculation Parameters */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Select Bill Level Promotional Scheme
                  </label>
                  <div className="space-y-2">
                    {billPromos.map(scheme => {
                      const isSelected = billPromo.code === scheme.code;
                      return (
                        <div
                          key={scheme.id}
                          onClick={() => handleBillPromoSelect(scheme)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? "bg-primary-container/40 border-primary font-bold"
                              : "border-outline-variant hover:bg-surface-container"
                          }`}
                        >
                          <div>
                            <div className="font-mono text-xs text-primary">{scheme.code} — {scheme.name}</div>
                            <div className="text-[10px] text-on-surface-variant">{scheme.description}</div>
                          </div>
                          {isSelected && <CheckCircle2 size={16} className="text-primary shrink-0 ml-2" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shoper 9 Stat Grid: Price-Offs, Bill Net Value & Calculated On */}
                <div className="bg-surface-container-low p-3.5 rounded-lg border border-outline-variant space-y-2 text-xs">
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>Price-Offs:</span>
                    <span className="font-mono font-bold text-on-surface">₹{(billPromo.priceOffs || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>Bill Net Value:</span>
                    <span className="font-mono font-bold text-on-surface">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-outline-variant/60">
                    <span className="font-medium text-on-surface">Calculated On:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-on-surface-variant">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={calcBase}
                        onChange={e => handleCalculatedOnBaseChange(parseFloat(e.target.value) || 0)}
                        className="w-24 h-7 px-2 border border-outline-variant rounded font-mono text-xs font-bold text-right bg-surface outline-none focus:border-primary"
                        title="Value on which discount is calculated (defaults to Bill Net Value)"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-on-surface-variant pt-1 text-[11px]">
                    <span>Max Allowed:</span>
                    <span className="font-mono font-bold text-primary">
                      {currentBillScheme.maxDiscount ? `₹${currentBillScheme.maxDiscount.toFixed(2)}` : "No Limit"}
                    </span>
                  </div>
                </div>

                {/* Priority Rule: Apply Bill Level Discount First */}
                <div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-on-surface block">Apply Bill Level Discount First</span>
                    <span className="text-[10px] text-on-surface-variant">Prioritise bill-level markdown before item-level distribution</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={billPromo.applyBillLevelFirst || false}
                    onChange={e => setBillPromo(prev => ({ ...prev, applyBillLevelFirst: e.target.checked }))}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </div>
              </div>

              {/* Right Column: Discount Inputs, Statutory Reason & Remarks */}
              <div className="space-y-4 bg-surface-container-lowest p-4 rounded-lg border border-outline-variant">
                
                {/* Discount Code Display */}
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                    Discount Code &amp; Scheme
                  </label>
                  <div className="p-2 rounded border border-outline-variant bg-surface-container-low font-mono text-xs font-bold text-primary flex items-center justify-between">
                    <span>{billPromo.code}</span>
                    <span className="font-sans text-[11px] text-on-surface-variant font-medium truncate max-w-[220px]">
                      {billPromo.description}
                    </span>
                  </div>
                </div>

                {/* Discount % and Discount Amount (Bidirectionally Linked) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Discount Percentage (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={billPromo.discountPct}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        const amt = Math.min(calcBase, (calcBase * val) / 100);
                        const cappedAmt = currentBillScheme.maxDiscount ? Math.min(currentBillScheme.maxDiscount, amt) : amt;
                        setBillPromo(prev => ({
                          ...prev,
                          discountPct: val,
                          discountAmt: Math.round(cappedAmt * 100) / 100
                        }));
                      }}
                      className="w-full h-8 px-2 border border-outline-variant rounded font-mono text-xs font-bold outline-none focus:border-primary bg-surface"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Discount Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={calcBase}
                      step="0.01"
                      value={billPromo.discountAmt}
                      onChange={e => {
                        const amt = parseFloat(e.target.value) || 0;
                        const cappedAmt = currentBillScheme.maxDiscount ? Math.min(currentBillScheme.maxDiscount, amt) : amt;
                        const pct = calcBase > 0 ? (cappedAmt / calcBase) * 100 : 0;
                        setBillPromo(prev => ({
                          ...prev,
                          discountAmt: cappedAmt,
                          discountPct: Math.round(pct * 100) / 100
                        }));
                      }}
                      className="w-full h-8 px-2 border border-outline-variant rounded font-mono text-xs font-bold outline-none focus:border-primary bg-surface"
                    />
                  </div>
                </div>

                {/* Mandatory Reason */}
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                    Statutory Reason Code <span className="text-error font-bold">*</span>
                  </label>
                  <select
                    value={billPromo.reason}
                    onChange={e => setBillPromo(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full h-8 px-2 border border-outline-variant rounded text-xs font-medium outline-none focus:border-primary bg-surface"
                  >
                    {SMRITI_DISCOUNT_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Document Remarks */}
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                    Document Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={billPromo.remarks}
                    onChange={e => setBillPromo(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Enter comments or authorization reference..."
                    className="w-full p-2 border border-outline-variant rounded text-xs font-sans outline-none focus:border-primary bg-surface resize-none"
                  />
                </div>

                {/* Payable Preview */}
                <div className="pt-2 border-t border-outline-variant flex justify-between items-center text-xs">
                  <span className="font-bold text-on-surface-variant">Net Payable after Bill Promo:</span>
                  <span className="font-mono font-bold text-lg text-primary">₹{netPayablePreview.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Action Strip */}
        <div className="bg-surface-container-low px-5 py-3 border-t border-outline-variant flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="h-8 px-3 rounded border border-outline-variant hover:bg-surface-container text-on-surface text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Reset to default promos (Alt+D)"
            >
              <RotateCcw size={13} />
              <span>Reset to Defaults (Alt+D)</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded border border-outline-variant hover:bg-surface-container text-on-surface-variant text-xs font-medium cursor-pointer"
            >
              Cancel (Esc)
            </button>
            <button
              type="button"
              onClick={handleCommit}
              className="h-8 px-4 bg-primary hover:bg-primary-container text-on-primary rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check size={14} />
              <span>Apply Sales Promo (Enter / Alt+A)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Nested Define Sales Promotions Master Modal */}
      <SmritiDefineSalesPromotionsModal
        isOpen={showDefinePromosModal}
        onClose={() => setShowDefinePromosModal(false)}
        onCatalogUpdated={() => {
          reloadDefinedPromotions();
        }}
        onNotification={onNotification}
      />
    </div>
  );
};


