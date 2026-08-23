$ErrorActionPreference = "Stop"

Write-Host "=== Build Nest Admin production image ==="
docker build -f apps/nest-admin-backend/Dockerfile --target production -t liora-nest-admin:final .
if ($LASTEXITCODE -ne 0) { throw "Nest Admin production build failed" }

docker run --rm --entrypoint sh liora-nest-admin:final -c "test -f /app/dist/main.js && test -f /app/dist/package.json && test -f /app/dist/pnpm-lock.yaml && test -d /app/dist/node_modules"
if ($LASTEXITCODE -ne 0) { throw "Nest Admin artifact validation failed" }
Write-Host "[PASS] Nest Admin production artifacts"

Write-Host ""
Write-Host "=== Build LadiPage API production image ==="
docker build -f apps/ladipage-backend/Dockerfile --target production-api -t liora-ladipage-api:final .
if ($LASTEXITCODE -ne 0) { throw "LadiPage API production build failed" }

docker run --rm --entrypoint sh liora-ladipage-api:final -c "test -f /app/dist/main.js && test -f /app/dist/worker.main.js && test -f /app/dist/package.json && test -f /app/dist/pnpm-lock.yaml && test -d /app/dist/node_modules && test -x /app/dist/node_modules/.bin/unlighthouse-ci && test -d /app/dist/test/contract/fixtures"
if ($LASTEXITCODE -ne 0) { throw "LadiPage API artifact validation failed" }
Write-Host "[PASS] LadiPage API production artifacts"

Write-Host ""
Write-Host "=== Build LadiPage worker production image ==="
docker build -f apps/ladipage-backend/Dockerfile --target production-worker -t liora-ladipage-worker:final .
if ($LASTEXITCODE -ne 0) { throw "LadiPage worker production build failed" }

docker run --rm --entrypoint sh liora-ladipage-worker:final -c "test -f /app/dist/worker.main.js && test -d /app/dist/node_modules"
if ($LASTEXITCODE -ne 0) { throw "LadiPage worker artifact validation failed" }
Write-Host "[PASS] LadiPage worker production artifacts"

Write-Host ""
Write-Host "=== Final image sizes ==="
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | Select-String "liora-(nest-admin|ladipage-api|ladipage-worker)"
