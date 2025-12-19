# Continuous Service Health Monitoring Script
# This script monitors all cloud platform services and provides real-time status updates

param(
    [int]$IntervalSeconds = 60,
    [int]$DurationMinutes = 60,
    [switch]$Continuous
)

function Get-ServiceHealth {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Health Check - $timestamp" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    # Get container status
    $containers = docker compose ps --format json | ConvertFrom-Json
    
    # Categorize services
    $healthy = @()
    $unhealthy = @()
    $starting = @()
    $down = @()
    
    foreach ($container in $containers) {
        $service = $container.Service
        $status = $container.Status
        
        if ($status -match "Up.*\(healthy\)") {
            $healthy += $service
        }
        elseif ($status -match "Up.*\(unhealthy\)") {
            $unhealthy += $service
        }
        elseif ($status -match "Up.*\(health: starting\)") {
            $starting += $service
        }
        elseif ($status -match "Up") {
            # Running but no health check
            $healthy += $service
        }
        else {
            $down += $service
        }
    }
    
    # Display summary
    Write-Host "SUMMARY" -ForegroundColor Yellow
    Write-Host "-------" -ForegroundColor Yellow
    Write-Host "Healthy:  $($healthy.Count)" -ForegroundColor Green
    Write-Host "Starting: $($starting.Count)" -ForegroundColor Yellow
    Write-Host "Unhealthy: $($unhealthy.Count)" -ForegroundColor Red
    Write-Host "Down:     $($down.Count)" -ForegroundColor Red
    Write-Host ""
    
    # Show details if there are issues
    if ($starting.Count -gt 0) {
        Write-Host "STARTING:" -ForegroundColor Yellow
        $starting | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
        Write-Host ""
    }
    
    if ($unhealthy.Count -gt 0) {
        Write-Host "UNHEALTHY:" -ForegroundColor Red
        $unhealthy | ForEach-Object { 
            Write-Host "  - $_" -ForegroundColor Red
            # Show recent logs for unhealthy services
            Write-Host "    Recent logs:" -ForegroundColor Gray
            docker compose logs --tail=5 $_ 2>&1 | Select-Object -Last 5 | ForEach-Object {
                Write-Host "      $_" -ForegroundColor Gray
            }
        }
        Write-Host ""
    }
    
    if ($down.Count -gt 0) {
        Write-Host "DOWN:" -ForegroundColor Red
        $down | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        Write-Host ""
    }
    
    # Return status for alerting
    return @{
        Healthy = $healthy.Count
        Unhealthy = $unhealthy.Count
        Starting = $starting.Count
        Down = $down.Count
        Timestamp = $timestamp
    }
}

# Main monitoring loop
Write-Host "Starting Cloud Platform Health Monitor" -ForegroundColor Cyan
Write-Host "Interval: $IntervalSeconds seconds" -ForegroundColor Cyan

if ($Continuous) {
    Write-Host "Mode: Continuous (Press Ctrl+C to stop)" -ForegroundColor Cyan
    while ($true) {
        $status = Get-ServiceHealth
        Start-Sleep -Seconds $IntervalSeconds
    }
}
else {
    $endTime = (Get-Date).AddMinutes($DurationMinutes)
    Write-Host "Duration: $DurationMinutes minutes (until $($endTime.ToString('HH:mm:ss')))" -ForegroundColor Cyan
    
    $checkCount = 0
    while ((Get-Date) -lt $endTime) {
        $checkCount++
        $status = Get-ServiceHealth
        
        # Alert if critical issues
        if ($status.Down -gt 0 -or $status.Unhealthy -gt 2) {
            Write-Host "ALERT: Critical service issues detected!" -ForegroundColor Red -BackgroundColor Yellow
        }
        
        if ((Get-Date) -lt $endTime) {
            Write-Host "Next check in $IntervalSeconds seconds... (Check $checkCount)" -ForegroundColor Gray
            Start-Sleep -Seconds $IntervalSeconds
        }
    }
    
    Write-Host "`nMonitoring complete. Total checks: $checkCount" -ForegroundColor Cyan
}
