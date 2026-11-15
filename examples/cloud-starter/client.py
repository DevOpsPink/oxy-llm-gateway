import os
import requests

BASE_URL = os.environ.get("OXY_BASE_URL", "http://localhost:8000")
API_KEY = os.environ.get("OXY_API_KEY", "")

def main():
    if not API_KEY:
        raise SystemExit("Set OXY_API_KEY")

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        # Optional: set agent/session to demo kill switch
        # "X-Oxy-Agent-Id": "<agent-uuid>",
        # "X-Oxy-Session-Id": "<session-uuid>",
    }
    data = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Give me a one-line safety tip."},
        ],
        "stream": False,
    }

    resp = requests.post(f"{BASE_URL}/v1/chat/completions", headers=headers, json=data, timeout=60)
    resp.raise_for_status()
    print(resp.json())


if __name__ == "__main__":
    main()
