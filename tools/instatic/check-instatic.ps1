# Run from PowerShell while Instatic + Nest + FE are up.
# Diagnoses the "Not found" confusion chain for Ladipage + Instatic.
$ErrorActionPreference = "Continue"

function Show-Result($label, $ok, $detail) {
  if ($ok) {
    Write-Host "OK   $label  $detail" -ForegroundColor Green
  } else {
    Write-Host "FAIL $label  $detail" -ForegroundColor Red
  }
}

function Try-Get($url, $timeoutSec = 5) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec
    return @{ Ok = $true; Code = [int]$r.StatusCode; Body = $r.Content; Headers = $r.Headers }
  } catch {
    $code = $null
    $body = ""
    try { $code = [int]$_.Exception.Response.StatusCode.value__ } catch {}
    try {
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
      }
    } catch {}
    return @{ Ok = $false; Code = $code; Body = $body; Error = "$_" }
  }
}

function Try-PostJson($url, $json, $timeoutSec = 5) {
  try {
    $r = Invoke-RestMethod -Method POST -Uri $url -ContentType "application/json" `
      -Body $json -TimeoutSec $timeoutSec
    return @{ Ok = $true; Data = $r }
  } catch {
    return @{ Ok = $false; Error = "$_" }
  }
}

Write-Host "`n========== 1) Instatic direct (must PASS) ==========" -ForegroundColor Cyan
$h = Try-Get "http://127.0.0.1:8787/health"
Show-Result "CMS /health" ($h.Ok -and $h.Code -eq 200) "$(if($h.Body){$h.Body}else{$h.Error})"

$st = Try-Get "http://127.0.0.1:8787/admin/api/cms/setup/status"
Show-Result "setup/status" ($st.Ok -and $st.Code -eq 200) "$(if($st.Body){$st.Body}else{$st.Error})"

$sso = Try-Get "http://127.0.0.1:8787/admin/api/cms/auth/ladipage-sso?token=bad"
# Expected: 401 Invalid SSO token — route EXISTS. 404 = old Instatic without SSO code.
$ssoOk = (-not $sso.Ok) -and ($sso.Code -eq 401) -and ($sso.Body -match "Invalid SSO|token")
Show-Result "SSO route (bad token => 401)" $ssoOk "HTTP $($sso.Code) $($sso.Body)"
if ($sso.Code -eq 404) {
  Write-Host "     => Restart Instatic from latest code (ladipageSso.ts wired in auth.ts)." -ForegroundColor Yellow
}

$ep = Try-PostJson "http://127.0.0.1:8787/admin/api/cms/ladipage/ensure-page" '{"siteKey":"ws","pageKey":"p1"}'
Show-Result "ensure-page POST" $ep.Ok "$(if($ep.Ok){$ep.Data | ConvertTo-Json -Compress}else{$ep.Error})"
if (-not $ep.Ok) {
  Write-Host "     => Restart Instatic AFTER ladipageBridge.ts is on disk." -ForegroundColor Yellow
}

$vite = Try-Get "http://127.0.0.1:5174/" 3
Show-Result "Vite :5174" $vite.Ok "HTTP $($vite.Code) (SPA for /admin rewrite)"
if (-not $vite.Ok) {
  Write-Host "     => bun run dev must start BOTH CMS:8787 and Vite:5174." -ForegroundColor Yellow
}

Write-Host "`n========== 2) Nest BE (do NOT use /api/health) ==========" -ForegroundColor Cyan
Write-Host "Wrong:  GET http://localhost:7002/api/health     => Nest 404 NotFound" -ForegroundColor DarkYellow
Write-Host "Right:  GET http://localhost:7002/api/health/ready" -ForegroundColor DarkYellow
Write-Host "Right:  GET http://localhost:7002/api/landing-cms/health" -ForegroundColor DarkYellow

$ready = Try-Get "http://127.0.0.1:7002/api/health/ready"
Show-Result "Nest /api/health/ready" ($ready.Ok -and $ready.Code -eq 200) "$(if($ready.Body){$ready.Body}else{$ready.Error})"

$lch = Try-Get "http://127.0.0.1:7002/api/landing-cms/health"
Show-Result "Nest landing-cms/health" ($lch.Ok -and $lch.Code -eq 200) "$(if($lch.Body){$lch.Body.Substring(0,[Math]::Min(200,$lch.Body.Length))}else{$lch.Error})"
if ($lch.Ok -and $lch.Body -match '"ok"\s*:\s*false') {
  Write-Host "     => Nest cannot reach Instatic. Docker Nest needs:" -ForegroundColor Yellow
  Write-Host "        INSTATIC_BASE_URL=http://host.docker.internal:8787" -ForegroundColor Yellow
  Write-Host "        INSTATIC_MOCK=false  + rebuild/restart container" -ForegroundColor Yellow
}
if (-not $lch.Ok -and $lch.Code -eq 401) {
  Write-Host "     => Old Nest still requires JWT on health — rebuild with LandingCmsHealthController." -ForegroundColor Yellow
}

$wrong = Try-Get "http://127.0.0.1:7002/api/health"
if (-not $wrong.Ok -and $wrong.Code -eq 404) {
  Write-Host "NOTE /api/health is 404 by design (route missing). Use /api/health/ready." -ForegroundColor DarkGray
}

Write-Host "`n========== 3) FE same-origin rewrite :3000 ==========" -ForegroundColor Cyan
$feApi = Try-Get "http://localhost:3000/admin/api/cms/setup/status"
Show-Result "FE proxy setup/status" ($feApi.Ok -and $feApi.Code -eq 200) "$(if($feApi.Body){$feApi.Body}else{$feApi.Error})"
if (-not $feApi.Ok) {
  if ($feApi.Code -eq 404) {
    Write-Host "     => Restart FE after next.config rewrites (defaults 8787/5174)." -ForegroundColor Yellow
  } else {
    Write-Host "     => Start FE: cd ladipage-fe-v2; pnpm dev" -ForegroundColor Yellow
  }
}

$feSso = Try-Get "http://localhost:3000/admin/api/cms/auth/ladipage-sso?token=bad"
$feSsoOk = (-not $feSso.Ok) -and ($feSso.Code -eq 401)
Show-Result "FE proxy SSO (bad => 401)" $feSsoOk "HTTP $($feSso.Code) $($feSso.Body)"

$feAdmin = Try-Get "http://localhost:3000/admin"
$feAdminOk = $feAdmin.Ok -and ($feAdmin.Body -match "importmap|instatic|Admin")
Show-Result "FE /admin SPA" $feAdminOk "HTTP $($feAdmin.Code) (must be Instatic HTML, not Next 404 page)"

Write-Host "`n========== 4) Env checklist ==========" -ForegroundColor Cyan
Write-Host "Nest Docker:  INSTATIC_BASE_URL=http://host.docker.internal:8787"
Write-Host "Nest native:  INSTATIC_BASE_URL=http://127.0.0.1:8787"
Write-Host "Shared:       INSTATIC_SSO_SECRET=local-sso-change-me  (Nest + Instatic)"
Write-Host "FE:           NEXT_PUBLIC_LANDING_EDITOR=instatic"
Write-Host "FE:           NEXT_PUBLIC_INSTATIC_EDITOR_ORIGIN=http://localhost:3000"
Write-Host "FE:           INSTATIC_REWRITE_TARGET_CMS=http://127.0.0.1:8787"
Write-Host "FE:           INSTATIC_REWRITE_TARGET_VITE=http://127.0.0.1:5174"

Write-Host "`n========== 5) CSRF / save origin (common Save/Publish break) ==========" -ForegroundColor Cyan
Write-Host "Browser Origin is http://localhost:3000; CMS Host is :8787."
Write-Host "After Instatic restart with PUBLIC_ORIGIN + allowlist :3000:"
Write-Host "  DevTools → Network → PUT site-document / POST publish must NOT be 403 invalid origin."
Write-Host "See docs/landing/instatic-editor-ops-trace.md"

Write-Host "`n========== 6) Product E2E (browser) ==========" -ForegroundColor Cyan
Write-Host "1. Login Ladipage only (http://localhost:3000)"
Write-Host "2. Open editor from list -> new tab /ladipage?pageId=..."
Write-Host "3. Tab navigates to /admin/api/cms/auth/ladipage-sso?token=... then /admin/site"
Write-Host "4. Canvas loads; list tab stays on list (no parent navigation)"
Write-Host "5. Edit → Save → Network PUT .../site-document = 200 (not 403)"
Write-Host "6. Publish → Network POST .../publish = 200 (not 403)"
Write-Host ""
Write-Host "If browser shows JSON {""error"":""Not found""} => hit Instatic without route (old process)."
Write-Host "If Nest Swagger 404 on /api/health => wrong path; use /api/health/ready."
Write-Host "editor_data Supabase column is NOT synced yet (Instatic has its own draft DB)."
Write-Host ""
