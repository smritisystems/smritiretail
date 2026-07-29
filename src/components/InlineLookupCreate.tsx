/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.1.0 (SEEF Phase 8 — Token Upgrade)
 * Created      : 2026-07-21
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal Architecture Standard
 */

import React, { useState } from 'react';
import { apiFetchV1 } from '../lib/apiFetchV1';
import { LookupValue } from './LookupPicker';

export interface InlineLookupCreateProps {
  typeCode: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (created: LookupValue) => void;
}

export const InlineLookupCreate: React.FC<InlineLookupCreateProps> = ({
  typeCode,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Both code and name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetchV1<LookupValue>(`/api/v1/master-lookups/values/${typeCode}`, {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          active: true
        })
      });
      if (res) {
        onSuccess(res);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-theme-heading">
            Quick Add Lookup — <span className="text-indigo-400">{typeCode.toUpperCase()}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-theme-muted hover:text-theme-heading text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-theme-muted mb-1">Lookup Code</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 text-sm bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading uppercase focus:outline-none focus:border-indigo-500"
              placeholder="e.g. CARD_AMEX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-muted mb-1">Display Label</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 text-sm bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading focus:outline-none focus:border-indigo-500"
              placeholder="e.g. American Express Card"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-theme-muted hover:text-theme-heading"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !code || !name}
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md"
            >
              {saving ? 'Saving...' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
