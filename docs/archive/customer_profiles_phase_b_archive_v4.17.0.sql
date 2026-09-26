-- SMRITI Retail OS - Table Archive
-- Table: customer_profiles
-- Archived: 2026-09-10 (v4.17.0 Phase B Staged Migration)
-- Status: PHASE_B_DEPRECATED - Schema preserved, zero rows in production
-- Governance: See docs/walkthrough/foundation/Staged_Migration_Audit_And_Deprecation_Phase_A_B_v4.17.0.md
-- Removal: Phase C only after all 5 safety gates pass

-- DDL:
CREATE TABLE IF NOT EXISTS customer_profiles (id character varying(50) NOT NULL, uuid character varying(36) NOT NULL, company_id character varying(50), branch_id character varying(50), created_at timestamp with time zone, modified_at timestamp with time zone, created_by character varying(100), updated_by character varying(100), is_active boolean, is_deleted boolean, deleted_at timestamp with time zone, deleted_by character varying(100), version integer, party_id character varying(50), customer_group_id character varying(50), customer_category character varying(30), credit_limit numeric, credit_days integer, tax_category character varying(30), is_credit_hold boolean, price_tier_id character varying(50), loyalty_tier_id character varying(50), outstanding_balance numeric);

-- Indexes:
CREATE UNIQUE INDEX customer_profiles_pkey ON public.customer_profiles USING btree (id);
CREATE UNIQUE INDEX customer_profiles_party_id_key ON public.customer_profiles USING btree (party_id);

-- Foreign Key Constraints (if any):
-- ALTER TABLE customer_profiles ADD CONSTRAINT customer_profiles_party_id_fkey FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;
