import { Router } from "express";
const apiRouter = Router();

apiRouter.get("/", (req, res) => {
  res.json({ message: "Welcome to the API root!" });
});

import { getInitialTest } from "../controllers/apiController.js";
apiRouter.get("/initial-test", getInitialTest);

export default apiRouter;