/**
 * Load Testing Script
 * Tests application performance under concurrent load using autocannon
 * 
 * Usage: node scripts/load-test.js
 * 
 * Configuration:
 * - Target: http://localhost:1533/api/record-count
 * - Connections: 20 concurrent users
 * - Duration: 30 seconds
 * 
 * Prerequisites:
 * - Application must be running (npm run start:dev)
 * - Database must be initialized
 */
import autocannon from 'autocannon';

/**
 * Execute load test against the record-count endpoint
 * @returns {Promise<void>}
 */
const runLoadTest = async () => {
  try {
    const result = await autocannon({
      url: 'http://localhost:1533/api/record-count',
      connections: 20,     // 20 concurrent connections (users)
      duration: 30,        // 30 seconds (1/2 minute)
      pipelining: 1        // 1 request per connection at a time
    });

    console.log('\n=== Load Test Results ===\n');
    console.log(`Total Requests: ${result.requests.total}`);
    console.log(`Average Throughput: ${Math.round(result.throughput.average)} req/sec`);
    console.log(`Average Latency: ${Math.round(result.latency.mean)}ms`);
    console.log(`P99 Latency: ${Math.round(result.latency.p99)}ms`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Timeouts: ${result.timeouts}`);
    console.log(`Socket Errors: ${result.socketErrors}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Load test error:', err);
    process.exit(1);
  }
};

runLoadTest();
