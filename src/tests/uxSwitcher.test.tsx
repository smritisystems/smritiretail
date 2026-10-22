/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.9
 * Created      : 2026-10-22
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: UX Switcher Verification Test Suite (Regular UX <-> Classic UX)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LayoutEngineProvider } from '../layout_engine/layout_store.tsx';
import { UxSwitcherModal } from '../components/shell/UxSwitcherModal.tsx';
import { RegularUxDashboard } from '../components/dashboard/RegularUxDashboard.tsx';
import { ClassicUxWorkspace } from '../components/dashboard/ClassicUxWorkspace.tsx';

// Mock apiFetch
vi.mock('../lib/apiFetch.ts', () => ({
  apiFetch: vi.fn().mockResolvedValue({ status: 'ok' }),
  apiFetchV1: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

describe('SMRITI Retail OS — Premium UX Switcher & Presentation Verification', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    global.localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
      length: 0,
      key: vi.fn(),
    } as any;
    vi.clearAllMocks();
  });

  it('1. Default UX mode storage key defaults to "regular"', () => {
    expect(localStorage.getItem('smriti_ux_mode')).toBeNull();
    // Simulate setting classic
    localStorage.setItem('smriti_ux_mode', 'classic');
    expect(localStorage.getItem('smriti_ux_mode')).toBe('classic');
    // Switch back to regular
    localStorage.setItem('smriti_ux_mode', 'regular');
    expect(localStorage.getItem('smriti_ux_mode')).toBe('regular');
  });

  it('2. UxSwitcherModal displays polished selection panel with clear labels and radio cards', () => {
    const html = renderToStaticMarkup(
      <LayoutEngineProvider>
        <UxSwitcherModal isOpen={true} onClose={() => {}} />
      </LayoutEngineProvider>
    );

    expect(html).toContain('UX Presentation Mode');
    expect(html).toContain('Regular UX');
    expect(html).toContain('Simple, clean and guided • Everyday Retail');
    expect(html).toContain('Classic UX');
    expect(html).toContain('Traditional, detailed and powerful • For Advanced Users');
    expect(html).toContain('Spacious layouts &amp; cards');
    expect(html).toContain('Top ERP menu bar');
    expect(html).toContain('Multi-tab workspaces');
    expect(html).toContain('Shared DB, taxes, validation &amp; active cart safe');
  });

  it('3. UxSwitcherModal renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <LayoutEngineProvider>
        <UxSwitcherModal isOpen={false} onClose={() => {}} />
      </LayoutEngineProvider>
    );

    expect(html).toBe('');
  });

  it('4. RegularUxDashboard renders spacious layout, greeting, 4 KPI cards, 4 action tiles, and recent sales', () => {
    const html = renderToStaticMarkup(
      <RegularUxDashboard
        currentUser={{ role: 'Store Manager', name: 'Jawahar Mallah' }}
        onNavigateTab={() => {}}
      />
    );

    // Greeting Banner
    expect(html).toContain('Welcome back, Jawahar Mallah!');
    expect(html).toContain("Here&#x27;s what&#x27;s happening at your store today.");

    // 4 KPI Cards
    expect(html).toContain('Today Sales');
    expect(html).toContain('₹ 24,560');
    expect(html).toContain('Bills');
    expect(html).toContain('42');
    expect(html).toContain('Items Sold');
    expect(html).toContain('128');
    expect(html).toContain('New Customers');
    expect(html).toContain('6');

    // 4 Action Tiles
    expect(html).toContain('POS Billing');
    expect(html).toContain('Start new bill');
    expect(html).toContain('Item Master');
    expect(html).toContain('Add / Manage');
    expect(html).toContain('Customer');
    expect(html).toContain('Reports');
    expect(html).toContain('View Reports');

    // Recent Sales
    expect(html).toContain('Recent Sales');
    expect(html).toContain('SI-000125');
    expect(html).toContain('SI-000124');
    expect(html).toContain('Walk-in Customer');
    expect(html).toContain('Rajesh Shoes');
  });

  it('5. ClassicUxWorkspace renders traditional ERP layout with top menus, tabs, dense grid, and F-keys', () => {
    const html = renderToStaticMarkup(
      <ClassicUxWorkspace
        currentUser={{ role: 'System Admin', name: 'Jawahar' }}
        onNavigateTab={() => {}}
        onNotification={() => {}}
      />
    );

    // Top ERP Menu Bar
    expect(html).toContain('Master');
    expect(html).toContain('Transactions');
    expect(html).toContain('Inventory');
    expect(html).toContain('Accounts');
    expect(html).toContain('CRM');
    expect(html).toContain('Reports');
    expect(html).toContain('Tools');
    expect(html).toContain('Settings');
    expect(html).toContain('Help');

    // Tabs Bar
    expect(html).toContain('POS Billing');
    expect(html).toContain('Dashboard');

    // Function Key Toolbar
    expect(html).toContain('New (F2)');
    expect(html).toContain('Clear (F3)');
    expect(html).toContain('Hold (F4)');
    expect(html).toContain('Recall (F5)');
    expect(html).toContain('Save (F10)');
    expect(html).toContain('Print (F8)');

    // Header master fields
    expect(html).toContain('Walk-in Customer');
    expect(html).toContain('Retail Price');
    expect(html).toContain('Main Store');
    expect(html).toContain('22-10-2026');
    expect(html).toContain('SI-000126');

    // Tabular items from reference
    expect(html).toContain('Sports Shoe');
    expect(html).toContain('Casual Shoe');
    expect(html).toContain('Slipper');
    expect(html).toContain('8901234567890');
    expect(html).toContain('SH-001');

    // Totals
    expect(html).toContain('Sub Total');
    expect(html).toContain('Discount');
    expect(html).toContain('CGST (2.5%)');
    expect(html).toContain('SGST (2.5%)');
    expect(html).toContain('Grand Total');
  });
});
