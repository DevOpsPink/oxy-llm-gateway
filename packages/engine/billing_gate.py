"""
Stripe billing is optional.

A self-hosted deployment runs without Stripe: plan limits, usage counters and
subscription status are read from Postgres and keep working. Only the endpoints
that call Stripe (checkout, webhooks, plan changes, add-on purchases) need
STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET; without them they answer 503.
"""

import os

from fastapi import HTTPException


def billing_enabled() -> bool:
    return bool(os.getenv("STRIPE_SECRET_KEY") and os.getenv("STRIPE_WEBHOOK_SECRET"))


async def require_billing() -> None:
    """FastAPI dependency for endpoints that call Stripe."""
    if not billing_enabled():
        raise HTTPException(
            status_code=503,
            detail="Billing is disabled on this deployment: STRIPE_SECRET_KEY and "
            "STRIPE_WEBHOOK_SECRET are not set.",
        )
