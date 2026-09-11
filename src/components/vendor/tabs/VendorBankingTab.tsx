/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { CreditCard, Plus, Trash2, Star, CheckCircle2, ShieldAlert, Building2 } from "lucide-react";
import { VendorDetail, VendorBankAccount } from "../../../types/vendor";

interface VendorBankingTabProps {
  vendor: VendorDetail;
  onUpdateBanks: (banks: VendorBankAccount[]) => void;
  isEditing: boolean;
}

export const VendorBankingTab: React.FC<VendorBankingTabProps> = ({ vendor, onUpdateBanks, isEditing }) => {
  const [showModal, setShowModal] = useState(false);
  const [newBank, setNewBank] = useState<Partial<VendorBankAccount>>({
    bankName: "",
    accountHolderName: vendor.legalName,
    accountNumber: "",
    ifsc: "",
    branch: "",
    accountType: "CURRENT",
    isPrimary: vendor.bankAccounts.length === 0,
    verificationStatus: "VERIFIED",
  });

  const handleAdd = () => {
    if (!newBank.bankName || !newBank.accountNumber || !newBank.ifsc) return;
    const item: VendorBankAccount = {
      id: `vba-${Date.now().toString(36)}`,
      bankName: newBank.bankName,
      accountHolderName: newBank.accountHolderName || vendor.legalName,
      accountNumber: newBank.accountNumber,
      ifsc: newBank.ifsc.toUpperCase(),
      branch: newBank.branch,
      accountType: newBank.accountType as any || "CURRENT",
      isPrimary: Boolean(newBank.isPrimary),
      verificationStatus: newBank.verificationStatus as any || "PENDING",
      verifiedAt: new Date().toISOString(),
    };

    let updated = [...vendor.bankAccounts];
    if (item.isPrimary) {
      updated = updated.map(b => ({ ...b, isPrimary: false }));
    }
    onUpdateBanks([...updated, item]);
    setShowModal(false);
    setNewBank({
      bankName: "",
      accountHolderName: vendor.legalName,
      accountNumber: "",
      ifsc: "",
      branch: "",
      accountType: "CURRENT",
      isPrimary: false,
      verificationStatus: "PENDING",
    });
  };

  const handleDelete = (index: number) => {
    onUpdateBanks(vendor.bankAccounts.filter((_, i) => i !== index));
  };

  const handleSetPrimary = (index: number) => {
    onUpdateBanks(vendor.bankAccounts.map((b, i) => ({ ...b, isPrimary: i === index })));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Controlled Disbursement Bank Accounts</h3>
          <p className="text-xs text-slate-400">Electronic Fund Transfer (NEFT / RTGS / IMPS) disbursement coordinates</p>
        </div>
        {isEditing && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus size={14} />
            <span>Add Bank Account</span>
          </button>
        )}
      </div>

      {vendor.bankAccounts.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-2">
          <CreditCard size={32} className="mx-auto text-slate-600" />
          <div className="text-sm font-semibold text-slate-300">No Bank Coordinates Configured</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add at least one bank account to enable automatic payment advice and AP payout settlement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendor.bankAccounts.map((bank, idx) => (
            <div
              key={bank.id || idx}
              className={`p-4 rounded-xl border transition ${
                bank.isPrimary
                  ? "bg-slate-900/90 border-teal-500/40 shadow-sm shadow-teal-500/5"
                  : "bg-slate-900/50 border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{bank.bankName}</div>
                    <div className="text-slate-400 text-xs">{bank.branch ? `Branch: ${bank.branch}` : "Main Branch"}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {bank.isPrimary && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center space-x-1 font-bold">
                      <Star size={10} className="fill-teal-300" />
                      <span>Primary Payout</span>
                    </span>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => handleDelete(idx)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 border-t border-slate-800/80 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Holder:</span>
                  <span className="font-medium text-slate-200">{bank.accountHolderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Number:</span>
                  <span className="font-mono font-bold text-slate-100">{bank.accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">IFSC Code:</span>
                  <span className="font-mono text-indigo-400 font-semibold">{bank.ifsc}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Type:</span>
                  <span className="text-slate-300">{bank.accountType}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500">Verification:</span>
                  <span className="text-emerald-400 text-[11px] flex items-center space-x-1">
                    <CheckCircle2 size={12} />
                    <span>Verified</span>
                  </span>
                </div>
              </div>

              {isEditing && !bank.isPrimary && (
                <button
                  onClick={() => handleSetPrimary(idx)}
                  className="mt-3 text-xs text-teal-400 hover:text-teal-300 font-medium block"
                >
                  Set as Primary Payout Account
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-white">Add Vendor Bank Account</h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Bank Name *</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank / State Bank of India"
                  value={newBank.bankName}
                  onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Account Holder Name *</label>
                <input
                  type="text"
                  value={newBank.accountHolderName}
                  onChange={(e) => setNewBank({ ...newBank, accountHolderName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Account Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. 50200012345678"
                    value={newBank.accountNumber}
                    onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">IFSC Code (11-char) *</label>
                  <input
                    type="text"
                    maxLength={11}
                    placeholder="HDFC0001234"
                    value={newBank.ifsc}
                    onChange={(e) => setNewBank({ ...newBank, ifsc: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Nariman Point"
                    value={newBank.branch}
                    onChange={(e) => setNewBank({ ...newBank, branch: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Account Type</label>
                  <select
                    value={newBank.accountType}
                    onChange={(e) => setNewBank({ ...newBank, accountType: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="CURRENT">Current Account</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CC">Cash Credit (CC)</option>
                    <option value="OVERDRAFT">Overdraft (OD)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="makePrimary"
                  checked={newBank.isPrimary}
                  onChange={(e) => setNewBank({ ...newBank, isPrimary: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="makePrimary" className="text-slate-300">Set as Primary Disbursement Account</label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow"
              >
                Save Bank Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
