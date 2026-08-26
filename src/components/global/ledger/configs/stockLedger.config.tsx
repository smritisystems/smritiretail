/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { Package, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { LedgerConfig } from "../types.ts";
import { formatDateTime } from "../../../../utils/formatters.ts";

export const stockLedgerConfig: LedgerConfig<any> = {
  entityName: "Stock Movement",
  title: "Stock Movement Ledger",
  subtitle: "Immutable audit trail of all inward, outward, sales, and adjustment inventory movements",
  icon: <Package size={20} />,
  apiEndpoint: "/inventory/ledger",
  idKey: "id",
  searchPlaceholder: "Search by SKU, Product Name, or Ref Document...",
  searchFields: ["sku", "product_name", "reference_doc_id", "movement_type", "warehouse"],
  exportFileName: "stock_movement_ledger",

  filters: [
    {
      key: "movement_type",
      label: "Type",
      defaultValue: "ALL",
      options: [
        { label: "All Movements", value: "ALL" },
        { label: "Sales Outward (OUTWARD_SALE)", value: "OUTWARD_SALE" },
        { label: "Return Inward (RETURN_INWARD)", value: "RETURN_INWARD" },
        { label: "Purchase Inward (INWARD_GRN)", value: "INWARD_GRN" },
        { label: "Adjustment In (ADJUSTMENT_IN)", value: "ADJUSTMENT_IN" },
        { label: "Adjustment Out (ADJUSTMENT_OUT)", value: "ADJUSTMENT_OUT" },
        { label: "Transfer In (TRANSFER_IN)", value: "TRANSFER_IN" },
        { label: "Transfer Out (TRANSFER_OUT)", value: "TRANSFER_OUT" },
      ],
    },
  ],

  responseTransform: (data: any) => {
    const list = Array.isArray(data) ? data : data?.items || [];
    return list.map((item: any) => ({
      id: item.id,
      timestamp: item.created_at || item.timestamp,
      sku: item.sku || item.product_code || "—",
      product_name: item.product_name || "—",
      movement_type: item.movement_type || "OUTWARD_SALE",
      quantity: parseFloat(item.quantity) || 0,
      reference_doc_type: item.reference_doc_type || "Sales Invoice",
      reference_doc_id: item.reference_doc_id || "—",
      warehouse: item.warehouse || "Main Outlet Retail WH",
    }));
  },

  columns: [
    {
      key: "timestamp",
      label: "Timestamp",
      width: "160px",
      render: (val) => (
        <span className="text-theme-muted font-mono text-[11px]">
          {val ? formatDateTime(val) : "—"}
        </span>
      ),
    },
    {
      key: "sku",
      label: "SKU / Code",
      width: "130px",
      render: (val) => <span className="font-bold text-blue-400 font-mono">{val}</span>,
    },
    {
      key: "product_name",
      label: "Product Name",
      render: (val) => <span className="text-theme-primary font-sans">{val}</span>,
    },
    {
      key: "movement_type",
      label: "Movement",
      width: "140px",
      align: "center",
      render: (val) => {
        const isPositive = val === "IN" || val === "RETURN" || val === "RETURN_INWARD" || val === "INWARD_GRN" || val === "ADJUSTMENT_IN" || val === "TRANSFER_IN";
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono inline-flex items-center gap-1 border ${
              isPositive
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}
          >
            {isPositive ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
            <span>{val}</span>
          </span>
        );
      },
    },
    {
      key: "quantity",
      label: "Quantity",
      width: "100px",
      align: "right",
      render: (val, row) => {
        const isPositive = row.movement_type === "IN" || row.movement_type === "RETURN" || row.movement_type === "RETURN_INWARD" || row.movement_type === "INWARD_GRN" || row.movement_type === "ADJUSTMENT_IN" || row.movement_type === "TRANSFER_IN";
        return (
          <span className={`font-mono font-bold ${isPositive ? "text-emerald-400" : "text-theme-primary"}`}>
            {isPositive ? `+${val}` : `-${val}`}
          </span>
        );
      },
    },
    {
      key: "reference_doc_id",
      label: "Ref Document",
      width: "150px",
      render: (val, row) => (
        <div className="font-mono text-[11px]">
          <span className="text-theme-primary">{val}</span>
          <div className="text-[10px] text-theme-muted">{row.reference_doc_type}</div>
        </div>
      ),
    },
    {
      key: "warehouse",
      label: "Warehouse / Location",
      width: "160px",
      render: (val) => <span className="text-theme-muted text-[11px] font-mono">{val}</span>,
    },
  ],
};
