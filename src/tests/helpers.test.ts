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
import { calculateItemGstRate, hashPassword, verifyPassword, resolveTermsText } from '../lib/helpers.js';

describe('helpers.ts Unit Tests', () => {
  describe('calculateItemGstRate', () => {
    it('should charge 5% GST for apparel <= ₹2500', () => {
      expect(calculateItemGstRate('apparel', 2000)).toBe(5);
    });

    it('should charge 18% GST for apparel > ₹2500', () => {
      expect(calculateItemGstRate('apparel', 3000)).toBe(18);
    });

    it('should charge 5% GST for footwear <= ₹2500', () => {
      expect(calculateItemGstRate('footwear', 1000)).toBe(5);
    });

    it('should charge 18% GST for footwear > ₹2500', () => {
      expect(calculateItemGstRate('footwear', 3000)).toBe(18);
    });

    it('should charge 18% GST for accessories', () => {
      expect(calculateItemGstRate('accessories', 1500)).toBe(18);
    });

    it('should charge 40% GST for luxury items', () => {
      expect(calculateItemGstRate('luxury', 5000)).toBe(40);
    });

    it('should charge default 18% GST for unknown category and no default rate', () => {
      expect(calculateItemGstRate('unknown-cat', 100)).toBe(18);
    });
  });

  describe('hashPassword and verifyPassword', () => {
    it('should verify correct password successfully', () => {
      const pass = 'password123';
      const hash = hashPassword(pass);
      expect(verifyPassword(pass, hash)).toBe(true);
    });

    it('should fail verification for incorrect password', () => {
      const pass = 'password123';
      const hash = hashPassword(pass);
      expect(verifyPassword('wrongpass', hash)).toBe(false);
    });

    it('should verify legacy plaintext passwords', () => {
      expect(verifyPassword('smriti123', 'smriti123')).toBe(true);
      expect(verifyPassword('wrongpass', 'smriti123')).toBe(false);
    });
  });

  describe('resolveTermsText', () => {
    it('should replace {InvoiceNo} variable', () => {
      const text = 'Invoice is {InvoiceNo}';
      const resolved = resolveTermsText(text, { InvoiceNo: 'INV-1001' });
      expect(resolved).toBe('Invoice is INV-1001');
    });

    it('should default {Amount} to 0.00 when not provided', () => {
      const text = 'Amount due: ₹{Amount}';
      const resolved = resolveTermsText(text, {});
      expect(resolved).toBe('Amount due: ₹0.00');
    });
  });
});
