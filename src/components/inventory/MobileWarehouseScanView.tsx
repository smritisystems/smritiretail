/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 â€” Mobile Warehouse Scan View (Scanner Zone)
 * Standard     : SXP Constitution v1.0 / SWEF P-007 / 3-Interaction Rule (ENFORCED)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * SWEF P-007 â€” 3-Interaction Rule (FROZEN):
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

// â”€â”€ 3-Interaction State Machine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ScanStep = "scan" | "confirm" | "done";

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      background: "var(--c-theme-surface-2)",
      overflow: "hidden",
    }}>
      {/* â”€â”€ STEP 1: SCAN â”€â”€ */}
      {step === "scan" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 24, gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>ðŸ“·</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--c-theme-body)", margin: 0 }}>
              Scan Item
            </h2>
            <p style={{ fontSize: 13, color: "var(--c-theme-muted)", marginTop: 6 }}>
              Point scanner at barcode or type manually
            </p>
          </div>

          <form onSubmit={handleScanSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              ref={scanInputRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan barcodeâ€¦"
              autoComplete="off"
              style={{
                height: "var(--sxp-scan-input-height, 56px)",
                padding: "0 20px",
                borderRadius: 12,
                border: "2px solid var(--c-seef-accent)",
                background: "rgba(99,102,241,0.06)",
                color: "var(--c-theme-body)",
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
                background: barcode.trim() ? "var(--c-seef-accent)" : "rgba(255,255,255,0.08)",
                color: "#fff",
                fontSize: 18,
                fontWeight: 700,
                cursor: barcode.trim() ? "pointer" : "not-allowed",
                opacity: barcode.trim() ? 1 : 0.4,
                transition: "all var(--sxp-motion-action, 150ms)",
                width: "100%",
              }}
            >
              Next â†’
            </button>
          </form>
        </div>
      )}

      {/* â”€â”€ STEP 2: CONFIRM QUANTITY â”€â”€ */}
      {step === "confirm" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 24, gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--c-theme-muted)", marginBottom: 4 }}>Scanned</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--c-theme-body)", fontFamily: "monospace", letterSpacing: "0.1em" }}>
              {barcode}
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 13, color: "var(--c-theme-muted)" }}>How many units?</div>

            {/* Large quantity input â€” 44px min for touch */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                style={{ width: 52, height: 52, borderRadius: 10, border: "1px solid var(--c-theme-divider)", background: "rgba(255,255,255,0.05)", color: "var(--c-theme-body)", fontSize: 24, cursor: "pointer" }}
              >
                âˆ’
              </button>
              <div style={{ fontSize: 48, fontWeight: 800, minWidth: 80, textAlign: "center", color: "var(--c-theme-body)", fontFamily: "monospace" }}>
                {qty}
              </div>
              <button
                onClick={() => setQty((q) => q + 1)}
                style={{ width: 52, height: 52, borderRadius: 10, border: "1px solid var(--c-theme-divider)", background: "rgba(255,255,255,0.05)", color: "var(--c-theme-body)", fontSize: 24, cursor: "pointer" }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={handleReset} style={{ flex: 1, height: 52, borderRadius: 12, border: "1px solid var(--c-theme-divider)", background: "transparent", color: "var(--c-theme-muted)", fontSize: 15, cursor: "pointer" }}>
              â† Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={executing}
              style={{ flex: 2, height: "var(--sxp-scan-confirm-height, 72px)", borderRadius: 12, border: "none", background: "var(--c-seef-accent)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer" }}
            >
              {executing ? "Savingâ€¦" : `Receive ${qty} unit${qty > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ STEP 3: DONE â”€â”€ */}
      {step === "done" && result && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 24, gap: 24, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontSize: 64 }}>{result.success ? "âœ…" : "âŒ"}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: result.success ? "#22c55e" : "#ef4444" }}>
            {result.success ? "Done!" : "Error"}
          </div>
          <div style={{ fontSize: 14, color: "var(--c-theme-muted)", maxWidth: 280 }}>
            {result.message}
          </div>
          <button
            onClick={handleReset}
            style={{ height: "var(--sxp-scan-confirm-height, 72px)", minWidth: 200, borderRadius: 12, border: "none", background: "var(--c-seef-accent)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer" }}
          >
            Scan Next Item
          </button>
        </div>
      )}
    </div>
  );

  if (!metadata) {
    return <div style={{ padding: 32, color: "var(--c-theme-muted)" }}>Scanner workspace not registered.</div>;
  }

  return <WorkspaceShell metadata={metadata} body={body} />;
};
