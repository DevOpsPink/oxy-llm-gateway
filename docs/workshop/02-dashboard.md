# Module 2. The dashboard: spend, keys and refusals

**Time:** 10 minutes.
**You leave with:** the four dashboard pages a project owner opens most, and where each fact you will produce in this lab shows up.

The dashboard is at <http://localhost:3000/dashboard>, signed in as the user from Module 1. Send it something to show first.

## 1. A little traffic

Five requests, one after another:

```bash
for i in 1 2 3 4 5; do
  oxy -s -o /dev/null -w '%{http_code}\n' localhost:8000/v1/chat/completions \
    -H 'Content-Type: application/json' \
    -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'
done
```

**Expected output:**

```
200
200
200
200
200
```

## 2. Control Plane: spend

Open <http://localhost:3000/dashboard>, or reload it if it is already open.

- **Budget Usage**: what the project has spent out of its budget ($10.00 since onboarding). The gateway keeps the live counter in Redis and copies it to Postgres every 60 seconds, and the card reads the copy, so it can trail your requests by up to a minute.
- **Total Requests**: every request with a row in the audit trail, the `ping` from Module 1 included.
- **Threats Blocked**: requests refused because they carried a secret. It is 0 for now; Module 5 changes that. A budget refusal or a killed session is a refusal too, but not a threat, so neither counts here.
- **API Keys**: the project's keys, by prefix only. The full key exists in your shell and nowhere in the dashboard; the gateway stores a hash of it.

When this lab was tested, the cards read **$0.00** / $10.00, **7** and **0** a minute after these requests. Seven requests: the `ping` and the `hello` from Module 1, and these five. The spend shows $0.00 because a mock answer costs a fraction of a cent; Module 4 shows what the budget is really doing.

The **Settings** button above the key list opens the project's name and budget; Module 4 uses it.

## 3. Requests: every request, refused or not

Open **Requests** (<http://localhost:3000/dashboard/requests>). Each request is a row: time, provider, model, status, latency, tokens and cost. Your five requests are there with the status **Mock**. Refused requests appear here too, with the status **Blocked**, from Module 4 on.

## 4. API Keys: create and revoke

Open **API Keys** (<http://localhost:3000/dashboard/api-keys>). Next to the prefix of each key are its status and a **Revoke** button. You will use it at the end of Module 7.

## 5. Audit Log and Privacy

- **Audit Log** (<http://localhost:3000/dashboard/audit>) lists changes made by people and keys, such as a killed agent session. It is empty for now; Module 6 adds an entry.
- **Privacy** (<http://localhost:3000/dashboard/privacy>) shows what the gateway keeps of each request. The current mode is **Metadata only**: token counts, costs and status, no prompts and no answers. Module 7 checks that on the rows.

## Check yourself

- You sent a request and the Budget Usage card did not move. Is the request missing? (Not necessarily: the card can trail by up to a minute. The **Requests** page shows the row at once.)
- Where would you look for a request that was refused? (**Requests**, status **Blocked**. Module 7 shows where its reason is kept.)

Next: [Module 3. The rules, before they bite](03-rules.md)
