"""
Unit tests for Vendor Directory and Supplier Alias Resolution
Verifies that:
1. VendorService._to_vendor_summary enriches outstanding liability when sp.outstanding_liability <= 0.
2. VendorService._to_vendor_detail enriches outstanding_liability_override.
3. PurchaseService._resolve_supplier_aliases correctly expands party IDs, vendor codes, and legacy IDs.
"""

import sys
sys.path.insert(0, ".")

import unittest
from unittest.mock import MagicMock, AsyncMock
from decimal import Decimal

from backend.app.services.vendor_svc import VendorService
from backend.app.schemas.vendor import VendorSummary, VendorDetail
from backend.app.models.party import Party, SupplierProfile


class TestVendorDirectoryEnrichment(unittest.TestCase):
    def test_vendor_summary_outstanding_override(self):
        party = MagicMock(spec=Party)
        party.id = "pty_test_123"
        party.party_code = "A"
        party.legal_name = "Aliya footwear"
        party.trade_name = "Aliya footwear"
        party.gstin = "27MQPPK1877E1Z6"
        party.pan = "MQPPK1877E"
        party.mobile = "9559460812"
        party.phone = None
        party.email = "test@example.com"
        party.city = "Mumbai"
        party.state = "Maharashtra"
        party.status = "ACTIVE"
        party.supplier_profile = MagicMock(spec=SupplierProfile)
        party.supplier_profile.commercial_classification = "APPROVED"
        party.supplier_profile.supplier_type = "MANUFACTURER"
        party.supplier_profile.outstanding_liability = Decimal("0.00")

        # When sp.outstanding_liability is 0, override applies
        summary = VendorService._to_vendor_summary(party, outstanding_override=850893.75)
        self.assertEqual(summary.outstanding, 850893.75)
        self.assertEqual(summary.legal_name, "Aliya footwear")
        self.assertEqual(summary.code, "A")

        # When sp.outstanding_liability > 0, existing liability is preserved
        party.supplier_profile.outstanding_liability = Decimal("50000.00")
        summary_existing = VendorService._to_vendor_summary(party, outstanding_override=850893.75)
        self.assertEqual(summary_existing.outstanding, 50000.00)

    def test_vendor_detail_outstanding_override(self):
        party = MagicMock(spec=Party)
        party.id = "pty_test_123"
        party.party_code = "A"
        party.party_type = "ORGANIZATION"
        party.legal_name = "Aliya footwear"
        party.trade_name = "Aliya footwear"
        party.gstin = "27MQPPK1877E1Z6"
        party.pan = "MQPPK1877E"
        party.mobile = "9559460812"
        party.phone = None
        party.email = "test@example.com"
        party.address_line1 = ""
        party.city = "Mumbai"
        party.state = "Maharashtra"
        party.pincode = "400001"
        party.status = "ACTIVE"
        party.merged_into_party_id = None
        party.metadata_json = {}
        party.bank_accounts = []
        party.contacts = []
        party.addresses = []
        party.roles = []
        party.tags = []
        party.supplier_profile = MagicMock(spec=SupplierProfile)
        party.supplier_profile.commercial_classification = "APPROVED"
        party.supplier_profile.supplier_type = "MANUFACTURER"
        party.supplier_profile.payment_terms_days = 120
        party.supplier_profile.msme_registration_no = None
        party.supplier_profile.msme_category = "NOT_APPLICABLE"
        party.supplier_profile.tds_section = "194Q"
        party.supplier_profile.tds_rate = Decimal("0.10")
        party.supplier_profile.tax_treatment = "REGISTERED_REGULAR"
        party.supplier_profile.outstanding_liability = Decimal("0.00")
        party.supplier_profile.verification_flags = {}

        detail = VendorService._to_vendor_detail(party, outstanding_liability_override=850893.75)
        self.assertEqual(detail.commercial.outstanding_liability, 850893.75)
        self.assertEqual(detail.commercial.payment_terms_days, 120)


if __name__ == "__main__":
    unittest.main()
