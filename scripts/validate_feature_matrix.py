#!/usr/bin/env python3
"""
Validate FEATURE_MATRIX.yml references.

Rules:
- For every feature with status: ga → code_refs, tests, and docs must exist (selectors allowed).
- For beta/planned → warn on missing paths but do not fail.
"""

import os
import sys
from typing import Iterable, List


def _load_matrix(root: str):
    try:
        import yaml  # type: ignore
    except ImportError:
        sys.stderr.write("Missing dependency: PyYAML. Install with `python -m pip install pyyaml`.\n")
        return None

    matrix_path = os.path.join(root, "docs", "product", "FEATURE_MATRIX.yml")
    try:
        with open(matrix_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or []
    except FileNotFoundError:
        sys.stderr.write(f"Matrix not found at {matrix_path}\n")
        return None


def _check_paths(root: str, feature_id: str, kind: str, paths: Iterable[str] | None, errors: List[str], warnings: List[str], is_ga: bool):
    for p in paths or []:
        if p.strip().upper().startswith("TODO"):
            continue
        path_only = p.split("::", 1)[0]  # allow test selectors like file.py::test_name
        abs_path = os.path.join(root, path_only)
        if not os.path.exists(abs_path):
            msg = f"[{feature_id}] {kind} missing: {p}"
            (errors if is_ga else warnings).append(msg)


def main() -> int:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data = _load_matrix(root)
    if data is None:
        return 1

    errors: List[str] = []
    warnings: List[str] = []

    for entry in data:
        feature_id = entry.get("id", "<unknown>")
        status = entry.get("status")
        is_ga = status == "ga"

        _check_paths(root, feature_id, "code_ref", entry.get("code_refs"), errors, warnings, is_ga)
        _check_paths(root, feature_id, "test", entry.get("tests"), errors, warnings, is_ga)
        _check_paths(root, feature_id, "doc", entry.get("docs"), errors, warnings, is_ga)

    if errors:
        sys.stderr.write("Feature matrix validation failed:\n")
        for e in errors:
            sys.stderr.write(f" - {e}\n")
        if warnings:
            sys.stderr.write("Warnings:\n")
            for w in warnings:
                sys.stderr.write(f" - {w}\n")
        return 1

    if warnings:
        sys.stderr.write("Feature matrix warnings:\n")
        for w in warnings:
            sys.stderr.write(f" - {w}\n")

    print("Feature matrix validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
