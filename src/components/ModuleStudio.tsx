/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 12.1.0 (SMP-001 v1.0 Baseline Compliant)
 * Created      : 2026-07-21
 * Modified     : 2026-07-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Administrative Module Studio Component
 */

import React, { useEffect, useState } from 'react';
import { capabilityStore, ModuleManifestDTO, CapabilityStoreState } from '../lib/capability_store';

export const ModuleStudio: React.FC = () => {
  const [storeState, setStoreState] = useState<CapabilityStoreState>(capabilityStore.getState());
  const [activeTab, setActiveTab] = useState<'INSTALLED' | 'PROFILES' | 'DIAGNOSTICS'>('INSTALLED');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = capabilityStore.subscribe(() => {
      setStoreState(capabilityStore.getState());
    });
    capabilityStore.fetchCapabilities();
    return () => unsubscribe();
  }, []);

  const handleToggle = async (moduleId: string, currentStatus: string) => {
    setActionError(null);
    try {
      await capabilityStore.toggleModule(moduleId, currentStatus !== 'ENABLED');
    } catch (err: any) {
      setActionError(err.message || 'Toggle action failed');
    }
  };

  const handleProfileSelect = async (profileId: string) => {
    setActionError(null);
    try {
      await capabilityStore.applyProfile(profileId);
    } catch (err: any) {
      setActionError(err.message || 'Failed to apply capability profile');
    }
  };

  const { modules, diagnostics } = storeState;

  const filteredModules = modules.filter(
    (m: ModuleManifestDTO) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b' }}>
      {/* Header & Kernel Diagnostics Bar */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '20px 24px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
              SMRITI Module Studio
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
              SMP-001 v1.0 Specification Baseline & SPK Kernel v12.1.0 Engine
            </p>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
              <strong>Active Modules:</strong> {diagnostics?.active_enabled_modules || 0} / {diagnostics?.total_registered_modules || 0}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
              <strong>RAM Footprint:</strong> {diagnostics?.memory_footprint_mb || 0} MB
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
              <strong>Startup:</strong> {diagnostics?.startup_duration_ms || 0} ms
            </div>
          </div>
        </div>
      </div>

      {actionError && (
        <div
          style={{
            background: '#fef2f2',
            borderLeft: '4px solid #ef4444',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px',
          }}
        >
          <strong>Error:</strong> {actionError}
        </div>
      )}

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('INSTALLED')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: activeTab === 'INSTALLED' ? '3px solid #2563eb' : 'none',
            background: 'none',
            fontWeight: activeTab === 'INSTALLED' ? 700 : 500,
            color: activeTab === 'INSTALLED' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          Installed Modules
        </button>
        <button
          onClick={() => setActiveTab('PROFILES')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: activeTab === 'PROFILES' ? '3px solid #2563eb' : 'none',
            background: 'none',
            fontWeight: activeTab === 'PROFILES' ? 700 : 500,
            color: activeTab === 'PROFILES' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          One-Click Capability Profiles
        </button>
        <button
          onClick={() => setActiveTab('DIAGNOSTICS')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: activeTab === 'DIAGNOSTICS' ? '3px solid #2563eb' : 'none',
            background: 'none',
            fontWeight: activeTab === 'DIAGNOSTICS' ? 700 : 500,
            color: activeTab === 'DIAGNOSTICS' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          SPK Kernel Telemetry & Performance
        </button>
      </div>

      {/* Installed Modules View */}
      {activeTab === 'INSTALLED' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Search by module name or domain category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {filteredModules.map((m: ModuleManifestDTO) => {
              const isEnabled = m.status === 'ENABLED';
              return (
                <div
                  key={m.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    background: isEnabled ? '#ffffff' : '#f8fafc',
                    boxShadow: isEnabled ? '0 2px 10px rgba(0,0,0,0.05)' : 'none',
                    opacity: isEnabled ? 1 : 0.85,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {m.category}
                      </span>
                      <h3 style={{ margin: '8px 0 4px 0', fontSize: '16px', fontWeight: 600 }}>{m.display_name}</h3>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        ID: {m.id} | Tier: {m.license_tier} | v{m.version}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggle(m.id, m.status)}
                      disabled={m.critical}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: m.critical ? 'not-allowed' : 'pointer',
                        background: m.critical ? '#e2e8f0' : isEnabled ? '#ef4444' : '#10b981',
                        color: m.critical ? '#94a3b8' : '#ffffff',
                      }}
                    >
                      {m.critical ? 'Core Critical' : isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Profiles View */}
      {activeTab === 'PROFILES' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {[
            { id: 'RETAIL_LITE', title: 'Retail Lite v1.0', desc: 'Kirana & Footwear: Sales, Purchase, Inventory, POS.' },
            { id: 'ENTERPRISE', title: 'Enterprise Chain v1.0', desc: 'Full Suite: Accounting, CRM, Warehouse, AI.' },
          ].map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '20px',
                background: '#ffffff',
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{p.title}</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>{p.desc}</p>
              <button
                onClick={() => handleProfileSelect(p.id)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Apply Profile
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Telemetry View */}
      {activeTab === 'DIAGNOSTICS' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
          <h2 style={{ marginTop: 0 }}>SPK Kernel Telemetry & Diagnostics</h2>
          <pre style={{ background: '#0f172a', color: '#38bdf8', padding: '16px', borderRadius: '8px', overflowX: 'auto' }}>
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
