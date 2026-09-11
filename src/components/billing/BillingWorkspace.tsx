/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.14.0
 * Created      : 2026-09-08
 * Modified     : 2026-09-09
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Single Consolidated Billing Workspace Component (Phase 2C Step 13)
 */

import React, { useState, useEffect, useCallback } from "react";
import { Product, POSProfile, Shift, Customer } from "../../types.ts";
import { SmritiProPosBillingTerminal } from "./propos/ProPosBillingTerm.tsx";
import { SmritiProPosEodReport } from "./propos/ProPosEodReportVie.tsx";
import { SmritiDailyReportsDashboard } from "./propos/ProPosDailyReports.tsx";
import {
  Receipt,
  FileSpreadsheet,
  BarChart3,
  Clock,
  ShieldCheck,
  HelpCircle,
  X,
  Keyboard,
  CheckCircle,
  AlertCircle,
  Info,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export type BillingWorkspaceMode = "RETAIL_POS";
export type BillingAuxiliaryView = "WORKSPACE" | "EOD_Z_REPORT" | "SHIFT_REPORTS";

export interface BillingWorkspaceProps {
  products?: Product[];
  customers?: Customer[];
  profiles?: POSProfile[];
  shifts?: Shift[];
  currentUser?: { role: string; name: string; companyId?: string; branchId?: string; username?: string } | null;
  onRefreshData?: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
  initialMode?: BillingWorkspaceMode;
  initialView?: BillingAuxiliaryView;
  isStandaloneTab?: boolean;
}

export const BillingWorkspace: React.FC<BillingWorkspaceProps> = ({
  products = [],
  customers = [],
  profiles = [],
  shifts = [],
  currentUser,
  onRefreshData,
  onNotification,
  initialView = "WORKSPACE",
}) => {
  const [auxView, setAuxView] = useState<BillingAuxiliaryView>(initialView);
  const [showHotkeysModal, setShowHotkeysModal] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>(() => new Date().toLocaleTimeString());
  // Active shift determination
  const activeShift = shifts.find((s) => s.status === "Open") || shifts[0] || null;
  const registerLabel = activeShift?.profileId || "REG-01";
  const shiftStatus = activeShift?.status === "Open" ? "Shift Active" : "Shift Ready";
  const [toast, setToast] = useState<{ title: string; message: string; type: "success" | "error" | "info" | "warning" } | null>(null);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = useCallback(
    (title: string, message: string, type: "success" | "error" | "info" | "warning" = "info") => {
      setToast({ title, message, type });
      onNotification?.(title, message, type);
      setTimeout(() => setToast(null), 4000);
    },
    [onNotification]
  );

  // Global Keyboard Shortcuts for Mode Switching and Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Focus Workspace
      if (e.key === "F1") {
        e.preventDefault();
        setAuxView("WORKSPACE");
        return;
      }

      // Alt+1: Retail POS workspace
      if (e.altKey && e.key === "1") {
        e.preventDefault();
        setAuxView("WORKSPACE");
        showToast("Mode Switched", "Retail POS Mode Active (Alt+1)", "info");
        return;
      }

      // Esc: Dismiss hotkey modal
      if (e.key === "Escape" && showHotkeysModal) {
        e.preventDefault();
        setShowHotkeysModal(false);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showHotkeysModal, showToast]);

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-hidden font-sans">
      {/* ── Top Unified Billing Navigation Header ── */}
      <header className="bg-white dark:bg-[#131b2e] border-b border-[#c4c5d5] dark:border-[#444653] flex flex-wrap justify-between items-center px-4 h-13 shrink-0 z-20 shadow-2xs gap-2">
        {/* Brand & Mode Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 pr-2 border-r border-[#c4c5d5] dark:border-[#444653]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] animate-pulse" />
            <h1 className="text-sm font-bold text-[#00288e] dark:text-[#a8b8ff] tracking-tight flex items-center gap-1.5">
              <span>Billing Workspace</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-[#dde1ff] dark:bg-[#1e40af] text-[#00288e] dark:text-white rounded font-mono">
                v4.14
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2 bg-[#041632] text-white px-3 py-1.5 rounded-lg text-xs font-bold">
            <Receipt size={14} />
            <span>Retail POS</span>
            <kbd className="text-[9px] px-1 py-0.2 bg-white/15 text-current rounded font-mono">Alt+1</kbd>
          </div>
        </div>

        {/* Auxiliary Views & Operational Status HUD */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold text-[#565e74] dark:text-[#bec6e0]">
          {/* Day End Z-Report Toggle */}
          <button
            type="button"
            onClick={() => setAuxView(auxView === "EOD_Z_REPORT" ? "WORKSPACE" : "EOD_Z_REPORT")}
            title="EOD Z-Report & Cash Settlement (F8)"
            className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 border text-xs font-semibold ${
              auxView === "EOD_Z_REPORT"
                ? "bg-[#b45309] text-white border-[#b45309] shadow-xs"
                : "border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
            }`}
          >
            <FileSpreadsheet size={13} />
            <span className="hidden sm:inline">EOD Z-Report</span>
            <kbd className="text-[9px] opacity-75 font-mono">F8</kbd>
          </button>

          {/* Shift Reports Toggle */}
          <button
            type="button"
            onClick={() => setAuxView(auxView === "SHIFT_REPORTS" ? "WORKSPACE" : "SHIFT_REPORTS")}
            title="Shift Activity Summary"
            className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 border text-xs font-semibold ${
              auxView === "SHIFT_REPORTS"
                ? "bg-[#00288e] text-white border-[#00288e] shadow-xs"
                : "border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
            }`}
          >
            <BarChart3 size={13} />
            <span className="hidden sm:inline">Reports</span>
          </button>

          {/* Shift HUD Badge */}
          <div className="flex items-center gap-1.5 bg-[#dcfce7] text-[#166534] dark:bg-[#14532d]/40 dark:text-[#86efac] px-2.5 py-1 rounded-lg border border-[#16a34a]/30">
            <ShieldCheck size={13} />
            <span className="font-mono">{registerLabel}</span>
            <span className="opacity-60">•</span>
            <span>{shiftStatus}</span>
          </div>

          {/* Real-time Clock */}
          <div className="hidden md:flex items-center gap-1 bg-[#f3f4f5] dark:bg-[#191c1e] px-2.5 py-1 rounded-lg border border-[#c4c5d5] dark:border-[#444653] font-mono text-[11px]">
            <Clock size={11} className="text-[#00288e] dark:text-[#a8b8ff]" />
            <span>{currentTime}</span>
          </div>

          {/* Hotkeys Cheatsheet Trigger */}
          <button
            type="button"
            onClick={() => setShowHotkeysModal(true)}
            title="Billing Keyboard Shortcuts Guide"
            className="p-1.5 rounded-lg border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133] transition text-[#565e74] dark:text-[#bec6e0]"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </header>

      {/* ── Main Workspace Body ── */}
      <div className="flex-1 overflow-hidden relative">
        {auxView === "EOD_Z_REPORT" ? (
          <SmritiProPosEodReport
            onCommitCloseout={(eod) => {
              showToast("Register Closed", `Z-Report committed for shift ${eod.shiftId}`, "success");
              setAuxView("WORKSPACE");
            }}
            onNotification={showToast}
          />
        ) : auxView === "SHIFT_REPORTS" ? (
          <SmritiDailyReportsDashboard />
        ) : (
          <SmritiProPosBillingTerminal onNotification={showToast} shiftId={activeShift?.id} />
        )}
      </div>

      {/* ── Hotkeys Cheatsheet Modal ── */}
      {showHotkeysModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] rounded-2xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] max-w-xl w-full p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#c4c5d5] dark:border-[#444653]">
              <div className="flex items-center gap-2">
                <Keyboard size={18} className="text-[#00288e] dark:text-[#a8b8ff]" />
                <h3 className="font-bold text-sm">SMRITI Billing Workspace Shortcuts</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHotkeysModal(false)}
                className="p-1 rounded-lg hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133] transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Retail POS Mode</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">Alt+1</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Retail POS Workspace</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">Alt+1</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Billing Workspace Focus</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F1</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Universal Item / SKU Lookup</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F2</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Hold / Park Active Cart</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F5</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Recall Suspended Cart</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F6</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>EOD Z-Report / Shift Close</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F8</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Tender Settlement Modal</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F10</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Fast Cash Checkout</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F12</kbd>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setShowHotkeysModal(false)}
                className="px-4 py-1.5 bg-[#00288e] text-white rounded-lg text-xs font-bold shadow-xs hover:bg-[#002075] transition"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification Container ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`p-4 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-semibold ${
              toast.type === "success"
                ? "bg-[#dcfce7] text-[#166534] border-[#16a34a]"
                : toast.type === "error"
                ? "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]"
                : "bg-[#dde1ff] text-[#00288e] border-[#00288e]"
            }`}
          >
            {toast.type === "success" && <CheckCircle size={16} />}
            {toast.type === "error" && <AlertCircle size={16} />}
            {toast.type === "info" && <Info size={16} />}
            <div>
              <div className="font-bold">{toast.title}</div>
              <div className="text-[11px] opacity-90">{toast.message}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingWorkspace;
