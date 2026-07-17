import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "node:path";
import fs from "node:fs";
import { pool, sessionPool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// خلف reverse proxy (Coolify/nginx): الثقة بترويسات X-Forwarded-* ضرورية
// لعمل الكوكيز الآمنة وبناء روابط الرفع بالبروتوكول الصحيح
app.set("trust proxy", 1);

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

// ── تقديم واجهة الموقع المبنية (نشر بخدمة واحدة) ─────────────────────────────
// إن وُجد مجلد الواجهة المبنية (تُنسخ داخل صورة Docker إلى public/)،
// يقدّمها السيرفر نفسه مع SPA fallback — فلا حاجة لخدمة nginx منفصلة.
const staticDir = process.env.STATIC_DIR ?? path.join(process.cwd(), "public");
if (fs.existsSync(path.join(staticDir, "index.html"))) {
  app.use(
    express.static(staticDir, {
      setHeaders: (res, filePath) => {
        // index.html لا يُخزَّن أبدًا (حتى تصل التحديثات فورًا بعد كل نشرة)،
        // بينما ملفات assets/ تحمل hash في اسمها فتُخزَّن للأبد بأمان
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    // طلب asset قديم غير موجود (نشرة سابقة) — 404 صريح أفضل من إرجاع HTML بنوع خاطئ
    if (req.path.startsWith("/assets/")) return res.status(404).end();
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(path.join(staticDir, "index.html"));
  });
  logger.info({ staticDir }, "Serving built frontend");
}

export default app;
