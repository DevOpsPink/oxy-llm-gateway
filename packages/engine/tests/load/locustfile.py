"""
Locust Load Testing Configuration
===================================
Tests Oxy Engine's ability to handle high traffic

Usage:
    locust -f locustfile.py --host http://localhost:8000

Web UI:
    http://localhost:8089

Command Line:
    locust -f locustfile.py --host http://localhost:8000 --users 1000 --spawn-rate 100 --run-time 5m --headless

Performance Targets:
    - 10,000 requests/second sustained
    - < 100ms p95 latency
    - < 0.1% error rate
"""

import json
import time
import os
from locust import HttpUser, task, between, events
from locust.exception import StopUser

# Test configuration
TEST_API_KEY = os.getenv("TEST_OXY_API_KEY", "oxy_sk_test_placeholder")
TEST_PROJECT_JWT = os.getenv("TEST_PROJECT_JWT", "eyJhbGciOi...")


class OxyEngineUser(HttpUser):
    """
    Simulates a real user making API calls through Oxy Engine.
    
    Behavior:
    - 90% chat completion requests (main use case)
    - 5% status checks
    - 5% key management operations
    """
    
    wait_time = between(1, 3)  # Wait 1-3 seconds between requests
    
    def on_start(self):
        """Initialize user session."""
        self.api_key = TEST_API_KEY
        self.jwt_token = TEST_PROJECT_JWT
        self.request_count = 0
    
    @task(90)
    def chat_completion(self):
        """
        Main API call - Chat Completion
        
        Weight: 90 (most common operation)
        Expected latency: < 50ms (Oxy overhead only, not LLM response time)
        """
        self.request_count += 1
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "user", "content": f"Test request #{self.request_count}"}
            ],
            "max_tokens": 10  # Keep it short for load testing
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        with self.client.post(
            "/v1/chat/completions",
            json=payload,
            headers=headers,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "choices" in data:
                        response.success()
                    else:
                        response.failure("Invalid response format")
                except json.JSONDecodeError:
                    response.failure("Invalid JSON response")
            elif response.status_code == 429:
                response.failure("Budget exceeded")
            else:
                response.failure(f"HTTP {response.status_code}")
    
    @task(5)
    def check_status(self):
        """
        Check project status
        
        Weight: 5 (occasional status checks)
        Expected latency: < 20ms
        """
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
        }
        
        with self.client.get(
            "/management/status",
            headers=headers,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"HTTP {response.status_code}")
    
    @task(3)
    def list_api_keys(self):
        """
        List API keys
        
        Weight: 3 (rare operation)
        Expected latency: < 30ms
        """
        if not self.jwt_token or self.jwt_token == "eyJhbGciOi...":
            # Skip if no valid JWT
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
        }
        
        with self.client.get(
            "/management/keys?projectId=test-project-id",
            headers=headers,
            catch_response=True
        ) as response:
            if response.status_code in [200, 403]:  # 403 is ok (no permission)
                response.success()
            else:
                response.failure(f"HTTP {response.status_code}")
    
    @task(2)
    def get_stats(self):
        """
        Get project statistics
        
        Weight: 2 (rare operation)
        Expected latency: < 50ms
        """
        if not self.jwt_token or self.jwt_token == "eyJhbGciOi...":
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
        }
        
        with self.client.get(
            "/management/stats?projectId=test-project-id",
            headers=headers,
            catch_response=True
        ) as response:
            if response.status_code in [200, 403]:
                response.success()
            else:
                response.failure(f"HTTP {response.status_code}")


class BurstTrafficUser(HttpUser):
    """
    Simulates burst traffic patterns (e.g., cron jobs, batch processing).
    
    Behavior:
    - No wait time between requests
    - Hammers the API as fast as possible
    - Tests rate limiting and circuit breakers
    """
    
    wait_time = between(0.1, 0.5)  # Very short wait (burst pattern)
    
    def on_start(self):
        self.api_key = TEST_API_KEY
        self.request_count = 0
    
    @task
    def rapid_fire_requests(self):
        """Send requests as fast as possible."""
        self.request_count += 1
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "burst"}],
            "max_tokens": 5
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        with self.client.post(
            "/v1/chat/completions",
            json=payload,
            headers=headers,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 429:
                # Rate limited - expected behavior
                response.success()
                # Stop this user after hitting rate limit (prevent spam)
                if self.request_count > 100:
                    raise StopUser()
            else:
                response.failure(f"HTTP {response.status_code}")


# Event hooks for metrics collection

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Print test start message."""
    print("\n" + "="*80)
    print("🚀 Oxy Engine Load Test Starting")
    print("="*80)
    print(f"Target: {environment.host}")
    print(f"Users: {environment.runner.target_user_count if hasattr(environment.runner, 'target_user_count') else 'N/A'}")
    print("="*80 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Print test completion summary."""
    print("\n" + "="*80)
    print("✅ Oxy Engine Load Test Complete")
    print("="*80)
    
    stats = environment.stats
    print(f"Total Requests: {stats.total.num_requests}")
    print(f"Total Failures: {stats.total.num_failures}")
    print(f"Failure Rate: {stats.total.fail_ratio * 100:.2f}%")
    print(f"Average Response Time: {stats.total.avg_response_time:.2f}ms")
    print(f"Max Response Time: {stats.total.max_response_time:.2f}ms")
    print(f"Requests/sec: {stats.total.current_rps:.2f}")
    print("="*80 + "\n")
    
    # Performance assertions
    if stats.total.fail_ratio > 0.01:  # > 1% failure rate
        print("⚠️  WARNING: Failure rate exceeds 1%")
    
    if stats.total.avg_response_time > 100:  # > 100ms average
        print("⚠️  WARNING: Average response time exceeds 100ms")
    
    if stats.total.current_rps < 100:  # < 100 req/sec
        print("⚠️  WARNING: Throughput below 100 requests/second")

