/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.15.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from 'vitest';
import { calculateItemGstRate } from '../lib/helpers.js';

describe('GST 2.0 Tax Tier calculations', () => {
  it('should charge 5% GST for apparel/footwear <= ₹2,500', () => {
    expect(calculateItemGstRate('apparel', 1200)).toBe(5);
    expect(calculateItemGstRate('footwear', 2500)).toBe(5);
    expect(calculateItemGstRate('clothing', 500)).toBe(5);
  });

  it('should charge 18% GST for apparel/footwear > ₹2,500', () => {
    expect(calculateItemGstRate('apparel', 2500.01)).toBe(18);
    expect(calculateItemGstRate('footwear', 4000)).toBe(18);
    expect(calculateItemGstRate('clothing', 2501)).toBe(18);
  });

  it('should charge 18% GST for accessories category', () => {
    expect(calculateItemGstRate('accessories', 500)).toBe(18);
  });

  it('should charge 40% GST for luxury category', () => {
    expect(calculateItemGstRate('luxury', 1000)).toBe(40);
    expect(calculateItemGstRate('luxury goods', 500)).toBe(40);
  });

  it('should fall back to defaultRate if supplied for unknown category', () => {
    expect(calculateItemGstRate('general', 100, 5)).toBe(5);
    expect(calculateItemGstRate('general', 100, 18)).toBe(18);
  });

  it('should fall back to 18% GST if defaultRate is not provided or invalid', () => {
    expect(calculateItemGstRate('general', 100)).toBe(18);
    expect(calculateItemGstRate('general', 100, 12 as any)).toBe(18); // 12 is not in [0, 5, 18, 40]
  });
});
