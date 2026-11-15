"""
═══════════════════════════════════════════════════════════════
OXY ENGINE: COST ATTRIBUTION API
═══════════════════════════════════════════════════════════════

Tag LLM spend by team, project or customer, and turn it into chargeback
invoices.

ENDPOINTS:
- POST /management/attribution/tags - Create attribution tag
- GET /management/attribution/summary - Dashboard data
- GET /management/attribution/export - CSV export
- POST /management/chargeback/rules - Create chargeback rule
- GET /management/chargeback/invoices - List invoices
- POST /management/chargeback/invoices/:id/finalize - Lock invoice

Intended for finance and platform teams that need monthly cost reports.

═══════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, timedelta
import csv
import io
from uuid import UUID

from dependencies import get_current_user_id, get_supabase_headers
from core import resources

router = APIRouter()

# ═══════════════════════════════════════════════════════════════
# PYDANTIC MODELS (Request/Response Schemas)
# ═══════════════════════════════════════════════════════════════

class CostAttributionTagCreate(BaseModel):
    """Create a new cost attribution tag"""
    key: str = Field(..., min_length=1, max_length=50, pattern=r'^[a-z0-9_]+$')
    value: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    tag_type: str = Field(default='custom', pattern=r'^(customer|feature|team|environment|custom)$')
    is_billable: bool = False

    class Config:
        json_schema_extra = {
            "example": {
                "key": "customer_id",
                "value": "cust_abc123",
                "description": "Acme Corp customer ID",
                "tag_type": "customer",
                "is_billable": True
            }
        }


class CostAttributionTagResponse(BaseModel):
    """Cost attribution tag with aggregated metrics"""
    id: str
    key: str
    value: str
    description: Optional[str]
    tag_type: str
    is_billable: bool
    total_requests: int
    total_cost_usd: Decimal
    total_tokens_prompt: int
    total_tokens_completion: int
    created_at: datetime
    last_request_at: Optional[datetime]


class CostAttributionSummaryResponse(BaseModel):
    """Aggregated cost attribution summary"""
    tag_key: str
    tag_value: str
    tag_type: str
    is_billable: bool
    total_requests: int
    total_cost_usd: Decimal
    total_tokens_prompt: int
    total_tokens_completion: int
    first_request_at: Optional[datetime]
    last_request_at: Optional[datetime]


class ChargebackRuleCreate(BaseModel):
    """Create a chargeback rule"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    match_condition: Dict[str, Any] = Field(..., description="JSON condition for matching requests")
    chargeback_type: str = Field(..., pattern=r'^(department|customer|project)$')
    chargeback_target_id: str = Field(..., min_length=1, max_length=100)
    chargeback_target_name: str = Field(..., min_length=1, max_length=100)
    markup_percentage: Decimal = Field(default=Decimal('0.00'), ge=0, le=1000)
    minimum_charge_usd: Optional[Decimal] = Field(default=None, ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Marketing Department Chargeback",
                "description": "Bill Marketing for AI usage with 20% markup",
                "match_condition": {"tag_key": "team", "tag_value": "marketing"},
                "chargeback_type": "department",
                "chargeback_target_id": "DEPT-MARKETING",
                "chargeback_target_name": "Marketing Department",
                "markup_percentage": 20.00,
                "minimum_charge_usd": 100.00
            }
        }


class ChargebackRuleResponse(BaseModel):
    """Chargeback rule with metadata"""
    id: str
    name: str
    description: Optional[str]
    is_active: bool
    match_condition: Dict[str, Any]
    chargeback_type: str
    chargeback_target_id: str
    chargeback_target_name: str
    markup_percentage: Decimal
    minimum_charge_usd: Optional[Decimal]
    created_at: datetime


class ChargebackInvoiceResponse(BaseModel):
    """Chargeback invoice summary"""
    id: str
    chargeback_rule_id: str
    chargeback_target_id: str
    chargeback_target_name: str
    period_start: datetime
    period_end: datetime
    total_requests: int
    total_cost_usd: Decimal
    markup_usd: Decimal
    total_charge_usd: Decimal
    status: str
    finalized_at: Optional[datetime]
    external_invoice_id: Optional[str]
    external_invoice_url: Optional[str]
    created_at: datetime


# ═══════════════════════════════════════════════════════════════
# COST ATTRIBUTION ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.post("/attribution/tags", response_model=CostAttributionTagResponse, status_code=201)
async def create_attribution_tag(
    tag: CostAttributionTagCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a new cost attribution tag
    
    **Use Case:** Tag API requests for cost tracking (by customer, feature, team, etc.)
    
    **Example:**
    - `customer_id` → `cust_abc123` (bill customers for AI usage)
    - `feature` → `chatbot` (see cost by product feature)
    - `team` → `engineering` (allocate costs to departments)
    - `environment` → `production` (separate prod vs. staging costs)
    
    **Moat:** Historical attribution data (ML forecasting, budget predictions)
    """
    
    # Get user's organization
    headers = get_supabase_headers()
    org_response = await resources.http_client.get(
        f"{resources.supabase_client.supabase_url}/rest/v1/organization_members",
        headers=headers,
        params={"user_id": f"eq.{user_id}", "status": "eq.active", "select": "organization_id"}
    )
    
    if org_response.status_code != 200 or not org_response.json():
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.json()[0]["organization_id"]
    
    # Insert tag
    insert_data = {
        "organization_id": organization_id,
        "key": tag.key,
        "value": tag.value,
        "description": tag.description,
        "tag_type": tag.tag_type,
        "is_billable": tag.is_billable,
    }
    
    response = await resources.http_client.post(
        f"{resources.supabase_client.supabase_url}/rest/v1/cost_attribution_tags",
        headers={**headers, "Prefer": "return=representation"},
        json=insert_data
    )
    
    if response.status_code == 409:
        raise HTTPException(status_code=409, detail="Tag with this key/value already exists")
    elif response.status_code != 201:
        raise HTTPException(status_code=500, detail="Failed to create attribution tag")
    
    tag_data = response.json()[0]
    
    return CostAttributionTagResponse(
        id=tag_data["id"],
        key=tag_data["key"],
        value=tag_data["value"],
        description=tag_data.get("description"),
        tag_type=tag_data["tag_type"],
        is_billable=tag_data["is_billable"],
        total_requests=tag_data.get("total_requests", 0),
        total_cost_usd=Decimal(str(tag_data.get("total_cost_usd", 0))),
        total_tokens_prompt=tag_data.get("total_tokens_prompt", 0),
        total_tokens_completion=tag_data.get("total_tokens_completion", 0),
        created_at=tag_data["created_at"],
        last_request_at=tag_data.get("last_request_at")
    )


@router.get("/attribution/summary", response_model=List[CostAttributionSummaryResponse])
async def get_attribution_summary(
    user_id: str = Depends(get_current_user_id),
    tag_key: Optional[str] = Query(None, description="Filter by tag key (e.g., 'customer_id')"),
    tag_type: Optional[str] = Query(None, description="Filter by tag type"),
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    limit: int = Query(100, ge=1, le=1000, description="Max results")
):
    """
    Get cost attribution summary (aggregated by tag)
    
    **Use Case:** Dashboard queries ("How much did customer X spend?")
    
    **Performance:** Sub-second queries via materialized view + indexes
    
    **Filters:**
    - `tag_key`: Filter by dimension (e.g., "customer_id", "feature")
    - `tag_type`: Filter by type ("customer", "feature", "team")
    - `start_date`/`end_date`: Time range
    
    **Output:** Aggregated costs per tag (sorted by cost descending)
    """
    
    # Get user's organization
    headers = get_supabase_headers()
    org_response = await resources.http_client.get(
        f"{resources.supabase_client.supabase_url}/rest/v1/organization_members",
        headers=headers,
        params={"user_id": f"eq.{user_id}", "status": "eq.active", "select": "organization_id"}
    )
    
    if org_response.status_code != 200 or not org_response.json():
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.json()[0]["organization_id"]
    
    # Query materialized view
    params = {
        "organization_id": f"eq.{organization_id}",
        "order": "total_cost_usd.desc",
        "limit": limit
    }
    
    if tag_key:
        params["tag_key"] = f"eq.{tag_key}"
    if tag_type:
        params["tag_type"] = f"eq.{tag_type}"
    
    # Note: Time filtering requires querying request_attribution directly (not materialized view)
    # For v1, we use materialized view for speed (refresh every 5 min)
    
    response = await resources.http_client.get(
        f"{resources.supabase_client.supabase_url}/rest/v1/cost_attribution_summary",
        headers=headers,
        params=params
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch attribution summary")
    
    data = response.json()
    
    return [
        CostAttributionSummaryResponse(
            tag_key=row["tag_key"],
            tag_value=row["tag_value"],
            tag_type=row["tag_type"],
            is_billable=row["is_billable"],
            total_requests=row["total_requests"] or 0,
            total_cost_usd=Decimal(str(row["total_cost_usd"] or 0)),
            total_tokens_prompt=row["total_prompt_tokens"] or 0,
            total_tokens_completion=row["total_completion_tokens"] or 0,
            first_request_at=row.get("first_request_at"),
            last_request_at=row.get("last_request_at")
        )
        for row in data
    ]


@router.get("/attribution/export")
async def export_attribution_csv(
    user_id: str = Depends(get_current_user_id),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    """
    Export cost attribution data as CSV
    
    **Use Case:** Finance teams need monthly reports for budgeting
    
    **Output:** CSV with columns: Date, Tag Key, Tag Value, Cost, Tokens, Model
    """
    
    # Get user's organization
    headers = get_supabase_headers()
    org_response = await resources.http_client.get(
        f"{resources.supabase_client.supabase_url}/rest/v1/organization_members",
        headers=headers,
        params={"user_id": f"eq.{user_id}", "status": "eq.active", "select": "organization_id"}
    )
    
    if org_response.status_code != 200 or not org_response.json():
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.json()[0]["organization_id"]
    
    # Query detailed attribution data (join request_attribution + request_logs)
    # TODO: Optimize with database view
    params = {
        "organization_id": f"eq.{organization_id}",
        "select": "created_at,cost_usd,prompt_tokens,completion_tokens,tag_id(key,value)",
        "order": "created_at.desc",
        "limit": 10000  # Max 10k rows for CSV
    }
    
    if start_date:
        params["created_at"] = f"gte.{start_date.isoformat()}"
    if end_date:
        params["created_at"] = f"lte.{end_date.isoformat()}"
    
    response = await resources.http_client.get(
        f"{resources.supabase_client.supabase_url}/rest/v1/request_attribution",
        headers=headers,
        params=params
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch attribution data")
    
    data = response.json()
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Tag Key", "Tag Value", "Cost (USD)", "Prompt Tokens", "Completion Tokens"])
    
    for row in data:
        writer.writerow([
            row["created_at"],
            row["tag_id"]["key"] if row.get("tag_id") else "",
            row["tag_id"]["value"] if row.get("tag_id") else "",
            f"{row['cost_usd']:.6f}",
            row["prompt_tokens"],
            row["completion_tokens"]
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    from fastapi.responses import Response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=oxy_cost_attribution_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


# ═══════════════════════════════════════════════════════════════
# CHARGEBACK ENGINE ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.post("/chargeback/rules", response_model=ChargebackRuleResponse, status_code=201)
async def create_chargeback_rule(
    rule: ChargebackRuleCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a chargeback rule (automated cost allocation)
    
    **Use Case:** Bill internal departments or external customers for AI usage
    
    **Example:**
    - "Bill Marketing 20% markup for their AI spend"
    - "Charge customer ABC for GPT-4 usage in their account"
    
    **Moat:** Workflow lock-in (CFOs build budgeting processes around this)
    """
    
    # Get user's organization (admin check)
    headers = get_supabase_headers()
    org_response = await resources.http_client.get(
        f"{resources.supabase_client.supabase_url}/rest/v1/organization_members",
        headers=headers,
        params={
            "user_id": f"eq.{user_id}",
            "status": "eq.active",
            "role": "in.(owner,admin)",
            "select": "organization_id"
        }
    )
    
    if org_response.status_code != 200 or not org_response.json():
        raise HTTPException(status_code=403, detail="Only admins can create chargeback rules")
    
    organization_id = org_response.json()[0]["organization_id"]
    
    # Insert rule
    insert_data = {
        "organization_id": organization_id,
        "name": rule.name,
        "description": rule.description,
        "match_condition": rule.match_condition,
        "chargeback_type": rule.chargeback_type,
        "chargeback_target_id": rule.chargeback_target_id,
        "chargeback_target_name": rule.chargeback_target_name,
        "markup_percentage": float(rule.markup_percentage),
        "minimum_charge_usd": float(rule.minimum_charge_usd) if rule.minimum_charge_usd else None,
    }
    
    response = await resources.http_client.post(
        f"{resources.supabase_client.supabase_url}/rest/v1/chargeback_rules",
        headers={**headers, "Prefer": "return=representation"},
        json=insert_data
    )
    
    if response.status_code == 409:
        raise HTTPException(status_code=409, detail="Chargeback rule with this name already exists")
    elif response.status_code != 201:
        raise HTTPException(status_code=500, detail="Failed to create chargeback rule")
    
    rule_data = response.json()[0]
    
    return ChargebackRuleResponse(
        id=rule_data["id"],
        name=rule_data["name"],
        description=rule_data.get("description"),
        is_active=rule_data["is_active"],
        match_condition=rule_data["match_condition"],
        chargeback_type=rule_data["chargeback_type"],
        chargeback_target_id=rule_data["chargeback_target_id"],
        chargeback_target_name=rule_data["chargeback_target_name"],
        markup_percentage=Decimal(str(rule_data["markup_percentage"])),
        minimum_charge_usd=Decimal(str(rule_data["minimum_charge_usd"])) if rule_data.get("minimum_charge_usd") else None,
        created_at=rule_data["created_at"]
    )


@router.get("/chargeback/invoices", response_model=List[ChargebackInvoiceResponse])
async def get_chargeback_invoices(
    user_id: str = Depends(get_current_user_id),
    status: Optional[str] = Query(None, pattern=r'^(draft|finalized|sent|paid)$'),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    List chargeback invoices (monthly cost allocations)
    
    **Use Case:** CFO reviews monthly AI spend by department/customer
    
    **Output:** Aggregated invoices with cost + markup
    
    **Integration:** Export to QuickBooks, NetSuite, Stripe
    """
    
    # Get user's organization
    headers = get_supabase_headers()
    org_response = await resources.http_client.get(
        f"{resources.supabase_client.supabase_url}/rest/v1/organization_members",
        headers=headers,
        params={"user_id": f"eq.{user_id}", "status": "eq.active", "select": "organization_id"}
    )
    
    if org_response.status_code != 200 or not org_response.json():
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.json()[0]["organization_id"]
    
    # Query invoices
    params = {
        "organization_id": f"eq.{organization_id}",
        "order": "period_start.desc",
        "limit": limit
    }
    
    if status:
        params["status"] = f"eq.{status}"
    
    response = await resources.http_client.get(
        f"{resources.supabase_client.supabase_url}/rest/v1/chargeback_invoices",
        headers=headers,
        params=params
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch chargeback invoices")
    
    data = response.json()
    
    return [
        ChargebackInvoiceResponse(
            id=row["id"],
            chargeback_rule_id=row["chargeback_rule_id"],
            chargeback_target_id=row["chargeback_target_id"],
            chargeback_target_name=row["chargeback_target_name"],
            period_start=row["period_start"],
            period_end=row["period_end"],
            total_requests=row["total_requests"],
            total_cost_usd=Decimal(str(row["total_cost_usd"])),
            markup_usd=Decimal(str(row["markup_usd"])),
            total_charge_usd=Decimal(str(row["total_charge_usd"])),
            status=row["status"],
            finalized_at=row.get("finalized_at"),
            external_invoice_id=row.get("external_invoice_id"),
            external_invoice_url=row.get("external_invoice_url"),
            created_at=row["created_at"]
        )
        for row in data
    ]


