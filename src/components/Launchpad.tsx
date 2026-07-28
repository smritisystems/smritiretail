/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : SMRITI Digital Business Desktop (SLP-001 v1.0 & Rule SLP-002 / SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0 (Composition Framework Engine)
 */

import React from "react";
import { LaunchpadShell } from "../launchpad/index.ts";

export interface LaunchpadTile {
  id: string;
  title: string;
  subtitle: string;
  category: "Operations" | "Masters" | "Analytics" | "Administration";
  icon: React.ElementType;
  permissionScope: string;
  accentColor: string;
  badge?: string;
  targetTab: string;
  isAiFeature?: boolean;
}

interface LaunchpadProps {
  currentUser: {
    role: string;
    name: string;
    companyId?: string;
    branchId?: string;
  } | null;
  userPermissions?: string[];
  onSelectTab: (tabId: string) => void;
  onOpenNotifications?: () => void;
}

export const Launchpad: React.FC<LaunchpadProps> = ({
  currentUser,
  userPermissions,
  onSelectTab,
  onOpenNotifications
}) => {
  return (
    <LaunchpadShell
      currentUser={currentUser}
      userPermissions={userPermissions}
      onSelectTab={onSelectTab}
      onOpenNotifications={onOpenNotifications}
    />
  );
};
