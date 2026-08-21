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

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  ItemMasterActiveSubTab, 
  ItemMasterCommonFieldValues, 
  ItemMasterGridRow, 
  DEFAULT_INITIAL_SELECTED_FIELDS,
  buildUnifiedItemMasterFields,
  validateProductAttributes,
  serializeProductAttributes,
  ItemMasterFieldDefinition
} from "./types.ts";
import { FieldSelectionViewTab } from "./tabs/FieldSelectionViewTab.tsx";
import { CommonFieldsTab } from "./tabs/CommonFieldsTab.tsx";
import { ItemDetailsGridTab } from "./tabs/ItemDetailsGridTab.tsx";
import { SmritiItemMasterStudio } from "./SmritiItemMasterStudio.tsx";
import { ItemMasterSaveWarningModal } from "./modals/ItemMasterSaveWarningModal.tsx";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { Product, AttributeDefinition } from "../../types.ts";

const STORAGE_KEY_SELECTED_FIELDS = "smriti_item_master_selected_fields_v1";
const STORAGE_KEY_COMMON_FIELDS = "smriti_item_master_common_fields_v1";

interface ItemMasterEntryViewProps {
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
  existingProducts?: Product[];
}

export const ItemMasterEntryView: React.FC<ItemMasterEntryViewProps> = ({
  onRefreshProducts,
  onNotification,
  currentUser,
  existingProducts = []
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ItemMasterActiveSubTab>("details");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [dynamicDefinitions, setDynamicDefinitions] = useState<AttributeDefinition[]>([]);

  // Fetch dynamic attribute definitions from backend
  useEffect(() => {
    let isMounted = true;
    const loadDynamicAttributes = async () => {
      try {
        const defs = await apiFetchV1("/attributes/definitions");
        if (isMounted && Array.isArray(defs)) {
          setDynamicDefinitions(defs);
        }
      } catch (err) {
        console.warn("Could not load dynamic attribute definitions for ItemMasterEntryView:", err);
      }
    };
    loadDynamicAttributes();
    return () => { isMounted = false; };
  }, []);

  // Unified available fields catalog
  const allAvailableFields = useMemo(() => {
    return buildUnifiedItemMasterFields(dynamicDefinitions);
  }, [dynamicDefinitions]);

  // Field selection state
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SELECTED_FIELDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_INITIAL_SELECTED_FIELDS;
  });

  // Common fields state
  const [commonFieldValues, setCommonFieldValues] = useState<ItemMasterCommonFieldValues>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMMON_FIELDS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
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
  });

  // Grid rows state
  const [rows, setRows] = useState<ItemMasterGridRow[]>([]);

  // Modal warning state
  const [warningModalState, setWarningModalState] = useState<{
    isOpen: boolean;
    message: string;
    pendingItems: any[];
  }>({
    isOpen: false,
    message: "",
    pendingItems: []
  });

  // Global Keyboard Shortcuts (Alt+1, Alt+2, Alt+3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "1") {
        e.preventDefault();
        setActiveSubTab("view");
      } else if (e.altKey && e.key === "2") {
        e.preventDefault();
        setActiveSubTab("common");
      } else if (e.altKey && e.key === "3") {
        e.preventDefault();
        setActiveSubTab("details");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSaveFieldSelection = (newSelectedIds: string[]) => {
    setSelectedFieldIds(newSelectedIds);
    try {
      localStorage.setItem(STORAGE_KEY_SELECTED_FIELDS, JSON.stringify(newSelectedIds));
    } catch {}
    setActiveSubTab("details");
  };

  const handleSaveCommonFields = (newValues: ItemMasterCommonFieldValues) => {
    setCommonFieldValues(newValues);
    try {
      localStorage.setItem(STORAGE_KEY_COMMON_FIELDS, JSON.stringify(newValues));
    } catch {}
    setActiveSubTab("details");
  };

  const executeCommitItems = async (itemsToSave: any[]) => {
    setIsSaving(true);
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    const dynamicFields = allAvailableFields.filter(f => f.isDynamic);

    for (const item of itemsToSave) {
      try {
        const attributesPayload = serializeProductAttributes(item, dynamicDefinitions);

        // Enforce validation constraints
        const valResult = validateProductAttributes(attributesPayload, dynamicDefinitions);
        if (!valResult.isValid) {
          failureCount++;
          errors.push(...valResult.errors);
          continue;
        }

        const payload = {
          code: item.stockNo || `SKU-${Date.now().toString(36)}`,
          name: item.product || item.itemDescription || "Unnamed Product",
          barcode: item.barcode || item.stockNo || "",
          price: parseFloat(item.sellingPrice || item.mrp || "0") || 0,
          mrp: parseFloat(item.mrp || item.sellingPrice || "0") || 0,
          cost_price: parseFloat(item.costPrice || "0") || 0,
          stock: 100,
          brand: item.brand || commonFieldValues.brand || "",
          category: item.category || commonFieldValues.category || "General",
          color: item.shade || "",
          size: item.size || "",
          style_code: item.style || "",
          hsn_code: item.hsnCode || "",
          gst_percentage: parseFloat(item.productTax?.replace(/[^0-9.]/g, "") || commonFieldValues.taxRate || "18") || 18,
          is_active: commonFieldValues.status === "active",
          attributes: attributesPayload
        };

        const res = await apiFetchV1("/products", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        if (res.ok || res.id || res.code) {
          successCount++;
        } else {
          failureCount++;
          const errData = typeof res.json === "function" ? await res.json().catch(() => ({})) : res;
          errors.push(errData.detail || `Save failure`);
        }
      } catch (err: any) {
        failureCount++;
        errors.push(err.message || "Network error");
      }
    }

    setIsSaving(false);
    setWarningModalState({ isOpen: false, message: "", pendingItems: [] });

    if (successCount > 0) {
      if (onRefreshProducts) await onRefreshProducts();
      if (onNotification) {
        onNotification(
          "Items Saved",
          `Successfully saved ${successCount} item(s) to catalogue.${failureCount > 0 ? ` (${failureCount} failed)` : ""}`,
          failureCount > 0 ? "error" : "success"
        );
      }
      // Reset grid
      setRows([]);
    } else {
      if (onNotification) {
        onNotification("Save Failed", `Failed to save items: ${errors.join(", ")}`, "error");
      }
    }
  };

  const handleInitiateSave = () => {
    const validRows = rows.filter(r => (r.product && r.product.trim()) || (r.stockNo && r.stockNo.trim()));
    if (validRows.length === 0) {
      if (onNotification) {
        onNotification("No Data", "Please enter at least one product line item before saving.", "error");
      }
      return;
    }

    // Check for new combination check (e.g. brand + category combination)
    const newCombinations: string[] = [];
    validRows.forEach(r => {
      const b = r.brand || commonFieldValues.brand;
      const c = r.product || commonFieldValues.category;
      if (b && c) {
        const combo = `${b} / ${c}`;
        if (!newCombinations.includes(combo)) {
          newCombinations.push(combo);
        }
      }
    });

    if (newCombinations.length > 0 && currentUser?.role !== "Admin") {
      setWarningModalState({
        isOpen: true,
        message: `Combination of [${newCombinations[0]}] requires confirmation. Do you wish to continue and save these ${validRows.length} item(s) to the catalog?`,
        pendingItems: validRows
      });
      return;
    }

    // Directly commit
    executeCommitItems(validRows);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 p-4 space-y-4">
      
      {/* Context Top Navigation Bar with Tabs */}
      <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-6 py-3 shadow-xs">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Item Master Entry
          </h1>
          <p className="text-xs text-slate-500">
            Smriti Prime Tactical Catalog Grid & Master Data Application
          </p>
        </div>

        {/* Tactical Sub-Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveSubTab("view")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === "view"
                ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>View</span>
            <span className="text-[10px] opacity-70 font-mono font-normal">(Alt+1)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("common")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === "common"
                ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Common Fields</span>
            <span className="text-[10px] opacity-70 font-mono font-normal">(Alt+2)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("details")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === "details"
                ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Item Details</span>
            <span className="text-[10px] opacity-70 font-mono font-normal">(Alt+3)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("bulk_studio" as any)}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === ("bulk_studio" as any)
                ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">table_chart</span>
            <span>Bulk Paste Studio</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab View Switching */}
      <div className="flex-1 overflow-hidden min-h-[500px]">
        {activeSubTab === "view" && (
          <FieldSelectionViewTab
            selectedFieldIds={selectedFieldIds}
            onSaveSelection={handleSaveFieldSelection}
            onCancel={() => setActiveSubTab("details")}
            onNotification={onNotification}
            allAvailableFields={allAvailableFields}
          />
        )}

        {activeSubTab === "common" && (
          <CommonFieldsTab
            initialValues={commonFieldValues}
            onSaveCommonFields={handleSaveCommonFields}
            onNotification={onNotification}
            onNavigateToDetails={() => setActiveSubTab("details")}
          />
        )}

        {activeSubTab === "details" && (
          <ItemDetailsGridTab
            selectedFieldIds={selectedFieldIds}
            commonFieldValues={commonFieldValues}
            rows={rows}
            onRowsChange={setRows}
            onSaveRows={handleInitiateSave}
            onCancel={() => setRows([])}
            isSaving={isSaving}
            onNotification={onNotification}
            allAvailableFields={allAvailableFields}
          />
        )}

        {(activeSubTab as string) === "bulk_studio" && (
          <SmritiItemMasterStudio
            onNotification={onNotification}
            onRefreshProducts={onRefreshProducts}
            currentUser={currentUser}
            onCancel={() => setActiveSubTab("details")}
          />
        )}
      </div>

      {/* Warning / Combination Confirmation Modal */}
      <ItemMasterSaveWarningModal
        isOpen={warningModalState.isOpen}
        message={warningModalState.message}
        onConfirm={() => executeCommitItems(warningModalState.pendingItems)}
        onCancel={() => setWarningModalState({ isOpen: false, message: "", pendingItems: [] })}
      />

    </div>
  );
};
