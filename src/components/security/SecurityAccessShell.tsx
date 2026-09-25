/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.45.2
 * Created      : 2026-09-26
 * Modified     : 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Security & Access Management — Full-Page Shell (SMRITI Retail OS)
 *
 * REFACTOR NOTES (v6.45.2)
 * ─────────────────────────────────────────────────────────────────────────
 * Replaces the legacy SecManageDlg modal-in-tab anti-pattern with a native
 * full-page shell that matches the SMRITI Retail OS visual direction.
 *
 * UNCHANGED:
 *   - All authentication / permission logic in securityStore.ts
 *   - MenuAccessView.tsx (logic + API calls)
 *   - SecConfigView.tsx (logic + API calls)
 *   - All backend API contracts (/security/menu-access, /security/config,
 *     /users/, /roles/)
 *   - types.ts data models
 *
 * CHANGED (presentation only):
 *   - Dark navy grouped sidebar replacing the flat modal sidebar
 *   - Header with SMRITI shield icon matching reference design
 *   - Primary tab bar (Users | Roles & Groups | Menu Access | Data Access |
 *     Security Policies | Audit Log) inside the content area
 *   - UsersView, DataAccessView wired in; MenuAccessView reused
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Users,
  UserCheck,
  Layers,
  Database,
  ShieldCheck,
  FileText,
  Lock,
  Activity,
  UserCircle2,
  KeyRound,
  Menu,
  Settings,
  Star,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { UsersView } from "./UsersView.tsx";
import { DataAccessView } from "./DataAccessView.tsx";
import { MenuAccessView } from "./MenuAccessView.tsx";
import { SecConfigView } from "./SecConfigView.tsx";

// ── Nav hierarchy matching reference design ───────────────────────────────

type SecuritySection =
  | "users"
  | "roles-groups"
  | "menu-access"
  | "data-access"
  | "security-policies"
  | "locked-users"
  | "audit-log"
  | "my-profile"
  | "change-password"
  | "menu-shortcuts"
  | "security-config";

interface NavGroup {
  heading: string;
  items: {
    id: SecuritySection;
    label: string;
    icon: React.ElementType;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Security & Access",
    items: [
      { id: "users",             label: "Users",             icon: Users },
      { id: "roles-groups",      label: "Roles & Groups",    icon: UserCheck },
      { id: "menu-access",       label: "Menu Access",       icon: Layers },
      { id: "data-access",       label: "Data Access",       icon: Database },
      { id: "security-policies", label: "Security Policies", icon: ShieldCheck },
    ],
  },
  {
    heading: "Security Operations",
    items: [
      { id: "locked-users", label: "Locked Users",          icon: Lock },
      { id: "audit-log",    label: "Activity / Audit Log",  icon: Activity },
    ],
  },
  {
    heading: "My Account",
    items: [
      { id: "my-profile",      label: "My Profile",      icon: UserCircle2 },
      { id: "change-password", label: "Change Password",  icon: KeyRound },
    ],
  },
  {
    heading: "Utilities",
    items: [
      { id: "menu-shortcuts",  label: "Menu Shortcuts",         icon: Star },
      { id: "security-config", label: "Security Configuration", icon: Settings },
    ],
  },
];

const PRIMARY_TABS: { id: SecuritySection; label: string; icon: React.ElementType }[] = [
  { id: "users",             label: "Users",             icon: Users },
  { id: "roles-groups",      label: "Roles & Groups",    icon: UserCheck },
  { id: "menu-access",       label: "Menu Access",       icon: Layers },
  { id: "data-access",       label: "Data Access",       icon: Database },
  { id: "security-policies", label: "Security Policies", icon: ShieldCheck },
  { id: "audit-log",         label: "Audit Log",         icon: FileText },
];

const SECTION_META: Record<SecuritySection, { title: string; sub: string }> = {
  "users":             { title: "Security & Access Management", sub: "Manage users, roles, menu access, data access and security policies." },
  "roles-groups":      { title: "Roles & Groups",               sub: "Define and manage security roles and user groups." },
  "menu-access":       { title: "Menu Access Control",          sub: "Configure menu and operation permissions by user, group or node." },
  "data-access":       { title: "Data Access Control",          sub: "Configure data level restrictions for users, groups and menu access." },
  "security-policies": { title: "Security Policies",            sub: "Password complexity, session timeouts and account lockout rules." },
  "locked-users":      { title: "Locked Users",                 sub: "Review and unlock operator accounts locked due to failed login attempts." },
  "audit-log":         { title: "Activity / Audit Log",         sub: "Track and review all system events, operator actions and security incidents." },
  "my-profile":        { title: "My Profile",                   sub: "View and update your personal profile and operator details." },
  "change-password":   { title: "Change Password",              sub: "Update your operator account password." },
  "menu-shortcuts":    { title: "Menu Shortcuts",               sub: "Configure and manage quick-access menu shortcuts." },
  "security-config":   { title: "Security Configuration",       sub: "Advanced security settings — housekeeping, retention and system parameters." },
};

// ── Props ─────────────────────────────────────────────────────────────────

interface SecurityAccessShellProps {
  initialSection?: SecuritySection;
  onNavigateAway?: () => void;
  currentUser?: { role: string; name: string };
}

interface ToastState {
  type: "success" | "error" | "warning";
  message: string;
}

// ── Stub for sections without a dedicated component yet ───────────────────

const ComingSoonView: React.FC<{ section: SecuritySection }> = ({ section }) => {
  const meta = SECTION_META[section];
  return (
    <div className="flex flex-col items-center justify-center h-full text-[#94a3b8] select-none py-24">
      <ShieldCheck size={40} className="mb-3 text-[#cbd5e1]" aria-hidden="true" />
      <div className="font-bold text-[#64748b] text-sm mb-1">{meta?.title}</div>
      <div className="text-xs text-center max-w-xs leading-relaxed text-[#94a3b8]">{meta?.sub}</div>
      <div className="mt-5 px-4 py-2 bg-[#f1f5f9] border border-[#e2e8f0] rounded-xl text-[11px] text-[#94a3b8] font-mono">
        Module available in next sprint
      </div>
    </div>
  );
};

// ── Shell ─────────────────────────────────────────────────────────────────

export const SecurityAccessShell: React.FC<SecurityAccessShellProps> = ({
  initialSection = "users",
  onNavigateAway,
}) => {
  const [activeSection, setActiveSection] = useState<SecuritySection>(initialSection);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => { setActiveSection(initialSection); }, [initialSection]);

  const showToast = useCallback((n: { type: ToastState["type"]; message: string }) => {
    setToast(n);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const meta = SECTION_META[activeSection];
  const showPrimaryTabs = PRIMARY_TABS.some(t => t.id === activeSection);

  const renderContent = () => {
    switch (activeSection) {
      case "users":
        return <UsersView onNotification={showToast} />;
      case "menu-access":
        return <MenuAccessView onClose={onNavigateAway ?? (() => {})} />;
      case "data-access":
        return <DataAccessView onNotification={showToast} />;
      case "security-policies":
      case "security-config":
        return <SecConfigView onClose={onNavigateAway ?? (() => {})} />;
      default:
        return <ComingSoonView section={activeSection} />;
    }
  };

  return (
    <div className="flex h-full w-full bg-[#f8fafc] font-sans overflow-hidden">

      {/* ── Dark navy sidebar ── */}
      <aside
        className={"flex flex-col bg-[#0f172a] text-white transition-all duration-200 shrink-0 " + (sidebarOpen ? "w-56" : "w-0 overflow-hidden")}
        aria-label="Security & Access navigation"
      >
        {/* Brand header */}
        <div className="px-4 py-4 border-b border-white/10 flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-[#1e40af] rounded-lg flex items-center justify-center shrink-0">
            <Shield size={16} className="text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-white leading-tight">Security &amp; Access</div>
            <div className="text-[9px] font-mono text-white/40">RBAC Control Center</div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2" aria-label="Security module navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading}>
              <div className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-white/30 px-2 mb-1.5">
                {group.heading}
              </div>
              <ul className="space-y-0.5" role="list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={active ? "page" : undefined}
                        onClick={() => setActiveSection(item.id)}
                        className={
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 " +
                          (active ? "bg-[#1e40af] text-white font-bold" : "text-white/60 hover:bg-white/[0.08] hover:text-white")
                        }
                      >
                        <Icon size={14} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer status */}
        <div className="px-4 py-3 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" aria-hidden="true" />
            Enterprise RBAC Active
          </div>
        </div>
      </aside>

      {/* ── Content pane ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-[#e2e8f0] px-5 py-4 flex items-center gap-4 shrink-0 flex-wrap">
          {/* Sidebar toggle (all sizes — matches reference) */}
          <button
            type="button"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] transition shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
          >
            <Menu size={16} aria-hidden="true" />
          </button>

          <div className="w-11 h-11 bg-[#1e40af]/10 border border-[#1e40af]/20 rounded-xl flex items-center justify-center shrink-0" aria-hidden="true">
            <Shield size={22} className="text-[#1e40af]" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#0f172a] font-display leading-tight">{meta.title}</h1>
            <p className="text-xs text-[#64748b] mt-0.5">{meta.sub}</p>
          </div>

          {toast && (
            <div
              role="status"
              aria-live="polite"
              className={
                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border shrink-0 " +
                (toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : toast.type === "error" ? "bg-rose-50 border-rose-200 text-rose-700"
                  : "bg-amber-50 border-amber-200 text-amber-800")
              }
            >
              {toast.type === "success"
                ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" aria-hidden="true" />
                : <AlertTriangle size={14} className="text-rose-500 shrink-0" aria-hidden="true" />}
              <span className="max-w-xs truncate">{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="ml-1 opacity-60 hover:opacity-100 transition">
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          )}
        </header>

        {/* Primary tab bar */}
        {showPrimaryTabs && (
          <div className="bg-white border-b border-[#e2e8f0] px-5 shrink-0" role="tablist" aria-label="Security module tabs">
            <div className="flex items-center overflow-x-auto scrollbar-none">
              {PRIMARY_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveSection(tab.id)}
                    className={
                      "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-1 " +
                      (active ? "border-[#1e40af] text-[#1e40af] font-bold" : "border-transparent text-[#64748b] hover:text-[#0f172a] hover:border-[#cbd5e1]")
                    }
                  >
                    <Icon size={13} aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-hidden" aria-label={meta.title}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default SecurityAccessShell;
