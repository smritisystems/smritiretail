/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Generic Document Footer (Sticky Action Bar)
 */

import React from "react";
import { Save, Printer, Share2, CheckCircle2, X, FileText } from "lucide-react";

interface DocumentFooterProps {
  onSaveDraft?: () => void;
  onSave?: () => void;
  onPost?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
  onCancel: () => void;
  isDirty?: boolean;
  lastAutosavedAt?: number | null;
}

export const DocumentFooter: React.FC<DocumentFooterProps> = ({
  onSaveDraft,
  onSave,
  onPost,
  onPrint,
  onShare,
  onCancel,
  isDirty,
  lastAutosavedAt,
}) => {
  return (
    <div className="sticky bottom-0 z-40 bg-theme-surface-1 border-t border-theme-divider px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xl">
      {/* Left: Dirty status & Autosave timestamp */}
      <div className="flex items-center space-x-3 text-theme-muted font-mono text-[11px]">
        {isDirty ? (
          <span className="flex items-center space-x-1 text-amber-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Unsaved Changes</span>
          </span>
        ) : (
          <span className="text-emerald-400 font-semibold flex items-center space-x-1">
            <CheckCircle2 size={12} />
            <span>Saved</span>
          </span>
        )}
        {lastAutosavedAt && (
          <span className="text-theme-muted">
            â€¢ Autosaved {new Date(lastAutosavedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Right: Primary Action Buttons */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body font-semibold transition cursor-pointer"
        >
          Cancel
        </button>

        {onPrint && (
          <button
            type="button"
            onClick={onPrint}
            className="px-4 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body font-semibold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        )}

        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="px-4 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body font-semibold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Share2 size={14} />
            <span>Share</span>
          </button>
        )}

        {onSaveDraft && (
          <button
            type="button"
            onClick={onSaveDraft}
            className="px-4 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary font-bold transition cursor-pointer"
          >
            Save Draft
          </button>
        )}

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Save size={14} />
            <span>Save</span>
          </button>
        )}

        {onPost && (
          <button
            type="button"
            onClick={onPost}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
          >
            <CheckCircle2 size={14} />
            <span>Post Invoice</span>
          </button>
        )}
      </div>
    </div>
  );
};
