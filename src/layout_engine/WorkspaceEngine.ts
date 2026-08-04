/**
 * SMRITI Retail OS
 * Module      : SMRITI Adaptive Workspace Engine (SAWE)
 * Standard    : SXP v1.0 / SWEF P-012
 * Author      : Jawahar Ramkripal Mallah
 * Version     : 1.0.0
 * Created     : 2026-08-04
 * Copyright   : © SMRITIBooks.com. All Rights Reserved.
 * License     : Proprietary Commercial Software
 *
 * PURPOSE: Provide a unified workspace card contract and platform engine for
 * adaptive workspace cards, role-aware visibility, dock state, and layout
 * persistence across desktop, tablet, and mobile surfaces.
 */

import type { ReactNode } from "react";
import { DashboardWidget, WidgetType } from "../kernel/upr/dashboard/DashboardRegistry.js";
import { adaptiveWorkspaceStore, WorkspaceMode } from "./adaptive_workspace_store.js";
import { WorkspaceEventBus } from "./WorkspaceEventBus.js";
import { WorkspacePersonalizationEngine, WidgetLayoutConfig } from "./WorkspacePersonalizationEngine.js";

export type WorkspaceCardState =
  | "visible"
  | "hidden"
  | "collapsed"
  | "pinned"
  | "favorite"
  | "floating"
  | "fullscreen"
  | "loading"
  | "error"
  | "offline";

export type WorkspaceCardDockPosition = "left" | "right" | "top" | "bottom" | "center";

export interface WorkspaceCard extends DashboardWidget {
  icon?: string;
  state?: WorkspaceCardState;
  dock?: WorkspaceCardDockPosition;
  permissions?: string[];
  visibility?: WorkspaceMode[];
  actions?: string[];
  toolbarItems?: ReactNode;
  metadata?: Record<string, unknown>;
}

export class WorkspaceEngineService {
  private readonly cards: Map<string, Map<string, WorkspaceCard>> = new Map();

  public registerCard(workspaceId: string, card: WorkspaceCard): void {
    const workspaceCards = this.cards.get(workspaceId) ?? new Map<string, WorkspaceCard>();
    workspaceCards.set(card.id, card);
    this.cards.set(workspaceId, workspaceCards);
    WorkspaceEventBus.publish("CardOpened", { workspaceId, cardId: card.id, card }, workspaceId);
  }

  public getCard(workspaceId: string, cardId: string): WorkspaceCard | undefined {
    return this.cards.get(workspaceId)?.get(cardId);
  }

  public getCards(workspaceId: string): WorkspaceCard[] {
    return Array.from(this.cards.get(workspaceId)?.values() ?? []);
  }

  public getVisibleCards(workspaceId: string, mode?: WorkspaceMode): WorkspaceCard[] {
    const effectiveMode = mode ?? adaptiveWorkspaceStore.getMode();
    return this.getCards(workspaceId).filter((card) => {
      if (card.state === "hidden") return false;
      if (card.visibility && card.visibility.length > 0) {
        return card.visibility.includes(effectiveMode);
      }
      return true;
    });
  }

  public updateCardState(workspaceId: string, cardId: string, state: WorkspaceCardState): void {
    const card = this.getCard(workspaceId, cardId);
    if (!card) return;
    card.state = state;
    WorkspaceEventBus.publish("CardStateChanged", { workspaceId, cardId, state }, workspaceId);
  }

  public saveWorkspaceLayout(workspaceId: string, layout: WidgetLayoutConfig[]): void {
    WorkspacePersonalizationEngine.saveDashboardLayout(workspaceId, layout);
    WorkspaceEventBus.publish("LayoutSaved", { workspaceId, layout }, workspaceId);
  }
}

export const WorkspaceEngine = new WorkspaceEngineService();
