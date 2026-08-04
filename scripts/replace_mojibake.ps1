$files = Get-ChildItem -Path src -Include *.ts,*.tsx,*.js,*.jsx,*.html,*.md -Recurse
foreach ($f in $files) {
  $p = $f.FullName
  try {
    $s = Get-Content -LiteralPath $p -Raw -ErrorAction Stop
    if ($s -match 'â‚¹') {
      $ns = $s -replace 'â‚¹','₹'
      Set-Content -LiteralPath $p -Value $ns -Encoding UTF8
      Write-Output "Replaced in: $p"
    }
  } catch { }
}
