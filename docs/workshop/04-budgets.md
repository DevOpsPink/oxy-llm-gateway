# Module 4. Budgets

**Time:** 10 minutes.
**You leave with:** a refusal for money that was never spent, the reservation behind it, and the reason a budget cannot be overspent.

A budget in Oxy is the most a project may spend in total, across all of its keys. Before the gateway calls a provider, it reserves its estimate of the most the request could cost against the budget; after the answer, it settles the real cost and releases the rest. Module 3 showed where this sits in the order of checks. Here you watch a reservation fail.

## 1. Lower the budget

1. On the Control Plane (<http://localhost:3000/dashboard>), press **Settings** above the key list. **Project Settings** opens.
2. Set **Budget limit, total spend ($)** to `0.01` and press **Save Changes**. The dashboard confirms "Project updated successfully!".

One cent. Saving drops the project's keys from the gateway's cache, so the next request already reads the new limit.

## 2. Ask for more than the budget can cover

```bash
curl -s -w '\nHTTP %{http_code}\n' localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer $OXY_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'
```

**Expected output:**

```
{"detail":{"error":{"code":"BUDGET_EXCEEDED","message":"Budget limit of $0.01 exceeded.","hint":"Ask an operator to raise the project's budget_limit. Do not retry until it changes.","context":{"budget_limit":0.01,"current_spend":0.000629}}}}
HTTP 402
```

`402 Payment Required`, and look at the numbers: the project has spent well under its one cent. The answer is still no, because of what the request might cost, not what was spent.

## 3. Read the reservation

The engine logs each reservation. The last one it granted was for a `gpt-4o` request in Module 2, while the budget was still $10:

```bash
docker compose logs --no-log-prefix engine | grep '"budget_reserved"' | tail -1 | jq -c '{amount, new_spend}'
```

**Expected output:**

```
{"amount":"0.037500","new_spend":"0.038004"}
```

The gateway set aside 3.75 cents for a single `gpt-4o` request: its estimate of the most the request could cost, worked out from the model's prices in the engine's pricing table. Against a one-cent budget that reservation cannot fit, so step 2 was refused before anything was called. A cheaper model reserves less:

```bash
curl -s -o /dev/null -w 'HTTP %{http_code}\n' localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer $OXY_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}]}'
docker compose logs --no-log-prefix engine | grep '"budget_reserved"' | tail -1 | jq -c '{amount, new_spend}'
```

**Expected output:**

```
HTTP 200
{"amount":"0.001425","new_spend":"0.002054"}
```

That reservation fits, so the request went through. `new_spend` is what was spent plus what is reserved at that moment; once the answer is settled, only its real cost stays.

In mock mode each answer is billed as 10 prompt and 5 completion tokens, so the spend barely moves and the reservation decides. With a real provider the settled cost is the real one, the project's spend grows with every answer, and the **Budget Usage** card fills up until the reservations stop fitting.

The refusal answers guess **a** from Module 3. Its body tells the caller what to do: ask an operator to raise the budget, and do not retry until it changes. An agent that retries every error would otherwise keep knocking on a project whose money is gone.

## 4. See it in the dashboard

On **Requests** (<http://localhost:3000/dashboard/requests>), the refused `gpt-4o` request is a row with the status **Blocked**; the `gpt-4o-mini` one after it is **Mock**.

Leave the budget at one cent: Module 5 starts from here.

## Why it cannot be overspent

Reserving is one atomic step in Redis: a single Lua script checks the limit and adds the reservation, so two requests at the same moment cannot both take the last of the budget. The README's [Proofs](../../README.md#proofs) measure it: 501 requests, 100 at a time, against a $0.05 budget, and the provider served exactly what the budget buys. If Redis cannot be reached, a request against a budget is refused with 503 rather than served unchecked.

## Check yourself

- The project has spent 0.06 cents of a one-cent budget. Why is a `gpt-4o` request refused? (Its reservation, 3.75 cents, does not fit in what is left.)
- Two services share the project with different keys, and one of them uses the budget up. What does the other get? (402 as well: the budget belongs to the project, not to the key.)
- Is a budget reset at the start of a month? (No. It is the project's total spend; the README says "nothing resets it".)

Next: [Module 5. DLP](05-dlp.md)
