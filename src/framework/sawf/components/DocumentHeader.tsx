/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Generic Document Header
 */

import React from "react";
import { ArrowLeft, Save, Printer, CheckCircle2, X, Command } from "lucide-react";
import { WorkspaceFormActions } from "../../../components/workspace/WorkspaceFormActions.tsx";
import { SAWFExperienceMode, SAWFWorkspaceProfile } from "../types/sawf.ts";

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

      {/* Center/Right: Progressive Experience Mode Switcher & Controls */}
      <div className="flex flex-wrap items-center space-x-3 text-xs">
        {/* Mode Selector */}
        <div className="flex items-center bg-theme-surface-2 border border-theme-divider rounded-xl p-1">
          <span className="px-2 text-[10px] font-mono text-theme-muted uppercase hidden sm:inline">Mode:</span>
          {(["simple", "standard", "enterprise"] as SAWFExperienceMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition capitalize cursor-pointer ${
                mode === m
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-theme-muted hover:text-theme-primary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Command Palette Trigger */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
            title="Command Palette (Ctrl+K)"
          >
            <Command size={14} className="text-indigo-400" />
            <span className="hidden sm:inline">Commands</span>
            <span className="font-mono text-[9px] bg-theme-surface-2 px-1 rounded text-theme-muted">Ctrl+K</span>
          </button>
        )}

        <WorkspaceFormActions
          secondaryActions={
            <>
              <div className="flex items-center bg-theme-surface-2 border border-theme-divider rounded-xl p-1">
                <span className="px-2 text-[10px] font-mono text-theme-muted uppercase hidden sm:inline">Mode:</span>
                {(["simple", "standard", "enterprise"] as any[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onModeChange(m as any)}
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
                  title="Command Palette (Ctrl+K)"
                >
                  <Command size={14} className="text-indigo-400" />
                  <span className="hidden sm:inline">Commands</span>
                  <span className="font-mono text-[9px] bg-theme-surface-2 px-1 rounded text-theme-muted">Ctrl+K</span>
                </button>
              )}
            </>
          }
          primaryActions={
            <>
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
            </>
          }
          extraMeta={documentNo ? <div className="text-right text-xs font-mono text-theme-muted">{documentNo}</div> : undefined}
        />
      </div>
    </div>
  );
};
