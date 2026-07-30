/**
 * Project      : SMRITI Business OS
 * Component    : SEDSStatusBadge (Semantic Status Indicator)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Core Component
 */

import React from "react";

export type SEDSStatusType =
  | "success" | "warning" | "error" | "info" | "neutral"
  | "Active" | "Inactive" | "Draft" | "Pending" | "Posted" | "Completed" | "Cancelled";

export interface SEDSStatusBadgeProps {
  status: SEDSStatusType;
  label?: string;
  children?: React.ReactNode;
  icon?: React.ElementType;
}

export const SEDSStatusBadge: React.FC<SEDSStatusBadgeProps> = ({
  status,
  label,
  children,
  icon: Icon,
}) => {
  const displayLabel = label || (typeof children === "string" ? children : String(status));
  const normalizeStatus = (s: SEDSStatusType): "success" | "warning" | "error" | "info" | "neutral" => {
    if (s === "Active" || s === "Completed" || s === "Posted") return "success";
    if (s === "Draft" || s === "Pending") return "warning";
    if (s === "Cancelled" || s === "Inactive") return "error";
    if (s === "info") return "info";
    if (s === "error") return "error";
    if (s === "warning") return "warning";
    if (s === "success") return "success";
    return "neutral";
  };

  const normalized = normalizeStatus(status);

  const styles: Record<"success" | "warning" | "error" | "info" | "neutral", string> = {
    success: "bg-emerald-950/40 border-emerald-500/30 text-emerald-400",
    warning: "bg-amber-950/40 border-amber-500/30 text-amber-400",
    error: "bg-red-950/40 border-red-500/30 text-red-400",
    info: "bg-blue-950/40 border-blue-500/30 text-blue-400",
    neutral: "bg-theme-surface-2 border-theme-divider text-theme-muted",
  };

  const dotStyles: Record<"success" | "warning" | "error" | "info" | "neutral", string> = {
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    error: "bg-red-400",
    info: "bg-blue-400",
    neutral: "bg-theme-muted",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-semibold tracking-wide ${styles[normalized]}`}>
      {Icon ? <Icon size={12} /> : <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[normalized]}`} />}
      <span>{displayLabel}</span>
    </span>
  );
};
