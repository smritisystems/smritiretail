/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect, useMemo } from "react";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { MasterConfig, MasterColumnDef } from "./types.ts";
import { MasterFormDrawer } from "./MasterFormDrawer.tsx";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { recordAuditAction } from "../../../lib/apiFetch.ts";
import { SmritiScrollArea } from "../../SmritiScrollArea.tsx";

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
  const isReadOnly = currentUser?.role === "Report User";
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
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
  const [pageSize, setPageSize] = useState(config.pageSize || 15);

  // Modal / Drawer States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<T | null>(null);

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Items from Backend
  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await apiFetchV1(config.apiEndpoint);
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
    } catch (err: any) {
      console.error(`[MasterListScreen] Failed to fetch ${config.entityName}:`, err);
      if (onNotification) {
        onNotification("Fetch Error", `Failed to load ${config.entityNamePlural || config.entityName}: ${err.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [config.apiEndpoint]);

  // Debounced search audit logging
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      recordAuditAction("SEARCH", config.entityName.toLowerCase(), "search", `Search for: "${searchQuery}"`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [searchQuery, config.entityName]);

  // Client-side Filter & Search Pipeline
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
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
  }, [items, searchQuery, filterValues, config]);

  // Sorted Items
  const sortedItems = useMemo(() => {
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
  }, [filteredItems, sortState]);

  // Paginated Items
  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
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
      isEdit ? String(itemId) : "new",
      `${isEdit ? "Updated" : "Created"} ${config.entityName}: ${res?.name || res?.title || res?.code || ""}`
    );

    if (onNotification) {
      onNotification(
        "Success",
        `${config.entityName} ${isEdit ? "updated" : "created"} successfully.`,
        "success"
      );
    }

    await fetchItems();
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const idKey = config.idKey || "id";
    const itemId = itemToDelete[idKey];
    setIsDeleting(true);

    try {
      await apiFetchV1(`${config.apiEndpoint.replace(/\/$/, "")}/${itemId}`, {
        method: "DELETE"
      });

      recordAuditAction(
        "DELETE",
        config.entityName.toLowerCase(),
        String(itemId),
        `Deleted ${config.entityName} ID: ${itemId}`
      );

      if (onNotification) {
        onNotification("Deleted", `${config.entityName} deleted successfully.`, "success");
      }

      setItemToDelete(null);
      await fetchItems();
    } catch (err: any) {
      if (onNotification) {
        onNotification("Delete Failed", err?.message || `Failed to delete ${config.entityName}.`, "error");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Status Badge Formatter
  const renderStatusPill = (val: any) => {
    const s = String(val || "").toUpperCase();
    if (s === "ACTIVE" || s === "PAID" || s === "COMPLETED") {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
          <CheckCircle2 size={10} />
          <span>{String(val)}</span>
        </span>
      );
    }
    if (s === "INACTIVE" || s === "BLOCKED" || s === "CANCELLED") {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
          <XCircle size={10} />
          <span>{String(val)}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
        <Clock size={10} />
        <span>{String(val || "N/A")}</span>
      </span>
    );
  };

  // CSV Export
  const handleExportCSV = () => {
    if (sortedItems.length === 0) return;
    const headers = config.columns.map((c) => c.label).join(",");
    const rows = sortedItems.map((item) =>
      config.columns.map((c) => `"${String(item[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${config.entityName.toLowerCase()}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
      {/* Read-only Alert */}
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2 flex items-center space-x-2 text-amber-400 text-xs shrink-0">
          <AlertTriangle size={14} />
          <span className="font-mono uppercase font-bold">Read-Only Mode:</span>
          <span>You have view permissions only. Create, edit, and delete operations are restricted.</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-4 shrink-0 gap-4">
        <div className="flex items-center space-x-3">
          {config.icon && (
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-lg shadow-xs">
              {config.icon}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold font-display text-theme-primary tracking-tight">
              {config.title}
            </h2>
            {config.subtitle && (
              <p className="text-xs text-theme-muted mt-0.5">{config.subtitle}</p>
            )}
          </div>
        </div>

        {/* Right Side: KPIs + Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Dynamic KPI counters */}
          {config.kpis && config.kpis.length > 0 && (
            <div className="flex items-center bg-theme-surface-3 px-3 py-1.5 rounded-lg border border-theme-divider gap-3 divide-x divide-theme-divider">
              {config.kpis.map((kpi) => (
                <div key={kpi.id} className="pl-3 first:pl-0 text-right">
                  <div className="text-[9px] font-mono text-theme-muted uppercase font-bold">
                    {kpi.label}
                  </div>
                  <div className={`text-xs font-bold font-mono ${
                    kpi.color === "emerald" ? "text-emerald-400" :
                    kpi.color === "amber" ? "text-amber-400" :
                    kpi.color === "rose" ? "text-rose-400" :
                    kpi.color === "indigo" ? "text-indigo-400" : "text-blue-400"
                  }`}>
                    {kpi.compute(items)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Slot: Extra Header Actions */}
          {config.slots?.extraHeaderActions && config.slots.extraHeaderActions(fetchItems, items)}

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            title="Export Table to CSV"
            className="p-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider transition-all cursor-pointer"
          >
            <Download size={15} />
          </button>

          {/* Refresh */}
          <button
            onClick={fetchItems}
            title="Reload Master Data"
            className="p-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Create Button */}
          {!isReadOnly && (
            <button
              onClick={() => {
                setEditingItem(null);
                setIsFormOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md hover:shadow-blue-500/20 cursor-pointer"
            >
              <Plus size={15} />
              <span>Add {config.entityName}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs Bar (if defined) */}
      {config.subTabs && config.subTabs.length > 0 && (
        <div className="flex items-center px-6 bg-theme-surface-2 border-b border-theme-divider gap-2 shrink-0">
          {config.subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-all cursor-pointer ${
                activeSubTab === tab.id
                  ? "border-blue-500 text-blue-400 bg-theme-surface-3"
                  : "border-transparent text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Custom SubTab Content Render */}
      {config.subTabs && activeSubTab !== "list" && activeSubTab !== (config.subTabs[0]?.id || "list") && (
        <div className="flex-1 overflow-auto p-6">
          {config.subTabs.find((t) => t.id === activeSubTab)?.renderContent?.(items, fetchItems)}
        </div>
      )}

      {/* Primary List View */}
      {(!config.subTabs || activeSubTab === "list" || activeSubTab === config.subTabs[0]?.id) && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-theme-surface-1 border-b border-theme-divider shrink-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={config.searchPlaceholder || `Search ${config.entityNamePlural || config.entityName}...`}
                className="w-full pl-9 pr-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-primary placeholder:text-theme-muted/50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {config.filters?.map((f) => (
                <div key={f.id} className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-bold text-theme-muted uppercase font-mono">
                    {f.label}:
                  </span>
                  <select
                    value={filterValues[f.id] ?? "ALL"}
                    onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    className="px-2.5 py-1 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-primary focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="ALL">All</option>
                    {f.options.map((opt, oIdx) => (
                      <option key={oIdx} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Table Area */}
          <SmritiScrollArea className="flex-1 bg-theme-base">
            <div className="min-w-full">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-theme-divider bg-theme-surface-2 text-theme-muted text-[10px] font-bold uppercase tracking-wider font-mono sticky top-0 z-10 shadow-xs">
                    {config.columns.map((col) => (
                      <th
                        key={col.key}
                        style={{ width: col.width, minWidth: col.minWidth }}
                        className={`px-4 py-3 select-none ${
                          col.sortable !== false ? "cursor-pointer hover:text-theme-primary transition-colors" : ""
                        } ${
                          col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                        }`}
                        onClick={() => col.sortable !== false && handleSort(col.key)}
                      >
                        <div className={`flex items-center space-x-1.5 ${
                          col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"
                        }`}>
                          <span>{col.label}</span>
                          {col.sortable !== false && (
                            sortState.key === col.key ? (
                              sortState.direction === "asc" ? (
                                <ArrowUp size={12} className="text-blue-400" />
                              ) : (
                                <ArrowDown size={12} className="text-blue-400" />
                              )
                            ) : (
                              <ArrowUpDown size={11} className="opacity-40" />
                            )
                          )}
                        </div>
                      </th>
                    ))}

                    {/* Slot: Extra Columns Header */}
                    {config.slots?.extraColumns && (
                      <th className="px-4 py-3 text-right">Details</th>
                    )}

                    {/* Actions Column Header */}
                    <th className="px-4 py-3 text-right w-24">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-theme-divider">
                  {loading ? (
                    <tr>
                      <td colSpan={config.columns.length + 2} className="py-12 text-center text-theme-muted">
                        <div className="inline-flex items-center space-x-2 text-xs font-mono">
                          <RefreshCw size={14} className="animate-spin text-blue-400" />
                          <span>Loading {config.entityNamePlural || config.entityName}...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={config.columns.length + 2} className="py-12 text-center text-theme-muted">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-theme-primary">No records found</p>
                          <p className="text-[11px]">
                            {searchQuery ? "Try adjusting your search criteria." : `No ${config.entityNamePlural || config.entityName} registered yet.`}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item, rowIdx) => {
                      const idKey = config.idKey || "id";
                      const itemId = item[idKey] || rowIdx;

                      return (
                        <tr
                          key={itemId}
                          className="hover:bg-theme-surface-hover transition-colors group cursor-pointer"
                          onClick={() => {
                            if (detailDrawer || config.slots?.detailDrawer) {
                              setSelectedDetailItem(item);
                            }
                          }}
                        >
                          {config.columns.map((col) => {
                            const val = item[col.key];

                            return (
                              <td
                                key={col.key}
                                className={`px-4 py-3 text-xs ${
                                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                                }`}
                              >
                                {col.render ? (
                                  col.render(val, item)
                                ) : col.renderStatus ? (
                                  renderStatusPill(val)
                                ) : col.renderBadge ? (
                                  (() => {
                                    const b = col.renderBadge(val);
                                    return (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${b.color}`}>
                                        {b.label}
                                      </span>
                                    );
                                  })()
                                ) : (
                                  <span className="text-theme-primary">
                                    {val !== undefined && val !== null ? String(val) : "—"}
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          {/* Slot: Extra Columns Row */}
                          {config.slots?.extraColumns && (
                            <td className="px-4 py-3 text-right">
                              {config.slots.extraColumns(item)}
                            </td>
                          )}

                          {/* Actions Column */}
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              {/* Custom Row Actions */}
                              {(customActions || config.customActions)?.map((act) => {
                                if (act.showWhen && !act.showWhen(item)) return null;
                                return (
                                  <button
                                    key={act.id}
                                    onClick={() => act.onClick(item, fetchItems)}
                                    title={act.label}
                                    className="p-1 rounded hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
                                  >
                                    {act.icon || act.label}
                                  </button>
                                );
                              })}

                              {/* Edit Action */}
                              {!isReadOnly && (
                                <button
                                  onClick={() => {
                                    setEditingItem(item);
                                    setIsFormOpen(true);
                                  }}
                                  title={`Edit ${config.entityName}`}
                                  className="p-1 rounded hover:bg-blue-500/10 text-theme-muted hover:text-blue-400 transition-colors cursor-pointer"
                                >
                                  <Edit3 size={13} />
                                </button>
                              )}

                              {/* Delete Action */}
                              {!isReadOnly && (
                                <button
                                  onClick={() => setItemToDelete(item)}
                                  title={`Delete ${config.entityName}`}
                                  className="p-1 rounded hover:bg-rose-500/10 text-theme-muted hover:text-rose-400 transition-colors cursor-pointer"
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
          </SmritiScrollArea>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-theme-divider bg-theme-surface-2 shrink-0 font-mono text-xs text-theme-muted">
            <div className="flex items-center space-x-4">
              <span>
                Showing {sortedItems.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
                {Math.min(page * pageSize, sortedItems.length)} of {sortedItems.length} entries
              </span>
              <div className="flex items-center space-x-1">
                <span>Page Size:</span>
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
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded border border-theme-divider hover:bg-theme-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 font-bold text-theme-primary">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded border border-theme-divider hover:bg-theme-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight size={14} />
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
