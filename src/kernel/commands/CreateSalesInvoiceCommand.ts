/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : CreateSalesInvoiceCommand & Handler
 * Standard     : SMAP Constitution v1.0 — Command Bus Pipeline
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import logger from "../../core/logging/logger.js";
import { ICommand, ICommandHandler, ITenantContext, SPK } from "../SPK.js";
import { ISalesService, SalesInvoiceRecord } from "../public/ISalesService.js";

export class CreateSalesInvoiceCommand implements ICommand {
  public readonly type = "CREATE_SALES_INVOICE";
  constructor(public readonly payload: Partial<SalesInvoiceRecord>) {}
}

export class CreateSalesInvoiceCommandHandler implements ICommandHandler<CreateSalesInvoiceCommand, SalesInvoiceRecord> {
  async execute(command: CreateSalesInvoiceCommand, context: ITenantContext): Promise<SalesInvoiceRecord> {
    const data = command.payload;

    /* UVE Validation Rules */
    if (!data.lines || data.lines.length === 0) {
      throw new Error("[UVE Validation Error] Sales Invoice must contain at least one line item.");
    }
    if (!data.netPayable || data.netPayable <= 0) {
      throw new Error("[UVE Validation Error] Sales Invoice net payable amount must be greater than zero.");
    }

    logger.debug(`[SPK Command] Executing CreateSalesInvoiceCommand for tenant: ${context.tenantId}, operator: ${context.userName}`);

    const salesService = SPK.services.resolve<ISalesService>("SALES");
    const saved = await salesService.saveInvoice(data);

    return saved;
  }
}
