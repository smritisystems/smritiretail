/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Spec         : §7, §10, §11 — Product decision panel shown below a PO line.
 * RULE: This component displays the backend decision — it never makes the decision.
 */

import React from "react";
import type { POProductDecision } from "./POProductStatusBadge";
import { POProductStatusBadge } from "./POProductStatusBadge";

interface Props {
  decision: POProductDecision | null;
  productName: string;
  /** Called for ALLOW and READ_ONLY actions. */
  onAdd?: () => void;
  /** Called for APPROVAL_REQUIRED — opens reason dialog before add. */
  onAddForApproval?: () => void;
  /** Opens POProductExplainModal for non-standard decisions. */
  onWhy?: () => void;
  loading?: boolean;
}

export const POProductDecisionPanel: React.FC<Props> = ({
  decision, productName, onAdd, onAddForApproval, onWhy, loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#737685]">
        <div className="animate-spin rounded-full h-3.5 w-3.5 border border-[#737685] border-t-transparent" />
        Checking vendor policy…
      </div>
    );
  }
  if (!decision) return null;

  const { status, action } = decision;

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-t border-[#eeedf3] bg-[#faf9ff]">
      {/* Status badge */}
      <POProductStatusBadge decision={decision} />

      {/* Context text */}
      <div className="flex-1 min-w-0 text-xs text-[#434652]">
        {status === "ASSIGNED" && (
          <span className="text-green-700 font-medium">Assigned to this vendor</span>
        )}
        {status === "CROSS_VENDOR" && (
          <span className="text-amber-700 font-medium">
            Normally assigned to another vendor
          </span>
        )}
        {status === "UNASSIGNED" && (
          <span className="text-blue-700 font-medium">
            No active vendor assignment for this product
          </span>
        )}
        {status === "RESTRICTED" && (
          <span className="text-red-700 font-medium">
            Cannot be purchased from this vendor
          </span>
        )}
      </div>

      {/* Action buttons — driven by backend action, not status */}
      <div className="flex items-center gap-1.5 shrink-0">
        {action === "ALLOW" && onAdd && (
          <button type="button" onClick={onAdd}
            className="px-3 py-1 rounded bg-[#00296d] text-white text-[11px] font-bold hover:bg-[#003d9e] transition-colors">
            Add
          </button>
        )}
        {action === "READ_ONLY" && onAdd && (
          <button type="button" onClick={onAdd}
            className="px-3 py-1 rounded bg-[#5d6270] text-white text-[11px] font-bold hover:bg-[#434652] transition-colors">
            Add (View Only)
          </button>
        )}
        {action === "APPROVAL_REQUIRED" && onAddForApproval && (
          <button type="button" onClick={onAddForApproval}
            className="px-3 py-1 rounded bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition-colors">
            Add for Approval
          </button>
        )}
        {/* BLOCK: no Add button — spec §7 */}

        {/* Why? — shown for all non-ALLOW decisions */}
        {action !== "ALLOW" && onWhy && (
          <button type="button" onClick={onWhy}
            className="px-2 py-1 rounded border border-[#c4c6d4] text-[11px] font-semibold text-[#5d6270] hover:bg-[#eeedf3] transition-colors">
            Why?
          </button>
        )}
      </div>
    </div>
  );
};

export default POProductDecisionPanel;
