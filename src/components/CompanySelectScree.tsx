/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-18
 * Modified     : 2026-08-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Building2, 
  CheckCircle2, 
  ArrowRight, 
  Search, 
  LogOut, 
  AlertCircle, 
  Layers,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { APP_VERSION } from "../config/version.ts";

export interface CompanyItem {
  id: string;
  name: string;
  gstNumber?: string | null;
  status: string;
}

export interface BranchItem {
  id: string;
  name: string;
  code: string;
  company: string;
}

export interface SelectedContextData {
  companyId: string;
  companyName: string;
  companyCode?: string;
  branchId: string;
  branchName: string;
  token?: string;
}

interface CompanySelectionScreenProps {
  currentUser: { 
    role: string; 
    name: string; 
    companyId?: string; 
    branchId?: string 
  };
  onCompanySelected: (context: SelectedContextData) => void;
  onLogout: () => void;
}

export const CompanySelectionScreen: React.FC<CompanySelectionScreenProps> = ({
  currentUser,
  onCompanySelected,
  onLogout,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [switching, setSwitching] = useState<boolean>(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Fetch authorized tenant list from authoritative /auth/tenants endpoint
  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchV1("/auth/tenants");
      const fetchedCompanies: CompanyItem[] = data?.companies || [];
      const fetchedBranches: BranchItem[] = data?.branches || [];

      setCompanies(fetchedCompanies);
      setBranches(fetchedBranches);

      // Case B: Exactly 1 company available -> Auto-select
      if (fetchedCompanies.length === 1) {
        const singleComp = fetchedCompanies[0];
        const matchingBranches = fetchedBranches.filter((b) => b.company === singleComp.id);
        
        if (matchingBranches.length === 0) {
          setError(`No permitted branch assigned for ${singleComp.name}. Please contact your administrator.`);
          setLoading(false);
          return;
        }

        const selectedBranch = matchingBranches.find(b => b.id === currentUser?.branchId) || matchingBranches[0];
        handleSelectCompany(singleComp, selectedBranch.id, selectedBranch.name, true);
        return;
      }
    } catch (err: any) {
      console.error("[CompanySelectionScreen] Failed to load tenants:", err);
      setError(err?.message || "Failed to load accessible company workspaces.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  // Authoritative Context Switch Handler
  const handleSelectCompany = async (
    company: CompanyItem,
    targetBranchId: string,
    targetBranchName: string,
    isAutoSelect: boolean = false
  ) => {
    if (!targetBranchId) {
      setError(`No permitted branch available for ${company.name}. Please contact your administrator.`);
      return;
    }

    setSwitching(true);
    setSelectedCompanyId(company.id);
    setError(null);

    try {
      const switchPayload = {
        target_company_id: company.id,
        target_branch_id: targetBranchId,
      };

      const res = await apiFetchV1("/auth/switch-context", {
        method: "POST",
        body: JSON.stringify(switchPayload),
      });

      if (res && res.access_token) {
        // Store updated company-scoped JWT token and context ONLY upon verified server confirmation
        localStorage.setItem("smriti_jwt_token", res.access_token);
        localStorage.setItem("smriti_company_id", company.id);
        const derivedCode = company.id.replace(/^COMP-/, "") || "001";
        localStorage.setItem("smriti_company_code", derivedCode);
        localStorage.setItem("smriti_branch_id", targetBranchId);

        // Notify parent App component
        onCompanySelected({
          companyId: company.id,
          companyName: company.name,
          companyCode: derivedCode,
          branchId: targetBranchId,
          branchName: targetBranchName,
          token: res.access_token,
        });
      } else {
        throw new Error("Unable to establish company context session.");
      }
    } catch (err: any) {
      console.error("[CompanySelectionScreen] Switch context failed:", err);
      // ON FAILURE: Keep state intact, show clear user error
      setError("Unable to switch company workspace. Please try again or contact your administrator.");
      setSwitching(false);
      setSelectedCompanyId(null);
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.gstNumber && c.gstNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 1. Initial Loading State or Auto-Selecting Single Company
  if (loading || (companies.length === 1 && switching)) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-radial from-blue-600/10 via-transparent to-transparent opacity-60 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center max-w-sm text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center font-bold text-2xl font-display text-white shadow-xl shadow-blue-600/30 border border-blue-400 mb-6">
            <RefreshCw className="w-7 h-7 animate-spin text-white" />
          </div>
          <h2 className="text-base font-bold font-display text-slate-100 mb-1">
            {companies.length === 1 ? "Connecting to Workspace..." : "Resolving Accessible Workspaces..."}
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {companies.length === 1 
              ? `Establishing secure session for ${companies[0].name}`
              : "Verifying tenant database routing & security clearance"}
          </p>
        </motion.div>
      </div>
    );
  }

  // 2. Case D: Zero accessible companies (Authorization / Assignment required)
  if (!loading && companies.length === 0) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-radial from-rose-600/10 via-transparent to-transparent opacity-60 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold font-display text-slate-100 mb-2">
            No Workspace Assigned
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Operator <span className="text-slate-200 font-semibold">{currentUser.name}</span> has been authenticated, but your account is not currently assigned to any active company workspace.
          </p>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 mb-6 text-left text-[11px] text-slate-400 font-mono">
            <div className="text-slate-300 font-bold mb-1">Suggested Actions:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>Contact your SMRITI System Administrator.</li>
              <li>Request branch/company assignment in User Management.</li>
            </ul>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-md"
          >
            <LogOut className="w-4 h-4" />
            <span>Return to Login</span>
          </button>
        </motion.div>
      </div>
    );
  }

  // 3. Case C: Multiple companies -> Enterprise Company Card Selector
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8 relative overflow-hidden select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-radial from-blue-600/10 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between z-10 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg font-display text-white border border-blue-500 shadow-md">
            S
          </div>
          <div>
            <h1 className="text-base font-bold font-display text-slate-100 leading-tight">
              SMRITI Retail OS
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Select Business Workspace
            </p>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-200">{currentUser.name}</div>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Log out of current session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Selection Area */}
      <main className="max-w-6xl w-full mx-auto my-auto py-8 z-10 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3 font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Search Bar & Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-display text-slate-100">
              Available Workspaces
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose a registered business entity to initialize operational modules and reports.
            </p>
          </div>

          {companies.length > 3 && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search workspace name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-medium"
              />
            </div>
          )}
        </div>

        {/* Company Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCompanies.map((comp) => {
            const compBranches = branches.filter((b) => b.company === comp.id);
            const selectedBranch = compBranches.find(b => b.id === currentUser?.branchId) || compBranches[0];
            const hasBranch = Boolean(selectedBranch);
            const isSelected = selectedCompanyId === comp.id;

            return (
              <motion.div
                key={comp.id}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-lg relative overflow-hidden ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-300 rounded border border-slate-700">
                        {comp.id}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> READY
                      </span>
                    </div>
                  </div>

                  {/* Company Name */}
                  <h3 className="text-base font-bold text-slate-100 font-display line-clamp-1 mb-1">
                    {comp.name}
                  </h3>

                  {/* Metadata Specs */}
                  <div className="space-y-1.5 my-3 text-xs text-slate-400">
                    {comp.gstNumber && (
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-500">GSTIN:</span>
                        <span className="text-slate-300 font-semibold">{comp.gstNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" /> Branch:
                      </span>
                      <span className="text-slate-300 font-medium truncate max-w-[140px]">
                        {selectedBranch ? selectedBranch.name : "No Assigned Branch"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Security:
                      </span>
                      <span className="text-slate-300 font-mono text-[10px]">
                        Tenant Isolated
                      </span>
                    </div>
                  </div>
                </div>

                {/* Enter Action Button */}
                <button
                  type="button"
                  disabled={switching || !hasBranch}
                  onClick={() => {
                    if (selectedBranch) {
                      handleSelectCompany(comp, selectedBranch.id, selectedBranch.name);
                    } else {
                      setError(`No branch found for ${comp.name}. Please contact your administrator.`);
                    }
                  }}
                  className={`mt-4 w-full py-2.5 px-4 rounded-xl font-semibold font-display text-xs flex items-center justify-center gap-2 transition-all cursor-pointer select-none shadow-md ${
                    !hasBranch
                      ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                      : isSelected
                      ? "bg-blue-600 text-white opacity-80"
                      : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 hover:border-blue-400"
                  }`}
                >
                  {isSelected && switching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : !hasBranch ? (
                    <span>No Branch Available</span>
                  ) : (
                    <>
                      <span>Enter Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-mono z-10 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          <span>SMRITI Platform Abstraction Layer • Tenant Isolation Active</span>
        </div>
        <div>SMRITI Retail OS v{APP_VERSION} Enterprise Production</div>
      </footer>
    </div>
  );
};
