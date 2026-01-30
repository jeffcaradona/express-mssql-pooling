import mssql from 'mssql';
import { config as configDotenv } from 'dotenv';

// Load environment variables
configDotenv();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT || '1433'),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

let pool;
try {
    // Connect to master database to create DemoApp
    console.log('Connecting to SQL Server...');
    pool = new mssql.ConnectionPool(dbConfig);
    await pool.connect();
    console.log('Connected to SQL Server');

    // Create DemoApp database
    console.log('Creating DemoApp database...');
    const request = pool.request();
    await request.query(`
        IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'DemoApp')
        BEGIN
            CREATE DATABASE DemoApp;
        END
    `);
    console.log('DemoApp database created/exists');

    // Disconnect from master
    await pool.close();

    // Now connect to DemoApp
    const demoAppConfig = {
        ...dbConfig,
        database: process.env.DB_NAME
    };

    console.log('Connecting to DemoApp database...');
    pool = new mssql.ConnectionPool(demoAppConfig);
    await pool.connect();
    console.log('Connected to DemoApp database');

    // Create TestRecords table
    console.log('Creating TestRecords table...');
    const request2 = pool.request();
    await request2.query(`
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TestRecords')
        BEGIN
            CREATE TABLE TestRecords (
                RecordID INT PRIMARY KEY IDENTITY(1,1),
                REC_QY INT,
                CreatedDate DATETIME DEFAULT GETDATE()
            );
            
            INSERT INTO TestRecords (REC_QY) VALUES (1);
            INSERT INTO TestRecords (REC_QY) VALUES (1);
        END
    `);
    console.log('TestRecords table created/exists');

    await pool.close();
    console.log('Database initialization complete!');
    process.exit(0);
} catch (error) {
    console.error('Error initializing database:', error.message);
    if (pool) {
        await pool.close();
    }
    process.exit(1);
}
