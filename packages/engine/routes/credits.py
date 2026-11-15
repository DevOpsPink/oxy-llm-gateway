"""
Oxy Credits Router
==================
Referral credit management endpoints.

Credits are earned through referrals and burned before budget. Amounts come
from REFERRAL_CREDIT_AMOUNT_USD and REFERRAL_MAX_PER_REFERRER_USD.

FRAUD PREVENTION:
- Self-referral detection (same email domain + alias detection)
- IP-based fraud detection (same IP within 24h)
- Email fuzzy matching (user+1@gmail.com == user@gmail.com)
- Rate limiting on referral redemption

Endpoints:
- GET /management/credits/balance - Get current credit balance
- POST /management/credits/redeem - Redeem a referral code
- GET /management/credits/referral-link - Get user's referral link
"""

import logging
import os
import re
import hashlib
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from core import log, resources, SUPABASE_URL, RATE_LIMIT_MANAGEMENT_PER_MINUTE, SITE_URL
from core.budget import BudgetManager
from dependencies import get_current_user_id, get_supabase_headers

# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(prefix="/management/credits", tags=["credits"])
limiter = Limiter(key_func=get_remote_address)

# ============================================================================
# CONSTANTS
# ============================================================================

logger = logging.getLogger(__name__)


def _get_decimal_env(name: str, default: str) -> Decimal:
    """Parse a Decimal env var with fallback to default and a warning on invalid input."""
    raw = os.getenv(name, default)
    try:
        return Decimal(raw)
    except InvalidOperation:
        logger.warning("Invalid decimal for %s=%r, falling back to %s", name, raw, default)
        return Decimal(default)


REFERRAL_CREDIT_AMOUNT = _get_decimal_env("REFERRAL_CREDIT_AMOUNT_USD", "100.00")
REFERRAL_MAX_PER_REFERRER = _get_decimal_env("REFERRAL_MAX_PER_REFERRER_USD", "1000.00")
REFERRAL_CODE_PATTERN = re.compile(r'^OXY-[A-Z0-9]{5}$')  # e.g., OXY-A7F2X
IP_FRAUD_WINDOW_HOURS = 24  # Block same IP referrals within 24 hours

# ============================================================================
# FRAUD DETECTION UTILITIES
# ============================================================================

def normalize_email(email: str) -> str:
    """
    Normalize email to detect alias fraud.
    
    Gmail allows:
    - user+anything@gmail.com → user@gmail.com
    - u.s.e.r@gmail.com → user@gmail.com
    
    This function normalizes to catch self-referral attempts.
    
    Examples:
    - "john.doe+ref1@gmail.com" → "johndoe@gmail.com"
    - "John.Doe@Gmail.COM" → "johndoe@gmail.com"
    - "user+alias@company.com" → "user@company.com"
    """
    if not email or '@' not in email:
        return email.lower()
    
    local_part, domain = email.lower().split('@', 1)
    
    # Remove everything after + (plus addressing)
    if '+' in local_part:
        local_part = local_part.split('+')[0]
    
    # For Gmail/Google domains, remove dots (Gmail ignores dots)
    gmail_domains = ['gmail.com', 'googlemail.com']
    if domain in gmail_domains:
        local_part = local_part.replace('.', '')
    
    return f"{local_part}@{domain}"


def get_email_fingerprint(email: str) -> str:
    """
    Create a fingerprint for fuzzy email matching.
    Used to detect when same person creates multiple accounts.
    
    Returns SHA-256 hash of normalized email.
    """
    normalized = normalize_email(email)
    return hashlib.sha256(normalized.encode()).hexdigest()


def emails_are_same_person(email1: str, email2: str) -> bool:
    """
    Detect if two emails belong to the same person.
    
    Catches:
    - Exact match (case-insensitive)
    - Gmail aliases (user+ref@gmail.com)
    - Gmail dot variations (u.s.e.r@gmail.com)
    - Same domain + similar local part (fuzzy)
    """
    # Normalize both emails
    norm1 = normalize_email(email1)
    norm2 = normalize_email(email2)
    
    # Exact match after normalization
    if norm1 == norm2:
        return True
    
    # Same domain check (for corporate emails)
    domain1 = norm1.split('@')[1] if '@' in norm1 else ''
    domain2 = norm2.split('@')[1] if '@' in norm2 else ''
    
    if domain1 == domain2 and domain1 not in ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']:
        # Same corporate domain - could be same person
        local1 = norm1.split('@')[0]
        local2 = norm2.split('@')[0]
        
        # Check for very similar local parts (e.g., "john" and "john.doe")
        if local1 in local2 or local2 in local1:
            return True
    
    return False


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CreditsBalanceResponse(BaseModel):
    organization_id: str
    balance: Decimal
    formatted_balance: str


class ReferralCodeRequest(BaseModel):
    """
    Validated referral code redemption request.
    
    Validation:
    - Code format: OXY-XXXXX (5 alphanumeric chars)
    - Uppercase normalization
    - Length check
    """
    referral_code: str = Field(
        ..., 
        min_length=9, 
        max_length=9,
        description="Referral code in format OXY-XXXXX"
    )
    
    @field_validator('referral_code')
    @classmethod
    def validate_referral_code(cls, v: str) -> str:
        """Validate and normalize referral code format."""
        if not v:
            raise ValueError('Referral code is required')
        
        # Normalize to uppercase
        v = v.upper().strip()
        
        # Validate format
        if not REFERRAL_CODE_PATTERN.match(v):
            raise ValueError(
                'Invalid referral code format. Expected: OXY-XXXXX '
                '(where X is alphanumeric)'
            )
        
        return v


class ReferralRedemptionResponse(BaseModel):
    success: bool
    message: str
    credits_awarded: Decimal
    new_balance: Decimal
    referrer_name: Optional[str] = None


class ReferralLinkResponse(BaseModel):
    referral_code: str
    referral_link: str
    total_referrals: int
    total_earned: Decimal

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/balance", response_model=CreditsBalanceResponse)
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def get_credits_balance(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get current credit balance for user's organization.
    
    Shows how much referral credit the organization has left.
    
    Returns:
    - organization_id: UUID of organization
    - balance: Decimal amount (e.g., 100.50)
    - formatted_balance: Human-readable string (e.g., "$100.50")
    """
    try:
        # Get user's organization
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organization_members",
            headers=get_supabase_headers(),
            params={
                "select": "organization_id,organizations(id)",
                "user_id": f"eq.{user_id}",
                "limit": "1"
            }
        )
        res.raise_for_status()
        data = res.json()
        
        if not data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = data[0]["organization_id"]
        
        # Get credits balance from Redis
        budget_manager = BudgetManager(resources.redis)
        balance = await budget_manager.get_credits_balance(organization_id)
        
        log.info(
            "credits_balance_fetched",
            user_id=user_id,
            organization_id=organization_id,
            balance=str(balance)
        )
        
        return CreditsBalanceResponse(
            organization_id=organization_id,
            balance=balance,
            formatted_balance=f"${balance:.2f}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("credits_balance_fetch_failed", user_id=user_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch credit balance")


@router.post("/redeem", response_model=ReferralRedemptionResponse)
@limiter.limit("5/minute")  # Strict rate limit on redemption
async def redeem_referral_code(
    request: Request,
    body: ReferralCodeRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Redeem a referral code to earn credits.
    
    Fraud prevention:
    1. Self-referral detection (same user ID)
    2. Email alias detection (user+1@gmail.com == user@gmail.com)
    3. IP-based fraud detection (same IP within 24h)
    4. Already-referred check (one referral per user)
    
    On success:
    - Referee gets REFERRAL_CREDIT_AMOUNT_USD in credit
    - Referrer gets REFERRAL_CREDIT_AMOUNT_USD in credit (capped by REFERRAL_MAX_PER_REFERRER_USD)
    - Both balances updated atomically
    """
    referral_code = body.referral_code
    client_ip = request.client.host if request.client else None
    
    try:
        # ====================================================================
        # STEP 1: Get current user's profile
        # ====================================================================
        user_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={
                "select": "id,email,referred_by,signup_ip,referral_code",
                "id": f"eq.{user_id}",
                "limit": "1"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        user_res.raise_for_status()
        users = user_res.json()
        
        if not users:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        user_profile = users[0]
        user_email = user_profile.get("email", "")
        user_signup_ip = user_profile.get("signup_ip")
        
        # ====================================================================
        # FRAUD CHECK 1: Already referred
        # ====================================================================
        if user_profile.get("referred_by"):
            log.warning(
                "referral_already_used",
                user_id=user_id,
                referral_code=referral_code
            )
            raise HTTPException(
                status_code=400,
                detail="You have already used a referral code. Each user can only be referred once."
            )
        
        # ====================================================================
        # FRAUD CHECK 2: Self-referral (own code)
        # ====================================================================
        if user_profile.get("referral_code") == referral_code:
            log.warning(
                "self_referral_own_code",
                user_id=user_id,
                referral_code=referral_code
            )
            raise HTTPException(
                status_code=400,
                detail="You cannot use your own referral code."
            )
        
        # ====================================================================
        # STEP 2: Look up referrer by code
        # ====================================================================
        referrer_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={
                "select": "id,email,full_name,signup_ip",
                "referral_code": f"eq.{referral_code}",
                "limit": "1"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        referrer_res.raise_for_status()
        referrers = referrer_res.json()
        
        if not referrers:
            log.warning(
                "invalid_referral_code",
                user_id=user_id,
                referral_code=referral_code
            )
            raise HTTPException(
                status_code=404,
                detail="Invalid referral code. Please check and try again."
            )
        
        referrer = referrers[0]
        referrer_id = referrer["id"]
        referrer_email = referrer.get("email", "")
        referrer_name = referrer.get("full_name", "A friend")
        referrer_signup_ip = referrer.get("signup_ip")
        
        # ====================================================================
        # FRAUD CHECK 3: Self-referral (same user ID)
        # ====================================================================
        if referrer_id == user_id:
            log.warning(
                "self_referral_same_id",
                user_id=user_id,
                referral_code=referral_code
            )
            raise HTTPException(
                status_code=400,
                detail="You cannot refer yourself."
            )
        
        # ====================================================================
        # FRAUD CHECK 4: Email alias detection
        # ====================================================================
        if emails_are_same_person(user_email, referrer_email):
            log.warning(
                "self_referral_email_alias",
                user_id=user_id,
                referrer_id=referrer_id,
                user_email_hash=get_email_fingerprint(user_email),
                referrer_email_hash=get_email_fingerprint(referrer_email),
                referral_code=referral_code
            )
            raise HTTPException(
                status_code=400,
                detail="Referral rejected: These accounts appear to belong to the same person."
            )
        
        # ====================================================================
        # FRAUD CHECK 5: IP-based fraud detection
        # ====================================================================
        # Check if referrer and referee have same IP (within 24h window)
        if client_ip and (client_ip == referrer_signup_ip or client_ip == user_signup_ip):
            log.warning(
                "self_referral_same_ip",
                user_id=user_id,
                referrer_id=referrer_id,
                client_ip=client_ip,
                referral_code=referral_code
            )
            raise HTTPException(
                status_code=400,
                detail="Referral rejected: Suspicious activity detected. Please contact support if you believe this is an error."
            )
        
        # Check Redis for recent referrals from same IP
        ip_fraud_key = f"referral_ip:{client_ip}"
        recent_referrals = await resources.redis.get(ip_fraud_key)
        
        if recent_referrals:
            referral_count = int(recent_referrals)
            if referral_count >= 3:  # Max 3 referrals per IP per 24h
                log.warning(
                    "ip_fraud_limit_exceeded",
                    user_id=user_id,
                    client_ip=client_ip,
                    referral_count=referral_count
                )
                raise HTTPException(
                    status_code=429,
                    detail="Too many referrals from this network. Please try again later."
                )
        
        # ====================================================================
        # STEP 3: Get organizations for both users
        # ====================================================================
        # Get referee's organization
        referee_org_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organization_members",
            params={
                "select": "organization_id",
                "user_id": f"eq.{user_id}",
                "limit": "1"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        referee_org_res.raise_for_status()
        referee_orgs = referee_org_res.json()
        
        if not referee_orgs:
            raise HTTPException(status_code=400, detail="You must be part of an organization to redeem credits")
        
        referee_org_id = referee_orgs[0]["organization_id"]
        
        # Get referrer's organization
        referrer_org_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organization_members",
            params={
                "select": "organization_id",
                "user_id": f"eq.{referrer_id}",
                "limit": "1"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        referrer_org_res.raise_for_status()
        referrer_orgs = referrer_org_res.json()
        
        if not referrer_orgs:
            log.warning("referrer_no_organization", referrer_id=referrer_id)
            # Still award credits to referee, but skip referrer
            referrer_org_id = None
        else:
            referrer_org_id = referrer_orgs[0]["organization_id"]
        
        # ====================================================================
        # STEP 4: Award credits (ATOMIC-ish with Redis)
        # ====================================================================
        budget_manager = BudgetManager(resources.redis)

        # Award credits to referee
        referee_award = REFERRAL_CREDIT_AMOUNT
        referee_new_balance = await budget_manager.add_credits(
            referee_org_id,
            referee_award
        )

        # Award credits to referrer (if they have an org) with cap
        if referrer_org_id:
            current_referrer_balance = await budget_manager.get_credits_balance(referrer_org_id)
            remaining_cap = max(Decimal("0.00"), REFERRAL_MAX_PER_REFERRER - current_referrer_balance)
            referrer_award = min(REFERRAL_CREDIT_AMOUNT, remaining_cap)
            if referrer_award > 0:
                await budget_manager.add_credits(referrer_org_id, referrer_award)
        
        # ====================================================================
        # STEP 5: Update database records
        # ====================================================================
        # Mark referee as referred
        await resources.http_client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={"id": f"eq.{user_id}"},
            headers=get_supabase_headers(),
            json={
                "referred_by": referrer_id,
                "credits_earned": str(REFERRAL_CREDIT_AMOUNT)
            },
            timeout=5.0
        )
        
        # Increment referrer's referral count
        await resources.http_client.rpc(
            f"{SUPABASE_URL}/rest/v1/rpc/fn_increment_referral_count",
            headers=get_supabase_headers(),
            json={"p_user_id": referrer_id},
            timeout=5.0
        )
        
        # ====================================================================
        # STEP 6: Track IP for fraud prevention
        # ====================================================================
        if client_ip:
            await resources.redis.incr(ip_fraud_key)
            await resources.redis.expire(ip_fraud_key, IP_FRAUD_WINDOW_HOURS * 3600)
        
        # ====================================================================
        # SUCCESS
        # ====================================================================
        log.info(
            "referral_redeemed_success",
            user_id=user_id,
            referrer_id=referrer_id,
            referral_code=referral_code,
            credits_awarded=str(referee_award),
            referee_new_balance=str(referee_new_balance)
        )
        
        return ReferralRedemptionResponse(
            success=True,
            message=f"Congratulations! You've earned ${referee_award} in usage credits.",
            credits_awarded=referee_award,
            new_balance=referee_new_balance,
            referrer_name=referrer_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log.error(
            "referral_redemption_failed",
            user_id=user_id,
            referral_code=referral_code,
            error=str(e),
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to redeem referral code. Please try again."
        )


@router.get("/referral-link", response_model=ReferralLinkResponse)
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def get_referral_link(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get user's referral link and stats.
    
    Returns:
    - referral_code: User's unique code (e.g., OXY-A7F2X)
    - referral_link: Full URL to share
    - total_referrals: Number of successful referrals
    - total_earned: Total credits earned from referrals
    """
    try:
        # Get user's profile with referral stats
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={
                "select": "referral_code,referral_count,credits_earned",
                "id": f"eq.{user_id}",
                "limit": "1"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        res.raise_for_status()
        profiles = res.json()
        
        if not profiles:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        profile = profiles[0]
        referral_code = profile.get("referral_code")
        
        if not referral_code:
            # Generate referral code if not exists
            import secrets
            referral_code = f"OXY-{secrets.token_hex(3).upper()[:5]}"
            
            # Save to database
            await resources.http_client.patch(
                f"{SUPABASE_URL}/rest/v1/profiles",
                params={"id": f"eq.{user_id}"},
                headers=get_supabase_headers(),
                json={"referral_code": referral_code},
                timeout=5.0
            )
            
            log.info("referral_code_generated", user_id=user_id, code=referral_code)
        
        return ReferralLinkResponse(
            referral_code=referral_code,
            referral_link=f"{SITE_URL}/ref/{referral_code}",
            total_referrals=profile.get("referral_count", 0),
            total_earned=Decimal(str(profile.get("credits_earned", "0")))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("referral_link_fetch_failed", user_id=user_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get referral link")

