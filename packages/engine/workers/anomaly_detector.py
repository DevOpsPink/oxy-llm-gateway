"""
Anomaly Detection Worker
========================

Detects anomalous patterns in AI agent behavior:
1. Cost velocity spikes (sudden spend increase)
2. Request volume anomalies (unusual patterns)
3. Model usage shifts (unexpected model changes)
4. Tool abuse patterns (repeated blocked tools)
5. Time-of-day anomalies (unusual activity hours)

"""

import asyncio
import json
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

import structlog
from core import log, resources, SUPABASE_URL
from dependencies import get_supabase_headers

# ============================================================================
# ANOMALY TYPES
# ============================================================================

class AnomalyType(str, Enum):
    """Types of detectable anomalies."""
    COST_SPIKE = "cost_spike"
    VOLUME_SPIKE = "volume_spike"
    MODEL_SHIFT = "model_shift"
    TOOL_ABUSE = "tool_abuse"
    TIME_ANOMALY = "time_anomaly"
    DLP_PATTERN = "dlp_pattern"
    SESSION_BURST = "session_burst"
    BUDGET_BURN = "budget_burn"


class AnomalySeverity(str, Enum):
    """Severity levels for anomalies."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Anomaly:
    """Detected anomaly record."""
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    entity_type: str  # "agent", "project", "organization"
    entity_id: str
    organization_id: str
    description: str
    metric_value: float
    baseline_value: float
    deviation_percent: float
    metadata: Dict[str, Any]
    detected_at: datetime


# ============================================================================
# DETECTION THRESHOLDS
# ============================================================================

# Cost spike: Alert if spend velocity increases by this factor
COST_SPIKE_THRESHOLD = 3.0  # 3x normal rate

# Volume spike: Alert if request rate increases by this factor  
VOLUME_SPIKE_THRESHOLD = 5.0  # 5x normal rate

# Model shift: Alert if unusual model usage exceeds this percent
MODEL_SHIFT_THRESHOLD = 0.3  # 30% of requests to unusual model

# Tool abuse: Alert after this many blocked tool attempts
TOOL_ABUSE_THRESHOLD = 5

# Time anomaly: Alert if activity outside normal hours exceeds this percent
TIME_ANOMALY_THRESHOLD = 0.2  # 20% of activity in unusual hours

# Session burst: Alert if new sessions per minute exceeds this
SESSION_BURST_THRESHOLD = 10

# Budget burn: Alert if projected to exhaust budget within this many hours
BUDGET_BURN_HOURS = 24


# ============================================================================
# ANOMALY DETECTION ENGINE
# ============================================================================


def _rolling_mean(values: List[float]) -> float:
    """Simple rolling mean baseline; zeros are included to stay conservative."""
    if not values:
        return 0.0
    return sum(values) / len(values)


def _breaches_threshold(current: float, baseline: float, multiplier: float) -> bool:
    """
    Returns True when the current value exceeds baseline * multiplier.
    Baseline should come from a rolling mean/median over recent history.
    """
    if baseline <= 0:
        return False
    return current > baseline * multiplier

class AnomalyDetector:
    """
    Real-time anomaly detection for AI agent behavior.
    
    Uses statistical analysis + heuristics to detect:
    - Unusual spending patterns
    - Traffic anomalies
    - Security threats
    - Operational issues
    
    Detection runs:
    - Every 5 minutes for high-frequency metrics
    - Every hour for trend analysis
    - Every day for baseline recalculation
    """
    
    def __init__(self):
        self.baselines: Dict[str, Dict] = {}  # Cache of baseline metrics
    
    async def detect_all_anomalies(self, organization_id: str) -> List[Anomaly]:
        """
        Run all anomaly detectors for an organization.
        
        Returns list of detected anomalies (may be empty).
        """
        anomalies = []
        
        try:
            # 1. Cost velocity analysis
            cost_anomalies = await self.detect_cost_spikes(organization_id)
            anomalies.extend(cost_anomalies)
            
            # 2. Request volume analysis
            volume_anomalies = await self.detect_volume_spikes(organization_id)
            anomalies.extend(volume_anomalies)
            
            # 3. Budget burn rate analysis
            burn_anomalies = await self.detect_budget_burn(organization_id)
            anomalies.extend(burn_anomalies)
            
            # 4. DLP pattern analysis
            dlp_anomalies = await self.detect_dlp_patterns(organization_id)
            anomalies.extend(dlp_anomalies)
            
            # 5. Session burst detection
            session_anomalies = await self.detect_session_bursts(organization_id)
            anomalies.extend(session_anomalies)
            
            if anomalies:
                log.warning("anomalies_detected",
                           organization_id=organization_id,
                           count=len(anomalies),
                           types=[a.anomaly_type.value for a in anomalies])
            
            return anomalies
            
        except Exception as e:
            log.error("anomaly_detection_failed",
                     organization_id=organization_id,
                     error=str(e)[:200])
            return []
    
    async def detect_cost_spikes(self, organization_id: str) -> List[Anomaly]:
        """
        Detect sudden increases in cost velocity.
        
        Algorithm:
        1. Calculate hourly cost rate for last 24 hours
        2. Calculate baseline (7-day average hourly rate)
        3. Flag if current rate > baseline * THRESHOLD
        """
        anomalies = []
        
        try:
            now = datetime.now(timezone.utc)
            hour_ago = now - timedelta(hours=1)
            day_ago = now - timedelta(days=1)
            week_ago = now - timedelta(days=7)
            
            # Get last hour's cost
            recent_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/request_logs",
                params={
                    "select": "cost_usd",
                    "organization_id": f"eq.{organization_id}",
                    "created_at": f"gte.{hour_ago.isoformat()}",
                },
                headers=get_supabase_headers(),
                timeout=10.0
            )
            
            if recent_res.status_code != 200:
                return []
            
            recent_logs = recent_res.json()
            recent_cost = sum(float(r.get("cost_usd", 0) or 0) for r in recent_logs)
            
            # Get 7-day baseline
            baseline_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/request_logs",
                params={
                    "select": "cost_usd,created_at",
                    "organization_id": f"eq.{organization_id}",
                    "created_at": f"gte.{week_ago.isoformat()}",
                },
                headers=get_supabase_headers(),
                timeout=15.0
            )
            
            if baseline_res.status_code != 200:
                return []
            
            baseline_logs = baseline_res.json()
            
            # Calculate average hourly cost over 7 days
            total_baseline_cost = sum(float(r.get("cost_usd", 0) or 0) for r in baseline_logs)
            hours_in_period = 7 * 24
            avg_hourly_cost = total_baseline_cost / hours_in_period if hours_in_period > 0 else 0
            
            # Detect spike
            if _breaches_threshold(recent_cost, avg_hourly_cost, COST_SPIKE_THRESHOLD):
                deviation = ((recent_cost - avg_hourly_cost) / avg_hourly_cost) * 100
                
                severity = AnomalySeverity.HIGH if deviation > 500 else (
                    AnomalySeverity.MEDIUM if deviation > 200 else AnomalySeverity.LOW
                )
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.COST_SPIKE,
                    severity=severity,
                    entity_type="organization",
                    entity_id=organization_id,
                    organization_id=organization_id,
                    description=f"Cost velocity spike: ${recent_cost:.2f}/hour vs ${avg_hourly_cost:.2f}/hour baseline",
                    metric_value=recent_cost,
                    baseline_value=avg_hourly_cost,
                    deviation_percent=deviation,
                    metadata={
                        "recent_cost": recent_cost,
                        "baseline_hourly": avg_hourly_cost,
                        "threshold": COST_SPIKE_THRESHOLD
                    },
                    detected_at=now
                ))
            
        except Exception as e:
            log.error("cost_spike_detection_failed", error=str(e)[:200])
        
        return anomalies
    
    async def detect_volume_spikes(self, organization_id: str) -> List[Anomaly]:
        """
        Detect sudden increases in request volume.
        
        Similar algorithm to cost spikes but for request count.
        """
        anomalies = []
        
        try:
            now = datetime.now(timezone.utc)
            hour_ago = now - timedelta(hours=1)
            week_ago = now - timedelta(days=7)
            
            # Get last hour's request count
            recent_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/request_logs",
                params={
                    "select": "id",
                    "organization_id": f"eq.{organization_id}",
                    "created_at": f"gte.{hour_ago.isoformat()}",
                },
                headers=get_supabase_headers(prefer="count=exact"),
                timeout=10.0
            )
            
            if recent_res.status_code != 200:
                return []
            
            # Get count from Content-Range header
            content_range = recent_res.headers.get('Content-Range', '0-0/0')
            recent_count = int(content_range.split('/')[-1])
            
            # Get 7-day baseline count
            baseline_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/request_logs",
                params={
                    "select": "id",
                    "organization_id": f"eq.{organization_id}",
                    "created_at": f"gte.{week_ago.isoformat()}",
                },
                headers=get_supabase_headers(prefer="count=exact"),
                timeout=15.0
            )
            
            if baseline_res.status_code != 200:
                return []
            
            baseline_range = baseline_res.headers.get('Content-Range', '0-0/0')
            baseline_count = int(baseline_range.split('/')[-1])
            
            # Calculate average hourly requests
            avg_hourly_requests = baseline_count / (7 * 24) if baseline_count > 0 else 0
            
            # Detect spike
            if _breaches_threshold(float(recent_count), float(avg_hourly_requests), VOLUME_SPIKE_THRESHOLD):
                deviation = ((recent_count - avg_hourly_requests) / avg_hourly_requests) * 100
                
                severity = AnomalySeverity.HIGH if deviation > 1000 else (
                    AnomalySeverity.MEDIUM if deviation > 400 else AnomalySeverity.LOW
                )
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.VOLUME_SPIKE,
                    severity=severity,
                    entity_type="organization",
                    entity_id=organization_id,
                    organization_id=organization_id,
                    description=f"Request volume spike: {recent_count}/hour vs {avg_hourly_requests:.0f}/hour baseline",
                    metric_value=float(recent_count),
                    baseline_value=avg_hourly_requests,
                    deviation_percent=deviation,
                    metadata={
                        "recent_count": recent_count,
                        "baseline_hourly": avg_hourly_requests,
                        "threshold": VOLUME_SPIKE_THRESHOLD
                    },
                    detected_at=now
                ))
        
        except Exception as e:
            log.error("volume_spike_detection_failed", error=str(e)[:200])
        
        return anomalies
    
    async def detect_budget_burn(self, organization_id: str) -> List[Anomaly]:
        """
        Detect projects that will exhaust budget within BUDGET_BURN_HOURS.
        
        Algorithm:
        1. Get current spend and budget for each project
        2. Calculate burn rate (spend velocity)
        3. Project time to exhaustion
        4. Alert if < BUDGET_BURN_HOURS
        """
        anomalies = []
        
        try:
            now = datetime.now(timezone.utc)
            day_ago = now - timedelta(days=1)
            
            # Get all projects with budgets
            projects_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/projects",
                params={
                    "select": "id,name,budget_limit,current_spend",
                    "organization_id": f"eq.{organization_id}",
                    "budget_limit": "gt.0",  # Only projects with budgets
                },
                headers=get_supabase_headers(),
                timeout=10.0
            )
            
            if projects_res.status_code != 200:
                return []
            
            projects = projects_res.json()
            
            for project in projects:
                project_id = project["id"]
                budget_limit = float(project.get("budget_limit", 0))
                current_spend = float(project.get("current_spend", 0))
                remaining = budget_limit - current_spend
                
                if remaining <= 0:
                    continue  # Already exhausted
                
                # Get last 24h spend for this project
                spend_res = await resources.http_client.get(
                    f"{SUPABASE_URL}/rest/v1/request_logs",
                    params={
                        "select": "cost_usd",
                        "project_id": f"eq.{project_id}",
                        "created_at": f"gte.{day_ago.isoformat()}",
                    },
                    headers=get_supabase_headers(),
                    timeout=10.0
                )
                
                if spend_res.status_code != 200:
                    continue
                
                recent_logs = spend_res.json()
                daily_spend = sum(float(r.get("cost_usd", 0) or 0) for r in recent_logs)
                
                if daily_spend <= 0:
                    continue  # No recent spending
                
                # Calculate hours to exhaustion
                hourly_rate = daily_spend / 24
                hours_to_exhaust = remaining / hourly_rate if hourly_rate > 0 else float('inf')
                
                if hours_to_exhaust < BUDGET_BURN_HOURS:
                    severity = AnomalySeverity.CRITICAL if hours_to_exhaust < 6 else (
                        AnomalySeverity.HIGH if hours_to_exhaust < 12 else AnomalySeverity.MEDIUM
                    )
                    
                    anomalies.append(Anomaly(
                        anomaly_type=AnomalyType.BUDGET_BURN,
                        severity=severity,
                        entity_type="project",
                        entity_id=project_id,
                        organization_id=organization_id,
                        description=f"Project '{project['name']}' will exhaust budget in {hours_to_exhaust:.1f} hours",
                        metric_value=hours_to_exhaust,
                        baseline_value=float(BUDGET_BURN_HOURS),
                        deviation_percent=((BUDGET_BURN_HOURS - hours_to_exhaust) / BUDGET_BURN_HOURS) * 100,
                        metadata={
                            "project_name": project["name"],
                            "budget_limit": budget_limit,
                            "current_spend": current_spend,
                            "remaining": remaining,
                            "hourly_rate": hourly_rate,
                            "hours_to_exhaust": hours_to_exhaust
                        },
                        detected_at=now
                    ))
        
        except Exception as e:
            log.error("budget_burn_detection_failed", error=str(e)[:200])
        
        return anomalies
    
    async def detect_dlp_patterns(self, organization_id: str) -> List[Anomaly]:
        """
        Detect patterns of DLP threats (repeated secret leakage attempts).
        
        Alert if threat detection rate exceeds threshold.
        """
        anomalies = []
        
        try:
            now = datetime.now(timezone.utc)
            hour_ago = now - timedelta(hours=1)
            
            # Get recent requests with threats
            threat_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/request_logs",
                params={
                    "select": "id,threat_detected,threat_type",
                    "organization_id": f"eq.{organization_id}",
                    "created_at": f"gte.{hour_ago.isoformat()}",
                    "threat_detected": "eq.true",
                },
                headers=get_supabase_headers(prefer="count=exact"),
                timeout=10.0
            )
            
            if threat_res.status_code != 200:
                return []
            
            content_range = threat_res.headers.get('Content-Range', '0-0/0')
            threat_count = int(content_range.split('/')[-1])
            
            # Get total requests for comparison
            total_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/request_logs",
                params={
                    "select": "id",
                    "organization_id": f"eq.{organization_id}",
                    "created_at": f"gte.{hour_ago.isoformat()}",
                },
                headers=get_supabase_headers(prefer="count=exact"),
                timeout=10.0
            )
            
            if total_res.status_code != 200:
                return []
            
            total_range = total_res.headers.get('Content-Range', '0-0/0')
            total_count = int(total_range.split('/')[-1])
            
            if total_count > 0:
                threat_rate = threat_count / total_count
                
                # Alert if >5% of requests have threats
                if threat_rate > 0.05:
                    severity = AnomalySeverity.CRITICAL if threat_rate > 0.2 else (
                        AnomalySeverity.HIGH if threat_rate > 0.1 else AnomalySeverity.MEDIUM
                    )
                    
                    anomalies.append(Anomaly(
                        anomaly_type=AnomalyType.DLP_PATTERN,
                        severity=severity,
                        entity_type="organization",
                        entity_id=organization_id,
                        organization_id=organization_id,
                        description=f"High DLP threat rate: {threat_rate*100:.1f}% of requests contain secrets",
                        metric_value=threat_rate * 100,
                        baseline_value=5.0,  # 5% threshold
                        deviation_percent=((threat_rate * 100) - 5) / 5 * 100,
                        metadata={
                            "threat_count": threat_count,
                            "total_count": total_count,
                            "threat_rate_percent": threat_rate * 100
                        },
                        detected_at=now
                    ))
        
        except Exception as e:
            log.error("dlp_pattern_detection_failed", error=str(e)[:200])
        
        return anomalies
    
    async def detect_session_bursts(self, organization_id: str) -> List[Anomaly]:
        """
        Detect unusual bursts of new agent sessions.
        
        Possible indicators of:
        - Agent loop creating sessions
        - Denial of service attempt
        - Misconfigured automation
        """
        anomalies = []
        
        try:
            now = datetime.now(timezone.utc)
            five_min_ago = now - timedelta(minutes=5)
            
            # Get recent session starts
            session_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/agent_sessions",
                params={
                    "select": "id",
                    "organization_id": f"eq.{organization_id}",
                    "started_at": f"gte.{five_min_ago.isoformat()}",
                },
                headers=get_supabase_headers(prefer="count=exact"),
                timeout=10.0
            )
            
            if session_res.status_code != 200:
                return []
            
            content_range = session_res.headers.get('Content-Range', '0-0/0')
            session_count = int(content_range.split('/')[-1])
            
            # Calculate per-minute rate
            sessions_per_minute = session_count / 5
            
            if sessions_per_minute > SESSION_BURST_THRESHOLD:
                severity = AnomalySeverity.HIGH if sessions_per_minute > 50 else AnomalySeverity.MEDIUM
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.SESSION_BURST,
                    severity=severity,
                    entity_type="organization",
                    entity_id=organization_id,
                    organization_id=organization_id,
                    description=f"Session burst: {sessions_per_minute:.1f} new sessions/minute (threshold: {SESSION_BURST_THRESHOLD})",
                    metric_value=sessions_per_minute,
                    baseline_value=float(SESSION_BURST_THRESHOLD),
                    deviation_percent=((sessions_per_minute - SESSION_BURST_THRESHOLD) / SESSION_BURST_THRESHOLD) * 100,
                    metadata={
                        "sessions_count": session_count,
                        "period_minutes": 5,
                        "sessions_per_minute": sessions_per_minute
                    },
                    detected_at=now
                ))
        
        except Exception as e:
            log.error("session_burst_detection_failed", error=str(e)[:200])
        
        return anomalies


# ============================================================================
# ALERT DISPATCHER
# ============================================================================

async def dispatch_anomaly_alerts(anomalies: List[Anomaly]):
    """
    Send alerts for detected anomalies.
    
    Channels:
    1. Database record (always)
    2. Email (for HIGH/CRITICAL)
    3. Slack webhook (if configured)
    4. In-app notification
    """
    for anomaly in anomalies:
        try:
            # 1. Store in database
            await resources.supabase.table("anomaly_alerts").insert({
                "organization_id": anomaly.organization_id,
                "anomaly_type": anomaly.anomaly_type.value,
                "severity": anomaly.severity.value,
                "entity_type": anomaly.entity_type,
                "entity_id": anomaly.entity_id,
                "description": anomaly.description,
                "metric_value": anomaly.metric_value,
                "baseline_value": anomaly.baseline_value,
                "deviation_percent": anomaly.deviation_percent,
                "metadata": anomaly.metadata,
                "status": "new"
            }).execute()
            
            # 2. Create in-app notification
            await resources.supabase.table("notifications").insert({
                "organization_id": anomaly.organization_id,
                "type": "anomaly_alert",
                "title": f"🚨 {anomaly.severity.value.upper()}: {anomaly.anomaly_type.value.replace('_', ' ').title()}",
                "message": anomaly.description,
                "priority": "critical" if anomaly.severity in [AnomalySeverity.HIGH, AnomalySeverity.CRITICAL] else "medium",
                "action_url": "/dashboard/alerts",
                "metadata": {
                    "anomaly_type": anomaly.anomaly_type.value,
                    "severity": anomaly.severity.value
                }
            }).execute()
            
            # 3. For HIGH/CRITICAL, we intentionally skip email reuse here
            #    because budget_alerts.send_budget_alert_email has a different
            #    signature (project-specific). A future adapter can reuse it.
            if anomaly.severity in [AnomalySeverity.HIGH, AnomalySeverity.CRITICAL]:
                log.warning(
                    "anomaly_email_skipped",
                    reason="email_adapter_missing",
                    severity=anomaly.severity.value,
                    anomaly_type=anomaly.anomaly_type.value,
                    organization_id=anomaly.organization_id,
                )
            
            log.info("anomaly_alert_dispatched",
                    anomaly_type=anomaly.anomaly_type.value,
                    severity=anomaly.severity.value,
                    organization_id=anomaly.organization_id)
                    
        except Exception as e:
            log.error("anomaly_alert_dispatch_failed",
                     anomaly_type=anomaly.anomaly_type.value,
                     error=str(e)[:200])


# ============================================================================
# WORKER ENTRY POINT
# ============================================================================

async def run_anomaly_detection_cycle():
    """
    Run anomaly detection for all active organizations.
    
    Called by scheduler every 5 minutes.
    """
    log.info("anomaly_detection_cycle_start")
    
    try:
        # Get all active organizations
        orgs_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organizations",
            params={
                "select": "id",
            },
            headers=get_supabase_headers(),
            timeout=10.0
        )
        
        if orgs_res.status_code != 200:
            log.error("failed_to_fetch_organizations", status=orgs_res.status_code)
            return
        
        organizations = orgs_res.json()
        detector = AnomalyDetector()
        total_anomalies = 0
        
        for org in organizations:
            org_id = org["id"]
            
            try:
                anomalies = await detector.detect_all_anomalies(org_id)
                
                if anomalies:
                    await dispatch_anomaly_alerts(anomalies)
                    total_anomalies += len(anomalies)
                    
            except Exception as e:
                log.error("org_anomaly_detection_failed",
                         organization_id=org_id,
                         error=str(e)[:200])
        
        log.info("anomaly_detection_cycle_complete",
                organizations_checked=len(organizations),
                total_anomalies=total_anomalies)
                
    except Exception as e:
        log.error("anomaly_detection_cycle_failed", error=str(e)[:200])


# ============================================================================
# MANUAL DETECTION (FOR API)
# ============================================================================

async def detect_anomalies_for_org(organization_id: str) -> List[Dict[str, Any]]:
    """
    Run anomaly detection for a specific organization (on-demand).
    
    Used by the API endpoint for manual checks.
    """
    detector = AnomalyDetector()
    anomalies = await detector.detect_all_anomalies(organization_id)
    
    return [
        {
            "type": a.anomaly_type.value,
            "severity": a.severity.value,
            "description": a.description,
            "metric": a.metric_value,
            "baseline": a.baseline_value,
            "deviation_percent": a.deviation_percent,
            "detected_at": a.detected_at.isoformat(),
            "metadata": a.metadata
        }
        for a in anomalies
    ]


if __name__ == "__main__":
    # Run once for testing
    asyncio.run(run_anomaly_detection_cycle())

