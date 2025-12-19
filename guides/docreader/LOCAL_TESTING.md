# Document Reader Service - Local Testing Guide

## Prerequisites

- Docker & Docker Compose
- Python 3.11+
- curl (for testing)
- A PDF, DOCX, or TXT file for testing

---

## Quick Start (5 minutes)

### 1. Start Services
```bash
cd /path/to/DR\ service
docker-compose up -d
```

Wait for services to be ready (~10-15 seconds):
```bash
# Check API is up
curl http://localhost:8002/health

# Should return:
# {"status":"healthy","service":"document-reader-api"}
```

### 2. Test Health Check
```bash
curl http://localhost:8002/health
```

### 3. Test Basic Upload
```bash
# Create a test file
echo "This is a test document for the Document Reader Service." > test.txt

# Upload it
curl -X POST http://localhost:8002/api/documents/upload \
  -F "file=@test.txt" \
  -F "user_id=test_user"
```

Expected response:
```json
{
  "status": "processing_started",
  "document_id": "abc-123-def-456",
  "message": "File uploaded. Extraction will happen in background.",
  "s3_url": "s3://document-reader-storage-dev/test_user/abc-123-def-456/20251202_120000_test.txt"
}
```

### 4. Wait for Processing
```bash
# Wait 10 seconds for worker to process
sleep 10

# Check status
curl http://localhost:8002/api/documents/{document_id}
```

Should show `"status": "COMPLETED"`

### 5. Get Generated Notes
```bash
curl http://localhost:8002/api/documents/{document_id}/notes
```

---

## Complete Test Scenarios

### Scenario 1: PDF Upload & Processing

#### Step 1: Create a sample PDF
```bash
# Using Python to create a sample PDF
python3 << 'EOF'
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

pdf_file = "sample_report.pdf"
c = canvas.Canvas(pdf_file, pagesize=letter)
c.setFont("Helvetica", 12)
c.drawString(100, 750, "Sample Document Report")
c.drawString(100, 700, "This is page 1 of the sample report.")
c.drawString(100, 650, "It contains some text for testing the PDF processor.")
c.showPage()
c.save()
print(f"Created {pdf_file}")
EOF
```

#### Step 2: Upload PDF
```bash
curl -X POST http://localhost:8002/api/documents/upload \
  -F "file=@sample_report.pdf" \
  -F "user_id=john_doe"
```

Save the returned `document_id` for the next steps.

#### Step 3: Monitor Processing (wait 15 seconds)
```bash
sleep 15
curl http://localhost:8002/api/documents/{document_id}
```

#### Step 4: Retrieve Extracted Text
```bash
# Get S3 text URL
curl http://localhost:8002/api/documents/{document_id}/notes

# This will give you presigned_url to download the notes
```

---

### Scenario 2: DOCX Upload with Notes

#### Step 1: Create Sample DOCX
```bash
python3 << 'EOF'
from docx import Document

doc = Document()
doc.add_heading('Sample Document', 0)
doc.add_paragraph('This is a sample DOCX document for testing.')
doc.add_paragraph('It contains multiple paragraphs.')
doc.add_paragraph('The text extraction should capture all of this.')
doc.save('sample_document.docx')
print("Created sample_document.docx")
EOF
```

#### Step 2: Upload DOCX
```bash
curl -X POST http://localhost:8002/api/documents/upload \
  -F "file=@sample_document.docx" \
  -F "user_id=jane_smith"
```

#### Step 3: Check Notes After Processing
```bash
# Wait for processing
sleep 10

# Get notes (will have summary and key points)
curl http://localhost:8002/api/documents/{document_id}/notes
```

---

### Scenario 3: Notes Regeneration

#### Step 1: Upload a Document
```bash
curl -X POST http://localhost:8002/api/documents/upload \
  -F "file=@test.txt" \
  -F "user_id=test_user"
```

#### Step 2: Wait for Initial Processing
```bash
sleep 10
curl http://localhost:8002/api/documents/{document_id}
```

#### Step 3: Regenerate Notes
```bash
curl -X POST http://localhost:8002/api/documents/{document_id}/regenerate-notes
```

Expected response:
```json
{
  "status": "regeneration_started",
  "document_id": "{document_id}",
  "message": "Notes regeneration in progress"
}
```

#### Step 4: Check Updated Notes
```bash
sleep 10
curl http://localhost:8002/api/documents/{document_id}/notes
```

---

### Scenario 4: Document Deletion

#### Step 1: Upload Document
```bash
curl -X POST http://localhost:8002/api/documents/upload \
  -F "file=@test.txt" \
  -F "user_id=test_user"
```

#### Step 2: Verify It Exists
```bash
curl http://localhost:8002/api/documents/{document_id}
```

#### Step 3: Delete Document
```bash
curl -X DELETE http://localhost:8002/api/documents/{document_id}
```

Expected response:
```json
{
  "status": "deleted",
  "document_id": "{document_id}",
  "message": "Document and associated files deleted successfully"
}
```

#### Step 4: Verify Deletion
```bash
curl http://localhost:8002/api/documents/{document_id}
```

Should return 404 Not Found.

---

### Scenario 5: List User Documents

#### Step 1: Upload Multiple Documents
```bash
for i in {1..3}; do
  echo "Test document $i" > test_$i.txt
  curl -X POST http://localhost:8002/api/documents/upload \
    -F "file=@test_$i.txt" \
    -F "user_id=batch_test"
done
```

#### Step 2: List All Documents for User
```bash
curl "http://localhost:8002/api/documents?user_id=batch_test"
```

Expected response:
```json
{
  "documents": [
    {document1},
    {document2},
    {document3}
  ],
  "count": 3
}
```

---

## Testing with Different User Isolation

### User 1 Documents
```bash
curl -X POST http://localhost:8002/api/documents/upload \
  -F "file=@test.txt" \
  -F "user_id=user1"

curl "http://localhost:8002/api/documents?user_id=user1"
```

### User 2 Documents
```bash
curl -X POST http://localhost:8002/api/documents/upload \
  -F "file=@test.txt" \
  -F "user_id=user2"

curl "http://localhost:8002/api/documents?user_id=user2"
```

Verify users only see their own documents.

---

## Monitoring & Debugging

### View API Logs
```bash
docker-compose logs -f document-reader-api
```

### View Worker Logs
```bash
docker-compose logs -f document-reader-worker
```

### View Database Logs
```bash
docker-compose logs -f postgres
```

### View Kafka Logs
```bash
docker-compose logs -f kafka
```

### Connect to PostgreSQL
```bash
docker-compose exec postgres psql -U postgres -d document_reader_db

# Common queries:
# List documents: SELECT id, user_id, filename, status FROM documents;
# Check specific user: SELECT * FROM documents WHERE user_id = 'test_user';
# \q to exit
```

### Connect to MinIO Console
- URL: http://localhost:9001
- Username: minioadmin
- Password: minioadmin

### Check Kafka Topics
```bash
docker-compose exec kafka kafka-topics.sh \
  --list \
  --bootstrap-server kafka:9092
```

### View Kafka Messages
```bash
docker-compose exec kafka kafka-console-consumer.sh \
  --topic document.uploaded \
  --bootstrap-server kafka:9092 \
  --from-beginning \
  --max-messages 5
```

---

## Common Issues & Solutions

### Issue: "Connection refused" when testing API
**Solution:**
```bash
# Check if services are running
docker-compose ps

# If not running, start them
docker-compose up -d

# Wait 10 seconds and retry
sleep 10
curl http://localhost:8002/health
```

### Issue: "No such file or directory" for test files
**Solution:**
```bash
# Make sure you're in the correct directory
cd /path/to/DR\ service

# Create test files first
echo "Test content" > test.txt
ls -la test.txt  # Verify file exists
```

### Issue: Worker not processing documents
**Solution:**
```bash
# Check worker logs
docker-compose logs -f document-reader-worker

# If no logs, check if worker is running
docker-compose ps

# If not running, restart it
docker-compose restart document-reader-worker

# Check Kafka connectivity
docker-compose exec kafka kafka-topics.sh --list --bootstrap-server kafka:9092
```

### Issue: S3/MinIO bucket not found
**Solution:**
```bash
# Check if bucket exists
# Go to http://localhost:9001 with minioadmin/minioadmin

# Or create via command line:
docker-compose exec minio /usr/bin/mc alias set myminio http://minio:9000 minioadmin minioadmin
docker-compose exec minio /usr/bin/mc mb myminio/document-reader-storage-dev
```

### Issue: "OPENAI_API_KEY not set"
**Solution:**
This is expected if you haven't set the key. The service will use fallback simple notes.

```bash
# To use AI notes, add to .env:
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# Restart API and Worker
docker-compose restart document-reader-api document-reader-worker
```

---

## Cleanup

### Stop All Services
```bash
docker-compose down
```

### Remove Volumes (Reset Database)
```bash
docker-compose down -v
```

### Full Cleanup
```bash
docker-compose down -v
rm -rf logs tmp
```

---

## Performance Testing

### Test Concurrent Uploads
```bash
# Upload 5 files concurrently
for i in {1..5}; do
  (
    echo "File $i content" > file_$i.txt
    curl -X POST http://localhost:8002/api/documents/upload \
      -F "file=@file_$i.txt" \
      -F "user_id=perf_test" \
      -s > /dev/null
    echo "Uploaded file $i"
  ) &
done
wait

# Check all were processed
curl "http://localhost:8002/api/documents?user_id=perf_test"
```

### Monitor Resource Usage
```bash
# In another terminal, watch Docker stats
docker stats
```

---

## Using Python for Testing

### Simple Test Script
```python
#!/usr/bin/env python3
import requests
import time

API_URL = "http://localhost:8002"
USER_ID = "test_user"

def test_upload():
    """Test document upload"""
    with open("test.txt", "w") as f:
        f.write("Test document content")
    
    with open("test.txt", "rb") as f:
        response = requests.post(
            f"{API_URL}/api/documents/upload",
            files={"file": f},
            data={"user_id": USER_ID}
        )
    
    print(f"Upload Status: {response.status_code}")
    data = response.json()
    print(f"Document ID: {data['document_id']}")
    return data['document_id']

def test_get_document(doc_id):
    """Test get document"""
    response = requests.get(f"{API_URL}/api/documents/{doc_id}")
    print(f"Get Status: {response.status_code}")
    data = response.json()
    print(f"Document Status: {data['status']}")
    return data

def test_get_notes(doc_id):
    """Test get notes"""
    response = requests.get(f"{API_URL}/api/documents/{doc_id}/notes")
    if response.status_code == 200:
        print(f"Notes retrieved successfully")
    else:
        print(f"Notes not ready yet (status: {response.status_code})")

if __name__ == "__main__":
    print("🧪 Testing Document Reader Service\n")
    
    # Test upload
    print("1️⃣  Testing upload...")
    doc_id = test_upload()
    
    # Wait for processing
    print("\n2️⃣  Waiting for processing...")
    time.sleep(10)
    
    # Check status
    print("\n3️⃣  Checking status...")
    test_get_document(doc_id)
    
    # Get notes
    print("\n4️⃣  Getting notes...")
    test_get_notes(doc_id)
    
    print("\n✅ Tests completed!")
```

Save as `test_api.py` and run:
```bash
python3 test_api.py
```

---

## Cleanup Test Files
```bash
# After testing, clean up
rm -f test.txt sample_report.pdf sample_document.docx file_*.txt test_*.txt
```

---

## Next Steps

1. **Run Integration Tests** (see COMPLIANCE_REPORT.md)
2. **Load Testing** - Test with larger files and concurrent uploads
3. **Chaos Testing** - Stop services to test error handling
4. **Security Testing** - Test user isolation, SQL injection, etc.
5. **Production Deployment** - Deploy to actual infrastructure

---

**Happy Testing! 🚀**
