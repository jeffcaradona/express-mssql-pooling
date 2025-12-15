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

apiRouter.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error json
  res.status(err.status || 500);
  res.json({code:'', message:''})
});



export default apiRouter;