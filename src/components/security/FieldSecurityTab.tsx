/**
 * Project      : SMRITI Retail OS
 * Component    : Field-Level Security (FLS) 6-State Workspace
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { ShieldAlert, Eye, EyeOff, Lock, Edit2, Calculator, Check } from "lucide-react";

export type FLSState = "VISIBLE" | "HIDDEN" | "READ_ONLY" | "MASKED" | "EDITABLE" | "CALCULATED";

interface FieldSecurityRow {
  resource: string;
  fieldName: string;
  cashierState: FLSState;
  managerState: FLSState;
}

const SAMPLE_FLS_ROWS: FieldSecurityRow[] = [
  { resource: "Item", fieldName: "buying_price", cashierState: "HIDDEN", managerState: "VISIBLE" },
  { resource: "Item", fieldName: "margin_percent", cashierState: "HIDDEN", managerState: "VISIBLE" },
  { resource: "Item", fieldName: "cost_price", cashierState: "HIDDEN", managerState: "VISIBLE" },
  { resource: "Item", fieldName: "mrp", cashierState: "VISIBLE", managerState: "EDITABLE" },
  { resource: "Item", fieldName: "selling_price", cashierState: "VISIBLE", managerState: "EDITABLE" },
  { resource: "Customer", fieldName: "mobile_number", cashierState: "MASKED", managerState: "VISIBLE" }
];

export const FieldSecurityTab: React.FC = () => {
  const [flsRows, setFlsRows] = useState<FieldSecurityRow[]>(SAMPLE_FLS_ROWS);

  const updateCashierState = (idx: number, newState: FLSState) => {
    const updated = [...flsRows];
    updated[idx].cashierState = newState;
    setFlsRows(updated);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Banner */}
      <div className="bg-theme-surface-1 p-4 rounded-lg border border-theme-divider flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-theme-text flex items-center gap-2">
            Field-Level Security (FLS) Matrix
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              6 FLS Masking States
            </span>
          </h2>
          <p className="text-xs text-theme-muted">
            Define visibility and editability states (Visible, Hidden, Read-Only, Masked, Editable, Calculated) per field and role.
          </p>
        </div>
      </div>

      {/* FLS Table */}
      <div className="bg-theme-surface-1 rounded-lg border border-theme-divider overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-theme-surface-2/60 border-b border-theme-divider text-theme-muted font-bold">
                <th className="p-3">Resource Entity</th>
                <th className="p-3">Field Name</th>
                <th className="p-3 text-center">Cashier Role State</th>
                <th className="p-3 text-center">Store Manager Role State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-divider font-mono">
              {flsRows.map((r, idx) => (
                <tr key={`${r.resource}-${r.fieldName}`} className="hover:bg-theme-surface-2/30">
                  <td className="p-3 font-bold text-theme-text">{r.resource}</td>
                  <td className="p-3 font-bold text-blue-400">{r.fieldName}</td>
                  <td className="p-3 text-center">
                    <select
                      value={r.cashierState}
                      onChange={(e) => updateCashierState(idx, e.target.value as FLSState)}
                      className={`border rounded px-2 py-1 text-xs font-bold ${
                        r.cashierState === "HIDDEN"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : r.cashierState === "MASKED"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      <option value="VISIBLE">VISIBLE</option>
                      <option value="HIDDEN">HIDDEN</option>
                      <option value="READ_ONLY">READ_ONLY</option>
                      <option value="MASKED">MASKED</option>
                      <option value="EDITABLE">EDITABLE</option>
                      <option value="CALCULATED">CALCULATED</option>
                    </select>
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                      {r.managerState}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
