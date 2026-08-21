/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { RotateCcw, Save, Trash2, Check, Search } from "lucide-react";
import { ItemMasterCommonFieldValues } from "../types.ts";

interface CommonFieldsTabProps {
  initialValues: ItemMasterCommonFieldValues;
  onSaveCommonFields: (values: ItemMasterCommonFieldValues) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  onNavigateToDetails?: () => void;
}

const DEFAULT_COMMON_VALUES: ItemMasterCommonFieldValues = {
  brand: "",
  category: "Footwear",
  subCategory: "",
  taxRate: "18",
  supplier: "",
  season: "Core / All Season",
  status: "active",
  department: "Unisex",
  merchandiseCategory: ""
};

export const CommonFieldsTab: React.FC<CommonFieldsTabProps> = ({
  initialValues,
  onSaveCommonFields,
  onNotification,
  onNavigateToDetails
}) => {
  const [form, setForm] = useState<ItemMasterCommonFieldValues>(initialValues || DEFAULT_COMMON_VALUES);

  const handleChange = (key: keyof ItemMasterCommonFieldValues, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleReset = () => {
    setForm(DEFAULT_COMMON_VALUES);
    if (onNotification) {
      onNotification("Reset", "Common fields reset to system defaults.", "success");
    }
  };

  const handleClear = () => {
    setForm({
      brand: "",
      category: "",
      subCategory: "",
      taxRate: "",
      supplier: "",
      season: "",
      status: "active",
      department: "",
      merchandiseCategory: ""
    });
    if (onNotification) {
      onNotification("Cleared", "All common fields cleared.", "success");
    }
  };

  const handleSave = () => {
    onSaveCommonFields(form);
    if (onNotification) {
      onNotification("Common Fields Applied", "Common defaults saved and will auto-apply to item details.", "success");
    }
    if (onNavigateToDetails) {
      onNavigateToDetails();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
      {/* Grid Toolbar */}
      <div className="bg-slate-50 dark:bg-slate-900/60 px-6 py-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div>
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Common Field Data Application
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter common field data to apply across multiple items in the current session.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 transition"
          >
            <RotateCcw size={13} />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Grid Data Entry */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
          
          {/* Brand */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Brand
            </label>
            <div className="relative">
              <input
                type="text"
                list="brand-suggestions"
                value={form.brand}
                onChange={e => handleChange("brand", e.target.value)}
                placeholder="e.g. Nike, Adidas, Puma, Woodland..."
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <datalist id="brand-suggestions">
                <option value="Nike" />
                <option value="Adidas" />
                <option value="Puma" />
                <option value="Reebok" />
                <option value="Bata" />
                <option value="Woodland" />
                <option value="Red Tape" />
                <option value="Campus" />
                <option value="Sparx" />
                <option value="Herman Miller" />
                <option value="Logitech" />
              </datalist>
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Category
            </label>
            <select
              value={form.category}
              onChange={e => handleChange("category", e.target.value)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            >
              <option value="">Select Category</option>
              <option value="Footwear">Footwear</option>
              <option value="Apparel">Apparel</option>
              <option value="Accessories">Accessories</option>
              <option value="Electronics">Electronics</option>
              <option value="FMCG & Grocery">FMCG & Grocery</option>
              <option value="Jewellery">Jewellery</option>
              <option value="Hardware">Hardware</option>
            </select>
          </div>

          {/* Sub-Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Sub-Category
            </label>
            <input
              type="text"
              value={form.subCategory}
              onChange={e => handleChange("subCategory", e.target.value)}
              placeholder="e.g. Running Shoes, T-Shirt, Leather Belt..."
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Tax Rate (%) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Tax Rate (%) / GST Slab
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={form.taxRate}
                onChange={e => handleChange("taxRate", e.target.value)}
                placeholder="18"
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 font-bold">
                %
              </span>
            </div>
          </div>

          {/* Supplier */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Supplier / Vendor
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.supplier}
                onChange={e => handleChange("supplier", e.target.value)}
                placeholder="Search or enter supplier name..."
                className="w-full h-10 pl-3 pr-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Season */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Season
            </label>
            <select
              value={form.season}
              onChange={e => handleChange("season", e.target.value)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            >
              <option value="Core / All Season">Core / All Season</option>
              <option value="Spring/Summer 2026 (SS26)">Spring/Summer 2026 (SS26)</option>
              <option value="Autumn/Winter 2026 (AW26)">Autumn/Winter 2026 (AW26)</option>
              <option value="Festive 2026">Festive 2026</option>
            </select>
          </div>

          {/* Department */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Department
            </label>
            <select
              value={form.department}
              onChange={e => handleChange("department", e.target.value)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            >
              <option value="Unisex">Unisex</option>
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Kids & Teens">Kids & Teens</option>
              <option value="General Retail">General Retail</option>
            </select>
          </div>

          {/* Merchandise Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Merchandise Category
            </label>
            <input
              type="text"
              value={form.merchandiseCategory}
              onChange={e => handleChange("merchandiseCategory", e.target.value)}
              placeholder="e.g. Footwear-Athletic, Formal-Shirts"
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Initial SKU Status
            </label>
            <div className="flex items-center h-10 gap-6 px-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="radio"
                  name="item_status"
                  value="active"
                  checked={form.status === "active"}
                  onChange={() => handleChange("status", "active")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Active (In Catalog)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="radio"
                  name="item_status"
                  value="inactive"
                  checked={form.status === "inactive"}
                  onChange={() => handleChange("status", "inactive")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Inactive (Draft)
              </label>
            </div>
          </div>

        </div>
      </div>

      {/* Action Bar */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-6 py-3.5 flex justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={handleClear}
          className="px-5 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xs font-semibold transition"
        >
          Clear Fields
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow"
        >
          <Save size={15} />
          Save & Apply to Item Details (Alt+3)
        </button>
      </div>
    </div>
  );
};
