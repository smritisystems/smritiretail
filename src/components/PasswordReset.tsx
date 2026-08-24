/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.21.0
 * Created    : 2026-07-17
 * Modified   : 2026-07-17
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Lock, ArrowRight, AlertTriangle } from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetch.ts";

interface PasswordResetScreenProps {
  onResetSuccess: () => void;
}

export const PasswordResetScreen: React.FC<PasswordResetScreenProps> = ({ onResetSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return "Please enter all password fields.";
    }
    if (newPassword !== confirmPassword) {
      return "New password and confirm password must match.";
    }
    if (newPassword.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!/[A-Z]/.test(newPassword)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(newPassword)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/[0-9]/.test(newPassword)) {
      return "Password must contain at least one number.";
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword)) {
      return "Password must contain at least one special character.";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await apiFetchV1("/users/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      onResetSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-theme-base text-theme-primary px-4">
      <div className="w-full max-w-lg bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Secure First Login</h2>
              <p className="text-sm text-theme-muted mt-1">
                Change your temporary password before continuing.
              </p>
            </div>
            <div className="rounded-xl bg-blue-600 p-3 text-white">
              <Lock size={20} />
            </div>
          </div>

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-theme-muted mb-2">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-4 py-3 text-sm text-theme-body focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-muted mb-2">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-4 py-3 text-sm text-theme-body focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-muted mb-2">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-4 py-3 text-sm text-theme-body focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              {loading ? "Updating password..." : "Update Password"}
            </button>
          </form>

          <div className="mt-6 text-xs text-theme-muted">
            Password must include at least 8 characters, uppercase, lowercase, a number, and a special character.
          </div>
        </div>
      </div>
    </div>
  );
};
