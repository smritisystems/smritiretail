/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : CreateItemCommand & Handler
 * Standard     : SMAP Constitution v1.0 — Command Bus Pipeline
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { Product } from "../../types.js";
import { ICommand, ICommandHandler, ITenantContext, SPK } from "../SPK.js";
import { IItemService } from "../public/IItemService.js";

export class CreateItemCommand implements ICommand {
  public readonly type = "CREATE_ITEM";
  constructor(public readonly payload: Partial<Product>) {}
}

export class CreateItemCommandHandler implements ICommandHandler<CreateItemCommand, Product> {
  async execute(command: CreateItemCommand, context: ITenantContext): Promise<Product> {
    const data = command.payload;

    /* UVE Validation Rule Check */
    if (!data.name || !data.name.trim()) {
      throw new Error("[UVE Validation Error] Item Name is required.");
    }
    if (data.price !== undefined && data.mrp !== undefined && data.price > data.mrp && data.mrp > 0) {
      throw new Error("[UVE Validation Error] Selling price cannot exceed MRP.");
    }

    console.log(`[SPK Command] Executing CreateItemCommand for tenant: ${context.tenantId}, operator: ${context.userName}`);
    
    const itemService = SPK.services.resolve<IItemService>("ITEM");
    const saved = await itemService.save(data);
    
    return saved;
  }
}
