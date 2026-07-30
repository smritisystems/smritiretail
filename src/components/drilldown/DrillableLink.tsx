/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : DrillableLink (SUNEF Metadata-Driven Entity Link Component)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

import React, { useState } from "react";
import { useDrillDown, DrillContextData } from "./drilldown_store.tsx";
import { SUNEFKernel } from "../../navigation/SUNEFKernel.ts";

interface Props {
  context: DrillContextData;
  children: React.ReactNode;
  className?: string;
  asMenuItem?: boolean;
}

export const DrillableLink: React.FC<Props> = ({ context, children, className = "", asMenuItem }) => {
  const { openPanel, pushContext } = useDrillDown();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openPanel(context);
    pushContext(context);
  };

  const handleOpenWorkspace = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    SUNEFKernel.open({ type: context.entityType, id: context.entityId });
    setMenuOpen(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  const baseStyles = asMenuItem
    ? "w-full text-left hover:bg-theme-surface-hover hover:text-[#0a6ed1] transition-colors cursor-pointer group"
    : "text-[#0a6ed1] hover:text-[#085caf] hover:underline cursor-pointer transition-colors font-bold";

  return (
    <>
      <span
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`${baseStyles} ${className}`}
      >
        {children}
      </span>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/20"
            onClick={() => setMenuOpen(false)}
            onContextMenu={(e) => { e.preventDefault(); setMenuOpen(false); }}
          />
          <div
            className="fixed z-50 bg-theme-surface-2 border border-theme-divider shadow-xl rounded-xl min-w-[220px] py-1 text-xs font-sans select-none"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <div className="px-3 py-2 border-b border-theme-divider">
              <div className="font-bold text-theme-heading">{context.title}</div>
              <div className="text-[10px] text-theme-muted uppercase font-mono mt-0.5">{context.entityType} ID: {context.entityId}</div>
            </div>

            <button
              onClick={handleOpenWorkspace}
              className="w-full text-left px-4 py-2 hover:bg-theme-surface-hover text-theme-heading flex items-center space-x-2 transition-colors cursor-pointer font-bold"
            >
              <span className="material-symbols-outlined text-[16px] text-[#0a6ed1]">open_in_new</span>
              <span>Open Dedicated Workspace</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleClick(e); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2 hover:bg-theme-surface-hover text-theme-heading flex items-center space-x-2 transition-colors cursor-pointer font-bold"
            >
              <span className="material-symbols-outlined text-[16px] text-purple-400">dock_to_right</span>
              <span>Quick Side Inspection</span>
            </button>
          </div>
        </>
      )}
    </>
  );
};
