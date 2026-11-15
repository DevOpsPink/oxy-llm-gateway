import re
import hashlib
import secrets
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from core import resources, SUPABASE_URL, log
from core.audit import log_admin_event
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers

router = APIRouter(prefix="/v1/team", tags=["team"])
# The dashboard calls these routes with its session; scripts with an Oxy API key.
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key, allow_session=True)

ALLOWED_ROLES = {"developer", "viewer"}  # the values team_invites.role accepts for an invite


class InviteCreateRequest(BaseModel):
    email: str = Field(..., max_length=255)
    role: str = Field("developer")  # team_invites.role allows owner, developer, viewer

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Invalid email")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ALLOWED_ROLES:
            raise ValueError("Invalid role")
        return v


async def _fetch_members(org_id: str) -> List[Dict[str, Any]]:
    # Two-step fetch to sidestep PostgREST 300 Multiple Choices.
    # organization_members.user_id and profiles.id both FK to auth.users.id,
    # which PostgREST treats as an ambiguous embed path. Fetching profiles in
    # a second query keyed by user_id is simpler than annotating the schema.
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/organization_members",
        params={
            "organization_id": f"eq.{org_id}",
            "select": "id,user_id,role,created_at",
            "order": "created_at.asc",
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    rows = res.json() or []
    if not rows:
        return []

    user_ids = sorted({r["user_id"] for r in rows if r.get("user_id")})
    profiles_by_id: Dict[str, Dict[str, Any]] = {}
    if user_ids:
        prof_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={
                "id": f"in.({','.join(user_ids)})",
                "select": "id,email,full_name",
            },
            headers=get_supabase_headers(),
        )
        prof_res.raise_for_status()
        for p in prof_res.json() or []:
            profiles_by_id[p["id"]] = p

    members = []
    for r in rows:
        prof = profiles_by_id.get(r.get("user_id")) or {}
        members.append(
            {
                "id": r.get("id"),
                "user_id": r.get("user_id"),
                "email": prof.get("email"),
                "name": prof.get("full_name"),
                "role": r.get("role"),
                "joined_at": r.get("created_at"),
            }
        )
    return members


async def _fetch_invites(org_id: str) -> List[Dict[str, Any]]:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/team_invites",
        params={
            "organization_id": f"eq.{org_id}",
            "select": "id,email,role,status,created_at,expires_at",
            "order": "created_at.desc",
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    return res.json() or []


@router.get("")
async def get_team(key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    members, invites = await _fetch_members(org_id), await _fetch_invites(org_id)
    return {"members": members, "invites": invites}


@router.post("/invites")
async def create_invite(
    body: InviteCreateRequest,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    user_id = key_data["user_id"]

    # prevent duplicate pending invite
    existing = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/team_invites",
        params={
            "organization_id": f"eq.{org_id}",
            "email": f"eq.{body.email}",
            "status": "eq.pending",
            "select": "id",
            "limit": "1",
        },
        headers=get_supabase_headers(),
    )
    existing.raise_for_status()
    if existing.json():
        raise HTTPException(status_code=400, detail="Invite already pending for this email")

    invite_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(invite_token.encode()).hexdigest()

    res = await resources.http_client.post(
        f"{SUPABASE_URL}/rest/v1/team_invites",
        headers={**get_supabase_headers(), "Prefer": "return=representation"},
        json={
            "organization_id": org_id,
            "email": body.email,
            "role": body.role,
            "invite_token_hash": token_hash,
            "invited_by": user_id,
        },
    )
    if res.status_code not in [200, 201]:
        raise HTTPException(status_code=500, detail="Failed to create invite")
    rows = res.json() or []
    invite = rows[0]
    try:
        await log_admin_event(
            organization_id=org_id,
            event_type="team.invite.created",
            actor_id=user_id,
            actor_type="api_key",
            metadata={"invite_id": invite.get("id"), "email": body.email, "role": body.role},
        )
    except Exception:
        pass
    return invite


@router.delete("/invites/{invite_id}")
async def revoke_invite(invite_id: str, key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    res = await resources.http_client.patch(
        f"{SUPABASE_URL}/rest/v1/team_invites",
        params={"id": f"eq.{invite_id}", "organization_id": f"eq.{org_id}"},
        headers={**get_supabase_headers(), "Prefer": "return=representation"},
        json={"status": "revoked"},
    )
    if res.status_code not in [200, 204]:
        raise HTTPException(status_code=500, detail="Failed to revoke invite")
    rows = res.json() or []
    if not rows:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite = rows[0]
    try:
        await log_admin_event(
            organization_id=org_id,
            event_type="team.invite.revoked",
            actor_id=key_data.get("user_id"),
            actor_type="api_key",
            metadata={"invite_id": invite_id, "email": invite.get("email")},
        )
    except Exception:
        pass
    return {"status": "ok"}

