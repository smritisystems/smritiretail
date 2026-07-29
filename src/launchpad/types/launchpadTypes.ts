/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Launchpad Types (SLP-001 v1.0 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";

export type WorkspaceZoneId =
  | "ZoneA_Header"
  | "ZoneB_BusinessSnapshot"
  | "ZoneC_Favorites"
  | "ZoneD_QuickActions"
  | "ZoneE_ApplicationGrid"
  | "ZoneF_PluginWidgets"
  | "ZoneG_ActivityAndWork"
  | "ZoneH_StatusBar";

export type ModuleCategory =
  | "Operations"
  | "Masters"
  | "Analytics"
  | "Administration"
  | "Finance"
  | "Platform";

export interface LaunchpadTileManifest {
  id: string;
  title: string;
  subtitle: string;
  category: ModuleCategory;
  iconName: string;
  permissionScope: string;
  targetTab: string;
  badge?: string;
  isAiFeature?: boolean;
  orderIndex?: number;
}

export interface LaunchpadQuickAction {
  id: string;
  label: string;
  iconName: string;
  targetTab: string;
  permissionScope?: string;
  category: string;
  onClickAction?: () => void;
}

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  targetTab: string;
  iconName?: string;
}

export interface LaunchpadSearchProvider {
  id: string;
  name: string;
  search: (query: string) => Promise<SearchResultItem[]>;
}

export interface LaunchpadKpiMetric {
  id: string;
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  category: string;
  targetRoles: string[];
}

export interface WorkspaceTemplateConfig {
  id: string;
  name: string;
  description: string;
  defaultLandingTab: string;
  primaryCategories: ModuleCategory[];
  recommendedQuickActions: string[];
  kpiMetrics: string[];
  accentColor: string;
}
