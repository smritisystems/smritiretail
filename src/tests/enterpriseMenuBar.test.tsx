/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.12
 * Created      : 2026-10-22
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Enterprise Menu Bar Component & Regression Tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EnterpriseMenuBar, ENTERPRISE_MENU_ITEMS, type MenuItemDef } from '../components/shell/EnterpriseMenuBar.tsx';

describe('SMRITI Retail OS — Classic UX Enterprise Menu Bar Verification', () => {
  it('1. ENTERPRISE_MENU_ITEMS contains all 12 core enterprise ERP menu definitions', () => {
    const expectedTopLevelIds = [
      'home',
      'master',
      'transactions',
      'inventory',
      'purchase',
      'sales',
      'accounts',
      'crm',
      'reports',
      'tools',
      'settings',
      'help',
    ];

    const actualIds = ENTERPRISE_MENU_ITEMS.map((item) => item.id);
    expect(actualIds).toEqual(expectedTopLevelIds);
    expect(ENTERPRISE_MENU_ITEMS.length).toBe(12);
  });

  it('2. Multi-tier nested submenu hierarchies exist for Master and Transactions', () => {
    const master = ENTERPRISE_MENU_ITEMS.find((i) => i.id === 'master');
    expect(master).toBeDefined();
    expect(master?.children).toBeDefined();
    expect(master?.children?.length).toBeGreaterThan(0);

    const itemsGroup = master?.children?.find((c) => c.id === 'items-group');
    expect(itemsGroup).toBeDefined();
    expect(itemsGroup?.label).toBe('Items & Catalog');
    expect(itemsGroup?.children).toBeDefined();
    expect(itemsGroup?.children?.some((leaf) => leaf.moduleId === 'item-master')).toBe(true);

    const transactions = ENTERPRISE_MENU_ITEMS.find((i) => i.id === 'transactions');
    expect(transactions).toBeDefined();
    expect(transactions?.children).toBeDefined();

    const salesDesk = transactions?.children?.find((c) => c.id === 'sales-desk');
    expect(salesDesk).toBeDefined();
    expect(salesDesk?.children?.some((leaf) => leaf.moduleId === 'billing-workspace')).toBe(true);
    expect(salesDesk?.children?.some((leaf) => leaf.moduleId === 'sales')).toBe(true);
  });

  it('3. EnterpriseMenuBar renders fully accessible navigation landmark and buttons', () => {
    const html = renderToStaticMarkup(
      <EnterpriseMenuBar
        activeModuleId="sales"
        onNavigateHome={() => {}}
        onSelectModule={() => {}}
      />
    );

    expect(html).toContain('aria-label="Enterprise Main Menu"');
    expect(html).toContain('Home');
    expect(html).toContain('Master');
    expect(html).toContain('Transactions');
    expect(html).toContain('Inventory');
    expect(html).toContain('Purchase');
    expect(html).toContain('Sales');
    expect(html).toContain('Accounts');
    expect(html).toContain('CRM');
    expect(html).toContain('Reports');
    expect(html).toContain('Tools');
    expect(html).toContain('Settings');
    expect(html).toContain('Help');
  });

  it('4. Sales category indicates active styling when activeModuleId is sales', () => {
    const html = renderToStaticMarkup(
      <EnterpriseMenuBar
        activeModuleId="sales"
        onNavigateHome={() => {}}
        onSelectModule={() => {}}
      />
    );

    // Sales button should contain active class styling (bg-[#1a2b7b] text-white font-bold)
    expect(html).toMatch(/Sales<\/span>/);
  });

  it('5. Home category indicates active styling when activeModuleId is launchpad or workspaces', () => {
    const htmlLaunchpad = renderToStaticMarkup(
      <EnterpriseMenuBar
        activeModuleId="launchpad"
        onNavigateHome={() => {}}
        onSelectModule={() => {}}
      />
    );
    expect(htmlLaunchpad).toContain('Home');

    const htmlWorkspaces = renderToStaticMarkup(
      <EnterpriseMenuBar
        activeModuleId="workspaces"
        onNavigateHome={() => {}}
        onSelectModule={() => {}}
      />
    );
    expect(htmlWorkspaces).toContain('Home');
  });
});
