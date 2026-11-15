"""A stand-in for require_org_admin's role lookup in organization_members."""


class _Res:
    def __init__(self, data, status_code=200):
        self._data = data
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("HTTP %d" % self.status_code)

    def json(self):
        return self._data


class RoleAwareClient:
    """Answers the role lookup with `role` (None: no active membership row; "error":
    the database fails) and hands every other call to the test's own fake client."""

    def __init__(self, inner=None, role="owner"):
        self.inner = inner
        self.role = role
        self.lookups = []

    async def get(self, url, params=None, headers=None, **kwargs):
        if url.endswith("/organization_members") and (params or {}).get("select") == "role":
            self.lookups.append(params)
            if self.role == "error":
                return _Res({"message": "unavailable"}, 503)
            return _Res([] if self.role is None else [{"role": self.role}])
        return await self.inner.get(url, params=params, headers=headers)

    def __getattr__(self, name):
        return getattr(self.inner, name)
