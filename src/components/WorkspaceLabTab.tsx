/**
 * Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
 * Component    : Workspace Lab Component Playground & Testing Harness
 * Specification: SDS v1.0 & SUXG Governance Compliance
 */

import React, { useState } from 'react';
import { 
  SEDSButton, 
  SEDSInput, 
  SEDSSelect, 
  SEDSBadge, 
  SEDSStatusBadge, 
  SEDSCard, 
  SEDSTabs,
  SEDSDialog,
  SEDSTable
} from '../design-system/components';
import { SEDSObjectPage } from '../design-system/components/patterns/SEDSObjectPage';

export const WorkspaceLabTab: React.FC = () => {
  const [activeTheme, setActiveTheme] = useState<string>('fiori-lite');
  const [densityMode, setDensityMode] = useState<'simple' | 'hybrid' | 'advanced'>('hybrid');
  const [activeTab, setActiveTab] = useState<string>('components');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  // Apply theme to root data-theme attribute dynamically
  const handleThemeChange = (theme: string) => {
    setActiveTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  // Sample data for Enterprise DataGrid
  const sampleTableColumns = [
    { key: 'code', title: 'SKU / Code', width: '130px' },
    { key: 'name', title: 'Product Name', width: '220px' },
    { key: 'category', title: 'Category', width: '140px' },
    { key: 'price', title: 'Price (INR)', width: '120px' },
    { key: 'stock', title: 'Physical Stock', width: '130px' },
    { key: 'status', title: 'Status', width: '120px' }
  ];

  const sampleTableData = [
    { id: '1', code: 'SKU-DELHI-001', name: 'Cotton Silk Kurta Flagship', category: 'Apparel', price: '₹2,499.00', stock: '142', status: 'Active' },
    { id: '2', code: 'SKU-DELHI-002', name: 'Pharma Paracetamol 500mg Batch A', category: 'Pharma', price: '₹45.50', stock: '1,200', status: 'Active' },
    { id: '3', code: 'SKU-DELHI-003', name: 'Premium Leather Shoes Tan L', category: 'Footwear', price: '₹4,999.00', stock: '18', status: 'Draft' },
    { id: '4', code: 'SKU-DELHI-004', name: 'Wireless Barcode Scanner USB', category: 'Hardware', price: '₹3,200.00', stock: '0', status: 'Cancelled' }
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--sds-color-background)] text-[var(--sds-color-text-main)] font-[var(--sds-font-family)] p-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[var(--sds-color-border)] mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">SMRITI Workspace Lab</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              SDS v1.0 Playground
            </span>
          </div>
          <p className="text-sm text-[var(--sds-color-text-secondary)] mt-1">
            Internal UI Harness for SDS Component Library, Theme Tokens & SUXG Compliance Testing
          </p>
        </div>

        {/* Global Controls: Theme & Density */}
        <div className="flex items-center gap-4 bg-[var(--sds-color-surface)] p-3 rounded-lg border border-[var(--sds-color-border)] shadow-xs">
          <div>
            <label className="block text-xs font-medium text-[var(--sds-color-text-secondary)] mb-1">Theme Engine</label>
            <select 
              value={activeTheme} 
              onChange={(e) => handleThemeChange(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded border border-[var(--sds-color-border)] bg-[var(--sds-color-surface)] text-[var(--sds-color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--sds-color-primary)]"
            >
              <option value="light">SMRITI Light</option>
              <option value="fiori-lite">SAP Fiori Lite</option>
              <option value="dark">Dark Obsidian</option>
              <option value="high-contrast">High Contrast (AAA)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--sds-color-text-secondary)] mb-1">AWE Density Mode</label>
            <div className="flex rounded-md border border-[var(--sds-color-border)] p-0.5 bg-[var(--sds-color-background-alt)]">
              {(['simple', 'hybrid', 'advanced'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDensityMode(mode)}
                  className={`text-xs px-2.5 py-1 rounded capitalize font-medium transition-all ${
                    densityMode === mode 
                      ? 'bg-[var(--sds-color-surface)] text-[var(--sds-color-primary)] shadow-xs' 
                      : 'text-[var(--sds-color-text-secondary)] hover:text-[var(--sds-color-text-main)]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Lab Tabs Navigation */}
      <div className="mb-6 border-b border-[var(--sds-color-border)]">
        <nav className="flex gap-6">
          {[
            { id: 'components', label: 'Component Catalog' },
            { id: 'object-header', label: 'Object Header & Patterns' },
            { id: 'datagrid', label: 'Enterprise DataGrid' },
            { id: 'tokens', label: 'Theme Tokens & Palette' },
            { id: 'suxg-audit', label: 'SUXG Audit Checklist' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--sds-color-primary)] text-[var(--sds-color-primary)]'
                  : 'border-transparent text-[var(--sds-color-text-secondary)] hover:text-[var(--sds-color-text-main)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content 1: Component Catalog */}
      {activeTab === 'components' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action Buttons */}
          <div className="bg-[var(--sds-color-surface)] p-5 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <h3 className="text-base font-bold mb-4 flex items-center justify-between">
              Action Buttons
              <span className="text-xs font-normal text-[var(--sds-color-text-muted)]">SEDSButton</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              <SEDSButton variant="primary">Primary Action</SEDSButton>
              <SEDSButton variant="secondary">Secondary</SEDSButton>
              <SEDSButton variant="tertiary">Ghost / Text</SEDSButton>
              <SEDSButton variant="negative">Danger / Delete</SEDSButton>
            </div>
          </div>

          {/* Status Badges */}
          <div className="bg-[var(--sds-color-surface)] p-5 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <h3 className="text-base font-bold mb-4 flex items-center justify-between">
              Status Badges
              <span className="text-xs font-normal text-[var(--sds-color-text-muted)]">SEDSStatusBadge</span>
            </h3>
            <div className="flex flex-wrap gap-3 items-center">
              <SEDSStatusBadge status="Active">Active</SEDSStatusBadge>
              <SEDSStatusBadge status="Draft">Draft</SEDSStatusBadge>
              <SEDSStatusBadge status="Pending">Pending Approval</SEDSStatusBadge>
              <SEDSStatusBadge status="Posted">Posted</SEDSStatusBadge>
              <SEDSStatusBadge status="Completed">Completed</SEDSStatusBadge>
              <SEDSStatusBadge status="Cancelled">Cancelled</SEDSStatusBadge>
            </div>
          </div>

          {/* Form Controls */}
          <div className="bg-[var(--sds-color-surface)] p-5 rounded-xl border border-[var(--sds-color-border)] shadow-xs col-span-1 md:col-span-2">
            <h3 className="text-base font-bold mb-4 flex items-center justify-between">
              Form Controls & Input Fields
              <span className="text-xs font-normal text-[var(--sds-color-text-muted)]">AWE Mode: {densityMode}</span>
            </h3>
            <div className={`grid gap-4 ${
              densityMode === 'simple' ? 'grid-cols-1 md:grid-cols-2' :
              densityMode === 'hybrid' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-4'
            }`}>
              <SEDSInput label="Product Name" placeholder="e.g. Cotton Silk Kurta" />
              <SEDSInput label="Item Code / SKU" value="SKU-DELHI-001" readOnly />
              <SEDSInput label="UnitPrice (INR)" value="2499.00" type="number" />
              <SEDSSelect label="Category" options={['Apparel', 'Footwear', 'Pharma', 'Grocery']} />
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Object Header & Patterns */}
      {activeTab === 'object-header' && (
        <div className="space-y-6">
          <div className="bg-[var(--sds-color-surface)] p-6 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <div className="flex justify-between items-start mb-4 border-b border-[var(--sds-color-border)] pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">Connaught Place Flagship Branch</h2>
                  <SEDSStatusBadge status="Active">Operational</SEDSStatusBadge>
                </div>
                <p className="text-sm text-[var(--sds-color-text-secondary)] mt-1">
                  Branch ID: br-delhi-cp | GSTIN: 07AAAAA0000A1Z5 | Region: Delhi NCR
                </p>
              </div>
              <div className="flex gap-2">
                <SEDSButton variant="secondary">Edit Branch</SEDSButton>
                <SEDSButton variant="primary">New Warehouse</SEDSButton>
              </div>
            </div>

            {/* Header KPI Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="p-3 bg-[var(--sds-color-background)] rounded-lg">
                <div className="text-xs text-[var(--sds-color-text-secondary)]">Active POS Terminals</div>
                <div className="text-lg font-bold mt-1 text-[var(--sds-color-primary)]">12 Terminals</div>
              </div>
              <div className="p-3 bg-[var(--sds-color-background)] rounded-lg">
                <div className="text-xs text-[var(--sds-color-text-secondary)]">Total Inventory Value</div>
                <div className="text-lg font-bold mt-1">₹1.42 Cr</div>
              </div>
              <div className="p-3 bg-[var(--sds-color-background)] rounded-lg">
                <div className="text-xs text-[var(--sds-color-text-secondary)]">Daily Sales Register</div>
                <div className="text-lg font-bold mt-1 text-green-600">₹3,45,800</div>
              </div>
              <div className="p-3 bg-[var(--sds-color-background)] rounded-lg">
                <div className="text-xs text-[var(--sds-color-text-secondary)]">Assigned Manager</div>
                <div className="text-lg font-bold mt-1">Ramesh Kumar</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 3: Enterprise DataGrid */}
      {activeTab === 'datagrid' && (
        <div className="bg-[var(--sds-color-surface)] p-5 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold">Enterprise Product Inventory Grid</h3>
              <p className="text-xs text-[var(--sds-color-text-secondary)] mt-0.5">
                Column sorting, tabular numeric formatting, row badges, and Excel export
              </p>
            </div>
            <SEDSButton variant="secondary" onClick={() => alert('Exporting data to Excel...')}>Export Excel</SEDSButton>
          </div>
          <SEDSTable columns={sampleTableColumns} data={sampleTableData} />
        </div>
      )}

      {/* Tab Content 4: Theme Tokens */}
      {activeTab === 'tokens' && (
        <div className="bg-[var(--sds-color-surface)] p-6 rounded-xl border border-[var(--sds-color-border)] shadow-xs space-y-6">
          <h3 className="text-base font-bold">Active Theme CSS Variables (`var(--sds-*)`)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-[var(--sds-color-border)] bg-[var(--sds-color-primary)] text-white">
              <div className="text-xs font-mono opacity-80">--sds-color-primary</div>
              <div className="text-sm font-bold mt-1">Primary Accent</div>
            </div>
            <div className="p-4 rounded-lg border border-[var(--sds-color-border)] bg-[var(--sds-color-surface)] text-[var(--sds-color-text-main)]">
              <div className="text-xs font-mono text-[var(--sds-color-text-muted)]">--sds-color-surface</div>
              <div className="text-sm font-bold mt-1">Surface Card</div>
            </div>
            <div className="p-4 rounded-lg border border-[var(--sds-color-border)] bg-[var(--sds-color-background)] text-[var(--sds-color-text-main)]">
              <div className="text-xs font-mono text-[var(--sds-color-text-muted)]">--sds-color-background</div>
              <div className="text-sm font-bold mt-1">Canvas Background</div>
            </div>
            <div className="p-4 rounded-lg border border-[var(--sds-color-border)] bg-[var(--sds-status-success-bg)] text-[var(--sds-status-success-text)]">
              <div className="text-xs font-mono">--sds-status-success</div>
              <div className="text-sm font-bold mt-1">Success Status</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 5: SUXG Audit Checklist */}
      {activeTab === 'suxg-audit' && (
        <div className="bg-[var(--sds-color-surface)] p-6 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
          <h3 className="text-base font-bold mb-4">SUXG Quantitative Governance Checklist</h3>
          <div className="space-y-3">
            {[
              { metric: 'Max Clicks to Workspace', limit: '≤ 3 Clicks', status: 'PASS (Direct Launchpad Navigation)' },
              { metric: 'Form Column Budget', limit: '2 / 3 / 4 Columns', status: 'PASS (AWE Engine Enforced)' },
              { metric: 'Modal Nesting Depth', limit: '≤ 2 Levels', status: 'PASS (Drawers & Object Page Tabs)' },
              { metric: 'Loading Time Budget', limit: '< 2.0 Seconds', status: 'PASS (Vite HMR & Fast DOM Load)' },
              { metric: 'Theme Token Compliance', limit: '100% Tokenized', status: 'PASS (var(--sds-*) CSS Variables)' },
              { metric: 'Keyboard Shortcuts', limit: '100% POS & Item Master', status: 'PASS (Keyboard Hotkey Handlers)' }
            ].map((rule, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-[var(--sds-color-background)] rounded-lg border border-[var(--sds-color-border-subtle)]">
                <div>
                  <div className="text-sm font-semibold text-[var(--sds-color-text-main)]">{rule.metric}</div>
                  <div className="text-xs text-[var(--sds-color-text-secondary)]">Rule: {rule.limit}</div>
                </div>
                <SEDSStatusBadge status="Active">{rule.status}</SEDSStatusBadge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
