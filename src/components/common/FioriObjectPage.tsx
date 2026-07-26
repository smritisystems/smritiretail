/**
 * Project      : SMRITI Retail OS
 * Module       : SAP Fiori Object Page Pattern Component (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.0.0
 */

import React, { useState } from "react";
import { ArrowLeft, Save, Trash2, Edit3, CheckCircle, AlertCircle, Clock } from "lucide-react";

export interface ObjectPageTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface ObjectPageMetric {
  label: string;
  value: string | number;
  highlight?: boolean;
}

interface FioriObjectPageProps {
  title: string;
  subtitle?: string;
  badgeStatus?: { label: string; type: "success" | "warning" | "info" | "error" };
  metrics?: ObjectPageMetric[];
  tabs: ObjectPageTab[];
  onBack?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  headerActions?: React.ReactNode;
}

export const FioriObjectPage: React.FC<FioriObjectPageProps> = ({
  title,
  subtitle,
  badgeStatus,
  metrics = [],
  tabs,
  onBack,
  onSave,
  onDelete,
  isSaving = false,
  headerActions,
}) => {
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || "");

  const activeTabContent = tabs.find((t) => t.id === activeTabId)?.content;

  const badgeColorMap = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    error: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* 1. Object Page Summary Header (Fixed Key Header) */}
      <div className="p-6 bg-slate-900/90 border-b border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
                {badgeStatus && (
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                      badgeColorMap[badgeStatus.type]
                    }`}
                  >
                    {badgeStatus.label}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {headerActions}
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>

        {/* Header Key Metrics Card Bar */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/60">
            {metrics.map((m, idx) => (
              <div key={idx} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                  {m.label}
                </span>
                <span
                  className={`text-lg font-bold mt-0.5 block ${
                    m.highlight ? "text-cyan-400 font-mono" : "text-slate-100"
                  }`}
                >
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Horizontal Tabs Navigation */}
      <div className="bg-slate-900/40 border-b border-slate-800 px-6 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`py-3.5 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTabId === tab.id
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Active Tab Content Section */}
      <div className="flex-1 overflow-auto p-6 bg-slate-950">{activeTabContent}</div>
    </div>
  );
};
