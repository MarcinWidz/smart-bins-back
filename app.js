const express = require("express");
const requireAll = require("require-all");
const path = require("path");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("express-jwt");
const morgan = require("morgan");
const accountsRoutes = require("./api/accounts");
const utilsRoutes = require("./api/utils");
const actualitesRoutes = require("./api/actualites");
const updateBinDepositsDB = require("./api/updateServer");
const CronJob = require("cron").CronJob;

const job = new CronJob("0 */1 * * * *", updateBinDepositsDB);
job.start();

const {
  errorHandler,
  ensureAuthenticated,
  PUBLIC_ROUTES,
} = require("forest-express-mongoose");

const app = express();

let allowedOrigins = [/\.forestadmin\.com$/, /localhost:\d{4}$/];

if (process.env.CORS_ORIGINS) {
  allowedOrigins = allowedOrigins.concat(process.env.CORS_ORIGINS.split(","));
}

const corsConfig = {
  origin: allowedOrigins,
  maxAge: 86400, // NOTICE: 1 day
  credentials: true,
};

app.use(morgan("tiny"));
app.use(
  "/forest/authentication",
  cors({
    ...corsConfig,
    // The null origin is sent by browsers for redirected AJAX calls
    // we need to support this in authentication routes because OIDC
    // redirects to the callback route
    origin: corsConfig.origin.concat("null"),
  })
);
app.use(cors(corsConfig));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(accountsRoutes);
app.use(utilsRoutes);
app.use(actualitesRoutes);

app.use(
  jwt({
    secret: process.env.FOREST_AUTH_SECRET,
    credentialsRequired: false,
    algorithms: ["HS256"],
  })
);

app.use("/forest", (request, response, next) => {
  if (PUBLIC_ROUTES.includes(request.url)) {
    return next();
  }
  return ensureAuthenticated(request, response, next);
});

requireAll({
  dirname: path.join(__dirname, "routes"),
  recursive: true,
  resolve: (Module) => app.use("/forest", Module),
});

requireAll({
  dirname: path.join(__dirname, "middlewares"),
  recursive: true,
  resolve: (Module) => Module(app),
});

app.use(errorHandler());

module.exports = app;
