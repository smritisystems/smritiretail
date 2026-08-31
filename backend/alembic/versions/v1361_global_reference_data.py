"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- Global Reference Data & Localization Engine (P1.1)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "v1361_global_reference_data"
down_revision: Union[str, None] = "v1360_pos_sct_fk_constraints"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Countries Reference
    if "countries_ref" not in tables:
        op.create_table(
            "countries_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("code", sa.String(3), nullable=False, unique=True),
            sa.Column("iso3", sa.String(3), nullable=False, unique=True),
            sa.Column("numeric_code", sa.String(3), nullable=True),
            sa.Column("name", sa.String(150), nullable=False),
            sa.Column("phone_code", sa.String(10), nullable=False),
            sa.Column("default_currency", sa.String(10), nullable=False, server_default="INR"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )
        op.create_index("idx_countries_name", "countries_ref", ["name"])

    # 2. States Reference
    if "states_ref" not in tables:
        op.create_table(
            "states_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("country_id", sa.String(50), sa.ForeignKey("countries_ref.id", ondelete="CASCADE"), nullable=False),
            sa.Column("country_code", sa.String(3), nullable=False, server_default="IN"),
            sa.Column("state_code", sa.String(10), nullable=False),
            sa.Column("name", sa.String(150), nullable=False),
            sa.Column("gst_state_code", sa.String(2), nullable=True),
            sa.Column("state_type", sa.String(30), nullable=False, server_default="STATE"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.UniqueConstraint("country_code", "state_code", name="uq_country_state_code"),
        )
        op.create_index("idx_states_gst_code", "states_ref", ["country_code", "gst_state_code"])

    # 3. Districts Reference
    if "districts_ref" not in tables:
        op.create_table(
            "districts_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("state_id", sa.String(50), sa.ForeignKey("states_ref.id", ondelete="CASCADE"), nullable=False),
            sa.Column("district_code", sa.String(20), nullable=False),
            sa.Column("name", sa.String(150), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.UniqueConstraint("state_id", "district_code", name="uq_state_district_code"),
        )

    # 4. Postal Codes Reference
    if "postal_codes_ref" not in tables:
        op.create_table(
            "postal_codes_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("country_code", sa.String(3), nullable=False, server_default="IN"),
            sa.Column("state_code", sa.String(10), nullable=False),
            sa.Column("postal_code", sa.String(20), nullable=False),
            sa.Column("locality", sa.String(200), nullable=True),
            sa.Column("city", sa.String(150), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )
        op.create_index("idx_postal_country_code", "postal_codes_ref", ["country_code", "postal_code"])

    # 5. Languages Reference
    if "languages_ref" not in tables:
        op.create_table(
            "languages_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("code", sa.String(10), nullable=False, unique=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("native_name", sa.String(100), nullable=False),
            sa.Column("script", sa.String(50), nullable=False, server_default="Latin"),
            sa.Column("is_rtl", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )

    # 6. Locales Reference
    if "locales_ref" not in tables:
        op.create_table(
            "locales_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("code", sa.String(20), nullable=False, unique=True),
            sa.Column("language_code", sa.String(10), nullable=False),
            sa.Column("country_code", sa.String(3), nullable=False),
            sa.Column("date_format", sa.String(30), nullable=False, server_default="DD/MM/YYYY"),
            sa.Column("time_format", sa.String(30), nullable=False, server_default="12H"),
            sa.Column("number_system", sa.String(30), nullable=False, server_default="INDIAN_LAKH_CRORE"),
            sa.Column("timezone", sa.String(100), nullable=False, server_default="Asia/Kolkata"),
            sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )

    # 7. Translation Keys Reference
    if "translation_keys_ref" not in tables:
        op.create_table(
            "translation_keys_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("key", sa.String(150), nullable=False, unique=True),
            sa.Column("category", sa.String(50), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("default_text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )
        op.create_index("idx_tkeys_category", "translation_keys_ref", ["category"])

    # 8. Translations Reference
    if "translations_ref" not in tables:
        op.create_table(
            "translations_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("key_id", sa.String(50), sa.ForeignKey("translation_keys_ref.id", ondelete="CASCADE"), nullable=False),
            sa.Column("language_code", sa.String(10), nullable=False),
            sa.Column("translation_text", sa.Text(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("is_approved", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.UniqueConstraint("key_id", "language_code", name="uq_translation_key_lang"),
        )
        op.create_index("idx_translations_lang_key", "translations_ref", ["language_code", "key_id"])

    # 9. Currencies Reference
    if "currencies_ref" not in tables:
        op.create_table(
            "currencies_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("code", sa.String(10), nullable=False, unique=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("symbol", sa.String(10), nullable=False),
            sa.Column("subunit", sa.String(30), nullable=False, server_default="Paisa"),
            sa.Column("decimal_places", sa.Integer(), nullable=False, server_default="2"),
            sa.Column("symbol_position", sa.String(10), nullable=False, server_default="BEFORE"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )

    # 10. UOMs Reference
    if "uoms_ref" not in tables:
        op.create_table(
            "uoms_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("code", sa.String(20), nullable=False, unique=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("category", sa.String(30), nullable=False),
            sa.Column("uqc_code", sa.String(10), nullable=False),
            sa.Column("decimal_allowed", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )

    # 11. UOM Conversions Reference
    if "uom_conversions_ref" not in tables:
        op.create_table(
            "uom_conversions_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("from_uom", sa.String(20), nullable=False),
            sa.Column("to_uom", sa.String(20), nullable=False),
            sa.Column("conversion_factor", sa.Numeric(18, 6), nullable=False),
            sa.Column("is_system", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.UniqueConstraint("from_uom", "to_uom", name="uq_uom_conversion_pair"),
        )
        op.create_index("idx_uconv_pair", "uom_conversions_ref", ["from_uom", "to_uom"])

    # 12. Tax References Reference
    if "tax_references_ref" not in tables:
        op.create_table(
            "tax_references_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("tax_type", sa.String(20), nullable=False, server_default="GST"),
            sa.Column("code", sa.String(30), nullable=False, unique=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("rate", sa.Numeric(6, 2), nullable=False),
            sa.Column("cgst_rate", sa.Numeric(6, 2), nullable=False, server_default="0.00"),
            sa.Column("sgst_rate", sa.Numeric(6, 2), nullable=False, server_default="0.00"),
            sa.Column("igst_rate", sa.Numeric(6, 2), nullable=False, server_default="0.00"),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )

    # 13. HSN / SAC Codes Reference
    if "hsn_sac_codes_ref" not in tables:
        op.create_table(
            "hsn_sac_codes_ref",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("code", sa.String(20), nullable=False, unique=True),
            sa.Column("code_type", sa.String(10), nullable=False, server_default="HSN"),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("gst_rate", sa.Numeric(6, 2), nullable=False, server_default="18.00"),
            sa.Column("compensation_cess_rate", sa.Numeric(6, 2), nullable=False, server_default="0.00"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )
        op.create_index("idx_hsn_sac_desc", "hsn_sac_codes_ref", ["description"])

    # 14. Platform Reference Data
    if "platform_reference_data" not in tables:
        op.create_table(
            "platform_reference_data",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("category", sa.String(50), nullable=False),
            sa.Column("code", sa.String(50), nullable=False),
            sa.Column("label", sa.String(150), nullable=False),
            sa.Column("data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_system", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.UniqueConstraint("category", "code", name="uq_platform_ref_category_code"),
        )
        op.create_index("idx_platform_ref_category", "platform_reference_data", ["category"])


def downgrade():
    raise NotImplementedError(
        "v1361_global_reference_data is a FORWARD-ONLY migration. "
        "Downgrade is blocked by SMRITI Data Governance Policy."
    )
