/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-20
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, User, Lock, ArrowRight, AlertTriangle, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1";

interface LoginScreenProps {
  onLoginSuccess: (user: { role: string; name: string; passwordResetRequired?: boolean; companyId?: string; branchId?: string }) => void;
}

// Dev-mode seed accounts â€” only visible in development builds
const DEV_ACCOUNTS = [
  { label: "System Admin", username: "super",   password: "Smriti@1234",  role: "SYSADMIN",  badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  { label: "Store Manager", username: "manager", password: "Password@123", role: "MANAGER",  badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { label: "POS Cashier",   username: "cashier", password: "Cashier@1234", role: "CASHIER",  badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);

  const isDev = (import.meta as unknown as { env: { DEV?: boolean } }).env?.DEV === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const loginPayload = {
        username,
        password,
      };

      const res = await apiFetchV1("auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginPayload),
      });

      const data = await res.json();
      if (res.ok && data.access_token) {
        localStorage.setItem("smriti_jwt_token", data.access_token);
        localStorage.removeItem("smriti_session_token"); // clear legacy token
        const user = data.user ?? {};
        onLoginSuccess({
          role: user.role ?? "",
          name: user.display_name || user.full_name || user.username || username,
          passwordResetRequired: data.password_reset_required ?? false,
          companyId: data.company_id ?? user.company_id,
          branchId: data.branch_id ?? user.branch_id,
        });
      } else {
        const errMsg = typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
          ? data.detail[0]?.msg ?? "Authentication failed."
          : data.error || "Authentication failed.";
        setError(errMsg);
      }
    } catch (err) {
      setError("Failed to connect to authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (acc: typeof DEV_ACCOUNTS[0]) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-theme-base text-theme-primary px-4 transition-colors duration-300">
      <div className="absolute inset-0 bg-radial from-blue-600/10 via-transparent to-transparent opacity-60 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-2xl overflow-hidden relative z-10"
      >
        {/* Decorative Top Accent */}
        <div className="h-1.5 bg-blue-600 w-full" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xl font-display text-white border border-blue-500 shadow-md">
              S
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-theme-body leading-none">
                SMRITI Retail OS
              </h2>
              <p className="text-xs text-theme-muted mt-1">
                Enterprise Experience &amp; Operations Login
              </p>
            </div>
          </div>

          {/* Error Callout */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2.5 font-mono"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-[10px] font-mono font-bold text-theme-muted uppercase tracking-wider mb-1.5">
                Operator ID / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-theme-muted">
                  <User size={14} />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-10 pr-4 py-2.5 text-xs text-theme-body placeholder-theme-muted/50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-semibold"
                  placeholder="e.g. manager"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-theme-muted uppercase tracking-wider mb-1.5">
                Security Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-theme-muted">
                  <Lock size={14} />
                </div>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-10 pr-4 py-2.5 text-xs text-theme-body placeholder-theme-muted/50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-semibold font-mono"
                  placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold font-display rounded-xl shadow-lg border border-blue-500 hover:border-blue-400 transition-all flex items-center justify-center space-x-2 text-xs cursor-pointer select-none disabled:opacity-50"
            >
              <span>{loading ? "Verifying..." : "Authorize Operator"}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Dev-mode credential hint panel â€” compiled out in production builds */}
          {isDev && (
            <div className="mt-5 border border-amber-500/20 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDevPanel(!showDevPanel)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/15 transition-colors text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider"
              >
                <span className="flex items-center gap-1.5">
                  <Terminal size={11} />
                  Dev / Demo Accounts
                </span>
                {showDevPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              <AnimatePresence>
                {showDevPanel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 space-y-2 bg-amber-500/5">
                      <p className="text-[9px] text-amber-400/70 font-mono mb-2">
                        Click any account to auto-fill credentials. Visible in DEV mode only.
                      </p>
                      {DEV_ACCOUNTS.map((acc) => (
                        <button
                          key={acc.username}
                          type="button"
                          onClick={() => fillCredentials(acc)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-theme-surface-2 border border-theme-divider hover:border-blue-500/50 transition-all group text-left"
                        >
                          <div>
                            <span className="text-[10px] font-bold text-theme-body block leading-none mb-0.5">{acc.label}</span>
                            <span className="text-[9px] text-theme-muted font-mono">{acc.username} / {acc.password}</span>
                          </div>
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${acc.badge}`}>
                            {acc.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="bg-theme-surface-2 px-6 py-3 border-t border-theme-divider flex items-center justify-between text-[10px] text-theme-muted font-mono">
          <div className="flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span>AES-256 Auth Channel</span>
          </div>
          <span>v5.0.0 {isDev ? "Â· DEV" : "Production"}</span>
        </div>
      </motion.div>
    </div>
  );
};
