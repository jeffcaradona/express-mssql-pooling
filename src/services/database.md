# Database Service Module Documentation

This module provides robust, production-grade connection pooling and query execution for Microsoft SQL Server using the `mssql` package. It is designed for reliability, graceful shutdown, and automatic recovery from transient errors.

---

## Table of Contents
- [Environment Variables](#environment-variables)
- [Connection Pool Management](#connection-pool-management)
- [Query Execution](#query-execution)
- [Health Checks](#health-checks)
- [Graceful Shutdown](#graceful-shutdown)
- [API Reference](#api-reference)

---

## Environment Variables

The following environment variables are required:
- `DB_USER` – SQL Server username
- `DB_PASSWORD` – SQL Server password
- `DB_HOST` – SQL Server host
- `DB_PORT` – SQL Server port (default: 1433)
- `DB_NAME` – Database name

If any are missing, the service will throw an error on startup.

---

## Connection Pool Management

- **Lazy Initialization:** The pool is created only when first needed, ensuring environment variables are loaded.
- **Pool Settings:**
  - `max`: 25 connections (handles high concurrency)
  - `min`: 5 connections (keeps warm connections for low latency)
  - `idleTimeoutMillis`: 60 seconds (idle connections are closed after this period)
- **Automatic Recovery:**
  - Listens for connection errors (`ESOCKET`, `ECONNRESET`) and resets the pool for automatic recovery.
- **Shutdown Safety:**
  - If a shutdown is in progress, new pool requests are rejected.

---

## Query Execution

- **executeQuery(queryFn, operationName):**
  - Wraps all queries for consistent error handling and logging.
  - Automatically resets the pool on connection errors and retries on next call.
- **initial_test(recQy):**
  - Runs a simple test query to verify connectivity and pool health.
- **testBadRecord():**
  - Attempts a query with invalid input to test error handling.

---

## Health Checks

- **isPoolHealthy():**
  - Runs a test query to verify the pool is connected and healthy.
  - Returns `true` if healthy, `false` otherwise.

---

## Graceful Shutdown

- **gracefulShutdown(drainTimeout = 30000):**
  - Waits for active queries to complete (up to `drainTimeout` ms)
  - Stops accepting new queries during shutdown
  - Closes the pool and releases resources
  - Logs pool status and warns if queries are still running after the timeout

---

## API Reference

### getConnectionPool()
Returns a connected pool instance, creating it if necessary. Throws if shutting down.

### closeConnectionPool()
Closes and resets the pool. Used for manual or error-triggered shutdowns.

### resetConnectionPool()
Closes and clears the pool, forcing recreation on next use.

### executeQuery(queryFn, operationName)
Executes a query with error handling and pool recovery.

### isPoolHealthy()
Checks if the pool is healthy by running a test query.

### initial_test(recQy)
Runs a test query to verify connectivity.

### testBadRecord()
Runs a query with invalid input to test error handling.

### initializeDatabase()
Initializes the pool and runs a test query. Call after loading environment variables.

### gracefulShutdown(drainTimeout)
Gracefully closes the pool, waiting for active queries to finish.

---

## Usage Example

```js
import {
  getConnectionPool,
  executeQuery,
  initializeDatabase,
  gracefulShutdown
} from './services/database.js';

// Initialize database on startup
await initializeDatabase();

// Use in an API route
app.get('/api/initial-test', async (req, res) => {
  try {
    const result = await executeQuery(
      async () => {
        const pool = await getConnectionPool();
        return pool.request().query('SELECT 1 AS test');
      },
      'initial_test'
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Graceful shutdown if not handled in app.js object or server.js
process.on('SIGINT', async () => {
  await gracefulShutdown();
  process.exit(0);
});
```

---

For more details, see the code comments in `database.js`.
