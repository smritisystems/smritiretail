/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / SADS v1.0)
 * Description  : Central Evidence Graph Intermediate Representation Container
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { EvidenceItem } from "../../models/interfaces.ts";
import { DiscoveredEvidenceGraph } from "./types.ts";

export class EvidenceGraphContainer implements DiscoveredEvidenceGraph {
  public moduleEvidenceMap: Map<string, EvidenceItem[]> = new Map();
  public allEvidence: EvidenceItem[] = [];
  public routesDiscovered: string[] = [];
  public modelsDiscovered: string[] = [];
  public testsDiscovered: string[] = [];

  public addEvidence(moduleId: string, item: EvidenceItem): void {
    if (!this.moduleEvidenceMap.has(moduleId)) {
      this.moduleEvidenceMap.set(moduleId, []);
    }
    const items = this.moduleEvidenceMap.get(moduleId)!;
    if (!items.some(e => e.file === item.file && e.category === item.category && e.symbol === item.symbol)) {
      items.push(item);
    }
    if (!this.allEvidence.some(e => e.file === item.file && e.category === item.category && e.symbol === item.symbol)) {
      this.allEvidence.push(item);
    }
  }

  public addDiscoveredRoute(route: string): void {
    if (!this.routesDiscovered.includes(route)) {
      this.routesDiscovered.push(route);
    }
  }

  public addDiscoveredModel(model: string): void {
    if (!this.modelsDiscovered.includes(model)) {
      this.modelsDiscovered.push(model);
    }
  }

  public addDiscoveredTest(testFile: string): void {
    if (!this.testsDiscovered.includes(testFile)) {
      this.testsDiscovered.push(testFile);
    }
  }

  public getEvidenceForModule(moduleId: string): EvidenceItem[] {
    return this.moduleEvidenceMap.get(moduleId) || [];
  }
}
