import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, sessionPool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Allow requests from the same Replit proxy domain or localhost in dev.
// EXTRA_ALLOWED_ORIGINS (comma-separated) covers Docker/production hosts, e.g.
// EXTRA_ALLOWED_ORIGINS=http://localhost:8080,https://ages.example.com
const extraOrigins = (process.env.EXTRA_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = [
  ...(process.env.REPLIT_DEV_DOMAIN
    ? [`https://${process.env.REPLIT_DEV_DOMAIN}`]
    : ["http://localhost:21269", "http://localhost:5173"]),
  ...extraOrigins,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin requests (no Origin header) and allowed origins
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Session middleware ───────────────────────────────────────────────────────
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool: sessionPool,
      tableName: "session",
      // ينشئ جدول الجلسات تلقائيًا عند أول إقلاع على قاعدة بيانات جديدة (Docker)
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET ?? (() => { throw new Error("SESSION_SECRET env var is required"); })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

app.use("/api", router);

export default app;
