/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
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

  return (
    <footer className="h-8 bg-[#1e293b] border-t border-slate-700 px-5 flex items-center justify-between shrink-0 text-[10px] font-mono text-slate-400 select-none">
      <div className="flex items-center space-x-3">
        <span className="flex items-center space-x-1.5">
          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
          <span className="font-semibold text-slate-300">{isOnline ? "ONLINE" : "OFFLINE"}</span>
        </span>
        <span className="text-slate-600">|</span>
        <span>Operator: <span className="text-slate-200 font-semibold">{currentUser?.name || "Cashier"}</span></span>
        <span className="text-slate-600">|</span>
        <span>Profile: <span className="text-blue-400">{activeProfile?.name || "Lane 01"}</span></span>
        <span className="text-slate-600">|</span>
        {activeShift && (
          <>
            <span>Shift: <span className="text-emerald-400 font-bold">#{activeShift.id}</span></span>
            <span className="text-slate-600">|</span>
          </>
        )}
        <span>Scanner: <span className="text-emerald-400">{hwStatus.scanner}</span></span>
        <span className="text-slate-600">|</span>
        <span>Printer: <span className="text-emerald-400">{hwStatus.printer}</span></span>
        <span className="text-slate-600">|</span>
        <span>Scale: <span className="text-slate-300">{hwStatus.scale}</span></span>
      </div>

      <div className="flex items-center space-x-3">
        <span>Queue: <span className="text-amber-400 font-bold">{syncQueueLength}</span></span>
        <span className="text-slate-600">|</span>
        <span>SMRITI Retail OS v5.0</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-300 font-semibold">{currentTime}</span>
      </div>
    </footer>
  );
};
