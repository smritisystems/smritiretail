import { CostLayer, CostingEngine, CostingMethod } from '../../costing/domain/costing';
import { InventorySettings, NegativeStockPolicy } from '../../settings/domain/inventorySettings';

export interface StockMovement {
  id: string;
  quantity: number;
  type: 'in' | 'out' | 'transfer';
  consumeReserved?: boolean;
  unitCost?: number;
  batchId?: string;
  expiryDate?: string;
  warehouseId?: string;
  serialNumbers?: string[];
  costingMethod?: CostingMethod;
}

export interface StockLedgerEntry {
  itemId: string;
  companyId?: string;
  quantity: number;
  onHand?: number;
  reserved?: number;
  allowNegative?: boolean;
  batchId?: string;
  serialNumbers?: string[];
  warehouseId?: string;
  costLayers?: CostLayer[];
  inventoryValue?: number;
  lastIssuedCost?: number;
  available?: number;
  warnings?: string[];
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function sumLayerCost(layers: CostLayer[] = []): number {
  return Number(layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0).toFixed(2));
}

export class StockLedgerEngine {
  private readonly costingEngine = new CostingEngine();

  public applyMovement(entry: StockLedgerEntry, movement: StockMovement, settings?: InventorySettings): StockLedgerEntry {
    const onHand = entry.onHand ?? entry.quantity;
    const reserved = entry.reserved ?? 0;
    const currentLayers = entry.costLayers ? [...entry.costLayers] : [];

    let updatedOnHand = onHand;
    let updatedReserved = reserved;
    let updatedLayers = currentLayers;
    let inventoryValue = sumLayerCost(updatedLayers);
    let lastIssuedCost = entry.lastIssuedCost;

    let warnings: string[] = entry.warnings ? [...entry.warnings] : [];

    if (movement.type === 'in') {
      if (movement.unitCost === undefined) {
        throw new Error('Incoming stock requires unitCost for costing.');
      }

      updatedOnHand = round(onHand + movement.quantity);
      updatedLayers = [
        ...updatedLayers,
        {
          quantity: movement.quantity,
          unitCost: movement.unitCost,
          batchId: movement.batchId,
          expiryDate: movement.expiryDate,
          serialNumbers: movement.serialNumbers,
          warehouseId: movement.warehouseId,
        },
      ];
      inventoryValue = sumLayerCost(updatedLayers);
    } else if (movement.type === 'out') {
      const candidateOnHand = round(onHand - movement.quantity);
      const candidateReserved = movement.consumeReserved
        ? round(Math.max(reserved - movement.quantity, 0))
        : reserved;
      const candidateAvailable = round(candidateOnHand - candidateReserved);
      const policyFromSettings = settings?.negativeStockPolicy ?? NegativeStockPolicy.BLOCK;
      const effectiveNegativeStockPolicy = entry.allowNegative ? NegativeStockPolicy.ALLOW : policyFromSettings;

      if (candidateAvailable < 0 && effectiveNegativeStockPolicy === NegativeStockPolicy.BLOCK) {
        throw new Error('Insufficient stock for movement');
      }

      if (candidateAvailable < 0 && effectiveNegativeStockPolicy === NegativeStockPolicy.WARN) {
        warnings.push('Negative stock allowed by policy');
      }

      const method = movement.costingMethod ?? this.costingEngine.resolveMethod(settings);
      const costResult = this.costingEngine.issueCost(movement.quantity, updatedLayers, method);
      updatedLayers = costResult.remainingLayers;
      inventoryValue = sumLayerCost(updatedLayers);
      lastIssuedCost = costResult.cost;
      updatedOnHand = candidateOnHand;
      updatedReserved = candidateReserved;
    }

    const updatedQuantity = round(updatedOnHand - updatedReserved);
    const updatedAvailable = round(updatedOnHand - updatedReserved);

    return {
      ...entry,
      onHand: updatedOnHand,
      reserved: updatedReserved,
      quantity: updatedQuantity,
      available: updatedAvailable,
      costLayers: updatedLayers,
      inventoryValue,
      lastIssuedCost,
      warnings: warnings.length ? warnings : undefined,
    };
  }

  public reserve(entry: StockLedgerEntry, quantity: number): StockLedgerEntry {
    if (quantity <= 0) {
      throw new Error('Reservation quantity must be greater than zero');
    }

    const onHand = entry.onHand ?? entry.quantity;
    const reserved = entry.reserved ?? 0;
    const available = round(onHand - reserved);

    if (quantity > available && !entry.allowNegative) {
      throw new Error('Insufficient available stock to reserve');
    }

    const updatedReserved = round(reserved + quantity);
    const updatedQuantity = round(onHand - updatedReserved);

    return {
      ...entry,
      onHand,
      reserved: updatedReserved,
      quantity: updatedQuantity,
      available: round(onHand - updatedReserved),
    };
  }
}
