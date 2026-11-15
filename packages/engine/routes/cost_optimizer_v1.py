from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core import resources, SUPABASE_URL, log
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers
from providers import PricingEngine

router = APIRouter(prefix="/v1/cost-optimizer", tags=["cost-optimizer"])
# The dashboard calls these routes with its session; scripts with an Oxy API key.
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key, allow_session=True)

DEFAULT_WINDOW = "30d"
DEFAULT_LIMIT = 10
MAX_LIMIT = 50

MODEL_ALTERNATIVES = {
    "gpt-4.1": "gpt-4.1-mini",
    "gpt-4": "gpt-4.1-mini",
    "claude-3-opus": "claude-3-sonnet",
    "claude-3.5-sonnet": "claude-3-haiku",
}


def _window_bounds(window: str) -> datetime:
    now = datetime.now(timezone.utc)
    days = 30 if window not in ["7d", "30d"] else (7 if window == "7d" else 30)
    return now - timedelta(days=days)


async def _fetch_request_stats(org_id: str, since: datetime) -> List[Dict[str, Any]]:
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            # PostgREST 12 quirks worked around here:
            # 1. Groups implicitly by non-aggregate `select` columns; explicit
            #    `group=` is rejected.
            # 2. ORDER BY on an aliased aggregate (`order=cost_usd.desc`) raises
            #    "column must appear in GROUP BY"; sort in Python after fetch.
            # 3. Aggregate syntax is `column.func()`, not `func(column)`.
            params={
                "organization_id": f"eq.{org_id}",
                "created_at": f"gte.{since.isoformat()}",
                "select": "model,provider,cost_usd:cost_usd.sum(),requests:id.count(),prompt_tokens:prompt_tokens.avg(),completion_tokens:completion_tokens.avg()",
                "limit": "200",
            },
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json() or []
        # Sort by aggregated cost descending — done client-side because
        # PostgREST 12 does not allow ORDER BY on aliased aggregate columns.
        rows.sort(key=lambda r: float(r.get("cost_usd") or 0), reverse=True)
        return rows
    except Exception as e:
        log.error("cost_optimizer_fetch_failed", org_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to analyze costs") from e


def _model_switch_reco(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for r in rows:
        model = r.get("model")
        alt = MODEL_ALTERNATIVES.get(model)
        if not alt:
            continue
        cost = float(r.get("cost_usd") or 0)
        if cost <= 0:
            continue
        # Estimate savings by comparing price per token
        prompt_avg = float(r.get("prompt_tokens") or 0)
        completion_avg = float(r.get("completion_tokens") or 0)
        # Assume 50% of traffic could switch
        tokens = (prompt_avg + completion_avg) * (r.get("requests") or 0) * 0.5
        try:
            current_cost = PricingEngine.calculate_cost(model, prompt_avg, completion_avg) * (r.get("requests") or 0) * 0.5
            alt_cost = PricingEngine.calculate_cost(alt, prompt_avg, completion_avg) * (r.get("requests") or 0) * 0.5
            savings = max(0.0, current_cost - alt_cost)
        except Exception:
            savings = cost * 0.2
        return {
            "type": "model_switch",
            "title": f"Heuristic: move low-risk {model} traffic to {alt}",
            "description": f"About half of {model} requests look low-creative. Switching those to {alt} could reduce spend; estimate only.",
            "estimated_monthly_savings_usd": round(savings, 2),
            "confidence": "medium",
            "affected_models": [model, alt],
            "supporting_stats": {
                "requests": r.get("requests") or 0,
                "avg_prompt_tokens": round(prompt_avg, 2),
                "avg_completion_tokens": round(completion_avg, 2),
            },
        }
    return None


def _caching_reco(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    # Heuristic: if top model has many requests, estimate duplicates at 15%
    if not rows:
        return None
    top = rows[0]
    requests = top.get("requests") or 0
    cost = float(top.get("cost_usd") or 0)
    duplicate_ratio = 0.15 if requests > 50 else 0.05
    savings = cost * duplicate_ratio * 0.2  # assume 20% savings on duplicates
    return {
        "type": "enable_caching",
        "title": "Enable response caching for repeated prompts",
        "description": "Traffic appears repetitive. Caching similar prompts could trim duplicate calls (estimate only).",
        "estimated_monthly_savings_usd": round(savings, 2),
        "confidence": "high" if duplicate_ratio > 0.1 else "medium",
        "supporting_stats": {
            "duplicate_ratio": duplicate_ratio,
            "requests_sampled": requests,
        },
    }


def _rate_limit_reco(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    # Heuristic placeholder: if there are many requests with low cost, suggest throttling low-value traffic
    for r in rows:
        cost = float(r.get("cost_usd") or 0)
        req = r.get("requests") or 0
        if req > 100 and cost / max(req, 1) < 0.0005:
            return {
                "type": "rate_limit",
                "title": "Throttle bursty low-value traffic (heuristic)",
                "description": "High-volume, low-cost calls detected; off-peak throttling could save marginal spend (estimate only).",
                "estimated_monthly_savings_usd": round(cost * 0.05, 2),
                "confidence": "low",
                "supporting_stats": {
                    "requests": req,
                    "avg_cost_per_request": round(cost / max(req, 1), 6),
                },
            }
    return None


@router.get("/recommendations")
async def recommendations(
    window: str = Query(DEFAULT_WINDOW, pattern="^(7d|30d)$"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    key_data: CacheData = Depends(api_key_dependency),
):
    """
    Heuristic savings recommendations (estimates only).
    Uses recent request_logs to suggest model switches, caching, and throttling.
    """
    org_id = key_data["organization_id"]
    since = _window_bounds(window)
    rows = await _fetch_request_stats(org_id, since)

    recos: List[Dict[str, Any]] = []
    ms = _model_switch_reco(rows)
    if ms:
        recos.append(ms)
    cache = _caching_reco(rows)
    if cache:
        recos.append(cache)
    rl = _rate_limit_reco(rows)
    if rl:
        recos.append(rl)

    recos = sorted(recos, key=lambda r: r.get("estimated_monthly_savings_usd", 0), reverse=True)[:limit]

    total_savings = round(sum(r.get("estimated_monthly_savings_usd", 0) for r in recos), 2)

    return {
        "window": window,
        "currency": "USD",
        "estimates_only": True,
        "data_source": "request_logs",
        "data_window_start": since.isoformat(),
        "estimated_total_savings_usd": total_savings,
        "recommendations": recos,
    }

