/**
 * =============================================================================
 * OXY ENGINE - UNIFIED API TYPES
 * =============================================================================
 * 
 * Shared API types for the UI. Keep each interface in sync with the
 * corresponding Pydantic model in the backend.
 * 
 * Backend Location: packages/engine/routes/*.py
 * 
 * SYNC STATUS: Created November 29, 2025
 * 
 * USAGE:
 * ```typescript
 * import { OnboardRequest, SubscriptionStatus } from '@/lib/types/api';
 * ```
 * 
 * FINANCIAL PRECISION:
 * - All monetary values use `string` type (never `number`)
 * - Backend serializes Python Decimal as string
 * - Frontend should parse with Decimal.js for calculations
 * =============================================================================
 */

// =============================================================================
// AUTH TYPES
// Backend: packages/engine/routes/auth.py
// =============================================================================

/**
 * User onboarding request
 * Backend: auth.py:OnboardRequest (line 53)
 * 
 * Supports all three cloud providers (OpenAI, Anthropic, Google).
 */
export interface OnboardRequest {
  full_name: string;          // Required: 2-100 chars, sanitized
  email: string;              // Required: User's email address
  openai_key?: string;        // Optional: OpenAI API key (sk-proj-...)
  anthropic_key?: string;     // Optional: Anthropic API key (sk-ant-...)
  google_key?: string;        // Optional: Google Gemini API key (AIza...)
  referral_code?: string;     // Optional: referral code (OXY-XXXXX); credit amount is operator-configured
}

/**
 * Profile update request
 * Backend: auth.py:ProfileUpdateRequest (line 88)
 */
export interface ProfileUpdateRequest {
  full_name?: string;
}

/**
 * Provider API key update request
 * Backend: auth.py:ProviderUpdateRequest (line 97)
 */
export interface ProviderUpdateRequest {
  provider_name: 'openai' | 'anthropic' | 'google';
  openai_key?: string;        // OpenAI API key (required when provider_name=openai)
  anthropic_key?: string;     // Anthropic API key (required when provider_name=anthropic)
  google_key?: string;        // Google API key (required when provider_name=google)
}

// =============================================================================
// BILLING TYPES
// Backend: packages/engine/routes/billing.py
// =============================================================================

/**
 * Checkout session creation request
 * Backend: billing.py:CreateCheckoutSessionRequest (line 113)
 */
export interface CreateCheckoutSessionRequest {
  plan: 'starter' | 'growth' | 'business' | 'enterprise';
  interval?: 'month' | 'year';  // Default: 'month'
}

/**
 * Checkout session response
 */
export interface CreateCheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
  interval: 'month' | 'year';
}

/**
 * Subscription status response
 * Backend: billing.py:SubscriptionStatusResponse (line 118)
 * 
 * Also defined in hooks/use-subscription.ts:SubscriptionStatus (keep in sync)
 */
export interface SubscriptionStatusResponse {
  has_subscription: boolean;
  plan_tier: 'free' | 'starter' | 'growth' | 'business' | 'enterprise' | null;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | null;
  requests_used: number | null;
  requests_limit: number | null;
  usage_percentage: number | null;
  current_period_end: string | null;  // ISO 8601
  cancel_at_period_end: boolean;
  trial_end: string | null;           // ISO 8601
  billing_interval: 'month' | 'year' | null;
}

// =============================================================================
// CREDITS TYPES
// Backend: packages/engine/routes/credits.py
// =============================================================================

/**
 * Credits balance response
 * Backend: credits.py:CreditsBalanceResponse (line 134)
 */
export interface CreditsBalanceResponse {
  balance: string;            // Decimal as string
  earned_total: string;       // Lifetime earnings
  used_total: string;         // Lifetime usage
  referral_count: number;     // Number of successful referrals
}

/**
 * Referral code request (for manual entry)
 * Backend: credits.py:ReferralCodeRequest (line 140)
 */
export interface ReferralCodeRequest {
  referral_code: string;      // e.g., "OXY-ABC12"
}

/**
 * Referral redemption response
 * Backend: credits.py:ReferralRedemptionResponse (line 176)
 */
export interface ReferralRedemptionResponse {
  success: boolean;
  message: string;
  credits_awarded: string;    // Decimal as string
  new_balance: string;        // Decimal as string
}

/**
 * Referral link response
 * Backend: credits.py:ReferralLinkResponse (line 184)
 */
export interface ReferralLinkResponse {
  referral_code: string;
  referral_url: string;
  referrals_count: number;
  credits_earned: string;     // Decimal as string
}

// =============================================================================
// TEAM TYPES
// Backend: packages/engine/routes/team.py
// =============================================================================

/**
 * Team invite request
 * Backend: team.py:TeamInviteRequest (line 46)
 */
export interface TeamInviteRequest {
  email: string;
  role: 'owner' | 'developer' | 'viewer';
}

/**
 * Invite accept request
 * Backend: team.py:InviteAcceptRequest (line 65)
 */
export interface InviteAcceptRequest {
  token: string;              // Invite token from URL
}

/**
 * Team member representation
 */
export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'developer';
  status: 'pending' | 'active' | 'suspended';
  invited_at: string;         // ISO 8601
  joined_at: string | null;   // ISO 8601
}

/**
 * Pending invite representation
 */
export interface TeamInvite {
  id: string;
  email: string;
  role: 'owner' | 'developer' | 'viewer';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invited_by: string;
  created_at: string;         // ISO 8601
  expires_at: string;         // ISO 8601
}

// =============================================================================
// INTELLIGENCE TYPES
// Backend: packages/engine/routes/intelligence.py
// =============================================================================

/**
 * Budget prediction request
 * Backend: intelligence.py:BudgetPredictionRequest (line 26)
 */
export interface BudgetPredictionRequest {
  project_id: string;
  days_ahead?: number;        // Default: 30
}

/**
 * Budget comparison data
 * Backend: intelligence.py:BudgetComparison (line 31)
 */
export interface BudgetComparison {
  category: string;
  user_value: string;         // Decimal as string
  benchmark_value: string;    // Decimal as string
  difference_percent: number;
}

/**
 * Budget prediction response
 * Backend: intelligence.py:BudgetPredictionResponse (line 36)
 */
export interface BudgetPredictionResponse {
  predicted_spend: string;    // Decimal as string
  confidence: number;         // 0-1
  trend: 'increasing' | 'stable' | 'decreasing';
  comparisons: BudgetComparison[];
  recommendations: string[];
}

// =============================================================================
// PROMPTS MARKETPLACE TYPES
// Backend: packages/engine/routes/prompts.py
// =============================================================================

/**
 * Prompt template representation
 * Backend: prompts.py:PromptTemplate (line 54)
 */
export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category: 'customer_support' | 'code_generation' | 'data_analysis' | 
            'content_writing' | 'translation' | 'summarization' | 'other';
  prompt_text: string;
  variables: string[];
  recommended_model: string;
  estimated_cost_per_use: string;  // Decimal as string
  author_name: string;
  is_verified: boolean;
  is_premium: boolean;
  price_usd: number | null;
  usage_count: number;
  avg_rating: number;         // 0-5
  rating_count: number;
  created_at: string;         // ISO 8601
}

/**
 * Create prompt request
 * Backend: prompts.py:CreatePromptRequest (line 77)
 */
export interface CreatePromptRequest {
  title: string;              // 10-100 chars
  description: string;        // 20-500 chars
  category: PromptTemplate['category'];
  prompt_text: string;        // 50-10000 chars
  variables?: string[];
  recommended_model: string;
  is_premium?: boolean;
  price_usd?: number;
}

/**
 * Rate prompt request
 * Backend: prompts.py:RatePromptRequest (line 90)
 */
export interface RatePromptRequest {
  prompt_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
}

// =============================================================================
// ADD-ONS TYPES
// Backend: packages/engine/routes/add_ons.py
// =============================================================================

/**
 * One per-organization feature flag (GET /add-ons/catalog?organization_id=...)
 * Backend: add_ons.py:AddOnFlag. The operator turns flags on in organization_add_ons.
 */
export interface AddOnFlag {
  id: string;
  name: string;
  description: string;
  checked_by: string;
  enabled: boolean;
}

// =============================================================================
// COST OPTIMIZER TYPES
// Backend: packages/engine/routes/cost_optimizer.py
// =============================================================================

/**
 * Cost recommendation from AI
 * Backend: cost_optimizer.py:CostRecommendation (line 49)
 */
export interface CostRecommendation {
  id: string;
  action: string;
  reasoning: string;
  estimated_savings_usd: number;
  confidence: number;         // 0-1
  priority: 1 | 2 | 3;        // 1 = high, 3 = low
  implementation_steps: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string;         // ISO 8601
}

/**
 * Usage analysis data
 * Backend: cost_optimizer.py:UsageAnalysis (line 59)
 */
export interface UsageAnalysis {
  total_requests: number;
  total_tokens: number;
  total_cost_usd: string;     // Decimal as string
  avg_cost_per_request: string;
  most_used_model: string;
  cache_hit_rate: number;     // 0-1
  period_start: string;       // ISO 8601
  period_end: string;         // ISO 8601
}

// =============================================================================
// COST ATTRIBUTION TYPES
// Backend: packages/engine/routes/attribution.py
// =============================================================================

/**
 * Create cost attribution tag
 * Backend: attribution.py:CostAttributionTagCreate (line 41)
 */
export interface CostAttributionTagCreate {
  key: string;                // Lowercase, alphanumeric, underscores
  value: string;
  description?: string;
  tag_type?: 'custom' | 'team' | 'project' | 'environment';
  is_billable?: boolean;
}

/**
 * Cost attribution tag response
 * Backend: attribution.py:CostAttributionTagResponse (line 61)
 */
export interface CostAttributionTagResponse {
  id: string;
  key: string;
  value: string;
  description: string | null;
  tag_type: string;
  is_billable: boolean;
  total_requests: number;
  total_cost_usd: string;     // Decimal as string
  total_tokens_prompt: number;
  total_tokens_completion: number;
  created_at: string;         // ISO 8601
  last_request_at: string | null;
}

/**
 * Cost attribution summary
 * Backend: attribution.py:CostAttributionSummaryResponse (line 77)
 */
export interface CostAttributionSummaryResponse {
  tag_key: string;
  tag_value: string;
  total_requests: number;
  total_cost_usd: string;     // Decimal as string
  percentage_of_total: number;
}

/**
 * Create chargeback rule
 * Backend: attribution.py:ChargebackRuleCreate (line 91)
 */
export interface ChargebackRuleCreate {
  name: string;
  description?: string;
  match_condition: Record<string, unknown>;  // JSON condition
  chargeback_type: 'team' | 'department' | 'cost_center' | 'client';
  chargeback_target_id: string;
  chargeback_target_name: string;
  markup_percentage?: number;  // 0-1000
  minimum_charge_usd?: number;
}

/**
 * Chargeback rule response
 * Backend: attribution.py:ChargebackRuleResponse (line 117)
 */
export interface ChargebackRuleResponse {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  match_condition: Record<string, unknown>;
  chargeback_type: string;
  chargeback_target_id: string;
  chargeback_target_name: string;
  markup_percentage: number;
  minimum_charge_usd: number | null;
  created_at: string;         // ISO 8601
}

/**
 * Chargeback invoice response
 * Backend: attribution.py:ChargebackInvoiceResponse (line 132)
 */
export interface ChargebackInvoiceResponse {
  id: string;
  chargeback_rule_id: string;
  period_start: string;       // ISO 8601
  period_end: string;         // ISO 8601
  chargeback_target_id: string;
  chargeback_target_name: string;
  total_requests: number;
  total_cost_usd: string;     // Decimal as string
  markup_usd: string;         // Decimal as string
  total_charge_usd: string;   // Decimal as string
  status: 'draft' | 'finalized' | 'sent' | 'paid';
  external_invoice_url: string | null;
}

// =============================================================================
// PROJECT TYPES
// Backend: packages/engine/main.py
// =============================================================================

/**
 * Create project request
 * Backend: main.py:ProjectCreateRequest (line 1199)
 */
export interface ProjectCreateRequest {
  name: string;               // 1-100 chars
  budget_limit?: string;      // Decimal as string, default "0.00" (unlimited)
}

/**
 * Update project request
 * Backend: main.py:ProjectUpdateRequest (line 1207)
 */
export interface ProjectUpdateRequest {
  name?: string;
  budget_limit?: string;      // Decimal as string
  reset_period?: 'daily' | 'weekly' | 'monthly' | 'never';
}

/**
 * Project representation
 */
export interface Project {
  id: string;
  organization_id: string;
  name: string;
  budget_limit: string;       // Decimal as string
  current_spend: string;      // Decimal as string
  reset_period: 'daily' | 'weekly' | 'monthly' | 'never';
  last_reset_at: string;      // ISO 8601
  status: 'active' | 'paused' | 'archived';
  created_at: string;         // ISO 8601
}

// =============================================================================
// COMMON API RESPONSE TYPES
// =============================================================================

/**
 * Standard success response
 */
export interface SuccessResponse {
  success: boolean;
  message: string;
}

/**
 * Standard error response
 * 
 * Errors are machine-readable so AI agents can act on them
 */
export interface ErrorResponse {
  detail: string | ValidationError[];
  error_code?: string;
  request_id?: string;
}

/**
 * Validation error detail
 */
export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Re-export specialized types from their modules
export type { BudgetResult, ProjectBudget, CreditsBalance } from './budget';
export type { 
  SSODomainLookupRequest,
  SSODomainLookupResponse,
  SSOConfigureRequest,
  SSOConfigureResponse,
  SSOCallbackRequest,
  SSOLoginURLResponse,
  SSOConfiguration,
  SSOProvider
} from './sso';

