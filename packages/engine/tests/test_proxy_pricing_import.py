from decimal import Decimal

from routes import proxy
from providers import PricingEngine


def test_estimate_max_cost_uses_pricing_engine(monkeypatch):
    calls = {}

    def fake_calculate(model, prompt_tokens, completion_tokens):
        calls["called"] = True
        calls["args"] = (model, prompt_tokens, completion_tokens)
        return Decimal("0.42")

    monkeypatch.setattr(PricingEngine, "calculate_cost", staticmethod(fake_calculate))

    result = proxy.estimate_max_cost_for_model("gpt-4", num_messages=2)
    assert result == Decimal("0.42")
    assert calls["called"] is True
    # ensure max token calculation still positive
    assert calls["args"][1] > 0 and calls["args"][2] > 0

