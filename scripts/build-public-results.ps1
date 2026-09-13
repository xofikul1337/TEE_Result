param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$rows = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
$publicResults = [ordered]@{}
$supportedStatuses = @('SELECTED', 'NOT SELECTED', 'PENDING', 'WAITING', 'CANCELLED', 'CANCEL')
$bengaliDigits = '০১২৩৪৫৬৭৮৯'

function Normalize-Identifier([string]$Value) {
  $normalized = [regex]::Replace($Value, '[০-৯]', {
    param($match)
    return [string]$bengaliDigits.IndexOf($match.Value)
  })
  return ($normalized -replace '\s+', '').ToUpperInvariant()
}

foreach ($row in $rows) {
  $rawRoll = $row.'SSC Roll'
  if ($null -ne $rawRoll -and $rawRoll -isnot [string]) {
    throw 'SSC Roll must be stored as text so leading zeroes cannot be lost.'
  }

  $roll = Normalize-Identifier ([string]$rawRoll)
  $registrationId = Normalize-Identifier ([string]$row.'Unique ID')
  $name = ([string]$row.'Student Name').Trim()
  $status = ([string]$row.Status).Trim().ToUpperInvariant()

  if ([string]::IsNullOrWhiteSpace($status)) {
    if ([string]::IsNullOrWhiteSpace($roll) -and
        [string]::IsNullOrWhiteSpace($registrationId) -and
        [string]::IsNullOrWhiteSpace($name)) {
      continue
    }
    throw "Missing status for identifier '$roll'."
  }
  if ($supportedStatuses -notcontains $status) {
    throw "Unsupported status '$status' for identifier '$roll'."
  }

  $record = [ordered]@{
    status = $status
  }
  if ($status -eq 'SELECTED') {
    if ([string]::IsNullOrWhiteSpace($name)) {
      throw "Selected result '$roll' is missing Student Name."
    }
    $record.name = $name
  }

  foreach ($identifier in @($roll, $registrationId)) {
    if ([string]::IsNullOrWhiteSpace($identifier)) { continue }

    if ($identifier -notmatch '^([0-9]{4,12}|TEE[0-9]{2}-[0-9]{4})$') {
      throw "Invalid or unreachable public identifier: $identifier"
    }

    if ($publicResults.Contains($identifier)) {
      throw "Duplicate public identifier: $identifier"
    }

    $publicResults[$identifier] = $record
  }
}

$json = $publicResults | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText(
  [System.IO.Path]::GetFullPath($OutputPath),
  $json,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Created $($publicResults.Count) secure public lookup keys at $OutputPath"
