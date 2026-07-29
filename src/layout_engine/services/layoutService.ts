/**
 * Project      : SMRITI Retail OS
 * Module       : Layout Bounds Calculation Service (SLGP-001 v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { useState, useEffect } from "react";
import { LAYOUT_TOKENS } from "../tokens/layoutTokens.ts";

export interface ViewportBounds {
  windowWidth: number;
  windowHeight: number;
  headerHeight: number;
  statusBarHeight: number;
  sidebarWidth: number;
  availableContentWidth: number;
  availableContentHeight: number;
  isSidebarCollapsed: boolean;
}

class LayoutServiceImpl {
  public calculateBounds(isSidebarCollapsed = false, hasHeader = true): ViewportBounds {
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const windowHeight = typeof window !== "undefined" ? window.innerHeight : 800;

    const headerHeight = hasHeader ? LAYOUT_TOKENS.HEADER_HEIGHT_PX : 0;
    const statusBarHeight = LAYOUT_TOKENS.STATUS_BAR_HEIGHT_PX;
    const sidebarWidth = isSidebarCollapsed
      ? LAYOUT_TOKENS.SIDEBAR_COLLAPSED_WIDTH_PX
      : LAYOUT_TOKENS.SIDEBAR_WIDTH_PX;

    const availableContentWidth = Math.max(0, windowWidth - sidebarWidth);
    const availableContentHeight = Math.max(0, windowHeight - headerHeight - statusBarHeight);

    return {
      windowWidth,
      windowHeight,
      headerHeight,
      statusBarHeight,
      sidebarWidth,
      availableContentWidth,
      availableContentHeight,
      isSidebarCollapsed
    };
  }
}

export const LayoutService = new LayoutServiceImpl();

export const useLayoutBounds = (isSidebarCollapsed = false, hasHeader = true): ViewportBounds => {
  const [bounds, setBounds] = useState<ViewportBounds>(() =>
    LayoutService.calculateBounds(isSidebarCollapsed, hasHeader)
  );

  useEffect(() => {
    const handleResize = () => {
      setBounds(LayoutService.calculateBounds(isSidebarCollapsed, hasHeader));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isSidebarCollapsed, hasHeader]);

  return bounds;
};
