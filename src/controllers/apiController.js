import mssql from 'mssql';
import { getConnectionPool } from '../services/database.js';
import { debugMSSQL } from '../utils/debug.js';

export const getInitialTest = async (req, res) => {
    try {
        debugMSSQL('Fetching records with REC_QY = 1');
        
        const pool = await getConnectionPool();
        
        // Create a prepared statement
        const request = pool.request();
        
        // Define the prepared statement
        request.input('recQy', mssql.Int, 1);
        
        const result = await request.query('SELECT [REC_QY] = @recQy');
        
        debugMSSQL('Records fetched successfully: %O', result.recordset);
        
        res.status(200).json({
            success: true,
            data: result.recordset,
            message: 'Records retrieved successfully'
        });
    } catch (error) {
        debugMSSQL('Error fetching records: %O', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to fetch records'
        });
    }
};
