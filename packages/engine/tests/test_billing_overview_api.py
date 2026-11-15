from fastapi.testclient import TestClient
from fastapi import FastAPI

from routes.billing_overview import router as billing_overview_router


def build_app():
    app = FastAPI()
    app.include_router(billing_overview_router)

    # Stub auth dependency
    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import billing_overview as b
    b.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    # Stub plan/referral/usage/credits
    async def fake_fetch_org_plan(_org_id: str) -> str:
        return "free"

    async def fake_get_usage(_org_id: str, month=None) -> int:
        return 12345

    async def fake_referral_code(_org_id: str):
        return "OXY-ABCDE"

    class FakeBudget:
        async def get_credits_balance(self, org_id):
            return 100

    b._fetch_org_plan = fake_fetch_org_plan  # type: ignore
    b.get_org_monthly_usage = fake_get_usage  # type: ignore
    b._fetch_referral_code = fake_referral_code  # type: ignore
    b.BudgetManager = lambda _redis: FakeBudget()  # type: ignore

    return app


def test_billing_overview_returns_fields():
    app = build_app()
    client = TestClient(app)

    r = client.get("/v1/billing/overview", headers={"Authorization": "Bearer oxy_live"})
    assert r.status_code == 200
    data = r.json()
    assert data["plan"] == "free"
    assert data["free_plan_limit_per_month"] == 100000
    assert data["free_plan_usage_this_month"] == 12345
    assert data["referral_code"] == "OXY-ABCDE"
    assert data["referral_credits_usd"] == 100.0

