# 🔐 Authenticated API Usage Guide

## Overview

The `@/lib/api` module provides secure, CSRF-protected utilities for making authenticated API calls to the Oxy Engine backend.

**CRITICAL:** Always use `authenticatedFetch` instead of native `fetch` for backend API calls.

---

## Quick Start

### ❌ WRONG (Don't Do This)
```typescript
// Missing credentials: 'include' → Cookies not sent → CSRF fails
const response = await fetch(`${apiUrl}/management/onboard`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
})
```

### ✅ CORRECT (Use This)
```typescript
import { authenticatedFetch } from '@/lib/api'

const response = await authenticatedFetch(
  `${apiUrl}/management/onboard`,
  {
    method: 'POST',
    body: JSON.stringify(data)
  },
  token
)
```

---

## API Reference

### `authenticatedFetch(url, options, token)`

Makes an authenticated API request with automatic CSRF protection.

**Parameters:**
- `url` (string): Full API URL including `process.env.NEXT_PUBLIC_API_URL`
- `options` (RequestInit): Fetch options (method, body, etc.)
- `token` (string): JWT access token from Supabase session

**Returns:** `Promise<Response>`

**Features:**
- ✅ Automatically adds `credentials: 'include'` (sends cookies)
- ✅ Automatically adds `Authorization: Bearer ${token}` header
- ✅ Automatically adds `Content-Type: application/json` (if body exists)
- ✅ Automatically adds `X-CSRF-Token` header for POST/PUT/DELETE/PATCH
- ✅ Handles CSRF token extraction from cookies

---

## Usage Examples

### 1. POST Request (Create/Update)
```typescript
import { authenticatedFetch, handleApiError } from '@/lib/api'

const { data: { session } } = await supabase.auth.getSession()
if (!session) throw new Error('No session')

const res = await authenticatedFetch(
  `${process.env.NEXT_PUBLIC_API_URL}/management/project`,
  {
    method: 'POST',
    body: JSON.stringify({ name: 'My Project' })
  },
  session.access_token
)

if (!res.ok) {
  const errorMsg = await handleApiError(res)
  toast.error(errorMsg)
  return
}

const project = await res.json()
toast.success('Project created!')
```

### 2. PUT Request (Update)
```typescript
const res = await authenticatedFetch(
  `${apiUrl}/management/project/${projectId}`,
  {
    method: 'PUT',
    body: JSON.stringify({ name: 'Updated Name', budget_limit: '1000' })
  },
  token
)
```

### 3. DELETE Request
```typescript
const res = await authenticatedFetch(
  `${apiUrl}/management/key/${keyId}`,
  {
    method: 'DELETE'
  },
  token
)
```

### 4. GET Request (with auth)
```typescript
// Note: GET requests don't need CSRF token, but still include credentials
const res = await authenticatedFetch(
  `${apiUrl}/management/projects`,
  {
    method: 'GET'  // Optional, defaults to GET
  },
  token
)
```

### 5. With Timeout
```typescript
const res = await authenticatedFetch(
  `${apiUrl}/management/onboard`,
  {
    method: 'POST',
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30000)  // 30 second timeout
  },
  token
)
```

---

## Error Handling

### `handleApiError(response)`

Parses backend error responses into user-friendly messages.

```typescript
import { authenticatedFetch, handleApiError } from '@/lib/api'

const res = await authenticatedFetch(url, options, token)

if (!res.ok) {
  const errorMsg = await handleApiError(res)
  toast.error(errorMsg)
  return
}
```

**Handles:**
- FastAPI validation errors (`detail` array)
- Backend error messages (`detail`, `error`, `message`)
- HTTP status code fallback

### `safeErrorMessage(error)`

Extracts error messages from catch blocks.

```typescript
import { safeErrorMessage } from '@/lib/api'

try {
  const res = await authenticatedFetch(url, options, token)
  // ...
} catch (error: unknown) {
  toast.error(safeErrorMessage(error))
}
```

**Handles:**
- `AbortError` (timeout) → "Request timed out. Please try again."
- Network errors → "Cannot connect to API server..."
- Generic errors → Error message or fallback

---

## Helper Functions

### `getCookie(name)`

Extracts cookie value by name.

```typescript
import { getCookie } from '@/lib/api'

const csrfToken = getCookie('csrf_token')
const sessionId = getCookie('sb-session-id')
```

---

## Common Patterns

### Pattern 1: Component with API Call
```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, safeErrorMessage } from '@/lib/api'
import { toast } from 'sonner'

export default function MyComponent() {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (data: any) => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/management/endpoint`,
        {
          method: 'POST',
          body: JSON.stringify(data)
        },
        session.access_token
      )

      if (!res.ok) {
        throw new Error(await handleApiError(res))
      }

      toast.success('Success!')
    } catch (error) {
      toast.error(safeErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={() => handleSubmit({ name: 'test' })} disabled={loading}>
      Submit
    </button>
  )
}
```

### Pattern 2: Reusable API Hook
```typescript
import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch } from '@/lib/api'

export function useAuthenticatedApi() {
  const supabase = createClient()

  const apiCall = useCallback(async (url: string, options?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No session')

    return authenticatedFetch(
      url,
      options || {},
      session.access_token
    )
  }, [supabase])

  return { apiCall }
}

// Usage:
const { apiCall } = useAuthenticatedApi()
const res = await apiCall(`${apiUrl}/endpoint`, { method: 'POST', body: ... })
```

---

## Security Best Practices

### 1. Always Use Authenticated Fetch
```typescript
// ❌ NEVER do this for backend API calls:
fetch(`${apiUrl}/management/...`)

// ✅ ALWAYS use:
authenticatedFetch(`${apiUrl}/management/...`, {...}, token)
```

### 2. Check Session Before API Calls
```typescript
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  toast.error('Please log in')
  router.push('/login')
  return
}
```

### 3. Use Environment Variables
```typescript
// ✅ CORRECT:
const apiUrl = process.env.NEXT_PUBLIC_API_URL
if (!apiUrl) throw new Error('API URL not configured')

// ❌ WRONG:
const apiUrl = 'http://localhost:8000'  // Hardcoded = bad
```

### 4. Handle All Error Cases
```typescript
try {
  const res = await authenticatedFetch(...)
  
  if (!res.ok) {
    const errorMsg = await handleApiError(res)
    toast.error(errorMsg)
    return
  }
  
  const data = await res.json()
  // Success handling
} catch (error: unknown) {
  toast.error(safeErrorMessage(error))
}
```

---

## Troubleshooting

### "CSRF token missing or invalid"
**Cause:** Backend not receiving cookies or CSRF token header.

**Solution:**
1. Verify using `authenticatedFetch` (not native `fetch`)
2. Check CORS settings in backend:
   ```python
   allow_credentials=True  # ✅ Required for cookies
   ```
3. Verify cookie in DevTools → Application → Cookies → `csrf_token`

### "401 Unauthorized"
**Cause:** JWT token expired or invalid.

**Solution:**
1. Check session exists: `const { data: { session } } = await supabase.auth.getSession()`
2. Refresh session if needed: `await supabase.auth.refreshSession()`
3. Redirect to login if no session

### "Network Error" or "Failed to fetch"
**Cause:** Backend not running or wrong URL.

**Solution:**
1. Check backend is running: `docker-compose ps`
2. Verify `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check CORS configuration in backend

---

## Migration Checklist

When converting old code to use `authenticatedFetch`:

- [ ] Import `authenticatedFetch` from `@/lib/api`
- [ ] Replace `fetch(...)` with `authenticatedFetch(...)`
- [ ] Remove manual `Authorization` header (added automatically)
- [ ] Remove manual `Content-Type` header (added automatically)
- [ ] Remove manual `X-CSRF-Token` header (added automatically)
- [ ] Remove manual `credentials: 'include'` (added automatically)
- [ ] Pass `session.access_token` as third parameter
- [ ] Use `handleApiError` for error parsing
- [ ] Use `safeErrorMessage` in catch blocks
- [ ] Test endpoint works (check DevTools → Network)

---

## References

- [Fetch API Credentials](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#sending_a_request_with_credentials_included)
- [CSRF Protection (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)

---

*Last updated: 2025-11-20*  
*Maintained by: Oxy contributors*

