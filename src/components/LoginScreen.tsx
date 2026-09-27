/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.45.2
 * Created      : 2026-07-10
 * Modified     : 2026-09-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Info, X, Globe, ChevronDown } from "lucide-react";
import { persistTenantContext, normalizeBranchId, normalizeCompanyId } from "../lib/apiFetchV1";
import {
  SmritiBrandLogo,
  BrandPanel,
  LoginCard,
  EnterpriseDock,
  ResponsiveBackground,
  SUPPORTED_LANGUAGES,
} from "./login";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoginScreenProps {
  onLoginSuccess: (user: {
    role: string;
    name: string;
    passwordResetRequired?: boolean;
    companyId?: string;
    branchId?: string;
  }) => void;
  sessionNotice?: string | null;
  onClearSessionNotice?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  sessionNotice,
  onClearSessionNotice,
}) => {
  const [username, setUsername]                 = useState("");
  const [password, setPassword]                 = useState("");
  const [showPassword, setShowPassword]         = useState(false);
  const [rememberMe, setRememberMe]             = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [isLangOpen, setIsLangOpen]             = useState(false);
  const [activePersona, setActivePersona]       = useState<string | null>("Manager");
  const [error, setError]                       = useState<string | null>(null);
  const [loading, setLoading]                   = useState(false);
  const [showForgotModal, setShowForgotModal]   = useState(false);
  const [noticeDismissed, setNoticeDismissed]   = useState(false);

  // ── Authentication logic (PRESERVED & GOVERNED) ──────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        localStorage.removeItem("smriti_session_token");
        localStorage.removeItem("smriti_jwt_token");
        localStorage.removeItem("smriti_refresh_token");
        localStorage.removeItem("smriti_company_id");
        localStorage.removeItem("smriti_company_code");
        localStorage.removeItem("smriti_branch_id");
        localStorage.setItem("smriti_jwt_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("smriti_refresh_token", data.refresh_token);
        if (rememberMe) {
          localStorage.setItem("smriti_saved_operator", username);
        } else {
          localStorage.removeItem("smriti_saved_operator");
        }
        const user   = data.user ?? {};
        const compId = normalizeCompanyId(data.company_id ?? user.company_id ?? "COMP-001");
        const brId   = normalizeBranchId(data.branch_id ?? user.branch_id ?? "BR-MAIN-001");
        persistTenantContext({
          companyId:   compId,
          companyCode: data.company_code ?? user.company_code,
          branchId:    brId,
          branchCode:  data.branch_code ?? user.branch_code,
          companyName: data.company_name ?? user.company_name,
          branchName:  data.branch_name ?? user.branch_name,
        });
        onLoginSuccess({
          role: user.role ?? "",
          name: user.display_name || user.full_name || user.username || username,
          passwordResetRequired: data.password_reset_required ?? false,
          companyId: compId,
          branchId:  brId,
        });
      } else {
        const errMsg =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
            ? data.detail[0]?.msg ?? "Authentication failed."
            : data.error || "Authentication failed.";
        setError(errMsg);
      }
    } catch {
      setError("Failed to connect to authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPersona = (role: string, u: string, pw: string) => {
    setUsername(u);
    setPassword(pw);
    setActivePersona(role);
    setError(null);
  };

  const handleDismissNotice = () => {
    setNoticeDismissed(true);
    onClearSessionNotice?.();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col justify-between overflow-x-hidden font-sans select-none bg-slate-50 text-slate-900">

      {/* ── Responsive Background Layers ── */}
      <ResponsiveBackground />

      {/* ── Top Mobile Brand Banner (< lg) ── */}
      <header
        className="relative z-20 w-full lg:hidden px-4 pt-4 pb-2 flex items-center justify-between shrink-0"
        aria-label="SMRITI Retail OS mobile header"
      >
        <SmritiBrandLogo size="sm" showTagline={false} />

        {/* Mobile Language Selector */}
        <div className="relative">
          <button
            type="button"
            aria-label="Select language"
            aria-expanded={isLangOpen}
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200/90 bg-white/90 backdrop-blur-sm text-xs font-semibold text-slate-700 hover:border-blue-400 cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                aria-label="Mobile language options"
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
      </header>

      {/* ── Main Responsive Layout ── */}
      <main
        className="relative z-20 flex-1 w-full max-w-[1650px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-3 sm:py-5 lg:py-6 flex flex-col justify-center"
        role="main"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-center">

          {/* ── Desktop Left Column: Brand & 6 Feature Pillars (Hidden on mobile & tablet) ── */}
          <BrandPanel className="hidden lg:flex lg:col-span-6 xl:col-span-5" />

          {/* ── Center Column: Frosted Glass Login Card (Centered on all viewports) ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.10 }}
            className="lg:col-span-6 xl:col-span-5 flex justify-center items-center w-full"
          >
            <LoginCard
              username={username}
              setUsername={setUsername}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              rememberMe={rememberMe}
              setRememberMe={setRememberMe}
              selectedLanguage={selectedLanguage}
              setSelectedLanguage={setSelectedLanguage}
              isLangOpen={isLangOpen}
              setIsLangOpen={setIsLangOpen}
              activePersona={activePersona}
              onSelectPersona={handleQuickPersona}
              error={error}
              loading={loading}
              sessionNotice={sessionNotice}
              noticeDismissed={noticeDismissed}
              onDismissNotice={handleDismissNotice}
              onSubmit={handleSubmit}
              onForgotPassword={() => setShowForgotModal(true)}
            />
          </motion.div>

        </div>
      </main>

      {/* ── Bottom Enterprise Floating Dock (Desktop only, hidden on mobile & tablet) ── */}
      <EnterpriseDock className="hidden lg:block" />

      {/* ── Forgot Password Modal ── */}
      <AnimatePresence>
        {showForgotModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 relative max-h-[90dvh] overflow-y-auto text-slate-900"
            >
              <button
                type="button"
                aria-label="Close password assistance dialog"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1"
              >
                <X size={18} aria-hidden="true" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <Info size={20} />
                </div>
                <div>
                  <h2 id="forgot-modal-title" className="font-display font-bold text-base text-slate-900">
                    Operator Security Assistance
                  </h2>
                  <p className="text-xs text-slate-500">SMRITI Identity &amp; Access Governance</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Operator passwords are encrypted with enterprise-grade salt hashes. If you have forgotten your password or your operator ID has been locked, please contact your store supervisor or system administrator to reissue operator credentials.
              </p>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full min-h-[44px] py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Understood
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
