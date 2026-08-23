$ErrorActionPreference = "Stop"

Write-Host "=== Published host ports ==="
$rows = @()
$containers = docker ps --format "{{.Names}}"
foreach ($name in $containers) {
  $bindingsJson = docker inspect $name --format '{{json .HostConfig.PortBindings}}'
  if (-not $bindingsJson -or $bindingsJson -eq "null" -or $bindingsJson -eq "{}") { continue }
  $rows += [PSCustomObject]@{ Name = $name; Bindings = $bindingsJson }
}
if ($rows.Count -eq 0) {
  Write-Host "No published host ports."
} else {
  $rows | Format-Table -AutoSize
}

Write-Host ""
Write-Host "Expected Liora core host ports in DEV: 7001 (Nest Admin), 7002 (LadiPage)."
Write-Host "PostgreSQL 5432, Redis 6379 and worker ports should be internal-only unless docker-compose.debug.yml is layered in."
