/**
 * Project      : SMRITI Retail OS
 * Module       : Sales Order Form - Premium Edition
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * 
 * Description  : Enterprise-grade Sales Order Form with premium UI/UX
 *                Professional design, smooth interactions, and working lookups
 * 
 * Version      : 3.30.0
 * Created      : 2026-08-31
 * Modified     : 2026-08-31
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Save,
  Plus,
  Trash2,
  FileText,
  User,
  Users,
  Calendar,
  Clock,
  Search,
  Download,
  Upload,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Eye,
  Edit3,
  Printer,
  X,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatQuantity } from "../../utils/formatters";
import { apiFetchV1 } from "../../lib/apiFetchV1";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface SalesOrderItem {
  id: string;
  stockNo: string;
  description: string;
  hsn?: string;
  rate: number;
  quantity: number;
  uom?: string;
  value: number;
  discPercent?: number;
  discAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  total: number;
  salesStaff?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  credit_limit?: number;
  credit_used?: number;
}

export interface StockItem {
  id: string;
  code: string;
  description: string;
  category?: string;
  rate: number;
  onhand?: number;
  hsn?: string;
  uom?: string;
}

export interface SalesOrderFormData {
  docPrefix: string;
  docNumber: string;
  docDate: string;
  docTime: string;
  referenceNo: string;
  deliveryTerms: string;
  paymentTerms: string;
  orderStatus: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  salesStaff: string;
  remarks: string;
  items: SalesOrderItem[];
  totalSalesValue: number;
  totalDiscount: number;
  totalTax: number;
  netAmount: number;
}

interface SalesOrderFormProps {
  initialData?: Partial<SalesOrderFormData>;
  onSubmit?: (data: SalesOrderFormData) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER LOOKUP MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const CustomerLookupModal: React.FC<{
  isOpen: boolean;
  onSelect: (customer: Customer) => void;
  onClose: () => void;
}> = ({ isOpen, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
      loadCustomers();
    }
  }, [isOpen]);

  const loadCustomers = async (query = "") => {
    setLoading(true);
    try {
      const data = await apiFetchV1("/crm/customers", {
        params: query ? { search: query } : {},
      });
      setCustomers(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error("Failed to load customers:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    setSearch(value);
    if (value.length >= 2) {
      await loadCustomers(value);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Customer Lookup (F2)</h2>
              </div>
              <button onClick={onClose} className="text-white hover:bg-blue-800 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by code or name... (minimum 2 characters)"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              ) : customers.length === 0 ? (
                <div className="py-8 px-4 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No customers found. Try a different search.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {customers.map((customer) => (
                    <motion.button
                      key={customer.id}
                      onClick={() => {
                        onSelect(customer);
                        onClose();
                      }}
                      whileHover={{ backgroundColor: "#f0f9ff" }}
                      className="w-full text-left p-4 hover:bg-blue-50 transition flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{customer.name}</div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          {customer.code} • {customer.phone || "—"}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 rotate-[-90deg]" />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK LOOKUP MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const StockLookupModal: React.FC<{
  isOpen: boolean;
  onSelect: (item: StockItem) => void;
  onClose: () => void;
}> = ({ isOpen, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const loadItems = async (query = "") => {
    setLoading(true);
    try {
      const data = await apiFetchV1("/inventory/items", {
        params: query ? { search: query } : {},
      });
      setItems(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error("Failed to load items:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    setSearch(value);
    if (value.length >= 2) {
      await loadItems(value);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Stock Item Lookup (F2)</h2>
              </div>
              <button onClick={onClose} className="text-white hover:bg-emerald-800 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by code or description... (minimum 2 characters)"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="py-8 px-4 text-center text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No items found. Try a different search.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {items.map((item) => (
                    <motion.button
                      key={item.id}
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                      whileHover={{ backgroundColor: "#f0fdf4" }}
                      className="w-full text-left p-4 hover:bg-emerald-50 transition flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{item.code}</div>
                        <div className="text-sm text-slate-600 mt-1">{item.description}</div>
                        <div className="flex gap-4 mt-2 text-xs text-slate-500">
                          <span>Rate: {formatCurrency(item.rate)}</span>
                          {item.onhand !== undefined && <span>On-hand: {formatQuantity(item.onhand)}</span>}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 rotate-[-90deg]" />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT PDT MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const ImportPDTModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onImport: (formData: Partial<SalesOrderFormData>) => void;
}> = ({ isOpen, onClose, onImport }) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileContent = await file.text();
      // Parse JSON or CSV file content
      let importedData: Partial<SalesOrderFormData> = {};
      
      if (file.name.endsWith('.json')) {
        importedData = JSON.parse(fileContent);
      } else if (file.name.endsWith('.csv')) {
        // Basic CSV parsing - would need more robust handling in production
        const lines = fileContent.split('\n');
        // This is a simplified example
        importedData = {
          docPrefix: 'SO',
          items: [],
        };
      }

      onImport(importedData);
      onClose();
    } catch (err) {
      console.error('Failed to import file:', err);
      alert('Failed to import file. Please check the format and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Import Transaction / PDT</h2>
              </div>
              <button onClick={onClose} className="text-white hover:bg-blue-800 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Upload a JSON or CSV file with order details to import a transaction or previous sales order.
              </p>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50/30 transition cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={loading}
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-500 transition" />
                  <div>
                    <p className="font-semibold text-slate-900">Click to upload</p>
                    <p className="text-xs text-slate-500">or drag and drop</p>
                  </div>
                  <p className="text-xs text-slate-400">JSON or CSV files</p>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-semibold text-slate-700 uppercase">Expected format:</p>
                <pre className="text-xs text-slate-600 overflow-auto">
{`{
  "customerCode": "CUST001",
  "customerName": "...",
  "items": [
    {"stockNo": "SKU001", ...}
  ]
}`}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 flex gap-2 justify-end">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-50 inline-flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Select File
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECALL TRANSACTION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const RecallTransactionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onRecall: (formData: Partial<SalesOrderFormData>) => void;
}> = ({ isOpen, onClose, onRecall }) => {
  const [transactions, setTransactions] = useState<Array<{ id: string; docNo: string; date: string; customer: string; amount: number; status: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // Fetch suspended/previous orders from API
      const data = await apiFetchV1("/sales/orders", {
        params: { status: "suspended,draft", limit: 50, sort: "-date" },
      });
      setTransactions(
        Array.isArray(data) ? data.slice(0, 10) : data.data?.slice(0, 10) || []
      );
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRecall = async (transactionId: string) => {
    try {
      const data = await apiFetchV1(`/sales/orders/${transactionId}`);
      if (data) {
        onRecall(data);
        onClose();
      }
    } catch (err) {
      console.error("Failed to recall transaction:", err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Recall Transaction</h2>
              </div>
              <button onClick={onClose} className="text-white hover:bg-slate-900 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 px-6 text-center text-slate-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No suspended or draft orders found.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {transactions.map((txn) => (
                    <motion.button
                      key={txn.id}
                      onClick={() => handleRecall(txn.id)}
                      whileHover={{ backgroundColor: "#f8fafc" }}
                      className="w-full text-left p-4 hover:bg-slate-50 transition flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{txn.docNo}</div>
                        <div className="text-sm text-slate-600 mt-1">
                          <span>{txn.customer}</span>
                          <span className="mx-2">•</span>
                          <span>{txn.date}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{formatCurrency(txn.amount)}</div>
                        <div className="text-xs text-slate-500 mt-1">{txn.status}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 flex gap-2 justify-end bg-slate-50">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-white transition"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM SALES ORDER HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PremiumSalesOrderHeader: React.FC<{
  formData: Partial<SalesOrderFormData>;
  onFieldChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
  onImportClick?: () => void;
  onRecallClick?: () => void;
}> = ({ formData, onFieldChange, errors = {}, onImportClick, onRecallClick }) => {
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const handleCustomerSelect = (customer: Customer) => {
    onFieldChange("customerId", customer.id);
    onFieldChange("customerCode", customer.code);
    onFieldChange("customerName", customer.name);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-lg overflow-hidden"
      >
        {/* Top Action Bar */}
        <div className="px-6 py-4 bg-white/10 backdrop-blur-sm border-b border-white/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white/90 uppercase tracking-wide">Create Sales Order</h2>
              <p className="text-xs text-white/70 mt-0.5">Header Information & Customer Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-white/20 bg-white/10 shadow-inner shadow-white/5">
              <button
                type="button"
                onClick={onImportClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-semibold rounded-l-md bg-sky-600/90 hover:bg-sky-500 text-white transition"
                title="Import transaction or PDT file"
              >
                <Upload className="w-3 h-3" />
                Import
              </button>
              <div className="h-4 w-px bg-white/30" />
              <button
                type="button"
                onClick={onRecallClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-semibold rounded-r-md bg-slate-700/80 hover:bg-slate-600 text-white transition"
                title="Recall previous sales order or suspended transaction"
              >
                <Clock className="w-3 h-3" />
                Recall
              </button>
            </div>
            <Eye className="w-4 h-4 text-white/60" />
            <Edit3 className="w-4 h-4 text-white/60" />
            <Printer className="w-4 h-4 text-white/60" />
          </div>
        </div>

        {/* Main Content - Ultra-Compact 2-Line Layout */}
        <div className="p-2 bg-gradient-to-b from-slate-50 to-white space-y-1.5">
          {/* LINE 1: Document Identification Fields */}
          <div className="flex gap-1.5 items-end">
            {/* Prefix */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Prefix</label>
              <input
                type="text"
                value={formData.docPrefix || "SO"}
                onChange={(e) => onFieldChange("docPrefix", e.target.value.toUpperCase())}
                maxLength={3}
                className="w-12 px-1.5 py-1 border border-slate-300 rounded text-xs font-mono bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Doc Number */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Doc No</label>
              <input
                type="text"
                value={formData.docNumber || "Auto"}
                readOnly
                className="w-20 px-1.5 py-1 border border-slate-300 rounded text-xs font-mono bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>

            {/* Date */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Date</label>
              <input
                type="date"
                value={formData.docDate || new Date().toISOString().split("T")[0]}
                onChange={(e) => onFieldChange("docDate", e.target.value)}
                className="w-24 px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Time */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Time</label>
              <input
                type="time"
                value={formData.docTime || new Date().toTimeString().slice(0, 5)}
                onChange={(e) => onFieldChange("docTime", e.target.value)}
                className="w-20 px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Ref No */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Ref No</label>
              <input
                type="text"
                value={formData.referenceNo || ""}
                onChange={(e) => onFieldChange("referenceNo", e.target.value)}
                placeholder="PO"
                className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Status */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Status</label>
              <select
                value={formData.orderStatus || "Open"}
                onChange={(e) => onFieldChange("orderStatus", e.target.value)}
                className="px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option>Open</option>
                <option>Confirmed</option>
                <option>Closed</option>
              </select>
            </div>
          </div>

          {/* LINE 2: Customer & Terms Fields */}
          <div className="flex gap-1.5 items-end">
            {/* Customer Code with Lookup */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Customer Code</label>
              <div className="flex gap-0.5">
                <input
                  type="text"
                  value={formData.customerCode || ""}
                  onChange={(e) => onFieldChange("customerCode", e.target.value)}
                  placeholder="F2"
                  className={`w-24 px-1.5 py-1 border rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent ${
                    errors.customerCode ? "border-red-500" : "border-slate-300"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="px-1.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition"
                >
                  F2
                </button>
              </div>
            </div>

            {/* Customer Name */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Customer Name</label>
              <input
                type="text"
                value={formData.customerName || ""}
                readOnly
                placeholder="Auto-populated"
                className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs bg-slate-50 text-slate-600 cursor-not-allowed"
              />
            </div>

            {/* Sales Staff */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Staff</label>
              <select
                value={formData.salesStaff || ""}
                onChange={(e) => onFieldChange("salesStaff", e.target.value)}
                className="px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="">--</option>
                <option>Sales Team 1</option>
                <option>Sales Team 2</option>
              </select>
            </div>

            {/* Delivery Terms */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Delivery</label>
              <select
                value={formData.deliveryTerms || "Door Delivery"}
                onChange={(e) => onFieldChange("deliveryTerms", e.target.value)}
                className="px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option>Door Delivery</option>
                <option>Self Pickup</option>
                <option>Courier</option>
              </select>
            </div>

            {/* Payment Terms */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Payment</label>
              <select
                value={formData.paymentTerms || "Net 30"}
                onChange={(e) => onFieldChange("paymentTerms", e.target.value)}
                className="px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option>Net 30</option>
                <option>Net 15</option>
                <option>Cash</option>
              </select>
            </div>

            {/* Remarks */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-[100px]">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Remarks</label>
              <input
                type="text"
                value={formData.remarks || ""}
                onChange={(e) => onFieldChange("remarks", e.target.value)}
                placeholder="Notes..."
                className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </motion.div>

      <CustomerLookupModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSelect={handleCustomerSelect}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM SALES ORDER DETAIL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PremiumSalesOrderDetail: React.FC<{
  items: SalesOrderItem[];
  onItemsChange: (items: SalesOrderItem[]) => void;
}> = ({ items, onItemsChange }) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalCallback, setStockModalCallback] = useState<((item: StockItem) => void) | null>(null);

  const handleAddItem = () => {
    const newItem: SalesOrderItem = {
      id: `item-${Date.now()}`,
      stockNo: "",
      description: "",
      rate: 0,
      quantity: 0,
      value: 0,
      discPercent: 0,
      discAmount: 0,
      taxPercent: 18,
      taxAmount: 0,
      total: 0,
    };
    onItemsChange([...items, newItem]);
    setSelectedItemIndex(items.length);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const item = updated[index] as Record<string, any>;
    item[field] = value;

    if (field === "rate" || field === "quantity") {
      item.value = (item.rate || 0) * (item.quantity || 0);
      item.discAmount = item.discPercent ? (item.value * (item.discPercent || 0)) / 100 : item.discAmount || 0;
      item.taxAmount = ((item.value - (item.discAmount || 0)) * (item.taxPercent || 0)) / 100;
      item.total = item.value - (item.discAmount || 0) + (item.taxAmount || 0);
    }

    if (field === "discPercent") {
      item.discAmount = (item.value * (value || 0)) / 100;
      item.taxAmount = ((item.value - item.discAmount) * (item.taxPercent || 0)) / 100;
      item.total = item.value - item.discAmount + item.taxAmount;
    }

    if (field === "discAmount") {
      item.taxAmount = ((item.value - (item.discAmount || 0)) * (item.taxPercent || 0)) / 100;
      item.total = item.value - (item.discAmount || 0) + (item.taxAmount || 0);
    }

    onItemsChange(updated);
  };

  const handleDeleteItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const handleStockSelect = (stock: StockItem) => {
    if (selectedItemIndex !== null && stockModalCallback) {
      stockModalCallback(stock);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200 mt-3"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Plus className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Item Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">{items.length} item(s) added</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddItem}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </motion.button>
          </div>
        </div>

        {/* Table */}
        {items.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No items added yet</p>
            <p className="text-sm text-slate-400 mt-1">Click "Add Item" to start building your sales order</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-300 sticky top-0">
                <tr className="text-[10px] font-bold text-slate-700 uppercase">
                  <th className="px-2.5 py-2 text-left w-24">Stock No.</th>
                  <th className="px-2.5 py-2 text-left flex-1">Description</th>
                  <th className="px-2.5 py-2 text-right w-20">Rate</th>
                  <th className="px-2.5 py-2 text-right w-20">Qty</th>
                  <th className="px-2.5 py-2 text-right w-20">Value</th>
                  <th className="px-2.5 py-2 text-right w-20">Disc %</th>
                  <th className="px-2.5 py-2 text-right w-20">Tax %</th>
                  <th className="px-2.5 py-2 text-right w-24">Total</th>
                  <th className="px-2.5 py-2 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    onClick={() => setSelectedItemIndex(index)}
                    whileHover={{ backgroundColor: "#f8fafc" }}
                    className={`cursor-pointer transition ${
                      selectedItemIndex === index ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                    }`}
                  >
                    <td className="px-2.5 py-2">
                      <input
                        type="text"
                        value={item.stockNo}
                        onChange={(e) => handleItemChange(index, "stockNo", e.target.value)}
                        onFocus={() => {
                          setSelectedItemIndex(index);
                          setStockModalCallback(() => (stock: StockItem) => {
                            handleItemChange(index, "stockNo", stock.code);
                            handleItemChange(index, "description", stock.description);
                            handleItemChange(index, "rate", stock.rate);
                          });
                          setShowStockModal(true);
                        }}
                        placeholder="F2 or click"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="text-xs font-medium text-slate-900">{item.description || "—"}</div>
                      {item.hsn && <div className="text-[10px] text-slate-500 mt-0.5">HSN: {item.hsn}</div>}
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => handleItemChange(index, "rate", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        step="0.01"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-xs font-semibold text-slate-900">
                      {formatCurrency(item.value || 0)}
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        value={item.discPercent || 0}
                        onChange={(e) => handleItemChange(index, "discPercent", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        step="0.01"
                        max="100"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        value={item.taxPercent || 0}
                        onChange={(e) => handleItemChange(index, "taxPercent", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        step="0.01"
                        max="100"
                      />
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-xs font-bold text-emerald-700 bg-emerald-50 rounded">
                      {formatCurrency(item.total || 0)}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteItem(index)}
                        type="button"
                        className="text-red-500 hover:text-red-700 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <StockLookupModal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        onSelect={handleStockSelect}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM SALES ORDER FOOTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PremiumSalesOrderFooter: React.FC<{
  items: SalesOrderItem[];
}> = ({ items }) => {
  const totalSalesValue = items.reduce((sum, item) => sum + (item.value || 0), 0);
  const totalDiscount = items.reduce((sum, item) => sum + (item.discAmount || 0), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  const netAmount = totalSalesValue - totalDiscount + totalTax;
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-3 bg-gradient-to-r from-blue-50 via-slate-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden shadow-lg"
    >
      <div className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">📊 Order Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Total Items */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
            <div className="text-[10px] font-semibold text-slate-600 uppercase mb-1">Total Items</div>
            <div className="text-xl font-bold text-slate-900">{totalItems}</div>
          </div>

          {/* Total Quantity */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
            <div className="text-[10px] font-semibold text-slate-600 uppercase mb-1">Total Qty</div>
            <div className="text-xl font-bold text-slate-900">{formatQuantity(totalQuantity)}</div>
          </div>

          {/* Sales Value */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
            <div className="text-[10px] font-semibold text-slate-600 uppercase mb-1">Sales Value</div>
            <div className="text-xl font-bold text-blue-600">{formatCurrency(totalSalesValue)}</div>
          </div>

          {/* Discount */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
            <div className="text-[10px] font-semibold text-slate-600 uppercase mb-1">Discount</div>
            <div className="text-xl font-bold text-red-600">-{formatCurrency(totalDiscount)}</div>
          </div>

          {/* Tax */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
            <div className="text-[10px] font-semibold text-slate-600 uppercase mb-1">Total Tax</div>
            <div className="text-xl font-bold text-amber-600">{formatCurrency(totalTax)}</div>
          </div>

          {/* Net Amount */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg p-3 border border-green-300 shadow-md col-span-2 sm:col-span-1">
            <div className="text-[10px] font-semibold text-white/90 uppercase mb-1">Net Amount</div>
            <div className="text-xl font-bold text-white">{formatCurrency(netAmount)}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PREMIUM SALES ORDER FORM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const SalesOrderFormPremium: React.FC<SalesOrderFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  compact = false,
}) => {
  const [formData, setFormData] = useState<Partial<SalesOrderFormData>>({
    docPrefix: "SO",
    docDate: new Date().toISOString().split("T")[0],
    docTime: new Date().toTimeString().slice(0, 5),
    referenceNo: "",
    deliveryTerms: "Door Delivery",
    paymentTerms: "Net 30",
    orderStatus: "Open",
    remarks: "",
    items: [],
    ...initialData,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  }, [errors]);

  const handleItemsChange = useCallback((items: SalesOrderItem[]) => {
    setFormData((prev) => ({
      ...prev,
      items,
    }));
  }, []);

  const handleImport = useCallback((importedData: Partial<SalesOrderFormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...importedData,
      // Preserve certain fields
      docPrefix: prev.docPrefix,
      docDate: new Date().toISOString().split("T")[0],
      docTime: new Date().toTimeString().slice(0, 5),
    }));
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }, []);

  const handleRecall = useCallback((recalledData: Partial<SalesOrderFormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...recalledData,
      // Reset date/time for new entry
      docDate: new Date().toISOString().split("T")[0],
      docTime: new Date().toTimeString().slice(0, 5),
    }));
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.customerCode) newErrors.customerCode = "Customer is required";
    if (!formData.items || formData.items.length === 0) newErrors.items = "At least one item is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      if (onSubmit) {
        await onSubmit(formData as SalesOrderFormData);
      }
      setSuccess(true);
      setTimeout(() => onCancel?.(), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to save sales order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${compact ? "max-w-none mx-0 p-0 bg-slate-900 min-h-screen" : "max-w-7xl mx-auto p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen"}`}>
      {/* Header Section */}
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                <FileText className="w-10 h-10 text-blue-600" />
                Sales Order
              </h1>
              <p className="text-slate-600 mt-2">Create and manage professional sales orders with ease</p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} className="text-right">
              <div className="text-sm font-semibold text-slate-600">Enterprise Edition</div>
              <div className="text-xs text-slate-500 mt-1">v3.30.0</div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>Sales order saved successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Form Container - Professional Sticky Layout */}
      <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        
        {/* STICKY HEADER */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 flex-shrink-0">
          <PremiumSalesOrderHeader
            formData={formData}
            onFieldChange={handleFieldChange}
            errors={errors}
            onImportClick={() => setShowImportModal(true)}
            onRecallClick={() => setShowRecallModal(true)}
          />
        </div>

        {/* SCROLLABLE DETAIL SECTION */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white">
          <PremiumSalesOrderDetail
            items={formData.items || []}
            onItemsChange={handleItemsChange}
          />
        </div>

        {/* STICKY FOOTER */}
        <div className="sticky bottom-0 z-20 bg-white border-t border-slate-200 flex-shrink-0">
          <PremiumSalesOrderFooter items={formData.items || []} />
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-2 justify-end items-center px-4 py-3 bg-slate-50 border-t border-slate-200 flex-shrink-0"
        >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          type="button"
          className="px-4 py-2.5 bg-slate-300 hover:bg-slate-400 text-slate-900 rounded-lg text-sm font-medium transition"
        >
          Cancel
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Sales Order (F7)
            </>
          )}
        </motion.button>
        </motion.div>
      </div>

      {/* Import and Recall Modals */}
      <ImportPDTModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
      <RecallTransactionModal
        isOpen={showRecallModal}
        onClose={() => setShowRecallModal(false)}
        onRecall={handleRecall}
      />
    </div>
  );
};

export default SalesOrderFormPremium;
