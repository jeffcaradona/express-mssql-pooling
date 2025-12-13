# Initialize SQL Server database
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

# Wait for SQL Server to be ready
Write-Host "Waiting for SQL Server to be ready..."
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    try {
        # Try to execute a simple query
        sqlcmd -S localhost -U sa -P $env:MSSQL_SA_PASSWORD -Q "SELECT @@VERSION" -ErrorAction Stop | Out-Null
        $ready = $true
        Write-Host "SQL Server is ready!"
    } catch {
        $attempt++
        Write-Host "Attempt $attempt/$maxAttempts - SQL Server not ready yet, waiting..."
        Start-Sleep -Seconds 1
    }
}

if (-not $ready) {
    Write-Host "SQL Server did not become ready in time"
    exit 1
}

# Run the database initialization script
Write-Host "Initializing DemoApp database..."
sqlcmd -S localhost -U sa -P $env:MSSQL_SA_PASSWORD -i .\scripts\init-db.sql

Write-Host "Database initialization complete!"
