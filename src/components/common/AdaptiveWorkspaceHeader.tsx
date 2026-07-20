/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { useAdaptiveWorkspace, WorkspaceMode } from "../../layout_engine/adaptive_workspace_store.ts";

export const AdaptiveWorkspaceHeader: React.FC = () => {
  const { mode, setMode } = useAdaptiveWorkspace();

  const modes: { key: WorkspaceMode; label: string; icon: string; badge: string }[] = [
    { key: "SIMPLE", label: "Simple", icon: "⚡", badge: "Cashier" },
    { key: "HYBRID", label: "Hybrid", icon: "🏪", badge: "Owner" },
    { key: "ADVANCED", label: "Advanced", icon: "⚙️", badge: "Enterprise" },
  ];

  return (
    <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 backdrop-blur-md">
      <span className="text-xs font-semibold uppercase text-slate-400 px-2 flex items-center gap-1">
        <span>Workspace:</span>
      </span>
      {modes.map((m) => {
        const isActive = mode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            title={`Switch to ${m.label} Mode`}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 flex items-center space-x-1.5 ${
              isActive
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-105"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {m.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
};
