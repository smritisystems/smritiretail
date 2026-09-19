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
 * * Version    : 6.17.0
 * * Created    : 2026-09-14
 * * Modified   : 2026-09-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 *
 * SMRITI "Define Sales Promotions" Catalogue Modal
 * Matches Shoper 9 Enterprise Specification:
 *   Catalogue > Define Sales Promotions (SP_Defining_Sales_Promotions.htm & SP_View_Manage_Sales_Promotions.htm)
 *
 * Capabilities:
 *   - Add, Edit, Delete, and Priority-order Sales Promotion Schemes
 *   - Configure Item Level Discounts & Offers (Fixed %, Flat ₹, B2G1, Last Piece)
 *   - Configure Bill Level Discounts & Offers (Fixed %, Flat ₹, Value Range Slabs)
 *   - Direct real-time synchronization with F6 Billing Scheme selection
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Tag,
  Percent,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Check,
  X,
  Calendar,
  AlertCircle,
  Sparkles,
  Search,
  Layers,
  ArrowUpDown,
  Database,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import {
  SmritiSalesPromotionService,
  SmritiDefinedSalesPromotion,
  SmritiPromoLevel,
  SmritiPromoCategory
} from "../../services/smritiSalesPromotionService";

interface SmritiDefineSalesPromotionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCatalogUpdated?: () => void;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info") => void;
}

export const SmritiDefineSalesPromotionsModal: React.FC<SmritiDefineSalesPromotionsModalProps> = ({
  isOpen,
  onClose,
  onCatalogUpdated,
  onNotification
}) => {
  const [promotions, setPromotions] = useState<SmritiDefinedSalesPromotion[]>([]);
  const [filterLevel, setFilterLevel] = useState<"ALL" | SmritiPromoLevel>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingPromo, setEditingPromo] = useState<SmritiDefinedSalesPromotion | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"IDLE" | "SYNCING" | "SYNCHRONIZED" | "OFFLINE_CACHE">("IDLE");

  // Load promotions on open and sync from backend
  useEffect(() => {
    if (isOpen) {
      loadPromotions();
      void syncWithBackend();
    }
  }, [isOpen]);

  // Reactive listener for updates
  useEffect(() => {
    const handleUpdate = () => {
      setPromotions(SmritiSalesPromotionService.getAllDefinedPromotions());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("smriti_promotions_updated", handleUpdate);
      return () => window.removeEventListener("smriti_promotions_updated", handleUpdate);
    }
  }, []);

  const loadPromotions = () => {
    const list = SmritiSalesPromotionService.getAllDefinedPromotions();
    setPromotions(list);
    setIsCreatingNew(false);
    setEditingPromo(null);
  };

  const syncWithBackend = async () => {
    setSyncStatus("SYNCING");
    try {
      const res = await SmritiSalesPromotionService.syncFromBackend();
      setPromotions(res.schemes);
      if (res.source === "DATABASE") {
        setSyncStatus("SYNCHRONIZED");
      } else {
        setSyncStatus("OFFLINE_CACHE");
      }
    } catch {
      setSyncStatus("OFFLINE_CACHE");
    }
  };

  // Filtered promotions
  const filteredPromos = useMemo(() => {
    return promotions.filter(p => {
      if (filterLevel !== "ALL" && p.level !== filterLevel) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => a.priority - b.priority);
  }, [promotions, filterLevel, searchQuery]);

  const handleStartCreateNew = () => {
    const newScheme: SmritiDefinedSalesPromotion = {
      id: `sp-${Date.now()}`,
      code: "",
      name: "",
      description: "",
      level: filterLevel === "BILL_LEVEL" ? "BILL_LEVEL" : "ITEM_LEVEL",
      category: filterLevel === "BILL_LEVEL" ? "BILL_DISCOUNT_PERCENT" : "ITEM_DISCOUNT_PERCENT",
      priority: promotions.length + 1,
      discountValue: 10,
      minBillValue: 0,
      maxDiscount: undefined,
      applicableCustomerGroups: ["ALL"],
      validFrom: new Date().toISOString().split("T")[0],
      validTo: "2026-12-31",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingPromo(newScheme);
    setIsCreatingNew(true);
  };

  const handleStartEdit = (p: SmritiDefinedSalesPromotion) => {
    setEditingPromo({ ...p });
    setIsCreatingNew(false);
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromo) return;

    if (!editingPromo.code.trim()) {
      onNotification?.("Validation Error", "Promotion Code is mandatory.", "error");
      return;
    }
    if (!editingPromo.name.trim()) {
      onNotification?.("Validation Error", "Promotion Name is mandatory.", "error");
      return;
    }

    const payload: SmritiDefinedSalesPromotion = {
      ...editingPromo,
      code: editingPromo.code.toUpperCase().trim()
    };

    const res = await SmritiSalesPromotionService.saveScheme(payload);

    onNotification?.(
      "Promotion Saved",
      res.syncedToBackend
        ? `Scheme ${payload.code} successfully saved to local store & synchronized with PostgreSQL database.`
        : `Scheme ${payload.code} saved to local store catalogue (offline cache).`,
      "success"
    );
    loadPromotions();
    onCatalogUpdated?.();
  };

  const handleDeletePromo = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete promotion scheme [${code}]?`)) return;
    const res = await SmritiSalesPromotionService.deleteScheme(id);
    onNotification?.(
      "Promotion Deleted",
      res.syncedToBackend
        ? `Scheme ${code} removed from catalogue and PostgreSQL database.`
        : `Scheme ${code} removed from local catalogue.`,
      "info"
    );
    loadPromotions();
    onCatalogUpdated?.();
  };

  const handleResetDefaults = () => {
    if (!window.confirm("Reset all sales promotions to factory standard schemes?")) return;
    SmritiSalesPromotionService.resetToDefaults();
    onNotification?.("Catalogue Reset", "Sales promotions reverted to factory defaults.", "info");
    loadPromotions();
    onCatalogUpdated?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-surface text-on-surface w-full max-w-5xl max-h-[90vh] rounded-xl border border-outline-variant shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header Strip */}
        <div className="bg-surface-container-low px-5 py-3 border-b border-outline-variant flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded text-primary">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">Define Sales Promotions</h2>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-variant font-bold text-on-surface-variant">
                  Catalogue Master
                </span>
                {syncStatus === "SYNCHRONIZED" && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 border border-emerald-500/20">
                    <Database size={10} /> PostgreSQL Synced
                  </span>
                )}
                {syncStatus === "SYNCING" && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 border border-blue-500/20 animate-pulse">
                    <RefreshCw size={10} className="animate-spin" /> Syncing...
                  </span>
                )}
                {syncStatus === "OFFLINE_CACHE" && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 border border-amber-500/20">
                    <Database size={10} /> Offline Local Cache
                  </span>
                )}
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Configure promotional discount schemes and rules called by <strong className="text-primary font-mono">F6</strong> in POS Billing.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void syncWithBackend()}
              className="p-1 px-2 text-xs rounded border border-outline-variant hover:bg-surface-container flex items-center gap-1 font-medium text-on-surface-variant cursor-pointer transition-colors"
              title="Sync with PostgreSQL Backend"
            >
              <RefreshCw size={12} className={syncStatus === "SYNCING" ? "animate-spin" : ""} />
              <span>Sync DB</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent("smriti_navigate_module", { detail: { moduleId: "sales-promotions" } }));
              }}
              className="p-1 px-2.5 text-xs rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 flex items-center gap-1.5 font-bold text-primary cursor-pointer transition-colors shadow-xs"
              title="Open full Sales Promotions Studio workspace"
            >
              <ExternalLink size={12} />
              <span>Full Studio Workspace</span>
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

        {/* Content Body: Split Layout (Left: Table/Filters, Right: Editor) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Side: Listing & Filters */}
          <div className={`flex flex-col border-r border-outline-variant transition-all overflow-hidden ${
            editingPromo ? "w-1/2" : "w-full"
          }`}>
            
            {/* Filter Bar */}
            <div className="p-3 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterLevel("ALL")}
                  className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition ${
                    filterLevel === "ALL" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  All ({promotions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterLevel("ITEM_LEVEL")}
                  className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition flex items-center gap-1 ${
                    filterLevel === "ITEM_LEVEL" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <Tag size={12} />
                  <span>Item Level</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterLevel("BILL_LEVEL")}
                  className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition flex items-center gap-1 ${
                    filterLevel === "BILL_LEVEL" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <Percent size={12} />
                  <span>Bill Level</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2 text-on-surface-variant" />
                  <input
                    type="text"
                    placeholder="Search schemes..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-7 pl-7 pr-2 w-36 text-xs bg-surface border border-outline-variant rounded font-sans outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleStartCreateNew}
                  className="h-7 px-2.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus size={13} />
                  <span>New Scheme</span>
                </button>
              </div>
            </div>

            {/* Schemes List Table */}
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/40">
              {filteredPromos.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant">
                  No promotional schemes found. Click "New Scheme" to define one.
                </div>
              ) : (
                filteredPromos.map(p => {
                  const isSelected = editingPromo?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleStartEdit(p)}
                      className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected ? "bg-primary-container/30 border-l-4 border-primary" : "hover:bg-surface-container"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-xs font-bold text-center px-1.5 py-0.5 rounded bg-surface-variant text-primary min-w-8">
                          #{p.priority}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-primary">{p.code}</span>
                            <span className="text-xs font-bold text-on-surface">{p.name}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              p.level === "ITEM_LEVEL" ? "bg-secondary-fixed/50 text-secondary" : "bg-primary-fixed/50 text-primary"
                            }`}>
                              {p.level === "ITEM_LEVEL" ? "Item" : "Bill"}
                            </span>
                            {!p.isActive && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-error-container text-on-error-container font-bold">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
                            {p.description}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-secondary">
                            {p.category.includes("PERCENT") ? `${p.discountValue}%` : `₹${p.discountValue}`}
                          </span>
                          <span className="block text-[10px] text-on-surface-variant">
                            {p.validTo}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePromo(p.id, p.code);
                          }}
                          className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error-container/20 transition cursor-pointer"
                          title="Delete scheme"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Left Footer Action */}
            <div className="p-2.5 bg-surface-container-low border-t border-outline-variant flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-on-surface-variant hover:text-on-surface text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset to Factory Defaults</span>
              </button>
              <span className="text-[11px] text-on-surface-variant">
                {promotions.filter(p => p.isActive).length} Active Schemes Defined
              </span>
            </div>
          </div>

          {/* Right Side: Scheme Editor */}
          {editingPromo && (
            <form onSubmit={handleSavePromo} className="w-1/2 flex flex-col bg-surface-container-lowest overflow-hidden">
              <div className="px-4 py-3 bg-surface-container border-b border-outline-variant flex items-center justify-between text-xs font-bold">
                <span>{isCreatingNew ? "Define New Promotional Scheme" : `Edit Scheme: ${editingPromo.code}`}</span>
                <button
                  type="button"
                  onClick={() => setEditingPromo(null)}
                  className="p-1 text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
                {/* Code & Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Scheme Code <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      data-field-key="promo_code"
                      value={editingPromo.code}
                      onChange={e => setEditingPromo({ ...editingPromo, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. EOSS25"
                      className="w-full h-8 px-2 border border-outline-variant rounded font-mono text-xs font-bold outline-none focus:border-primary bg-surface"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Priority No. (1 = Highest) <span className="text-error">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      data-field-key="priority"
                      value={editingPromo.priority}
                      onChange={e => setEditingPromo({ ...editingPromo, priority: parseInt(e.target.value) || 1 })}
                      className="w-full h-8 px-2 border border-outline-variant rounded font-mono text-xs font-bold outline-none focus:border-primary bg-surface"
                    />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                    Scheme Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    data-field-key="promo_name"
                    value={editingPromo.name}
                    onChange={e => setEditingPromo({ ...editingPromo, name: e.target.value })}
                    placeholder="e.g. End of Season 25% Off"
                    className="w-full h-8 px-2 border border-outline-variant rounded text-xs font-medium outline-none focus:border-primary bg-surface"
                  />
                </div>

                {/* Level & Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Definition Level
                    </label>
                    <select
                      value={editingPromo.level}
                      onChange={e => {
                        const lvl = e.target.value as SmritiPromoLevel;
                        setEditingPromo({
                          ...editingPromo,
                          level: lvl,
                          category: lvl === "BILL_LEVEL" ? "BILL_DISCOUNT_PERCENT" : "ITEM_DISCOUNT_PERCENT"
                        });
                      }}
                      className="w-full h-8 px-2 border border-outline-variant rounded text-xs font-medium outline-none focus:border-primary bg-surface"
                    >
                      <option value="ITEM_LEVEL">Item Level</option>
                      <option value="BILL_LEVEL">Bill Level</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Category Type
                    </label>
                    <select
                      value={editingPromo.category}
                      onChange={e => setEditingPromo({ ...editingPromo, category: e.target.value as SmritiPromoCategory })}
                      className="w-full h-8 px-2 border border-outline-variant rounded text-xs font-medium outline-none focus:border-primary bg-surface"
                    >
                      {editingPromo.level === "ITEM_LEVEL" ? (
                        <>
                          <option value="ITEM_DISCOUNT_PERCENT">Fixed Percentage (%)</option>
                          <option value="ITEM_DISCOUNT_FLAT">Fixed Amount (₹)</option>
                          <option value="ITEM_OFFER_B2G1">Buy X Get Y Free (B2G1)</option>
                          <option value="ITEM_BUNDLE_COMBO">Bundle / Combo Offer</option>
                          <option value="ITEM_LAST_PIECE">Last Piece Clearance</option>
                        </>
                      ) : (
                        <>
                          <option value="BILL_DISCOUNT_PERCENT">Fixed Percentage on Bill (%)</option>
                          <option value="BILL_DISCOUNT_FLAT">Fixed Amount on Bill (₹)</option>
                          <option value="BILL_VALUE_SLAB">Bill Value Range Slab</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Discount Value & Max Allowed */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Discount Value {editingPromo.category.includes("PERCENT") ? "(%)" : "(₹)"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      data-field-key="discount_value"
                      value={editingPromo.discountValue}
                      onChange={e => setEditingPromo({ ...editingPromo, discountValue: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 px-2 border border-outline-variant rounded font-mono text-xs font-bold outline-none focus:border-primary bg-surface"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      data-field-key="max_discount"
                      placeholder="Optional ceiling cap"
                      value={editingPromo.maxDiscount || ""}
                      onChange={e => setEditingPromo({ ...editingPromo, maxDiscount: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-full h-8 px-2 border border-outline-variant rounded font-mono text-xs font-bold outline-none focus:border-primary bg-surface"
                    />
                  </div>
                </div>

                {/* Min Bill Value */}
                {editingPromo.level === "BILL_LEVEL" && (
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Min Bill Value Trigger (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      data-field-key="min_bill_value"
                      value={editingPromo.minBillValue || 0}
                      onChange={e => setEditingPromo({ ...editingPromo, minBillValue: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 px-2 border border-outline-variant rounded font-mono text-xs font-bold outline-none focus:border-primary bg-surface"
                    />
                  </div>
                )}

                {/* Validity Period */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Valid From
                    </label>
                    <input
                      type="date"
                      data-field-key="valid_from"
                      value={editingPromo.validFrom}
                      onChange={e => setEditingPromo({ ...editingPromo, validFrom: e.target.value })}
                      className="w-full h-8 px-2 border border-outline-variant rounded text-xs font-mono outline-none focus:border-primary bg-surface"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Valid To
                    </label>
                    <input
                      type="date"
                      data-field-key="valid_to"
                      value={editingPromo.validTo}
                      onChange={e => setEditingPromo({ ...editingPromo, validTo: e.target.value })}
                      className="w-full h-8 px-2 border border-outline-variant rounded text-xs font-mono outline-none focus:border-primary bg-surface"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                    Scheme Description / Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={editingPromo.description}
                    onChange={e => setEditingPromo({ ...editingPromo, description: e.target.value })}
                    placeholder="Enter promotion rationale or conditions..."
                    className="w-full p-2 border border-outline-variant rounded text-xs font-sans outline-none focus:border-primary bg-surface resize-none"
                  />
                </div>

                {/* Active Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="promo-active-toggle"
                    checked={editingPromo.isActive}
                    onChange={e => setEditingPromo({ ...editingPromo, isActive: e.target.checked })}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                  <label htmlFor="promo-active-toggle" className="font-bold text-xs cursor-pointer">
                    Scheme is Active and Available for Billing (F6)
                  </label>
                </div>
              </div>

              {/* Editor Footer */}
              <div className="p-3 bg-surface-container border-t border-outline-variant flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPromo(null)}
                  className="h-8 px-3 rounded border border-outline-variant hover:bg-surface-container-high text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 bg-primary hover:bg-primary-container text-on-primary rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check size={14} />
                  <span>Save Definition</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
