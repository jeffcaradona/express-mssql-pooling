# Load Testing Guide

## Overview

This guide covers load testing the Express + SQL Server application using autocannon, interpreting results, and tuning connection pool settings based on performance metrics.

**Important**: This guide includes a comprehensive section on [Understanding Database-Backed API Latency](#understanding-database-backed-api-latency) that explains why database-connected APIs require special consideration when interpreting autocannon results, particularly p95/p99 latency metrics. Database-backed APIs introduce complexity not present in stateless APIs, including connection pool queuing, resource contention, lock waits, and cache effects.

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
- **Duration**: 30 seconds
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

## Understanding Database-Backed API Latency

### Why Database-Backed APIs Are Different

When load testing **stateless APIs** (e.g., simple calculation endpoints, static data responses), metrics like p95 and p99 latency are generally straightforward to interpret. These APIs typically have:

- **Predictable latency**: Consistent response times with minimal variance
- **Linear scaling**: Performance scales predictably with load
- **Simple bottlenecks**: CPU and memory are primary constraints
- **Minimal external dependencies**: No I/O wait or resource contention

However, **database-backed APIs** introduce significant complexity that can make interpreting autocannon results challenging. The database layer adds multiple sources of latency and variability that don't exist in stateless systems.

### Key Factors That Impact Database API Latency

#### 1. Connection Pool Dynamics

**Connection Pool Contention**:
- When all connections in the pool are busy, new requests must wait in a queue
- This waiting time is **not** captured as "database time" but appears as total request latency
- p99 latency often reflects **queue wait time** rather than actual query execution time

**Example Scenario**:
```
Pool size: 10 connections
Concurrent requests: 50
Query execution time: 10ms

Expected latency: 10ms (ideal)
Actual p99 latency: 150ms+ (includes queue wait)
```

**What This Means for Autocannon Results**:
- High p95/p99 values may indicate pool exhaustion, not slow queries
- The gap between median (p50) and p99 reveals queuing behavior
- Large variance in latency suggests intermittent pool saturation

#### 2. Database Server Resource Contention

**CPU and Memory Pressure**:
- Multiple concurrent queries compete for database server resources
- SQL Server manages its own thread pool and query scheduler
- Query execution time varies based on current database load

**Lock Contention and Blocking**:
- Read queries may wait for write transactions to commit
- Shared locks can block exclusive locks and vice versa
- Lock escalation can suddenly slow down queries

**Buffer Pool and Cache Effects**:
- First query may hit disk (slow: 5-50ms)
- Subsequent queries hit memory cache (fast: <1ms)
- This creates **bimodal latency distribution** not seen in stateless APIs

**Impact on Metrics**:
```
Stateless API:         Database API:
p50: 10ms             p50: 12ms
p95: 12ms             p95: 45ms
p99: 15ms             p99: 120ms
Max: 20ms             Max: 500ms
```

The database API shows much higher variance due to resource contention.

#### 3. Query Complexity and Data Volume

**Variable Query Performance**:
- Simple queries (e.g., `SELECT COUNT(*)`) may return in <5ms
- Complex joins or aggregations may take 50-200ms
- Query plans can change based on statistics and parameter values

**Disk I/O Dependency**:
- Queries that exceed buffer pool size require disk reads
- Disk latency (5-15ms per seek) dwarfs memory access (<0.1ms)
- Under load, disk queue depth increases, amplifying latency

**What Autocannon Can't Tell You**:
- Which specific queries are slow
- Whether latency is from disk I/O or CPU
- If query plans are optimal or degrading under load

#### 4. Network Round-Trip Time

**Database Network Latency**:
- Each query requires at least one network round trip to the database server
- For containerized setups: ~0.1ms (localhost)
- For remote databases: 1-50ms (same region) or 50-200ms+ (cross-region)

**Multiple Round Trips**:
- Complex transactions may require multiple database calls
- Each call adds network latency
- This compounds with connection pool wait times

**Example**:
```
Endpoint: /api/user-dashboard
Queries per request: 5 (user info, posts, comments, likes, notifications)
Network RTT: 2ms
Query execution: 3ms each

Minimum latency: (5 × 2ms) + (5 × 3ms) = 25ms
Actual p99 latency: 80ms+ (with queuing and contention)
```

#### 5. Connection Establishment Overhead

**Cold Start Penalties**:
- Creating new database connections is expensive (50-200ms)
- With `min: 0` pool config, first requests after idle pay this cost
- Connection validation queries add overhead

**Warm Pool Benefits**:
- Pre-warmed connections respond immediately
- `min: 5` config keeps 5 connections ready
- This is why our baseline shows better p50 than p99 (cold starts affect tail latency)

#### 6. Transaction Isolation and ACID Guarantees

**Isolation Levels Impact Performance**:
- `READ UNCOMMITTED`: Fast but dirty reads
- `READ COMMITTED`: Default, good balance
- `REPEATABLE READ`: Holds locks longer, more blocking
- `SERIALIZABLE`: Slowest, maximum consistency

**Transaction Duration**:
- Long-running transactions hold locks
- Other queries block waiting for locks
- This shows up as high p99 latency spikes

### Interpreting Autocannon Results for Database APIs

#### Normal vs. Problematic Latency Patterns

**Healthy Database API**:
```
┌─────────┬────────┬────────┬────────┬────────┬───────────┬──────────┬────────┐
│ Latency │ 2.5%   │ 50%    │ 97.5%  │ 99%    │ Avg       │ Stdev    │ Max    │
├─────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│         │ 10 ms  │ 13 ms  │ 18 ms  │ 20 ms  │ 14 ms     │ 3.2 ms   │ 45 ms  │
└─────────┴────────┴────────┴────────┴────────┴───────────┴──────────┴────────┘
```
**Analysis**:
- ✅ Small gap between p50 and p99 (13ms → 20ms)
- ✅ Low standard deviation (3.2ms)
- ✅ Max is only 2.5x average (45ms vs 14ms avg)
- **Interpretation**: Connection pool is adequately sized, queries are consistent

**Problematic Database API**:
```
┌─────────┬────────┬────────┬────────┬────────┬───────────┬──────────┬────────┐
│ Latency │ 2.5%   │ 50%    │ 97.5%  │ 99%    │ Avg       │ Stdev    │ Max    │
├─────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│         │ 8 ms   │ 15 ms  │ 450 ms │ 890 ms │ 125 ms    │ 215 ms   │ 2100 ms│
└─────────┴────────┴────────┴────────┴────────┴───────────┴──────────┴────────┘
```
**Analysis**:
- ❌ **Huge gap** between p50 and p99 (15ms → 890ms)
- ❌ Very high standard deviation (215ms)
- ❌ Max is 16x average (2100ms vs 125ms avg)
- **Interpretation**: Severe connection pool exhaustion, queries queuing

#### What P95/P99 Really Tell You

For database-backed APIs, these metrics are **composite measurements** that include:

1. **Application processing time** (minimal, ~1-5ms)
2. **Queue wait time** (waiting for available connection)
3. **Network latency** (to/from database server)
4. **Database query execution time** (variable based on load)
5. **Lock wait time** (if queries block each other)

**You cannot isolate these components** from autocannon output alone.

#### Common Misinterpretations

❌ **"P99 latency is 200ms, so my queries are slow"**
- Reality: Query might execute in 10ms, but requests wait 190ms for a connection

❌ **"P50 is good (15ms) so my API is fast"**
- Reality: 50% of requests are fast, but the other 50% experience severe degradation

❌ **"I increased connections from 10 to 50 and p99 got worse"**
- Reality: Database server is now overloaded; too many connections cause contention

❌ **"Latency is consistent in dev but spiky in production"**
- Reality: Production has concurrent users causing lock contention and cache misses

### Best Practices for Testing Database-Backed APIs

#### 1. Supplement Autocannon with Database Monitoring

**Always Monitor Database Metrics Simultaneously**:
```sql
-- Active connections
SELECT COUNT(*) as active_connections 
FROM sys.dm_exec_connections;

-- Longest running queries
SELECT 
    r.session_id,
    r.start_time,
    r.status,
    r.command,
    r.wait_type,
    r.wait_time,
    t.text as query_text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
ORDER BY r.total_elapsed_time DESC;

-- Lock waits
SELECT * 
FROM sys.dm_os_wait_stats
WHERE wait_type LIKE 'LCK%'
ORDER BY wait_time_ms DESC;
```

**Use SQL Server Profiler or Extended Events**:
- Capture actual query execution times
- Identify slow queries separate from connection wait times
- Track lock contention and deadlocks

#### 2. Test at Different Load Levels

**Progressive Load Testing**:
```javascript
// Test 1: Light load
autocannon({ connections: 5, duration: 60 })

// Test 2: Medium load
autocannon({ connections: 20, duration: 60 })

// Test 3: Heavy load
autocannon({ connections: 50, duration: 60 })

// Test 4: Burst load
autocannon({ connections: 100, duration: 30 })
```

**Watch for Inflection Points**:
- Where does p99 suddenly spike?
- At what connection count do errors appear?
- This reveals your actual capacity limits

#### 3. Separate Connection Pool Issues from Query Issues

**Test with Oversized Pool**:
```javascript
// Temporarily set max: 100 to eliminate pool as bottleneck
pool: {
    max: 100,
    min: 20
}
```

**Compare Results**:
- If p99 is still high with max: 100, queries themselves are slow
- If p99 improves dramatically, original pool was too small
- This isolates the root cause

#### 4. Test with Realistic Data Volumes

**Cold vs. Warm Cache**:
- First test run may show worse metrics (cold cache)
- Run test 2-3 times and compare results
- Production databases have varying cache hit rates

**Data Growth Impact**:
- Query performance often degrades with table size
- Test with production-scale data, not just 100 sample rows
- Index selectivity changes with data distribution

#### 5. Consider Transaction Patterns

**Read-Heavy vs. Write-Heavy**:
```javascript
// Read-only test (optimistic)
autocannon({ url: '/api/record-count' })

// Write test (realistic)
autocannon({ 
    url: '/api/records',
    method: 'POST',
    body: JSON.stringify({ data: '...' })
})

// Mixed workload (production-like)
// 80% reads, 20% writes
```

**Why This Matters**:
- Writes acquire exclusive locks
- Reads may be blocked by writes
- Pure read tests show unrealistically good performance

#### 6. Account for Database-Specific Factors

**Query Plan Cache Warm-Up**:
```javascript
// Warm up the database before testing
for (let i = 0; i < 100; i++) {
    await axios.get('http://localhost:1533/api/record-count');
}

// Now run the actual load test
autocannon({ ... });
```

**Database Version and Configuration**:
- SQL Server 2019 vs 2022 have different query optimizers
- Memory allocation affects buffer pool hit ratio
- TempDB configuration impacts sorting and joins

### Red Flags in Database API Load Tests

🚩 **Latency Bifurcation**
```
p50: 15ms
p99: 800ms
```
**Cause**: Connection pool exhaustion or intermittent lock contention  
**Action**: Increase pool size or investigate locks

🚩 **Increasing Latency Over Time**
```
First 10s:  p50: 15ms, p99: 25ms
Last 10s:   p50: 50ms, p99: 300ms
```
**Cause**: Resource exhaustion, memory leak, or accumulating locks  
**Action**: Check for connection leaks, review transaction isolation

🚩 **High Variability (Stdev > 50% of Mean)**
```
Avg: 50ms
Stdev: 120ms
```
**Cause**: Highly variable query performance or cache inconsistency  
**Action**: Review query plans, check for missing indexes

🚩 **Errors Only at p99**
```
Errors: 1% (but only for slowest requests)
```
**Cause**: Timeout threshold set too low for worst-case scenarios  
**Action**: Increase requestTimeout or optimize slowest queries

### Summary: Key Takeaways

1. **P95/P99 metrics for database APIs are composite measurements** that include queuing, network, and database execution time—autocannon alone can't separate these.

2. **High tail latency (p99) is normal for database APIs** under load due to connection pool queuing, cache misses, and lock contention.

3. **Always supplement autocannon with database monitoring** to understand what's happening inside the database server.

4. **Test progressively** to find your inflection point where performance degrades significantly.

5. **A small p50-to-p99 gap indicates good connection pool sizing**; a large gap suggests pool exhaustion or severe contention.

6. **Connection pool tuning is iterative**: start conservative, load test, monitor both app and database, adjust, and repeat.

7. **Database-backed APIs will never have the consistent latency of stateless APIs**—expect and account for this variance in your performance targets.

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

### Optimized Configuration with Thread Pool Tuning

**Pool Settings**: `max: 25, min: 5, idleTimeoutMillis: 60000`
**Thread Pool**: `UV_THREADPOOL_SIZE=128`

```
Total Requests: 37,832
Average Throughput: 430,029 req/sec
Average Latency: 15ms
P99 Latency: 22ms
Errors: 0 (0%)
Timeouts: 0
```

**Key Improvements from Thread Pool Optimization**:
- Eliminated thread pool as bottleneck
- Consistent sub-25ms latency even at p99
- Zero errors under sustained load
- High throughput handling 400K+ requests per second

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
