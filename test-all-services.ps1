# Comprehensive Service Testing Script
# Tests all services in the cloud learning platform

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cloud Learning Platform - Service Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost"
$results = @()

function Test-Service {
    param(
        [string]$ServiceName,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [hashtable]$Headers = $null
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
            $params.ContentType = "application/json"
        }
        
        if ($Headers) {
            $params.Headers = $Headers
        }
        
        $response = Invoke-RestMethod @params
        $status = "✅ PASS"
        $message = "Service responded successfully"
        if ($response) {
            $message += " | Response: $($response | ConvertTo-Json -Compress)"
        }
    }
    catch {
        $status = "❌ FAIL"
        $message = "Error: $($_.Exception.Message)"
    }
    
    Write-Host "$status - $ServiceName" -ForegroundColor $(if ($status -like "*PASS*") { "Green" } else { "Red" })
    Write-Host "  URL: $Url" -ForegroundColor Gray
    Write-Host "  $message" -ForegroundColor Gray
    Write-Host ""
    
    return @{
        Service = $ServiceName
        Status = $status
        Message = $message
        Url = $Url
    }
}

# Test 1: Document Service Health
Write-Host "=== Document Service ===" -ForegroundColor Yellow
$results += Test-Service -ServiceName "Document Service Health" -Url "http://localhost:8002/health"

# Test 2: Quiz Service Health
Write-Host "=== Quiz Service ===" -ForegroundColor Yellow
$results += Test-Service -ServiceName "Quiz Service Health" -Url "http://localhost:8004/health"

# Test 3: Chat Service Health
Write-Host "=== Chat Service ===" -ForegroundColor Yellow
$results += Test-Service -ServiceName "Chat Service Health" -Url "http://localhost:8005/health"

# Test 4: TTS Service Health
Write-Host "=== TTS Service ===" -ForegroundColor Yellow
$results += Test-Service -ServiceName "TTS Service Health" -Url "http://localhost:8006/health"

# Test 5: STT Service Health
Write-Host "=== STT Service ===" -ForegroundColor Yellow
$results += Test-Service -ServiceName "STT Service Health" -Url "http://localhost:8007/health"

# Test 6: API Gateway
Write-Host "=== API Gateway ===" -ForegroundColor Yellow
$results += Test-Service -ServiceName "API Gateway Health" -Url "$baseUrl/health"

# Test 7: Document Upload (requires auth - will fail but shows endpoint exists)
Write-Host "=== Document Upload Test ===" -ForegroundColor Yellow
$pdfPath = "C:\Users\ahmed\Downloads\CSE211_Lecture_1(2).pdf"
if (Test-Path $pdfPath) {
    try {
        $fileBytes = [System.IO.File]::ReadAllBytes($pdfPath)
        $boundary = [System.Guid]::NewGuid().ToString()
        $fileContent = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes)
        $fileName = "CSE211_Lecture_1(2).pdf"
        
        $bodyLines = @(
            "--$boundary",
            "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
            "Content-Type: application/pdf",
            "",
            $fileContent,
            "--$boundary--"
        )
        $body = $bodyLines -join "`r`n"
        
        $response = Invoke-WebRequest -Uri "http://localhost:8002/api/documents/upload" `
            -Method POST `
            -ContentType "multipart/form-data; boundary=$boundary" `
            -Body ([System.Text.Encoding]::GetEncoding("iso-8859-1").GetBytes($body)) `
            -ErrorAction Stop
        
        $status = "✅ PASS"
        $message = "Document upload endpoint accessible (auth required)"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
            $status = "⚠️  AUTH REQUIRED"
            $message = "Endpoint exists but requires authentication (expected)"
        }
        else {
            $status = "❌ FAIL"
            $message = "Error: $($_.Exception.Message)"
        }
    }
    
    Write-Host "$status - Document Upload" -ForegroundColor $(if ($status -like "*PASS*" -or $status -like "*AUTH*") { "Yellow" } else { "Red" })
    Write-Host "  $message" -ForegroundColor Gray
    Write-Host ""
    
    $results += @{
        Service = "Document Upload"
        Status = $status
        Message = $message
        Url = "http://localhost:8002/api/documents/upload"
    }
}
else {
    Write-Host "⚠️  SKIP - PDF file not found at: $pdfPath" -ForegroundColor Yellow
    Write-Host ""
}

# Test 8: Quiz Service - List Quizzes (if available)
Write-Host "=== Quiz Service Endpoints ===" -ForegroundColor Yellow
$results += Test-Service -ServiceName "Quiz Service - List Quizzes" -Url "http://localhost:8004/api/quizzes" -Headers @{"Authorization" = "Bearer test"}

# Test 9: Chat Service - Send Message (requires auth)
Write-Host "=== Chat Service Endpoints ===" -ForegroundColor Yellow
$chatBody = @{
    message = "Hello, this is a test message"
}
$results += Test-Service -ServiceName "Chat Service - Send Message" -Url "http://localhost:8005/api/chat/message" -Method POST -Body $chatBody -Headers @{"Authorization" = "Bearer test"}

# Test 10: TTS Service - Generate Audio
Write-Host "=== TTS Service Endpoints ===" -ForegroundColor Yellow
$ttsBody = @{
    text = "This is a test text to speech conversion"
    voice = "default"
}
$results += Test-Service -ServiceName "TTS Service - Generate Audio" -Url "http://localhost:8006/api/tts/synthesize" -Method POST -Body $ttsBody

# Test 11: STT Service - Transcribe (requires file)
Write-Host "=== STT Service Endpoints ===" -ForegroundColor Yellow
$results += Test-Service -ServiceName "STT Service Health" -Url "http://localhost:8007/api/stt/health"

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passed = ($results | Where-Object { $_.Status -like "*PASS*" }).Count
$failed = ($results | Where-Object { $_.Status -like "*FAIL*" }).Count
$authRequired = ($results | Where-Object { $_.Status -like "*AUTH*" }).Count

Write-Host "Total Tests: $($results.Count)" -ForegroundColor White
Write-Host "✅ Passed: $passed" -ForegroundColor Green
Write-Host "❌ Failed: $failed" -ForegroundColor Red
Write-Host "⚠️  Auth Required: $authRequired" -ForegroundColor Yellow
Write-Host ""

Write-Host "Detailed Results:" -ForegroundColor Cyan
$results | ForEach-Object {
    Write-Host "  $($_.Service): $($_.Status)" -ForegroundColor $(if ($_.Status -like "*PASS*") { "Green" } elseif ($_.Status -like "*AUTH*") { "Yellow" } else { "Red" })
}

