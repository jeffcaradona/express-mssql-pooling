import { Router } from "express";
const apiRouter = Router();

apiRouter.get("/", (req, res) => {
  res.json({ message: "Welcome to the API root!" });
});

import { getInitialTest, getRecordCount } from "../controllers/apiController.js";
apiRouter.get("/initial-test", getInitialTest);
apiRouter.get("/record-count", getRecordCount);


import { getBadTest } from "../controllers/apiController.js";
apiRouter.get("/failure-test", getBadTest);





export default apiRouter;