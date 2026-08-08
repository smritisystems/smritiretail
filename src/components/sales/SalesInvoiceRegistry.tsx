/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation: Sales Invoice Registry
 * Dedicated Management Workspace (Zero Inline Form Contamination)
 */

import React, { useState } from "react";
import { FileCheck, Eye, Printer, MessageCircle, Mail, MoreVertical, Plus, RefreshCw } from "lucide-react";
import { FioriListReport } from "../common/FioriListReport.tsx";
import { SalesInvoice, Customer } from "../../types.ts";
import { formatDateTime, formatCurrency } from "../../utils/formatters.ts";
import { useACAS } from "../../context-actions/ContextProvider.tsx";

interface SalesInvoiceRegistryProps {
  salesInvoices: SalesInvoice[];
  customers: Customer[];
  loading: boolean;
  onRefresh: () => void;
  onNewInvoice: () => void;
  onSelectInvoice: (invoice: SalesInvoice) => void;
  currentUser?: { role: string; name: string } | null;
}

export const SalesInvoiceRegistry: React.FC<SalesInvoiceRegistryProps> = ({
  salesInvoices,
  customers,
  loading,
  onRefresh,
  onNewInvoice,
  onSelectInvoice,
  currentUser,
}) => {
  const { openMenu } = useACAS();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const formattedData = salesInvoices.map((si) => ({
    ...si,
    _customerName: customers.find((c) => c.id === si.customerId)?.name || "Walk-In Customer",
    _itemCount: si.items ? si.items.reduce((acc, i) => acc + (i.quantity || 1), 0) : 0,
  }));

  return (
    <div className="w-full bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-2xl">
      <FioriListReport
        title="Sales Invoices Registry"
        subtitle="Complete tax-compliant GST invoice ledger with workflow status and context actions."
        data={formattedData}
        columns={[
          {
            key: "invoiceNo",
            label: "Invoice No",
            sortable: true,
            render: (si: any) => (
              <span className="font-mono font-bold text-white flex items-center space-x-2">
                <FileCheck size={14} className="text-theme-muted shrink-0" />
                <span>{si.invoiceNo}</span>
              </span>
            ),
          },
          {
            key: "_customerName",
            label: "Customer Name",
            sortable: true,
            render: (si: any) => <span className="font-semibold text-theme-heading">{si._customerName}</span>,
          },
          {
            key: "date",
            label: "Invoice Date",
            sortable: true,
            render: (si: any) => <span className="text-theme-muted font-mono">{formatDateTime(si.date)}</span>,
          },
          {
            key: "_itemCount",
            label: "Items Qty",
            align: "right",
            render: (si: any) => <span className="font-mono text-theme-muted">{si._itemCount} units</span>,
          },
          {
            key: "taxTotal",
            label: "Consolidated GST",
            align: "right",
            render: (si: any) => <span className="font-mono text-amber-300">{formatCurrency(si.taxTotal)}</span>,
          },
          {
            key: "grandTotal",
            label: "Grand Total",
            align: "right",
            sortable: true,
            render: (si: any) => <span className="font-mono font-bold text-emerald-400">{formatCurrency(si.grandTotal)}</span>,
          },
          {
            key: "status",
            label: "Status",
            align: "center",
            render: (si: any) => (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                  si.status === "Draft"
                    ? "bg-theme-surface-2 text-theme-muted border border-theme-divider"
                    : si.status === "Submitted"
                    ? "bg-amber-950/80 text-amber-400 border border-amber-800"
                    : si.status === "Approved"
                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                    : "bg-rose-950/80 text-rose-400 border border-rose-800"
                }`}
              >
                {si.status}
              </span>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            align: "center",
            render: (si: any) => (
              <div className="flex items-center justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectInvoice(si);
                  }}
                  className="p-1 rounded hover:bg-theme-surface-hover text-sky-400 transition"
                  title="View Detail Drawer"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openMenu(e, {
                      module: "sales",
                      type: "sales-invoice",
                      object: si,
                      role: currentUser?.role || "Store Manager",
                    });
                  }}
                  className="p-1 rounded hover:bg-theme-surface-hover text-theme-muted hover:text-white transition"
                  title="Context Menu"
                >
                  <MoreVertical size={14} />
                </button>
              </div>
            ),
          },
        ]}
        filterOptions={[
          {
            key: "status",
            label: "Filter by Status",
            options: [
              { label: "All Statuses", value: "ALL" },
              { label: "Draft", value: "Draft" },
              { label: "Submitted", value: "Submitted" },
              { label: "Approved", value: "Approved" },
              { label: "Cancelled", value: "Cancelled" },
            ],
          },
        ]}
        onRowClick={(si: any) => onSelectInvoice(si)}
        onRefresh={onRefresh}
        onCreateNew={onNewInvoice}
        primaryActionLabel="+ New Sales Invoice"
        searchPlaceholder="Filter invoice no, customer name, mobile..."
        isLoading={loading}
      />
    </div>
  );
};
