/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : Identity360Workspace (SUPOE v2.0 Object Page Pattern 11-Tab Suite)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

import React, { useState } from "react";
import {
  User, Building2, MapPin, Key, ShieldCheck, Activity, Clock, Users, FileText, MessageSquare, Settings, ArrowLeftRight, UserCheck
} from "lucide-react";
import { UniversalActionBar } from "./common/UniversalActionBar.tsx";

export interface WorkLocationAssignment {
  id: string;
  companyName: string;
  locationName: string;
  position: string;
  fromDate: string;
  toDate: string;
  isPrimary: boolean;
}

export interface IdentityRelationship {
  id: string;
  role: "Manager" | "HR Lead" | "Mentor" | "Emergency Contact" | "Delegate";
  personName: string;
  contactMobile: string;
}

export interface IdentityRecord {
  id: string;
  username: string;
  fullName: string;
  email: string;
  mobile: string;
  role: string;
  status: "Draft" | "Pending Approval" | "Provisioning" | "Active" | "Transferred" | "Suspended" | "Archived";
  companyName: string;
  branchName: string;
  assignments: WorkLocationAssignment[];
  relationships: IdentityRelationship[];
}

interface Identity360WorkspaceProps {
  identity: IdentityRecord;
  onBack?: () => void;
  onOpenTransferWizard?: () => void;
  onOpenProvisioningWizard?: () => void;
}

export const Identity360Workspace: React.FC<Identity360WorkspaceProps> = ({
  identity,
  onBack,
  onOpenTransferWizard,
  onOpenProvisioningWizard
}) => {
  const [activeTab, setActiveTab] = useState<string>("overview");

  const tabs = [
    { id: "overview", label: "Overview", icon: <User size={13} /> },
    { id: "organization", label: "Organization", icon: <Building2 size={13} /> },
    { id: "assignments", label: "Assignments", icon: <MapPin size={13} /> },
    { id: "permissions", label: "Permissions", icon: <ShieldCheck size={13} /> },
    { id: "authentication", label: "Authentication", icon: <Key size={13} /> },
    { id: "activity", label: "Activity", icon: <Activity size={13} /> },
    { id: "timeline", label: "Timeline", icon: <Clock size={13} /> },
    { id: "relationships", label: "Relationships", icon: <Users size={13} /> },
    { id: "documents", label: "Documents", icon: <FileText size={13} /> },
    { id: "notes", label: "Notes", icon: <MessageSquare size={13} /> },
    { id: "settings", label: "Settings", icon: <Settings size={13} /> }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* 1. Universal Action Bar */}
      <UniversalActionBar
        workspaceTitle={`Identity 360 — ${identity.fullName}`}
        onSave={() => alert("Identity record saved successfully!")}
        onPrint={() => window.print()}
        onExport={() => alert("Exporting Identity 360 record...")}
        onClose={onBack}
        customActions={[
          {
            id: "act-transfer",
            label: "Transfer Employee",
            icon: "arrow-left-right",
            onClick: () => onOpenTransferWizard?.()
          },
          {
            id: "act-provision",
            label: "Provision Lifecycle",
            icon: "user-check",
            onClick: () => onOpenProvisioningWizard?.()
          }
        ]}
      />

      {/* 2. Header Object Summary Card */}
      <div className="bg-slate-900/80 border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {identity.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{identity.fullName}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 capitalize">
                {identity.status}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-3">
              <span>User ID: {identity.id}</span>
              <span>•</span>
              <span>Username: {identity.username}</span>
              <span>•</span>
              <span>Role: {identity.role}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTransferWizard}
            className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowLeftRight size={13} />
            <span>Transfer Staff</span>
          </button>
          <button
            onClick={onOpenProvisioningWizard}
            className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <UserCheck size={13} />
            <span>Provisioning Wizard</span>
          </button>
        </div>
      </div>

      {/* 3. Horizontal 11-Tab Navigation */}
      <div className="flex items-center bg-slate-900 border-b border-slate-800 px-4 gap-1 overflow-x-auto select-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-medium transition-all cursor-pointer ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-400 bg-blue-500/10 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 4. Tab Body Content Pane */}
      <div className="flex-1 overflow-y-auto p-6 text-xs text-slate-300">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Personal & Contact Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Full Name</div>
                  <div className="font-semibold text-slate-200 mt-0.5">{identity.fullName}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Primary Email</div>
                  <div className="font-semibold text-slate-200 mt-0.5">{identity.email || "N/A"}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Mobile Number</div>
                  <div className="font-semibold text-slate-200 mt-0.5">{identity.mobile || "N/A"}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Account Status</div>
                  <div className="font-semibold text-emerald-400 mt-0.5">{identity.status}</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Primary Work Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Company</div>
                  <div className="font-semibold text-slate-200 mt-0.5">{identity.companyName}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Primary Branch</div>
                  <div className="font-semibold text-slate-200 mt-0.5">{identity.branchName}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "assignments" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Work Location Assignment Matrix</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase">
                  <th className="py-2 px-3">Company</th>
                  <th className="py-2 px-3">Work Location</th>
                  <th className="py-2 px-3">Position</th>
                  <th className="py-2 px-3">From Date</th>
                  <th className="py-2 px-3">To Date</th>
                  <th className="py-2 px-3">Primary</th>
                </tr>
              </thead>
              <tbody>
                {identity.assignments.map((asg) => (
                  <tr key={asg.id} className="border-b border-slate-800/50 hover:bg-slate-800/40 font-mono text-xs">
                    <td className="py-2.5 px-3 font-semibold text-white">{asg.companyName}</td>
                    <td className="py-2.5 px-3">{asg.locationName}</td>
                    <td className="py-2.5 px-3">{asg.position}</td>
                    <td className="py-2.5 px-3">{asg.fromDate}</td>
                    <td className="py-2.5 px-3">{asg.toDate || "Present"}</td>
                    <td className="py-2.5 px-3">
                      {asg.isPrimary ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                          ✓ Primary
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Identity Business Lifecycle Timeline</h3>
            <div className="space-y-3 font-mono">
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1" />
                <div>
                  <div className="font-bold text-slate-200">Account Created & Seeding Verified</div>
                  <div className="text-[10px] text-slate-500">2026-07-30 08:00 AM • Admin Setup Wizard</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1" />
                <div>
                  <div className="font-bold text-slate-200">Primary Branch Assigned: Nagpur HQ</div>
                  <div className="text-[10px] text-slate-500">2026-07-30 08:05 AM • Automatic RBAC Mapper</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "relationships" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Identity Relationships & Escalations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
              {identity.relationships.map((rel) => (
                <div key={rel.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                  <div>
                    <div className="text-[10px] text-blue-400 font-bold uppercase">{rel.role}</div>
                    <div className="font-semibold text-slate-100">{rel.personName}</div>
                  </div>
                  <div className="text-[10px] text-slate-400">{rel.contactMobile}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback for other tabs */}
        {!["overview", "assignments", "timeline", "relationships"].includes(activeTab) && (
          <div className="p-12 text-center text-slate-500 font-mono">
            Tab [{activeTab.toUpperCase()}] is active. Enterprise Object Page capability ready for telemetry data.
          </div>
        )}
      </div>
    </div>
  );
};
