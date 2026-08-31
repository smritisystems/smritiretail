/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { SmritiProPosBillinginal } from "./ProPosBillingTerm.tsx";
import { SmritiProPosEodReportw } from "./ProPosEodReportVie.tsx";
import { SmritiDailyReportsDashDashboard } from "./ProPosDailyReports.tsx";
import { SmritiPromotionEngineine } from "./ProPosPromotionEng.tsx";
import { SmritiCommissionBuildilder } from "./ProPosCommissionBu.tsx";
import { BillingTerm } from "../BillingTerm.tsx";
import { Product, POSProfile, Shift } from "../../../types.ts";
import { 
  ShoppingCart, 
  Receipt,
  BarChart3, 
  Sparkles, 
  Award, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Clock,
  ShieldCheck
} from "lucide-react";

type ProPosActiveTab = "BILLING" | "INVOICING" | "EOD_Z_REPORT" | "DAILY_REPORTS" | "PROMOTIONS" | "COMMISSIONS";

interface SmritiProPosWorkspaceProps {
  products?: Product[];
  profiles?: POSProfile[];
  shifts?: Shift[];
  onRefreshData?: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error") => void;
  initialTab?: ProPosActiveTab;
}

export const ProPosWs: React.FC<SmritiProPosWorkspaceProps> = ({
  products = [],
  profiles = [],
  shifts = [],
  onRefreshData,
  onNotification,
  initialTab = "INVOICING",
}) => {
  const [activeTab, setActiveTab] = useState<ProPosActiveTab>(initialTab);
  const [toast, setToast] = useState<{ title: string; message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (title: string, message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ title, message, type });
    onNotification?.(title, message, type === "error" ? "error" : "success");
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-hidden font-sans">
      
      {/* Primary ProPOS Workspace Top App Header */}
      <header className="bg-white dark:bg-[#131b2e] border-b border-[#c4c5d5] dark:border-[#444653] flex justify-between items-center px-6 h-12 shrink-0 z-20 shadow-2xs">
        
        {/* Brand & Module Navigation */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] animate-pulse"></span>
            <h1 className="text-sm font-bold text-[#00288e] dark:text-[#a8b8ff] tracking-tight flex items-center gap-1.5">
              <span>Enterprise Billing Suite</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-[#dde1ff] dark:bg-[#1e40af] text-[#00288e] dark:text-white rounded font-mono">v6.16</span>
            </h1>
          </div>

          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("INVOICING")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "INVOICING"
                  ? "bg-[#041632] text-white shadow-xs"
                  : "text-[#565e74] dark:text-[#bec6e0] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
              }`}
            >
              <Receipt size={14} />
              <span>Distributor Invoicing</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("BILLING")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "BILLING"
                  ? "bg-[#00288e] text-white shadow-xs"
                  : "text-[#565e74] dark:text-[#bec6e0] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
              }`}
            >
              <ShoppingCart size={14} />
              <span>Speed POS Terminal</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("EOD_Z_REPORT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "EOD_Z_REPORT"
                  ? "bg-[#00288e] text-white shadow-xs"
                  : "text-[#565e74] dark:text-[#bec6e0] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>EOD Z-Report</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("DAILY_REPORTS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "DAILY_REPORTS"
                  ? "bg-[#00288e] text-white shadow-xs"
                  : "text-[#565e74] dark:text-[#bec6e0] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
              }`}
            >
              <BarChart3 size={14} />
              <span>Shift Reports</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("PROMOTIONS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "PROMOTIONS"
                  ? "bg-[#00288e] text-white shadow-xs"
                  : "text-[#565e74] dark:text-[#bec6e0] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
              }`}
            >
              <Sparkles size={14} />
              <span>Promotions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("COMMISSIONS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "COMMISSIONS"
                  ? "bg-[#00288e] text-white shadow-xs"
                  : "text-[#565e74] dark:text-[#bec6e0] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
              }`}
            >
              <Award size={14} />
              <span>Commissions</span>
            </button>
          </nav>
        </div>

        {/* Terminal Shift & Status Bar */}
        <div className="flex items-center gap-4 text-xs font-semibold text-[#565e74] dark:text-[#bec6e0]">
          <div className="flex items-center gap-1.5 bg-[#f3f4f5] dark:bg-[#191c1e] px-2.5 py-1 rounded-lg border border-[#c4c5d5] dark:border-[#444653]">
            <Clock size={12} className="text-[#00288e]" />
            <span className="font-mono">{new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#dcfce7] text-[#166534] px-2.5 py-1 rounded-lg border border-[#16a34a]/30">
            <ShieldCheck size={13} />
            <span>Shift Active (REG-01)</span>
          </div>
        </div>

      </header>

      {/* Main Workspace Active View */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "INVOICING" && (
          <BillingTerm
            products={products}
            onNotification={showToast}
            onRefreshData={onRefreshData}
          />
        )}
        {activeTab === "BILLING" && (
          <SmritiProPosBillinginal onNotification={showToast} />
        )}
        {activeTab === "EOD_Z_REPORT" && (
          <SmritiProPosEodReportw
            onCommitCloseout={(eod) => {
              showToast("Register Closed", `Z-Report committed for shift ${eod.shiftId}`, "success");
            }}
            onNotification={showToast}
          />
        )}
        {activeTab === "DAILY_REPORTS" && (
          <SmritiDailyReportsDashDashboard />
        )}
        {activeTab === "PROMOTIONS" && (
          <SmritiPromotionEngineine />
        )}
        {activeTab === "COMMISSIONS" && (
          <SmritiCommissionBuildilder />
        )}
      </div>

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className={`p-4 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-semibold ${
            toast.type === "success"
              ? "bg-[#dcfce7] text-[#166534] border-[#16a34a]"
              : toast.type === "error"
              ? "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]"
              : "bg-[#dde1ff] text-[#00288e] border-[#00288e]"
          }`}>
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

export default ProPosWs;
