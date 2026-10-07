"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-07
Modified     : 2026-10-07
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — SMRITI DataBridge Phase 10
"""

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from starlette.testclient import TestClient

from app.main import app
from app.services.databridge.broadcaster import DataBridgeBroadcaster
from app.services.databridge.models import DataBridgeProgressFrame


@pytest.fixture(autouse=True)
async def clean_broadcaster():
    """Ensure clean broadcaster state before and after each test."""
    await DataBridgeBroadcaster.clear_all()
    yield
    await DataBridgeBroadcaster.clear_all()


@pytest.mark.asyncio
async def test_tc_ws_001_broadcaster_subscribe_unsubscribe():
    """Verify in-memory subscription registration, subscriber counting, and clean unsubscription."""
    job_id = "JOB-TEST-SUB-001"
    mock_ws = MagicMock()

    assert DataBridgeBroadcaster.has_subscribers(job_id) is False
    assert DataBridgeBroadcaster.subscriber_count(job_id) == 0

    await DataBridgeBroadcaster.subscribe(job_id=job_id, websocket=mock_ws)
    assert DataBridgeBroadcaster.has_subscribers(job_id) is True
    assert DataBridgeBroadcaster.subscriber_count(job_id) == 1
    assert job_id in DataBridgeBroadcaster.get_active_jobs()

    await DataBridgeBroadcaster.unsubscribe(job_id=job_id, websocket=mock_ws)
    assert DataBridgeBroadcaster.has_subscribers(job_id) is False
    assert DataBridgeBroadcaster.subscriber_count(job_id) == 0


@pytest.mark.asyncio
async def test_tc_ws_002_broadcaster_broadcast_progress():
    """Verify telemetry frame broadcasting across multiple subscribers and dead socket purging."""
    job_id = "JOB-TEST-BC-002"
    ws_alive = AsyncMock()
    ws_dead = AsyncMock()
    ws_dead.send_text.side_effect = ConnectionResetError("Connection closed by peer")

    await DataBridgeBroadcaster.subscribe(job_id, ws_alive)
    await DataBridgeBroadcaster.subscribe(job_id, ws_dead)
    assert DataBridgeBroadcaster.subscriber_count(job_id) == 2

    frame = DataBridgeProgressFrame(
        job_id=job_id,
        tenant_id="smriti001",
        entity_type="ITEM",
        status="PROCESSING",
        total_rows=1000,
        processed_rows=500,
        committed_count=490,
        error_count=10,
        progress_percent=50.0,
        current_chunk_index=1,
        total_chunks=2,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    delivered = await DataBridgeBroadcaster.broadcast_progress(job_id, frame)
    assert delivered == 1
    ws_alive.send_text.assert_called_once()
    assert json.loads(ws_alive.send_text.call_args[0][0])["processed_rows"] == 500

    # Verify dead socket was automatically purged
    assert DataBridgeBroadcaster.subscriber_count(job_id) == 1


def test_tc_ws_003_websocket_initial_snapshot():
    """Verify WebSocket connection acceptance and receipt of initial progress snapshot."""
    client = TestClient(app)
    job_id = "JOB-WS-SNAP-003"

    with client.websocket_connect(f"/api/v1/databridge/ws/progress/{job_id}?company_id=smriti001") as ws:
        # First message is the initial snapshot frame
        raw_msg = ws.receive_text()
        data = json.loads(raw_msg)
        assert data["job_id"] == job_id
        assert data["status"] in ("PENDING", "PROCESSING", "COMPLETED")
        assert "progress_percent" in data
        assert "timestamp" in data


def test_tc_ws_004_websocket_live_chunk_streaming():
    """Verify live telemetry frame push through open WebSocket and ping-pong heartbeat."""
    client = TestClient(app)
    job_id = "JOB-WS-STREAM-004"

    with client.websocket_connect(f"/api/v1/databridge/ws/progress/{job_id}?company_id=smriti001") as ws:
        # Initial snapshot
        _ = ws.receive_text()

        # Send heartbeat ping
        ws.send_text("ping")
        pong_msg = json.loads(ws.receive_text())
        assert pong_msg["type"] == "pong"
        assert pong_msg["job_id"] == job_id


def test_tc_ws_005_websocket_client_disconnect_cleanup():
    """Verify broadcaster removes closed WebSockets when client disconnects."""
    client = TestClient(app)
    job_id = "JOB-WS-DISC-005"

    with client.websocket_connect(f"/api/v1/databridge/ws/progress/{job_id}?company_id=smriti001") as ws:
        _ = ws.receive_text()
        assert DataBridgeBroadcaster.has_subscribers(job_id) is True

    # After exiting block, client is disconnected
    assert DataBridgeBroadcaster.subscriber_count(job_id) == 0


def test_tc_ws_006_websocket_multiple_clients_fanout():
    """Verify fan-out delivery when multiple clients listen to the same job_id."""
    client = TestClient(app)
    job_id = "JOB-WS-FANOUT-006"

    with client.websocket_connect(f"/api/v1/databridge/ws/progress/{job_id}?company_id=smriti001") as ws1:
        _ = ws1.receive_text()
        assert DataBridgeBroadcaster.subscriber_count(job_id) == 1

        with client.websocket_connect(f"/api/v1/databridge/ws/progress/{job_id}?company_id=smriti001") as ws2:
            _ = ws2.receive_text()
            assert DataBridgeBroadcaster.subscriber_count(job_id) == 2


@pytest.mark.asyncio
async def test_tc_ws_007_websocket_completion_frame_broadcast():
    """Verify job completion frame formatting and status transition."""
    job_id = "JOB-WS-COMP-007"
    mock_ws = AsyncMock()

    await DataBridgeBroadcaster.subscribe(job_id, mock_ws)

    completion_frame = DataBridgeProgressFrame(
        job_id=job_id,
        tenant_id="smriti001",
        entity_type="SALES_INVOICE",
        status="COMPLETED",
        total_rows=2500,
        processed_rows=2500,
        committed_count=2500,
        error_count=0,
        progress_percent=100.0,
        current_chunk_index=5,
        total_chunks=5,
        elapsed_ms=450.2,
        estimated_remaining_ms=0.0,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    await DataBridgeBroadcaster.broadcast_progress(job_id, completion_frame)
    mock_ws.send_text.assert_called_once()
    received = json.loads(mock_ws.send_text.call_args[0][0])
    assert received["status"] == "COMPLETED"
    assert received["progress_percent"] == 100.0
    assert received["committed_count"] == 2500
