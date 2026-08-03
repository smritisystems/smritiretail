/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Unsaved Changes Modal Guard
 */

import React from "react";
import { AlertTriangle } from "lucide-react";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSaveAndExit: () => void;
  onDiscardAndExit: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onSaveAndExit,
  onDiscardAndExit,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-theme-primary">
        <div className="flex items-center space-x-3 text-amber-400">
          <AlertTriangle size={24} />
          <h3 className="text-base font-bold font-display text-white">Unsaved Document Changes</h3>
        </div>

        <p className="text-xs text-theme-body leading-relaxed">
          You have modified line items or document header details. Exiting without saving will discard your edits.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={onSaveAndExit}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
          >
            Save & Exit
          </button>
          <button
            type="button"
            onClick={onDiscardAndExit}
            className="flex-1 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 px-4 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Keep Editing
          </button>
        </div>
      </div>
    </div>
  );
};
