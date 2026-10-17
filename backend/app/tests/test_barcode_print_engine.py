"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.49
Created      : 2026-10-10
Modified     : 2026-10-10
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import unittest
import asyncio
import uuid
from app.services.barcode_engine import (
    BarcodeCompiler,
    DpiEngine,
    template_registry,
    ProtocolType,
    PrintItemPayload,
    render_zpl,
    render_dpl,
    render_svg,
)
from app.models.barcode import BarcodePrintJob
from app.db.session import async_session, engine
from sqlalchemy.future import select


class TestBarcodePrintEngine(unittest.TestCase):

    def test_dpi_engine_mathematical_precision(self):
        """Verify continuous dots_per_mm = dpi / 25.4 calculation across printer heads."""
        engine_203 = DpiEngine(dpi=203)
        self.assertAlmostEqual(engine_203.dots_per_mm, 203.0 / 25.4, places=5)
        # 100mm label width at 203 DPI is approx 799-800 dots
        self.assertIn(engine_203.mm_to_dots_w(100.0), [799, 800])

        # 300 DPI high resolution
        engine_300 = DpiEngine(dpi=300)
        self.assertEqual(engine_300.mm_to_dots_w(100.0), 1181)
        self.assertEqual(engine_300.mm_to_dots_h(50.7), 599)

    def test_template_registry_builtins(self):
        """Verify registration and resolution of standard industrial templates."""
        footwear_tmpl = template_registry.get("tattly-threads-footwear-100x50.7")
        self.assertIsNotNone(footwear_tmpl)
        self.assertEqual(footwear_tmpl.width_mm, 100.0)
        self.assertEqual(footwear_tmpl.height_mm, 50.7)
        self.assertTrue(len(footwear_tmpl.elements) > 10)

        # Test aliases
        alias_tmpl = template_registry.get("lay-footwear-100x50-3stub")
        self.assertIsNotNone(alias_tmpl)
        self.assertEqual(alias_tmpl.id, "tattly-threads-footwear-100x50.7")

    def test_zpl_compilation_footwear_3stub(self):
        """Verify ZPL compilation contains reverse print boxes and 3-part layout geometry."""
        tmpl = template_registry.get("tattly-threads-footwear-100x50.7")
        items = [
            PrintItemPayload(
                code="000006",
                barcode="890100000006",
                name="Tattly Threads Footwear",
                brand="TATTLY THREADS",
                style="CH-30-K",
                color="BLACK",
                size="37",
                mrp=1199,
                price=1199,
                qty=2
            )
        ]

        result = BarcodeCompiler.compile(
            template_id="tattly-threads-footwear-100x50.7",
            items=items,
            protocol=ProtocolType.ZPL,
            dpi=203
        )

        self.assertEqual(result.total_items, 1)
        self.assertEqual(result.total_labels, 2)
        self.assertIn("^XA", result.payload_stream)
        self.assertIn("^XZ", result.payload_stream)
        self.assertIn("^FR", result.payload_stream)  # Reverse black box text
        self.assertIn("^GB", result.payload_stream)  # Graphic box
        self.assertIn("890100000006", result.payload_stream)
        self.assertIn("CH-30-K", result.payload_stream)
        self.assertIn("BLACK", result.payload_stream)
        self.assertEqual(len(result.payload_hash), 64)

    def test_dpl_compilation(self):
        """Verify DPL compilation produces standard Datamax/Honeywell start/end codes."""
        tmpl = template_registry.get("retail-50x25")
        items = [
            PrintItemPayload(
                code="SKU-001",
                barcode="890123456789",
                name="Classic Shirt",
                brand="SMRITI",
                mrp=999,
                qty=1
            )
        ]

        result = BarcodeCompiler.compile(
            template_id="retail-50x25",
            items=items,
            protocol=ProtocolType.DPL,
            dpi=203
        )

        self.assertIn("\x02L", result.payload_stream)
        self.assertIn("D11", result.payload_stream)
        self.assertIn("890123456789", result.payload_stream)

    def test_svg_preview_generation(self):
        """Verify SVG renderer returns valid XML with proper viewBox dimensions."""
        tmpl = template_registry.get("tattly-threads-footwear-100x50.7")
        svg_str = render_svg(tmpl)
        self.assertIn("<svg", svg_str)
        self.assertIn("</svg>", svg_str)
        self.assertIn('width="100.0mm"', svg_str)
        self.assertIn('height="50.7mm"', svg_str)
        self.assertIn("TATTLY THREADS", svg_str)

    def test_barcode_print_job_db_persistence(self):
        """Verify async persistence, status updating, and retrieval of BarcodePrintJob entity."""
        async def run_db_test():
            async with async_session() as session:
                job_id = f"job-test-{uuid.uuid4().hex[:8]}"
                test_job = BarcodePrintJob(
                    id=job_id,
                    requested_by="admin",
                    printer_id="IMPACT by Honeywell IH-2",
                    template_id="tattly-threads-footwear-100x50.7",
                    target_dpi=203,
                    target_protocol="ZPL",
                    total_labels=3,
                    total_items=1,
                    status="READY",
                    payload_stream="^XA^PW804^XZ",
                    payload_hash="testhash123"
                )
                session.add(test_job)
                await session.commit()

                # Query back
                stmt = select(BarcodePrintJob).where(BarcodePrintJob.id == job_id)
                res = await session.execute(stmt)
                loaded = res.scalars().first()
                self.assertIsNotNone(loaded)
                self.assertEqual(loaded.status, "READY")
                self.assertEqual(loaded.printer_id, "IMPACT by Honeywell IH-2")

                # Update status
                loaded.status = "COMPLETED"
                await session.commit()

                # Verify update
                res2 = await session.execute(stmt)
                updated = res2.scalars().first()
                self.assertEqual(updated.status, "COMPLETED")

                # Cleanup test row
                await session.delete(updated)
                await session.commit()
            await engine.dispose()

        asyncio.run(run_db_test())

    def test_barcode_print_job_ack_status_transition(self):
        """Verify print job acknowledgment handles success/failure status transitions."""
        async def run_ack_test():
            async with async_session() as session:
                job_id = f"job-ack-{uuid.uuid4().hex[:8]}"
                test_job = BarcodePrintJob(
                    id=job_id,
                    requested_by="admin",
                    printer_id="Honeywell IH-2",
                    template_id="tattly-threads-footwear-100x50.7",
                    target_dpi=300,
                    target_protocol="DPL",
                    total_labels=1,
                    total_items=1,
                    status="READY",
                    payload_stream="121100000200050TEST",
                    payload_hash="acktest123"
                )
                session.add(test_job)
                await session.commit()

                # Simulate successful ACK
                stmt = select(BarcodePrintJob).where(BarcodePrintJob.id == job_id)
                res = await session.execute(stmt)
                job = res.scalars().first()
                job.status = "COMPLETED"
                job.printer_id = "QZ Tray - IMPACT by Honeywell IH-2"
                await session.commit()

                res_check = await session.execute(stmt)
                checked = res_check.scalars().first()
                self.assertEqual(checked.status, "COMPLETED")
                self.assertIn("QZ Tray", checked.printer_id)

                # Cleanup
                await session.delete(checked)
                await session.commit()
            await engine.dispose()

        asyncio.run(run_ack_test())


if __name__ == "__main__":
    unittest.main()
