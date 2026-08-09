/**
 * Project      : SMRITI Retail OS
 * Module       : Inventory Studio — Reorder Suggestions Workspace
 * Standard     : SXP Constitution v1.0 / Sprint 4 Wave 1
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Displays items where available_qty <= reorder_point.
 * "Raise PO" publishes PurchaseOrderRequested event via WorkspaceEventBus.
 * Inventory Studio does NOT navigate to Purchase Studio — studio independence preserved.
 *
 * Adaptive UX:
 *   SIMPLE   — list + Raise PO button per row
 *   HYBRID   — + supplier column + reorder qty suggestion
 *   ADVANCED — + cost data + last GRN date
 */

import React, { useState, useEffect, useCallback } from "react";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { QuickActionBar } from "../shared/QuickActionBar.js";
import { EmptyState } from "../shared/EmptyState.js";
import { SkeletonRow } from "../shared/SkeletonLoader.js";
import { useAdaptiveWorkspace } from "../../layout_engine/adaptive_workspace_store.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReorderSuggestion {
  itemId: string;
  itemName: string;
  sku: string;
  availableQty: number;
  reorderPoint: number;
  suggestedQty: number;
  supplierId?: string;
  supplierName?: string;
  unitCost?: number;
  lastGrnDate?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "var(--sxp-surface-1, #141826)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--sxp-text-xs, 11px)",
  fontWeight: 600,
  color: "var(--sxp-text-secondary, #94a3b8)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

// ── Row component ─────────────────────────────────────────────────────────────

interface SuggestionRowProps {
  item: ReorderSuggestion;
  onRaisePO(item: ReorderSuggestion): void;
  showSupplier: boolean;
  showCost: boolean;
}

const SuggestionRow: React.FC<SuggestionRowProps> = ({ item, onRaisePO, showSupplier, showCost }) => {
  const stockColor = item.availableQty <= 0
    ? "var(--sxp-danger, #f87171)"
    : "var(--sxp-warning, #fbbf24)";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `2fr 80px 80px ${showSupplier ? "1fr" : ""} ${showCost ? "80px" : ""} 120px`,
      alignItems: "center",
      gap: "var(--sxp-space-4, 16px)",
      padding: "var(--sxp-space-3, 12px) var(--sxp-space-5, 20px)",
      borderBottom: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
      transition: "var(--sxp-transition-fast, all 100ms ease-out)",
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sxp-surface-hover, #252D3D)"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
    >
      <div>
        <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>{item.itemName}</div>
        <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>{item.sku}</div>
      </div>

      {/* Available qty — coloured by severity */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 700, color: stockColor }}>
          {item.availableQty}
        </div>
        <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>
          / {item.reorderPoint} min
        </div>
      </div>

      {/* Suggested order qty */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600, color: "var(--sxp-brand, #818cf8)" }}>
          +{item.suggestedQty}
        </div>
        <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>suggested</div>
      </div>

      {/* Supplier — HYBRID+ */}
      {showSupplier && (
        <div>
          <div style={{ fontSize: "var(--sxp-text-sm, 13px)" }}>{item.supplierName ?? "—"}</div>
        </div>
      )}

      {/* Unit cost — ADVANCED */}
      {showCost && (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "var(--sxp-text-sm, 13px)" }}>
            {item.unitCost != null ? `₹${item.unitCost.toFixed(2)}` : "—"}
          </div>
        </div>
      )}

      {/* Raise PO CTA */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          id={`reorder-raise-po-${item.itemId}`}
          onClick={() => onRaisePO(item)}
          aria-label={`Raise purchase order for ${item.itemName}`}
          style={{
            padding: "var(--sxp-space-1, 4px) var(--sxp-space-3, 12px)",
            borderRadius: "var(--sxp-radius-md, 8px)",
            border: "1px solid var(--sxp-brand-border, rgba(129,140,248,0.25))",
            background: "var(--sxp-brand-muted, rgba(129,140,248,0.12))",
            color: "var(--sxp-brand, #818cf8)",
            fontSize: "var(--sxp-text-xs, 11px)",
            fontWeight: 600,
            cursor: "pointer",
            transition: "var(--sxp-transition-fast, all 100ms ease-out)",
            whiteSpace: "nowrap" as const,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--sxp-brand, #818cf8)";
            (e.currentTarget as HTMLElement).style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--sxp-brand-muted, rgba(129,140,248,0.12))";
            (e.currentTarget as HTMLElement).style.color = "var(--sxp-brand, #818cf8)";
          }}
        >
          Raise PO
        </button>
      </div>
    </div>
  );
};

// ── Main Workspace ────────────────────────────────────────────────────────────

export interface ReorderWorkspaceProps {
  workspaceId?: string;
}

export const ReorderWorkspace: React.FC<ReorderWorkspaceProps> = ({
  workspaceId = "inventory.reorder",
}) => {
  const { mode } = useAdaptiveWorkspace();
  const [items, setItems]       = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [raised, setRaised]     = useState<Set<string>>(new Set());

  const showSupplier = mode === "HYBRID" || mode === "ADVANCED";
  const showCost     = mode === "ADVANCED";

  // ── Load reorder suggestions ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetchV1<ReorderSuggestion[]>("/api/v1/inventory/reorder-suggestions")
      .then((data) => { if (!cancelled) { setItems(data); setLoading(false); } })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
          setError("Unable to load reorder suggestions from server.");
        }
      });
    return () => { cancelled = true; };
  }, []);

  // ── Raise PO: publish event, do NOT navigate ──────────────────────────────
  const handleRaisePO = useCallback((item: ReorderSuggestion) => {
    WorkspaceEventBus.publish(
      "ActionExecuted",
      {
        actionId:     "PurchaseOrderRequested",
        itemId:       item.itemId,
        itemName:     item.itemName,
        supplierId:   item.supplierId,
        supplierName: item.supplierName,
        quantity:     item.suggestedQty,
        unitCost:     item.unitCost,
        source:       "inventory.reorder",
      },
      workspaceId
    );
    setRaised((prev) => new Set([...prev, item.itemId]));
  }, [workspaceId]);

  const pendingItems  = items.filter((i) => !raised.has(i.itemId));
  const raisedCount   = raised.size;

  return (
    <div style={containerStyle}>
      <QuickActionBar
        domainLabel="What to Order"
        actions={[
          {
            id: "refresh",
            label: "Refresh",
            icon: "🔄",
            onClick: () => {
              setLoading(true);
              setRaised(new Set());
              apiFetchV1<ReorderSuggestion[]>("/api/v1/inventory/reorder-suggestions")
                .then(setItems)
                .catch(() => setItems([]))
                .finally(() => setLoading(false));
            },
          },
        ]}
        workspaceId={workspaceId}
        mode={mode}
      />

      <div style={{ padding: "var(--sxp-space-6, 24px)", flex: 1, display: "flex", flexDirection: "column", gap: "var(--sxp-space-5, 20px)", overflowY: "auto" }}>

        {/* Raised banner */}
        {raisedCount > 0 && (
          <div style={{
            padding: "var(--sxp-space-3, 12px) var(--sxp-space-4, 16px)",
            borderRadius: "var(--sxp-radius-md, 8px)",
            background: "var(--sxp-success-muted, rgba(52,211,153,0.1))",
            border: "1px solid var(--sxp-success-border, rgba(52,211,153,0.25))",
            fontSize: "var(--sxp-text-sm, 13px)",
            color: "var(--sxp-success, #34d399)",
          }} role="status">
            ✅ {raisedCount} purchase order{raisedCount !== 1 ? "s" : ""} raised — Purchase Studio will process them.
          </div>
        )}

        {/* Error notice */}
        {error && (
          <div style={{
            padding: "var(--sxp-space-3, 12px) var(--sxp-space-4, 16px)",
            borderRadius: "var(--sxp-radius-md, 8px)",
            background: "var(--sxp-warning-muted, rgba(251,191,36,0.1))",
            border: "1px solid var(--sxp-warning-border, rgba(251,191,36,0.25))",
            fontSize: "var(--sxp-text-xs, 11px)",
            color: "var(--sxp-warning, #fbbf24)",
          }}>
            {error}
          </div>
        )}

        {/* List */}
        <div style={{
          background: "var(--sxp-surface-2, #1F2430)",
          border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
          borderRadius: "var(--sxp-radius-lg, 12px)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: `2fr 80px 80px ${showSupplier ? "1fr" : ""} ${showCost ? "80px" : ""} 120px`,
            gap: "var(--sxp-space-4, 16px)",
            padding: "var(--sxp-space-3, 12px) var(--sxp-space-5, 20px)",
            borderBottom: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
            background: "var(--sxp-surface-3, #2B3242)",
          }}>
            {["Item", "In Stock", "Order Qty", ...(showSupplier ? ["Supplier"] : []), ...(showCost ? ["Unit Cost"] : []), ""].map((h, i) => (
              <div key={i} style={labelStyle}>{h}</div>
            ))}
          </div>

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={showCost ? 6 : showSupplier ? 5 : 4} />)
          ) : pendingItems.length === 0 ? (
            <EmptyState
              variant="no-data"
              icon="✅"
              headline="Nothing to order"
              description="All items are above their reorder points. Your stock levels look healthy."
              compact
            />
          ) : (
            pendingItems.map((item) => (
              <SuggestionRow
                key={item.itemId}
                item={item}
                onRaisePO={handleRaisePO}
                showSupplier={showSupplier}
                showCost={showCost}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};


