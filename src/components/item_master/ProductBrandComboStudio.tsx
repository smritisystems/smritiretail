/**
 * Project      : SMRITI Retail OS
 * Component    : ProductBrandComboStudio (Class12Combo Matrix Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: Product-Brand Category Matrix Studio
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Package, Tag, ShieldCheck, DollarSign, Layers, Clock, 
  MapPin, Truck, AlertTriangle, Save, RefreshCw, X, Plus, Trash2 
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

export interface ProductBrandComboStudioProps {
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
  onClose?: () => void;
}

export const ProductBrandComboStudio: React.FC<ProductBrandComboStudioProps> = ({
  onNotification,
  onClose,
}) => {
  // Master Dropdown Options from ULR
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [taxGroups, setTaxGroups] = useState<any[]>([]);
  const [sizeGroups, setSizeGroups] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);

  // Selection
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Form State
  const [isConsignment, setIsConsignment] = useState<boolean>(false);
  const [isBillable, setIsBillable] = useState<boolean>(true);
  const [isService, setIsService] = useState<boolean>(false);
  const [doorDelivery, setDoorDelivery] = useState<boolean>(false);

  const [selectedTaxGroup, setSelectedTaxGroup] = useState<string>("");
  const [selectedSizeGroup, setSelectedSizeGroup] = useState<string>("");
  const [sizeGroupDescription, setSizeGroupDescription] = useState<string>("");
  const [sizeGrid, setSizeGrid] = useState<string[]>(["S", "M", "L", "XL", "XXL"]);

  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedBuyer, setSelectedBuyer] = useState<string>("");

  const [preferredVendorPrimary, setPreferredVendorPrimary] = useState<string>("");
  const [preferredVendorSecondary, setPreferredVendorSecondary] = useState<string>("");

  const [mrpMarkupPercent, setMrpMarkupPercent] = useState<number>(0);
  const [dealerMarkupPercent, setDealerMarkupPercent] = useState<number>(0);

  // Grade & Location
  const [enableGrade, setEnableGrade] = useState<boolean>(false);
  const [gradePricingEnabled, setGradePricingEnabled] = useState<boolean>(false);
  const [enableLocation, setEnableLocation] = useState<boolean>(false);

  // Batch & Expiry Details
  const [batchApplicable, setBatchApplicable] = useState<boolean>(false);
  const [batchWisePricing, setBatchWisePricing] = useState<boolean>(false);
  const [mfgDateApplicable, setMfgDateApplicable] = useState<boolean>(false);
  const [mfgDateFormat, setMfgDateFormat] = useState<string>("DD/MM/YYYY");
  const [expDateApplicable, setExpDateApplicable] = useState<string>("false");
  const [expDateFormat, setExpDateFormat] = useState<string>("DD/MM/YYYY");
  const [shelfLifeDays, setShelfLifeDays] = useState<number>(0);
  const [allowExpiredSales, setAllowExpiredSales] = useState<boolean>(false);
  const [allowExpiredReturns, setAllowExpiredReturns] = useState<boolean>(false);
  const [stopSalesBeforeDays, setStopSalesBeforeDays] = useState<number>(0);

  const [markedForDeletion, setMarkedForDeletion] = useState<boolean>(false);

  // Fetch ULR Options
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [cats, brds, taxes, sizes, depts, buyrs] = await Promise.all([
          apiFetchV1("/masters/lookup/category/values").catch(() => []),
          apiFetchV1("/masters/lookup/brand/values").catch(() => []),
          apiFetchV1("/masters/lookup/tax_group/values").catch(() => []),
          apiFetchV1("/masters/lookup/size_group/values").catch(() => []),
          apiFetchV1("/masters/lookup/department/values").catch(() => []),
          apiFetchV1("/masters/lookup/buyer/values").catch(() => []),
        ]);
        setCategories(cats);
        setBrands(brds);
        setTaxGroups(taxes);
        setSizeGroups(sizes);
        setDepartments(depts);
        setBuyers(buyrs);
      } catch (e) {
        console.error("ULR Load error", e);
      }
    };
    loadLookups();
  }, []);

  // Keyboard shortcut for Ctrl+D (delete size row)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (sizeGrid.length > 0) {
          const next = [...sizeGrid];
          next.pop();
          setSizeGrid(next);
          onNotification("Size Grid Updated", "Removed last size row (Ctrl+D shortcut).", "success");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sizeGrid]);

  const handleSave = () => {
    if (!selectedCategory || !selectedBrand) {
      onNotification("Validation Error", "Please select both Product Category and Brand.", "error");
      return;
    }

    const payload = {
      product_category: selectedCategory,
      brand: selectedBrand,
      is_consignment: isConsignment,
      is_billable: isBillable,
      is_service: isService,
      door_delivery: doorDelivery,
      tax_group: selectedTaxGroup,
      size_group: selectedSizeGroup,
      size_grid: sizeGrid,
      department: selectedDepartment,
      buyer: selectedBuyer,
      preferred_vendors: [preferredVendorPrimary, preferredVendorSecondary].filter(Boolean),
      mrp_markup_percent: mrpMarkupPercent,
      dealer_markup_percent: dealerMarkupPercent,
      enable_grade: enableGrade,
      grade_pricing_enabled: gradePricingEnabled,
      enable_location: enableLocation,
      batch_applicable: batchApplicable,
      batch_wise_pricing: batchWisePricing,
      mfg_date_applicable: mfgDateApplicable,
      exp_date_applicable: expDateApplicable === "true",
      shelf_life_days: shelfLifeDays,
      allow_expired_sales: allowExpiredSales,
      allow_expired_returns: allowExpiredReturns,
      stop_sales_before_days: stopSalesBeforeDays,
      marked_for_deletion: markedForDeletion,
    };

    onNotification(
      "Combo Saved",
      `Product-Brand Combo '${selectedCategory} + ${selectedBrand}' catalogued successfully.`,
      "success"
    );
  };

  const handleClear = () => {
    setSelectedCategory("");
    setSelectedBrand("");
    setIsConsignment(false);
    setIsBillable(true);
    setIsService(false);
    setDoorDelivery(false);
    setSelectedTaxGroup("");
    setSelectedSizeGroup("");
    setSizeGrid(["S", "M", "L", "XL", "XXL"]);
    setSelectedDepartment("");
    setSelectedBuyer("");
    setPreferredVendorPrimary("");
    setPreferredVendorSecondary("");
    setMrpMarkupPercent(0);
    setDealerMarkupPercent(0);
    setEnableGrade(false);
    setGradePricingEnabled(false);
    setEnableLocation(false);
    setBatchApplicable(false);
    setBatchWisePricing(false);
    setMfgDateApplicable(false);
    setExpDateApplicable("false");
    setShelfLifeDays(0);
    setAllowExpiredSales(false);
    setAllowExpiredReturns(false);
    setStopSalesBeforeDays(0);
    setMarkedForDeletion(false);
    onNotification("Form Cleared", "Cleared all fields in Product-Brand Combo Matrix.", "success");
  };

  return (
    <div className="w-full bg-[var(--sds-color-surface)] border border-[var(--sds-color-border)] rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-200 text-[var(--sds-color-text-main)] font-sans flex flex-col">
      {/* Header Bar */}
      <div className="bg-[var(--sds-color-surface)] border-b border-[var(--sds-color-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-indigo-400">
            <Package size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-theme-heading">
              SMRITI Product-Brand (Class12Combo) Matrix Studio
            </h2>
            <p className="text-xs text-theme-muted">
              Configure Category Policy Matrix, Size Scales, Tax Groups & Batch Expiry Rules
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-surface-hover rounded-xl text-theme-muted hover:text-theme-heading transition cursor-pointer"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
        
        {/* Section 1: Combo Primary Keys */}
        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-3">
          <span className="text-xs font-bold font-display text-indigo-400 uppercase tracking-wide block">
            1. Product - Brand Primary Combination
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Product Category *</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body font-bold"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id || c.code} value={c.name || c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Brand *</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body font-bold"
              >
                <option value="">Select Brand...</option>
                {brands.map((b) => (
                  <option key={b.id || b.code} value={b.name || b.code}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Item Type Policies & Door Delivery */}
        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-3">
          <span className="text-xs font-bold font-display text-indigo-400 uppercase tracking-wide block">
            2. Item Type & Delivery Policies
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={isConsignment} onChange={(e) => setIsConsignment(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Consignment Item</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={isBillable} onChange={(e) => setIsBillable(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Billable Item</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={isService} onChange={(e) => setIsService(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Service Item</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={doorDelivery} onChange={(e) => setDoorDelivery(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Door Delivery</span>
            </label>
          </div>
        </div>

        {/* Section 3: Size & Tax Grouping */}
        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-4">
          <span className="text-xs font-bold font-display text-indigo-400 uppercase tracking-wide block">
            3. Size Grouping & Product Tax Classification
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Product Tax Group</label>
              <select value={selectedTaxGroup} onChange={(e) => setSelectedTaxGroup(e.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body">
                <option value="">Select Product Tax Group...</option>
                {taxGroups.map((t) => (
                  <option key={t.id || t.code} value={t.code}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Size Group ID</label>
              <select value={selectedSizeGroup} onChange={(e) => setSelectedSizeGroup(e.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body">
                <option value="">Select Size Group...</option>
                {sizeGroups.map((s) => (
                  <option key={s.id || s.code} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Size Scale Grid */}
          <div className="p-3 bg-theme-surface-2 rounded-xl border border-theme-divider space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-theme-muted uppercase font-bold">Applicable Size Scale Matrix (Ctrl+D to delete)</span>
              <button
                type="button"
                onClick={() => setSizeGrid([...sizeGrid, `SZ-${sizeGrid.length + 1}`])}
                className="px-2 py-1 bg-indigo-950 text-indigo-300 border border-indigo-500/40 rounded-lg text-[10px] font-mono flex items-center gap-1"
              >
                <Plus size={10} /> Add Size
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sizeGrid.map((sz, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-theme-surface-1 border border-theme-divider rounded-lg font-mono text-xs text-indigo-400 font-bold">
                  <span>{sz}</span>
                  <button type="button" onClick={() => setSizeGrid(sizeGrid.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300"><X size={12}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 4: Super Classification & Preferred Vendors */}
        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-4">
          <span className="text-xs font-bold font-display text-indigo-400 uppercase tracking-wide block">
            4. Super Classification & Preferred Vendors
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Department (Super Class-1)</label>
              <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body">
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d.id || d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Buyer (Super Class-2)</label>
              <select value={selectedBuyer} onChange={(e) => setSelectedBuyer(e.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body">
                <option value="">Select Buyer...</option>
                {buyers.map((b) => (
                  <option key={b.id || b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Primary Vendor (Mandatory)</label>
              <input type="text" value={preferredVendorPrimary} onChange={(e) => setPreferredVendorPrimary(e.target.value)} placeholder="Vendor Code or Name" className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Secondary Vendor (Optional)</label>
              <input type="text" value={preferredVendorSecondary} onChange={(e) => setPreferredVendorSecondary(e.target.value)} placeholder="Secondary Vendor Code" className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body" />
            </div>
          </div>
        </div>

        {/* Section 5: Batch, Grade & Expiry Controls */}
        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-4">
          <span className="text-xs font-bold font-display text-indigo-400 uppercase tracking-wide block">
            5. Grade, Batch & Expiry Controls
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={enableGrade} onChange={(e) => setEnableGrade(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Enable Grade</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={gradePricingEnabled} onChange={(e) => setGradePricingEnabled(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Grade-wise Pricing</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={enableLocation} onChange={(e) => setEnableLocation(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Enable Location</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={batchApplicable} onChange={(e) => setBatchApplicable(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Batch Applicable</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={batchWisePricing} onChange={(e) => setBatchWisePricing(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Batch-wise Pricing</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 bg-theme-surface-2 rounded-xl border border-theme-divider cursor-pointer">
              <input type="checkbox" checked={mfgDateApplicable} onChange={(e) => setMfgDateApplicable(e.target.checked)} className="accent-indigo-500 rounded" />
              <span>Mfg Date Applicable</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Shelf Life (Days)</label>
              <input type="number" value={shelfLifeDays} onChange={(e) => setShelfLifeDays(parseInt(e.target.value) || 0)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase block mb-1">Stop POS Sales Before (Days)</label>
              <input type="number" value={stopSalesBeforeDays} onChange={(e) => setStopSalesBeforeDays(parseInt(e.target.value) || 0)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body font-mono" />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-rose-400 font-bold cursor-pointer">
                <input type="checkbox" checked={markedForDeletion} onChange={(e) => setMarkedForDeletion(e.target.checked)} className="accent-rose-500 rounded" />
                <span>Mark Combo for Deletion</span>
              </label>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Toolbar */}
      <div className="bg-theme-surface-1 border-t border-theme-divider px-6 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted text-xs font-bold rounded-xl transition cursor-pointer font-mono"
        >
          Clear
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer font-mono"
          >
            <Save size={15} />
            <span>Save Combo Matrix</span>
          </button>
        </div>
      </div>
    </div>
  );
};
