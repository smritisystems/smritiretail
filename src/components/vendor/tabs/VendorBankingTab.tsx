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
import { CreditCard, Plus, Trash2, Star, CheckCircle2, ShieldAlert, Building2, Loader2, Lock } from "lucide-react";
import { VendorDetail, VendorBankAccount } from "../../../types/vendor";
import { withCapability } from "../../../types/architecture";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { VendorDeleteConfirmationModal, DeleteItemPayload } from "../VendorDeleteConfirmationModal";

interface VendorBankingTabProps {
  vendor: VendorDetail;
  onUpdateBanks: (banks: VendorBankAccount[]) => void;
  isEditing: boolean;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

const VendorBankingTabBase: React.FC<VendorBankingTabProps> = ({ vendor, onUpdateBanks, isEditing, onNotification }) => {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<{ index: number; payload: DeleteItemPayload } | null>(null);
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

  const handleAdd = async () => {
    if (!isEditing) {
      onNotification?.("View Mode Active", "Click 'Edit Vendor' in the top toolbar to enter Edit Mode before adding bank accounts.", "warning");
      return;
    }
    if (!newBank.bankName || !newBank.accountNumber || !newBank.ifsc) return;
    setSaving(true);
    try {
      const payload = {
        bankName: newBank.bankName.trim(),
        accountHolderName: (newBank.accountHolderName || vendor.legalName).trim(),
        accountNumber: newBank.accountNumber.trim(),
        ifsc: newBank.ifsc.trim().toUpperCase(),
        branch: newBank.branch ? newBank.branch.trim() : null,
        accountType: (newBank.accountType as any) || "CURRENT",
        isPrimary: Boolean(newBank.isPrimary),
        verificationStatus: (newBank.verificationStatus as any) || "VERIFIED",
        verifiedAt: new Date().toISOString(),
      };

      const persisted: any = await apiFetchV1(`/purchase/vendors/${vendor.id}/bank-accounts`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const canonicalItem: VendorBankAccount = {
        id: persisted.id || `pba_${Date.now().toString(36)}`,
        bankName: persisted.bankName || payload.bankName,
        accountHolderName: persisted.accountHolderName || payload.accountHolderName,
        accountNumber: persisted.accountNumber || payload.accountNumber,
        ifsc: persisted.ifsc || payload.ifsc,
        branch: persisted.branch || payload.branch,
        accountType: (persisted.accountType || payload.accountType) as any,
        isPrimary: Boolean(persisted.isPrimary ?? payload.isPrimary),
        verificationStatus: (persisted.verificationStatus || payload.verificationStatus) as any,
        verifiedAt: persisted.verifiedAt || payload.verifiedAt,
      };

      let updated = [...vendor.bankAccounts];
      if (canonicalItem.isPrimary) {
        updated = updated.map((b) => ({ ...b, isPrimary: false }));
      }
      onUpdateBanks([...updated, canonicalItem]);
      onNotification?.("Bank Account Persisted", `Account at ${canonicalItem.bankName} saved to database.`, "success");
      setShowModal(false);
      setNewBank({
        bankName: "",
        accountHolderName: vendor.legalName,
        accountNumber: "",
        ifsc: "",
        branch: "",
        accountType: "CURRENT",
        isPrimary: false,
        verificationStatus: "VERIFIED",
      });
    } catch (err: any) {
      onNotification?.("Save Failed", err?.message || "Failed to persist bank account.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDelete = (index: number) => {
    if (!isEditing) {
      onNotification?.("View Mode Active", "Click 'Edit Vendor' in the top toolbar to enter Edit Mode before deleting records.", "warning");
      return;
    }
    const target = vendor.bankAccounts[index];
    if (!target) return;
    const mask = target.accountNumber ? `•••• ${target.accountNumber.slice(-4)}` : "••••";
    setPendingDeleteItem({
      index,
      payload: {
        entityType: "BANK_ACCOUNT",
        id: target.id || `idx-${index}`,
        title: `${target.bankName} (${mask})`,
        details: [
          { label: "Bank Name", value: target.bankName },
          { label: "Account Holder", value: target.accountHolderName },
          { label: "Account Number", value: target.accountNumber },
          { label: "IFSC Code", value: target.ifsc },
          { label: "Branch", value: target.branch || "Main Branch" },
          { label: "Account Type", value: target.accountType },
          { label: "Primary Payout", value: target.isPrimary },
          { label: "Verification Status", value: target.verificationStatus },
        ],
      },
    });
  };

  const handleConfirmDelete = async (item: DeleteItemPayload) => {
    if (!pendingDeleteItem) return;
    const targetIndex = pendingDeleteItem.index;
    const target = vendor.bankAccounts[targetIndex];
    if (!target) return;

    if (target.id && !target.id.startsWith("vba-")) {
      await apiFetchV1(`/purchase/vendors/${vendor.id}/bank-accounts/${target.id}`, {
        method: "DELETE",
      });
    }

    const updated = vendor.bankAccounts.filter((_, idx) => idx !== targetIndex);
    onUpdateBanks(updated);
    onNotification?.("Bank Account Removed", `Account at '${target.bankName}' deleted permanently. Compliance audit log recorded.`, "success");
    setPendingDeleteItem(null);
  };

  const handleSetPrimary = async (index: number) => {
    if (!isEditing) {
      onNotification?.("View Mode Active", "Click 'Edit Vendor' in the top toolbar to enter Edit Mode before designating primary payout account.", "warning");
      return;
    }
    const target = vendor.bankAccounts[index];
    if (!target) return;
    if (target.id && !target.id.startsWith("vba-")) {
      setActionLoadingId(target.id);
      try {
        await apiFetchV1(`/purchase/vendors/${vendor.id}/bank-accounts`, {
          method: "POST",
          body: JSON.stringify({ ...target, isPrimary: true }),
        });
        onNotification?.("Primary Account Updated", `${target.bankName} account designated as primary.`, "success");
      } catch (err: any) {
        onNotification?.("Update Failed", err?.message || "Could not designate primary account.", "error");
        setActionLoadingId(null);
        return;
      }
      setActionLoadingId(null);
    }
    onUpdateBanks(vendor.bankAccounts.map((b, i) => ({ ...b, isPrimary: i === index })));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Controlled Disbursement Bank Accounts</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Electronic Fund Transfer (NEFT / RTGS / IMPS) disbursement coordinates</p>
        </div>
        {isEditing ? (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus size={14} />
            <span>Add Bank Account</span>
          </button>
        ) : (
          <div 
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-semibold cursor-not-allowed border border-slate-200 dark:border-slate-700 select-none"
            title="Locked in View Mode. Click 'Edit Vendor' in toolbar to add bank accounts."
          >
            <Lock size={13} />
            <span>Add Bank Account (Locked)</span>
          </div>
        )}
      </div>

      {vendor.bankAccounts.length === 0 ? (
        <div className="p-8 rounded-xl bg-white dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
          <CreditCard size={32} className="mx-auto text-slate-400 dark:text-slate-600" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Bank Coordinates Configured</div>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
            Add at least one bank account to enable automatic payment advice and AP payout settlement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendor.bankAccounts.map((bank, idx) => (
            <div
              key={bank.id || idx}
              className={`group p-4 rounded-xl border transition shadow-xs ${
                bank.isPrimary
                  ? "bg-white dark:bg-slate-900/90 border-teal-300 dark:border-teal-500/40 shadow-teal-500/5"
                  : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{bank.bankName}</div>
                    <div className="text-slate-500 dark:text-slate-400 text-xs">{bank.branch ? `Branch: ${bank.branch}` : "Main Branch"}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {bank.isPrimary && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30 flex items-center space-x-1 font-bold">
                      <Star size={10} className="fill-teal-500 text-teal-500" />
                      <span>Primary Payout</span>
                    </span>
                  )}
                  {/* Delete button strictly gated behind Edit Mode and double confirmation */}
                  {isEditing ? (
                    <button
                      onClick={() => handleRequestDelete(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-opacity"
                      title="Remove bank account (Requires Double Confirmation)"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <div className="text-[10px] text-slate-400 flex items-center gap-0.5 opacity-60">
                      <Lock size={10} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Account Holder:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-200">{bank.accountHolderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Account Number:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{bank.accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">IFSC Code:</span>
                  <span className="font-mono text-indigo-700 dark:text-indigo-400 font-semibold">{bank.ifsc}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Account Type:</span>
                  <span className="text-slate-800 dark:text-slate-300">{bank.accountType}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500 dark:text-slate-400">Verification:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center space-x-1 font-semibold">
                    <CheckCircle2 size={12} />
                    <span>Verified</span>
                  </span>
                </div>
              </div>

              {isEditing && !bank.isPrimary && (
                <button
                  onClick={() => handleSetPrimary(idx)}
                  className="mt-3 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold block opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Set as Primary Payout Account
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Add Vendor Bank Account</h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Bank Name *</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank / State Bank of India"
                  value={newBank.bankName}
                  onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Account Holder Name *</label>
                <input
                  type="text"
                  value={newBank.accountHolderName}
                  onChange={(e) => setNewBank({ ...newBank, accountHolderName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Account Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. 50200012345678"
                    value={newBank.accountNumber}
                    onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">IFSC Code (11-char) *</label>
                  <input
                    type="text"
                    maxLength={11}
                    placeholder="HDFC0001234"
                    value={newBank.ifsc}
                    onChange={(e) => setNewBank({ ...newBank, ifsc: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Nariman Point"
                    value={newBank.branch}
                    onChange={(e) => setNewBank({ ...newBank, branch: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Account Type</label>
                  <select
                    value={newBank.accountType}
                    onChange={(e) => setNewBank({ ...newBank, accountType: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
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
                  className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="makePrimary" className="text-slate-700 dark:text-slate-300">Set as Primary Disbursement Account</label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newBank.bankName || !newBank.accountNumber || !newBank.ifsc || saving}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs shadow flex items-center space-x-1.5"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                <span>{saving ? "Saving..." : "Save Bank Account"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Entity Double-Confirmation Deletion Protection Modal */}
      <VendorDeleteConfirmationModal
        isOpen={Boolean(pendingDeleteItem)}
        vendorName={vendor.legalName}
        vendorCode={vendor.code}
        item={pendingDeleteItem?.payload || null}
        onClose={() => setPendingDeleteItem(null)}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
};

export const VendorBankingTab = withCapability(VendorBankingTabBase, {
  entity: "vendor",
  capability: "vendor.banking",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorBankingTab;

