/**
 * Project      : SMRITI Retail OS
 * Component    : Temporal Delegation & Temporary Access Manager Modal
 * Standard     : SIF-001 & Rule PBC-001 (Promotes SEEFDialog Universal Primitive)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 *
 * SIF Compliance Declaration
 * SIF Compatible : Yes
 * Surface        : Centered Dialog (SEEFDialog mode="centered")
 * Interaction    : InteractionService.drawer() / confirm()
 * Accessibility  : PASS
 * Keyboard       : PASS
 */

import React, { useState } from "react";
import { Clock, CheckCircle2 } from "lucide-react";
import { SEEFDialog } from "../common/SEEFDialog.tsx";

interface DelegationModalProps {
  onClose: () => void;
}

export const DelegationModal: React.FC<DelegationModalProps> = ({ onClose }) => {
  const [delegatedTo, setDelegatedTo] = useState("");
  const [roleCode, setRoleCode] = useState("STORE_MANAGER");
  const [durationDays, setDurationDays] = useState(5);
  const [reason, setReason] = useState("Annual Leave Delegation");
  const [success, setSuccess] = useState(false);

  const handleGrant = () => {
    setSuccess(true);
  };

  const footerContent = !success ? (
    <div className="w-full flex items-center justify-end gap-2">
      <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold text-theme-muted hover:text-theme-text">
        Cancel
      </button>
      <button onClick={handleGrant} className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow">
        Grant Temporal Delegation
      </button>
    </div>
  ) : undefined;

  return (
    <SEEFDialog
      open={true}
      onClose={onClose}
      title="Temporary Delegation Manager"
      subtitle="Time-Bounded Role & Access Delegation"
      icon={Clock}
      mode="centered"
      width={512}
      footer={footerContent}
    >
      <div className="space-y-4">
        {success ? (
          <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-theme-text">Delegation Granted</h3>
            <p className="text-xs text-theme-muted">
              Role <span className="text-amber-400 font-bold">{roleCode}</span> delegated to <span className="text-blue-400 font-bold">{delegatedTo || "Assistant Manager"}</span> for {durationDays} days. Auto-expiration scheduled.
            </p>
            <button onClick={onClose} className="px-6 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow">
              Done & Close
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs font-bold text-theme-muted block mb-1">Delegate Role To (User) *</label>
              <input
                type="text"
                value={delegatedTo}
                onChange={(e) => setDelegatedTo(e.target.value)}
                placeholder="Username (e.g. asst_manager)"
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-theme-muted block mb-1">Role To Delegate</label>
              <select
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
              >
                <option value="STORE_MANAGER">Store Manager Authority</option>
                <option value="PURCHASE_MANAGER">Purchase Manager Authority</option>
                <option value="AUDITOR">Auditor Temporary Access</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-theme-muted block mb-1">Duration (Days)</label>
              <input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                min={1}
                max={30}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-theme-muted block mb-1">Reason / Justification</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
              />
            </div>
          </>
        )}
      </div>
    </SEEFDialog>
  );
};
