import { InventorySettings } from './inventorySettings';
import { InventorySettingsContext } from '../../settings/application/inventorySettingsService';

export interface InventorySettingsRepository {
  resolveSettings(context: InventorySettingsContext): InventorySettings;
}

export class InMemoryInventorySettingsRepository implements InventorySettingsRepository {
  private readonly itemSettings: Record<string, InventorySettings>;
  private readonly warehouseSettings: Record<string, InventorySettings>;
  private readonly companySettings: Record<string, InventorySettings>;
  private readonly defaultSettings: InventorySettings;

  constructor(overrides?: {
    itemSettings?: Record<string, InventorySettings>;
    warehouseSettings?: Record<string, InventorySettings>;
    companySettings?: Record<string, InventorySettings>;
    defaultSettings?: InventorySettings;
  }) {
    this.itemSettings = overrides?.itemSettings ?? {};
    this.warehouseSettings = overrides?.warehouseSettings ?? {};
    this.companySettings = overrides?.companySettings ?? {};
    this.defaultSettings = overrides?.defaultSettings ?? { costingMethod: 'fifo' };
  }

  public resolveSettings(context: InventorySettingsContext): InventorySettings {
    if (context.itemId && this.itemSettings[context.itemId]) {
      return this.itemSettings[context.itemId];
    }
    if (context.warehouseId && this.warehouseSettings[context.warehouseId]) {
      return this.warehouseSettings[context.warehouseId];
    }
    if (context.companyId && this.companySettings[context.companyId]) {
      return this.companySettings[context.companyId];
    }
    return this.defaultSettings;
  }
}
