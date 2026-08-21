/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.7.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { 
  Package, 
  Database, 
  Layers, 
  ClipboardPaste, 
  Search, 
  Bell, 
  HelpCircle 
} from "lucide-react";
import { Product, AttributeDefinition, AttributeGroup } from "../../types.ts";
import { SmritiItemMasterStudio } from "./SmritiItemMasterStudio.tsx";
import { SmritiAttributeManagementStudio } from "./SmritiAttributeManagementStudio.tsx";
import { SmritiItemCatalogGrid } from "./SmritiItemCatalogGrid.tsx";
import { VariantTemplateSection } from "../VariantTemplateSection.tsx";

interface SmritiItemMasterWorkspaceProps {
  products?: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
  onClose?: () => void;
}

type WorkspaceNavTab = "items" | "imports" | "attributes" | "variants";

export const SmritiItemMasterWorkspace: React.FC<SmritiItemMasterWorkspaceProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser,
  onClose
}) => {
  const [activeNav, setActiveNav] = useState<WorkspaceNavTab>("items");
  const [globalSearch, setGlobalSearch] = useState<string>("");

  const handleNotify = onNotification || (() => {});
  const handleRefresh = onRefreshProducts || (async () => {});

  return (
    <div className="bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] h-screen w-full overflow-hidden flex font-sans select-none antialiased">
      
      {/* ── Left Fixed SideNavBar ────────────────────────────────────────── */}
      <nav className="bg-[#131b2e] text-white w-[240px] h-screen border-r border-[#45464d] flex flex-col p-4 z-20 shrink-0 shadow-lg">
        
        {/* Brand Header */}
        <div className="mb-6 px-2">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            SMRITI
          </h1>
          <p className="text-[11px] text-[#bec6e0] font-medium mt-0.5 opacity-80">
            Attribute &amp; Item Engine
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-1 space-y-1.5">
          <button
            type="button"
            onClick={() => setActiveNav("items")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
              activeNav === "items"
                ? "bg-[#d5e3fd] text-[#0d1c2f] shadow-sm"
                : "text-[#bec6e0] hover:bg-[#191c1e] hover:text-white"
            }`}
          >
            <Package size={16} />
            <span>Item Master Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav("imports")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
              activeNav === "imports"
                ? "bg-[#d5e3fd] text-[#0d1c2f] shadow-sm"
                : "text-[#bec6e0] hover:bg-[#191c1e] hover:text-white"
            }`}
          >
            <ClipboardPaste size={16} />
            <span>Imports &amp; Bulk Paste</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav("attributes")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
              activeNav === "attributes"
                ? "bg-[#d5e3fd] text-[#0d1c2f] shadow-sm"
                : "text-[#bec6e0] hover:bg-[#191c1e] hover:text-white"
            }`}
          >
            <Database size={16} />
            <span>Attributes Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav("variants")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
              activeNav === "variants"
                ? "bg-[#d5e3fd] text-[#0d1c2f] shadow-sm"
                : "text-[#bec6e0] hover:bg-[#191c1e] hover:text-white"
            }`}
          >
            <Layers size={16} />
            <span>Variant Templates</span>
          </button>
        </div>

        {/* User Card at bottom */}
        <div className="mt-auto border-t border-[#45464d] pt-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#d5e3fd] text-[#0d1c2f] font-bold text-xs flex items-center justify-center">
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "AD"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">
                {currentUser?.name || "Administrator"}
              </p>
              <p className="text-[10px] text-[#bec6e0] truncate">
                {currentUser?.role || "System Admin"}
              </p>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Canvas (Top Header + Dynamic View) ──────────────────────── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        
        {/* Top Header Bar */}
        <header className="bg-white dark:bg-[#131b2e] h-14 border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between px-6 shrink-0 shadow-xs z-10">
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#191c1e] dark:text-white">
              Attribute Management Engine
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 bg-[#e0e3e5] dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] font-mono text-[10px] font-bold rounded">
              {products.length} Products Active
            </span>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 border border-[#c6c6cd] text-xs font-semibold hover:bg-[#eceef0] rounded transition"
              >
                Close
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Workspace Canvas */}
        <main className="flex-1 overflow-hidden min-h-0 bg-[#f7f9fb] dark:bg-[#191c1e]">
          {activeNav === "items" && (
            <SmritiItemCatalogGrid
              products={products}
              onRefreshProducts={handleRefresh}
              onNotification={handleNotify}
              onNavigateToPaste={() => setActiveNav("imports")}
            />
          )}

          {activeNav === "imports" && (
            <SmritiItemMasterStudio
              onRefreshProducts={handleRefresh}
              onNotification={handleNotify}
              currentUser={currentUser}
              onCancel={() => setActiveNav("items")}
            />
          )}

          {activeNav === "attributes" && (
            <SmritiAttributeManagementStudio
              onNotification={handleNotify}
            />
          )}

          {activeNav === "variants" && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar">
              <VariantTemplateSection
                products={products}
                onRefreshProducts={handleRefresh}
                onNotification={handleNotify}
              />
            </div>
          )}
        </main>
      </div>

    </div>
  );
};

export default SmritiItemMasterWorkspace;
