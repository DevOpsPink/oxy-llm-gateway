"""
Oxy Team Router
================
Team member invitation and management endpoints.

Endpoints:
- POST /management/team/invite - Send team invitation
- POST /management/team/invite/accept - Accept invitation
- GET /management/team/invites - List pending invites
- DELETE /management/team/invite/{invite_id} - Revoke invitation

SECURITY: Only organization owners can invite members.
"""

import secrets
import hashlib
import httpx
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

# Import shared resources and dependencies
from core import resources, log, SUPABASE_URL, RATE_LIMIT_MANAGEMENT_PER_MINUTE, SITE_URL
from dependencies import get_current_user_id, get_supabase_headers
from security_utils import log_error_safe

# Import email configuration
import os
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_API_URL = "https://api.resend.com/emails"
EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "false").lower() == "true"
EMAIL_FROM = os.getenv("EMAIL_FROM", "alerts@example.com")

# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(prefix="/management/team", tags=["team"])
limiter = Limiter(key_func=get_remote_address)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class TeamInviteRequest(BaseModel):
    """Team member invitation request."""
    email: str = Field(..., max_length=255, description="Email address to invite")
    role: str = Field("developer", description="Role for invited member")
    organization_id: str = Field(..., description="Organization ID")
    
    @field_validator('email')
    def validate_email(cls, v):
        if '@' not in v or '.' not in v:
            raise ValueError('Invalid email format')
        return v.lower().strip()
    
    @field_validator('role')
    def validate_role(cls, v):
        if v not in ['developer', 'viewer']:
            raise ValueError('Role must be developer or viewer')
        return v


class InviteAcceptRequest(BaseModel):
    """Accept team invitation request."""
    invite_token: str = Field(..., min_length=32, max_length=64)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def check_is_owner(user_id: str, organization_id: str) -> bool:
    """
    Check if user is owner of organization.
    
    SECURITY: Only owners can invite team members.
    """
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organization_members",
            params={
                "select": "role",
                "organization_id": f"eq.{organization_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        
        if res.status_code == 200:
            members = res.json()
            if members and members[0].get("role") == "owner":
                return True
        return False
    except Exception as e:
        log.error("check_is_owner_failed", user_id=user_id, organization_id=organization_id, error=str(e))
        return False


async def send_team_invite_email(
    recipient_email: str,
    organization_name: str,
    invite_token: str,
    role: str,
    inviter_name: str
):
    """
    Send team invitation email via Resend API.
    
    Features:
    - Beautiful HTML email template
    - Clear CTA button
    - 48h expiration notice
    """
    if not RESEND_API_KEY or not EMAIL_ENABLED:
        log.info("team_invite_email_disabled", reason="RESEND_API_KEY not set or EMAIL_ENABLED=false")
        return
    
    invite_url = f"{SITE_URL.rstrip('/')}/invite/{invite_token}"
    
    html_body = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Join {organization_name} on Oxy Engine</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f5f5f5;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }}
            .invite-box {{
                background: #e7f3ff;
                border-left: 4px solid #007bff;
                padding: 20px;
                margin: 30px 20px;
                border-radius: 4px;
            }}
            .invite-box p {{
                margin: 8px 0;
                font-size: 15px;
            }}
            .invite-box strong {{
                color: #0056b3;
            }}
            .content {{
                padding: 0 20px 30px;
            }}
            .feature-list {{
                background: #f8f9fa;
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
                border: 1px solid #e9ecef;
            }}
            .feature-list h3 {{
                margin: 0 0 15px 0;
                color: #495057;
                font-size: 16px;
            }}
            .feature-list ul {{
                margin: 0;
                padding-left: 20px;
            }}
            .feature-list li {{
                margin: 8px 0;
                color: #6c757d;
            }}
            .cta-button {{
                display: inline-block;
                background: #007bff;
                color: white !important;
                padding: 14px 28px;
                text-decoration: none;
                border-radius: 6px;
                margin: 30px 0;
                font-weight: 600;
                text-align: center;
            }}
            .cta-button:hover {{
                background: #0056b3;
            }}
            .expiration-notice {{
                background: #fff3cd;
                border-left: 3px solid #ffc107;
                padding: 12px 15px;
                margin: 20px 0;
                border-radius: 4px;
                font-size: 14px;
                color: #856404;
            }}
            .footer {{
                background: #f8f9fa;
                padding: 20px;
                text-align: center;
                color: #6c757d;
                font-size: 13px;
                border-top: 1px solid #e9ecef;
            }}
            .footer a {{
                color: #007bff;
                text-decoration: none;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 You've been invited!</h1>
            </div>
            
            <div class="content">
                <div class="invite-box">
                    <p><strong>{inviter_name}</strong> has invited you to join</p>
                    <p style="font-size: 18px; margin: 10px 0;"><strong>{organization_name}</strong></p>
                    <p>on Oxy Engine as a <strong>{role.title()}</strong>.</p>
                </div>
                
                <div class="feature-list">
                    <h3>What is Oxy Engine?</h3>
                    <ul>
                        <li>Universal AI Gateway - Switch between OpenAI, Anthropic, and Google with one API key</li>
                        <li>Budget controls and usage tracking</li>
                        <li>Team collaboration and API key management</li>
                        <li>Real-time analytics and request logs</li>
                    </ul>
                </div>
                
                <center>
                    <a href="{invite_url}" class="cta-button">
                        Accept Invitation →
                    </a>
                </center>
                
                <div class="expiration-notice">
                    ⏰ <strong>This invitation expires in 48 hours.</strong> Accept it before {'{'}48h from now{'}'} to join the team.
                </div>
            </div>
            
            <div class="footer">
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                <p style="margin-top: 15px; color: #adb5bd;">
                    Oxy Engine - Universal AI Gateway<br>
                    This is an automated email. Please do not reply.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": EMAIL_FROM,
                    "to": [recipient_email],
                    "subject": f"Join {organization_name} on Oxy Engine",
                    "html": html_body
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                result = response.json()
                log.info("team_invite_email_sent", 
                        recipient=recipient_email, 
                        organization=organization_name,
                        resend_email_id=result.get("id"))
            else:
                log.error("team_invite_email_failed", 
                         status_code=response.status_code,
                         error=response.text[:500])
    except Exception as e:
        log.error("team_invite_email_exception", error=str(e), exc_info=True)


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/invite")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def invite_team_member(
    request: Request,
    req: TeamInviteRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Invite team member to organization.
    
    SECURITY: Only organization owners can invite.
    """
    try:
        # Check if user is owner
        is_owner = await check_is_owner(user_id, req.organization_id)
        if not is_owner:
            raise HTTPException(
                status_code=403,
                detail="Only organization owners can invite team members"
            )
        
        # Check if email already invited (pending)
        existing_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/team_invites",
            params={
                "select": "id,status",
                "organization_id": f"eq.{req.organization_id}",
                "email": f"eq.{req.email}",
                "status": "eq.pending"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        
        if existing_res.status_code == 200 and existing_res.json():
            raise HTTPException(
                status_code=400,
                detail="This email already has a pending invitation"
            )
        
        # Check if email is already a member
        member_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organization_members",
            params={
                "select": "user_id,profiles(email)",
                "organization_id": f"eq.{req.organization_id}"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        
        if member_res.status_code == 200:
            members = member_res.json()
            for member in members:
                if member.get("profiles", {}).get("email", "").lower() == req.email.lower():
                    raise HTTPException(
                        status_code=400,
                        detail="This user is already a member of the organization"
                    )
        
        # Generate secure token (32 bytes = 256 bits)
        invite_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(invite_token.encode()).hexdigest()
        
        # Create invite in database
        invite_res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/team_invites",
            headers=get_supabase_headers(prefer="return=representation"),
            json={
                "organization_id": req.organization_id,
                "email": req.email,
                "role": req.role,
                "invite_token_hash": token_hash,
                "invited_by": user_id
            },
            timeout=5.0
        )
        
        if invite_res.status_code not in [200, 201]:
            log.error("team_invite_create_failed", 
                     status_code=invite_res.status_code,
                     error=invite_res.text[:500])
            raise HTTPException(
                status_code=500,
                detail="Failed to create invitation"
            )
        
        # Get organization name
        org_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organizations",
            params={"select": "name", "id": f"eq.{req.organization_id}"},
            headers=get_supabase_headers(),
            timeout=5.0
        )
        org_name = org_res.json()[0]["name"] if org_res.status_code == 200 and org_res.json() else "Unknown Organization"
        
        # Get inviter name
        profile_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={"select": "full_name", "id": f"eq.{user_id}"},
            headers=get_supabase_headers(),
            timeout=5.0
        )
        inviter_name = profile_res.json()[0]["full_name"] if profile_res.status_code == 200 and profile_res.json() else "A team member"
        
        # Send invitation email
        await send_team_invite_email(
            recipient_email=req.email,
            organization_name=org_name,
            invite_token=invite_token,
            role=req.role,
            inviter_name=inviter_name
        )
        
        log.info("team_invite_created", 
                organization_id=req.organization_id,
                invited_email=req.email,
                invited_by=user_id,
                role=req.role)
        
        return {
            "status": "invited",
            "email": req.email,
            "expires_in_hours": 48
        }
    
    except HTTPException:
        raise
    except Exception as e:
        log.error("team_invite_failed", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to send invitation")


@router.post("/invite/accept")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def accept_team_invite(
    request: Request,
    req: InviteAcceptRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Accept team invitation.
    
    SECURITY: Uses cryptographically secure token validation.
    """
    try:
        # Call database function to accept invite
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/fn_accept_team_invite",
            headers=get_supabase_headers(),
            json={
                "p_invite_token": req.invite_token,
                "p_user_id": user_id
            },
            timeout=10.0
        )
        
        if res.status_code != 200:
            log.error("accept_invite_rpc_failed", 
                     status_code=res.status_code,
                     error=res.text[:500])
            raise HTTPException(status_code=500, detail="Failed to accept invitation")
        
        result = res.json()
        if not result or not result[0].get("success"):
            message = result[0].get("message", "Invalid invitation") if result else "Invalid invitation"
            raise HTTPException(status_code=400, detail=message)
        
        org_id = result[0].get("organization_id")
        org_name = result[0].get("organization_name")
        
        log.info("team_invite_accepted",
                user_id=user_id,
                organization_id=org_id,
                organization_name=org_name)
        
        return {
            "status": "accepted",
            "organization_id": org_id,
            "organization_name": org_name
        }
    
    except HTTPException:
        raise
    except Exception as e:
        log.error("accept_invite_failed", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to accept invitation")


@router.get("/invites")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def list_team_invites(
    request: Request,
    organization_id: str = Query(...),
    user_id: str = Depends(get_current_user_id)
):
    """
    List pending team invitations for organization.
    
    SECURITY: Only organization owners can view invites.
    """
    try:
        # Check if user is owner
        is_owner = await check_is_owner(user_id, organization_id)
        if not is_owner:
            raise HTTPException(
                status_code=403,
                detail="Only organization owners can view invitations"
            )
        
        # Get invites
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/team_invites",
            params={
                "select": "id,email,role,created_at,expires_at,status",
                "organization_id": f"eq.{organization_id}",
                "order": "created_at.desc"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch invitations")
        
        return res.json()
    
    except HTTPException:
        raise
    except Exception as e:
        log.error("list_invites_failed", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list invitations")


@router.delete("/invite/{invite_id}")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def revoke_team_invite(
    request: Request,
    invite_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Revoke team invitation.
    
    SECURITY: Only organization owners can revoke.
    """
    try:
        # Get invite to check organization
        invite_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/team_invites",
            params={
                "select": "organization_id,status",
                "id": f"eq.{invite_id}"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        
        if invite_res.status_code != 200 or not invite_res.json():
            raise HTTPException(status_code=404, detail="Invitation not found")
        
        invite = invite_res.json()[0]
        organization_id = invite["organization_id"]
        
        # Check if user is owner
        is_owner = await check_is_owner(user_id, organization_id)
        if not is_owner:
            raise HTTPException(
                status_code=403,
                detail="Only organization owners can revoke invitations"
            )
        
        # Revoke invite
        revoke_res = await resources.http_client.patch(
            f"{SUPABASE_URL}/rest/v1/team_invites",
            params={"id": f"eq.{invite_id}"},
            headers=get_supabase_headers(),
            json={"status": "revoked"},
            timeout=5.0
        )
        
        if revoke_res.status_code not in [200, 204]:
            raise HTTPException(status_code=500, detail="Failed to revoke invitation")
        
        log.info("team_invite_revoked", 
                invite_id=invite_id,
                organization_id=organization_id,
                revoked_by=user_id)
        
        return {"status": "revoked"}
    
    except HTTPException:
        raise
    except Exception as e:
        log.error("revoke_invite_failed", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to revoke invitation")

