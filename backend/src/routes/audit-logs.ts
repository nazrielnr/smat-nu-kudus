import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireRoles } from "../middleware/auth";
import { auditRepo } from "../repositories/audit";
import { parsePageQuery, buildPage } from "../utils/pagination";

export const auditLogRoutes = new Hono<AppEnv>();

auditLogRoutes.use("*", requireRoles("admin", "pemeriksa", "pimpinan"));

auditLogRoutes.get("/", async (c) => {
  const q = parsePageQuery(c.req.url);
  const sp = c.req.query();
  const { items, total } = await auditRepo(c.env.DB).list({
    action: sp.action,
    entity_type: sp.entity_type,
    user_id: sp.user_id ? Number(sp.user_id) : undefined,
    date_from: sp.date_from,
    date_to: sp.date_to,
    limit: q.limit,
    offset: q.offset,
  });
  // details kept as raw JSON string for append-only fidelity
  return c.json({ success: true, data: buildPage(items, total, q) });
});
