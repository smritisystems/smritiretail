/**
 * Project      : SMRITI Business OS
 * Pattern      : SEDSObjectPage (Enterprise Object Page Pattern)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Layout Pattern
 */

import React, { useState } from "react";
import { SEDSToolbar, SEDSAction } from "../SEDSToolbar";
import { SEDSStatusBadge, SEDSStatusType } from "../SEDSStatusBadge";
import { ArrowLeft } from "lucide-react";

export interface SEDSObjectPageHeaderAttribute {
  label: string;
  value: React.ReactNode;
}

export interface SEDSObjectPageTab {
  id: string;
  label: string;
  content: React.ReactNode;
  badge?: string | number;
}

export interface SEDSObjectPageProps {
  title: string;
  subtitle?: string;
  status?: { type: SEDSStatusType; label: string };
  headerAttributes?: SEDSObjectPageHeaderAttribute[];
  actions?: SEDSAction[];
  tabs: SEDSObjectPageTab[];
  onBack?: () => void;
  avatarSrc?: string;
  icon?: React.ElementType;
}

export const SEDSObjectPage: React.FC<SEDSObjectPageProps> = ({
  title,
  subtitle,
  status,
  headerAttributes = [],
  actions = [],
  tabs,
  onBack,
  avatarSrc,
  icon: Icon,
}) => {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || "");

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  return (
    <div className="w-full flex flex-col gap-4 font-sans select-text">
      {/* Fixed Summary Header Bar */}
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-6 shadow-xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-theme-surface-2 border border-theme-divider text-theme-muted hover:text-theme-body transition mt-0.5"
                title="Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}

            {Icon && (
              <div className="w-12 h-12 rounded-2xl bg-blue-950 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
                <Icon size={24} />
              </div>
            )}

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-theme-body tracking-tight">{title}</h1>
                {status && <SEDSStatusBadge status={status.type} label={status.label} />}
              </div>
              {subtitle && <p className="text-xs font-mono text-theme-muted mt-1">{subtitle}</p>}
            </div>
          </div>

          {actions.length > 0 && <SEDSToolbar actions={actions} maxVisibleActions={7} />}
        </div>

        {/* Structured Key Attributes Summary Row */}
        {headerAttributes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 pt-4 border-t border-theme-divider/60">
            {headerAttributes.map((attr, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">{attr.label}</span>
                <span className="text-xs font-bold text-theme-body mt-0.5">{attr.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-theme-divider/60 pt-4 overflow-x-auto">
          {tabs.map((t) => {
            const isActive = t.id === activeTabId;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTabId(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-theme-surface-2 border border-theme-divider text-theme-muted hover:text-theme-body hover:border-theme-muted"
                }`}
              >
                <span>{t.label}</span>
                {t.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      isActive ? "bg-white/20 text-white" : "bg-theme-surface-3 text-theme-muted"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Section */}
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-6 shadow-lg min-h-[400px]">
        {activeTab?.content}
      </div>
    </div>
  );
};
