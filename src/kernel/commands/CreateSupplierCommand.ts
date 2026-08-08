/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : CreateSupplierCommand & Handler
 * Standard     : SMAP Constitution v1.0 — Command Bus Pipeline
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import logger from "../../core/logging/logger.js";
import { ICommand, ICommandHandler, ITenantContext, SPK } from "../SPK.js";
import { ISupplierService, SupplierRecord } from "../public/ISupplierService.js";

export class CreateSupplierCommand implements ICommand {
  public readonly type = "CREATE_SUPPLIER";
  constructor(public readonly payload: Partial<SupplierRecord>) {}
}

export class CreateSupplierCommandHandler implements ICommandHandler<CreateSupplierCommand, SupplierRecord> {
  async execute(command: CreateSupplierCommand, context: ITenantContext): Promise<SupplierRecord> {
    const data = command.payload;

    /* UVE Validation Rules */
    if (!data.name || !data.name.trim()) {
      throw new Error("[UVE Validation Error] Supplier Name is required.");
    }
    if (!data.mobile || !data.mobile.trim()) {
      throw new Error("[UVE Validation Error] Supplier contact mobile number is required.");
    }

    logger.debug(`[SPK Command] Executing CreateSupplierCommand for tenant: ${context.tenantId}, operator: ${context.userName}`);

    const supplierService = SPK.services.resolve<ISupplierService>("SUPPLIER");
    const saved = await supplierService.save(data);

    return saved;
  }
}
