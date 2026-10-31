/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 7.0.0
 * Created      : 2026-09-08
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Single Consolidated Billing Workspace Component (Canonical ERP UX)
 * Capability    : @SmritiCapability("SALES", "UNIFIED_CANONICAL_BILLING")
 */

import React, { useState, useEffect, useCallback } from "react";
import { Product, POSProfile, Shift, Customer } from "../../types.ts";
import { SmritiProPosEodReport } from "./propos/ProPosEodReportVie.tsx";
import { SmritiDailyReportsDashboard } from "./propos/ProPosDailyReports.tsx";
import { SalesStudioTab } from "../SalesStudioTab.tsx";
import { BillingTerm } from "./BillingTerm.tsx";
import { GiftCardLifecycleModal } from "../pos/GiftCardLifecycleModal.tsx";
import { GiftVoucherModal } from "../pos/GiftVoucherModal.tsx";
import { ProPosReconciliationDlg } from "./propos/ProPosReconciliationDlg.tsx";
import { ProPosSupervisorAuthModal } from "./propos/ProPosSupervisorAuthModal.tsx";
import { DynamicPricingStudioModal } from "./propos/DynamicPricingStudioModal.tsx";
import { OmniOrderStudioModal } from "../pos/OmniOrderStudioModal.tsx";
import { PackingSlipManagementModal } from "./modals/PackingSlipManagementModal.tsx";
import { BillingProfileConfigModal } from "./modals/BillingProfileConfigModal.tsx";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  Receipt,
  FileSpreadsheet,
  BarChart3,
  Clock,
  ShieldCheck,
  X,
  Keyboard,
  CheckCircle,
  AlertCircle,
  Info,
  RotateCcw,
  Gift,
  Ticket,
  Zap,
  ShoppingBag,
  MoreHorizontal,
  FileText,
  Package,
  Settings,
  ChevronDown,
} from "lucide-react";
import { APP_VERSION } from "../../config/version.ts";

export type BillingWorkspaceMode = "RETAIL_POS" | "CREDIT_BILLING" | "B2B_DISTRIBUTOR";
export type BillingAuxiliaryView = "WORKSPACE" | "EOD_Z_REPORT" | "SHIFT_REPORTS" | "CREDIT_BILLING" | "B2B_DISTRIBUTOR" | "SALES_MANAGEMENT" | "CREDIT_TAX_INVOICE";

export const normalizeBillingAuxiliaryView = (view: BillingAuxiliaryView): BillingAuxiliaryView =>
  view === "CREDIT_BILLING" || view === "B2B_DISTRIBUTOR" || view === "CREDIT_TAX_INVOICE"
    ? "WORKSPACE"
    : view;

export const getBillingDefaults = (mode: BillingWorkspaceMode) => ({
  transaction: mode === "RETAIL_POS" ? "Cash" as const : "Credit" as const,
  salesChannel: mode === "RETAIL_POS" ? "POS_RETAIL" : "B2B_WHOLESALE",
});

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
  initialMode = "RETAIL_POS",
  initialView = "WORKSPACE",
  isStandaloneTab = false,
}) => {
  const [auxView, setAuxView] = useState<BillingAuxiliaryView>(() => normalizeBillingAuxiliaryView(initialView));
  const [showHotkeysModal, setShowHotkeysModal] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const resolvedView = normalizeBillingAuxiliaryView(initialView);
    setAuxView(resolvedView);
  }, [initialView]);
  // Active shift determination
  const activeShift = shifts.find((s) => s.status?.toUpperCase() === "OPEN") || shifts[0] || null;
  const registerLabel = activeShift?.profileId || "REG-01";
  const shiftStatus = activeShift?.status?.toUpperCase() === "OPEN" ? "Shift Active" : "Shift Ready";
  const [toast, setToast] = useState<{ title: string; message: string; type: "success" | "error" | "info" | "warning" } | null>(null);
  const [showGiftCardModal, setShowGiftCardModal] = useState<boolean>(false);
  const [showGiftVoucherModal, setShowGiftVoucherModal] = useState<boolean>(false);
  const [showReconModal, setShowReconModal] = useState<boolean>(false);
  const [showSupervisorPinModal, setShowSupervisorPinModal] = useState<boolean>(false);
  const [showDynamicPricingModal, setShowDynamicPricingModal] = useState<boolean>(false);
  const [showOmniOrderModal, setShowOmniOrderModal] = useState<boolean>(false);
  const [showPackingSlipModal, setShowPackingSlipModal] = useState<boolean>(false);
  const [packingSlipCustomerId, setPackingSlipCustomerId] = useState<string | undefined>();
  const [showBillingPolicyModal, setShowBillingPolicyModal] = useState<boolean>(false);
  const [billingProfileData, setBillingProfileData] = useState<any>(null);
  const [billingEffectiveConfiguration, setBillingEffectiveConfiguration] = useState<any>({});
  // REC-07: Secondary toolbar overflow menu
  const [showOverflowMenu, setShowOverflowMenu] = useState<boolean>(false);

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
      setTimeout(() => setToast(null), 6000);
    },
    [onNotification]
  );
  const canManageBillingPolicy = ["MANAGER", "SYSADMIN"].includes(String(currentUser?.role || "").toUpperCase());
  const refreshBillingPolicyConfiguration = useCallback(async () => {
    const [profile, policy] = await Promise.all([
      apiFetchV1<any>("/billing/profile"),
      apiFetchV1<any>("/billing/transaction-policy"),
    ]);
    const profileData = profile?.data || profile;
    const policyData = policy?.data || policy;
    setBillingProfileData(profileData || {});
    setBillingEffectiveConfiguration(policyData?.configuration || profileData?.effective_configuration || {});
  }, []);
  const openBillingPolicyModal = useCallback(async () => {
    try {
      await refreshBillingPolicyConfiguration();
      setShowBillingPolicyModal(true);
    } catch (error) {
      console.error("[BillingWorkspace] Billing policy settings could not be loaded:", error);
      showToast("Billing Policy Unavailable", "Company and branch billing settings could not be loaded. Check the connection or ask an administrator.", "error");
    }
  }, [refreshBillingPolicyConfiguration, showToast]);

  // Global Keyboard Shortcuts for workspace navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Focus Workspace
      if (e.key === "F1") {
        e.preventDefault();
        setAuxView("WORKSPACE");
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
    <div className="h-full flex flex-col overflow-hidden font-sans transition-colors duration-300 bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3]">
      {/* ── Top Unified Billing Navigation Header (Only shown when viewing auxiliary modules) ── */}
      {auxView !== "WORKSPACE" && (
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131b2e] flex flex-wrap justify-between items-center px-4 py-2 shrink-0 z-20 shadow-2xs gap-2 transition-colors duration-300">
        {/* One billing workspace with supporting sales documents and operations */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setAuxView("WORKSPACE")}
            aria-pressed={false}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer bg-[#041632] hover:bg-[#0b295c] text-white shadow-xs"
            title="Return to primary Billing Desk"
          >
            <Receipt size={14} />
            <span>← Back to Billing Desk</span>
          </button>

          <button
            type="button"
            onClick={() => setAuxView("SALES_MANAGEMENT")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              auxView === "SALES_MANAGEMENT"
                ? "bg-[#0f766e] text-white shadow-xs"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
            aria-pressed={auxView === "SALES_MANAGEMENT"}
          >
            <FileText size={14} />
            <span>Sales Documents</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPackingSlipModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
            data-field-key="nav-packing-slips-btn"
          >
            <Package size={14} />
            <span>Packing Slips</span>
          </button>

          <button
            type="button"
            disabled
            title="Consolidated billing is unavailable until packing-slip quantities are loaded from the fulfillment service."
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-500 rounded-lg text-xs font-bold cursor-not-allowed shadow-2xs"
            data-field-key="nav-consolidated-billing-btn"
          >
            <FileText size={14} />
            <span>Consolidated Billing (Unavailable)</span>
          </button>
        </div>

        {/* Right Tools: Reports, More, Shift HUD, Clock, Settings */}
        <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600">
          {/* Reports Toggle */}
          <button
            type="button"
            onClick={() => setAuxView(auxView === "SHIFT_REPORTS" ? "WORKSPACE" : "SHIFT_REPORTS")}
            className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"
          >
            <BarChart3 size={14} />
            <span>Reports</span>
          </button>

          {/* More Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOverflowMenu((v) => !v)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition flex items-center gap-1 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"
            >
              <MoreHorizontal size={14} />
              <span>More</span>
              <ChevronDown size={12} />
            </button>

            {showOverflowMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowOverflowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[200px] flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => { setShowGiftCardModal(true); setShowOverflowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-amber-700 hover:bg-slate-50 text-left w-full cursor-pointer"
                  >
                    <Gift size={13} /> Gift Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowGiftVoucherModal(true); setShowOverflowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-teal-700 hover:bg-slate-50 text-left w-full cursor-pointer"
                  >
                    <Ticket size={13} /> Gift Vouchers
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowReconModal(true); setShowOverflowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 hover:bg-slate-50 text-left w-full cursor-pointer"
                  >
                    <RotateCcw size={13} /> Sync &amp; Recon
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDynamicPricingModal(true); setShowOverflowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-slate-50 text-left w-full cursor-pointer"
                  >
                    <Zap size={13} /> Dynamic Pricing
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowOmniOrderModal(true); setShowOverflowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-slate-50 text-left w-full cursor-pointer"
                  >
                    <ShoppingBag size={13} /> Omni Orders
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuxView(auxView === "EOD_Z_REPORT" ? "WORKSPACE" : "EOD_Z_REPORT"); setShowOverflowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-amber-800 hover:bg-slate-50 text-left w-full cursor-pointer"
                  >
                    <FileSpreadsheet size={13} /> EOD Z-Report
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Shift HUD Badge — green outline pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-400/50 bg-emerald-50 text-emerald-800 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono font-bold text-xs">{registerLabel}</span>
            <span className="opacity-60">·</span>
            <span className="text-xs">{shiftStatus}</span>
          </div>

          {/* Real-time Clock (2 lines) */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-0.5 rounded-lg text-slate-800 font-mono text-left">
            <Clock size={13} className="text-slate-500 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-bold">{currentTime}</span>
              <span className="text-[9px] text-slate-500">17 Oct 2026</span>
            </div>
          </div>

          {/* Settings Trigger */}
          <button
            type="button"
            onClick={() => setShowHotkeysModal(true)}
            title="Billing Settings &amp; Shortcuts"
            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer shadow-2xs"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>
      )}

      {/* ── Main Workspace Body ── */}
      <div className="flex-1 overflow-hidden relative">
        {auxView === "SALES_MANAGEMENT" ? (
          <div className="h-full overflow-auto">
            <SalesStudioTab
              products={products}
              currentUser={currentUser}
              onNotification={showToast}
            />
          </div>
        ) : auxView === "EOD_Z_REPORT" ? (
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
          <div className="h-full overflow-hidden">
            <BillingTerm
              key={initialMode}
              products={products}
              customers={customers}
              profiles={profiles}
              shifts={shifts}
              currentUser={currentUser}
              onRefreshData={onRefreshData}
              onNotification={(title, message, type) => showToast(title, message, type)}
              isStandaloneTab={isStandaloneTab}
              initialTransaction={getBillingDefaults(initialMode).transaction}
              initialSalesChannel={getBillingDefaults(initialMode).salesChannel}
              onOpenSalesDocuments={() => setAuxView("SALES_MANAGEMENT")}
              onOpenPackingSlips={(customerId) => {
                setPackingSlipCustomerId(customerId);
                setShowPackingSlipModal(true);
              }}
              onOpenBillingConfiguration={canManageBillingPolicy ? () => { void openBillingPolicyModal(); } : undefined}
              onOpenShiftReports={() => setAuxView("SHIFT_REPORTS")}
              onOpenEodReport={() => setAuxView("EOD_Z_REPORT")}
              onOpenShiftManager={() => setAuxView("SHIFT_REPORTS")}
              onOpenHotkeys={() => setShowHotkeysModal(true)}
            />
          </div>
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
                <span>Billing Workspace Focus</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F1</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Universal Item / SKU Lookup</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F2</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Direct Item Entry Focus</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F11</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Promotional Discounts</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F6</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Hold / Park Active Cart</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F12</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Tender Settlement Modal</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F8</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f4f5] dark:bg-[#25292e]">
                <span>Exact Cash Settlement</span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-black/40 font-mono font-bold shadow-2xs">F7</kbd>
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
        <div className="fixed top-16 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
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

      {/* Gift Card Lifecycle Modal */}
      {showGiftCardModal && (
        <GiftCardLifecycleModal
          isOpen={showGiftCardModal}
          onClose={() => setShowGiftCardModal(false)}
          onNotification={(title, msg, type) => showToast(title, msg, type === "info" ? "info" : type)}
        />
      )}

      {/* Gift Voucher Modal */}
      {showGiftVoucherModal && (
        <GiftVoucherModal
          isOpen={showGiftVoucherModal}
          onClose={() => setShowGiftVoucherModal(false)}
          onNotification={(title, msg, type) => showToast(title, msg, type === "info" ? "info" : type)}
        />
      )}

      {/* Offline Sync & Reconciliation Dialog */}
      {showReconModal && (
        <ProPosReconciliationDlg
          isOpen={showReconModal}
          onClose={() => setShowReconModal(false)}
          onNotification={(title, msg, type) => showToast(title, msg, type)}
        />
      )}

      {/* POS Supervisor PIN Override Modal */}
      {showSupervisorPinModal && (
        <ProPosSupervisorAuthModal
          isOpen={showSupervisorPinModal}
          onClose={() => setShowSupervisorPinModal(false)}
          actionType="PRICE_OVERRIDE"
          actionTitle="POS Supervisor Authorization"
          actionDescription="Authorize cashier override, negative cash drawer, or price adjustment."
          onAuthorized={(authResult) => {
            showToast("Supervisor Authorized", `Authorized by ${authResult.supervisor_name}`, "success");
            setShowSupervisorPinModal(false);
          }}
          onNotification={(title, msg, type) => showToast(title, msg, type)}
        />
      )}

      {/* Dynamic Pricing Studio Modal */}
      {showDynamicPricingModal && (
        <DynamicPricingStudioModal
          isOpen={showDynamicPricingModal}
          onClose={() => setShowDynamicPricingModal(false)}
          onNotification={(title, msg, type) => showToast(title, msg, type)}
        />
      )}

      {/* Omnichannel Orders Studio Modal */}
      {showOmniOrderModal && (
        <OmniOrderStudioModal
          isOpen={showOmniOrderModal}
          onClose={() => setShowOmniOrderModal(false)}
          onNotification={(title, msg, type) => showToast(title, msg, type)}
        />
      )}

      {/* B2B Packing Slips Studio Modal */}
      {showPackingSlipModal && (
        <PackingSlipManagementModal
          isOpen={showPackingSlipModal}
          onClose={() => {
            setShowPackingSlipModal(false);
            setPackingSlipCustomerId(undefined);
          }}
          customerId={packingSlipCustomerId}
          customers={customers}
          products={products}
          currentUser={currentUser}
          onNotification={(title, msg, type) => showToast(title, msg, type)}
        />
      )}

      {showBillingPolicyModal && (
        <BillingProfileConfigModal
          isOpen={showBillingPolicyModal}
          onClose={() => setShowBillingPolicyModal(false)}
          activeProfile={
            billingProfileData?.billing_profile === "B2C_ONLY" || (!billingProfileData?.billing_profile && initialMode === "RETAIL_POS")
              ? "B2C_ONLY"
              : "B2B_ONLY"
          }
          effectiveConfig={billingEffectiveConfiguration}
          customOverrides={billingProfileData?.custom_overrides || {}}
          history={billingProfileData?.history || []}
          canManage={canManageBillingPolicy}
          onConfigSaved={() => {
            void refreshBillingPolicyConfiguration().catch(error => {
              console.error("[BillingWorkspace] Saved billing policy could not be refreshed:", error);
              showToast("Settings Saved", "The policy was saved, but the displayed effective values could not be refreshed.", "warning");
            });
          }}
          onNotification={showToast}
        />
      )}

    </div>
  );
};

export default BillingWorkspace;
