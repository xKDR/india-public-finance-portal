#!/usr/bin/env python3
"""
relabel_and_annotate.py — Task A2: correct mislabelled fiscal-year metadata.

Transforms ALL years in state-finances/karnataka/KA_years/KA_<Y>/ (idempotent):

CSV — budget_<Y>.csv:
  - Rename 4 amount column headers (positional truth from folder year).
  - Prepend document_year column.

CSV — checks_<Y>.csv:
  - Prepend document_year column only.

NDJSON — budget_leaves, summaries:
  - Add document_year (top level, after 'year').
  - Correct amounts[].fiscal_year by measure role.

NDJSON — budget_nodes:
  - Add document_year (top level, after 'year').
  - Recurse into nested structure to correct all amounts[].fiscal_year.

NDJSON — checks:
  - Add document_year (top level, after 'year').
  - Correct financial_column.label if in fiscal-year format (Accounts_/Budget_/Revised_).

Approach for budget_estimate fiscal_year correction (idempotent):
  Scan the ENTIRE ndjson file first to collect the two distinct BE fiscal_year values.
  Sort them: the smaller → BE(Y-1), the larger → BE(Y). Build a lookup dict.
  Apply this lookup per-doc. This handles docs with 0, 1, or 2 BE entries correctly
  without guessing, and is idempotent for already-correct years.

Run from repo root:
    python3 tools/data_fix/relabel_and_annotate.py
"""

import csv
import io
import json
import os
import sys

YEARS = [
    "2016-17", "2017-18", "2018-19", "2019-20", "2020-21",
    "2021-22", "2022-23", "2023-24", "2024-25", "2025-26", "2026-27",
]

# tools/data_fix/ -> tools/ -> repo root -> state-finances/karnataka/
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PKG_ROOT = os.path.join(os.path.dirname(os.path.dirname(_SCRIPT_DIR)), "state-finances", "karnataka")


# ── fiscal-year arithmetic ────────────────────────────────────────────────────

def fy(start, end_offset=1):
    """Build a fiscal-year string: fy(2016) -> '2016-17', fy(2015) -> '2015-16'."""
    return f"{start}-{(start + end_offset) % 100:02d}"


# ── global BE fiscal_year mapping ─────────────────────────────────────────────

def _collect_be_fys(obj, out):
    """Recursively collect all budget_estimate fiscal_year values into out (set)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "amounts" and isinstance(v, list):
                for a in v:
                    if a.get("measure") == "budget_estimate":
                        out.add(a["fiscal_year"])
            else:
                _collect_be_fys(v, out)
    elif isinstance(obj, list):
        for item in obj:
            _collect_be_fys(item, out)


def build_be_fy_map(path, y):
    """
    Scan the ndjson file to find all distinct BE fiscal_year values.
    Sort them: smaller → BE(Y-1)=fy(y-1), larger → BE(Y)=fy(y).
    Returns a dict {old_fy: correct_fy}.
    Raises if there are != 2 distinct values (structural anomaly).
    """
    be_fys = set()
    with open(path, encoding="utf-8") as f:
        for line in f:
            doc = json.loads(line)
            _collect_be_fys(doc, be_fys)

    if len(be_fys) != 2:
        raise ValueError(
            f"{path}: expected exactly 2 distinct BE fiscal_years, got {sorted(be_fys)}"
        )
    be_sorted = sorted(be_fys)
    return {be_sorted[0]: fy(y - 1), be_sorted[1]: fy(y)}


# ── amounts correction ────────────────────────────────────────────────────────

def correct_amounts(amounts, y, be_fy_map):
    """
    Return a new amounts list with corrected fiscal_year values.
    be_fy_map: {old_fiscal_year: correct_fiscal_year} for budget_estimate entries.
    """
    new_amounts = []
    for a in amounts:
        new_a = dict(a)
        m = a["measure"]
        if m == "accounts":
            new_a["fiscal_year"] = fy(y - 2)
        elif m == "revised_estimate":
            new_a["fiscal_year"] = fy(y - 1)
        elif m == "budget_estimate":
            old_fy = a["fiscal_year"]
            # Look up in global map; if not present, already correct (idempotent)
            new_a["fiscal_year"] = be_fy_map.get(old_fy, old_fy)
        new_amounts.append(new_a)
    return new_amounts


def fix_all_amounts(obj, y, be_fy_map):
    """Recursively correct all amounts[] arrays in a nested dict/list."""
    if isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            if k == "amounts" and isinstance(v, list):
                result[k] = correct_amounts(v, y, be_fy_map)
            else:
                result[k] = fix_all_amounts(v, y, be_fy_map)
        return result
    if isinstance(obj, list):
        return [fix_all_amounts(item, y, be_fy_map) for item in obj]
    return obj


def insert_document_year(doc, Y):
    """Return new dict with document_year inserted after 'year' (idempotent)."""
    if "document_year" in doc:
        doc = dict(doc)
        doc["document_year"] = Y
        return doc
    result = {}
    inserted = False
    for k, v in doc.items():
        result[k] = v
        if k == "year" and not inserted:
            result["document_year"] = Y
            inserted = True
    if not inserted:
        result["document_year"] = Y
    return result


# ── CSV transforms ────────────────────────────────────────────────────────────

def csv_amount_headers(y):
    """Return the 4 correct amount column headers for document year y (int)."""
    return [
        f"accounts_{y - 2}_{(y - 1) % 100:02d}_amount",
        f"budget_estimate_{y - 1}_{y % 100:02d}_amount",
        f"revised_estimate_{y - 1}_{y % 100:02d}_amount",
        f"budget_estimate_{y}_{(y + 1) % 100:02d}_amount",
    ]


def transform_budget_csv(path, Y):
    """Rename 4 amount columns + prepend document_year column."""
    y = int(Y[:4])
    correct_headers = csv_amount_headers(y)

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        orig_headers = next(reader)
        rows = list(reader)

    # Idempotent: if document_year already first, the 4 amount cols shifted by 1
    offset = 1 if orig_headers[0] == "document_year" else 0
    amount_indices = [23 + offset, 24 + offset, 25 + offset, 26 + offset]
    expected_prefixes = ["accounts_", "budget_estimate_", "revised_estimate_", "budget_estimate_"]
    for idx, prefix in zip(amount_indices, expected_prefixes):
        if not orig_headers[idx].startswith(prefix):
            raise ValueError(
                f"{path}: col {idx} expected prefix '{prefix}', got '{orig_headers[idx]}'"
            )

    new_headers = list(orig_headers)
    for idx, hdr in zip(amount_indices, correct_headers):
        new_headers[idx] = hdr

    if offset == 0:
        # First run: prepend document_year column
        final_headers = ["document_year"] + new_headers
        final_rows = [[Y] + row for row in rows]
    else:
        # Idempotent run: already has document_year, just update headers
        final_headers = new_headers
        final_rows = rows

    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(final_headers)
    writer.writerows(final_rows)

    with open(path, "w", newline="", encoding="utf-8") as f:
        f.write(out.getvalue())


def checks_csv_label(position, y):
    """Correct financial_column_label value for a given position and document year."""
    mapping = {
        1: f"Accounts_{y - 2}_{(y - 1) % 100:02d}",
        2: f"Budget_{y - 1}_{y % 100:02d}",
        3: f"Revised_{y - 1}_{y % 100:02d}",
        4: f"Budget_{y}_{(y + 1) % 100:02d}",
    }
    return mapping[int(position)]


def transform_checks_csv(path, Y):
    """
    Prepend document_year column (idempotent) + correct financial_column_label values.

    For years where financial_column_label carries a fiscal-year label
    (Accounts_/Budget_/Revised_ prefix), rewrite by positional truth from Y.
    For years where it carries generic 'Financial_Col_N' labels, leave unchanged.
    """
    y = int(Y[:4])
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        orig_fieldnames = reader.fieldnames
        rows = list(reader)

    # Check if document_year already present and if labels need fixing
    has_doc_year = orig_fieldnames[0] == "document_year"
    lbl_col = "financial_column_label"
    pos_col = "financial_column_position"

    # Sample one label to detect format (same logic as NDJSON)
    sample_label = rows[0].get(lbl_col, "") if rows else ""
    needs_label_fix = _is_fiscal_label(sample_label)

    if has_doc_year and not needs_label_fix:
        return  # Fully idempotent: nothing to do

    new_rows = []
    for row in rows:
        new_row = dict(row)
        if not has_doc_year:
            new_row = {"document_year": Y, **new_row}
        if needs_label_fix:
            pos = new_row.get(pos_col)
            if pos:
                new_row[lbl_col] = checks_csv_label(pos, y)
        new_rows.append(new_row)

    if has_doc_year:
        final_fieldnames = orig_fieldnames
    else:
        final_fieldnames = ["document_year"] + list(orig_fieldnames)

    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=final_fieldnames, lineterminator="\n")
    writer.writeheader()
    writer.writerows(new_rows)

    with open(path, "w", newline="", encoding="utf-8") as f:
        f.write(out.getvalue())


# ── NDJSON transforms ─────────────────────────────────────────────────────────

def transform_ndjson_simple(path, Y):
    """For budget_leaves and summaries: add document_year + fix amounts[]."""
    y = int(Y[:4])
    be_fy_map = build_be_fy_map(path, y)
    out_lines = []

    with open(path, encoding="utf-8") as f:
        for line in f:
            doc = json.loads(line)
            doc = insert_document_year(doc, Y)
            if "amounts" in doc:
                doc["amounts"] = correct_amounts(doc["amounts"], y, be_fy_map)
            out_lines.append(json.dumps(doc, ensure_ascii=False))

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines) + "\n")


def transform_ndjson_nodes(path, Y):
    """For budget_nodes: add document_year + recurse into nested amounts[]."""
    y = int(Y[:4])
    be_fy_map = build_be_fy_map(path, y)
    out_lines = []

    with open(path, encoding="utf-8") as f:
        for line in f:
            doc = json.loads(line)
            doc = insert_document_year(doc, Y)
            doc = fix_all_amounts(doc, y, be_fy_map)
            out_lines.append(json.dumps(doc, ensure_ascii=False))

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines) + "\n")


def _is_fiscal_label(label):
    """True if label is a fiscal-year label (not 'Financial_Col_N')."""
    return label and not label.startswith("Financial_Col_")


def correct_checks_label(position, y):
    """Return the correct financial_column.label for the given position."""
    mapping = {
        1: f"Accounts_{y - 2}_{(y - 1) % 100:02d}",
        2: f"Budget_{y - 1}_{y % 100:02d}",
        3: f"Revised_{y - 1}_{y % 100:02d}",
        4: f"Budget_{y}_{(y + 1) % 100:02d}",
    }
    return mapping[position]


def transform_ndjson_checks(path, Y):
    """For checks: add document_year + fix financial_column.label if fiscal-year format."""
    y = int(Y[:4])
    out_lines = []

    with open(path, encoding="utf-8") as f:
        for line in f:
            doc = json.loads(line)
            doc = insert_document_year(doc, Y)
            fc = doc.get("financial_column")
            if fc and _is_fiscal_label(fc.get("label")):
                pos = fc["position"]
                doc = dict(doc)
                doc["financial_column"] = dict(fc)
                doc["financial_column"]["label"] = correct_checks_label(pos, y)
            out_lines.append(json.dumps(doc, ensure_ascii=False))

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines) + "\n")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    for Y in YEARS:
        y_dir = os.path.join(PKG_ROOT, "years", Y)
        csv_dir = os.path.join(y_dir, "csv")
        json_dir = os.path.join(y_dir, "json")

        print(f"[{Y}] budget CSV ...", end="", flush=True)
        transform_budget_csv(os.path.join(csv_dir, f"budget_{Y}.csv"), Y)
        print(" done")

        print(f"[{Y}] checks CSV ...", end="", flush=True)
        transform_checks_csv(os.path.join(csv_dir, f"checks_{Y}.csv"), Y)
        print(" done")

        print(f"[{Y}] budget_leaves ndjson ...", end="", flush=True)
        transform_ndjson_simple(os.path.join(json_dir, f"budget_leaves_{Y}.ndjson"), Y)
        print(" done")

        print(f"[{Y}] summaries ndjson ...", end="", flush=True)
        transform_ndjson_simple(os.path.join(json_dir, f"summaries_{Y}.ndjson"), Y)
        print(" done")

        print(f"[{Y}] budget_nodes ndjson ...", end="", flush=True)
        transform_ndjson_nodes(os.path.join(json_dir, f"budget_nodes_{Y}.ndjson"), Y)
        print(" done")

        print(f"[{Y}] checks ndjson ...", end="", flush=True)
        transform_ndjson_checks(os.path.join(json_dir, f"checks_{Y}.ndjson"), Y)
        print(" done")

        print()

    print("Transform complete.")


if __name__ == "__main__":
    main()
