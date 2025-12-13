# Stop and remove SQL Server pod
podman pod stop sqlserver-pod
podman pod rm sqlserver-pod

# Remove the data volume (optional - comment out if you want to preserve data)
podman volume rm sqlserver-data

Write-Host "SQL Server pod stopped and removed."