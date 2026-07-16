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

import { ContextAction, ContextData } from "./ContextAction.ts";

class ContextRegistry {
  private actions: ContextAction[] = [];
  private recentActionIds: string[] = [];
  private favoriteActionIds: string[] = [];
  private pinnedActionIds: string[] = [];

  constructor() {
    // Load favorites & pinned from localStorage if offline-persistence is available
    try {
      const favs = localStorage.getItem("smriti_acas_favorites");
      if (favs) this.favoriteActionIds = JSON.parse(favs);
      const pinned = localStorage.getItem("smriti_acas_pinned");
      if (pinned) this.pinnedActionIds = JSON.parse(pinned);
      const recents = localStorage.getItem("smriti_acas_recents");
      if (recents) this.recentActionIds = JSON.parse(recents);
    } catch (e) {
      console.warn("Could not load ACAS persistent preferences", e);
    }
  }

  /**
   * Register a single context action
   */
  public register(action: ContextAction): void {
    if (this.actions.some(a => a.id === action.id)) {
      // Avoid duplicate actions
      this.actions = this.actions.filter(a => a.id !== action.id);
    }
    this.actions.push(action);
  }

  /**
   * Register multiple context actions
   */
  public registerMany(actionsList: ContextAction[]): void {
    actionsList.forEach(a => this.register(a));
  }

  /**
   * Unregister an action
   */
  public unregister(actionId: string): void {
    this.actions = this.actions.filter(a => a.id !== actionId);
  }

  /**
   * Track action execution to maintain "Recent Actions" lists
   */
  public recordExecution(actionId: string): void {
    this.recentActionIds = [actionId, ...this.recentActionIds.filter(id => id !== actionId)].slice(0, 8);
    try {
      localStorage.setItem("smriti_acas_recents", JSON.stringify(this.recentActionIds));
    } catch (e) {
      // Ignored in strict sandbox environment
    }
  }

  /**
   * Toggle Favorite status
   */
  public toggleFavorite(actionId: string): void {
    if (this.favoriteActionIds.includes(actionId)) {
      this.favoriteActionIds = this.favoriteActionIds.filter(id => id !== actionId);
    } else {
      this.favoriteActionIds.push(actionId);
    }
    try {
      localStorage.setItem("smriti_acas_favorites", JSON.stringify(this.favoriteActionIds));
    } catch (e) {}
  }

  /**
   * Toggle Pin status
   */
  public togglePin(actionId: string): void {
    if (this.pinnedActionIds.includes(actionId)) {
      this.pinnedActionIds = this.pinnedActionIds.filter(id => id !== actionId);
    } else {
      this.pinnedActionIds.push(actionId);
    }
    try {
      localStorage.setItem("smriti_acas_pinned", JSON.stringify(this.pinnedActionIds));
    } catch (e) {}
  }

  public getFavoriteIds(): string[] {
    return this.favoriteActionIds;
  }

  public getPinnedIds(): string[] {
    return this.pinnedActionIds;
  }

  public getRecentIds(): string[] {
    return this.recentActionIds;
  }

  /**
   * Retrieve dynamic, context-specific list of applicable actions
   */
  public getActions(context: ContextData): ContextAction[] {
    // 1. Evaluate visibility and filter unauthorized actions
    const filtered = this.actions.filter(action => {
      // Evaluate visible function if present
      if (typeof action.visible === "function") {
        try {
          return action.visible(context);
        } catch (e) {
          return false;
        }
      } else if (action.visible !== undefined) {
        return !!action.visible;
      }
      return true;
    });

    // 2. Map structural attributes (favorites, pinned, recents, dynamic AI promotions)
    return filtered.map(action => {
      const isFav = this.favoriteActionIds.includes(action.id);
      const isPinned = this.pinnedActionIds.includes(action.id);
      const isRecent = this.recentActionIds.includes(action.id);
      
      // Determine AI dynamic recommendations
      let isAiRecommended = false;
      if (typeof action.isAiRecommended === "function") {
        try {
          isAiRecommended = action.isAiRecommended(context);
        } catch (e) {
          isAiRecommended = false;
        }
      } else if (action.isAiRecommended !== undefined) {
        isAiRecommended = !!action.isAiRecommended;
      } else {
        // Run heuristic based predictive promotion
        isAiRecommended = this.evaluateHeuristicPromotion(action.id, context);
      }

      return {
        ...action,
        isFavorite: isFav,
        isPinned: isPinned,
        isRecent: isRecent,
        isAiRecommended: isAiRecommended
      };
    });
  }

  /**
   * Adaptive predictive action heuristic engine
   */
  private evaluateHeuristicPromotion(actionId: string, context: ContextData): boolean {
    const { type, object } = context;
    if (!type) return false;

    // AI Heuristics
    if (type === "invoice" || type === "bill") {
      const status = object?.status || "Pending";
      if (status === "Pending" && actionId.includes("receive-payment")) return true;
      if (status === "Completed" && (actionId.includes("print") || actionId.includes("share") || actionId.includes("whatsapp"))) return true;
    }

    if (type === "product" || type === "item") {
      const stock = Number(object?.stock ?? 100);
      if (stock <= 5 && actionId.includes("reorder")) return true;
      if (stock <= 5 && actionId.includes("purchase-order")) return true;
    }

    if (type === "customer") {
      const outstanding = Number(object?.outstanding ?? 0);
      if (outstanding > 0 && actionId.includes("reminder")) return true;
    }

    if (type === "purchase-order" || type === "purchase") {
      const status = object?.status || "Draft";
      if (status === "Draft" && actionId.includes("submit")) return true;
    }

    return false;
  }
}

export const registry = new ContextRegistry();
export default registry;
