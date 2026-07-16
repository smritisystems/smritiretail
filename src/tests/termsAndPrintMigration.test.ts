/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import termsRouter from '../routes/terms.js';
// barcodeRouter import removed — barcode.ts retired in v3.21.0.
// Business behavior (layouts, printer settings) is now tested in:
//   backend/app/tests/test_barcode.py (FastAPI + Postgres)
// FastAPI endpoints: GET/POST /api/v1/barcode/layouts, /printer-settings, /print
import { pool } from '../db/pool.js';

vi.mock('../db/pool.js', () => ({
  pool: {
    query: vi.fn()
  }
}));

const app = express();
app.use(express.json());
app.use(termsRouter);
// barcodeRouter no longer mounted — retired in v3.21.0.

describe('Terms and Conditions Route Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/terms/clauses - should fetch all active clauses', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'CL-GEN-01',
          code: 'CODE-101',
          title: 'Standard Terms',
          category: 'General',
          content: 'Some clause content',
          status: 'Approved',
          language: 'English',
          approvedBy: 'Admin',
          approvedAt: new Date(),
          isActive: true,
          version: 1,
          lastUpdated: new Date(),
          updatedBy: 'Admin'
        }
      ]
    } as any);

    const res = await request(app).get('/api/terms/clauses');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe('CL-GEN-01');
  });

  it('POST /api/terms/clauses - should create a new clause', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/terms/clauses')
      .send({
        title: 'New Clause',
        category: 'Billing',
        content: 'New content here',
        isActive: true,
        status: 'Approved',
        language: 'English'
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Clause');
    expect(pool.query).toHaveBeenCalled();
  });

  it('GET /api/terms/defaults - should fetch default mappings', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'DF-01',
          level: 'Company',
          refId: 'SMRITI_IND',
          clauseIds: JSON.stringify(['CL-GEN-01']),
          isActive: true,
          lastUpdated: new Date(),
          updatedBy: 'Admin'
        }
      ]
    } as any);

    const res = await request(app).get('/api/terms/defaults');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].clauseIds).toContain('CL-GEN-01');
  });

  it('GET /api/terms/snapshots - should return all snapshots', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'SNAP-01',
          documentType: 'Sales Invoice',
          documentNo: 'INV-101',
          snapshotAt: new Date(),
          clausesSnapshot: JSON.stringify([{ id: 'CL-GEN-01' }])
        }
      ]
    } as any);

    const res = await request(app).get('/api/terms/snapshots');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].clausesSnapshot[0].id).toBe('CL-GEN-01');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RETIRED: Barcode / Print Template and Profile Route Tests
//
// ADR: barcode.ts retired in v3.21.0 as part of Inventory/Products Strangler-Fig
// migration (AGENTS.md Rule 2). These tests exercised Express routes that are
// no longer mounted.
//
// Business behavior is preserved and verified in:
//   backend/app/tests/test_barcode.py — pytest suite against FastAPI + Postgres
//
// API mapping:
//   GET /api/barcode/templates  -> GET /api/v1/barcode/layouts
//   GET /api/barcode/profiles   -> GET /api/v1/barcode/printer-settings
//
// This block is kept as documentation of the retired Express contract.
// It will be removed in v3.22.0 (one full release after retirement).
// ─────────────────────────────────────────────────────────────────────────────
describe.skip('Barcode / Print Template and Profile Route Tests [RETIRED v3.21.0]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/barcode/templates - should return templates [Express contract — see test_barcode.py]', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: 't-101',
          title: 'Standard Template',
          labelSize: '50x25',
          printerLanguage: 'ZPL',
          printerFamily: 'Zebra',
          version: '1.0.0',
          isDefaultSize: true,
          rawPRN: '^XA^XZ',
          fieldMappings: JSON.stringify([]),
          isActive: true
        }
      ]
    } as any);

    const res = await request(app).get('/api/barcode/templates');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe('t-101');
  });

  it('GET /api/barcode/profiles - should return print profiles [Express contract — see test_barcode.py]', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'p-101',
          name: 'HQ Printer',
          templateId: 't-101',
          printerIP: '192.168.1.100',
          printerPort: 9100,
          dpi: 203,
          copies: 1,
          labelSize: '50x25',
          isDefault: true,
          isActive: true
        }
      ]
    } as any);

    const res = await request(app).get('/api/barcode/profiles');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].printerIP).toBe('192.168.1.100');
  });
});
