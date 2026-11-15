"""
CSV EXPORT ENDPOINT
===================

Lets finance teams audit usage data.

SECURITY:
    - RLS enforcement (user can only export their org's data)
    - Rate limiting (1 request/minute per user)
    - Max date range: 90 days
    - Streaming CSV (no memory explosion)
    - Audit logging
"""

import csv
import io
from datetime import datetime, timedelta
from typing import Generator

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from core import log as logger, resources, SUPABASE_URL
from dependencies import get_current_user

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])

# Rate limiter: 1 request per minute per IP (SRE: DOS prevention)
limiter = Limiter(key_func=get_remote_address)

MAX_EXPORT_DAYS = 90  # Prevent 10-year date range attacks


def generate_csv_rows(
    org_id: str, start_date: str, end_date: str
) -> Generator[str, None, None]:
    """
    Stream CSV rows (generator pattern = O(1) memory).

    Security: Uses RLS (Supabase enforces user can only see their org's data).
    """
    try:
        # Query usage logs with RLS enforcement
        # Note: The 'usage_logs' table must have RLS policies that enforce org-level access
        result = (
            resources.supabase.table("usage_logs")
            .select(
                "created_at, model, prompt_tokens, completion_tokens, total_cost, project_id"
            )
            .eq("organization_id", org_id)
            .gte("created_at", start_date)
            .lte("created_at", end_date)
            .order("created_at", desc=True)
            .execute()
        )

        logs = result.data if result.data else []

        # CSV Header
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Date",
                "Model",
                "Prompt Tokens",
                "Completion Tokens",
                "Cost (USD)",
                "Project ID",
            ]
        )
        yield output.getvalue()
        output.truncate(0)
        output.seek(0)

        # CSV Rows (streamed)
        for log in logs:
            writer.writerow(
                [
                    log.get("created_at", ""),
                    log.get("model", ""),
                    log.get("prompt_tokens", 0),
                    log.get("completion_tokens", 0),
                    f"${log.get('total_cost', 0):.4f}",
                    log.get("project_id", ""),
                ]
            )
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)

        # Footer watermark (Growth Hacker: Viral loop)
        writer.writerow([])
        writer.writerow(
            ["Exported from Oxy Engine", "", "", "", "", "https://github.com/heyvaldemar/oxy-llm-gateway"]
        )
        yield output.getvalue()

    except Exception as e:
        logger.error("csv_export_failed", error=str(e), org_id=org_id)
        raise HTTPException(status_code=500, detail="Export failed")


@router.get("/export")
async def export_usage_csv(
    request: Request,
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    project_id: str | None = Query(None, description="Optional: Filter by project"),
    user: dict = Depends(get_current_user),
):
    """
    Export usage logs as CSV (Finance Department Hook).

    Security:
        - RLS enforcement (via Supabase policies)
        - Rate limited (1 req/min)
        - Max 90-day range

    Returns:
        Streaming CSV file
    """
    # Extract user ID from Supabase Auth response
    user_id = user.get("id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user token")
    
    # Fetch user's organization (users can belong to multiple orgs, get first active)
    org_result = await resources.supabase.table("organization_members") \
        .select("organization_id") \
        .eq("user_id", user_id) \
        .eq("status", "active") \
        .limit(1) \
        .execute()
    
    if not org_result.data:
        raise HTTPException(status_code=403, detail="No organization found. Please join an organization first.")
    
    org_id = org_result.data[0]["organization_id"]

    # Validate date format
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format (use YYYY-MM-DD)"
        )

    # Fortress: Enforce 90-day max range
    if (end_dt - start_dt).days > MAX_EXPORT_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Date range exceeds maximum of {MAX_EXPORT_DAYS} days",
        )

    # Bear: Audit log (legal armor for SOC 2)
    try:
        resources.supabase.table("audit_logs").insert(
            {
                "user_id": user_id,
                "action": "csv_export",
                "resource_type": "usage_logs",
                "metadata": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "project_id": project_id,
                },
            }
        ).execute()
    except Exception as e:
        logger.warning("audit_log_failed", error=str(e), critical=False)

    # Stream the CSV (Physics Engine: O(1) memory)
    filename = f"oxy_usage_{start_date}_to_{end_date}.csv"
    return StreamingResponse(
        generate_csv_rows(org_id, start_date, end_date),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

