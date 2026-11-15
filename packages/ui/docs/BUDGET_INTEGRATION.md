# Frontend Budget Integration Guide

## Overview
The Oxy Engine uses an atomic Redis-based budget manager to prevent overspending. This system is strictly typed and synchronized between the backend (Python) and frontend (TypeScript).

## Types
Import types from `@/lib/types/budget`:

```typescript
import { BudgetResult, ProjectBudget } from '@/lib/types/budget'
```

## API Responses

### Budget Status Codes
The backend returns specific status codes in the `BudgetResult` object (mostly for internal use, but useful for debugging):

- `OK`: Normal operation
- `OK_FREE_REQUEST`: $0 cost request (cache hit or free tier)
- `OK_UNLIMITED`: Project has no budget limit ($0.00 set)
- `BUDGET_EXCEEDED`: Request rejected because it would exceed the limit (HTTP 429)
- `FLOOR_HIT`: Critical error where spend went negative (auto-corrected to 0)

### HTTP Status Codes
- **200 OK**: Request successful (budget reserved/adjusted)
- **429 Too Many Requests**: Budget exceeded (`detail` contains message)

## Handling Budget Exceeded
The frontend `handleApiError` function automatically catches 429 errors and displays a toast notification prompting the user to increase their budget.

## Financial Precision
- **Backend**: Uses `Decimal` for all calculations (200% precision).
- **Transport**: Serialized as `float` (number) in JSON.
- **Frontend**: Uses `number` for display. Always use `.toFixed(2)` for currency display.

## Example Usage

```typescript
// Check budget before expensive operation (optional, backend enforces this)
if (project.current_spend >= project.budget_limit && project.budget_limit > 0) {
  toast.error("Budget limit reached");
  return;
}
```

