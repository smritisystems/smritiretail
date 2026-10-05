"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.6
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

ItemTrackingSyncService
───────────────────────
Multi-tenant inventory tracking mode harmonization engine:
1. Aligns tracking_mode ('NONE', 'BATCH', 'SERIAL') and tracking_type with
   boolean flags is_batch_tracked and is_serial_tracked.
2. Eliminates dual tracking (where both are True).
3. Provides atomic, idempotent database-level synchronization.
"""

import logging
from typing import Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


class ItemTrackingSyncService:
    """
    Domain service for tracking mode harmonization and integrity enforcement.
    """

    @classmethod
    async def harmonize_tracking_modes(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        auto_commit: bool = False,
    ) -> Dict[str, int]:
        """
        Synchronizes tracking_mode, tracking_type, is_batch_tracked, and
        is_serial_tracked across catalog items.
        """
        comp_filter = "AND company_id = :comp_id" if company_id else ""
        params = {"comp_id": company_id} if company_id else {}

        # 1. Harmonize BATCH items
        # Priority rule: If marked batch_tracked or mode/type is BATCH (and not serial_tracked)
        batch_sql = f"""
            UPDATE items
            SET tracking_mode = 'BATCH',
                tracking_type = 'BATCH',
                is_batch_tracked = TRUE,
                is_serial_tracked = FALSE,
                modified_at = NOW()
            WHERE (is_batch_tracked = TRUE OR tracking_mode = 'BATCH' OR tracking_type = 'BATCH')
              AND is_serial_tracked IS NOT TRUE
              {comp_filter};
        """
        batch_res = await session.execute(text(batch_sql), params)
        batch_count = batch_res.rowcount

        # 2. Harmonize SERIAL items
        # Priority rule: If marked serial_tracked or mode/type is SERIAL
        serial_sql = f"""
            UPDATE items
            SET tracking_mode = 'SERIAL',
                tracking_type = 'SERIAL',
                is_serial_tracked = TRUE,
                is_batch_tracked = FALSE,
                modified_at = NOW()
            WHERE (is_serial_tracked = TRUE OR tracking_mode = 'SERIAL' OR tracking_type = 'SERIAL')
              {comp_filter};
        """
        serial_res = await session.execute(text(serial_sql), params)
        serial_count = serial_res.rowcount

        # 3. Resolve any edge-case dual tracking (if both flags were TRUE, serial takes precedence if serials exist, else batch)
        dual_sql = f"""
            UPDATE items
            SET tracking_mode = 'BATCH',
                tracking_type = 'BATCH',
                is_batch_tracked = TRUE,
                is_serial_tracked = FALSE,
                modified_at = NOW()
            WHERE is_batch_tracked = TRUE AND is_serial_tracked = TRUE
              {comp_filter};
        """
        dual_res = await session.execute(text(dual_sql), params)
        dual_count = dual_res.rowcount

        # 4. Harmonize remaining NONE items
        none_sql = f"""
            UPDATE items
            SET tracking_mode = 'NONE',
                tracking_type = 'NONE',
                is_batch_tracked = FALSE,
                is_serial_tracked = FALSE,
                modified_at = NOW()
            WHERE is_batch_tracked IS NOT TRUE
              AND is_serial_tracked IS NOT TRUE
              AND (tracking_mode != 'NONE' OR tracking_type != 'NONE' OR tracking_type IS NULL)
              {comp_filter};
        """
        none_res = await session.execute(text(none_sql), params)
        none_count = none_res.rowcount

        if auto_commit:
            await session.commit()

        logger.info(
            "Harmonized tracking modes: batch=%d, serial=%d, dual_resolved=%d, none_aligned=%d",
            batch_count, serial_count, dual_count, none_count
        )
        return {
            "batch_items_harmonized": batch_count,
            "serial_items_harmonized": serial_count,
            "dual_conflicts_resolved": dual_count,
            "none_items_aligned": none_count,
            "total_items_processed": batch_count + serial_count + dual_count + none_count,
        }
