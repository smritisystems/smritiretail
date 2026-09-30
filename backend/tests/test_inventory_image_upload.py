"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.50.0
Created      : 2026-09-30
Modified     : 2026-09-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Inventory Image Upload & SPIF WebP Service Unit Tests
"""

import os
from app.api.v1.inventory import router
from app.services.spif import SpifService

# Valid 1x1 red PNG in base64
TINY_PNG_BASE64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
    "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def test_inventory_image_upload_router_registered():
    """Verify upload-image and images endpoints are registered in inventory router."""
    routes = {}
    for r in router.routes:
        routes.setdefault(r.path, set()).update(r.methods)

    assert "/upload-image" in routes
    assert "POST" in routes["/upload-image"]
    assert "/images/{filename}" in routes
    assert "GET" in routes["/images/{filename}"]


def test_spif_inventory_image_process_and_save():
    """Verify SpifService converts base64 image into optimized WebP and resolves paths."""
    filename = SpifService.process_and_save_base64_image(TINY_PNG_BASE64)
    assert filename.startswith("spif-")
    assert filename.endswith(".webp")

    filepath = SpifService.get_image_path(filename)
    assert os.path.exists(filepath)
    assert os.path.getsize(filepath) > 0

    # Clean up
    deleted = SpifService.delete_image_file(filename)
    assert deleted is True
    assert not os.path.exists(filepath)


if __name__ == "__main__":
    test_inventory_image_upload_router_registered()
    print("PASS: test_inventory_image_upload_router_registered")
    test_spif_inventory_image_process_and_save()
    print("PASS: test_spif_inventory_image_process_and_save")
    print("ALL TESTS PASSED GREEN!")

