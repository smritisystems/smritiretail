/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.63.0
 * Created      : 2026-08-25
 * Modified     : 2026-08-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import {
  Sliders,
  ShoppingCart,
  Tag,
  Truck,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Save,
  RefreshCw,
  Sparkles,
  Lock,
  ArrowRight
} from "lucide-react";

interface PolicyDefinition {
  id: string;
  code: string;
  version: number;
  name: string;
  policy_type: string;
  parameters: Record<string, any>;
  is_active: boolean;
  status: string;
}

export const StorePolicyStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"billing" | "barcode" | "inwards" | "credit">("billing");
  const [policies, setPolicies] = useState<Record<string, PolicyDefinition>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live Cost Price Mask Preview state
  const [previewCost, setPreviewCost] = useState<number>(450.0);
  const [previewEncoded, setPreviewEncoded] = useState<string>("EFA");

  // Fetch all policies
  const loadPolicies = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetchV1("/api/v1/governed-logic/policies");
      if (Array.isArray(res)) {
        const map: Record<string, PolicyDefinition> = {};
        res.forEach((p: PolicyDefinition) => {
          map[p.code] = p;
        });
        setPolicies(map);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load store policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  // Update policy parameter in local state
  const handleParamChange = (policyCode: string, paramKey: string, value: any) => {
    setPolicies(prev => {
      const current = prev[policyCode];
      if (!current) return prev;
      return {
        ...prev,
        [policyCode]: {
          ...current,
          parameters: {
            ...current.parameters,
            [paramKey]: value
          }
        }
      };
    });
  };

  // Update cipher map character
  const handleCipherCharChange = (digit: string, char: string) => {
    const policy = policies["POLICY_BARCODE_COST_MASK"];
    const currentMap = policy?.parameters?.encoding_map || {};
    const updatedMap = { ...currentMap, [digit]: char.toUpperCase() };
    handleParamChange("POLICY_BARCODE_COST_MASK", "encoding_map", updatedMap);
  };

  // Live preview test
  useEffect(() => {
    const policy = policies["POLICY_BARCODE_COST_MASK"];
    const encodingMap = policy?.parameters?.encoding_map || {
      "0": "A", "1": "B", "2": "C", "3": "D", "4": "E",
      "5": "F", "6": "G", "7": "H", "8": "I", "9": "J"
    };
    const numStr = Math.floor(previewCost).toString();
    const encoded = numStr.split("").map((d: string) => encodingMap[d] || d).join("");
    setPreviewEncoded(encoded);
  }, [previewCost, policies]);

  // Save policy updates to backend
  const handleSavePolicy = async (policyCode: string) => {
    const policy = policies[policyCode];
    if (!policy) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiFetchV1(`/api/v1/governed-logic/policies/${policyCode}`, {
        method: "PUT",
        body: JSON.stringify({
          name: policy.name,
          parameters: policy.parameters,
          status: policy.status
        })
      });
      setSuccessMsg(`Policy '${policy.name}' successfully synchronized.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to update policy ${policyCode}`);
    } finally {
      setSaving(false);
    }
  };

  const billingPol = policies["POLICY_BILLING_CONTROLS"]?.parameters || {};
  const barcodePol = policies["POLICY_BARCODE_COST_MASK"]?.parameters || {};
  const inwardsPol = policies["POLICY_INWARDS_PROCUREMENT"]?.parameters || {};
  const creditPol = policies["POLICY_CREDIT_MANAGEMENT"]?.parameters || {};

  const cipherMap = barcodePol.encoding_map || {
    "0": "A", "1": "B", "2": "C", "3": "D", "4": "E",
    "5": "F", "6": "G", "7": "H", "8": "I", "9": "J"
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="bg-theme-surface-1 p-6 rounded-2xl border border-theme-divider flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-primary-500" />
            <h2 className="font-display font-bold text-xl text-theme-body">Retail Store Governance Policy Studio</h2>
          </div>
          <p className="text-xs text-theme-muted">
            Configure authoritative store parameters, POS checkout behavior, barcode mask encoding, and credit hold policies evaluated via Dynamic AST.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPolicies}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-theme-surface-2 hover:bg-theme-surface-3 text-theme-body border border-theme-divider transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <span className="text-xs bg-emerald-500 bg-opacity-20 text-emerald-500 font-mono font-bold px-2.5 py-1 rounded border border-emerald-500/30">
            AST GOVERNED
          </span>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-3">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-theme-divider pb-2">
        <button
          onClick={() => setActiveTab("billing")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
            activeTab === "billing"
              ? "bg-primary-500 text-white border-primary-500 shadow-sm"
              : "bg-theme-surface-1 text-theme-muted hover:text-theme-body border-theme-divider"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          POS Billing & Returns
        </button>

        <button
          onClick={() => setActiveTab("barcode")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
            activeTab === "barcode"
              ? "bg-primary-500 text-white border-primary-500 shadow-sm"
              : "bg-theme-surface-1 text-theme-muted hover:text-theme-body border-theme-divider"
          }`}
        >
          <Tag className="w-4 h-4" />
          Hang-Tag Cost Price Cipher
        </button>

        <button
          onClick={() => setActiveTab("inwards")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
            activeTab === "inwards"
              ? "bg-primary-500 text-white border-primary-500 shadow-sm"
              : "bg-theme-surface-1 text-theme-muted hover:text-theme-body border-theme-divider"
          }`}
        >
          <Truck className="w-4 h-4" />
          GRN & Inward Procurement
        </button>

        <button
          onClick={() => setActiveTab("credit")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
            activeTab === "credit"
              ? "bg-primary-500 text-white border-primary-500 shadow-sm"
              : "bg-theme-surface-1 text-theme-muted hover:text-theme-body border-theme-divider"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Credit Limits & Ledger Hold
        </button>
      </div>

      {/* Tab 1: Billing & Returns Policy */}
      {activeTab === "billing" && (
        <div className="bg-theme-surface-1 p-6 rounded-2xl border border-theme-divider space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-display font-semibold text-base text-theme-body">POS Checkout & Return Controls</h3>
              <p className="text-xs text-theme-muted mt-1">
                Configure terminal cashier restrictions, unreferenced return rate overrides, and inventory checkout checks.
              </p>
            </div>
            <button
              onClick={() => handleSavePolicy("POLICY_BILLING_CONTROLS")}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Billing Policy"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Allow Scanning with Recall */}
            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <label className="text-xs font-semibold text-theme-body block">Continuous Barcode Scanning on Recalled Bill</label>
                <p className="text-xs text-theme-muted">
                  Allow cashiers to scan new items immediately when recalling a suspended/parked transaction.
                </p>
              </div>
              <input
                type="checkbox"
                checked={billingPol.allow_item_scanning_with_recalling ?? true}
                onChange={e => handleParamChange("POLICY_BILLING_CONTROLS", "allow_item_scanning_with_recalling", e.target.checked)}
                className="w-5 h-5 accent-primary-500 rounded cursor-pointer"
              />
            </div>

            {/* Quantity Only Mode */}
            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <label className="text-xs font-semibold text-theme-body block">Quantity-Only Editing Mode</label>
                <p className="text-xs text-theme-muted">
                  Lock price and line-item discount inputs in POS; cashiers can only edit quantities.
                </p>
              </div>
              <input
                type="checkbox"
                checked={billingPol.enable_qty_only_editing ?? false}
                onChange={e => handleParamChange("POLICY_BILLING_CONTROLS", "enable_qty_only_editing", e.target.checked)}
                className="w-5 h-5 accent-primary-500 rounded cursor-pointer"
              />
            </div>

            {/* Return Rate Alteration */}
            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <label className="text-xs font-semibold text-theme-body block">Allow Rate Alteration on Returns Without Invoice</label>
                <p className="text-xs text-theme-muted">
                  Permit store supervisors to adjust return credit note rates for unreferenced walk-in returns.
                </p>
              </div>
              <input
                type="checkbox"
                checked={billingPol.allow_rate_alteration_sales_return_wor ?? true}
                onChange={e => handleParamChange("POLICY_BILLING_CONTROLS", "allow_rate_alteration_sales_return_wor", e.target.checked)}
                className="w-5 h-5 accent-primary-500 rounded cursor-pointer"
              />
            </div>

            {/* Strict Stock Check */}
            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <label className="text-xs font-semibold text-theme-body block">Enforce Strict Stock Boundary Check</label>
                <p className="text-xs text-theme-muted">
                  Prevent billing items when on-hand inventory is 0 unless authorized by Store Manager.
                </p>
              </div>
              <input
                type="checkbox"
                checked={billingPol.enforce_strict_stock_check ?? true}
                onChange={e => handleParamChange("POLICY_BILLING_CONTROLS", "enforce_strict_stock_check", e.target.checked)}
                className="w-5 h-5 accent-primary-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Barcode Tag Cost Price Cipher */}
      {activeTab === "barcode" && (
        <div className="bg-theme-surface-1 p-6 rounded-2xl border border-theme-divider space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-display font-semibold text-base text-theme-body">Apparel Hang-Tag Cost Price Cipher</h3>
              <p className="text-xs text-theme-muted mt-1">
                Obfuscate wholesale cost price printed on garment price tags to enable salesman floor negotiations.
              </p>
            </div>
            <button
              onClick={() => handleSavePolicy("POLICY_BARCODE_COST_MASK")}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Cipher Map"}
            </button>
          </div>

          {/* Cipher Grid */}
          <div className="p-5 bg-theme-surface-2 rounded-xl border border-theme-divider space-y-3">
            <h4 className="text-xs font-semibold text-theme-body">Digit-to-Alphabet Substitution Matrix (0–9)</h4>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(digit => (
                <div key={digit} className="bg-theme-surface-1 p-2.5 rounded-lg border border-theme-divider text-center space-y-1">
                  <span className="text-xs font-mono font-bold text-theme-muted">{digit}</span>
                  <input
                    type="text"
                    maxLength={1}
                    value={cipherMap[digit] || ""}
                    onChange={e => handleCipherCharChange(digit, e.target.value)}
                    className="w-full text-center font-mono font-bold text-sm bg-theme-surface-2 border border-theme-divider rounded py-1 text-theme-body uppercase focus:outline-none focus:border-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Live Tag Preview Calculator */}
          <div className="p-5 bg-primary-500/5 rounded-xl border border-primary-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-500" />
                <h4 className="text-xs font-bold text-theme-body">Live Hang-Tag Encoding Simulator</h4>
              </div>
              <p className="text-xs text-theme-muted">
                Enter an actual cost price to simulate real-time thermal barcode label generation.
              </p>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="space-y-1">
                <label className="text-xs text-theme-muted">Numeric Cost (₹)</label>
                <input
                  type="number"
                  value={previewCost}
                  onChange={e => setPreviewCost(parseFloat(e.target.value) || 0)}
                  className="w-32 px-3 py-1.5 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs font-mono text-theme-body focus:outline-none"
                />
              </div>

              <ArrowRight className="w-5 h-5 text-theme-muted flex-shrink-0 mt-4" />

              <div className="space-y-1">
                <label className="text-xs text-theme-muted">Printed Tag Code</label>
                <div className="px-4 py-1.5 bg-theme-surface-1 border border-primary-500/40 rounded-lg text-xs font-mono font-extrabold text-primary-400">
                  {previewEncoded}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: GRN & Inwards Procurement Policy */}
      {activeTab === "inwards" && (
        <div className="bg-theme-surface-1 p-6 rounded-2xl border border-theme-divider space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-display font-semibold text-base text-theme-body">GRN & Inward Procurement Governance</h3>
              <p className="text-xs text-theme-muted mt-1">
                Control vendor delivery note quantities, automated purchase tax calculations, and logistics transporter audit.
              </p>
            </div>
            <button
              onClick={() => handleSavePolicy("POLICY_INWARDS_PROCUREMENT")}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Inward Policy"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <label className="text-xs font-semibold text-theme-body block">Auto Calculate Purchase Tax on Predefined Rates</label>
                <p className="text-xs text-theme-muted">
                  Automatically derive CGST/SGST/IGST input tax credit based on catalog HSN slabs on GRN receipt.
                </p>
              </div>
              <input
                type="checkbox"
                checked={inwardsPol.auto_calculate_purchase_tax ?? true}
                onChange={e => handleParamChange("POLICY_INWARDS_PROCUREMENT", "auto_calculate_purchase_tax", e.target.checked)}
                className="w-5 h-5 accent-primary-500 rounded cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <label className="text-xs font-semibold text-theme-body block">Mandatory Transporter Details Capture</label>
                <p className="text-xs text-theme-muted">
                  Require vehicle number, transporter ID, and LR docket number on inward stock dispatches.
                </p>
              </div>
              <input
                type="checkbox"
                checked={inwardsPol.capture_transporter_details ?? true}
                onChange={e => handleParamChange("POLICY_INWARDS_PROCUREMENT", "capture_transporter_details", e.target.checked)}
                className="w-5 h-5 accent-primary-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Credit Management Policy */}
      {activeTab === "credit" && (
        <div className="bg-theme-surface-1 p-6 rounded-2xl border border-theme-divider space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-display font-semibold text-base text-theme-body">Customer Credit Limits & Hold Policy</h3>
              <p className="text-xs text-theme-muted mt-1">
                Protect store liquidity by locking POS billing when customer ledger balance exceeds authorized thresholds.
              </p>
            </div>
            <button
              onClick={() => handleSavePolicy("POLICY_CREDIT_MANAGEMENT")}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Credit Policy"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <label className="text-xs font-semibold text-theme-body block">Enforce Credit Limit Stop-Billing</label>
                <p className="text-xs text-theme-muted">
                  Immediately halt POS invoicing if customer outstanding balance exceeds approved credit ceiling.
                </p>
              </div>
              <input
                type="checkbox"
                checked={creditPol.enforce_credit_limit_stop_billing ?? true}
                onChange={e => handleParamChange("POLICY_CREDIT_MANAGEMENT", "enforce_credit_limit_stop_billing", e.target.checked)}
                className="w-5 h-5 accent-primary-500 rounded cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <label className="text-xs font-semibold text-theme-body block">Store Manager PIN Override Allowed</label>
                <p className="text-xs text-theme-muted">
                  Permit store supervisors to unlock a one-time transaction with PIN sign-off.
                </p>
              </div>
              <input
                type="checkbox"
                checked={creditPol.allow_manager_override_credit_limit ?? true}
                onChange={e => handleParamChange("POLICY_CREDIT_MANAGEMENT", "allow_manager_override_credit_limit", e.target.checked)}
                className="w-5 h-5 accent-primary-500 rounded cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider flex items-center justify-between col-span-1 md:col-span-2">
              <div className="space-y-1 pr-4">
                <label className="text-xs font-semibold text-theme-body block">Default Credit Grace Period (Days)</label>
                <p className="text-xs text-theme-muted">
                  Number of days before an outstanding invoice triggers an automated overdue flag.
                </p>
              </div>
              <input
                type="number"
                value={creditPol.default_credit_period_days ?? 30}
                onChange={e => handleParamChange("POLICY_CREDIT_MANAGEMENT", "default_credit_period_days", parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs font-mono text-theme-body text-center focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
