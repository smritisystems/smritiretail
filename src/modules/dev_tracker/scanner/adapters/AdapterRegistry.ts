/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / SADS v1.0)
 * Description  : Central Pluggable Adapter Registry & Pipeline Orchestrator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IAdapter, AdapterHealth } from "./types.ts";
import { EvidenceGraphContainer } from "./EvidenceGraph.ts";
import { FastAPIAdapter } from "./FastAPIAdapter.ts";
import { SQLAlchemyAdapter } from "./SQLAlchemyAdapter.ts";
import { ReactAdapter } from "./ReactAdapter.ts";
import { PytestAdapter } from "./PytestAdapter.ts";

export class AdapterRegistry {
  private adapters: Map<string, IAdapter> = new Map();

  constructor() {
    // Register Default Engine Adapters (SDS v2.3)
    this.register(new FastAPIAdapter());
    this.register(new SQLAlchemyAdapter());
    this.register(new ReactAdapter());
    this.register(new PytestAdapter());
  }

  public register(adapter: IAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public unregister(adapterId: string): void {
    this.adapters.delete(adapterId);
  }

  public enable(adapterId: string): void {
    const adapter = this.adapters.get(adapterId);
    if (adapter) adapter.enabled = true;
  }

  public disable(adapterId: string): void {
    const adapter = this.adapters.get(adapterId);
    if (adapter) adapter.enabled = false;
  }

  public getAdapters(): IAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.enabled);
  }

  public getHealth(): AdapterHealth[] {
    return Array.from(this.adapters.values()).map(a => a.healthCheck());
  }

  public executeAll(fileContentsMap: Map<string, string>, evidenceGraph: EvidenceGraphContainer): void {
    const activeAdapters = this.getAdapters().sort((a, b) => b.priority - a.priority);

    for (const [filePath, content] of fileContentsMap.entries()) {
      for (const adapter of activeAdapters) {
        if (adapter.canHandle(filePath)) {
          const items = adapter.extract(filePath, content);
          for (const item of items) {
            // Attribute evidence item to module based on file path keyword match
            const moduleId = this.inferModuleId(item.file);
            evidenceGraph.addEvidence(moduleId, item);

            if (item.category === "api") {
              evidenceGraph.addDiscoveredRoute(item.file);
            }
            if (item.category === "database") {
              evidenceGraph.addDiscoveredModel(item.file);
            }
            if (item.category === "testing") {
              evidenceGraph.addDiscoveredTest(item.file);
            }
          }
        }
      }
    }
  }

  private inferModuleId(filePath: string): string {
    const rel = filePath.toLowerCase().replace(/\\/g, "/");
    if (rel.includes("pos") || rel.includes("billing")) return "pos";
    if (rel.includes("item") || rel.includes("barcode") || rel.includes("product")) return "item-master";
    if (rel.includes("crm") || rel.includes("customer")) return "crm";
    if (rel.includes("sales") || rel.includes("invoice")) return "sales";
    if (rel.includes("purchase") || rel.includes("po")) return "purchase";
    if (rel.includes("loyalty") || rel.includes("wallet")) return "loyalty";
    if (rel.includes("analytics") || rel.includes("dashboard")) return "dashboard";
    return "about-smriti";
  }
}

export const defaultAdapterRegistry = new AdapterRegistry();
