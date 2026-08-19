/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Plus, 
  Download, 
  SlidersHorizontal, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink
} from "lucide-react";
import { MasterConfig, MasterColumnDef } from "./types.ts";
import { MasterFormDrawer } from "./MasterFormDrawer.tsx";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { recordAuditAction } from "../../../lib/apiFetch.ts";
import { SmritiScrollArea } from "../../SmritiScrollArea.tsx";
import { useWorkspace } from "../../../contexts/WorkspaceContext.tsx";

export interface MasterListScreenProps<T = any> {
  config: MasterConfig<T>;
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
  // Optional slot overrides provided directly at screen instantiation
  extraColumns?: (item: T) => React.ReactNode;
  extraFields?: (formState: any, setFormField: (name: string, val: any) => void) => React.ReactNode;
  customActions?: MasterConfig<T>["customActions"];
  detailDrawer?: (item: T, onClose: () => void, refetch: () => void) => React.ReactNode;
}

export function MasterListScreen<T extends Record<string, any>>({
  config,
  currentUser,
  onNotification,
  extraColumns,
  extraFields,
  customActions,
  detailDrawer
}: MasterListScreenProps<T>) {
  const { popOutExternalWindow } = useWorkspace();
  const isReadOnly = currentUser?.role === "Report User";
  const isServerPagination = Boolean(config.serverPagination);

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<string>(config.subTabs?.[0]?.id || "list");
  
  // Filter States
  const [filterValues, setFilterValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    config.filters?.forEach((f) => {
      initial[f.id] = f.defaultValue ?? "ALL";
    });
    return initial;
  });

  // Sorting State
  const [sortState, setSortState] = useState<{ key: string; direction: "asc" | "desc" }>(
    config.defaultSort || { key: config.columns[0]?.key || "id", direction: "asc" }
  );

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(config.pageSize || (isServerPagination ? 25 : 15));

  // Server-Side Pagination Metadata
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverHasNext, setServerHasNext] = useState(false);
  const [serverHasPrev, setServerHasPrev] = useState(false);

  // Modal / Drawer States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<T | null>(null);

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Request ID sequence for stale response cancellation in server mode
  const latestRequestId = useRef(0);

  // Search Debounce (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when search or filters or sort or pageSize change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterValues, sortState.key, sortState.direction, pageSize]);

  // Fetch Items from Backend
  const fetchItems = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);

    try {
      if (isServerPagination) {
        // SERVER-SIDE PAGINATION URL
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
        if (debouncedSearch.trim()) {
          params.set("q", debouncedSearch.trim());
        }
        if (sortState.key) {
          params.set("sort", sortState.key);
          params.set("order", sortState.direction);
        }
        if (config.filters) {
          for (const f of config.filters) {
            const val = filterValues[f.id];
            if (val !== undefined && val !== "ALL" && val !== "") {
              params.set(f.field, String(val));
            }
          }
        }

        const separator = config.apiEndpoint.includes("?") ? "&" : "?";
        const endpointWithParams = `${config.apiEndpoint}${separator}${params.toString()}`;
        const data = await apiFetchV1(endpointWithParams);

        if (requestId !== latestRequestId.current) return; // Stale request protection

        if (data && typeof data === "object" && "items" in data) {
          let list = data.items;
          if (config.responseTransform) {
            list = config.responseTransform(data);
          }
          setItems(Array.isArray(list) ? list : []);
          setServerTotal(data.total ?? 0);
          setServerTotalPages(data.total_pages ?? (Math.ceil((data.total ?? 0) / pageSize) || 1));
          setServerHasNext(Boolean(data.has_next));
          setServerHasPrev(Boolean(data.has_prev));
        } else if (Array.isArray(data)) {
          // Fallback if array returned
          setItems(data);
          setServerTotal(data.length);
          setServerTotalPages(Math.ceil(data.length / pageSize) || 1);
          setServerHasNext(page < (Math.ceil(data.length / pageSize) || 1));
          setServerHasPrev(page > 1);
        }
      } else {
        // CLIENT-SIDE MODE
        const data = await apiFetchV1(config.apiEndpoint);
        if (requestId !== latestRequestId.current) return;

        let list: T[] = [];
        if (config.responseTransform) {
          list = config.responseTransform(data);
        } else if (Array.isArray(data)) {
          list = data;
        } else if (data && Array.isArray(data.items)) {
          list = data.items;
        } else if (data && Array.isArray(data.users)) {
          list = data.users;
        } else if (data && Array.isArray(data.data)) {
          list = data.data;
        }
        setItems(list);
      }
    } catch (err: any) {
      if (requestId !== latestRequestId.current) return;
      console.error(`[MasterListScreen] Failed to fetch ${config.entityName}:`, err);
      if (onNotification) {
        onNotification("Fetch Error", `Failed to load ${config.entityNamePlural || config.entityName}: ${err.message}`, "error");
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [config, isServerPagination, page, pageSize, debouncedSearch, filterValues, sortState, onNotification]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Debounced search audit logging
  useEffect(() => {
    if (!debouncedSearch.trim()) return;
    const timer = setTimeout(() => {
      recordAuditAction("SEARCH", config.entityName.toLowerCase(), "search", `Search for: "${debouncedSearch}"`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [debouncedSearch, config.entityName]);

  // Client-side Filter & Search Pipeline (only active when serverPagination is false)
  const filteredItems = useMemo(() => {
    if (isServerPagination) return items;

    return items.filter((item) => {
      // 1. Search Query
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase().trim();
        const searchFields = config.searchFields || config.columns.filter((c) => c.searchable !== false).map((c) => c.key);
        const matches = searchFields.some((key) => {
          const val = item[key];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(query);
        });
        if (!matches) return false;
      }

      // 2. Custom & Generic Filters
      if (config.filters) {
        for (const f of config.filters) {
          const selectedVal = filterValues[f.id];
          if (selectedVal !== undefined && selectedVal !== "ALL" && selectedVal !== "") {
            if (f.customFilter) {
              if (!f.customFilter(item, selectedVal)) return false;
            } else if (item[f.field] !== selectedVal) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [items, debouncedSearch, filterValues, config, isServerPagination]);

  // Sorted Items (only active when serverPagination is false)
  const sortedItems = useMemo(() => {
    if (isServerPagination) return filteredItems;
    if (!sortState.key) return filteredItems;

    return [...filteredItems].sort((a, b) => {
      const aVal = a[sortState.key];
      const bVal = b[sortState.key];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      const comparison = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
        
      return sortState.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredItems, sortState, isServerPagination]);

  // Paginated Items & Total Pages
  const totalCount = isServerPagination ? serverTotal : sortedItems.length;
  const totalPages = isServerPagination ? serverTotalPages : Math.ceil(sortedItems.length / pageSize) || 1;
  const displayItems = isServerPagination ? items : useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, page, pageSize]);

  // Handle Sort Toggle
  const handleSort = (columnKey: string) => {
    setSortState((prev) => {
      if (prev.key === columnKey) {
        return { key: columnKey, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  // Handle Create / Update Submit
  const handleFormSubmit = async (formData: any) => {
    const isEdit = Boolean(editingItem);
    const idKey = config.idKey || "id";
    const itemId = editingItem ? editingItem[idKey] : undefined;

    let payload = formData;
    if (config.payloadTransform) {
      payload = config.payloadTransform(formData, isEdit ? "update" : "create", editingItem || undefined);
    }

    const url = isEdit ? `${config.apiEndpoint.replace(/\/$/, "")}/${itemId}` : config.apiEndpoint;
    const method = isEdit ? "PUT" : "POST";

    const res = await apiFetchV1(url, {
      method,
      body: JSON.stringify(payload)
    });

    recordAuditAction(
      isEdit ? "UPDATE" : "CREATE",
      config.entityName.toLowerCase(),
      itemId || res?.id || "new",
      `${isEdit ? "Updated" : "Created"} ${config.entityName}: ${formData.name || formData.code || itemId}`
    );

    if (onNotification) {
      onNotification(
        "Success",
        `${config.entityName} ${isEdit ? "updated" : "created"} successfully.`,
        "success"
      );
    }

    setIsFormOpen(false);
    setEditingItem(null);
    await fetchItems();
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const idKey = config.idKey || "id";
    const itemId = itemToDelete[idKey];
    setIsDeleting(true);

    try {
      const url = `${config.apiEndpoint.replace(/\/$/, "")}/${itemId}`;
      await apiFetchV1(url, { method: "DELETE" });

      recordAuditAction(
        "DELETE",
        config.entityName.toLowerCase(),
        itemId,
        `Deleted ${config.entityName}: ${itemToDelete.name || itemToDelete.code || itemId}`
      );

      if (onNotification) {
        onNotification("Deleted", `${config.entityName} was successfully deleted.`, "info");
      }
      setItemToDelete(null);
      await fetchItems();
    } catch (err: any) {
      console.error(`[MasterListScreen] Delete failed:`, err);
      if (onNotification) {
        onNotification("Delete Failed", err.message || "Failed to delete record.", "error");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Export CSV (Current View / Page)
  const handleExportCSV = () => {
    if (displayItems.length === 0) return;
    const exportColumns = config.columns.filter((c) => c.key !== "actions");
    const headers = exportColumns.map((c) => `"${c.label}"`).join(",");
    const rows = displayItems.map((item) =>
      exportColumns
        .map((c) => {
          const val = item[c.key];
          if (val === null || val === undefined) return '""';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${config.entityName.toLowerCase()}_page_${page}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    recordAuditAction("EXPORT", config.entityName.toLowerCase(), "csv", `Exported ${displayItems.length} records to CSV`);
  };

  // Permissions Check
  const canCreate = !isReadOnly && (!config.permissions?.createRole || (currentUser && config.permissions.createRole.includes(currentUser.role)));
  const canEdit = !isReadOnly && (!config.permissions?.editRole || (currentUser && config.permissions.editRole.includes(currentUser.role)));
  const canDelete = !isReadOnly && (!config.permissions?.deleteRole || (currentUser && config.permissions.deleteRole.includes(currentUser.role)));

  // Combine actions
  const effectiveCustomActions = customActions || config.customActions;

  // Selected subTab definition
  const selectedSubTabDef = config.subTabs?.find((t) => t.id === activeSubTab);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Read Only Warning Banner */}
      {isReadOnly && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center space-x-2 text-amber-400 text-xs font-mono">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="font-bold">READ-ONLY MODE:</span>
          <span>You have view-only access. Form modifications and deletions are disabled.</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-theme-surface-1 p-6 rounded-2xl border border-theme-divider flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xl shrink-0">
            {config.icon || <FileSpreadsheet size={24} />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-display font-bold text-xl text-theme-primary tracking-tight">
                {config.title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-theme-surface-2 text-theme-muted border border-theme-divider">
                {totalCount} {config.entityNamePlural || "Total"}
              </span>
            </div>
            {config.subtitle && (
              <p className="text-xs text-theme-muted mt-0.5 leading-relaxed">
                {config.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 self-stretch md:self-auto">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchItems()}
            disabled={loading}
            title="Refresh Table"
            className="p-2.5 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-400" : ""} />
          </button>

          {/* CSV Export Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={displayItems.length === 0}
            className="px-3.5 py-2.5 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-primary border border-theme-divider transition-all text-xs font-bold font-mono flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {/* Popout External Window Button */}
          <button
            type="button"
            onClick={() => popOutExternalWindow(config.entityName.toLowerCase().replace(/\s+/g, "-"), config.title, typeof config.icon === "string" ? config.icon : undefined)}
            title="Pop Out into Standalone Window"
            className="p-2.5 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider transition-all cursor-pointer"
          >
            <ExternalLink size={15} />
          </button>

          {/* Slot: Extra Header Actions */}
          {config.slots?.extraHeaderActions && config.slots.extraHeaderActions(fetchItems, displayItems)}

          {/* Create Button */}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setIsFormOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
            >
              <Plus size={15} />
              <span>New {config.entityName}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Bar */}
      {config.kpis && config.kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {config.kpis.map((kpi) => {
            const val = kpi.compute(items);
            return (
              <div
                key={kpi.id}
                className="bg-theme-surface-1 p-4 rounded-xl border border-theme-divider flex flex-col justify-between space-y-1 shadow-xs"
              >
                <span className="text-[11px] font-mono text-theme-muted uppercase tracking-wider font-semibold">
                  {kpi.label}
                </span>
                <span className="font-display font-bold text-2xl text-theme-primary">
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub Tabs Bar (if defined) */}
      {config.subTabs && config.subTabs.length > 0 && (
        <div className="flex items-center space-x-1 border-b border-theme-divider pb-2 overflow-x-auto">
          {config.subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeSubTab === tab.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Render SubTab Content Slot if active and not default table */}
      {selectedSubTabDef && selectedSubTabDef.renderContent && (
        <div className="mt-4">
          {selectedSubTabDef.renderContent(displayItems, fetchItems)}
        </div>
      )}

      {/* Primary Table View (Rendered when no custom subTab renderContent is active) */}
      {(!selectedSubTabDef || !selectedSubTabDef.renderContent) && (
        <div className="bg-theme-surface-1 rounded-2xl border border-theme-divider overflow-hidden shadow-xs space-y-3 p-4">
          {/* Controls Bar: Search & Dynamic Filters */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-muted"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={config.searchPlaceholder || `Search ${config.entityNamePlural || config.entityName}...`}
                className="w-full pl-9 pr-4 py-2 bg-theme-surface-2 border border-theme-divider rounded-xl text-xs text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-blue-500 font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dynamic Filter Dropdowns */}
            {config.filters && config.filters.length > 0 && (
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <SlidersHorizontal size={14} className="text-theme-muted shrink-0 mr-1" />
                {config.filters.map((filter) => (
                  <div key={filter.id} className="flex items-center space-x-1">
                    <span className="text-[11px] text-theme-muted font-mono">{filter.label}:</span>
                    <select
                      value={filterValues[filter.id]}
                      onChange={(e) =>
                        setFilterValues((prev) => ({
                          ...prev,
                          [filter.id]: e.target.value
                        }))
                      }
                      className="px-2.5 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-primary focus:outline-none font-medium"
                    >
                      <option value="ALL">All</option>
                      {filter.options.map((opt) => (
                        <option key={String(opt.value)} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main Data Table */}
          <div className="overflow-x-auto border border-theme-divider rounded-xl">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="border-b border-theme-divider bg-theme-surface-2 text-theme-muted text-[10px] font-bold uppercase tracking-wider font-mono">
                  {config.columns.map((col) => (
                    <th
                      key={col.key}
                      style={{ width: col.width, minWidth: col.minWidth }}
                      className={`px-4 py-3 ${
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      } ${col.sortable ? "cursor-pointer hover:text-theme-primary transition-colors select-none" : ""}`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className={`flex items-center space-x-1.5 ${
                        col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"
                      }`}>
                        <span>{col.label}</span>
                        {col.sortable && (
                          <span className="text-theme-muted">
                            {sortState.key === col.key ? (
                              sortState.direction === "asc" ? (
                                <ArrowUp size={12} className="text-blue-400" />
                              ) : (
                                <ArrowDown size={12} className="text-blue-400" />
                              )
                            ) : (
                              <ArrowUpDown size={11} className="opacity-40" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  {/* Slot: Extra Columns Header */}
                  {(extraColumns || config.slots?.extraColumns) && (
                    <th className="px-4 py-3 text-left">Details</th>
                  )}
                  {/* Actions Header */}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-divider">
                {loading ? (
                  <tr>
                    <td
                      colSpan={config.columns.length + 2}
                      className="py-12 text-center text-theme-muted font-mono"
                    >
                      <RefreshCw size={24} className="animate-spin mx-auto text-blue-400 mb-2" />
                      <span>Loading {config.entityNamePlural || config.entityName}...</span>
                    </td>
                  </tr>
                ) : displayItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={config.columns.length + 2}
                      className="py-12 text-center text-theme-muted font-sans"
                    >
                      <div className="w-12 h-12 rounded-full bg-theme-surface-2 border border-theme-divider flex items-center justify-center mx-auto mb-3 text-theme-muted">
                        <Search size={20} />
                      </div>
                      <p className="font-bold text-sm text-theme-primary">
                        No {config.entityNamePlural || config.entityName} found
                      </p>
                      <p className="text-xs text-theme-muted mt-0.5">
                        {debouncedSearch
                          ? `No records match your query "${debouncedSearch}".`
                          : `Get started by registering your first ${config.entityName.toLowerCase()}.`}
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayItems.map((item, idx) => {
                    const idKey = config.idKey || "id";
                    const rowKey = item[idKey] || `row-${idx}`;
                    return (
                      <tr
                        key={rowKey}
                        className="hover:bg-theme-surface-hover transition-colors group"
                      >
                        {config.columns.map((col) => {
                          const val = item[col.key];
                          return (
                            <td
                              key={col.key}
                              className={`px-4 py-3 ${
                                col.align === "right"
                                  ? "text-right"
                                  : col.align === "center"
                                  ? "text-center"
                                  : "text-left"
                              }`}
                            >
                              {col.render
                                ? col.render(val, item)
                                : col.renderBadge
                                ? (() => {
                                    const badge = col.renderBadge(val);
                                    return (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${badge.color}`}
                                      >
                                        {badge.label}
                                      </span>
                                    );
                                  })()
                                : String(val ?? "—")}
                            </td>
                          );
                        })}

                        {/* Slot: Extra Columns Body */}
                        {(extraColumns || config.slots?.extraColumns) && (
                          <td className="px-4 py-3">
                            {(extraColumns || config.slots?.extraColumns)!(item)}
                          </td>
                        )}

                        {/* Row Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Custom Actions */}
                            {effectiveCustomActions?.map((act) => {
                              if (act.showWhen && !act.showWhen(item)) return null;
                              return (
                                <button
                                  key={act.id}
                                  type="button"
                                  onClick={() => act.onClick(item, fetchItems)}
                                  title={act.label}
                                  className="p-1.5 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider transition-all cursor-pointer"
                                >
                                  {act.icon}
                                </button>
                              );
                            })}

                            {/* Detail View Drawer Trigger */}
                            {(detailDrawer || config.slots?.detailDrawer) && (
                              <button
                                type="button"
                                onClick={() => setSelectedDetailItem(item)}
                                title="View Details"
                                className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all cursor-pointer"
                              >
                                <Search size={13} />
                              </button>
                            )}

                            {/* Edit Action */}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsFormOpen(true);
                                }}
                                title={`Edit ${config.entityName}`}
                                className="p-1.5 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider transition-all cursor-pointer"
                              >
                                <Edit3 size={13} />
                              </button>
                            )}

                            {/* Delete Action */}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                title={`Delete ${config.entityName}`}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-theme-muted font-mono">
            <div className="flex items-center space-x-4">
              <span>
                Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount} {config.entityNamePlural || "records"}
              </span>
              <div className="flex items-center space-x-1.5">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-0.5 bg-theme-surface-1 border border-theme-divider rounded text-xs text-theme-primary focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage(1)}
                title="First Page"
                className="p-1.5 rounded border border-theme-divider hover:bg-theme-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Previous Page"
                className="p-1.5 rounded border border-theme-divider hover:bg-theme-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 font-bold text-theme-primary">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                title="Next Page"
                className="p-1.5 rounded border border-theme-divider hover:bg-theme-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight size={14} />
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage(totalPages)}
                title="Last Page"
                className="p-1.5 rounded border border-theme-divider hover:bg-theme-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Master Form Slide-out Drawer */}
      <MasterFormDrawer
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingItem(null);
        }}
        config={config}
        editingItem={editingItem}
        onSubmit={handleFormSubmit}
        existingItems={items}
      />

      {/* Detail Drawer (Slot) */}
      {selectedDetailItem && (detailDrawer || config.slots?.detailDrawer) && (
        (detailDrawer || config.slots?.detailDrawer)!(
          selectedDetailItem,
          () => setSelectedDetailItem(null),
          fetchItems
        )
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-theme-primary font-display">
                  Confirm Deletion
                </h3>
                <p className="text-xs text-theme-muted leading-relaxed">
                  Are you sure you want to permanently delete this {config.entityName.toLowerCase()} record? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-theme-muted hover:text-theme-primary bg-theme-surface-2 border border-theme-divider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 border border-rose-500 shadow-md transition-all cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
