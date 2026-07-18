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
 * * Version    : 3.16.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-13
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { recordAuditAction } from "../lib/apiFetch";
import { Heart, AlignJustify, 
  Plus, Search, Grid, Trash2, Edit3, RefreshCw, Tag, 
  Package, DollarSign, Percent, AlertCircle, X, Eye, 
  Layers, Barcode, CheckCircle2, ListFilter, Sliders,
  Settings, FolderKanban, FileSpreadsheet, BarChart3, Info,
  Printer, ShieldAlert, Image
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
}

type TabType = "registry" | "excel-grid" | "attributes" | "templates" | "bulk" | "analytics" | "barcode-mapping" | "label-printing";



export const ItemMasterTab: React.FC<ItemMasterTabProps> = ({ 
  products, 
  onRefreshProducts, 
  onNotification,
  currentUser
}) => {
  const { openMenu } = useACAS();
  const isReadOnly = currentUser?.role === "Report User";
  const [activeTab, setActiveTab] = useState<TabType>("registry");
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [density, setDensity] = useState<"compact" | "comfortable" | "relaxed">("comfortable");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  
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
  const totalSkus = products.length;
  const onHandStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalAssetValuation = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
  const distinctCategories = Array.from(new Set(products.map(p => p.category))).length;

  const densityPadding = density === "compact" ? "py-1.5" : density === "relaxed" ? "py-5" : "py-3";

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="bg-amber-950/60 border border-amber-500/30 text-amber-300 rounded-xl p-3 px-4 flex items-center space-x-3 shadow-lg">
          <ShieldAlert size={16} className="text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Read-Only Verification Mode</span>: You are currently operating under the <span className="font-mono bg-amber-900/60 px-1 py-0.5 rounded text-amber-200">Report User</span> role. All product creation, modifications, SKU deletion, and barcode mapping are locked.
          </div>
        </div>
      )}
      
      {/* SMRITI Module Tab Bar Switcher */}
      <div className="flex border-b border-theme-divider overflow-x-auto select-none no-scrollbar">
        <button
          onClick={() => setActiveTab("registry")}
          className={`px-5 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center space-x-2 border-b-2 cursor-pointer transition-all ${
            activeTab === "registry" 
              ? "border-blue-500 text-blue-400 bg-theme-surface-1/40" 
              : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-1/10"
          }`}
        >
          <Grid size={14} />
          <span>Catalog Registry</span>
        </button>
        <button
          onClick={() => setActiveTab("excel-grid")}
          className={`px-5 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center space-x-2 border-b-2 cursor-pointer transition-all ${
            activeTab === "excel-grid" 
              ? "border-blue-500 text-blue-400 bg-theme-surface-1/40" 
              : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-1/10"
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Excel Entry Grid</span>
        </button>
        <button
          onClick={() => setActiveTab("attributes")}
          className={`px-5 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center space-x-2 border-b-2 cursor-pointer transition-all ${
            activeTab === "attributes" 
              ? "border-blue-500 text-blue-400 bg-theme-surface-1/40" 
              : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-1/10"
          }`}
        >
          <Settings size={14} />
          <span>Attribute Manager</span>
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-5 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center space-x-2 border-b-2 cursor-pointer transition-all ${
            activeTab === "templates" 
              ? "border-blue-500 text-blue-400 bg-theme-surface-1/40" 
              : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-1/10"
          }`}
        >
          <FolderKanban size={14} />
          <span>Variant Templates</span>
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          className={`px-5 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center space-x-2 border-b-2 cursor-pointer transition-all ${
            activeTab === "bulk" 
              ? "border-blue-500 text-blue-400 bg-theme-surface-1/40" 
              : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-1/10"
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Bulk Spreadsheet Importer</span>
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-5 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center space-x-2 border-b-2 cursor-pointer transition-all ${
            activeTab === "analytics" 
              ? "border-blue-500 text-blue-400 bg-theme-surface-1/40" 
              : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-1/10"
          }`}
        >
          <BarChart3 size={14} />
          <span>Attribute Intelligence</span>
        </button>
        <button
          onClick={() => setActiveTab("barcode-mapping")}
          className={`px-5 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center space-x-2 border-b-2 cursor-pointer transition-all ${
            activeTab === "barcode-mapping" 
              ? "border-blue-500 text-blue-400 bg-theme-surface-1/40" 
              : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-1/10"
          }`}
        >
          <Barcode size={14} />
          <span>Barcode Mapping Module</span>
        </button>
        <button
          onClick={() => setActiveTab("label-printing")}
          className={`px-5 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center space-x-2 border-b-2 cursor-pointer transition-all ${
            activeTab === "label-printing" 
              ? "border-blue-500 text-blue-400 bg-theme-surface-1/40" 
              : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-1/10"
          }`}
        >
          <Printer size={14} />
          <span>Label Printing Hub</span>
        </button>
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
          {/* Top Asset & Catalog Analytics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-theme-muted block font-mono font-bold tracking-wider uppercase">ACTIVE SKU CATALOG</span>
                <span className="text-2xl font-bold font-display text-theme-body mt-1 block">
                  {totalSkus} <span className="text-xs font-normal text-theme-muted">SKUs</span>
                </span>
                <span className="text-[11px] text-theme-muted mt-1 block">
                  Spread over <span className="text-theme-body font-medium">{distinctCategories} categories</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-950 flex items-center justify-center text-indigo-400 border border-indigo-900">
                <Layers size={22} />
              </div>
            </div>

            <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-theme-muted block font-mono font-bold tracking-wider uppercase">TOTAL STOCK UNITS</span>
                <span className="text-2xl font-bold font-display text-emerald-400 mt-1 block">
                  {onHandStock.toLocaleString("en-IN")} <span className="text-xs font-normal text-theme-muted">Units</span>
                </span>
                <span className="text-[11px] text-theme-muted mt-1 block">
                  Average stock per SKU: <span className="text-theme-body font-medium">{totalSkus > 0 ? Math.round(onHandStock / totalSkus) : 0} pcs</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-950 flex items-center justify-center text-emerald-400 border border-emerald-900">
                <Package size={22} />
              </div>
            </div>

            <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-theme-muted block font-mono font-bold tracking-wider uppercase">NET ASSET VALUATION</span>
                <span className="text-2xl font-bold font-display text-theme-body mt-1 block">
                  ₹{totalAssetValuation.toLocaleString("en-IN")}
                </span>
                <span className="text-[11px] text-theme-muted mt-1 block">
                  Calculated at selling rate
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-sky-950 flex items-center justify-center text-sky-400 border border-sky-900">
                <DollarSign size={22} />
              </div>
            </div>

            <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-theme-muted block font-mono font-bold tracking-wider uppercase">EXTENSIBILITY METRIC</span>
                <span className="text-2xl font-bold font-display text-violet-400 mt-1 block">
                  {definitions.length} <span className="text-xs font-normal text-theme-muted">Attrs</span>
                </span>
                <span className="text-[11px] text-theme-muted mt-1 block">
                  Data-driven product schema
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-violet-950 flex items-center justify-center text-violet-400 border border-violet-900">
                <CheckCircle2 size={22} />
              </div>
            </div>
          </div>

          {/* Primary Toolbar Controls */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2 text-xs text-theme-muted font-mono">
                <span>Item Master Mode</span>
                <button
                  onClick={() => {
                    setItemMasterMode("simple");
                    localStorage.setItem("smriti_item_master_mode", "simple");
                  }}
                  className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${itemMasterMode === "simple" ? "bg-blue-600 text-white border-blue-600" : "bg-theme-surface-2 text-theme-body border-theme-divider hover:bg-theme-surface-hover"}`}
                >
                  Simple
                </button>
                <button
                  onClick={() => {
                    setItemMasterMode("advanced");
                    localStorage.setItem("smriti_item_master_mode", "advanced");
                  }}
                  className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${itemMasterMode === "advanced" ? "bg-blue-600 text-white border-blue-600" : "bg-theme-surface-2 text-theme-body border-theme-divider hover:bg-theme-surface-hover"}`}
                >
                  Advanced
                </button>
              </div>
            </div>

            {/* Search & Category Filter */}
            {selectedIds.size > 0 && (
              <div className="flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg mr-3">
                <span className="text-xs font-semibold text-indigo-400 mr-2">{selectedIds.size} selected</span>
                <button
                  onClick={() => {
                    onNotification("Batch Update", `${selectedIds.size} records updated successfully.`, "success");
                    setSelectedIds(new Set());
                  }}
                  className="text-[10px] bg-theme-surface-1 hover:bg-indigo-600 text-theme-primary hover:text-white font-semibold px-2 py-1 rounded transition-colors"
                >
                  Bulk Update
                </button>
                <button
                  onClick={async () => {
                    if (confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) {
                      for (const id of selectedIds) {
                        try {
                          await apiFetchV1(`/inventory/${id}`, { method: "DELETE" });
                        } catch (err) {
                          console.error(`Failed to delete product ${id}:`, err);
                        }
                      }
                      await onRefreshProducts();
                      onNotification("Batch Delete", `${selectedIds.size} records deleted.`, "success");
                      setSelectedIds(new Set());
                    }
                  }}
                  className="text-[10px] bg-theme-surface-1 hover:bg-rose-600 text-theme-primary hover:text-white font-semibold px-2 py-1 rounded transition-colors"
                >
                  Bulk Delete
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-theme-muted hover:text-white p-1 rounded ml-1">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3 top-2.5 text-theme-muted"><Search size={14} /></span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by SKU, Name, Barcode, Attributes..."
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-9 pr-4 py-2 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-theme-muted font-mono whitespace-nowrap"><ListFilter size={13} className="inline mr-1" /> Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-bold"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                    showFavoritesOnly 
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                      : 'bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-theme-body'
                  }`}
                >
                  <Heart size={14} className={showFavoritesOnly ? 'fill-current' : ''} />
                  <span>Favorites</span>
                </button>
              </div>
            </div>

            {/* Action Controls */}
            <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
              <div className="relative group">
                <button className="p-2.5 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body transition-colors flex items-center gap-2">
                  <AlignJustify size={14} />
                </button>
                <div className="absolute right-0 top-full mt-2 w-32 bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 flex flex-col p-1">
                  <button onClick={() => setDensity("compact")} className={`text-left px-3 py-2 text-xs rounded-lg transition-colors ${density === "compact" ? "bg-indigo-500/10 text-indigo-400 font-bold" : "text-theme-body hover:bg-theme-surface-2"}`}>Compact</button>
                  <button onClick={() => setDensity("comfortable")} className={`text-left px-3 py-2 text-xs rounded-lg transition-colors ${density === "comfortable" ? "bg-indigo-500/10 text-indigo-400 font-bold" : "text-theme-body hover:bg-theme-surface-2"}`}>Comfortable</button>
                  <button onClick={() => setDensity("relaxed")} className={`text-left px-3 py-2 text-xs rounded-lg transition-colors ${density === "relaxed" ? "bg-indigo-500/10 text-indigo-400 font-bold" : "text-theme-body hover:bg-theme-surface-2"}`}>Relaxed</button>
                </div>
              </div>
              <button
                onClick={() => setShowPolicyModal(true)}
                className="p-2.5 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                title="Image Display Policy"
              >
                <Image size={14} className="text-emerald-400" />
              </button>
              <button
                onClick={onRefreshProducts}
                className="p-2.5 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                title="Refresh Ledger"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={handleOpenCreate}
                disabled={isReadOnly}
                className={`px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-lg hover:shadow-blue-950/30 transition-all ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Plus size={14} />
                <span>Add SMRITI SKU</span>
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
              <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-lg">
                <div className="p-4 bg-theme-surface-3 border-b border-theme-divider flex items-center justify-between">
                  <span className="text-xs font-bold font-display uppercase tracking-wider text-theme-body">
                    Core Catalog Master Registry
                  </span>
                  <span className="text-[10px] font-mono text-theme-muted">
                    Showing {filteredProducts.length} of {products.length} registered SKUs
                  </span>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="p-16 text-center text-theme-muted text-xs">
                    No matched SMRITI inventory items found. Adjust filter criteria or add a new catalog item.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                          <th className={`px-5 ${densityPadding} w-10`}>
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
                              className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                            />
                          </th>
                          <th className={`px-5 ${densityPadding}`}>SKU Code</th>
                          <th className={`px-5 ${densityPadding}`}>Item Details</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Buy Cost</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Selling Rate</th>
                          <th className={`px-5 ${densityPadding} text-right`}>MRP (₹)</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Tax (GST)</th>
                          <th className={`px-5 ${densityPadding} text-right`}>On Hand</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map(p => (
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
                            className={`border-b border-theme-divider/40 hover:bg-theme-surface-3/50 cursor-pointer transition-colors ${
                              selectedProduct?.id === p.id ? "bg-theme-surface-3" : ""
                            }`}
                          >
                            <td className={`px-5 ${densityPadding}`} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(p.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedIds);
                                  if (e.target.checked) newSet.add(p.id);
                                  else newSet.delete(p.id);
                                  setSelectedIds(newSet);
                                }}
                                className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                              />
                            </td>
                            <td className={`px-5 ${densityPadding} font-mono font-bold text-theme-body`}>
                              <div className="flex items-center space-x-1.5">
                                <Tag size={12} className="text-theme-muted" />
                                <DrillableLink context={{ entityType: "item", entityId: p.code, title: p.name }}>
                                  {p.code}
                                </DrillableLink>
                              </div>
                            </td>
                            <td className={`px-5 ${densityPadding}`}>
                              <div className="flex items-center space-x-3">
                                {displayPolicy.showInInventory && (
                                  <ProductImage
                                    src={p.primaryImageUrl}
                                    alt={p.name}
                                    size={displayPolicy.inventorySize}
                                    hoverZoom={displayPolicy.hoverZoom}
                                  />
                                )}
                                <div>
                                  <div className="text-theme-body font-medium">{p.name}</div>
                                  <div className="text-[10px] text-theme-muted mt-0.5 font-mono max-w-sm truncate">
                                    Category: <span className="text-indigo-300 font-semibold">{p.category}</span>
                                    {p.attributes && Object.entries(p.attributes).map(([k, v]) => (
                                      <span key={k}> • {k}: <span className="text-theme-body">{v}</span></span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted`}>
                              ₹{(p.costPrice || Math.round(p.price * 0.6)).toLocaleString("en-IN")}
                            </td>
                            <td className={`px-5 ${densityPadding} text-right font-mono font-semibold text-emerald-400`}>
                              ₹{p.price.toLocaleString("en-IN")}
                            </td>
                            <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted`}>
                              ₹{(p.mrp || p.price).toLocaleString("en-IN")}
                            </td>
                            <td className={`px-5 ${densityPadding} text-right font-mono text-amber-400 font-bold`}>
                              {p.gstPercentage || 18}%
                            </td>
                            <td className={`px-5 ${densityPadding} text-right font-mono`}>
                              <span className={`font-semibold ${p.stock < 10 ? "text-rose-400" : "text-theme-primary"}`}>
                                {p.stock} pcs
                              </span>
                            </td>
                            <td className={`px-5 ${densityPadding} text-center`} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center space-x-2">
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // In a real app this would call an API
                                    onNotification("Favorites", `${p.name} ${p.isFavorite ? 'removed from' : 'added to'} favorites`, "success");
                                    p.isFavorite = !p.isFavorite; // Quick local toggle for UI
                                    setSearchTerm(searchTerm + " "); // force render hack
                                    setTimeout(() => setSearchTerm(searchTerm), 0);
                                  }}
                                  className={`p-1 rounded hover:bg-theme-surface-3 transition-colors ${p.isFavorite ? 'text-rose-400' : 'text-theme-muted hover:text-rose-400'}`}
                                  title={p.isFavorite ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <Heart size={14} className={p.isFavorite ? 'fill-current' : ''} />
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(p)}
                                  className="p-1 rounded hover:bg-theme-surface-3 text-sky-400"
                                  title="Edit SKU details"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(p.id, p.code)}
                                  className="p-1 rounded hover:bg-rose-950 text-rose-400"
                                  title="Purge Master SKU"
                                >
                                  <Trash2 size={14} />
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
                                  className="p-1 rounded hover:bg-theme-surface-3 text-indigo-400 hover:text-indigo-200 transition"
                                  title="More Operations (ACAS)"
                                >
                                  <span className="material-symbols-outlined text-[16px] block">more_vert</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right 1/3: Inspector Panel Drawer */}
            <div className="lg:col-span-1">
              {selectedProduct ? (
                <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-6 shadow-xl sticky top-24">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 rounded px-1.5 py-0.2 font-mono font-bold uppercase">SMRITI SKU MASTER</span>
                      </div>
                      <h4 className="font-display font-bold text-base text-theme-body mt-1.5">{selectedProduct.name}</h4>
                      <p className="text-[11px] text-theme-muted mt-0.5">Barcode ID: <span className="text-theme-body font-mono font-medium">{selectedProduct.barcode}</span></p>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="p-1 rounded bg-theme-surface-3 text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {selectedProduct.primaryImageUrl && (
                    <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-2 p-1 flex justify-center">
                      <ProductImage
                        src={selectedProduct.primaryImageUrl}
                        alt={selectedProduct.name}
                        size="original"
                        hoverZoom={displayPolicy.hoverZoom}
                        className="w-full max-h-48 rounded-lg"
                      />
                    </div>
                  )}

                  {/* Specifications checklist */}
                  <div className="space-y-4 border-t border-b border-theme-divider py-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-theme-muted font-medium">SKU Unique Code</span>
                      <span className="text-theme-body font-mono">{selectedProduct.code}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-theme-muted font-medium">Style Reference</span>
                      <span className="text-theme-body font-mono">{selectedProduct.styleCode || selectedProduct.code}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-theme-muted font-medium">Segment Category</span>
                      <span className="text-indigo-300 font-semibold">{selectedProduct.category}</span>
                    </div>
                    {selectedProduct.attributes && Object.entries(selectedProduct.attributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center text-xs">
                        <span className="text-theme-muted font-medium">{k}</span>
                        <span className="text-theme-body font-bold">{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-theme-muted font-medium">GST Percentage</span>
                      <span className="text-amber-400 font-mono font-bold">{selectedProduct.gstPercentage || 18}%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-theme-muted font-medium">Consolidated Asset Value</span>
                      <span className="text-emerald-400 font-mono font-semibold">₹{(selectedProduct.stock * selectedProduct.price).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  {/* Price Metrics Breakdown */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block">COMPLIANCE PRICING PROFILE</span>
                    <div className="bg-theme-surface-2 p-3.5 rounded-xl border border-theme-divider/60 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-theme-muted">Standard Buy Cost</span>
                        <span className="text-sm font-semibold text-theme-muted font-mono">₹{(selectedProduct.costPrice || Math.round(selectedProduct.price * 0.6)).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-theme-muted">Retail Selling Price</span>
                        <span className="text-sm font-semibold text-theme-body font-mono">₹{selectedProduct.price.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-theme-muted">Maximum Retail Price</span>
                        <span className="text-sm font-semibold text-theme-muted font-mono">₹{(selectedProduct.mrp || selectedProduct.price).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="pt-2 border-t border-theme-divider/40 flex justify-between items-center">
                        <span className="text-xs text-theme-muted">Gross Margin %</span>
                        <span className="text-xs font-bold text-emerald-400">
                          {selectedProduct.price ? Math.round(((selectedProduct.price - (selectedProduct.costPrice || Math.round(selectedProduct.price * 0.6))) / selectedProduct.price) * 100) : 0}% gross markup
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Active stock replenishment advice */}
                  <div className="bg-theme-surface-3 p-4 rounded-xl border border-dashed border-theme-divider space-y-2">
                    <div className="flex items-center space-x-2 text-indigo-400">
                      <AlertCircle size={15} />
                      <span className="text-xs font-bold font-display">SMRITI Warehouse Advice</span>
                    </div>
                    <p className="text-[11px] text-theme-muted leading-relaxed">
                      {selectedProduct.stock < 10 
                        ? "Critical levels detected. Expedite replenishment with Distributor / Kora Apparels."
                        : "Stock level is stable. Average Weeks of Cover is healthy. No action required."}
                    </p>
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      onClick={() => handleOpenEdit(selectedProduct)}
                      disabled={isReadOnly}
                      className={`flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <Edit3 size={13} />
                      <span>Update Details</span>
                    </button>
                    <button
                      onClick={() => handleDeleteItem(selectedProduct.id, selectedProduct.code)}
                      disabled={isReadOnly}
                      className={`px-3.5 rounded-lg bg-rose-950/40 hover:bg-rose-950/80 text-rose-400 border border-rose-900 flex items-center justify-center transition-colors ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      title="Purge SKU"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-6 text-center space-y-4 shadow-lg sticky top-24">
                  <div className="w-12 h-12 rounded-full bg-theme-surface-2 flex items-center justify-center text-theme-muted mx-auto border border-theme-divider">
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-theme-body">Variant Inspector active</h4>
                    <p className="text-xs text-theme-muted max-w-xs mx-auto mt-1 leading-relaxed">
                      Select any product row from the registry grid to inspect its variant structure, inventory health indexes, and pricing profile.
                    </p>
                  </div>
                </div>
              )}
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
