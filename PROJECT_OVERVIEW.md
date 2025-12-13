# Express MSSQL Pooling - Project Overview

## Project Summary

**express-mssql-pooling** is a modern Express 5 web application built with ES6 modules and TypeScript support, designed to integrate with Microsoft SQL Server using connection pooling. The project demonstrates best practices for logging, debugging, and HTTP request handling.

- **Version**: 0.0.1
- **Node.js Requirement**: >=18
- **Module Type**: ES6 Modules

---

## Architecture Overview

### Core Application Structure

```
express-mssql-pooling/
├── src/                          # Application source code
│   ├── app.js                    # Express app initialization & middleware setup
│   ├── server.js                 # HTTP server startup & port management
│   ├── controllers/              # Route controllers (business logic)
│   │   └── indexController.js    # Home page controller
│   ├── routes/                   # Express route definitions
│   │   └── indexRouter.js        # Home page router
│   ├── utils/                    # Utility modules
│   │   ├── debug.js              # Debug namespace initialization
│   │   └── logger.js             # Winston logger configuration
│   └── views/                    # EJS template files
│       ├── index.ejs             # Home page template
│       └── error.ejs             # Error page template
├── public/                       # Static assets
│   └── stylesheets/
│       └── style.css             # Application styles
├── logs/                         # Runtime log files (created at runtime)
├── scripts/                      # Deployment & management scripts
│   ├── start-sql.sh              # Start SQL Server (Linux)
│   ├── start-sqlserver.ps1       # Start SQL Server (Windows)
│   ├── stop-sql.sh               # Stop SQL Server (Linux)
│   └── stop-sqlserver.ps1        # Stop SQL Server (Windows)
├── docs/                         # Documentation
│   └── debug_and_logging.md      # Debug & logging guide
├── Dockerfile                    # Docker containerization
├── package.json                  # Dependencies & scripts
├── README.md                     # Project readme (currently empty)
└── .env                          # Environment configuration (git-ignored)
```

---

## Key Components

### 1. **Application Entry Point** - [src/app.js](src/app.js)

**Purpose**: Initializes the Express application and configures middleware.

**Key Features**:
- **View Engine**: EJS templating system
- **Middleware Stack**:
  - HTTP request logging (morgan) - conditionally logs to console or Winston logger
  - Cookie parsing
  - CORS support
  - Session management (express-session)
  - Security headers (helmet)
  - Static file serving (Bootstrap, jQuery, DataTables)
- **Environment-Aware Logging**:
  - Production: Detailed combined format logged through Winston
  - Development: Concise color-coded output

**Key Code**:
```javascript
// Conditional logging based on environment
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined", { 
    stream: { write: (msg) => logger.info(msg.trim()) } 
  }));
} else {
  app.use(morgan("dev"));
}
```

### 2. **Server Startup** - [src/server.js](src/server.js)

**Purpose**: Creates and manages the HTTP server lifecycle.

**Key Features**:
- Loads environment variables via dotenv
- Normalizes port configuration (defaults to 3000)
- Error handling for server failures
- Graceful logging on server startup

**Configuration**:
- Reads `PORT` from environment variables or defaults to 3000
- Validates port numbers and handles named pipes

### 3. **Routing & Controllers**

#### Router - [src/routes/indexRouter.js](src/routes/indexRouter.js)
- Defines route definitions using Express Router
- Currently handles GET `/` route

#### Controller - [src/controllers/indexController.js](src/controllers/indexController.js)
- Implements `index` action for the home page
- Renders `index.ejs` template with title "Express"
- Error handling with try-catch and next() delegation

**Example Controller**:
```javascript
controller.index = (req, res, next) => {
  try {
    res.render("index", { title: "Express" });
  } catch (error) {
      next(error);
  }
};
```

### 4. **Debugging & Logging**

#### Debug Utility - [src/utils/debug.js](src/utils/debug.js)

**Purpose**: Provides namespaced debug logging using the `debug` module.

**Available Debuggers**:
- `express-mssql-pooling:server` - Server-related logs
- `express-mssql-pooling:application` - Application initialization logs
- `express-mssql-pooling:route` - Route/request logs

**Usage**:
```bash
# Enable specific debugger
DEBUG=express-mssql-pooling:server node src/server.js

# Enable all debuggers for this module
DEBUG=express-mssql-pooling:* node src/server.js
```

#### Logger - [src/utils/logger.js](src/utils/logger.js)

**Purpose**: Centralized logging using Winston logger.

**Features**:
- **Environment-Aware Formatting**:
  - Development: Colorized, human-readable with timestamps
  - Production: JSON format for log aggregation
- **Multiple Transports**:
  - Console output (both environments)
  - File logging (production only) to `logs/app.log`
- **Automatic Directory Creation**: Ensures `logs/` directory exists

**Log Level**: 
- Development: `debug`
- Production: `info`

---

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^5.2.1 | Web application framework |
| `mssql` | ^12.2.0 | Microsoft SQL Server driver |
| `ejs` | ^3.1.10 | View engine for templating |
| `morgan` | ~1.10.1 | HTTP request logger |
| `winston` | ^3.19.0 | Structured logging framework |
| `debug` | ~4.4.3 | Namespaced debugging utility |
| `helmet` | ^8.1.0 | HTTP security headers |
| `express-session` | ^1.18.2 | Session management |
| `cookie-parser` | ~1.4.7 | Cookie parsing middleware |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing |
| `dotenv` | ^17.2.3 | Environment variable loading |
| `dotenv-expand` | ^12.0.3 | Variable expansion in .env |
| `axios` | ^1.13.2 | HTTP client (for API calls) |
| `dayjs` | ^1.11.19 | Date/time utility |
| `http-errors` | ~2.0.1 | HTTP error factory |
| `bootstrap` | ^5.3.8 | CSS framework |
| `jquery` | ^3.7.1 | JavaScript utility |
| `datatables.net-bs5` | ^2.3.5 | Data table UI component |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `nodemon` | ^3.1.11 | Auto-restart on file changes |
| `cross-env` | ^10.1.0 | Cross-platform environment variables |

---

## NPM Scripts

```json
{
  "start": "node ./src/server.js",
  "start:dev": "cross-env NODE_ENV=development DEBUG=express-mssql-pooling:* nodemon ./src/server.js"
}
```

### Running the Application

**Production**:
```bash
npm start
# Starts server on port 3000 with production logging
```

**Development**:
```bash
npm run start:dev
# Starts server with:
# - Auto-restart on file changes
# - All debug namespaces enabled
# - Development-level logging
# - Color-coded output
```

---

## Views & Templates

### Home Page - [src/views/index.ejs](src/views/index.ejs)
- Main landing page template
- Rendered with title "Express"
- Can access Bootstrap and jQuery from static assets

### Error Page - [src/views/error.ejs](src/views/error.ejs)
- Error response template
- Automatically rendered when errors occur

---

## Environment Configuration

The application uses `dotenv` to load environment variables from a `.env` file (not in version control).

**Example .env**:
```env
NODE_ENV=development
PORT=3000
# Add database connection pooling config here
```

**Key Variables**:
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)
- Add MSSQL connection config variables as needed

---

## Docker Support

**Dockerfile** provides two-stage build:

1. **Build Stage**: Installs dependencies
2. **Production Stage**: Slim image with only production dependencies

**To Build**:
```bash
docker build -t express-mssql-pooling .
```

**To Run**:
```bash
docker run -p 3000:3000 express-mssql-pooling
```

---

## Database Scripts

Located in `scripts/` directory for managing SQL Server lifecycle:

### Linux
- `start-sql.sh` - Start SQL Server container
- `stop-sql.sh` - Stop SQL Server container

### Windows
- `start-sqlserver.ps1` - Start SQL Server (PowerShell)
- `stop-sqlserver.ps1` - Stop SQL Server (PowerShell)

---

## Static Assets

**Public Directory** (`public/`):
- Bootstrap 5.3.8 CSS framework
- jQuery 3.7.1
- DataTables.net with Bootstrap 5 styling
- Custom stylesheet: `stylesheets/style.css`

---

## Project Status & Next Steps

### Current State
✅ Core Express application structure  
✅ Routing framework in place  
✅ Logging & debugging utilities configured  
✅ Docker containerization ready  
✅ Development workflow optimized  

### Ready for Development
- Database connection pooling implementation
- Additional API routes
- Data models and validation
- Database schema and migrations
- Error handling enhancements

---

## Documentation References

- [Debug & Logging Guide](docs/debug_and_logging.md) - Detailed debugging instructions
- `.env` configuration - Create this file for local settings
- [Express 5 Documentation](https://expressjs.com/)
- [Winston Logger Documentation](https://github.com/winstonjs/winston)
- [Debug Module Documentation](https://www.npmjs.com/package/debug)

---

## Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `npm install` |
| Start development | `npm run start:dev` |
| Start production | `npm start` |
| Debug server | `DEBUG=express-mssql-pooling:server npm run start:dev` |
| Debug everything | `DEBUG=express-mssql-pooling:* npm run start:dev` |
| Build Docker image | `docker build -t express-mssql-pooling .` |

