/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation 2: Purchase Invoice Studio
 * Architecture Standard: Universal SAWF Studio Shell Consumer
 */

import React, { useState } from "react";
import { DocumentStudio } from "../../framework/sawf/components/DocumentStudio.tsx";
import { ItemGridRow } from "../../framework/sawf/components/DocumentItemsGrid.tsx";
import { MetadataLoader } from "../../framework/sawf/metadata/MetadataLoader.ts";
import purchaseInvoiceMeta from "../../metadata/purchase_invoice.json";
import { SAWFDocumentMeta } from "../../framework/sawf/types/sawf.ts";
import { Product } from "../../types.ts";
import { recordAuditAction } from "../../lib/apiFetch.ts";
import { formatCurrency } from "../../utils/formatters.ts";
import { Truck, ShieldCheck, FileSpreadsheet, Building2, CreditCard } from "lucide-react";

// Register PurchaseInvoice metadata dynamically with MetadataLoader (Zero framework touch!)
MetadataLoader.register("PurchaseInvoice", purchaseInvoiceMeta as SAWFDocumentMeta);

interface PurchaseInvoiceStudioProps {
  initialInvoice?: any;
  suppliers: any[];
  products: Product[];
  currentUser?: { role: string; name: string } | null;
  onBack: () => void;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const PurchaseInvoiceStudio: React.FC<PurchaseInvoiceStudioProps> = ({
  initialInvoice,
  suppliers,
  products,
  currentUser,
  onBack,
  onNotification,
}) => {
  const [supplierId, setSupplierId] = useState<string>(initialInvoice?.supplierId || suppliers[0]?.id || "");
  const [poNumber, setPoNumber] = useState<string>(initialInvoice?.orderNo || `PO-${Date.now().toString().slice(-6)}`);
  const [eWayBill, setEWayBill] = useState<string>(initialInvoice?.eWayBill || "");
  const [isInterstate, setIsInterstate] = useState<boolean>(initialInvoice?.isInterstate || false);
  const [paymentMode, setPaymentMode] = useState<string>("Bank Transfer");
  const [items, setItems] = useState<ItemGridRow[]>(
    initialInvoice?.items
      ? initialInvoice.items.map((i: any) => ({
          productId: i.productId || i.id,
          code: i.code || i.sku || "ART-001",
          name: i.name || i.productName || "Purchase Item",
          description: i.description || "Vendor Raw Material",
          quantity: i.quantity || i.qty || 1,
          price: i.price || i.costPrice || 100,
          discountPercent: i.discountPercent || 0,
          gstRate: i.taxRate || i.gstRate || 18,
          totalAmount: (i.quantity || 1) * (i.price || 100) * (1 + (i.taxRate || 18) / 100),
        }))
      : []
  );

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  // Calculate totals
  const taxable = items.reduce((acc, i) => acc + i.price * i.quantity * (1 - (i.discountPercent || 0) / 100), 0);
  const totalTax = items.reduce((acc, i) => acc + (i.price * i.quantity * (1 - (i.discountPercent || 0) / 100) * i.gstRate) / 100, 0);
  const grandTotal = taxable + totalTax;

  const handlePersistInvoice = (targetStatus: string) => {
    const nextId = initialInvoice?.id || `PUR-${Date.now()}`;
    recordAuditAction("CREATE", "purchase_invoices", nextId, `Saved PurchaseInvoice ${poNumber} (${targetStatus})`);
    onNotification("Success", `Purchase Invoice ${poNumber} (${targetStatus}) saved successfully.`, "success");
    onBack();
  };

  const renderPanelContent = (panelId: string) => {
    switch (panelId) {
      case "supplier_info":
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-theme-muted block font-medium mb-1 flex items-center space-x-1">
                <Building2 size={13} />
                <span>Vendor Supplier</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body"
              >
                <option value="">Select Vendor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.vendorCode || s.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-theme-muted block font-medium mb-1">PO Bill Reference No</label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body font-mono"
              />
            </div>
            <div>
              <label className="text-theme-muted block font-medium mb-1">GST Jurisdiction Type</label>
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
              <span>Enter inward items or select from catalog:</span>
              <span className="font-mono">{items.length} line items selected</span>
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
              <span className="text-theme-muted block">Grand Total Bill</span>
              <span className="font-mono text-base font-bold text-emerald-400">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        );

      case "logistics_grn":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-theme-muted block font-medium mb-1 flex items-center space-x-1">
                <Truck size={13} />
                <span>Inward E-Way Bill Number</span>
              </label>
              <input
                type="text"
                value={eWayBill}
                onChange={(e) => setEWayBill(e.target.value)}
                placeholder="E.g. 121004928192"
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body font-mono"
              />
            </div>
            <div>
              <label className="text-theme-muted block font-medium mb-1 flex items-center space-x-1">
                <ShieldCheck size={13} />
                <span>GRN Verification Pass</span>
              </label>
              <input
                type="text"
                placeholder="Gate Pass Ref No"
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body font-mono"
              />
            </div>
          </div>
        );

      case "payment_terms":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-theme-muted block font-medium mb-1 flex items-center space-x-1">
                <CreditCard size={13} />
                <span>Settlement Payment Mode</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="Credit Ledger">Vendor Credit Account (30 Days)</option>
                <option value="UPI / QR">Corporate UPI</option>
                <option value="Cheque">PDC Cheque</option>
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
      documentType="PurchaseInvoice"
      documentNo={poNumber}
      status={initialInvoice?.status || "Draft"}
      role={currentUser?.role}
      items={items}
      onChangeItems={setItems}
      products={products}
      renderPanelContent={renderPanelContent}
      onBack={onBack}
      onSaveDraft={() => handlePersistInvoice("Draft")}
      onSave={() => handlePersistInvoice("Submitted")}
      onPost={() => handlePersistInvoice("Posted")}
      onPrint={() => window.print()}
      sidebarData={{
        taxable,
        cgst: isInterstate ? 0 : totalTax / 2,
        sgst: isInterstate ? 0 : totalTax / 2,
        igst: isInterstate ? totalTax : 0,
        grandTotal,
        customerName: selectedSupplier?.name || "Vendor",
      }}
    />
  );
};
