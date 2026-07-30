/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * AI Extension Points & Advisory Plugin
 */

export interface AISuggestion {
  id: string;
  type: "customer" | "discount" | "price" | "gst" | "credit_warning" | "stock_recommendation";
  title: string;
  description: string;
  actionPayload?: any;
}

export class AIStudioExtension {
  static analyzeInvoiceDraft(draftData: any): AISuggestion[] {
    const suggestions: AISuggestion[] = [];

    // Credit limit check
    if (draftData?.customer?.outstanding > 40000) {
      suggestions.push({
        id: "ai-credit-warning",
        type: "credit_warning",
        title: "High Outstanding Balance",
        description: `Customer ${draftData.customer.name} has ₹${draftData.customer.outstanding.toLocaleString("en-IN")} outstanding balance. Recommend cash payment on receipt.`,
      });
    }

    // High value discount recommendation
    if (draftData?.totals?.taxable > 25000) {
      suggestions.push({
        id: "ai-discount-suggestion",
        type: "discount",
        title: "Wholesale Tier Eligible",
        description: "Invoice taxable value exceeds ₹25,000. Apply 5% volume discount scheme?",
      });
    }

    return suggestions;
  }
}
