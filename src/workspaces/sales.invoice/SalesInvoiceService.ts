export class SalesInvoiceService {
  public async getDetails(id: string): Promise<Record<string, unknown>> {
    return { id, title: "SalesInvoice Details" };
  }
}
