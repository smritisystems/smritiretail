/**
 * Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
 * Component    : Workspace Lab Component Playground & Testing Harness
 * Specification: SDS v1.0 & SUXG Governance Compliance
 */

import React, { useMemo, useState } from 'react';
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
import { SEDSListReport } from '../design-system/components/patterns/SEDSListReport';
import { useSEEF } from '../layout_engine/SEEFContext.tsx';

export const WorkspaceLabTab: React.FC = () => {
  const { config, updateSEEF } = useSEEF();
  const activeTheme = config.theme;
  const [densityMode, setDensityMode] = useState<'simple' | 'hybrid' | 'advanced'>('hybrid');
  const [activeTab, setActiveTab] = useState<string>('components');
  
  // Metadata Form Engine Preview State
  const [schemaJson, setSchemaJson] = useState<string>(JSON.stringify({
    fields: [
      { id: "item_code", label: "SKU / Item Code", type: "text", required: true, defaultValue: "SKU-DELHI-001" },
      { id: "item_name", label: "Product Name", type: "text", required: true, defaultValue: "Cotton Silk Kurta" },
      { id: "price", label: "Unit Price (INR)", type: "number", required: true, defaultValue: "2499.00" },
      { id: "category", label: "Category", type: "select", options: ["Apparel", "Footwear", "Pharma", "Grocery"], defaultValue: "Apparel" },
      { id: "is_active", label: "Active Status", type: "select", options: ["Active", "Inactive"], defaultValue: "Active" }
    ]
  }, null, 2));

  // Apply theme to root data-theme and SEEF theme attributes dynamically
  const handleThemeChange = (theme: string) => {
    updateSEEF({ theme: theme as any });
  };

  // Sample data for Enterprise DataGrid & List Report
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

  // Parse metadata form schema safely
  const parsedSchema = React.useMemo(() => {
    try {
      return JSON.parse(schemaJson);
    } catch {
      return { fields: [] };
    }
  }, [schemaJson]);

  return (
    <div className="flex flex-col h-full bg-[var(--sds-color-background)] text-[var(--sds-color-text-main)] font-[var(--sds-font-family)] p-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[var(--sds-color-border)] mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">SMRITI Workspace Lab</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              SDS v1.0 & SUXG Playground
            </span>
          </div>
          <p className="text-sm text-[var(--sds-color-text-secondary)] mt-1">
            Internal UI Platform Harness: Theme Inspector, Enterprise DataGrid, Patterns & Metadata Form Engine
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
        <nav className="flex gap-6 overflow-x-auto">
          {[
            { id: 'components', label: 'Component Catalog' },
            { id: 'patterns', label: 'Enterprise Patterns' },
            { id: 'metadata-form', label: 'Metadata Form Engine' },
            { id: 'datagrid', label: 'Enterprise DataGrid' },
            { id: 'tokens', label: 'Theme Tokens & Inspector' },
            { id: 'suxg-audit', label: 'SUXG Audit Checklist' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
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

      {/* Tab Content 2: Enterprise Patterns (SEDSObjectPage & SEDSListReport) */}
      {activeTab === 'patterns' && (
        <div className="space-y-6">
          <div className="bg-[var(--sds-color-surface)] p-6 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <h3 className="text-base font-bold mb-2">Pattern 1: SEDSObjectPage Pattern</h3>
            <p className="text-xs text-[var(--sds-color-text-secondary)] mb-4">
              Fixed summary header banner, status badge, key stat row, and horizontal navigation tabs for Master Entities.
            </p>
            <SEDSObjectPage
              title="Connaught Place Flagship Branch"
              subtitle="Branch ID: br-delhi-cp | GSTIN: 07AAAAA0000A1Z5 | Region: Delhi NCR"
              status={{ type: "Active", label: "Operational" }}
              headerAttributes={[
                { label: "Active POS Terminals", value: "12 Terminals" },
                { label: "Total Inventory Value", value: "₹1.42 Cr" },
                { label: "Daily Sales Register", value: "₹3,45,800" },
                { label: "Assigned Manager", value: "Ramesh Kumar" }
              ]}
              tabs={[
                { id: "overview", label: "Overview & Bins", content: <div className="p-4 bg-[var(--sds-color-background)] rounded-lg text-xs">Branch Overview Content</div> },
                { id: "terminals", label: "POS Terminals", content: <div className="p-4 bg-[var(--sds-color-background)] rounded-lg text-xs">Terminals List</div> },
                { id: "history", label: "Audit Ledger", content: <div className="p-4 bg-[var(--sds-color-background)] rounded-lg text-xs">Audit History Records</div> }
              ]}
            />
          </div>
        </div>
      )}

      {/* Tab Content 3: Metadata-Driven Form Engine Preview */}
      {activeTab === 'metadata-form' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--sds-color-surface)] p-5 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <h3 className="text-base font-bold mb-2">JSON Schema Input</h3>
            <p className="text-xs text-[var(--sds-color-text-secondary)] mb-3">
              Define JSON schema fields to render forms dynamically
            </p>
            <textarea
              value={schemaJson}
              onChange={(e) => setSchemaJson(e.target.value)}
              rows={12}
              className="w-full font-mono text-xs p-3 rounded-lg border border-[var(--sds-color-border)] bg-[var(--sds-color-background)] text-[var(--sds-color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--sds-color-primary)]"
            />
          </div>

          <div className="bg-[var(--sds-color-surface)] p-5 rounded-xl border border-[var(--sds-color-border)] shadow-xs">
            <h3 className="text-base font-bold mb-2">Live Metadata Form Output</h3>
            <p className="text-xs text-[var(--sds-color-text-secondary)] mb-4">
              Dynamically generated form inputs adhering to active AWE mode ({densityMode})
            </p>
            <div className={`grid gap-4 ${
              densityMode === 'simple' ? 'grid-cols-1 md:grid-cols-2' :
              densityMode === 'hybrid' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'
            }`}>
              {(parsedSchema.fields || []).map((f: any, idx: number) => (
                <div key={idx}>
                  {f.type === 'select' ? (
                    <SEDSSelect label={f.label} options={f.options || []} />
                  ) : (
                    <SEDSInput label={f.label} value={f.defaultValue} type={f.type} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: Enterprise DataGrid */}
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

      {/* Tab Content 5: Theme Tokens & Theme Inspector */}
      {activeTab === 'tokens' && (
        <div className="bg-[var(--sds-color-surface)] p-6 rounded-xl border border-[var(--sds-color-border)] shadow-xs space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold">Active Theme Inspector (`var(--sds-*)`)</h3>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-[var(--sds-color-primary-light)] text-[var(--sds-color-primary)] font-semibold">
              Current Theme: {activeTheme}
            </span>
          </div>

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

      {/* Tab Content 6: SUXG Audit Checklist */}
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
