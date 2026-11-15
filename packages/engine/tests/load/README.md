# Load testing suite

## Overview

This directory contains comprehensive load testing tools for Oxy Engine, designed to verify performance at scale.

**Target Metrics:**
- **Throughput:** 1,000+ req/sec
- **95th Percentile Latency:** < 500ms
- **Error Rate:** < 0.1%
- **Concurrent Users:** 1,000+

## Quick Start

### 1. Install Dependencies

```bash
cd packages/engine
pip install locust
```

### 2. Set Environment Variables

```bash
# Required: Test API key (from test user account)
export TEST_API_KEY="oxy_live_test_your_key_here"

# Required: Test JWT token (from Supabase auth)
export TEST_JWT_TOKEN="your_jwt_token_here"
```

### 3. Run Load Test (Headless)

```bash
# Target: 100 users, 10 req/sec spawn rate, 10 min duration
locust -f tests/load/locustfile.py \
       --host=http://localhost:8000 \
       --users 100 \
       --spawn-rate 10 \
       --run-time 10m \
       --headless \
       --csv=results/load_test

# Results will be saved to:
# - results/load_test_stats.csv (request stats)
# - results/load_test_stats_history.csv (time series)
# - results/load_test_failures.csv (errors)
```

### 4. Run Load Test (Web UI)

```bash
# Start Locust web UI
locust -f tests/load/locustfile.py --host=http://localhost:8000

# Open browser: http://localhost:8089
# Configure: 100 users, 10 spawn rate
# Click "Start Swarming"
```

## Test Scenarios

### Scenario 1: Normal Load (Baseline)
- **Users:** 100
- **Spawn Rate:** 10/sec
- **Duration:** 10 minutes
- **Expected:** < 0.1% errors, < 200ms p95 latency

```bash
locust -f tests/load/locustfile.py \
       --host=http://localhost:8000 \
       --users 100 \
       --spawn-rate 10 \
       --run-time 10m \
       --headless
```

### Scenario 2: High Load (Stress Test)
- **Users:** 500
- **Spawn Rate:** 50/sec
- **Duration:** 20 minutes
- **Expected:** < 1% errors, < 500ms p95 latency

```bash
locust -f tests/load/locustfile.py \
       --host=http://localhost:8000 \
       --users 500 \
       --spawn-rate 50 \
       --run-time 20m \
       --headless
```

### Scenario 3: Spike Test (Circuit Breaker)
- **Users:** 1,000
- **Spawn Rate:** 100/sec
- **Duration:** 5 minutes
- **Expected:** Circuit breaker activates, graceful degradation

```bash
locust -f tests/load/locustfile.py \
       --host=http://localhost:8000 \
       --users 1000 \
       --spawn-rate 100 \
       --run-time 5m \
       --headless
```

### Scenario 4: Endurance Test (Memory Leaks)
- **Users:** 200
- **Spawn Rate:** 20/sec
- **Duration:** 2 hours
- **Expected:** Stable memory usage, no degradation

```bash
locust -f tests/load/locustfile.py \
       --host=http://localhost:8000 \
       --users 200 \
       --spawn-rate 20 \
       --run-time 2h \
       --headless
```

## Task Distribution

The load test simulates realistic user behavior with weighted tasks:

| Endpoint | Weight | Description |
|----------|--------|-------------|
| `POST /v1/chat/completions` | 80% | AI proxy (primary use case) |
| `GET /management/projects` | 10% | Fetch projects |
| `GET /management/keys` | 5% | Fetch API keys |
| `GET /health` | 3% | Health checks |
| `GET /billing/subscription-status` | 2% | Subscription status |

## Interpreting Results

### Success criteria

| Metric | Target | Pass/Fail |
|--------|--------|-----------|
| **Error Rate** | < 0.1% | ✅ Pass |
| **Error Rate** | 0.1% - 1% | ⚠️ Acceptable (investigate) |
| **Error Rate** | > 1% | ❌ Failed (fix required) |
| **P95 Latency** | < 200ms | ✅ Excellent |
| **P95 Latency** | 200-500ms | ⚠️ Acceptable |
| **P95 Latency** | > 500ms | ❌ Failed (optimize) |
| **Throughput** | > 1,000 req/sec | ✅ Scale target met |
| **Throughput** | 500-1,000 req/sec | ⚠️ Scale target partial |
| **Throughput** | < 500 req/sec | ❌ Scale target missed |

### Common Issues

#### High Error Rate (> 1%)
- **429 Budget Exceeded:** Increase test user budget or use unlimited budget for testing
- **401 Unauthorized:** Verify TEST_API_KEY and TEST_JWT_TOKEN are valid
- **503 Service Unavailable:** Circuit breaker activated (expected under extreme load)

#### High Latency (> 500ms p95)
- **Database Slow Queries:** Check PostgreSQL query performance with EXPLAIN ANALYZE
- **Redis Latency:** Verify Redis is not overloaded (check `redis-cli --latency`)
- **Provider Latency:** OpenAI/Anthropic API may be slow (check their status pages)
- **Connection Pool Exhaustion:** Increase HTTPX max_connections (default: 100)

#### Memory Leaks
- **Gradual Memory Increase:** Monitor with `docker stats` during endurance test
- **Check:** Are HTTP connections being closed? (HTTPX should handle this)
- **Check:** Are Redis connections being returned to pool?

## Advanced Usage

### Distributed Load Testing

Run Locust in master-worker mode for higher load:

```bash
# Terminal 1: Start master
locust -f tests/load/locustfile.py --master --host=http://localhost:8000

# Terminal 2-4: Start workers
locust -f tests/load/locustfile.py --worker --master-host=localhost
locust -f tests/load/locustfile.py --worker --master-host=localhost
locust -f tests/load/locustfile.py --worker --master-host=localhost
```

### Custom Metrics

Add custom metrics to `locustfile.py`:

```python
from locust import events

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    if exception:
        print(f"Request failed: {name} - {exception}")
```

## Integration with CI/CD

Add to GitHub Actions:

```yaml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: pip install locust
      - name: Run load test
        env:
          TEST_API_KEY: ${{ secrets.TEST_API_KEY }}
          TEST_JWT_TOKEN: ${{ secrets.TEST_JWT_TOKEN }}
        run: |
          locust -f packages/engine/tests/load/locustfile.py \
                 --host=${{ secrets.STAGING_URL }} \
                 --users 100 \
                 --spawn-rate 10 \
                 --run-time 5m \
                 --headless \
                 --csv=results/load_test
      - name: Check results
        run: |
          # Parse CSV and fail if error rate > 1%
          python scripts/check_load_test_results.py results/load_test_stats.csv
```

## Monitoring During Load Tests

### Prometheus Metrics

Monitor these metrics during load tests:

```
# Request rate
rate(oxy_requests_total[1m])

# Latency (95th percentile)
histogram_quantile(0.95, rate(oxy_request_duration_seconds_bucket[5m]))

# Error rate
rate(oxy_requests_total{status=~"5.."}[1m]) / rate(oxy_requests_total[1m])

# Budget operations
rate(oxy_budget_exceeded_total[1m])
```

### Grafana Dashboard

Import the provided Grafana dashboard:

```bash
# Dashboard is at grafana/provisioning/dashboards/oxy-business-metrics.json
# Auto-loaded when using docker-compose
```

## Troubleshooting

### Locust Won't Start
```bash
# Check Python version (requires 3.8+)
python --version

# Reinstall Locust
pip uninstall locust
pip install locust
```

### "Connection Refused" Errors
```bash
# Verify Oxy Engine is running
curl http://localhost:8000/health

# Check Docker logs
docker logs oxy-engine
```

### "Too Many Open Files" Error
```bash
# Increase file descriptor limit (macOS/Linux)
ulimit -n 10000
```

---

**Tribunal Verdict:** Load testing is essential for production readiness. Run these tests before every major release.


