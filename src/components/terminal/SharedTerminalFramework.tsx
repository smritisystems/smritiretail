/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.1.0  (SEEF Phase 8 - Theme token cascade + density/animation gates)
 * Created      : 2026-07-20
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { Product, POSProfile, Shift } from "../../types";
import { useSEEF } from "../../layout_engine/SEEFContext.tsx";

export interface TerminalContextType {
  terminalMode: "pos" | "tax";
  currentUser: any;
  activeShift: Shift | null;
  activeProfile: POSProfile | null;
  onNotification: (title: string, msg: string, type: "success" | "error") => void;
  isOnline: boolean;
  syncQueueLength: number;
  onClose: () => void;
}

export const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const useTerminalContext = () => {
  const ctx = useContext(TerminalContext);
  if (!ctx) {
    throw new Error("useTerminalContext must be used within TerminalContext Provider");
  }
  return ctx;
};

interface SharedTerminalFrameworkProps {
  terminalMode: "pos" | "tax";
  currentUser: any;
  profiles: POSProfile[];
  shifts: Shift[];
  onRefreshData: () => void;
  onNotification: (title: string, msg: string, type: "success" | "error") => void;
  onClose: () => void;
  children: React.ReactNode;
}

export const SharedTerminalFramework: React.FC<SharedTerminalFrameworkProps> = ({
  terminalMode,
  currentUser,
  profiles,
  shifts,
  onRefreshData,
  onNotification,
  onClose,
  children
}) => {
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueueLength, setSyncQueueLength] = useState(0);

  // SEEF Phase 8: advisory density + animation gates (AOP-001 — terminal core unaffected)
  const { config: seefConfig } = useSEEF();
  const densityPy = seefConfig.density === "compact" ? "py-2" : seefConfig.density === "comfortable" ? "py-4" : "py-3";
  const motionClass = seefConfig.animationPolicy !== "none" ? "transition-colors" : "";

  // Auto-detect online status
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Select first profile by default
  useEffect(() => {
    if (profiles.length > 0 && !activeProfileId) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles, activeProfileId]);

  // Track active shift
  useEffect(() => {
    if (activeProfileId) {
      const openShift = shifts.find(s => s.profileId === activeProfileId && s.status === "Open");
      setActiveShift(openShift || null);
    } else {
      setActiveShift(null);
    }
  }, [activeProfileId, shifts]);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || null;

  return (
    <TerminalContext.Provider
      value={{
        terminalMode,
        currentUser,
        activeShift,
        activeProfile,
        onNotification,
        isOnline,
        syncQueueLength,
        onClose
      }}
    >
      {/* SEEF theme tokens replace hardcoded bg-[#0f172a] / bg-[#1e293b] / border-theme-divider */}
      <div className="fixed inset-0 z-50 flex flex-col bg-theme-base text-theme-body font-sans antialiased overflow-hidden select-none">
        {/* Terminal Header */}
        <header className={`h-14 bg-theme-surface-1 border-b border-theme-divider px-6 flex items-center justify-between shrink-0 ${motionClass}`}>
          <div className="flex items-center space-x-3">
            <span className="material-symbols-outlined text-blue-400 text-2xl">point_of_sale</span>
            <div>
              <h1 className="text-sm font-bold tracking-wide uppercase text-theme-heading font-display">
                SMRITI {terminalMode === "pos" ? "Retail POS" : "Tax Invoice"} Terminal
              </h1>
              <p className="text-[10px] text-theme-muted font-mono">
                Operator: {currentUser?.name || "Cashier"} | Code: {activeProfile?.cashier || "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-[10px] font-semibold text-theme-muted uppercase font-display">Desks:</label>
              <select
                value={activeProfileId}
                onChange={(e) => setActiveProfileId(e.target.value)}
                className="bg-theme-surface-2 border border-theme-divider text-theme-body text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 font-mono"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className={`bg-theme-surface-2 hover:bg-theme-surface-3 text-theme-muted hover:text-theme-heading px-3 py-1 rounded text-xs ${motionClass} border border-theme-divider font-semibold`}
            >
              Exit Terminal
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {children}
        </main>

        {/* Status Bar */}
        <footer className={`h-8 bg-theme-surface-1 border-t border-theme-divider px-6 flex items-center justify-between shrink-0 text-[10px] font-mono text-theme-muted`}>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
              <span className="font-semibold">{isOnline ? "ONLINE" : "OFFLINE"}</span>
            </span>
            <span className="border-l border-theme-divider h-3"></span>
            <span>Scanner: <span className="text-emerald-400">OK</span></span>
            <span>Printer: <span className="text-emerald-400">Ready</span></span>
            <span>Drawer: <span className="text-emerald-400">Closed</span></span>
          </div>

          <div className="flex items-center space-x-4">
            {activeShift && (
              <span>Shift: <span className="text-blue-400 font-bold">#{activeShift.id}</span></span>
            )}
            <span>Queue: <span className="text-amber-400">{syncQueueLength} bills</span></span>
            <span>SMRITI Retail OS v5.0</span>
          </div>
        </footer>
      </div>
    </TerminalContext.Provider>
  );
};
