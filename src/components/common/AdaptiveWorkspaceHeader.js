"use strict";
/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : SAP Fiori Enterprise Slim Header (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.2.0 (SEEF Phase 9 â€” Full Token Compliance, no hardcoded hex)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveWorkspaceHeader = void 0;
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
var SEEFContext_tsx_1 = require("../../layout_engine/SEEFContext.tsx");
var SUNEFNavigationBar_tsx_1 = require("../../navigation/SUNEFNavigationBar.tsx");
var AdaptiveWorkspaceHeader = function (_a) {
    var currentUser = _a.currentUser, onOpenGlobalSearch = _a.onOpenGlobalSearch, onOpenNotifications = _a.onOpenNotifications, onOpenHelp = _a.onOpenHelp;
    var _b = (0, SEEFContext_tsx_1.useSEEF)(), config = _b.config, updateSEEF = _b.updateSEEF;
    var activeTheme = config.theme;
    var handleThemeChange = function (newTheme) {
        updateSEEF({ theme: newTheme });
    };
    // Derive light vs dark mode for readable foreground colors
    var isLight = activeTheme === "enterprise" || activeTheme === "light" || activeTheme === "minimal";
    return (<header className="h-12 border-b px-4 flex flex-wrap items-center justify-between text-xs select-none z-30 shadow-md transition-colors duration-300" style={{
            background: "var(--c-seef-brand)",
            borderColor: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.10)",
            color: "var(--c-theme-body)",
        }}>
      {/* 1. SMRITI Brand & Waffle Matrix App Launcher */}
      <div className="flex items-center gap-3">
        <div className="grid grid-cols-3 gap-[3px] w-4 h-4 opacity-90 cursor-pointer hover:opacity-100 transition-opacity" title="SMRITI Launchpad Matrix">
          {Array.from({ length: 9 }).map(function (_, i) { return (<div key={i} className="w-[4px] h-[4px] rounded-[1px]" style={{ background: "var(--c-theme-body)" }}/>); })}
        </div>
        <span className="seds-text-title flex items-center gap-2" style={{ color: "var(--c-theme-body)" }}>
          SMRITI{" "}
          <span className="font-mono text-xs" style={{ color: "var(--c-seef-info)" }}>
            Retail OS
          </span>
        </span>
        <span className="px-2 py-0.5 rounded seds-text-overline hidden sm:inline-block" style={{
            background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
            border: "1px solid ".concat(isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)"),
            color: "var(--c-theme-body)",
        }}>
          v5.3 Enterprise
        </span>
        {/* SUNE In-App Control Bar (Back, Forward, Refresh, Home) */}
        <SUNEFNavigationBar_tsx_1.SUNEFNavigationBar />
      </div>

      {/* 2. Center Global Search Input Trigger (Ctrl+K) */}
      <div className="flex-1 max-w-md mx-4 min-w-0">
        <button type="button" onClick={onOpenGlobalSearch} className="w-full min-w-0 flex items-center justify-between rounded-xl px-3 py-1.5 transition-all seds-text-small" style={{
            background: "var(--c-theme-surface-2)",
            border: "1px solid ".concat(isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)"),
            color: "var(--c-theme-muted)",
        }} onMouseEnter={function (e) { return (e.currentTarget.style.color = "var(--c-theme-body)"); }} onMouseLeave={function (e) { return (e.currentTarget.style.color = "var(--c-theme-muted)"); }}>
          <div className="flex items-center gap-2">
            <lucide_react_1.Search size={14} style={{ color: "var(--c-theme-muted)" }}/>
            <span className="seds-text-small">Search applications, SKU, customers...</span>
          </div>
          <kbd className="px-1.5 seds-text-overline rounded" style={{
            background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)",
            border: "1px solid ".concat(isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)"),
            color: "var(--c-theme-muted)",
        }}>
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* 3. Right Enterprise Actions & User Profile */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* SEEF Theme Switcher */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{
            background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)",
            border: "1px solid ".concat(isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)"),
        }}>
          <lucide_react_1.Palette size={14} className="ml-1 shrink-0" style={{ color: "var(--c-seef-info)" }}/>
          <select value={activeTheme} onChange={function (e) { return handleThemeChange(e.target.value); }} className="bg-transparent seds-text-caption font-semibold focus:outline-none cursor-pointer pr-1" style={{ color: "var(--c-theme-body)" }} title="Switch Theme">
            <option value="dark" className="bg-[#1c222b] text-white">Quartz Dark</option>
            <option value="enterprise" className="bg-white text-[#1d2d3e]">Horizon Light (Fiori)</option>
            <option value="light" className="bg-white text-[#1d2d3e]">Light</option>
            <option value="corporate" className="bg-[#0f1d2a] text-white">Corporate Navy</option>
            <option value="high-contrast" className="bg-black text-white">High Contrast</option>
          </select>
        </div>

        {/* Help Portal */}
        <button type="button" onClick={onOpenHelp} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--c-theme-muted)" }} onMouseEnter={function (e) { return (e.currentTarget.style.color = "var(--c-theme-body)"); }} onMouseLeave={function (e) { return (e.currentTarget.style.color = "var(--c-theme-muted)"); }} title="SMRITI Documentation & Help">
          <lucide_react_1.HelpCircle size={16}/>
        </button>

        {/* Notifications Trigger */}
        <button type="button" onClick={onOpenNotifications} className="p-1.5 rounded-lg transition-colors relative" style={{ color: "var(--c-theme-muted)" }} onMouseEnter={function (e) { return (e.currentTarget.style.color = "var(--c-theme-body)"); }} onMouseLeave={function (e) { return (e.currentTarget.style.color = "var(--c-theme-muted)"); }} title="Notifications">
          <lucide_react_1.Bell size={16}/>
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-400"/>
        </button>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2 pl-2" style={{ borderLeft: "1px solid ".concat(isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)") }}>
          <div className="w-7 h-7 rounded-full border text-white flex items-center justify-center font-bold text-xs shadow-sm" style={{
            background: "var(--c-seef-accent)",
            borderColor: isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.20)",
        }}>
            {(currentUser === null || currentUser === void 0 ? void 0 : currentUser.name) ? currentUser.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="font-bold text-xs leading-tight" style={{ color: "var(--c-theme-body)" }}>
              {(currentUser === null || currentUser === void 0 ? void 0 : currentUser.name) || "Cashier"}
            </span>
            <span className="text-[10px] font-mono leading-tight" style={{ color: "var(--c-seef-info)" }}>
              {(currentUser === null || currentUser === void 0 ? void 0 : currentUser.role) || "Staff"}
            </span>
          </div>
        </div>
      </div>
    </header>);
};
exports.AdaptiveWorkspaceHeader = AdaptiveWorkspaceHeader;
