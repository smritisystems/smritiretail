/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { 
  Settings, 
  CheckSquare, 
  Square, 
  Save, 
  RotateCcw, 
  Info, 
  Tag, 
  Package, 
  Building2, 
  Hash, 
  Percent 
} from "lucide-react";

export interface CommonFieldsData {
  category: string;
  subCategory: string;
  brand: string;
  vendorCode: string;
  hsnCode: string;
  gstPercentage: string;
  uom: string;
  purchaseClass: string;
  department: string;
}

interface SmritiCommonFieldsSetupProps {
  initialValues?: Partial<CommonFieldsData>;
  onSave: (values: CommonFieldsData) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const SmritiCommonFieldsSetup: React.FC<SmritiCommonFieldsSetupProps> = ({
  initialValues = {},
  onSave,
  onNotification
}) => {
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    category: true,
    subCategory: true,
    brand: true,
    vendorCode: true,
    hsnCode: true,
    gstPercentage: true,
    uom: true,
    purchaseClass: true,
    department: true
  });

  const [formData, setFormData] = useState<CommonFieldsData>({
    category: initialValues.category || "Footwear",
    subCategory: initialValues.subCategory || "Formal Shoes",
    brand: initialValues.brand || "SMRITI",
    vendorCode: initialValues.vendorCode || "VEND-101",
    hsnCode: initialValues.hsnCode || "6403",
    gstPercentage: initialValues.gstPercentage || "18",
    uom: initialValues.uom || "Pair",
    purchaseClass: initialValues.purchaseClass || "A-Class",
    department: initialValues.department || "Men"
  });

  const toggleField = (key: string) => {
    setEnabledFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClear = () => {
    setFormData({
      category: "",
      subCategory: "",
      brand: "",
      vendorCode: "",
      hsnCode: "",
      gstPercentage: "18",
      uom: "Pair",
      purchaseClass: "",
      department: ""
    });
    onNotification?.("Form Cleared", "Common fields reset to empty.", "success");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onNotification?.("Common Fields Saved", "Shared attributes will auto-fill across all items in this session.", "success");
  };

  const activeCount = Object.values(enabledFields).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] font-sans p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        
        {/* Page Header */}
        <div className="flex justify-between items-end border-b border-[#c6c6cd] dark:border-[#45464d] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#003d9b] dark:text-[#b2c5ff] flex items-center gap-2">
              <Settings size={22} />
              Common Fields Setup
            </h2>
            <p className="text-xs text-[#515f74] dark:text-[#bec6e0] mt-0.5">
              Configure shared baseline attributes applied automatically across bulk item entry sessions.
            </p>
          </div>

          <span className="px-3 py-1 bg-[#d5e3fd] text-[#0d1c2f] rounded-full text-xs font-bold font-mono">
            {activeCount} Fields Active
          </span>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Field Checklist */}
          <div className="lg:col-span-4 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#515f74] dark:text-[#bec6e0]">
              Active Common Fields
            </h3>
            <p className="text-[11px] text-[#76777d]">Check fields to include in default batch assignment:</p>

            <div className="space-y-1.5 pt-2">
              {[
                { key: "category", label: "Merchandise Category" },
                { key: "subCategory", label: "Sub-Category" },
                { key: "brand", label: "Brand Name" },
                { key: "vendorCode", label: "Vendor / Supplier ID" },
                { key: "hsnCode", label: "HSN / SAC Code" },
                { key: "gstPercentage", label: "GST Tax Rate (%)" },
                { key: "uom", label: "Unit of Measure (UOM)" },
                { key: "purchaseClass", label: "Purchase Classification" },
                { key: "department", label: "Department / Section" }
              ].map(f => (
                <label
                  key={f.key}
                  onClick={() => toggleField(f.key)}
                  className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#f2f4f6] dark:hover:bg-[#191c1e] cursor-pointer transition text-xs font-semibold"
                >
                  {enabledFields[f.key] ? (
                    <CheckSquare size={16} className="text-[#0052cc]" />
                  ) : (
                    <Square size={16} className="text-[#76777d]" />
                  )}
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Right Column: Data Entry Form */}
          <div className="lg:col-span-8 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl overflow-hidden shadow-xs flex flex-col">
            <div className="p-4 border-b border-[#eceef0] dark:border-[#45464d] bg-[#f2f4f6] dark:bg-[#131b2e] flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#191c1e] dark:text-white">
                Shared Baseline Values
              </h3>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                
                {enabledFields.category && (
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Category</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="e.g. Footwear, Apparel"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold text-xs outline-none focus:ring-1 focus:ring-[#0052cc]"
                    />
                  </div>
                )}

                {enabledFields.subCategory && (
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Sub-Category</label>
                    <input
                      type="text"
                      value={formData.subCategory}
                      onChange={e => setFormData(prev => ({ ...prev, subCategory: e.target.value }))}
                      placeholder="e.g. Formal, Casual, Sports"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold text-xs outline-none focus:ring-1 focus:ring-[#0052cc]"
                    />
                  </div>
                )}

                {enabledFields.brand && (
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Brand</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={e => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                      placeholder="e.g. SMRITI, Nike, Puma"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold text-xs outline-none focus:ring-1 focus:ring-[#0052cc]"
                    />
                  </div>
                )}

                {enabledFields.vendorCode && (
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Vendor / Supplier ID</label>
                    <input
                      type="text"
                      value={formData.vendorCode}
                      onChange={e => setFormData(prev => ({ ...prev, vendorCode: e.target.value }))}
                      placeholder="e.g. VEND-101"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-[#0052cc]"
                    />
                  </div>
                )}

                {enabledFields.hsnCode && (
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">HSN Code</label>
                    <input
                      type="text"
                      value={formData.hsnCode}
                      onChange={e => setFormData(prev => ({ ...prev, hsnCode: e.target.value }))}
                      placeholder="e.g. 6403, 6204"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-[#0052cc]"
                    />
                  </div>
                )}

                {enabledFields.gstPercentage && (
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">GST Tax Rate (%)</label>
                    <select
                      value={formData.gstPercentage}
                      onChange={e => setFormData(prev => ({ ...prev, gstPercentage: e.target.value }))}
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold text-xs outline-none"
                    >
                      <option value="18">18% GST (Standard)</option>
                      <option value="12">12% GST</option>
                      <option value="5">5% GST</option>
                      <option value="0">0% Exempt</option>
                    </select>
                  </div>
                )}

                {enabledFields.uom && (
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Unit of Measure (UOM)</label>
                    <select
                      value={formData.uom}
                      onChange={e => setFormData(prev => ({ ...prev, uom: e.target.value }))}
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold text-xs outline-none"
                    >
                      <option value="Pair">Pair</option>
                      <option value="Pcs">Pieces (Pcs)</option>
                      <option value="Box">Box</option>
                      <option value="Set">Set</option>
                      <option value="Mtr">Meter (Mtr)</option>
                      <option value="Kg">Kilogram (Kg)</option>
                    </select>
                  </div>
                )}

                {enabledFields.department && (
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Department / Division</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="e.g. Men, Women, Kids"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold text-xs outline-none focus:ring-1 focus:ring-[#0052cc]"
                    />
                  </div>
                )}
              </div>

              {/* Informational Banner */}
              <div className="p-3 bg-[#e9edff] dark:bg-[#1d3054] border border-[#c4d2ff] dark:border-[#434654] rounded-lg flex items-start gap-2 text-xs">
                <Info size={16} className="text-[#0052cc] dark:text-[#b2c5ff] shrink-0 mt-0.5" />
                <p className="text-[#003d9b] dark:text-[#b2c5ff]">
                  Values defined here will be automatically applied to any new row added in the Item Details Grid and bulk paste operations.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-[#eceef0] dark:border-[#45464d] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-2 border border-[#76777d] rounded font-semibold text-xs hover:bg-[#eceef0] transition"
                >
                  Clear Form
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                >
                  <Save size={14} />
                  Save Common Field Data
                </button>
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SmritiCommonFieldsSetup;
