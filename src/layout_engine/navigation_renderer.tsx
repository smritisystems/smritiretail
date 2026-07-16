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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
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

  const handleItemClick = (id: string) => {
    onTabSelect(id);
    addToRecentlyUsed(id);
    setShowMoreBottomMenu(false);
    setActiveDropdownGroup(null);
  };

  // Group workspaces by category
  const categories = Array.from(new Set(registeredWorkspaces.map(w => w.category)));

  // Filter workspaces by search term
  const filteredWorkspaces = registeredWorkspaces.filter(w => 
    w.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.category.toLowerCase().includes(searchTerm.toLowerCase())
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
        {/* Workspace Quick Search (Satisfies Global Search & Workspace Toolbar requirements) */}
        {!isCollapsed && (
          <div className="p-3 border-b border-theme-divider/60">
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-theme-muted">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Quick Workspace Search..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 placeholder-[#8892a4]"
              />
              {searchTerm && (
                <button 
                  onClick={() => onSearchChange("")} 
                  className="absolute right-2.5 top-2.5 text-theme-muted hover:text-theme-body"
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

  // Render the matching layout
  const renderedLayout = () => {
    if (preferences.position === "top") return renderTopNav();
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
