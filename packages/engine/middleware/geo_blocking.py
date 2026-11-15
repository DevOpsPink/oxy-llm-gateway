"""
Geo-blocking middleware (best-effort, IP/header based).

Goals (Core 0.1 GA):
- Deterministic, documented behavior.
- Configurable blocklists (no hard-coded legal advice).
- Clear error shape: error.code == "geo_blocked".
- Prefer Cloudflare / proxy headers; fall back to IP lookup if explicitly enabled.
- Fail-safe documented (default: allow + log when country unknown).
"""

import os
from typing import Dict, Optional, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse

from core import log
from security_utils import log_error_safe

DEFAULT_BLOCKED_COUNTRIES = {"KP", "IR", "SY", "CU"}
DEFAULT_STATUS_CODE = 451
SKIP_PATHS = {"/health", "/metrics"}


def _env_bool(key: str, default: bool) -> bool:
    return os.getenv(key, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _parse_csv_env(key: str, default: set[str]) -> set[str]:
    raw = os.getenv(key)
    if not raw:
        return default
    return {item.strip().upper() for item in raw.split(",") if item.strip()}


def load_geo_config() -> Dict:
    blocked_countries = _parse_csv_env("GEO_BLOCKED_COUNTRIES", DEFAULT_BLOCKED_COUNTRIES)
    blocked_regions = _parse_csv_env("GEO_BLOCKED_REGIONS", set())

    try:
        status_code = int(os.getenv("GEO_BLOCK_STATUS_CODE", str(DEFAULT_STATUS_CODE)))
    except ValueError:
        status_code = DEFAULT_STATUS_CODE

    return {
        "enabled": _env_bool("ENABLE_GEO_BLOCKING", False),
        "blocked_countries": blocked_countries,
        "blocked_regions": blocked_regions,
        "fail_open_on_unknown": _env_bool("GEO_FAIL_OPEN_ON_UNKNOWN", True),
        "enable_ip_lookup": _env_bool("GEO_ENABLE_IP_LOOKUP", False),
        "status_code": status_code,
    }


def get_remote_address(request: Request) -> str:
    """Get client IP from common proxy headers, fallback to client host."""
    cf_connecting_ip = request.headers.get("CF-Connecting-IP")
    if cf_connecting_ip:
        return cf_connecting_ip.strip()

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.client.host if request.client else "unknown"


def country_from_headers(request: Request) -> Tuple[Optional[str], str]:
    """Return (country_code, source)."""
    header_keys = [
        ("CF-IPCountry", "cf_ipcountry"),
        ("X-Country-Code", "x_country_code"),
        ("X-Geo-Country", "x_geo_country"),
        ("X-Appengine-Country", "appengine_country"),
    ]
    for header, source in header_keys:
        value = request.headers.get(header)
        if value:
            return value.strip().upper(), source
    return None, "unknown"


async def geo_blocking_middleware(request: Request, call_next):
    """
    Best-effort geo blocking using headers first, optional IP lookup second.
    Behavior is configurable via env; defaults fail open on unknown.
    """
    config = load_geo_config()
    if not config["enabled"]:
        return await call_next(request)

    if request.url.path in SKIP_PATHS:
        return await call_next(request)

    country, source = country_from_headers(request)

    if not country and config["enable_ip_lookup"]:
        # IP lookup is optional; when enabled, keep it short and logged.
        client_ip = get_remote_address(request)
        lookup_country = await _lookup_country_for_ip(client_ip)
        if lookup_country:
            country = lookup_country
            source = "ip_lookup"

    if not country:
        log.info(
            "geo_country_unknown",
            path=request.url.path,
            source=source,
        )
        if config["fail_open_on_unknown"]:
            return await call_next(request)
        return _geo_block_response(config, country="unknown", source=source, reason="country_unknown")

    if country in config["blocked_countries"]:
        log.warn(
            "geo_blocked_request",
            country=country,
            source=source,
            path=request.url.path,
        )
        return _geo_block_response(config, country=country, source=source, reason="country_blocked")

    region = request.headers.get("X-Region-Code", "").strip().upper()
    if region and region in config["blocked_regions"]:
        log.warn(
            "geo_blocked_region_request",
            country=country,
            region=region,
            source=source,
            path=request.url.path,
        )
        return _geo_block_response(config, country=country, source=source, reason="region_blocked", region=region)

    return await call_next(request)


async def _lookup_country_for_ip(ip: str) -> Optional[str]:
    """Optional IP lookup when headers are missing; kept minimal and best-effort."""
    import httpx  # local import to avoid cost when disabled

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"http://ip-api.com/json/{ip}")
            if response.status_code == 200:
                data = response.json()
                return data.get("countryCode")
    except Exception as exc:
        log_error_safe(log, "ip_geolocation_failed", exc, ip_hint=_redact_ip(ip))
    return None


def _geo_block_response(
    config: Dict,
    country: str,
    source: str,
    reason: str,
    region: Optional[str] = None,
) -> JSONResponse:
    error_body = {
        "error": {
            "code": "geo_blocked",
            "message": "Requests from this region are not allowed.",
            "country": country,
            "source": source,
            "reason": reason,
        }
    }
    if region:
        error_body["error"]["region"] = region

    return JSONResponse(
        status_code=config.get("status_code", DEFAULT_STATUS_CODE),
        content=error_body,
    )


def _redact_ip(ip: str) -> str:
    """Avoid leaking full IPs; keep coarse prefix only."""
    if ip in {"", "unknown", None}:  # type: ignore
        return "unknown"
    parts = ip.split(".")
    if len(parts) == 4:
        return ".".join(parts[:2] + ["xx", "xx"])
    return ip[:4] + "…"  # fallback for IPv6/other formats

