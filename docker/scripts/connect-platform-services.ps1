$ErrorActionPreference = "Stop"

$network = if ($env:LIORA_PLATFORM_NETWORK) { $env:LIORA_PLATFORM_NETWORK } else { "liora-platform" }

$existingNetwork = docker network ls --filter "name=^$network$" --format "{{.Name}}"
if ($existingNetwork -ne $network) {
  docker network create $network | Out-Null
  Write-Host "Created Docker network: $network"
}

$targets = @(
  @{ Container = "libredesk_app"; Alias = "libredesk-app" },
  @{ Container = "libredesk_zalo_connector"; Alias = "zalo-connector" },
  @{ Container = "libredesk_facebook_connector"; Alias = "facebook-connector" },
  @{ Container = "liora-9router"; Alias = "9router" }
)

foreach ($target in $targets) {
  $name = $target.Container
  $alias = $target.Alias

  $exists = docker ps -a --filter "name=^/$name$" --format "{{.Names}}"
  if ($exists -ne $name) {
    Write-Host "Skip $name (container not found)"
    continue
  }

  $attached = docker inspect -f "{{if index .NetworkSettings.Networks \"$network\"}}yes{{else}}no{{end}}" $name 2>$null
  if ($attached -eq "yes") {
    Write-Host "$name already attached to $network"
    continue
  }

  docker network connect --alias $alias $network $name
  Write-Host "Connected $name -> $network (alias: $alias)"
}

Write-Host ""
Write-Host "Members of ${network}:"
docker network inspect $network --format '{{range .Containers}}{{.Name}}{{println}}{{end}}'
