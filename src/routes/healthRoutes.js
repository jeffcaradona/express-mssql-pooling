import { Router } from "express";

const router = Router();

// Monitoring endpoint
router.get('/health/threads', (req, res) => {
    const resources = process.getActiveResourcesInfo();
    res.json({
        activeResources: resources,
        threadPoolSize: process.env.UV_THREADPOOL_SIZE || 4
    });
});

export default router;