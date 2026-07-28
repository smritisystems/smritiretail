/**
 * Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
 * Component    : Transaction Workspaces Framework (Phase A7)
 * Specification: SDS v1.0, SUXG Governance & WNG-002 Pattern Standard
 * Scope        : Purchase Orders, GRN, Sales Invoices, Stock Transfers, Returns & Stock Adjustments
 */

import React, { useState } from 'react';
import { SEDSListReport } from '../design-system/components/patterns/SEDSListReport';
import { SEDSObjectPage } from '../design-system/components/patterns/SEDSObjectPage';
import { ShoppingCart, PackageCheck, Receipt, ArrowLeftRight, RotateCcw, Sliders, ShieldCheck } from 'lucide-react';
import { SEDSStatusBadge } from '../design-system/components/SEDSStatusBadge';

export type TransactionDomain = 'po' | 'grn' | 'sales' | 'transfer' | 'return' | 'adjustment';

interface TransactionWorkspacesTabProps {
  initialDomain?: TransactionDomain;
}

export const TransactionWorkspacesTab: React.FC<TransactionWorkspacesTabProps> = ({
  initialDomain = 'sales'
}) => {
  const [activeDomain, setActiveDomain] = useState<TransactionDomain>(initialDomain);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  // Mock Transaction Datasets
  const salesData = [
    { id: 'inv-1001', code: 'INV-2026-0001', entity: 'Walk-In Customer (Cash)', date: '2026-07-28', amount: '₹2,948.82', status: 'Posted' },
    { id: 'inv-1002', code: 'INV-2026-0002', entity: 'Delhi Corporate Client Ltd', date: '2026-07-28', amount: '₹45,800.00', status: 'Posted' },
    { id: 'inv-1003', code: 'INV-2026-0003', entity: 'Rajesh Sharma', date: '2026-07-28', amount: '₹1,200.00', status: 'Draft' }
  ];

  const poData = [
    { id: 'po-501', code: 'PO-2026-0089', entity: 'Vardhman Textile Mills Ltd', date: '2026-07-27', amount: '₹1,45,000.00', status: 'Approved' },
    { id: 'po-502', code: 'PO-2026-0090', entity: 'Surat Packaging Solutions', date: '2026-07-28', amount: '₹22,400.00', status: 'Pending' }
  ];

  const grnData = [
    { id: 'grn-801', code: 'GRN-2026-0045', entity: 'Vardhman Textile Mills Ltd', date: '2026-07-28', amount: '₹1,45,000.00', status: 'Completed' }
  ];

  const columns = [
    { key: 'code', title: 'Document Number', width: '150px' },
    { key: 'entity', title: 'Party / Account Name', width: '240px' },
    { key: 'date', title: 'Posting Date', width: '130px' },
    { key: 'amount', title: 'Net Amount', width: '130px' },
    { key: 'status', title: 'Workflow Status', width: '130px' }
  ];

  const domainNav = [
    { id: 'po' as const, label: 'Purchase Orders', icon: ShoppingCart },
    { id: 'grn' as const, label: 'Goods Receipts (GRN)', icon: PackageCheck },
    { id: 'sales' as const, label: 'Sales Invoices', icon: Receipt },
    { id: 'transfer' as const, label: 'Stock Transfers', icon: ArrowLeftRight },
    { id: 'return' as const, label: 'Returns & Exchanges', icon: RotateCcw },
    { id: 'adjustment' as const, label: 'Stock Adjustments', icon: Sliders }
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--sds-color-background)] text-[var(--sds-color-text-main)] font-[var(--sds-font-family)] overflow-hidden">
      {/* Top Transaction Domain Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-[var(--sds-color-surface)] border-b border-[var(--sds-color-border)] shadow-xs">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[var(--sds-color-primary)]" />
          <h1 className="text-lg font-bold tracking-tight">Transaction Workspaces Framework</h1>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {domainNav.map((item) => {
            const Icon = item.icon;
            const active = activeDomain === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveDomain(item.id);
                  setSelectedTxId(null);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-[var(--sds-color-primary)] text-white shadow-xs'
                    : 'bg-[var(--sds-color-background)] border border-[var(--sds-color-border-subtle)] text-[var(--sds-color-text-secondary)] hover:text-[var(--sds-color-text-main)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Body: SEDSListReport or SEDSObjectPage */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedTxId ? (
          <SEDSObjectPage
            title={`${activeDomain.toUpperCase()} Document #${selectedTxId}`}
            subtitle={`Posting Date: 2026-07-28 | Branch: Connaught Place Flagship | User: Cashier`}
            status={{ type: 'Posted', label: 'POSTED & VERIFIED' }}
            onBack={() => setSelectedTxId(null)}
            headerAttributes={[
              { label: 'Document Net Amount', value: '₹2,948.82' },
              { label: 'GST Tax Breakdown', value: '₹449.82 (18%)' },
              { label: 'Payment Method', value: 'CASH' },
              { label: 'Audit Hash', value: 'SHA256: 8f9a2b...' }
            ]}
            tabs={[
              { id: 'lines', label: 'Document Line Items', content: (
                <div className="p-4 bg-[var(--sds-color-background)] rounded-lg text-xs font-mono">
                  1. Cotton Silk Kurta (SKU-DELHI-001) x 1 Qty @ ₹2,499.00 = ₹2,499.00
                </div>
              )},
              { id: 'matching', label: '3-Way Matching & PO Link', content: <div className="p-4 text-xs font-mono">Matched to PO-2026-0089 with 0 variance</div> },
              { id: 'timeline', label: 'Workflow Timeline', content: <div className="p-4 text-xs font-mono">[2026-07-28 19:40:12] CREATED and POSTED by Cashier #01</div> }
            ]}
          />
        ) : (
          <SEDSListReport
            title={`${activeDomain.toUpperCase()} Transaction Registry`}
            subtitle={`Actionable document register and approval ledger for ${activeDomain.toUpperCase()} workflows`}
            data={activeDomain === 'sales' ? salesData : activeDomain === 'po' ? poData : grnData}
            columns={columns}
            rowKey={(r: any) => r.id}
            onRowClick={(row: any) => setSelectedTxId(row.id)}
          />
        )}
      </div>
    </div>
  );
};
