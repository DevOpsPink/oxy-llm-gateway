#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   End-to-end simulation: happy path, IDOR, race, free tier, DLP              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import os
import sys
import asyncio
import time
import json
import random
import string
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum
import httpx
from dotenv import load_dotenv

# --- CONFIGURATION ---
BASE_DIR = Path(__file__).resolve().parent.parent
ENGINE_ENV_PATH = BASE_DIR / "packages" / "engine" / ".env"

if ENGINE_ENV_PATH.exists(): load_dotenv(dotenv_path=ENGINE_ENV_PATH)

API_URL = os.getenv("API_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    print(f"❌ CRITICAL: Missing keys.")
    sys.exit(1)

RUN_ID = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))

class ScenarioStatus(Enum):
    PASS = "PASS"; FAIL = "FAIL"; SKIP = "SKIP"; ERROR = "ERROR"

@dataclass
class ScenarioResult:
    name: str; status: ScenarioStatus; duration_ms: float; details: str = ""; errors: list = field(default_factory=list)

def fake_ip(): 
    return f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(0,255)}"

class OxyClient:
    def __init__(self):
        self.http = httpx.AsyncClient(base_url=API_URL, timeout=30.0)
        self.sb = httpx.AsyncClient(base_url=SUPABASE_URL, timeout=30.0)
        self.csrf_token = None

    async def close(self): 
        await self.http.aclose()
        await self.sb.aclose()

    async def _ensure_csrf(self):
        if self.csrf_token: return
        try:
            await self.http.get("/health")
            for name, val in self.http.cookies.items():
                if "csrf" in name: self.csrf_token = val; break
        except: pass

    def _headers(self, token=None, ip=None):
        h = {}
        if token: h["Authorization"] = f"Bearer {token}"
        if ip: h["X-Forwarded-For"] = ip
        if self.csrf_token: h["X-CSRF-Token"] = self.csrf_token
        return h

    async def wait_for_api_ready(self):
        print(f"⏳ Waiting for API Schema...", end="", flush=True)
        await self._ensure_csrf()
        
        # Create probe user
        try:
            email = f"probe_{RUN_ID}@example.com"
            await self.sb.post("/auth/v1/admin/users", 
                headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
                json={"email": email, "password": "pass", "email_confirm": True}
            )
            login = await self.sb.post("/auth/v1/token?grant_type=password", 
                headers={"apikey": SUPABASE_SERVICE_KEY}, json={"email": email, "password": "pass"}
            )
            token = login.json()["access_token"]
        except:
            print(" (Auth failed)")
            return

        for i in range(30):
            res = await self.http.post("/management/onboard", 
                headers=self._headers(token, fake_ip()), 
                json={"full_name": "Probe", "email": "probe@test.com"}
            )
            if res.status_code not in [404, 500]:
                print(f" ✅ Ready! ({res.status_code})")
                return
            print(".", end="", flush=True)
            await asyncio.sleep(2)
        print(" ❌ Timeout.")

    async def create_user_and_key(self, role):
        await self._ensure_csrf()
        
        for attempt in range(3):
            domain = ''.join(random.choices(string.ascii_lowercase, k=6))
            email = f"omega_{role}_{RUN_ID}_{attempt}@{domain}.test"
            pwd = "Pass_2025!"
            
            try:
                # 1. Auth
                await self.sb.post("/auth/v1/admin/users", 
                    headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
                    json={"email": email, "password": pwd, "email_confirm": True}
                )
                login = await self.sb.post("/auth/v1/token?grant_type=password", 
                    headers={"apikey": SUPABASE_SERVICE_KEY}, json={"email": email, "password": pwd}
                )
                if login.status_code != 200: continue
                token = login.json()["access_token"]
                
                # 2. Onboard
                ip = fake_ip()
                headers = self._headers(token, ip)
                
                for _ in range(5):
                    res = await self.http.post("/management/onboard", headers=headers, 
                        json={"full_name": role, "email": email, "openai_key": "sk-test-fake", "signup_ip": ip})
                    
                    if res.status_code == 200:
                        data = res.json()
                        
                        # --- DEBUG: PRINT RESPONSE ---
                        if role == "happy": # Only print once
                            print(f"\n🔍 [DEBUG] Onboard Response: {json.dumps(data)[:150]}...")
                        # -----------------------------

                        # Activate Demo Mode
                        await self.http.post("/demo/start", headers=headers)
                        await asyncio.sleep(0.5) # Wait for DB write

                        # TRY EXTRACT KEY
                        raw_key = data.get("api_key")
                        
                        # If key missing, try 'data' wrapper
                        if not raw_key and "data" in data:
                             raw_key = data["data"].get("api_key")

                        if not raw_key:
                            print(f"❌ [{role}] Key missing in response!")
                            continue

                        if not raw_key.startswith("oxy_live_"):
                             print(f"❌ [{role}] Invalid key format: {raw_key}")
                             continue

                        return {"token": token, "pid": data.get("project_id"), "key": raw_key, "email": email}
                    
                    elif res.status_code in [500, 404]:
                        await asyncio.sleep(2)
                    else: break
            except Exception as e: print(f"Ex: {e}")
            await asyncio.sleep(1)
            
        return None

class Simulator:
    def __init__(self): self.client = OxyClient(); self.results = []

    async def run_happy(self):
        s = time.time()
        try:
            u = await self.client.create_user_and_key("happy")
            if not u: return ScenarioResult("HAPPY", ScenarioStatus.FAIL, 0, "Setup Fail")
            
            # Force check key format
            if not u['key'].startswith("oxy_live_"):
                 return ScenarioResult("HAPPY", ScenarioStatus.FAIL, 0, f"Bad Key: {u['key']}")

            # Retry loop for chat
            for _ in range(5):
                r = await self.client.http.post("/v1/chat/completions", 
                    headers={"Authorization": f"Bearer {u['key']}"}, 
                    json={"model": "oxy-mock", "messages": [{"role":"user","content":"hi"}]}
                )
                if r.status_code == 200: 
                     return ScenarioResult("HAPPY PATH", ScenarioStatus.PASS, (time.time()-s)*1000)
                await asyncio.sleep(1)

            return ScenarioResult("HAPPY PATH", ScenarioStatus.FAIL, 0, f"Status {r.status_code} {r.text}")
        except Exception as e: return ScenarioResult("HAPPY PATH", ScenarioStatus.ERROR, 0, str(e))

    async def run_idor(self):
        s = time.time()
        try:
            atk = await self.client.create_user_and_key("atk")
            vic = await self.client.create_user_and_key("vic")
            if not vic: return ScenarioResult("IDOR", ScenarioStatus.SKIP, 0)
            
            r = await self.client.http.put(f"/management/project/{vic['pid']}", 
                headers=self.client._headers(atk['token']), json={"budget_limit": 1000.0, "name": "HACKED"}
            )
            if r.status_code in [403, 404]: return ScenarioResult("IDOR", ScenarioStatus.PASS, (time.time()-s)*1000)
            return ScenarioResult("IDOR", ScenarioStatus.FAIL, 0, f"Got {r.status_code}")
        except Exception as e: return ScenarioResult("IDOR", ScenarioStatus.ERROR, 0, str(e))

    async def run_race(self):
        s = time.time()
        try:
            u = await self.client.create_user_and_key("race")
            if not u: return ScenarioResult("RACE", ScenarioStatus.SKIP, 0)
            
            await self.client.http.put(f"/management/project/{u['pid']}", 
                headers=self.client._headers(u['token']), json={"budget_limit": 0.0001, "name": "Race"}
            )
            
            # Warmup
            await self.client.http.post("/v1/chat/completions", headers={"Authorization": f"Bearer {u['key']}"}, json={"model": "oxy-mock", "messages": [{"role":"user","content":"warm"}]})

            async def req(): return (await self.client.http.post("/v1/chat/completions", headers={"Authorization": f"Bearer {u['key']}"}, json={"model": "oxy-mock", "messages": [{"role":"user","content":"race"}]})).status_code
            res = await asyncio.gather(*[req() for _ in range(30)])
            
            if 402 in res or 429 in res: return ScenarioResult("RACE CONDITION", ScenarioStatus.PASS, (time.time()-s)*1000)
            return ScenarioResult("RACE CONDITION", ScenarioStatus.FAIL, 0, f"No blocks. {res[:5]}")
        except Exception as e: return ScenarioResult("RACE", ScenarioStatus.ERROR, 0, str(e))

    async def run_dlp(self):
        s = time.time()
        try:
            u = await self.client.create_user_and_key("dlp")
            if not u: return ScenarioResult("DLP", ScenarioStatus.SKIP, 0)
            
            # Warmup
            await self.client.http.post("/v1/chat/completions", headers={"Authorization": f"Bearer {u['key']}"}, json={"model": "oxy-mock", "messages": [{"role":"user","content":"warm"}]})

            r = await self.client.http.post("/v1/chat/completions", 
                headers={"Authorization": f"Bearer {u['key']}"}, 
                json={"model": "oxy-mock", "messages": [{"role":"user","content":"AKIAIOSFODNN7EXAMPLE"}]}
            )
            if r.status_code == 400: return ScenarioResult("DLP CHECK", ScenarioStatus.PASS, (time.time()-s)*1000)
            return ScenarioResult("DLP CHECK", ScenarioStatus.FAIL, 0, f"Got {r.status_code}")
        except Exception as e: return ScenarioResult("DLP CHECK", ScenarioStatus.ERROR, 0, str(e))
        
    async def run_free_tier_limit(self):
        s = time.time()
        try:
            u = await self.client.create_user_and_key("free")
            if not u: return ScenarioResult("FREE_TIER_LIMIT", ScenarioStatus.SKIP, 0)
            r = await self.client.http.post("/management/team/invite", headers=self.client._headers(u['token']), json={"email": "fake@fake.com"})
            if r.status_code in [402, 403, 422]: return ScenarioResult("FREE_TIER_LIMIT", ScenarioStatus.PASS, (time.time()-s)*1000)
            return ScenarioResult("FREE_TIER_LIMIT", ScenarioStatus.FAIL, 0, f"Got {r.status_code}")
        except Exception as e: return ScenarioResult("FREE_TIER_LIMIT", ScenarioStatus.ERROR, 0, str(e))

    async def run(self):
        print(f"\nEnd-to-end simulation (ID: {RUN_ID})")
        await self.client.wait_for_api_ready()
        await self.client.close(); self.client = OxyClient()
        for t in [self.run_happy, self.run_idor, self.run_race, self.run_free_tier_limit, self.run_dlp]:
            r = await t()
            self.results.append(r)
            icon = "✅" if r.status == ScenarioStatus.PASS else "❌"
            print(f"{icon} {r.name:<15} {r.duration_ms:.0f}ms {r.details}")
        await self.client.close()

if __name__ == "__main__":
    asyncio.run(Simulator().run())