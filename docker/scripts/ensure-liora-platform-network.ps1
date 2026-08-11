$ErrorActionPreference = "Stop"
$network = if ($env:LIORA_PLATFORM_NETWORK) { $env:LIORA_PLATFORM_NETWORK } else { "liora-platform" }
$existing = docker network ls --filter "name=^$network$" --format "{{.Name}}"
if ($existing -ne $network) {
  docker network create $network | Out-Null
  Write-Host "Created Docker network: $network"
} else {
  Write-Host "Docker network already exists: $network"
}
