/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : UniversalPersonWorkspace (Universal Person 360 Studio Component v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

import React, { useState, useEffect } from "react";
import { SUPOESDK } from "../sdk/SUPOESDK.ts";
import { IdentityRecord } from "../registry/IdentityRegistry.ts";
import { DrillableLink } from "../../components/drilldown/DrillableLink.tsx";
import { User, Shield, Briefcase, Award, DollarSign, MapPin, CheckCircle, ExternalLink } from "lucide-react";

interface Props {
  personId?: string;
}

export const UniversalPersonWorkspace: React.FC<Props> = ({ personId = "ID-1001" }) => {
  const [identity, setIdentity] = useState<IdentityRecord | null>(null);
  const [commission, setCommission] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "roles" | "commission" | "timeline">("overview");

  useEffect(() => {
    const loadPerson = async () => {
      const data = await SUPOESDK.getIdentity(personId);
      const comm = await SUPOESDK.getCommissionReport(personId);
      setIdentity(data);
      setCommission(comm);
    };
    loadPerson();
  }, [personId]);

  if (!identity) {
    return <div className="p-6 text-xs text-theme-muted font-mono">Loading Universal Identity 360 Studio...</div>;
  }

  return (
    <div className="p-6 bg-theme-surface-1 border border-theme-divider rounded-2xl space-y-6 font-sans select-none shadow-xl">
      {/* Identity Header Banner */}
      <div className="p-6 bg-gradient-to-r from-theme-surface-2 via-theme-surface-3 to-theme-surface-2 border border-theme-divider rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0a6ed1]/10 border border-[#0a6ed1]/30 flex items-center justify-center text-[#0a6ed1] shadow-md">
            <User className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-theme-heading">{identity.fullName}</h2>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold font-mono">
                {identity.lifecycleState}
              </span>
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold font-mono">
                Policy: {identity.provisioningPolicy}
              </span>
            </div>
            <p className="text-xs text-theme-muted font-mono mt-0.5">
              Code: <strong>{identity.identityCode}</strong> • Ingestion: <strong>{identity.ingestionSource}</strong> • Auth: <strong>{identity.userId ? `User Account Linked [${identity.userId}]` : "No Login Account (Optional Auth)"}</strong>
            </p>
          </div>
        </div>

        {/* Roles Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {identity.roles.map((r) => (
            <span key={r} className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-bold font-mono">
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex border-b border-theme-divider bg-theme-surface-2 px-4 rounded-xl">
        {(["overview", "roles", "commission", "timeline"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`py-3 px-6 text-xs font-bold capitalize transition-colors cursor-pointer border-b-2 ${
              activeTab === t
                ? "border-[#0a6ed1] text-[#0a6ed1]"
                : "border-transparent text-theme-muted hover:text-theme-heading"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Dynamic Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          {/* Contact Details Card */}
          <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3">
            <h4 className="font-bold text-theme-heading uppercase tracking-wider text-[11px] border-b border-theme-divider pb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-400" /> Identity Details
            </h4>
            <div className="space-y-2 text-theme-body">
              <div>Mobile: <strong className="text-theme-heading">{identity.mobile}</strong></div>
              <div>Email: <strong className="text-theme-heading">{identity.email}</strong></div>
              <div>Positions: <strong className="text-theme-heading">{identity.positions.join(", ")}</strong></div>
            </div>
          </div>

          {/* Work Assignments Card */}
          <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3">
            <h4 className="font-bold text-theme-heading uppercase tracking-wider text-[11px] border-b border-theme-divider pb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-400" /> Organization & Work Assignments
            </h4>
            <div className="space-y-2 text-theme-body">
              {identity.workAssignments.map((wa) => (
                <div key={wa.id} className="p-2 bg-theme-surface-1 rounded border border-theme-divider">
                  <div className="font-bold text-theme-heading">{wa.locationName} ({wa.locationType})</div>
                  <div className="text-[10px] text-theme-muted">Effective: {wa.effectiveFrom} • Primary: {wa.isPrimary ? "Yes" : "No"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Commission & Performance Card */}
          <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3">
            <h4 className="font-bold text-theme-heading uppercase tracking-wider text-[11px] border-b border-theme-divider pb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" /> SUPOE Commission Wallet
            </h4>
            <div className="space-y-2 text-theme-body">
              <div>Sales Commission: <strong className="text-emerald-400">{commission?.salesCommission}</strong></div>
              <div>Referral Payout: <strong className="text-purple-400">{commission?.referralCommission}</strong></div>
              <div>Total Earned: <strong className="text-theme-heading font-bold">{commission?.totalEarned}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
