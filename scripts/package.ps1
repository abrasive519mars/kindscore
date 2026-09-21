# Builds the submission zip: the committed source (git archive of HEAD), the submission PDF and the
# two diagram PNGs. Asserts the result is under the form's 50 MB limit and contains no .env file.
#   pnpm package        (runs: pnpm docs:build first if the PDF is missing)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pdf = Join-Path $root "docs\submission\Kindscore-Submission.pdf"
if (-not (Test-Path $pdf)) { pnpm docs:build }

$stage = Join-Path $root "dist\kindscore-submission"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force (Join-Path $stage "kindscore-source") | Out-Null

git archive --format=tar HEAD | tar -x -C (Join-Path $stage "kindscore-source")
Copy-Item $pdf $stage
Copy-Item (Join-Path $root "docs\architecture.png") $stage
Copy-Item (Join-Path $root "docs\schema.png") $stage

$zip = Join-Path $root "dist\kindscore-submission.zip"
if (Test-Path $zip) { Remove-Item -Force $zip }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal

$envFiles = Get-ChildItem -Path $stage -Recurse -Force -Filter ".env*" | Where-Object { $_.Name -ne ".env.example" }
if ($envFiles) { throw "Refusing: environment files found in the package: $($envFiles.FullName -join ', ')" }
$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
if ($mb -ge 50) { throw "Refusing: zip is $mb MB (limit 50 MB)" }
Write-Output "kindscore-submission.zip — $mb MB, no environment files"
