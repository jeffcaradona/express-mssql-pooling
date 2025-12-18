#!/usr/bin/env node

/**
 * Module dependencies.
 */
import { debugServer } from '../src/utils/debug.js';
import logger from './utils/logger.js';

import http from 'http'
import { configDotenv } from 'dotenv';
configDotenv();

import { initializeDatabase, gracefulShutdown as gracefulDatabaseShutdown } from './services/database.js';

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
 * Initialize database first, then start listening.
 * Fail-fast if DB initialization fails.
 */

(async () => {
  try {
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Only start listening after DB is ready
    server.listen(port);
  } catch (err) {
    logger.error('Failed to initialize database:', err);
    logger.error('Exiting due to database initialization failure');
    process.exit(1); // Fail-fast: let orchestrator restart
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
      logger.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(bind + ' is already in use');
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
  logger.info('Listening on ' + bind);
  logger.info(`Server is running at ${url}`);
}

// Graceful shutdown
let isShuttingDown = false;
let forceExitTimer = null;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring additional ${signal} signal`);
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  // Force exit after 40 seconds if graceful shutdown hangs
  forceExitTimer = setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 40000); // 30s drain + 10s buffer
  
  // Stop accepting new connections
  logger.info('Stopping HTTP server from accepting new connections...');
  server.close(async () => {
    logger.info('HTTP server closed (all connections finished), waiting for active queries to complete...');
    
    try {
      // Give active database queries time to complete (30 seconds drain)
      await gracefulDatabaseShutdown(30000);
      logger.info('Database connections closed successfully.');
      
      // Clear force-exit timer since we succeeded
      if (forceExitTimer) {
        clearTimeout(forceExitTimer);
      }
      
      process.exit(0);
    } catch (err) {
      logger.error('Error closing database connections:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));