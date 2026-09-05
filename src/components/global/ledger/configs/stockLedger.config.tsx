/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.48.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { LedgerConfig } from "../types.ts";
import { formatCurrency } from "../../../../utils/formatters.ts";
import { ArrowDownLeft, ArrowUpRight, Layers } from "lucide-react";

export const stockLedgerConfig: LedgerConfig<any> = {
  entityName: "Stock Movement",
  title: "Stock Movement Ledger",
  subtitle: "Audited stock movements with In, Out, Opening, Closing balances, commercial invoice tracking, and valuation",
  icon: <Layers size={20} />,
  apiEndpoint: "/inventory/ledger",
  idKey: "id",
  exportFileName: "SMRITI_Stock_Movement_Ledger",
  searchPlaceholder: "Search by Barcode, SKU, Style, Product, Brand, Ref Invoice No, Color, Size...",
  searchFields: [
    "barcode",
    "sku",
    "style_code",
    "product_name",
    "brand",
    "color",
    "size",
    "reference_doc_no",
    "reference_doc_id",
    "movement_type",
    "warehouse",
    "remarks",
    "created_at",
    "date",
  ],

  filters: [
    {
      key: "movement_type",
      label: "Transaction Type",
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

    // Chronological running stock balance calculation per SKU
    const skuRunningMap: Record<string, number> = {};
    const chronological = [...list].sort((a: any, b: any) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tA - tB;
    });

    const enrichedMap = new Map<
      string,
      {
        opening_qty: number;
        in_qty: number;
        out_qty: number;
        closing_qty: number;
        in_val: number;
        out_val: number;
        closing_val: number;
      }
    >();

    chronological.forEach((item: any) => {
      const skuKey = item.sku || item.product_id || "GLOBAL";
      const curBal = skuRunningMap[skuKey] || 0;
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.cost_price || item.unit_cost) || 0;

      const mType = (item.movement_type || "").toUpperCase();
      const isOutType =
        mType === "OUTWARD_SALE" ||
        mType === "SALE" ||
        mType === "ADJUSTMENT_OUT" ||
        mType === "TRANSFER_OUT" ||
        mType === "DAMAGE" ||
        mType === "WRITE_OFF" ||
        mType === "OUT";

      const isInType =
        mType === "IN" ||
        mType === "RETURN" ||
        mType === "RETURN_INWARD" ||
        mType === "INWARD_GRN" ||
        mType === "ADJUSTMENT_IN" ||
        mType === "TRANSFER_IN" ||
        mType === "PURCHASE";

      const isIn = isOutType
        ? false
        : isInType
        ? true
        : item.in_qty !== undefined && item.in_qty !== null && parseFloat(item.in_qty) > 0
        ? true
        : item.out_qty !== undefined && item.out_qty !== null && parseFloat(item.out_qty) > 0
        ? false
        : qty > 0;

      const inQ = isIn ? Math.abs(qty) : 0;
      const outQ = !isIn ? Math.abs(qty) : 0;

      const opening = curBal;
      const closing = opening + inQ - outQ;
      skuRunningMap[skuKey] = closing;

      enrichedMap.set(item.id, {
        opening_qty: opening,
        in_qty: inQ,
        out_qty: outQ,
        closing_qty: closing,
        in_val: inQ * cost,
        out_val: outQ * cost,
        closing_val: closing * cost,
      });
    });

    return list.map((item: any) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.cost_price || item.unit_cost) || 0;
      const mrp = parseFloat(item.mrp) || 0;
      const selling = parseFloat(item.selling_price || item.price) || 0;
      const buying = parseFloat(item.buying_price) || 0;
      const totVal =
        item.total_value !== undefined && item.total_value !== null
          ? parseFloat(item.total_value)
          : Math.abs(qty) * cost;

      const enriched = enrichedMap.get(item.id) || {
        opening_qty: 0,
        in_qty: qty > 0 ? qty : 0,
        out_qty: qty < 0 ? Math.abs(qty) : 0,
        closing_qty: 0,
        in_val: 0,
        out_val: 0,
        closing_val: 0,
      };

      return {
        id: item.id,
        barcode: item.barcode || "—",
        sku: item.sku || item.product_code || "—",
        style_code: item.style_code || "—",
        product_name: item.product_name || "—",
        brand: item.brand || "—",
        color: item.color || "—",
        size: item.size || "—",
        movement_type: item.movement_type || "—",
        quantity: qty,
        opening_qty: item.opening_qty !== undefined && item.opening_qty !== null
          ? parseFloat(item.opening_qty)
          : enriched.opening_qty,
        in_qty: item.in_qty !== undefined && item.in_qty !== null
          ? parseFloat(item.in_qty)
          : enriched.in_qty,
        out_qty: item.out_qty !== undefined && item.out_qty !== null
          ? parseFloat(item.out_qty)
          : enriched.out_qty,
        closing_qty: item.closing_qty !== undefined && item.closing_qty !== null
          ? parseFloat(item.closing_qty)
          : enriched.closing_qty,
        mrp: mrp,
        selling_price: selling,
        buying_price: buying,
        cost_price: cost,
        total_value: totVal,
        in_value: item.in_value !== undefined && item.in_value !== null
          ? parseFloat(item.in_value)
          : enriched.in_val,
        out_value: item.out_value !== undefined && item.out_value !== null
          ? parseFloat(item.out_value)
          : enriched.out_val,
        closing_value: item.closing_value !== undefined && item.closing_value !== null
          ? parseFloat(item.closing_value)
          : enriched.closing_val,
        reference_doc_type: item.reference_doc_type || "—",
        reference_doc_id: item.reference_doc_id || "—",
        reference_doc_no: item.reference_doc_no || item.reference_doc_id || "—",
        warehouse: item.warehouse || "—",
        created_at: item.created_at,
        date: item.created_at ? item.created_at.split("T")[0] : "—",
      };
    });
  },

  columns: [
    {
      key: "created_at",
      label: "Date",
      width: "105px",
      render: (val) => (
        <span className="font-mono text-[11px] text-theme-muted">
          {val ? String(val).split("T")[0] : "—"}
        </span>
      ),
    },
    {
      key: "barcode",
      label: "Barcode",
      width: "130px",
      render: (val) => (
        <span className="font-mono text-[11px] font-semibold text-amber-400">
          {val}
        </span>
      ),
    },
    {
      key: "sku",
      label: "SKU",
      width: "140px",
      render: (val) => <span className="font-bold text-blue-400 font-mono">{val}</span>,
    },
    {
      key: "style_code",
      label: "Style",
      width: "110px",
      render: (val) => <span className="font-mono text-[11px] text-indigo-300">{val}</span>,
    },
    {
      key: "product_name",
      label: "Product",
      render: (val) => <span className="text-theme-primary font-sans font-medium">{val}</span>,
    },
    {
      key: "brand",
      label: "Brand",
      width: "120px",
      render: (val) => <span className="text-theme-muted font-sans text-xs">{val}</span>,
    },
    {
      key: "color",
      label: "Color",
      width: "90px",
      align: "center",
      render: (val) => (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-theme-surface-2 border border-theme-divider text-theme-body uppercase">
          {val}
        </span>
      ),
    },
    {
      key: "size",
      label: "Size",
      width: "60px",
      align: "center",
      render: (val) => (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-theme-surface-3 text-cyan-400 border border-cyan-900/40">
          {val}
        </span>
      ),
    },
    {
      key: "movement_type",
      label: "Movement",
      width: "130px",
      align: "center",
      render: (val) => {
        const isPositive =
          val === "IN" ||
          val === "RETURN" ||
          val === "RETURN_INWARD" ||
          val === "INWARD_GRN" ||
          val === "ADJUSTMENT_IN" ||
          val === "TRANSFER_IN";
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
      key: "opening_qty",
      label: "Opening",
      width: "85px",
      align: "right",
      render: (val) => (
        <span className="font-mono text-theme-muted text-[11px]">
          {val !== undefined && val !== null ? val : "0"}
        </span>
      ),
    },
    {
      key: "in_qty",
      label: "In (+)",
      width: "80px",
      align: "right",
      render: (val) => (
        <span className="font-mono font-bold text-emerald-400 text-[11px]">
          {val > 0 ? `+${val}` : "—"}
        </span>
      ),
    },
    {
      key: "out_qty",
      label: "Out (-)",
      width: "80px",
      align: "right",
      render: (val) => (
        <span className="font-mono font-bold text-rose-400 text-[11px]">
          {val > 0 ? `-${val}` : "—"}
        </span>
      ),
    },
    {
      key: "closing_qty",
      label: "Closing",
      width: "85px",
      align: "right",
      render: (val) => (
        <span className="font-mono font-bold text-cyan-400 text-xs">
          {val !== undefined && val !== null ? val : "0"}
        </span>
      ),
    },
    {
      key: "mrp",
      label: "MRP",
      width: "95px",
      align: "right",
      render: (val) => (
        <span className="font-mono text-theme-muted text-[11px]">
          {val > 0 ? formatCurrency(val) : "—"}
        </span>
      ),
    },
    {
      key: "selling_price",
      label: "Selling Price",
      width: "105px",
      align: "right",
      render: (val) => (
        <span className="font-mono text-sky-400 text-[11px] font-medium">
          {val > 0 ? formatCurrency(val) : "—"}
        </span>
      ),
    },
    {
      key: "buying_price",
      label: "Buying Price",
      width: "105px",
      align: "right",
      render: (val) => (
        <span className="font-mono text-theme-muted text-[11px]">
          {val > 0 ? formatCurrency(val) : "—"}
        </span>
      ),
    },
    {
      key: "cost_price",
      label: "Unit Cost",
      width: "100px",
      align: "right",
      render: (val) => (
        <span className="font-mono text-theme-primary text-[11px] font-medium">
          {val > 0 ? formatCurrency(val) : "—"}
        </span>
      ),
    },
    {
      key: "total_value",
      label: "Movement Value",
      width: "125px",
      align: "right",
      render: (val) => (
        <span className="font-mono text-emerald-400 text-xs font-bold">
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: "closing_value",
      label: "Closing Value",
      width: "120px",
      align: "right",
      render: (val) => (
        <span className="font-mono text-cyan-300 text-xs font-semibold">
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: "reference_doc_no",
      label: "Ref Document",
      width: "150px",
      render: (val, row) => (
        <div className="font-mono text-[11px]">
          <span className="text-amber-400 font-semibold">{val}</span>
          <div className="text-[10px] text-theme-muted">{row.reference_doc_type}</div>
        </div>
      ),
    },
    {
      key: "warehouse",
      label: "Warehouse / Location",
      width: "150px",
      render: (val) => <span className="text-theme-muted text-[11px] font-mono">{val}</span>,
    },
  ],
};

