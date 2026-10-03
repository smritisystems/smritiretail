"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-09-29
Modified     : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Staff Photo & SPIF Upload Unit Tests
"""

import os
from app.api.v1.staff import StaffPhotoPayload, router
from app.services.spif import SpifService


# Valid 1x1 red PNG in base64
TINY_PNG_BASE64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
    "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def test_staff_photo_payload_validation():
    payload = StaffPhotoPayload(photo_data=TINY_PNG_BASE64)
    assert payload.photo_data == TINY_PNG_BASE64


def test_spif_process_and_cleanup_staff_image():
    # 1. Process base64 into optimized WebP
    filename = SpifService.process_and_save_base64_image(TINY_PNG_BASE64)
    assert filename.startswith("spif-")
    assert filename.endswith(".webp")

    # 2. Verify file was created on disk
    filepath = SpifService.get_image_path(filename)
    assert os.path.exists(filepath)
    assert os.path.getsize(filepath) > 0

    # 3. Clean up
    deleted = SpifService.delete_image_file(filename)
    assert deleted is True
    assert not os.path.exists(filepath)


def test_staff_photo_router_endpoints_registered():
    routes = {}
    for r in router.routes:
        routes.setdefault(r.path, set()).update(r.methods)
    assert "/staff/directory/{user_id}/photo" in routes
    methods = routes["/staff/directory/{user_id}/photo"]
    assert "POST" in methods
    assert "DELETE" in methods
    assert "/staff/photos/{filename}" in routes
