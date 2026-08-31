/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export interface ImagePathConfig {
  basePathType: "relative" | "server" | "cdn" | "local";
  basePathUrl: string;
  defaultExtension: string; // e.g. ".jpg", ".png", ".webp", or ""
  fallbackPlaceholder: string;
  namingConvention: "custom" | "stock_no" | "barcode";
}

const STORAGE_KEY = "smriti_item_master_image_config";

export const DEFAULT_IMAGE_PATH_CONFIG: ImagePathConfig = {
  basePathType: "server",
  basePathUrl: "/api/v1/products/images/",
  defaultExtension: ".jpg",
  fallbackPlaceholder: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>",
  namingConvention: "custom"
};

export const getImagePathConfig = (): ImagePathConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_IMAGE_PATH_CONFIG;
    return { ...DEFAULT_IMAGE_PATH_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_IMAGE_PATH_CONFIG;
  }
};

export const saveImagePathConfig = (cfg: ImagePathConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.error("Failed to save image path config:", err);
  }
};

/**
 * Resolves full preview image URL given only the filename entered in Item Master
 */
export const resolveProductImageUrl = (
  imageName?: string | null,
  cfg: ImagePathConfig = getImagePathConfig()
): string => {
  if (!imageName || !imageName.trim()) {
    return cfg.fallbackPlaceholder;
  }

  const cleanName = imageName.trim();

  // If already absolute URL or base64 data URI
  if (cleanName.startsWith("http://") || cleanName.startsWith("https://") || cleanName.startsWith("data:")) {
    return cleanName;
  }

  let finalName = cleanName;
  if (cfg.defaultExtension && !cleanName.includes(".")) {
    const ext = cfg.defaultExtension.startsWith(".") ? cfg.defaultExtension : `.${cfg.defaultExtension}`;
    finalName = `${cleanName}${ext}`;
  }

  let base = cfg.basePathUrl.trim();
  if (!base.endsWith("/")) {
    base += "/";
  }

  return `${base}${finalName}`;
};
