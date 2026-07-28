/**
 * Project      : SMRITI Retail OS
 * Module       : Launchpad Cache Manager (Offline-First Performance Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

const LAUNCHPAD_CACHE_KEY = "smriti_launchpad_cache_v1";

export interface LaunchpadCacheData {
  lastUpdated: number;
  activeTemplateId: string;
  userFavorites: string[];
  recentActivities: { id: string; title: string; tab: string; timestamp: string }[];
  cachedKpis: Record<string, any>;
}

const DEFAULT_CACHE: LaunchpadCacheData = {
  lastUpdated: Date.now(),
  activeTemplateId: "general-retail",
  userFavorites: ["pos", "sales", "item-master"],
  recentActivities: [
    { id: "act-1", title: "POS Billing Terminal", tab: "pos", timestamp: "Just now" },
    { id: "act-2", title: "Product Master SKUs", tab: "item-master", timestamp: "10 mins ago" }
  ],
  cachedKpis: {}
};

class LaunchpadCacheImpl {
  private cache: LaunchpadCacheData = DEFAULT_CACHE;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(LAUNCHPAD_CACHE_KEY);
      if (raw) {
        this.cache = { ...DEFAULT_CACHE, ...JSON.parse(raw) };
      }
    } catch {
      this.cache = DEFAULT_CACHE;
    }
  }

  public get(): LaunchpadCacheData {
    return this.cache;
  }

  public update(partial: Partial<LaunchpadCacheData>): void {
    this.cache = { ...this.cache, ...partial, lastUpdated: Date.now() };
    try {
      localStorage.setItem(LAUNCHPAD_CACHE_KEY, JSON.stringify(this.cache));
    } catch (err) {
      console.warn("Failed to write to launchpad cache:", err);
    }
  }
}

export const LaunchpadCache = new LaunchpadCacheImpl();
