/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : ResolveTaxCommand & Handler
 * Standard     : SMRITI Tax Governance Constitution (TG-001 — TG-006)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import logger from "../../core/logging/logger.js";
import { ICommand, ICommandHandler, ITenantContext, SPK } from "../SPK.js";
import {
  DocumentTaxSnapshot,
  ITaxResolutionEngine,
  TaxResolutionRequest
} from "../public/ITaxResolutionEngine.js";

export interface ResolveTaxPayload {
  companyState: string;
  placeOfSupply: string;
  documentDate: string;
  lines: TaxResolutionRequest[];
}

export class ResolveTaxCommand implements ICommand {
  public readonly type = "RESOLVE_TAX";
  constructor(public readonly payload: ResolveTaxPayload) {}
}

export class ResolveTaxCommandHandler implements ICommandHandler<ResolveTaxCommand, DocumentTaxSnapshot> {
  async execute(command: ResolveTaxCommand, context: ITenantContext): Promise<DocumentTaxSnapshot> {
    const { companyState, placeOfSupply, documentDate, lines } = command.payload;

    logger.debug(`[STRE Engine] Executing ResolveTaxCommand for tenant: ${context.tenantId}, lines count: ${lines.length}`);

    const taxEngine = SPK.services.resolve<ITaxResolutionEngine>("TAX_ENGINE");
    const snapshot = taxEngine.createDocumentTaxSnapshot(
      companyState,
      placeOfSupply,
      documentDate,
      lines
    );

    return snapshot;
  }
}
