/**
 * SENTRY CLIENT CONFIGURATION
 * ============================
 * 
 * Client-side error tracking and performance monitoring.
 * Captures errors, breadcrumbs, and user sessions.
 * 
 * Setup:
 * 1. Create project at https://sentry.io
 * 2. Add NEXT_PUBLIC_SENTRY_DSN to .env.local
 * 3. Deploy and monitor errors at sentry.io/issues
 * 
 * Features:
 * - Automatic error capture
 * - Session replay (10% sample)
 * - Performance monitoring (10% sample)
 * - User context tracking
 * - PII masking (GDPR compliant)
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment tracking
  environment: process.env.NODE_ENV,
  
  // Performance monitoring (10% of transactions)
  tracesSampleRate: 0.1,
  
  // Session replay (10% of sessions, 100% of errors)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Integrations (Sentry v8+ uses function-based integrations)
  integrations: [
    Sentry.replayIntegration({
      // Privacy: mask all text and media
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],
  
  // Filter out noisy errors
  beforeSend(event, hint) {
    // Ignore ResizeObserver errors (browser bug, not our issue)
    if (event.message?.includes('ResizeObserver')) {
      return null;
    }
    
    // Ignore cancelled network requests (user navigated away)
    if (event.message?.includes('cancelled') || event.message?.includes('aborted')) {
      return null;
    }
    
    // Add user context if available
    const userId = localStorage.getItem('userId');
    if (userId && event.user) {
      event.user.id = userId;
    }
    
    return event;
  },
  
  // Don't send events in development
  enabled: process.env.NODE_ENV === 'production',
});

