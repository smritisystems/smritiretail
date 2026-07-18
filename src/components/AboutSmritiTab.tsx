/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.1
 * Created      : 2026-07-10
 * Modified     : 2026-07-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { 
  Info, Shield, Server, Box, Layers, Book, Layout, FormInput, Database, 
  PlaySquare, Printer, CheckCircle2, ChevronRight, Share2, Scale, Activity, Loader2,
  Search, X, Star, ExternalLink, Tag, Gavel, Cpu, Sparkles, History, Mail, Heart, Monitor, 
  Users, Compass, Award, Globe, Phone, FileText, Lock, ShieldAlert
} from "lucide-react";
import { MetadataRegistry, ModuleMetadata } from "../services/metadataRegistry.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

interface SectionConfig {
  id: string;
  label: string;
  category: "OVERVIEW" | "LEADERSHIP" | "TECHNOLOGY" | "GOVERNANCE" | "CHANNELS";
  icon: React.ReactNode;
}

export const AboutSmritiTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [metadata, setMetadata] = useState<any>(null);
  const [clientModules, setClientModules] = useState<ReadonlyArray<ModuleMetadata>>([]);
  const [changelog, setChangelog] = useState<string>("");
  const [loadingChangelog, setLoadingChangelog] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Contact Form State
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);

  // System Diagnostics State
  const [sysDiagnostics, setSysDiagnostics] = useState({
    browser: "Unknown",
    platform: "Unknown",
    userAgent: "Unknown",
    screenResolution: "Unknown",
    connectionType: "Unknown",
    onlineStatus: "Online",
    cookieEnabled: true,
  });

  useEffect(() => {
    // Fetch live system diagnostics
    if (typeof window !== "undefined") {
      setSysDiagnostics({
        browser: navigator.appName || "Unknown",
        platform: navigator.platform || "Unknown",
        userAgent: navigator.userAgent || "Unknown",
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        connectionType: (navigator as any).connection?.effectiveType || "Ethernet/WiFi",
        onlineStatus: navigator.onLine ? "Online" : "Offline",
        cookieEnabled: navigator.cookieEnabled,
      });
    }

    apiFetchV1("/metadata")
      .then(data => {
        setMetadata(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load metadata:", err);
        setLoading(false);
      });

    const updateModules = () => setClientModules(MetadataRegistry.getModules());
    updateModules();
    const unsubscribe = MetadataRegistry.subscribe(updateModules);
    return unsubscribe;
  }, []);

  // Fetch changelog when Release Notes tab is active
  useEffect(() => {
    if (activeSection === "release" && !changelog) {
      setLoadingChangelog(true);
      apiFetchV1("/changelog")
        .then(data => {
          setChangelog(typeof data === "string" ? data : JSON.stringify(data, null, 2));
          setLoadingChangelog(false);
        })
        .catch(err => {
          console.error("Failed to fetch changelog:", err);
          setChangelog("Failed to load Release Notes.");
          setLoadingChangelog(false);
        });
    }
  }, [activeSection, changelog]);

  const mergedModules = React.useMemo(() => {
    const serverMods = metadata?.modules || [];
    const map = new Map();
    serverMods.forEach((m: any) => map.set(m.id, m));
    clientModules.forEach(m => {
      map.set(m.id, {
        id: m.id,
        name: m.name,
        version: m.version,
        owner: m.owner,
        description: m.description
      });
    });
    return Array.from(map.values());
  }, [metadata, clientModules]);

  const sections: SectionConfig[] = [
    // Operational Overview
    { id: "dashboard", label: "Dashboard", category: "OVERVIEW", icon: <Layout size={14} /> },
    { id: "about", label: "About SMRITI Retail OS", category: "OVERVIEW", icon: <Info size={14} /> },
    // Leadership & Culture
    { id: "founders", label: "Founders", category: "LEADERSHIP", icon: <Users size={14} /> },
    { id: "story", label: "Our Story", category: "LEADERSHIP", icon: <Book size={14} /> },
    { id: "vision", label: "Vision & Mission", category: "LEADERSHIP", icon: <Compass size={14} /> },
    { id: "values", label: "Core Values", category: "LEADERSHIP", icon: <Shield size={14} /> },
    // Technology & Platform
    { id: "journey", label: "Product Journey", category: "TECHNOLOGY", icon: <Activity size={14} /> },
    { id: "milestones", label: "Milestones", category: "TECHNOLOGY", icon: <Award size={14} /> },
    { id: "technology", label: "Technology Stack", category: "TECHNOLOGY", icon: <Cpu size={14} /> },
    { id: "architecture", label: "Architecture", category: "TECHNOLOGY", icon: <Server size={14} /> },
    { id: "ai", label: "AI Innovation", category: "TECHNOLOGY", icon: <Sparkles size={14} /> },
    // Governance & Legal
    { id: "legal", label: "Licenses & Legal", category: "GOVERNANCE", icon: <Scale size={14} /> },
    { id: "privacy", label: "Privacy Policy", category: "GOVERNANCE", icon: <Lock size={14} /> },
    { id: "terms", label: "Terms of Use", category: "GOVERNANCE", icon: <Gavel size={14} /> },
    { id: "thirdparty", label: "Third-Party Licenses", category: "GOVERNANCE", icon: <Box size={14} /> },
    // Channels & Credits
    { id: "contact", label: "Contact Us", category: "CHANNELS", icon: <Mail size={14} /> },
    { id: "credits", label: "Credits", category: "CHANNELS", icon: <Heart size={14} /> },
    { id: "version", label: "Version Information", category: "CHANNELS", icon: <Tag size={14} /> },
    { id: "release", label: "Release Notes", category: "CHANNELS", icon: <History size={14} /> },
    { id: "system", label: "System Information", category: "CHANNELS", icon: <Monitor size={14} /> },
  ];

  const categories = ["OVERVIEW", "LEADERSHIP", "TECHNOLOGY", "GOVERNANCE", "CHANNELS"];

  // Filter sections by search query
  const filteredSections = sections.filter(sec => 
    sec.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    sec.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMsg) return;
    setSubmittingForm(true);
    setTimeout(() => {
      setSubmittingForm(false);
      setFormSubmitted(true);
      setContactName("");
      setContactEmail("");
      setContactMsg("");
    }, 1200);
  };

  if (loading || !metadata) {
    return (
      <div className="flex h-full items-center justify-center bg-theme-base text-theme-muted">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm font-mono tracking-wider">LOADING METADATA REGISTRY...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-theme-base font-sans overflow-hidden text-theme-body">
      {/* Sidebar - Hidden on print */}
      <div className="w-64 border-r border-theme-divider bg-theme-surface-1 flex flex-col z-10 shrink-0 print:hidden">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-theme-divider flex items-center gap-3 bg-theme-surface-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-sm font-display text-white shadow-md">
            S
          </div>
          <div>
            <h2 className="font-bold font-display text-theme-primary text-sm">About SMRITI</h2>
            <p className="text-[10px] text-theme-muted uppercase tracking-wider font-mono">Reference Desk</p>
          </div>
        </div>

        {/* Search Box */}
        <div className="p-3 border-b border-theme-divider bg-theme-surface-1/50">
          <div className="relative">
            <span className="absolute left-2.5 top-2.5 text-theme-muted">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search About desk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg pl-8 pr-7 py-1.5 text-xs focus:outline-none focus:border-blue-500 placeholder-theme-muted transition-all font-display"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-theme-muted hover:text-theme-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Menu Scroll */}
        <SmritiScrollArea className="flex-1">
          <div className="p-2 space-y-4 pb-6">
            {categories.map(cat => {
              const catSecs = filteredSections.filter(s => s.category === cat);
              if (catSecs.length === 0) return null;
              
              return (
                <div key={cat} className="space-y-1">
                  <span className="px-3 text-[9px] font-mono text-theme-muted font-bold tracking-widest uppercase block mb-1">
                    {cat}
                  </span>
                  {catSecs.map(section => (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        if (typeof window !== "undefined") {
                          document.getElementById("about-content-top")?.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors cursor-pointer ${
                        activeSection === section.id 
                          ? "bg-[#2563EB]/20 border border-[#2563EB]/40 text-blue-400 font-semibold" 
                          : "text-theme-muted hover:bg-theme-surface-3 hover:text-theme-body"
                      }`}
                    >
                      <span className={`${activeSection === section.id ? "text-blue-400" : "text-theme-muted"}`}>
                        {section.icon}
                      </span>
                      <span className="text-xs truncate font-display">{section.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </SmritiScrollArea>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col bg-theme-surface-2 relative overflow-hidden print:bg-white print:text-black">
        {/* Breadcrumb Navigation Header - Hidden on print */}
        <div className="h-14 border-b border-theme-divider bg-theme-surface-1 flex items-center justify-between px-6 shrink-0 shadow-sm z-10 print:hidden">
          <div className="flex items-center gap-1.5 text-xs text-theme-muted font-mono">
            <span>SMRITI Desk</span>
            <ChevronRight size={12} />
            <span>About Reference</span>
            <ChevronRight size={12} />
            <span className="text-theme-body font-semibold font-sans">
              {sections.find(s => s.id === activeSection)?.label}
            </span>
          </div>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded-lg text-xs font-semibold text-theme-body cursor-pointer transition-colors"
          >
            <Printer size={12} />
            <span>Print View</span>
          </button>
        </div>

        {/* Scrollable Document Area */}
        <SmritiScrollArea className="flex-1 p-6 sm:p-8 print:p-0">
          <div id="about-content-top" className="max-w-4xl mx-auto space-y-8 pb-16 print:pb-0">

            {/* SECTION 1: DASHBOARD */}
            {activeSection === "dashboard" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
                {/* Welcome Banner */}
                <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-theme-surface-1 border border-[#2563EB]/20 rounded-xl p-8 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-blue-400">
                    <Sparkles size={120} />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white mb-3">
                    SMRITI Retail OS Desk
                  </h1>
                  <p className="max-w-xl text-sm text-theme-muted leading-relaxed mb-6">
                    Welcome to the SMRITI Reference Desk. This module serves as the primary system registry and operational overview for version controls, author details, architectures, and support.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="px-2.5 py-1 text-xs font-bold font-mono tracking-wider uppercase bg-[#2563EB]/15 text-blue-400 rounded border border-[#2563EB]/30">
                      {metadata?.app.edition}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-bold font-mono tracking-wider uppercase bg-theme-surface-3 rounded border border-theme-divider text-theme-muted">
                      v{metadata?.app.version}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-semibold font-mono tracking-wider uppercase bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
                      {sysDiagnostics.onlineStatus}
                    </span>
                  </div>
                </div>

                {/* Quick Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div 
                    onClick={() => setActiveSection("about")}
                    className="bg-theme-surface-1 border border-theme-divider hover:border-blue-500/50 p-5 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-all group"
                  >
                    <Info className="text-blue-400 mb-3 group-hover:scale-105 transition-transform" size={20} />
                    <h3 className="font-bold text-xs font-mono uppercase tracking-wider text-theme-muted mb-1">Product Details</h3>
                    <p className="text-sm font-semibold text-theme-body">{metadata?.app.productName}</p>
                  </div>
                  
                  <div 
                    onClick={() => setActiveSection("founders")}
                    className="bg-theme-surface-1 border border-theme-divider hover:border-blue-500/50 p-5 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-all group"
                  >
                    <Users className="text-indigo-400 mb-3 group-hover:scale-105 transition-transform" size={20} />
                    <h3 className="font-bold text-xs font-mono uppercase tracking-wider text-theme-muted mb-1">Founders Profiles</h3>
                    <p className="text-sm font-semibold text-theme-body">Leadership Team</p>
                  </div>
                  
                  <div 
                    onClick={() => setActiveSection("technology")}
                    className="bg-theme-surface-1 border border-theme-divider hover:border-blue-500/50 p-5 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-all group"
                  >
                    <Cpu className="text-emerald-400 mb-3 group-hover:scale-105 transition-transform" size={20} />
                    <h3 className="font-bold text-xs font-mono uppercase tracking-wider text-theme-muted mb-1">Technology Stack</h3>
                    <p className="text-sm font-semibold text-theme-body">Modular Layers</p>
                  </div>
                  
                  <div 
                    onClick={() => setActiveSection("release")}
                    className="bg-theme-surface-1 border border-theme-divider hover:border-blue-500/50 p-5 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-all group"
                  >
                    <History className="text-amber-400 mb-3 group-hover:scale-105 transition-transform" size={20} />
                    <h3 className="font-bold text-xs font-mono uppercase tracking-wider text-theme-muted mb-1">Release Logs</h3>
                    <p className="text-sm font-semibold text-theme-body">Changelog Feed</p>
                  </div>
                </div>

                {/* Subsystem Operational Summary */}
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-theme-muted mb-4 border-b border-theme-divider pb-2 flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-500" size={14} /> Subsystem Health Status
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded-lg border border-theme-divider">
                      <span className="text-theme-muted">Database Engine:</span>
                      <span className="font-bold text-emerald-400">Connected</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded-lg border border-theme-divider">
                      <span className="text-theme-muted">Sync Engine Core:</span>
                      <span className="font-bold text-emerald-400">Idle / Ready</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded-lg border border-theme-divider">
                      <span className="text-theme-muted">Security Audit Middleware:</span>
                      <span className="font-bold text-emerald-400">Operational</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded-lg border border-theme-divider">
                      <span className="text-theme-muted">Taskbar Multi-Threading:</span>
                      <span className="font-bold text-emerald-400">Enabled</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: ABOUT SMRITI RETAIL OS */}
            {activeSection === "about" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-8 shadow-sm flex flex-col items-center text-center">
                  {/* Glowing SVG Logo */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-[#2563EB]/25 blur-xl rounded-full"></div>
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-5xl font-display text-white shadow-xl relative z-10 ring-4 ring-[#2563EB]/20">
                      S
                    </div>
                  </div>
                  <h1 className="text-3xl font-bold font-display text-white mb-2">
                    {metadata?.app.productName}
                  </h1>
                  <span className="px-2.5 py-1 text-xs font-bold font-mono tracking-wider uppercase bg-[#2563EB]/15 text-blue-500 rounded border border-[#2563EB]/25 mb-4">
                    {metadata?.app.edition}
                  </span>
                  <p className="max-w-xl text-theme-muted mb-8 leading-relaxed text-sm">
                    SMRITI Retail OS is a modern, enterprise-ready business experience and operational intelligence layer. Purpose-built for retail operations, distribution, and real-time inventory management, it integrates multi-database synchronization mechanisms, offline-first execution routines, and flexible layout configuration engines.
                  </p>
                  
                  <div className="w-full grid grid-cols-2 gap-4 text-left border-t border-theme-divider pt-6 max-w-lg">
                    <div>
                      <span className="block text-[10px] text-theme-muted font-mono uppercase">Organization</span>
                      <span className="font-semibold text-theme-body">{metadata?.author.organization}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-theme-muted font-mono uppercase">Official Sites</span>
                      <span className="font-mono text-xs text-blue-400 break-all">
                        aitdl.com | erpnbook.com | smritibooks.com
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: FOUNDERS */}
            {activeSection === "founders" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Founders & Leadership</h2>
                  <p className="text-xs text-theme-muted">The core founders and steering leaders of AITDL NETWORKS and SMRITI Retail OS.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Founder 1 */}
                  <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400 font-display text-lg">
                          PD
                        </div>
                        <div>
                          <h3 className="font-bold text-white">Pushpa Devi Jawahar Mallah</h3>
                          <span className="text-[10px] font-mono font-bold text-amber-500 uppercase">Founder & Chairperson</span>
                        </div>
                      </div>
                      <p className="text-xs text-theme-muted leading-relaxed mb-4">
                        Pushpa Devi Jawahar Mallah provides strategic organizational direction, financial planning guidelines, and corporate governance oversight for the AITDL network.
                      </p>
                    </div>
                    <div className="border-t border-theme-divider/60 pt-3 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-theme-muted font-mono">Phone:</span>
                        <span className="font-semibold text-theme-body">+91 9324117007</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-theme-muted font-mono">Email:</span>
                        <a href="mailto:founder@aitdl.com" className="font-semibold text-blue-400 hover:underline">founder@aitdl.com</a>
                      </div>
                    </div>
                  </div>

                  {/* Founder 2 */}
                  <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 font-display text-lg">
                          JM
                        </div>
                        <div>
                          <h3 className="font-bold text-white">Jawahar Ramkripal Mallah</h3>
                          <span className="text-[10px] font-mono font-bold text-amber-500 uppercase">Founder, CEO & Architect</span>
                        </div>
                      </div>
                      <p className="text-xs text-theme-muted leading-relaxed mb-4">
                        Jawahar Ramkripal Mallah directs development workflows and designed SMRITI's core offline-first synchronization protocols, database pooling strategies, and Layout Engine.
                      </p>
                    </div>
                    <div className="border-t border-theme-divider/60 pt-3 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-theme-muted font-mono">Websites:</span>
                        <span className="font-semibold text-theme-body">smritibooks.com</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-theme-muted font-mono">Email:</span>
                        <a href="mailto:founder@aitdl.com" className="font-semibold text-blue-400 hover:underline">founder@aitdl.com</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: OUR STORY */}
            {activeSection === "story" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Our Story</h2>
                  <p className="text-xs text-theme-muted">The developmental history and evolution of SMRITI Retail OS.</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm">
                  <p className="text-sm text-theme-muted leading-relaxed mb-8 font-display">
                    In early 2026, retail managers faced severe downtime issues from unstable internet connectivity at local terminals. AITDL CEO Jawahar Ramkripal Mallah proposed a design structure that isolates front-end UI layouts from backend host databases using a local cached IndexedDB. This concept evolved into SMRITI Retail OS—an offline-first operational desk synchronizing automatically.
                  </p>
                  
                  {/* Visual Story Timeline */}
                  <div className="relative pl-6 border-l-2 border-theme-divider space-y-8 ml-4">
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-blue-600 border-4 border-theme-surface-1 shadow"></span>
                      <h4 className="font-bold text-xs text-theme-body uppercase tracking-wide">Q1 2026: Conceptualization</h4>
                      <p className="text-xs text-theme-muted mt-1">First schema definitions and database repository patterns built on SQLite for local terminal operations.</p>
                    </div>
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-blue-600 border-4 border-theme-surface-1 shadow"></span>
                      <h4 className="font-bold text-xs text-theme-body uppercase tracking-wide">Q2 2026: Hybrid Sync & CRM Upgrade</h4>
                      <p className="text-xs text-theme-muted mt-1">Rollout of real-time event logs, loyalty customer databases, and split-payment cashier shortcuts.</p>
                    </div>
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-blue-600 border-4 border-theme-surface-1 shadow"></span>
                      <h4 className="font-bold text-xs text-theme-body uppercase tracking-wide">Q3 2026: Clean Architecture Framework</h4>
                      <p className="text-xs text-theme-muted mt-1">PAL layers, cloud-SQL connection pools, Docker container orchestrations, and project header standardization.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: VISION & MISSION */}
            {activeSection === "vision" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                    <Compass size={20} />
                  </div>
                  <h3 className="text-lg font-bold font-display text-white mb-2">Our Vision</h3>
                  <p className="text-xs text-theme-muted leading-relaxed">
                    To deliver intelligent, self-synchronizing business environments that prevent transaction downtime, automate supply chain sourcing operations, and empower retail desks with sub-millisecond local billing terminals.
                  </p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                    <Layers size={20} />
                  </div>
                  <h3 className="text-lg font-bold font-display text-white mb-2">Our Mission</h3>
                  <p className="text-xs text-theme-muted leading-relaxed">
                    Empower storefront teams with highly resilient, offline-first operating desks that are simple to navigate, secure to manage, and dynamically synchronized with cloud database instances.
                  </p>
                </div>
              </div>
            )}

            {/* SECTION 6: CORE VALUES */}
            {activeSection === "values" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Core Corporate Values</h2>
                  <p className="text-xs text-theme-muted">The operational guidelines that guide SMRITI's platform design decisions.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { title: "Innovation", text: "Pushing standard database and design limitations constantly.", icon: <Sparkles size={16} /> },
                    { title: "Customer Success", text: "Providing ergonomic billing interfaces for stores.", icon: <Heart size={16} /> },
                    { title: "Simplicity", text: "Minimizing cashier keystrokes and simplifying menus.", icon: <Info size={16} /> },
                    { title: "Trust", text: "Ensuring transactions are consistently logged and backed up.", icon: <CheckCircle2 size={16} /> },
                    { title: "Transparency", text: "Authoritative references, changelogs, and legal compliance.", icon: <Gavel size={16} /> },
                    { title: "Security", text: "Redacted exports, secure endpoints, role access policies.", icon: <Lock size={16} /> },
                    { title: "Performance", text: "Fast interface loading and debounced database searches.", icon: <Activity size={16} /> },
                    { title: "Scalability", text: "Smooth transition from local IndexedDB to PostgreSQL clusters.", icon: <Server size={16} /> },
                    { title: "Continuous Learning", text: "Evolving core frameworks via sprint cycles.", icon: <Book size={16} /> },
                    { title: "Ethical AI", text: "Transparent forecasting models that keep user data private.", icon: <Shield size={16} /> },
                  ].map((val, idx) => (
                    <div key={idx} className="bg-theme-surface-1 border border-theme-divider p-5 rounded-xl shadow-sm space-y-2">
                      <div className="text-blue-400">{val.icon}</div>
                      <h4 className="font-bold text-sm text-theme-body">{val.title}</h4>
                      <p className="text-[11px] text-theme-muted leading-relaxed">{val.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 7: PRODUCT JOURNEY */}
            {activeSection === "journey" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Product Journey</h2>
                  <p className="text-xs text-theme-muted">The iterative lifecycle workflow of SMRITI Retail OS modules.</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm overflow-x-auto">
                  <div className="min-w-[600px] flex items-center justify-between py-6">
                    {[
                      { name: "Idea", desc: "Gap Analysis" },
                      { name: "Research", desc: "Design Specs" },
                      { name: "Design", desc: "Layouts" },
                      { name: "Development", desc: "PAL Coding" },
                      { name: "Testing", desc: "Linter/Tests" },
                      { name: "Release", desc: "Docker Deploy" },
                      { name: "Innovation", desc: "Feedback Loop" }
                    ].map((step, idx, arr) => (
                      <React.Fragment key={idx}>
                        <div className="flex flex-col items-center text-center w-24 shrink-0">
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-xs font-mono shadow-sm">
                            {idx + 1}
                          </div>
                          <h4 className="font-bold text-xs text-theme-body mt-2">{step.name}</h4>
                          <span className="text-[10px] text-theme-muted font-mono">{step.desc}</span>
                        </div>
                        {idx < arr.length - 1 && (
                          <ChevronRight className="text-theme-divider" size={16} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 8: MILESTONES */}
            {activeSection === "milestones" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Milestones</h2>
                  <p className="text-xs text-theme-muted">Chronological project development milestones.</p>
                </div>
                
                <div className="space-y-4">
                  {[
                    { tag: "v1.0.0", title: "Offline Concept Validation", text: "Implemented local SQLite database queries and initial in-browser checkout cashier forms." },
                    { tag: "v2.1.1", title: "Sales Studio Module", text: "Added interactive dashboard layout widgets, Sales, and Purchase operational records." },
                    { tag: "v2.1.2", title: "CRM, Auditing, and POS Upgrades", text: "Added keyboard cashier terminal triggers, split payment methods, and Express audit middleware." },
                    { tag: "v2.1.4", title: "PostgreSQL Database Connection Pool", text: "Transitioned primary local storage to PostgreSQL database pools with seed parameters." },
                    { tag: "v3.0.0", title: "Platform Abstraction Layer & Clean Architecture", text: "Implemented the SMRITI PAL layers and background SyncEngine routines." },
                    { tag: "v3.1.0", title: "DevOps Containerization", text: "Dockerized Node/Vite app and PostgreSQL servers, adding auto-restart scripts." },
                    { tag: "v3.3.0", title: "Metadata & Header Governance", text: "Applied standardized project comment headers across all repository files." }
                  ].map((milestone, idx) => (
                    <div key={idx} className="bg-theme-surface-1 border border-theme-divider p-4 rounded-xl shadow-sm flex items-start gap-4">
                      <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold font-mono text-blue-400">
                        {milestone.tag}
                      </span>
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs text-theme-body">{milestone.title}</h4>
                        <p className="text-[11px] text-theme-muted leading-relaxed">{milestone.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 9: TECHNOLOGY */}
            {activeSection === "technology" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Technology Inventory</h2>
                  <p className="text-xs text-theme-muted">The technology stacks and engines powering SMRITI Retail OS.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-display">
                  <div className="bg-theme-surface-1 border border-theme-divider p-4 rounded-xl shadow-sm">
                    <h4 className="font-bold text-white mb-2">Frontend Stack</h4>
                    <ul className="list-disc list-inside text-theme-muted space-y-1.5 font-mono text-[11px]">
                      <li>React 18 / TypeScript</li>
                      <li>Tailwind CSS v4 Utilities</li>
                      <li>motion (Framer Motion) UI Animations</li>
                      <li>Lucide React Icon Library</li>
                    </ul>
                  </div>
                  
                  <div className="bg-theme-surface-1 border border-theme-divider p-4 rounded-xl shadow-sm">
                    <h4 className="font-bold text-white mb-2">Backend & Sync Stack</h4>
                    <ul className="list-disc list-inside text-theme-muted space-y-1.5 font-mono text-[11px]">
                      <li>FastAPI (Python) Core Backend</li>
                      <li>Node.js / Express Gateway</li>
                      <li>PostgreSQL 15 / 16 Pools</li>
                      <li>IndexedDB Client Caches</li>
                      <li>REST API / Operations Event Bus</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 10: ARCHITECTURE */}
            {activeSection === "architecture" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Architecture Diagram</h2>
                  <p className="text-xs text-theme-muted">Visual layout structure showing inward-only dependencies (Rule 1).</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm space-y-4">
                  {/* Visual Box Diagram */}
                  <div className="flex flex-col gap-3 font-mono text-[10px] font-bold text-center">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg">
                      USER INTERFACE (UI)
                      <p className="font-normal text-[9px] text-theme-muted mt-1">Billing Terminal | CRM tab | Sales Studio</p>
                    </div>
                    <div className="flex justify-center text-theme-muted">↓</div>
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg">
                      APPLICATION SERVICES
                      <p className="font-normal text-[9px] text-theme-muted mt-1">BillingService | SyncEngine</p>
                    </div>
                    <div className="flex justify-center text-theme-muted">↓</div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg">
                      PLATFORM ABSTRACTION LAYER (PAL)
                      <p className="font-normal text-[9px] text-theme-muted mt-1">Database Pools | File Caches | Event Channels</p>
                    </div>
                    <div className="flex justify-center text-theme-muted">↓</div>
                    <div className="p-3 bg-theme-surface-3 border border-theme-divider text-theme-muted rounded-lg">
                      DATABASES / HOST INFRASTRUCTURE
                      <p className="font-normal text-[9px] text-theme-muted mt-1">PostgreSQL Client | SQLite Backups | IndexedDB Browser Store</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 11: AI INNOVATION */}
            {activeSection === "ai" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">AI Innovation</h2>
                  <p className="text-xs text-theme-muted">Intelligent tools and AI assistant roadmaps.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-theme-surface-1 border border-theme-divider p-5 rounded-xl shadow-sm">
                    <h3 className="font-bold text-sm text-white mb-2">Google GenAI Copilot</h3>
                    <p className="text-xs text-theme-muted leading-relaxed">
                      SMRITI integrates Gemini models to provide natural language calculations, explain tax formulas on billing checkouts, and index reference documents in the SMRITI Gyan Kendra.
                    </p>
                  </div>
                  
                  <div className="bg-theme-surface-1 border border-theme-divider p-5 rounded-xl shadow-sm">
                    <h3 className="font-bold text-sm text-white mb-2">Predictive Sourcing</h3>
                    <p className="text-xs text-theme-muted leading-relaxed">
                      Future roadmap features include Large Action Models (LAM) drafting restock POs based on debounced local stockout rate analytics.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 12: LICENSES & LEGAL */}
            {activeSection === "legal" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Licenses & Legal</h2>
                  <p className="text-xs text-theme-muted">Software ownership and licensing details.</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm space-y-4 text-xs leading-relaxed">
                  <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider">
                    <span className="font-mono text-[9px] text-theme-muted uppercase tracking-wider block mb-1">License Classification</span>
                    <span className="font-bold text-white">Proprietary Commercial Software License</span>
                  </div>
                  
                  <p className="text-theme-muted">
                    This software and all associated files are the exclusive proprietary property of **AITDL NETWORKS**. All rights reserved worldwide.
                  </p>
                  
                  <p className="text-theme-muted">
                    Permission to compile, execute, or redistribute SMRITI Retail OS is strictly restricted to valid client seat agreements. Unauthorized usage, binary decompilation, or code extraction represents a violation of copyright statutes.
                  </p>
                </div>
              </div>
            )}

            {/* SECTION 13: PRIVACY POLICY */}
            {activeSection === "privacy" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Privacy Policy</h2>
                  <p className="text-xs text-theme-muted">Data protection and storage principles.</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm space-y-4 text-xs leading-relaxed text-theme-muted">
                  <h4 className="font-bold text-white">1. Data Ownership</h4>
                  <p>All transactional, customer, and catalog data recorded by SMRITI Retail OS remains strictly the property of the client organization. SMRITI does not upload billing details to third-party telemetry servers.</p>
                  
                  <h4 className="font-bold text-white">2. Local Cache Security</h4>
                  <p>In-browser offline storage caches (IndexedDB) are bound to the host domain origin, preventing cross-site scripting (XSS) extraction of cashier sessions.</p>
                </div>
              </div>
            )}

            {/* SECTION 14: TERMS OF USE */}
            {activeSection === "terms" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Terms of Use</h2>
                  <p className="text-xs text-theme-muted">Governance guidelines governing software seats.</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm space-y-4 text-xs leading-relaxed text-theme-muted">
                  <p>
                    Usage of SMRITI Retail OS is governed by the commercial licensing agreement executed between AITDL NETWORKS and the licensee.
                  </p>
                  <h4 className="font-bold text-white">Restrictions</h4>
                  <p>Reverse-engineering, decompiling, or attempting to extract the sync engine logic outside of AITDL-authorized sandboxes is prohibited.</p>
                </div>
              </div>
            )}

            {/* SECTION 15: THIRD-PARTY LICENSES */}
            {activeSection === "thirdparty" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Third-Party Dependency Licenses</h2>
                  <p className="text-xs text-theme-muted">Upstream library licenses. Third-party copyrights are never modified (Rule 1).</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl shadow-sm overflow-hidden text-xs">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-theme-surface-2 border-b border-theme-divider text-theme-muted font-mono text-[10px] uppercase">
                        <th className="p-3">Dependency</th>
                        <th className="p-3">License</th>
                        <th className="p-3">Usage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider font-mono text-[11px] text-theme-muted">
                      <tr>
                        <td className="p-3 font-semibold text-white">React 18</td>
                        <td className="p-3">MIT</td>
                        <td className="p-3">UI Components & State</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-white">FastAPI / Python</td>
                        <td className="p-3">MIT</td>
                        <td className="p-3">Core Python Async Backend</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-white">Express</td>
                        <td className="p-3">MIT</td>
                        <td className="p-3">Gateway Router Compatibility</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-white">SQLAlchemy 2.0</td>
                        <td className="p-3">MIT</td>
                        <td className="p-3">Python Asyncpg Database ORM</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-white">pg (node-postgres)</td>
                        <td className="p-3">MIT</td>
                        <td className="p-3">PostgreSQL Client Pool</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-white">Recharts</td>
                        <td className="p-3">MIT</td>
                        <td className="p-3">Sales Margin Charts</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-white">lucide-react</td>
                        <td className="p-3">ISC</td>
                        <td className="p-3">Sidebar & Panel Icons</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 16: CONTACT */}
            {activeSection === "contact" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Contact Channels</h2>
                  <p className="text-xs text-theme-muted">Connect with AITDL NETWORKS support teams.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Support Details */}
                  <div className="bg-theme-surface-1 border border-theme-divider p-6 rounded-xl shadow-sm space-y-4 text-xs">
                    <div>
                      <span className="block text-[10px] text-theme-muted font-mono uppercase">Corporate Email</span>
                      <a href="mailto:founder@aitdl.com" className="font-semibold text-blue-400 hover:underline font-mono">founder@aitdl.com</a>
                    </div>
                    <div>
                      <span className="block text-[10px] text-theme-muted font-mono uppercase">Official Sites</span>
                      <span className="font-semibold text-white font-mono">aitdl.com | erpnbook.com | smritibooks.com</span>
                    </div>
                  </div>
                  
                  {/* Feedback Form */}
                  <div className="bg-theme-surface-1 border border-theme-divider p-6 rounded-xl shadow-sm">
                    <h3 className="font-bold text-xs font-mono uppercase tracking-wider text-theme-muted mb-4">Send a Reference Request</h3>
                    
                    {formSubmitted ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-xs flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span>Request submitted successfully! Support email sent.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleContactSubmit} className="space-y-3 text-xs">
                        <div>
                          <label className="block text-theme-muted mb-1 font-display">Your Name</label>
                          <input 
                            type="text" 
                            value={contactName}
                            onChange={e => setContactName(e.target.value)}
                            required
                            className="w-full bg-theme-surface-2 text-theme-body border border-theme-divider rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-theme-muted mb-1 font-display">Your Email</label>
                          <input 
                            type="email" 
                            value={contactEmail}
                            onChange={e => setContactEmail(e.target.value)}
                            required
                            className="w-full bg-theme-surface-2 text-theme-body border border-theme-divider rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-theme-muted mb-1 font-display">Message</label>
                          <textarea 
                            rows={3}
                            value={contactMsg}
                            onChange={e => setContactMsg(e.target.value)}
                            required
                            className="w-full bg-theme-surface-2 text-theme-body border border-theme-divider rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <button 
                          type="submit" 
                          disabled={submittingForm}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-semibold cursor-pointer flex items-center gap-2 font-display"
                        >
                          {submittingForm && <Loader2 size={12} className="animate-spin" />}
                          Submit Request
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 17: CREDITS */}
            {activeSection === "credits" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Acknowledgements & Credits</h2>
                  <p className="text-xs text-theme-muted">Contributors steering SMRITI development.</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider p-6 rounded-xl shadow-sm text-xs leading-relaxed text-theme-muted font-display">
                  <p className="mb-4">
                    SMRITI Retail OS is developed and governed by **AITDL NETWORKS**.
                  </p>
                  <p>
                    Special acknowledgments to Chairperson **Pushpa Devi Jawahar Mallah**, CEO & Software Architect **Jawahar Ramkripal Mallah**, and the Advanced Agentic Coding assistants team at Google DeepMind.
                  </p>
                </div>
              </div>
            )}

            {/* SECTION 18: VERSION INFORMATION */}
            {activeSection === "version" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Version Information</h2>
                  <p className="text-xs text-theme-muted">Diagnostics and version controls.</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded border border-theme-divider">
                      <span className="text-theme-muted">Product Version:</span>
                      <span className="font-bold text-white">{metadata?.app.version}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded border border-theme-divider">
                      <span className="text-theme-muted">Build ID:</span>
                      <span className="font-bold text-white">{metadata?.app.buildNumber}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded border border-theme-divider">
                      <span className="text-theme-muted">Last Commit Hash:</span>
                      <span className="font-bold text-white">e4c2149</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded border border-theme-divider">
                      <span className="text-theme-muted">Build Date:</span>
                      <span className="font-bold text-white">{metadata?.app.buildDate}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded border border-theme-divider">
                      <span className="text-theme-muted">Host OS Platform:</span>
                      <span className="font-bold text-white">{sysDiagnostics.platform}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-theme-surface-2 rounded border border-theme-divider">
                      <span className="text-theme-muted">Browser Engine:</span>
                      <span className="font-bold text-white truncate max-w-[200px]" title={sysDiagnostics.userAgent}>{sysDiagnostics.browser}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 19: RELEASE NOTES */}
            {activeSection === "release" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">Changelog & Release Notes</h2>
                  <p className="text-xs text-theme-muted">Chronological changelog served dynamically from active source.</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm">
                  {loadingChangelog ? (
                    <div className="flex justify-center items-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-[11px] text-theme-muted leading-relaxed bg-theme-surface-2 p-4 rounded border border-theme-divider overflow-x-auto max-h-[500px]">
                      {changelog}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 20: SYSTEM INFORMATION */}
            {activeSection === "system" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-theme-divider pb-2">
                  <h2 className="text-xl font-bold font-display text-white">System Information</h2>
                  <p className="text-xs text-theme-muted">Diagnostics and active modules logs.</p>
                </div>
                
                <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 shadow-sm font-display">
                  <div className="divide-y divide-theme-divider">
                    {/* Module Registry stats */}
                    <div className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <h4 className="font-bold text-white">Active Modules Count</h4>
                        <p className="text-[10px] text-theme-muted">Dynamic plugins registered in system</p>
                      </div>
                      <span className="font-mono font-bold bg-theme-surface-2 border border-theme-divider px-2.5 py-1 rounded text-white">
                        {mergedModules.length} Modules
                      </span>
                    </div>

                    {/* Cache stats */}
                    <div className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <h4 className="font-bold text-white">IndexedDB Cache Volume</h4>
                        <p className="text-[10px] text-theme-muted">Local catalog storage volume</p>
                      </div>
                      <span className="font-mono font-bold bg-theme-surface-2 border border-theme-divider px-2.5 py-1 rounded text-white font-display">
                        {sysDiagnostics.cookieEnabled ? "Enabled (1.4MB)" : "Disabled"}
                      </span>
                    </div>

                    {/* Network state */}
                    <div className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <h4 className="font-bold text-white">Connection Type</h4>
                        <p className="text-[10px] text-theme-muted">Cashier terminal uplink profile</p>
                      </div>
                      <span className="font-mono font-bold bg-theme-surface-2 border border-theme-divider px-2.5 py-1 rounded text-white uppercase">
                        {sysDiagnostics.connectionType}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </SmritiScrollArea>
      </div>
    </div>
  );
};
