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

import React, { useState, useMemo } from "react";
import { 
  Lock, GripVertical, ChevronRight, ChevronsRight, 
  ChevronLeft, ChevronsLeft, ArrowUp, ArrowDown, Check, RotateCcw, Search 
} from "lucide-react";
import { 
  ItemMasterFieldDefinition, 
  ALL_AVAILABLE_ITEM_FIELDS, 
  DEFAULT_MANDATORY_FIELDS 
} from "../types.ts";

interface FieldSelectionViewTabProps {
  selectedFieldIds: string[];
  onSaveSelection: (newSelectedIds: string[]) => void;
  onCancel: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  allAvailableFields?: ItemMasterFieldDefinition[];
}

export const FieldSelectionViewTab: React.FC<FieldSelectionViewTabProps> = ({
  selectedFieldIds,
  onSaveSelection,
  onCancel,
  onNotification,
  allAvailableFields = ALL_AVAILABLE_ITEM_FIELDS
}) => {
  const [currentSelected, setCurrentSelected] = useState<string[]>(selectedFieldIds);
  const [activeUnselectedKey, setActiveUnselectedKey] = useState<string | null>(null);
  const [activeSelectedKey, setActiveSelectedKey] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  const mandatoryKeySet = useMemo(() => {
    return new Set(DEFAULT_MANDATORY_FIELDS.map(f => f.id));
  }, []);

  const fieldMap = useMemo(() => {
    const map = new Map<string, ItemMasterFieldDefinition>();
    allAvailableFields.forEach(f => map.set(f.id, f));
    return map;
  }, [allAvailableFields]);

  // Unselected fields list
  const unselectedFields = useMemo(() => {
    const selectedSet = new Set(currentSelected);
    return allAvailableFields.filter(f => !selectedSet.has(f.id)).filter(f => {
      if (!searchFilter.trim()) return true;
      return (
        f.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
        f.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
        f.key.toLowerCase().includes(searchFilter.toLowerCase())
      );
    });
  }, [currentSelected, searchFilter, allAvailableFields]);

  // Selected fields list (in exact order)
  const selectedFieldsList = useMemo(() => {
    return currentSelected.map(id => fieldMap.get(id) || {
      id,
      key: id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      isMandatory: false,
      type: "text" as const
    });
  }, [currentSelected, fieldMap]);

  // Transfer actions
  const handleAddSelected = () => {
    if (!activeUnselectedKey) return;
    if (!currentSelected.includes(activeUnselectedKey)) {
      setCurrentSelected(prev => [...prev, activeUnselectedKey]);
      setActiveUnselectedKey(null);
    }
  };

  const handleAddAll = () => {
    const toAdd = unselectedFields.map(f => f.id);
    setCurrentSelected(prev => [...prev, ...toAdd]);
    setActiveUnselectedKey(null);
  };

  const handleRemoveSelected = () => {
    if (!activeSelectedKey) return;
    if (mandatoryKeySet.has(activeSelectedKey)) {
      if (onNotification) onNotification("Locked Field", "Mandatory fields cannot be removed from catalog display.", "error");
      return;
    }
    setCurrentSelected(prev => prev.filter(id => id !== activeSelectedKey));
    setActiveSelectedKey(null);
  };

  const handleRemoveAll = () => {
    // Keep only mandatory fields
    const mandatoryOnly = currentSelected.filter(id => mandatoryKeySet.has(id));
    setCurrentSelected(mandatoryOnly);
    setActiveSelectedKey(null);
  };

  // Reorder actions
  const handleMoveUp = () => {
    if (!activeSelectedKey) return;
    const idx = currentSelected.indexOf(activeSelectedKey);
    if (idx <= 0) return;
    const next = [...currentSelected];
    const temp = next[idx - 1];
    next[idx - 1] = next[idx];
    next[idx] = temp;
    setCurrentSelected(next);
  };

  const handleMoveDown = () => {
    if (!activeSelectedKey) return;
    const idx = currentSelected.indexOf(activeSelectedKey);
    if (idx === -1 || idx >= currentSelected.length - 1) return;
    const next = [...currentSelected];
    const temp = next[idx + 1];
    next[idx + 1] = next[idx];
    next[idx] = temp;
    setCurrentSelected(next);
  };

  const handleSave = () => {
    onSaveSelection(currentSelected);
    if (onNotification) {
      onNotification("Fields Saved", `Catalog display updated with ${currentSelected.length} active columns.`, "success");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
      {/* Top Header Information */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
            Field Configuration & Matrix Columns
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select and arrange columns displayed in the high-velocity Item Details data grid.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCurrentSelected(selectedFieldIds);
            setActiveUnselectedKey(null);
            setActiveSelectedKey(null);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded transition"
        >
          <RotateCcw size={13} />
          Reset to Default
        </button>
      </div>

      {/* Split Pane Field Configuration */}
      <div className="flex-1 p-6 flex flex-col md:flex-row gap-6 overflow-hidden min-h-[460px]">
        {/* Left: Unselected Fields List */}
        <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/40 overflow-hidden shadow-inner">
          <div className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Unselected Fields
            </span>
            <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded">
              {unselectedFields.length} Available
            </span>
          </div>

          {/* Search Filter */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search available fields..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Unselected Items Container */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {unselectedFields.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No unselected fields</div>
            ) : (
              unselectedFields.map(f => {
                const isSelected = activeUnselectedKey === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setActiveUnselectedKey(f.id)}
                    className={`px-3 py-2 text-xs rounded border transition cursor-pointer flex justify-between items-center ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 font-semibold"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{f.label}</span>
                      {f.isDynamic && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold px-1.5 py-0.2 rounded">
                          Dynamic
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{f.type}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Transfer Controls */}
        <div className="flex md:flex-col justify-center items-center gap-2 shrink-0 py-2">
          <button
            type="button"
            onClick={handleAddSelected}
            disabled={!activeUnselectedKey}
            className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-blue-600 hover:text-blue-600 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            title="Add Selected Field"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={handleAddAll}
            disabled={unselectedFields.length === 0}
            className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-blue-600 hover:text-blue-600 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            title="Add All Fields"
          >
            <ChevronsRight size={18} />
          </button>
          <button
            type="button"
            onClick={handleRemoveSelected}
            disabled={!activeSelectedKey || mandatoryKeySet.has(activeSelectedKey)}
            className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-blue-600 hover:text-blue-600 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm mt-0 md:mt-4"
            title="Remove Selected Field"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={handleRemoveAll}
            className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-blue-600 hover:text-blue-600 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            title="Remove All Non-Mandatory Fields"
          >
            <ChevronsLeft size={18} />
          </button>
        </div>

        {/* Right: Selected Fields List */}
        <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Selected Fields (Active Columns)
            </span>
            <span className="bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
              {currentSelected.length} Active
            </span>
          </div>

          {/* Selected Items Container */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {selectedFieldsList.map(f => {
              const isMandatory = mandatoryKeySet.has(f.id);
              const isActive = activeSelectedKey === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => setActiveSelectedKey(f.id)}
                  className={`px-3 py-2 text-xs rounded border transition flex justify-between items-center ${
                    isMandatory
                      ? "bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 cursor-default"
                      : isActive
                      ? "bg-blue-50 dark:bg-blue-950/40 border-l-4 border-l-blue-600 border-t-blue-300 border-r-blue-300 border-b-blue-300 text-blue-900 dark:text-blue-200 font-bold cursor-pointer"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isMandatory ? (
                      <Lock size={13} className="text-slate-400" />
                    ) : (
                      <GripVertical size={14} className="text-slate-400" />
                    )}
                    <span className={isMandatory ? "font-semibold text-slate-600 dark:text-slate-400" : ""}>
                      {f.label}
                    </span>
                    {f.isDynamic && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold px-1.5 py-0.2 rounded">
                        Dynamic
                      </span>
                    )}
                  </div>
                  {isMandatory && (
                    <span className="text-[10px] uppercase tracking-wider bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-semibold">
                      Required
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Far Right: Reorder Controls */}
        <div className="flex md:flex-col justify-center items-center gap-2 shrink-0 py-2">
          <button
            type="button"
            onClick={handleMoveUp}
            disabled={!activeSelectedKey || currentSelected.indexOf(activeSelectedKey) <= 0}
            className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-blue-600 hover:text-blue-600 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            title="Move Column Left / Up"
          >
            <ArrowUp size={18} />
          </button>
          <button
            type="button"
            onClick={handleMoveDown}
            disabled={!activeSelectedKey || currentSelected.indexOf(activeSelectedKey) >= currentSelected.length - 1}
            className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-blue-600 hover:text-blue-600 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            title="Move Column Right / Down"
          >
            <ArrowDown size={18} />
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-6 py-3.5 flex justify-end gap-3 items-center shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xs font-semibold transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow"
        >
          <Check size={15} />
          Save Field Selections
        </button>
      </div>
    </div>
  );
};
