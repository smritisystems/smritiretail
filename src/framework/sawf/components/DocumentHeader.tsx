/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Generic Document Header
 */

import React from "react";
import { ArrowLeft, X } from "lucide-react";
import { SAWFExperienceMode, SAWFWorkspaceProfile } from "../types/sawf.ts";
import WorkspaceFormActions from "../../../components/workspace/WorkspaceFormActions";

interface DocumentHeaderProps {
  title: string;
  documentNo?: string;
  status: string;
  mode: SAWFExperienceMode;
  onModeChange: (mode: SAWFExperienceMode) => void;
  profileName?: string;
  onBack: () => void;
  onSaveDraft?: () => void;
  onSave?: () => void;
  onPost?: () => void;
  onPrint?: () => void;
  onOpenCommandPalette?: () => void;
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  title,
  documentNo,
  status,
  mode,
  onModeChange,
  profileName,
  onBack,
  onSaveDraft,
  onSave,
  onPost,
  onPrint,
  onOpenCommandPalette,
}) => {
  return (
    <div className="bg-theme-surface-1 border-b border-theme-divider px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
      {/* Left: Back & Title */}
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body hover:text-theme-heading transition flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Registry</span>
        </button>

        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold font-display text-white tracking-wide">{title}</h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                status === "Draft"
                  ? "bg-blue-950/80 text-[var(--c-seef-accent)] border border-blue-500/40"
                  : status === "Submitted"
                  ? "bg-amber-950/80 text-amber-400 border border-amber-500/40"
                  : "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40"
              }`}
            >
              {status}
            </span>
          </div>
          {documentNo && <span className="text-xs font-mono text-indigo-400 font-semibold">{documentNo}</span>}
        </div>
      </div>

      {/* Center/Right: Shared workspace actions */}
      <div className="flex flex-wrap items-center">
        <WorkspaceFormActions
          mode={mode}
          onModeChange={onModeChange}
          onOpenCommandPalette={onOpenCommandPalette}
          onSaveDraft={onSaveDraft}
          onSave={onSave}
          onPost={onPost}
          onPrint={onPrint}
        />
      </div>
    </div>
  );
};
