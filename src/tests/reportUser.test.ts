/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { users } from '../state/store.js';
import { hashPassword } from '../lib/helpers.js';

describe('Report User Role Integration Tests', () => {
  let sessionToken: string;

  beforeAll(async () => {
    // Seed a test user with the Report User role
    const exists = users.find(u => u.username === "reportuser");
    if (!exists) {
      users.push({
        id: "usr-report-test",
        userId: "usr-report-test",
        employeeId: "EMP-RPT-TEST",
        username: "reportuser",
        passwordHash: hashPassword("whynothing"),
        role: "Report User",
        status: "Active",
        photo: "",
        fullName: "Report User Test Profile",
        displayName: "Reporter",
        employeeCode: "EMP-RPT-TEST",
        gender: "Female",
        dateOfBirth: "1992-05-15",
        mobile: "9876543210",
        email: "reporter@example.com",
        emergencyContact: "0987654321",
        address: "Test Address",
        city: "Delhi",
        state: "DL",
        country: "India",
        pinCode: "110001",
        department: "Finance Auditing",
        designation: "Auditor",
        branch: "HQ Store",
        dateOfJoining: "2026-07-13",
        reportingManager: "",
        employmentType: "Permanent",
        allowedBranches: ["HQ Store"],
        preferences: { theme: "light", language: "English", timeZone: "Asia/Kolkata" },
        notificationSettings: {
          salaryCredit: true,
          commissionEarned: false,
          targetAchievement: false,
          travelClaimApproval: false,
          leaveApproval: false,
          attendanceAlerts: true,
          holidayWeeklyOff: true,
          birthdayAnniversary: true,
          policyAnnouncements: true
        }
      });
    }

    // Authenticate and fetch session token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'reportuser', password: 'whynothing' });

    sessionToken = loginRes.body.token;
  });

  it('should authenticate successfully as Report User', () => {
    expect(sessionToken).toBeDefined();
  });

  it('should allow fetching reports registry metadata', async () => {
    const res = await request(app)
      .get('/api/reports/list')
      .set('x-session-token', sessionToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('studios');
    expect(res.body.role).toBe('Report User');
  });

  it('should allow recording UI audit logs via POST', async () => {
    const res = await request(app)
      .post('/api/system/audit-logs')
      .set('x-session-token', sessionToken)
      .send({
        actionType: "PRINT_PREVIEW",
        tableName: "reports",
        recordId: "RPT-OPS-001",
        reason: "Opened print preview for daily summary report"
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  it('should restrict and block Sales Quotation creation (POST) returning 403', async () => {
    const res = await request(app)
      .post('/api/sales/quotations')
      .set('x-session-token', sessionToken)
      .send({
        customerName: "Prohibited Write Customer",
        items: [],
        status: "Draft"
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Operating under a Read-Only Report User role');
  });

  it('should restrict and block Sales Invoice generation (POST) returning 403', async () => {
    const res = await request(app)
      .post('/api/sales/invoices')
      .set('x-session-token', sessionToken)
      .send({
        customerId: "cust-1",
        items: []
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Operating under a Read-Only Report User role');
  });
});
