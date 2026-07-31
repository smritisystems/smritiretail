/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.1.0  (Mega-Menu NavMode + top-bar→top-nav bugfix)
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Star, Clock, ChevronDown, ChevronRight, MoreHorizontal, 
  Settings, Layers, SlidersHorizontal, Search, Sparkles, Check, 
  HelpCircle, ShieldCheck, Heart, Grid, Menu, X, ArrowLeftRight,
  ExternalLink, Maximize, Play
} from "lucide-react";
import { useLayoutEngine, WorkspaceConfig, DockPosition } from "./layout_store.js";
import { SmritiScrollArea } from "../components/SmritiScrollArea.tsx";
import { useWorkspace } from "../contexts/WorkspaceContext.tsx";
import { useAdaptiveWorkspace } from "./adaptive_workspace_store.ts";
import { useSEEFNavigation } from "./SEEFContext.tsx";

interface NavigationRendererProps {
  activeTab: string;
  onTabSelect: (id: string) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const NavigationRenderer: React.FC<NavigationRendererProps> = ({
  activeTab,
  onTabSelect,
  searchTerm,
  onSearchChange
}) => {
  const {
    preferences,
    recentlyUsed,
    registeredWorkspaces,
    toggleFavorite,
    toggleGroupCollapse,
    setLayout,
    toggleSidebar,
    addToRecentlyUsed
  } = useLayoutEngine();

  const { popOutTab } = useWorkspace();
  const seefNavMode = useSEEFNavigation();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    tabId: string;
    label: string;
    icon: string;
  } | null>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClose = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, tabId: string, label: string, icon: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      tabId,
      label,
      icon
    });
  };

  const handlePopOut = (tabId: string, label: string, icon: string) => {
    popOutTab(tabId, label, icon);
    setContextMenu(null);
  };

  const handleOpenNewTab = (tabId: string) => {
    // Open in a new browser window/tab pointing to the app with that tab active
    const url = `${window.location.origin}${window.location.pathname}?tab=${tabId}`;
    window.open(url, "_blank");
    setContextMenu(null);
  };

  const [showMoreBottomMenu, setShowMoreBottomMenu] = useState(false);
  const [activeDropdownGroup, setActiveDropdownGroup] = useState<string | null>(null);
  const [activeDomain, setActiveDomain] = useState<string>("ALL");

  const handleItemClick = (id: string) => {
    onTabSelect(id);
    addToRecentlyUsed(id);
    setShowMoreBottomMenu(false);
    setActiveDropdownGroup(null);
  };

  const isWorkspaceInDomain = (workspace: { id: string; label: string; category: string }, domain: string): boolean => {
    if (domain === "ALL") return true;
    const cat = (workspace.category || "").toLowerCase();
    const id = (workspace.id || "").toLowerCase();
    const label = (workspace.label || "").toLowerCase();

    if (domain === "Sales") {
      return cat.includes("sales") || id.includes("pos") || id.includes("sales") || id.includes("billing") || label.includes("sales") || label.includes("billing");
    }
    if (domain === "Inventory") {
      return cat.includes("inventory") || cat.includes("sourcing") || id.includes("item") || id.includes("barcode") || id.includes("stock") || id.includes("warehouse") || label.includes("item") || label.includes("barcode") || label.includes("stock");
    }
    if (domain === "Purchase") {
      return cat.includes("sourcing") || id.includes("purchase") || id.includes("supplier") || label.includes("purchase") || label.includes("supplier");
    }
    if (domain === "Accounting") {
      return cat.includes("account") || id.includes("ledger") || id.includes("accounting") || label.includes("ledger") || label.includes("account");
    }
    if (domain === "CRM") {
      return id.includes("crm") || id.includes("loyalty") || id.includes("customer") || label.includes("crm") || label.includes("customer");
    }
    if (domain === "Reports") {
      return cat.includes("report") || cat.includes("operation") || id.includes("report") || id.includes("bi") || id.includes("audit") || label.includes("report") || label.includes("executive");
    }
    return true;
  };

  // Group workspaces by category
  const categories = Array.from(new Set(registeredWorkspaces.map(w => w.category)));

  const { isTabAllowed } = useAdaptiveWorkspace();

  // Filter workspaces by search term, activeDomain (WNG-004 context-aware sidebar) and Adaptive Workspace Mode
  // WNG-002: Exclude 'launchpad' — it is a top-level single-purpose screen, not a sidebar module
  const filteredWorkspaces = registeredWorkspaces.filter(w => 
    w.id !== "launchpad" &&
    isTabAllowed(w.id) &&
    isWorkspaceInDomain(w, activeDomain) && (
      w.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.category.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const isFavorited = (id: string) => preferences.favorites.includes(id);

  // Render Material Symbols Or fall back safely
  const renderIcon = (iconName: string, className = "text-xl") => {
    return <span className={`material-symbols-outlined ${className}`}>{iconName}</span>;
  };

  // 1. RENDER LEFT/RIGHT DOCK SIDEBAR NAVIGATION
  const renderSidebarNav = () => {
    const isCollapsed = preferences.collapsed || preferences.iconOnly;

    return (
      <div className="flex flex-col h-full bg-theme-surface-1 select-none text-sm border-r border-theme-divider">
        {/* Context-Aware Domain Switcher & Quick Search (WNG-004) */}
        {!isCollapsed && (
          <div className="p-3 border-b border-theme-divider/60 space-y-2 bg-theme-surface-2/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-theme-muted flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-[#0a6ed1]">hub</span> Active Domain
              </span>
              <button
                onClick={() => handleItemClick("launchpad")}
                className="text-[10px] font-bold text-[#0a6ed1] hover:underline flex items-center gap-1 cursor-pointer"
                title="Return to SMRITI Launchpad"
              >
                <span>Launchpad</span> ➜
              </button>
            </div>

            {/* Domain Switcher Selector */}
            <select
              value={activeDomain}
              onChange={(e) => setActiveDomain(e.target.value)}
              className="w-full p-1.5 text-xs bg-theme-surface-1 border border-theme-divider rounded-lg font-bold text-theme-heading focus:outline-none focus:border-[#0a6ed1] cursor-pointer"
            >
              <option value="ALL">🌐 All Business Domains</option>
              <option value="Sales">🛍️ Sales & POS Domain</option>
              <option value="Inventory">📦 Inventory & Stock Domain</option>
              <option value="Purchase">🛒 Purchase & Sourcing Domain</option>
              <option value="Accounting">💼 Accounting & Finance Domain</option>
              <option value="CRM">👥 Customer CRM & Loyalty Domain</option>
              <option value="Reports">📊 Analytics & Reports Domain</option>
            </select>

            <div className="relative pt-1">
              <span className="absolute left-2.5 top-3.5 text-theme-muted">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search domain modules..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 placeholder-[#8892a4]"
              />
              {searchTerm && (
                <button 
                  onClick={() => onSearchChange("")} 
                  className="absolute right-2.5 top-3.5 text-theme-muted hover:text-theme-body"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Content Area */}
        <SmritiScrollArea className="flex-1" fadeColorClass="from-[#16213e]">
          <div className="p-3 space-y-4">
          
          {/* Favorites Section (if not collapsed and favorites exist) */}
          {!isCollapsed && preferences.favorites.length > 0 && (
            <div className="space-y-1 animate-in fade-in duration-300">
              <span className="text-[10px] font-mono text-amber-400 font-bold tracking-wider uppercase px-2 flex items-center space-x-1">
                <Star size={10} className="fill-amber-400 text-amber-400" />
                <span>Pinned Favorites</span>
              </span>
              <div className="space-y-0.5">
                {registeredWorkspaces
                  .filter(w => isFavorited(w.id))
                  .map(w => (
                    <div
                      key={`fav-${w.id}`}
                      onClick={() => handleItemClick(w.id)}
                      onContextMenu={(e) => handleContextMenu(e, w.id, w.label, w.icon)}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between group transition-all cursor-pointer ${
                        activeTab === w.id 
                          ? "bg-[#2563EB]/20 border border-[#2563EB]/40 text-blue-400 font-medium" 
                          : "text-theme-muted hover:bg-theme-surface-3 hover:text-theme-body border border-transparent"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        {renderIcon(w.icon, `text-lg ${activeTab === w.id ? "text-blue-400" : "text-theme-muted"}`)}
                        <span className="text-xs font-display">{w.label}</span>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePopOut(w.id, w.label, w.icon); }}
                          className="p-1 rounded text-theme-muted hover:text-blue-400 hover:bg-theme-surface-2 transition-all"
                          title="Pop-out Workspace"
                        >
                          <ExternalLink size={11} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(w.id); }}
                          className="p-1 text-amber-400 hover:scale-110"
                          title="Unpin Favorite"
                        >
                          <Star size={12} className="fill-amber-400" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Categorized Workspace Menu */}
          <div className="space-y-3">
            {categories.map(cat => {
              const catWorkspaces = filteredWorkspaces.filter(w => w.category === cat);
              if (catWorkspaces.length === 0) return null;

              const isGroupCollapsed = preferences.collapsedGroups.includes(cat);

              return (
                <div key={cat} className="space-y-1">
                  {/* Category Header */}
                  {!isCollapsed ? (
                    <button
                      onClick={() => toggleGroupCollapse(cat)}
                      className="w-full text-left px-2 py-1 flex items-center justify-between text-[10px] font-mono text-theme-muted font-bold tracking-wider uppercase hover:text-theme-body"
                    >
                      <span>{cat}</span>
                      {isGroupCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </button>
                  ) : (
                    <div className="h-px bg-[#2a3a5c]/50 my-2" />
                  )}

                  {/* Category Menu Items */}
                  {(!isGroupCollapsed || isCollapsed) && (
                    <div className="space-y-0.5 animate-in fade-in duration-200">
                      {catWorkspaces.map(w => {
                        const isSel = activeTab === w.id;
                        return (
                          <div
                            key={w.id}
                            onClick={() => handleItemClick(w.id)}
                            onContextMenu={(e) => handleContextMenu(e, w.id, w.label, w.icon)}
                            title={isCollapsed ? w.label : undefined}
                            className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between group transition-all border cursor-pointer ${
                              isSel 
                                ? "bg-blue-600 border-blue-500 text-white font-semibold shadow-lg shadow-blue-950/20" 
                                : "text-theme-muted hover:bg-theme-surface-3 hover:text-white border-transparent"
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              {renderIcon(w.icon, `text-lg ${isSel ? "text-white" : "text-theme-muted group-hover:text-white"}`)}
                              {!isCollapsed && <span className="text-xs font-display">{w.label}</span>}
                            </div>
                            
                            {!isCollapsed && (
                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handlePopOut(w.id, w.label, w.icon); }}
                                  className={`p-1 rounded transition-all ${isSel ? "text-white hover:bg-blue-700" : "text-theme-muted hover:text-blue-400 hover:bg-theme-surface-2"}`}
                                  title="Pop-out Workspace"
                                >
                                  <ExternalLink size={11} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(w.id);
                                  }}
                                  className={`p-1 transition-all ${isFavorited(w.id) ? "text-amber-400" : "text-theme-muted hover:text-amber-400"}`}
                                  title={isFavorited(w.id) ? "Unpin Favorite" : "Pin to Favorites"}
                                >
                                  <Star size={11} className={isFavorited(w.id) ? "fill-amber-400 text-amber-400" : ""} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recently Used (if not collapsed) */}
          {!isCollapsed && recentlyUsed.length > 0 && (
            <div className="pt-2 border-t border-theme-divider/30 space-y-1 animate-in fade-in duration-300">
              <span className="text-[10px] font-mono text-theme-muted font-bold tracking-wider uppercase px-2 flex items-center space-x-1">
                <Clock size={10} />
                <span>Recently Opened</span>
              </span>
              <div className="space-y-0.5">
                {recentlyUsed
                  .map(id => registeredWorkspaces.find(w => w.id === id))
                  .filter((w): w is WorkspaceConfig => !!w)
                  .map(w => (
                    <div
                      key={`recent-${w.id}`}
                      onClick={() => handleItemClick(w.id)}
                      onContextMenu={(e) => handleContextMenu(e, w.id, w.label, w.icon)}
                      className={`w-full text-left px-3 py-1.5 rounded-md flex items-center justify-between group text-xs transition-colors cursor-pointer ${
                        activeTab === w.id 
                          ? "text-blue-400 font-medium bg-theme-surface-3/40" 
                          : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-3/20"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {renderIcon(w.icon, "text-sm text-theme-muted")}
                        <span className="truncate">{w.label}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handlePopOut(w.id, w.label, w.icon); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-theme-muted hover:text-blue-400 hover:bg-theme-surface-2"
                        title="Pop-out Workspace"
                      >
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Layout Controller Toolbar (Satisfies Runtime positioning adjustment) */}
          {!isCollapsed && (
            <div className="pt-3 border-t border-theme-divider/30 space-y-2">
              <span className="text-[10px] font-mono text-theme-muted font-bold tracking-wider uppercase px-2 flex items-center space-x-1">
                <SlidersHorizontal size={10} />
                <span>Layout Position</span>
              </span>
              <div className="grid grid-cols-4 gap-1 px-1">
                {(["left", "right", "top", "bottom"] as DockPosition[]).map(pos => (
                  <button
                    key={pos}
                    onClick={() => setLayout(pos)}
                    className={`py-1 text-[9px] font-mono font-bold uppercase rounded border transition-colors ${
                      preferences.position === pos 
                        ? "bg-blue-600 border-blue-500 text-white" 
                        : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-white"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SMRITI Desk Blocking warning card */}
          {!isCollapsed && (
            <div className="p-3 bg-theme-surface-3 bg-opacity-40 rounded-xl border border-theme-divider/60 text-[10px] text-theme-muted leading-relaxed space-y-1 mx-1 mt-3">
              <div className="font-bold text-theme-body uppercase tracking-wider font-display text-[9px] flex items-center space-x-1">
                <span className="material-symbols-outlined text-xs text-rose-500">security</span>
                <span>SMRITI Desk Blocking</span>
              </div>
              <p>ERP Desk accesses are locked down. Desk access strictly restricted to secure SMRITI interfaces (Rule 7).</p>
            </div>
          )}

          </div>
        </SmritiScrollArea>

        {/* Collapse Toggle Trigger */}
        <div className="p-3 border-t border-theme-divider/60 flex items-center justify-between">
          <button
            onClick={toggleSidebar}
            className="flex items-center space-x-2 text-xs font-mono font-bold text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
          >
            <ArrowLeftRight size={13} />
            {!isCollapsed && <span>Toggle Dock Width</span>}
          </button>
          
          {isCollapsed && (
            <button 
              onClick={() => setLayout("top")} 
              className="text-theme-muted hover:text-theme-body" 
              title="Switch to Top Menu"
            >
              <SlidersHorizontal size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  // 2. RENDER TOP DOCK HORIZONTAL BAR NAVIGATION (Mega Menu / Dropdowns)
  const renderTopNav = () => {
    return (
      <div className="bg-theme-surface-1 border-b border-theme-divider flex items-center justify-between px-6 py-2 select-none relative z-20">
        
        {/* Horizontal Links with Dropdowns */}
        <div className="flex items-center space-x-4">
          {categories.map(cat => {
            const catWorkspaces = filteredWorkspaces.filter(w => w.category === cat);
            if (catWorkspaces.length === 0) return null;

            const isOpen = activeDropdownGroup === cat;

            return (
              <div key={cat} className="relative">
                <button
                  onClick={() => setActiveDropdownGroup(isOpen ? null : cat)}
                  className={`px-3 py-1.5 text-xs font-display font-medium rounded-lg flex items-center space-x-1 cursor-pointer transition-colors ${
                    isOpen || catWorkspaces.some(w => w.id === activeTab)
                      ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" 
                      : "text-theme-muted hover:text-white hover:bg-theme-surface-3"
                  }`}
                >
                  <span>{cat}</span>
                  <ChevronDown size={12} className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Menu Container */}
                {isOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setActiveDropdownGroup(null)} 
                    />
                    <div className="absolute left-0 mt-2 w-56 rounded-xl bg-theme-surface-2 border border-theme-divider shadow-2xl p-2 space-y-1 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-2.5 py-1 text-[9px] font-mono text-theme-muted font-bold uppercase tracking-wider border-b border-theme-divider/40 mb-1">
                        {cat} Modules
                      </div>
                      {catWorkspaces.map(w => (
                        <button
                          key={w.id}
                          onClick={() => handleItemClick(w.id)}
                          onContextMenu={(e) => handleContextMenu(e, w.id, w.label, w.icon)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-all ${
                            activeTab === w.id 
                              ? "bg-blue-600 text-white font-medium shadow-md shadow-blue-950/20" 
                              : "text-theme-muted hover:bg-theme-surface-3 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            {renderIcon(w.icon, "text-base")}
                            <span className="text-xs font-display">{w.label}</span>
                          </div>
                          {isFavorited(w.id) && <Star size={10} className="fill-amber-400 text-amber-400" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Quick search inside Top Menu */}
          <div className="relative max-w-xs ml-4">
            <span className="absolute left-2.5 top-2 text-theme-muted"><Search size={12} /></span>
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg pl-8 pr-2 py-1 text-xs focus:outline-none focus:border-blue-500 placeholder-[#8892a4]"
            />
          </div>
        </div>

        {/* Pin shortcuts & Layout position buttons */}
        <div className="flex items-center space-x-4">
          {/* Pinned shortcuts */}
          <div className="hidden xl:flex items-center space-x-1.5 text-xs">
            <span className="text-[10px] font-mono text-theme-muted font-bold tracking-wider uppercase">PINNED:</span>
            {registeredWorkspaces
              .filter(w => isFavorited(w.id))
              .slice(0, 4)
              .map(w => (
                <button
                  key={`top-fav-${w.id}`}
                  onClick={() => handleItemClick(w.id)}
                  onContextMenu={(e) => handleContextMenu(e, w.id, w.label, w.icon)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1 transition-all ${
                    activeTab === w.id 
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold" 
                      : "text-theme-muted hover:text-white hover:bg-theme-surface-3"
                  }`}
                >
                  {renderIcon(w.icon, "text-xs")}
                  <span>{w.label}</span>
                </button>
              ))}
          </div>

          {/* Dock layout switch panel */}
          <div className="flex items-center space-x-1 border-l border-theme-divider pl-4">
            <span className="text-[9px] font-mono text-theme-muted font-bold mr-1.5">DOCK:</span>
            {(["left", "right", "top", "bottom"] as DockPosition[]).map(pos => (
              <button
                key={pos}
                onClick={() => setLayout(pos)}
                className={`px-2 py-1 text-[9px] font-mono font-bold uppercase rounded border transition-colors ${
                  preferences.position === pos 
                    ? "bg-blue-600 border-blue-500 text-white" 
                    : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-white"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 3. RENDER BOTTOM DOCK NAVIGATION (Optimized for Mobile / Touch / Tablet)
  const renderBottomNav = () => {
    // Show 4 core items + a More button
    const coreItems = [
      { id: "dashboard", label: "Dashboard", icon: "dashboard" },
      { id: "pos", label: "POS Billing", icon: "point_of_sale" },
      { id: "sales", label: "Sales", icon: "receipt_long" },
      { id: "item-master", label: "Items", icon: "inventory_2" }
    ];

    return (
      <div className="bg-theme-surface-1 border-t border-theme-divider h-16 w-full flex items-center justify-around px-2 py-1 select-none sticky bottom-0 z-30">
        {coreItems.map(item => {
          const isSel = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`flex-1 py-1 flex flex-col items-center justify-center space-y-1 transition-all ${
                isSel ? "text-blue-400 font-bold" : "text-theme-muted hover:text-theme-body"
              }`}
            >
              {renderIcon(item.icon, `text-xl ${isSel ? "text-blue-400 scale-110" : ""}`)}
              <span className="text-[10px] font-display truncate">{item.label}</span>
            </button>
          );
        })}

        {/* More Options Menu button */}
        <button
          onClick={() => setShowMoreBottomMenu(true)}
          className={`flex-1 py-1 flex flex-col items-center justify-center space-y-1 text-theme-muted hover:text-theme-body`}
        >
          <Menu size={20} />
          <span className="text-[10px] font-display">More Modules</span>
        </button>

        {/* Mobile/Touch More Drawer Backdrop Overlay */}
        {showMoreBottomMenu && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end">
            <div className="absolute inset-0" onClick={() => setShowMoreBottomMenu(false)} />
            
            {/* Slide-up drawer */}
            <div className="relative bg-theme-surface-2 border-t border-theme-divider rounded-t-2xl max-h-[85vh] overflow-y-auto p-5 space-y-6 z-50 animate-in slide-in-from-bottom duration-250">
              <div className="flex items-center justify-between border-b border-theme-divider pb-3">
                <div>
                  <h4 className="font-display font-bold text-sm text-theme-body">SMRITI Navigation Ledger</h4>
                  <p className="text-[10px] text-theme-muted">All operational suites and customization parameters</p>
                </div>
                <button 
                  onClick={() => setShowMoreBottomMenu(false)} 
                  className="p-1 rounded-full bg-theme-surface-1 text-theme-muted hover:text-theme-body"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Categorized list in Mobile Drawer */}
              <div className="space-y-4">
                {categories.map(cat => {
                  const items = registeredWorkspaces.filter(w => w.category === cat);
                  return (
                    <div key={`bottom-drawer-cat-${cat}`} className="space-y-2">
                      <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider block">
                        {cat}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {items.map(w => (
                          <button
                            key={`bottom-drawer-item-${w.id}`}
                            onClick={() => handleItemClick(w.id)}
                            className={`p-3 rounded-xl border flex flex-col items-start space-y-2 transition-all ${
                              activeTab === w.id 
                                ? "bg-blue-600 border-blue-500 text-white font-bold" 
                                : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:text-white"
                            }`}
                          >
                            {renderIcon(w.icon, `text-xl ${activeTab === w.id ? "text-white" : "text-theme-muted"}`)}
                            <span className="text-xs font-display font-medium text-left">{w.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Layout controls inside mobile menu */}
              <div className="pt-4 border-t border-theme-divider/60 space-y-2.5">
                <span className="text-[10px] font-mono text-theme-muted font-bold uppercase tracking-wider block">
                  Workspace Layout Docking
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {(["left", "right", "top", "bottom"] as DockPosition[]).map(pos => (
                    <button
                      key={`bot-pos-${pos}`}
                      onClick={() => { setLayout(pos); setShowMoreBottomMenu(false); }}
                      className={`py-2 text-[10px] font-mono font-bold uppercase rounded-lg border transition-colors ${
                        preferences.position === pos 
                          ? "bg-blue-600 border-blue-500 text-white" 
                          : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:text-white"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── 4. RENDER MEGA-MENU NAVIGATION ─────────────────────────────────────
  // Full-screen glassmorphic overlay triggered by a 56px hamburger trigger strip.
  // Module grid grouped by category. ESC, backdrop-click, and re-click close it.
  // seefNavMode === "mega-menu" → DockManager allocates 0px sidebar slot (handled
  // by renderLeftDockLayout falling through — mega-menu owns its own fixed overlay).
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [megaSearchTerm, setMegaSearchTerm] = useState("");

  // ESC key closes the mega-menu
  useEffect(() => {
    if (!megaMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMegaMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [megaMenuOpen]);

  const megaFilteredWorkspaces = registeredWorkspaces.filter(w =>
    w.id !== "launchpad" &&
    isTabAllowed(w.id) && (
      megaSearchTerm === "" ||
      w.label.toLowerCase().includes(megaSearchTerm.toLowerCase()) ||
      w.category.toLowerCase().includes(megaSearchTerm.toLowerCase())
    )
  );
  const megaCategories = Array.from(new Set(megaFilteredWorkspaces.map(w => w.category)));
  const megaFavorites  = megaFilteredWorkspaces.filter(w => preferences.favorites.includes(w.id));

  const renderMegaMenuNav = () => {
    return (
      <>
        {/* Persistent 56px trigger strip — always visible in mega-menu mode */}
        <div className="h-full w-14 bg-theme-surface-1 border-r border-theme-divider flex flex-col items-center py-3 gap-3 select-none z-10 flex-shrink-0">
          {/* Hamburger toggle */}
          <button
            onClick={() => { setMegaMenuOpen(v => !v); setMegaSearchTerm(""); }}
            title={megaMenuOpen ? "Close Menu (Esc)" : "Open Module Menu"}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              megaMenuOpen
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                : "bg-theme-surface-2 text-theme-muted hover:bg-blue-600/10 hover:text-blue-400 border border-theme-divider"
            }`}
          >
            {megaMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Active module indicator strip */}
          <div className="w-px flex-1 bg-theme-divider/40 mx-auto" />
          {/* Quick-access: recently active module icon */}
          {registeredWorkspaces.filter(w => w.id === activeTab && w.id !== "launchpad").map(w => (
            <button
              key={w.id}
              onClick={() => handleItemClick(w.id)}
              title={w.label}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600/10 text-blue-400 border border-blue-500/20 cursor-pointer"
            >
              {renderIcon(w.icon, "text-lg")}
            </button>
          ))}
        </div>

        {/* Full-screen mega-menu overlay */}
        {megaMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40"
              onClick={() => setMegaMenuOpen(false)}
            />

            {/* Overlay panel */}
            <div className="fixed inset-0 z-50 flex flex-col pointer-events-none">
              <div className="flex-1 overflow-y-auto pointer-events-auto p-8 max-w-6xl mx-auto w-full">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white font-display tracking-tight flex items-center gap-3">
                      <Layers className="text-blue-400" size={24} />
                      SMRITI Workspace
                    </h2>
                    <p className="text-xs text-theme-muted mt-1">Select a module to open — all access governed by RBAC</p>
                  </div>
                  <button
                    onClick={() => setMegaMenuOpen(false)}
                    className="w-10 h-10 rounded-xl bg-theme-surface-2/80 hover:bg-theme-surface-3 border border-theme-divider text-theme-muted hover:text-white flex items-center justify-center transition-all cursor-pointer"
                    title="Close (Esc)"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-8 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" size={15} />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search modules..."
                    value={megaSearchTerm}
                    onChange={e => setMegaSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-theme-surface-2/80 border border-theme-divider rounded-xl text-sm text-theme-body placeholder-theme-muted focus:outline-none focus:border-blue-500 focus:bg-theme-surface-2 transition-all"
                  />
                </div>

                {/* Favorites row */}
                {megaFavorites.length > 0 && megaSearchTerm === "" && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">Pinned Favorites</span>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {megaFavorites.map(w => (
                        <button
                          key={w.id}
                          onClick={() => { handleItemClick(w.id); setMegaMenuOpen(false); }}
                          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                            activeTab === w.id
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30"
                              : "bg-theme-surface-2/70 border-theme-divider text-theme-body hover:bg-blue-600/10 hover:border-blue-500/40 hover:text-blue-300"
                          }`}
                        >
                          {renderIcon(w.icon, "text-base")}
                          <span className="font-display">{w.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category grids */}
                {megaCategories.length === 0 ? (
                  <div className="text-center text-theme-muted py-16 text-sm">
                    No modules match &ldquo;{megaSearchTerm}&rdquo;
                  </div>
                ) : (
                  <div className="space-y-8">
                    {megaCategories.map(cat => {
                      const catModules = megaFilteredWorkspaces.filter(w => w.category === cat);
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[9px] font-mono font-bold text-theme-muted uppercase tracking-widest">{cat}</span>
                            <div className="flex-1 h-px bg-theme-divider/30" />
                            <span className="text-[9px] font-mono text-theme-muted/60">{catModules.length} modules</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {catModules.map(w => (
                              <button
                                key={w.id}
                                onClick={() => { handleItemClick(w.id); setMegaMenuOpen(false); }}
                                className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer text-center ${
                                  activeTab === w.id
                                    ? "bg-blue-600/15 border-blue-500/40 shadow-lg shadow-blue-950/20"
                                    : "bg-theme-surface-2/60 border-theme-divider/60 hover:bg-theme-surface-2 hover:border-theme-divider hover:shadow-lg"
                                }`}
                              >
                                {/* Active indicator dot */}
                                {activeTab === w.id && (
                                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
                                )}
                                {/* Favorite star */}
                                {isFavorited(w.id) && activeTab !== w.id && (
                                  <Star size={9} className="absolute top-2 right-2 fill-amber-400 text-amber-400" />
                                )}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                  activeTab === w.id
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                                    : "bg-theme-surface-3 text-theme-muted group-hover:bg-blue-600/10 group-hover:text-blue-400"
                                } transition-all`}>
                                  {renderIcon(w.icon, "text-lg")}
                                </div>
                                <span className={`text-xs font-display font-medium leading-tight ${
                                  activeTab === w.id ? "text-blue-300" : "text-theme-body"
                                }`}>{w.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </>
    );
  };

  // 5. RENDER RAIL NAVIGATION (48 px icon-only rail — SEEF navMode: "rail")
  // Inspired by VS Code Activity Bar & SAP Fiori Side Navigation compact mode.
  // Rail items show a floating tooltip label on hover. Active item highlighted
  // with an accent-color left bar indicator.
  const renderRailNav = () => {
    // Group by category; show a divider between groups
    const groupedEntries: Array<{ type: "divider"; label: string } | { type: "item"; ws: WorkspaceConfig }> = [];
    const visitedCats = new Set<string>();

    filteredWorkspaces.forEach(ws => {
      if (!visitedCats.has(ws.category)) {
        if (visitedCats.size > 0) {
          groupedEntries.push({ type: "divider", label: ws.category });
        }
        visitedCats.add(ws.category);
      }
      groupedEntries.push({ type: "item", ws });
    });

    // Favorites shown at top (pinned rail)
    const favItems = registeredWorkspaces.filter(w => isFavorited(w.id));

    return (
      <div
        style={{
          width: 48,
          minWidth: 48,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--c-theme-surface-1)",
          borderRight: "1px solid var(--c-theme-divider)",
          overflowY: "auto",
          overflowX: "hidden",
          userSelect: "none",
        }}
      >
        {/* Favorites pinned at top */}
        {favItems.length > 0 && (
          <>
            {favItems.map(ws => (
              <RailItem
                key={`rail-fav-${ws.id}`}
                ws={ws}
                isActive={activeTab === ws.id}
                isFav={true}
                onSelect={handleItemClick}
                onContextMenu={handleContextMenu}
                renderIcon={renderIcon}
              />
            ))}
            {/* Divider after favorites */}
            <div style={{
              height: 1,
              background: "var(--c-theme-divider)",
              margin: "4px 8px",
            }} />
          </>
        )}

        {/* All workspace items grouped */}
        {groupedEntries.map((entry, idx) => {
          if (entry.type === "divider") {
            return (
              <div
                key={`rail-div-${idx}`}
                title={entry.label}
                style={{
                  height: 1,
                  background: "var(--c-theme-divider)",
                  margin: "4px 8px",
                }}
              />
            );
          }
          const { ws } = entry;
          const alreadyInFav = isFavorited(ws.id) && favItems.length > 0;
          if (alreadyInFav) return null; // deduplicate
          return (
            <RailItem
              key={`rail-${ws.id}`}
              ws={ws}
              isActive={activeTab === ws.id}
              isFav={false}
              onSelect={handleItemClick}
              onContextMenu={handleContextMenu}
              renderIcon={renderIcon}
            />
          );
        })}

        {/* Spacer pushes collapse toggle to bottom */}
        <div style={{ flex: 1 }} />

        {/* Collapse → switch back to sidebar button */}
        <button
          onClick={toggleSidebar}
          title="Expand Sidebar"
          style={{
            width: 48,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--c-theme-muted)",
            borderTop: "1px solid var(--c-theme-divider)",
            flexShrink: 0,
          }}
          className="seef-interactive seef-focus-ring"
        >
          <ArrowLeftRight size={14} />
        </button>
      </div>
    );
  };

  // Render the matching layout — SEEF navMode takes priority over dock position
  const renderedLayout = () => {
    // SEEF navMode overrides (when explicitly configured via SEEF Admin Configurator)
    if (seefNavMode === "mega-menu") return renderMegaMenuNav();
    if (seefNavMode === "rail")      return renderRailNav();
    if (seefNavMode === "top-nav")   return renderTopNav();   // FIX: was "top-bar"
    // Fall back to dock-position-based rendering (existing behavior)
    if (preferences.position === "top")    return renderTopNav();
    if (preferences.position === "bottom") return renderBottomNav();
    return renderSidebarNav();
  };

  return (
    <>
      {renderedLayout()}
      
      {/* Sidebar Right-Click Context Menu */}
      {contextMenu && contextMenu.visible && (
        <div 
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x,
            position: 'fixed'
          }}
          className="bg-theme-surface-2 border border-theme-divider shadow-2xl rounded-xl p-1.5 min-w-[200px] z-[9999] animate-in fade-in zoom-in-95 duration-100 flex flex-col space-y-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[9px] font-mono text-theme-muted font-bold uppercase tracking-wider border-b border-theme-divider/40 mb-1 flex items-center space-x-1.5">
            {renderIcon(contextMenu.icon, "text-xs text-theme-muted")}
            <span className="truncate">{contextMenu.label} Actions</span>
          </div>

          <button
            onClick={() => {
              handleItemClick(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center space-x-2 text-xs text-theme-muted hover:text-white hover:bg-theme-surface-3 transition-colors"
          >
            <Play size={12} className="text-emerald-500" />
            <span>Open Normally</span>
          </button>

          <button
            onClick={() => {
              handlePopOut(contextMenu.tabId, contextMenu.label, contextMenu.icon);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center space-x-2 text-xs text-theme-muted hover:text-white hover:bg-theme-surface-3 transition-colors"
          >
            <ExternalLink size={12} className="text-blue-400" />
            <span>Open in Floating Window</span>
          </button>

          <button
            onClick={() => {
              // Creating a new workspace is the same as popping out a tab
              handlePopOut(contextMenu.tabId, contextMenu.label, contextMenu.icon);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center space-x-2 text-xs text-theme-muted hover:text-white hover:bg-theme-surface-3 transition-colors"
          >
            <Maximize size={12} className="text-purple-400" />
            <span>Open in New Workspace</span>
          </button>

          <button
            onClick={() => handleOpenNewTab(contextMenu.tabId)}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center space-x-2 text-xs text-theme-muted hover:text-white hover:bg-theme-surface-3 transition-colors"
          >
            <ExternalLink size={12} className="text-amber-400" />
            <span>Open in New Browser Tab</span>
          </button>
        </div>
      )}
    </>
  );
};

// ── RailItem ──────────────────────────────────────────────────────────────────
// 48px rail button with a floating label tooltip on hover.
// Active state: 3px accent left-bar + accent background tint.
// Tooltip appears to the right of the rail (left: 52px).

interface RailItemProps {
  ws: WorkspaceConfig;
  isActive: boolean;
  isFav: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, label: string, icon: string) => void;
  renderIcon: (name: string, cls?: string) => React.ReactNode;
}

const RailItem: React.FC<RailItemProps> = ({
  ws, isActive, isFav, onSelect, onContextMenu, renderIcon
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: "relative", flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => onSelect(ws.id)}
        onContextMenu={(e) => onContextMenu(e, ws.id, ws.label, ws.icon)}
        title={ws.label}
        style={{
          width: 48,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isActive ? "rgba(26,115,232,0.12)" : "none",
          border: "none",
          borderLeft: isActive
            ? "3px solid var(--c-seef-accent)"
            : "3px solid transparent",
          cursor: "pointer",
          color: isActive ? "var(--c-seef-accent)" : "var(--c-theme-muted)",
          transition: "all var(--seef-motion-fast) var(--seef-ease-standard)",
          position: "relative",
          flexShrink: 0,
        }}
        className="seef-focus-ring"
      >
        {renderIcon(ws.icon, `text-xl ${isActive ? "text-blue-400" : "text-theme-muted"}`)}

        {/* Favorite star badge */}
        {isFav && (
          <span style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#f59e0b",
          }} />
        )}
      </button>

      {/* Hover tooltip: label floats to the right of the rail */}
      {hovered && (
        <div
          style={{
            position: "fixed",
            left: 56,
            top: "inherit",
            transform: "translateY(-50%)",
            background: "var(--c-theme-surface-2)",
            border: "1px solid var(--c-theme-divider)",
            borderRadius: "var(--seef-radius-active-md)",
            padding: "4px 10px",
            fontSize: "var(--seef-font-size-xs)",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            color: "var(--c-theme-body)",
            boxShadow: "var(--seef-elevation-3)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 9000,
          }}
        >
          {ws.label}
        </div>
      )}
    </div>
  );
};
