/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { 
  Package, 
  Settings, 
  Settings2, 
  Layers, 
  ClipboardPaste, 
  Database,
  Search, 
  FileSpreadsheet
} from "lucide-react";
import { Product } from "../../types.ts";
import { SmritiItemDetailsGrid } from "./SmritiItemDetailsGrid.tsx";
import { SmritiViewConfiguration, ViewConfigState } from "./SmritiViewConfiguration.tsx";
import { SmritiItemMasterStudio } from "./SmritiItemMasterStudio.tsx";
import { SmritiAttributeManagementStudio } from "./SmritiAttributeManagementStudio.tsx";
import { SmritiImagePathConfigStudio } from "./SmritiImagePathConfigStudio.tsx";
import { VariantTemplateSection } from "../VariantTemplateSection.tsx";

interface SmritiItemMasterWorkspaceProps {
  products?: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
  onClose?: () => void;
}

type WorkspaceNavTab = "item_details" | "view_config" | "imports" | "attributes" | "image_config" | "variants";

export const SmritiItemMasterWorkspace: React.FC<SmritiItemMasterWorkspaceProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser,
  onClose
}) => {
  const [activeNav, setActiveNav] = useState<WorkspaceNavTab>("item_details");

  const [viewConfig, setViewConfig] = useState<ViewConfigState>({
    viewMode: "grid",
    visibleColumns: [
      "code", "barcode", "name", "brand", "styleCode", "colour", "size",
      "mrp", "price", "gst_percentage", "hsn_code",
      "a1", "a2", "a3", "a4", "a5"
    ],
    frozenColumns: 2
  });

  const handleNotify = onNotification || (() => {});
  const handleRefresh = onRefreshProducts || (async () => {});

  // Global Alt+1, Alt+2, Alt+3 tab switching
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "1") {
        e.preventDefault();
        setActiveNav("view_config");
      } else if (e.altKey && e.key === "2") {
        e.preventDefault();
        setActiveNav("item_details");
      } else if (e.altKey && e.key === "3") {
        e.preventDefault();
        setActiveNav("imports");
      } else if (e.altKey && e.key === "4") {
        e.preventDefault();
        setActiveNav("attributes");
      } else if (e.altKey && e.key === "5") {
        e.preventDefault();
        setActiveNav("image_config");
      } else if (e.altKey && e.key === "6") {
        e.preventDefault();
        setActiveNav("variants");
      }
    };
    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, []);

  return (
    <div className="bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] h-screen w-full overflow-hidden flex font-sans select-none antialiased">
      
      {/* ── Left SideNavBar Matching Itemmaster3 ─────────────────────────── */}
      <nav className="bg-[#f1f3ff] dark:bg-[#131b2e] text-[#051a3e] dark:text-[#eff1f3] w-64 h-screen border-r border-[#c3c6d6] dark:border-[#434654] flex flex-col py-4 px-3 shrink-0 z-20 shadow-xs">
        
        {/* Brand Title */}
        <div className="mb-6 px-3">
          <h2 className="text-lg font-bold text-[#003d9b] dark:text-[#b2c5ff] tracking-tight flex items-center gap-2">
            Item Master
          </h2>
          <p className="text-xs text-[#535f73] dark:text-[#bec6e0] font-medium mt-0.5">
            Management System
          </p>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="flex-1 space-y-1">
          <button
            type="button"
            onClick={() => setActiveNav("item_details")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
              activeNav === "item_details"
                ? "bg-[#d4e0f8] dark:bg-[#0052cc] text-[#051a3e] dark:text-white shadow-xs"
                : "text-[#535f73] dark:text-[#bec6e0] hover:bg-[#e1e8ff] dark:hover:bg-[#1d3054]"
            }`}
          >
            <Package size={17} />
            <span>Item Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav("view_config")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
              activeNav === "view_config"
                ? "bg-[#d4e0f8] dark:bg-[#0052cc] text-[#051a3e] dark:text-white shadow-xs"
                : "text-[#535f73] dark:text-[#bec6e0] hover:bg-[#e1e8ff] dark:hover:bg-[#1d3054]"
            }`}
          >
            <Settings2 size={17} />
            <span>View Configuration</span>
          </button>

          <div className="pt-2 pb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#737685] px-3">
              Tools &amp; Catalogs
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveNav("imports")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              activeNav === "imports"
                ? "bg-[#d4e0f8] dark:bg-[#0052cc] text-[#051a3e] dark:text-white shadow-xs"
                : "text-[#535f73] dark:text-[#bec6e0] hover:bg-[#e1e8ff] dark:hover:bg-[#1d3054]"
            }`}
          >
            <ClipboardPaste size={15} />
            <span>Imports &amp; Bulk Paste</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav("attributes")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              activeNav === "attributes"
                ? "bg-[#d4e0f8] dark:bg-[#0052cc] text-[#051a3e] dark:text-white shadow-xs"
                : "text-[#535f73] dark:text-[#bec6e0] hover:bg-[#e1e8ff] dark:hover:bg-[#1d3054]"
            }`}
          >
            <Database size={15} />
            <span>Attributes Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav("image_config")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              activeNav === "image_config"
                ? "bg-[#d4e0f8] dark:bg-[#0052cc] text-[#051a3e] dark:text-white shadow-xs"
                : "text-[#535f73] dark:text-[#bec6e0] hover:bg-[#e1e8ff] dark:hover:bg-[#1d3054]"
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>Image Path Config</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav("variants")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              activeNav === "variants"
                ? "bg-[#d4e0f8] dark:bg-[#0052cc] text-[#051a3e] dark:text-white shadow-xs"
                : "text-[#535f73] dark:text-[#bec6e0] hover:bg-[#e1e8ff] dark:hover:bg-[#1d3054]"
            }`}
          >
            <Layers size={15} />
            <span>Variant Templates</span>
          </button>
        </div>

        {/* User Card at bottom */}
        <div className="mt-auto border-t border-[#c3c6d6] dark:border-[#434654] pt-3 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#dae2ff] text-[#001848] font-bold text-xs flex items-center justify-center">
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "AD"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-[#051a3e] dark:text-white truncate">
                {currentUser?.name || "System Admin"}
              </p>
              <p className="text-[10px] text-[#535f73] dark:text-[#bec6e0] truncate">
                {currentUser?.role || "ERP-001"}
              </p>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Canvas (Top Header + Active Sub-Module) ──────────────────── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        
        {/* Top Header Bar */}
        <header className="bg-white dark:bg-[#131b2e] h-14 border-b border-[#c3c6d6] dark:border-[#434654] flex items-center justify-between px-6 shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#051a3e] dark:text-white">
              Item Master Entry
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 bg-[#e9edff] dark:bg-[#1d3054] text-[#003d9b] dark:text-[#b2c5ff] font-mono text-[11px] font-bold rounded">
              {products.length} Items Live
            </span>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 border border-[#c3c6d6] text-xs font-semibold hover:bg-[#eceef0] rounded transition"
              >
                Close
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Workspace Canvas */}
        <main className="flex-1 overflow-hidden min-h-0 bg-[#faf9ff] dark:bg-[#191c1e]">
          {activeNav === "item_details" && (
            <SmritiItemDetailsGrid
              products={products}
              viewConfig={viewConfig}
              onRefreshProducts={handleRefresh}
              onNotification={handleNotify}
              onNavigateToViewConfig={() => setActiveNav("view_config")}
            />
          )}

          {activeNav === "view_config" && (
            <SmritiViewConfiguration
              currentConfig={viewConfig}
              onSaveConfig={(cfg) => {
                setViewConfig(cfg);
                setActiveNav("item_details");
              }}
              onNotification={handleNotify}
            />
          )}

          {activeNav === "imports" && (
            <SmritiItemMasterStudio
              onRefreshProducts={handleRefresh}
              onNotification={handleNotify}
              currentUser={currentUser}
              onCancel={() => setActiveNav("item_details")}
            />
          )}

          {activeNav === "attributes" && (
            <SmritiAttributeManagementStudio
              onNotification={handleNotify}
            />
          )}

          {activeNav === "image_config" && (
            <SmritiImagePathConfigStudio
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
