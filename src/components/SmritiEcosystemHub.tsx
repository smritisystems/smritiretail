/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 27.0.0
 * Created      : 2026-07-21
 * Modified     : 2026-07-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Digital Platform Ecosystem Hub UI Component
 */

import React, { useState } from 'react';
import { Globe, UserCheck, BookOpen, Grid, Code, Briefcase, MessageSquare, Award, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface PortalItem {
  id: string;
  name: string;
  route: string;
  visibility: 'public' | 'authenticated';
  icon: string;
  description: string;
}

export const SmritiEcosystemHub: React.FC = () => {
  const [selectedTier, setSelectedTier] = useState<'ALL' | 'PUBLIC' | 'AUTHENTICATED'>('ALL');

  const portals: PortalItem[] = [
    {
      id: 'marketing',
      name: 'Public Marketing & Solutions',
      route: '/',
      visibility: 'public',
      icon: 'Globe',
      description: 'Product overview, industry solutions (Pharma, Apparel, FMCG), pricing tiers & live screenshots.'
    },
    {
      id: 'customer',
      name: 'Customer Portal & Licenses',
      route: '/customer',
      visibility: 'authenticated',
      icon: 'UserCheck',
      description: 'Active license keys, version updates, backups, invoices, and support ticket management.'
    },
    {
      id: 'documentation',
      name: 'Live Docs & Knowledge Base',
      route: '/docs',
      visibility: 'public',
      icon: 'BookOpen',
      description: 'Interactive user manuals, API reference, architecture guides, and live release notes.'
    },
    {
      id: 'marketplace',
      name: 'SMRITI Marketplace Hub',
      route: '/marketplace',
      visibility: 'public',
      icon: 'Grid',
      description: 'Third-party extensions, custom print formats, connectors, and vertical industry packs.'
    },
    {
      id: 'developer',
      name: 'Developer Portal & API Sandbox',
      route: '/developer',
      visibility: 'authenticated',
      icon: 'Code',
      description: 'Extension SDK documentation, OpenAPI sandbox, GitHub repository sync, and webhook triggers.'
    },
    {
      id: 'partner',
      name: 'Partner Hub & Certifications',
      route: '/partners',
      visibility: 'authenticated',
      icon: 'Briefcase',
      description: 'Certified partner program, implementation resources, and reseller directory.'
    },
    {
      id: 'community',
      name: 'Community & Feature Roadmap',
      route: '/community',
      visibility: 'public',
      icon: 'MessageSquare',
      description: 'Discussion forums, user feature request voting, ideas portal, and release roadmap.'
    },
    {
      id: 'academy',
      name: 'Learning Academy LMS',
      route: '/academy',
      visibility: 'authenticated',
      icon: 'Award',
      description: 'Interactive onboarding courses, video tutorials, quizzes, and official certifications.'
    }
  ];

  const filteredPortals = portals.filter(p => {
    if (selectedTier === 'PUBLIC') return p.visibility === 'public';
    if (selectedTier === 'AUTHENTICATED') return p.visibility === 'authenticated';
    return true;
  });

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen font-sans">
      {/* Header Banner */}
      <div className="mb-8 border-b border-slate-800 pb-6 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl font-bold tracking-tight text-white">SMRITI Digital Platform</h1>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">
              v27.0.0 Ecosystem Hub
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Unified 8-Portal Operating Environment uniting Prospects, Customers, Partners, and Developers.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setSelectedTier('ALL')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedTier === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            All Portals (8)
          </button>
          <button
            onClick={() => setSelectedTier('PUBLIC')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedTier === 'PUBLIC' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Public Tier (4)
          </button>
          <button
            onClick={() => setSelectedTier('AUTHENTICATED')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedTier === 'AUTHENTICATED' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Authenticated Tier (4)
          </button>
        </div>
      </div>

      {/* Grid of Portals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredPortals.map((portal) => (
          <div
            key={portal.id}
            className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-slate-800 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 group-hover:scale-105 transition-transform">
                  {portal.id === 'marketing' && <Globe className="w-6 h-6" />}
                  {portal.id === 'customer' && <UserCheck className="w-6 h-6" />}
                  {portal.id === 'documentation' && <BookOpen className="w-6 h-6" />}
                  {portal.id === 'marketplace' && <Grid className="w-6 h-6" />}
                  {portal.id === 'developer' && <Code className="w-6 h-6" />}
                  {portal.id === 'partner' && <Briefcase className="w-6 h-6" />}
                  {portal.id === 'community' && <MessageSquare className="w-6 h-6" />}
                  {portal.id === 'academy' && <Award className="w-6 h-6" />}
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${
                  portal.visibility === 'public'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {portal.visibility}
                </span>
              </div>
              <h3 className="font-semibold text-lg text-white mb-2 group-hover:text-indigo-300 transition-colors">{portal.name}</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-4">{portal.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-700/50 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-mono">{portal.route}</span>
              <button className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium">
                Launch <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Platform Status Footer */}
      <div className="mt-12 bg-slate-800/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs text-slate-300">
            SMRITI Platform Foundation Baseline & Unified SSO Authentication Active.
          </span>
        </div>
        <span className="text-xs text-slate-500 font-mono">Status: 100% HEALTHY</span>
      </div>
    </div>
  );
};

export default SmritiEcosystemHub;
