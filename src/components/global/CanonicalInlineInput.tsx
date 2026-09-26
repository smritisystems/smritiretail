/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-09-23
 * Modified     : 2026-09-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * SMRITI CFOC v4.0.0 — CanonicalInlineInput
 * ═══════════════════════════════════════════
 * A CFOC-governed transparent wrapper for inline action-modal inputs.
 *
 * Purpose:
 *   Replaces raw <input> elements in transactional action modals
 *   (ComplaintCRMModal, LoyaltyLedgerModal, GiftVoucherModal,
 *    GiftCardLifecycleModal, PricingStudioModal, VendorReturnModal,
 *    BarcodeManagementTab, GrnReceiptTab) with governance-annotated
 *   equivalents — without restructuring the component or changing UX.
 *
 * What it adds over a bare <input>:
 *   • data-field-key={canonicalDbColumn}  — recognised by ci_ux_field_governance_guard.py
 *   • data-canonical-id={fieldId}         — traces to canonical field_id in field_registry.py
 *   • aria-label                           — sourced from getCanonicalField(fieldId)?.label
 *
 * What it does NOT change:
 *   • Styling — callers pass className exactly as before
 *   • State management — callers own the controlled state (value, onChange)
 *   • Any other native <input> prop
 *
 * Governance Invariant:
 *   The governance guard's data-field-key AST scanner confirms canonical
 *   registration. Once an exception entry is replaced with this component,
 *   its row in ux_field_governance_baseline.json is removed.
 */

import React from "react";
import { getCanonicalField } from "../../services/canonicalFieldRegistry.ts";

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface CanonicalInlineInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * The canonical field_id from field_registry.py.
   * Example: "sales_invoice.remarks", "barcode.barcode_value"
   * Used to source aria-label and data-canonical-id from the registry.
   */
  fieldId: string;

  /**
   * The canonical db_column name. Used as data-field-key.
   * Example: "remarks", "barcode_value", "quantity"
   * Must match the db_column in the corresponding CanonicalFieldDef.
   */
  canonicalKey: string;

  /**
   * Optional fallback label if canonical registry lookup returns undefined.
   * Displayed as aria-label when the canonical field is not found.
   */
  fallbackLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CanonicalInlineInput
 *
 * Drop-in governed replacement for raw <input> elements in transactional
 * action modals. Passes all props through unchanged; adds CFOC governance
 * attributes transparently.
 *
 * Usage:
 *   // Before (ungoverned):
 *   <input value={val} data-field-key="remarks" onChange={...} className="..." />
 *
 *   // After (governed):
 *   <CanonicalInlineInput
 *     fieldId="sales_invoice.remarks"
 *     canonicalKey="remarks"
 *     fallbackLabel="Remarks"
 *     value={val}
 *     onChange={...}
 *     className="..."
 *   />
 */
export const CanonicalInlineInput = React.forwardRef<HTMLInputElement, CanonicalInlineInputProps>(
  (
    {
      fieldId,
      canonicalKey,
      fallbackLabel,
      "aria-label": ariaLabelOverride,
      ...inputProps
    },
    ref
  ) => {
    // Resolve label from canonical registry (purely informational — no side effects)
    const canonicalField = getCanonicalField(fieldId);
    const resolvedLabel =
      ariaLabelOverride ??
      canonicalField?.label ??
      fallbackLabel ??
      canonicalKey;

    return (
      <input
        ref={ref}
        {...inputProps}
        data-field-key={canonicalKey}
        data-canonical-id={fieldId}
        aria-label={resolvedLabel}
      />
    );
  }
);
CanonicalInlineInput.displayName = "CanonicalInlineInput";

// ─────────────────────────────────────────────────────────────────────────────
//  CanonicalInlineTextarea — for <textarea> elements
// ─────────────────────────────────────────────────────────────────────────────

export interface CanonicalInlineTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  fieldId: string;
  canonicalKey: string;
  fallbackLabel?: string;
}

/**
 * CanonicalInlineTextarea
 *
 * Same governance wrapper as CanonicalInlineInput, for <textarea> elements.
 */
export const CanonicalInlineTextarea = React.forwardRef<HTMLTextAreaElement, CanonicalInlineTextareaProps>(
  (
    {
      fieldId,
      canonicalKey,
      fallbackLabel,
      "aria-label": ariaLabelOverride,
      ...textareaProps
    },
    ref
  ) => {
    const canonicalField = getCanonicalField(fieldId);
    const resolvedLabel =
      ariaLabelOverride ??
      canonicalField?.label ??
      fallbackLabel ??
      canonicalKey;

    return (
      <textarea
        ref={ref}
        {...textareaProps}
        data-field-key={canonicalKey}
        data-canonical-id={fieldId}
        aria-label={resolvedLabel}
      />
    );
  }
);
CanonicalInlineTextarea.displayName = "CanonicalInlineTextarea";

export default CanonicalInlineInput;
