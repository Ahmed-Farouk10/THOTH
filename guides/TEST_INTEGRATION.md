# 🧪 Complete Integration Test Results

## ✅ **STATUS: READY TO TEST**

The Notification Service is **fully implemented** and **ready for testing**. Once Docker Desktop is running, follow these steps:

---

## 🚀 Quick Start Test

### Step 1: Start Docker Desktop
Make sure Docker Desktop is running on Windows.

### Step 2: Start All Services
```powershell
docker-compose up -d
```

### Step 3: Wait for Services to Be Healthy
```powershell
docker-compose ps
```

All services should show "Up" and "healthy" status.

### Step 4: Check Notification Service Health
```powershell
curl http://localhost:8003/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "notification-service",
  "topics_subscribed": [
    "quiz.generated",
    "audio.generation.completed",
    "audio.transcription.completed",
    "document.processed",
    "notes.generated",
    "chat.message",
    "user.created"
  ],
  "consumer_group": "notification-service-group"
}
```

### Step 5: Run Full Integration Test
```powershell
.\scripts\test-full-integration.ps1
```

This script will:
1. ✅ Check all services are running
2. ✅ Get initial notification count
3. ✅ Authenticate and get JWT token
4. ✅ Upload a test document
5. ✅ Wait for document processing (60 seconds)
6. ✅ Verify notifications were received
7. ✅ Query specific notifications

---

## 📊 Manual Verification Steps

### 1. Check Notification Service Logs
```powershell
docker-compose logs -f notification-service
```

**Look for:**
- ✅ "Starting Kafka consumer"
- ✅ "Notification event received"
- ✅ "Notification logged successfully"

### 2. Check Document Worker Logs
```powershell
docker-compose logs -f document-worker
```

**Look for:**
- ✅ "Produced events for document {id}"
- ✅ "Produced document.processed event"
- ✅ "Produced notes.generated event"

### 3. Query Notifications
```powershell
# Get all notifications
curl http://localhost:8003/api/notifications

# Get stats
curl http://localhost:8003/api/notifications/stats

# Filter by topic
curl "http://localhost:8003/api/notifications?topic=document.processed"
curl "http://localhost:8003/api/notifications?topic=notes.generated"

# Filter by user
curl "http://localhost:8003/api/notifications?user_id=YOUR_USER_ID"
```

### 4. Upload a Document and Verify
```powershell
# Login
$loginBody = @{ username = "student1"; password = "securepass123" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$TOKEN = $login.access_token

# Upload document (use your test file)
$boundary = [System.Guid]::NewGuid().ToString()
$filePath = "C:\path\to\your\test.pdf"
$fileName = [System.IO.Path]::GetFileName($filePath)
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$fileText = [System.Text.Encoding]::UTF8.GetString($fileBytes)

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
    "Content-Type: application/pdf",
    "",
    $fileText,
    "--$boundary--"
)
$body = $bodyLines -join "`r`n"
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

$uploadResponse = Invoke-RestMethod `
    -Uri "http://localhost/api/documents/upload" `
    -Method Post `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    } `
    -Body $bodyBytes

$documentId = $uploadResponse.document_id
Write-Host "Document ID: $documentId"

# Wait 60 seconds for processing
Start-Sleep -Seconds 60

# Check notifications
$stats = Invoke-RestMethod -Uri "http://localhost:8003/api/notifications/stats"
Write-Host "Total notifications: $($stats.total_notifications)"
Write-Host "document.processed: $($stats.by_topic.'document.processed')"
Write-Host "notes.generated: $($stats.by_topic.'notes.generated')"

# Query notifications for this document
$notifications = Invoke-RestMethod -Uri "http://localhost:8003/api/notifications?limit=20"
$docEvents = $notifications.notifications | Where-Object { $_.event.document_id -eq $documentId }
Write-Host "Found $($docEvents.Count) events for document $documentId"
```

---

## ✅ Expected Results

After uploading a document and waiting for processing:

1. **Notification Service Logs:**
   ```
   📨 Notification event received
      topic: document.processed
      event_type: document.processed.v1
      document_id: ...
      user_id: ...
   ✅ Notification logged successfully
   
   📨 Notification event received
      topic: notes.generated
      event_type: notes.generated.v1
      document_id: ...
      user_id: ...
   ✅ Notification logged successfully
   ```

2. **Stats Endpoint:**
   ```json
   {
     "total_notifications": 2,
     "by_topic": {
       "document.processed": 1,
       "notes.generated": 1
     },
     "by_event_type": {
       "document.processed.v1": 1,
       "notes.generated.v1": 1
     }
   }
   ```

3. **Query Endpoint:**
   ```json
   {
     "total": 2,
     "notifications": [
       {
         "id": "...",
         "topic": "document.processed",
         "event_type": "document.processed.v1",
         "user_id": "...",
         "event": {
           "document_id": "...",
           "user_id": "...",
           "s3_uri": "...",
           ...
         }
       },
       {
         "id": "...",
         "topic": "notes.generated",
         "event_type": "notes.generated.v1",
         "user_id": "...",
         "event": {
           "document_id": "...",
           "user_id": "...",
           "notes_s3_url": "...",
           ...
         }
       }
     ]
   }
   ```

---

## 🔍 Troubleshooting

### Port 8003 Already Allocated
```powershell
# Find and stop process using port 8003
netstat -ano | findstr :8003
# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or stop Docker container
docker stop cloud-notification-service-1
docker rm cloud-notification-service-1
```

### Docker Desktop Not Running
1. Start Docker Desktop from Windows Start Menu
2. Wait for it to fully start (whale icon in system tray)
3. Run `docker ps` to verify Docker is accessible

### Notification Service Not Receiving Events

1. **Check Kafka topics exist:**
   ```powershell
   docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092
   ```
   Should see: `document.processed`, `notes.generated`

2. **Check consumer group:**
   ```powershell
   docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --group notification-service-group --describe
   ```

3. **Check notification service logs:**
   ```powershell
   docker-compose logs -f notification-service
   ```

4. **Check document-worker is producing events:**
   ```powershell
   docker-compose logs -f document-worker | Select-String -Pattern "Produced"
   ```

### Database Connection Issues
```powershell
# Check database is healthy
docker-compose ps notification-db

# Check connection
docker-compose exec notification-service env | Select-String DATABASE_URL
```

---

## 📝 Test Checklist

- [ ] Docker Desktop is running
- [ ] All services are up and healthy (`docker-compose ps`)
- [ ] Notification service health check works (`curl http://localhost:8003/health`)
- [ ] Kafka topics exist (`document.processed`, `notes.generated`)
- [ ] Document can be uploaded successfully
- [ ] Document worker processes the document
- [ ] Document worker produces `document.processed` event
- [ ] Document worker produces `notes.generated` event
- [ ] Notification service receives both events
- [ ] Events are stored in `notification_logs` table
- [ ] Query endpoints return data
- [ ] Stats endpoint shows correct counts

---

## 🎯 **READY TO TEST**

Once Docker Desktop is running, execute:
```powershell
.\scripts\test-full-integration.ps1
```

This will test the complete flow end-to-end and verify everything works!

---

**Last Updated:** 2025-12-04
**Status:** ✅ Ready for Testing

