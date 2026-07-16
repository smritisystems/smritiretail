/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.15.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { users, sessions } from '../state/store.js';
import { hashPassword } from '../lib/helpers.js';

describe('Authentication Integration Tests', () => {
  beforeAll(() => {
    // Clear users and seed a standard test user and a lockout test user
    users.length = 0;
    users.push({
      id: "usr-test",
      userId: "usr-test",
      employeeId: "EMP-TEST",
      username: "testuser",
      passwordHash: hashPassword("password123"),
      role: "Store Manager",
      status: "Active",
      photo: "",
      fullName: "Test User",
      displayName: "Test",
      employeeCode: "EMP-TEST",
      gender: "Male",
      dateOfBirth: "1990-01-01",
      mobile: "1234567890",
      email: "test@example.com",
      emergencyContact: "0987654321",
      address: "Test Address",
      city: "Mumbai",
      state: "MH",
      country: "India",
      pinCode: "400001",
      department: "Retail Operations",
      designation: "Store Manager",
      branch: "HQ Store",
      dateOfJoining: "2026-07-12",
      reportingManager: "",
      employmentType: "Permanent",
      allowedBranches: ["HQ Store"],
      preferences: { theme: "dark", language: "English", timeZone: "Asia/Kolkata" },
      notificationSettings: {
        salaryCredit: true,
        commissionEarned: true,
        targetAchievement: true,
        travelClaimApproval: true,
        leaveApproval: true,
        attendanceAlerts: true,
        holidayWeeklyOff: true,
        birthdayAnniversary: true,
        policyAnnouncements: true
      }
    });

    users.push({
      id: "usr-lock",
      userId: "usr-lock",
      employeeId: "EMP-LOCK",
      username: "lockuser",
      passwordHash: hashPassword("password123"),
      role: "Cashier",
      status: "Active",
      photo: "",
      fullName: "Lock User",
      displayName: "Lock",
      employeeCode: "EMP-LOCK",
      gender: "Male",
      dateOfBirth: "1990-01-01",
      mobile: "1234567891",
      email: "lock@example.com",
      emergencyContact: "0987654321",
      address: "Test Address",
      city: "Mumbai",
      state: "MH",
      country: "India",
      pinCode: "400001",
      department: "Retail Operations",
      designation: "Cashier",
      branch: "HQ Store",
      dateOfJoining: "2026-07-12",
      reportingManager: "",
      employmentType: "Permanent",
      allowedBranches: ["HQ Store"],
      preferences: { theme: "dark", language: "English", timeZone: "Asia/Kolkata" },
      notificationSettings: {
        salaryCredit: true,
        commissionEarned: true,
        targetAchievement: true,
        travelClaimApproval: true,
        leaveApproval: true,
        attendanceAlerts: true,
        holidayWeeklyOff: true,
        birthdayAnniversary: true,
        policyAnnouncements: true
      }
    });
  });

  beforeEach(() => {
    // Clear active sessions
    Object.keys(sessions).forEach(k => delete sessions[k]);
    
    // Reset status and failedAttempts for both test users
    const testUser = users.find(u => u.username === 'testuser');
    if (testUser) {
      testUser.status = 'Active';
      testUser.failedAttempts = 0;
      testUser.lockedUntil = undefined;
    }

    const lockUser = users.find(u => u.username === 'lockuser');
    if (lockUser) {
      lockUser.status = 'Active';
      lockUser.failedAttempts = 0;
      lockUser.lockedUntil = undefined;
    }
  });

  it('should authenticate user and return session details with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.username).toBe('testuser');
  });

  it('should deny login with invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should lock user account after 5 failed login attempts', async () => {
    // Attempt 1-4 for lockuser
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'lockuser', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    }

    // Attempt 5 should lock the account and return 403
    const res5 = await request(app)
      .post('/api/auth/login')
      .send({ username: 'lockuser', password: 'wrongpassword' });

    expect(res5.status).toBe(403);
    expect(res5.body.error).toContain('locked');

    // Confirm that the user status is set to Locked
    const lockUser = users.find(u => u.username === 'lockuser');
    expect(lockUser?.status).toBe('Locked');
  });

  it('should return 401 when fetching current session without credentials', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('should return session details when requesting /me with a valid session token', async () => {
    // Log in to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    
    const token = loginRes.body.token;
    expect(token).toBeDefined();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('x-session-token', token);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.username).toBe('testuser');
  });

  it('should destroy session and return 401 on subsequent requests after logging out', async () => {
    // Log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    
    const token = loginRes.body.token;
    expect(token).toBeDefined();

    // Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('x-session-token', token);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toHaveProperty('success', true);

    // Verify /me fails
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('x-session-token', token);

    expect(meRes.status).toBe(401);
  });
});
