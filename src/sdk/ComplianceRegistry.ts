/**
 * Project      : SMRITI Retail OS
 * Architecture : SMRITI Compliance Platform (SCP v1.0 Kernel)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: Internal Platform Standard (SCP-001)
 */

import logger from "../core/logging/logger.js";
import { IComplianceModule } from "./IComplianceModule";

export class ComplianceRegistry {
  private static instance: ComplianceRegistry;
  private modules: Map<string, IComplianceModule> = new Map();

  private constructor() {}

  public static getInstance(): ComplianceRegistry {
    if (!ComplianceRegistry.instance) {
      ComplianceRegistry.instance = new ComplianceRegistry();
    }
    return ComplianceRegistry.instance;
  }

  public registerModule(module: IComplianceModule): void {
    if (this.modules.has(module.id)) {
      logger.warn(`[ComplianceRegistry] Overwriting existing compliance module: ${module.id}`);
    }
    this.modules.set(module.id, module);
  }

  public getModule(id: string): IComplianceModule | undefined {
    return this.modules.get(id);
  }

  public getAllModules(): IComplianceModule[] {
    return Array.from(this.modules.values());
  }

  public getModulesByCategory(category: 'TAX' | 'REGULATORY' | 'LABOUR' | 'CORPORATE'): IComplianceModule[] {
    return this.getAllModules().filter((m) => m.category === category);
  }
}

export const complianceRegistry = ComplianceRegistry.getInstance();
