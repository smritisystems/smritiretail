/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.0
 * Created      : 2026-09-28
 * Modified     : 2026-10-05
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
  Layers,
  Sliders,
  Box,
  DollarSign,
  Percent,
  ShieldCheck,
  Truck,
  ShoppingBag,
  BarChart3,
  Settings,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { fetchGovernedLookupOptions, LookupOption } from "../../services/itemMasterLookupGate.ts";
import {
  ItemMasterValidationError,
  focusFirstError,
  FIELD_TO_ELEMENT_ID,
} from "../../services/itemMasterValidationMapper.ts";

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

const FOOTWEAR_UOMS = [
  { id: "uom_prs", code: "PRS", name: "Pairs (Footwear UQC)" },
  { id: "uom_pair", code: "PAIR", name: "Pair (Legacy Alias)" },
  { id: "uom_pcs", code: "PCS", name: "Pieces" },
  { id: "uom_box", code: "BOX", name: "Box" },
  { id: "uom_set", code: "SET", name: "Set" },
];

const GST_RATES = [
  { rate: "0", label: "0% (Exempt / Nil)" },
  { rate: "5", label: "5% (Footwear MRP ≤ ₹1000)" },
  { rate: "12", label: "12% (Standard Footwear)" },
  { rate: "18", label: "18% (Footwear MRP > ₹1000)" },
  { rate: "28", label: "28% (Luxury / Accessories)" },
];

export const AddProductDrawer: React.FC<AddProductDrawerProps> = ({
  isOpen,
  onClose,
  onSaved,
  onNotification,
  productType = "Footwear",
  mode: initialMode = "HYBRID",
}) => {
  // Active operational mode (Simple, Hybrid, Advanced)
  const [activeMode, setActiveMode] = useState<"SIMPLE" | "HYBRID" | "ADVANCED">(initialMode);

  useEffect(() => {
    if (initialMode) {
      setActiveMode(initialMode);
    }
  }, [initialMode]);

  // Wizard Step: 1 = Article Identity / Policies, 2 = Variants Matrix, 3 = Review
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Form State (Governed: ZERO Silent Hardcoding) ───────────────────────────
  // 1. Basic Information
  const [autoGenerateArticleNumber, setAutoGenerateArticleNumber] = useState(true);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [productTypeItem, setProductTypeItem] = useState("");
  const [heelType, setHeelType] = useState("");
  const [upperMaterial, setUpperMaterial] = useState("");
  const [outsoleMaterial, setOutsoleMaterial] = useState("");
  const [statusVal, setStatusVal] = useState("ACTIVE");

  // Single variant attributes (Simple Mode)
  const [simpleColor, setSimpleColor] = useState("");
  const [simpleSize, setSimpleSize] = useState("");
  const [simpleSizeSystem, setSimpleSizeSystem] = useState("UK");
  const [simpleBarcode, setSimpleBarcode] = useState("");

  // 2. Units & UOM
  const [stockUom, setStockUom] = useState("PRS");
  const [salesUom, setSalesUom] = useState("");
  const [purchaseUom, setPurchaseUom] = useState("");
  const [conversionFactor, setConversionFactor] = useState("1.0");

  // 3. Pricing & Commercial (Zero silent hardcoded values — left blank if unset)
  const [baseMrp, setBaseMrp] = useState("");
  const [baseSellingPrice, setBaseSellingPrice] = useState("");
  const [baseCostPrice, setBaseCostPrice] = useState("");
  const [dealerPrice, setDealerPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [minimumSellingPrice, setMinimumSellingPrice] = useState("");
  const [maximumDiscountPercent, setMaximumDiscountPercent] = useState("0");

  // 4. Statutory Tax Profile (Zero silent hardcoded HSN/GST — user/master input)
  const [hsnCode, setHsnCode] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const [taxCategory, setTaxCategory] = useState("GOODS");
  const [taxInclusive, setTaxInclusive] = useState(true);
  const [taxExempt, setTaxExempt] = useState(false);

  // 5. Inventory Policy (Strict policy only — zero physical stock fields)
  const [minimumStock, setMinimumStock] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [reorderQuantity, setReorderQuantity] = useState("0");
  const [maximumStock, setMaximumStock] = useState("0");
  const [safetyStock, setSafetyStock] = useState("0");
  const [leadTime, setLeadTime] = useState("0");

  // 6. Purchasing / Supplier Assignment
  const [preferredSupplier, setPreferredSupplier] = useState("");
  const [supplierItemCode, setSupplierItemCode] = useState("");
  const [minimumPurchaseQty, setMinimumPurchaseQty] = useState("1");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [supplierPriority, setSupplierPriority] = useState<"PRIMARY" | "PREFERRED" | "SECONDARY">("PRIMARY");
  const [autoPo, setAutoPo] = useState(false);
  const [autoGrn, setAutoGrn] = useState(true);

  // 7. Sales Settings
  const [allowDiscount, setAllowDiscount] = useState(true);
  const [billable, setBillable] = useState(true);

  // 8. Advanced Enterprise Policies
  const [costingMethod, setCostingMethod] = useState<"FIFO" | "WEIGHTED_AVG" | "STANDARD">("FIFO");
  const [glAccount, setGlAccount] = useState("");
  const [externalId, setExternalId] = useState("");

  // Numbering series preview state
  const [seriesPreview, setSeriesPreview] = useState<string | null>(null);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [availableSeries, setAvailableSeries] = useState<any[]>([]);

  // Governed lookups state
  const [brandOptions, setBrandOptions] = useState<LookupOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<LookupOption[]>([]);
  const [genderOptions, setGenderOptions] = useState<LookupOption[]>([]);
  const [productTypeOptions, setProductTypeOptions] = useState<LookupOption[]>([]);
  const [heelTypeOptions, setHeelTypeOptions] = useState<LookupOption[]>([]);
  const [upperMaterialOptions, setUpperMaterialOptions] = useState<LookupOption[]>([]);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);

  // ── Authoritative Backend Article Numbering Preview ─────────────────────────
  useEffect(() => {
    if (!isOpen || !autoGenerateArticleNumber) return;

    let isCancelled = false;
    setIsLoadingPreview(true);
    setPreviewError(false);

    const catParam = category ? encodeURIComponent(category.trim()) : "";
    const url = `/numbering/preview?document_type=ARTICLE${catParam ? `&category=${catParam}` : ""}`;

    apiFetchV1<any>(url)
      .then((res) => {
        if (isCancelled) return;
        if (res && res.isConfigured) {
          if (res.isExhausted) {
            setSeriesPreview(`EXHAUSTED (Range ${res.startNumber ?? ""}-${res.endNumber ?? ""})`);
          } else {
            setSeriesPreview(res.formattedPreview || res.documentNo || null);
          }
          setSeriesId(res.seriesId || null);
          setPreviewError(false);
        } else {
          setSeriesPreview(null);
          setSeriesId(null);
          setPreviewError(true);
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setSeriesPreview(null);
        setSeriesId(null);
        setPreviewError(true);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingPreview(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [category, isOpen, autoGenerateArticleNumber]);

  // Combined Category Choices
  const renderedCategoryOptions = useMemo(() => {
    const lookupCats = categoryOptions.map((c) => c.name.trim());
    const seriesCats = availableSeries
      .filter((s: any) => (s.documentType === "ARTICLE" || s.document_type === "ARTICLE") && s.category)
      .map((s: any) => String(s.category).trim());
    return Array.from(new Set([...lookupCats, ...seriesCats])).filter(Boolean);
  }, [categoryOptions, availableSeries]);

  // ── Step 2 Matrix State (Hybrid & Advanced Modes) ──────────────────────────
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
  const [validationSummary, setValidationSummary] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldErrorOrder, setFieldErrorOrder] = useState<string[]>([]);

  const clearValidationState = () => {
    setFormError(null);
    setValidationSummary(null);
    setFieldErrors({});
    setFieldErrorOrder([]);
  };

  // Fetch Governed Lookups
  const loadGovernedLookups = useCallback(async () => {
    try {
      const [lookups, vendorsRes, seriesRes] = await Promise.all([
        fetchGovernedLookupOptions(),
        apiFetchV1<any>("/universal/parties/vendors?limit=100").catch(() => []),
        apiFetchV1<any>("/numbering/series").catch(() => []),
      ]);

      setBrandOptions(lookups.brand || []);
      setCategoryOptions(lookups.category || []);
      setGenderOptions(lookups.gender || []);
      setProductTypeOptions(lookups.product_type || []);
      setHeelTypeOptions(lookups.heel_type || []);
      setUpperMaterialOptions(lookups.upper_material || []);

      if (Array.isArray(vendorsRes)) {
        setVendorOptions(vendorsRes.map((v: any) => ({ id: v.id, code: v.code || v.vendor_code, name: v.name })));
      } else if (vendorsRes?.items) {
        setVendorOptions(vendorsRes.items.map((v: any) => ({ id: v.id, code: v.code || v.vendor_code, name: v.name })));
      }

      if (Array.isArray(seriesRes)) {
        setAvailableSeries(seriesRes);
      }
    } catch {
      // Governed lookup defaults gracefully retain empty sets
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadGovernedLookups();
    }
  }, [isOpen, loadGovernedLookups]);

  // Sync Matrix variants when dimensions change
  useEffect(() => {
    if (activeMode === "SIMPLE") return;

    setVariantMatrix((prev) => {
      const next: Record<string, MatrixVariantItem> = {};
      for (const color of selectedColors) {
        for (const size of selectedSizes) {
          const key = `${color}-${size}`;
          if (prev[key]) {
            next[key] = prev[key];
          } else {
            // Generate variant SKU strictly according to business identity
            const baseSku = autoGenerateArticleNumber ? (seriesPreview || "ART") : (sku || "ART");
            const varSku = `${baseSku}-${color.toUpperCase().slice(0, 3)}-${size}`.toUpperCase();

            next[key] = {
              color,
              size,
              enabled: true,
              sku: varSku,
              barcode: "", // User must enter or scan official barcode; never generate synthetic!
              secondaryBarcodes: [],
              mrp: baseMrp || "",
              cost: baseCostPrice || "",
            };
          }
        }
      }
      return next;
    });

    if (selectedColors.length > 0 && selectedSizes.length > 0) {
      const currentExists = selectedColors.some((c) =>
        selectedSizes.some((s) => `${c}-${s}` === activeCellKey)
      );
      if (!currentExists) {
        setActiveCellKey(`${selectedColors[0]}-${selectedSizes[0]}`);
      }
    }
  }, [selectedColors, selectedSizes, activeCellKey, autoGenerateArticleNumber, seriesPreview, sku, baseMrp, baseCostPrice, activeMode]);

  // Toggle Color
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

  // Toggle Size
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

  // Update active variant field
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

  // Add secondary barcode
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

  const activeVariant = variantMatrix[activeCellKey] || null;
  const activeVariantsList = useMemo(() => {
    return Object.values(variantMatrix).filter((v) => v.enabled);
  }, [variantMatrix]);

  // ── Step Navigation & Validation ──
  const handleNextToStep2 = () => {
    clearValidationState();
    if (!name.trim()) {
      setFormError("Product Name is required.");
      return;
    }
    if (!autoGenerateArticleNumber && !sku.trim()) {
      setFormError("SKU / Article Number is required when manual entry is selected.");
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
    if (baseSellingPrice && baseMrp && parseFloat(baseSellingPrice) > parseFloat(baseMrp)) {
      setFormError("Selling Price cannot exceed Retail Price (MRP).");
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

  // ── Canonical Save Execution (Zero Silent Hardcoding) ───────────────────────
  const handleSaveArticle = async () => {
    setIsSaving(true);
    clearValidationState();

    try {
      const parsedMrp = baseMrp ? parseFloat(baseMrp) : 0.0;
      const parsedSelling = baseSellingPrice ? parseFloat(baseSellingPrice) : parsedMrp;
      const parsedCost = baseCostPrice ? parseFloat(baseCostPrice) : 0.0;
      const parsedGst = gstRate ? parseFloat(gstRate) : 0.0;

      // In Simple Mode: Barcode is user input only. Never synthetic!
      const primaryBarcode = activeMode === "SIMPLE"
        ? (simpleBarcode.trim() || null)
        : (activeVariant?.barcode.trim() || null);

      const articlePayload = {
        name: name.trim(),
        code: autoGenerateArticleNumber ? "AUTO" : sku.trim(),
        auto_generate_article_number: autoGenerateArticleNumber,
        barcode: primaryBarcode,
        brand: brand.trim() || null,
        category: category.trim() || null,
        gender: gender || null,
        product_type: productTypeItem || null,
        heel_type: heelType || null,
        upper_material: upperMaterial || null,
        outsole_material: outsoleMaterial || null,
        price: parsedSelling,
        mrp: parsedMrp,
        selling_price: parsedSelling,
        cost_price: parsedCost,
        gst_percentage: parsedGst,
        tax_rate: parsedGst,
        hsn_code: hsnCode.trim() || null,
        primary_uom: stockUom || "PRS",
        status: statusVal,
        color: activeMode === "SIMPLE" ? (simpleColor.trim() || null) : (selectedColors[0] || null),
        size: activeMode === "SIMPLE" ? (simpleSize.trim() || null) : (selectedSizes[0] || null),

        // Phase 2: Authoritative Domain Extension Payloads
        uom: {
          stock_uom_id: stockUom || "PRS",
          sales_uom_id: salesUom.trim() || null,
          purchase_uom_id: purchaseUom.trim() || null,
          conversion_factor: conversionFactor ? parseFloat(conversionFactor) : 1.0,
        },
        pricing: {
          mrp: parsedMrp,
          selling_price: parsedSelling,
          cost_price: parsedCost,
          dealer_price: dealerPrice ? parseFloat(dealerPrice) : null,
          wholesale_price: wholesalePrice ? parseFloat(wholesalePrice) : null,
          minimum_selling_price: minimumSellingPrice ? parseFloat(minimumSellingPrice) : null,
          maximum_discount_percent: maximumDiscountPercent ? parseFloat(maximumDiscountPercent) : 0.0,
          currency: "INR",
          is_active: statusVal === "ACTIVE",
        },
        tax: {
          hsn_sac_code: hsnCode.trim() || null,
          gst_rate: parsedGst,
          tax_category: taxCategory || null,
          tax_inclusive: taxInclusive,
          tax_exempt: taxExempt,
        },
        purchasing: preferredSupplier ? {
          preferred_supplier_id: preferredSupplier,
          supplier_item_code: supplierItemCode.trim() || null,
          purchase_uom_id: purchaseUom.trim() || null,
          minimum_purchase_qty: minimumPurchaseQty ? parseFloat(minimumPurchaseQty) : 1.0,
          purchase_cost: purchaseCost ? parseFloat(purchaseCost) : null,
          purchase_lead_time: leadTime ? parseInt(leadTime) : 0,
          is_active: true,
        } : null,
        sales: {
          sales_uom_id: salesUom.trim() || null,
          selling_price: parsedSelling,
          mrp: parsedMrp,
          wholesale_price: wholesalePrice ? parseFloat(wholesalePrice) : null,
          minimum_selling_price: minimumSellingPrice ? parseFloat(minimumSellingPrice) : null,
          maximum_discount_percent: maximumDiscountPercent ? parseFloat(maximumDiscountPercent) : 0.0,
          allow_discount: allowDiscount,
          billable: billable,
        },
        inventory_policy: {
          minimum_stock: minimumStock ? parseFloat(minimumStock) : 0.0,
          reorder_level: reorderLevel ? parseFloat(reorderLevel) : 0.0,
          reorder_quantity: reorderQuantity ? parseFloat(reorderQuantity) : 0.0,
          maximum_stock: maximumStock ? parseFloat(maximumStock) : 0.0,
          safety_stock: safetyStock ? parseFloat(safetyStock) : 0.0,
          lead_time: leadTime ? parseInt(leadTime) : 0,
          preferred_supplier_id: preferredSupplier || null,
        },
        attributes: {
          gender: gender || null,
          product_type: productTypeItem || null,
          heel_type: heelType || null,
          upper_material: upperMaterial || null,
          outsole_material: outsoleMaterial || null,
          auto_po: autoPo,
          auto_grn: autoGrn,
          total_matrix_variants: activeMode === "SIMPLE" ? 1 : activeVariantsList.length,
          costing_method: costingMethod,
          gl_account: glAccount,
          external_id: externalId,
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

      // In Hybrid / Advanced Mode, generate matrix variants if multiple variants enabled
      const itemId = createdItem?.id || createdItem?.item_id;
      if (activeMode !== "SIMPLE" && itemId && selectedColors.length > 0 && selectedSizes.length > 0) {
        try {
          await apiFetchV1(`/universal/items/${itemId}/variants/matrix`, {
            method: "POST",
            body: JSON.stringify({
              dimensions: [
                { dimension_name: "color", values: selectedColors },
                { dimension_name: "size", values: selectedSizes },
              ],
              base_mrp: parsedMrp,
              base_selling_price: parsedSelling,
              base_cost_price: parsedCost,
              auto_generate_barcodes: false, // Invariant: No synthetic barcodes!
            }),
          });
        } catch {
          // Handled gracefully if universal items matrix adapter is active
        }
      }

      onNotification?.(
        "Item Saved",
        `Item "${name}" saved successfully in ${activeMode} mode.`,
        "success"
      );

      onSaved();
      handleClose();
    } catch (err: unknown) {
      if (err instanceof ItemMasterValidationError) {
        const result = err.validation;
        setFieldErrors(result.fieldErrors);
        setFieldErrorOrder(result.fieldOrder);
        setValidationSummary(result.summary);
        setTimeout(() => focusFirstError(result.fieldOrder), 50);
        onNotification?.("Validation Error", result.summary, "error");
      } else {
        const msg = (err as Error)?.message || "Failed to save item.";
        setFormError(msg);
        onNotification?.("Creation Failed", msg, "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setName("");
    setSku("");
    setBrand("");
    setCategory("");
    setBaseMrp("");
    setBaseSellingPrice("");
    setBaseCostPrice("");
    setHsnCode("");
    clearValidationState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs" onClick={handleClose} />

      {/* Main Drawer Canvas */}
      <div
        style={{ width: "min(960px, calc(100vw - 16px))" }}
        className="fixed inset-y-2 right-2 z-50 flex flex-col bg-white dark:bg-[#1a2234] rounded-2xl shadow-2xl overflow-hidden border border-[#c3c6d6] dark:border-[#434654] font-sans select-none antialiased"
      >
        {/* Header with Mode Switcher */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#e2e8f0] dark:border-[#2d3748] shrink-0 bg-[#f8fafc] dark:bg-[#131b2e]">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
              <span>Add Product / Item</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wide">
                {activeMode} Mode
              </span>
            </h2>

            {/* Mode Selector Buttons */}
            <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setActiveMode("SIMPLE")}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeMode === "SIMPLE"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("HYBRID")}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeMode === "HYBRID"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Hybrid
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("ADVANCED")}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeMode === "ADVANCED"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Advanced
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] dark:hover:bg-[#2d3748] dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Navigation (Only shown for Hybrid & Advanced modes) */}
        {activeMode !== "SIMPLE" && (
          <div className="flex items-center justify-center px-6 py-2.5 border-b border-[#e2e8f0] dark:border-[#2d3748] bg-white dark:bg-[#161e30] shrink-0 gap-6">
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
              <span className={`text-xs font-bold ${step === 1 ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"}`}>
                Article &amp; Policies
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
              <span className={`text-xs font-bold ${step === 2 ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"}`}>
                Variant Matrix
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
              <span className={`text-xs font-bold ${step === 3 ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"}`}>
                Review
              </span>
            </div>
          </div>
        )}

        {/* Validation Summary Banner */}
        {validationSummary && (
          <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 px-6 py-2.5 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-600" />
              <span className="font-bold">{validationSummary}</span>
            </div>
            <button type="button" onClick={() => setValidationSummary(null)} className="hover:text-red-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Plain Error Banner */}
        {formError && (
          <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 px-6 py-2.5 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-600" />
              <span className="font-bold">{formError}</span>
            </div>
            <button type="button" onClick={() => setFormError(null)} className="hover:text-red-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MODE 1: SIMPLE MODE FORM                                            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeMode === "SIMPLE" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. BASIC INFORMATION */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Box size={14} className="text-blue-600" />
                <span>1. Basic Product Identity</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="im-field-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mens Running Shoes Aero 10"
                    className={`w-full text-xs px-3 py-2 rounded-lg border bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500 ${
                      fieldErrors["name"] || fieldErrors["item_name"] ? "border-red-500 ring-1 ring-red-500" : "border-slate-300 dark:border-slate-700"
                    }`}
                  />
                  {(fieldErrors["name"] || fieldErrors["item_name"]) && (
                    <p className="text-[10px] text-red-500 mt-1">{fieldErrors["name"] || fieldErrors["item_name"]}</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Brand <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="im-field-brand"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Brand name"
                    list="brand-options-list"
                    className={`w-full text-xs px-3 py-2 rounded-lg border bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500 ${
                      fieldErrors["brand"] ? "border-red-500 ring-1 ring-red-500" : "border-slate-300 dark:border-slate-700"
                    }`}
                  />
                  <datalist id="brand-options-list">
                    {brandOptions.map((b) => <option key={b.code} value={b.name} />)}
                  </datalist>
                  {fieldErrors["brand"] && <p className="text-[10px] text-red-500 mt-1">{fieldErrors["brand"]}</p>}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="im-field-category"
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Category"
                    list="category-options-list"
                    className={`w-full text-xs px-3 py-2 rounded-lg border bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500 ${
                      fieldErrors["category"] ? "border-red-500 ring-1 ring-red-500" : "border-slate-300 dark:border-slate-700"
                    }`}
                  />
                  <datalist id="category-options-list">
                    {renderedCategoryOptions.map((c) => <option key={c} value={c} />)}
                  </datalist>
                  {fieldErrors["category"] && <p className="text-[10px] text-red-500 mt-1">{fieldErrors["category"]}</p>}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Article / Design Code
                  </label>
                  <input
                    id="im-field-code"
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Optional design code"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Colour / Shade
                  </label>
                  <input
                    id="im-field-color"
                    type="text"
                    value={simpleColor}
                    onChange={(e) => setSimpleColor(e.target.value)}
                    placeholder="e.g. Black, Navy, Brown"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Size System
                  </label>
                  <select
                    id="im-field-size_system"
                    value={simpleSizeSystem}
                    onChange={(e) => setSimpleSizeSystem(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UK">UK Size System</option>
                    <option value="EU">EU Size System</option>
                    <option value="US">US Size System</option>
                    <option value="IND">India Size System</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Size
                  </label>
                  <input
                    id="im-field-size"
                    type="text"
                    value={simpleSize}
                    onChange={(e) => setSimpleSize(e.target.value)}
                    placeholder="e.g. 7, 8, 9, 10"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. IDENTITY & BARCODE */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Tag size={14} className="text-indigo-600" />
                <span>2. Identity &amp; Barcode</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Primary Barcode
                  </label>
                  <input
                    id="im-field-barcode"
                    type="text"
                    value={simpleBarcode}
                    onChange={(e) => setSimpleBarcode(e.target.value.toUpperCase())}
                    placeholder="Scan or enter manufacturer barcode"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Leave blank if no official barcode exists (no synthetic barcodes will be created).</p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Stock UOM <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="im-field-stock_uom"
                    value={stockUom}
                    onChange={(e) => setStockUom(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    {FOOTWEAR_UOMS.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.code} — {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. COMMERCIAL PRICING */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <DollarSign size={14} className="text-emerald-600" />
                <span>3. Pricing &amp; Commercial</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Retail Price (MRP ₹)
                  </label>
                  <input
                    id="im-field-mrp"
                    type="number"
                    step="0.01"
                    value={baseMrp}
                    onChange={(e) => setBaseMrp(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    id="im-field-selling_price"
                    type="number"
                    step="0.01"
                    value={baseSellingPrice}
                    onChange={(e) => setBaseSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 4. STATUTORY TAX */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Percent size={14} className="text-amber-600" />
                <span>4. Statutory Tax Profile</span>
              </h3>

              <div className="grid grid-cols-3 gap-4 items-center">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    HSN/SAC Code
                  </label>
                  <input
                    id="im-field-hsn_code"
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="e.g. 6403, 6404"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    GST Rate %
                  </label>
                  <select
                    id="im-field-gst_rate"
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    {GST_RATES.map((g) => (
                      <option key={g.rate} value={g.rate}>{g.label}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-5 flex items-center gap-2">
                  <input
                    id="im-field-tax_inclusive"
                    type="checkbox"
                    checked={taxInclusive}
                    onChange={(e) => setTaxInclusive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm"
                  />
                  <label htmlFor="im-field-tax_inclusive" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Prices are Tax-Inclusive
                  </label>
                </div>
              </div>
            </div>

            {/* 5. STATUS */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Item Status</span>
                <span className="text-[11px] text-slate-500">Draft items are preserved without blocking readiness rules.</span>
              </div>
              <select
                value={statusVal}
                onChange={(e) => setStatusVal(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white font-semibold"
              >
                <option value="ACTIVE">ACTIVE (Ready for Sale)</option>
                <option value="DRAFT">DRAFT (Work in progress)</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MODE 2 & 3: HYBRID & ADVANCED STEP 1: IDENTITY & POLICIES           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeMode !== "SIMPLE" && step === 1 && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Section 1: Basic Information */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Box size={14} className="text-blue-600" />
                <span>1. Article &amp; Style Identity</span>
              </h3>

              {/* Auto / Manual Toggle */}
              <div className="mb-2">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">
                  Article Numbering Mode
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-900 dark:text-white font-medium">
                    <input
                      type="radio"
                      name="numbering_mode"
                      checked={autoGenerateArticleNumber}
                      onChange={() => setAutoGenerateArticleNumber(true)}
                      className="accent-blue-600 w-3.5 h-3.5"
                    />
                    <span>Auto Generate (Recommended)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-900 dark:text-white font-medium">
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

              {autoGenerateArticleNumber ? (
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs">
                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 block">
                    Next Article Number (Preview)
                  </span>
                  <span className="font-mono text-base font-bold text-blue-900 dark:text-blue-100 my-0.5 block">
                    {isLoadingPreview ? "Fetching preview..." : (seriesPreview || "Allocated upon save")}
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">
                    {seriesId ? `Series: ${seriesId} (Allocated on save)` : "Governed numbering series active"}
                  </span>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Article Number / SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="im-field-code"
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    placeholder="e.g. ART-501"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Design / Style Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="im-field-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mens Derby Formal Leather Shoes"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Brand <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="im-field-brand"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Brand name"
                    list="hybrid-brand-list"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="hybrid-brand-list">
                    {brandOptions.map((b) => <option key={b.code} value={b.name} />)}
                  </datalist>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="im-field-category"
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Category"
                    list="hybrid-category-list"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="hybrid-category-list">
                    {renderedCategoryOptions.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Gender
                  </label>
                  <select
                    id="im-field-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Gender</option>
                    {genderOptions.map((g) => <option key={g.code} value={g.name}>{g.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Product Type
                  </label>
                  <select
                    id="im-field-product_type"
                    value={productTypeItem}
                    onChange={(e) => setProductTypeItem(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Product Type</option>
                    {productTypeOptions.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Units & UOM */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Layers size={14} className="text-teal-600" />
                <span>2. Units of Measurement (UOM)</span>
              </h3>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Stock UOM (Inventory Truth) <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="im-field-stock_uom"
                    value={stockUom}
                    onChange={(e) => setStockUom(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white font-semibold"
                  >
                    {FOOTWEAR_UOMS.map((u) => (
                      <option key={u.code} value={u.code}>{u.code} — {u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Sales UOM (Optional)
                  </label>
                  <select
                    id="im-field-sales_uom"
                    value={salesUom}
                    onChange={(e) => setSalesUom(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  >
                    <option value="">Same as Stock UOM</option>
                    {FOOTWEAR_UOMS.map((u) => (
                      <option key={u.code} value={u.code}>{u.code}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Purchase UOM (Optional)
                  </label>
                  <select
                    id="im-field-purchase_uom"
                    value={purchaseUom}
                    onChange={(e) => setPurchaseUom(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  >
                    <option value="">Same as Stock UOM</option>
                    {FOOTWEAR_UOMS.map((u) => (
                      <option key={u.code} value={u.code}>{u.code}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Conversion Factor
                  </label>
                  <input
                    id="im-field-conversion_factor"
                    type="number"
                    step="0.0001"
                    value={conversionFactor}
                    onChange={(e) => setConversionFactor(e.target.value)}
                    placeholder="1.0"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Commercial Pricing Policy */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <DollarSign size={14} className="text-emerald-600" />
                <span>3. Pricing &amp; Commercial</span>
              </h3>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Base MRP (₹)
                  </label>
                  <input
                    id="im-field-mrp"
                    type="number"
                    step="0.01"
                    value={baseMrp}
                    onChange={(e) => setBaseMrp(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Base Selling Price (₹)
                  </label>
                  <input
                    id="im-field-selling_price"
                    type="number"
                    step="0.01"
                    value={baseSellingPrice}
                    onChange={(e) => setBaseSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Base Cost Price (₹)
                  </label>
                  <input
                    id="im-field-cost_price"
                    type="number"
                    step="0.01"
                    value={baseCostPrice}
                    onChange={(e) => setBaseCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Min Selling Price (₹)
                  </label>
                  <input
                    id="im-field-minimum_selling_price"
                    type="number"
                    step="0.01"
                    value={minimumSellingPrice}
                    onChange={(e) => setMinimumSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Dealer Price (₹)
                  </label>
                  <input
                    id="im-field-dealer_price"
                    type="number"
                    step="0.01"
                    value={dealerPrice}
                    onChange={(e) => setDealerPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Wholesale Price (₹)
                  </label>
                  <input
                    id="im-field-wholesale_price"
                    type="number"
                    step="0.01"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Max Discount %
                  </label>
                  <input
                    id="im-field-maximum_discount_percent"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={maximumDiscountPercent}
                    onChange={(e) => setMaximumDiscountPercent(e.target.value)}
                    placeholder="0"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-5 flex items-center gap-2">
                  <input
                    id="im-field-allow_discount"
                    type="checkbox"
                    checked={allowDiscount}
                    onChange={(e) => setAllowDiscount(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm"
                  />
                  <label htmlFor="im-field-allow_discount" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Discounts Permitted
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Statutory Tax Profile */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Percent size={14} className="text-amber-600" />
                <span>4. Statutory Tax Profile</span>
              </h3>

              <div className="grid grid-cols-4 gap-4 items-center">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    HSN/SAC Code
                  </label>
                  <input
                    id="im-field-hsn_code"
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="Enter official HSN"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    GST Rate %
                  </label>
                  <select
                    id="im-field-gst_rate"
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  >
                    {GST_RATES.map((g) => <option key={g.rate} value={g.rate}>{g.label}</option>)}
                  </select>
                </div>

                <div className="pt-5 flex items-center gap-2">
                  <input
                    id="im-field-tax_inclusive"
                    type="checkbox"
                    checked={taxInclusive}
                    onChange={(e) => setTaxInclusive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm"
                  />
                  <label htmlFor="im-field-tax_inclusive" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Tax Inclusive
                  </label>
                </div>

                <div className="pt-5 flex items-center gap-2">
                  <input
                    id="im-field-tax_exempt"
                    type="checkbox"
                    checked={taxExempt}
                    onChange={(e) => setTaxExempt(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm"
                  />
                  <label htmlFor="im-field-tax_exempt" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Tax Exempt (Zero Rated)
                  </label>
                </div>
              </div>
            </div>

            {/* Section 5: Inventory Replenishment Policy (Strict Policy Only) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <BarChart3 size={14} className="text-purple-600" />
                <span>5. Replenishment &amp; Inventory Policy (Policy Only)</span>
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Minimum Stock (Reorder Buffer)
                  </label>
                  <input
                    id="im-field-minimum_stock"
                    type="number"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(e.target.value)}
                    placeholder="0"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Reorder Trigger Level
                  </label>
                  <input
                    id="im-field-reorder_level"
                    type="number"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    placeholder="0"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Reorder Standard Quantity
                  </label>
                  <input
                    id="im-field-reorder_quantity"
                    type="number"
                    value={reorderQuantity}
                    onChange={(e) => setReorderQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Maximum Stock Cap
                  </label>
                  <input
                    id="im-field-maximum_stock"
                    type="number"
                    value={maximumStock}
                    onChange={(e) => setMaximumStock(e.target.value)}
                    placeholder="0"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Safety Stock
                  </label>
                  <input
                    id="im-field-safety_stock"
                    type="number"
                    value={safetyStock}
                    onChange={(e) => setSafetyStock(e.target.value)}
                    placeholder="0"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Procurement Lead Time (Days)
                  </label>
                  <input
                    id="im-field-lead_time"
                    type="number"
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    placeholder="0"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Section 6: Purchasing & Supplier Settings */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Truck size={14} className="text-blue-600" />
                <span>6. Purchasing &amp; Supplier Assignment</span>
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Preferred Supplier
                  </label>
                  <select
                    id="im-field-preferred_supplier_id"
                    value={preferredSupplier}
                    onChange={(e) => setPreferredSupplier(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  >
                    <option value="">None / Open Market</option>
                    {vendorOptions.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.code})</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Supplier Article / Item Code
                  </label>
                  <input
                    id="im-field-supplier_item_code"
                    type="text"
                    value={supplierItemCode}
                    onChange={(e) => setSupplierItemCode(e.target.value)}
                    placeholder="Vendor's catalog code"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Min Order Quantity (MOQ)
                  </label>
                  <input
                    id="im-field-minimum_purchase_qty"
                    type="number"
                    value={minimumPurchaseQty}
                    onChange={(e) => setMinimumPurchaseQty(e.target.value)}
                    placeholder="1"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Section 7: Product Attributes */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Sliders size={14} className="text-cyan-600" />
                <span>7. Footwear Technical Attributes</span>
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Heel Type
                  </label>
                  <select
                    value={heelType}
                    onChange={(e) => setHeelType(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  >
                    <option value="">None / Flat</option>
                    {heelTypeOptions.map((h) => <option key={h.code} value={h.name}>{h.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Upper Material
                  </label>
                  <select
                    value={upperMaterial}
                    onChange={(e) => setUpperMaterial(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  >
                    <option value="">Select Material</option>
                    {upperMaterialOptions.map((u) => <option key={u.code} value={u.name}>{u.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Outsole Material
                  </label>
                  <input
                    type="text"
                    value={outsoleMaterial}
                    onChange={(e) => setOutsoleMaterial(e.target.value)}
                    placeholder="e.g. TPR, Rubber, PU"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Section 8: Advanced Mode Policies (Only rendered in ADVANCED mode) */}
            {activeMode === "ADVANCED" && (
              <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                  <Settings size={14} className="text-indigo-600" />
                  <span>8. Advanced Enterprise Integration &amp; Costing</span>
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Inventory Costing Method
                    </label>
                    <select
                      value={costingMethod}
                      onChange={(e) => setCostingMethod(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white font-medium"
                    >
                      <option value="FIFO">FIFO (First-In, First-Out)</option>
                      <option value="WEIGHTED_AVG">Weighted Moving Average</option>
                      <option value="STANDARD">Standard Fixed Cost</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      GL Inventory Account Code
                    </label>
                    <input
                      type="text"
                      value={glAccount}
                      onChange={(e) => setGlAccount(e.target.value)}
                      placeholder="e.g. 1400-FINISHED-GOODS"
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      External ERP Reference ID
                    </label>
                    <input
                      type="text"
                      value={externalId}
                      onChange={(e) => setExternalId(e.target.value)}
                      placeholder="e.g. SAP-ITM-88902"
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MODE 2 & 3: STEP 2: MATRIX GENERATOR (HYBRID & ADVANCED)            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeMode !== "SIMPLE" && step === 2 && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Color Selector Chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Colour Palette</span>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomColor(true)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus size={12} /> Add Custom Colour
                </button>
              </div>

              {isAddingCustomColor && (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={newColorInput}
                    onChange={(e) => setNewColorInput(e.target.value)}
                    placeholder="Colour name (e.g. Olive)"
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomColor}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomColor(false)}
                    className="text-xs px-2 py-1.5 text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div id="im-field-color" tabIndex={-1} className="flex flex-wrap gap-2 outline-hidden">
                {availableColors.map((c) => {
                  const isSelected = selectedColors.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handleToggleColor(c.name)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium border flex items-center gap-2 transition ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs"
                          : "bg-white dark:bg-[#1a2234] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                      <span>{c.name}</span>
                      {isSelected && <Check size={12} className="text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size Selector Chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sizes (UK Standard)</span>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomSize(true)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus size={12} /> Add Custom Size
                </button>
              </div>

              {isAddingCustomSize && (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={newSizeInput}
                    onChange={(e) => setNewSizeInput(e.target.value)}
                    placeholder="Size (e.g. 12)"
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSize}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomSize(false)}
                    className="text-xs px-2 py-1.5 text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div id="im-field-size" tabIndex={-1} className="flex flex-wrap gap-2 outline-hidden">
                {availableSizes.map((s) => {
                  const isSelected = selectedSizes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleToggleSize(s)}
                      className={`text-xs w-10 h-9 rounded-lg font-bold border flex items-center justify-center transition ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                          : "bg-white dark:bg-[#1a2234] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Matrix Variant Grid & Details */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Matrix Cells ({activeVariantsList.length} enabled)
                </span>
                <span className="text-[11px] text-slate-500">
                  Click a cell to configure its barcode and pricing.
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(variantMatrix).map(([key, v]) => {
                  const isActive = key === activeCellKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveCellKey(key)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition flex items-center gap-2 ${
                        isActive
                          ? "ring-2 ring-blue-500 bg-white dark:bg-[#1a2234] border-blue-500 text-blue-600 font-bold"
                          : v.enabled
                          ? "bg-white dark:bg-[#1a2234] border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                          : "bg-slate-100 dark:bg-slate-800/40 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 opacity-60"
                      }`}
                    >
                      <span>{v.color} / {v.size}</span>
                      <input
                        type="checkbox"
                        checked={v.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleVariantCell(key);
                        }}
                        className="w-3.5 h-3.5 text-blue-600 rounded-sm"
                      />
                    </button>
                  );
                })}
              </div>

              {activeVariant && (
                <div className="p-4 rounded-xl bg-white dark:bg-[#1a2234] border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Variant Configuration: {activeVariant.color} / Size {activeVariant.size}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      SKU: {activeVariant.sku}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Primary Barcode
                      </label>
                      <input
                        type="text"
                        value={activeVariant.barcode}
                        onChange={(e) => handleUpdateActiveVariant("barcode", e.target.value.toUpperCase())}
                        placeholder="Scan or enter barcode"
                        className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Variant MRP (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={activeVariant.mrp}
                        onChange={(e) => handleUpdateActiveVariant("mrp", e.target.value)}
                        placeholder={baseMrp || "0.00"}
                        className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Variant Cost (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={activeVariant.cost}
                        onChange={(e) => handleUpdateActiveVariant("cost", e.target.value)}
                        placeholder={baseCostPrice || "0.00"}
                        className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Multi-Barcodes on active variant */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Additional Optical Barcodes ({activeVariant.secondaryBarcodes.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingSecondaryBarcode(true)}
                        className="text-[10px] text-blue-600 font-semibold hover:underline"
                      >
                        + Add Barcode
                      </button>
                    </div>

                    {isAddingSecondaryBarcode && (
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={newSecondaryBarcode}
                          onChange={(e) => setNewSecondaryBarcode(e.target.value)}
                          placeholder="Scan secondary barcode"
                          className="text-xs font-mono px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={handleAddSecondaryBarcode}
                          className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded font-medium"
                        >
                          Attach
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingSecondaryBarcode(false)}
                          className="text-xs px-2 py-1 text-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {activeVariant.secondaryBarcodes.map((b, idx) => (
                        <span
                          key={b}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                        >
                          <span>{b}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSecondaryBarcode(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MODE 2 & 3: STEP 3: REVIEW & SUMMARY                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeMode !== "SIMPLE" && step === 3 && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Article Specification Summary
              </h3>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 py-1">
                  <span className="text-slate-500">Article / Item Name:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 py-1">
                  <span className="text-slate-500">Brand / Category:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{brand} / {category}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 py-1">
                  <span className="text-slate-500">Base Retail MRP:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{baseMrp ? `₹${baseMrp}` : "—"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 py-1">
                  <span className="text-slate-500">Base Selling Price:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{baseSellingPrice ? `₹${baseSellingPrice}` : "—"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 py-1">
                  <span className="text-slate-500">Stock UOM:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{stockUom} (Pairs)</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 py-1">
                  <span className="text-slate-500">Statutory GST / HSN:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{gstRate}% / {hsnCode || "Pending"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 py-1">
                  <span className="text-slate-500">Total Variants:</span>
                  <span className="font-semibold text-blue-600">{activeVariantsList.length} physical variants</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 py-1">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-semibold text-emerald-600">{statusVal}</span>
                </div>
              </div>
            </div>

            {/* Variants table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-2.5">Variant SKU</th>
                    <th className="px-4 py-2.5">Colour</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5">Barcode</th>
                    <th className="px-4 py-2.5">MRP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {activeVariantsList.map((v) => (
                    <tr key={`${v.color}-${v.size}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="px-4 py-2 font-bold text-slate-900 dark:text-white">{v.sku}</td>
                      <td className="px-4 py-2 font-sans">{v.color}</td>
                      <td className="px-4 py-2 font-sans">{v.size}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{v.barcode || "—"}</td>
                      <td className="px-4 py-2 font-semibold">{v.mrp ? `₹${v.mrp}` : (baseMrp ? `₹${baseMrp}` : "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* FOOTER ACTIONS                                                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="px-6 py-3.5 border-t border-[#e2e8f0] dark:border-[#2d3748] bg-[#f8fafc] dark:bg-[#131b2e] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {/* Simple Mode Save */}
            {activeMode === "SIMPLE" && (
              <button
                type="button"
                onClick={handleSaveArticle}
                disabled={isSaving}
                className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Article...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Save Article</span>
                  </>
                )}
              </button>
            )}

            {/* Hybrid / Advanced Navigation */}
            {activeMode !== "SIMPLE" && step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            )}

            {activeMode !== "SIMPLE" && step === 1 && (
              <button
                type="button"
                onClick={handleNextToStep2}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <span>Next: Variant Matrix</span>
                <ChevronRight size={14} />
              </button>
            )}

            {activeMode !== "SIMPLE" && step === 2 && (
              <button
                type="button"
                onClick={handleNextToStep3}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <span>Review Variants ({activeVariantsList.length})</span>
                <ChevronRight size={14} />
              </button>
            )}

            {activeMode !== "SIMPLE" && step === 3 && (
              <button
                type="button"
                onClick={handleSaveArticle}
                disabled={isSaving}
                className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Article &amp; Variants...</span>
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
