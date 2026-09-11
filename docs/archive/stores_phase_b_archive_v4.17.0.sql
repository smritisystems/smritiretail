-- SMRITI Retail OS - Table Archive
-- Table: stores
-- Archived: 2026-09-10 (v4.17.0 Phase B Staged Migration)
-- Status: PHASE_B_DEPRECATED - Schema preserved, zero rows in production
-- Governance: See docs/walkthrough/foundation/Staged_Migration_Audit_And_Deprecation_Phase_A_B_v4.17.0.md
-- Removal: Phase C only after all 5 safety gates pass

-- DDL:
CREATE TABLE IF NOT EXISTS stores (code character varying(50) NOT NULL, name character varying(200) NOT NULL, store_type character varying(50), address text, id character varying(50) NOT NULL, uuid character varying(36) NOT NULL, company_id character varying(50), branch_id character varying(50), created_at timestamp with time zone, modified_at timestamp with time zone, created_by character varying(100), updated_by character varying(100), is_active boolean, is_deleted boolean, deleted_at timestamp with time zone, deleted_by character varying(100), version integer);

-- Indexes:
CREATE UNIQUE INDEX stores_pkey ON public.stores USING btree (id);
CREATE UNIQUE INDEX stores_code_key ON public.stores USING btree (code);
CREATE UNIQUE INDEX stores_uuid_key ON public.stores USING btree (uuid);

-- Foreign Key Constraints (if any):
-- ALTER TABLE stores ADD CONSTRAINT stores_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
-- ALTER TABLE stores ADD CONSTRAINT stores_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
