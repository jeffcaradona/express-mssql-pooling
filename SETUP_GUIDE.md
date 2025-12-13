# Express.js + SQL Server Pooling Setup Guide

## Overview

This project demonstrates a production-ready Express.js application with SQL Server integration using connection pooling with a singleton pattern. The setup includes containerized SQL Server, environment configuration, and prepared statements for secure database operations.

## Architecture

### Technology Stack
- **Runtime**: Node.js (v25+)
- **Framework**: Express.js
- **Database**: SQL Server 2022 (running in Podman container)
- **ORM/Driver**: mssql library with tedious driver
- **Container Runtime**: Podman

### Key Design Decisions

#### 1. **Singleton Connection Pool**
The database connection pool is implemented as a singleton to ensure:
- **Only one pool instance** exists across the entire application
- **No race conditions** even with concurrent initialization attempts
- **Guaranteed connection reuse** for optimal resource utilization

**Location**: [src/services/database.js](src/services/database.js)

```javascript
// Pattern: Pool is created only once, all callers share it
let pool = null;
let poolConnect = null;

export const getConnectionPool = async () => {
    if (!poolConnect) {
        // Only the first caller triggers creation
        poolConnect = (async () => {
            pool = new mssql.ConnectionPool(dbConfig);
            await pool.connect();
            return pool;
        })();
    }
    await poolConnect; // All calls wait for the same promise
    return pool;
}
```

**Why this matters**:
- Prevents "Zalgo" problems (inconsistent async behavior)
- All callers always receive a promise, guaranteeing consistent async semantics
- Avoids multiple connection attempts even if called 100 times simultaneously at startup

#### 2. **Lazy Configuration Loading**
Database configuration is loaded lazily inside the connection function (not at module load time) because:
- Environment variables must be loaded first by `dotenv` in [src/server.js](src/server.js)
- ES modules are evaluated before the main function runs
- Lazy loading ensures `process.env` variables are available when needed

#### 3. **Prepared Statements**
All database queries use prepared statements with parameterized inputs:
- Prevents SQL injection attacks
- Improves query performance through query plan caching
- Ensures type safety

**Example**: [src/controllers/apiController.js](src/controllers/apiController.js#L15-L17)
```javascript
const request = pool.request();
request.input('recQy', mssql.Int, 1);
const result = await request.query('SELECT [REC_QY] = @recQy');
```

---

## Prerequisites

Before running this system, ensure you have:

1. **Node.js** (v20 or higher)
   ```powershell
   node --version
   npm --version
   ```

2. **Podman** (for SQL Server container)
   ```powershell
   podman --version
   ```

3. **Project dependencies installed**
   ```powershell
   npm install
   ```

---

## Initial Setup

### Step 1: Configure Environment Variables

Edit [.env](.env) with your configuration:

```dotenv
PORT=1533
NODE_ENV=development
DEBUG=express-mssql-pooling

# SQL Server credentials (must be 8+ characters)
MSSQL_SA_PASSWORD=YourSecurePassword123!

# Database connection settings
DB_HOST=localhost
DB_PORT=1433
DB_NAME=DemoApp
DB_USER=sa
DB_PASSWORD=YourSecurePassword123!
```

**Important**: 
- Password must be **at least 8 characters**
- Include uppercase, lowercase, numbers, and special characters
- Both `MSSQL_SA_PASSWORD` and `DB_PASSWORD` must match

### Step 2: Start SQL Server Container

Run the startup script to create and start the SQL Server container:

```powershell
.\scripts\start-sqlserver.ps1
```

**What it does**:
- Loads environment variables from `.env`
- Creates a Podman pod named `sqlserver-pod`
- Starts SQL Server 2022 container
- Maps port 1433 (container) → 1433 (host)
- Waits 20 seconds for initialization

**Verify it's running**:
```powershell
podman ps | findstr sqlserver
```

You should see the container in "Up" state.

### Step 3: Initialize the Database

Create the `DemoApp` database and sample tables:

```powershell
node .\scripts\init-db.js
```

**What it does**:
- Connects to SQL Server master database
- Creates `DemoApp` database if it doesn't exist
- Creates `TestRecords` table with schema:
  ```sql
  RecordID INT PRIMARY KEY IDENTITY(1,1)
  REC_QY INT
  CreatedDate DATETIME DEFAULT GETDATE()
  ```
- Inserts 2 sample records with `REC_QY = 1`

### Step 4: Start the Express Application

```powershell
npm run start:dev
```

**Expected output**:
```
[nodemon] 3.1.11
[nodemon] to restart at any time, enter `rs`
express-mssql-pooling:server Listening on port 1533
express-mssql-pooling:server Server is running at http://localhost:1533
```

---

## Testing

### Test 1: Basic API Endpoint

Test the prepared statement query:

```powershell
Invoke-WebRequest -Uri "http://localhost:1533/api/initial-test" -UseBasicParsing | ConvertTo-Json
```

**Expected response** (HTTP 200):
```json
{
  "success": true,
  "data": [
    {
      "REC_QY": 1
    }
  ],
  "message": "Records retrieved successfully"
}
```

### Test 2: Root Endpoint

```powershell
Invoke-WebRequest -Uri "http://localhost:1533/" -UseBasicParsing | Select-Object -ExpandProperty Content
```

### Test 3: Monitor Logs

The application runs in debug mode. Watch the console for database operations:

```
express-mssql-pooling:mssql Creating new connection pool
express-mssql-pooling:mssql Database config: server=localhost, database=DemoApp, user=sa
express-mssql-pooling:mssql Database connection pool created successfully
express-mssql-pooling:mssql Records fetched successfully: [ { REC_QY: 1 } ]
```

---

## Project Structure

```
src/
├── app.js                          # Express app configuration
├── server.js                       # Entry point, loads dotenv
├── controllers/
│   └── apiController.js            # API route handlers with prepared statements
├── routes/
│   ├── apiRouter.js                # API routes
│   └── indexRouter.js              # Index routes
├── services/
│   └── database.js                 # Singleton connection pool
├── utils/
│   ├── debug.js                    # Debug logging utility
│   └── logger.js                   # Winston logger
└── views/
    ├── index.ejs                   # Home page template
    └── error.ejs                   # Error page template

scripts/
├── start-sqlserver.ps1             # Start SQL Server container
├── stop-sql.sh                     # Stop containers (bash)
├── stop-sqlserver.ps1              # Stop containers (PowerShell)
├── init-db.js                      # Database initialization script
└── init-db.sql                     # SQL initialization script

public/
├── stylesheets/style.css
└── [other static assets]

.env                                # Environment configuration
package.json                        # Project dependencies
```

---

## Troubleshooting

### Issue: "Password does not meet SQL Server password policy requirements"

**Solution**: Ensure password in `.env` is at least 8 characters with complexity.

**Check**: 
```powershell
podman logs sqlserver | tail -20
```

### Issue: "config.server property is required and must be of type string"

**Solution**: Environment variables aren't loaded. Ensure:
1. `.env` file exists in project root
2. All required variables are set
3. `dotenv` is called before importing `database.js`

### Issue: "Failed to open the explicitly specified database 'DemoApp'"

**Solution**: Database hasn't been initialized.
```powershell
node .\scripts\init-db.js
```

### Issue: Connection timeout errors

**Solution**: SQL Server may still be initializing. Wait 30+ seconds after startup and retry.

---

## Stopping the System

### Stop the Express App
In the terminal running the app, press `Ctrl+C`

### Stop SQL Server Container

```powershell
# Windows PowerShell
.\scripts\stop-sqlserver.ps1

# Or manually
podman rm -f sqlserver
podman pod rm -f sqlserver-pod
```

---

## Database Operations

### Add a New Query Endpoint

1. **Create a controller** in `src/controllers/`:

```javascript
export const getRecordsByQuantity = async (req, res) => {
    try {
        const pool = await getConnectionPool();
        const request = pool.request();
        
        // Use parameters to prevent SQL injection
        request.input('quantity', mssql.Int, req.query.qty || 1);
        
        const result = await request.query(
            'SELECT * FROM TestRecords WHERE REC_QY = @quantity'
        );
        
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
```

2. **Add route** in `src/routes/apiRouter.js`:

```javascript
import { getRecordsByQuantity } from '../controllers/apiController.js';
apiRouter.get('/records', getRecordsByQuantity);
```

3. **Test**:
```powershell
Invoke-WebRequest -Uri "http://localhost:1533/api/records?qty=1"
```

---

## Performance Considerations

### Connection Pool Configuration

Current settings in [src/services/database.js](src/services/database.js):

```javascript
pool: {
    max: 10,           // Maximum simultaneous connections
    min: 0,            // Minimum idle connections
    idleTimeoutMillis: 30000  // Close idle connections after 30s
}
```

**Tuning**:
- Increase `max` for high-traffic applications (but monitor resources)
- Increase `min` to keep connections warm and reduce latency
- Adjust `idleTimeoutMillis` based on query frequency

### Monitoring

Watch for these debug messages in logs:
- `Creating new connection pool` - Pool initialization (should appear once)
- `Database connection pool created successfully` - Pool ready
- `Error fetching records` - Query failures

---

## Next Steps

1. **Add authentication**: Implement user login/sessions
2. **Add more tables**: Extend the database schema
3. **Create CRUD endpoints**: Build full REST API
4. **Add validation**: Implement input validation middleware
5. **Add tests**: Unit and integration tests
6. **Production deployment**: Configure for cloud/VPS

---

## References

- [mssql Documentation](https://github.com/tediousjs/node-mssql)
- [Express.js Guide](https://expressjs.com/)
- [Tedious Driver](https://tediousjs.github.io/tedious/)
- [SQL Server Connection Pooling](https://docs.microsoft.com/en-us/sql/relational-databases/native-client/features/using-connection-pooling)
