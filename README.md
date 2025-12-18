# Express.js + SQL Server Connection Pooling

A production-ready Node.js Express application demonstrating best practices for SQL Server integration with connection pooling, singleton pattern, and prepared statements.

**⚡ Performance**: Handles 80,000+ requests/minute with 14ms average latency under load (20 concurrent users, 0% error rate).

## 🚀 Quick Start

```powershell
# 1. Install dependencies
npm install

# 2. Configure environment
# Copy .env.example to .env and edit with your SQL Server credentials
cp .env.example .env

# 3. Start SQL Server container
.\scripts\start-sqlserver.ps1

# 4. Initialize database
node .\scripts\init-db.js

# 5. Start the app
npm run start:dev

# 6. Test the API
Invoke-WebRequest http://localhost:1533/api/initial-test
```

## 📡 API Endpoints

The application provides several REST API endpoints:

- `GET /api/initial-test` - Test database connectivity
- `GET /api/record-count` - Get total record count
- `GET /api/test-stream` - Stream large datasets
- `GET /api/failure-test` - Test error handling
- `GET /api/test-db-error` - Test database error middleware

See [docs/api_endpoints.md](docs/api_endpoints.md) for complete API documentation with examples.

## 📚 Full Documentation

### Core Documentation
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Complete setup and configuration guide
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Detailed architecture and design decisions
- [CONTRIBUTING.md](CONTRIBUTING.md) - Guidelines for contributing to the project

### Technical Documentation
- [api_endpoints.md](docs/api_endpoints.md) - Complete API endpoint reference
- [executequery_pattern.md](docs/executequery_pattern.md) - Query wrapper pattern and best practices
- [load_testing.md](docs/load_testing.md) - Performance testing and pool tuning guide
- [debug_and_logging.md](docs/debug_and_logging.md) - Debugging and logging configuration

### Topics Covered
- Detailed architecture explanation
- Step-by-step setup instructions
- Connection pool optimization
- Input validation and SQL injection prevention
- Error handling and connection recovery
- Load testing procedures
- Troubleshooting guide
- Production deployment best practices

## ✨ Key Features

✅ **Singleton Connection Pool** - Thread-safe connection reuse with optimized configuration  
✅ **executeQuery Wrapper** - Automatic error handling and connection recovery  
✅ **Prepared Statements** - SQL injection protection  
✅ **Lazy Configuration** - Environment variables properly initialized  
✅ **Containerized SQL Server** - Easy setup with Podman  
✅ **Debug Logging** - Comprehensive operation visibility  
✅ **Production-Grade Performance** - 80K+ req/min, 14ms avg latency, 0% error rate  

## 📊 Performance Benchmarks

Tested with 20 concurrent users over 60 seconds:

| Metric | Value |
|--------|-------|
| Total Requests | 83,991 |
| Average Throughput | 477K req/sec |
| Average Latency | 14ms |
| P99 Latency | 20ms |
| Error Rate | 0% |
| Timeouts | 0 |

**Pool Configuration**: `max: 25, min: 5, idleTimeoutMillis: 60000`

Run your own load test:
```powershell
npm install -D autocannon
node .\scripts\load-test.js
```  

## 🏗️ Architecture

```
Express App (port 1533)
    ↓
executeQuery Wrapper (automatic error handling & recovery)
    ↓
Singleton Connection Pool (src/services/database.js)
  - max: 25 connections
  - min: 5 warm connections
  - 60s idle timeout
    ↓
SQL Server Container (port 1433)
    ↓
DemoApp Database
    ↓
TestRecords Table
```

## 📋 System Requirements

- Node.js v20+
- Podman (for SQL Server container)
- 2GB+ available RAM
- Windows PowerShell (for startup scripts)

## 🔧 Available Commands

```bash
npm run start:dev    # Start app in development mode with hot reload
npm test            # Run tests (if configured)
npm run build       # Build the application
```

## 📝 Environment Configuration

Create a `.env` file in the project root:

```dotenv
PORT=1533
NODE_ENV=development
DEBUG=express-mssql-pooling

# SQL Server
MSSQL_SA_PASSWORD=YourSecurePassword123!
DB_HOST=localhost
DB_PORT=1433
DB_NAME=DemoApp
DB_USER=sa
DB_PASSWORD=YourSecurePassword123!
```

## 🗄️ Database Setup

Automatic database initialization via Node.js script:

```powershell
node .\scripts\init-db.js
```

Creates:
- `DemoApp` database
- `TestRecords` table with sample data
- Proper indexes and constraints

## 🧪 Testing

### Test the API endpoint
```powershell
Invoke-WebRequest http://localhost:1533/api/initial-test
```

### Monitor debug logs
```powershell
# Logs show all database operations
# Look for: "Database connection pool created successfully"
# And: "Records fetched successfully"
```

## 🛑 Stopping the System

```powershell
# Stop Express app: Press Ctrl+C

# Stop SQL Server container:
.\scripts\stop-sqlserver.ps1
```

## 📖 Project Structure

```
├── src/
│   ├── app.js                 # Express configuration
│   ├── server.js              # Entry point
│   ├── services/database.js   # Connection pool (singleton)
│   ├── controllers/           # Route handlers
│   ├── routes/                # Route definitions
│   ├── utils/                 # Logging, debugging
│   └── views/                 # EJS templates
├── scripts/
│   ├── start-sqlserver.ps1    # Start SQL Server
│   ├── stop-sqlserver.ps1     # Stop SQL Server
│   └── init-db.js             # Initialize database
├── public/                    # Static assets
├── .env                       # Environment config
└── package.json              # Dependencies
```

## 🎯 Why This Matters

### Connection Pooling
Maintains a pool of reusable database connections, reducing overhead and improving performance.

### Singleton Pattern
Guarantees only one connection pool instance, preventing race conditions and resource waste.

### Prepared Statements
Prevents SQL injection and improves query performance through query plan caching.

### Environment Configuration
Separates secrets and environment-specific settings from code.

## 🚀 Extending the Application

1. **Add more database queries** - Create new controller methods
2. **Add authentication** - Implement user login
3. **Add validation** - Input validation middleware
4. **Add error handling** - Centralized error handlers
5. **Add unit tests** - Jest or Mocha
6. **Deploy to production** - Docker, cloud platforms

## 🐛 Troubleshooting

**SQL Server won't start?**
- Check password meets complexity requirements (8+ chars, mixed case, numbers, special chars)
- Verify Podman is installed: `podman --version`
- Check available disk space

**Connection errors?**
- Verify SQL Server is running: `podman ps | findstr sqlserver`
- Check environment variables in `.env`
- Ensure database was initialized: `node .\scripts\init-db.js`

**Port already in use?**
- Change `PORT` in `.env` (default: 1533)
- Change `DB_PORT` in `.env` (default: 1433)

See [SETUP_GUIDE.md](SETUP_GUIDE.md#troubleshooting) for more solutions.

## 📄 License

MIT

## 👨‍💻 Development

Built with:
- [Express.js](https://expressjs.com/)
- [mssql](https://github.com/tediousjs/node-mssql)
- [dotenv](https://github.com/motdotla/dotenv)
- [nodemon](https://nodemon.io/)

## 📞 Support

For issues or questions, see [SETUP_GUIDE.md](SETUP_GUIDE.md) or check the debug logs.
