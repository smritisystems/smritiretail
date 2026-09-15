/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { allocateVoucherNumber } from '../lib/helpers.js';
import { pool } from '../db/pool.js';

vi.mock('../db/pool.js', () => ({
  pool: {
    query: vi.fn()
  }
}));

// Mock localStorage for node test environment
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, val: string) => { mockStorage[key] = String(val); }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((idx: number) => Object.keys(mockStorage)[idx] || null)
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true
});

// Mock global fetch
global.fetch = vi.fn();

describe('Voucher Numbering Engine Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fall back to timestamp prefix if no active series exists', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as any);
    const allocated = await allocateVoucherNumber('Sales Order');
    expect(allocated).toContain('SAL-');
  });

  it('should call FastAPI to allocate correct sequence with active series', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: 'SER-TEST-01' }]
    } as any);

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documentNo: 'INV/MUM/2026-2027/00011-TST' })
    } as any);

    const num = await allocateVoucherNumber('Sales Invoice', {
      branch: 'MUM',
      fy: '2026-2027',
      authHeader: 'Bearer token-xyz'
    });

    expect(num).toBe('INV/MUM/2026-2027/00011-TST');
    expect(global.fetch).toHaveBeenCalled();
  });
});
