/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.69.0
 * Created      : 2026-08-21
 * Modified     : 2026-10-04
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
  FileSpreadsheet,
  Menu,
  X,
  Hash,
  Replace,
} from "lucide-react";
import { Product } from "../../types.ts";
import { ItemCatalogGrid } from "./ItemCatalogGrid.tsx";
import { AddProductDrawer } from "./AddProductDrawer.tsx";
import { ItemDetailsGrid } from "./ItemDetailsGrid.tsx";
import { ItemViewConfig, ItemViewConfigState } from "./ItemViewConfig.tsx";
import { ItemMasterStudio } from "./ItemMasterStudio.tsx";
import { AttrMgmtStudio } from "./AttrMgmtStudio.tsx";
import { ImgPathStudio } from "./ImgPathStudio.tsx";
import { CodeSelectDlg } from "./CodeSelectDlg.tsx";
import { ReplaceDataDlg } from "./ReplaceDataDlg.tsx";
import { VariantTplSec } from "../VariantTemplateSec.tsx";
import { hydrateRoleGlobalFieldVisibility } from "../../services/unifiedFieldCatalog.ts";
import { BulkImportSection } from "../BulkImportSection.tsx";

interface SmritiItemMasterWorkspaceProps {
  products?: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  currentUser?: { role: string; name: string } | null;
  initialSubTab?: string;
  onClose?: () => void;
}

type WorkspaceNavTab = "catalog" | "spreadsheet" | "view_config" | "imports" | "bulk_sheet" | "attributes" | "image_config" | "variants";

export const ItemMasterWs: React.FC<SmritiItemMasterWorkspaceProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser,
  initialSubTab,
  onClose
}) => {
  const [activeNav, setActiveNav] = useState<WorkspaceNavTab>(() => {
    if (initialSubTab === "excel-grid" || initialSubTab === "spreadsheet") {
      return "spreadsheet";
    }
    return "catalog";
  });
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCodeSelectDlg, setShowCodeSelectDlg] = useState(false);
  const [showReplaceDataDlg, setShowReplaceDataDlg] = useState(false);
  const [adaptiveMode, setAdaptiveMode] = useState<"SIMPLE" | "HYBRID" | "ADVANCED">(() => {
    return (localStorage.getItem("smriti_article_mode") as any) || "HYBRID";
  });

  const handleSelectAdaptiveMode = (mode: "SIMPLE" | "HYBRID" | "ADVANCED") => {
    setAdaptiveMode(mode);
    try {
      localStorage.setItem("smriti_article_mode", mode);
    } catch {
      // storage unavailable
    }
    handleNotify("Adaptive Mode", `Switched to ${mode} mode.`, "info");
  };

  const [viewConfig, setItemViewConfig] = useState<ItemViewConfigState>({
    viewMode: "grid",
    visibleColumns: [
      "code", "barcode", "name", "brand", "styleCode", "colour", "size",
      "buyingPrice", "mrp", "price", "costPrice", "gst_percentage", "hsn_code",
      "a1", "a2", "a3", "a4", "a5"
    ],
    frozenColumns: 2
  });

  const handleNotify = onNotification || (() => {});
  const handleRefresh = onRefreshProducts || (async () => {});

  // Global Alt+1, Alt+2, Alt+3 tab switching
  useEffect(() => {
    void hydrateRoleGlobalFieldVisibility(currentUser?.role);
  }, [currentUser?.role]);

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "1") {
        e.preventDefault();
        setActiveNav("catalog");
      } else if (e.altKey && e.key === "2") {
        e.preventDefault();
        setActiveNav("spreadsheet");
      } else if (e.altKey && e.key === "3") {
        e.preventDefault();
        setActiveNav("view_config");
      } else if (e.altKey && e.key === "4") {
        e.preventDefault();
        setActiveNav("imports");
      } else if (e.altKey && e.key === "5") {
        e.preventDefault();
        setActiveNav("attributes");
      } else if (e.altKey && e.key === "6") {
        e.preventDefault();
        setActiveNav("image_config");
      } else if (e.altKey && e.key === "7") {
        e.preventDefault();
        setActiveNav("variants");
      }
    };
    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, []);

  return (
    <div className="bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] h-screen w-full overflow-hidden flex font-sans select-none antialiased relative">
      
      {/* ── Mobile Sidebar Overlay Backdrop (VIS-MOB-01 / VIS-TAB-02 fix) ── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Left SideNavBar Matching Itemmaster3 ─────────────────────────── */}
      <nav
        className={`bg-[#f1f3ff] dark:bg-[#131b2e] text-[#051a3e] dark:text-[#eff1f3] w-64 h-screen border-r border-[#c3c6d6] dark:border-[#434654] flex flex-col py-4 px-3 shrink-0 z-40 shadow-xs transition-transform duration-200 ${
          isSidebarOpen
            ? "fixed inset-y-0 left-0 translate-x-0"
            : "fixed inset-y-0 left-0 -translate-x-full lg:static lg:translate-x-0"
        }`}
      >
        
        {/* Brand Title & Close Button for Mobile */}
        <div className="mb-6 px-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#003d9b] dark:text-[#b2c5ff] tracking-tight flex items-center gap-2">
              Article / Design
            </h2>
            <p className="text-xs text-[#535f73] dark:text-[#bec6e0] font-medium mt-0.5">
              Master Management System
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 rounded-lg hover:bg-[#d4e0f8] dark:hover:bg-[#1e293b] lg:hidden text-[#535f73] dark:text-[#bec6e0]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="flex-1 space-y-1">
          <button
            type="button"
            onClick={() => { setActiveNav("catalog"); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
              activeNav === "catalog"
                ? "bg-[#d4e0f8] dark:bg-[#0052cc] text-[#051a3e] dark:text-white shadow-xs"
                : "text-[#535f73] dark:text-[#bec6e0] hover:bg-[#e1e8ff] dark:hover:bg-[#1d3054]"
            }`}
          >
            <Package size={17} />
            <span>Article / Design Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveNav("spreadsheet"); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
              activeNav === "spreadsheet"
                ? "bg-[#d4e0f8] dark:bg-[#0052cc] text-[#051a3e] dark:text-white shadow-xs"
                : "text-[#535f73] dark:text-[#bec6e0] hover:bg-[#e1e8ff] dark:hover:bg-[#1d3054]"
            }`}
            title="Read-only quick-audit table for inventory verification and export"
          >
            <FileSpreadsheet size={17} />
            <span>Quick-Audit Table (Read-Only)</span>
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
            onClick={() => setActiveNav("bulk_sheet")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              activeNav === "bulk_sheet"
                ? "bg-[#d4e0f8] dark:bg-[#0052cc] text-[#051a3e] dark:text-white shadow-xs"
                : "text-[#535f73] dark:text-[#bec6e0] hover:bg-[#e1e8ff] dark:hover:bg-[#1d3054]"
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>Attribute Bulk Sheet</span>
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
            <span>Variant Matrix</span>
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
        <header className="bg-white dark:bg-[#131b2e] h-14 border-b border-[#c3c6d6] dark:border-[#434654] flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-lg border border-[#c3c6d6] dark:border-[#434654] text-[#535f73] dark:text-[#bec6e0] hover:bg-[#eceef0] dark:hover:bg-[#2d3133] lg:hidden shrink-0"
              title="Toggle Navigation Menu"
            >
              <Menu size={17} />
            </button>
            <span className="text-sm font-bold text-[#051a3e] dark:text-white truncate">
              Article / Design Master
            </span>

            {/* SMRITI 3-Tier Adaptive Mode Segmented Pill */}
            <div className="hidden sm:inline-flex items-center bg-[#f1f3ff] dark:bg-[#1e293b] p-0.5 rounded-lg border border-[#cbd5e1] dark:border-[#334155] text-[11px] ml-2 shrink-0">
              {(["SIMPLE", "HYBRID", "ADVANCED"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectAdaptiveMode(m)}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    adaptiveMode === m
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
                >
                  {m.charAt(0) + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="item-code-select-btn"
              type="button"
              onClick={() => setShowCodeSelectDlg(true)}
              className="px-2.5 py-1 bg-white dark:bg-[#1d263b] border border-[#c3c6d6] dark:border-[#434654] text-xs font-semibold rounded hover:bg-[#eceef0] dark:hover:bg-[#28354f] transition flex items-center gap-1.5"
              title="SKU Code & Barcode Generator"
            >
              <Hash size={13} className="text-blue-600 dark:text-blue-400" />
              <span>SKU Generator</span>
            </button>

            <button
              id="item-replace-data-btn"
              type="button"
              onClick={() => setShowReplaceDataDlg(true)}
              className="px-2.5 py-1 bg-white dark:bg-[#1d263b] border border-[#c3c6d6] dark:border-[#434654] text-xs font-semibold rounded hover:bg-[#eceef0] dark:hover:bg-[#28354f] transition flex items-center gap-1.5"
              title="Batch Find & Replace across Article attributes"
            >
              <Replace size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Replace Data</span>
            </button>

            <span className="px-2.5 py-0.5 bg-[#e9edff] dark:bg-[#1d3054] text-[#003d9b] dark:text-[#b2c5ff] font-mono text-[11px] font-bold rounded">
              {products.length} Articles Live
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
          {activeNav === "catalog" && (
            <ItemCatalogGrid
              products={products}
              onRefreshProducts={handleRefresh}
              onNotification={handleNotify}
              onNavigateToPaste={() => setActiveNav("imports")}
              currentUser={currentUser}
              productCategory="Footwear"
              onAddNew={() => setIsAddDrawerOpen(true)}
              mode={adaptiveMode}
              onSelectMode={handleSelectAdaptiveMode}
            />
          )}

          {activeNav === "spreadsheet" && (
            <ItemDetailsGrid
              products={products}
              viewConfig={viewConfig}
              onRefreshProducts={handleRefresh}
              onNotification={handleNotify}
              onNavigateToItemViewConfig={() => setActiveNav("view_config")}
              onNavigateToCatalog={() => setActiveNav("catalog")}
              onAddNew={() => setIsAddDrawerOpen(true)}
            />
          )}

          {activeNav === "view_config" && (
            <ItemViewConfig
              currentConfig={viewConfig}
              userRole={currentUser?.role}
              onSaveConfig={(cfg) => {
                setItemViewConfig(cfg);
                setActiveNav("spreadsheet");
              }}
              onNotification={handleNotify}
            />
          )}

          {activeNav === "imports" && (
            <ItemMasterStudio
              onRefreshProducts={handleRefresh}
              onNotification={handleNotify}
              currentUser={currentUser}
              onCancel={() => setActiveNav("catalog")}
            />
          )}

          {activeNav === "bulk_sheet" && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar">
              <BulkImportSection
                onRefreshProducts={handleRefresh}
                onNotification={(title, msg, type) => handleNotify(title, msg, type as any)}
              />
            </div>
          )}

          {activeNav === "attributes" && (
            <AttrMgmtStudio
              onNotification={handleNotify}
            />
          )}

          {activeNav === "image_config" && (
            <ImgPathStudio
              onNotification={handleNotify}
            />
          )}

          {activeNav === "variants" && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar">
              <VariantTplSec
                products={products}
                onRefreshProducts={handleRefresh}
                onNotification={handleNotify}
              />
            </div>
          )}
        </main>
      </div>

      {/* ── Add Product Drawer ── */}
      <AddProductDrawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        onSaved={handleRefresh}
        onNotification={handleNotify}
        productType="Footwear"
        mode={adaptiveMode}
      />

      {/* ── Code / SKU Selection Dialog ── */}
      <CodeSelectDlg
        isOpen={showCodeSelectDlg}
        onClose={() => setShowCodeSelectDlg(false)}
        onSelectCode={(code, barcode) => {
          handleNotify("SKU Generated", `Generated SKU: ${code} (Barcode: ${barcode})`, "success");
          setShowCodeSelectDlg(false);
        }}
      />

      {/* ── Replace Data Dialog ── */}
      <ReplaceDataDlg
        isOpen={showReplaceDataDlg}
        onClose={() => setShowReplaceDataDlg(false)}
        onReplace={(targetField, findText, replaceText) => {
          handleNotify("Replace Data", `Batch find & replace scheduled: "${findText}" → "${replaceText}" in field "${targetField}".`, "info");
        }}
        fields={[
          { key: "name", label: "Product Name" },
          { key: "brand", label: "Brand" },
          { key: "styleCode", label: "Style Code" },
          { key: "colour", label: "Colour" },
          { key: "size", label: "Size" },
          { key: "hsn_code", label: "HSN Code" },
          { key: "category", label: "Category" },
        ]}
      />
    </div>
  );
};

export default ItemMasterWs;
