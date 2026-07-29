/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : ProcessMonitor (Live Workflow Instance Monitor Component v2.1)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.1.0
 */

import React from "react";
import { Activity, Clock, AlertTriangle, CheckCircle } from "lucide-react";

export const ProcessMonitor: React.FC = () => {
  const instances = [
    { id: "INST-8801", workflow: "Purchase Approval v2.0", entity: "PO-2026-00045", status: "Running", step: "Finance Approval", sla: "Within SLA (12h left)" },
    { id: "INST-8802", workflow: "Credit Limit Override v1.0", entity: "CUST-DELHI-009", status: "Escalated", step: "Regional Mgr Review", sla: "SLA Overdue (+6h)" },
    { id: "INST-8803", workflow: "Stock Adjustment v2.0", entity: "ADJ-2026-011", status: "Completed", step: "Inventory Updated", sla: "Completed (2h total)" }
  ];

  return (
    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4 font-mono text-xs select-none">
      <div className="flex items-center justify-between border-b border-theme-divider pb-3">
        <div className="flex items-center gap-2 font-bold text-theme-heading">
          <Activity className="w-4 h-4 text-blue-400" />
          <span>SUWINE Live Process Monitor & SLA Bottleneck Engine</span>
        </div>
        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
          3 Active Workflows
        </span>
      </div>

      <div className="divide-y divide-theme-divider/50">
        {instances.map((inst) => (
          <div key={inst.id} className="py-2.5 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-theme-heading">{inst.workflow} — <span className="text-blue-400">{inst.entity}</span></div>
              <div className="text-theme-muted text-[11px]">Current Step: <strong>{inst.step}</strong></div>
            </div>
            <div className="text-right">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                inst.status === "Completed" ? "bg-emerald-500/10 text-emerald-400" : inst.status === "Escalated" ? "bg-rose-500/10 text-rose-400" : "bg-blue-500/10 text-blue-400"
              }`}>
                {inst.status}
              </span>
              <div className="text-[10px] text-theme-muted mt-1">{inst.sla}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
