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
 * Source Module: Security Management Main Frame Window
 */

import React, { useState, useEffect } from "react";
import { MenuAccessView } from "./MenuAccessView.tsx";
import { SecConfigView } from "./SecConfigView";

export type SecuritySidebarTab =
  | "List Profiles"
  | "Manage Users"
  | "Manage Groups"
  | "Change Password"
  | "Manage Menu Access"
  | "Unlock Users"
  | "Configuration"
  | "Activity Log Report"
  | "My Profile"
  | "Manage Data Access";

interface SmritiSecurityManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SecuritySidebarTab;
}

export const SecManageDlg: React.FC<SmritiSecurityManagementModalProps> = ({
  isOpen,
  onClose,
  initialTab = "Manage Menu Access",
}) => {
  const [activeTab, setActiveTab] = useState<SecuritySidebarTab>(initialTab);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Keyboard shortcut listener for Esc / Alt+X to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.altKey && (e.key === "x" || e.key === "X"))) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getWindowTitle = () => {
    switch (activeTab) {
      case "Manage Menu Access":
        return "Security Management - [Menu Access Control]";
      case "Configuration":
        return "Security Management - [Configuration]";
      default:
        return `Security Management - [${activeTab}]`;
    }
  };

  const getStatusBarText = () => {
    switch (activeTab) {
      case "Manage Menu Access":
        return "Menu Access Control > This option is used for providing user, group and node level menu restrictions";
      case "Configuration":
        return "Configuration > This option is used to configure security policies";
      case "Manage Users":
        return "Manage Users > Maintain system operators, terminal logins and assignment";
      case "Manage Groups":
        return "Manage Groups > Define user roles and hierarchical security group permissions";
      default:
        return `Security Management > ${activeTab}`;
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-2 backdrop-blur-2xs font-sans">
      {/* Classic Windows ERP Window Frame */}
      <div
        className={`bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] shadow-2xl flex flex-col transition-all duration-150 ${
          isMaximized ? "w-full h-full" : "w-[920px] h-[640px] max-w-[98vw] max-h-[96vh]"
        }`}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#0a246a] via-[#3a6ea5] to-[#a6caf0] text-white px-2 py-1 flex items-center justify-between font-bold text-xs select-none border-b border-[#001040]">
          <div className="flex items-center gap-2">
            {/* Red/White Desktop Icon */}
            <div className="w-3.5 h-3.5 bg-red-600 border border-white flex items-center justify-center text-[9px] leading-none text-white font-extrabold shadow-2xs">
              S
            </div>
            <span className="truncate drop-shadow-xs">{getWindowTitle()}</span>
          </div>

          {/* Window Control Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? "Restore Window" : "Maximize Window"}
              className="w-4 h-4 bg-[#ece9d8] hover:bg-[#e0ded0] text-black border border-t-white border-l-white border-r-[#404040] border-b-[#404040] flex items-center justify-center text-[10px] font-bold leading-none cursor-pointer"
            >
              {isMaximized ? "❐" : "🗖"}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="w-4 h-4 bg-[#ece9d8] hover:bg-red-600 hover:text-white text-black border border-t-white border-l-white border-r-[#404040] border-b-[#404040] flex items-center justify-center text-[10px] font-bold leading-none cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Inner Window Work Area: Left Toolbar + Right Content */}
        <div className="flex-1 flex min-h-0 p-1.5 gap-1.5 bg-[#ece9d8]">
          {/* Left Vertical Action Toolbar */}
          <div className="w-40 flex flex-col justify-between select-none">
            <div className="flex flex-col gap-1">
              {(
                [
                  "List Profiles",
                  "Manage Users",
                  "Manage Groups",
                  "Change Password",
                  "Manage Menu Access",
                  "Unlock Users",
                  "Configuration",
                  "Activity Log Report",
                  "My Profile",
                  "Manage Data Access",
                ] as SecuritySidebarTab[]
              ).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`w-full py-1.5 px-2 text-left text-xs font-semibold border-2 transition-all cursor-pointer truncate ${
                      isActive
                        ? "bg-[#dcd8c8] border-t-[#808080] border-l-[#808080] border-r-white border-b-white text-[#000000] shadow-inner"
                        : "bg-[#ece9d8] hover:bg-[#e0ded0] border-t-white border-l-white border-r-[#808080] border-b-[#808080] text-[#000000]"
                    }`}
                  >
                    {tab === "Manage Users" ? "Manage Users" :
                     tab === "Manage Menu Access" ? "Manage Menu Access" :
                     tab === "Manage Data Access" ? "Manage Data Access" : tab}
                  </button>
                );
              })}
            </div>

            {/* Bottom Exit Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-1.5 px-2 text-center text-xs font-bold bg-[#ece9d8] hover:bg-[#e0ded0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-[#808080] text-[#000000] cursor-pointer"
              >
                Exit
              </button>
            </div>
          </div>

          {/* Right Work Area */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#f0f0f0] border border-[#7f9db9] shadow-inner">
            {activeTab === "Manage Menu Access" && (
              <MenuAccessView onClose={onClose} />
            )}

            {activeTab === "Configuration" && (
              <SecConfigView onClose={onClose} />
            )}

            {activeTab !== "Manage Menu Access" && activeTab !== "Configuration" && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-[#555]">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 mb-3 border border-slate-300">
                  <span className="material-symbols-outlined text-[32px]">security</span>
                </div>
                <h3 className="text-sm font-bold text-[#000] mb-1">{activeTab}</h3>
                <p className="max-w-md text-[#666] leading-relaxed mb-4">
                  This supervisory module is managed through the centralized SMRITI Security & Access Control Engine.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("Manage Menu Access")}
                    className="px-3 py-1 bg-[#3366cc] text-white font-bold text-xs rounded hover:bg-[#254e9e]"
                  >
                    Open Menu Access Control
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("Configuration")}
                    className="px-3 py-1 bg-white border border-[#808080] font-bold text-xs text-[#000] hover:bg-[#e8e8e8]"
                  >
                    Open Configuration
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="bg-[#ece9d8] border-t border-[#808080] px-2 py-0.5 flex items-center justify-between text-[11px] text-[#444] select-none">
          <div className="font-bold border-r border-[#a0a0a0] pr-3 text-[#000]">
            SMRITI Retail OS
          </div>
          <div className="flex-1 pl-3 truncate italic text-[#333]">
            {getStatusBarText()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecManageDlg;
