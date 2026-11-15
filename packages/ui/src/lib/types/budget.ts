/**
 * Budget Management Types
 * 
 * CRITICAL: Aligned with Backend Pydantic models and TypedDicts.
 * Backend: packages/engine/core/budget.py
 * 
 * Keep in sync with the backend models.
 * 
 * FINANCIAL PRECISION:
 * - Backend uses Python Decimal (arbitrary precision)
 * - Backend serializes Decimal as string in JSON (via str())
 * - Frontend MUST use string type, parse with Decimal.js
 * - NEVER use JavaScript number for financial amounts (float precision loss)
 */

/**
 * Budget operation result from Redis Lua scripts
 * 
 * Backend: packages/engine/core/budget.py:BudgetResult (TypedDict, line 206)
 * 
 * Status codes mapped to Lua script returns:
 * - OK: Standard successful reservation
 * - OK_FREE_REQUEST: Zero-cost request (cached, free tier)
 * - OK_UNLIMITED: No budget limit set (budget_limit = 0)
 * - OK_CREDITS_USED: Fully covered by referral credits
 * - OK_CREDITS_PARTIAL: Partially covered by credits + budget
 * - OK_CREDITS_ONLY: Database fallback - credits only (RESILIENCE)
 * - BUDGET_EXCEEDED: Would exceed budget limit
 * - FLOOR_HIT: Spend went negative, reset to 0 (SAFETY)
 * - ERROR: Database fallback failure (RESILIENCE)
 * - INVALID_*: Input validation failures
 */
export interface BudgetResult {
  status: 
    | 'OK' 
    | 'OK_FREE_REQUEST' 
    | 'OK_UNLIMITED' 
    | 'OK_CREDITS_USED'      // Covered by referral credits
    | 'OK_CREDITS_PARTIAL'   // Critical for mixed payment
    | 'OK_CREDITS_ONLY'      // Database fallback success
    | 'BUDGET_EXCEEDED' 
    | 'FLOOR_HIT' 
    | 'ERROR'                // Fallback catch-all
    | 'INVALID_RESERVATION_AMOUNT' 
    | 'INVALID_BUDGET_LIMIT' 
    | 'INVALID_ADJUSTMENT' 
    | 'INVALID_RETURN_AMOUNT';
  current_spend: string; // Decimal serialized as string for precision
  message?: string;
}

/**
 * Project budget state
 * 
 * Used in dashboard widgets and budget management UI.
 * All monetary fields use string to preserve Decimal precision.
 */
export interface ProjectBudget {
  project_id: string;
  budget_limit: string;   // Decimal as string (e.g., "100.00")
  current_spend: string;  // Decimal as string (e.g., "42.37")
}

/**
 * Credits balance for organization
 * 
 * Credits are earned through referrals
 * and burned BEFORE charging project budget.
 */
export interface CreditsBalance {
  organization_id: string;
  balance: string;        // Decimal as string
  earned_total: string;   // Lifetime earnings
  used_total: string;     // Lifetime usage
}

/**
 * Helper type guard for successful budget operations
 */
export function isBudgetSuccess(result: BudgetResult): boolean {
  return result.status.startsWith('OK');
}

/**
 * Helper type guard for credit-related operations
 */
export function isCreditsUsed(result: BudgetResult): boolean {
  return result.status === 'OK_CREDITS_USED' || 
         result.status === 'OK_CREDITS_PARTIAL' ||
         result.status === 'OK_CREDITS_ONLY';
}

