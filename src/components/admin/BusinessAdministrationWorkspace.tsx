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
  Clock,
  Edit3,
  Save,
  CheckCircle
} from "lucide-react";
import { StaffManagementTab } from "../StaffManagementTab.tsx";

export type BusinessAdminTab = "store_settings" | "staff" | "terminals" | "approval_limits" | "store_audit";

export const BusinessAdministrationWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BusinessAdminTab>("staff");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [companyName, setCompanyName] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_company_name") || "Main Store" : "Main Store"
  );
  const [tenantCode, setTenantCode] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_tenant_code") || "STORE01" : "STORE01"
  );
  const [addressLine1, setAddressLine1] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_address_line1") || "" : ""
  );
  const [city, setCity] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_city") || "" : ""
  );
  const [stateName, setStateName] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_state") || "" : ""
  );
  const [pinCode, setPinCode] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_pincode") || "" : ""
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem("smriti_company_name", companyName);
      localStorage.setItem("smriti_tenant_code", tenantCode);
      localStorage.setItem("smriti_address_line1", addressLine1);
      localStorage.setItem("smriti_city", city);
      localStorage.setItem("smriti_state", stateName);
      localStorage.setItem("smriti_pincode", pinCode);
    }
    setSavedSuccess(true);
    setIsEditingProfile(false);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

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
          <div className="bg-theme-surface-1 p-6 rounded-xl border border-theme-divider space-y-6 max-w-2xl shadow-lg">
            <div className="flex items-center justify-between border-b border-theme-divider pb-3">
              <div>
                <h3 className="text-base font-bold text-theme-text">Registered Company &amp; Store Profile</h3>
                <p className="text-xs text-theme-muted mt-0.5">View and update your official business registration, store name, and location details.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow"
              >
                <Edit3 size={14} />
                <span>{isEditingProfile ? "Cancel Editing" : "Edit Profile"}</span>
              </button>
            </div>

            {savedSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle size={16} />
                <span>Company profile updated successfully!</span>
              </div>
            )}

            {isEditingProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Company / Store Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-text focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Store / Tenant Code</label>
                    <input
                      type="text"
                      value={tenantCode}
                      onChange={e => setTenantCode(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono text-theme-text focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Street Address</label>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={e => setAddressLine1(e.target.value)}
                    placeholder="e.g. Shop No 4, Main Road"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-text focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">City / Town</label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-text focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">State</label>
                    <input
                      type="text"
                      value={stateName}
                      onChange={e => setStateName(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-text focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">PIN Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={pinCode}
                      onChange={e => setPinCode(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono text-theme-text focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow"
                  >
                    <Save size={14} />
                    <span>Save Company Changes</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div><span className="text-theme-muted">Company Name:</span> <span className="text-theme-text font-bold">{companyName || "Not specified"}</span></div>
                <div><span className="text-theme-muted">Store Code:</span> <span className="text-blue-400 font-bold">{tenantCode || "Not specified"}</span></div>
                <div><span className="text-theme-muted">Street Address:</span> <span className="text-theme-text">{addressLine1 || "Not specified"}</span></div>
                <div><span className="text-theme-muted">City / Town:</span> <span className="text-theme-text">{city || "Not specified"}</span></div>
                <div><span className="text-theme-muted">State:</span> <span className="text-theme-text">{stateName || "Not specified"}</span></div>
                <div><span className="text-theme-muted">PIN Code:</span> <span className="text-theme-text">{pinCode || "Not specified"}</span></div>
              </div>
            )}
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
