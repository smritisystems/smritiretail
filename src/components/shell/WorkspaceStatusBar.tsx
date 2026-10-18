import React, { useEffect, useState } from "react";
import { Building2, GitBranch, Globe2, ShieldCheck, UserRound } from "lucide-react";
import { APP_VERSION_LABEL } from "../../config/version.ts";

interface WorkspaceStatusBarProps {
  activeModuleTitle: string;
  userName?: string;
  userRole?: string;
}

const readWorkspaceValue = (key: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
};

export const WorkspaceStatusBar: React.FC<WorkspaceStatusBarProps> = ({
  activeModuleTitle,
  userName = "Operator",
  userRole = "Operator",
}) => {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [companyName, setCompanyName] = useState("SMRITI Workspace");
  const [companyCode, setCompanyCode] = useState("001");
  const [branchName, setBranchName] = useState("Main Branch");
  const [branchCode, setBranchCode] = useState("MAIN");

  useEffect(() => {
    const syncWorkspace = () => {
      setCompanyName(readWorkspaceValue("smriti_company_name", "SMRITI Workspace"));
      setCompanyCode(readWorkspaceValue("smriti_company_code", "001"));
      setBranchName(readWorkspaceValue("smriti_branch_name", "Main Branch"));
      setBranchCode(readWorkspaceValue("smriti_branch_code", readWorkspaceValue("smriti_branch_id", "MAIN")));
    };
    const updateOnline = () => setOnline(navigator.onLine);

    syncWorkspace();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("smriti_company_context_updated", syncWorkspace);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("smriti_company_context_updated", syncWorkspace);
    };
  }, []);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 h-8 border-t border-[#c7d2e4] dark:border-slate-800 bg-[#eef3fa]/95 dark:bg-slate-900/95 px-3 text-[10px] text-[#475569] dark:text-slate-400 shadow-[0_-4px_14px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1800px] items-center gap-3 overflow-hidden whitespace-nowrap font-mono">
        <div className="flex min-w-0 items-center gap-1.5 text-[#172554] dark:text-slate-200" title={`${companyName} (${companyCode})`}>
          <Building2 size={13} className="shrink-0 text-[#2563eb]" />
          <span className="max-w-[180px] truncate font-bold">{companyName}</span>
          <span className="rounded border border-[#b8c7dd] dark:border-slate-700 bg-white/70 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-[#1d4ed8] dark:text-blue-400">{companyCode}</span>
        </div>
        <span className="h-3.5 w-px shrink-0 bg-[#c7d2e4] dark:bg-slate-800" />
        <div className="flex min-w-0 items-center gap-1.5 text-slate-700 dark:text-slate-300" title={`${branchName} (${branchCode})`}>
          <GitBranch size={12} className="shrink-0 text-[#0f766e] dark:text-teal-400" />
          <span className="max-w-[150px] truncate">{branchName}</span>
          <span className="text-[9px] text-[#64748b] dark:text-slate-400">{branchCode}</span>
        </div>
        <span className="h-3.5 w-px shrink-0 bg-[#c7d2e4] dark:bg-slate-800" />
        <span className="hidden min-w-0 truncate sm:inline text-slate-700 dark:text-slate-300"><span className="text-[#64748b] dark:text-slate-500">VIEW</span> {activeModuleTitle}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <UserRound size={12} className="text-[#64748b] dark:text-slate-400" />
          <span className="hidden max-w-[110px] truncate md:inline text-slate-700 dark:text-slate-300">{userName}</span>
          <span className="rounded bg-[#e0e7ff] dark:bg-indigo-950 px-1.5 py-0.5 text-[9px] font-bold text-[#3730a3] dark:text-indigo-300">{userRole}</span>
          <span className={`flex items-center gap-1 ${online ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            <Globe2 size={12} />
            <span className="hidden sm:inline">{online ? "ONLINE" : "OFFLINE"}</span>
          </span>
          <span title="Tenant session protected">
            <ShieldCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
          </span>
          <span className="hidden text-[#64748b] dark:text-slate-500 lg:inline">{APP_VERSION_LABEL}</span>
        </span>
      </div>
    </footer>
  );
};
