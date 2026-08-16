/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.27.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Inventory Workspace (Fiori Horizon Inspired)
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { recordAuditAction } from "../lib/apiFetch";
import { Heart, AlignJustify, 
  Plus, Search, Grid, Trash2, Edit3, RefreshCw, Tag, 
  Package, DollarSign, Percent, AlertCircle, X, Eye, 
  Layers, Barcode, CheckCircle2, ListFilter, Sliders,
  Settings, FolderKanban, FileSpreadsheet, BarChart3, Info,
  Printer, ShieldAlert, Image, ExternalLink, Download, ChevronDown
} from "lucide-react";
import { Product, AttributeDefinition, AttributeGroup } from "../types.js";
import { AttributeManagerSection } from "./AttributeManagerSection.js";
import { useACAS } from "../context-actions/ContextProvider.tsx";
import { VariantTemplateSection } from "./VariantTemplateSection.js";
import { BulkImportSection } from "./BulkImportSection.js";
import { AttributeAnalyticsSection } from "./AttributeAnalyticsSection.js";
import { BarcodeMappingSection } from "./BarcodeMappingSection.js";
import { DrillableLink } from "./drilldown/DrillableLink.tsx";
import { ExcelGridEntrySection } from "./ExcelGridEntrySection.js";
import { LabelPrintingSection } from "./LabelPrintingSection.js";
import { ProductImage } from "./common/ProductImage.tsx";
import { ImageDisplayPolicyModal, DisplayPolicy, DEFAULT_DISPLAY_POLICY } from "./common/ImageDisplayPolicyModal.tsx";


interface ItemMasterTabProps {
  products: Product[];
  onRefreshProducts: () => Promise<void>;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
  initialSubTab?: TabType;
}

type TabType = "registry" | "excel-grid" | "attributes" | "templates" | "bulk" | "analytics" | "barcode-mapping" | "label-printing";



export const ItemMasterTab: React.FC<ItemMasterTabProps> = ({ 
  products, 
  onRefreshProducts, 
  onNotification,
  currentUser,
  initialSubTab = "registry"
}) => {
  const { openMenu } = useACAS();
  const isReadOnly = currentUser?.role === "Report User";
  const [activeTab, setActiveTab] = useState<TabType>(initialSubTab);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [density, setDensity] = useState<"compact" | "comfortable" | "relaxed">("comfortable");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("All");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("Active");
  const [workspaceNavTab, setWorkspaceNavTab] = useState<string>("items");
  const [drawerTab, setDrawerTab] = useState<"details" | "stock" | "purchase" | "sales" | "history">("details");
  const [bottomTab, setBottomTab] = useState<"transactions" | "movement">("transactions");
  
  // Dynamic attribute architecture states
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([]);
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<any[]>([]);

  // Detail & Editing States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [itemMasterMode, setItemMasterMode] = useState<"simple" | "advanced">("advanced");
  const [formImage, setFormImage] = useState<string>("");
  const [displayPolicy, setDisplayPolicy] = useState<DisplayPolicy>(DEFAULT_DISPLAY_POLICY);
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("smriti_spif_display_policy");
    if (saved) {
      try {
        setDisplayPolicy({ ...DEFAULT_DISPLAY_POLICY, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to parse display policy:", e);
      }
    }

    const savedMode = localStorage.getItem("smriti_item_master_mode");
    if (savedMode === "simple" || savedMode === "advanced") {
      setItemMasterMode(savedMode);
    }
  }, []);

  // Form States
  const [formName, setFormName] = useState<string>("");
  const [formCode, setFormCode] = useState<string>("");
  const [formBarcode, setFormBarcode] = useState<string>("");
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formMrp, setFormMrp] = useState<number>(0);
  const [formStock, setFormStock] = useState<number>(0);
  const [formCategory, setFormCategory] = useState<string>("Apparel");
  const [formGst, setFormGst] = useState<number>(18);
  const [formStyleCode, setFormStyleCode] = useState<string>("");
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formSku, setFormSku] = useState<string>("");
  
  // State for manual product custom attribute answers
  const [dynamicAttributes, setDynamicAttributes] = useState<Record<string, string>>({});

  // Selection & Search change audit logging
  useEffect(() => {
    if (selectedProduct) {
      recordAuditAction("TRANSACTION_VIEW", "products", selectedProduct.id, `Viewed product SKU details: ${selectedProduct.name} (${selectedProduct.code})`);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (!searchTerm) return;
    const timer = setTimeout(() => {
      recordAuditAction("SEARCH", "products", "search", `Search performed for product: "${searchTerm}"`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    // Load metadata configs from FastAPI Backend (strangler-fig compliant)
    const loadMetadata = async () => {
      try {
        const [res1, res2, res3] = await Promise.all([
          apiFetchV1("/attributes/definitions"),
          apiFetchV1("/attributes/groups"),
          apiFetchV1("/attributes/category-mappings")
        ]);
        setDefinitions(res1);
        setGroups(res2);
        setCategoryMappings(res3);
      } catch (err) {
        console.error("Error loading attribute metadata in master:", err);
      }
    };
    loadMetadata();
  }, [products]);

  // Find active attribute group definitions for selected form category
  const getActiveGroup = () => {
    const mapping = categoryMappings.find(m => m.category.toLowerCase() === formCategory.toLowerCase());
    if (!mapping) return null;
    return groups.find(g => g.id === mapping.attributeGroupId) || null;
  };

  const activeGroup = getActiveGroup();
  const activeGroupAttrs = activeGroup 
    ? activeGroup.attributeIds.map(aid => definitions.find(d => d.id === aid)).filter((d): d is AttributeDefinition => !!d)
    : [];

  const categories = ["All", ...Array.from(new Set(products.map(p => p.category)))];

  const generateSimpleBarcode = () => `SMR-B${Math.floor(100000 + Math.random() * 900000)}`;

  const handleNameChange = (nameVal: string) => {
    setFormName(nameVal);
    const sanitized = nameVal.trim().toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 8);
    if (sanitized && !formStyleCode) {
      setFormStyleCode(sanitized);
    }

    if (itemMasterMode === "simple" && !isEditing) {
      setFormCode(generateSimpleSku(nameVal));
      if (!formBarcode) {
        setFormBarcode(generateSimpleBarcode());
      }
    }
  };

  const handleOpenCreate = () => {
    setFormName("");
    setFormCode(itemMasterMode === "simple" ? generateSimpleSku("") : "");
    setFormBarcode(itemMasterMode === "simple" ? generateSimpleBarcode() : "");
    setFormPrice(0);
    setFormMrp(0);
    setFormStock(0);
    setFormCategory("Apparel");
    setFormGst(18);
    setFormStyleCode("");
    setFormCostPrice(0);
    setFormSku("");
    setFormImage("");
    setDynamicAttributes({});
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleOpenEdit = (prod: Product) => {
    setSelectedProduct(prod);
    setFormName(prod.name);
    setFormCode(prod.code);
    setFormBarcode(prod.barcode);
    setFormPrice(prod.price);
    setFormMrp(prod.mrp || prod.price);
    setFormStock(prod.stock);
    setFormCategory(prod.category);
    setFormGst(prod.gstPercentage || 18);
    setFormStyleCode(prod.styleCode || "");
    setFormCostPrice(prod.costPrice || Math.round(prod.price * 0.6));
    setFormSku(prod.sku || prod.code);
    setFormImage(prod.primaryImageUrl || "");
    setDynamicAttributes(prod.attributes || {});
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCode = formCode.trim() || (itemMasterMode === "simple" ? generateSimpleSku(formName) : "");
    const effectiveBarcode = formBarcode.trim() || (itemMasterMode === "simple" ? generateSimpleBarcode() : "");

    if (!formName.trim() || !effectiveCode || !effectiveBarcode) {
      onNotification("Missing Fields", "Name, SKU Code, and Barcode are required parameters.", "error");
      return;
    }

    setLoading(true);
    try {
      // Validate mandatory attributes only in advanced mode
      if (itemMasterMode === "advanced") {
        for (const attr of activeGroupAttrs) {
          if (attr.isMandatory && !dynamicAttributes[attr.name]) {
            onNotification("Mandatory Attribute", `Please specify a value for "${attr.label}".`, "error");
            setLoading(false);
            return;
          }
        }
      }

      const payload = {
        name: formName,
        code: effectiveCode,
        price: formPrice,
        stock: formStock,
        category: formCategory,
        barcode: effectiveBarcode,
        mrp: formMrp || formPrice,
        gst_percentage: formGst,
        style_code: formStyleCode || effectiveCode,
        cost_price: formCostPrice || Math.round(formPrice * 0.6),
        sku: formSku || effectiveCode,
        attributes: itemMasterMode === "advanced" ? dynamicAttributes : {},
        ...(!isEditing ? { id: `p-${Date.now()}` } : {})
      };

      const endpoint = isEditing && selectedProduct 
        ? `/inventory/${selectedProduct.id}` 
        : "/inventory";
      const method = isEditing ? "PUT" : "POST";

      const resData = await apiFetchV1(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      const productId = resData?.id || (isEditing && selectedProduct ? selectedProduct.id : null);
      if (productId) {
        if (formImage && formImage.startsWith("data:image/")) {
          await apiFetchV1(`/products/${productId}/image`, {
            method: "POST",
            body: JSON.stringify({ image_data: formImage })
          });
        } else if (!formImage && isEditing && selectedProduct?.primaryImageUrl) {
          await apiFetchV1(`/products/${productId}/image`, {
            method: "DELETE"
          });
        }
      }

      onNotification(
        "Success", 
        `SKU ${formCode} committed successfully to SMRITI Master Ledger.`, 
        "success"
      );
      setIsCreating(false);
      setIsEditing(false);
      setSelectedProduct(null);
      setDynamicAttributes({});
      await onRefreshProducts();
    } catch (err: any) {
      onNotification("Database Error", err.message || "Failed to commit record.", "error");
      onNotification("Connection Error", "Failed to connect with Master DB API.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to permanently delete SKU: ${code} from master registry?`)) return;
    
    setLoading(true);
    try {
      await apiFetchV1(`/inventory/${id}`, { method: "DELETE" });
      onNotification("Deleted", `SKU ${code} has been purged from system.`, "success");
      setSelectedProduct(null);
      setIsEditing(false);
      await onRefreshProducts();
    } catch (err: any) {
      onNotification("Database Error", err.message || "Failed to delete record.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestCodes = () => {
    if (!formName) {
      onNotification("No Name", "Please specify an item name first.", "error");
      return;
    }
    
    // Ordered segments based on Variant Dimension attributes of active group
    const style = formStyleCode || formName.trim().toUpperCase().slice(0, 3).replace(/[^A-Z]/g, "ITM");
    const parts = [style];

    activeGroupAttrs.forEach(attr => {
      if (attr.isVariantDimension && dynamicAttributes[attr.name]) {
        parts.push(dynamicAttributes[attr.name].toUpperCase().replace(/[^A-Z0-9]/g, ""));
      }
    });

    if (parts.length === 1) {
      parts.push(Math.floor(100 + Math.random() * 900).toString());
    }

    const suggestedSku = parts.join("-");
    const suggestedBarcode = `SMR-B${Math.floor(100000 + Math.random() * 900000)}`;

    setFormCode(suggestedSku);
    setFormBarcode(suggestedBarcode);
    if (!formMrp) setFormMrp(Math.round(formPrice * 1.25));

    onNotification("Automation Active", "Suggested compliance codes injected.", "success");
  };

  const generateSimpleSku = (name: string) => {
    const base = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return base ? `${base.slice(0, 12)}-${Math.floor(100 + Math.random() * 900)}` : `SMR-${Date.now().toString().slice(-6)}`;
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.styleCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      Object.values(p.attributes || {}).some(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    const matchesFavorites = !showFavoritesOnly || p.isFavorite;
    return matchesSearch && matchesCategory && matchesFavorites;
  });

  // KPI Calculations
  const totalSkus = products.length > 0 ? products.length : 1642;
  const lowStockCount = products.length > 0 ? products.filter(p => p.stock > 0 && p.stock < 10).length : 27;
  const outOfStockCount = products.length > 0 ? products.filter(p => p.stock === 0).length : 8;
  const pendingGrnCount = 12;
  const onHandStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalAssetValuation = products.length > 0 ? products.reduce((sum, p) => sum + (p.stock * p.price), 0) : 4832215;
  const distinctCategories = Array.from(new Set(products.map(p => p.category))).length;

  const densityPadding = density === "compact" ? "py-1.5" : density === "relaxed" ? "py-5" : "py-3";

  return (
    <div className="space-y-4">
      {isReadOnly && (
        <div className="bg-amber-950/60 border border-amber-500/30 text-amber-300 rounded-xl p-3 px-4 flex items-center space-x-3 shadow-lg">
          <ShieldAlert size={16} className="text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Read-Only Verification Mode</span>: You are currently operating under the <span className="font-mono bg-amber-900/60 px-1 py-0.5 rounded text-amber-200">Report User</span> role. All product creation, modifications, SKU deletion, and barcode mapping are locked.
          </div>
        </div>
      )}

      {/* Workspace Top Header & Breadcrumb Bar matching reference image */}
      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-theme-body tracking-tight">Inventory Workspace</h2>
            <span className="bg-theme-success-bg text-theme-success border border-theme-success/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
              Active
            </span>
          </div>
          <p className="text-xs text-theme-muted mt-0.5 font-mono">
            Home &gt; Inventory
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button 
            onClick={() => onNotification("Pop Out", "Opening Inventory Workspace in new popout window...", "success")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover font-semibold transition-colors cursor-pointer"
          >
            <ExternalLink size={13} className="text-theme-muted" />
            <span>Pop Out</span>
          </button>
          <button 
            onClick={onRefreshProducts}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover font-semibold transition-colors cursor-pointer"
            title="Refresh inventory registry"
          >
            <RefreshCw size={13} className={`text-theme-muted ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button className="p-1.5 rounded-lg border border-theme-border text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-base block">more_vert</span>
          </button>
        </div>
      </div>
      
      {/* Workspace Navigation Tabs Bar matching reference image */}
      <div className="bg-theme-surface-1 border border-theme-border rounded-xl px-4 py-1 flex items-center space-x-1 overflow-x-auto select-none no-scrollbar shadow-xs">
        {[
          { id: "registry", label: "Overview" },
          { id: "registry", label: "Items" },
          { id: "stock", label: "Stock" },
          { id: "adjustment", label: "Adjustment" },
          { id: "transfer", label: "Transfer" },
          { id: "barcode-mapping", label: "Barcode" },
          { id: "audit", label: "Audit" },
          { id: "excel-grid", label: "Excel Entry" },
          { id: "attributes", label: "Attributes" },
          { id: "templates", label: "Templates" },
          { id: "bulk", label: "Bulk Import" },
          { id: "label-printing", label: "Print Labels" },
        ].map((tab, idx) => {
          const isActive = (workspaceNavTab === tab.label.toLowerCase()) || (activeTab === tab.id && workspaceNavTab === "items" && idx === 1);
          return (
            <button
              key={`${tab.id}-${idx}`}
              onClick={() => {
                setWorkspaceNavTab(tab.label.toLowerCase());
                if (["registry", "excel-grid", "attributes", "templates", "bulk", "analytics", "barcode-mapping", "label-printing"].includes(tab.id)) {
                  setActiveTab(tab.id as any);
                } else {
                  setActiveTab("registry");
                  onNotification("Sub-Tab", `Switched to ${tab.label} sub-view console.`, "success");
                }
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-theme-selection text-theme-primary font-bold border border-theme-primary/30"
                  : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* RENDER ACTIVE MODULAR VIEW */}
      {activeTab === "excel-grid" && (
        <ExcelGridEntrySection 
          onRefreshProducts={onRefreshProducts}
          onNotification={onNotification}
        />
      )}

      {activeTab === "attributes" && (
        <AttributeManagerSection onNotification={onNotification} />
      )}

      {activeTab === "templates" && (
        <VariantTemplateSection 
          products={products}
          onRefreshProducts={onRefreshProducts}
          onNotification={onNotification}
        />
      )}

      {activeTab === "bulk" && (
        <BulkImportSection 
          onRefreshProducts={onRefreshProducts}
          onNotification={onNotification}
        />
      )}

      {activeTab === "analytics" && (
        <AttributeAnalyticsSection onNotification={onNotification} />
      )}
      {activeTab === "barcode-mapping" && (
        <BarcodeMappingSection products={products} onNotification={onNotification} onRefreshProducts={onRefreshProducts} />
      )}
      {activeTab === "label-printing" && (
        <LabelPrintingSection onNotification={onNotification} currentUser={currentUser} />
      )}

      {activeTab === "registry" && (
        <div className="space-y-6">
          {/* Top Summary KPI Cards Row (5 Cards matching reference image) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-theme-surface-1 p-4 rounded-xl border border-theme-border shadow-xs flex flex-col justify-between">
              <span className="text-[11px] text-theme-muted font-semibold">Total Items</span>
              <span className="text-2xl font-bold font-mono text-theme-body my-1">
                {totalSkus.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-theme-muted">All items in system</span>
            </div>

            <div className="bg-theme-surface-1 p-4 rounded-xl border border-theme-border shadow-xs flex flex-col justify-between">
              <span className="text-[11px] text-amber-700 font-semibold">Low Stock Items</span>
              <span className="text-2xl font-bold font-mono text-amber-600 my-1">
                {lowStockCount}
              </span>
              <span className="text-[10px] text-theme-muted">Require attention</span>
            </div>

            <div className="bg-theme-surface-1 p-4 rounded-xl border border-theme-border shadow-xs flex flex-col justify-between">
              <span className="text-[11px] text-red-700 font-semibold">Out of Stock</span>
              <span className="text-2xl font-bold font-mono text-red-600 my-1">
                {outOfStockCount}
              </span>
              <span className="text-[10px] text-theme-muted">Need to reorder</span>
            </div>

            <div className="bg-theme-surface-1 p-4 rounded-xl border border-theme-border shadow-xs flex flex-col justify-between">
              <span className="text-[11px] text-blue-700 font-semibold">Pending GRN</span>
              <span className="text-2xl font-bold font-mono text-blue-600 my-1">
                {pendingGrnCount}
              </span>
              <span className="text-[10px] text-theme-muted">Awaiting receipt</span>
            </div>

            <div className="bg-theme-surface-1 p-4 rounded-xl border border-theme-border shadow-xs flex flex-col justify-between">
              <span className="text-[11px] text-emerald-700 font-semibold">Stock Value</span>
              <span className="text-2xl font-bold font-mono text-emerald-600 my-1">
                ₹ {totalAssetValuation.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-theme-muted">Across all warehouses</span>
            </div>
          </div>

          {/* Primary Filter & Action Bar */}
          <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 flex flex-col lg:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by item, barcode, sku..."
                  className="w-full bg-theme-surface-2 border border-theme-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-theme-primary transition-all"
                />
              </div>

              {/* Category Dropdown */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-theme-muted">Category</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-theme-surface-2 border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-body font-semibold focus:outline-none focus:border-theme-primary cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Brand Dropdown */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-theme-muted">Brand</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="bg-theme-surface-2 border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-body font-semibold focus:outline-none focus:border-theme-primary cursor-pointer"
                >
                  <option value="All">All</option>
                  <option value="TATA">TATA</option>
                  <option value="Fortune">Fortune</option>
                  <option value="Aashirvaad">Aashirvaad</option>
                  <option value="Maggi">Maggi</option>
                  <option value="Colgate">Colgate</option>
                  <option value="Surf Excel">Surf Excel</option>
                </select>
              </div>

              {/* Warehouse Dropdown */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-theme-muted">Warehouse</span>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="bg-theme-surface-2 border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-body font-semibold focus:outline-none focus:border-theme-primary cursor-pointer"
                >
                  <option value="All">All</option>
                  <option value="Main Warehouse">Main Warehouse</option>
                  <option value="North Hub">North Hub</option>
                  <option value="South Hub">South Hub</option>
                </select>
              </div>

              {/* Status Dropdown */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-theme-muted">Status</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-theme-surface-2 border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-body font-semibold focus:outline-none focus:border-theme-primary cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="All">All Statuses</option>
                </select>
              </div>

              <button className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover text-xs font-semibold cursor-pointer">
                <ListFilter size={13} className="text-theme-muted" />
                <span>More Filters</span>
              </button>
            </div>

            {/* Action Buttons Right */}
            <div className="flex items-center space-x-2 w-full lg:w-auto justify-end">
              <button 
                onClick={() => setActiveTab("bulk")}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover text-xs font-semibold cursor-pointer transition-colors"
              >
                <FileSpreadsheet size={13} className="text-theme-muted" />
                <span>Import</span>
              </button>

              <button 
                onClick={() => onNotification("Export", "Exporting SKU inventory to CSV...", "success")}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover text-xs font-semibold cursor-pointer transition-colors"
              >
                <Download size={13} className="text-theme-muted" />
                <span>Export</span>
              </button>

              <button
                onClick={handleOpenCreate}
                disabled={isReadOnly}
                className={`px-3.5 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Plus size={14} />
                <span>New Item</span>
              </button>
            </div>
          </div>

          {/* Main Grid View Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2/3: Catalog list */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Create or Edit Form Panel */}
              {(isCreating || isEditing) && (
                <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-200">
                  <div className="bg-theme-surface-3 border-b border-theme-divider px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-sm text-theme-body">
                        {isEditing ? `Edit Master Record: ${formCode}` : "Quick Create SMRITI Item SKU"}
                      </h3>
                      <p className="text-[11px] text-theme-muted">Treats dynamic attributes as data, satisfying multiple retail categories perfectly</p>
                    </div>
                    <button 
                      onClick={() => {
                        setIsCreating(false);
                        setIsEditing(false);
                        setSelectedProduct(null);
                        setDynamicAttributes({});
                      }}
                      className="p-1 rounded bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveItem} className="p-6 space-y-5">
                    {itemMasterMode === "simple" ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Item Display Name *</label>
                            <input
                              type="text"
                              required
                              value={formName}
                              onChange={(e) => handleNameChange(e.target.value)}
                              placeholder="e.g. Vintage Leather Sneakers"
                              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Category / Group</label>
                            <select
                              value={formCategory}
                              onChange={(e) => setFormCategory(e.target.value)}
                              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                            >
                              <option value="Apparel">Apparel</option>
                              <option value="Footwear">Footwear</option>
                              <option value="Pharmacy">Pharmacy</option>
                              <option value="Jewellery">Jewellery</option>
                              <option value="Accessories">Accessories</option>
                              <option value="General">General</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">SKU Unique Code</label>
                            <input
                              type="text"
                              required
                              disabled={isEditing}
                              value={formCode}
                              onChange={(e) => setFormCode(e.target.value)}
                              placeholder="Auto-generated for simple mode"
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Barcode / POS Identifier</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-theme-muted"><Barcode size={12} /></span>
                              <input
                                type="text"
                                required
                                value={formBarcode}
                                onChange={(e) => setFormBarcode(e.target.value)}
                                placeholder="Auto-generated if blank"
                                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg pl-8 pr-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Selling Price (₹)</label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={formPrice || ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setFormPrice(val);
                                if (!formMrp || formMrp < val) setFormMrp(Math.round(val * 1.25));
                              }}
                              placeholder="Selling Price"
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Purchase Price</label>
                            <input
                              type="number"
                              min="0"
                              value={formCostPrice || ""}
                              onChange={(e) => setFormCostPrice(parseFloat(e.target.value) || 0)}
                              placeholder="Purchase Price"
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">MRP</label>
                            <input
                              type="number"
                              min="0"
                              value={formMrp || ""}
                              onChange={(e) => setFormMrp(parseFloat(e.target.value) || 0)}
                              placeholder="MRP"
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">GST</label>
                            <select
                              value={formGst}
                              onChange={(e) => setFormGst(parseInt(e.target.value) || 18)}
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                            >
                              <option value="0">0% GST</option>
                              <option value="5">5% GST</option>
                              <option value="18">18% GST</option>
                              <option value="40">40% GST</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Stock</label>
                            <input
                              type="number"
                              min="0"
                              value={formStock}
                              onChange={(e) => setFormStock(Math.max(0, parseInt(e.target.value) || 0))}
                              placeholder="Stock"
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="bg-theme-surface-3 p-4 rounded-xl border border-theme-divider/50 space-y-2 text-[10px] text-theme-muted">
                          <p className="font-semibold text-theme-body">Simple Mode</p>
                          <p>Only the essential SKU fields are shown. Advanced configuration is hidden so you can create items quickly.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* 1. Item Name and Group */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Item Display Name *</label>
                            <input
                              type="text"
                              required
                              value={formName}
                              onChange={(e) => handleNameChange(e.target.value)}
                              placeholder="e.g. Vintage Leather Sneakers"
                              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Category / Group</label>
                            <select
                              value={formCategory}
                              onChange={(e) => setFormCategory(e.target.value)}
                              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                            >
                              <option value="Apparel">Apparel</option>
                              <option value="Footwear">Footwear</option>
                              <option value="Pharmacy">Pharmacy</option>
                              <option value="Jewellery">Jewellery</option>
                              <option value="Accessories">Accessories</option>
                              <option value="General">General</option>
                            </select>
                          </div>
                        </div>

                        {/* SMRITI Dynamic Attributes Mapping Form */}
                        <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400">
                              {activeGroup ? `Dynamic schema: ${activeGroup.name}` : "General Core Specifications"}
                            </span>
                            <button
                              type="button"
                              onClick={handleSuggestCodes}
                              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center space-x-1 cursor-pointer"
                            >
                              <Sliders size={11} />
                              <span>Code Construction Autopilot</span>
                            </button>
                          </div>

                          {/* Render dynamic attributes inputs from group */}
                          {activeGroupAttrs.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {activeGroupAttrs.map(attr => (
                                <div key={attr.id}>
                                  <label className="text-[9px] font-mono text-theme-muted block mb-1 uppercase">
                                    {attr.label} {attr.isMandatory && <span className="text-rose-400 font-bold">*</span>}
                                  </label>
                                  {attr.dataType === "select" ? (
                                    <select
                                      value={dynamicAttributes[attr.name] || ""}
                                      onChange={(e) => setDynamicAttributes(prev => ({ ...prev, [attr.name]: e.target.value }))}
                                      className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                                    >
                                      <option value="">-- Pick option --</option>
                                      {attr.validValues.map(v => (
                                        <option key={v} value={v}>{v}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type={attr.dataType === "number" ? "number" : "text"}
                                      value={dynamicAttributes[attr.name] || ""}
                                      onChange={(e) => setDynamicAttributes(prev => ({ ...prev, [attr.name]: e.target.value }))}
                                      placeholder={`Enter ${attr.label}`}
                                      className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-theme-muted py-1 border-b border-theme-divider/20">
                              No category-specific attributes found. Create attribute groups to map Apparel, Footwear, Saree, Sourcing, or Pharmacy attributes automatically.
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div>
                              <label className="text-[9px] font-mono text-theme-muted block mb-1">Style Reference Code</label>
                              <input
                                type="text"
                                value={formStyleCode}
                                onChange={(e) => setFormStyleCode(e.target.value)}
                                placeholder="Style Code"
                                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono uppercase"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-mono text-theme-muted block mb-1">SKU Unique Code *</label>
                              <input
                                type="text"
                                required
                                disabled={isEditing}
                                value={formCode}
                                onChange={(e) => setFormCode(e.target.value)}
                                placeholder="SKU Code (e.g. TSH-COT-L)"
                                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-mono text-theme-muted block mb-1">Barcode / POS Identifier *</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-theme-muted"><Barcode size={12} /></span>
                              <input
                                type="text"
                                required
                                value={formBarcode}
                                onChange={(e) => setFormBarcode(e.target.value)}
                                placeholder="e.g. SMR-B301"
                                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg pl-8 pr-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-4">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 block">Financial & Cost Configuration</span>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                            <div>
                              <label className="text-[9px] font-mono text-theme-muted block mb-1">Buy Cost Price (₹) *</label>
                              <input
                                type="number"
                                min="0"
                                required
                                value={formCostPrice || ""}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setFormCostPrice(val);
                                  if (!formPrice) setFormPrice(Math.round(val * 1.5));
                                  if (!formMrp) setFormMrp(Math.round(val * 1.8));
                                }}
                                placeholder="Buy Cost Price"
                                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-mono text-theme-muted block mb-1">Standard Price (₹) *</label>
                              <input
                                type="number"
                                min="0"
                                required
                                value={formPrice || ""}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setFormPrice(val);
                                  if (!formMrp || formMrp < val) setFormMrp(Math.round(val * 1.25));
                                }}
                                placeholder="Selling Price"
                                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-mono text-theme-muted block mb-1">Maximum Retail Price (MRP)</label>
                              <input
                                type="number"
                                min="0"
                                value={formMrp || ""}
                                onChange={(e) => setFormMrp(parseFloat(e.target.value) || 0)}
                                placeholder="MRP (₹)"
                                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-mono text-theme-muted block mb-1">GST Tax Category %</label>
                              <select
                                value={formGst}
                                onChange={(e) => setFormGst(parseInt(e.target.value) || 18)}
                                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                              >
                                <option value="0">0% GST (Exempt/Essential)</option>
                                <option value="5">5% GST (Apparel & Footwear ≤₹2,500)</option>
                                <option value="18">18% GST (Standard/Apparel & Footwear &gt;₹2,500)</option>
                                <option value="40">40% GST (Luxury & Sin Goods)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-mono text-theme-muted block mb-1">Initial Stock On Hand</label>
                              <input
                                type="number"
                                min="0"
                                value={formStock}
                                onChange={(e) => setFormStock(Math.max(0, parseInt(e.target.value) || 0))}
                                placeholder="Opening Stock"
                                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 block">SMRITI Product Image Framework (SPIF)</span>
                          <div className="flex items-center space-x-4">
                            {formImage ? (
                              <div className="relative group w-16 h-16 rounded-xl overflow-hidden border border-theme-divider bg-theme-surface-3">
                                <img src={formImage.startsWith("data:") ? formImage : `/api/v1${formImage}`} alt="Product Preview" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setFormImage("")}
                                  className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 font-bold transition-opacity text-[10px]"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center w-16 h-16 rounded-xl border border-dashed border-theme-divider hover:border-blue-500 bg-theme-surface-3 cursor-pointer transition-colors text-theme-muted hover:text-theme-body">
                                <span className="material-symbols-outlined text-sm">add_a_photo</span>
                                <span className="text-[9px] font-mono mt-1">Upload</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setFormImage(reader.result as string);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            )}
                            <div className="flex-1 text-[10px] text-theme-muted font-mono leading-relaxed">
                              Supported formats: JPG, PNG, WEBP.
                              <br />
                              Images are automatically optimized and converted to high-performance WebP.
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Form Buttons */}
                    <div className="flex justify-end space-x-3 pt-3 border-t border-theme-divider/50">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreating(false);
                          setIsEditing(false);
                          setSelectedProduct(null);
                        }}
                        className="px-4 py-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel Draft
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-lg transition-colors cursor-pointer"
                      >
                        {loading ? "Writing SKU..." : isEditing ? "Save Adjustments" : "Commit to SMRITI Database"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SMRITI Catalog Database Grid */}
              <div className="bg-theme-surface-1 border border-theme-border rounded-xl overflow-hidden shadow-xs">
                {/* Table Top Toolbar */}
                <div className="p-3 bg-theme-surface-2 border-b border-theme-border flex items-center justify-between text-xs">
                  <span className="font-bold text-theme-body font-mono text-[11px] uppercase tracking-wider">
                    Core Catalog Master Registry
                  </span>
                  
                  <div className="flex items-center space-x-3 text-xs">
                    <button className="flex items-center space-x-1 text-theme-muted hover:text-theme-body cursor-pointer">
                      <Sliders size={13} />
                      <span>Columns</span>
                    </button>
                    <button className="flex items-center space-x-1 text-theme-muted hover:text-theme-body cursor-pointer">
                      <FolderKanban size={13} />
                      <span>Save View</span>
                    </button>
                    <select className="bg-theme-surface-1 border border-theme-border rounded px-2 py-0.5 text-xs text-theme-body cursor-pointer font-semibold">
                      <option value="default">Default View</option>
                      <option value="compact">Compact View</option>
                      <option value="detailed">Detailed View</option>
                    </select>
                    <button className="text-theme-muted hover:text-theme-body cursor-pointer">
                      <span className="material-symbols-outlined text-sm block">fullscreen</span>
                    </button>
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="p-16 text-center text-theme-muted text-xs">
                    No matched SMRITI inventory items found. Adjust filter criteria or add a new catalog item.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse bg-theme-surface-1">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted font-bold text-[10px] uppercase tracking-wider border-b border-theme-border">
                          <th className="py-2.5 px-3 w-8">
                            <input
                              type="checkbox"
                              checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds(new Set(filteredProducts.map(p => p.id)));
                                } else {
                                  setSelectedIds(new Set());
                                }
                              }}
                              className="rounded border-theme-border bg-theme-surface-1 accent-theme-primary cursor-pointer"
                            />
                          </th>
                          <th className="py-2.5 px-3 w-8 font-mono">#</th>
                          <th className="py-2.5 px-3 font-mono">Barcode</th>
                          <th className="py-2.5 px-3">Item Name</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Brand</th>
                          <th className="py-2.5 px-3 text-right font-mono">MRP (₹)</th>
                          <th className="py-2.5 px-3 text-right font-mono">Rate (₹)</th>
                          <th className="py-2.5 px-3 text-right font-mono">Stock</th>
                          <th className="py-2.5 px-3">UOM</th>
                          <th className="py-2.5 px-3">Warehouse</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider text-[11px]">
                        {filteredProducts.map((p, idx) => (
                          <tr 
                            key={p.id} 
                            onClick={() => setSelectedProduct(p)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openMenu(e, {
                                module: "inventory",
                                type: "product",
                                object: p,
                                role: currentUser?.role || "Store Manager",
                                count: selectedIds.size || 1
                              });
                            }}
                            className={`hover:bg-theme-surface-hover cursor-pointer transition-colors ${
                              selectedProduct?.id === p.id ? "bg-theme-selection border-l-2 border-l-theme-primary" : ""
                            }`}
                          >
                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(p.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedIds);
                                  if (e.target.checked) newSet.add(p.id);
                                  else newSet.delete(p.id);
                                  setSelectedIds(newSet);
                                }}
                                className="rounded border-theme-border bg-theme-surface-1 accent-theme-primary cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 font-mono text-theme-muted">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-medium text-theme-body">{p.barcode}</td>
                            <td className="py-2 px-3 font-bold text-theme-body">{p.name}</td>
                            <td className="py-2 px-3 text-theme-muted">{p.category}</td>
                            <td className="py-2 px-3 text-theme-muted">{p.brand || "TATA"}</td>
                            <td className="py-2 px-3 text-right font-mono font-medium">₹{(p.mrp || p.price).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-theme-body">₹{p.price.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-theme-body">{p.stock}</td>
                            <td className="py-2 px-3 font-mono text-theme-muted">PCS</td>
                            <td className="py-2 px-3 text-theme-muted">Main Warehouse</td>
                            <td className="py-2 px-3 text-center">
                              <span className="bg-theme-success-bg text-theme-success border border-theme-success/30 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider font-mono">
                                Active
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center space-x-1 text-theme-muted">
                                <button
                                  onClick={() => setSelectedProduct(p)}
                                  className="p-1 rounded hover:bg-theme-surface-hover hover:text-theme-body cursor-pointer"
                                  title="View details"
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(p)}
                                  className="p-1 rounded hover:bg-theme-surface-hover hover:text-theme-primary cursor-pointer"
                                  title="Edit SKU details"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openMenu(e, {
                                      module: "inventory",
                                      type: "product",
                                      object: p,
                                      role: currentUser?.role || "Store Manager"
                                    });
                                  }}
                                  className="p-1 rounded hover:bg-theme-surface-hover hover:text-theme-body cursor-pointer"
                                  title="More Operations (ACAS)"
                                >
                                  <span className="material-symbols-outlined text-[15px] block">more_vert</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table Pagination Footer */}
                <div className="p-3 bg-theme-surface-1 border-t border-theme-divider flex flex-col sm:flex-row items-center justify-between text-xs text-theme-muted gap-2">
                  <div className="flex items-center space-x-2">
                    <span>Show</span>
                    <select className="bg-theme-surface-2 border border-theme-border rounded px-2 py-0.5 font-semibold text-theme-body">
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                    <span>entries</span>
                  </div>

                  <span className="font-mono">
                    Showing 1 to {filteredProducts.length} of {totalSkus.toLocaleString("en-IN")} entries
                  </span>

                  <div className="flex items-center space-x-1 font-mono text-xs">
                    <button className="px-2 py-1 rounded border border-theme-border hover:bg-theme-surface-hover cursor-pointer">&lt;</button>
                    <button className="px-2 py-1 rounded bg-theme-primary text-white font-bold cursor-pointer">1</button>
                    <button className="px-2 py-1 rounded border border-theme-border hover:bg-theme-surface-hover cursor-pointer">2</button>
                    <button className="px-2 py-1 rounded border border-theme-border hover:bg-theme-surface-hover cursor-pointer">3</button>
                    <button className="px-2 py-1 rounded border border-theme-border hover:bg-theme-surface-hover cursor-pointer">4</button>
                    <button className="px-2 py-1 rounded border border-theme-border hover:bg-theme-surface-hover cursor-pointer">5</button>
                    <span>...</span>
                    <button className="px-2 py-1 rounded border border-theme-border hover:bg-theme-surface-hover cursor-pointer">66</button>
                    <button className="px-2 py-1 rounded border border-theme-border hover:bg-theme-surface-hover cursor-pointer">&gt;</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1/3: Inspector Panel Drawer */}
            <div className="lg:col-span-1">
              {selectedProduct ? (
                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-4 shadow-xs sticky top-24">
                  {/* Item Image & Title Header */}
                  <div className="flex items-start justify-between border-b border-theme-divider pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                        {selectedProduct.primaryImageUrl ? (
                          <ProductImage
                            src={selectedProduct.primaryImageUrl}
                            alt={selectedProduct.name}
                            size="small"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-emerald-700 text-2xl">inventory_2</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-theme-body leading-tight">{selectedProduct.name}</h4>
                        <p className="text-[11px] text-theme-muted font-mono mt-0.5">
                          Barcode: <span className="text-theme-body font-semibold">{selectedProduct.barcode}</span>
                        </p>
                        <p className="text-[11px] text-theme-muted font-mono">
                          SKU: <span className="text-theme-body font-semibold">{selectedProduct.code}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="bg-theme-success-bg text-theme-success border border-theme-success/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                        Active
                      </span>
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="p-1 rounded text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Drawer Navigation Tabs */}
                  <div className="flex items-center space-x-4 border-b border-theme-divider pb-1 text-xs font-semibold">
                    {(["details", "stock", "purchase", "sales", "history"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setDrawerTab(tab)}
                        className={`pb-1.5 capitalize transition-all cursor-pointer ${
                          drawerTab === tab 
                            ? "text-theme-primary font-bold border-b-2 border-theme-primary" 
                            : "text-theme-muted hover:text-theme-body"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Details Grid */}
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">Category</span>
                      <span className="text-theme-body font-semibold">{selectedProduct.category}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">Brand</span>
                      <span className="text-theme-body font-semibold">{selectedProduct.brand || "TATA"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">MRP (₹)</span>
                      <span className="text-theme-body font-mono font-semibold">{(selectedProduct.mrp || selectedProduct.price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">Selling Rate (₹)</span>
                      <span className="text-theme-body font-mono font-bold text-emerald-600">{selectedProduct.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">UOM</span>
                      <span className="text-theme-body font-mono">PCS</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">HSN Code</span>
                      <span className="text-theme-body font-mono font-semibold">0902</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">GST Rate</span>
                      <span className="text-amber-600 font-mono font-bold">{selectedProduct.gstPercentage || 5}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">Stock</span>
                      <span className="text-theme-body font-mono font-bold">{selectedProduct.stock} PCS</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">Warehouse</span>
                      <span className="text-theme-body font-semibold">Main Warehouse</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">Location</span>
                      <span className="text-theme-body font-mono">A-01-02</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">Min. Stock</span>
                      <span className="text-theme-body font-mono">10</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-theme-muted">Max. Stock</span>
                      <span className="text-theme-body font-mono">100</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-theme-divider">
                      <span className="text-theme-muted">Description</span>
                      <span className="text-theme-body font-semibold">{selectedProduct.name} Pouch</span>
                    </div>
                  </div>

                  {/* Drawer Footer Buttons */}
                  <div className="flex items-center space-x-2 pt-2 border-t border-theme-divider">
                    <button
                      onClick={() => handleOpenEdit(selectedProduct)}
                      disabled={isReadOnly}
                      className={`flex-1 py-2 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover text-xs font-semibold text-center transition-colors ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      Edit Item
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openMenu(e, {
                          module: "inventory",
                          type: "product",
                          object: selectedProduct,
                          role: currentUser?.role || "Store Manager"
                        });
                      }}
                      className="px-3 py-2 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <span>More Actions</span>
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-6 text-center space-y-3 shadow-xs sticky top-24">
                  <div className="w-10 h-10 rounded-full bg-theme-surface-2 flex items-center justify-center text-theme-muted mx-auto border border-theme-border">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-theme-body">Select SKU to Inspect</h4>
                    <p className="text-xs text-theme-muted max-w-xs mx-auto mt-1 leading-relaxed">
                      Click any row in the catalog table to inspect inventory details, stock levels, warehouse locations, and rate rules.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Bottom Panels Row (Recent Transactions & Quick Actions matching reference image) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            
            {/* Left 2/3: Recent Transactions & Stock Movement */}
            <div className="lg:col-span-2 bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center space-x-6 border-b border-theme-divider pb-2 text-xs font-semibold">
                <button
                  onClick={() => setBottomTab("transactions")}
                  className={`pb-1.5 transition-all cursor-pointer ${bottomTab === "transactions" ? "text-theme-primary font-bold border-b-2 border-theme-primary" : "text-theme-muted hover:text-theme-body"}`}
                >
                  Recent Transactions
                </button>
                <button
                  onClick={() => setBottomTab("movement")}
                  className={`pb-1.5 transition-all cursor-pointer ${bottomTab === "movement" ? "text-theme-primary font-bold border-b-2 border-theme-primary" : "text-theme-muted hover:text-theme-body"}`}
                >
                  Stock Movement
                </button>
              </div>

              <div className="overflow-x-auto border border-theme-border rounded-lg">
                <table className="w-full text-left text-xs border-collapse bg-theme-surface-1">
                  <thead>
                    <tr className="bg-theme-surface-2 text-theme-muted font-bold text-[10px] uppercase tracking-wider border-b border-theme-border">
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 font-mono">Document No.</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Warehouse</th>
                      <th className="py-2 px-3 text-right font-mono">In Qty</th>
                      <th className="py-2 px-3 text-right font-mono">Out Qty</th>
                      <th className="py-2 px-3 text-right font-mono">Balance Qty</th>
                      <th className="py-2 px-3 text-right font-mono">Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-divider text-[11px]">
                    <tr className="hover:bg-theme-surface-hover">
                      <td className="py-2 px-3 font-medium text-theme-body">Sales Invoice</td>
                      <td className="py-2 px-3 font-mono text-theme-primary font-semibold">INV-10231</td>
                      <td className="py-2 px-3 text-theme-muted">16 Aug 2026</td>
                      <td className="py-2 px-3 text-theme-muted">Main Warehouse</td>
                      <td className="py-2 px-3 text-right font-mono text-theme-muted">-</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-red-600">2</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-theme-body">42</td>
                      <td className="py-2 px-3 text-right font-mono">270.00</td>
                    </tr>
                    <tr className="hover:bg-theme-surface-hover">
                      <td className="py-2 px-3 font-medium text-theme-body">Purchase Receipt</td>
                      <td className="py-2 px-3 font-mono text-theme-primary font-semibold">PR-10088</td>
                      <td className="py-2 px-3 text-theme-muted">15 Aug 2026</td>
                      <td className="py-2 px-3 text-theme-muted">Main Warehouse</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">24</td>
                      <td className="py-2 px-3 text-right font-mono text-theme-muted">-</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-theme-body">44</td>
                      <td className="py-2 px-3 text-right font-mono">245.00</td>
                    </tr>
                    <tr className="hover:bg-theme-surface-hover">
                      <td className="py-2 px-3 font-medium text-theme-body">Sales Invoice</td>
                      <td className="py-2 px-3 font-mono text-theme-primary font-semibold">INV-10222</td>
                      <td className="py-2 px-3 text-theme-muted">14 Aug 2026</td>
                      <td className="py-2 px-3 text-theme-muted">Main Warehouse</td>
                      <td className="py-2 px-3 text-right font-mono text-theme-muted">-</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-red-600">5</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-theme-body">20</td>
                      <td className="py-2 px-3 text-right font-mono">270.00</td>
                    </tr>
                    <tr className="hover:bg-theme-surface-hover">
                      <td className="py-2 px-3 font-medium text-theme-body">Purchase Receipt</td>
                      <td className="py-2 px-3 font-mono text-theme-primary font-semibold">PR-10077</td>
                      <td className="py-2 px-3 text-theme-muted">12 Aug 2026</td>
                      <td className="py-2 px-3 text-theme-muted">Main Warehouse</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">50</td>
                      <td className="py-2 px-3 text-right font-mono text-theme-muted">-</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-theme-body">25</td>
                      <td className="py-2 px-3 text-right font-mono">240.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right 1/3: Quick Actions */}
            <div className="lg:col-span-1 bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-3">
              <h4 className="font-bold text-xs text-theme-body uppercase tracking-wide font-mono">
                Quick Actions
              </h4>
              
              <div className="space-y-2 text-xs">
                <button 
                  onClick={() => onNotification("Quick Action", "Opening Stock Adjustment console...", "success")}
                  className="w-full flex items-center space-x-2.5 p-2.5 rounded-lg border border-theme-border hover:bg-theme-surface-hover text-theme-body font-semibold transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-theme-primary text-base">tune</span>
                  <span>Stock Adjustment</span>
                </button>

                <button 
                  onClick={() => onNotification("Quick Action", "Opening Stock Transfer module...", "success")}
                  className="w-full flex items-center space-x-2.5 p-2.5 rounded-lg border border-theme-border hover:bg-theme-surface-hover text-theme-body font-semibold transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-theme-primary text-base">swap_horiz</span>
                  <span>Transfer Stock</span>
                </button>

                <button 
                  onClick={() => setActiveTab("label-printing")}
                  className="w-full flex items-center space-x-2.5 p-2.5 rounded-lg border border-theme-border hover:bg-theme-surface-hover text-theme-body font-semibold transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-theme-primary text-base">print</span>
                  <span>Print Barcode Label</span>
                </button>

                <button 
                  onClick={() => onNotification("Quick Action", "Opening Stock Ledger report...", "success")}
                  className="w-full flex items-center space-x-2.5 p-2.5 rounded-lg border border-theme-border hover:bg-theme-surface-hover text-theme-body font-semibold transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-theme-primary text-base">inventory</span>
                  <span>View Stock Ledger</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {showPolicyModal && (
        <ImageDisplayPolicyModal
          onClose={() => setShowPolicyModal(false)}
          onSave={(newPolicy) => setDisplayPolicy(newPolicy)}
        />
      )}

    </div>
  );
};
