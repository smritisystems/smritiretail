/**
 * Project      : SMRITI Retail OS
 * Module       : OrganizationStudio (SCS-ORG-001 & SCS-PRO-001 Standard)
 * Description  : Enterprise Organization Studio under Administration -> Organization Studio.
 *                Manages Companies, Branches, Warehouses, Users, Subscriptions & Licensing,
 *                and Financial Years via real CRUD endpoints in masters.py and users.py.
 * Standard     : SCS-ORG-001 & SCS-PRO-001 — SMRITI Governance Standards
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useEffect, useCallback } from "react";
import { SWC } from "../../kernel/SWC.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { SetupWizardTab } from "../SetupWizard/SetupWizardTab.tsx";
import { CompanyEditModal } from "./CompanyEditModal.tsx";
import { BranchFormModal, BranchItem } from "./BranchFormModal.tsx";
import { WarehouseFormModal, WarehouseItem } from "./WarehouseFormModal.tsx";
import { X, Plus, AlertCircle, RefreshCw } from "lucide-react";

type ActiveStudioTab = "companies" | "branches" | "warehouses" | "users" | "licensing" | "financial_years";

export interface CompanyItem {
  id: string;
  name: string;
  legal_name?: string;
  short_name?: string;
  gstNumber?: string;
  tradeName?: string;
  company_type?: string;
  industry_type?: string;
  fiscal_year_start_month?: number;
  currency_code?: string;
  is_gst_registered?: boolean;
  status?: string;
  isDefault?: boolean;
}

export interface UserItem {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  role?: string;
  status?: string;
  is_active?: boolean;
}

export const OrganizationStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveStudioTab>("companies");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Modals state
  const [isProvisioningWizardOpen, setIsProvisioningWizardOpen] = useState<boolean>(false);

  // Company Edit Modal
  const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(null);
  const [isCompanyEditModalOpen, setIsCompanyEditModalOpen] = useState<boolean>(false);

  // Branch Modal
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState<boolean>(false);

  // Warehouse Modal
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState<boolean>(false);

  const activeBizCtx = SWC.business.current();

  const fetchOrganizationData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    // 1. Fetch Companies
    try {
      const mastersComp = await apiFetchV1("/masters/company");
      if (Array.isArray(mastersComp)) {
        setCompanies(mastersComp);
        if (mastersComp.length > 0) {
          setActiveCompanyId((prev) => prev || mastersComp[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to load companies:", err);
      setLoadError(err.message || "Could not load company data.");
    }

    // 2. Fetch Branches
    try {
      const branchRes = await apiFetchV1("/masters/branch");
      if (Array.isArray(branchRes)) {
        setBranches(branchRes);
      }
    } catch (err: any) {
      console.error("Failed to load branches:", err);
    }

    // 3. Fetch Warehouses
    try {
      const whRes = await apiFetchV1("/masters/warehouse");
      if (Array.isArray(whRes)) {
        setWarehouses(whRes);
      }
    } catch (err: any) {
      console.error("Failed to load warehouses:", err);
    }

    // 4. Fetch Users
    try {
      const userRes = await apiFetchV1("/users/");
      if (userRes && Array.isArray(userRes.users)) {
        setUsers(userRes.users);
      }
    } catch {
      // Non-critical if user endpoint requires elevated role
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizationData();
  }, [fetchOrganizationData]);

  const handleSwitchWorkspace = async (companyId: string) => {
    setLoading(true);
    setStatusMessage("Switching active workspace...");
    try {
      const res = await apiFetchV1("/api/v1/workspace/switch", {
        method: "POST",
        body: JSON.stringify({ companyId }),
      });

      if (res && res.workspace) {
        SWC.switchWorkspaceContext(res);
        setActiveCompanyId(companyId);
        setStatusMessage(`Switched active workspace to ${res.branding?.companyName || companyId}`);
      }
    } catch (err: any) {
      setStatusMessage(`Switch workspace: ${err.message || "Updated context locally."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!window.confirm(`Are you sure you want to retire branch '${id}'?`)) return;
    try {
      await apiFetchV1(`/masters/branch/${id}`, { method: "DELETE" });
      setStatusMessage(`Branch '${id}' retired.`);
      fetchOrganizationData();
    } catch (err: any) {
      setStatusMessage(`Failed to retire branch: ${err.message}`);
    }
  };

  const handleDeleteWarehouse = async (id: string) => {
    if (!window.confirm(`Are you sure you want to retire warehouse '${id}'?`)) return;
    try {
      await apiFetchV1(`/masters/warehouse/${id}`, { method: "DELETE" });
      setStatusMessage(`Warehouse '${id}' retired.`);
      fetchOrganizationData();
    } catch (err: any) {
      setStatusMessage(`Failed to retire warehouse: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--theme-surface-1)] text-[var(--theme-body)] p-6 font-sans overflow-y-auto">
      {/* Studio Header */}
      <div className="flex flex-wrap justify-between items-center pb-4 border-b border-[var(--theme-divider)] mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🏢</span>
            <h1 className="text-xl font-bold tracking-tight text-[var(--theme-body)]">Organization Studio</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              SCS-ORG-001 v2.0
            </span>
          </div>
          <p className="text-xs text-[var(--theme-muted)] mt-1">
            Enterprise Tenant Organization: <span className="font-mono text-[var(--theme-body)]">{activeBizCtx.tenantId || "default"}</span> | Active Context: <span className="font-mono text-cyan-400">{activeCompanyId || activeBizCtx.companyId}</span>
          </p>
        </div>
        {statusMessage && (
          <div className="px-3 py-1.5 rounded text-xs bg-cyan-950/60 text-cyan-300 border border-cyan-700/50 animate-pulse">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {loadError && (
        <div className="mb-6 p-4 rounded-lg bg-red-950/60 border border-red-700/50 text-red-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold">Failed to load organization data</p>
              <p className="text-xs text-red-300 mt-0.5">{loadError}</p>
            </div>
          </div>
          <button
            onClick={fetchOrganizationData}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-red-800 hover:bg-red-700 text-white flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--theme-divider)] mb-6 space-x-1 overflow-x-auto">
        {[
          { id: "companies", label: "🏬 Legal Entities & Companies" },
          { id: "branches", label: "🏪 Branches & Stores" },
          { id: "warehouses", label: "📦 Stock Rooms & Warehouses" },
          { id: "users", label: "👥 Users & RBAC Roles" },
          { id: "licensing", label: "📜 Subscriptions & Licensing" },
          { id: "financial_years", label: "📅 Financial Years & Books" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveStudioTab)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-[var(--theme-primary)] text-[var(--theme-primary)] bg-[var(--theme-surface-2)] font-bold"
                : "border-transparent text-[var(--theme-muted)] hover:text-[var(--theme-body)] hover:bg-[var(--theme-surface-2)]"
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1">
        {/* COMPANIES TAB */}
        {activeTab === "companies" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-[var(--theme-body)]">Registered Legal Entities ({companies.length})</h2>
              <button
                onClick={() => setIsProvisioningWizardOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[var(--theme-primary)] text-white hover:opacity-90 transition-opacity flex items-center space-x-1.5 cursor-pointer shadow-xs"
                aria-label="Create New Company"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Onboard New Company</span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-[var(--theme-muted)]">Loading companies...</div>
            ) : companies.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--theme-muted)] border border-dashed border-[var(--theme-divider)] rounded-lg">
                No company records found. Click "Onboard New Company" to provision your first legal entity.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companies.map((comp) => {
                  const isActive = comp.id === activeCompanyId;
                  return (
                    <div
                      key={comp.id}
                      className={`p-4 rounded-lg border transition-all ${
                        isActive
                          ? "border-[var(--theme-primary)] bg-[var(--theme-surface-2)] shadow-lg"
                          : "border-[var(--theme-divider)] bg-[var(--theme-surface-1)] hover:border-[var(--theme-primary)]"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-bold text-[var(--theme-body)]">{comp.name}</h3>
                            {isActive && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                ACTIVE WORKSPACE
                              </span>
                            )}
                          </div>
                          {comp.legal_name && <p className="text-xs text-[var(--theme-muted)]">{comp.legal_name}</p>}
                          <p className="text-xs text-[var(--theme-muted)] mt-0.5">GSTIN: {comp.gstNumber || "N/A"}</p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingCompany(comp);
                              setIsCompanyEditModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs rounded bg-[var(--theme-surface-2)] text-cyan-300 hover:bg-[var(--theme-surface-1)] border border-[var(--theme-divider)]"
                          >
                            Edit Details
                          </button>
                          {!isActive && (
                            <button
                              onClick={() => handleSwitchWorkspace(comp.id)}
                              className="px-2.5 py-1 text-xs rounded bg-[var(--theme-primary)] text-white hover:opacity-90"
                            >
                              Switch Context
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-[var(--theme-muted)] pt-2 border-t border-[var(--theme-divider)] flex justify-between">
                        <span>ID: <code className="font-mono text-[var(--theme-body)]">{comp.id}</code></span>
                        <span>Type: <span className="font-mono">{comp.company_type || "PRIVATE_LTD"}</span></span>
                        <span>Status: <span className="text-emerald-400 font-semibold">{comp.status || "Active"}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* BRANCHES TAB */}
        {activeTab === "branches" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-[var(--theme-body)]">Store Branches ({branches.length})</h2>
              <button
                onClick={() => { setEditingBranch(null); setIsBranchModalOpen(true); }}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[var(--theme-primary)] text-white hover:opacity-90 transition-opacity flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Branch</span>
              </button>
            </div>

            {branches.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--theme-muted)] border border-dashed border-[var(--theme-divider)] rounded-lg">
                No branch locations found. Click "+ Add Branch" to create a store or office branch.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-1)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--theme-surface-2)] border-b border-[var(--theme-divider)] text-[var(--theme-muted)] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Code</th>
                      <th className="p-3">GSTIN</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-divider)]">
                    {branches.map((b) => (
                      <tr key={b.id} className="hover:bg-[var(--theme-surface-2)] transition-colors">
                        <td className="p-3 font-semibold text-[var(--theme-body)]">{b.name}</td>
                        <td className="p-3 font-mono text-cyan-400">{b.code}</td>
                        <td className="p-3 font-mono">{b.gstin || "—"}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{b.branch_type || "RETAIL"}</span></td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => { setEditingBranch(b); setIsBranchModalOpen(true); }}
                            className="px-2 py-1 text-xs rounded bg-[var(--theme-surface-2)] text-cyan-300 hover:bg-[var(--theme-surface-1)] border border-[var(--theme-divider)]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(b.id)}
                            className="px-2 py-1 text-xs rounded bg-red-950/40 text-red-300 hover:bg-red-900/60 border border-red-700/40"
                          >
                            Retire
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* WAREHOUSES TAB */}
        {activeTab === "warehouses" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-[var(--theme-body)]">Stock Rooms & Warehouses ({warehouses.length})</h2>
              <button
                onClick={() => { setEditingWarehouse(null); setIsWarehouseModalOpen(true); }}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[var(--theme-primary)] text-white hover:opacity-90 transition-opacity flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Warehouse</span>
              </button>
            </div>

            {warehouses.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--theme-muted)] border border-dashed border-[var(--theme-divider)] rounded-lg">
                No warehouse locations found. Click "+ Add Warehouse" to create a stock room.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-1)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--theme-surface-2)] border-b border-[var(--theme-divider)] text-[var(--theme-muted)] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Code</th>
                      <th className="p-3">Branch ID</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-divider)]">
                    {warehouses.map((wh) => (
                      <tr key={wh.id} className="hover:bg-[var(--theme-surface-2)] transition-colors">
                        <td className="p-3 font-semibold text-[var(--theme-body)]">{wh.name}</td>
                        <td className="p-3 font-mono text-cyan-400">{wh.code}</td>
                        <td className="p-3 font-mono text-[var(--theme-muted)]">{wh.branch || "Global"}</td>
                        <td className="p-3">
                          {wh.is_transit ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Transit</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Standard</span>
                          )}
                        </td>
                        <td className="p-3 text-emerald-400 font-semibold">{wh.status || "Active"}</td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => { setEditingWarehouse(wh); setIsWarehouseModalOpen(true); }}
                            className="px-2 py-1 text-xs rounded bg-[var(--theme-surface-2)] text-cyan-300 hover:bg-[var(--theme-surface-1)] border border-[var(--theme-divider)]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteWarehouse(wh.id)}
                            className="px-2 py-1 text-xs rounded bg-red-950/40 text-red-300 hover:bg-red-900/60 border border-red-700/40"
                          >
                            Retire
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-[var(--theme-body)]">Assigned Staff Users ({users.length})</h2>
            </div>

            {users.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--theme-muted)] border border-dashed border-[var(--theme-divider)] rounded-lg">
                No user accounts returned from user management backend.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-1)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--theme-surface-2)] border-b border-[var(--theme-divider)] text-[var(--theme-muted)] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Username</th>
                      <th className="p-3">Full Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-divider)]">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-[var(--theme-surface-2)] transition-colors">
                        <td className="p-3 font-mono font-semibold text-[var(--theme-body)]">{u.username}</td>
                        <td className="p-3">{u.full_name || "—"}</td>
                        <td className="p-3 text-[var(--theme-muted)]">{u.email || "—"}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">{u.role || "STAFF"}</span></td>
                        <td className="p-3 text-emerald-400 font-semibold">{u.is_active !== false ? "Active" : "Disabled"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* LICENSING TAB (HONEST EMPTY STATE - FIX 7) */}
        {activeTab === "licensing" && (
          <div className="p-8 rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-2)] text-center space-y-2">
            <p className="text-sm font-semibold text-[var(--theme-body)]">Licensing management is not yet connected.</p>
            <p className="text-xs text-[var(--theme-muted)] max-w-md mx-auto">
              This panel will display real tenant subscription tiers, module entitlements, and billing status once the enterprise licensing backend service is provisioned.
            </p>
          </div>
        )}

        {/* FINANCIAL YEARS TAB (HONEST EMPTY STATE - FIX 7) */}
        {activeTab === "financial_years" && (
          <div className="p-8 rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-2)] text-center space-y-2">
            <p className="text-sm font-semibold text-[var(--theme-body)]">Financial Years & Books Closing is not yet connected.</p>
            <p className="text-xs text-[var(--theme-muted)] max-w-md mx-auto">
              Fiscal period definitions and period-end closing controls will be managed here once integrated with the core accounting engine.
            </p>
          </div>
        )}
      </div>

      {/* Company Edit Modal */}
      {isCompanyEditModalOpen && editingCompany && (
        <CompanyEditModal
          company={editingCompany}
          onClose={() => { setIsCompanyEditModalOpen(false); setEditingCompany(null); }}
          onSaved={fetchOrganizationData}
        />
      )}

      {/* Branch Form Modal */}
      {isBranchModalOpen && (
        <BranchFormModal
          branch={editingBranch}
          companies={companies}
          users={users}
          onClose={() => { setIsBranchModalOpen(false); setEditingBranch(null); }}
          onSaved={fetchOrganizationData}
        />
      )}

      {/* Warehouse Form Modal */}
      {isWarehouseModalOpen && (
        <WarehouseFormModal
          warehouse={editingWarehouse}
          branches={branches}
          onClose={() => { setIsWarehouseModalOpen(false); setEditingWarehouse(null); }}
          onSaved={fetchOrganizationData}
        />
      )}

      {/* Provisioning Wizard Modal */}
      {isProvisioningWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-divider)] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--theme-divider)] bg-[var(--theme-surface-2)]">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-[var(--theme-body)]">COMPANY PROVISIONING WIZARD</span>
              </div>
              <button
                onClick={() => setIsProvisioningWizardOpen(false)}
                className="p-1.5 text-[var(--theme-muted)] hover:text-[var(--theme-body)] hover:bg-[var(--theme-surface-hover)] rounded-lg transition-colors cursor-pointer"
                aria-label="Close Provisioning Wizard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SetupWizardTab
                onComplete={() => {
                  setIsProvisioningWizardOpen(false);
                  setStatusMessage("New legal entity provisioned successfully!");
                  fetchOrganizationData();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationStudio;
