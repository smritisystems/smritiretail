/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-08-26
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useEffect, useState } from "react";
import { Building2, GitBranch, Globe2, UserRound } from "lucide-react";
import { APP_VERSION_LABEL } from "../../config/version.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

interface WorkspaceStatusBarProps {
  activeModuleTitle: string;
  userName?: string;
  userRole?: string;
}

const readWorkspaceValue = (key: string) => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(key) || "";
};

export const WorkspaceStatusBar: React.FC<WorkspaceStatusBarProps> = ({
  activeModuleTitle,
  userName,
  userRole,
}) => {
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "unavailable">("checking");
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const displayUserName = userName?.trim() || "Account";
  const displayUserRole = userRole?.trim();

  useEffect(() => {
    const syncWorkspace = () => {
      setCompanyName(readWorkspaceValue("smriti_company_name"));
      setCompanyCode(readWorkspaceValue("smriti_company_code"));
      setBranchName(readWorkspaceValue("smriti_branch_name"));
      setBranchCode(readWorkspaceValue("smriti_branch_code"));
    };
    let isMounted = true;
    let checkInFlight = false;
    let retryAfterCurrentCheck = false;
    const checkApplicationConnection = async () => {
      if (checkInFlight) {
        retryAfterCurrentCheck = true;
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setConnectionStatus("unavailable");
        return;
      }
      if (!localStorage.getItem("smriti_jwt_token") && !localStorage.getItem("smriti_session_token")) {
        setConnectionStatus("unavailable");
        return;
      }

      checkInFlight = true;
      setConnectionStatus("checking");
      try {
        await apiFetchV1("/auth/me");
        if (isMounted) setConnectionStatus(typeof navigator === "undefined" || navigator.onLine ? "connected" : "unavailable");
      } catch {
        if (isMounted) setConnectionStatus("unavailable");
      } finally {
        checkInFlight = false;
        if (isMounted && retryAfterCurrentCheck) {
          retryAfterCurrentCheck = false;
          window.setTimeout(() => void checkApplicationConnection(), 0);
        }
      }
    };
    const updateOffline = () => setConnectionStatus("unavailable");

    syncWorkspace();
    void checkApplicationConnection();
    const connectionInterval = window.setInterval(() => void checkApplicationConnection(), 60_000);
    window.addEventListener("online", checkApplicationConnection);
    window.addEventListener("offline", updateOffline);
    window.addEventListener("smriti_company_context_updated", syncWorkspace);
    window.addEventListener("smriti_tenant_context_updated", syncWorkspace);
    window.addEventListener("storage", syncWorkspace);
    return () => {
      isMounted = false;
      window.clearInterval(connectionInterval);
      window.removeEventListener("online", checkApplicationConnection);
      window.removeEventListener("offline", updateOffline);
      window.removeEventListener("smriti_company_context_updated", syncWorkspace);
      window.removeEventListener("smriti_tenant_context_updated", syncWorkspace);
      window.removeEventListener("storage", syncWorkspace);
    };
  }, []);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 h-8 border-t border-[#c7d2e4] dark:border-slate-800 bg-[#eef3fa]/95 dark:bg-slate-900/95 px-3 text-[11px] text-[#475569] dark:text-slate-400 shadow-[0_-4px_14px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1800px] items-center gap-3 overflow-hidden whitespace-nowrap font-mono">
        <div className="flex min-w-0 items-center gap-1.5 text-[#172554] dark:text-slate-200" title={companyName ? `${companyName}${companyCode ? ` (${companyCode})` : ""}` : "Company context unavailable"}>
          <Building2 size={13} className="shrink-0 text-[#2563eb]" />
          <span className="max-w-[96px] sm:max-w-[180px] truncate font-bold">{companyName || "Company context unavailable"}</span>
          {companyCode && <span className="hidden sm:inline-flex rounded border border-[#b8c7dd] dark:border-slate-700 bg-white/70 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-[#1d4ed8] dark:text-blue-400">{companyCode}</span>}
        </div>
        <span className="h-3.5 w-px shrink-0 bg-[#c7d2e4] dark:bg-slate-800" />
        <div className="flex min-w-0 items-center gap-1.5 text-slate-700 dark:text-slate-300" title={branchName ? `${branchName}${branchCode ? ` (${branchCode})` : ""}` : "Branch context unavailable"}>
          <GitBranch size={12} className="shrink-0 text-[#0f766e] dark:text-teal-400" />
          <span className="max-w-[64px] sm:max-w-[150px] truncate">{branchName || "Branch context unavailable"}</span>
          {branchCode && <span className="hidden sm:inline text-[10px] text-[#64748b] dark:text-slate-400">{branchCode}</span>}
        </div>
        <span className="h-3.5 w-px shrink-0 bg-[#c7d2e4] dark:bg-slate-800" />
        <span className="hidden min-w-0 truncate sm:inline text-slate-700 dark:text-slate-300"><span className="text-[#64748b] dark:text-slate-500">VIEW</span> {activeModuleTitle}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <UserRound size={12} className="text-[#64748b] dark:text-slate-400" />
          <span className="hidden max-w-[110px] truncate md:inline text-slate-700 dark:text-slate-300">{displayUserName}</span>
          {displayUserRole && <span className="hidden sm:inline rounded bg-[#e0e7ff] dark:bg-indigo-950 px-1.5 py-0.5 text-[10px] font-bold text-[#3730a3] dark:text-indigo-300">{displayUserRole}</span>}
          <span
            className={`flex items-center gap-1 ${connectionStatus === "connected" ? "text-emerald-700 dark:text-emerald-400" : connectionStatus === "checking" ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"}`}
            title={connectionStatus === "connected" ? "The authenticated /auth/me request succeeded." : connectionStatus === "checking" ? "Checking the authenticated application connection." : "The authenticated application request failed or the browser is offline."}
            aria-label={connectionStatus === "connected" ? "Application connection confirmed by authenticated session check" : connectionStatus === "checking" ? "Checking authenticated application connection" : "Application connection or session unavailable"}
          >
            <Globe2 size={12} />
            <span className="hidden sm:inline">{connectionStatus === "connected" ? "APP CONNECTED" : connectionStatus === "checking" ? "CHECKING APP" : "APP UNAVAILABLE"}</span>
          </span>
          <span className="hidden text-[#64748b] dark:text-slate-500 lg:inline">{APP_VERSION_LABEL}</span>
        </span>
      </div>
    </footer>
  );
};
