import { PricingContext, PricingEngine, PriceRule } from '../domain/pricing';

export class PricingService {
  private readonly engine = new PricingEngine();

  public calculatePrice(context: PricingContext, rules: PriceRule[]): number {
    return this.engine.calculatePrice(context, rules);
  }
}
