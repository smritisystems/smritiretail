/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.0.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-08-03
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { useState, useEffect } from "react";
import { DockPosition } from "./layout_store.js";

/**
 * SXP v1.0 — Five-Tier Responsive Breakpoints (SWEF v1.0 FROZEN)
 *
 * phone:     < 640px  — Bottom nav, scan-first full-screen, no sidebar
 * tablet:    640–1023px — Drawer sidebar, 44px touch targets
 * laptop:    1024–1439px — Standard sidebar + action bar
 * desktop:   1440–2559px — Full shell + inspector panel
 * ultrawide: ≥ 2560px  — Dual panels, extended grid columns
 */
export type DeviceType = "phone" | "tablet" | "laptop" | "desktop" | "ultrawide";

/** Single source of truth for breakpoint pixel values */
export const SXP_BREAKPOINTS = Object.freeze({
  PHONE_MAX: 639,
  TABLET_MIN: 640,
  TABLET_MAX: 1023,
  LAPTOP_MIN: 1024,
  LAPTOP_MAX: 1439,
  DESKTOP_MIN: 1440,
  ULTRAWIDE_MIN: 2560,
});

export interface ResponsiveProfile {
  device: DeviceType;
  width: number;
  height: number;
  effectivePosition: DockPosition;
  /** Convenience booleans */
  isPhone: boolean;
  isTablet: boolean;
  isLaptop: boolean;
  isDesktop: boolean;
  isUltrawide: boolean;
  /** True for phone and tablet — drives touch-safe 44px targets */
  isTouchDevice: boolean;
  /** True for laptop, desktop, ultrawide — drives full sidebar layout */
  isDesktopClass: boolean;
}

export const useResponsiveLayout = (userPosition: DockPosition): ResponsiveProfile => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const width = windowSize.width;
  let device: DeviceType;
  let effectivePosition: DockPosition = userPosition;

  if (width <= SXP_BREAKPOINTS.PHONE_MAX) {
    device = "phone";
    effectivePosition = "bottom"; // phone always bottom nav
  } else if (width <= SXP_BREAKPOINTS.TABLET_MAX) {
    device = "tablet";
    effectivePosition = userPosition === "top" ? "bottom" : userPosition;
  } else if (width <= SXP_BREAKPOINTS.LAPTOP_MAX) {
    device = "laptop";
    effectivePosition = userPosition;
  } else if (width < SXP_BREAKPOINTS.ULTRAWIDE_MIN) {
    device = "desktop";
    effectivePosition = userPosition;
  } else {
    device = "ultrawide";
    effectivePosition = userPosition;
  }

  const isPhone = device === "phone";
  const isTablet = device === "tablet";
  const isLaptop = device === "laptop";
  const isDesktop = device === "desktop";
  const isUltrawide = device === "ultrawide";

  return {
    device,
    width: windowSize.width,
    height: windowSize.height,
    effectivePosition,
    isPhone,
    isTablet,
    isLaptop,
    isDesktop,
    isUltrawide,
    isTouchDevice: isPhone || isTablet,
    isDesktopClass: isLaptop || isDesktop || isUltrawide,
  };
};
