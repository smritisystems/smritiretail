/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Sign Out Confirmation Modal & Post-Logout Screen
 * Feature      : src/features/auth/components/LogoutDialog.tsx
 */

import React, { useState } from "react";
import { LogOut, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { useSession } from "../hooks/useSession";

export const LogoutDialog: React.FC = () => {
  const { isLogoutModalOpen, closeLogoutModal, logout, authState } = useSession();
  const [revokeAllDevices, setRevokeAllDevices] = useState(false);
  const [clearOfflineCache, setClearOfflineCache] = useState(false);

  if (!isLogoutModalOpen && authState !== "LoggedOut") return null;

  if (authState === "LoggedOut") {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Signed Out Successfully</h2>
            <p className="text-xs text-slate-400 mt-1">Thank you for using SMRITI Retail OS.</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-2"
          >
            <span>Sign In Again</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center space-x-3 text-rose-400">
          <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100">Sign Out Confirmation</h3>
            <p className="text-[11px] text-slate-400">You are about to end your current session.</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2 text-xs text-slate-300">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={revokeAllDevices}
              onChange={(e) => setRevokeAllDevices(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500"
            />
            <span>Sign out from all active devices</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={clearOfflineCache}
              onChange={(e) => setClearOfflineCache(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500"
            />
            <span>Clear cached offline workspace data</span>
          </label>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={closeLogoutModal}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => logout({ revokeAllDevices, clearOfflineCache })}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition flex items-center space-x-1.5 shadow-lg shadow-rose-600/30"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
