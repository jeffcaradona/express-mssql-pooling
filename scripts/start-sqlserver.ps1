# Load environment variables from .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

# Create pod
podman pod create --name sqlserver-pod -p 1433:1433

# Run SQL Server
podman run -d `
  --pod sqlserver-pod `
  --name sqlserver `
  -e "ACCEPT_EULA=Y" `
  -e "MSSQL_SA_PASSWORD=$env:MSSQL_SA_PASSWORD" `
  -e "MSSQL_PID=Developer" `
  -e "MSSQL_AGENT_ENABLED=true" `
  -v sqlserver-data:/var/opt/mssql `
  mcr.microsoft.com/mssql/server:2022-latest

Write-Host "SQL Server started. Waiting for initialization..."
Start-Sleep -Seconds 20