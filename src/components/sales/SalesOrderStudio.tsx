/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation 3: Sales Order Studio
 * Architecture Standard: Universal SAWF Studio Shell Consumer
 */

import React, { useState } from "react";
import { DocumentStudio } from "../../framework/sawf/components/DocumentStudio.tsx";
import { ItemGridRow } from "../../framework/sawf/components/DocumentItemsGrid.tsx";
import { MetadataLoader } from "../../framework/sawf/metadata/MetadataLoader.ts";
import salesOrderMeta from "../../metadata/sales_order.json";
import { SAWFDocumentMeta } from "../../framework/sawf/types/sawf.ts";
import { Product, Customer } from "../../types.ts";
import { recordAuditAction } from "../../lib/apiFetch.ts";
import { formatCurrency } from "../../utils/formatters.ts";
import { User, Truck, ShieldCheck, CreditCard, DollarSign } from "lucide-react";

// Register SalesOrder metadata dynamically with MetadataLoader (Zero framework touch!)
MetadataLoader.register("SalesOrder", salesOrderMeta as SAWFDocumentMeta);

interface SalesOrderStudioProps {
  initialOrder?: any;
  customers: Customer[];
  products: Product[];
  currentUser?: { role: string; name: string } | null;
  onBack: () => void;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const SalesOrderStudio: React.FC<SalesOrderStudioProps> = ({
  initialOrder,
  customers,
  products,
  currentUser,
  onBack,
  onNotification,
}) => {
  const [customerId, setCustomerId] = useState<string>(initialOrder?.customerId || customers[0]?.id || "");
  const [orderNo, setOrderNo] = useState<string>(initialOrder?.orderNo || `SO-${Date.now().toString().slice(-6)}`);
  const [shippingAddress, setShippingAddress] = useState<string>(initialOrder?.shippingAddress || "");
  const [isInterstate, setIsInterstate] = useState<boolean>(initialOrder?.isInterstate || false);
  const [advanceDeposit, setAdvanceDeposit] = useState<number>(initialOrder?.advanceDeposit || 0);
  const [items, setItems] = useState<ItemGridRow[]>(
    initialOrder?.items
      ? initialOrder.items.map((i: any) => ({
          productId: i.productId || i.id,
          code: i.code || i.sku || "ART-001",
          name: i.name || i.productName || "Order Item",
          description: i.description || "Retail Goods",
          quantity: i.quantity || i.qty || 1,
          price: i.price || i.sellingPrice || 100,
          discountPercent: i.discountPercent || 0,
          gstRate: i.taxRate || i.gstRate || 18,
          totalAmount: (i.quantity || 1) * (i.price || 100) * (1 + (i.taxRate || 18) / 100),
        }))
      : []
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Calculate totals
  const taxable = items.reduce((acc, i) => acc + i.price * i.quantity * (1 - (i.discountPercent || 0) / 100), 0);
  const totalTax = items.reduce((acc, i) => acc + (i.price * i.quantity * (1 - (i.discountPercent || 0) / 100) * i.gstRate) / 100, 0);
  const grandTotal = taxable + totalTax;

  const handlePersistOrder = (targetStatus: string) => {
    const nextId = initialOrder?.id || `SO-${Date.now()}`;
    recordAuditAction("CREATE", "sales_orders", nextId, `Saved SalesOrder ${orderNo} (${targetStatus})`);
    onNotification("Success", `Sales Order ${orderNo} (${targetStatus}) saved successfully.`, "success");
    onBack();
  };

  const renderPanelContent = (panelId: string) => {
    switch (panelId) {
      case "customer_order_info":
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-theme-muted block font-medium mb-1 flex items-center space-x-1">
                <User size={13} />
                <span>Customer Client</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body"
              >
                <option value="">Select Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || c.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-theme-muted block font-medium mb-1">Sales Order Number</label>
              <input
                type="text"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body font-mono"
              />
            </div>
            <div>
              <label className="text-theme-muted block font-medium mb-1">GST Jurisdiction</label>
              <select
                value={isInterstate ? "INTERSTATE" : "INTRASTATE"}
                onChange={(e) => setIsInterstate(e.target.value === "INTERSTATE")}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body"
              >
                <option value="INTRASTATE">Intrastate Supply (CGST + SGST)</option>
                <option value="INTERSTATE">Interstate Supply (IGST)</option>
              </select>
            </div>
          </div>
        );

      case "items_grid":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-theme-muted">
              <span>Enter order line items or select from catalog:</span>
              <span className="font-mono">{items.length} line items reserved</span>
            </div>
          </div>
        );

      case "tax_hsn_breakdown":
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider">
              <span className="text-theme-muted block">Taxable Value</span>
              <span className="font-mono text-base font-bold text-theme-body">{formatCurrency(taxable)}</span>
            </div>
            <div className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider">
              <span className="text-theme-muted block">{isInterstate ? "IGST (100%)" : "CGST (50%)"}</span>
              <span className="font-mono text-base font-bold text-sky-400">
                {formatCurrency(isInterstate ? totalTax : totalTax / 2)}
              </span>
            </div>
            <div className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider">
              <span className="text-theme-muted block">{isInterstate ? "SGST (N/A)" : "SGST (50%)"}</span>
              <span className="font-mono text-base font-bold text-sky-400">
                {formatCurrency(isInterstate ? 0 : totalTax / 2)}
              </span>
            </div>
            <div className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider">
              <span className="text-theme-muted block">Grand Total Order</span>
              <span className="font-mono text-base font-bold text-emerald-400">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        );

      case "fulfillment_dispatch":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-theme-muted block font-medium mb-1 flex items-center space-x-1">
                <Truck size={13} />
                <span>Shipping Address</span>
              </label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Enter dispatch destination address"
                rows={2}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-3 text-theme-body"
              />
            </div>
            <div>
              <label className="text-theme-muted block font-medium mb-1 flex items-center space-x-1">
                <ShieldCheck size={13} />
                <span>Fulfillment Priority</span>
              </label>
              <select className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body">
                <option value="Standard">Standard Courier Dispatch</option>
                <option value="Express">Express Same-Day Dispatch</option>
                <option value="Pickup">Store Counter Pickup</option>
              </select>
            </div>
          </div>
        );

      case "advance_payment":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-theme-muted block font-medium mb-1 flex items-center space-x-1">
                <DollarSign size={13} />
                <span>Advance Deposit Amount (₹)</span>
              </label>
              <input
                type="number"
                value={advanceDeposit}
                onChange={(e) => setAdvanceDeposit(Number(e.target.value))}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body font-mono font-bold text-emerald-400"
              />
            </div>
            <div>
              <label className="text-theme-muted block font-medium mb-1 flex items-center space-x-1">
                <CreditCard size={13} />
                <span>Balance Payment Terms</span>
              </label>
              <select className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body">
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="Net30">Credit Terms (Net 30 Days)</option>
                <option value="Prepaid">Full Prepaid</option>
              </select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DocumentStudio
      documentType="SalesOrder"
      documentNo={orderNo}
      status={initialOrder?.status || "Draft"}
      role={currentUser?.role}
      items={items}
      onChangeItems={setItems}
      products={products}
      renderPanelContent={renderPanelContent}
      onBack={onBack}
      onSaveDraft={() => handlePersistOrder("Draft")}
      onSave={() => handlePersistOrder("Confirmed")}
      onPost={() => handlePersistOrder("Approved")}
      onPrint={() => window.print()}
      sidebarData={{
        taxable,
        cgst: isInterstate ? 0 : totalTax / 2,
        sgst: isInterstate ? 0 : totalTax / 2,
        igst: isInterstate ? totalTax : 0,
        grandTotal,
        customerName: selectedCustomer?.name || "Customer",
        customer: selectedCustomer,
      }}
    />
  );
};
