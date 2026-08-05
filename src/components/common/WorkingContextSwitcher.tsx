/**
 * Project      : SMRITI Retail OS
 * Component    : Active Working Context Switcher / Assignment Selector
 * Standard     : USR-005 & WNG-004 Compliant (Multi-Company/Branch Scoping)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Building, Store, Warehouse, Shield, Check, ChevronDown, RefreshCw, X, Sparkles } from "lucide-react";

export interface UserContextAssignment {
  id: string;
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
  storeId?: string;
  storeName?: string;
  warehouseId?: string;
  warehouseName?: string;
  roleCode: string;
  roleName: string;
  effectiveScope: string;
  isCurrent: boolean;
}

const SAMPLE_ASSIGNMENTS: UserContextAssignment[] = [
  {
    id: "assign-1",
    companyId: "comp-a",
    companyName: "Smriti Enterprise Pvt Ltd (Company A)",
    branchId: "br-gkp",
    branchName: "Gorakhpur Flagship Branch",
    storeId: "stor-gkp-01",
    storeName: "Main Flagship Store",
    roleCode: "STORE_MANAGER",
    roleName: "Store Manager",
    effectiveScope: "STORE",
    isCurrent: true
  },
  {
    id: "assign-2",
    companyId: "comp-b",
    companyName: "Smriti Books Distributing Co (Company B)",
    branchId: "br-mum",
    branchName: "Mumbai Commercial Branch",
    roleCode: "VIEWER",
    roleName: "Auditor & Viewer",
    effectiveScope: "COMPANY",
    isCurrent: false
  },
  {
    id: "assign-3",
    companyId: "comp-a",
    companyName: "Smriti Enterprise Pvt Ltd (Company A)",
    branchId: "br-gkp",
    branchName: "Gorakhpur Central Logistics",
    warehouseId: "wh-logistics-01",
    warehouseName: "Central Logistics Warehouse",
    roleCode: "INVENTORY_MANAGER",
    roleName: "Inventory Manager",
    effectiveScope: "WAREHOUSE",
    isCurrent: false
  }
];

interface WorkingContextSwitcherProps {
  onClose?: () => void;
  onContextSwitched?: (assignment: UserContextAssignment) => void;
}

export const WorkingContextSwitcher: React.FC<WorkingContextSwitcherProps> = ({ onClose, onContextSwitched }) => {
  const [assignments, setAssignments] = useState<UserContextAssignment[]>(SAMPLE_ASSIGNMENTS);

  const selectContext = (id: string) => {
    const updated = assignments.map((a) => ({
      ...a,
      isCurrent: a.id === id
    }));
    setAssignments(updated);
    const selected = updated.find((a) => a.id === id);
    if (selected && onContextSwitched) {
      onContextSwitched(selected);
    }
    if (onClose) onClose();
  };

  const active = assignments.find((a) => a.isCurrent) || assignments[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-theme-surface-1 border border-theme-divider rounded-xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-theme-text">Select Active Working Context</h2>
              <p className="text-xs text-theme-muted">Multi-Company, Branch & Role Assignment Context Switcher</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-surface-3">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Current Active Banner */}
        <div className="p-4 bg-blue-500/5 border-b border-theme-divider flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Active Working Context</div>
            <div className="text-sm font-bold text-theme-text">{active.companyName}</div>
            <div className="text-xs text-theme-muted flex items-center gap-2 mt-0.5">
              <span>{active.branchName}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{active.roleName}</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold">
            Scope: {active.effectiveScope}
          </span>
        </div>

        {/* Assignment Options List */}
        <div className="p-6 space-y-3 overflow-auto max-h-[60vh]">
          <div className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-1">Available Role Assignments</div>
          {assignments.map((a) => (
            <div
              key={a.id}
              onClick={() => selectContext(a.id)}
              className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                a.isCurrent
                  ? "bg-blue-500/10 border-blue-500/40 text-theme-text shadow-sm"
                  : "bg-theme-surface-2/40 border-theme-divider text-theme-muted hover:text-theme-text hover:bg-theme-surface-2/70"
              }`}
            >
              <div className="space-y-1">
                <div className="text-xs font-bold text-theme-text flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-blue-400" />
                  {a.companyName}
                </div>

                <div className="text-xs text-theme-muted flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-indigo-400" />
                    {a.storeName || a.branchName}
                  </span>
                  {a.warehouseName && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Warehouse className="w-3.5 h-3.5" />
                      {a.warehouseName}
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5 pt-1">
                  <Shield className="w-3.5 h-3.5" />
                  {a.roleName} ({a.roleCode})
                </div>
              </div>

              {a.isCurrent ? (
                <div className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center shadow">
                  <Check className="w-4 h-4" />
                </div>
              ) : (
                <button className="px-3 py-1 bg-theme-surface-3 hover:bg-blue-600 text-theme-text hover:text-white rounded-lg text-xs font-bold transition">
                  Switch Context
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
