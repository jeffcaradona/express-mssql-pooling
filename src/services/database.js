import mssql from "mssql";
import { debugMSSQL } from "../utils/debug.js";

let isShuttingDown = false;
let pool = null;
let poolConnect = null;

// Validate required environment variables
const validateEnvironment = () => {
  const required = ["DB_USER", "DB_PASSWORD", "DB_HOST", "DB_NAME"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

// Create config lazily to ensure environment variables are loaded
const getDbConfig = () => {
  validateEnvironment();
  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "1433"),
    database: process.env.DB_NAME,
    requestTimeout: 30000, // 30 second timeout for requests
    connectionTimeout: 15000, // 15 second timeout for initial connection
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 25,              // Increased from 10 to handle more concurrent requests
      min: 5,               // Keep 5 warm connections to reduce latency
      idleTimeoutMillis: 60000,  // Keep idle connections for 60 seconds
    },
  };
};

export const getConnectionPool = async () => {
  if (!poolConnect) {
    // Only start connection once, even if called multiple times
    poolConnect = (async () => {
      try {
        debugMSSQL("Creating new connection pool");
        const dbConfig = getDbConfig();
        debugMSSQL(
          "Database config: server=%s, database=%s, user=%s",
          dbConfig.server,
          dbConfig.database,
          dbConfig.user
        );
        pool = new mssql.ConnectionPool(dbConfig);

        // Attach error event listeners for automatic recovery
        pool.on("error", (err) => {
          debugMSSQL("Pool error event: %O", {
            message: err.message,
            code: err.code,
          });
          // Mark pool as unhealthy so next call will attempt reconnection
          if (err.code === "ESOCKET" || err.code === "ECONNRESET") {
            debugMSSQL("Connection lost, marking pool for reconnection");
            pool = null;
            poolConnect = null;
          }
        });

        await pool.connect();
        debugMSSQL("Database connection pool created successfully");
        return pool;
      } catch (err) {
        debugMSSQL("Failed to create connection pool: %O", {
          message: err.message,
          code: err.code,
        });
        pool = null;
        poolConnect = null; // Reset to allow retry
        throw err;
      }
    })();
  }
  await poolConnect;
  
  // Validate pool is still connected
  if (!pool) {
    throw new Error("Connection pool is not available. Please try again.");
  }
  
  return pool;
};

/**
 * Close and reset the connection pool
 * Useful for graceful shutdown or restarting after errors
 */
export const closeConnectionPool = async () => {
  try {
    if (pool) {
      debugMSSQL("Closing connection pool");
      await pool.close();
      pool = null;
      debugMSSQL("Connection pool closed successfully");
    }
  } catch (err) {
    debugMSSQL("Error closing connection pool: %O", { message: err.message });
    // Don't rethrow - let pool cleanup continue
  } finally {
    poolConnect = null; // Always reset so next call will create new pool
  }
};

/**
 * Reset the connection pool (close and clear references)
 * Used to force recreation of the pool
 */
export const resetConnectionPool = async () => {
  await closeConnectionPool();
  debugMSSQL("Connection pool reset - ready for reconnection");
};

// Connection error codes that warrant pool reset
const CONNECTION_ERROR_CODES = ["ESOCKET", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH"];

/**
 * Execute a database query with automatic error handling and pool recovery
 * Handles connection errors and logs all database operations
 * @param {Function} queryFn - Async function that executes the query
 * @param {string} operationName - Name of the operation for logging
 * @returns {Promise} Result from queryFn
 */
export const executeQuery = async (queryFn, operationName = "Database operation") => {
  try {
    const result = await queryFn();
    debugMSSQL(`${operationName} completed successfully`);
    return result;
  } catch (err) {
    debugMSSQL(`${operationName} failed: %O`, {
      message: err.message,
      code: err.code,
      state: err.state,
    });
    
    // Reset pool on connection errors
    if (CONNECTION_ERROR_CODES.includes(err.code)) {
      debugMSSQL("Connection error detected, resetting pool");
      await resetConnectionPool();
    }
    
    throw err;
  }
};

/**
 * Check if the pool is connected and healthy
 */
export const isPoolHealthy = async () => {
  try {
    await initial_test();
    return true;
  } catch (err) {
    debugMSSQL("Pool health check failed: %O", { message: err.message });
    return false;
  }
};

export const initial_test = async (recQy = 1) => {
  // Validate input parameter upfront
  if (typeof recQy !== 'number' || recQy < 0) {
    throw new Error(`Invalid recQy parameter: must be a non-negative number, got ${recQy}`);
  }

  // Execute query with automatic error handling and logging
  return await executeQuery(async () => {
    const localPool = await getConnectionPool();
    const request = localPool.request().input("recQy", mssql.Int, recQy);
    
    const result = await request.query("SELECT [REC_QY] = @recQy;");
    return result.recordset;
  }, "initial_test");
};



export const testBadRecord = async () => {
 try {
    debugMSSQL("Database failure test starting");
    await initial_test(-1);
    debugMSSQL("Initial failure test failed ");
  } catch (err) {
    debugMSSQL("Initial database failre test passed: %O", {
      message: err.message,
      code: err.code,
    });
    throw err; // Rethrow so caller knows initialization failed
  } 

}


/**
 * Initialize the database connection and run initial test
 * Call this after dotenv is loaded but before the app serves requests
 */
export const initializeDatabase = async () => {
  try {
    debugMSSQL("Database initialization starting");
    await initial_test();
    debugMSSQL("Initial database test passed");
  } catch (err) {
    debugMSSQL("Initial database test failed: %O", {
      message: err.message,
      code: err.code,
    });
    throw err; // Rethrow so caller knows initialization failed
  }
};

/**
 * Gracefully close the connection pool, allowing active queries to complete
 * @param {number} drainTimeout - Maximum time (ms) to wait for active queries
 */
export const gracefulShutdown = async (drainTimeout = 30000) => {
  if (isShuttingDown) {
    debugMSSQL("Graceful shutdown already in progress, skipping duplicate call");
    return;
  }
  isShuttingDown = true;
  try {
    if (pool) {
      debugMSSQL("Starting graceful shutdown, waiting for active queries...");
      
      // Get pool statistics if available
      const poolSize = pool.size || 0;
      const activeConnections = pool.connected || 0;
      debugMSSQL(`Pool status: ${poolSize} total, ${activeConnections} active`);
      
      // Wait for active queries with timeout
      const startTime = Date.now();
      while (pool.connected > 0 && (Date.now() - startTime) < drainTimeout) {
        debugMSSQL(`Waiting for ${pool.connected} active connections...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (pool.connected > 0) {
        debugMSSQL(`Warning: ${pool.connected} queries still active after ${drainTimeout}ms drain period`);
      }
      
      await pool.close();
      pool = null;
      debugMSSQL("Graceful shutdown completed");
    }
  } catch (err) {
    debugMSSQL("Error during graceful shutdown: %O", { message: err.message });
  } finally {
    poolConnect = null;
  }
};
