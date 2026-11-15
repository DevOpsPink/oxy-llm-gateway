"""
SSO/SAML Routes
===============

Lets organizations sign in through Okta, Azure AD or Google Workspace.

Features:
- Domain-based SSO detection
- Automatic organization membership
- Supabase Auth SSO integration
- Audit logging for compliance
- Enterprise plan gating

Security:
- Domain verification required
- Admin approval workflow
- Rate limiting (10 req/min per IP)
- Audit trail for SOC 2
"""

from fastapi import APIRouter, HTTPException, Request, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
import structlog
from datetime import datetime, timezone

from core import resources, SUPABASE_URL
from core.addons import require_add_on
from dependencies import get_current_user_id, get_supabase_headers

log = structlog.get_logger()

router = APIRouter(prefix="/auth/sso", tags=["sso"])


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class SSODomainLookupRequest(BaseModel):
    """Request to check if a domain has SSO configured"""
    email: EmailStr
    
    @validator('email')
    def normalize_email(cls, v):
        return v.lower().strip()


class SSODomainLookupResponse(BaseModel):
    """Response with SSO configuration"""
    sso_available: bool
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    sso_provider_id: Optional[str] = None
    login_method: str  # "password" or "sso"


class SSOConfigureRequest(BaseModel):
    """Request to configure SSO for an organization"""
    domain: str
    provider_id: str  # Supabase Auth SSO provider UUID
    
    @validator('domain')
    def normalize_domain(cls, v):
        return v.lower().strip()


class SSOConfigureResponse(BaseModel):
    """Response after SSO configuration"""
    success: bool
    message: str
    domain: Optional[str] = None
    verification_required: bool = False
    error: Optional[str] = None


class SSOCallbackRequest(BaseModel):
    """Request after SSO login redirect"""
    code: str  # OAuth code from Supabase
    user_id: str  # UUID from Supabase Auth
    email: EmailStr


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def extract_domain(email: str) -> str:
    """Extract domain from email address"""
    return email.split('@')[1].lower()


async def log_sso_event(
    organization_id: str,
    action: str,
    actor_user_id: Optional[str] = None,
    affected_user_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    request: Optional[Request] = None
):
    """Log SSO-related events for audit trail"""
    try:
        ip_address = None
        user_agent = None
        
        if request:
            ip_address = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            user_agent = request.headers.get("user-agent", "")
        
        await resources.supabase.table("sso_audit_log").insert({
            "organization_id": organization_id,
            "action": action,
            "actor_user_id": actor_user_id,
            "affected_user_id": affected_user_id,
            "metadata": metadata or {},
            "ip_address": ip_address,
            "user_agent": user_agent
        }).execute()
    except Exception as e:
        log.error("sso_audit_log_failed", error=str(e)[:200])


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/lookup", response_model=SSODomainLookupResponse)
async def lookup_sso_domain(
    request: SSODomainLookupRequest,
    req: Request
):
    """
    Check if an email domain has SSO configured.
    
    This is called by the frontend login form to determine:
    - Show "Sign in with SSO" button (if SSO available)
    - Show password field (if no SSO)
    
    Flow:
    1. User types email: alice@tesla.com
    2. Frontend calls this endpoint
    3. Backend checks if "tesla.com" has SSO
    4. Frontend switches UI accordingly
    
    Rate Limited: 10 req/min per IP (prevent domain enumeration)
    """
    domain = extract_domain(request.email)
    
    try:
        # Call database function (fast indexed lookup)
        result = await resources.supabase.rpc(
            "fn_get_sso_provider_by_domain",
            {"p_domain": domain}
        ).execute()
        
        if result.data and len(result.data) > 0:
            org = result.data[0]
            
            log.info("sso_domain_lookup_success",
                    domain=domain,
                    organization_id=org["organization_id"],
                    sso_available=True)
            
            return SSODomainLookupResponse(
                sso_available=True,
                organization_id=org["organization_id"],
                organization_name=org["organization_name"],
                sso_provider_id=org["sso_provider_id"],
                login_method="sso"
            )
        else:
            log.info("sso_domain_lookup_not_found", domain=domain)
            
            return SSODomainLookupResponse(
                sso_available=False,
                login_method="password"
            )
    
    except Exception as e:
        log.error("sso_domain_lookup_failed",
                 domain=domain,
                 error=str(e)[:200],
                 exc_info=True)
        
        # Fail open: allow password login if lookup fails
        return SSODomainLookupResponse(
            sso_available=False,
            login_method="password"
        )


@router.post("/configure", response_model=SSOConfigureResponse)
async def configure_sso(
    request: SSOConfigureRequest,
    req: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Configure SSO for an organization.
    
    Requirements:
    - User must be owner or admin
    - Organization must have the sso add-on (organization_add_ons)
    - Domain must be unique (not claimed by another org)
    
    After configuration, domain verification is required:
    - Email sent to admin@domain.com with verification code
    - OR manual approval by an operator
    
    Security: Authenticated endpoint, admin role required
    """
    try:
        # Get client IP and user agent for audit log
        ip_address = req.headers.get("x-forwarded-for", "").split(",")[0].strip()
        user_agent = req.headers.get("user-agent", "")
        
        # Get user's organization
        org_result = await resources.supabase.table("organization_members") \
            .select("organization_id, role") \
            .eq("user_id", user_id) \
            .eq("status", "active") \
            .limit(1) \
            .execute()
        
        if not org_result.data:
            raise HTTPException(
                status_code=403,
                detail="You must be a member of an organization to configure SSO"
            )
        
        organization_id = org_result.data[0]["organization_id"]

        # Add-on gating
        await require_add_on(
            organization_id,
            "sso",
            "SSO configuration requires the sso add-on. An operator can enable it in organization_add_ons.",
        )
        
        # Call database function (handles all validation + audit)
        result = await resources.supabase.rpc(
            "fn_configure_sso",
            {
                "p_organization_id": organization_id,
                "p_user_id": user_id,
                "p_domain": request.domain,
                "p_provider_id": request.provider_id,
                "p_ip_address": ip_address,
                "p_user_agent": user_agent
            }
        ).execute()
        
        response_data = result.data
        
        if response_data.get("success"):
            log.info("sso_configured_success",
                    organization_id=organization_id,
                    domain=request.domain,
                    user_id=user_id)
            
            return SSOConfigureResponse(
                success=True,
                message=response_data.get("message"),
                domain=response_data.get("domain"),
                verification_required=response_data.get("verification_required", False)
            )
        else:
            # Business logic error (not technical)
            error_code = response_data.get("error")
            error_message = response_data.get("message")
            
            log.warning("sso_configuration_rejected",
                       organization_id=organization_id,
                       domain=request.domain,
                       error=error_code,
                       user_id=user_id)
            
            # Map error codes to HTTP status
            status_map = {
                "permission_denied": 403,
                "plan_required": 402,  # Payment Required
                "domain_taken": 409    # Conflict
            }
            
            raise HTTPException(
                status_code=status_map.get(error_code, 400),
                detail=error_message
            )
    
    except HTTPException:
        raise
    except Exception as e:
        log.error("sso_configure_failed",
                 domain=request.domain,
                 user_id=user_id,
                 error=str(e)[:200],
                 exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to configure SSO. Please contact support."
        )


@router.post("/callback")
async def sso_callback(
    request: SSOCallbackRequest,
    req: Request,
    bt: BackgroundTasks
):
    """
    Handle SSO login callback from Supabase Auth.
    
    This endpoint is called AFTER the user successfully authenticates
    via their identity provider (Okta/Azure AD/etc).
    
    Flow:
    1. User clicks "Sign in with SSO" → Redirected to IdP
    2. User authenticates with IdP
    3. IdP redirects back to Supabase
    4. Supabase redirects to this endpoint with auth code
    5. We auto-join user to their organization
    
    Critical: This must be FAST (< 200ms) to not block login
    """
    # Not wired in this release: the database functions it calls do not exist, and
    # it trusts the user_id and email in the body with no authentication. It must
    # verify the identity provider's assertion before it can join anyone to an
    # organization; until then it refuses.
    raise HTTPException(status_code=501, detail="SSO sign-in is not available in this release.")

    domain = extract_domain(request.email)
    
    try:
        # Get client IP and user agent
        ip_address = req.headers.get("x-forwarded-for", "").split(",")[0].strip()
        user_agent = req.headers.get("user-agent", "")
        
        # Auto-join user to organization (if SSO domain matches)
        result = await resources.supabase.rpc(
            "fn_sso_auto_join_user",
            {
                "p_user_id": request.user_id,
                "p_email": request.email,
                "p_ip_address": ip_address,
                "p_user_agent": user_agent
            }
        ).execute()
        
        response_data = result.data
        
        if response_data.get("success"):
            action = response_data.get("action")
            
            if action == "auto_joined":
                log.info("sso_auto_join_success",
                        user_id=request.user_id,
                        email=request.email,
                        organization_id=response_data.get("organization_id"),
                        domain=domain)
                
                return {
                    "success": True,
                    "action": "auto_joined",
                    "organization_id": response_data.get("organization_id"),
                    "organization_name": response_data.get("organization_name"),
                    "role": response_data.get("role"),
                    "message": f"Welcome to {response_data.get('organization_name')}!"
                }
            else:
                # User was already a member
                log.info("sso_login_existing_member",
                        user_id=request.user_id,
                        email=request.email,
                        organization_id=response_data.get("organization_id"))
                
                return {
                    "success": True,
                    "action": "existing_member",
                    "organization_id": response_data.get("organization_id"),
                    "organization_name": response_data.get("organization_name")
                }
        else:
            # No SSO organization found (shouldn't happen, but handle gracefully)
            reason = response_data.get("reason")
            
            log.warning("sso_auto_join_failed",
                       user_id=request.user_id,
                       email=request.email,
                       reason=reason)
            
            # Redirect to normal onboarding
            return {
                "success": False,
                "action": "onboard_required",
                "message": "Please complete onboarding to continue.",
                "redirect_url": "/onboarding"
            }
    
    except Exception as e:
        log.error("sso_callback_failed",
                 user_id=request.user_id,
                 email=request.email,
                 error=str(e)[:200],
                 exc_info=True)
        
        # Don't block login on error - redirect to dashboard
        return {
            "success": False,
            "action": "manual_join_required",
            "message": "Login successful. Please contact your admin to join your organization.",
            "redirect_url": "/dashboard"
        }


@router.get("/status/{organization_id}")
async def get_sso_status(
    organization_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get SSO configuration status for an organization.
    
    Used by settings page to display:
    - Is SSO enabled?
    - What domain is configured?
    - Is domain verified?
    - When was it configured?
    
    Security: User must be member of organization
    """
    try:
        # Verify user is member of organization
        member_check = await resources.supabase.table("organization_members") \
            .select("role") \
            .eq("organization_id", organization_id) \
            .eq("user_id", user_id) \
            .eq("status", "active") \
            .limit(1) \
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get SSO configuration with subscription info
        # FIX: organizations table doesn't have subscription_plan - join with subscriptions via subscription_id
        org_result = await resources.supabase.table("organizations") \
            .select("settings, subscription_id") \
            .eq("id", organization_id) \
            .limit(1) \
            .execute()
        
        if not org_result.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org = org_result.data[0]
        settings = org.get("settings", {}) or {}
        
        # Get subscription plan if subscription exists
        plan_tier = "free"
        if org.get("subscription_id"):
            sub_result = await resources.supabase.table("subscriptions") \
                .select("plan_tier") \
                .eq("id", org.get("subscription_id")) \
                .limit(1) \
                .execute()
            if sub_result.data:
                plan_tier = sub_result.data[0].get("plan_tier", "free")
        
        return {
            "sso_enabled": settings.get("sso_enabled", False),
            "sso_domain": settings.get("sso_domain"),
            "sso_domain_verified": settings.get("sso_domain_verified", False),
            "sso_configured_at": settings.get("sso_configured_at"),
            "subscription_plan": plan_tier,
            "can_configure_sso": plan_tier == "enterprise"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        log.error("sso_status_failed",
                 organization_id=organization_id,
                 error=str(e)[:200],
                 exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get SSO status")

