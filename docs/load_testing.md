# Load Testing Guide

## Overview

This guide covers load testing the Express + SQL Server application using autocannon, interpreting results, and tuning connection pool settings based on performance metrics.

## Prerequisites

Install autocannon as a dev dependency:

```powershell
npm install -D autocannon
```

## Running Load Tests

### Basic Load Test

The project includes a pre-configured load test script at [scripts/load-test.js](../scripts/load-test.js):

```powershell
node .\scripts\load-test.js
```

**Test Configuration**:
- **Connections**: 20 concurrent users
- **Duration**: 60 seconds
- **Target Endpoint**: `/api/record-count`
- **Method**: GET
- **Server**: http://localhost:1533

### Custom Load Test

Create a custom test with autocannon's API:

```javascript
import autocannon from 'autocannon';

const result = await autocannon({
    url: 'http://localhost:1533/api/your-endpoint',
    connections: 10,        // Concurrent connections
    duration: 30,           // Test duration in seconds
    pipelining: 1,          // Requests per connection
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
});

console.log(result);
```

### POST Request Load Test

Test endpoints that modify data:

```javascript
import autocannon from 'autocannon';

const result = await autocannon({
    url: 'http://localhost:1533/api/records',
    connections: 20,
    duration: 60,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        recQy: 5,
        description: 'Load test record'
    })
});
```

## Interpreting Results

### Sample Output

```
Running 60s test @ http://localhost:1533/api/record-count
20 connections

┌─────────┬────────┬────────┬────────┬────────┬───────────┬──────────┬────────┐
│ Stat    │ 2.5%   │ 50%    │ 97.5%  │ 99%    │ Avg       │ Stdev    │ Max    │
├─────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│ Latency │ 10 ms  │ 13 ms  │ 18 ms  │ 20 ms  │ 14 ms     │ 3.2 ms   │ 45 ms  │
└─────────┴────────┴────────┴────────┴────────┴───────────┴──────────┴────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Req/Sec   │ 454,015 │ 454,015 │ 479,231 │ 492,543 │ 477,355 │ 10,234  │ 454,006 │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Bytes/Sec │ 112 MB  │ 112 MB  │ 118 MB  │ 121 MB  │ 117 MB  │ 2.52 MB │ 112 MB  │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

Total: 83991 requests in 60.03s, 7.03 GB read
Req/Sec: 477,355 average
Latency: 14ms average
Errors: 0 (0%)
Timeouts: 0 (0%)
```

### Key Metrics Explained

#### Latency
Time from sending request to receiving complete response.

- **2.5% / 50% / 97.5% / 99%**: Percentile distribution
- **Avg**: Average latency across all requests
- **Stdev**: Standard deviation (consistency indicator)
- **Max**: Worst-case latency

**What's Good?**
- **< 20ms avg**: Excellent for local database
- **< 100ms avg**: Good for production with remote DB
- **< 50ms p99**: Consistent performance
- **Low Stdev**: Predictable response times

**Warning Signs**:
- **p99 > 500ms**: Connection pool saturation
- **High Stdev (>100ms)**: Inconsistent performance
- **Max > 5000ms**: Connection timeouts occurring

#### Throughput (Req/Sec)
Number of requests handled per second.

- **1% / 2.5% / 50% / 97.5%**: Throughput distribution
- **Avg**: Average requests per second
- **Stdev**: Throughput consistency
- **Min**: Lowest throughput measured

**What's Good?**
- **> 1,000 req/sec**: Good for most applications
- **> 10,000 req/sec**: Excellent performance
- **> 100,000 req/sec**: High-performance system

#### Error Rate
Percentage of requests that failed.

**Target**: 0% for production systems

**Common Error Causes**:
- **> 0%**: Connection pool exhausted
- **> 5%**: Serious configuration issue
- **> 50%**: Application or database failure

#### Timeouts
Requests that exceeded the timeout threshold.

**Target**: 0 timeouts

**Causes**:
- Connection pool saturation
- Database query timeout
- Network issues

## Baseline Test Results

### Initial Configuration (Before Optimization)

**Pool Settings**: `max: 10, min: 0`

```
Total Requests: 23,450
Average Latency: 512ms
P99 Latency: 1,200ms
Errors: 234 (1.0%)
Timeouts: 12
```

**Problems**:
- High latency due to connection pool exhaustion
- Errors when all 10 connections busy
- Timeouts from waiting for available connections

### Optimized Configuration (Current)

**Pool Settings**: `max: 25, min: 5, idleTimeoutMillis: 60000`

```
Total Requests: 83,991
Average Latency: 14ms
P99 Latency: 20ms
Errors: 0 (0%)
Timeouts: 0
```

**Improvements**:
- **3.6x more requests** (23,450 → 83,991)
- **36x faster latency** (512ms → 14ms)
- **0% error rate** (1.0% → 0%)
- **No timeouts** (12 → 0)

## Tuning Connection Pool Settings

### Understanding Pool Parameters

```javascript
pool: {
    max: 25,                  // Maximum connections
    min: 5,                   // Minimum idle connections
    idleTimeoutMillis: 60000, // Close idle after 60s
}
```

#### max (Maximum Connections)

**Definition**: Maximum number of simultaneous database connections.

**Too Low**:
- High latency under load
- Request queuing
- Timeout errors
- Poor throughput

**Too High**:
- Excessive database resource usage
- Slower query execution (DB contention)
- Memory overhead

**Finding the Right Value**:

1. Start with conservative setting (10-20)
2. Run load test
3. Monitor for:
   - Latency > 100ms
   - Errors > 0%
   - Timeouts > 0

4. If problems occur:
   - Increase `max` by 5-10
   - Retest
   - Repeat until metrics improve

5. Don't exceed:
   - SQL Server connection limit
   - Available memory
   - 2x your expected concurrent users

**Formula**: `max = concurrent_users * 1.25` (with 25% buffer)

#### min (Minimum Connections)

**Definition**: Number of connections kept warm and ready.

**Benefits**:
- Eliminates connection establishment latency
- Faster first request after idle period
- Consistent performance

**Too Low (min: 0)**:
- Cold start latency on first request
- Inconsistent response times

**Too High (min: max)**:
- Wastes resources when idle
- Unnecessary database load

**Recommended**:
- **Low traffic**: `min: 2-5`
- **Medium traffic**: `min: 5-10`
- **High traffic**: `min: 10-20`
- **Rule**: `min = max * 0.2` (20% of max)

#### idleTimeoutMillis

**Definition**: How long to keep unused connections before closing.

**Too Short (< 10000)**:
- Frequent connection churn
- Higher overhead from open/close cycles

**Too Long (> 300000)**:
- Wastes resources
- Holds connections unnecessarily

**Recommended**:
- **Development**: 30,000ms (30 seconds)
- **Production**: 60,000ms (60 seconds)
- **High traffic**: 120,000ms (2 minutes)

### Tuning Process

#### Step 1: Establish Baseline

Run test with conservative settings:

```javascript
pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000
}
```

```powershell
node .\scripts\load-test.js
```

Record:
- Average latency
- P99 latency
- Error rate
- Timeouts

#### Step 2: Identify Bottlenecks

**High Latency (> 100ms avg)**:
- Increase `max` by 5-10
- Increase `min` proportionally

**Errors or Timeouts**:
- Pool exhausted → increase `max`
- Check debug logs for connection errors

**Inconsistent Performance (high Stdev)**:
- Increase `min` for more warm connections

#### Step 3: Optimize

Iteratively adjust and retest:

```javascript
// Test 1
pool: { max: 15, min: 3, idleTimeoutMillis: 30000 }

// Test 2
pool: { max: 20, min: 4, idleTimeoutMillis: 60000 }

// Test 3
pool: { max: 25, min: 5, idleTimeoutMillis: 60000 } // ✅ Optimal
```

#### Step 4: Validate

Run extended test (5-10 minutes):

```javascript
const result = await autocannon({
    url: 'http://localhost:1533/api/record-count',
    connections: 20,
    duration: 300,  // 5 minutes
});
```

Verify:
- ✅ 0% error rate
- ✅ 0 timeouts
- ✅ Consistent latency (low Stdev)
- ✅ P99 latency < 100ms

## Monitoring During Load Tests

### Enable Debug Logging

```powershell
$env:DEBUG="express-mssql-pooling:*"
node .\scripts\load-test.js
```

**Watch for**:
- `Creating new connection pool` - Should appear once
- `Connection error detected` - Should be 0 occurrences
- `Resetting connection pool` - Indicates connection problems
- `Query [name] completed successfully` - Normal operations

### SQL Server Monitoring

Monitor SQL Server during tests:

```sql
-- Active connections
SELECT 
    DB_NAME(dbid) as DatabaseName,
    COUNT(dbid) as NumberOfConnections
FROM sys.sysprocesses
WHERE dbid > 0
GROUP BY dbid;

-- Connection pool stats
SELECT 
    * 
FROM sys.dm_exec_connections
WHERE client_net_address = '::1';  -- localhost
```

## Load Test Scenarios

### Scenario 1: Steady State Load

Simulate constant traffic:

```javascript
const result = await autocannon({
    url: 'http://localhost:1533/api/record-count',
    connections: 10,
    duration: 120,
});
```

**Goal**: Validate stable performance over time.

### Scenario 2: Burst Load

Simulate traffic spikes:

```javascript
const result = await autocannon({
    url: 'http://localhost:1533/api/record-count',
    connections: 50,
    duration: 30,
});
```

**Goal**: Test peak capacity and recovery.

### Scenario 3: Gradual Ramp-Up

Simulate growing traffic:

```javascript
// Test 1: 10 connections
// Test 2: 20 connections
// Test 3: 30 connections
// etc.
```

**Goal**: Find breaking point and optimal pool size.

### Scenario 4: Mixed Workload

Test multiple endpoints:

```javascript
import autocannon from 'autocannon';

const endpoints = [
    '/api/record-count',
    '/api/initial-test',
    '/api/records?qty=5'
];

for (const endpoint of endpoints) {
    const result = await autocannon({
        url: `http://localhost:1533${endpoint}`,
        connections: 20,
        duration: 60,
    });
    
    console.log(`\nResults for ${endpoint}:`);
    console.log(`  Avg Latency: ${result.latency.mean}ms`);
    console.log(`  Errors: ${result.errors}`);
}
```

**Goal**: Validate realistic usage patterns.

## Common Issues and Solutions

### Issue: High Error Rate

**Symptoms**:
```
Errors: 1,234 (5.2%)
```

**Causes**:
- Connection pool exhausted
- Database connection limit reached
- Query timeouts

**Solutions**:
1. Increase `max` pool size
2. Check SQL Server connection limit
3. Optimize slow queries
4. Add indexes to frequently queried columns

### Issue: High Latency

**Symptoms**:
```
Average Latency: 450ms
P99 Latency: 1,200ms
```

**Causes**:
- Pool saturation (waiting for connections)
- Slow database queries
- Network latency

**Solutions**:
1. Increase `max` and `min` pool size
2. Analyze slow queries with SQL Server Profiler
3. Add database indexes
4. Use query result caching

### Issue: Timeouts

**Symptoms**:
```
Timeouts: 45 (0.5%)
```

**Causes**:
- `requestTimeout` too low
- Database deadlocks
- Long-running queries

**Solutions**:
1. Increase `requestTimeout` in pool config:
   ```javascript
   pool: {
       requestTimeout: 60000  // 60 seconds
   }
   ```
2. Optimize queries
3. Check for database deadlocks

### Issue: Memory Growth

**Symptoms**:
- Node.js process memory increases during test
- Doesn't return to baseline after test

**Causes**:
- Connection leaks (not returned to pool)
- Result set caching issues

**Solutions**:
1. Ensure all queries use `executeQuery` wrapper
2. Monitor pool stats with `isPoolHealthy()`
3. Check for unclosed connections in code

## Best Practices

### 1. Test Before Production

Always load test before deploying:
- Run tests matching production traffic patterns
- Test for 10x expected peak load
- Validate 0% error rate under load

### 2. Baseline Everything

Record baseline metrics:
- Performance before optimization
- Performance after each change
- Production performance metrics

### 3. Monitor Production

Set up monitoring:
- Average response time
- Error rate
- Database connection count
- Node.js memory usage

### 4. Gradual Scaling

Don't over-provision:
- Start with conservative pool settings
- Scale up based on actual metrics
- Monitor resource usage

### 5. Regular Testing

Schedule regular load tests:
- After code changes
- After dependency updates
- Before major releases
- Quarterly baseline tests

## Advanced Topics

### Connection Pool Metrics

Monitor pool health programmatically:

```javascript
import { isPoolHealthy } from './src/services/database.js';

// Health check endpoint
app.get('/health/db', async (req, res) => {
    const healthy = await isPoolHealthy();
    res.status(healthy ? 200 : 503).json({ 
        healthy,
        timestamp: new Date().toISOString() 
    });
});
```

### Custom Autocannon Scripts

Create reusable test runner:

```javascript
// scripts/load-test-runner.js
import autocannon from 'autocannon';

async function runTest(endpoint, connections, duration) {
    console.log(`\nTesting ${endpoint} with ${connections} connections...`);
    
    const result = await autocannon({
        url: `http://localhost:1533${endpoint}`,
        connections,
        duration,
    });
    
    return {
        endpoint,
        avgLatency: result.latency.mean,
        p99Latency: result.latency.p99,
        throughput: result.requests.average,
        errors: result.errors,
        timeouts: result.timeouts,
    };
}

// Run test matrix
const tests = [
    { endpoint: '/api/record-count', connections: 10, duration: 60 },
    { endpoint: '/api/record-count', connections: 20, duration: 60 },
    { endpoint: '/api/record-count', connections: 30, duration: 60 },
];

const results = [];
for (const test of tests) {
    const result = await runTest(test.endpoint, test.connections, test.duration);
    results.push(result);
}

console.table(results);
```

## See Also

- [README.md](../README.md) - Performance benchmarks
- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Connection pool configuration
- [executequery_pattern.md](executequery_pattern.md) - Query error handling
- [autocannon documentation](https://github.com/mcollina/autocannon)
