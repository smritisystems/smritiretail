/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Spec         : §7, §8 (review point 7) — PO Issues summary bar.
 * Shows all PO line issues in one place in the PO header.
 * Clicking "Review Issues" opens POValidationSummary.
 */

import React from "react";
import type { POIssuesSummary } from "./types";

interface Props {
  summary: POIssuesSummary;
  onReview?: () => void;
  /** If true, renders as a compact horizontal bar for the PO header (review pt 8). */
  compact?: boolean;
}

export const POIssuesSummaryBar: React.FC<Props> = ({ summary, onReview, compact = false }) => {
  if (summary.totalEvaluated === 0) return null;

  if (compact) {
    // Header bar: ✓ 10 Allowed  ⚠ 2 Approval  ✕ 1 Blocked
    return (
      <div className="flex items-center gap-3 text-[10px] font-semibold flex-wrap">
        {summary.allowedCount > 0 && (
          <span className="text-green-700">✓ {summary.allowedCount} Allowed</span>
        )}
        {summary.approvalRequiredCount > 0 && (
          <span className="text-amber-700">⚠ {summary.approvalRequiredCount} Approval</span>
        )}
        {summary.blockedCount > 0 && (
          <span className="text-red-700">✕ {summary.blockedCount} Blocked</span>
        )}
        {summary.staleCount > 0 && (
          <span className="text-purple-700">↻ {summary.staleCount} Stale</span>
        )}
        {onReview && summary.hasIssues && (
          <button type="button" onClick={onReview}
            className="text-[#00296d] underline hover:no-underline font-bold">
            Review Issues
          </button>
        )}
      </div>
    );
  }

  // Full panel — shown when "Review Issues" is clicked (review point 7)
  const issueCount = summary.approvalRequiredCount + summary.blockedCount + summary.staleCount;

  return (
    <div className="border border-[#c4c6d4] rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className={"flex items-center justify-between px-3 py-2 border-b border-[#c4c6d4] " + (issueCount > 0 ? "bg-amber-50" : "bg-green-50")}>
        <span className="text-xs font-bold text-[#1a1b20]">
          PO Issues
          {issueCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] rounded-full bg-amber-500 text-white font-bold">
              {issueCount}
            </span>
          )}
        </span>
        {onReview && (
          <button type="button" onClick={onReview}
            className="text-xs text-[#00296d] font-semibold underline hover:no-underline">
            Review Issues
          </button>
        )}
      </div>

      {/* Issue rows */}
      <div className="px-3 py-2 flex flex-col gap-1.5">
        {summary.allowedCount > 0 && (
          <IssueLine icon="✓" count={summary.allowedCount} label="products allowed" color="text-green-700" />
        )}
        {summary.approvalRequiredCount > 0 && (
          <IssueLine icon="⚠" count={summary.approvalRequiredCount} label="products require approval" color="text-amber-700" />
        )}
        {summary.blockedCount > 0 && (
          <IssueLine icon="✕" count={summary.blockedCount} label="product is blocked" plural="products are blocked" color="text-red-700" />
        )}
        {summary.staleCount > 0 && (
          <IssueLine icon="↻" count={summary.staleCount} label="product has a stale vendor decision" plural="products have stale vendor decisions" color="text-purple-700" />
        )}
        {issueCount === 0 && summary.totalEvaluated > 0 && (
          <div className="text-xs text-green-700 font-medium">
            All {summary.totalEvaluated} products are allowed. No issues.
          </div>
        )}
      </div>
    </div>
  );
};

const IssueLine: React.FC<{
  icon: string; count: number; label: string; plural?: string; color: string;
}> = ({ icon, count, label, plural, color }) => (
  <div className={"flex items-center gap-2 text-xs " + color}>
    <span className="font-bold w-4 shrink-0">{icon}</span>
    <span>
      <strong>{count}</strong>{" "}
      {count === 1 ? label : (plural ?? label)}
    </span>
  </div>
);

export default POIssuesSummaryBar;
