import {
  initial_test,
  testBadRecord,
  getConnectionPool,
  executeQuery,
} from "../services/database.js";
import { debugMSSQL } from "../utils/debug.js";
import { DatabaseError } from "../utils/errorHandler.js";

/**
 * Safely stringify JSON with error handling
 * Returns a safe fallback object if serialization fails
 * @param {*} obj - Object to stringify
 * @returns {string} Serialized JSON string
 */
const safeJSONStringify = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch (stringifyError) {
    debugMSSQL("JSON stringify error: %O", stringifyError);
    // Return a safe fallback object
    return JSON.stringify({
      error: "Data serialization failed",
      originalType: typeof obj,
    });
  }
};


export const getInitialTest = async (req, res, next) => {
  try {
    debugMSSQL("Fetching records with REC_QY = 1");

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
    debugMSSQL("Starting bad record test");
    await testBadRecord();
    // If no error thrown, something is wrong
    debugMSSQL("Bad record test did not fail as expected");
    res.status(500).json({
      success: false,
      message: "Bad record test did not fail as expected",
    });
  } catch (error) {
    debugMSSQL("Bad record test failed as expected: %O", error);
    res.status(200).json({
      success: true,
      message: "Bad record test failed as expected",
    });
  }
};

export const getRecordCount = async (_req, res, next) => {
  try {
    debugMSSQL("Fetching TestRecords count");

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

export const batchRecords = async (req, res, next) => {
  try {
    debugMSSQL("Starting to stream TestRecords");
    const localPool = await getConnectionPool();
    const request = localPool.request();
    const query =
      "PRINT 'Start batch Query';SELECT [value], NEWID() AS [UUID] FROM GENERATE_SERIES(1, 100000);PRINT 'End batch Query';";

    const queryResult = await request.query(query);


    debugMSSQL("Records fetched: %O", queryResult.recordset.length);

    // Safely serialize recordset in case of non-serializable objects
    let safeRecordset;
    try {
      safeRecordset = JSON.parse(safeJSONStringify(queryResult.recordset));
    } catch (parseError) {
      debugMSSQL("Error parsing recordset: %O", parseError);
      safeRecordset = [];
    }

    res.status(200).json({
      data: safeRecordset,
      output: queryResult.output,
      rowsAffected: queryResult.rowsAffected,
      success: true,
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
 * Flow:
 * 1. Enables streaming mode on request object
 * 2. Sets up event listeners for recordset, row, error, and done events
 * 3. Executes query that generates 100,000 test rows
 * 4. Streams each row as JSON object with proper formatting
 * 5. Returns valid JSON array to client as chunked response
 *
 * Response Format: {"success": true, "data": [{"value": 1, "UUID": "..."}, ...], "result": {...}}
 *
 * @param {Object} _req - Express request object (unused)
 * @param {Object} res - Express response object for streaming
 * @param {Function} next - Express error handler middleware
 */
export const streamRecords = async (req, res, next) => {
  try {
    debugMSSQL("Starting to stream TestRecords");
    const localPool = await getConnectionPool();
    const request = localPool.request();

    // Enable streaming mode BEFORE calling query
    // This prevents loading entire result set into memory
    request.stream = true;

    let isFirstRow = true;
    let jsonStructureStarted = false;
    let recordsetStarted = false;
    let requestCompleted = false; // Track if request is done

    // Helper function to safely end JSON structure
    const safeEndJSON = (
      success = false,
      errorMessage = null,
      result = null,
    ) => {
      try {
        if (recordsetStarted) {
          res.write("]");
        } else if (jsonStructureStarted) {
          res.write('"data": []');
        }

        const metadata = {
          success,
          ...(errorMessage && { error: errorMessage }),
          ...(result && { result }),
        };

        if (jsonStructureStarted) {
          res.write(`,${JSON.stringify(metadata).slice(1)}`);
        } else {
          res.write(JSON.stringify(metadata));
        }

        res.end();
      } catch (endError) {
        debugMSSQL("Error ending JSON structure: %O", endError);
        if (!res.destroyed) {
          res.destroy();
        }
      }
    };

    const query =
      "PRINT 'Start stream Query';SELECT [value], NEWID() AS [UUID] FROM GENERATE_SERIES(1, 100000);PRINT 'End stream Query';";

    /**
     * 'info' event: Fires for PRINT statements in T-SQL
     * Useful for debugging but not required for streaming
     */
    request.on("info", (info) => {
      debugMSSQL("Info event: %O", info);
    });

    /**
     * 'recordset' event: Fires once when query starts, provides column metadata
     * At this point we send HTTP headers and initialize the JSON structure
     */
    request.on("recordset", (_columns) => {
      debugMSSQL("Recordset metadata received");

      try {
        // Set headers for chunked JSON response since we know the query executed successfully.
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
        });

        // Start JSON structure safely
        res.write("{");
        jsonStructureStarted = true;
        res.write('"data": [');
        recordsetStarted = true;
        isFirstRow = true;
      } catch (headerError) {
        debugMSSQL("Error setting up response headers: %O", headerError);
        // If we can't set headers, the response is likely already sent or broken
        if (!res.headersSent) {
          next(new DatabaseError(headerError, "streamRecords - header setup"));
        }
      }
    });

    /**
     * 'row' event: Fires for each row returned by the query
     * Writes each row as JSON object to response stream with safe serialization
     * Adds comma separator between rows (except before first row)
     */
    request.on("row", (row) => {
      try {
        // Add comma separator between rows for valid JSON array syntax
        if (!isFirstRow) {
          res.write(",");
        }

        // Safely serialize row object to JSON and write to response
        const serializedRow = safeJSONStringify(row);
        res.write(serializedRow);
        isFirstRow = false;
      } catch (rowError) {
        debugMSSQL("Error processing row: %O", rowError);
        // Continue processing but log the error
        // Don't break the entire stream for one bad row
        if (!isFirstRow) {
          res.write(",");
        }
        res.write(safeJSONStringify({ error: "Row processing failed" }));
        isFirstRow = false;
      }
    });

    /**
     * 'error' event: Fires if query execution fails
     * Ensures proper JSON structure cleanup regardless of when error occurs
     */
    request.on("error", (err) => {
      debugMSSQL("Error streaming records: %O", err);
      requestCompleted = true; // Mark as completed
      
      if (res.headersSent) {
        // Headers already sent, must close JSON structure gracefully
        const errorMessage = err?.message || "Database streaming error";
        safeEndJSON(false, errorMessage, null);
      } else {
        // No headers sent yet, use Express error handler
        next(new DatabaseError(err, "streamRecords"));
      }
    });

    /**
     * 'done' event: Fires when all rows have been processed
     * Safely closes the JSON structure ensuring valid JSON output
     */
    request.on("done", (result) => {
      debugMSSQL("Finished streaming records");
      requestCompleted = true; // Mark as completed
      
      try {
        // Safely close JSON structure
        safeEndJSON(true, null, result);
      } catch (doneError) {
        debugMSSQL("Error in done event: %O", doneError);
        // Last resort: try to end the response
        if (!res.destroyed && !res.finished) {
          try {
            res.end();
          } catch (finalError) {
            debugMSSQL("Final error ending response: %O", finalError);
          }
        }
      }
    });

    // Handle client disconnect - only cancel if request is still running
    req.on("close", () => {
      if (requestCompleted) {
        debugMSSQL("Client disconnected after query completion - no action needed");
      } else {
        debugMSSQL("Client disconnected, canceling active query");
        try {
          request.cancel();
        } catch (cancelError) {
          debugMSSQL(
            "Error canceling query on client disconnect: %O",
            cancelError,
          );
        }
      }
    });

    // Set a timeout to prevent runaway queries
    const queryTimeout = setTimeout(() => {
      if (requestCompleted) {
        // Query already completed, no need to timeout
        return;
      }
      
      debugMSSQL("Query timeout reached, canceling");
      try {
        request.cancel();
        if (res.headersSent && !res.finished) {
          safeEndJSON(false, "Query timeout", null);
        }
      } catch (timeoutError) {
        debugMSSQL("Error handling query timeout: %O", timeoutError);
      }
    }, 60000); // 60 second timeout

    // Clear timeout when request completes
    request.on("done", () => {
      clearTimeout(queryTimeout);
    });

    request.on("error", () => {
      clearTimeout(queryTimeout);
    });

    // Call query AFTER setting up event listeners
    // Order is important: listeners must be attached before query executes
    request.query(query);
  } catch (error) {
    next(new DatabaseError(error, "streamRecords"));
  }
};

export const streamRecords_FOR_JSON_PATH = async (req, res, next) => {
  try {
    debugMSSQL("Starting to stream TestRecords using FOR JSON PATH");
    
    const localPool = await getConnectionPool();
    const request = localPool.request();

    // Enable streaming mode BEFORE calling query
    // This prevents loading entire result set into memory
    request.stream = true;

    let jsonStructureStarted = false;
    let dataStarted = false;
    let requestCompleted = false; // Track if request is done

    // Helper function to safely end JSON structure for FOR JSON PATH
    const safeEndJSON = (
      success = false,
      errorMessage = null,
      result = null,
    ) => {
      try {
        // Close the data array if we haven't received any data
        if (!dataStarted && jsonStructureStarted) {
          res.write("[]");
        }

        const metadata = {
          success,
          ...(errorMessage && { error: errorMessage }),
          ...(result && { result }),
        };

        if (jsonStructureStarted) {
          res.write(`,${JSON.stringify(metadata).slice(1)}`);
        } else {
          res.write(JSON.stringify(metadata));
        }

        res.end();
      } catch (endError) {
        debugMSSQL("Error ending JSON structure: %O", endError);
        if (!res.destroyed) {
          res.destroy();
        }
      }
    };

    const query =
      "PRINT 'Start Path Query';SELECT [value], NEWID() AS [UUID] FROM GENERATE_SERIES(1, 100000) FOR JSON PATH;PRINT 'End Path Query';";

    /**
     * 'info' event: Fires for PRINT statements in T-SQL
     * Useful for debugging but not required for streaming
     */
    request.on("info", (info) => {
      debugMSSQL("FOR JSON PATH Info event: %O", info);
    });

    /**
     * 'recordset' event: Fires once when query starts, provides column metadata
     * FOR JSON PATH returns a single unnamed column containing JSON fragments
     * At this point we send HTTP headers and initialize the JSON structure
     */
    request.on("recordset", (_columns) => {
      debugMSSQL("FOR JSON PATH Recordset metadata received");

      try {
        // Set headers for chunked JSON response since we know the query executed successfully.
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
        });

        // Start JSON structure - FOR JSON PATH will provide the array content
        res.write('{"data": ');
        jsonStructureStarted = true;
      } catch (headerError) {
        debugMSSQL("Error setting up response headers: %O", headerError);
        if (!res.headersSent) {
          next(new DatabaseError(headerError, "streamRecords_FOR_JSON_PATH - header setup"));
        }
      }
    });

    /**
     * 'row' event: Fires for each row returned by the query
     * FOR JSON PATH returns JSON as string fragments across multiple rows
     * Each row contains a single column with a portion of the JSON string
     * We simply write each fragment directly - SQL Server handles the JSON formatting
     */
    request.on("row", (row) => {
      try {
        // FOR JSON PATH returns a single unnamed column containing JSON fragment
        // The column name is typically 'JSON_F52E2B61-18A1-11d1-B105-00805F49916B' or similar
        const jsonFragment = Object.values(row)[0];
        
        if (jsonFragment) {
          dataStarted = true;
          res.write(jsonFragment);
        }
      } catch (rowError) {
        debugMSSQL("Error processing FOR JSON PATH row: %O", rowError);
        // FOR JSON PATH errors are more critical since fragments must be continuous
        // Log but continue - the JSON may still be valid
      }
    });

    /**
     * 'error' event: Fires if query execution fails
     * Ensures proper JSON structure cleanup regardless of when error occurs
     */
    request.on("error", (err) => {
      debugMSSQL("Error streaming FOR JSON PATH records: %O", err);
      requestCompleted = true; // Mark as completed
      
      if (res.headersSent) {
        // Headers already sent, must close JSON structure gracefully
        const errorMessage = err?.message || "Database streaming error";
        safeEndJSON(false, errorMessage, null);
      } else {
        // No headers sent yet, use Express error handler
        next(new DatabaseError(err, "streamRecords_FOR_JSON_PATH"));
      }
    });

    /**
     * 'done' event: Fires when all rows have been processed
     * Safely closes the JSON structure ensuring valid JSON output
     */
    request.on("done", (result) => {
      debugMSSQL("Finished streaming FOR JSON PATH records");
      requestCompleted = true; // Mark as completed
      
      try {
        // Safely close JSON structure
        safeEndJSON(true, null, result);
      } catch (doneError) {
        debugMSSQL("Error in FOR JSON PATH done event: %O", doneError);
        // Last resort: try to end the response
        if (!res.destroyed && !res.finished) {
          try {
            res.end();
          } catch (finalError) {
            debugMSSQL("Final error ending response: %O", finalError);
          }
        }
      }
    });

    // Handle client disconnect - only cancel if request is still running
    req.on("close", () => {
      if (requestCompleted) {
        debugMSSQL("Client disconnected after FOR JSON PATH query completion - no action needed");
      } else {
        debugMSSQL("Client disconnected, canceling active FOR JSON PATH query");
        try {
          request.cancel();
        } catch (cancelError) {
          debugMSSQL(
            "Error canceling FOR JSON PATH query on client disconnect: %O",
            cancelError,
          );
        }
      }
    });

    // Set a timeout to prevent runaway queries
    const queryTimeout = setTimeout(() => {
      if (requestCompleted) {
        // Query already completed, no need to timeout
        return;
      }
      
      debugMSSQL("FOR JSON PATH Query timeout reached, canceling");
      try {
        request.cancel();
        if (res.headersSent && !res.finished) {
          safeEndJSON(false, "Query timeout", null);
        }
      } catch (timeoutError) {
        debugMSSQL("Error handling FOR JSON PATH query timeout: %O", timeoutError);
      }
    }, 60000); // 60 second timeout

    // Clear timeout when request completes
    request.on("done", () => {
      clearTimeout(queryTimeout);
    });

    request.on("error", () => {
      clearTimeout(queryTimeout);
    });

    // Call query AFTER setting up event listeners
    // Order is important: listeners must be attached before query executes
    request.query(query);
  } catch (error) {
    next(new DatabaseError(error, "streamRecords_FOR_JSON_PATH"));
  }
};


// Test endpoint to trigger database errors
export const testDatabaseError = async (req, res, next) => {
  try {
    debugMSSQL("Testing database error handling");

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
