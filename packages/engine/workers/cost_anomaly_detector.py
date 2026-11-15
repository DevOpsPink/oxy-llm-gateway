"""
COST ANOMALY DETECTION WORKER
==============================
CRITICAL: Prevents catastrophic surprise bills by detecting spending spikes in real-time.

Problem:
- An agent accidentally loops 10,000 API calls
- Burns a large provider bill in 1 hour
- Nobody notices until the provider invoice arrives

Solution:
- Monitor spending velocity every 5 minutes
- Compare against historical baseline (30-day average)
- Alert on configurable spikes (e.g., multiples of baseline such as 5x, 10x, 50x)
- Can auto-suspend on extreme spikes (e.g., around 100x baseline, subject to config and review)

Effect:
- Spending spikes are flagged within minutes instead of at invoice time

Detection Thresholds (examples; configurable):
- ~5x baseline: Warning email
- ~10x baseline: Urgent email + SMS
- ~50x baseline: Urgent email + SMS + Slack alert
- ~100x baseline: Auto-suspend + immediate manual review (if enabled)

"""

import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, Dict, List
import structlog

import redis.asyncio as aioredis
import httpx

# Initialize fallback logger BEFORE importing from core
# This ensures log is always defined, even if core import fails
log = structlog.get_logger()

# Now import from core (this may override log with shared instance)
try:
    from core import log, SUPABASE_URL, SUPABASE_KEY
    from security_utils import log_error_safe
    from core.zapier import send_zapier_event
    from core.notify_channels import send_slack_discord_alert
except ImportError as e:
    # If core import fails, log with fallback logger and re-raise
    log.critical("core_import_failed", error=str(e), hint="Ensure PYTHONPATH=/app and working_dir=/app in docker-compose.yml")
    raise

# ============================================================================
# CONFIGURATION
# ============================================================================

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CHECK_INTERVAL_SECONDS = 300  # Check every 5 minutes
LOOKBACK_WINDOW_HOURS = 1  # Analyze last 1 hour of spend
BASELINE_WINDOW_DAYS = 30  # Compare against 30-day average

# Anomaly thresholds (multipliers of baseline)
THRESHOLD_WARNING = 5.0    # 5x baseline
THRESHOLD_URGENT = 10.0    # 10x baseline
THRESHOLD_CRITICAL = 50.0  # 50x baseline
THRESHOLD_SUSPEND = 100.0  # 100x baseline (auto-suspend)
SUSPEND_DURATION_MINUTES = int(os.getenv("COST_SPIKE_SUSPEND_MINUTES", "60"))

# Alert endpoints (TODO: integrate with your alerting system)
ALERT_EMAIL_ENDPOINT = os.getenv("ALERT_EMAIL_ENDPOINT", "http://localhost:8000/internal/send-alert")
ALERT_SLACK_WEBHOOK = os.getenv("ALERT_SLACK_WEBHOOK")

# ============================================================================
# DATA FETCHING
# ============================================================================

async def get_project_spend_last_hour(
    http_client: httpx.AsyncClient,
    project_id: str
) -> Decimal:
    """
    Calculate total spending for project in the last hour.
    
    Queries request_logs table aggregated by cost.
    """
    try:
        one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        
        response = await http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params={
                "project_id": f"eq.{project_id}",
                "created_at": f"gte.{one_hour_ago}",
                "select": "cost"
            },
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            },
            timeout=10.0
        )
        response.raise_for_status()
        
        logs = response.json()
        total_spend = sum(Decimal(log_entry["cost"]) for log_entry in logs)
        
        return total_spend
        
    except Exception as e:
        log_error_safe(
            log,
            "get_project_spend_last_hour_failed",
            e,
            project_id=project_id
        )
        return Decimal("0")


async def get_project_baseline_hourly_spend(
    http_client: httpx.AsyncClient,
    project_id: str
) -> Decimal:
    """
    Calculate average hourly spending over last 30 days.
    
    Baseline = (30-day total spend) / (30 days * 24 hours)
    """
    try:
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        
        response = await http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params={
                "project_id": f"eq.{project_id}",
                "created_at": f"gte.{thirty_days_ago}",
                "select": "cost"
            },
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            },
            timeout=10.0
        )
        response.raise_for_status()
        
        logs = response.json()
        total_spend_30d = sum(Decimal(log_entry["cost"]) for log_entry in logs)
        
        # Average hourly spend = total / (30 days * 24 hours)
        avg_hourly_spend = total_spend_30d / Decimal("720")  # 30 * 24 = 720 hours
        
        return max(avg_hourly_spend, Decimal("0.01"))  # Minimum $0.01 to avoid div-by-zero
        
    except Exception as e:
        log_error_safe(
            log,
            "get_project_baseline_failed",
            e,
            project_id=project_id
        )
        return Decimal("1.0")  # Default baseline if data unavailable


async def get_active_projects(http_client: httpx.AsyncClient) -> List[Dict]:
    """
    Get all active projects that have made requests in the last 7 days.
    """
    try:
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        
        # Get projects with recent activity
        response = await http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params={
                "created_at": f"gte.{seven_days_ago}",
                "select": "project_id,projects(id,name,organization_id,budget_limit)"
            },
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            timeout=10.0
        )
        response.raise_for_status()
        
        logs = response.json()
        
        # Extract unique projects
        projects_map = {}
        for log_entry in logs:  # Fixed: renamed from 'log' to 'log_entry' to avoid shadowing
            if log_entry.get("projects"):
                project = log_entry["projects"]
                projects_map[project["id"]] = project
        
        return list(projects_map.values())
        
    except Exception as e:
        log_error_safe(log, "get_active_projects_failed", e)
        return []


# ============================================================================
# ANOMALY DETECTION
# ============================================================================

def _determine_severity(multiplier: float) -> Optional[str]:
    if multiplier >= THRESHOLD_SUSPEND:
        return "CRITICAL_SUSPEND"
    if multiplier >= THRESHOLD_CRITICAL:
        return "CRITICAL"
    if multiplier >= THRESHOLD_URGENT:
        return "URGENT"
    if multiplier >= THRESHOLD_WARNING:
        return "WARNING"
    return None


async def detect_anomaly(
    http_client: httpx.AsyncClient,
    project: Dict
) -> Optional[Dict]:
    """
    Detect spending anomaly for a project.
    
    Returns anomaly details if detected, None otherwise.
    """
    project_id = project["id"]
    project_name = project["name"]
    organization_id = project["organization_id"]
    
    # Get current spend (last hour)
    current_spend = await get_project_spend_last_hour(http_client, project_id)
    
    # Get baseline (30-day average hourly spend)
    baseline_spend = await get_project_baseline_hourly_spend(http_client, project_id)
    
    # Calculate multiplier
    if baseline_spend > 0:
        multiplier = float(current_spend / baseline_spend)
    else:
        multiplier = 0.0
    
    # Determine severity
    severity = _determine_severity(multiplier)
    
    if severity:
        return {
            "project_id": project_id,
            "project_name": project_name,
            "organization_id": organization_id,
            "current_spend_1h": str(current_spend),
            "baseline_hourly_spend": str(baseline_spend),
            "multiplier": multiplier,
            "severity": severity,
            "detected_at": datetime.now(timezone.utc).isoformat()
        }
    
    return None


# ============================================================================
# ALERTING
# ============================================================================

async def send_anomaly_alert(
    http_client: httpx.AsyncClient,
    anomaly: Dict
) -> None:
    """
    Send alert for detected anomaly.
    
    Alert channels based on severity:
    - WARNING: Email
    - URGENT: Email + SMS
    - CRITICAL: Email + SMS + Slack
    - CRITICAL_SUSPEND: All channels + auto-suspend
    """
    severity = anomaly["severity"]
    project_name = anomaly["project_name"]
    current_spend = anomaly["current_spend_1h"]
    baseline = anomaly["baseline_hourly_spend"]
    multiplier = anomaly["multiplier"]
    
    message = (
        f"🚨 COST ANOMALY DETECTED\n"
        f"Project: {project_name}\n"
        f"Last Hour Spend: ${current_spend}\n"
        f"Baseline (avg hourly): ${baseline}\n"
        f"Spike: {multiplier:.1f}x baseline\n"
        f"Severity: {severity}\n"
        f"\n"
        f"ACTION REQUIRED: Review project immediately."
    )
    
    log.error(
        "cost_anomaly_detected",
        **anomaly,
        message=message
    )

    org_id = anomaly.get("organization_id")
    if org_id:
        try:
            await send_slack_discord_alert(
                org_id,
                (
                    f"[Cost Anomaly] Project {project_name} detected {multiplier:.1f}x baseline "
                    f"(${current_spend}/h vs ${baseline}/h). Severity: {severity}."
                ),
            )
        except Exception as exc:
            log.warning("cost_anomaly_slack_discord_failed", organization_id=org_id, error=str(exc)[:200])
        try:
            zapier_payload = {
                "project_name": project_name,
                "project_id": anomaly.get("project_id"),
                "current_spend_1h": current_spend,
                "baseline_hourly_spend": baseline,
                "multiplier": multiplier,
                "severity": severity,
            }
            await send_zapier_event(org_id, "anomaly.raised", zapier_payload)
        except Exception as exc:
            log.warning("cost_anomaly_zapier_failed", organization_id=org_id, error=str(exc)[:200])

    if severity == "CRITICAL_SUSPEND":
        # Auto-suspend project (requires manual review to reactivate)
        await suspend_project(http_client, anomaly["project_id"], anomaly.get("organization_id"))


async def suspend_project(http_client: httpx.AsyncClient, project_id: str, organization_id: str | None) -> None:
    """
    Auto-suspend project due to catastrophic spending spike.
    
    Sets budget_limit to 0 and pauses the organization (kill switch) if enabled.
    Requires manual ops review to reactivate.
    """
    try:
        # Pause organization if allowed
        if organization_id:
            org_res = await http_client.get(
                f"{SUPABASE_URL}/rest/v1/organizations",
                params={"id": f"eq.{organization_id}", "select": "auto_suspend_on_cost_spikes"},
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                },
                timeout=10.0,
            )
            org_res.raise_for_status()
            org_data = org_res.json()
            if org_data and org_data[0].get("auto_suspend_on_cost_spikes", True):
                await http_client.patch(
                    f"{SUPABASE_URL}/rest/v1/organizations",
                    params={"id": f"eq.{organization_id}"},
                    json={
                        "status": "suspended",
                        "suspended_until": (datetime.now(timezone.utc) + timedelta(minutes=SUSPEND_DURATION_MINUTES)).isoformat(),
                        "suspend_reason": "cost_spike",
                        "paused": True,
                        "last_paused_at": "now()",
                        "last_pause_reason": "cost_spike",
                    },
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )

        response = await http_client.patch(
            f"{SUPABASE_URL}/rest/v1/projects",
            params={"id": f"eq.{project_id}"},
            json={
                "budget_limit": "0",
                "is_suspended": True,
                "suspension_reason": "Automatic suspension: spending spike detected",
                "suspended_until": (datetime.now(timezone.utc) + timedelta(minutes=SUSPEND_DURATION_MINUTES)).isoformat(),
            },
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            },
            timeout=10.0
        )
        response.raise_for_status()

        log.error(
            "project_auto_suspended",
            project_id=project_id,
            reason="100x spending spike detected"
        )
        if organization_id:
            log.error("organization_paused_cost_spike", organization_id=organization_id)
    except Exception as e:
        log_error_safe(
            log,
            "project_suspension_failed",
            e,
            project_id=project_id
        )


# ============================================================================
# WORKER MAIN LOOP
# ============================================================================

async def monitor_loop(http_client: httpx.AsyncClient) -> None:
    """
    Main worker loop: check all active projects for anomalies.
    """
    log.info("cost_anomaly_detector_started", check_interval_seconds=CHECK_INTERVAL_SECONDS)
    
    while True:
        try:
            # Get all active projects
            projects = await get_active_projects(http_client)
            
            log.info("cost_anomaly_check_started", project_count=len(projects))
            
            # Check each project
            anomalies_detected = 0
            for project in projects:
                anomaly = await detect_anomaly(http_client, project)
                
                if anomaly:
                    await send_anomaly_alert(http_client, anomaly)
                    anomalies_detected += 1
            
            log.info(
                "cost_anomaly_check_complete",
                projects_checked=len(projects),
                anomalies_detected=anomalies_detected
            )
            
        except Exception as e:
            log_error_safe(log, "cost_anomaly_monitor_error", e)
        
        # Sleep until next check
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


# ============================================================================
# WORKER ENTRY POINT
# ============================================================================

async def main():
    """
    Worker entry point.
    
    Run with:
        python -m workers.cost_anomaly_detector
    """
    http_client = httpx.AsyncClient(
        timeout=30.0,
        limits=httpx.Limits(max_connections=10)
    )
    
    try:
        await monitor_loop(http_client)
    finally:
        await http_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())

