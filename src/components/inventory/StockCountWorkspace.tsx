/**
 * Project      : SMRITI Retail OS
 * Module       : Inventory Studio — Physical Stock Count Workspace
 * Standard     : SXP Constitution v1.0 / Sprint 4 Wave 1
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Session model (both scopes supported — warehouse-only is default):
 *   CountSession
 *     ├── warehouseId (required)
 *     ├── binId       (optional — bin/location scope)
 *     ├── items[]     (scanned + counted)
 *     └── variances[] (counted ≠ system qty)
 *
 * Workflow:
 *   Open Session → Scan Items → Enter Physical Qty → Review Variances → Post Adjustments
 *
 * Adaptive UX:
 *   HYBRID    — scan + count + variance list
 *   ADVANCED  — + post variances button + raw count data
 *
 * RULE: Post Adjustments calls WorkspaceActionRegistry.execute('adjust_stock')
 *       for each variance — never calls StockLedgerService directly.
 */

import React, { useState, useCallback, useId } from "react";
import { WorkspaceActionRegistry } from "../../layout_engine/WorkspaceActionRegistry.js";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus.js";
import { QuickActionBar } from "../shared/QuickActionBar.js";
import { EmptyState } from "../shared/EmptyState.js";
import { SkeletonRow } from "../shared/SkeletonLoader.js";
import { useAdaptiveWorkspace } from "../../layout_engine/adaptive_workspace_store.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CountItem {
  itemId: string;
  itemName: string;
  systemQty: number;
  countedQty: number | null;   // null = not yet counted
  variance: number;            // countedQty - systemQty
}

interface CountSession {
  sessionId: string;
  warehouseId: string;
  warehouseName: string;
  binId?: string;
  binName?: string;
  openedAt: string;
  items: CountItem[];
  status: "open" | "posting" | "posted";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "var(--sxp-surface-1, #141826)",
};

const sectionStyle: React.CSSProperties = {
  padding: "var(--sxp-space-6, 24px)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--sxp-space-5, 20px)",
  flex: 1,
  overflowY: "auto" as const,
};

const cardStyle: React.CSSProperties = {
  background: "var(--sxp-surface-2, #1F2430)",
  border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
  borderRadius: "var(--sxp-radius-lg, 12px)",
  overflow: "hidden",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--sxp-text-xs, 11px)",
  fontWeight: 600,
  color: "var(--sxp-text-secondary, #94a3b8)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  padding: "var(--sxp-space-1, 4px) var(--sxp-space-2, 8px)",
  borderRadius: "var(--sxp-radius-sm, 4px)",
  border: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
  background: "var(--sxp-surface-3, #2B3242)",
  color: "var(--sxp-text-primary, #e2e8f0)",
  fontSize: "var(--sxp-text-sm, 13px)",
  width: 80,
  textAlign: "center" as const,
};

// ── Open Session Form ─────────────────────────────────────────────────────────

interface OpenSessionFormProps {
  onOpen(warehouseId: string, warehouseName: string, binId?: string, binName?: string): void;
}

const OpenSessionForm: React.FC<OpenSessionFormProps> = ({ onOpen }) => {
  const [warehouseId, setWarehouseId] = useState("");
  const [binId, setBinId]             = useState("");
  const whId  = useId();
  const binFId = useId();

  return (
    <div style={{
      ...cardStyle,
      padding: "var(--sxp-space-8, 32px)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sxp-space-5, 20px)",
      maxWidth: 480,
      alignSelf: "center",
      width: "100%",
    }}>
      <div>
        <div style={{ fontSize: "var(--sxp-text-lg, 16px)", fontWeight: 700, marginBottom: 4 }}>
          Start a Stock Count
        </div>
        <div style={{ fontSize: "var(--sxp-text-sm, 13px)", color: "var(--sxp-text-secondary, #94a3b8)" }}>
          Select a warehouse. Optionally narrow to a specific bin or shelf.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sxp-space-2, 8px)" }}>
        <label htmlFor={whId} style={labelStyle}>Warehouse *</label>
        <input
          id={whId}
          type="text"
          autoFocus
          placeholder="Warehouse ID or name"
          value={warehouseId}
          style={{ ...inputStyle, width: "100%", textAlign: "left" }}
          aria-required="true"
          onChange={(e) => setWarehouseId(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sxp-space-2, 8px)" }}>
        <label htmlFor={binFId} style={labelStyle}>Bin / Location (optional)</label>
        <input
          id={binFId}
          type="text"
          placeholder="e.g. BIN-A3 or SHELF-2"
          value={binId}
          style={{ ...inputStyle, width: "100%", textAlign: "left" }}
          onChange={(e) => setBinId(e.target.value)}
        />
      </div>

      <button
        onClick={() => {
          if (!warehouseId.trim()) return;
          onOpen(warehouseId.trim(), warehouseId.trim(), binId.trim() || undefined, binId.trim() || undefined);
        }}
        disabled={!warehouseId.trim()}
        style={{
          padding: "var(--sxp-space-3, 12px) var(--sxp-space-6, 24px)",
          borderRadius: "var(--sxp-radius-md, 8px)",
          border: "none",
          background: "var(--sxp-brand, #818cf8)",
          color: "#fff",
          fontSize: "var(--sxp-text-sm, 13px)",
          fontWeight: 600,
          cursor: "pointer",
          opacity: warehouseId.trim() ? 1 : 0.4,
          transition: "var(--sxp-transition-fast, all 100ms ease-out)",
        }}
      >
        Start Count Session
      </button>
    </div>
  );
};

// ── Item Row ──────────────────────────────────────────────────────────────────

interface CountItemRowProps {
  item: CountItem;
  onCount(itemId: string, qty: number): void;
  canPost: boolean;
}

const CountItemRow: React.FC<CountItemRowProps> = ({ item, onCount, canPost }) => {
  const { variance, countedQty, systemQty } = item;
  const hasVariance   = countedQty !== null && variance !== 0;
  const varColor      = variance > 0
    ? "var(--sxp-success, #34d399)"
    : variance < 0 ? "var(--sxp-danger, #f87171)"
    : "var(--sxp-text-muted, #64748b)";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto auto auto",
      alignItems: "center",
      gap: "var(--sxp-space-4, 16px)",
      padding: "var(--sxp-space-3, 12px) var(--sxp-space-4, 16px)",
      borderBottom: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
    }}>
      <div>
        <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>{item.itemName}</div>
        <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>{item.itemId}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>System</div>
        <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>{systemQty}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Counted</div>
        <input
          type="number"
          min={0}
          value={countedQty ?? ""}
          placeholder="—"
          style={inputStyle}
          aria-label={`Counted quantity for ${item.itemName}`}
          onChange={(e) => onCount(item.itemId, Number(e.target.value))}
        />
      </div>
      {canPost && (
        <div style={{ textAlign: "right", minWidth: 48 }}>
          <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Variance</div>
          <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600, color: hasVariance ? varColor : "var(--sxp-text-muted, #64748b)" }}>
            {countedQty !== null ? (variance > 0 ? `+${variance}` : variance) : "—"}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Workspace ────────────────────────────────────────────────────────────

export interface StockCountWorkspaceProps {
  workspaceId?: string;
  userId?: string;
  tenantId?: string;
}

export const StockCountWorkspace: React.FC<StockCountWorkspaceProps> = ({
  workspaceId = "inventory.count",
  userId = "user",
  tenantId = "smriti",
}) => {
  const { mode, canRender } = useAdaptiveWorkspace();
  const [session, setSession]   = useState<CountSession | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [posting, setPosting]   = useState(false);
  const [posted, setPosted]     = useState(false);
  const scanId = useId();

  const openSession = useCallback((
    warehouseId: string, warehouseName: string, binId?: string, binName?: string
  ) => {
    setSession({
      sessionId:     `count-${Date.now()}`,
      warehouseId,
      warehouseName,
      binId,
      binName,
      openedAt:      new Date().toISOString(),
      items:         [],
      status:        "open",
    });
    setPosted(false);
  }, []);

  const addScannedItem = useCallback(() => {
    const barcode = scanInput.trim();
    if (!barcode || !session) return;
    // Avoid duplicate adds
    if (session.items.find((i) => i.itemId === barcode)) {
      setScanInput("");
      return;
    }
    setSession((prev) => prev ? ({
      ...prev,
      items: [...prev.items, {
        itemId:     barcode,
        itemName:   barcode,   // name resolved by API in real integration
        systemQty:  0,         // loaded from ledger in real integration
        countedQty: null,
        variance:   0,
      }],
    }) : prev);
    setScanInput("");
  }, [scanInput, session]);

  const updateCount = useCallback((itemId: string, qty: number) => {
    setSession((prev) => prev ? ({
      ...prev,
      items: prev.items.map((i) =>
        i.itemId === itemId
          ? { ...i, countedQty: qty, variance: qty - i.systemQty }
          : i
      ),
    }) : prev);
  }, []);

  const postVariances = useCallback(async () => {
    if (!session) return;
    const variances = session.items.filter((i) => i.countedQty !== null && i.variance !== 0);
    if (!variances.length) return;
    setPosting(true);
    setSession((prev) => prev ? { ...prev, status: "posting" } : prev);

    for (const item of variances) {
      await WorkspaceActionRegistry.execute("adjust_stock", {
        tenantId,
        userId,
        workspaceId,
        mode,
        payload: {
          itemId:        item.itemId,
          adjustmentQty: item.variance,
          reason:        "count_correction",
          notes:         `Physical count session ${session.sessionId}`,
          warehouseId:   session.warehouseId,
        },
      });
    }

    WorkspaceEventBus.publish("ActionExecuted", {
      actionId:  "stock_count_posted",
      sessionId: session.sessionId,
      variances: variances.length,
    }, workspaceId);

    setSession((prev) => prev ? { ...prev, status: "posted" } : prev);
    setPosting(false);
    setPosted(true);
  }, [session, tenantId, userId, workspaceId, mode]);

  const variances = session?.items.filter((i) => i.countedQty !== null && i.variance !== 0) ?? [];
  const canPost   = canRender("cost_layers") || mode === "ADVANCED";   // reuse ADVANCED gate

  // ── No session: show empty state with open form ───────────────────────────
  if (!session) {
    return (
      <div style={containerStyle}>
        <div style={sectionStyle}>
          {posted && (
            <div style={{
              padding: "var(--sxp-space-4, 16px)",
              borderRadius: "var(--sxp-radius-md, 8px)",
              background: "var(--sxp-success-muted, rgba(52,211,153,0.1))",
              border: "1px solid var(--sxp-success-border, rgba(52,211,153,0.25))",
              fontSize: "var(--sxp-text-sm, 13px)",
              color: "var(--sxp-success, #34d399)",
              fontWeight: 600,
            }} role="status">
              ✅ Variances posted successfully. Start a new count session below.
            </div>
          )}
          <OpenSessionForm onOpen={openSession} />
        </div>
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      <QuickActionBar
        domainLabel="Stock Count"
        primaryAction={
          variances.length > 0 && canPost
            ? { id: "post-variances", label: `Post ${variances.length} Variance${variances.length !== 1 ? "s" : ""}`, icon: "✅", onClick: postVariances }
            : undefined
        }
        actions={[
          { id: "close-session", label: "Close Session", icon: "✕", variant: "ghost",
            onClick: () => { setSession(null); } },
        ]}
        workspaceId={workspaceId}
        mode={mode}
      />

      <div style={sectionStyle}>
        {/* Session header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sxp-space-4, 16px)",
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Warehouse</div>
            <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>{session.warehouseName}</div>
          </div>
          {session.binId && (
            <div>
              <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Bin / Location</div>
              <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>{session.binName}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Items Scanned</div>
            <div style={{ fontSize: "var(--sxp-text-sm, 13px)", fontWeight: 600 }}>{session.items.length}</div>
          </div>
          {canPost && (
            <div>
              <div style={{ fontSize: "var(--sxp-text-xs, 11px)", color: "var(--sxp-text-muted, #64748b)" }}>Variances</div>
              <div style={{
                fontSize: "var(--sxp-text-sm, 13px)",
                fontWeight: 600,
                color: variances.length > 0 ? "var(--sxp-warning, #fbbf24)" : "var(--sxp-text-muted, #64748b)",
              }}>
                {variances.length}
              </div>
            </div>
          )}
        </div>

        {/* Scan input */}
        <div style={{ display: "flex", gap: "var(--sxp-space-3, 12px)", alignItems: "center" }}>
          <label htmlFor={scanId} className="sxp-sr-only">Scan item barcode</label>
          <input
            id={scanId}
            type="text"
            autoFocus
            placeholder="Scan barcode or enter SKU…"
            value={scanInput}
            style={{
              flex: 1,
              padding: "var(--sxp-space-3, 12px)",
              borderRadius: "var(--sxp-radius-md, 8px)",
              border: "1px solid var(--sxp-border-brand, rgba(129,140,248,0.35))",
              background: "var(--sxp-surface-3, #2B3242)",
              color: "var(--sxp-text-primary, #e2e8f0)",
              fontSize: "var(--sxp-text-base, 14px)",
              outline: "none",
            }}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addScannedItem(); }}
          />
          <button
            onClick={addScannedItem}
            disabled={!scanInput.trim()}
            style={{
              padding: "var(--sxp-space-3, 12px) var(--sxp-space-4, 16px)",
              borderRadius: "var(--sxp-radius-md, 8px)",
              border: "none",
              background: "var(--sxp-brand, #818cf8)",
              color: "#fff",
              fontSize: "var(--sxp-text-sm, 13px)",
              fontWeight: 600,
              cursor: "pointer",
              opacity: scanInput.trim() ? 1 : 0.4,
            }}
          >
            Add
          </button>
        </div>

        {/* Item list */}
        {session.items.length === 0 ? (
          <EmptyState
            variant="no-data"
            icon="🔢"
            headline="No items scanned yet"
            description="Scan item barcodes above to begin your count."
            compact
          />
        ) : (
          <div style={cardStyle}>
            <div style={{
              padding: "var(--sxp-space-3, 12px) var(--sxp-space-4, 16px)",
              borderBottom: "1px solid var(--sxp-border, rgba(255,255,255,0.08))",
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto",
              gap: "var(--sxp-space-4, 16px)",
            }}>
              {["Item", "System Qty", "Counted", canPost ? "Variance" : ""].map((h) => (
                <div key={h} style={{ ...labelStyle }}>{h}</div>
              ))}
            </div>
            {posting
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
              : session.items.map((item) => (
                  <CountItemRow key={item.itemId} item={item} onCount={updateCount} canPost={canPost} />
                ))
            }
          </div>
        )}
      </div>
    </div>
  );
};
