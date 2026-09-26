/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * Websites     : aitdl.com | erpnbook.com | smritibooks.com
 * Version      : 6.45.1
 * Created      : 2026-07-10
 * Modified     : 2026-09-26
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  User,
  Lock,
  ArrowRight,
  AlertTriangle,
  ShoppingCart,
  Package,
  Truck,
  Warehouse,
  Users,
  BarChart3,
  Globe,
  Eye,
  EyeOff,
  Store,
  Cloud,
  Smartphone,
  ShieldCheck,
  Sliders,
  Check,
  ChevronDown,
  Info,
  X,
  Zap,
  Settings,
  Database,
  Activity,
  CreditCard,
  Wifi,
  Clock,
} from "lucide-react";
import { APP_VERSION_LABEL } from "../config/version.ts";
import { persistTenantContext, normalizeBranchId, normalizeCompanyId } from "../lib/apiFetchV1";


// ── Types ──────────────────────────────────────────────────────────────────

interface LoginScreenProps {
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

// ── Constants ──────────────────────────────────────────────────────────────

const RETAIL_PILLARS = [
  { icon: ShoppingCart, title: "Sales & Billing",       desc: "Fast & Easy Checkout" },
  { icon: Package,      title: "Inventory Management",  desc: "Real-Time Stock Visibility" },
  { icon: Truck,        title: "Distribution",          desc: "Smarter Supply Chain" },
  { icon: Warehouse,    title: "Warehouse",             desc: "Better Stock Control" },
  { icon: Users,        title: "Customer Management",   desc: "Stronger Relationships" },
  { icon: BarChart3,    title: "Reports & Insights",    desc: "Data Driven Growth" },
  { icon: Settings,     title: "Settings & Configuration", desc: "Flexible & Scalable" },
];

const RIGHT_CALLOUTS = [
  { icon: Zap,          label: "Fast",        sub: "Billing" },
  { icon: Activity,     label: "Real-Time",   sub: "Inventory" },
  { icon: ShieldCheck,  label: "Secure",      sub: "& Reliable" },
  { icon: Cloud,        label: "Cloud Ready", sub: "Anytime, Anywhere" },
  { icon: Smartphone,   label: "Multi-Device",sub: "Web | Mobile | POS" },
];

const RIGHT_MODULE_LABELS = ["RETAIL", "POS", "INVENTORY", "DISTRIBUTION", "WAREHOUSE", "REPORTS"];

const FOOTER_FEATURES = [
  { icon: Store,        label: "Multi-Store",              sub: "Support" },
  { icon: Settings,     label: "Centralized",              sub: "Control" },
  { icon: Users,        label: "Role Based",               sub: "Access" },
  { icon: BarChart3,    label: "Business",                 sub: "Analytics" },
  { icon: Sliders,      label: "Modular",                  sub: "& Scalable" },
  { icon: Wifi,         label: "API & Integration",        sub: "Ready" },
  { icon: Database,     label: "Backup & Data",            sub: "Safety" },
  { icon: CreditCard,   label: "Web | Mobile | POS",       sub: "Access" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
];

// ── Component ──────────────────────────────────────────────────────────────

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  sessionNotice,
  onClearSessionNotice,
}) => {
  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [isLangOpen, setIsLangOpen]     = useState(false);
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // ── Authentication logic (UNCHANGED) ────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col overflow-x-hidden font-sans select-none bg-slate-950 text-slate-100">

      {/* ── Background layers ── */}
      {/* 4K Footwear Retail Showroom Backdrop (Stretches to fit any device) */}
      <div
        className="fixed inset-0 pointer-events-none w-full h-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/assets/branding/retail_login_bg.jpg')",
          filter: "contrast(1.02) brightness(0.96)",
        }}
        aria-hidden="true"
      />
      {/* Soft luxury vignette & atmospheric depth scrim protecting text readability */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.18)_0%,rgba(2,6,23,0.65)_100%)]" />
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/45" />

      {/* ── Language selector (top-right, always visible) ── */}
      <div className="absolute top-3 right-4 sm:top-4 sm:right-6 z-30">
        <div className="relative">
          <button
            type="button"
            aria-label="Select language"
            aria-expanded={isLangOpen}
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900/85 backdrop-blur-md text-xs font-semibold text-slate-300 hover:border-blue-400 hover:text-white transition shadow-sm cursor-pointer"
          >
            <Globe size={13} className="text-blue-400 flex-shrink-0" />
            <span>{selectedLanguage}</span>
            <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
          </button>
          <AnimatePresence>
            {isLangOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute right-0 mt-1.5 w-40 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1 z-40"
                role="listbox"
                aria-label="Language options"
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={selectedLanguage === lang.label.split(" ")[0]}
                    onClick={() => { setSelectedLanguage(lang.label.split(" ")[0]); setIsLangOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                  >
                    {lang.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile brand banner (< lg) ── */}
      <header className="relative z-20 w-full lg:hidden px-4 pt-4 pb-2 flex items-center gap-2" aria-label="SMRITI Retail OS">
        <span className="font-display font-black text-2xl tracking-tight text-white">SM<span className="text-blue-500">&#8377;</span>ITI</span>
        <span className="text-[9px] font-mono text-slate-500 self-start mt-0.5">&#174;</span>
        <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-950/60 border border-blue-800/50 px-2 py-0.5 rounded-full">Retail OS</span>
      </header>

      {/* ── Main 3-column layout ── */}
      <main className="relative z-20 flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-14 py-3 sm:py-4 lg:py-6 flex flex-col justify-center" role="main">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 xl:gap-8 items-center min-h-0">

          {/* ── COL 1: Brand + Feature Pillars ── */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="order-2 lg:order-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-3 sm:gap-4"
            aria-label="SMRITI feature modules"
          >
            {/* Desktop brand header */}
            <div className="hidden lg:flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-black text-4xl xl:text-5xl tracking-tight text-white leading-none drop-shadow-md">SM<span className="text-blue-500">&#8377;</span>ITI</span>
                <span className="text-xs font-mono text-slate-400 self-start mt-1 drop-shadow-sm">&#174;</span>
              </div>
              <div className="font-display font-bold text-2xl xl:text-3xl text-slate-100 tracking-tight leading-tight drop-shadow-md">Retail OS</div>
              <div className="text-[10px] font-mono tracking-[0.18em] text-slate-300 uppercase font-semibold mt-0.5 drop-shadow-sm">SIMPLE RETAIL. SMARTER BUSINESS.</div>
            </div>

            {/* Feature pillars */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5 sm:gap-2 max-w-sm">
              {RETAIL_PILLARS.map((pillar, idx) => {
                const Icon = pillar.icon;
                return (
                  <motion.div
                    key={pillar.title}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * idx }}
                    className="group flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 hover:border-blue-500/40 hover:bg-slate-900/95 hover:translate-x-1 transition-all duration-200 cursor-default"
                  >
                    <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg bg-blue-950/70 border border-blue-800/40 flex-shrink-0 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-105 transition-all">
                      <Icon size={14} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                      <div>
                        <div className="text-[10.5px] xl:text-xs font-bold text-white leading-tight">{pillar.title}</div>
                        <div className="text-[9px] xl:text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{pillar.desc}</div>
                      </div>
                      <span className="text-slate-600 text-xs hidden lg:inline">&rsaquo;</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Handwritten tagline */}
            <div className="hidden lg:block pt-1">
              <span
                className="inline-block text-2xl xl:text-3xl text-slate-200 font-bold -rotate-2 select-none drop-shadow-sm"
                style={{ fontFamily: "'Caveat', cursive, serif" }}
                aria-hidden="true"
              >
                Built for Modern Retail
              </span>
            </div>
          </motion.div>

          {/* ── COL 2: Login Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.10 }}
            className="order-1 lg:order-2 lg:col-span-5 xl:col-span-4 flex justify-center items-center w-full"
          >
            <div
              className="w-full max-w-[440px] bg-slate-900/96 backdrop-blur-2xl border border-white/14 rounded-2xl sm:rounded-3xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7)] overflow-hidden relative"
              role="dialog"
              aria-label="SMRITI Retail OS login"
            >
              {/* Top accent stripe */}
              <div className="h-1.5 bg-gradient-to-r from-blue-700 via-blue-500 to-sky-400 w-full" aria-hidden="true" />

              <div className="p-5 sm:p-6 md:p-7">

                {/* Card header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-600 flex-shrink-0 flex items-center justify-center font-bold text-lg font-display text-white border border-blue-500/60 shadow-md" aria-hidden="true">S</div>
                    <div>
                      <h1 className="font-display font-bold text-base sm:text-lg text-white leading-tight">SMRITI Retail OS</h1>
                      <p className="text-[10.5px] sm:text-xs text-slate-400 leading-snug mt-0.5">Enterprise Experience &amp; Operations Login</p>
                    </div>
                  </div>
                </div>

                {/* Session Inactivity / Expiration Notice */}
                <AnimatePresence>
                  {sessionNotice && !noticeDismissed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      role="status"
                      aria-live="polite"
                      className="mb-4 p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 backdrop-blur-md shadow-md"
                    >
                      <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                      <div className="flex-1 leading-snug">
                        <span className="font-semibold text-amber-300 block mb-0.5">Session Terminated</span>
                        {sessionNotice}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNoticeDismissed(true);
                          onClearSessionNotice?.();
                        }}
                        className="text-amber-400/80 hover:text-amber-200 p-0.5 rounded transition cursor-pointer"
                        aria-label="Dismiss session notice"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      role="alert"
                      aria-live="assertive"
                      className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
                      <span className="leading-snug">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Authentication form (logic UNCHANGED) */}
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                  {/* Operator ID */}
                  <div>
                    <label htmlFor="login-username" className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      OPERATOR ID / USERNAME
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
                        <User size={14} />
                      </div>
                      <input
                        type="text"
                        id="login-username"
                        name="username"
                        autoComplete="username"
                        aria-label="Operator ID / Username"
                        aria-required="true"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); setActivePersona(null); }}
                        disabled={loading}
                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 font-semibold transition-all min-h-[44px]"
                        placeholder="e.g. manager"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="login-password" className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      SECURITY PASSWORD
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
                        <Lock size={14} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        id="login-password"
                        name="password"
                        autoComplete="current-password"
                        aria-label="Security Password"
                        aria-required="true"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setActivePersona(null); }}
                        disabled={loading}
                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-11 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 font-semibold transition-all min-h-[44px]"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer min-w-[44px] justify-end focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-r-xl"
                      >
                        {showPassword ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me + Forgot password */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px]">
                      <div
                        role="checkbox"
                        aria-checked={rememberMe}
                        tabIndex={0}
                        onClick={() => setRememberMe(!rememberMe)}
                        onKeyDown={(e) => e.key === " " && setRememberMe(!rememberMe)}
                        className={"w-4 h-4 rounded-md border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " + (rememberMe ? "bg-blue-600 border-blue-600 text-white" : "border-slate-600 bg-slate-800")}
                      >
                        {rememberMe && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                      </div>
                      <span className="text-slate-300">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-slate-400 hover:text-blue-400 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-1"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Primary action */}
                  <button
                    type="submit"
                    id="btn-login-submit"
                    disabled={loading}
                    className="w-full min-h-[44px] py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold font-display rounded-xl shadow-lg border border-blue-500/80 hover:border-blue-400 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer select-none disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 mt-1"
                    aria-label={loading ? "Verifying credentials…" : "Authorize Operator — Log In"}
                  >
                    <span>{loading ? "Verifying…" : "Authorize Operator"}</span>
                    {!loading && <ArrowRight size={14} aria-hidden="true" />}
                  </button>
                </form>

                {/* Quick Select Demo Persona */}
                <div className="mt-4 pt-1">
                  <div className="relative flex items-center justify-center mb-3">
                    <div className="border-t border-slate-800 absolute inset-x-0" aria-hidden="true" />
                    <span className="relative bg-slate-900 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest">QUICK SELECT DEMO PERSONA</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Demo persona quick access">
                    {[
                      { role: "Admin",   u: "admin",   pw: "Admin@123",   icon: Shield },
                      { role: "Manager", u: "manager", pw: "Manager@123", icon: Users },
                      { role: "Cashier", u: "cashier", pw: "Cashier@123", icon: CreditCard },
                    ].map(({ role, u, pw, icon: Icon }) => (
                      <button
                        key={role}
                        type="button"
                        aria-pressed={activePersona === role}
                        onClick={() => handleQuickPersona(role, u, pw)}
                        className={"py-2 px-2 rounded-lg border text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " + (
                          activePersona === role
                            ? "border-blue-500 bg-blue-950/60 text-blue-300 shadow-sm"
                            : "border-slate-700 bg-slate-800/80 text-slate-200 hover:border-blue-400/60 hover:bg-slate-700/80"
                        )}
                      >
                        <Icon size={11} aria-hidden="true" />
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card footer: security + version */}
              <div className="bg-slate-950/80 px-5 sm:px-6 py-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-blue-500 flex-shrink-0" aria-hidden="true" />
                  <span>AES-256 Auth Channel</span>
                </div>
                <span>{APP_VERSION_LABEL}</span>
              </div>
            </div>
          </motion.div>

          {/* ── COL 3: Right POS visual + callouts (xl+) ── */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="order-3 hidden xl:flex xl:col-span-5 flex-col justify-center items-start pl-4 space-y-5"
            aria-label="Platform capabilities"
          >
            {/* Module label column */}
            <div className="flex gap-6 items-start w-full">
              <div className="flex flex-col gap-1.5 text-[10px] font-mono tracking-[0.22em] text-slate-400 uppercase font-bold pt-1">
                {RIGHT_MODULE_LABELS.map((lbl) => (
                  <span key={lbl}>{lbl}</span>
                ))}
              </div>

              {/* Capability callouts */}
              <div className="flex flex-col gap-2.5 flex-1">
                {RIGHT_CALLOUTS.map(({ icon: Icon, label, sub }, idx) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.18 + 0.06 * idx }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 hover:border-blue-500/30 hover:bg-slate-900/95 transition-all cursor-default"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-950/70 border border-blue-800/40 flex-shrink-0 flex items-center justify-center text-blue-400">
                      <Icon size={16} strokeWidth={2} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white leading-tight">{label}</div>
                      <div className="text-[10px] text-slate-400">{sub}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Powering text */}
            <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase pt-1">POWERING RETAIL BUSINESSES &nbsp;|&nbsp; SMRITI SYSTEMS</p>
          </motion.div>

        </div>
      </main>

      {/* ── Wave ribbon ── */}
      <div className="relative w-full h-12 sm:h-16 md:h-20 overflow-hidden pointer-events-none -mb-px z-10 opacity-65" aria-hidden="true">
        <svg viewBox="0 0 1440 160" preserveAspectRatio="none" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M-40,110 C320,70 520,150 850,60 C1140,-10 1320,100 1480,50 L1480,160 L-40,160 Z" fill="url(#wg1)" opacity="0.5" />
          <path d="M-40,80 C260,140 580,50 900,110 C1180,160 1360,30 1480,80 L1480,160 L-40,160 Z" fill="url(#wg2)" opacity="0.80" />
          <defs>
            <linearGradient id="wg1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="50%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="wg2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="60%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ── Bottom enterprise capability dock ── */}
      <footer className="relative z-20 w-full bg-slate-950/97 backdrop-blur-2xl border-t border-white/8 text-white py-2.5 px-4 sm:px-6 lg:px-10" role="contentinfo">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">

          {/* Left: PEOPLE | PRODUCTS | PROCESS | PROFIT */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest text-slate-400 whitespace-nowrap">
              PEOPLE <span className="text-blue-500">|</span> PRODUCTS <span className="text-blue-500">|</span> PROCESS <span className="text-blue-500">|</span> PROFIT
            </span>
          </div>

          {/* Center: 8 capability badges — scroll on mobile, flex on desktop */}
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-nowrap sm:flex-wrap sm:justify-center w-full sm:w-auto">
            {FOOTER_FEATURES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <div className="w-6 h-6 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-blue-400" aria-hidden="true">
                  <Icon size={13} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white leading-tight text-[10px] sm:text-[11px] whitespace-nowrap">{label}</div>
                  <div className="text-[9px] text-slate-400 leading-tight whitespace-nowrap">{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Powering retail businesses */}
          <div className="shrink-0 hidden lg:block text-[9px] font-mono text-slate-500 tracking-widest uppercase whitespace-nowrap">
            POWERING RETAIL BUSINESSES
          </div>
        </div>
      </footer>

      {/* ── Forgot Password modal ── */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="forgot-modal-title">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative max-h-[90dvh] overflow-y-auto"
            >
              <button
                type="button"
                aria-label="Close password assistance dialog"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1"
              >
                <X size={18} aria-hidden="true" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-950/60 text-blue-400 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <Info size={20} />
                </div>
                <div>
                  <h2 id="forgot-modal-title" className="font-display font-bold text-base text-white">Operator Security Assistance</h2>
                  <p className="text-xs text-slate-400">SMRITI Identity &amp; Access Governance</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Operator passwords are encrypted with enterprise-grade salt hashes. If you have forgotten your password or your operator ID has been locked, please contact your store supervisor or system administrator to reissue operator credentials.
              </p>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full min-h-[44px] py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
