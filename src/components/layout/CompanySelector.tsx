/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-14
 * Modified     : 2026-08-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check, AlertCircle, RefreshCw, GitBranch } from 'lucide-react';
import { apiFetchV1 } from '../../lib/apiFetchV1';

export interface CompanyOption {
  company_id: string;
  company_code: string;
  company_name: string;
  status?: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code: string;
  company: string;
}

export const CompanySelector: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    return localStorage.getItem("smriti_company_id") || "COMP-001";
  });
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return localStorage.getItem("smriti_branch_id") || "MAIN";
  });
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadCompanyRegistry = async () => {
      try {
        const data = await apiFetchV1('/auth/tenants');
        if (isMounted && data && Array.isArray(data.companies) && data.companies.length > 0) {
          const mapped: CompanyOption[] = data.companies.map((item: any) => ({
            company_id: item.id || "COMP-001",
            company_code: (item.id || "COMP-001").replace(/^COMP-/, "") || "001",
            company_name: item.name || "Tattly Threads",
            status: item.status || "READY"
          }));
          setCompanies(mapped);
          setBranches(Array.isArray(data.branches) ? data.branches : []);
        }
      } catch {
        // Retain current session state on fetch failure
      }
    };

    loadCompanyRegistry();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "F3" || e.code === "F3")) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectBranch = async (comp: CompanyOption, targetBranch: BranchOption) => {
    if (comp.company_id === selectedCompanyId && targetBranch.id === selectedBranchId) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    setError(null);

    try {
      const switchPayload = {
        target_company_id: comp.company_id,
        target_branch_id: targetBranch.id,
      };

      const res = await apiFetchV1<any>('/auth/switch-context', {
        method: 'POST',
        body: JSON.stringify(switchPayload),
      });

      if (res && res.access_token) {
        // 2. Commit updated token and company/branch context ONLY on verified backend success
        localStorage.setItem("smriti_jwt_token", res.access_token);
        localStorage.setItem("smriti_company_id", comp.company_id);
        localStorage.setItem("smriti_company_code", comp.company_code);
        localStorage.setItem("smriti_company_name", comp.company_name);
        localStorage.setItem("smriti_branch_id", targetBranch.id);
        localStorage.setItem("smriti_branch_name", targetBranch.name);
        localStorage.setItem("smriti_branch_code", targetBranch.code);
        setSelectedCompanyId(comp.company_id);
        setSelectedBranchId(targetBranch.id);
        setIsOpen(false);
        // Reload to re-initialize layout and workspace subscriptions with the committed company/branch token
        window.location.reload();
      } else {
        throw new Error("Invalid response received during context switch.");
      }
    } catch (err: any) {
      console.error("[CompanySelector] In-session switch failed:", err);
      // 3. ON FAILURE: DO NOT change localStorage, DO NOT reload, keep current context intact
      setSwitching(false);
      setError("Unable to switch branch workspace. Your current workspace remains active.");
    }
  };

  const currentComp = companies.find(c => c.company_id === selectedCompanyId) || {
    company_id: selectedCompanyId,
    company_code: selectedCompanyId.replace(/^COMP-/, "") || "001",
    company_name: localStorage.getItem("smriti_company_name") || "SMRITI Workspace",
    status: "READY"
  };

  const currentBranch = branches.find(b => b.id === selectedBranchId) || {
    id: selectedBranchId,
    name: localStorage.getItem("smriti_branch_name") || "Main Store",
    code: localStorage.getItem("smriti_branch_code") || "MAIN",
    company: selectedCompanyId
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => {
          setError(null);
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 transition-all text-xs font-bold shadow-md cursor-pointer select-none"
        title="Switch Active Business Company & Branch (Alt+F3)"
      >
        <Building2 className="w-4 h-4 text-emerald-300 shrink-0" />
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="max-w-[140px] truncate font-display">{currentComp.company_name}</span>
            <span className="px-1 py-0.2 text-[9px] font-mono font-bold bg-blue-700 text-white rounded border border-blue-500">
              {currentComp.company_code}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-blue-200 font-mono opacity-90">
            <GitBranch className="w-2.5 h-2.5" />
            <span className="max-w-[120px] truncate">{currentBranch.name}</span>
            <span>({currentBranch.code})</span>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-blue-200 shrink-0 ml-0.5" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              if (!switching) {
                setIsOpen(false);
                setError(null);
              }
            }} 
          />
          <div className="absolute right-0 mt-2 w-80 rounded-xl bg-theme-surface-2 border border-theme-divider shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in duration-150">
            <div className="px-3.5 py-2 text-[10px] font-mono font-bold text-theme-muted border-b border-theme-divider uppercase tracking-wider bg-theme-surface-3 flex items-center justify-between">
              <span>Select Organization Workspace</span>
              {switching && <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />}
            </div>

            {/* Error Message if context switch fails */}
            {error && (
              <div className="m-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] flex items-start gap-2 font-mono">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />
                <div className="leading-tight">{error}</div>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto divide-y divide-theme-divider">
              {companies.map((comp) => {
                const compBranches = branches.filter((b) => b.company === comp.company_id);
                const isCompActive = comp.company_id === selectedCompanyId;

                return (
                  <div key={comp.company_id} className="p-2">
                    <div className="px-2 py-1 flex items-center justify-between text-xs font-bold text-theme-body">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{comp.company_name}</span>
                      </div>
                      <span className="text-[10px] font-mono bg-theme-surface-3 px-1.5 py-0.5 rounded border border-theme-divider">
                        {comp.company_code}
                      </span>
                    </div>

                    <div className="mt-1 space-y-0.5 pl-3">
                      {compBranches.length === 0 ? (
                        <div className="text-[11px] text-theme-muted italic px-2 py-1">
                          No branches registered
                        </div>
                      ) : (
                        compBranches.map((br) => {
                          const isBranchSelected = isCompActive && br.id === selectedBranchId;
                          return (
                            <button
                              key={br.id}
                              disabled={switching}
                              onClick={() => handleSelectBranch(comp, br)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between hover:bg-theme-surface-hover transition-colors cursor-pointer ${
                                isBranchSelected
                                  ? 'text-blue-700 font-bold bg-blue-50 border-l-2 border-blue-600'
                                  : 'text-theme-muted hover:text-theme-body'
                              } ${switching ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                <GitBranch className={`w-3 h-3 ${isBranchSelected ? 'text-blue-600' : 'text-theme-muted'}`} />
                                <span className="truncate">{br.name}</span>
                                <span className="text-[9px] font-mono opacity-70">({br.code})</span>
                              </div>
                              {isBranchSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
