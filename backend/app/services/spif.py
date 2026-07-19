"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-07-13
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import base64
import os
import uuid
from io import BytesIO
from PIL import Image, ImageOps

UPLOAD_DIR = os.path.join(os.getcwd(), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class SpifService:
    @staticmethod
    def process_and_save_base64_image(base64_data: str) -> str:
        """
        Decodes a base64 encoded image string, optimizes it, auto-orients,
        converts to WEBP, and saves to static uploads directory.
        Returns the saved filename.
        """
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
            
        # Resize to max boundaries (e.g. 1024x1024 max for Catalog)
        max_size = (1024, 1024)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Generate unique webp filename
        filename = f"spif-{uuid.uuid4().hex}.webp"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # Save as optimized webp
        img.save(filepath, "WEBP", quality=80, optimize=True)
        
        return filename

    @staticmethod
    def get_image_path(filename: str) -> str:
        """Returns the absolute file path for a given image filename."""
        return os.path.join(UPLOAD_DIR, filename)

    @staticmethod
    def delete_image_file(filename: str) -> bool:
        """Deletes the image file from local static storage."""
        if not filename:
            return False
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                return True
            except OSError:
                return False
        return False
