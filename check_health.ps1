# Health Check Script for All Services
Write-Host "=== Cloud Platform Health Check ===" -ForegroundColor Cyan
Write-Host ""

# Define services with their health endpoints
$services = @(
    @{Name="User Service"; Port=8000; Path="/health"},
    @{Name="Aggregator"; Port=8080; Path="/health"},
    @{Name="Document Service"; Port=8002; Path="/health"},
    @{Name="Notification Service"; Port=8003; Path="/health"},
    @{Name="Quiz Service"; Port=8004; Path="/health"},
    @{Name="Chat Service"; Port=8005; Path="/health"},
    @{Name="TTS Service"; Port=8006; Path="/health"},
    @{Name="STT Service"; Port=8007; Path="/health"},
    @{Name="Frontend"; Port=3000; Path="/health"},
    @{Name="LocalStack"; Port=4566; Path="/_localstack/health"}
)

# Check Docker containers status
Write-Host "Docker Container Status:" -ForegroundColor Yellow
Write-Host "------------------------" -ForegroundColor Yellow
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""

# Check HTTP health endpoints
Write-Host "HTTP Health Endpoints:" -ForegroundColor Yellow
Write-Host "---------------------" -ForegroundColor Yellow

foreach ($service in $services) {
    $url = "http://localhost:$($service.Port)$($service.Path)"
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "[OK] $($service.Name) - HEALTHY" -ForegroundColor Green
        } else {
            Write-Host "[WARN] $($service.Name) - Status: $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[FAIL] $($service.Name) - UNREACHABLE" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Database Services:" -ForegroundColor Yellow
Write-Host "-----------------" -ForegroundColor Yellow

# Check PostgreSQL databases
$databases = @(
    @{Name="User DB"; Port=5432},
    @{Name="Document DB"; Port=5433},
    @{Name="Notification DB"; Port=5434},
    @{Name="Quiz DB"; Port=5435},
    @{Name="Chat DB"; Port=5436}
)

foreach ($db in $databases) {
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect("localhost", $db.Port)
        $tcpClient.Close()
        Write-Host "[OK] $($db.Name) (Port $($db.Port)) - LISTENING" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $($db.Name) (Port $($db.Port)) - NOT LISTENING" -ForegroundColor Red
    }
}

# Check MongoDB
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("localhost", 27017)
    $tcpClient.Close()
    Write-Host "[OK] MongoDB (Port 27017) - LISTENING" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] MongoDB (Port 27017) - NOT LISTENING" -ForegroundColor Red
}

Write-Host ""
Write-Host "Message Queue:" -ForegroundColor Yellow
Write-Host "-------------" -ForegroundColor Yellow

# Check Kafka
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("localhost", 29092)
    $tcpClient.Close()
    Write-Host "[OK] Kafka (Port 29092) - LISTENING" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Kafka (Port 29092) - NOT LISTENING" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Health Check Complete ===" -ForegroundColor Cyan
