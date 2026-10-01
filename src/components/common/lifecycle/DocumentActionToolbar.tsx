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

export interface DocumentActionToolbarProps {
  currentStatus: string;
  availableActions?: string[];
  busy?: boolean;
  canManage?: boolean;
  onSubmit?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onAmend?: () => void;
  onOpen?: () => void;
  className?: string;
  size?: "sm" | "md";
}

export const DocumentActionToolbar: React.FC<DocumentActionToolbarProps> = ({
  currentStatus,
  availableActions,
  busy = false,
  canManage = true,
  onSubmit,
  onConfirm,
  onCancel,
  onAmend,
  onOpen,
  className = "",
  size = "sm",
}) => {
  const normStatus = currentStatus.trim().toUpperCase();
  const acts = availableActions?.map((a) => a.toUpperCase());

  const canSubmit = acts ? acts.includes("SUBMIT") : normStatus === "DRAFT";
  const canConfirm = acts ? (acts.includes("CONFIRM") || acts.includes("APPROVE")) : normStatus === "SUBMITTED";
  const canAmend = acts ? acts.includes("AMEND") : normStatus === "CONFIRMED";
  const canCancel = acts
    ? acts.includes("CANCEL")
    : ["DRAFT", "SUBMITTED", "CONFIRMED"].includes(normStatus);

  const btnPadding = size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs";
  const iconSize = size === "sm" ? "text-[12px]" : "text-[14px]";

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* SUBMIT */}
      {canSubmit && canManage && onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          title="Submit document for verification/approval"
          className={`inline-flex items-center gap-1 rounded-md bg-blue-700 hover:bg-blue-600 text-white font-semibold transition disabled:opacity-50 ${btnPadding}`}
        >
          {busy ? (
            <span className={`animate-spin material-symbols-outlined ${iconSize}`}>progress_activity</span>
          ) : (
            <span className={`material-symbols-outlined ${iconSize}`}>send</span>
          )}
          <span>Submit</span>
        </button>
      )}

      {/* CONFIRM / APPROVE */}
      {canConfirm && canManage && onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          title="Confirm / Authorize document"
          className={`inline-flex items-center gap-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition disabled:opacity-50 ${btnPadding}`}
        >
          {busy ? (
            <span className={`animate-spin material-symbols-outlined ${iconSize}`}>progress_activity</span>
          ) : (
            <span className={`material-symbols-outlined ${iconSize}`}>task_alt</span>
          )}
          <span>Confirm</span>
        </button>
      )}

      {/* AMEND */}
      {canAmend && canManage && onAmend && (
        <button
          type="button"
          onClick={onAmend}
          disabled={busy}
          title="Amend document (generates new revision chain)"
          className={`inline-flex items-center gap-1 rounded-md bg-violet-800 hover:bg-violet-700 text-white font-semibold transition disabled:opacity-50 ${btnPadding}`}
        >
          <span className={`material-symbols-outlined ${iconSize}`}>edit_document</span>
          <span>Amend</span>
        </button>
      )}

      {/* OPEN / VIEW */}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          title="Open document details"
          className={`inline-flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition ${btnPadding}`}
        >
          <span className={`material-symbols-outlined ${iconSize}`}>open_in_new</span>
          <span>Open</span>
        </button>
      )}

      {/* CANCEL */}
      {canCancel && canManage && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          title="Cancel document"
          className={`inline-flex items-center gap-1 rounded-md bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 transition disabled:opacity-50 ${btnPadding}`}
        >
          <span className={`material-symbols-outlined ${iconSize}`}>cancel</span>
          <span>Cancel</span>
        </button>
      )}
    </div>
  );
};
export default DocumentActionToolbar;
