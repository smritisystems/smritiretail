/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : ProvisioningDashboard (Provisioning Status & Health Telemetry Widget)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

import React from "react";
import { Clock, AlertTriangle, FileEdit, CheckCircle2 } from "lucide-react";

export const ProvisioningDashboard: React.FC = () => {
  const stats = [
    { label: "Pending", count: 5, color: "text-amber-400 border-amber-500/30 bg-amber-500/10", icon: <Clock size={16} /> },
    { label: "Failed", count: 1, color: "text-rose-400 border-rose-500/30 bg-rose-500/10", icon: <AlertTriangle size={16} /> },
    { label: "Draft", count: 2, color: "text-blue-400 border-blue-500/30 bg-blue-500/10", icon: <FileEdit size={16} /> },
    { label: "Completed", count: 145, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", icon: <CheckCircle2 size={16} /> }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-sans">
      {stats.map((s) => (
        <div key={s.label} className={`p-3.5 rounded-2xl border ${s.color} flex items-center justify-between shadow-sm`}>
          <div>
            <div className="text-[10px] uppercase font-mono font-bold tracking-wider opacity-80">{s.label}</div>
            <div className="text-xl font-extrabold mt-0.5">{s.count}</div>
          </div>
          <div className="p-2 rounded-xl bg-black/20">{s.icon}</div>
        </div>
      ))}
    </div>
  );
};
