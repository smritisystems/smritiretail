"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Boolean, Text, Integer
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class AttributeDefinition(BaseEntity):
    """
    Schema template defining name, datatypes and values of custom product attributes.
    """
    __tablename__ = "attribute_definitions"

    name                 = Column(String(200), nullable=False)
    label                = Column(String(200), nullable=False)
    data_type            = Column(String(50), nullable=False)  # Text, Number, Select, Boolean, Date
    is_variant_dimension = Column(Boolean, default=False)
    is_mandatory         = Column(Boolean, default=False)
    valid_values         = Column(Text, nullable=True)         # JSON array of values for Select type
    group_id             = Column(String(50), nullable=True)

    # Extended dynamic configuration fields
    is_searchable        = Column(Boolean, default=True)
    is_filterable        = Column(Boolean, default=True)
    is_printable         = Column(Boolean, default=True)
    is_barcode_enabled   = Column(Boolean, default=True)
    display_order        = Column(Integer, default=0)
    default_value        = Column(String(200), nullable=True)
    tooltip              = Column(String(500), nullable=True)
    validation_rules     = Column(Text, nullable=True)
    is_enabled           = Column(Boolean, default=True)
    multi_lang_labels    = Column(JSONB, server_default="'{}'::jsonb", default=dict)



class AttributeGroup(BaseEntity):
    """
    Groups of attribute definitions displayed together in variant generation grids.
    """
    __tablename__ = "attribute_groups"

    name                     = Column(String(200), nullable=False)
    attribute_ids            = Column(Text, nullable=False)  # JSON array of Attribute IDs
    grid_column_attribute_id = Column(String(50), nullable=True)
    grid_row_attribute_id    = Column(String(50), nullable=True)


class VariantTemplate(BaseEntity):
    """
    Item SKU style templates defining dimensions and base pricing configurations.
    """
    __tablename__ = "variant_templates"

    style_code         = Column(String(100), nullable=False, unique=True)
    name               = Column(String(200), nullable=False)
    brand              = Column(String(100), default="SMRITI")
    category           = Column(String(100), default="General")
    hsn_code           = Column(String(20), default="61091000")
    base_price         = Column(Integer, default=0)
    base_mrp           = Column(Integer, default=0)
    gst_percentage     = Column(Integer, default=18)
    attribute_group_id = Column(String(50), nullable=False)
    pricing_mode       = Column(String(50), default="Fixed")     # Fixed, Weight-based
    tracking_mode      = Column(String(50), default="Standard")  # Standard, Batch, Serial


class CategoryAttributeGroupMapping(BaseEntity):
    """
    Associates item categories to specific attribute groups automatically.
    """
    __tablename__ = "category_attribute_group_mappings"

    category           = Column(String(100), nullable=False, unique=True)
    attribute_group_id = Column(String(50), nullable=False)
