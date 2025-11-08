import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import router from "./routes/index.js";
import { STATIC_UPLOAD_DIR } from "./utils/upload.js";

import { optionalAuth } from "./middleware/auth.js";

const app = express();

/** Security & core middleware */
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

/** CORS — credentials + exact origin (change if needed) */
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: CORS_ORIGIN,          // must be exact, not "*"
    credentials: true,            // allow cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/** Static: serve local uploads when using disk storage */
app.use("/uploads", express.static(STATIC_UPLOAD_DIR));

/** Health */
app.get("/health", (_req, res) => res.json({ ok: true, service: "backend" }));

/** API */
app.use("/api/v1", optionalAuth, router);


export default app;
