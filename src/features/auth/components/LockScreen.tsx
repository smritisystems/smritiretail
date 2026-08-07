/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Workspace Lock Overlay (State Preserving)
 * Feature      : src/features/auth/components/LockScreen.tsx
 */

import React, { useState } from "react";
import { Lock, KeyRound, LogOut, ArrowRight, ShieldCheck, User } from "lucide-react";
import { useLockScreen } from "../hooks/useLockScreen";
import { useSession } from "../hooks/useSession";

export const LockScreen: React.FC = () => {
  const { isLocked, currentUser, unlock } = useLockScreen();
  const { openLogoutModal } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  if (!isLocked) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError(true);
      return;
    }
    const success = unlock(password);
    if (!success) {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 mx-auto flex items-center justify-center">
          <Lock size={26} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-100">Workspace Locked</h2>
          <p className="text-xs text-slate-400 mt-0.5">Session state and open tabs preserved.</p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center space-x-3 text-left">
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "S"}
          </div>
          <div className="overflow-hidden">
            <div className="font-semibold text-xs text-slate-200 truncate">{currentUser?.name || "Super Admin"}</div>
            <div className="text-[10px] font-mono text-indigo-400">{currentUser?.role || "SYSADMIN"}</div>
          </div>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Unlock Password / PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound size={15} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="Enter password to unlock"
                autoFocus
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700/80 focus:border-amber-500 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            {error && <p className="text-[11px] text-rose-400 mt-1">Please enter your password.</p>}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-amber-600/20"
          >
            <span>Unlock Workspace</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <button
            type="button"
            onClick={openLogoutModal}
            className="text-slate-400 hover:text-slate-200 flex items-center space-x-1"
          >
            <User size={13} />
            <span>Switch User</span>
          </button>
          <button
            type="button"
            onClick={openLogoutModal}
            className="text-rose-400 hover:text-rose-300 flex items-center space-x-1"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
