/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.1.0 (SEEF Phase 8 — Fiori Layout Architecture)
 */

import React, { useState, useEffect, useMemo } from "react";
import { AdaptiveWorkspaceHeader } from "../components/common/AdaptiveWorkspaceHeader.tsx";
import { ContextualSidebar, DomainCategory } from "../components/common/ContextualSidebar.tsx";
import { NotificationCenter } from "../notifications/NotificationCenter.tsx";
import { useNotifications } from "../notifications/notification_store.tsx";
import { SEEFCommandPalette } from "./SEEFCommandPalette.tsx";
import { LayoutInspectorOverlay } from "./components/LayoutInspectorOverlay.tsx";

interface LayoutManagerProps {
  activeTab: string;
  onTabSelect: (id: string) => void;
  children: React.ReactNode;
  currentUser?: { role: string; name: string } | null;
  onLogout?: () => void;
}

export const LayoutManager: React.FC<LayoutManagerProps> = ({
  activeTab,
  onTabSelect,
  children,
  currentUser,
  onLogout,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearchPalette, setShowSearchPalette] = useState(false);

  // Map active tab to current domain category
  const activeDomain: DomainCategory = useMemo(() => {
    switch (activeTab) {
      case "pos":
      case "sales":
      case "sales-returns":
      case "customers":
      case "crm":
      case "loyalty":
        return "Sales";

      case "items":
      case "stock-ledger":
      case "consignment":
      case "barcode":
      case "barcode-studio":
      case "print-studio":
      case "print-labels":
      case "label-printing":
      case "universal-label":
      case "universal-label-printer":
      case "tag-printing":
        return "Inventory";

      case "purchase":
      case "suppliers":
      case "supplier-mgmt":
        return "Purchase";

      case "ledger":
      case "accounting-sync":
      case "audit-logs":
      case "business-ledger":
        return "Finance";

      case "staff":
      case "staff-management":
      case "master-management":
      case "masters":
      case "terms-engine":
      case "data-exchange":
      case "document-series":
      case "approval-matrix":
        return "Administration";

      case "dashboard":
      case "reports":
      case "report-designer":
        return "Analytics";

      default:
        return "Sales";
    }
  }, [activeTab]);

  const isLaunchpad = activeTab === "launchpad";

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-theme-base text-theme-body font-sans antialiased select-none relative">
      {/* 1. SAP Fiori Slim Header (Only rendered in operational workspaces, not Launchpad) */}
      {!isLaunchpad && (
        <AdaptiveWorkspaceHeader
          currentUser={currentUser}
          onOpenGlobalSearch={() => setShowSearchPalette(true)}
          onOpenNotifications={() => setShowNotifications(!showNotifications)}
          onOpenHelp={() => onTabSelect("live-docs")}
        />
      )}

      {/* Notifications Portal */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNavigate={onTabSelect}
      />

      {/* Global Command Search Palette */}
      <SEEFCommandPalette
        isOpen={showSearchPalette}
        onClose={() => setShowSearchPalette(false)}
        onNavigate={(id) => {
          onTabSelect(id);
          setShowSearchPalette(false);
        }}
      />

      {/* 2. Main Workspace Body (Sidebar + Content Viewport) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Context-Aware Collapsible Sidebar (Only rendered in operational workspaces) */}
        {!isLaunchpad && (
          <ContextualSidebar
            activeTab={activeTab}
            activeDomain={activeDomain}
            onSelectTab={onTabSelect}
            onReturnToLaunchpad={() => onTabSelect("launchpad")}
          />
        )}
        {/* Operational Viewport Content Area */}
        <main className="flex-1 min-h-0 flex flex-col overflow-y-auto bg-theme-base relative">
          {children}
        </main>

        {/* Developer Layout Inspector Overlay */}
        <LayoutInspectorOverlay />
      </div>
    </div>
  );
};
