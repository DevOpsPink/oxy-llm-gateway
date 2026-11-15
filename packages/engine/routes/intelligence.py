"""
Intelligence API - Anomaly Detection & Insights
================================================

Provides:
1. Real-time anomaly detection
2. Cost insights and predictions
3. Security threat analysis
4. Usage optimization recommendations

"""

import json
import asyncio
import calendar
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import inspect
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import structlog

from core import SUPABASE_KEY
from core import log, resources, SUPABASE_URL
from dependencies import (
    get_supabase_headers,
    get_user_and_key_from_api_key,
    build_api_key_dependency,
    CacheData,
)

# Import anomaly detector
from workers.anomaly_detector import (
    detect_anomalies_for_org,
    AnomalyType,
    AnomalySeverity
)

# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(prefix="/v1/intelligence", tags=["intelligence"])
# The dashboard calls these routes with its session; scripts with an Oxy API key.
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key, allow_session=True)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def _month_start_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


def _month_end_utc() -> datetime:
    now = datetime.now(timezone.utc)
    last_day = calendar.monthrange(now.year, now.month)[1]
    return datetime(now.year, now.month, last_day, 23, 59, 59, tzinfo=timezone.utc)


@dataclass
class SecurityScoreInputs:
    """Deterministic inputs for the security score heuristic."""

    budgets_configured: bool
    dlp_enabled: bool
    privacy_mode: str
    key_rotation_age_days: Optional[int]
    rate_limit_enabled: bool
    response_cache_enabled: bool


def compute_security_score(inputs: SecurityScoreInputs) -> Dict[str, Any]:
    """
    Deterministic scoring table (estimates only):
    - Start at 100, clamp to [0, 100]
    - Budgets configured: +10 if yes, -20 if no
    - DLP enabled: +5 if yes, -25 if no
    - Privacy mode: zero_prompt_logging +10; metadata_only +5; debug_full -15; unknown -10
    - Key rotation age: <=90 days +5; 91-180 days -5; >180 days -15; unknown -10
    - Rate limits enabled: +5 if yes, -20 if no
    - Response caching enabled: +3 if yes, -5 if no (minor)
    Grades: A >=90, B >=80, C >=65, D >=50, else F.
    """
    score = 100
    details: List[Dict[str, Any]] = []

    def apply(condition: bool, points_if_true: int, points_if_false: int, key: str, label: str, status_ok: str, status_bad: str):
        nonlocal score
        points = points_if_true if condition else points_if_false
        score += points
        details.append(
            {
                "key": key,
                "label": label,
                "status": status_ok if condition else status_bad,
                "points": points,
            }
        )

    apply(inputs.budgets_configured, 10, -20, "budgets", "Budgets configured", "ok", "warning")
    apply(inputs.dlp_enabled, 5, -25, "dlp", "DLP scanning", "ok", "critical")

    privacy = (inputs.privacy_mode or "").lower()
    if privacy == "zero_prompt_logging":
        score += 10
        details.append({"key": "privacy_mode", "label": "Privacy mode", "status": "ok", "points": 10})
    elif privacy == "metadata_only":
        score += 5
        details.append({"key": "privacy_mode", "label": "Privacy mode", "status": "ok", "points": 5})
    elif privacy == "debug_full":
        score -= 15
        details.append({"key": "privacy_mode", "label": "Privacy mode", "status": "warning", "points": -15})
    else:
        score -= 10
        details.append({"key": "privacy_mode", "label": "Privacy mode", "status": "warning", "points": -10})

    age = inputs.key_rotation_age_days
    if age is None:
        score -= 10
        details.append({"key": "key_rotation", "label": "Key rotation age", "status": "warning", "points": -10})
    elif age <= 90:
        score += 5
        details.append({"key": "key_rotation", "label": "Key rotation age", "status": "ok", "points": 5})
    elif age <= 180:
        score -= 5
        details.append({"key": "key_rotation", "label": "Key rotation age", "status": "warning", "points": -5})
    else:
        score -= 15
        details.append({"key": "key_rotation", "label": "Key rotation age", "status": "critical", "points": -15})

    apply(inputs.rate_limit_enabled, 5, -20, "rate_limits", "Rate limits", "ok", "critical")
    apply(inputs.response_cache_enabled, 3, -5, "response_cache", "Response caching", "ok", "warning")

    score = max(0, min(100, score))
    if score >= 90:
        grade = "A"
    elif score >= 80:
        grade = "B"
    elif score >= 65:
        grade = "C"
    elif score >= 50:
        grade = "D"
    else:
        grade = "F"

    return {
        "score": int(round(score)),
        "grade": grade,
        "details": details,
        "note": "Heuristic only; not a security certification.",
        "last_calculated": datetime.now(timezone.utc).isoformat(),
    }


def _project_forecast(month_cost: float, month_start: datetime) -> Dict[str, float]:
    now = datetime.now(timezone.utc)
    days_elapsed = max(1, (now.date() - month_start.date()).days + 1)
    total_days = calendar.monthrange(now.year, now.month)[1]
    daily_avg = month_cost / days_elapsed
    projected = daily_avg * total_days
    return {
        "month_to_date_cost_usd": round(month_cost, 2),
        "projected_end_of_month_cost_usd": round(projected, 2),
    }


async def _fetch_anomalies(org_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/anomaly_alerts",
            params={
                "organization_id": f"eq.{org_id}",
                "select": "id,anomaly_type,severity,detected_at,description,entity_id,entity_type,metadata",
                "order": "detected_at.desc",
                "limit": str(limit),
            },
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json()
        anomalies = []
        for r in rows:
            meta = r.get("metadata") or {}
            anomalies.append(
                {
                    "id": r.get("id"),
                    "type": r.get("anomaly_type") or meta.get("type") or "cost_spike",
                    "severity": r.get("severity") or "info",
                    "detected_at": r.get("detected_at"),
                    "description": r.get("description") or meta.get("description") or "Anomaly detected",
                    "project_id": meta.get("project_id") or r.get("entity_id"),
                    "model": meta.get("model"),
                    "estimated_impact_usd": meta.get("estimated_impact_usd"),
                }
            )
        return anomalies
    except Exception as e:
        log.error("intelligence_anomalies_fetch_failed", org_id=org_id, error=str(e))
        return []


async def _fetch_top_models(org_id: str, month_start: datetime, limit: int = 5) -> List[Dict[str, Any]]:
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params={
                "organization_id": f"eq.{org_id}",
                "created_at": f"gte.{month_start.isoformat()}",
                "select": "model,requests:id.count(),cost_usd:cost_usd.sum()",
                "limit": str(limit),
            },
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json() or []
        # Sort top-cost first client-side (PostgREST 12 can't ORDER BY an
        # aliased aggregate column).
        rows.sort(key=lambda r: float(r.get("cost_usd") or 0), reverse=True)
        models = []
        for r in rows[:limit]:
            models.append(
                {
                    "model": r.get("model"),
                    "requests": r.get("requests") or 0,
                    "cost_usd": float(r.get("cost_usd") or 0),
                }
            )
        return models
    except Exception as e:
        log.error("intelligence_top_models_failed", org_id=org_id, error=str(e))
        return []


async def _fetch_top_projects(org_id: str, month_start: datetime, limit: int = 5) -> List[Dict[str, Any]]:
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params={
                "organization_id": f"eq.{org_id}",
                "created_at": f"gte.{month_start.isoformat()}",
                "select": "project_id,requests:id.count(),cost_usd:cost_usd.sum()",
                "limit": str(limit),
            },
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json() or []
        # Sort top-cost first client-side (PostgREST 12 limitation).
        rows.sort(key=lambda r: float(r.get("cost_usd") or 0), reverse=True)
        rows = rows[:limit]
        ids = [r.get("project_id") for r in rows if r.get("project_id")]
        names: Dict[str, str] = {}
        if ids:
            proj_res = await resources.supabase.table("projects").select("id,name").in_("id", ids).execute()
            for row in proj_res.data or []:
                names[row["id"]] = row.get("name", "")

        projects = []
        for r in rows:
            pid = r.get("project_id")
            projects.append(
                {
                    "project_id": pid,
                    "name": names.get(pid, pid),
                    "cost_usd": float(r.get("cost_usd") or 0),
                    "requests": r.get("requests") or 0,
                }
            )
        return projects
    except Exception as e:
        log.error("intelligence_top_projects_failed", org_id=org_id, error=str(e))
        return []


async def _fetch_month_cost(org_id: str, month_start: datetime) -> float:
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params={
                "organization_id": f"eq.{org_id}",
                "created_at": f"gte.{month_start.isoformat()}",
                "select": "cost_usd:cost_usd.sum()",
            },
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json()
        if not rows:
            return 0.0
        return float(rows[0].get("cost_usd") or 0)
    except Exception as e:
        log.error("intelligence_month_cost_failed", org_id=org_id, error=str(e))
        return 0.0


async def _security_score(org_id: str) -> Dict[str, Any]:
    """Fetch org settings and compute deterministic security score (heuristic only)."""
    try:
        settings_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organizations",
            params={
                "id": f"eq.{org_id}",
                "select": "settings",
                "limit": 1,
            },
            headers=get_supabase_headers(),
        )
        settings_res.raise_for_status()
        rows = settings_res.json()
        settings = rows[0].get("settings") if rows else {} or {}

        privacy_mode = settings.get("privacy_mode") or "metadata_only"
        dlp_enabled = bool(settings.get("dlp_enabled", False))
        rate_limit_value = settings.get("rate_limit_per_minute")
        rate_limit_enabled = bool(rate_limit_value) and rate_limit_value > 0
        response_cache_enabled = bool(settings.get("response_cache_enabled", False))

        budgets_configured = False
        try:
            budgets_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/projects",
                params={
                    "organization_id": f"eq.{org_id}",
                    "budget_limit": "gt.0",
                    "select": "id",
                    "limit": "1",
                },
                headers=get_supabase_headers(),
            )
            if budgets_res.status_code == 200 and budgets_res.json():
                budgets_configured = True
        except Exception as inner_e:
            log.warning("security_score_budget_check_failed", org_id=org_id, error=str(inner_e)[:200])

        key_rotation_age_days: Optional[int] = None
        try:
            keys_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/api_keys",
                params={
                    "organization_id": f"eq.{org_id}",
                    "select": "last_rotated_at,created_at",
                    "order": "last_rotated_at.desc",
                    "limit": "50",
                },
                headers=get_supabase_headers(),
            )
            if keys_res.status_code == 200:
                now = datetime.now(timezone.utc)
                ages = []
                for row in keys_res.json() or []:
                    ts = row.get("last_rotated_at") or row.get("created_at")
                    if ts:
                        rotated_at = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        ages.append((now - rotated_at).days)
                if ages:
                    key_rotation_age_days = max(ages)  # worst-case key age
        except Exception as inner_e:
            log.warning("security_score_key_rotation_check_failed", org_id=org_id, error=str(inner_e)[:200])

        inputs = SecurityScoreInputs(
            budgets_configured=budgets_configured,
            dlp_enabled=dlp_enabled,
            privacy_mode=privacy_mode,
            key_rotation_age_days=key_rotation_age_days,
            rate_limit_enabled=rate_limit_enabled,
            response_cache_enabled=response_cache_enabled,
        )
        return compute_security_score(inputs)
    except Exception as e:
        log.error("intelligence_security_score_failed", org_id=org_id, error=str(e))
        fallback_inputs = SecurityScoreInputs(
            budgets_configured=False,
            dlp_enabled=False,
            privacy_mode="metadata_only",
            key_rotation_age_days=None,
            rate_limit_enabled=False,
            response_cache_enabled=False,
        )
        return compute_security_score(fallback_inputs)

async def get_user_and_org_from_jwt(request) -> Dict[str, str]:
    """Extract user_id and organization_id from JWT token."""
    from fastapi import Request
    
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = auth_header.replace("Bearer ", "").strip()
    
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_KEY
            },
            timeout=5.0
        )
        
        if res.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user_data = res.json()
        user_id = user_data.get("id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        org_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organization_members",
            params={
                "select": "organization_id,role",
                "user_id": f"eq.{user_id}",
                "status": "eq.active",
                "limit": "1"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        
        if org_res.status_code != 200 or not org_res.json():
            raise HTTPException(status_code=403, detail="User not in any organization")
        
        org_data = org_res.json()[0]
        
        return {
            "user_id": user_id,
            "organization_id": org_data["organization_id"],
            "role": org_data["role"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("jwt_verification_failed", error=str(e)[:200])
        raise HTTPException(status_code=401, detail="Authentication failed")


# ============================================================================
# ANOMALY DETECTION ENDPOINTS
# ============================================================================

@router.get("/anomalies")
async def get_anomalies(
    request: Request,
    severity: Optional[str] = Query(None, pattern="^(low|medium|high|critical)$"),
    anomaly_type: Optional[str] = None,
    status: Optional[str] = Query("new", pattern="^(new|acknowledged|resolved|ignored)$"),
    limit: int = Query(50, ge=1, le=200)
):
    """
    Get detected anomalies for the organization.
    
    Filters:
    - severity: low, medium, high, critical
    - anomaly_type: cost_spike, volume_spike, budget_burn, etc.
    - status: new, acknowledged, resolved, ignored
    
    Returns list of anomaly alerts sorted by detection time.
    """
    from fastapi import Request
    auth = await get_user_and_org_from_jwt(request)
    organization_id = auth["organization_id"]
    
    try:
        query_params = {
            "select": "*",
            "organization_id": f"eq.{organization_id}",
            "order": "detected_at.desc",
            "limit": str(limit)
        }
        
        if severity:
            query_params["severity"] = f"eq.{severity}"
        if anomaly_type:
            query_params["anomaly_type"] = f"eq.{anomaly_type}"
        if status:
            query_params["status"] = f"eq.{status}"
        
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/anomaly_alerts",
            params=query_params,
            headers=get_supabase_headers(),
            timeout=10.0
        )
        
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch anomalies")
        
        return {"anomalies": res.json(), "count": len(res.json())}
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("get_anomalies_failed", error=str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to fetch anomalies")


@router.post("/anomalies/detect")
async def detect_anomalies_now(request: Request):
    """
    Trigger anomaly detection immediately (on-demand).
    
    Use this to check for anomalies without waiting for scheduled detection.
    Returns list of any detected anomalies.
    """
    from fastapi import Request
    auth = await get_user_and_org_from_jwt(request)
    organization_id = auth["organization_id"]
    
    try:
        anomalies = await detect_anomalies_for_org(organization_id)
        
        return {
            "success": True,
            "anomalies_detected": len(anomalies),
            "anomalies": anomalies
        }
        
    except Exception as e:
        log.error("detect_anomalies_failed", error=str(e)[:200])
        raise HTTPException(status_code=500, detail="Anomaly detection failed")


@router.get("/overview")
async def intelligence_overview(
    key_data: CacheData = Depends(api_key_dependency),
):
    """
    Intelligence overview for dashboard:
    - Recent anomalies
    - Cost insights (top models/projects, month-to-date)
    - Forecast (simple projection)
    - Security score (heuristic based on guardrails/settings)
    """
    org_id = key_data["organization_id"]
    month_start = _month_start_utc()

    async def _ensure_awaitable(value):
        if inspect.isawaitable(value):
            return await value
        return value

    anomalies, top_models, top_projects = await asyncio.gather(
        _ensure_awaitable(_fetch_anomalies(org_id)),
        _ensure_awaitable(_fetch_top_models(org_id, month_start)),
        _ensure_awaitable(_fetch_top_projects(org_id, month_start)),
    )

    month_cost_result = _fetch_month_cost(org_id, month_start)
    month_cost = await month_cost_result if inspect.isawaitable(month_cost_result) else month_cost_result
    forecast = _project_forecast(month_cost, month_start)
    security = await _security_score(org_id)

    return {
        "anomalies": anomalies,
        "cost_insights": {
            "top_models": top_models,
            "top_projects": top_projects,
            "month_to_date_cost_usd": round(month_cost, 2),
        },
        "forecast": forecast,
        "security_score": security,
    }


@router.patch("/anomalies/{anomaly_id}")
async def update_anomaly_status(
    anomaly_id: str,
    request: Request,
    status: str = Query(..., pattern="^(acknowledged|resolved|ignored)$")
):
    """
    Update anomaly status.
    
    Status transitions:
    - new → acknowledged (team is aware)
    - acknowledged → resolved (issue fixed)
    - any → ignored (false positive)
    """
    from fastapi import Request
    auth = await get_user_and_org_from_jwt(request)
    organization_id = auth["organization_id"]
    user_id = auth["user_id"]
    
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if status == "acknowledged":
        update_data["acknowledged_by"] = user_id
        update_data["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "resolved":
        update_data["resolved_by"] = user_id
        update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
    
    res = await resources.supabase.table("anomaly_alerts").update(
        update_data
    ).eq("id", anomaly_id).eq("organization_id", organization_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    
    return {"success": True, "anomaly": res.data[0]}


# ============================================================================
# COST INTELLIGENCE ENDPOINTS
# ============================================================================

@router.get("/cost-insights")
async def get_cost_insights(request: Request):
    """
    Get cost insights and optimization recommendations.
    
    Returns:
    - Current period spend summary
    - Cost trends (daily, weekly)
    - Top cost drivers (models, projects, agents)
    - Optimization opportunities
    """
    from fastapi import Request
    auth = await get_user_and_org_from_jwt(request)
    organization_id = auth["organization_id"]
    
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    try:
        # Get monthly spend
        month_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params={
                "select": "cost_usd,model,project_id",
                "organization_id": f"eq.{organization_id}",
                "created_at": f"gte.{month_ago.isoformat()}",
            },
            headers=get_supabase_headers(),
            timeout=15.0
        )
        
        if month_res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch cost data")
        
        logs = month_res.json()
        
        # Calculate insights
        total_cost = sum(float(r.get("cost_usd", 0) or 0) for r in logs)
        
        # Cost by model
        cost_by_model = {}
        for r in logs:
            model = r.get("model", "unknown")
            cost_by_model[model] = cost_by_model.get(model, 0) + float(r.get("cost_usd", 0) or 0)
        
        # Cost by project
        cost_by_project = {}
        for r in logs:
            project = r.get("project_id", "unknown")
            cost_by_project[project] = cost_by_project.get(project, 0) + float(r.get("cost_usd", 0) or 0)
        
        # Daily trend
        daily_costs = {}
        for r in logs:
            # Simplified date extraction
            date = r.get("created_at", "")[:10]
            daily_costs[date] = daily_costs.get(date, 0) + float(r.get("cost_usd", 0) or 0)
        
        # Generate recommendations
        recommendations = []
        
        # Recommendation: Model optimization
        expensive_models = {k: v for k, v in cost_by_model.items() if v > total_cost * 0.3}
        for model, cost in expensive_models.items():
            if "gpt-4" in model.lower():
                recommendations.append({
                    "type": "model_optimization",
                    "priority": "high",
                    "title": f"Consider GPT-3.5 for {model} tasks",
                    "description": f"{model} accounts for ${cost:.2f} ({cost/total_cost*100:.0f}% of spend). For simple tasks, GPT-3.5 is 10x cheaper.",
                    "potential_savings": cost * 0.8
                })
        
        # Recommendation: Budget alerts
        if total_cost > 100:
            recommendations.append({
                "type": "budget_control",
                "priority": "medium",
                "title": "Enable budget alerts",
                "description": f"At ${total_cost:.2f}/month, consider setting budget limits to prevent overspending.",
                "potential_savings": total_cost * 0.2
            })
        
        # Recommendation: Response caching
        if len(logs) > 1000:
            recommendations.append({
                "type": "caching",
                "priority": "medium",
                "title": "Enable response caching",
                "description": "With high request volume, caching identical requests can save 15-25% on costs.",
                "potential_savings": total_cost * 0.15
            })
        
        return {
            "summary": {
                "total_cost_30d": total_cost,
                "request_count_30d": len(logs),
                "avg_cost_per_request": total_cost / len(logs) if logs else 0
            },
            "cost_by_model": dict(sorted(cost_by_model.items(), key=lambda x: x[1], reverse=True)[:10]),
            "cost_by_project": dict(sorted(cost_by_project.items(), key=lambda x: x[1], reverse=True)[:10]),
            "daily_trend": dict(sorted(daily_costs.items())),
            "recommendations": recommendations,
            "potential_total_savings": sum(r.get("potential_savings", 0) for r in recommendations)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("get_cost_insights_failed", error=str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to generate cost insights")


@router.get("/spend-forecast")
async def get_spend_forecast(request: Request):
    """
    Get spend forecast for the current billing period.
    
    Uses historical data to predict end-of-period spend.
    """
    from fastapi import Request
    auth = await get_user_and_org_from_jwt(request)
    organization_id = auth["organization_id"]
    
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    days_elapsed = (now - month_start).days + 1
    days_in_month = 30  # Simplified
    
    try:
        # Get current month spend
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params={
                "select": "cost_usd",
                "organization_id": f"eq.{organization_id}",
                "created_at": f"gte.{month_start.isoformat()}",
            },
            headers=get_supabase_headers(),
            timeout=10.0
        )
        
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch spend data")
        
        logs = res.json()
        current_spend = sum(float(r.get("cost_usd", 0) or 0) for r in logs)
        
        # Linear projection
        daily_rate = current_spend / days_elapsed if days_elapsed > 0 else 0
        projected_spend = daily_rate * days_in_month
        
        # Confidence interval (simple estimate)
        variance_factor = 0.2  # 20% variance
        low_estimate = projected_spend * (1 - variance_factor)
        high_estimate = projected_spend * (1 + variance_factor)
        
        return {
            "current_spend": current_spend,
            "days_elapsed": days_elapsed,
            "daily_rate": daily_rate,
            "forecast": {
                "projected": projected_spend,
                "low_estimate": low_estimate,
                "high_estimate": high_estimate,
                "confidence": "medium"
            },
            "days_remaining": days_in_month - days_elapsed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("get_spend_forecast_failed", error=str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to generate forecast")


# ============================================================================
# SECURITY INTELLIGENCE
# ============================================================================

@router.get("/security-score")
async def get_security_score(request: Request):
    """
    Get organization's security score.
    
    Heuristic only; not a certification. Evaluates budgets, DLP, privacy
    mode, key rotation age, and rate limits. Outputs are estimates only.
    """
    from fastapi import Request
    auth = await get_user_and_org_from_jwt(request)
    organization_id = auth["organization_id"]
    
    try:
        score = await _security_score(organization_id)
        return {
            **score,
            "estimates_only": True,
        }
    except Exception as e:
        log.error("get_security_score_failed", error=str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to calculate security score")


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def intelligence_health():
    """Intelligence subsystem health check."""
    return {
        "status": "healthy",
        "subsystem": "intelligence",
        "version": "1.0.0",
        "features": [
            "anomaly_detection",
            "cost_insights",
            "spend_forecast",
            "security_score"
        ]
    }
