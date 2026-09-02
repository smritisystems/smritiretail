/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.10.1
 * Created      : 2026-08-24
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { Download, History, Search } from "lucide-react";
import { TaxInvoiceDocumentState } from "../types.ts";

export interface TaxInvoiceDocumentPanelProps {
  docState: TaxInvoiceDocumentState;
  onChange: (updates: Partial<TaxInvoiceDocumentState>) => void;
  onCustomerSearchOpen: () => void;
  onAddCustomerOpen: () => void;
  onImportClick: () => void;
  onRecallClick: () => void;
  staffList?: { id: string; name: string }[];
}

export const TaxInvoiceDoc: React.FC<TaxInvoiceDocumentPanelProps> = ({
  docState,
  onChange,
  onCustomerSearchOpen,
  onAddCustomerOpen,
  onImportClick,
  onRecallClick,
  staffList = [
    { id: "EMP001", name: "EMP001 - Jawahar Mallah" },
    { id: "EMP002", name: "EMP002 - John Doe" },
    { id: "EMP003", name: "EMP003 - Jane Smith" },
  ],
}) => {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded p-stack-gap flex flex-col gap-stack-gap">
      {/* Row 1: Bill Type, Transaction, Doc Prefix, Doc No, Import, Recall */}
      <div className="flex flex-wrap items-end gap-gutter">
        <div className="flex flex-col gap-unit w-48">
          <label className="font-label-caps text-label-caps text-on-surface-variant">Bill Type</label>
          <select
            value={docState.billType}
            onChange={(e) => onChange({ billType: e.target.value as any })}
            className="border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 px-2 bg-surface-container-lowest text-on-surface"
          >
            <option value="Product">Product</option>
            <option value="Service">Service</option>
            <option value="Tax Invoice">Tax Invoice</option>
            <option value="Bill of Supply">Bill of Supply</option>
          </select>
        </div>

        <div className="flex flex-col gap-unit w-48">
          <label className="font-label-caps text-label-caps text-on-surface-variant">Transaction</label>
          <select
            value={docState.transactionMode}
            onChange={(e) => onChange({ transactionMode: e.target.value as any })}
            className="border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 px-2 bg-surface-container-lowest text-on-surface"
          >
            <option value="Credit">Credit</option>
            <option value="Cash">Cash</option>
            <option value="Interstate Sale">Interstate Sale (IGST)</option>
          </select>
        </div>

        <div className="flex flex-col gap-unit w-32">
          <label className="font-label-caps text-label-caps text-on-surface-variant">Doc Prefix</label>
          <input
            className="bg-surface-container-low border-outline-variant text-body-md font-code-md text-on-surface-variant rounded h-9 px-2 cursor-not-allowed"
            readOnly
            type="text"
            value={docState.docPrefix || "D1DS13"}
          />
        </div>

        <div className="flex flex-col gap-unit w-32">
          <label className="font-label-caps text-label-caps text-on-surface-variant">Doc No.</label>
          <input
            className="bg-surface-container-low border-outline-variant text-body-md font-code-md text-on-surface-variant rounded h-9 px-2 cursor-not-allowed"
            readOnly
            type="text"
            value={docState.docNo || "1"}
          />
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={onImportClick}
            className="h-9 px-4 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-title-sm transition-colors flex items-center gap-2 cursor-pointer active:opacity-80"
          >
            <Download className="w-4 h-4" />
            Import
          </button>
          <button
            type="button"
            onClick={onRecallClick}
            className="h-9 px-4 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-title-sm transition-colors flex items-center gap-2 cursor-pointer active:opacity-80"
          >
            <History className="w-4 h-4" />
            Recall
          </button>
        </div>
      </div>

      {/* Row 2: Customer, Customer Name Display, Add, Sales Staff */}
      <div className="flex flex-wrap items-end gap-gutter">
        <div className="flex flex-col gap-unit flex-1">
          <label className="font-label-caps text-label-caps text-on-surface-variant">
            Customer <span className="text-error">*</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="dist-customer-search"
                name="customerSearch"
                aria-label="Customer Search — F2 to browse, Enter to open search modal"
                data-f2-entity="customer"
                className="w-full border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 pl-9 pr-2 bg-surface-container-lowest text-on-surface"
                placeholder="Search customer (F2)"
                type="text"
                value={docState.customerCode || ""}
                onChange={(e) => onChange({ customerCode: e.target.value })}
                onKeyDown={(e) => {
                  // F2 is handled by F2DispatcherProvider via data-f2-entity="customer".
                  // Only Enter opens the manual search modal (non-F2 path preserved).
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onCustomerSearchOpen();
                  }
                }}
              />
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 cursor-pointer"
                onClick={onCustomerSearchOpen}
              />
            </div>
            <input
              className="flex-1 bg-surface-container-low border-outline-variant text-body-md text-on-surface-variant rounded h-9 px-3"
              placeholder="Customer Name Display"
              readOnly
              type="text"
              value={docState.customerName || ""}
            />
            <button
              type="button"
              onClick={onAddCustomerOpen}
              className="h-9 px-3 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded font-title-sm text-title-sm transition-colors cursor-pointer active:opacity-80"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-unit w-64">
          <label className="font-label-caps text-label-caps text-on-surface-variant">Sales Staff</label>
          <select
            value={docState.salesStaff}
            onChange={(e) => onChange({ salesStaff: e.target.value })}
            className="border-outline-variant text-body-md focus:border-secondary focus:ring-secondary rounded h-9 px-2 bg-surface-container-lowest text-on-surface"
          >
            <option value="">Select Staff...</option>
            {staffList.map((st) => (
              <option key={st.id} value={st.name}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};
