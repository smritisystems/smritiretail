"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 27.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Learning Management System (LMS) & Certification Engine
"""

from typing import Dict, Any, List


class AcademyLMSEngine:
    """Learning Academy LMS Course & Certification Services."""

    _COURSES = [
        {
            "course_code": "SMRITI-101",
            "title": "SMRITI Retail OS Fundamentals & POS Checkout",
            "category": "ONBOARDING",
            "duration_minutes": 45,
            "level": "BEGINNER",
            "modules_count": 6,
            "certification_name": "Certified SMRITI Retail Associate"
        },
        {
            "course_code": "SMRITI-201",
            "title": "Enterprise WMS, FEFO & Multi-Bin Inventory Management",
            "category": "LOGISTICS",
            "duration_minutes": 60,
            "level": "INTERMEDIATE",
            "modules_count": 8,
            "certification_name": "Certified SMRITI WMS Specialist"
        },
        {
            "course_code": "SMRITI-301",
            "title": "NIC E-Invoicing, E-Way Bill & Double-Entry Financials",
            "category": "COMPLIANCE",
            "duration_minutes": 90,
            "level": "ADVANCED",
            "modules_count": 10,
            "certification_name": "Certified SMRITI Compliance Controller"
        }
    ]

    @classmethod
    def get_courses(cls) -> List[Dict[str, Any]]:
        return cls._COURSES

    @classmethod
    def enroll_course(cls, course_code: str, user_id: str = "USER-001") -> Dict[str, Any]:
        course = next((c for c in cls._COURSES if c["course_code"] == course_code), None)
        if not course:
            return {"error": "Course not found"}

        return {
            "user_id": user_id,
            "course_code": course_code,
            "title": course["title"],
            "status": "ENROLLED",
            "completion_percentage": 0.0,
            "certification_eligible": course["certification_name"] is not None
        }
