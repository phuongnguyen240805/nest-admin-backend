$ErrorActionPreference = "Stop"

function Assert-HttpOk([string]$Name, [string]$Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 15
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
      throw "$Name returned HTTP $($response.StatusCode)"
    }
    Write-Host "[PASS] $Name -> $Url"
  } catch {
    Write-Host "[FAIL] $Name -> $Url"
    throw
  }
}

Assert-HttpOk "Nest Admin" "http://127.0.0.1:7001/docs/json"
Assert-HttpOk "LadiPage readiness" "http://127.0.0.1:7002/api/health/ready"

$redis = docker exec liora-redis-dev redis-cli ping
if (($redis | Out-String).Trim() -ne "PONG") { throw "Redis ping failed: $redis" }
Write-Host "[PASS] Redis -> PONG"

$dbUser = if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "postgres" }
$dbName = if ($env:DB_DATABASE) { $env:DB_DATABASE } else { "liora_db" }
docker exec liora-postgres-dev pg_isready -U $dbUser -d $dbName | Out-Host
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL pg_isready failed" }
Write-Host "[PASS] PostgreSQL ready"

$workerHealth = docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' liora-ladipage-worker-dev
if ($workerHealth -notin @("healthy", "running")) { throw "Worker state is $workerHealth" }
Write-Host "[PASS] LadiPage worker -> $workerHealth"
