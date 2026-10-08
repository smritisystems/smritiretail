"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.42
Created      : 2026-07-13
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import base64
import os
import uuid
from io import BytesIO
from typing import Optional
from PIL import Image, ImageOps

# Prefer persistent workspace static/uploads if running in container with /workspace mounted, otherwise local static/uploads
if os.path.exists("/workspace/static/uploads"):
    UPLOAD_DIR = "/workspace/static/uploads"
elif os.path.exists(os.path.join(os.getcwd(), "static", "uploads")):
    UPLOAD_DIR = os.path.join(os.getcwd(), "static", "uploads")
else:
    UPLOAD_DIR = os.path.join(os.getcwd(), "static", "uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)

class SpifService:
    DEFAULT_MAX_DIMENSION: int = 1024
    DEFAULT_QUALITY: int = 80

    @classmethod
    def process_and_save_base64_image(
        cls,
        base64_data: str,
        max_dimension: Optional[int] = None,
        quality: Optional[int] = None,
    ) -> str:
        """
        Decodes a base64 encoded image string, optimizes it, auto-orients,
        converts to WEBP, and saves to static uploads directory.
        Dimension bounds (FND-017) and compression quality (FND-P1-06) are dynamically configurable.
        Returns the saved filename.
        """
        dim = max_dimension if (max_dimension is not None and max_dimension > 0) else cls.DEFAULT_MAX_DIMENSION
        q = quality if (quality is not None and 1 <= quality <= 100) else cls.DEFAULT_QUALITY

        # Strip header if present (e.g. data:image/png;base64,...)
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]

        # Decode bytes
        image_bytes = base64.b64decode(base64_data)
        
        # Load into Pillow
        img = Image.open(BytesIO(image_bytes))
        
        # Standardize orientation based on EXIF tag
        img = ImageOps.exif_transpose(img)
        
        # Convert to RGB mode (in case of PNG alpha channels to avoid transparency errors in conversion)
        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")
            
        # Resize to max boundaries
        max_size = (dim, dim)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Generate unique webp filename
        filename = f"spif-{uuid.uuid4().hex}.webp"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # Save as optimized webp
        img.save(filepath, "WEBP", quality=q, optimize=True)
        
        return filename

    @staticmethod
    def get_image_path(filename: str) -> str:
        """Returns the absolute file path for a given image filename."""
        primary_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(primary_path):
            return primary_path
        # Check potential alternative locations (e.g. host vs container path mappings)
        candidates = [
            os.path.join("/workspace", "static", "uploads", filename),
            os.path.join("/app", "static", "uploads", filename),
            os.path.join(os.getcwd(), "backend", "static", "uploads", filename),
            os.path.join(os.getcwd(), "static", "uploads", filename),
        ]
        for c in candidates:
            if os.path.exists(c):
                return c
        return primary_path

    @staticmethod
    def delete_image_file(filename: str) -> bool:
        """Deletes the image file from local static storage."""
        if not filename:
            return False
        filepath = SpifService.get_image_path(filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                return True
            except OSError:
                return False
        return False
