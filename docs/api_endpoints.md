# API Endpoints Documentation

This document provides comprehensive documentation for all API endpoints in the Express MSSQL Pooling application.

## Base URL

```
http://localhost:1533/api
```

**Note**: The port can be configured via the `PORT` environment variable in `.env`

---

## Endpoints

### 1. API Root

Get information about the API.

**Endpoint**: `GET /api/`

**Response**:
```json
{
  "message": "Welcome to the API root!"
}
```

**Status Codes**:
- `200 OK` - Success

**Example**:
```bash
curl http://localhost:1533/api/
```

---

### 2. Initial Test

Test database connectivity with a simple parameterized query.

**Endpoint**: `GET /api/initial-test`

**Description**: Executes a simple test query using prepared statements to verify database connectivity and connection pool health.

**Response**:
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

**Status Codes**:
- `200 OK` - Query executed successfully
- `500 Internal Server Error` - Database error
- `503 Service Unavailable` - Database connection unavailable

**Example**:
```bash
curl http://localhost:1533/api/initial-test
```

**PowerShell Example**:
```powershell
Invoke-WebRequest -Uri "http://localhost:1533/api/initial-test" -UseBasicParsing | ConvertFrom-Json
```

---

### 3. Record Count

Get the total count of records in the TestRecords table.

**Endpoint**: `GET /api/record-count`

**Description**: Returns the total number of records in the TestRecords table using a COUNT query.

**Response**:
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

**Status Codes**:
- `200 OK` - Query executed successfully
- `500 Internal Server Error` - Database error
- `503 Service Unavailable` - Database connection unavailable

**Example**:
```bash
curl http://localhost:1533/api/record-count
```

**PowerShell Example**:
```powershell
Invoke-WebRequest -Uri "http://localhost:1533/api/record-count" -UseBasicParsing | ConvertFrom-Json
```

---

### 4. Test Stream

Stream large datasets using SQL Server's streaming capabilities.

**Endpoint**: `GET /api/test-stream`

**Description**: Demonstrates streaming large result sets using chunked transfer encoding. Generates 10,000 records with UUIDs and streams them as JSON.

**Response**: JSON array streamed in chunks
```json
[
  {"value":1,"UUID":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"},
  {"value":2,"UUID":"b2c3d4e5-f6a7-8901-bcde-f12345678901"},
  ...
]
```

**Headers**:
- `Content-Type: application/json`
- `Transfer-Encoding: chunked`

**Status Codes**:
- `200 OK` - Streaming started successfully
- `500 Internal Server Error` - Database or streaming error

**Example**:
```bash
curl http://localhost:1533/api/test-stream
```

**Note**: This endpoint demonstrates memory-efficient streaming for large datasets.

---

### 5. Failure Test

Test error handling by intentionally triggering a validation error.

**Endpoint**: `GET /api/failure-test`

**Description**: Tests database error handling by passing invalid input (-1) to trigger validation. Used to verify error handling middleware works correctly.

**Response** (Success - error handling working):
```json
{
  "success": true,
  "message": "Bad record test failed as expected"
}
```

**Response** (Failure - error handling not working):
```json
{
  "success": false,
  "message": "Bad record test did not fail as expected"
}
```

**Status Codes**:
- `200 OK` - Error handling test passed (error was caught correctly)
- `500 Internal Server Error` - Error handling test failed

**Example**:
```bash
curl http://localhost:1533/api/failure-test
```

---

### 6. Test Database Error

Test database error middleware by querying a non-existent table.

**Endpoint**: `GET /api/test-db-error`

**Description**: Intentionally queries a table that doesn't exist to test database error handling and logging. Used for development and testing.

**Response**:
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

**Status Codes**:
- `500 Internal Server Error` - Expected (table doesn't exist)
- `503 Service Unavailable` - Database connection unavailable

**Example**:
```bash
curl http://localhost:1533/api/test-db-error
```

---

## Error Responses

All API endpoints follow a consistent error response format.

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "status": 500
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `DATABASE_ERROR` | 500 | General database error |
| `DATABASE_UNAVAILABLE` | 503 | Database service unavailable |
| `DATABASE_TIMEOUT` | 504 | Database request timed out |
| `ROUTE_NOT_FOUND` | 404 | API endpoint doesn't exist |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Common Status Codes

- **200 OK** - Request successful
- **400 Bad Request** - Invalid request parameters
- **404 Not Found** - Endpoint doesn't exist
- **500 Internal Server Error** - Server or database error
- **503 Service Unavailable** - Database connection unavailable
- **504 Gateway Timeout** - Database query timed out

---

## Request Examples

### Using cURL

```bash
# Basic GET request
curl http://localhost:1533/api/initial-test

# With verbose output
curl -v http://localhost:1533/api/record-count

# Save response to file
curl -o response.json http://localhost:1533/api/initial-test

# Pretty print JSON (requires jq)
curl http://localhost:1533/api/record-count | jq
```

### Using PowerShell

```powershell
# Basic request
Invoke-WebRequest -Uri "http://localhost:1533/api/initial-test"

# Parse JSON response
(Invoke-WebRequest -Uri "http://localhost:1533/api/record-count" -UseBasicParsing).Content | ConvertFrom-Json

# Get only the data
$response = Invoke-RestMethod -Uri "http://localhost:1533/api/record-count"
$response.data
```

### Using JavaScript (fetch)

```javascript
// Basic fetch
fetch('http://localhost:1533/api/initial-test')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));

// With async/await
async function getRecordCount() {
  try {
    const response = await fetch('http://localhost:1533/api/record-count');
    const data = await response.json();
    console.log('Record count:', data.data[0].totalRecords);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Using Python (requests)

```python
import requests

# Basic request
response = requests.get('http://localhost:1533/api/initial-test')
data = response.json()
print(data)

# With error handling
try:
    response = requests.get('http://localhost:1533/api/record-count')
    response.raise_for_status()
    data = response.json()
    print(f"Total records: {data['data'][0]['totalRecords']}")
except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
```

---

## Rate Limiting

Currently, no rate limiting is implemented. The application can handle:
- **80,000+ requests per minute**
- **20+ concurrent connections**
- **14ms average latency**

See [load_testing.md](load_testing.md) for performance benchmarks and optimization details.

---

## Authentication

Currently, no authentication is required for API endpoints. This is a development/demo application.

For production use, consider implementing:
- API key authentication
- JWT tokens
- OAuth 2.0
- Rate limiting per client

---

## CORS

CORS is enabled for all origins in development. Configure `cors` middleware in `src/app.js` for production.

**Current Configuration**:
```javascript
app.use(cors()); // Allow all origins
```

**Production Example**:
```javascript
app.use(cors({
  origin: 'https://yourdomain.com',
  methods: ['GET', 'POST'],
  credentials: true
}));
```

---

## Debugging API Requests

Enable debug logging to see detailed API request information:

```bash
# Enable all debug output
DEBUG=express-mssql-pooling:* npm start

# Enable only database logs
DEBUG=express-mssql-pooling:mssql npm start

# Enable application and route logs
DEBUG=express-mssql-pooling:application,express-mssql-pooling:route npm start
```

See [debug_and_logging.md](debug_and_logging.md) for more debugging options.

---

## Health Check Endpoint

While not currently implemented as a dedicated endpoint, you can use `/api/initial-test` as a health check:

```bash
# Health check with curl
curl -f http://localhost:1533/api/initial-test || echo "Service down"

# Health check response time
curl -w "@-" -o /dev/null -s http://localhost:1533/api/initial-test <<'EOF'
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
      time_redirect:  %{time_redirect}\n
   time_pretransfer:  %{time_pretransfer}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
EOF
```

---

## Adding New Endpoints

To add a new API endpoint:

1. **Create controller function** in `src/controllers/apiController.js`:
```javascript
export const myNewEndpoint = async (req, res, next) => {
  try {
    const result = await executeQuery(async () => {
      const localPool = await getConnectionPool();
      const request = localPool.request();
      // Your query here
      return result;
    }, "myNewEndpoint");
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(new DatabaseError(error, 'myNewEndpoint'));
  }
};
```

2. **Register route** in `src/routes/apiRouter.js`:
```javascript
import { myNewEndpoint } from '../controllers/apiController.js';
apiRouter.get('/my-endpoint', myNewEndpoint);
```

3. **Update this documentation** with the new endpoint details

See [executequery_pattern.md](executequery_pattern.md) for best practices.

---

## See Also

- [README.md](../README.md) - Project overview and quick start
- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Complete setup instructions
- [executequery_pattern.md](executequery_pattern.md) - Database query patterns
- [debug_and_logging.md](debug_and_logging.md) - Debugging and logging
- [load_testing.md](load_testing.md) - Performance testing
