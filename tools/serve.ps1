# Petit serveur local pour tester ASSIMETO sur le PC, sans rien installer.
# Utilisation : powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8124]
param(
  [int]$Port = 8124,
  [string]$Racine = (Split-Path -Parent $PSScriptRoot)
)

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.png' = 'image/png'
  '.svg' = 'image/svg+xml'
  '.md' = 'text/plain; charset=utf-8'
}

$racinePleine = [IO.Path]::GetFullPath($Racine)
$http = [System.Net.HttpListener]::new()
$http.Prefixes.Add("http://localhost:$Port/")
$http.Start()
Write-Host "ASSIMETO : http://localhost:$Port/  (Ctrl+C pour arreter)"

try {
  while ($http.IsListening) {
    $ctx = $http.GetContext()
    $rep = $ctx.Response
    try {
      $chemin = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($chemin -eq '' -or $chemin.EndsWith('/')) { $chemin += 'index.html' }
      $fichier = [IO.Path]::GetFullPath((Join-Path $racinePleine $chemin))
      $rep.Headers.Add('Cache-Control', 'no-cache')
      if ($fichier.StartsWith($racinePleine) -and (Test-Path -LiteralPath $fichier -PathType Leaf)) {
        $octets = [IO.File]::ReadAllBytes($fichier)
        $type = $types[[IO.Path]::GetExtension($fichier).ToLower()]
        $rep.ContentType = if ($type) { $type } else { 'application/octet-stream' }
        $rep.ContentLength64 = $octets.Length
        $rep.OutputStream.Write($octets, 0, $octets.Length)
      } else {
        $rep.StatusCode = 404
      }
    } catch {
      $rep.StatusCode = 500
    } finally {
      $rep.Close()
    }
  }
} finally {
  $http.Stop()
}
