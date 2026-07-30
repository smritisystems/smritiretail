/**
 * Project      : SMRITI Enterprise Design System (SEDS v2.0)
 * Module       : Reusable Business Insight Panel Component
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 *
 * Universal contextual drawer/panel for any SMRITI workspace (Sales, Purchase, CRM, SCDM, Inventory).
 * Provides Progressive Disclosure of KPIs, Health Badges, Alert Warnings, Actionable Suggestions,
 * and Cross-Navigation Links.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, TrendingUp, AlertTriangle, ShieldCheck, ChevronRight,
  ExternalLink, Calendar, PackageCheck, Zap, Activity, Filter, X
} from "lucide-react";

export interface InsightMetric {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
  color?: "emerald" | "amber" | "indigo" | "red" | "blue";
}

export interface InsightAlert {
  id: string;
  type: "warning" | "info" | "critical" | "success";
  title: string;
  message: string;
  timestamp?: string;
}

export interface InsightActionLink {
  label: string;
  targetWorkspace: string;
  params?: Record<string, any>;
}

export interface BusinessInsightPanelProps {
  title?: string;
  subtitle?: string;
  metrics?: InsightMetric[];
  alerts?: InsightAlert[];
  actions?: InsightActionLink[];
  isOpen?: boolean;
  onClose?: () => void;
  onNavigate?: (workspace: string, params?: Record<string, any>) => void;
  className?: string;
}

export const BusinessInsightPanel: React.FC<BusinessInsightPanelProps> = ({
  title = "Business Insights & Intelligence",
  subtitle = "Contextual recommendations, performance KPIs & alerts",
  metrics = [],
  alerts = [],
  actions = [],
  isOpen = true,
  onClose,
  onNavigate,
  className = "",
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className={`flex flex-col w-80 bg-[var(--seds-color-bg-container)] border-l border-[var(--seds-color-border)] shadow-xs overflow-hidden transition-all ${className}`}
    >
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--seds-color-border)] bg-[var(--seds-color-bg-hover)]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[var(--seds-color-text-primary)]">{title}</h3>
            <p className="text-[10px] text-[var(--seds-color-text-secondary)]">{subtitle}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--seds-color-text-secondary)] hover:text-[var(--seds-color-text-primary)] hover:bg-[var(--seds-color-bg-app)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* ── METRICS GRID (Progressive Disclosure) ──────────────────── */}
        {metrics.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--seds-color-text-secondary)] uppercase tracking-wider">
              <span>Contextual Metrics</span>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-indigo-600 hover:underline text-[10px] font-normal cursor-pointer"
              >
                {expanded ? "Show Less" : "Show All"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(expanded ? metrics : metrics.slice(0, 4)).map((m, idx) => {
                const colorClasses =
                  m.color === "emerald" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600" :
                  m.color === "amber"   ? "border-amber-500/20 bg-amber-500/5 text-amber-600" :
                  m.color === "red"     ? "border-red-500/20 bg-red-500/5 text-red-600" :
                  m.color === "blue"    ? "border-blue-500/20 bg-blue-500/5 text-blue-600" :
                  "border-indigo-500/20 bg-indigo-500/5 text-indigo-600";

                return (
                  <div key={idx} className={`p-2.5 rounded-lg border ${colorClasses}`}>
                    <div className="text-[10px] text-[var(--seds-color-text-secondary)] font-medium truncate">
                      {m.label}
                    </div>
                    <div className="text-sm font-bold text-[var(--seds-color-text-primary)] mt-0.5">
                      {m.value}
                    </div>
                    {m.subtext && (
                      <div className="text-[9px] text-[var(--seds-color-text-secondary)] mt-0.5">
                        {m.subtext}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ALERTS & WARNINGS ───────────────────────────────────────── */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-[var(--seds-color-text-secondary)] uppercase tracking-wider">
              Operational Alerts
            </div>
            <div className="space-y-1.5">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                    a.type === "critical" ? "bg-red-500/10 border-red-500/20 text-red-700" :
                    a.type === "warning"  ? "bg-amber-500/10 border-amber-500/20 text-amber-700" :
                    a.type === "success"  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" :
                    "bg-blue-500/10 border-blue-500/20 text-blue-700"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-xs">{a.title}</div>
                    <div className="text-[10px] opacity-90 mt-0.5">{a.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CROSS-NAVIGATION QUICK LINKS ────────────────────────────── */}
        {actions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--seds-color-border)]">
            <div className="text-[11px] font-semibold text-[var(--seds-color-text-secondary)] uppercase tracking-wider">
              Cross-Navigation
            </div>
            <div className="space-y-1">
              {actions.map((act, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigate && onNavigate(act.targetWorkspace, act.params)}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--seds-color-border)] hover:bg-[var(--seds-color-bg-hover)] text-left transition-colors text-indigo-600 font-medium group cursor-pointer"
                >
                  <span>{act.label}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
