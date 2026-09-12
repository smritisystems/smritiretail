/*
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-09-12
 * Modified     : 2026-09-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, expect, it } from 'vitest';
import { dateAfter, validateReassignment } from '../components/staff/staffPlacementHelpers';

describe('staff placement helpers', () => {
  it('computes next day correctly for given date string', () => {
    expect(dateAfter('2026-09-12')).toBe('2026-09-13');
    expect(dateAfter('2026-12-31')).toBe('2027-01-01');
    expect(dateAfter('2026-02-28')).toBe('2026-03-01');
  });

  it('rejects reassignment when active placement is missing', () => {
    const result = validateReassignment({
      placementType: 'THIRD_PARTY_STORE',
      hostCustomerId: 'cust-1',
      hostDeliveryLocationId: 'loc-1',
      stockModel: 'OUTRIGHT_SALE',
      effectiveFrom: '2026-09-13',
    });
    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe('No Active Placement');
  });

  it('rejects partner reassignment without customer or store code location', () => {
    const active = { id: 'p-1', effective_from: '2026-09-12', status: 'ACTIVE' };
    const missingCustomer = validateReassignment(
      {
        placementType: 'THIRD_PARTY_STORE',
        hostDeliveryLocationId: 'loc-1',
        stockModel: 'OUTRIGHT_SALE',
        effectiveFrom: '2026-09-13',
      },
      active,
    );
    expect(missingCustomer.valid).toBe(false);
    expect(missingCustomer.errorTitle).toBe('Location Required');

    const missingLocation = validateReassignment(
      {
        placementType: 'THIRD_PARTY_STORE',
        hostCustomerId: 'cust-1',
        stockModel: 'OUTRIGHT_SALE',
        effectiveFrom: '2026-09-13',
      },
      active,
    );
    expect(missingLocation.valid).toBe(false);
    expect(missingLocation.errorTitle).toBe('Location Required');
  });

  it('rejects internal reassignment without internal branch id', () => {
    const active = { id: 'p-1', effective_from: '2026-09-12', status: 'ACTIVE' };
    const result = validateReassignment(
      {
        placementType: 'INTERNAL_BRANCH',
        stockModel: 'OUTRIGHT_SALE',
        effectiveFrom: '2026-09-13',
      },
      active,
    );
    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe('Branch Required');
  });

  it('rejects reassignment with effective date on or before active placement start', () => {
    const active = { id: 'p-1', effective_from: '2026-09-12', status: 'ACTIVE' };
    const sameDate = validateReassignment(
      {
        placementType: 'THIRD_PARTY_STORE',
        hostCustomerId: 'cust-1',
        hostDeliveryLocationId: 'loc-1',
        stockModel: 'OUTRIGHT_SALE',
        effectiveFrom: '2026-09-12',
      },
      active,
    );
    expect(sameDate.valid).toBe(false);
    expect(sameDate.errorTitle).toBe('Invalid Effective Date');

    const pastDate = validateReassignment(
      {
        placementType: 'THIRD_PARTY_STORE',
        hostCustomerId: 'cust-1',
        hostDeliveryLocationId: 'loc-1',
        stockModel: 'OUTRIGHT_SALE',
        effectiveFrom: '2026-09-11',
      },
      active,
    );
    expect(pastDate.valid).toBe(false);
    expect(pastDate.errorTitle).toBe('Invalid Effective Date');
  });

  it('accepts valid reassignment starting strictly after active placement', () => {
    const active = { id: 'p-1', effective_from: '2026-09-12', status: 'ACTIVE' };
    const valid = validateReassignment(
      {
        placementType: 'THIRD_PARTY_STORE',
        hostCustomerId: 'cust-1',
        hostDeliveryLocationId: 'loc-1',
        stockModel: 'OUTRIGHT_SALE',
        effectiveFrom: '2026-09-13',
      },
      active,
    );
    expect(valid.valid).toBe(true);
    expect(valid.errorTitle).toBeUndefined();
  });
});
