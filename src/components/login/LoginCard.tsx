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
import { motion, AnimatePresence } from "motion/react";
import { Globe, ChevronDown, Clock, X, AlertTriangle } from "lucide-react";
import { LoginForm } from "./LoginForm";
import { QuickAccess } from "./QuickAccess";
import { SecurityFooter } from "./SecurityFooter";

export interface LanguageOption {
  code: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
];

interface LoginCardProps {
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  selectedLanguage: string;
  setSelectedLanguage: (value: string) => void;
  isLangOpen: boolean;
  setIsLangOpen: (value: boolean) => void;
  activePersona: string | null;
  onSelectPersona: (role: string, username: string, pw: string) => void;
  error: string | null;
  loading: boolean;
  sessionNotice?: string | null;
  noticeDismissed: boolean;
  onDismissNotice: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
  className?: string;
}

export const LoginCard: React.FC<LoginCardProps> = ({
  username,
  setUsername,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  rememberMe,
  setRememberMe,
  selectedLanguage,
  setSelectedLanguage,
  isLangOpen,
  setIsLangOpen,
  activePersona,
  onSelectPersona,
  error,
  loading,
  sessionNotice,
  noticeDismissed,
  onDismissNotice,
  onSubmit,
  onForgotPassword,
  className = "",
}) => {
  return (
    <div
      className={`w-full max-w-[450px] bg-white/90 backdrop-blur-2xl border border-white/95 rounded-3xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.18)] p-6 sm:p-7 relative overflow-hidden ${className}`}
      role="dialog"
      aria-label="SMRITI Retail OS login dialog"
    >
      {/* Luminous top-edge blue highlight stripe */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-sky-400 to-blue-500" aria-hidden="true" />

      {/* Card Header: Icon + Title + Language Dropdown */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 flex-shrink-0 flex items-center justify-center font-bold text-xl font-display text-white shadow-md shadow-blue-500/25"
            aria-hidden="true"
          >
            S
          </div>
          <div>
            <h1 className="font-display font-bold text-base sm:text-lg text-slate-900 leading-tight">
              SMRITI Retail OS
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 leading-snug mt-0.5">
              Enterprise Experience &amp; Operations Login
            </p>
          </div>
        </div>

        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            aria-label="Select language"
            aria-expanded={isLangOpen}
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200/90 bg-white/80 backdrop-blur-sm text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-white transition cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Globe size={13} className="text-slate-500 flex-shrink-0" aria-hidden="true" />
            <span>{selectedLanguage}</span>
            <ChevronDown size={11} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
          </button>
          <AnimatePresence>
            {isLangOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute right-0 mt-1.5 w-36 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 text-slate-800"
                role="listbox"
                aria-label="Language options"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={selectedLanguage === lang.label.split(" ")[0]}
                    onClick={() => {
                      setSelectedLanguage(lang.label.split(" ")[0]);
                      setIsLangOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition cursor-pointer font-medium focus:outline-none"
                  >
                    {lang.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Session Inactivity / Expiration Notice Banner */}
      <AnimatePresence>
        {sessionNotice && !noticeDismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            role="status"
            aria-live="polite"
            className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 shadow-sm"
          >
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
            <div className="flex-1 leading-snug">
              <span className="font-bold text-amber-950 block mb-0.5">Session Terminated</span>
              {sessionNotice}
            </div>
            <button
              type="button"
              onClick={onDismissNotice}
              className="text-amber-700 hover:text-amber-950 p-0.5 rounded transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              aria-label="Dismiss session notice"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            aria-live="assertive"
            className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
            <span className="leading-snug">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Authentication Form */}
      <LoginForm
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
        loading={loading}
        onSubmit={onSubmit}
        onForgotPassword={onForgotPassword}
      />

      {/* Quick Access Persona Pills */}
      <QuickAccess
        activePersona={activePersona}
        onSelectPersona={onSelectPersona}
        className="mt-4"
      />

      {/* Card Security & Version Footer */}
      <SecurityFooter className="mt-5" />
    </div>
  );
};
