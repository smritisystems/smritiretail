"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.19.1
Created      : 2026-09-04
Modified     : 2026-09-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from datetime import date
from decimal import Decimal
from pydantic import ValidationError
from sqlalchemy import inspect as sa_inspect
from app.models.sales import SalesInvoice
from app.models.crm import (
    Customer,
    CustomerGroup,
    CustomerGSTRegistration,
    CustomerDeliveryLocation,
)
from app.schemas.crm import (
    CustomerGSTRegistrationBase,
    CustomerGSTRegistrationCreate,
    CustomerDeliveryLocationBase,
    CustomerDeliveryLocationCreate,
    CustomerResponse,
)
from app.schemas.sales import SalesInvoiceBase


def test_a_sales_invoice_orm_accepts_all_six_new_fields():
    """A. SalesInvoice ORM accepts all six new fields."""
    inv = SalesInvoice(
        invoice_no="INV-TEST-001",
        date=date.today(),
        delivery_location_id="loc-001",
        delivery_store_code="T97D",
        delivery_gstin="27AAACR7015K1Z0",
        billed_party_gstin_id="gst-001",
        delivery_location_snapshot={"store_code": "T97D", "city": "Mumbai"},
        place_of_supply_code="27",
    )
    assert inv.delivery_location_id == "loc-001"
    assert inv.delivery_store_code == "T97D"
    assert inv.delivery_gstin == "27AAACR7015K1Z0"
    assert inv.billed_party_gstin_id == "gst-001"
    assert inv.delivery_location_snapshot == {"store_code": "T97D", "city": "Mumbai"}
    assert inv.place_of_supply_code == "27"


def test_b_sales_invoice_schema_serialization_and_aliases():
    """B. SalesInvoice schema handles aliases and can serialize new fields."""
    payload = {
        "invoice_no": "INV-TEST-002",
        "deliveryLocationId": "loc-999",
        "deliveryStoreCode": "TFW4",
        "deliveryGstin": "06AAACR7015K1Z1",
        "billedPartyGstinId": "gst-002",
        "deliveryLocationSnapshot": {"store_code": "TFW4", "city": "Gurgaon"},
        "placeOfSupplyCode": "06",
        "sisCode": "TFW4",
    }
    schema = SalesInvoiceBase(**payload)
    assert schema.delivery_location_id == "loc-999"
    assert schema.delivery_store_code == "TFW4"
    assert schema.delivery_gstin == "06AAACR7015K1Z1"
    assert schema.billed_party_gstin_id == "gst-002"
    assert schema.delivery_location_snapshot["city"] == "Gurgaon"
    assert schema.place_of_supply_code == "06"
    assert schema.sis_code == "TFW4"


def test_c_customer_gst_registration_normalizes_lowercase_gstin():
    """C. CustomerGSTRegistration normalizes lowercase GSTIN to uppercase."""
    reg = CustomerGSTRegistrationBase(
        gstin="27aaacr7015k1z0",
        stateName="Maharashtra",
        stateCode="27",
    )
    assert reg.gstin == "27AAACR7015K1Z0"
    assert reg.state_code == "27"


def test_d_invalid_gstin_state_code_mismatch_rejected():
    """D. Invalid GSTIN/state-code mismatch is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        CustomerGSTRegistrationBase(
            gstin="27AAACR7015K1Z0",
            stateName="Haryana",
            stateCode="06",
        )
    assert "does not match state_code" in str(exc_info.value)


def test_e_valid_gstin_state_code_combination_passes():
    """E. Valid GSTIN/state-code combination passes."""
    reg1 = CustomerGSTRegistrationBase(
        gstin="27AAACR7015K1Z0",
        stateName="Maharashtra",
        stateCode="27",
    )
    reg2 = CustomerGSTRegistrationBase(
        gstin="06AAACR7015K1Z1",
        stateName="Haryana",
        stateCode="06",
    )
    reg3 = CustomerGSTRegistrationBase(
        gstin="29AAACR7015K1Z2",
        stateName="Karnataka",
        stateCode="29",
    )
    assert reg1.state_code == "27"
    assert reg2.state_code == "06"
    assert reg3.state_code == "29"


def test_f_new_tables_contain_required_base_entity_audit_columns():
    """F. New tables contain required BaseEntity audit columns."""
    gst_mapper = sa_inspect(CustomerGSTRegistration)
    cdl_mapper = sa_inspect(CustomerDeliveryLocation)

    expected_audit_cols = [
        "id",
        "uuid",
        "company_id",
        "branch_id",
        "created_at",
        "modified_at",
        "created_by",
        "updated_by",
        "is_active",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "version",
    ]

    for col in expected_audit_cols:
        assert col in gst_mapper.columns, f"CustomerGSTRegistration missing audit col: {col}"
        assert col in cdl_mapper.columns, f"CustomerDeliveryLocation missing audit col: {col}"


def test_g_company_id_branch_id_fk_metadata_is_correct():
    """G. company_id / branch_id FK metadata is correct."""
    gst_mapper = sa_inspect(CustomerGSTRegistration)
    cdl_mapper = sa_inspect(CustomerDeliveryLocation)

    gst_comp_fks = list(gst_mapper.columns["company_id"].foreign_keys)
    gst_branch_fks = list(gst_mapper.columns["branch_id"].foreign_keys)
    assert len(gst_comp_fks) == 1
    assert gst_comp_fks[0].target_fullname == "companies.id"
    assert len(gst_branch_fks) == 1
    assert gst_branch_fks[0].target_fullname == "branches.id"

    cdl_comp_fks = list(cdl_mapper.columns["company_id"].foreign_keys)
    cdl_branch_fks = list(cdl_mapper.columns["branch_id"].foreign_keys)
    assert len(cdl_comp_fks) == 1
    assert cdl_comp_fks[0].target_fullname == "companies.id"
    assert len(cdl_branch_fks) == 1
    assert cdl_branch_fks[0].target_fullname == "branches.id"


def test_h_required_indexes_exist_on_models():
    """H. Required indexes exist on models."""
    si_mapper = sa_inspect(SalesInvoice)
    si_cols = si_mapper.columns

    assert si_cols["delivery_location_id"].index is True
    assert si_cols["delivery_store_code"].index is True
    assert si_cols["billed_party_gstin_id"].index is True

    cdl_mapper = sa_inspect(CustomerDeliveryLocation)
    assert cdl_mapper.columns["store_code"].index is True
    assert cdl_mapper.columns["customer_id"].index is True
    assert cdl_mapper.columns["gst_registration_id"].index is True

    gst_mapper = sa_inspect(CustomerGSTRegistration)
    assert gst_mapper.columns["customer_id"].index is True
    assert gst_mapper.columns["gstin"].index is True


def test_i_customer_gst_registration_primary_index_metadata():
    """I. CustomerGSTRegistration primary uniqueness index metadata behaves correctly."""
    gst_table = CustomerGSTRegistration.__table__
    index_names = [idx.name for idx in gst_table.indexes]
    assert "uq_cust_gst_reg_primary_per_customer" in index_names

    primary_idx = next(idx for idx in gst_table.indexes if idx.name == "uq_cust_gst_reg_primary_per_customer")
    assert primary_idx.unique is True
    assert [c.name for c in primary_idx.columns] == ["customer_id"]


def test_j_existing_legacy_sales_invoices_remain_readable():
    """J. Existing legacy sales invoices remain readable with null corporate B2B fields."""
    legacy_inv = SalesInvoice(
        invoice_no="INV-LEGACY-001",
        date=date(2026, 1, 15),
        customer_id="cust-001",
        customer_name="Walk-in Retail Customer",
        customer_gstin="URP",
        sis_code="1888",
        site_name="Phoenix Lower Parel",
        pos_state="Maharashtra (27)",
        grand_total=Decimal("1250.00"),
    )
    assert legacy_inv.delivery_location_id is None
    assert legacy_inv.delivery_store_code is None
    assert legacy_inv.delivery_gstin is None
    assert legacy_inv.billed_party_gstin_id is None
    assert legacy_inv.delivery_location_snapshot is None
    assert legacy_inv.place_of_supply_code is None
    assert legacy_inv.sis_code == "1888"


def test_k_sis_code_remains_available_alongside_delivery_store_code():
    """K. sis_code remains available alongside delivery_store_code."""
    inv = SalesInvoice(
        invoice_no="INV-DUAL-001",
        date=date.today(),
        sis_code="T97D",
        delivery_store_code="T97D",
    )
    assert inv.sis_code == "T97D"
    assert inv.delivery_store_code == "T97D"


def test_l_delivery_store_code_supports_alphanumeric_codes():
    """L. delivery_store_code supports alphanumeric Store Codes."""
    sample_codes = ["1888", "1969", "1977", "8313", "T97D", "TFW4", "TYAC", "V051", "TV78"]
    for code in sample_codes:
        loc = CustomerDeliveryLocation(
            customer_id="cust-ril-001",
            store_code=code,
            location_name=f"Trends Store {code}",
        )
        assert loc.store_code == code
        assert isinstance(loc.store_code, str)

        schema = CustomerDeliveryLocationBase(
            storeCode=code,
            locationName=f"Trends Store {code}",
        )
        assert schema.store_code == code


def test_m_customer_gst_number_remains_backward_compatible():
    """M. Customer.gst_number remains backward compatible."""
    c = Customer(
        name="Reliance Retail Limited",
        code="CUST-RIL-001",
        gst_number="27AAACR7015K1Z0",
    )
    assert c.gst_number == "27AAACR7015K1Z0"
    assert hasattr(c, "gst_registrations")
    assert hasattr(c, "delivery_locations")


def test_n_no_duplicate_customer_address_model():
    """N. No duplicate CustomerAddress / parallel delivery-location model was introduced."""
    import app.models.crm as crm_module
    assert hasattr(crm_module, "CustomerDeliveryLocation")
    assert hasattr(crm_module, "CustomerGSTRegistration")
    assert not hasattr(crm_module, "CustomerAddress")
    assert not hasattr(crm_module, "CustomerTaxProfile")
