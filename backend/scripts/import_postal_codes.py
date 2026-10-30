"""Import India Post office data into postal_codes_ref.

The source contains one row per post office, while postal_codes_ref stores a
searchable postal location. We preserve the post-office name as locality and
use the district as the city-level lookup value.

Examples:
    python scripts/import_postal_codes.py --database smritisys --dry-run
    python scripts/import_postal_codes.py --database smritisys
"""

from __future__ import annotations

import argparse
import csv
import re
import uuid
from collections import Counter, defaultdict
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values


DEFAULT_SOURCE = Path(__file__).resolve().parents[2] / "assets" / "Pincodes" / "5c2f62fe-5afa-4119-a499-fec9d604d5bd.csv"

STATE_ALIASES = {
    "ANDAMAN AND NICOBAR ISLANDS": "ANDAMAN & NICOBAR ISLANDS",
    "JAMMU AND KASHMIR": "JAMMU & KASHMIR",
    "THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "DADRA & NAGAR HAVELI AND DAMAN & DIU",
    "ORISSA": "ODISHA",
}


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).upper()


def load_state_codes(cur) -> dict[str, str]:
    cur.execute("SELECT name, state_code FROM states_ref WHERE country_code = 'IN' AND is_active = true")
    state_codes = {normalize_name(name): code for name, code in cur.fetchall()}
    for source_name, canonical_name in STATE_ALIASES.items():
        if normalize_name(canonical_name) in state_codes:
            state_codes[source_name] = state_codes[normalize_name(canonical_name)]
    return state_codes


def read_rows(source: Path, state_codes: dict[str, str]):
    accepted = []
    rejected = Counter()
    seen = set()

    with source.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"officename", "pincode", "district", "statename"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Missing required columns: {sorted(missing)}")

        source_rows = list(reader)
        state_candidates: dict[str, Counter[str]] = defaultdict(Counter)
        for row in source_rows:
            pin = str(row.get("pincode") or "").strip()
            state_name = normalize_name(str(row.get("statename") or ""))
            if re.fullmatch(r"\d{6}", pin) and state_name in state_codes:
                state_candidates[pin][state_name] += 1

        canonical_states: dict[str, str] = {}
        for pin, candidates in state_candidates.items():
            ranked = candidates.most_common()
            if len(ranked) == 1 or ranked[0][1] > ranked[1][1]:
                canonical_states[pin] = ranked[0][0]

        for line_number, row in enumerate(source_rows, start=2):
            pin = str(row.get("pincode") or "").strip()
            state_name = normalize_name(str(row.get("statename") or ""))
            district = re.sub(r"\s+", " ", str(row.get("district") or "").strip())
            office = re.sub(r"\s+", " ", str(row.get("officename") or "").strip())
            state_code = state_codes.get(state_name)

            if not re.fullmatch(r"\d{6}", pin):
                rejected["invalid_pincode"] += 1
                continue
            canonical_state = canonical_states.get(pin)
            if not canonical_state:
                rejected["ambiguous_or_unknown_pin_state"] += 1
                continue
            if not state_code:
                rejected["unknown_state_row"] += 1
                continue
            if state_name != canonical_state:
                rejected["noncanonical_pin_state_row"] += 1
                continue
            if not district or not office:
                rejected["missing_district_or_office"] += 1
                continue

            key = (pin, normalize_name(district), normalize_name(office))
            if key in seen:
                rejected["duplicate_source_row"] += 1
                continue
            seen.add(key)
            accepted.append((
                f"pin_{uuid.uuid5(uuid.NAMESPACE_URL, '|'.join(key)).hex[:12]}",
                "IN",
                state_code,
                pin,
                office,
                district,
                True,
            ))

    return accepted, rejected


def import_rows(database: str, source: Path, dry_run: bool) -> int:
    connection = psycopg2.connect(
        host="localhost",
        port=5432,
        user="postgres",
        password="postgres",
        dbname=database,
    )
    try:
        with connection.cursor() as cur:
            state_codes = load_state_codes(cur)
            rows, rejected = read_rows(source, state_codes)
            print(f"source_rows={sum(rejected.values()) + len(rows)} accepted_rows={len(rows)}")
            print(f"accepted_pincodes={len({row[3] for row in rows})}")
            print(f"rejected={dict(rejected)}")

            if dry_run:
                return len(rows)

            execute_values(
                cur,
                """
                INSERT INTO postal_codes_ref
                    (id, country_code, state_code, postal_code, locality, city, is_active)
                VALUES %s
                ON CONFLICT DO NOTHING
                """,
                rows,
                page_size=2000,
            )
            connection.commit()
            print(f"inserted_or_existing_rows={cur.rowcount}")
            return len(rows)
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import India Post PIN data into postal_codes_ref")
    parser.add_argument("--database", default="smritisys")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.source.exists():
        raise SystemExit(f"Source file not found: {args.source}")
    import_rows(args.database, args.source, args.dry_run)


if __name__ == "__main__":
    main()
