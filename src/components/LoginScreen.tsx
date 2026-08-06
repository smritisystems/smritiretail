/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.2.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal - Metadata-Driven Login Engine
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  Globe,
  Cpu,
  Sliders,
  Image as ImageIcon,
} from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { FLAGS } from "../config/flags";
import {
  LoginBackgroundProvider,
  useLoginBackground,
} from "../services/login_background/LoginBackgroundEngine";
import { LoginBackgroundAdminDrawer } from "./LoginBackgroundAdminDrawer";

interface LoginScreenProps {
  onLoginSuccess: (user: {
    role: string;
    name: string;
    passwordResetRequired?: boolean;
    companyId?: string;
    branchId?: string;
  }) => void;
}

// Dev-mode seed accounts — only visible in development builds
const DEV_ACCOUNTS = [
  { label: "System Admin",  username: "super",   password: "Smriti@1234",  role: "SYSADMIN", color: "#d93025" },
  { label: "Store Manager", username: "manager", password: "Password@123", role: "MANAGER",  color: "#f29900" },
  { label: "POS Cashier",   username: "cashier", password: "Cashier@1234", role: "CASHIER",  color: "#188038" },
];

const FEATURE_TILES = [
  { icon: Building2, label: "Retail Operations", desc: "POS, Inventory & Procurement" },
  { icon: Globe,     label: "Multi-Branch",       desc: "Centralized branch management" },
  { icon: Shield,    label: "Role-Based Access",  desc: "Granular RBAC security model" },
  { icon: Cpu,       label: "AI-Assisted",         desc: "Intelligent business analytics" },
];

const LoginScreenContent: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const {
    config,
    resolvedItem,
    isAccessibilityDisabled,
    getCardStyle,
    getBackgroundCanvasStyle,
  } = useLoginBackground();

  const [username, setUsername]           = useState("");
  const [password, setPassword]           = useState("");
  const [error, setError]                 = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [showDevPanel, setShowDevPanel]   = useState(false);
  const [showPassword, setShowPassword]   = useState(false);
  const [showAdminDrawer, setShowAdminDrawer] = useState(false);
  const [tileIndex, setTileIndex]         = useState(0);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [capsLockOn, setCapsLockOn]           = useState(false);

  const isDev = (import.meta as unknown as { env: { DEV?: boolean } }).env?.DEV === true;

  const allowDevLogin = isDev || FLAGS.ENABLE_DEV_LOGIN;

  // Rotate feature tiles
  useEffect(() => {
    const timer = setInterval(() => {
      setTileIndex(i => (i + 1) % FEATURE_TILES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter your User ID and password.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const data = await apiFetchV1<{
        access_token?: string;
        role?: string;
        user?: any;
        password_reset_required?: boolean;
        company_id?: string;
        branch_id?: string;
      }>("auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (data && data.access_token) {
        localStorage.setItem("smriti_jwt_token", data.access_token);
        localStorage.removeItem("smriti_session_token");
        const user = data.user ?? {};
        onLoginSuccess({
          role: data.role || user.role || "",
          name: user.display_name || user.full_name || user.username || username,
          passwordResetRequired: data.password_reset_required ?? false,
          companyId: data.company_id ?? user.company_id,
          branchId:  data.branch_id  ?? user.branch_id,
        });
      } else {
        setError("Incorrect User ID or password. Please try again.");
      }
    } catch (err: any) {
      let errMsg = typeof err === "string" ? err : err?.message || "";
      if (!errMsg || errMsg === "Failed to fetch" || errMsg.includes("NetworkError") || errMsg.includes("fetch")) {
        errMsg = "Unable to reach the SMRITI authentication service. Please contact your system administrator.";
      } else if (errMsg.includes("401") || errMsg.toLowerCase().includes("incorrect")) {
        errMsg = "Incorrect User ID or password. Please try again.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (acc: typeof DEV_ACCOUNTS[0]) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setError(null);
  };

  const ActiveTile = FEATURE_TILES[tileIndex];

  return (
    <div
      style={{
        fontFamily: "'72', '72full', 'Inter', Arial, Helvetica, sans-serif",
        ...getBackgroundCanvasStyle(),
      }}
      className="min-h-screen w-full flex flex-col text-[var(--sds-color-text-main)] relative overflow-hidden transition-all duration-500"
    >
      {/* ── Metadata-Driven Vector Background Layer ── */}
      {config.enabled && !isAccessibilityDisabled && resolvedItem && (
        <div
          className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden transition-opacity duration-700"
          style={{ opacity: config.displayControls.opacity / 100 }}
        >
          {resolvedItem.svgContent ? (
            <div
              className="w-[110vw] h-[110vh] max-w-[1400px] max-h-[1400px] text-blue-200/40"
              dangerouslySetInnerHTML={{ __html: resolvedItem.svgContent }}
            />
          ) : resolvedItem.imageUrl ? (
            <img
              src={resolvedItem.imageUrl}
              alt={resolvedItem.title}
              className="w-full h-full object-cover"
            />
          ) : null}
        </div>
      )}

      {/* ── SAP Fiori Shell Bar ── */}
      <header
        style={{ backgroundColor: "var(--sds-color-surface)" }}
        className="h-12 flex items-center px-6 shrink-0 border-b border-[var(--sds-color-border)] relative z-20"
      >
        <div className="flex items-center gap-3">
          {/* Waffle app launcher matrix */}
          <div className="grid grid-cols-3 gap-[3px] w-4 h-4 opacity-80">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-[4px] h-[4px] rounded-[1px] bg-white" />
            ))}
          </div>
          <span className="text-[var(--sds-color-text-main)] font-semibold text-sm tracking-wide">
            SMRITI Retail OS
          </span>
          {resolvedItem && (
            <span
              style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "var(--sds-color-text-main)" }}
              className="hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded font-mono"
            >
              <ImageIcon size={11} className="text-[var(--sds-color-primary)]" />
              <span>{resolvedItem.title}</span>
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Admin Background Configurator Button */}
          <button
            onClick={() => setShowAdminDrawer(true)}
            style={{ backgroundColor: "rgba(0,0,0,0.04)", color: "var(--sds-color-text-main)" }}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded font-semibold hover:bg-[var(--sds-color-surface-hover)] transition-all cursor-pointer"
            title="Configure Metadata Background Engine"
          >
            <Sliders size={13} className="text-blue-300" />
            <span className="hidden sm:inline">Background Engine</span>
          </button>

          <span
            style={{ backgroundColor: "rgba(0,0,0,0.04)", color: "var(--sds-color-text-secondary)" }}
            className="text-[10px] px-2 py-0.5 rounded font-mono"
          >
            v5.2.0
          </span>
          {isDev && (
            <span
              style={{ backgroundColor: "var(--sds-status-warning-text)", color: "#fff" }}
              className="text-[10px] px-2 py-0.5 rounded font-bold"
            >
              DEV
            </span>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div
          style={getCardStyle()}
          className="w-full max-w-5xl flex rounded overflow-hidden transition-all duration-300"
        >
          {/* ── LEFT PANEL — Branding & Showcase ── */}
          <div
            className="hidden md:flex flex-col justify-between w-[420px] shrink-0 p-10 relative overflow-hidden"
            style={{ background: "linear-gradient(160deg, rgba(26,110,209,0.95) 0%, rgba(13,81,164,0.95) 60%, rgba(10,32,56,0.98) 100%)" }}
          >
            {/* Logo block */}
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div
                  className="w-11 h-11 rounded flex items-center justify-center text-white font-bold text-xl"
                  style={{ background: "linear-gradient(135deg, var(--sds-color-primary), #0d47a1)", boxShadow: "0 4px 16px rgba(26,110,209,0.4)" }}
                >
                  S
                </div>
                <div>
                  <div className="text-white font-bold text-base leading-tight">SMRITI</div>
                  <div className="text-[11px] text-blue-300 leading-tight">Business OS Platform</div>
                </div>
              </div>

              <h1 className="text-white text-2xl font-bold leading-snug mb-3">
                Enterprise Retail<br />
                <span style={{ color: "var(--sds-color-primary-light)" }}>Management Suite</span>
              </h1>
              <p className="text-blue-200/70 text-sm leading-relaxed">
                A unified platform for retail operations, inventory, procurement, and intelligent reporting — built for the modern enterprise.
              </p>
            </div>

            {/* Rotating feature tile */}
            <div className="relative z-10 mt-8">
              <div className="text-[10px] text-blue-300/60 font-semibold uppercase tracking-widest mb-3">
                Platform Capabilities
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={tileIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-lg p-4 border border-white/10"
                  style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                      style={{ background: "rgba(10,110,209,0.25)" }}
                    >
                      <ActiveTile.icon size={16} className="text-blue-300" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-semibold leading-tight">{ActiveTile.label}</div>
                      <div className="text-blue-200/60 text-[11px]">{ActiveTile.desc}</div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Dot indicators */}
              <div className="flex gap-1.5 mt-3">
                {FEATURE_TILES.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setTileIndex(i)}
                    className="h-1 rounded-full cursor-pointer transition-all duration-300"
                    style={{
                      width: i === tileIndex ? 18 : 6,
                      background: i === tileIndex ? "#6fa8dc" : "rgba(255,255,255,0.25)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 pt-6 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-blue-200/50 text-[10px]">
                <Shield size={11} />
                <span>Secured with Argon2id · AES-256 · JWT RS256</span>
              </div>
              <div className="text-blue-200/30 text-[10px] mt-1">
                © SMRITIBooks.com. All Rights Reserved.
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL — Login Form ── */}
          <div className="flex-1 bg-[var(--sds-color-surface)]/95 flex flex-col justify-center px-10 py-12">

            {/* Form header */}
            <div className="mb-8">
              <p className="text-[11px] text-[var(--sds-color-text-secondary)] uppercase tracking-widest font-semibold mb-1">
                Welcome to SMRITI
              </p>
              <h2 className="text-[var(--sds-color-text-main)] text-2xl font-bold leading-tight">
                Sign In
              </h2>
              <p className="text-[var(--sds-color-text-secondary)] text-sm mt-1.5">
                Use your SMRITI user credentials to access the workspace.
              </p>
            </div>

            {/* Error message — Fiori MessageStrip style */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 overflow-hidden"
                >
                  <div
                    className="flex items-start gap-2.5 px-3.5 py-3 rounded text-sm border-l-4"
                    style={{
                      backgroundColor: "var(--sds-status-error-bg)",
                      borderLeftColor: "var(--sds-status-error-text)",
                      color: "var(--sds-color-text-main)",
                    }}
                  >
                    <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: "var(--sds-status-error-text)" }} />
                    <span className="text-[12px] leading-relaxed">{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* User ID field */}
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-[12px] font-semibold mb-1.5 text-[var(--sds-color-text-main)]"
                >
                  User ID<span style={{ color: "var(--sds-status-error-text)" }}>*</span>
                </label>
                <div className="relative">
                  <div
                    className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none transition-colors"
                    style={{ color: usernameFocused ? "var(--sds-color-primary)" : "var(--sds-color-text-secondary)" }}
                  >
                    <User size={15} />
                  </div>
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(null); }}
                    onFocus={() => setUsernameFocused(true)}
                    onBlur={() => setUsernameFocused(false)}
                    disabled={loading}
                    autoComplete="username"
                    placeholder="Enter your User ID"
                    style={{
                      border: `1px solid ${usernameFocused ? "var(--sds-color-primary)" : "var(--sds-color-border)"}`,
                      boxShadow: usernameFocused ? "0 0 0 2px rgba(10,110,209,0.15)" : "none",
                      borderRadius: 4,
                      fontSize: 14,
                      color: "var(--sds-color-text-main)",
                      backgroundColor: "var(--sds-color-surface)",
                      outline: "none",
                    }}
                    className="w-full pl-9 pr-4 py-2.5 transition-all placeholder:text-[#c2c2c2] disabled:bg-[#f4f4f4] disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-[12px] font-semibold mb-1.5 text-[var(--sds-color-text-main)]"
                >
                  Password<span style={{ color: "var(--sds-status-error-text)" }}>*</span>
                </label>
                <div className="relative">
                  <div
                    className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none transition-colors"
                    style={{ color: passwordFocused ? "var(--sds-color-primary)" : "var(--sds-color-text-secondary)" }}
                  >
                    <Lock size={15} />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    onKeyDown={e => setCapsLockOn(e.getModifierState("CapsLock"))}
                    onKeyUp={e => setCapsLockOn(e.getModifierState("CapsLock"))}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    disabled={loading}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    style={{
                      border: `1px solid ${passwordFocused ? "var(--sds-color-primary)" : "var(--sds-color-border)"}`,
                      boxShadow: passwordFocused ? "0 0 0 2px rgba(10,110,209,0.15)" : "none",
                      borderRadius: 4,
                      fontSize: 14,
                      color: "var(--sds-color-text-main)",
                      backgroundColor: "var(--sds-color-surface)",
                      outline: "none",
                    }}
                    className="w-full pl-9 pr-10 py-2.5 transition-all placeholder:text-[#c2c2c2] disabled:bg-[#f4f4f4] disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors hover:text-[var(--sds-color-primary)]"
                    style={{ color: "var(--sds-color-text-secondary)" }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {capsLockOn && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold mt-1.5 animate-pulse">
                    <AlertCircle size={13} />
                    <span>Caps Lock is ON</span>
                  </div>
                )}
              </div>


              {/* Sign In Button — Fiori Emphasized style */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: loading ? "var(--sds-color-border)" : "var(--sds-color-primary)",
                  borderRadius: 4,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-white font-semibold text-sm transition-all hover:brightness-110 active:brightness-95 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>Authenticating…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* Success hint */}
            <div className="mt-5 flex items-center gap-1.5 text-[11px] text-[var(--sds-color-text-secondary)]">
              <CheckCircle2 size={12} style={{ color: "var(--sds-status-success-text)" }} />
              <span>Single Sign-On secured with JWT + Argon2id</span>
            </div>

            {/* Dev credential panel */}
            {isDev && (
              <div
                className="mt-7 rounded border overflow-hidden"
                style={{ borderColor: "var(--sds-status-warning-text)", backgroundColor: "var(--sds-status-warning-bg)" }}
              >
                {allowDevLogin && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowDevPanel(!showDevPanel)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 transition-colors"
                      style={{ backgroundColor: "var(--sds-status-warning-bg)", color: "var(--sds-status-warning-text)" }}
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
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
                          <div className="p-3 space-y-2">
                            <p className="text-[10px] mb-2 text-[var(--sds-color-text-secondary)]">
                              Click any account to auto-fill. Visible in DEV build only.
                            </p>
                            {DEV_ACCOUNTS.map(acc => (
                              <button
                                key={acc.username}
                                type="button"
                                onClick={() => fillCredentials(acc)}
                                className="w-full flex items-center justify-between px-3 py-2 rounded transition-all text-left border hover:border-[#0854a0]"
                                style={{ borderColor: "#e5e5e5", backgroundColor: "#fff" }}
                              >
                                <div>
                                  <span className="text-[12px] font-semibold block text-[var(--sds-color-text-main)] leading-none mb-0.5">{acc.label}</span>
                                  <span className="text-[10px] font-mono text-[var(--sds-color-text-secondary)]">
                                    {acc.username} / {acc.password}
                                  </span>
                                </div>
                                <span
                                  className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                                  style={{ backgroundColor: acc.color }}
                                >
                                  {acc.role}
                                </span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[var(--sds-color-border)] text-[10px] text-[var(--sds-color-text-secondary)]">
              © 2026 SMRITIBooks.com · smritisys.com · Proprietary Commercial Software
            </div>
          </div>
        </div>
      </main>

      {/* ── Fiori Footer Bar ── */}
      <footer
        className="h-9 flex items-center justify-between px-6 text-[11px] relative z-20 border-t border-[var(--sds-color-border)]"
        style={{ backgroundColor: "var(--sds-color-surface)", color: "var(--sds-color-text-secondary)" }}
      >
        <span>SMRITI Retail OS — Enterprise Business Platform</span>
        <div className="flex items-center gap-1.5">
          <Shield size={11} style={{ color: "rgba(255,255,255,0.4)" }} />
          <span>Secure Connection</span>
        </div>
      </footer>

      {/* Admin Background Control Panel Drawer */}
      <LoginBackgroundAdminDrawer
        isOpen={showAdminDrawer}
        onClose={() => setShowAdminDrawer(false)}
      />
    </div>
  );
};

export const LoginScreen: React.FC<LoginScreenProps> = (props) => (
  <LoginBackgroundProvider>
    <LoginScreenContent {...props} />
  </LoginBackgroundProvider>
);
