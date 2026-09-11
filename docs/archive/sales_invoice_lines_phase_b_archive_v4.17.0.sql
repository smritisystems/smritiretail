-- SMRITI Retail OS - Table Archive
-- Table: sales_invoice_lines
-- Archived: 2026-09-10 (v4.17.0 Phase B Staged Migration)
-- Status: PHASE_B_DEPRECATED - Schema preserved, zero rows in production
-- Governance: See docs/walkthrough/foundation/Staged_Migration_Audit_And_Deprecation_Phase_A_B_v4.17.0.md
-- Removal: Phase C only after all 5 safety gates pass

-- DDL:
CREATE TABLE IF NOT EXISTS sales_invoice_lines (id character varying(50) NOT NULL, uuid uuid, company_id character varying(50), branch_id character varying(50), invoice_id character varying(50) NOT NULL, line_no integer NOT NULL, product_name character varying(255), sku character varying(100), barcode character varying(100), hsn_code character varying(20), size_label character varying(50), color character varying(50), attribute_json jsonb, quantity numeric NOT NULL, unit_price numeric NOT NULL, mrp numeric, discount_pct numeric NOT NULL, discount_amount numeric NOT NULL, taxable_value numeric NOT NULL, tax_rate numeric NOT NULL, tax_amount numeric NOT NULL, net_amount numeric NOT NULL, warehouse_id character varying(50), batch_no character varying(100), created_at timestamp with time zone, modified_at timestamp with time zone, created_by character varying(100), updated_by character varying(100), is_active boolean, is_deleted boolean, deleted_at timestamp with time zone, deleted_by character varying(100), version integer, variant_id character varying(50));

-- Indexes:
CREATE UNIQUE INDEX sales_invoice_lines_pkey ON public.sales_invoice_lines USING btree (id);
CREATE UNIQUE INDEX sales_invoice_lines_uuid_key ON public.sales_invoice_lines USING btree (uuid);
CREATE INDEX ix_sales_invoice_lines_invoice_id ON public.sales_invoice_lines USING btree (invoice_id);
CREATE INDEX ix_sales_invoice_lines_is_deleted ON public.sales_invoice_lines USING btree (is_deleted);
CREATE INDEX ix_sales_invoice_lines_company_id ON public.sales_invoice_lines USING btree (company_id);
CREATE INDEX ix_sil_invoice_line ON public.sales_invoice_lines USING btree (invoice_id, line_no);
CREATE INDEX ix_sil_company_date ON public.sales_invoice_lines USING btree (company_id);

-- Foreign Key Constraints (if any):
-- ALTER TABLE sales_invoice_lines ADD CONSTRAINT sales_invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE;
-- ALTER TABLE sales_invoice_lines ADD CONSTRAINT sales_invoice_lines_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
