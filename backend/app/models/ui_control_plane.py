"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from sqlalchemy import Column, String, SmallInteger, Boolean, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base

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
