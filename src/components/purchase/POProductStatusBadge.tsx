/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types (aligned with backend POProductDecision schema)
// ─────────────────────────────────────────────────────────────────────────────

export type POVendorDecisionStatus = "ASSIGNED" | "CROSS_VENDOR" | "UNASSIGNED" | "RESTRICTED";
export type POVendorDecisionAction = "ALLOW" | "READ_ONLY" | "APPROVAL_REQUIRED" | "BLOCK";

export interface POProductDecision {
  product_ref: string;
  status: POVendorDecisionStatus;
  action: POVendorDecisionAction;
  assignment_id?: string;
  assignment_level?: string;
  assignment_vendor_id?: string;
  assignment_vendor_name?: string;
  approval_required: boolean;
  approval_reason_required: boolean;
  approval_reasons: { code: string; label: string }[];
  explanation: string;
  policy_snapshot: Record<string, unknown>;
  policy_version: string;
  decision_log_id?: string;
  evaluated_at?: string;  // ISO timestamp — set by backend; used for stale detection
}

// ─────────────────────────────────────────────────────────────────────────────
// Token definitions (reuses SMRITI semantic token pattern)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  POVendorDecisionStatus,
  {
    emoji: string;
    label: string;
    pillBg: string;
    pillText: string;
    pillBorder: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  ASSIGNED: {
    emoji: "🟢",
    label: "Assigned",
    pillBg: "bg-emerald-50",
    pillText: "text-emerald-800",
    pillBorder: "border-emerald-300",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
  },
  CROSS_VENDOR: {
    emoji: "🟡",
    label: "Cross-Vendor",
    pillBg: "bg-amber-50",
    pillText: "text-amber-800",
    pillBorder: "border-amber-300",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
  },
  UNASSIGNED: {
    emoji: "🔵",
    label: "Unassigned",
    pillBg: "bg-sky-50",
    pillText: "text-sky-800",
    pillBorder: "border-sky-300",
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-700",
  },
  RESTRICTED: {
    emoji: "🔴",
    label: "Restricted",
    pillBg: "bg-rose-50",
    pillText: "text-rose-800",
    pillBorder: "border-rose-300",
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-700",
  },
};

const ACTION_CONFIG: Record<
  POVendorDecisionAction,
  { icon: string; label: string; textColor: string }
> = {
  ALLOW:             { icon: "check_circle",         label: "Allowed",              textColor: "text-emerald-700" },
  READ_ONLY:         { icon: "visibility",            label: "View Only",            textColor: "text-sky-700" },
  APPROVAL_REQUIRED: { icon: "approval",              label: "Approval Required",    textColor: "text-amber-700" },
  BLOCK:             { icon: "block",                 label: "Blocked",              textColor: "text-rose-700" },
};

// ─────────────────────────────────────────────────────────────────────────────
// POProductStatusBadge — compact inline badge for browse dialog rows
// ─────────────────────────────────────────────────────────────────────────────

interface POProductStatusBadgeProps {
  decision: POProductDecision | null | undefined;
  loading?: boolean;
  onClick?: (e?: React.MouseEvent) => void;
  compact?: boolean; // If true, show emoji only (for narrow column)
}

export const POProductStatusBadge: React.FC<POProductStatusBadgeProps> = ({
  decision,
  loading = false,
  onClick,
  compact = false,
}) => {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 animate-pulse">
        <span className="material-symbols-outlined text-[12px]">hourglass_empty</span>
        {!compact && "Checking..."}
      </span>
    );
  }

  if (!decision) {
    return null;
  }

  const cfg = STATUS_CONFIG[decision.status];
  const actionCfg = ACTION_CONFIG[decision.action];

  return (
    <button
      type="button"
      onClick={onClick}
      title={
        onClick
          ? `${cfg.emoji} ${cfg.label} — ${actionCfg.label}. Click for details.`
          : `${cfg.emoji} ${cfg.label} — ${actionCfg.label}`
      }
      className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded border px-1.5 py-0.5 leading-none transition-all
        ${cfg.pillBg} ${cfg.pillText} ${cfg.pillBorder}
        ${onClick ? "cursor-pointer hover:opacity-80 hover:shadow-sm" : "cursor-default"}`}
    >
      <span>{cfg.emoji}</span>
      {!compact && <span>{cfg.label}</span>}
      {!compact && decision.approval_required && (
        <span className="material-symbols-outlined text-[11px] text-amber-600">approval</span>
      )}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// POProductDecisionBanner — full-width banner in PO grid rows (after selection)
// ─────────────────────────────────────────────────────────────────────────────

interface POProductDecisionBannerProps {
  decision: POProductDecision;
  onExplain?: () => void;
}

export const POProductDecisionBanner: React.FC<POProductDecisionBannerProps> = ({
  decision,
  onExplain,
}) => {
  if (decision.action === "ALLOW") return null; // No banner needed for normal flow

  const cfg = STATUS_CONFIG[decision.status];
  const actionCfg = ACTION_CONFIG[decision.action];

  return (
    <div
      className={`flex items-start gap-2 px-2 py-1.5 rounded text-[10px] font-medium border
        ${cfg.pillBg} ${cfg.pillText} ${cfg.pillBorder}`}
    >
      <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">{actionCfg.icon}</span>
      <span className="flex-1">
        <strong>{actionCfg.label}:</strong>{" "}
        {decision.explanation || `This product requires ${actionCfg.label.toLowerCase()}.`}
      </span>
      {onExplain && (
        <button
          type="button"
          onClick={onExplain}
          className="shrink-0 underline hover:no-underline"
        >
          Details
        </button>
      )}
    </div>
  );
};
