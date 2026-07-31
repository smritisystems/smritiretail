/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : CreateCustomerCommand & Handler
 * Standard     : SMAP Constitution v1.0 — Command Bus Pipeline
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { Customer } from "../../types.js";
import { ICommand, ICommandHandler, ITenantContext, SPK } from "../SPK.js";
import { ICustomerService } from "../public/ICustomerService.js";

export class CreateCustomerCommand implements ICommand {
  public readonly type = "CREATE_CUSTOMER";
  constructor(public readonly payload: Partial<Customer>) {}
}

export class CreateCustomerCommandHandler implements ICommandHandler<CreateCustomerCommand, Customer> {
  async execute(command: CreateCustomerCommand, context: ITenantContext): Promise<Customer> {
    const data = command.payload;

    /* UVE Validation Rules */
    if (!data.name || !data.name.trim()) {
      throw new Error("[UVE Validation Error] Customer Name is required.");
    }
    if (!data.mobile || !data.mobile.trim()) {
      throw new Error("[UVE Validation Error] Mobile number is required.");
    }

    console.log(`[SPK Command] Executing CreateCustomerCommand for tenant: ${context.tenantId}, operator: ${context.userName}`);

    const customerService = SPK.services.resolve<ICustomerService>("CUSTOMER");
    const saved = await customerService.save(data);

    return saved;
  }
}
