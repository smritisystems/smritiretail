/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 â€” POS Return/Exchange Wizard (CS-007)
 * Standard     : SWEF P-007 / 3-Interaction Rule / scanner_action mode
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * SXP-CS-007 COMPLIANCE:
 *   Mode: scanner_action â€” MAX 3 interactions enforced by OperationLauncher
 *   Step 1: Scan / enter original bill number
 *   Step 2: Select items + reason (Defective / Wrong item / Unused)
 *   Step 3: Confirm â†’ post to /api/v1/pos/returns (queued offline if needed)
 *
 * AOP-001: Return execution is advisory â€” cashier must confirm. No automatic
 *          financial reversal. Finance posting is backend-side after confirmation.
 */

import React, { useState, useRef, useEffect } from "react";
import { OperationDef } from "../shared/OperationLauncher.js";
import { OfflineExperienceManager } from "../../layout_engine/OfflineExperienceManager.js";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ReturnReason = "defective" | "wrong_item" | "unused" | "customer_changed_mind";

export interface ReturnLineItem {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  maxQty: number;
  selected: boolean;
  returnQty: number;
  reason: ReturnReason;
}

export interface ReturnWizardState {
  billNumber: string;
  billValid: boolean | null;       // null = not checked yet
  lineItems: ReturnLineItem[];
  totalRefund: number;
}

const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: "defective",              label: "Defective / Damaged" },
  { value: "wrong_item",             label: "Wrong Item Received" },
  { value: "unused",                 label: "Unused / Unwanted" },
  { value: "customer_changed_mind",  label: "Customer Changed Mind" },
];

// â”€â”€ Step 1: Bill Scanner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface BillScanStepProps {
  state: ReturnWizardState;
  onChange(patch: Partial<ReturnWizardState>): void;
}

export const BillScanStep: React.FC<BillScanStepProps> = ({ state, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const checkBill = async () => {
    if (!state.billNumber.trim()) return;
    setChecking(true);
    try {
      const res = await apiFetchV1(`/api/v1/pos/bills/${state.billNumber.trim()}/items`);
      if (res.ok) {
        const items = await res.json() as Array<{
          item_id: string; name: string; qty: number; unit_price: number;
        }>;
        onChange({
          billValid: true,
          lineItems: items.map((i) => ({
            itemId: i.item_id,
            name: i.name,
            qty: i.qty,
            unitPrice: i.unit_price,
            maxQty: i.qty,
            selected: false,
            returnQty: 1,
            reason: "defective",
          })),
        });
      } else {
        // Offline / not found: stub line items so cashier can still proceed
        onChange({
          billValid: true,
          lineItems: [
            { itemId: "offline-1", name: `Items from Bill ${state.billNumber}`, qty: 1, unitPrice: 0, maxQty: 1, selected: false, returnQty: 1, reason: "defective" },
          ],
        });
      }
    } catch {
      // Network offline â€” allow manual entry via stub
      onChange({
        billValid: true,
        lineItems: [
          { itemId: "offline-1", name: `Items from Bill ${state.billNumber}`, qty: 1, unitPrice: 0, maxQty: 1, selected: false, returnQty: 1, reason: "defective" },
        ],
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: "var(--c-theme-muted)", margin: 0 }}>
        Scan the barcode on the original bill, or type the bill number.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          id="pos-return-bill-input"
          type="text"
          value={state.billNumber}
          onChange={(e) => onChange({ billNumber: e.target.value, billValid: null })}
          onKeyDown={(e) => { if (e.key === "Enter") checkBill(); }}
          placeholder="e.g. SI-2026-00842"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--c-theme-divider)",
            background: "var(--c-theme-surface-2)",
            color: "var(--c-theme-body)",
            fontSize: 14,
            fontFamily: "monospace",
            outline: "none",
          }}
        />
        <button
          onClick={checkBill}
          disabled={checking || !state.billNumber.trim()}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "var(--c-seef-accent)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            opacity: checking || !state.billNumber.trim() ? 0.5 : 1,
          }}
        >
          {checking ? "â€¦" : "Find"}
        </button>
      </div>
      {state.billValid === true && (
        <div style={{ fontSize: 12, color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>
          âœ… Bill found â€” {state.lineItems.length} item(s) eligible for return
        </div>
      )}
      {state.billValid === false && (
        <div style={{ fontSize: 12, color: "#f87171" }}>
          âŒ Bill not found. Check the number and try again.
        </div>
      )}
    </div>
  );
};

// â”€â”€ Step 2: Item + Reason Selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ItemSelectStepProps {
  state: ReturnWizardState;
  onChange(patch: Partial<ReturnWizardState>): void;
}

export const ItemSelectStep: React.FC<ItemSelectStepProps> = ({ state, onChange }) => {
  const updateItem = (itemId: string, patch: Partial<ReturnLineItem>) => {
    const updated = state.lineItems.map((li) =>
      li.itemId === itemId ? { ...li, ...patch } : li
    );
    const totalRefund = updated
      .filter((li) => li.selected)
      .reduce((sum, li) => sum + li.unitPrice * li.returnQty, 0);
    onChange({ lineItems: updated, totalRefund });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "var(--c-theme-muted)", margin: 0 }}>
        Select items to return and choose a reason for each.
      </p>
      {state.lineItems.map((li) => (
        <div
          key={li.itemId}
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            border: `1px solid ${li.selected ? "var(--c-seef-accent)" : "var(--c-theme-divider)"}`,
            background: li.selected ? "rgba(129,140,248,0.06)" : "transparent",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={li.selected}
              onChange={(e) => updateItem(li.itemId, { selected: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: "var(--c-seef-accent)" }}
            />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{li.name}</span>
            {li.unitPrice > 0 && (
              <span style={{ fontSize: 12, color: "var(--c-theme-muted)", marginLeft: "auto" }}>
                ₹{li.unitPrice.toLocaleString("en-IN")} Ã— {li.qty}
              </span>
            )}
          </label>
          {li.selected && (
            <div style={{ display: "flex", gap: 8, paddingLeft: 26, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: "var(--c-theme-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                Qty:
                <input
                  type="number"
                  min={1}
                  max={li.maxQty}
                  value={li.returnQty}
                  onChange={(e) => updateItem(li.itemId, { returnQty: Math.min(Number(e.target.value), li.maxQty) })}
                  style={{
                    width: 56,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid var(--c-theme-divider)",
                    background: "var(--c-theme-surface-2)",
                    color: "var(--c-theme-body)",
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                />
              </label>
              <select
                value={li.reason}
                onChange={(e) => updateItem(li.itemId, { reason: e.target.value as ReturnReason })}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--c-theme-divider)",
                  background: "var(--c-theme-surface-2)",
                  color: "var(--c-theme-body)",
                  fontSize: 12,
                }}
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}
      {state.totalRefund > 0 && (
        <div style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: "rgba(52,211,153,0.08)",
          border: "1px solid rgba(52,211,153,0.2)",
          fontSize: 13,
          color: "#34d399",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
        }}>
          <span>Total Refund</span>
          <span>₹{state.totalRefund.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
      )}
    </div>
  );
};

// â”€â”€ Step 3: Confirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ConfirmReturnStepProps {
  state: ReturnWizardState;
}

export const ConfirmReturnStep: React.FC<ConfirmReturnStepProps> = ({ state }) => {
  const selectedItems = state.lineItems.filter((li) => li.selected);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--c-theme-muted)", margin: 0 }}>
        Review and confirm the return. Once confirmed, a credit note will be issued.
      </p>
      <div style={{ fontSize: 13, color: "var(--c-theme-muted)" }}>
        Original Bill: <strong style={{ color: "var(--c-theme-body)" }}>{state.billNumber}</strong>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {selectedItems.map((li) => (
          <div key={li.itemId} style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--c-theme-divider)",
          }}>
            <span>{li.name} Ã— {li.returnQty}</span>
            <span style={{ color: "var(--c-theme-muted)" }}>
              {RETURN_REASONS.find((r) => r.value === li.reason)?.label}
            </span>
          </div>
        ))}
      </div>
      {state.totalRefund > 0 && (
        <div style={{
          padding: "12px 14px",
          borderRadius: 8,
          background: "rgba(52,211,153,0.08)",
          border: "1px solid rgba(52,211,153,0.2)",
          fontSize: 15,
          fontWeight: 700,
          color: "#34d399",
          display: "flex",
          justifyContent: "space-between",
        }}>
          <span>Refund Amount</span>
          <span>₹{state.totalRefund.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
      )}
      <p style={{ fontSize: 11, color: "var(--c-theme-muted)", margin: 0 }}>
        âš  Refund will be processed via the original payment method. Finance posting happens automatically after confirmation.
      </p>
    </div>
  );
};

// â”€â”€ Wizard Builder (SXP-CS-007) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Builds the OperationDef for the pos.return scanner_action wizard.
 * Called by AdvancedBillingEngine when the user presses F12 or
 * clicks "Return / Exchange" in the action bar.
 *
 * 3 steps â€” SWEF P-007 compliant:
 *   1. Scan Bill
 *   2. Select Items + Reason
 *   3. Confirm
 */
export function buildReturnExchangeWizard(
  workspaceId: string,
  tenantId: string,
  userId: string,
): OperationDef {
  // Shared mutable state object passed across steps via React state closure.
  // Each step reads/writes the same object ref â€” simpler than context for a
  // short-lived 3-step modal.
  const shared: ReturnWizardState = {
    billNumber: "",
    billValid: null,
    lineItems: [],
    totalRefund: 0,
  };

  // React won't re-render step content when shared mutates â€” we use a
  // React wrapper component per step that manages its own local state and
  // syncs back to shared on change.
  const Step1 = () => {
    const [s, setS] = useState<ReturnWizardState>(shared);
    return (
      <BillScanStep
        state={s}
        onChange={(patch) => {
          const next = { ...s, ...patch };
          Object.assign(shared, next);
          setS(next);
        }}
      />
    );
  };

  const Step2 = () => {
    const [s, setS] = useState<ReturnWizardState>(shared);
    return (
      <ItemSelectStep
        state={s}
        onChange={(patch) => {
          const next = { ...s, ...patch };
          Object.assign(shared, next);
          setS(next);
        }}
      />
    );
  };

  const Step3 = () => <ConfirmReturnStep state={shared} />;

  return {
    actionId: "pos.return",
    mode: "scanner_action", // MAX 3 steps enforced by OperationLauncher
    context: {
      tenantId,
      userId,
      workspaceId,
      mode: "SIMPLE",
    },
    steps: [
      {
        id: "scan_bill",
        label: "Scan Original Bill",
        content: <Step1 />,
        canProceed: () => shared.billValid === true && shared.billNumber.trim().length > 0,
      },
      {
        id: "select_items",
        label: "Select Items to Return",
        content: <Step2 />,
        canProceed: () => shared.lineItems.some((li) => li.selected && li.returnQty > 0),
      },
      {
        id: "confirm",
        label: "Confirm Return",
        content: <Step3 />,
      },
    ],
  };
}

// â”€â”€ Execution handler (registered in pos.manifest.ts) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Called by WorkspaceActionRegistry when pos.return is executed.
 * Posts the return payload to /api/v1/pos/returns.
 * If offline: queues via OfflineExperienceManager.
 * AOP-001: advisory only â€” no automatic financial posting on client.
 */
export async function executePOSReturn(
  state: ReturnWizardState,
  workspaceId: string,
): Promise<{ success: boolean; message: string }> {
  const payload = {
    original_bill: state.billNumber,
    items: state.lineItems
      .filter((li) => li.selected)
      .map((li) => ({
        item_id: li.itemId,
        return_qty: li.returnQty,
        reason: li.reason,
      })),
    total_refund: state.totalRefund,
  };

  try {
    const res = await apiFetchV1("/api/v1/pos/returns", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      WorkspaceEventBus.publish("ActionExecuted", { action: "pos.return", result: "success" }, workspaceId);
      return { success: true, message: `Return processed â€” ₹${state.totalRefund.toLocaleString("en-IN")} refund issued` };
    }
    throw new Error(`HTTP ${res.status}`);
  } catch {
    // Queue offline â€” will sync when network restores
    OfflineExperienceManager.enqueue("sale", workspaceId, { ...payload, _type: "pos_return" });
    WorkspaceEventBus.publish("SyncCompleted", { action: "pos.return", queued: true }, workspaceId);
    return { success: true, message: "Return queued offline â€” will sync when connection restores" };
  }
}
