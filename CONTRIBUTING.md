# Contributing to Express MSSQL Pooling

Thank you for your interest in contributing to this project! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

This project follows standard open-source etiquette:
- Be respectful and constructive
- Focus on the technical merits of contributions
- Help others learn and grow
- Accept feedback gracefully

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:
- Node.js v20 or higher
- Podman (for SQL Server container)
- Git
- A code editor (VS Code recommended)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
```bash
git clone https://github.com/YOUR_USERNAME/express-mssql-pooling.git
cd express-mssql-pooling
```

3. Add upstream remote:
```bash
git remote add upstream https://github.com/jeffcaradona/express-mssql-pooling.git
```

### Set Up Development Environment

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start SQL Server:
```bash
.\scripts\start-sqlserver.ps1  # Windows
# or
./scripts/start-sql.sh         # Linux
```

4. Initialize database:
```bash
node scripts/init-db.js
```

5. Start development server:
```bash
npm run start:dev
```

6. Verify setup:
```bash
curl http://localhost:1533/api/initial-test
```

---

## Development Workflow

### Branch Strategy

1. **Create a feature branch**:
```bash
git checkout -b feature/my-new-feature
```

2. **Make your changes** with frequent commits:
```bash
git add .
git commit -m "Add feature X"
```

3. **Keep your branch updated**:
```bash
git fetch upstream
git rebase upstream/main
```

4. **Push to your fork**:
```bash
git push origin feature/my-new-feature
```

### Commit Messages

Follow conventional commit format:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```bash
feat(api): add user authentication endpoint
fix(database): resolve connection pool leak
docs(readme): update installation instructions
refactor(controller): simplify error handling
```

---

## Coding Standards

### JavaScript Style

This project follows modern JavaScript best practices:

- **ES6+ syntax**: Use modern JavaScript features
- **Async/await**: Prefer over callbacks and raw promises
- **Const/let**: Never use `var`
- **Arrow functions**: Use for callbacks and short functions
- **Template literals**: Use for string interpolation

### Code Formatting

- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Use them
- **Quotes**: Double quotes for strings
- **Line length**: Keep under 100 characters when reasonable

### Example

```javascript
// ✅ Good
import { getConnectionPool, executeQuery } from '../services/database.js';

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(async () => {
      const localPool = await getConnectionPool();
      const request = localPool.request();
      request.input('userId', mssql.Int, id);
      const queryResult = await request.query('SELECT * FROM Users WHERE id = @userId');
      return queryResult.recordset[0];
    }, "getUserById");
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(new DatabaseError(error, 'getUserById'));
  }
};

// ❌ Bad
var getUserById = function(req,res,next){
    var id=req.params.id
    getConnectionPool().then(function(pool){
        pool.request().query('SELECT * FROM Users WHERE id = '+id).then(function(result){
            res.json(result)
        })
    }).catch(function(err){
        res.status(500).send(err)
    })
}
```

### JSDoc Comments

Add JSDoc comments to all exported functions:

```javascript
/**
 * Retrieve a user by ID from the database
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const getUserById = async (req, res, next) => {
  // Implementation
};
```

---

## Testing

### Manual Testing

Before submitting, test your changes:

1. **Start the application**:
```bash
npm run start:dev
```

2. **Test affected endpoints**:
```bash
curl http://localhost:1533/api/your-endpoint
```

3. **Check debug logs**:
```bash
DEBUG=express-mssql-pooling:* npm start
```

4. **Run load tests** (if performance-related):
```bash
node scripts/load-test.js
```

### Adding Tests

If adding significant functionality:
1. Create test file in `tests/` directory
2. Follow existing test patterns
3. Ensure tests pass before submitting

---

## Documentation

Update documentation for any changes:

### Code Documentation
- Add JSDoc comments to new functions
- Update inline comments for complex logic
- Keep comments concise and meaningful

### Markdown Documentation
- Update README.md if changing setup or features
- Update SETUP_GUIDE.md if changing configuration
- Update docs/api_endpoints.md if adding/modifying endpoints
- Update docs/ files if changing patterns or best practices

### Documentation Standards
- Use clear, concise language
- Provide code examples
- Include both Windows and Linux commands where applicable
- Keep formatting consistent with existing docs

---

## Submitting Changes

### Pull Request Process

1. **Ensure your code follows standards**:
   - Code is formatted correctly
   - JSDoc comments are added
   - No console.log() statements (use logger or debug)
   - No sensitive data committed

2. **Update documentation**:
   - Update relevant .md files
   - Add JSDoc comments
   - Update CHANGELOG.md if exists

3. **Test your changes**:
   - Manual testing completed
   - No errors in debug logs
   - Performance not degraded

4. **Create pull request**:
   - Use descriptive title
   - Reference any related issues
   - Describe what changed and why
   - Include testing steps

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
Steps to test the changes:
1. ...
2. ...

## Checklist
- [ ] Code follows project style guidelines
- [ ] Documentation updated
- [ ] Manual testing completed
- [ ] No console.log() statements
- [ ] Commits follow conventional format
```

---

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Environment**:
   - Node.js version
   - Operating system
   - SQL Server version

2. **Steps to reproduce**:
   - Detailed steps
   - Expected behavior
   - Actual behavior

3. **Additional context**:
   - Error messages
   - Debug logs
   - Screenshots (if applicable)

### Feature Requests

When requesting features:

1. **Use case**: Describe the problem
2. **Proposed solution**: How would this work?
3. **Alternatives**: Other approaches considered
4. **Additional context**: Why is this useful?

---

## Project Structure Reference

Understanding the project structure helps with contributions:

```
express-mssql-pooling/
├── src/
│   ├── app.js              # Express app configuration
│   ├── server.js           # Server startup
│   ├── controllers/        # Route handlers
│   ├── routes/             # Route definitions
│   ├── services/           # Business logic (database)
│   ├── utils/              # Utilities (logging, debug)
│   └── views/              # EJS templates
├── scripts/                # Helper scripts
├── docs/                   # Documentation
├── public/                 # Static files
└── package.json           # Dependencies
```

### Key Files to Know

- `src/services/database.js` - Connection pool and database operations
- `src/controllers/apiController.js` - API endpoint handlers
- `src/routes/apiRouter.js` - API route definitions
- `src/utils/errorHandler.js` - Error handling middleware
- `src/utils/debug.js` - Debug logging configuration
- `src/utils/logger.js` - Winston logger configuration

---

## Best Practices

### Database Operations

Always use the `executeQuery` wrapper:

```javascript
const result = await executeQuery(async () => {
  const localPool = await getConnectionPool();
  const request = localPool.request();
  request.input('param', mssql.Int, value);
  return await request.query('SELECT * FROM Table WHERE id = @param');
}, "operationName");
```

See [docs/executequery_pattern.md](docs/executequery_pattern.md) for details.

### Error Handling

Use `DatabaseError` class for database errors:

```javascript
import { DatabaseError } from '../utils/errorHandler.js';

try {
  // database operation
} catch (error) {
  next(new DatabaseError(error, 'operationName'));
}
```

### Logging

Use appropriate logging:

```javascript
import logger from '../utils/logger.js';
import { debugApplication } from '../utils/debug.js';

logger.info('User logged in', { userId: 123 });
logger.error('Database error', { error: err });
debugApplication('Processing request for user %s', userId);
```

---

## Questions?

- Check existing documentation in `docs/`
- Review [README.md](README.md) and [SETUP_GUIDE.md](SETUP_GUIDE.md)
- Look at existing code for examples
- Open an issue for discussion

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

---

Thank you for contributing! 🎉
