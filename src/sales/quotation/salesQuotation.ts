export interface SalesQuotationItem {
  id: string;
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}

export interface SalesQuotation {
  id: string;
  customerCode: string;
  quotationDate: string;
  validUntil: string;
  currency: string;
  items: SalesQuotationItem[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted' | 'cancelled';
}

export function createSalesQuotation(data: Partial<SalesQuotation>): SalesQuotation {
  return {
    id: data.id ?? 'SQ-001',
    customerCode: data.customerCode ?? '',
    quotationDate: data.quotationDate ?? new Date().toISOString(),
    validUntil: data.validUntil ?? new Date().toISOString(),
    currency: data.currency ?? 'INR',
    items: data.items ?? [],
    status: data.status ?? 'draft',
  };
}

export function calculateQuotationTotal(quotation: SalesQuotation): number {
  return quotation.items.reduce((total, item) => {
    const discounted = item.unitPrice * (1 - item.discountPercent / 100);
    const taxed = discounted * (1 + item.taxPercent / 100);
    return total + taxed * item.quantity;
  }, 0);
}
