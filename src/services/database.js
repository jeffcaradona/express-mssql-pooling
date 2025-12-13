import mssql from 'mssql'
import { debugMSSQL } from "../utils/debug.js";

debugMSSQL('Initializing database connection pool');

let pool = null;
let poolConnect = null;

// Create config lazily to ensure environment variables are loaded
const getDbConfig = () => {
    return {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, 
        server: process.env.DB_HOST, 
        port: parseInt(process.env.DB_PORT || '1433'),
        database: process.env.DB_NAME,
        options: {  
            encrypt: false,
            trustServerCertificate: true 
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
};

export const getConnectionPool = async () => {
    if (!poolConnect) {
      // Only start connection once, even if called multiple times
      poolConnect = (async () => {
        debugMSSQL("Creating new connection pool");
        const dbConfig = getDbConfig();
        debugMSSQL("Database config: server=%s, database=%s, user=%s", dbConfig.server, dbConfig.database, dbConfig.user);
        pool = new mssql.ConnectionPool(dbConfig);
        await pool.connect();
        debugMSSQL("Database connection pool created successfully");
        return pool;
      })();
    }
    await poolConnect;
    return pool;
}