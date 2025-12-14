import { debugApplication } from './utils/debug.js';


// Read package.json
import info from '../package.json' with { type: 'json' };
debugApplication(`[APP] info.name: ${info.name}, info.version: ${info.version}`);


import fs from "node:fs";
import createError from "http-errors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";


import morgan from "morgan";
import logger from "./utils/logger.js"; // ⬅️ Your winston logger


//  Explicitly create __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const app = express();

// Create the application object in locals for holding a connection pool

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const accessLogStream = fs.createWriteStream(path.join("logs", "access.log"), {
  flags: "a",
});

// Configure HTTP request logging with morgan middleware
// Morgan logs all incoming HTTP requests to help with debugging and monitoring
if (process.env.NODE_ENV === "production") {
  // Production: Use "combined" format (detailed logs) and route through Winston logger
  // This ensures logs are written to both console and file with Winston's configuration
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );
} else {
  // Development: Use "dev" format for concise, color-coded output in the terminal
  app.use(morgan("dev")); // color-coded, short, easy for dev
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));

app.use(
  "/css/",
  express.static(path.join(__dirname, "../node_modules/bootstrap/dist/css"))
);
app.use(
  "/css",
  express.static(path.join(__dirname, "../node_modules/bootstrap-icons/font"))
);
app.use(
  "/img/svg",
  express.static(path.join(__dirname, "../node_modules/bootstrap-icons/icons"))
);

app.use(
  "/js",
  express.static(path.join(__dirname, "../node_modules/bootstrap/dist/js"))
);
app.use(
  "/js",
  express.static(path.join(__dirname, "../node_modules/axios/dist"))
);

app.use(
  "/js",
  express.static(path.join(__dirname, "../node_modules/jquery/dist"))
);
app.use("/js", express.static(path.join(__dirname, "../node_modules/dayjs")));

import indexRouter from "./routes/indexRouter.js";
import apiRouter from "./routes/apiRouter.js";
app.use("/", indexRouter);
app.use("/ajax", (req, res, next) => res.json("AJAX"));
app.use("/api", apiRouter);

// TODO: Separate monitoring endpoints into their own router
// Add to your load test or create a monitoring endpoint
app.get('/health/threads', (req, res) => {
    const resources = process.getActiveResourcesInfo();
    res.json({
        activeResources: resources,
        threadPoolSize: process.env.UV_THREADPOOL_SIZE || 4
    });
});


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

export default app;
