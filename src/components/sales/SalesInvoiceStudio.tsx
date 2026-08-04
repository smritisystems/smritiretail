/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation: Sales Invoice Studio
 * Dedicated Document Workspace for Creating/Editing ONE Invoice
 */

import React, { useState, useEffect } from "react";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus.js";
import { DocumentStudio } from "../../framework/sawf/components/DocumentStudio.tsx";
import { ItemGridRow } from "../../framework/sawf/components/DocumentItemsGrid.tsx";
import { Customer, Product, SalesInvoice } from "../../types.ts";
import { addSalesInvoice, saveSalesInvoices, getSalesInvoices } from "../../services/customerStore.ts";
import { recordAuditAction } from "../../lib/apiFetch.ts";

interface SalesInvoiceStudioProps {
  initialInvoice?: SalesInvoice | null;
  customers: Customer[];
  products: Product[];
  currentUser?: { role: string; name: string; companyId?: string; branchId?: string } | null;
  onBack: () => void;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const SalesInvoiceStudio: React.FC<SalesInvoiceStudioProps> = ({
  initialInvoice,
  customers,
  products,
  currentUser,
  onBack,
  onNotification,
}) => {
  const [customerId, setCustomerId] = useState<string>(initialInvoice?.customerId || "");
  const [isInterstate, setIsInterstate] = useState<boolean>(initialInvoice?.isInterstate || false);
  const [eWayBillNo, setEWayBillNo] = useState<string>(initialInvoice?.eWayBillNo || "");
  const [status, setStatus] = useState<"Draft" | "Submitted" | "Approved" | "Cancelled">(
    initialInvoice?.status || "Draft"
  );

  // Publish header metadata to Workspace Kernel
  useEffect(() => {
    WorkspaceEventBus.publish("HeaderUpdate", {
      title: "Sales Invoice",
      documentNo: initialInvoice?.invoiceNo,
      status,
      posFocus: false,
    }, "sales.invoice");
    return () => {
      // clear header when unmounting
      WorkspaceEventBus.publish("HeaderUpdate", { title: undefined, documentNo: undefined, status: undefined }, "sales.invoice");
    };
  }, [initialInvoice?.invoiceNo, status]);

  // Form Header & Metadata Fields
  const [invoiceDate, setInvoiceDate] = useState<string>(
    initialInvoice?.date ? initialInvoice.date.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
  const [warehouse, setWarehouse] = useState<string>("WH-01 Main Warehouse");
  const [priceList, setPriceList] = useState<string>("Standard Retail List");
  const [salesperson, setSalesperson] = useState<string>(currentUser?.name || "Store Manager");
  const [transporterName, setTransporterName] = useState<string>("");
  const [lrNumber, setLrNumber] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  // Map initial items to ItemGridRow format
  const initialRows: ItemGridRow[] = initialInvoice?.items
    ? initialInvoice.items.map((item) => ({
        productId: item.productId,
        code: item.code,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        gstRate: item.gstRate || 18,
        totalAmount: item.totalAmount,
      }))
    : [];

  const [items, setItems] = useState<ItemGridRow[]>(initialRows);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Calculations
  const taxableTotal = items.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);
  const cgst = isInterstate
    ? 0
    : items.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1) * (item.gstRate || 18)) / 200, 0);
  const sgst = isInterstate
    ? 0
    : items.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1) * (item.gstRate || 18)) / 200, 0);
  const igst = isInterstate
    ? items.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1) * (item.gstRate || 18)) / 100, 0)
    : 0;
  const taxTotal = cgst + sgst + igst;
  const grandTotal = taxableTotal + taxTotal;

  const sidebarData = {
    taxable: taxableTotal,
    cgst,
    sgst,
    igst,
    grandTotal,
    customer: selectedCustomer,
    items,
  };

  const handlePersistInvoice = (targetStatus: "Draft" | "Submitted" | "Approved") => {
    if (!customerId && customers.length > 0) {
      onNotification("Missing Customer", "Please select a valid customer before saving.", "error");
      return;
    }

    if (items.length === 0) {
      onNotification("Empty Document", "Please add at least one line item to the document grid.", "error");
      return;
    }

    const nextNo = initialInvoice?.invoiceNo || `INV-26-27/${String(Math.floor(Math.random() * 900000 + 100000))}`;
    const nextId = initialInvoice?.id || `INV-${Date.now()}`;

    const updatedInvoice: SalesInvoice = {
      id: nextId,
      invoiceNo: nextNo,
      date: new Date(invoiceDate).toISOString(),
      customerId: customerId || customers[0]?.id || "CUST-001",
      items: items.map((i) => ({
        productId: i.productId,
        code: i.code,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        hsnCode: "6203",
        gstRate: i.gstRate,
        taxAmount: (i.quantity * i.price * i.gstRate) / 100,
        totalAmount: i.totalAmount,
      })),
      taxTotal,
      grandTotal,
      isInterstate,
      eWayBillNo: eWayBillNo || undefined,
      status: targetStatus,
    };

    if (initialInvoice) {
      const existingList = getSalesInvoices();
      const updatedList = existingList.map((inv) => (inv.id === updatedInvoice.id ? updatedInvoice : inv));
      saveSalesInvoices(updatedList);
    } else {
      addSalesInvoice(updatedInvoice);
    }

    recordAuditAction("CREATE", "sales_invoices", nextId, `Saved SalesInvoice ${nextNo} (${targetStatus})`);
    onNotification("Success", `Sales Invoice ${nextNo} (${targetStatus}) saved successfully.`, "success");
    onBack();
  };

  // Renderer for accordion panels driven by metadata
  const renderPanelContent = (panelId: string) => {
    switch (panelId) {
      case "customer":
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                Customer Name *
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--c-seef-accent)] font-semibold"
              >
                <option value="">-- Choose Registered Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.mobile})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                Mobile Number
              </label>
              <input
                type="text"
                readOnly
                value={selectedCustomer?.mobile || ""}
                placeholder="Auto-filled from profile"
                className="w-full bg-[#1A2333] border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                GSTIN Tax Identification
              </label>
              <input
                type="text"
                readOnly
                value={selectedCustomer?.gstNumber || "URP (Unregistered)"}
                className="w-full bg-[#1A2333] border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body font-mono"
              />
            </div>

            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                  Billing Address
                </label>
                <input
                  type="text"
                  defaultValue="24 Commercial Street, Retail Zone, Mumbai, Maharashtra 400001"
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                  Shipping Address
                </label>
                <input
                  type="text"
                  defaultValue="Same as Billing Address"
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        );

      case "commercial":
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                Invoice Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                Price List
              </label>
              <select
                value={priceList}
                onChange={(e) => setPriceList(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option>Standard Retail List</option>
                <option>Wholesale Partner Tier</option>
                <option>VIP Privilege Rate</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                Salesperson
              </label>
              <input
                type="text"
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        );

      case "tax":
        return (
          <div className="space-y-3 text-xs">
            <div className="flex items-center space-x-3 bg-theme-surface-1 p-3 rounded-xl border border-theme-divider">
              <input
                type="checkbox"
                id="isInterstate"
                checked={isInterstate}
                onChange={(e) => setIsInterstate(e.target.checked)}
                className="rounded border-theme-divider bg-theme-surface-2 accent-indigo-600 h-4 w-4"
              />
              <label htmlFor="isInterstate" className="text-xs font-semibold text-white select-none cursor-pointer">
                Interstate IGST Supply (Out-of-State Customer Transaction)
              </label>
            </div>
            <div className="text-[11px] text-theme-muted leading-relaxed">
              SMRITI Tax Engine automatically computes {isInterstate ? "IGST" : "CGST + SGST"} tax breakdown based on supply rules.
            </div>
          </div>
        );

      case "shipping":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                Transporter Name
              </label>
              <input
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="e.g. VRL Logistics"
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                LR / Transport Receipt No
              </label>
              <input
                type="text"
                value={lrNumber}
                onChange={(e) => setLrNumber(e.target.value)}
                placeholder="e.g. LR-990812"
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        );

      case "compliance":
        return (
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block mb-1">
                E-Way Bill Number (NIC Portal)
              </label>
              <input
                type="text"
                value={eWayBillNo}
                onChange={(e) => setEWayBillNo(e.target.value)}
                placeholder="12-digit E-Way Bill Number"
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="p-3 text-xs text-theme-muted italic">
            Configurable enterprise metadata panel.
          </div>
        );
    }
  };

  return (
    <DocumentStudio
      documentType="SalesInvoice"
      documentNo={initialInvoice?.invoiceNo}
      status={status}
      role={currentUser?.role}
      items={items}
      onChangeItems={setItems}
      products={products}
      renderPanelContent={renderPanelContent}
      onBack={onBack}
      onSaveDraft={() => handlePersistInvoice("Draft")}
      onSave={() => handlePersistInvoice("Submitted")}
      onPost={() => handlePersistInvoice("Approved")}
      onPrint={() => {
        onNotification("Print", "Generating Tax Invoice PDF...", "success");
        window.print();
      }}
      sidebarData={sidebarData}
    />
  );
};
