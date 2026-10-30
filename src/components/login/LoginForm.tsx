/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.45.2
 * Created      : 2026-09-27
 * Modified     : 2026-09-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { User, Lock, Eye, EyeOff, Check, ArrowRight, Loader2 } from "lucide-react";

interface LoginFormProps {
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
  onInputChange?: () => void;
  className?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  username,
  setUsername,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  rememberMe,
  setRememberMe,
  loading,
  onSubmit,
  onForgotPassword,
  onInputChange,
  className = "",
}) => {
  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`} noValidate aria-label="Operator login form">

      {/* Operator ID / Username */}
      <div>
        <label
          htmlFor="login-username"
          className="block text-[10px] sm:text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5"
        >
          OPERATOR ID / USERNAME
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
            <User size={15} />
          </div>
          <input
            type="text"
            id="login-username"
            name="username"
            autoComplete="username"
            aria-label="Operator ID or Username"
            aria-required="true"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              onInputChange?.();
            }}
            disabled={loading}
            className="w-full bg-[#f8fafc] hover:bg-slate-50 focus:bg-white border border-slate-200/90 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 font-medium transition shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-100 min-h-[44px]"
            placeholder="e.g. manager"
          />
        </div>
      </div>

      {/* Security Password */}
      <div>
        <label
          htmlFor="login-password"
          className="block text-[10px] sm:text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5"
        >
          SECURITY PASSWORD
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
            <Lock size={15} />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            id="login-password"
            name="password"
            autoComplete="current-password"
            aria-label="Security Password"
            aria-required="true"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              onInputChange?.();
            }}
            disabled={loading}
            className="w-full bg-[#f8fafc] hover:bg-slate-50 focus:bg-white border border-slate-200/90 focus:border-blue-500 rounded-xl pl-10 pr-11 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 font-medium transition shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-100 min-h-[44px]"
            placeholder="••••••••••"
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer min-w-[44px] justify-end focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-r-xl"
          >
            {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Remember me & Forgot Password */}
      <div className="flex items-center justify-between text-xs pt-0.5">
        <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px]">
          <div
            role="checkbox"
            aria-checked={rememberMe}
            tabIndex={0}
            onClick={() => setRememberMe(!rememberMe)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setRememberMe(!rememberMe);
              }
            }}
            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              rememberMe ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
            }`}
          >
            {rememberMe && <Check size={11} strokeWidth={3} aria-hidden="true" />}
          </div>
          <span className="text-slate-600 font-medium">Remember me</span>
        </label>
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-slate-500 hover:text-blue-600 font-medium transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1.5 py-1 min-h-[44px] flex items-center"
        >
          Forgot Password?
        </button>
      </div>

      {/* Primary CTA Button */}
      <button
        type="submit"
        id="btn-login-submit"
        disabled={loading}
        className="w-full min-h-[44px] py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 via-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 active:from-blue-800 active:to-sky-700 text-white font-bold font-display rounded-xl shadow-lg shadow-blue-500/30 border border-blue-400/30 transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer select-none disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 mt-1"
        aria-label={loading ? "Verifying credentials…" : "Authorize Operator — Log In"}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin text-white" aria-hidden="true" />
            <span>Verifying Credentials…</span>
          </>
        ) : (
          <>
            <span>Login</span>
            <ArrowRight size={15} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
};
