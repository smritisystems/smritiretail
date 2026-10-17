/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.91.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Company Billing Profile & Configuration Settings Modal Component
 */

import React, { useState } from "react";
import {
  Settings,
  Sliders,
  ShieldCheck,
  RefreshCw,
  X,
  AlertTriangle,
  History,
  CheckCircle2,
  Lock,
  Building2,
  ShoppingBag,
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

export interface BillingProfileConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile: "B2C_ONLY" | "B2B_ONLY";
  effectiveConfig: any;
  customOverrides: any;
  history: any[];
  canManage: boolean;
  onConfigSaved: (updatedData: any) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
}

export const BillingProfileConfigModal: React.FC<BillingProfileConfigModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
  effectiveConfig,
  customOverrides,
  history = [],
  canManage,
  onConfigSaved,
  onNotification,
}) => {
  const [activeTab, setActiveTab] = useState<"SETTINGS" | "MIGRATION" | "HISTORY">("SETTINGS");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Settings Form State
  const [shiftManagement, setShiftManagement] = useState<string>(
    effectiveConfig?.shift_management || (activeProfile === "B2C_ONLY" ? "ENABLED" : "DISABLED")
  );
  const [customerPoRef, setCustomerPoRef] = useState<string>(
    effectiveConfig?.customer_po_reference || (activeProfile === "B2C_ONLY" ? "HIDDEN" : "OPTIONAL")
  );
  const [bulkAddEnabled, setBulkAddEnabled] = useState<string>(
    effectiveConfig?.bulk_add_enabled || "ENABLED"
  );
  const [repeatBarcodePolicy, setRepeatBarcodePolicy] = useState<string>(
    effectiveConfig?.repeat_barcode_policy || "INCREASE_QUANTITY"
  );
  const [defaultScanMode, setDefaultScanMode] = useState<string>(
    effectiveConfig?.default_scan_mode || "AUTO_ADD"
  );
  const [postScanFocus, setPostScanFocus] = useState<string>(
    effectiveConfig?.post_scan_focus || "scan_field"
  );
  const [scanBeep, setScanBeep] = useState<string>(
    effectiveConfig?.scan_beep || "ENABLED"
  );

  // B2B Packing-First & Consolidated Invoicing Policies
  const [b2bPackingFirstWorkflow, setB2bPackingFirstWorkflow] = useState<string>(
    effectiveConfig?.b2b_packing_first_workflow || (activeProfile === "B2B_ONLY" ? "ENABLED" : "DISABLED")
  );
  const [packingSlipQtyDefault, setPackingSlipQtyDefault] = useState<string>(
    effectiveConfig?.packing_slip_qty_default || (activeProfile === "B2B_ONLY" ? "REMAINING_UNPACKED_QTY" : "MANUAL_ZERO")
  );
  const [invoiceQtyDefault, setInvoiceQtyDefault] = useState<string>(
    effectiveConfig?.invoice_qty_default || (activeProfile === "B2B_ONLY" ? "PACKED_UNBILLED_QTY" : "MANUAL_ZERO")
  );
  const [allowPartialPacking, setAllowPartialPacking] = useState<string>(
    effectiveConfig?.allow_partial_packing || "ENABLED"
  );
  const [allowPartialInvoicing, setAllowPartialInvoicing] = useState<string>(
    effectiveConfig?.allow_partial_invoicing || "ENABLED"
  );
  const [allowEditingPrefilledQty, setAllowEditingPrefilledQty] = useState<string>(
    effectiveConfig?.allow_editing_prefilled_qty || "AUTHORIZED_ONLY"
  );

  // Profile Migration Form State
  const targetNewProfile: "B2C_ONLY" | "B2B_ONLY" = activeProfile === "B2C_ONLY" ? "B2B_ONLY" : "B2C_ONLY";
  const [migrationReason, setMigrationReason] = useState<string>("");

  if (!isOpen) return null;

  // ── Save Configuration Overrides ─────────────────────────────────────────
  const handleSaveSettings = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        shift_management: shiftManagement,
        customer_po_reference: customerPoRef,
        bulk_add_enabled: bulkAddEnabled,
        repeat_barcode_policy: repeatBarcodePolicy,
        default_scan_mode: defaultScanMode,
        post_scan_focus: postScanFocus,
        scan_beep: scanBeep,
        b2b_packing_first_workflow: b2bPackingFirstWorkflow,
        packing_slip_qty_default: packingSlipQtyDefault,
        invoice_qty_default: invoiceQtyDefault,
        allow_partial_packing: allowPartialPacking,
        allow_partial_invoicing: allowPartialInvoicing,
        allow_editing_prefilled_qty: allowEditingPrefilledQty,
      };
      const res = await apiFetchV1("/billing/configuration", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      onNotification?.("Settings Saved", "Billing Studio configuration updated successfully.", "success");
      onConfigSaved(res);
      onClose();
    } catch (err: any) {
      const msg = err?.message || "Failed to update configuration.";
      onNotification?.("Save Error", msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Execute Authorized Profile Switch ─────────────────────────────────────
  const handleExecuteProfileSwitch = async () => {
    if (!migrationReason.trim()) {
      onNotification?.("Validation Error", "A business justification reason is required to switch profile.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetchV1("/billing/profile/switch", {
        method: "PUT",
        body: JSON.stringify({
          profile: targetNewProfile,
          reason: migrationReason.trim(),
        }),
      });
      onNotification?.(
        "Profile Migrated",
        `Company billing profile switched to ${targetNewProfile}. Historical records preserved.`,
        "success"
      );
      onConfigSaved(res);
      onClose();
    } catch (err: any) {
      const msg = err?.message || "Failed to switch billing profile.";
      onNotification?.("Migration Error", msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] rounded-2xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c5d5] dark:border-[#444653] bg-slate-50 dark:bg-[#131b2e]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00288e]/10 dark:bg-[#a8b8ff]/20 text-[#00288e] dark:text-[#a8b8ff] rounded-xl">
              <Sliders size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base tracking-tight">Billing Profile &amp; Policies</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono ${
                  activeProfile === "B2C_ONLY"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-400/30"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-400/30"
                }`}>
                  {activeProfile}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Administrator customization and company policy governance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-[#c4c5d5] dark:border-[#444653] bg-slate-50/50 dark:bg-[#171f30]">
          <button
            type="button"
            onClick={() => setActiveTab("SETTINGS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "SETTINGS"
                ? "bg-[#00288e] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <Settings size={13} />
            <span>Feature Overrides</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MIGRATION")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "MIGRATION"
                ? "bg-[#00288e] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <RefreshCw size={13} />
            <span>Switch Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("HISTORY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "HISTORY"
                ? "bg-[#00288e] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <History size={13} />
            <span>Audit Trail ({history.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "SETTINGS" && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-100 dark:bg-slate-800/40 rounded-xl text-xs text-slate-600 dark:text-slate-400">
                <strong>Precedence Hierarchy:</strong> Company Policy &gt; {activeProfile} Defaults &gt; Store Config &gt; User Preferences.
              </div>

              {/* 1. Shift Management Policy */}
              <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Shift Management Policy</h4>
                  <p className="text-[11px] text-slate-500">
                    Enforces open register shifts and cashier reconciliation during sales checkout.
                  </p>
                </div>
                <select
                  id="config-shift-management-select"
                  value={shiftManagement}
                  onChange={(e) => setShiftManagement(e.target.value)}
                  disabled={!canManage}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                >
                  <option value="ENABLED">ENABLED</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </div>

              {/* 2. Customer PO Reference Requirement */}
              <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Customer PO Reference</h4>
                  <p className="text-[11px] text-slate-500">
                    Customer purchase order reference field behavior in the studio.
                  </p>
                </div>
                <select
                  id="config-po-ref-select"
                  value={customerPoRef}
                  onChange={(e) => setCustomerPoRef(e.target.value)}
                  disabled={!canManage}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                >
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="OPTIONAL">OPTIONAL</option>
                  <option value="REQUIRED">REQUIRED</option>
                </select>
              </div>

              {/* 3. Bulk Add Action */}
              <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Bulk Add Action</h4>
                  <p className="text-[11px] text-slate-500">
                    Allows multi-line barcode paste, tabular Excel paste, and CSV import.
                  </p>
                </div>
                <select
                  id="config-bulk-add-select"
                  value={bulkAddEnabled}
                  onChange={(e) => setBulkAddEnabled(e.target.value)}
                  disabled={!canManage}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                >
                  <option value="ENABLED">ENABLED</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </div>

              {/* 4. Repeat Barcode Policy */}
              <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Repeat Barcode Action</h4>
                  <p className="text-[11px] text-slate-500">
                    Behavior when an already scanned product is scanned again.
                  </p>
                </div>
                <select
                  id="config-repeat-barcode-select"
                  value={repeatBarcodePolicy}
                  onChange={(e) => setRepeatBarcodePolicy(e.target.value)}
                  disabled={!canManage}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                >
                  <option value="INCREASE_QUANTITY">INCREASE_QUANTITY (Qty + 1)</option>
                  <option value="NEW_LINE">NEW_LINE (Add as separate row)</option>
                  <option value="ASK_USER">ASK_USER (Prompt cashier)</option>
                </select>
              </div>

              {/* 5. Default Scan Mode */}
              <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Default Scan Mode</h4>
                  <p className="text-[11px] text-slate-500">
                    Immediate add vs staging editor vs confirmation dialog.
                  </p>
                </div>
                <select
                  id="config-scan-mode-select"
                  value={defaultScanMode}
                  onChange={(e) => setDefaultScanMode(e.target.value)}
                  disabled={!canManage}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                >
                  <option value="AUTO_ADD">AUTO_ADD (Direct Cart Add)</option>
                  <option value="EDIT_THEN_ADD">EDIT_THEN_ADD (Stage in Row)</option>
                  <option value="CONFIRM_PRODUCT">CONFIRM_PRODUCT (Modal Dialog)</option>
                </select>
              </div>

              {/* 6. Audio Beep */}
              <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Audio Beep Feedback</h4>
                  <p className="text-[11px] text-slate-500">
                    Hardware beep sound on successful product barcode scan.
                  </p>
                </div>
                <select
                  id="config-scan-beep-select"
                  value={scanBeep}
                  onChange={(e) => setScanBeep(e.target.value)}
                  disabled={!canManage}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                >
                  <option value="ENABLED">ENABLED</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </div>

              {/* B2B Packing-First & Consolidated Billing Controls */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    B2B Packing-First &amp; Consolidated Billing Policies
                  </h3>
                </div>

                {/* 7. B2B Packing-First Workflow */}
                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">B2B Packing-First Workflow</h4>
                    <p className="text-[11px] text-slate-500">
                      Enable packing slip generation prior to consolidated tax invoicing.
                    </p>
                  </div>
                  <select
                    id="config-b2b-workflow-select"
                    value={b2bPackingFirstWorkflow}
                    onChange={(e) => setB2bPackingFirstWorkflow(e.target.value)}
                    disabled={!canManage}
                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                  >
                    <option value="ENABLED">ENABLED</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>

                {/* 8. Packing Slip Quantity Default */}
                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Packing Slip Qty Default</h4>
                    <p className="text-[11px] text-slate-500">
                      Initial prefill policy when generating a pick &amp; pack slip.
                    </p>
                  </div>
                  <select
                    id="config-ps-qty-default-select"
                    value={packingSlipQtyDefault}
                    onChange={(e) => setPackingSlipQtyDefault(e.target.value)}
                    disabled={!canManage}
                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                  >
                    <option value="REMAINING_UNPACKED_QTY">REMAINING_UNPACKED_QTY (Recommended)</option>
                    <option value="ORDERED_QTY">ORDERED_QTY</option>
                    <option value="MANUAL_ZERO">MANUAL_ZERO</option>
                  </select>
                </div>

                {/* 9. Invoice Quantity Default */}
                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Invoice Qty Default</h4>
                    <p className="text-[11px] text-slate-500">
                      Initial prefill policy when consolidating packing slips into invoice.
                    </p>
                  </div>
                  <select
                    id="config-inv-qty-default-select"
                    value={invoiceQtyDefault}
                    onChange={(e) => setInvoiceQtyDefault(e.target.value)}
                    disabled={!canManage}
                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                  >
                    <option value="PACKED_UNBILLED_QTY">PACKED_UNBILLED_QTY (Recommended)</option>
                    <option value="ORDERED_QTY_IF_ELIGIBLE">ORDERED_QTY_IF_ELIGIBLE</option>
                    <option value="MANUAL_ZERO">MANUAL_ZERO</option>
                  </select>
                </div>

                {/* 10. Partial Packing Policy */}
                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Partial Packing Policy</h4>
                    <p className="text-[11px] text-slate-500">
                      Permits packing partial quantities across multiple slips.
                    </p>
                  </div>
                  <select
                    id="config-partial-packing-select"
                    value={allowPartialPacking}
                    onChange={(e) => setAllowPartialPacking(e.target.value)}
                    disabled={!canManage}
                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                  >
                    <option value="ENABLED">ENABLED</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>

                {/* 11. Partial Invoicing Policy */}
                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Partial Invoicing Policy</h4>
                    <p className="text-[11px] text-slate-500">
                      Permits billing a portion of packed quantities on separate invoices.
                    </p>
                  </div>
                  <select
                    id="config-partial-invoicing-select"
                    value={allowPartialInvoicing}
                    onChange={(e) => setAllowPartialInvoicing(e.target.value)}
                    disabled={!canManage}
                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                  >
                    <option value="ENABLED">ENABLED</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>

                {/* 12. Quantity Editing Permission */}
                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Prefill Quantity Editing</h4>
                    <p className="text-[11px] text-slate-500">
                      Who can manually modify prefilled packing and invoicing quantities.
                    </p>
                  </div>
                  <select
                    id="config-edit-qty-permission-select"
                    value={allowEditingPrefilledQty}
                    onChange={(e) => setAllowEditingPrefilledQty(e.target.value)}
                    disabled={!canManage}
                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-[#131b2e] outline-none"
                  >
                    <option value="AUTHORIZED_ONLY">AUTHORIZED_ONLY (Managers/Admins)</option>
                    <option value="ENABLED">ENABLED (All Operators)</option>
                    <option value="DISABLED">DISABLED (Strict Lock)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "MIGRATION" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" />
                  <span>Authorized Profile Migration</span>
                </div>
                Switching profile changes future default workflows, visible fields, and transaction rules. Historical invoices, payments, stock movements, and shifts remain permanently preserved and untouched.
              </div>

              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-[#131b2e]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500">Current Profile:</span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                    {activeProfile}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Target Profile:</span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                    {targetNewProfile}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Business Justification Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="profile-migration-reason"
                  rows={3}
                  value={migrationReason}
                  onChange={(e) => setMigrationReason(e.target.value)}
                  placeholder="e.g. Migrating to wholesale operations for B2B tax compliance..."
                  className="w-full p-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-[#131b2e] outline-none focus:ring-2 focus:ring-[#00288e]"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  id="execute-profile-switch-btn"
                  onClick={handleExecuteProfileSwitch}
                  disabled={!migrationReason.trim() || isSubmitting || !canManage}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Switch Profile to {targetNewProfile}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "HISTORY" && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Profile Change &amp; Migration Audit Trail
              </h4>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No historical profile changes recorded.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {history.map((entry, idx) => (
                    <div key={idx} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50/60 dark:bg-[#131b2e]/60">
                      <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 mb-1">
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">User: {entry.changed_by}</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold mb-1">
                        <span className="text-slate-500">{entry.old_profile || "(Initial Setup)"}</span>
                        <span>&rarr;</span>
                        <span className="text-blue-600 dark:text-blue-400">{entry.new_profile}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 italic text-[11px]">
                        "{entry.reason}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#c4c5d5] dark:border-[#444653] bg-slate-50 dark:bg-[#131b2e]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>

          {activeTab === "SETTINGS" && (
            <button
              type="button"
              id="save-billing-config-btn"
              onClick={handleSaveSettings}
              disabled={isSubmitting || !canManage}
              className="px-5 py-2 rounded-xl bg-[#00288e] hover:bg-[#001f70] text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <CheckCircle2 size={14} />
              <span>Save Configuration</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
