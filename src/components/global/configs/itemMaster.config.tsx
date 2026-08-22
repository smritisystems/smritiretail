/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { Package, Tag, Layers, Barcode, DollarSign, Image } from "lucide-react";
import { MasterConfig } from "../master/types.ts";
import { Product } from "../../../types.ts";

export const itemMasterConfig: MasterConfig<Product> = {
  entityName: "Product SKU",
  entityNamePlural: "Products",
  title: "Item & Product Master Catalog",
  subtitle: "Manage retail product catalogue, HSN codes, GST tax slabs, barcodes, and inventory pricing",
  icon: <Package size={20} />,
  apiEndpoint: "/api/v1/products/",
  idKey: "id",
  serverPagination: true,
  pageSize: 25,
  searchPlaceholder: "Search by product name, SKU code, barcode, or category...",
  searchFields: ["name", "code", "barcode", "category", "brand", "styleCode", "sku"],

  responseTransform: (data: any) => {
    const rawList = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    return rawList.map((p: any) => {
      const secBarcodes = Array.isArray(p.secondary_barcodes) ? p.secondary_barcodes : [];
      return {
        ...p,
        id: p.id,
        code: p.code,
        name: p.name,
        price: parseFloat(p.price || 0),
        mrp: p.mrp ? parseFloat(p.mrp) : parseFloat(p.price || 0),
        costPrice: p.cost_price ? parseFloat(p.cost_price) : 0,
        stock: Number(p.stock || 0),
        category: p.category || "",
        brand: p.brand || "",
        color: p.color || "",
        size: p.size || "",
        styleCode: p.style_code || "",
        barcode: p.barcode || "",
        secondaryBarcodes: secBarcodes,
        hsnCode: p.hsn_code || p.hsnCode || "",
        hsn_code: p.hsn_code || p.hsnCode || "",
        gstRate: p.gst_percentage != null ? parseFloat(p.gst_percentage) : (p.gstRate != null ? parseFloat(p.gstRate) : 0),
        status: p.is_active !== false ? "Active" : "Inactive",
        isFavorite: Boolean(p.is_favorite)
      };
    });
  },

  payloadTransform: (formData, mode, editingItem) => {
    const payload: any = { ...formData };
    if (mode === "create" && !payload.id) {
      payload.id = `prod-${Date.now().toString(36)}`;
    }
    payload.price = Number(payload.price || 0);
    payload.mrp = Number(payload.mrp || payload.price || 0);
    payload.costPrice = Number(payload.costPrice || 0);
    payload.cost_price = Number(payload.costPrice || 0);
    payload.stock = Number(payload.stock != null ? payload.stock : 100);
    payload.gstRate = Number(payload.gstRate != null ? payload.gstRate : 5);
    payload.gst_percentage = Number(payload.gstRate != null ? payload.gstRate : 5);
    payload.hsn_code = payload.hsnCode || payload.hsn_code || "";
    return payload;
  },

  columns: [
    {
      key: "name",
      label: "Product / SKU Details",
      width: "240px",
      sortable: true,
      render: (val, item) => {
        const hsn = (item as any).hsnCode || (item as any).hsn_code;
        return (
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-theme-surface-3 border border-theme-divider flex items-center justify-center font-bold text-xs text-blue-400 shrink-0">
              {(item as any).imageUrl || (item as any).image ? (
                <img src={(item as any).imageUrl || (item as any).image} alt={val} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <Package size={14} />
              )}
            </div>
            <div>
              <div className="font-bold text-theme-primary">{val || "Unnamed Item"}</div>
              <div className="text-[10px] text-theme-muted font-mono flex items-center space-x-1">
                <span>{item.code || item.sku || "NO-SKU"}</span>
                {item.barcode && <span>• {item.barcode}</span>}
                {hsn && <span className="text-emerald-400 font-semibold">• HSN: {hsn}</span>}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      key: "category",
      label: "Category",
      width: "120px",
      render: (val) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-theme-surface-2 border border-theme-divider text-theme-primary">
          {val || "General"}
        </span>
      )
    },
    {
      key: "hsnCode",
      label: "HSN Code",
      width: "100px",
      align: "center",
      render: (val, item) => (
        <span className="font-mono text-[11px] text-theme-muted font-bold px-1.5 py-0.5 rounded bg-theme-surface-2 border border-theme-divider">
          {val || (item as any).hsn_code || (item as any).hsnCode || "-"}
        </span>
      )
    },
    {
      key: "costPrice",
      label: "Cost Price",
      width: "115px",
      align: "right",
      sortable: true,
      render: (val, item) => (
        <span className="font-mono text-amber-400 font-semibold text-[11px]">
          ₹ {Number(val || (item as any).cost_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: "price",
      label: "Sale Price",
      width: "120px",
      align: "right",
      sortable: true,
      render: (val) => (
        <span className="font-mono font-bold text-theme-primary">
          ₹ {Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: "mrp",
      label: "MRP",
      width: "110px",
      align: "right",
      sortable: true,
      render: (val) => (
        <span className="font-mono text-theme-muted text-[11px]">
          ₹ {Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: "stock",
      label: "Stock (Qty)",
      width: "110px",
      align: "right",
      sortable: true,
      render: (val) => {
        const qty = Number(val || 0);
        return (
          <span className={`font-mono font-bold text-xs ${qty <= 5 ? "text-rose-400" : qty <= 20 ? "text-amber-400" : "text-emerald-400"}`}>
            {qty.toLocaleString("en-IN")}
          </span>
        );
      }
    },
    {
      key: "gstRate",
      label: "GST %",
      width: "80px",
      align: "center",
      render: (val, item) => {
        const rate = val != null ? val : (item as any).gst_percentage;
        return (
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {Number(rate != null ? rate : 5)}%
          </span>
        );
      }
    },
    {
      key: "status",
      label: "Status",
      width: "90px",
      renderStatus: true
    }
  ],

  fields: [
    {
      name: "name",
      label: "Product Name",
      type: "text",
      required: true,
      placeholder: "e.g. Slim Fit Cotton Formal Shirt",
      colSpan: 1
    },
    {
      name: "code",
      label: "SKU / Item Code",
      type: "text",
      required: true,
      disabled: (_form, isEdit) => Boolean(isEdit),
      placeholder: "e.g. SHIRT-COTTON-001",
      description: "Permanent SKU identifier (locked when modifying existing items)",
      colSpan: 1
    },
    {
      name: "barcode",
      label: "Barcode / EAN-13",
      type: "text",
      disabled: (_form, isEdit) => Boolean(isEdit),
      placeholder: "Scan or enter barcode number",
      description: "Permanent barcode identifier (locked when modifying existing items)",
      colSpan: 1
    },
    {
      name: "category",
      label: "Product Category",
      type: "select",
      options: [
        { label: "Footwear", value: "Footwear" },
        { label: "Apparel", value: "Apparel" },
        { label: "Accessories", value: "Accessories" },
        { label: "Electronics", value: "Electronics" },
        { label: "Grocery", value: "Grocery" },
        { label: "FMCG", value: "FMCG" }
      ],
      defaultValue: "Footwear",
      colSpan: 1
    },
    {
      name: "price",
      label: "Selling Price",
      type: "number",
      required: true,
      placeholder: "0.00",
      colSpan: 1
    },
    {
      name: "mrp",
      label: "Maximum Retail Price (MRP)",
      type: "number",
      placeholder: "0.00",
      colSpan: 1
    },
    {
      name: "costPrice",
      label: "Purchase / Cost Price",
      type: "number",
      placeholder: "0.00",
      colSpan: 1
    },
    {
      name: "stock",
      label: "Initial Stock Quantity",
      type: "number",
      placeholder: "100",
      defaultValue: 100,
      colSpan: 1
    },
    {
      name: "gstRate",
      label: "GST Tax Rate (%)",
      type: "select",
      options: [
        { label: "0% (Exempt)", value: 0 },
        { label: "5% (Standard Essential)", value: 5 },
        { label: "12% (Standard Low)", value: 12 },
        { label: "18% (Standard High)", value: 18 },
        { label: "28% (Luxury / Cess)", value: 28 }
      ],
      defaultValue: 5,
      colSpan: 1
    },
    {
      name: "hsnCode",
      label: "HSN Code",
      type: "text",
      placeholder: "e.g. 6205",
      maxLength: 8,
      colSpan: 1
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" },
        { label: "Discontinued", value: "Discontinued" }
      ],
      defaultValue: "Active",
      colSpan: 1
    }
  ],

  filters: [
    {
      id: "category_filter",
      label: "Category",
      field: "category",
      type: "select",
      options: [
        { label: "Apparel", value: "Apparel" },
        { label: "Footwear", value: "Footwear" },
        { label: "Accessories", value: "Accessories" },
        { label: "Electronics", value: "Electronics" },
        { label: "Grocery", value: "Grocery" }
      ]
    },
    {
      id: "status_filter",
      label: "Status",
      field: "status",
      type: "select",
      options: [
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" }
      ]
    }
  ],

  kpis: [
    {
      id: "total_skus",
      label: "Total SKUs",
      compute: (items) => items.length,
      color: "blue"
    },
    {
      id: "total_stock",
      label: "Total Inventory Units",
      compute: (items) => {
        const sum = items.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
        return sum.toLocaleString("en-IN");
      },
      color: "emerald"
    },
    {
      id: "low_stock",
      label: "Low Stock Alerts",
      compute: (items) => items.filter((p) => (Number(p.stock) || 0) <= 5).length,
      color: "rose"
    }
  ]
};
