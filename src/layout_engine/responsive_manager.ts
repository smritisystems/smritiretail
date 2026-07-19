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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { useState, useEffect } from "react";
import { DockPosition } from "./layout_store.js";

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface ResponsiveProfile {
  device: DeviceType;
  width: number;
  height: number;
  effectivePosition: DockPosition;
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
  let device: DeviceType = "desktop";
  let effectivePosition: DockPosition = userPosition;

  if (width < 640) {
    device = "mobile";
    // Mobile always defaults to bottom dock navigation or elegant touch bottom bar
    effectivePosition = "bottom";
  } else if (width >= 640 && width < 1024) {
    device = "tablet";
    // Tablet supports Left, Right or Bottom. If user selected Top, fallback to Bottom for touch-friendliness
    effectivePosition = userPosition === "top" ? "bottom" : userPosition;
  } else {
    device = "desktop";
    effectivePosition = userPosition;
  }

  return {
    device,
    width: windowSize.width,
    height: windowSize.height,
    effectivePosition,
  };
};
