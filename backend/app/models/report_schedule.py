"""
/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.0
 * Created      : 2026-07-16
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
"""

from sqlalchemy import Column, String, ForeignKey
from ..db.base import BaseEntity


class ReportSchedule(BaseEntity):
    """
    Stores report automation schedule metadata per tenant.

    delivery_channel: EMAIL | WHATSAPP | SMS
    delivery_target : email address or phone number matching the channel
    execution_time  : human-readable time string e.g. "08:00"
    cron_expression : derived; consumed by a future execution engine
    frequency       : DAILY | WEEKLY | MONTHLY (UI-friendly label)
    """
    __tablename__ = "report_schedules"

    report_id        = Column(String(50),  nullable=False)
    report_name      = Column(String(200), nullable=False)
    frequency        = Column(String(20),  nullable=False)   # DAILY / WEEKLY / MONTHLY
    execution_time   = Column(String(10),  nullable=True)    # "08:00"
    cron_expression  = Column(String(50),  nullable=True)    # internal; scheduler use
    delivery_channel = Column(String(20),  nullable=False)   # EMAIL / WHATSAPP / SMS
    delivery_target  = Column(String(200), nullable=False)   # email or phone
    delivery_format  = Column(String(10),  nullable=False, default="PDF")  # PDF / Excel / CSV
    created_by_id    = Column(String(100), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
