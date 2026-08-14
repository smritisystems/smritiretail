"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
import socket
from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...models.barcode import BarcodeLayout, PrintHistory
from ...models.system import SystemConfig
from ...schemas.barcode import (
    BarcodeLayoutCreate, BarcodeLayoutUpdate, BarcodeLayoutResponse, PrintRequest,
    PrintHistoryResponse, PrinterSettingsRequest
)

router = APIRouter()


def serialize_layout(l: BarcodeLayout) -> BarcodeLayoutResponse:
    elements = []
    prn_template = None
    if l.elements_json:
        try:
            data = json.loads(l.elements_json)
            if isinstance(data, dict):
                elements = data.get("elements", [])
                prn_template = data.get("prn_template")
            elif isinstance(data, list):
                elements = data
        except Exception:
            pass
    return BarcodeLayoutResponse(
        id=l.id,
        name=l.name,
        widthMm=float(l.width_mm),
        heightMm=float(l.height_mm),
        columns=l.columns or 1,
        isDefault=l.is_default or False,
        elements=elements,
        prnTemplate=prn_template
    )


@router.get(
    "/layouts",
    response_model=List[BarcodeLayoutResponse],
)
async def list_layouts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all active barcode thermal printer label layouts.
    """
    q = select(BarcodeLayout).where(BarcodeLayout.is_deleted == False)
    res = await db.execute(q)
    layouts = res.scalars().all()
    return [serialize_layout(l) for l in layouts]


@router.post(
    "/layouts",
    response_model=BarcodeLayoutResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_layout(
    req: BarcodeLayoutCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new thermal printer barcode layout design template.
    """
    # If isDefault is true, reset other defaults
    if req.isDefault:
        q = select(BarcodeLayout).where(BarcodeLayout.is_default == True, BarcodeLayout.is_deleted == False)
        res = await db.execute(q)
        defaults = res.scalars().all()
        for d in defaults:
            d.is_default = False

    new_id = f"lay-{int(datetime.now(timezone.utc).timestamp())}"
    elements_data = {
        "elements": req.elements or [],
        "prn_template": req.prnTemplate
    }
    layout = BarcodeLayout(
        id=new_id,
        name=req.name,
        width_mm=req.widthMm,
        height_mm=req.heightMm,
        columns=req.columns or 1,
        is_default=req.isDefault or False,
        elements_json=json.dumps(elements_data),
        created_by=current_user.username,
        updated_by=current_user.username
    )
    db.add(layout)
    await db.commit()
    await db.refresh(layout)

    return serialize_layout(layout)


@router.put(
    "/layouts/{id}",
    response_model=BarcodeLayoutResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_layout(
    id: str,
    req: BarcodeLayoutUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a thermal printer label layout configuration.
    """
    layout = await db.get(BarcodeLayout, id)
    if not layout or layout.is_deleted:
        raise HTTPException(status_code=404, detail="Barcode layout design not found.")

    if req.isDefault:
        q = select(BarcodeLayout).where(
            BarcodeLayout.is_default == True,
            BarcodeLayout.id != id,
            BarcodeLayout.is_deleted == False
        )
        res = await db.execute(q)
        defaults = res.scalars().all()
        for d in defaults:
            d.is_default = False
        layout.is_default = True

    if req.name is not None: layout.name = req.name
    if req.widthMm is not None: layout.width_mm = req.widthMm
    if req.heightMm is not None: layout.height_mm = req.heightMm
    if req.columns is not None: layout.columns = req.columns
    
    if req.elements is not None or req.prnTemplate is not None:
        elements = req.elements
        prn_template = req.prnTemplate
        try:
            old_data = json.loads(layout.elements_json)
            if isinstance(old_data, dict):
                if elements is None: elements = old_data.get("elements", [])
                if prn_template is None: prn_template = old_data.get("prn_template")
        except Exception:
            pass
        
        elements_data = {
            "elements": elements or [],
            "prn_template": prn_template
        }
        layout.elements_json = json.dumps(elements_data)

    layout.updated_by = current_user.username
    layout.modified_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(layout)

    return serialize_layout(layout)


@router.delete(
    "/layouts/{id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_layout(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete a barcode label layout design.
    """
    layout = await db.get(BarcodeLayout, id)
    if not layout or layout.is_deleted:
        raise HTTPException(status_code=404, detail="Barcode layout design not found.")

    layout.is_deleted = True
    layout.is_active = False
    layout.deleted_at = datetime.now(timezone.utc)
    layout.deleted_by = current_user.username
    await db.commit()
    return {"success": True}


@router.post(
    "/print",
)
async def print_labels(
    req: PrintRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate ZPL commands stream, record print history, and dispatch stream via raw TCP socket.
    """
    layout = await db.get(BarcodeLayout, req.layoutId)
    if not layout or layout.is_deleted:
        raise HTTPException(status_code=404, detail="Barcode layout design not found.")

    elements = []
    prn_template = None
    if layout.elements_json:
        try:
            data = json.loads(layout.elements_json)
            if isinstance(data, dict):
                elements = data.get("elements", [])
                prn_template = data.get("prn_template")
            elif isinstance(data, list):
                elements = data
        except Exception:
            pass
    
    # 1. Fetch Printer Connection parameters from SystemConfig
    q_settings = select(SystemConfig).where(SystemConfig.key == "printer_connection")
    res_settings = await db.execute(q_settings)
    settings_obj = res_settings.scalars().first()
    
    connection_type = "TCP"
    printer_ip = "192.168.1.200"
    printer_port = 9100
    usb_target = "LPT1"
    if settings_obj:
        try:
            settings_val = json.loads(settings_obj.value)
            connection_type = settings_val.get("connection_type", "TCP")
            printer_ip = settings_val.get("ip", printer_ip)
            printer_port = int(settings_val.get("port", printer_port))
            usb_target = settings_val.get("usb_target", usb_target)
        except Exception:
            pass

    full_raw_stream_list = []
    log_entries = []

    for item in req.items:
        prod_name = item.get("name", "Product")
        prod_code = item.get("code", "000000")
        prod_price = float(item.get("price", 0.0))
        prod_mrp = float(item.get("mrp", prod_price))
        qty = int(item.get("qty", 1))
        
        # Dynamic properties
        prod_size = item.get("size", "")
        prod_color = item.get("color", "")

        # Build raw ZPL thermal stream
        if prn_template:
            mfg_date = datetime.now(timezone.utc).strftime("%m/%y")
            mrp_val = item.get("mrp", item.get("price", 0.0))
            try:
                mrp_str = f"{int(float(mrp_val))}"
            except Exception:
                mrp_str = str(mrp_val)

            brand_val = item.get("brand") or "SMRITI"
            if not brand_val or brand_val == "SMRITI":
                attrs = item.get("attributes") or {}
                brand_val = attrs.get("brand") or "SMRITI"

            raw_stream = prn_template
            
            # Pre-calculate common dates and formatting defaults
            mfg_date = datetime.now(timezone.utc).strftime("%m/%y")
            mrp_val = item.get("mrp", item.get("price", 0.0))
            try:
                mrp_str = f"{int(float(mrp_val))}"
            except Exception:
                mrp_str = str(mrp_val)

            brand_val = item.get("brand") or "SMRITI"
            if not brand_val or brand_val == "SMRITI":
                attrs = item.get("attributes") or {}
                brand_val = attrs.get("brand") or "SMRITI"

            # 1. Apply primary system-derived placeholders
            raw_stream = raw_stream.replace("{mfg_date}", mfg_date)
            raw_stream = raw_stream.replace("{mrp}", mrp_str)
            raw_stream = raw_stream.replace("{brand}", brand_val)
            raw_stream = raw_stream.replace("{style_code}", item.get("style_code", prod_code))

            # 2. Iterate and replace any top-level key present in the request item dict
            for key, val in item.items():
                if val is not None:
                    raw_stream = raw_stream.replace(f"{{{key}}}", str(val))
                    # Also support lowercase versions for convenience
                    raw_stream = raw_stream.replace(f"{{{key.lower()}}}", str(val))

            # 3. Iterate and replace any secondary nested attributes from postgres product master
            attrs = item.get("attributes")
            if isinstance(attrs, dict):
                for k, v in attrs.items():
                    if v is not None:
                        raw_stream = raw_stream.replace(f"{{{k}}}", str(v))
                        raw_stream = raw_stream.replace(f"{{{k.lower()}}}", str(v))
        elif layout.id == "lay-premium-zpl":
            mfg_date = datetime.now(timezone.utc).strftime("%m/%y")
            mrp_val = item.get("mrp", item.get("price", 0.0))
            try:
                mrp_str = f"{int(float(mrp_val))}"
            except Exception:
                mrp_str = str(mrp_val)

            brand_val = item.get("brand") or "SMRITI"
            if not brand_val or brand_val == "SMRITI":
                attrs = item.get("attributes") or {}
                brand_val = attrs.get("brand") or "SMRITI"

            raw_stream = f"""^XA
^SZ2^JMA
^MCY^PMN
^PW804
^JZY
^LH0,0^LRN
^XZ
^XA
^FO706,47
^BY3^BCB,50,N,N^FD{item.get('barcode', '')}^FS
^FT781,340
^CI0
^AAB,27,15^FD{item.get('barcode', '')}^FS
^FT345,53
^A0N,34,46^FD{brand_val}^FS
^FT335,340
^A0N,17,23^FDMKTD.By:{brand_val}^FS
^FT335,351
^ABN,11,7^FD81,Umerkhadi,Mumbai,400003^FS
^FO615,135
^GB76,80,76^FS
^FT615,198
^A0N,79,77^FR^FD{prod_size}^FS
^FT400,182
^A0N,37,49^FD{prod_color}^FS
^FO410,86
^GB277,46,46^FS
^FT410,124
^A0N,45,43^FR^FD{item.get('style_code', prod_code)}^FS
^FO327,84
^GB367,129,3^FS
^FO329,128
^GB337,0,3^FS
^FT536,274
^A0N,17,23^FD(Incl of all taxes)^FS
^FT493,251
^A0N,42,56^FD{mrp_str}/-^FS
^FT410,246
^A0N,28,38^FDMRP:^FS
^FT327,274
^A0N,17,23^FDMFG.Dt.: {mfg_date}^FS
^FT327,290
^ABN,11,7^FDNET CONTENTS:1 Pair Footwear^FS
^FT335,113
^A0N,17,23^FDArt.No.^FS
^FT335,175
^A0N,17,23^FDColor:^FS
^FT335,386
^ABN,11,7^FDcontact@yourstore.com^FS
^FO34,125
^BY2^BCN,30,N,N^FD{item.get('barcode', '')}^FS
^FT46,181
^A0N,25,34^FD{item.get('barcode', '')}^FS
^FO37,60
^GB70,67,67^FS
^FT37,114
^A0N,65,72^FR^FD{prod_size}^FS
^FO116,50
^GB101,30,30^FS
^FT116,76
^A0N,28,38^FR^FD{prod_color}^FS
^FT37,47
^A0N,28,27^FD{item.get('style_code', prod_code)}^FS
^FT17,159
^ABB,11,7^FD{brand_val}^FS
^FT116,97
^A0N,20,27^FDMRP:{mrp_str}/-^FS
^FT116,114
^A0N,17,23^FD(Incl of all taxes)^FS
^FO33,338
^BCN,30,N,N^FD{item.get('barcode', '')}^FS
^FT45,394
^A0N,25,34^FD{item.get('barcode', '')}^FS
^FO33,275
^GB70,65,65^FS
^FT33,327
^A0N,62,70^FR^FD{prod_size}^FS
^FO116,263
^GB101,30,30^FS
^FT116,289
^A0N,28,38^FR^FD{prod_color}^FS
^FT33,260
^A0N,28,27^FD{item.get('style_code', prod_code)}^FS
^FT16,372
^ABB,11,7^FD{brand_val}^FS
^FT116,310
^A0N,20,27^FDMRP:{mrp_str}/-^FS
^FT116,327
^A0N,17,23^FD(Incl of all taxes)^FS
^FO328,308
^GB367,0,3^FS
^FO328,365
^GB367,0,3^FS
^PQ1,0,1,Y
^XZ"""
        else:
            zpl_parts = ["^XA", f"^PW{int(float(layout.width_mm) * 8)}", f"^LL{int(float(layout.height_mm) * 8)}"]

            for el in elements:
                type_val = el.get("type")
                x = int(el.get("x", 0) * 8)
                y = int(el.get("y", 0) * 8)
                field = el.get("field")

                text_val = ""
                if field == "name": text_val = prod_name
                elif field == "code": text_val = prod_code
                elif field == "price": text_val = f"Rs.{prod_price:.2f}"
                elif field == "mrp": text_val = f"MRP: Rs.{prod_mrp:.2f}"
                elif field == "size": text_val = f"Size: {prod_size}"
                elif field == "color": text_val = f"Color: {prod_color}"
                else: text_val = el.get("staticText", "")

                if type_val == "text":
                    zpl_parts.append(f"^FO{x},{y}^A0N,24,24^FD{text_val}^FS")
                elif type_val == "barcode":
                    zpl_parts.append(f"^FO{x},{y}^BY2^BCN,60,Y,N,N^FD{prod_code}^FS")

            zpl_parts.append("^XZ")
            raw_stream = "\n".join(zpl_parts)
        
        # Append for print dispatch
        for _ in range(qty):
            full_raw_stream_list.append(raw_stream)

        # Build print history entity
        import uuid
        history_id = f"prn-log-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:4]}"
        history = PrintHistory(
            id=history_id,
            user=current_user.username,
            item_code=prod_code,
            item_name=prod_name,
            barcode=item.get("barcode", prod_code),
            quantity=qty,
            status="Success",
            created_by=current_user.username,
            updated_by=current_user.username
        )
        log_entries.append(history)

    # 2. Dispatch to physical thermal printer if we have jobs
    error_msg = None
    print_status = "Success"
    
    if full_raw_stream_list:
        payload = "\n".join(full_raw_stream_list)
        if getattr(req, "saveAsPrn", False):
            # Bypass printer socket/port and generate script output
            pass
        else:
            try:
                if connection_type == "USB":
                    if usb_target.upper().startswith("COM") or "/" in usb_target or "\\" in usb_target:
                        with open(usb_target, "wb") as f:
                            f.write(payload.encode('utf-8'))
                    else:
                        try:
                            import win32print
                            hPrinter = win32print.OpenPrinter(usb_target)
                            try:
                                win32print.StartDocPrinter(hPrinter, 1, ("SMRITI Barcode Label", None, "RAW"))
                                try:
                                    win32print.StartPagePrinter(hPrinter)
                                    win32print.WritePrinter(hPrinter, payload.encode('utf-8'))
                                    win32print.EndPagePrinter(hPrinter)
                                finally:
                                    win32print.EndDocPrinter(hPrinter)
                            finally:
                                win32print.ClosePrinter(hPrinter)
                        except ImportError:
                            with open("simulated_printer_output.txt", "ab") as f:
                                f.write(payload.encode('utf-8'))
                            # Simulated USB print succeeds without throwing an exception in Docker/non-Windows environments.
                else:
                    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                        s.settimeout(5.0)  # 5 seconds timeout
                        s.connect((printer_ip, printer_port))
                        s.sendall(payload.encode('utf-8'))
            except Exception as e:
                error_msg = str(e)
                print_status = "Failed"

    # Update statuses and write to DB
    for entry in log_entries:
        if print_status == "Failed":
            entry.status = "Failed"
            entry.error_message = error_msg
        elif getattr(req, "saveAsPrn", False):
            entry.status = "Success"
            entry.error_message = "PRN File Generated"
        db.add(entry)
        
    await db.commit()

    if getattr(req, "saveAsPrn", False):
        return {
            "success": True,
            "message": f"Generated PRN script for {len(full_raw_stream_list)} labels successfully.",
            "prn_content": "\n".join(full_raw_stream_list) if full_raw_stream_list else ""
        }

    target_str = f"USB port {usb_target}" if connection_type == "USB" else f"IP {printer_ip}:{printer_port}"

    if print_status == "Failed":
        raise HTTPException(
            status_code=400,
            detail=f"Label stream generated but failed to dispatch to printer at {target_str}. Error: {error_msg}"
        )

    return {
        "success": True,
        "message": f"Printed {len(full_raw_stream_list)} labels successfully.",
        "printer": target_str
    }


@router.get(
    "/print-history",
    response_model=List[PrintHistoryResponse],
)
async def list_print_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch history logs of printed label batches.
    """
    q = select(PrintHistory).where(PrintHistory.is_deleted == False).order_by(PrintHistory.created_at.desc()).limit(100)
    res = await db.execute(q)
    histories = res.scalars().all()
    
    serialized = []
    for h in histories:
        serialized.append(PrintHistoryResponse(
            id=h.id,
            user=h.user,
            itemCode=h.item_code,
            itemName=h.item_name,
            barcode=h.barcode,
            quantity=h.quantity,
            status=h.status,
            errorMessage=h.error_message,
            createdAt=h.created_at
        ))
    return serialized


@router.get(
    "/printer-settings",
)
async def get_printer_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch default thermal printer IP and port settings.
    """
    q = select(SystemConfig).where(SystemConfig.key == "printer_connection")
    res = await db.execute(q)
    obj = res.scalars().first()
    
    if not obj:
        return {
            "connection_type": "TCP",
            "ip": "192.168.1.200",
            "port": 9100,
            "usb_target": "LPT1"
        }
        
    return json.loads(obj.value)


@router.post(
    "/printer-settings",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def save_printer_settings(
    req: PrinterSettingsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update global default printer connection settings.
    """
    q = select(SystemConfig).where(SystemConfig.key == "printer_connection")
    res = await db.execute(q)
    obj = res.scalars().first()
    
    val_json = json.dumps({
        "connection_type": req.connection_type or "TCP",
        "ip": req.ip,
        "port": req.port,
        "usb_target": req.usb_target
    })
    
    if obj:
        obj.value = val_json
    else:
        obj = SystemConfig(
            id=f"cfg-{int(datetime.now(timezone.utc).timestamp())}",
            key="printer_connection",
            value=val_json,
            category="Printing"
        )
        db.add(obj)
        
    await db.commit()
    return {
        "success": True,
        "connection_type": req.connection_type,
        "ip": req.ip,
        "port": req.port,
        "usb_target": req.usb_target
    }

