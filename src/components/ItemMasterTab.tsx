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
 * * Version    : 3.31.4
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-19
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { FioriObjectPage } from "./common/FioriObjectPage.tsx";
import { recordAuditAction } from "../lib/apiFetch";
import { Heart, AlignJustify, 
  Plus, Search, Grid, Trash2, Edit3, RefreshCw, Tag, 
  Package, DollarSign, Percent, AlertCircle, X, Eye, 
  Layers, Barcode, CheckCircle2, ListFilter, Sliders,
  Settings, FolderKanban, FileSpreadsheet, BarChart3, Info,
  Printer, ShieldAlert, Image, Maximize2, Sparkles, SlidersHorizontal, CheckSquare, Square
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
import { generateSkuCode, SkuMode, SkuFormatPattern, PRESET_SKU_TEMPLATES } from "../lib/skuGenerator";
import { ExpandedCellEditor, ExpandContextMenu } from "./ExpandedCellEditor";
import { UniversalLabelPrinterModal } from "./UniversalLabelPrinterModal.tsx";
import { UniversalLabelItem } from "../services/universalLabelPrinterService.ts";


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
  // WNG-002: activeTab state removed — FioriObjectPage manages tab state internally
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
  const [stockUnitLabel, setStockUnitLabel] = useState<string>(() => {
    return localStorage.getItem("smriti_stock_unit_label") || "Qty";
  });

  // View Details Modal state
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Range Filter states
  const [showRangeFilter, setShowRangeFilter] = useState<boolean>(false);
  const [minStockFilter, setMinStockFilter] = useState<string>("");
  const [maxStockFilter, setMaxStockFilter] = useState<string>("");
  const [minPriceFilter, setMinPriceFilter] = useState<string>("");
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>("");

  // Bulk Edit Modal state
  const [showBulkEditModal, setShowBulkEditModal] = useState<boolean>(false);
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [bulkPriceChangePercent, setBulkPriceChangePercent] = useState<string>("");
  const [bulkGst, setBulkGst] = useState<string>("");
  const [bulkStockAdd, setBulkStockAdd] = useState<string>("");

  // Suggest Best Autopilot state
  const [showSuggestBestModal, setShowSuggestBestModal] = useState<boolean>(false);

  // Universal Label Printer Modal state
  const [showUniversalLabelModal, setShowUniversalLabelModal] = useState<boolean>(false);

  // Validation Callout state for Barcode/SKU/Style No error guidance
  const [validationIssue, setValidationIssue] = useState<{
    title: string;
    field: string;
    identifierLabel: string;
    identifierValue: string;
    explanation: string;
    suggestedAction: string;
  } | null>(null);

  // Expand Cell capability state
  const [expandedCell, setExpandedCell] = useState<{
    rowIndex: number;
    field: string;
    label: string;
    value: string;
    product: Product;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIndex: number;
    field: string;
    label: string;
    value: string;
    product: Product;
  } | null>(null);

  const handleExpandCell = (rowIndex: number, field: string, label: string, value: string, product: Product) => {
    setContextMenu(null);
    setExpandedCell({ rowIndex, field, label, value, product });
  };

  const handleExpandConfirm = async (newValue: string) => {
    if (!expandedCell) return;
    const { product, field } = expandedCell;
    setExpandedCell(null);

    // Map field key to product payload update
    let updatedPayload: any = {
      name: product.name,
      code: product.code,
      price: product.price,
      stock: product.stock,
      category: product.category,
      barcode: product.barcode,
      mrp: product.mrp || product.price,
      gst_percentage: product.gstPercentage || 18,
      cost_price: product.costPrice || Math.round(product.price * 0.6),
      attributes: product.attributes || {},
    };

    if (field === "code") updatedPayload.code = newValue.trim();
    else if (field === "name") updatedPayload.name = newValue.trim();
    else if (field === "costPrice") updatedPayload.cost_price = parseFloat(newValue) || 0;
    else if (field === "price") updatedPayload.price = parseFloat(newValue) || 0;
    else if (field === "mrp") updatedPayload.mrp = parseFloat(newValue) || 0;
    else if (field === "gstPercentage") updatedPayload.gst_percentage = parseFloat(newValue) || 0;
    else if (field === "stock") updatedPayload.stock = parseInt(newValue) || 0;

    try {
      await apiFetchV1(`/inventory/${product.id}`, {
        method: "PUT",
        body: JSON.stringify(updatedPayload),
      });
      onNotification("Cell Value Updated", `Updated ${expandedCell.label} for product ${product.code}.`, "success");
      await onRefreshProducts();
    } catch (err: any) {
      onNotification("Update Failed", err.message || "Failed to update product cell value.", "error");
    }
  };

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
  
  // Dynamic Configurable SKU Engine States
  const [skuMode, setSkuMode] = useState<SkuMode>("auto");
  const [skuFormatPattern, setSkuFormatPattern] = useState<SkuFormatPattern>("STYLE_COLOR_SIZE");
  const [customSkuTemplate, setCustomSkuTemplate] = useState<string>("{style}-{color}-{size}");
  const [hybridPrefix, setHybridPrefix] = useState<string>("");
  
  // State for manual product custom attribute answers
  const [dynamicAttributes, setDynamicAttributes] = useState<Record<string, string>>({});

  // Reactive SKU auto-generation hook when parameters or attributes update
  useEffect(() => {
    if (skuMode === "manual" || isEditing) return;

    const colorVal = dynamicAttributes["Color"] || dynamicAttributes["color"] || dynamicAttributes["COLOR"] || "";
    const sizeVal = dynamicAttributes["Size"] || dynamicAttributes["size"] || dynamicAttributes["SIZE"] || "";
    const brandVal = dynamicAttributes["Brand"] || dynamicAttributes["brand"] || dynamicAttributes["BRAND"] || "";

    const computed = generateSkuCode({
      mode: skuMode,
      hybridPrefix,
      formatPattern: skuFormatPattern,
      customTemplate: customSkuTemplate,
      styleCode: formStyleCode || formName,
      color: colorVal,
      size: sizeVal,
      category: formCategory,
      brand: brandVal,
    });

    if (computed) {
      setFormCode(computed);
      setFormSku(computed);
    }
  }, [skuMode, skuFormatPattern, customSkuTemplate, hybridPrefix, formStyleCode, formName, formCategory, dynamicAttributes, isEditing]);

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
    setValidationIssue(null);
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
    setValidationIssue(null);
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
    setValidationIssue(null);
    const effectiveCode = formCode.trim() || (itemMasterMode === "simple" ? generateSimpleSku(formName) : "");
    const effectiveBarcode = formBarcode.trim() || (itemMasterMode === "simple" ? generateSimpleBarcode() : "");

    if (!formName.trim() || !effectiveCode || !effectiveBarcode) {
      const issue = {
        title: "Missing Required Fields",
        field: "general",
        identifierLabel: "Mandatory Fields",
        identifierValue: "Name, SKU Code, Barcode",
        explanation: "Product Name, SKU Code, and Barcode Identifier are required before saving.",
        suggestedAction: "Fill in the missing Product Name, SKU Code, and Barcode fields."
      };
      setValidationIssue(issue);
      onNotification("Missing Fields", issue.explanation, "error");
      return;
    }

    // 1. Client-Side Pre-Validation: Barcode Collision Check
    const dupBarcode = products.find(p => p.barcode.toLowerCase() === effectiveBarcode.toLowerCase() && (!isEditing || p.id !== selectedProduct?.id));
    if (dupBarcode) {
      const issue = {
        title: "Barcode Collision Detected",
        field: "barcode",
        identifierLabel: "Barcode Identifier",
        identifierValue: effectiveBarcode,
        explanation: `Barcode '${effectiveBarcode}' is already assigned to SKU '${dupBarcode.code}' (${dupBarcode.name}).`,
        suggestedAction: "Assign a unique barcode identifier or click 'Code Autopilot' to generate a fresh barcode."
      };
      setValidationIssue(issue);
      onNotification("Barcode Conflict", issue.explanation, "error");
      return;
    }

    // 2. Client-Side Pre-Validation: SKU Code Collision Check
    const dupSku = products.find(p => p.code.toLowerCase() === effectiveCode.toLowerCase() && (!isEditing || p.id !== selectedProduct?.id));
    if (dupSku) {
      const issue = {
        title: "SKU Code Conflict Detected",
        field: "code",
        identifierLabel: "SKU / Unique Code",
        identifierValue: effectiveCode,
        explanation: `SKU Code '${effectiveCode}' already exists in SMRITI catalog for product '${dupSku.name}'.`,
        suggestedAction: "Enter a unique SKU code or switch SKU Generation Mode to Auto/Hybrid to construct non-colliding codes."
      };
      setValidationIssue(issue);
      onNotification("SKU Conflict", issue.explanation, "error");
      return;
    }

    setLoading(true);
    try {
      // Validate mandatory attributes only in advanced mode
      if (itemMasterMode === "advanced") {
        for (const attr of activeGroupAttrs) {
          if (attr.isMandatory && !dynamicAttributes[attr.name]) {
            const issue = {
              title: "Mandatory Attribute Missing",
              field: attr.name,
              identifierLabel: `Attribute: ${attr.label}`,
              identifierValue: attr.name,
              explanation: `Please specify a value for required attribute "${attr.label}".`,
              suggestedAction: `Select or type a valid value for "${attr.label}" before proceeding.`
            };
            setValidationIssue(issue);
            onNotification("Mandatory Attribute", issue.explanation, "error");
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
        : "/inventory/";
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
      setValidationIssue(null);
      await onRefreshProducts();
    } catch (err: any) {
      const errMsg = err.message || "Failed to commit record.";
      let parsedTitle = "Validation Error";
      let parsedField = "general";
      let parsedLabel = "Barcode / SKU / Style No";
      let parsedValue = effectiveBarcode || effectiveCode || formStyleCode || "Master Item";
      let parsedExplanation = errMsg;
      let parsedAction = "Please review item parameters and try again.";

      if (errMsg.toLowerCase().includes("brand")) {
        parsedTitle = "Brand Validation Conflict";
        parsedLabel = "Brand Name";
        parsedExplanation = `The specified brand is invalid or restricted by system dictionary: ${errMsg}`;
        parsedAction = "Select a valid brand option or register the brand in Attribute Manager.";
      } else if (errMsg.toLowerCase().includes("barcode")) {
        parsedTitle = "Barcode Conflict";
        parsedLabel = "Barcode Identifier";
        parsedValue = effectiveBarcode;
        parsedExplanation = `Barcode '${effectiveBarcode}' failed validation: ${errMsg}`;
        parsedAction = "Change the barcode or use Code Autopilot.";
      } else if (errMsg.toLowerCase().includes("sku") || errMsg.toLowerCase().includes("code")) {
        parsedTitle = "SKU Code Conflict";
        parsedLabel = "SKU Code";
        parsedValue = effectiveCode;
        parsedExplanation = `SKU Code '${effectiveCode}' failed validation: ${errMsg}`;
        parsedAction = "Enter a unique SKU code.";
      }

      const issue = {
        title: parsedTitle,
        field: parsedField,
        identifierLabel: parsedLabel,
        identifierValue: parsedValue,
        explanation: parsedExplanation,
        suggestedAction: parsedAction
      };

      setValidationIssue(issue);
      onNotification(parsedTitle, parsedExplanation, "error");
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
    onNotification("Automation Active", "Suggested compliance codes injected.", "success");
  };

  /** Execute Bulk Edit on all checked items */
  const handleBulkEditConfirm = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setShowBulkEditModal(false);

    let updatedCount = 0;
    for (const id of selectedIds) {
      const targetProd = products.find(p => p.id === id);
      if (!targetProd) continue;

      let newCat = bulkCategory.trim() || targetProd.category;
      let newPrice = targetProd.price;
      if (bulkPriceChangePercent) {
        const pct = parseFloat(bulkPriceChangePercent) || 0;
        newPrice = Math.max(1, Math.round(targetProd.price * (1 + pct / 100)));
      }
      let newGst = bulkGst ? parseInt(bulkGst) || targetProd.gstPercentage || 18 : targetProd.gstPercentage || 18;
      let newStock = targetProd.stock;
      if (bulkStockAdd) {
        newStock = Math.max(0, targetProd.stock + (parseInt(bulkStockAdd) || 0));
      }

      try {
        await apiFetchV1(`/inventory/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: targetProd.name,
            code: targetProd.code,
            price: newPrice,
            stock: newStock,
            category: newCat,
            barcode: targetProd.barcode,
            mrp: targetProd.mrp || newPrice,
            gst_percentage: newGst,
            cost_price: targetProd.costPrice || Math.round(newPrice * 0.6),
            attributes: targetProd.attributes || {},
          }),
        });
        updatedCount++;
      } catch (err) {
        console.error(`Failed bulk update for item ${id}:`, err);
      }
    }

    setLoading(false);
    onNotification("Bulk Edit Complete", `Updated ${updatedCount} selected items successfully.`, "success");
    setSelectedIds(new Set());
    await onRefreshProducts();
  };

  /** AI Autopilot — Suggest Best Margins & Reorder Stock */
  const handleApplySuggestBest = async () => {
    setShowSuggestBestModal(false);
    setLoading(true);
    let optimized = 0;

    for (const p of products) {
      let needsUpdate = false;
      let targetCost = p.costPrice || Math.round(p.price * 0.6);
      let targetPrice = p.price;
      let targetMrp = p.mrp || Math.round(p.price * 1.25);
      let targetStock = p.stock;

      // Rule 1: Enforce minimum 25% gross margin over buy cost
      if (targetPrice < targetCost * 1.25) {
        targetPrice = Math.round(targetCost * 1.30);
        targetMrp = Math.round(targetPrice * 1.20);
        needsUpdate = true;
      }

      // Rule 2: Ensure MRP is at least 15% above selling price
      if (targetMrp < targetPrice) {
        targetMrp = Math.round(targetPrice * 1.20);
        needsUpdate = true;
      }

      // Rule 3: Reorder suggestion for low stock (< 5 pcs)
      if (targetStock < 5) {
        targetStock = 25; // Suggest default minimum reorder buffer
        needsUpdate = true;
      }

      if (needsUpdate) {
        try {
          await apiFetchV1(`/inventory/${p.id}`, {
            method: "PUT",
            body: JSON.stringify({
              name: p.name,
              code: p.code,
              price: targetPrice,
              stock: targetStock,
              category: p.category,
              barcode: p.barcode,
              mrp: targetMrp,
              gst_percentage: p.gstPercentage || 18,
              cost_price: targetCost,
              attributes: p.attributes || {},
            }),
          });
          optimized++;
        } catch (err) {
          console.error(`Suggest Best update failed for product ${p.id}:`, err);
        }
      }
    }

    setLoading(false);
    onNotification("AI Optimization Active", `Optimized margins and reorder targets for ${optimized} products.`, "success");
    await onRefreshProducts();
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

    // Range filtering rules
    const minS = minStockFilter !== "" ? parseInt(minStockFilter) || 0 : null;
    const maxS = maxStockFilter !== "" ? parseInt(maxStockFilter) || Infinity : null;
    const minP = minPriceFilter !== "" ? parseFloat(minPriceFilter) || 0 : null;
    const maxP = maxPriceFilter !== "" ? parseFloat(maxPriceFilter) || Infinity : null;

    const matchesStockRange = (minS === null || p.stock >= minS) && (maxS === null || p.stock <= maxS);
    const matchesPriceRange = (minP === null || p.price >= minP) && (maxP === null || p.price <= maxP);

    return matchesSearch && matchesCategory && matchesFavorites && matchesStockRange && matchesPriceRange;
  });

  // KPI Calculations
  const totalSkus = products.length;
  const onHandStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalAssetValuation = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
  const distinctCategories = Array.from(new Set(products.map(p => p.category))).length;

  const densityPadding = density === "compact" ? "py-1.5" : density === "relaxed" ? "py-5" : "py-3";

  return (
    <>
      {/* WNG-002: FioriObjectPage — Master Entity Pattern for Item Master Studio */}
      <FioriObjectPage
        title="Item Master Studio"
        subtitle={`${totalSkus} SKUs across ${distinctCategories} categories — ₹${totalAssetValuation.toLocaleString("en-IN")} asset valuation`}
        badgeStatus={{ label: isReadOnly ? "Read-Only Mode" : "Catalog Active", type: isReadOnly ? "warning" : "success" }}
        metrics={[
          { label: "Active SKUs", value: `${totalSkus} SKUs`, highlight: true },
          { label: "On-Hand Stock", value: `${onHandStock.toLocaleString("en-IN")} Units` },
          { label: "Asset Valuation", value: `₹${totalAssetValuation.toLocaleString("en-IN")}`, highlight: true },
          { label: "Attributes Defined", value: `${definitions.length} Attrs / ${groups.length} Groups` },
        ]}
        headerActions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSuggestBestModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer"
              title="AI Smart Autopilot — Optimize margins & reorder levels"
            >
              <Sparkles size={13} />
              <span>Suggest Best</span>
            </button>
            <button
              onClick={() => setShowPolicyModal(true)}
              className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Image Display Policy"
            >
              <Image size={14} className="text-emerald-400" />
            </button>
            <button
              onClick={onRefreshProducts}
              className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Refresh Ledger"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleOpenCreate}
              disabled={isReadOnly}
              className={`px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Plus size={14} />
              <span>Add SMRITI SKU</span>
            </button>
          </div>
        }
        tabs={[
          {
            id: "registry",
            label: "Catalog Registry",
            content: (
              <div className="space-y-5">
                {/* Read-Only Banner */}
                  <div className="bg-amber-950/60 border border-amber-500/30 text-amber-300 rounded-xl p-3 px-4 flex items-center space-x-3 shadow-lg">
                    <ShieldAlert size={16} className="text-amber-400 shrink-0" />
                    <div className="text-xs">
                      <span className="font-bold">Read-Only Verification Mode</span>: You are currently operating under the <span className="font-mono bg-amber-900/60 px-1 py-0.5 rounded text-amber-200">Report User</span> role. All product creation, modifications, SKU deletion, and barcode mapping are locked.
                    </div>
                  </div>
                )}

                {/* Primary Toolbar Controls */}
                <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2 text-xs text-theme-muted font-mono">
                      <span>Item Master Mode</span>
                      <button onClick={() => { setItemMasterMode("simple"); localStorage.setItem("smriti_item_master_mode", "simple"); }} className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${itemMasterMode === "simple" ? "bg-blue-600 text-white border-blue-600" : "bg-theme-surface-2 text-theme-body border-theme-divider hover:bg-theme-surface-hover"}`}>Simple</button>
                      <button onClick={() => { setItemMasterMode("advanced"); localStorage.setItem("smriti_item_master_mode", "advanced"); }} className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${itemMasterMode === "advanced" ? "bg-blue-600 text-white border-blue-600" : "bg-theme-surface-2 text-theme-body border-theme-divider hover:bg-theme-surface-hover"}`}>Advanced</button>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-theme-muted font-mono pl-0 sm:pl-3 border-t sm:border-t-0 sm:border-l border-theme-divider/40 pt-2 sm:pt-0">
                      <span>Unit:</span>
                      <select value={stockUnitLabel} onChange={(e) => { const val = e.target.value; setStockUnitLabel(val); localStorage.setItem("smriti_stock_unit_label", val); }} className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-bold focus:outline-none font-mono cursor-pointer">
                        <option value="Qty">Qty</option><option value="Pcs">Pcs</option><option value="Units">Units</option><option value="Box">Box</option><option value="Kg">Kg</option><option value="Mtr">Mtr</option><option value="Pair">Pair</option>
                      </select>
                    </div>
                  </div>

                  {selectedIds.size > 0 && (
                    <div className="flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg mr-3">
                      <span className="text-xs font-semibold text-indigo-400 mr-2">{selectedIds.size} selected</span>
                      <button onClick={() => setShowBulkEditModal(true)} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1 rounded transition-colors cursor-pointer">Bulk Edit Selected</button>
                      <button onClick={() => setShowUniversalLabelModal(true)} className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"><Printer size={12} /> Print Labels ({selectedIds.size})</button>
                      <button onClick={async () => { if (confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) { for (const id of selectedIds) { try { await apiFetchV1(`/inventory/${id}`, { method: "DELETE" }); } catch (err) { console.error(`Failed to delete product ${id}:`, err); } } await onRefreshProducts(); onNotification("Batch Delete", `${selectedIds.size} records deleted.`, "success"); setSelectedIds(new Set()); } }} className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1 rounded transition-colors cursor-pointer">Delete Selected ({selectedIds.size})</button>
                      <button onClick={() => setSelectedIds(new Set())} className="text-theme-muted hover:text-white p-1 rounded ml-1"><X size={14} /></button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
                    <div className="relative flex-1 max-w-md">
                      <span className="absolute left-3 top-2.5 text-theme-muted"><Search size={14} /></span>
                      <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by SKU, Name, Barcode, Attributes..." className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-9 pr-4 py-2 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-theme-muted font-mono whitespace-nowrap"><ListFilter size={13} className="inline mr-1" />Category:</span>
                      <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-bold cursor-pointer">
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => setShowRangeFilter(!showRangeFilter)} className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${showRangeFilter || minStockFilter || maxStockFilter || minPriceFilter || maxPriceFilter ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-theme-body'}`}>
                        <SlidersHorizontal size={13} /><span>Filter on Range</span>
                        {(minStockFilter || maxStockFilter || minPriceFilter || maxPriceFilter) && <span className="w-2 h-2 rounded-full bg-indigo-400"></span>}
                      </button>
                      <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${showFavoritesOnly ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-theme-body'}`}>
                        <Heart size={14} className={showFavoritesOnly ? 'fill-current' : ''} /><span>Favorites</span>
                      </button>
                      <div className="relative group">
                        <button className="p-2.5 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body transition-colors flex items-center gap-2"><AlignJustify size={14} /></button>
                        <div className="absolute right-0 top-full mt-2 w-32 bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 flex flex-col p-1">
                          <button onClick={() => setDensity("compact")} className={`text-left px-3 py-2 text-xs rounded-lg transition-colors ${density === "compact" ? "bg-indigo-500/10 text-indigo-400 font-bold" : "text-theme-body hover:bg-theme-surface-2"}`}>Compact</button>
                          <button onClick={() => setDensity("comfortable")} className={`text-left px-3 py-2 text-xs rounded-lg transition-colors ${density === "comfortable" ? "bg-indigo-500/10 text-indigo-400 font-bold" : "text-theme-body hover:bg-theme-surface-2"}`}>Comfortable</button>
                          <button onClick={() => setDensity("relaxed")} className={`text-left px-3 py-2 text-xs rounded-lg transition-colors ${density === "relaxed" ? "bg-indigo-500/10 text-indigo-400 font-bold" : "text-theme-body hover:bg-theme-surface-2"}`}>Relaxed</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Range Filter Bar */}
                {showRangeFilter && (
                  <div className="bg-[#141720] border border-indigo-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5"><SlidersHorizontal size={13} /> Range Filter Autopilot</span>
                      <button onClick={() => { setMinStockFilter(""); setMaxStockFilter(""); setMinPriceFilter(""); setMaxPriceFilter(""); }} className="text-[10px] font-mono text-slate-400 hover:text-rose-400 transition-colors">Clear Range Filters</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div><label className="text-[9px] font-mono text-slate-400 block mb-1">Min Stock ({stockUnitLabel})</label><input type="number" min="0" value={minStockFilter} onChange={(e) => setMinStockFilter(e.target.value)} placeholder="e.g. 0" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500" /></div>
                      <div><label className="text-[9px] font-mono text-slate-400 block mb-1">Max Stock ({stockUnitLabel})</label><input type="number" min="0" value={maxStockFilter} onChange={(e) => setMaxStockFilter(e.target.value)} placeholder="e.g. 100" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500" /></div>
                      <div><label className="text-[9px] font-mono text-slate-400 block mb-1">Min Price (₹)</label><input type="number" min="0" value={minPriceFilter} onChange={(e) => setMinPriceFilter(e.target.value)} placeholder="e.g. 100" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500" /></div>
                      <div><label className="text-[9px] font-mono text-slate-400 block mb-1">Max Price (₹)</label><input type="number" min="0" value={maxPriceFilter} onChange={(e) => setMaxPriceFilter(e.target.value)} placeholder="e.g. 5000" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500" /></div>
                    </div>
                  </div>
                )}

                {/* Create / Edit Form Panel */}
                {(isCreating || isEditing) && (
                  <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-200">
                    <div className="bg-theme-surface-3 border-b border-theme-divider px-6 py-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-display font-bold text-sm text-theme-body">{isEditing ? `Edit Master Record: ${formCode}` : "Quick Create SMRITI Item SKU"}</h3>
                        <p className="text-[11px] text-theme-muted">Treats dynamic attributes as data, satisfying multiple retail categories perfectly</p>
                      </div>
                      <button onClick={() => { setIsCreating(false); setIsEditing(false); setSelectedProduct(null); setDynamicAttributes({}); }} className="p-1 rounded bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors cursor-pointer"><X size={16} /></button>
                    </div>
                    <form onSubmit={handleSaveItem} className="p-6 space-y-5">
                      {validationIssue && (
                        <div className="bg-rose-950/90 border-2 border-rose-500/70 rounded-xl p-4 space-y-3 text-xs font-mono shadow-xl animate-in slide-in-from-top duration-200">
                          <div className="flex items-center justify-between border-b border-rose-500/40 pb-2">
                            <div className="flex items-center space-x-2 text-rose-300 font-bold"><AlertCircle size={16} className="text-rose-400 shrink-0" /><span>{validationIssue.title}</span></div>
                            <button type="button" onClick={() => setValidationIssue(null)} className="text-rose-400 hover:text-white p-0.5"><X size={14} /></button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-rose-900/40 p-3 rounded-lg border border-rose-500/20">
                            <div><span className="text-[9px] text-rose-300 uppercase block font-bold">Identifier Having Issue</span><span className="text-white font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-500/40 inline-block mt-1">{validationIssue.identifierLabel}: <strong className="text-amber-300 font-mono">{validationIssue.identifierValue}</strong></span></div>
                            <div><span className="text-[9px] text-rose-300 uppercase block font-bold">What Issue Needs to be Solved</span><span className="text-rose-200 leading-relaxed block mt-1">{validationIssue.explanation}</span></div>
                          </div>
                          <div className="bg-indigo-950/60 p-2.5 rounded-lg border border-indigo-500/30 text-indigo-200"><span className="text-[9px] text-indigo-400 uppercase font-bold block mb-0.5">💡 Suggested Action to Resolve</span><span>{validationIssue.suggestedAction}</span></div>
                        </div>
                      )}
                      {itemMasterMode === "simple" ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Item Display Name *</label><input type="text" required value={formName} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Vintage Leather Sneakers" className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500" /></div>
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Category / Group</label><select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"><option value="Apparel">Apparel</option><option value="Footwear">Footwear</option><option value="Pharmacy">Pharmacy</option><option value="Jewellery">Jewellery</option><option value="Accessories">Accessories</option><option value="General">General</option></select></div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">SKU Unique Code</label><input type="text" required disabled={isEditing} value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="Auto-generated for simple mode" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50" /></div>
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Barcode / POS Identifier</label><div className="relative"><span className="absolute left-3 top-2.5 text-theme-muted"><Barcode size={12} /></span><input type="text" required value={formBarcode} onChange={(e) => setFormBarcode(e.target.value)} placeholder="Auto-generated if blank" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg pl-8 pr-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div></div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Selling Price (₹)</label><input type="number" min="0" required value={formPrice || ""} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setFormPrice(val); if (!formMrp || formMrp < val) setFormMrp(Math.round(val * 1.25)); }} placeholder="Selling Price" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div>
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Purchase Price</label><input type="number" min="0" value={formCostPrice || ""} onChange={(e) => setFormCostPrice(parseFloat(e.target.value) || 0)} placeholder="Purchase Price" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div>
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">MRP</label><input type="number" min="0" value={formMrp || ""} onChange={(e) => setFormMrp(parseFloat(e.target.value) || 0)} placeholder="MRP" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">GST</label><select value={formGst} onChange={(e) => setFormGst(parseInt(e.target.value) || 18)} className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"><option value="0">0% GST</option><option value="5">5% GST</option><option value="18">18% GST</option><option value="40">40% GST</option></select></div>
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Stock</label><input type="number" min="0" value={formStock} onChange={(e) => setFormStock(Math.max(0, parseInt(e.target.value) || 0))} placeholder="Stock" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div>
                          </div>
                          <div className="bg-theme-surface-3 p-4 rounded-xl border border-theme-divider/50 space-y-2 text-[10px] text-theme-muted"><p className="font-semibold text-theme-body">Simple Mode</p><p>Only the essential SKU fields are shown. Advanced configuration is hidden so you can create items quickly.</p></div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Item Display Name *</label><input type="text" required value={formName} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Vintage Leather Sneakers" className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500" /></div>
                            <div><label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Category / Group</label><select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"><option value="Apparel">Apparel</option><option value="Footwear">Footwear</option><option value="Pharmacy">Pharmacy</option><option value="Jewellery">Jewellery</option><option value="Accessories">Accessories</option><option value="General">General</option></select></div>
                          </div>
                          <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400">{activeGroup ? `Dynamic schema: ${activeGroup.name}` : "General Core Specifications"}</span>
                              <button type="button" onClick={handleSuggestCodes} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center space-x-1 cursor-pointer"><Sliders size={11} /><span>Code Construction Autopilot</span></button>
                            </div>
                            {activeGroupAttrs.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {activeGroupAttrs.map(attr => (
                                  <div key={attr.id}>
                                    <label className="text-[9px] font-mono text-theme-muted block mb-1 uppercase">{attr.label} {attr.isMandatory && <span className="text-rose-400 font-bold">*</span>}</label>
                                    {attr.dataType === "select" ? (
                                      <select value={dynamicAttributes[attr.name] || ""} onChange={(e) => setDynamicAttributes(prev => ({ ...prev, [attr.name]: e.target.value }))} className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"><option value="">-- Pick option --</option>{attr.validValues.map(v => <option key={v} value={v}>{v}</option>)}</select>
                                    ) : (
                                      <input type={attr.dataType === "number" ? "number" : "text"} value={dynamicAttributes[attr.name] || ""} onChange={(e) => setDynamicAttributes(prev => ({ ...prev, [attr.name]: e.target.value }))} placeholder={`Enter ${attr.label}`} className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-theme-muted py-1 border-b border-theme-divider/20">No category-specific attributes found. Create attribute groups to map Apparel, Footwear, Saree, Sourcing, or Pharmacy attributes automatically.</div>
                            )}
                            <div className="bg-theme-surface-1 p-3.5 rounded-xl border border-indigo-500/20 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-divider/30 pb-2">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">SKU Generation Mode &amp; Pattern Configurator</span>
                                <div className="flex items-center space-x-1 font-mono text-[10px]">
                                  <span className="text-theme-muted mr-1">Mode:</span>
                                  {(["manual", "hybrid", "auto"] as const).map(mode => (
                                    <button key={mode} type="button" onClick={() => setSkuMode(mode)} className={`px-2 py-0.5 rounded font-semibold transition-colors ${skuMode === mode ? "bg-indigo-600 text-white" : "bg-theme-surface-2 text-theme-muted hover:text-white"}`}>{mode === "auto" ? "Auto (Formula)" : mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
                                  ))}
                                </div>
                              </div>
                              {skuMode !== "manual" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div><label className="text-[9px] font-mono text-theme-muted block mb-1">SKU Formula Pattern Format</label><select value={skuFormatPattern} onChange={(e) => setSkuFormatPattern(e.target.value as SkuFormatPattern)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono">{PRESET_SKU_TEMPLATES.map(tmpl => <option key={tmpl.id} value={tmpl.id}>{tmpl.label} ({tmpl.formula})</option>)}</select></div>
                                  {skuMode === "hybrid" ? (
                                    <div><label className="text-[9px] font-mono text-theme-muted block mb-1">Hybrid Custom Prefix</label><input type="text" value={hybridPrefix} onChange={(e) => setHybridPrefix(e.target.value)} placeholder="e.g. PREFIX-101" className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono uppercase" /></div>
                                  ) : skuFormatPattern === "CUSTOM" ? (
                                    <div><label className="text-[9px] font-mono text-theme-muted block mb-1">{"Custom Formula Template (\"{style}\", \"{color}\", \"{size}\")"}</label><input type="text" value={customSkuTemplate} onChange={(e) => setCustomSkuTemplate(e.target.value)} placeholder="{style}-{color}-{size}" className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono" /></div>
                                  ) : (
                                    <div className="flex items-center text-[10px] text-indigo-300 font-mono pt-4"><span>Formula preview: <strong className="text-white">{skuFormatPattern === "STYLE_COLOR_SIZE" ? "{StyleCode}-{Color}-{Size}" : skuFormatPattern === "STYLE_SIZE_COLOR" ? "{StyleCode}-{Size}-{Color}" : skuFormatPattern === "CAT_STYLE_COLOR_SIZE" ? "{Category}-{StyleCode}-{Color}-{Size}" : "{Brand}-{StyleCode}-{Color}-{Size}"}</strong></span></div>
                                  )}
                                </div>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div><label className="text-[9px] font-mono text-theme-muted block mb-1">Style Reference Code</label><input type="text" value={formStyleCode} onChange={(e) => setFormStyleCode(e.target.value)} placeholder="Style Code (e.g. STL-101)" className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono uppercase" /></div>
                                <div><label className="text-[9px] font-mono text-theme-muted block mb-1">SKU Unique Code * <span className="text-[9px] text-indigo-400 font-normal">({skuMode.toUpperCase()})</span></label><input type="text" required disabled={isEditing || skuMode !== "manual"} value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="SKU Code" className="w-full bg-theme-surface-2 border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono font-bold disabled:opacity-75 disabled:bg-theme-surface-3" /></div>
                              </div>
                              <div><label className="text-[9px] font-mono text-theme-muted block mb-1">Barcode / POS Identifier *</label><div className="relative"><span className="absolute left-3 top-2.5 text-theme-muted"><Barcode size={12} /></span><input type="text" required value={formBarcode} onChange={(e) => setFormBarcode(e.target.value)} placeholder="e.g. SMR-B301" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg pl-8 pr-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div></div>
                            </div>
                          </div>
                          <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-4">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 block">Financial &amp; Cost Configuration</span>
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                              <div><label className="text-[9px] font-mono text-theme-muted block mb-1">Buy Cost Price (₹) *</label><input type="number" min="0" required value={formCostPrice || ""} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setFormCostPrice(val); if (!formPrice) setFormPrice(Math.round(val * 1.5)); if (!formMrp) setFormMrp(Math.round(val * 1.8)); }} placeholder="Buy Cost Price" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div>
                              <div><label className="text-[9px] font-mono text-theme-muted block mb-1">Standard Price (₹) *</label><input type="number" min="0" required value={formPrice || ""} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setFormPrice(val); if (!formMrp || formMrp < val) setFormMrp(Math.round(val * 1.25)); }} placeholder="Selling Price" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div>
                              <div><label className="text-[9px] font-mono text-theme-muted block mb-1">Maximum Retail Price (MRP)</label><input type="number" min="0" value={formMrp || ""} onChange={(e) => setFormMrp(parseFloat(e.target.value) || 0)} placeholder="MRP (₹)" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div>
                              <div><label className="text-[9px] font-mono text-theme-muted block mb-1">GST Tax Category %</label><select value={formGst} onChange={(e) => setFormGst(parseInt(e.target.value) || 18)} className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"><option value="0">0% GST (Exempt/Essential)</option><option value="5">5% GST (Apparel &amp; Footwear ≤₹2,500)</option><option value="18">18% GST (Standard)</option><option value="40">40% GST (Luxury &amp; Sin Goods)</option></select></div>
                              <div><label className="text-[9px] font-mono text-theme-muted block mb-1">Initial Stock On Hand</label><input type="number" min="0" value={formStock} onChange={(e) => setFormStock(Math.max(0, parseInt(e.target.value) || 0))} placeholder="Opening Stock" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono" /></div>
                            </div>
                          </div>
                          <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-3">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 block">SMRITI Product Image Framework (SPIF)</span>
                            <div className="flex items-center space-x-4">
                              {formImage ? (
                                <div className="relative group w-16 h-16 rounded-xl overflow-hidden border border-theme-divider bg-theme-surface-3"><img src={formImage.startsWith("data:") ? formImage : `/api/v1${formImage}`} alt="Product Preview" className="w-full h-full object-cover" /><button type="button" onClick={() => setFormImage("")} className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 font-bold transition-opacity text-[10px]">Remove</button></div>
                              ) : (
                                <label className="flex flex-col items-center justify-center w-16 h-16 rounded-xl border border-dashed border-theme-divider hover:border-blue-500 bg-theme-surface-3 cursor-pointer transition-colors text-theme-muted hover:text-theme-body"><span className="material-symbols-outlined text-sm">add_a_photo</span><span className="text-[9px] font-mono mt-1">Upload</span><input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setFormImage(reader.result as string); }; reader.readAsDataURL(file); } }} /></label>
                              )}
                              <div className="flex-1 text-[10px] text-theme-muted font-mono leading-relaxed">Supported formats: JPG, PNG, WEBP.<br />Images are automatically optimized and converted to high-performance WebP.</div>
                            </div>
                          </div>
                        </>
                      )}
                      <div className="flex justify-end space-x-3 pt-3 border-t border-theme-divider/50">
                        <button type="button" onClick={() => { setIsCreating(false); setIsEditing(false); setSelectedProduct(null); }} className="px-4 py-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-xs font-semibold transition-colors cursor-pointer">Cancel Draft</button>
                        <button type="submit" disabled={loading} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-lg transition-colors cursor-pointer">{loading ? "Writing SKU..." : isEditing ? "Save Adjustments" : "Commit to SMRITI Database"}</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Main Grid: 2/3 table + 1/3 inspector */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-lg">
                      <div className="p-4 bg-theme-surface-3 border-b border-theme-divider flex items-center justify-between">
                        <span className="text-xs font-bold font-display uppercase tracking-wider text-theme-body">Core Catalog Master Registry</span>
                        <span className="text-[10px] font-mono text-theme-muted">Showing {filteredProducts.length} of {products.length} registered SKUs</span>
                      </div>
                      {filteredProducts.length === 0 ? (
                        <div className="p-16 text-center text-theme-muted text-xs">No matched SMRITI inventory items found. Adjust filter criteria or add a new catalog item.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                                <th className={`px-5 ${densityPadding} w-10`}><input type="checkbox" checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length} onChange={(e) => { if (e.target.checked) { setSelectedIds(new Set(filteredProducts.map(p => p.id))); } else { setSelectedIds(new Set()); } }} className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500" /></th>
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
                              {filteredProducts.map((p, idx) => (
                                <tr key={p.id} onClick={() => setSelectedProduct(p)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(e, { module: "inventory", type: "product", object: p, role: currentUser?.role || "Store Manager", count: selectedIds.size || 1 }); }} className={`border-b border-theme-divider/40 hover:bg-theme-surface-3/50 cursor-pointer transition-colors ${selectedProduct?.id === p.id ? "bg-theme-surface-3" : ""}`}>
                                  <td className={`px-5 ${densityPadding}`} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(p.id)} onChange={(e) => { const newSet = new Set(selectedIds); if (e.target.checked) newSet.add(p.id); else newSet.delete(p.id); setSelectedIds(newSet); }} className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500" /></td>
                                  <td className={`px-5 ${densityPadding} font-mono font-bold text-theme-body relative group/cell`} onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "code", "SKU Code", p.code, p); }}>
                                    <div className="flex items-center space-x-1.5"><Tag size={12} className="text-theme-muted" /><DrillableLink context={{ entityType: "item", entityId: p.code, title: p.name }}>{p.code}</DrillableLink></div>
                                    <button onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "code", "SKU Code", p.code, p); }} title="Expand cell (Double-click / F2)" className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"><Maximize2 size={10} /></button>
                                  </td>
                                  <td className={`px-5 ${densityPadding} relative group/cell`} onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "name", "Item Name & Details", p.name, p); }}>
                                    <div className="flex items-center space-x-3">
                                      {displayPolicy.showInInventory && (<ProductImage src={p.primaryImageUrl} alt={p.name} size={displayPolicy.inventorySize} hoverZoom={displayPolicy.hoverZoom} />)}
                                      <div><div className="text-theme-body font-medium">{p.name}</div><div className="text-[10px] text-theme-muted mt-0.5 font-mono max-w-sm truncate">Category: <span className="text-indigo-300 font-semibold">{p.category}</span>{p.attributes && Object.entries(p.attributes).map(([k, v]) => (<span key={k}> • {k}: <span className="text-theme-body">{v}</span></span>))}</div></div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "name", "Item Name & Details", p.name, p); }} title="Expand cell (Double-click / F2)" className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"><Maximize2 size={10} /></button>
                                  </td>
                                  <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted relative group/cell`} onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "costPrice", "Buy Cost", String(p.costPrice || Math.round(p.price * 0.6)), p); }}>₹{(p.costPrice || Math.round(p.price * 0.6)).toLocaleString("en-IN")}<button onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "costPrice", "Buy Cost", String(p.costPrice || Math.round(p.price * 0.6)), p); }} title="Expand cell" className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"><Maximize2 size={10} /></button></td>
                                  <td className={`px-5 ${densityPadding} text-right font-mono font-semibold text-emerald-400 relative group/cell`} onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "price", "Selling Rate", String(p.price), p); }}>₹{p.price.toLocaleString("en-IN")}<button onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "price", "Selling Rate", String(p.price), p); }} title="Expand cell" className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"><Maximize2 size={10} /></button></td>
                                  <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted relative group/cell`} onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "mrp", "MRP", String(p.mrp || p.price), p); }}>₹{(p.mrp || p.price).toLocaleString("en-IN")}<button onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "mrp", "MRP", String(p.mrp || p.price), p); }} title="Expand cell" className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"><Maximize2 size={10} /></button></td>
                                  <td className={`px-5 ${densityPadding} text-right font-mono text-amber-400 font-bold relative group/cell`} onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "gstPercentage", "GST %", String(p.gstPercentage || 18), p); }}>{p.gstPercentage || 18}%<button onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "gstPercentage", "GST %", String(p.gstPercentage || 18), p); }} title="Expand cell" className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"><Maximize2 size={10} /></button></td>
                                  <td className={`px-5 ${densityPadding} text-right font-mono relative group/cell`} onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "stock", "Stock On Hand", String(p.stock), p); }}><span className={`font-semibold ${p.stock < 10 ? "text-rose-400" : "text-theme-primary"}`}>{p.stock} {stockUnitLabel}</span><button onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "stock", "Stock On Hand", String(p.stock), p); }} title="Expand cell" className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"><Maximize2 size={10} /></button></td>
                                  <td className={`px-5 ${densityPadding} text-center`} onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center space-x-2">
                                      <button onClick={(e) => { e.stopPropagation(); onNotification("Favorites", `${p.name} ${p.isFavorite ? 'removed from' : 'added to'} favorites`, "success"); p.isFavorite = !p.isFavorite; setSearchTerm(searchTerm + " "); setTimeout(() => setSearchTerm(searchTerm), 0); }} className={`p-1 rounded hover:bg-theme-surface-3 transition-colors ${p.isFavorite ? 'text-rose-400' : 'text-theme-muted hover:text-rose-400'}`} title={p.isFavorite ? "Remove from favorites" : "Add to favorites"}><Heart size={14} className={p.isFavorite ? 'fill-current' : ''} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); setViewingProduct(p); }} className="p-1 rounded hover:bg-theme-surface-3 text-indigo-300 hover:text-white" title="View full product details"><Eye size={14} /></button>
                                      <button onClick={() => handleOpenEdit(p)} className="p-1 rounded hover:bg-theme-surface-3 text-sky-400" title="Edit SKU details"><Edit3 size={14} /></button>
                                      <button onClick={() => handleDeleteItem(p.id, p.code)} className="p-1 rounded hover:bg-rose-950 text-rose-400" title="Purge Master SKU"><Trash2 size={14} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); openMenu(e, { module: "inventory", type: "product", object: p, role: currentUser?.role || "Store Manager" }); }} className="p-1 rounded hover:bg-theme-surface-3 text-indigo-400 hover:text-indigo-200 transition" title="More Operations (ACAS)"><span className="material-symbols-outlined text-[16px] block">more_vert</span></button>
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

                  {/* Right Inspector Panel */}
                  <div className="lg:col-span-1">
                    {selectedProduct ? (
                      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-6 shadow-xl sticky top-24">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-2"><span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 rounded px-1.5 py-0.2 font-mono font-bold uppercase">SMRITI SKU MASTER</span></div>
                            <h4 className="font-display font-bold text-base text-theme-body mt-1.5">{selectedProduct.name}</h4>
                            <p className="text-[11px] text-theme-muted mt-0.5">Barcode ID: <span className="text-theme-body font-mono font-medium">{selectedProduct.barcode}</span></p>
                          </div>
                          <button onClick={() => setSelectedProduct(null)} className="p-1 rounded bg-theme-surface-3 text-theme-muted hover:text-theme-body transition-colors cursor-pointer"><X size={14} /></button>
                        </div>
                        {selectedProduct.primaryImageUrl && (
                          <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-2 p-1 flex justify-center">
                            <ProductImage src={selectedProduct.primaryImageUrl} alt={selectedProduct.name} size="original" hoverZoom={displayPolicy.hoverZoom} className="w-full max-h-48 rounded-lg" />
                          </div>
                        )}
                        <div className="space-y-4 border-t border-b border-theme-divider py-4">
                          <div className="flex justify-between items-center text-xs"><span className="text-theme-muted font-medium">SKU Unique Code</span><span className="text-theme-body font-mono">{selectedProduct.code}</span></div>
                          <div className="flex justify-between items-center text-xs"><span className="text-theme-muted font-medium">Style Reference</span><span className="text-theme-body font-mono">{selectedProduct.styleCode || selectedProduct.code}</span></div>
                          <div className="flex justify-between items-center text-xs"><span className="text-theme-muted font-medium">Segment Category</span><span className="text-indigo-300 font-semibold">{selectedProduct.category}</span></div>
                          {selectedProduct.attributes && Object.entries(selectedProduct.attributes).map(([k, v]) => (<div key={k} className="flex justify-between items-center text-xs"><span className="text-theme-muted font-medium">{k}</span><span className="text-theme-body font-bold">{v}</span></div>))}
                          <div className="flex justify-between items-center text-xs"><span className="text-theme-muted font-medium">GST Percentage</span><span className="text-amber-400 font-mono font-bold">{selectedProduct.gstPercentage || 18}%</span></div>
                          <div className="flex justify-between items-center text-xs"><span className="text-theme-muted font-medium">Consolidated Asset Value</span><span className="text-emerald-400 font-mono font-semibold">₹{(selectedProduct.stock * selectedProduct.price).toLocaleString("en-IN")}</span></div>
                        </div>
                        <div className="space-y-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block">COMPLIANCE PRICING PROFILE</span>
                          <div className="bg-theme-surface-2 p-3.5 rounded-xl border border-theme-divider/60 space-y-3">
                            <div className="flex justify-between items-center"><span className="text-xs text-theme-muted">Standard Buy Cost</span><span className="text-sm font-semibold text-theme-muted font-mono">₹{(selectedProduct.costPrice || Math.round(selectedProduct.price * 0.6)).toLocaleString("en-IN")}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs text-theme-muted">Retail Selling Price</span><span className="text-sm font-semibold text-theme-body font-mono">₹{selectedProduct.price.toLocaleString("en-IN")}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs text-theme-muted">Maximum Retail Price</span><span className="text-sm font-semibold text-theme-muted font-mono">₹{(selectedProduct.mrp || selectedProduct.price).toLocaleString("en-IN")}</span></div>
                            <div className="pt-2 border-t border-theme-divider/40 flex justify-between items-center"><span className="text-xs text-theme-muted">Gross Margin %</span><span className="text-xs font-bold text-emerald-400">{selectedProduct.price ? Math.round(((selectedProduct.price - (selectedProduct.costPrice || Math.round(selectedProduct.price * 0.6))) / selectedProduct.price) * 100) : 0}% gross markup</span></div>
                          </div>
                        </div>
                        <div className="bg-theme-surface-3 p-4 rounded-xl border border-dashed border-theme-divider space-y-2">
                          <div className="flex items-center space-x-2 text-indigo-400"><AlertCircle size={15} /><span className="text-xs font-bold font-display">SMRITI Warehouse Advice</span></div>
                          <p className="text-[11px] text-theme-muted leading-relaxed">{selectedProduct.stock < 10 ? "Critical levels detected. Expedite replenishment with Distributor / Kora Apparels." : "Stock level is stable. Average Weeks of Cover is healthy. No action required."}</p>
                        </div>
                        <div className="flex gap-2.5 pt-2">
                          <button onClick={() => handleOpenEdit(selectedProduct)} disabled={isReadOnly} className={`flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}><Edit3 size={13} /><span>Update Details</span></button>
                          <button onClick={() => handleDeleteItem(selectedProduct.id, selectedProduct.code)} disabled={isReadOnly} className={`px-3.5 rounded-lg bg-rose-950/40 hover:bg-rose-950/80 text-rose-400 border border-rose-900 flex items-center justify-center transition-colors ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`} title="Purge SKU"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-6 text-center space-y-4 shadow-lg sticky top-24">
                        <div className="w-12 h-12 rounded-full bg-theme-surface-2 flex items-center justify-center text-theme-muted mx-auto border border-theme-divider"><Sliders size={20} /></div>
                        <div><h4 className="font-display font-bold text-sm text-theme-body">Variant Inspector active</h4><p className="text-xs text-theme-muted max-w-xs mx-auto mt-1 leading-relaxed">Select any product row from the registry grid to inspect its variant structure, inventory health indexes, and pricing profile.</p></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "excel-grid",
            label: "Excel Entry Grid",
            content: <ExcelGridEntrySection onRefreshProducts={onRefreshProducts} onNotification={onNotification} />,
          },
          {
            id: "attributes",
            label: "Attribute Manager",
            content: <AttributeManagerSection onNotification={onNotification} />,
          },
          {
            id: "templates",
            label: "Variant Templates",
            content: <VariantTemplateSection products={products} onRefreshProducts={onRefreshProducts} onNotification={onNotification} />,
          },
          {
            id: "bulk",
            label: "Bulk Importer",
            content: <BulkImportSection onRefreshProducts={onRefreshProducts} onNotification={onNotification} />,
          },
          {
            id: "analytics",
            label: "Attribute Intelligence",
            content: <AttributeAnalyticsSection onNotification={onNotification} />,
          },
          {
            id: "barcode-mapping",
            label: "Barcode Mapping",
            content: <BarcodeMappingSection products={products} onNotification={onNotification} onRefreshProducts={onRefreshProducts} />,
          },
          {
            id: "label-printing",
            label: "Label Printing Hub",
            content: <LabelPrintingSection onNotification={onNotification} currentUser={currentUser} />,
          },
        ]}
      />

      {/* ── Product Inspection / View Details Modal ─────────────────────────── */}
      {viewingProduct && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#141720] border border-indigo-500/30 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#1a1e2b] border-b border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400"><Eye size={18} /></div>
                <div><h3 className="text-sm font-bold text-white">{viewingProduct.name}</h3><span className="text-[10px] font-mono text-indigo-300 uppercase">SKU: {viewingProduct.code}</span></div>
              </div>
              <button onClick={() => setViewingProduct(null)} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"><X size={16} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 font-mono text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div><span className="text-[9px] text-slate-500 uppercase block">Category</span><span className="text-white font-bold">{viewingProduct.category}</span></div>
                <div><span className="text-[9px] text-slate-500 uppercase block">Barcode</span><span className="text-indigo-300 font-bold">{viewingProduct.barcode}</span></div>
                <div><span className="text-[9px] text-slate-500 uppercase block">Stock On Hand</span><span className="text-emerald-400 font-bold">{viewingProduct.stock} {stockUnitLabel}</span></div>
                <div><span className="text-[9px] text-slate-500 uppercase block">GST Tax %</span><span className="text-amber-400 font-bold">{viewingProduct.gstPercentage || 18}%</span></div>
              </div>
              <div className="grid grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center">
                <div><span className="text-[9px] text-slate-500 uppercase block">Buy Cost Price</span><span className="text-slate-300 text-sm font-bold">₹{(viewingProduct.costPrice || Math.round(viewingProduct.price * 0.6)).toLocaleString("en-IN")}</span></div>
                <div><span className="text-[9px] text-slate-500 uppercase block">Selling Rate</span><span className="text-emerald-400 text-sm font-bold">₹{viewingProduct.price.toLocaleString("en-IN")}</span></div>
                <div><span className="text-[9px] text-slate-500 uppercase block">Max Retail Price</span><span className="text-white text-sm font-bold">₹{(viewingProduct.mrp || viewingProduct.price).toLocaleString("en-IN")}</span></div>
              </div>
              {viewingProduct.attributes && Object.keys(viewingProduct.attributes).length > 0 && (
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase block">Dynamic Attribute Specifications</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">{Object.entries(viewingProduct.attributes).map(([k, v]) => (<div key={k} className="flex justify-between border-b border-slate-800 pb-1"><span className="text-slate-400">{k}:</span><span className="text-white font-bold">{v}</span></div>))}</div>
                </div>
              )}
            </div>
            <div className="px-6 py-3 bg-[#1a1e2b] border-t border-indigo-500/20 flex items-center justify-between">
              <button onClick={() => { const prod = viewingProduct; setViewingProduct(null); handleOpenEdit(prod); }} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition">Edit Product Details</button>
              <button onClick={() => setViewingProduct(null)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Edit Selected Modal ──────────────────────────────────────────── */}
      {showBulkEditModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#141720] border border-indigo-500/40 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#1a1e2b] border-b border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-indigo-400" /><h3 className="text-sm font-bold text-white">Bulk Edit ({selectedIds.size} Items Selected)</h3></div>
              <button onClick={() => setShowBulkEditModal(false)} className="p-1 text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4 text-xs font-mono">
              <div><label className="text-[10px] text-slate-400 block mb-1">Set Category for All Selected</label><select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"><option value="">-- Keep Existing Categories --</option>{categories.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="text-[10px] text-slate-400 block mb-1">Adjust Selling Price By % (+10% or -5%)</label><input type="number" value={bulkPriceChangePercent} onChange={(e) => setBulkPriceChangePercent(e.target.value)} placeholder="e.g. 10 for +10% increase, -5 for discount" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-indigo-500" /></div>
              <div><label className="text-[10px] text-slate-400 block mb-1">Set GST Tax Rate %</label><select value={bulkGst} onChange={(e) => setBulkGst(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"><option value="">-- Keep Existing GST % --</option><option value="0">0% GST</option><option value="5">5% GST</option><option value="18">18% GST</option><option value="40">40% GST</option></select></div>
              <div><label className="text-[10px] text-slate-400 block mb-1">Add Stock Units to On-Hand (+Qty)</label><input type="number" value={bulkStockAdd} onChange={(e) => setBulkStockAdd(e.target.value)} placeholder="e.g. 50 (adds 50 units to stock on hand)" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-indigo-500" /></div>
            </div>
            <div className="px-6 py-4 bg-[#1a1e2b] border-t border-indigo-500/20 flex justify-end gap-3">
              <button onClick={() => setShowBulkEditModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg">Cancel</button>
              <button onClick={handleBulkEditConfirm} disabled={loading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg">{loading ? "Updating Selected..." : `Apply Bulk Edit to ${selectedIds.size} Items`}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Suggest Best Autopilot Modal ──────────────────────────────────── */}
      {showSuggestBestModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#141720] border border-amber-500/40 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#1a1e2b] border-b border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2"><Sparkles size={16} className="text-amber-400" /><h3 className="text-sm font-bold text-white">AI Smart Autopilot — Suggest Best</h3></div>
              <button onClick={() => setShowSuggestBestModal(false)} className="p-1 text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
              <p className="text-amber-300 font-bold">The Smart Autopilot will analyze all {products.length} catalog items and apply optimization rules:</p>
              <ul className="space-y-2 text-[11px] list-disc pl-4 text-slate-400">
                <li><strong className="text-white">Margin Compliance:</strong> Enforces minimum 25% gross margin over buy cost on all products.</li>
                <li><strong className="text-white">MRP Alignment:</strong> Ensures MRP is at least 20% above selling rate for price compliance.</li>
                <li><strong className="text-white">Stock Buffer Suggestion:</strong> Replenishes low stock (&lt; 5 {stockUnitLabel}) up to the recommended buffer of 25 {stockUnitLabel}.</li>
              </ul>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400">Ready to optimize catalog pricing &amp; inventory levels across SMRITI Master DB.</div>
            </div>
            <div className="px-6 py-4 bg-[#1a1e2b] border-t border-amber-500/20 flex justify-end gap-3">
              <button onClick={() => setShowSuggestBestModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg">Cancel</button>
              <button onClick={handleApplySuggestBest} disabled={loading} className="px-5 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg">{loading ? "Optimizing Catalog..." : "Run AI Autopilot Optimization"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Label Printer Modal */}
      <UniversalLabelPrinterModal
        isOpen={showUniversalLabelModal}
        onClose={() => setShowUniversalLabelModal(false)}
        moduleSource="Item Master"
        onNotification={onNotification}
        items={products.map(p => ({
          id: p.id,
          item_code: p.code || p.sku || "ITEM-001",
          barcode: p.barcode || "8901234560000",
          sku: p.sku || p.code || "SKU-001",
          name: p.name,
          category: p.category || "General",
          brand: p.brand || "SMRITI",
          price: p.price,
          cost_price: p.costPrice || (p as any).cost_price || 0,
          mrp: p.mrp || p.price,
          stock_qty: p.stock ?? (p as any).stock_qty ?? 0,
          received_qty: p.stock ?? (p as any).stock_qty ?? 0,
          sold_qty: 0,
          style_code: p.code || p.sku
        }))}
      />

      {/* Image Display Policy Modal (SPIF) — previously missing from render */}
      {showPolicyModal && (
        <ImageDisplayPolicyModal
          policy={displayPolicy}
          onSave={(p) => {
            setDisplayPolicy(p);
            localStorage.setItem("smriti_spif_display_policy", JSON.stringify(p));
            setShowPolicyModal(false);
          }}
          onClose={() => setShowPolicyModal(false)}
        />
      )}

      {/* Expand Cell Editor — previously missing from render */}
      {expandedCell && (
        <ExpandedCellEditor
          rowIndex={expandedCell.rowIndex}
          field={expandedCell.field}
          label={expandedCell.label}
          value={expandedCell.value}
          onConfirm={handleExpandConfirm}
          onClose={() => setExpandedCell(null)}
        />
      )}

      {/* Expand Context Menu — previously missing from render */}
      {contextMenu && (
        <ExpandContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onExpand={() => { handleExpandCell(contextMenu.rowIndex, contextMenu.field, contextMenu.label, contextMenu.value, contextMenu.product); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};
      
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
                  Average stock per SKU: <span className="text-theme-body font-medium">{totalSkus > 0 ? Math.round(onHandStock / totalSkus) : 0} {stockUnitLabel}</span>
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

              {/* Configurable Stock Unit Selector */}
              <div className="flex items-center gap-1.5 text-xs text-theme-muted font-mono pl-0 sm:pl-3 border-t sm:border-t-0 sm:border-l border-theme-divider/40 pt-2 sm:pt-0">
                <span>Unit:</span>
                <select
                  value={stockUnitLabel}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStockUnitLabel(val);
                    localStorage.setItem("smriti_stock_unit_label", val);
                  }}
                  className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-bold focus:outline-none font-mono cursor-pointer"
                >
                  <option value="Qty">Qty</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Units">Units</option>
                  <option value="Box">Box</option>
                  <option value="Kg">Kg</option>
                  <option value="Mtr">Mtr</option>
                  <option value="Pair">Pair</option>
                </select>
              </div>
            </div>

            {/* Search & Category Filter & Operations */}
            {selectedIds.size > 0 && (
              <div className="flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg mr-3">
                <span className="text-xs font-semibold text-indigo-400 mr-2">{selectedIds.size} selected</span>
                <button
                  onClick={() => setShowBulkEditModal(true)}
                  className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
                >
                  Bulk Edit Selected
                </button>
                <button
                  onClick={() => setShowUniversalLabelModal(true)}
                  className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Printer size={12} /> Print Labels ({selectedIds.size})
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
                  className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
                >
                  Delete Selected ({selectedIds.size})
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
                  className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-bold cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowRangeFilter(!showRangeFilter)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${
                    showRangeFilter || minStockFilter || maxStockFilter || minPriceFilter || maxPriceFilter
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-theme-body'
                  }`}
                >
                  <SlidersHorizontal size={13} />
                  <span>Filter on Range</span>
                  {(minStockFilter || maxStockFilter || minPriceFilter || maxPriceFilter) && (
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  )}
                </button>

                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${
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
              <button
                onClick={() => setShowSuggestBestModal(true)}
                className="flex items-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer"
                title="AI Smart Autopilot — Optimize margins & reorder levels"
              >
                <Sparkles size={13} />
                <span>Suggest Best</span>
              </button>

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

          {/* Collapsible Range Filter Bar */}
          {showRangeFilter && (
            <div className="bg-[#141720] border border-indigo-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <SlidersHorizontal size={13} /> Range Filter Autopilot
                </span>
                <button
                  onClick={() => {
                    setMinStockFilter("");
                    setMaxStockFilter("");
                    setMinPriceFilter("");
                    setMaxPriceFilter("");
                  }}
                  className="text-[10px] font-mono text-slate-400 hover:text-rose-400 transition-colors"
                >
                  Clear Range Filters
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Min Stock */}
                <div>
                  <label className="text-[9px] font-mono text-slate-400 block mb-1">Min Stock ({stockUnitLabel})</label>
                  <input
                    type="number"
                    min="0"
                    value={minStockFilter}
                    onChange={(e) => setMinStockFilter(e.target.value)}
                    placeholder="e.g. 0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>
                {/* Max Stock */}
                <div>
                  <label className="text-[9px] font-mono text-slate-400 block mb-1">Max Stock ({stockUnitLabel})</label>
                  <input
                    type="number"
                    min="0"
                    value={maxStockFilter}
                    onChange={(e) => setMaxStockFilter(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>
                {/* Min Price */}
                <div>
                  <label className="text-[9px] font-mono text-slate-400 block mb-1">Min Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={minPriceFilter}
                    onChange={(e) => setMinPriceFilter(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>
                {/* Max Price */}
                <div>
                  <label className="text-[9px] font-mono text-slate-400 block mb-1">Max Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={maxPriceFilter}
                    onChange={(e) => setMaxPriceFilter(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

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
                    {/* HREP Validation & Identifier Conflict Banner */}
                    {validationIssue && (
                      <div className="bg-rose-950/90 border-2 border-rose-500/70 rounded-xl p-4 space-y-3 text-xs font-mono shadow-xl animate-in slide-in-from-top duration-200">
                        <div className="flex items-center justify-between border-b border-rose-500/40 pb-2">
                          <div className="flex items-center space-x-2 text-rose-300 font-bold">
                            <AlertCircle size={16} className="text-rose-400 shrink-0" />
                            <span>{validationIssue.title}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setValidationIssue(null)}
                            className="text-rose-400 hover:text-white p-0.5"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-rose-900/40 p-3 rounded-lg border border-rose-500/20">
                          <div>
                            <span className="text-[9px] text-rose-300 uppercase block font-bold">Identifier Having Issue</span>
                            <span className="text-white font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-500/40 inline-block mt-1">
                              {validationIssue.identifierLabel}: <strong className="text-amber-300 font-mono">{validationIssue.identifierValue}</strong>
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-rose-300 uppercase block font-bold">What Issue Needs to be Solved</span>
                            <span className="text-rose-200 leading-relaxed block mt-1">{validationIssue.explanation}</span>
                          </div>
                        </div>

                        <div className="bg-indigo-950/60 p-2.5 rounded-lg border border-indigo-500/30 text-indigo-200">
                          <span className="text-[9px] text-indigo-400 uppercase font-bold block mb-0.5">💡 Suggested Action to Resolve</span>
                          <span>{validationIssue.suggestedAction}</span>
                        </div>
                      </div>
                    )}
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

                          {/* SMRITI SKU Code Generation Configurator & Engine */}
                          <div className="bg-theme-surface-1 p-3.5 rounded-xl border border-indigo-500/20 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-divider/30 pb-2">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                                SKU Generation Mode & Pattern Configurator
                              </span>
                              <div className="flex items-center space-x-1 font-mono text-[10px]">
                                <span className="text-theme-muted mr-1">Mode:</span>
                                <button
                                  type="button"
                                  onClick={() => setSkuMode("manual")}
                                  className={`px-2 py-0.5 rounded font-semibold transition-colors ${skuMode === "manual" ? "bg-indigo-600 text-white" : "bg-theme-surface-2 text-theme-muted hover:text-white"}`}
                                >
                                  Manual
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSkuMode("hybrid")}
                                  className={`px-2 py-0.5 rounded font-semibold transition-colors ${skuMode === "hybrid" ? "bg-indigo-600 text-white" : "bg-theme-surface-2 text-theme-muted hover:text-white"}`}
                                >
                                  Hybrid
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSkuMode("auto")}
                                  className={`px-2 py-0.5 rounded font-semibold transition-colors ${skuMode === "auto" ? "bg-indigo-600 text-white" : "bg-theme-surface-2 text-theme-muted hover:text-white"}`}
                                >
                                  Auto (Formula)
                                </button>
                              </div>
                            </div>

                            {/* Pattern Selector for Auto and Hybrid Modes */}
                            {skuMode !== "manual" && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[9px] font-mono text-theme-muted block mb-1">SKU Formula Pattern Format</label>
                                  <select
                                    value={skuFormatPattern}
                                    onChange={(e) => setSkuFormatPattern(e.target.value as SkuFormatPattern)}
                                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                                  >
                                    {PRESET_SKU_TEMPLATES.map(tmpl => (
                                      <option key={tmpl.id} value={tmpl.id}>
                                        {tmpl.label} ({tmpl.formula})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {skuMode === "hybrid" ? (
                                  <div>
                                    <label className="text-[9px] font-mono text-theme-muted block mb-1">Hybrid Custom Prefix</label>
                                    <input
                                      type="text"
                                      value={hybridPrefix}
                                      onChange={(e) => setHybridPrefix(e.target.value)}
                                      placeholder="e.g. PREFIX-101"
                                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono uppercase"
                                    />
                                  </div>
                                ) : skuFormatPattern === "CUSTOM" ? (
                                  <div>
                                    <label className="text-[9px] font-mono text-theme-muted block mb-1">{"Custom Formula Template (\"{style}\", \"{color}\", \"{size}\")"}</label>
                                    <input
                                      type="text"
                                      value={customSkuTemplate}
                                      onChange={(e) => setCustomSkuTemplate(e.target.value)}
                                      placeholder="{style}-{color}-{size}"
                                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center text-[10px] text-indigo-300 font-mono pt-4">
                                    <span>Formula preview: <strong className="text-white">{skuFormatPattern === "STYLE_COLOR_SIZE" ? "{StyleCode}-{Color}-{Size}" : skuFormatPattern === "STYLE_SIZE_COLOR" ? "{StyleCode}-{Size}-{Color}" : skuFormatPattern === "CAT_STYLE_COLOR_SIZE" ? "{Category}-{StyleCode}-{Color}-{Size}" : "{Brand}-{StyleCode}-{Color}-{Size}"}</strong></span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="text-[9px] font-mono text-theme-muted block mb-1">Style Reference Code</label>
                                <input
                                  type="text"
                                  value={formStyleCode}
                                  onChange={(e) => setFormStyleCode(e.target.value)}
                                  placeholder="Style Code (e.g. STL-101)"
                                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono uppercase"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-mono text-theme-muted block mb-1">
                                  SKU Unique Code * <span className="text-[9px] text-indigo-400 font-normal">({skuMode.toUpperCase()})</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  disabled={isEditing || skuMode !== "manual"}
                                  value={formCode}
                                  onChange={(e) => setFormCode(e.target.value)}
                                  placeholder="SKU Code"
                                  className="w-full bg-theme-surface-2 border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono font-bold disabled:opacity-75 disabled:bg-theme-surface-3"
                                />
                              </div>
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
                            {/* SKU Code */}
                            <td
                              className={`px-5 ${densityPadding} font-mono font-bold text-theme-body relative group/cell`}
                              onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "code", "SKU Code", p.code, p); }}
                            >
                              <div className="flex items-center space-x-1.5">
                                <Tag size={12} className="text-theme-muted" />
                                <DrillableLink context={{ entityType: "item", entityId: p.code, title: p.name }}>
                                  {p.code}
                                </DrillableLink>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "code", "SKU Code", p.code, p); }}
                                title="Expand cell (Double-click / F2)"
                                className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"
                              >
                                <Maximize2 size={10} />
                              </button>
                            </td>

                            {/* Item Details */}
                            <td
                              className={`px-5 ${densityPadding} relative group/cell`}
                              onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "name", "Item Name & Details", p.name, p); }}
                            >
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
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "name", "Item Name & Details", p.name, p); }}
                                title="Expand cell (Double-click / F2)"
                                className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"
                              >
                                <Maximize2 size={10} />
                              </button>
                            </td>

                            {/* Buy Cost */}
                            <td
                              className={`px-5 ${densityPadding} text-right font-mono text-theme-muted relative group/cell`}
                              onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "costPrice", "Buy Cost", String(p.costPrice || Math.round(p.price * 0.6)), p); }}
                            >
                              ₹{(p.costPrice || Math.round(p.price * 0.6)).toLocaleString("en-IN")}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "costPrice", "Buy Cost", String(p.costPrice || Math.round(p.price * 0.6)), p); }}
                                title="Expand cell"
                                className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"
                              >
                                <Maximize2 size={10} />
                              </button>
                            </td>

                            {/* Selling Rate */}
                            <td
                              className={`px-5 ${densityPadding} text-right font-mono font-semibold text-emerald-400 relative group/cell`}
                              onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "price", "Selling Rate", String(p.price), p); }}
                            >
                              ₹{p.price.toLocaleString("en-IN")}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "price", "Selling Rate", String(p.price), p); }}
                                title="Expand cell"
                                className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"
                              >
                                <Maximize2 size={10} />
                              </button>
                            </td>

                            {/* MRP */}
                            <td
                              className={`px-5 ${densityPadding} text-right font-mono text-theme-muted relative group/cell`}
                              onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "mrp", "MRP", String(p.mrp || p.price), p); }}
                            >
                              ₹{(p.mrp || p.price).toLocaleString("en-IN")}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "mrp", "MRP", String(p.mrp || p.price), p); }}
                                title="Expand cell"
                                className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"
                              >
                                <Maximize2 size={10} />
                              </button>
                            </td>

                            {/* GST */}
                            <td
                              className={`px-5 ${densityPadding} text-right font-mono text-amber-400 font-bold relative group/cell`}
                              onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "gstPercentage", "GST %", String(p.gstPercentage || 18), p); }}
                            >
                              {p.gstPercentage || 18}%
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "gstPercentage", "GST %", String(p.gstPercentage || 18), p); }}
                                title="Expand cell"
                                className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"
                              >
                                <Maximize2 size={10} />
                              </button>
                            </td>

                            {/* Stock On Hand */}
                            <td
                              className={`px-5 ${densityPadding} text-right font-mono relative group/cell`}
                              onDoubleClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "stock", "Stock On Hand", String(p.stock), p); }}
                            >
                              <span className={`font-semibold ${p.stock < 10 ? "text-rose-400" : "text-theme-primary"}`}>
                                {p.stock} {stockUnitLabel}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExpandCell(idx, "stock", "Stock On Hand", String(p.stock), p); }}
                                title="Expand cell"
                                className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-indigo-400 hover:bg-indigo-600/20 transition-all z-10"
                              >
                                <Maximize2 size={10} />
                              </button>
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingProduct(p);
                                  }}
                                  className="p-1 rounded hover:bg-theme-surface-3 text-indigo-300 hover:text-white"
                                  title="View full product details"
                                >
                                  <Eye size={14} />
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

      {/* ── Product Inspection / View Details Modal ──────────────────────────── */}
      {viewingProduct && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#141720] border border-indigo-500/30 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#1a1e2b] border-b border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{viewingProduct.name}</h3>
                  <span className="text-[10px] font-mono text-indigo-300 uppercase">SKU: {viewingProduct.code}</span>
                </div>
              </div>
              <button onClick={() => setViewingProduct(null)} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 font-mono text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Category</span>
                  <span className="text-white font-bold">{viewingProduct.category}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Barcode</span>
                  <span className="text-indigo-300 font-bold">{viewingProduct.barcode}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Stock On Hand</span>
                  <span className="text-emerald-400 font-bold">{viewingProduct.stock} {stockUnitLabel}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">GST Tax %</span>
                  <span className="text-amber-400 font-bold">{viewingProduct.gstPercentage || 18}%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Buy Cost Price</span>
                  <span className="text-slate-300 text-sm font-bold">₹{(viewingProduct.costPrice || Math.round(viewingProduct.price * 0.6)).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Selling Rate</span>
                  <span className="text-emerald-400 text-sm font-bold">₹{viewingProduct.price.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Max Retail Price</span>
                  <span className="text-white text-sm font-bold">₹{(viewingProduct.mrp || viewingProduct.price).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {viewingProduct.attributes && Object.keys(viewingProduct.attributes).length > 0 && (
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase block">Dynamic Attribute Specifications</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {Object.entries(viewingProduct.attributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-white font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-[#1a1e2b] border-t border-indigo-500/20 flex items-center justify-between">
              <button
                onClick={() => {
                  const prod = viewingProduct;
                  setViewingProduct(null);
                  handleOpenEdit(prod);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition"
              >
                Edit Product Details
              </button>
              <button onClick={() => setViewingProduct(null)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Edit Selected Modal ─────────────────────────────────────────── */}
      {showBulkEditModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#141720] border border-indigo-500/40 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#1a1e2b] border-b border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Bulk Edit ({selectedIds.size} Items Selected)</h3>
              </div>
              <button onClick={() => setShowBulkEditModal(false)} className="p-1 text-slate-400 hover:text-white"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Set Category for All Selected</label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"
                >
                  <option value="">-- Keep Existing Categories --</option>
                  {categories.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Adjust Selling Price By % (+10% or -5%)</label>
                <input
                  type="number"
                  value={bulkPriceChangePercent}
                  onChange={(e) => setBulkPriceChangePercent(e.target.value)}
                  placeholder="e.g. 10 for +10% increase, -5 for discount"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Set GST Tax Rate %</label>
                <select
                  value={bulkGst}
                  onChange={(e) => setBulkGst(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"
                >
                  <option value="">-- Keep Existing GST % --</option>
                  <option value="0">0% GST</option>
                  <option value="5">5% GST</option>
                  <option value="18">18% GST</option>
                  <option value="40">40% GST</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Add Stock Units to On-Hand (+Qty)</label>
                <input
                  type="number"
                  value={bulkStockAdd}
                  onChange={(e) => setBulkStockAdd(e.target.value)}
                  placeholder="e.g. 50 (adds 50 units to stock on hand)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#1a1e2b] border-t border-indigo-500/20 flex justify-end gap-3">
              <button onClick={() => setShowBulkEditModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg">Cancel</button>
              <button onClick={handleBulkEditConfirm} disabled={loading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg">
                {loading ? "Updating Selected..." : `Apply Bulk Edit to ${selectedIds.size} Items`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Suggest Best Autopilot Modal ──────────────────────────────────── */}
      {showSuggestBestModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#141720] border border-amber-500/40 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#1a1e2b] border-b border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white">AI Smart Autopilot — Suggest Best</h3>
              </div>
              <button onClick={() => setShowSuggestBestModal(false)} className="p-1 text-slate-400 hover:text-white"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono text-slate-300 leading-relaxed">
              <p className="text-amber-300 font-bold">
                The Smart Autopilot will analyze all {products.length} catalog items and apply optimization rules:
              </p>
              <ul className="space-y-2 text-[11px] list-disc pl-4 text-slate-400">
                <li><strong className="text-white">Margin Compliance:</strong> Enforces minimum 25% gross margin over buy cost on all products.</li>
                <li><strong className="text-white">MRP Alignment:</strong> Ensures MRP is at least 20% above selling rate for price compliance.</li>
                <li><strong className="text-white">Stock Buffer Suggestion:</strong> Replenishes low stock (&lt; 5 {stockUnitLabel}) up to the recommended buffer of 25 {stockUnitLabel}.</li>
              </ul>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400">
                Ready to optimize catalog pricing & inventory levels across SMRITI Master DB.
              </div>
            </div>

            <div className="px-6 py-4 bg-[#1a1e2b] border-t border-amber-500/20 flex justify-end gap-3">
              <button onClick={() => setShowSuggestBestModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg">Cancel</button>
              <button onClick={handleApplySuggestBest} disabled={loading} className="px-5 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg">
                {loading ? "Optimizing Catalog..." : "Run AI Autopilot Optimization"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Universal Label Printer Modal */}
      <UniversalLabelPrinterModal
        isOpen={showUniversalLabelModal}
        onClose={() => setShowUniversalLabelModal(false)}
        moduleSource="Item Master"
        onNotification={onNotification}
        items={products.map(p => ({
          id: p.id,
          item_code: p.code || p.sku || "ITEM-001",
          barcode: p.barcode || "8901234560000",
          sku: p.sku || p.code || "SKU-001",
          name: p.name,
          category: p.category || "General",
          brand: p.brand || "SMRITI",
          price: p.price,
          cost_price: p.costPrice || (p as any).cost_price || 0,
          mrp: p.mrp || p.price,
          stock_qty: p.stock ?? (p as any).stock_qty ?? 0,
          received_qty: p.stock ?? (p as any).stock_qty ?? 0,
          sold_qty: 0,
          style_code: p.code || p.sku
        }))}
      />

    </div>
  );
};
