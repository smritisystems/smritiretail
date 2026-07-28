/**
 * Project      : SMRITI Retail OS
 * Module       : Centralized Layout Tokens (SLGP-001 v2.0 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

export const LAYOUT_TOKENS = {
  HEADER_HEIGHT_PX: 48,
  TOOLBAR_HEIGHT_PX: 44,
  SIDEBAR_WIDTH_PX: 256,
  SIDEBAR_COLLAPSED_WIDTH_PX: 64,
  STATUS_BAR_HEIGHT_PX: 32,
  WORKSPACE_PADDING_PX: 16,
  CONTENT_GAP_PX: 16,
  GRID_GAP_PX: 16,
  CARD_RADIUS_PX: 8,

  // Tailwind CSS Class Mappings
  classes: {
    headerHeight: "h-[48px]",
    toolbarHeight: "h-[44px]",
    sidebarWidth: "w-[256px]",
    sidebarCollapsedWidth: "w-[64px]",
    statusBarHeight: "h-[32px]",
    workspacePadding: "p-4 md:p-6",
    contentGap: "gap-4",
    cardRadius: "rounded-lg"
  }
} as const;

export type LayoutTokensType = typeof LAYOUT_TOKENS;
