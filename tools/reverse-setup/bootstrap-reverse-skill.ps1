# Bootstrap reverse-skill + enhance capture for appv6.ladipage.com
# Run with: rtk powershell -ExecutionPolicy Bypass -File tools/reverse-setup/bootstrap-reverse-skill.ps1
# IMPORTANT: This is RE-only, removable. Delete the whole tools/reverse-setup after project.

param(
    [string]$ReverseSkillPath = "D:\Tools\reverse-skill-ladipage-re"
)

Write-Host "=== REVERSE-SKILL BOOTSTRAP (rtk prefixed setup) ===" -ForegroundColor Cyan

# 1. Ensure external dir
if (-not (Test-Path "D:\Tools")) {
    New-Item -ItemType Directory -Path "D:\Tools" -Force | Out-Null
}

# 2. Clone if not exists (user must have rtk git available)
if (-not (Test-Path $ReverseSkillPath)) {
    Write-Host "Cloning reverse-skill to external location (removable)..."
    rtk git clone https://github.com/zhaoxuya520/reverse-skill.git $ReverseSkillPath --depth 1
} else {
    Write-Host "reverse-skill already at $ReverseSkillPath"
}

# 3. Refresh tool index
Push-Location $ReverseSkillPath
Write-Host "Refreshing tool index..."
rtk powershell -ExecutionPolicy Bypass -File skills/scripts/refresh-tool-index.ps1
Pop-Location

Write-Host @"
=== MCP Registration (manual step) ===
Add to your MCP config:
{
  "mcpServers": {
    "jshook": { "command": "npx", "args": ["-y", "@jshookmcp/jshook@latest"], "env": {"JSHOOK_BASE_PROFILE": "search"} },
    "anything-analyzer": { "url": "http://localhost:23816/mcp" }
  }
}
"@

Write-Host "=== Next: Run captures in cdp-reverse-engineer with rtk ===" -ForegroundColor Green
Write-Host "cd tools/cdp-reverse-engineer"
Write-Host "rtk npm run capture:phaseA:read"
Write-Host "rtk npm run capture:phaseB:mutations -- --headed"
Write-Host "... (see RE-SETUP-REMOVAL.md)"

Write-Host "To remove all RE artifacts later: see RE-SETUP-REMOVAL.md" -ForegroundColor Yellow
