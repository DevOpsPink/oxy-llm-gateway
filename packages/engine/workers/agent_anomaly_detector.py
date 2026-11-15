"""
Agent Anomaly Detection Worker
==============================

AI-powered detection of anomalous agent behavior.

Detects:
- Unusual request patterns (burst, sustained high volume)
- Abnormal tool usage (new tools, high-risk tools)
- Budget anomalies (rapid spending, unusual costs)
- Security threats (DLP violations, suspicious patterns)
- Session anomalies (long-running, stuck, looping)

Actions:
- Alert via email/webhook
- Auto-pause agent (if configured)
- Log for audit trail

"""

import asyncio
import json
import os
import hashlib
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from decimal import Decimal

import structlog
import httpx

# Initialize logger
log = structlog.get_logger()

# ============================================================================
# CONFIGURATION
# ============================================================================

# Thresholds (configurable via env)
BURST_THRESHOLD = int(os.getenv("ANOMALY_BURST_THRESHOLD", "50"))  # Requests per minute
SUSTAINED_THRESHOLD = int(os.getenv("ANOMALY_SUSTAINED_THRESHOLD", "500"))  # Requests per hour
TOOL_CALL_THRESHOLD = int(os.getenv("ANOMALY_TOOL_CALL_THRESHOLD", "100"))  # Tool calls per hour
BUDGET_SPIKE_THRESHOLD = float(os.getenv("ANOMALY_BUDGET_SPIKE_THRESHOLD", "50"))  # % increase
SESSION_TIMEOUT_HOURS = int(os.getenv("ANOMALY_SESSION_TIMEOUT_HOURS", "2"))
DLP_THRESHOLD = int(os.getenv("ANOMALY_DLP_THRESHOLD", "5"))  # Violations per hour
LOOP_WINDOW_SECONDS = int(os.getenv("LOOP_WINDOW_SECONDS", "10"))
LOOP_THRESHOLD = int(os.getenv("LOOP_THRESHOLD", "5"))
LOOP_SUSPEND_MINUTES_DEFAULT = int(os.getenv("LOOP_SUSPEND_MINUTES_DEFAULT", "60"))

# Alert configuration
ALERT_WEBHOOK_URL = os.getenv("ANOMALY_ALERT_WEBHOOK_URL")
ALERT_EMAIL_ENABLED = os.getenv("ANOMALY_ALERT_EMAIL_ENABLED", "false").lower() == "true"

# Auto-pause configuration
AUTO_PAUSE_ENABLED = os.getenv("ANOMALY_AUTO_PAUSE_ENABLED", "false").lower() == "true"


# ============================================================================
# ANOMALY TYPES
# ============================================================================

class AnomalyType:
    BURST_REQUESTS = "burst_requests"
    SUSTAINED_HIGH_VOLUME = "sustained_high_volume"
    TOOL_CALL_SPIKE = "tool_call_spike"
    HIGH_RISK_TOOL_USAGE = "high_risk_tool_usage"
    BUDGET_SPIKE = "budget_spike"
    BUDGET_EXCEEDED = "budget_exceeded"
    DLP_VIOLATIONS = "dlp_violations"
    STUCK_SESSION = "stuck_session"
    LOOPING_BEHAVIOR = "looping_behavior"
    UNKNOWN_TOOL = "unknown_tool"


class AnomalySeverity:
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ============================================================================
# ANOMALY DETECTOR
# ============================================================================

class AgentAnomalyDetector:
    """
    Detects anomalous behavior in AI agents.
    
    Uses statistical analysis and pattern matching to identify:
    - Volume anomalies (burst, sustained)
    - Cost anomalies (budget spikes)
    - Security anomalies (DLP, risky tools)
    - Behavior anomalies (stuck, looping)
    """
    
    def __init__(self, supabase_client, redis_client):
        self.supabase = supabase_client
        self.redis = redis_client
        self.log = log.bind(worker="agent_anomaly_detector")
    
    async def run_detection_cycle(self):
        """
        Run a full detection cycle across all agents.
        
        Called periodically by the scheduler.
        """
        if self.supabase is None:
            self.log.warning("supabase_not_configured", event_name="supabase_not_configured")
            return
        self.log.info("anomaly_detection_cycle_start")
        start_time = datetime.now(timezone.utc)
        
        anomalies_detected = []
        
        try:
            # Get all active agents
            agents = await self._get_active_agents()
            
            for agent in agents:
                agent_anomalies = await self._analyze_agent(agent)
                anomalies_detected.extend(agent_anomalies)
            
            # Check for stuck sessions (across all agents)
            stuck_sessions = await self._detect_stuck_sessions()
            anomalies_detected.extend(stuck_sessions)
            
            # Process anomalies
            for anomaly in anomalies_detected:
                await self._handle_anomaly(anomaly)
            
            duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            
            self.log.info("anomaly_detection_cycle_complete",
                         agents_analyzed=len(agents),
                         anomalies_found=len(anomalies_detected),
                         duration_ms=duration_ms)
            
        except Exception as e:
            self.log.error("anomaly_detection_cycle_failed", error=str(e)[:200])
    
    async def _get_active_agents(self) -> List[Dict]:
        """Get all active agents."""
        try:
            result = await self.supabase.table("agents").select(
                "id, name, organization_id, project_id, budget_limit, current_spend, "
                "total_requests, total_tool_calls, auto_suspend_on_loop, loop_suspend_duration_minutes, "
                "suspend_on_anomaly, anomaly_suspend_duration_minutes"
            ).eq("status", "active").execute()
            return result.data or []
        except Exception as e:
            self.log.error("get_active_agents_failed", error=str(e)[:200])
            return []
    
    async def _analyze_agent(self, agent: Dict) -> List[Dict]:
        """
        Analyze a single agent for anomalies.
        
        Returns list of detected anomalies.
        """
        anomalies = []
        agent_id = agent["id"]
        
        # 1. Check burst requests (last minute)
        burst = await self._check_burst_requests(agent_id)
        if burst:
            anomalies.append(burst)
        
        # 2. Check sustained high volume (last hour)
        sustained = await self._check_sustained_volume(agent_id)
        if sustained:
            anomalies.append(sustained)
        
        # 3. Check tool call spikes
        tool_spike = await self._check_tool_call_spike(agent_id)
        if tool_spike:
            anomalies.append(tool_spike)
        
        # 4. Check high-risk tool usage
        risky_tools = await self._check_high_risk_tools(agent_id)
        anomalies.extend(risky_tools)
        
        # 5. Check budget anomalies
        budget = await self._check_budget_anomaly(agent)
        if budget:
            anomalies.append(budget)
        
        # 6. Check DLP violations
        dlp = await self._check_dlp_violations(agent_id)
        if dlp:
            anomalies.append(dlp)

        # 7. Check looping behavior
        loop = await self._check_looping_behavior(agent)
        if loop:
            anomalies.append(loop)
        
        return anomalies

    @staticmethod
    def _normalize_prompt_text(text: str) -> str:
        """Lowercase, trim, collapse whitespace, strip obvious timestamps/IDs."""
        lowered = text.lower().strip()
        collapsed = re.sub(r"\s+", " ", lowered)
        collapsed = re.sub(r"\b\d{4}-\d{2}-\d{2}[tT ].*?\b", "", collapsed)
        return collapsed.strip()

    def _compute_loop_key(self, row: Dict) -> Optional[str]:
        """
        Build a loop key using org + agent + normalized prompt hash.
        Skip when prompt snapshot is unavailable (privacy modes).
        """
        org_id = row.get("organization_id") or row.get("org_id")
        agent_id = row.get("agent_id")
        if not agent_id and row.get("session_id"):
            agent_id = row.get("session_id")
        if not agent_id and row.get("project_id"):
            agent_id = row.get("project_id")
        if not org_id or not agent_id:
            return None

        privacy_mode = (row.get("privacy_mode") or "").lower()
        if privacy_mode == "zero_prompt_logging":
            return None

        prompt_raw = row.get("prompt_snapshot") or row.get("request_body") or ""
        if not prompt_raw:
            return None
        if isinstance(prompt_raw, dict):
            prompt_raw = json.dumps(prompt_raw, sort_keys=True)
        prompt_norm = self._normalize_prompt_text(str(prompt_raw))
        if not prompt_norm:
            return None
        prompt_hash = hashlib.sha256(prompt_norm.encode("utf-8")).hexdigest()[:16]
        return f"{org_id}:{agent_id}:{prompt_hash}"

    async def _check_looping_behavior(self, agent: Dict) -> Optional[Dict]:
        """
        Detect loops: N identical normalized prompts within M seconds for an agent.
        Uses Redis counters per loop key with TTL=window.
        """
        if not self.redis or not self.supabase:
            return None

        agent_id = agent["id"]
        org_id = agent.get("organization_id")
        window_cutoff = (datetime.now(timezone.utc) - timedelta(seconds=LOOP_WINDOW_SECONDS)).isoformat()

        try:
            rows = (
                await self.supabase.table("request_logs")
                .select(
                    "id,organization_id,agent_id,project_id,session_id,created_at,prompt_snapshot,privacy_mode,model"
                )
                .eq("agent_id", agent_id)
                .gte("created_at", window_cutoff)
                .order("created_at", desc=True)
                .limit(200)
                .execute()
            )
            logs = rows.data or []
        except Exception as e:
            self.log.error("loop_fetch_failed", agent_id=agent_id, error=str(e)[:200])
            return None

        for row in logs:
            key = self._compute_loop_key(row)
            if not key:
                continue
            try:
                redis_key = f"oxy:loop:{key}"
                count = await self.redis.incr(redis_key)
                await self.redis.expire(redis_key, LOOP_WINDOW_SECONDS)
                if count >= LOOP_THRESHOLD:
                    return {
                        "type": AnomalyType.LOOPING_BEHAVIOR,
                        "severity": AnomalySeverity.HIGH,
                        "agent_id": agent_id,
                        "details": {
                            "loop_key": key,
                            "threshold": LOOP_THRESHOLD,
                            "window_seconds": LOOP_WINDOW_SECONDS,
                            "count": int(count),
                        },
                        "message": f"Loop detected: {count} repeats in {LOOP_WINDOW_SECONDS}s (threshold {LOOP_THRESHOLD})",
                    }
            except Exception as e:
                self.log.error("loop_detection_failed", agent_id=agent_id, error=str(e)[:200])
                return None
        return None
    
    async def _check_burst_requests(self, agent_id: str) -> Optional[Dict]:
        """Check for burst request patterns (last minute)."""
        try:
            key = f"agent_requests:{agent_id}:minute"
            count = await self.redis.get(key)
            count = int(count) if count else 0
            
            if count >= BURST_THRESHOLD:
                return {
                    "type": AnomalyType.BURST_REQUESTS,
                    "severity": AnomalySeverity.HIGH,
                    "agent_id": agent_id,
                    "details": {
                        "requests_per_minute": count,
                        "threshold": BURST_THRESHOLD
                    },
                    "message": f"Burst detected: {count} requests/min (threshold: {BURST_THRESHOLD})"
                }
        except Exception as e:
            self.log.error("check_burst_failed", agent_id=agent_id, error=str(e)[:100])
        
        return None
    
    async def _check_sustained_volume(self, agent_id: str) -> Optional[Dict]:
        """Check for sustained high volume (last hour)."""
        try:
            # Query request logs for last hour
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            
            result = await self.supabase.table("request_logs").select(
                "id", count="exact"
            ).gte("created_at", one_hour_ago).execute()
            
            count = len(result.data or [])
            
            if count >= SUSTAINED_THRESHOLD:
                return {
                    "type": AnomalyType.SUSTAINED_HIGH_VOLUME,
                    "severity": AnomalySeverity.MEDIUM,
                    "agent_id": agent_id,
                    "details": {
                        "requests_per_hour": count,
                        "threshold": SUSTAINED_THRESHOLD
                    },
                    "message": f"Sustained high volume: {count} requests/hour"
                }
        except Exception as e:
            self.log.error("check_sustained_failed", agent_id=agent_id, error=str(e)[:100])
        
        return None
    
    async def _check_tool_call_spike(self, agent_id: str) -> Optional[Dict]:
        """Check for tool call spikes."""
        try:
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            
            # Get session IDs for this agent
            sessions = await self.supabase.table("agent_sessions").select("id").eq(
                "agent_id", agent_id
            ).execute()
            
            if not sessions.data:
                return None
            
            session_ids = [s["id"] for s in sessions.data]
            
            # Count tool calls
            result = await self.supabase.table("tool_call_logs").select(
                "id", count="exact"
            ).in_("agent_session_id", session_ids).gte(
                "started_at", one_hour_ago
            ).execute()
            
            count = len(result.data or [])
            
            if count >= TOOL_CALL_THRESHOLD:
                return {
                    "type": AnomalyType.TOOL_CALL_SPIKE,
                    "severity": AnomalySeverity.MEDIUM,
                    "agent_id": agent_id,
                    "details": {
                        "tool_calls_per_hour": count,
                        "threshold": TOOL_CALL_THRESHOLD
                    },
                    "message": f"Tool call spike: {count} calls/hour"
                }
        except Exception as e:
            self.log.error("check_tool_spike_failed", agent_id=agent_id, error=str(e)[:100])
        
        return None
    
    async def _check_high_risk_tools(self, agent_id: str) -> List[Dict]:
        """Check for high-risk tool usage."""
        anomalies = []
        
        try:
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            
            # Get recent tool calls
            result = await self.supabase.table("tool_call_logs").select(
                "tool_name, tool_id"
            ).gte("started_at", one_hour_ago).execute()
            
            if not result.data:
                return anomalies
            
            # Get tool risk levels
            tool_names = list(set([t["tool_name"] for t in result.data]))
            tools = await self.supabase.table("tools").select(
                "name, risk_level"
            ).in_("name", tool_names).execute()
            
            tool_risks = {t["name"]: t["risk_level"] for t in (tools.data or [])}
            
            # Check for high/critical risk tools
            for call in result.data:
                risk = tool_risks.get(call["tool_name"], "unknown")
                if risk in ["high", "critical"]:
                    anomalies.append({
                        "type": AnomalyType.HIGH_RISK_TOOL_USAGE,
                        "severity": AnomalySeverity.HIGH if risk == "critical" else AnomalySeverity.MEDIUM,
                        "agent_id": agent_id,
                        "details": {
                            "tool_name": call["tool_name"],
                            "risk_level": risk
                        },
                        "message": f"High-risk tool used: {call['tool_name']} ({risk})"
                    })
                    
        except Exception as e:
            self.log.error("check_high_risk_tools_failed", agent_id=agent_id, error=str(e)[:100])
        
        return anomalies
    
    async def _check_budget_anomaly(self, agent: Dict) -> Optional[Dict]:
        """Check for budget anomalies."""
        try:
            budget_limit = float(agent.get("budget_limit", 0))
            current_spend = float(agent.get("current_spend", 0))
            
            if budget_limit <= 0:
                return None
            
            usage_percent = (current_spend / budget_limit) * 100
            
            # Check if exceeded
            if usage_percent >= 100:
                return {
                    "type": AnomalyType.BUDGET_EXCEEDED,
                    "severity": AnomalySeverity.CRITICAL,
                    "agent_id": agent["id"],
                    "details": {
                        "budget_limit": budget_limit,
                        "current_spend": current_spend,
                        "usage_percent": usage_percent
                    },
                    "message": f"Budget exceeded: ${current_spend:.2f} / ${budget_limit:.2f} ({usage_percent:.1f}%)"
                }
            
            # Check for spike (using Redis to track previous values)
            prev_key = f"agent_budget:{agent['id']}:prev"
            prev_spend = await self.redis.get(prev_key)
            prev_spend = float(prev_spend) if prev_spend else 0
            
            if prev_spend > 0:
                increase_percent = ((current_spend - prev_spend) / prev_spend) * 100
                
                if increase_percent >= BUDGET_SPIKE_THRESHOLD:
                    # Update stored value
                    await self.redis.set(prev_key, str(current_spend), ex=3600)
                    
                    return {
                        "type": AnomalyType.BUDGET_SPIKE,
                        "severity": AnomalySeverity.HIGH,
                        "agent_id": agent["id"],
                        "details": {
                            "previous_spend": prev_spend,
                            "current_spend": current_spend,
                            "increase_percent": increase_percent
                        },
                        "message": f"Budget spike: +{increase_percent:.1f}% in last hour"
                    }
            
            # Store current value
            await self.redis.set(prev_key, str(current_spend), ex=3600)
            
        except Exception as e:
            self.log.error("check_budget_anomaly_failed", agent_id=agent["id"], error=str(e)[:100])
        
        return None
    
    async def _check_dlp_violations(self, agent_id: str) -> Optional[Dict]:
        """Check for DLP violations."""
        try:
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            
            # Get sessions for agent
            sessions = await self.supabase.table("agent_sessions").select("id").eq(
                "agent_id", agent_id
            ).execute()
            
            if not sessions.data:
                return None
            
            session_ids = [s["id"] for s in sessions.data]
            
            # Count DLP violations
            result = await self.supabase.table("tool_call_logs").select(
                "id", count="exact"
            ).in_("agent_session_id", session_ids).eq(
                "threat_detected", True
            ).gte("started_at", one_hour_ago).execute()
            
            count = len(result.data or [])
            
            if count >= DLP_THRESHOLD:
                return {
                    "type": AnomalyType.DLP_VIOLATIONS,
                    "severity": AnomalySeverity.CRITICAL,
                    "agent_id": agent_id,
                    "details": {
                        "violations_per_hour": count,
                        "threshold": DLP_THRESHOLD
                    },
                    "message": f"Multiple DLP violations: {count} in last hour"
                }
                
        except Exception as e:
            self.log.error("check_dlp_violations_failed", agent_id=agent_id, error=str(e)[:100])
        
        return None
    
    async def _detect_stuck_sessions(self) -> List[Dict]:
        """Detect sessions that appear stuck or timed out."""
        anomalies = []
        
        try:
            timeout_cutoff = (datetime.now(timezone.utc) - timedelta(hours=SESSION_TIMEOUT_HOURS)).isoformat()
            
            # Find running sessions older than timeout
            result = await self.supabase.table("agent_sessions").select(
                "id, agent_id, started_at, total_requests"
            ).eq("status", "running").lt("started_at", timeout_cutoff).execute()
            
            for session in (result.data or []):
                anomalies.append({
                    "type": AnomalyType.STUCK_SESSION,
                    "severity": AnomalySeverity.HIGH,
                    "agent_id": session["agent_id"],
                    "session_id": session["id"],
                    "details": {
                        "started_at": session["started_at"],
                        "total_requests": session["total_requests"],
                        "timeout_hours": SESSION_TIMEOUT_HOURS
                    },
                    "message": f"Session appears stuck (running for {SESSION_TIMEOUT_HOURS}+ hours)"
                })
                
        except Exception as e:
            self.log.error("detect_stuck_sessions_failed", error=str(e)[:100])
        
        return anomalies
    
    async def _handle_anomaly(self, anomaly: Dict):
        """
        Handle a detected anomaly.
        
        Actions:
        1. Log for audit
        2. Send alert (webhook/email)
        3. Auto-pause if configured
        """
        self.log.warning("anomaly_detected",
                        type=anomaly["type"],
                        severity=anomaly["severity"],
                        agent_id=anomaly.get("agent_id"),
                        message=anomaly["message"])
        
        # 1. Log to database (audit trail)
        try:
            await self.supabase.table("audit_log").insert({
                "event_type": "anomaly_detected",
                "resource_type": "agent",
                "resource_id": anomaly.get("agent_id"),
                "action": anomaly["type"],
                "details": anomaly
            }).execute()
        except Exception as e:
            self.log.error("anomaly_audit_log_failed", error=str(e)[:100])
        
        # 2. Send webhook alert
        if ALERT_WEBHOOK_URL and anomaly["severity"] in [AnomalySeverity.HIGH, AnomalySeverity.CRITICAL]:
            await self._send_webhook_alert(anomaly)
        
        # 3. Auto-pause if configured and critical
        if AUTO_PAUSE_ENABLED and anomaly["severity"] == AnomalySeverity.CRITICAL:
            await self._auto_pause_agent(anomaly.get("agent_id"), reason="anomaly")
        if anomaly["type"] == AnomalyType.LOOPING_BEHAVIOR and anomaly.get("agent_id"):
            if agent := anomaly.get("agent_id"):
                await self._maybe_auto_suspend_loop(agent)
    
    async def _send_webhook_alert(self, anomaly: Dict):
        """Send alert via webhook."""
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    ALERT_WEBHOOK_URL,
                    json={
                        "type": "agent_anomaly",
                        "severity": anomaly["severity"],
                        "anomaly_type": anomaly["type"],
                        "agent_id": anomaly.get("agent_id"),
                        "message": anomaly["message"],
                        "details": anomaly["details"],
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    },
                    timeout=10.0
                )
                self.log.info("anomaly_webhook_sent", anomaly_type=anomaly["type"])
        except Exception as e:
            self.log.error("anomaly_webhook_failed", error=str(e)[:100])
    
    async def _auto_pause_agent(self, agent_id: str, reason: str = "anomaly"):
        """Auto-pause an agent due to critical anomaly."""
        if not agent_id:
            return
        
        try:
            await self.supabase.table("agents").update({
                "status": "suspended",
                "suspend_reason": reason
            }).eq("id", agent_id).execute()
            
            self.log.warning("agent_auto_paused", agent_id=agent_id)
        except Exception as e:
            self.log.error("agent_auto_pause_failed", agent_id=agent_id, error=str(e)[:100])

    async def _maybe_auto_suspend_loop(self, agent_id: str):
        """Auto-suspend for loop detection using existing status fields."""
        try:
            res = (
                await self.supabase.table("agents")
                .select("auto_suspend_on_loop, loop_suspend_duration_minutes")
                .eq("id", agent_id)
                .single()
                .execute()
            )
            cfg = res.data or {}
            if not cfg.get("auto_suspend_on_loop"):
                return
            minutes = cfg.get("loop_suspend_duration_minutes") or LOOP_SUSPEND_MINUTES_DEFAULT
            until = datetime.now(timezone.utc) + timedelta(minutes=minutes)
            await self.supabase.table("agents").update(
                {
                    "status": "suspended",
                    "suspended_until": until.isoformat(),
                    "suspend_reason": "loop_detected",
                }
            ).eq("id", agent_id).execute()
            self.log.warning("agent_loop_auto_suspended", agent_id=agent_id, minutes=minutes)
        except Exception as e:
            self.log.error("agent_loop_suspend_failed", agent_id=agent_id, error=str(e)[:200])


# ============================================================================
# WORKER ENTRYPOINT
# ============================================================================

async def run_anomaly_detector(supabase_client, redis_client, interval_seconds: int = 60):
    """
    Run the anomaly detector continuously.
    
    Args:
        supabase_client: Supabase client instance
        redis_client: Redis client instance
        interval_seconds: Seconds between detection cycles
    """
    detector = AgentAnomalyDetector(supabase_client, redis_client)
    
    log.info("anomaly_detector_started", interval=interval_seconds)
    
    while True:
        try:
            await detector.run_detection_cycle()
        except Exception as e:
            log.error("anomaly_detector_error", error=str(e)[:200])
        
        await asyncio.sleep(interval_seconds)


# For running standalone
if __name__ == "__main__":
    print("Agent Anomaly Detector - Use with scheduler")

