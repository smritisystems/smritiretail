/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.45.2
 * Created      : 2026-09-26
 * Modified     : 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Security & Access Management — Data Access Control View
 */

import React, { useState, useEffect } from "react";
import { RotateCcw, Pencil, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  getHousekeepingSecurityConfig,
  syncSecurityConfiguration,
  persistSecurityConfiguration,
  getPasswordSecurityConfig,
} from "../../services/securityStore.ts";

interface DataRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface Notification {
  type: "success" | "error" | "warning";
  message: string;
}

interface DataAccessViewProps {
  onNotification?: (n: Notification) => void;
}

export const DataAccessView: React.FC<DataAccessViewProps> = ({ onNotification }) => {
  const [rules, setRules] = useState<DataRule[]>([
    {
      id: "hideCostPrice",
      label: "Hide Cost Price in Reports",
      description: "Hide purchase cost / cost price information in reports for restricted users.",
      enabled: true,
    },
    {
      id: "restrictProductsInReports",
      label: "Restrict users from accessing Products / Brands in Reports",
      description: "Restrict users from viewing product and brand related data in reports.",
      enabled: false,
    },
    {
      id: "restrictDashboardReports",
      label: "Restrict users from selecting Dashboard Reports",
      description: "Restrict users from accessing or selecting dashboard reports.",
      enabled: true,
    },
  ]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Sync rules with backend housekeeping config on mount
    syncSecurityConfiguration().then(({ housekeepingConfig: hk }) => {
      setRules(prev => prev.map(r => {
        if (r.id === "hideCostPrice") return { ...r, enabled: (hk as any).hideCostPriceInReports !== undefined ? !!(hk as any).hideCostPriceInReports : r.enabled };
        if (r.id === "restrictProductsInReports") return { ...r, enabled: (hk as any).restrictProductsInReports !== undefined ? !!(hk as any).restrictProductsInReports : r.enabled };
        if (r.id === "restrictDashboardReports") return { ...r, enabled: (hk as any).restrictDashboardReports !== undefined ? !!(hk as any).restrictDashboardReports : r.enabled };
        return r;
      }));
    }).catch(() => {}); // Graceful degradation — local defaults remain
  }, []);

  const toggle = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const passConfig = getPasswordSecurityConfig();
      const hkConfig = {
        ...getHousekeepingSecurityConfig(),
        hideCostPriceInReports: rules.find(r => r.id === "hideCostPrice")?.enabled ?? true,
        restrictProductsInReports: rules.find(r => r.id === "restrictProductsInReports")?.enabled ?? false,
        restrictDashboardReports: rules.find(r => r.id === "restrictDashboardReports")?.enabled ?? true,
      };
      const ok = await persistSecurityConfiguration(passConfig, hkConfig);
      const msg = ok ? "Data access rules saved successfully." : "Saved locally; backend sync pending.";
      setNotification({ type: "success", text: msg });
      if (onNotification) onNotification({ type: "success", message: msg });
      setDirty(false);
    } catch {
      const msg = "Failed to save data access rules.";
      setNotification({ type: "error", text: msg });
      if (onNotification) onNotification({ type: "error", message: msg });
    } finally {
      setSaving(false);
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const handleReset = () => {
    if (!window.confirm("Reset all data access rules to default values? This cannot be undone.")) return;
    setRules(prev => prev.map(r => ({
      ...r,
      enabled: r.id === "hideCostPrice" || r.id === "restrictDashboardReports",
    })));
    setDirty(true);
    setNotification({ type: "success", text: "Rules reset to default values." });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full p-6 space-y-5">

        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a] font-display">Data Access Control</h2>
            <p className="text-xs text-[#64748b] mt-0.5">Set data level restrictions for reports, products, brands and dashboards</p>
          </div>
          <button type="button" onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#cbd5e1] bg-white text-[#475569] rounded-xl hover:bg-[#f8fafc] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
            <RotateCcw size={13} /> Reset to Default
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-xs text-[#1e40af]">
          <Info size={14} className="shrink-0" />
          <span>These settings control what data users can view or access in reports and dashboards.</span>
        </div>

        {/* Notification */}
        {notification && (
          <div className={"flex items-center gap-2 px-4 py-3 rounded-xl text-xs border " + (notification.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800")}>
            {notification.type === "success" ? <CheckCircle2 size={14} className="shrink-0 text-emerald-600" /> : <AlertTriangle size={14} className="shrink-0 text-rose-600" />}
            {notification.text}
          </div>
        )}

        {/* Rules table */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <th className="px-5 py-3 text-left font-bold text-[#475569] uppercase text-[11px] tracking-wide">Particulars</th>
                <th className="px-5 py-3 text-left font-bold text-[#475569] uppercase text-[11px] tracking-wide">Description</th>
                <th className="px-5 py-3 text-center font-bold text-[#475569] uppercase text-[11px] tracking-wide">Status</th>
                <th className="px-5 py-3 text-center font-bold text-[#475569] uppercase text-[11px] tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-4 font-bold text-[#0f172a] w-56 align-top">{rule.label}</td>
                  <td className="px-5 py-4 text-[#64748b] leading-relaxed align-top">{rule.description}</td>
                  <td className="px-5 py-4 text-center align-middle">
                    <div className="flex items-center justify-center gap-2">
                      {/* Toggle switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.enabled}
                        aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.label}`}
                        onClick={() => toggle(rule.id)}
                        className={"relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] cursor-pointer " + (rule.enabled ? "bg-[#2563eb] border-[#2563eb]" : "bg-[#cbd5e1] border-[#cbd5e1]")}
                      >
                        <span className={"pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 " + (rule.enabled ? "translate-x-5 ml-0.5" : "translate-x-0 ml-0.5")} />
                      </button>
                      <span className={"text-[11px] font-bold min-w-[44px] " + (rule.enabled ? "text-[#2563eb]" : "text-[#94a3b8]")}>
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center align-middle">
                    <button type="button"
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold border border-[#cbd5e1] bg-white text-[#475569] rounded-lg hover:bg-[#f8fafc] transition mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                      <Pencil size={11} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Save bar */}
        {dirty && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setDirty(false); }}
              className="px-4 py-2 text-xs font-semibold border border-[#cbd5e1] rounded-xl text-[#475569] hover:bg-[#f8fafc] transition">
              Discard Changes
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving}
              className="px-5 py-2 text-xs font-bold bg-[#1e40af] hover:bg-[#1d4ed8] text-white rounded-xl transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default DataAccessView;
