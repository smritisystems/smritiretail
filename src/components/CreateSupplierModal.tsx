/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from 'react';
import { X, Building2, Save, CheckCircle2 } from 'lucide-react';
import { apiFetchV1 } from '../lib/apiFetchV1';

interface CreateSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierCreated: () => void;
}

export const CreateSupplierModal: React.FC<CreateSupplierModalProps> = ({
  isOpen,
  onClose,
  onSupplierCreated,
}) => {
  const [formData, setFormData] = useState({
    code: `SUP-${Date.now().toString().slice(-4)}`,
    name: '',
    gst_number: '',
    mobile: '',
    email: '',
    address: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Supplier Name is required');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      id: formData.code.trim().toUpperCase(),
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      gst_number: formData.gst_number.trim() || null,
      mobile: formData.mobile.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      city: formData.city.trim() || null,
      state: formData.state.trim() || null,
      pincode: formData.pincode.trim() || null,
    };

    try {
      await apiFetchV1('/purchase/suppliers/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onSupplierCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create supplier master');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-theme-primary">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-theme-muted hover:text-theme-primary p-1 rounded-lg hover:bg-theme-surface-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-theme-divider pb-4">
          <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-primary font-display">Create Supplier Master</h3>
            <p className="text-xs text-theme-muted">Add new vendor/supplier for procurement and PO issuance.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-theme-muted font-mono font-bold mb-1">Supplier Code *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-theme-muted font-mono font-bold mb-1">Supplier Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Raj Wholesale Traders"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-theme-muted font-mono font-bold mb-1">GSTIN</label>
              <input
                type="text"
                placeholder="27AABCR9981F1Z8"
                value={formData.gst_number}
                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
                className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-theme-muted font-mono font-bold mb-1">Mobile / Phone</label>
              <input
                type="text"
                placeholder="+91 9820098200"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-theme-muted font-mono font-bold mb-1">Email Address</label>
            <input
              type="email"
              placeholder="supplier@vendor.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-theme-muted font-mono font-bold mb-1">Street Address</label>
            <textarea
              rows={2}
              placeholder="Office / Warehouse Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-theme-muted font-mono font-bold mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-theme-muted font-mono font-bold mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-theme-muted font-mono font-bold mb-1">Pincode</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-theme-divider">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-muted font-bold rounded-lg transition-colors border border-theme-divider"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Supplier Master'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
