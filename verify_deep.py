
import asyncio
import json
import jwt
import requests
import boto3
import time
import sys
import os
from datetime import datetime, timedelta

# Configuration
JWT_SECRET = "your-secret-key-change-in-production"
API_BASE_URL = "http://localhost"
S3_ENDPOINT = "http://localhost:4566"
WS_URL = "ws://localhost/ws/notifications"

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

def print_result(name, success, message=""):
    status = f"{GREEN}PASSED{RESET}" if success else f"{RED}FAILED{RESET}"
    print(f"{name:<20} {status} {message}")

def generate_test_token():
    payload = {
        "user_id": "verify-script-user",
        "sub": "verify-script-user",
        "email": "verify@example.com",
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def check_api_health():
    print(f"\n{YELLOW}--- Checking API Health ---{RESET}")
    services = {
        "Aggregator": "http://localhost:8080/health",
        "Document Service": "http://localhost:8002/health",
        "Quiz Service": "http://localhost:8004/health",
        "Chat Service": "http://localhost:8005/health",
        "TTS Service": "http://localhost:8006/health",
        "STT Service": "http://localhost:8007/health",
        "User Service": "http://localhost:8000/health",
        "Notification Service": "http://localhost:8003/health"
    }
    
    all_passed = True
    for name, url in services.items():
        try:
            res = requests.get(url, timeout=2)
            if res.status_code == 200:
                print_result(name, True)
            else:
                print_result(name, False, f"Status: {res.status_code}")
                all_passed = False
        except Exception as e:
            print_result(name, False, f"Error: {str(e)}")
            all_passed = False
    return all_passed

def check_s3():
    print(f"\n{YELLOW}--- Checking S3 Bucket (LocalStack) ---{RESET}")
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id='test',
            aws_secret_access_key='test',
            region_name='us-east-1'
        )
        
        # 1. List Buckets
        response = s3.list_buckets()
        buckets = [b['Name'] for b in response.get('Buckets', [])]
        print(f"Found Buckets: {buckets}")
        
        target_bucket = "documents"
        if target_bucket not in buckets:
            print_result("Bucket Exists", False, f"Bucket '{target_bucket}' not found. Creating...")
            s3.create_bucket(Bucket=target_bucket)
        else:
            print_result("Bucket Exists", True, f"Bucket '{target_bucket}' found")
            
        # 2. Upload File
        test_key = "verify_test.txt"
        test_content = b"This is a verification file."
        s3.put_object(Bucket=target_bucket, Key=test_key, Body=test_content)
        print_result("Upload File", True, f"Uploaded '{test_key}'")
        
        # 3. Read File
        obj = s3.get_object(Bucket=target_bucket, Key=test_key)
        content = obj['Body'].read()
        if content == test_content:
            print_result("Read File", True, "Content matches")
        else:
            print_result("Read File", False, "Content mismatch")
            
        # 4. Cleanup
        s3.delete_object(Bucket=target_bucket, Key=test_key)
        print_result("Delete File", True, "Cleaned up test file")
        return True
        
    except Exception as e:
        print_result("S3 Check", False, str(e))
        return False

async def check_websocket():
    print(f"\n{YELLOW}--- Checking WebSocket Notifications ---{RESET}")
    import websockets
    
    token = generate_test_token()
    uri = f"{WS_URL}?token={token}"
    
    try:
        async with websockets.connect(uri) as websocket:
            print_result("WS Connect", True, "Connected successfully")
            
            # Send Ping (text message)
            await websocket.send("ping")
            print("Sent: ping")
            
            # Wait for Pong
            try:
                response_text = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response = json.loads(response_text)
                if response.get("type") == "pong":
                    print_result("WS Response", True, "Received 'pong'")
                else:
                    print_result("WS Response", False, f"Received unexpected: {response}")
            except asyncio.TimeoutError:
                print_result("WS Response", False, "Timeout waiting for pong")
                
            return True
    except Exception as e:
        print_result("WS Connection", False, f"Failed: {str(e)}")
        return False

async def main():
    api_ok = check_api_health()
    s3_ok = check_s3()
    ws_ok = await check_websocket()
    
    print(f"\n{YELLOW}--- Summary ---{RESET}")
    if api_ok and s3_ok and ws_ok:
        print(f"{GREEN}ALL CHECKS PASSED{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}SOME CHECKS FAILED{RESET}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
