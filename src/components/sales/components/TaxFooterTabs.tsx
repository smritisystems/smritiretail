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

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  TransporterDetailEntry,
  PaymentDetailEntry,
  AddonDeductionEntry,
} from "../types.ts";

export interface TaxFooterTabsbsProps {
  transporters: TransporterDetailEntry[];
  payments: PaymentDetailEntry[];
  addonsAndDeductions: AddonDeductionEntry[];
  remarks: string;
  onUpdateTransporters: (transporters: TransporterDetailEntry[]) => void;
  onUpdatePayments: (payments: PaymentDetailEntry[]) => void;
  onUpdateAddons: (addons: AddonDeductionEntry[]) => void;
  onUpdateRemarks: (remarks: string) => void;
}

export const TaxFooterTabs: React.FC<TaxFooterTabsbsProps> = ({
  transporters,
  payments,
  addonsAndDeductions,
  remarks,
  onUpdateTransporters,
  onUpdatePayments,
  onUpdateAddons,
  onUpdateRemarks,
}) => {
  const [activeTab, setActiveTab] = useState<"transporter" | "payment" | "addons">("transporter");

  // Transporter handlers
  const handleAddTransporterRow = () => {
    onUpdateTransporters([
      ...transporters,
      {
        sNo: transporters.length + 1,
        type: "ROAD",
        code: "TRP-01",
        description: "Standard Road Logistics",
        fixedOrVariable: "Fixed",
        rateOrAmt: 0,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const handleUpdateTransporter = (index: number, updates: Partial<TransporterDetailEntry>) => {
    const next = [...transporters];
    if (next[index]) {
      next[index] = { ...next[index], ...updates };
      onUpdateTransporters(next);
    }
  };

  // Payment handlers
  const handleAddPaymentRow = () => {
    onUpdatePayments([
      ...payments,
      {
        mode: "Cash",
        amount: 0,
        referenceNo: "",
        bankName: "SBI Main",
      },
    ]);
  };

  const handleUpdatePayment = (index: number, updates: Partial<PaymentDetailEntry>) => {
    const next = [...payments];
    if (next[index]) {
      next[index] = { ...next[index], ...updates };
      onUpdatePayments(next);
    }
  };

  // AddOn handlers
  const handleAddAddonRow = (type: "Addon" | "Deduction") => {
    onUpdateAddons([
      ...addonsAndDeductions,
      {
        id: `AD-${Date.now().toString().slice(-4)}`,
        type,
        code: type === "Addon" ? "FRG" : "DISC",
        description: type === "Addon" ? "Freight & Logistics" : "Special Trade Discount",
        amount: 0,
      },
    ]);
  };

  const handleUpdateAddon = (index: number, updates: Partial<AddonDeductionEntry>) => {
    const next = [...addonsAndDeductions];
    if (next[index]) {
      next[index] = { ...next[index], ...updates };
      onUpdateAddons(next);
    }
  };

  return (
    <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded flex flex-col">
      {/* Tabs Header */}
      <div className="flex border-b border-outline-variant bg-surface-container-low font-label-caps text-label-caps">
        <button
          type="button"
          onClick={() => setActiveTab("transporter")}
          className={`px-4 py-2 border-r border-outline-variant transition-colors cursor-pointer ${
            activeTab === "transporter"
              ? "bg-surface-container-lowest text-primary font-bold border-t-2 border-t-primary"
              : "text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          Transporter Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("payment")}
          className={`px-4 py-2 border-r border-outline-variant transition-colors cursor-pointer ${
            activeTab === "payment"
              ? "bg-surface-container-lowest text-primary font-bold border-t-2 border-t-primary"
              : "text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          Payment Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("addons")}
          className={`px-4 py-2 border-r border-outline-variant transition-colors cursor-pointer ${
            activeTab === "addons"
              ? "bg-surface-container-lowest text-primary font-bold border-t-2 border-t-primary"
              : "text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          AddOns And Deductions
        </button>
      </div>

      {/* Tab Content Table */}
      <div className="flex-1 p-2 overflow-auto">
        {activeTab === "transporter" && (
          <table className="w-full text-left border border-outline-variant">
            <thead className="bg-surface-container-high border-b border-outline-variant font-label-caps text-label-caps">
              <tr>
                <th className="px-2 py-1 w-10 border-r border-outline-variant">S.No</th>
                <th className="px-2 py-1 border-r border-outline-variant">Type</th>
                <th className="px-2 py-1 border-r border-outline-variant">Code</th>
                <th className="px-2 py-1 border-r border-outline-variant">Description</th>
                <th className="px-2 py-1 border-r border-outline-variant">(Fixed/Variable)</th>
                <th className="px-2 py-1 border-r border-outline-variant text-right">Rate/Amt</th>
                <th className="px-2 py-1 border-r border-outline-variant text-right">Rate</th>
                <th className="px-2 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="font-code-md text-code-md text-on-surface-variant">
              {transporters.length === 0 ? (
                <tr>
                  <td className="px-2 py-1 border-r border-b border-outline-variant text-center bg-surface-container-low">1</td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          onUpdateTransporters([{
                            sNo: 1,
                            type: e.target.value,
                            code: "TRP-01",
                            description: "Road Cargo Transport",
                            fixedOrVariable: "Fixed",
                            rateOrAmt: 100,
                            rate: 100,
                            amount: 100,
                          }]);
                        }
                      }}
                      className="w-full h-6 py-0 px-1 border-outline-variant rounded-sm text-body-sm bg-surface-container-lowest text-on-surface"
                    >
                      <option value="">Select Transport...</option>
                      <option value="ROAD">ROAD</option>
                      <option value="RAIL">RAIL</option>
                      <option value="AIR">AIR</option>
                    </select>
                  </td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant"></td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant"></td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant"></td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant"></td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant"></td>
                  <td className="px-2 py-1 border-b border-outline-variant"></td>
                </tr>
              ) : (
                transporters.map((t, idx) => (
                  <tr key={idx} className="border-b border-outline-variant">
                    <td className="px-2 py-1 border-r border-outline-variant text-center bg-surface-container-low font-bold">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-1 border-r border-outline-variant">{t.type}</td>
                    <td className="px-2 py-1 border-r border-outline-variant">{t.code}</td>
                    <td className="px-2 py-1 border-r border-outline-variant">{t.description}</td>
                    <td className="px-2 py-1 border-r border-outline-variant">{t.fixedOrVariable}</td>
                    <td className="px-2 py-1 border-r border-outline-variant text-right">{t.rateOrAmt}</td>
                    <td className="px-2 py-1 border-r border-outline-variant text-right">{t.rate}</td>
                    <td className="px-2 py-1 text-right font-bold">{t.amount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {activeTab === "payment" && (
          <table className="w-full text-left border border-outline-variant">
            <thead className="bg-surface-container-high border-b border-outline-variant font-label-caps text-label-caps">
              <tr>
                <th className="px-2 py-1 w-10 border-r border-outline-variant">S.No</th>
                <th className="px-2 py-1 border-r border-outline-variant">Payment Mode</th>
                <th className="px-2 py-1 border-r border-outline-variant">Reference No.</th>
                <th className="px-2 py-1 border-r border-outline-variant">Bank / Gateway</th>
                <th className="px-2 py-1 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="font-code-md text-code-md text-on-surface-variant">
              {payments.length === 0 ? (
                <tr>
                  <td className="px-2 py-1 border-r border-b border-outline-variant text-center bg-surface-container-low">1</td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          onUpdatePayments([{
                            mode: e.target.value as any,
                            amount: 0,
                            referenceNo: "REF-001",
                            bankName: "HDFC Settlement",
                          }]);
                        }
                      }}
                      className="w-full h-6 py-0 px-1 border-outline-variant rounded-sm text-body-sm bg-surface-container-lowest text-on-surface"
                    >
                      <option value="">Select Mode...</option>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="Card">Credit/Debit Card</option>
                      <option value="NetBanking">Net Banking</option>
                    </select>
                  </td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant"></td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant"></td>
                  <td className="px-2 py-1 border-b border-outline-variant"></td>
                </tr>
              ) : (
                payments.map((p, idx) => (
                  <tr key={idx} className="border-b border-outline-variant">
                    <td className="px-2 py-1 border-r border-outline-variant text-center bg-surface-container-low font-bold">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-1 border-r border-outline-variant">{p.mode}</td>
                    <td className="px-2 py-1 border-r border-outline-variant">{p.referenceNo || "-"}</td>
                    <td className="px-2 py-1 border-r border-outline-variant">{p.bankName || "-"}</td>
                    <td className="px-2 py-1 text-right font-bold">{p.amount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {activeTab === "addons" && (
          <table className="w-full text-left border border-outline-variant">
            <thead className="bg-surface-container-high border-b border-outline-variant font-label-caps text-label-caps">
              <tr>
                <th className="px-2 py-1 w-10 border-r border-outline-variant">S.No</th>
                <th className="px-2 py-1 border-r border-outline-variant">Type</th>
                <th className="px-2 py-1 border-r border-outline-variant">Code</th>
                <th className="px-2 py-1 border-r border-outline-variant">Description</th>
                <th className="px-2 py-1 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="font-code-md text-code-md text-on-surface-variant">
              {addonsAndDeductions.length === 0 ? (
                <tr>
                  <td className="px-2 py-1 border-r border-b border-outline-variant text-center bg-surface-container-low">1</td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          onUpdateAddons([{
                            id: "AD-01",
                            type: e.target.value as any,
                            code: "CHG-01",
                            description: "Handling Fee",
                            amount: 50,
                          }]);
                        }
                      }}
                      className="w-full h-6 py-0 px-1 border-outline-variant rounded-sm text-body-sm bg-surface-container-lowest text-on-surface"
                    >
                      <option value="">Select Type...</option>
                      <option value="Addon">Addon (+)</option>
                      <option value="Deduction">Deduction (-)</option>
                    </select>
                  </td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant"></td>
                  <td className="px-2 py-1 border-r border-b border-outline-variant"></td>
                  <td className="px-2 py-1 border-b border-outline-variant"></td>
                </tr>
              ) : (
                addonsAndDeductions.map((ad, idx) => (
                  <tr key={idx} className="border-b border-outline-variant">
                    <td className="px-2 py-1 border-r border-outline-variant text-center bg-surface-container-low font-bold">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-1 border-r border-outline-variant">{ad.type}</td>
                    <td className="px-2 py-1 border-r border-outline-variant">{ad.code}</td>
                    <td className="px-2 py-1 border-r border-outline-variant">{ad.description}</td>
                    <td className="px-2 py-1 text-right font-bold">{ad.amount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Document Remarks */}
      <div className="p-2 border-t border-outline-variant bg-surface-container-low">
        <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 block">
          Document Remarks
        </label>
        <input
          type="text"
          value={remarks}
          onChange={(e) => onUpdateRemarks(e.target.value)}
          placeholder="Enter remarks or dispatch instructions..."
          className="w-full border-outline-variant rounded h-8 text-body-sm focus:border-secondary focus:ring-secondary px-2 bg-surface-container-lowest text-on-surface"
        />
      </div>
    </div>
  );
};
