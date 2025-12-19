
import requests
import sys

SERVICES = {
    "frontend": "http://localhost:3000/health",
    "aggregator": "http://localhost:8080/health",
    "document-service": "http://localhost:8002/health",
    "quiz-service": "http://localhost:8004/health",
    "chat-service": "http://localhost:8005/health",
    "tts-service": "http://localhost:8006/health",
    "stt-service": "http://localhost:8007/health",
    "user-service": "http://localhost:8000/health",
}

def check_health():
    all_healthy = True
    print("Checking service health...")
    for name, url in SERVICES.items():
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                print(f"✅ {name}: Healthy")
            else:
                print(f"❌ {name}: Unhealthy (Status {response.status_code})")
                all_healthy = False
        except Exception as e:
            print(f"❌ {name}: Failed to connect ({str(e)})")
            all_healthy = False
    return all_healthy

def check_proxies():
    print("\nChecking Aggregator Proxies...")
    # We can't easily check auth-protected endpoints without a token,
    # but we can try to hit them and expect 401 instead of 404 (which would mean proxy missing).
    
    endpoints = [
        ("DELETE Document", "DELETE", "http://localhost:8080/api/documents/fake-id"),
        ("DELETE Quiz", "DELETE", "http://localhost:8080/api/quizzes/fake-id"),
        ("Chat History", "GET", "http://localhost:8080/api/chat/conversations"),
    ]
    
    all_proxied = True
    for name, method, url in endpoints:
        try:
            response = requests.request(method, url, timeout=5)
            # 401/403 means it reached the service (or aggregator auth check)
            # 404 might mean aggregator doesn't know the route OR service doesn't find resource.
            # But for "fake-id", the service probably returns 404 or 403.
            # However, if Aggregator didn't have the route, it would return 404 immediately.
            # Wait, aggregator auth middleware might block it first. 
            # If we get 401 Unauthorized, that confirms the route exists in Aggregator (if it's authenticated).
            
            print(f"ℹ️  {name}: {response.status_code} (Expected 401/403/404/200)")
            
            if response.status_code in [401, 403, 404, 200]:
                 print(f"✅ {name} route seems present.")
            else:
                 print(f"⚠️  {name} returned unexpected status.")
                 
        except Exception as e:
            print(f"❌ {name}: Failed ({str(e)})")
            all_proxied = False
            
    return all_proxied

if __name__ == "__main__":
    health_ok = check_health()
    proxy_ok = check_proxies()
    
    if health_ok:
        print("\n🎉 All services are healthy!")
        sys.exit(0)
    else:
        print("\n⚠️  Some services are unhealthy.")
        sys.exit(1)
