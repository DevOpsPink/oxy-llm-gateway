from routes.intelligence import compute_security_score, SecurityScoreInputs


def test_security_score_improves_with_stricter_controls():
    lax = SecurityScoreInputs(
        budgets_configured=False,
        dlp_enabled=False,
        privacy_mode="debug_full",
        key_rotation_age_days=365,
        rate_limit_enabled=False,
        response_cache_enabled=False,
    )
    strict = SecurityScoreInputs(
        budgets_configured=True,
        dlp_enabled=True,
        privacy_mode="zero_prompt_logging",
        key_rotation_age_days=30,
        rate_limit_enabled=True,
        response_cache_enabled=True,
    )

    lax_score = compute_security_score(lax)["score"]
    strict_score = compute_security_score(strict)["score"]

    assert strict_score > lax_score
    assert compute_security_score(lax)["grade"] in {"D", "F"}
    assert compute_security_score(strict)["grade"] in {"A", "B"}


def test_security_score_deterministic_for_same_input():
    inputs = SecurityScoreInputs(
        budgets_configured=True,
        dlp_enabled=True,
        privacy_mode="metadata_only",
        key_rotation_age_days=120,
        rate_limit_enabled=True,
        response_cache_enabled=False,
    )
    s1 = compute_security_score(inputs)
    s2 = compute_security_score(inputs)
    assert s1["score"] == s2["score"]
    assert s1["grade"] == s2["grade"]
from routes.intelligence import SecurityScoreInputs, compute_security_score


def test_security_score_strong_controls_gets_a_grade():
    inputs = SecurityScoreInputs(
        budgets_configured=True,
        dlp_enabled=True,
        privacy_mode="zero_prompt_logging",
        key_rotation_age_days=30,
        rate_limit_enabled=True,
        response_cache_enabled=True,
    )

    result = compute_security_score(inputs)

    assert result["grade"] == "A"
    assert result["score"] == 100
    assert {"budgets", "dlp", "privacy_mode", "key_rotation", "rate_limits", "response_cache"} <= {
        d["key"] for d in result["details"]
    }


def test_security_score_missing_controls_penalized():
    inputs = SecurityScoreInputs(
        budgets_configured=False,
        dlp_enabled=False,
        privacy_mode="debug_full",
        key_rotation_age_days=200,
        rate_limit_enabled=False,
        response_cache_enabled=False,
    )

    result = compute_security_score(inputs)

    assert result["grade"] == "F"
    assert result["score"] == 0
    # Ensure penalties are recorded
    penalties = {d["key"]: d["points"] for d in result["details"]}
    assert penalties["budgets"] < 0
    assert penalties["dlp"] < 0
