export type CostingMethod = 'fifo' | 'weightedAverage' | 'standard';

export interface CostLayer {
  quantity: number;
  unitCost: number;
  batchId?: string;
  expiryDate?: string;
  serialNumbers?: string[];
  warehouseId?: string;
}

export interface CostResult {
  issuedQuantity: number;
  cost: number;
  layersConsumed: CostLayer[];
  remainingLayers: CostLayer[];
}

export interface CostingStrategy {
  issueCost(quantity: number, layers: CostLayer[]): CostResult;
}

export class FifoCostingStrategy implements CostingStrategy {
  public issueCost(quantity: number, layers: CostLayer[]): CostResult {
    if (quantity <= 0) {
      return { issuedQuantity: 0, cost: 0, layersConsumed: [], remainingLayers: [...layers] };
    }

    let remaining = quantity;
    let cost = 0;
    const layersConsumed: CostLayer[] = [];
    const remainingLayers: CostLayer[] = [];

    for (const layer of layers) {
      if (remaining <= 0) {
        remainingLayers.push({ ...layer });
        continue;
      }

      const used = Math.min(remaining, layer.quantity);
      cost += used * layer.unitCost;
      remaining -= used;

      layersConsumed.push({
        ...layer,
        quantity: used,
      });

      if (layer.quantity > used) {
        remainingLayers.push({
          ...layer,
          quantity: layer.quantity - used,
        });
      }
    }

    return {
      issuedQuantity: quantity - remaining,
      cost: Number(cost.toFixed(2)),
      layersConsumed,
      remainingLayers,
    };
  }
}

export class WeightedAverageCostingStrategy implements CostingStrategy {
  public issueCost(quantity: number, layers: CostLayer[]): CostResult {
    if (quantity <= 0) {
      return { issuedQuantity: 0, cost: 0, layersConsumed: [], remainingLayers: [...layers] };
    }

    const totalQuantity = layers.reduce((sum, layer) => sum + layer.quantity, 0);
    const averageCost = totalQuantity === 0 ? 0 : layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0) / totalQuantity;
    const consumedLayers: CostLayer[] = [];
    let remaining = quantity;
    const remainingLayers: CostLayer[] = [];

    for (const layer of layers) {
      if (remaining <= 0) {
        remainingLayers.push({ ...layer });
        continue;
      }

      const used = Math.min(remaining, layer.quantity);
      consumedLayers.push({ ...layer, quantity: used });
      remaining -= used;

      if (layer.quantity > used) {
        remainingLayers.push({ ...layer, quantity: layer.quantity - used });
      }
    }

    return {
      issuedQuantity: quantity - remaining,
      cost: Number(((quantity - remaining) * averageCost).toFixed(2)),
      layersConsumed: consumedLayers,
      remainingLayers,
    };
  }
}

export class CostingEngine {
  private readonly strategies: Record<CostingMethod, CostingStrategy> = {
    fifo: new FifoCostingStrategy(),
    weightedAverage: new WeightedAverageCostingStrategy(),
    standard: new FifoCostingStrategy(),
  };

  public createLayer(
    quantity: number,
    unitCost: number,
    batchId?: string,
    expiryDate?: string,
    serialNumbers?: string[],
    warehouseId?: string,
  ): CostLayer {
    return {
      quantity,
      unitCost,
      batchId,
      expiryDate,
      serialNumbers,
      warehouseId,
    };
  }

  public registerStrategy(method: CostingMethod, strategy: CostingStrategy): void {
    this.strategies[method] = strategy;
  }

  public resolveMethod(settings?: { costingMethod?: CostingMethod }): CostingMethod {
    return settings?.costingMethod ?? 'fifo';
  }

  public issueCost(quantity: number, layers: CostLayer[], method: CostingMethod = 'fifo'): CostResult {
    const strategy = this.strategies[method] ?? this.strategies.fifo;
    return strategy.issueCost(quantity, layers);
  }

  public calculateFifoCost(quantity: number, layers: CostLayer[]): number {
    return this.issueCost(quantity, layers, 'fifo').cost;
  }

  public calculateWeightedAverageCost(layers: CostLayer[]): number {
    const totalQuantity = layers.reduce((sum, layer) => sum + layer.quantity, 0);
    if (totalQuantity === 0) {
      return 0;
    }

    const totalCost = layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0);
    return Number((totalCost / totalQuantity).toFixed(2));
  }
}
