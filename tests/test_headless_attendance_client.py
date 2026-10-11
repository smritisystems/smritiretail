"""
Project       : SMRITI Retail OS
Author        : Jawahar Ramkripal Mallah
Designation   : Chief Systems Architect & Creator
Email         : support@smritibooks.com
Websites      : smritibooks.com | erpnbook.com | aitdl.com
Version       : 6.70.52
Created       : 2026-10-12
Modified      : 2026-10-12
Copyright     : (c) SMRITIBooks.com. All Rights Reserved.
License       : Proprietary Commercial Software
Classification: Internal
"""

import unittest
from datetime import date, datetime, timezone
from scripts.headless_attendance_client import (
    login,
    list_staff,
    push_biometric_punches,
    punch_single_staff,
    bulk_mark_attendance,
    query_attendance_ledger,
    query_attendance_summary,
)

BASE_URL = "http://localhost:1981"
USERNAME = "admin"
PASSWORD = "Admin@123"
COMPANY_ID = "COMP-001"
TEST_EMP_CODE = "EMP-1002"
TEST_USER_ID = "usr-local-988d913cebc3"


class TestHeadlessAttendanceClient(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.token = login(BASE_URL, USERNAME, PASSWORD)
        assert cls.token, "Failed to authenticate and retrieve access token"

    def test_01_authentication(self):
        """Verify authentication endpoint and JWT token structure."""
        self.assertIsInstance(self.token, str)
        self.assertTrue(len(self.token) > 20)

    def test_02_list_staff_directory(self):
        """Verify querying active staff roster via headless client."""
        staff = list_staff(BASE_URL, self.token, company_id=COMPANY_ID)
        self.assertIsInstance(staff, list)
        self.assertGreater(len(staff), 0)
        user_ids = [s.get("id") for s in staff]
        self.assertIn("usr-cashier", user_ids)

    def test_03_biometric_device_push_check_in(self):
        """Verify IoT biometric punch ingestion for CHECK_IN state."""
        now_iso = datetime.now(timezone.utc).isoformat()
        punch_payload = [
            {
                "employee_code": TEST_EMP_CODE,
                "timestamp": now_iso,
                "punch_state": "CHECK_IN",
                "verify_type": "FINGERPRINT",
            }
        ]
        res = push_biometric_punches(
            base_url=BASE_URL,
            token=self.token,
            device_id="BIO-TERMINAL-FRONT-01",
            device_key="smriti-iot-key-secret-2026",
            punches=punch_payload,
            company_id=COMPANY_ID,
        )
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("processed"), 1)
        self.assertEqual(res.get("errors"), [])

    def test_04_biometric_device_push_check_out(self):
        """Verify IoT biometric punch ingestion for CHECK_OUT state."""
        now_iso = datetime.now(timezone.utc).isoformat()
        punch_payload = [
            {
                "employee_code": TEST_EMP_CODE,
                "timestamp": now_iso,
                "punch_state": "CHECK_OUT",
                "verify_type": "FINGERPRINT",
            }
        ]
        res = push_biometric_punches(
            base_url=BASE_URL,
            token=self.token,
            device_id="BIO-TERMINAL-FRONT-01",
            device_key="smriti-iot-key-secret-2026",
            punches=punch_payload,
            company_id=COMPANY_ID,
        )
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("processed"), 1)

    def test_05_single_staff_punch(self):
        """Verify real-time single punch recording."""
        res = punch_single_staff(
            base_url=BASE_URL,
            token=self.token,
            user_id="usr-cashier",
            punch_type="AUTO",
            device_source="UNITTEST-HEADLESS-01",
            company_id=COMPANY_ID,
        )
        self.assertTrue(res.get("success"))
        self.assertIn(res.get("action"), ["CHECKED_IN", "CHECKED_OUT"])
        self.assertIn("record", res)
        self.assertEqual(res["record"]["user_id"], "usr-cashier")

    def test_06_bulk_mark_attendance(self):
        """Verify bulk attendance marking across staff roster."""
        today_str = date.today().isoformat()
        records = [
            {
                "user_id": "usr-manager",
                "attendance_date": today_str,
                "status": "PRESENT",
                "register_source": "UNITTEST_BULK",
                "device_source": "TEST_RUNNER",
                "correction_reason": "Automated headless bulk attendance test",
            }
        ]
        res = bulk_mark_attendance(
            base_url=BASE_URL,
            token=self.token,
            records=records,
            company_id=COMPANY_ID,
        )
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("errors"), 0)

    def test_07_query_attendance_ledger(self):
        """Verify attendance ledger query returns expected typed contract."""
        res = query_attendance_ledger(
            base_url=BASE_URL,
            token=self.token,
            company_id=COMPANY_ID,
        )
        self.assertIn("records", res)
        self.assertIn("total", res)
        self.assertGreater(res["total"], 0)
        rec = res["records"][0]
        self.assertIn("id", rec)
        self.assertIn("user_id", rec)
        self.assertIn("status", rec)
        self.assertIn("attendance_date", rec)

    def test_08_query_attendance_summary(self):
        """Verify period attendance KPI summary aggregation."""
        res = query_attendance_summary(
            base_url=BASE_URL,
            token=self.token,
            company_id=COMPANY_ID,
        )
        self.assertTrue(res.get("success"))
        self.assertIn("total_days", res)
        self.assertIn("present_days", res)
        self.assertIn("late_days", res)
        self.assertIn("half_days", res)
        self.assertGreaterEqual(res["total_days"], 1)


if __name__ == "__main__":
    unittest.main()
