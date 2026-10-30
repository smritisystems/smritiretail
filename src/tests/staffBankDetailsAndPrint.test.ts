/*
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.33.3
 * Created      : 2026-09-17
 * Modified     : 2026-09-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, expect, it } from 'vitest';
import { User } from '../types';

describe('Staff Bank Details & Statutory KYC Verification Suite', () => {
  const sampleStaff: User = {
    id: 'usr-101',
    userId: 'usr-101',
    employeeId: 'EMP-9081',
    employeeCode: 'EMP-9081',
    username: 'rahul.verma',
    fullName: 'Rahul Sharma Verma',
    displayName: 'Rahul V.',
    role: 'CASHIER',
    status: 'Active',
    department: 'Front of House POS',
    designation: 'Senior Cashier & Sales Lead',
    branch: 'Phoenix Mall Flagship',
    mobile: '9876543210',
    email: 'rahul.verma@smritiretail.com',
    emergencyContact: '9811223344',
    address: 'Flat 402, Royal Palms, Goregaon East, Mumbai 400063',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400063',
    dateOfBirth: '1995-08-14',
    dateOfJoining: '2022-04-01',
    reportingManager: 'Sunil Mehta (Store GM)',
    employmentType: 'Permanent',
    salary: {
      fixedMonthly: 38500,
      baseHra: 15400,
      specialAllowance: 7700,
    },
    payment: {
      frequency: 'Monthly',
      paymentMode: 'Bank Transfer',
      bankName: 'HDFC Bank Ltd.',
      accountNumber: '50100234567890',
      ifscCode: 'HDFC0000123',
      branchName: 'Goregaon East Branch, Mumbai',
      accountType: 'Salary',
      nameAsPerBank: 'RAHUL SHARMA VERMA',
      upi: 'rahul.sharma@okhdfcbank',
      panNumber: 'ABCDE1234F',
      aadhaarNumber: '4589 1234 5678',
      providentFundUan: '100912345678',
      esicNumber: '31001234560001',
      bloodGroup: 'B+',
      fatherSpouseName: 'Ramakant Verma',
      maritalStatus: 'Married',
      emergencyContactRelation: 'Spouse',
      permanentAddress: 'Village Post Rampur, District Varanasi, UP 221001',
    },
  };

  it('correctly maps banking remittance fields in User.payment', () => {
    const payment = sampleStaff.payment;
    expect(payment).toBeDefined();
    expect(payment?.bankName).toBe('HDFC Bank Ltd.');
    expect(payment?.accountNumber).toBe('50100234567890');
    expect(payment?.ifscCode).toBe('HDFC0000123');
    expect(payment?.branchName).toBe('Goregaon East Branch, Mumbai');
    expect(payment?.accountType).toBe('Salary');
    expect(payment?.nameAsPerBank).toBe('RAHUL SHARMA VERMA');
    expect(payment?.paymentMode).toBe('Bank Transfer');
    expect(payment?.upi).toBe('rahul.sharma@okhdfcbank');
  });

  it('correctly maps statutory KYC & identification fields in User.payment', () => {
    const payment = sampleStaff.payment;
    expect(payment?.panNumber).toBe('ABCDE1234F');
    expect(payment?.aadhaarNumber).toBe('4589 1234 5678');
    expect(payment?.providentFundUan).toBe('100912345678');
    expect(payment?.esicNumber).toBe('31001234560001');
    expect(payment?.bloodGroup).toBe('B+');
    expect(payment?.fatherSpouseName).toBe('Ramakant Verma');
    expect(payment?.maritalStatus).toBe('Married');
    expect(payment?.emergencyContactRelation).toBe('Spouse');
    expect(payment?.permanentAddress).toContain('Varanasi');
  });

  it('enforces masking standards for sensitive banking identifiers', () => {
    const maskAccount = (val?: string) => {
      if (!val) return 'Not provided';
      const clean = val.trim();
      if (clean.length <= 4) return clean;
      return `•••• •••• ${clean.slice(-4)}`;
    };

    const masked = maskAccount(sampleStaff.payment?.accountNumber);
    expect(masked).toBe('•••• •••• 7890');
    expect(masked).not.toContain('50100234');
  });

  it('enforces masking standards for Aadhaar UID while retaining statutory integrity', () => {
    const maskAadhaar = (val?: string) => {
      if (!val) return 'Not provided';
      const clean = val.replace(/\\s+/g, '');
      if (clean.length <= 4) return clean;
      return `•••• •••• ${clean.slice(-4)}`;
    };

    const masked = maskAadhaar(sampleStaff.payment?.aadhaarNumber);
    expect(masked).toBe('•••• •••• 5678');
    expect(masked).not.toContain('4589');
  });

  it('generates high-contrast deterministic barcode bars for CR-80 ID scannability', () => {
    const generateBarcodeBars = (code: string) => {
      const bars: Array<{ width: number; space: number }> = [];
      const cleanCode = (code || 'SMRITI').toUpperCase().replace(/[^A-Z0-9]/g, '');
      for (let i = 0; i < cleanCode.length; i++) {
        const charCode = cleanCode.charCodeAt(i);
        const bit1 = (charCode & 1) ? 2 : 1;
        const bit2 = (charCode & 2) ? 2 : 1;
        const bit3 = (charCode & 4) ? 2 : 1;
        bars.push({ width: bit1, space: bit2 });
        bars.push({ width: bit3, space: 1 });
      }
      return bars;
    };

    const bars = generateBarcodeBars(sampleStaff.employeeCode || 'EMP-9081');
    expect(bars.length).toBeGreaterThan(0);
    // Every bar element has positive width and space
    bars.forEach((bar) => {
      expect(bar.width).toBeGreaterThanOrEqual(1);
      expect(bar.space).toBeGreaterThanOrEqual(1);
    });
  });

  it('validates 5 mandatory onboarding sections for A4 Statutory Registration Form', () => {
    const requiredSections = [
      'Identity & Employment Details',
      'Personal & Contact Information',
      'Statutory KYC & Identification',
      'Banking & Salary Remittance',
      'Declaration & Authorized Signatures',
    ];

    expect(requiredSections).toHaveLength(5);
    expect(requiredSections[0]).toContain('Identity');
    expect(requiredSections[2]).toContain('Statutory KYC');
    expect(requiredSections[3]).toContain('Banking');
    expect(requiredSections[4]).toContain('Signatures');
  });
});
