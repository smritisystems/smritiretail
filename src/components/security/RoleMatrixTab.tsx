/**
 * Project      : SMRITI Retail OS
 * Component    : Role Matrix & System Role Templates Workspace
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Shield, Copy, Plus, ChevronRight, Check, Lock, Sparkles, Layers } from "lucide-react";

interface RoleTemplate {
  code: string;
  name: string;
  category: "Platform" | "Tenant" | "Retail" | "Industry Packs";
  description: string;
  parentRole?: string;
  isSystem: boolean;
}

const SYSTEM_ROLE_TEMPLATES: RoleTemplate[] = [
  { code: "PLATFORM_ADMIN", name: "Platform Administrator", category: "Platform", description: "Global platform administration & tenant provisioning", isSystem: true },
  { code: "TENANT_ADMIN", name: "Tenant Administrator", category: "Tenant", description: "Tenant organization & subscription administration", isSystem: true },
  { code: "COMPANY_ADMIN", name: "Company Administrator", category: "Tenant", description: "Full legal entity & company business management", parentRole: "TENANT_ADMIN", isSystem: true },
  { code: "STORE_MANAGER", name: "Store Manager", category: "Retail", description: "Complete retail store operational management", parentRole: "COMPANY_ADMIN", isSystem: true },
  { code: "CASHIER", name: "Retail Cashier", category: "Retail", description: "POS sales billing, holding bills, & customer lookup", parentRole: "STORE_MANAGER", isSystem: true },
  { code: "INVENTORY_MANAGER", name: "Inventory Manager", category: "Retail", description: "Stock ledger, transfers, bin tracking, & rebalancing", parentRole: "STORE_MANAGER", isSystem: true },
  { code: "PURCHASE_MANAGER", name: "Procurement Manager", category: "Retail", description: "Purchase requisitions, PO creation, & supplier management", parentRole: "COMPANY_ADMIN", isSystem: true },
  { code: "ACCOUNTANT", name: "Financial Accountant", category: "Retail", description: "General ledger, journal vouchers, & GST returns", parentRole: "COMPANY_ADMIN", isSystem: true },
  { code: "RESTAURANT_CAPTAIN", name: "Restaurant Captain", category: "Industry Packs", description: "Table ordering, KOT dispatch, & bill splitting", parentRole: "CASHIER", isSystem: true },
  { code: "PHARMACIST", name: "Licensed Pharmacist", category: "Industry Packs", description: "Batch tracking, expiry management, & RX verification", parentRole: "STORE_MANAGER", isSystem: true }
];

export const RoleMatrixTab: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<RoleTemplate>(SYSTEM_ROLE_TEMPLATES[3]);
  const [clonedSuccess, setClonedSuccess] = useState(false);

  const handleClone = () => {
    setClonedSuccess(true);
    setTimeout(() => setClonedSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header Banner */}
      <div className="bg-theme-surface-1 p-4 rounded-lg border border-theme-divider flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-theme-text flex items-center gap-2">
            System Role Templates & Dynamic Hierarchy
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Immutable Templates
            </span>
          </h2>
          <p className="text-xs text-theme-muted">
            System templates are read-only. Customers clone templates to create custom tenant roles.
          </p>
        </div>

        <button
          onClick={handleClone}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow flex items-center gap-2 transition"
        >
          <Copy className="w-3.5 h-3.5" />
          {clonedSuccess ? "Role Cloned to Tenant!" : "Clone Template to Custom Role"}
        </button>
      </div>

      {/* Main Grid: Role List vs Role Detail Tree */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
        {/* Template List */}
        <div className="bg-theme-surface-1 rounded-lg border border-theme-divider p-3 flex flex-col gap-2 overflow-auto">
          <div className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-1">Seeded Role Templates</div>
          {SYSTEM_ROLE_TEMPLATES.map((r) => (
            <div
              key={r.code}
              onClick={() => setSelectedRole(r)}
              className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                selectedRole.code === r.code
                  ? "bg-emerald-500/10 border-emerald-500/30 text-theme-text"
                  : "bg-theme-surface-2/40 border-theme-divider text-theme-muted hover:text-theme-text"
              }`}
            >
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  {r.isSystem && <Lock className="w-3 h-3 text-amber-400" />}
                  {r.name}
                </div>
                <div className="text-[10px] text-theme-muted font-mono">{r.code}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-theme-muted" />
            </div>
          ))}
        </div>

        {/* Selected Role Detail & Inheritance Hierarchy */}
        <div className="md:col-span-2 bg-theme-surface-1 rounded-lg border border-theme-divider p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-theme-divider pb-3">
            <div>
              <h3 className="text-base font-bold text-theme-text flex items-center gap-2">
                {selectedRole.name}
                <span className="text-xs font-mono font-normal text-blue-400">({selectedRole.code})</span>
              </h3>
              <p className="text-xs text-theme-muted mt-1">{selectedRole.description}</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
              {selectedRole.category} Domain
            </span>
          </div>

          {/* Inheritance Visualizer Tree */}
          <div>
            <h4 className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-2">Role Inheritance Tree</h4>
            <div className="p-4 bg-theme-surface-2/60 rounded-lg border border-theme-divider font-mono text-xs space-y-2">
              {selectedRole.parentRole && (
                <div className="text-theme-muted flex items-center gap-2">
                  <span>Parent Role:</span>
                  <span className="text-indigo-400 font-bold">{selectedRole.parentRole}</span>
                </div>
              )}
              <div className="text-emerald-400 font-bold flex items-center gap-2">
                <span>Current Role:</span>
                <span>{selectedRole.code}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
