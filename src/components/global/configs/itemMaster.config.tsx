/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
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

  payloadTransform: (formData, mode, editingItem) => {
    const payload: any = { ...formData };
    if (mode === "create" && !payload.id) {
      payload.id = `prod-${Date.now().toString(36)}`;
    }
    payload.price = Number(payload.price || 0);
    payload.mrp = Number(payload.mrp || payload.price || 0);
    payload.costPrice = Number(payload.costPrice || 0);
    payload.stock = Number(payload.stock || 0);
    payload.gstRate = Number(payload.gstRate || 18);
    return payload;
  },

  columns: [
    {
      key: "name",
      label: "Product / SKU Details",
      width: "240px",
      sortable: true,
      render: (val, item) => (
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
            </div>
          </div>
        </div>
      )
    },
    {
      key: "category",
      label: "Category",
      width: "130px",
      render: (val) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-theme-surface-2 border border-theme-divider text-theme-primary">
          {val || "General"}
        </span>
      )
    },
    {
      key: "price",
      label: "Sale Price (₹)",
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
      label: "MRP (₹)",
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
      render: (val) => (
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {Number(val || 18)}%
        </span>
      )
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
      placeholder: "e.g. SHIRT-COTTON-001",
      colSpan: 1
    },
    {
      name: "barcode",
      label: "Barcode / EAN-13",
      type: "text",
      placeholder: "Scan or enter barcode number",
      colSpan: 1
    },
    {
      name: "category",
      label: "Product Category",
      type: "select",
      options: [
        { label: "Apparel", value: "Apparel" },
        { label: "Footwear", value: "Footwear" },
        { label: "Accessories", value: "Accessories" },
        { label: "Electronics", value: "Electronics" },
        { label: "Grocery", value: "Grocery" },
        { label: "FMCG", value: "FMCG" }
      ],
      defaultValue: "Apparel",
      colSpan: 1
    },
    {
      name: "price",
      label: "Selling Price (₹)",
      type: "number",
      required: true,
      placeholder: "0.00",
      colSpan: 1
    },
    {
      name: "mrp",
      label: "Maximum Retail Price (MRP ₹)",
      type: "number",
      placeholder: "0.00",
      colSpan: 1
    },
    {
      name: "costPrice",
      label: "Purchase / Cost Price (₹)",
      type: "number",
      placeholder: "0.00",
      colSpan: 1
    },
    {
      name: "stock",
      label: "Initial Stock Quantity",
      type: "number",
      placeholder: "0",
      defaultValue: 0,
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
      defaultValue: 18,
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
