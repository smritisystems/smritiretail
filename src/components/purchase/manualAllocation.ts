export type AllocationMethodValue = "VALUE" | "QUANTITY" | "WEIGHT" | "MANUAL";

export type ManualAllocationsMap = Record<string, Record<string, number>>;

export interface ManualAllocationLineLike {
  rowId: string;
  quantity_received: number;
  quantity_damaged: number;
  invoice_rate: number;
  trade_discount: number;
}

export interface ManualAllocationCostLike {
  id: string;
  amount: number;
}

export const roundCurrency = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export const normalizeAllocationMethod = (method?: string | null): AllocationMethodValue => {
  switch (String(method ?? "").trim().toUpperCase()) {
    case "MANUAL":
      return "MANUAL";
    case "QUANTITY":
      return "QUANTITY";
    case "WEIGHT":
      return "WEIGHT";
    case "VALUE":
    default:
      return "VALUE";
  }
};

export const buildManualAllocationMatrix = ({
  grnLines,
  costItems,
  manualAllocations = {},
  defaultBaseMethod = "VALUE",
}: {
  grnLines: ManualAllocationLineLike[];
  costItems: ManualAllocationCostLike[];
  manualAllocations?: ManualAllocationsMap;
  defaultBaseMethod?: "VALUE" | "QUANTITY";
}): ManualAllocationsMap => {
  const matrix: ManualAllocationsMap = {};

  costItems.forEach((costItem) => {
    const eligibleRows = grnLines
      .map((row) => {
        const accepted = Math.max(0, Number(row.quantity_received || 0) - Number(row.quantity_damaged || 0));
        const netRate = Math.max(0, Number(row.invoice_rate || 0) - Number(row.trade_discount || 0));
        return {
          rowId: row.rowId,
          accepted,
          netRate,
          lineValue: accepted * netRate,
        };
      })
      .filter((row) => row.accepted > 0);

    const componentAmount = Number(costItem.amount || 0);
    const totalBase = eligibleRows.reduce((sum, row) => {
      const weight = defaultBaseMethod === "QUANTITY" ? row.accepted : row.lineValue;
      return sum + (Number.isFinite(weight) ? weight : 0);
    }, 0);

    const rowAllocations: Record<string, number> = {};
    eligibleRows.forEach((row) => {
      const existing = Number(manualAllocations[costItem.id]?.[row.rowId]);
      const baseWeight = defaultBaseMethod === "QUANTITY" ? row.accepted : row.lineValue;
      const fallback = totalBase > 0 ? (componentAmount * baseWeight) / totalBase : componentAmount / Math.max(eligibleRows.length, 1);

      rowAllocations[row.rowId] = Number.isFinite(existing) ? roundCurrency(existing) : roundCurrency(fallback);
    });

    matrix[costItem.id] = rowAllocations;
  });

  return matrix;
};

export const getManualAllocationVariance = ({
  costItem,
  grnLines,
  manualAllocations = {},
  defaultBaseMethod = "VALUE",
}: {
  costItem: ManualAllocationCostLike;
  grnLines: ManualAllocationLineLike[];
  manualAllocations?: ManualAllocationsMap;
  defaultBaseMethod?: "VALUE" | "QUANTITY";
}) => {
  const matrix = buildManualAllocationMatrix({
    grnLines,
    costItems: [costItem],
    manualAllocations,
    defaultBaseMethod,
  });

  const allocatedTotal = Object.values(matrix[costItem.id] ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const variance = roundCurrency(Number(costItem.amount || 0) - allocatedTotal);

  return {
    allocatedTotal: roundCurrency(allocatedTotal),
    variance,
    isBalanced: Math.abs(variance) <= 0.05,
  };
};

export const calculateManualLineAllocations = ({
  grnLines,
  costItems,
  manualAllocations = {},
  defaultBaseMethod = "VALUE",
}: {
  grnLines: ManualAllocationLineLike[];
  costItems: ManualAllocationCostLike[];
  manualAllocations?: ManualAllocationsMap;
  defaultBaseMethod?: "VALUE" | "QUANTITY";
}) => {
  const matrix = buildManualAllocationMatrix({
    grnLines,
    costItems,
    manualAllocations,
    defaultBaseMethod,
  });

  return grnLines.map((row) => {
    const accepted = Math.max(0, Number(row.quantity_received || 0) - Number(row.quantity_damaged || 0));
    const netRate = Math.max(0, Number(row.invoice_rate || 0) - Number(row.trade_discount || 0));
    const allocatedAmount = costItems.reduce((sum, costItem) => {
      return sum + Number(matrix[costItem.id]?.[row.rowId] || 0);
    }, 0);

    const addonPerUnit = accepted > 0 ? roundCurrency(allocatedAmount / accepted) : 0;
    const landedCost = roundCurrency(netRate + addonPerUnit);

    return {
      allocatedAmount: roundCurrency(allocatedAmount),
      addonPerUnit,
      landedCost,
    };
  });
};
