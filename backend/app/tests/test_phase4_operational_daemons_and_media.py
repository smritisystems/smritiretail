"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.42
Created      : 2026-10-09
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Unit & Integration Verification Suite (Phase 4)
"""

import io
import os
import base64
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from PIL import Image

from app.services.outbox_worker import OutboxQueueWorker
from app.services.spif import SpifService
from app.services.system_parameter import SystemParameterService
from app.models.system_parameter import SystemParameter


@pytest.fixture
def sample_base64_png():
    """Generates a small in-memory red square PNG as base64."""
    img = Image.new("RGBA", (200, 200), (255, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{raw_b64}"


# ============================================================================
# CLUSTER A: Outbox Queue Worker Operational Parameters (FND-024 to FND-027)
# ============================================================================

@pytest.mark.asyncio
async def test_outbox_worker_defaults_without_session():
    """Verify class invariants are returned when no database session is passed."""
    params = await OutboxQueueWorker.resolve_operational_parameters(session=None)
    assert params["batch_size"] == OutboxQueueWorker.DEFAULT_BATCH_SIZE
    assert params["max_retries"] == OutboxQueueWorker.MAX_RETRIES
    assert params["backoff_seconds"] == OutboxQueueWorker.DEFAULT_BACKOFF_SECONDS
    assert params["claim_timeout_seconds"] == OutboxQueueWorker.DEFAULT_CLAIM_TIMEOUT_SECONDS
    assert params["poll_interval_seconds"] == OutboxQueueWorker.DEFAULT_POLL_INTERVAL_SECONDS


@pytest.mark.asyncio
async def test_outbox_worker_resolves_system_parameters():
    """Verify parameters are dynamically resolved from SystemParameterService."""
    mock_session = AsyncMock()

    def mock_param(val):
        p = MagicMock(spec=SystemParameter)
        p.effective_value = val
        return p

    async def mock_resolve(db, code, company_id=None, terminal_id="COMMON", branch_id=None):
        lookup = {
            "SMRITI.OUTBOX.BATCH_SIZE": mock_param("150"),
            "SMRITI.OUTBOX.MAX_RETRIES": mock_param("8"),
            "SMRITI.OUTBOX.BACKOFF_SECONDS": mock_param("5"),
            "SMRITI.OUTBOX.CLAIM_TIMEOUT_SECONDS": mock_param("90"),
            "SMRITI.OUTBOX.POLL_INTERVAL_SECONDS": mock_param("2.5"),
        }
        return lookup.get(code)

    with patch.object(SystemParameterService, "resolve_parameter", side_effect=mock_resolve):
        params = await OutboxQueueWorker.resolve_operational_parameters(
            session=mock_session, company_id="COMP-001"
        )
        assert params["batch_size"] == 150
        assert params["max_retries"] == 8
        assert params["backoff_seconds"] == 5
        assert params["claim_timeout_seconds"] == 90
        assert params["poll_interval_seconds"] == 2.5


@pytest.mark.asyncio
async def test_outbox_worker_fallback_on_exception():
    """Verify outbox parameter resolution safely catches exceptions and falls back to defaults."""
    mock_session = AsyncMock()

    with patch.object(SystemParameterService, "resolve_parameter", side_effect=RuntimeError("DB disconnected")):
        params = await OutboxQueueWorker.resolve_operational_parameters(
            session=mock_session, company_id="COMP-001"
        )
        assert params["batch_size"] == OutboxQueueWorker.DEFAULT_BATCH_SIZE
        assert params["max_retries"] == OutboxQueueWorker.MAX_RETRIES
        assert params["backoff_seconds"] == OutboxQueueWorker.DEFAULT_BACKOFF_SECONDS
        assert params["claim_timeout_seconds"] == OutboxQueueWorker.DEFAULT_CLAIM_TIMEOUT_SECONDS


@pytest.mark.asyncio
async def test_process_company_outbox_batch_uses_resolved_parameters():
    """Verify process_company_outbox_batch feeds resolved parameters to dispatch engine."""
    mock_session = AsyncMock()
    mock_dispatcher = MagicMock()

    resolved_params = {
        "batch_size": 75,
        "max_retries": 4,
        "backoff_seconds": 3,
        "claim_timeout_seconds": 45,
        "poll_interval_seconds": 5.0,
    }

    with patch.object(OutboxQueueWorker, "resolve_operational_parameters", return_value=resolved_params), \
         patch("app.services.outbox_worker.UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events", new_callable=AsyncMock) as mock_dispatch:
        
        mock_dispatch.return_value = {"dispatched_count": 5, "failed_count": 0}

        res = await OutboxQueueWorker.process_company_outbox_batch(
            session=mock_session,
            dispatcher_callback=mock_dispatcher,
            company_id="COMP-001"
        )

        assert res["dispatched_count"] == 5
        mock_dispatch.assert_awaited_once_with(
            session=mock_session,
            limit=75,
            dispatcher_callback=mock_dispatcher,
            max_retries=4,
            target_channel=None,
            event_type=None,
            base_backoff_seconds=3,
            claim_timeout_seconds=45,
        )


@pytest.mark.asyncio
async def test_process_company_outbox_batch_respects_explicit_overrides():
    """Verify caller-provided overrides take precedence over resolved system parameters."""
    mock_session = AsyncMock()
    mock_dispatcher = MagicMock()

    with patch("app.services.outbox_worker.UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events", new_callable=AsyncMock) as mock_dispatch:
        mock_dispatch.return_value = {"dispatched_count": 2, "failed_count": 0}

        await OutboxQueueWorker.process_company_outbox_batch(
            session=mock_session,
            dispatcher_callback=mock_dispatcher,
            limit=25,
            max_retries=2,
            base_backoff_seconds=1,
            claim_timeout_seconds=15,
        )

        mock_dispatch.assert_awaited_once_with(
            session=mock_session,
            limit=25,
            dispatcher_callback=mock_dispatcher,
            max_retries=2,
            target_channel=None,
            event_type=None,
            base_backoff_seconds=1,
            claim_timeout_seconds=15,
        )


# ============================================================================
# CLUSTER B: SPIF Media Processing Operational Parameters (FND-017, FND-P1-06)
# ============================================================================

def test_spif_service_custom_dimension_and_quality(sample_base64_png):
    """Verify SpifService applies custom dimension boundaries and quality compression."""
    filename = SpifService.process_and_save_base64_image(
        base64_data=sample_base64_png,
        max_dimension=150,
        quality=70,
    )
    assert filename.startswith("spif-")
    assert filename.endswith(".webp")

    # Verify physical file existence and dimension
    filepath = SpifService.get_image_path(filename)
    assert os.path.exists(filepath)

    try:
        with Image.open(filepath) as saved_img:
            assert saved_img.format == "WEBP"
            assert max(saved_img.width, saved_img.height) <= 150
    finally:
        SpifService.delete_image_file(filename)
        assert not os.path.exists(filepath)
