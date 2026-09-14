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
 * * Version    : 6.19.0
 * * Created    : 2026-09-14
 * * Modified   : 2026-09-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 *
 * SMRITI Sales Promotions & Schemes Studio
 * Human-First Visual Rule Builder & Simulation Workspace
 *
 * Features:
 *   1. 1-Click Popular Retail Recipes (BOGO, Flat %, Flat ₹, 3 for ₹999, Happy Hours, Spend & Save)
 *   2. Natural Language Rule Sentence ("Mad-Libs" format) for non-technical retail users
 *   3. Guided 4-Step Visual Wizard with zero technical jargon
 *   4. Embedded Interactive Cart Sandbox & Simulator for zero-risk pre-flight verification
 *   5. Full architectural parity with Tally Shoper 9's 13 canonical promotion types
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Tag,
  Percent,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  Search,
  Layers,
  ArrowRight,
  Gift,
  Package,
  ShoppingCart,
  Play,
  CheckCircle2,
  AlertCircle,
  Sliders,
  RefreshCw,
  X
} from "lucide-react";
import {
  SmritiSalesPromotionService,
  SmritiDefinedSalesPromotion,
  SmritiPromoLevel,
  SmritiPromoCategory,
  RetailPromotionRecipe,
  SimulatedCartLine,
  SimulationResult,
  SMRITI_PROMOTION_RECIPES
} from "../../services/smritiSalesPromotionService";
import { withCapability } from "../../types/architecture";

interface Props {
  onClose?: () => void;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info") => void;
}

const SAMPLE_SIMULATION_PRODUCTS: SimulatedCartLine[] = [
  { id: "sim-1", sku: "SHIRT-FORMAL-01", name: "Raymond Formal Shirt", category: "Apparel", brand: "Raymond", qty: 2, unitPrice: 1499 },
  { id: "sim-2", sku: "SHIRT-FORMAL-02", name: "Peter England Slim Shirt", category: "Apparel", brand: "Peter England", qty: 1, unitPrice: 1199 },
  { id: "sim-3", sku: "JEANS-DENIM-01", name: "Levi's 511 Slim Jeans", category: "Apparel", brand: "Levi's", qty: 1, unitPrice: 2499 },
  { id: "sim-4", sku: "SHOE-LEATHER-01", name: "Bata Derby Leather Shoes", category: "Footwear", brand: "Bata", qty: 1, unitPrice: 1899 },
  { id: "sim-5", sku: "BELT-LEATHER-01", name: "Woodland Leather Belt", category: "Accessories", brand: "Woodland", qty: 1, unitPrice: 799 }
];

const SmritiSalesPromotionsStudioBase: React.FC<Props> = ({ onClose, onNotification }) => {
  const [promotions, setPromotions] = useState<SmritiDefinedSalesPromotion[]>([]);
  const [activeTab, setActiveTab] = useState<"ACTIVE_LIST" | "BUILDER" | "SIMULATOR">("ACTIVE_LIST");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<"ALL" | SmritiPromoLevel>("ALL");
  const [syncStatus, setSyncStatus] = useState<"IDLE" | "SYNCING" | "SYNCHRONIZED" | "LOCAL_CACHE">("IDLE");

  // Builder State
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [editingPromo, setEditingPromo] = useState<SmritiDefinedSalesPromotion | null>(null);
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields (Human-First Defaults)
  const [formName, setFormName] = useState<string>("");
  const [formCode, setFormCode] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formLevel, setFormLevel] = useState<SmritiPromoLevel>("ITEM_LEVEL");
  const [formCategory, setFormCategory] = useState<SmritiPromoCategory>("ITEM_DISCOUNT_PERCENT");
  const [formDiscountValue, setFormDiscountValue] = useState<number>(20);
  const [formBuyQty, setFormBuyQty] = useState<number>(2);
  const [formFreeQty, setFormFreeQty] = useState<number>(1);
  const [formMinBillValue, setFormMinBillValue] = useState<number>(0);
  const [formMaxDiscount, setFormMaxDiscount] = useState<number>(1000);
  const [formFixedComboPrice, setFormFixedComboPrice] = useState<number>(1999);
  const [formAppliedOn, setFormAppliedOn] = useState<"LOWEST_PRICE" | "HIGHEST_PRICE" | "MRP" | "SELLING_PRICE">("LOWEST_PRICE");
  const [formCategories, setFormCategories] = useState<string[]>(["Apparel"]);
  const [formBrands, setFormBrands] = useState<string[]>([]);
  const [formCustomerGroups, setFormCustomerGroups] = useState<string[]>(["ALL"]);
  const [formValidFrom, setFormValidFrom] = useState<string>("2026-01-01");
  const [formValidTo, setFormValidTo] = useState<string>("2026-12-31");
  const [formIsHappyHours, setFormIsHappyHours] = useState<boolean>(false);
  const [formHappyHoursStart, setFormHappyHoursStart] = useState<string>("14:00");
  const [formHappyHoursEnd, setFormHappyHoursEnd] = useState<string>("17:00");
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
  const [formPriority, setFormPriority] = useState<number>(1);

  // Sandbox / Simulation State
  const [simCart, setSimCart] = useState<SimulatedCartLine[]>(SAMPLE_SIMULATION_PRODUCTS.slice(0, 3));
  const [simCustomerGroup, setSimCustomerGroup] = useState<string>("ALL");
  const [simTime, setSimTime] = useState<string>("15:00");
  const [simDay, setSimDay] = useState<string>("SAT");
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // Load initial promotions
  useEffect(() => {
    loadPromotions();
    void syncWithBackend();
  }, []);

  // Listen for background updates
  useEffect(() => {
    const handleUpdate = () => {
      setPromotions(SmritiSalesPromotionService.getAllDefinedPromotions());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("smriti_promotions_updated", handleUpdate);
      return () => window.removeEventListener("smriti_promotions_updated", handleUpdate);
    }
  }, []);

  const loadPromotions = () => {
    setPromotions(SmritiSalesPromotionService.getAllDefinedPromotions());
  };

  const syncWithBackend = async () => {
    setSyncStatus("SYNCING");
    try {
      const res = await SmritiSalesPromotionService.syncFromBackend();
      setPromotions(res.schemes);
      setSyncStatus(res.source === "DATABASE" ? "SYNCHRONIZED" : "LOCAL_CACHE");
    } catch {
      setSyncStatus("LOCAL_CACHE");
    }
  };

  // Pre-fill builder from a Recipe Preset
  const handleSelectRecipe = (recipe: RetailPromotionRecipe) => {
    setSelectedRecipe(recipe.id);
    const s = recipe.defaultScheme;
    setFormCode(s.code || `PROMO_${Date.now().toString().slice(-4)}`);
    setFormName(s.name || recipe.name);
    setFormDescription(s.description || recipe.tagline);
    setFormLevel(s.level || "ITEM_LEVEL");
    setFormCategory(s.category || "ITEM_DISCOUNT_PERCENT");
    setFormDiscountValue(s.discountValue ?? 10);
    setFormBuyQty(s.buyQty ?? 2);
    setFormFreeQty(s.freeQty ?? 1);
    setFormMinBillValue(s.minBillValue ?? 0);
    setFormMaxDiscount(s.maxDiscount ?? 1000);
    setFormFixedComboPrice(s.fixedComboPrice ?? 1999);
    setFormAppliedOn(s.appliedOn || "LOWEST_PRICE");
    setFormCategories(s.applicableCategories || ["Apparel"]);
    setFormBrands(s.applicableBrands || []);
    setFormCustomerGroups(s.applicableCustomerGroups || ["ALL"]);
    setFormIsHappyHours(Boolean(s.isHappyHours));
    setFormHappyHoursStart(s.happyHoursStart || "14:00");
    setFormHappyHoursEnd(s.happyHoursEnd || "17:00");
    setFormDaysOfWeek(s.daysOfWeek || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
    setFormPriority(s.priority ?? 1);

    setActiveTab("BUILDER");
    setBuilderStep(1);
    onNotification?.("Recipe Loaded", `Pre-filled builder with recipe: ${recipe.name}`, "info");
  };

  // Start a fresh custom promotion
  const handleStartNewCustom = () => {
    setSelectedRecipe(null);
    setEditingPromo(null);
    const randCode = `DEAL_${Math.floor(1000 + Math.random() * 9000)}`;
    setFormCode(randCode);
    setFormName("New Store Promotion");
    setFormDescription("Custom retail promotional scheme");
    setFormLevel("ITEM_LEVEL");
    setFormCategory("ITEM_DISCOUNT_PERCENT");
    setFormDiscountValue(15);
    setFormBuyQty(1);
    setFormFreeQty(0);
    setFormMinBillValue(0);
    setFormMaxDiscount(1500);
    setFormFixedComboPrice(1999);
    setFormAppliedOn("LOWEST_PRICE");
    setFormCategories(["Apparel"]);
    setFormBrands([]);
    setFormCustomerGroups(["ALL"]);
    setFormValidFrom("2026-01-01");
    setFormValidTo("2026-12-31");
    setFormIsHappyHours(false);
    setFormDaysOfWeek(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
    setFormPriority(promotions.length + 1);

    setActiveTab("BUILDER");
    setBuilderStep(1);
  };

  // Edit existing promotion
  const handleEditPromotion = (p: SmritiDefinedSalesPromotion) => {
    setEditingPromo(p);
    setSelectedRecipe(p.recipeId || null);
    setFormCode(p.code);
    setFormName(p.name);
    setFormDescription(p.description);
    setFormLevel(p.level);
    setFormCategory(p.category);
    setFormDiscountValue(p.discountValue);
    setFormBuyQty(p.buyQty ?? 1);
    setFormFreeQty(p.freeQty ?? 0);
    setFormMinBillValue(p.minBillValue ?? 0);
    setFormMaxDiscount(p.maxDiscount ?? 0);
    setFormFixedComboPrice(p.fixedComboPrice ?? 0);
    setFormAppliedOn(p.appliedOn || "LOWEST_PRICE");
    setFormCategories(p.applicableCategories || []);
    setFormBrands(p.applicableBrands || []);
    setFormCustomerGroups(p.applicableCustomerGroups || ["ALL"]);
    setFormValidFrom(p.validFrom);
    setFormValidTo(p.validTo);
    setFormIsHappyHours(Boolean(p.isHappyHours));
    setFormHappyHoursStart(p.happyHoursStart || "14:00");
    setFormHappyHoursEnd(p.happyHoursEnd || "17:00");
    setFormDaysOfWeek(p.daysOfWeek || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
    setFormPriority(p.priority);

    setActiveTab("BUILDER");
    setBuilderStep(1);
  };

  // Construct current draft object for preview & saving
  const currentDraftPromo = useMemo<SmritiDefinedSalesPromotion>(() => {
    return {
      id: editingPromo?.id || `sp-${formCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      code: formCode.trim().toUpperCase(),
      name: formName.trim(),
      description: formDescription.trim(),
      level: formLevel,
      category: formCategory,
      priority: formPriority,
      discountValue: Number(formDiscountValue) || 0,
      minBillValue: Number(formMinBillValue) || undefined,
      buyQty: formCategory === "ITEM_OFFER_B2G1" ? Number(formBuyQty) : undefined,
      freeQty: formCategory === "ITEM_OFFER_B2G1" ? Number(formFreeQty) : undefined,
      minQty: formCategory === "ITEM_OFFER_B2G1" ? Number(formBuyQty) + Number(formFreeQty) : undefined,
      maxDiscount: Number(formMaxDiscount) || undefined,
      fixedComboPrice: formCategory === "ITEM_BUNDLE_COMBO" ? Number(formFixedComboPrice) : undefined,
      appliedOn: formAppliedOn,
      applicableCategories: formCategories,
      applicableBrands: formBrands,
      applicableCustomerGroups: formCustomerGroups,
      validFrom: formValidFrom,
      validTo: formValidTo,
      isHappyHours: formIsHappyHours,
      happyHoursStart: formIsHappyHours ? formHappyHoursStart : undefined,
      happyHoursEnd: formIsHappyHours ? formHappyHoursEnd : undefined,
      daysOfWeek: formDaysOfWeek,
      recipeId: selectedRecipe || undefined,
      isActive: true,
      createdAt: editingPromo?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }, [
    editingPromo,
    formCode,
    formName,
    formDescription,
    formLevel,
    formCategory,
    formPriority,
    formDiscountValue,
    formMinBillValue,
    formBuyQty,
    formFreeQty,
    formMaxDiscount,
    formFixedComboPrice,
    formAppliedOn,
    formCategories,
    formBrands,
    formCustomerGroups,
    formValidFrom,
    formValidTo,
    formIsHappyHours,
    formHappyHoursStart,
    formHappyHoursEnd,
    formDaysOfWeek,
    selectedRecipe
  ]);

  // Dynamic Natural Language Sentence
  const naturalLanguageSummary = useMemo(() => {
    return SmritiSalesPromotionService.formatPromotionAsSentence(currentDraftPromo);
  }, [currentDraftPromo]);

  // Save Promotion
  const handleSavePromotion = async () => {
    if (!formCode.trim()) {
      onNotification?.("Validation Error", "Please enter a valid promotion code", "error");
      return;
    }
    if (!formName.trim()) {
      onNotification?.("Validation Error", "Please enter a human-readable scheme name", "error");
      return;
    }

    try {
      await SmritiSalesPromotionService.saveScheme(currentDraftPromo);
      loadPromotions();
      setActiveTab("ACTIVE_LIST");
      setEditingPromo(null);
      onNotification?.("Promotion Saved", `Scheme '${formName}' is now active across checkout terminals!`, "success");
    } catch {
      onNotification?.("Save Failed", "Could not save promotional scheme to database", "error");
    }
  };

  // Delete Promotion
  const handleDeletePromotion = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete scheme "${name}"?`)) return;
    try {
      await SmritiSalesPromotionService.deleteScheme(id);
      loadPromotions();
      onNotification?.("Scheme Deleted", `Promotion "${name}" was removed.`, "info");
    } catch {
      onNotification?.("Delete Failed", "Failed to delete scheme", "error");
    }
  };

  // Toggle Active State
  const handleToggleActive = async (promo: SmritiDefinedSalesPromotion) => {
    const updated = { ...promo, isActive: !promo.isActive };
    await SmritiSalesPromotionService.saveScheme(updated);
    loadPromotions();
    onNotification?.("Status Changed", `${promo.name} is now ${updated.isActive ? "ACTIVE" : "PAUSED"}`, "info");
  };

  // Run Simulation
  const handleRunSimulation = () => {
    const res = SmritiSalesPromotionService.simulateCart(simCart, currentDraftPromo, {
      customerGroup: simCustomerGroup,
      simulatedTime: simTime,
      simulatedDay: simDay
    });
    setSimulationResult(res);
  };

  // Run simulation automatically when draft or cart changes while in simulator tab
  useEffect(() => {
    if (activeTab === "SIMULATOR") {
      handleRunSimulation();
    }
  }, [activeTab, currentDraftPromo, simCart, simCustomerGroup, simTime, simDay]);

  // Quick Cart Items Manager for Simulation
  const handleAddSimItem = (prod: SimulatedCartLine) => {
    const existing = simCart.find(p => p.id === prod.id);
    if (existing) {
      setSimCart(simCart.map(p => p.id === prod.id ? { ...p, qty: p.qty + 1 } : p));
    } else {
      setSimCart([...simCart, { ...prod, qty: 1 }]);
    }
  };

  const handleRemoveSimItem = (id: string) => {
    setSimCart(simCart.filter(p => p.id !== id));
  };

  // Filtered list
  const filteredPromotions = useMemo(() => {
    return promotions.filter(p => {
      if (filterLevel !== "ALL" && p.level !== filterLevel) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [promotions, filterLevel, searchQuery]);

  // Active metrics
  const activeCount = promotions.filter(p => p.isActive).length;
  const happyHourCount = promotions.filter(p => p.isActive && p.isHappyHours).length;
  const billLevelCount = promotions.filter(p => p.isActive && p.level === "BILL_LEVEL").length;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none font-sans">
      {/* ─── TOP WORKSPACE HEADER ────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/90 px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center shadow-md shadow-rose-900/30">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Sales Promotions Studio</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Human-First Rule Engine
              </span>
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-400 border border-slate-700">
                Shoper 9 Parity (13 Types)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Define customer concessions, BOGO offers, happy hours & bill slabs in plain business language
            </p>
          </div>
        </div>

        {/* Header Telemetry & Quick Action Badges */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">{activeCount}</span> Active Deals
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{happyHourCount}</span> Happy Hours
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-blue-400">
              <Layers className="h-3.5 w-3.5" />
              <span>{billLevelCount}</span> Bill Slabs
            </div>
          </div>

          <button
            onClick={() => void syncWithBackend()}
            title="Synchronize with POS & PostgreSQL"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncStatus === "SYNCING" ? "animate-spin text-amber-400" : "text-slate-400"}`} />
            <span>{syncStatus === "SYNCHRONIZED" ? "Synced" : syncStatus === "SYNCING" ? "Syncing..." : "Sync POS"}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close Promotions Studio"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── PRIMARY WORKSPACE NAVIGATION TABS ───────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("ACTIVE_LIST")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "ACTIVE_LIST"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-900/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Tag className="h-4 w-4" />
            <span>Active Promotions Catalog ({promotions.length})</span>
          </button>

          <button
            onClick={() => {
              handleStartNewCustom();
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "BUILDER"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-900/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>{editingPromo ? "Edit Promotion" : "Visual Rule Builder"}</span>
          </button>

          <button
            onClick={() => setActiveTab("SIMULATOR")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "SIMULATOR"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-900/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Play className="h-4 w-4 text-emerald-400" />
            <span>Live Cart Sandbox & Simulator</span>
            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">Test Rules</span>
          </button>
        </div>

        {/* 1-Click Recipe Dropdown Quick Button */}
        {activeTab !== "BUILDER" && (
          <button
            onClick={handleStartNewCustom}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-medium text-xs rounded-lg shadow-md transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New Promotion</span>
          </button>
        )}
      </div>

      {/* ─── WORKSPACE CONTENT BODY ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
        {/* =================================================================== */}
        {/* TAB 1: ACTIVE PROMOTIONS LIST                                       */}
        {/* =================================================================== */}
        {activeTab === "ACTIVE_LIST" && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 1-Click Popular Retail Recipes Row */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                    1-Click Popular Retail Recipes (Instant Presets)
                  </h2>
                </div>
                <span className="text-xs text-slate-500">Click any card to pre-fill the rule builder</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {SMRITI_PROMOTION_RECIPES.map(recipe => (
                  <div
                    key={recipe.id}
                    onClick={() => handleSelectRecipe(recipe)}
                    className="group relative p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-rose-500/50 cursor-pointer transition-all shadow hover:shadow-rose-950/20 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-300 border border-rose-500/20">
                          {recipe.badge}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="text-sm font-bold text-white group-hover:text-rose-200 transition-colors">
                        {recipe.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {recipe.tagline}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <span>Formula:</span>
                      <span className="text-slate-300 truncate">{recipe.defaultScheme.code}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="relative w-full sm:w-96">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search schemes by name, code or description..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-xs text-slate-400">Level:</span>
                <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                  <button
                    onClick={() => setFilterLevel("ALL")}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      filterLevel === "ALL" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All ({promotions.length})
                  </button>
                  <button
                    onClick={() => setFilterLevel("ITEM_LEVEL")}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      filterLevel === "ITEM_LEVEL" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Item Level
                  </button>
                  <button
                    onClick={() => setFilterLevel("BILL_LEVEL")}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      filterLevel === "BILL_LEVEL" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Bill Slabs
                  </button>
                </div>
              </div>
            </div>

            {/* Promotions Table */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Scheme Details</th>
                      <th className="py-3 px-4">Category / Type</th>
                      <th className="py-3 px-4">Discount / Offer</th>
                      <th className="py-3 px-4">Schedule & Rules</th>
                      <th className="py-3 px-4">Customers</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPromotions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p>No promotions found matching current criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredPromotions.map(p => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono">
                            <span className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                              {p.priority}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white text-sm">{p.name}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                {p.code}
                              </span>
                              <span className="truncate max-w-xs">{p.description}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              p.level === "ITEM_LEVEL"
                                ? "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                                : "bg-purple-500/10 text-purple-300 border border-purple-500/30"
                            }`}>
                              {p.level === "ITEM_LEVEL" ? "Item Level" : "Bill Level"}
                            </span>
                            <div className="text-[11px] text-slate-400 mt-1 font-mono">
                              {p.category.replace(/^(ITEM_|BILL_)/, "")}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white">
                              {p.category === "ITEM_OFFER_B2G1"
                                ? `Buy ${p.buyQty} Get ${p.freeQty} FREE`
                                : p.category === "ITEM_BUNDLE_COMBO"
                                ? `Bundle for ₹${(p.fixedComboPrice || 1999).toLocaleString("en-IN")}`
                                : p.category.includes("PERCENT")
                                ? `${p.discountValue}% OFF`
                                : `₹${p.discountValue} OFF`}
                            </div>
                            {p.maxDiscount && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Max Cap: ₹{p.maxDiscount.toLocaleString("en-IN")}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>{p.validFrom} to {p.validTo}</span>
                            </div>
                            {p.isHappyHours && (
                              <div className="flex items-center gap-1.5 text-[10px] text-amber-400 mt-1">
                                <Clock className="h-3 w-3" />
                                <span>{p.happyHoursStart} - {p.happyHoursEnd}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {(p.applicableCustomerGroups || ["ALL"]).map(cg => (
                                <span key={cg} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
                                  {cg}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => void handleToggleActive(p)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                                p.isActive
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                                  : "bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700"
                              }`}
                            >
                              {p.isActive ? "Active" : "Paused"}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditPromotion(p)}
                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                title="Edit Scheme"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => void handleDeletePromotion(p.id, p.name)}
                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                                title="Delete Scheme"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: VISUAL RULE BUILDER (NON-TECHNICAL & HUMAN-FIRST)           */}
        {/* =================================================================== */}
        {activeTab === "BUILDER" && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Real-time Natural Language Summary Banner ("Mad-Libs" Result) */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-amber-950/30 border-2 border-rose-500/30 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-5 w-5 text-rose-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                      Rule in Plain Business English:
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Scheme Code: <strong className="text-white">{formCode}</strong>
                    </span>
                  </div>
                  <p className="text-base font-semibold text-white leading-relaxed">
                    "{naturalLanguageSummary}"
                  </p>
                </div>
              </div>
            </div>

            {/* 4-Step Wizard Navigation */}
            <div className="grid grid-cols-4 gap-2 border-b border-slate-800 pb-3">
              {[
                { step: 1, title: "1. Deal Type", desc: "Choose offer format" },
                { step: 2, title: "2. Trigger Conditions", desc: "What customer buys" },
                { step: 3, title: "3. Reward & Limits", desc: "Discount & price caps" },
                { step: 4, title: "4. Schedule & Scope", desc: "Timing & customers" }
              ].map(s => (
                <button
                  key={s.step}
                  onClick={() => setBuilderStep(s.step as any)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    builderStep === s.step
                      ? "bg-slate-900 border-rose-500 shadow-md shadow-rose-950/20"
                      : "bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                  }`}
                >
                  <div className={`text-xs font-bold ${builderStep === s.step ? "text-rose-400" : "text-slate-300"}`}>
                    {s.title}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{s.desc}</div>
                </button>
              ))}
            </div>

            {/* ── STEP 1: DEAL TYPE ────────────────────────────────────────── */}
            {builderStep === 1 && (
              <div className="space-y-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Tag className="h-4 w-4 text-rose-400" />
                  <span>Step 1: Select Deal Type & Give it a Name</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    {
                      category: "ITEM_DISCOUNT_PERCENT",
                      level: "ITEM_LEVEL",
                      title: "Percentage Off Items",
                      desc: "Instant % markdown on qualifying items (e.g. 20% Off)",
                      icon: Percent
                    },
                    {
                      category: "ITEM_DISCOUNT_FLAT",
                      level: "ITEM_LEVEL",
                      title: "Flat ₹ Concession per Item",
                      desc: "Fixed rupee amount off each piece (e.g. ₹100 Off)",
                      icon: Tag
                    },
                    {
                      category: "ITEM_OFFER_B2G1",
                      level: "ITEM_LEVEL",
                      title: "Buy X Get Y Free (BOGO)",
                      desc: "Buy qualifying units and get 1 or more pieces free",
                      icon: Gift
                    },
                    {
                      category: "ITEM_BUNDLE_COMBO",
                      level: "ITEM_LEVEL",
                      title: "Fixed Price Bundle Combo",
                      desc: "Bundle any 3 items for a fixed price (e.g. 3 for ₹1,999)",
                      icon: Package
                    },
                    {
                      category: "BILL_DISCOUNT_FLAT",
                      level: "BILL_LEVEL",
                      title: "Cart Value Spend Milestone",
                      desc: "Flat ₹ discount when total bill crosses amount (e.g. ₹500 off on ₹3,000)",
                      icon: ShoppingCart
                    },
                    {
                      category: "ITEM_LAST_PIECE",
                      level: "ITEM_LEVEL",
                      title: "Last Piece Stock Clearance",
                      desc: "Clearance discount triggered when selling the final unit in stock",
                      icon: Sparkles
                    }
                  ].map(dt => {
                    const Icon = dt.icon;
                    const isSelected = formCategory === dt.category;
                    return (
                      <div
                        key={dt.category}
                        onClick={() => {
                          setFormCategory(dt.category as any);
                          setFormLevel(dt.level as any);
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-rose-950/40 border-rose-500 shadow-md shadow-rose-950/30"
                            : "bg-slate-950 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className={`h-4 w-4 ${isSelected ? "text-rose-400" : "text-slate-400"}`} />
                          <span className={`text-sm font-bold ${isSelected ? "text-white" : "text-slate-200"}`}>
                            {dt.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{dt.desc}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Scheme Name (Customer & Cashier Facing) *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="e.g. Weekend Mega Sale 20% Off"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Short Scheme Code (Alpha-numeric) *
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={e => setFormCode(e.target.value.toUpperCase())}
                      placeholder="e.g. WKND20"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white uppercase font-mono placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: TRIGGER CONDITIONS ───────────────────────────────── */}
            {builderStep === 2 && (
              <div className="space-y-5 bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Package className="h-4 w-4 text-rose-400" />
                  <span>Step 2: What Items Must the Customer Buy?</span>
                </h3>

                {/* Categories Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Eligible Product Categories:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["Apparel", "Footwear", "Accessories", "Home", "Cosmetics", "Electronics"].map(cat => {
                      const isChecked = formCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setFormCategories(formCategories.filter(c => c !== cat));
                            } else {
                              setFormCategories([...formCategories, cat]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isChecked
                              ? "bg-rose-600 border-rose-500 text-white shadow-sm"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {isChecked ? "✓ " : "+ "} {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Brands Input (Comma Separated) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Specific Brands (Leave empty for all brands):
                  </label>
                  <input
                    type="text"
                    value={formBrands.join(", ")}
                    onChange={e => {
                      const list = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                      setFormBrands(list);
                    }}
                    placeholder="e.g. Raymond, Peter England, Louis Philippe"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Quantity & BOGO Controls */}
                {formCategory === "ITEM_OFFER_B2G1" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Customer Buys (Qty):
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formBuyQty}
                        onChange={e => setFormBuyQty(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Customer Gets Free (Qty):
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formFreeQty}
                        onChange={e => setFormFreeQty(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Which Piece is Discounted?
                      </label>
                      <select
                        value={formAppliedOn}
                        onChange={e => setFormAppliedOn(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                      >
                        <option value="LOWEST_PRICE">Cheapest Item (Recommended)</option>
                        <option value="HIGHEST_PRICE">Highest Priced Item</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Cart Milestone threshold */}
                {formLevel === "BILL_LEVEL" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Minimum Bill Amount to Qualify (₹):
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={formMinBillValue}
                      onChange={e => setFormMinBillValue(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Promotion triggers only when the customer's total bill net value reaches this threshold.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: REWARDS & LIMITS ─────────────────────────────────── */}
            {builderStep === 3 && (
              <div className="space-y-5 bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Percent className="h-4 w-4 text-rose-400" />
                  <span>Step 3: What Discount or Concession Do They Get?</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formCategory.includes("PERCENT") && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Discount Percentage (%):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={formDiscountValue}
                          onChange={e => setFormDiscountValue(Math.min(100, Math.max(1, Number(e.target.value))))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                  )}

                  {formCategory === "ITEM_DISCOUNT_FLAT" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Flat Rupee Discount per Piece (₹):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          value={formDiscountValue}
                          onChange={e => setFormDiscountValue(Math.max(1, Number(e.target.value)))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                      </div>
                    </div>
                  )}

                  {formCategory === "BILL_DISCOUNT_FLAT" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Flat Rupee Discount on Invoice (₹):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          value={formDiscountValue}
                          onChange={e => setFormDiscountValue(Math.max(1, Number(e.target.value)))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                      </div>
                    </div>
                  )}

                  {formCategory === "ITEM_BUNDLE_COMBO" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Fixed Bundle Combo Price (₹):
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formFixedComboPrice}
                        onChange={e => setFormFixedComboPrice(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Safety Max Discount Cap */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Maximum Discount Allowed per Bill (₹ Safety Cap):
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formMaxDiscount}
                      onChange={e => setFormMaxDiscount(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Protects gross margins by ensuring no customer receives more than this ceiling.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 4: SCHEDULE & TARGETING ─────────────────────────────── */}
            {builderStep === 4 && (
              <div className="space-y-5 bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-rose-400" />
                  <span>Step 4: Who Gets It and When is it Active?</span>
                </h3>

                {/* Date Ranges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date:</label>
                    <input
                      type="date"
                      value={formValidFrom}
                      onChange={e => setFormValidFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">End Date:</label>
                    <input
                      type="date"
                      value={formValidTo}
                      onChange={e => setFormValidTo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>

                {/* Days of Week Pills */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Active Days of Week:</label>
                  <div className="flex flex-wrap gap-2">
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(day => {
                      const isSelected = formDaysOfWeek.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (formDaysOfWeek.length > 1) {
                                setFormDaysOfWeek(formDaysOfWeek.filter(d => d !== day));
                              }
                            } else {
                              setFormDaysOfWeek([...formDaysOfWeek, day]);
                            }
                          }}
                          className={`w-12 py-2 rounded-lg text-xs font-bold border transition-all ${
                            isSelected
                              ? "bg-rose-600 border-rose-500 text-white"
                              : "bg-slate-950 border-slate-800 text-slate-500 hover:text-white"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Happy Hours Toggle */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <div>
                        <div className="text-xs font-bold text-white">Happy Hours Time Window</div>
                        <div className="text-[11px] text-slate-400">Limit discount to specific hours during the day</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formIsHappyHours}
                      onChange={e => setFormIsHappyHours(e.target.checked)}
                      className="h-4 w-4 rounded accent-rose-500 cursor-pointer"
                    />
                  </div>

                  {formIsHappyHours && (
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Start Time (24h):</label>
                        <input
                          type="time"
                          value={formHappyHoursStart}
                          onChange={e => setFormHappyHoursStart(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">End Time (24h):</label>
                        <input
                          type="time"
                          value={formHappyHoursEnd}
                          onChange={e => setFormHappyHoursEnd(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer Targeting */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Customer Groups:</label>
                  <div className="flex flex-wrap gap-2">
                    {["ALL", "VIP", "WHOLESALE", "CORPORATE", "STAFF"].map(cg => {
                      const isSelected = formCustomerGroups.includes(cg);
                      return (
                        <button
                          key={cg}
                          type="button"
                          onClick={() => {
                            if (cg === "ALL") {
                              setFormCustomerGroups(["ALL"]);
                            } else {
                              const withoutAll = formCustomerGroups.filter(g => g !== "ALL");
                              if (isSelected) {
                                const next = withoutAll.filter(g => g !== cg);
                                setFormCustomerGroups(next.length === 0 ? ["ALL"] : next);
                              } else {
                                setFormCustomerGroups([...withoutAll, cg]);
                              }
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? "bg-rose-600 border-rose-500 text-white"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {isSelected ? "✓ " : ""} {cg === "ALL" ? "All Customers" : cg}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Builder Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (builderStep > 1) {
                    setBuilderStep((builderStep - 1) as any);
                  } else {
                    setActiveTab("ACTIVE_LIST");
                  }
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
              >
                {builderStep === 1 ? "Cancel & Back to List" : "← Previous Step"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("SIMULATOR");
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Test in Simulator</span>
                </button>

                {builderStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setBuilderStep((builderStep + 1) as any)}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-rose-900/30"
                  >
                    <span>Next Step →</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSavePromotion()}
                    className="px-6 py-2 bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Save & Deploy Scheme to POS</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: LIVE INTERACTIVE CART SANDBOX & SIMULATOR                    */}
        {/* =================================================================== */}
        {activeTab === "SIMULATOR" && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Mock Cart & Scenario Settings (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-emerald-400" />
                    <span>Mock Customer Cart</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {simCart.reduce((a, b) => a + b.qty, 0)} Items
                  </span>
                </div>

                {/* Cart Items List */}
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
                  {simCart.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 bg-slate-950 rounded-lg">
                      Cart is empty. Add items from catalog below.
                    </div>
                  ) : (
                    simCart.map(item => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">{item.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {item.brand} • {item.category} • ₹{item.unitPrice.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono">x{item.qty}</span>
                          <button
                            onClick={() => handleRemoveSimItem(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Quick Mock Items */}
                <div className="border-t border-slate-800 pt-3">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Quick Add Sample Items:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_SIMULATION_PRODUCTS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddSimItem(p)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors"
                      >
                        + {p.name.split(" ")[0]} (₹{p.unitPrice})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scenario Conditions (Time, Day, Customer) */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-rose-400" />
                  <span>Simulation Environment</span>
                </h3>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Customer Group:</label>
                    <select
                      value={simCustomerGroup}
                      onChange={e => setSimCustomerGroup(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-white text-xs"
                    >
                      <option value="ALL">All Shoppers</option>
                      <option value="VIP">VIP Member</option>
                      <option value="WHOLESALE">Wholesale Tier</option>
                      <option value="STAFF">Store Staff</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Test Time (24h):</label>
                    <input
                      type="time"
                      value={simTime}
                      onChange={e => setSimTime(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Test Day:</label>
                    <select
                      value={simDay}
                      onChange={e => setSimDay(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-white text-xs"
                    >
                      {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleRunSimulation}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-950/30 transition-all mt-2"
                >
                  <Play className="h-4 w-4" />
                  <span>Re-Evaluate Simulation</span>
                </button>
              </div>
            </div>

            {/* Right Column: Live Mathematical Results (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Active Tested Rule Banner */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Currently Testing Scheme:</span>
                  <div className="text-sm font-bold text-white mt-0.5">{currentDraftPromo.name}</div>
                  <div className="text-xs text-slate-400 font-mono">[{currentDraftPromo.code}] • {currentDraftPromo.category}</div>
                </div>
                <button
                  onClick={() => setActiveTab("BUILDER")}
                  className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                >
                  Edit Rule Parameters
                </button>
              </div>

              {/* Outcome Feedback Card */}
              {simulationResult && (
                <div className={`p-5 rounded-2xl border ${
                  simulationResult.isEligible
                    ? "bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/20"
                    : "bg-amber-950/20 border-amber-500/40 shadow-amber-950/20"
                } shadow-lg space-y-4`}>
                  <div className="flex items-center gap-3">
                    {simulationResult.isEligible ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <h4 className={`text-base font-bold ${simulationResult.isEligible ? "text-emerald-300" : "text-amber-300"}`}>
                        {simulationResult.isEligible ? "Promotion Successfully Triggered!" : "Promotion Not Applicable"}
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {simulationResult.reason}
                      </p>
                    </div>
                  </div>

                  {/* Financial Breakdown Table */}
                  <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Item Description</th>
                          <th className="py-2.5 px-3 text-right">Qty</th>
                          <th className="py-2.5 px-3 text-right">Original</th>
                          <th className="py-2.5 px-3 text-right text-emerald-400">Discount</th>
                          <th className="py-2.5 px-3 text-right text-white">Final Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {simulationResult.lines.map((l, i) => (
                          <tr key={i} className="hover:bg-slate-900/30">
                            <td className="py-2.5 px-3 font-sans">
                              <div className="font-semibold text-slate-200">{l.name}</div>
                              <div className="text-[10px] text-slate-400">{l.appliedRule}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">x{l.qty}</td>
                            <td className="py-2.5 px-3 text-right text-slate-400">₹{l.originalLineTotal.toLocaleString("en-IN")}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                              {l.discountAmount > 0 ? `-₹${l.discountAmount.toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-white">
                              ₹{l.finalLineTotal.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Grand Totals */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400">Original Gross:</span>
                      <span className="font-mono font-bold text-slate-200 ml-2">
                        ₹{simulationResult.originalTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-400 font-semibold">Total Savings:</span>
                      <span className="font-mono font-bold text-emerald-300 ml-2">
                        ₹{simulationResult.discountTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-300 font-bold">Customer Pays:</span>
                      <span className="font-mono font-black text-rose-400 text-base ml-2">
                        ₹{simulationResult.finalTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const SmritiSalesPromotionsStudio = withCapability(SmritiSalesPromotionsStudioBase, {
  entity: "sales_promotion",
  capability: "sales_promotion.studio",
  role: "SPECIALIZED_UI",
  canonicalOwner: "SmritiSalesPromotionsStudio.tsx",
  decisionId: "ADR-PROMO-01",
});

export default SmritiSalesPromotionsStudio;
