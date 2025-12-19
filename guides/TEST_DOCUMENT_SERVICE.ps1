# Test Document Service Integration
# This script tests the document service after integration

Write-Host "`n📄 Testing Document Service Integration..." -ForegroundColor Cyan

# Step 1: Login and get token
Write-Host "`n1. Logging in..." -ForegroundColor Yellow
$loginBody = @{
    username = "student1"
    password = "securepass123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody
    
    $TOKEN = $loginResponse.access_token
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "   Token: $($TOKEN.Substring(0,50))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    Write-Host "   Make sure user-service is running and user exists" -ForegroundColor Yellow
    exit
}

# Step 2: Check document service health
Write-Host "`n2. Checking document service health..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:8002/health" -Method Get
    Write-Host "✅ Document service is healthy!" -ForegroundColor Green
    Write-Host "   Status: $($healthResponse.status)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Document service health check failed: $_" -ForegroundColor Yellow
    Write-Host "   Service may still be starting..." -ForegroundColor Gray
}

# Step 3: List documents (should be empty initially)
Write-Host "`n3. Listing documents..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $TOKEN"
}

try {
    $documentsResponse = Invoke-RestMethod -Uri "http://localhost/api/documents" `
        -Method Get `
        -Headers $headers
    
    Write-Host "✅ Documents listed successfully!" -ForegroundColor Green
    Write-Host "   Count: $($documentsResponse.count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to list documents: $_" -ForegroundColor Red
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   JWT authentication failed - check token" -ForegroundColor Yellow
    }
}

# Step 4: Test upload (create a test file)
Write-Host "`n4. Testing document upload..." -ForegroundColor Yellow
$testContent = "This is a test document for the learning platform.`nIt contains sample text to verify document processing works correctly."
$testFile = "test-document.txt"
$testContent | Out-File -FilePath $testFile -Encoding utf8

try {
    $boundary = [System.Guid]::NewGuid().ToString()
    $fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $testFile))
    $fileEnc = [System.Text.Encoding]::GetEncoding('UTF-8').GetString($fileBytes)
    
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$testFile`"",
        "Content-Type: text/plain",
        "",
        $testContent,
        "--$boundary--"
    )
    
    $body = $bodyLines -join "`r`n"
    $bodyBytes = [System.Text.Encoding]::GetEncoding('utf-8').GetBytes($body)
    
    $uploadResponse = Invoke-RestMethod -Uri "http://localhost/api/documents/upload" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "Content-Type" = "multipart/form-data; boundary=$boundary"
        } `
        -Body $bodyBytes
    
    Write-Host "✅ Document uploaded successfully!" -ForegroundColor Green
    Write-Host "   Document ID: $($uploadResponse.document_id)" -ForegroundColor Gray
    Write-Host "   Status: $($uploadResponse.status)" -ForegroundColor Gray
    Write-Host "   Message: $($uploadResponse.message)" -ForegroundColor Gray
    
    $DOCUMENT_ID = $uploadResponse.document_id
    
    # Clean up test file
    Remove-Item $testFile -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "❌ Upload failed: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Yellow
    }
    Remove-Item $testFile -ErrorAction SilentlyContinue
    exit
}

# Step 5: Check document status
if ($DOCUMENT_ID) {
    Write-Host "`n5. Checking document status..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    try {
        $docResponse = Invoke-RestMethod -Uri "http://localhost/api/documents/$DOCUMENT_ID" `
            -Method Get `
            -Headers $headers
        
        Write-Host "✅ Document retrieved!" -ForegroundColor Green
        Write-Host "   Status: $($docResponse.status)" -ForegroundColor Gray
        Write-Host "   Filename: $($docResponse.filename)" -ForegroundColor Gray
        Write-Host "   File size: $($docResponse.file_size) bytes" -ForegroundColor Gray
        
        if ($docResponse.status -eq "COMPLETED") {
            Write-Host "   ✅ Document processing completed!" -ForegroundColor Green
            if ($docResponse.s3_notes_url) {
                Write-Host "   Notes available: Yes" -ForegroundColor Gray
            }
        } else {
            Write-Host "   ⏳ Document still processing..." -ForegroundColor Yellow
            Write-Host "   Wait a few seconds and check again" -ForegroundColor Gray
        }
    } catch {
        Write-Host "❌ Failed to get document: $_" -ForegroundColor Red
    }
}

Write-Host "`n✅ Document Service Integration Test Complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Check Kafka topics: docker exec -it kafka kafka-topics --list --bootstrap-server localhost:9092" -ForegroundColor Gray
Write-Host "  2. Check worker logs: docker logs document-worker" -ForegroundColor Gray
Write-Host "  3. Check MinIO console: http://localhost:9001 (minioadmin/minioadmin)" -ForegroundColor Gray
Write-Host "  4. View document service logs: docker logs document-service" -ForegroundColor Gray

