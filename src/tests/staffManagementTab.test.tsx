/** @vitest-environment jsdom */

import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";

vi.mock("../lib/apiFetchV1.ts", () => ({
  apiFetchV1: vi.fn(),
}));

vi.mock("../lib/apiFetch.ts", () => ({
  recordAuditAction: vi.fn(),
}));

vi.mock("../notifications/notification_store.tsx", () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock("../layout_engine/SEEFContext.tsx", () => ({
  useSEEF: () => ({
    config: { density: "default" },
  }),
  useSEEFAnimation: () => "all",
}));

vi.mock("../people/workspace/UniversalPersonWorkspace.tsx", () => ({
  UniversalPersonWorkspace: () => <div data-testid="universal-person-workspace" />,
}));

vi.mock("../components/Identity360Workspace.tsx", () => ({
  Identity360Workspace: () => <div data-testid="identity-360-workspace" />,
}));

vi.mock("../components/ProvisioningDashboard.tsx", () => ({
  ProvisioningDashboard: () => <div data-testid="provisioning-dashboard" />,
}));

vi.mock("../components/IdentityTransferWizard.tsx", () => ({
  IdentityTransferWizard: () => <div />, 
}));

vi.mock("../components/IdentityProvisioningWizard.tsx", () => ({
  IdentityProvisioningWizard: () => <div />, 
}));

import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { StaffManagementTab } from "../components/StaffManagementTab.tsx";

describe("StaffManagementTab", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;
  const apiFetchV1Mock = vi.mocked(apiFetchV1);

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    apiFetchV1Mock.mockReset();
    apiFetchV1Mock.mockImplementation((endpoint: string, options?: any) => {
      if (endpoint === "/users/" && (!options || !options.method)) {
        return Promise.resolve({ total: 0, users: [] });
      }
      if (endpoint === "/masters/lookup/department/values") {
        return Promise.resolve([{ id: "dep-1", name: "Reporting" }]);
      }
      if (endpoint === "/masters/lookup/designation/values") {
        return Promise.resolve([{ id: "des-1", name: "Analyst" }]);
      }
      if (endpoint === "/masters/branches") {
        return Promise.resolve([{ id: "br-1", name: "Main Branch" }]);
      }
      if (endpoint === "/users/" && options?.method === "POST") {
        return Promise.resolve({
          id: "usr-test",
          userId: "usr-test",
          username: options.body ? JSON.parse(options.body).username : "testemployee",
          fullName: options.body ? JSON.parse(options.body).fullName : "Test Employee",
          role: "REPORT_USER",
          branchId: "br-1",
          status: "Active",
          allowedBranches: ["Main Branch"],
          salary: {
            fixedMonthly: 35000,
            commission: { type: "None", value: 0 },
            travelAllowance: { type: "None", value: 0 },
            otherAllowances: { da: 0, mobile: 0, internet: 0, fuel: 0 },
          },
          payment: {
            frequency: "Monthly",
            bankDetails: "",
            upi: "",
            salaryEffectiveFrom: "",
            commissionEffectiveFrom: "",
          },
          performance: {
            attendancePercentage: 0,
            monthlySales: 0,
            targetsAssigned: 0,
            targetsAchieved: 0,
            commissionEarned: 0,
            travelClaimStatus: "None",
          },
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
            policyAnnouncements: true,
          },
          department: "Reporting",
          designation: "Analyst",
          branch: "Main Branch",
        });
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    if (root) {
      root.unmount();
      root = null;
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("submits create staff payload using camelCase StaffUserCreate fields", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<StaffManagementTab currentUser={{ role: "SYSADMIN", name: "Test Admin" }} viewMode="employees" />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Add Employee")
    );
    expect(addButton).toBeTruthy();

    await act(async () => {
      addButton!.click();
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const form = container.querySelector<HTMLFormElement>("form");
    expect(form).toBeTruthy();

    const fullNameInput = form!.querySelector<HTMLInputElement>('input[placeholder="e.g. Rajesh Kumar"]');
    const usernameInput = form!.querySelector<HTMLInputElement>('input[placeholder="e.g. rajesh"]');
    const passwordInput = form!.querySelector<HTMLInputElement>('input[placeholder="Default setup password"]');
    const allowedBranchesInput = form!.querySelector<HTMLInputElement>('input[placeholder="e.g. Andheri West, Mumbai, Connaught Place, Delhi"]');
    const salaryInput = form!.querySelector<HTMLInputElement>('input[placeholder="30000"]');
    const selects = Array.from(form!.querySelectorAll<HTMLSelectElement>("select"));

    expect(fullNameInput).toBeTruthy();
    expect(usernameInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(allowedBranchesInput).toBeTruthy();
    expect(salaryInput).toBeTruthy();
    expect(selects.length).toBeGreaterThanOrEqual(4);

    await act(async () => {
      const fillInput = (input: HTMLInputElement, value: string) => {
        input.value = value;
        Simulate.change(input, { target: { value } } as any);
      };

      fillInput(fullNameInput!, "Test Employee");
      fillInput(usernameInput!, "testemployee");
      fillInput(passwordInput!, "Test@1234");
      fillInput(allowedBranchesInput!, "Main Branch");
      fillInput(salaryInput!, "35000");

      const roleSelect = selects[0];
      const designationSelect = selects[1];
      const departmentSelect = selects[2];
      const branchSelect = selects[3];

      roleSelect.value = "REPORT_USER";
      Simulate.change(roleSelect, { target: { value: "REPORT_USER" } } as any);

      designationSelect.value = "des-1";
      Simulate.change(designationSelect, { target: { value: "des-1" } } as any);

      departmentSelect.value = "dep-1";
      Simulate.change(departmentSelect, { target: { value: "dep-1" } } as any);

      branchSelect.value = "br-1";
      Simulate.change(branchSelect, { target: { value: "br-1" } } as any);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    console.log("input outerHTMLs", {
      fullName: fullNameInput?.outerHTML,
      username: usernameInput?.outerHTML,
      password: passwordInput?.outerHTML,
      allowedBranches: allowedBranchesInput?.outerHTML,
      salary: salaryInput?.outerHTML,
    });
    console.log("filled values", {
      fullName: fullNameInput!.value,
      username: usernameInput!.value,
      password: passwordInput!.value,
      allowedBranches: allowedBranchesInput!.value,
      salary: salaryInput!.value,
      selectValues: selects.map(s => s.value),
    });

    const saveButton = form!.querySelector<HTMLButtonElement>("button[type='submit']") ?? Array.from(form!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save Employee")
    );
    expect(saveButton).toBeTruthy();
    console.log("form buttons", form!.querySelectorAll("button").length);
    console.log("saveButton outerHTML", saveButton!.outerHTML);

    await act(async () => {
      Simulate.submit(form!);
    });

    console.log("apiFetchV1 calls:", apiFetchV1Mock.mock.calls.map(c => [c[0], c[1]?.method]));
    const postCall = apiFetchV1Mock.mock.calls.find(
      (call: any) => call[0] === "/users/" && call[1]?.method === "POST"
    );

    expect(postCall).toBeTruthy();

    const body = JSON.parse((postCall as any)[1]?.body as string);
    expect(body).toEqual(
      expect.objectContaining({
        fullName: "Test Employee",
        username: "testemployee",
        passwordHash: "Test@1234",
        role: "REPORT_USER",
        designation: "Analyst",
        department: "Reporting",
        branch: "Main Branch",
        designationId: "des-1",
        departmentId: "dep-1",
        branchId: "br-1",
        status: "Active",
        allowedBranches: ["Main Branch"],
        salary: { fixedMonthly: 35000 },
      })
    );
  });
});
