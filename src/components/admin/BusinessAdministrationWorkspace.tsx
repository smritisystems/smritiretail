/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Business Administration Workspace (Company & Store Level)
 * Standard     : Level 2 Business Administration (FROZEN v1.4)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import {
  Building,
  Store,
  Users,
  Shield,
  FileCheck,
  Monitor,
  Settings,
  Plus,
  Search,
  UserPlus,
  Key,
  Clock
} from "lucide-react";
import { StaffManagementTab } from "../StaffManagementTab.tsx";

export type BusinessAdminTab = "store_settings" | "staff" | "terminals" | "approval_limits" | "store_audit";

export const BusinessAdministrationWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BusinessAdminTab>("staff");

  return (
    <div className="flex flex-col h-full bg-theme-bg text-theme-text overflow-hidden">
      {/* Header */}
      <div className="bg-theme-surface-1 border-b border-theme-divider p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-theme-text flex items-center gap-2">
                Business & Store Administration
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-medium">
                  Company & Store Level
                </span>
              </h1>
              <p className="text-xs text-theme-muted">
                Manage Store Settings, Staff Onboarding, POS Terminals, Store Devices & Local Approval Limits
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-theme-divider gap-2 pt-2">
          <button
            onClick={() => setActiveTab("staff")}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition ${
              activeTab === "staff"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-theme-muted hover:text-theme-text"
            }`}
          >
            <Users className="w-4 h-4" />
            Store Staff & Onboarding
          </button>

          <button
            onClick={() => setActiveTab("store_settings")}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition ${
              activeTab === "store_settings"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-theme-muted hover:text-theme-text"
            }`}
          >
            <Store className="w-4 h-4" />
            Store Profile & Tax Settings
          </button>

          <button
            onClick={() => setActiveTab("terminals")}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition ${
              activeTab === "terminals"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-theme-muted hover:text-theme-text"
            }`}
          >
            <Monitor className="w-4 h-4" />
            POS Terminals & Printers
          </button>

          <button
            onClick={() => setActiveTab("approval_limits")}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition ${
              activeTab === "approval_limits"
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-theme-muted hover:text-theme-text"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            Approval Thresholds
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "staff" && <StaffManagementTab />}

        {activeTab === "store_settings" && (
          <div className="bg-theme-surface-1 p-6 rounded-lg border border-theme-divider space-y-4 max-w-2xl">
            <h3 className="text-sm font-bold text-theme-text border-b border-theme-divider pb-2">Registered Main Store Profile</h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div><span className="text-theme-muted">Store Name:</span> <span className="text-theme-text font-bold">{typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_company_name") || "Main Store" : "Main Store"}</span></div>
              <div><span className="text-theme-muted">Store Code:</span> <span className="text-blue-400 font-bold">{typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_tenant_code") || "STORE01" : "STORE01"}</span></div>
              <div><span className="text-theme-muted">GSTIN:</span> <span className="text-emerald-400 font-bold">Registered Tax Profile</span></div>
              <div><span className="text-theme-muted">Address:</span> <span className="text-theme-text">{typeof localStorage !== 'undefined' ? `${localStorage.getItem("smriti_address_line1") || ""} ${localStorage.getItem("smriti_city") || ""} ${localStorage.getItem("smriti_state") || ""}`.trim() || "Registered Location" : "Registered Location"}</span></div>
            </div>
          </div>
        )}

        {activeTab === "terminals" && (
          <div className="bg-theme-surface-1 p-6 rounded-lg border border-theme-divider space-y-4">
            <h3 className="text-sm font-bold text-theme-text border-b border-theme-divider pb-2">Registered POS Terminals & Devices</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-theme-surface-2/60 rounded-lg border border-theme-divider">
                <div className="text-xs font-bold text-theme-text">POS Terminal 01 (Billing Counter 1)</div>
                <div className="text-[10px] font-mono text-emerald-400 mt-1">STATUS: ONLINE • Thermal Printer ESC/POS</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "approval_limits" && (
          <div className="bg-theme-surface-1 p-6 rounded-lg border border-theme-divider space-y-4">
            <h3 className="text-sm font-bold text-theme-text border-b border-theme-divider pb-2">Store Financial Approval Limits</h3>
            <div className="p-4 bg-theme-surface-2/60 rounded-lg border border-theme-divider font-mono text-xs space-y-2">
              <div><span className="text-theme-muted">Cashier Refund Limit:</span> <span className="text-amber-400 font-bold">₹2,000.00</span></div>
              <div><span className="text-theme-muted">Store Manager Refund Limit:</span> <span className="text-emerald-400 font-bold">₹50,000.00</span></div>
              <div><span className="text-theme-muted">Purchase Order Approval:</span> <span className="text-blue-400 font-bold">₹500,000.00</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
