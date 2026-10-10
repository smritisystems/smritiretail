from app.models.crm import Customer, CustomerPolicy, CustomerRelationship
from app.models.loyalty import LoyaltyMember
from app.schemas.crm import CustomerCreate, CustomerResponse


def test_customer_ux_aliases_and_policy_fields_are_writable():
    payload = CustomerCreate(
        name="Contract Customer",
        customerType="Corporate",
        profileNotes="Primary account",
        transportMode="By-Road",
        allowCashBill=True,
        destinationTaxType="Local",
    )

    assert payload.customer_type == "Corporate"
    assert payload.profile_notes == "Primary account"
    assert payload.transport_mode == "By-Road"
    assert payload.allow_cash_bill is True
    assert payload.destination_tax_type == "Local"


def test_customer_response_exposes_authoritative_derived_fields():
    response_fields = CustomerResponse.model_fields

    assert "loyalty_points_balance" in response_fields
    assert "credit_used" in response_fields
    assert "dependants" in response_fields
    assert response_fields["loyalty_points_balance"].alias == "loyaltyPointsBalance"
    assert response_fields["credit_used"].alias == "creditUsed"


def test_customer_ux_entities_keep_normalized_relationship_boundaries():
    assert Customer.__tablename__ == "customers"
    assert CustomerPolicy.__tablename__ == "customer_policies"
    assert CustomerRelationship.__tablename__ == "customer_relationships"
    assert LoyaltyMember.__tablename__ == "loyalty_members"
    assert not hasattr(Customer, "loyalty_points_balance")
    assert not hasattr(Customer, "credit_used")
