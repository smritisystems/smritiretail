"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from sqlalchemy import Column, String, SmallInteger, Integer, Boolean, DateTime, Text, Numeric, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base


# ---------------------------------------------------------------------------
# Existing models — Theme & Workspace (smritisys)
# ---------------------------------------------------------------------------

class SmritiTheme(Base):
    __tablename__ = "smriti_themes"

    id = Column(String(50), primary_key=True)
    tenant_id = Column(String(50), nullable=True)
    company_id = Column(String(50), nullable=False, default="GLOBAL")
    theme_name = Column(String(100), nullable=False)
    icon_pack = Column(String(50), nullable=True, default="Material Symbols Outlined")
    illustration_set = Column(String(50), nullable=True, default="default")
    font_heading = Column(String(100), nullable=True, default="Space Grotesk")
    font_body = Column(String(100), nullable=True, default="Inter")
    border_radius_px = Column(SmallInteger, nullable=True, default=6)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    variants = relationship("SmritiThemeVariant", back_populates="theme", cascade="all, delete-orphan")


class SmritiThemeVariant(Base):
    __tablename__ = "smriti_theme_variants"

    id = Column(String(50), primary_key=True)
    theme_id = Column(String(50), ForeignKey("smriti_themes.id", ondelete="CASCADE"), nullable=False)
    variant = Column(String(30), nullable=False)  # 'light', 'dark', 'navy', 'high_contrast'
    primary_color = Column(String(20), nullable=False)
    secondary_color = Column(String(20), nullable=False)
    accent_color = Column(String(20), nullable=False)
    background_color = Column(String(20), nullable=False)
    surface_color = Column(String(20), nullable=False)
    text_primary = Column(String(20), nullable=False)
    text_secondary = Column(String(20), nullable=False)
    border_color = Column(String(20), nullable=False)
    danger_color = Column(String(20), nullable=False)
    success_color = Column(String(20), nullable=False)
    warning_color = Column(String(20), nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    theme = relationship("SmritiTheme", back_populates="variants")


class SmritiWorkspaceProfile(Base):
    __tablename__ = "smriti_workspace_profiles"

    id = Column(String(50), primary_key=True)
    tenant_id = Column(String(50), nullable=True)
    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    persona = Column(String(50), nullable=False)  # 'SYSADMIN', 'CASHIER', 'STORE_MANAGER', 'ACCOUNTANT'
    default_workspace_id = Column(String(50), nullable=False)
    layout_json = Column(Text, nullable=True)
    theme = Column(String(50), nullable=False, default="theme-smriti-default")
    shortcuts_json = Column(Text, nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(50), nullable=True)
    updated_by = Column(String(50), nullable=True)


# ---------------------------------------------------------------------------
# New models — UI/Experience Engine (smritisys) — v1368_ui_experience_engine
# Blueprint §11: screen_definitions, field_definitions, action_definitions,
#                layout_definitions, icon_registry
# ---------------------------------------------------------------------------

class ScreenDefinition(Base):
    """
    Canonical layout and metadata of each named screen/view in smritisys.
    Governs SIMPLE / HYBRID / ADVANCED persona contexts.
    Control Plane defines WHAT; application code renders HOW.
    """
    __tablename__ = "screen_definitions"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(String(100), nullable=True)

    code = Column(String(100), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    module_code = Column(String(50), nullable=False)         # e.g. SALES, POS, INVENTORY
    workspace_code = Column(String(50), nullable=True)
    screen_type = Column(String(30), nullable=False, default="LIST")     # LIST | DETAIL | FORM | DASHBOARD | WIZARD
    persona_mode = Column(String(20), nullable=False, default="HYBRID")  # SIMPLE | HYBRID | ADVANCED
    capability_code = Column(String(50), nullable=True)

    layout_config = Column(JSONB, nullable=False, default={})
    default_filters = Column(JSONB, nullable=False, default=[])
    default_sort = Column(JSONB, nullable=False, default={})
    pagination_default = Column(Integer, nullable=False, default=25)
    searchable = Column(Boolean, nullable=False, default=True)
    exportable = Column(Boolean, nullable=False, default=False)
    printable = Column(Boolean, nullable=False, default=False)

    route_path = Column(String(255), nullable=True)
    icon_key = Column(String(100), nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE")


class FieldDefinition(Base):
    """
    Individual field metadata: type, label, validation, visibility.
    Fields are referenced by screen_definitions via layout_config JSONB.
    Stored in smritisys — governs product-level field configuration.
    """
    __tablename__ = "field_definitions"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)

    code = Column(String(100), nullable=False, unique=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    label_key = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    field_type = Column(String(50), nullable=False)          # TEXT | NUMBER | DATE | DATETIME | SELECT | MULTI_SELECT | BOOLEAN | LOOKUP | CURRENCY | BARCODE | FILE
    data_type = Column(String(30), nullable=False, default="STRING")     # STRING | INTEGER | DECIMAL | BOOLEAN | DATE | JSON
    is_required = Column(Boolean, nullable=False, default=False)
    is_readonly = Column(Boolean, nullable=False, default=False)
    is_searchable = Column(Boolean, nullable=False, default=True)
    is_sortable = Column(Boolean, nullable=False, default=True)
    is_filterable = Column(Boolean, nullable=False, default=True)
    is_exportable = Column(Boolean, nullable=False, default=True)
    is_hidden = Column(Boolean, nullable=False, default=False)

    validation_rules = Column(JSONB, nullable=False, default=[])
    options_source = Column(String(100), nullable=True)      # e.g. GST_SLABS, PARTY_TYPES
    options_static = Column(JSONB, nullable=False, default=[])
    lookup_endpoint = Column(String(255), nullable=True)
    default_value = Column(Text, nullable=True)
    placeholder_key = Column(String(200), nullable=True)
    help_text_key = Column(String(200), nullable=True)
    max_length = Column(Integer, nullable=True)
    min_value = Column(Numeric(precision=18, scale=4), nullable=True)
    max_value = Column(Numeric(precision=18, scale=4), nullable=True)
    format_mask = Column(String(100), nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE")


class ActionDefinition(Base):
    """
    Button/link action metadata available on screens and toolbars.
    Governs visibility per role/capability. Not executable business logic.
    Stored in smritisys — application code implements the action handler.
    """
    __tablename__ = "action_definitions"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)

    code = Column(String(100), nullable=False, unique=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    label_key = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    action_type = Column(String(50), nullable=False)         # NAVIGATE | API_CALL | DOWNLOAD | PRINT | MODAL | CONFIRM | WORKFLOW_TRANSITION
    screen_code = Column(String(100), nullable=True)
    placement = Column(String(30), nullable=False, default="TOOLBAR")    # TOOLBAR | ROW | FAB | CONTEXT_MENU | BULK
    icon_key = Column(String(100), nullable=True)
    variant = Column(String(30), nullable=False, default="PRIMARY")      # PRIMARY | SECONDARY | DANGER | GHOST | ICON
    order_index = Column(Integer, nullable=False, default=0)

    required_capability = Column(String(50), nullable=True)
    required_roles = Column(JSONB, nullable=False, default=[])
    visibility_condition = Column(JSONB, nullable=False, default={})
    confirmation_required = Column(Boolean, nullable=False, default=False)
    confirmation_message_key = Column(String(200), nullable=True)

    target_route = Column(String(255), nullable=True)
    api_endpoint = Column(String(255), nullable=True)
    api_method = Column(String(10), nullable=False, default="POST")
    workflow_action = Column(String(100), nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE")


class LayoutDefinition(Base):
    """
    Named reusable layout templates for SMRITI screens.
    Referenced by ScreenDefinition.layout_config.
    Stored in smritisys Control Plane.
    """
    __tablename__ = "layout_definitions"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    code = Column(String(100), nullable=False, unique=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    layout_type = Column(String(50), nullable=False)         # FULL_WIDTH | SIDEBAR_LEFT | SIDEBAR_RIGHT | SPLIT | GRID_2 | GRID_3 | CARD_GRID | WIZARD_STEPS
    is_responsive = Column(Boolean, nullable=False, default=True)
    breakpoints = Column(JSONB, nullable=False, default={})
    regions = Column(JSONB, nullable=False, default=[])
    css_overrides = Column(JSONB, nullable=False, default={})
    persona_modes = Column(JSONB, nullable=False, default=["SIMPLE", "HYBRID", "ADVANCED"])
    status = Column(String(30), nullable=False, default="ACTIVE")


class IconRegistry(Base):
    """
    Canonical icon catalogue for the SMRITI platform.
    Decouples icon key references from application source code.
    Stored in smritisys Control Plane — Blueprint §11 icon_registry.
    """
    __tablename__ = "icon_registry"

    id = Column(String(50), primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)

    key = Column(String(100), nullable=False, unique=True)       # e.g. "icon.pos.checkout"
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    icon_pack = Column(String(50), nullable=False, default="Material Symbols Outlined")
    icon_identifier = Column(String(200), nullable=False)        # e.g. "point_of_sale"
    icon_category = Column(String(50), nullable=True)            # NAVIGATION | ACTION | STATUS | MODULE | ENTITY
    module_scope = Column(String(50), nullable=True)             # e.g. POS, SALES, GLOBAL
    svg_inline = Column(Text, nullable=True)                     # custom inline SVG override
    aliases = Column(JSONB, nullable=False, default=[])
    tags = Column(JSONB, nullable=False, default=[])
    status = Column(String(30), nullable=False, default="ACTIVE")
