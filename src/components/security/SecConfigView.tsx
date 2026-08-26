/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.17.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Security Management — Configuration View (Modern Light Theme)
 */

import React, { useState } from "react";
import {
  PasswordSecurityConfig,
  HousekeepingSecurityConfig,
} from "./types.ts";
import {
  getPasswordSecurityConfig,
  savePasswordSecurityConfig,
  getHousekeepingSecurityConfig,
  saveHousekeepingSecurityConfig,
  syncSecurityConfiguration,
  persistSecurityConfiguration,
} from "../../services/securityStore.ts";
import { KeyRound, ShieldAlert, Save, RotateCcw, CheckCircle2, Sliders } from "lucide-react";

interface SmritiSecurityConfigurationViewProps {
  onClose: () => void;
}

export const SecConfigView: React.FC<SmritiSecurityConfigurationViewProps> = ({
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<"Password" | "Housekeeping">("Password");
  const [passConfig, setPassConfig] = useState<PasswordSecurityConfig>(() => getPasswordSecurityConfig());
  const [hkConfig, setHkConfig] = useState<HousekeepingSecurityConfig>(() => getHousekeepingSecurityConfig());
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  React.useEffect(() => {
    syncSecurityConfiguration().then(({ passwordConfig, housekeepingConfig }) => {
      setPassConfig(passwordConfig);
      setHkConfig(housekeepingConfig);
    });
  }, []);

  const handleSave = async () => {
    const persisted = await persistSecurityConfiguration(passConfig, hkConfig);
    setSaveFeedback(persisted
      ? "Security configuration saved and applied across cluster."
      : "Configuration saved locally; backend persistence failed.");
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleCancel = () => {
    setPassConfig(getPasswordSecurityConfig());
    setHkConfig(getHousekeepingSecurityConfig());
    setSaveFeedback("Configuration reverted to saved values.");
    setTimeout(() => setSaveFeedback(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] text-[#0f172a] text-xs font-sans select-none overflow-hidden">
      {/* 2-Pane Content Area */}
      <div className="flex-1 flex min-h-0 p-4 gap-4 overflow-hidden">
        {/* Left Category Selector */}
        <div className="w-56 bg-white border border-[#e2e8f0] rounded-xl p-3 shadow-xs flex flex-col shrink-0">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748b] pb-2 border-b border-[#f1f5f9] mb-2 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#1e40af]" />
            <span>Policy Domains</span>
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveCategory("Password")}
              className={`w-full text-left px-3 py-2.5 rounded-lg cursor-pointer transition-all flex items-center gap-2.5 text-xs ${
                activeCategory === "Password"
                  ? "bg-[#eff6ff] text-[#1e40af] font-bold border border-[#bfdbfe] shadow-xs"
                  : "text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]"
              }`}
            >
              <KeyRound className="w-4 h-4 text-[#1e40af]" />
              <span>Password Security</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("Housekeeping")}
              className={`w-full text-left px-3 py-2.5 rounded-lg cursor-pointer transition-all flex items-center gap-2.5 text-xs ${
                activeCategory === "Housekeeping"
                  ? "bg-[#eff6ff] text-[#1e40af] font-bold border border-[#bfdbfe] shadow-xs"
                  : "text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]"
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Housekeeping Policies</span>
            </button>
          </div>
        </div>

        {/* Right Settings Form */}
        <div className="flex-1 bg-white border border-[#e2e8f0] rounded-xl shadow-xs flex flex-col overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0f172a] font-display">
                {activeCategory === "Password" ? "Password Security Parameters" : "System Housekeeping & Governance"}
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                {activeCategory === "Password"
                  ? "Enforce credential complexity, history retention, and lockout policies for all cashier and supervisory accounts."
                  : "Configure automated log retention windows, company isolation rules, and menu caching intervals."}
              </p>
            </div>
            {saveFeedback && (
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-3 py-1 border border-emerald-200 rounded-lg animate-fade-in text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{saveFeedback}</span>
              </div>
            )}
          </div>

          {/* Settings Table Grid */}
          <div className="border border-[#e2e8f0] rounded-xl overflow-hidden text-xs">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] font-mono text-[11px] text-[#475569]">
                  <th className="p-3 font-bold w-1/2">Policy Parameter Description</th>
                  <th className="p-3 font-bold w-1/4">Configured Value</th>
                  <th className="p-3 font-bold w-1/4">Security Guarantee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {activeCategory === "Password" && (
                  <>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Maximum Password Length</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={passConfig.maxPasswordLength}
                          onChange={(e) => setPassConfig({ ...passConfig, maxPasswordLength: Number(e.target.value) })}
                          className="w-24 px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#0f172a] focus:bg-white focus:outline-none focus:border-[#1e40af]"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-[#64748b]">Max characters allowed in password</td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Minimum Password Length</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={passConfig.minPasswordLength}
                          onChange={(e) => setPassConfig({ ...passConfig, minPasswordLength: Number(e.target.value) })}
                          className="w-24 px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#0f172a] focus:bg-white focus:outline-none focus:border-[#1e40af]"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-[#64748b]">Entropy threshold (Recommended: &gt;= 8)</td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Minimum Uppercase Characters</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={passConfig.minUppercase}
                          onChange={(e) => setPassConfig({ ...passConfig, minUppercase: Number(e.target.value) })}
                          className="w-24 px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#0f172a] focus:bg-white focus:outline-none focus:border-[#1e40af]"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-[#64748b]">Enforces uppercase character count</td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Minimum Lowercase Characters</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={passConfig.minLowercase}
                          onChange={(e) => setPassConfig({ ...passConfig, minLowercase: Number(e.target.value) })}
                          className="w-24 px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#0f172a] focus:bg-white focus:outline-none focus:border-[#1e40af]"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-[#64748b]">Enforces lowercase character count</td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Minimum Numeric Characters</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={passConfig.minNumeric}
                          onChange={(e) => setPassConfig({ ...passConfig, minNumeric: Number(e.target.value) })}
                          className="w-24 px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#0f172a] focus:bg-white focus:outline-none focus:border-[#1e40af]"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-[#64748b]">Enforces digits 0-9 requirement</td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Passwords History Retained</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={passConfig.passwordsToRemember}
                          onChange={(e) => setPassConfig({ ...passConfig, passwordsToRemember: Number(e.target.value) })}
                          className="w-24 px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#0f172a] focus:bg-white focus:outline-none focus:border-[#1e40af]"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-[#64748b]">Prevents reusing last N passwords</td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Maximum Invalid Attempts Before Lockout</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={passConfig.maxInvalidAttempts}
                          onChange={(e) => setPassConfig({ ...passConfig, maxInvalidAttempts: Number(e.target.value) })}
                          className="w-24 px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-rose-700 focus:bg-white focus:outline-none focus:border-[#1e40af]"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-rose-600 font-bold">Auto-locks operator on N failed attempts</td>
                    </tr>
                  </>
                )}

                {activeCategory === "Housekeeping" && (
                  <>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Days to Retain Activity Log</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={hkConfig.daysToRetainActivityLog}
                          onChange={(e) => setHkConfig({ ...hkConfig, daysToRetainActivityLog: Number(e.target.value) })}
                          className="w-24 px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#0f172a] focus:bg-white focus:outline-none focus:border-[#1e40af]"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-[#64748b]">Rolling retention before archiving</td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Country / Region Code</td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={hkConfig.countryCode}
                          onChange={(e) => setHkConfig({ ...hkConfig, countryCode: e.target.value })}
                          className="w-24 px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#0f172a] focus:bg-white focus:outline-none focus:border-[#1e40af]"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-[#64748b]">Tax & currency jurisdiction formatting</td>
                    </tr>
                    <tr className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-medium text-[#0f172a]">Enforce Company-Wise Access Restrictions</td>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={hkConfig.activateCompanyWiseRestrictions}
                          onChange={(e) => setHkConfig({ ...hkConfig, activateCompanyWiseRestrictions: e.target.checked })}
                          className="w-4 h-4 rounded text-[#1e40af] focus:ring-[#1e40af] cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-[#64748b]">Multi-tenant isolation barrier</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-white border-t border-[#e2e8f0] flex items-center justify-end gap-2 shrink-0">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 bg-white hover:bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1] rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Revert
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2 bg-[#1e40af] hover:bg-[#1d4ed8] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-98"
        >
          <Save className="w-3.5 h-3.5" /> Save Configuration
        </button>
      </div>
    </div>
  );
};
