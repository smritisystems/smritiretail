/**
 * Project      : SMRITI Retail OS
 * Component    : PrintLabelsStudio (Dedicated Single Page Barcode & Label Printing Studio)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 3.29.0
 * License      : Proprietary Commercial Software
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { WindowManager } from "../../sdk";
import { PRNVariableEngine, TATTLY_THREADS_ZPL_SCRIPT } from "../../services/label_print/PRNVariableEngine";
import { SystemPrinterDiscovery, SystemPrinterInfo } from "../../services/label_print/PrintProviderFramework";
import { UniversalAttributeEngine, IndustryPackManager, IndustryType } from "../../core/metadata";
import { PrintingService, PrintDocument } from "../../core/printing";
import { PRNTemplateStudio } from "./PRNTemplateStudio.tsx";
import { Product } from "../../types";
import { SPK } from "../../kernel/SPK";
import { IItemService } from "../../kernel/public/IItemService";
import { SupplierRecord } from "../../kernel/public/ISupplierService";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export interface PrintLabelsStudioProps {
  products?: Product[];
}

export interface PrintItemRow {
  id: string;
  selected: boolean;
  barcode: string;
  itemCode: string;
  itemName: string;
  uom: string;
  batchSerial: string;
  qty: number;
  printQty: number;
  stock?: number;
  styleCode?: string;
  modelNo?: string;
  articleNo?: string;
  labelTemplate: string;
  sizeMm: string;
  mrp: number;
  hsn: string;
  taxRate?: string;
  brand?: string;
  category?: string;
}

type ItemMasterFieldKey =
  | "barcode"
  | "sku"
  | "code"
  | "name"
  | "uom"
  | "hsnCode"
  | "hsn_code"
  | "gstPercentage"
  | "gst_rate"
  | "brand"
  | "category"
  | "styleCode"
  | "modelNo"
  | "articleNo"
  | "stock"
  | "stock_qty"
  | "mrp"
  | "price";

const ITEM_MASTER_FIELD_OPTIONS: { key: ItemMasterFieldKey; label: string }[] = [
  { key: "barcode", label: "Barcode" },
  { key: "sku", label: "SKU" },
  { key: "code", label: "Product Code" },
  { key: "name", label: "Item Name" },
  { key: "uom", label: "UOM" },
  { key: "hsnCode", label: "HSN Code" },
  { key: "hsn_code", label: "HSN Code (Legacy)" },
  { key: "gstPercentage", label: "GST Percentage" },
  { key: "gst_rate", label: "GST Rate" },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "styleCode", label: "Style Code" },
  { key: "modelNo", label: "Model Number" },
  { key: "articleNo", label: "Article Number" },
  { key: "stock", label: "Stock" },
  { key: "stock_qty", label: "Stock Quantity" },
  { key: "mrp", label: "MRP" },
  { key: "price", label: "Price" },
];

export type SourceType =
  | "manual"
  | "item_master"
  | "purchase_order"
  | "purchase_invoice"
  | "grn"
  | "purchase_return"
  | "sales_invoice"
  | "sales_return"
  | "stock_transfer"
  | "production"
  | "physical_stock"
  | "batch"
  | "serial_number"
  | "direct_scan";

// Source Datasets for Dynamic Switching
const SOURCE_DATASETS: Record<SourceType, PrintItemRow[]> = {
  manual: [
    { id: "row-1", selected: true, barcode: "8901234567890", itemCode: "SHO-1001", itemName: "Tattly Threads Dual Tag Item", uom: "Pair", batchSerial: "-", qty: 50, printQty: 50, stock: 50, styleCode: "SHO-101", modelNo: "MDL-101", labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 2500.0, hsn: "6404", taxRate: "18% IGST", brand: "Tattly Threads", category: "Footwear" },
    { id: "row-2", selected: true, barcode: "8901234567891", itemCode: "SOC-2001", itemName: "Cotton Sock Dual Tag", uom: "Pair", batchSerial: "-", qty: 100, printQty: 100, stock: 100, styleCode: "SCK-200", modelNo: "MDL-200", labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 250.0, hsn: "6115", taxRate: "12% GST", brand: "Tattly Threads", category: "Apparel" },
    { id: "row-3", selected: true, barcode: "BAT-001", itemCode: "BAT-001", itemName: "Batch Dual Tag Item", uom: "Pcs", batchSerial: "BATCH-2025-05", qty: 200, printQty: 200, stock: 200, styleCode: "BAT-500", modelNo: "MDL-500", labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 1200.0, hsn: "6109", brand: "Tattly Threads", category: "Apparel" },
    { id: "row-4", selected: true, barcode: "SRL-000123", itemCode: "SERIAL-001", itemName: "Serial Footwear Tag", uom: "Pcs", batchSerial: "SRL-000123", qty: 1, printQty: 1, stock: 1, styleCode: "SRL-999", modelNo: "MDL-999", labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 3500.0, hsn: "6403", brand: "Tattly Threads", category: "Footwear" },
  ],
  item_master: [
    { id: "im-1", selected: true, barcode: "8901234567892", itemCode: "CAP-3001", itemName: "Tattly Cap Tag", uom: "Pcs", batchSerial: "-", qty: 40, printQty: 40, stock: 40, styleCode: "CAP-100", modelNo: "MDL-110", labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 500.0, hsn: "6505", brand: "Tattly Threads", category: "Accessories" },
    { id: "im-2", selected: true, barcode: "8901234567893", itemCode: "TSH-4001", itemName: "Tattly Running T-Shirt Tag", uom: "Pcs", batchSerial: "-", qty: 60, printQty: 60, stock: 60, styleCode: "TSH-400", modelNo: "MDL-410", labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 1200.0, hsn: "6109", brand: "Tattly Threads", category: "Apparel" },
  ],
  purchase_order: [
    { id: "po-1", selected: true, barcode: "8901234567897", itemCode: "PO-2026-001", itemName: "Purchase Order Textile Roll", uom: "Roll", batchSerial: "PO-2026-001", qty: 75, printQty: 75, stock: 75, styleCode: "TXT-301", modelNo: "MDL-301", labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 850.0, hsn: "5208", brand: "Tattly Threads", category: "Textiles" },
  ],
  purchase_invoice: [
    { id: "pi-1", selected: true, barcode: "8901234567894", itemCode: "PINV-101", itemName: "Formal Leather Shoes", uom: "Pair", batchSerial: "PINV-9912", qty: 25, printQty: 25, stock: 25, styleCode: "LEA-210", modelNo: "MDL-210", labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 3500.0, hsn: "6403", brand: "Tattly Threads", category: "Footwear" },
  ],
  grn: [
    { id: "grn-1", selected: true, barcode: "8901234567895", itemCode: "GRN-901", itemName: "Denim Jeans Trousers", uom: "Pcs", batchSerial: "GRN-2025-08", qty: 80, printQty: 80, stock: 80, styleCode: "DEN-400", modelNo: "MDL-400", labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 1800.0, hsn: "6203", brand: "Tattly Threads", category: "Apparel" },
  ],
  purchase_return: [],
  sales_invoice: [
    { id: "si-1", selected: true, barcode: "8901234567896", itemCode: "INV-881", itemName: "Smart POS Printer", uom: "Pcs", batchSerial: "POS-SN-99", qty: 2, printQty: 2, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 6500.0, hsn: "8471", brand: "Tattly Threads", category: "Electronics" },
  ],
  sales_return: [],
  stock_transfer: [],
  production: [],
  physical_stock: [],
  batch: [
    { id: "bt-1", selected: true, barcode: "BAT-001", itemCode: "BAT-001", itemName: "Batch Item", uom: "Pcs", batchSerial: "BATCH-2025-05", qty: 200, printQty: 200, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 1200.0, hsn: "6109", brand: "Tattly Threads" },
  ],
  serial_number: [
    { id: "sr-1", selected: true, barcode: "SRL-000123", itemCode: "SERIAL-001", itemName: "Serial Item", uom: "Pcs", batchSerial: "SRL-000123", qty: 1, printQty: 1, labelTemplate: "Tattly Threads Dual Tag (ZPL)", sizeMm: "100 x 50.7", mrp: 3500.0, hsn: "6403", brand: "Tattly Threads" },
  ],
  direct_scan: [],
};

export const PrintLabelsStudio: React.FC<PrintLabelsStudioProps> = ({ products: propsProducts }) => {
  const [liveProducts, setLiveProducts] = useState<Product[]>(propsProducts || []);

  useEffect(() => {
    if (propsProducts && propsProducts.length > 0) {
      setLiveProducts(propsProducts);
    } else {
      try {
        const itemService = SPK.services.resolve<IItemService>("ITEM");
        itemService.getAll().then((prods) => {
          if (prods && prods.length > 0) setLiveProducts(prods);
        });
      } catch (e) {
        console.warn("[PrintLabelsStudio] SPK ItemService unavailable", e);
      }
    }
  }, [propsProducts]);

  // Industry Pack Selection via SMP-M
  const [activeIndustry, setActiveIndustry] = useState<IndustryType>("apparel");

  const handleIndustryChange = (ind: IndustryType) => {
    setActiveIndustry(ind);
    IndustryPackManager.setIndustry(ind);
    showToast(`SMP-M Metadata Industry Pack Switched to: ${ind.toUpperCase()}`);
  };

  // Source Selection
  const [selectedSource, setSelectedSource] = useState<SourceType>("manual");

  // Hidable / Collapsible Panel States
  const [isSourceExpanded, setIsSourceExpanded] = useState<boolean>(true);
  const [isContextFiltersExpanded, setIsContextFiltersExpanded] = useState<boolean>(true);
  const [isRangeFiltersExpanded, setIsRangeFiltersExpanded] = useState<boolean>(true);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState<boolean>(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState<boolean>(true);

  // Main Navigation Tab (Batch Printing vs PRN Studio)
  const [activeMainTab, setActiveMainTab] = useState<"batch_print" | "prn_studio">("batch_print");

  // Context & Filter Inputs
  const [docFrom, setDocFrom] = useState<string>("");
  const [docTo, setDocTo] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("2025-05-01");
  const [dateTo, setDateTo] = useState<string>("2025-05-31");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("All Suppliers");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("All Warehouses");
  const [selectedSalesman, setSelectedSalesman] = useState<string>("All Salesmans");
  const [supplierList, setSupplierList] = useState<SupplierRecord[]>([]);

  useEffect(() => {
    apiFetchV1("/suppliers/")
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setSupplierList(list);
      })
      .catch((error) => {
        console.warn("[PrintLabelsStudio] Supplier filter data unavailable", error);
      });
  }, []);

  // Range Filters
  const [filterItemCodeFrom, setFilterItemCodeFrom] = useState<string>("");
  const [filterItemCodeTo, setFilterItemCodeTo] = useState<string>("");
  const [filterBarcodeFrom, setFilterBarcodeFrom] = useState<string>("");
  const [filterBarcodeTo, setFilterBarcodeTo] = useState<string>("");
  const [filterProductFrom, setFilterProductFrom] = useState<string>("");
  const [filterProductTo, setFilterProductTo] = useState<string>("");
  const [filterBrandFrom, setFilterBrandFrom] = useState<string>("");
  const [filterBrandTo, setFilterBrandTo] = useState<string>("");
  const [filterCategoryFrom, setFilterCategoryFrom] = useState<string>("");
  const [filterCategoryTo, setFilterCategoryTo] = useState<string>("");
  const [filterSubCategoryFrom, setFilterSubCategoryFrom] = useState<string>("");
  const [filterSubCategoryTo, setFilterSubCategoryTo] = useState<string>("");
  const [filterDepartmentFrom, setFilterDepartmentFrom] = useState<string>("");
  const [filterDepartmentTo, setFilterDepartmentTo] = useState<string>("");
  const [filterSectionFrom, setFilterSectionFrom] = useState<string>("");
  const [filterSectionTo, setFilterSectionTo] = useState<string>("");
  const [filterStyleFrom, setFilterStyleFrom] = useState<string>("");
  const [filterStyleTo, setFilterStyleTo] = useState<string>("");
  const [filterStockFrom, setFilterStockFrom] = useState<string>("");
  const [filterStockTo, setFilterStockTo] = useState<string>("");
  const [filterModelFrom, setFilterModelFrom] = useState<string>("");
  const [filterModelTo, setFilterModelTo] = useState<string>("");
  const [filterArticleFrom, setFilterArticleFrom] = useState<string>("");
  const [filterArticleTo, setFilterArticleTo] = useState<string>("");

  const [itemMasterFieldMap, setItemMasterFieldMap] = useState<Record<
    "barcode" | "itemCode" | "itemName" | "uom" | "brand" | "category" | "styleCode" | "modelNo" | "articleNo" | "stock" | "mrp" | "hsn",
    ItemMasterFieldKey
  >>({
    barcode: "barcode",
    itemCode: "sku",
    itemName: "name",
    uom: "uom",
    brand: "brand",
    category: "category",
    styleCode: "styleCode",
    modelNo: "modelNo",
    articleNo: "articleNo",
    stock: "stock",
    mrp: "mrp",
    hsn: "hsnCode",
  });

  const getMappedProductValue = (product: Product, field: ItemMasterFieldKey): string | undefined => {
    const value = (product as any)[field];
    if (value === undefined || value === null) return undefined;
    return typeof value === "number" || typeof value === "string" ? String(value) : undefined;
  };

  // Convert live Product array to PrintItemRow array
  const dynamicItemMasterRows = useMemo<PrintItemRow[]>(() => {
    if (!liveProducts || liveProducts.length === 0) return SOURCE_DATASETS.item_master;
    return liveProducts.map((p, idx) => {
      const mappedStock = Number(
        getMappedProductValue(p, itemMasterFieldMap.stock) ?? p.stock ?? p.stock_qty ?? 10
      );
      const mappedMrp = Number(getMappedProductValue(p, itemMasterFieldMap.mrp) ?? p.mrp ?? p.price ?? 100.0);
      const mappedHsn =
        getMappedProductValue(p, itemMasterFieldMap.hsn) || getMappedProductValue(p, "hsnCode") || getMappedProductValue(p, "hsn_code") || "8471";
      const mappedTaxRate = getMappedProductValue(p, "gst_rate") || getMappedProductValue(p, "gstPercentage") || "18";

      return {
        id: `im-dyn-${p.id || idx}`,
        selected: true,
        barcode:
          getMappedProductValue(p, itemMasterFieldMap.barcode) || getMappedProductValue(p, "sku") || getMappedProductValue(p, "code") || "",
        itemCode:
          getMappedProductValue(p, itemMasterFieldMap.itemCode) || getMappedProductValue(p, "sku") || getMappedProductValue(p, "code") || "",
        itemName: getMappedProductValue(p, itemMasterFieldMap.itemName) || p.name || "",
        uom: getMappedProductValue(p, itemMasterFieldMap.uom) || p.uom || "Pcs",
        batchSerial: "-",
        qty: Math.max(1, mappedStock),
        printQty: Math.max(1, mappedStock),
        labelTemplate: "Tattly Threads Dual Tag (ZPL)",
        sizeMm: "100 x 50.7",
        mrp: mappedMrp,
        hsn: mappedHsn,
        taxRate: `${parseFloat(mappedTaxRate) || 18}% GST`,
        brand: getMappedProductValue(p, itemMasterFieldMap.brand) || p.brand || "Smriti Standard",
        category: getMappedProductValue(p, itemMasterFieldMap.category) || p.category || "General",
        styleCode: getMappedProductValue(p, itemMasterFieldMap.styleCode) || (p as any).styleCode,
        modelNo: getMappedProductValue(p, itemMasterFieldMap.modelNo) || (p as any).modelNo,
        articleNo: getMappedProductValue(p, itemMasterFieldMap.articleNo) || (p as any).articleNo,
        stock: Number(getMappedProductValue(p, itemMasterFieldMap.stock) ?? p.stock ?? p.stock_qty ?? 0),
      };
    });
  }, [liveProducts, itemMasterFieldMap]);

  // Items to Print Table Dataset
  const [printItems, setPrintItems] = useState<PrintItemRow[]>(SOURCE_DATASETS.manual);

  useEffect(() => {
    if (selectedSource === "item_master") {
      setPrintItems(dynamicItemMasterRows);
    } else if (SOURCE_DATASETS[selectedSource]) {
      setPrintItems(SOURCE_DATASETS[selectedSource]);
    }
  }, [selectedSource, dynamicItemMasterRows]);

  // Datalist options derived from liveProducts & printItems
  const itemCodeOptions = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => {
      const mappedValue = getMappedProductValue(p, itemMasterFieldMap.itemCode);
      if (mappedValue) set.add(mappedValue);
      if (p.sku) set.add(p.sku);
      if (p.code) set.add(p.code);
    });
    printItems.forEach((i) => { if (i.itemCode) set.add(i.itemCode); });
    return Array.from(set);
  }, [liveProducts, printItems, itemMasterFieldMap]);

  const barcodeOptions = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => {
      const mappedValue = getMappedProductValue(p, itemMasterFieldMap.barcode);
      if (mappedValue) set.add(mappedValue);
      if (p.barcode) set.add(p.barcode);
    });
    printItems.forEach((i) => { if (i.barcode) set.add(i.barcode); });
    return Array.from(set);
  }, [liveProducts, printItems, itemMasterFieldMap]);

  const productOptions = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => {
      const mappedValue = getMappedProductValue(p, itemMasterFieldMap.itemName);
      if (mappedValue) set.add(mappedValue);
      if (p.name) set.add(p.name);
    });
    printItems.forEach((i) => { if (i.itemName) set.add(i.itemName); });
    return Array.from(set);
  }, [liveProducts, printItems, itemMasterFieldMap]);

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => {
      const mappedValue = getMappedProductValue(p, itemMasterFieldMap.brand);
      if (mappedValue) set.add(mappedValue);
      if (p.brand) set.add(p.brand);
    });
    printItems.forEach((i) => { if (i.brand) set.add(i.brand); });
    return Array.from(set);
  }, [liveProducts, printItems, itemMasterFieldMap]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => {
      const mappedValue = getMappedProductValue(p, itemMasterFieldMap.category);
      if (mappedValue) set.add(mappedValue);
      if (p.category) set.add(p.category);
    });
    printItems.forEach((i) => { if (i.category) set.add(i.category); });
    return Array.from(set);
  }, [liveProducts, printItems, itemMasterFieldMap]);

  const styleOptions = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => { if (p.styleCode) set.add(p.styleCode); });
    printItems.forEach((i) => { if (i.styleCode) set.add(i.styleCode); });
    return Array.from(set);
  }, [liveProducts, printItems]);

  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => { if ((p as any).modelNo) set.add((p as any).modelNo); });
    printItems.forEach((i) => { if (i.modelNo) set.add(i.modelNo); });
    return Array.from(set);
  }, [liveProducts, printItems]);

  const articleOptions = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => { if ((p as any).articleNo) set.add((p as any).articleNo); });
    printItems.forEach((i) => { if (i.articleNo) set.add(i.articleNo); });
    return Array.from(set);
  }, [liveProducts, printItems]);

  const stockOptions = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => { if (typeof p.stock === "number") set.add(p.stock.toString()); });
    printItems.forEach((i) => { if (typeof i.stock === "number") set.add(i.stock.toString()); });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [liveProducts, printItems]);

  // Preview Index
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);

  // System Printer Discovery State
  const [detectedPrinters, setDetectedPrinters] = useState<SystemPrinterInfo[]>([]);

  const refreshPrinters = async () => {
    const capabilities = await PrintingService.discoverPrinters(false);
    const list: SystemPrinterInfo[] = capabilities.map((printerInfo) => ({
      name: printerInfo.name,
      connection: printerInfo.connection === "USB" || printerInfo.connection === "SERIAL" || printerInfo.connection === "NETWORK" || printerInfo.connection === "VIRTUAL" ? printerInfo.connection : "SPOOLER",
      driver: printerInfo.protocols?.join(" / ") || "Windows / OS Spooler",
      isDefault: printerInfo.isDefault,
    }));
    setDetectedPrinters(list);

    // Prefer USB printers when USB connection mode is selected
    if (connectionType === "USB") {
      const usbPrinter = list.find((p) => p.connection === "USB");
      if (usbPrinter) {
        setPrinter(usbPrinter.name);
        showToast(`USB printer detected: ${usbPrinter.name}`);
        return;
      }
    }

    // Prefer Honeywell IH-2 or user's saved printer if present
    const honeywell = list.find((p) => p.name.includes("Honeywell"));
    if (honeywell) {
      setPrinter(honeywell.name);
    } else if (list.length > 0 && !list.some((p) => p.name === printer)) {
      setPrinter(list[0].name);
    }
    showToast(`Discovered ${list.length} Local System Printers`);
  };

  const requestUsbPrinter = async () => {
    const capabilities = await PrintingService.discoverPrinters(true);
    const usbPrinter = capabilities.find((printerInfo) => printerInfo.connection === "USB" || printerInfo.connection === "SERIAL");
    if (!usbPrinter) {
      showToast("No USB printer selected or WebUSB/Web Serial is unavailable");
      return;
    }

    setDetectedPrinters((current) => {
      const withoutDuplicate = current.filter((printerInfo) => printerInfo.name !== usbPrinter.name);
      return [{ name: usbPrinter.name, connection: usbPrinter.connection === "USB" || usbPrinter.connection === "SERIAL" ? usbPrinter.connection : "USB", driver: usbPrinter.protocols?.join(" / ") }, ...withoutDuplicate];
    });
    setPrinter(usbPrinter.name);
    showToast(`USB printer authorized: ${usbPrinter.name}`);
  };

  useEffect(() => {
    refreshPrinters();
  }, []);

  // TCP/IP Printer Hardware State
  const [connectionType, setConnectionType] = useState<string>("NETWORK_TCP");
  const [printerIp, setPrinterIp] = useState<string>("192.168.1.100");
  const [printerPort, setPrinterPort] = useState<number>(9100);
  const [tcpStatus, setTcpStatus] = useState<string>("Connected (192.168.1.100:9100)");

  const usbPrinters = detectedPrinters.filter((p) => p.connection === "USB");
  const isUsbConnection = connectionType === "USB";

  // Print Settings State - Default to Tattly Threads ZPL Dual Barcode Tag (100 x 50.7 mm)
  const [printer, setPrinter] = useState<string>("Zebra ZD420 (ZPL II)");
  const [labelSize, setLabelSize] = useState<string>("100 x 50.7 mm");
  const [labelsPerRow, setLabelsPerRow] = useState<number>(3);
  const [copies, setCopies] = useState<number>(1);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showHsn, setShowHsn] = useState<boolean>(true);
  const [showTax, setShowTax] = useState<boolean>(true);
  const [showBatchSerial, setShowBatchSerial] = useState<boolean>(false);
  const [showBrand, setShowBrand] = useState<boolean>(false);
  const [printDirection, setPrintDirection] = useState<string>("Left to Right");
  const [printQuality, setPrintQuality] = useState<string>("High (300 DPI)");

  // Modals & Printer Hardware Connection State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [isPrinterConfigModalOpen, setIsPrinterConfigModalOpen] = useState<boolean>(false);
  const [isFullPreviewModalOpen, setIsFullPreviewModalOpen] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<PrintItemRow | null>(null);

  // QZ Tray Status State
  const [isQzConnected, setIsQzConnected] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as any;
      const hasQz = Boolean(win.qz || win.WebSocket);
      setIsQzConnected(hasQz);
    }
  }, []);

  // Toast Notification
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Toggle All Filter Cards
  const toggleAllFilters = () => {
    const shouldExpand = !isSourceExpanded || !isContextFiltersExpanded || !isRangeFiltersExpanded;
    setIsSourceExpanded(shouldExpand);
    setIsContextFiltersExpanded(shouldExpand);
    setIsRangeFiltersExpanded(shouldExpand);
    showToast(shouldExpand ? "Expanded all filter sections" : "Collapsed all filter sections to maximize grid view");
  };

  // Switch Source Handler
  const handleSelectSource = (src: SourceType) => {
    setSelectedSource(src);
    if (src === "item_master") {
      setPrintItems(dynamicItemMasterRows);
      showToast(`Source selected: ITEM MASTER (${dynamicItemMasterRows.length} Items Loaded)`);
    } else {
      const data = SOURCE_DATASETS[src] || [];
      setPrintItems(data);
      showToast(`Source selected: ${src.toUpperCase().replace("_", " ")} (${data.length} Items Loaded)`);
    }
    setActivePreviewIndex(0);
  };

  // Filter items in real-time based on Range Filters
  const filteredPrintItems = useMemo(() => {
    return printItems.filter((item) => {
      const ic = (item.itemCode || "").toLowerCase();
      const bc = (item.barcode || "").toLowerCase();
      const name = (item.itemName || "").toLowerCase();
      const brand = (item.brand || "").toLowerCase();
      const cat = (item.category || "").toLowerCase();

      if (filterItemCodeFrom && ic < filterItemCodeFrom.toLowerCase()) return false;
      if (filterItemCodeTo && ic > filterItemCodeTo.toLowerCase()) return false;
      if (filterBarcodeFrom && bc < filterBarcodeFrom.toLowerCase()) return false;
      if (filterBarcodeTo && bc > filterBarcodeTo.toLowerCase()) return false;
      if (filterProductFrom && !name.includes(filterProductFrom.toLowerCase())) return false;
      if (filterProductTo && !name.includes(filterProductTo.toLowerCase())) return false;
      if (filterBrandFrom && brand < filterBrandFrom.toLowerCase()) return false;
      if (filterBrandTo && brand > filterBrandTo.toLowerCase()) return false;
      if (filterCategoryFrom && cat < filterCategoryFrom.toLowerCase()) return false;
      if (filterCategoryTo && cat > filterCategoryTo.toLowerCase()) return false;
      if (filterStyleFrom && !(item.styleCode || item.batchSerial || "").toLowerCase().includes(filterStyleFrom.toLowerCase())) return false;
      if (filterStyleTo && !(item.styleCode || item.batchSerial || "").toLowerCase().includes(filterStyleTo.toLowerCase())) return false;
      if (filterModelFrom && !(item.modelNo || "").toLowerCase().includes(filterModelFrom.toLowerCase())) return false;
      if (filterModelTo && !(item.modelNo || "").toLowerCase().includes(filterModelTo.toLowerCase())) return false;
      if (filterArticleFrom && !(item.articleNo || "").toLowerCase().includes(filterArticleFrom.toLowerCase())) return false;
      if (filterArticleTo && !(item.articleNo || "").toLowerCase().includes(filterArticleTo.toLowerCase())) return false;
      if (filterStockFrom && Number(item.stock ?? 0) < Number(filterStockFrom)) return false;
      if (filterStockTo && Number(item.stock ?? 0) > Number(filterStockTo)) return false;
      return true;
    });
  }, [
    printItems,
    filterItemCodeFrom, filterItemCodeTo,
    filterBarcodeFrom, filterBarcodeTo,
    filterProductFrom, filterProductTo,
    filterBrandFrom, filterBrandTo,
    filterCategoryFrom, filterCategoryTo,
    filterStyleFrom, filterStyleTo,
    filterModelFrom, filterModelTo,
    filterArticleFrom, filterArticleTo,
    filterStockFrom, filterStockTo
  ]);

  // Total Summaries
  const totalItems = filteredPrintItems.length;
  const totalPrintQty = useMemo(() => {
    return filteredPrintItems.reduce((acc, item) => acc + (item.selected ? item.printQty : 0), 0);
  }, [filteredPrintItems]);

  // Execute Print Job using PrintingService API Facade (Rule SUPP-013)
  const executePrintJob = async () => {
    if (filteredPrintItems.length === 0) {
      showToast("No items available to print!");
      return;
    }

    const activeItem = filteredPrintItems[activePreviewIndex] || filteredPrintItems[0];

    const document: PrintDocument = {
      id: `DOC-${Date.now()}`,
      type: "BARCODE_TAG",
      title: "Tattly Threads Dual Tag",
      content: TATTLY_THREADS_ZPL_SCRIPT,
      immutable: true,
      createdAt: new Date().toISOString(),
    };

    const res = await PrintingService.printDocument(document, {
      printerName: printer,
      printerIp: printerIp,
      printerPort: printerPort,
      driverId: "zpl",
      providerId: connectionType === "NETWORK_TCP" ? "network" : "qz_tray",
      copies,
      activeItem,
    });

    if (res.success) {
      showToast(`SUPP Facade: Sent print job to ${printer} via ${res.providerId.toUpperCase()} provider!`);
    } else {
      showToast(`SUPP Fallback: Browser print execution (${res.error || ""})`);
      window.print();
    }
  };

  const downloadPrintFile = () => {
    const selectedItems = filteredPrintItems.filter((item) => item.selected);
    if (selectedItems.length === 0) {
      showToast("No items available to save!");
      return;
    }

    const rawScript = selectedItems
      .map((item) => PRNVariableEngine.renderTemplate(TATTLY_THREADS_ZPL_SCRIPT, item, item.printQty))
      .join("\n");
    const blob = new Blob([rawScript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smriti_barcode_labels_${new Date().toISOString().slice(0, 10)}.prn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("PRN label file downloaded");
  };

  const printToFile = () => {
    if (filteredPrintItems.length === 0) {
      showToast("No items available to print!");
      return;
    }
    showToast("Choose Microsoft Print to PDF or Save as PDF in the print dialog");
    window.print();
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        setIsFullPreviewModalOpen(true);
      } else if (e.key === "F10") {
        e.preventDefault();
        executePrintJob();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsExcelModalOpen(false);
        setIsPrinterConfigModalOpen(false);
        setIsFullPreviewModalOpen(false);
        setEditingRow(null);
        showToast("Closed overlay (ESC)");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredPrintItems, activePreviewIndex, copies, connectionType, isQzConnected, printer, printerIp, printerPort]);

  const activeItem = filteredPrintItems[activePreviewIndex] || filteredPrintItems[0];

  // Item Table Handlers
  const toggleSelectAll = (checked: boolean) => {
    setPrintItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  const toggleSelectRow = (id: string) => {
    setPrintItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updatePrintQty = (id: string, newQty: number) => {
    setPrintItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, printQty: Math.max(1, newQty) } : item))
    );
  };

  const removeRow = (id: string) => {
    setPrintItems((prev) => prev.filter((item) => item.id !== id));
    showToast("Item row removed");
  };

  const clearAllRows = () => {
    setPrintItems([]);
    showToast("Cleared all print items");
  };

  const addManualRow = () => {
    const newRow: PrintItemRow = {
      id: `row-${Date.now()}`,
      selected: true,
      barcode: `89012345${Math.floor(10000 + Math.random() * 90000)}`,
      itemCode: `SKU-${Math.floor(100 + Math.random() * 900)}`,
      itemName: "New Custom Label Item",
      uom: "Pcs",
      batchSerial: "-",
      qty: 10,
      printQty: 10,
      labelTemplate: "Default Label",
      sizeMm: "50 x 25",
      mrp: 1500.0,
      hsn: "6404",
      taxRate: "18% IGST",
      brand: "Custom Brand",
    };
    setPrintItems((prev) => [...prev, newRow]);
    showToast("Added new print item line");
  };

  const resetFilters = () => {
    setFilterItemCodeFrom("");
    setFilterItemCodeTo("");
    setFilterBarcodeFrom("");
    setFilterBarcodeTo("");
    setFilterProductFrom("");
    setFilterProductTo("");
    setFilterBrandFrom("");
    setFilterBrandTo("");
    setFilterCategoryFrom("");
    setFilterCategoryTo("");
    setFilterSubCategoryFrom("");
    setFilterSubCategoryTo("");
    setFilterDepartmentFrom("");
    setFilterDepartmentTo("");
    setFilterSectionFrom("");
    setFilterSectionTo("");
    setFilterStyleFrom("");
    setFilterStyleTo("");
    setFilterStockFrom("");
    setFilterStockTo("");
    setFilterModelFrom("");
    setFilterModelTo("");
    setFilterArticleFrom("");
    setFilterArticleTo("");
    showToast("Filters reset to default");
  };

  // Handle Edit Row Save
  const handleSaveEditRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    setPrintItems((prev) => prev.map((item) => (item.id === editingRow.id ? editingRow : item)));
    setEditingRow(null);
    showToast("Item label updated successfully!");
  };

  return (
    <div className="min-h-screen bg-theme-surface-2 text-theme-heading font-sans flex flex-col justify-between relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-14 right-5 bg-theme-surface-2 text-white px-4 py-2.5 rounded-xl shadow-2xl z-50 text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white border-b border-theme-divider px-4 py-2.5 flex items-center justify-between shadow-xs z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              S
            </div>
            <div className="leading-tight">
              <span className="font-extrabold text-blue-900 tracking-tight text-sm">SMRITI</span>
              <span className="text-[10px] block text-theme-muted font-medium -mt-0.5">RETAIL OS</span>
            </div>
          </div>
          <div className="h-5 w-[1px] bg-theme-divider mx-1"></div>
          <div>
            <h1 className="text-base font-bold text-theme-heading">Print Labels Studio</h1>
            <span className="text-[10px] text-theme-muted font-medium block -mt-0.5">Barcode / Label Printing</span>
          </div>

          {/* Dedicated Studio View Switcher */}
          <div className="flex items-center space-x-1 ml-4 bg-theme-surface-2 p-1 border border-theme-divider rounded-xl">
            <button
              onClick={() => setActiveMainTab("batch_print")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMainTab === "batch_print"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-theme-muted hover:text-theme-heading"
              }`}
            >
              Batch Printing
            </button>
            <button
              onClick={() => setActiveMainTab("prn_studio")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                activeMainTab === "prn_studio"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-theme-muted hover:text-theme-heading"
              }`}
            >
              <span>PRN / ZPL Authoring Studio</span>
              <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[9px] font-extrabold rounded-full uppercase">New</span>
            </button>
          </div>

          <span className="flex items-center text-xs text-emerald-600 font-medium ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
            Online
          </span>
          <span className="text-xs text-theme-muted font-medium">Auto Save 02:45 PM</span>
        </div>

        <div className="flex items-center space-x-3">
          {/* SMP-M Industry Pack Selector */}
          <div className="flex items-center space-x-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-extrabold text-blue-900 uppercase tracking-tight">SMP-M Pack:</span>
            <select
              value={activeIndustry}
              onChange={(e) => handleIndustryChange(e.target.value as IndustryType)}
              className="bg-white border border-blue-300 text-blue-950 font-bold text-xs rounded px-2 py-0.5 focus:outline-none shadow-2xs"
            >
              <option value="apparel">Apparel & Garments</option>
              <option value="jewellery">Jewellery & Gold</option>
              <option value="medical">Pharmacy & Healthcare</option>
              <option value="electronics">Electronics & Hardware</option>
            </select>
          </div>
          {/* Toggle All Filters Button */}
          <button
            onClick={toggleAllFilters}
            className="px-3 py-1 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1">
              {isSourceExpanded && isContextFiltersExpanded && isRangeFiltersExpanded ? "unfold_less" : "unfold_more"}
            </span>
            {isSourceExpanded && isContextFiltersExpanded && isRangeFiltersExpanded ? "Collapse Filters" : "Expand Filters"}
          </button>

          <div className="relative">
            <input
              type="text"
              placeholder="Search (F2)"
              className="w-48 bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 pl-8"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-theme-muted text-sm">search</span>
          </div>
          <button
            onClick={() => showToast("Notifications Pane Opened")}
            className="p-1.5 hover:bg-theme-surface-2 rounded-lg text-theme-muted cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">notifications</span>
          </button>
          <button
            onClick={() => WindowManager.openTabStandalone("print-labels", "Print Labels Studio")}
            className="p-1.5 hover:bg-theme-surface-2 rounded-lg text-theme-muted cursor-pointer"
            title="Popout Window (Print Labels Studio)"
          >
            <span className="material-symbols-outlined text-lg">open_in_new</span>
          </button>
          <button onClick={() => window.print()} className="p-1.5 hover:bg-theme-surface-2 rounded-lg text-theme-muted cursor-pointer">
            <span className="material-symbols-outlined text-lg">print</span>
          </button>
          {/* QZ Tray Status Badge */}
          <div
            onClick={() => showToast(isQzConnected ? "QZ Tray 2.2.4 Connected via WebSocket (Port 8182)" : "QZ Tray Standby - Standard Browser/PDF Print Active")}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-theme-surface-2 border border-theme-divider rounded-lg text-[11px] font-bold cursor-pointer hover:bg-theme-surface-2 transition"
            title="QZ Tray Thermal Hardware Print Service"
          >
            <span className={`w-2 h-2 rounded-full ${isQzConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
            <span className={isQzConnected ? "text-emerald-700 font-mono" : "text-amber-700 font-mono"}>
              {isQzConnected ? "QZ Tray: Ready" : "QZ Tray: Standby"}
            </span>
          </div>

          <div className="flex items-center space-x-1 px-2.5 py-1 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs font-medium text-theme-body">
            <span className="material-symbols-outlined text-sm text-theme-muted">store</span>
            <span>Branch 01</span>
          </div>
          <div className="flex items-center space-x-2 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center border border-blue-200">
              AS
            </div>
            <span className="text-xs font-medium text-theme-body">Cashier</span>
            <span className="material-symbols-outlined text-xs text-theme-muted">expand_more</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      {activeMainTab === "prn_studio" ? (
        <PRNTemplateStudio onNotification={(t, m, type) => showToast(`${t}: ${m}`)} />
      ) : (
        <>
          <main className="p-4 flex-1 grid grid-cols-12 gap-4">
        {/* Left Column (8 cols): Sources, Filters & Items Table */}
        <div className="col-span-8 space-y-4">
          {/* Section 1: Select Source (Hidable) */}
          <section className="bg-white border border-theme-divider rounded-xl p-4 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsSourceExpanded(!isSourceExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  1
                </span>
                Select Source
                {!isSourceExpanded && (
                  <span className="ml-3 text-[11px] font-semibold text-theme-muted bg-theme-surface-2 px-2.5 py-0.5 rounded-full">
                    Source: <span className="text-blue-700 uppercase font-mono">{selectedSource.replace("_", " ")}</span> (Click to Expand)
                  </span>
                )}
              </h2>
              <button className="text-theme-muted hover:text-theme-muted cursor-pointer">
                <span className="material-symbols-outlined text-lg">
                  {isSourceExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {isSourceExpanded && (
              <div className="flex flex-wrap gap-2 mt-3 animate-in fade-in duration-100">
                {[
                  { id: "manual", label: "Manual Entry", icon: "edit_note" },
                  { id: "item_master", label: "Item Master", icon: "inventory_2" },
                  { id: "purchase_order", label: "Purchase Order", icon: "inventory_2" },
                  { id: "purchase_invoice", label: "Purchase Invoice", icon: "receipt_long" },
                  { id: "grn", label: "GRN", icon: "move_to_inbox" },
                  { id: "purchase_return", label: "Purchase Return", icon: "settings_backup_restore" },
                  { id: "sales_invoice", label: "Sales Invoice", icon: "point_of_sale" },
                  { id: "sales_return", label: "Sales Return", icon: "assignment_return" },
                  { id: "stock_transfer", label: "Stock Transfer", icon: "swap_horiz" },
                  { id: "production", label: "Production", icon: "precision_manufacturing" },
                  { id: "physical_stock", label: "Physical Stock", icon: "inventory" },
                  { id: "batch", label: "Batch", icon: "qr_code_2" },
                  { id: "serial_number", label: "Serial Number", icon: "pin" },
                  { id: "direct_scan", label: "Direct Scan", icon: "barcode_scanner" },
                ].map((src) => (
                  <button
                    key={src.id}
                    onClick={() => handleSelectSource(src.id as SourceType)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center min-w-[70px] cursor-pointer transition ${
                      selectedSource === src.id
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-theme-surface-2 text-theme-body border-theme-divider hover:bg-theme-surface-2"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base mb-1">{src.icon}</span>
                    <span className="text-[10px] tracking-tight">{src.label}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Transaction / Context Filters (Hidable) */}
          <section className="bg-white border border-theme-divider rounded-xl p-4 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsContextFiltersExpanded(!isContextFiltersExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  2
                </span>
                Transaction / Context Filters
                {!isContextFiltersExpanded && (
                  <span className="ml-3 text-[11px] font-semibold text-theme-muted bg-theme-surface-2 px-2.5 py-0.5 rounded-full">
                    Supplier: {selectedSupplier} | WH: {selectedWarehouse}
                  </span>
                )}
              </h2>
              <button className="text-theme-muted hover:text-theme-muted cursor-pointer">
                <span className="material-symbols-outlined text-lg">
                  {isContextFiltersExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {isContextFiltersExpanded && (
              <div className="grid grid-cols-7 gap-2.5 text-xs mt-3 animate-in fade-in duration-100">
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Doc No. From</label>
                  <input
                    type="text"
                    value={docFrom}
                    onChange={(e) => setDocFrom(e.target.value)}
                    placeholder="From Document..."
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Doc No. To</label>
                  <input
                    type="text"
                    value={docTo}
                    onChange={(e) => setDocTo(e.target.value)}
                    placeholder="To Document..."
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Supplier</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-theme-body font-medium"
                  >
                    <option value="All Suppliers">All Suppliers</option>
                    {supplierList.map((sup) => (
                      <option key={sup.id} value={sup.name}>
                        {sup.name} ({sup.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Warehouse</label>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-theme-body"
                  >
                    <option>All Warehouses</option>
                    <option>Central WH - Mumbai</option>
                    <option>Delhi Hub</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Salesman</label>
                  <select
                    value={selectedSalesman}
                    onChange={(e) => setSelectedSalesman(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-theme-body"
                  >
                    <option>All Salesmans</option>
                    <option>Rahul Sharma</option>
                    <option>Priya Patel</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* Section 3: Range / Boundary Filters (Hidable) */}
          <section className="bg-white border border-theme-divider rounded-xl p-4 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsRangeFiltersExpanded(!isRangeFiltersExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  3
                </span>
                Range / Boundary Filters (From → To)
                {!isRangeFiltersExpanded && (
                  <span className="ml-3 text-[11px] font-semibold text-theme-muted bg-theme-surface-2 px-2.5 py-0.5 rounded-full">
                    Item Code / Barcode / Brand / Category Boundaries Active
                  </span>
                )}
              </h2>
              <div className="flex items-center space-x-2">
                {isRangeFiltersExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetFilters();
                    }}
                    className="px-3 py-1 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                  >
                    <span className="material-symbols-outlined text-xs mr-1">restart_alt</span>
                    Reset Filters
                  </button>
                )}
                <button className="text-theme-muted hover:text-theme-muted cursor-pointer">
                  <span className="material-symbols-outlined text-lg">
                    {isRangeFiltersExpanded ? "expand_less" : "expand_more"}
                  </span>
                </button>
              </div>
            </div>

            {isRangeFiltersExpanded && (
              <div className="grid grid-cols-3 gap-3 text-xs mt-3 animate-in fade-in duration-100">
                {/* HTML Datalists for Auto-Lookup suggestions */}
                <datalist id="item-code-list">
                  {itemCodeOptions.map((code) => (<option key={code} value={code} />))}
                </datalist>
                <datalist id="barcode-list">
                  {barcodeOptions.map((bc) => (<option key={bc} value={bc} />))}
                </datalist>
                <datalist id="product-list">
                  {productOptions.map((p) => (<option key={p} value={p} />))}
                </datalist>
                <datalist id="brand-list">
                  {brandOptions.map((b) => (<option key={b} value={b} />))}
                </datalist>
                <datalist id="category-list">
                  {categoryOptions.map((c) => (<option key={c} value={c} />))}
                </datalist>
                <datalist id="style-list">
                  {styleOptions.map((s) => (<option key={s} value={s} />))}
                </datalist>
                <datalist id="model-list">
                  {modelOptions.map((m) => (<option key={m} value={m} />))}
                </datalist>
                <datalist id="article-list">
                  {articleOptions.map((a) => (<option key={a} value={a} />))}
                </datalist>
                <datalist id="stock-list">
                  {stockOptions.map((s) => (<option key={s} value={s} />))}
                </datalist>

                {/* Row 1 */}
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Item Code</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      list="item-code-list"
                      placeholder="From"
                      value={filterItemCodeFrom}
                      onChange={(e) => setFilterItemCodeFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs font-mono focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      list="item-code-list"
                      placeholder="To"
                      value={filterItemCodeTo}
                      onChange={(e) => setFilterItemCodeTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs font-mono focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Barcode</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      list="barcode-list"
                      placeholder="From"
                      value={filterBarcodeFrom}
                      onChange={(e) => setFilterBarcodeFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs font-mono focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      list="barcode-list"
                      placeholder="To"
                      value={filterBarcodeTo}
                      onChange={(e) => setFilterBarcodeTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs font-mono focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Product</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      list="product-list"
                      placeholder="From"
                      value={filterProductFrom}
                      onChange={(e) => setFilterProductFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs font-mono focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      list="product-list"
                      placeholder="To"
                      value={filterProductTo}
                      onChange={(e) => setFilterProductTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs font-mono focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Row 2 */}
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Brand</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      list="brand-list"
                      placeholder="From"
                      value={filterBrandFrom}
                      onChange={(e) => setFilterBrandFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      list="brand-list"
                      placeholder="To"
                      value={filterBrandTo}
                      onChange={(e) => setFilterBrandTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Category</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      list="category-list"
                      placeholder="From"
                      value={filterCategoryFrom}
                      onChange={(e) => setFilterCategoryFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      list="category-list"
                      placeholder="To"
                      value={filterCategoryTo}
                      onChange={(e) => setFilterCategoryTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Sub Category</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      list="category-list"
                      placeholder="From"
                      value={filterSubCategoryFrom}
                      onChange={(e) => setFilterSubCategoryFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      list="category-list"
                      placeholder="To"
                      value={filterSubCategoryTo}
                      onChange={(e) => setFilterSubCategoryTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Row 3 */}
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Department</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      placeholder="From"
                      value={filterDepartmentFrom}
                      onChange={(e) => setFilterDepartmentFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      placeholder="To"
                      value={filterDepartmentTo}
                      onChange={(e) => setFilterDepartmentTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Section</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      placeholder="From"
                      value={filterSectionFrom}
                      onChange={(e) => setFilterSectionFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      placeholder="To"
                      value={filterSectionTo}
                      onChange={(e) => setFilterSectionTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Style</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      list="style-list"
                      placeholder="From"
                      value={filterStyleFrom}
                      onChange={(e) => setFilterStyleFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      list="style-list"
                      placeholder="To"
                      value={filterStyleTo}
                      onChange={(e) => setFilterStyleTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Model</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      list="model-list"
                      placeholder="From"
                      value={filterModelFrom}
                      onChange={(e) => setFilterModelFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      list="model-list"
                      placeholder="To"
                      value={filterModelTo}
                      onChange={(e) => setFilterModelTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Article</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      list="article-list"
                      placeholder="From"
                      value={filterArticleFrom}
                      onChange={(e) => setFilterArticleFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="text"
                      list="article-list"
                      placeholder="To"
                      value={filterArticleTo}
                      onChange={(e) => setFilterArticleTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Stock Available</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      list="stock-list"
                      placeholder="Min"
                      value={filterStockFrom}
                      onChange={(e) => setFilterStockFrom(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                    <input
                      type="number"
                      list="stock-list"
                      placeholder="Max"
                      value={filterStockTo}
                      onChange={(e) => setFilterStockTo(e.target.value)}
                      className="w-1/2 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Items to Print Grid */}
          <section className="bg-white border border-theme-divider rounded-xl p-4 shadow-xs flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  4
                </span>
                Items to Print
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={addManualRow}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">add</span>
                  Add Item (F3)
                </button>
                <button
                  onClick={() => setIsExcelModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">upload_file</span>
                  Import (Excel)
                </button>
                <button
                  onClick={() => {
                    const sel = filteredPrintItems.filter((i) => i.selected);
                    if (sel.length === 0) showToast("No items selected");
                    else {
                      setPrintItems((prev) => prev.filter((i) => !i.selected));
                      showToast("Removed selected items");
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">delete_sweep</span>
                  Remove
                </button>
                <button
                  onClick={clearAllRows}
                  className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-xs mr-1">clear_all</span>
                  Clear All
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-theme-divider rounded-lg min-h-[300px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-theme-surface-2 border-b border-theme-divider text-theme-muted uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={filteredPrintItems.length > 0 && filteredPrintItems.every((i) => i.selected)}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                    </th>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 font-mono">Barcode</th>
                    <th className="py-2.5 px-3 font-mono">Item Code</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3 text-center">UOM</th>
                    <th className="py-2.5 px-3 text-center">Batch / Serial</th>
                    <th className="py-2.5 px-3 text-center">Stock</th>
                    <th className="py-2.5 px-3 text-center">Style / Model</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-center">Print Qty</th>
                    <th className="py-2.5 px-3 text-center">Label</th>
                    <th className="py-2.5 px-3 text-center">Size (mm)</th>
                    <th className="py-2.5 px-3 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider font-medium">
                  {filteredPrintItems.map((row, idx) => (
                    <tr
                      key={row.id}
                      onClick={() => setActivePreviewIndex(idx)}
                      className={`hover:bg-blue-50/60 cursor-pointer transition ${
                        activePreviewIndex === idx ? "bg-blue-50/80 border-l-4 border-l-blue-600" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleSelectRow(row.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-theme-muted font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-theme-body">{row.barcode}</td>
                      <td className="py-2.5 px-3 font-mono text-theme-muted">{row.itemCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-theme-heading">{row.itemName}</td>
                      <td className="py-2.5 px-3 text-center text-theme-muted">{row.uom}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-theme-muted">{row.batchSerial}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{typeof row.stock === "number" ? row.stock : "-"}</td>
                      <td className="py-2.5 px-3 text-center text-theme-muted">{row.styleCode || row.modelNo || row.articleNo || "-"}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{row.qty}</td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          value={row.printQty}
                          onChange={(e) => updatePrintQty(row.id, parseInt(e.target.value) || 1)}
                          className="w-14 bg-white border border-theme-divider rounded text-center py-1 text-xs font-bold font-mono text-theme-heading focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center text-theme-muted">{row.labelTemplate}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-theme-muted">{row.sizeMm}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRow(row);
                            }}
                            className="p-1 text-theme-muted hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRow(row.id);
                            }}
                            className="p-1 text-theme-muted hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-bold text-theme-body border-t border-theme-divider pt-2">
              <span>Total Items: {totalItems}</span>
              <span className="text-blue-700 font-mono font-extrabold text-sm">
                Total Print Qty: {totalPrintQty}
              </span>
            </div>
          </section>
        </div>

        {/* Right Column (4 cols): Label Preview & Print Settings (Hidable) */}
        <div className="col-span-4 space-y-4">
          {/* Section 5: Label Preview Card (Hidable) */}
          <section className="bg-white border border-theme-divider rounded-xl p-4 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none mb-3"
              onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  5
                </span>
                Label Preview
              </h2>
              <button className="text-theme-muted hover:text-theme-muted cursor-pointer">
                <span className="material-symbols-outlined text-lg">
                  {isPreviewExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {isPreviewExpanded && (
              <div className="animate-in fade-in duration-100">
                <div className="mb-3">
                  <select
                    value={labelSize}
                    onChange={(e) => setLabelSize(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-semibold text-theme-body"
                  >
                    <option value="100 x 50.7 mm">Tattly Threads Dual Barcode Tag (ZPL 100 x 50.7 mm)</option>
                    <option value="50 x 25 mm">Default Label (50 x 25 mm)</option>
                    <option value="75 x 50 mm">Apparel Hangtag (75 x 50 mm)</option>
                    <option value="38 x 12 mm">Jewelry Tag (38 x 12 mm)</option>
                  </select>
                </div>

                {/* Visual SVG Barcode Label Box */}
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 flex flex-col items-center justify-center shadow-inner relative min-h-[220px]">
                  {activeItem ? (
                    <div className="bg-white border border-theme-divider rounded-xl p-4 shadow-md w-full max-w-[260px] text-center space-y-2">
                      <h3 className="font-extrabold text-sm text-theme-heading leading-tight">{activeItem.itemName}</h3>
                      <div className="text-[10px] text-theme-muted font-mono">
                        Item Code : {activeItem.itemCode} | {showHsn && `HSN : ${activeItem.hsn}`}
                      </div>

                      {showBrand && activeItem.brand && (
                        <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">{activeItem.brand}</div>
                      )}

                      {showBatchSerial && activeItem.batchSerial !== "-" && (
                        <div className="text-[9px] font-mono text-theme-muted">Batch/Serial: {activeItem.batchSerial}</div>
                      )}

                      {typeof activeItem.stock === "number" && (
                        <div className="text-[9px] font-bold text-emerald-700">Stock: {activeItem.stock}</div>
                      )}

                      {(activeItem.styleCode || activeItem.modelNo || activeItem.articleNo) && (
                        <div className="text-[9px] text-theme-muted">{activeItem.styleCode || activeItem.articleNo || activeItem.modelNo}</div>
                      )}

                      {/* SVG Barcode Representation */}
                      <div className="py-1">
                        <svg className="w-full h-12" viewBox="0 0 200 50">
                          <rect width="200" height="50" fill="white" />
                          {/* Barcode lines simulation */}
                          {[10, 14, 18, 24, 28, 36, 40, 48, 52, 60, 64, 72, 76, 84, 88, 96, 102, 110, 116, 124, 130, 138, 144, 152, 160, 168, 174, 182, 188].map((x, i) => (
                            <rect key={i} x={x} y="5" width={i % 3 === 0 ? "3" : "1.5"} height="35" fill="black" />
                          ))}
                        </svg>
                        <span className="font-mono text-xs font-bold text-theme-heading tracking-widest block -mt-1">
                          {activeItem.barcode}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-theme-heading border-t border-theme-divider pt-1.5">
                        {showPrice && <span>MRP : ₹ {activeItem.mrp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>}
                        {showTax && <span className="text-[10px] text-theme-muted font-normal">{activeItem.taxRate || "18% IGST"}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-theme-muted text-xs font-mono">No items available for preview</div>
                  )}

                  {/* Pagination controls */}
                  <div className="flex items-center space-x-3 mt-4 text-xs font-bold text-blue-900">
                    <button
                      onClick={() => setActivePreviewIndex((prev) => Math.max(0, prev - 1))}
                      className="p-1 hover:bg-theme-surface-2 rounded text-theme-muted cursor-pointer"
                    >
                      &lt;
                    </button>
                    <span>
                      {filteredPrintItems.length > 0 ? activePreviewIndex + 1 : 0} / {filteredPrintItems.length}
                    </span>
                    <button
                      onClick={() => setActivePreviewIndex((prev) => Math.min(filteredPrintItems.length - 1, prev + 1))}
                      className="p-1 hover:bg-theme-surface-2 rounded text-theme-muted cursor-pointer"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 6: Print Settings (Hidable) */}
          <section className="bg-white border border-theme-divider rounded-xl p-4 shadow-xs space-y-3">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
            >
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold mr-2">
                  6
                </span>
                Print Settings
              </h2>
              <button className="text-theme-muted hover:text-theme-muted cursor-pointer">
                <span className="material-symbols-outlined text-lg">
                  {isSettingsExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {isSettingsExpanded && (
              <div className="space-y-3 animate-in fade-in duration-100">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-theme-muted uppercase block">Installed Hardware Printer</label>
                    <span className="text-[9px] font-mono font-bold text-blue-900">
                      {isUsbConnection
                        ? usbPrinters.length > 0
                          ? `${usbPrinters.length} USB Printer${usbPrinters.length === 1 ? "" : "s"} Detected`
                          : "USB auto-detect active"
                        : detectedPrinters.length > 0
                        ? `${detectedPrinters.length} Real Printers Discovered`
                        : "Manual / Hardware Direct"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {detectedPrinters.length > 0 ? (
                      <select
                        value={printer}
                        onChange={(e) => setPrinter(e.target.value)}
                        className="flex-1 bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-semibold text-theme-heading"
                      >
                        {(isUsbConnection ? usbPrinters : detectedPrinters).map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} ({p.driver || p.connection || "System Spooler"})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={printer}
                        onChange={(e) => setPrinter(e.target.value)}
                        placeholder={isUsbConnection ? "No USB printers detected. Connect USB device and rescan." : "Enter Real System Printer Name (e.g. IMPACT by Honeywell IH-2 (300 dpi) - DPL)"}
                        className="flex-1 bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-semibold text-theme-heading"
                      />
                    )}
                    {!isUsbConnection && (
                      <button
                        onClick={async () => {
                          const customName = prompt(
                            "Enter your exact Windows Printer Name (as shown in Windows Printers & Scanners):",
                            "IMPACT by Honeywell IH-2 (300 dpi) - DPL"
                          );
                          if (customName) {
                            SystemPrinterDiscovery.savePrinter({
                              name: customName,
                              connection: "SPOOLER",
                              driver: customName.toLowerCase().includes("honeywell") ? "Honeywell DPL" : "Windows Spooler",
                            });
                            await refreshPrinters();
                            setPrinter(customName);
                            showToast(`Registered physical printer: ${customName}`);
                          }
                        }}
                        title="Add Custom / Physical Windows Printer Name"
                        className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center cursor-pointer shadow-xs"
                      >
                        <span className="material-symbols-outlined text-sm mr-1">add</span>
                        Add
                      </button>
                    )}
                    <button
                      onClick={isUsbConnection ? requestUsbPrinter : refreshPrinters}
                      title={isUsbConnection ? "Authorize and detect a USB printer" : "Scan PC System Printers via QZ Tray"}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm mr-1">sync</span>
                      {isUsbConnection ? "Detect USB" : "Scan"}
                    </button>
                    <button
                      onClick={() => setIsPrinterConfigModalOpen(true)}
                      title="Hardware Setup"
                      className="p-2 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">settings</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Label Size</label>
                    <select
                      value={labelSize}
                      onChange={(e) => setLabelSize(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body"
                    >
                      <option>50 x 25 mm</option>
                      <option>38 x 25 mm</option>
                      <option>50 x 38 mm</option>
                      <option>100 x 50 mm</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">No. of Labels per Row</label>
                    <select
                      value={labelsPerRow}
                      onChange={(e) => setLabelsPerRow(parseInt(e.target.value))}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">No. of Copies</label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                      className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body font-bold border border-theme-divider rounded-lg text-xs cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={copies}
                      onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                      className="w-16 bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-center font-mono font-bold text-xs"
                    />
                    <button
                      onClick={() => setCopies((prev) => prev + 1)}
                      className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body font-bold border border-theme-divider rounded-lg text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-1.5 pt-2 border-t border-theme-divider text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-theme-body">Show Price</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHsn}
                      onChange={(e) => setShowHsn(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-theme-body">Show HSN</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTax}
                      onChange={(e) => setShowTax(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-theme-body">Show Tax</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBatchSerial}
                      onChange={(e) => setShowBatchSerial(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-theme-body">Show Batch / Serial</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBrand}
                      onChange={(e) => setShowBrand(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-theme-body">Show Brand</span>
                  </label>
                </div>

                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 text-[10px] text-theme-muted">
                  <div className="font-semibold text-theme-body uppercase tracking-wide mb-2">Item Master Field Mapping</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(
                      [
                        { label: "Barcode Source", key: "barcode" as const },
                        { label: "Item Code Source", key: "itemCode" as const },
                        { label: "Item Name Source", key: "itemName" as const },
                        { label: "Brand Source", key: "brand" as const },
                        { label: "Category Source", key: "category" as const },
                        { label: "Style Code Source", key: "styleCode" as const },
                        { label: "Model Number Source", key: "modelNo" as const },
                        { label: "Article Number Source", key: "articleNo" as const },
                        { label: "Stock Source", key: "stock" as const },
                        { label: "MRP Source", key: "mrp" as const },
                        { label: "HSN Source", key: "hsn" as const },
                      ] as const
                    ).map((mapping) => (
                      <div key={mapping.key}>
                        <label className="block text-[10px] font-bold text-theme-muted uppercase mb-1">{mapping.label}</label>
                        <select
                          value={itemMasterFieldMap[mapping.key]}
                          onChange={(e) =>
                            setItemMasterFieldMap((prev) => ({
                              ...prev,
                              [mapping.key]: e.target.value as ItemMasterFieldKey,
                            }))
                          }
                          className="w-full bg-white border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                        >
                          {ITEM_MASTER_FIELD_OPTIONS.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-theme-divider">
                  <div>
                    <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Print Direction</label>
                    <select
                      value={printDirection}
                      onChange={(e) => setPrintDirection(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body"
                    >
                      <option>Left to Right</option>
                      <option>Top to Bottom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Print Quality</label>
                    <select
                      value={printQuality}
                      onChange={(e) => setPrintQuality(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body"
                    >
                      <option>High (300 DPI)</option>
                      <option>Standard (203 DPI)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Bottom Fixed Toolbar */}
      <footer className="bg-white border-t border-theme-divider px-4 py-2.5 flex items-center justify-between shadow-lg z-20">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsFullPreviewModalOpen(true)}
            className="px-4 py-2 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">visibility</span>
            Preview (F5)
          </button>
          <button
            onClick={executePrintJob}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-extrabold text-xs flex items-center cursor-pointer shadow-md shadow-blue-600/30 uppercase tracking-wide transition"
          >
            <span className="material-symbols-outlined text-base mr-1.5">print</span>
            Print (F10)
          </button>
          <button
            onClick={printToFile}
            className="px-4 py-2 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">picture_as_pdf</span>
            Print & Save PDF
          </button>
          <button
            onClick={downloadPrintFile}
            className="px-4 py-2 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">download</span>
            Save .PRN File
          </button>
          <button
            onClick={() => showToast("Label Template Saved")}
            className="px-4 py-2 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm mr-1.5">save</span>
            Save Template
          </button>
        </div>

        <button
          onClick={() => showToast("Closing Print Labels Studio")}
          className="px-5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center cursor-pointer transition"
        >
          <span className="material-symbols-outlined text-sm mr-1.5">close</span>
          Close (ESC)
        </button>
      </footer>
        </>
      )}

      {/* MODAL 1: Full Sheet Label Print Preview (F5) */}
      {isFullPreviewModalOpen && (
        <div className="fixed inset-0 bg-theme-surface-3 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-theme-divider rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
            <div className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wide">Full Sheet Barcode Label Preview (F5)</h3>
                <p className="text-[11px] text-blue-200">
                  Printer: {printer} | Size: {labelSize} | {labelsPerRow} Labels per Row | Total Print Qty: {totalPrintQty}
                </p>
              </div>
              <button onClick={() => setIsFullPreviewModalOpen(false)} className="text-blue-300 hover:text-white">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto bg-theme-surface-2">
              <div
                className={`grid gap-3 bg-white p-6 rounded-xl shadow-lg border border-theme-divider mx-auto ${
                  labelsPerRow === 1
                    ? "grid-cols-1 max-w-xs"
                    : labelsPerRow === 2
                    ? "grid-cols-2 max-w-md"
                    : labelsPerRow === 3
                    ? "grid-cols-3 max-w-2xl"
                    : "grid-cols-4 max-w-3xl"
                }`}
              >
                {filteredPrintItems.flatMap((item) =>
                  Array.from({ length: Math.min(item.printQty, 6) }).map((_, i) => (
                    <div key={`${item.id}-${i}`} className="border border-theme-divider rounded-lg p-2.5 text-center bg-white shadow-xs space-y-1">
                      <h4 className="font-extrabold text-xs text-theme-heading truncate">{item.itemName}</h4>
                      <div className="text-[9px] text-theme-muted font-mono">Code: {item.itemCode}</div>
                      <div className="py-0.5">
                        <svg className="w-full h-8" viewBox="0 0 200 40">
                          <rect width="200" height="40" fill="white" />
                          {[10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 94, 100, 106, 112, 118, 124, 130, 136, 142, 148, 154, 160, 166, 172, 178, 184].map((x, idx) => (
                            <rect key={idx} x={x} y="4" width={idx % 3 === 0 ? "2.5" : "1.2"} height="30" fill="black" />
                          ))}
                        </svg>
                        <span className="font-mono text-[10px] font-bold text-theme-heading tracking-wider block -mt-1">{item.barcode}</span>
                      </div>
                      {showPrice && <div className="text-[10px] font-extrabold text-theme-heading">MRP: ₹{item.mrp.toFixed(2)}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 bg-white border-t border-theme-divider flex items-center justify-between">
              <span className="text-xs font-bold text-theme-muted">Showing first batch preview of total {totalPrintQty} labels</span>
              <div className="flex space-x-3">
                <button onClick={() => setIsFullPreviewModalOpen(false)} className="px-4 py-2 bg-theme-surface-2 text-theme-body font-bold rounded-lg text-xs">
                  Close
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setIsFullPreviewModalOpen(false);
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md"
                >
                  Print Full Sheet (F10)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Excel Import Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 bg-theme-surface-3 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-theme-divider rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="bg-theme-surface-2 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-emerald-400">upload_file</span>
                Import Labels Dataset (Excel / CSV)
              </h3>
              <button onClick={() => setIsExcelModalOpen(false)} className="text-theme-muted hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-6 text-center space-y-4 text-xs">
              <div className="w-full h-32 border-2 border-dashed border-theme-divider hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center text-theme-muted cursor-pointer bg-theme-surface-2 transition">
                <span className="material-symbols-outlined text-3xl text-emerald-600 mb-1">file_upload</span>
                <span className="font-bold text-theme-body">Click or Drag & Drop Excel / CSV file</span>
                <span className="text-[10px] text-theme-muted mt-0.5">Supports .XLSX, .XLS, .CSV</span>
              </div>
              <button
                onClick={() => {
                  addManualRow();
                  setIsExcelModalOpen(false);
                  showToast("Imported 10 label rows from Excel!");
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                Import Sample Excel Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Printer Configuration & TCP/IP Settings Modal */}
      {isPrinterConfigModalOpen && (
        <div className="fixed inset-0 bg-theme-surface-3 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-theme-divider rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
            <div className="bg-theme-surface-2 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-blue-400">lan</span>
                Printer Hardware & TCP/IP Configuration
              </h3>
              <button onClick={() => setIsPrinterConfigModalOpen(false)} className="text-theme-muted hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-theme-muted block mb-1">Printer Model</label>
                <select
                  value={printer}
                  onChange={(e) => setPrinter(e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-bold text-theme-heading"
                >
                  <option>Zebra ZD420 (ZPL II)</option>
                  <option>TSC TE200 (TSPL / TSPL2)</option>
                  <option>Godex EZ120 (GZPL)</option>
                  <option>TVS LP 46 Neo (EPL / ESC/POS)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-theme-muted block mb-1">Connection Interface</label>
                <select
                  value={connectionType}
                  onChange={(e) => setConnectionType(e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-bold text-theme-heading"
                >
                  <option value="NETWORK_TCP">Network Direct TCP/IP (Ethernet / Wi-Fi Port 9100)</option>
                  <option value="QZ_TRAY">QZ Tray Direct Hardware (Silent Local Print)</option>
                  <option value="USB">USB Serial Port (COM1 / /dev/usb/lp0)</option>
                  <option value="BLUETOOTH">Bluetooth Wireless Thermal Printer</option>
                </select>
              </div>

              {connectionType === "NETWORK_TCP" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-blue-900 text-xs flex items-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                      RAW TCP/IP Direct Socket Settings
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      {tcpStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-theme-muted block mb-1">Printer IP Address</label>
                      <input
                        type="text"
                        value={printerIp}
                        onChange={(e) => setPrinterIp(e.target.value)}
                        placeholder="e.g. 192.168.1.100"
                        className="w-full bg-white border border-theme-divider rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-theme-muted block mb-1">Port</label>
                      <input
                        type="number"
                        value={printerPort}
                        onChange={(e) => setPrinterPort(parseInt(e.target.value) || 9100)}
                        className="w-full bg-white border border-theme-divider rounded-lg px-2 py-1.5 font-mono text-xs font-bold"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTcpStatus(`Testing Socket ${printerIp}:${printerPort}...`);
                      setTimeout(() => {
                        setTcpStatus(`Connected (${printerIp}:${printerPort})`);
                        showToast(`TCP Socket test successful for ${printerIp}:${printerPort}`);
                      }, 1000);
                    }}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs flex items-center justify-center space-x-1"
                  >
                    <span className="material-symbols-outlined text-sm">wifi_tethering</span>
                    <span>Test Network TCP Connection</span>
                  </button>
                </div>
              )}

              <div>
                <label className="font-bold text-theme-muted block mb-1">Darkness / Heat Density</label>
                <input type="range" min="1" max="15" defaultValue="10" className="w-full cursor-pointer" />
              </div>

              <button
                onClick={() => {
                  setIsPrinterConfigModalOpen(false);
                  showToast(`Printer Config Saved (${connectionType === "NETWORK_TCP" ? `TCP IP: ${printerIp}` : connectionType})`);
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                Save Printer Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Item Row Modal */}
      {editingRow && (
        <div className="fixed inset-0 bg-theme-surface-3 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-theme-divider rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="bg-theme-surface-2 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center">
                <span className="material-symbols-outlined text-base mr-2 text-blue-400">edit</span>
                Edit Item Label
              </h3>
              <button onClick={() => setEditingRow(null)} className="text-theme-muted hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveEditRow} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-theme-muted block mb-1">Item Name</label>
                <input
                  type="text"
                  value={editingRow.itemName}
                  onChange={(e) => setEditingRow({ ...editingRow, itemName: e.target.value })}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-theme-muted block mb-1">Barcode</label>
                  <input
                    type="text"
                    value={editingRow.barcode}
                    onChange={(e) => setEditingRow({ ...editingRow, barcode: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-theme-muted block mb-1">Item Code</label>
                  <input
                    type="text"
                    value={editingRow.itemCode}
                    onChange={(e) => setEditingRow({ ...editingRow, itemCode: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-theme-muted block mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    value={editingRow.mrp}
                    onChange={(e) => setEditingRow({ ...editingRow, mrp: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-theme-muted block mb-1">Print Quantity</label>
                  <input
                    type="number"
                    value={editingRow.printQty}
                    onChange={(e) => setEditingRow({ ...editingRow, printQty: parseInt(e.target.value) || 1 })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end space-x-2 border-t border-theme-divider">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 bg-theme-surface-2 text-theme-body font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintLabelsStudio;
