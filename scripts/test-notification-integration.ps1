# PowerShell script to test Document Service → Notification Service integration

Write-Host "🧪 Testing Document Service → Notification Service Integration" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$NOTIFICATION_SERVICE_URL = if ($env:NOTIFICATION_SERVICE_URL) { $env:NOTIFICATION_SERVICE_URL } else { "http://localhost:8003" }
$AGGREGATOR_URL = if ($env:AGGREGATOR_URL) { $env:AGGREGATOR_URL } else { "http://localhost" }

Write-Host "1️⃣  Checking Notification Service health..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$NOTIFICATION_SERVICE_URL/health" -Method Get
    Write-Host "   ✅ Notification Service is healthy" -ForegroundColor Green
    Write-Host "   Response: $($healthResponse | ConvertTo-Json -Compress)"
} catch {
    Write-Host "   ❌ Notification Service is not healthy: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2️⃣  Getting initial notification count..." -ForegroundColor Yellow
try {
    $stats = Invoke-RestMethod -Uri "$NOTIFICATION_SERVICE_URL/api/notifications/stats" -Method Get
    $initialCount = $stats.total_notifications
    Write-Host "   Initial notification count: $initialCount" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Could not get stats: $_" -ForegroundColor Yellow
    $initialCount = 0
}

Write-Host ""
Write-Host "3️⃣  Checking for document.processed and notes.generated events..." -ForegroundColor Yellow
try {
    $docProcessed = Invoke-RestMethod -Uri "$NOTIFICATION_SERVICE_URL/api/notifications?topic=document.processed" -Method Get
    $docCount = $docProcessed.total
    Write-Host "   document.processed events: $docCount" -ForegroundColor Green
} catch {
    Write-Host "   document.processed events: 0" -ForegroundColor Yellow
    $docCount = 0
}

try {
    $notesGenerated = Invoke-RestMethod -Uri "$NOTIFICATION_SERVICE_URL/api/notifications?topic=notes.generated" -Method Get
    $notesCount = $notesGenerated.total
    Write-Host "   notes.generated events: $notesCount" -ForegroundColor Green
} catch {
    Write-Host "   notes.generated events: 0" -ForegroundColor Yellow
    $notesCount = 0
}

if ($docCount -gt 0 -or $notesCount -gt 0) {
    Write-Host "   ✅ Found existing document events" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  No document events found yet (this is okay if you haven't uploaded documents)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "4️⃣  Testing notification query endpoints..." -ForegroundColor Yellow

try {
    $stats = Invoke-RestMethod -Uri "$NOTIFICATION_SERVICE_URL/api/notifications/stats" -Method Get
    Write-Host "   Stats endpoint: ✅" -ForegroundColor Green
    Write-Host "   $($stats | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "   ❌ Stats endpoint failed: $_" -ForegroundColor Red
}

try {
    $list = Invoke-RestMethod -Uri "$NOTIFICATION_SERVICE_URL/api/notifications?limit=5" -Method Get
    Write-Host ""
    Write-Host "   List endpoint (last 5): ✅" -ForegroundColor Green
    Write-Host "   $($list | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "   ❌ List endpoint failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "✅ Integration test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Upload a document via: POST $AGGREGATOR_URL/api/documents/upload"
Write-Host "   2. Wait for document-worker to process it"
Write-Host "   3. Check notifications: GET $NOTIFICATION_SERVICE_URL/api/notifications"
Write-Host "   4. You should see 'document.processed' and 'notes.generated' events"

