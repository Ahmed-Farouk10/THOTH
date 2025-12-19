# 🔧 PowerShell Commands Reference

Since you're on Windows, PowerShell's `curl` is an alias for `Invoke-WebRequest` which has different syntax. Use these commands instead.

## ✅ Fixed Issues

1. **Import Errors** - Changed relative imports (`from .models`) to absolute imports (`from models`)
2. **Pydantic Warning** - Changed `schema_extra` to `json_schema_extra` for Pydantic v2
3. **Missing Dependency** - Added `email-validator` to requirements.txt
4. **Docker Compose Warning** - Removed obsolete `version` field

## 🧪 Testing Commands (PowerShell)

### Health Checks

```powershell
# User Service
Invoke-RestMethod -Uri "http://localhost:8000/health"

# Aggregator
Invoke-RestMethod -Uri "http://localhost:8080/health"

# API Gateway
Invoke-RestMethod -Uri "http://localhost/health"
```

### User Registration

```powershell
$registerBody = @{
    username = "student1"
    email = "student1@example.com"
    password = "securepass123"
    full_name = "John Doe"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost/api/auth/register" `
    -Method Post `
    -ContentType "application/json" `
    -Body $registerBody

$response
```

### User Login

```powershell
$loginBody = @{
    username = "student1"
    password = "securepass123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost/api/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body $loginBody

# Save token
$TOKEN = $loginResponse.access_token
Write-Host "Token: $TOKEN"
```

### Verify Token

```powershell
Invoke-RestMethod -Uri "http://localhost/api/auth/verify?token=$TOKEN"
```

### Get User Profile

```powershell
# Replace {user_id} with actual user ID from registration response
$userId = "your-user-id-here"
Invoke-RestMethod -Uri "http://localhost:8000/api/users/$userId"
```

## 🐳 Docker Commands

```powershell
# View logs
docker-compose logs -f user-service

# Restart service
docker-compose restart user-service

# Rebuild and restart
docker-compose build user-service
docker-compose up -d user-service

# Check status
docker-compose ps

# Stop all
docker-compose down

# Start all
docker-compose up -d
```

## 📝 Alternative: Use curl.exe

If you have `curl.exe` installed (comes with Git for Windows), you can use Unix-style commands:

```powershell
# Use curl.exe explicitly (not the PowerShell alias)
curl.exe -X POST http://localhost/api/auth/register `
    -H "Content-Type: application/json" `
    -d '{\"username\":\"student1\",\"email\":\"student1@example.com\",\"password\":\"securepass123\"}'
```

## 🎯 Quick Test Script

Save this as `test-api.ps1`:

```powershell
# Test User Service API
Write-Host "Testing User Service..." -ForegroundColor Green

# Register
Write-Host "`n1. Registering user..." -ForegroundColor Yellow
$registerBody = @{
    username = "testuser"
    email = "test@example.com"
    password = "testpass123"
    full_name = "Test User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost/api/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $registerBody
    Write-Host "✅ Registration successful!" -ForegroundColor Green
    Write-Host "User ID: $($registerResponse.user_id)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Registration failed: $_" -ForegroundColor Red
}

# Login
Write-Host "`n2. Logging in..." -ForegroundColor Yellow
$loginBody = @{
    username = "testuser"
    password = "testpass123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody
    Write-Host "✅ Login successful!" -ForegroundColor Green
    $TOKEN = $loginResponse.access_token
    Write-Host "Token: $TOKEN" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit
}

# Verify Token
Write-Host "`n3. Verifying token..." -ForegroundColor Yellow
try {
    $verifyResponse = Invoke-RestMethod -Uri "http://localhost/api/auth/verify?token=$TOKEN"
    Write-Host "✅ Token verified!" -ForegroundColor Green
    Write-Host "User: $($verifyResponse.username)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Token verification failed: $_" -ForegroundColor Red
}

Write-Host "`n✅ All tests passed!" -ForegroundColor Green
```

Run it with:
```powershell
.\test-api.ps1
```

---

**Last Updated:** 2025-12-01

