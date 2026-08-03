/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Mobile Warehouse Scan View (Scanner Zone)
 * Standard     : SXP Constitution v1.0 / SWEF P-007 / 3-Interaction Rule (ENFORCED)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * SWEF P-007 — 3-Interaction Rule (FROZEN):
 *   Interaction 1: Scan barcode input (auto-focus)
 *   Interaction 2: Confirm quantity (single number field)
 *   Interaction 3: "Done" button
 *   Any attempt to add a 4th step is an architecture violation.
 */

import React, { useState, useRef, useEffect } from "react";
import { WorkspaceShell } from "../../layout_engine/components/WorkspaceShell.js";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry } from "../../layout_engine/WorkspaceActionRegistry.js";
import { useSmritiExperience } from "../../context/SmritiExperienceContext.js";
import { INVENTORY_WORKSPACE_IDS } from "./inventory.manifest.js";

// ── 3-Interaction State Machine ───────────────────────────────────────────────

type ScanStep = "scan" | "confirm" | "done";

// ── Component ─────────────────────────────────────────────────────────────────

export const MobileWarehouseScanView: React.FC = () => {
  const { mode } = useSmritiExperience();
  const metadata = WorkspaceRegistry.get(INVENTORY_WORKSPACE_IDS.SCAN)!;

  // === INTERACTION 1: Scan ===
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState<ScanStep>("scan");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [executing, setExecuting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus scan input on mount and after reset
  useEffect(() => {
    if (step === "scan" && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [step]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode.trim()) {
      setStep("confirm"); // === INTERACTION 2 ===
    }
  };

  const handleConfirm = async () => {
    setExecuting(true);
    const res = await WorkspaceActionRegistry.execute("receive_stock", {
      tenantId: "default",
      userId: "scanner_user",
      workspaceId: INVENTORY_WORKSPACE_IDS.SCAN,
      mode,
    });
    setResult({ success: res.success, message: res.message ?? (res.success ? "Stock received" : "Failed") });
    setStep("done"); // === INTERACTION 3 ===
    setExecuting(false);
  };

  const handleReset = () => {
    setBarcode("");
    setQty(1);
    setResult(null);
    setStep("scan");
  };

  const body = (
    <div style={{
      display: "flex",
      flexDirection: "column",
      flex: 1,
      minHeight: "100%",
      background: "var(--c-surface, #1a1a2e)",
      overflow: "hidden",
    }}>
      {/* ── STEP 1: SCAN ── */}
      {step === "scan" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 24, gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text-primary, #e2e8f0)", margin: 0 }}>
              Scan Item
            </h2>
            <p style={{ fontSize: 13, color: "var(--c-text-muted, #64748b)", marginTop: 6 }}>
              Point scanner at barcode or type manually
            </p>
          </div>

          <form onSubmit={handleScanSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              ref={scanInputRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan barcode…"
              autoComplete="off"
              style={{
                height: "var(--sxp-scan-input-height, 56px)",
                padding: "0 20px",
                borderRadius: 12,
                border: "2px solid var(--c-brand, #818cf8)",
                background: "rgba(99,102,241,0.06)",
                color: "var(--c-text-primary, #e2e8f0)",
                fontSize: 18,
                letterSpacing: "0.1em",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            <button
              type="submit"
              disabled={!barcode.trim()}
              style={{
                height: "var(--sxp-scan-confirm-height, 72px)",
                borderRadius: 12,
                border: "none",
                background: barcode.trim() ? "var(--c-brand, #818cf8)" : "rgba(255,255,255,0.08)",
                color: "#fff",
                fontSize: 18,
                fontWeight: 700,
                cursor: barcode.trim() ? "pointer" : "not-allowed",
                opacity: barcode.trim() ? 1 : 0.4,
                transition: "all var(--sxp-motion-action, 150ms)",
                width: "100%",
              }}
            >
              Next →
            </button>
          </form>
        </div>
      )}

      {/* ── STEP 2: CONFIRM QUANTITY ── */}
      {step === "confirm" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 24, gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--c-text-muted, #64748b)", marginBottom: 4 }}>Scanned</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text-primary, #e2e8f0)", fontFamily: "monospace", letterSpacing: "0.1em" }}>
              {barcode}
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 13, color: "var(--c-text-secondary, #94a3b8)" }}>How many units?</div>

            {/* Large quantity input — 44px min for touch */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                style={{ width: 52, height: 52, borderRadius: 10, border: "1px solid var(--c-border)", background: "rgba(255,255,255,0.05)", color: "var(--c-text-primary, #e2e8f0)", fontSize: 24, cursor: "pointer" }}
              >
                −
              </button>
              <div style={{ fontSize: 48, fontWeight: 800, minWidth: 80, textAlign: "center", color: "var(--c-text-primary, #e2e8f0)", fontFamily: "monospace" }}>
                {qty}
              </div>
              <button
                onClick={() => setQty((q) => q + 1)}
                style={{ width: 52, height: 52, borderRadius: 10, border: "1px solid var(--c-border)", background: "rgba(255,255,255,0.05)", color: "var(--c-text-primary, #e2e8f0)", fontSize: 24, cursor: "pointer" }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={handleReset} style={{ flex: 1, height: 52, borderRadius: 12, border: "1px solid var(--c-border)", background: "transparent", color: "var(--c-text-secondary, #94a3b8)", fontSize: 15, cursor: "pointer" }}>
              ← Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={executing}
              style={{ flex: 2, height: "var(--sxp-scan-confirm-height, 72px)", borderRadius: 12, border: "none", background: "var(--c-brand, #818cf8)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer" }}
            >
              {executing ? "Saving…" : `Receive ${qty} unit${qty > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: DONE ── */}
      {step === "done" && result && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 24, gap: 24, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontSize: 64 }}>{result.success ? "✅" : "❌"}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: result.success ? "#22c55e" : "#ef4444" }}>
            {result.success ? "Done!" : "Error"}
          </div>
          <div style={{ fontSize: 14, color: "var(--c-text-secondary, #94a3b8)", maxWidth: 280 }}>
            {result.message}
          </div>
          <button
            onClick={handleReset}
            style={{ height: "var(--sxp-scan-confirm-height, 72px)", minWidth: 200, borderRadius: 12, border: "none", background: "var(--c-brand, #818cf8)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer" }}
          >
            Scan Next Item
          </button>
        </div>
      )}
    </div>
  );

  if (!metadata) {
    return <div style={{ padding: 32, color: "var(--c-text-muted, #64748b)" }}>Scanner workspace not registered.</div>;
  }

  return <WorkspaceShell metadata={metadata} body={body} />;
};
