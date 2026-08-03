/**
 * Project      : SMRITI Retail OS
 * Module       : Digital Business Desktop Composition Shell (Zones A-H Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState } from "react";
import { Header } from "./Header.tsx";
import { BusinessSnapshotEngine } from "./BusinessSnapshotEngine.tsx";
import { FavoritesBar } from "./FavoritesBar.tsx";
import { QuickActionsBar } from "./QuickActionsBar.tsx";
import { ApplicationGrid } from "./ApplicationGrid.tsx";
import { PluginWidgetEngine } from "./PluginWidgetEngine.tsx";
import { ActivityAndWorkPanel } from "./ActivityAndWorkPanel.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { SearchModal } from "./SearchModal.tsx";

// Ensure default KPI plugins & search providers are loaded
import "../widgets/SalesKpiWidget.tsx";
import "../widgets/InventoryKpiWidget.tsx";
import "../widgets/PurchaseKpiWidget.tsx";
import "../widgets/FinanceKpiWidget.tsx";
import "../providers/SalesSearchProvider.ts";
import "../providers/InventorySearchProvider.ts";

interface LaunchpadShellProps {
  currentUser?: { role: string; name: string; companyId?: string; branchId?: string } | null;
  userPermissions?: string[];
  onSelectTab: (tabId: string) => void;
  onOpenNotifications?: () => void;
}

export const LaunchpadShell: React.FC<LaunchpadShellProps> = ({
  currentUser,
  userPermissions,
  onSelectTab,
  onOpenNotifications = () => {}
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="w-full h-full overflow-y-auto bg-theme-base text-theme-body p-6 md:p-8 font-sans selection:bg-[var(--c-seef-accent)] selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Zone A: Shell Header */}
        <Header
          currentUser={currentUser}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNotifications={onOpenNotifications}
          onSelectTab={onSelectTab}
        />

        {/* Zone B: Business Snapshot KPIs */}
        <BusinessSnapshotEngine currentUser={currentUser} onSelectTab={onSelectTab} />

        {/* Zone C: Favorites Bar */}
        <FavoritesBar onSelectTab={onSelectTab} />

        {/* Zone D: Quick Actions Bar */}
        <QuickActionsBar onSelectTab={onSelectTab} />

        {/* Zone E: Application Grid */}
        <ApplicationGrid
          currentUser={currentUser}
          userPermissions={userPermissions}
          onSelectTab={onSelectTab}
          searchQuery={searchQuery}
        />

        {/* Zone F: Extension Plugin Widgets */}
        <PluginWidgetEngine currentUser={currentUser} onSelectTab={onSelectTab} />

        {/* Zone G: Activity & Pending Work Panel */}
        <ActivityAndWorkPanel onSelectTab={onSelectTab} />

        {/* Zone H: Status Bar */}
        <StatusBar />
      </div>

      {/* Universal Search Modal (Ctrl+K) */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectTab={onSelectTab}
      />
    </div>
  );
};
