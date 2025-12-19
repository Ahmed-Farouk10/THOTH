# Document Reader Service - Windows Quick Start Guide

## 🚀 Start Testing in 5 Minutes

### Step 1: Start Docker Services
```powershell
cd "C:\Users\{YourUsername}\OneDrive\Desktop\DR service\DR service"
docker-compose up -d
```

Wait 15-20 seconds for services to initialize.

### Step 2: Verify API is Running
```powershell
curl http://localhost:8002/health
```

Should return:
```json
{"status":"healthy","service":"document-reader-api"}
```

### Step 3: Create a Test File
```powershell
# Create test.txt
@"
This is a test document for the Document Reader Service.
It contains multiple sentences for text extraction testing.
The service should properly extract and process this content.
"@ | Out-File -Encoding utf8 test.txt

# Verify file was created
Get-Content test.txt
```

### Step 4: Upload Document
```powershell
$response = curl -X POST http://localhost:8002/api/documents/upload `
  -F "file=@test.txt" `
  -F "user_id=test_user" `
  -ContentType "application/octet-stream" `
  -UseBasicParsing

$response.Content | ConvertFrom-Json | Format-List
```

Save the `document_id` from the response (looks like: `abc-123-def-456`).

### Step 5: Check Processing Status
```powershell
# Replace {document_id} with actual ID from step 4
$docId = "YOUR_DOCUMENT_ID_HERE"

# Wait 10 seconds for processing
Start-Sleep -Seconds 10

# Check status
curl http://localhost:8002/api/documents/$docId | ConvertFrom-Json | Format-List
```

### Step 6: Get Generated Notes
```powershell
curl http://localhost:8002/api/documents/$docId/notes | ConvertFrom-Json | Format-List
```

### Step 7: Stop Services
```powershell
docker-compose down
```

---

## 📊 Complete Testing with Python

### Option A: Automated Test Suite (Recommended)

```powershell
# Install requests library if needed
pip install requests

# Run test suite
python test_integration.py
```

This will automatically test:
- ✅ Health check
- ✅ Document upload (TXT)
- ✅ Get document details
- ✅ List documents
- ✅ Document processing
- ✅ Get notes
- ✅ Regenerate notes
- ✅ Delete document
- ✅ User isolation

### Option B: Manual Testing with curl

#### 1. Upload a Document
```powershell
# Create test file
@"
Test document content for the Document Reader Service.
This file will be processed by the worker.
"@ | Out-File -Encoding utf8 mydoc.txt

# Upload
$response = curl -X POST http://localhost:8002/api/documents/upload `
  -F "file=@mydoc.txt" `
  -F "user_id=john_doe" `
  -UseBasicParsing

$doc = $response.Content | ConvertFrom-Json
$docId = $doc.document_id
Write-Host "Uploaded document ID: $docId"
```

#### 2. Check Document Status
```powershell
curl http://localhost:8002/api/documents/$docId | ConvertFrom-Json | Format-List
```

Expected output:
```
id          : abc-123-def-456
user_id     : john_doe
filename    : mydoc.txt
status      : COMPLETED (after processing)
file_size   : 1024
created_at  : 2025-12-02T12:00:00Z
processed_at: 2025-12-02T12:00:10Z
```

#### 3. List All User Documents
```powershell
curl "http://localhost:8002/api/documents?user_id=john_doe" | ConvertFrom-Json | Format-List
```

#### 4. Get Generated Notes
```powershell
curl http://localhost:8002/api/documents/$docId/notes | ConvertFrom-Json | Format-List
```

#### 5. Regenerate Notes
```powershell
curl -X POST http://localhost:8002/api/documents/$docId/regenerate-notes | ConvertFrom-Json | Format-List
```

#### 6. Delete Document
```powershell
curl -X DELETE http://localhost:8002/api/documents/$docId | ConvertFrom-Json | Format-List
```

#### 7. Verify Deletion
```powershell
# Should return 404
curl http://localhost:8002/api/documents/$docId
```

---

## 📁 Testing Different File Formats

### Upload PDF
```powershell
# If you have a PDF file
curl -X POST http://localhost:8002/api/documents/upload `
  -F "file=@mydocument.pdf" `
  -F "user_id=test_user" `
  -UseBasicParsing
```

### Upload DOCX
```powershell
# If you have a Word document
curl -X POST http://localhost:8002/api/documents/upload `
  -F "file=@mydocument.docx" `
  -F "user_id=test_user" `
  -UseBasicParsing
```

---

## 🔍 Monitoring & Debugging

### View API Logs
```powershell
docker-compose logs -f document-reader-api
```

### View Worker Logs
```powershell
docker-compose logs -f document-reader-worker
```

### View Database Logs
```powershell
docker-compose logs -f postgres
```

### Connect to Database
```powershell
# Open a psql session
docker-compose exec postgres psql -U postgres -d document_reader_db

# In psql prompt:
# List all documents: SELECT id, user_id, filename, status FROM documents;
# Find user's docs: SELECT * FROM documents WHERE user_id = 'john_doe';
# Exit: \q
```

### Access MinIO Console
```
URL: http://localhost:9001
Username: minioadmin
Password: minioadmin
```

### Check Kafka Topics
```powershell
docker-compose exec kafka kafka-topics.sh --list --bootstrap-server kafka:9092
```

### View Kafka Messages
```powershell
docker-compose exec kafka kafka-console-consumer.sh `
  --topic document.uploaded `
  --bootstrap-server kafka:9092 `
  --from-beginning `
  --max-messages 5
```

---

## ⚙️ Configuration

### Environment Variables (.env file)
The `.env` file is created automatically by the setup script. Edit it if needed:

```bash
# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/document_reader_db

# Kafka
KAFKA_BOOTSTRAP_SERVERS=kafka:9092

# S3 Storage
S3_BUCKET_NAME=document-reader-storage-dev
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_REGION=us-east-1
S3_ENDPOINT_URL=http://minio:9000

# OpenAI API Key (optional)
# If you want AI-powered notes, add your key:
# OPENAI_API_KEY=sk-your-key-here
```

After editing `.env`, restart services:
```powershell
docker-compose restart document-reader-api document-reader-worker
```

---

## 🐛 Troubleshooting

### Issue: "API not responding"

**Solution:**
```powershell
# Check if services are running
docker-compose ps

# If services not running, start them
docker-compose up -d

# Wait 15 seconds and try again
Start-Sleep -Seconds 15
curl http://localhost:8002/health
```

### Issue: "Cannot find file"

**Solution:**
```powershell
# Make sure you're in the right directory
Get-Location  # Should show: ...\DR service

# Create test file in current directory
@"
Test content
"@ | Out-File test.txt

# Verify file exists
Get-Item test.txt
```

### Issue: "Worker not processing documents"

**Solution:**
```powershell
# Check worker logs
docker-compose logs document-reader-worker

# Restart worker
docker-compose restart document-reader-worker

# Check Kafka connectivity
docker-compose logs kafka
```

### Issue: "Bucket not found" in MinIO

**Solution:**
```powershell
# Access MinIO console: http://localhost:9001
# OR create bucket via CLI:
docker-compose exec minio /usr/bin/mc alias set myminio http://minio:9000 minioadmin minioadmin
docker-compose exec minio /usr/bin/mc mb myminio/document-reader-storage-dev
```

### Issue: "OpenAI API error"

**Solution:**
This is OK! The service falls back to simple notes. To use AI notes:

```powershell
# Add your OpenAI key to .env
Add-Content .env "`nOPENAI_API_KEY=sk-your-key-here"

# Restart services
docker-compose restart document-reader-api document-reader-worker
```

---

## 📊 Performance Metrics

### Typical Processing Times

| File Type | Size | Processing Time |
|-----------|------|-----------------|
| TXT | 10 KB | 2-3 seconds |
| PDF | 100 KB | 5-10 seconds |
| DOCX | 50 KB | 3-5 seconds |

### Service Requirements

| Service | Memory | CPU | Network |
|---------|--------|-----|---------|
| API | 512 MB | 0.5 | Yes |
| Worker | 1 GB | 1.0 | Yes |
| PostgreSQL | 512 MB | 0.5 | Internal |
| Kafka | 1 GB | 0.5 | Internal |
| MinIO | 512 MB | 0.5 | Internal |

---

## ✅ Testing Checklist

- [ ] Services started: `docker-compose ps` shows all running
- [ ] API responds: `curl http://localhost:8002/health`
- [ ] Test file created: `test.txt` exists
- [ ] Document uploaded successfully
- [ ] Document processed within 15 seconds
- [ ] Notes generated
- [ ] Notes regenerated successfully
- [ ] Document deleted and gone
- [ ] User isolation verified (different users see own docs)
- [ ] Integration test suite passes: `python test_integration.py`

---

## 📚 Additional Resources

- **Full Testing Guide:** See `LOCAL_TESTING.md`
- **API Reference:** See `QUICK_REFERENCE.md`
- **Compliance Report:** See `COMPLIANCE_REPORT.md`
- **Architecture Details:** See `CHANGES_SUMMARY.md`

---

## 🎯 Next Steps After Testing

1. **If tests pass:** Ready for staging/production deployment
2. **If tests fail:** Check logs and troubleshooting section above
3. **For production:** Follow deployment checklist in `COMPLIANCE_REPORT.md`
4. **For improvements:** See enhancement suggestions in `QUICK_REFERENCE.md`

---

## 💡 Tips

- Always wait 10-15 seconds after uploading before checking status
- Use `-f` flag with docker-compose logs to follow in real-time
- Save document IDs in a text file while testing
- Use Python test suite for comprehensive testing
- Check Kafka UI at http://localhost:8080 to monitor events

---

**Happy Testing! 🚀**

For questions, see the comprehensive documentation files or check the logs.
