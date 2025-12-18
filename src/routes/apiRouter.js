import { Router } from "express";
const apiRouter = Router();

apiRouter.get("/", (req, res) => {
  res.json({ message: "Welcome to the API root!" });
});

import { getInitialTest, getRecordCount, streamRecords, testDatabaseError } from "../controllers/apiController.js";
apiRouter.get("/initial-test", getInitialTest);
apiRouter.get("/record-count", getRecordCount);

apiRouter.get("/test-stream", streamRecords);


import { getBadTest } from "../controllers/apiController.js";
apiRouter.get("/failure-test", getBadTest);

// Test endpoint for database error handling
apiRouter.get("/test-db-error", testDatabaseError);

import { errorMiddleware } from '../utils/errorHandler.js';

// 404 handler for unknown API routes (must be before error middleware)
apiRouter.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'ROUTE_NOT_FOUND',
            message: 'The requested API endpoint does not exist',
            status: 404,
            path: req.path
        }
    });
});


// Apply error handling middleware to all API routes
apiRouter.use(errorMiddleware);

export default apiRouter;