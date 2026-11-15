#!/usr/bin/env python3
"""
Lightweight feature-to-test coverage report.

For each GA feature in docs/product/FEATURE_MATRIX.yml:
- Lists code_refs and declared tests.
- For each code_ref, checks if any declared test file contains a reference to the
  code_ref path (basename match) as a crude signal of coverage.
- Outputs a simple text report with suspected untested code_refs.

Heuristic only; does not replace real coverage tools.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable, List, Dict, Any

ROOT = Path(__file__).resolve().parent.parent
MATRIX = ROOT / "docs" / "product" / "FEATURE_MATRIX.yml"


def load_matrix() -> List[Dict[str, Any]]:
    try:
        import yaml  # type: ignore
    except ImportError:
        sys.stderr.write("Missing dependency: PyYAML. Install with `python -m pip install pyyaml`.\n")
        raise SystemExit(1)
    try:
        return yaml.safe_load(MATRIX.read_text(encoding="utf-8")) or []
    except FileNotFoundError:
        sys.stderr.write(f"Matrix not found at {MATRIX}\n")
        raise SystemExit(1)


def read_file_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except FileNotFoundError:
        return ""


def code_ref_token(code_ref: str) -> str:
    # Use basename without extension as a simple token to search in tests
    return Path(code_ref.split("::", 1)[0]).stem


def test_mentions_code_ref(test_path: Path, token: str) -> bool:
    text = read_file_text(test_path)
    return token in text


def resolve_paths(paths: Iterable[str]) -> List[Path]:
    resolved: List[Path] = []
    for p in paths:
        base = p.split("::", 1)[0]
        resolved.append((ROOT / base).resolve())
    return resolved


def main() -> int:
    matrix = load_matrix()
    features = [f for f in matrix if f.get("status") == "ga"]
    lines: List[str] = []
    overall_missing: List[str] = []

    for feat in features:
        fid = feat.get("id", "<unknown>")
        code_refs = feat.get("code_refs") or []
        tests = feat.get("tests") or []
        test_paths = resolve_paths(tests)

        lines.append(f"Feature: {fid}")
        for code_ref in code_refs:
            token = code_ref_token(code_ref)
            matched = False
            for tpath in test_paths:
                if test_mentions_code_ref(tpath, token):
                    matched = True
                    break
            status = "tests_found" if matched else "suspected_untested"
            if not matched:
                overall_missing.append(f"{fid}: {code_ref}")
            lines.append(f"  - code_ref: {code_ref} -> {status}")
        lines.append("")

    print("\n".join(lines))

    if overall_missing:
        print("Suspected untested code_refs:")
        for m in overall_missing:
            print(f" - {m}")
    else:
        print("All GA code_refs have at least one referenced test (heuristic).")

    # Always exit 0; this is informational.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

