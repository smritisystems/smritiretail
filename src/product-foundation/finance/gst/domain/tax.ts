export type TaxMode = 'exclusive' | 'inclusive';
export type SupplyType = 'intra-state' | 'inter-state';
export type RoundingMode = 'HALF_UP' | 'HALF_EVEN';

export interface TaxRule {
  id: string;
  rate?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cessRate?: number;
  description?: string;
  hsnCode?: string;
}

export interface TaxContext {
  itemId: string;
  baseAmount: number;
  taxRateId: string;
  taxMode?: TaxMode;
  supplyType?: SupplyType;
  placeOfSupply?: string;
  hsnCode?: string;
  reverseCharge?: boolean;
  roundMode?: RoundingMode;
}

export interface GstBreakdown {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  grandTotal: number;
  taxMode: TaxMode;
  supplyType: SupplyType;
  reverseCharge: boolean;
  placeOfSupply?: string;
}

function roundToTwo(amount: number): number {
  return Number(amount.toFixed(2));
}

function validateHsnCode(hsnCode: string): boolean {
  return /^[0-9]{4,8}$/.test(hsnCode);
}

function findTaxRule(taxRateId: string, rules: TaxRule[]): TaxRule | undefined {
  return rules.find((ruleItem) => ruleItem.id === taxRateId);
}

function resolveRates(rule: TaxRule | undefined, supplyType: SupplyType): {
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
} {
  const rate = rule?.rate ?? 0;
  const cessRate = rule?.cessRate ?? 0;
  let cgstRate = rule?.cgstRate ?? 0;
  let sgstRate = rule?.sgstRate ?? 0;
  let igstRate = rule?.igstRate ?? 0;

  if (supplyType === 'inter-state') {
    if (igstRate === 0) {
      igstRate = rate;
    }
    cgstRate = 0;
    sgstRate = 0;
  } else {
    if (cgstRate === 0 && sgstRate === 0) {
      cgstRate = rate / 2;
      sgstRate = rate / 2;
    }
    igstRate = 0;
  }

  return {
    cgstRate,
    sgstRate,
    igstRate,
    cessRate,
  };
}

export class GstEngine {
  public validateHsnCode(hsnCode: string): boolean {
    return validateHsnCode(hsnCode);
  }

  public calculateTax(context: TaxContext, rules: TaxRule[]): number {
    return this.calculateBreakdown(context, rules).totalTax;
  }

  public calculateTotal(context: TaxContext, rules: TaxRule[]): number {
    return this.calculateBreakdown(context, rules).grandTotal;
  }

  public calculateBreakdown(context: TaxContext, rules: TaxRule[]): GstBreakdown {
    if (context.hsnCode && !validateHsnCode(context.hsnCode)) {
      throw new Error('Invalid HSN/SAC code');
    }

    const rule = findTaxRule(context.taxRateId, rules);
    const supplyType = context.supplyType ?? 'intra-state';
    const taxMode = context.taxMode ?? 'exclusive';
    const reverseCharge = context.reverseCharge ?? false;
    const placeOfSupply = context.placeOfSupply;

    const { cgstRate, sgstRate, igstRate, cessRate } = resolveRates(rule, supplyType);
    const totalTaxRate = cgstRate + sgstRate + igstRate + cessRate;

    const grossAmount = context.baseAmount;
    const taxableAmount = taxMode === 'inclusive'
      ? roundToTwo(grossAmount / (1 + totalTaxRate))
      : roundToTwo(grossAmount);

    const cgst = roundToTwo(taxableAmount * cgstRate);
    const sgst = roundToTwo(taxableAmount * sgstRate);
    const igst = roundToTwo(taxableAmount * igstRate);
    const cess = roundToTwo(taxableAmount * cessRate);
    const totalTax = roundToTwo(cgst + sgst + igst + cess);
    const grandTotal = taxMode === 'inclusive'
      ? roundToTwo(grossAmount)
      : roundToTwo(grossAmount + totalTax);

    return {
      taxableAmount,
      cgst,
      sgst,
      igst,
      cess,
      totalTax,
      grandTotal,
      taxMode,
      supplyType,
      reverseCharge,
      placeOfSupply,
    };
  }
}
