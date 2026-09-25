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
 * Version      : 6.44.3
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
  Sparkles,
  Server,
  Zap,
} from "lucide-react";
import { APP_VERSION_LABEL } from "../config/version.ts";
import { persistTenantContext, normalizeBranchId, normalizeCompanyId } from "../lib/apiFetchV1";

interface LoginScreenProps {
  onLoginSuccess: (user: {
    role: string;
    name: string;
    passwordResetRequired?: boolean;
    companyId?: string;
    branchId?: string;
  }) => void;
}

const RETAIL_PILLARS = [
  {
    icon: ShoppingCart,
    title: "Sales & Billing",
    desc: "Fast & Easy Checkout",
  },
  {
    icon: Package,
    title: "Inventory Management",
    desc: "Real-Time Stock Visibility",
  },
  {
    icon: Truck,
    title: "Distribution",
    desc: "Smarter Supply Chain",
  },
  {
    icon: Warehouse,
    title: "Warehouse",
    desc: "Better Stock Control",
  },
  {
    icon: Users,
    title: "Customer Management",
    desc: "Stronger Relationships",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    desc: "Data Driven Growth",
  },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

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
        localStorage.removeItem("smriti_session_token");
        localStorage.removeItem("smriti_jwt_token");
        localStorage.removeItem("smriti_refresh_token");
        localStorage.removeItem("smriti_company_id");
        localStorage.removeItem("smriti_company_code");
        localStorage.removeItem("smriti_branch_id");

        localStorage.setItem("smriti_jwt_token", data.access_token);
        if (data.refresh_token) {
          localStorage.setItem("smriti_refresh_token", data.refresh_token);
        }
        if (rememberMe) {
          localStorage.setItem("smriti_saved_operator", username);
        } else {
          localStorage.removeItem("smriti_saved_operator");
        }

        const user = data.user ?? {};
        const compId = normalizeCompanyId(data.company_id ?? user.company_id ?? "COMP-001");
        const brId = normalizeBranchId(data.branch_id ?? user.branch_id ?? "BR-MAIN-001");

        persistTenantContext({
          companyId: compId,
          companyCode: data.company_code ?? user.company_code,
          branchId: brId,
          branchCode: data.branch_code ?? user.branch_code,
          companyName: data.company_name ?? user.company_name,
          branchName: data.branch_name ?? user.branch_name,
        });

        onLoginSuccess({
          role: user.role ?? "",
          name: user.display_name || user.full_name || user.username || username,
          passwordResetRequired: data.password_reset_required ?? false,
          companyId: compId,
          branchId: brId,
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

  const handleQuickPersona = (role: string, u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setActivePersona(role);
    setError(null);
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col justify-between overflow-x-hidden font-sans select-none bg-slate-950 text-slate-100">
      {/* 1. Deep Architectural Canvas Layer (Crisp at 4K & Ultrawide) */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-slate-950 via-[#070e22] to-slate-950" />

      {/* 2. Omnipresent Sapphire Ambient Lighting */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(37,99,235,0.22),transparent_75%)]" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_85%_35%,rgba(6,182,212,0.12),transparent_55%)]" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_75%,rgba(37,99,235,0.14),transparent_55%)]" />

      {/* 3. Luxury Boutique Ambient Backdrop with Aspect Ratio & Vignette Shield */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 dark:opacity-20 mix-blend-luminosity bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{
          backgroundImage: `url('/assets/branding/retail_login_bg.jpg')`,
          filter: "blur(0.5px)",
        }}
      />
      {/* Full 360-degree Vignette so edges stay uniform on ultra-wide screens */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/80" />
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-r from-slate-950/90 via-transparent to-slate-950/90" />

      {/* 4. Top Mobile Brand Banner (Visible only on < lg screens) */}
      <header className="relative z-20 w-full lg:hidden px-4 sm:px-6 pt-4 pb-1 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-display font-black text-2xl sm:text-3xl tracking-tight text-white">
            SM<span className="text-blue-500 font-extrabold">₹</span>ITI
          </span>
          <span className="text-[10px] font-mono font-bold text-slate-500 self-start mt-1">®</span>
          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 border border-blue-800/50 px-2 py-0.5 rounded-full ml-1.5">
            Retail OS
          </span>
        </div>
        <span
          className="text-lg text-slate-300 font-bold select-none drop-shadow-xs"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          Built for Modern Retail
        </span>
      </header>

      {/* 5. Main Content Area */}
      <main className="relative z-20 flex-1 w-full max-w-[1520px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-6 lg:py-8 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-10 items-center">
          
          {/* COLUMN 1: Brand Identity & Feature Pillars (Order 2 on mobile, Order 1 on Desktop) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="order-2 lg:order-1 lg:col-span-6 xl:col-span-4 flex flex-col justify-center space-y-4 sm:space-y-5"
          >
            {/* Desktop Brand Header */}
            <div className="hidden lg:block space-y-1">
              <div className="flex items-center space-x-1.5">
                <span className="font-display font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white">
                  SM<span className="text-blue-500 font-extrabold">₹</span>ITI
                </span>
                <span className="text-xs font-mono font-bold text-slate-500 self-start mt-2">
                  ®
                </span>
              </div>
              <div className="font-display font-bold text-xl sm:text-2xl lg:text-3xl text-slate-100 tracking-tight">
                Retail OS
              </div>
              <div className="text-[10px] sm:text-[11px] font-mono tracking-widest text-slate-400 uppercase font-semibold">
                SIMPLE RETAIL. SMARTER BUSINESS.
              </div>
            </div>

            {/* 6 Core Feature Pillars (2-columns on tablet/mobile, 1-column on desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-2.5 max-w-xl lg:max-w-sm">
              {RETAIL_PILLARS.map((pillar, idx) => {
                const IconComp = pillar.icon;
                return (
                  <motion.div
                    key={pillar.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.04 * idx }}
                    className="group flex items-center space-x-3 px-3 py-2 rounded-xl sm:rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-blue-500/40 shadow-xs hover:shadow-md hover:bg-slate-900/85 hover:translate-x-1 transition-all duration-200"
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-950/70 border border-blue-800/40 flex-shrink-0 flex items-center justify-center text-blue-400 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <IconComp size={16} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white leading-tight truncate">
                        {pillar.title}
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight mt-0.5 truncate">
                        {pillar.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Desktop Handwritten Script Badge */}
            <div className="hidden lg:block pt-1">
              <span
                className="inline-block text-2xl lg:text-3xl text-slate-200 font-bold -rotate-2 select-none drop-shadow-xs"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                Built for Modern Retail
              </span>
            </div>
          </motion.div>

          {/* COLUMN 2: Glassmorphic Authentication Card (Order 1 on mobile, Order 2 on Desktop) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="order-1 lg:order-2 lg:col-span-6 xl:col-span-4 flex justify-center items-center w-full"
          >
            <div className="w-full max-w-[440px] bg-slate-900/90 backdrop-blur-2xl border border-white/15 rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] p-5 sm:p-7 md:p-8 relative">
              
              {/* Header: Logo, Title & Language Selector (Wrap-Safe) */}
              <div className="flex items-center justify-between gap-2 mb-5 sm:mb-6">
                <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex-shrink-0 flex items-center justify-center font-display font-extrabold text-lg sm:text-xl text-white shadow-lg shadow-blue-500/30 border border-blue-400/40">
                    S
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display font-bold text-sm sm:text-base text-white leading-tight truncate">
                      SMRITI Retail OS
                    </h2>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                      Enterprise Operations Login
                    </p>
                  </div>
                </div>

                {/* Language Selector Dropdown */}
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsLangOpen(!isLangOpen)}
                    className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/90 text-[10px] sm:text-[11px] font-semibold text-slate-300 hover:border-blue-400 transition cursor-pointer"
                  >
                    <Globe size={12} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate max-w-[65px]">{selectedLanguage}</span>
                    <ChevronDown size={11} className="text-slate-400 flex-shrink-0" />
                  </button>

                  <AnimatePresence>
                    {isLangOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute right-0 mt-1 w-36 rounded-xl bg-slate-800 border border-slate-700 shadow-xl py-1 z-30"
                      >
                        {LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => {
                              setSelectedLanguage(lang.label.split(" ")[0]);
                              setIsLangOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700/80 transition cursor-pointer"
                          >
                            {lang.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Error Banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span className="leading-snug">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
                {/* Operator ID Field */}
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1"
                  >
                    OPERATOR ID / USERNAME
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User size={15} />
                    </div>
                    <input
                      type="text"
                      id="login-username"
                      aria-label="Operator ID / Username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setActivePersona(null);
                      }}
                      disabled={loading}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 font-medium transition-all"
                      placeholder="e.g. manager"
                    />
                  </div>
                </div>

                {/* Security Password Field */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1"
                  >
                    SECURITY PASSWORD
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock size={15} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="login-password"
                      aria-label="Security Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setActivePersona(null);
                      }}
                      disabled={loading}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 sm:pl-10 pr-10 py-2 sm:py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 font-medium transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 sm:pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Auxiliary Controls: Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <div
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        rememberMe
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-600 bg-slate-800"
                      }`}
                    >
                      {rememberMe && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="text-slate-300 text-xs">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs text-slate-400 hover:text-blue-400 transition cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Primary Action Button */}
                <button
                  type="submit"
                  id="btn-login-submit"
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-display font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer select-none disabled:opacity-50 mt-1"
                >
                  <span>{loading ? "Verifying Access..." : "Login"}</span>
                  {!loading && <ArrowRight size={15} />}
                </button>
              </form>

              {/* Quick Access Persona Section */}
              <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-slate-800">
                <div className="flex items-center justify-center space-x-3 mb-2.5 sm:mb-3">
                  <div className="h-px bg-slate-800 flex-1" />
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    QUICK ACCESS
                  </span>
                  <div className="h-px bg-slate-800 flex-1" />
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleQuickPersona("Admin", "admin", "Admin@123")}
                    className={`py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center space-x-1 sm:space-x-1.5 transition-all cursor-pointer ${
                      activePersona === "Admin"
                        ? "border-blue-500 bg-blue-950/60 text-blue-300 shadow-xs"
                        : "border-slate-700/80 bg-slate-800/60 text-slate-200 hover:border-blue-400 hover:bg-slate-800"
                    }`}
                  >
                    <Shield size={12} className="text-blue-400 flex-shrink-0" />
                    <span className="truncate">Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickPersona("Manager", "manager", "Manager@123")}
                    className={`py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center space-x-1 sm:space-x-1.5 transition-all cursor-pointer ${
                      activePersona === "Manager"
                        ? "border-blue-500 bg-blue-950/60 text-blue-300 shadow-xs"
                        : "border-slate-700/80 bg-slate-800/60 text-slate-200 hover:border-blue-400 hover:bg-slate-800"
                    }`}
                  >
                    <Users size={12} className="text-blue-400 flex-shrink-0" />
                    <span className="truncate">Manager</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickPersona("Cashier", "cashier", "Cashier@123")}
                    className={`py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center space-x-1 sm:space-x-1.5 transition-all cursor-pointer ${
                      activePersona === "Cashier"
                        ? "border-blue-500 bg-blue-950/60 text-blue-300 shadow-xs"
                        : "border-slate-700/80 bg-slate-800/60 text-slate-200 hover:border-blue-400 hover:bg-slate-800"
                    }`}
                  >
                    <ShoppingCart size={12} className="text-blue-400 flex-shrink-0" />
                    <span className="truncate">Cashier</span>
                  </button>
                </div>
              </div>

              {/* Card Footer Security & Version Seal */}
              <div className="mt-5 pt-3.5 border-t border-slate-800 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck size={13} className="text-blue-400 flex-shrink-0" />
                  <span className="truncate">AES-256 Auth</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 flex-shrink-0">{APP_VERSION_LABEL}</span>
              </div>
            </div>
          </motion.div>

          {/* COLUMN 3: Enterprise Architecture Showcase (Visible on xl+ screens: 1280px, 1440p, 4K, Ultrawide) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="order-3 hidden xl:flex xl:col-span-4 flex-col justify-center items-start pl-6 lg:pl-10 space-y-6"
          >
            {/* Majestic Slogan */}
            <div className="space-y-1 font-display font-black text-2xl xl:text-3xl text-white uppercase tracking-[0.2em] leading-snug drop-shadow-sm select-none">
              <div>ONE</div>
              <div className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
                PLATFORM
              </div>
              <div>EVERY</div>
              <div className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
                RETAIL NEED
              </div>
            </div>

            <p className="text-xs text-slate-300/90 leading-relaxed max-w-xs font-normal">
              High-throughput retail operating system unifying point-of-sale, omnichannel stock movement, statutory GSTN vault, and automated financial journals.
            </p>

            {/* Architecture Highlights */}
            <div className="space-y-2.5 pt-1 w-full max-w-xs">
              <div className="flex items-center space-x-2.5 p-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
                <Server size={14} className="text-blue-400 flex-shrink-0" />
                <span className="text-slate-300 text-[11px] font-medium">PostgreSQL Transactional SoR</span>
              </div>
              <div className="flex items-center space-x-2.5 p-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
                <Zap size={14} className="text-amber-400 flex-shrink-0" />
                <span className="text-slate-300 text-[11px] font-medium">Sub-millisecond Offline Sync</span>
              </div>
              <div className="flex items-center space-x-2.5 p-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
                <Sparkles size={14} className="text-cyan-400 flex-shrink-0" />
                <span className="text-slate-300 text-[11px] font-medium">E-Invoice & GST Compliance</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* 6. Fluid Sapphire Wave Ribbon (Anchored directly above footer, spans 100% width cleanly) */}
      <div className="relative w-full h-12 sm:h-16 md:h-20 overflow-hidden pointer-events-none -mb-1 z-10 opacity-70">
        <svg
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-40,110 C320,70 520,150 850,60 C1140,-10 1320,100 1480,50 L1480,160 L-40,160 Z"
            fill="url(#blueWaveGrad1)"
            opacity="0.5"
          />
          <path
            d="M-40,80 C260,140 580,50 900,110 C1180,160 1360,30 1480,80 L1480,160 L-40,160 Z"
            fill="url(#blueWaveGrad2)"
            opacity="0.75"
          />
          <defs>
            <linearGradient id="blueWaveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="50%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="blueWaveGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="60%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* 7. Bottom Enterprise Capability Dock (Responsive Grid on Mobile, Flex Row on Desktop) */}
      <footer className="relative z-20 w-full bg-slate-950/95 backdrop-blur-2xl border-t border-white/10 text-white py-2.5 sm:py-3 px-4 sm:px-6 lg:px-12">
        <div className="max-w-[1520px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          
          {/* 5 Enterprise Capability Badges (2 columns on mobile, 3 on tablet, flex row on desktop) */}
          <div className="w-full md:w-auto grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap items-center justify-center md:justify-start gap-3 sm:gap-4 lg:gap-6 text-xs text-slate-300">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-blue-400">
                <Store size={14} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-white leading-tight text-[11px] sm:text-xs truncate">Multi-Store</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 leading-tight truncate">Support</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-blue-400">
                <Cloud size={14} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-white leading-tight text-[11px] sm:text-xs truncate">Cloud Ready</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 leading-tight truncate">Anywhere</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-blue-400">
                <Smartphone size={14} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-white leading-tight text-[11px] sm:text-xs truncate">Web · POS · Mobile</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 leading-tight truncate">Responsive</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-blue-400">
                <ShieldCheck size={14} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-white leading-tight text-[11px] sm:text-xs truncate">Enterprise Safe</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 leading-tight truncate">Audit Vault</div>
              </div>
            </div>

            <div className="flex items-center space-x-2 col-span-2 sm:col-span-1 md:col-span-auto justify-center sm:justify-start">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-blue-400">
                <Sliders size={14} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-white leading-tight text-[11px] sm:text-xs truncate">Modular Engine</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 leading-tight truncate">Scalable</div>
              </div>
            </div>
          </div>

          {/* Strategic Governance Pod */}
          <div className="flex-shrink-0 flex items-center space-x-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
            <Users size={13} className="text-blue-400 flex-shrink-0" />
            <div className="text-[9px] sm:text-[10px] lg:text-[11px] font-mono font-bold tracking-wider text-slate-200 text-center">
              PEOPLE <span className="text-blue-500">|</span> PRODUCTS <span className="text-blue-500">|</span> PROCESS <span className="text-blue-500">|</span> PROFIT
            </div>
          </div>
        </div>
      </footer>

      {/* 8. Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-950/60 text-blue-400 flex items-center justify-center flex-shrink-0">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    Operator Security Assistance
                  </h3>
                  <p className="text-xs text-slate-400">SMRITI Identity & Access Governance</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Operator passwords are encrypted with enterprise-grade salt hashes. If you have forgotten your password or your operator ID has been locked, please contact your store supervisor or system administrator to reissue operator credentials.
              </p>

              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition cursor-pointer"
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
