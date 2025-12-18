# Debugging and Logging Guide

This application uses a three-layer logging and debugging architecture to provide comprehensive visibility across development and production environments.

## Architecture Overview

The application combines three complementary tools:

1. **`debug.js`** - Namespace-based development diagnostics
2. **`logger.js` (Winston)** - Persistent application logging
3. **`morgan`** - HTTP request/response tracking

Each layer serves a specific purpose and operates independently, but they can be used together for complete application insight.

---

## Layer 1: Debug Module (`src/utils/debug.js`)

### Purpose
Provides granular, namespace-based debugging for development and troubleshooting. Based on the popular `debug` npm package.

### How It Works
- **Namespaced output**: Each module has its own namespace (e.g., `express-mssql-pooling:application`, `express-mssql-pooling:route`)
- **Selective activation**: Control which namespaces output via the `DEBUG` environment variable
- **Zero overhead when disabled**: When not active, debug calls have minimal performance impact
- **Stderr output**: Separate from regular logging streams

### Available Namespaces

```javascript
debugServer      // express-mssql-pooling:server      - Server startup and lifecycle
debugApplication // express-mssql-pooling:application - App initialization and config
debugRoutes      // express-mssql-pooling:route       - Route handling and middleware
debugMSSQL       // express-mssql-pooling:mssql       - Database operations and pool management
```

### Usage Examples

**Enable all debug output:**
```bash
DEBUG=express-mssql-pooling:* npm start
```

**Enable specific namespaces:**
```bash
DEBUG=express-mssql-pooling:application,express-mssql-pooling:route npm start
```

**Debug only database operations:**
```bash
DEBUG=express-mssql-pooling:mssql npm start
```

**In your code:**
```javascript
import { debugApplication, debugRoutes, debugMSSQL } from './utils/debug.js';

debugApplication(`App starting with environment: ${process.env.NODE_ENV}`);
debugRoutes(`Handling request to ${req.path}`);
debugMSSQL('Creating new connection pool');
```

### When to Use
- Tracing initialization sequences
- Debugging route/middleware execution flow
- Understanding configuration loading
- Development troubleshooting where you need detailed, granular output
- Performance profiling during development

---

## Layer 2: Winston Logger (`src/utils/logger.js`)

### Purpose
Persistent, structured application logging for monitoring runtime events, errors, and important state changes across all environments.

### Configuration by Environment

#### Development Mode
- **Level**: `debug` (most verbose)
- **Format**: Pretty-printed with timestamps and colors
- **Output**: Console only
- **File storage**: None
- **Use for**: Quick local feedback during development

```
[14:32:45] info: User logged in
[14:32:46] error: Database connection failed
```

#### Production Mode
- **Level**: `info` (only important events)
- **Format**: JSON (machine-readable)
- **Output**: Console + `logs/app.log`
- **File storage**: Yes, persisted to disk
- **Use for**: Log aggregation, monitoring, auditing

```json
{"level":"info","message":"User logged in","timestamp":"2025-12-07T14:32:45.123Z"}
```

### Usage Examples

```javascript
import logger from './utils/logger.js';

logger.info('Request processed successfully');
logger.error('Failed to connect to database', { error: err });
logger.warn('High memory usage detected');
logger.debug('Processing item 42 of 100');
```

### When to Use
- Recording business logic events
- Capturing errors and exceptions
- Monitoring application health
- Auditing user actions
- Creating searchable logs in production
- Long-term troubleshooting and analysis

---

## Layer 3: Morgan HTTP Logging

### Purpose
Automatic HTTP request and response logging. Captures every request that hits your application with metadata like method, path, status code, and response time.

### Configuration by Environment

#### Development Mode
- **Format**: `dev` (Morgan's development format)
- **Output**: Colored console output
- **Integration**: Direct to terminal (bypasses Winston)
- **Style**: Concise and readable

```
GET / 200 5.234 ms - 2048
POST /api/users 201 15.892 ms - 512
GET /nonexistent 404 1.234 ms - 145
```

#### Production Mode
- **Format**: `combined` (Apache combined log format)
- **Output**: Routed through Winston → `logs/app.log` + Console
- **Integration**: Unified with application logs in JSON format
- **Completeness**: Full request/response details

```json
{"level":"info","message":"GET / 200 5.234 ms - 2048","timestamp":"2025-12-07T14:32:45.123Z"}
```

### What Morgan Captures
- **Method**: HTTP verb (GET, POST, etc.)
- **Path**: Request URL path
- **Status**: HTTP response code
- **Response time**: Milliseconds to complete
- **Size**: Response body size in bytes
- **User-Agent**: Client information (in combined format)
- **IP address**: Client IP address

### When to Use
- Monitoring API traffic patterns
- Detecting slow endpoints
- Tracking request volume
- Debugging HTTP layer issues
- Understanding user behavior through access patterns

---

## How They Work Together

### Typical Development Workflow

```
Terminal Session:
$ DEBUG=express-mssql-pooling:* npm start

Output Stream 1 (Stderr - Debug):
  express-mssql-pooling:application App initialized with config: {...}
  express-mssql-pooling:route GET / matched indexRouter
  express-mssql-pooling:application Connecting to database...

Output Stream 2 (Stdout - Morgan):
  GET / 200 12.456 ms - 2048
  POST /api/users 201 45.123 ms - 512

Output Stream 3 (Stdout - Winston):
  [14:32:45] info: Server listening on port 3000
  [14:32:46] info: Database connected
```

### Typical Production Scenario

All three layers write to unified locations:

1. **Console output** (for Docker/process management):
   ```
   {"level":"info","message":"Server listening on port 3000"}
   {"level":"info","message":"GET /api/users 200 45.123 ms - 512"}
   ```

2. **File storage** (`logs/app.log`):
   - All Winston logger output (errors, state changes)
   - All Morgan HTTP requests (routed through Winston)
   - Structured JSON format for log aggregation
   - Searchable and indexable

3. **Debug module**: Disabled (DEBUG env var not set)
   - No performance overhead
   - No output

---

## Quick Reference Table

| Need | Tool | Environment | Command/Code |
|------|------|-------------|--------------|
| Trace app startup | `debug.js` | Dev | `DEBUG=express-mssql-pooling:application npm start` |
| Debug route handler | `debug.js` | Dev | `debugRoutes('Handler details...')` |
| Debug database operations | `debug.js` | Dev | `DEBUG=express-mssql-pooling:mssql npm start` |
| Trace connection pool | `debug.js` | Dev | `debugMSSQL('Pool operation...')` |
| Log business events | `winston` | Both | `logger.info('Event occurred')` |
| Monitor HTTP traffic | `morgan` | Both | Automatic, no config needed |
| Find errors in production | `winston` | Prod | View `logs/app.log` |
| Analyze API usage | `morgan` | Both | Access logs in `app.log` or console |
| Performance profiling | `morgan` | Dev | Look at response times |
| Troubleshoot live issue | `debug.js` + `winston` | Prod | Add debug calls, redeploy |

---

## Best Practices

### Do's ✅
- Use `debug.js` for development-focused, granular diagnostics
- Use `logger` for events that matter in production (errors, business logic)
- Use `morgan` to monitor all HTTP traffic without extra code
- Combine all three in development for maximum visibility
- Use JSON format in production for log aggregation tools

### Don'ts ❌
- Don't use `console.log()` - use logger instead
- Don't disable morgan in production
- Don't log sensitive data (passwords, tokens, PII)
- Don't rely solely on debug output for production troubleshooting
- Don't set `DEBUG=*` in production (performance impact)

---

## Common Scenarios

### "My route handler isn't being called"
```bash
DEBUG=express-mssql-pooling:route npm start
# Look for route matching logs
```

### "Users report slow requests"
```
Check logs/app.log for morgan entries with high response times
Identify which endpoints are slow
Use debugRoutes to add detailed timing in handler
```

### "Errors aren't being captured"
```javascript
// Ensure you're using logger, not console.error
logger.error('Something went wrong', { error: err, context: 'user signup' });
```

### "Need to debug production issue"
```
1. Check logs/app.log for context (morgan + logger entries)
2. Add temporary debugApplication/debugRoutes calls
3. Redeploy with DEBUG=express-mssql-pooling:* in environment
4. Monitor live output
5. Remove debug calls, redeploy
```

### "Want to understand request flow"
```bash
DEBUG=express-mssql-pooling:* npm start
# Watch debug output for initialization
# Watch morgan for each request
# Watch winston for business logic events
```

---

## File Locations

- **Debug configuration**: `src/utils/debug.js`
- **Logger configuration**: `src/utils/logger.js`
- **Morgan setup**: `src/app.js` (lines 39-52)
- **Application logs**: `logs/app.log` (production only)
- **Access logs**: `logs/access.log` (created by morgan configuration, currently unused)
