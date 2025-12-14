#!/usr/bin/env node

/**
 * Module dependencies.
 */
import { debugServer } from '../src/utils/debug.js';

import http from 'http'
import { configDotenv } from 'dotenv';
configDotenv();

import { initializeDatabase, closeConnectionPool } from './services/database.js';

/**
 * Get port from environment and store in Express.
 */

import app from './app.js'


const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// Initialize database after server is created but before it listens
(async () => {
  try {
    await initializeDatabase();
  } catch (err) {
    debugServer('Failed to initialize database, server still starting: %O', { message: err.message });
  }
})();
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  const url = `http://localhost:${addr.port}`;
  debugServer('Listening on ' + bind);
  debugServer(`Server is running at ${url}`);
}

// Graceful shutdown helper
const gracefulShutdown = async (signal) => {
  debugServer(`Received ${signal}. Shutting down gracefully...`);
  
  // Stop accepting new connections
  server.close(async () => {
    debugServer('HTTP server closed, cleaning up database connections...');
    
    try {
      await closeConnectionPool();
      debugServer('Database connections closed successfully.');
      process.exit(0);
    } catch (err) {
      debugServer('Error closing database connections: %O', { message: err.message });
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    debugServer('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));