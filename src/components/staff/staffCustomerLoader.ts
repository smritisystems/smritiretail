export type CustomerOption = {
  id: string;
  name: string;
};

export async function collectCustomerOptions(
  fetcher: (endpoint: string) => Promise<any>,
  pageSize = 100,
): Promise<CustomerOption[]> {
  const allRows: CustomerOption[] = [];
  let skip = 0;

  while (true) {
    const endpoint = `/crm/customers?skip=${skip}&limit=${pageSize}`;
    const rows = await fetcher(endpoint);
    const nextRows = Array.isArray(rows) ? rows : rows?.items || rows?.customers || [];
    if (!nextRows.length) break;

    allRows.push(...nextRows.map((customer: any) => ({
      id: customer.id,
      name: customer.name || customer.customer_name || customer.company_name || customer.id,
    })));

    if (nextRows.length < pageSize) break;
    skip += pageSize;
  }

  return allRows;
}
