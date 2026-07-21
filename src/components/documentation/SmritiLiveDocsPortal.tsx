/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 29.0.0
 * Created      : 2026-07-22
 * Modified     : 2026-07-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Live Documentation Portal Master UI Component
 */

import React, { useState } from 'react';
import { BookOpen, Search, Shield, PlayCircle, Settings, Code, Terminal, Layers, GitCommit, HelpCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import { ArticleViewer } from './ArticleViewer';
import { ApiReferenceSandbox } from './ApiReferenceSandbox';
import { ReleaseNotesTimeline } from './ReleaseNotesTimeline';

export const SmritiLiveDocsPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ARTICLES' | 'API_SANDBOX' | 'RELEASE_NOTES'>('ARTICLES');
  const [selectedCategory, setSelectedCategory] = useState<string>('GOVERNANCE');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('29.0.0');

  const categories = [
    { id: 'GETTING_STARTED', name: 'Getting Started', icon: PlayCircle },
    { id: 'USER_GUIDE', name: 'User Manuals & POS', icon: BookOpen },
    { id: 'ADMIN_GUIDE', name: 'Admin Guide & Setup', icon: Settings },
    { id: 'DEVELOPER_GUIDE', name: 'Developer Guide & SDK', icon: Code },
    { id: 'ARCHITECTURE', name: 'PAR-001 Architecture', icon: Layers },
    { id: 'GOVERNANCE', name: 'Governance Standards', icon: Shield },
    { id: 'TROUBLESHOOTING', name: 'Troubleshooting & FAQs', icon: HelpCircle }
  ];

  const articlesData = {
    'dpf-001': {
      id: 'dpf-001',
      category: 'GOVERNANCE',
      title: 'DPF-001 — Digital Platform Framework',
      summary: 'Governs the 3-Tier Digital Platform Architecture, Portal Topology, Shared Platform Services, and Portal Lifecycle.',
      content: `# DPF-001 — SMRITI Digital Platform Framework\n\nEstablishes top-level digital platform governance sitting above individual portal implementations.\n\n3-Tier Architecture:\n1. Public Website Tier (Marketing & Solutions)\n2. Portal Platform Tier (Customer Workspace, Academy, Documentation, Marketplace)\n3. Retail OS Core Tier (Sales, POS, WMS, Accounting, AI, UDMS)\n\nShared Platform Services:\n- Portal Registry (portal_registry.py)\n- Identity Platform (SIP-001 SSO)\n- Customer Workspace Engine\n- SMRITI Academy LMS Engine\n- Platform Notification Engine\n- Global Unified Search Engine`,
      version: selectedVersion,
      author: 'Jawahar Ramkripal Mallah',
      last_updated: '2026-07-22',
      tags: ['governance', 'architecture', 'dpf-001']
    },
    'sip-001': {
      id: 'sip-001',
      category: 'GOVERNANCE',
      title: 'SIP-001 — SMRITI Identity Platform Standard',
      summary: 'Unified OAuth2 / JWT Single Sign-On, Tenant Context Isolation, and Role-Based Access Control.',
      content: `# SIP-001 — Identity Platform Standard\n\nDefines SSO authentication and portal permissions across all 8 SMRITI portals.\n\nKey Core Pillars:\n- OAuth2 / JWT Token format with sub, tenant_id, and portal_permissions\n- Access Control: <portal>.<action> checks (e.g. academy.read, customer.licenses.manage)\n- Multi-Tenant Isolation: TenantContext payload prevents cross-tenant data leaks\n- Portal Manifest Validation: Minimum Foundation v1.0, Minimum Kernel v12.1.0`,
      version: selectedVersion,
      author: 'Jawahar Ramkripal Mallah',
      last_updated: '2026-07-22',
      tags: ['identity', 'sso', 'security', 'sip-001']
    }
  };

  const [activeArticleId, setActiveArticleId] = useState<string>('dpf-001');

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <a href="/" className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">SMRITI Live Docs</span>
            <span className="text-xs text-indigo-400 font-semibold ml-1.5 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              v29.0.0
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search docs, APIs, governance standards (powered by Global Search)..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Version Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Version:</span>
          <select
            value={selectedVersion}
            onChange={e => setSelectedVersion(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-indigo-300 font-bold rounded-lg px-3 py-1.5 focus:outline-none"
          >
            <option value="29.0.0">v29.0.0 (Latest)</option>
            <option value="28.0.0">v28.0.0</option>
            <option value="27.0.0">v27.0.0</option>
          </select>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Top Mode Tabs */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex">
            <button
              onClick={() => setActiveTab('ARTICLES')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'ARTICLES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Docs
            </button>
            <button
              onClick={() => setActiveTab('API_SANDBOX')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'API_SANDBOX' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              API Sandbox
            </button>
            <button
              onClick={() => setActiveTab('RELEASE_NOTES')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'RELEASE_NOTES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Changelog
            </button>
          </div>

          {/* Categories Navigation Tree */}
          {activeTab === 'ARTICLES' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">Collections</span>
              {categories.map((cat) => {
                const IconComp = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                      isSelected ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComp className="w-4 h-4 text-indigo-400" />
                      <span>{cat.name}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Main Content Pane */}
        <div className="lg:col-span-3">
          {activeTab === 'ARTICLES' && (
            <div className="space-y-6">
              {/* Category Article Switcher */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveArticleId('dpf-001')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${activeArticleId === 'dpf-001' ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}
                >
                  DPF-001 Architecture Framework
                </button>
                <button
                  onClick={() => setActiveArticleId('sip-001')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${activeArticleId === 'sip-001' ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}
                >
                  SIP-001 Identity Standard
                </button>
              </div>

              <ArticleViewer article={articlesData[activeArticleId as keyof typeof articlesData]} />
            </div>
          )}

          {activeTab === 'API_SANDBOX' && <ApiReferenceSandbox />}

          {activeTab === 'RELEASE_NOTES' && <ReleaseNotesTimeline />}
        </div>
      </div>
    </div>
  );
};

export default SmritiLiveDocsPortal;
