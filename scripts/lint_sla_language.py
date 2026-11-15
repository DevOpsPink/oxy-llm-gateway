#!/usr/bin/env python3
"""
Lightweight SLA/guarantee wording linter.

Rules:
- Scan docs/ and marketing UI for over-promising phrases (e.g., SLA, guaranteed, 99.9%).
- Print matches as: path:line_number: line text.
- Exit non-zero only when a GA feature's doc path contains risky wording without a mitigating phrase
  (heuristic, best-effort, no SLA, not guaranteed, target, illustrative).
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
MATRIX = ROOT / "docs" / "product" / "FEATURE_MATRIX.yml"
SCAN_DIRS = [
    ROOT / "docs",
    ROOT / "packages" / "ui" / "src" / "app",
    ROOT / "packages" / "ui" / "src" / "components" / "marketing",
]
EXTS = {".md", ".mdx", ".ts", ".tsx", ".js", ".jsx"}

RISKY_PATTERNS = [
    re.compile(r"\bsla\b", re.IGNORECASE),
    re.compile(r"\bguaranteed?\b", re.IGNORECASE),
    re.compile(r"\b99\.9%\b", re.IGNORECASE),
    re.compile(r"\b100%\b"),
    re.compile(r"zero risk", re.IGNORECASE),
    re.compile(r"will always", re.IGNORECASE),
]

MITIGATIONS = [
    "heuristic",
    "best-effort",
    "best effort",
    "no sla",
    "not a guarantee",
    "not guaranteed",
    "not guaranteed.",
    "not a guarantee.",
    "not billing truth",
    "not a billing source of truth",
    "not an sla",
    "target",
    "illustrative",
    "advisory",
]


def load_ga_doc_paths() -> set[Path]:
    try:
        import yaml  # type: ignore
    except ImportError:
        return set()
    try:
        data = yaml.safe_load(MATRIX.read_text(encoding="utf-8")) or []
    except FileNotFoundError:
        return set()
    ga_docs: set[Path] = set()
    for entry in data:
        if entry.get("status") != "ga":
            continue
        for doc in entry.get("docs") or []:
            doc_path = Path(doc.split("::", 1)[0])  # allow selectors
            if doc_path.suffix:
                ga_docs.add((ROOT / doc_path).resolve())
    return ga_docs


def iter_files() -> Iterable[Path]:
    for base in SCAN_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.is_file() and path.suffix.lower() in EXTS:
                yield path


def line_has_risky(line: str) -> bool:
    return any(p.search(line) for p in RISKY_PATTERNS)


def line_has_mitigation(line: str) -> bool:
    l = line.lower()
    return any(m in l for m in MITIGATIONS)


def main() -> int:
    ga_docs = load_ga_doc_paths()
    risky_hits: list[str] = []
    fatal_hits: list[str] = []

    for file_path in iter_files():
        rel = file_path.relative_to(ROOT)
        with file_path.open("r", encoding="utf-8", errors="ignore") as f:
            for idx, line in enumerate(f, start=1):
                if not line_has_risky(line):
                    continue
                hit = f"{rel}:{idx}: {line.rstrip()}"
                risky_hits.append(hit)
                is_ga_doc = file_path.resolve() in ga_docs
                if is_ga_doc and not line_has_mitigation(line):
                    fatal_hits.append(hit)

    if risky_hits:
        print("SLA wording scan (all matches):")
        for h in risky_hits:
            print(f" - {h}")

    if fatal_hits:
        print("\nErrors (GA docs without mitigation):")
        for h in fatal_hits:
            print(f" - {h}", file=sys.stderr)
        return 1

    print("SLA wording scan passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

