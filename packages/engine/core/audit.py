from typing import Optional, Dict, Any

from core import resources, SUPABASE_URL, log
from dependencies import get_supabase_headers


async def log_admin_event(
    organization_id: str,
    event_type: str,
    actor_id: Optional[str] = None,
    actor_type: str = "api_key",
    source_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Best-effort admin audit log writer. Must not raise for callers.
    """
    try:
        payload = {
            "organization_id": organization_id,
            "event_type": event_type,
            "actor_id": actor_id,
            "actor_type": actor_type,
            "source_ip": source_ip,
            "user_agent": user_agent,
            "metadata": metadata or {},
        }
        await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/admin_audit_logs",
            headers={**get_supabase_headers(), "Prefer": "resolution=merge-duplicates"},
            json=payload,
        )
    except Exception as e:
        log.error("admin_audit_log_failed", event_type=event_type, organization_id=organization_id, error=str(e))

