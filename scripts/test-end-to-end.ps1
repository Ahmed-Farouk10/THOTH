# End-to-End Test Script for Cloud Learning Platform
# Tests the complete flow: Upload Document → Process → Generate Quiz → Notifications

param(
    [Parameter(Mandatory=$true)]
    [string]$PdfPath,
    
    [Parameter(Mandatory=$false)]
    [string]$JwtToken = ""
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "End-to-End Platform Test" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify services are running
Write-Host "[1/7] Checking services..." -ForegroundColor Yellow
$services = @("user-service", "aggregator", "document-service", "document-worker", "quiz-worker", "notification-service")
$allRunning = $true

foreach ($service in $services) {
    $status = docker-compose ps $service --format "{{.Status}}" 2>&1
    if ($status -match "Up|running") {
        Write-Host "  ✅ $service is running" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $service is NOT running: $status" -ForegroundColor Red
        $allRunning = $false
    }
}

if (-not $allRunning) {
    Write-Host "`n❌ Some services are not running. Start them with:" -ForegroundColor Red
    Write-Host "   docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

# Step 2: Get or create JWT token
Write-Host "`n[2/7] Authentication..." -ForegroundColor Yellow
if ([string]::IsNullOrEmpty($JwtToken)) {
    Write-Host "  Creating test user and getting JWT token..." -ForegroundColor Gray
    
    # Try to login or register
    $loginBody = @{
        email = "test@example.com"
        password = "testpass123"
    } | ConvertTo-Json
    
    try {
        $loginResponse = Invoke-RestMethod -Uri "http://localhost/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -ErrorAction SilentlyContinue
        $JwtToken = $loginResponse.access_token
        Write-Host "  ✅ Logged in with existing user" -ForegroundColor Green
    } catch {
        # Try to register
        try {
            $registerResponse = Invoke-RestMethod -Uri "http://localhost/api/auth/register" -Method POST -Body $loginBody -ContentType "application/json"
            $JwtToken = $registerResponse.access_token
            Write-Host "  ✅ Registered new user" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  Could not authenticate. Using direct service call..." -ForegroundColor Yellow
            $JwtToken = "test-token"
        }
    }
} else {
    Write-Host "  ✅ Using provided JWT token" -ForegroundColor Green
}

# Step 3: Verify PDF file exists
Write-Host "`n[3/7] Verifying PDF file..." -ForegroundColor Yellow
if (-not (Test-Path $PdfPath)) {
    Write-Host "  ❌ PDF file not found: $PdfPath" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ PDF file found: $PdfPath" -ForegroundColor Green
$fileInfo = Get-Item $PdfPath
Write-Host "  📄 File size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Gray

# Step 4: Upload document
Write-Host "`n[4/7] Uploading document..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $JwtToken"
    }
    
    $formData = @{
        file = Get-Item $PdfPath
    }
    
    $uploadResponse = Invoke-RestMethod -Uri "http://localhost/api/documents/upload" -Method POST -Headers $headers -Form $formData
    $documentId = $uploadResponse.document_id
    
    Write-Host "  ✅ Document uploaded successfully" -ForegroundColor Green
    Write-Host "  📄 Document ID: $documentId" -ForegroundColor Gray
    Write-Host "  📦 S3 URL: $($uploadResponse.s3_url)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Upload failed: $_" -ForegroundColor Red
    Write-Host "  Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

# Step 5: Wait for document processing
Write-Host "`n[5/7] Waiting for document processing..." -ForegroundColor Yellow
$maxWait = 120  # 2 minutes
$waitInterval = 5
$elapsed = 0
$processed = $false

while ($elapsed -lt $maxWait -and -not $processed) {
    Start-Sleep -Seconds $waitInterval
    $elapsed += $waitInterval
    
    try {
        $docResponse = Invoke-RestMethod -Uri "http://localhost/api/documents/$documentId" -Method GET -Headers $headers -ErrorAction SilentlyContinue
        if ($docResponse.status -eq "COMPLETED") {
            $processed = $true
            Write-Host "  ✅ Document processed successfully" -ForegroundColor Green
            Write-Host "  📝 Text length: $($docResponse.text_length) characters" -ForegroundColor Gray
            break
        }
        if ($docResponse.status -eq "FAILED") {
            Write-Host "  ❌ Document processing failed: $($docResponse.error_message)" -ForegroundColor Red
            exit 1
        }
    } catch {
        # Service might not be ready yet, continue waiting
    }
    
    Write-Host "  ⏳ Waiting... ($elapsed/$maxWait seconds)" -ForegroundColor Gray
}

if (-not $processed) {
    Write-Host "  ⚠️  Document processing timed out. Check logs:" -ForegroundColor Yellow
    Write-Host "     docker-compose logs document-worker" -ForegroundColor Gray
}

# Step 6: Check for notes
Write-Host "`n[6/7] Checking generated notes..." -ForegroundColor Yellow
try {
    $notesResponse = Invoke-RestMethod -Uri "http://localhost/api/documents/$documentId/notes" -Method GET -Headers $headers -ErrorAction SilentlyContinue
    Write-Host "  ✅ Notes generated successfully" -ForegroundColor Green
    Write-Host "  📝 Notes URL: $($notesResponse.notes_url)" -ForegroundColor Gray
} catch {
    Write-Host "  ⚠️  Notes not yet available (may still be processing)" -ForegroundColor Yellow
}

# Step 7: Request quiz generation
Write-Host "`n[7/7] Requesting quiz generation..." -ForegroundColor Yellow
try {
    $quizBody = @{
        document_id = $documentId
        difficulty = "medium"
        question_count = 10
    } | ConvertTo-Json
    
    $quizParams = @{
        document_id = $documentId
        difficulty = "medium"
        question_count = 10
    }
    $quizUrl = "http://localhost/api/quiz/generate"
    $quizResponse = Invoke-RestMethod -Uri $quizUrl -Method POST -Headers $headers -Body $quizBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "  ✅ Quiz generation requested" -ForegroundColor Green
    Write-Host "  📋 Status: $($quizResponse.status)" -ForegroundColor Gray
    Write-Host "  💬 Message: $($quizResponse.message)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Quiz generation request failed: $_" -ForegroundColor Red
    exit 1
}

# Step 8: Wait for quiz generation
Write-Host "`n[8/8] Waiting for quiz generation..." -ForegroundColor Yellow
$maxWait = 180  # 3 minutes for AI processing
$waitInterval = 10
$elapsed = 0
$quizGenerated = $false

Write-Host "  ⏳ This may take 30-60 seconds (AI processing)..." -ForegroundColor Gray

while ($elapsed -lt $maxWait -and -not $quizGenerated) {
    Start-Sleep -Seconds $waitInterval
    $elapsed += $waitInterval
    
    # Check notification service for quiz.generated event
    try {
        $notifications = Invoke-RestMethod -Uri "http://localhost:8003/api/notifications?topic=quiz.generated&limit=10" -Method GET -ErrorAction SilentlyContinue
        $quizNotification = $notifications | Where-Object { $_.raw_event.document_id -eq $documentId }
        
        if ($quizNotification) {
            $quizId = $quizNotification.raw_event.quiz_id
            Write-Host "  ✅ Quiz generated! Quiz ID: $quizId" -ForegroundColor Green
            
            # Try to fetch the quiz
            try {
                $quiz = Invoke-RestMethod -Uri "http://localhost:8004/api/quizzes/$quizId" -Method GET -ErrorAction SilentlyContinue
                Write-Host "  📋 Quiz Title: $($quiz.title)" -ForegroundColor Gray
                Write-Host "  ❓ Questions: $($quiz.questions.Count)" -ForegroundColor Gray
                $quizGenerated = $true
                break
            } catch {
                Write-Host "  ⚠️  Quiz generated but not yet available via API" -ForegroundColor Yellow
            }
        }
    } catch {
        # Notification service might not have the event yet
    }
    
    Write-Host "  ⏳ Waiting... ($elapsed/$maxWait seconds)" -ForegroundColor Gray
}

if (-not $quizGenerated) {
    Write-Host "  ⚠️  Quiz generation timed out. Check logs:" -ForegroundColor Yellow
    Write-Host "     docker-compose logs quiz-worker" -ForegroundColor Gray
    Write-Host "     docker-compose logs notification-service" -ForegroundColor Gray
}

# Summary
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Document ID: $documentId" -ForegroundColor White
Write-Host "Document Status: $(if($processed){'✅ Processed'}else{'⏳ Processing'})" -ForegroundColor $(if($processed){'Green'}else{'Yellow'})
Write-Host "Quiz Generated: $(if($quizGenerated){'✅ Yes'}else{'⏳ Pending'})" -ForegroundColor $(if($quizGenerated){'Green'}else{'Yellow'})

Write-Host "`nCheck logs for details:" -ForegroundColor Yellow
Write-Host "  docker-compose logs -f document-worker" -ForegroundColor Gray
Write-Host "  docker-compose logs -f quiz-worker" -ForegroundColor Gray
Write-Host "  docker-compose logs -f notification-service" -ForegroundColor Gray

Write-Host "`nView notifications:" -ForegroundColor Yellow
Write-Host "  curl http://localhost:8003/api/notifications" -ForegroundColor Gray

Write-Host ""

