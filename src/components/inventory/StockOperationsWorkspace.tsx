/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Stock Operations Workspace (Operator Zone)
 * Standard     : SXP Constitution v1.0 / SWEF P-007 / 3-Interaction Rule
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Renders: OperationLauncher with 6 inventory actions (adaptive-filtered)
 * Zone: operator
 */

import React, { useState } from "react";
import { WorkspaceShell } from "../../layout_engine/components/WorkspaceShell.js";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";
import { OperationLauncher, OperationDef } from "../shared/OperationLauncher.js";
import { useSmritiExperience } from "../../context/SmritiExperienceContext.js";
import { INVENTORY_WORKSPACE_IDS } from "./inventory.manifest.js";

// ── Receive Stock Wizard Steps ────────────────────────────────────────────────

const buildReceiveStockWizard = (): OperationDef["steps"] => [
  {
    id: "scan",
    label: "Scan or Search Item",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 13, color: "var(--c-text-secondary, #94a3b8)", margin: 0 }}>
          Scan the barcode or search for the product you are receiving.
        </p>
        <input
          autoFocus
          placeholder="Scan barcode or type product name…"
          style={{
            height: "var(--sxp-scan-input-height, 56px)",
            padding: "0 16px",
            borderRadius: 10,
            border: "2px solid var(--c-brand, #818cf8)",
            background: "rgba(99,102,241,0.06)",
            color: "var(--c-text-primary, #e2e8f0)",
            fontSize: 16,
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      </div>
    ),
  },
  {
    id: "quantity",
    label: "Enter Quantity Received",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 13, color: "var(--c-text-secondary, #94a3b8)", margin: 0 }}>
          How many units are you receiving?
        </p>
        <input
          type="number"
          min={1}
          defaultValue={1}
          autoFocus
          style={{
            height: "var(--sxp-scan-confirm-height, 72px)",
            padding: "0 20px",
            borderRadius: 10,
            border: "1px solid var(--c-border, rgba(255,255,255,0.1))",
            background: "rgba(255,255,255,0.04)",
            color: "var(--c-text-primary, #e2e8f0)",
            fontSize: 28,
            fontWeight: 700,
            textAlign: "center",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      </div>
    ),
  },
  {
    id: "confirm",
    label: "Confirm Receipt",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ padding: "16px 20px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#22c55e", marginBottom: 8 }}>Ready to receive</div>
          <div style={{ fontSize: 13, color: "var(--c-text-secondary, #94a3b8)" }}>
            Review the details above and click Confirm to record this stock receipt.
          </div>
        </div>
      </div>
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const StockOperationsWorkspace: React.FC = () => {
  const { mode } = useSmritiExperience();
  const metadata = WorkspaceRegistry.get(INVENTORY_WORKSPACE_IDS.OPERATIONS)!;

  const executionContext = {
    tenantId: "default",
    userId: "current_user",
    workspaceId: INVENTORY_WORKSPACE_IDS.OPERATIONS,
    mode,
  };

  const getOperationDef = (actionId: string): OperationDef | null => {
    switch (actionId) {
      case "receive_stock":
        return {
          actionId: "receive_stock",
          mode: "wizard",
          context: executionContext,
          steps: buildReceiveStockWizard(),
        };
      case "adjust_stock":
        return {
          actionId: "adjust_stock",
          mode: "quick_action",
          context: executionContext,
          steps: [
            {
              id: "adjust",
              label: "Adjust Stock Quantity",
              content: (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--c-text-secondary, #94a3b8)", margin: 0 }}>
                    Enter the new quantity or the difference (+/-).
                  </p>
                  <input
                    type="number"
                    autoFocus
                    defaultValue={0}
                    style={{ height: 56, padding: "0 16px", borderRadius: 10, border: "1px solid var(--c-border, rgba(255,255,255,0.1))", background: "rgba(255,255,255,0.04)", color: "var(--c-text-primary, #e2e8f0)", fontSize: 20, width: "100%", boxSizing: "border-box" }}
                  />
                </div>
              ),
            },
          ],
        };
      case "transfer_stock":
        return {
          actionId: "transfer_stock",
          mode: "wizard",
          context: executionContext,
          steps: [
            {
              id: "select_item",
              label: "Select Item to Transfer",
              content: <input autoFocus placeholder="Scan or search item…" style={{ height: 56, padding: "0 16px", borderRadius: 10, border: "2px solid var(--c-brand, #818cf8)", background: "rgba(99,102,241,0.06)", color: "var(--c-text-primary, #e2e8f0)", fontSize: 16, width: "100%", boxSizing: "border-box" }} />,
            },
            {
              id: "select_destination",
              label: "Select Destination",
              content: (
                <select style={{ height: 56, padding: "0 16px", borderRadius: 10, border: "1px solid var(--c-border)", background: "var(--c-surface, #1a1a2e)", color: "var(--c-text-primary, #e2e8f0)", fontSize: 15, width: "100%", boxSizing: "border-box" }}>
                  <option>Main Store</option>
                  <option>Warehouse</option>
                  <option>Branch 2</option>
                </select>
              ),
            },
            {
              id: "confirm_transfer",
              label: "Confirm Transfer",
              content: <div style={{ padding: "16px 20px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", fontSize: 13, color: "var(--c-text-secondary, #94a3b8)" }}>Confirm the transfer details above.</div>,
            },
          ],
        };
      default:
        return null; // Direct execution for scan_item, reserve_stock, write_off
    }
  };

  if (!metadata) {
    return <div style={{ padding: 32, color: "var(--c-text-muted, #64748b)" }}>Inventory operations workspace not registered.</div>;
  }

  return (
    <WorkspaceShell
      metadata={metadata}
      body={
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text-primary, #e2e8f0)", margin: 0 }}>
              What do you want to do?
            </h2>
            <p style={{ fontSize: 13, color: "var(--c-text-muted, #64748b)", marginTop: 4 }}>
              {mode === "SIMPLE"
                ? "Quick stock actions for your shift."
                : "Manage stock movements, transfers, and reservations."}
            </p>
          </div>
          <OperationLauncher
            actionIds={metadata.actions}
            getOperationDef={getOperationDef}
            executionContext={executionContext}
          />
        </div>
      }
    />
  );
};
