# ADR-HR-002: Staff Data Ownership

**Status:** Accepted
**Date:** 2026-09-12

## Decision

SMRITI uses a hybrid staff model:

- `smritisys` owns authentication identity and authorization scope: users, roles, sessions, company assignments, branch assignments, and store assignments.
- Each company database owns the company-specific staff profile and all HR/operational records: employment details, attendance, leave, compensation, commission participation, and placements.

A company-local `staff_profiles.user_id` is an application-level reference to `smritisys.users.id`. PostgreSQL foreign keys must not cross the physical database boundary.

## Rationale

A login identity can operate for more than one company, while employment details and compensation are company-specific. Keeping HR data in the control plane increases cross-tenant exposure and conflicts with the database-per-company isolation policy. Staff placements also reference company-local branches, stores, customers, and delivery locations, so they belong with company operational data.

## Compatibility Strategy

`staff_profiles` is introduced as the company-local authority and backfilled from legacy company-local `users` rows. Existing central `/users` APIs remain compatible during the migration. Staff 360 will be changed to compose identity from `smritisys` with the selected company's `staff_profiles` and HR records before legacy HR columns are removed from `users`.

## Non-Goals

- Do not create a separate global staff database.
- Do not copy passwords or authentication secrets into company databases.
- Do not remove legacy HR columns until all readers and writers have moved to `staff_profiles`.
