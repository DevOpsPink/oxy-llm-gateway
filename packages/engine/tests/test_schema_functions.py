"""Every database function the engine calls exists in the schema it ships.

v1.0.1 called fn_create_project, fn_update_project, fn_delete_project and
fn_disconnect_provider, which db/ never created: the dashboard's project and
provider buttons answered 500 on every stack. The engine is read as text here,
so a call to a missing function fails this test before any stack starts.
"""
import re
from pathlib import Path

ENGINE = Path(__file__).resolve().parent.parent
DB = ENGINE.parent.parent / "db"

# Called by code the README lists as not wired in this release, each answering
# an error of its own; remove a name once its function lands in db/.
NOT_WIRED = {
    "fn_accept_team_invite",         # POST /management/team/invite/accept answers 501
    "fn_increment_referral_count",   # referral redeem
    "fn_increment_usage",            # subscription usage; only with a subscription row
    "fn_get_sso_provider_by_domain", # SSO: /auth/sso/callback answers 501
    "fn_configure_sso",
    "fn_sso_auto_join_user",
    "exec_sql",                      # workers/dunning_emails.py
    "fn_execute_raw_sql",            # workers/intelligence_aggregator.py
}

CALL = re.compile(r"""rpc/([a-z_0-9]+)|\.rpc\(\s*['"]([a-z_0-9]+)['"]""")
DEFINE = re.compile(r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?\"?([a-z_0-9]+)", re.I)


def called():
    names = {}
    for path in ENGINE.rglob("*.py"):
        if "tests" in path.parts:
            continue
        for m in CALL.finditer(path.read_text(encoding="utf-8")):
            names.setdefault(m.group(1) or m.group(2), set()).add(str(path.relative_to(ENGINE)))
    return names


def defined():
    names = set()
    for path in list(DB.rglob("*.sql")) + list(DB.rglob("*.sh")):
        names.update(m.group(1) for m in DEFINE.finditer(path.read_text(encoding="utf-8")))
    return names


def test_every_called_function_exists_in_the_schema():
    missing = {name: sorted(where) for name, where in called().items()
               if name not in defined() and name not in NOT_WIRED}
    assert missing == {}, "the engine calls database functions db/ never creates: %s" % missing


def test_the_not_wired_list_holds_only_missing_functions():
    # A function that now exists, or is no longer called, leaves the list.
    stale = {name for name in NOT_WIRED if name in defined() or name not in called()}
    assert stale == set()


def test_deleting_a_key_never_erases_its_audit_rows():
    # request_logs.api_key_id cascaded on delete up to 1.0.2. Keys are revoked, not
    # deleted, and a delete made by hand must leave the audit rows (SET NULL).
    schema = (DB / "schema.sql").read_text(encoding="utf-8")
    table = schema[schema.index("CREATE TABLE IF NOT EXISTS request_logs ("):]
    table = table[:table.index(");")]
    line = next(l for l in table.splitlines() if l.strip().startswith("api_key_id "))
    assert "REFERENCES api_keys(id) ON DELETE SET NULL" in line, line
