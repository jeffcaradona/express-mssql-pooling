/**
 * Test script to demonstrate graceful shutdown behavior
 * 
 * This script:
 * 1. Starts making requests to the server
 * 2. Sends SIGINT to the server after 2 seconds
 * 3. Continues trying to make requests to show they are rejected
 * 4. Reports which requests succeeded vs failed
 */

import http from 'http';

const SERVER_URL = 'http://localhost:1533';
const REQUEST_INTERVAL = 500; // Make a request every 500ms

let requestCount = 0;
let successCount = 0;
let failCount = 0;
let shutdownInitiated = false;

function makeRequest(requestNum) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    http.get(`${SERVER_URL}/api/initial-test?recQy=${requestNum}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        successCount++;
        console.log(`✓ Request #${requestNum} succeeded (${duration}ms) ${shutdownInitiated ? '[AFTER shutdown signal]' : ''}`);
        resolve({ success: true, requestNum });
      });
    }).on('error', (err) => {
      const duration = Date.now() - startTime;
      failCount++;
      console.log(`✗ Request #${requestNum} failed: ${err.message} (${duration}ms) ${shutdownInitiated ? '[AFTER shutdown signal]' : ''}`);
      resolve({ success: false, requestNum, error: err.message });
    });
  });
}

async function runTest() {
  console.log('Starting graceful shutdown test...');
  console.log('Making requests to server every 500ms...\n');

  // Start making continuous requests
  const interval = setInterval(async () => {
    requestCount++;
    makeRequest(requestCount);
  }, REQUEST_INTERVAL);

  // After 2 seconds, check if server is running and send shutdown signal
  setTimeout(() => {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  Simulating server shutdown (press Ctrl+C on server)');
    console.log('    Please switch to the server terminal and press Ctrl+C');
    console.log('    This script will continue making requests...');
    console.log('='.repeat(60) + '\n');
    shutdownInitiated = true;
  }, 2000);

  // Stop after 15 seconds
  setTimeout(() => {
    clearInterval(interval);
    console.log('\n' + '='.repeat(60));
    console.log('Test completed!');
    console.log(`Total requests: ${requestCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('='.repeat(60));
    
    setTimeout(() => process.exit(0), 2000);
  }, 15000);
}

console.log('Make sure the server is running on port 3000');
console.log('Start with: npm run start:dev\n');

// Wait a moment for user to read
setTimeout(runTest, 1000);
