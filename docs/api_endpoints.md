# API Endpoints Reference

## Overview

This document provides detailed information about all available API endpoints, including request/response formats, error handling, and usage examples.

## Base URL

```
http://localhost:1533/api
```

## Response Format

All API responses follow a consistent JSON structure:

### Success Response
```json
{
  "success": true,
  "data": <response_data>
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "status": <http_status_code>
  }
}
```

---

## Endpoints

### GET /api/

Root API endpoint that returns a welcome message.

**Response:**
```json
{
  "message": "Welcome to the API root!"
}
```

**Example:**
```powershell
Invoke-WebRequest http://localhost:1533/api/
```

---

### GET /api/initial-test

Test endpoint demonstrating prepared statements. Returns a static value using parameterized query.

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "REC_QY": 1
    }
  ]
}
```

**Purpose:**
- Validates database connection is working
- Demonstrates prepared statement usage
- Tests basic query execution flow

**Example:**
```powershell
Invoke-WebRequest http://localhost:1533/api/initial-test
```

**Implementation Details:**
- Uses `executeQuery` wrapper for error handling
- Uses prepared statement with `@recQy` parameter
- Validates input parameter (must be non-negative number)

---

### GET /api/record-count

Returns the total number of records in the TestRecords table.

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "totalRecords": 2
    }
  ]
}
```

**Purpose:**
- Get count of records without loading full dataset
- Useful for pagination and UI display

**Example:**
```powershell
Invoke-WebRequest http://localhost:1533/api/record-count
```

**Implementation Details:**
- Uses `COUNT(*)` aggregate function
- Returns single row with count
- Efficient query execution

---

### GET /api/test-stream

Streams a large dataset (10,000 records) using chunked transfer encoding. Demonstrates efficient handling of large result sets.

**Query Parameters:** None

**Response:**
- **Content-Type:** `application/json`
- **Transfer-Encoding:** `chunked`
- Returns JSON array of objects, streamed in chunks

**Response Example (partial):**
```json
[
  {"value": 1, "UUID": "a1b2c3d4-..."},
  {"value": 2, "UUID": "e5f6g7h8-..."},
  ...
]
```

**Purpose:**
- Demonstrate memory-efficient handling of large datasets
- Show streaming API pattern
- Avoid loading entire result set in memory

**Example:**
```powershell
Invoke-WebRequest http://localhost:1533/api/test-stream
```

**Implementation Details:**
- Uses `request.stream = true` to enable streaming mode
- Leverages SQL Server's `FOR JSON PATH` for server-side JSON formatting
- Uses `GENERATE_SERIES(1, 10000)` to create test data
- Event-driven architecture with `recordset`, `row`, `error`, and `done` handlers
- Writes chunks directly to HTTP response stream

**Performance Benefits:**
- Constant memory usage regardless of dataset size
- Progressive rendering on client side
- No need to buffer entire result set

**Code Pattern:**
```javascript
const request = localPool.request();
request.stream = true;

request.on('row', row => {
  res.write(jsonColumn);
});

request.on('done', () => {
  res.end();
});

request.query("SELECT ... FOR JSON PATH");
```

---

### GET /api/failure-test

Tests input validation by attempting to pass an invalid parameter. Validates that error handling works correctly.

**Query Parameters:** None

**Response (Expected - validation working):**
```json
{
  "success": true,
  "message": "Bad record test failed as expected"
}
```

**Response (Unexpected - validation not working):**
```json
{
  "success": false,
  "message": "Bad record test did not fail as expected"
}
```

**Purpose:**
- Verify input validation is functioning
- Test that invalid parameters are rejected
- Ensure error handling doesn't crash the application

**Example:**
```powershell
Invoke-WebRequest http://localhost:1533/api/failure-test
```

**Implementation Details:**
- Calls `testBadRecord()` which attempts to use invalid parameter (-1)
- Expects an error to be thrown by validation logic
- Returns success if validation properly rejects bad input

---

### GET /api/test-db-error

Tests database error handling by intentionally querying a non-existent table. Demonstrates structured error responses.

**Query Parameters:** None

**Response:**
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

**Purpose:**
- Test error handling middleware
- Verify structured error responses
- Ensure database errors are properly caught and logged

**Example:**
```powershell
Invoke-WebRequest http://localhost:1533/api/test-db-error
```

**Implementation Details:**
- Queries `NonExistentTable` which doesn't exist
- Error is caught by `executeQuery` wrapper
- Wrapped in `DatabaseError` by controller
- Processed by error middleware for consistent response

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `DATABASE_UNAVAILABLE` | 503 | Database connection failed or pool is unavailable |
| `DATABASE_TIMEOUT` | 504 | Query exceeded timeout threshold |
| `DATABASE_ERROR` | 500 | General database error (query failed, syntax error, etc.) |
| `ROUTE_NOT_FOUND` | 404 | Requested API endpoint doesn't exist |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Error Response Structure

All errors include:
- **code**: Machine-readable error identifier
- **message**: User-friendly error description
- **status**: HTTP status code

**Example Error Response:**
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

### Connection Errors (503)

Triggered when:
- Cannot connect to database server
- Connection pool is exhausted
- Network connectivity issues

**Automatic Recovery:**
- Connection pool is automatically reset
- Next request will attempt to reconnect
- Error is logged for debugging

### Timeout Errors (504)

Triggered when:
- Query exceeds `requestTimeout` (default: 30 seconds)
- Connection attempt exceeds `connectionTimeout` (default: 15 seconds)

**Solutions:**
- Optimize slow queries
- Add database indexes
- Increase timeout values in pool configuration

### Query Errors (500)

Triggered when:
- SQL syntax error
- Table or column doesn't exist
- Constraint violations
- Permission denied

**Debugging:**
- Enable debug logging: `DEBUG=express-mssql-pooling:*`
- Check logs for detailed error information
- Review query syntax and parameters

---

## 404 Not Found

Any request to an undefined API route returns:

```json
{
  "success": false,
  "error": {
    "code": "ROUTE_NOT_FOUND",
    "message": "The requested API endpoint does not exist",
    "status": 404,
    "path": "/api/undefined-route"
  }
}
```

**Example:**
```powershell
Invoke-WebRequest http://localhost:1533/api/undefined-route
# Returns 404 with error details
```

---

## Testing All Endpoints

### PowerShell Test Script

```powershell
# Test all endpoints
$baseUrl = "http://localhost:1533/api"

Write-Host "Testing API Root..."
Invoke-WebRequest "$baseUrl/" | ConvertFrom-Json

Write-Host "Testing Initial Test..."
Invoke-WebRequest "$baseUrl/initial-test" | ConvertFrom-Json

Write-Host "Testing Record Count..."
Invoke-WebRequest "$baseUrl/record-count" | ConvertFrom-Json

Write-Host "Testing Stream..."
Invoke-WebRequest "$baseUrl/test-stream"

Write-Host "Testing Failure Test..."
Invoke-WebRequest "$baseUrl/failure-test" | ConvertFrom-Json

Write-Host "Testing Database Error..."
Invoke-WebRequest "$baseUrl/test-db-error" -ErrorAction SilentlyContinue

Write-Host "Testing 404..."
Invoke-WebRequest "$baseUrl/invalid-route" -ErrorAction SilentlyContinue
```

### cURL Test Script

```bash
# Test all endpoints
BASE_URL="http://localhost:1533/api"

echo "Testing API Root..."
curl "$BASE_URL/"

echo "Testing Initial Test..."
curl "$BASE_URL/initial-test"

echo "Testing Record Count..."
curl "$BASE_URL/record-count"

echo "Testing Stream..."
curl "$BASE_URL/test-stream"

echo "Testing Failure Test..."
curl "$BASE_URL/failure-test"

echo "Testing Database Error..."
curl "$BASE_URL/test-db-error"

echo "Testing 404..."
curl "$BASE_URL/invalid-route"
```

---

## Best Practices

### For API Consumers

1. **Always check `success` field** in responses
2. **Handle all error codes appropriately**:
   - 503: Retry with exponential backoff
   - 504: Increase timeout or optimize query
   - 500: Log error and notify support
   - 404: Check endpoint URL
3. **Use streaming endpoints** for large datasets
4. **Implement timeout handling** on client side
5. **Log error details** for debugging

### For Developers

1. **Use executeQuery wrapper** for all database operations
2. **Wrap errors in DatabaseError** in controllers
3. **Pass errors to next()** for middleware handling
4. **Validate inputs** before database calls
5. **Use prepared statements** to prevent SQL injection
6. **Enable debug logging** during development
7. **Test error scenarios** explicitly

---

## See Also

- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Application setup and configuration
- [executequery_pattern.md](executequery_pattern.md) - Query wrapper pattern details
- [debug_and_logging.md](debug_and_logging.md) - Debugging and logging guide
- [load_testing.md](load_testing.md) - Performance testing guide
