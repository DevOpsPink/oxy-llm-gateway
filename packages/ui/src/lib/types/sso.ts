/**
 * SSO/SAML TYPE DEFINITIONS
 * 
 * CRITICAL: Synchronized with Backend Pydantic models
 * Backend: packages/engine/routes/sso.py
 * 
 * Keep these types in sync with the Pydantic schemas
 */

// ============================================================================
// REQUEST TYPES (Frontend → Backend)
// ============================================================================

/**
 * SSO domain lookup request
 * Checks if an email domain has SSO configured
 * 
 * Backend: SSODomainLookupRequest (line 41-43)
 */
export interface SSODomainLookupRequest {
  email: string; // ✅ Validated as EmailStr on backend
}

/**
 * SSO configuration request
 * Configures SSO/SAML for an organization
 * 
 * Backend: SSOConfigureRequest (line 59-64)
 */
export interface SSOConfigureRequest {
  domain: string; // Organization's email domain (e.g., "company.com")
  identity_provider: 'okta' | 'google' | 'azure' | 'onelogin' | 'auth0';
  saml_metadata_url?: string; // Optional: URL to IdP metadata XML
}

/**
 * SSO callback request
 * Handles OAuth redirect after successful SSO login
 * 
 * Backend: SSOCallbackRequest (line 78-80)
 */
export interface SSOCallbackRequest {
  code: string; // OAuth authorization code from Supabase
}

// ============================================================================
// RESPONSE TYPES (Backend → Frontend)
// ============================================================================

/**
 * SSO domain lookup response
 * Returns SSO availability status for a domain
 * 
 * Backend: SSODomainLookupResponse (line 50-55)
 */
export interface SSODomainLookupResponse {
  sso_available: boolean; // True if domain has SSO configured
  identity_provider?: 'okta' | 'google' | 'azure' | 'onelogin' | 'auth0';
  organization_name?: string; // Organization name if SSO enabled
}

/**
 * SSO configuration response
 * Confirms SSO has been configured successfully
 * 
 * Backend: SSOConfigureResponse (line 69-73)
 */
export interface SSOConfigureResponse {
  success: boolean;
  message: string;
  metadata_url?: string; // URL to download SP metadata for IdP configuration
}

/**
 * SSO login URL response
 * Provides the URL to redirect user to for SSO login
 * 
 * Backend: Constructed in /sso/login endpoint
 */
export interface SSOLoginURLResponse {
  login_url: string; // Supabase OAuth URL for SSO login
  state: string; // CSRF protection token
}

// ============================================================================
// DOMAIN TYPES (Database Models)
// ============================================================================

/**
 * SSO configuration database record
 * Stored in 'sso_configurations' table
 */
export interface SSOConfiguration {
  id: string;
  organization_id: string;
  domain: string;
  identity_provider: 'okta' | 'google' | 'azure' | 'onelogin' | 'auth0';
  saml_metadata_url?: string;
  is_active: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

// ============================================================================
// FORM TYPES (UI State Management)
// ============================================================================

/**
 * SSO configuration form state
 * Used in Settings → SSO panel
 */
export interface SSOConfigFormState {
  domain: string;
  identity_provider: '' | 'okta' | 'google' | 'azure' | 'onelogin' | 'auth0';
  saml_metadata_url: string;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * SSO login form state
 * Used on Login page for enterprise SSO login
 */
export interface SSOLoginFormState {
  email: string;
  isCheckingSSO: boolean;
  ssoAvailable: boolean;
  identityProvider?: 'okta' | 'google' | 'azure' | 'onelogin' | 'auth0';
  organizationName?: string;
  error: string | null;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Supported identity providers
 * Matches backend SSO_PROVIDERS enum
 */
export const SSO_PROVIDERS = {
  okta: 'Okta',
  google: 'Google Workspace',
  azure: 'Microsoft Azure AD',
  onelogin: 'OneLogin',
  auth0: 'Auth0',
} as const;

export type SSOProvider = keyof typeof SSO_PROVIDERS;

/**
 * SSO provider metadata (for UI display)
 */
export interface SSOProviderMetadata {
  id: SSOProvider;
  name: string;
  logo: string; // Path to provider logo
  setupGuideUrl: string; // Link to setup documentation
  requiresMetadataUrl: boolean; // Does this provider require SAML metadata URL?
}

export const SSO_PROVIDER_METADATA: Record<SSOProvider, SSOProviderMetadata> = {
  okta: {
    id: 'okta',
    name: 'Okta',
    logo: '/logos/okta.svg',
    setupGuideUrl: 'https://developer.okta.com/docs/guides/saml-application-setup/',
    requiresMetadataUrl: true,
  },
  google: {
    id: 'google',
    name: 'Google Workspace',
    logo: '/logos/google.svg',
    setupGuideUrl: 'https://support.google.com/a/answer/6087519',
    requiresMetadataUrl: false, // Uses OAuth instead of SAML
  },
  azure: {
    id: 'azure',
    name: 'Microsoft Azure AD',
    logo: '/logos/azure.svg',
    setupGuideUrl: 'https://docs.microsoft.com/en-us/azure/active-directory/saas-apps/tutorial-list',
    requiresMetadataUrl: true,
  },
  onelogin: {
    id: 'onelogin',
    name: 'OneLogin',
    logo: '/logos/onelogin.svg',
    setupGuideUrl: 'https://onelogin.service-now.com/support',
    requiresMetadataUrl: true,
  },
  auth0: {
    id: 'auth0',
    name: 'Auth0',
    logo: '/logos/auth0.svg',
    setupGuideUrl: 'https://auth0.com/docs/authenticate/protocols/saml',
    requiresMetadataUrl: true,
  },
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate email domain
 * Extracts domain from email and checks format
 */
export function extractEmailDomain(email: string): string | null {
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1] : null;
}

/**
 * Validate SAML metadata URL
 * Checks if URL is valid and accessible
 */
export function isValidMetadataUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Check whether SSO is unavailable for a plan tier.
 * Returns true if the tier doesn't include SSO (only "enterprise" does,
 * matching can_configure_sso in packages/engine/routes/sso.py).
 */
export function isSSOEnterprise(planTier: string): boolean {
  return planTier !== 'enterprise';
}

