import { initial_test, testBadRecord, getConnectionPool, executeQuery } from "../services/database.js";
import { debugApplication } from '../utils/debug.js';
import { DatabaseError } from '../utils/errorHandler.js';

/**
 * Handle GET /api/initial-test endpoint
 * Retrieves test records from the database
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getInitialTest = async (req, res, next) => {
    try {
        debugApplication("Fetching records with REC_QY = 1");
        
        const result = await initial_test();
        
        debugApplication("Records fetched: %O", result);
        
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(new DatabaseError(error, 'getInitialTest'));
    }
};

/**
 * Handle GET /api/failure-test endpoint
 * Tests database error handling by intentionally triggering a validation error
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getBadTest = async (req, res, next) => {
    try {
        debugApplication("Starting bad record test");   
        await testBadRecord();
        // If no error thrown, something is wrong
        debugApplication("Bad record test did not fail as expected");
        res.status(500).json({
            success: false,
            message: 'Bad record test did not fail as expected'
        });
    } catch (error) {
        debugApplication("Bad record test failed as expected: %O", error);
        res.status(200).json({
            success: true,
            message: 'Bad record test failed as expected' });
    }
};

/**
 * Handle GET /api/record-count endpoint
 * Returns the total count of records in the TestRecords table
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getRecordCount = async (req, res, next) => {
    try {
        debugApplication("Fetching TestRecords count");
        
        const result = await executeQuery(async () => {
            const localPool = await getConnectionPool();
            const request = localPool.request();
            const queryResult = await request.query("SELECT COUNT(*) as totalRecords FROM TestRecords;");
            debugApplication(queryResult);
            return queryResult.recordset; // Return the first row with the count
        }, "getRecordCount");
        
        debugApplication("Record count fetched: %O", result);
        
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(new DatabaseError(error, 'getRecordCount'));
    }
};



/**
 * Handle GET /api/test-stream endpoint
 * Streams large datasets using SQL Server's streaming capabilities
 * Returns JSON data in chunked transfer encoding for memory efficiency
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const streamRecords = async (req, res, next) => {
    try {
        debugApplication("Starting to stream TestRecords");
        const localPool = await getConnectionPool();
        const request = localPool.request();
        
        // Enable streaming mode BEFORE calling query
        request.stream = true;
        
        const query = "SELECT [value], NEWID() AS [UUID] FROM GENERATE_SERIES(1, 10000) FOR JSON PATH";
        
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked'
        });

        request.on('recordset', columns => {
            // Emitted once for each recordset in a query
            debugApplication("Recordset metadata received");
        });

        request.on('row', row => {
            // FOR JSON PATH returns pre-formatted JSON string in a special column
            // Just write it directly to the response
            const jsonColumn = row[Object.keys(row)[0]];
            res.write(jsonColumn);
        });

        request.on('error', err => {
            debugApplication("Error streaming records: %O", err);
            if (!res.headersSent) {
                next(new DatabaseError(err, 'streamRecords'));
            } else {
                res.end();
            }
        }); 
        
        request.on('done', result => {
            debugApplication("Finished streaming records");
            res.end();
        });
        
        // Call query AFTER setting up event listeners
        request.query(query);
    } catch (error) {
        next(new DatabaseError(error, 'streamRecords'));
    }
}

/**
 * Handle GET /api/test-db-error endpoint
 * Tests database error handling by querying a non-existent table
 * Used to verify error middleware and logging work correctly
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const testDatabaseError = async (req, res, next) => {
    try {
        debugApplication("Testing database error handling");
        
        const result = await executeQuery(async () => {
            const localPool = await getConnectionPool();
            const request = localPool.request();
            
            // Query a table that doesn't exist - harmless but will throw error
            const queryResult = await request.query("SELECT * FROM NonExistentTable;");
            return queryResult.recordset;
        }, "testDatabaseError");
        
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(new DatabaseError(error, 'testDatabaseError'));
    }
};


