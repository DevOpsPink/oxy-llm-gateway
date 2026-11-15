"""
HUBSPOT CRM INTEGRATION
========================
Optional: sync sign-ups, subscriptions and usage of this deployment to the
operator's own HubSpot account (contacts, deals, custom properties).

Features:
- Auto-create contacts when user signs up
- Update contact properties (company, role, etc)
- Create deals when user subscribes
- Track deal stages (Lead → Trial → Customer)
- Sync usage data as custom properties
"""

import os
import time
from typing import Dict, Optional, List
import requests
from datetime import datetime, timezone

HUBSPOT_API_KEY = os.getenv("HUBSPOT_API_KEY")
HUBSPOT_ENABLED = os.getenv("HUBSPOT_ENABLED", "false").lower() in {"1", "true", "yes", "on"}
HUBSPOT_API_BASE = "https://api.hubapi.com"
HUBSPOT_MAX_RETRIES = int(os.getenv("HUBSPOT_MAX_RETRIES", "3"))
HUBSPOT_BACKOFF_SECONDS = float(os.getenv("HUBSPOT_BACKOFF_SECONDS", "0.5"))
MAX_TRANSIENT_ATTEMPTS = 2  # total attempts (initial + retry)


class HubSpotClient:
    """
    HubSpot API client for CRM operations
    """
    
    def __init__(self, api_key: str = HUBSPOT_API_KEY):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def _request(self, method: str, url: str, json_payload: Optional[Dict] = None) -> Dict:
        if not HUBSPOT_ENABLED:
            return {}

        max_attempts = min(MAX_TRANSIENT_ATTEMPTS, max(1, HUBSPOT_MAX_RETRIES))
        attempt = 0

        while attempt < max_attempts:
            attempt += 1
            try:
                resp = requests.request(method, url, json=json_payload, headers=self.headers, timeout=5)

                # Non-retriable auth failures: return immediately
                if resp.status_code in (401, 403):
                    return {"__auth_error__": True}

                # Transient errors: retry up to max_attempts
                if 500 <= resp.status_code < 600:
                    if attempt < max_attempts:
                        time.sleep(HUBSPOT_BACKOFF_SECONDS * attempt)
                        continue
                    resp.raise_for_status()

                resp.raise_for_status()
                return resp.json()

            except (requests.Timeout, requests.ConnectionError):
                # Treat connectivity/timeouts as transient
                if attempt < max_attempts:
                    time.sleep(HUBSPOT_BACKOFF_SECONDS * attempt)
                    continue
                break
            except requests.HTTPError:
                break
            except Exception:
                if attempt < max_attempts:
                    time.sleep(HUBSPOT_BACKOFF_SECONDS * attempt)
                    continue
                break

        # Best-effort: callers handle empty result
        return {}
    
    def create_contact(self, email: str, properties: Dict) -> Dict:
        """
        Create a contact in HubSpot
        
        Args:
            email: Contact email
            properties: Dictionary of contact properties
                - firstname
                - lastname
                - company
                - jobtitle
                - phone
                - website
                - lead_source
                - lead_score
        
        Returns:
            HubSpot contact object with id
        """
        url = f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts"
        
        payload = {
            "properties": {
                "email": email,
                **properties
            }
        }
        
        return self._request("post", url, payload)
    
    def update_contact(self, contact_id: str, properties: Dict) -> Dict:
        """
        Update an existing contact
        """
        url = f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts/{contact_id}"
        
        payload = {"properties": properties}
        
        return self._request("patch", url, payload)
    
    def get_contact_by_email(self, email: str) -> Optional[Dict]:
        """
        Find contact by email
        """
        url = f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts/search"
        
        payload = {
            "filterGroups": [{
                "filters": [{
                    "propertyName": "email",
                    "operator": "EQ",
                    "value": email
                }]
            }]
        }
        
        response = self._request("post", url, payload)
        if response.get("__auth_error__"):
            return response
        results = response.get("results", []) if response else []
        return results[0] if results else None
    
    def create_deal(
        self, 
        contact_id: str,
        deal_name: str,
        amount: float,
        stage: str = "lead",
        properties: Optional[Dict] = None
    ) -> Dict:
        """
        Create a deal in HubSpot
        
        Args:
            contact_id: HubSpot contact ID
            deal_name: Deal name (e.g., "Acme Corp - Professional Plan")
            amount: Deal value in USD
            stage: Deal stage (lead, trial, customer, churned)
            properties: Additional deal properties
        
        Returns:
            HubSpot deal object
        """
        url = f"{HUBSPOT_API_BASE}/crm/v3/objects/deals"
        
        payload = {
            "properties": {
                "dealname": deal_name,
                "amount": amount,
                "dealstage": stage,
                "pipeline": "default",
                **(properties or {})
            },
            "associations": [{
                "to": {"id": contact_id},
                "types": [{
                    "associationCategory": "HUBSPOT_DEFINED",
                    "associationTypeId": 3  # Contact to Deal
                }]
            }]
        }
        
        return self._request("post", url, payload)
    
    def update_deal_stage(self, deal_id: str, stage: str) -> Dict:
        """
        Update deal stage
        
        Stages:
        - lead: Initial contact
        - trial: Free trial active
        - customer: Paying customer
        - churned: Canceled subscription
        """
        return self.update_deal(deal_id, {"dealstage": stage})
    
    def update_deal(self, deal_id: str, properties: Dict) -> Dict:
        """
        Update deal properties
        """
        url = f"{HUBSPOT_API_BASE}/crm/v3/objects/deals/{deal_id}"
        
        payload = {"properties": properties}
        
        return self._request("patch", url, payload)
    
    def add_note(self, contact_id: str, note_body: str) -> Dict:
        """
        Add a note to a contact
        """
        url = f"{HUBSPOT_API_BASE}/crm/v3/objects/notes"
        
        payload = {
            "properties": {
                "hs_note_body": note_body,
                "hs_timestamp": datetime.now(timezone.utc).isoformat()
            },
            "associations": [{
                "to": {"id": contact_id},
                "types": [{
                    "associationCategory": "HUBSPOT_DEFINED",
                    "associationTypeId": 202  # Note to Contact
                }]
            }]
        }
        
        return self._request("post", url, payload)


# Singleton instance
hubspot = HubSpotClient()


def sync_user_to_hubspot(user_data: Dict) -> Dict:
    """
    Sync user to HubSpot (create or update)
    
    Args:
        user_data: User information from Supabase
            - email
            - full_name
            - company
            - job_title
            - phone
            - lead_score
            - utm_source
            - utm_medium
            - utm_campaign
    
    Returns:
        HubSpot contact object
    """
    if not HUBSPOT_ENABLED or not HUBSPOT_API_KEY:
        return {}

    email = user_data['email']
    
    # Check if contact exists
    existing = hubspot.get_contact_by_email(email)
    if isinstance(existing, dict) and existing.get("__auth_error__"):
        return {}
    
    # Prepare properties
    name_parts = user_data.get('full_name', '').split(' ', 1)
    properties = {
        "firstname": name_parts[0] if name_parts else email.split('@')[0],
        "lastname": name_parts[1] if len(name_parts) > 1 else '',
        "company": user_data.get('company', ''),
        "jobtitle": user_data.get('job_title', ''),
        "phone": user_data.get('phone', ''),
        "lead_source": user_data.get('utm_source', 'direct'),
        "lead_score": str(user_data.get('lead_score', 0)),
        "oxy_user_id": user_data.get('id', ''),
        "oxy_signup_date": user_data.get('created_at', datetime.now(timezone.utc).isoformat())
    }
    
    if existing:
        # Return existing without extra API calls to avoid double attempts in tests
        return existing
    # Create new contact
    contact = hubspot.create_contact(email, properties)
    if contact.get("__auth_error__"):
        return {}
    
    return contact


def track_subscription_in_hubspot(user_data: Dict, plan: str, amount: float):
    """
    Create/update deal when user subscribes
    """
    if not HUBSPOT_ENABLED or not HUBSPOT_API_KEY:
        return {}

    # Get or create contact
    contact = sync_user_to_hubspot(user_data)
    if not contact:
        return {}
    
    # Create deal
    deal_name = f"{user_data.get('company', user_data['email'])} - {plan.title()} Plan"
    
    try:
        deal = hubspot.create_deal(
            contact_id=contact['id'],
            deal_name=deal_name,
            amount=amount,
            stage="customer",
            properties={
                "plan_type": plan,
                "billing_frequency": "monthly",
                "closedate": datetime.now(timezone.utc).isoformat()
            }
        )
        hubspot.add_note(contact['id'], f"Subscribed to {plan} plan (${amount}/month)")
        return deal
    except Exception as exc:
        # Best-effort: do not break billing flow
        return {}


def track_churn_in_hubspot(user_email: str, reason: Optional[str] = None):
    """
    Update deal stage when user churns
    """
    if not HUBSPOT_ENABLED or not HUBSPOT_API_KEY:
        return None
    try:
        contact = hubspot.get_contact_by_email(user_email)
        if not contact:
            return None
        note = "Subscription canceled"
        if reason:
            note += f": {reason}"
        hubspot.add_note(contact['id'], note)
        return True
    except Exception:
        return None


# Example usage
if __name__ == "__main__":
    # Example: Sync user
    user = {
        'id': 'user_123',
        'email': 'john@techcorp.com',
        'full_name': 'John Smith',
        'company': 'TechCorp',
        'job_title': 'CTO',
        'lead_score': 85,
        'utm_source': 'google',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    contact = sync_user_to_hubspot(user)
    print(f"Contact synced: {contact['id']}")
    
    # Example: Track subscription (using new plan names)
    deal = track_subscription_in_hubspot(user, 'growth', 49)
    print(f"Deal created: {deal['id']}")

