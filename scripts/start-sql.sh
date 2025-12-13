#!/bin/bash

# Load environment variables
source .env

# Create pod
podman pod create --name sqlserver-pod -p 1433:1433

# Run SQL Server
podman run -d \
  --pod sqlserver-pod \
  --name sqlserver \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=${MSSQL_SA_PASSWORD}" \
  -e "MSSQL_PID=Express" \
  -v sqlserver-data:/var/opt/mssql \
  mcr.microsoft.com/mssql/server:2022-latest

echo "SQL Server started. Waiting for initialization..."
sleep 20