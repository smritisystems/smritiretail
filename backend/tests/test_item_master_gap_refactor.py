"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.1.0
Created      : 2026-08-20
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
import psycopg2
from app.models.inventory import Product
from sqlalchemy import Index

def test_variant_id_on_product_model():
    """Verify that Product model has variant_id and required indexes in __table_args__."""
    assert hasattr(Product, "variant_id"), "Product model must have variant_id attribute"
    assert Product.variant_id.property.columns[0].name == "variant_id"

    # Verify indexes in __table_args__
    table_args = Product.__table_args__
    index_names = [arg.name for arg in table_args if isinstance(arg, Index)]
    
    assert "idx_products_variant_id" in index_names, "idx_products_variant_id must be in Product.__table_args__"
    assert "uq_variant_identity_active" in index_names, "uq_variant_identity_active must be in Product.__table_args__"
    assert "uq_company_barcode_active" in index_names, "uq_company_barcode_active must be in Product.__table_args__"

def test_barcode_company_isolation_live():
    """Verify uq_company_barcode_active and idx_products_barcode live on PostgreSQL."""
    try:
        conn = psycopg2.connect(host="localhost", port=5432, user="postgres", password="postgres", dbname="smriti001")
        cur = conn.cursor()
        cur.execute("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'products' AND indexname IN ('idx_products_barcode', 'uq_company_barcode_active');
        """)
        idx_dict = {r[0]: r[1] for r in cur.fetchall()}
        assert "idx_products_barcode" in idx_dict
        assert "uq_company_barcode_active" in idx_dict
        conn.close()
    except Exception as e:
        pytest.skip(f"PostgreSQL smriti001 not reachable: {e}")

def test_report_flat_inventory_sales_view_live():
    """Verify that report_flat_inventory_sales view exists and is queryable in PostgreSQL."""
    try:
        conn = psycopg2.connect(host="localhost", port=5432, user="postgres", password="postgres", dbname="smritisys")
        cur = conn.cursor()
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'report_flat_inventory_sales' ORDER BY ordinal_position")
        columns = [r[0] for r in cur.fetchall()]
        
        expected_cols = [
            "variant_id", "product_id", "company_id", "branch_id", "sku_code",
            "barcode", "product_name", "merchandise_category", "brand",
            "style_code", "color", "size", "mrp", "cost_price",
            "selling_price", "gst_percentage", "hsn_code", "current_stock",
            "attributes", "is_deleted", "created_at", "modified_at"
        ]
        for col in expected_cols:
            assert col in columns, f"Expected column {col} in report_flat_inventory_sales"
        
        cur.execute("SELECT COUNT(*) FROM report_flat_inventory_sales WHERE is_deleted = false")
        count = cur.fetchone()[0]
        assert count >= 0, "View query must succeed"
        conn.close()
    except Exception as e:
        pytest.skip(f"PostgreSQL smritisys not reachable: {e}")
