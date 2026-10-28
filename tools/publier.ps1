# Publie une nouvelle version : change la VERSION du service worker, puis commit et push.
# Les telephones prennent la nouvelle version a la prochaine ouverture de l'appli.
# Utilisation : powershell -ExecutionPolicy Bypass -File tools\publier.ps1 "Ce qui a change"
param([Parameter(Mandatory = $true)][string]$Message)

$racine = Split-Path -Parent $PSScriptRoot
$sw = Join-Path $racine 'sw.js'
$version = 'assimeto-' + (Get-Date -Format 'yyyyMMdd-HHmm')
$texte = [IO.File]::ReadAllText($sw) -replace "const VERSION = '[^']*'", "const VERSION = '$version'"
[IO.File]::WriteAllText($sw, $texte, (New-Object System.Text.UTF8Encoding $false))

git -C $racine add -A
git -C $racine commit -m $Message
git -C $racine push
Write-Host "Version publiee : $version (en ligne d'ici une minute)"
