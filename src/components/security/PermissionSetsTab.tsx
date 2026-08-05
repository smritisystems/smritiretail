/**
 * Project      : SMRITI Retail OS
 * Component    : Action-Based Permission Sets Matrix Workspace
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Key, Shield, Check, X, Plus, Search, Filter } from "lucide-react";

interface ActionPermissionRow {
  resource: string;
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canPrint: boolean;
  canExport: boolean;
}

const SAMPLE_PERMISSIONS: ActionPermissionRow[] = [
  { resource: "Sales.Invoice", module: "Sales", canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: false, canPrint: true, canExport: true },
  { resource: "Sales.POSBill", module: "Sales", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false, canPrint: true, canExport: false },
  { resource: "Purchase.Order", module: "Purchase", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canPrint: false, canExport: false },
  { resource: "Inventory.StockLedger", module: "Inventory", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canPrint: true, canExport: true },
  { resource: "Masters.Item", module: "Masters", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canPrint: false, canExport: false },
  { resource: "System.Settings", module: "Administration", canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canPrint: false, canExport: false }
];

export const PermissionSetsTab: React.FC = () => {
  const [permissions, setPermissions] = useState<ActionPermissionRow[]>(SAMPLE_PERMISSIONS);
  const [selectedPSet, setSelectedPSet] = useState("PSET_RETAIL_CASHIER");

  const toggleAction = (index: number, key: keyof ActionPermissionRow) => {
    const updated = [...permissions];
    if (typeof updated[index][key] === "boolean") {
      (updated[index][key] as boolean) = !updated[index][key];
      setPermissions(updated);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Header */}
      <div className="bg-theme-surface-1 p-4 rounded-lg border border-theme-divider flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-theme-text flex items-center gap-2">
            Action-Based Permission Sets Matrix
            <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
              Domain.Resource.Action
            </span>
          </h2>
          <p className="text-xs text-theme-muted">
            Configure fine-grained capability actions (View, Create, Edit, Delete, Approve, Print, Export) per resource.
          </p>
        </div>

        <select
          value={selectedPSet}
          onChange={(e) => setSelectedPSet(e.target.value)}
          className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-text font-semibold"
        >
          <option value="PSET_RETAIL_CASHIER">Cashier Standard Permission Set</option>
          <option value="PSET_RETAIL_MANAGER">Store Manager Permission Set</option>
          <option value="PSET_INVENTORY">Inventory Specialist Permission Set</option>
        </select>
      </div>

      {/* Permission Table */}
      <div className="bg-theme-surface-1 rounded-lg border border-theme-divider overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-theme-surface-2/60 border-b border-theme-divider text-theme-muted font-bold">
                <th className="p-3">Domain Resource</th>
                <th className="p-3 text-center">View</th>
                <th className="p-3 text-center">Create</th>
                <th className="p-3 text-center">Edit</th>
                <th className="p-3 text-center">Delete</th>
                <th className="p-3 text-center">Approve</th>
                <th className="p-3 text-center">Print</th>
                <th className="p-3 text-center">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-divider font-mono">
              {permissions.map((p, idx) => (
                <tr key={p.resource} className="hover:bg-theme-surface-2/30">
                  <td className="p-3 font-bold text-theme-text flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                      {p.module}
                    </span>
                    {p.resource}
                  </td>
                  {["canView", "canCreate", "canEdit", "canDelete", "canApprove", "canPrint", "canExport"].map((actionKey) => {
                    const isAllowed = p[actionKey as keyof ActionPermissionRow] as boolean;
                    return (
                      <td key={actionKey} className="p-3 text-center">
                        <button
                          onClick={() => toggleAction(idx, actionKey as keyof ActionPermissionRow)}
                          className={`w-6 h-6 rounded inline-flex items-center justify-center transition border ${
                            isAllowed
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                          }`}
                        >
                          {isAllowed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
