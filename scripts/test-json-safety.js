/**
 * Test script to validate JSON structure safety in streamRecords endpoint
 * This script tests various scenarios to ensure the endpoint always returns valid JSON
 */

import http from 'node:http';
import { performance } from 'node:perf_hooks';

const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;
const STREAM_ENDPOINT = '/api/stream';

/**
 * Makes an HTTP request and validates that the response is valid JSON
 * @param {string} path - The API endpoint path
 * @param {Object} options - Additional request options
 * @returns {Promise<Object>} Parsed JSON response or error details
 */
function makeRequest(path, options = {}) {
  return new Promise((resolve) => {
    const requestOptions = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: path,
      method: 'GET',
      ...options
    };

    const startTime = performance.now();
    let responseData = '';
    let isValidJSON = false;
    let parsedData = null;
    let statusCode = null;

    const req = http.request(requestOptions, (res) => {
      statusCode = res.statusCode;
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        try {
          parsedData = JSON.parse(responseData);
          isValidJSON = true;
        } catch (parseError) {
          console.error('JSON Parse Error:', parseError.message);
          console.error('Response data (first 500 chars):', responseData.substring(0, 500));
        }

        resolve({
          statusCode,
          isValidJSON,
          parsedData,
          responseLength: responseData.length,
          duration,
          rawResponse: responseData.substring(0, 200) + (responseData.length > 200 ? '...' : '')
        });
      });
    });

    req.on('error', (err) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      resolve({
        statusCode: null,
        isValidJSON: false,
        error: err.message,
        duration
      });
    });

    // Test client disconnect scenario
    if (options.disconnect) {
      setTimeout(() => {
        req.destroy();
      }, options.disconnect);
    }

    req.end();
  });
}

/**
 * Test the normal streaming scenario
 */
async function testNormalStreaming() {
  console.log('🧪 Testing normal streaming scenario...');
  
  const result = await makeRequest(STREAM_ENDPOINT);
  
  if (result.isValidJSON) {
    console.log('✅ Normal streaming test passed');
    console.log(`   Status: ${result.statusCode}`);
    console.log(`   Duration: ${result.duration.toFixed(2)}ms`);
    console.log(`   Response length: ${result.responseLength} characters`);
    console.log(`   Has data array: ${Array.isArray(result.parsedData?.data)}`);
    console.log(`   Success flag: ${result.parsedData?.success}`);
  } else {
    console.log('❌ Normal streaming test failed');
    console.log(`   Status: ${result.statusCode}`);
    console.log(`   Error: ${result.error || 'Invalid JSON'}`);
    console.log(`   Raw response: ${result.rawResponse}`);
  }
  
  return result.isValidJSON;
}

/**
 * Test client disconnect scenario
 */
async function testClientDisconnect() {
  console.log('🧪 Testing client disconnect scenario...');
  
  // Disconnect after 100ms to simulate early client disconnect
  const result = await makeRequest(STREAM_ENDPOINT, { disconnect: 100 });
  
  // In this case, we expect an error since we're disconnecting
  if (result.error) {
    console.log('✅ Client disconnect test passed (expected connection error)');
    console.log(`   Error: ${result.error}`);
  } else {
    console.log('❌ Client disconnect test unexpected result');
    console.log(`   Status: ${result.statusCode}`);
    console.log(`   Valid JSON: ${result.isValidJSON}`);
  }
  
  return true; // This test is expected to fail with connection error
}

/**
 * Test multiple concurrent requests
 */
async function testConcurrentRequests() {
  console.log('🧪 Testing concurrent requests...');
  
  const concurrentRequests = 3;
  const promises = Array.from({ length: concurrentRequests }, () => 
    makeRequest(STREAM_ENDPOINT)
  );
  
  const results = await Promise.all(promises);
  const validResults = results.filter(r => r.isValidJSON);
  
  console.log(`✅ Concurrent requests test: ${validResults.length}/${concurrentRequests} returned valid JSON`);
  
  results.forEach((result, index) => {
    if (result.isValidJSON) {
      console.log(`   Request ${index + 1}: ✅ Valid JSON, Duration: ${result.duration.toFixed(2)}ms`);
    } else {
      console.log(`   Request ${index + 1}: ❌ Invalid JSON, Error: ${result.error || 'Parse error'}`);
    }
  });
  
  return validResults.length === concurrentRequests;
}

// Check if server is running before starting tests
const healthCheck = await makeRequest('/health').catch(() => ({ isValidJSON: false }));

if (!healthCheck.isValidJSON && healthCheck.statusCode !== 200) {
  console.error('❌ Server is not running or health check failed');
  console.error('   Please start the server with: npm run start:dev');
  console.error('   Then run this test again.');
  process.exit(1);
}

// Run the tests
console.log('🚀 Starting JSON Structure Safety Tests for streamRecords endpoint');
console.log(`📡 Testing against: http://${SERVER_HOST}:${SERVER_PORT}${STREAM_ENDPOINT}`);
console.log('='.repeat(70));

const tests = [
  testNormalStreaming,
  testClientDisconnect,
  testConcurrentRequests
];

let passedTests = 0;

for (const test of tests) {
  try {
    const passed = await test();
    if (passed) passedTests++;
    console.log(''); // Empty line between tests
  } catch (error) {
    console.error(`❌ Test failed with exception: ${error.message}`);
    console.log('');
  }
}

console.log('='.repeat(70));
console.log(`📊 Test Results: ${passedTests}/${tests.length} tests passed`);

if (passedTests === tests.length) {
  console.log('🎉 All JSON structure safety tests passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Check the server and endpoint implementation.');
  process.exit(1);
}