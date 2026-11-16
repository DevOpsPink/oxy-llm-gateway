# Module 7. The audit row

**Time:** 10 minutes.
**You leave with:** the rows your requests left, proof that your prompts were not kept, the answers to Module 3, and a clean machine.

Every request you sent in this lab with a valid key left a row in the `request_logs` table: the ones that were answered, the `ping` from Module 1, and the ones that were refused, with the reason. The dashboard's **Requests** page and the CSV export read the same table. Here you read it directly.

## 1. Your requests, by outcome

```bash
docker compose exec postgres psql -U postgres -d oxy -c "
select status, provider, threat_type, count(*)
from request_logs group by 1, 2, 3 order by 4 desc;"
```

**Expected output** (your counts depend on how many requests you sent):

```
 status  |    provider     |    threat_type     | count
---------+-----------------+--------------------+-------
 mock    | openai          | none               |    11
 blocked | blocked         | github_token       |     2
 blocked | blocked         | session_terminated |     2
 blocked | blocked         | credit_card        |     1
 success | oxy-healthcheck | none               |     1
 blocked | blocked         | budget_exceeded    |     1
(6 rows)
```

- `mock` rows are requests the gateway answered in mock mode; `provider` says which provider would have been called.
- The `success` row from `oxy-healthcheck` is the `ping` from Module 1, which the gateway answered itself.
- `blocked` rows are refusals. `provider` is `blocked`, because nothing was called, and `threat_type` holds the reason: `budget_exceeded` (Module 4), `github_token` and `credit_card` (Module 5), `session_terminated` (Module 6).

If you ran every step and nothing else, that is 18 rows for 18 requests: 2 in Module 1, 5 in Module 2, 2 in Module 4, 5 in Module 5 and 4 in Module 6.

## 2. The newest rows

```bash
docker compose exec postgres psql -U postgres -d oxy -c "
select to_char(created_at, 'HH24:MI:SS') as time, model, status, threat_type,
       cost_usd, latency_ms, privacy_mode
from request_logs order by created_at desc limit 6;"
```

**Expected output:**

```
   time   |    model    | status  |    threat_type     | cost_usd | latency_ms | privacy_mode
----------+-------------+---------+--------------------+----------+------------+---------------
 04:17:07 | gpt-4o-mini | mock    | none               | 0.000004 |          9 | metadata_only
 04:17:07 | gpt-4o-mini | blocked | session_terminated | 0.000000 |          5 | metadata_only
 04:17:07 | gpt-4o-mini | blocked | session_terminated | 0.000000 |          7 | metadata_only
 04:17:07 | gpt-4o-mini | mock    | none               | 0.000004 |         18 | metadata_only
 04:17:06 | gpt-4o-mini | mock    | none               | 0.000004 |         11 | metadata_only
 04:17:06 | gpt-4o-mini | blocked | credit_card        | 0.000000 |          7 | metadata_only
(6 rows)
```

A refusal costs nothing (`cost_usd` 0): the gateway answers it before any provider is involved.

## 3. What was not kept

In modules 5 and 6 you sent three GitHub tokens and a card number. Count the rows that kept any prompt at all:

```bash
docker compose exec postgres psql -U postgres -d oxy -c "
select count(*) as rows_with_a_prompt from request_logs where prompt_snapshot is not null;"
```

**Expected output:**

```
 rows_with_a_prompt
--------------------
                  0
(1 row)
```

The organization is in the default privacy mode, `metadata_only` (Module 3), so the row says that a GitHub token was refused and when, and does not keep the token. Under `zero_prompt_logging` it keeps even less; `debug_full` keeps prompts only when the operator has also set `OXY_DEBUG_FULL_LOGS=true` on the engine.

## 4. The same trail through the API

This is what the dashboard's **Requests** page reads, with your key instead of a browser session:

```bash
oxy -s "localhost:8000/v1/requests?limit=2" | jq '.items[] | {created_at, model, status, cost_usd}'
```

**Expected output:**

```
{
  "created_at": "2026-11-16T04:17:07.43203+00:00",
  "model": "gpt-4o-mini",
  "status": "mock",
  "cost_usd": 0.000004
}
{
  "created_at": "2026-11-16T04:17:07.279572+00:00",
  "model": "gpt-4o-mini",
  "status": "blocked",
  "cost_usd": 0.0
}
```

And as a CSV file for a spreadsheet or a finance team:

```bash
oxy -s localhost:8000/v1/exports/requests.csv | head -3
```

**Expected output:**

```
id,created_at,provider,model,status,latency_ms,prompt_tokens,completion_tokens,total_tokens,cost_usd,project_id
26ec4944-d403-4268-891e-a8a672108d03,2026-11-16T04:17:07.43203+00:00,openai,gpt-4o-mini,mock,9,10,5,15,4e-06,698a7f6e-19c3-48e5-8893-8d7321d4dcd0
fb3e9619-6299-4426-b657-0ef683434afd,2026-11-16T04:17:07.279572+00:00,blocked,gpt-4o-mini,blocked,5,0,0,0,0.0,698a7f6e-19c3-48e5-8893-8d7321d4dcd0
```

The API and the export give the status of each request; the reason for a refusal (`threat_type`) is in the row itself, as in step 1.

## 5. The answers to Module 3

| # | The request | Answer | Seen in |
|---|---|---|---|
| a | A request the budget cannot cover | `402 BUDGET_EXCEEDED` | Module 4 |
| b | A GitHub token in the prompt | `451 DLP_BLOCKED` | Module 5 |
| c | A GitHub token, in a request the budget cannot cover | `451 DLP_BLOCKED`: DLP runs before the budget | Module 5 |
| d | A request in a killed session | `410 session_terminated` | Module 6 |
| e | A GitHub token in a killed session | `410 session_terminated`: the kill switch runs before DLP | Module 6 |
| f | A key revoked a second ago | `401` | next step |

## 6. Revoke the key

Count your rows first:

```bash
docker compose exec postgres psql -U postgres -d oxy -c "select count(*) as rows from request_logs;"
```

**Expected output:**

```
 rows
------
   18
(1 row)
```

Then revoke the key you have used all along:

1. Open **API Keys** (<http://localhost:3000/dashboard/api-keys>).
2. In the row whose prefix matches your key, press **Revoke** and confirm "Revoke this API key? It stops working at once."

```bash
oxy -s -w '\nHTTP %{http_code}\n' localhost:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}]}'
```

**Expected output:**

```
{"detail":"Invalid API key"}
HTTP 401
```

At once, although the gateway had the key in its cache a moment ago. That is guess **f**, and the way to stop everything a key can do, where the kill switch stops one session. The key stays on the API Keys page as **Inactive**.

Count the rows again:

```bash
docker compose exec postgres psql -U postgres -d oxy -c "select count(*) as rows from request_logs;"
```

**Expected output:**

```
 rows
------
   18
(1 row)
```

The same number. Revoking a key stops it; it does not touch what the key did, so the refusals you read in step 1 are still there for whoever reviews them later. The request you just made with the revoked key has no row: with no valid key, the gateway cannot tell which organization's trail it belongs to, and answers 401 before it looks.

## 7. Clean up

```bash
docker compose down -v
unset OXY_API_KEY TOKEN ANON_KEY PROJECT_ID AGENT_ID SESSION_ID LINK
```

`down -v` removes the containers and the volumes: the users, the keys, the agent and every row you read in this module. The images the lab built and pulled stay, so the next `docker compose up` is quicker; `docker compose down -v --rmi all` removes them as well.

## Where to go next

- The [Proofs](../../README.md#proofs) in the README measure the same controls under load against a recording fake provider, and plant the bug each one exists to catch. The three commands under that table run them on your machine.
- To send real traffic, connect a real provider key in **Settings** instead of the placeholder. Every check you saw today runs the same way; the answer then comes from the provider.
