/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * SMRITI Store Directory & Responsibility Matrix Workspace
 * Unified catalog of internal company branches and partner retail delivery locations
 * with live attendance tracking, role exclusivity, and historical placement audit logs.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2,
  Store,
  Users,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  X,
  ShieldCheck,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  UserPlus,
  History,
  PackageCheck,
  Calendar,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { ExportButton } from "../export/ExportButton.tsx";
import { ExportColumnDefinition } from "../export/types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

export interface StoreDirectoryItem {
  id: string;
  canonical_id: string;
  store_code: string;
  store_name: string;
  store_type: "INTERNAL_BRANCH" | "CUSTOMER_STORE";
  host_id: string;
  host_name: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  status: string;
  store_manager?: { id: string; name: string; username: string; phone?: string; effective_from: string } | null;
  primary_representative?: { id: string; name: string; username: string; phone?: string; effective_from: string } | null;
  assigned_staff_count: number;
  verified_present_today_count: number;
  psv_active: boolean;
}

export interface StoreDirectorySummary {
  total_stores: number;
  total_internal_branches: number;
  total_partner_stores: number;
  stores_with_manager: number;
  total_assigned_staff: number;
  total_verified_present_today: number;
}

export interface RosterEntry {
  placement_id: string;
  staff_user_id: string;
  name: string;
  username: string;
  phone: string;
  role_at_location: string;
  stock_model: string;
  effective_from: string;
  effective_to?: string | null;
  verified_attendance: {
    is_present: boolean;
    check_in_at?: string | null;
    status: string;
  };
}

export interface HistoryEntry {
  id: string;
  staff_user_id: string;
  staff_name: string;
  role_at_location: string;
  effective_from: string;
  effective_to?: string | null;
  status: string;
  approved_at?: string | null;
}

export interface CustomerPortfolioEntry {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  delivery_location_id: string;
  store_code: string;
  location_name: string;
  gstin?: string;
  outstanding: number;
  status: string;
}

const EXPORT_COLUMNS: ExportColumnDefinition[] = [
  { key: "store_code", label: "Store Code", width: 14 },
  { key: "store_name", label: "Store Name", width: 28 },
  { key: "store_type", label: "Store Type", width: 18 },
  { key: "host_name", label: "Host Entity", width: 24 },
  { key: "city", label: "City", width: 16 },
  { key: "state", label: "State", width: 16 },
  { key: "manager_name", label: "Store Manager", width: 22 },
  { key: "rep_name", label: "Primary Representative", width: 22 },
  { key: "assigned_staff_count", label: "Assigned Staff", width: 14 },
  { key: "verified_present_today_count", label: "Present Today", width: 14 },
  { key: "status", label: "Status", width: 12 },
];

export const StoreDirectoryWs: React.FC = () => {
  const [items, setItems] = useState<StoreDirectoryItem[]>([]);
  const [summary, setSummary] = useState<StoreDirectorySummary>({
    total_stores: 0,
    total_internal_branches: 0,
    total_partner_stores: 0,
    stores_with_manager: 0,
    total_assigned_staff: 0,
    total_verified_present_today: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [storeTypeFilter, setStoreTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected Store 360 State
  const [selectedStore, setSelectedStore] = useState<StoreDirectoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<"ROSTER" | "HISTORY" | "CUSTOMERS">("ROSTER");
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);
  const [rosterData, setRosterData] = useState<RosterEntry[]>([]);
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [customerData, setCustomerData] = useState<CustomerPortfolioEntry[]>([]);

  // Placement Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [assignRole, setAssignRole] = useState<string>("SALES_REPRESENTATIVE");
  const [assignStockModel, setAssignStockModel] = useState<string>("OUTRIGHT_SALE");
  const [assignEffectiveFrom, setAssignEffectiveFrom] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [assignSubmitting, setAssignSubmitting] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const fetchDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (storeTypeFilter !== "ALL") params.set("store_type", storeTypeFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await apiFetchV1(`/staff/stores/directory?${params.toString()}`);
      if (res && res.items) {
        setItems(res.items);
        setSummary(
          res.summary || {
            total_stores: res.items.length,
            total_internal_branches: res.items.filter((i: StoreDirectoryItem) => i.store_type === "INTERNAL_BRANCH").length,
            total_partner_stores: res.items.filter((i: StoreDirectoryItem) => i.store_type === "CUSTOMER_STORE").length,
            stores_with_manager: res.items.filter((i: StoreDirectoryItem) => Boolean(i.store_manager)).length,
            total_assigned_staff: res.items.reduce((acc: number, i: StoreDirectoryItem) => acc + (i.assigned_staff_count || 0), 0),
            total_verified_present_today: res.items.reduce((acc: number, i: StoreDirectoryItem) => acc + (i.verified_present_today_count || 0), 0),
          }
        );
      }
    } catch (err) {
      console.error("Failed to load store directory:", err);
    } finally {
      setLoading(false);
    }
  }, [search, storeTypeFilter, statusFilter]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  const loadStoreDetails = useCallback(async (store: StoreDirectoryItem) => {
    setSelectedStore(store);
    setDrawerLoading(true);
    try {
      const codeOrId = store.id;
      const [rosterRes, historyRes, customerRes] = await Promise.allSettled([
        apiFetchV1(`/staff/stores/${encodeURIComponent(codeOrId)}/roster`),
        apiFetchV1(`/staff/stores/${encodeURIComponent(codeOrId)}/history`),
        apiFetchV1(`/staff/stores/${encodeURIComponent(codeOrId)}/customers`),
      ]);

      if (rosterRes.status === "fulfilled" && rosterRes.value?.roster) {
        setRosterData(rosterRes.value.roster);
      } else {
        setRosterData([]);
      }

      if (historyRes.status === "fulfilled" && historyRes.value?.history) {
        setHistoryData(historyRes.value.history);
      } else {
        setHistoryData([]);
      }

      if (customerRes.status === "fulfilled" && customerRes.value?.customers) {
        setCustomerData(customerRes.value.customers);
      } else {
        setCustomerData([]);
      }
    } catch (err) {
      console.error("Error loading store 360 details:", err);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const handleCreatePlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !assignUserId.trim()) {
      setAssignError("Staff User ID is required.");
      return;
    }

    setAssignSubmitting(true);
    setAssignError(null);

    try {
      const payload: Record<string, any> = {
        placement_type: selectedStore.store_type,
        role_at_location: assignRole,
        stock_model: assignStockModel,
        effective_from: assignEffectiveFrom,
      };

      if (selectedStore.store_type === "INTERNAL_BRANCH") {
        payload.internal_branch_id = selectedStore.canonical_id;
      } else {
        payload.host_customer_id = selectedStore.host_id;
        payload.host_delivery_location_id = selectedStore.canonical_id;
      }

      await apiFetchV1(`/staff/${encodeURIComponent(assignUserId.trim())}/placements`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowAssignModal(false);
      setAssignUserId("");
      // Reload store details and directory
      await loadStoreDetails(selectedStore);
      await fetchDirectory();
    } catch (err: any) {
      setAssignError(err?.message || "Failed to create placement assignment.");
    } finally {
      setAssignSubmitting(false);
    }
  };

  const exportData = useMemo(() => {
    return items.map((i) => ({
      store_code: i.store_code,
      store_name: i.store_name,
      store_type: i.store_type === "INTERNAL_BRANCH" ? "Company Branch" : "Partner Retail Store",
      host_name: i.host_name,
      city: i.city,
      state: i.state,
      manager_name: i.store_manager?.name || "Unassigned",
      rep_name: i.primary_representative?.name || "Unassigned",
      assigned_staff_count: i.assigned_staff_count,
      verified_present_today_count: i.verified_present_today_count,
      status: i.status,
    }));
  }, [items]);

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-body font-sans select-none overflow-hidden">
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-theme-surface-2 border-b border-theme-divider shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-500" />
            <h1 className="text-base font-bold text-theme-primary font-display tracking-tight">
              Store Directory & Responsibility Matrix
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-400 border border-blue-500/30">
              v1.0.0
            </span>
          </div>
          <p className="text-[12px] text-theme-muted mt-0.5">
            Canonical catalog of internal branches and customer delivery locations with live attendance and role assignments
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ExportButton
            moduleTitle="Store Directory & Staff Responsibility Matrix"
            columns={EXPORT_COLUMNS}
            data={exportData}
          />
          <button
            onClick={fetchDirectory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-body border border-theme-divider transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-theme-surface-1 border-b border-theme-divider">
        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px] font-medium font-mono uppercase">
            <span>Total Stores</span>
            <Store className="w-4 h-4 text-theme-muted" />
          </div>
          <div className="text-xl font-bold font-mono text-theme-primary mt-1">
            {summary.total_stores}
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px] font-medium font-mono uppercase">
            <span>Company Branches</span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-400 mt-1">
            {summary.total_internal_branches}
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px] font-medium font-mono uppercase">
            <span>Partner Stores</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-400 mt-1">
            {summary.total_partner_stores}
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px] font-medium font-mono uppercase">
            <span>With Manager</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {summary.stores_with_manager}
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px] font-medium font-mono uppercase">
            <span>Assigned Staff</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
            {summary.total_assigned_staff}
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted text-[11px] font-medium font-mono uppercase">
            <span>Present Today</span>
            <UserCheck className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-bold font-mono text-teal-400 mt-1">
            {summary.total_verified_present_today}
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-theme-surface-2/60 border-b border-theme-divider">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              type="text"
              placeholder="Search store code, name, manager, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-theme-surface-3 border border-theme-divider text-theme-body placeholder:text-theme-muted focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-theme-muted" />
            <select
              value={storeTypeFilter}
              onChange={(e) => setStoreTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-theme-surface-3 border border-theme-divider text-theme-body focus:outline-none"
            >
              <option value="ALL">All Store Types</option>
              <option value="INTERNAL_BRANCH">Company Branches</option>
              <option value="CUSTOMER_STORE">Partner Retail Stores</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-theme-surface-3 border border-theme-divider text-theme-body focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-theme-muted font-mono">
          Showing {items.length} stores
        </div>
      </div>

      {/* Main Store Directory Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-theme-surface-2 sticky top-0 z-10 border-b border-theme-divider font-mono text-[11px] text-theme-muted uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Store Code</th>
              <th className="py-2.5 px-4 font-semibold">Store / Branch Name</th>
              <th className="py-2.5 px-4 font-semibold">Type</th>
              <th className="py-2.5 px-4 font-semibold">Host / Customer</th>
              <th className="py-2.5 px-4 font-semibold">Location</th>
              <th className="py-2.5 px-4 font-semibold">Store Manager</th>
              <th className="py-2.5 px-4 font-semibold">Primary Rep</th>
              <th className="py-2.5 px-4 font-semibold text-center">Staffing (Assigned / Present)</th>
              <th className="py-2.5 px-4 font-semibold text-center">Status</th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-divider/50">
            {loading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-theme-muted">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading store directory...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-theme-muted">
                  <Store className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No store records matching the selected filters.
                </td>
              </tr>
            ) : (
              items.map((store) => (
                <tr
                  key={store.id}
                  onClick={() => loadStoreDetails(store)}
                  className="hover:bg-theme-surface-hover/80 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-blue-400">
                    <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30">
                      {store.store_code}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-theme-primary">{store.store_name}</div>
                    <div className="text-[11px] text-theme-muted truncate max-w-[240px]">
                      {store.address || `${store.city}, ${store.state}`}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {store.store_type === "INTERNAL_BRANCH" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-500/30">
                        Company Branch
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-500/30">
                        Partner Store
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-medium text-theme-body truncate max-w-[200px]">
                    {store.host_name}
                  </td>
                  <td className="py-3 px-4 text-theme-muted">
                    {store.city}, {store.state}
                  </td>
                  <td className="py-3 px-4">
                    {store.store_manager ? (
                      <div className="flex items-center gap-1.5 font-medium text-theme-body">
                        <div className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold">
                          {store.store_manager.name.charAt(0)}
                        </div>
                        <span className="truncate max-w-[140px]">{store.store_manager.name}</span>
                      </div>
                    ) : (
                      <span className="text-theme-muted/60 text-[11px] italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {store.primary_representative ? (
                      <div className="flex items-center gap-1.5 font-medium text-theme-body">
                        <div className="w-5 h-5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/40 flex items-center justify-center text-[10px] font-bold">
                          {store.primary_representative.name.charAt(0)}
                        </div>
                        <span className="truncate max-w-[140px]">{store.primary_representative.name}</span>
                      </div>
                    ) : (
                      <span className="text-theme-muted/60 text-[11px] italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex items-center gap-1.5 font-mono">
                      <span className="font-semibold text-theme-primary">{store.assigned_staff_count}</span>
                      <span className="text-theme-muted">/</span>
                      <span
                        className={`font-semibold ${
                          store.verified_present_today_count > 0 ? "text-emerald-400" : "text-theme-muted"
                        }`}
                      >
                        {store.verified_present_today_count}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          store.verified_present_today_count > 0 ? "bg-emerald-400" : "bg-slate-600"
                        }`}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        store.status === "ACTIVE"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {store.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        loadStoreDetails(store);
                      }}
                      className="px-2.5 py-1 text-xs rounded bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-body border border-theme-divider transition-colors"
                    >
                      Store 360
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Store 360 Slide-Over Drawer */}
      {selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs">
          <div className="relative flex flex-col h-full w-full max-w-3xl bg-theme-surface-1 border-l border-theme-divider shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-theme-surface-2 border-b border-theme-divider">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-950 text-blue-400 border border-blue-500/30">
                    {selectedStore.store_code}
                  </span>
                  <h2 className="text-base font-bold text-theme-primary font-display">
                    {selectedStore.store_name}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedStore.store_type === "INTERNAL_BRANCH"
                        ? "bg-blue-950 text-blue-300 border border-blue-500/30"
                        : "bg-purple-950 text-purple-300 border border-purple-500/30"
                    }`}
                  >
                    {selectedStore.store_type === "INTERNAL_BRANCH" ? "Company Branch" : "Partner Store"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-theme-muted mt-1 font-mono">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    Host: {selectedStore.host_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {selectedStore.city}, {selectedStore.state}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedStore(null)}
                className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex items-center gap-2 px-6 pt-3 bg-theme-surface-2/40 border-b border-theme-divider">
              <button
                onClick={() => setActiveTab("ROSTER")}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "ROSTER"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-theme-muted hover:text-theme-body"
                }`}
              >
                <Users className="w-4 h-4" />
                Staff Roster & Live Attendance ({rosterData.length})
              </button>

              <button
                onClick={() => setActiveTab("HISTORY")}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "HISTORY"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-theme-muted hover:text-theme-body"
                }`}
              >
                <History className="w-4 h-4" />
                Placement History ({historyData.length})
              </button>

              <button
                onClick={() => setActiveTab("CUSTOMERS")}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "CUSTOMERS"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-theme-muted hover:text-theme-body"
                }`}
              >
                <Layers className="w-4 h-4" />
                Serviced Outlets ({customerData.length})
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {drawerLoading ? (
                <div className="py-16 text-center text-theme-muted">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading store 360 data...
                </div>
              ) : activeTab === "ROSTER" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
                        Active Staff Placements & Physical Presence Today
                      </h3>
                      <p className="text-[11px] text-theme-muted">
                        Attendance status is derived exclusively from biometric and registered daily check-in logs.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Assign Staff
                    </button>
                  </div>

                  {rosterData.length === 0 ? (
                    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-8 text-center text-theme-muted">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No active staff currently assigned to this store.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {rosterData.map((staff) => (
                        <div
                          key={staff.placement_id}
                          className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-theme-surface-3 border border-theme-divider flex items-center justify-center font-bold text-theme-primary text-sm">
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-theme-primary text-sm">{staff.name}</span>
                                <span className="text-[11px] font-mono text-theme-muted">@{staff.username}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-theme-muted mt-0.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-theme-surface-3 text-theme-body border border-theme-divider">
                                  {staff.role_at_location}
                                </span>
                                <span>• Effective: {staff.effective_from}</span>
                                {staff.phone && <span>• {staff.phone}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {staff.verified_attendance.is_present ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                  Present Today
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                                  Not Logged
                                </span>
                              )}
                            </div>
                            {staff.verified_attendance.check_in_at && (
                              <div className="text-[10px] text-theme-muted font-mono mt-1">
                                In: {new Date(staff.verified_attendance.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === "HISTORY" ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
                    Historical Placement Audit Trail
                  </h3>
                  {historyData.length === 0 ? (
                    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-8 text-center text-theme-muted">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No past placement history records found for this location.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-theme-surface-2 border-b border-theme-divider font-mono text-[11px] text-theme-muted uppercase">
                        <tr>
                          <th className="py-2 px-3">Staff Name</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3">Effective Range</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider/40">
                        {historyData.map((h) => (
                          <tr key={h.id} className="hover:bg-theme-surface-hover/50">
                            <td className="py-2.5 px-3 font-medium text-theme-primary">{h.staff_name}</td>
                            <td className="py-2.5 px-3 font-mono">{h.role_at_location}</td>
                            <td className="py-2.5 px-3 font-mono text-theme-muted">
                              {h.effective_from} to {h.effective_to || "Present"}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  h.status === "ACTIVE"
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {h.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
                    Serviced Customer Outlets & Delivery Locations
                  </h3>
                  {customerData.length === 0 ? (
                    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-8 text-center text-theme-muted">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No customer delivery locations linked to this store code.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {customerData.map((c) => (
                        <div
                          key={c.delivery_location_id}
                          className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-theme-primary">{c.customer_name}</span>
                              <span className="text-[11px] font-mono text-theme-muted">({c.customer_code})</span>
                            </div>
                            <div className="text-xs text-theme-muted mt-0.5">
                              {c.location_name} • GSTIN: {c.gstin || "Unregistered"}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-theme-muted block">Outstanding</span>
                            <span className="font-mono font-bold text-emerald-400">
                              ₹{c.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {showAssignModal && selectedStore && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-theme-divider pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-bold text-theme-primary font-display">
                  Assign Staff to {selectedStore.store_code}
                </h3>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-theme-muted hover:text-theme-body"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignError && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePlacement} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-theme-muted font-medium mb-1">
                  Staff User ID (e.g. usr-101) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter staff user identifier..."
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-theme-surface-3 border border-theme-divider text-theme-body focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">
                  Role at Store Location <span className="text-rose-400">*</span>
                </label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-theme-surface-3 border border-theme-divider text-theme-body focus:outline-none"
                >
                  <option value="STORE_MANAGER">Store Manager (Sole Lead)</option>
                  <option value="PRIMARY_REPRESENTATIVE">Primary Representative (Exclusive)</option>
                  <option value="SALES_REPRESENTATIVE">Sales Representative (Roaming Permitted)</option>
                  <option value="BACKUP_REPRESENTATIVE">Backup Representative</option>
                  <option value="CASHIER">Cashier / Till Operator</option>
                </select>
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">
                  Commercial Stock Model
                </label>
                <select
                  value={assignStockModel}
                  onChange={(e) => setAssignStockModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-theme-surface-3 border border-theme-divider text-theme-body focus:outline-none"
                >
                  <option value="OUTRIGHT_SALE">Outright Sale</option>
                  <option value="CONSIGNMENT">Consignment (PSV)</option>
                  <option value="STOCK_ON_APPROVAL">Stock on Approval</option>
                </select>
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">
                  Effective From Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={assignEffectiveFrom}
                  onChange={(e) => setAssignEffectiveFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-theme-surface-3 border border-theme-divider text-theme-body focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-divider">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {assignSubmitting ? "Assigning..." : "Confirm Placement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
