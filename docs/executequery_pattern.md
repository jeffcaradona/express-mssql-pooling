# executeQuery Wrapper Pattern

## Overview

The `executeQuery` wrapper provides centralized error handling, automatic connection recovery, and comprehensive logging for all database operations. It eliminates code duplication and ensures consistent error handling across all queries.

## Benefits

✅ **Automatic Error Handling** - Catches and logs all database errors  
✅ **Connection Recovery** - Detects connection failures and resets the pool automatically  
✅ **Reduced Boilerplate** - Eliminates ~15 lines of error handling per query  
✅ **Comprehensive Logging** - Debug messages for operation start, success, and failure  
✅ **Consistent Error Responses** - Standardized error handling across all endpoints  

## Connection Error Codes

The wrapper automatically detects and recovers from these connection errors:

- `ESOCKET` - Socket connection error
- `ECONNRESET` - Connection reset by peer
- `ETIMEDOUT` - Connection timeout
- `EHOSTUNREACH` - Host unreachable

When detected, the pool is automatically reset and the query retries on the next request.

## Basic Usage Pattern

### Controller with executeQuery

```javascript
import { getConnectionPool, executeQuery } from '../services/database.js';
import mssql from 'mssql';

export const getRecordCount = async (req, res) => {
    try {
        const result = await executeQuery(async () => {
            const localPool = await getConnectionPool();
            const request = localPool.request();
            const queryResult = await request.query("SELECT COUNT(*) AS total FROM TestRecords");
            return queryResult.recordset[0];
        }, "getRecordCount");
        
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
```

### With Input Validation and Prepared Statements

```javascript
export const getRecordsByQuantity = async (req, res) => {
    try {
        // Validate input first
        const qty = parseInt(req.query.qty);
        if (isNaN(qty) || qty < 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid quantity: must be non-negative integer' 
            });
        }
        
        const result = await executeQuery(async () => {
            const localPool = await getConnectionPool();
            const request = localPool.request();
            
            // Use prepared statements for SQL injection protection
            request.input('quantity', mssql.Int, qty);
            const queryResult = await request.query(
                'SELECT * FROM TestRecords WHERE REC_QY = @quantity'
            );
            
            return queryResult.recordset;
        }, "getRecordsByQuantity");
        
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
```

## Advanced Patterns

### Multiple Queries in Transaction

```javascript
export const createRecordWithLog = async (req, res) => {
    try {
        const { recQy, description } = req.body;
        
        const result = await executeQuery(async () => {
            const localPool = await getConnectionPool();
            const transaction = new mssql.Transaction(localPool);
            
            await transaction.begin();
            
            try {
                // Insert record
                const request1 = new mssql.Request(transaction);
                request1.input('recQy', mssql.Int, recQy);
                const insertResult = await request1.query(
                    'INSERT INTO TestRecords (REC_QY) VALUES (@recQy); SELECT SCOPE_IDENTITY() AS id;'
                );
                
                const recordId = insertResult.recordset[0].id;
                
                // Log action
                const request2 = new mssql.Request(transaction);
                request2.input('recordId', mssql.Int, recordId);
                request2.input('description', mssql.NVarChar, description);
                await request2.query(
                    'INSERT INTO AuditLog (RecordID, Description) VALUES (@recordId, @description)'
                );
                
                await transaction.commit();
                return { recordId };
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        }, "createRecordWithLog");
        
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
```

### Complex Query with Aggregation

```javascript
export const getStatistics = async (req, res) => {
    try {
        const result = await executeQuery(async () => {
            const localPool = await getConnectionPool();
            const request = localPool.request();
            
            const queryResult = await request.query(`
                SELECT 
                    COUNT(*) AS totalRecords,
                    AVG(REC_QY) AS avgQuantity,
                    MAX(REC_QY) AS maxQuantity,
                    MIN(REC_QY) AS minQuantity,
                    SUM(REC_QY) AS totalQuantity
                FROM TestRecords
            `);
            
            return queryResult.recordset[0];
        }, "getStatistics");
        
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
```

## Best Practices

### 1. Input Validation

Always validate input **before** passing to executeQuery:

```javascript
// ✅ GOOD - Validate first
const qty = parseInt(req.query.qty);
if (isNaN(qty) || qty < 0) {
    return res.status(400).json({ success: false, error: 'Invalid input' });
}

const result = await executeQuery(async () => {
    // ... query logic
}, "operationName");
```

```javascript
// ❌ BAD - No validation
const result = await executeQuery(async () => {
    const request = localPool.request();
    request.input('qty', mssql.Int, req.query.qty); // Could be invalid!
    // ...
}, "operationName");
```

### 2. Use Descriptive Operation Names

Operation names appear in debug logs and error messages:

```javascript
// ✅ GOOD - Clear, specific names
await executeQuery(queryFn, "getUsersByRole");
await executeQuery(queryFn, "updateOrderStatus");
await executeQuery(queryFn, "deleteExpiredSessions");

// ❌ BAD - Generic, unclear names
await executeQuery(queryFn, "query1");
await executeQuery(queryFn, "getData");
await executeQuery(queryFn, "doStuff");
```

### 3. Always Use Prepared Statements

Protect against SQL injection:

```javascript
// ✅ GOOD - Parameterized query
request.input('userId', mssql.Int, userId);
await request.query('SELECT * FROM Users WHERE UserID = @userId');

// ❌ BAD - String concatenation (SQL injection risk!)
await request.query(`SELECT * FROM Users WHERE UserID = ${userId}`);
```

### 4. Use localPool Convention

When accessing the singleton pool, use `localPool` naming:

```javascript
// ✅ GOOD - Clear naming convention
const localPool = await getConnectionPool();
const request = localPool.request();

// ❌ CONFUSING - Unclear if creating new instance
const pool = await getConnectionPool();
const db = await getConnectionPool();
```

### 5. Handle Specific Error Cases in Controllers

Let executeQuery handle connection errors, but handle business logic errors in controllers:

```javascript
export const updateRecord = async (req, res) => {
    try {
        const { id, value } = req.body;
        
        // Validate business rules
        if (value < 0 || value > 100) {
            return res.status(400).json({ 
                success: false, 
                error: 'Value must be between 0 and 100' 
            });
        }
        
        const result = await executeQuery(async () => {
            const localPool = await getConnectionPool();
            const request = localPool.request();
            request.input('id', mssql.Int, id);
            request.input('value', mssql.Int, value);
            
            const queryResult = await request.query(
                'UPDATE TestRecords SET REC_QY = @value WHERE RecordID = @id'
            );
            
            // Check if record was found
            if (queryResult.rowsAffected[0] === 0) {
                throw new Error('Record not found');
            }
            
            return { updated: true };
        }, "updateRecord");
        
        res.json({ success: true, data: result });
    } catch (error) {
        // Business logic errors vs connection errors
        if (error.message === 'Record not found') {
            return res.status(404).json({ success: false, error: error.message });
        }
        
        // executeQuery already logged connection errors
        res.status(500).json({ success: false, error: error.message });
    }
};
```

## Debugging

Enable debug logging to see executeQuery operations:

```powershell
$env:DEBUG="express-mssql-pooling:*"
npm start
```

**Debug output shows**:
```
express-mssql-pooling:database Executing query: getRecordCount +0ms
express-mssql-pooling:database Query getRecordCount completed successfully in 12ms +12ms
```

**On connection error**:
```
express-mssql-pooling:database Executing query: getRecordCount +0ms
express-mssql-pooling:database Connection error detected in getRecordCount: ECONNRESET +45ms
express-mssql-pooling:database Resetting connection pool due to connection error +2ms
express-mssql-pooling:database Connection pool closed successfully +15ms
```

## When NOT to Use executeQuery

### Wrapper Functions in database.js

If creating reusable query functions in [database.js](../src/services/database.js), the wrapper function itself should use executeQuery:

```javascript
// In database.js
export const initial_test = async (recQy = 1) => {
    // Validate input
    if (typeof recQy !== 'number' || recQy < 0) {
        throw new Error('recQy must be a non-negative number');
    }
    
    // Wrapper uses executeQuery
    return executeQuery(async () => {
        const localPool = await getConnectionPool();
        const request = localPool.request();
        request.input("recQy", sql.Int, recQy);
        const result = await request.query("SELECT [REC_QY] = @recQy");
        return result.recordset;
    }, "initial_test");
};
```

Then controllers just call the wrapper without additional executeQuery:

```javascript
// In controller
export const getInitialTest = async (req, res) => {
    try {
        const result = await initial_test(1); // No executeQuery needed
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
```

## Migration Guide

### Before (without executeQuery)

```javascript
export const getRecords = async (req, res) => {
    try {
        const pool = await getConnectionPool();
        const request = pool.request();
        
        try {
            const result = await request.query("SELECT * FROM TestRecords");
            debug('Records fetched successfully');
            res.json({ success: true, data: result.recordset });
        } catch (queryError) {
            debug('Error fetching records: %O', queryError);
            
            // Check if connection error
            if (queryError.code === 'ESOCKET' || 
                queryError.code === 'ECONNRESET' ||
                queryError.code === 'ETIMEDOUT' ||
                queryError.code === 'EHOSTUNREACH') {
                debug('Connection error detected, resetting pool...');
                await resetConnectionPool();
            }
            
            throw queryError;
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
```

### After (with executeQuery)

```javascript
export const getRecords = async (req, res) => {
    try {
        const result = await executeQuery(async () => {
            const localPool = await getConnectionPool();
            const request = localPool.request();
            const queryResult = await request.query("SELECT * FROM TestRecords");
            return queryResult.recordset;
        }, "getRecords");
        
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
```

**Lines of code**: 24 → 12 (50% reduction)  
**Error handling**: Manual → Automatic  
**Connection recovery**: Manual → Automatic  
**Logging**: Manual → Automatic  

## See Also

- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Full application setup
- [database.js](../src/services/database.js) - executeQuery implementation
- [apiController.js](../src/controllers/apiController.js) - Example usage
- [debug_and_logging.md](debug_and_logging.md) - Debugging guide
