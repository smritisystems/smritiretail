"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.3
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import re

# Centralized list of valid Indian State and Union Territory codes
VALID_STATE_CODES = {
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
    "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
    "31", "32", "33", "34", "35", "36", "37", "38", "97", "99"
}

GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
CHAR_TO_VAL = {char: val for val, char in enumerate(GSTIN_CHARS)}
VAL_TO_CHAR = {val: char for val, char in enumerate(GSTIN_CHARS)}

def calculate_gstin_checksum(gstin_14: str) -> str:
    """
    Computes the GSTIN 15th checksum character using Luhn mod 36 algorithm.
    """
    total = 0
    for i, char in enumerate(gstin_14):
        val = CHAR_TO_VAL[char]
        # Multiplier alternates: index 0 is 2, index 1 is 1, etc.
        factor = 2 if i % 2 == 0 else 1
        product = val * factor
        total += (product // 36) + (product % 36)
    
    remainder = total % 36
    check_val = (36 - remainder) % 36
    return VAL_TO_CHAR[check_val]

def validate_gstin_format(gstin: str) -> str:
    """
    Validates the structure and checksum of an Indian GSTIN.
    Raises ValueError if invalid. Returns clean upper-case GSTIN.
    """
    if not gstin:
        return ""
    gst = gstin.strip().upper()
    if len(gst) != 15:
        raise ValueError("GSTIN must be exactly 15 characters long.")
    
    # 1. State code validation
    state_code = gst[:2]
    if state_code not in VALID_STATE_CODES:
        raise ValueError("GSTIN state code is invalid.")
        
    # 2. Embedded PAN pattern check
    pan_part = gst[2:12]
    if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", pan_part):
        raise ValueError("GSTIN contains an invalid embedded PAN pattern.")
        
    # 3. Entity code check
    entity_code = gst[12]
    if not re.match(r"^[1-9A-Z]{1}$", entity_code):
        raise ValueError("GSTIN entity code is invalid.")
        
    # 4. Default character check
    default_char = gst[13]
    if default_char != "Z":
        raise ValueError("GSTIN default character must be 'Z'.")
        
    # 5. Checksum check (Luhn mod 36)
    calculated_checksum = calculate_gstin_checksum(gst[:14])
    provided_checksum = gst[14]
    if provided_checksum != calculated_checksum:
        raise ValueError(f"GSTIN checksum is invalid. Expected '{calculated_checksum}', got '{provided_checksum}'.")
        
    return gst
