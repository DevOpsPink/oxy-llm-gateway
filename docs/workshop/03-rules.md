# Module 3. The rules, before they bite

**Time:** 10 minutes.
**You leave with:** the order in which Oxy checks a request, a written guess for six refusals, and the places where each rule is written down.

A gateway that refuses requests is only useful if the people behind the requests can predict the refusals. Everything in this module comes from the repository you cloned, so you read the rules where the code keeps them.

## 1. The order of the checks

The request path documents its own order. Print it:

```bash
sed -n '/Flow:/,/Log request/p' packages/engine/routes/proxy.py
```

**Expected output:**

```
    Flow:
    1. Extract API key metadata (user_id, project_id, budget_limit)
    2. Burst rate limiting (10 req/sec)
    3. Organization suspension
    4. Agent and session checked against the key's organization; kill switch
    5. DLP, then budget reservation (atomic Redis Lua; refused when it cannot be checked)
    6. Parse request body
    7. Route to appropriate provider
    8. Stream/return response
    9. Log request + adjust budget
```

Three things follow from this list, and the next modules test each of them:

- The kill switch (step 4) comes before DLP (step 5). A request in a killed session is refused for the session, whatever it carries.
- DLP comes before the budget. A request with a secret in it is refused before the budget is even asked, so a refusal costs nothing.
- The budget is reserved before the provider is called (step 7) and settled after the answer (step 9). The gateway never asks the provider first and counts the money later.

## 2. Guess the answers

Write down, for each request, the HTTP status you expect. Modules 4 to 7 give the answers.

| # | The request | Your guess |
|---|---|---|
| a | A request the project's budget cannot cover | |
| b | A GitHub token in the prompt | |
| c | A GitHub token in the prompt, in a request the budget cannot cover | |
| d | A request in an agent session that was killed | |
| e | A GitHub token in the prompt, in a killed session | |
| f | A request with a key that was revoked a second ago | |

Hint: Oxy uses distinct codes for distinct reasons, so a client can tell "change something and retry" from "stop".

## 3. What DLP looks for

DLP is a list of patterns in the engine's code. Print their names:

```bash
sed -n '/^DLP_PATTERNS = {/,/^}/p' packages/engine/core.py | grep -oE '^ +"[a-z_]+"' | tr -d ' "'
```

**Expected output:**

```
openai_key
anthropic_key
aws_key
stripe_key
jwt
private_key
github_token
slack_token
google_api_key
credit_card
```

Ten patterns: provider and platform keys, tokens, private keys and card numbers. An email address is not on the list, and the [README](../../README.md#feature-surface) says so: "Email addresses alone are not blocked." DLP is regex matching, so it catches what looks like these secrets and nothing else; Module 5 shows both sides.

## 4. What a budget is

```bash
grep -n "nothing resets it" README.md | cut -c1-120
```

**Expected output:**

```
211:- **A budget is the project's total spend**, not a monthly allowance: nothing resets it. The Redis counter is the le
```

A budget belongs to a project, and every key of the project spends from it. It is a total, not a monthly allowance. Read the whole line in the README's [Scope and honest limitations](../../README.md#scope-and-honest-limitations): it also says how far the dashboard's spend figure can lag behind.

## 5. What the gateway keeps of your prompt

```bash
grep -n 'DEFAULT_MODE = ' packages/engine/core/privacy_logging.py
```

**Expected output:**

```
21:DEFAULT_MODE = "metadata_only"
```

By default Oxy records metadata about each request (model, tokens, cost, status, the reason for a refusal) and drops the prompt and the answer. [`docs/security/privacy-modes.md`](../security/privacy-modes.md) describes the three modes; the dashboard's **Privacy** page switches between them. Module 7 checks this on the rows your requests left.

## Where the rules live

| Rule | Read it in |
|---|---|
| Order of the checks | `packages/engine/routes/proxy.py`, the `Flow:` list above |
| What DLP matches | `DLP_PATTERNS` in `packages/engine/core.py`; the DLP line in the README's feature list |
| Budgets | The README's "Scope and honest limitations"; [`docs/agents/budgets.md`](../agents/budgets.md) |
| Kill switch | [`docs/agents/kill-switch.md`](../agents/kill-switch.md) |
| Privacy of logs | [`docs/security/privacy-modes.md`](../security/privacy-modes.md) |
| What is not wired yet | The README's "Scope and honest limitations", the "Not wired in this release" item |

If a document and the code disagree, the code is right, and an issue saying where they disagree is welcome.

Next: [Module 4. Budgets](04-budgets.md)
