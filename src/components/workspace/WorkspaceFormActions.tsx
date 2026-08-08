/**
 * Shared Workspace Form Actions
 * Renders mode selector and primary/secondary document actions (Save, Draft, Post, Print, Commands)
 */
import React from "react";
import { Save, CheckCircle2, Search, Printer } from "lucide-react";
import { SAWFExperienceMode } from "../../framework/sawf/types/sawf";

interface WorkspaceFormActionsProps {
  mode: SAWFExperienceMode;
  onModeChange: (m: SAWFExperienceMode) => void;
  onOpenCommandPalette?: () => void;
  onSaveDraft?: () => void;
  onSave?: () => void;
  onPost?: () => void;
  onPrint?: () => void;
}

const WorkspaceFormActions: React.FC<WorkspaceFormActionsProps> = ({
  mode,
  onModeChange,
  onOpenCommandPalette,
  onSaveDraft,
  onSave,
  onPost,
  onPrint,
}) => {
  return (
    <div className="flex flex-wrap items-center space-x-3 text-xs">
      <div className="flex items-center bg-theme-surface-2 border border-theme-divider rounded-xl p-1">
        <span className="px-2 text-[10px] font-mono text-theme-muted uppercase hidden sm:inline">Mode:</span>
        {(["simple", "standard", "enterprise"] as SAWFExperienceMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition capitalize cursor-pointer ${
              mode === m ? "bg-indigo-600 text-white shadow-md" : "text-theme-muted hover:text-theme-primary"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {onOpenCommandPalette && (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
          title="Universal Search"
        >
          <Search size={14} className="text-indigo-400" />
          <span className="hidden sm:inline">Search</span>
        </button>
      )}

      {onSaveDraft && (
        <button
          type="button"
          onClick={onSaveDraft}
          className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded-xl font-semibold transition cursor-pointer"
        >
          Save Draft
        </button>
      )}

      {onSave && (
        <button
          type="button"
          onClick={onSave}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
        >
          <Save size={14} />
          <span>Save</span>
        </button>
      )}

      {onPost && (
        <button
          type="button"
          onClick={onPost}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
        >
          <CheckCircle2 size={14} />
          <span>Post Invoice</span>
        </button>
      )}

      {onPrint && (
        <button
          type="button"
          onClick={onPrint}
          className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded-xl font-semibold transition cursor-pointer flex items-center gap-2"
        >
          <Printer size={14} />
          <span className="hidden sm:inline">Print</span>
        </button>
      )}
    </div>
  );
};

export default WorkspaceFormActions;
