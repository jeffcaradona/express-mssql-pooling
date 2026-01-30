import {
  initial_test,
  testBadRecord,
  getConnectionPool,
  executeQuery,
} from "../services/database.js";
import { debugMSSQL, debugApplication } from "../utils/debug.js";
import { DatabaseError } from "../utils/errorHandler.js";
import {
  safeJSONStringify,
  safeJSONParse,
  createMetadata,
  createStreamingHeaders,
} from "../utils/json.js";
import logger from "../utils/logger.js";

// ============================================================================
// Streaming Infrastructure
// ============================================================================

/**
 * Factory function that creates a configured streaming request with built-in lifecycle management
 *
 * This factory demonstrates advanced closure patterns for managing streaming request state:
 * - Encapsulates `requestCompleted` and `queryTimeout` in closure scope
 * - Returns an interface with controlled access to internal state
 * - Automatically handles request cancellation on client disconnect
 * - Provides timeout management through callback pattern
 *
 * Closure Pattern:
 * The closure captures `request`, `config`, `requestCompleted`, and `queryTimeout` variables,
 * allowing all returned methods to share and maintain state across multiple operations.
 * This avoids global state while providing a clean, encapsulated API.
 *
 * Example Usage:
 *   const { request, markCompleted, setupTimeout } = createStreamingRequest(pool, req, config);
 *   request.on('done', () => markCompleted());
 *   setupTimeout(() => request.cancel());
 *
 * @param {Object} pool - mssql connection pool instance
 * @param {Object} req - Express request object for client disconnect detection
 * @param {Object} config - Configuration object
 * @param {number} config.timeout - Query timeout in milliseconds (e.g., 60000 for 60s)
 * @param {string} config.operationName - Name for logging and error messages
 *
 * @returns {Object} Streaming request interface with:
 *   @returns {Object} request - Configured mssql request object with streaming enabled
 *   @returns {Function} markCompleted - Closure-bound function to mark request as complete and clear timeout
 *   @returns {Function} isCompleted - Closure-bound function to check if request is done
 *   @returns {Function} setupTimeout - Closure-bound function to setup query timeout with callback
 */
const createStreamingRequest = (pool, req, config) => {
  // Closure-captured variables: maintain state across all returned methods
  const request = pool.request();
  request.stream = true;

  let requestCompleted = false;      // Tracks if query has finished or failed
  let queryTimeout = null;           // Reference to timeout handle for cleanup

  /**
   * Marks request as completed and clears any pending timeout
   * Called from 'done' and 'error' event handlers
   * CLOSURE: Accesses and modifies requestCompleted and queryTimeout from parent scope
   */
  const markCompleted = () => {
    requestCompleted = true;
    if (queryTimeout) {
      clearTimeout(queryTimeout);
    }
  };

  /**
   * Client disconnect handler - automatically set up by this factory
   * If client closes connection before query completes, cancel the request
   * CLOSURE: Accesses requestCompleted, request, and config from parent scope
   */
  req.on("close", () => {
    if (requestCompleted) {
      debugMSSQL(`Client disconnected after ${config.operationName} completion`);
    } else {
      debugMSSQL(`Client disconnected, canceling ${config.operationName}`);
      try {
        request.cancel();
      } catch (cancelError) {
        debugMSSQL(`Error canceling ${config.operationName}: %O`, cancelError);
      }
    }
  });

  /**
   * Returns interface to streaming request with state management
   * All methods maintain closure access to internal state variables
   */
  return {
    request,
    markCompleted,
    isCompleted: () => requestCompleted,
    /**
     * Sets up query timeout that automatically handles completion state
     * CLOSURE: Captures requestCompleted, queryTimeout variables in handler
     * @param {Function} onTimeout - Callback to invoke when timeout expires (e.g., request.cancel)
     */
    setupTimeout: (onTimeout) => {
      queryTimeout = setTimeout(() => {
        if (requestCompleted) return;  // Ignore timeout if already completed
        debugMSSQL(`${config.operationName} timeout reached`);
        onTimeout();
      }, config.timeout);
    },
  };
};

/**
 * Creates a safe JSON structure closer for streaming responses
 *
 * This higher-order function returns a closure that can safely end JSON responses
 * based on their current state. Handles partial state scenarios where streaming
 * may have been interrupted at different stages.
 *
 * Closure Pattern:
 * The returned function closes over `res` and `state` parameters, allowing
 * the same function instance to be called multiple times while maintaining
 * awareness of the response state.
 *
 * State Management:
 * - recordsetStarted: Data array has been opened [
 * - jsonStructureStarted: JSON object opened {
 * - dataStarted: Actual data has been written
 *
 * @param {Object} res - Express response object for writing data and ending response
 * @param {Object} state - Current streaming state object (CLOSURE variable)
 *   @param {boolean} state.recordsetStarted - Whether data array was opened
 *   @param {boolean} state.jsonStructureStarted - Whether JSON object was opened
 *   @param {boolean} state.dataStarted - Whether any actual data was written
 *
 * @returns {Function} Closure function that ends JSON response safely
 *   @param {boolean} success - Success status for metadata
 *   @param {string|null} errorMessage - Error message if any
 *   @param {*} result - Query result metadata from done event
 *
 * CLOSURE BEHAVIOR: The returned function captures `res` and `state` in its lexical
 * scope, allowing it to reference and modify state properties each time it's called.
 * This is essential for handling different interrupt scenarios:
 *   - Full stream: recordset was opened, data written
 *   - Partial stream: recordset opened, but no data written yet
 *   - Error before headers: no response started
 */
const createSafeEndJSON = (res, state) => (success = false, errorMessage = null, result = null) => {
  try {
    // Close data structure based on current state
    if (state.recordsetStarted) {
      res.write("]");
    } else if (state.jsonStructureStarted && !state.dataStarted) {
      res.write("[]");
    }

    const metadata = createMetadata(success, errorMessage, result);

    if (state.jsonStructureStarted) {
      // Append metadata to existing JSON object (remove leading '{')
      res.write(`,${JSON.stringify(metadata).slice(1)}`);
    } else {
      res.write(JSON.stringify(metadata));
    }

    res.end();
  } catch (endError) {
    logger.error(`Error ending JSON structure: ${endError.message}`);
    if (!res.destroyed) {
      res.destroy();
    }
  }
};

/**
 * Attempts to safely end the response as a last resort
 *
 * Purpose:
 * Used in error scenarios where JSON structure closure failed or was incomplete
 * Ensures response is properly terminated even in degraded conditions
 *
 * Safety Checks:
 * - Verifies response is not already destroyed
 * - Checks if response stream is not already ended (writableEnded)
 * - Wraps in try/catch to handle edge cases
 *
 * @param {Object} res - Express response object
 */
const safeResponseEnd = (res) => {
  if (!res.destroyed && !res.writableEnded) {
    try {
      res.end();
    } catch (finalError) {
      logger.error(`Final error ending response: ${finalError.message}`);
    }
  }
};

// ============================================================================
// Controller Handlers
// ============================================================================

export const getInitialTest = async (_req, res, next) => {
  try {
    debugApplication("Fetching records with REC_QY = 1");
    const result = await initial_test();
    debugMSSQL("Records fetched: %O", result);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(new DatabaseError(error, "getInitialTest"));
  }
};

export const getBadTest = async (_req, res, _next) => {
  try {
    debugApplication("Starting bad record test");
    await testBadRecord();
    // If no error thrown, something is wrong
    debugApplication("Bad record test did not fail as expected");
    res.status(500).json({
      success: false,
      message: "Bad record test did not fail as expected",
    });
  } catch (error) {
    debugApplication("Bad record test failed as expected: %O", error);
    res.status(200).json({
      success: true,
      message: "Bad record test failed as expected",
    });
  }
};

export const getRecordCount = async (_req, res, next) => {
  try {
    debugApplication("Fetching TestRecords count");

    const result = await executeQuery(async () => {
      const localPool = await getConnectionPool();
      const request = localPool.request();
      const queryResult = await request.query(
        "SELECT COUNT(*) as totalRecords FROM TestRecords;",
      );
      debugMSSQL(queryResult);
      return queryResult.recordset; // Return the first row with the count
    }, "getRecordCount");

    debugMSSQL("Record count fetched: %O", result);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(new DatabaseError(error, "getRecordCount"));
  }
};

export const batchRecords = async (_req, res, next) => {
  try {
    debugApplication("Starting batch TestRecords query");
    const localPool = await getConnectionPool();
    const request = localPool.request();
    const query =
      "PRINT 'Start batch Query';SELECT [value], NEWID() AS [UUID] FROM GENERATE_SERIES(1, 100000);PRINT 'End batch Query';";

    const queryResult = await request.query(query);

    debugMSSQL("Records fetched: %O", queryResult.recordset.length);

    // Safely serialize and parse recordset
    const safeRecordset = safeJSONParse(
      safeJSONStringify(queryResult.recordset),
      []
    );

    res.status(200).json({
      success: true,
      data: safeRecordset,
      output: queryResult.output,
      rowsAffected: queryResult.rowsAffected,
    });
  } catch (error) {
    next(new DatabaseError(error, "batchRecords"));
  }
};

/**
 * Streams database records as chunked JSON to client
 *
 * This endpoint demonstrates streaming large result sets without loading
 * all records into memory. Uses mssql driver's event-based streaming mode.
 * Includes JSON structure safety measures and proper error handling.
 *
 * Memory Efficiency:
 * - Streaming mode prevents loading entire result set into memory
 * - Processes one row at a time via 'row' event
 * - Continuous transmission means client receives data immediately
 * - Particularly effective for 100,000+ row result sets
 *
 * State Management:
 * `streamingState` object tracks JSON structure assembly across events:
 *   - isFirstRow: Prevents leading commas before first row
 *   - jsonStructureStarted: Headers sent, JSON object opened
 *   - recordsetStarted: Data array opened with [
 *   - dataStarted: At least one data row written
 *
 * Event Flow & Closure Usage:
 * 1. 'recordset' event: Initialize response headers, start JSON structure
 * 2. 'row' event: Write each row with comma separators (closure over streamingState)
 * 3. 'done'/'error' event: Close JSON structure (closure over streamingState & res)
 * 4. 'close' event (req): Cancel query if client disconnects (closure in createStreamingRequest)
 * 5. timeout: Cancel query after 60s (closure in setupTimeout callback)
 *
 * Response Format: {"data": [{"value": 1, "UUID": "..."}, ...], "success": true, "result": {...}}
 *
 * Closure Example:
 * The `safeEndJSON` function closes over `res` and `streamingState`, allowing:
 *   - Each event handler to call safeEndJSON without passing state
 *   - Reference to accumulated state (was JSON opened? was data written?)
 *   - Proper JSON completion even if interrupted at different stages
 *
 * @param {Object} req - Express request object (used for 'close' disconnect detection)
 * @param {Object} res - Express response object for streaming output
 * @param {Function} next - Express error handler middleware
 */
export const streamRecords = async (req, res, next) => {
  try {
    debugApplication("Starting to stream TestRecords");
    const localPool = await getConnectionPool();

    // STATE MANAGEMENT: Tracks JSON structure assembly across async events
    // CLOSURE: All event handlers close over this object to maintain state
    const streamingState = {
      isFirstRow: true,
      jsonStructureStarted: false,
      recordsetStarted: false,
      dataStarted: false,
    };

    // FACTORY PATTERN: Creates request with built-in disconnect/timeout handling
    // Returns { request, markCompleted, setupTimeout }
    // CLOSURE: All returned methods maintain scope over requestCompleted and queryTimeout
    const { request, markCompleted, setupTimeout } = createStreamingRequest(
      localPool,
      req,
      { timeout: 60000, operationName: "streamRecords" }
    );

    // HIGHER-ORDER FUNCTION: Returns closure that captures res and streamingState
    // Can be called multiple times from different events with different parameters
    // CLOSURE: Each call can safely reference and use streamingState
    const safeEndJSON = createSafeEndJSON(res, streamingState);

    const query =
      "PRINT 'Start stream Query';SELECT [value], NEWID() AS [UUID] FROM GENERATE_SERIES(1, 100000);PRINT 'End stream Query';";

    /**
     * 'info' event: Fires for PRINT statements in T-SQL
     * Useful for debugging SQL execution flow but not required for streaming
     * CLOSURE: Accesses debugMSSQL from module scope
     */
    request.on("info", (info) => {
      debugMSSQL("Info event: %O", info);
    });

    /**
     * 'recordset' event: Fires once when query starts, provides column metadata
     * At this point we know the query executed successfully and can start response
     * CLOSURE: Modifies streamingState to track JSON structure assembly
     */
    request.on("recordset", (_columns) => {
      debugMSSQL("Recordset metadata received");
      try {
        res.writeHead(200, createStreamingHeaders());
        res.write('{"data": [');
        streamingState.jsonStructureStarted = true;
        streamingState.recordsetStarted = true;
      } catch (headerError) {
        logger.error(`Error setting up response headers: ${headerError.message}`);
        if (!res.headersSent) {
          next(new DatabaseError(headerError, "streamRecords - header setup"));
        }
      }
    });

    /**
     * 'row' event: Fires for each row returned by the query
     * Writes each row as JSON object to response stream with safe serialization
     * CLOSURE: Captures streamingState to manage commas and track data presence
     * Recovery: If individual row fails, records error but continues streaming
     */
    request.on("row", (row) => {
      try {
        if (!streamingState.isFirstRow) {
          res.write(",");
        }
        res.write(safeJSONStringify(row));
        streamingState.isFirstRow = false;
        streamingState.dataStarted = true;
      } catch (rowError) {
        logger.error(`Error processing row: ${rowError.message}`);
        if (!streamingState.isFirstRow) {
          res.write(",");
        }
        res.write(safeJSONStringify({ error: "Row processing failed" }));
        streamingState.isFirstRow = false;
      }
    });

    /**
     * 'error' event: Fires if query execution fails
     * Ensures proper JSON structure cleanup regardless of when error occurs
     * CLOSURE: Uses streamingState and safeEndJSON to gracefully close response
     */
    request.on("error", (err) => {
      logger.error(`Error streaming records: ${err.message}`);
      markCompleted();

      if (res.headersSent) {
        // Headers sent means we can still gracefully close JSON
        // CLOSURE: safeEndJSON knows about streamingState from creation
        safeEndJSON(false, err?.message || "Database streaming error", null);
      } else {
        // No headers sent yet, use Express error handler
        next(new DatabaseError(err, "streamRecords"));
      }
    });

    /**
     * 'done' event: Fires when all rows have been processed
     * Safely closes the JSON structure ensuring valid JSON output
     * CLOSURE: Both markCompleted and safeEndJSON close over their respective scopes
     */
    request.on("done", (result) => {
      debugMSSQL("Finished streaming records");
      markCompleted();

      try {
        safeEndJSON(true, null, result);
      } catch (doneError) {
        logger.error(`Error in done event: ${doneError.message}`);
        safeResponseEnd(res);
      }
    });

    /**
     * Setup query timeout: Prevents runaway queries from blocking indefinitely
     * Uses callback pattern from createStreamingRequest to handle cancellation
     * CLOSURE: setupTimeout callback closes over request to call cancel()
     */
    setupTimeout(() => {
      try {
        request.cancel();
        if (res.headersSent && !res.writableEnded) {
          safeEndJSON(false, "Query timeout", null);
        }
      } catch (timeoutError) {
        logger.error(`Error handling query timeout: ${timeoutError.message}`);
      }
    });

    // Call query AFTER setting up event listeners
    // Order is critical: listeners must be attached before query executes
    request.query(query);
  } catch (error) {
    next(new DatabaseError(error, "streamRecords"));
  }
};

/**
 * Streams database records using SQL Server's FOR JSON PATH
 *
 * This endpoint demonstrates an alternative approach to streaming JSON data
 * using SQL Server's native FOR JSON PATH syntax instead of manual formatting.
 *
 * SQL Server Advantages:
 * - FOR JSON PATH: SQL Server handles array/object formatting
 * - Returns pre-formatted JSON fragments instead of raw rows
 * - Reduces client-side JSON construction overhead
 * - Better for complex nested data structures
 *
 * Key Differences from streamRecords:
 * - No isFirstRow tracking (SQL Server handles formatting)
 * - Simpler row handler: just extract and write JSON fragment
 * - state.recordsetStarted not used (SQL provides complete array)
 * - Writes '{"data": ' and lets SQL provide the array content
 *
 * Closure Usage Pattern:
 * Same as streamRecords: factory creates request with lifecycle management,
 * safeEndJSON closes over res and streamingState for state-aware completion
 *
 * @param {Object} req - Express request object (for 'close' disconnect detection)
 * @param {Object} res - Express response object for streaming output
 * @param {Function} next - Express error handler middleware
 */
export const streamRecords_FOR_JSON_PATH = async (req, res, next) => {
  try {
    debugApplication("Starting to stream TestRecords using FOR JSON PATH");
    const localPool = await getConnectionPool();

    // STATE MANAGEMENT: Simplified compared to streamRecords (no row tracking)
    // CLOSURE: All event handlers close over this to maintain state
    const streamingState = {
      jsonStructureStarted: false,
      dataStarted: false,
      recordsetStarted: false,
    };

    // FACTORY PATTERN: Same as streamRecords - encapsulates lifecycle
    // CLOSURE: Returns methods that maintain internal state
    const { request, markCompleted, setupTimeout } = createStreamingRequest(
      localPool,
      req,
      { timeout: 60000, operationName: "streamRecords_FOR_JSON_PATH" }
    );

    // HIGHER-ORDER FUNCTION: Captures res and streamingState in closure
    // Can be called from multiple events with different success/error status
    const safeEndJSON = createSafeEndJSON(res, streamingState);

    const query =
      "PRINT 'Start Path Query';SELECT [value], NEWID() AS [UUID] FROM GENERATE_SERIES(1, 100000) FOR JSON PATH;PRINT 'End Path Query';";

    /**
     * 'info' event: Fires for PRINT statements in T-SQL
     * CLOSURE: Accesses debugMSSQL from module scope
     */
    request.on("info", (info) => {
      debugMSSQL("FOR JSON PATH Info event: %O", info);
    });

    /**
     * 'recordset' event: Fires once when query starts with FOR JSON PATH
     * CLOSURE: Modifies streamingState to track JSON structure assembly
     */
    request.on("recordset", (_columns) => {
      debugMSSQL("FOR JSON PATH Recordset metadata received");
      try {
        res.writeHead(200, createStreamingHeaders());
        res.write('{"data": ');
        streamingState.jsonStructureStarted = true;
      } catch (headerError) {
        logger.error(`Error setting up response headers: ${headerError.message}`);
        if (!res.headersSent) {
          next(new DatabaseError(headerError, "streamRecords_FOR_JSON_PATH - header setup"));
        }
      }
    });

    /**
     * 'row' event: Fires for each row with FOR JSON PATH pre-formatted JSON
     * FOR JSON PATH returns a single unnamed column containing JSON fragment
     * Extract the JSON fragment and write directly to response
     * CLOSURE: Captures streamingState to track if data was written
     */
    request.on("row", (row) => {
      try {
        const jsonFragment = Object.values(row)[0];
        if (jsonFragment) {
          streamingState.dataStarted = true;
          res.write(jsonFragment);
        }
      } catch (rowError) {
        logger.error(`Error processing FOR JSON PATH row: ${rowError.message}`);
      }
    });

    /**
     * 'error' event: Fires if query execution fails
     * CLOSURE: Uses streamingState and safeEndJSON to gracefully close response
     */
    request.on("error", (err) => {
      logger.error(`Error streaming FOR JSON PATH records: ${err.message}`);
      markCompleted();

      if (res.headersSent) {
        safeEndJSON(false, err?.message || "Database streaming error", null);
      } else {
        next(new DatabaseError(err, "streamRecords_FOR_JSON_PATH"));
      }
    });

    /**
     * 'done' event: Fires when all rows have been processed
     * Safely closes the JSON structure ensuring valid JSON output
     * CLOSURE: Both markCompleted and safeEndJSON close over their respective scopes
     */
    request.on("done", (result) => {
      debugMSSQL("Finished streaming FOR JSON PATH records");
      markCompleted();

      try {
        safeEndJSON(true, null, result);
      } catch (doneError) {
        logger.error(`Error in FOR JSON PATH done event: ${doneError.message}`);
        safeResponseEnd(res);
      }
    });

    /**
     * Setup query timeout: Prevents runaway queries from blocking indefinitely
     * Uses callback pattern from createStreamingRequest
     * CLOSURE: setupTimeout callback closes over request to call cancel()
     */
    setupTimeout(() => {
      try {
        request.cancel();
        if (res.headersSent && !res.writableEnded) {
          safeEndJSON(false, "Query timeout", null);
        }
      } catch (timeoutError) {
        logger.error(`Error handling FOR JSON PATH query timeout: ${timeoutError.message}`);
      }
    });

    // Call query AFTER setting up event listeners
    // Order is critical: listeners must be attached before query executes
    request.query(query);
  } catch (error) {
    next(new DatabaseError(error, "streamRecords_FOR_JSON_PATH"));
  }
};


// Test endpoint to trigger database errors
export const testDatabaseError = async (_req, res, next) => {
  try {
    debugApplication("Testing database error handling");

    const result = await executeQuery(async () => {
      const localPool = await getConnectionPool();
      const request = localPool.request();

      // Query a table that doesn't exist - harmless but will throw error
      const queryResult = await request.query(
        "SELECT * FROM NonExistentTable;",
      );
      return queryResult.recordset;
    }, "testDatabaseError");

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(new DatabaseError(error, "testDatabaseError"));
  }
};
