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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { useEffect, useRef } from "react";
import { ContextAction, ContextData } from "./ContextAction.ts";
import { registry } from "./ContextRegistry.ts";
import { useACAS } from "./ContextProvider.tsx";

/**
 * Hook to register custom contextual actions on component mount,
 * and clean them up on unmount automatically.
 */
export const useContextActions = (actions: ContextAction[]) => {
  useEffect(() => {
    registry.registerMany(actions);
    return () => {
      actions.forEach(action => {
        registry.unregister(action.id);
      });
    };
  }, [actions]);
};

/**
 * Hook to bind standard, responsive triggers to a DOM element.
 * Supports:
 * - Desktop: right click (contextmenu)
 * - Touch: long press (500ms duration) with haptic feedback simulation
 * - Accessibility: Keyboard focus and custom hotkeys
 */
export const useBindContextTrigger = (contextData: ContextData) => {
  const { openMenu } = useACAS();
  const touchTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu(e, contextData, "cursor");
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    // Set 500ms timer for long press
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => {
      // Simulate mobile haptic rumble (if navigator.vibrate is supported)
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(40);
        } catch (_) {}
      }
      openMenu(e, contextData, "cursor");
    }, 500);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);

    // Cancel long press if the user drags or scrolls
    if (dx > 10 || dy > 10) {
      if (touchTimer.current) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
      }
    }
  };

  const onTouchEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Open on Enter or Space when Shift is pressed (or Shift+F10 is handled globally)
    if (e.shiftKey && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      openMenu(e as any, contextData, "element");
    }
  };

  return {
    onContextMenu,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onKeyDown,
    "data-context-module": contextData.module,
    "data-context-type": contextData.type,
    "data-context-object": contextData.object ? JSON.stringify(contextData.object) : undefined,
    tabIndex: 0, // Ensure WCAG sequential focusability
    className: "cursor-context-menu focus:ring-2 focus:ring-blue-500 focus:outline-none"
  };
};
