# Issue ID
Issue-001

## Module
Sales Studio / Sales-related modules

## Severity
High

## Category
Workflow

## Description
The demo user could access the launchpad but was blocked from entering sales workflows because the account was not assigned to a company and branch. This prevented a realistic end-to-end sales demonstration.

## Actual Result
A blocking message appeared stating that Sales Studio requires tenant assignment.

## Expected Result
The system should either provide a guided demo path or allow a demo operator account to preview sales workflows without requiring tenant setup.

## Steps to Reproduce
1. Log in with a demo administrator account.
2. Open the launchpad.
3. Navigate to Sales Invoices or related sales modules.
4. Observe the access-blocking message.

## Screenshots
- Placeholder: DemoAndIssues/Screenshots/Launchpad_Tenant_Guardrail.png

## Suggested Improvement
Provide a demo-mode experience and clearer onboarding for tenant-scoped modules.

## Status
Open
