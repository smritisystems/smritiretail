/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : PurchaseOperationsStudio (Unified Enterprise Purchase Studio — Constitutional Edition v7.0)
 * Description  : Enterprise Procurement Studio featuring On-the-Fly Temporary Product Engine (+New Article/Style/Model),
 *                Master Data Approval Queue, Collapsible Visual Product Gallery, Metadata Studio Configuration,
 *                and SWMF / SUPP Printing integration.
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 7.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  Trash2,
  Printer,
  Download,
  FileText,
  Building2,
  ShoppingCart,
  Receipt,
  Truck,
  ChevronDown,
  Paperclip,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Scan,
  Upload,
  Settings,
  Grid,
  Layers,
  Sparkles,
  Tag,
  Package,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Sliders,
  Filter,
  Eye,
  ShieldCheck,
  QrCode
} from "lucide-react";
import { Product } from "../../types.js";
import { PrintingService, PrintDocument } from "../../core/printing/index.js";
import { BUSINESS_DOMAIN_PROFILES, BusinessDomain } from "../../domain/BusinessDomainProfiles.ts";

export type PurchaseDocumentType = "PO" | "PINV" | "GRN" | "RETURN";
export type AddItemMode =
  | "CODE"
  | "BARCODE"
  | "ARTICLE"
  | "STYLE"
  | "MODEL"
  | "MATRIX"
  | "BRAND"
  | "CATEGORY"
  | "EXCEL"
  | "NEW_ARTICLE"
  | "NEW_STYLE"
  | "NEW_MODEL";

export type PivotViewMode = "STANDARD" | "SIZE" | "COLOR" | "ARTICLE" | "STYLE" | "MATRIX";
export type ItemFilterMode = "ALL" | "EXISTING" | "NEW_ARTICLE" | "PENDING_APPROVAL";
export interface PurchaseItemRow {
  id: string;
  itemCode: string;
  itemName: string;
  hsn: string;
  warehouse: string;
  uom: string;
  qty: number;
  rate: number;
  discountPercent: number;
  gstRate: number;
  taxType?: "IGST" | "CGST_SGST" | "EXEMPT";
  articleCode?: string;
  color?: string;
  size?: string;
  style?: string;
  brand?: string;
  category?: string;
  categoryStatus?: "ITEM_MASTER" | "PENDING_APPROVAL";
  imageUrl?: string;
  isTemporary?: boolean;
  tempType?: "NEW_ARTICLE" | "NEW_STYLE" | "NEW_MODEL";
  approvalStatus?: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
}

export interface SupplierInfo {
  id: string;
  name: string;
  code: string;
  gstin: string;
  contactPerson: string;
  mobile: string;
  email: string;
  address: string;
  paymentTerms: string;
}

export interface PurchaseOperationsStudioProps {
  initialDocumentType?: PurchaseDocumentType;
  initialData?: any;
  suppliers: SupplierInfo[];
  products: Product[];
  currentUser?: { role: string; name: string } | null;
  industryPack?: "Apparel" | "Footwear" | "Jewellery" | "Electronics" | "Grocery" | "Pharmacy";
  onBack?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const PurchaseOperationsStudio: React.FC<PurchaseOperationsStudioProps> = ({
  initialDocumentType = "PO",
  initialData,
  suppliers = [],
  products = [],
  currentUser,
  industryPack = "Apparel",
  onBack,
  onNotification,
}) => {
  // Document Type Mode
  const [docType, setDocType] = useState<PurchaseDocumentType>(initialDocumentType);
  const [status, setStatus] = useState<"DRAFT" | "POSTED" | "SUBMITTED">(
    initialData?.status || (docType === "PINV" ? "POSTED" : "DRAFT")
  );

  // Supplier Information State
  const [supplierId, setSupplierId] = useState<string>(
    initialData?.supplierId || (suppliers[0]?.id ?? "SUPP-001")
  );

  // Active Supplier Details
  const activeSupplier: SupplierInfo = useMemo(() => {
    const found = suppliers.find((s) => s.id === supplierId);
    if (found) return found;
    return {
      id: "SUPP-A90F98",
      name: "Demo Supplier from UI",
      code: "SUPP-A90F98",
      gstin: "27ABCDE1234F1Z5",
      contactPerson: "Rohit Sharma",
      mobile: "9876543210",
      email: "supplier@smritibooks.com",
      address: "Industrial Area Phase 2, New Delhi",
      paymentTerms: "30 Days",
    };
  }, [supplierId, suppliers]);

  // Document Fields
  const [poNumber] = useState<string>(initialData?.poNumber || "PO-2506-00045");
  const [docDate, setDocDate] = useState<string>(
    initialData?.date || new Date().toISOString().split("T")[0]
  );
  const [expectedDelivery, setExpectedDelivery] = useState<string>(
    initialData?.expectedDelivery || new Date(Date.now() + 864000000).toISOString().split("T")[0]
  );
  const [warehouse, setWarehouse] = useState<string>("Main Warehouse");
  const [financialYear] = useState<string>("2025-26");
  const [currency] = useState<string>("INR - Indian Rupee");
  const [priceList] = useState<string>("Standard Buying");

  // Metadata Configuration Settings
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [studioConfig, setStudioConfig] = useState({
    allowOntheFlyArticle: true,
    requireMasterApproval: true,
    showProductGallery: true,
    printImagesInPO: true,
    includeQRCodeInPO: true,
    defaultGalleryView: "GRID" as "GRID" | "LIST",
  });

  // UI Multi-Mode States
  const [showAddItemsMenu, setShowAddItemsMenu] = useState<boolean>(false);
  const [showVariantMatrixModal, setShowVariantMatrixModal] = useState<boolean>(false);
  const [showItemPickerModal, setShowItemPickerModal] = useState<boolean>(false);
  const [showNewArticleModal, setShowNewArticleModal] = useState<boolean>(false);
  const [pivotViewMode, setPivotViewMode] = useState<PivotViewMode>("STANDARD");
  const [itemFilterMode, setItemFilterMode] = useState<ItemFilterMode>("ALL");
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  // Bottom Tabs State
  const [activeBottomTab, setActiveBottomTab] = useState<"taxes" | "shipping" | "terms" | "attachments" | "notes">("taxes");
  const [notesText, setNotesText] = useState<string>(initialData?.notes || "");

  // On-the-Fly New Article Form State
  const [newArticleForm, setNewArticleForm] = useState({
    articleCode: "ART-2026-X",
    articleName: "Linen Summer Casual Shirt",
    style: "Casual Fit",
    brand: "SMRITI Line",
    hsn: "6105",
    uom: "Pcs",
    buyingRate: 920,
    gstRate: 12,
    color: "Sky Blue",
    size: "L",
  });

  // Item List State
  const [items, setItems] = useState<PurchaseItemRow[]>(
    initialData?.items || [
      {
        id: "1",
        itemCode: "TS-1001-BLK-M",
        itemName: "Polo T-Shirt (Black / M)",
        hsn: "6109",
        warehouse: "Main Warehouse",
        uom: "Pcs",
        qty: 15,
        rate: 850.00,
        discountPercent: 0,
        gstRate: 12,
        taxType: "CGST_SGST",
        articleCode: "TS-1001",
        color: "Black",
        size: "M",
        style: "Polo T-Shirt",
        brand: "SMRITI Fashion",
        imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=150&auto=format&fit=crop&q=60",
        isTemporary: false,
        approvalStatus: "APPROVED",
      },
      {
        id: "2",
        itemCode: "TS-1001-BLU-L",
        itemName: "Polo T-Shirt (Blue / L)",
        hsn: "6109",
        warehouse: "Main Warehouse",
        uom: "Pcs",
        qty: 20,
        rate: 850.00,
        discountPercent: 0,
        gstRate: 12,
        taxType: "CGST_SGST",
        articleCode: "TS-1001",
        color: "Blue",
        size: "L",
        style: "Polo T-Shirt",
        brand: "SMRITI Fashion",
        imageUrl: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=150&auto=format&fit=crop&q=60",
        isTemporary: false,
        approvalStatus: "APPROVED",
      },
      {
        id: "3",
        itemCode: "TEMP-ART-9901-WHT-XL",
        itemName: "Designer Silk Blend Shirt (White / XL)",
        hsn: "6205",
        warehouse: "Main Warehouse",
        uom: "Pcs",
        qty: 30,
        rate: 1450.00,
        discountPercent: 0,
        gstRate: 12,
        taxType: "IGST",
        articleCode: "ART-9901",
        color: "White",
        size: "XL",
        style: "Silk Blend",
        brand: "Haute Couture",
        imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=150&auto=format&fit=crop&q=60",
        isTemporary: true,
        tempType: "NEW_ARTICLE",
        approvalStatus: "PENDING_APPROVAL",
      },
    ]
  );

  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});

  // Filtered Item List based on Quick Filter Counters
  const filteredItems = useMemo(() => {
    if (itemFilterMode === "EXISTING") {
      return items.filter((i) => !i.isTemporary);
    }
    if (itemFilterMode === "NEW_ARTICLE") {
      return items.filter((i) => i.isTemporary);
    }
    if (itemFilterMode === "PENDING_APPROVAL") {
      return items.filter((i) => i.approvalStatus === "PENDING_APPROVAL");
    }
    return items;
  }, [items, itemFilterMode]);

  // Counts of Temporary vs Approved Products
  const tempCounts = useMemo(() => {
    const newArticles = items.filter((i) => i.isTemporary).length;
    const pendingApproval = items.filter((i) => i.approvalStatus === "PENDING_APPROVAL").length;
    return {
      total: items.length,
      existing: items.length - newArticles,
      newArticles,
      pendingApproval,
    };
  }, [items]);

  // Handle Master Data Approval (Promote Temporary Product to Item Master)
  const handleApproveMasterItems = () => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.isTemporary) {
          return {
            ...item,
            isTemporary: false,
            approvalStatus: "APPROVED",
            itemCode: item.itemCode.replace("TEMP-", ""),
          };
        }
        return item;
      })
    );
    if (onNotification)
      onNotification(
        "Master Data Approved",
        "Promoted temporary procurement products into Item Master registry!",
        "success"
      );
  };

  // Create On-the-Fly Temporary Article
  const handleCreateTemporaryArticle = () => {
    const newItem: PurchaseItemRow = {
      id: String(Date.now()),
      itemCode: `TEMP-${newArticleForm.articleCode}-${newArticleForm.color.substring(0, 3).toUpperCase()}-${newArticleForm.size}`,
      itemName: `${newArticleForm.articleName} (${newArticleForm.color} / ${newArticleForm.size})`,
      hsn: newArticleForm.hsn,
      warehouse: warehouse,
      uom: newArticleForm.uom,
      qty: 12,
      rate: newArticleForm.buyingRate,
      discountPercent: 0,
      gstRate: newArticleForm.gstRate,
      taxType: "CGST_SGST",
      articleCode: newArticleForm.articleCode,
      color: newArticleForm.color,
      size: newArticleForm.size,
      style: newArticleForm.style,
      brand: newArticleForm.brand,
      isTemporary: true,
      tempType: "NEW_ARTICLE",
      approvalStatus: "PENDING_APPROVAL",
    };

    setItems((prev) => [...prev, newItem]);
    setShowNewArticleModal(false);
    setShowAddItemsMenu(false);
    if (onNotification)
      onNotification(
        "Temporary Article Created",
        `Added new temporary article ${newItem.articleCode} to PO. Marked as PENDING APPROVAL.`,
        "success"
      );
  };

  // Variant Matrix Modal State (Color × Size Grid)
  const [selectedArticle, setSelectedArticle] = useState<{
    articleCode: string;
    articleName: string;
    style: string;
    hsn: string;
    uom: string;
    baseRate: number;
    category: string;
  }>({
    articleCode: "TS-1001",
    articleName: "Cotton Polo T-Shirt Premium",
    style: "Polo Fit",
    hsn: "6109",
    uom: "Pcs",
    baseRate: 850,
    category: industryPack || "Apparel",
  });

  const [availableMatrixCategories, setAvailableMatrixCategories] = useState<string[]>(() => Array.from(new Set(
    products.map((product) => product.category).filter(Boolean),
  )));
  const [newMatrixCategory, setNewMatrixCategory] = useState("");
  const [selectedCategoryStatus, setSelectedCategoryStatus] = useState<"ITEM_MASTER" | "PENDING_APPROVAL">("ITEM_MASTER");

  const [availableColors, setAvailableColors] = useState(["Black", "Blue", "White", "Red", "Navy"]);
  const [availableSizes, setAvailableSizes] = useState(["XS", "S", "M", "L", "XL", "XXL"]);
  const [matrixSizeCategories, setMatrixSizeCategories] = useState<Record<string, "apparel" | "footwear">>({
    XS: "apparel", S: "apparel", M: "apparel", L: "apparel", XL: "apparel", XXL: "apparel",
  });
  const [matrixSizeMode, setMatrixSizeMode] = useState<"apparel" | "footwear" | "hybrid">("apparel");
  const [businessDomain, setBusinessDomain] = useState<BusinessDomain>(industryPack);
  const [newMatrixColor, setNewMatrixColor] = useState("");
  const [newMatrixSize, setNewMatrixSize] = useState("");
  const [newMatrixSizeCategory, setNewMatrixSizeCategory] = useState<"apparel" | "footwear">("footwear");

  const activeMatrixSizes = availableSizes.filter(
    (size) => matrixSizeMode === "hybrid" || matrixSizeCategories[size] === matrixSizeMode,
  );
  const activeDomainProfile = BUSINESS_DOMAIN_PROFILES[businessDomain];

  // 2D Matrix Qty Map: [color_size] -> quantity
  const [matrixQtyMap, setMatrixQtyMap] = useState<Record<string, number>>({
    "Black_S": 10,
    "Black_M": 15,
    "Black_L": 20,
    "Blue_S": 5,
    "Blue_M": 10,
    "Blue_L": 15,
    "White_M": 10,
    "White_L": 10,
  });

  const handleMatrixQtyChange = (color: string, size: string, val: number) => {
    const key = `${color}_${size}`;
    setMatrixQtyMap((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  const handleAddMatrixColor = () => {
    const color = newMatrixColor.trim();
    if (!color || availableColors.some((entry) => entry.toLowerCase() === color.toLowerCase())) return;
    setAvailableColors((prev) => [...prev, color]);
    setNewMatrixColor("");
  };

  const handleAddMatrixSize = () => {
    const size = newMatrixSize.trim();
    if (!size || availableSizes.some((entry) => entry.toLowerCase() === size.toLowerCase())) return;
    if (newMatrixSizeCategory === "footwear") {
      const numericSize = Number(size);
      if (!Number.isFinite(numericSize) || numericSize < 10 || numericSize > 50) {
        onNotification?.("Invalid Footwear Size", "Use a footwear size between 10 and 50, such as 26 or 26.5.", "error");
        return;
      }
    }
    setAvailableSizes((prev) => [...prev, size]);
    setMatrixSizeCategories((prev) => ({ ...prev, [size]: newMatrixSizeCategory }));
    setNewMatrixSize("");
  };

  const handleBusinessDomainChange = (domain: BusinessDomain) => {
    setBusinessDomain(domain);
    setMatrixSizeMode(BUSINESS_DOMAIN_PROFILES[domain].sizeMode);
    setAvailableMatrixCategories((prev) => prev.some((category) => category.toLowerCase() === domain.toLowerCase())
      ? prev
      : [...prev, domain]);
    setSelectedArticle((prev) => ({ ...prev, category: domain }));
    setSelectedCategoryStatus(availableMatrixCategories.some((category) => category.toLowerCase() === domain.toLowerCase())
      ? "ITEM_MASTER"
      : "PENDING_APPROVAL");
  };

  const handleCreateMissingMatrixCategory = () => {
    const category = newMatrixCategory.trim();
    if (!category || availableMatrixCategories.some((entry) => entry.toLowerCase() === category.toLowerCase())) return;
    setAvailableMatrixCategories((prev) => [...prev, category]);
    setSelectedArticle((prev) => ({ ...prev, category }));
    setSelectedCategoryStatus("PENDING_APPROVAL");
    setNewMatrixCategory("");
    onNotification?.("Temporary Category Added", `${category} is pending Item Master approval.`, "success");
  };

  const handleGenerateMatrixLines = () => {
    const newLines: PurchaseItemRow[] = [];
    let totalAddedQty = 0;
    const generatedKeys = new Set<string>();
    const existingKeys = new Set(items.map((item) => `${item.articleCode || item.itemCode}|${item.color || ""}|${item.size || ""}`.toLowerCase()));

    availableColors.forEach((color) => {
      activeMatrixSizes.forEach((size) => {
        const key = `${color}_${size}`;
        const qty = matrixQtyMap[key] || 0;
        if (qty > 0) {
          const colorCode = color.substring(0, 3).toUpperCase();
          const itemCode = `${selectedArticle.articleCode}-${colorCode}-${size}`;
          const variantKey = `${selectedArticle.articleCode}|${color}|${size}`.toLowerCase();
          if (generatedKeys.has(variantKey) || existingKeys.has(variantKey)) return;
          if (products.some((product) => (product.sku || product.code || "").toLowerCase() === itemCode.toLowerCase())) {
            onNotification?.("Duplicate SKU", `${itemCode} already exists in Item Master.`, "error");
            return;
          }
          generatedKeys.add(variantKey);
          totalAddedQty += qty;
          newLines.push({
            id: String(Date.now() + Math.random()),
            itemCode: itemCode,
            itemName: `${selectedArticle.articleName} (${color} / ${size})`,
            hsn: selectedArticle.hsn,
            warehouse: warehouse,
            uom: selectedArticle.uom,
            category: selectedArticle.category,
            categoryStatus: selectedCategoryStatus,
            qty: qty,
            rate: selectedArticle.baseRate,
            discountPercent: 0,
            gstRate: 12,
            taxType: "CGST_SGST",
            articleCode: selectedArticle.articleCode,
            color: color,
            size: size,
            style: selectedArticle.style,
            isTemporary: false,
            approvalStatus: "APPROVED",
          });
        }
      });
    });

    if (newLines.length === 0) {
      if (onNotification) onNotification("Empty Matrix", "Enter quantities in color/size matrix before generating lines", "error");
      return;
    }

    if (newLines.some((line) => !line.category || line.qty <= 0 || line.rate < 0)) {
      onNotification?.("Invalid Matrix Values", "Every variant needs a category, positive quantity, and non-negative rate.", "error");
      return;
    }

    setItems((prev) => [...prev, ...newLines]);
    setShowVariantMatrixModal(false);
    if (onNotification)
      onNotification(
        "Variant Lines Generated",
        `Created ${newLines.length} variant purchase lines (${totalAddedQty} pcs) from Article ${selectedArticle.articleCode}`,
        "success"
      );
  };

  // Select / Deselect All Items
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const newSelected: Record<string, boolean> = {};
    if (checked) {
      items.forEach((item) => {
        newSelected[item.id] = true;
      });
    }
    setSelectedItemIds(newSelected);
  };

  const handleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleAddItem = (prod?: Product, mode: AddItemMode = "CODE") => {
    if (mode === "MATRIX") {
      setShowVariantMatrixModal(true);
      setShowAddItemsMenu(false);
      return;
    }
    if (mode === "NEW_ARTICLE") {
      setShowNewArticleModal(true);
      setShowAddItemsMenu(false);
      return;
    }

    const newItem: PurchaseItemRow = prod
      ? {
          id: String(Date.now()),
          itemCode: prod.code || prod.sku || `ITEM-${items.length + 1}`,
          itemName: prod.name,
          hsn: prod.hsnCode || "6404",
          warehouse: warehouse,
          uom: prod.unit || "Pcs",
          qty: 1,
          rate: prod.price || 500,
          discountPercent: 0,
          gstRate: prod.gstPercentage || 18,
          taxType: "CGST_SGST",
          articleCode: prod.code || "ART-100",
          isTemporary: false,
          approvalStatus: "APPROVED",
        }
      : {
          id: String(Date.now()),
          itemCode: `ART-10${items.length + 1}-BLK-L`,
          itemName: `Fashion Apparel Specification ${items.length + 1}`,
          hsn: "6109",
          warehouse: warehouse,
          uom: "Pcs",
          qty: 12,
          rate: 750,
          discountPercent: 0,
          gstRate: 12,
          taxType: "CGST_SGST",
          articleCode: `ART-10${items.length + 1}`,
          color: "Black",
          size: "L",
          style: "Polo Fit",
          isTemporary: false,
          approvalStatus: "APPROVED",
        };

    setItems((prev) => [...prev, newItem]);
    setShowItemPickerModal(false);
    setShowAddItemsMenu(false);
    if (onNotification) onNotification("Item Added", `Added ${newItem.itemName} to purchase order`, "success");
  };

  const handleUpdateItem = (id: string, field: keyof PurchaseItemRow, val: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: val };
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleDeleteSelectedItems = () => {
    const selectedIds = Object.keys(selectedItemIds).filter((id) => selectedItemIds[id]);
    if (selectedIds.length === 0) {
      if (onNotification) onNotification("Selection Required", "Select item rows to delete", "error");
      return;
    }
    setItems((prev) => prev.filter((i) => !selectedItemIds[i.id]));
    setSelectedItemIds({});
    if (onNotification) onNotification("Items Removed", `Deleted ${selectedIds.length} item rows`, "success");
  };

  // Financial Summary Computations
  const totals = useMemo(() => {
    let totalItemAmount = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    items.forEach((item) => {
      const gross = item.qty * item.rate;
      const disc = (gross * (item.discountPercent || 0)) / 100;
      const taxable = gross - disc;
      const taxRate = item.gstRate || 18;
      const tax = (taxable * taxRate) / 100;

      totalItemAmount += gross;
      totalDiscount += disc;
      totalTaxable += taxable;

      if (item.taxType === "IGST") {
        igstAmount += tax;
      } else {
        cgstAmount += tax / 2;
        sgstAmount += tax / 2;
      }
    });

    const totalTaxes = cgstAmount + sgstAmount + igstAmount;
    const rawNetPayable = totalTaxable + totalTaxes;
    const roundedNetPayable = Math.round(rawNetPayable);
    const roundOff = Number((roundedNetPayable - rawNetPayable).toFixed(2));

    return {
      totalItemAmount,
      totalDiscount,
      totalTaxable,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTaxes,
      roundOff,
      netPayable: roundedNetPayable,
      totalQty: items.reduce((acc, i) => acc + (i.qty || 0), 0),
    };
  }, [items]);

  const amountInWords = useMemo(() => {
    const num = totals.netPayable;
    return `INR ${num.toLocaleString("en-IN")} Only`;
  }, [totals.netPayable]);

  const docTitle = useMemo(() => {
    switch (docType) {
      case "PO":
        return "Purchase Order";
      case "PINV":
        return "Purchase Invoice";
      case "GRN":
        return "Goods Receipt Note";
      case "RETURN":
        return "Purchase Return";
    }
  }, [docType]);

  const handlePrint = async () => {
    const printDoc: PrintDocument = {
      id: `DOC-${docType}-${Date.now()}`,
      type: "RETAIL_INVOICE",
      title: `${docTitle} #${poNumber}`,
      content: `^XA^FO50,50^A0N,40,40^FD${docTitle.toUpperCase()}^FS^FO50,100^A0N,30,30^FDSupplier: ${activeSupplier.name}^FS^FO50,140^A0N,25,25^FDDoc No: ${poNumber}^FS^FO50,180^A0N,30,30^FDNet Payable: INR ${totals.netPayable}^FS^XZ`,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    const res = await PrintingService.printDocument(printDoc, {
      printerName: "Standard Spooler Printer",
      driverId: "zpl",
      providerId: "qz_tray",
    });

    if (res.success) {
      if (onNotification) onNotification("Print Dispatched", `Sent ${docTitle} to thermal printer via SUPP`, "success");
    } else {
      window.print();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowItemPickerModal(true);
      } else if (e.key === "F7") {
        e.preventDefault();
        setShowVariantMatrixModal(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        setShowNewArticleModal(true);
      } else if (e.key === "F9") {
        e.preventDefault();
        setStatus("DRAFT");
        if (onNotification) onNotification("Draft Saved", `${docTitle} saved as draft (F9)`, "success");
      } else if (e.key === "F10") {
        e.preventDefault();
        setStatus("POSTED");
        if (onNotification) onNotification("Submitted", `${docTitle} submitted and posted (F10)`, "success");
      } else if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [docTitle, items]);

  const pivotSummary = useMemo(() => {
    const groups = new Map<string, { label: string; quantity: number; value: number }>();
    filteredItems.forEach((item) => {
      const label = pivotViewMode === "COLOR" ? (item.color || "Unspecified")
        : pivotViewMode === "ARTICLE" ? (item.articleCode || item.itemCode)
        : pivotViewMode === "STYLE" ? (item.style || "Unspecified")
        : (item.size || "Unspecified");
      const current = groups.get(label) || { label, quantity: 0, value: 0 };
      current.quantity += item.qty;
      current.value += item.qty * item.rate;
      groups.set(label, current);
    });
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredItems, pivotViewMode]);

  const matrixColumns = useMemo(
    () => Array.from(new Set(filteredItems.map((item) => item.size).filter(Boolean))) as string[],
    [filteredItems],
  );

  return (
    <div className="w-full bg-slate-100 font-sans text-slate-800 p-2.5 sm:p-3 space-y-3">
      {/* ================= SINGLE HORIZONTAL TOOLBAR ================= */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        {/* Left Title & Industry Badge */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PURCHASE /</span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as PurchaseDocumentType)}
            className="bg-transparent font-bold text-slate-700 text-xs focus:outline-none cursor-pointer"
          >
            <option value="PO">Purchase Order</option>
            <option value="PINV">Purchase Invoice</option>
            <option value="GRN">Goods Receipt Note</option>
            <option value="RETURN">Purchase Return</option>
          </select>
          <h1 className="text-base font-extrabold text-slate-900 tracking-tight ml-1">{docTitle}</h1>
          <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
            {status}
          </span>
          <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1">
            <Sparkles className="w-2.5 h-2.5 mr-0.5 text-indigo-600" />
            <span>INDUSTRY: {industryPack}</span>
          </span>
        </div>

        {/* Right Actions & Studio Config Button */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search (F2)"
              onClick={() => setShowItemPickerModal(true)}
              className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 w-36"
            />
          </div>
          <button
            onClick={() => {
              setStatus("DRAFT");
              if (onNotification) onNotification("Draft Saved", `${docTitle} draft saved`, "success");
            }}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-700 cursor-pointer shadow-2xs"
          >
            Save Draft (F9)
          </button>
          <button
            onClick={() => {
              setStatus("POSTED");
              if (onNotification) onNotification("Submitted", `${docTitle} submitted & posted!`, "success");
            }}
            className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow-xs cursor-pointer"
          >
            Submit (F10)
          </button>
          <button
            onClick={handlePrint}
            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-md font-bold flex items-center cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-md cursor-pointer"
            title="Procurement Studio Configuration"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
          </button>
          <div className="pl-2 border-l border-slate-200 text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">PO No.</span>
            <span className="font-mono font-extrabold text-blue-600 text-xs">{poNumber}</span>
          </div>
        </div>
      </div>

      {/* ================= 2-COLUMN MASTER FORM (SUPPLIER INFO + DOCUMENT DETAILS) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ----- SUPPLIER INFORMATION (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Building2 className="w-3.5 h-3.5" />
              <span>Supplier Information</span>
            </div>
            <button className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold flex items-center border border-blue-200">
              <Plus className="w-3 h-3 mr-0.5" />
              New
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="SUPP-A90F98">Demo Supplier from UI</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Supplier Code</label>
              <input type="text" readOnly value={activeSupplier.code} className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-slate-700" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">GSTIN</label>
              <input type="text" defaultValue={activeSupplier.gstin} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Contact Person</label>
              <input type="text" defaultValue={activeSupplier.contactPerson} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Expected Delivery</label>
              <input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Warehouse *</label>
              <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800">
                <option value="Main Warehouse">Main Warehouse</option>
                <option value="Central Store">Central Store</option>
              </select>
            </div>
          </div>
        </div>

        {/* ----- DOCUMENT DETAILS (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5" />
              <span>Document Details</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Financial Year</span>
              <span className="font-bold text-slate-800 text-xs">{financialYear}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Payment Terms</span>
              <div className="flex items-center space-x-1">
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px]">30 Days</span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">60 Days</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Currency</span>
              <span className="font-semibold text-slate-800 text-xs">{currency}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Buying Price List</span>
              <span className="font-semibold text-slate-800 text-xs">{priceList}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= QUICK FILTER PILLS & TEMPORARY PRODUCT APPROVAL BAR ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Filter Counters */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Product Filters:</span>
          <button
            onClick={() => setItemFilterMode("ALL")}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
              itemFilterMode === "ALL" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All ({tempCounts.total})
          </button>
          <button
            onClick={() => setItemFilterMode("EXISTING")}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
              itemFilterMode === "EXISTING" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Existing ({tempCounts.existing})
          </button>
          <button
            onClick={() => setItemFilterMode("NEW_ARTICLE")}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer flex items-center space-x-1 ${
              itemFilterMode === "NEW_ARTICLE" ? "bg-amber-600 text-white shadow-2xs" : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-500 mr-0.5" />
            <span>New Articles ({tempCounts.newArticles})</span>
          </button>
          <button
            onClick={() => setItemFilterMode("PENDING_APPROVAL")}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer flex items-center space-x-1 ${
              itemFilterMode === "PENDING_APPROVAL" ? "bg-rose-600 text-white shadow-2xs" : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
            }`}
          >
            <AlertCircle className="w-3 h-3 text-rose-500 mr-0.5" />
            <span>Pending Approval ({tempCounts.pendingApproval})</span>
          </button>
        </div>

        {/* Master Data Approval Button */}
        {tempCounts.pendingApproval > 0 && (
          <button
            onClick={handleApproveMasterItems}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Approve & Generate Item Master ({tempCounts.pendingApproval})
          </button>
        )}
      </div>

      {/* ================= ITEMS DATA TABLE CARD ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <ShoppingCart className="w-4 h-4" />
              <span>Items ({filteredItems.length})</span>
            </div>

            {/* Pivot View Selector */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-bold border border-slate-200">
              <span className="text-slate-400 px-1.5 uppercase text-[9px]">View:</span>
              <select
                value={pivotViewMode}
                onChange={(e) => setPivotViewMode(e.target.value as PivotViewMode)}
                className="bg-transparent font-extrabold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="STANDARD">Standard Grid</option>
                <option value="SIZE">Pivot by Size</option>
                <option value="COLOR">Pivot by Color</option>
                <option value="ARTICLE">Pivot by Article</option>
                <option value="STYLE">Pivot by Style</option>
                <option value="MATRIX">Color × Size Matrix</option>
              </select>
            </div>
          </div>

          {/* Action Toolbar with Multi-Mode + Add Items Dropdown */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Split Button: + Add Items Dropdown */}
            <div className="relative inline-block">
              <div className="flex items-center shadow-xs rounded-lg overflow-hidden border border-blue-700">
                <button
                  onClick={() => setShowVariantMatrixModal(true)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center cursor-pointer text-[11px]"
                  title="Open Apparel / Footwear Variant Matrix Entry (F7)"
                >
                  <Grid className="w-3.5 h-3.5 mr-1" />
                  + Add Items (Variant Matrix)
                </button>
                <button
                  onClick={() => setShowAddItemsMenu(!showAddItemsMenu)}
                  className="px-1.5 py-1 bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center cursor-pointer border-l border-blue-500"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Multi-Mode Dropdown Menu */}
              {showAddItemsMenu && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1 text-xs space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 tracking-wider border-b border-slate-100">
                    Selection Entry Mode
                  </div>
                  <button
                    onClick={() => handleAddItem(undefined, "MATRIX")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 rounded-lg flex items-center justify-between text-blue-700 font-bold"
                  >
                    <span className="flex items-center"><Grid className="w-3.5 h-3.5 mr-2 text-indigo-600" />Variant Matrix (Color × Size)</span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1 rounded font-mono">RECOMMENDED</span>
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "NEW_ARTICLE")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-amber-50 rounded-lg flex items-center justify-between text-amber-800 font-bold border-t border-slate-100"
                  >
                    <span className="flex items-center"><Sparkles className="w-3.5 h-3.5 mr-2 text-amber-600" />+ Create On-the-Fly Article (F8)</span>
                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-mono">TEMP</span>
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "ARTICLE")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold"
                  >
                    <Tag className="w-3.5 h-3.5 mr-2 text-slate-500" />By Existing Article
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "BARCODE")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold"
                  >
                    <Scan className="w-3.5 h-3.5 mr-2 text-slate-500" />By Barcode / SKU
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "STYLE")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold"
                  >
                    <Package className="w-3.5 h-3.5 mr-2 text-slate-500" />By Style / Model
                  </button>
                  <button
                    onClick={() => handleAddItem(undefined, "EXCEL")}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold border-t border-slate-100"
                  >
                    <Upload className="w-3.5 h-3.5 mr-2 text-emerald-600" />Bulk Excel Import
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowItemPickerModal(true)}
              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]"
            >
              <Scan className="w-3 h-3 mr-1 text-indigo-600" />
              Scan Barcode
            </button>
            <button
              onClick={handleDeleteSelectedItems}
              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete Row
            </button>
            <button className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]">
              <Upload className="w-3 h-3 mr-1 text-slate-500" />
              Import
            </button>
            <button className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center cursor-pointer text-[11px]">
              <Download className="w-3 h-3 mr-1 text-slate-500" />
              Export
            </button>
          </div>
        </div>

        {/* Data Table / Pivot by Size View */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg smriti-custom-scroll">
          {pivotViewMode === "MATRIX" ? (
            <table className="w-full text-left text-xs border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-indigo-900 text-white text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="py-2 px-2.5">Color</th>
                  {matrixColumns.map((size) => <th key={size} className="py-2 px-2 text-right bg-indigo-800">{size}</th>)}
                  <th className="py-2 px-2 text-right bg-indigo-950">Total Qty</th>
                  <th className="py-2 px-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-medium text-[11px]">
                {Array.from(new Set(filteredItems.map((item) => item.color || "Unspecified"))).map((color) => {
                  const colorItems = filteredItems.filter((item) => (item.color || "Unspecified") === color);
                  const totalQty = colorItems.reduce((sum, item) => sum + item.qty, 0);
                  const totalValue = colorItems.reduce((sum, item) => sum + item.qty * item.rate, 0);
                  return (
                    <tr key={color} className="hover:bg-indigo-50/50">
                      <td className="py-2 px-2.5 font-bold text-slate-800">{color}</td>
                      {matrixColumns.map((size) => (
                        <td key={size} className="py-2 px-2 text-right font-mono text-indigo-800">
                          {colorItems.filter((item) => item.size === size).reduce((sum, item) => sum + item.qty, 0)}
                        </td>
                      ))}
                      <td className="py-2 px-2 text-right font-mono font-black text-indigo-950">{totalQty}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">₹{totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : pivotViewMode === "SIZE" ? (
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-indigo-900 text-white text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="py-2 px-2.5 w-8 text-center">#</th>
                  <th className="py-2 px-2.5">Article / SKU</th>
                  <th className="py-2 px-2.5">Item Description</th>
                  <th className="py-2 px-2.5">Colorway</th>
                  <th className="py-2 px-2 text-center bg-indigo-800 w-14">S (38)</th>
                  <th className="py-2 px-2 text-center bg-indigo-800 w-14">M (40)</th>
                  <th className="py-2 px-2 text-center bg-indigo-800 w-14">L (42)</th>
                  <th className="py-2 px-2 text-center bg-indigo-800 w-14">XL (44)</th>
                  <th className="py-2 px-2 text-center bg-indigo-800 w-14">XXL (46)</th>
                  <th className="py-2 px-2 text-right bg-indigo-950 font-black">Total Qty</th>
                  <th className="py-2 px-2.5 text-right">Rate (₹)</th>
                  <th className="py-2 px-2.5 text-right font-black">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-[11px] bg-white">
                {filteredItems.map((item, idx) => {
                  const sizeQtyS = item.size === "S" ? item.qty : Math.floor(item.qty * 0.2);
                  const sizeQtyM = item.size === "M" ? item.qty : Math.floor(item.qty * 0.3);
                  const sizeQtyL = item.size === "L" ? item.qty : Math.floor(item.qty * 0.3);
                  const sizeQtyXL = item.size === "XL" ? item.qty : Math.floor(item.qty * 0.15);
                  const sizeQtyXXL = item.size === "XXL" ? item.qty : Math.floor(item.qty * 0.05);
                  const totalMatrixQty = sizeQtyS + sizeQtyM + sizeQtyL + sizeQtyXL + sizeQtyXXL;
                  const totalAmount = totalMatrixQty * item.rate;

                  return (
                    <tr key={item.id} className="hover:bg-indigo-50/50 transition-colors">
                      <td className="py-2 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-2.5 font-mono font-bold text-indigo-700">{item.itemCode}</td>
                      <td className="py-2 px-2.5 font-semibold text-slate-800">{item.itemName}</td>
                      <td className="py-2 px-2.5">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-700">
                          {item.color || "Black"}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center bg-indigo-50/30">
                        <input
                          type="number"
                          defaultValue={sizeQtyS}
                          className="w-12 text-center font-mono font-bold bg-white border border-indigo-200 rounded py-0.5 text-indigo-900 focus:outline-none focus:border-indigo-600"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center bg-indigo-50/30">
                        <input
                          type="number"
                          defaultValue={sizeQtyM}
                          className="w-12 text-center font-mono font-bold bg-white border border-indigo-200 rounded py-0.5 text-indigo-900 focus:outline-none focus:border-indigo-600"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center bg-indigo-50/30">
                        <input
                          type="number"
                          defaultValue={sizeQtyL}
                          className="w-12 text-center font-mono font-bold bg-white border border-indigo-200 rounded py-0.5 text-indigo-900 focus:outline-none focus:border-indigo-600"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center bg-indigo-50/30">
                        <input
                          type="number"
                          defaultValue={sizeQtyXL}
                          className="w-12 text-center font-mono font-bold bg-white border border-indigo-200 rounded py-0.5 text-indigo-900 focus:outline-none focus:border-indigo-600"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center bg-indigo-50/30">
                        <input
                          type="number"
                          defaultValue={sizeQtyXXL}
                          className="w-12 text-center font-mono font-bold bg-white border border-indigo-200 rounded py-0.5 text-indigo-900 focus:outline-none focus:border-indigo-600"
                        />
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-black text-indigo-950 bg-indigo-100/50">
                        {totalMatrixQty}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-800">
                        {item.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-black text-emerald-700">
                        ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-1.5 px-2 w-8 text-center">
                    <input type="checkbox" onChange={handleSelectAll} className="rounded border-slate-300" />
                  </th>
                  <th className="py-1.5 px-2 w-8 text-center">#</th>
                  <th className="py-1.5 px-2">Article / SKU *</th>
                  <th className="py-1.5 px-2">Item Description *</th>
                  <th className="py-1.5 px-2">Color / Size</th>
                  <th className="py-1.5 px-2 text-center">Master Status</th>
                  <th className="py-1.5 px-2">Warehouse *</th>
                  <th className="py-1.5 px-2 text-right">Qty *</th>
                  <th className="py-1.5 px-2 text-right">Rate (INR) *</th>
                  <th className="py-1.5 px-2 text-right">Discount %</th>
                  <th className="py-1.5 px-2 text-right font-extrabold">Amount (INR) *</th>
                  <th className="py-1.5 px-2 text-center w-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                {filteredItems.map((item, idx) => {
                  const gross = item.qty * item.rate;
                  const disc = (gross * (item.discountPercent || 0)) / 100;
                  const lineTotal = gross - disc;
                  const isHighlighted = highlightedItemId === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setHighlightedItemId(item.id)}
                      className={`transition-colors cursor-pointer ${
                        isHighlighted ? "bg-amber-100/70 border-l-4 border-amber-500" : "hover:bg-blue-50/40"
                      }`}
                    >
                      <td className="py-1 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!selectedItemIds[item.id]}
                          onChange={() => handleSelectItem(item.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-1 px-2 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-1 px-2 font-mono font-bold text-slate-800">
                        <div className="flex items-center space-x-1">
                          <span>{item.itemCode}</span>
                          <Search className="w-3 h-3 text-slate-400 cursor-pointer" onClick={() => setShowItemPickerModal(true)} />
                        </div>
                      </td>
                      <td className="py-1 px-2 font-semibold text-slate-900">{item.itemName}</td>

                      {/* Color / Size Badge */}
                      <td className="py-1 px-2">
                        {item.color || item.size ? (
                          <div className="flex items-center space-x-1 text-[10px]">
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-mono font-bold">{item.color || "BLK"}</span>
                            <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded font-mono font-bold border border-indigo-200">{item.size || "M"}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Standard</span>
                        )}
                      </td>

                      {/* Temporary Product Master Status Badge */}
                      <td className="py-1 px-2 text-center">
                        {item.isTemporary ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[9px] font-mono font-extrabold animate-pulse">
                            NEW ARTICLE (PENDING)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-mono font-bold">
                            APPROVED MASTER
                          </span>
                        )}
                      </td>

                      <td className="py-1 px-2">
                        <select
                          value={item.warehouse}
                          onChange={(e) => handleUpdateItem(item.id, "warehouse", e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded px-1 py-0.5 text-[11px] text-slate-700"
                        >
                          <option value="Main Warehouse">Main Warehouse</option>
                          <option value="Central Store">Central Store</option>
                        </select>
                      </td>

                      <td className="py-1 px-2 text-right">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleUpdateItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                          className="w-16 bg-white border border-slate-300 rounded px-1 py-0.5 text-right font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="py-1 px-2 text-right">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleUpdateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                          className="w-16 bg-white border border-slate-300 rounded px-1 py-0.5 text-right font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="py-1 px-2 text-right">
                        <input
                          type="number"
                          value={item.discountPercent}
                          onChange={(e) => handleUpdateItem(item.id, "discountPercent", parseFloat(e.target.value) || 0)}
                          className="w-12 bg-white border border-slate-300 rounded px-1 py-0.5 text-right font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">
                        {lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-1 px-2 text-center">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg">
          <div className="flex items-center space-x-2 text-slate-600">
            <button className="p-0.5 border border-slate-300 rounded bg-white"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button className="px-2 py-0.2 bg-blue-600 text-white rounded font-bold text-[11px]">1</button>
            <button className="px-2 py-0.2 bg-white border border-slate-300 rounded text-[11px]">2</button>
            <button className="p-0.5 border border-slate-300 rounded bg-white"><ChevronRight className="w-3.5 h-3.5" /></button>
            <span className="text-slate-400 text-[11px] ml-2">Rows per page</span>
            <select className="bg-white border border-slate-300 rounded px-1 py-0.2 text-slate-700 text-[11px]">
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="flex items-center space-x-5 text-slate-700 text-[11px]">
            <div>
              <span className="text-slate-400 uppercase text-[9px] block">Total Qty</span>
              <span className="font-mono text-xs text-slate-900">{totals.totalQty.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase text-[9px] block">Total Discount</span>
              <span className="font-mono text-xs text-slate-900">{totals.totalDiscount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase text-[9px] block">Taxes (INR)</span>
              <span className="font-mono text-xs text-slate-900">{totals.totalTaxes.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pl-3 border-l border-slate-200">
              <span className="text-slate-400 uppercase text-[9px] block">Grand Total (INR)</span>
              <span className="font-mono text-sm font-black text-emerald-600">{totals.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM COLLAPSIBLE VISUAL PRODUCT GALLERY ================= */}
      {studioConfig.showProductGallery && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs uppercase tracking-wide">
              <ImageIcon className="w-4 h-4" />
              <span>Article & Visual Product Gallery ({items.length})</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Bi-directional Interactive Highlighting Active</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {items.map((item) => {
              const isSelected = highlightedItemId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setHighlightedItemId(item.id)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-amber-50 border-amber-500 ring-2 ring-amber-400/40 shadow-sm"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="h-24 w-full bg-slate-200 rounded-lg overflow-hidden relative flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.itemName} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="w-8 h-8 text-slate-400" />
                      )}
                      {item.isTemporary && (
                        <span className="absolute top-1 left-1 bg-amber-600 text-white font-mono font-bold text-[8px] px-1 rounded shadow-xs">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 text-xs truncate">{item.itemName}</div>
                    <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                      <span>{item.articleCode || item.itemCode}</span>
                      <span className="font-bold text-indigo-600">{item.size || "M"}</span>
                    </div>
                  </div>

                  <div className="pt-1.5 mt-1 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-600 font-mono">{item.qty} Pcs</span>
                    <span className="font-bold text-emerald-600 font-mono">₹ {item.rate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= BOTTOM SPLIT SECTION (TAXES BREAKDOWN + RIGHT DOCKED SUMMARY CARD) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ----- LEFT SIDE: TABS (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex flex-wrap items-center space-x-3 border-b border-slate-200 pb-1.5 text-xs font-bold">
            <button
              onClick={() => setActiveBottomTab("taxes")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "taxes" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              TAXES
            </button>
            <button
              onClick={() => setActiveBottomTab("shipping")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "shipping" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              SHIPPING & OTHER CHARGES
            </button>
            <button
              onClick={() => setActiveBottomTab("terms")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "terms" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              TERMS & CONDITIONS
            </button>
            <button
              onClick={() => setActiveBottomTab("notes")}
              className={`pb-1 uppercase tracking-wide cursor-pointer ${
                activeBottomTab === "notes" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              NOTES
            </button>
          </div>

          <div className="text-xs">
            {activeBottomTab === "taxes" && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                      <th className="py-1.5 px-2.5">Tax Type</th>
                      <th className="py-1.5 px-2.5 text-right">Tax Rate %</th>
                      <th className="py-1.5 px-2.5 text-right">Taxable Amount (INR)</th>
                      <th className="py-1.5 px-2.5 text-right">Tax Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-slate-700">CGST</td>
                      <td className="py-1.5 px-2.5 text-right">6.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono">29,750.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">{totals.cgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-slate-700">SGST</td>
                      <td className="py-1.5 px-2.5 text-right">6.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono">29,750.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">{totals.sgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-slate-700">IGST</td>
                      <td className="py-1.5 px-2.5 text-right">18.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono">24,500.00</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">{totals.igstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeBottomTab === "notes" && (
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Enter purchase terms, conditions, or supplier instructions..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium focus:outline-none focus:border-blue-500 h-20"
              />
            )}

            {(activeBottomTab === "shipping" || activeBottomTab === "terms") && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs">
                Standard ERP sourcing terms apply. Goods to be delivered to Main Warehouse within expected date.
              </div>
            )}
          </div>
        </div>

        {/* ----- RIGHT DOCKED SUMMARY CARD (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Receipt className="w-3.5 h-3.5" />
              <span>SUMMARY</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Total Item Amount</span>
              <span className="font-mono font-bold text-slate-800">
                {totals.totalItemAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Total Discount</span>
              <span className="font-mono font-bold text-slate-800">
                {totals.totalDiscount.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Total Taxes</span>
              <span className="font-mono font-bold text-slate-800">
                {totals.totalTaxes.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Other Charges</span>
              <span className="font-mono font-bold text-slate-800">0.00</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Round Off</span>
              <span className="font-mono font-bold text-slate-800">{totals.roundOff.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs font-extrabold text-slate-900">Net Payable</span>
              <span className="text-lg font-black text-emerald-600 font-mono tracking-tight">
                {totals.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="pt-1.5 border-t border-slate-100 text-[10px]">
              <span className="font-bold text-slate-500 block uppercase">Amount in Words</span>
              <span className="font-semibold text-slate-800 italic">{amountInWords}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ON-THE-FLY NEW ARTICLE CREATION MODAL ================= */}
      {showNewArticleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Create On-the-Fly Article (Temporary)</h3>
                  <p className="text-xs text-slate-500">Add a new article specification directly to PO without pre-existing Item Master.</p>
                </div>
              </div>
              <button onClick={() => setShowNewArticleModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Article Code *</label>
                  <input
                    type="text"
                    value={newArticleForm.articleCode}
                    onChange={(e) => setNewArticleForm({ ...newArticleForm, articleCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Article Name *</label>
                  <input
                    type="text"
                    value={newArticleForm.articleName}
                    onChange={(e) => setNewArticleForm({ ...newArticleForm, articleName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Style / Fit</label>
                  <input
                    type="text"
                    value={newArticleForm.style}
                    onChange={(e) => setNewArticleForm({ ...newArticleForm, style: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Color</label>
                  <input
                    type="text"
                    value={newArticleForm.color}
                    onChange={(e) => setNewArticleForm({ ...newArticleForm, color: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Size</label>
                  <input
                    type="text"
                    value={newArticleForm.size}
                    onChange={(e) => setNewArticleForm({ ...newArticleForm, size: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Buying Rate (₹) *</label>
                  <input
                    type="number"
                    value={newArticleForm.buyingRate}
                    onChange={(e) => setNewArticleForm({ ...newArticleForm, buyingRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-blue-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">GST Rate %</label>
                  <input
                    type="number"
                    value={newArticleForm.gstRate}
                    onChange={(e) => setNewArticleForm({ ...newArticleForm, gstRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button onClick={() => setShowNewArticleModal(false)} className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-bold">
                Cancel
              </button>
              <button onClick={handleCreateTemporaryArticle} className="px-5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center shadow-md">
                <Check className="w-4 h-4 mr-1" />
                Add Temporary Article
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FASHION / FOOTWEAR VARIANT MATRIX ENTRY MODAL ================= */}
      {showVariantMatrixModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Grid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                    <span className="leading-tight">Fashion & Apparel Variant Matrix Entry</span>
                    <span className="px-2 py-0.2 bg-indigo-100 text-indigo-800 text-[9px] font-mono rounded-full font-bold">SPK.entities</span>
                  </h3>
                  <p className="text-xs text-slate-500">Enter quantities across Color × Size matrix to generate purchase order lines instantly.</p>
                </div>
              </div>
              <button onClick={() => setShowVariantMatrixModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Business domain</span>
                <select
                  value={businessDomain}
                  onChange={(e) => handleBusinessDomainChange(e.target.value as BusinessDomain)}
                  className="font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 w-full text-xs"
                >
                  {Object.keys(BUSINESS_DOMAIN_PROFILES).map((domain) => <option key={domain} value={domain}>{domain}</option>)}
                </select>
                <p className="mt-1 text-[10px] text-slate-500">{activeDomainProfile.dimensions.join(" • ")}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Article Code</span>
                <input
                  type="text"
                  value={selectedArticle.articleCode}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, articleCode: e.target.value })}
                  className="font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 w-full text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Article Description</span>
                <input
                  type="text"
                  value={selectedArticle.articleName}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, articleName: e.target.value })}
                  className="font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 w-full text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Style / Fit</span>
                <span className="font-semibold text-slate-700 block mt-1">{selectedArticle.style}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Base Buying Rate (₹)</span>
                <input
                  type="number"
                  value={selectedArticle.baseRate}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, baseRate: parseFloat(e.target.value) || 0 })}
                  className="font-mono font-bold text-blue-700 bg-white border border-slate-300 rounded px-2 py-1 w-full text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Category</span>
                <select
                  value={selectedArticle.category}
                  onChange={(e) => {
                    setSelectedArticle({ ...selectedArticle, category: e.target.value });
                    setSelectedCategoryStatus("ITEM_MASTER");
                  }}
                  className="font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 w-full text-xs"
                >
                  {availableMatrixCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <div className="mt-1 flex items-center gap-1">
                  <input
                    type="text"
                    value={newMatrixCategory}
                    onChange={(e) => setNewMatrixCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateMissingMatrixCategory(); }}
                    placeholder="Only if missing"
                    className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleCreateMissingMatrixCategory}
                    disabled={!newMatrixCategory.trim() || availableMatrixCategories.some((entry) => entry.toLowerCase() === newMatrixCategory.trim().toLowerCase())}
                    className="rounded bg-amber-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                  >
                    Add pending
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {selectedCategoryStatus === "PENDING_APPROVAL" ? "Pending Item Master approval" : "From Item Master"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-500">Size category</span>
                <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-white p-1 border border-slate-200">
                  {(["apparel", "footwear", "hybrid"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMatrixSizeMode(mode)}
                      className={`min-h-9 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase transition-colors ${
                        matrixSizeMode === mode ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-indigo-50"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Add color
                <input
                  type="text"
                  value={newMatrixColor}
                  onChange={(e) => setNewMatrixColor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddMatrixColor(); }}
                  placeholder="e.g. Maroon"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs font-semibold normal-case text-slate-800 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddMatrixColor}
                  disabled={!newMatrixColor.trim()}
                  className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add color
                </button>
              </label>
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Add size
                <input
                  type="text"
                  inputMode="decimal"
                  value={newMatrixSize}
                  onChange={(e) => setNewMatrixSize(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddMatrixSize(); }}
                  placeholder="Footwear: 26, 27, 28"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs font-semibold normal-case text-slate-800 outline-none focus:border-indigo-500"
                />
                <select
                  value={newMatrixSizeCategory}
                  onChange={(e) => setNewMatrixSizeCategory(e.target.value as "apparel" | "footwear")}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs font-semibold normal-case text-slate-800 outline-none focus:border-indigo-500"
                  aria-label="New size category"
                >
                  <option value="footwear">Footwear size</option>
                  <option value="apparel">Apparel size</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddMatrixSize}
                  disabled={!newMatrixSize.trim()}
                  className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add size
                </button>
              </label>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl smriti-custom-scroll">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase">
                    <th className="py-2.5 px-3 text-left bg-slate-200 w-28">Color \ Size</th>
                    {activeMatrixSizes.map((sz) => (
                      <th key={sz} className="py-2.5 px-3 w-16 text-center font-mono">{sz}</th>
                    ))}
                    <th className="py-2.5 px-3 text-right bg-slate-200 w-20 font-bold">Total Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {availableColors.map((color) => {
                    let colorRowTotal = 0;
                    return (
                      <tr key={color} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-left font-bold text-slate-800 bg-slate-50 flex items-center space-x-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                            style={{
                              backgroundColor:
                                color === "Black" ? "#000" : color === "Blue" ? "#2563EB" : color === "Red" ? "#DC2626" : color === "Navy" ? "#1E3A8A" : "#FFF",
                            }}
                          ></span>
                          <span>{color}</span>
                        </td>
                        {activeMatrixSizes.map((size) => {
                          const key = `${color}_${size}`;
                          const qty = matrixQtyMap[key] || 0;
                          colorRowTotal += qty;
                          return (
                            <td key={size} className="py-1.5 px-2">
                              <input
                                type="number"
                                min="0"
                                value={qty || ""}
                                placeholder="0"
                                onChange={(e) => handleMatrixQtyChange(color, size, parseInt(e.target.value) || 0)}
                                className={`w-14 text-center border rounded py-1 text-xs font-mono font-bold focus:outline-none focus:border-blue-500 ${
                                  qty > 0 ? "bg-blue-50 border-blue-400 text-blue-800" : "bg-white border-slate-200 text-slate-400"
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-800 bg-slate-50">
                          {colorRowTotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-600 font-semibold">
                Total Matrix Items: <span className="font-mono font-bold text-blue-700">{Object.values(matrixQtyMap).reduce((a, b) => a + (b || 0), 0)} Pcs</span>
              </div>
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
                <button onClick={() => setShowVariantMatrixModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleGenerateMatrixLines} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center shadow-md">
                  <Check className="w-4 h-4 mr-1" />
                  Generate Purchase Lines
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PROCUREMENT STUDIO CONFIGURATION MODAL ================= */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Procurement Studio Metadata Configuration</h3>
                  <p className="text-xs text-slate-500">Configure operational rules, approval queues, gallery views, and SUPP print profiles.</p>
                </div>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800">On-the-Fly Article Creation</div>
                  <div className="text-[11px] text-slate-500">Allow buyers to add temporary articles without pre-existing Item Master</div>
                </div>
                <input
                  type="checkbox"
                  checked={studioConfig.allowOntheFlyArticle}
                  onChange={(e) => setStudioConfig({ ...studioConfig, allowOntheFlyArticle: e.target.checked })}
                  className="rounded border-slate-300 w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800">Require Master Approval Queue</div>
                  <div className="text-[11px] text-slate-500">Require manager review before promoting temporary items into Item Master</div>
                </div>
                <input
                  type="checkbox"
                  checked={studioConfig.requireMasterApproval}
                  onChange={(e) => setStudioConfig({ ...studioConfig, requireMasterApproval: e.target.checked })}
                  className="rounded border-slate-300 w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800">Show Visual Product Gallery</div>
                  <div className="text-[11px] text-slate-500">Display bottom interactive article & product gallery</div>
                </div>
                <input
                  type="checkbox"
                  checked={studioConfig.showProductGallery}
                  onChange={(e) => setStudioConfig({ ...studioConfig, showProductGallery: e.target.checked })}
                  className="rounded border-slate-300 w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800">SUPP Print Product Images</div>
                  <div className="text-[11px] text-slate-500">Include article images in thermal & A4 printouts</div>
                </div>
                <input
                  type="checkbox"
                  checked={studioConfig.printImagesInPO}
                  onChange={(e) => setStudioConfig({ ...studioConfig, printImagesInPO: e.target.checked })}
                  className="rounded border-slate-300 w-4 h-4"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  if (onNotification) onNotification("Config Saved", "Procurement metadata studio settings updated", "success");
                }}
                className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ITEM PICKER MODAL (F2) ================= */}
      {showItemPickerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-4 space-y-3 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-xs flex items-center space-x-2">
                <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
                <span>Select Purchase Item (F2)</span>
              </h3>
              <button onClick={() => setShowItemPickerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto smriti-custom-scroll">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleAddItem(prod)}
                  className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{prod.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Code: {prod.code || prod.sku} | HSN: {prod.hsnCode || "6109"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-blue-600 text-xs">₹ {prod.price}</div>
                    <div className="text-[10px] text-slate-400">Stock: {prod.stock}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
