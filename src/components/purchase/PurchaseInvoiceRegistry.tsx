/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Dedicated Purchase Invoice Registry View
 * Architecture Standard: Pure List Report Pattern (WNG-002)
 */

import React, { useState } from "react";
import { FioriListReport } from "../common/FioriListReport.tsx";
import { formatCurrency, formatDateTime } from "../../utils/formatters.ts";
import { FileCheck, Eye, MoreVertical, Truck } from "lucide-react";
import { useACAS } from "../../context-actions/ContextProvider.tsx";

interface PurchaseInvoiceRegistryProps {
  purchaseOrders: any[];
  suppliers: any[];
  loading?: boolean;
  onRefresh: () => void;
  onNewInvoice: () => void;
  onSelectInvoice: (po: any) => void;
  currentUser?: { role: string; name: string } | null;
}

export const PurchaseInvoiceRegistry: React.FC<PurchaseInvoiceRegistryProps> = ({
  purchaseOrders,
  suppliers,
  loading = false,
  onRefresh,
  onNewInvoice,
  onSelectInvoice,
  currentUser,
}) => {
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const { openMenu } = useACAS();

  return (
    <div className="space-y-4">
      <FioriListReport
        title="Purchase Invoices & Bills Registry"
        subtitle="Inward vendor bills, purchase order ledgers, GST input tax credits (ITC), and GRN status."
        data={purchaseOrders.map((po) => ({
          ...po,
          _supplierName: suppliers.find((s) => s.id === po.supplierId || s.id === po.supplier_id)?.name || po.supplierName || "Direct Vendor",
          _itemCount: po.items ? po.items.reduce((acc: number, i: any) => acc + (i.quantity || i.qty || 1), 0) : 0,
        }))}
        columns={[
          {
            key: "orderNo",
            label: "Bill / PO No",
            sortable: true,
            render: (po) => (
              <span className="font-mono font-bold text-theme-body flex items-center space-x-2">
                <Truck size={13} className="text-theme-muted shrink-0" />
                <span>{po.orderNo || po.invoiceNo || po.id}</span>
              </span>
            ),
          },
          {
            key: "_supplierName",
            label: "Supplier Vendor",
            sortable: true,
            render: (po) => <span className="font-medium text-theme-body">{(po as any)._supplierName}</span>,
          },
          {
            key: "date",
            label: "Invoice Date",
            sortable: true,
            render: (po) => <span className="text-theme-muted font-mono">{formatDateTime(po.date || po.createdAt || Date.now())}</span>,
          },
          {
            key: "_itemCount",
            label: "Items",
            align: "right",
            render: (po) => <span className="font-mono text-theme-muted">{(po as any)._itemCount} units</span>,
          },
          {
            key: "taxTotal",
            label: "GST ITC",
            align: "right",
            render: (po) => <span className="font-mono text-theme-muted">{formatCurrency(po.taxTotal || po.taxAmount || 0)}</span>,
          },
          {
            key: "totalAmount",
            label: "Grand Total",
            align: "right",
            sortable: true,
            render: (po) => <span className="font-mono font-semibold text-emerald-400">{formatCurrency(po.totalAmount || po.grandTotal || 0)}</span>,
          },
          {
            key: "status",
            label: "Status",
            align: "center",
            render: (po) => (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  po.status === "Draft"
                    ? "bg-theme-surface-3 text-theme-muted border border-theme-divider"
                    : po.status === "Received" || po.status === "Approved"
                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                    : "bg-amber-950/80 text-amber-400 border border-amber-800"
                }`}
              >
                {po.status || "Completed"}
              </span>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            align: "center",
            render: (po) => (
              <div className="flex items-center justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPO(po);
                    onSelectInvoice(po);
                  }}
                  className="p-1 rounded hover:bg-theme-surface-3 text-sky-400"
                  title="View Purchase Invoice Detail"
                >
                  <Eye size={13} />
                </button>
                <button
                  onClick={(e) => {
                    openMenu(e, {
                      module: "purchase",
                      type: "purchase-invoice",
                      object: po,
                      role: currentUser?.role || "Store Manager",
                    });
                  }}
                  className="p-1 rounded hover:bg-theme-surface-3 text-theme-muted hover:text-theme-body"
                  title="Context Actions Menu"
                >
                  <MoreVertical size={13} />
                </button>
              </div>
            ),
          },
        ]}
        filterOptions={[
          {
            key: "status",
            label: "Status",
            options: [
              { label: "All Statuses", value: "ALL" },
              { label: "Draft", value: "Draft" },
              { label: "Received", value: "Received" },
              { label: "Approved", value: "Approved" },
            ],
          },
        ]}
        onRowClick={(po) => {
          setSelectedPO(po);
          onSelectInvoice(po);
        }}
        onRefresh={onRefresh}
        onCreateNew={onNewInvoice}
        primaryActionLabel="New Purchase Invoice"
        searchPlaceholder="Search PO bill no, vendor name..."
        isLoading={loading}
      />

      {/* Detail Inspection Drawer */}
      {selectedPO && (
        <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-theme-divider pb-2">
            <h4 className="font-semibold text-theme-body flex items-center space-x-2">
              <FileCheck size={16} className="text-sky-400" />
              <span>Purchase Invoice Detail: {selectedPO.orderNo || selectedPO.id}</span>
            </h4>
            <button onClick={() => setSelectedPO(null)} className="text-xs text-theme-muted hover:text-theme-body">
              Close Inspection
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-theme-muted block">Supplier</span>
              <span className="font-medium text-theme-body">{selectedPO._supplierName}</span>
            </div>
            <div>
              <span className="text-theme-muted block">Date</span>
              <span className="font-mono text-theme-body">{formatDateTime(selectedPO.date || selectedPO.createdAt)}</span>
            </div>
            <div>
              <span className="text-theme-muted block">GST ITC Amount</span>
              <span className="font-mono text-theme-body">{formatCurrency(selectedPO.taxTotal || selectedPO.taxAmount || 0)}</span>
            </div>
            <div>
              <span className="text-theme-muted block">Grand Total</span>
              <span className="font-mono text-emerald-400 font-bold">{formatCurrency(selectedPO.totalAmount || selectedPO.grandTotal || 0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
