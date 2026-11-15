"""
Agent template helpers: guardrail merge and validation.
"""

from __future__ import annotations

from typing import Dict, Any, Optional

PRIVACY_ORDER = ["debug_full", "metadata_only", "zero_prompt_logging"]
DLP_ORDER = ["off", "log", "block"]


def _pick_stricter(value: str, order: list[str]) -> str:
    if value not in order:
        return order[-1]
    return value


def merge_guardrails(org_config: Dict[str, Any], template_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge org guardrails with template guardrails, never weakening org.

    - privacy_mode: choose the stricter of org vs template (order: debug_full < metadata_only < zero_prompt_logging)
    - dlp_mode: choose stricter (order: off < log < block)
    - allowed_providers/models: intersection
    - budgets/limits: template cannot disable; we keep org defaults if template omits.
    """
    merged: Dict[str, Any] = {}

    org_privacy = org_config.get("privacy_mode")
    tpl_privacy = template_config.get("privacy_mode", org_privacy)
    if org_privacy:
        merged["privacy_mode"] = max([org_privacy, tpl_privacy], key=lambda v: PRIVACY_ORDER.index(v) if v in PRIVACY_ORDER else len(PRIVACY_ORDER))
    elif tpl_privacy:
        merged["privacy_mode"] = tpl_privacy

    org_dlp = org_config.get("dlp_mode")
    tpl_dlp = template_config.get("dlp_mode", org_dlp)
    if org_dlp:
        merged["dlp_mode"] = max([org_dlp, tpl_dlp], key=lambda v: DLP_ORDER.index(v) if v in DLP_ORDER else len(DLP_ORDER))
    elif tpl_dlp:
        merged["dlp_mode"] = tpl_dlp

    org_providers = set(org_config.get("allowed_providers") or [])
    tpl_providers = set(template_config.get("allowed_providers") or [])
    if org_providers or tpl_providers:
        merged["allowed_providers"] = list(org_providers.intersection(tpl_providers) if tpl_providers else org_providers)

    org_models = set(org_config.get("allowed_models") or [])
    tpl_models = set(template_config.get("allowed_models") or [])
    if org_models or tpl_models:
        merged["allowed_models"] = list(org_models.intersection(tpl_models) if tpl_models else org_models)

    # budgets/loop detection flags are inherited; template cannot disable
    merged["budget_limit"] = org_config.get("budget_limit")
    merged["loop_detection"] = org_config.get("loop_detection", True)

    return merged


def validate_template_payload(payload: Dict[str, Any]) -> None:
    """Basic validation: name non-empty, model present."""
    if not payload.get("name"):
        raise ValueError("Template name is required")
    if not payload.get("model"):
        raise ValueError("Model is required")
