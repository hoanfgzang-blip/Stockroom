param(
    [string]$BaseUrl = "http://127.0.0.1:5295"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")
$passed = 0
$failed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Path,
        [bool]$ExpectJson = $true
    )

    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl$Path" -UseBasicParsing -TimeoutSec 20

        if ($response.StatusCode -ne 200) {
            throw "Expected HTTP 200 but received $($response.StatusCode)."
        }

        if ($ExpectJson) {
            $null = $response.Content | ConvertFrom-Json
        }

        Write-Host "[PASS] $Name" -ForegroundColor Green
        $script:passed++
    }
    catch {
        Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "Testing WMS at $BaseUrl" -ForegroundColor Cyan

Test-Endpoint -Name "TC-01 Website loads" -Path "/" -ExpectJson $false
Test-Endpoint -Name "TC-02 Dashboard summary" -Path "/api/Dashboard/summary"
Test-Endpoint -Name "TC-03 Dashboard audit logs" -Path "/api/Dashboard/recent-audit-logs?count=10"
Test-Endpoint -Name "TC-04 Provinces" -Path "/api/Provinces"
Test-Endpoint -Name "TC-05 Locations" -Path "/api/Locations"
Test-Endpoint -Name "TC-06 Zones" -Path "/api/Zones"
Test-Endpoint -Name "TC-07 Employees" -Path "/api/Employees"
Test-Endpoint -Name "TC-08 Fleet" -Path "/api/Cars"
Test-Endpoint -Name "TC-09 Pallets" -Path "/api/Pallets"
Test-Endpoint -Name "TC-10 Sacks" -Path "/api/Sacks"
Test-Endpoint -Name "TC-11 Inbound orders" -Path "/api/InboundOrders"
Test-Endpoint -Name "TC-12 Outbound orders" -Path "/api/OutboundOrders"
Test-Endpoint -Name "TC-13 Inventory reservations" -Path "/api/InventoryReservations"
Test-Endpoint -Name "TC-14 Trips" -Path "/api/Trips"
Test-Endpoint -Name "TC-15 Audit logs" -Path "/api/AuditLogs"

Write-Host ""
Write-Host "Result: $passed passed, $failed failed." -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
