/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : UniversalActionBar (Metadata-Driven Workspace Action Bar)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.5.0
 */

import React from "react";
import { Save, Printer, Download, Share2, RefreshCw, X, Trash2, Plus } from "lucide-react";
import { WorkspaceAction } from "../../sdk/IWorkspace.ts";

interface UniversalActionBarProps {
  workspaceTitle: string;
  onSave?: () => void;
  onSaveAndNew?: () => void;
  onDelete?: () => void;
  onPrint?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onRefresh?: () => void;
  onClose?: () => void;
  customActions?: WorkspaceAction[];
}

export const UniversalActionBar: React.FC<UniversalActionBarProps> = ({
  workspaceTitle,
  onSave,
  onSaveAndNew,
  onDelete,
  onPrint,
  onExport,
  onShare,
  onRefresh,
  onClose,
  customActions = []
}) => {
  return (
    <div className="flex items-center justify-between bg-theme-surface-2 border-b border-theme-divider px-4 py-2 text-xs font-sans text-theme-heading">
      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-theme-heading">{workspaceTitle}</span>
        <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded">
          Active
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5">
        {onSave && (
          <button
            onClick={onSave}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Save size={13} />
            <span>Save</span>
          </button>
        )}

        {onSaveAndNew && (
          <button
            onClick={onSaveAndNew}
            className="px-2.5 py-1 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-heading font-medium transition-all cursor-pointer flex items-center gap-1.5 border border-theme-divider"
          >
            <Plus size={13} />
            <span>Save & New</span>
          </button>
        )}

        {customActions.map((act) => (
          <button
            key={act.id}
            onClick={act.onClick}
            className="px-2.5 py-1 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-heading font-medium transition-all cursor-pointer flex items-center gap-1.5 border border-theme-divider"
          >
            <span>{act.label}</span>
          </button>
        ))}

        {onPrint && (
          <button
            onClick={onPrint}
            className="p-1.5 rounded-lg text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
            title="Print Document"
          >
            <Printer size={14} />
          </button>
        )}

        {onExport && (
          <button
            onClick={onExport}
            className="p-1.5 rounded-lg text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
            title="Export Excel / PDF"
          >
            <Download size={14} />
          </button>
        )}

        {onShare && (
          <button
            onClick={onShare}
            className="p-1.5 rounded-lg text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
            title="Share Record"
          >
            <Share2 size={14} />
          </button>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={14} />
          </button>
        )}

        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
            title="Delete Record"
          >
            <Trash2 size={14} />
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:bg-theme-surface-hover transition-all cursor-pointer border-l border-theme-divider ml-1 pl-2"
            title="Close Workspace"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
