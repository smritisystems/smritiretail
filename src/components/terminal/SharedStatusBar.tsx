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

import React, { useState, useEffect } from "react";
import { HardwareAdapterRegistry } from "../../hardware/HardwareAdapterRegistry";

interface SharedStatusBarProps {
  currentUser: any;
  activeShift: any;
  activeProfile: any;
  isOnline: boolean;
  syncQueueLength: number;
}

export const SharedStatusBar: React.FC<SharedStatusBarProps> = ({
  currentUser,
  activeShift,
  activeProfile,
  isOnline,
  syncQueueLength
}) => {
  const [hwStatus, setHwStatus] = useState(HardwareAdapterRegistry.getStatus());
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
      setHwStatus(HardwareAdapterRegistry.getStatus());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // SEEF Phase 8: bg-[#1e293b] → bg-theme-surface-1; border-theme-divider → border-theme-divider
  // Separator pipes use text-theme-divider (maps to CSS var rather than hardcoded slate-600)
  return (
    <footer className="h-8 bg-theme-surface-1 border-t border-theme-divider px-5 flex items-center justify-between shrink-0 text-[10px] font-mono text-theme-muted select-none">
      <div className="flex items-center space-x-3">
        <span className="flex items-center space-x-1.5">
          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
          <span className="font-semibold text-theme-body">{isOnline ? "ONLINE" : "OFFLINE"}</span>
        </span>
        <span className="text-theme-divider">|</span>
        <span>Operator: <span className="text-theme-body font-semibold">{currentUser?.name || "Cashier"}</span></span>
        <span className="text-theme-divider">|</span>
        <span>Profile: <span className="text-blue-400">{activeProfile?.name || "Lane 01"}</span></span>
        <span className="text-theme-divider">|</span>
        {activeShift && (
          <>
            <span>Shift: <span className="text-emerald-400 font-bold">#{activeShift.id}</span></span>
            <span className="text-theme-divider">|</span>
          </>
        )}
        <span>Scanner: <span className="text-emerald-400">{hwStatus.scanner}</span></span>
        <span className="text-theme-divider">|</span>
        <span>Printer: <span className="text-emerald-400">{hwStatus.printer}</span></span>
        <span className="text-theme-divider">|</span>
        <span>Scale: <span className="text-theme-body">{hwStatus.scale}</span></span>
      </div>

      <div className="flex items-center space-x-3">
        <span>Queue: <span className="text-amber-400 font-bold">{syncQueueLength}</span></span>
        <span className="text-theme-divider">|</span>
        <span>SMRITI Retail OS v5.0</span>
        <span className="text-theme-divider">|</span>
        <span className="text-theme-body font-semibold">{currentTime}</span>
      </div>
    </footer>
  );
};
