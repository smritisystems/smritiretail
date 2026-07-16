/**
 * @file src/routes/users.ts
 * @description User accounts and roles management endpoints.
 * @module src/routes/users
 *
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

import express from "express";
import crypto from "crypto";
import { roles } from "../state/store.js";
import { container } from "../bootstrap/di.js";
import { hasPermission, hashPassword } from "../lib/helpers.js";
import { User, UserPreferences } from "../types.js";

const router = express.Router();

router.get("/api/users", async (req, res) => {
  try {
    const list = await container.users.getAll();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/users", async (req, res) => {
  if (!hasPermission(req, "staff.manage")) {
    return res.status(403).json({ error: "Access Denied: Only users with 'staff.manage' permission can create user profiles." });
  }

  const newUser = req.body as Partial<User>;
  if (!newUser.username || !newUser.fullName || !newUser.role) {
    return res.status(400).json({ error: "Missing required profile attributes: username, fullName, role." });
  }

  try {
    const existing = await container.users.getByUsername(newUser.username);
    if (existing) {
      return res.status(400).json({ error: `Username '${newUser.username}' is already taken.` });
    }

    const defaultPreferences: UserPreferences = {
      theme: "dark",
      language: "English",
      timeZone: "Asia/Kolkata"
    };

    const defaultNotifications = {
      salaryCredit: true,
      commissionEarned: true,
      targetAchievement: true,
      travelClaimApproval: true,
      leaveApproval: true,
      attendanceAlerts: true,
      holidayWeeklyOff: true,
      birthdayAnniversary: true,
      policyAnnouncements: true
    };

    const id = "usr-" + crypto.randomBytes(8).toString("hex");

    const createdUser: User = {
      id,
      userId: id,
      employeeId: newUser.employeeId || "EMP-" + Math.floor(1000 + Math.random() * 9000),
      username: newUser.username,
      passwordHash: hashPassword(newUser.passwordHash || "smriti123"),
      role: newUser.role,
      status: newUser.status || "Active",
      photo: newUser.photo || "",
      fullName: newUser.fullName,
      displayName: newUser.displayName || newUser.fullName.split(" ")[0],
      employeeCode: newUser.employeeCode || "EMP-" + Math.floor(1000 + Math.random() * 9000),
      gender: newUser.gender || "Male",
      dateOfBirth: newUser.dateOfBirth || "1990-01-01",
      mobile: newUser.mobile || "0000000000",
      alternateMobile: newUser.alternateMobile || "",
      email: newUser.email || "",
      emergencyContact: newUser.emergencyContact || "",
      address: newUser.address || "",
      city: newUser.city || "",
      state: newUser.state || "",
      country: newUser.country || "India",
      pinCode: newUser.pinCode || "",
      department: newUser.department || "Retail Operations",
      designation: newUser.designation || "Executive",
      branch: newUser.branch || "Andheri West, Mumbai",
      departmentId: newUser.departmentId,
      designationId: newUser.designationId,
      branchId: newUser.branchId,
      dateOfJoining: newUser.dateOfJoining || new Date().toISOString().split("T")[0],
      reportingManager: newUser.reportingManager || "",
      employmentType: newUser.employmentType || "Permanent",
      allowedBranches: newUser.allowedBranches || [newUser.branch || "Andheri West, Mumbai"],
      salary: newUser.salary || {
        fixedMonthly: 25000,
        commission: { type: "None", value: 0 },
        travelAllowance: { type: "None", value: 0 },
        otherAllowances: { da: 0, mobile: 0, internet: 0, fuel: 0 }
      },
      payment: newUser.payment || {
        frequency: "Monthly",
        bankDetails: "",
        upi: "",
        salaryEffectiveFrom: new Date().toISOString().split("T")[0],
        commissionEffectiveFrom: new Date().toISOString().split("T")[0]
      },
      performance: newUser.performance || {
        attendancePercentage: 100,
        monthlySales: 0,
        targetsAssigned: 0,
        targetsAchieved: 0,
        commissionEarned: 0,
        travelClaimStatus: "None"
      },
      preferences: newUser.preferences || defaultPreferences,
      notificationSettings: newUser.notificationSettings || defaultNotifications
    };

    await container.users.create(createdUser);
    res.status(201).json(createdUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/users/:id", async (req, res) => {
  const targetId = req.params.id;
  const currentUserId = req.headers["x-user-id"] as string;
  const isSelf = (currentUserId === targetId);

  if (!hasPermission(req, "staff.manage") && !isSelf) {
    return res.status(403).json({ error: "Access Denied: You do not have permission to modify this user's profile." });
  }

  try {
    const user = await container.users.getById(targetId);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const updates = req.body as Partial<User>;
    const fieldsToUpdate: Partial<User> = {};

    if (updates.fullName && hasPermission(req, "staff.manage")) fieldsToUpdate.fullName = updates.fullName;
    if (updates.displayName) fieldsToUpdate.displayName = updates.displayName;
    if (updates.role && hasPermission(req, "staff.manage")) fieldsToUpdate.role = updates.role;
    if (updates.status && hasPermission(req, "staff.manage")) fieldsToUpdate.status = updates.status;
    if (updates.passwordHash && hasPermission(req, "staff.manage")) fieldsToUpdate.passwordHash = updates.passwordHash;
    if (updates.gender) fieldsToUpdate.gender = updates.gender;
    if (updates.dateOfBirth) fieldsToUpdate.dateOfBirth = updates.dateOfBirth;
    if (updates.mobile) fieldsToUpdate.mobile = updates.mobile;
    if (updates.alternateMobile) fieldsToUpdate.alternateMobile = updates.alternateMobile;
    if (updates.email) fieldsToUpdate.email = updates.email;
    if (updates.emergencyContact) fieldsToUpdate.emergencyContact = updates.emergencyContact;
    if (updates.address) fieldsToUpdate.address = updates.address;
    if (updates.city) fieldsToUpdate.city = updates.city;
    if (updates.state) fieldsToUpdate.state = updates.state;
    if (updates.country) fieldsToUpdate.country = updates.country;
    if (updates.pinCode) fieldsToUpdate.pinCode = updates.pinCode;
    if (updates.department && hasPermission(req, "staff.manage")) fieldsToUpdate.department = updates.department;
    if (updates.designation && hasPermission(req, "staff.manage")) fieldsToUpdate.designation = updates.designation;
    if (updates.branch && hasPermission(req, "staff.manage")) fieldsToUpdate.branch = updates.branch;
    if (updates.departmentId && hasPermission(req, "staff.manage")) fieldsToUpdate.departmentId = updates.departmentId;
    if (updates.designationId && hasPermission(req, "staff.manage")) fieldsToUpdate.designationId = updates.designationId;
    if (updates.branchId && hasPermission(req, "staff.manage")) fieldsToUpdate.branchId = updates.branchId;
    if (updates.dateOfJoining && hasPermission(req, "staff.manage")) fieldsToUpdate.dateOfJoining = updates.dateOfJoining;
    if (updates.reportingManager && hasPermission(req, "staff.manage")) fieldsToUpdate.reportingManager = updates.reportingManager;
    if (updates.employmentType && hasPermission(req, "staff.manage")) fieldsToUpdate.employmentType = updates.employmentType;
    if (updates.allowedBranches && hasPermission(req, "staff.manage")) fieldsToUpdate.allowedBranches = updates.allowedBranches;
    if (updates.salary && hasPermission(req, "staff.manage")) fieldsToUpdate.salary = updates.salary;
    if (updates.payment && hasPermission(req, "staff.manage")) fieldsToUpdate.payment = updates.payment;
    if (updates.performance && hasPermission(req, "staff.manage")) fieldsToUpdate.performance = updates.performance;

    const updated = await container.users.update(targetId, fieldsToUpdate);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/users/:id", async (req, res) => {
  if (!hasPermission(req, "staff.manage")) {
    return res.status(403).json({ error: "Access Denied: Only users with 'staff.manage' permission can delete user profiles." });
  }

  const targetId = req.params.id;

  try {
    const user = await container.users.getById(targetId);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const currentUserId = req.headers["x-user-id"] as string;
    if (user.id === currentUserId || user.userId === currentUserId) {
      return res.status(400).json({ error: "You cannot delete your own active operator profile." });
    }

    // Soft delete by setting status to Inactive
    await container.users.update(targetId, { status: "Inactive" });

    res.json({ success: true, deletedId: targetId, status: "Inactive" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/users/:id/preferences", async (req, res) => {
  const userId = req.params.id;
  const currentUserId = req.headers["x-user-id"] as string;

  if (!hasPermission(req, "staff.manage") && currentUserId !== userId) {
    return res.status(403).json({ error: "Access Denied: You cannot modify preferences of other operators." });
  }

  const { preferences } = req.body;
  if (!preferences) {
    return res.status(400).json({ error: "Missing preferences in payload." });
  }

  try {
    const user = await container.users.getById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const updatedPreferences = {
      ...user.preferences,
      ...preferences
    };

    const updated = await container.users.update(userId, { preferences: updatedPreferences });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/users/:id/notifications", async (req, res) => {
  const userId = req.params.id;
  const currentUserId = req.headers["x-user-id"] as string;

  if (!hasPermission(req, "staff.manage") && currentUserId !== userId) {
    return res.status(403).json({ error: "Access Denied: You cannot modify notification settings of other operators." });
  }

  const { notificationSettings } = req.body;
  if (!notificationSettings) {
    return res.status(400).json({ error: "Missing notificationSettings in payload." });
  }

  try {
    const user = await container.users.getById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const updatedNotifications = {
      ...user.notificationSettings,
      ...notificationSettings
    };

    const updated = await container.users.update(userId, { notificationSettings: updatedNotifications });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/users/:id/photo", async (req, res) => {
  const userId = req.params.id;
  const currentUserId = req.headers["x-user-id"] as string;

  if (!hasPermission(req, "staff.manage") && currentUserId !== userId) {
    return res.status(403).json({ error: "Access Denied: You cannot upload photos for other operators." });
  }

  const { photo } = req.body;
  if (photo === undefined) {
    return res.status(400).json({ error: "Missing photo property in payload." });
  }

  try {
    const user = await container.users.getById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const updated = await container.users.update(userId, { photo });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/roles", async (req, res) => {
  res.json(roles);
});

router.put("/api/roles", async (req, res) => {
  if (!hasPermission(req, "roles.manage")) {
    return res.status(403).json({ error: "Access Denied: Only users with 'roles.manage' permission can update roles." });
  }

  const { name, permissions } = req.body;
  if (!name || !Array.isArray(permissions)) {
    return res.status(400).json({ error: "Invalid payload: name and permissions array are required." });
  }

  let roleObj = roles.find(r => r.name === name);
  if (roleObj) {
    roleObj.permissions = permissions;
  } else {
    roleObj = { name, permissions };
    roles.push(roleObj);
  }

  await container.state.saveDb();
  res.json(roleObj);
});

export default router;
