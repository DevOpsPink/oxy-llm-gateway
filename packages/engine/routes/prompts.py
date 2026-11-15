"""
PROMPT LIBRARY (MVP)
====================
Shared prompt templates for LLM use cases. The list below is mock data.

Features:
- Prompts submitted by members of the deployment
- Verified prompts (reviewed by an operator)
- Prompt analytics (usage, ratings, savings)

Author: Oxy contributors
License: Apache 2.0
"""

import os
from datetime import datetime, timezone
from typing import List, Optional
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core import log, resources
from dependencies import get_current_user_id, get_supabase_headers

SUPABASE_URL = os.getenv("SUPABASE_URL")

router = APIRouter(prefix="/prompts", tags=["prompts"])


# ============================================================================
# ENUMS & MODELS
# ============================================================================

class PromptCategory(str, Enum):
    """Prompt categories."""
    CUSTOMER_SUPPORT = "customer_support"
    CODE_GENERATION = "code_generation"
    DATA_ANALYSIS = "data_analysis"
    CONTENT_WRITING = "content_writing"
    TRANSLATION = "translation"
    SUMMARIZATION = "summarization"
    OTHER = "other"


class PromptTemplate(BaseModel):
    """Prompt template metadata."""
    id: str
    title: str = Field(description="Short descriptive title")
    description: str = Field(description="What this prompt does")
    category: PromptCategory
    prompt_text: str = Field(description="The actual prompt template with {variables}")
    variables: List[str] = Field(description="List of variables like {customer_name}")
    recommended_model: str = Field(description="Best model for this prompt (e.g. gpt-4-turbo)")
    estimated_cost_per_use: float = Field(description="USD cost per execution")
    author_user_id: str
    author_name: str
    is_verified: bool = Field(default=False, description="Verified by an operator")
    is_premium: bool = Field(default=False, description="Paid prompt")
    price_usd: Optional[int] = Field(default=None, description="Price if premium")
    usage_count: int = Field(default=0, description="How many times used")
    avg_rating: float = Field(default=0.0, description="Average rating 0-5")
    rating_count: int = Field(default=0, description="Number of ratings")
    total_savings_usd: float = Field(default=0.0, description="Total savings generated for users")
    created_at: str
    updated_at: str


class CreatePromptRequest(BaseModel):
    """Request to create a new prompt."""
    title: str = Field(min_length=10, max_length=100)
    description: str = Field(min_length=20, max_length=500)
    category: PromptCategory
    prompt_text: str = Field(min_length=50, max_length=10000)
    variables: List[str] = Field(default=[])
    recommended_model: str
    estimated_cost_per_use: float
    is_premium: bool = Field(default=False)
    price_usd: Optional[int] = Field(default=None)


class RatePromptRequest(BaseModel):
    """Request to rate a prompt."""
    prompt_id: str
    rating: int = Field(ge=1, le=5, description="Rating 1-5")
    comment: Optional[str] = Field(default=None, max_length=500)


# ============================================================================
# MOCK DATA (Replace with DB in production)
# ============================================================================

MOCK_PROMPTS = [
    PromptTemplate(
        id="prompt_1",
        title="Customer Support Email Response",
        description="Generate empathetic, professional email responses to customer inquiries. Maintains brand voice.",
        category=PromptCategory.CUSTOMER_SUPPORT,
        prompt_text="""You are a customer support agent for {company_name}. 

Customer inquiry:
{customer_message}

Write a professional, empathetic email response that:
1. Acknowledges their concern
2. Provides a clear solution or next steps
3. Ends with a friendly closing

Response:""",
        variables=["company_name", "customer_message"],
        recommended_model="claude-3-5-sonnet",
        estimated_cost_per_use=0.002,
        author_user_id="oxy_examples",
        author_name="Oxy examples",
        is_verified=True,
        is_premium=False,
        price_usd=None,
        usage_count=0,
        avg_rating=0.0,
        rating_count=0,
        total_savings_usd=0.0,
        created_at="2025-01-15T10:00:00Z",
        updated_at="2025-11-20T15:30:00Z"
    ),
    PromptTemplate(
        id="prompt_2",
        title="SQL Query Generator (Advanced)",
        description="Generate complex SQL queries from natural language. Tested on 10,000+ queries with 98% accuracy.",
        category=PromptCategory.CODE_GENERATION,
        prompt_text="""You are an expert SQL developer.

Database schema:
{schema}

Natural language request:
{user_request}

Generate an optimized SQL query. Include:
1. Proper JOINs
2. Indexes for performance
3. Comments explaining logic

SQL Query:""",
        variables=["schema", "user_request"],
        recommended_model="gpt-4-turbo",
        estimated_cost_per_use=0.008,
        author_user_id="oxy_examples",
        author_name="Oxy examples",
        is_verified=True,
        is_premium=False,
        price_usd=None,
        usage_count=0,
        avg_rating=0.0,
        rating_count=0,
        total_savings_usd=0.0,
        created_at="2025-02-10T09:00:00Z",
        updated_at="2025-11-22T08:00:00Z"
    )
]


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/", response_model=List[PromptTemplate])
async def list_prompts(
    category: Optional[PromptCategory] = Query(None),
    verified_only: bool = Query(False),
    free_only: bool = Query(True),
    sort_by: str = Query("usage_count", pattern="^(usage_count|avg_rating|created_at)$"),
    user_id: str = Depends(get_current_user_id)
):
    """
    List all available prompts in the marketplace.
    
    **Filters:**
    - category: Filter by prompt category
    - verified_only: Show only Oxy-verified prompts
    - free_only: Show only free prompts
    - sort_by: Sort by usage_count, avg_rating, or created_at
    
    **Feature Gating:**
    - Free: Browse all, use 3/month
    - Professional: Unlimited usage
    - Enterprise: Can create private prompts
    """
    try:
        # Filter prompts
        prompts = MOCK_PROMPTS.copy()
        
        if category:
            prompts = [p for p in prompts if p.category == category]
        
        if verified_only:
            prompts = [p for p in prompts if p.is_verified]
        
        if free_only:
            prompts = [p for p in prompts if not p.is_premium]
        
        # Sort
        if sort_by == "usage_count":
            prompts.sort(key=lambda p: p.usage_count, reverse=True)
        elif sort_by == "avg_rating":
            prompts.sort(key=lambda p: p.avg_rating, reverse=True)
        elif sort_by == "created_at":
            prompts.sort(key=lambda p: p.created_at, reverse=True)
        
        log.info("prompts_listed",
                user_id=user_id,
                count=len(prompts),
                category=category,
                verified_only=verified_only)
        
        return prompts
        
    except Exception as e:
        log.error("list_prompts_failed",
                 user_id=user_id,
                 error=str(e),
                 exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list prompts")


@router.get("/{prompt_id}", response_model=PromptTemplate)
async def get_prompt(
    prompt_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get a specific prompt by ID.
    """
    try:
        # Find prompt
        prompt = next((p for p in MOCK_PROMPTS if p.id == prompt_id), None)
        
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        log.info("prompt_viewed",
                user_id=user_id,
                prompt_id=prompt_id)
        
        return prompt
        
    except HTTPException:
        raise
    
    except Exception as e:
        log.error("get_prompt_failed",
                 user_id=user_id,
                 prompt_id=prompt_id,
                 error=str(e),
                 exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch prompt")


@router.post("/", response_model=PromptTemplate)
async def create_prompt(
    body: CreatePromptRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Submit a new prompt to the library.
    
    **Requirements:**
    - Growth, Business or Enterprise plan tier
    - Reviewed by an operator before verification
    """
    try:
        # Check user's plan
        subscription_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/subscriptions",
            params={
                "select": "plan_tier",
                "user_id": f"eq.{user_id}",
                "status": "eq.active",
                "limit": "1"
            },
            headers=get_supabase_headers()
        )
        subscription_res.raise_for_status()
        subscriptions = subscription_res.json()
        
        if not subscriptions:
            raise HTTPException(
                status_code=402,
                detail="Active subscription required to submit prompts"
            )
        
        plan = subscriptions[0]["plan_tier"]
        
        # Plan tiers with prompt submission: growth, business, enterprise
        if plan not in ["growth", "business", "enterprise"]:
            raise HTTPException(
                status_code=403,
                detail="Prompt submission is available on the growth, business and enterprise plan tiers"
            )
        
        # Validate premium prompt pricing
        if body.is_premium and (not body.price_usd or body.price_usd < 5):
            raise HTTPException(
                status_code=400,
                detail="Premium prompts need price_usd of at least 5"
            )
        
        # Create prompt (would insert into DB)
        new_prompt = PromptTemplate(
            id=f"prompt_{datetime.now(timezone.utc).timestamp()}",
            title=body.title,
            description=body.description,
            category=body.category,
            prompt_text=body.prompt_text,
            variables=body.variables,
            recommended_model=body.recommended_model,
            estimated_cost_per_use=body.estimated_cost_per_use,
            author_user_id=user_id,
            author_name="Current User",  # Would fetch from profile
            is_verified=False,  # Requires manual review
            is_premium=body.is_premium,
            price_usd=body.price_usd,
            usage_count=0,
            avg_rating=0.0,
            rating_count=0,
            total_savings_usd=0.0,
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        
        log.info("prompt_created",
                user_id=user_id,
                prompt_id=new_prompt.id,
                is_premium=body.is_premium,
                price=body.price_usd)
        
        return new_prompt
        
    except HTTPException:
        raise
    
    except Exception as e:
        log.error("create_prompt_failed",
                 user_id=user_id,
                 error=str(e),
                 exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create prompt")


@router.post("/rate")
async def rate_prompt(
    body: RatePromptRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Rate a prompt you've used.
    """
    try:
        # Find prompt
        prompt = next((p for p in MOCK_PROMPTS if p.id == body.prompt_id), None)
        
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # Would insert rating into DB and recalculate avg_rating
        
        log.info("prompt_rated",
                user_id=user_id,
                prompt_id=body.prompt_id,
                rating=body.rating)
        
        return {"success": True, "message": "Rating submitted"}
        
    except HTTPException:
        raise
    
    except Exception as e:
        log.error("rate_prompt_failed",
                 user_id=user_id,
                 prompt_id=body.prompt_id,
                 error=str(e),
                 exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to submit rating")

