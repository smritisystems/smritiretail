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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.21.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-16
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { Shield, User, Lock, ArrowRight, AlertTriangle } from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: (user: { role: string; name: string; passwordResetRequired?: boolean; companyId?: string; branchId?: string }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      const res = await fetch("/api/v1/auth/login", {
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
                Enterprise Experience & Operations Login
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
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-10 pr-4 py-2.5 text-xs text-theme-body placeholder-theme-muted/50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-semibold"
                  placeholder="e.g. manager"
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-10 pr-4 py-2.5 text-xs text-theme-body placeholder-theme-muted/50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-semibold font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold font-display rounded-xl shadow-lg border border-blue-500 hover:border-blue-400 transition-all flex items-center justify-center space-x-2 text-xs cursor-pointer select-none disabled:opacity-50"
            >
              <span>{loading ? "Verifying..." : "Authorize Operator"}</span>
              <ArrowRight size={14} />
            </button>
          </form>
        </div>

        <div className="bg-theme-surface-2 px-6 py-3 border-t border-theme-divider flex items-center justify-between text-[10px] text-theme-muted font-mono">
          <div className="flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span>AES-256 Auth Channel</span>
          </div>
          <span>v2.1.2 Production</span>
        </div>
      </motion.div>
    </div>
  );
};
