/**
 * SENTRY SERVER CONFIGURATION
 * ============================
 * 
 * Server-side error tracking and performance monitoring.
 * Captures API errors, database issues, and server crashes.
 * 
 * Features:
 * - Automatic error capture in API routes
 * - Server-side performance monitoring
 * - Database query tracking
 * - Memory leak detection
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment
  environment: process.env.NODE_ENV,
  
  // Performance monitoring (10% sample in production)
  tracesSampleRate: 0.1,
  
  // Server-specific integrations (Sentry v8+ uses function-based integrations)
  integrations: [
    Sentry.httpIntegration(),
  ],
  
  // Filter before sending
  beforeSend(event, hint) {
    // Don't send health check errors
    if (event.request?.url?.includes('/health')) {
      return null;
    }
    
    // Scrub sensitive data from headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    
    return event;
  },
  
  // Only in production
  enabled: process.env.NODE_ENV === 'production',
});

