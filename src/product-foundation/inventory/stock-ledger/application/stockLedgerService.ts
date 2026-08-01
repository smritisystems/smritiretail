import { StockLedgerEngine, StockLedgerEntry, StockMovement } from '../domain/stockLedger';
import { InventorySettingsService, InventorySettingsContext } from '../../settings/application/inventorySettingsService';

export class StockLedgerService {
  private readonly engine = new StockLedgerEngine();
  private readonly settingsService: InventorySettingsService;

  constructor(settingsService?: InventorySettingsService) {
    this.settingsService = settingsService ?? new InventorySettingsService();
  }

  public applyMovement(entry: StockLedgerEntry, movement: StockMovement): StockLedgerEntry {
    const settingsContext: InventorySettingsContext = {
      itemId: entry.itemId,
      warehouseId: movement.warehouseId ?? entry.warehouseId,
      companyId: entry.companyId,
    };

    const costSettings = this.settingsService.resolveSettings(settingsContext);
    return this.engine.applyMovement(entry, movement, costSettings);
  }

  public reserve(entry: StockLedgerEntry, quantity: number): StockLedgerEntry {
    return this.engine.reserve(entry, quantity);
  }
}
