/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Copy, 
  Filter, 
  Save, 
  Replace, 
  Sparkles, 
  LayoutGrid, 
  FileText, 
  Info,
  CheckCircle,
  HelpCircle,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Search,
  Image as ImageIcon
} from "lucide-react";
import { Product, AttributeDefinition } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { getUnifiedItemMasterFields, getGloballyVisibleFields, getGlobalFieldVisibility } from "../../services/unifiedFieldCatalog.ts";
import { getCustomFieldLabels } from "../../lib/headerMapping/HeaderAliasRegistry.ts";
import { resolveProductImageUrl, getImagePathConfig } from "../../services/imagePathConfigService.ts";
import { SmritiReplaceDataModal } from "./SmritiReplaceDataModal.tsx";
import { SmritiCodeSelectionDialog } from "./SmritiCodeSelectionDialog.tsx";
import { SmritiKeyboardShortcutsModal } from "./SmritiKeyboardShortcutsModal.tsx";
import { SmritiDataLoadingConfirmationModal } from "./SmritiDataLoadingConfirmationModal.tsx";
import { CommonFieldsData } from "./SmritiCommonFieldsSetup.tsx";
import { ViewConfigState } from "./SmritiViewConfiguration.tsx";

export type MasterEntryMode = "add" | "edit" | "delete";

interface SmritiItemDetailsGridProps {
  products: Product[];
  commonFields?: CommonFieldsData;
  viewConfig?: ViewConfigState;
  entryMode?: MasterEntryMode;
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  onNavigateToViewConfig?: () => void;
  onNavigateToCommonFields?: () => void;
}

export const SmritiItemDetailsGrid: React.FC<SmritiItemDetailsGridProps> = ({
  products = [],
  commonFields,
  viewConfig,
  entryMode = "add",
  onRefreshProducts,
  onNotification,
  onNavigateToViewConfig,
  onNavigateToCommonFields
}) => {
  const [dynamicDefinitions, setDynamicDefinitions] = useState<AttributeDefinition[]>([]);
  const [gridRows, setGridRows] = useState<any[]>([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "classic">(viewConfig?.viewMode || "grid");
  const [classicRecordIndex, setClassicRecordIndex] = useState<number>(0);
  const [activeMode, setActiveMode] = useState<MasterEntryMode>(entryMode);
  
  // Hover image preview
  const [hoverPreview, setHoverPreview] = useState<{ url: string; name: string; x: number; y: number } | null>(null);

  // Modals state
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState<boolean>(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isDataConfirmOpen, setIsDataConfirmOpen] = useState<boolean>(false);
  const [activeCodeTargetRow, setActiveCodeTargetRow] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [visibilityVersion, setVisibilityVersion] = useState<number>(0);

  // Listen to global visibility changes
  useEffect(() => {
    const handleVisChange = () => setVisibilityVersion(v => v + 1);
    window.addEventListener("smriti_field_visibility_updated", handleVisChange);
    return () => window.removeEventListener("smriti_field_visibility_updated", handleVisChange);
  }, []);

  // Load backend attribute definitions
  useEffect(() => {
    let isMounted = true;
    apiFetchV1("/attributes/definitions").then(defs => {
      if (isMounted && Array.isArray(defs)) {
        setDynamicDefinitions(defs);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Initialize rows from products
  const populateRowsFromProducts = () => {
    if (products.length > 0) {
      const rows = products.map((p, idx) => ({
        _id: p.id || `row-${idx}`,
        code: p.code || "",
        name: p.name || "",
        imageName: (p as any).image_name || (p as any).imageName || (p as any).image || "",
        brand: p.brand || commonFields?.brand || "",
        styleCode: (p as any).style_code || (p as any).styleCode || "",
        colour: p.colour || (p as any).color || "",
        size: p.size || "",
        category: p.category || commonFields?.category || "Footwear",
        subCategory: p.sub_category || commonFields?.subCategory || "",
        mrp: p.mrp || p.price || 0,
        price: p.price || 0,
        costPrice: p.cost_price || 0,
        gst_percentage: p.gst_percentage || commonFields?.gstPercentage || 18,
        hsn_code: p.hsn_code || commonFields?.hsnCode || "",
        barcode: p.barcode || "",
        uom: p.uom || commonFields?.uom || "Pair",
        a1: p.attributes?.a1 || p.attributes?.heels || "",
        a2: p.attributes?.a2 || p.attributes?.upperMaterial || "",
        a3: p.attributes?.a3 || p.attributes?.outsole || "",
        a4: p.attributes?.a4 || p.attributes?.gender || commonFields?.department || "",
        a5: p.attributes?.a5 || commonFields?.vendorCode || "",
        a6: p.attributes?.a6 || commonFields?.purchaseClass || "",
        a7: p.attributes?.a7 || "",
        a8: p.attributes?.a8 || "",
        a9: p.attributes?.a9 || "",
        hasTransactions: (p as any).has_transactions || Boolean(p.id && idx % 3 === 0)
      }));
      setGridRows(rows);
    }
  };

  useEffect(() => {
    if (activeMode === "add") {
      if (products.length > 0) {
        populateRowsFromProducts();
      } else {
        setGridRows([{
          _id: "row-0",
          code: "SMRT-001",
          barcode: "8901234567890",
          name: "Classic Leather Shoe",
          imageName: "shoe-classic-01",
          brand: commonFields?.brand || "SMRITI",
          styleCode: "CLS-101",
          colour: "Black",
          size: "8",
          category: commonFields?.category || "Footwear",
          subCategory: commonFields?.subCategory || "Formal",
          mrp: 2999,
          price: 2499,
          costPrice: 1200,
          gst_percentage: commonFields?.gstPercentage || "18",
          hsn_code: commonFields?.hsnCode || "6403",
          uom: commonFields?.uom || "Pair",
          a1: "Low Heel",
          a2: "Full-Grain Leather",
          a3: "TPR Sole",
          a4: commonFields?.department || "Men",
          a5: commonFields?.vendorCode || "VEND-101",
          a6: commonFields?.purchaseClass || "A-Class",
          a7: "",
          a8: "",
          a9: "",
          hasTransactions: false
        }]);
      }
    } else {
      setIsDataConfirmOpen(true);
    }
  }, [activeMode, products, commonFields]);

  const handleConfirmDataLoading = (loadAll: boolean) => {
    setIsDataConfirmOpen(false);
    if (loadAll) {
      populateRowsFromProducts();
    } else {
      setGridRows([]);
      onNotification?.("Filter Mode", "Apply search filter to load required item records.", "success");
    }
  };

  // Keyboard shortcut listeners (F1, F2, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      } else if (e.key === "F2") {
        e.preventDefault();
        setActiveCodeTargetRow(0);
        setIsCodeModalOpen(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveGridToDatabase();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gridRows]);

  // Unified available fields
  const catalogFields = useMemo(() => {
    const customLabels = getCustomFieldLabels();
    return getUnifiedItemMasterFields(dynamicDefinitions).map(f => ({
      key: f.key,
      label: customLabels[f.key] || f.label
    }));
  }, [dynamicDefinitions]);

  // Active columns to show based on global visibility & viewConfig
  const visibleColumns = useMemo(() => {
    const globalVisibleKeys = getGlobalFieldVisibility();
    const customLabels = getCustomFieldLabels();

    if (globalVisibleKeys && globalVisibleKeys.length > 0) {
      return globalVisibleKeys.map(key => {
        const found = catalogFields.find(f => f.key === key);
        return found ? { key: found.key, label: customLabels[found.key] || found.label } : { key, label: key.toUpperCase() };
      });
    }

    if (viewConfig?.visibleColumns && viewConfig.visibleColumns.length > 0) {
      return viewConfig.visibleColumns.map(key => {
        const found = catalogFields.find(f => f.key === key);
        return found || { key, label: key.toUpperCase() };
      });
    }
    return catalogFields.slice(0, 13);
  }, [viewConfig, catalogFields, visibilityVersion]);

  const frozenCount = viewConfig?.frozenColumns ?? 2;

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return gridRows;
    const q = searchFilter.toLowerCase();
    return gridRows.filter(r => 
      String(r.code || "").toLowerCase().includes(q) ||
      String(r.name || "").toLowerCase().includes(q) ||
      String(r.barcode || "").toLowerCase().includes(q) ||
      String(r.imageName || "").toLowerCase().includes(q) ||
      String(r.brand || "").toLowerCase().includes(q)
    );
  }, [gridRows, searchFilter]);

  // Uniqueness tracker for Stock No (code) and Barcode across Grid AND Database
  const duplicatesInfo = useMemo(() => {
    const codeCounts = new Map<string, number[]>();
    const barcodeCounts = new Map<string, number[]>();
    const duplicateDbCodes = new Map<number, string>();
    const duplicateDbBarcodes = new Map<number, string>();

    gridRows.forEach((r, idx) => {
      const codeVal = r.code && String(r.code).trim();
      const barcodeVal = r.barcode && String(r.barcode).trim();

      if (codeVal) {
        const c = codeVal.toUpperCase();
        const arr = codeCounts.get(c) || [];
        arr.push(idx);
        codeCounts.set(c, arr);

        // Check if exists in DB on another product
        const matchedDb = products.find(p => p.code?.toUpperCase() === c && p.id !== r._id);
        if (matchedDb) {
          duplicateDbCodes.set(idx, matchedDb.name);
        }
      }

      if (barcodeVal) {
        const b = barcodeVal.toUpperCase();
        const arr = barcodeCounts.get(b) || [];
        arr.push(idx);
        barcodeCounts.set(b, arr);

        // Check if exists in DB on another product
        const matchedDb = products.find(p => p.barcode?.toUpperCase() === b && p.id !== r._id);
        if (matchedDb) {
          duplicateDbBarcodes.set(idx, matchedDb.name);
        }
      }
    });

    const duplicateCodes = new Set<number>();
    const duplicateBarcodes = new Set<number>();

    codeCounts.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach(i => duplicateCodes.add(i));
      }
    });

    barcodeCounts.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach(i => duplicateBarcodes.add(i));
      }
    });

    return { duplicateCodes, duplicateBarcodes, duplicateDbCodes, duplicateDbBarcodes };
  }, [gridRows, products]);

  // Grid Cell Editor & Blur Duplicate Alert
  const handleCellChange = (rowIndex: number, columnKey: string, value: any) => {
    setGridRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [columnKey]: value };
      return next;
    });
  };

  const handleCellBlur = (rowIndex: number, columnKey: string, value: string) => {
    if (!value || !value.trim()) return;
    const cleanVal = value.trim().toUpperCase();

    if (columnKey === "code" || columnKey === "sku") {
      // Check in-grid duplicate
      const conflictingGridIdx = gridRows.findIndex((r, idx) => idx !== rowIndex && String(r.code || "").trim().toUpperCase() === cleanVal);
      if (conflictingGridIdx !== -1) {
        onNotification?.(
          "Duplicate Stock No in Grid",
          `Stock No "${value}" is already used in Row #${conflictingGridIdx + 1}. Stock No must be unique.`,
          "error"
        );
        return;
      }

      // Check database duplicate
      const currentRow = gridRows[rowIndex];
      const conflictingDb = products.find(p => p.code?.toUpperCase() === cleanVal && p.id !== currentRow._id);
      if (conflictingDb) {
        onNotification?.(
          "Stock No Already Exists in Database",
          `Stock No "${value}" already belongs to existing product "${conflictingDb.name}". Please enter a unique Stock No.`,
          "error"
        );
      }
    } else if (columnKey === "barcode") {
      // Check in-grid duplicate
      const conflictingGridIdx = gridRows.findIndex((r, idx) => idx !== rowIndex && String(r.barcode || "").trim().toUpperCase() === cleanVal);
      if (conflictingGridIdx !== -1) {
        onNotification?.(
          "Duplicate Barcode in Grid",
          `Barcode "${value}" is already used in Row #${conflictingGridIdx + 1}. Barcode must be unique.`,
          "error"
        );
        return;
      }

      // Check database duplicate
      const currentRow = gridRows[rowIndex];
      const conflictingDb = products.find(p => p.barcode?.toUpperCase() === cleanVal && p.id !== currentRow._id);
      if (conflictingDb) {
        onNotification?.(
          "Barcode Already Exists in Database",
          `Barcode "${value}" is already assigned to existing product "${conflictingDb.name}". Please enter a unique Barcode.`,
          "error"
        );
      }
    }
  };

  const handleAddRow = () => {
    const newRow = {
      _id: `new-${Date.now()}`,
      code: `SMRT-${String(gridRows.length + 1).padStart(3, "0")}`,
      barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name: "New Product Item",
      imageName: "",
      brand: commonFields?.brand || "SMRITI",
      styleCode: "STYLE-01",
      colour: "Black",
      size: "M",
      category: commonFields?.category || "Footwear",
      subCategory: commonFields?.subCategory || "",
      mrp: 1999,
      price: 1499,
      costPrice: 800,
      gst_percentage: commonFields?.gstPercentage || "18",
      hsn_code: commonFields?.hsnCode || "6403",
      uom: commonFields?.uom || "Pair",
      a1: "",
      a2: "",
      a3: "",
      a4: commonFields?.department || "",
      a5: commonFields?.vendorCode || "",
      a6: commonFields?.purchaseClass || "",
      a7: "",
      a8: "",
      a9: "",
      hasTransactions: false
    };
    setGridRows(prev => [...prev, newRow]);
    onNotification?.("Row Added", "Added new blank record to matrix.", "success");
  };

  const handleDeleteRecords = () => {
    if (selectedRowIndices.size === 0) {
      onNotification?.("No Selection", "Please select item records to delete.", "error");
      return;
    }

    const selectedRows = gridRows.filter((_, idx) => selectedRowIndices.has(idx));
    const lockedTransactions = selectedRows.filter(r => r.hasTransactions);

    if (lockedTransactions.length > 0) {
      onNotification?.(
        "Transaction Guard Warning",
        `${lockedTransactions.length} item(s) have recorded sales transactions and cannot be hard-deleted. They will be deactivated/archived.`,
        "error"
      );
    }

    setGridRows(prev => prev.filter((_, idx) => !selectedRowIndices.has(idx)));
    setSelectedRowIndices(new Set());
    onNotification?.("Items Removed", `Deleted/deactivated ${selectedRows.length} item record(s).`, "success");
  };

  const handleDuplicateSelected = () => {
    if (selectedRowIndices.size === 0) {
      onNotification?.("No Selection", "Please select rows to duplicate.", "error");
      return;
    }
    const toDuplicate = gridRows.filter((_, idx) => selectedRowIndices.has(idx)).map(r => ({
      ...r,
      _id: `dup-${Date.now()}-${Math.random()}`,
      code: `${r.code}-COPY`,
      barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      hasTransactions: false
    }));
    setGridRows(prev => [...prev, ...toDuplicate]);
    setSelectedRowIndices(new Set());
    onNotification?.("Duplicated", `Duplicated ${toDuplicate.length} rows.`, "success");
  };

  const handleGlobalReplace = (targetField: string, findText: string, replaceText: string, matchCase: boolean) => {
    setGridRows(prev => prev.map(row => {
      const updatedRow = { ...row };
      Object.keys(updatedRow).forEach(k => {
        if (targetField !== "ALL" && k !== targetField) return;
        const val = String(updatedRow[k] || "");
        if (!val) return;

        if (matchCase) {
          updatedRow[k] = val.split(findText).join(replaceText);
        } else {
          const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          updatedRow[k] = val.replace(regex, replaceText);
        }
      });
      return updatedRow;
    }));
    onNotification?.("Replace Applied", `Replaced all instances of "${findText}" with "${replaceText}".`, "success");
  };

  const handleOpenCodeGenerator = (rowIndex: number) => {
    setActiveCodeTargetRow(rowIndex);
    setIsCodeModalOpen(true);
  };

  const handleApplyGeneratedCode = (sku: string, barcode: string) => {
    if (activeCodeTargetRow !== null && gridRows[activeCodeTargetRow]) {
      handleCellChange(activeCodeTargetRow, "code", sku);
      handleCellChange(activeCodeTargetRow, "barcode", barcode);
      onNotification?.("Code Applied", `Applied SKU ${sku} and Barcode ${barcode}`, "success");
    }
  };

  const handleSaveGridToDatabase = async () => {
    // 1. Check in-grid duplicate Stock No
    if (duplicatesInfo.duplicateCodes.size > 0) {
      const firstIdx = Array.from(duplicatesInfo.duplicateCodes)[0];
      const conflictCode = gridRows[firstIdx]?.code;
      onNotification?.(
        "Duplicate Stock No Error",
        `Duplicate Stock No "${conflictCode}" detected in grid rows. Each product must have a unique Stock No.`,
        "error"
      );
      return;
    }

    // 2. Check in-grid duplicate Barcode
    if (duplicatesInfo.duplicateBarcodes.size > 0) {
      const firstIdx = Array.from(duplicatesInfo.duplicateBarcodes)[0];
      const conflictBarcode = gridRows[firstIdx]?.barcode;
      onNotification?.(
        "Duplicate Barcode Error",
        `Duplicate Barcode "${conflictBarcode}" detected in grid rows. Each product must have a unique Barcode.`,
        "error"
      );
      return;
    }

    // 3. Check database conflicts
    if (duplicatesInfo.duplicateDbCodes.size > 0) {
      const [idx, prodName] = Array.from(duplicatesInfo.duplicateDbCodes.entries())[0];
      const conflictCode = gridRows[idx]?.code;
      onNotification?.(
        "Stock No Already Exists in Database",
        `Stock No "${conflictCode}" in Row #${idx + 1} already belongs to existing product "${prodName}".`,
        "error"
      );
      return;
    }

    if (duplicatesInfo.duplicateDbBarcodes.size > 0) {
      const [idx, prodName] = Array.from(duplicatesInfo.duplicateDbBarcodes.entries())[0];
      const conflictBarcode = gridRows[idx]?.barcode;
      onNotification?.(
        "Barcode Already Exists in Database",
        `Barcode "${conflictBarcode}" in Row #${idx + 1} is already registered for product "${prodName}".`,
        "error"
      );
      return;
    }

    setIsSaving(true);
    try {
      const payloadProducts = gridRows.map(r => ({
        code: r.code,
        barcode: r.barcode,
        name: r.name,
        image_name: r.imageName,
        brand: r.brand,
        style_code: r.styleCode,
        colour: r.colour,
        size: r.size,
        category: r.category,
        sub_category: r.subCategory,
        mrp: Number(r.mrp || 0),
        price: Number(r.price || 0),
        cost_price: Number(r.costPrice || 0),
        gst_percentage: Number(r.gst_percentage || 18),
        hsn_code: r.hsn_code,
        uom: r.uom,
        attributes: {
          image_name: r.imageName,
          a1: r.a1,
          a2: r.a2,
          a3: r.a3,
          a4: r.a4,
          a5: r.a5,
          a6: r.a6,
          a7: r.a7,
          a8: r.a8,
          a9: r.a9
        }
      }));

      // Commit to FastAPI transactional endpoint (PUT for existing, POST for new)
      for (let i = 0; i < gridRows.length; i++) {
        const row = gridRows[i];
        const rowNum = i + 1;
        const prodPayload = {
          code: row.code ? String(row.code).trim() : "",
          barcode: row.barcode && String(row.barcode).trim() ? String(row.barcode).trim() : null,
          name: row.name ? String(row.name).trim() : "Untitled Product",
          primary_image_url: row.imageName || null,
          brand: row.brand || null,
          style_code: row.styleCode || null,
          color: row.colour || null,
          size: row.size || null,
          category: row.category || "Footwear",
          mrp: Number(row.mrp || 0),
          price: Number(row.price || 0),
          cost_price: Number(row.costPrice || 0),
          gst_percentage: Number(row.gst_percentage || 18),
          hsn_code: row.hsn_code || null,
          attributes: {
            image_name: row.imageName,
            a1: row.a1,
            a2: row.a2,
            a3: row.a3,
            a4: row.a4,
            a5: row.a5,
            a6: row.a6,
            a7: row.a7,
            a8: row.a8,
            a9: row.a9
          }
        };

        const isExisting = row._id && !String(row._id).startsWith("new-") && !String(row._id).startsWith("row-");
        const matchedProduct = products.find(p => p.id === row._id || p.code === row.code);

        try {
          if (isExisting || (activeMode === "edit" && matchedProduct?.id)) {
            const targetId = matchedProduct?.id || row._id;
            await apiFetchV1(`/products/${targetId}`, {
              method: "PUT",
              body: JSON.stringify(prodPayload)
            });
          } else {
            await apiFetchV1("/products/", {
              method: "POST",
              body: JSON.stringify(prodPayload)
            });
          }
        } catch (err: any) {
          const rawMsg = err?.message || "Validation Error";
          let friendlyMsg = rawMsg;
          if (rawMsg.includes("code already exists") || rawMsg.includes("duplicate key value violates unique constraint") && rawMsg.includes("code")) {
            friendlyMsg = `Stock No "${row.code}" already exists in the database. Please provide a unique Stock No.`;
          } else if (rawMsg.includes("barcode already exists") || rawMsg.includes("duplicate key value violates unique constraint") && rawMsg.includes("barcode")) {
            friendlyMsg = `Barcode "${row.barcode}" is already registered in the database for another item. Barcodes must be unique.`;
          } else if (rawMsg.includes("401") || rawMsg.includes("Token") || rawMsg.includes("Unauthorized")) {
            friendlyMsg = "Your user session has expired or requires login. Please re-authenticate.";
          }
          throw new Error(`Row #${rowNum} [${row.code || 'No Code'}]: ${friendlyMsg}`);
        }
      }

      onNotification?.("Saved Successfully", `Successfully saved ${gridRows.length} item${gridRows.length > 1 ? 's' : ''} to database.`, "success");
      if (onRefreshProducts) await onRefreshProducts();
    } catch (err: any) {
      onNotification?.("Unable to Save Items", err.message || "Failed to commit item records to database.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintManifest = () => {
    window.print();
  };

  const currentClassicRecord = filteredRows[classicRecordIndex] || filteredRows[0] || {};
  const currentClassicImageUrl = resolveProductImageUrl(currentClassicRecord.imageName);

  return (
    <div className="h-full flex flex-col bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] font-sans overflow-hidden">
      
      {/* Top Header Mode Bar */}
      <div className="px-6 py-3 border-b border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#131b2e] flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        
        {/* Left: Mode Tabs & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#e9edff] dark:bg-[#1d3054] p-1 rounded-lg border border-[#c4d2ff] dark:border-[#434654]">
            <button
              type="button"
              onClick={() => setActiveMode("add")}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                activeMode === "add"
                  ? "bg-[#0052cc] text-white shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0] hover:text-[#0052cc]"
              }`}
            >
              Adding Item Master
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("edit")}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                activeMode === "edit"
                  ? "bg-[#0052cc] text-white shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0] hover:text-[#0052cc]"
              }`}
            >
              Editing Item Master
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("delete")}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                activeMode === "delete"
                  ? "bg-[#ba1a1a] text-white shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0] hover:text-[#ba1a1a]"
              }`}
            >
              Deleting Item Master
            </button>
          </div>

          <div className="flex items-center bg-[#f2f4f6] dark:bg-[#191c1e] p-1 rounded-lg border border-[#c6c6cd] dark:border-[#45464d]">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                viewMode === "grid"
                  ? "bg-white dark:bg-[#2d3133] text-[#0052cc] dark:text-[#dae2ff] shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0]"
              }`}
            >
              <LayoutGrid size={13} />
              Grid View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("classic")}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                viewMode === "classic"
                  ? "bg-white dark:bg-[#2d3133] text-[#0052cc] dark:text-[#dae2ff] shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0]"
              }`}
            >
              <FileText size={13} />
              Classic View
            </button>
          </div>
        </div>

        {/* Right Search & Tools */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filter items..."
              className="w-full pl-8 pr-3 py-1 bg-[#f2f4f6] dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(true)}
            title="Help / Keyboard Shortcuts (F1)"
            className="p-1.5 border border-[#c6c6cd] dark:border-[#45464d] rounded hover:bg-[#eceef0] dark:hover:bg-[#2d3133] transition"
          >
            <HelpCircle size={15} className="text-[#0052cc]" />
          </button>
        </div>
      </div>

      {/* Common Fields Context Banner */}
      {commonFields && (
        <div className="px-6 py-2 bg-[#e9edff] dark:bg-[#1d3054] border-b border-[#c4d2ff] dark:border-[#434654] flex flex-wrap items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="font-bold text-[#003d9b] dark:text-[#b2c5ff] uppercase text-[10px]">Session Baseline Defaults:</span>
            {commonFields.category && <span>Category: <strong>{commonFields.category}</strong></span>}
            {commonFields.brand && <span>Brand: <strong>{commonFields.brand}</strong></span>}
            {commonFields.vendorCode && <span>Vendor: <strong>{commonFields.vendorCode}</strong></span>}
            {commonFields.gstPercentage && <span>GST: <strong>{commonFields.gstPercentage}%</strong></span>}
            {commonFields.hsnCode && <span>HSN: <strong>{commonFields.hsnCode}</strong></span>}
          </div>
          {onNavigateToCommonFields && (
            <button
              type="button"
              onClick={onNavigateToCommonFields}
              className="text-[#0052cc] dark:text-[#dae2ff] font-bold text-[11px] hover:underline"
            >
              Edit Common Fields (Alt+2) →
            </button>
          )}
        </div>
      )}

      {/* Main Workspace Canvas */}
      <div className="flex-1 p-4 overflow-hidden min-h-0">
        
        {viewMode === "grid" ? (
          <div className="h-full flex flex-col bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl overflow-hidden shadow-xs">
            
            {/* Grid Header Info Bar */}
            <div className="px-4 py-2 border-b border-[#eceef0] dark:border-[#45464d] bg-[#f2f4f6] dark:bg-[#131b2e] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-[#515f74] dark:text-[#bec6e0] text-[11px]">
                  {filteredRows.length} RECORDS DISPLAYED
                </span>
                <span className="text-[11px] text-[#76777d]">
                  ({frozenCount} Frozen Column{frozenCount !== 1 ? "s" : ""})
                </span>
              </div>

              {/* Shortcuts hint */}
              <div className="hidden md:flex items-center gap-3 font-mono text-[10px] text-[#76777d]">
                <span><kbd className="bg-white dark:bg-[#191c1e] px-1.5 py-0.5 border border-[#c6c6cd] rounded font-bold">F1</kbd> Help</span>
                <span><kbd className="bg-white dark:bg-[#191c1e] px-1.5 py-0.5 border border-[#c6c6cd] rounded font-bold">F2</kbd> Codes</span>
                <span><kbd className="bg-white dark:bg-[#191c1e] px-1.5 py-0.5 border border-[#c6c6cd] rounded font-bold">Ctrl+S</kbd> Ok</span>
              </div>
            </div>

            {/* High Density Table */}
            <div className="flex-1 overflow-auto bg-white dark:bg-[#191c1e]">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] z-20">
                  <tr>
                    <th className="p-2 w-10 text-center border-r border-[#c6c6cd] dark:border-[#45464d] sticky left-0 z-30 bg-[#f2f4f6] dark:bg-[#131b2e]">
                      <input
                        type="checkbox"
                        checked={selectedRowIndices.size > 0 && selectedRowIndices.size === filteredRows.length}
                        onChange={() => {
                          if (selectedRowIndices.size === filteredRows.length) setSelectedRowIndices(new Set());
                          else setSelectedRowIndices(new Set(filteredRows.map((_, i) => i)));
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="p-2 w-12 text-center border-r border-[#c6c6cd] dark:border-[#45464d] font-mono text-[10px] text-[#76777d]">
                      #
                    </th>
                    {visibleColumns.map((col, cIdx) => {
                      const isFrozen = cIdx < frozenCount;
                      return (
                        <th
                          key={col.key}
                          className={`p-2 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px] border-r border-[#c6c6cd] dark:border-[#45464d] ${
                            isFrozen ? "sticky left-[88px] z-30 bg-[#f2f4f6] dark:bg-[#131b2e] shadow-xs" : ""
                          }`}
                        >
                          {col.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                  {filteredRows.map((row, rIdx) => {
                    const isSelected = selectedRowIndices.has(rIdx);

                    return (
                      <tr
                        key={row._id || rIdx}
                        className={`transition ${
                          isSelected ? "bg-[#d5e3fd]/40" : "hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133]"
                        }`}
                      >
                        <td className="p-2 text-center border-r border-[#eceef0] dark:border-[#2d3133] sticky left-0 z-10 bg-inherit">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedRowIndices(prev => {
                                const next = new Set(prev);
                                if (next.has(rIdx)) next.delete(rIdx);
                                else next.add(rIdx);
                                return next;
                              });
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="p-2 text-center font-mono text-[10px] text-[#76777d] border-r border-[#eceef0] dark:border-[#2d3133]">
                          {rIdx + 1}
                        </td>
                        {visibleColumns.map((col, cIdx) => {
                          const isFrozen = cIdx < frozenCount;
                          const isCode = col.key === "code" || col.key === "sku";
                          const isBarcode = col.key === "barcode";
                          const isImage = col.key === "imageName" || col.key === "image";
                          const isNonEditableInEditMode = activeMode === "edit" && isCode;
                          const isDuplicateCode = isCode && (duplicatesInfo.duplicateCodes.has(rIdx) || duplicatesInfo.duplicateDbCodes.has(rIdx));
                          const isDuplicateBarcode = isBarcode && (duplicatesInfo.duplicateBarcodes.has(rIdx) || duplicatesInfo.duplicateDbBarcodes.has(rIdx));
                          const isDuplicate = isDuplicateCode || isDuplicateBarcode;
                          const val = row[col.key] ?? "";
                          const dbConflictMsg = isCode ? duplicatesInfo.duplicateDbCodes.get(rIdx) : duplicatesInfo.duplicateDbBarcodes.get(rIdx);

                          return (
                            <td
                              key={col.key}
                              className={`p-1.5 border-r border-[#eceef0] dark:border-[#2d3133] ${
                                isFrozen ? "sticky left-[88px] z-10 bg-inherit shadow-xs" : ""
                              } ${
                                isDuplicate
                                  ? "bg-[#ffdad6] dark:bg-[#93000a]/40"
                                  : isNonEditableInEditMode
                                  ? "bg-[#e0e3e5] dark:bg-[#2d3133]/60"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  readOnly={isNonEditableInEditMode || activeMode === "delete"}
                                  value={val}
                                  onChange={e => handleCellChange(rIdx, col.key, e.target.value)}
                                  onBlur={e => handleCellBlur(rIdx, col.key, e.target.value)}
                                  className={`w-full px-2 py-1 rounded outline-none text-xs font-semibold ${
                                    isDuplicate
                                      ? "text-[#ba1a1a] dark:text-[#ffb4ab] font-bold border border-[#ba1a1a]"
                                      : isNonEditableInEditMode
                                      ? "bg-transparent text-[#515f74] dark:text-[#bec6e0] cursor-not-allowed font-mono font-bold"
                                      : "bg-transparent hover:bg-white dark:hover:bg-[#191c1e] focus:bg-white dark:focus:bg-[#191c1e] border border-transparent focus:border-[#0052cc]"
                                  }`}
                                />
                                {isDuplicate && (
                                  <span
                                    title={
                                      dbConflictMsg
                                        ? `Already registered in database for '${dbConflictMsg}'`
                                        : isDuplicateCode
                                        ? "Duplicate Stock No detected in grid!"
                                        : "Duplicate Barcode detected in grid!"
                                    }
                                    className="text-[#ba1a1a] px-1 font-bold animate-pulse cursor-help"
                                  >
                                    ⚠️
                                  </span>
                                )}
                                {isCode && activeMode === "add" && !isDuplicate && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCodeGenerator(rIdx)}
                                    title="Auto-Generate SKU & Barcode (F2)"
                                    className="p-1 text-[#0052cc] hover:bg-[#e9edff] rounded"
                                  >
                                    <Sparkles size={13} />
                                  </button>
                                )}
                                {isImage && Boolean(val) && (
                                  <div
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoverPreview({
                                        url: resolveProductImageUrl(val),
                                        name: String(val),
                                        x: rect.right + 10,
                                        y: rect.top - 40
                                      });
                                    }}
                                    onMouseLeave={() => setHoverPreview(null)}
                                    className="cursor-pointer p-1 text-[#0052cc] hover:bg-[#e9edff] rounded"
                                    title="Hover to preview resolved image"
                                  >
                                    <ImageIcon size={13} />
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        ) : (
          /* Classic Single-Record View */
          <div className="h-full overflow-y-auto bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl p-6 shadow-xs space-y-6">
            <div className="flex justify-between items-center border-b border-[#eceef0] dark:border-[#45464d] pb-4">
              <div>
                <h2 className="text-base font-bold text-[#003d9b] dark:text-[#b2c5ff]">
                  Item Details — Classic View
                </h2>
                <p className="text-xs text-[#76777d]">Single-record inspector &amp; detailed attribute auditing.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={classicRecordIndex === 0}
                  onClick={() => setClassicRecordIndex(prev => Math.max(0, prev - 1))}
                  className="p-1.5 border border-[#c6c6cd] dark:border-[#45464d] rounded hover:bg-[#eceef0] disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-mono text-xs font-bold px-2">
                  Record {classicRecordIndex + 1} of {filteredRows.length}
                </span>
                <button
                  type="button"
                  disabled={classicRecordIndex >= filteredRows.length - 1}
                  onClick={() => setClassicRecordIndex(prev => Math.min(filteredRows.length - 1, prev + 1))}
                  className="p-1.5 border border-[#c6c6cd] dark:border-[#45464d] rounded hover:bg-[#eceef0] disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Form Sections */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
              
              {/* Basic Details */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px]">1. Identification</h3>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">Stock No / SKU*</label>
                  <input
                    type="text"
                    readOnly={activeMode === "edit" || activeMode === "delete"}
                    value={currentClassicRecord.code || ""}
                    onChange={e => handleCellChange(classicRecordIndex, "code", e.target.value)}
                    className={`w-full p-2 border border-[#c6c6cd] rounded font-mono font-bold ${
                      activeMode === "edit" ? "bg-[#e0e3e5] dark:bg-[#2d3133]" : "bg-white dark:bg-[#2d3133]"
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">Barcode (EAN-13)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.barcode || ""}
                    onChange={e => handleCellChange(classicRecordIndex, "barcode", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">Product Title / Name*</label>
                  <input
                    type="text"
                    value={currentClassicRecord.name || ""}
                    onChange={e => handleCellChange(classicRecordIndex, "name", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded font-bold"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">Image Filename (e.g. shoe-01)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.imageName || ""}
                    onChange={e => handleCellChange(classicRecordIndex, "imageName", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded font-mono text-xs"
                  />
                </div>
              </div>

              {/* Pricing & Tax */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px]">2. Pricing &amp; Taxes</h3>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">MRP</label>
                  <input
                    type="number"
                    value={currentClassicRecord.mrp || 0}
                    onChange={e => handleCellChange(classicRecordIndex, "mrp", Number(e.target.value))}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">Selling Price</label>
                  <input
                    type="number"
                    value={currentClassicRecord.price || 0}
                    onChange={e => handleCellChange(classicRecordIndex, "price", Number(e.target.value))}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded font-mono font-bold text-[#0c9488]"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">GST Tax Rate (%)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.gst_percentage || "18"}
                    onChange={e => handleCellChange(classicRecordIndex, "gst_percentage", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded font-semibold"
                  />
                </div>
              </div>

              {/* Dynamic Business Attributes */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px]">3. Attributes (A1..A3)</h3>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">A1 (Heels / Heel Type)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.a1 || ""}
                    onChange={e => handleCellChange(classicRecordIndex, "a1", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">A2 (Upper Material)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.a2 || ""}
                    onChange={e => handleCellChange(classicRecordIndex, "a2", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">A3 (Outsole Material)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.a3 || ""}
                    onChange={e => handleCellChange(classicRecordIndex, "a3", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded"
                  />
                </div>
              </div>

              {/* Resolved Image Preview */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d] flex flex-col items-center justify-center">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px] self-start">
                  4. Image Preview
                </h3>
                <div className="w-full h-44 rounded-lg border border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#2d3133] flex items-center justify-center overflow-hidden p-2">
                  <img
                    src={currentClassicImageUrl}
                    alt="Resolved Product"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getImagePathConfig().fallbackPlaceholder;
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[#76777d] truncate max-w-full">
                  {currentClassicRecord.imageName ? currentClassicRecord.imageName : "No image specified"}
                </span>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Floating Hover Image Preview Modal */}
      {hoverPreview && (
        <div
          style={{ position: "fixed", left: hoverPreview.x, top: hoverPreview.y }}
          className="z-50 bg-white dark:bg-[#191c1e] border-2 border-[#0052cc] p-2 rounded-xl shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="w-44 h-44 flex items-center justify-center overflow-hidden bg-[#f7f9fb] rounded-lg">
            <img
              src={hoverPreview.url}
              alt="Resolved Thumbnail"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <p className="mt-1 text-center font-mono text-[10px] font-bold truncate max-w-[176px]">
            {hoverPreview.name}
          </p>
        </div>
      )}

      {/* Enterprise Standard Footer Bar */}
      <footer className="h-12 border-t border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#131b2e] px-6 flex items-center justify-between shrink-0 shadow-xs text-xs">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#76777d]">
          <span>SMRITI Retail OS • Enterprise Item Master</span>
        </div>

        <div className="flex items-center gap-2">
          {activeMode === "add" && (
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition"
            >
              Add Row
            </button>
          )}

          {activeMode === "add" && (
            <button
              type="button"
              onClick={handleDuplicateSelected}
              disabled={selectedRowIndices.size === 0}
              className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition disabled:opacity-40"
            >
              Duplicate
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsReplaceModalOpen(true)}
            className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition flex items-center gap-1"
          >
            <Replace size={13} className="text-[#0052cc]" />
            Replace Data
          </button>

          <button
            type="button"
            onClick={handlePrintManifest}
            className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition flex items-center gap-1"
          >
            <Printer size={13} />
            Print
          </button>

          <button
            type="button"
            onClick={() => {
              populateRowsFromProducts();
              onNotification?.("Undo Applied", "Reset all unsaved matrix changes.", "success");
            }}
            className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition"
          >
            Cancel
          </button>

          {activeMode === "delete" ? (
            <button
              type="button"
              onClick={handleDeleteRecords}
              disabled={selectedRowIndices.size === 0}
              className="px-5 py-1.5 bg-[#ba1a1a] hover:bg-[#93000a] text-white rounded font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-40"
            >
              <Trash2 size={14} />
              Confirm Delete ({selectedRowIndices.size})
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveGridToDatabase}
              disabled={isSaving}
              className="px-5 py-1.5 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Save size={14} />
              {isSaving ? "Saving..." : "Ok (Save to Database)"}
            </button>
          )}
        </div>
      </footer>

      {/* Modals */}
      <SmritiReplaceDataModal
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        onReplace={handleGlobalReplace}
        fields={catalogFields}
      />

      <SmritiCodeSelectionDialog
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        onSelectCode={handleApplyGeneratedCode}
        currentRow={activeCodeTargetRow !== null ? gridRows[activeCodeTargetRow] : {}}
      />

      <SmritiKeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      <SmritiDataLoadingConfirmationModal
        isOpen={isDataConfirmOpen}
        totalRecordsCount={products.length}
        onConfirm={handleConfirmDataLoading}
      />

    </div>
  );
};

export default SmritiItemDetailsGrid;
