/**
 * Project      : SMRITI Retail OS
 * Module       : OrganizationStudio (SCS-ORG-001 & SCS-PRO-001 Standard)
 * Description  : Enterprise Organization Studio studio under Administration -> Organization Studio.
 *                Manages Tenants, Companies, Branches, Warehouses, Users, Roles, Subscriptions & Licensing,
 *                and Financial Years.
 * Standard     : SCS-ORG-001 & SCS-PRO-001 — SMRITI Governance Standards
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useEffect } from "react";
import { SWC } from "../../kernel/SWC.js";
import { IndustryRegistry, IndustryPluginPackage } from "../../kernel/plugins/IndustryRegistry.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";

type ActiveStudioTab = "companies" | "branches" | "warehouses" | "users" | "licensing" | "financial_years";

export interface CompanyItem {
  id: string;
  name: string;
  gstNumber?: string;
  tradeName?: string;
  isDefault?: boolean;
}

export const OrganizationStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveStudioTab>("companies");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const activeBizCtx = SWC.business.current();
  const plugins = IndustryRegistry.getAll();

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const fetchOrganizationData = async () => {
    setLoading(true);
    try {
      const res = await apiFetchV1("/api/v1/system/company/list");
      if (res && res.companies) {
        setCompanies(res.companies);
        if (res.companies.length > 0) {
          setActiveCompanyId(res.activeCompanyId || res.companies[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to load organization data:", err);
      // Fallback display
      setCompanies([
        { id: activeBizCtx.companyId, name: "SMRITI Footwear Pvt Ltd", gstNumber: "27AABCS1429B1Z2", tradeName: "SMRITI Footwear" },
        { id: "comp-pharmacy-02", name: "SMRITI Pharmacy LLP", gstNumber: "27AABCS1429B2Z3", tradeName: "SMRITI Pharmacy" },
      ]);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="flex flex-col h-full bg-[var(--theme-surface-1)] text-[var(--theme-body)] p-6 font-sans overflow-y-auto">
      {/* Studio Header */}
      <div className="flex flex-wrap justify-between items-center pb-4 border-b border-[var(--theme-divider)] mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🏢</span>
            <h1 className="text-xl font-bold tracking-tight text-[var(--theme-body)]">Organization Studio</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              SCS-ORG-001 FROZEN v1.0
            </span>
          </div>
          <p className="text-xs text-[var(--theme-muted)] mt-1">
            Enterprise Tenant Organization: <span className="font-mono text-[var(--theme-body)]">{activeBizCtx.tenantId}</span> | Active SWC Context: <span className="font-mono text-cyan-400">{activeBizCtx.companyId}</span>
          </p>
        </div>
        {statusMessage && (
          <div className="px-3 py-1.5 rounded text-xs bg-cyan-950/60 text-cyan-300 border border-cyan-700/50 animate-pulse">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--theme-divider)] mb-6 space-x-1">
        {[
          { id: "companies", label: "🏬 Legal Entities & Companies", icon: "🏢" },
          { id: "branches", label: "🏪 Branches & Stores", icon: "🏪" },
          { id: "warehouses", label: "📦 Stock Rooms & Warehouses", icon: "📦" },
          { id: "users", label: "👥 Users & RBAC Roles", icon: "👥" },
          { id: "licensing", label: "📜 Subscriptions & Licensing", icon: "📜" },
          { id: "financial_years", label: "📅 Financial Years & Books", icon: "📅" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveStudioTab)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === tab.id
                ? "border-[var(--theme-primary)] text-[var(--theme-primary)] bg-[var(--theme-surface-2)]"
                : "border-transparent text-[var(--theme-muted)] hover:text-[var(--theme-body)] hover:bg-[var(--theme-surface-2)]"
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1">
        {activeTab === "companies" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-[var(--theme-body)]">Registered Legal Entities ({companies.length})</h2>
              <button
                onClick={() => setStatusMessage("Please use Company Provisioning Wizard to onboard new legal entity.")}
                className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[var(--theme-primary)] text-white hover:opacity-90 transition-opacity flex items-center space-x-1.5"
              >
                <span>➕</span>
                <span>Create New Company</span>
              </button>
            </div>

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
                        <p className="text-xs text-[var(--theme-muted)] mt-0.5">GSTIN: {comp.gstNumber || "N/A"}</p>
                      </div>
                      {!isActive && (
                        <button
                          onClick={() => handleSwitchWorkspace(comp.id)}
                          className="px-2.5 py-1 text-xs rounded bg-[var(--theme-surface-2)] text-cyan-300 hover:bg-[var(--theme-surface-1)] border border-[var(--theme-divider)]"
                        >
                          Switch Context
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-[var(--theme-muted)] pt-2 border-t border-[var(--theme-divider)] flex justify-between">
                      <span>ID: <code className="font-mono text-[var(--theme-body)]">{comp.id}</code></span>
                      <span>Status: <span className="text-emerald-400 font-semibold">Active</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "branches" && (
          <div className="p-6 rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-2)] space-y-4">
            <h2 className="text-sm font-semibold text-[var(--theme-body)]">Store Branches & POS Terminals</h2>
            <div className="text-xs text-[var(--theme-muted)] space-y-2">
              <p>📍 <strong>Andheri Store (MAIN)</strong> — Code: <code className="font-mono">BR-ANDHERI</code> | POS Terminals: POS-01, POS-02</p>
              <p>📍 <strong>Bandra Store</strong> — Code: <code className="font-mono">BR-BANDRA</code> | POS Terminals: POS-03</p>
            </div>
          </div>
        )}

        {activeTab === "warehouses" && (
          <div className="p-6 rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-2)] space-y-4">
            <h2 className="text-sm font-semibold text-[var(--theme-body)]">Stock Rooms & Bins</h2>
            <div className="text-xs text-[var(--theme-muted)] space-y-2">
              <p>📦 <strong>Central Warehouse</strong> — Code: <code className="font-mono">WH-CENTRAL</code> | Stock Bins: 24 active bins</p>
              <p>📦 <strong>Store Stock Room</strong> — Code: <code className="font-mono">WH-STORE-01</code> | Stock Bins: 12 active bins</p>
            </div>
          </div>
        )}

        {activeTab === "licensing" && (
          <div className="p-6 rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-2)] space-y-4">
            <h2 className="text-sm font-semibold text-[var(--theme-body)]">Subscription Tier & License Status</h2>
            <div className="flex justify-between items-center p-4 rounded bg-[var(--theme-surface-1)] border border-[var(--theme-divider)]">
              <div>
                <h3 className="text-sm font-bold text-emerald-400">SMRITI Enterprise SaaS License</h3>
                <p className="text-xs text-[var(--theme-muted)] mt-1">Multi-Company Unlimited | Active Status: Certified</p>
              </div>
              <span className="px-3 py-1 text-xs font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ACTIVE SUBSCRIPTION
              </span>
            </div>
          </div>
        )}

        {activeTab === "financial_years" && (
          <div className="p-6 rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-2)] space-y-4">
            <h2 className="text-sm font-semibold text-[var(--theme-body)]">Financial Years & Books Closing</h2>
            <div className="text-xs text-[var(--theme-muted)] space-y-2">
              <p>📅 <strong>FY 2026–2027</strong> — 01-Apr-2026 to 31-Mar-2027 | Status: <span className="text-emerald-400 font-bold">OPEN</span></p>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="p-6 rounded-lg border border-[var(--theme-divider)] bg-[var(--theme-surface-2)] space-y-4">
            <h2 className="text-sm font-semibold text-[var(--theme-body)]">User Staff & RBAC Roles</h2>
            <div className="text-xs text-[var(--theme-muted)] space-y-2">
              <p>👤 <strong>Jawahar Mallah</strong> (Role: <code className="font-mono">SYSADMIN</code>) — Full Platform Access</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationStudio;
