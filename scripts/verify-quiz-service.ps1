# Quiz Service Verification Script (PowerShell)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Quiz Service Structure Verification" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$missingFiles = 0

# Check file structure
Write-Host "`n[FILE STRUCTURE] Checking files..." -ForegroundColor Yellow

function Check-File {
    param($path)
    if (Test-Path $path) {
        Write-Host "  ✅ $path" -ForegroundColor Green
    } else {
        Write-Host "  ❌ MISSING: $path" -ForegroundColor Red
        $script:missingFiles++
    }
}

Check-File "platform/quiz-service/Dockerfile"
Check-File "platform/quiz-service/requirements.txt"
Check-File "platform/quiz-service/src/__init__.py"
Check-File "platform/quiz-service/src/main.py"
Check-File "platform/quiz-service/src/worker.py"
Check-File "platform/quiz-service/src/database.py"
Check-File "platform/quiz-service/src/models.py"
Check-File "platform/quiz-service/src/schemas.py"
Check-File "platform/quiz-service/src/services/__init__.py"
Check-File "platform/quiz-service/src/services/kafka_service.py"
Check-File "platform/quiz-service/src/services/s3_service.py"
Check-File "platform/quiz-service/src/services/ai_service.py"

if ($missingFiles -eq 0) {
    Write-Host "`n✅ All required files present!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Missing $missingFiles file(s)" -ForegroundColor Red
    exit 1
}

# Check requirements.txt
Write-Host "`n[REQUIREMENTS] Checking requirements.txt..." -ForegroundColor Yellow
$requirements = Get-Content "platform/quiz-service/requirements.txt" -Raw
if ($requirements -match "langchain") {
    Write-Host "  ⚠️  WARNING: LangChain found in requirements.txt (should be removed)" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ No LangChain dependencies (lightweight)" -ForegroundColor Green
}

if ($requirements -match "httpx") {
    Write-Host "  ✅ httpx found (correct)" -ForegroundColor Green
} else {
    Write-Host "  ❌ httpx not found in requirements.txt" -ForegroundColor Red
}

# Check docker-compose.yml
Write-Host "`n[DOCKER COMPOSE] Checking docker-compose.yml..." -ForegroundColor Yellow
$compose = Get-Content "docker-compose.yml" -Raw
if ($compose -match "quiz-service:") {
    Write-Host "  ✅ quiz-service found in docker-compose.yml" -ForegroundColor Green
} else {
    Write-Host "  ❌ quiz-service not found in docker-compose.yml" -ForegroundColor Red
}

if ($compose -match "quiz-worker:") {
    Write-Host "  ✅ quiz-worker found in docker-compose.yml" -ForegroundColor Green
} else {
    Write-Host "  ❌ quiz-worker not found in docker-compose.yml" -ForegroundColor Red
}

# Check environment variables
Write-Host "`n[ENV VARS] Checking environment variables..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "HUGGINGFACE_API_KEY") {
        Write-Host "  ✅ HUGGINGFACE_API_KEY found in .env" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  WARNING: HUGGINGFACE_API_KEY not found in .env" -ForegroundColor Yellow
        Write-Host "     (Will use environment variable from docker-compose.yml)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠️  .env file not found (will use environment variables from docker-compose.yml)" -ForegroundColor Yellow
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "Verification Complete!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Ensure HUGGINGFACE_API_KEY is set (in .env or environment)" -ForegroundColor White
Write-Host "2. Build: docker-compose build quiz-service quiz-worker" -ForegroundColor White
Write-Host "3. Start: docker-compose up -d quiz-service quiz-worker" -ForegroundColor White
Write-Host "4. Check logs: docker-compose logs -f quiz-worker" -ForegroundColor White
Write-Host ""

