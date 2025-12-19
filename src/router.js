import { Router } from "express";
import indexRouter from "./routes/indexRouter.js";
import apiRouter from "./routes/apiRouter.js";
import healthRouter from "./routes/healthRoutes.js";

const router = Router();

// Mount routers
router.use("/api", apiRouter);
router.use("/", indexRouter);
router.use("/ajax", (req, res, next) => res.json("AJAX"));


// Monitoring endpoint
router.use('/health', healthRouter);

export default router;