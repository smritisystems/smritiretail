/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.17.1
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target Engine: Statutory GST Sales Factors, Customer Price Groups & Bill Add-ons/Deductions Studio
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Percent,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Check,
  X,
  Search,
  SlidersHorizontal,
  Database,
  RefreshCw,
  ShieldCheck,
  Receipt,
  Scale,
  Users,
  Info
} from "lucide-react";
import {
  SmritiSalesFactorService,
  SmritiSalesFactor,
  SalesFactorType,
  SalesFactorCategory,
  ComputationTiming,
  ComputedOn,
  RateOrAmount
} from "../../services/smritiSalesFactorService";

interface SmritiDefineSalesFactorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFactorsUpdated?: () => void;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info") => void;
}

export const SmritiDefineSalesFactorsModal: React.FC<SmritiDefineSalesFactorsModalProps> = ({
  isOpen,
  onClose,
  onFactorsUpdated,
  onNotification
}) => {
  const [factors, setFactors] = useState<SmritiSalesFactor[]>([]);
  const [filterType, setFilterType] = useState<"ALL" | SalesFactorType>("ALL");
  const [filterCategory, setFilterCategory] = useState<"ALL" | SalesFactorCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingFactor, setEditingFactor] = useState<SmritiSalesFactor | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"IDLE" | "SYNCING" | "SYNCHRONIZED" | "OFFLINE_CACHE">("IDLE");

  // Load factors on open and sync from backend
  useEffect(() => {
    if (isOpen) {
      loadFactors();
      void syncWithBackend();
    }
  }, [isOpen]);

  // Reactive listener for updates
  useEffect(() => {
    const handleUpdate = () => {
      setFactors(SmritiSalesFactorService.getAllSalesFactors());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("smriti_sales_factors_updated", handleUpdate);
      return () => window.removeEventListener("smriti_sales_factors_updated", handleUpdate);
    }
  }, []);

  const loadFactors = () => {
    const list = SmritiSalesFactorService.getAllSalesFactors();
    setFactors(list);
    setIsCreatingNew(false);
    setEditingFactor(null);
  };

  const syncWithBackend = async () => {
    setSyncStatus("SYNCING");
    try {
      const res = await SmritiSalesFactorService.syncFromBackend();
      setFactors(res.factors);
      if (res.source === "DATABASE") {
        setSyncStatus("SYNCHRONIZED");
      } else {
        setSyncStatus("OFFLINE_CACHE");
      }
    } catch {
      setSyncStatus("OFFLINE_CACHE");
    }
  };

  // Filtered factors
  const filteredFactors = useMemo(() => {
    return factors.filter(f => {
      if (filterType !== "ALL" && f.factorType !== filterType) return false;
      if (filterCategory !== "ALL" && f.factorCategory !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          f.code.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          (f.priceGroupCode && f.priceGroupCode.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [factors, filterType, filterCategory, searchQuery]);

  const handleStartCreateNew = () => {
    const newFactor: SmritiSalesFactor = {
      id: `sf-${Date.now()}`,
      code: "",
      description: "",
      factorType: "ADD_ON",
      factorCategory: "ALL_CUSTOMERS",
      priceGroupCode: "",
      applicableCategories: [],
      applicableBrands: [],
      computationTiming: "ABOVE_TAX",
      computedOn: "DISCOUNTED_VALUE",
      rateOrAmount: "RATE",
      value: 5.0,
      isVariable: true,
      minBillValue: 0,
      maxBillValue: undefined,
      applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingFactor(newFactor);
    setIsCreatingNew(true);
  };

  const handleStartEdit = (f: SmritiSalesFactor) => {
    setEditingFactor({ ...f });
    setIsCreatingNew(false);
  };

  const handleToggleActive = async (factor: SmritiSalesFactor) => {
    const updated = { ...factor, isActive: !factor.isActive };
    const res = await SmritiSalesFactorService.saveFactor(updated);
    loadFactors();
    onFactorsUpdated?.();
    onNotification?.(
      "Factor Updated",
      `Sales factor ${factor.code} is now ${updated.isActive ? "Active" : "Inactive"}.`,
      "info"
    );
  };

  const handleSaveFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFactor) return;

    if (!editingFactor.code.trim()) {
      onNotification?.("Validation Error", "Factor Code is mandatory.", "error");
      return;
    }
    if (!editingFactor.description.trim()) {
      onNotification?.("Validation Error", "Description is mandatory.", "error");
      return;
    }
    if (editingFactor.factorCategory === "PRICE_GROUP_SPECIFIC" && !editingFactor.priceGroupCode?.trim()) {
      onNotification?.("Validation Error", "Price Group Code is mandatory for Price Group Specific factors.", "error");
      return;
    }

    const payload: SmritiSalesFactor = {
      ...editingFactor,
      code: editingFactor.code.toUpperCase().trim(),
      priceGroupCode: editingFactor.priceGroupCode ? editingFactor.priceGroupCode.toUpperCase().trim() : undefined
    };

    const res = await SmritiSalesFactorService.saveFactor(payload);

    onNotification?.(
      "Factor Saved",
      res.syncedToBackend
        ? `Sales Factor ${payload.code} successfully saved to local store & synchronized with PostgreSQL database.`
        : `Sales Factor ${payload.code} saved to local store (offline cache).`,
      "success"
    );
    loadFactors();
    onFactorsUpdated?.();
  };

  const handleDeleteFactor = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete sales factor [${code}]?`)) return;
    const res = await SmritiSalesFactorService.deleteFactor(id);
    onNotification?.(
      "Factor Deleted",
      res.syncedToBackend
        ? `Sales Factor ${code} removed from catalogue and PostgreSQL database.`
        : `Sales Factor ${code} removed from local store.`,
      "info"
    );
    loadFactors();
    onFactorsUpdated?.();
  };

  const handleResetDefaults = () => {
    if (!window.confirm("Reset all sales factors to factory standard defaults?")) return;
    SmritiSalesFactorService.resetToDefaults();
    onNotification?.("Factors Reset", "Sales factors reverted to factory standards.", "info");
    loadFactors();
    onFactorsUpdated?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-surface text-on-surface w-full max-w-6xl max-h-[92vh] rounded-xl border border-outline-variant shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header Strip */}
        <div className="bg-surface-container-low px-5 py-3 border-b border-outline-variant flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded text-primary">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">Define Sales Factors & Customer Price Groups</h2>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-variant font-bold text-on-surface-variant">
                  Statutory GST Sec 15
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
                    ⚪ Offline Cache
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">
                Configure bill add-ons (freight, insurance, packing), deductions, price group concessions, and round-offs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              title="Reset to Factory Defaults"
              className="px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface bg-surface-variant hover:bg-surface-variant/80 rounded flex items-center gap-1 transition-colors border border-outline-variant"
            >
              <RotateCcw size={12} />
              Reset Defaults
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Content Area: Left Master List / Right Editor Drawer */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: Factor List & Filters */}
          <div className={`${editingFactor ? "w-7/12 border-r border-outline-variant" : "w-full"} flex flex-col overflow-hidden`}>
            
            {/* Toolbar */}
            <div className="p-3 bg-surface-container-lowest border-b border-outline-variant flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by code, description, price group..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none text-on-surface"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Filter Factor Type */}
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className="px-2 py-1.5 text-xs bg-surface border border-outline-variant rounded text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="ALL">All Factor Types</option>
                  <option value="ADD_ON">Add-ons (+)</option>
                  <option value="DEDUCTION">Deductions (-)</option>
                  <option value="BILL_ROUND_OFF">Bill Round-off</option>
                  <option value="RETAIL_PRICE_FACTOR">Retail Price Factor</option>
                </select>

                {/* Filter Category */}
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value as any)}
                  className="px-2 py-1.5 text-xs bg-surface border border-outline-variant rounded text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="ALL_CUSTOMERS">All Customers</option>
                  <option value="PRICE_GROUP_SPECIFIC">Price Group Specific</option>
                  <option value="CUSTOMER_SPECIFIC">Customer Specific</option>
                </select>
              </div>

              <button
                onClick={handleStartCreateNew}
                className="px-3 py-1.5 text-xs font-bold bg-primary text-on-primary rounded hover:bg-primary/90 flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus size={14} />
                New Factor
              </button>
            </div>

            {/* Statutory GST Sec 15 Notice Banner */}
            <div className="bg-primary/5 px-4 py-2 border-b border-primary/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Info size={14} className="shrink-0" />
                <span>
                  <strong>Statutory GST Compliance:</strong> Above Tax factors adjust transaction value before GST calculation. Below Tax factors adjust post-tax settlement.
                </span>
              </div>
              <span className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                {filteredFactors.length} configured
              </span>
            </div>

            {/* Factors Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-outline-variant">
                  <tr>
                    <th className="py-2.5 px-3">Factor Code / Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Timing (GST)</th>
                    <th className="py-2.5 px-3">Price Group</th>
                    <th className="py-2.5 px-3 text-right">Value</th>
                    <th className="py-2.5 px-3 text-center">Active</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {filteredFactors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                        No sales factors found matching current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFactors.map(f => {
                      const isSelected = editingFactor?.id === f.id;
                      return (
                        <tr
                          key={f.id}
                          onClick={() => handleStartEdit(f)}
                          className={`hover:bg-surface-container-high/40 transition-colors cursor-pointer ${
                            isSelected ? "bg-primary/10 border-l-2 border-primary" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-on-surface font-mono flex items-center gap-1.5">
                              {f.code}
                              {f.isVariable && (
                                <span className="font-sans text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-normal">
                                  Variable
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-on-surface-variant truncate max-w-[200px]">
                              {f.description}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {f.factorType === "ADD_ON" && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                ADD-ON (+)
                              </span>
                            )}
                            {f.factorType === "DEDUCTION" && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                DEDUCTION (-)
                              </span>
                            )}
                            {f.factorType === "BILL_ROUND_OFF" && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                ROUND-OFF
                              </span>
                            )}
                            {f.factorType === "RETAIL_PRICE_FACTOR" && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                RETAIL FACTOR
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                f.computationTiming === "ABOVE_TAX"
                                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                  : "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20"
                              }`}
                            >
                              {f.computationTiming === "ABOVE_TAX" ? "ABOVE TAX (GST Base)" : "BELOW TAX (Post-Tax)"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {f.factorCategory === "PRICE_GROUP_SPECIFIC" ? (
                              <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {f.priceGroupCode}
                              </span>
                            ) : f.factorCategory === "CUSTOMER_SPECIFIC" ? (
                              <span className="font-mono text-[10px] text-amber-600">
                                Cust: {f.customerId}
                              </span>
                            ) : (
                              <span className="text-[11px] text-on-surface-variant font-medium">
                                All Customers
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-on-surface">
                            {f.rateOrAmount === "RATE" ? `${f.value}%` : `₹${f.value.toFixed(2)}`}
                            <div className="text-[9px] text-on-surface-variant font-normal font-sans">
                              {f.computedOn === "SALE_VALUE_BEFORE_DISCOUNT"
                                ? "On Base Value"
                                : f.computedOn === "VALUE_INCLUSIVE_OF_TAX"
                                ? "On Tax Incl Value"
                                : "On Disc Value"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleToggleActive(f)}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                f.isActive
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                  : "bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80"
                              }`}
                            >
                              {f.isActive ? "YES" : "NO"}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleStartEdit(f)}
                                title="Edit Factor"
                                className="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-variant"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteFactor(f.id, f.code)}
                                title="Delete Factor"
                                className="p-1 text-on-surface-variant hover:text-red-500 rounded hover:bg-surface-variant"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Add/Edit Drawer Form */}
          {editingFactor && (
            <div className="w-5/12 bg-surface-container-lowest flex flex-col overflow-hidden animate-slide-in-right">
              <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-primary/10 rounded text-primary">
                    <Receipt size={14} />
                  </div>
                  <h3 className="text-xs font-bold text-on-surface">
                    {isCreatingNew ? "Define New Sales Factor" : `Edit Factor [${editingFactor.code}]`}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingFactor(null)}
                  className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-variant"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSaveFactor} className="flex-1 p-4 overflow-auto space-y-3.5 text-xs">
                
                {/* Code & Description */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Factor Code *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!isCreatingNew}
                      value={editingFactor.code}
                      onChange={e => setEditingFactor({ ...editingFactor, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. INS"
                      className="w-full px-2.5 py-1.5 font-mono font-bold text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none disabled:opacity-60"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Description / Label *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingFactor.description}
                      onChange={e => setEditingFactor({ ...editingFactor, description: e.target.value })}
                      placeholder="e.g. Transit Insurance"
                      className="w-full px-2.5 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Factor Type & Timing */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Factor Type
                    </label>
                    <select
                      value={editingFactor.factorType}
                      onChange={e => setEditingFactor({ ...editingFactor, factorType: e.target.value as SalesFactorType })}
                      className="w-full px-2 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none"
                    >
                      <option value="ADD_ON">Add-on (Surcharge/Fee +)</option>
                      <option value="DEDUCTION">Deduction (Concession/Rebate -)</option>
                      <option value="BILL_ROUND_OFF">Bill Round-Off</option>
                      <option value="RETAIL_PRICE_FACTOR">Retail Price Factor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Statutory GST Timing
                    </label>
                    <select
                      value={editingFactor.computationTiming}
                      onChange={e => setEditingFactor({ ...editingFactor, computationTiming: e.target.value as ComputationTiming })}
                      className="w-full px-2 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none"
                    >
                      <option value="ABOVE_TAX">ABOVE TAX (Adjusts GST Taxable Base)</option>
                      <option value="BELOW_TAX">BELOW TAX (Post-Tax Settlement)</option>
                    </select>
                  </div>
                </div>

                {/* Customer Category & Price Group */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Applicability Category
                    </label>
                    <select
                      value={editingFactor.factorCategory}
                      onChange={e => setEditingFactor({ ...editingFactor, factorCategory: e.target.value as SalesFactorCategory })}
                      className="w-full px-2 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none"
                    >
                      <option value="ALL_CUSTOMERS">All Customers</option>
                      <option value="PRICE_GROUP_SPECIFIC">Customer Price Group Specific</option>
                      <option value="CUSTOMER_SPECIFIC">Specific Customer ID</option>
                    </select>
                  </div>

                  {editingFactor.factorCategory === "PRICE_GROUP_SPECIFIC" ? (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-primary mb-1">
                        Price Group Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingFactor.priceGroupCode || ""}
                        onChange={e => setEditingFactor({ ...editingFactor, priceGroupCode: e.target.value.toUpperCase() })}
                        placeholder="e.g. CPP, EMP, WHOLESALE"
                        className="w-full px-2.5 py-1.5 font-mono font-bold text-xs bg-surface border border-primary rounded focus:outline-none"
                      />
                    </div>
                  ) : editingFactor.factorCategory === "CUSTOMER_SPECIFIC" ? (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-amber-600 mb-1">
                        Customer ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingFactor.customerId || ""}
                        onChange={e => setEditingFactor({ ...editingFactor, customerId: e.target.value })}
                        placeholder="e.g. CUST-001"
                        className="w-full px-2.5 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                        Scope
                      </label>
                      <div className="px-2 py-1.5 text-xs bg-surface-variant/40 rounded text-on-surface-variant">
                        Universal (All Retail Walk-in Customers)
                      </div>
                    </div>
                  )}
                </div>

                {/* Computation Basis, Rate/Amount & Value */}
                <div className="grid grid-cols-3 gap-2.5 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Computed On
                    </label>
                    <select
                      value={editingFactor.computedOn}
                      onChange={e => setEditingFactor({ ...editingFactor, computedOn: e.target.value as ComputedOn })}
                      className="w-full px-2 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none"
                    >
                      <option value="DISCOUNTED_VALUE">Discounted Value</option>
                      <option value="SALE_VALUE_BEFORE_DISCOUNT">Sale Value Before Disc</option>
                      <option value="VALUE_INCLUSIVE_OF_TAX">Value Incl Tax</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Rate or Amount
                    </label>
                    <select
                      value={editingFactor.rateOrAmount}
                      onChange={e => setEditingFactor({ ...editingFactor, rateOrAmount: e.target.value as RateOrAmount })}
                      className="w-full px-2 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none"
                    >
                      <option value="RATE">Percentage (%)</option>
                      <option value="AMOUNT">Fixed Amount (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Value {editingFactor.rateOrAmount === "RATE" ? "(%)" : "(₹)"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editingFactor.value}
                      onChange={e => setEditingFactor({ ...editingFactor, value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 font-mono font-bold text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Minimum / Maximum Bill Value Qualifiers */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Min Bill Value (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={editingFactor.minBillValue ?? ""}
                      onChange={e => setEditingFactor({ ...editingFactor, minBillValue: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="e.g. 500"
                      className="w-full px-2.5 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                      Max Bill Value (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={editingFactor.maxBillValue ?? ""}
                      onChange={e => setEditingFactor({ ...editingFactor, maxBillValue: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Optional upper limit"
                      className="w-full px-2.5 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:border-primary focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Flags: Is Variable & Is Active */}
                <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingFactor.isVariable}
                      onChange={e => setEditingFactor({ ...editingFactor, isVariable: e.target.checked })}
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-semibold text-on-surface">
                      Variable Value (Cashier can modify amount in POS billing)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingFactor.isActive}
                      onChange={e => setEditingFactor({ ...editingFactor, isActive: e.target.checked })}
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-semibold text-on-surface">
                      Active Factor (Evaluated in current POS billing operations)
                    </span>
                  </label>
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant">
                  <button
                    type="button"
                    onClick={() => setEditingFactor(null)}
                    className="px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface bg-surface-variant hover:bg-surface-variant/80 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold bg-primary text-on-primary rounded hover:bg-primary/90 flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Check size={14} />
                    {isCreatingNew ? "Create Factor" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer info strip */}
        <div className="bg-surface-container-low px-5 py-2 border-t border-outline-variant flex items-center justify-between text-[11px] text-on-surface-variant shrink-0">
          <div className="flex items-center gap-3">
            <span>SMRITI Factor Definition Engine v6.17.1</span>
            <span>•</span>
            <span className="font-mono">Press Esc to close</span>
            <span>•</span>
            <span className="font-mono">Alt+S from POS Billing to open</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-on-surface">
              Active Factors: {factors.filter(f => f.isActive).length} / {factors.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
