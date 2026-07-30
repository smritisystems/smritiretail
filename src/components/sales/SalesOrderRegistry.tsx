/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Dedicated Sales Order Registry View
 * Architecture Standard: Pure List Report Pattern (WNG-002)
 */

import React, { useState } from "react";
import { FioriListReport } from "../common/FioriListReport.tsx";
import { formatCurrency, formatDateTime } from "../../utils/formatters.ts";
import { ShoppingCart, Eye, MoreVertical, FileCheck } from "lucide-react";
import { useACAS } from "../../context-actions/ContextProvider.tsx";

interface SalesOrderRegistryProps {
  salesOrders: any[];
  customers: any[];
  loading?: boolean;
  onRefresh: () => void;
  onNewOrder: () => void;
  onSelectOrder: (so: any) => void;
  currentUser?: { role: string; name: string } | null;
}

export const SalesOrderRegistry: React.FC<SalesOrderRegistryProps> = ({
  salesOrders,
  customers,
  loading = false,
  onRefresh,
  onNewOrder,
  onSelectOrder,
  currentUser,
}) => {
  const [selectedSO, setSelectedSO] = useState<any>(null);
  const { openMenu } = useACAS();

  return (
    <div className="space-y-4">
      <FioriListReport
        title="Sales Orders Registry"
        subtitle="Customer sales order bookings, fulfillment allocation status, and advance deposit tracking."
        data={salesOrders.map((so) => ({
          ...so,
          _customerName: customers.find((c) => c.id === so.customerId || c.id === so.customer_id)?.name || so.customerName || "Walk-In Customer",
          _itemCount: so.items ? so.items.reduce((acc: number, i: any) => acc + (i.quantity || i.qty || 1), 0) : 0,
        }))}
        columns={[
          {
            key: "orderNo",
            label: "Sales Order No",
            sortable: true,
            render: (so) => (
              <span className="font-mono font-bold text-theme-body flex items-center space-x-2">
                <ShoppingCart size={13} className="text-theme-muted shrink-0" />
                <span>{so.orderNo || so.id}</span>
              </span>
            ),
          },
          {
            key: "_customerName",
            label: "Customer Name",
            sortable: true,
            render: (so) => <span className="font-medium text-theme-body">{(so as any)._customerName}</span>,
          },
          {
            key: "date",
            label: "Order Date",
            sortable: true,
            render: (so) => <span className="text-theme-muted font-mono">{formatDateTime(so.date || so.createdAt || Date.now())}</span>,
          },
          {
            key: "_itemCount",
            label: "Items",
            align: "right",
            render: (so) => <span className="font-mono text-theme-muted">{(so as any)._itemCount} units</span>,
          },
          {
            key: "taxTotal",
            label: "GST",
            align: "right",
            render: (so) => <span className="font-mono text-theme-muted">{formatCurrency(so.taxTotal || so.taxAmount || 0)}</span>,
          },
          {
            key: "grandTotal",
            label: "Grand Total",
            align: "right",
            sortable: true,
            render: (so) => <span className="font-mono font-semibold text-emerald-400">{formatCurrency(so.grandTotal || so.totalAmount || 0)}</span>,
          },
          {
            key: "status",
            label: "Status",
            align: "center",
            render: (so) => (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  so.status === "Draft"
                    ? "bg-theme-surface-3 text-theme-muted border border-theme-divider"
                    : so.status === "Confirmed" || so.status === "Approved"
                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                    : "bg-amber-950/80 text-amber-400 border border-amber-800"
                }`}
              >
                {so.status || "Confirmed"}
              </span>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            align: "center",
            render: (so) => (
              <div className="flex items-center justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSO(so);
                    onSelectOrder(so);
                  }}
                  className="p-1 rounded hover:bg-theme-surface-3 text-sky-400"
                  title="View Sales Order Detail"
                >
                  <Eye size={13} />
                </button>
                <button
                  onClick={(e) => {
                    openMenu(e, {
                      module: "sales",
                      type: "sales-order",
                      object: so,
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
              { label: "Confirmed", value: "Confirmed" },
              { label: "Approved", value: "Approved" },
            ],
          },
        ]}
        onRowClick={(so) => {
          setSelectedSO(so);
          onSelectOrder(so);
        }}
        onRefresh={onRefresh}
        onCreateNew={onNewOrder}
        primaryActionLabel="New Sales Order"
        searchPlaceholder="Search order no, customer name..."
        isLoading={loading}
      />

      {/* Detail Inspection Drawer */}
      {selectedSO && (
        <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-theme-divider pb-2">
            <h4 className="font-semibold text-theme-body flex items-center space-x-2">
              <FileCheck size={16} className="text-sky-400" />
              <span>Sales Order Detail: {selectedSO.orderNo || selectedSO.id}</span>
            </h4>
            <button onClick={() => setSelectedSO(null)} className="text-xs text-theme-muted hover:text-theme-body">
              Close Inspection
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-theme-muted block">Customer</span>
              <span className="font-medium text-theme-body">{selectedSO._customerName}</span>
            </div>
            <div>
              <span className="text-theme-muted block">Order Date</span>
              <span className="font-mono text-theme-body">{formatDateTime(selectedSO.date || selectedSO.createdAt)}</span>
            </div>
            <div>
              <span className="text-theme-muted block">GST Amount</span>
              <span className="font-mono text-theme-body">{formatCurrency(selectedSO.taxTotal || selectedSO.taxAmount || 0)}</span>
            </div>
            <div>
              <span className="text-theme-muted block">Grand Total</span>
              <span className="font-mono text-emerald-400 font-bold">{formatCurrency(selectedSO.grandTotal || selectedSO.totalAmount || 0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
