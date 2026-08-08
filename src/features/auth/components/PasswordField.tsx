/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Password Field with Caps Lock Indicator
 * Feature      : src/features/auth/components/PasswordField.tsx
 */

import React, { useState } from "react";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  value,
  onChange,
  placeholder = "Enter your password",
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  return (
    <div className="w-full text-left font-sans">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Password
        </label>
        <a href="#forgot" className="text-xs text-indigo-400 hover:text-indigo-300 transition">
          Forgot Password?
        </a>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
          <Lock size={15} />
        </div>

        <input
          id="login-password"
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 hover:border-indigo-500/50 focus:border-indigo-500 text-slate-100 placeholder-slate-500 text-sm transition shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition focus:outline-none"
          title={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {capsLockOn && (
        <div className="mt-1.5 flex items-center space-x-1 text-[11px] text-amber-400 font-mono">
          <AlertCircle size={12} />
          <span>Caps Lock is ON</span>
        </div>
      )}
    </div>
  );
};
