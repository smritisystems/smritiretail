/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.9
 * Created      : 2026-10-22
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Classic UX Workspace (Traditional, Detailed, Powerful, Advanced Users)
 */

import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../../types.ts';

interface ClassicUxWorkspaceProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNavigateTab?: (tab: string) => void;
  onNotification?: (title: string, message: string, type?: any) => void;
}

interface CartItemRow {
  id: string;
  barcode: string;
  itemCode: string;
  itemName: string;
  size: string;
  color: string;
  qty: number;
  rate: number;
  discPct: number;
  amount: number;
}

export const ClassicUxWorkspace: React.FC<ClassicUxWorkspaceProps> = ({
  products = [],
  currentUser,
  onNavigateTab,
  onNotification,
}) => {
  // Classic top multi-tab state
  const [activeClassicTab, setActiveClassicTab] = useState<'pos' | 'dashboard'>('pos');
  
  // Classic Tree Accordion selection
  const [expandedCategory, setExpandedCategory] = useState<string>('Sales');
  const [selectedSubItem, setSelectedSubItem] = useState<string>('POS Billing');

  // Master Form fields
  const [customer, setCustomer] = useState('Walk-in Customer');
  const [priceList, setPriceList] = useState('Retail Price');
  const [warehouse, setWarehouse] = useState('Main Store');
  const [billDate, setBillDate] = useState('22-10-2026');
  const [billNo, setBillNo] = useState('SI-000126');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [remarks, setRemarks] = useState('');

  // Tabular items matching the visual reference exactly
  const [items, setItems] = useState<CartItemRow[]>([
    {
      id: '1',
      barcode: '8901234567890',
      itemCode: 'SH-001',
      itemName: 'Sports Shoe',
      size: '42',
      color: 'Black',
      qty: 1,
      rate: 1299,
      discPct: 0,
      amount: 1299,
    },
    {
      id: '2',
      barcode: '8901234567891',
      itemCode: 'CH-015',
      itemName: 'Casual Shoe',
      size: '40',
      color: 'Brown',
      qty: 2,
      rate: 999,
      discPct: 5,
      amount: 1898,
    },
    {
      id: '3',
      barcode: '8901234567892',
      itemCode: 'SL-010',
      itemName: 'Slipper',
      size: '9',
      color: 'Blue',
      qty: 1,
      rate: 499,
      discPct: 0,
      amount: 499,
    },
  ]);

  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Totals calculations
  const subTotal = items.reduce((acc, row) => acc + (row.qty * row.rate), 0);
  const totalItemAmounts = items.reduce((acc, row) => acc + row.amount, 0);
  const discount = Math.max(0, subTotal - totalItemAmounts);
  const taxable = subTotal - discount;
  const cgst = Number((taxable * 0.025).toFixed(2));
  const sgst = Number((taxable * 0.025).toFixed(2));
  const grandTotal = Number((taxable + cgst + sgst).toFixed(2));

  // Function Key Hotkey listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleNewBill();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHold();
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleRecall();
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleAddItem();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleApplyDiscount();
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Delete') {
        handleDeleteItem();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedRowIndex]);

  const handleNewBill = () => {
    setBillNo(`SI-${String(Math.floor(Math.random() * 900000) + 100000)}`);
    setItems([]);
    setRemarks('');
    if (onNotification) onNotification('New Bill Started', 'Initialized clean billing voucher.', 'info');
    searchInputRef.current?.focus();
  };

  const handleClear = () => {
    setItems([]);
    if (onNotification) onNotification('Voucher Cleared', 'All grid lines cleared.', 'warning');
  };

  const handleHold = () => {
    if (onNotification) onNotification('Bill Held (F4)', `Voucher ${billNo} held in parked registry.`, 'info');
  };

  const handleRecall = () => {
    if (onNotification) onNotification('Bill Recalled (F5)', 'Loaded held transaction vouchers.', 'info');
  };

  const handleAddItem = () => {
    if (!itemSearchQuery.trim()) {
      searchInputRef.current?.focus();
      return;
    }

    const newItem: CartItemRow = {
      id: String(items.length + 1),
      barcode: `890${Math.floor(Math.random() * 9000000000)}`,
      itemCode: `ITM-${items.length + 1}`,
      itemName: itemSearchQuery.trim(),
      size: 'Standard',
      color: 'Default',
      qty: 1,
      rate: 499,
      discPct: 0,
      amount: 499,
    };

    setItems([...items, newItem]);
    setItemSearchQuery('');
    setSelectedRowIndex(items.length);
    if (onNotification) onNotification('Item Added (F7)', `${newItem.itemName} added to grid.`, 'success');
  };

  const handleDeleteItem = () => {
    if (items.length === 0) return;
    const target = items[selectedRowIndex] || items[items.length - 1];
    setItems(items.filter((_, idx) => idx !== selectedRowIndex));
    setSelectedRowIndex(Math.max(0, selectedRowIndex - 1));
    if (onNotification) onNotification('Item Deleted (Del)', `Removed ${target.itemName}.`, 'info');
  };

  const handleApplyDiscount = () => {
    if (items.length === 0) return;
    const updated = [...items];
    const curr = updated[selectedRowIndex];
    if (curr) {
      curr.discPct = curr.discPct === 0 ? 10 : 0;
      curr.amount = (curr.qty * curr.rate) * (1 - curr.discPct / 100);
      setItems(updated);
      if (onNotification) onNotification('Discount Toggled (F9)', `Discount updated on ${curr.itemName}`, 'info');
    }
  };

  const handleSave = () => {
    if (items.length === 0) {
      if (onNotification) onNotification('Cannot Save', 'Grid is empty. Add items first.', 'warning');
      return;
    }
    if (onNotification) onNotification('Bill Saved (F10)', `Invoice ${billNo} saved successfully in PostgreSQL!`, 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const treeCategories = [
    {
      name: 'Sales',
      icon: 'point_of_sale',
      items: [
        { label: 'POS Billing', tab: 'billing-workspace' },
        { label: 'Sales Invoice', tab: 'sales' },
        { label: 'Sales Return', tab: 'sales' },
        { label: 'Quotation', tab: 'sales' },
        { label: 'Customer', tab: 'customer-master' },
        { label: 'Price List', tab: 'price-revision' },
      ],
    },
    {
      name: 'Purchase',
      icon: 'shopping_bag',
      items: [
        { label: 'Purchase Order', tab: 'purchase' },
        { label: 'Goods Receipt (GRN)', tab: 'grn-studio' },
        { label: 'Vendor Master', tab: 'vendor-360' },
      ],
    },
    {
      name: 'Inventory',
      icon: 'inventory_2',
      items: [
        { label: 'Stock Ledger', tab: 'stock-ledger' },
        { label: 'Barcode Studio', tab: 'barcode' },
        { label: 'Physical Stock', tab: 'stock-ledger' },
      ],
    },
    {
      name: 'Accounts',
      icon: 'account_balance',
      items: [
        { label: 'Business Ledger', tab: 'business-ledger' },
        { label: 'Day Close', tab: 'day-close' },
      ],
    },
    {
      name: 'CRM',
      icon: 'groups',
      items: [
        { label: 'CRM Studio', tab: 'crm' },
        { label: 'Loyalty Studio', tab: 'loyalty' },
      ],
    },
    {
      name: 'Reports',
      icon: 'bar_chart',
      items: [
        { label: 'Report Designer', tab: 'report-designer' },
        { label: 'Visual Reports', tab: 'visual-reports' },
      ],
    },
    {
      name: 'Masters',
      icon: 'storage',
      items: [
        { label: 'Item Master', tab: 'item-master' },
        { label: 'Customer Master', tab: 'customer-master' },
        { label: 'Document Series', tab: 'document-series' },
      ],
    },
    {
      name: 'Tools',
      icon: 'build',
      items: [
        { label: 'Backup & Restore', tab: 'database-manager' },
        { label: 'System Parameters', tab: 'system-parameters' },
      ],
    },
    {
      name: 'Settings',
      icon: 'settings',
      items: [
        { label: 'User Profile', tab: 'user-profile' },
        { label: 'POS Profiles', tab: 'profiles' },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#f1f5f9] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Classic ERP Menu Bar */}
      <div className="bg-[#1e293b] text-slate-200 text-xs px-3 py-1 flex items-center justify-between border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-white tracking-wide flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-sm bg-blue-600 flex items-center justify-center text-[10px] text-white font-mono">S</span>
            SMRITI Retail OS
          </span>
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-300">
            <button type="button" onClick={() => onNavigateTab && onNavigateTab('item-master')} className="hover:text-white hover:underline cursor-pointer">Master</button>
            <button type="button" onClick={() => onNavigateTab && onNavigateTab('billing-workspace')} className="hover:text-white hover:underline cursor-pointer font-semibold text-blue-400">Transactions</button>
            <button type="button" onClick={() => onNavigateTab && onNavigateTab('stock-ledger')} className="hover:text-white hover:underline cursor-pointer">Inventory</button>
            <button type="button" onClick={() => onNavigateTab && onNavigateTab('business-ledger')} className="hover:text-white hover:underline cursor-pointer">Accounts</button>
            <button type="button" onClick={() => onNavigateTab && onNavigateTab('crm')} className="hover:text-white hover:underline cursor-pointer">CRM</button>
            <button type="button" onClick={() => onNavigateTab && onNavigateTab('report-designer')} className="hover:text-white hover:underline cursor-pointer">Reports</button>
            <button type="button" onClick={() => onNavigateTab && onNavigateTab('system-parameters')} className="hover:text-white hover:underline cursor-pointer">Tools</button>
            <button type="button" onClick={() => onNavigateTab && onNavigateTab('profiles')} className="hover:text-white hover:underline cursor-pointer">Settings</button>
            <button type="button" onClick={() => onNavigateTab && onNavigateTab('wiki')} className="hover:text-white hover:underline cursor-pointer">Help</button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <span>PORT: 8000</span>
          <span>•</span>
          <span className="text-emerald-400 font-semibold">FASTAPI POSTGRES</span>
        </div>
      </div>

      {/* Main Workspace Body with Accordion and Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Classic Tree Sidebar */}
        <aside className="w-52 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          {treeCategories.map((cat) => {
            const isCatOpen = expandedCategory === cat.name;
            return (
              <div key={cat.name} className="border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isCatOpen ? '' : cat.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors text-left cursor-pointer ${
                    isCatOpen
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'bg-slate-100/70 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                    <span>{cat.name}</span>
                  </div>
                  <span className="material-symbols-outlined text-[14px]">
                    {isCatOpen ? 'expand_less' : 'chevron_right'}
                  </span>
                </button>
                {isCatOpen && (
                  <div className="bg-slate-50 dark:bg-slate-950/60 py-1 space-y-0.5">
                    {cat.items.map((sub) => {
                      const isSubActive = selectedSubItem === sub.label;
                      return (
                        <button
                          key={sub.label}
                          type="button"
                          onClick={() => {
                            setSelectedSubItem(sub.label);
                            if (sub.tab === 'billing-workspace') {
                              setActiveClassicTab('pos');
                            } else if (onNavigateTab) {
                              onNavigateTab(sub.tab);
                            }
                          }}
                          className={`w-full text-left pl-7 pr-3 py-1.5 text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isSubActive
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-[10px]">›</span>
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        {/* Right Classic Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
          {/* Top Multi-Tab Bar */}
          <div className="bg-slate-100 dark:bg-slate-950 px-2 pt-1 border-b border-slate-300 dark:border-slate-800 flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveClassicTab('dashboard')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeClassicTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 dark:text-blue-400'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">dashboard</span>
              <span>Dashboard</span>
            </button>
            <div
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-md border-t border-x flex items-center gap-2 cursor-pointer ${
                activeClassicTab === 'pos'
                  ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 dark:text-blue-400'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              onClick={() => setActiveClassicTab('pos')}
            >
              <span className="material-symbols-outlined text-[14px]">receipt_long</span>
              <span>POS Billing</span>
              <span className="text-slate-400 hover:text-red-500 text-[12px] font-bold">✕</span>
            </div>
          </div>

          {/* Tab Content Canvas */}
          {activeClassicTab === 'dashboard' ? (
            <div className="flex-1 p-6 overflow-y-auto">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                Classic ERP Operational Overview
              </h2>
              <div className="border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-300 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Metric Module</th>
                      <th className="p-2.5 text-right">Today Count</th>
                      <th className="p-2.5 text-right">Value (INR)</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-sans font-medium">POS Retail Billing</td>
                      <td className="p-2.5 text-right">42</td>
                      <td className="p-2.5 text-right font-bold text-emerald-600">₹ 24,560.00</td>
                      <td className="p-2.5 font-sans"><span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">RECONCILED</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-sans font-medium">Goods Receipt (GRN)</td>
                      <td className="p-2.5 text-right">3</td>
                      <td className="p-2.5 text-right">₹ 1,18,400.00</td>
                      <td className="p-2.5 font-sans"><span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">INSPECTED</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-sans font-medium">Active Inventory SKUs</td>
                      <td className="p-2.5 text-right">128</td>
                      <td className="p-2.5 text-right">₹ 4,82,310.00</td>
                      <td className="p-2.5 font-sans"><span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-bold">NORMAL</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Traditional High-Density POS Billing Screen */
            <div className="flex-1 flex flex-col p-3 overflow-hidden text-xs space-y-2">
              {/* Top Title and Action Toolbar */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">receipt</span>
                  POS Billing
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleNewBill}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    New (F2)
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded font-semibold cursor-pointer transition-colors"
                  >
                    Clear (F3)
                  </button>
                  <button
                    type="button"
                    onClick={handleHold}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded font-semibold cursor-pointer transition-colors"
                  >
                    Hold (F4)
                  </button>
                  <button
                    type="button"
                    onClick={handleRecall}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded font-semibold cursor-pointer transition-colors"
                  >
                    Recall (F5)
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-semibold cursor-pointer"
                  >
                    More ▾
                  </button>
                </div>
              </div>

              {/* Master Form Fields Row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 text-[11px]">
                <div>
                  <label className="block text-slate-500 font-medium mb-0.5">Customer</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-l px-2 py-1 text-slate-900 dark:text-slate-100 font-semibold"
                    />
                    <button type="button" className="bg-slate-200 dark:bg-slate-800 border-y border-r border-slate-300 dark:border-slate-700 px-2 rounded-r hover:bg-slate-300 cursor-pointer">
                      🔍
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-0.5">Price List</label>
                  <select
                    value={priceList}
                    onChange={(e) => setPriceList(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="Retail Price">Retail Price</option>
                    <option value="Wholesale">Wholesale Price</option>
                    <option value="Special MRP">Special MRP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-0.5">Warehouse</label>
                  <select
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="Main Store">Main Store</option>
                    <option value="Central Godown">Central Godown</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-0.5">Bill Date</label>
                  <input
                    type="text"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-0.5">Bill No</label>
                  <input
                    type="text"
                    value={billNo}
                    readOnly
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono font-bold text-blue-700 dark:text-blue-400"
                  />
                </div>
              </div>

              {/* Item Search Row */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="font-bold whitespace-nowrap text-slate-700 dark:text-slate-300">
                  Item Search (Barcode / SKU / Name):
                </span>
                <div className="flex-1 relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
                    placeholder="Scan barcode or type name..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer"
                >
                  Add (F7)
                </button>
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 border border-slate-300 dark:border-slate-700 rounded font-semibold cursor-pointer"
                >
                  Update (F8)
                </button>
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  className="px-2 py-1 bg-red-100 dark:bg-red-950 hover:bg-red-200 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900 rounded font-semibold cursor-pointer"
                >
                  Delete (Del)
                </button>
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 border border-slate-300 dark:border-slate-700 rounded font-semibold cursor-pointer"
                >
                  Discount (F9)
                </button>
              </div>

              {/* Numbered Tabular Grid (8 rows like visual reference) */}
              <div className="flex-1 border border-slate-300 dark:border-slate-700 rounded overflow-auto bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#e2e8f0] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold sticky top-0 border-b border-slate-300 dark:border-slate-700 text-[11px]">
                    <tr>
                      <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 w-8 text-center">#</th>
                      <th className="p-1.5 border-r border-slate-300 dark:border-slate-700">Barcode</th>
                      <th className="p-1.5 border-r border-slate-300 dark:border-slate-700">Item Code</th>
                      <th className="p-1.5 border-r border-slate-300 dark:border-slate-700">Item Name</th>
                      <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-center">Size</th>
                      <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-center">Color</th>
                      <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-center w-12">Qty</th>
                      <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-right">Rate</th>
                      <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-right">Disc %</th>
                      <th className="p-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
                    {items.map((row, index) => {
                      const isSelected = selectedRowIndex === index;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedRowIndex(index)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/70 font-semibold'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 text-center text-slate-500 font-bold">
                            {index + 1}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">
                            {row.barcode}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">
                            {row.itemCode}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 font-sans font-medium text-slate-900 dark:text-slate-100">
                            {row.itemName}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 text-center">
                            {row.size}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 text-center">
                            {row.color}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-bold">
                            {row.qty}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 text-right">
                            {row.rate.toLocaleString('en-IN')}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 text-right">
                            {row.discPct}
                          </td>
                          <td className="p-1.5 text-right font-bold text-slate-900 dark:text-slate-100">
                            {row.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Render empty rows to maintain authentic ERP ledger grid density */}
                    {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="text-slate-300 dark:text-slate-700">
                        <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-bold">
                          {items.length + i + 1}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">&nbsp;</td>
                        <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">&nbsp;</td>
                        <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">&nbsp;</td>
                        <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">&nbsp;</td>
                        <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">&nbsp;</td>
                        <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">&nbsp;</td>
                        <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">&nbsp;</td>
                        <td className="p-1.5 border-r border-slate-200 dark:border-slate-800">&nbsp;</td>
                        <td className="p-1.5">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Panel: Remarks & Ledger Summary */}
              <div className="flex flex-col md:flex-row items-stretch justify-between gap-3 bg-slate-50 dark:bg-slate-950 p-2.5 rounded border border-slate-200 dark:border-slate-800 shrink-0 text-xs">
                {/* Remarks on Left */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Remarks:</span>
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter voucher narration / remarks..."
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-4 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white rounded font-bold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      Save (F10)
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-4 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded font-bold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                      Print (F8)
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab && onNavigateTab('dashboard')}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 border border-slate-300 dark:border-slate-700 rounded font-semibold cursor-pointer transition-colors"
                    >
                      Close (Esc)
                    </button>
                  </div>
                </div>

                {/* Right Calculations Grid */}
                <div className="w-64 bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-700 font-mono space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-sans">Sub Total</span>
                    <span>{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-sans">Discount</span>
                    <span className="text-red-600">-{discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-sans">CGST (2.5%)</span>
                    <span>{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-sans">SGST (2.5%)</span>
                    <span>{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-300 dark:border-slate-700 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
                    <span className="font-sans">Grand Total</span>
                    <span className="text-blue-700 dark:text-blue-400">₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
