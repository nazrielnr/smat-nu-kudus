import { Hono } from "hono";
import type { AppEnv } from "./types";
import { cors } from "hono/cors";
import { requireAuth, errorResponse } from "./middleware/auth";
import { userRoutes } from "./routes/users";
import { authRoutes } from "./routes/auth";
import { wakifRoutes } from "./routes/wakif";
import { transactionRoutes } from "./routes/transactions";
import { assetRoutes } from "./routes/assets";
import { accountingRoutes } from "./routes/accounting";
import { reportRoutes } from "./routes/reports";
import { dashboardRoutes } from "./routes/dashboard";
import { auditLogRoutes } from "./routes/audit-logs";
import { settingsRoutes } from "./routes/settings";

const app = new Hono<AppEnv>();

app.onError((err, c) => errorResponse(err, c));
app.notFound((c) =>
  c.json({ success: false, error: { code: "NOT_FOUND", message: "Route tidak ditemukan" } }, 404)
);

app.use(
  "/api/v1/*",
  cors({
    origin: (origin, c) => c.env.CORS_ORIGIN ?? "http://localhost:5173",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  })
);

app.get("/api/v1/health", (c) => c.json({ success: true, data: { status: "ok" } }));

// Public auth routes (login sets cookie; logout works with or without session)
app.route("/api/v1/auth", authRoutes);

// Everything below requires authentication
app.use("/api/v1/*", requireAuth);
app.route("/api/v1/users", userRoutes);
app.route("/api/v1/wakif", wakifRoutes);
app.route("/api/v1/transactions", transactionRoutes);
app.route("/api/v1/assets", assetRoutes);
app.route("/api/v1", accountingRoutes);
app.route("/api/v1/reports", reportRoutes);
app.route("/api/v1/dashboard", dashboardRoutes);
app.route("/api/v1/audit-logs", auditLogRoutes);
app.route("/api/v1/settings", settingsRoutes);

export default app;
