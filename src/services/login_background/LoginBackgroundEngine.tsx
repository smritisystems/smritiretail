/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.2.0
 * Created      : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Configuration-Driven Login Background Engine
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import {
  LoginBackgroundConfig,
  DEFAULT_BACKGROUND_CONFIG,
  CollectionItem,
  LoginCardStyle,
} from "./LoginBackgroundTypes";
import { ALL_COLLECTION_ITEMS, getCollectionItemById } from "./LoginBackgroundRegistry";

interface LoginBackgroundContextType {
  config: LoginBackgroundConfig;
  updateConfig: (updater: (prev: LoginBackgroundConfig) => LoginBackgroundConfig) => void;
  resetConfig: () => void;
  resolvedItem?: CollectionItem;
  isAccessibilityDisabled: boolean;
  getCardStyle: () => React.CSSProperties;
  getBackgroundCanvasStyle: () => React.CSSProperties;
  collections: CollectionItem[];
}

const STORAGE_KEY = "smriti_login_background_config_v5";

const LoginBackgroundContext = createContext<LoginBackgroundContextType | undefined>(undefined);

export const LoginBackgroundProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<LoginBackgroundConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_BACKGROUND_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_BACKGROUND_CONFIG;
  });

  // Save config to localStorage whenever modified
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore quota errors
    }
  }, [config]);

  // Accessibility Detector (Reduced Motion, High Contrast)
  const isAccessibilityDisabled = useMemo(() => {
    if (!config.enabled) return true;
    if (typeof window === "undefined") return false;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const prefersHighContrast  = window.matchMedia?.("(forced-colors: active)")?.matches ?? false;

    if (config.accessibility.autoDisableOnReducedMotion && prefersReducedMotion) return true;
    if (config.accessibility.autoDisableOnHighContrast  && prefersHighContrast) return true;

    return false;
  }, [config.enabled, config.accessibility]);

  // Rotation Service (Daily / Random / Sequential)
  const resolvedItem = useMemo(() => {
    if (config.activeType === "None" || isAccessibilityDisabled) return undefined;
    if (config.activeType === "Custom SVG" || config.activeType === "Custom Image") {
      return {
        id: "custom",
        title: "Custom Background",
        category: "Branding" as const,
        description: "Administrator custom visual asset",
        svgContent: config.customSvgContent,
        imageUrl: config.customImageUrl,
        enabled: true,
        order: 99,
      };
    }

    if (config.rotationMode === "Daily") {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const index = dayOfYear % ALL_COLLECTION_ITEMS.length;
      return ALL_COLLECTION_ITEMS[index];
    }

    if (config.rotationMode === "Random") {
      const selected = getCollectionItemById(config.selectedCollectionId);
      return selected || ALL_COLLECTION_ITEMS[0];
    }

    return getCollectionItemById(config.selectedCollectionId) || ALL_COLLECTION_ITEMS[0];
  }, [config.activeType, config.selectedCollectionId, config.rotationMode, config.customSvgContent, config.customImageUrl, isAccessibilityDisabled]);

  const updateConfig = (updater: (prev: LoginBackgroundConfig) => LoginBackgroundConfig) => {
    setConfig(prev => updater(prev));
  };

  const resetConfig = () => {
    setConfig(DEFAULT_BACKGROUND_CONFIG);
  };

  // Card Styling Resolver
  const getCardStyle = (): React.CSSProperties => {
    const { cardConfig } = config;
    const opacityVal = cardConfig.transparency / 100;

    switch (cardConfig.style) {
      case "Glass":
        return {
          backgroundColor: `rgba(255, 255, 255, ${opacityVal})`,
          backdropFilter: `blur(${cardConfig.blurPx}px)`,
          WebkitBackdropFilter: `blur(${cardConfig.blurPx}px)`,
          borderRadius: `${cardConfig.borderRadius}px`,
          boxShadow: cardConfig.shadow
            ? "0 20px 40px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.2) inset"
            : "none",
        };
      case "Solid":
        return {
          backgroundColor: "#ffffff",
          borderRadius: `${cardConfig.borderRadius}px`,
          boxShadow: cardConfig.shadow ? "0 10px 30px rgba(0,0,0,0.15)" : "none",
        };
      case "Floating":
        return {
          backgroundColor: `rgba(255, 255, 255, ${opacityVal})`,
          backdropFilter: "blur(16px)",
          borderRadius: `${cardConfig.borderRadius + 8}px`,
          boxShadow: "0 30px 60px -12px rgba(0,0,0,0.35)",
        };
      case "Elevated":
        return {
          backgroundColor: "#ffffff",
          borderRadius: `${cardConfig.borderRadius}px`,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        };
      case "Minimal":
        return {
          backgroundColor: "transparent",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: `${cardConfig.borderRadius}px`,
          boxShadow: "none",
        };
      default:
        return {};
    }
  };

  // Background Canvas Style Resolver
  const getBackgroundCanvasStyle = (): React.CSSProperties => {
    if (!config.enabled || config.activeType === "None" || isAccessibilityDisabled) {
      return { backgroundColor: config.displayControls.solidColorHex || "#354a5e" };
    }

    if (config.activeType === "Solid Color") {
      return { backgroundColor: config.displayControls.solidColorHex || "#354a5e" };
    }

    if (config.activeType === "Gradient") {
      return {
        background: `linear-gradient(135deg, ${config.displayControls.gradientStartHex || "#354a5e"}, ${config.displayControls.gradientEndHex || "#0a2038"})`,
      };
    }

    return {
      background: `linear-gradient(160deg, ${config.displayControls.gradientStartHex || "#354a5e"} 0%, ${config.displayControls.gradientEndHex || "#0a2038"} 100%)`,
      filter: `brightness(${config.displayControls.brightness}%) contrast(${config.displayControls.contrast}%) blur(${config.displayControls.blur}px)`,
    };
  };

  return (
    <LoginBackgroundContext.Provider
      value={{
        config,
        updateConfig,
        resetConfig,
        resolvedItem,
        isAccessibilityDisabled,
        getCardStyle,
        getBackgroundCanvasStyle,
        collections: ALL_COLLECTION_ITEMS,
      }}
    >
      {children}
    </LoginBackgroundContext.Provider>
  );
};

export const useLoginBackground = (): LoginBackgroundContextType => {
  const ctx = useContext(LoginBackgroundContext);
  if (!ctx) {
    throw new Error("useLoginBackground must be used within a LoginBackgroundProvider");
  }
  return ctx;
};
