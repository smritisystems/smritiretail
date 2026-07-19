"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-07-17
Modified     : 2026-07-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid as uuid_pkg
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, Index, Boolean, text
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class UserCompanyAssignment(BaseEntity):
    __tablename__ = "user_company_assignments"

    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_default = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index("ix_user_company_assignments_user_id", "user_id"),
        Index("ix_user_company_assignments_company_id", "company_id"),
        Index(
            "ix_user_company_assignments_user_id_company_id_active",
            "user_id",
            "company_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
        Index(
            "ix_user_company_assignments_user_id_default",
            "user_id",
            unique=True,
            postgresql_where=text("is_default = true"),
        ),
    )

    user = relationship("User", foreign_keys=[user_id])
    company = relationship("Company", foreign_keys=[company_id])


class UserBranchAssignment(BaseEntity):
    __tablename__ = "user_branch_assignments"

    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id = Column(String(50), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_default = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index("ix_user_branch_assignments_user_id", "user_id"),
        Index("ix_user_branch_assignments_company_id", "company_id"),
        Index("ix_user_branch_assignments_branch_id", "branch_id"),
        Index(
            "ix_user_branch_assignments_user_id_branch_id_active",
            "user_id",
            "branch_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
        Index(
            "ix_user_branch_assignments_user_id_company_id_default",
            "user_id",
            "company_id",
            unique=True,
            postgresql_where=text("is_default = true"),
        ),
    )

    user = relationship("User", foreign_keys=[user_id])
    branch = relationship("Branch", foreign_keys=[branch_id])


class UserStoreAssignment(BaseEntity):
    __tablename__ = "user_store_assignments"

    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id = Column(String(50), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id = Column(String(50), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)

    __table_args__ = (
        Index("ix_user_store_assignments_user_id", "user_id"),
        Index("ix_user_store_assignments_company_id", "company_id"),
        Index("ix_user_store_assignments_branch_id", "branch_id"),
        Index("ix_user_store_assignments_store_id", "store_id"),
        Index(
            "ix_user_store_assignments_user_id_store_id_active",
            "user_id",
            "store_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    user = relationship("User", foreign_keys=[user_id])
    store = relationship("Store", foreign_keys=[store_id])
