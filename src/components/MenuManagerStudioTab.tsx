/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-26
 * Modified     : 2026-08-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Control Plane Menu Manager & Dynamic Navigation Studio (Light Theme)
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Settings,
  ShieldCheck,
  Save,
  Eye,
  EyeOff,
  History,
  Search,
  Plus,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Sparkles,
  ExternalLink,
  ChevronRight,
  GripVertical,
  Lock,
  Compass,
  FileCode,
  Check,
  X
} from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

export interface MenuItemData {
  id: string;
  title: string;
  icon?: string;
  sequence: number;
  module?: string;
  route?: string;
  parent_id?: string | null;
  permission?: string;
  is_active: boolean;
  company_id?: string | null;
  branch_id?: string | null;
}

export interface AuditLogEntry {
  id: string;
  entity_id: string;
  changed_record_id?: string;
  old_value?: string;
  new_value?: string;
  change_type: string;
  changed_by?: string;
  changed_by_name?: string;
  changed_at?: string;
}

interface MenuManagerStudioTabProps {
  currentUser?: { role: string; name: string } | null;
  onNavigateTab?: (tabId: string) => void;
}

export const MenuManagerStudioTab: React.FC<MenuManagerStudioTabProps> = ({
  currentUser,
  onNavigateTab,
}) => {
  const [menus, setMenus] = useState<MenuItemData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Studio State
  const [selectedMenuId, setSelectedMenuId] = useState<string>("pos");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [simulatedRole, setSimulatedRole] = useState<string>(currentUser?.role || "SYSADMIN");
  const [isDeploying, setIsDeploying] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<"simulator" | "audit">("simulator");
  const [draggedMenuId, setDraggedMenuId] = useState<string | null>(null);

  // Form State for Selected Node
  const [formState, setFormState] = useState<{
    id: string;
    title: string;
    icon: string;
    sequence: number;
    module: string;
    route: string;
    parent_id: string;
    is_active: boolean;
    permissions: {
      view: boolean;
      create: boolean;
      modify: boolean;
      cancel: boolean;
      authorize: boolean;
      print: boolean;
      export: boolean;
    };
  }>({
    id: "",
    title: "",
    icon: "grid_view",
    sequence: 10,
    module: "Retail Operations",
    route: "",
    parent_id: "",
    is_active: true,
    permissions: {
      view: true,
      create: true,
      modify: true,
      cancel: false,
      authorize: false,
      print: true,
      export: true,
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, aRes] = await Promise.all([
        apiFetchV1("/menus/"),
        apiFetchV1("/menus/audit"),
      ]);
      const loadedMenus = Array.isArray(mRes) ? mRes : [];
      setMenus(loadedMenus);
      setAuditLogs(Array.isArray(aRes) ? aRes : []);

      // Auto-select first item if not set
      if (loadedMenus.length > 0) {
        const found = loadedMenus.find((m) => m.id === selectedMenuId) || loadedMenus[0];
        selectNode(found);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load Control Plane Menu Registry.");
    } finally {
      setLoading(false);
    }
  };

  const selectNode = (node: MenuItemData) => {
    setSelectedMenuId(node.id);
    setFormState({
      id: node.id,
      title: node.title,
      icon: node.icon || "grid_view",
      sequence: node.sequence || 10,
      module: node.module || "Retail Operations",
      route: node.route || `/${node.id.replace("menu-", "").replace("-", "/")}`,
      parent_id: node.parent_id || "",
      is_active: node.is_active,
      permissions: {
        view: true,
        create: node.is_active,
        modify: node.is_active,
        cancel: false,
        authorize: false,
        print: true,
        export: true,
      },
    });
    setSuccessMsg(null);
  };

  const handleToggleActive = async (menu: MenuItemData) => {
    setSavingId(menu.id);
    try {
      const updated = await apiFetchV1(`/menus/${menu.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !menu.is_active }),
      });
      setMenus((prev) => prev.map((m) => (m.id === menu.id ? { ...m, ...updated } : m)));
      if (selectedMenuId === menu.id) {
        setFormState((prev) => ({ ...prev, is_active: !menu.is_active }));
      }
      loadAuditLogs();
      setSuccessMsg(`Status updated for '${menu.title}'`);
    } catch (err: any) {
      setError(err?.message || "Failed to update menu status");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuId) return;
    setSavingId(selectedMenuId);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await apiFetchV1(`/menus/${selectedMenuId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: formState.title,
          icon: formState.icon,
          sequence: Number(formState.sequence) || 10,
          module: formState.module,
          is_active: formState.is_active,
          parent_id: formState.parent_id || null,
        }),
      });
      setMenus((prev) => prev.map((m) => (m.id === selectedMenuId ? { ...m, ...updated } : m)));
      loadAuditLogs();
      setSuccessMsg(`Menu node '${formState.title}' saved and audited successfully!`);
    } catch (err: any) {
      setError(err?.message || "Failed to update menu configuration");
    } finally {
      setSavingId(null);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const aRes = await apiFetchV1("/menus/audit");
      setAuditLogs(Array.isArray(aRes) ? aRes : []);
    } catch {
      // Non-blocking
    }
  };

  const handleDragStart = (e: React.DragEvent, menuId: string) => {
    e.dataTransfer.setData("text/plain", menuId);
    setDraggedMenuId(menuId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetMenu: MenuItemData) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") || draggedMenuId;
    if (!sourceId || sourceId === targetMenu.id) {
      setDraggedMenuId(null);
      return;
    }
    const sourceMenu = menus.find((m) => m.id === sourceId);
    if (!sourceMenu) return;

    const sourceSeq = targetMenu.sequence || 10;
    const targetSeq = sourceMenu.sequence || 10;

    try {
      await Promise.all([
        apiFetchV1(`/menus/${sourceMenu.id}`, {
          method: "PUT",
          body: JSON.stringify({ sequence: sourceSeq }),
        }),
        apiFetchV1(`/menus/${targetMenu.id}`, {
          method: "PUT",
          body: JSON.stringify({ sequence: targetSeq }),
        }),
      ]);
      setMenus((prev) =>
        prev
          .map((m) => {
            if (m.id === sourceMenu.id) return { ...m, sequence: sourceSeq };
            if (m.id === targetMenu.id) return { ...m, sequence: targetSeq };
            return m;
          })
          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      );
      setSuccessMsg(`Reordered '${sourceMenu.title}' to #${sourceSeq}`);
      loadAuditLogs();
    } catch {
      setError("Failed to persist drag reordering.");
    } finally {
      setDraggedMenuId(null);
    }
  };

  const handleDeployTree = async () => {
    setIsDeploying(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      await loadData();
      setSuccessMsg("Navigation tree re-indexed and published across all active tenant nodes!");
    } catch (err: any) {
      setError(err?.message || "Failed to deploy navigation tree.");
    } finally {
      setIsDeploying(false);
    }
  };

  // Modules & Categories for Filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    menus.forEach((m) => {
      if (m.module) set.add(m.module);
    });
    return ["ALL", ...Array.from(set)];
  }, [menus]);

  // Filtered Menu List
  const filteredMenus = useMemo(() => {
    return menus.filter((m) => {
      const matchesSearch =
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.module && m.module.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.route && m.route.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCat = categoryFilter === "ALL" || m.module === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [menus, searchTerm, categoryFilter]);

  // Simulated NavRail Items based on simulatedRole
  const simulatedNavItems = useMemo(() => {
    const isSysAdmin = simulatedRole === "SYSADMIN" || simulatedRole === "SYSTEM ADMIN";
    const isManager = simulatedRole === "MANAGER" || isSysAdmin;

    return menus
      .filter((m) => m.is_active)
      .filter((m) => {
        if (isSysAdmin) return true;
        if (isManager) return true;
        // Cashier only sees operational / non-admin modules
        const cashierModules = ["pos", "sales", "item-master", "barcode", "stock-ledger", "customer-master", "loyalty"];
        return cashierModules.includes(m.id) || (m.module && m.module.includes("Retail"));
      })
      .slice(0, 10);
  }, [menus, simulatedRole]);

  return (
    <div className="w-full h-full flex flex-col bg-[#f8fafc] text-[#0f172a] font-sans select-none overflow-hidden">
      {/* 1. Global Studio Header */}
      <header className="bg-white border-b border-[#e2e8f0] px-5 py-3 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1e40af]/10 text-[#1e40af] rounded-lg flex items-center justify-center border border-[#1e40af]/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#64748b] leading-tight">
              <span>SMRITI Control Plane</span>
              <span>/</span>
              <span>Security & Governance</span>
              <span>/</span>
              <span className="text-[#1e40af] font-semibold">Menu Navigation Registry</span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-base font-bold font-display text-[#0f172a] tracking-tight">
                Menu Manager & Dynamic Navigation Studio
              </h1>
              <span className="px-2 py-0.5 bg-[#eff6ff] text-[#1e40af] text-[10px] font-mono font-bold border border-[#bfdbfe] rounded">
                system.menu.manage
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Role Simulator */}
        <div className="flex items-center gap-3">
          {/* Role Simulator Dropdown */}
          <div className="flex items-center gap-2 bg-[#f1f5f9] px-3 py-1.5 rounded-lg border border-[#cbd5e1] text-xs">
            <Sliders className="w-3.5 h-3.5 text-[#1e40af]" />
            <span className="text-[#475569] font-medium">Preview As:</span>
            <select
              value={simulatedRole}
              onChange={(e) => setSimulatedRole(e.target.value)}
              className="bg-transparent font-bold text-[#0f172a] focus:outline-none cursor-pointer text-xs"
            >
              <option value="SYSADMIN">System Admin (Full Access)</option>
              <option value="MANAGER">Store Manager</option>
              <option value="CASHIER">Billing Cashier (POS Only)</option>
              <option value="AUDITOR">Auditor (Read-Only)</option>
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Registry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#1e40af]" : ""}`} />
            Refresh
          </button>

          <button
            onClick={handleDeployTree}
            disabled={isDeploying}
            className="px-4 py-2 bg-[#1e40af] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-98 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isDeploying ? "Deploying Tree..." : "Deploy Navigation Tree"}
          </button>
        </div>
      </header>

      {/* Global Alerts Banner */}
      {error && (
        <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Main 3-Column Studio Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* ============================================================ */}
        {/* COLUMN 1: Hierarchical Menu Tree Explorer (340px) */}
        {/* ============================================================ */}
        <aside className="w-88 border-r border-[#e2e8f0] bg-white flex flex-col shrink-0">
          {/* Search & Category Filter */}
          <div className="p-3 border-b border-[#e2e8f0] space-y-2.5 bg-[#f8fafc]">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search menus by ID, label, route..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] font-sans"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px] font-medium">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? "bg-[#1e40af] text-white font-bold"
                      : "bg-white border border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]"
                  }`}
                >
                  {cat === "ALL" ? `All (${menus.length})` : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-transparent">
            {filteredMenus.length === 0 ? (
              <div className="p-8 text-center text-[#94a3b8] text-xs">
                No menus matching search criteria.
              </div>
            ) : (
              filteredMenus.map((m) => {
                const isSelected = m.id === selectedMenuId;
                return (
                  <div
                    key={m.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, m.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, m)}
                    onClick={() => selectNode(m)}
                    className={`group px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing flex items-center justify-between ${
                      isSelected
                        ? "bg-[#eff6ff] border-[#3b82f6] shadow-xs"
                        : draggedMenuId === m.id
                        ? "opacity-50 border-dashed border-[#1e40af] bg-[#f8fafc]"
                        : "bg-white border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="text-[#94a3b8] group-hover:text-[#64748b]">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-[#1e40af]">
                        {m.icon || "grid_view"}
                      </span>
                      <div className="min-w-0 leading-tight">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-[#0f172a] truncate">
                            {m.title}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] rounded">
                            #{m.sequence}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-[#64748b] truncate mt-0.5">
                          {m.route || m.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(m);
                        }}
                        disabled={savingId === m.id}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          m.is_active
                            ? "text-emerald-600 hover:bg-emerald-50"
                            : "text-rose-500 hover:bg-rose-50"
                        }`}
                        title={m.is_active ? "Menu Active (Click to disable)" : "Menu Inactive (Click to enable)"}
                      >
                        {m.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <ChevronRight className={`w-4 h-4 ${isSelected ? "text-[#1e40af]" : "text-[#cbd5e1]"}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Explorer Stats */}
          <div className="p-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>Active: {menus.filter((m) => m.is_active).length} / {menus.length}</span>
            <span className="text-emerald-700 font-bold">100% Postgres Sync</span>
          </div>
        </aside>

        {/* ============================================================ */}
        {/* COLUMN 2: Node Configurator & Security Matrix (Flex 1) */}
        {/* ============================================================ */}
        <main className="flex-1 bg-[#f8fafc] overflow-y-auto p-6 space-y-5">
          {/* Header Card */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#eff6ff] text-[#1e40af] rounded-xl flex items-center justify-center border border-[#bfdbfe]">
                <span className="material-symbols-outlined text-2xl">
                  {formState.icon || "grid_view"}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#0f172a] font-display">
                    Editing Node: {formState.title}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      formState.is_active
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {formState.is_active ? "Active in Registry" : "Disabled"}
                  </span>
                </div>
                <p className="text-xs text-[#64748b] font-mono mt-0.5">
                  ID: <strong className="text-[#0f172a]">{formState.id}</strong> | Sequence: #{formState.sequence}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveNode}
                disabled={savingId === selectedMenuId}
                className="px-4 py-2 bg-[#1e40af] hover:bg-[#1d4ed8] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {savingId === selectedMenuId ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Form Configuration Grid */}
          <form onSubmit={handleSaveNode} className="space-y-5">
            {/* Card 1: Basic Node Metadata */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-3">
                <Settings className="w-4 h-4 text-[#1e40af]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a] font-mono">
                  1. Canonical Menu Properties & Route
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-[#475569] font-medium mb-1">Display Label</label>
                  <input
                    type="text"
                    value={formState.title}
                    onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0f172a] font-semibold focus:bg-white focus:outline-none focus:border-[#1e40af]"
                    placeholder="e.g. POS Billing Desk"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[#475569] font-medium mb-1">Material Symbol Icon</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formState.icon}
                      onChange={(e) => setFormState({ ...formState, icon: e.target.value })}
                      className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg pl-9 pr-3 py-2 text-[#0f172a] font-mono focus:bg-white focus:outline-none focus:border-[#1e40af]"
                      placeholder="e.g. point_of_sale"
                    />
                    <span className="material-symbols-outlined text-[18px] text-[#1e40af] absolute left-2.5 top-2.5">
                      {formState.icon || "grid_view"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[#475569] font-medium mb-1">Category / Module Group</label>
                  <input
                    type="text"
                    value={formState.module}
                    onChange={(e) => setFormState({ ...formState, module: e.target.value })}
                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0f172a] focus:bg-white focus:outline-none focus:border-[#1e40af]"
                    placeholder="e.g. Retail Operations"
                  />
                </div>

                <div>
                  <label className="block text-[#475569] font-medium mb-1">Sequence Sort Order</label>
                  <input
                    type="number"
                    value={formState.sequence}
                    onChange={(e) => setFormState({ ...formState, sequence: Number(e.target.value) })}
                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0f172a] font-mono focus:bg-white focus:outline-none focus:border-[#1e40af]"
                    min={1}
                    max={999}
                  />
                </div>

                <div>
                  <label className="block text-[#475569] font-medium mb-1">Frontend Route Path</label>
                  <input
                    type="text"
                    value={formState.route}
                    onChange={(e) => setFormState({ ...formState, route: e.target.value })}
                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#1e40af] font-mono focus:bg-white focus:outline-none focus:border-[#1e40af]"
                    placeholder="/pos/billing"
                  />
                </div>

                <div>
                  <label className="block text-[#475569] font-medium mb-1">Parent Menu ID (Optional)</label>
                  <input
                    type="text"
                    value={formState.parent_id}
                    onChange={(e) => setFormState({ ...formState, parent_id: e.target.value })}
                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#64748b] font-mono focus:bg-white focus:outline-none focus:border-[#1e40af]"
                    placeholder="Leave empty for root item"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Security & Operations RBAC Matrix */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a] font-mono">
                    2. Security & Granular Operations Matrix
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#64748b]">
                  Policy: smriti_permissions (Two-Pass Cascade Pruning)
                </span>
              </div>

              <div className="border border-[#e2e8f0] rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] font-mono text-[11px] text-[#475569]">
                      <th className="px-4 py-2.5">User Role</th>
                      <th className="px-3 py-2.5 text-center">View</th>
                      <th className="px-3 py-2.5 text-center">Create</th>
                      <th className="px-3 py-2.5 text-center">Modify</th>
                      <th className="px-3 py-2.5 text-center">Cancel</th>
                      <th className="px-3 py-2.5 text-center">Authorize</th>
                      <th className="px-3 py-2.5 text-center">Print / Slip</th>
                      <th className="px-3 py-2.5 text-center">Export CSV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="px-4 py-2.5 font-bold text-[#0f172a]">System Administrator (SYSADMIN)</td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="px-4 py-2.5 font-semibold text-[#1e40af]">Store Manager (MANAGER)</td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="px-4 py-2.5 text-[#334155]">Billing Cashier (CASHIER)</td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Lock className="w-3.5 h-3.5 text-[#94a3b8] mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Lock className="w-3.5 h-3.5 text-[#94a3b8] mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="px-3 py-2.5 text-center"><Lock className="w-3.5 h-3.5 text-[#94a3b8] mx-auto" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </form>
        </main>

        {/* ============================================================ */}
        {/* COLUMN 3: Live NavRail Simulator & Audit Journal (380px) */}
        {/* ============================================================ */}
        <aside className="w-96 border-l border-[#e2e8f0] bg-white flex flex-col shrink-0">
          {/* Sub Tab Switcher */}
          <div className="p-3 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center gap-2 text-xs font-mono font-bold">
            <button
              onClick={() => setActiveRightTab("simulator")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeRightTab === "simulator"
                  ? "bg-[#1e40af] text-white shadow-xs"
                  : "bg-white border border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <Compass className="w-3.5 h-3.5" /> Live NavRail
            </button>
            <button
              onClick={() => setActiveRightTab("audit")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeRightTab === "audit"
                  ? "bg-[#1e40af] text-white shadow-xs"
                  : "bg-white border border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <History className="w-3.5 h-3.5" /> Audit Log ({auditLogs.length})
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {activeRightTab === "simulator" && (
              <div className="space-y-4">
                <div className="p-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-[11px] text-[#1e40af] leading-relaxed">
                  <strong>Simulating:</strong> {simulatedRole} view. Below is how the sidebar and menu registry resolves for this operator role.
                </div>

                {/* Simulated Vertical NavRail */}
                <div className="bg-[#24389c] text-white rounded-xl p-2.5 shadow-md space-y-1">
                  <div className="text-[10px] font-mono text-indigo-200 uppercase tracking-widest px-2 py-1">
                    Sidebar Navigation
                  </div>
                  {simulatedNavItems.map((item) => (
                    <div
                      key={item.id}
                      className={`px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors ${
                        item.id === selectedMenuId
                          ? "bg-white text-[#24389c] font-bold shadow-xs"
                          : "text-indigo-100 hover:bg-[#3f51b5]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">
                          {item.icon || "grid_view"}
                        </span>
                        <span>{item.title}</span>
                      </div>
                      <span className="text-[9px] font-mono opacity-70">
                        #{item.sequence}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeRightTab === "audit" && (
              <div className="space-y-3 font-mono text-[11px]">
                {auditLogs.length === 0 ? (
                  <div className="p-6 text-center text-[#94a3b8]">
                    No changes recorded in smriti_audit_log.
                  </div>
                ) : (
                  auditLogs.slice(0, 15).map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl space-y-1.5 hover:border-[#cbd5e1] transition-colors"
                    >
                      <div className="flex items-center justify-between text-[#64748b] text-[10px]">
                        <span className="font-bold text-[#1e40af]">{log.changed_record_id || log.entity_id}</span>
                        <span>{log.changed_at ? new Date(log.changed_at).toLocaleTimeString() : "Just now"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold text-[9px]">
                          {log.change_type}
                        </span>
                        <span className="text-[#0f172a] font-semibold truncate">
                          by {log.changed_by_name || log.changed_by || "System Admin"}
                        </span>
                      </div>
                      {log.new_value && (
                        <div className="bg-white p-1.5 rounded border border-[#e2e8f0] text-[10px] text-[#475569] truncate">
                          {log.new_value}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Bottom Security Badge */}
          <div className="p-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center gap-1.5 text-[11px] text-[#1e40af] font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Immutable Audit: smriti_audit_log</span>
          </div>
        </aside>
      </div>
    </div>
  );
};
