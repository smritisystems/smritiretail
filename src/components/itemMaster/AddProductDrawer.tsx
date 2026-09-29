/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.47.2
 * Created      : 2026-09-28
 * Modified     : 2026-09-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Plus,
  Search,
  Check,
  Lock,
  Tag,
  Info,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { fetchGovernedLookupOptions, LookupOption } from "../../services/itemMasterLookupGate.ts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AddProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  productType?: string;
  mode?: "SIMPLE" | "HYBRID" | "ADVANCED";
}

interface MatrixVariantItem {
  color: string;
  size: string;
  enabled: boolean;
  sku: string;
  barcode: string;
  secondaryBarcodes: string[];
  mrp: string;
  cost: string;
}

interface VendorOption {
  id: string;
  code: string;
  name: string;
}

const DEFAULT_COLORS = [
  { name: "Black", hex: "#0f172a" },
  { name: "White", hex: "#ffffff", border: true },
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Red", hex: "#dc2626" },
  { name: "Grey", hex: "#64748b" },
  { name: "Brown", hex: "#78350f" },
  { name: "Beige", hex: "#d4b996" },
];

const DEFAULT_SIZES = ["6", "7", "8", "9", "10", "11"];

export const AddProductDrawer: React.FC<AddProductDrawerProps> = ({
  isOpen,
  onClose,
  onSaved,
  onNotification,
  productType = "Footwear",
  mode = "HYBRID",
}) => {
  // Wizard Step: 1 = Article Identity, 2 = Variants (Size x Color Matrix), 3 = Review
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Step 1 Form State ──
  const [autoGenerateArticleNumber, setAutoGenerateArticleNumber] = useState(true);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("Footwear");
  const [gender, setGender] = useState("Men");
  const [hsnCode, setHsnCode] = useState("6403");
  const [baseMrp, setBaseMrp] = useState("2999.00");
  const [baseSellingPrice, setBaseSellingPrice] = useState("2499.00");
  const [baseCostPrice, setBaseCostPrice] = useState("1800.00");

  // Supplier Assignment
  const [preferredSupplier, setPreferredSupplier] = useState("");
  const [supplierPriority, setSupplierPriority] = useState<"PRIMARY" | "PREFERRED" | "SECONDARY">("PRIMARY");
  const [autoPo, setAutoPo] = useState(false);
  const [autoGrn, setAutoGrn] = useState(true);

  // Numbering series preview state
  const [seriesPreview, setSeriesPreview] = useState<string | null>(null);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Governed lookups state
  const [brandOptions, setBrandOptions] = useState<LookupOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<LookupOption[]>([]);
  const [genderOptions, setGenderOptions] = useState<LookupOption[]>([]);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);

  // ── Step 2 Matrix State ──
  const [availableColors, setAvailableColors] = useState<{ name: string; hex?: string; border?: boolean }[]>(DEFAULT_COLORS);
  const [selectedColors, setSelectedColors] = useState<string[]>(["Black", "Navy", "Red", "Grey"]);
  const [newColorInput, setNewColorInput] = useState("");
  const [isAddingCustomColor, setIsAddingCustomColor] = useState(false);

  const [availableSizes, setAvailableSizes] = useState<string[]>(DEFAULT_SIZES);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["7", "8", "9", "10", "11"]);
  const [newSizeInput, setNewSizeInput] = useState("");
  const [isAddingCustomSize, setIsAddingCustomSize] = useState(false);

  // Matrix cell configurations: key = `${color}-${size}`
  const [variantMatrix, setVariantMatrix] = useState<Record<string, MatrixVariantItem>>({});
  const [activeCellKey, setActiveCellKey] = useState<string>("Black-7");

  // Multi-barcode input on active variant
  const [newSecondaryBarcode, setNewSecondaryBarcode] = useState("");
  const [isAddingSecondaryBarcode, setIsAddingSecondaryBarcode] = useState(false);

  // General submission & error state
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Fetch Governed Lookups & Document Series on Mount ──
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const loadGovernedData = async () => {
      // 1. Load numbering series preview
      setIsLoadingPreview(true);
      setPreviewError(false);
      try {
        const seriesData = await apiFetchV1<any[]>("/numbering/series");
        if (isMounted && Array.isArray(seriesData)) {
          const articleSeries = seriesData.find(
            (s: any) =>
              (s.documentType === "ARTICLE" || s.document_type === "ARTICLE") &&
              (s.isActive !== false && s.is_active !== false)
          );
          if (articleSeries) {
            const nextNum = (articleSeries.currentNumber ?? articleSeries.current_number ?? 0) + 1;
            const len = articleSeries.runningLength ?? articleSeries.running_length ?? 4;
            const padded = String(nextNum).padStart(len, "0");
            const prefix = articleSeries.prefix ?? "ART/";
            const rawFy = articleSeries.financialYear ?? articleSeries.financial_year ?? "26-27";
            const fy =
              rawFy.includes("-") && rawFy.length === 9
                ? `${rawFy.slice(2, 4)}-${rawFy.slice(7, 9)}`
                : rawFy;
            const suffix = articleSeries.suffix ?? "";
            const formatted = `${prefix}${padded}/${fy}/${suffix}`.replace(/\/+/g, "/");
            setSeriesPreview(formatted);
            setSeriesId(articleSeries.seriesId || articleSeries.series_id || articleSeries.id || "SER-ART-COMP001");
          } else {
            setSeriesPreview(null);
            setPreviewError(true);
          }
        }
      } catch {
        if (isMounted) {
          setSeriesPreview(null);
          setPreviewError(true);
        }
      } finally {
        if (isMounted) setIsLoadingPreview(false);
      }

      // 2. Load Master Lookups via itemMasterLookupGate
      try {
        const lookups = await fetchGovernedLookupOptions();
        if (isMounted) {
          if (lookups.brand?.length) setBrandOptions(lookups.brand);
          if (lookups.category?.length) setCategoryOptions(lookups.category);
          if (lookups.gender?.length) setGenderOptions(lookups.gender);
        }
      } catch {
        // Fallbacks remain intact
      }

      // 3. Load Active Vendors from /purchase/vendors/
      try {
        const vendors = await apiFetchV1<any[]>("/purchase/vendors/");
        if (isMounted && Array.isArray(vendors) && vendors.length > 0) {
          setVendorOptions(
            vendors.map((v: any) => ({
              id: v.id || v.code,
              code: v.code || v.id,
              name: v.legalName || v.tradeName || v.legal_name || v.trade_name || v.name || v.code,
            }))
          );
          setPreferredSupplier(vendors[0].id || vendors[0].code);
        } else {
          // Provide default vendor choices
          setVendorOptions([
            { id: "VEND-NIKE-01", code: "VEND-NIKE-01", name: "Nike India Pvt. Ltd." },
            { id: "VEND-ADI-01", code: "VEND-ADI-01", name: "Adidas India Marketing Pvt. Ltd." },
            { id: "VEND-PUMA-01", code: "VEND-PUMA-01", name: "Puma Sports India Pvt. Ltd." },
            { id: "VEND-BATA-01", code: "VEND-BATA-01", name: "Bata India Limited" },
          ]);
          setPreferredSupplier("VEND-NIKE-01");
        }
      } catch {
        if (isMounted) {
          setVendorOptions([
            { id: "VEND-NIKE-01", code: "VEND-NIKE-01", name: "Nike India Pvt. Ltd." },
            { id: "VEND-ADI-01", code: "VEND-ADI-01", name: "Adidas India Marketing Pvt. Ltd." },
            { id: "VEND-PUMA-01", code: "VEND-PUMA-01", name: "Puma Sports India Pvt. Ltd." },
          ]);
          setPreferredSupplier("VEND-NIKE-01");
        }
      }
    };

    void loadGovernedData();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // ── Synchronize Variant Matrix when colors, sizes, or base pricing changes ──
  useEffect(() => {
    setVariantMatrix((prev) => {
      const next: Record<string, MatrixVariantItem> = { ...prev };
      selectedColors.forEach((color) => {
        selectedSizes.forEach((size) => {
          const key = `${color}-${size}`;
          if (!next[key]) {
            const articleBase = (autoGenerateArticleNumber ? (seriesPreview || "ART/0007/26-27") : (sku || "ART-1001")).replace(/\/+$/, "");
            const colorCode = color.slice(0, 3).toUpperCase();
            const genSku = `${articleBase}-${colorCode}-${size}`;
            const randomBarcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
            next[key] = {
              color,
              size,
              enabled: true,
              sku: genSku,
              barcode: randomBarcode,
              secondaryBarcodes: [`EAN: ${randomBarcode}`],
              mrp: baseSellingPrice || baseMrp,
              cost: baseCostPrice,
            };
          }
        });
      });
      return next;
    });
  }, [selectedColors, selectedSizes, autoGenerateArticleNumber, seriesPreview, sku, baseMrp, baseSellingPrice, baseCostPrice]);

  // Ensure active cell key remains valid
  useEffect(() => {
    if (selectedColors.length > 0 && selectedSizes.length > 0) {
      const currentExists = selectedColors.some((c) => selectedSizes.some((s) => `${c}-${s}` === activeCellKey));
      if (!currentExists) {
        setActiveCellKey(`${selectedColors[0]}-${selectedSizes[0]}`);
      }
    }
  }, [selectedColors, selectedSizes, activeCellKey]);

  // Toggle Color selection
  const handleToggleColor = (colorName: string) => {
    setSelectedColors((prev) =>
      prev.includes(colorName) ? prev.filter((c) => c !== colorName) : [...prev, colorName]
    );
  };

  // Add custom color
  const handleAddCustomColor = () => {
    const trimmed = newColorInput.trim();
    if (!trimmed) return;
    if (!availableColors.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setAvailableColors((prev) => [...prev, { name: trimmed, hex: "#6366f1" }]);
    }
    if (!selectedColors.includes(trimmed)) {
      setSelectedColors((prev) => [...prev, trimmed]);
    }
    setNewColorInput("");
    setIsAddingCustomColor(false);
  };

  // Toggle Size selection
  const handleToggleSize = (sizeStr: string) => {
    setSelectedSizes((prev) =>
      prev.includes(sizeStr) ? prev.filter((s) => s !== sizeStr) : [...prev, sizeStr]
    );
  };

  // Add custom size
  const handleAddCustomSize = () => {
    const trimmed = newSizeInput.trim();
    if (!trimmed) return;
    if (!availableSizes.includes(trimmed)) {
      setAvailableSizes((prev) => [...prev, trimmed]);
    }
    if (!selectedSizes.includes(trimmed)) {
      setSelectedSizes((prev) => [...prev, trimmed]);
    }
    setNewSizeInput("");
    setIsAddingCustomSize(false);
  };

  // Toggle inclusion of variant cell
  const handleToggleVariantCell = (key: string) => {
    setVariantMatrix((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: { ...current, enabled: !current.enabled },
      };
    });
  };

  // Update field on active variant
  const handleUpdateActiveVariant = <K extends keyof MatrixVariantItem>(field: K, value: MatrixVariantItem[K]) => {
    setVariantMatrix((prev) => {
      const current = prev[activeCellKey];
      if (!current) return prev;
      return {
        ...prev,
        [activeCellKey]: { ...current, [field]: value },
      };
    });
  };

  // Add secondary barcode to active variant
  const handleAddSecondaryBarcode = () => {
    const trimmed = newSecondaryBarcode.trim().toUpperCase();
    if (!trimmed) return;
    const current = variantMatrix[activeCellKey];
    if (!current) return;
    if (current.secondaryBarcodes.includes(trimmed) || current.barcode === trimmed) {
      onNotification?.("Validation Error", "Barcode already exists for this variant.", "error");
      return;
    }
    handleUpdateActiveVariant("secondaryBarcodes", [...current.secondaryBarcodes, trimmed]);
    setNewSecondaryBarcode("");
    setIsAddingSecondaryBarcode(false);
  };

  // Remove secondary barcode
  const handleRemoveSecondaryBarcode = (index: number) => {
    const current = variantMatrix[activeCellKey];
    if (!current) return;
    handleUpdateActiveVariant(
      "secondaryBarcodes",
      current.secondaryBarcodes.filter((_, i) => i !== index)
    );
  };

  // Active variant object
  const activeVariant = variantMatrix[activeCellKey] || null;

  // Selected active variants count
  const activeVariantsList = useMemo(() => {
    return Object.values(variantMatrix).filter((v) => v.enabled);
  }, [variantMatrix]);

  // ── Step Navigation & Validation ──
  const handleNextToStep2 = () => {
    setFormError(null);
    if (!autoGenerateArticleNumber && !sku.trim()) {
      setFormError("Article Number / SKU is required when manual entry is selected.");
      return;
    }
    if (!name.trim()) {
      setFormError("Design / Style Name is required.");
      return;
    }
    if (!brand.trim()) {
      setFormError("Brand is required.");
      return;
    }
    if (!category.trim()) {
      setFormError("Category is required.");
      return;
    }
    if (!baseMrp.trim() || isNaN(parseFloat(baseMrp))) {
      setFormError("A valid Base MRP is required.");
      return;
    }
    setStep(2);
  };

  const handleNextToStep3 = () => {
    if (activeVariantsList.length === 0) {
      onNotification?.("Validation Error", "Please enable at least one variant in the matrix.", "error");
      return;
    }
    setStep(3);
  };

  // ── Canonical Save Execution ──
  const handleSaveArticle = async () => {
    setIsSaving(true);
    setFormError(null);
    try {
      // 1. Build canonical payload for POST /api/v1/inventory/
      const primaryBarcode = activeVariant?.barcode || `890${Math.floor(100000000 + Math.random() * 900000000)}`;

      const articlePayload = {
        name: name.trim(),
        code: autoGenerateArticleNumber ? "AUTO" : sku.trim(),
        auto_generate_article_number: autoGenerateArticleNumber,
        barcode: primaryBarcode,
        brand: brand || null,
        category: category || "Footwear",
        price: parseFloat(baseSellingPrice) || parseFloat(baseMrp) || 0,
        mrp: parseFloat(baseMrp) || 0,
        buying_price: parseFloat(baseSellingPrice) || null,
        cost_price: parseFloat(baseCostPrice) || null,
        gst_percentage: 12,
        hsn_code: hsnCode || "6403",
        color: selectedColors[0] || null,
        size: selectedSizes[0] || null,
        attributes: {
          gender: gender || null,
          auto_po: autoPo,
          auto_grn: autoGrn,
          total_matrix_variants: activeVariantsList.length,
        },
        supplier: preferredSupplier
          ? {
              vendor_party_id: preferredSupplier,
              vendor_priority: supplierPriority,
              allow_po: autoPo,
              allow_grn: autoGrn,
              approval_required: false,
            }
          : null,
      };

      const createdItem: any = await apiFetchV1("/inventory/", {
        method: "POST",
        body: JSON.stringify(articlePayload),
      });

      // 2. Generate canonical matrix variants if item was created and multiple variants exist
      const itemId = createdItem?.id || createdItem?.item_id;
      if (itemId && selectedColors.length > 0 && selectedSizes.length > 0) {
        try {
          await apiFetchV1(`/universal/items/${itemId}/variants/matrix`, {
            method: "POST",
            body: JSON.stringify({
              dimensions: [
                { dimension_name: "color", values: selectedColors },
                { dimension_name: "size", values: selectedSizes },
              ],
              base_mrp: parseFloat(baseSellingPrice) || parseFloat(baseMrp) || 0,
              base_selling_price: parseFloat(baseSellingPrice) || 0,
              base_cost_price: parseFloat(baseCostPrice) || 0,
              auto_generate_barcodes: true,
            }),
          });
        } catch {
          // If universal matrix endpoint falls back or created variants natively, proceed
        }
      }

      onNotification?.(
        "Article & Variants Created",
        `Article "${name}" (${createdItem?.code || "Allocated"}) saved with ${activeVariantsList.length} variants.`,
        "success"
      );

      onSaved();
      handleClose();
    } catch (err: any) {
      const msg = err?.message || err?.detail || "Failed to create article.";
      setFormError(msg);
      onNotification?.("Creation Failed", msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setName("");
    setSku("");
    setBrand("");
    setFormError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs" onClick={handleClose} />

      {/* Main Drawer Canvas */}
      <div
        style={{ width: "min(940px, calc(100vw - 16px))" }}
        className="fixed inset-y-2 right-2 z-50 flex flex-col bg-white dark:bg-[#1a2234] rounded-2xl shadow-2xl overflow-hidden border border-[#c3c6d6] dark:border-[#434654] font-sans select-none antialiased"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#e2e8f0] dark:border-[#2d3748] shrink-0 bg-[#f8fafc] dark:bg-[#131b2e]">
          <h2 className="text-base font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            New Article / Design
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] dark:hover:bg-[#2d3748] dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Navigation */}
        <div className="flex items-center justify-center px-6 py-3 border-b border-[#e2e8f0] dark:border-[#2d3748] bg-white dark:bg-[#161e30] shrink-0 gap-6">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 1
                  ? "bg-blue-600 text-white"
                  : step > 1
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}
            >
              {step > 1 ? <Check size={12} /> : "1"}
            </span>
            <span
              className={`text-xs font-bold ${
                step === 1 ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Article Identity
            </span>
          </div>

          <span className="w-8 h-[1px] bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 2
                  ? "bg-blue-600 text-white"
                  : step > 2
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}
            >
              {step > 2 ? <Check size={12} /> : "2"}
            </span>
            <span
              className={`text-xs font-bold ${
                step === 2 ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Variants
            </span>
          </div>

          <span className="w-8 h-[1px] bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 3
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}
            >
              3
            </span>
            <span
              className={`text-xs font-bold ${
                step === 3 ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Review
            </span>
          </div>
        </div>

        {/* Panel 10 Error Banner */}
        {formError && (
          <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 px-6 py-2.5 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-600" />
              <div>
                <span className="font-bold">Failed to create article: </span>
                <span>{formError}</span>
              </div>
            </div>
            <button type="button" onClick={() => setFormError(null)} className="hover:text-red-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Step 1: Article Identity ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Section: Article Information */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] mb-3">
                Article Information
              </h3>

              {/* Auto / Manual Toggle */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-2">
                  Article Number
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#0f172a] dark:text-white font-medium">
                    <input
                      type="radio"
                      name="numbering_mode"
                      checked={autoGenerateArticleNumber}
                      onChange={() => setAutoGenerateArticleNumber(true)}
                      className="accent-blue-600 w-3.5 h-3.5"
                    />
                    <span>Auto Generate (Recommended)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#0f172a] dark:text-white font-medium">
                    <input
                      type="radio"
                      name="numbering_mode"
                      checked={!autoGenerateArticleNumber}
                      onChange={() => setAutoGenerateArticleNumber(false)}
                      className="accent-blue-600 w-3.5 h-3.5"
                    />
                    <span>Manual Entry</span>
                  </label>
                </div>
              </div>

              {/* Numbering Preview / Manual Input Box */}
              {autoGenerateArticleNumber ? (
                previewError ? (
                  /* Panel 10 Preview Unavailable Box */
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Preview unavailable</p>
                      <p className="text-[11px] mt-0.5">Please configure ARTICLE number series in Documents setup.</p>
                    </div>
                  </div>
                ) : (
                  /* Panel 3 Active Next Article Number Box */
                  <div className="mb-4 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs flex flex-col justify-center">
                    <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                      Next Article Number (Preview)
                    </span>
                    <span className="font-mono text-base font-bold text-blue-900 dark:text-blue-100 my-0.5">
                      {isLoadingPreview ? "Fetching preview..." : (seriesPreview || "ART/0007/26-27/")}
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400">
                      Series: {seriesId || "SER-ART-COMP001"} (Will be generated on save)
                    </span>
                  </div>
                )
              ) : (
                <div className="mb-4">
                  <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                    Article Number / SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. ART-1001 / FT00123"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Design / Style Name */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                  Design / Style Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Running Shoe Pro"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* 3-Column Attributes: Brand, Category, Gender */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                    Brand <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select Brand</option>
                    {(brandOptions.length > 0 ? brandOptions.map(b => b.name) : ["Nike", "Adidas", "Puma", "Bata", "Woodland", "Relaxo"]).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select Category</option>
                    {(categoryOptions.length > 0 ? categoryOptions.map(c => c.name) : ["Footwear", "Apparel", "Accessories"]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {(genderOptions.length > 0 ? genderOptions.map(g => g.name) : ["Men", "Women", "Unisex", "Kids", "Boys", "Girls"]).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3-Column Financials: HSN, Base MRP, Base Selling Price */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="6403"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                    Base MRP (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={baseMrp}
                    onChange={(e) => setBaseMrp(e.target.value)}
                    placeholder="2999.00"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                    Base Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    value={baseSellingPrice}
                    onChange={(e) => setBaseSellingPrice(e.target.value)}
                    placeholder="2499.00"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Section: Supplier Assignment */}
            <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#2d3748]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] mb-3">
                Supplier Assignment
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                    Preferred Supplier
                  </label>
                  <select
                    value={preferredSupplier}
                    onChange={(e) => setPreferredSupplier(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select Supplier</option>
                    {vendorOptions.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                    Priority
                  </label>
                  <select
                    value={supplierPriority}
                    onChange={(e) => setSupplierPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="PRIMARY">Primary</option>
                    <option value="PREFERRED">Preferred</option>
                    <option value="SECONDARY">Secondary</option>
                  </select>
                </div>

                <div className="space-y-2 pt-3">
                  <label className="flex items-center justify-between cursor-pointer text-xs text-[#374151] dark:text-[#cbd5e1]">
                    <span>Auto PO on Low Stock</span>
                    <input
                      type="checkbox"
                      checked={autoPo}
                      onChange={(e) => setAutoPo(e.target.checked)}
                      className="accent-blue-600 rounded w-3.5 h-3.5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer text-xs text-[#374151] dark:text-[#cbd5e1]">
                    <span>Auto GRN on Receipt</span>
                    <input
                      type="checkbox"
                      checked={autoGrn}
                      onChange={(e) => setAutoGrn(e.target.checked)}
                      className="accent-blue-600 rounded w-3.5 h-3.5"
                    />
                  </label>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── Step 2: Variants (Size × Color Matrix) ────────────────────────── */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-12 gap-6">
            
            {/* Left 7 Columns: Color & Size Matrix Builder */}
            <div className="col-span-12 lg:col-span-7 space-y-5">
              
              {/* Select Colors Chips */}
              <div>
                <label className="text-xs font-bold text-[#0f172a] dark:text-white block mb-2">
                  Select Colors
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {availableColors.map((c) => {
                    const isSelected = selectedColors.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => handleToggleColor(c.name)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          isSelected
                            ? "bg-[#0f172a] text-white dark:bg-white dark:text-[#0f172a] shadow-xs"
                            : "bg-[#f1f5f9] text-[#475569] dark:bg-[#1e293b] dark:text-[#cbd5e1] hover:bg-[#e2e8f0]"
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 ${c.border ? "border border-slate-300" : ""}`}
                          style={{ backgroundColor: c.hex || "#94a3b8" }}
                        />
                        <span>{c.name}</span>
                      </button>
                    );
                  })}

                  {isAddingCustomColor ? (
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Color name"
                        value={newColorInput}
                        onChange={(e) => setNewColorInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomColor();
                          } else if (e.key === "Escape") {
                            setIsAddingCustomColor(false);
                          }
                        }}
                        className="px-2 py-1 text-xs border border-blue-400 rounded-lg outline-none w-28 bg-white dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomColor}
                        className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomColor(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-[#94a3b8] text-xs font-semibold text-[#64748b] hover:border-blue-600 hover:text-blue-600 transition"
                    >
                      <Plus size={12} />
                      <span>Add Color</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Select Sizes Chips */}
              <div>
                <label className="text-xs font-bold text-[#0f172a] dark:text-white block mb-2">
                  Select Sizes
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {availableSizes.map((s) => {
                    const isSelected = selectedSizes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleToggleSize(s)}
                        className={`w-9 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-[#f1f5f9] text-[#475569] dark:bg-[#1e293b] dark:text-[#cbd5e1] hover:bg-[#e2e8f0]"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}

                  {isAddingCustomSize ? (
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Size"
                        value={newSizeInput}
                        onChange={(e) => setNewSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomSize();
                          } else if (e.key === "Escape") {
                            setIsAddingCustomSize(false);
                          }
                        }}
                        className="px-2 py-1 text-xs border border-blue-400 rounded-lg outline-none w-16 bg-white dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSize}
                        className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomSize(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-[#94a3b8] text-xs font-semibold text-[#64748b] hover:border-blue-600 hover:text-blue-600 transition"
                    >
                      <Plus size={12} />
                      <span>Add Size</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2D Variant Matrix Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Variant Matrix Preview
                  </label>
                  <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                    {activeVariantsList.length} variants enabled
                  </span>
                </div>

                <div className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden shadow-xs bg-white dark:bg-[#111827]">
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-[#f8fafc] dark:bg-[#1e293b] border-b border-[#e2e8f0] dark:border-[#374151]">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-[#475569] dark:text-[#cbd5e1]">
                          Color / Size
                        </th>
                        {selectedSizes.map((s) => (
                          <th key={s} className="px-3 py-2 text-center font-bold text-[#475569] dark:text-[#cbd5e1]">
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9] dark:divide-[#2d3748]">
                      {selectedColors.map((color) => (
                        <tr key={color} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-semibold text-[#0f172a] dark:text-white">
                            {color}
                          </td>
                          {selectedSizes.map((size) => {
                            const key = `${color}-${size}`;
                            const isCellActive = activeCellKey === key;
                            const item = variantMatrix[key];
                            const isChecked = item?.enabled ?? false;

                            return (
                              <td
                                key={size}
                                onClick={() => setActiveCellKey(key)}
                                className={`px-3 py-2 text-center cursor-pointer transition ${
                                  isCellActive
                                    ? "bg-blue-50 dark:bg-blue-900/30"
                                    : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleVariantCell(key)}
                                  className="accent-blue-600 rounded w-4 h-4 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right 5 Columns: Variant Details Preview (Panel 4) */}
            <div className="col-span-12 lg:col-span-5 bg-[#f8fafc] dark:bg-[#131b2e] border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] flex items-center justify-between">
                <span>Variant Details (Preview)</span>
                {activeVariant && (
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    {activeVariant.color} / Size {activeVariant.size}
                  </span>
                )}
              </h4>

              {activeVariant ? (
                <>
                  {/* SKU Auto Generated */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                      SKU (Auto)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        value={activeVariant.sku}
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed pr-8"
                      />
                      <Lock size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Primary Barcode */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                      Primary Barcode <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={activeVariant.barcode}
                      onChange={(e) => handleUpdateActiveVariant("barcode", e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Additional Barcodes Chips */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                      Additional Barcodes
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white dark:bg-[#111827] border border-[#cbd5e1] dark:border-[#374151] rounded-lg min-h-[38px]">
                      {activeVariant.secondaryBarcodes.map((bc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-mono border border-blue-200 dark:border-blue-800"
                        >
                          <Tag size={10} />
                          <span>{bc}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSecondaryBarcode(idx)}
                            className="hover:text-red-600 ml-0.5"
                          >
                            ✕
                          </button>
                        </span>
                      ))}

                      {isAddingSecondaryBarcode ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            autoFocus
                            placeholder="EAN / UPC"
                            value={newSecondaryBarcode}
                            onChange={(e) => setNewSecondaryBarcode(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSecondaryBarcode();
                              } else if (e.key === "Escape") {
                                setIsAddingSecondaryBarcode(false);
                              }
                            }}
                            className="px-2 py-0.5 text-[11px] font-mono border border-blue-400 rounded outline-none w-28 bg-white dark:bg-slate-900"
                          />
                          <button
                            type="button"
                            onClick={handleAddSecondaryBarcode}
                            className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold"
                          >
                            Add
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingSecondaryBarcode(true)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed border-[#94a3b8] text-[10px] font-semibold text-[#64748b] hover:border-blue-600 hover:text-blue-600 transition"
                        >
                          <Plus size={10} />
                          <span>Add barcode</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Variant MRP */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                      Variant MRP (₹)
                    </label>
                    <input
                      type="number"
                      value={activeVariant.mrp}
                      onChange={(e) => handleUpdateActiveVariant("mrp", e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Variant Cost */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                      Variant Cost (₹)
                    </label>
                    <input
                      type="number"
                      value={activeVariant.cost}
                      onChange={(e) => handleUpdateActiveVariant("cost", e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Select a variant cell in the matrix to view or edit details.
                </p>
              )}
            </div>

          </div>
        )}

        {/* ── Step 3: Review ───────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              Review &amp; Confirm Article Creation
            </h3>

            {/* Summary Card */}
            <div className="bg-[#f8fafc] dark:bg-[#131b2e] border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[#64748b] block mb-0.5">Article Number</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {autoGenerateArticleNumber ? (seriesPreview || "Auto Allocated") : sku}
                </span>
              </div>
              <div>
                <span className="text-[#64748b] block mb-0.5">Design Name</span>
                <span className="font-bold text-[#0f172a] dark:text-white">{name}</span>
              </div>
              <div>
                <span className="text-[#64748b] block mb-0.5">Brand / Category</span>
                <span className="font-semibold text-[#0f172a] dark:text-white">{brand} / {category}</span>
              </div>
              <div>
                <span className="text-[#64748b] block mb-0.5">Base MRP / Selling</span>
                <span className="font-mono font-bold text-[#0f172a] dark:text-white">₹{baseMrp} / ₹{baseSellingPrice}</span>
              </div>
            </div>

            {/* Variants Summary Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#0f172a] dark:text-white">
                  Variants to be Created ({activeVariantsList.length})
                </span>
              </div>

              <div className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f1f5f9] dark:bg-[#1e293b] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-bold text-[#475569] dark:text-[#cbd5e1]">SKU</th>
                      <th className="px-3 py-2 font-bold text-[#475569] dark:text-[#cbd5e1]">Color</th>
                      <th className="px-3 py-2 font-bold text-[#475569] dark:text-[#cbd5e1]">Size</th>
                      <th className="px-3 py-2 font-bold text-[#475569] dark:text-[#cbd5e1]">Primary Barcode</th>
                      <th className="px-3 py-2 font-bold text-[#475569] dark:text-[#cbd5e1] text-right">MRP (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#2d3748]">
                    {activeVariantsList.map((v, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400">{v.sku}</td>
                        <td className="px-3 py-2 font-medium">{v.color}</td>
                        <td className="px-3 py-2 font-mono font-bold">{v.size}</td>
                        <td className="px-3 py-2 font-mono">{v.barcode}</td>
                        <td className="px-3 py-2 font-mono text-right">{v.mrp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e2e8f0] dark:border-[#2d3748] bg-slate-50 dark:bg-[#131b2e]/60 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-1.5"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            )}

            {step === 1 && mode === "SIMPLE" && (
              <button
                type="button"
                onClick={handleSaveArticle}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                title="Single-screen quick entry: save single article without matrix"
              >
                {isSaving ? "Saving..." : "Quick Save (Simple Mode)"}
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={handleNextToStep2}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <span>{mode === "SIMPLE" ? "Customize Variants" : "Next"}</span>
                <ChevronRight size={14} />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleSaveArticle}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Create Article &amp; All Variants</span>
                  </>
                )}
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleSaveArticle}
                disabled={isSaving}
                className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm &amp; Create Article</span>
                  </>
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
