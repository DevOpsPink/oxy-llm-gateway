-- ============================================================================
-- OXY ENGINE - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- Single Source of Truth for all database objects
-- Version: 1.2.0 (Anomaly Detection + Real-time)
-- Last Updated: 2025-12-02
-- 
-- EXECUTION ORDER:
--   1. Run this file on a clean Supabase database
--   2. Enable extensions in Dashboard: pg_cron, pgsodium (if needed)
--
-- SECTIONS:
--   1. CLEANUP & EXTENSIONS
--   2. TABLES (Agent Support + Anomaly Detection)
--   3. INDEXES (Agent Support + Anomaly Detection)
--   4. FUNCTIONS (HARDENED, Agent + Anomaly Detection)
--   5. TRIGGERS (Agent + Anomaly Detection)
--   6. RLS POLICIES (Agent + Anomaly Detection)
--   7. SEED DATA
--   8. SECURITY GRANTS
--   9. REAL-TIME SUBSCRIPTIONS (Supabase)
--
-- AGENT SUPPORT (v1.1.0):
--   - agents: Agent registry with budgets & configs
--   - agent_sessions: Session tracking & kill switch
--   - mcp_servers: MCP server registry
--   - tools: Tool registry (MCP, API, webhook)
--   - tool_call_logs: Audit trail for tool invocations
--   - agent_api_keys: Dedicated agent keys
--
-- ANOMALY DETECTION (v1.2.0):
--   - anomaly_alerts: Detected anomalies for review & tracking
--   - anomaly_detection_config: Per-org thresholds & settings
--   - Real-time subscriptions for instant alerts
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: CLEANUP & EXTENSIONS
-- ============================================================================
-- WARNING: DROP SCHEMA is commented for safety. Uncomment only for full reset.
-- ============================================================================

-- DROP SCHEMA IF EXISTS public CASCADE;
-- CREATE SCHEMA IF NOT EXISTS public;

-- Create extensions schema (security best practice)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Install extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

-- Grant schema usage
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA analytics TO authenticated, service_role;

-- ============================================================================
-- SECTION 2: TABLES
-- ============================================================================

-- Schema Migrations Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT now()
);

-- User Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    onboarded_at TIMESTAMPTZ,
    
    -- Referral System
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    credits_balance DECIMAL(10,2) DEFAULT 0.00 NOT NULL CHECK (credits_balance >= 0),
    credits_earned DECIMAL(10,2) DEFAULT 0.00 NOT NULL CHECK (credits_earned >= 0),
    credits_used DECIMAL(10,2) DEFAULT 0.00 NOT NULL CHECK (credits_used >= 0),
    referral_count INTEGER DEFAULT 0 NOT NULL CHECK (referral_count >= 0),
    referral_activated_count INTEGER DEFAULT 0 NOT NULL CHECK (referral_activated_count >= 0),
    
    -- Fraud Prevention
    signup_ip INET,
    signup_user_agent TEXT,
    signup_country_code CHAR(2),
    is_proxy BOOLEAN DEFAULT false,
    fraud_score INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_id UUID,
    
    -- Status (v0.1 control plane)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    suspended_until TIMESTAMPTZ,
    suspend_reason TEXT,
    paused BOOLEAN DEFAULT false, -- Legacy flag (deprecated in favor of status)
    auto_suspend_on_cost_spikes BOOLEAN DEFAULT true,
    last_paused_at TIMESTAMPTZ,
    last_pause_reason TEXT,
    privacy_mode TEXT NOT NULL DEFAULT 'metadata_only' CHECK (privacy_mode IN ('zero_prompt_logging','metadata_only','debug_full')),
    request_log_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (request_log_retention_days >= 7 AND request_log_retention_days <= 2555),
    display_name TEXT,
    slug TEXT,
    logo_url TEXT,
    timezone TEXT,
    locale TEXT,
    support_email TEXT,
    billing_email TEXT,
    key_rotation_days INTEGER NOT NULL DEFAULT 90 CHECK (key_rotation_days >= 1 AND key_rotation_days <= 365),
    key_rotation_enforcement_mode TEXT NOT NULL DEFAULT 'warn' CHECK (key_rotation_enforcement_mode IN ('off','warn','enforce')),
    key_rotation_grace_days INTEGER NOT NULL DEFAULT 30 CHECK (key_rotation_grace_days >= 0 AND key_rotation_grace_days <= 365),
    provider_openai_enabled BOOLEAN DEFAULT true,
    provider_anthropic_enabled BOOLEAN DEFAULT false,
    provider_google_enabled BOOLEAN DEFAULT false,
    provider_local_enabled BOOLEAN DEFAULT false,
    subscription_plan TEXT DEFAULT 'free',
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Enterprise SSO
    sso_enabled BOOLEAN DEFAULT false,
    sso_provider_id TEXT,
    sso_domain TEXT UNIQUE,
    sso_configured_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    sso_configured_at TIMESTAMPTZ,
    sso_domain_verified BOOLEAN DEFAULT false,
    sso_verification_token TEXT,
    sso_verification_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'developer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT now(),
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- Providers (Encrypted API Keys)
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL CHECK (provider_name IN ('openai', 'anthropic', 'google', 'meta')),
    key_secret_id UUID UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    deactivated_reason TEXT,
    deactivated_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, provider_name)
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    budget_limit NUMERIC(10, 2) DEFAULT 0.00 CHECK (budget_limit >= 0),
    -- Mirror of the Redis spend counter (the budget's ledger), to the micro-dollar.
    current_spend NUMERIC(18, 6) DEFAULT 0 CHECK (current_spend >= 0),
    reset_period TEXT DEFAULT 'monthly' CHECK (reset_period IN ('daily', 'weekly', 'monthly', 'never')),
    last_reset_at TIMESTAMPTZ DEFAULT now(),
    settings JSONB DEFAULT '{}'::jsonb,
    last_sync_id TEXT DEFAULT NULL,
    last_synced_at TIMESTAMPTZ DEFAULT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL CHECK (char_length(key_name) >= 1 AND char_length(key_name) <= 100),
    key_prefix TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    budget_limit NUMERIC(10, 2) DEFAULT 0.00 CHECK (budget_limit >= 0),
    is_active BOOLEAN DEFAULT true,
    deactivated_reason TEXT,
    deactivated_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    -- REMOVED: name TEXT (duplicate of key_name)
    -- REMOVED: user_id UUID (duplicate of created_by)
    
    -- Key Rotation (SOC 2)
    rotation_required_at TIMESTAMPTZ,
    rotation_notified_at TIMESTAMPTZ,
    last_rotated_at TIMESTAMPTZ DEFAULT NOW(),
    rotation_grace_period_ends_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);


-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    request_id TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions
-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
-- plan_tier values must match:
--   - packages/engine/routes/billing.py PLAN_LIMITS
--   - packages/ui/src/app/pricing/page.tsx (plan limits page)
--
-- Plan tiers are quota levels. The operator assigns them in the database;
-- the optional Stripe module can set them too.
--
-- Plan hierarchy: free → starter → growth → business → enterprise
-- Note: 'free' users don't have subscription records (NULL = free)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    stripe_subscription_id TEXT UNIQUE,
    -- Plan tiers match the plan limits page
    plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter', 'growth', 'business', 'enterprise')),
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid')),
    interval TEXT NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    amount INTEGER,
    currency TEXT DEFAULT 'usd',
    billing_interval TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription Usage
CREATE TABLE IF NOT EXISTS subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    requests_count BIGINT DEFAULT 0,
    tokens_used BIGINT DEFAULT 0,
    overage_requests BIGINT DEFAULT 0,
    overage_tokens BIGINT DEFAULT 0,
    last_request_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Billing Audit Log
CREATE TABLE IF NOT EXISTS billing_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'subscription_created', 'subscription_updated', 'subscription_canceled', 'subscription_deleted',
        'payment_succeeded', 'payment_failed', 'invoice_created', 'invoice_paid', 'invoice_payment_failed',
        'usage_reported', 'plan_upgraded', 'plan_downgraded'
    )),
    stripe_event_id TEXT UNIQUE,
    amount_cents INTEGER,
    currency TEXT DEFAULT 'usd',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('card', 'bank_account', 'paypal')),
    card_brand TEXT,
    card_last4 TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resend_email_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    metadata JSONB,
    CONSTRAINT email_logs_email_type_check CHECK (email_type IN ('budget_alert', 'team_invite', 'invoice', 'system_notification', 'key_rotation_reminder'))
);

-- Team Invites
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'developer',
    invite_token_hash VARCHAR(64) NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    CONSTRAINT team_invites_role_check CHECK (role IN ('owner', 'developer', 'viewer')),
    CONSTRAINT team_invites_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    CONSTRAINT team_invites_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- SSO Audit Log
CREATE TABLE IF NOT EXISTS sso_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        'sso_configured', 'sso_enabled', 'sso_disabled', 'sso_domain_verified',
        'sso_domain_changed', 'sso_login_success', 'sso_login_failed', 'sso_auto_join'
    )),
    actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    affected_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Attribution Tags
CREATE TABLE IF NOT EXISTS cost_attribution_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    tag_type TEXT NOT NULL DEFAULT 'custom',
    is_billable BOOLEAN NOT NULL DEFAULT false,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_cost_usd DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    total_tokens_prompt BIGINT NOT NULL DEFAULT 0,
    total_tokens_completion BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_request_at TIMESTAMPTZ,
    CONSTRAINT cost_attribution_tags_org_key_value_unique UNIQUE (organization_id, key, value),
    CONSTRAINT cost_attribution_tags_key_format CHECK (key ~ '^[a-z0-9_]+$'),
    CONSTRAINT cost_attribution_tags_value_length CHECK (LENGTH(value) <= 255)
);

-- Chargeback Rules
CREATE TABLE IF NOT EXISTS chargeback_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    match_condition JSONB NOT NULL,
    chargeback_type TEXT NOT NULL,
    chargeback_target_id TEXT NOT NULL,
    chargeback_target_name TEXT NOT NULL,
    markup_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    minimum_charge_usd DECIMAL(10,2) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chargeback_rules_name_unique UNIQUE (organization_id, name),
    CONSTRAINT chargeback_rules_markup_range CHECK (markup_percentage >= 0 AND markup_percentage <= 1000)
);

-- Chargeback Invoices
CREATE TABLE IF NOT EXISTS chargeback_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chargeback_rule_id UUID NOT NULL REFERENCES chargeback_rules(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    chargeback_target_id TEXT NOT NULL,
    chargeback_target_name TEXT NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_cost_usd DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    markup_usd DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    total_charge_usd DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft',
    finalized_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    external_invoice_id TEXT,
    external_invoice_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chargeback_invoices_period_check CHECK (period_end > period_start),
    CONSTRAINT chargeback_invoices_status_check CHECK (status IN ('draft', 'finalized', 'sent', 'paid')),
    CONSTRAINT chargeback_invoices_unique UNIQUE (organization_id, chargeback_rule_id, period_start)
);

-- Organization Add-Ons
CREATE TABLE IF NOT EXISTS organization_add_ons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    add_on_id TEXT NOT NULL,
    add_on_name TEXT NOT NULL,
    price_usd INTEGER NOT NULL,
    stripe_subscription_item_id TEXT,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, add_on_id, activated_at)
);

-- Prompts Marketplace
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'customer_support', 'code_generation', 'data_analysis',
        'content_writing', 'translation', 'summarization', 'other'
    )),
    prompt_text TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    recommended_model TEXT NOT NULL,
    estimated_cost_per_use DECIMAL(10, 6) NOT NULL,
    author_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    price_usd INTEGER,
    usage_count INTEGER DEFAULT 0,
    avg_rating DECIMAL(3, 2) DEFAULT 0.00 CHECK (avg_rating >= 0 AND avg_rating <= 5),
    rating_count INTEGER DEFAULT 0,
    total_savings_usd DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT title_length CHECK (char_length(title) BETWEEN 10 AND 100),
    CONSTRAINT description_length CHECK (char_length(description) BETWEEN 20 AND 500),
    CONSTRAINT prompt_text_length CHECK (char_length(prompt_text) BETWEEN 50 AND 10000)
);

-- Prompt Ratings
CREATE TABLE IF NOT EXISTS prompt_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(prompt_id, user_id)
);

-- Cost Recommendations
CREATE TABLE IF NOT EXISTS cost_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    estimated_savings_usd INTEGER NOT NULL,
    confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 3),
    implementation_steps TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    generated_by TEXT DEFAULT 'claude-3.5-sonnet',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Achievement Types
CREATE TABLE IF NOT EXISTS achievement_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL REFERENCES achievement_types(id),
    achievement_data JSONB NOT NULL DEFAULT '{}',
    celebrated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, achievement_type)
);

-- ============================================================================
-- AGENT SUPPORT TABLES (AI Control Plane)
-- ============================================================================
-- Enables: Agent registry, session tracking, MCP tools, kill switch, per-agent budgets
-- ============================================================================

-- Agents Registry
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Agent Identity
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    description TEXT,
    agent_type TEXT NOT NULL DEFAULT 'custom' CHECK (agent_type IN (
        'custom', 'code_review', 'support', 'devops', 'security', 
        'data_analysis', 'content', 'research', 'automation'
    )),
    
    -- Configuration
    default_model TEXT DEFAULT 'gpt-4o',
    allowed_models TEXT[] DEFAULT ARRAY['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
    allowed_tools TEXT[] DEFAULT ARRAY[]::TEXT[],
    max_tokens_per_request INTEGER DEFAULT 4096 CHECK (max_tokens_per_request > 0),
    max_requests_per_session INTEGER DEFAULT 100 CHECK (max_requests_per_session > 0),
    max_tool_calls_per_session INTEGER DEFAULT 50 CHECK (max_tool_calls_per_session > 0),
    
    -- Budget (per-agent limits)
    budget_limit NUMERIC(10, 2) DEFAULT 0.00 CHECK (budget_limit >= 0),
    current_spend NUMERIC(18, 2) DEFAULT 0.00 CHECK (current_spend >= 0),
    reset_period TEXT DEFAULT 'monthly' CHECK (reset_period IN ('daily', 'weekly', 'monthly', 'never')),
    last_reset_at TIMESTAMPTZ DEFAULT now(),
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
    suspended_until TIMESTAMPTZ,
    suspend_reason TEXT,
    suspend_on_anomaly BOOLEAN DEFAULT false,
    anomaly_suspend_duration_minutes INTEGER DEFAULT 15 CHECK (anomaly_suspend_duration_minutes > 0),
    auto_suspend_on_loop BOOLEAN DEFAULT false,
    loop_suspend_duration_minutes INTEGER DEFAULT 10 CHECK (loop_suspend_duration_minutes > 0),
    last_active_at TIMESTAMPTZ,
    total_requests BIGINT DEFAULT 0,
    total_tool_calls BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    
    -- Metadata
    settings JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(organization_id, name)
);

COMMENT ON TABLE agents IS 'Registry of AI agents with their configurations and budgets';
COMMENT ON COLUMN agents.allowed_tools IS 'Tool names this agent can use. Empty array = all tools allowed.';
COMMENT ON COLUMN agents.budget_limit IS 'Per-agent budget limit in USD. 0 = unlimited.';

-- ============================================================================
-- MIGRATION/BACKFILL FOR STATUS NORMALIZATION (Agents & Orgs)
-- ============================================================================
-- Normalize agent status values (legacy -> new)
ALTER TABLE IF EXISTS agents DROP CONSTRAINT IF EXISTS agents_status_check;
ALTER TABLE IF EXISTS agents ADD CONSTRAINT agents_status_check CHECK (status IN ('active', 'suspended', 'disabled'));
ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS suspend_reason TEXT;
ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS suspend_on_anomaly BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS anomaly_suspend_duration_minutes INTEGER DEFAULT 15 CHECK (anomaly_suspend_duration_minutes > 0);
ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS auto_suspend_on_loop BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS loop_suspend_duration_minutes INTEGER DEFAULT 10 CHECK (loop_suspend_duration_minutes > 0);
UPDATE agents SET status = 'suspended' WHERE status = 'paused';
UPDATE agents SET status = 'disabled' WHERE status = 'archived';

-- Normalize organization status values (legacy paused -> suspended)
ALTER TABLE IF EXISTS organizations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended'));
ALTER TABLE IF EXISTS organizations ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE IF EXISTS organizations ADD COLUMN IF NOT EXISTS suspend_reason TEXT;
UPDATE organizations SET status = 'suspended' WHERE paused = TRUE AND (status IS NULL OR status = 'active');

-- Agent Sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Session Info
    session_type TEXT NOT NULL DEFAULT 'task' CHECK (session_type IN (
        'task', 'conversation', 'batch', 'scheduled', 'triggered'
    )),
    name TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'cancelled', 'timeout', 'killed'
    )),
    
    -- Kill Switch
    kill_requested_at TIMESTAMPTZ,
    kill_requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    kill_reason TEXT,
    
    -- Tracking
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost NUMERIC(10, 6) DEFAULT 0.000000,
    total_tool_calls INTEGER DEFAULT 0,
    
    -- Error Tracking
    error_message TEXT,
    error_code TEXT,
    error_count INTEGER DEFAULT 0,
    
    -- Context
    initial_context JSONB DEFAULT '{}'::jsonb,
    final_output JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE agent_sessions IS 'Tracks individual agent runs/tasks for monitoring and audit';
COMMENT ON COLUMN agent_sessions.kill_requested_at IS 'Timestamp when kill switch was activated';

-- Request Logs (depends on agents/agent_sessions)
CREATE TABLE IF NOT EXISTS request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- SET NULL, not CASCADE: deleting a key must never erase its audit rows
    -- (keys are revoked, not deleted; this holds for a delete made by hand too).
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    provider TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    tokens_total INTEGER DEFAULT 0,
    cost_usd NUMERIC(10, 6) DEFAULT 0.000000,
    latency_ms INTEGER,
    response_time_ms INTEGER,
    status_code INTEGER,
    status TEXT,
    cache_hit BOOLEAN DEFAULT false,
    cost_tags JSONB DEFAULT '{}'::jsonb,
    prompt_snapshot TEXT,
    response_snapshot TEXT,
    privacy_mode TEXT DEFAULT 'metadata_only',
    error_message TEXT,
    threat_detected BOOLEAN DEFAULT false,
    threat_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Request Logs hardening: add missing columns for agent/session attribution
ALTER TABLE IF EXISTS request_logs ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS request_logs ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS request_logs ADD COLUMN IF NOT EXISTS cost_tags JSONB DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS request_logs ADD COLUMN IF NOT EXISTS prompt_snapshot TEXT;
ALTER TABLE IF EXISTS request_logs ADD COLUMN IF NOT EXISTS response_snapshot TEXT;
ALTER TABLE IF EXISTS request_logs ADD COLUMN IF NOT EXISTS privacy_mode TEXT DEFAULT 'metadata_only';
ALTER TABLE IF EXISTS request_logs ALTER COLUMN api_key_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_request_logs_agent ON request_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_session ON request_logs(session_id);

-- Request Attribution
CREATE TABLE IF NOT EXISTS request_attribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_log_id UUID NOT NULL REFERENCES request_logs(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES cost_attribution_tags(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cost_usd DECIMAL(10,6) NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT request_attribution_unique UNIQUE (request_log_id, tag_id)
);

-- Enforce per-org request log retention
CREATE OR REPLACE FUNCTION fn_enforce_request_log_retention()
RETURNS VOID AS $$
DECLARE
    org RECORD;
BEGIN
    FOR org IN SELECT id, request_log_retention_days FROM organizations LOOP
        DELETE FROM request_logs
        WHERE organization_id = org.id
        AND created_at < (now() - (org.request_log_retention_days || ' days')::interval);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- MCP Servers Registry
CREATE TABLE IF NOT EXISTS mcp_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Server Identity
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    description TEXT,
    server_url TEXT NOT NULL,
    
    -- Protocol
    protocol_version TEXT DEFAULT '1.0',
    capabilities JSONB DEFAULT '{}'::jsonb,
    
    -- Security
    requires_approval BOOLEAN DEFAULT false,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    allowed_agents UUID[],
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_health_check_at TIMESTAMPTZ,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    tools_count INTEGER DEFAULT 0,
    
    -- Audit
    registered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(organization_id, name)
);

COMMENT ON TABLE mcp_servers IS 'Registry of MCP (Model Context Protocol) servers';

-- Tools Registry (MCP, API, webhooks, built-in)
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Tool Identity
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tool_type TEXT NOT NULL DEFAULT 'function' CHECK (tool_type IN (
        'function', 'mcp', 'api', 'webhook', 'builtin'
    )),
    
    -- MCP-specific
    mcp_server_id UUID REFERENCES mcp_servers(id) ON DELETE CASCADE,
    mcp_server_url TEXT,
    mcp_protocol_version TEXT DEFAULT '1.0',
    
    -- Schema (OpenAI function format)
    parameters_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    return_schema JSONB DEFAULT '{}'::jsonb,
    
    -- Security
    requires_approval BOOLEAN DEFAULT false,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    allowed_roles TEXT[] DEFAULT ARRAY['owner', 'admin', 'developer'],
    allowed_agents UUID[],
    max_calls_per_minute INTEGER DEFAULT 60 CHECK (max_calls_per_minute > 0),
    
    -- Visibility
    is_public BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    
    -- Metrics
    usage_count BIGINT DEFAULT 0,
    success_rate NUMERIC(5, 2) DEFAULT 100.00 CHECK (success_rate >= 0 AND success_rate <= 100),
    avg_duration_ms INTEGER,
    
    -- Metadata
    version TEXT DEFAULT '1.0.0',
    author_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Normalize NULL org to a sentinel for uniqueness across public + org scopes
    organization_id_normalized UUID GENERATED ALWAYS AS (
        COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) STORED,
    
    CONSTRAINT tools_org_name_unique UNIQUE (organization_id_normalized, name)
);

COMMENT ON TABLE tools IS 'Unified registry for all tools (MCP, API, webhooks, built-in)';
COMMENT ON COLUMN tools.parameters_schema IS 'OpenAI function calling format schema';

-- Tool Call Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS tool_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
    request_log_id UUID REFERENCES request_logs(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Tool Info
    tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
    tool_name TEXT NOT NULL,
    tool_type TEXT,
    
    -- Call Details
    input_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_result JSONB,
    
    -- Security
    threat_detected BOOLEAN DEFAULT false,
    threat_type TEXT,
    was_blocked BOOLEAN DEFAULT false,
    was_redacted BOOLEAN DEFAULT false,
    
    -- Approval
    approval_required BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'success', 'failed', 'blocked', 'timeout', 'cancelled', 'threat_detected'
    )),
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0
);

COMMENT ON TABLE tool_call_logs IS 'Audit trail for all tool invocations with DLP results';

-- Agent API Keys (Optional: Dedicated keys for agents)
CREATE TABLE IF NOT EXISTS agent_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Key Info
    key_name TEXT NOT NULL CHECK (char_length(key_name) >= 1 AND char_length(key_name) <= 100),
    key_prefix TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    
    -- Limits
    rate_limit_per_minute INTEGER DEFAULT 60,
    max_tokens_per_request INTEGER DEFAULT 4096,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Rotation
    rotation_required_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE agent_api_keys IS 'Dedicated API keys for agents with separate limits';

-- Tool Approvals (Approval Workflow for High-Risk Tools)
CREATE TABLE IF NOT EXISTS tool_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Tool Info
    tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
    tool_name TEXT NOT NULL,
    agent_session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
    
    -- Request Info
    requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE tool_approvals IS 'Approval workflow for high-risk tool invocations';

-- Notifications (In-App Notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Content
    type TEXT NOT NULL,  -- 'anomaly_alert', 'budget_warning', 'key_rotation', 'achievement', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,  -- e.g., '/dashboard/alerts'
    
    -- Priority & Status
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ  -- Auto-dismiss after this time (optional)
);

COMMENT ON TABLE notifications IS 'In-app notifications for users and organizations - Real-time enabled';

-- Organization Settings (Key-Value Store)
CREATE TABLE IF NOT EXISTS organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, key)
);

COMMENT ON TABLE organization_settings IS 'Organization-level settings (webhooks, integrations)';

-- Notification Settings (Org-scoped)
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    alerts_email TEXT,
    budget_email_enabled BOOLEAN NOT NULL DEFAULT true,
    anomaly_email_enabled BOOLEAN NOT NULL DEFAULT true,
    slack_webhook_url TEXT,
    slack_enabled BOOLEAN NOT NULL DEFAULT false,
    discord_webhook_url TEXT,
    discord_enabled BOOLEAN NOT NULL DEFAULT false,
    zapier_webhook_url TEXT,
    zapier_enabled BOOLEAN NOT NULL DEFAULT false,
    zapier_events TEXT[] NOT NULL DEFAULT ARRAY['budget.threshold_crossed','anomaly.raised'],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Webhooks (Org-scoped)
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT,
    event_types TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    disabled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(organization_id) WHERE disabled_at IS NULL;

-- ============================================================================
-- ANOMALY DETECTION TABLES (AI Control Plane - Intelligence Layer)
-- ============================================================================
-- Enables: Proactive anomaly detection, cost spike alerts, security monitoring
-- ============================================================================

-- Anomaly Alerts (Detected Anomalies Storage)
CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Anomaly Classification
    anomaly_type TEXT NOT NULL CHECK (anomaly_type IN (
        'cost_spike',
        'volume_spike', 
        'model_shift',
        'tool_abuse',
        'time_anomaly',
        'dlp_pattern',
        'session_burst',
        'budget_burn'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Entity Reference (what entity is affected)
    entity_type TEXT NOT NULL CHECK (entity_type IN ('agent', 'project', 'organization', 'user')),
    entity_id TEXT NOT NULL,
    
    -- Description & Metrics
    description TEXT NOT NULL,
    metric_value NUMERIC(20, 6),
    baseline_value NUMERIC(20, 6),
    deviation_percent NUMERIC(10, 2),
    
    -- Metadata (JSON for flexibility)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Workflow Status
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved', 'ignored')),
    acknowledged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE anomaly_alerts IS 'Detected anomalies for review and tracking';

-- Anomaly Detection Configuration (Per-Organization)
CREATE TABLE IF NOT EXISTS anomaly_detection_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Feature Toggles
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    cost_spike_enabled BOOLEAN NOT NULL DEFAULT true,
    volume_spike_enabled BOOLEAN NOT NULL DEFAULT true,
    budget_burn_enabled BOOLEAN NOT NULL DEFAULT true,
    dlp_pattern_enabled BOOLEAN NOT NULL DEFAULT true,
    session_burst_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Custom Thresholds (NULL = use defaults)
    cost_spike_threshold NUMERIC(5, 2),  -- e.g., 3.0 = 3x baseline
    volume_spike_threshold NUMERIC(5, 2),
    budget_burn_hours INT,  -- Hours before budget exhaustion to alert
    session_burst_per_minute INT,
    dlp_threat_rate_threshold NUMERIC(5, 4),  -- e.g., 0.05 = 5%
    
    -- Alert Configuration
    alert_email BOOLEAN NOT NULL DEFAULT true,
    alert_slack BOOLEAN NOT NULL DEFAULT false,
    alert_webhook_url TEXT,
    alert_minimum_severity TEXT NOT NULL DEFAULT 'medium' CHECK (alert_minimum_severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(organization_id)
);

COMMENT ON TABLE anomaly_detection_config IS 'Per-organization anomaly detection thresholds and alert settings';

-- ============================================================================
-- SECTION 3: INDEXES
-- ============================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_credits_balance ON profiles(credits_balance) WHERE credits_balance > 0;
CREATE INDEX IF NOT EXISTS idx_profiles_referral_count ON profiles(referral_count DESC) WHERE referral_count > 0;

-- Monthly usage tracking (per organization, per month)
CREATE TABLE IF NOT EXISTS org_monthly_usage (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    PRIMARY KEY (organization_id, month)
);
CREATE INDEX IF NOT EXISTS idx_profiles_signup_ip ON profiles(signup_ip);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_fraud_score ON profiles(fraud_score) WHERE fraud_score > 50;

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_owner_user_id ON organizations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_id ON organizations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_organizations_sso_domain ON organizations(sso_domain) WHERE sso_enabled = true AND sso_domain_verified = true;
CREATE INDEX IF NOT EXISTS idx_organizations_sso_provider ON organizations(sso_provider_id) WHERE sso_enabled = true;

-- Organization Members
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_organization_members_status ON organization_members(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_org_members_org_role_status ON organization_members(organization_id, role, status) WHERE status = 'active';

-- Providers
CREATE INDEX IF NOT EXISTS idx_providers_organization_id ON providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_key_secret_id ON providers(key_secret_id);
CREATE INDEX IF NOT EXISTS idx_providers_is_active ON providers(is_active) WHERE is_active = true;

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_last_sync_id ON projects(last_sync_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_current_spend ON projects(current_spend) WHERE current_spend > 0;

-- API Keys
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_rotation_required ON api_keys(rotation_required_at) WHERE is_active = true;

-- Request Logs
CREATE INDEX IF NOT EXISTS idx_request_logs_organization_id ON request_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_project_id ON request_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_model ON request_logs(model);
CREATE INDEX IF NOT EXISTS idx_request_logs_provider ON request_logs(provider);
CREATE INDEX IF NOT EXISTS idx_request_logs_cache_hit ON request_logs(cache_hit) WHERE cache_hit = true;
CREATE INDEX IF NOT EXISTS idx_request_logs_threat_detected ON request_logs(threat_detected) WHERE threat_detected = true;
CREATE INDEX IF NOT EXISTS idx_request_logs_org_created ON request_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_org_threat ON request_logs(organization_id, threat_detected) WHERE threat_detected = true;
CREATE INDEX IF NOT EXISTS idx_request_logs_project_created ON request_logs(project_id, created_at DESC);

-- Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_log_organization_id ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type_id ON audit_log(resource_type, resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON audit_log(organization_id, created_at DESC);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription ON subscription_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period ON subscription_usage(period_start, period_end);

-- Billing
CREATE INDEX IF NOT EXISTS idx_billing_audit_user ON billing_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_subscription ON billing_audit_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_event_type ON billing_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_audit_created ON billing_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_audit_stripe_event ON billing_audit_log(stripe_event_id) WHERE stripe_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_pm ON payment_methods(stripe_payment_method_id);

-- Email Logs
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON email_logs(resend_email_id) WHERE resend_email_id IS NOT NULL;

-- Team Invites
CREATE INDEX IF NOT EXISTS idx_team_invites_org ON team_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(invite_token_hash);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON team_invites(status);
CREATE INDEX IF NOT EXISTS idx_team_invites_expires ON team_invites(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_invites_invited_by ON team_invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_team_invites_accepted_by ON team_invites(accepted_by);

-- SSO Audit
CREATE INDEX IF NOT EXISTS idx_sso_audit_organization ON sso_audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sso_audit_actor ON sso_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sso_audit_action ON sso_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sso_audit_affected_user ON sso_audit_log(affected_user_id, created_at DESC);

-- Cost Attribution
CREATE INDEX IF NOT EXISTS idx_cost_attribution_tags_org_key ON cost_attribution_tags(organization_id, key);
CREATE INDEX IF NOT EXISTS idx_cost_attribution_tags_type ON cost_attribution_tags(organization_id, tag_type) WHERE tag_type != 'custom';
CREATE INDEX IF NOT EXISTS idx_cost_attribution_tags_billable ON cost_attribution_tags(organization_id, is_billable) WHERE is_billable = true;
CREATE INDEX IF NOT EXISTS idx_cost_attribution_tags_cost_desc ON cost_attribution_tags(organization_id, total_cost_usd DESC);
CREATE INDEX IF NOT EXISTS idx_request_attribution_tag ON request_attribution(tag_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_attribution_org_time ON request_attribution(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_attribution_request ON request_attribution(request_log_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_rules_org_active ON chargeback_rules(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_chargeback_rules_target ON chargeback_rules(organization_id, chargeback_target_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_invoices_org_period ON chargeback_invoices(organization_id, period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_chargeback_invoices_status ON chargeback_invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_chargeback_invoices_target ON chargeback_invoices(chargeback_target_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_chargeback_invoices_rule ON chargeback_invoices(chargeback_rule_id);

-- Add-Ons & Marketplace
CREATE INDEX IF NOT EXISTS idx_organization_add_ons_org_id ON organization_add_ons(organization_id) WHERE canceled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organization_add_ons_addon ON organization_add_ons(add_on_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_invited_by ON organization_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompts_author ON prompts(author_user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_verified ON prompts(is_verified) WHERE is_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_prompts_premium ON prompts(is_premium) WHERE is_premium = TRUE;
CREATE INDEX IF NOT EXISTS idx_prompts_usage_count ON prompts(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_avg_rating ON prompts(avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_ratings_prompt_id ON prompt_ratings(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_ratings_user_id ON prompt_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_recommendations_org_id ON cost_recommendations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_cost_recommendations_status ON cost_recommendations(status) WHERE status = 'pending';

-- Achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_type ON user_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_user_achievements_celebrated ON user_achievements(user_id, celebrated) WHERE celebrated = false;
CREATE INDEX IF NOT EXISTS idx_user_achievements_created ON user_achievements(created_at DESC);

-- ============================================================================
-- AGENT SUPPORT INDEXES (AI Control Plane)
-- ============================================================================

-- Agents
CREATE INDEX IF NOT EXISTS idx_agents_organization ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents(last_active_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agents_budget ON agents(organization_id, current_spend) WHERE budget_limit > 0;
CREATE INDEX IF NOT EXISTS idx_agents_name_search ON agents USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_agents_created_by ON agents(created_by);

-- Agent Sessions
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_org ON agent_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_project ON agent_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_agent_sessions_started ON agent_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_kill ON agent_sessions(kill_requested_at) WHERE kill_requested_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_status ON agent_sessions(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_kill_requested_by ON agent_sessions(kill_requested_by);

-- MCP Servers
CREATE INDEX IF NOT EXISTS idx_mcp_servers_org ON mcp_servers(organization_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_active ON mcp_servers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mcp_servers_health ON mcp_servers(health_status);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_url ON mcp_servers(server_url);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_registered_by ON mcp_servers(registered_by);

-- Tools
CREATE INDEX IF NOT EXISTS idx_tools_organization ON tools(organization_id);
CREATE INDEX IF NOT EXISTS idx_tools_mcp_server ON tools(mcp_server_id);
CREATE INDEX IF NOT EXISTS idx_tools_type ON tools(tool_type);
CREATE INDEX IF NOT EXISTS idx_tools_public ON tools(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_tools_risk ON tools(risk_level) WHERE risk_level IN ('high', 'critical');
CREATE INDEX IF NOT EXISTS idx_tools_usage ON tools(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_tools_name_search ON tools USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tools_verified ON tools(is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_tools_author_user_id ON tools(author_user_id);

-- Tool Call Logs
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_session ON tool_call_logs(agent_session_id);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_org ON tool_call_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_tool ON tool_call_logs(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_request ON tool_call_logs(request_log_id);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_threat ON tool_call_logs(threat_detected) WHERE threat_detected = true;
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_status ON tool_call_logs(status);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_started ON tool_call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_org_time ON tool_call_logs(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_blocked ON tool_call_logs(was_blocked) WHERE was_blocked = true;
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_approved_by ON tool_call_logs(approved_by);

-- Agent API Keys
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_agent ON agent_api_keys(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_hash ON agent_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_active ON agent_api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_prefix ON agent_api_keys(key_prefix);

-- Tool Approvals
CREATE INDEX IF NOT EXISTS idx_tool_approvals_org ON tool_approvals(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_approvals_tool ON tool_approvals(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_approvals_status ON tool_approvals(status);
CREATE INDEX IF NOT EXISTS idx_tool_approvals_pending ON tool_approvals(organization_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tool_approvals_session ON tool_approvals(agent_session_id);
CREATE INDEX IF NOT EXISTS idx_tool_approvals_expires ON tool_approvals(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tool_approvals_approved_by ON tool_approvals(approved_by);
CREATE INDEX IF NOT EXISTS idx_tool_approvals_requested_by ON tool_approvals(requested_by);

-- Admin Audit Logs (org-scoped configuration changes)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID,
    actor_type TEXT NOT NULL DEFAULT 'api_key' CHECK (actor_type IN ('api_key','user','system')),
    event_type TEXT NOT NULL,
    source_ip TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_org_created ON admin_audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_event ON admin_audit_logs(event_type);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Organization Settings
CREATE INDEX IF NOT EXISTS idx_org_settings_org ON organization_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_settings_key ON organization_settings(organization_id, key);
CREATE INDEX IF NOT EXISTS idx_organizations_sso_configured_by ON organizations(sso_configured_by);

-- ============================================================================
-- ANOMALY DETECTION INDEXES (AI Control Plane - Intelligence Layer)
-- ============================================================================

-- Anomaly Alerts (optimized for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_org ON anomaly_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_type ON anomaly_alerts(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_severity ON anomaly_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_status ON anomaly_alerts(status);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_detected ON anomaly_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_entity ON anomaly_alerts(entity_type, entity_id);

-- Composite index for common query pattern (dashboard widget)
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_org_status_severity 
    ON anomaly_alerts(organization_id, status, severity);

-- Active alerts lookup (for real-time dashboard)
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_active 
    ON anomaly_alerts(organization_id, status) WHERE status IN ('new', 'acknowledged');
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_ack_by ON anomaly_alerts(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_resolved_by ON anomaly_alerts(resolved_by);

-- Anomaly Detection Config (simple org lookup)
CREATE INDEX IF NOT EXISTS idx_anomaly_config_org ON anomaly_detection_config(organization_id);

-- ============================================================================
-- OPTIMIZATION INDEXES (Added from Audit)
-- ============================================================================
-- Composite index for active subscription lookup (critical for billing)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
    ON subscriptions(user_id, status) WHERE status IN ('active', 'trialing');

-- Subscription ordering by creation date
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at 
    ON subscriptions(created_at DESC);

-- Active providers lookup per organization
CREATE INDEX IF NOT EXISTS idx_providers_org_active 
    ON providers(organization_id, is_active) WHERE is_active = true;

-- API key prefix search (for key lookup optimization)
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix 
    ON api_keys(key_prefix);

-- ============================================================================
-- SECTION 4: FUNCTIONS (HARDENED with search_path)
-- ============================================================================
-- All functions include SET search_path for security

-- Referral Code Generator
CREATE OR REPLACE FUNCTION fn_generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public, auth, extensions, temp
AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
    v_attempt INT := 0;
    v_max_attempts INT := 5;
    v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
    LOOP
        v_code := 'OXY-';
        FOR i IN 1..5 LOOP
            v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
        END LOOP;
        SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = v_code) INTO v_exists;
        IF NOT v_exists THEN RETURN v_code; END IF;
        v_attempt := v_attempt + 1;
        IF v_attempt >= v_max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', v_max_attempts;
        END IF;
    END LOOP;
END;
$$;

-- Auto Generate Referral Code Trigger Function
CREATE OR REPLACE FUNCTION fn_auto_generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth, extensions, temp
AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := fn_generate_referral_code();
    END IF;
    RETURN NEW;
END;
$$;

-- Handle New User (Profile Creation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- GDPR User Offboarding (Right to Erasure - Article 17)
-- ============================================================================
-- Deletes all user data across all tables. CASCADE handles most deletions,
-- but this function ensures complete cleanup including audit logging.
-- 
-- IMPORTANT: This is called via RPC from /management/offboard endpoint
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_offboard_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, temp
AS $$
DECLARE
    v_email TEXT;
    v_deleted_orgs INTEGER := 0;
    v_deleted_projects INTEGER := 0;
    v_deleted_keys INTEGER := 0;
BEGIN
    -- 1. Get user email for audit log (before deletion)
    SELECT email INTO v_email FROM profiles WHERE id = p_user_id;
    
    IF v_email IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- 2. Count what we're deleting (for audit)
    SELECT COUNT(*) INTO v_deleted_orgs FROM organizations WHERE owner_user_id = p_user_id;
    SELECT COUNT(*) INTO v_deleted_projects FROM projects WHERE user_id = p_user_id;
    SELECT COUNT(*) INTO v_deleted_keys FROM api_keys WHERE user_id = p_user_id;
    
    -- 3. Log GDPR deletion request BEFORE deletion (immutable audit trail)
    INSERT INTO audit_log (
        user_id, action, entity_type, entity_id, metadata, ip_address
    ) VALUES (
        p_user_id,
        'gdpr_erasure_request',
        'user',
        p_user_id,
        jsonb_build_object(
            'email_hash', encode(sha256(v_email::bytea), 'hex'),
            'organizations_deleted', v_deleted_orgs,
            'projects_deleted', v_deleted_projects,
            'api_keys_deleted', v_deleted_keys,
            'requested_at', now()
        ),
        '0.0.0.0'  -- System action
    );
    
    -- 4. Delete from vault secrets (if applicable)
    -- Note: Supabase Vault handles this via foreign key CASCADE on provider_keys
    
    -- 5. Delete organization memberships (user is member of)
    DELETE FROM organization_members WHERE user_id = p_user_id;
    
    -- 6. Delete organizations owned by user (CASCADE handles projects, keys, etc.)
    DELETE FROM organizations WHERE owner_user_id = p_user_id;
    
    -- 7. Delete user's direct projects (not via org)
    DELETE FROM projects WHERE user_id = p_user_id;
    
    -- 8. Delete user's direct API keys
    DELETE FROM api_keys WHERE user_id = p_user_id;
    
    -- 9. Delete user profile (must be last due to foreign keys)
    DELETE FROM profiles WHERE id = p_user_id;
    
    -- 10. Note: We do NOT delete from auth.users - that's handled by Supabase Auth
    -- The application should call supabase.auth.admin.deleteUser() separately
    
    RETURN jsonb_build_object(
        'success', true,
        'deleted', jsonb_build_object(
            'organizations', v_deleted_orgs,
            'projects', v_deleted_projects,
            'api_keys', v_deleted_keys
        ),
        'completed_at', now()
    );
END;
$$;

-- Grant execute to authenticated users (for self-deletion)
GRANT EXECUTE ON FUNCTION fn_offboard_user(UUID) TO authenticated;

-- Generic Updated At Trigger
CREATE OR REPLACE FUNCTION trigger_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth, extensions, temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Prevent Self Referral (Fraud Prevention)
CREATE OR REPLACE FUNCTION fn_prevent_self_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth, extensions, temp
AS $$
BEGIN
    IF NEW.referred_by IS NOT NULL AND NEW.referred_by = NEW.id THEN
        RAISE EXCEPTION 'Self-referral is not allowed.';
    END IF;
    IF NEW.referred_by IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.referred_by AND referred_by = NEW.id) THEN
            RAISE EXCEPTION 'Circular referral detected.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- User Onboarding (Atomic Transaction)
-- Supports OpenAI, Anthropic, and Google providers (at least one key required)
CREATE OR REPLACE FUNCTION fn_onboard_user(payload JSONB)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, vault, temp
AS $$
DECLARE
    p_user_id UUID;
    p_full_name TEXT;
    p_email TEXT;
    p_openai_key TEXT;
    p_anthropic_key TEXT;    -- Anthropic Claude support
    p_google_key TEXT;       -- Google Gemini support
    p_signup_ip INET;
    p_signup_user_agent TEXT;
    p_referral_code TEXT;
    
    v_org_id UUID;
    v_project_id UUID;
    v_api_key_id UUID;
    v_key_prefix TEXT;
    v_key_hash TEXT;
    v_raw_key TEXT;
    v_secret_id UUID;
    v_member_id UUID;
BEGIN
    -- Extract parameters from JSON payload
    p_user_id := (payload->>'p_user_id')::UUID;
    p_full_name := payload->>'p_full_name';
    p_email := payload->>'p_email';
    p_openai_key := payload->>'p_openai_key';
    p_anthropic_key := payload->>'p_anthropic_key';  -- Extract Anthropic key
    p_google_key := payload->>'p_google_key';        -- Extract Google key
    p_referral_code := payload->>'p_referral_code';
    
    -- Handle IP address safely (allow null or valid IP)
    BEGIN
        p_signup_ip := (payload->>'p_signup_ip')::INET;
    EXCEPTION WHEN OTHERS THEN
        p_signup_ip := NULL;
    END;
    
    p_signup_user_agent := payload->>'p_signup_user_agent';

    -- 1. Update Profile
    UPDATE profiles 
    SET full_name = p_full_name, 
        onboarded_at = now(),
        signup_ip = p_signup_ip,
        signup_user_agent = p_signup_user_agent,
        referred_by = (SELECT id FROM profiles WHERE referral_code = p_referral_code LIMIT 1)
    WHERE id = p_user_id;

    -- 2. Create Organization
    INSERT INTO organizations (name, owner_user_id)
    VALUES (
        COALESCE(p_full_name, 'My Organization') || '''s Organization',
        p_user_id
    )
    RETURNING id INTO v_org_id;

    -- 3. Add Member (Owner)
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'owner')
    RETURNING id INTO v_member_id;

    -- 4. Create Default Project
    INSERT INTO projects (organization_id, user_id, name, budget_limit)
    VALUES (v_org_id, p_user_id, 'Default Project', 10.00)
    RETURNING id INTO v_project_id;

    -- 5a. Add OpenAI Provider (if key provided)
    IF p_openai_key IS NOT NULL AND p_openai_key != '' THEN
        v_secret_id := gen_random_uuid();
        -- Encrypt key using Vault
        PERFORM vault.create_secret(p_openai_key, 'openai_key_' || v_secret_id);
        
        INSERT INTO providers (organization_id, user_id, provider_name, key_secret_id)
        VALUES (v_org_id, p_user_id, 'openai', v_secret_id);
    END IF;

    -- 5b. Add Anthropic Provider (if key provided)
    IF p_anthropic_key IS NOT NULL AND p_anthropic_key != '' THEN
        v_secret_id := gen_random_uuid();
        -- Encrypt key using Vault
        PERFORM vault.create_secret(p_anthropic_key, 'anthropic_key_' || v_secret_id);
        
        INSERT INTO providers (organization_id, user_id, provider_name, key_secret_id)
        VALUES (v_org_id, p_user_id, 'anthropic', v_secret_id);
    END IF;

    -- 5c. Add Google Gemini Provider (if key provided)
    IF p_google_key IS NOT NULL AND p_google_key != '' THEN
        v_secret_id := gen_random_uuid();
        -- Encrypt key using Vault
        PERFORM vault.create_secret(p_google_key, 'google_key_' || v_secret_id);
        
        INSERT INTO providers (organization_id, user_id, provider_name, key_secret_id)
        VALUES (v_org_id, p_user_id, 'google', v_secret_id);
    END IF;

    -- 6. Create Default API Key
    v_key_prefix := 'oxy_live_' || substr(md5(random()::text), 1, 6);
    v_raw_key := v_key_prefix || '_' || replace(gen_random_uuid()::text, '-', '');
    v_key_hash := encode(digest(v_raw_key, 'sha256'), 'hex');

    INSERT INTO api_keys (project_id, created_by, key_name, key_prefix, key_hash)
    VALUES (v_project_id, p_user_id, 'Default', v_key_prefix, v_key_hash)
    RETURNING id INTO v_api_key_id;

    RETURN json_build_object(
        'success', true,
        'profile_id', p_user_id,
        'organization_id', v_org_id,
        'project_id', v_project_id,
        'member_id', v_member_id,
        'api_key', v_raw_key
    );
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Onboarding failed: %', SQLERRM;
END;
$$;

-- Grant execute on onboarding function (JSONB signature)
GRANT EXECUTE ON FUNCTION fn_onboard_user(JSONB) TO authenticated, service_role;

-- ============================================================================
-- FUNCTION: Update provider key (Dashboard → AI Provider Keys)
-- ============================================================================
-- Params:
--   p_organization_id UUID
--   p_user_id UUID
--   p_provider_name TEXT ('openai' | 'anthropic' | 'google')
--   p_api_key TEXT (plaintext; stored encrypted in Vault)
--
-- Behavior:
--   - Encrypts api_key via vault.create_secret
--   - Upserts into providers on (organization_id, provider_name)
--   - Returns the updated providers row
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_update_provider_key(
    p_organization_id UUID,
    p_user_id UUID,
    p_provider_name TEXT,
    p_api_key TEXT
)
RETURNS public.providers
LANGUAGE plpgsql
SET search_path = public, auth, extensions, temp
AS $$
DECLARE
    v_secret_id UUID;
    v_provider providers;
BEGIN
    IF p_api_key IS NULL OR p_api_key = '' THEN
        RAISE EXCEPTION 'API key cannot be empty';
    END IF;
    
    IF p_provider_name NOT IN ('openai', 'anthropic', 'google') THEN
        RAISE EXCEPTION 'provider_name must be one of: openai, anthropic, google';
    END IF;
    
    v_secret_id := gen_random_uuid();
    PERFORM vault.create_secret(p_api_key, p_provider_name || '_key_' || v_secret_id);
    
    INSERT INTO providers (organization_id, user_id, provider_name, key_secret_id, is_active, last_validated_at)
    VALUES (p_organization_id, p_user_id, p_provider_name, v_secret_id, true, now())
    ON CONFLICT (organization_id, provider_name)
    DO UPDATE SET
        key_secret_id = EXCLUDED.key_secret_id,
        user_id = EXCLUDED.user_id,
        is_active = true,
        last_validated_at = now(),
        updated_at = now()
    RETURNING * INTO v_provider;
    
    RETURN v_provider;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_update_provider_key(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;

-- Validate API Key (Bypass RLS for Auth)
-- SECURITY DEFINER runs with owner privileges to bypass RLS
-- This allows unauthenticated requests to validate API keys
CREATE OR REPLACE FUNCTION fn_validate_api_key(p_key_hash TEXT)
RETURNS TABLE (
    api_key_id UUID,
    project_id UUID,
    user_id UUID,
    organization_id UUID,
    budget_limit DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        k.id, 
        k.project_id, 
        k.created_by,
        p.organization_id,
        p.budget_limit
    FROM api_keys k
    JOIN projects p ON k.project_id = p.id
    WHERE k.key_hash = p_key_hash 
    AND k.is_active = true
    AND (k.expires_at IS NULL OR k.expires_at > now())
    -- A deleted project is deactivated, not erased: its keys never authenticate.
    AND COALESCE(p.status, 'active') <> 'deleted';
END;
$$;

-- Grant execute permission to anon (so the API can call it before auth)
GRANT EXECUTE ON FUNCTION fn_validate_api_key(TEXT) TO anon, authenticated, service_role;

-- Check Organization Permission
CREATE OR REPLACE FUNCTION fn_check_org_permission(
    p_user_id UUID,
    p_organization_id UUID,
    p_required_role TEXT DEFAULT 'developer'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, temp
AS $$
DECLARE
    v_user_role TEXT;
    v_role_hierarchy INTEGER;
    v_required_hierarchy INTEGER;
BEGIN
    SELECT role INTO v_user_role FROM organization_members
    WHERE user_id = p_user_id AND organization_id = p_organization_id AND status = 'active';
    IF v_user_role IS NULL THEN RETURN FALSE; END IF;
    CASE v_user_role
        WHEN 'owner' THEN v_role_hierarchy := 3;
        WHEN 'admin' THEN v_role_hierarchy := 2;
        WHEN 'developer' THEN v_role_hierarchy := 1;
        ELSE v_role_hierarchy := 0;
    END CASE;
    CASE p_required_role
        WHEN 'owner' THEN v_required_hierarchy := 3;
        WHEN 'admin' THEN v_required_hierarchy := 2;
        WHEN 'developer' THEN v_required_hierarchy := 1;
        ELSE v_required_hierarchy := 0;
    END CASE;
    RETURN v_role_hierarchy >= v_required_hierarchy;
END;
$$;

-- Persist Spend (Budget Sync)
-- Budget worker: copy the Redis spend counter (the project's total spend, the
-- budget's ledger) into projects.current_spend. A copy, not an increment: the
-- same value written twice changes nothing, and nothing is lost if a write fails.
CREATE OR REPLACE FUNCTION fn_mirror_spend(
    p_project_id UUID,
    p_spend TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, temp
AS $$
BEGIN
    UPDATE projects SET
        current_spend = GREATEST(p_spend::NUMERIC, 0),
        last_synced_at = now(),
        updated_at = now()
    WHERE id = p_project_id;
END;
$$;

-- Get Hot Projects (Cache Warmer)
CREATE OR REPLACE FUNCTION fn_get_hot_projects(p_min_requests int)
RETURNS TABLE (project_id uuid, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, temp
AS $$
BEGIN
    RETURN QUERY
    SELECT r.project_id, COUNT(*) as count
    FROM request_logs r
    WHERE r.created_at > (now() - interval '24 hours')
    GROUP BY r.project_id
    HAVING COUNT(*) >= p_min_requests;
END;
$$;

-- IP Signup Limit Check (Fraud Prevention)
CREATE OR REPLACE FUNCTION fn_check_ip_signup_limit(p_ip INET, p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, temp
AS $$
DECLARE
    v_ip_signup_count INTEGER;
    v_domain TEXT;
    v_domain_signup_count INTEGER;
    v_is_blocked BOOLEAN := false;
    v_block_reason TEXT;
BEGIN
    v_domain := SPLIT_PART(p_email, '@', 2);
    SELECT COUNT(*) INTO v_ip_signup_count FROM profiles
    WHERE signup_ip = p_ip AND created_at > NOW() - INTERVAL '24 hours';
    
    SELECT COUNT(*) INTO v_domain_signup_count FROM profiles p JOIN auth.users u ON p.id = u.id
    WHERE SPLIT_PART(u.email, '@', 2) = v_domain AND p.created_at > NOW() - INTERVAL '7 days'
    AND v_domain NOT IN ('google.com', 'microsoft.com', 'apple.com', 'stripe.com', 'amazon.com', 'meta.com', 'github.com');
    
    IF v_ip_signup_count >= 3 THEN
        v_is_blocked := true; v_block_reason := 'Too many signups from this IP (limit: 3/24h)';
    END IF;
    IF v_domain_signup_count >= 10 THEN
        v_is_blocked := true; v_block_reason := 'Too many signups from this domain (limit: 10/7d)';
    END IF;
    
    RETURN json_build_object('is_blocked', v_is_blocked, 'block_reason', v_block_reason,
        'ip_signup_count_24h', v_ip_signup_count, 'domain_signup_count_7d', v_domain_signup_count);
END;
$$;

-- Atomic Budget Reservation (Race-Condition Safe)
CREATE OR REPLACE FUNCTION fn_atomic_reserve_budget(p_project_id UUID, p_amount DECIMAL, p_budget_limit DECIMAL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, temp
AS $$
DECLARE
    v_current_spend DECIMAL;
    v_projected DECIMAL;
BEGIN
    SELECT current_spend INTO v_current_spend FROM projects WHERE id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('status', 'ERROR', 'message', 'Project not found'); END IF;
    v_projected := v_current_spend + p_amount;
    IF p_budget_limit > 0 AND v_projected > p_budget_limit THEN
        RETURN json_build_object('status', 'BUDGET_EXCEEDED', 'current_spend', v_current_spend, 'limit', p_budget_limit);
    END IF;
    UPDATE projects SET current_spend = v_projected, updated_at = now() WHERE id = p_project_id;
    RETURN json_build_object('status', 'OK', 'current_spend', v_current_spend, 'new_spend', v_projected);
END;
$$;

-- Vault Decryption
-- ============================================================================
-- fn_get_subscription_status: Get user's subscription status with usage & limits
-- ============================================================================
-- CRITICAL: Called by billing.py GET /subscription-status
-- Returns JSONB with: subscription object, usage counts, plan limits
-- 
-- LOOKUP STRATEGY (tries multiple paths):
-- 1. Direct: subscriptions.user_id = p_user_id
-- 2. Via Organization: organizations.owner_user_id = p_user_id
-- 3. Via Membership: organization_members.user_id = p_user_id -> org -> subscription
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_get_subscription_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_subscription RECORD;
    v_usage RECORD;
    v_requests_limit INTEGER;
    v_org_id UUID;
BEGIN
    -- 1. Verify profile exists
    SELECT id, credits_balance
    INTO v_profile
    FROM profiles
    WHERE id = p_user_id;
    
    IF v_profile IS NULL THEN
        RETURN jsonb_build_object('subscription', NULL);
    END IF;
    
    -- 2. STRATEGY A: Direct lookup by user_id
    SELECT 
        id, plan_tier, status, interval, billing_interval,
        current_period_start, current_period_end,
        cancel_at_period_end, trial_end
    INTO v_subscription
    FROM subscriptions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- 3. STRATEGY B: If no direct subscription, try via organization ownership
    IF v_subscription IS NULL THEN
        -- Find organization where user is owner
        SELECT id INTO v_org_id
        FROM organizations
        WHERE owner_user_id = p_user_id
        LIMIT 1;
        
        -- If user owns an org, check if org has a linked subscription
        IF v_org_id IS NOT NULL THEN
            SELECT 
                s.id, s.plan_tier, s.status, s.interval, s.billing_interval,
                s.current_period_start, s.current_period_end,
                s.cancel_at_period_end, s.trial_end
            INTO v_subscription
            FROM organizations o
            JOIN subscriptions s ON s.id = o.subscription_id
            WHERE o.id = v_org_id;
        END IF;
    END IF;
    
    -- 4. STRATEGY C: If still no subscription, try via organization membership
    IF v_subscription IS NULL THEN
        SELECT o.id INTO v_org_id
        FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id
        WHERE om.user_id = p_user_id
          AND om.status = 'active'
        ORDER BY om.created_at ASC  -- First org joined
        LIMIT 1;
        
        IF v_org_id IS NOT NULL THEN
            -- Check org's linked subscription
            SELECT 
                s.id, s.plan_tier, s.status, s.interval, s.billing_interval,
                s.current_period_start, s.current_period_end,
                s.cancel_at_period_end, s.trial_end
            INTO v_subscription
            FROM organizations o
            JOIN subscriptions s ON s.id = o.subscription_id
            WHERE o.id = v_org_id;
            
            -- Also check if org owner has a subscription
            IF v_subscription IS NULL THEN
                SELECT 
                    s.id, s.plan_tier, s.status, s.interval, s.billing_interval,
                    s.current_period_start, s.current_period_end,
                    s.cancel_at_period_end, s.trial_end
                INTO v_subscription
                FROM organizations o
                JOIN subscriptions s ON s.user_id = o.owner_user_id
                WHERE o.id = v_org_id
                ORDER BY s.created_at DESC
                LIMIT 1;
            END IF;
        END IF;
    END IF;
    
    -- 5. No subscription found via any strategy
    IF v_subscription IS NULL THEN
        RETURN jsonb_build_object('subscription', NULL);
    END IF;
    
    -- 6. Get current period usage
    SELECT 
        COALESCE(SUM(requests_count), 0)::BIGINT as requests_count,
        COALESCE(SUM(tokens_used), 0)::BIGINT as tokens_used
    INTO v_usage
    FROM subscription_usage
    WHERE subscription_id = v_subscription.id
      AND period_start <= now()
      AND period_end >= now();
    
    -- 7. No tier caps requests (budgets cap spend)
    v_requests_limit := NULL;
    
    -- 8. Build and return response
    RETURN jsonb_build_object(
        'subscription', jsonb_build_object(
            'id', v_subscription.id,
            'plan_tier', v_subscription.plan_tier,
            'status', v_subscription.status,
            'interval', COALESCE(v_subscription.interval, 'month'),
            'billing_interval', COALESCE(v_subscription.billing_interval, v_subscription.interval, 'month'),
            'current_period_start', v_subscription.current_period_start,
            'current_period_end', v_subscription.current_period_end,
            'cancel_at_period_end', COALESCE(v_subscription.cancel_at_period_end, false),
            'trial_end', v_subscription.trial_end,
            'credits_balance', COALESCE(v_profile.credits_balance, 0)
        ),
        'usage', jsonb_build_object(
            'requests_count', COALESCE(v_usage.requests_count, 0),
            'tokens_used', COALESCE(v_usage.tokens_used, 0)
        ),
        'limits', jsonb_build_object(
            'requests_limit', v_requests_limit
        )
    );
END;
$$;


CREATE OR REPLACE FUNCTION fn_decrypt_provider_key(p_secret_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions, temp
AS $$
DECLARE v_secret TEXT;
BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE id = p_secret_id;
    IF v_secret IS NULL THEN
        SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name LIKE '%' || p_secret_id::text || '%';
    END IF;
    IF v_secret IS NULL THEN RAISE EXCEPTION 'Secret not found: %', p_secret_id; END IF;
    RETURN json_build_object('decrypted_secret', v_secret);
END;
$$;

-- Prompt Rating Stats Update
CREATE OR REPLACE FUNCTION update_prompt_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth, extensions, temp
AS $$
BEGIN
    UPDATE prompts SET
        avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM prompt_ratings WHERE prompt_id = NEW.prompt_id),
        rating_count = (SELECT COUNT(*) FROM prompt_ratings WHERE prompt_id = NEW.prompt_id),
        updated_at = NOW()
    WHERE id = NEW.prompt_id;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- fn_get_project_stats: Get project statistics (requests, threats blocked)
-- ============================================================================
-- Called by: main.py GET /management/stats
-- Returns: total_requests, threats_blocked for given project
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_get_project_stats(p_project_id UUID)
RETURNS TABLE (
    total_requests BIGINT,
    threats_blocked BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(COUNT(*), 0)::BIGINT as total_requests,
        COALESCE(SUM(CASE WHEN threat_detected = true THEN 1 ELSE 0 END), 0)::BIGINT as threats_blocked
    FROM request_logs
    WHERE project_id = p_project_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION fn_get_project_stats(UUID) TO authenticated, service_role;

-- ============================================================================
-- AGENT SUPPORT FUNCTIONS (AI Control Plane)
-- ============================================================================

-- Increment tool usage count
CREATE OR REPLACE FUNCTION increment_tool_usage(p_tool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE tools SET 
        usage_count = usage_count + 1,
        updated_at = now()
    WHERE id = p_tool_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_tool_usage(UUID) TO authenticated, service_role;

-- Update agent stats after request
CREATE OR REPLACE FUNCTION fn_update_agent_stats(
    p_agent_id UUID,
    p_tokens INTEGER,
    p_cost NUMERIC,
    p_tool_calls INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE agents SET
        total_requests = total_requests + 1,
        total_tokens = total_tokens + p_tokens,
        current_spend = current_spend + p_cost,
        total_tool_calls = total_tool_calls + p_tool_calls,
        last_active_at = now(),
        updated_at = now()
    WHERE id = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_update_agent_stats(UUID, INTEGER, NUMERIC, INTEGER) TO authenticated, service_role;

-- Update session stats
CREATE OR REPLACE FUNCTION fn_update_session_stats(
    p_session_id UUID,
    p_tokens INTEGER,
    p_cost NUMERIC,
    p_tool_calls INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE agent_sessions SET
        total_requests = total_requests + 1,
        total_tokens = total_tokens + p_tokens,
        total_cost = total_cost + p_cost,
        total_tool_calls = total_tool_calls + p_tool_calls
    WHERE id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_update_session_stats(UUID, INTEGER, NUMERIC, INTEGER) TO authenticated, service_role;

-- Kill an agent session (callable from API)
CREATE OR REPLACE FUNCTION fn_kill_agent_session(
    p_session_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT 'Manual termination'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
BEGIN
    SELECT * INTO v_session FROM agent_sessions WHERE id = p_session_id;
    
    IF v_session IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Only an active member of the session's organization may kill it.
    IF NOT EXISTS (
        SELECT 1 FROM organization_members m
        WHERE m.organization_id = v_session.organization_id
          AND m.user_id = p_user_id
          AND m.status = 'active'
    ) THEN
        RETURN FALSE;
    END IF;
    
    IF v_session.status NOT IN ('pending', 'running') THEN
        RETURN FALSE;
    END IF;
    
    UPDATE agent_sessions SET
        status = 'killed',
        kill_requested_at = now(),
        kill_requested_by = p_user_id,
        kill_reason = p_reason,
        ended_at = now()
    WHERE id = p_session_id;
    
    RETURN TRUE;
END;
$$;

-- p_user_id is supplied by the caller: only the engine may call this (see section 4 below).
GRANT EXECUTE ON FUNCTION fn_kill_agent_session(UUID, UUID, TEXT) TO service_role;

-- Reset agent budgets (called by cron job)
CREATE OR REPLACE FUNCTION fn_reset_agent_budgets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
    v_temp INTEGER;
BEGIN
    -- Daily reset
    UPDATE agents SET
        current_spend = 0,
        last_reset_at = now()
    WHERE reset_period = 'daily'
    AND last_reset_at < now() - INTERVAL '1 day';
    GET DIAGNOSTICS v_temp = ROW_COUNT;
    v_count := v_count + v_temp;
    
    -- Weekly reset
    UPDATE agents SET
        current_spend = 0,
        last_reset_at = now()
    WHERE reset_period = 'weekly'
    AND last_reset_at < now() - INTERVAL '1 week';
    GET DIAGNOSTICS v_temp = ROW_COUNT;
    v_count := v_count + v_temp;
    
    -- Monthly reset
    UPDATE agents SET
        current_spend = 0,
        last_reset_at = now()
    WHERE reset_period = 'monthly'
    AND last_reset_at < now() - INTERVAL '1 month';
    GET DIAGNOSTICS v_temp = ROW_COUNT;
    v_count := v_count + v_temp;
    
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_reset_agent_budgets() TO service_role;

-- Validate agent API key (similar to fn_validate_api_key)
CREATE OR REPLACE FUNCTION fn_validate_agent_api_key(p_key_hash TEXT)
RETURNS TABLE (
    agent_api_key_id UUID,
    agent_id UUID,
    organization_id UUID,
    project_id UUID,
    rate_limit_per_minute INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        k.id,
        k.agent_id,
        a.organization_id,
        a.project_id,
        k.rate_limit_per_minute
    FROM agent_api_keys k
    JOIN agents a ON k.agent_id = a.id
    WHERE k.key_hash = p_key_hash 
    AND k.is_active = true
    AND a.status = 'active'
    AND (k.expires_at IS NULL OR k.expires_at > now());
END;
$$;

GRANT EXECUTE ON FUNCTION fn_validate_agent_api_key(TEXT) TO anon, authenticated, service_role;

-- Check agent budget before request
CREATE OR REPLACE FUNCTION fn_check_agent_budget(
    p_agent_id UUID,
    p_estimated_cost NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agent RECORD;
    v_projected NUMERIC;
BEGIN
    SELECT id, budget_limit, current_spend, status INTO v_agent
    FROM agents WHERE id = p_agent_id FOR UPDATE;
    
    IF v_agent IS NULL THEN
        RETURN json_build_object('status', 'ERROR', 'message', 'Agent not found');
    END IF;
    
    IF v_agent.status != 'active' THEN
        RETURN json_build_object('status', 'AGENT_PAUSED', 'message', 'Agent is not active');
    END IF;
    
    IF v_agent.budget_limit <= 0 THEN
        RETURN json_build_object('status', 'OK_UNLIMITED', 'current_spend', v_agent.current_spend);
    END IF;
    
    v_projected := v_agent.current_spend + p_estimated_cost;
    
    IF v_projected > v_agent.budget_limit THEN
        RETURN json_build_object(
            'status', 'BUDGET_EXCEEDED',
            'current_spend', v_agent.current_spend,
            'budget_limit', v_agent.budget_limit,
            'projected', v_projected
        );
    END IF;
    
    RETURN json_build_object(
        'status', 'OK',
        'current_spend', v_agent.current_spend,
        'budget_limit', v_agent.budget_limit,
        'remaining', v_agent.budget_limit - v_agent.current_spend
    );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_check_agent_budget(UUID, NUMERIC) TO authenticated, service_role;

-- ============================================================================
-- ANOMALY DETECTION FUNCTIONS (AI Control Plane - Intelligence Layer)
-- ============================================================================

-- Auto-create anomaly detection config when organization is created
CREATE OR REPLACE FUNCTION fn_create_anomaly_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO anomaly_detection_config (organization_id)
    VALUES (NEW.id)
    ON CONFLICT (organization_id) DO NOTHING;
    RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_create_anomaly_config() TO postgres, service_role;

-- ============================================================================
-- SECTION 5: TRIGGERS
-- ============================================================================

-- Profile Triggers
DROP TRIGGER IF EXISTS trigger_auto_generate_referral_code ON profiles;
CREATE TRIGGER trigger_auto_generate_referral_code
    BEFORE INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION fn_auto_generate_referral_code();

DROP TRIGGER IF EXISTS trigger_prevent_referral_abuse ON profiles;
CREATE TRIGGER trigger_prevent_referral_abuse
    BEFORE INSERT OR UPDATE OF referred_by ON profiles FOR EACH ROW EXECUTE FUNCTION fn_prevent_self_referral();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Subscription Triggers
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

DROP TRIGGER IF EXISTS update_subscription_usage_updated_at ON subscription_usage;
CREATE TRIGGER update_subscription_usage_updated_at
    BEFORE UPDATE ON subscription_usage FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

-- Prompt Rating Trigger
DROP TRIGGER IF EXISTS prompt_rating_stats_trigger ON prompt_ratings;
CREATE TRIGGER prompt_rating_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON prompt_ratings FOR EACH ROW EXECUTE FUNCTION update_prompt_rating_stats();

-- ============================================================================
-- ANOMALY DETECTION TRIGGERS
-- ============================================================================

-- Auto-create anomaly config when organization is created
DROP TRIGGER IF EXISTS trg_create_anomaly_config ON organizations;
CREATE TRIGGER trg_create_anomaly_config
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION fn_create_anomaly_config();

-- Updated At triggers for anomaly tables
DROP TRIGGER IF EXISTS trg_anomaly_alerts_updated_at ON anomaly_alerts;
CREATE TRIGGER trg_anomaly_alerts_updated_at
    BEFORE UPDATE ON anomaly_alerts FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

DROP TRIGGER IF EXISTS trg_anomaly_config_updated_at ON anomaly_detection_config;
CREATE TRIGGER trg_anomaly_config_updated_at
    BEFORE UPDATE ON anomaly_detection_config FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

-- ============================================================================
-- SECTION 6: RLS POLICIES
-- ============================================================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_service_all ON profiles;
DROP POLICY IF EXISTS select_own_profile ON profiles;
DROP POLICY IF EXISTS update_own_profile ON profiles;
CREATE POLICY profiles_select_own ON profiles FOR SELECT USING ((SELECT auth.uid()) = id);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING ((SELECT auth.uid()) = id);
CREATE POLICY profiles_service_all ON profiles FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_select_members ON organizations FOR SELECT USING (
    owner_user_id = (SELECT auth.uid()) OR id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
);
CREATE POLICY organizations_update_owner ON organizations FOR UPDATE USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY organizations_service_all ON organizations FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Organization Members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_own_memberships ON organization_members;
CREATE POLICY select_own_memberships ON organization_members FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY org_members_service_all ON organization_members FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_org_projects ON projects;
DROP POLICY IF EXISTS projects_select_service ON projects;
CREATE POLICY select_org_projects ON projects FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = (SELECT auth.uid())
    )
);
CREATE POLICY projects_select_service ON projects FOR SELECT USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY projects_insert_service ON projects FOR INSERT WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY projects_update_service ON projects FOR UPDATE USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY projects_delete_service ON projects FOR DELETE USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- API Keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_org_keys ON api_keys;
CREATE POLICY select_org_keys ON api_keys FOR SELECT USING (
    project_id IN (
        SELECT id FROM projects 
        WHERE organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = (SELECT auth.uid())
        )
    )
);
CREATE POLICY api_keys_insert_service ON api_keys FOR INSERT WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY api_keys_delete_service ON api_keys FOR DELETE USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Request Logs
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY request_logs_select_org ON request_logs FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
);
CREATE POLICY request_logs_select_service ON request_logs FOR SELECT USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY request_logs_insert_service ON request_logs FOR INSERT WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Providers
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY providers_select_org ON providers FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
);
CREATE POLICY providers_insert_service ON providers FOR INSERT WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY providers_update_service ON providers FOR UPDATE USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Audit Log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_select_org ON audit_log FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY audit_log_insert_service ON audit_log FOR INSERT WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_select_own ON subscriptions FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY subscriptions_service_all ON subscriptions FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Subscription Usage
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_usage_select_own ON subscription_usage FOR SELECT USING (
    subscription_id IN (
        SELECT id FROM subscriptions WHERE user_id = (SELECT auth.uid())
    )
);
CREATE POLICY subscription_usage_service_all ON subscription_usage FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Billing Audit Log
ALTER TABLE billing_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_audit_select_own ON billing_audit_log FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY billing_audit_service_all ON billing_audit_log FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Payment Methods
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_methods_select_own ON payment_methods FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY payment_methods_service_all ON payment_methods FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Email Logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_logs_select_own ON email_logs FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY email_logs_insert_service ON email_logs FOR INSERT TO authenticated WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY email_logs_update_service ON email_logs FOR UPDATE TO authenticated USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Team Invites
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_invites_select_org_owner ON team_invites FOR SELECT TO authenticated USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner')
);
CREATE POLICY team_invites_insert_org_owner ON team_invites FOR INSERT TO authenticated WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner')
);

-- SSO Audit Log
ALTER TABLE sso_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY sso_audit_select_org_admin ON sso_audit_log FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
-- The engine writes this log with the service role; no browser role may insert into it.
CREATE POLICY sso_audit_insert_system ON sso_audit_log FOR INSERT TO service_role WITH CHECK (true);

-- Cost Attribution
ALTER TABLE cost_attribution_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE chargeback_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE chargeback_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_attribution_tags_select_org ON cost_attribution_tags FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY cost_attribution_tags_service_all ON cost_attribution_tags FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- request_attribution policies (AUDIT FIX: was missing)
CREATE POLICY request_attribution_select_org ON request_attribution FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY request_attribution_service_all ON request_attribution FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- chargeback_rules policies (AUDIT FIX: was missing)
CREATE POLICY chargeback_rules_select_org ON chargeback_rules FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY chargeback_rules_service_all ON chargeback_rules FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- chargeback_invoices policies (AUDIT FIX: was missing)
CREATE POLICY chargeback_invoices_select_org ON chargeback_invoices FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY chargeback_invoices_service_all ON chargeback_invoices FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Add-Ons & Marketplace
ALTER TABLE organization_add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_recommendations ENABLE ROW LEVEL SECURITY;

-- organization_add_ons policies (AUDIT FIX: was missing)
CREATE POLICY org_add_ons_select_org ON organization_add_ons FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY org_add_ons_service_all ON organization_add_ons FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- cost_recommendations policies (AUDIT FIX: was missing)
CREATE POLICY cost_recommendations_select_org ON cost_recommendations FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY cost_recommendations_service_all ON cost_recommendations FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY prompts_select_all ON prompts FOR SELECT USING (TRUE);
-- Tiers with prompt submission: growth, business, enterprise (not 'professional')
CREATE POLICY prompts_insert_premium ON prompts FOR INSERT WITH CHECK (
    author_user_id = (SELECT auth.uid()) AND author_user_id IN (
        SELECT user_id FROM subscriptions WHERE status = 'active' AND plan_tier IN ('growth', 'business', 'enterprise')
    )
);
CREATE POLICY prompts_service_all ON prompts FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- prompt_ratings policies (AUDIT FIX: INSERT/UPDATE were missing)
CREATE POLICY prompt_ratings_select_all ON prompt_ratings FOR SELECT USING (TRUE);
CREATE POLICY prompt_ratings_insert_own ON prompt_ratings FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY prompt_ratings_update_own ON prompt_ratings FOR UPDATE USING (user_id = (SELECT auth.uid()));
CREATE POLICY prompt_ratings_delete_own ON prompt_ratings FOR DELETE USING (user_id = (SELECT auth.uid()));
CREATE POLICY prompt_ratings_service_all ON prompt_ratings FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Achievements
ALTER TABLE achievement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY achievement_types_select_all ON achievement_types FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY achievement_types_service_all ON achievement_types FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY user_achievements_select_own ON user_achievements FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_achievements_insert_service ON user_achievements FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY user_achievements_update_own ON user_achievements FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- AGENT SUPPORT RLS POLICIES (AI Control Plane)
-- ============================================================================

-- Agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY agents_select_org ON agents FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY agents_insert_org ON agents FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY agents_update_org ON agents FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY agents_delete_org ON agents FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner' AND status = 'active')
);
CREATE POLICY agents_service_all ON agents FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Agent Sessions
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_sessions_select_org ON agent_sessions FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY agent_sessions_insert_service ON agent_sessions FOR INSERT WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY agent_sessions_update_service ON agent_sessions FOR UPDATE USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY agent_sessions_service_all ON agent_sessions FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- MCP Servers
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_servers_select_org ON mcp_servers FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY mcp_servers_insert_org ON mcp_servers FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY mcp_servers_update_org ON mcp_servers FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY mcp_servers_delete_org ON mcp_servers FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner' AND status = 'active')
);
CREATE POLICY mcp_servers_service_all ON mcp_servers FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Tools
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY tools_select_public ON tools FOR SELECT USING (
    is_public = true OR 
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY tools_insert_org ON tools FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY tools_update_org ON tools FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY tools_delete_org ON tools FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner' AND status = 'active')
);
CREATE POLICY tools_service_all ON tools FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Tool Call Logs
ALTER TABLE tool_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tool_call_logs_select_org ON tool_call_logs FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY tool_call_logs_insert_service ON tool_call_logs FOR INSERT WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY tool_call_logs_service_all ON tool_call_logs FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Agent API Keys
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_api_keys_select_org ON agent_api_keys FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    ))
);
CREATE POLICY agent_api_keys_insert_org ON agent_api_keys FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active'
    ))
);
CREATE POLICY agent_api_keys_delete_org ON agent_api_keys FOR DELETE USING (
    agent_id IN (SELECT id FROM agents WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active'
    ))
);
CREATE POLICY agent_api_keys_service_all ON agent_api_keys FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Tool Approvals
ALTER TABLE tool_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tool_approvals_select_org ON tool_approvals FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY tool_approvals_insert_service ON tool_approvals FOR INSERT WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY tool_approvals_update_admin ON tool_approvals FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY tool_approvals_service_all ON tool_approvals FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON notifications FOR SELECT USING (
    user_id = (SELECT auth.uid()) OR 
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY notifications_insert_service ON notifications FOR INSERT WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY notifications_update_own ON notifications FOR UPDATE USING (user_id = (SELECT auth.uid()));
CREATE POLICY notifications_service_all ON notifications FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Organization Settings
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_settings_select_org ON organization_settings FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND status = 'active')
);
CREATE POLICY org_settings_manage_admin ON organization_settings FOR ALL USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin') AND status = 'active')
);
CREATE POLICY org_settings_service_all ON organization_settings FOR ALL USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- ============================================================================
-- ANOMALY DETECTION RLS POLICIES (AI Control Plane - Intelligence Layer)
-- ============================================================================

-- Anomaly Alerts: Read by org members, manage by admins/owners
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY anomaly_alerts_select_org ON anomaly_alerts FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
);

CREATE POLICY anomaly_alerts_update_admin ON anomaly_alerts FOR UPDATE USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active' AND role IN ('owner', 'admin')
    )
);

CREATE POLICY anomaly_alerts_insert_service ON anomaly_alerts FOR INSERT 
    WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY anomaly_alerts_service_all ON anomaly_alerts FOR ALL 
    USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Anomaly Detection Config: Read by org members, manage by admins/owners
ALTER TABLE anomaly_detection_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY anomaly_config_select_org ON anomaly_detection_config FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
);

CREATE POLICY anomaly_config_update_admin ON anomaly_detection_config FOR UPDATE USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active' AND role IN ('owner', 'admin')
    )
);

CREATE POLICY anomaly_config_insert_service ON anomaly_detection_config FOR INSERT 
    WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY anomaly_config_service_all ON anomaly_detection_config FOR ALL 
    USING ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- Schema Migrations (Internal)
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY schema_migrations_service_read ON schema_migrations FOR SELECT TO service_role USING (true);

-- ============================================================================
-- SECTION 7: SEED DATA
-- ============================================================================

INSERT INTO achievement_types (id, name, description, icon, rarity, points) VALUES
('first_request', 'First Blood', 'Complete your first API request through Oxy Engine', 'trophy', 'common', 10),
('first_saved_dollar', 'Penny Pincher', 'Save your first dollar with budget controls', 'dollar-sign', 'common', 15),
('cost_warrior', 'Cost Warrior', 'Save $100 total with Oxy Engine', 'shield', 'rare', 50),
('speed_demon', 'Speed Demon', 'Make 1,000 requests in a single day', 'zap', 'rare', 75),
('vault_master', 'Vault Master', 'Enable encryption for all provider keys', 'lock', 'epic', 100),
('budget_master', 'Budget Master', 'Prevent an overspend incident with budget limits', 'alert-triangle', 'epic', 150),
('viral_champion', 'Viral Champion', 'Refer 5 friends who complete their first request', 'gift', 'legendary', 500)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 8: SECURITY GRANTS (AGGRESSIVE & FINAL)
-- ============================================================================

-- 1. Schema Usage
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA analytics TO authenticated, service_role;

-- 2. Table Grants (Explicit for Critical Tables)
GRANT ALL ON TABLE profiles TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE organizations TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE organization_members TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE projects TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE api_keys TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE providers TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE request_logs TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE subscriptions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE subscription_usage TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE audit_log TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE billing_audit_log TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE payment_methods TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE email_logs TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE team_invites TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE sso_audit_log TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE cost_attribution_tags TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE request_attribution TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE chargeback_rules TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE chargeback_invoices TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE organization_add_ons TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE prompts TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE prompt_ratings TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE cost_recommendations TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE achievement_types TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE user_achievements TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE schema_migrations TO postgres, anon, authenticated, service_role;

-- Agent Support Tables (AI Control Plane)
GRANT ALL ON TABLE agents TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE agent_sessions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE mcp_servers TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE tools TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE tool_call_logs TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE agent_api_keys TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE tool_approvals TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE notifications TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE organization_settings TO postgres, anon, authenticated, service_role;

-- Anomaly Detection Tables (AI Control Plane - Intelligence Layer)
GRANT ALL ON TABLE anomaly_alerts TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE anomaly_detection_config TO postgres, anon, authenticated, service_role;

-- 3. Catch-All for Any Missed Tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 4. Function Grants (Explicit)
-- Functions in public are called by the engine as service_role only. Many are
-- SECURITY DEFINER and trust their arguments (user, org, session ids), so the
-- browser roles must not reach them through PostgREST's /rest/v1/rpc. No RLS
-- policy or view calls them.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- 4b. Tables that had no row-level security. Only the engine (service_role,
-- which bypasses RLS) uses them; without policies the browser roles see nothing.
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- 5. Future Defaults (Prevents regression on new tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO postgres, service_role;

-- 6. Analytics Schema Access
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO authenticated, service_role;

-- 7. Schema Version Marker
INSERT INTO schema_migrations (version, description) 
VALUES (100, 'Consolidated schema.sql - Single Source of Truth') 
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description) 
VALUES (101, 'AUDIT FIX: FK ON DELETE, missing indexes, RLS policies, cleanup') 
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description) 
VALUES (102, 'Agent Support: agents, sessions, tools, MCP servers, kill switch') 
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description) 
VALUES (103, 'Tool Approvals: approval workflow, notifications, org settings') 
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description) 
VALUES (104, 'Anomaly Detection: alerts, config, thresholds, triggers') 
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description) 
VALUES (105, 'Real-time Subscriptions: achievements, alerts, agents, notifications') 
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description) 
VALUES (106, 'Plan tier update: professional → growth/business, pricing sync (Dec 2025)') 
ON CONFLICT (version) DO NOTHING;

-- 8. Column Documentation (AUDIT FIX: Clarity)
COMMENT ON COLUMN subscriptions.amount IS 'Subscription amount in cents (e.g., 4200 = 42.00 USD), as reported by Stripe';
COMMENT ON COLUMN prompts.price_usd IS 'Prompt price in cents (e.g., 100 = $1.00)';
COMMENT ON COLUMN billing_audit_log.amount_cents IS 'Transaction amount in cents';

-- 9. CRITICAL: Reload PostgREST Schema Cache
-- Without this, API returns "Function not found" or 403 after schema reset
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- SECTION 9: REAL-TIME SUBSCRIPTIONS (Supabase)
-- ============================================================================
-- IMPORTANT: Run this AFTER the main schema in Supabase SQL Editor
-- This enables instant updates for dashboards and celebrations
-- 
-- WHY THIS MATTERS:
-- Without real-time, the frontend must poll every 10 seconds.
-- With real-time, changes appear INSTANTLY (<100ms).
-- 
-- RESULT: 
-- - First Request Ceremony triggers immediately 🎉
-- - Anomaly alerts appear instantly 🚨
-- - Agent status updates in real-time ⚡
-- ============================================================================

-- Enable real-time for celebration
ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;

-- Enable real-time for alerts & notifications
ALTER PUBLICATION supabase_realtime ADD TABLE anomaly_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable real-time for agent status (kill switch, status changes)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_sessions;

-- ============================================================================
-- VERIFY REAL-TIME (run in SQL Editor to confirm):
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Expected: user_achievements, anomaly_alerts, notifications, agent_sessions
-- ============================================================================

-- No seed data. Earlier versions seeded a user, an organization, a project and
-- an API key whose credentials were written in this file, so every database
-- built from it had a login and a key anyone could read. Sign up and onboard
-- instead; scripts/stack_smoke.sh shows the API calls.

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

