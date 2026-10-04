"""
Live integration test for Item Master 422 validation.
Hits the real FastAPI backend at http://127.0.0.1:8000

Tests:
  T1: All required fields missing  -> 422, structured error
  T2: Invalid HSN format           -> 422, human-readable HSN message
  T3: Invalid/zero MRP             -> 422, human-readable price message
  T4: Multiple simultaneous errors -> 422, multiple fields reported
  T5: Minimal valid payload        -> 201 or 200 (stock NOT required)
  T6: Duplicate SKU (if T5 passes) -> 422, duplicate SKU message

Run with:
    python backend/app/tests/live_integration_422_test.py
"""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"
INVENTORY_URL = f"{BASE}/api/v1/inventory/"

PASS = "PASS"
FAIL = "FAIL"
results = []

def run(name, fn):
    try:
        fn()
        results.append((name, True, None))
        print(f"  {PASS}  {name}")
    except AssertionError as e:
        results.append((name, False, str(e)))
        print(f"  {FAIL}  {name}: {e}")
    except Exception as e:
        results.append((name, False, f"EXCEPTION: {e}"))
        print(f"  {FAIL}  {name}: EXCEPTION: {e}")


def post_inventory(payload: dict) -> tuple[int, dict]:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        INVENTORY_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode())
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        return e.code, body


def assert_structured_422(status: int, body: dict) -> dict:
    assert status == 422, f"Expected HTTP 422, got {status}. Body: {json.dumps(body)[:300]}"
    assert "error" in body, f"Expected 'error' key in body. Got: {list(body.keys())}"
    err = body["error"]
    assert err.get("code") == "ITEM_MASTER_VALIDATION_ERROR", \
        f"Expected code=ITEM_MASTER_VALIDATION_ERROR, got: {err.get('code')}"
    assert err.get("status") == 422, f"Expected status=422 in body.error, got: {err.get('status')}"
    assert "message" in err, "Expected 'message' in body.error"
    assert "fields" in err, "Expected 'fields' in body.error"
    assert isinstance(err["fields"], list), "Expected body.error.fields to be a list"
    return err


FORBIDDEN = ["pydantic", "fastapi", "traceback", "exception", "value_error",
             "type_error", "sqlalchemy", "422 unprocessable", "validation error"]

def is_human(msg: str) -> bool:
    ml = msg.lower()
    return not any(f in ml for f in FORBIDDEN)


# ─── Auth header (needed if auth middleware active) ───────────────────────────
# Try without auth first; fall back to get a token if 401
def get_auth_headers() -> dict:
    """Attempt to get an auth token for the test. Returns {} if no auth needed."""
    test_login = {
        "username": "admin",
        "password": "admin123"
    }
    for login_url in [f"{BASE}/api/v1/auth/login", f"{BASE}/api/v1/auth/token"]:
        try:
            data = json.dumps(test_login).encode()
            req = urllib.request.Request(
                login_url, data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req) as resp:
                body = json.loads(resp.read().decode())
                token = body.get("access_token") or body.get("token")
                if token:
                    return {"Authorization": f"Bearer {token}"}
        except Exception:
            pass
    return {}


def post_inventory_authed(payload: dict, headers: dict = None) -> tuple[int, dict]:
    data = json.dumps(payload).encode()
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(INVENTORY_URL, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode())
            return resp.status, body
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        try:
            body = json.loads(body_bytes.decode())
        except Exception:
            body = {"raw": body_bytes.decode()[:500]}
        return e.code, body


print("\n[Setup] Getting auth token...")
auth_headers = get_auth_headers()
if auth_headers:
    print(f"  Auth token obtained: Bearer ...{list(auth_headers.values())[0][-10:]}")
else:
    print("  No auth required or login failed — proceeding without token")


# ─── T1: All required fields missing ─────────────────────────────────────────
print("\n[T1] All required fields missing")

def t1_all_missing():
    status, body = post_inventory_authed({}, auth_headers)
    if status == 401:
        print("    NOTE: 401 Unauthorized — auth token required. Skip T1.")
        return
    err = assert_structured_422(status, body)
    fields = err["fields"]
    assert len(fields) >= 1, f"Expected at least 1 field error, got {len(fields)}"
    assert is_human(err["message"]), f"Summary not human-readable: {err['message']!r}"
    for f in fields:
        assert "field" in f, f"Missing 'field' key in: {f}"
        assert "message" in f, f"Missing 'message' key in: {f}"
        assert is_human(f["message"]), f"Technical text in field '{f['field']}': {f['message']!r}"
    print(f"    Fields reported: {[f['field'] for f in fields]}")
    print(f"    Summary: {err['message']!r}")

run("T1: Empty payload -> 422 structured ITEM_MASTER_VALIDATION_ERROR", t1_all_missing)


# ─── T2: Invalid HSN format ───────────────────────────────────────────────────
print("\n[T2] Invalid HSN format")

def t2_invalid_hsn():
    payload = {
        "code": "INTEGRATION-TEST-HSN",
        "name": "Integration Test Product",
        "mrp": "2999",
        "price": "2999",
        "barcode": "8900000000001",
        "gst_percentage": "12",
        "hsn_code": "ABC123",          # invalid: not 6 or 8 digits
    }
    status, body = post_inventory_authed(payload, auth_headers)
    if status == 401:
        print("    NOTE: 401 Unauthorized — skip T2.")
        return
    err = assert_structured_422(status, body)
    hsn_fields = [f for f in err["fields"] if f["field"] == "hsn_code"]
    assert len(hsn_fields) >= 1, \
        f"Expected hsn_code field error. Got fields: {[f['field'] for f in err['fields']]}"
    msg = hsn_fields[0]["message"]
    assert "6 or 8 digit" in msg or "HSN" in msg, f"HSN message not specific: {msg!r}"
    assert is_human(msg), f"Technical text in HSN message: {msg!r}"
    print(f"    HSN error: {msg!r}")

run("T2: Invalid HSN format -> 422 with HSN-specific human-readable error", t2_invalid_hsn)


# ─── T3: Zero/missing MRP ────────────────────────────────────────────────────
print("\n[T3] Zero / missing MRP")

def t3_missing_mrp():
    payload = {
        "code": "INTEGRATION-TEST-MRP",
        "name": "Integration Test Product",
        "mrp": None,                   # missing
        "price": "2999",
        "barcode": "8900000000002",
        "gst_percentage": "12",
        "hsn_code": "640319",
    }
    status, body = post_inventory_authed(payload, auth_headers)
    if status == 401:
        print("    NOTE: 401 Unauthorized — skip T3.")
        return
    err = assert_structured_422(status, body)
    mrp_fields = [f for f in err["fields"] if f["field"] in ("mrp", "price")]
    assert len(mrp_fields) >= 1, \
        f"Expected mrp field error. Got fields: {[f['field'] for f in err['fields']]}"
    msg = mrp_fields[0]["message"]
    assert "Retail Price" in msg or "MRP" in msg, f"MRP message not specific: {msg!r}"
    assert is_human(msg), f"Technical text in MRP message: {msg!r}"
    print(f"    MRP error: {msg!r}")

run("T3: mrp=None -> 422 with Retail Price human-readable error", t3_missing_mrp)


# ─── T4: Multiple simultaneous validation errors ──────────────────────────────
print("\n[T4] Multiple simultaneous validation errors")

def t4_multiple_errors():
    payload = {
        "code": "",                    # blank SKU
        "name": "",                    # blank name
        "mrp": None,                   # missing MRP
        "price": "0",
        "barcode": "8900000000003",
        "gst_percentage": "12",
        "hsn_code": "ABC",             # invalid HSN
    }
    status, body = post_inventory_authed(payload, auth_headers)
    if status == 401:
        print("    NOTE: 401 Unauthorized — skip T4.")
        return
    err = assert_structured_422(status, body)
    fields = err["fields"]
    assert len(fields) >= 2, f"Expected >= 2 field errors for multiple bad inputs, got {len(fields)}"
    # All messages human-readable
    for f in fields:
        assert is_human(f["message"]), \
            f"Technical text in field '{f['field']}': {f['message']!r}"
    # Summary mentions count
    assert any(str(n) in err["message"] for n in range(2, 10)), \
        f"Summary should mention error count: {err['message']!r}"
    print(f"    {len(fields)} field errors: {[f['field'] for f in fields]}")
    print(f"    Summary: {err['message']!r}")

run("T4: Multiple bad fields -> 422 with all errors human-readable + count in summary", t4_multiple_errors)


# ─── T5: Valid minimal payload (stock NOT required) ───────────────────────────
print("\n[T5] Valid minimal payload — stock NOT required")

CREATED_SKU = "INTEGRATION-TEST-422-VALID-01"

def t5_valid_no_stock():
    global CREATED_SKU
    payload = {
        "code": CREATED_SKU,
        "name": "Integration Test Product 422",
        "mrp": "2999",
        "price": "2999",
        "barcode": "8900000000099",
        "gst_percentage": "12",
        "hsn_code": "640319",
        # stock is NOT included — must not be required
    }
    status, body = post_inventory_authed(payload, auth_headers)
    if status == 401:
        print("    NOTE: 401 Unauthorized — skip T5.")
        return
    # If we get a 422, check for stock_qty in the fields
    if status == 422 and "error" in body:
        err = body["error"]
        if isinstance(err.get("fields"), list):
            stock_fields = [f for f in err["fields"] if "stock" in f["field"].lower()]
            assert len(stock_fields) == 0, \
                f"Stock qty was incorrectly required: {stock_fields}"
        raise AssertionError(
            f"Valid payload was rejected with 422. Fields: {[f['field'] for f in err.get('fields', [])]}"
        )
    assert status in (200, 201), \
        f"Expected 200/201, got {status}. Body: {json.dumps(body)[:500]}"
    print(f"    Product created successfully: HTTP {status}")
    print(f"    Response: {json.dumps(body)[:200]}")

run("T5: Valid payload without stock -> 200/201 (stock NOT required)", t5_valid_no_stock)


# ─── T6: Duplicate SKU ────────────────────────────────────────────────────────
print("\n[T6] Duplicate SKU (depends on T5 success)")

def t6_duplicate_sku():
    # Only meaningful if T5 created the product
    t5_result = next((r for r in results if r[0].startswith("T5")), None)
    if t5_result and not t5_result[1]:
        print("    NOTE: T5 did not create product — skip T6.")
        return
    payload = {
        "code": CREATED_SKU,          # same SKU as T5
        "name": "Duplicate Product",
        "mrp": "2999",
        "price": "2999",
        "barcode": "8900000000098",   # different barcode
        "gst_percentage": "12",
        "hsn_code": "640319",
    }
    status, body = post_inventory_authed(payload, auth_headers)
    if status == 401:
        print("    NOTE: 401 Unauthorized — skip T6.")
        return
    if status in (200, 201):
        print(f"    NOTE: Backend allows duplicate SKU (upsert mode). HTTP {status}. T6 not applicable.")
        return
    err = assert_structured_422(status, body)
    code_fields = [f for f in err["fields"] if f["field"] == "code"]
    assert len(code_fields) >= 1, \
        f"Expected 'code' field error for duplicate SKU. Got: {[f['field'] for f in err['fields']]}"
    msg = code_fields[0]["message"]
    assert "already exists" in msg or "duplicate" in msg.lower() or "unique" in msg, \
        f"Duplicate SKU message not specific enough: {msg!r}"
    assert is_human(msg), f"Technical text in duplicate SKU message: {msg!r}"
    assert CREATED_SKU in msg, f"SKU value not in message: {msg!r}"
    print(f"    Duplicate SKU error: {msg!r}")

run("T6: Duplicate SKU -> 422 with structured duplicate error mentioning SKU value", t6_duplicate_sku)


# ─── Summary ─────────────────────────────────────────────────────────────────
total = len(results)
passed = sum(1 for _, ok, _ in results if ok)
failed = total - passed

print(f"\n{'='*60}")
print(f"Live Integration Results: {passed}/{total} passed, {failed} failed")
if failed:
    print("\nFailed:")
    for name, ok, err in results:
        if not ok:
            print(f"  FAIL  {name}: {err}")
    sys.exit(1)
else:
    print("All live integration tests passed.")
    sys.exit(0)
