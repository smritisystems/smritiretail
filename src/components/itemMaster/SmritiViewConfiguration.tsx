/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.5.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  saveGlobalColumnOrder, 
  getGlobalFieldVisibility, 
  getUnifiedItemMasterFields 
} from "../../services/unifiedFieldCatalog.ts";
import { getCustomFieldLabels } from "../../lib/headerMapping/HeaderAliasRegistry.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { AttributeDefinition } from "../../types.ts";
import { 
  Settings2, 
  ChevronRight, 
  ChevronLeft, 
  ChevronsRight, 
  ChevronsLeft, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpToLine,
  ArrowDownToLine,
  Search, 
  Save, 
  RotateCcw,
  LayoutGrid,
  FileText,
  Sparkles,
  Check
} from "lucide-react";

export interface ViewConfigState {
  viewMode: "grid" | "classic";
  visibleColumns: string[];
  frozenColumns: number;
}

interface SmritiViewConfigurationProps {
  availableFields?: { key: string; label: string }[];
  currentConfig: ViewConfigState;
  onSaveConfig: (config: ViewConfigState) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info") => void;
}

const PRESET_ESSENTIAL = [
  "code", "barcode", "name", "brand", "colour", "size", "mrp", "price"
];

const PRESET_STANDARD = [
  "code", "barcode", "name", "brand", "styleCode", "colour", "size",
  "category", "subCategory", "mrp", "price", "costPrice", "gst_percentage", "hsn_code"
];

export const SmritiViewConfiguration: React.FC<SmritiViewConfigurationProps> = ({
  availableFields: propAvailableFields,
  currentConfig,
  onSaveConfig,
  onNotification
}) => {
  const [dynamicDefinitions, setDynamicDefinitions] = useState<AttributeDefinition[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "classic">(currentConfig.viewMode || "grid");
  const [frozenColumns, setFrozenColumns] = useState<number>(currentConfig.frozenColumns ?? 2);

  // Load dynamic attributes to ensure complete list of available fields
  useEffect(() => {
    let isMounted = true;
    apiFetchV1("/attributes/definitions").then(defs => {
      if (isMounted && Array.isArray(defs)) {
        setDynamicDefinitions(defs);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Complete list of all system fields (standard + dynamic) with custom labels
  const allSystemFields = useMemo(() => {
    const customLabels = getCustomFieldLabels();
    const unified = getUnifiedItemMasterFields(dynamicDefinitions);
    
    if (unified && unified.length > 0) {
      return unified.map(f => ({
        key: f.key,
        label: customLabels[f.key] || f.label
      }));
    }

    if (propAvailableFields && propAvailableFields.length > 0) {
      return propAvailableFields.map(f => ({
        key: f.key,
        label: customLabels[f.key] || f.label
      }));
    }

    return [];
  }, [dynamicDefinitions, propAvailableFields]);

  // Active selected columns list
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    const globalVisible = getGlobalFieldVisibility();
    if (globalVisible && globalVisible.length > 0) {
      return globalVisible;
    }
    if (currentConfig.visibleColumns && currentConfig.visibleColumns.length > 0) {
      return currentConfig.visibleColumns;
    }
    return PRESET_STANDARD;
  });

  const [searchAvailable, setSearchAvailable] = useState<string>("");
  const [searchSelected, setSearchSelected] = useState<string>("");
  const [activeAvailableKey, setActiveAvailableKey] = useState<string | null>(null);
  const [activeSelectedKey, setActiveSelectedKey] = useState<string | null>(null);

  // Sync selectedColumns if global visibility updates
  useEffect(() => {
    const globalVisible = getGlobalFieldVisibility();
    if (globalVisible && globalVisible.length > 0) {
      setSelectedColumns(globalVisible);
    }
  }, []);

  // Computed unselected fields
  const unselectedFields = useMemo(() => {
    return allSystemFields.filter(f => !selectedColumns.includes(f.key));
  }, [allSystemFields, selectedColumns]);

  const filteredAvailable = useMemo(() => {
    return unselectedFields.filter(f => 
      f.label.toLowerCase().includes(searchAvailable.toLowerCase()) ||
      f.key.toLowerCase().includes(searchAvailable.toLowerCase())
    );
  }, [unselectedFields, searchAvailable]);

  const filteredSelected = useMemo(() => {
    const customLabels = getCustomFieldLabels();
    return selectedColumns
      .map(key => {
        const found = allSystemFields.find(f => f.key === key);
        return found ? { key: found.key, label: customLabels[found.key] || found.label } : { key, label: key.toUpperCase() };
      })
      .filter(f => 
        f.label.toLowerCase().includes(searchSelected.toLowerCase()) ||
        f.key.toLowerCase().includes(searchSelected.toLowerCase())
      );
  }, [selectedColumns, allSystemFields, searchSelected]);

  // Actions
  const handleAddColumn = (keyToAdd: string) => {
    if (!keyToAdd || selectedColumns.includes(keyToAdd)) return;
    setSelectedColumns(prev => [...prev, keyToAdd]);
    setActiveAvailableKey(null);
    setActiveSelectedKey(keyToAdd);
  };

  const handleRemoveColumn = (keyToRemove: string) => {
    if (!keyToRemove) return;
    if (selectedColumns.length <= 1) {
      onNotification?.("Action Restricted", "At least one column must remain visible in the grid.", "error");
      return;
    }
    setSelectedColumns(prev => prev.filter(k => k !== keyToRemove));
    if (activeSelectedKey === keyToRemove) setActiveSelectedKey(null);
  };

  const handleMoveRight = () => {
    if (activeAvailableKey) handleAddColumn(activeAvailableKey);
  };

  const handleMoveAllRight = () => {
    setSelectedColumns(allSystemFields.map(f => f.key));
  };

  const handleMoveLeft = () => {
    if (activeSelectedKey) handleRemoveColumn(activeSelectedKey);
  };

  const handleMoveAllLeft = () => {
    setSelectedColumns(["code"]);
  };

  const handleMoveUp = () => {
    if (!activeSelectedKey) return;
    const idx = selectedColumns.indexOf(activeSelectedKey);
    if (idx <= 0) return;
    const next = [...selectedColumns];
    const temp = next[idx - 1];
    next[idx - 1] = next[idx];
    next[idx] = temp;
    setSelectedColumns(next);
  };

  const handleMoveDown = () => {
    if (!activeSelectedKey) return;
    const idx = selectedColumns.indexOf(activeSelectedKey);
    if (idx < 0 || idx >= selectedColumns.length - 1) return;
    const next = [...selectedColumns];
    const temp = next[idx + 1];
    next[idx + 1] = next[idx];
    next[idx] = temp;
    setSelectedColumns(next);
  };

  const handleMoveToTop = () => {
    if (!activeSelectedKey) return;
    const idx = selectedColumns.indexOf(activeSelectedKey);
    if (idx <= 0) return;
    const next = [activeSelectedKey, ...selectedColumns.filter(k => k !== activeSelectedKey)];
    setSelectedColumns(next);
  };

  const handleMoveToBottom = () => {
    if (!activeSelectedKey) return;
    const idx = selectedColumns.indexOf(activeSelectedKey);
    if (idx < 0 || idx >= selectedColumns.length - 1) return;
    const next = [...selectedColumns.filter(k => k !== activeSelectedKey), activeSelectedKey];
    setSelectedColumns(next);
  };

  const handleApplyPreset = (presetKeys: string[], presetName: string) => {
    const validKeys = presetKeys.filter(k => allSystemFields.some(f => f.key === k));
    setSelectedColumns(validKeys.length > 0 ? validKeys : presetKeys);
    onNotification?.("Preset Applied", `Applied "${presetName}" column configuration. Click Save to commit globally.`, "info");
  };

  const handleSave = () => {
    saveGlobalColumnOrder(selectedColumns);
    onSaveConfig({
      viewMode,
      visibleColumns: selectedColumns,
      frozenColumns
    });
    onNotification?.("Global Configuration Saved", `Grid column arrangement & visibility updated globally across all modules, grids, forms, and reports (${selectedColumns.length} columns active).`, "success");
  };

  return (
    <div className="h-full flex flex-col bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] font-sans p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#c6c6cd] dark:border-[#45464d]">
          <div>
            <h1 className="text-xl font-bold text-[#003d9b] dark:text-[#b2c5ff] flex items-center gap-2">
              <Settings2 size={22} />
              View Configuration &amp; Global Column Arrangement
            </h1>
            <p className="text-xs text-[#515f74] dark:text-[#bec6e0] mt-0.5">
              Control global field visibility, sequence order, and default entry presentation modes across all screens.
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-[#e9edff] dark:bg-[#1d3054] p-1 rounded-lg border border-[#c4d2ff] dark:border-[#434654]">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-4 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "grid"
                  ? "bg-white dark:bg-[#131b2e] text-[#0052cc] dark:text-[#dae2ff] shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0] hover:text-[#0052cc]"
              }`}
            >
              <LayoutGrid size={14} />
              Grid View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("classic")}
              className={`px-4 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "classic"
                  ? "bg-white dark:bg-[#131b2e] text-[#0052cc] dark:text-[#dae2ff] shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0] hover:text-[#0052cc]"
              }`}
            >
              <FileText size={14} />
              Classic View
            </button>
          </div>
        </div>

        {/* Presets & Frozen Columns Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Quick Presets */}
          <div className="bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-2">
            <div>
              <h3 className="text-xs font-bold text-[#191c1e] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#0052cc] dark:text-[#b2c5ff]" />
                Layout Presets
              </h3>
              <p className="text-[11px] text-[#76777d]">One-click configurations for common retail and inventory roles.</p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleApplyPreset(PRESET_ESSENTIAL, "Essential Retail (8 Cols)")}
                className="px-2.5 py-1 bg-[#f2f4f6] dark:bg-[#191c1e] hover:bg-[#d5e3fd] text-xs font-bold rounded border border-[#c6c6cd] transition"
              >
                Essential (8)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(PRESET_STANDARD, "Standard Merchandising (14 Cols)")}
                className="px-2.5 py-1 bg-[#f2f4f6] dark:bg-[#191c1e] hover:bg-[#d5e3fd] text-xs font-bold rounded border border-[#c6c6cd] transition"
              >
                Standard (14)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(allSystemFields.map(f => f.key), "Full Catalog (All Columns)")}
                className="px-2.5 py-1 bg-[#f2f4f6] dark:bg-[#191c1e] hover:bg-[#d5e3fd] text-xs font-bold rounded border border-[#c6c6cd] transition"
              >
                All Fields ({allSystemFields.length})
              </button>
            </div>
          </div>

          {/* Frozen Columns Setting */}
          <div className="bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#191c1e] dark:text-white uppercase tracking-wider">Frozen Columns (Left Pinned)</h3>
              <p className="text-[11px] text-[#76777d]">Lock left-side identifier columns when scrolling horizontally.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={5}
                value={frozenColumns}
                onChange={e => setFrozenColumns(Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
                className="w-16 h-8 px-2 border border-[#c6c6cd] dark:border-[#45464d] rounded text-center font-mono font-bold text-xs bg-[#f2f4f6] dark:bg-[#191c1e]"
              />
              <span className="text-xs text-[#515f74] dark:text-[#bec6e0] font-semibold">Columns</span>
            </div>
          </div>

        </div>

        {/* Dual List Selector */}
        <div className="bg-white dark:bg-[#2d3133] rounded-xl border border-[#c6c6cd] dark:border-[#45464d] p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-[#191c1e] dark:text-white">Fields to Display &amp; Column Order</h3>
              <p className="text-xs text-[#76777d]">
                Double-click or use arrows to move fields. Rearrange the order on the right to set global column positions.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold font-mono">
              <span className="text-[#0c9488] bg-[#dcfce7] dark:bg-[#166534]/40 px-2 py-0.5 rounded">
                {selectedColumns.length} Visible
              </span>
              <span className="text-[#76777d] bg-[#f2f4f6] dark:bg-[#191c1e] px-2 py-0.5 rounded">
                {unselectedFields.length} Hidden
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center h-[420px]">
            
            {/* Left: Available Fields (Hidden/Unselected) */}
            <div className="md:col-span-5 h-full flex flex-col border border-[#c6c6cd] dark:border-[#45464d] rounded-lg bg-[#f7f9fb] dark:bg-[#191c1e] overflow-hidden">
              <div className="px-3 py-2 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex justify-between items-center text-xs font-bold">
                <span>Available Fields (Hidden)</span>
                <span className="font-mono bg-white dark:bg-[#2d3133] px-2 py-0.5 rounded text-[10px]">
                  {filteredAvailable.length}
                </span>
              </div>
              <div className="p-2 border-b border-[#c6c6cd] dark:border-[#45464d]">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#76777d]" />
                  <input
                    type="text"
                    value={searchAvailable}
                    onChange={e => setSearchAvailable(e.target.value)}
                    placeholder="Search available..."
                    className="w-full pl-7 pr-2 py-1 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs outline-none"
                  />
                </div>
              </div>
              <ul className="flex-1 overflow-y-auto p-1 divide-y divide-[#eceef0] dark:divide-[#2d3133] text-xs">
                {filteredAvailable.length === 0 ? (
                  <li className="p-4 text-center text-[#76777d] italic">No available fields.</li>
                ) : (
                  filteredAvailable.map(f => (
                    <li
                      key={f.key}
                      onClick={() => setActiveAvailableKey(f.key)}
                      onDoubleClick={() => handleAddColumn(f.key)}
                      className={`px-3 py-2 cursor-pointer rounded transition flex items-center justify-between ${
                        activeAvailableKey === f.key
                          ? "bg-[#d5e3fd] text-[#0d1c2f] font-bold"
                          : "hover:bg-[#f2f4f6] dark:hover:bg-[#2d3133]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{f.label}</span>
                      </div>
                      <span className="font-mono text-[10px] text-[#76777d]">{f.key}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Middle: Transfer Buttons */}
            <div className="md:col-span-1 flex md:flex-col justify-center items-center gap-2">
              <button
                type="button"
                onClick={handleMoveRight}
                disabled={!activeAvailableKey}
                className="w-8 h-8 rounded bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#0052cc] hover:text-white flex items-center justify-center transition disabled:opacity-30 shadow-xs"
                title="Add Selected Column"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={handleMoveAllRight}
                className="w-8 h-8 rounded bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#0052cc] hover:text-white flex items-center justify-center transition shadow-xs"
                title="Add All Columns"
              >
                <ChevronsRight size={16} />
              </button>
              <button
                type="button"
                onClick={handleMoveLeft}
                disabled={!activeSelectedKey}
                className="w-8 h-8 rounded bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#0052cc] hover:text-white flex items-center justify-center transition disabled:opacity-30 shadow-xs"
                title="Remove Selected Column"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleMoveAllLeft}
                className="w-8 h-8 rounded bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#0052cc] hover:text-white flex items-center justify-center transition shadow-xs"
                title="Reset to Minimum"
              >
                <ChevronsLeft size={16} />
              </button>
            </div>

            {/* Right: Selected Columns (Visible & Ordered) */}
            <div className="md:col-span-5 h-full flex flex-col border border-[#c6c6cd] dark:border-[#45464d] rounded-lg bg-[#f7f9fb] dark:bg-[#191c1e] overflow-hidden">
              <div className="px-3 py-2 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex justify-between items-center text-xs font-bold">
                <span>Selected Fields to Display ({selectedColumns.length})</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleMoveToTop}
                    disabled={!activeSelectedKey}
                    className="p-1 hover:bg-[#eceef0] dark:hover:bg-[#2d3133] rounded disabled:opacity-30"
                    title="Move to Top"
                  >
                    <ArrowUpToLine size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleMoveUp}
                    disabled={!activeSelectedKey}
                    className="p-1 hover:bg-[#eceef0] dark:hover:bg-[#2d3133] rounded disabled:opacity-30"
                    title="Move Column Up"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleMoveDown}
                    disabled={!activeSelectedKey}
                    className="p-1 hover:bg-[#eceef0] dark:hover:bg-[#2d3133] rounded disabled:opacity-30"
                    title="Move Column Down"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleMoveToBottom}
                    disabled={!activeSelectedKey}
                    className="p-1 hover:bg-[#eceef0] dark:hover:bg-[#2d3133] rounded disabled:opacity-30"
                    title="Move to Bottom"
                  >
                    <ArrowDownToLine size={13} />
                  </button>
                </div>
              </div>
              <div className="p-2 border-b border-[#c6c6cd] dark:border-[#45464d]">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#76777d]" />
                  <input
                    type="text"
                    value={searchSelected}
                    onChange={e => setSearchSelected(e.target.value)}
                    placeholder="Search selected..."
                    className="w-full pl-7 pr-2 py-1 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs outline-none"
                  />
                </div>
              </div>
              <ul className="flex-1 overflow-y-auto p-1 divide-y divide-[#eceef0] dark:divide-[#2d3133] text-xs">
                {filteredSelected.map((f, idx) => (
                  <li
                    key={f.key}
                    onClick={() => setActiveSelectedKey(f.key)}
                    onDoubleClick={() => handleRemoveColumn(f.key)}
                    className={`px-3 py-2 cursor-pointer rounded transition flex items-center justify-between ${
                      activeSelectedKey === f.key
                        ? "bg-[#d5e3fd] text-[#0d1c2f] font-bold"
                        : "hover:bg-[#f2f4f6] dark:hover:bg-[#2d3133]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#76777d]">{idx + 1}.</span>
                      <span>{f.label}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#76777d]">{f.key}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-[#eceef0] dark:border-[#45464d] flex justify-between items-center">
            <span className="text-[11px] text-[#515f74] dark:text-[#bec6e0]">
              Changes will instantly synchronize all grids, catalogs, and operational reports.
            </span>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] hover:bg-[#0f4c81] dark:hover:bg-white rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-xs"
            >
              <Save size={15} />
              Save View Configuration
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SmritiViewConfiguration;
