/**
 * Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
 * Component    : Operational Workspaces Framework (Phase A6)
 * Specification: SDS v1.0, SUXG Governance & WNG-002 Pattern Standard
 * Scope        : Company, Organization, Branch, Warehouse, Supplier & Customer Workspaces
 */

import React, { useState } from 'react';
import { SEDSListReport } from '../design-system/components/patterns/SEDSListReport';
import { SEDSObjectPage } from '../design-system/components/patterns/SEDSObjectPage';
import { Building2, Network, GitBranch, Warehouse, Truck, Users, ShieldCheck, ArrowLeft } from 'lucide-react';
import { SEDSButton } from '../design-system/components/SEDSButton';

export type OperationalDomain = 'company' | 'organization' | 'branch' | 'warehouse' | 'supplier' | 'customer';

interface OperationalWorkspacesTabProps {
  initialDomain?: OperationalDomain;
}

export const OperationalWorkspacesTab: React.FC<OperationalWorkspacesTabProps> = ({
  initialDomain = 'branch'
}) => {
  const [activeDomain, setActiveDomain] = useState<OperationalDomain>(initialDomain);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Mock Operational Master Records
  const branchesData = [
    { id: 'br-1', code: 'BR-DELHI-CP', name: 'Connaught Place Flagship Store', type: 'RETAIL', city: 'New Delhi', gstin: '07AAAAA0000A1Z5', status: 'Active' },
    { id: 'br-2', code: 'BR-MUMBAI-BKC', name: 'BKC Corporate Branch & Depot', type: 'DEPOT', city: 'Mumbai', gstin: '27AAAAA0000A1Z2', status: 'Active' },
    { id: 'br-3', code: 'BR-BLR-IND', name: 'Indiranagar Experience Hub', type: 'RETAIL', city: 'Bengaluru', gstin: '29AAAAA0000A1Z8', status: 'Active' }
  ];

  const warehousesData = [
    { id: 'wh-1', code: 'WH-DELHI-NORTH', name: 'North India Central Fulfillment Hub', branch: 'Connaught Place', capacity: '45,000 SqFt', status: 'Active' },
    { id: 'wh-2', code: 'WH-BOM-[#01]', name: 'Bhiwandi Regional Logistics Depot', branch: 'BKC Corporate', capacity: '80,000 SqFt', status: 'Active' }
  ];

  const suppliersData = [
    { id: 'sup-1', code: 'SUP-TEXTILE-01', name: 'Vardhman Textile Mills Ltd', category: 'Fabric & Raw Material', city: 'Ludhiana', rating: '4.9 ★', status: 'Active' },
    { id: 'sup-2', code: 'SUP-PACK-02', name: 'Surat Eco Packaging Solutions', category: 'Cartons & Labels', city: 'Surat', rating: '4.6 ★', status: 'Active' }
  ];

  const columns = [
    { key: 'code', title: 'Code / ID', width: '140px' },
    { key: 'name', title: 'Master Entity Name', width: '240px' },
    { key: 'city', title: 'Location / City', width: '140px' },
    { key: 'status', title: 'Status', width: '120px' }
  ];

  const domainNav = [
    { id: 'company' as const, label: 'Company Master', icon: Building2 },
    { id: 'organization' as const, label: 'Organization', icon: Network },
    { id: 'branch' as const, label: 'Branch Master', icon: GitBranch },
    { id: 'warehouse' as const, label: 'Warehouse Hub', icon: Warehouse },
    { id: 'supplier' as const, label: 'Supplier Master', icon: Truck },
    { id: 'customer' as const, label: 'Customer CRM', icon: Users }
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--sds-color-background)] text-[var(--sds-color-text-main)] font-[var(--sds-font-family)] overflow-hidden">
      {/* Top Domain Switcher Navigation Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-[var(--sds-color-surface)] border-b border-[var(--sds-color-border)] shadow-xs">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[var(--sds-color-primary)]" />
          <h1 className="text-lg font-bold tracking-tight">Operational Workspaces Framework</h1>
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
                  setSelectedEntityId(null);
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

      {/* Main Workspace Body: List Report or Object Page View */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedEntityId ? (
          <SEDSObjectPage
            title={activeDomain === 'branch' ? 'Connaught Place Flagship Store' : 'North India Central Fulfillment Hub'}
            subtitle={`Entity ID: ${selectedEntityId} | Domain: ${activeDomain.toUpperCase()}`}
            status={{ type: 'Active', label: 'Operational' }}
            onBack={() => setSelectedEntityId(null)}
            headerAttributes={[
              { label: 'Domain Type', value: activeDomain.toUpperCase() },
              { label: 'Primary Location', value: 'New Delhi' },
              { label: 'GSTIN Registration', value: '07AAAAA0000A1Z5' },
              { label: 'Audit Status', value: 'VERIFIED' }
            ]}
            tabs={[
              { id: 'general', label: 'General Info', content: <div className="p-4 text-xs font-mono">Detailed entity profile for {selectedEntityId}</div> },
              { id: 'sub-entities', label: 'Child Storage Bins', content: <div className="p-4 text-xs font-mono">Storage bin grid & capacities</div> },
              { id: 'audit', label: 'Audit History', content: <div className="p-4 text-xs font-mono">Immutable audit records</div> }
            ]}
          />
        ) : (
          <SEDSListReport
            title={`${activeDomain.toUpperCase()} Master Workspace`}
            subtitle={`Centralized directory and administrative control for ${activeDomain} entities`}
            data={activeDomain === 'branch' ? branchesData : activeDomain === 'warehouse' ? warehousesData : suppliersData}
            columns={columns}
            rowKey={(r: any) => r.id}
            onRowClick={(row: any) => setSelectedEntityId(row.id)}
          />
        )}
      </div>
    </div>
  );
};
