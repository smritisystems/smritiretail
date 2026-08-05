/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : SMRITI Context-Aware Navigation Sidebar (WNG-002 & WNG-005 Compliant)
 * Standard     : SMAP Constitution v1.0 — Rule 11 & Rule 15 (PBC-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 6.0.0 (SPK.navigation Registry Driven)
 */

import React, { useState } from "react";
import { SPK } from "../../kernel/SPK.js";
import {
  ChevronLeft,
  ChevronRight,
  Grid,
  ShoppingCart,
  Receipt,
  RotateCcw,
  Package,
  Users,
  Briefcase,
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  Settings,
  ShieldCheck,
  Building,
  RefreshCw,
  Sliders,
  Sparkles,
  BookOpen,
  FileCode,
  Truck,
  Layers,
  Bot
} from "lucide-react";

const LUCIDE_ICON_MAP: Record<string, React.ElementType> = {
  ShoppingCart,
  Receipt,
  RotateCcw,
  Users,
  Package,
  Layers,
  Truck,
  Printer,
  Briefcase,
  Building,
  DollarSign,
  RefreshCw,
  ShieldCheck,
  Settings,
  Bot,
  Grid,
  Sliders,
  FileCode,
  TrendingUp,
  FileText,
  Sparkles,
  BookOpen
};

export type DomainCategory = "Sales" | "Inventory" | "Purchase" | "Finance" | "Administration" | "Analytics" | string;

interface ContextualSidebarProps {
  activeTab: string;
  activeDomain?: DomainCategory;
  onSelectTab: (tabId: string) => void;
  onReturnToLaunchpad: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const ContextualSidebar: React.FC<ContextualSidebarProps> = ({
  activeTab,
  activeDomain,
  onSelectTab,
  onReturnToLaunchpad,
  mobileOpen = false,
  onMobileClose,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // Single Source of Truth: Derive Domain & Modules from Active Workspace Context via SPK.navigation
  const rawDomainDef = SPK.navigation.getDomainForWorkspace(activeTab) ||
    (activeDomain ? SPK.navigation.getDomain(activeDomain.toLowerCase()) : undefined) ||
    SPK.navigation.getDomain("sales");

  const domainTitle = rawDomainDef?.label || `${activeDomain || "Sales"} Domain`;

  // Capability-Driven Module Filtering (WNG-005 & Rule 19)
  const availableModules = rawDomainDef?.modules && rawDomainDef.modules.length > 0
    ? rawDomainDef.modules.filter((m) => {
        if (!m.permission) return true;
        const decision = SPK.security.evaluateAccess("current_user", "MANAGER", m.permission);
        return decision.allowed;
      })
    : (rawDomainDef?.moduleIds || []).map((id) => ({
        id,
        title: id.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        icon: "Package",
        targetTab: id,
        badge: undefined
      }));

  const modules = availableModules.length > 0
    ? availableModules
    : [{ id: activeTab, title: activeTab.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()), icon: "Package", targetTab: activeTab }];

  return (
    <aside
      className={`h-full bg-theme-surface-1 border-r border-theme-divider flex flex-col justify-between transition-all duration-300 select-none z-40 fixed left-0 top-12 bottom-0 md:relative md:inset-auto md:z-20 md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } ${collapsed ? "w-16" : "w-60"}`}
    >
      {/* Sidebar Header */}
      <div className="p-3 border-b border-theme-divider flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "var(--c-seef-accent)" }} />
            <span className="seds-text-overline text-theme-heading truncate font-bold">
              {domainTitle}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-heading transition-colors cursor-pointer"
          title={collapsed ? "Expand Menu" : "Collapse Menu"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Return to Launchpad Button */}
      <div className="p-2 border-b border-theme-divider">
        <button
          onClick={onReturnToLaunchpad}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg seds-text-button border transition-all cursor-pointer ${
            collapsed ? "justify-center px-0" : ""
          }`}
          style={{
            background: "rgba(var(--c-seef-accent-rgb, 10 110 209) / 0.10)",
            color: "var(--c-seef-accent)",
            borderColor: "rgba(var(--c-seef-accent-rgb, 10 110 209) / 0.30)",
          }}
          title="Return to SMRITI Launchpad"
        >
          <Grid size={18} className="shrink-0" />
          {!collapsed && <span>SMRITI Launchpad</span>}
        </button>
      </div>

      {/* Contextual Navigation Items (Registry Driven) */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
        {modules.map((item) => {
          const Icon = LUCIDE_ICON_MAP[item.icon] || Package;
          const isActive = activeTab === item.targetTab;

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.targetTab);
                onMobileClose?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg seds-text-small font-medium transition-all cursor-pointer ${
                isActive
                  ? "text-white font-bold shadow-xs"
                  : "text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2"
              } ${collapsed ? "justify-center px-0" : ""}`}
              style={isActive ? { background: "var(--c-seef-accent)" } : {}}
              title={collapsed ? item.title : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.title}</span>
                  {item.badge && (
                    <span
                      className="px-1.5 py-0.2 seds-text-overline rounded"
                      style={{ background: "rgba(var(--c-seef-accent-rgb, 10 110 209) / 0.20)", color: "var(--c-seef-accent)" }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-theme-divider text-[10px] text-theme-muted font-mono flex items-center justify-between">
          <span>SPK.navigation v6.0</span>
          <span className="text-emerald-400 font-bold">● Live</span>
        </div>
      )}
    </aside>
  );
};
