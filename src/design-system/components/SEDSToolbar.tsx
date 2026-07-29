/**
 * Project      : SMRITI Business OS
 * Component    : SEDSToolbar (Enforces Max 7 Actions per Screen Rule)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Core Component
 */

import React, { useState } from "react";
import { MoreHorizontal } from "lucide-react";

export interface SEDSAction {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
}

export interface SEDSToolbarProps {
  title?: string;
  actions: SEDSAction[];
  maxVisibleActions?: number; // Defaults to 7 max per rule
}

export const SEDSToolbar: React.FC<SEDSToolbarProps> = ({
  title,
  actions,
  maxVisibleActions = 7,
}) => {
  const [showOverflow, setShowOverflow] = useState(false);

  const visibleActions = actions.slice(0, maxVisibleActions);
  const overflowActions = actions.slice(maxVisibleActions);

  return (
    <div className="w-full bg-theme-surface-1 border border-theme-divider rounded-2xl px-5 py-3 flex items-center justify-between gap-4 font-sans">
      {title && <h4 className="text-xs font-bold text-theme-body uppercase tracking-wider">{title}</h4>}

      <div className="flex items-center gap-2 ml-auto">
        {visibleActions.map((act) => {
          const Icon = act.icon;
          const isPrimary = act.variant === "primary";
          const isDanger = act.variant === "danger";

          return (
            <button
              key={act.id}
              onClick={act.onClick}
              disabled={act.disabled}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                act.disabled
                  ? "opacity-40 cursor-not-allowed border-theme-divider"
                  : isPrimary
                  ? "bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-md"
                  : isDanger
                  ? "bg-red-950/40 border-red-500/40 text-red-400 hover:bg-red-950/60"
                  : "bg-theme-surface-2 border-theme-divider text-theme-body hover:bg-theme-surface-hover hover:border-theme-muted"
              }`}
            >
              {Icon && <Icon size={14} />}
              <span>{act.label}</span>
            </button>
          );
        })}

        {overflowActions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowOverflow(!showOverflow)}
              className="p-1.5 rounded-xl bg-theme-surface-2 border border-theme-divider text-theme-muted hover:text-theme-body transition"
              title="More Actions"
            >
              <MoreHorizontal size={16} />
            </button>

            {showOverflow && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#141720] border border-indigo-500/30 rounded-2xl shadow-2xl z-50 p-2 space-y-1 text-xs">
                {overflowActions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      onClick={() => {
                        act.onClick();
                        setShowOverflow(false);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left font-medium text-theme-body hover:bg-theme-surface-hover flex items-center gap-2 transition"
                    >
                      {Icon && <Icon size={14} className="text-theme-muted" />}
                      <span>{act.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
