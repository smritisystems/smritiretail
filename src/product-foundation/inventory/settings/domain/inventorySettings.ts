import { CostingMethod } from '../../costing/domain/costing';

export enum NegativeStockPolicy {
  ALLOW = 'ALLOW',
  WARN = 'WARN',
  BLOCK = 'BLOCK',
}

export interface InventorySettings {
  costingMethod?: CostingMethod;
  negativeStockPolicy?: NegativeStockPolicy;
}
