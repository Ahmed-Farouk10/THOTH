#!/usr/bin/env python3
"""
Document Reader Service - Integration Test Suite
Tests all endpoints and Kafka event flow
"""

import requests
import json
import time
import sys
from pathlib import Path
from typing import Optional, Dict, Any

# Configuration
API_URL = "http://localhost:8002"
TIMEOUT = 30
PROCESSING_WAIT = 10

class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header(text: str):
    """Print a formatted header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text.center(60)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")

def print_test(name: str, passed: bool, message: str = ""):
    """Print test result"""
    symbol = "✅" if passed else "❌"
    status = f"{Colors.GREEN}PASS{Colors.END}" if passed else f"{Colors.RED}FAIL{Colors.END}"
    msg = f" - {message}" if message else ""
    print(f"{symbol} {name}: {status}{msg}")

def check_api_health() -> bool:
    """Check if API is healthy"""
    try:
        response = requests.get(f"{API_URL}/health", timeout=TIMEOUT)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False

def create_test_file(filename: str, content: str) -> Path:
    """Create a test file"""
    path = Path(filename)
    path.write_text(content)
    return path

def test_1_health_check() -> bool:
    """Test 1: Health Check"""
    print_header("Test 1: Health Check")
    try:
        response = requests.get(f"{API_URL}/health", timeout=TIMEOUT)
        success = response.status_code == 200
        data = response.json() if success else {}
        print_test(
            "API Health Check",
            success,
            f"Status: {response.status_code}, Service: {data.get('service', 'unknown')}"
        )
        return success
    except Exception as e:
        print_test("API Health Check", False, str(e))
        return False

def test_2_document_upload() -> Optional[str]:
    """Test 2: Document Upload (TXT)"""
    print_header("Test 2: Document Upload")
    try:
        # Create test file
        test_file = create_test_file("test_upload.txt", 
            "This is a test document for the Document Reader Service. "
            "It contains multiple sentences to test text extraction. "
            "The content should be properly processed by the worker service.")
        
        # Upload
        with open(test_file, "rb") as f:
            files = {"file": f}
            data = {"user_id": "test_user_1"}
            response = requests.post(
                f"{API_URL}/api/documents/upload",
                files=files,
                data=data,
                timeout=TIMEOUT
            )
        
        success = response.status_code == 200
        result = response.json()
        document_id = result.get("document_id")
        
        print_test(
            "TXT Upload",
            success,
            f"Document ID: {document_id}"
        )
        
        # Cleanup
        test_file.unlink()
        
        return document_id if success else None
    except Exception as e:
        print_test("TXT Upload", False, str(e))
        return None

def test_3_get_document(document_id: str) -> bool:
    """Test 3: Get Document Details"""
    print_header("Test 3: Get Document Details")
    try:
        response = requests.get(
            f"{API_URL}/api/documents/{document_id}",
            timeout=TIMEOUT
        )
        
        success = response.status_code == 200
        data = response.json() if success else {}
        status = data.get("status", "unknown")
        
        print_test(
            "Get Document",
            success,
            f"Status: {status}, Size: {data.get('file_size', 'N/A')} bytes"
        )
        
        return success
    except Exception as e:
        print_test("Get Document", False, str(e))
        return False

def test_4_list_documents(user_id: str) -> bool:
    """Test 4: List User Documents"""
    print_header("Test 4: List Documents")
    try:
        response = requests.get(
            f"{API_URL}/api/documents",
            params={"user_id": user_id},
            timeout=TIMEOUT
        )
        
        success = response.status_code == 200
        data = response.json() if success else {}
        count = data.get("count", 0)
        
        print_test(
            "List Documents",
            success,
            f"Found {count} document(s)"
        )
        
        return success
    except Exception as e:
        print_test("List Documents", False, str(e))
        return False

def test_5_wait_for_processing(document_id: str, timeout: int = 30) -> bool:
    """Test 5: Wait for Document Processing"""
    print_header("Test 5: Wait for Processing")
    try:
        start_time = time.time()
        while time.time() - start_time < timeout:
            response = requests.get(
                f"{API_URL}/api/documents/{document_id}",
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                status = data.get("status")
                
                if status == "COMPLETED":
                    elapsed = int(time.time() - start_time)
                    print_test(
                        "Document Processing",
                        True,
                        f"Completed in {elapsed} seconds"
                    )
                    return True
                elif status == "FAILED":
                    error = data.get("error_message", "Unknown error")
                    print_test("Document Processing", False, f"Failed: {error}")
                    return False
            
            print(f"  ⏳ Status: {status}, waiting...", end="\r")
            time.sleep(2)
        
        print_test("Document Processing", False, f"Timeout after {timeout}s")
        return False
    except Exception as e:
        print_test("Document Processing", False, str(e))
        return False

def test_6_get_notes(document_id: str) -> bool:
    """Test 6: Get Document Notes"""
    print_header("Test 6: Get Notes")
    try:
        response = requests.get(
            f"{API_URL}/api/documents/{document_id}/notes",
            timeout=TIMEOUT
        )
        
        success = response.status_code == 200
        data = response.json() if success else {}
        
        if success:
            print_test(
                "Get Notes",
                True,
                f"S3 URL: {data.get('notes_url', 'N/A')[:50]}..."
            )
        else:
            print_test("Get Notes", False, f"Status: {response.status_code}")
        
        return success
    except Exception as e:
        print_test("Get Notes", False, str(e))
        return False

def test_7_regenerate_notes(document_id: str) -> bool:
    """Test 7: Regenerate Notes"""
    print_header("Test 7: Regenerate Notes")
    try:
        response = requests.post(
            f"{API_URL}/api/documents/{document_id}/regenerate-notes",
            timeout=TIMEOUT
        )
        
        success = response.status_code == 200
        data = response.json() if success else {}
        status = data.get("status", "unknown")
        
        print_test(
            "Regenerate Notes Request",
            success,
            f"Status: {status}"
        )
        
        # Wait a bit and check again
        print("  ⏳ Waiting for regeneration...")
        time.sleep(PROCESSING_WAIT)
        
        response2 = requests.get(
            f"{API_URL}/api/documents/{document_id}/notes",
            timeout=TIMEOUT
        )
        
        print_test(
            "Verify Regenerated Notes",
            response2.status_code == 200,
            f"Status: {response2.status_code}"
        )
        
        return success and response2.status_code == 200
    except Exception as e:
        print_test("Regenerate Notes", False, str(e))
        return False

def test_8_delete_document(document_id: str) -> bool:
    """Test 8: Delete Document"""
    print_header("Test 8: Delete Document")
    try:
        response = requests.delete(
            f"{API_URL}/api/documents/{document_id}",
            timeout=TIMEOUT
        )
        
        success = response.status_code == 200
        data = response.json() if success else {}
        status = data.get("status", "unknown")
        
        print_test(
            "Delete Document",
            success,
            f"Status: {status}"
        )
        
        # Verify deletion
        response2 = requests.get(
            f"{API_URL}/api/documents/{document_id}",
            timeout=TIMEOUT
        )
        
        verified = response2.status_code == 404
        print_test(
            "Verify Deletion",
            verified,
            f"Status code: {response2.status_code} (expected 404)"
        )
        
        return success and verified
    except Exception as e:
        print_test("Delete Document", False, str(e))
        return False

def test_9_pdf_upload() -> Optional[str]:
    """Test 9: PDF Upload"""
    print_header("Test 9: PDF Upload (if available)")
    try:
        pdf_file = Path("sample.pdf")
        if not pdf_file.exists():
            print("⚠️  PDF file not available, skipping PDF test")
            return None
        
        with open(pdf_file, "rb") as f:
            files = {"file": f}
            data = {"user_id": "test_user_pdf"}
            response = requests.post(
                f"{API_URL}/api/documents/upload",
                files=files,
                data=data,
                timeout=TIMEOUT
            )
        
        success = response.status_code == 200
        result = response.json()
        document_id = result.get("document_id")
        
        print_test(
            "PDF Upload",
            success,
            f"Document ID: {document_id}"
        )
        
        return document_id if success else None
    except Exception as e:
        print_test("PDF Upload", False, str(e))
        return None

def test_10_user_isolation() -> bool:
    """Test 10: User Isolation"""
    print_header("Test 10: User Isolation")
    try:
        # Create files for two different users
        file1 = create_test_file("test_user1.txt", "User 1 content")
        file2 = create_test_file("test_user2.txt", "User 2 content")
        
        # Upload for user1
        with open(file1, "rb") as f:
            response1 = requests.post(
                f"{API_URL}/api/documents/upload",
                files={"file": f},
                data={"user_id": "isolated_user_1"},
                timeout=TIMEOUT
            )
        
        # Upload for user2
        with open(file2, "rb") as f:
            response2 = requests.post(
                f"{API_URL}/api/documents/upload",
                files={"file": f},
                data={"user_id": "isolated_user_2"},
                timeout=TIMEOUT
            )
        
        # List documents for each user
        response_user1 = requests.get(
            f"{API_URL}/api/documents",
            params={"user_id": "isolated_user_1"},
            timeout=TIMEOUT
        )
        
        response_user2 = requests.get(
            f"{API_URL}/api/documents",
            params={"user_id": "isolated_user_2"},
            timeout=TIMEOUT
        )
        
        user1_count = response_user1.json().get("count", 0) if response_user1.status_code == 200 else 0
        user2_count = response_user2.json().get("count", 0) if response_user2.status_code == 200 else 0
        
        success = user1_count >= 1 and user2_count >= 1
        
        print_test(
            "User Isolation",
            success,
            f"User1: {user1_count} docs, User2: {user2_count} docs"
        )
        
        # Cleanup
        file1.unlink()
        file2.unlink()
        
        return success
    except Exception as e:
        print_test("User Isolation", False, str(e))
        return False

def run_all_tests():
    """Run all tests"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}Document Reader Service - Test Suite{Colors.END}")
    print(f"API URL: {API_URL}")
    print(f"Start Time: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Check API health first
    if not check_api_health():
        print(f"\n{Colors.RED}❌ ERROR: API is not responding!{Colors.END}")
        print(f"Make sure the service is running: docker-compose up -d")
        sys.exit(1)
    
    results = {}
    
    # Run tests in sequence
    results["health"] = test_1_health_check()
    
    doc_id = test_2_document_upload()
    results["upload"] = doc_id is not None
    
    if doc_id:
        results["get_document"] = test_3_get_document(doc_id)
        results["list"] = test_4_list_documents("test_user_1")
        results["processing"] = test_5_wait_for_processing(doc_id)
        results["notes"] = test_6_get_notes(doc_id)
        results["regenerate"] = test_7_regenerate_notes(doc_id)
        results["delete"] = test_8_delete_document(doc_id)
    
    results["pdf"] = test_9_pdf_upload() is not None
    results["isolation"] = test_10_user_isolation()
    
    # Summary
    print_header("Test Summary")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    percentage = (passed / total * 100) if total > 0 else 0
    
    print(f"✅ Passed: {passed}/{total} ({percentage:.0f}%)")
    
    for test_name, result in results.items():
        symbol = "✅" if result else "❌"
        print(f"  {symbol} {test_name.replace('_', ' ').title()}")
    
    status = Colors.GREEN + "SUCCESS" + Colors.END if passed == total else Colors.RED + "FAILURE" + Colors.END
    print(f"\nOverall Status: {status}\n")
    
    return passed == total

if __name__ == "__main__":
    try:
        success = run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Tests interrupted by user{Colors.END}\n")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Colors.RED}Unexpected error: {e}{Colors.END}\n")
        sys.exit(1)
