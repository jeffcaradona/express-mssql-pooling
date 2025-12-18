# Scripts Directory

This directory contains utility scripts for database management, testing, and server operations.

## Database Scripts

### init-db.js

Initializes the database by creating the DemoApp database and TestRecords table with sample data.

**Usage**:
```bash
node scripts/init-db.js
```

**Prerequisites**:
- SQL Server must be running
- `.env` file must be configured with database credentials

**What it does**:
1. Connects to SQL Server master database
2. Creates `DemoApp` database if it doesn't exist
3. Switches to DemoApp database
4. Creates `TestRecords` table with schema:
   - `RecordID INT PRIMARY KEY IDENTITY(1,1)`
   - `REC_QY INT`
   - `CreatedDate DATETIME DEFAULT GETDATE()`
5. Inserts 2 sample records

### init-db.sql

SQL script for manual database initialization (alternative to init-db.js).

**Usage**:
```bash
# Using sqlcmd
sqlcmd -S localhost -U sa -P YourPassword -i scripts/init-db.sql

# Or execute in SQL Server Management Studio
```

---

## SQL Server Management Scripts

### start-sqlserver.ps1 (Windows)

Starts SQL Server 2022 in a Podman container.

**Usage**:
```powershell
.\scripts\start-sqlserver.ps1
```

**What it does**:
1. Loads environment variables from `.env`
2. Creates a Podman pod named `sqlserver-pod`
3. Starts SQL Server 2022 container
4. Maps port 1433 (container) → 1433 (host)
5. Sets SA password from environment
6. Waits 20 seconds for SQL Server to initialize

### start-sql.sh (Linux/Mac)

Linux/Mac version of start-sqlserver.ps1.

**Usage**:
```bash
./scripts/start-sql.sh
```

### stop-sqlserver.ps1 (Windows)

Stops and removes the SQL Server container and pod.

**Usage**:
```powershell
.\scripts\stop-sqlserver.ps1
```

**What it does**:
1. Stops the `sqlserver` container
2. Removes the `sqlserver` container
3. Removes the `sqlserver-pod` pod

### stop-sql.sh (Linux/Mac)

Linux/Mac version of stop-sqlserver.ps1.

**Usage**:
```bash
./scripts/stop-sql.sh
```

### init-sqlserver.ps1

Alternative initialization script (if different from start-sqlserver.ps1).

---

## Testing Scripts

### load-test.js

Runs performance load tests using autocannon.

**Usage**:
```bash
node scripts/load-test.js
```

**Prerequisites**:
- Application must be running (`npm run start:dev`)
- Database must be initialized

**Test Configuration**:
- **Endpoint**: `http://localhost:1533/api/record-count`
- **Connections**: 20 concurrent users
- **Duration**: 30 seconds
- **Pipelining**: 1 request per connection at a time

**Output**:
```
=== Load Test Results ===

Total Requests: 83,991
Average Throughput: 477,355 req/sec
Average Latency: 14ms
P99 Latency: 20ms
Errors: 0
Timeouts: 0
Socket Errors: 0
```

See [../docs/load_testing.md](../docs/load_testing.md) for detailed performance testing guide.

### test-graceful-shutdown.js

Tests the application's graceful shutdown behavior.

**Usage**:
```bash
# Terminal 1: Start the application
npm run start:dev

# Terminal 2: Run the test
node scripts/test-graceful-shutdown.js
```

**What it does**:
1. Makes continuous requests to the server (every 500ms)
2. Sends SIGINT signal to the server after 2 seconds
3. Continues making requests to demonstrate rejection
4. Reports success/failure counts before and after shutdown

**Expected Behavior**:
- Requests before shutdown: succeed ✓
- Requests during graceful shutdown: may succeed or fail
- Requests after shutdown complete: fail ✗

---

## Script Dependencies

### Node.js Scripts
All `.js` scripts require Node.js v20+ and dependencies installed:
```bash
npm install
```

### PowerShell Scripts
PowerShell scripts (`.ps1`) require:
- Windows PowerShell or PowerShell Core
- Podman installed and configured

### Shell Scripts
Shell scripts (`.sh`) require:
- Bash shell
- Podman installed and configured
- Execute permissions: `chmod +x scripts/*.sh`

---

## Common Issues

### "Cannot find module" errors
```bash
npm install
```

### "podman: command not found"
Install Podman:
- Windows: https://podman.io/getting-started/installation
- Linux: `sudo apt install podman` or equivalent
- Mac: `brew install podman`

### SQL Server won't start
- Check password meets complexity requirements (8+ chars, mixed case, numbers, special chars)
- Verify port 1433 is not in use: `netstat -an | findstr 1433`
- Check Podman logs: `podman logs sqlserver`

### Load test fails
Ensure:
1. Application is running: `curl http://localhost:1533/api/record-count`
2. Database is initialized: `node scripts/init-db.js`
3. No other load tests are running

---

## Adding New Scripts

When adding new scripts:

1. **Add JSDoc comments** at the top:
```javascript
/**
 * Script description
 * Usage: node scripts/my-script.js
 * Prerequisites: List any requirements
 */
```

2. **Update this README** with:
   - Script name and purpose
   - Usage instructions
   - Prerequisites
   - Expected output

3. **Test the script** before committing

4. **Add to documentation** if it's user-facing

---

## See Also

- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Complete setup instructions
- [load_testing.md](../docs/load_testing.md) - Performance testing guide
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines
