param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDataPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$builder = Join-Path $projectRoot 'scripts\build-public-results.ps1'
$temporaryRoot = [System.IO.Path]::GetFullPath((Join-Path ([System.IO.Path]::GetTempPath()) "tee-result-security-$([guid]::NewGuid())"))
[System.IO.Directory]::CreateDirectory($temporaryRoot) | Out-Null

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "Assertion failed: $Message" }
}

try {
  $safeOutput = Join-Path $temporaryRoot 'public-results.json'
  & $builder -InputPath $SourceDataPath -OutputPath $safeOutput
  $projection = Get-Content -LiteralPath $safeOutput -Raw -Encoding UTF8 | ConvertFrom-Json

  foreach ($property in $projection.PSObject.Properties) {
    $fields = @($property.Value.PSObject.Properties.Name)
    Assert-True ($fields -notcontains 'Email') 'Email leaked into public projection.'
    Assert-True ($fields -notcontains 'Student Mobile') 'Mobile leaked into public projection.'
    Assert-True ($fields -notcontains 'SSC Roll') 'Source roll field leaked into public projection.'
    Assert-True ($fields -contains 'status') 'Public result is missing status.'
    if ($property.Value.status -ne 'SELECTED') {
      Assert-True ($fields -notcontains 'name') 'Non-selected student name was unnecessarily published.'
    }
  }

  $duplicateInput = Join-Path $temporaryRoot 'duplicate.json'
  $duplicateJson = @'
[
  { "SSC Roll": "123456", "Unique ID": "TEE26-0001", "Student Name": "Student A", "Status": "SELECTED" },
  { "SSC Roll": "123456", "Unique ID": "TEE26-0002", "Student Name": "Student B", "Status": "WAITING" }
]
'@
  [System.IO.File]::WriteAllText($duplicateInput, $duplicateJson, [System.Text.UTF8Encoding]::new($false))
  $duplicateRejected = $false
  try {
    & $builder -InputPath $duplicateInput -OutputPath (Join-Path $temporaryRoot 'duplicate-output.json')
  } catch {
    $duplicateRejected = $_.Exception.Message -like '*Duplicate public identifier*'
  }
  Assert-True $duplicateRejected 'Duplicate identifier was not rejected.'

  $invalidStatusInput = Join-Path $temporaryRoot 'invalid-status.json'
  $invalidStatusJson = '[{"SSC Roll":"654321","Unique ID":"TEE26-0003","Student Name":"Student C","Status":"UNKNOWN"}]'
  [System.IO.File]::WriteAllText($invalidStatusInput, $invalidStatusJson, [System.Text.UTF8Encoding]::new($false))
  $invalidStatusRejected = $false
  try {
    & $builder -InputPath $invalidStatusInput -OutputPath (Join-Path $temporaryRoot 'invalid-status-output.json')
  } catch {
    $invalidStatusRejected = $_.Exception.Message -like '*Unsupported status*'
  }
  Assert-True $invalidStatusRejected 'Unsupported status was not rejected.'

  $hosting = Get-Content -LiteralPath (Join-Path $projectRoot 'firebase.json') -Raw | ConvertFrom-Json
  Assert-True ($hosting.hosting.ignore -contains 'public-results.json') 'Generated lookup file is not excluded from Hosting.'
  Assert-True ($hosting.hosting.ignore -contains 'scripts/**') 'Migration scripts are not excluded from Hosting.'

  Write-Host 'Security checks passed.'
} finally {
  $systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if ($temporaryRoot.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $temporaryRoot).StartsWith('tee-result-security-')) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
