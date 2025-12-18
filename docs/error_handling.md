# Error Handling Guide

## Overview

This application implements a robust, structured error handling system that provides consistent error responses across all API endpoints while maintaining detailed server-side logging for debugging.

## Architecture

The error handling system consists of three main components:

1. **DatabaseError Class** - Custom error wrapper for database-specific errors
2. **Error Middleware** - Express middleware that catches and formats all errors
3. **Error Categorization** - Automatic classification of errors by type

---

## DatabaseError Class

### Location
`src/utils/errorHandler.js`

### Purpose
Wraps database errors with proper HTTP status codes and user-friendly messages while preserving original error details for logging.

### Class Definition

```javascript
export class DatabaseError extends Error {
    constructor(originalError, operation) {
        super(originalError.message);
        this.name = 'DatabaseError';
        this.originalError = originalError;
        this.operation = operation;
        this.statusCode = this.categorizeError(originalError);
    }
}
```

### Error Categorization

The `categorizeError` method automatically determines the appropriate HTTP status code:

```javascript
categorizeError(error) {
    const errorCode = error.code?.toUpperCase();
    const errorMessage = error.message?.toLowerCase() || '';

    // Connection failures (503)
    if (errorCode === 'ECONNREFUSED' || 
        errorCode === 'ENOTFOUND' || 
        errorCode === 'ESOCKET' ||
        errorMessage.includes('connection') || 
        errorMessage.includes('pool')) {
        return 503;
    }
    
    // Timeout errors (504)
    if (errorCode === 'ETIMEOUT' || 
        errorCode === 'ETIMEDOUT' || 
        errorMessage.includes('timeout')) {
        return 504;
    }
    
    // Default server error (500)
    return 500;
}
```

### Error Codes Mapping

| Status | Error Code | Description |
|--------|------------|-------------|
| 503 | `DATABASE_UNAVAILABLE` | Database connection failed |
| 504 | `DATABASE_TIMEOUT` | Query or connection timeout |
| 500 | `DATABASE_ERROR` | General database error |

### User Messages

User-facing messages hide internal details:

```javascript
getUserMessage() {
    switch (this.statusCode) {
        case 503: return 'Database service is temporarily unavailable';
        case 504: return 'Database request timed out';
        default: return 'An error occurred while processing your request';
    }
}
```

---

## Error Middleware

### Location
`src/utils/errorHandler.js` (exported function)  
`src/routes/apiRouter.js` (registered)

### Implementation

```javascript
export const errorMiddleware = (err, req, res, next) => {
    // Log full error details server-side
    logger.error('API Error:', {
        operation: err.operation || 'unknown',
        path: req.path,
        method: req.method,
        error: err.originalError || err,
        message: err.message,
        stack: err.stack
    });

    // If headers already sent, delegate to default error handler
    if (res.headersSent) {
        return next(err);
    }

    // Determine status code and response
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (err instanceof DatabaseError) {
        statusCode = err.statusCode;
        errorCode = err.getErrorCode();
        message = err.getUserMessage();
    }

    // Send sanitized error response
    res.status(statusCode).json({
        success: false,
        error: {
            code: errorCode,
            message: message,
            status: statusCode
        }
    });
};
```

### Key Features

1. **Complete Server-Side Logging** - Full error details including stack traces
2. **Sanitized Client Responses** - No internal details exposed to clients
3. **Consistent Format** - All errors follow the same JSON structure
4. **Headers Check** - Prevents errors if response already sent
5. **Fallback Handling** - Delegates to Express default handler when needed

---

## Usage in Controllers

### Pattern 1: With DatabaseError Wrapper

**Recommended for database operations:**

```javascript
import { DatabaseError } from '../utils/errorHandler.js';

export const getRecordCount = async (req, res, next) => {
    try {
        const result = await executeQuery(async () => {
            const localPool = await getConnectionPool();
            const request = localPool.request();
            return await request.query("SELECT COUNT(*) FROM TestRecords");
        }, "getRecordCount");
        
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        // Wrap error and pass to middleware
        next(new DatabaseError(error, 'getRecordCount'));
    }
};
```

### Pattern 2: Direct Error Passing

**For non-database operations:**

```javascript
export const processData = async (req, res, next) => {
    try {
        // Business logic here
        res.json({ success: true, data: result });
    } catch (error) {
        // Pass error directly to middleware
        next(error);
    }
};
```

### Pattern 3: Early Return with Validation

**For input validation:**

```javascript
export const updateRecord = async (req, res, next) => {
    // Validate input early
    const { id, value } = req.body;
    
    if (!id || typeof id !== 'number') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_INPUT',
                message: 'ID must be a number',
                status: 400
            }
        });
    }
    
    try {
        const result = await executeQuery(async () => {
            // Database operation
        }, "updateRecord");
        
        res.json({ success: true, data: result });
    } catch (error) {
        next(new DatabaseError(error, 'updateRecord'));
    }
};
```

---

## Error Flow

### Normal Request Flow

```
Client Request
    ↓
Express Middleware
    ↓
Route Handler (Controller)
    ↓
executeQuery Wrapper
    ↓
Database Query
    ↓
Success Response
```

### Error Flow

```
Client Request
    ↓
Express Middleware
    ↓
Route Handler (Controller)
    ↓
executeQuery Wrapper
    ↓
Database Query → ERROR
    ↓
catch block in executeQuery
    ↓ (rethrows)
catch block in controller
    ↓ (wraps in DatabaseError)
next(DatabaseError)
    ↓
Error Middleware
    ↓
Structured JSON Error Response
```

---

## Integration with executeQuery

The `executeQuery` wrapper in `database.js` handles connection-level errors:

```javascript
export const executeQuery = async (queryFn, operationName) => {
  try {
    const result = await queryFn();
    debugMSSQL(`${operationName} completed successfully`);
    return result;
  } catch (err) {
    debugMSSQL(`${operationName} failed: %O`, {
      message: err.message,
      code: err.code,
      state: err.state,
    });
    
    // Reset pool on connection errors
    if (CONNECTION_ERROR_CODES.includes(err.code)) {
      debugMSSQL("Connection error detected, resetting pool");
      await resetConnectionPool();
    }
    
    throw err; // Rethrow for controller to handle
  }
};
```

**Connection errors automatically trigger pool reset:**
- `ESOCKET` - Socket connection error
- `ECONNRESET` - Connection reset by peer
- `ETIMEDOUT` - Connection timeout
- `EHOSTUNREACH` - Host unreachable

---

## Logging

### Server-Side Logging (Winston)

Full error details are logged:

```javascript
logger.error('API Error:', {
    operation: 'getRecordCount',
    path: '/api/record-count',
    method: 'GET',
    error: {
        message: 'Invalid object name TestRecords',
        code: 'EREQUEST',
        number: 208
    },
    stack: 'Error: Invalid object name...'
});
```

### Debug Logging

Enable detailed operation tracking:

```powershell
$env:DEBUG="express-mssql-pooling:*"
npm start
```

**Output shows:**
```
express-mssql-pooling:database Executing query: getRecordCount
express-mssql-pooling:database getRecordCount failed: { message: '...', code: 'EREQUEST' }
```

---

## Client-Side Error Handling

### JavaScript/TypeScript

```javascript
async function fetchRecordCount() {
    try {
        const response = await fetch('http://localhost:1533/api/record-count');
        const data = await response.json();
        
        if (data.success) {
            console.log('Count:', data.data);
        } else {
            // Handle error
            console.error(`Error ${data.error.code}: ${data.error.message}`);
            
            switch (data.error.status) {
                case 503:
                    // Retry with exponential backoff
                    setTimeout(() => fetchRecordCount(), 5000);
                    break;
                case 504:
                    // Timeout - notify user
                    showError('Request timed out. Please try again.');
                    break;
                default:
                    // General error
                    showError(data.error.message);
            }
        }
    } catch (networkError) {
        console.error('Network error:', networkError);
    }
}
```

### PowerShell

```powershell
try {
    $response = Invoke-WebRequest -Uri "http://localhost:1533/api/record-count" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "Count: $($data.data.totalRecords)"
    } else {
        Write-Error "Error $($data.error.code): $($data.error.message)"
    }
} catch {
    Write-Error "Failed to connect: $_"
}
```

---

## Testing Error Handling

### Test Endpoints

1. **Test Database Error** - `/api/test-db-error`
   - Queries non-existent table
   - Returns 500 DATABASE_ERROR

2. **Test Input Validation** - `/api/failure-test`
   - Tests validation logic
   - Should reject invalid input

### Manual Testing

```powershell
# Test connection error (with database stopped)
podman stop sqlserver
Invoke-WebRequest http://localhost:1533/api/record-count
# Expected: 503 DATABASE_UNAVAILABLE

# Test timeout (with slow query)
# Modify query to use WAITFOR DELAY '00:01:00'
# Expected: 504 DATABASE_TIMEOUT

# Test query error
Invoke-WebRequest http://localhost:1533/api/test-db-error
# Expected: 500 DATABASE_ERROR

# Test 404
Invoke-WebRequest http://localhost:1533/api/invalid-endpoint
# Expected: 404 ROUTE_NOT_FOUND
```

---

## Best Practices

### Do's ✅

1. **Always use try-catch** in async controllers
2. **Wrap database errors** in DatabaseError
3. **Pass errors to next()** instead of sending response directly
4. **Validate inputs early** before database calls
5. **Log errors server-side** for debugging
6. **Sanitize error messages** for clients
7. **Use appropriate HTTP status codes**
8. **Test error scenarios** explicitly

### Don'ts ❌

1. **Don't expose internal error details** to clients
2. **Don't send both response and call next()** in error handler
3. **Don't catch errors without handling** them
4. **Don't use generic error messages** for all errors
5. **Don't forget to reset pool** on connection errors
6. **Don't log sensitive data** (passwords, tokens)
7. **Don't ignore error types** - categorize properly

---

## Error Monitoring

### Production Monitoring

**Log aggregation tools** (Splunk, ELK, CloudWatch):
```javascript
logger.error('API Error:', {
    operation: 'getRecords',
    path: '/api/records',
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
    error: err
});
```

**Metrics to track:**
- Error rate by endpoint
- Error types (connection, timeout, query)
- Response time percentiles
- Pool health status

### Alerting Rules

**Critical Alerts:**
- Error rate > 5% over 5 minutes
- Connection errors > 10 in 1 minute
- Timeout errors > 5% of requests

**Warning Alerts:**
- Error rate > 1% over 10 minutes
- Average response time > 1 second
- Pool exhaustion events

---

## Debugging Errors

### Step 1: Check Logs

```powershell
# View recent errors
Get-Content logs/app.log -Tail 50 | Select-String "error"
```

### Step 2: Enable Debug Mode

```powershell
$env:DEBUG="express-mssql-pooling:*"
npm start
```

### Step 3: Reproduce Error

```powershell
Invoke-WebRequest http://localhost:1533/api/problematic-endpoint
```

### Step 4: Analyze Stack Trace

Look for:
- Original error message
- Error code
- Operation name
- Call stack

### Step 5: Fix and Test

1. Apply fix
2. Restart application
3. Reproduce scenario
4. Verify error is resolved

---

## Common Error Scenarios

### Scenario 1: Database Connection Failed

**Symptoms:**
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Database service is temporarily unavailable",
    "status": 503
  }
}
```

**Causes:**
- SQL Server not running
- Wrong connection credentials
- Network connectivity issues
- Firewall blocking port 1433

**Solutions:**
1. Check SQL Server status: `podman ps`
2. Verify .env credentials
3. Test network connectivity
4. Check firewall rules

### Scenario 2: Query Timeout

**Symptoms:**
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_TIMEOUT",
    "message": "Database request timed out",
    "status": 504
  }
}
```

**Causes:**
- Slow query without indexes
- Large result set
- Database under heavy load
- Timeout setting too low

**Solutions:**
1. Add database indexes
2. Optimize query
3. Use pagination
4. Increase `requestTimeout` in pool config

### Scenario 3: SQL Syntax Error

**Symptoms:**
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "An error occurred while processing your request",
    "status": 500
  }
}
```

**Causes:**
- Typo in SQL query
- Invalid table/column name
- Missing table
- Permission denied

**Solutions:**
1. Check query syntax
2. Verify table exists
3. Check column names
4. Verify database permissions

---

## See Also

- [api_endpoints.md](api_endpoints.md) - Complete API reference
- [executequery_pattern.md](executequery_pattern.md) - Query wrapper pattern
- [debug_and_logging.md](debug_and_logging.md) - Debugging guide
- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Setup and configuration
