import { describe, expect, it } from 'vitest';
import { collectCustomerOptions } from '../components/staff/staffCustomerLoader';

describe('staff customer loader', () => {
  it('fetches customer rows in backend-safe pages and merges them', async () => {
    const calls: string[] = [];
    const fakeFetch = async (endpoint: string) => {
      calls.push(endpoint);
      if (endpoint.includes('skip=0')) {
        return Array.from({ length: 100 }, (_, index) => ({ id: `id-${index}`, name: `Customer ${index}` }));
      }
      if (endpoint.includes('skip=100')) {
        return Array.from({ length: 50 }, (_, index) => ({ id: `id-${index + 100}`, name: `Customer ${index + 100}` }));
      }
      return [];
    };

    const rows = await collectCustomerOptions(fakeFetch);

    expect(calls).toEqual([
      '/crm/customers?skip=0&limit=100',
      '/crm/customers?skip=100&limit=100',
    ]);
    expect(rows).toHaveLength(150);
    expect(rows[0].name).toBe('Customer 0');
    expect(rows[149].name).toBe('Customer 149');
  });
});
