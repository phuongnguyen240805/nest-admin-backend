$ErrorActionPreference = "Continue"

Write-Host "=== Liora compose status ==="
docker compose -f docker/docker-compose.yml ps

Write-Host ""
Write-Host "=== Liora host/internal ports ==="
docker ps --filter "name=liora-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host ""
Write-Host "=== Liora CPU/RAM ==="
docker stats --no-stream --filter "name=liora-" --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.PIDs}}"

$network = if ($env:LIORA_PLATFORM_NETWORK) { $env:LIORA_PLATFORM_NETWORK } else { "liora-platform" }
$exists = docker network ls --filter "name=^$network$" --format "{{.Name}}"
if ($exists -eq $network) {
  Write-Host ""
  Write-Host "=== $network members ==="
  docker network inspect $network --format '{{range .Containers}}{{.Name}}{{println}}{{end}}'
}
