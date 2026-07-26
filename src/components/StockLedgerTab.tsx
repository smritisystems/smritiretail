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
 *   * Founder, Chief Executive Officer (CEO) & Chief Systems Architect
 *   * Email: support@smritibooks.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 5.1.0  (SEEF Phase 8 - Theme token cascade)
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-26
 * * Copyright  : © SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 *
 * WNG-002: List Report Pattern — Transaction Domain (Inventory Stock Ledger)
 */

import React, { useState, useEffect } from "react";
import { StockLedgerEntry } from "../types.js";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { FioriListReport, ListReportColumn } from "./common/FioriListReport.tsx";

interface StockLedgerTabProps {
  currentUser?: { role: string; name: string } | null;
}

type LedgerRow = StockLedgerEntry & { id: string };

// Movement type badge renderer
const MovementBadge: React.FC<{ type: string }> = ({ type }) => {
  const cls =
    type === "IN"
      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
      : type === "OUT"
      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
      : "bg-blue-500/10 text-blue-400 border border-blue-500/30";
  return (
    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md ${cls}`}>
      {type}
    </span>
  );
};

const COLUMNS: ListReportColumn<LedgerRow>[] = [
  {
    key: "timestamp",
    label: "Timestamp",
    render: (row) => (
      <div>
        <div className="text-theme-body text-xs">{new Date(row.timestamp).toLocaleString()}</div>
        <div className="text-[10px] text-theme-muted mt-0.5">
          {row.user || "System"} · {row.sourceModule || "App"}
        </div>
      </div>
    ),
  },
  {
    key: "id",
    label: "Trans ID",
    render: (row) => (
      <span className="font-mono text-[10px] text-theme-muted truncate block max-w-[90px]">{row.id}</span>
    ),
  },
  {
    key: "productName",
    label: "Item",
    render: (row) => (
      <div>
        <div className="font-medium text-theme-heading text-xs">{row.productName}</div>
        <div className="text-[10px] text-theme-muted font-mono mt-0.5">{row.productCode}</div>
      </div>
    ),
  },
  {
    key: "warehouse",
    label: "Warehouse / Bin",
    render: (row) => (
      <div>
        <div className="text-theme-body text-xs">{row.warehouse || "Main WH"}</div>
        <div className="text-[10px] text-theme-muted mt-0.5">Bin: {row.bin || "Default"}</div>
      </div>
    ),
  },
  {
    key: "movementType",
    label: "Type",
    render: (row) => (
      <div className="flex flex-col gap-1 items-start">
        <MovementBadge type={row.movementType} />
        {row.referenceDocId && (
          <span className="bg-theme-surface-2 px-1.5 py-0.5 rounded text-[10px] text-theme-muted">
            {row.referenceDocId}
          </span>
        )}
      </div>
    ),
  },
  {
    key: "quantityIn",
    label: "Qty In",
    align: "right",
    render: (row) => (
      <span className="font-bold text-emerald-400">
        {(row.quantityIn ?? 0) > 0 ? row.quantityIn : row.quantity > 0 ? row.quantity : "—"}
      </span>
    ),
  },
  {
    key: "quantityOut",
    label: "Qty Out",
    align: "right",
    render: (row) => (
      <span className="font-bold text-rose-400">
        {(row.quantityOut ?? 0) > 0
          ? row.quantityOut
          : row.quantity < 0
          ? Math.abs(row.quantity)
          : "—"}
      </span>
    ),
  },
  {
    key: "balanceAfter",
    label: "Balance",
    align: "right",
    render: (row) => (
      <span className="font-bold text-theme-heading">{row.balanceAfter}</span>
    ),
  },
];

export const StockLedgerTab: React.FC<StockLedgerTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMovement, setFilterMovement] = useState("ALL");

  const fetchLedger = () => {
    setLoading(true);
    apiFetchV1("/inventory/ledger")
      .then((data) => {
        const mapped: LedgerRow[] = data.map((item: any) => {
          const qty = parseFloat(item.quantity) || 0;
          const mType = item.movement_type;
          return {
            id: item.id,
            timestamp: item.created_at || new Date().toISOString(),
            productId: item.product_id,
            productCode: item.sku,
            productName: item.product_name,
            movementType: mType,
            quantity: qty,
            balanceAfter: 0,
            referenceDocType: item.reference_doc_type,
            referenceDocId: item.reference_doc_id,
            warehouse: item.warehouse || "Main Outlet Retail WH",
            bin: item.bin || "Default",
            batch: item.batch || "-",
            serial: item.serial || "-",
            notes: item.remarks,
            user: item.user || "System",
            sourceModule: item.source_module || "System",
            quantityIn: mType === "IN" ? qty : mType === "ADJUSTMENT" && qty > 0 ? qty : 0,
            quantityOut:
              mType === "OUT"
                ? Math.abs(qty)
                : mType === "ADJUSTMENT" && qty < 0
                ? Math.abs(qty)
                : 0,
          };
        });
        setEntries(mapped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load stock movements:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  useEffect(() => {
    recordAuditAction(
      "FILTER",
      "stock_ledgers",
      filterMovement,
      `Filtered stock ledger by movement type: ${filterMovement}`
    );
  }, [filterMovement]);

  // Apply movement type filter before passing to FioriListReport
  const filteredData =
    filterMovement === "ALL" ? entries : entries.filter((e) => e.movementType === filterMovement);

  return (
    <div className="flex flex-col h-full gap-0">
      {/* WNG-002 Read-Only Banner */}
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs flex-shrink-0">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Write operations are prohibited.</span>
        </div>
      )}

      {/* WNG-002 List Report Pattern — Filter Bar + Search + Actionable Data Table */}
      <div className="flex-1 overflow-hidden">
        <FioriListReport
          title="Stock Ledger"
          subtitle="Immutable chronological record of all inventory movements across all warehouses"
          data={filteredData}
          columns={COLUMNS}
          isLoading={loading}
          onRefresh={fetchLedger}
          searchPlaceholder="Search by item name, SKU, warehouse, or transaction ID..."
          filterOptions={[
            {
              key: "movementType",
              label: "Movement",
              options: [
                { label: "Stock IN", value: "IN" },
                { label: "Stock OUT", value: "OUT" },
                { label: "Adjustments", value: "ADJUSTMENT" },
                { label: "Transfers", value: "TRANSFER" },
              ],
            },
          ]}
        />
      </div>
    </div>
  );
};
