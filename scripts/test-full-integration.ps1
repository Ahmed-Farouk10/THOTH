# Full Integration Test: Document Service → Notification Service
# Tests the complete flow: upload → process → notify

$ErrorActionPreference = "Stop"

Write-Host "🧪 Full Integration Test: Document Service → Notification Service" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$AGGREGATOR_URL = "http://localhost"
$NOTIFICATION_URL = "http://localhost:8003"
$USER_SERVICE_URL = "http://localhost:8000"

# Step 1: Check services are running
Write-Host "1️⃣  Checking services..." -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "$NOTIFICATION_URL/health" -Method Get
    Write-Host "   ✅ Notification Service: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Notification Service not responding: $_" -ForegroundColor Red
    exit 1
}

try {
    $health = Invoke-RestMethod -Uri "$AGGREGATOR_URL/health" -Method Get
    Write-Host "   ✅ Aggregator: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Aggregator not responding: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Get initial notification count
Write-Host ""
Write-Host "2️⃣  Getting initial notification count..." -ForegroundColor Yellow

try {
    $initialStats = Invoke-RestMethod -Uri "$NOTIFICATION_URL/api/notifications/stats" -Method Get
    $initialCount = $initialStats.total_notifications
    Write-Host "   Initial notifications: $initialCount" -ForegroundColor Green
    
    $initialDocProcessed = if ($initialStats.by_topic.'document.processed') { $initialStats.by_topic.'document.processed' } else { 0 }
    $initialNotesGenerated = if ($initialStats.by_topic.'notes.generated') { $initialStats.by_topic.'notes.generated' } else { 0 }
    
    Write-Host "   document.processed: $initialDocProcessed" -ForegroundColor Gray
    Write-Host "   notes.generated: $initialNotesGenerated" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  Could not get stats: $_" -ForegroundColor Yellow
    $initialCount = 0
    $initialDocProcessed = 0
    $initialNotesGenerated = 0
}

# Step 3: Login to get JWT token
Write-Host ""
Write-Host "3️⃣  Authenticating..." -ForegroundColor Yellow

try {
    $loginBody = @{
        username = "student1"
        password = "securepass123"
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Uri "$USER_SERVICE_URL/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $TOKEN = $login.access_token
    Write-Host "   ✅ Authenticated as: $($login.user.username)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Authentication failed: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Upload a test document
Write-Host ""
Write-Host "4️⃣  Uploading test document..." -ForegroundColor Yellow

# Create a simple test file
$testContent = @"
This is a test document for integration testing.

It contains multiple paragraphs to ensure proper text extraction.

The document service should process this and generate notes.

The notification service should receive document.processed and notes.generated events.
"@

$testFilePath = Join-Path $env:TEMP "test-integration-$(Get-Date -Format 'yyyyMMddHHmmss').txt"
$testContent | Out-File -FilePath $testFilePath -Encoding UTF8

try {
    $boundary = [System.Guid]::NewGuid().ToString()
    $fileName = [System.IO.Path]::GetFileName($testFilePath)
    $fileBytes = [System.IO.File]::ReadAllBytes($testFilePath)
    $fileText = [System.Text.Encoding]::UTF8.GetString($fileBytes)
    
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
        "Content-Type: text/plain",
        "",
        $fileText,
        "--$boundary--"
    )
    $body = $bodyLines -join "`r`n"
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

    $uploadResponse = Invoke-RestMethod `
        -Uri "$AGGREGATOR_URL/api/documents/upload" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "Content-Type" = "multipart/form-data; boundary=$boundary"
        } `
        -Body $bodyBytes

    $documentId = $uploadResponse.document_id
    Write-Host "   ✅ Document uploaded: $documentId" -ForegroundColor Green
    Write-Host "   Status: $($uploadResponse.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Upload failed: $_" -ForegroundColor Red
    Remove-Item $testFilePath -ErrorAction SilentlyContinue
    exit 1
} finally {
    Remove-Item $testFilePath -ErrorAction SilentlyContinue
}

# Step 5: Wait for processing
Write-Host ""
Write-Host "5️⃣  Waiting for document processing (60 seconds)..." -ForegroundColor Yellow
Write-Host "   (Document worker needs time to process and produce events)" -ForegroundColor Gray

$maxWait = 60
$waited = 0
$foundEvents = $false

while ($waited -lt $maxWait -and -not $foundEvents) {
    Start-Sleep -Seconds 5
    $waited += 5
    
    try {
        $stats = Invoke-RestMethod -Uri "$NOTIFICATION_URL/api/notifications/stats" -Method Get
        $currentDocProcessed = if ($stats.by_topic.'document.processed') { $stats.by_topic.'document.processed' } else { 0 }
        $currentNotesGenerated = if ($stats.by_topic.'notes.generated') { $stats.by_topic.'notes.generated' } else { 0 }
        
        if ($currentDocProcessed -gt $initialDocProcessed -and $currentNotesGenerated -gt $initialNotesGenerated) {
            $foundEvents = $true
            Write-Host "   ✅ Events received!" -ForegroundColor Green
            break
        }
        
        Write-Host "   ⏳ Waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
    } catch {
        Write-Host "   ⏳ Waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
    }
}

if (-not $foundEvents) {
    Write-Host "   ⚠️  Timeout waiting for events. Checking logs..." -ForegroundColor Yellow
}

# Step 6: Verify notifications were received
Write-Host ""
Write-Host "6️⃣  Verifying notifications..." -ForegroundColor Yellow

try {
    $finalStats = Invoke-RestMethod -Uri "$NOTIFICATION_URL/api/notifications/stats" -Method Get
    $finalCount = $finalStats.total_notifications
    $finalDocProcessed = if ($finalStats.by_topic.'document.processed') { $finalStats.by_topic.'document.processed' } else { 0 }
    $finalNotesGenerated = if ($finalStats.by_topic.'notes.generated') { $finalStats.by_topic.'notes.generated' } else { 0 }
    
    Write-Host "   Total notifications: $finalCount (was $initialCount)" -ForegroundColor Green
    Write-Host "   document.processed: $finalDocProcessed (was $initialDocProcessed)" -ForegroundColor $(if ($finalDocProcessed -gt $initialDocProcessed) { "Green" } else { "Yellow" })
    Write-Host "   notes.generated: $finalNotesGenerated (was $initialNotesGenerated)" -ForegroundColor $(if ($finalNotesGenerated -gt $initialNotesGenerated) { "Green" } else { "Yellow" })
    
    if ($finalDocProcessed -gt $initialDocProcessed -and $finalNotesGenerated -gt $initialNotesGenerated) {
        Write-Host "   ✅ Both events received!" -ForegroundColor Green
    } elseif ($finalDocProcessed -gt $initialDocProcessed -or $finalNotesGenerated -gt $initialNotesGenerated) {
        Write-Host "   ⚠️  Partial success - some events received" -ForegroundColor Yellow
    } else {
        Write-Host "   ❌ No new events received" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Failed to get stats: $_" -ForegroundColor Red
}

# Step 7: Query specific notifications
Write-Host ""
Write-Host "7️⃣  Querying notifications for document..." -ForegroundColor Yellow

try {
    $notifications = Invoke-RestMethod -Uri "$NOTIFICATION_URL/api/notifications?limit=10" -Method Get
    
    $docProcessedEvents = $notifications.notifications | Where-Object { $_.topic -eq "document.processed" -and $_.event.document_id -eq $documentId }
    $notesGeneratedEvents = $notifications.notifications | Where-Object { $_.topic -eq "notes.generated" -and $_.event.document_id -eq $documentId }
    
    if ($docProcessedEvents) {
        Write-Host "   ✅ Found document.processed event for document $documentId" -ForegroundColor Green
        Write-Host "      Event ID: $($docProcessedEvents[0].id)" -ForegroundColor Gray
        Write-Host "      User ID: $($docProcessedEvents[0].user_id)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  No document.processed event found for this document" -ForegroundColor Yellow
    }
    
    if ($notesGeneratedEvents) {
        Write-Host "   ✅ Found notes.generated event for document $documentId" -ForegroundColor Green
        Write-Host "      Event ID: $($notesGeneratedEvents[0].id)" -ForegroundColor Gray
        Write-Host "      User ID: $($notesGeneratedEvents[0].user_id)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  No notes.generated event found for this document" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Could not query notifications: $_" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "✅ Integration test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   - Document uploaded: $documentId" -ForegroundColor White
Write-Host "   - Notifications received: $(if ($foundEvents) { 'Yes' } else { 'No' })" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Next steps:" -ForegroundColor Cyan
Write-Host "   - Check logs: docker-compose logs -f notification-service" -ForegroundColor White
Write-Host "   - Check document-worker: docker-compose logs -f document-worker" -ForegroundColor White
Write-Host "   - View all notifications: curl $NOTIFICATION_URL/api/notifications" -ForegroundColor White

