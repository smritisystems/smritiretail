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
  Settings2, 
  ChevronRight, 
  ChevronLeft, 
  ChevronsRight, 
  ChevronsLeft, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  Save, 
  RotateCcw,
  LayoutGrid,
  FileText
} from "lucide-react";

export interface ViewConfigState {
  viewMode: "grid" | "classic";
  visibleColumns: string[];
  frozenColumns: number;
}

interface SmritiViewConfigurationProps {
  availableFields: { key: string; label: string }[];
  currentConfig: ViewConfigState;
  onSaveConfig: (config: ViewConfigState) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const SmritiViewConfiguration: React.FC<SmritiViewConfigurationProps> = ({
  availableFields,
  currentConfig,
  onSaveConfig,
  onNotification
}) => {
  const [viewMode, setViewMode] = useState<"grid" | "classic">(currentConfig.viewMode || "grid");
  const [frozenColumns, setFrozenColumns] = useState<number>(currentConfig.frozenColumns ?? 2);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    return currentConfig.visibleColumns && currentConfig.visibleColumns.length > 0
      ? currentConfig.visibleColumns
      : availableFields.slice(0, 10).map(f => f.key);
  });

  const [searchAvailable, setSearchAvailable] = useState<string>("");
  const [searchSelected, setSearchSelected] = useState<string>("");
  const [activeAvailableKey, setActiveAvailableKey] = useState<string | null>(null);
  const [activeSelectedKey, setActiveSelectedKey] = useState<string | null>(null);

  // Computed unselected fields
  const unselectedFields = availableFields.filter(f => !selectedColumns.includes(f.key));

  const filteredAvailable = unselectedFields.filter(f => 
    f.label.toLowerCase().includes(searchAvailable.toLowerCase()) ||
    f.key.toLowerCase().includes(searchAvailable.toLowerCase())
  );

  const filteredSelected = selectedColumns
    .map(key => availableFields.find(f => f.key === key) || { key, label: key })
    .filter(f => 
      f.label.toLowerCase().includes(searchSelected.toLowerCase()) ||
      f.key.toLowerCase().includes(searchSelected.toLowerCase())
    );

  const handleMoveRight = () => {
    if (!activeAvailableKey) return;
    setSelectedColumns(prev => [...prev, activeAvailableKey]);
    setActiveAvailableKey(null);
  };

  const handleMoveAllRight = () => {
    setSelectedColumns(availableFields.map(f => f.key));
  };

  const handleMoveLeft = () => {
    if (!activeSelectedKey) return;
    setSelectedColumns(prev => prev.filter(k => k !== activeSelectedKey));
    setActiveSelectedKey(null);
  };

  const handleMoveAllLeft = () => {
    // Keep at least the code column
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

  const handleSave = () => {
    onSaveConfig({
      viewMode,
      visibleColumns: selectedColumns,
      frozenColumns
    });
    onNotification?.("Configuration Saved", "Grid view columns and layout preferences updated.", "success");
  };

  return (
    <div className="h-full flex flex-col bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] font-sans p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#c6c6cd] dark:border-[#45464d]">
          <div>
            <h1 className="text-xl font-bold text-[#003d9b] dark:text-[#b2c5ff] flex items-center gap-2">
              <Settings2 size={22} />
              View Configuration
            </h1>
            <p className="text-xs text-[#515f74] dark:text-[#bec6e0] mt-0.5">
              Configure visible columns, ordering, and default entry presentation modes.
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

        {/* Frozen Columns Setting */}
        <div className="bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#191c1e] dark:text-white uppercase tracking-wider">Frozen Columns (Left Pinned)</h3>
            <p className="text-[11px] text-[#76777d]">Lock left-side identifier columns when scrolling horizontally through item records.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={5}
              value={frozenColumns}
              onChange={e => setFrozenColumns(Number(e.target.value))}
              className="w-16 h-8 px-2 border border-[#c6c6cd] dark:border-[#45464d] rounded text-center font-mono font-bold text-xs bg-[#f2f4f6] dark:bg-[#191c1e]"
            />
            <span className="text-xs text-[#515f74] dark:text-[#bec6e0] font-semibold">Columns</span>
          </div>
        </div>

        {/* Dual List Selector */}
        <div className="bg-white dark:bg-[#2d3133] rounded-xl border border-[#c6c6cd] dark:border-[#45464d] p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#191c1e] dark:text-white">Fields to Display &amp; Column Order</h3>
            <p className="text-xs text-[#76777d]">Select available fields and reorder their position in the Item Details Grid.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center h-[380px]">
            
            {/* Left: Available Fields */}
            <div className="md:col-span-5 h-full flex flex-col border border-[#c6c6cd] dark:border-[#45464d] rounded-lg bg-[#f7f9fb] dark:bg-[#191c1e] overflow-hidden">
              <div className="px-3 py-2 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex justify-between items-center text-xs font-bold">
                <span>Available Fields</span>
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
                {filteredAvailable.map(f => (
                  <li
                    key={f.key}
                    onClick={() => setActiveAvailableKey(f.key)}
                    className={`px-3 py-2 cursor-pointer rounded transition flex items-center justify-between ${
                      activeAvailableKey === f.key
                        ? "bg-[#d5e3fd] text-[#0d1c2f] font-bold"
                        : "hover:bg-[#f2f4f6] dark:hover:bg-[#2d3133]"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="font-mono text-[10px] text-[#76777d]">{f.key}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Middle: Transfer Buttons */}
            <div className="md:col-span-1 flex md:flex-col justify-center items-center gap-2">
              <button
                type="button"
                onClick={handleMoveRight}
                disabled={!activeAvailableKey}
                className="w-8 h-8 rounded bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#0052cc] hover:text-white flex items-center justify-center transition disabled:opacity-30 shadow-xs"
                title="Add Selected"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={handleMoveAllRight}
                className="w-8 h-8 rounded bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#0052cc] hover:text-white flex items-center justify-center transition shadow-xs"
                title="Add All"
              >
                <ChevronsRight size={16} />
              </button>
              <button
                type="button"
                onClick={handleMoveLeft}
                disabled={!activeSelectedKey}
                className="w-8 h-8 rounded bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#0052cc] hover:text-white flex items-center justify-center transition disabled:opacity-30 shadow-xs"
                title="Remove Selected"
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

            {/* Right: Selected Columns */}
            <div className="md:col-span-5 h-full flex flex-col border border-[#c6c6cd] dark:border-[#45464d] rounded-lg bg-[#f7f9fb] dark:bg-[#191c1e] overflow-hidden">
              <div className="px-3 py-2 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex justify-between items-center text-xs font-bold">
                <span>Selected Columns ({selectedColumns.length})</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleMoveUp}
                    disabled={!activeSelectedKey}
                    className="p-1 hover:bg-[#eceef0] rounded disabled:opacity-30"
                    title="Move Column Up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleMoveDown}
                    disabled={!activeSelectedKey}
                    className="p-1 hover:bg-[#eceef0] rounded disabled:opacity-30"
                    title="Move Column Down"
                  >
                    <ArrowDown size={14} />
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
          <div className="pt-4 border-t border-[#eceef0] dark:border-[#45464d] flex justify-end gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
            >
              <Save size={14} />
              Save View Configuration
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SmritiViewConfiguration;
