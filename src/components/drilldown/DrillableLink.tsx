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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { useDrillDown, DrillContextData } from "./drilldown_store.tsx";

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
  };

  const baseStyles = asMenuItem 
    ? "w-full text-left hover:bg-theme-surface-hover hover:text-blue-400 transition-colors cursor-pointer group" 
    : "text-blue-500 hover:text-blue-400 hover:underline cursor-pointer transition-colors";

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
            className="fixed inset-0 z-50" 
            onClick={handleCloseMenu}
            onContextMenu={(e) => { e.preventDefault(); handleCloseMenu(); }}
          />
          <div 
            className="fixed z-50 bg-theme-surface-2 border border-theme-divider shadow-xl rounded-md min-w-[200px] py-1 text-sm font-sans"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <div className="px-3 py-2 border-b border-theme-divider">
              <div className="font-semibold text-theme-body">{context.title}</div>
              <div className="text-xs text-theme-muted uppercase font-mono mt-0.5">{context.entityType}</div>
            </div>
            
            <button className="w-full text-left px-4 py-2 hover:bg-theme-surface-hover text-theme-body flex items-center space-x-2 transition-colors">
               <span className="material-symbols-outlined text-[16px] text-theme-muted">open_in_new</span>
               <span>Open in New Tab</span>
            </button>
            <button 
               onClick={(e) => { e.stopPropagation(); handleClick(e); handleCloseMenu(); }}
               className="w-full text-left px-4 py-2 hover:bg-theme-surface-hover text-theme-body flex items-center space-x-2 transition-colors"
            >
               <span className="material-symbols-outlined text-[16px] text-theme-muted">dock_to_right</span>
               <span>Open in Side Panel</span>
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-theme-surface-hover text-theme-body flex items-center space-x-2 transition-colors">
               <span className="material-symbols-outlined text-[16px] text-theme-muted">edit</span>
               <span>Edit {context.entityType}</span>
            </button>
            
            <div className="my-1 border-t border-theme-divider"></div>
            
            <button className="w-full text-left px-4 py-2 hover:bg-theme-surface-hover text-theme-body flex items-center space-x-2 transition-colors">
               <span className="material-symbols-outlined text-[16px] text-theme-muted">receipt_long</span>
               <span>View Ledger</span>
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-theme-surface-hover text-theme-body flex items-center space-x-2 transition-colors">
               <span className="material-symbols-outlined text-[16px] text-theme-muted">inventory_2</span>
               <span>View Stock</span>
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-theme-surface-hover text-theme-body flex items-center space-x-2 transition-colors">
               <span className="material-symbols-outlined text-[16px] text-theme-muted">history</span>
               <span>Timeline</span>
            </button>
            
            <div className="my-1 border-t border-theme-divider"></div>
            
            <button className="w-full text-left px-4 py-2 hover:bg-theme-surface-hover text-theme-body flex items-center space-x-2 transition-colors">
               <span className="material-symbols-outlined text-[16px] text-theme-muted">content_copy</span>
               <span>Copy Number</span>
            </button>
          </div>
        </>
      )}
    </>
  );
};
