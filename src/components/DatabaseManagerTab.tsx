/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  Table as TableIcon,
  Search,
  RefreshCw,
  Layers,
  Key,
  Link,
  Terminal,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  FileCode,
  ShieldAlert,
  SlidersHorizontal,
  Server,
  Play
} from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1";

interface DatabaseSummary {
  name: string;
  size_bytes: number;
  size_pretty: string;
  table_count: number;
  is_active: boolean;
  is_control_plane: boolean;
  is_tenant: boolean;
}

interface TableSummary {
  name: string;
  row_count: number;
  size_bytes: number;
  size_pretty: string;
  column_count: number;
  category: string;
}

interface ColumnSchema {
  name: string;
  data_type: string;
  is_nullable: boolean;
  default_value: string | null;
  max_length: number | null;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_table: string | null;
  foreign_column: string | null;
  delete_rule: string | null;
}

interface TableSchemaResponse {
  table_name: string;
  database: string;
  columns: ColumnSchema[];
  primary_keys: string[];
  foreign_keys: {
    column_name: string;
    foreign_table: string;
    foreign_column: string;
    delete_rule: string;
  }[];
  indexes: {
    name: string;
    definition: string;
  }[];
}

interface TableDataResponse {
  table_name: string;
  database: string;
  columns: string[];
  rows: Record<string, any>[];
  total_rows: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface MigrationInfo {
  current_revision: string | null;
  head_revision: string | null;
  is_up_to_date: boolean;
  database: string;
}

interface SqlQueryResponse {
  success: boolean;
  database: string;
  query: string;
  columns: string[];
  rows: Record<string, any>[];
  row_count: number;
  execution_time_ms: number;
  error?: string | null;
}

export interface DatabaseManagerTabProps {
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const DatabaseManagerTab: React.FC<DatabaseManagerTabProps> = ({ onNotification }) => {
  // State: Databases & Selection
  const [databases, setDatabases] = useState<DatabaseSummary[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("smriti001");
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState<"data" | "schema" | "migrations" | "sql">("data");

  // State: Search & Filters
  const [tableSearch, setTableSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // State: Data Grid
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [dataSearch, setDataSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);

  // State: Schema & Migrations
  const [schemaInfo, setSchemaInfo] = useState<TableSchemaResponse | null>(null);
  const [migrationInfo, setMigrationInfo] = useState<MigrationInfo | null>(null);

  // State: SQL Console
  const [sqlQuery, setSqlQuery] = useState("SELECT count(*) FROM sales_invoices;");
  const [queryResult, setQueryResult] = useState<SqlQueryResponse | null>(null);
  const [executingQuery, setExecutingQuery] = useState(false);

  // Loading flags
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // 1. Fetch Databases
  const fetchDatabases = async () => {
    setLoadingDatabases(true);
    try {
      const res = await apiFetchV1("/database-manager/databases");
      if (Array.isArray(res)) {
        setDatabases(res);
        // Default to smriti001 or first available
        if (!selectedDb && res.length > 0) {
          const defaultDb = res.find((d: DatabaseSummary) => d.name === "smriti001") || res[0];
          setSelectedDb(defaultDb.name);
        }
      }
    } catch (err: any) {
      onNotification?.("Database Error", "Failed to load database list. Ensure SYSADMIN permissions.", "error");
    } finally {
      setLoadingDatabases(false);
    }
  };

  // 2. Fetch Tables for Selected DB
  const fetchTables = async (dbName: string) => {
    setLoadingTables(true);
    try {
      const res = await apiFetchV1(`/database-manager/tables?database=${encodeURIComponent(dbName)}`);
      if (Array.isArray(res)) {
        setTables(res);
        if (res.length > 0) {
          // If previous selected table exists in new db, keep it, else select first
          const exists = res.some((t: TableSummary) => t.name === selectedTable);
          if (!exists) {
            setSelectedTable(res[0].name);
          }
        } else {
          setSelectedTable("");
        }
      }
    } catch (err: any) {
      onNotification?.("Database Error", `Failed to load tables for ${dbName}.`, "error");
    } finally {
      setLoadingTables(false);
    }
  };

  // 3. Fetch Migration Info
  const fetchMigrations = async (dbName: string) => {
    try {
      const res = await apiFetchV1(`/database-manager/migrations?database=${encodeURIComponent(dbName)}`);
      setMigrationInfo(res);
    } catch (err) {
      setMigrationInfo(null);
    }
  };

  // 4. Fetch Table Data
  const fetchTableData = async () => {
    if (!selectedDb || !selectedTable) return;
    setLoadingData(true);
    try {
      let url = `/database-manager/tables/${encodeURIComponent(selectedTable)}/data?database=${encodeURIComponent(selectedDb)}&page=${currentPage}&limit=${pageSize}`;
      if (dataSearch) url += `&search=${encodeURIComponent(dataSearch)}`;
      if (sortBy) url += `&sort_by=${encodeURIComponent(sortBy)}&sort_order=${sortOrder}`;

      const res = await apiFetchV1(url);
      setTableData(res);
    } catch (err: any) {
      setTableData(null);
    } finally {
      setLoadingData(false);
    }
  };

  // 5. Fetch Table Schema
  const fetchTableSchema = async () => {
    if (!selectedDb || !selectedTable) return;
    setLoadingSchema(true);
    try {
      const res = await apiFetchV1(`/database-manager/tables/${encodeURIComponent(selectedTable)}/schema?database=${encodeURIComponent(selectedDb)}`);
      setSchemaInfo(res);
    } catch (err: any) {
      setSchemaInfo(null);
    } finally {
      setLoadingSchema(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchDatabases();
  }, []);

  // When DB Changes -> reload tables & migrations
  useEffect(() => {
    if (selectedDb) {
      fetchTables(selectedDb);
      fetchMigrations(selectedDb);
    }
  }, [selectedDb]);

  // When Table / SubTab / Pagination Changes
  useEffect(() => {
    if (activeSubTab === "data") {
      fetchTableData();
    } else if (activeSubTab === "schema") {
      fetchTableSchema();
    }
  }, [selectedDb, selectedTable, activeSubTab, currentPage, pageSize, sortBy, sortOrder]);

  // Handle Search Debounce
  useEffect(() => {
    if (activeSubTab === "data") {
      const timer = setTimeout(() => {
        setCurrentPage(1);
        fetchTableData();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dataSearch]);

  // Execute SQL Query
  const handleExecuteQuery = async () => {
    if (!sqlQuery.trim()) return;
    setExecutingQuery(true);
    try {
      const res = await apiFetchV1("/database-manager/query", {
        method: "POST",
        body: JSON.stringify({
          query: sqlQuery,
          database: selectedDb,
          max_rows: 50
        })
      });
      setQueryResult(res);
      if (!res.success) {
        onNotification?.("Query Warning", res.error || "Query execution failed.", "error");
      }
    } catch (err: any) {
      onNotification?.("Query Error", err.message || "Failed to execute query.", "error");
    } finally {
      setExecutingQuery(false);
    }
  };

  // Categories Filter
  const categories = useMemo(() => {
    const set = new Set(tables.map((t) => t.category));
    return ["All", ...Array.from(set)];
  }, [tables]);

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(tableSearch.toLowerCase());
      const matchesCat = selectedCategory === "All" || t.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [tables, tableSearch, selectedCategory]);

  // Export Data to CSV
  const handleExportCsv = () => {
    if (!tableData || !tableData.rows.length) return;
    const headers = tableData.columns.join(",");
    const rows = tableData.rows.map((row) =>
      tableData.columns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return '""';
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedDb}_${selectedTable}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeDbInfo = databases.find((d) => d.name === selectedDb);
  const activeTableInfo = tables.find((t) => t.name === selectedTable);
  const totalRowsInDb = tables.reduce((acc, t) => acc + t.row_count, 0);

  return (
    <div className="h-full flex flex-col bg-theme-surface-1 text-theme-primary overflow-hidden select-none">
      {/* Top Header & Telemetry Bar */}
      <div className="p-4 border-b border-theme-divider bg-theme-surface-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-xs">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-display tracking-tight text-theme-primary">
                Database Manager & Studio
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                SYSADMIN ONLY
              </span>
            </div>
            <p className="text-xs text-theme-muted">
              Multi-tenant PostgreSQL schema browser, live table inspector & query runner
            </p>
          </div>
        </div>

        {/* Database Selector & Refresh */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-2 bg-theme-surface-1 border border-theme-divider rounded-xl px-3 py-1.5 shadow-xs">
            <Server className="w-4 h-4 text-theme-muted" />
            <span className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">Database:</span>
            <select
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
              className="bg-transparent text-xs font-bold text-theme-primary outline-none cursor-pointer pr-2 font-mono"
            >
              {databases.map((db) => (
                <option key={db.name} value={db.name} className="bg-theme-surface-2 text-theme-primary font-mono">
                  {db.name} ({db.size_pretty}) {db.is_control_plane ? "• Control Plane" : db.is_active ? "• Primary" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchDatabases();
              if (selectedDb) {
                fetchTables(selectedDb);
                fetchMigrations(selectedDb);
              }
            }}
            disabled={loadingDatabases || loadingTables}
            className="p-2 bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-divider rounded-xl text-theme-muted hover:text-theme-primary transition-all cursor-pointer shadow-xs"
            title="Refresh Database Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDatabases || loadingTables ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-theme-divider bg-theme-surface-1">
        <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-theme-muted font-mono">Total Tables</div>
            <div className="text-base font-bold text-theme-primary font-mono">{tables.length}</div>
          </div>
        </div>

        <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <TableIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-theme-muted font-mono">Live Rows Count</div>
            <div className="text-base font-bold text-emerald-400 font-mono">{totalRowsInDb.toLocaleString()}</div>
          </div>
        </div>

        <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-theme-muted font-mono">Database Size</div>
            <div className="text-base font-bold text-amber-400 font-mono">{activeDbInfo?.size_pretty || "0 B"}</div>
          </div>
        </div>

        <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-theme-muted font-mono">Alembic Head</div>
            <div className="text-xs font-bold text-indigo-300 font-mono truncate max-w-[140px]" title={migrationInfo?.current_revision || "None"}>
              {migrationInfo?.current_revision || "Ready"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Body: Sidebar + Main Viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Table Navigator */}
        <div className="w-64 md:w-72 border-r border-theme-divider bg-theme-surface-2 flex flex-col shrink-0">
          <div className="p-3 border-b border-theme-divider space-y-2">
            {/* Table Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-theme-muted" />
              <input
                type="text"
                placeholder="Search tables..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs text-theme-primary placeholder:text-theme-muted outline-none focus:border-theme-primary font-mono"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-indigo-600 text-white font-bold"
                      : "bg-theme-surface-1 text-theme-muted hover:text-theme-primary border border-theme-divider"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Table List Scroll Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {loadingTables ? (
              <div className="p-4 text-center text-xs text-theme-muted font-mono animate-pulse">
                Loading table schema...
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="p-4 text-center text-xs text-theme-muted font-mono">
                No tables matching filter.
              </div>
            ) : (
              filteredTables.map((table) => {
                const isSelected = selectedTable === table.name;
                return (
                  <button
                    key={table.name}
                    type="button"
                    onClick={() => {
                      setSelectedTable(table.name);
                      setCurrentPage(1);
                      setDataSearch("");
                    }}
                    className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 font-bold shadow-xs"
                        : "hover:bg-theme-surface-1 text-theme-primary border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <TableIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-indigo-400" : "text-theme-muted"}`} />
                      <span className="text-xs font-mono truncate">{table.name}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-theme-surface-1 border border-theme-divider text-theme-muted shrink-0 ml-1">
                      {table.row_count.toLocaleString()}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-theme-surface-1">
          {/* SubTab Navigation & Actions */}
          <div className="p-3 border-b border-theme-divider bg-theme-surface-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSubTab("data")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer ${
                  activeSubTab === "data"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-theme-surface-1 text-theme-muted hover:text-theme-primary border border-theme-divider"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table Data</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab("schema")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer ${
                  activeSubTab === "schema"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-theme-surface-1 text-theme-muted hover:text-theme-primary border border-theme-divider"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Schema & FKs</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab("migrations")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer ${
                  activeSubTab === "migrations"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-theme-surface-1 text-theme-muted hover:text-theme-primary border border-theme-divider"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Alembic Migrations</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab("sql")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer ${
                  activeSubTab === "sql"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-theme-surface-1 text-theme-muted hover:text-theme-primary border border-theme-divider"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>SQL Console</span>
              </button>
            </div>

            {/* Quick Actions (Export / Selected Table Badge) */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-theme-surface-1 border border-theme-divider text-theme-primary">
                {selectedTable || "No Table Selected"}
              </span>
              {activeSubTab === "data" && (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={!tableData || !tableData.rows.length}
                  className="px-3 py-1 bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-divider text-theme-primary rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-theme-muted" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* SubTab 1: Data Grid View */}
          {activeSubTab === "data" && (
            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
              {/* Search & Pagination Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-theme-muted" />
                  <input
                    type="text"
                    placeholder="Search in table rows..."
                    value={dataSearch}
                    onChange={(e) => setDataSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-primary placeholder:text-theme-muted outline-none focus:border-theme-primary font-mono"
                  />
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-theme-muted font-mono">
                    Page {currentPage} of {tableData?.total_pages || 1} ({tableData?.total_rows || 0} total)
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage <= 1 || loadingData}
                    className="p-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider rounded-lg text-theme-primary disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, tableData?.total_pages || 1))}
                    disabled={currentPage >= (tableData?.total_pages || 1) || loadingData}
                    className="p-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider rounded-lg text-theme-primary disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 border border-theme-divider rounded-2xl overflow-auto bg-theme-surface-2 custom-scrollbar">
                {loadingData ? (
                  <div className="p-8 text-center text-xs text-theme-muted font-mono animate-pulse">
                    Fetching records from PostgreSQL...
                  </div>
                ) : !tableData || tableData.rows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-theme-muted font-mono">
                    No records found in table `{selectedTable}`.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left font-mono text-xs">
                    <thead>
                      <tr className="bg-theme-surface-3 border-b border-theme-divider sticky top-0 z-10">
                        <th className="p-2.5 font-bold text-theme-muted uppercase tracking-wider border-r border-theme-divider text-center w-12">
                          #
                        </th>
                        {tableData.columns.map((col) => (
                          <th
                            key={col}
                            onClick={() => {
                              if (sortBy === col) {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy(col);
                                setSortOrder("asc");
                              }
                            }}
                            className="p-2.5 font-bold text-theme-primary uppercase tracking-wider border-r border-theme-divider hover:bg-theme-surface-1 cursor-pointer whitespace-nowrap"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{col}</span>
                              {sortBy === col && (
                                <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider">
                      {tableData.rows.map((row, idx) => {
                        const rowNum = (currentPage - 1) * pageSize + idx + 1;
                        return (
                          <tr
                            key={`row-${rowNum}`}
                            onClick={() => setSelectedRow(row)}
                            className="hover:bg-indigo-600/5 transition-colors cursor-pointer"
                          >
                            <td className="p-2 text-center text-theme-muted border-r border-theme-divider font-mono">
                              {rowNum}
                            </td>
                            {tableData.columns.map((col) => {
                              const val = row[col];
                              return (
                                <td
                                  key={col}
                                  className="p-2 text-theme-primary border-r border-theme-divider max-w-xs truncate"
                                  title={val !== null && val !== undefined ? String(val) : "NULL"}
                                >
                                  {val === null || val === undefined ? (
                                    <span className="text-theme-muted/50 italic">null</span>
                                  ) : typeof val === "boolean" ? (
                                    <span className={val ? "text-emerald-400 font-bold" : "text-rose-400"}>
                                      {val ? "true" : "false"}
                                    </span>
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* SubTab 2: Schema & Foreign Keys */}
          {activeSubTab === "schema" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {loadingSchema ? (
                <div className="p-8 text-center text-xs text-theme-muted font-mono animate-pulse">
                  Inspecting table schema & metadata...
                </div>
              ) : !schemaInfo ? (
                <div className="p-8 text-center text-xs text-theme-muted font-mono">
                  No schema information available.
                </div>
              ) : (
                <>
                  {/* Columns Table */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-theme-primary font-mono uppercase tracking-wider">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>Columns & Data Types ({schemaInfo.columns.length})</span>
                    </div>
                    <div className="border border-theme-divider rounded-2xl overflow-hidden bg-theme-surface-2 shadow-xs">
                      <table className="w-full border-collapse text-left font-mono text-xs">
                        <thead>
                          <tr className="bg-theme-surface-3 border-b border-theme-divider">
                            <th className="p-2.5 font-bold text-theme-muted">Column Name</th>
                            <th className="p-2.5 font-bold text-theme-muted">Data Type</th>
                            <th className="p-2.5 font-bold text-theme-muted">Nullable</th>
                            <th className="p-2.5 font-bold text-theme-muted">Default Value</th>
                            <th className="p-2.5 font-bold text-theme-muted">Key Constraint</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme-divider">
                          {schemaInfo.columns.map((col) => (
                            <tr key={col.name} className="hover:bg-theme-surface-1">
                              <td className="p-2.5 font-bold text-theme-primary flex items-center gap-2">
                                {col.is_primary_key && <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                {col.is_foreign_key && <Link className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                                <span>{col.name}</span>
                              </td>
                              <td className="p-2.5 text-indigo-300">
                                {col.data_type}
                                {col.max_length ? `(${col.max_length})` : ""}
                              </td>
                              <td className="p-2.5">
                                <span className={col.is_nullable ? "text-amber-400" : "text-emerald-400 font-bold"}>
                                  {col.is_nullable ? "YES" : "NO (Required)"}
                                </span>
                              </td>
                              <td className="p-2.5 text-theme-muted truncate max-w-xs">
                                {col.default_value || "—"}
                              </td>
                              <td className="p-2.5">
                                {col.is_primary_key && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold mr-1">
                                    PRIMARY KEY
                                  </span>
                                )}
                                {col.is_foreign_key && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                                    FK → {col.foreign_table}.{col.foreign_column} ({col.delete_rule})
                                  </span>
                                )}
                                {!col.is_primary_key && !col.is_foreign_key && <span className="text-theme-muted">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Indexes List */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-theme-primary font-mono uppercase tracking-wider">
                      <Key className="w-4 h-4 text-emerald-400" />
                      <span>Indexes & Constraints ({schemaInfo.indexes.length})</span>
                    </div>
                    <div className="border border-theme-divider rounded-2xl p-3 bg-theme-surface-2 space-y-2 font-mono text-xs">
                      {schemaInfo.indexes.map((idx) => (
                        <div key={idx.name} className="p-2 bg-theme-surface-1 border border-theme-divider rounded-xl">
                          <div className="font-bold text-indigo-400">{idx.name}</div>
                          <div className="text-theme-muted text-[11px] mt-1 break-all">{idx.definition}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SubTab 3: Alembic Migrations */}
          {activeSubTab === "migrations" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl p-6 space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-theme-primary font-display">Alembic Schema Migrations</h2>
                    <p className="text-xs text-theme-muted">Database versioning and schema transition management</p>
                  </div>
                </div>

                <div className="space-y-3 font-mono text-xs pt-2">
                  <div className="flex items-center justify-between p-3 bg-theme-surface-1 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted font-bold">Target Database:</span>
                    <span className="text-theme-primary font-bold">{selectedDb}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-theme-surface-1 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted font-bold">Current Revision:</span>
                    <span className="text-emerald-400 font-bold">{migrationInfo?.current_revision || "None"}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-theme-surface-1 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted font-bold">Head Revision:</span>
                    <span className="text-indigo-400 font-bold">{migrationInfo?.head_revision || "v1338_company_isolated_barcodes"}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-theme-surface-1 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted font-bold">Sync Status:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      migrationInfo?.is_up_to_date ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {migrationInfo?.is_up_to_date ? "UP TO DATE" : "MIGRATION PENDING"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SubTab 4: SQL Query Console */}
          {activeSubTab === "sql" && (
            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
              {/* Security Warning Banner */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-xs text-blue-300 font-mono">
                <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>Read-Only Safety Guard:</strong> Only `SELECT`, `WITH`, and `EXPLAIN` queries are executed. Destructive statements (`DROP`, `DELETE`, `UPDATE`, `TRUNCATE`) are blocked.
                </span>
              </div>

              {/* Query Editor & Run Toolbar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-theme-primary font-mono uppercase tracking-wider">
                    SQL Query ({selectedDb})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSqlQuery(`SELECT count(*) FROM "${selectedTable || "sales_invoices"}";`)}
                      className="px-2 py-1 text-[10px] font-mono bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider rounded-lg text-theme-muted hover:text-theme-primary cursor-pointer"
                    >
                      Count Rows
                    </button>
                    <button
                      type="button"
                      onClick={() => setSqlQuery(`SELECT * FROM "${selectedTable || "sales_invoices"}" LIMIT 25;`)}
                      className="px-2 py-1 text-[10px] font-mono bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider rounded-lg text-theme-muted hover:text-theme-primary cursor-pointer"
                    >
                      Sample 25
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    placeholder="Enter read-only SQL query..."
                    className="w-full p-3 bg-theme-surface-2 border border-theme-divider rounded-xl font-mono text-xs text-theme-primary outline-none focus:border-indigo-500 custom-scrollbar shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleExecuteQuery}
                    disabled={executingQuery || !sqlQuery.trim()}
                    className="absolute right-3 bottom-4 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-mono rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 ${executingQuery ? "animate-spin" : ""}`} />
                    <span>{executingQuery ? "Running..." : "Run Query"}</span>
                  </button>
                </div>
              </div>

              {/* Query Results */}
              <div className="flex-1 border border-theme-divider rounded-2xl overflow-auto bg-theme-surface-2 custom-scrollbar p-3 space-y-2">
                {queryResult && (
                  <div className="flex items-center justify-between text-xs font-mono text-theme-muted pb-2 border-b border-theme-divider">
                    <span>
                      Returned {queryResult.row_count} row(s) in {queryResult.execution_time_ms} ms
                    </span>
                    {queryResult.error && (
                      <span className="text-rose-400 font-bold">{queryResult.error}</span>
                    )}
                  </div>
                )}

                {queryResult && queryResult.rows.length > 0 ? (
                  <table className="w-full border-collapse text-left font-mono text-xs">
                    <thead>
                      <tr className="bg-theme-surface-3 border-b border-theme-divider sticky top-0 z-10">
                        {queryResult.columns.map((col) => (
                          <th key={col} className="p-2 font-bold text-theme-primary border-r border-theme-divider uppercase">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider">
                      {queryResult.rows.map((row, idx) => (
                        <tr key={`qr-${idx}`} className="hover:bg-theme-surface-1">
                          {queryResult.columns.map((col) => (
                            <td key={col} className="p-2 border-r border-theme-divider text-theme-primary truncate max-w-xs">
                              {row[col] !== null && row[col] !== undefined ? String(row[col]) : "null"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-xs text-theme-muted font-mono">
                    {queryResult ? "No rows returned." : "Run a query above to inspect live database output."}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row Inspector Drawer / Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl h-full bg-theme-surface-2 border border-theme-divider rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-3">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold font-mono text-theme-primary">
                  Row Inspector • `{selectedTable}`
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="p-1.5 hover:bg-theme-surface-1 rounded-lg text-theme-muted hover:text-theme-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs custom-scrollbar">
              {Object.entries(selectedRow).map(([key, val]) => (
                <div key={key} className="p-2.5 bg-theme-surface-1 border border-theme-divider rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-indigo-400 mb-1">{key}</div>
                  <div className="text-theme-primary break-all">
                    {val === null || val === undefined ? (
                      <span className="text-theme-muted/50 italic">null</span>
                    ) : typeof val === "object" ? (
                      <pre className="text-[11px] overflow-x-auto">{JSON.stringify(val, null, 2)}</pre>
                    ) : (
                      String(val)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
