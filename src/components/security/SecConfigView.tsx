/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Security Management — Configuration View
 */

import React, { useState } from "react";
import {
  PasswordSecurityConfig,
  HousekeepingSecurityConfig,
} from "./types";
import {
  getPasswordSecurityConfig,
  savePasswordSecurityConfig,
  getHousekeepingSecurityConfig,
  saveHousekeepingSecurityConfig,
} from "../../services/securityStore";

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

  const handleSave = () => {
    savePasswordSecurityConfig(passConfig);
    saveHousekeepingSecurityConfig(hkConfig);
    setSaveFeedback("Security configuration saved successfully.");
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleCancel = () => {
    setPassConfig(getPasswordSecurityConfig());
    setHkConfig(getHousekeepingSecurityConfig());
    setSaveFeedback("Configuration changes reverted.");
    setTimeout(() => setSaveFeedback(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f0f0] text-[#000000] text-xs font-sans select-none border border-[#808080]">
      {/* 2-Pane Content Area */}
      <div className="flex-1 flex min-h-0 p-2 gap-2">
        {/* Left Category List */}
        <div className="w-48 bg-white border border-[#7f9db9] shadow-inner flex flex-col">
          <div className="bg-[#ece9d8] p-1.5 font-bold border-b border-[#a0a0a0] text-[11px]">
            Category
          </div>
          <div className="p-1 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setActiveCategory("Password")}
              className={`text-left px-2 py-1 cursor-pointer border ${
                activeCategory === "Password"
                  ? "bg-[#3366cc] text-white font-bold border-[#003399]"
                  : "hover:bg-slate-100 border-transparent text-[#000]"
              }`}
            >
              Password Configuration
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("Housekeeping")}
              className={`text-left px-2 py-1 cursor-pointer border ${
                activeCategory === "Housekeeping"
                  ? "bg-[#3366cc] text-white font-bold border-[#003399]"
                  : "hover:bg-slate-100 border-transparent text-[#000]"
              }`}
            >
              Housekeeping
            </button>
          </div>
        </div>

        {/* Right Settings Table */}
        <div className="flex-1 bg-white border border-[#7f9db9] shadow-inner flex flex-col overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#ece9d8] border-b border-[#a0a0a0] sticky top-0 z-10 text-[11px]">
                <th className="p-1.5 border-r border-[#d4d0c8] font-bold w-1/2">
                  Description
                </th>
                <th className="p-1.5 border-r border-[#d4d0c8] font-bold w-1/4">
                  Value
                </th>
                <th className="p-1.5 font-bold w-1/4">
                  Attributes
                </th>
              </tr>
            </thead>
            <tbody>
              {activeCategory === "Password" && (
                <>
                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Maximum password length</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={passConfig.maxPasswordLength}
                        onChange={(e) => setPassConfig({ ...passConfig, maxPasswordLength: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Minimum password length</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={passConfig.minPasswordLength}
                        onChange={(e) => setPassConfig({ ...passConfig, minPasswordLength: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Minimum upper case characters required in password</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={passConfig.minUppercase}
                        onChange={(e) => setPassConfig({ ...passConfig, minUppercase: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Minimum lower case characters required in password</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={passConfig.minLowercase}
                        onChange={(e) => setPassConfig({ ...passConfig, minLowercase: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Minimum numeric value required in password</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={passConfig.minNumeric}
                        onChange={(e) => setPassConfig({ ...passConfig, minNumeric: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Number of passwords to be remembered</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={passConfig.passwordsToRemember}
                        onChange={(e) => setPassConfig({ ...passConfig, passwordsToRemember: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Password resetting days</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={passConfig.passwordResettingDays}
                        onChange={(e) => setPassConfig({ ...passConfig, passwordResettingDays: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Maximum allowed count for invalid password</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={passConfig.maxInvalidAttempts}
                        onChange={(e) => setPassConfig({ ...passConfig, maxInvalidAttempts: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>
                </>
              )}

              {activeCategory === "Housekeeping" && (
                <>
                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Number of days to retain activity log</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="3650"
                        value={hkConfig.daysToRetainActivityLog}
                        onChange={(e) => setHkConfig({ ...hkConfig, daysToRetainActivityLog: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Country code</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="text"
                        value={hkConfig.countryCode}
                        onChange={(e) => setHkConfig({ ...hkConfig, countryCode: e.target.value })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-left"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Remind Patch updation after (in days)</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={hkConfig.remindPatchUpdationDays}
                        onChange={(e) => setHkConfig({ ...hkConfig, remindPatchUpdationDays: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Activate company-wise restrictions in Manage Menu Access</td>
                    <td className="p-1 border-r border-[#e0e0e0] text-center">
                      <input
                        type="checkbox"
                        checked={hkConfig.activateCompanyWiseRestrictions}
                        onChange={(e) => setHkConfig({ ...hkConfig, activateCompanyWiseRestrictions: e.target.checked })}
                        className="accent-[#003399]"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Number of custom reports in menu screen</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={hkConfig.customReportsInMenuScreen}
                        onChange={(e) => setHkConfig({ ...hkConfig, customReportsInMenuScreen: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>

                  <tr className="border-b border-[#e0e0e0] hover:bg-[#eef3fb]">
                    <td className="p-1.5 border-r border-[#e0e0e0]">Refresh interval of the custom reports (in seconds)</td>
                    <td className="p-1 border-r border-[#e0e0e0]">
                      <input
                        type="number"
                        min="0"
                        max="3600"
                        value={hkConfig.customReportsRefreshIntervalSeconds}
                        onChange={(e) => setHkConfig({ ...hkConfig, customReportsRefreshIntervalSeconds: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-0.5 border border-[#7f9db9] font-mono text-right"
                      />
                    </td>
                    <td className="p-1.5 text-[#555]">Variable</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="p-2 bg-[#e4e4e4] border-t border-[#a0a0a0] flex items-center justify-between">
        <div className="text-[11px]">
          {saveFeedback ? (
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 border border-emerald-300">
              {saveFeedback}
            </span>
          ) : (
            <span className="text-[#555]">Security configuration policies</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-20 py-1 bg-[#ece9d8] hover:bg-[#e0ded0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-[#808080] text-center font-bold cursor-pointer"
          >
            Ok
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-20 py-1 bg-[#ece9d8] hover:bg-[#e0ded0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-[#808080] text-center font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-20 py-1 bg-[#ece9d8] hover:bg-[#e0ded0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-[#808080] text-center font-bold cursor-pointer"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};
