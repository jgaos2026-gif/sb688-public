# ==========================================================
# OASIS CONTROL ROOM STARTER
# Reads section index and builds clickable room dashboard
# ==========================================================

$Root = "C:\JGA\OASIS\MASTER_BUSINESS_JOURNEY"
$Data = "$Root\data"
$Pages = "$Root\pages"
$Sections = "$Root\sections"
$Control = "$Root\CONTROL_ROOM.html"

New-Item -ItemType Directory -Force -Path $Data,$Pages,$Sections | Out-Null

$IndexFile = "$Data\MASTER_SECTION_INDEX.json"

if (!(Test-Path $IndexFile)) {
    Write-Host "MASTER INDEX MISSING - BUILDING NOW..." -ForegroundColor Yellow

    $Index = @()

    Get-ChildItem $Sections -Filter *.md | Sort-Object Name | ForEach-Object {
        $Index += [PSCustomObject]@{
            Number = $_.BaseName.Substring(0,3)
            Name = ($_.BaseName.Substring(4) -replace "_"," ")
            File = $_.FullName
            SizeKB = [Math]::Round($_.Length/1KB,2)
            LastModified = $_.LastWriteTime
        }
    }

    $Index | ConvertTo-Json -Depth 5 | Set-Content $IndexFile
}

$SectionsData = Get-Content $IndexFile -Raw | ConvertFrom-Json

$Cards = ""

foreach ($S in $SectionsData) {
    $SafeName = [System.Web.HttpUtility]::HtmlEncode($S.Name)
    $SafeNum  = [System.Web.HttpUtility]::HtmlEncode($S.Number)

    $Cards += @"
    <div class="card">
      <span class="num">$SafeNum</span>
      <span class="name">$SafeName</span>
    </div>
"@
}

@"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OASIS Control Room</title>
  <style>
    body { font-family: sans-serif; background: #0a0a0a; color: #e0e0e0; margin: 0; padding: 1rem; }
    h1 { text-align: center; color: #00ffd0; letter-spacing: 2px; }
    .grid { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
    .card { background: #1a1a2e; border: 1px solid #00ffd0; border-radius: 6px; padding: 0.5rem 0.8rem;
            min-width: 180px; max-width: 240px; cursor: pointer; transition: background 0.2s; }
    .card:hover { background: #00ffd022; }
    .num { display: block; font-size: 0.7rem; color: #888; }
    .name { display: block; font-size: 0.85rem; font-weight: bold; }
  </style>
</head>
<body>
  <h1>&#9670; OASIS CONTROL ROOM &#9670;</h1>
  <div class="grid">
$Cards
  </div>
</body>
</html>
"@ | Set-Content $Control

Start-Process $Control

Write-Host ""
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host " OASIS CONTROL ROOM STARTED" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host "Control Room: $Control" -ForegroundColor Cyan
Write-Host ""
