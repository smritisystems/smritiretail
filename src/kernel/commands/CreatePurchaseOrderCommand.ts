/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : CreatePurchaseOrderCommand & Handler
 * Standard     : SMAP Constitution v1.0 — Command Bus Pipeline
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ICommand, ICommandHandler, ITenantContext, SPK } from "../SPK.js";
import { IPurchaseService, PurchaseOrderRecord } from "../public/IPurchaseService.js";

export class CreatePurchaseOrderCommand implements ICommand {
  public readonly type = "CREATE_PURCHASE_ORDER";
  constructor(public readonly payload: Partial<PurchaseOrderRecord>) {}
}

export class CreatePurchaseOrderCommandHandler implements ICommandHandler<CreatePurchaseOrderCommand, PurchaseOrderRecord> {
  async execute(command: CreatePurchaseOrderCommand, context: ITenantContext): Promise<PurchaseOrderRecord> {
    const data = command.payload;

    /* UVE Validation Rules */
    if (!data.supplierName && !data.supplierId) {
      throw new Error("[UVE Validation Error] Supplier is required for Purchase Order creation.");
    }
    if (!data.lines || data.lines.length === 0) {
      throw new Error("[UVE Validation Error] Purchase Order must contain at least one line item.");
    }

    logger.debug(`[SPK Command] Executing CreatePurchaseOrderCommand for tenant: ${context.tenantId}, operator: ${context.userName}`);

    const purchaseService = SPK.services.resolve<IPurchaseService>("PURCHASE");
    const saved = await purchaseService.savePO(data);

    return saved;
  }
}
