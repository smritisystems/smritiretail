/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-28
 * Modified     : 2026-09-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useRef, useCallback } from "react";
import {
  X,
  Upload,
  Plus,
  Search,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AddProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  productType?: string;
}

type DrawerTab = "basic" | "pricing" | "tax_inventory" | "attributes" | "additional";

interface ProductForm {
  sku: string;
  autoGenerateArticleNumber: boolean;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  gender: "Men" | "Women" | "Unisex" | "";
  productType: string;
  article: string;
  color: string;
  sizeSystem: "UK" | "EU" | "US" | "CM";
  size: string;
  material: string;
  upperType: string;
  soleType: string;
  season: string;
  collection: string;
  hsnCode: string;
  description: string;
  tags: string[];
  isRegularItem: boolean;
  isBillable: boolean;
  isInventoryItem: boolean;
  isDiscontinued: boolean;
  isServiceItem: boolean;
  isTaxInclusive: boolean;
  retailPrice: string;
  dealerPrice: string;
  costPrice: string;
  lastPurchasePrice: string;
  gstPercentage: string;
  openingStock: string;
  reorderLevel: string;
  status: "Active" | "Inactive" | "Draft";
  supplierPartyId: string;
  supplierPriority: "PRIMARY" | "PREFERRED" | "SECONDARY";
  allowPo: boolean;
  allowGrn: boolean;
  approvalRequired: boolean;
}

const INITIAL_FORM: ProductForm = {
  sku: "",
  autoGenerateArticleNumber: false,
  barcode: "",
  name: "",
  brand: "",
  category: "",
  gender: "",
  productType: "",
  article: "",
  color: "",
  sizeSystem: "UK",
  size: "",
  material: "",
  upperType: "",
  soleType: "",
  season: "",
  collection: "",
  hsnCode: "",
  description: "",
  tags: [],
  isRegularItem: true,
  isBillable: true,
  isInventoryItem: true,
  isDiscontinued: false,
  isServiceItem: false,
  isTaxInclusive: true,
  retailPrice: "",
  dealerPrice: "",
  costPrice: "",
  lastPurchasePrice: "",
  gstPercentage: "12",
  openingStock: "",
  reorderLevel: "",
  status: "Active",
  supplierPartyId: "",
  supplierPriority: "PRIMARY",
  allowPo: true,
  allowGrn: true,
  approvalRequired: false,
};

const TABS: { id: DrawerTab; label: string; number: number }[] = [
  { id: "basic", label: "Basic Information", number: 1 },
  { id: "pricing", label: "Pricing", number: 2 },
  { id: "tax_inventory", label: "Tax & Inventory", number: 3 },
  { id: "attributes", label: "Attributes", number: 4 },
  { id: "additional", label: "Supplier & Additional", number: 5 },
];

// ── Shared UI Helpers ─────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-1.5 rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] bg-white dark:bg-[#151820] text-xs text-[#0f172a] dark:text-[#e2e8f0] outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition placeholder:text-[#94a3b8]";

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-bold text-[#0f172a] dark:text-white border-b border-[#e2e8f0] dark:border-[#2d3133] pb-1.5">
    {children}
  </h3>
);

const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, required, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-[#374151] dark:text-[#94a3b8] mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

// ── Tab Props ─────────────────────────────────────────────────────────────────

interface TabProps {
  form: ProductForm;
  update: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
}

// ── Tab 1: Basic Information ───────────────────────────────────────────────────

interface BasicInfoTabProps extends TabProps {
  imagePreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileInputClick: () => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  onAddTag: () => void;
  onRemoveTag: (t: string) => void;
}

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
  form, update,
  imagePreview,
  fileInputRef, onImageUpload, onFileInputClick,
  tagInput, setTagInput, onAddTag, onRemoveTag,
}) => (
  <div className="p-5 grid grid-cols-12 gap-5">
    {/* Column 1: Product Image */}
    <div className="col-span-12 md:col-span-2">
      <p className="text-[11px] font-semibold text-[#374151] dark:text-[#94a3b8] uppercase tracking-wide mb-1.5">Product Image</p>
      <div
        onClick={onFileInputClick}
        className="w-full aspect-square rounded-xl border-2 border-dashed border-[#cbd5e1] dark:border-[#2d3133] flex flex-col items-center justify-center cursor-pointer hover:border-[#2563eb] hover:bg-[#eff6ff]/60 dark:hover:bg-[#1d3054]/20 transition overflow-hidden bg-[#f8fafc] dark:bg-[#151820]"
      >
        {imagePreview ? (
          <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
        ) : (
          <>
            <ImageIcon size={28} className="text-[#94a3b8] mb-1" />
            <span className="text-[10px] text-[#94a3b8] text-center font-medium px-1">Upload Image</span>
            <span className="text-[9px] text-[#94a3b8] text-center">PNG, JPG (Max 2MB)</span>
          </>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
      <button
        type="button"
        onClick={onFileInputClick}
        className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold text-[#64748b] border border-[#cbd5e1] dark:border-[#2d3133] rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#2d3133] transition"
      >
        <Upload size={11} /> Upload Image
      </button>
      <div className="flex gap-1 mt-2 flex-wrap">
        <button
          type="button"
          className="w-10 h-10 rounded-lg border-2 border-dashed border-[#cbd5e1] dark:border-[#2d3133] flex items-center justify-center hover:border-[#2563eb] transition"
          onClick={onFileInputClick}
        >
          <Plus size={14} className="text-[#94a3b8]" />
        </button>
      </div>
    </div>

    {/* Column 2: Basic Information */}
    <div className="col-span-12 md:col-span-3">
      <SectionTitle>Article / Design Identity</SectionTitle>
      <div className="space-y-2.5 mt-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-[#374151] dark:text-[#94a3b8]">
              Article Number / SKU <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#1e293b] p-0.5 rounded text-[10px]">
              <button
                type="button"
                onClick={() => update("autoGenerateArticleNumber", false)}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  !form.autoGenerateArticleNumber
                    ? "bg-white dark:bg-[#0052cc] text-[#0f172a] dark:text-white shadow-xs"
                    : "text-[#64748b] dark:text-[#94a3b8]"
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => update("autoGenerateArticleNumber", true)}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  form.autoGenerateArticleNumber
                    ? "bg-white dark:bg-[#0052cc] text-[#0f172a] dark:text-white shadow-xs"
                    : "text-[#64748b] dark:text-[#94a3b8]"
                }`}
              >
                Auto Generate
              </button>
            </div>
          </div>
          {form.autoGenerateArticleNumber ? (
            <div className="w-full px-3 py-1.5 rounded-lg border border-dashed border-[#2563eb] bg-[#eff6ff]/50 dark:bg-[#1d3054]/20 text-xs font-mono text-[#2563eb] dark:text-[#93c5fd]">
              [Auto-Allocated from Active Series]
            </div>
          ) : (
            <input
              type="text"
              value={form.sku}
              onChange={(e) => update("sku", e.target.value)}
              placeholder="e.g. ART-1001 / FT00123"
              className={inputCls}
            />
          )}
        </div>
        <FormField label="Barcode">
          <div className="relative">
            <input type="text" value={form.barcode} onChange={(e) => update("barcode", e.target.value)} placeholder="8901234567890" className={inputCls} />
          </div>
        </FormField>
        <FormField label="Product Name" required>
          <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Running Shoes" className={inputCls} />
        </FormField>
        <FormField label="Brand" required>
          <div className="flex gap-1">
            <select value={form.brand} onChange={(e) => update("brand", e.target.value)} className={`${inputCls} flex-1`}>
              <option value="">Select Brand</option>
              {["Nike", "Adidas", "Puma", "Reebok", "Bata", "Hush Puppies", "Woodland", "Liberty"].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <button type="button" className="w-8 h-8 rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] flex items-center justify-center hover:bg-[#eff6ff] dark:hover:bg-[#1d3054] transition flex-shrink-0">
              <Plus size={14} className="text-[#2563eb]" />
            </button>
          </div>
        </FormField>
        <FormField label="Category" required>
          <div className="flex gap-1">
            <select value={form.category} onChange={(e) => update("category", e.target.value)} className={`${inputCls} flex-1`}>
              <option value="">Select Category</option>
              {["Sports", "Casual", "Formal", "Kids"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button type="button" className="w-8 h-8 rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] flex items-center justify-center hover:bg-[#eff6ff] dark:hover:bg-[#1d3054] transition flex-shrink-0">
              <Plus size={14} className="text-[#2563eb]" />
            </button>
          </div>
        </FormField>
        <FormField label="Gender" required>
          <div className="flex gap-4 mt-1">
            {(["Men", "Women", "Unisex"] as const).map((g) => (
              <label key={g} className="flex items-center gap-1.5 cursor-pointer text-xs text-[#374151] dark:text-[#e2e8f0]">
                <input type="radio" name="add_product_gender" value={g} checked={form.gender === g} onChange={() => update("gender", g)} className="accent-[#2563eb]" />
                {g}
              </label>
            ))}
          </div>
        </FormField>
        <FormField label="Product Type" required>
          <div className="flex gap-1">
            <select value={form.productType} onChange={(e) => update("productType", e.target.value)} className={`${inputCls} flex-1`}>
              <option value="">Select Type</option>
              {["Running", "Walking", "Training", "Sneakers", "Formal", "Sandals", "Slippers"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button type="button" className="w-8 h-8 rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] flex items-center justify-center hover:bg-[#eff6ff] dark:hover:bg-[#1d3054] transition flex-shrink-0">
              <Plus size={14} className="text-[#2563eb]" />
            </button>
          </div>
        </FormField>
      </div>
    </div>

    {/* Column 3: Design & Variant */}
    <div className="col-span-12 md:col-span-3">
      <SectionTitle>Design &amp; Variant</SectionTitle>
      <div className="space-y-2.5 mt-2">
        <FormField label="Article / Design / Style / Model" required>
          <div className="flex gap-1">
            <select value={form.article} onChange={(e) => update("article", e.target.value)} className={`${inputCls} flex-1`}>
              <option value="">Select</option>
              {["RS-100", "RS-200", "CS-200", "FM-300", "SD-100", "TR-500"].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button type="button" className="w-8 h-8 rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] flex items-center justify-center hover:bg-[#eff6ff] dark:hover:bg-[#1d3054] transition flex-shrink-0">
              <Plus size={14} className="text-[#2563eb]" />
            </button>
          </div>
        </FormField>
        <FormField label="Color / Shade">
          <div className="flex gap-1">
            <select value={form.color} onChange={(e) => update("color", e.target.value)} className={`${inputCls} flex-1`}>
              <option value="">Select Color</option>
              {["Black", "White", "Blue", "Red", "Brown", "Beige", "Navy", "Grey", "Black/Red"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button type="button" className="w-8 h-8 rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] flex items-center justify-center hover:bg-[#eff6ff] dark:hover:bg-[#1d3054] transition flex-shrink-0">
              <Plus size={14} className="text-[#2563eb]" />
            </button>
          </div>
        </FormField>
        <FormField label="Size System" required>
          <div className="flex gap-3 mt-1">
            {(["UK", "EU", "US", "CM"] as const).map((s) => (
              <label key={s} className="flex items-center gap-1.5 cursor-pointer text-xs text-[#374151] dark:text-[#e2e8f0]">
                <input type="radio" name="add_product_size_system" value={s} checked={form.sizeSystem === s} onChange={() => update("sizeSystem", s)} className="accent-[#2563eb]" />
                {s}
              </label>
            ))}
          </div>
        </FormField>
        <FormField label="Size" required>
          <select value={form.size} onChange={(e) => update("size", e.target.value)} className={inputCls}>
            <option value="">Select Size</option>
            {["5", "6", "7", "7.5", "8", "8.5", "9", "9.5", "10", "11", "12", "38", "39", "40", "41", "42", "43", "44", "45"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Material">
          <select value={form.material} onChange={(e) => update("material", e.target.value)} className={inputCls}>
            <option value="">Select Material</option>
            {["Leather", "Mesh", "Synthetic", "Canvas", "Rubber", "Suede", "Fabric"].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Upper Type">
          <select value={form.upperType} onChange={(e) => update("upperType", e.target.value)} className={inputCls}>
            <option value="">Select</option>
            {["Leather", "Mesh", "Synthetic", "Canvas", "Knit", "Suede"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Sole Type">
          <select value={form.soleType} onChange={(e) => update("soleType", e.target.value)} className={inputCls}>
            <option value="">Select</option>
            {["EVA", "PU", "Rubber", "TPR", "MD", "Leather"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Season">
          <select value={form.season} onChange={(e) => update("season", e.target.value)} className={inputCls}>
            <option value="">Select Season</option>
            {["SS-2024", "AW-2024", "SS-2025", "AW-2025", "Core / All Season"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Collection">
          <select value={form.collection} onChange={(e) => update("collection", e.target.value)} className={inputCls}>
            <option value="">Select</option>
            {["Performance", "Lifestyle", "Premium", "Sport", "Comfort"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </FormField>
      </div>
    </div>

    {/* Column 4: Classification + Product Options */}
    <div className="col-span-12 md:col-span-4">
      <SectionTitle>Classification &amp; Description</SectionTitle>
      <div className="space-y-2.5 mt-2">
        <FormField label="HSN Code" required>
          <div className="relative">
            <input type="text" value={form.hsnCode} onChange={(e) => update("hsnCode", e.target.value)} placeholder="64041110" className={inputCls} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#2563eb]">
              <Search size={14} />
            </button>
          </div>
        </FormField>
        <FormField label="Description">
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Nike Running Shoes Black - Size 8"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </FormField>
        <div>
          <label className="block text-[11px] font-semibold text-[#374151] dark:text-[#94a3b8] mb-1">Tags (Optional)</label>
          <div className="flex flex-wrap gap-1 mb-1.5 min-h-[22px]">
            {form.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#dbeafe] dark:bg-[#1d3054] text-[#2563eb] dark:text-[#93c5fd] text-[10px] font-semibold">
                {tag}
                <button type="button" onClick={() => onRemoveTag(tag)} className="hover:text-red-500">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddTag(); }}}
            placeholder="Add tag and press Enter..."
            className={inputCls}
          />
        </div>
      </div>

      {/* Product Options */}
      <div className="mt-4">
        <SectionTitle>Product Options</SectionTitle>
        <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-2">
          {([
            { key: "isRegularItem", label: "Regular Item" },
            { key: "isBillable", label: "Billable" },
            { key: "isInventoryItem", label: "Inventory Item" },
            { key: "isDiscontinued", label: "Discontinued" },
            { key: "isServiceItem", label: "Service Item" },
            { key: "isTaxInclusive", label: "Tax Inclusive" },
          ] as const).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer text-xs text-[#374151] dark:text-[#e2e8f0]">
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => update(key, e.target.checked as any)}
                className="accent-[#2563eb] rounded w-3.5 h-3.5"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Product Status */}
      <div className="mt-4">
        <SectionTitle>Product Status</SectionTitle>
        <select value={form.status} onChange={(e) => update("status", e.target.value as any)} className={`${inputCls} mt-2`}>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Draft">Draft</option>
        </select>
      </div>
    </div>
  </div>
);

// ── Tab 2: Pricing ─────────────────────────────────────────────────────────────

const PricingTab: React.FC<TabProps> = ({ form, update }) => (
  <div className="p-6">
    <SectionTitle>Pricing Information</SectionTitle>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
      {([
        { key: "retailPrice" as const, label: "Retail Price (MRP)", required: true },
        { key: "dealerPrice" as const, label: "Dealer Price", required: false },
        { key: "costPrice" as const, label: "Cost Price", required: false },
        { key: "lastPurchasePrice" as const, label: "Last Purchase Price", required: false },
      ]).map(({ key, label, required }) => (
        <FormField key={key} label={label} required={required}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8] font-semibold">₹</span>
            <input
              type="number"
              value={form[key]}
              onChange={(e) => update(key, e.target.value)}
              placeholder="0.00"
              className={`${inputCls} pl-7`}
            />
          </div>
        </FormField>
      ))}
    </div>
    <div className="mt-5 p-4 rounded-xl bg-[#f0f9ff] dark:bg-[#0c1a2e] border border-[#bae6fd] dark:border-[#164e63] text-xs text-[#0369a1] dark:text-[#7dd3fc]">
      <p className="font-bold mb-1">Pricing Rules</p>
      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
        <li>Retail Price (MRP) must be ≥ Dealer Price</li>
        <li>Cost Price must be ≤ Dealer Price</li>
        <li>All prices are in Indian Rupees (₹)</li>
      </ul>
    </div>
  </div>
);

// ── Tab 3: Tax & Inventory ─────────────────────────────────────────────────────

const TaxInventoryTab: React.FC<TabProps> = ({ form, update }) => (
  <div className="p-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <SectionTitle>Tax Configuration</SectionTitle>
        <div className="space-y-4 mt-3">
          <FormField label="GST %" required>
            <select value={form.gstPercentage} onChange={(e) => update("gstPercentage", e.target.value)} className={inputCls}>
              {["0", "5", "12", "18", "28"].map((r) => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
          </FormField>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isTaxInclusive} onChange={(e) => update("isTaxInclusive", e.target.checked)} className="accent-[#2563eb] w-4 h-4 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#374151] dark:text-[#e2e8f0]">Tax Inclusive Pricing</p>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">Price shown to customer includes GST</p>
            </div>
          </label>
        </div>
      </div>
      <div>
        <SectionTitle>Inventory Settings</SectionTitle>
        <div className="space-y-4 mt-3">
          <FormField label="Opening Stock (Units)">
            <input type="number" value={form.openingStock} onChange={(e) => update("openingStock", e.target.value)} placeholder="0" className={inputCls} />
          </FormField>
          <FormField label="Reorder Level">
            <input type="number" value={form.reorderLevel} onChange={(e) => update("reorderLevel", e.target.value)} placeholder="0" className={inputCls} />
          </FormField>
        </div>
      </div>
    </div>
  </div>
);

// ── Tab 4: Attributes ─────────────────────────────────────────────────────────

const AttributesTab: React.FC<TabProps> = () => (
  <div className="p-6">
    <SectionTitle>Additional Attributes</SectionTitle>
    <p className="text-xs text-[#94a3b8] mt-1 mb-4">Extra product dimensions and specifications for detailed catalog management.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[
        { label: "Closure Type", options: ["Lace-up", "Slip-on", "Velcro", "Buckle", "Zip"] },
        { label: "Toe Style", options: ["Round Toe", "Square Toe", "Pointed Toe", "Open Toe"] },
        { label: "Heel Type", options: ["Flat", "Low", "Mid", "High", "Block", "Wedge"] },
        { label: "Insole Type", options: ["Cushioned", "Orthopaedic", "Memory Foam", "Standard"] },
        { label: "Occasion", options: ["Sports", "Casual", "Formal", "Party", "Outdoor", "Office"] },
        { label: "Width", options: ["Narrow", "Regular", "Wide", "Extra Wide"] },
      ].map(({ label, options }) => (
        <FormField key={label} label={label}>
          <select className={inputCls}>
            <option value="">Select</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </FormField>
      ))}
    </div>
  </div>
);

// ── Tab 5: Supplier & Additional Info ─────────────────────────────────────────

const AdditionalInfoTab: React.FC<TabProps> = ({ form, update }) => (
  <div className="p-6">
    <SectionTitle>Supplier Sourcing &amp; Governance</SectionTitle>
    <p className="text-xs text-[#94a3b8] mt-1 mb-4">
      Configure vendor assignment and PO / GRN procurement policy rules.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
      <FormField label="Supplier / Vendor Code">
        <input
          type="text"
          value={form.supplierPartyId}
          onChange={(e) => update("supplierPartyId", e.target.value)}
          placeholder="e.g. VEND-SUP-001"
          className={inputCls}
        />
      </FormField>
      <FormField label="Supplier Priority">
        <select
          value={form.supplierPriority}
          onChange={(e) => update("supplierPriority", e.target.value as any)}
          className={inputCls}
        >
          <option value="PRIMARY">PRIMARY</option>
          <option value="PREFERRED">PREFERRED</option>
          <option value="SECONDARY">SECONDARY</option>
        </select>
      </FormField>
      <div className="flex flex-col justify-end space-y-2 pb-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[#374151] dark:text-[#e2e8f0]">
          <input
            type="checkbox"
            checked={form.allowPo}
            onChange={(e) => update("allowPo", e.target.checked)}
            className="accent-[#2563eb] rounded"
          />
          Allow Purchase Orders (PO)
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[#374151] dark:text-[#e2e8f0]">
          <input
            type="checkbox"
            checked={form.allowGrn}
            onChange={(e) => update("allowGrn", e.target.checked)}
            className="accent-[#2563eb] rounded"
          />
          Allow Goods Receipts (GRN)
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[#374151] dark:text-[#e2e8f0]">
          <input
            type="checkbox"
            checked={form.approvalRequired}
            onChange={(e) => update("approvalRequired", e.target.checked)}
            className="accent-[#2563eb] rounded"
          />
          Approval Required
        </label>
      </div>
    </div>

    <div className="mt-6 pt-4 border-t border-[#e2e8f0] dark:border-[#2d3133]">
      <SectionTitle>Additional Attributes &amp; Specifications</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
        <FormField label="Country of Origin">
          <select className={inputCls}>
            <option value="">Select Country</option>
            {["India", "China", "Vietnam", "Bangladesh", "Italy", "USA"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Unit of Measure">
          <select className={inputCls}>
            <option value="Pair">Pair</option>
            <option value="Pcs">Pcs</option>
            <option value="Box">Box</option>
            <option value="Set">Set</option>
          </select>
        </FormField>
        <FormField label="Weight (grams)">
          <input type="number" placeholder="0" className={inputCls} />
        </FormField>
        <FormField label="Warranty (months)">
          <input type="number" placeholder="0" className={inputCls} />
        </FormField>
      </div>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

export const AddProductDrawer: React.FC<AddProductDrawerProps> = ({
  isOpen,
  onClose,
  onSaved,
  onNotification,
  productType = "Footwear",
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>("basic");
  const [form, setForm] = useState<ProductForm>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(<K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) update("tags", [...form.tags, t]);
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => update("tags", form.tags.filter((t) => t !== tag));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.autoGenerateArticleNumber && !form.sku.trim()) {
      onNotification?.("Validation Error", "Article Number / SKU is required when manual numbering is selected.", "error");
      setActiveTab("basic");
      return;
    }
    if (!form.name.trim()) { onNotification?.("Validation Error", "Article Name is required.", "error"); setActiveTab("basic"); return; }
    if (!form.barcode.trim()) { onNotification?.("Validation Error", "Barcode is required.", "error"); setActiveTab("basic"); return; }

    setIsSaving(true);
    try {
      const attrs: Record<string, any> = {
        gender: form.gender || null,
        product_type: form.productType || null,
        article: form.article || null,
        color: form.color || null,
        size: form.size || null,
        size_system: form.sizeSystem || null,
        material: form.material || null,
        upper_type: form.upperType || null,
        sole_type: form.soleType || null,
        season: form.season || null,
        collection: form.collection || null,
        description: form.description || null,
        tags: form.tags.length > 0 ? form.tags.join(",") : null,
        last_purchase_price: parseFloat(form.lastPurchasePrice) || null,
      };
      Object.keys(attrs).forEach((k) => { if (attrs[k] === null) delete attrs[k]; });

      const supplierPayload = form.supplierPartyId.trim()
        ? {
            vendor_party_id: form.supplierPartyId.trim(),
            vendor_priority: form.supplierPriority,
            allow_po: form.allowPo,
            allow_grn: form.allowGrn,
            approval_required: form.approvalRequired,
          }
        : null;

      await apiFetchV1("/inventory/", {
        method: "POST",
        body: JSON.stringify({
          code: form.autoGenerateArticleNumber ? "AUTO" : form.sku.trim(),
          auto_generate_article_number: form.autoGenerateArticleNumber,
          name: form.name.trim(),
          barcode: form.barcode.trim(),
          brand: form.brand || null,
          category: form.category || "Footwear",
          // price = dealer/selling price; mrp = retail price (MRP)
          price: parseFloat(form.dealerPrice) || parseFloat(form.retailPrice) || 0,
          mrp: parseFloat(form.retailPrice) || 0,
          buying_price: parseFloat(form.dealerPrice) || null,
          cost_price: parseFloat(form.costPrice) || null,
          stock: parseFloat(form.openingStock) || 0,
          gst_percentage: parseFloat(form.gstPercentage) || 12,
          hsn_code: form.hsnCode || null,
          attributes: attrs,
          supplier: supplierPayload,
        }),
      });
      onNotification?.("Article / Design Saved", `"${form.name}" has been added to the canonical catalog.`, "success");
      setForm(INITIAL_FORM);
      setImagePreview(null);
      setActiveTab("basic");
      onSaved();
      onClose();
    } catch (err: any) {
      onNotification?.("Save Failed", err?.message || "Failed to save article / design.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setImagePreview(null);
    setActiveTab("basic");
    onClose();
  };

  if (!isOpen) return null;

  const currentTabIdx = TABS.findIndex((t) => t.id === activeTab);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-[2px]" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-x-2 top-3 bottom-3 sm:inset-x-6 sm:top-6 sm:bottom-6 z-50 flex flex-col bg-white dark:bg-[#1c1f26] rounded-2xl shadow-2xl overflow-hidden border border-[#e2e8f0] dark:border-[#2d3133]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e8f0] dark:border-[#2d3133] shrink-0">
          <h2 className="text-sm font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#eff6ff] dark:bg-[#1d3054] flex items-center justify-center">
              <Plus size={14} className="text-[#2563eb]" />
            </span>
            Add Article / Design ({productType})
          </h2>
          <button type="button" onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#2d3133] transition text-[#64748b]">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-5 border-b border-[#e2e8f0] dark:border-[#2d3133] shrink-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#2563eb] text-[#2563eb] dark:text-[#93c5fd] dark:border-[#93c5fd]"
                  : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
              }`}
            >
              <span className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                activeTab === tab.id
                  ? "bg-[#2563eb] text-white dark:bg-[#93c5fd] dark:text-[#0f172a]"
                  : "bg-[#e2e8f0] dark:bg-[#2d3133] text-[#64748b]"
              }`}>
                {tab.number}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "basic" && (
            <BasicInfoTab
              form={form} update={update}
              imagePreview={imagePreview}
              fileInputRef={fileInputRef}
              onImageUpload={handleImageUpload}
              onFileInputClick={() => fileInputRef.current?.click()}
              tagInput={tagInput}
              setTagInput={setTagInput}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
            />
          )}
          {activeTab === "pricing" && <PricingTab form={form} update={update} />}
          {activeTab === "tax_inventory" && <TaxInventoryTab form={form} update={update} />}
          {activeTab === "attributes" && <AttributesTab form={form} update={update} />}
          {activeTab === "additional" && <AdditionalInfoTab form={form} update={update} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#e2e8f0] dark:border-[#2d3133] bg-[#f8fafc] dark:bg-[#151820] shrink-0">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] text-[#374151] dark:text-[#e2e8f0] bg-white dark:bg-[#1c1f26] hover:bg-[#f1f5f9] dark:hover:bg-[#2d3133] text-xs font-semibold transition">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {currentTabIdx > 0 && (
              <button type="button" onClick={() => setActiveTab(TABS[currentTabIdx - 1].id)} className="px-4 py-2 rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] text-xs font-semibold text-[#374151] dark:text-[#e2e8f0] bg-white dark:bg-[#1c1f26] hover:bg-[#f1f5f9] transition">
                ← Previous
              </button>
            )}
            {currentTabIdx < TABS.length - 1 ? (
              <button type="button" onClick={() => setActiveTab(TABS[currentTabIdx + 1].id)} className="px-5 py-2 rounded-lg bg-[#0f172a] dark:bg-[#dbeafe] text-white dark:text-[#0f172a] text-xs font-bold transition hover:bg-[#1e293b]">
                Next →
              </button>
            ) : (
              <button type="button" onClick={handleSave} disabled={isSaving} className="px-6 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-bold transition hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                {isSaving ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                ) : (
                  <><Check size={14} />Save Article / Design</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AddProductDrawer;
