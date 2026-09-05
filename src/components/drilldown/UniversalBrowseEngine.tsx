/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 2.0.0
 * Created      : 2026-09-02
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * UniversalBrowseEngine — F2 Universal Lookup Architecture v2
 *
 * Promoted and refactored from GlobalF2BrowseDlg.tsx v6.0.0.
 *
 * KEY DIFFERENCES FROM GlobalF2BrowseDlg:
 *   1. State-driven via F2DispatcherContext (not ActiveFieldContext)
 *   2. Result returned via FieldAdapter callback (not insertValueIntoActiveField)
 *   3. Product-domain fetches /api/v1/variants (NOT /api/v1/products)
 *   4. Entity resolved from LOOKUP_REGISTRY (not hardcoded tab list)
 *   5. F2 inside this modal is explicitly blocked (re-entry guard in F2Dispatcher)
 *   6. Typed LookupResult with itemId / variantId / barcodeId
 *   7. Focus restoration is handled by F2Dispatcher.closeLookup()
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  X,
  Layers,
  Package,
  Users,
  Building2,
  Percent,
  Hash,
  UserCheck,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  CornerDownLeft,
  Image as ImageIcon,
  MapPin,
  Store,
  Filter,
  Palette,
  Ruler,
  Tag,
  Scissors,
  Sun,
  Scale,
  FileText,
  Check,
} from "lucide-react";
import { useF2Dispatcher } from "../../context/F2DispatcherContext.tsx";
import type { LookupResult, LookupEntity } from "../../context/F2DispatcherContext.tsx";
import { LOOKUP_REGISTRY, resolveLookupEntry } from "../../services/f2LookupRegistry.ts";
import type { LookupColumnDef } from "../../services/f2LookupRegistry.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { getCustomers } from "../../services/customerStore.ts";

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN FILTER TYPES
// ─────────────────────────────────────────────────────────────────────────────

type FilterCondition = "Contains" | "Equal" | "Starts With" | "Greater Than" | "Less Than";

interface ColumnFilterCriteria {
  condition: FilterCondition;
  value: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB DEFINITIONS (22 entities, ordered for display)
// ─────────────────────────────────────────────────────────────────────────────

const ENTITY_TAB_DEFS: Array<{ id: LookupEntity; label: string; icon: React.ElementType }> = [
  { id: "variant",        label: "Stock / Variants",  icon: Package },
  { id: "customer",       label: "Customer",          icon: Users },
  { id: "supplier",       label: "Supplier / Party",  icon: Building2 },
  { id: "item",           label: "Item / Style",      icon: Layers },
  { id: "item_barcode",   label: "Barcode",           icon: Search },
  { id: "article",        label: "Article",           icon: Tag },
  { id: "color",          label: "Color / Shade",     icon: Palette },
  { id: "size",           label: "Size",              icon: Ruler },
  { id: "brand",          label: "Brand",             icon: Tag },
  { id: "department",     label: "Department",        icon: Layers },
  { id: "section",        label: "Section",           icon: Scissors },
  { id: "fabric",         label: "Fabric",            icon: Layers },
  { id: "fit",            label: "Fit",               icon: Scissors },
  { id: "season",         label: "Season",            icon: Sun },
  { id: "category",       label: "Category",          icon: Layers },
  { id: "uom",            label: "UOM",               icon: Scale },
  { id: "store",          label: "Chain Stores",      icon: Store },
  { id: "hsn",            label: "HSN / GST",         icon: Hash },
  { id: "staff",          label: "Sales Staff",       icon: UserCheck },
  { id: "scheme",         label: "Scheme / Promo",    icon: Percent },
  { id: "terms",          label: "Terms",             icon: FileText },
  { id: "invoice",        label: "Invoice",           icon: FileText },
  { id: "classification", label: "Classification",    icon: Layers },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: build a LookupResult from a raw row record
// ─────────────────────────────────────────────────────────────────────────────

function buildLookupResult(entity: LookupEntity, row: Record<string, unknown>): LookupResult {
  const entry = resolveLookupEntry(entity);
  const returnValue =
    (entry ? String(row[entry.defaultReturnField] ?? "") : "") ||
    String(row["code"] ?? row["sku"] ?? row["id"] ?? "");
  const displayValue =
    (entry ? String(row[entry.defaultDisplayField] ?? "") : "") ||
    String(row["name"] ?? "");

  const result: LookupResult = {
    contractVersion: "2.0.0",
    entity,
    id: String(row["id"] ?? ""),
    returnValue,
    displayValue,
    record: row,
  };

  // Canonical identity fields
  if (entity === "variant" || entity === "item" || entity === "item_barcode") {
    result.itemId   = String(row["item_id"]    ?? row["itemId"]    ?? "");
    result.variantId = String(row["variant_id"] ?? row["variantId"] ?? row["id"] ?? "");
  }
  if (entity === "item_barcode") {
    result.barcodeId = String(row["barcode_id"] ?? row["id"] ?? "");
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const UniversalBrowseEngine: React.FC = () => {
  const { isOpen, resolvedEntity, initialSearchValue, commitResult, closeLookup } =
    useF2Dispatcher();

  // Active entity tab (defaults to resolved entity)
  const [activeTab, setActiveTab] = useState<LookupEntity>("variant");
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);

  // Column config (persisted per entity to localStorage)
  const [columns, setColumns] = useState<Record<string, LookupColumnDef[]>>(() => {
    try {
      const saved = localStorage.getItem("smriti_f2_v2_columns");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    // Default from registry
    const defaults: Record<string, LookupColumnDef[]> = {};
    Object.entries(LOOKUP_REGISTRY).forEach(([entity, entry]) => {
      if (entry) defaults[entity] = [...entry.displayColumns];
    });
    return defaults;
  });

  // Filter state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterCriteria>>({});
  const [anyColumnFilter, setAnyColumnFilter] = useState("");
  const [bottomSearchCol, setBottomSearchCol] = useState("all");
  const [bottomSearchVal, setBottomSearchVal] = useState("");

  // Data fetched for the active entity
  const [entityData, setEntityData] = useState<Record<string, Record<string, unknown>[]>>({});
  const [loading, setLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // ── Sync tab and initial search when the dialog opens ──────────────────────
  useEffect(() => {
    if (isOpen && resolvedEntity) {
      setActiveTab(resolvedEntity);
      setSelectedRowIndex(0);
      setPage(1);
      setAnyColumnFilter(initialSearchValue || "");
      setBottomSearchVal(initialSearchValue || "");
      setColumnFilters({});
    }
  }, [isOpen, resolvedEntity, initialSearchValue]);

  // ── Fetch data for the current tab ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const token =
      localStorage.getItem("smriti_jwt_token") ||
      localStorage.getItem("smriti_session_token");
    if (!token) return;
    if (entityData[activeTab]?.length) return; // already loaded

    const entry = resolveLookupEntry(activeTab);
    if (!entry) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === "customer") {
          // Customer store (may include offline cache)
          const custs = getCustomers();
          if (custs && custs.length > 0) {
            setEntityData(prev => ({ ...prev, customer: custs as unknown as Record<string, unknown>[] }));
            setLoading(false);
            return;
          }
        }

        // Canonical API fetch
        const resp = await apiFetchV1<unknown>(`${entry.endpoint}?page_size=${entry.defaultLimit}`);
        const rows: Record<string, unknown>[] = Array.isArray(resp)
          ? resp
          : ((resp as Record<string, unknown>)?.items as Record<string, unknown>[] ?? []);

        setEntityData(prev => ({ ...prev, [activeTab]: rows }));
      } catch (e) {
        console.warn(`[UniversalBrowseEngine] fetch failed for ${activeTab}:`, e);
        // Leave empty; no fallback seed data — per canonical policy
        setEntityData(prev => ({ ...prev, [activeTab]: [] }));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Current columns for active tab ────────────────────────────────────────
  const currentColumns = useMemo((): LookupColumnDef[] => {
    const saved = columns[activeTab];
    const defaults = LOOKUP_REGISTRY[activeTab]?.displayColumns ?? [];
    return saved ?? [...defaults];
  }, [columns, activeTab]);

  // ── Raw dataset ────────────────────────────────────────────────────────────
  const rawDataset = useMemo(() => entityData[activeTab] ?? [], [entityData, activeTab]);

  // ── Filtered records ───────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let list = [...rawDataset];

    if (anyColumnFilter.trim()) {
      const q = anyColumnFilter.toLowerCase().trim();
      list = list.filter(row =>
        Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q))
      );
    }

    currentColumns.forEach(col => {
      const filter = columnFilters[col.key];
      if (filter?.value.trim()) {
        const val = filter.value.toLowerCase().trim();
        list = list.filter(row => {
          const rawVal = row[col.key];
          if (rawVal == null) return false;
          const sVal = String(rawVal).toLowerCase();
          switch (filter.condition) {
            case "Equal":       return sVal === val;
            case "Starts With": return sVal.startsWith(val);
            case "Greater Than":return parseFloat(sVal) > parseFloat(val);
            case "Less Than":   return parseFloat(sVal) < parseFloat(val);
            default:            return sVal.includes(val);
          }
        });
      }
    });

    if (bottomSearchVal.trim()) {
      const q = bottomSearchVal.toLowerCase().trim();
      if (bottomSearchCol === "all") {
        list = list.filter(row =>
          Object.values(row).some(v => v && String(v).toLowerCase().includes(q))
        );
      } else {
        list = list.filter(row => {
          const v = row[bottomSearchCol];
          return v && String(v).toLowerCase().includes(q);
        });
      }
    }

    return list;
  }, [rawDataset, anyColumnFilter, columnFilters, currentColumns, bottomSearchVal, bottomSearchCol]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page]);

  const activeSelectedItem = useMemo(
    () => (paginatedRecords[selectedRowIndex] ?? paginatedRecords[0] ?? null),
    [paginatedRecords, selectedRowIndex]
  );

  // ── Commit selection via FieldAdapter ──────────────────────────────────────
  const handleCommitSelection = (rawRow?: Record<string, unknown>) => {
    const row = rawRow ?? activeSelectedItem;
    if (!row) return;
    const result = buildLookupResult(activeTab, row);
    commitResult(result);
  };

  // ── Column config helpers ──────────────────────────────────────────────────
  const handleMoveColumn = (idx: number, dir: "UP" | "DOWN") => {
    const targetIdx = dir === "UP" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentColumns.length) return;
    setColumns(prev => {
      const next = [...(prev[activeTab] ?? LOOKUP_REGISTRY[activeTab]?.displayColumns ?? [])];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return { ...prev, [activeTab]: next };
    });
  };

  const handleToggleColumnVisibility = (idx: number) => {
    setColumns(prev => {
      const next = [...(prev[activeTab] ?? LOOKUP_REGISTRY[activeTab]?.displayColumns ?? [])];
      next[idx] = { ...next[idx], visible: !next[idx].visible };
      return { ...prev, [activeTab]: next };
    });
  };

  const handleSaveSettings = () => {
    try { localStorage.setItem("smriti_f2_v2_columns", JSON.stringify(columns)); } catch { /* ignore */ }
  };

  const handleApplyDefault = () => {
    const defaults = LOOKUP_REGISTRY[activeTab]?.displayColumns ?? [];
    setColumns(prev => ({ ...prev, [activeTab]: [...defaults] }));
    setColumnFilters({});
    setAnyColumnFilter("");
    setBottomSearchVal("");
  };

  const handleClearFilters = () => {
    setColumnFilters({});
    setAnyColumnFilter("");
    setBottomSearchVal("");
  };

  // ── Keyboard navigation (scoped to the dialog) ─────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedRowIndex(p => Math.min(p + 1, paginatedRecords.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedRowIndex(p => Math.max(p - 1, 0));
        break;
      case "PageDown":
        e.preventDefault();
        setPage(p => Math.min(p + 1, totalPages));
        setSelectedRowIndex(0);
        break;
      case "PageUp":
        e.preventDefault();
        setPage(p => Math.max(p - 1, 1));
        setSelectedRowIndex(0);
        break;
      case "Home":
        e.preventDefault();
        setPage(1);
        setSelectedRowIndex(0);
        break;
      case "End":
        e.preventDefault();
        setPage(totalPages);
        setSelectedRowIndex(0);
        break;
      case "Enter":
        e.preventDefault();
        handleCommitSelection();
        break;
      case "Escape":
        e.preventDefault();
        closeLookup();
        break;
      case "F2":
        // Re-entry guard — F2 inside the modal is a no-op (also guarded in dispatcher)
        e.preventDefault();
        e.stopPropagation();
        break;
      default:
        break;
    }
  };

  // ── Guard: not authenticated or not open ───────────────────────────────────
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token")
      : null;

  if (!isOpen || !token) return null;

  // ── Filter tabs to only those that have a registry entry ───────────────────
  const availableTabs = ENTITY_TAB_DEFS.filter(t => LOOKUP_REGISTRY[t.id]);

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 select-none animate-fadeIn font-sans"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Universal Lookup — ${resolvedEntity ?? "Search"}`}
    >
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] overflow-hidden flex flex-col">

        {/* ====================================================================
            1. TOP HEADER & CATEGORY RIBBON
            ==================================================================== */}
        <header className="px-4 py-2.5 bg-[#edeae1] dark:bg-[#131b2e] border-b border-[#c4c5d5] dark:border-[#444653] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#00288e] text-white rounded-lg shadow-xs">
              <Filter size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[#191c1d] dark:text-white">
                  Universal Master Browse &amp; Lookup Engine
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00288e] text-white">
                  F2 v2
                </span>
              </div>
              <p className="text-[11px] text-[#565e74] dark:text-[#bec6e0]">
                Entity:{" "}
                <span className="font-bold text-[#00288e] dark:text-[#a8b8ff]">
                  {activeTab}
                </span>
              </p>
            </div>
          </div>

          {/* Entity Tabs */}
          <div className="flex items-center gap-1 bg-[#f3f4f5] dark:bg-[#1d222e] p-1 rounded-xl border border-[#c4c5d5] dark:border-[#444653] overflow-x-auto max-w-[680px]">
            {availableTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPage(1);
                    setSelectedRowIndex(0);
                    setColumnFilters({});
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-[#00288e] text-white shadow-xs"
                      : "text-[#565e74] dark:text-[#bec6e0] hover:bg-[#edeae1] dark:hover:bg-[#2d3133]"
                  }`}
                >
                  <Icon size={12} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={closeLookup}
            className="text-[#565e74] hover:bg-[#f3f4f5] p-1.5 rounded-lg transition cursor-pointer"
            title="Close [Esc]"
          >
            <X size={18} />
          </button>
        </header>

        {/* ====================================================================
            2. SPLIT WORKSPACE
            ==================================================================== */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left Panel: Display / Search Selection */}
          {showFilterPanel && (
            <aside className="w-80 bg-[#f8f9fa] dark:bg-[#131b2e] border-r border-[#c4c5d5] dark:border-[#444653] flex flex-col shrink-0 overflow-hidden shadow-inner">
              <div className="p-2.5 bg-[#edeae1] dark:bg-[#1d222e] border-b border-[#c4c5d5] dark:border-[#444653] flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#00288e] dark:text-[#a8b8ff]">
                  Display / Search Selection
                </span>
                <button
                  type="button"
                  onClick={() => setShowFilterPanel(false)}
                  className="text-[10px] font-bold text-[#565e74] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>&lt;&lt; Hide</span>
                </button>
              </div>

              {/* Any Column Filter */}
              <div className="p-2.5 bg-white dark:bg-[#191c1e] border-b border-[#c4c5d5] dark:border-[#444653] space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] flex items-center gap-1">
                  <Filter size={10} />
                  <span>[Any Column] Filter</span>
                </label>
                <input
                  type="text"
                  value={anyColumnFilter}
                  onChange={e => { setAnyColumnFilter(e.target.value); setPage(1); }}
                  placeholder="Filter across any column..."
                  className="w-full h-7 px-2 bg-[#f8f9fa] dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#444653] rounded text-xs outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Column Selection & Hierarchical Criteria */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                <p className="text-[10px] text-[#565e74] dark:text-[#bec6e0] italic px-1">
                  Reorder using ▲/▼ to change hierarchical filtering sequence:
                </p>
                {currentColumns.map((col, idx) => {
                  const filter = columnFilters[col.key] ?? { condition: "Contains" as FilterCondition, value: "" };
                  return (
                    <div
                      key={col.key}
                      className={`p-2 rounded-lg border transition space-y-1 ${
                        col.visible
                          ? "bg-white dark:bg-[#191c1e] border-[#c4c5d5] dark:border-[#444653]"
                          : "bg-[#f3f4f5]/60 dark:bg-[#191c1e]/40 border-dashed border-[#c4c5d5]/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold">
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={() => handleToggleColumnVisibility(idx)}
                            className="rounded text-[#00288e]"
                          />
                          <span className="truncate max-w-[140px]">{col.label}</span>
                        </label>
                        <div className="flex items-center gap-0.5">
                          <button type="button" disabled={idx === 0} onClick={() => handleMoveColumn(idx, "UP")}
                            className="p-1 text-gray-500 hover:text-[#00288e] disabled:opacity-20 cursor-pointer" title="Move Up">
                            <ArrowUp size={11} />
                          </button>
                          <button type="button" disabled={idx === currentColumns.length - 1} onClick={() => handleMoveColumn(idx, "DOWN")}
                            className="p-1 text-gray-500 hover:text-[#00288e] disabled:opacity-20 cursor-pointer" title="Move Down">
                            <ArrowDown size={11} />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1 items-center pt-0.5">
                        <select
                          value={filter.condition}
                          onChange={e => { setColumnFilters(p => ({ ...p, [col.key]: { ...filter, condition: e.target.value as FilterCondition } })); setPage(1); }}
                          className="h-6 px-1 text-[10px] font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded bg-[#f8f9fa] dark:bg-[#131b2e] outline-none"
                        >
                          <option value="Contains">Contains</option>
                          <option value="Equal">Equal</option>
                          <option value="Starts With">Starts With</option>
                          <option value="Greater Than">&gt; (Greater)</option>
                          <option value="Less Than">&lt; (Less)</option>
                        </select>
                        <input
                          type="text"
                          value={filter.value}
                          onChange={e => { setColumnFilters(p => ({ ...p, [col.key]: { ...filter, value: e.target.value } })); setPage(1); }}
                          placeholder="Value..."
                          className="flex-1 h-6 px-1.5 text-[11px] border border-[#c4c5d5] dark:border-[#444653] rounded bg-white dark:bg-[#131b2e] outline-none focus:border-[#00288e]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Settings Buttons */}
              <div className="p-2 border-t border-[#c4c5d5] dark:border-[#444653] bg-[#edeae1] dark:bg-[#1d222e] flex justify-between gap-1.5">
                <button type="button" onClick={handleSaveSettings}
                  className="flex-1 py-1 px-2 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f3f4f5] text-[11px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer">
                  <Save size={11} /><span>Save</span>
                </button>
                <button type="button" onClick={handleApplyDefault}
                  className="flex-1 py-1 px-2 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f3f4f5] text-[11px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer">
                  <RotateCcw size={11} /><span>Default</span>
                </button>
                <button type="button" onClick={handleClearFilters}
                  className="py-1 px-2 bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-bold rounded hover:brightness-95 cursor-pointer">
                  Clear
                </button>
              </div>
            </aside>
          )}

          {/* Collapsed panel reopen */}
          {!showFilterPanel && (
            <div className="bg-[#edeae1] dark:bg-[#1d222e] border-r border-[#c4c5d5] dark:border-[#444653] p-1 flex flex-col justify-start">
              <button type="button" onClick={() => setShowFilterPanel(true)}
                className="p-1 text-xs font-bold text-[#00288e] hover:bg-white dark:hover:bg-[#2d3133] rounded transition cursor-pointer">
                &gt;&gt;
              </button>
            </div>
          )}

          {/* Right Main Area */}
          <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#131b2e]">

            {/* Top: Preview / Context Summary */}
            <section className="bg-[#f8f9fa] dark:bg-[#191c1e] p-3 border-b border-[#c4c5d5] dark:border-[#444653] flex items-center justify-between gap-4 shrink-0 shadow-2xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#00288e] dark:text-[#a8b8ff] uppercase tracking-wider">
                    {activeTab === "variant" || activeTab === "item" || activeTab === "article"
                      ? "Item / Style Details & Picture"
                      : "Master Entity Details"}
                  </span>
                  {activeSelectedItem && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-[#edeae1] dark:bg-[#252836] rounded text-[#191c1d] dark:text-white">
                      {String(activeSelectedItem.sku ?? activeSelectedItem.code ?? activeSelectedItem.invoice_number ?? "")}
                    </span>
                  )}
                </div>
                {activeSelectedItem ? (
                  <div className="mt-1 text-xs space-y-0.5">
                    <p className="font-bold text-sm text-[#191c1d] dark:text-white truncate">
                      {String(activeSelectedItem.name ?? activeSelectedItem.description ?? "")}
                    </p>
                    <p className="text-[11px] text-[#565e74] dark:text-[#bec6e0] truncate">
                      {String(activeSelectedItem.address ?? activeSelectedItem.specification ?? "")}
                      {activeSelectedItem.category ? ` • ${String(activeSelectedItem.category)}` : ""}
                      {activeSelectedItem.brand ? ` • ${String(activeSelectedItem.brand)}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mt-1">
                    {loading ? "Loading…" : "No row selected"}
                  </p>
                )}
              </div>

              {/* Picture / color swatch thumbnail */}
              <div className="w-36 h-20 bg-white dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#444653] rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {(activeTab === "variant" || activeTab === "item" || activeTab === "article") ? (
                  activeSelectedItem?.imageUrl ? (
                    <img src={String(activeSelectedItem.imageUrl)} alt="Item" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#565e74] gap-1">
                      <ImageIcon size={22} className="opacity-40" />
                      <span className="text-[10px] font-bold font-mono">PICTURE</span>
                    </div>
                  )
                ) : activeTab === "color" && activeSelectedItem?.hex ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center"
                    style={{ backgroundColor: String(activeSelectedItem.hex) }}>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-black/60 text-white rounded">
                      {String(activeSelectedItem.hex)}
                    </span>
                  </div>
                ) : (
                  <div className="p-2 text-center text-[#565e74] flex flex-col items-center justify-center gap-0.5">
                    <MapPin size={16} className="text-[#00288e] dark:text-[#a8b8ff]" />
                    <span className="text-[10px] font-bold">
                      {String(activeSelectedItem?.state ?? activeSelectedItem?.city ?? "Registered")}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Main Grid */}
            <div className="flex-1 overflow-auto bg-white dark:bg-[#131b2e]">
              {loading ? (
                <div className="flex items-center justify-center h-full text-[#565e74] text-sm gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#00288e] border-t-transparent" />
                  <span>Loading {activeTab}…</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[750px]">
                  <thead className="bg-[#edeae1] dark:bg-[#252836] sticky top-0 z-10 border-b border-[#c4c5d5] dark:border-[#444653] text-[11px] font-bold text-[#444653] dark:text-[#bec6e0]">
                    <tr className="h-8">
                      {currentColumns.filter(c => c.visible).map(col => (
                        <th key={col.key}
                          className={`px-3 border-r border-[#c4c5d5] dark:border-[#444653] ${
                            col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                          } ${col.width ?? ""}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133] font-mono text-[11px]">
                    {paginatedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={currentColumns.filter(c => c.visible).length}
                          className="py-12 text-center text-xs text-[#565e74] dark:text-[#bec6e0]">
                          No records match the active search and filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedRecords.map((row, idx) => {
                        const isSelected = selectedRowIndex === idx;
                        const rowKey = String(row.id ?? row.code ?? row.sku ?? idx);
                        return (
                          <tr key={rowKey}
                            onClick={() => setSelectedRowIndex(idx)}
                            onDoubleClick={() => handleCommitSelection(row)}
                            className={`h-7 cursor-pointer transition ${
                              isSelected
                                ? "bg-[#ffffcc] dark:bg-[#3a3a1a] text-black dark:text-yellow-200 font-semibold border-l-4 border-[#00288e]"
                                : "hover:bg-[#f8f9fa] dark:hover:bg-[#1d222e]"
                            }`}>
                            {currentColumns.filter(c => c.visible).map(col => {
                              const val = row[col.key];
                              return (
                                <td key={col.key}
                                  className={`px-3 border-r border-[#c4c5d5] dark:border-[#444653] ${
                                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                                  } ${col.key === "name" || col.key === "description" ? "font-sans font-medium" : ""}`}>
                                  {col.key === "hex" && row.hex ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block"
                                        style={{ backgroundColor: String(row.hex) }} />
                                      <span>{String(row.hex)}</span>
                                    </div>
                                  ) : typeof val === "number" ? (
                                    col.key.includes("price") || col.key.includes("mrp") || col.key.toLowerCase().includes("balance")
                                      ? `₹${val.toFixed(2)}`
                                      : val
                                  ) : (
                                    val != null ? String(val) : "-"
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bottom Search Strip & Pagination */}
            <div className="bg-[#edeae1] dark:bg-[#1d222e] p-2 border-t border-[#c4c5d5] dark:border-[#444653] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 flex-1 max-w-lg">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                  Search:
                </span>
                <select value={bottomSearchCol} onChange={e => setBottomSearchCol(e.target.value)}
                  className="h-7 px-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded bg-white dark:bg-[#131b2e] outline-none">
                  <option value="all">[Any Column]</option>
                  {currentColumns.filter(c => c.visible).map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <input type="text" value={bottomSearchVal}
                  onChange={e => { setBottomSearchVal(e.target.value); setPage(1); }}
                  placeholder="Locate value in column..."
                  className="flex-1 h-7 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded bg-white dark:bg-[#131b2e] outline-none focus:border-[#00288e]"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] text-[#565e74] dark:text-[#bec6e0] font-mono">
                  Page {page} of {totalPages} ({filteredRecords.length} records)
                </span>
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-7 px-2.5 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] rounded hover:bg-[#f3f4f5] disabled:opacity-30 font-bold flex items-center gap-1 cursor-pointer">
                  <ChevronLeft size={13} /><span>Prev</span>
                </button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="h-7 px-2.5 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] rounded hover:bg-[#f3f4f5] disabled:opacity-30 font-bold flex items-center gap-1 cursor-pointer">
                  <span>Next</span><ChevronRight size={13} />
                </button>
              </div>
            </div>
          </main>
        </div>

        {/* ====================================================================
            3. FOOTER ACTIONS
            ==================================================================== */}
        <footer className="px-4 py-2.5 bg-[#f8f9fa] dark:bg-[#131b2e] border-t border-[#c4c5d5] dark:border-[#444653] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] rounded text-[11px] font-mono font-bold text-[#00288e] dark:text-[#a8b8ff] shadow-2xs">
              [↑/↓: Navigate] [PgUp/PgDn: Page] [Enter: Ok] [Esc: Cancel]
            </kbd>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={closeLookup}
              className="px-4 py-1.5 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f3f4f5] text-xs font-bold rounded-xl transition cursor-pointer">
              Cancel [Esc]
            </button>
            <button type="button" disabled={!activeSelectedItem} onClick={() => handleCommitSelection()}
              className="px-5 py-1.5 bg-[#00288e] hover:bg-[#1e40af] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer active:scale-95">
              <CornerDownLeft size={13} />
              <span>Ok [Enter]</span>
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default UniversalBrowseEngine;
