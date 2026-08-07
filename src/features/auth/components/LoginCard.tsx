/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — SAP Fiori Inspired Login Card
 * Feature      : src/features/auth/components/LoginCard.tsx
 */

import React, { useState } from "react";
import { User, AlertCircle, ArrowRight, Shield, Globe, Terminal, ChevronDown } from "lucide-react";
import { OrganizationSelector } from "./OrganizationSelector";
import { PasswordField } from "./PasswordField";
import { ProgressIndicator } from "./ProgressIndicator";
import { useAuthStore } from "../store/authStore";
import { AuthOrchestrator } from "../services/AuthOrchestrator";
import { User as UserModel } from "../types/auth.types";

interface LoginCardProps {
  onLoginSuccess: (user: UserModel) => void;
}

const DEV_ACCOUNTS = [
  { label: "System Admin", username: "super", password: "Shpr0128vdq!@", role: "SYSADMIN", color: "#d93025" },
  { label: "Store Manager", username: "manager", password: "Password@123", role: "MANAGER", color: "#f29900" },
  { label: "POS Cashier", username: "cashier", password: "Cashier@1234", role: "CASHIER", color: "#188038" },
];

export const LoginCard: React.FC<LoginCardProps> = ({ onLoginSuccess }) => {
  const { authState, progressSteps, errorMessage } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showDevAccounts, setShowDevAccounts] = useState(false);

  const isAuthenticating = authState === "Authenticating" || authState === "LoadingProfile" || authState === "LoadingWorkspace";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      useAuthStore.getState().setErrorMessage("Username and password are required.");
      return;
    }
    await AuthOrchestrator.executeLoginWorkflow(username, password, onLoginSuccess);
  };

  const handleDevQuickFill = (acc: typeof DEV_ACCOUNTS[0]) => {
    setUsername(acc.username);
    setPassword(acc.password);
  };

  return (
    <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md relative z-10 font-sans select-none">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Sign In to SMRITI OS</h1>
        <p className="text-xs text-slate-400 mt-1">Enterprise Retail & ERP Workspace</p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-300 text-xs flex items-start space-x-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isAuthenticating ? (
        <div className="py-6">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
            Authenticating Session
          </h3>
          <ProgressIndicator steps={progressSteps} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <OrganizationSelector />

          <div>
            <label htmlFor="login-username" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider text-left">
              Username / Email / Mobile
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User size={15} />
              </div>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username or email"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 hover:border-indigo-500/50 focus:border-indigo-500 text-slate-100 placeholder-slate-500 text-sm transition shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <PasswordField value={password} onChange={setPassword} />

          <div className="flex items-center justify-between text-xs text-slate-400">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Remember Me</span>
            </label>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <span>Sign In</span>
            <ArrowRight size={16} />
          </button>
        </form>
      )}

      {/* Enterprise SSO Options Placeholder */}
      <div className="mt-6 pt-5 border-t border-slate-800/80">
        <div className="text-center text-[11px] text-slate-500 uppercase tracking-wider mb-3">
          Enterprise Authentication
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700/60 transition flex items-center justify-center space-x-1.5"
          >
            <Shield size={14} className="text-blue-400" />
            <span>Microsoft SSO</span>
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700/60 transition flex items-center justify-center space-x-1.5"
          >
            <Globe size={14} className="text-emerald-400" />
            <span>Google Login</span>
          </button>
        </div>
      </div>

      {/* Dev Quick Credentials Accordion */}
      <div className="mt-4 pt-3 border-t border-slate-800/50">
        <button
          type="button"
          onClick={() => setShowDevAccounts(!showDevAccounts)}
          className="w-full text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center justify-between transition"
        >
          <span className="flex items-center space-x-1">
            <Terminal size={12} className="text-indigo-400" />
            <span>Dev Credentials Quick-Fill</span>
          </span>
          <ChevronDown size={14} className={`transition-transform ${showDevAccounts ? "rotate-180" : ""}`} />
        </button>

        {showDevAccounts && (
          <div className="mt-2 space-y-1.5">
            {DEV_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                onClick={() => handleDevQuickFill(acc)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-800/80 hover:bg-slate-800 text-left flex items-center justify-between text-xs transition border border-slate-700/40"
              >
                <span className="font-semibold text-slate-200">{acc.label}</span>
                <span className="font-mono text-[10px] text-indigo-400">{acc.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
