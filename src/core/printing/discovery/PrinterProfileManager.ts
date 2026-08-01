import logger from "../../logging/logger.js";
import { PrinterCapability } from "../models/PrintDocument.js";

const PROFILE_KEY = "smriti_printer_profiles_v1";

export class PrinterProfileManager {
  static save(profile: PrinterCapability): void {
    if (typeof localStorage === "undefined") return;
    try {
      const current = this.list().filter((item) => item.id !== profile.id);
      localStorage.setItem(PROFILE_KEY, JSON.stringify([profile, ...current]));
    } catch (error) {
      logger.warn("[PrinterProfileManager] Failed to cache printer profile:", error as unknown);
    }
  }

  static list(): PrinterCapability[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const value = JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
}