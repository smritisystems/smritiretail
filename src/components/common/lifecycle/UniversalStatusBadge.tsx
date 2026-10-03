/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 6.47.4
 * * Created    : 2026-10-01
 * * Modified   : 2026-10-01
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";

export interface UniversalStatusBadgeProps {
  status?: string | null;
  version?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  showIcon?: boolean;
}

interface StatusStyle {
  label: string;
  badgeClass: string;
  icon: string;
}

const STATUS_MAP: Record<string, StatusStyle> = {
  DRAFT: {
    label: "Draft",
    badgeClass: "bg-amber-950/60 text-amber-300 border-amber-800/60",
    icon: "edit_note",
  },
  SUBMITTED: {
    label: "Submitted",
    badgeClass: "bg-blue-950/60 text-blue-300 border-blue-800/60",
    icon: "schedule_send",
  },
  PENDING_APPROVAL: {
    label: "Pending Approval",
    badgeClass: "bg-purple-950/60 text-purple-300 border-purple-800/60",
    icon: "hourglass_top",
  },
  APPROVED: {
    label: "Approved",
    badgeClass: "bg-teal-950/60 text-teal-300 border-teal-800/60",
    icon: "verified",
  },
  CONFIRMED: {
    label: "Confirmed",
    badgeClass: "bg-emerald-950/60 text-emerald-300 border-emerald-800/60",
    icon: "check_circle",
  },
  PARTIALLY_RECEIVED: {
    label: "Partially Received",
    badgeClass: "bg-cyan-950/60 text-cyan-300 border-cyan-800/60",
    icon: "inventory_2",
  },
  RECEIVED: {
    label: "Received",
    badgeClass: "bg-teal-950/60 text-teal-300 border-teal-800/60",
    icon: "all_inbox",
  },
  COMPLETED: {
    label: "Completed",
    badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
    icon: "task_alt",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeClass: "bg-rose-950/60 text-rose-300 border-rose-800/60",
    icon: "cancel",
  },
  REJECTED: {
    label: "Rejected",
    badgeClass: "bg-red-950/60 text-red-300 border-red-800/60",
    icon: "block",
  },
  AMENDED: {
    label: "Amended",
    badgeClass: "bg-violet-950/60 text-violet-300 border-violet-800/60",
    icon: "history_edu",
  },
};

export const UniversalStatusBadge: React.FC<UniversalStatusBadgeProps> = ({
  status,
  version,
  size = "md",
  className = "",
  showIcon = true,
}) => {
  const normalized = String(status || "DRAFT").trim().toUpperCase();
  const config = STATUS_MAP[normalized] || {
    label: status || "Unknown",
    badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
    icon: "help_outline",
  };

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[9px] gap-1",
    md: "px-2 py-0.5 text-[11px] gap-1.5",
    lg: "px-2.5 py-1 text-xs gap-2",
  }[size];

  const iconSizes = {
    sm: "text-[11px]",
    md: "text-[13px]",
    lg: "text-[15px]",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${config.badgeClass} ${sizeClasses} ${className}`}
      title={`Document status: ${config.label}${version ? ` (v${version})` : ""}`}
    >
      {showIcon && (
        <span className={`material-symbols-outlined leading-none ${iconSizes}`}>
          {config.icon}
        </span>
      )}
      <span>{config.label}</span>
      {version !== null && version !== undefined && version > 0 && (
        <span className="ml-1 opacity-70 text-[9px] font-mono">
          v{version}
        </span>
      )}
    </span>
  );
};
export default UniversalStatusBadge;
