import { GstEngine, GstBreakdown, TaxContext, TaxRule } from '../domain/tax';

export class GstService {
  private readonly engine = new GstEngine();

  public calculateTax(context: TaxContext, rules: TaxRule[]): number {
    return this.engine.calculateTax(context, rules);
  }

  public calculateTotal(context: TaxContext, rules: TaxRule[]): number {
    return this.engine.calculateTotal(context, rules);
  }

  public calculateBreakdown(context: TaxContext, rules: TaxRule[]): GstBreakdown {
    return this.engine.calculateBreakdown(context, rules);
  }

  public validateHsnCode(hsnCode: string): boolean {
    return this.engine.validateHsnCode(hsnCode);
  }
}
