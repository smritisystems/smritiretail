/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : System Administration Control Center Workspace (4-Domain IAM Architecture)
 * Standard     : SMAP Constitution v1.0 — Level 1 Core Security Governance (FROZEN v1.4)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import {
  Users,
  Shield,
  Building,
  Layers,
  Activity,
  Lock,
  UserCheck,
  Key,
  FileCheck,
  Settings,
  Plus,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  UserPlus
} from "lucide-react";
import { UserOnboardingWizardModal } from "./UserOnboardingWizardModal.tsx";
import { DelegationModal } from "./DelegationModal.tsx";
import { RoleMatrixTab } from "../security/RoleMatrixTab.tsx";
import { PermissionSetsTab } from "../security/PermissionSetsTab.tsx";
import { FieldSecurityTab } from "../security/FieldSecurityTab.tsx";
import { WorkspaceProfilesTab } from "../security/WorkspaceProfilesTab.tsx";
import { StaffManagementTab } from "../StaffManagementTab.tsx";
import { AuditLogsTab } from "../AuditLogsTab.tsx";

export type AdminDomainTab = "identity" | "organization" | "security" | "platform";

interface TelemetryCounter {
  usersCount: number;
  employeesCount: number;
  rolesCount: number;
  permissionSetsCount: number;
  activeSessions: number;
  lockedUsers: number;
  pendingApprovals: number;
}

export const SystemAdministrationWorkspace: React.FC = () => {
  const [activeDomain, setActiveDomain] = useState<AdminDomainTab>("identity");
  const [subTab, setSubTab] = useState<string>("users");
  const [showWizard, setShowWizard] = useState(false);
  const [showDelegationModal, setShowDelegationModal] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetryCounter>({
    usersCount: 128,
    employeesCount: 122,
    rolesCount: 26,
    permissionSetsCount: 42,
    activeSessions: 18,
    lockedUsers: 1,
    pendingApprovals: 4
  });

  return (
    <div className="flex flex-col h-full bg-theme-bg text-theme-text overflow-hidden">
      {/* Workspace Header & Telemetry Dashboard */}
      <div className="bg-theme-surface-1 border-b border-theme-divider p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-theme-text flex items-center gap-2">
                System Administration Control Center
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                  IAM v1.4 Certified
                </span>
              </h1>
              <p className="text-xs text-theme-muted">
                Enterprise 4-Domain Governance — Identity, Organization, Security & Platform Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDelegationModal(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-surface-2 hover:bg-theme-surface-3 text-theme-text border border-theme-divider flex items-center gap-2 transition"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Temporary Delegation
            </button>

            <button
              onClick={() => setShowWizard(true)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-sm transition"
            >
              <UserPlus className="w-4 h-4" />
              Onboard User (Fiori Wizard)
            </button>
          </div>
        </div>

        {/* Telemetry Summary Counters */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <div className="bg-theme-surface-2/60 border border-theme-divider p-2.5 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-theme-muted tracking-wider">Users</div>
              <div className="text-base font-extrabold text-theme-text">{telemetry.usersCount}</div>
            </div>
          </div>

          <div className="bg-theme-surface-2/60 border border-theme-divider p-2.5 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-theme-muted tracking-wider">Employees</div>
              <div className="text-base font-extrabold text-theme-text">{telemetry.employeesCount}</div>
            </div>
          </div>

          <div className="bg-theme-surface-2/60 border border-theme-divider p-2.5 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-theme-muted tracking-wider">Roles</div>
              <div className="text-base font-extrabold text-theme-text">{telemetry.rolesCount}</div>
            </div>
          </div>

          <div className="bg-theme-surface-2/60 border border-theme-divider p-2.5 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 text-violet-400 rounded">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-theme-muted tracking-wider">Permission Sets</div>
              <div className="text-base font-extrabold text-theme-text">{telemetry.permissionSetsCount}</div>
            </div>
          </div>

          <div className="bg-theme-surface-2/60 border border-theme-divider p-2.5 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-theme-muted tracking-wider">Active Sessions</div>
              <div className="text-base font-extrabold text-theme-text">{telemetry.activeSessions}</div>
            </div>
          </div>

          <div className="bg-theme-surface-2/60 border border-theme-divider p-2.5 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-theme-muted tracking-wider">Locked Users</div>
              <div className="text-base font-extrabold text-theme-text">{telemetry.lockedUsers}</div>
            </div>
          </div>

          <div className="bg-theme-surface-2/60 border border-theme-divider p-2.5 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-theme-muted tracking-wider">Pending Approvals</div>
              <div className="text-base font-extrabold text-theme-text">{telemetry.pendingApprovals}</div>
            </div>
          </div>
        </div>

        {/* 4 Top-Level Domain Navigation Bar */}
        <div className="flex border-b border-theme-divider gap-2 pt-2">
          <button
            onClick={() => { setActiveDomain("identity"); setSubTab("users"); }}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition ${
              activeDomain === "identity"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-theme-muted hover:text-theme-text"
            }`}
          >
            <Users className="w-4 h-4" />
            Identity & Access
          </button>

          <button
            onClick={() => { setActiveDomain("organization"); setSubTab("companies"); }}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition ${
              activeDomain === "organization"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-theme-muted hover:text-theme-text"
            }`}
          >
            <Building className="w-4 h-4" />
            Organization Structure
          </button>

          <button
            onClick={() => { setActiveDomain("security"); setSubTab("roles"); }}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition ${
              activeDomain === "security"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-theme-muted hover:text-theme-text"
            }`}
          >
            <Shield className="w-4 h-4" />
            Security & Compliance
          </button>

          <button
            onClick={() => { setActiveDomain("platform"); setSubTab("profiles"); }}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition ${
              activeDomain === "platform"
                ? "border-violet-500 text-violet-400 bg-violet-500/5"
                : "border-transparent text-theme-muted hover:text-theme-text"
            }`}
          >
            <Layers className="w-4 h-4" />
            Platform & Extensions
          </button>
        </div>
      </div>

      {/* Domain Sub-Navigation & Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sub-Tab Navigation Strip */}
        <div className="bg-theme-surface-2/40 px-4 py-2 border-b border-theme-divider flex items-center gap-2">
          {activeDomain === "identity" && (
            <>
              <button
                onClick={() => setSubTab("users")}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                  subTab === "users" ? "bg-theme-surface-1 text-blue-400 shadow-sm" : "text-theme-muted hover:text-theme-text"
                }`}
              >
                User Accounts
              </button>
              <button
                onClick={() => setSubTab("employees")}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                  subTab === "employees" ? "bg-theme-surface-1 text-blue-400 shadow-sm" : "text-theme-muted hover:text-theme-text"
                }`}
              >
                Employees & HR Profiles
              </button>
              <button
                onClick={() => setSubTab("audit")}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                  subTab === "audit" ? "bg-theme-surface-1 text-blue-400 shadow-sm" : "text-theme-muted hover:text-theme-text"
                }`}
              >
                Login Sessions & Audit Logs
              </button>
            </>
          )}

          {activeDomain === "organization" && (
            <>
              <button
                onClick={() => setSubTab("companies")}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                  subTab === "companies" ? "bg-theme-surface-1 text-indigo-400 shadow-sm" : "text-theme-muted hover:text-theme-text"
                }`}
              >
                Companies & Legal Entities
              </button>
              <button
                onClick={() => setSubTab("branches")}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                  subTab === "branches" ? "bg-theme-surface-1 text-indigo-400 shadow-sm" : "text-theme-muted hover:text-theme-text"
                }`}
              >
                Branches & Operating Outlets
              </button>
            </>
          )}

          {activeDomain === "security" && (
            <>
              <button
                onClick={() => setSubTab("roles")}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                  subTab === "roles" ? "bg-theme-surface-1 text-emerald-400 shadow-sm" : "text-theme-muted hover:text-theme-text"
                }`}
              >
                Role Matrix & Templates
              </button>
              <button
                onClick={() => setSubTab("permissions")}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                  subTab === "permissions" ? "bg-theme-surface-1 text-emerald-400 shadow-sm" : "text-theme-muted hover:text-theme-text"
                }`}
              >
                Permission Sets Matrix
              </button>
              <button
                onClick={() => setSubTab("fls")}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                  subTab === "fls" ? "bg-theme-surface-1 text-emerald-400 shadow-sm" : "text-theme-muted hover:text-theme-text"
                }`}
              >
                Field Security Masks (FLS)
              </button>
            </>
          )}

          {activeDomain === "platform" && (
            <>
              <button
                onClick={() => setSubTab("profiles")}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                  subTab === "profiles" ? "bg-theme-surface-1 text-violet-400 shadow-sm" : "text-theme-muted hover:text-theme-text"
                }`}
              >
                Workspace Profiles & Personas
              </button>
            </>
          )}
        </div>

        {/* Workspace Body Area */}
        <div className="flex-1 overflow-auto p-4">
          {activeDomain === "identity" && subTab === "users" && <StaffManagementTab />}
          {activeDomain === "identity" && subTab === "employees" && <StaffManagementTab />}
          {activeDomain === "identity" && subTab === "audit" && <AuditLogsTab />}

          {activeDomain === "organization" && (
            <div className="bg-theme-surface-1 p-6 rounded-lg border border-theme-divider">
              <h3 className="text-sm font-bold text-theme-text mb-2">Organization Structure Hierarchy</h3>
              <p className="text-xs text-theme-muted mb-4">
                Manage Companies, Operating Branches, Retail Stores, and Warehouses.
              </p>
              <div className="p-4 bg-theme-surface-2/60 rounded border border-theme-divider font-mono text-xs text-emerald-400">
                Tenant SMS01 ──► Company A (Private Limited) ──► Branch Gorakhpur ──► Store Flagship ──► Main Warehouse
              </div>
            </div>
          )}

          {activeDomain === "security" && subTab === "roles" && <RoleMatrixTab />}
          {activeDomain === "security" && subTab === "permissions" && <PermissionSetsTab />}
          {activeDomain === "security" && subTab === "fls" && <FieldSecurityTab />}

          {activeDomain === "platform" && subTab === "profiles" && <WorkspaceProfilesTab />}
        </div>
      </div>

      {/* SAP Fiori Onboarding Wizard Modal */}
      {showWizard && <UserOnboardingWizardModal onClose={() => setShowWizard(false)} />}

      {/* Delegation Modal */}
      {showDelegationModal && <DelegationModal onClose={() => setShowDelegationModal(false)} />}
    </div>
  );
};
