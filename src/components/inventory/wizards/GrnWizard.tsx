/**
 * Project      : SMRITI Retail OS
 * Module       : Inventory Studio — GRN Wizard (3-Step)
 * Standard     : SXP Constitution v1.0 / SWEF P-007 (≤3 scanner interactions)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Barcode-first GRN flow:
 *   Step 1: Scan barcode / enter SKU (fallback)
 *   Step 2: Confirm quantity + unit cost
 *   Step 3: Confirm supplier + warehouse → payload ready for execute()
 *
 * RULE: This file contains ONLY JSX form steps.
 *       No kernel calls here — payload is passed to the manifest execute() handler.
 *       execute() calls StockLedgerService.applyMovement({ type: 'in', … }).
 */

import React, { useState, useId } from "react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GrnPayload {
  itemId: string;
  itemName: string;
  barcode: string;
  quantity: number;
  unitCost: number;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  batchId?: string;
  expiryDate?: string;
}

interface GrnStep1Props {
  payload: Partial<GrnPayload>;
  onChange(patch: Partial<GrnPayload>): void;
}

interface GrnStep2Props {
  payload: Partial<GrnPayload>;
  onChange(patch: Partial<GrnPayload>): void;
}

interface GrnStep3Props {
  payload: Partial<GrnPayload>;
  onChange(patch: Partial<GrnPayload>): void;
}

// ── Shared input style ────────────────────────────────────────────────────────

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
  transition: "var(--sxp-transition-fast, all 100ms ease-out)",
};

const itemCardStyle: React.CSSProperties = {
  padding: "var(--sxp-space-4, 16px)",
  borderRadius: "var(--sxp-radius-md, 8px)",
  background: "var(--sxp-brand-muted, rgba(129,140,248,0.12))",
  border: "1px solid var(--sxp-brand-border, rgba(129,140,248,0.25))",
  display: "flex",
  alignItems: "center",
  gap: "var(--sxp-space-3, 12px)",
};

// ── Step 1: Scan barcode or enter SKU ─────────────────────────────────────────

export const GrnStep1: React.FC<GrnStep1Props> = ({ payload, onChange }) => {
  const [scanning, setScanning] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const barcodeId = useId();
  const skuId = useId();

  const lookupItem = async (barcode: string) => {
    if (!barcode.trim()) return;
    setScanning(true);
    setLookupError(null);
    try {
      const result = await apiFetchV1<{ itemId: string; name: string; barcode: string }>(
        `/api/v1/inventory/item-by-barcode?barcode=${encodeURIComponent(barcode)}`
      );
      onChange({ itemId: result.itemId, itemName: result.name, barcode: result.barcode });
    } catch {
      // Barcode not found — let user enter SKU manually
      setLookupError("Barcode not found. Enter item SKU manually below.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sxp-space-5, 20px)" }}>
      {/* Barcode scanner field — primary path */}
      <div style={fieldStyle}>
        <label htmlFor={barcodeId} style={labelStyle}>Scan Barcode</label>
        <input
          id={barcodeId}
          type="text"
          autoFocus
          placeholder="Scan or type barcode…"
          value={payload.barcode ?? ""}
          style={inputStyle}
          onChange={(e) => onChange({ barcode: e.target.value })}
          onBlur={(e) => lookupItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") lookupItem((e.target as HTMLInputElement).value); }}
          aria-describedby={lookupError ? `${barcodeId}-err` : undefined}
        />
        {scanning && (
          <span style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>
            Looking up item…
          </span>
        )}
        {lookupError && (
          <span id={`${barcodeId}-err`} role="alert" style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-warning, #fbbf24)" }}>
            {lookupError}
          </span>
        )}
      </div>

      {/* Manual SKU — fallback when barcode unavailable */}
      <div style={fieldStyle}>
        <label htmlFor={skuId} style={labelStyle}>Item SKU (manual fallback)</label>
        <input
          id={skuId}
          type="text"
          placeholder="e.g. SKU-10042"
          value={payload.itemId ?? ""}
          style={inputStyle}
          onChange={(e) => onChange({ itemId: e.target.value })}
          aria-label="Item SKU, enter manually if barcode is unavailable"
        />
      </div>

      {/* Item confirmation card — shown after successful lookup */}
      {payload.itemId && payload.itemName && (
        <div style={itemCardStyle} role="status" aria-live="polite">
          <span aria-hidden="true" style={{ fontSize: 24 }}>📦</span>
          <div>
            <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600, color: "var(--sxp-text-primary, #e2e8f0)" }}>
              {payload.itemName}
            </div>
            <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>
              SKU: {payload.itemId}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Step 2: Quantity + Unit Cost ───────────────────────────────────────────────

export const GrnStep2: React.FC<GrnStep2Props> = ({ payload, onChange }) => {
  const qtyId   = useId();
  const costId  = useId();
  const batchId = useId();
  const expId   = useId();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sxp-space-5, 20px)" }}>
      {payload.itemName && (
        <div style={itemCardStyle}>
          <span aria-hidden="true" style={{ fontSize: 20 }}>📦</span>
          <span style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>{payload.itemName}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sxp-space-4, 16px)" }}>
        <div style={fieldStyle}>
          <label htmlFor={qtyId} style={labelStyle}>Quantity Received *</label>
          <input
            id={qtyId}
            type="number"
            min={1}
            autoFocus
            placeholder="0"
            value={payload.quantity ?? ""}
            style={inputStyle}
            onChange={(e) => onChange({ quantity: Number(e.target.value) })}
            aria-required="true"
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor={costId} style={labelStyle}>Unit Cost (₹)</label>
          <input
            id={costId}
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={payload.unitCost ?? ""}
            style={inputStyle}
            onChange={(e) => onChange({ unitCost: Number(e.target.value) })}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sxp-space-4, 16px)" }}>
        <div style={fieldStyle}>
          <label htmlFor={batchId} style={labelStyle}>Batch / Lot (optional)</label>
          <input
            id={batchId}
            type="text"
            placeholder="e.g. BATCH-2026-08"
            value={payload.batchId ?? ""}
            style={inputStyle}
            onChange={(e) => onChange({ batchId: e.target.value || undefined })}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor={expId} style={labelStyle}>Expiry Date (optional)</label>
          <input
            id={expId}
            type="date"
            value={payload.expiryDate ?? ""}
            style={inputStyle}
            onChange={(e) => onChange({ expiryDate: e.target.value || undefined })}
          />
        </div>
      </div>

      {(payload.quantity ?? 0) > 0 && (payload.unitCost ?? 0) > 0 && (
        <div style={{ fontSize: "var(--sxp-text-sm, 13px)", color: "var(--sxp-success, #34d399)", fontWeight: 600 }}>
          Total Receipt Value: ₹{((payload.quantity ?? 0) * (payload.unitCost ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
};

// ── Step 3: Supplier + Warehouse confirmation ──────────────────────────────────

export const GrnStep3: React.FC<GrnStep3Props> = ({ payload, onChange }) => {
  const supId = useId();
  const whId  = useId();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sxp-space-5, 20px)" }}>
      {/* Receipt summary */}
      <div style={{
        padding: "var(--sxp-space-4, 16px)",
        borderRadius: "var(--sxp-radius-md, 8px)",
        background: "var(--sxp-surface-3, #2B3242)",
        border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sxp-space-2, 8px)",
      }}>
        <div style={{ fontSize: "var(--sxp-text-xs, 11px)", fontWeight: 600, color: "var(--sxp-text-muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Receipt Summary
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sxp-space-2, 8px)" }}>
          <div>
            <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Item</div>
            <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>{payload.itemName ?? payload.itemId}</div>
          </div>
          <div>
            <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Quantity</div>
            <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600, color: "var(--sxp-success, #34d399)" }}>
              +{payload.quantity ?? 0} units
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Unit Cost</div>
            <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>₹{(payload.unitCost ?? 0).toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Total Value</div>
            <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>
              ₹{((payload.quantity ?? 0) * (payload.unitCost ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div style={fieldStyle}>
        <label htmlFor={supId} style={labelStyle}>Supplier *</label>
        <input
          id={supId}
          type="text"
          autoFocus
          placeholder="Supplier name or ID"
          value={payload.supplierName ?? payload.supplierId ?? ""}
          style={inputStyle}
          aria-required="true"
          onChange={(e) => onChange({ supplierId: e.target.value, supplierName: e.target.value })}
        />
      </div>

      <div style={fieldStyle}>
        <label htmlFor={whId} style={labelStyle}>Receiving Warehouse *</label>
        <input
          id={whId}
          type="text"
          placeholder="Warehouse ID or name"
          value={payload.warehouseName ?? payload.warehouseId ?? ""}
          style={inputStyle}
          aria-required="true"
          onChange={(e) => onChange({ warehouseId: e.target.value, warehouseName: e.target.value })}
        />
      </div>
    </div>
  );
};

// ── Payload factory — exported for manifest execute() ────────────────────────

/** Validates GRN payload completeness before execute() is called. */
export function validateGrnPayload(p: Partial<GrnPayload>): p is GrnPayload {
  return !!(p.itemId && p.quantity && p.quantity > 0 && p.supplierId && p.warehouseId);
}
