/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Spec         : §29–§32 — Guided / Custom / Advanced policy config UI.
 * SMRITI Rule: Normal users never see technical System Parameter codes.
 * Template diff must be shown before applying (compare-and-confirm).
 */

import React, { useEffect, useState } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Mode = "guided" | "custom" | "advanced";

interface PolicyOption { value: string; label: string; }
interface PolicyConfig {
  what_products_should_buyers_see: string;
  cross_vendor_product_policy: string;
  unassigned_product_policy: string;
  restricted_product_policy: string;
  show_vendor_status_to_buyer: boolean;
  show_explanation_for_restrictions: boolean;
  require_approval_reason: boolean;
  audit_approval_decisions: boolean;
  business_template?: string;
  canonical_params?: Record<string, string>;
}
interface Template { template_code: string; template_name: string; description: string; preview: PolicyConfig; }

// ─────────────────────────────────────────────────────────────────────────────
// Guided choices → template mapping (§29)
// ─────────────────────────────────────────────────────────────────────────────
const GUIDED_OPTIONS = [
  { id: "assigned_only",   label: "Mostly from assigned vendors",      template: "CONTROLLED_PURCHASING" },
  { id: "open",            label: "Buyers can purchase from any vendor", template: "OPEN_PURCHASING" },
  { id: "tight_control",   label: "Purchases require tighter control",  template: "ENTERPRISE_STRICT" },
];

const VISIBILITY_OPTIONS: PolicyOption[] = [
  { value: "assigned_only",      label: "Assigned products only" },
  { value: "assigned_first",     label: "Assigned first, others available" },
  { value: "all",                label: "Show all products" },
];

const ACTION_OPTIONS: PolicyOption[] = [
  { value: "ALLOW",              label: "Allow" },
  { value: "APPROVAL_REQUIRED",  label: "Require Approval" },
  { value: "READ_ONLY",          label: "Allow (view only)" },
  { value: "BLOCK",              label: "Block" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  isAdvancedUser?: boolean;
}

export const POPurchasingPolicyConfig: React.FC<Props> = ({
  isOpen, onClose, readOnly = false, isAdvancedUser = false,
}) => {
  const [mode, setMode] = useState<Mode>("guided");
  const [guidedChoice, setGuidedChoice] = useState("");
  const [config, setConfig] = useState<Partial<PolicyConfig>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [diffPreview, setDiffPreview] = useState<{ key: string; from: string; to: string }[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    // Load current policy
    apiFetchV1("/purchase/purchasing-policy")
      .then((d: any) => setConfig(d || {}))
      .catch(() => {});
    // Load templates
    apiFetchV1("/purchase/purchasing-policy/templates")
      .then((d: any) => { if (Array.isArray(d)) setTemplates(d); })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGuidedApply = async () => {
    const chosen = GUIDED_OPTIONS.find(o => o.id === guidedChoice);
    if (!chosen) return;
    const tmpl = templates.find(t => t.template_code === chosen.template);
    if (tmpl) {
      setSelectedTemplate(tmpl.template_code);
      buildDiff(tmpl.preview);
      setShowDiff(true);
    }
  };

  const buildDiff = (preview: PolicyConfig) => {
    const diffs: { key: string; from: string; to: string }[] = [];
    const keys: (keyof PolicyConfig)[] = [
      "cross_vendor_product_policy", "unassigned_product_policy",
      "restricted_product_policy", "what_products_should_buyers_see",
    ];
    for (const k of keys) {
      const cur = String(config[k] ?? "");
      const nxt = String(preview[k] ?? "");
      if (cur !== nxt) diffs.push({ key: k.replace(/_/g, " "), from: cur, to: nxt });
    }
    setDiffPreview(diffs);
  };

  const handleApplyTemplate = async () => {
    setSaving(true);
    try {
      await apiFetchV1("/purchase/purchasing-policy/apply", {
        method: "POST",
        body: JSON.stringify({
          template_code: selectedTemplate,
          confirmed: true,
          applied_by: "current_user",
        }),
      });
      setSaveMsg("Policy updated successfully.");
      setShowDiff(false);
    } catch {
      setSaveMsg("Unable to apply policy. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCustomSave = async () => {
    setSaving(true);
    try {
      await apiFetchV1("/purchase/purchasing-policy/apply", {
        method: "POST",
        body: JSON.stringify({
          custom_values: config,
          confirmed: true,
          applied_by: "current_user",
        }),
      });
      setSaveMsg("Purchasing rules saved.");
    } catch {
      setSaveMsg("Unable to save rules. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const SelectRow = ({ label, field, options }: { label: string; field: keyof PolicyConfig; options: PolicyOption[] }) => (
    <div className="grid grid-cols-12 gap-2 items-center mb-2">
      <label className="col-span-5 text-xs text-[#434652] font-medium">{label}</label>
      <select
        value={String(config[field] ?? "")}
        onChange={e => setConfig(c => ({ ...c, [field]: e.target.value }))}
        disabled={readOnly}
        className="col-span-7 border border-[#c4c6d4] rounded px-2 h-6 text-xs bg-white outline-none focus:ring-1 focus:ring-[#00296d] disabled:bg-[#f4f3f9] disabled:text-[#737685]"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="po-ppc-title">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 border border-[#c4c6d4] overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-[#f4f3ff] border-b border-[#c4c6d4] px-5 py-3 flex items-center justify-between shrink-0">
          <h2 id="po-ppc-title" className="text-sm font-bold text-[#00296d]">Purchasing Rules</h2>
          <div className="flex items-center gap-1">
            {(["guided", "custom", ...(isAdvancedUser ? ["advanced"] : [])] as Mode[]).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={"px-3 py-1 rounded text-[11px] font-bold transition-colors capitalize " + (mode === m ? "bg-[#00296d] text-white" : "text-[#5d6270] hover:bg-[#eeedf3]")}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Mode: Guided (§29) */}
          {mode === "guided" && !showDiff && (
            <div>
              <p className="text-xs text-[#434652] mb-3 font-medium">
                How should your buyers purchase products?
              </p>
              <div className="flex flex-col gap-2">
                {GUIDED_OPTIONS.map(o => (
                  <label key={o.id}
                    className={"flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors text-xs " + (guidedChoice === o.id ? "border-[#00296d] bg-[#e8eeff] text-[#00296d] font-semibold" : "border-[#c4c6d4] hover:bg-[#faf9ff] text-[#434652]")}>
                    <input type="radio" name="po-guided-choice" value={o.id}
                      checked={guidedChoice === o.id}
                      onChange={() => setGuidedChoice(o.id)} className="accent-[#00296d]" />
                    {o.label}
                  </label>
                ))}
              </div>
              {!readOnly && (
                <button type="button" onClick={handleGuidedApply} disabled={!guidedChoice}
                  className="mt-4 px-5 py-2 rounded-lg bg-[#00296d] text-white text-xs font-bold disabled:opacity-40 hover:bg-[#003d9e] transition-colors">
                  Continue
                </button>
              )}
            </div>
          )}

          {/* Diff preview (§32) */}
          {mode === "guided" && showDiff && (
            <div>
              <p className="text-xs font-semibold text-[#434652] mb-3">
                {diffPreview.length === 0
                  ? "No changes required — current settings already match this template."
                  : diffPreview.length + " setting" + (diffPreview.length !== 1 ? "s" : "") + " will change:"
                }
              </p>
              {diffPreview.length > 0 && (
                <div className="border border-[#c4c6d4] rounded-lg overflow-hidden mb-3">
                  <div className="grid grid-cols-3 gap-0 text-[10px] font-bold uppercase text-[#737685] bg-[#eeedf3] px-3 py-1.5 border-b border-[#c4c6d4]">
                    <span>Setting</span><span>Current</span><span>New</span>
                  </div>
                  {diffPreview.map(d => (
                    <div key={d.key} className="grid grid-cols-3 gap-0 text-xs px-3 py-2 border-b border-[#eeedf3] last:border-0">
                      <span className="text-[#434652] font-medium capitalize">{d.key}</span>
                      <span className="text-red-700 line-through">{d.from || "—"}</span>
                      <span className="text-green-700 font-semibold">{d.to}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowDiff(false)}
                  className="px-4 py-1.5 rounded border border-[#c4c6d4] text-xs font-semibold text-[#434652] hover:bg-[#eeedf3]">
                  Cancel
                </button>
                <button type="button" onClick={handleApplyTemplate} disabled={saving}
                  className="px-5 py-1.5 rounded bg-[#00296d] text-white text-xs font-bold hover:bg-[#003d9e] disabled:opacity-50">
                  {saving ? "Applying…" : "Apply Template"}
                </button>
              </div>
            </div>
          )}

          {/* Mode: Custom (§30) */}
          {mode === "custom" && (
            <div>
              <p className="text-xs text-[#5d6270] mb-3">Customise each rule using business language.</p>
              <SelectRow label="Products shown to buyers" field="what_products_should_buyers_see" options={VISIBILITY_OPTIONS} />
              <SelectRow label="Other vendor products" field="cross_vendor_product_policy" options={ACTION_OPTIONS} />
              <SelectRow label="Unassigned products" field="unassigned_product_policy" options={ACTION_OPTIONS} />
              <SelectRow label="Restricted products" field="restricted_product_policy" options={ACTION_OPTIONS} />
              <div className="mt-3 flex flex-col gap-1.5">
                {([
                  ["show_vendor_status_to_buyer",          "Show vendor status to buyers"],
                  ["show_explanation_for_restrictions",    "Show explanation for restrictions"],
                  ["require_approval_reason",              "Require approval reason from buyer"],
                  ["audit_approval_decisions",             "Audit all approval decisions"],
                ] as [keyof PolicyConfig, string][]).map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-xs text-[#434652] cursor-pointer">
                    <input type="checkbox" checked={Boolean(config[field])}
                      onChange={e => setConfig(c => ({ ...c, [field]: e.target.checked }))}
                      disabled={readOnly} className="accent-[#00296d]" />
                    {label}
                  </label>
                ))}
              </div>
              {!readOnly && (
                <button type="button" onClick={handleCustomSave} disabled={saving}
                  className="mt-4 px-5 py-2 rounded-lg bg-[#00296d] text-white text-xs font-bold hover:bg-[#003d9e] disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          )}

          {/* Mode: Advanced (§31 — SYSADMIN only) */}
          {mode === "advanced" && isAdvancedUser && (
            <div>
              <p className="text-xs text-amber-700 font-semibold mb-2 border border-amber-200 bg-amber-50 px-3 py-2 rounded">
                Advanced mode — canonical parameter keys are visible here for system administrators only.
              </p>
              {config.canonical_params && (
                <div className="font-mono text-xs border border-[#c4c6d4] rounded overflow-auto max-h-64">
                  {Object.entries(config.canonical_params).map(([k, v]) => (
                    <div key={k} className="flex gap-0 border-b border-[#eeedf3] last:border-0">
                      <span className="px-3 py-1.5 text-[#00296d] bg-[#f4f3ff] border-r border-[#eeedf3] w-3/5 truncate">{k}</span>
                      <span className="px-3 py-1.5 text-[#1a1b20] font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {saveMsg && (
            <div className="mt-3 text-xs text-green-700 font-semibold border border-green-200 bg-green-50 px-3 py-2 rounded">
              {saveMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#f4f3ff] border-t border-[#c4c6d4] flex justify-end shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded border border-[#c4c6d4] text-xs font-semibold text-[#434652] hover:bg-[#eeedf3]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default POPurchasingPolicyConfig;
