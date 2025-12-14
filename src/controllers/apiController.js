import mssql from 'mssql';
import { initial_test, testBadRecord, getConnectionPool, executeQuery } from "../services/database.js";
import { debugApplication } from '../utils/debug.js';

export const getInitialTest = async (req, res) => {
    try {
        debugApplication("Fetching records with REC_QY = 1");
        
        const result = await initial_test();
        
        debugApplication("Records fetched: %O", result);
        
        res.status(200).json({
            success: true,
            data: result,
            message: 'Records retrieved successfully'
        });
    } catch (error) {
        debugApplication("Error fetching records: %O", error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to fetch records'
        });
    }
};

export const getBadTest = async (req, res) => {
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

export const getRecordCount = async (req, res) => {
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
            data: result,
            error: null,
            message: 'Record count retrieved successfully'
        });
    } catch (error) {
        debugApplication("Error fetching record count: %O", error);
        
        res.status(500).json({
            success: false,
            data: null,
            error: error.message,
            message: 'Failed to fetch record count'
        });
    }
};


