import logger from './logger.js';

/**
 * Custom error class to wrap database errors
 */
export class DatabaseError extends Error {
    constructor(originalError, operation) {
        super(originalError.message);
        this.name = 'DatabaseError';
        this.originalError = originalError;
        this.operation = operation;
        this.statusCode = this.categorizeError(originalError);
    }

    categorizeError(error) {
        const errorCode = error.code?.toUpperCase();
        const errorMessage = error.message?.toLowerCase() || '';

        // Connection failures
        if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || errorCode === 'ESOCKET' ||
            errorMessage.includes('connection') || errorMessage.includes('pool')) {
            return 503;
        }
        
        // Timeout errors
        if (errorCode === 'ETIMEOUT' || errorCode === 'ETIMEDOUT' || 
            errorMessage.includes('timeout')) {
            return 504;
        }
        
        // Default server error
        return 500;
    }

    getErrorCode() {
        switch (this.statusCode) {
            case 503: return 'DATABASE_UNAVAILABLE';
            case 504: return 'DATABASE_TIMEOUT';
            default: return 'DATABASE_ERROR';
        }
    }

    getUserMessage() {
        switch (this.statusCode) {
            case 503: return 'Database service is temporarily unavailable';
            case 504: return 'Database request timed out';
            default: return 'An error occurred while processing your request';
        }
    }
}

/**
 * Express error handling middleware (must have 4 parameters)
 */
export const errorMiddleware = (err, req, res, next) => {
    // Log full error details server-side
    logger.error('API Error:', {
        operation: err.operation || 'unknown',
        path: req.path,
        method: req.method,
        error: err.originalError || err,
        message: err.message,
        stack: err.stack
    });

    // If headers already sent, delegate to default error handler
    if (res.headersSent) {
        return next(err);
    }

    // Determine status code and response
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (err instanceof DatabaseError) {
        statusCode = err.statusCode;
        errorCode = err.getErrorCode();
        message = err.getUserMessage();
    } else if (err.statusCode) {
        statusCode = err.statusCode;
    }

    // Send sanitized error response
    res.status(statusCode).json({
        success: false,
        error: {
            code: errorCode,
            message: message,
            status: statusCode
        }
    });
};
