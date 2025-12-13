-- Create DemoApp database if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'DemoApp')
BEGIN
    CREATE DATABASE DemoApp;
END
GO

-- Use the DemoApp database
USE DemoApp;
GO

-- Create a sample table for testing
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TestRecords')
BEGIN
    CREATE TABLE TestRecords (
        RecordID INT PRIMARY KEY IDENTITY(1,1),
        REC_QY INT,
        CreatedDate DATETIME DEFAULT GETDATE()
    );
    
    -- Insert some sample data
    INSERT INTO TestRecords (REC_QY) VALUES (1);
    INSERT INTO TestRecords (REC_QY) VALUES (1);
END
GO
