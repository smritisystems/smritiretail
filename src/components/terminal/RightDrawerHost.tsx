/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.1.0  (SEEF Phase 8 - Theme token cascade)
 * Created      : 2026-07-20
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { DrawerRegistry } from "./DrawerRegistry";

interface RightDrawerHostProps {
  activeDrawerId: string | null;
  drawerData?: any;
  onSave: (result: any) => void;
  onClose: () => void;
}

export const RightDrawerHost: React.FC<RightDrawerHostProps> = ({
  activeDrawerId,
  drawerData,
  onSave,
  onClose
}) => {
  if (!activeDrawerId) return null;

  const drawerDef = DrawerRegistry.get(activeDrawerId);

  return (
    // SEEF Phase 8: bg-[#1e293b] → bg-theme-surface-1; bg-[#0f172a] → bg-theme-base
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-theme-surface-1 border-l border-theme-divider shadow-2xl flex flex-col transition-all duration-200 ease-in-out font-sans">
      <header className="h-14 bg-theme-base border-b border-theme-divider px-5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <span className="material-symbols-outlined text-blue-400 text-xl">{drawerDef?.icon || "tune"}</span>
          <h3 className="text-sm font-bold tracking-wide uppercase text-theme-heading font-display">
            {drawerDef?.title || activeDrawerId.toUpperCase()}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-theme-muted hover:text-theme-heading p-1 rounded hover:bg-theme-surface-2 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-5 text-xs text-theme-body">
        {drawerDef ? (
          <drawerDef.component data={drawerData} onSave={onSave} onClose={onClose} />
        ) : (
          <div className="p-4 text-center text-theme-muted font-mono">
            Drawer '{activeDrawerId}' registered in host.
          </div>
        )}
      </main>
    </div>
  );
};
