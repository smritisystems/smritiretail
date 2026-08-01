import { CostingMethod } from '../../costing/domain/costing';
import { InventorySettings, NegativeStockPolicy } from '../domain/inventorySettings';
import { InventorySettingsRepository, InMemoryInventorySettingsRepository } from '../domain/inventorySettingsRepository';

export interface InventorySettingsContext {
  itemId?: string;
  warehouseId?: string;
  companyId?: string;
}

export interface InventorySettingsOverrideSets {
  itemSettings?: Record<string, InventorySettings>;
  warehouseSettings?: Record<string, InventorySettings>;
  companySettings?: Record<string, InventorySettings>;
  defaultSettings?: InventorySettings;
}

export class InventorySettingsService {
  private readonly repository: InventorySettingsRepository;

  constructor(overrides?: InventorySettingsOverrideSets, repository?: InventorySettingsRepository) {
    this.repository = repository ?? new InMemoryInventorySettingsRepository(overrides);
  }

  public resolveSettings(context: InventorySettingsContext): InventorySettings {
    return this.repository.resolveSettings(context);
  }

  public resolveCostingMethod(context: InventorySettingsContext): CostingMethod {
    return this.resolveSettings(context).costingMethod ?? 'fifo';
  }

  public defaultSettings(): InventorySettings {
    return this.resolveSettings({});
  }
}
