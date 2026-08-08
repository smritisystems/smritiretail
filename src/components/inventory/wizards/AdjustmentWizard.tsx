/**
 * Project      : SMRITI Retail OS
 * Module       : Inventory Studio — Stock Adjustment Wizard (2-Step)
 * Standard     : SXP Constitution v1.0 / SWEF P-007
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Adjustment flow:
 *   Step 1: Search / scan item → show current stock position
 *   Step 2: Enter adjustment quantity + reason → payload ready for execute()
 *
 * RULE: Zero kernel calls here. Payload flows to manifest execute()
 *       which calls StockLedgerService.applyMovement({ type: 'in'|'out', … }).
 */

import React, { useState, useId } from "react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdjustmentReason =
  | "damaged"
  | "expired"
  | "count_correction"
  | "theft"
  | "supplier_return"
  | "other";

export const ADJUSTMENT_REASONS: Record<AdjustmentReason, string> = {
  damaged:          "Damaged",
  expired:          "Expired",
  count_correction: "Count Correction",
  theft:            "Theft / Shrinkage",
  supplier_return:  "Supplier Return",
  other:            "Other",
};

export interface AdjustmentPayload {
  itemId: string;
  itemName: string;
  currentQty: number;
  adjustmentQty: number;     // positive = add, negative = remove
  reason: AdjustmentReason;
  batchNumber?: string;
  expiryDate?: string;
  binLocation?: string;
  notes?: string;
  warehouseId?: string;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--sxp-space-2, 8px)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--sxp-text-xs, 11px)",
  fontWeight: 600,
  color: "var(--sxp-text-secondary, #94a3b8)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  padding: "var(--sxp-space-2, 8px) var(--sxp-space-3, 12px)",
  borderRadius: "var(--sxp-radius-md, 8px)",
  border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
  background: "var(--sxp-surface-3, #2B3242)",
  color: "var(--sxp-text-primary, #e2e8f0)",
  fontSize: "var(--sxp-text-base, 14px)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

// ── Step 1: Find item ─────────────────────────────────────────────────────────

export interface AdjStep1Props {
  payload: Partial<AdjustmentPayload>;
  onChange(patch: Partial<AdjustmentPayload>): void;
}

export const AdjStep1: React.FC<AdjStep1Props> = ({ payload, onChange }) => {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchId = useId();

  const lookupItem = async (query: string) => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await apiFetchV1<{
        itemId: string;
        name: string;
        onHand: number;
        reserved: number;
        available: number;
      }>(`/api/v1/inventory/item-by-barcode?barcode=${encodeURIComponent(query)}`);
      onChange({
        itemId: result.itemId,
        itemName: result.name,
        currentQty: result.available,
      });
    } catch {
      setError("Item not found. Try scanning the barcode or entering the SKU.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sxp-space-5, 20px)" }}>
      <div style={fieldStyle}>
        <label htmlFor={searchId} style={labelStyle}>Scan Barcode or Enter SKU</label>
        <input
          id={searchId}
          type="text"
          autoFocus
          placeholder="Scan or type item SKU / barcode…"
          value={payload.itemId ?? ""}
          style={inputStyle}
          onChange={(e) => onChange({ itemId: e.target.value })}
          onBlur={(e) => lookupItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") lookupItem((e.target as HTMLInputElement).value); }}
        />
        {searching && (
          <span style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Finding item…</span>
        )}
        {error && (
          <span role="alert" style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-warning, #fbbf24)" }}>{error}</span>
        )}
      </div>

      {/* Current stock card — shown after lookup */}
      {payload.itemId && payload.itemName && (
        <div style={{
          padding: "var(--sxp-space-4, 16px)",
          borderRadius: "var(--sxp-radius-md, 8px)",
          background: "var(--sxp-surface-3, #2B3242)",
          border: "1px solid var(--sxp-border-strong, rgba(255,255,255,0.15))",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sxp-space-2, 8px)",
        }} role="status" aria-live="polite">
          <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>{payload.itemName}</div>
          <div style={{ display: "flex", gap: "var(--sxp-space-4, 16px)" }}>
            <div>
              <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Available</div>
              <div style={{ fontSize: "var(--sxp-text-xl, 20px)", fontWeight: 700, color: "var(--sxp-success, #34d399)" }}>
                {payload.currentQty ?? "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Step 2: Adjustment qty + reason ───────────────────────────────────────────

export interface AdjStep2Props {
  payload: Partial<AdjustmentPayload>;
  onChange(patch: Partial<AdjustmentPayload>): void;
}

export const AdjStep2: React.FC<AdjStep2Props> = ({ payload, onChange }) => {
  const qtyId    = useId();
  const reasonId = useId();
  const notesId  = useId();

  const newQty = (payload.currentQty ?? 0) + (payload.adjustmentQty ?? 0);
  const isNegative = newQty < 0;
  const isDelta = (payload.adjustmentQty ?? 0) > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sxp-space-5, 20px)" }}>
      {payload.itemName && (
        <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600, color: "var(--sxp-text-secondary, #94a3b8)" }}>
          Adjusting: <span style={{ color: "var(--sxp-text-primary, #e2e8f0)" }}>{payload.itemName}</span>
          {" "}· Current stock: <span style={{ color: "var(--sxp-success, #34d399)" }}>{payload.currentQty}</span>
        </div>
      )}

      <div style={fieldStyle}>
        <label htmlFor={qtyId} style={labelStyle}>Adjustment Quantity *</label>
        <div style={{ display: "flex", gap: "var(--sxp-space-2, 8px)" }}>
          {/* Sign toggle */}
          {([-1, 1] as const).map((sign) => (
            <button
              key={sign}
              type="button"
              aria-pressed={sign === (isDelta ? 1 : -1)}
              onClick={() => {
                const abs = Math.abs(payload.adjustmentQty ?? 0);
                onChange({ adjustmentQty: sign * abs });
              }}
              style={{
                padding: "var(--sxp-space-2, 8px) var(--sxp-space-3, 12px)",
                borderRadius: "var(--sxp-radius-md, 8px)",
                border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
                background: sign === (isDelta ? 1 : -1)
                  ? (sign === 1 ? "var(--sxp-success-muted, rgba(52,211,153,0.1))" : "var(--sxp-danger-muted, rgba(248,113,113,0.1))")
                  : "transparent",
                color: sign === 1 ? "var(--sxp-success, #34d399)" : "var(--sxp-danger, #f87171)",
                fontWeight: 700,
                fontSize: "var(--sxp-text-lg, 16px)",
                cursor: "pointer",
                minWidth: 44,
              }}
            >
              {sign === 1 ? "+" : "−"}
            </button>
          ))}
          <input
            id={qtyId}
            type="number"
            min={0}
            placeholder="0"
            value={Math.abs(payload.adjustmentQty ?? 0) || ""}
            style={{ ...inputStyle, flex: 1 }}
            aria-required="true"
            onChange={(e) => {
              const abs = Number(e.target.value);
              const sign = isDelta ? 1 : -1;
              onChange({ adjustmentQty: sign * abs });
            }}
          />
        </div>
        {/* Result preview */}
        {(payload.adjustmentQty ?? 0) !== 0 && (
          <div style={{
            fontSize: "var(--sxp-text-sm, 13px)",
            color: isNegative ? "var(--sxp-danger, #f87171)" : "var(--sxp-text-secondary, #94a3b8)",
            marginTop: 4,
          }}>
            New stock after adjustment: <strong style={{ color: isNegative ? "var(--sxp-danger, #f87171)" : "var(--sxp-success, #34d399)" }}>{newQty}</strong>
            {isNegative && " ⚠️ Will go below zero"}
          </div>
        )}
      </div>

      <div style={fieldStyle}>
        <label htmlFor={reasonId} style={labelStyle}>Reason *</label>
        <select
          id={reasonId}
          value={payload.reason ?? ""}
          style={{ ...inputStyle, appearance: "none" as const }}
          aria-required="true"
          onChange={(e) => onChange({ reason: e.target.value as AdjustmentReason })}
        >
          <option value="">Select a reason…</option>
          {(Object.entries(ADJUSTMENT_REASONS) as [AdjustmentReason, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* GAP-2: Batch / Lot & Expiry Tracking Fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--sxp-space-3, 12px)" }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Batch / Lot No. (Optional)</label>
          <input
            type="text"
            placeholder="e.g. BATCH-2026-08"
            value={payload.batchNumber ?? ""}
            style={inputStyle}
            onChange={(e) => onChange({ batchNumber: e.target.value || undefined })}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Expiry Date (Optional)</label>
          <input
            type="date"
            value={payload.expiryDate ?? ""}
            style={inputStyle}
            onChange={(e) => onChange({ expiryDate: e.target.value || undefined })}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Bin Location (Optional)</label>
          <input
            type="text"
            placeholder="e.g. BIN-A-12"
            value={payload.binLocation ?? ""}
            style={inputStyle}
            onChange={(e) => onChange({ binLocation: e.target.value || undefined })}
          />
        </div>
      </div>

      <div style={fieldStyle}>
        <label htmlFor={notesId} style={labelStyle}>Notes (optional)</label>
        <textarea
          id={notesId}
          placeholder="Additional notes for audit trail…"
          value={payload.notes ?? ""}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" as const }}
          onChange={(e) => onChange({ notes: e.target.value || undefined })}
        />
      </div>
    </div>
  );
};

// ── Payload validation ────────────────────────────────────────────────────────

export function validateAdjPayload(p: Partial<AdjustmentPayload>): p is AdjustmentPayload {
  return !!(p.itemId && p.adjustmentQty !== undefined && p.adjustmentQty !== 0 && p.reason);
}
