/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Session Timeout Modal
 * Feature      : src/features/auth/components/SessionExpiredDialog.tsx
 */

import React, { useState } from "react";
import { Clock, ArrowRight, KeyRound } from "lucide-react";
import { useSession } from "../hooks/useSession";
import { authStore } from "../store/authStore";

export const SessionExpiredDialog: React.FC = () => {
  const { isSessionExpiredModalOpen, logout } = useSession();
  const [password, setPassword] = useState("");

  if (!isSessionExpiredModalOpen) return null;

  const handleExtendSession = (e: React.FormEvent) => {
    e.preventDefault();
    authStore.setAuthState("Authenticated");
    authStore.setSessionExpiredModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 mx-auto flex items-center justify-center">
          <Clock size={24} />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-100">Session Expired</h3>
          <p className="text-xs text-slate-400 mt-1">Your session has timed out due to inactivity.</p>
        </div>

        <form onSubmit={handleExtendSession} className="space-y-3 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Confirm Password to Continue
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound size={15} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30"
          >
            <span>Resume Session</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <button
          type="button"
          onClick={() => logout()}
          className="text-xs text-slate-400 hover:text-slate-200 transition font-mono"
        >
          Or Sign Out Completely
        </button>
      </div>
    </div>
  );
};
