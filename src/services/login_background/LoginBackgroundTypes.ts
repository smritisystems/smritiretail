/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.2.0
 * Created      : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Metadata-Driven Configuration Engine
 */

export type BackgroundType =
  | "None"
  | "Solid Color"
  | "Gradient"
  | "Line Art"
  | "Historical Collection"
  | "Cultural Collection"
  | "Regional Collection"
  | "Festival Collection"
  | "Seasonal Collection"
  | "Company Branding"
  | "Custom Image"
  | "Custom SVG";

export type RotationMode =
  | "Static"
  | "Random"
  | "Sequential"
  | "Daily"
  | "Weekly"
  | "Monthly"
  | "Festival Based"
  | "Regional Based";

export type ImageScaleMode = "Fit" | "Fill" | "Center" | "Stretch";

export type LoginCardStyle = "Glass" | "Solid" | "Floating" | "Elevated" | "Minimal";

export interface DisplayControls {
  opacity: number;          // 0 to 100%
  darkModeOpacity: number;  // 0 to 100%
  brightness: number;       // 0 to 100%
  blur: number;             // 0 to 20 px
  contrast: number;         // 0 to 100%
  scale: ImageScaleMode;
  solidColorHex?: string;
  gradientStartHex?: string;
  gradientEndHex?: string;
}

export interface LoginCardConfig {
  style: LoginCardStyle;
  shadow: boolean;
  borderRadius: number;    // px
  transparency: number;    // 0 to 100%
  blurPx: number;          // px for glassmorphism
}

export interface AccessibilityConfig {
  autoDisableOnHighContrast: boolean;
  autoDisableOnReducedMotion: boolean;
  autoDisableOnLowBandwidth: boolean;
}

export interface CollectionItem {
  id: string;
  title: string;
  category: "Historical" | "Cultural" | "Regional" | "Festival" | "Seasonal" | "Branding";
  region?: "North" | "South" | "East" | "West" | "North-East" | "Pan India";
  description: string;
  svgContent?: string;      // Procedural inline vector SVG
  imageUrl?: string;
  enabled: boolean;
  order: number;
}

export interface LoginBackgroundConfig {
  enabled: boolean;
  activeType: BackgroundType;
  selectedCollectionId: string;
  rotationMode: RotationMode;
  displayControls: DisplayControls;
  cardConfig: LoginCardConfig;
  accessibility: AccessibilityConfig;
  customSvgContent?: string;
  customImageUrl?: string;
  version: string;
}

export const DEFAULT_BACKGROUND_CONFIG: LoginBackgroundConfig = {
  enabled: true,
  activeType: "Historical Collection",
  selectedCollectionId: "konark-sun-temple",
  rotationMode: "Daily",
  displayControls: {
    opacity: 18,
    darkModeOpacity: 12,
    brightness: 95,
    blur: 0,
    contrast: 100,
    scale: "Fill",
    solidColorHex: "#354a5e",
    gradientStartHex: "#354a5e",
    gradientEndHex: "#0a2038",
  },
  cardConfig: {
    style: "Glass",
    shadow: true,
    borderRadius: 8,
    transparency: 92,
    blurPx: 12,
  },
  accessibility: {
    autoDisableOnHighContrast: true,
    autoDisableOnReducedMotion: true,
    autoDisableOnLowBandwidth: true,
  },
  version: "5.2.0",
};
