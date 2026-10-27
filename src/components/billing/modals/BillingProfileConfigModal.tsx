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
  const [policyScope, setPolicyScope] = useState<"COMPANY" | "BRANCH">("COMPANY");
  const [defaultSalesChannel, setDefaultSalesChannel] = useState<string>(
    effectiveConfig?.default_sales_channel || (activeProfile === "B2C_ONLY" ? "POS_RETAIL" : "B2B_WHOLESALE")
  );
  const [allowedSalesChannels, setAllowedSalesChannels] = useState<string[]>(
    effectiveConfig?.allowed_sales_channels || (activeProfile === "B2C_ONLY" ? ["POS_RETAIL", "ECOMMERCE"] : ["MODERN_TRADE", "GENERAL_TRADE", "B2B_WHOLESALE"])
  );
  const [defaultSourceType, setDefaultSourceType] = useState<string>(effectiveConfig?.default_source_type || "DIRECT");
  const [allowedSourceTypes, setAllowedSourceTypes] = useState<string[]>(
    effectiveConfig?.allowed_source_types || ["DIRECT", "CUSTOMER_PO", "SALES_ORDER", "PACKING_SLIP_CONSOLIDATED"]
  );
  const [defaultBillType, setDefaultBillType] = useState<string>(effectiveConfig?.default_bill_type || "Product");
  const [allowedBillTypes, setAllowedBillTypes] = useState<string[]>(effectiveConfig?.allowed_bill_types || ["Product", "Service"]);
  const [allowedTransactions, setAllowedTransactions] = useState<string[]>(
    effectiveConfig?.allowed_transactions || (activeProfile === "B2C_ONLY" ? ["CASH"] : ["CASH", "CREDIT"])
  );
  const [defaultTransaction, setDefaultTransaction] = useState<string>(
    effectiveConfig?.default_transaction || "CASH"
  );

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

  // ── Billing Price Level Policy State ─────────────────────────────────────
  const [defaultPriceLevel, setDefaultPriceLevel] = useState<string>(
    effectiveConfig?.default_price_level ||
      (activeProfile === "B2C_ONLY" ? "MRP" : "SELLING_PRICE")
  );
  const [cashierPriceOverride, setCashierPriceOverride] = useState<string>(
    effectiveConfig?.cashier_price_override ||
      (activeProfile === "B2C_ONLY" ? "DISABLED" : "ALLOWED")
  );

  const PRICE_LEVEL_META: Record<string, { label: string; hint: string }> = {
    MRP: {
      label: "MRP (Statutory Ceiling)",
      hint: "Bills at the Maximum Retail Price printed on the product. Cannot exceed MRP regardless of other settings.",
    },
    SELLING_PRICE: {
      label: "Standard Selling Price",
      hint: "Bills at the configured standard selling price for the item or price-book entry.",
    },
    WHOLESALE_PRICE: {
      label: "Wholesale Price",
      hint: "Bills at the wholesale price. Falls back to selling price if wholesale price is not configured for the item.",
    },
    PRICE_BOOK: {
      label: "Price Book (Customer Tier)",
      hint: "Resolves the price from the customer's assigned price tier and price book. Customer must have an active price assignment.",
    },
  };

  if (!isOpen) return null;

  // ── Save Configuration Overrides ─────────────────────────────────────────
  const handleSaveSettings = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        policy_scope: policyScope,
        default_sales_channel: defaultSalesChannel,
        allowed_sales_channels: allowedSalesChannels,
        default_source_type: defaultSourceType,
        allowed_source_types: allowedSourceTypes,
        default_bill_type: defaultBillType,
        allowed_bill_types: allowedBillTypes,
        allowed_transactions: allowedTransactions,
        default_transaction: defaultTransaction,
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
        // Price Level Governance
        default_price_level: defaultPriceLevel,
        cashier_price_override: cashierPriceOverride,
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

              <div className="p-3 border border-blue-200 dark:border-blue-900 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Transaction Defaults &amp; Eligibility</h4>
                    <p className="text-[11px] text-slate-500">Company policy is inherited by branches; branch values override it.</p>
                  </div>
                  <select
                    aria-label="Billing policy scope"
                    value={policyScope}
                    onChange={event => setPolicyScope(event.target.value as "COMPANY" | "BRANCH")}
                    disabled={!canManage}
                    className="px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-[#131b2e]"
                  >
                    <option value="COMPANY">Company</option>
                    <option value="BRANCH">Current Branch</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Default sales channel
                    <select
                      value={defaultSalesChannel}
                      onChange={event => setDefaultSalesChannel(event.target.value)}
                      disabled={!canManage}
                      className="mt-1 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-[#131b2e]"
                    >
                      {["MODERN_TRADE", "GENERAL_TRADE", "B2B_WHOLESALE", "POS_RETAIL", "ECOMMERCE"].map(channel => (
                        <option key={channel} value={channel}>{channel.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Default source
                    <select
                      value={defaultSourceType}
                      onChange={event => setDefaultSourceType(event.target.value)}
                      disabled={!canManage}
                      className="mt-1 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-[#131b2e]"
                    >
                      {["DIRECT", "CUSTOMER_PO", "SALES_ORDER", "PACKING_SLIP_CONSOLIDATED"].map(source => (
                        <option key={source} value={source}>{source.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Default bill type
                    <select
                      value={defaultBillType}
                      onChange={event => setDefaultBillType(event.target.value)}
                      disabled={!canManage}
                      className="mt-1 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-[#131b2e]"
                    >
                      {["Product", "Service"].map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Default billing mode
                    <select
                      value={defaultTransaction}
                      onChange={event => setDefaultTransaction(event.target.value)}
                      disabled={!canManage}
                      className="mt-1 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-[#131b2e]"
                    >
                      <option value="CASH">Cash</option>
                      <option value="CREDIT">Credit</option>
                    </select>
                  </label>
                </div>
                {!allowedTransactions.includes(defaultTransaction) && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300" role="status">
                    The configured default is not in the permitted modes. Billing will require an authorized explicit choice.
                  </p>
                )}
                {[
                  {
                    label: "Permitted channels",
                    values: ["MODERN_TRADE", "GENERAL_TRADE", "B2B_WHOLESALE", "POS_RETAIL", "ECOMMERCE"],
                    selected: allowedSalesChannels,
                    update: setAllowedSalesChannels,
                  },
                  {
                    label: "Permitted sources",
                    values: ["DIRECT", "CUSTOMER_PO", "SALES_ORDER", "PACKING_SLIP_CONSOLIDATED"],
                    selected: allowedSourceTypes,
                    update: setAllowedSourceTypes,
                  },
                  {
                    label: "Permitted bill types",
                    values: ["Product", "Service"],
                    selected: allowedBillTypes,
                    update: setAllowedBillTypes,
                  },
                  {
                    label: "Permitted transaction modes",
                    values: ["CASH", "CREDIT"],
                    selected: allowedTransactions,
                    update: setAllowedTransactions,
                  },
                ].map(group => (
                  <fieldset key={group.label} className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
                    <legend className="w-full font-semibold text-slate-600 dark:text-slate-300">{group.label}</legend>
                    {group.values.map(value => (
                      <label key={value} className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={group.selected.includes(value)}
                          disabled={!canManage}
                          onChange={event => group.update(current => event.target.checked
                            ? [...current, value]
                            : current.filter(item => item !== value))}
                        />
                        {value.replaceAll("_", " ")}
                      </label>
                    ))}
                  </fieldset>
                ))}
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

                {/* 12. Billing Price Level Policy */}
                <div className="p-3 border border-indigo-200 dark:border-indigo-900/60 rounded-xl space-y-3 bg-indigo-50/40 dark:bg-indigo-950/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>💰</span> Billing Price Level Policy
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Governs which stored price field is used as the default unit rate when adding items.
                        Precedence: Company Policy → Customer Profile (pricing_basis) → Cashier Override.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Company Default Price Level */}
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Company default price level
                      <select
                        id="config-default-price-level-select"
                        value={defaultPriceLevel}
                        onChange={(e) => setDefaultPriceLevel(e.target.value)}
                        disabled={!canManage}
                        className="mt-1 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-[#131b2e]"
                      >
                        <option value="MRP">MRP — Statutory Ceiling</option>
                        <option value="SELLING_PRICE">SELLING_PRICE — Standard Rate</option>
                        <option value="WHOLESALE_PRICE">WHOLESALE_PRICE — Trade Rate</option>
                        <option value="PRICE_BOOK">PRICE_BOOK — Customer Tier / Price Book</option>
                      </select>
                    </label>

                    {/* Cashier Override Permission */}
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Cashier price override
                      <select
                        id="config-cashier-price-override-select"
                        value={cashierPriceOverride}
                        onChange={(e) => setCashierPriceOverride(e.target.value)}
                        disabled={!canManage}
                        className="mt-1 w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-[#131b2e]"
                      >
                        <option value="DISABLED">DISABLED — Fixed rate, no override</option>
                        <option value="ALLOWED">ALLOWED — Any operator can change rate</option>
                        <option value="AUTHORIZED_ONLY">AUTHORIZED_ONLY — Manager approval required</option>
                      </select>
                    </label>
                  </div>

                  {/* Effective level explanation card */}
                  {PRICE_LEVEL_META[defaultPriceLevel] && (
                    <div className="mt-1 p-2 rounded-lg bg-white dark:bg-[#131b2e] border border-indigo-200 dark:border-indigo-800/50 text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">{PRICE_LEVEL_META[defaultPriceLevel].label}:</span>{" "}
                      {PRICE_LEVEL_META[defaultPriceLevel].hint}
                    </div>
                  )}

                  {cashierPriceOverride !== "DISABLED" && (
                    <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-700 dark:text-amber-300">
                      <span className="mt-0.5">⚠</span>
                      <span>
                        {cashierPriceOverride === "AUTHORIZED_ONLY"
                          ? "Rate changes require manager/admin authorization. The cashier must obtain approval before overriding the price level."
                          : "Operators can freely change the billing rate. Customer price_basis and company policy serve as defaults only."}
                        {" "}Individual customers can still be assigned a specific pricing basis (MRP / RATE) in Customer Master.
                      </span>
                    </div>
                  )}
                </div>

                {/* 13. Quantity Editing Permission */}
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
