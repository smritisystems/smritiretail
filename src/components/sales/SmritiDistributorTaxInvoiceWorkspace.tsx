/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.10.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { TaxInvoiceHeaderToolbar } from "./components/TaxInvoiceHeaderToolbar.tsx";
import { TaxInvoiceDocumentPanel } from "./components/TaxInvoiceDocumentPanel.tsx";
import { TaxInvoiceItemGrid } from "./components/TaxInvoiceItemGrid.tsx";
import { TaxInvoiceDirectEntryBar } from "./components/TaxInvoiceDirectEntryBar.tsx";
import { TaxInvoiceFooterTabs } from "./components/TaxInvoiceFooterTabs.tsx";
import { TaxInvoiceNetValuesPanel } from "./components/TaxInvoiceNetValuesPanel.tsx";
import { TaxInvoiceStatusBar } from "./components/TaxInvoiceStatusBar.tsx";
import { TaxInvoiceDocumentState, TaxInvoiceItemRow } from "./types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { ExportColumnDefinition } from "../export/types.ts";
import { X, Search } from "lucide-react";

export interface SmritiDistributorTaxInvoiceWorkspaceProps {
  initialInvoiceId?: string;
  onExit?: () => void;
  onNotification?: (title: string, msg: string, type?: "success" | "error" | "info" | "warning") => void;
  currentUser?: { role: string; name: string } | null;
}

const DEFAULT_DOC_STATE: TaxInvoiceDocumentState = {
  billType: "Product",
  transactionMode: "Credit",
  docPrefix: "D1DS13",
  docNo: "1",
  docDate: new Date().toISOString().split("T")[0],
  customerId: "",
  customerCode: "",
  customerName: "",
  customerGstin: "",
  customerMobile: "",
  customerAddress: "",
  salesStaff: "EMP001 - Jawahar Mallah",
  items: [],
  transporterDetails: [],
  paymentDetails: [],
  addonsAndDeductions: [],
  documentRemarks: "",
};

export const SmritiDistributorTaxInvoiceWorkspace: React.FC<SmritiDistributorTaxInvoiceWorkspaceProps> = ({
  initialInvoiceId,
  onExit,
  onNotification,
  currentUser,
}) => {
  const [docState, setDocState] = useState<TaxInvoiceDocumentState>(DEFAULT_DOC_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customersList, setCustomersList] = useState<any[]>([]);

  // Load customer directory
  const loadCustomers = useCallback(async () => {
    try {
      const res = await apiFetchV1("/customers");
      const list = Array.isArray(res) ? res : res?.items || [];
      setCustomersList(list);
    } catch {
      // Fallback seed
      setCustomersList([
        { id: "CUST-001", code: "CUST-001", name: "Shoppers Stop Ltd", mobile: "9820011223", gstin: "27AAACS1234F1Z5" },
        { id: "CUST-002", code: "CUST-002", name: "Lifestyle International", mobile: "9820099887", gstin: "27AABCL5678G2Z1" },
        { id: "CUST-003", code: "CUST-003", name: "Pantaloons Fashion", mobile: "9820044556", gstin: "27AAACP9012H1Z9" },
      ]);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Lookup product via API
  const handleLookupProduct = useCallback(async (term: string): Promise<any | null> => {
    try {
      const res = await apiFetchV1(`/products?search=${encodeURIComponent(term)}`);
      const items = Array.isArray(res) ? res : res?.items || res?.products || [];
      if (items.length > 0) {
        return items[0];
      }
    } catch {
      // Ignore product lookup network errors
    }
    return null;
  }, []);

  // Update doc state partials
  const handleDocChange = (updates: Partial<TaxInvoiceDocumentState>) => {
    setDocState((prev) => ({ ...prev, ...updates }));
  };

  // Add Item to grid
  const handleAddItem = (item: Omit<TaxInvoiceItemRow, "sNo" | "id">) => {
    setDocState((prev) => {
      const newRow: TaxInvoiceItemRow = {
        ...item,
        id: `ROW-${Date.now()}-${prev.items.length + 1}`,
        sNo: prev.items.length + 1,
      };
      return {
        ...prev,
        items: [...prev.items, newRow],
      };
    });
  };

  // Update Item in grid
  const handleUpdateItem = (index: number, updates: Partial<TaxInvoiceItemRow>) => {
    setDocState((prev) => {
      const nextItems = [...prev.items];
      if (nextItems[index]) {
        nextItems[index] = { ...nextItems[index], ...updates };
      }
      return { ...prev, items: nextItems };
    });
  };

  // Delete Item from grid
  const handleDeleteItem = (index: number) => {
    setDocState((prev) => {
      const filtered = prev.items.filter((_, i) => i !== index);
      const renumbered = filtered.map((it, i) => ({ ...it, sNo: i + 1 }));
      return { ...prev, items: renumbered };
    });
  };

  // Calculations
  const metrics = useMemo(() => {
    const totalQty = docState.items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    const salesValue = docState.items.reduce((acc, it) => acc + (Number(it.value) || 0), 0);
    const itemDiscount = docState.items.reduce((acc, it) => acc + (Number(it.discAmt) || 0), 0);
    const billDiscount = 0;
    
    // Tax Calculation
    const totalTax = docState.items.reduce((acc, it) => {
      const taxable = it.total || (it.value - it.discAmt);
      const rate = it.gstRate || 18;
      return acc + (taxable * rate) / 100;
    }, 0);

    const totalAddons = docState.addonsAndDeductions
      .filter((ad) => ad.type === "Addon")
      .reduce((acc, ad) => acc + (Number(ad.amount) || 0), 0);

    const totalDeductions = docState.addonsAndDeductions
      .filter((ad) => ad.type === "Deduction")
      .reduce((acc, ad) => acc + (Number(ad.amount) || 0), 0);

    const netAmount = Math.max(0, salesValue - itemDiscount - billDiscount + totalTax + totalAddons - totalDeductions);

    return {
      itemCount: docState.items.length,
      totalQty,
      salesValue,
      itemDiscount,
      billDiscount,
      totalTax,
      totalAddons,
      totalDeductions,
      netAmount,
    };
  }, [docState.items, docState.addonsAndDeductions]);

  // Customer selection
  const handleSelectCustomer = (cust: any) => {
    setDocState((prev) => ({
      ...prev,
      customerId: cust.id,
      customerCode: cust.code || cust.id,
      customerName: cust.name,
      customerGstin: cust.gstin || cust.gstNumber || "",
      customerMobile: cust.mobile || "",
      customerAddress: cust.address || cust.city || "",
    }));
    setIsCustomerModalOpen(false);
    onNotification?.("Customer Attached", `Selected ${cust.name} for this invoice.`, "info");
  };

  // Save invoice
  const handleSaveInvoice = async () => {
    if (!docState.customerName.trim()) {
      onNotification?.("Customer Required", "Please select or enter a Customer before saving.", "error");
      return;
    }
    if (docState.items.length === 0) {
      onNotification?.("No Items Entered", "Please add at least one line item before saving.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        invoice_no: `${docState.docPrefix}${docState.docNo}`,
        bill_type: docState.billType,
        transaction_mode: docState.transactionMode,
        customer_id: docState.customerId || "CUST-WALK-IN",
        customer_name: docState.customerName,
        customer_gstin: docState.customerGstin,
        items: docState.items.map((it) => ({
          stock_no: it.stockNo,
          description: it.itemDescription,
          rate: it.rate,
          qty: it.qty,
          value: it.value,
          discount_amount: it.discAmt,
          discount_code: it.discCode,
          total: it.total,
          hsn_code: it.hsnCode,
          gst_rate: it.gstRate,
        })),
        sales_value: metrics.salesValue,
        discount_value: metrics.itemDiscount,
        tax_value: metrics.totalTax,
        net_amount: metrics.netAmount,
        remarks: docState.documentRemarks,
        status: "Submitted",
      };

      await apiFetchV1("/sales/invoices", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotification?.(
        "Tax Invoice Generated",
        `Successfully generated and committed Tax Invoice #${docState.docPrefix}${docState.docNo} for ₹${metrics.netAmount.toFixed(2)}.`,
        "success"
      );

      // Advance doc number
      setDocState((prev) => ({
        ...prev,
        docNo: String(Number(prev.docNo) + 1),
        items: [],
      }));
    } catch (err: any) {
      onNotification?.("Save Error", err?.message || "Failed to commit Tax Invoice to PostgreSQL ledger.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setIsCustomerModalOpen(true);
      } else if (e.key === "Escape") {
        if (isCustomerModalOpen) {
          setIsCustomerModalOpen(false);
        } else if (onExit) {
          onExit();
        }
      } else if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSaveInvoice();
      } else if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setDocState((prev) => ({
          ...DEFAULT_DOC_STATE,
          docNo: String(Number(prev.docNo) + 1),
        }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCustomerModalOpen, onExit, handleSaveInvoice]);

  // Export Columns definition
  const exportColumns: ExportColumnDefinition[] = useMemo(
    () => [
      { key: "sNo", header: "S.No", width: 8, alignment: "center", type: "number" },
      { key: "stockNo", header: "Stock No", width: 16, alignment: "left", type: "text" },
      { key: "itemDescription", header: "Item Description", width: 28, alignment: "left", type: "text" },
      { key: "rate", header: "Rate (₹)", width: 12, alignment: "right", type: "currency" },
      { key: "qty", header: "Qty", width: 10, alignment: "right", type: "number" },
      { key: "value", header: "Value (₹)", width: 14, alignment: "right", type: "currency" },
      { key: "discCode", header: "Disc Code", width: 12, alignment: "center", type: "text" },
      { key: "discAmt", header: "Disc Amt (₹)", width: 12, alignment: "right", type: "currency" },
      { key: "total", header: "Total (₹)", width: 16, alignment: "right", type: "currency" },
      { key: "salesStaff", header: "Sales Staff", width: 18, alignment: "left", type: "text" },
    ],
    []
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customersList;
    const q = customerSearchQuery.toLowerCase();
    return customersList.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.mobile?.includes(q) ||
        c.gstin?.toLowerCase().includes(q)
    );
  }, [customerSearchQuery, customersList]);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased overflow-hidden select-none">
      {/* Top Navigation Bar */}
      <TaxInvoiceHeaderToolbar
        onNew={() =>
          setDocState((prev) => ({
            ...DEFAULT_DOC_STATE,
            docNo: String(Number(prev.docNo) + 1),
          }))
        }
        onSave={handleSaveInvoice}
        onDelete={() => {
          setDocState((prev) => ({ ...prev, items: [] }));
          onNotification?.("Draft Cleared", "Cleared all invoice item lines.", "info");
        }}
        onPrint={() => window.print()}
        onFind={() => setIsCustomerModalOpen(true)}
        onExit={onExit || (() => {})}
        isSaving={isSaving}
        exportColumns={exportColumns}
        exportData={docState.items}
        currentUser={currentUser}
      />

      {/* Main Canvas */}
      <div className="flex flex-1 overflow-hidden max-w-container-max-width mx-auto w-full">
        <main className="flex-1 flex flex-col p-stack-gap gap-stack-gap overflow-y-auto">
          {/* HEADER SECTION */}
          <TaxInvoiceDocumentPanel
            docState={docState}
            onChange={handleDocChange}
            onCustomerSearchOpen={() => setIsCustomerModalOpen(true)}
            onAddCustomerOpen={() => setIsCustomerModalOpen(true)}
            onImportClick={() => onNotification?.("Import Active", "Direct import queue ready.", "info")}
            onRecallClick={() => onNotification?.("Recall Active", "Previous invoice recall ready.", "info")}
          />

          {/* DETAIL SECTION (MAIN WORKSPACE) */}
          <section className="flex-1 bg-surface-container-lowest border border-outline-variant rounded flex flex-col overflow-hidden min-h-[300px]">
            <TaxInvoiceItemGrid
              items={docState.items}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
            />
            <TaxInvoiceDirectEntryBar
              onAddItem={handleAddItem}
              onLookupProduct={handleLookupProduct}
            />
          </section>

          {/* FOOTER SECTION */}
          <section className="flex flex-col gap-stack-gap h-64 shrink-0">
            <div className="flex gap-gutter h-full">
              <TaxInvoiceFooterTabs
                transporters={docState.transporterDetails}
                payments={docState.paymentDetails}
                addonsAndDeductions={docState.addonsAndDeductions}
                remarks={docState.documentRemarks}
                onUpdateTransporters={(t) => handleDocChange({ transporterDetails: t })}
                onUpdatePayments={(p) => handleDocChange({ paymentDetails: p })}
                onUpdateAddons={(a) => handleDocChange({ addonsAndDeductions: a })}
                onUpdateRemarks={(r) => handleDocChange({ documentRemarks: r })}
              />
              <TaxInvoiceNetValuesPanel
                salesValue={metrics.salesValue}
                discountValue={metrics.itemDiscount}
                taxValue={metrics.totalTax}
                addonsValue={metrics.totalAddons}
                deductionsValue={metrics.totalDeductions}
                netAmount={metrics.netAmount}
              />
            </div>
            <TaxInvoiceStatusBar
              itemCount={metrics.itemCount}
              totalQty={metrics.totalQty}
              salesValue={metrics.salesValue}
              itemDiscount={metrics.itemDiscount}
              billDiscount={metrics.billDiscount}
              totalTax={metrics.totalTax}
              totalAddons={metrics.totalAddons}
              totalDeductions={metrics.totalDeductions}
              netAmount={metrics.netAmount}
            />
          </section>
        </main>
      </div>

      {/* App Footer / Status line */}
      <footer className="bg-surface-container-highest dark:bg-tertiary border-t border-outline-variant dark:border-outline mt-auto w-full flex justify-between items-center px-margin-page py-2">
        <span className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-tertiary-container">
          Ready... F2: Search | F11: Direct Entry | F6: Discounts | F7/F8: Settlement | F12: Suspend | Ctrl+4: AddOns
        </span>
        <span className="font-label-caps text-label-caps text-primary dark:text-primary-fixed">
          © 2026 smritisys.com
        </span>
      </footer>

      {/* Customer F2 Browse Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-surface-container-high border-b border-outline-variant flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                <h2 className="font-title-sm text-title-sm font-bold text-primary">
                  Customer Master Directory (F2)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 text-on-surface-variant hover:text-error rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-outline-variant bg-surface-container-low">
              <input
                type="text"
                autoFocus
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="Search by customer name, code, mobile, or GSTIN..."
                className="w-full h-10 px-3 border border-outline-variant rounded text-body-md bg-surface-container-lowest text-on-surface focus:border-secondary focus:ring-secondary"
              />
            </div>

            <div className="flex-1 overflow-auto p-2">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="bg-surface-container-high font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant">
                    <th className="p-2">Code</th>
                    <th className="p-2">Customer Name</th>
                    <th className="p-2">Mobile</th>
                    <th className="p-2">GSTIN</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="font-code-md text-code-md">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-on-surface-variant">
                        No customers match your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr
                        key={c.id || c.code}
                        onClick={() => handleSelectCustomer(c)}
                        className="border-b border-outline-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                      >
                        <td className="p-2 font-bold text-primary">{c.code || c.id}</td>
                        <td className="p-2 font-sans">{c.name}</td>
                        <td className="p-2">{c.mobile || "-"}</td>
                        <td className="p-2 text-xs">{c.gstin || "-"}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCustomer(c);
                            }}
                            className="px-2.5 py-1 bg-primary text-on-primary rounded text-xs font-bold hover:bg-secondary transition-colors cursor-pointer"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-surface-container-low border-t border-outline-variant flex justify-between items-center text-body-sm text-on-surface-variant">
              <span>Press <kbd className="bg-surface-variant px-1 rounded">ESC</kbd> to close</span>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-4 py-1.5 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
